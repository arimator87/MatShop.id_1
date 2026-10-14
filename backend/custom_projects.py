import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
import reviews
import custom_config
from custom_config import Dims

router = APIRouter(prefix="/api/custom")
ctx = {}

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


class ProjectIn(BaseModel):
    work_type: str
    budget: float = Field(gt=0)
    dims: Optional[Dims] = None
    finishing: Optional[str] = None
    title: str = ""
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
    material_spec: str = Field(min_length=5)
    rab_items: List[RabItem] = Field(min_length=1)


class NoteIn(BaseModel):
    note: str = Field(min_length=3)


class ReviewIn(BaseModel):
    note: str = ""


class ProgressIn(BaseModel):
    percent: int = Field(ge=0, le=100)
    note: str = Field(min_length=3)
    photos: List[str] = Field(default=[], max_length=8)


class TakeoverIn(BaseModel):
    reason: str = Field(min_length=10)


MASTER_ID = "user_master_workshop"
MASTER_NAME = "Master Workshop MatShop"
ACTIVE = ("awarded", "in_progress", "internal_takeover")


def is_executor(p, user):
    return p.get("vendor_id") == user.user_id or (p.get("vendor_id") == MASTER_ID and user.is_admin)


def ensure_active(user):
    if getattr(user, "suspended", False):
        raise HTTPException(403, "Akun Anda dibekukan (suspended) oleh MatShop.id")


async def notify(user_id, title, body, link):
    await db().notifications.insert_one({"id": uuid.uuid4().hex, "user_id": user_id, "title": title, "body": body,
                                         "link": link, "read": False, "created_at": now_iso()})


def event(note):
    return {"note": note, "at": now_iso()}


@router.get("/meta")
async def meta():
    return {"milestones": MILESTONES}


@router.post("/projects")
async def create_project(body: ProjectIn, request: Request):
    user = await user_of(request)
    wt = await custom_config.get_type(body.work_type)
    has_dims = body.dims and any(v for v in body.dims.model_dump().values())
    est = await custom_config.estimate(body.work_type, body.finishing, body.dims) if has_dims else {}
    if body.finishing and not est:
        if body.finishing not in wt["finishings"]:
            raise HTTPException(400, "Finishing tidak tersedia untuk jenis pekerjaan ini")
    fin_label = (await custom_config.finishing_labels()).get(body.finishing) if body.finishing else None
    data = body.model_dump()
    data["title"] = body.title.strip() or f"{wt['label']} · {body.city}"
    data.update(work_type_label=wt["label"], finishing_label=fin_label, size=est.get("qty"),
                unit_label=est.get("unit_label", wt["unit_label"]), size_label=est.get("size_label"), size_warning=est.get("warning"))
    doc = {**data, "project_id": f"CP-{uuid.uuid4().hex[:8].upper()}", "client_id": user.user_id,
           "client_name": user.name, "estimate_min": est.get("min"), "estimate_max": est.get("max"),
           "status": "pending_review", "bid_count": 0, "vendor_id": None,
           "milestones": [], "timeline": [event("Request diajukan. Menunggu review internal MatShop (PENDING_REVIEW_INTERNAL)")],
           "created_at": now_iso()}
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
    out = []
    for d in docs:
        my_inv = next((i for i in invitations(d) if i["vendor_id"] == user.user_id), None)
        d.pop("invitations", None)
        out.append({**d, "has_my_bid": d["project_id"] in mine, "invited": bool(my_inv),
                    "invitation_status": my_inv and my_inv["status"]})
    out.sort(key=lambda d: not d["invited"])
    return out


class InviteIn(BaseModel):
    vendor_id: str


class InviteRespondIn(BaseModel):
    accept: bool
    reason: str = Field(default="", max_length=500)


def invitations(p):
    inv = p.get("invitations") or {}
    return [inv.get(v) or {"vendor_id": v, "vendor_name": "", "status": "pending", "reason": "", "at": None} for v in p.get("invited_vendor_ids", [])]


@router.post("/projects/{project_id}/invitation/respond")
async def respond_invitation(project_id: str, body: InviteRespondIn, request: Request):
    user = await user_of(request)
    p = await load(project_id)
    mine = next((i for i in invitations(p) if i["vendor_id"] == user.user_id), None)
    if not mine:
        raise HTTPException(404, "Undangan tidak ditemukan")
    if mine["status"] != "pending":
        raise HTTPException(400, "Undangan sudah direspon")
    if p["status"] != "open":
        raise HTTPException(400, "Proyek tidak lagi menerima penawaran")
    status = "accepted" if body.accept else "declined"
    inv = {**mine, "vendor_name": mine["vendor_name"] or user.name, "status": status, "reason": body.reason.strip(), "responded_at": now_iso()}
    label = "menerima" if body.accept else "menolak"
    await db().custom_projects.update_one({"project_id": project_id}, {"$set": {f"invitations.{user.user_id}": inv},
                                                                       "$push": {"timeline": event(f"{user.name} {label} undangan menawar")}})
    await notify(p["client_id"], f"Undangan {'diterima' if body.accept else 'ditolak'}",
                 f"{user.name} {label} undangan untuk {p['title']}" + (f". Alasan: {body.reason}" if body.reason and not body.accept else ""),
                 f"/custom-project/{project_id}")
    return inv


@router.post("/projects/{project_id}/invite")
async def invite_vendor(project_id: str, body: InviteIn, request: Request):
    user = await user_of(request)
    p = await load(project_id)
    if p["client_id"] != user.user_id:
        raise HTTPException(403, "Hanya pemilik proyek yang bisa mengundang vendor")
    if p["status"] != "open":
        raise HTTPException(400, "Undangan hanya untuk proyek OPEN_FOR_BID")
    if body.vendor_id == user.user_id:
        raise HTTPException(400, "Tidak bisa mengundang diri sendiri")
    v = await db().users.find_one({"user_id": body.vendor_id, "verification_status": "VERIFIED", "suspended": {"$ne": True}}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Vendor terverifikasi tidak ditemukan")
    if body.vendor_id in p.get("invited_vendor_ids", []):
        raise HTTPException(400, "Vendor sudah diundang ke proyek ini")
    inv = {"vendor_id": body.vendor_id, "vendor_name": v["name"], "status": "pending", "reason": "", "at": now_iso()}
    await db().custom_projects.update_one({"project_id": project_id}, {"$addToSet": {"invited_vendor_ids": body.vendor_id},
                                                                       "$set": {f"invitations.{body.vendor_id}": inv},
                                                                       "$push": {"timeline": event(f"Klien mengundang {v['name']} untuk menawar")}})
    await notify(body.vendor_id, "Undangan menawar proyek", f"{user.name} mengundang Anda menawar: {p['title']}", f"/custom-project/{project_id}")
    return {"ok": True, "invited_vendor_ids": [*p.get("invited_vendor_ids", []), body.vendor_id]}


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
    is_client, is_vendor = p["client_id"] == user.user_id, is_executor(p, user)
    if not (is_client or is_vendor or p["status"] == "open" or user.is_admin or p.get("original_vendor_id") == user.user_id):
        raise HTTPException(403, "Proyek sudah ditangani vendor lain")
    if is_client or user.is_admin:
        bids = await db().project_bids.find({"project_id": project_id}, {"_id": 0}).sort("amount", 1).to_list(100)
    else:
        bids = await db().project_bids.find({"project_id": project_id, "vendor_id": user.user_id}, {"_id": 0}).to_list(1)
        if not is_vendor:
            p.pop("phone", None)
    meta = await reviews.badges([b["vendor_id"] for b in bids])
    verified = {u["user_id"]: u.get("verification_status") for u in await db().users.find(
        {"user_id": {"$in": [b["vendor_id"] for b in bids]}}, {"_id": 0, "user_id": 1, "verification_status": 1}).to_list(100)}
    for b in bids:
        m = meta[b["vendor_id"]]
        b["vendor_rating"], b["vendor_review_count"], b["vendor_top_rated"] = m["rating"], m["review_count"], m["top_rated"]
        b["vendor_verified"] = verified.get(b["vendor_id"]) == "VERIFIED"
    inv = invitations(p)
    if not (is_client or user.is_admin):
        inv = [i for i in inv if i["vendor_id"] == user.user_id]
    p["invitations"] = inv
    viewer = "client" if is_client else "vendor" if is_vendor else "admin" if user.is_admin else "bidder"
    return {**p, "bids": bids, "viewer": viewer}


@router.post("/projects/{project_id}/bids")
async def submit_bid(project_id: str, body: BidIn, request: Request):
    user = await user_of(request)
    p = await load(project_id)
    if p["client_id"] == user.user_id:
        raise HTTPException(400, "Tidak bisa menawar proyek sendiri")
    ensure_active(user)
    if user.verification_status != "VERIFIED":
        raise HTTPException(403, "Profil usaha Anda harus diverifikasi oleh tim MatShop.id sebelum dapat mengajukan penawaran.")
    if p["status"] != "open":
        raise HTTPException(400, "Proyek tidak lagi menerima penawaran")
    items = [{**i.model_dump(), "subtotal": i.qty * i.price} for i in body.rab_items]
    amount = sum(i["subtotal"] for i in items)
    existing = await db().project_bids.find_one({"project_id": project_id, "vendor_id": user.user_id}, {"_id": 0})
    data = {"duration_days": body.duration_days, "notes": body.notes, "material_spec": body.material_spec,
            "rab_items": items, "amount": amount, "updated_at": now_iso()}
    if existing:
        await db().project_bids.update_one({"bid_id": existing["bid_id"]}, {"$set": data})
        bid_id = existing["bid_id"]
    else:
        bid_id = f"BID-{uuid.uuid4().hex[:8].upper()}"
        await db().project_bids.insert_one({**data, "bid_id": bid_id, "project_id": project_id, "vendor_id": user.user_id,
                                            "vendor_name": user.name, "status": "pending", "created_at": now_iso()})
        await db().custom_projects.update_one({"project_id": project_id}, {"$inc": {"bid_count": 1}})
        await notify(p["client_id"], "Penawaran baru masuk", f"{user.name} mengajukan penawaran Rp {amount:,.0f} untuk {p['title']}".replace(",", "."),
                     f"/custom-project/{project_id}")
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
    await notify(bid["vendor_id"], "Penawaran Anda menang!", f"Klien memilih Anda untuk {p['title']}. Tunggu DP milestone 1 (30%)",
                 f"/custom-project/{project_id}")
    await db().custom_projects.update_one({"project_id": project_id}, {
        "$set": {"status": "awarded", "vendor_id": bid["vendor_id"], "vendor_name": bid["vendor_name"], "contract_amount": amt,
                 "accepted_bid_id": bid_id, "duration_days": bid["duration_days"], "milestones": ms},
        "$push": {"timeline": event(f"Penawaran {bid['vendor_name']} diterima. Nilai kontrak Rp {amt:,.0f}".replace(",", "."))}})
    return await load(project_id)


async def milestone_action(project_id: str, key: str, user, actor: str, expect: str, new: str, note: str, extra=None):
    p = await load(project_id)
    if (actor == "client" and p["client_id"] != user.user_id) or (actor == "vendor" and not is_executor(p, user)):
        raise HTTPException(403, "Tidak berhak")
    if actor == "vendor":
        ensure_active(user)
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
    sets["status"] = "completed" if released_all else ("internal_takeover" if p["status"] == "internal_takeover" else "in_progress")
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
    if p["client_id"] != user.user_id or p["status"] not in ("open", "pending_review"):
        raise HTTPException(400, "Hanya proyek terbuka milik Anda yang bisa dibatalkan")
    await db().custom_projects.update_one({"project_id": project_id}, {"$set": {"status": "cancelled"},
                                                                       "$push": {"timeline": event("Request dibatalkan klien")}})
    return await load(project_id)


async def require_admin(request: Request):
    user = await user_of(request)
    if not user.is_admin:
        raise HTTPException(403, "Khusus admin MatShop")
    return user


@router.get("/admin/projects")
async def admin_projects(request: Request, status: str = "pending_review"):
    await require_admin(request)
    flt = {} if status == "all" else {"status": status}
    return await db().custom_projects.find(flt, {"_id": 0}).sort("created_at", -1).to_list(500)


async def review(project_id: str, request: Request, approve: bool, note: str):
    admin = await require_admin(request)
    p = await load(project_id)
    if p["status"] != "pending_review":
        raise HTTPException(400, "Proyek tidak dalam status PENDING_REVIEW_INTERNAL")
    status = "open" if approve else "rejected"
    msg = ("Disetujui tim MatShop. Proyek dibuka untuk penawaran (OPEN_FOR_BID)" if approve
           else "Request ditolak tim MatShop") + (f". Catatan: {note}" if note else "")
    await db().custom_projects.update_one({"project_id": project_id}, {
        "$set": {"status": status, "review": {"by": admin.name, "note": note, "at": now_iso(), "approved": approve}},
        "$push": {"timeline": event(msg)}})
    await notify(p["client_id"], "Proyek disetujui" if approve else "Proyek ditolak", msg, f"/custom-project/{project_id}")
    return await load(project_id)


@router.post("/admin/projects/{project_id}/approve")
async def approve_project(project_id: str, body: ReviewIn, request: Request):
    return await review(project_id, request, True, body.note)


@router.post("/admin/projects/{project_id}/reject")
async def reject_project(project_id: str, body: ReviewIn, request: Request):
    if len(body.note.strip()) < 5:
        raise HTTPException(400, "Alasan penolakan wajib diisi")
    return await review(project_id, request, False, body.note)


@router.post("/projects/{project_id}/progress")
async def add_progress(project_id: str, body: ProgressIn, request: Request):
    user = await user_of(request)
    p = await load(project_id)
    if not is_executor(p, user):
        raise HTTPException(403, "Hanya pelaksana proyek")
    ensure_active(user)
    if p["status"] not in ACTIVE:
        raise HTTPException(400, "Proyek tidak sedang dikerjakan")
    if body.percent < (p.get("progress_percent") or 0):
        raise HTTPException(400, "Persentase tidak boleh turun dari laporan sebelumnya")
    entry = {"id": uuid.uuid4().hex[:8], **body.model_dump(), "by": p["vendor_name"], "at": now_iso()}
    await db().custom_projects.update_one({"project_id": project_id}, {
        "$set": {"progress_percent": body.percent}, "$push": {"progress_updates": entry}})
    await notify(p["client_id"], f"Progres proyek {body.percent}%", f"{p['vendor_name']}: {body.note}", f"/custom-project/{project_id}")
    return await load(project_id)


@router.get("/admin/active-projects")
async def admin_active(request: Request):
    await require_admin(request)
    return await db().custom_projects.find({"status": {"$in": [*ACTIVE, "completed"]}}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/admin/projects/{project_id}/takeover")
async def takeover(project_id: str, body: TakeoverIn, request: Request):
    admin = await require_admin(request)
    p = await load(project_id)
    if p["status"] not in ("awarded", "in_progress"):
        raise HTTPException(400, "Takeover hanya untuk proyek yang sedang berjalan")
    ms = p["milestones"]
    held = sum(m["amount"] for m in ms if m["status"] in ("held", "submitted"))
    unpaid = sum(m["amount"] for m in ms if m["status"] == "pending")
    released = sum(m["amount"] for m in ms if m["status"] == "released")
    for m in ms:
        if m["status"] != "released":
            m["assigned_to"] = MASTER_NAME
            if m["status"] == "submitted":
                m["status"] = "held"
    info = {"reason": body.reason, "by": admin.name, "at": now_iso(), "from_vendor_id": p["vendor_id"],
            "from_vendor_name": p["vendor_name"], "escrow_transferred": held, "remaining_unpaid": unpaid,
            "released_to_previous": released}
    await db().custom_projects.update_one({"project_id": project_id}, {"$set": {
        "status": "internal_takeover", "original_vendor_id": p["vendor_id"], "original_vendor_name": p["vendor_name"],
        "vendor_id": MASTER_ID, "vendor_name": MASTER_NAME, "milestones": ms, "takeover": info},
        "$push": {"timeline": event(f"INTERNAL_TAKEOVER oleh {MASTER_NAME}. Sisa dana escrow Rp {held:,.0f} dialihkan. Alasan: {body.reason}".replace(",", "."))}})
    await db().escrow_ledger.insert_one({"id": uuid.uuid4().hex, "project_id": project_id, "type": "takeover_reallocation",
                                         "from": p["vendor_id"], "to": MASTER_ID, "amount": held, "at": now_iso()})
    await db().users.update_one({"user_id": p["vendor_id"]}, {"$set": {
        "suspended": True, "suspended_reason": f"Wanprestasi proyek {project_id}: {body.reason}", "suspended_at": now_iso()}})
    await notify(p["client_id"], "Garansi Penyelesaian Proyek MatShop",
                 f"Proyek {p['title']} kini diambil alih {MASTER_NAME}. MatShop.id menjamin penyelesaian proyek; sisa dana escrow tetap aman.",
                 f"/custom-project/{project_id}")
    await notify(p["vendor_id"], "Akun dibekukan", f"Akun Anda dibekukan karena wanprestasi pada proyek {p['title']}.", "/dashboard")
    return await load(project_id)
