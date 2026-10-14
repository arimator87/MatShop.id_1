from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Query
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict
from pathlib import Path
from datetime import datetime, timezone, timedelta
import os
import uuid
import logging
import requests
import re

from seed import seed
from invoice import build_invoice
import custom_projects
import reviews

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

app = FastAPI(title="MatShop.id API")
api = APIRouter(prefix="/api")
logger = logging.getLogger("matshop")
logging.basicConfig(level=logging.INFO)

ROLES = ["contractor_buyer", "supplier_vendor", "designer_creator"]
CATEGORIES = {
    "material": {"plywood": "Plywood / Multiplek", "hpl": "HPL", "spc": "SPC Flooring", "marmer": "Marmer / Granit",
                 "wallpanel": "WallPanel WPC/PVC", "lis": "Lis Profil", "furniture": "Loose Furniture"},
    "service": {"arsitektur": "Desain Arsitektur", "interior3d": "Desain Interior 3D Render",
                "ded": "Gambar Kerja (DED)", "rab": "RAB Proyek"},
    "asset": {"skp": "SketchUp .skp", "d5": "D5 Render", "fbx": "FBX", "texture": "Textures / Materials"},
}
TABS = {
    "all": {"type": "material"},
    "plywood": {"category": {"$in": ["plywood", "hpl"]}},
    "spc": {"category": {"$in": ["spc", "marmer"]}},
    "wallpanel": {"category": {"$in": ["wallpanel", "lis"]}},
    "services": {"type": "service"},
    "assets": {"type": "asset"},
}
SHIP_METHODS = {"pickup": "Ambil Mandiri di Gudang Vendor", "vendor_cargo": "Pengiriman Kargo/Armada Vendor"}
SERVICE_FEE = 2500
AUTO_RELEASE_DAYS = 7
CARGO_BASE_FEE = 50000
ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}
TRACK_STAGES = {"loading": "Muat Barang di Gudang", "departed": "Armada Berangkat dari Gudang",
                "in_transit": "Dalam Perjalanan", "arrived": "Tiba di Lokasi Proyek"}
PPN_RATE = 0.11
TYPE_ROLE = {"material": "supplier_vendor", "service": "designer_creator", "asset": "designer_creator"}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------- Storage ----------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "matshop"
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path, data, content_type):
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": init_storage(), "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path):
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage()}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------- Models ----------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = ""
    primary_role: Optional[str] = None
    enabled_roles: List[str] = []
    active_role: Optional[str] = None
    is_admin: bool = False
    verification_status: Optional[str] = None
    suspended: bool = False
    suspended_reason: Optional[str] = None
    verification_note: Optional[str] = None
    business_profile: Optional[dict] = None
    tax_profile: Optional[Dict[str, str]] = None


class Tier(BaseModel):
    min_qty: int = Field(gt=1)
    price: float = Field(gt=0)


class ListingIn(BaseModel):
    type: str
    category: str
    title: str = Field(min_length=3)
    description: str = ""
    price: float = Field(gt=0)
    unit: str = "lembar"
    stock: Optional[int] = None
    tiers: List[Tier] = []
    images: List[str] = []
    specs: Dict[str, str] = {}
    delivery_days: Optional[int] = None
    revisions: Optional[int] = None
    file_url: Optional[str] = None
    file_format: Optional[str] = None
    file_size: Optional[str] = None
    shipping_fee_per_unit: Optional[float] = Field(default=None, ge=0)
    warehouse_location: Optional[str] = None


class RoleIn(BaseModel):
    role: str


class CartItemIn(BaseModel):
    listing_id: str
    qty: int = Field(default=1, ge=1)


class QtyIn(BaseModel):
    qty: int = Field(ge=1)


class CheckoutIn(BaseModel):
    recipient: str = Field(min_length=2)
    phone: str = Field(min_length=6)
    address: str = Field(min_length=5)
    notes: str = ""
    shipping: Dict[str, str] = {}
    tax_info: Optional["TaxInfo"] = None


class ShipIn(BaseModel):
    note: str = Field(min_length=2)
    deliverable_url: Optional[str] = None


class DisputeIn(BaseModel):
    reason: str = Field(min_length=5)
    evidence: List[str] = Field(default=[], max_length=6)


class BusinessProfileIn(BaseModel):
    business_name: str = Field(min_length=2)
    address: str = Field(min_length=5)
    portfolio_url: str = Field(min_length=5)
    photos: List[str] = Field(min_length=1, max_length=10)
    pic_name: str = Field(min_length=2)
    pic_phone: str = Field(min_length=6)
    city: str = ""
    work_types: List[str] = []


class VerifyIn(BaseModel):
    status: str
    note: str = ""


class ResolveIn(BaseModel):
    decision: str
    note: str = Field(min_length=5)


class TrackingIn(BaseModel):
    stage: str
    location: str = ""
    note: str = ""


class TaxInfo(BaseModel):
    company_name: str = Field(min_length=2)
    npwp: str
    company_address: str = Field(min_length=5)

    @field_validator("npwp")
    @classmethod
    def check_npwp(cls, v):
        digits = re.sub(r"\D", "", v)
        if len(digits) not in (15, 16):
            raise ValueError("NPWP harus 15 atau 16 digit")
        return digits


CheckoutIn.model_rebuild()


class SessionIn(BaseModel):
    session_id: str


# ---------- Auth helpers ----------
async def get_user(request: Request) -> User:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Belum login")
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "Sesi tidak valid")
    exp = sess["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(401, "Sesi kedaluwarsa")
    doc = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(401, "User tidak ditemukan")
    return User(**doc)


def set_cookie(response: Response, token: str):
    response.set_cookie("session_token", token, httponly=True, secure=True, samesite="none",
                        path="/", max_age=7 * 24 * 3600)


async def create_session(user_id: str, token: Optional[str] = None):
    token = token or f"sess_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({"user_id": user_id, "session_token": token,
                                       "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                                       "created_at": now_iso()})
    return token


@api.post("/auth/session")
async def auth_session(body: SessionIn, response: Response):
    r = await run_in_threadpool(lambda: requests.get(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": body.session_id}, timeout=20))
    if r.status_code != 200:
        raise HTTPException(401, "Session Google tidak valid")
    data = r.json()
    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": data["name"], "picture": data.get("picture", "")}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({"user_id": user_id, "email": data["email"], "name": data["name"],
                                   "picture": data.get("picture", ""), "primary_role": None,
                                   "enabled_roles": [], "active_role": None, "created_at": now_iso()})
    if data["email"].lower() in ADMIN_EMAILS:
        await db.users.update_one({"user_id": user_id}, {"$set": {"is_admin": True}})
    await create_session(user_id, data["session_token"])
    set_cookie(response, data["session_token"])
    return User(**await db.users.find_one({"user_id": user_id}, {"_id": 0}))


@api.post("/auth/demo")
async def auth_demo(body: RoleIn, response: Response):
    if os.environ.get("DEMO_LOGIN_ENABLED") != "true":
        raise HTTPException(403, "Demo login dinonaktifkan")
    ids = {"contractor_buyer": "user_demo_buyer", "supplier_vendor": "user_demo_supplier",
           "designer_creator": "user_demo_designer", "admin": "user_demo_admin"}
    if body.role not in ids:
        raise HTTPException(400, "Role tidak valid")
    token = await create_session(ids[body.role])
    set_cookie(response, token)
    if body.role != "admin":
        await db.users.update_one({"user_id": ids[body.role]}, {"$set": {"active_role": body.role}})
    return {"user": User(**await db.users.find_one({"user_id": ids[body.role]}, {"_id": 0})), "token": token}


@api.get("/auth/me")
async def auth_me(request: Request):
    return await get_user(request)


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
    return {"ok": True}


@api.post("/users/onboarding")
async def onboarding(body: RoleIn, request: Request):
    user = await get_user(request)
    if body.role not in ROLES:
        raise HTTPException(400, "Role tidak valid")
    roles = list(dict.fromkeys([body.role, "contractor_buyer", *user.enabled_roles]))
    await db.users.update_one({"user_id": user.user_id},
                              {"$set": {"primary_role": body.role, "enabled_roles": roles, "active_role": body.role}})
    return User(**await db.users.find_one({"user_id": user.user_id}, {"_id": 0}))


@api.post("/users/roles/switch")
async def switch_role(body: RoleIn, request: Request):
    user = await get_user(request)
    if body.role not in ROLES:
        raise HTTPException(400, "Role tidak valid")
    await db.users.update_one({"user_id": user.user_id},
                              {"$set": {"active_role": body.role}, "$addToSet": {"enabled_roles": body.role}})
    return User(**await db.users.find_one({"user_id": user.user_id}, {"_id": 0}))


# ---------- Listings ----------
def unit_price(listing: dict, qty: int) -> float:
    price = listing["price"]
    for t in sorted(listing.get("tiers", []), key=lambda t: t["min_qty"]):
        if qty >= t["min_qty"]:
            price = t["price"]
    return price


def public(listing: dict, include_file=False) -> dict:
    d = dict(listing)
    if not include_file:
        d.pop("file_url", None)
    d["category_label"] = CATEGORIES.get(d["type"], {}).get(d["category"], d["category"])
    return d


@api.get("/meta/categories")
async def categories():
    return CATEGORIES


@api.get("/listings")
async def list_listings(tab: Optional[str] = None, type: Optional[str] = None, category: Optional[str] = None,
                        q: Optional[str] = None, sort: str = "popular", limit: int = Query(48, le=100),
                        owner: Optional[str] = None):
    flt = {"is_active": True}
    if owner:
        flt["owner_id"] = owner
    if tab in TABS:
        flt.update(TABS[tab])
    if type:
        flt["type"] = type
    if category:
        flt["category"] = category
    if q:
        flt["title"] = {"$regex": q, "$options": "i"}
    sort_key = {"popular": ("sold", -1), "newest": ("created_at", -1), "price_asc": ("price", 1),
                "price_desc": ("price", -1)}.get(sort, ("sold", -1))
    docs = await db.listings.find(flt, {"_id": 0}).sort(*sort_key).to_list(limit)
    return [public(d) for d in docs]


@api.get("/listings/{listing_id}")
async def get_listing(listing_id: str):
    d = await db.listings.find_one({"listing_id": listing_id, "is_active": True}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Produk tidak ditemukan")
    return public(d)


def validate_listing(body: ListingIn, user: User):
    if body.type not in CATEGORIES or body.category not in CATEGORIES[body.type]:
        raise HTTPException(400, "Tipe/kategori tidak valid")
    if TYPE_ROLE[body.type] not in user.enabled_roles:
        raise HTTPException(403, "Role Anda tidak diizinkan membuat listing ini")
    if body.type == "asset" and not body.file_url:
        raise HTTPException(400, "Link file aset wajib diisi")
    for t in body.tiers:
        if t.price >= body.price:
            raise HTTPException(400, "Harga grosir harus lebih murah dari harga eceran")


@api.get("/my/listings")
async def my_listings(request: Request):
    user = await get_user(request)
    docs = await db.listings.find({"owner_id": user.user_id, "is_active": True}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [public(d, include_file=True) for d in docs]


@api.post("/listings")
async def create_listing(body: ListingIn, request: Request):
    user = await get_user(request)
    validate_listing(body, user)
    doc = {**body.model_dump(), "listing_id": f"lst_{uuid.uuid4().hex[:12]}", "owner_id": user.user_id,
           "owner_name": user.name, "rating": 0, "sold": 0, "is_active": True, "created_at": now_iso()}
    if body.type != "material":
        doc["tiers"] = []
        doc["stock"] = None
    await db.listings.insert_one(doc)
    doc.pop("_id", None)
    return public(doc, include_file=True)


@api.put("/listings/{listing_id}")
async def update_listing(listing_id: str, body: ListingIn, request: Request):
    user = await get_user(request)
    validate_listing(body, user)
    res = await db.listings.update_one({"listing_id": listing_id, "owner_id": user.user_id, "is_active": True},
                                       {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Listing tidak ditemukan")
    return public(await db.listings.find_one({"listing_id": listing_id}, {"_id": 0}), include_file=True)


@api.delete("/listings/{listing_id}")
async def delete_listing(listing_id: str, request: Request):
    user = await get_user(request)
    res = await db.listings.update_one({"listing_id": listing_id, "owner_id": user.user_id},
                                       {"$set": {"is_active": False}})
    if res.matched_count == 0:
        raise HTTPException(404, "Listing tidak ditemukan")
    return {"ok": True}


# ---------- Uploads ----------
ALLOWED_IMG = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


@api.post("/uploads")
async def upload(request: Request, file: UploadFile = File(...)):
    user = await get_user(request)
    if file.content_type not in ALLOWED_IMG:
        raise HTTPException(400, "Hanya JPG/PNG/WEBP")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Maksimal 8MB")
    path = f"{APP_NAME}/uploads/{user.user_id}/{uuid.uuid4()}.{ALLOWED_IMG[file.content_type]}"
    result = await run_in_threadpool(put_object, path, data, file.content_type)
    await db.files.insert_one({"id": str(uuid.uuid4()), "storage_path": result["path"], "owner_id": user.user_id,
                               "original_filename": file.filename, "content_type": file.content_type,
                               "size": result.get("size"), "is_deleted": False, "created_at": now_iso()})
    return {"path": result["path"], "url": f"/api/files/{result['path']}"}


@api.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(404, "File tidak ditemukan")
    data, ct = await run_in_threadpool(get_object, path)
    return Response(content=data, media_type=record.get("content_type", ct),
                    headers={"Cache-Control": "public, max-age=86400"})


# ---------- Cart ----------
async def build_cart(user_id: str):
    cart = await db.carts.find_one({"user_id": user_id}, {"_id": 0}) or {"items": []}
    ids = [i["listing_id"] for i in cart["items"]]
    listings = {d["listing_id"]: d for d in await db.listings.find(
        {"listing_id": {"$in": ids}, "is_active": True}, {"_id": 0}).to_list(500)}
    items, total, savings = [], 0, 0
    for i in cart["items"]:
        lst = listings.get(i["listing_id"])
        if not lst:
            continue
        up = unit_price(lst, i["qty"])
        sub = up * i["qty"]
        save = (lst["price"] - up) * i["qty"]
        items.append({"listing": public(lst), "qty": i["qty"], "unit_price": up, "subtotal": sub,
                      "savings": save, "is_wholesale": up < lst["price"]})
        total += sub
        savings += save
    return {"items": items, "total": total, "savings": savings, "count": sum(i["qty"] for i in items),
            "lines": len(items)}


@api.get("/cart")
async def get_cart(request: Request):
    user = await get_user(request)
    return await build_cart(user.user_id)


@api.post("/cart/items")
async def add_cart(body: CartItemIn, request: Request):
    user = await get_user(request)
    lst = await db.listings.find_one({"listing_id": body.listing_id, "is_active": True}, {"_id": 0})
    if not lst:
        raise HTTPException(404, "Produk tidak ditemukan")
    if lst["owner_id"] == user.user_id:
        raise HTTPException(400, "Tidak bisa membeli listing milik sendiri")
    cart = await db.carts.find_one({"user_id": user.user_id}, {"_id": 0}) or {"items": []}
    items = cart["items"]
    found = next((i for i in items if i["listing_id"] == body.listing_id), None)
    if found:
        found["qty"] = 1 if lst["type"] != "material" else found["qty"] + body.qty
    else:
        items.append({"listing_id": body.listing_id, "qty": body.qty if lst["type"] == "material" else 1})
    await db.carts.update_one({"user_id": user.user_id}, {"$set": {"items": items}}, upsert=True)
    return await build_cart(user.user_id)


@api.put("/cart/items/{listing_id}")
async def update_cart(listing_id: str, body: QtyIn, request: Request):
    user = await get_user(request)
    lst = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    qty = body.qty if lst and lst["type"] == "material" else 1
    await db.carts.update_one({"user_id": user.user_id, "items.listing_id": listing_id},
                              {"$set": {"items.$.qty": qty}})
    return await build_cart(user.user_id)


@api.delete("/cart/items/{listing_id}")
async def remove_cart(listing_id: str, request: Request):
    user = await get_user(request)
    await db.carts.update_one({"user_id": user.user_id}, {"$pull": {"items": {"listing_id": listing_id}}})
    return await build_cart(user.user_id)


# ---------- Checkout & Escrow (MOCK payment) ----------
def event(status, note):
    return {"status": status, "note": note, "at": now_iso()}


def shipping_estimate(cart_items) -> float:
    return CARGO_BASE_FEE + sum((i["listing"].get("shipping_fee_per_unit") or 0) * i["qty"] for i in cart_items)


@api.get("/meta/shipping")
async def shipping_meta():
    return {"methods": SHIP_METHODS, "cargo_base_fee": CARGO_BASE_FEE, "service_fee": SERVICE_FEE,
            "auto_release_days": AUTO_RELEASE_DAYS}


@api.post("/checkout")
async def checkout(body: CheckoutIn, request: Request):
    user = await get_user(request)
    cart = await build_cart(user.user_id)
    if not cart["items"]:
        raise HTTPException(400, "Keranjang kosong")
    for it in cart["items"]:
        lst = it["listing"]
        if lst["type"] == "material" and lst.get("stock") is not None and it["qty"] > lst["stock"]:
            raise HTTPException(400, f"Stok {lst['title']} tidak cukup")
    groups = {}
    for it in cart["items"]:
        groups.setdefault(it["listing"]["owner_id"], []).append(it)
    payment_id = f"pay_{uuid.uuid4().hex[:10]}"
    orders = []
    for seller_id, its in groups.items():
        items = [{"listing_id": i["listing"]["listing_id"], "title": i["listing"]["title"], "type": i["listing"]["type"],
                  "image": (i["listing"].get("images") or [""])[0], "unit": i["listing"]["unit"], "qty": i["qty"],
                  "retail_price": i["listing"]["price"], "unit_price": i["unit_price"], "subtotal": i["subtotal"],
                  "is_wholesale": i["is_wholesale"]}
                 for i in its]
        mats = [i for i in its if i["listing"]["type"] == "material"]
        method, ship_cost, warehouse = None, 0, None
        if mats:
            method = body.shipping.get(seller_id, "vendor_cargo")
            if method not in SHIP_METHODS:
                raise HTTPException(400, "Metode pengiriman tidak valid")
            warehouse = mats[0]["listing"].get("warehouse_location")
            if method == "vendor_cargo":
                ship_cost = shipping_estimate(mats)
        items_total = sum(i["subtotal"] for i in items)
        orders.append({
            "order_id": f"MS-{uuid.uuid4().hex[:8].upper()}", "payment_id": payment_id,
            "buyer_id": user.user_id, "buyer_name": user.name, "seller_id": seller_id,
            "seller_name": its[0]["listing"]["owner_name"], "items": items, "items_total": items_total,
            "shipping_method": method, "shipping_cost": ship_cost, "warehouse_location": warehouse,
            "service_fee": SERVICE_FEE, "total": items_total + ship_cost, "status": "awaiting_payment",
            "shipping": body.model_dump(exclude={"shipping", "tax_info"}),
            "tax_info": body.tax_info.model_dump() if body.tax_info else None,
            "timeline": [event("awaiting_payment", "Pesanan dibuat, menunggu pembayaran")],
            "created_at": now_iso(),
        })
    await db.orders.insert_many(orders)
    if body.tax_info:
        await db.users.update_one({"user_id": user.user_id}, {"$set": {"tax_profile": body.tax_info.model_dump()}})
    await db.carts.update_one({"user_id": user.user_id}, {"$set": {"items": []}})
    fees = SERVICE_FEE * len(orders)
    grand = sum(o["total"] for o in orders) + fees
    await db.payments.insert_one({"payment_id": payment_id, "buyer_id": user.user_id, "amount": grand,
                                  "service_fee": fees, "status": "pending", "created_at": now_iso()})
    return {"payment_id": payment_id, "amount": grand, "service_fee": fees,
            "orders": [o["order_id"] for o in orders]}


@api.get("/payments/{payment_id}")
async def get_payment(payment_id: str, request: Request):
    user = await get_user(request)
    p = await db.payments.find_one({"payment_id": payment_id, "buyer_id": user.user_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Pembayaran tidak ditemukan")
    return p


@api.post("/payments/{payment_id}/pay")
async def pay(payment_id: str, request: Request):
    user = await get_user(request)
    p = await db.payments.find_one({"payment_id": payment_id, "buyer_id": user.user_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Pembayaran tidak ditemukan")
    if p["status"] == "paid":
        return p
    async for o in db.orders.find({"payment_id": payment_id}, {"_id": 0}):
        timeline = [event("held", "Pembayaran diterima. Dana ditahan sistem escrow MatShop (ESCROW_HELD)")]
        sets = {"status": "held", "paid_at": now_iso()}
        if all(i["type"] == "asset" for i in o["items"]):
            sets.update(status="shipped", shipped_at=now_iso(), auto_release_at=auto_release_time())
            timeline.append(event("shipped", "Preview aset tersedia. File asli terbuka setelah COMPLETED"))
        for i in o["items"]:
            inc = {"sold": i["qty"]}
            if i["type"] == "material":
                inc["stock"] = -i["qty"]
            await db.listings.update_one({"listing_id": i["listing_id"]}, {"$inc": inc})
        await db.orders.update_one({"order_id": o["order_id"]}, {"$set": sets,
                                                                 "$push": {"timeline": {"$each": timeline}}})
    await db.payments.update_one({"payment_id": payment_id}, {"$set": {"status": "paid", "paid_at": now_iso()}})
    return {**p, "status": "paid"}


def auto_release_time():
    return (datetime.now(timezone.utc) + timedelta(days=AUTO_RELEASE_DAYS)).isoformat()


async def run_auto_release(flt: dict):
    # Disputed orders are excluded: funds stay held until mediation finishes.
    await db.orders.update_many(
        {**flt, "status": "shipped", "auto_release_at": {"$lte": now_iso()}},
        {"$set": {"status": "released", "released_at": now_iso()},
         "$push": {"timeline": event("released", f"Dana dirilis otomatis setelah {AUTO_RELEASE_DAYS} hari tanpa komplain")}})


def for_viewer(o: dict, user_id: str) -> dict:
    if o["buyer_id"] == user_id and o["status"] != "released":
        o.pop("deliverable_url", None)
    return o


async def find_order(order_id: str, user: User) -> dict:
    flt = {"order_id": order_id}
    if not user.is_admin:
        flt["$or"] = [{"buyer_id": user.user_id}, {"seller_id": user.user_id}]
    await run_auto_release(flt)
    o = await db.orders.find_one(flt, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    return o


@api.get("/orders")
async def list_orders(request: Request, role: str = "buyer"):
    user = await get_user(request)
    key = "seller_id" if role == "seller" else "buyer_id"
    await run_auto_release({key: user.user_id})
    docs = await db.orders.find({key: user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [for_viewer(o, user.user_id) for o in docs]


@api.get("/orders/{order_id}")
async def get_order(order_id: str, request: Request):
    user = await get_user(request)
    return for_viewer(await find_order(order_id, user), user.user_id)


@api.get("/orders/{order_id}/invoice.pdf")
async def invoice_pdf(order_id: str, request: Request):
    user = await get_user(request)
    o = await find_order(order_id, user)
    if o["status"] == "awaiting_payment":
        raise HTTPException(400, "Invoice tersedia setelah pembayaran")
    seller = await db.users.find_one({"user_id": o["seller_id"]}, {"_id": 0}) or {}
    pdf = await run_in_threadpool(build_invoice, o, seller)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="INV-{order_id}.pdf"'})


@api.post("/orders/{order_id}/ship")
async def ship_order(order_id: str, body: ShipIn, request: Request):
    user = await get_user(request)
    o = await db.orders.find_one({"order_id": order_id, "seller_id": user.user_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if o["status"] != "held":
        raise HTTPException(400, "Pesanan tidak dalam status ESCROW_HELD")
    sets = {"status": "shipped", "seller_note": body.note, "shipped_at": now_iso(), "auto_release_at": auto_release_time()}
    if o.get("shipping_method") == "vendor_cargo":
        sets["tracking"] = [{"stage": "loading", "label": TRACK_STAGES["loading"], "location": o.get("warehouse_location") or "Gudang vendor", "note": "", "at": o.get("paid_at") or now_iso()},
                            {"stage": "departed", "label": TRACK_STAGES["departed"], "location": o.get("warehouse_location") or "Gudang vendor", "note": body.note, "at": now_iso()}]
    if body.deliverable_url:
        sets["deliverable_url"] = body.deliverable_url
    await db.orders.update_one({"order_id": order_id}, {"$set": sets, "$push": {"timeline": event("shipped", body.note)}})
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


@api.post("/orders/{order_id}/release")
async def release_order(order_id: str, request: Request):
    user = await get_user(request)
    o = await db.orders.find_one({"order_id": order_id, "buyer_id": user.user_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if o["status"] == "disputed":
        raise HTTPException(400, "Pesanan dalam mediasi (DISPUTE). Dana tetap ditahan")
    if o["status"] != "shipped":
        raise HTTPException(400, "Pesanan belum dikirim/diserahkan")
    await db.orders.update_one({"order_id": order_id}, {"$set": {"status": "released", "released_at": now_iso()},
                                                        "$push": {"timeline": event("released", "Buyer konfirmasi. Dana dirilis ke penjual (COMPLETED)")}})
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


@api.post("/orders/{order_id}/dispute")
async def open_dispute(order_id: str, body: DisputeIn, request: Request):
    user = await get_user(request)
    o = await db.orders.find_one({"order_id": order_id, "buyer_id": user.user_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if o["status"] not in ("held", "shipped"):
        raise HTTPException(400, "Komplain hanya untuk transaksi dengan dana ditahan escrow")
    await db.orders.update_one({"order_id": order_id}, {
        "$set": {"status": "disputed", "pre_dispute_status": o["status"],
                 "dispute": {"reason": body.reason, "evidence": body.evidence, "opened_at": now_iso(), "status": "open"}},
        "$push": {"timeline": event("disputed", f"Komplain diajukan: {body.reason}. Pencairan dana ditahan hingga mediasi selesai")}})
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


@api.post("/orders/{order_id}/dispute/cancel")
async def cancel_dispute(order_id: str, request: Request):
    user = await get_user(request)
    o = await db.orders.find_one({"order_id": order_id, "buyer_id": user.user_id}, {"_id": 0})
    if not o or o["status"] != "disputed":
        raise HTTPException(400, "Tidak ada komplain aktif")
    back = o.get("pre_dispute_status", "held")
    sets = {"status": back, "dispute.status": "withdrawn", "dispute.closed_at": now_iso()}
    if back == "shipped":
        sets["auto_release_at"] = auto_release_time()
    await db.orders.update_one({"order_id": order_id}, {"$set": sets,
                                                        "$push": {"timeline": event(back, "Komplain dibatalkan buyer, transaksi dilanjutkan")}})
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


@api.get("/orders/{order_id}/download/{listing_id}")
async def download_asset(order_id: str, listing_id: str, request: Request):
    user = await get_user(request)
    o = await db.orders.find_one({"order_id": order_id, "buyer_id": user.user_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if o["status"] != "released":
        raise HTTPException(403, "File asli hanya bisa diunduh setelah transaksi COMPLETED")
    if not any(i["listing_id"] == listing_id and i["type"] == "asset" for i in o["items"]):
        raise HTTPException(404, "Aset tidak ada di pesanan ini")
    lst = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    return {"file_url": lst.get("file_url"), "title": lst["title"], "file_format": lst.get("file_format")}


@api.post("/orders/{order_id}/tracking")
async def add_tracking(order_id: str, body: TrackingIn, request: Request):
    user = await get_user(request)
    o = await db.orders.find_one({"order_id": order_id, "seller_id": user.user_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if o.get("shipping_method") != "vendor_cargo" or o["status"] != "shipped":
        raise HTTPException(400, "Pelacakan hanya untuk pesanan kargo vendor yang sedang dikirim")
    order = list(TRACK_STAGES)
    if body.stage not in TRACK_STAGES:
        raise HTTPException(400, "Tahap pengiriman tidak valid")
    last = (o.get("tracking") or [{"stage": "loading"}])[-1]["stage"]
    if order.index(body.stage) <= order.index(last) and body.stage != "in_transit":
        raise HTTPException(400, "Tahap harus maju dari posisi terakhir")
    if last == "arrived":
        raise HTTPException(400, "Armada sudah tiba di lokasi proyek")
    location = body.location or (o["shipping"].get("address") if body.stage == "arrived" else "")
    entry = {"stage": body.stage, "label": TRACK_STAGES[body.stage], "location": location, "note": body.note, "at": now_iso()}
    await db.orders.update_one({"order_id": order_id}, {"$push": {"tracking": entry}})
    if body.stage == "arrived":
        await db.orders.update_one({"order_id": order_id}, {"$push": {"timeline": event("shipped", "Armada tiba di lokasi proyek. Silakan cek & konfirmasi")}})
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


# ---------- Tax (NPWP) ----------
@api.put("/users/tax-profile")
async def save_tax_profile(body: TaxInfo, request: Request):
    user = await get_user(request)
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"tax_profile": body.model_dump()}})
    return User(**await db.users.find_one({"user_id": user.user_id}, {"_id": 0}))


@api.put("/orders/{order_id}/tax-info")
async def set_order_tax(order_id: str, body: TaxInfo, request: Request):
    user = await get_user(request)
    res = await db.orders.update_one({"order_id": order_id, "buyer_id": user.user_id},
                                     {"$set": {"tax_info": body.model_dump()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"tax_profile": body.model_dump()}})
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


# ---------- Admin mediation ----------
async def require_admin(request: Request) -> User:
    user = await get_user(request)
    if not user.is_admin:
        raise HTTPException(403, "Khusus admin MatShop")
    return user


@api.get("/admin/disputes")
async def admin_disputes(request: Request, state: str = "open"):
    await require_admin(request)
    flt = {"dispute": {"$exists": True}}
    if state == "open":
        flt["status"] = "disputed"
    elif state == "resolved":
        flt["dispute.status"] = "resolved"
    return await db.orders.find(flt, {"_id": 0}).sort("dispute.opened_at", -1).to_list(500)


@api.get("/admin/stats")
async def admin_stats(request: Request):
    await require_admin(request)
    disputed = await db.orders.find({"status": "disputed"}, {"_id": 0, "total": 1}).to_list(1000)
    return {
        "open": len(disputed), "frozen_amount": sum(o["total"] for o in disputed),
        "refunded": await db.orders.count_documents({"dispute.decision": "refund_buyer"}),
        "released": await db.orders.count_documents({"dispute.decision": "release_vendor"}),
    }


@api.post("/admin/orders/{order_id}/resolve")
async def admin_resolve(order_id: str, body: ResolveIn, request: Request):
    admin = await require_admin(request)
    if body.decision not in ("refund_buyer", "release_vendor"):
        raise HTTPException(400, "Keputusan tidak valid")
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o or o["status"] != "disputed":
        raise HTTPException(400, "Pesanan tidak dalam status DISPUTE")
    refund = body.decision == "refund_buyer"
    status = "refunded" if refund else "released"
    note = (f"Mediasi selesai: dana {o['total'] + o.get('service_fee', 0):,.0f} dikembalikan ke buyer (MOCK refund)" if refund
            else "Mediasi selesai: dana dirilis ke penjual") + f". Catatan admin: {body.note}"
    sets = {"status": status, "dispute.status": "resolved", "dispute.decision": body.decision,
            "dispute.admin_note": body.note, "dispute.resolved_at": now_iso(), "dispute.resolved_by": admin.name}
    sets["refunded_at" if refund else "released_at"] = now_iso()
    await db.orders.update_one({"order_id": order_id}, {"$set": sets, "$push": {"timeline": event(status, note)}})
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


@api.get("/seller/stats")
async def seller_stats(request: Request):
    user = await get_user(request)
    await run_auto_release({"seller_id": user.user_id})
    orders = await db.orders.find({"seller_id": user.user_id}, {"_id": 0}).to_list(1000)
    held = sum(o["total"] for o in orders if o["status"] in ("held", "shipped", "disputed"))
    released = sum(o["total"] for o in orders if o["status"] == "released")
    listings = await db.listings.count_documents({"owner_id": user.user_id, "is_active": True})
    return {"held": held, "released": released, "orders": len([o for o in orders if o["status"] != "awaiting_payment"]),
            "pending_action": len([o for o in orders if o["status"] == "held"]),
            "disputed": len([o for o in orders if o["status"] == "disputed"]), "listings": listings}


# ---------- Vendor verification ----------
VERIFY_STATUSES = ("PENDING", "VERIFIED", "REJECTED")


@api.put("/users/business-profile")
async def save_business_profile(body: BusinessProfileIn, request: Request):
    user = await get_user(request)
    await db.users.update_one({"user_id": user.user_id}, {"$set": {
        "business_profile": {**body.model_dump(), "submitted_at": now_iso()},
        "verification_status": "PENDING", "verification_note": None}})
    return User(**await db.users.find_one({"user_id": user.user_id}, {"_id": 0}))


@api.get("/admin/vendors")
async def admin_vendors(request: Request, status: str = "PENDING"):
    await require_admin(request)
    flt = {"business_profile": {"$ne": None}}
    if status in VERIFY_STATUSES:
        flt["verification_status"] = status
    docs = await db.users.find(flt, {"_id": 0}).sort("business_profile.submitted_at", -1).to_list(500)
    return [User(**d) for d in docs]


@api.post("/admin/vendors/{user_id}/verify")
async def admin_verify_vendor(user_id: str, body: VerifyIn, request: Request):
    admin = await require_admin(request)
    if body.status not in ("VERIFIED", "REJECTED"):
        raise HTTPException(400, "Status tidak valid")
    if body.status == "REJECTED" and len(body.note.strip()) < 5:
        raise HTTPException(400, "Alasan penolakan wajib diisi")
    res = await db.users.update_one({"user_id": user_id, "business_profile": {"$ne": None}}, {"$set": {
        "verification_status": body.status, "verification_note": body.note or None,
        "verified_by": admin.name, "verified_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Vendor tidak ditemukan")
    ok = body.status == "VERIFIED"
    await custom_projects.notify(user_id, "Profil usaha terverifikasi" if ok else "Verifikasi profil ditolak",
                                 "Anda kini bisa mengajukan penawaran di Project Board." if ok else f"Alasan: {body.note}. Perbarui profil lalu kirim ulang.",
                                 "/dashboard?tab=profil")
    return User(**await db.users.find_one({"user_id": user_id}, {"_id": 0}))


@api.get("/admin/suspended-users")
async def admin_suspended(request: Request):
    await require_admin(request)
    return [User(**d) for d in await db.users.find({"suspended": True}, {"_id": 0}).to_list(500)]


@api.post("/admin/users/{user_id}/unsuspend")
async def admin_unsuspend(user_id: str, request: Request):
    await require_admin(request)
    res = await db.users.update_one({"user_id": user_id}, {"$set": {"suspended": False, "suspended_reason": None}})
    if res.matched_count == 0:
        raise HTTPException(404, "User tidak ditemukan")
    await custom_projects.notify(user_id, "Akun diaktifkan kembali", "Pembekuan akun Anda telah dicabut tim MatShop.id.", "/dashboard")
    return {"ok": True}


@api.get("/notifications")
async def list_notifications(request: Request):
    user = await get_user(request)
    items = await db.notifications.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(30)
    return {"items": items, "unread": await db.notifications.count_documents({"user_id": user.user_id, "read": False})}


@api.post("/notifications/read-all")
async def read_notifications(request: Request):
    user = await get_user(request)
    await db.notifications.update_many({"user_id": user.user_id, "read": False}, {"$set": {"read": True}})
    return {"ok": True}


@api.get("/")
async def root():
    return {"message": "MatShop.id API"}


app.include_router(api)
custom_projects.ctx.update(db=db, get_user=get_user)
app.include_router(custom_projects.router)
reviews.ctx.update(db=db, get_user=get_user, notify=custom_projects.notify)
app.include_router(reviews.router)
app.add_middleware(CORSMiddleware, allow_credentials=True,
                   allow_origin_regex=".*", allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await seed(db)
    await db.listings.create_index("listing_id", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.orders.create_index("order_id", unique=True)
    await db.reviews.create_index([("source", 1), ("ref_id", 1)], unique=True)
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
