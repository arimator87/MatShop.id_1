import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api")
ctx = {}

WORK_TYPES = {
    "kitchen_set": "Kitchen Set", "wardrobe": "Wardrobe / Lemari", "fit_out": "Fit-Out",
    "interior": "Desain Interior", "desain_3d": "Desain 3D & Render", "arsitektur": "Arsitektur",
    "furniture": "Furniture Custom", "material": "Supply Material",
}
VENDOR_FILTER = {"verification_status": "VERIFIED", "suspended": {"$ne": True}, "business_profile.photos.0": {"$exists": True}}


class ReviewIn(BaseModel):
    source: str
    ref_id: str
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=10, max_length=1000)
    photos: List[str] = Field(default=[], max_length=4)


class AdminReviewIn(BaseModel):
    vendor_id: str
    reviewer_name: str = Field(min_length=2)
    subject: str = Field(min_length=3)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=10, max_length=1000)
    photos: List[str] = Field(default=[], max_length=4)


REPORT_REASONS = {"spam": "Spam", "abusive": "Kata kasar", "not_client": "Bukan klien saya", "false_info": "Info palsu", "other": "Lainnya"}


class ReportIn(BaseModel):
    reason: str
    note: str = Field(default="", max_length=500)


class ResolveReportIn(BaseModel):
    action: str
    note: str = Field(default="", max_length=500)


class ReplyIn(BaseModel):
    text: str = Field(min_length=3, max_length=1000)


def db():
    return ctx["db"]


def city_of(bp):
    return (bp.get("city") or bp["address"].split(",")[-1]).strip()


async def rating_stats(vendor_ids):
    rows = await db().reviews.aggregate([
        {"$match": {"vendor_id": {"$in": vendor_ids}, "hidden": {"$ne": True}}},
        {"$group": {"_id": "$vendor_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}]).to_list(None)
    return {r["_id"]: (round(r["avg"], 1), r["count"]) for r in rows}


async def done_count(uid):
    return (await db().custom_projects.count_documents({"vendor_id": uid, "status": "completed"}),
            await db().orders.count_documents({"seller_id": uid, "status": "released"}),
            await db().reviews.count_documents({"vendor_id": uid, "source": {"$in": ["admin", "seed"]}, "hidden": {"$ne": True}}))


def is_top(avg, count, done):
    return avg >= 4.5 and count >= 3 and done >= 3


async def badges(ids):
    stats = await rating_stats(ids)
    out = {}
    for uid in set(ids):
        avg, count = stats.get(uid, (0, 0))
        out[uid] = {"rating": avg, "review_count": count, "top_rated": is_top(avg, count, sum(await done_count(uid)))}
    return out


async def summary(u, stats):
    bp = u["business_profile"]
    avg, count = stats.get(u["user_id"], (0, 0))
    projects, orders, offline = await done_count(u["user_id"])
    return {"top_rated": is_top(avg, count, projects + orders + offline), "completed_total": projects + orders + offline,
            "offline_projects": offline, "user_id": u["user_id"], "business_name": bp["business_name"], "address": bp["address"], "city": city_of(bp),
            "work_types": bp.get("work_types", []), "portfolio_url": bp["portfolio_url"], "photos": bp["photos"],
            "primary_role": u.get("primary_role"), "rating_avg": avg, "review_count": count,
            "completed_projects": projects, "completed_orders": orders,
            "listings": await db().listings.count_documents({"owner_id": u["user_id"], "is_active": True})}


@router.get("/portfolios/filters")
async def portfolio_filters():
    docs = await db().users.find(VENDOR_FILTER, {"_id": 0, "business_profile": 1}).to_list(500)
    return {"cities": sorted({city_of(d["business_profile"]) for d in docs}), "work_types": WORK_TYPES}


@router.get("/portfolios")
async def portfolios(limit: int = Query(12, le=50), city: Optional[str] = None, work_type: Optional[str] = None, sort: str = "featured",
                     top_rated: bool = False):
    docs = await db().users.find(VENDOR_FILTER, {"_id": 0}).to_list(500)
    if city:
        docs = [d for d in docs if city_of(d["business_profile"]).lower() == city.lower()]
    if work_type:
        docs = [d for d in docs if work_type in d["business_profile"].get("work_types", [])]
    stats = await rating_stats([d["user_id"] for d in docs])
    out = [await summary(d, stats) for d in docs]
    if top_rated:
        out = [x for x in out if x["top_rated"]]
    if sort == "rating":
        out.sort(key=lambda x: (-x["rating_avg"], -x["review_count"]))
    else:
        out.sort(key=lambda x: (-len(x["photos"]), -x["completed_projects"]))
    return out[:limit]


@router.get("/vendors/{user_id}")
async def vendor_profile(user_id: str):
    u = await db().users.find_one({**VENDOR_FILTER, "user_id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(404, "Profil vendor tidak ditemukan")
    out = await summary(u, await rating_stats([user_id]))
    reviews = await db().reviews.find({"vendor_id": user_id, "hidden": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).to_list(100)
    out["breakdown"] = {s: sum(1 for r in reviews if r["rating"] == s) for s in range(5, 0, -1)}
    out["reviews"] = reviews
    return out


async def resolve_ref(source, ref_id, user):
    if source == "order":
        o = await db().orders.find_one({"order_id": ref_id}, {"_id": 0})
        if not o or o["buyer_id"] != user.user_id:
            raise HTTPException(404, "Pesanan tidak ditemukan")
        if o["status"] != "released":
            raise HTTPException(400, "Ulasan hanya untuk pesanan yang sudah selesai (COMPLETED)")
        return o["seller_id"], ", ".join(i["title"] for i in o["items"])[:120]
    if source == "project":
        p = await db().custom_projects.find_one({"project_id": ref_id}, {"_id": 0})
        if not p or p["client_id"] != user.user_id:
            raise HTTPException(404, "Proyek tidak ditemukan")
        if p["status"] != "completed":
            raise HTTPException(400, "Ulasan hanya untuk proyek yang sudah serah terima")
        return p["vendor_id"], p["title"]
    raise HTTPException(400, "Sumber ulasan tidak valid")


@router.post("/reviews")
async def create_review(body: ReviewIn, request: Request):
    user = await ctx["get_user"](request)
    vendor_id, subject = await resolve_ref(body.source, body.ref_id, user)
    if await db().reviews.find_one({"source": body.source, "ref_id": body.ref_id}):
        raise HTTPException(400, "Transaksi ini sudah diulas")
    doc = {"review_id": f"rev_{uuid.uuid4().hex[:12]}", "vendor_id": vendor_id, "reviewer_id": user.user_id,
           "reviewer_name": user.name, "source": body.source, "ref_id": body.ref_id, "subject": subject,
           "rating": body.rating, "comment": body.comment.strip(), "photos": body.photos, "reply": None, "created_at": datetime.now(timezone.utc).isoformat()}
    await db().reviews.insert_one(dict(doc))
    await ctx["notify"](vendor_id, f"Ulasan baru ★{body.rating}", f"{user.name}: {body.comment[:80]}", f"/vendor/{vendor_id}")
    return doc


@router.get("/reviews/ref/{ref_id}")
async def review_for_ref(ref_id: str, request: Request):
    await ctx["get_user"](request)
    return await db().reviews.find_one({"ref_id": ref_id}, {"_id": 0})


@router.put("/reviews/{review_id}/reply")
async def reply_review(review_id: str, body: ReplyIn, request: Request):
    user = await ctx["get_user"](request)
    r = await db().reviews.find_one({"review_id": review_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Ulasan tidak ditemukan")
    if r["vendor_id"] != user.user_id:
        raise HTTPException(403, "Hanya vendor terkait yang dapat membalas")
    now = datetime.now(timezone.utc).isoformat()
    reply = {"text": body.text.strip(), "at": (r.get("reply") or {}).get("at", now), "edited_at": now if r.get("reply") else None}
    await db().reviews.update_one({"review_id": review_id}, {"$set": {"reply": reply}})
    if r["reviewer_id"] != "seed":
        await ctx["notify"](r["reviewer_id"], "Vendor membalas ulasan Anda", f"{user.name}: {body.text[:80]}", f"/vendor/{user.user_id}")
    return {**r, "reply": reply}


async def require_admin(request):
    user = await ctx["get_user"](request)
    if not user.is_admin:
        raise HTTPException(403, "Khusus admin MatShop")
    return user


@router.post("/admin/reviews")
async def admin_add_review(body: AdminReviewIn, request: Request):
    admin = await require_admin(request)
    if not await db().users.find_one({**VENDOR_FILTER, "user_id": body.vendor_id}):
        raise HTTPException(404, "Vendor terverifikasi tidak ditemukan")
    rid = f"rev_{uuid.uuid4().hex[:12]}"
    doc = {"review_id": rid, "vendor_id": body.vendor_id, "reviewer_id": "admin", "reviewer_name": body.reviewer_name.strip(),
           "source": "admin", "ref_id": f"admin_{rid}", "subject": body.subject.strip(), "rating": body.rating,
           "comment": body.comment.strip(), "photos": body.photos, "reply": None, "added_by": admin.name,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db().reviews.insert_one(dict(doc))
    await ctx["notify"](body.vendor_id, f"Ulasan proyek offline ★{body.rating}", f"Ditambahkan tim MatShop: {body.subject}", f"/vendor/{body.vendor_id}")
    return doc


@router.get("/admin/reviews")
async def admin_list_reviews(request: Request):
    await require_admin(request)
    return await db().reviews.find({"source": "admin"}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.delete("/admin/reviews/{review_id}")
async def admin_delete_review(review_id: str, request: Request):
    await require_admin(request)
    res = await db().reviews.delete_one({"review_id": review_id})
    if not res.deleted_count:
        raise HTTPException(404, "Ulasan tidak ditemukan")
    return {"ok": True}


@router.post("/reviews/{review_id}/report")
async def report_review(review_id: str, body: ReportIn, request: Request):
    user = await ctx["get_user"](request)
    if body.reason not in REPORT_REASONS:
        raise HTTPException(400, "Alasan laporan tidak valid")
    r = await db().reviews.find_one({"review_id": review_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Ulasan tidak ditemukan")
    if r["vendor_id"] != user.user_id:
        raise HTTPException(403, "Hanya vendor terkait yang dapat melaporkan ulasan")
    if r.get("report"):
        raise HTTPException(400, "Ulasan ini sudah pernah dilaporkan")
    report = {"reason": body.reason, "reason_label": REPORT_REASONS[body.reason], "note": body.note.strip(), "status": "pending",
              "reporter_name": user.name, "at": datetime.now(timezone.utc).isoformat()}
    await db().reviews.update_one({"review_id": review_id}, {"$set": {"report": report}})
    return {**r, "report": report}


@router.get("/admin/review-reports")
async def admin_review_reports(request: Request, status: str = "pending"):
    await require_admin(request)
    flt = {"report": {"$ne": None}} if status == "all" else {"report.status": status}
    return await db().reviews.find(flt, {"_id": 0}).sort("report.at", -1).to_list(200)


@router.post("/admin/review-reports/{review_id}/resolve")
async def admin_resolve_report(review_id: str, body: ResolveReportIn, request: Request):
    admin = await require_admin(request)
    if body.action not in ("hide", "reject"):
        raise HTTPException(400, "Aksi tidak valid")
    r = await db().reviews.find_one({"review_id": review_id, "report.status": "pending"}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Laporan menunggu tidak ditemukan")
    hide = body.action == "hide"
    sets = {"report.status": "hidden" if hide else "rejected", "report.resolved_by": admin.name, "report.admin_note": body.note.strip(),
            "report.resolved_at": datetime.now(timezone.utc).isoformat(), "hidden": hide}
    await db().reviews.update_one({"review_id": review_id}, {"$set": sets})
    await ctx["notify"](r["vendor_id"], "Laporan ulasan disetujui" if hide else "Laporan ulasan ditolak",
                        ("Ulasan disembunyikan dari profil Anda." if hide else "Ulasan tetap ditampilkan.") + (f" Catatan: {body.note}" if body.note else ""),
                        f"/vendor/{r['vendor_id']}")
    return await db().reviews.find_one({"review_id": review_id}, {"_id": 0})


@router.get("/favorites")
async def list_favorites(request: Request):
    user = await ctx["get_user"](request)
    docs = await db().users.find({**VENDOR_FILTER, "user_id": {"$in": user.favorite_vendor_ids}}, {"_id": 0}).to_list(200)
    stats = await rating_stats([d["user_id"] for d in docs])
    return [await summary(d, stats) for d in docs]


@router.post("/favorites/{vendor_id}")
async def toggle_favorite(vendor_id: str, request: Request):
    user = await ctx["get_user"](request)
    fav = vendor_id in user.favorite_vendor_ids
    if not fav and not await db().users.find_one({**VENDOR_FILTER, "user_id": vendor_id}):
        raise HTTPException(404, "Vendor terverifikasi tidak ditemukan")
    if vendor_id == user.user_id:
        raise HTTPException(400, "Tidak bisa memfavoritkan diri sendiri")
    await db().users.update_one({"user_id": user.user_id}, {"$pull" if fav else "$addToSet": {"favorite_vendor_ids": vendor_id}})
    ids = [i for i in user.favorite_vendor_ids if i != vendor_id] if fav else [*user.favorite_vendor_ids, vendor_id]
    return {"favorite": not fav, "favorite_vendor_ids": ids}
