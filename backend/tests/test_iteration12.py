"""Iteration 12 — Bid Compare (Bandingkan Penawaran)
Tests that GET /api/custom/projects/{id} returns `vendor_verified` on each bid
alongside the other vendor meta (rating/review_count/top_rated), and that the
compare-related multi-vendor bid flow still functions (accept + m1 pay).
"""
import os
import time
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://matshop-3.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

mongo = MongoClient(MONGO_URL)[DB_NAME]


def _demo(role):
    r = requests.post(f"{BASE_URL}/api/auth/demo", json={"role": role}, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _mkverified_vendor(label):
    """Create a VERIFIED vendor + session directly in Mongo, return (user_id, token)."""
    uid = f"test-vcmp-{label}-{uuid.uuid4().hex[:6]}"
    token = f"test_sess_{uuid.uuid4().hex}"
    mongo.users.insert_one({
        "user_id": uid,
        "email": f"{uid}@example.com",
        "name": f"TEST Vendor {label.upper()}",
        "picture": "",
        "primary_role": "supplier_vendor",
        "enabled_roles": ["supplier_vendor", "contractor_buyer"],
        "active_role": "supplier_vendor",
        "verification_status": "VERIFIED",
        "business_profile": {"name": f"TEST Vendor {label.upper()}", "type": "workshop"},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo.user_sessions.insert_one({
        "user_id": uid, "session_token": token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
        "created_at": datetime.now(timezone.utc),
    })
    return uid, token


@pytest.fixture(scope="module")
def tokens():
    return {
        "client": _demo("contractor_buyer"),
        "supplier": _demo("supplier_vendor"),
        "designer": _demo("designer_creator"),
        "admin": _demo("admin"),
    }


@pytest.fixture(scope="module")
def extra_vendors():
    created = [_mkverified_vendor("a"), _mkverified_vendor("b")]
    yield created
    for uid, _ in created:
        mongo.users.delete_one({"user_id": uid})
        mongo.user_sessions.delete_many({"user_id": uid})


@pytest.fixture(scope="module")
def project(tokens, extra_vendors):
    # 1. Client creates project
    payload = {
        "work_type": "kitchen_set", "budget": 50_000_000, "size": 4, "finishing": "hpl",
        "title": "TEST Iter12 Compare", "description": "Testing bandingkan penawaran feature",
        "address": "Jl. Tes Compare No. 12", "city": "Jakarta", "phone": "08123456789",
    }
    r = requests.post(f"{BASE_URL}/api/custom/projects", json=payload, headers=_h(tokens["client"]), timeout=15)
    assert r.status_code == 200, r.text
    pid = r.json()["project_id"]
    # 2. Admin approves
    r = requests.post(f"{BASE_URL}/api/custom/admin/projects/{pid}/approve",
                      json={"note": ""}, headers=_h(tokens["admin"]), timeout=15)
    assert r.status_code == 200, r.text
    # 3. 4 vendors submit bids with distinct amounts/durations
    bids = [
        (tokens["supplier"], 10, [{"item": "Kabinet HPL", "qty": 4, "unit": "m", "price": 2_500_000}]),  # 10M, 10d
        (tokens["designer"], 15, [{"item": "Kabinet HPL", "qty": 4, "unit": "m", "price": 3_000_000}]),  # 12M, 15d
        (extra_vendors[0][1], 20, [{"item": "Kabinet HPL", "qty": 4, "unit": "m", "price": 3_500_000}]),  # 14M, 20d
        (extra_vendors[1][1], 8,  [{"item": "Kabinet HPL", "qty": 4, "unit": "m", "price": 4_000_000}]),  # 16M, 8d
    ]
    for tok, dur, items in bids:
        r = requests.post(f"{BASE_URL}/api/custom/projects/{pid}/bids",
                          json={"duration_days": dur, "notes": "test", "material_spec": "HPL TACO",
                                "rab_items": items}, headers=_h(tok), timeout=15)
        assert r.status_code == 200, r.text
    yield pid
    # cleanup — set cancelled to flag as test data; leave bids
    mongo.custom_projects.update_one({"project_id": pid}, {"$set": {"status": "cancelled"}})


# -----------------------------
# Backend: vendor_verified field
# -----------------------------

def test_get_project_bids_include_vendor_verified(tokens, project):
    r = requests.get(f"{BASE_URL}/api/custom/projects/{project}", headers=_h(tokens["client"]), timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["viewer"] == "client"
    assert len(data["bids"]) == 4
    for b in data["bids"]:
        assert "vendor_verified" in b, f"missing vendor_verified in bid {b.get('bid_id')}"
        assert isinstance(b["vendor_verified"], bool)
        assert "vendor_rating" in b
        assert "vendor_review_count" in b
        assert "vendor_top_rated" in b
    # All submitting vendors are VERIFIED in this test
    assert all(b["vendor_verified"] is True for b in data["bids"]), [b["vendor_verified"] for b in data["bids"]]


def test_bids_sorted_by_amount_asc(tokens, project):
    r = requests.get(f"{BASE_URL}/api/custom/projects/{project}", headers=_h(tokens["client"]), timeout=15)
    amounts = [b["amount"] for b in r.json()["bids"]]
    assert amounts == sorted(amounts), amounts


def test_vendor_viewer_sees_only_own_bid_still_has_verified(tokens, project):
    r = requests.get(f"{BASE_URL}/api/custom/projects/{project}", headers=_h(tokens["supplier"]), timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["viewer"] == "bidder"
    assert len(data["bids"]) == 1
    assert "vendor_verified" in data["bids"][0]


def test_accept_bid_then_m1_pay_flow(tokens, project):
    # Pick cheapest bid (supplier at 10M), accept, pay m1
    r = requests.get(f"{BASE_URL}/api/custom/projects/{project}", headers=_h(tokens["client"]), timeout=15)
    bids = r.json()["bids"]
    cheapest = min(bids, key=lambda b: b["amount"])
    r = requests.post(
        f"{BASE_URL}/api/custom/projects/{project}/bids/{cheapest['bid_id']}/accept",
        headers=_h(tokens["client"]), timeout=15,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "awarded"
    # Pay m1
    r = requests.post(
        f"{BASE_URL}/api/custom/projects/{project}/milestones/m1/pay",
        headers=_h(tokens["client"]), timeout=15,
    )
    assert r.status_code == 200, r.text
    p = r.json()
    m1 = next(m for m in p["milestones"] if m["key"] == "m1")
    assert m1["status"] == "held"


def test_cannot_accept_after_awarded(tokens, project):
    r = requests.get(f"{BASE_URL}/api/custom/projects/{project}", headers=_h(tokens["client"]), timeout=15)
    other = [b for b in r.json()["bids"] if b["status"] == "rejected"][0]
    r = requests.post(
        f"{BASE_URL}/api/custom/projects/{project}/bids/{other['bid_id']}/accept",
        headers=_h(tokens["client"]), timeout=15,
    )
    assert r.status_code == 400


def test_non_client_viewer_sees_single_or_zero_bids(tokens, project):
    # supplier (now awarded) still sees own bid
    r = requests.get(f"{BASE_URL}/api/custom/projects/{project}", headers=_h(tokens["designer"]), timeout=15)
    assert r.status_code in (200, 403)
    if r.status_code == 200:
        assert len(r.json()["bids"]) <= 1
