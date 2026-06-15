from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import uuid
import logging
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, UploadFile, File, Header, Query
from fastapi.responses import StreamingResponse, HTMLResponse, RedirectResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("radio")

# ---------------------- DB ---------------------- #
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ---------------------- App / Router ---------------------- #
app = FastAPI(title="Radio Latina API")
api = APIRouter(prefix="/api")

# ---------------------- Auth helpers ---------------------- #
JWT_ALGO = "HS256"
def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(hours=12)}
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGO)

def set_auth_cookie(resp: Response, token: str):
    resp.set_cookie(
        key="access_token", value=token, httponly=True,
        secure=True, samesite="none", max_age=60 * 60 * 12, path="/",
    )

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGO])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    return user

async def get_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")
    return user

# ---------------------- Object Storage ---------------------- #
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
APP_NAME = os.environ.get("APP_NAME", "radio-latina")
_storage_key: Optional[str] = None

def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        logger.warning("EMERGENT_LLM_KEY not set; storage disabled")
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage unavailable")
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if r.status_code == 403:
        # refresh key and retry once
        global _storage_key
        _storage_key = None
        key = init_storage()
        r = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    r.raise_for_status()
    return r.json()

def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage unavailable")
    r = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    if r.status_code == 403:
        global _storage_key
        _storage_key = None
        key = init_storage()
        r = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key}, timeout=60,
        )
    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="File not found")
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")

MIME = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp",
}

# ---------------------- Models ---------------------- #
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def slugify(text: str, max_len: int = 60) -> str:
    """Convert text to URL-friendly slug. Strips accents, lowercases, replaces spaces with dashes."""
    import unicodedata
    if not text:
        return ""
    # Strip accents
    nkfd = unicodedata.normalize("NFKD", text)
    no_accents = "".join(c for c in nkfd if not unicodedata.combining(c))
    # Lowercase, replace non-alphanumeric with dashes
    s = no_accents.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:max_len].rstrip("-") or str(uuid.uuid4())[:8]


# Spanish + English stop words to drop from generated post slugs so URLs stay short.
SLUG_STOPWORDS = {
    # Spanish
    "a", "al", "ante", "aqui", "asi", "bajo", "cada", "como", "con", "contra",
    "cual", "cuando", "de", "del", "desde", "donde", "dos", "el", "ella", "ellas",
    "ellos", "en", "entre", "era", "eres", "es", "esa", "esas", "ese", "eso",
    "esos", "esta", "estaba", "estamos", "estan", "estar", "estas", "este",
    "esto", "estos", "fue", "ha", "haber", "habia", "han", "hasta", "hay",
    "la", "las", "le", "les", "lo", "los", "mas", "me", "mi", "muy", "ni",
    "no", "nos", "o", "para", "pero", "poco", "por", "porque", "que", "quien",
    "quienes", "se", "sea", "ser", "si", "sin", "sobre", "solo", "son", "soy",
    "su", "sus", "tan", "te", "ti", "todo", "todos", "tu", "tus", "un", "una",
    "unas", "uno", "unos", "y", "ya", "yo",
    # English
    "the", "a", "an", "and", "or", "but", "of", "in", "on", "at", "to", "for",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "will", "would", "could", "should", "this", "that",
    "these", "those", "my", "your", "his", "her", "its", "our", "their",
}


def slugify_short(text: str, max_len: int = 35) -> str:
    """Generate a compact slug by dropping stop words and capping length.
    Keeps the slug human-readable but URL-friendly (~3-5 meaningful words max).
    """
    if not text:
        return ""
    raw = slugify(text, max_len=200)  # accent-stripped, lowercase, dash-joined
    if not raw:
        return ""
    parts = [p for p in raw.split("-") if p and p not in SLUG_STOPWORDS]
    out: list[str] = []
    length = 0
    for p in parts:
        add = (1 if out else 0) + len(p)  # account for the joining dash
        if length + add > max_len:
            break
        out.append(p)
        length += add
    return "-".join(out) or raw[:max_len].rstrip("-")


def strip_dj_labels(text: str) -> str:
    """Remove internal AI section labels [CAPTION] / [HASHTAGS] / [CTA] from DJ post text.
    Also drops trailing hashtag lines so the caption portion stays focused.
    """
    if not text:
        return ""
    # Drop the bracketed labels themselves (whole line if alone)
    cleaned = re.sub(r"^\s*\[(CAPTION|HASHTAGS|CTA)\]\s*:?\s*$", "", text, flags=re.MULTILINE | re.IGNORECASE)
    # Drop inline occurrences too
    cleaned = re.sub(r"\[(CAPTION|HASHTAGS|CTA)\]\s*:?", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def caption_only(text: str) -> str:
    """Return just the [CAPTION] section of an AI-generated DJ post (no hashtags, no CTA)."""
    if not text:
        return ""
    # Try to slice out the CAPTION block specifically
    m = re.search(
        r"\[CAPTION\]\s*(.+?)(?=\n\s*\[(?:HASHTAGS|CTA)\]|\Z)",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if m:
        return m.group(1).strip()
    # Fallback: strip any labels and return whatever's left
    return strip_dj_labels(text)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str

class ScheduleSlot(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)  # 0 = Mon
    start_time: str  # "HH:MM"
    end_time: str    # "HH:MM"

class AdvertiserIn(BaseModel):
    name: str
    tagline: Optional[str] = ""
    description: Optional[str] = ""
    special_offer: Optional[str] = ""
    cta_text: Optional[str] = "Order Now"
    phone: Optional[str] = ""
    whatsapp: Optional[str] = ""  # E.164 without '+', e.g. 13105550100
    address: Optional[str] = ""
    maps_url: Optional[str] = ""
    website_url: Optional[str] = ""
    banner_path: Optional[str] = ""  # storage path or external URL
    color: Optional[str] = "#EA580C"
    schedule: List[ScheduleSlot] = []
    # Pauta / traffic settings
    priority: int = Field(default=5, ge=1, le=10)  # higher = wins overlaps
    spots_per_hour: int = Field(default=4, ge=1, le=60)  # how many appearances per hour
    spot_duration_sec: int = Field(default=30, ge=5, le=600)  # how long popup stays visible
    # Owner reporting
    owner_email: Optional[str] = ""  # business owner contact

class Advertiser(AdvertiserIn):
    id: str
    slug: str
    created_at: str
    report_token: Optional[str] = ""  # opaque token for /reporte/:token public dashboard

class SettingsIn(BaseModel):
    station_name: Optional[str] = None
    station_tagline: Optional[str] = None
    station_whatsapp: Optional[str] = None
    stream_url: Optional[str] = None
    now_playing: Optional[str] = None
    active_advertiser_id: Optional[str] = None  # "" or null = none, "AUTO" = use schedule
    active_host_id: Optional[str] = None  # "" = none, "AUTO" = use schedule, id = pinned
    default_cta_text: Optional[str] = None
    default_cta_url: Optional[str] = None
    timezone: Optional[str] = None  # IANA, e.g. America/Los_Angeles
    cta_pause_seconds: Optional[int] = None  # gap between ads in rotation; default 60s
    default_hero_bg: Optional[str] = None  # background image URL for Home Hero when no host is live
    default_artwork: Optional[str] = None  # fallback image for the spinning vinyl + player when no song artwork

    # ----- Anúnciate page (advertising landing) -----
    sales_hero_title: Optional[str] = None      # e.g. "Tu negocio"
    sales_hero_subtitle: Optional[str] = None   # italic script line, e.g. "en boca de todos"
    sales_tagline: Optional[str] = None         # paragraph under hero
    sales_stat_listeners: Optional[str] = None  # e.g. "180,000+"
    sales_stat_households: Optional[str] = None
    sales_stat_counties: Optional[str] = None
    sales_person_name: Optional[str] = None
    sales_person_title: Optional[str] = None    # e.g. "Asesora de ventas..."
    sales_person_phone: Optional[str] = None    # e.g. "+15036230244"
    sales_person_whatsapp: Optional[str] = None # e.g. "15036230244" (no + or spaces)
    sales_person_email: Optional[str] = None
    sales_person_quote: Optional[str] = None
    sales_person_photo: Optional[str] = None    # uploaded path OR external URL

    # ----- Branding -----
    station_logo: Optional[str] = None  # path or external URL for nav/footer logo

    # ----- Featured Show (national exclusive program) -----
    featured_show_enabled: Optional[bool] = None        # show/hide the section
    featured_show_badge: Optional[str] = None           # e.g. "EXCLUSIVO EN LA CAMPEONA"
    featured_show_title: Optional[str] = None           # e.g. "El Show del Genio Lucas"
    featured_show_host: Optional[str] = None            # e.g. "Genio Lucas"
    featured_show_description: Optional[str] = None     # 1-3 sentences
    featured_show_schedule: Optional[str] = None        # e.g. "Lun-Vie · 8AM - 10AM"
    featured_show_photo: Optional[str] = None           # uploaded path or URL
    featured_show_whatsapp_text: Optional[str] = None   # WhatsApp prefill, e.g. "Saludos al Genio Lucas"


class HostScheduleSlot(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str  # "HH:MM"
    end_time: str


class HostIn(BaseModel):
    name: str
    show_name: Optional[str] = ""
    tagline: Optional[str] = ""
    bio: Optional[str] = ""
    photo_path: Optional[str] = ""  # storage path or external URL
    phone: Optional[str] = ""
    whatsapp: Optional[str] = ""
    facebook: Optional[str] = ""
    instagram: Optional[str] = ""
    color: Optional[str] = "#7F1D1D"
    schedule: List[HostScheduleSlot] = []


class Host(HostIn):
    id: str
    slug: str
    created_at: str


# ---------------------- Events ---------------------- #
class EventIn(BaseModel):
    title: str
    description: Optional[str] = ""
    location: Optional[str] = ""
    event_date: str  # "YYYY-MM-DD"  (start date, station local)
    end_date: Optional[str] = ""  # "YYYY-MM-DD"  (last day; empty = same as event_date)
    start_time: str = "19:00"  # "HH:MM"
    end_time: str = "23:00"  # "HH:MM"  (end time on the last day)
    image_path: Optional[str] = ""  # main banner / flyer
    gallery: List[str] = []  # additional photos (paths or URLs)
    address: Optional[str] = ""  # full address for maps directions (e.g. "123 Main St, Dallas, OR 97338")
    ticket_url: Optional[str] = ""
    category: str = Field(default="concierto")  # concierto | promocion | comunidad
    color: Optional[str] = "#7F1D1D"
    # CTA promotion
    promoted_as_cta: bool = False
    promote_from_date: Optional[str] = ""  # "YYYY-MM-DD"; empty = 7 days before event_date
    # Pauta (only used when promoted_as_cta=true)
    priority: int = Field(default=7, ge=1, le=10)
    spots_per_hour: int = Field(default=4, ge=1, le=60)
    spot_duration_sec: int = Field(default=30, ge=5, le=600)
    # Owner reporting
    owner_email: Optional[str] = ""


class Event(EventIn):
    id: str
    slug: str
    created_at: str
    report_token: Optional[str] = ""

# ---------------------- Settings helpers ---------------------- #
DEFAULT_SETTINGS = {
    "station_name": "Radio Latina FM",
    "station_tagline": "El sabor de tu música",
    "station_whatsapp": "19712279207",
    "stream_url": "https://ice1.somafm.com/groovesalad-128-mp3",
    "now_playing": "El Show de la Tarde",
    "active_advertiser_id": "AUTO",
    "active_host_id": "AUTO",
    "default_cta_text": "WhatsApp the Studio",
    "default_cta_url": "",
    "timezone": "America/Los_Angeles",
}

async def get_settings_doc() -> dict:
    doc = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not doc:
        doc = {"id": "global", **DEFAULT_SETTINGS, "updated_at": now_iso()}
        await db.settings.insert_one(doc)
        doc = await db.settings.find_one({"id": "global"}, {"_id": 0})
    return doc

# ---------------------- Schedule resolver ---------------------- #
def time_in_slot(now: datetime, slot: dict) -> bool:
    if now.weekday() != slot["day_of_week"]:
        return False
    try:
        sh, sm = map(int, slot["start_time"].split(":"))
        eh, em = map(int, slot["end_time"].split(":"))
    except Exception:
        return False
    start = now.replace(hour=sh, minute=sm, second=0, microsecond=0)
    end = now.replace(hour=eh, minute=em, second=0, microsecond=0)
    if end <= start:
        end = end + timedelta(days=1)
    return start <= now <= end


async def station_now() -> datetime:
    """Current time in the station's configured timezone."""
    settings = await get_settings_doc()
    tz_name = settings.get("timezone") or "UTC"
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo(tz_name))
    except Exception:
        return datetime.now(timezone.utc)


async def resolve_active_advertiser() -> Optional[dict]:
    """Resolve current promo to display (advertiser OR event with promoted_as_cta=true).
    - If active_advertiser_id is a specific id, returns that ad (manual pin).
    - If "AUTO", computes a weighted round-robin rotation among eligible items
      (advertisers whose schedule covers NOW + events promoted as CTA in the
      promotion window) using spots_per_hour, priority, and spot_duration_sec.
    """
    settings = await get_settings_doc()
    aid = (settings.get("active_advertiser_id") or "").strip()
    if aid and aid != "AUTO":
        adv = await db.advertisers.find_one({"id": aid}, {"_id": 0})
        if adv:
            adv["type"] = "advertiser"
            return adv
        return None
    if aid != "AUTO":
        return None

    now = await station_now()
    eligible: list[dict] = []

    # Advertisers whose schedule covers NOW
    cursor = db.advertisers.find({}, {"_id": 0})
    async for adv in cursor:
        for slot in adv.get("schedule") or []:
            if time_in_slot(now, slot):
                adv["type"] = "advertiser"
                eligible.append(adv)
                break

    # Events promoted as CTA in their promotion window
    cursor = db.events.find({}, {"_id": 0})
    async for ev in cursor:
        if is_event_eligible_for_cta(ev, now):
            ev["type"] = "event"
            eligible.append(ev)

    if not eligible:
        return None
    if len(eligible) == 1:
        # Single eligible item: respect the pause cycle so the user gets breaks
        pause_seconds = max(0, int(settings.get("cta_pause_seconds") or 60))
        item = eligible[0]
        spot_duration = max(5, int(item.get("spot_duration_sec", 30) or 30))
        if pause_seconds == 0:
            return item
        cycle = spot_duration + pause_seconds
        epoch_seconds = int(now.timestamp())
        seconds_in_cycle = epoch_seconds % cycle
        return item if seconds_in_cycle < spot_duration else None

    # Weighted round-robin — each item appears spots_per_hour times,
    # priority sorts items earlier in each round.
    eligible.sort(key=lambda a: (-int(a.get("priority", 5) or 5), str(a.get("id", ""))))
    remaining = {item["id"]: max(1, int(item.get("spots_per_hour", 4) or 4)) for item in eligible}
    rotation: list[dict] = []
    while sum(remaining.values()) > 0:
        for item in eligible:
            if remaining[item["id"]] > 0:
                rotation.append(item)
                remaining[item["id"]] -= 1

    pause_seconds = max(0, int(settings.get("cta_pause_seconds") or 60))
    # Build a timeline of (item_or_None, duration). After each ad we insert a pause slot.
    timeline: list[tuple[Optional[dict], int]] = []
    for item in rotation:
        spot_duration = max(5, int(item.get("spot_duration_sec", 30) or 30))
        timeline.append((item, spot_duration))
        if pause_seconds > 0:
            timeline.append((None, pause_seconds))

    cycle_duration = sum(d for _, d in timeline)
    if cycle_duration <= 0:
        return rotation[0]

    epoch_seconds = int(now.timestamp())
    seconds_in_cycle = epoch_seconds % cycle_duration
    elapsed = 0
    for item, duration in timeline:
        elapsed += duration
        if seconds_in_cycle < elapsed:
            return item  # may be None for pause slots
    return None


def is_event_eligible_for_cta(event: dict, now: datetime) -> bool:
    """Event is shown in SmartCTA rotation when promoted_as_cta=true and now
    falls between promote_from_date and end of (end_date or event_date) + end_time."""
    if not event.get("promoted_as_cta"):
        return False
    try:
        event_date = datetime.strptime(event["event_date"], "%Y-%m-%d").date()
    except Exception:
        return False
    end_date_str = (event.get("end_date") or "").strip()
    try:
        end_date = (
            datetime.strptime(end_date_str, "%Y-%m-%d").date()
            if end_date_str
            else event_date
        )
    except Exception:
        end_date = event_date
    if end_date < event_date:
        end_date = event_date
    today = now.date()
    promote_from = (event.get("promote_from_date") or "").strip()
    try:
        from_date = (
            datetime.strptime(promote_from, "%Y-%m-%d").date()
            if promote_from
            else event_date - timedelta(days=7)
        )
    except Exception:
        from_date = event_date - timedelta(days=7)
    if today < from_date or today > end_date:
        return False
    if today == end_date:
        try:
            eh, em = map(int, (event.get("end_time") or "23:59").split(":"))
            event_end = now.replace(hour=eh, minute=em, second=0, microsecond=0)
            return now <= event_end
        except Exception:
            return True
    return True


async def resolve_live_host() -> Optional[dict]:
    settings = await get_settings_doc()
    hid = (settings.get("active_host_id") or "").strip()
    if hid and hid != "AUTO":
        h = await db.hosts.find_one({"id": hid}, {"_id": 0})
        if h:
            return h
    if hid == "AUTO":
        now = await station_now()
        cursor = db.hosts.find({}, {"_id": 0})
        async for h in cursor:
            for slot in h.get("schedule") or []:
                if time_in_slot(now, slot):
                    return h
    return None

# ---------------------- Auth routes ---------------------- #
@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    set_auth_cookie(response, token)
    return {
        "user": {
            "id": user["id"], "email": user["email"], "name": user["name"],
            "role": user["role"], "host_slug": user.get("host_slug", ""),
        },
        "access_token": token,
    }

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"], "email": user["email"], "name": user["name"],
        "role": user["role"], "host_slug": user.get("host_slug", ""),
    }

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

# ---------------------- Public routes ---------------------- #
@api.get("/")
async def root():
    return {"message": "Radio Latina API", "ok": True}

@api.get("/settings")
async def public_settings():
    s = await get_settings_doc()
    s.pop("active_advertiser_id", None)  # internal
    s.pop("active_host_id", None)  # internal
    return s


# ---- Now playing (proxy to Streaming Pulse / maindigitalstream) ----
# Cached in memory for 15s to avoid hammering the upstream provider.
NOW_PLAYING_URL = os.environ.get(
    "NOW_PLAYING_URL",
    "https://us7.maindigitalstream.com/4550/?c=KWIP",
)
_now_playing_cache: dict = {"data": None, "fetched_at": 0.0}

@api.get("/now-playing")
async def now_playing():
    """Return current song metadata from the streaming provider, cached 15s."""
    import time as _time
    now = _time.time()
    if _now_playing_cache["data"] and (now - _now_playing_cache["fetched_at"]) < 15:
        return _now_playing_cache["data"]
    try:
        r = requests.get(
            NOW_PLAYING_URL,
            headers={"User-Agent": "LaCampeona/1.0", "Accept": "application/json"},
            timeout=4,
        )
        r.raise_for_status()
        raw = r.json()
        artist = (raw.get("artist") or "").strip()
        title = (raw.get("title") or "").strip()
        image = raw.get("image") or ""
        if image.startswith("//"):
            image = "https:" + image
        data = {
            "artist": artist,
            "title": title,
            "image": image,
            "ok": bool(title or artist),
        }
    except Exception as e:
        logger.warning("now_playing fetch failed: %s", e)
        data = {"artist": "", "title": "", "image": "", "ok": False}
    _now_playing_cache["data"] = data
    _now_playing_cache["fetched_at"] = now
    return data


@api.get("/active")
async def active_advertiser():
    adv = await resolve_active_advertiser()
    if adv:
        adv.pop("report_token", None)
        adv.pop("owner_email", None)
    return {"advertiser": adv}

@api.get("/live-host")
async def live_host():
    h = await resolve_live_host()
    return {"host": h}

@api.get("/hosts")
async def list_hosts():
    cursor = db.hosts.find({}, {"_id": 0}).sort("created_at", -1)
    items = await cursor.to_list(500)
    return items

@api.get("/hosts/{slug}")
async def get_host(slug: str):
    h = await db.hosts.find_one({"slug": slug}, {"_id": 0})
    if not h:
        h = await db.hosts.find_one({"id": slug}, {"_id": 0})
    if not h:
        raise HTTPException(status_code=404, detail="Host not found")
    return h

def strip_private(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return doc
    doc.pop("report_token", None)
    doc.pop("owner_email", None)
    return doc

@api.get("/advertisers")
async def list_advertisers():
    cursor = db.advertisers.find({}, {"_id": 0}).sort("created_at", -1)
    items = await cursor.to_list(500)
    return [strip_private(i) for i in items]

@api.get("/advertisers/{slug}")
async def get_advertiser(slug: str):
    adv = await db.advertisers.find_one({"slug": slug}, {"_id": 0})
    if not adv:
        adv = await db.advertisers.find_one({"id": slug}, {"_id": 0})
    if not adv:
        raise HTTPException(status_code=404, detail="Advertiser not found")
    return strip_private(adv)


# ---------------------- Tracking & Analytics ---------------------- #
class TrackIn(BaseModel):
    kind: str  # impression | call | whatsapp | directions | visit | tickets
    entity_type: str  # advertiser | event
    entity_id: str
    session_id: Optional[str] = ""


VALID_TRACK_KINDS = {"impression", "call", "whatsapp", "directions", "visit", "tickets"}
VALID_TRACK_TYPES = {"advertiser", "event"}


@api.post("/track")
async def track_event(payload: TrackIn):
    if payload.kind not in VALID_TRACK_KINDS:
        raise HTTPException(status_code=400, detail="Invalid kind")
    if payload.entity_type not in VALID_TRACK_TYPES:
        raise HTTPException(status_code=400, detail="Invalid entity_type")
    if not payload.entity_id:
        return {"ok": True, "skipped": True}
    # For impressions, dedupe per session_id within a 30s window so multiple polls
    # don't inflate counts when the same ad is shown to the same user.
    now = datetime.now(timezone.utc)
    if payload.kind == "impression" and payload.session_id:
        recent = await db.cta_events.find_one(
            {
                "kind": "impression",
                "entity_id": payload.entity_id,
                "session_id": payload.session_id,
                "created_at": {"$gte": now - timedelta(seconds=30)},
            },
            {"_id": 0, "id": 1},
        )
        if recent:
            return {"ok": True, "deduped": True}
    doc = {
        "id": str(uuid.uuid4()),
        "kind": payload.kind,
        "entity_type": payload.entity_type,
        "entity_id": payload.entity_id,
        "session_id": payload.session_id or "",
        "created_at": now,
    }
    await db.cta_events.insert_one(doc.copy())
    return {"ok": True}


def _date_str(d: datetime) -> str:
    return d.strftime("%Y-%m-%d")


async def _entity_stats(entity_id: str, days: int = 30) -> dict:
    """Returns aggregated stats for a single entity over last `days` days."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    cursor = db.cta_events.find(
        {"entity_id": entity_id, "created_at": {"$gte": since}},
        {"_id": 0, "kind": 1, "created_at": 1},
    )
    rows = await cursor.to_list(20000)
    totals = {k: 0 for k in VALID_TRACK_KINDS}
    daily: dict[str, dict] = {}
    for r in rows:
        k = r["kind"]
        totals[k] = totals.get(k, 0) + 1
        ds = _date_str(r["created_at"])
        if ds not in daily:
            daily[ds] = {kk: 0 for kk in VALID_TRACK_KINDS}
        daily[ds][k] = daily[ds].get(k, 0) + 1
    # Build complete daily series (fill zeros)
    series = []
    for i in range(days - 1, -1, -1):
        d = (now - timedelta(days=i))
        ds = _date_str(d)
        series.append({"date": ds, **daily.get(ds, {k: 0 for k in VALID_TRACK_KINDS})})
    impressions = totals.get("impression", 0)
    clicks = sum(v for k, v in totals.items() if k != "impression")
    return {
        "totals": totals,
        "impressions": impressions,
        "clicks": clicks,
        "ctr": (clicks / impressions) if impressions > 0 else 0.0,
        "series": series,
        "days": days,
    }


@api.get("/admin/analytics/overview")
async def admin_analytics_overview(days: int = 30, _: dict = Depends(get_admin)):
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    cursor = db.cta_events.find(
        {"created_at": {"$gte": since}},
        {"_id": 0, "kind": 1, "entity_id": 1, "entity_type": 1},
    )
    rows = await cursor.to_list(50000)
    totals = {k: 0 for k in VALID_TRACK_KINDS}
    by_entity: dict[str, dict] = {}
    for r in rows:
        k = r["kind"]
        totals[k] = totals.get(k, 0) + 1
        eid = r["entity_id"]
        if eid not in by_entity:
            by_entity[eid] = {
                "entity_id": eid,
                "entity_type": r["entity_type"],
                **{kk: 0 for kk in VALID_TRACK_KINDS},
            }
        by_entity[eid][k] += 1
    # Enrich with names
    ad_ids = [eid for eid, v in by_entity.items() if v["entity_type"] == "advertiser"]
    ev_ids = [eid for eid, v in by_entity.items() if v["entity_type"] == "event"]
    if ad_ids:
        async for adv in db.advertisers.find({"id": {"$in": ad_ids}}, {"_id": 0, "id": 1, "name": 1, "slug": 1}):
            by_entity[adv["id"]]["name"] = adv["name"]
            by_entity[adv["id"]]["slug"] = adv.get("slug", "")
    if ev_ids:
        async for ev in db.events.find({"id": {"$in": ev_ids}}, {"_id": 0, "id": 1, "title": 1, "slug": 1}):
            by_entity[ev["id"]]["name"] = ev["title"]
            by_entity[ev["id"]]["slug"] = ev.get("slug", "")
    items = list(by_entity.values())
    for it in items:
        impressions = it.get("impression", 0)
        clicks = sum(v for k, v in it.items() if k in VALID_TRACK_KINDS and k != "impression")
        it["impressions"] = impressions
        it["clicks"] = clicks
        it["ctr"] = (clicks / impressions) if impressions > 0 else 0.0
    items.sort(key=lambda x: -x.get("impressions", 0))
    impressions = totals.get("impression", 0)
    clicks = sum(v for k, v in totals.items() if k != "impression")
    return {
        "days": days,
        "totals": totals,
        "impressions": impressions,
        "clicks": clicks,
        "ctr": (clicks / impressions) if impressions > 0 else 0.0,
        "items": items,
    }


@api.get("/admin/analytics/{entity_type}/{entity_id}")
async def admin_entity_analytics(entity_type: str, entity_id: str, days: int = 30, _: dict = Depends(get_admin)):
    if entity_type not in VALID_TRACK_TYPES:
        raise HTTPException(status_code=400, detail="Invalid entity_type")
    coll = db.advertisers if entity_type == "advertiser" else db.events
    entity = await coll.find_one({"id": entity_id}, {"_id": 0})
    if not entity:
        raise HTTPException(status_code=404, detail="Not found")
    stats = await _entity_stats(entity_id, days=days)
    return {"entity": entity, "entity_type": entity_type, **stats}


@api.get("/admin/advertisers")
async def admin_list_advertisers(_: dict = Depends(get_admin)):
    """Admin-only listing that returns full advertiser data including report_token."""
    cursor = db.advertisers.find({}, {"_id": 0}).sort("created_at", -1)
    items = await cursor.to_list(500)
    return items


@api.get("/report/{token}")
async def public_report(token: str, days: int = 30):
    """Public dashboard accessed via opaque report_token."""
    adv = await db.advertisers.find_one({"report_token": token}, {"_id": 0})
    entity_type = "advertiser"
    if not adv:
        adv = await db.events.find_one({"report_token": token}, {"_id": 0})
        entity_type = "event"
    if not adv:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    stats = await _entity_stats(adv["id"], days=days)
    # Strip private from entity payload (we keep token-bearing access only,
    # don't echo it back)
    public_entity = {**adv}
    public_entity.pop("report_token", None)
    public_entity.pop("owner_email", None)
    return {"entity": public_entity, "entity_type": entity_type, **stats}


# ---------------------- Events (public) ---------------------- #
@api.get("/events")
async def list_events(include_past: bool = False):
    """Public events list. By default returns only events whose end_date (or
    event_date if no end_date) is today or future, sorted by event_date asc."""
    cursor = db.events.find({}, {"_id": 0}).sort([("event_date", 1), ("start_time", 1)])
    items = await cursor.to_list(500)
    if include_past:
        return [strip_private(i) for i in items]
    now = await station_now()
    today_str = now.date().isoformat()
    return [
        strip_private(e) for e in items
        if (e.get("end_date") or e.get("event_date") or "") >= today_str
    ]


@api.get("/events/{slug}")
async def get_event(slug: str):
    e = await db.events.find_one({"slug": slug}, {"_id": 0})
    if not e:
        e = await db.events.find_one({"id": slug}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    return strip_private(e)

# Public file proxy for banners (no auth — banners are intentionally public)
@api.get("/files/{path:path}")
async def serve_file(path: str):
    data, ct = get_object(path)
    return Response(content=data, media_type=ct, headers={"Cache-Control": "public, max-age=3600"})

# ---------------------- Admin routes ---------------------- #
@api.get("/admin/settings")
async def admin_get_settings(_: dict = Depends(get_admin)):
    return await get_settings_doc()

@api.put("/admin/settings")
async def admin_update_settings(payload: SettingsIn, _: dict = Depends(get_admin)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        return await get_settings_doc()
    update["updated_at"] = now_iso()
    await db.settings.update_one({"id": "global"}, {"$set": update}, upsert=True)
    return await get_settings_doc()

@api.post("/admin/advertisers")
async def admin_create_advertiser(payload: AdvertiserIn, _: dict = Depends(get_admin)):
    aid = str(uuid.uuid4())
    base_slug = slugify(payload.name)
    slug = base_slug
    n = 1
    while await db.advertisers.find_one({"slug": slug}):
        n += 1
        slug = f"{base_slug}-{n}"
    doc = {
        **payload.model_dump(),
        "id": aid,
        "slug": slug,
        "report_token": uuid.uuid4().hex,
        "created_at": now_iso(),
    }
    await db.advertisers.insert_one(doc.copy())
    return {**doc}

@api.put("/admin/advertisers/{aid}")
async def admin_update_advertiser(aid: str, payload: AdvertiserIn, _: dict = Depends(get_admin)):
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    res = await db.advertisers.update_one({"id": aid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Advertiser not found")
    adv = await db.advertisers.find_one({"id": aid}, {"_id": 0})
    return adv

@api.delete("/admin/advertisers/{aid}")
async def admin_delete_advertiser(aid: str, _: dict = Depends(get_admin)):
    await db.advertisers.delete_one({"id": aid})
    s = await get_settings_doc()
    if s.get("active_advertiser_id") == aid:
        await db.settings.update_one({"id": "global"}, {"$set": {"active_advertiser_id": "AUTO"}})
    return {"ok": True}

class ActivateIn(BaseModel):
    advertiser_id: Optional[str] = None  # "" or "AUTO" or id

@api.post("/admin/activate")
async def admin_activate(payload: ActivateIn, _: dict = Depends(get_admin)):
    aid = (payload.advertiser_id or "").strip()
    if aid and aid not in ("AUTO", ""):
        exists = await db.advertisers.find_one({"id": aid}, {"_id": 0})
        if not exists:
            raise HTTPException(status_code=404, detail="Advertiser not found")
    await db.settings.update_one({"id": "global"}, {"$set": {"active_advertiser_id": aid or "", "updated_at": now_iso()}}, upsert=True)
    s = await get_settings_doc()
    return s


class ActivateHostIn(BaseModel):
    host_id: Optional[str] = None  # "" or "AUTO" or id

@api.post("/admin/activate-host")
async def admin_activate_host(payload: ActivateHostIn, _: dict = Depends(get_admin)):
    hid = (payload.host_id or "").strip()
    if hid and hid not in ("AUTO", ""):
        exists = await db.hosts.find_one({"id": hid}, {"_id": 0})
        if not exists:
            raise HTTPException(status_code=404, detail="Host not found")
    await db.settings.update_one(
        {"id": "global"},
        {"$set": {"active_host_id": hid or "", "updated_at": now_iso()}},
        upsert=True,
    )
    s = await get_settings_doc()
    return s


@api.post("/admin/hosts")
async def admin_create_host(payload: HostIn, _: dict = Depends(get_admin)):
    hid = str(uuid.uuid4())
    base_slug = slugify(payload.name)
    slug = base_slug
    n = 1
    while await db.hosts.find_one({"slug": slug}):
        n += 1
        slug = f"{base_slug}-{n}"
    doc = {**payload.model_dump(), "id": hid, "slug": slug, "created_at": now_iso()}
    await db.hosts.insert_one(doc.copy())
    return {**doc}


@api.put("/admin/hosts/{hid}")
async def admin_update_host(hid: str, payload: HostIn, _: dict = Depends(get_admin)):
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    res = await db.hosts.update_one({"id": hid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Host not found")
    h = await db.hosts.find_one({"id": hid}, {"_id": 0})
    return h


@api.delete("/admin/hosts/{hid}")
async def admin_delete_host(hid: str, _: dict = Depends(get_admin)):
    await db.hosts.delete_one({"id": hid})
    s = await get_settings_doc()
    if s.get("active_host_id") == hid:
        await db.settings.update_one({"id": "global"}, {"$set": {"active_host_id": "AUTO"}})
    return {"ok": True}


# ---------------------- Events (admin) ---------------------- #
@api.get("/admin/events")
async def admin_list_events(_: dict = Depends(get_admin)):
    cursor = db.events.find({}, {"_id": 0}).sort([("event_date", 1), ("start_time", 1)])
    items = await cursor.to_list(500)
    return items


@api.post("/admin/events")
async def admin_create_event(payload: EventIn, _: dict = Depends(get_admin)):
    eid = str(uuid.uuid4())
    base_slug = slugify(payload.title)
    slug = base_slug
    n = 1
    while await db.events.find_one({"slug": slug}):
        n += 1
        slug = f"{base_slug}-{n}"
    doc = {
        **payload.model_dump(),
        "id": eid,
        "slug": slug,
        "report_token": uuid.uuid4().hex,
        "created_at": now_iso(),
    }
    await db.events.insert_one(doc.copy())
    return {**doc}


@api.put("/admin/events/{eid}")
async def admin_update_event(eid: str, payload: EventIn, _: dict = Depends(get_admin)):
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    res = await db.events.update_one({"id": eid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    e = await db.events.find_one({"id": eid}, {"_id": 0})
    return e


@api.delete("/admin/events/{eid}")
async def admin_delete_event(eid: str, _: dict = Depends(get_admin)):
    await db.events.delete_one({"id": eid})
    return {"ok": True}


@api.post("/admin/upload")
async def admin_upload(file: UploadFile = File(...), _: dict = Depends(get_admin)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    if ext not in MIME:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
    content_type = MIME[ext]
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 8MB)")
    path = f"{APP_NAME}/banners/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, content_type)
    final_path = result["path"]
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": final_path,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": now_iso(),
    })
    return {"path": final_path, "url": f"/api/files/{final_path}"}

# ---------------------- Content Studio (DJ) ---------------------- #
# 8 transformative templates for safe-repost / original DJ content.
# Spanish-first (latino US station). Each template defines the input fields the
# DJ must fill and a per-template instruction appended to the base system msg.
CONTENT_TEMPLATES: dict = {
    "today_in_history": {
        "label": "Hoy en la historia",
        "emoji": "📜",
        "description": "Un evento memorable de la música o cultura latina que pasó un día como hoy.",
        "fields": [
            {"key": "topic", "label": "Tema o evento", "placeholder": "Ej: estreno de 'La Bamba', cumpleaños de Selena…", "required": True},
            {"key": "year", "label": "Año (opcional)", "placeholder": "1987", "required": False},
        ],
        "instruction": "Crea un post tipo 'Un día como hoy' sobre: {topic}. Año: {year}. Si solo dan el tema, agrega el contexto histórico adecuado. Cierra invitando a la audiencia a sintonizar para escuchar canciones relacionadas.",
    },
    "hot_take": {
        "label": "Opinión picante",
        "emoji": "🔥",
        "description": "Una opinión que invite al debate respetuoso.",
        "fields": [
            {"key": "topic", "label": "Tema musical", "placeholder": "Ej: ¿Bad Bunny merece ser el rey del reggaetón?", "required": True},
            {"key": "stance", "label": "Tu postura (opcional)", "placeholder": "A favor / en contra / matizado", "required": False},
        ],
        "instruction": "Genera una opinión picante pero respetuosa sobre: {topic}. Postura sugerida: {stance}. Termina con una pregunta directa que invite a la audiencia a contestar en los comentarios.",
    },
    "throwback": {
        "label": "Throwback / Recuerdo",
        "emoji": "📼",
        "description": "Nostalgia musical para conectar con la comunidad.",
        "fields": [
            {"key": "memory", "label": "Recuerdo o canción", "placeholder": "Ej: 'Vivir mi vida' de Marc Anthony", "required": True},
            {"key": "year", "label": "Año (opcional)", "placeholder": "2013", "required": False},
        ],
        "instruction": "Genera un post nostálgico sobre: {memory}. Año: {year}. Conecta con sentimientos de comunidad latina y termina invitando a compartir su recuerdo favorito.",
    },
    "poll": {
        "label": "Encuesta",
        "emoji": "📊",
        "description": "Pregunta directa con opciones para activar la audiencia.",
        "fields": [
            {"key": "question", "label": "Pregunta", "placeholder": "¿Cuál es la mejor canción del verano?", "required": True},
            {"key": "options", "label": "Opciones (separadas por coma)", "placeholder": "Despechá, Tití me preguntó, Provenza", "required": True},
        ],
        "instruction": "Genera una encuesta para redes sobre: {question}. Opciones a votar: {options}. Si son menos de 2, sugiere 3-4 opciones tú mismo. Formato listo para Instagram/Facebook.",
    },
    "behind_scenes": {
        "label": "Detrás de cámaras",
        "emoji": "🎙️",
        "description": "Momento auténtico de la cabina o el estudio.",
        "fields": [
            {"key": "situation", "label": "Situación", "placeholder": "Ej: cómo me preparo para el show de las 6am", "required": True},
        ],
        "instruction": "Genera un post tipo 'detrás de cámaras' sobre: {situation}. Tono auténtico, cercano, como si lo contara el DJ a un amigo. Cierra con una invitación a sintonizar.",
    },
    "important_day": {
        "label": "Día importante",
        "emoji": "🎉",
        "description": "Efeméride o celebración relevante para la comunidad latina.",
        "fields": [
            {"key": "day_name", "label": "Nombre del día", "placeholder": "Día de la Independencia de México, Día del Padre…", "required": True},
            {"key": "angle", "label": "Ángulo o mensaje (opcional)", "placeholder": "Ej: agradecer a los papás trabajadores", "required": False},
        ],
        "instruction": "Genera un post celebrando: {day_name}. Ángulo o mensaje: {angle}. Conecta emocionalmente con la comunidad latina en EE.UU. y propone una canción o saludo en vivo.",
    },
    "inspirational_quote": {
        "label": "Frase inspiradora",
        "emoji": "✨",
        "description": "Frase motivadora con contexto.",
        "fields": [
            {"key": "topic", "label": "Tema o emoción", "placeholder": "Perseverancia, familia, amor propio…", "required": True},
            {"key": "author", "label": "Autor sugerido (opcional)", "placeholder": "Selena, Celia Cruz, anónimo…", "required": False},
        ],
        "instruction": "Genera una frase inspiradora ORIGINAL (no copies frases famosas literalmente — reformula) sobre: {topic}. Atribuye libremente a: {author}, o si no aplica, déjala anónima/inspirada. Acompaña con un mini-mensaje del DJ a la audiencia.",
    },
    "musical_recommendation": {
        "label": "Recomendación musical",
        "emoji": "🎵",
        "description": "Una canción o artista para descubrir.",
        "fields": [
            {"key": "song_artist", "label": "Canción / artista", "placeholder": "Karol G - Mañana Será Bonito", "required": True},
            {"key": "why", "label": "Por qué la recomiendas (opcional)", "placeholder": "Es perfecta para manejar al trabajo", "required": False},
        ],
        "instruction": "Recomienda: {song_artist}. Razón del DJ: {why}. Da 2-3 datos curiosos del artista o canción y cierra invitando a pedirla en vivo.",
    },
    # ----- Plantillas LOCALES (Sprint A - Feb 2026) -----
    "birthday_shoutout": {
        "label": "Cumpleaños / Saludo",
        "emoji": "🎂",
        "description": "Saludo cálido para un oyente (cumpleaños, aniversario, dedicatoria).",
        "fields": [
            {"key": "name", "label": "Nombre de la persona", "placeholder": "Doña Lupita, Carlos, los esposos García…", "required": True},
            {"key": "occasion", "label": "Ocasión", "placeholder": "Cumpleaños 50, aniversario, día de la madre…", "required": True},
            {"key": "from_who", "label": "De parte de (opcional)", "placeholder": "Su familia, su esposo, sus hijos…", "required": False},
            {"key": "city", "label": "Ciudad (opcional)", "placeholder": "Dallas, Salem, Woodburn…", "required": False},
        ],
        "instruction": "Genera un saludo cálido y emotivo para {name} con motivo de: {occasion}. De parte de: {from_who}. Ciudad: {city}. Tono cariñoso, latino, como si lo dijera el DJ al aire. Sugiere una canción para dedicarle. Termina invitando a la audiencia a sumarse en los comentarios.",
    },
    "local_business": {
        "label": "Negocio del Día",
        "emoji": "🛒",
        "description": "Destaca un negocio local hispano con su historia y servicio.",
        "fields": [
            {"key": "business_name", "label": "Nombre del negocio", "placeholder": "Taquería La Esquina, Carnicería Don José…", "required": True},
            {"key": "what_they_do", "label": "Qué hacen / venden", "placeholder": "Tacos al pastor, cortes mexicanos, plomería…", "required": True},
            {"key": "city", "label": "Ciudad", "placeholder": "Dallas Oregon, Salem, Woodburn…", "required": True},
            {"key": "story", "label": "Historia o detalle especial (opcional)", "placeholder": "Familiar desde 2005, recetas de la abuela…", "required": False},
        ],
        "instruction": "Crea un post destacando el negocio local {business_name} en {city} que ofrece {what_they_do}. Historia: {story}. Tono cercano y orgulloso del trabajo latino. Resalta cómo apoyar a la comunidad. Invita a la audiencia a visitarlos y compartir su experiencia.",
    },
    "abuela_recipe": {
        "label": "Receta de la Abuela",
        "emoji": "🍳",
        "description": "Receta tradicional con storytelling familiar.",
        "fields": [
            {"key": "dish", "label": "Platillo", "placeholder": "Pozole, mole rojo, tamales de elote…", "required": True},
            {"key": "region", "label": "Región / origen (opcional)", "placeholder": "Jalisco, Oaxaca, Guatemala…", "required": False},
            {"key": "special_tip", "label": "Tip o secreto (opcional)", "placeholder": "La abuela siempre le ponía un chile guajillo extra…", "required": False},
        ],
        "instruction": "Crea un post sobre la receta de {dish}. Región: {region}. Secreto familiar: {special_tip}. Comparte 4-6 ingredientes clave y 1-2 pasos rápidos (no la receta completa — pícales la curiosidad). Termina pidiendo a los oyentes que compartan cómo la hace SU abuela en los comentarios. Tono nostálgico y cálido.",
    },
    "saints_calendar": {
        "label": "Día Santo / Efeméride",
        "emoji": "🙏",
        "description": "Celebración religiosa o efeméride importante para la comunidad latina.",
        "fields": [
            {"key": "day_name", "label": "Nombre del día", "placeholder": "Día de la Virgen de Guadalupe, San Judas, Posadas…", "required": True},
            {"key": "tradition", "label": "Tradición o ritual (opcional)", "placeholder": "Mañanitas, rosario, procesión, posada con piñata…", "required": False},
            {"key": "personal_angle", "label": "Mensaje personal (opcional)", "placeholder": "Recuerdo de la infancia, gratitud, esperanza…", "required": False},
        ],
        "instruction": "Crea un post celebrando: {day_name}. Tradición asociada: {tradition}. Mensaje personal: {personal_angle}. Tono respetuoso y emotivo, conectando con la fe y tradiciones de la comunidad latina en EE.UU. Invita a compartir cómo lo celebran en familia.",
    },
    "farm_voice": {
        "label": "La Voz del Campo",
        "emoji": "🌽",
        "description": "Contenido útil para trabajadores agrícolas y sus familias.",
        "fields": [
            {"key": "topic", "label": "Tema", "placeholder": "Clima de la semana, derechos laborales, temporada de manzana…", "required": True},
            {"key": "key_message", "label": "Mensaje clave", "placeholder": "Reportar abusos al salario es seguro y confidencial…", "required": True},
            {"key": "resource", "label": "Recurso / contacto (opcional)", "placeholder": "PCUN: 503-981-XXXX, clínica gratuita…", "required": False},
        ],
        "instruction": "Crea un post útil y respetuoso para trabajadores del campo y sus familias sobre: {topic}. Mensaje clave: {key_message}. Recurso/contacto: {resource}. Tono solidario y práctico, NUNCA condescendiente. Reconoce el valor del trabajo agrícola. Termina invitando a llamar a la radio si tienen preguntas.",
    },
    "community_alert": {
        "label": "Aviso Comunitario",
        "emoji": "🚨",
        "description": "Avisos útiles de servicio: clima, cierres, despensas, eventos. NO política ni inmigración.",
        "fields": [
            {"key": "alert_type", "label": "Tipo de aviso", "placeholder": "Cierre de calle, despensa gratis, ola de calor, vacunación, apagón…", "required": True},
            {"key": "what", "label": "¿Qué está pasando?", "placeholder": "Cierre de la I-5 entre Salem y Albany por accidente; despensa GRATIS en…", "required": True},
            {"key": "where", "label": "Dónde", "placeholder": "Iglesia San José Salem, parque de Dallas, todo el condado de Polk…", "required": True},
            {"key": "when", "label": "Cuándo", "placeholder": "Sábado 8 de marzo de 10am a 2pm; Toda esta semana; Hoy hasta las 6pm…", "required": True},
            {"key": "source", "label": "Fuente (opcional)", "placeholder": "ODOT, NOAA, Salem Health, escuela, etc.", "required": False},
        ],
        "instruction": "Crea un AVISO COMUNITARIO de SERVICIO PÚBLICO (no es chisme ni opinión). Tipo: {alert_type}. Qué pasa: {what}. Dónde: {where}. Cuándo: {when}. Fuente: {source}. REGLAS CRÍTICAS:\n- NO inventes datos: usa SOLO la información que te di arriba. Si falta un dato, no lo rellenes — déjalo fuera del post.\n- NUNCA menciones política, partidos, candidatos, Trump, Biden, leyes federales, ni temas de inmigración (ICE, USCIS, deportaciones, etc.). Esta plantilla NO es para eso.\n- Tono directo, útil, comunitario. Como avisaría una vecina solidaria, no como reportero sensacionalista.\n- Empieza con un llamado de atención claro (ej. '⚠️ ATENCIÓN VECINOS DE SALEM' o '🥶 OLA DE FRÍO ESTA SEMANA').\n- Si es una alerta de seguridad/clima, incluye un consejo práctico simple (cubrirse del calor, manejar despacio, llevar comida no perecedera, etc.).\n- Cierra invitando a compartir el aviso con familiares y vecinos.",
    },
    # ----- Plantillas DEPORTIVAS (Sprint A.2 - Feb 2026) -----
    "mexican_soccer": {
        "label": "Fútbol Mexicano",
        "emoji": "⚽",
        "description": "Liga MX, Selección Nacional, equipos y jugadores mexicanos.",
        "fields": [
            {"key": "team_or_player", "label": "Equipo o jugador", "placeholder": "América, Chivas, Selección Mexicana, Santi Giménez…", "required": True},
            {"key": "situation", "label": "Situación", "placeholder": "Ganó el clásico, anotó hat-trick, regresa a la Selección, lesión…", "required": True},
            {"key": "angle", "label": "Ángulo o opinión (opcional)", "placeholder": "Por fin levantó el equipo, era hora, polémica con el técnico…", "required": False},
        ],
        "instruction": "Crea un post sobre fútbol mexicano: {team_or_player} — {situation}. Ángulo del DJ: {angle}. Tono apasionado y futbolero (la audiencia VIVE para Liga MX y la Selección). Si es Liga MX, usa el nombre cariñoso del equipo (Águilas, Rebaño, Tuzos, Rayados, etc.). Cierra preguntando con qué equipo va la audiencia o invitando a opinar.",
    },
    "world_cup_2026": {
        "label": "Mundial 2026",
        "emoji": "🏆",
        "description": "Mundial 2026 (México + EE.UU. + Canadá). Selección, partidos, sedes, fan zones.",
        "fields": [
            {"key": "topic", "label": "Tema", "placeholder": "Partido de México, sede, jugador convocado, fan fest, calendario…", "required": True},
            {"key": "detail", "label": "Detalle / dato concreto", "placeholder": "México vs Argentina en el Estadio Azteca, sede de Seattle, etc.", "required": True},
            {"key": "angle", "label": "Ángulo (opcional)", "placeholder": "Orgullo nacional, expectativas, recuerdo de Mundiales pasados…", "required": False},
        ],
        "instruction": "Crea un post sobre el MUNDIAL 2026 (organizado por México, EE.UU. y Canadá). Tema: {topic}. Detalle: {detail}. Ángulo: {angle}. Tono lleno de orgullo nacional. Reconoce que es histórico que México sea sede otra vez después de 1986. Si es sobre la Selección, evoca los recuerdos de Hugo Sánchez, Jorge Campos, los Mundiales pasados. Invita a sintonizar para los previos del partido o a compartir con quién verán el partido.",
    },
    "latinos_abroad": {
        "label": "Latinos en el Mundo",
        "emoji": "🌎",
        "description": "Jugadores latinoamericanos destacando en ligas extranjeras (Europa, MLS).",
        "fields": [
            {"key": "player", "label": "Jugador", "placeholder": "Santi Giménez, Edson Álvarez, Luis Díaz, Hirving Lozano…", "required": True},
            {"key": "club_country", "label": "Club / país", "placeholder": "Milan (Italia), West Ham (Inglaterra), Liverpool (Inglaterra)…", "required": True},
            {"key": "achievement", "label": "Hazaña o noticia", "placeholder": "Anotó doblete, asistencia clave, capitán del equipo, transferencia…", "required": True},
        ],
        "instruction": "Crea un post celebrando al jugador latinoamericano {player} ({club_country}) por: {achievement}. Tono de ORGULLO LATINO — la audiencia se identifica fuertísimo con que 'uno de los nuestros' brille en el extranjero. Si es mexicano, usa expresiones como 'Mi México', 'paisano', 'el orgullo verde'. Cierra invitando a compartir el éxito con la familia y a sintonizar la radio para más noticias del deporte latino.",
    },
}


## ----- AUDIENCE PROFILE (KWIP La Campeona) -----
# Injected into every AI prompt (generation + suggestions) so Claude always
# tailors content to the REAL audience instead of generic young-Latino assumptions.
AUDIENCE_PROFILE = (
    "PERFIL DE LA AUDIENCIA (CRÍTICO — RESPETAR EN TODO):\n"
    "- Adultos de 40 años para ARRIBA. La mayoría son MUJERES (mamás, abuelitas, esposas, jefas de familia).\n"
    "- Los hombres suelen ser trabajadores del CAMPO, CONSTRUCCIÓN y SERVICIOS (jardinería, restaurantes, "
    "limpieza, mecánica). Personas trabajadoras, de manos rudas, mucha vida vivida.\n"
    "- Inmigrantes mayormente mexicanos y centroamericanos en Oregon (Dallas, Salem, Woodburn, Independence). "
    "Muchos años en EE.UU., raíces fuertes en su pueblo. Catolicismo presente.\n\n"
    "MÚSICA QUE LA RADIO TOCA (úsala como referencia, NUNCA recomiendes nada fuera de esto):\n"
    "- REGIONAL MEXICANO clásico: ranchera, banda, norteño, mariachi, grupero, cumbia clásica, sonidero.\n"
    "- BALADA ROMÁNTICA y bolero (en español).\n"
    "- DÉCADAS principalmente: 80s, 90s, 2000s. Algo de 70s y principios de 2010s si aplica.\n"
    "- Artistas modelo (cita libremente cuando convenga): Vicente Fernández, Joan Sebastian, Marco Antonio Solís, "
    "Los Tigres del Norte, Ana Gabriel, Rocío Dúrcal, Juan Gabriel, Selena, Pedro Infante, Jenni Rivera, "
    "Pepe Aguilar, Antonio Aguilar, Los Bukis, Bronco, Los Temerarios, Los Ángeles Azules, Banda El Recodo, "
    "Banda MS (temas clásicos), José José, Camilo Sesto, Rocío Jurado, Pandora, Yuri, Lucero, Alejandro Fernández, "
    "Espinoza Paz (baladas), Pablo Montero, Lupita D'Alessio, Pepe Aguilar, Conjunto Primavera.\n\n"
    "PROHIBIDO ESTRICTO:\n"
    "- NO menciones ni recomiendes reggaetón moderno (Bad Bunny, Karol G, Anuel, Rauw Alejandro, Feid, etc.). "
    "Esa música NO encaja con esta audiencia y los hace sentir excluidos.\n"
    "- NO uses jerga juvenil tipo 'que perreo', 'flow', 'gata', 'tigueraje', 'demure', 'periodt', etc.\n"
    "- NO trates al lector como joven de TikTok. Esta gente NO está en TikTok — están en Facebook y WhatsApp.\n"
    "- NO uses anglicismos innecesarios ('mood', 'vibe', 'cringe'). Habla español natural y respetuoso.\n"
    "- LÍNEA EDITORIAL DEL DUEÑO — NO hablar de POLÍTICA, partidos, candidatos, Trump, Biden, elecciones, "
    "leyes federales polémicas. Tampoco temas de INMIGRACIÓN (ICE, USCIS, DACA, deportaciones, redadas, "
    "abogados de inmigración como tema noticioso). La radio NO opina sobre estos temas. Si el tema que te "
    "dan toca esto, mejor reformula evitando el ángulo político/migratorio o devuelve un post genérico.\n\n"
    "TONO CORRECTO:\n"
    "- Cariñoso, respetuoso, con mucha calidez familiar. 'Comadre', 'mi gente', 'señoras y señores', 'paisanos'.\n"
    "- Valora el trabajo duro, la familia, la fe, el sacrificio, las raíces.\n"
    "- Nostalgia bien usada (recuerdos del pueblo, de cuando llegaron a EE.UU., de sus padres/abuelos).\n"
    "- Emojis SÍ, pero con moderación y los apropiados: ❤️ 🙏 🌹 🇲🇽 🎵 ☕ 🌽 ✨ ⚽ 🏆 (NO 💀 🔥 demasiado, 😈, etc.).\n\n"
    "INTERESES DEPORTIVOS (muy fuertes en esta audiencia):\n"
    "- FÚTBOL es religión. Liga MX especialmente: América (Águilas), Chivas (Rebaño), Cruz Azul, Pumas, "
    "Monterrey (Rayados), Tigres, Toluca, Pachuca (Tuzos). El clásico América-Chivas mueve familias enteras.\n"
    "- SELECCIÓN MEXICANA (El Tri) — partidos en Fechas FIFA y especialmente el Mundial 2026 (México + EE.UU. + Canadá).\n"
    "- JUGADORES LATINOS EN EUROPA — Santi Giménez (Milan), Edson Álvarez, Hirving Lozano, también Luis Díaz, "
    "Vinícius Jr, Messi (Inter Miami), Julián Álvarez. La audiencia se ENORGULLECE de que 'uno de los nuestros' brille.\n"
    "- BOXEO también pega: Canelo Álvarez, legado de Julio César Chávez, etc.\n"
    "- NO usar terminología técnica solo en inglés. Usa términos en español: portero (no 'goalkeeper'), "
    "delantero, hat-trick está bien, gol, asistencia, mediocampista.\n"
)


def build_dj_system_message(platform: str, station_name: str, host_name: str, variant_tone: str = "") -> str:
    base = (
        f"Eres un copywriter experto en redes sociales para una estación de radio latina "
        f"({station_name}) en Estados Unidos. Hablas como el DJ {host_name}. "
        f"Tu trabajo es generar contenido en ESPAÑOL, pegadizo, breve, con tono coloquial latino, "
        f"optimizado para {platform}. Evita reposts literales — todo debe ser TRANSFORMATIVO y original.\n\n"
        f"{AUDIENCE_PROFILE}\n"
        f"DEVUELVE EXACTAMENTE este formato (sin explicaciones extra):\n"
        f"[CAPTION]\n<texto del post, 2-5 líneas, máximo 280 caracteres si es Twitter/X, "
        f"hasta 2200 si es Instagram/Facebook>\n\n"
        f"[HASHTAGS]\n<5-8 hashtags relevantes mezclando español e inglés, separados por espacios, todos comenzando con #>\n\n"
        f"[CTA]\n<una sola línea con una llamada a la acción que dirija al oyente a sintonizar la radio, "
        f"comentar o compartir>"
    )
    tone_extras = {
        "casual": "\n\nTONO ESPECIAL: casual pero RESPETUOSO con la audiencia adulta — como platicando con una comadre en la tienda, no con un adolescente. Usa expresiones cotidianas mexicanas/latinas, NO jerga juvenil.",
        "motivational": "\n\nTONO ESPECIAL: motivacional e inspirador. Conecta con sueños, perseverancia, orgullo latino, el sacrificio del trabajador inmigrante. Que el lector termine sintiendo que sí se puede.",
        "shorter": "\n\nTONO ESPECIAL: ultra-corto y punchy. CAPTION máximo 200 caracteres. Una frase que pegue duro, sin relleno.",
        "emotional": "\n\nTONO ESPECIAL: muy emocional, familiar, cercano. Habla de la familia, los recuerdos del pueblo, la patria, la fe. Que provoque guardar el post y compartirlo con un ser querido.",
    }
    if variant_tone in tone_extras:
        base += tone_extras[variant_tone]
    return base


def build_dj_user_message(template_key: str, inputs: dict, station_name: str) -> str:
    tmpl = CONTENT_TEMPLATES[template_key]
    safe_inputs = {f["key"]: (inputs.get(f["key"]) or "—").strip() or "—" for f in tmpl["fields"]}
    instruction = tmpl["instruction"].format(**safe_inputs)
    return (
        f"Estación: {station_name}\n"
        f"Plantilla: {tmpl['label']}\n"
        f"Datos del DJ:\n"
        + "\n".join([f"- {f['label']}: {safe_inputs[f['key']]}" for f in tmpl["fields"]])
        + f"\n\nInstrucción: {instruction}"
    )


async def get_dj(user: dict = Depends(get_current_user)) -> dict:
    """Allow role=dj, role=admin, or role=super_admin to use the Content Studio."""
    if user.get("role") not in ("dj", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="DJ only")
    return user


def dj_host_slug(user: dict) -> str:
    """Each draft is scoped to a host_slug. Admins acting in DJ console use
    the special slug '__admin__' so they don't collide with real DJ drafts."""
    return (user.get("host_slug") or "").strip() or ("__admin__" if user.get("role") == "admin" else "")


class GenerateDraftIn(BaseModel):
    template_type: str
    inputs: dict = {}
    platform: str = "instagram"  # instagram | facebook | tiktok | twitter
    save: bool = False  # if true, also persists the generated text as a draft
    variant_tone: Optional[str] = ""  # ""|casual|motivational|shorter|emotional


class ContentDraftIn(BaseModel):
    template_type: str
    inputs: dict = {}
    text: str
    platform: str = "instagram"
    title: Optional[str] = ""
    status: str = "draft"  # draft | scheduled | published
    scheduled_at: Optional[str] = ""  # ISO date "YYYY-MM-DD" or full ISO datetime
    fb_post_url: Optional[str] = ""  # original FB post URL for comment embed
    cover_image: Optional[str] = ""  # optional image URL for the public page


class ContentDraftPatch(BaseModel):
    text: Optional[str] = None
    platform: Optional[str] = None
    title: Optional[str] = None
    status: Optional[str] = None
    scheduled_at: Optional[str] = None
    fb_post_url: Optional[str] = None
    cover_image: Optional[str] = None


# ---------- Slugify helper (defined earlier near LoginIn) ----------


# Per-template ideation prompt used by /api/dj/suggest. Returns 10 ready-to-use
# ideas with prefilled inputs that match the template's fields schema.
SUGGESTION_PROMPTS: dict = {
    "today_in_history": "Hoy es {today}. Dame 10 eventos memorables de la MÚSICA REGIONAL MEXICANA, BALADA ROMÁNTICA o cultura latina clásica (80s-2000s) que pasaron exactamente esta fecha en distintos años. Estrenos de canciones rancheras/banda/norteño/balada, nacimientos de Vicente Fernández, Juan Gabriel, Joan Sebastian, Ana Gabriel, Selena, Pedro Infante, etc., premios Lo Nuestro o Grammy Latino antiguos, fallecimientos memorables. NUNCA reggaetón moderno ni artistas urbanos jóvenes.",
    "hot_take": "Dame 10 opiniones picantes pero RESPETUOSAS para debatir en Facebook (audiencia mujeres 40+ y hombres trabajadores). Temas que les muevan: las novelas modernas vs las clásicas, si los hijos respetan a los padres como antes, ranchera vs banda, Vicente vs Joan Sebastian, José José vs Camilo Sesto, si la música nueva ya no es como antes, recetas que se han perdido, modas que no entienden. NUNCA opiniones sobre reggaetón actual ni temas de jóvenes.",
    "throwback": "Dame 10 canciones LATINAS icónicas perfectas para un Throwback que conecte con adultos 40+ (mujeres en su mayoría). SOLO de las décadas 70s, 80s, 90s y 2000s. Géneros: ranchera, banda, norteño, balada romántica, bolero, grupero, cumbia clásica. Ejemplos del tipo: 'Hermoso Cariño - Vicente Fernández', 'Tatuajes - Joan Sebastian', 'Costumbres - Rocío Dúrcal', 'Amor Eterno - Juan Gabriel', 'Si Una Vez - Selena', 'Te Quiero Mucho - Los Bukis'. Para cada una incluye el año. NUNCA Bad Bunny, Karol G, ni nada urbano moderno.",
    "poll": "Dame 10 ideas de ENCUESTAS para Facebook (audiencia adulta 40+, mujeres + trabajadores). Temas que les apasionan: '¿Vicente o Joan Sebastian?', '¿Cuál es la mejor canción para llorar?', '¿Mole rojo o verde?', '¿Cuál novela clásica te marcó?', '¿Vacaciones en México o quedarse aquí?', '¿La cumbia se baila pegado o suelto?'. Cada idea es una pregunta concreta con 3-4 opciones cortas. NUNCA temas de música urbana moderna.",
    "behind_scenes": "Dame 10 momentos AUTÉNTICOS de detrás de cámaras que un DJ de radio regional mexicana puede compartir (preparación del show, anécdotas con oyentes que llaman, dedicatorias graciosas, momento en que se le quebró la voz al poner una de Vicente, el reto de elegir la canción de cierre, cuando la abuelita llama a pedir 'Las Mañanitas'). Concretos, cálidos.",
    "important_day": "Hoy es {today}. Dame 10 DÍAS IMPORTANTES o efemérides relevantes para la comunidad LATINA INMIGRANTE en EE.UU. en los próximos 60 días: días patrios mexicanos/centroamericanos, Día de las Madres mexicano (10 mayo), Día del Padre, Día del Niño, Día del Maestro, fiestas patronales, Día de Muertos, Día de la Virgen, aniversarios de artistas regionales fallecidos (Vicente Fernández, Juan Gabriel, Selena, Joan Sebastian, Jenni Rivera), Hispanic Heritage Month. Indica la fecha.",
    "inspirational_quote": "Dame 10 IDEAS DE TEMAS para frases inspiradoras dirigidas a la comunidad latina trabajadora 40+ en EE.UU.: el sacrificio de los padres, las manos del trabajador del campo, las mamás que crían lejos de su pueblo, la fe en tiempos difíciles, llegar con nada y salir adelante, valores que enseñaron los abuelos, agradecer a Dios por el día. Solo el TEMA, no copies frases famosas.",
    "musical_recommendation": "Dame 10 CANCIONES LATINAS CLÁSICAS (años 80s, 90s y 2000s) para recomendar al aire en una radio regional mexicana/romántica para audiencia 40+. Géneros: ranchera, banda, norteño, grupero, balada romántica, bolero, cumbia. Ejemplos del tipo: 'El Rey - Vicente Fernández', 'Tu Cárcel - Los Bukis', 'Costumbres - Rocío Dúrcal', 'Como Tú - Joan Sebastian', 'No Me Sé Rajar - Banda El Recodo', 'Mi Razón de Ser - Banda MS'. Para cada una incluye una razón corta de por qué pega con la audiencia. NUNCA recomiendes música urbana moderna (Bad Bunny, Karol G, etc.).",
    # ----- Sugerencias para plantillas locales -----
    "birthday_shoutout": "Dame 10 ideas REALISTAS de saludos/dedicatorias que recibe una radio regional mexicana en Oregon (audiencia 40+): cumpleaños de Doña/Don, aniversarios de bodas de plata/oro, Día de la Madre, abuelitos cumpliendo años, dedicatorias del esposo a la esposa, padrinos de boda, mamá del cumpleañero pidiendo Mañanitas. Para cada idea inventa nombres latinos verosímiles (Doña Lupita, Don José, Doña Rosa) y una ocasión concreta.",
    "local_business": "Dame 10 IDEAS de tipos de NEGOCIOS LATINOS familiares típicos en Oregon (Dallas, Salem, Woodburn, Independence) que la audiencia 40+ frecuenta: taquerías de toda la vida, carnicerías estilo mexicano, panaderías de pan dulce, tiendas de productos mexicanos, paleterías/neverías, salones de belleza para señoras, mecánicos honestos, plomeros, joyerías de oro 14k, despachos de envíos a México, talleres de hojalatería y pintura, lavanderías. Para cada uno inventa un nombre realista (estilo 'Carnicería Don José') y una historia corta. NO incluyas abogados de inmigración ni negocios de trámites migratorios.",
    "abuela_recipe": "Dame 10 RECETAS TRADICIONALES MEXICANAS y centroamericanas de toda la vida — las que las señoras de 40+ saben de memoria: pozole rojo, mole, tamales de elote/dulce/rajas, atole de avena/champurrado, sopes, gorditas, chiles en nogada, capirotada, arroz con leche, frijoles charros, caldo de res, birria, asado de boda, cochinita pibil, enchiladas suizas. Para cada uno indica el platillo, una región o país de origen y un secreto familiar concreto (la abuela siempre le ponía X, lo dejaba reposar Y, etc.).",
    "saints_calendar": "Hoy es {today}. Dame 10 DÍAS RELIGIOSOS, SANTOS o EFEMÉRIDES católicas relevantes para la comunidad mexicana/centroamericana en los próximos 90 días (audiencia 40+ con fe muy presente): Virgen de Guadalupe (12 dic), San Judas Tadeo (28 cada mes y 28 oct), Virgen de San Juan de los Lagos, Sagrado Corazón, Posadas (16-24 dic), Semana Santa, Día de Muertos, Inmaculada Concepción (8 dic), Día de la Candelaria (2 feb), Virgen del Carmen (16 jul), Domingo de Ramos, Asunción de la Virgen (15 ago). Para cada uno indica la fecha y una tradición concreta mexicana.",
    "farm_voice": "Dame 10 TEMAS ÚTILES para trabajadores agrícolas y de construcción hispanos del Pacífico Noroeste de EE.UU. (recolección de manzana, pera, blueberry, viñedo, cherry; obra negra/acabados): golpe de calor y protección contra el sol, salario justo (overtime en Oregon), pago de tiempo extra, exposición a pesticidas y equipo de protección, clínicas de salud comunitaria gratuitas/Salud Familiar, refugios de invierno, seguro de auto y de trabajo, herramientas de seguridad para construcción, programas de inglés gratis, ayuda con la luz/gas (LIHEAP), bancos de comida. Para cada uno propón un mensaje clave concreto y un recurso real si lo conoces. NO toques temas migratorios.",
    "community_alert": "Dame 10 IDEAS de AVISOS COMUNITARIOS de servicio público típicos en Oregon (Dallas, Salem, Woodburn, Polk County, Marion County) para una radio que sirve a la comunidad latina 40+. NUNCA política, NUNCA inmigración. Solo avisos útiles: cierres de carretera (I-5, Hwy 22, OR-99W), ola de calor en verano, humo de incendios forestales, hielo/nevada en invierno, despensas gratis de comida, ferias de salud y vacunación, eventos de regreso a clases, cierres de escuelas por clima, programas de ayuda con la luz/gas (LIHEAP), recolección de basura especial, campañas de donación de juguetes en diciembre. Para cada idea da: tipo de aviso, qué pasa (concreto), dónde (lugar real verosímil), cuándo (fecha/horario), y fuente realista.",
    # ----- Sugerencias deportivas -----
    "mexican_soccer": "Dame 10 IDEAS de posts sobre fútbol mexicano relevantes ahora mismo (Liga MX y Selección Nacional). Equipos clásicos: América, Chivas, Cruz Azul, Pumas, Monterrey/Rayados, Tigres, Toluca, Pachuca. Temas: clásicos del fin de semana (especialmente América vs Chivas), liguilla, regreso de la Selección a una Fecha FIFA, debate sobre el técnico, lesión importante, jugador goleador del momento, refuerzo nuevo, fichajes, polémicas arbitrales clásicas. Para cada idea inventa un escenario verosímil con equipo/jugador y situación concreta. NUNCA inventes resultados específicos de partidos que no han sucedido.",
    "world_cup_2026": "Dame 10 IDEAS de posts sobre el MUNDIAL 2026 (México, EE.UU. y Canadá). Temas: México como sede (Azteca, Estadio Akron, Estadio BBVA), partidos clave del Grupo de México, jugadores de la Selección Mexicana convocados (Santi Giménez, Edson Álvarez, Hirving Lozano, etc.), nostalgia de México 1986 (Diego Maradona, Hugo Sánchez), expectativas, sedes en EE.UU. cercanas a Oregon (Seattle, Los Angeles, San Francisco/Santa Clara), cómo ver los partidos en familia, cantos clásicos. Para cada idea da un tema concreto, un detalle factual y un ángulo emocional.",
    "latinos_abroad": "Dame 10 IDEAS de posts sobre JUGADORES LATINOAMERICANOS destacados en ligas extranjeras (Europa, MLS, Arabia). Jugadores referencia: Santi Giménez (Milan), Edson Álvarez (Fenerbahçe/West Ham), Hirving Lozano, Luis Díaz (Bayern), Lautaro Martínez (Inter), Lionel Messi (Inter Miami), Julián Álvarez (Atlético), Vinícius Jr (Real Madrid), Rodrygo, Darwin Núñez, Luis Suárez, Jhon Durán, James Rodríguez. Para cada idea inventa una hazaña concreta verosímil (gol importante, asistencia, capitanía, milestone, transferencia rumoreada) y di con qué emoción debe contarse.",
}


class SuggestIn(BaseModel):
    template_type: str


@api.post("/dj/suggest")
async def dj_suggest(payload: SuggestIn, user: dict = Depends(get_dj)):
    """Returns 10 ready-to-use ideas for the given template, with each idea's
    inputs prefilled so the DJ can pick one and generate the post in one click."""
    import json
    import re

    if payload.template_type not in CONTENT_TEMPLATES:
        raise HTTPException(status_code=400, detail="Plantilla inválida")
    if not EMERGENT_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY no configurado")

    settings = await get_settings_doc()
    station_name = settings.get("station_name") or "La Campeona"
    tmpl = CONTENT_TEMPLATES[payload.template_type]
    today = datetime.now(timezone.utc).strftime("%d de %B de %Y")

    fields_desc = ", ".join([f'"{f["key"]}" ({f["label"]})' for f in tmpl["fields"]])
    schema_example = ", ".join([f'"{f["key"]}": "valor concreto"' for f in tmpl["fields"]])
    base_prompt = SUGGESTION_PROMPTS.get(
        payload.template_type, "Dame 10 ideas creativas relevantes."
    ).format(today=today)

    system_msg = (
        f"Eres asistente de contenido para la radio regional mexicana {station_name} (Oregon, EE.UU.). "
        f"Genera EXACTAMENTE 10 ideas para la plantilla '{tmpl['label']}'. "
        f"Cada idea debe completar estos campos: {fields_desc}.\n\n"
        f"{AUDIENCE_PROFILE}\n"
        f"REGLAS DE SALIDA — IMPORTANTÍSIMO:\n"
        f"- Devuelve SOLAMENTE un JSON válido (un array de 10 objetos).\n"
        f"- NO uses bloques markdown, NO escribas texto antes ni después.\n"
        f"- Cada objeto tiene esta forma exacta:\n"
        f'  {{"title": "título descriptivo corto (max 90 chars)", "inputs": {{ {schema_example} }}}}\n'
        f"- Valores en español. Las ideas deben ser CONCRETAS, no genéricas, y ALINEADAS al perfil arriba."
    )

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = (
            LlmChat(
                api_key=EMERGENT_KEY,
                session_id=f"dj-sg-{user['id']}-{uuid.uuid4().hex[:8]}",
                system_message=system_msg,
            )
            .with_model("anthropic", "claude-sonnet-4-5-20250929")
        )
        raw = await chat.send_message(UserMessage(text=base_prompt))
    except Exception as e:
        logger.exception("DJ suggest failed")
        raise HTTPException(status_code=502, detail=f"Sugerencia falló: {e}")

    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE | re.MULTILINE).strip()
    m = re.search(r"\[\s*{.*}\s*\]", cleaned, re.DOTALL)
    if m:
        cleaned = m.group(0)

    try:
        suggestions = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON from Claude (template={payload.template_type}): {raw[:400]}")
        raise HTTPException(status_code=502, detail="La IA devolvió un formato inesperado. Inténtalo de nuevo.")

    if not isinstance(suggestions, list):
        raise HTTPException(status_code=502, detail="La IA no devolvió una lista")

    valid_keys = {f["key"] for f in tmpl["fields"]}
    out: list = []
    for s in suggestions[:10]:
        if not isinstance(s, dict):
            continue
        title = str(s.get("title", "")).strip()[:200]
        ins_raw = s.get("inputs") or {}
        if not isinstance(ins_raw, dict):
            continue
        inputs = {k: str(v).strip() for k, v in ins_raw.items() if isinstance(k, str) and k in valid_keys}
        if not title:
            continue
        out.append({"title": title, "inputs": inputs})

    if not out:
        raise HTTPException(status_code=502, detail="La IA no devolvió ideas válidas. Inténtalo de nuevo.")

    return {"suggestions": out, "template_type": payload.template_type}


@api.get("/dj/templates")
async def dj_list_templates(_: dict = Depends(get_dj)):
    return [
        {"key": k, **{kk: vv for kk, vv in v.items() if kk != "instruction"}}
        for k, v in CONTENT_TEMPLATES.items()
    ]


@api.get("/dj/me")
async def dj_me(user: dict = Depends(get_dj)):
    host = None
    slug = (user.get("host_slug") or "").strip()
    if slug:
        host = await db.hosts.find_one({"slug": slug}, {"_id": 0})
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "host_slug": slug,
        "host": host,
    }


@api.post("/dj/generate")
async def dj_generate(payload: GenerateDraftIn, user: dict = Depends(get_dj)):
    if payload.template_type not in CONTENT_TEMPLATES:
        raise HTTPException(status_code=400, detail="Plantilla inválida")
    if not EMERGENT_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY no configurado")

    settings = await get_settings_doc()
    station_name = settings.get("station_name") or "La Campeona"
    slug = dj_host_slug(user)
    host_name = user.get("name") or "el DJ"
    if slug and slug != "__admin__":
        h = await db.hosts.find_one({"slug": slug}, {"_id": 0, "name": 1, "show_name": 1})
        if h:
            host_name = h.get("show_name") or h.get("name") or host_name

    system_msg = build_dj_system_message(payload.platform, station_name, host_name, payload.variant_tone or "")
    user_msg = build_dj_user_message(payload.template_type, payload.inputs, station_name)

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = (
            LlmChat(
                api_key=EMERGENT_KEY,
                session_id=f"dj-{user['id']}-{uuid.uuid4().hex[:8]}",
                system_message=system_msg,
            )
            .with_model("anthropic", "claude-sonnet-4-5-20250929")
        )
        text = await chat.send_message(UserMessage(text=user_msg))
    except Exception as e:
        logger.exception("DJ generation failed")
        raise HTTPException(status_code=502, detail=f"Generación falló: {e}")

    result = {
        "text": text,
        "template_type": payload.template_type,
        "platform": payload.platform,
        "inputs": payload.inputs,
    }

    if payload.save:
        now = now_iso()
        # Generate unique slug from text (strip internal [CAPTION]/[HASHTAGS]/[CTA] labels first)
        slug_source = caption_only(text)[:80] or "post"
        base_slug = slugify_short(slug_source) or "post"
        slug_candidate = base_slug
        n = 0
        while await db.content_drafts.find_one({"slug": slug_candidate}, {"_id": 0}):
            n += 1
            slug_candidate = f"{base_slug}-{n}"
        doc = {
            "id": str(uuid.uuid4()),
            "host_slug": slug,
            "user_id": user["id"],
            "template_type": payload.template_type,
            "inputs": payload.inputs,
            "text": text,
            "platform": payload.platform,
            "title": "",
            "status": "draft",
            "scheduled_at": "",
            "slug": slug_candidate,
            "views_count": 0,
            "fb_post_url": "",
            "cover_image": "",
            "created_at": now,
            "updated_at": now,
        }
        await db.content_drafts.insert_one(doc.copy())
        result["draft"] = {k: v for k, v in doc.items() if k != "_id"}

    return result


@api.get("/dj/drafts")
async def dj_list_drafts(user: dict = Depends(get_dj)):
    slug = dj_host_slug(user)
    query: dict = {}
    if user.get("role") == "dj":
        query["host_slug"] = slug
    cursor = db.content_drafts.find(query, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(500)


@api.post("/dj/drafts")
async def dj_create_draft(payload: ContentDraftIn, user: dict = Depends(get_dj)):
    if payload.template_type not in CONTENT_TEMPLATES:
        raise HTTPException(status_code=400, detail="Plantilla inválida")
    now = now_iso()

    # Auto-generate unique URL slug from title or first sentence of text
    # (strip internal [CAPTION]/[HASHTAGS]/[CTA] labels first, then drop stop words)
    raw_base = payload.title or (caption_only(payload.text or "")[:80] if payload.text else "post")
    base_slug = slugify_short(raw_base) or "post"
    # Ensure uniqueness: append short suffix if needed
    slug_candidate = base_slug
    n = 0
    while await db.content_drafts.find_one({"slug": slug_candidate}, {"_id": 0}):
        n += 1
        slug_candidate = f"{base_slug}-{n}"

    doc = {
        "id": str(uuid.uuid4()),
        "host_slug": dj_host_slug(user),
        "user_id": user["id"],
        **payload.model_dump(),
        "slug": slug_candidate,
        "views_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    await db.content_drafts.insert_one(doc.copy())
    return {k: v for k, v in doc.items() if k != "_id"}


@api.patch("/dj/drafts/{draft_id}")
async def dj_update_draft(draft_id: str, payload: ContentDraftPatch, user: dict = Depends(get_dj)):
    existing = await db.content_drafts.find_one({"id": draft_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Borrador no encontrado")
    if user.get("role") == "dj" and existing.get("host_slug") != dj_host_slug(user):
        raise HTTPException(status_code=403, detail="No es tu borrador")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = now_iso()
    await db.content_drafts.update_one({"id": draft_id}, {"$set": update})
    doc = await db.content_drafts.find_one({"id": draft_id}, {"_id": 0})
    return doc


@api.delete("/dj/drafts/{draft_id}")
async def dj_delete_draft(draft_id: str, user: dict = Depends(get_dj)):
    existing = await db.content_drafts.find_one({"id": draft_id}, {"_id": 0})
    if not existing:
        return {"ok": True}
    if user.get("role") == "dj" and existing.get("host_slug") != dj_host_slug(user):
        raise HTTPException(status_code=403, detail="No es tu borrador")
    await db.content_drafts.delete_one({"id": draft_id})
    return {"ok": True}


# -------- AI Image generation (Gemini Nano Banana) ----------
class GenerateImageIn(BaseModel):
    draft_id: Optional[str] = None  # if provided, image will be saved as draft.cover_image
    prompt: Optional[str] = None    # custom prompt override
    aspect: Optional[str] = "wide"  # "wide" (16:9 for FB share) or "square" (1:1 for IG)


@api.post("/dj/generate-image")
async def dj_generate_image(payload: GenerateImageIn, user: dict = Depends(get_dj)):
    """Generates a unique cover image for a post using Gemini Nano Banana."""
    import base64 as _b64
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    # Resolve prompt: explicit, or derive from draft's text
    prompt_text = (payload.prompt or "").strip()
    draft = None
    if payload.draft_id:
        draft = await db.content_drafts.find_one({"id": payload.draft_id}, {"_id": 0})
        if not draft:
            raise HTTPException(status_code=404, detail="Draft no encontrado")
        if user.get("role") == "dj" and draft.get("host_slug") != dj_host_slug(user):
            raise HTTPException(status_code=403, detail="No es tu borrador")
        if not prompt_text:
            base_text = (draft.get("title") or draft.get("text") or "").strip()
            prompt_text = base_text

    if not prompt_text:
        raise HTTPException(status_code=400, detail="Falta prompt o draft con texto")

    aspect_hint = (
        "wide cinematic 16:9 landscape composition, leave space at the top for a headline"
        if payload.aspect != "square"
        else "perfect 1:1 square composition centered"
    )

    full_prompt = (
        f"Cover image for a Spanish-language radio station post by 'La Campeona 880 AM' "
        f"(KWIP, Dallas Oregon). Topic: {prompt_text}\n\n"
        f"Style: vibrant photo-illustration, latin culture friendly, warm red/orange/amber palette, "
        f"high quality, editorial magazine style, ready for Facebook/Instagram sharing. "
        f"{aspect_hint}. No text or letters in the image."
    )

    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY no está configurada")

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"img-{uuid.uuid4()}",
            system_message="You generate eye-catching cover images for a Spanish-language radio station.",
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
            modalities=["image", "text"]
        )
        msg = UserMessage(text=full_prompt)
        _, images = await chat.send_message_multimodal_response(msg)
    except Exception as e:
        logger.error("Gemini image generation failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Error al generar imagen: {str(e)[:120]}")

    if not images:
        raise HTTPException(status_code=502, detail="No se recibió imagen del modelo")

    img = images[0]
    image_bytes = _b64.b64decode(img["data"])
    content_type = img.get("mime_type") or "image/png"
    ext = "png" if "png" in content_type else "jpg"

    # Store in Emergent Object Storage (same path scheme as /admin/upload)
    storage_path = f"{APP_NAME}/banners/{uuid.uuid4()}.{ext}"
    result = put_object(storage_path, image_bytes, content_type)
    final_path = result["path"]

    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": final_path,
        "content_type": content_type,
        "size": result.get("size", len(image_bytes)),
        "is_deleted": False,
        "source": "ai_generated",
        "created_at": now_iso(),
    })

    # If linked to a draft, persist as its cover_image
    if draft:
        await db.content_drafts.update_one(
            {"id": draft["id"]},
            {"$set": {"cover_image": final_path, "updated_at": now_iso()}},
        )

    return {"path": final_path, "url": f"/api/files/{final_path}"}


# ============================================================
#  PUBLIC POSTS — landing pages for social media traffic
# ============================================================
@api.get("/posts/recent")
async def posts_recent(limit: int = 6):
    """Recent published posts. Used both by 'related posts' sidebars and the
    public /blog listing page (with larger limit)."""
    capped = min(max(limit, 1), 100)
    cursor = (
        db.content_drafts.find(
            {"status": "published", "slug": {"$exists": True, "$ne": ""}},
            {"_id": 0, "text": 1, "title": 1, "slug": 1, "cover_image": 1, "created_at": 1, "host_slug": 1, "template_type": 1, "views_count": 1},
        )
        .sort("created_at", -1)
        .limit(capped)
    )
    return await cursor.to_list(capped)


@api.get("/posts/{slug}")
async def posts_by_slug(slug: str):
    """Public read of a single post by its URL slug. Increments view counter."""
    doc = await db.content_drafts.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Post no encontrado")
    # Fire-and-forget view increment
    try:
        await db.content_drafts.update_one({"slug": slug}, {"$inc": {"views_count": 1}})
    except Exception:
        pass

    # Pick a random advertiser (so each visit shows a different sponsor).
    # Advertisers don't carry an explicit `active` flag — being in the collection means publishable.
    advertiser = None
    try:
        ads = await db.advertisers.find({}, {"_id": 0}).to_list(100)
        if ads:
            import random as _random
            advertiser = strip_private(_random.choice(ads))
    except Exception:
        pass

    # Host info (for byline)
    host = None
    if doc.get("host_slug"):
        host = await db.hosts.find_one({"slug": doc["host_slug"]}, {"_id": 0})

    return {
        "post": doc,
        "advertiser": advertiser,
        "host": host,
    }


_SOCIAL_CRAWLERS = (
    "facebookexternalhit", "facebot", "twitterbot", "whatsapp", "slackbot",
    "telegrambot", "linkedinbot", "pinterest", "discordbot", "embedly",
    "redditbot", "googlebot", "bingbot", "vkshare", "skypeuripreview",
)


@api.get("/posts/og/{slug}")
async def post_og(slug: str, request: Request):
    """Open Graph page for a blog post. Social crawlers (Facebook/WhatsApp/…)
    get the article title, excerpt and cover image WITHOUT a redirect; humans
    are redirected to the real article so they read it on the app."""
    import html as _html
    import re as _re
    base = _public_base(request)
    view_url = f"{base}/p/{slug}"
    og_url = f"{base}/api/posts/og/{slug}"
    ua = (request.headers.get("user-agent") or "").lower()
    is_crawler = any(b in ua for b in _SOCIAL_CRAWLERS)

    doc = await db.content_drafts.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        return RedirectResponse(view_url)

    title = (doc.get("title") or "La Campeona 880 AM").strip()
    raw = doc.get("text") or ""
    desc = _re.sub(r"[*#`_>]+", "", raw)
    desc = _re.sub(r"^\s*(DJ|Locutor|Host|Conductor)\s*:.*$", "", desc, flags=_re.M | _re.I)
    desc = _re.sub(r"\s+", " ", desc).strip()
    if len(desc) > 200:
        desc = desc[:197].rstrip() + "…"
    if not desc:
        desc = "Noticias, música y comunidad en La Campeona 880 AM."

    cover = (doc.get("cover_image") or "").strip()
    if cover.lower().startswith("http"):
        img = cover
    elif cover:
        img = f"{base}/api/files/{cover}"
    else:
        img = f"{base}/logos/la-campeona-880am.png"

    e = _html.escape
    redirect_bits = "" if is_crawler else (
        f"<meta http-equiv=\"refresh\" content=\"0; url={e(view_url)}\">"
        f"<script>window.location.replace({_html.escape(repr(view_url))});</script>"
    )
    html_page = (
        "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        f"<title>{e(title)} · La Campeona 880 AM</title>"
        "<meta property=\"og:type\" content=\"article\">"
        "<meta property=\"og:site_name\" content=\"La Campeona 880 AM\">"
        f"<meta property=\"og:title\" content=\"{e(title)}\">"
        f"<meta property=\"og:description\" content=\"{e(desc)}\">"
        f"<meta property=\"og:image\" content=\"{e(img)}\">"
        f"<meta property=\"og:url\" content=\"{e(og_url)}\">"
        "<meta name=\"twitter:card\" content=\"summary_large_image\">"
        f"<meta name=\"twitter:title\" content=\"{e(title)}\">"
        f"<meta name=\"twitter:description\" content=\"{e(desc)}\">"
        f"<meta name=\"twitter:image\" content=\"{e(img)}\">"
        f"{redirect_bits}"
        "</head><body style=\"font-family:sans-serif;text-align:center;padding:40px\">"
        f"<p>Redirigiendo… <a href=\"{e(view_url)}\">Leer el artículo</a></p>"
        "</body></html>"
    )
    return HTMLResponse(content=html_page)



# ---------------------- Super Admin ---------------------- #
VALID_ROLES = {"super_admin", "admin", "dj"}


def _public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u.get("role", ""),
        "host_slug": u.get("host_slug", ""),
        "created_at": u.get("created_at", ""),
    }


class SuperUserIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # super_admin | admin | dj
    host_slug: Optional[str] = ""


class SuperUserPatch(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    host_slug: Optional[str] = None


class SuperPasswordIn(BaseModel):
    password: str


@api.get("/super/users")
async def super_list_users(_: dict = Depends(get_super_admin)):
    cursor = db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1)
    items = await cursor.to_list(500)
    return [_public_user(u) for u in items]


@api.post("/super/users")
async def super_create_user(payload: SuperUserIn, _: dict = Depends(get_super_admin)):
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Rol inválido")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Contraseña mínima 6 caracteres")
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Ese correo ya existe")
    host_slug = (payload.host_slug or "").strip()
    if payload.role == "dj" and host_slug:
        h = await db.hosts.find_one({"slug": host_slug}, {"_id": 0, "id": 1})
        if not h:
            raise HTTPException(status_code=400, detail="host_slug no existe")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name.strip() or email.split("@")[0],
        "role": payload.role,
        "host_slug": host_slug,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc.copy())
    return _public_user(doc)


@api.patch("/super/users/{user_id}")
async def super_update_user(user_id: str, payload: SuperUserPatch, current: dict = Depends(get_super_admin)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    update: dict = {}
    if payload.name is not None:
        update["name"] = payload.name.strip()
    if payload.role is not None:
        if payload.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="Rol inválido")
        # Prevent demoting yourself accidentally
        if user_id == current["id"] and payload.role != "super_admin":
            raise HTTPException(status_code=400, detail="No puedes cambiar tu propio rol")
        update["role"] = payload.role
    if payload.host_slug is not None:
        slug = payload.host_slug.strip()
        if slug:
            h = await db.hosts.find_one({"slug": slug}, {"_id": 0, "id": 1})
            if not h:
                raise HTTPException(status_code=400, detail="host_slug no existe")
        update["host_slug"] = slug
    if not update:
        return _public_user(target)
    update["updated_at"] = now_iso()
    await db.users.update_one({"id": user_id}, {"$set": update})
    fresh = await db.users.find_one({"id": user_id}, {"_id": 0})
    return _public_user(fresh)


@api.post("/super/users/{user_id}/password")
async def super_reset_password(user_id: str, payload: SuperPasswordIn, _: dict = Depends(get_super_admin)):
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Contraseña mínima 6 caracteres")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(payload.password), "updated_at": now_iso()}},
    )
    return {"ok": True}


@api.delete("/super/users/{user_id}")
async def super_delete_user(user_id: str, current: dict = Depends(get_super_admin)):
    if user_id == current["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"ok": True}


@api.get("/super/stats")
async def super_stats(_: dict = Depends(get_super_admin)):
    now = datetime.now(timezone.utc)
    since30 = now - timedelta(days=30)
    users_count = await db.users.count_documents({})
    by_role = {}
    async for u in db.users.find({}, {"_id": 0, "role": 1}):
        r = u.get("role", "unknown")
        by_role[r] = by_role.get(r, 0) + 1
    advertisers_count = await db.advertisers.count_documents({})
    events_count = await db.events.count_documents({})
    hosts_count = await db.hosts.count_documents({})
    drafts_count = await db.content_drafts.count_documents({})
    drafts_30d = await db.content_drafts.count_documents({"created_at": {"$gte": since30.isoformat()}})
    impressions_30d = await db.cta_events.count_documents({"kind": "impression", "created_at": {"$gte": since30}})
    clicks_30d = await db.cta_events.count_documents({"kind": {"$ne": "impression"}, "created_at": {"$gte": since30}})
    return {
        "users": {"total": users_count, "by_role": by_role},
        "content": {
            "hosts": hosts_count,
            "advertisers": advertisers_count,
            "events": events_count,
            "drafts_total": drafts_count,
            "drafts_30d": drafts_30d,
        },
        "engagement_30d": {
            "impressions": impressions_30d,
            "clicks": clicks_30d,
            "ctr": (clicks_30d / impressions_30d) if impressions_30d > 0 else 0.0,
        },
    }


@api.post("/super/rotate-token/{entity_type}/{entity_id}")
async def super_rotate_token(entity_type: str, entity_id: str, _: dict = Depends(get_super_admin)):
    if entity_type not in VALID_TRACK_TYPES:
        raise HTTPException(status_code=400, detail="entity_type inválido")
    coll = db.advertisers if entity_type == "advertiser" else db.events
    new_token = uuid.uuid4().hex
    res = await coll.update_one({"id": entity_id}, {"$set": {"report_token": new_token, "updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="No encontrado")
    return {"ok": True, "report_token": new_token}


# ---------------------- World Cup 2026 Bracket / Quiniela ---------------------- #
# A public engagement contest: users submit predictions (Quick Pick or Pro mode),
# admin sets the official results as games unfold, and scores are recalculated on
# every read. Driven by /api/bracket/* endpoints and /quiniela frontend routes.
#
# Scoring (Quick Pick, max 100 pts):
#   - Champion correct                  -> 25 pts
#   - Runner-up correct                 -> 15 pts
#   - Each other semifinalist correct   -> 10 pts (any order)
#   - Top scorer (Pichichi) correct     -> 15 pts
#   - Final score EXACT (home + away)   -> 20 pts (or 5 pts for correct winner)
#   - Mexico advances to quarters Y/N   ->  5 pts
#
# Pro mode adds: bonus +1 per correct group winner (12 groups -> max +12),
# +2 per correct Round of 16 advancer (16 picks -> max +32), +3 per correct
# quarter-finalist (8 picks -> max +24). Pro max is 100 + 68 = 168.

WORLD_CUP_2026_TEAMS = [
    # Hosts (auto-qualified)
    "México", "Estados Unidos", "Canadá",
    # Most traditional powers / likely qualifiers (alphabetical for the dropdown)
    "Alemania", "Arabia Saudita", "Argelia", "Argentina", "Australia",
    "Austria", "Bélgica", "Bolivia", "Brasil", "Camerún", "Catar",
    "Chile", "Colombia", "Corea del Sur", "Costa de Marfil", "Costa Rica",
    "Croacia", "Dinamarca", "Ecuador", "Egipto", "El Salvador",
    "Escocia", "Eslovaquia", "España", "Francia", "Gales", "Ghana",
    "Grecia", "Guatemala", "Honduras", "Hungría", "Inglaterra",
    "Irak", "Irán", "Irlanda", "Israel", "Italia", "Jamaica", "Japón",
    "Marruecos", "Nigeria", "Noruega", "Países Bajos", "Panamá",
    "Paraguay", "Perú", "Polonia", "Portugal", "República Checa",
    "República Dominicana", "Senegal", "Serbia", "Sudáfrica", "Suecia",
    "Suiza", "Trinidad y Tobago", "Túnez", "Turquía", "Ucrania",
    "Uruguay", "Uzbekistán", "Venezuela",
]

# Placeholder group draw for World Cup 2026 (editable by admin later).
# 12 groups of 4 teams. Reflects strong nations + the 3 hosts as #1 seeds.
WORLD_CUP_2026_GROUPS = {
    "A": ["México", "Polonia", "Arabia Saudita", "Ecuador"],
    "B": ["Estados Unidos", "Países Bajos", "Australia", "Costa Rica"],
    "C": ["Canadá", "Croacia", "Marruecos", "Bélgica"],
    "D": ["Argentina", "Senegal", "Irlanda", "Honduras"],
    "E": ["España", "Inglaterra", "Ghana", "Catar"],
    "F": ["Francia", "Uruguay", "Camerún", "Trinidad y Tobago"],
    "G": ["Brasil", "Suiza", "Serbia", "Panamá"],
    "H": ["Portugal", "Corea del Sur", "Egipto", "Jamaica"],
    "I": ["Alemania", "Japón", "Túnez", "Guatemala"],
    "J": ["Italia", "Colombia", "Nigeria", "El Salvador"],
    "K": ["Países Bajos" if False else "Dinamarca", "Perú", "Argelia", "Paraguay"],
    "L": ["Chile", "Sudáfrica", "Irán", "Venezuela"],
}

# Popular forwards likely to be Pichichi candidates in 2026.
WORLD_CUP_2026_PICHICHI_CANDIDATES = [
    "Lionel Messi (Argentina)",
    "Kylian Mbappé (Francia)",
    "Erling Haaland (Noruega) — si clasifica",
    "Harry Kane (Inglaterra)",
    "Cristiano Ronaldo (Portugal)",
    "Vinícius Júnior (Brasil)",
    "Rodrygo (Brasil)",
    "Lautaro Martínez (Argentina)",
    "Julián Álvarez (Argentina)",
    "Santiago Giménez (México)",
    "Raúl Jiménez (México)",
    "Hirving Lozano (México)",
    "Luis Suárez (Uruguay)",
    "Darwin Núñez (Uruguay)",
    "Jhon Durán (Colombia)",
    "Luis Díaz (Colombia)",
    "James Rodríguez (Colombia)",
    "Otro (escribe en comentario)",
]


class BracketQuickPicks(BaseModel):
    champion: str = ""
    runner_up: str = ""
    semi_final_3: str = ""  # other semifinalist (any order)
    semi_final_4: str = ""
    top_scorer: str = ""
    final_score_home: Optional[int] = None
    final_score_away: Optional[int] = None
    mexico_to_quarters: Optional[bool] = None
    favorite_mx_player: str = ""


class BracketProPicks(BaseModel):
    # Group positions: {"A": ["Mexico", "USA", "Canada", "Italy"], ...} ordered 1st→4th
    group_positions: dict = Field(default_factory=dict)
    # The 8 best 3rd-place teams user thinks will advance to R32
    best_thirds: List[str] = Field(default_factory=list)
    # Winners advancing from each round
    r32_winners: List[str] = Field(default_factory=list)  # 16 teams
    r16_winners: List[str] = Field(default_factory=list)  # 8 teams
    qf_winners: List[str] = Field(default_factory=list)   # 4 teams (= semifinalists)
    sf_winners: List[str] = Field(default_factory=list)   # 2 teams (= finalists)
    third_place_winner: str = ""                          # winner of 3rd-place match
    # Legacy/simplified fields (kept for backwards compat with simpler form)
    group_winners: dict = Field(default_factory=dict)
    round_of_16: List[str] = Field(default_factory=list)
    quarter_finalists: List[str] = Field(default_factory=list)
    third_place: str = ""


class BracketSubmitIn(BaseModel):
    mode: str = "quick"  # "quick" | "pro"
    name: str
    city: str
    email: EmailStr
    whatsapp: Optional[str] = ""
    picks_quick: BracketQuickPicks
    picks_pro: Optional[BracketProPicks] = None
    accept_rules: bool = False


class BracketOfficialResults(BaseModel):
    champion: str = ""
    runner_up: str = ""
    semi_finalists: List[str] = Field(default_factory=list)
    top_scorer: str = ""
    final_score_home: Optional[int] = None
    final_score_away: Optional[int] = None
    mexico_to_quarters: Optional[bool] = None
    # Pro mode — full bracket
    group_positions: dict = Field(default_factory=dict)
    best_thirds: List[str] = Field(default_factory=list)
    r32_winners: List[str] = Field(default_factory=list)
    r16_winners: List[str] = Field(default_factory=list)
    qf_winners: List[str] = Field(default_factory=list)
    sf_winners: List[str] = Field(default_factory=list)
    third_place_winner: str = ""
    # Legacy fields
    group_winners: dict = Field(default_factory=dict)
    round_of_16: List[str] = Field(default_factory=list)
    quarter_finalists: List[str] = Field(default_factory=list)
    third_place: str = ""


class BracketSettingsIn(BaseModel):
    sponsor_advertiser_id: Optional[str] = ""
    sponsor_name: Optional[str] = ""
    prize_description: Optional[str] = ""
    contest_status: Optional[str] = "open"  # open | locked | closed
    winner_prediction_id: Optional[str] = ""


def _norm(s: str) -> str:
    """Normalize string for comparison (lowercase, strip accents)."""
    import unicodedata
    if not s:
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFKD", s.lower().strip())
        if not unicodedata.combining(c)
    )


def _score_prediction(pred: dict, results: dict) -> int:
    """Compute total score for one prediction given the official results dict.
    Both `pred` and `results` are plain dicts as stored in Mongo."""
    score = 0
    pq = (pred.get("picks_quick") or {})
    rq = results or {}

    # ----- Quick Pick scoring -----
    if pq.get("champion") and _norm(pq["champion"]) == _norm(rq.get("champion")):
        score += 25
    if pq.get("runner_up") and _norm(pq["runner_up"]) == _norm(rq.get("runner_up")):
        score += 15

    # other 2 semifinalists (any order, ignoring champ + runner up if accidentally listed there)
    real_semis = {_norm(x) for x in (rq.get("semi_finalists") or []) if x}
    my_semis = {_norm(x) for x in [pq.get("semi_final_3"), pq.get("semi_final_4")] if x}
    score += 10 * len(real_semis & my_semis)

    if pq.get("top_scorer") and _norm(pq["top_scorer"]) == _norm(rq.get("top_scorer")):
        score += 15

    # Final score
    rs_h, rs_a = rq.get("final_score_home"), rq.get("final_score_away")
    ps_h, ps_a = pq.get("final_score_home"), pq.get("final_score_away")
    if rs_h is not None and rs_a is not None and ps_h is not None and ps_a is not None:
        if rs_h == ps_h and rs_a == ps_a:
            score += 20
        else:
            # Correct winner side (without exact score)
            rs_winner = "home" if rs_h > rs_a else "away" if rs_a > rs_h else "draw"
            ps_winner = "home" if ps_h > ps_a else "away" if ps_a > ps_h else "draw"
            if rs_winner == ps_winner:
                score += 5

    # México to quarters
    if pq.get("mexico_to_quarters") is not None and rq.get("mexico_to_quarters") is not None:
        if bool(pq["mexico_to_quarters"]) == bool(rq["mexico_to_quarters"]):
            score += 5

    # ----- Pro mode bonus -----
    if pred.get("mode") == "pro":
        pp = (pred.get("picks_pro") or {})

        # Group positions: +2 for 1st, +1 for 2nd, +1 for 3rd in each group
        for gid, my_positions in (pp.get("group_positions") or {}).items():
            real_positions = (rq.get("group_positions") or {}).get(gid, [])
            if real_positions and my_positions:
                if len(my_positions) > 0 and len(real_positions) > 0:
                    if _norm(my_positions[0]) == _norm(real_positions[0]):
                        score += 2
                if len(my_positions) > 1 and len(real_positions) > 1:
                    if _norm(my_positions[1]) == _norm(real_positions[1]):
                        score += 1
                if len(my_positions) > 2 and len(real_positions) > 2:
                    if _norm(my_positions[2]) == _norm(real_positions[2]):
                        score += 1

        # Best 8 thirds: +2 each correct
        real_thirds = {_norm(x) for x in (rq.get("best_thirds") or []) if x}
        my_thirds = {_norm(x) for x in (pp.get("best_thirds") or []) if x}
        score += 2 * len(real_thirds & my_thirds)

        # R32 winners: +2 each
        real_r32 = {_norm(x) for x in (rq.get("r32_winners") or []) if x}
        my_r32 = {_norm(x) for x in (pp.get("r32_winners") or []) if x}
        score += 2 * len(real_r32 & my_r32)

        # R16 winners: +3 each
        real_r16 = {_norm(x) for x in (rq.get("r16_winners") or []) if x}
        my_r16 = {_norm(x) for x in (pp.get("r16_winners") or []) if x}
        score += 3 * len(real_r16 & my_r16)

        # QF winners (semifinalists): +5 each
        real_qf = {_norm(x) for x in (rq.get("qf_winners") or []) if x}
        my_qf = {_norm(x) for x in (pp.get("qf_winners") or []) if x}
        score += 5 * len(real_qf & my_qf)

        # SF winners (finalists): +8 each
        real_sf = {_norm(x) for x in (rq.get("sf_winners") or []) if x}
        my_sf = {_norm(x) for x in (pp.get("sf_winners") or []) if x}
        score += 8 * len(real_sf & my_sf)

        # 3rd place match winner: +5
        if pp.get("third_place_winner") and rq.get("third_place_winner"):
            if _norm(pp["third_place_winner"]) == _norm(rq["third_place_winner"]):
                score += 5

        # Legacy fields backward-compat
        for gid, pick_team in (pp.get("group_winners") or {}).items():
            real = (rq.get("group_winners") or {}).get(gid)
            if real and _norm(real) == _norm(pick_team):
                score += 1
        real_l_r16 = {_norm(x) for x in (rq.get("round_of_16") or []) if x}
        my_l_r16 = {_norm(x) for x in (pp.get("round_of_16") or []) if x}
        score += 2 * len(real_l_r16 & my_l_r16)
        real_l_qf = {_norm(x) for x in (rq.get("quarter_finalists") or []) if x}
        my_l_qf = {_norm(x) for x in (pp.get("quarter_finalists") or []) if x}
        score += 3 * len(real_l_qf & my_l_qf)

    return score


async def _get_bracket_results() -> dict:
    doc = await db.bracket_results.find_one({"id": "official_results"}, {"_id": 0})
    return doc or {}


async def _get_bracket_settings() -> dict:
    doc = await db.bracket_settings.find_one({"id": "bracket_settings"}, {"_id": 0})
    if not doc:
        doc = {
            "id": "bracket_settings",
            "sponsor_advertiser_id": "",
            "sponsor_name": "",
            "prize_description": "Premio sorpresa cortesía de La Campeona 880 AM",
            "contest_status": "open",
            "winner_prediction_id": "",
            "updated_at": now_iso(),
        }
        await db.bracket_settings.insert_one(doc.copy())
    return {k: v for k, v in doc.items() if k != "_id"}


# ---- Public endpoints ----

@api.get("/bracket/meta")
async def bracket_meta():
    """Returns the static reference data needed to build the public form."""
    # Allow admin to override the group config via bracket_settings
    settings = await _get_bracket_settings()
    groups = settings.get("groups_override") or WORLD_CUP_2026_GROUPS
    return {
        "teams": WORLD_CUP_2026_TEAMS,
        "pichichi_candidates": WORLD_CUP_2026_PICHICHI_CANDIDATES,
        "group_ids": list("ABCDEFGHIJKL"),
        "groups": groups,
    }


@api.get("/bracket/settings")
async def bracket_settings_public():
    s = await _get_bracket_settings()
    # Expose sponsor data even if linked to advertiser
    if s.get("sponsor_advertiser_id"):
        adv = await db.advertisers.find_one({"id": s["sponsor_advertiser_id"]}, {"_id": 0})
        if adv:
            s["sponsor"] = strip_private(adv)
    return s


@api.post("/bracket/submit")
async def bracket_submit(payload: BracketSubmitIn, request: Request):
    if not payload.accept_rules:
        raise HTTPException(status_code=400, detail="Debes aceptar las reglas.")

    settings = await _get_bracket_settings()
    if settings.get("contest_status") != "open":
        raise HTTPException(status_code=403, detail="La quiniela ya está cerrada.")

    # Rate-limit: one prediction per email (overwrite if same email submits again).
    email_norm = payload.email.lower().strip()
    existing = await db.bracket_predictions.find_one({"email": email_norm}, {"_id": 0})

    now = now_iso()
    edit_token = uuid.uuid4().hex
    ip_hash = ""
    try:
        ip = request.client.host if request.client else ""
        import hashlib
        ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:16] if ip else ""
    except Exception:
        pass

    doc = {
        "id": existing["id"] if existing else str(uuid.uuid4()),
        "mode": payload.mode if payload.mode in ("quick", "pro") else "quick",
        "name": payload.name.strip()[:80],
        "city": payload.city.strip()[:60],
        "email": email_norm,
        "whatsapp": (payload.whatsapp or "").strip()[:30],
        "picks_quick": payload.picks_quick.model_dump(),
        "picks_pro": payload.picks_pro.model_dump() if payload.picks_pro else None,
        "score": 0,
        "ip_hash": ip_hash,
        "edit_token": existing.get("edit_token") if existing else edit_token,
        "created_at": existing.get("created_at") if existing else now,
        "updated_at": now,
    }

    # Re-score against current official results (likely 0 if not started)
    results = await _get_bracket_results()
    doc["score"] = _score_prediction(doc, results)

    if existing:
        await db.bracket_predictions.update_one({"id": existing["id"]}, {"$set": doc})
    else:
        await db.bracket_predictions.insert_one(doc.copy())

    return {
        "id": doc["id"],
        "edit_token": doc["edit_token"],
        "mode": doc["mode"],
        "score": doc["score"],
    }


@api.get("/bracket/leaderboard")
async def bracket_leaderboard(limit: int = 100):
    cap = min(max(limit, 1), 500)
    # Sort by score desc, then created_at asc (first-come tiebreaker)
    cursor = db.bracket_predictions.find(
        {},
        {"_id": 0, "id": 1, "name": 1, "city": 1, "mode": 1, "score": 1, "created_at": 1},
    ).sort([("score", -1), ("created_at", 1)]).limit(cap)
    rows = await cursor.to_list(cap)
    return {"total": await db.bracket_predictions.count_documents({}), "rows": rows}


@api.get("/bracket/me")
async def bracket_me(token: str):
    if not token:
        raise HTTPException(status_code=400, detail="Token requerido")
    doc = await db.bracket_predictions.find_one({"edit_token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="No encontrado")
    return doc


@api.get("/bracket/view/{prediction_id}")
async def bracket_view_public(prediction_id: str):
    """Public read-only view of a prediction (for sharing on social media).
    Strips private fields (email, whatsapp, edit_token)."""
    doc = await db.bracket_predictions.find_one({"id": prediction_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="No encontrado")
    for private in ("email", "whatsapp", "edit_token", "ip_hash"):
        doc.pop(private, None)
    return doc


# ---- Social share: Open Graph preview (image + meta tags) ----

def _og_font(size: int, bold: bool = True):
    """Load a sans-serif TTF, trying common Debian/RHEL paths, then falling back
    to Pillow's bundled scalable default (works on any OS, incl. AlmaLinux)."""
    from PIL import ImageFont
    candidates = (
        [
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/usr/share/fonts/liberation-sans/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf",
        ] if bold else
        [
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/usr/share/fonts/liberation-sans/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf",
        ]
    )
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    try:
        return ImageFont.load_default(size=size)  # Pillow >=10: scalable
    except Exception:
        return ImageFont.load_default()


def _render_bracket_og(name: str, city: str, champion: str, runner_up: str) -> bytes:
    """Render a 1200x630 social-share card showing the user's picked champion."""
    import io as _io
    from PIL import Image, ImageDraw

    W, H = 1200, 630
    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img)

    # vertical gradient (deep maroon -> red)
    c1, c2 = (63, 10, 10), (153, 29, 29)
    for y in range(H):
        t = y / H
        col = (
            int(c1[0] + (c2[0] - c1[0]) * t),
            int(c1[1] + (c2[1] - c1[1]) * t),
            int(c1[2] + (c2[2] - c1[2]) * t),
        )
        draw.line([(0, y), (W, y)], fill=col)

    amber = (252, 211, 77)
    white = (255, 255, 255)
    dark = (30, 18, 18)

    def center(text, y, font, fill):
        w = draw.textlength(text, font=font)
        draw.text(((W - w) / 2, y), text, font=font, fill=fill)

    # header
    center("QUINIELA MUNDIAL 2026", 64, _og_font(46), amber)
    draw.line([(360, 130), (840, 130)], fill=amber, width=3)

    # champion
    center("CAMPEON", 175, _og_font(34), amber)
    champ = (champion or "?").upper()
    csize = 130
    f = _og_font(csize)
    while draw.textlength(champ, font=f) > (W - 140) and csize > 44:
        csize -= 6
        f = _og_font(csize)
    center(champ, 218, f, white)

    if runner_up:
        center(f"vs {runner_up}", 218 + csize + 20, _og_font(34), (255, 255, 255))

    # who made it
    who = f"El bracket de {name}"
    if city:
        who += f"  ·  {city}"
    center(who, 460, _og_font(36), white)

    # bottom call-to-action band
    draw.rectangle([(0, H - 78), (W, H)], fill=amber)
    center("Haz tu bracket gratis en La Campeona 880 AM", H - 60, _og_font(36, bold=True), dark)

    buf = _io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _public_base(request: Request) -> str:
    """Best public base URL for absolute share links. Prefers an explicit
    PUBLIC_BASE_URL env (set in production), then proxy-forwarded host headers,
    then the request Host. Avoids leaking internal cluster hostnames."""
    env_base = os.environ.get("PUBLIC_BASE_URL")
    if env_base:
        return env_base.rstrip("/")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or (request.url.hostname or "")
    host = host.split(",")[0].strip()
    proto = (request.headers.get("x-forwarded-proto") or "https").split(",")[0].strip()
    return f"{proto}://{host}"


@api.get("/bracket/og-image/{prediction_id}.png")
async def bracket_og_image(prediction_id: str):
    doc = await db.bracket_predictions.find_one({"id": prediction_id}, {"_id": 0}) or {}
    pq = doc.get("picks_quick") or {}
    png = _render_bracket_og(
        doc.get("name") or "Un fan",
        doc.get("city") or "",
        pq.get("champion") or "?",
        pq.get("runner_up") or "",
    )
    return Response(content=png, media_type="image/png",
                    headers={"Cache-Control": "public, max-age=86400"})


@api.get("/bracket/og/{prediction_id}")
async def bracket_og(prediction_id: str, request: Request):
    """HTML page with Open Graph tags for social sharing. Social crawlers
    (Facebook/WhatsApp/Twitter…) get the rich preview tags WITHOUT any
    redirect, so they read the bracket title + champion image. Real humans
    are redirected to the interactive bracket view."""
    import html as _html
    base = _public_base(request)
    view_url = f"{base}/quiniela/ver/{prediction_id}"
    og_url = f"{base}/api/bracket/og/{prediction_id}"
    ua = (request.headers.get("user-agent") or "").lower()
    is_crawler = any(b in ua for b in (
        "facebookexternalhit", "facebot", "twitterbot", "whatsapp", "slackbot",
        "telegrambot", "linkedinbot", "pinterest", "discordbot", "embedly",
        "redditbot", "googlebot", "bingbot", "vkshare", "skypeuripreview",
    ))
    doc = await db.bracket_predictions.find_one({"id": prediction_id}, {"_id": 0})
    if not doc:
        return RedirectResponse(view_url)
    pq = doc.get("picks_quick") or {}
    name = doc.get("name") or "Un fan"
    champ = pq.get("champion") or "?"
    title = f"El Bracket del Mundial 2026 de {name}"
    desc = (f"{name} ya armo su quiniela del Mundial 2026 (Campeon: {champ}) en La Campeona "
            f"880 AM. Haz el tuyo gratis y reta a tus amigos!")
    img = f"{base}/api/bracket/og-image/{prediction_id}.png"
    e = _html.escape
    # Only auto-redirect HUMANS; crawlers must stay on this page to read the tags.
    redirect_bits = "" if is_crawler else (
        f"<meta http-equiv=\"refresh\" content=\"0; url={e(view_url)}\">"
        f"<script>window.location.replace({_html.escape(repr(view_url))});</script>"
    )
    html_page = (
        "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        f"<title>{e(title)}</title>"
        "<meta property=\"og:type\" content=\"website\">"
        "<meta property=\"og:site_name\" content=\"La Campeona 880 AM\">"
        f"<meta property=\"og:title\" content=\"{e(title)}\">"
        f"<meta property=\"og:description\" content=\"{e(desc)}\">"
        f"<meta property=\"og:image\" content=\"{e(img)}\">"
        "<meta property=\"og:image:width\" content=\"1200\">"
        "<meta property=\"og:image:height\" content=\"630\">"
        "<meta property=\"og:image:type\" content=\"image/png\">"
        f"<meta property=\"og:url\" content=\"{e(og_url)}\">"
        "<meta name=\"twitter:card\" content=\"summary_large_image\">"
        f"<meta name=\"twitter:title\" content=\"{e(title)}\">"
        f"<meta name=\"twitter:description\" content=\"{e(desc)}\">"
        f"<meta name=\"twitter:image\" content=\"{e(img)}\">"
        f"{redirect_bits}"
        f"</head><body style=\"font-family:sans-serif;text-align:center;padding:40px\">"
        f"<p>Redirigiendo… <a href=\"{e(view_url)}\">Ver el bracket</a></p>"
        "</body></html>"
    )
    return HTMLResponse(content=html_page)


# ---- Admin endpoints ----

@api.get("/bracket/admin/predictions")
async def bracket_admin_list(user: dict = Depends(get_admin)):
    cursor = db.bracket_predictions.find({}, {"_id": 0}).sort("score", -1)
    rows = await cursor.to_list(2000)
    return rows


@api.get("/bracket/admin/results")
async def bracket_admin_get_results(user: dict = Depends(get_admin)):
    return await _get_bracket_results()


@api.put("/bracket/admin/results")
async def bracket_admin_set_results(payload: BracketOfficialResults, user: dict = Depends(get_admin)):
    now = now_iso()
    doc = payload.model_dump()
    doc["id"] = "official_results"
    doc["updated_at"] = now
    await db.bracket_results.update_one({"id": "official_results"}, {"$set": doc}, upsert=True)
    # Recalculate every prediction's score
    await _recalculate_all_scores()
    return {"ok": True, "results": doc}


async def _recalculate_all_scores():
    results = await _get_bracket_results()
    async for pred in db.bracket_predictions.find({}, {"_id": 0}):
        new_score = _score_prediction(pred, results)
        if new_score != pred.get("score"):
            await db.bracket_predictions.update_one(
                {"id": pred["id"]}, {"$set": {"score": new_score}}
            )


@api.put("/bracket/admin/settings")
async def bracket_admin_set_settings(payload: BracketSettingsIn, user: dict = Depends(get_admin)):
    now = now_iso()
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = now
    await db.bracket_settings.update_one(
        {"id": "bracket_settings"}, {"$set": update}, upsert=True
    )
    return await _get_bracket_settings()


# ---------------------- Seeding ---------------------- #
async def seed_admin():
    email = os.environ.get("ADMIN_EMAIL", "admin@radiolatina.fm").lower()
    pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": email,
            "password_hash": hash_password(pw),
            "name": "Admin",
            "role": "admin",
            "created_at": now_iso(),
        })
        logger.info(f"Seeded admin: {email}")
    elif not verify_password(pw, existing.get("password_hash", "")):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(pw)}})
        logger.info(f"Updated admin password: {email}")


async def seed_super_admin():
    """Seed the platform super admin (the station owner)."""
    email = os.environ.get("SUPER_ADMIN_EMAIL", "").lower().strip()
    pw = os.environ.get("SUPER_ADMIN_PASSWORD", "")
    if not email or not pw:
        return
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": email,
            "password_hash": hash_password(pw),
            "name": "Super Admin",
            "role": "super_admin",
            "host_slug": "",
            "created_at": now_iso(),
        })
        logger.info(f"Seeded super admin: {email}")
    else:
        update = {}
        if existing.get("role") != "super_admin":
            update["role"] = "super_admin"
        if not verify_password(pw, existing.get("password_hash", "")):
            update["password_hash"] = hash_password(pw)
        if update:
            await db.users.update_one({"email": email}, {"$set": update})
            logger.info(f"Updated super admin: {email}")


async def seed_demo_dj():
    """Seed a demo DJ account linked to the first host (DJ Carlos Ramírez)."""
    email = os.environ.get("DJ_EMAIL", "dj@radiolatina.fm").lower()
    pw = os.environ.get("DJ_PASSWORD", "dj123")
    host = await db.hosts.find_one({}, {"_id": 0, "slug": 1, "name": 1}, sort=[("created_at", 1)])
    host_slug = host["slug"] if host else ""
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": email,
            "password_hash": hash_password(pw),
            "name": (host or {}).get("name") or "DJ Demo",
            "role": "dj",
            "host_slug": host_slug,
            "created_at": now_iso(),
        })
        logger.info(f"Seeded demo DJ: {email} -> {host_slug}")
    else:
        update = {}
        if not verify_password(pw, existing.get("password_hash", "")):
            update["password_hash"] = hash_password(pw)
        if not existing.get("host_slug") and host_slug:
            update["host_slug"] = host_slug
        if existing.get("role") != "dj":
            update["role"] = "dj"
        if update:
            await db.users.update_one({"email": email}, {"$set": update})
            logger.info(f"Updated demo DJ: {email}")

DEMO_ADVERTISERS = [
    {
        "name": "El Sabor Latino",
        "tagline": "Auténtica cocina mexicana",
        "description": "Restaurante familiar con recetas tradicionales de México. Tacos, sopes, quesadillas y más, hechos con ingredientes frescos cada día.",
        "special_offer": "20% OFF en tu primera orden — menciona la radio",
        "cta_text": "Order Now",
        "phone": "+13105550199",
        "whatsapp": "13105550199",
        "address": "1234 Sunset Blvd, Los Angeles, CA",
        "maps_url": "https://maps.google.com/?q=1234+Sunset+Blvd+Los+Angeles+CA",
        "website_url": "",
        "banner_path": "https://images.pexels.com/photos/31822998/pexels-photo-31822998.jpeg",
        "color": "#EA580C",
        "schedule": [{"day_of_week": d, "start_time": "12:00", "end_time": "14:00"} for d in range(0, 5)],
    },
    {
        "name": "Café Aroma",
        "tagline": "El mejor café latino de la ciudad",
        "description": "Café de especialidad de Colombia y Costa Rica. Pastelería casera, ambiente acogedor, Wi-Fi gratis.",
        "special_offer": "Compra un café, llévate una concha gratis",
        "cta_text": "Visit Us",
        "phone": "+13105550150",
        "whatsapp": "13105550150",
        "address": "5678 Olvera St, Los Angeles, CA",
        "maps_url": "https://maps.google.com/?q=Olvera+Street+Los+Angeles",
        "website_url": "",
        "banner_path": "https://images.pexels.com/photos/32351724/pexels-photo-32351724.jpeg",
        "color": "#B45309",
        "schedule": [{"day_of_week": d, "start_time": "07:00", "end_time": "10:00"} for d in range(0, 7)],
    },
]

async def seed_demo_advertisers():
    count = await db.advertisers.count_documents({})
    if count == 0:
        for a in DEMO_ADVERTISERS:
            doc = {
                **a,
                "id": str(uuid.uuid4()),
                "slug": slugify(a["name"]),
                "created_at": now_iso(),
            }
            await db.advertisers.insert_one(doc.copy())
        logger.info("Seeded demo advertisers")


DEMO_HOSTS = [
    {
        "name": "DJ Carlos Ramírez",
        "show_name": "La Mañanera",
        "tagline": "Despierta con la mejor música",
        "bio": "Todas las mañanas con los éxitos regionales, noticias locales y mucho sabor. Pide tu canción al WhatsApp.",
        "photo_path": "https://images.pexels.com/photos/9519555/pexels-photo-9519555.jpeg",
        "phone": "+15036230244",
        "whatsapp": "15036230244",
        "facebook": "https://www.facebook.com/lacampeona.laquemanda",
        "instagram": "",
        "color": "#7F1D1D",
        "schedule": [{"day_of_week": d, "start_time": "06:00", "end_time": "11:00"} for d in range(0, 6)],
    },
    {
        "name": "DJ Lupita Flores",
        "show_name": "La Hora del Sabor",
        "tagline": "Corridos, banda y la mejor bohemia",
        "bio": "Lupita te acompaña en las tardes con lo mejor del regional mexicano, dedicatorias y saludos para toda la comunidad.",
        "photo_path": "https://images.pexels.com/photos/6953875/pexels-photo-6953875.jpeg",
        "phone": "+15036230244",
        "whatsapp": "15036230244",
        "facebook": "https://www.facebook.com/lacampeona.laquemanda",
        "instagram": "",
        "color": "#991B1B",
        "schedule": [{"day_of_week": d, "start_time": "11:00", "end_time": "16:00"} for d in range(0, 7)],
    },
    {
        "name": "DJ El Compa Beto",
        "show_name": "Noches de Rumba",
        "tagline": "La fiesta no para",
        "bio": "Las mejores cumbias, rancheras y éxitos de la noche. Dedica una canción a esa persona especial.",
        "photo_path": "https://images.pexels.com/photos/7502575/pexels-photo-7502575.jpeg",
        "phone": "+15036230244",
        "whatsapp": "15036230244",
        "facebook": "https://www.facebook.com/lacampeona.laquemanda",
        "instagram": "",
        "color": "#450A0A",
        "schedule": [{"day_of_week": d, "start_time": "16:00", "end_time": "22:00"} for d in range(0, 7)],
    },
]


async def seed_demo_hosts():
    count = await db.hosts.count_documents({})
    if count == 0:
        for h in DEMO_HOSTS:
            doc = {
                **h,
                "id": str(uuid.uuid4()),
                "slug": slugify(h["name"]),
                "created_at": now_iso(),
            }
            await db.hosts.insert_one(doc.copy())
        logger.info("Seeded demo hosts")

# ---------------------- App lifecycle ---------------------- #
async def backfill_report_tokens():
    """Assign report_token to existing advertisers/events that don't have one."""
    async for adv in db.advertisers.find({"$or": [{"report_token": {"$exists": False}}, {"report_token": ""}]}, {"_id": 0, "id": 1}):
        await db.advertisers.update_one(
            {"id": adv["id"]}, {"$set": {"report_token": uuid.uuid4().hex}}
        )
    async for ev in db.events.find({"$or": [{"report_token": {"$exists": False}}, {"report_token": ""}]}, {"_id": 0, "id": 1}):
        await db.events.update_one(
            {"id": ev["id"]}, {"$set": {"report_token": uuid.uuid4().hex}}
        )


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.advertisers.create_index("slug", unique=True)
    await db.advertisers.create_index("id", unique=True)
    await db.advertisers.create_index("report_token")
    await db.hosts.create_index("slug", unique=True)
    await db.hosts.create_index("id", unique=True)
    await db.events.create_index("slug", unique=True)
    await db.events.create_index("id", unique=True)
    await db.events.create_index("event_date")
    await db.events.create_index("report_token")
    await db.cta_events.create_index([("created_at", 1)])
    await db.cta_events.create_index([("entity_id", 1), ("created_at", 1)])
    await db.cta_events.create_index([("kind", 1)])
    await db.settings.create_index("id", unique=True)
    await db.content_drafts.create_index("id", unique=True)
    await db.content_drafts.create_index([("host_slug", 1), ("created_at", -1)])
    await seed_admin()
    await seed_super_admin()
    await seed_demo_advertisers()
    await seed_demo_hosts()
    await seed_demo_dj()
    await backfill_report_tokens()
    await get_settings_doc()
    init_storage()

@app.on_event("shutdown")
async def on_shutdown():
    client.close()

# Mount router and CORS
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
