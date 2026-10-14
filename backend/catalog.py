import re
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api")
ctx = {}
TYPES = ("material", "service", "asset")
LABELS = {t: {} for t in TYPES}
ACTIVE = {t: set() for t in TYPES}
TAB_FILTERS = {}
DEFAULT_TABS = [
    ("all", "Semua Material", ["material"], []), ("plywood", "Plywood & Sheet", [], ["plywood", "hpl"]),
    ("spc", "SPC & Flooring", [], ["spc", "marmer"]), ("wallpanel", "WallPanel & WPC", [], ["wallpanel", "lis"]),
    ("services", "Jasa Desain 3D & RAB", ["service"], []), ("assets", "Aset File 3D", ["asset"], []),
]


def db():
    return ctx["db"]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def require_admin(request: Request):
    user = await ctx["get_user"](request)
    if not user.is_admin:
        raise HTTPException(403, "Khusus admin MatShop")
    return user


async def refresh():
    cats = await db().categories.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    for t in TYPES:
        LABELS[t] = {c["key"]: c["label"] for c in cats if c["type"] == t}
        ACTIVE[t] = {c["key"] for c in cats if c["type"] == t and c["active"]}
    TAB_FILTERS.clear()
    for tab in await db().catalog_tabs.find({}, {"_id": 0}).to_list(200):
        TAB_FILTERS[tab["key"]] = {"$or": [{"type": {"$in": tab["types"]}}, {"category": {"$in": tab["categories"]}}]}


async def seed_catalog(database, categories):
    if await database.categories.count_documents({}) == 0:
        docs, i = [], 0
        for t, items in categories.items():
            for k, label in items.items():
                docs.append({"key": k, "type": t, "label": label, "icon": "", "active": True, "order": i, "created_at": now_iso()})
                i += 1
        await database.categories.insert_many(docs)
    if await database.catalog_tabs.count_documents({}) == 0:
        await database.catalog_tabs.insert_many([{"key": k, "label": label, "types": ts, "categories": cs, "icon": "", "active": True,
                                                  "order": i, "created_at": now_iso()} for i, (k, label, ts, cs) in enumerate(DEFAULT_TABS)])
    await refresh()


def slug(label):
    return re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")[:30] or uuid.uuid4().hex[:6]


async def unique_key(coll, label):
    base = slug(label)
    key, n = base, 2
    while await coll.find_one({"key": key}):
        key, n = f"{base}_{n}", n + 1
    return key


class CategoryIn(BaseModel):
    type: str
    label: str = Field(min_length=2, max_length=50)
    icon: str = ""
    active: bool = True


class TabIn(BaseModel):
    label: str = Field(min_length=2, max_length=50)
    types: List[str] = []
    categories: List[str] = []
    icon: str = ""
    active: bool = True


class ReorderIn(BaseModel):
    kind: str
    keys: List[str]


# ---------- Public ----------
@router.get("/catalog/tabs")
async def public_tabs():
    tabs = await db().catalog_tabs.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(100)
    icons = {c["key"]: c["icon"] for c in await db().categories.find({"active": True, "icon": {"$ne": ""}}, {"_id": 0}).to_list(500)}
    return [{"key": t["key"], "label": t["label"], "icon": t["icon"] or next((icons[c] for c in t["categories"] if c in icons), "")} for t in tabs]


@router.get("/catalog/categories")
async def public_categories():
    return await db().categories.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(500)


# ---------- Admin ----------
@router.get("/admin/catalog")
async def admin_catalog(request: Request):
    await require_admin(request)
    cats = await db().categories.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    for c in cats:
        c["usage"] = await db().listings.count_documents({"type": c["type"], "category": c["key"], "is_active": True})
    tabs = await db().catalog_tabs.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return {"categories": cats, "tabs": tabs}


@router.post("/admin/categories")
async def create_category(body: CategoryIn, request: Request):
    await require_admin(request)
    if body.type not in TYPES:
        raise HTTPException(400, "Jenis kategori tidak valid")
    last = await db().categories.find_one({}, sort=[("order", -1)])
    doc = {**body.model_dump(), "key": await unique_key(db().categories, body.label), "order": (last["order"] + 1) if last else 0, "created_at": now_iso()}
    await db().categories.insert_one(dict(doc))
    await refresh()
    return doc


@router.put("/admin/categories/{key}")
async def update_category(key: str, body: CategoryIn, request: Request):
    await require_admin(request)
    res = await db().categories.update_one({"key": key}, {"$set": {"label": body.label, "icon": body.icon, "active": body.active}})
    if not res.matched_count:
        raise HTTPException(404, "Kategori tidak ditemukan")
    await refresh()
    return await db().categories.find_one({"key": key}, {"_id": 0})


@router.delete("/admin/categories/{key}")
async def delete_category(key: str, request: Request):
    await require_admin(request)
    if await db().listings.count_documents({"category": key}):
        raise HTTPException(400, "Kategori masih dipakai produk — nonaktifkan saja")
    if not (await db().categories.delete_one({"key": key})).deleted_count:
        raise HTTPException(404, "Kategori tidak ditemukan")
    await db().catalog_tabs.update_many({}, {"$pull": {"categories": key}})
    await refresh()
    return {"ok": True}


async def tab_doc(body):
    if not body.types and not body.categories:
        raise HTTPException(400, "Pilih minimal 1 jenis atau kategori untuk tab")
    if any(t not in TYPES for t in body.types):
        raise HTTPException(400, "Jenis tidak valid")
    known = {c["key"] for c in await db().categories.find({"key": {"$in": body.categories}}, {"key": 1}).to_list(500)}
    if set(body.categories) - known:
        raise HTTPException(400, "Kategori tidak ditemukan")
    return body.model_dump()


@router.post("/admin/tabs")
async def create_tab(body: TabIn, request: Request):
    await require_admin(request)
    last = await db().catalog_tabs.find_one({}, sort=[("order", -1)])
    doc = {**await tab_doc(body), "key": await unique_key(db().catalog_tabs, body.label), "order": (last["order"] + 1) if last else 0, "created_at": now_iso()}
    await db().catalog_tabs.insert_one(dict(doc))
    await refresh()
    return doc


@router.put("/admin/tabs/{key}")
async def update_tab(key: str, body: TabIn, request: Request):
    await require_admin(request)
    res = await db().catalog_tabs.update_one({"key": key}, {"$set": await tab_doc(body)})
    if not res.matched_count:
        raise HTTPException(404, "Tab tidak ditemukan")
    await refresh()
    return await db().catalog_tabs.find_one({"key": key}, {"_id": 0})


@router.delete("/admin/tabs/{key}")
async def delete_tab(key: str, request: Request):
    await require_admin(request)
    if not (await db().catalog_tabs.delete_one({"key": key})).deleted_count:
        raise HTTPException(404, "Tab tidak ditemukan")
    await refresh()
    return {"ok": True}


@router.post("/admin/catalog/reorder")
async def reorder(body: ReorderIn, request: Request):
    await require_admin(request)
    coll = {"categories": db().categories, "tabs": db().catalog_tabs}.get(body.kind)
    if coll is None:
        raise HTTPException(400, "Jenis urutan tidak valid")
    for i, k in enumerate(body.keys):
        await coll.update_one({"key": k}, {"$set": {"order": i}})
    await refresh()
    return {"ok": True}
