"""Backend tests for Managed Open-Bid Custom Furniture / Fit-Out module.
Updated for iteration 17: uses new `dims` request body (cm) instead of legacy `size`.
"""
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


# ---------- Public config & estimate ----------
def test_public_config():
    r = requests.get(f"{API}/custom/config", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert "work_types" in d and "finishings" in d and "modes" in d
    keys = {t["key"] for t in d["work_types"]}
    # all 4 seeded types should be active
    assert {"kitchen_set", "wardrobe", "full_interior", "wall_finish"} <= keys
    fins = {f["key"] for f in d["finishings"]}
    assert {"hpl", "duco"} <= fins
    # order ascending
    orders = [t["order"] for t in d["work_types"]]
    assert orders == sorted(orders)


def test_meta_still_returns_milestones():
    r = requests.get(f"{API}/custom/meta", timeout=20)
    assert r.status_code == 200
    assert [m["pct"] for m in r.json()["milestones"]] == [30, 40, 30]


# cabinet mode (kitchen_set) — P 300 L 60 T 240 cm -> p=3, fL=1 (L<=60), fT=240/100=2.4 -> qty=7.2
def test_estimate_kitchen_hpl_standard():
    r = requests.post(f"{API}/custom/estimate", json={
        "work_type": "kitchen_set", "finishing": "hpl",
        "dims": {"p": 300, "l": 60, "t": 240},
    }, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["qty"] == 7.2
    assert d["min"] == round(2_500_000 * 7.2)
    assert d["max"] == round(3_500_000 * 7.2)
    assert d["warning"] is None
    assert d["unit_label"] == "meter lari"


# fL=1.5 branch when 60 < L <= 100
def test_estimate_factor_l_15():
    r = requests.post(f"{API}/custom/estimate", json={
        "work_type": "kitchen_set", "finishing": "hpl",
        "dims": {"p": 300, "l": 80, "t": 240},
    }, timeout=20)
    assert r.status_code == 200
    d = r.json()
    # p=3, fL=1.5, fT=2.4 -> 10.8
    assert d["qty"] == 10.8


# L>100 -> warning and null min/max
def test_estimate_wide_warning():
    r = requests.post(f"{API}/custom/estimate", json={
        "work_type": "kitchen_set", "finishing": "hpl",
        "dims": {"p": 300, "l": 110, "t": 240},
    }, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["warning"]
    assert d["min"] is None and d["max"] is None


# T<100 -> fT=1
def test_estimate_ft_floor():
    r = requests.post(f"{API}/custom/estimate", json={
        "work_type": "kitchen_set", "finishing": "hpl",
        "dims": {"p": 300, "l": 60, "t": 85},
    }, timeout=20)
    assert r.status_code == 200
    d = r.json()
    # p=3, fL=1, fT=1 -> 3
    assert d["qty"] == 3.0


# surface mode small side -> Unit/Set label (wall_finish): P=80 T=250 -> p=max(0.8,1)=1, t=2.5 -> 2.5
def test_estimate_surface_small_side_unitset():
    r = requests.post(f"{API}/custom/estimate", json={
        "work_type": "wall_finish", "finishing": "hpl",
        "dims": {"p": 80, "t": 250},
    }, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["qty"] == 2.5
    assert d["unit_label"] == "Unit/Set"


# surface normal -> m² label (default wall_finish unit)
def test_estimate_surface_m2():
    r = requests.post(f"{API}/custom/estimate", json={
        "work_type": "wall_finish", "finishing": "hpl",
        "dims": {"p": 300, "t": 250},
    }, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["qty"] == 7.5
    assert d["unit_label"] == "m²"


# area mode (full_interior)
def test_estimate_area_full_interior():
    r = requests.post(f"{API}/custom/estimate", json={
        "work_type": "full_interior", "finishing": "hpl",
        "dims": {"area": 36},
    }, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["qty"] == 36
    assert d["min"] == round(2_500_000 * 36)
    assert d["max"] == round(4_000_000 * 36)


def test_estimate_missing_dims_400():
    # cabinet mode without l
    r = requests.post(f"{API}/custom/estimate", json={
        "work_type": "kitchen_set", "finishing": "hpl",
        "dims": {"p": 300, "t": 240},
    }, timeout=20)
    assert r.status_code == 400


def test_estimate_area_missing_400():
    r = requests.post(f"{API}/custom/estimate", json={
        "work_type": "full_interior", "finishing": "hpl",
        "dims": {"p": 300},
    }, timeout=20)
    assert r.status_code == 400


def test_estimate_finishing_not_allowed_400(admin):
    sess, _ = admin
    # create a work type that only accepts hpl, then try to estimate with duco
    r = sess.post(f"{API}/admin/custom-work-types", json={
        "label": "TEST_OnlyHPL", "mode": "area", "unit_label": "m²",
        "finishings": ["hpl"], "rates": {"hpl": {"min": 100000, "max": 200000}}, "active": True,
    }, timeout=20)
    assert r.status_code == 200, r.text
    key = r.json()["key"]
    try:
        r2 = requests.post(f"{API}/custom/estimate", json={
            "work_type": key, "finishing": "duco", "dims": {"area": 10},
        }, timeout=20)
        assert r2.status_code == 400
    finally:
        sess.delete(f"{API}/admin/custom-work-types/{key}", timeout=20)


def test_estimate_inactive_type_400(admin):
    sess, _ = admin
    r = sess.post(f"{API}/admin/custom-work-types", json={
        "label": "TEST_Inactive", "mode": "area", "unit_label": "m²",
        "finishings": ["hpl"], "rates": {"hpl": {"min": 100000, "max": 200000}}, "active": False,
    }, timeout=20)
    assert r.status_code == 200
    key = r.json()["key"]
    try:
        r2 = requests.post(f"{API}/custom/estimate", json={
            "work_type": key, "finishing": "hpl", "dims": {"area": 10},
        }, timeout=20)
        assert r2.status_code == 400
    finally:
        sess.delete(f"{API}/admin/custom-work-types/{key}", timeout=20)


def test_estimate_unknown_type_400():
    r = requests.post(f"{API}/custom/estimate", json={
        "work_type": "nope", "finishing": "hpl", "dims": {"area": 10},
    }, timeout=20)
    assert r.status_code == 400


# ---------- Admin config endpoints ----------
def test_admin_config_requires_admin(buyer):
    sess, _ = buyer
    r = sess.get(f"{API}/admin/custom-config", timeout=20)
    assert r.status_code == 403


def test_admin_config_has_usage(admin):
    sess, _ = admin
    r = sess.get(f"{API}/admin/custom-config", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert any("usage" in t for t in d["work_types"])
    assert any("usage" in f for f in d["finishings"])


def test_admin_wt_validation(admin):
    sess, _ = admin
    # bad mode
    r = sess.post(f"{API}/admin/custom-work-types", json={
        "label": "TEST_BadMode", "mode": "bogus", "unit_label": "m",
        "finishings": ["hpl"], "rates": {"hpl": {"min": 1, "max": 2}},
    }, timeout=20)
    assert r.status_code == 400
    # unknown finishing
    r = sess.post(f"{API}/admin/custom-work-types", json={
        "label": "TEST_UnknownFin", "mode": "area", "unit_label": "m²",
        "finishings": ["xxyy"], "rates": {"xxyy": {"min": 1, "max": 2}},
    }, timeout=20)
    assert r.status_code == 400
    # min > max
    r = sess.post(f"{API}/admin/custom-work-types", json={
        "label": "TEST_BadRange", "mode": "area", "unit_label": "m²",
        "finishings": ["hpl"], "rates": {"hpl": {"min": 500, "max": 100}},
    }, timeout=20)
    assert r.status_code == 400


def test_admin_finishing_crud_and_delete_prunes_types(admin):
    sess, _ = admin
    # Create finishing "Melamin"
    r = sess.post(f"{API}/admin/custom-finishings", json={
        "label": "TEST_Melamin", "desc": "test", "active": True,
    }, timeout=20)
    assert r.status_code == 200
    fkey = r.json()["key"]
    # Create a type using it
    r = sess.post(f"{API}/admin/custom-work-types", json={
        "label": "TEST_WithMelamin", "mode": "area", "unit_label": "m²",
        "finishings": [fkey], "rates": {fkey: {"min": 1000, "max": 2000}},
    }, timeout=20)
    assert r.status_code == 200
    tkey = r.json()["key"]
    # Appears in public config
    cfg = requests.get(f"{API}/custom/config", timeout=20).json()
    assert fkey in {f["key"] for f in cfg["finishings"]}
    assert any(t["key"] == tkey and fkey in t["finishings"] for t in cfg["work_types"])
    # Delete finishing -> prunes from type
    r = sess.delete(f"{API}/admin/custom-finishings/{fkey}", timeout=20)
    assert r.status_code == 200
    cfg = sess.get(f"{API}/admin/custom-config", timeout=20).json()
    for t in cfg["work_types"]:
        if t["key"] == tkey:
            assert fkey not in t["finishings"]
            assert fkey not in (t.get("rates") or {})
    sess.delete(f"{API}/admin/custom-work-types/{tkey}", timeout=20)


def test_admin_reorder(admin):
    sess, _ = admin
    cfg = sess.get(f"{API}/admin/custom-config", timeout=20).json()
    orig = [t["key"] for t in cfg["work_types"]]
    reversed_keys = list(reversed(orig))
    r = sess.post(f"{API}/admin/custom-config/reorder", json={"kind": "work_types", "keys": reversed_keys}, timeout=20)
    assert r.status_code == 200
    cfg2 = sess.get(f"{API}/admin/custom-config", timeout=20).json()
    assert [t["key"] for t in cfg2["work_types"]] == reversed_keys
    # restore
    sess.post(f"{API}/admin/custom-config/reorder", json={"kind": "work_types", "keys": orig}, timeout=20)


# ---------- Project create (new dims) ----------
_cache = {}


def _create_project(sess, title_suffix="", with_dims=True):
    body = {
        "work_type": "kitchen_set", "finishing": "hpl", "budget": 12_000_000,
        "title": f"TEST_Kitchen {title_suffix}".strip(),
        "description": "Butuh kitchen set bentuk L dengan rak atas dan bawah untuk testing.",
        "address": "Jl. Testing No. 1 Kebayoran",
        "city": "Jakarta Selatan", "phone": "081234567890",
        "survey_date": "2026-02-01", "photos": [],
    }
    if with_dims:
        body["dims"] = {"p": 300, "l": 60, "t": 240}
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


def test_create_project_with_dims(buyer):
    sess, _ = buyer
    p = _create_project(sess, "dims")
    _cache["id"] = p["project_id"]
    assert p["status"] == "pending_review"
    assert p["size"] == 7.2
    assert p["work_type_label"] == "Kitchen Set"
    assert p["finishing_label"] == "HPL"
    assert p["unit_label"] == "meter lari"
    assert "cm" in p["size_label"]
    assert p["estimate_min"] == round(2_500_000 * 7.2)
    assert p["bid_count"] == 0


def test_create_project_without_dims_still_works(buyer):
    sess, _ = buyer
    p = _create_project(sess, "nodims", with_dims=False)
    assert p["status"] == "pending_review"
    assert p["size"] is None
    assert p["work_type_label"] == "Kitchen Set"
    _cache["nodims_id"] = p["project_id"]
    # cancel to clean
    sess.post(f"{API}/custom/projects/{p['project_id']}/cancel", timeout=20)


# ---------- Admin flow (approve, bid, award) — minimal regression ----------
def test_admin_approve_opens(admin):
    sess, _ = admin
    r = sess.post(f"{API}/custom/admin/projects/{_cache['id']}/approve", json={"note": "ok"}, timeout=20)
    assert r.status_code == 200
    assert r.json()["status"] == "open"


def test_opportunities_lists_approved(supplier):
    sess, _ = supplier
    r = sess.get(f"{API}/custom/opportunities", timeout=20)
    assert r.status_code == 200
    found = [d for d in r.json() if d["project_id"] == _cache["id"]]
    assert len(found) == 1
    # label visible
    assert found[0].get("work_type_label") == "Kitchen Set"


def test_submit_bid(supplier):
    sess, _ = supplier
    r = sess.post(f"{API}/custom/projects/{_cache['id']}/bids", json={
        "duration_days": 25, "notes": "ok",
        "material_spec": "Plywood 18mm + HPL Taco standard",
        "rab_items": [{"item": "Full kitchen set", "qty": 1, "unit": "ls", "price": 12_000_000}],
    }, timeout=20)
    assert r.status_code == 200, r.text
    _cache["bid_id"] = r.json()["bid_id"]


def test_accept_bid_awarded(buyer):
    sess, _ = buyer
    r = sess.post(f"{API}/custom/projects/{_cache['id']}/bids/{_cache['bid_id']}/accept", timeout=20)
    assert r.status_code == 200
    assert r.json()["status"] == "awarded"


# ---------- Cleanup fixture ----------
@pytest.fixture(scope="module", autouse=True)
def cleanup_at_end(admin):
    yield
    sess, _ = admin
    # Delete any residual TEST_ custom work types / finishings
    cfg = sess.get(f"{API}/admin/custom-config", timeout=20).json()
    for t in cfg.get("work_types", []):
        if t["label"].startswith("TEST_"):
            sess.delete(f"{API}/admin/custom-work-types/{t['key']}", timeout=20)
    for f in cfg.get("finishings", []):
        if f["label"].startswith("TEST_"):
            sess.delete(f"{API}/admin/custom-finishings/{f['key']}", timeout=20)
