import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
import reviews

router = APIRouter(prefix="/api")
ctx = {}
PLACEMENTS = ("home", "catalog")
WIB = timezone(timedelta(hours=7))


def db():
    return ctx["db"]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def today():
    return datetime.now(WIB).date().isoformat()


def live_filter():
    t = today()
    return {"active": True, "$and": [{"$or": [{"start_date": None}, {"start_date": ""}, {"start_date": {"$lte": t}}]},
                                     {"$or": [{"end_date": None}, {"end_date": ""}, {"end_date": {"$gte": t}}]}]}


async def require_admin(request: Request):
    user = await ctx["get_user"](request)
    if not user.is_admin:
        raise HTTPException(403, "Khusus admin MatShop")
    return user


class BannerIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    image: str = Field(min_length=5)
    link_url: str = ""
    active: bool = False
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class AdIn(BaseModel):
    ad_type: str = "brand"
    vendor_id: Optional[str] = None
    title: str = Field(min_length=2, max_length=120)
    advertiser: str = Field(default="", max_length=80)
    image: str = ""
    description: str = Field(default="", max_length=200)
    link_url: str = ""
    contract_value: int = Field(default=0, ge=0)
    paid: bool = False
    payment_note: str = Field(default="", max_length=300)
    cta: str = Field(default="Lihat Promo", max_length=30)
    placements: List[str] = Field(min_length=1)
    active: bool = True
    start_date: Optional[str] = None
    end_date: Optional[str] = None


def check_dates(body):
    if body.start_date and body.end_date and body.start_date > body.end_date:
        raise HTTPException(400, "Tanggal selesai harus setelah tanggal mulai")


# ---------- Pop-up banners ----------
@router.get("/banners/active")
async def active_banner():
    return await db().banners.find_one(live_filter(), {"_id": 0}, sort=[("updated_at", -1)])


@router.get("/admin/banners")
async def admin_banners(request: Request):
    await require_admin(request)
    return await db().banners.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


async def save_banner(banner_id, body):
    check_dates(body)
    if body.active:
        await db().banners.update_many({"banner_id": {"$ne": banner_id}}, {"$set": {"active": False}})
    await db().banners.update_one({"banner_id": banner_id}, {"$set": {**body.model_dump(), "updated_at": now_iso()},
                                                            "$setOnInsert": {"created_at": now_iso()}}, upsert=True)
    return await db().banners.find_one({"banner_id": banner_id}, {"_id": 0})


@router.post("/admin/banners")
async def create_banner(body: BannerIn, request: Request):
    await require_admin(request)
    return await save_banner(f"bnr_{uuid.uuid4().hex[:10]}", body)


@router.put("/admin/banners/{banner_id}")
async def update_banner(banner_id: str, body: BannerIn, request: Request):
    await require_admin(request)
    if not await db().banners.find_one({"banner_id": banner_id}):
        raise HTTPException(404, "Banner tidak ditemukan")
    return await save_banner(banner_id, body)


@router.delete("/admin/banners/{banner_id}")
async def delete_banner(banner_id: str, request: Request):
    await require_admin(request)
    if not (await db().banners.delete_one({"banner_id": banner_id})).deleted_count:
        raise HTTPException(404, "Banner tidak ditemukan")
    return {"ok": True}


# ---------- In-feed sponsored ads ----------
def ad_live_filter():
    return {**live_filter(), "paid": True}


async def notify_live_vendor_ads():
    for a in await db().ads.find({**ad_live_filter(), "ad_type": "vendor", "notified_at": None}, {"_id": 0}).to_list(50):
        await db().ads.update_one({"ad_id": a["ad_id"]}, {"$set": {"notified_at": now_iso()}})
        await ctx["notify"](a["vendor_id"], "Iklan sponsor Anda mulai tayang", f"\"{a['title']}\" kini tampil sebagai Sponsor di katalog MatShop.", f"/vendor/{a['vendor_id']}")


async def sponsored_vendor_ids():
    return set(await db().ads.distinct("vendor_id", {**ad_live_filter(), "ad_type": "vendor"}))


@router.get("/ads")
async def list_ads(placement: str = "catalog"):
    await notify_live_vendor_ads()
    ads = await db().ads.find({**ad_live_filter(), "placements": placement},
                              {"_id": 0, "contract_value": 0, "paid": 0, "payment_note": 0}).sort("created_at", -1).to_list(20)
    vids = [a["vendor_id"] for a in ads if a.get("ad_type") == "vendor"]
    if vids:
        users = {u["user_id"]: u for u in await db().users.find({"user_id": {"$in": vids}}, {"_id": 0}).to_list(50)}
        meta = await reviews.badges(vids)
        for a in ads:
            u = users.get(a.get("vendor_id"))
            if a.get("ad_type") == "vendor" and u and u.get("business_profile"):
                bp = u["business_profile"]
                a["vendor"] = {"user_id": u["user_id"], "business_name": bp["business_name"], "city": reviews.city_of(bp),
                               "primary_role": u.get("primary_role"), **meta[u["user_id"]]}
                a["image"] = a.get("image") or bp["photos"][0]
                a["advertiser"] = bp["business_name"]
    return ads


@router.post("/ads/{ad_id}/click")
async def click_ad(ad_id: str):
    await db().ads.update_one({"ad_id": ad_id}, {"$inc": {"clicks": 1}})
    return {"ok": True}


@router.get("/admin/ads")
async def admin_ads(request: Request):
    await require_admin(request)
    return await db().ads.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


async def ad_doc(body):
    check_dates(body)
    if any(p not in PLACEMENTS for p in body.placements):
        raise HTTPException(400, "Penempatan iklan tidak valid")
    if body.ad_type == "vendor":
        if not body.vendor_id or not await db().users.find_one({**reviews.VENDOR_FILTER, "user_id": body.vendor_id}):
            raise HTTPException(400, "Pilih vendor MatShop terverifikasi")
    elif body.ad_type == "brand":
        if len(body.advertiser.strip()) < 2 or len(body.image) < 5:
            raise HTTPException(400, "Iklan brand wajib nama pengiklan dan gambar")
        body.vendor_id = None
    else:
        raise HTTPException(400, "Jenis iklan tidak valid")
    return {**body.model_dump(), "link_url": body.link_url.strip(), "updated_at": now_iso()}


@router.post("/admin/ads")
async def create_ad(body: AdIn, request: Request):
    await require_admin(request)
    doc = {**await ad_doc(body), "ad_id": f"ad_{uuid.uuid4().hex[:10]}", "clicks": 0, "notified_at": None, "created_at": now_iso()}
    await db().ads.insert_one(dict(doc))
    await notify_live_vendor_ads()
    return doc


@router.put("/admin/ads/{ad_id}")
async def update_ad(ad_id: str, body: AdIn, request: Request):
    await require_admin(request)
    old = await db().ads.find_one({"ad_id": ad_id}, {"_id": 0})
    if not old:
        raise HTTPException(404, "Iklan tidak ditemukan")
    doc = await ad_doc(body)
    if doc["vendor_id"] != old.get("vendor_id"):
        doc["notified_at"] = None
    await db().ads.update_one({"ad_id": ad_id}, {"$set": doc})
    await notify_live_vendor_ads()
    return await db().ads.find_one({"ad_id": ad_id}, {"_id": 0})


@router.delete("/admin/ads/{ad_id}")
async def delete_ad(ad_id: str, request: Request):
    await require_admin(request)
    if not (await db().ads.delete_one({"ad_id": ad_id})).deleted_count:
        raise HTTPException(404, "Iklan tidak ditemukan")
    return {"ok": True}


async def seed_promos(database):
    await database.ads.update_many({"ad_type": {"$exists": False}}, {"$set": {
        "ad_type": "brand", "vendor_id": None, "contract_value": 2500000, "paid": True, "payment_note": "Paket demo 1 bulan", "notified_at": None}})
    if await database.banners.count_documents({}) == 0:
        await database.banners.insert_one({
            "banner_id": "bnr_demo_grosir", "name": "Promo Grosir Material", "active": True, "link_url": "/katalog?tab=all",
            "image": "https://static.prod-images.emergentagent.com/jobs/1baca0b2-3240-4aa4-832e-f51cecfeea66/images/fa5311ae1e4e62884a09ae1082101d6c5c053c2ab4a46c51b44eb8b600e823f2.jpeg",
            "start_date": None, "end_date": None, "created_at": now_iso(), "updated_at": now_iso()})
    if await database.ads.count_documents({}) == 0:
        await database.ads.insert_many([
            {"ad_id": "ad_demo_cat", "title": "Cat Tembok Premium Anti Jamur", "advertiser": "WarnaKita Paints",
             "image": "https://images.unsplash.com/photo-1562259949-e8e7689d7828?crop=entropy&cs=srgb&fm=jpg&q=85&w=900",
             "description": "Gratis konsultasi warna untuk proyek di atas 100 m².", "link_url": "https://example.com/warnakita",
             "cta": "Lihat Promo", "placements": ["home", "catalog"], "active": True, "start_date": None, "end_date": None,
             "clicks": 0, "created_at": now_iso(), "updated_at": now_iso()},
            {"ad_id": "ad_demo_hardware", "title": "Engsel Soft-Close & Rel Laci Grosir", "advertiser": "Hardware Prima",
             "image": "https://images.unsplash.com/photo-1668893973066-95b14ce86e71?crop=entropy&cs=srgb&fm=jpg&q=85&w=900",
             "description": "Aksesoris kitchen set kualitas ekspor, harga workshop.", "link_url": "https://example.com/hardwareprima",
             "cta": "Kunjungi Toko", "placements": ["catalog"], "active": True, "start_date": None, "end_date": None,
             "clicks": 0, "created_at": now_iso(), "updated_at": now_iso()},
        ])

    if not await database.ads.find_one({"ad_id": "ad_demo_vendor"}):
        await database.ads.insert_one({
            "ad_id": "ad_demo_vendor", "ad_type": "vendor", "vendor_id": "user_showcase_workshop", "title": "Kitchen Set Jati Custom — Survey Gratis",
            "advertiser": "", "image": "", "description": "Workshop Jepara berpengalaman, garansi 1 tahun.", "link_url": "", "cta": "Lihat Profil",
            "placements": ["home", "catalog"], "active": True, "start_date": None, "end_date": None, "contract_value": 1500000, "paid": True,
            "payment_note": "Transfer BCA - demo", "clicks": 0, "notified_at": None, "created_at": now_iso(), "updated_at": now_iso()})
