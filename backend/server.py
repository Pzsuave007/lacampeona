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
from fastapi.responses import StreamingResponse
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

def slugify(value: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    return re.sub(r"^-|-$", "", s) or str(uuid.uuid4())[:8]

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
    "station_whatsapp": "13105550100",
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
}


def build_dj_system_message(platform: str, station_name: str, host_name: str, variant_tone: str = "") -> str:
    base = (
        f"Eres un copywriter experto en redes sociales para una estación de radio latina "
        f"({station_name}) en Estados Unidos. Hablas como el DJ {host_name}. "
        f"Tu trabajo es generar contenido en ESPAÑOL, pegadizo, breve, con tono coloquial latino, "
        f"optimizado para {platform}. Evita reposts literales — todo debe ser TRANSFORMATIVO y original.\n\n"
        f"DEVUELVE EXACTAMENTE este formato (sin explicaciones extra):\n"
        f"[CAPTION]\n<texto del post, 2-5 líneas, máximo 280 caracteres si es Twitter/X, "
        f"hasta 2200 si es Instagram/Facebook>\n\n"
        f"[HASHTAGS]\n<5-8 hashtags relevantes mezclando español e inglés, separados por espacios, todos comenzando con #>\n\n"
        f"[CTA]\n<una sola línea con una llamada a la acción que dirija al oyente a sintonizar la radio, "
        f"comentar o compartir>"
    )
    tone_extras = {
        "casual": "\n\nTONO ESPECIAL: muy casual y juvenil, como si estuvieras hablando con tus mejores amigos en el grupo de WhatsApp. Usa expresiones cotidianas latinas, tutea, suelta una broma si encaja.",
        "motivational": "\n\nTONO ESPECIAL: motivacional e inspirador. Conecta con sueños, perseverancia, orgullo latino. Que el lector termine sintiendo que puede con el día.",
        "shorter": "\n\nTONO ESPECIAL: ultra-corto y punchy. CAPTION máximo 200 caracteres, ideal para X/Twitter. Una frase que pegue duro, sin relleno.",
        "emotional": "\n\nTONO ESPECIAL: muy emocional, familiar, cercano. Habla de la familia, los recuerdos, la patria. Que provoque guardar el post y compartirlo con un ser querido.",
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


class ContentDraftPatch(BaseModel):
    text: Optional[str] = None
    platform: Optional[str] = None
    title: Optional[str] = None
    status: Optional[str] = None
    scheduled_at: Optional[str] = None


# Per-template ideation prompt used by /api/dj/suggest. Returns 10 ready-to-use
# ideas with prefilled inputs that match the template's fields schema.
SUGGESTION_PROMPTS: dict = {
    "today_in_history": "Hoy es {today}. Dame 10 eventos memorables de la MÚSICA O CULTURA LATINA que pasaron exactamente esta fecha (mismo mes y día) en distintos años. Estrenos de canciones, nacimientos de artistas, premios, hitos. Mezcla salsa, regional mexicano, reggaetón, balada, pop latino.",
    "hot_take": "Dame 10 opiniones picantes pero respetuosas para debatir en redes sobre la música latina ACTUAL. Cada una sobre un tema/artista/género distinto. Para cada idea propón también una postura concreta.",
    "throwback": "Dame 10 canciones LATINAS icónicas perfectas para un Throwback Thursday. Mezcla décadas (80s-2010s) y géneros. Para cada una incluye el año.",
    "poll": "Dame 10 ideas de ENCUESTAS musicales latinas para Instagram/Facebook. Cada idea es una pregunta concreta con 3-4 opciones cortas separadas por coma.",
    "behind_scenes": "Dame 10 momentos AUTÉNTICOS de detrás de cámaras que un DJ de radio latina puede compartir (preparación del show, anécdotas, técnica del estudio, momento gracioso). Concretos, no genéricos.",
    "important_day": "Hoy es {today}. Dame 10 DÍAS IMPORTANTES o efemérides relevantes para la comunidad LATINA en EE.UU. en los próximos 60 días. Días patrios latinoamericanos, días culturales, Hispanic Heritage Month, etc. Indica la fecha en el título.",
    "inspirational_quote": "Dame 10 IDEAS DE TEMAS para frases inspiradoras dirigidas a la comunidad latina trabajadora en EE.UU. (perseverancia, familia, raíces, sueños, segunda generación). Solo el TEMA, no copies frases famosas.",
    "musical_recommendation": "Dame 10 CANCIONES LATINAS recientes (2024-2026) para recomendar al aire. Mezcla géneros y popularidad. Para cada una incluye una razón corta.",
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
        f"Eres asistente de contenido para la radio latina {station_name} (EE.UU., audiencia hispana). "
        f"Genera EXACTAMENTE 10 ideas para la plantilla '{tmpl['label']}'. "
        f"Cada idea debe completar estos campos: {fields_desc}.\n\n"
        f"REGLAS DE SALIDA — IMPORTANTÍSIMO:\n"
        f"- Devuelve SOLAMENTE un JSON válido (un array de 10 objetos).\n"
        f"- NO uses bloques markdown, NO escribas texto antes ni después.\n"
        f"- Cada objeto tiene esta forma exacta:\n"
        f'  {{"title": "título descriptivo corto (max 90 chars)", "inputs": {{ {schema_example} }}}}\n'
        f"- Valores en español. Las ideas deben ser CONCRETAS, no genéricas."
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
    doc = {
        "id": str(uuid.uuid4()),
        "host_slug": dj_host_slug(user),
        "user_id": user["id"],
        **payload.model_dump(),
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
