import re
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api")
ctx = {}
PENDING = {"designer_creator": "PENDING_DESIGNER_VERIFICATION", "contractor": "PENDING_SURVEY_VERIFICATION"}
CONTRACTOR_MSG = ("Profil Anda sedang ditinjau. Tim MatShop.id akan melakukan verifikasi dokumen dan "
                  "menjadwalkan kunjungan/survei ke lokasi Workshop Anda.")
ROLE_NAME = {"designer_creator": "Desainer", "contractor": "Kontraktor / Workshop"}


def db():
    return ctx["db"]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def require_admin(request: Request):
    user = await ctx["get_user"](request)
    if not user.is_admin:
        raise HTTPException(403, "Khusus admin MatShop")
    return user


def private_file(path: str):
    return isinstance(path, str) and "/private/" in path


class DesignerIn(BaseModel):
    ktp: str = Field(min_length=5)
    selfie: str = Field(min_length=5)


class ContractorIn(DesignerIn):
    workshop_photos: List[str] = Field(min_length=1, max_length=8)
    workshop_video: str = Field(min_length=8, max_length=500)
    address: str = Field(min_length=10, max_length=500)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    maps_url: str = Field(default="", max_length=500)


class ScheduleIn(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    note: str = Field(default="", max_length=500)


class RescheduleIn(BaseModel):
    preferred_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    preferred_time: str = Field(default="", max_length=5)
    reason: str = Field(min_length=5, max_length=500)


class RejectIn(BaseModel):
    note: str = Field(min_length=5, max_length=500)


def check_private(paths, user_id):
    for p in paths:
        if not private_file(p) or f"/private/{user_id}/" not in p:
            raise HTTPException(400, "Dokumen KTP / foto diri wajib diunggah melalui form verifikasi")


async def activate(user, role, data):
    prev = (user.role_verifications or {}).get(role) or {}
    if prev.get("status") == "VERIFIED":
        raise HTTPException(400, "Peran ini sudah terverifikasi")
    doc = {**data, "status": PENDING[role], "submitted_at": now_iso(), "note": None, "survey": prev.get("survey"),
           "survey_history": prev.get("survey_history", []), "reschedule_request": None}
    await db().users.update_one({"user_id": user.user_id}, {"$set": {f"role_verifications.{role}": doc, "active_role": role},
                                                            "$addToSet": {"enabled_roles": role}})
    msg = CONTRACTOR_MSG if role == "contractor" else "Dokumen KTP & foto diri Anda sedang ditinjau tim MatShop.id."
    await ctx["notify"](user.user_id, f"Verifikasi {ROLE_NAME[role]} diterima", msg, "/dashboard")
    return await ctx["user_out"](user.user_id)


@router.post("/users/activation/designer")
async def activate_designer(body: DesignerIn, request: Request):
    user = await ctx["get_user"](request)
    check_private([body.ktp, body.selfie], user.user_id)
    return await activate(user, "designer_creator", body.model_dump())


@router.post("/users/activation/contractor")
async def activate_contractor(body: ContractorIn, request: Request):
    user = await ctx["get_user"](request)
    check_private([body.ktp, body.selfie], user.user_id)
    if not re.match(r"^https?://", body.workshop_video):
        raise HTTPException(400, "Link video workshop harus diawali http:// atau https://")
    if body.lat is None and not body.maps_url.strip():
        raise HTTPException(400, "Isi titik lokasi workshop (GPS / koordinat / link Google Maps)")
    return await activate(user, "contractor", body.model_dump())


@router.post("/users/activation/contractor/reschedule")
async def request_reschedule(body: RescheduleIn, request: Request):
    user = await ctx["get_user"](request)
    v = (user.role_verifications or {}).get("contractor") or {}
    if v.get("status") != "SURVEY_SCHEDULED":
        raise HTTPException(400, "Belum ada jadwal survei yang bisa diubah")
    await db().users.update_one({"user_id": user.user_id}, {"$set": {
        "role_verifications.contractor.reschedule_request": {**body.model_dump(), "at": now_iso()}}})
    return await ctx["user_out"](user.user_id)


# ---------- Admin ----------
STATUS_FILTER = {
    "pending": lambda role: [PENDING[role]],
    "scheduled": lambda role: ["SURVEY_SCHEDULED"],
    "verified": lambda role: ["VERIFIED"],
    "rejected": lambda role: ["REJECTED"],
}


@router.get("/admin/partner-verifications")
async def list_verifications(request: Request, role: str = "designer_creator", status: str = "pending"):
    await require_admin(request)
    if role not in PENDING:
        raise HTTPException(400, "Peran tidak valid")
    key = f"role_verifications.{role}.status"
    flt = {key: {"$in": STATUS_FILTER[status](role)}} if status in STATUS_FILTER else {key: {"$exists": True}}
    docs = await db().users.find(flt, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "picture": 1, "role_verifications": 1,
                                       "business_profile.business_name": 1}).to_list(500)
    out = [{"user_id": d["user_id"], "name": d["name"], "email": d["email"],
            "business_name": (d.get("business_profile") or {}).get("business_name"), **d["role_verifications"][role]} for d in docs]
    return sorted(out, key=lambda x: x.get("submitted_at") or "", reverse=True)


@router.get("/admin/partner-verifications/counts")
async def counts(request: Request):
    await require_admin(request)
    return {role: {s: await db().users.count_documents({f"role_verifications.{role}.status": {"$in": f(role)}}) for s, f in STATUS_FILTER.items()}
            for role in PENDING}


async def target(user_id, role):
    if role not in PENDING:
        raise HTTPException(400, "Peran tidak valid")
    u = await db().users.find_one({"user_id": user_id}, {"_id": 0})
    v = ((u or {}).get("role_verifications") or {}).get(role)
    if not v:
        raise HTTPException(404, "Pengajuan verifikasi tidak ditemukan")
    return u, v


@router.post("/admin/partner-verifications/{user_id}/contractor/schedule")
async def schedule(user_id: str, body: ScheduleIn, request: Request):
    admin = await require_admin(request)
    _, v = await target(user_id, "contractor")
    if v["status"] not in (PENDING["contractor"], "SURVEY_SCHEDULED"):
        raise HTTPException(400, "Status tidak bisa dijadwalkan")
    survey = {**body.model_dump(), "scheduled_by": admin.name, "scheduled_at": now_iso()}
    history = v.get("survey_history", []) + ([v["survey"]] if v.get("survey") else [])
    await db().users.update_one({"user_id": user_id}, {"$set": {
        "role_verifications.contractor.status": "SURVEY_SCHEDULED", "role_verifications.contractor.survey": survey,
        "role_verifications.contractor.survey_history": history, "role_verifications.contractor.reschedule_request": None}})
    verb = "dijadwalkan ulang" if v.get("survey") else "dijadwalkan"
    await ctx["notify"](user_id, f"Survei workshop {verb}", f"Kunjungan tim MatShop.id: {body.date} pukul {body.time}. {body.note}".strip(), "/dashboard")
    return {"ok": True}


async def decide(user_id, role, status, admin, note=None):
    _, v = await target(user_id, role)
    if role == "contractor" and status == "VERIFIED" and v["status"] != "SURVEY_SCHEDULED":
        raise HTTPException(400, "Jadwalkan & lakukan survei lokasi terlebih dahulu")
    upd = {f"role_verifications.{role}.status": status, f"role_verifications.{role}.note": note,
           f"role_verifications.{role}.decided_by": admin.name, f"role_verifications.{role}.decided_at": now_iso()}
    if status == "VERIFIED":
        upd["verification_status"] = "VERIFIED"
    await db().users.update_one({"user_id": user_id}, {"$set": upd})
    name = ROLE_NAME[role]
    if status == "VERIFIED":
        title, msg = (f"Selamat! Anda kini Verified Partner ({name})", "Badge terverifikasi tampil di profil & penawaran Anda.")
    else:
        title, msg = (f"Verifikasi {name} ditolak", f"Alasan: {note}. Perbaiki data lalu kirim ulang form verifikasi.")
    await ctx["notify"](user_id, title, msg, "/dashboard")
    return {"ok": True}


@router.post("/admin/partner-verifications/{user_id}/{role}/approve")
async def approve(user_id: str, role: str, request: Request):
    return await decide(user_id, role, "VERIFIED", await require_admin(request))


@router.post("/admin/partner-verifications/{user_id}/{role}/reject")
async def reject(user_id: str, role: str, body: RejectIn, request: Request):
    return await decide(user_id, role, "REJECTED", await require_admin(request), body.note)


SEED_IMG = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=60"
SEED_VERIFIED = {
    "user_demo_supplier": ["contractor"], "user_demo_designer": ["designer_creator"],
    "user_showcase_workshop": ["contractor"], "user_showcase_interior": ["designer_creator", "contractor"],
}
SEED_PENDING = [
    {"user_id": "user_pending_designer", "email": "calon.desainer@matshop.id", "name": "Nadia Putri (Calon Desainer)", "role": "designer_creator",
     "data": {"ktp": SEED_IMG, "selfie": SEED_IMG}},
    {"user_id": "user_pending_contractor", "email": "calon.kontraktor@matshop.id", "name": "Bengkel Kayu Sumber Rejeki", "role": "contractor",
     "data": {"ktp": SEED_IMG, "selfie": SEED_IMG, "workshop_photos": [SEED_IMG], "workshop_video": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
              "address": "Jl. Raya Tahunan No. 12, Tahunan, Jepara, Jawa Tengah", "lat": -6.6106, "lng": 110.6776, "maps_url": ""}},
]


async def seed_partners(database):
    users = database.users
    await users.update_many({"primary_role": "contractor_buyer"}, {"$set": {"primary_role": "buyer"}})
    await users.update_many({"active_role": "contractor_buyer"}, {"$set": {"active_role": "buyer"}})
    await users.update_many({"enabled_roles": "contractor_buyer"}, {"$addToSet": {"enabled_roles": "buyer"}})
    await users.update_many({"enabled_roles": "contractor_buyer"}, {"$pull": {"enabled_roles": "contractor_buyer"}})
    await users.update_many({"$or": [{"primary_role": None}, {"primary_role": {"$exists": False}}]},
                            {"$set": {"primary_role": "buyer", "active_role": "buyer"}})
    await users.update_many({"enabled_roles": {"$ne": "buyer"}}, {"$addToSet": {"enabled_roles": "buyer"}})
    seeded = {"status": "VERIFIED", "seeded": True, "submitted_at": now_iso(), "decided_by": "Seed MatShop", "decided_at": now_iso()}
    for uid, roles in SEED_VERIFIED.items():
        for role in roles:
            await users.update_one({"user_id": uid, f"role_verifications.{role}": {"$exists": False}},
                                   {"$set": {f"role_verifications.{role}": seeded}, "$addToSet": {"enabled_roles": role}})
    for p in SEED_PENDING:
        if not await users.find_one({"user_id": p["user_id"]}):
            await users.insert_one({"user_id": p["user_id"], "email": p["email"], "name": p["name"], "picture": "", "primary_role": "buyer",
                                    "enabled_roles": ["buyer", p["role"]], "active_role": p["role"], "created_at": now_iso(),
                                    "role_verifications": {p["role"]: {**p["data"], "status": PENDING[p["role"]], "submitted_at": now_iso(),
                                                                       "note": None, "survey": None, "survey_history": [], "reschedule_request": None}}})
