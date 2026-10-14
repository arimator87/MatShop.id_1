import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/custom")
ctx = {}

WORK_TYPES = {
    "kitchen_set": {"label": "Kitchen Set", "unit": "m_lari"},
    "wardrobe": {"label": "Wardrobe / Lemari Tanam", "unit": "m_lari"},
    "full_interior": {"label": "Full Interior Apartemen/Rumah", "unit": "m2"},
}
UNIT_LABEL = {"m_lari": "meter lari", "m2": "m²"}
FINISHING = {"hpl": "HPL", "duco": "Duco"}
RATES = {
    ("kitchen_set", "hpl"): (2_500_000, 3_500_000), ("kitchen_set", "duco"): (4_000_000, 5_500_000),
    ("wardrobe", "hpl"): (2_800_000, 3_800_000), ("wardrobe", "duco"): (4_500_000, 6_000_000),
    ("full_interior", "hpl"): (2_500_000, 4_000_000), ("full_interior", "duco"): (3_500_000, 5_500_000),
}
MILESTONES = [
    {"key": "m1", "label": "DP & Survey Lokasi", "pct": 30},
    {"key": "m2", "label": "Fabrikasi Workshop", "pct": 40},
    {"key": "m3", "label": "Pemasangan di Lokasi & Serah Terima", "pct": 30},
]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def db():
    return ctx["db"]


async def user_of(request: Request):
    return await ctx["get_user"](request)


def estimate(work_type: str, size: float, finishing: str):
    if work_type not in WORK_TYPES or finishing not in FINISHING:
        raise HTTPException(400, "Jenis pekerjaan / finishing tidak valid")
    lo, hi = RATES[(work_type, finishing)]
    unit = WORK_TYPES[work_type]["unit"]
    return {"min": lo * size, "max": hi * size, "rate_min": lo, "rate_max": hi, "unit": unit, "unit_label": UNIT_LABEL[unit]}


class EstimateIn(BaseModel):
    work_type: str
    size: float = Field(gt=0, le=1000)
    finishing: str


class ProjectIn(EstimateIn):
    title: str = Field(min_length=3)
    description: str = Field(min_length=10)
    address: str = Field(min_length=5)
    city: str = Field(min_length=2)
    phone: str = Field(min_length=6)
    survey_date: Optional[str] = None
    photos: List[str] = Field(default=[], max_length=8)


class RabItem(BaseModel):
    item: str = Field(min_length=2)
    qty: float = Field(gt=0)
    unit: str = "ls"
    price: float = Field(gt=0)


class BidIn(BaseModel):
    duration_days: int = Field(gt=0, le=365)
    notes: str = ""
    rab_items: List[RabItem] = Field(min_length=1)


class NoteIn(BaseModel):
    note: str = Field(min_length=3)


def event(note):
    return {"note": note, "at": now_iso()}


@router.get("/meta")
async def meta():
    return {"work_types": WORK_TYPES, "finishing": FINISHING, "milestones": MILESTONES, "unit_label": UNIT_LABEL}


@router.post("/estimate")
async def post_estimate(body: EstimateIn):
    return estimate(body.work_type, body.size, body.finishing)


@router.post("/projects")
async def create_project(body: ProjectIn, request: Request):
    user = await user_of(request)
    est = estimate(body.work_type, body.size, body.finishing)
    doc = {**body.model_dump(), "project_id": f"CP-{uuid.uuid4().hex[:8].upper()}", "client_id": user.user_id,
           "client_name": user.name, "estimate_min": est["min"], "estimate_max": est["max"], "unit": est["unit"],
           "status": "open", "bid_count": 0, "vendor_id": None, "milestones": [],
           "timeline": [event("Request proyek diajukan, menunggu penawaran vendor")], "created_at": now_iso()}
    await db().custom_projects.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/projects/mine")
async def my_projects(request: Request):
    user = await user_of(request)
    return await db().custom_projects.find({"client_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.get("/opportunities")
async def opportunities(request: Request):
    user = await user_of(request)
    docs = await db().custom_projects.find({"status": "open", "client_id": {"$ne": user.user_id}},
                                           {"_id": 0, "phone": 0}).sort("created_at", -1).to_list(200)
    mine = {b["project_id"] for b in await db().project_bids.find({"vendor_id": user.user_id}, {"_id": 0, "project_id": 1}).to_list(1000)}
    return [{**d, "has_my_bid": d["project_id"] in mine} for d in docs]


@router.get("/vendor-projects")
async def vendor_projects(request: Request):
    user = await user_of(request)
    return await db().custom_projects.find({"vendor_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)


async def load(project_id: str):
    p = await db().custom_projects.find_one({"project_id": project_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Proyek tidak ditemukan")
    return p


@router.get("/projects/{project_id}")
async def get_project(project_id: str, request: Request):
    user = await user_of(request)
    p = await load(project_id)
    is_client, is_vendor = p["client_id"] == user.user_id, p.get("vendor_id") == user.user_id
    if not (is_client or is_vendor or p["status"] == "open" or user.is_admin):
        raise HTTPException(403, "Proyek sudah ditangani vendor lain")
    if is_client or user.is_admin:
        bids = await db().project_bids.find({"project_id": project_id}, {"_id": 0}).sort("amount", 1).to_list(100)
    else:
        bids = await db().project_bids.find({"project_id": project_id, "vendor_id": user.user_id}, {"_id": 0}).to_list(1)
        if not is_vendor:
            p.pop("phone", None)
    return {**p, "bids": bids, "viewer": "client" if is_client else "vendor" if is_vendor else "bidder"}


@router.post("/projects/{project_id}/bids")
async def submit_bid(project_id: str, body: BidIn, request: Request):
    user = await user_of(request)
    p = await load(project_id)
    if p["client_id"] == user.user_id:
        raise HTTPException(400, "Tidak bisa menawar proyek sendiri")
    if p["status"] != "open":
        raise HTTPException(400, "Proyek tidak lagi menerima penawaran")
    items = [{**i.model_dump(), "subtotal": i.qty * i.price} for i in body.rab_items]
    amount = sum(i["subtotal"] for i in items)
    existing = await db().project_bids.find_one({"project_id": project_id, "vendor_id": user.user_id}, {"_id": 0})
    data = {"duration_days": body.duration_days, "notes": body.notes, "rab_items": items, "amount": amount, "updated_at": now_iso()}
    if existing:
        await db().project_bids.update_one({"bid_id": existing["bid_id"]}, {"$set": data})
        bid_id = existing["bid_id"]
    else:
        bid_id = f"BID-{uuid.uuid4().hex[:8].upper()}"
        await db().project_bids.insert_one({**data, "bid_id": bid_id, "project_id": project_id, "vendor_id": user.user_id,
                                            "vendor_name": user.name, "status": "pending", "created_at": now_iso()})
        await db().custom_projects.update_one({"project_id": project_id}, {"$inc": {"bid_count": 1}})
    return await db().project_bids.find_one({"bid_id": bid_id}, {"_id": 0})


@router.post("/projects/{project_id}/bids/{bid_id}/accept")
async def accept_bid(project_id: str, bid_id: str, request: Request):
    user = await user_of(request)
    p = await load(project_id)
    if p["client_id"] != user.user_id:
        raise HTTPException(403, "Hanya klien pemilik proyek")
    if p["status"] != "open":
        raise HTTPException(400, "Penawaran sudah dipilih")
    bid = await db().project_bids.find_one({"bid_id": bid_id, "project_id": project_id}, {"_id": 0})
    if not bid:
        raise HTTPException(404, "Penawaran tidak ditemukan")
    amt = bid["amount"]
    ms = []
    for i, m in enumerate(MILESTONES):
        value = round(amt * m["pct"] / 100) if i < len(MILESTONES) - 1 else amt - sum(x["amount"] for x in ms)
        ms.append({**m, "amount": value, "status": "pending"})
    await db().project_bids.update_many({"project_id": project_id, "bid_id": {"$ne": bid_id}}, {"$set": {"status": "rejected"}})
    await db().project_bids.update_one({"bid_id": bid_id}, {"$set": {"status": "accepted"}})
    await db().custom_projects.update_one({"project_id": project_id}, {
        "$set": {"status": "awarded", "vendor_id": bid["vendor_id"], "vendor_name": bid["vendor_name"], "contract_amount": amt,
                 "accepted_bid_id": bid_id, "duration_days": bid["duration_days"], "milestones": ms},
        "$push": {"timeline": event(f"Penawaran {bid['vendor_name']} diterima. Nilai kontrak Rp {amt:,.0f}".replace(",", "."))}})
    return await load(project_id)


async def milestone_action(project_id: str, key: str, user, actor: str, expect: str, new: str, note: str, extra=None):
    p = await load(project_id)
    if (actor == "client" and p["client_id"] != user.user_id) or (actor == "vendor" and p.get("vendor_id") != user.user_id):
        raise HTTPException(403, "Tidak berhak")
    idx = next((i for i, m in enumerate(p["milestones"]) if m["key"] == key), None)
    if idx is None:
        raise HTTPException(404, "Milestone tidak ditemukan")
    m = p["milestones"][idx]
    if m["status"] != expect:
        raise HTTPException(400, f"Milestone tidak dalam status {expect}")
    if expect == "pending" and idx > 0 and p["milestones"][idx - 1]["status"] != "released":
        raise HTTPException(400, "Selesaikan milestone sebelumnya terlebih dahulu")
    sets = {f"milestones.{idx}.status": new, f"milestones.{idx}.{new}_at": now_iso(), **(extra or {})}
    sets = {k.replace("{i}", str(idx)): v for k, v in sets.items()}
    released_all = new == "released" and all(x["status"] == "released" for j, x in enumerate(p["milestones"]) if j != idx)
    sets["status"] = "completed" if released_all else "in_progress"
    await db().custom_projects.update_one({"project_id": project_id}, {"$set": sets, "$push": {"timeline": event(note)}})
    return await load(project_id)


@router.post("/projects/{project_id}/milestones/{key}/pay")
async def pay_milestone(project_id: str, key: str, request: Request):
    user = await user_of(request)
    p = await load(project_id)
    m = next((x for x in p["milestones"] if x["key"] == key), {"label": key, "pct": 0})
    return await milestone_action(project_id, key, user, "client", "pending", "held",
                                  f"Milestone {m['label']} ({m['pct']}%) dibayar. Dana ditahan escrow (MOCK)")


@router.post("/projects/{project_id}/milestones/{key}/submit")
async def submit_milestone(project_id: str, key: str, body: NoteIn, request: Request):
    user = await user_of(request)
    return await milestone_action(project_id, key, user, "vendor", "held", "submitted",
                                  f"Vendor melaporkan pekerjaan selesai: {body.note}", {"milestones.{i}.vendor_note": body.note})


@router.post("/projects/{project_id}/milestones/{key}/release")
async def release_milestone(project_id: str, key: str, request: Request):
    user = await user_of(request)
    p = await load(project_id)
    m = next((x for x in p["milestones"] if x["key"] == key), {"label": key})
    return await milestone_action(project_id, key, user, "client", "submitted", "released",
                                  f"Klien menyetujui {m['label']}. Dana milestone dirilis ke vendor")


@router.post("/projects/{project_id}/cancel")
async def cancel_project(project_id: str, request: Request):
    user = await user_of(request)
    p = await load(project_id)
    if p["client_id"] != user.user_id or p["status"] != "open":
        raise HTTPException(400, "Hanya proyek terbuka milik Anda yang bisa dibatalkan")
    await db().custom_projects.update_one({"project_id": project_id}, {"$set": {"status": "cancelled"},
                                                                       "$push": {"timeline": event("Request dibatalkan klien")}})
    return await load(project_id)
