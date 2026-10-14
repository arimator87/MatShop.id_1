import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

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
    title: str = Field(min_length=2, max_length=120)
    advertiser: str = Field(min_length=2, max_length=80)
    image: str = Field(min_length=5)
    description: str = Field(default="", max_length=200)
    link_url: str = Field(min_length=1)
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
@router.get("/ads")
async def list_ads(placement: str = "catalog"):
    return await db().ads.find({**live_filter(), "placements": placement}, {"_id": 0}).sort("created_at", -1).to_list(20)


@router.post("/ads/{ad_id}/click")
async def click_ad(ad_id: str):
    await db().ads.update_one({"ad_id": ad_id}, {"$inc": {"clicks": 1}})
    return {"ok": True}


@router.get("/admin/ads")
async def admin_ads(request: Request):
    await require_admin(request)
    return await db().ads.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


def ad_doc(body):
    check_dates(body)
    if any(p not in PLACEMENTS for p in body.placements):
        raise HTTPException(400, "Penempatan iklan tidak valid")
    return {**body.model_dump(), "updated_at": now_iso()}


@router.post("/admin/ads")
async def create_ad(body: AdIn, request: Request):
    await require_admin(request)
    doc = {**ad_doc(body), "ad_id": f"ad_{uuid.uuid4().hex[:10]}", "clicks": 0, "created_at": now_iso()}
    await db().ads.insert_one(dict(doc))
    return doc


@router.put("/admin/ads/{ad_id}")
async def update_ad(ad_id: str, body: AdIn, request: Request):
    await require_admin(request)
    res = await db().ads.update_one({"ad_id": ad_id}, {"$set": ad_doc(body)})
    if not res.matched_count:
        raise HTTPException(404, "Iklan tidak ditemukan")
    return await db().ads.find_one({"ad_id": ad_id}, {"_id": 0})


@router.delete("/admin/ads/{ad_id}")
async def delete_ad(ad_id: str, request: Request):
    await require_admin(request)
    if not (await db().ads.delete_one({"ad_id": ad_id})).deleted_count:
        raise HTTPException(404, "Iklan tidak ditemukan")
    return {"ok": True}


async def seed_promos(database):
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
