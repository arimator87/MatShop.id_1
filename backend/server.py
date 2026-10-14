from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Query
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from pathlib import Path
from datetime import datetime, timezone, timedelta
import os
import uuid
import logging
import requests

from seed import seed

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


class ShipIn(BaseModel):
    note: str = Field(min_length=2)


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
    await create_session(user_id, data["session_token"])
    set_cookie(response, data["session_token"])
    return User(**await db.users.find_one({"user_id": user_id}, {"_id": 0}))


@api.post("/auth/demo")
async def auth_demo(body: RoleIn, response: Response):
    if os.environ.get("DEMO_LOGIN_ENABLED") != "true":
        raise HTTPException(403, "Demo login dinonaktifkan")
    ids = {"contractor_buyer": "user_demo_buyer", "supplier_vendor": "user_demo_supplier",
           "designer_creator": "user_demo_designer"}
    if body.role not in ids:
        raise HTTPException(400, "Role tidak valid")
    token = await create_session(ids[body.role])
    set_cookie(response, token)
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
                        q: Optional[str] = None, sort: str = "popular", limit: int = Query(48, le=100)):
    flt = {"is_active": True}
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
    service_fee = 2500
    orders = []
    for seller_id, its in groups.items():
        items = [{"listing_id": i["listing"]["listing_id"], "title": i["listing"]["title"], "type": i["listing"]["type"],
                  "image": (i["listing"].get("images") or [""])[0], "unit": i["listing"]["unit"], "qty": i["qty"],
                  "unit_price": i["unit_price"], "subtotal": i["subtotal"], "is_wholesale": i["is_wholesale"]}
                 for i in its]
        orders.append({
            "order_id": f"MS-{uuid.uuid4().hex[:8].upper()}", "payment_id": payment_id,
            "buyer_id": user.user_id, "buyer_name": user.name, "seller_id": seller_id,
            "seller_name": its[0]["listing"]["owner_name"], "items": items,
            "total": sum(i["subtotal"] for i in items), "status": "awaiting_payment",
            "shipping": body.model_dump(), "timeline": [event("awaiting_payment", "Pesanan dibuat, menunggu pembayaran")],
            "created_at": now_iso(),
        })
    await db.orders.insert_many(orders)
    await db.carts.update_one({"user_id": user.user_id}, {"$set": {"items": []}})
    grand = sum(o["total"] for o in orders) + service_fee
    await db.payments.insert_one({"payment_id": payment_id, "buyer_id": user.user_id, "amount": grand,
                                  "service_fee": service_fee, "status": "pending", "created_at": now_iso()})
    return {"payment_id": payment_id, "amount": grand, "service_fee": service_fee,
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
        timeline = [event("held", "Pembayaran diterima. Dana ditahan sistem escrow MatShop")]
        status = "held"
        if all(i["type"] == "asset" for i in o["items"]):
            status = "shipped"
            timeline.append(event("shipped", "File aset digital tersedia untuk diunduh"))
        for i in o["items"]:
            inc = {"sold": i["qty"]}
            if i["type"] == "material":
                inc["stock"] = -i["qty"]
            await db.listings.update_one({"listing_id": i["listing_id"]}, {"$inc": inc})
        await db.orders.update_one({"order_id": o["order_id"]}, {"$set": {"status": status, "paid_at": now_iso()},
                                                                 "$push": {"timeline": {"$each": timeline}}})
    await db.payments.update_one({"payment_id": payment_id}, {"$set": {"status": "paid", "paid_at": now_iso()}})
    return {**p, "status": "paid"}


@api.get("/orders")
async def list_orders(request: Request, role: str = "buyer"):
    user = await get_user(request)
    key = "seller_id" if role == "seller" else "buyer_id"
    return await db.orders.find({key: user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/orders/{order_id}/ship")
async def ship_order(order_id: str, body: ShipIn, request: Request):
    user = await get_user(request)
    o = await db.orders.find_one({"order_id": order_id, "seller_id": user.user_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if o["status"] != "held":
        raise HTTPException(400, "Pesanan tidak dalam status dana ditahan")
    await db.orders.update_one({"order_id": order_id}, {"$set": {"status": "shipped", "seller_note": body.note},
                                                        "$push": {"timeline": event("shipped", body.note)}})
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


@api.post("/orders/{order_id}/release")
async def release_order(order_id: str, request: Request):
    user = await get_user(request)
    o = await db.orders.find_one({"order_id": order_id, "buyer_id": user.user_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if o["status"] != "shipped":
        raise HTTPException(400, "Pesanan belum dikirim/diserahkan")
    await db.orders.update_one({"order_id": order_id}, {"$set": {"status": "released", "released_at": now_iso()},
                                                        "$push": {"timeline": event("released", "Buyer konfirmasi. Dana dirilis ke penjual")}})
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


@api.get("/orders/{order_id}/download/{listing_id}")
async def download_asset(order_id: str, listing_id: str, request: Request):
    user = await get_user(request)
    o = await db.orders.find_one({"order_id": order_id, "buyer_id": user.user_id}, {"_id": 0})
    if not o or o["status"] == "awaiting_payment":
        raise HTTPException(403, "Pesanan belum dibayar")
    if not any(i["listing_id"] == listing_id and i["type"] == "asset" for i in o["items"]):
        raise HTTPException(404, "Aset tidak ada di pesanan ini")
    lst = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    return {"file_url": lst.get("file_url"), "title": lst["title"], "file_format": lst.get("file_format")}


@api.get("/seller/stats")
async def seller_stats(request: Request):
    user = await get_user(request)
    orders = await db.orders.find({"seller_id": user.user_id}, {"_id": 0}).to_list(1000)
    held = sum(o["total"] for o in orders if o["status"] in ("held", "shipped"))
    released = sum(o["total"] for o in orders if o["status"] == "released")
    listings = await db.listings.count_documents({"owner_id": user.user_id, "is_active": True})
    return {"held": held, "released": released, "orders": len([o for o in orders if o["status"] != "awaiting_payment"]),
            "pending_action": len([o for o in orders if o["status"] == "held"]), "listings": listings}


@api.get("/")
async def root():
    return {"message": "MatShop.id API"}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True,
                   allow_origin_regex=".*", allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await seed(db)
    await db.listings.create_index("listing_id", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.orders.create_index("order_id", unique=True)
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
