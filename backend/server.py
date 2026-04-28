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
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
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

class Advertiser(AdvertiserIn):
    id: str
    slug: str
    created_at: str

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
    settings = await get_settings_doc()
    aid = (settings.get("active_advertiser_id") or "").strip()
    if aid and aid != "AUTO":
        adv = await db.advertisers.find_one({"id": aid}, {"_id": 0})
        if adv:
            return adv
    if aid == "AUTO":
        now = await station_now()
        cursor = db.advertisers.find({}, {"_id": 0})
        async for adv in cursor:
            for slot in adv.get("schedule") or []:
                if time_in_slot(now, slot):
                    return adv
    return None


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
        "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]},
        "access_token": token,
    }

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}

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

@api.get("/active")
async def active_advertiser():
    adv = await resolve_active_advertiser()
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

@api.get("/advertisers")
async def list_advertisers():
    cursor = db.advertisers.find({}, {"_id": 0}).sort("created_at", -1)
    items = await cursor.to_list(500)
    return items

@api.get("/advertisers/{slug}")
async def get_advertiser(slug: str):
    adv = await db.advertisers.find_one({"slug": slug}, {"_id": 0})
    if not adv:
        adv = await db.advertisers.find_one({"id": slug}, {"_id": 0})
    if not adv:
        raise HTTPException(status_code=404, detail="Advertiser not found")
    return adv

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
    doc = {**payload.model_dump(), "id": aid, "slug": slug, "created_at": now_iso()}
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
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.advertisers.create_index("slug", unique=True)
    await db.advertisers.create_index("id", unique=True)
    await db.hosts.create_index("slug", unique=True)
    await db.hosts.create_index("id", unique=True)
    await db.settings.create_index("id", unique=True)
    await seed_admin()
    await seed_demo_advertisers()
    await seed_demo_hosts()
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
