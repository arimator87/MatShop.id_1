"""Backend tests for Managed Open-Bid Custom Furniture / Fit-Out module (iteration 5)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def demo_session(role):
    s = requests.Session()
    r = s.post(f"{API}/auth/demo", json={"role": role}, timeout=30)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s, r.json()["user"]


@pytest.fixture(scope="module")
def buyer():
    return demo_session("contractor_buyer")


@pytest.fixture(scope="module")
def supplier():
    return demo_session("supplier_vendor")


@pytest.fixture(scope="module")
def designer():
    return demo_session("designer_creator")


@pytest.fixture(scope="module")
def admin():
    return demo_session("admin")


# ---------- Meta & estimate ----------
def test_meta():
    r = requests.get(f"{API}/custom/meta", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert set(d["work_types"]) == {"kitchen_set", "wardrobe", "full_interior"}
    assert set(d["finishing"]) == {"hpl", "duco"}
    assert [m["pct"] for m in d["milestones"]] == [30, 40, 30]


@pytest.mark.parametrize("wt,fin,size,lo,hi", [
    ("kitchen_set", "hpl", 4, 2_500_000 * 4, 3_500_000 * 4),
    ("wardrobe", "duco", 3, 4_500_000 * 3, 6_000_000 * 3),
    ("full_interior", "hpl", 36, 2_500_000 * 36, 4_000_000 * 36),
])
def test_estimate(wt, fin, size, lo, hi):
    r = requests.post(f"{API}/custom/estimate", json={"work_type": wt, "size": size, "finishing": fin}, timeout=20)
    assert r.status_code == 200
    assert r.json()["min"] == lo and r.json()["max"] == hi


def test_estimate_invalid():
    r = requests.post(f"{API}/custom/estimate", json={"work_type": "bad", "size": 1, "finishing": "hpl"}, timeout=20)
    assert r.status_code == 400


# ---------- Project create (now pending_review) ----------
_cache = {}


def _create_project(sess, title_suffix=""):
    body = {
        "work_type": "kitchen_set", "size": 4, "finishing": "hpl",
        "budget": 12_000_000,
        "title": f"TEST_Kitchen 4m HPL {title_suffix}".strip(),
        "description": "Butuh kitchen set bentuk L dengan rak atas dan bawah untuk testing.",
        "address": "Jl. Testing No. 1 Kebayoran",
        "city": "Jakarta Selatan", "phone": "081234567890",
        "survey_date": "2026-02-01", "photos": [],
    }
    r = sess.post(f"{API}/custom/projects", json=body, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def test_create_project_requires_auth():
    r = requests.post(f"{API}/custom/projects", json={
        "work_type": "kitchen_set", "budget": 10_000_000,
        "description": "Valid description here", "address": "Valid address",
        "city": "Jakarta", "phone": "081234567",
    }, timeout=20)
    assert r.status_code == 401


def test_create_project_requires_budget(buyer):
    sess, _ = buyer
    r = sess.post(f"{API}/custom/projects", json={
        "work_type": "kitchen_set",
        "description": "Valid description here",
        "address": "Valid address", "city": "Jakarta", "phone": "081234567",
    }, timeout=20)
    assert r.status_code == 422


def test_create_project_min_length_validation(buyer):
    sess, _ = buyer
    r = sess.post(f"{API}/custom/projects", json={
        "work_type": "kitchen_set", "budget": 10_000_000,
        "description": "short", "address": "x", "city": "x", "phone": "x",
    }, timeout=20)
    assert r.status_code == 422


def test_create_project_pending_review_and_auto_title(buyer):
    sess, user = buyer
    # Create without providing title to test auto-title
    body = {
        "work_type": "full_interior", "budget": 50_000_000,
        "description": "Fit-out apartemen 2BR lengkap untuk auto-title test.",
        "address": "Apartemen Testing Lantai 10 Tower A",
        "city": "Bandung", "phone": "081234567890", "photos": [],
    }
    r = sess.post(f"{API}/custom/projects", json=body, timeout=20)
    assert r.status_code == 200
    p = r.json()
    assert p["status"] == "pending_review"
    assert p["title"] == "Fit-Out Apartemen/Rumah · Bandung"
    assert p["client_id"] == user["user_id"]
    _cache["auto_pid"] = p["project_id"]


def test_create_project_full(buyer):
    sess, _ = buyer
    p = _create_project(sess)
    _cache["id"] = p["project_id"]
    assert p["status"] == "pending_review"
    assert p["estimate_min"] == 2_500_000 * 4
    assert p["bid_count"] == 0


def test_pending_hidden_from_opportunities(buyer, supplier):
    sup_sess, _ = supplier
    r = sup_sess.get(f"{API}/custom/opportunities", timeout=20)
    assert r.status_code == 200
    pid = _cache["id"]
    assert all(d["project_id"] != pid for d in r.json())


def test_client_can_cancel_pending(buyer):
    sess, _ = buyer
    # Cancel the auto-title one
    r = sess.post(f"{API}/custom/projects/{_cache['auto_pid']}/cancel", timeout=20)
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"


# ---------- Admin review ----------
def test_admin_endpoints_require_admin(buyer):
    sess, _ = buyer
    r = sess.get(f"{API}/custom/admin/projects", timeout=20)
    assert r.status_code == 403
    r2 = sess.post(f"{API}/custom/admin/projects/{_cache['id']}/approve", json={"note": ""}, timeout=20)
    assert r2.status_code == 403


def test_admin_lists_pending(admin):
    sess, _ = admin
    r = sess.get(f"{API}/custom/admin/projects?status=pending_review", timeout=20)
    assert r.status_code == 200
    assert any(d["project_id"] == _cache["id"] for d in r.json())


def test_admin_reject_requires_note(admin, buyer):
    sess, _ = admin
    # Create a project to reject
    bsess, _ = buyer
    p = _create_project(bsess, "reject")
    rid = p["project_id"]
    # reject with short note
    r = sess.post(f"{API}/custom/admin/projects/{rid}/reject", json={"note": "no"}, timeout=20)
    assert r.status_code == 400
    r2 = sess.post(f"{API}/custom/admin/projects/{rid}/reject", json={"note": "Dokumen kurang lengkap"}, timeout=20)
    assert r2.status_code == 200
    assert r2.json()["status"] == "rejected"


def test_admin_approve_opens_for_bid(admin):
    sess, _ = admin
    r = sess.post(f"{API}/custom/admin/projects/{_cache['id']}/approve", json={"note": "ok"}, timeout=20)
    assert r.status_code == 200
    assert r.json()["status"] == "open"


def test_approve_twice_fails(admin):
    sess, _ = admin
    r = sess.post(f"{API}/custom/admin/projects/{_cache['id']}/approve", json={"note": ""}, timeout=20)
    assert r.status_code == 400


def test_opportunities_now_lists_approved(supplier):
    sess, _ = supplier
    r = sess.get(f"{API}/custom/opportunities", timeout=20)
    pid = _cache["id"]
    found = [d for d in r.json() if d["project_id"] == pid]
    assert len(found) == 1
    assert "phone" not in found[0]


# ---------- Bidding (requires material_spec) ----------
def test_bid_requires_material_spec(supplier):
    sess, _ = supplier
    r = sess.post(f"{API}/custom/projects/{_cache['id']}/bids", json={
        "duration_days": 14, "notes": "",
        "rab_items": [{"item": "Full", "qty": 1, "unit": "ls", "price": 10_000_000}],
    }, timeout=20)
    assert r.status_code == 422


def test_bid_material_spec_min_length(supplier):
    sess, _ = supplier
    r = sess.post(f"{API}/custom/projects/{_cache['id']}/bids", json={
        "duration_days": 14, "notes": "", "material_spec": "abc",
        "rab_items": [{"item": "Full", "qty": 1, "unit": "ls", "price": 10_000_000}],
    }, timeout=20)
    assert r.status_code == 422


def test_submit_bid_supplier(supplier):
    sess, _ = supplier
    r = sess.post(f"{API}/custom/projects/{_cache['id']}/bids", json={
        "duration_days": 25, "notes": "Pakai plywood 18mm",
        "material_spec": "Plywood 18mm + HPL Taco, engsel Blum, rel full-extension",
        "rab_items": [{"item": "Full kitchen set", "qty": 1, "unit": "ls", "price": 12_000_000}],
    }, timeout=20)
    assert r.status_code == 200
    _cache["bid_id"] = r.json()["bid_id"]
    assert r.json()["amount"] == 12_000_000


def test_submit_bid_designer(designer):
    sess, _ = designer
    r = sess.post(f"{API}/custom/projects/{_cache['id']}/bids", json={
        "duration_days": 20, "notes": "",
        "material_spec": "MDF + Duco finishing, hardware lokal premium",
        "rab_items": [{"item": "All-in", "qty": 1, "unit": "ls", "price": 11_000_000}],
    }, timeout=20)
    assert r.status_code == 200


# ---------- Accept + milestones (DP 30%) ----------
def test_accept_bid_pays_m1(buyer, designer):
    sess, _ = buyer
    pid = _cache["id"]
    bid_id = _cache["bid_id"]
    r = sess.post(f"{API}/custom/projects/{pid}/bids/{bid_id}/accept", timeout=20)
    assert r.status_code == 200
    p = r.json()
    assert p["status"] == "awarded"
    assert p["contract_amount"] == 12_000_000
    assert p["milestones"][0]["amount"] == round(12_000_000 * 0.30)
    # Rejected bid vendor cannot view project
    dsess, _ = designer
    r2 = dsess.get(f"{API}/custom/projects/{pid}", timeout=20)
    assert r2.status_code == 403


# ---------- Notifications ----------
def test_notifications_on_approve_and_bid(buyer):
    sess, _ = buyer
    r = sess.get(f"{API}/notifications", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert "items" in d and "unread" in d
    titles = [i["title"] for i in d["items"]]
    assert any("disetujui" in t.lower() or "penawaran" in t.lower() for t in titles)
    r2 = sess.post(f"{API}/notifications/read-all", timeout=20)
    assert r2.status_code == 200


def test_vendor_notified_on_accept(supplier):
    sess, _ = supplier
    r = sess.get(f"{API}/notifications", timeout=20).json()
    assert any("menang" in i["title"].lower() for i in r["items"])


# ---------- Milestone regression ----------
def test_milestone_flow(buyer, supplier):
    buy, _ = buyer
    sup, _ = supplier
    pid = _cache["id"]
    # Frontend pattern: accept triggers a separate POST /milestones/m1/pay
    r = buy.post(f"{API}/custom/projects/{pid}/milestones/m1/pay", timeout=20)
    assert r.status_code == 200
    assert r.json()["milestones"][0]["status"] == "held"
    # vendor submits m1, client releases
    r = sup.post(f"{API}/custom/projects/{pid}/milestones/m1/submit", json={"note": "Survey done"}, timeout=20)
    assert r.status_code == 200
    r = buy.post(f"{API}/custom/projects/{pid}/milestones/m1/release", timeout=20)
    assert r.status_code == 200
    # m2
    r = buy.post(f"{API}/custom/projects/{pid}/milestones/m2/pay", timeout=20)
    assert r.status_code == 200
    r = sup.post(f"{API}/custom/projects/{pid}/milestones/m2/submit", json={"note": "Fab done"}, timeout=20)
    assert r.status_code == 200
    r = buy.post(f"{API}/custom/projects/{pid}/milestones/m2/release", timeout=20)
    assert r.status_code == 200
    # m3
    r = buy.post(f"{API}/custom/projects/{pid}/milestones/m3/pay", timeout=20)
    assert r.status_code == 200
    r = sup.post(f"{API}/custom/projects/{pid}/milestones/m3/submit", json={"note": "Install done"}, timeout=20)
    assert r.status_code == 200
    r = buy.post(f"{API}/custom/projects/{pid}/milestones/m3/release", timeout=20)
    assert r.status_code == 200
    assert r.json()["status"] == "completed"
