import re
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api")
ctx = {}
MODES = {"cabinet": "Kabinet (P × L × T)", "surface": "Bidang (P × T)", "area": "Luas (m²)"}
WIDE_WARNING = "Lebar melebihi batas standar, hubungi kontraktor yang anda pilih"
DEFAULT_FINISHINGS = [
    ("hpl", "HPL", "High Pressure Laminate · tahan gores, motif kayu/solid, lebih ekonomis"),
    ("duco", "Duco", "Cat duco premium · permukaan mulus glossy/doff, warna custom"),
]
DEFAULT_TYPES = [
    ("kitchen_set", "Kitchen Set", "cabinet", "meter lari", "ChefHat", {"hpl": (2_500_000, 3_500_000), "duco": (4_000_000, 5_500_000)}),
    ("wardrobe", "Wardrobe / Lemari Tanam", "cabinet", "meter lari", "DoorClosed", {"hpl": (2_800_000, 3_800_000), "duco": (4_500_000, 6_000_000)}),
    ("full_interior", "Fit-Out Apartemen/Rumah", "area", "m²", "Sofa", {"hpl": (2_500_000, 4_000_000), "duco": (3_500_000, 5_500_000)}),
    ("wall_finish", "Wallpanel / Wallpaper / Cat Dinding", "surface", "m²", "PaintRoller", {"hpl": (450_000, 750_000), "duco": (350_000, 600_000)}),
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


def fmt(x):
    return f"{x:,.2f}".rstrip("0").rstrip(".").replace(",", "X").replace(".", ",").replace("X", ".")


class Dims(BaseModel):
    p: Optional[float] = Field(default=None, gt=0, le=100000)
    l: Optional[float] = Field(default=None, gt=0, le=100000)
    t: Optional[float] = Field(default=None, gt=0, le=100000)
    area: Optional[float] = Field(default=None, gt=0, le=100000)


def compute(wt: dict, d: Dims):
    mode = wt["mode"]
    if mode == "area":
        if not d.area:
            raise HTTPException(400, "Isi luas (m²)")
        return {"qty": d.area, "unit_label": wt["unit_label"], "size_label": f"Luas {fmt(d.area)} m²", "warning": None, "breakdown": []}
    if not d.p or not d.t or (mode == "cabinet" and not d.l):
        raise HTTPException(400, "Lengkapi ukuran (cm)")
    if mode == "cabinet":
        p = d.p / 100
        fl = 1 if d.l <= 60 else 1.5
        ft = 1 if d.t < 100 else d.t / 100
        warn = WIDE_WARNING if d.l > 100 else None
        return {"qty": round(p * fl * ft, 4), "unit_label": wt["unit_label"], "warning": warn,
                "size_label": f"P {fmt(d.p)} × L {fmt(d.l)} × T {fmt(d.t)} cm",
                "breakdown": [["P", f"{fmt(d.p)} cm → {fmt(p)} m"], ["Faktor L", f"{fmt(d.l)} cm → {fmt(fl)}"], ["Faktor T", f"{fmt(d.t)} cm → {fmt(ft)}"]]}
    p, t = max(d.p / 100, 1), max(d.t / 100, 1)
    small = d.p < 100 or d.t < 100
    return {"qty": round(p * t, 4), "unit_label": "Unit/Set" if small else wt["unit_label"], "warning": None,
            "size_label": f"P {fmt(d.p)} × T {fmt(d.t)} cm",
            "breakdown": [["P", f"{fmt(d.p)} cm → {fmt(p)} m"], ["T", f"{fmt(d.t)} cm → {fmt(t)} m"]]}


async def get_type(key, active_only=True):
    wt = await db().custom_work_types.find_one({"key": key, **({"active": True} if active_only else {})}, {"_id": 0})
    if not wt:
        raise HTTPException(400, "Jenis pekerjaan tidak valid")
    return wt


async def finishing_labels():
    return {f["key"]: f["label"] for f in await db().custom_finishings.find({}, {"_id": 0}).to_list(200)}


async def estimate(work_type: str, finishing: Optional[str], dims: Dims):
    wt = await get_type(work_type)
    calc = compute(wt, dims)
    out = {**calc, "work_type_label": wt["label"], "min": None, "max": None}
    if finishing:
        fin = await db().custom_finishings.find_one({"key": finishing, "active": True})
        rate = wt["rates"].get(finishing)
        if not fin or finishing not in wt["finishings"] or not rate:
            raise HTTPException(400, "Finishing tidak tersedia untuk jenis pekerjaan ini")
        out.update(finishing_label=fin["label"], rate_min=rate["min"], rate_max=rate["max"])
        if not calc["warning"]:
            out.update(min=round(rate["min"] * calc["qty"]), max=round(rate["max"] * calc["qty"]))
    return out


class EstimateIn(BaseModel):
    work_type: str
    finishing: Optional[str] = None
    dims: Dims


@router.post("/custom/estimate")
async def post_estimate(body: EstimateIn):
    return await estimate(body.work_type, body.finishing, body.dims)


@router.get("/custom/config")
async def public_config():
    types = await db().custom_work_types.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(100)
    fins = await db().custom_finishings.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    active_fins = {f["key"] for f in fins if f["active"]}
    for t in types:
        t["finishings"] = [k for k in t["finishings"] if k in active_fins]
    return {"work_types": types, "finishings": [f for f in fins if f["active"]], "modes": MODES, "wide_warning": WIDE_WARNING}


# ---------- Admin ----------
class Rate(BaseModel):
    min: float = Field(gt=0)
    max: float = Field(gt=0)


class WorkTypeIn(BaseModel):
    label: str = Field(min_length=2, max_length=60)
    mode: str
    unit_label: str = Field(min_length=1, max_length=20)
    icon: str = "Hammer"
    icon_image: str = ""
    hint: str = Field(default="", max_length=120)
    finishings: List[str] = Field(min_length=1)
    rates: Dict[str, Rate]
    active: bool = True


class FinishingIn(BaseModel):
    label: str = Field(min_length=2, max_length=40)
    desc: str = Field(default="", max_length=160)
    active: bool = True


class ReorderIn(BaseModel):
    kind: str
    keys: List[str]


def slug(label):
    return re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")[:24] or uuid.uuid4().hex[:6]


async def unique_key(coll, label):
    key = slug(label)
    while await db()[coll].find_one({"key": key}):
        key = f"{slug(label)[:18]}_{uuid.uuid4().hex[:4]}"
    return key


async def check_type(body: WorkTypeIn):
    if body.mode not in MODES:
        raise HTTPException(400, "Mode rumus tidak valid")
    known = set(await db().custom_finishings.distinct("key"))
    if any(k not in known for k in body.finishings):
        raise HTTPException(400, "Finishing tidak dikenal")
    for k in body.finishings:
        r = body.rates.get(k)
        if not r or r.max < r.min:
            raise HTTPException(400, "Isi range harga (min ≤ maks) untuk setiap finishing yang dipilih")
    doc = body.model_dump()
    doc["rates"] = {k: doc["rates"][k] for k in body.finishings}
    return doc


@router.get("/admin/custom-config")
async def admin_config(request: Request):
    await require_admin(request)
    types = await db().custom_work_types.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    fins = await db().custom_finishings.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    for t in types:
        t["usage"] = await db().custom_projects.count_documents({"work_type": t["key"]})
    for f in fins:
        f["usage"] = await db().custom_projects.count_documents({"finishing": f["key"]})
    return {"work_types": types, "finishings": fins, "modes": MODES}


@router.post("/admin/custom-work-types")
async def create_type(body: WorkTypeIn, request: Request):
    await require_admin(request)
    doc = {**await check_type(body), "key": await unique_key("custom_work_types", body.label),
           "order": await db().custom_work_types.count_documents({}), "created_at": now_iso()}
    await db().custom_work_types.insert_one(dict(doc))
    return doc


@router.put("/admin/custom-work-types/{key}")
async def update_type(key: str, body: WorkTypeIn, request: Request):
    await require_admin(request)
    res = await db().custom_work_types.update_one({"key": key}, {"$set": await check_type(body)})
    if not res.matched_count:
        raise HTTPException(404, "Jenis pekerjaan tidak ditemukan")
    return {"ok": True}


@router.delete("/admin/custom-work-types/{key}")
async def delete_type(key: str, request: Request):
    await require_admin(request)
    if await db().custom_projects.count_documents({"work_type": key}):
        raise HTTPException(400, "Jenis pekerjaan masih dipakai proyek — nonaktifkan saja")
    await db().custom_work_types.delete_one({"key": key})
    return {"ok": True}


@router.post("/admin/custom-finishings")
async def create_finishing(body: FinishingIn, request: Request):
    await require_admin(request)
    doc = {**body.model_dump(), "key": await unique_key("custom_finishings", body.label),
           "order": await db().custom_finishings.count_documents({}), "created_at": now_iso()}
    await db().custom_finishings.insert_one(dict(doc))
    return doc


@router.put("/admin/custom-finishings/{key}")
async def update_finishing(key: str, body: FinishingIn, request: Request):
    await require_admin(request)
    res = await db().custom_finishings.update_one({"key": key}, {"$set": body.model_dump()})
    if not res.matched_count:
        raise HTTPException(404, "Finishing tidak ditemukan")
    return {"ok": True}


@router.delete("/admin/custom-finishings/{key}")
async def delete_finishing(key: str, request: Request):
    await require_admin(request)
    if await db().custom_projects.count_documents({"finishing": key}):
        raise HTTPException(400, "Finishing masih dipakai proyek — nonaktifkan saja")
    await db().custom_finishings.delete_one({"key": key})
    await db().custom_work_types.update_many({}, {"$pull": {"finishings": key}, "$unset": {f"rates.{key}": ""}})
    return {"ok": True}


@router.post("/admin/custom-config/reorder")
async def reorder(body: ReorderIn, request: Request):
    await require_admin(request)
    coll = {"work_types": "custom_work_types", "finishings": "custom_finishings"}.get(body.kind)
    if not coll:
        raise HTTPException(400, "Jenis urutan tidak valid")
    for i, k in enumerate(body.keys):
        await db()[coll].update_one({"key": k}, {"$set": {"order": i}})
    return {"ok": True}


async def seed_custom_config(database):
    if await database.custom_finishings.count_documents({}) == 0:
        await database.custom_finishings.insert_many([{"key": k, "label": label, "desc": desc, "active": True, "order": i, "created_at": now_iso()}
                                                     for i, (k, label, desc) in enumerate(DEFAULT_FINISHINGS)])
    if await database.custom_work_types.count_documents({}) == 0:
        hints = {"cabinet": "Isi Panjang, Lebar (kedalaman), Tinggi dalam cm", "surface": "Isi Panjang & Tinggi bidang dalam cm", "area": "Isi luas lantai dalam m²"}
        await database.custom_work_types.insert_many([{
            "key": k, "label": label, "mode": mode, "unit_label": unit, "icon": icon, "icon_image": "", "hint": hints[mode],
            "finishings": list(rates), "rates": {f: {"min": lo, "max": hi} for f, (lo, hi) in rates.items()},
            "active": True, "order": i, "created_at": now_iso()} for i, (k, label, mode, unit, icon, rates) in enumerate(DEFAULT_TYPES)])
    labels = {t["key"]: t for t in await database.custom_work_types.find({}, {"_id": 0}).to_list(100)}
    fins = {f["key"]: f["label"] for f in await database.custom_finishings.find({}, {"_id": 0}).to_list(100)}
    async for p in database.custom_projects.find({"work_type_label": {"$exists": False}}, {"_id": 0, "project_id": 1, "work_type": 1, "finishing": 1, "size": 1, "unit": 1}):
        wt = labels.get(p["work_type"], {})
        unit = {"m_lari": "meter lari", "m2": "m²"}.get(p.get("unit"), wt.get("unit_label", ""))
        await database.custom_projects.update_one({"project_id": p["project_id"]}, {"$set": {
            "work_type_label": wt.get("label", p["work_type"]), "finishing_label": fins.get(p.get("finishing")),
            "unit_label": unit, "size_label": f"{fmt(p['size'])} {unit}" if p.get("size") else None}})
