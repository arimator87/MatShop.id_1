import uuid
from datetime import datetime, timezone
from typing import Optional
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


def db():
    return ctx["db"]


def city_of(bp):
    return (bp.get("city") or bp["address"].split(",")[-1]).strip()


async def rating_stats(vendor_ids):
    rows = await db().reviews.aggregate([
        {"$match": {"vendor_id": {"$in": vendor_ids}}},
        {"$group": {"_id": "$vendor_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}]).to_list(None)
    return {r["_id"]: (round(r["avg"], 1), r["count"]) for r in rows}


async def summary(u, stats):
    bp = u["business_profile"]
    avg, count = stats.get(u["user_id"], (0, 0))
    return {"user_id": u["user_id"], "business_name": bp["business_name"], "address": bp["address"], "city": city_of(bp),
            "work_types": bp.get("work_types", []), "portfolio_url": bp["portfolio_url"], "photos": bp["photos"],
            "primary_role": u.get("primary_role"), "rating_avg": avg, "review_count": count,
            "completed_projects": await db().custom_projects.count_documents({"vendor_id": u["user_id"], "status": "completed"}),
            "completed_orders": await db().orders.count_documents({"seller_id": u["user_id"], "status": "released"}),
            "listings": await db().listings.count_documents({"owner_id": u["user_id"], "is_active": True})}


@router.get("/portfolios/filters")
async def portfolio_filters():
    docs = await db().users.find(VENDOR_FILTER, {"_id": 0, "business_profile": 1}).to_list(500)
    return {"cities": sorted({city_of(d["business_profile"]) for d in docs}), "work_types": WORK_TYPES}


@router.get("/portfolios")
async def portfolios(limit: int = Query(12, le=50), city: Optional[str] = None, work_type: Optional[str] = None, sort: str = "featured"):
    docs = await db().users.find(VENDOR_FILTER, {"_id": 0}).to_list(500)
    if city:
        docs = [d for d in docs if city_of(d["business_profile"]).lower() == city.lower()]
    if work_type:
        docs = [d for d in docs if work_type in d["business_profile"].get("work_types", [])]
    stats = await rating_stats([d["user_id"] for d in docs])
    out = [await summary(d, stats) for d in docs]
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
    reviews = await db().reviews.find({"vendor_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
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
           "rating": body.rating, "comment": body.comment.strip(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db().reviews.insert_one(dict(doc))
    await ctx["notify"](vendor_id, f"Ulasan baru ★{body.rating}", f"{user.name}: {body.comment[:80]}", f"/vendor/{vendor_id}")
    return doc


@router.get("/reviews/ref/{ref_id}")
async def review_for_ref(ref_id: str, request: Request):
    await ctx["get_user"](request)
    return await db().reviews.find_one({"ref_id": ref_id}, {"_id": 0})
