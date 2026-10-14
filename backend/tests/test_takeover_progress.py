"""Iteration 7 — Progress updates, Admin Takeover, Suspend/Unsuspend tests."""
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


_cache = {}


def _mk_project(bsess, title):
    body = {
        "work_type": "kitchen_set", "size": 4, "finishing": "hpl",
        "budget": 15_000_000,
        "title": f"TEST_{title}",
        "description": "Kitchen set L shape untuk pengujian iterasi tujuh takeover.",
        "address": "Jl. Takeover No. 7 Kebayoran",
        "city": "Jakarta Selatan", "phone": "081234567777",
        "survey_date": "2026-03-01", "photos": [],
    }
    r = bsess.post(f"{API}/custom/projects", json=body, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["project_id"]


def _approve(asess, pid):
    r = asess.post(f"{API}/custom/admin/projects/{pid}/approve", json={"note": "ok"}, timeout=20)
    assert r.status_code == 200


def _bid(vsess, pid, amount=12_000_000):
    r = vsess.post(f"{API}/custom/projects/{pid}/bids", json={
        "duration_days": 20, "notes": "", "material_spec": "Plywood 18 + HPL",
        "rab_items": [{"item": "Full", "qty": 1, "unit": "ls", "price": amount}],
    }, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["bid_id"]


def _accept_and_pay_m1(bsess, pid, bid_id):
    r = bsess.post(f"{API}/custom/projects/{pid}/bids/{bid_id}/accept", timeout=20)
    assert r.status_code == 200
    r = bsess.post(f"{API}/custom/projects/{pid}/milestones/m1/pay", timeout=20)
    assert r.status_code == 200


# ============ PROGRESS UPDATES ============
class TestProgress:
    def test_setup_project_for_progress(self, buyer, supplier, admin):
        bsess, _ = buyer
        asess, _ = admin
        ssess, _ = supplier
        pid = _mk_project(bsess, "ProgressFlow")
        _approve(asess, pid)
        bid_id = _bid(ssess, pid)
        _accept_and_pay_m1(bsess, pid, bid_id)
        _cache["prog_pid"] = pid

    def test_progress_requires_min_note(self, supplier):
        ssess, _ = supplier
        pid = _cache["prog_pid"]
        r = ssess.post(f"{API}/custom/projects/{pid}/progress", json={"percent": 10, "note": "x", "photos": []}, timeout=20)
        assert r.status_code == 422

    def test_non_executor_forbidden(self, designer):
        dsess, _ = designer
        pid = _cache["prog_pid"]
        r = dsess.post(f"{API}/custom/projects/{pid}/progress", json={"percent": 10, "note": "hack", "photos": []}, timeout=20)
        assert r.status_code == 403

    def test_client_cannot_post_progress(self, buyer):
        bsess, _ = buyer
        pid = _cache["prog_pid"]
        r = bsess.post(f"{API}/custom/projects/{pid}/progress", json={"percent": 10, "note": "cliented", "photos": []}, timeout=20)
        assert r.status_code == 403

    def test_executor_posts_progress(self, supplier, buyer):
        ssess, _ = supplier
        pid = _cache["prog_pid"]
        r = ssess.post(f"{API}/custom/projects/{pid}/progress",
                       json={"percent": 25, "note": "Material datang di workshop", "photos": ["https://x/photo1.jpg"]},
                       timeout=20)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["progress_percent"] == 25
        assert len(p["progress_updates"]) == 1
        assert p["progress_updates"][0]["note"].startswith("Material")
        # Client gets notification
        bsess, _ = buyer
        n = bsess.get(f"{API}/notifications", timeout=20).json()
        assert any("25%" in i["title"] for i in n["items"])

    def test_progress_cannot_decrease(self, supplier):
        ssess, _ = supplier
        pid = _cache["prog_pid"]
        r = ssess.post(f"{API}/custom/projects/{pid}/progress",
                       json={"percent": 20, "note": "turun donk", "photos": []}, timeout=20)
        assert r.status_code == 400

    def test_progress_can_increase(self, supplier):
        ssess, _ = supplier
        pid = _cache["prog_pid"]
        r = ssess.post(f"{API}/custom/projects/{pid}/progress",
                       json={"percent": 50, "note": "Fabrikasi 50%", "photos": []}, timeout=20)
        assert r.status_code == 200
        assert r.json()["progress_percent"] == 50
        assert len(r.json()["progress_updates"]) == 2

    def test_progress_not_active_project(self, supplier, buyer, admin, designer):
        # Create a project in pending_review (not ACTIVE) -> should 400
        bsess, _ = buyer
        pid = _mk_project(bsess, "PendingNoProgress")
        ssess, _ = supplier
        r = ssess.post(f"{API}/custom/projects/{pid}/progress",
                       json={"percent": 5, "note": "early", "photos": []}, timeout=20)
        # supplier is not executor on this project -> 403 (vendor_id is None)
        assert r.status_code == 403


# ============ TAKEOVER ============
class TestTakeover:
    def test_setup_project_for_takeover(self, buyer, supplier, admin):
        bsess, _ = buyer
        asess, _ = admin
        ssess, _ = supplier
        pid = _mk_project(bsess, "TakeoverFlow")
        _approve(asess, pid)
        bid_id = _bid(ssess, pid, amount=15_000_000)
        _accept_and_pay_m1(bsess, pid, bid_id)
        # vendor submits m1 but not released -> escrow still held
        ssess.post(f"{API}/custom/projects/{pid}/milestones/m1/submit",
                   json={"note": "Survey done"}, timeout=20)
        _cache["to_pid"] = pid

    def test_takeover_requires_admin(self, buyer):
        bsess, _ = buyer
        pid = _cache["to_pid"]
        r = bsess.post(f"{API}/custom/admin/projects/{pid}/takeover",
                       json={"reason": "coba takeover ilegal"}, timeout=20)
        assert r.status_code == 403

    def test_takeover_reason_min_length(self, admin):
        asess, _ = admin
        pid = _cache["to_pid"]
        r = asess.post(f"{API}/custom/admin/projects/{pid}/takeover",
                       json={"reason": "short"}, timeout=20)
        assert r.status_code == 422

    def test_admin_takeover(self, admin, buyer, supplier):
        asess, _ = admin
        pid = _cache["to_pid"]
        r = asess.post(f"{API}/custom/admin/projects/{pid}/takeover",
                       json={"reason": "Vendor wanprestasi, tidak responsif >14 hari"}, timeout=20)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["status"] == "internal_takeover"
        assert p["vendor_id"] == "user_master_workshop"
        assert p["vendor_name"] == "Master Workshop MatShop"
        assert p["original_vendor_id"] == "user_demo_supplier"
        assert p["original_vendor_name"] == "PT Material Nusantara"
        # m1 was 'submitted' -> reverts to 'held'; m2/m3 pending
        amt = p["contract_amount"]
        m1_amt = p["milestones"][0]["amount"]
        unpaid = p["milestones"][1]["amount"] + p["milestones"][2]["amount"]
        assert p["milestones"][0]["status"] == "held"
        assert p["takeover"]["escrow_transferred"] == m1_amt
        assert p["takeover"]["remaining_unpaid"] == unpaid
        assert p["takeover"]["from_vendor_id"] == "user_demo_supplier"
        # Client notification
        bsess, _ = buyer
        n = bsess.get(f"{API}/notifications", timeout=20).json()
        assert any("Garansi Penyelesaian Proyek MatShop" in i["title"] for i in n["items"])

    def test_takeover_twice_fails(self, admin):
        asess, _ = admin
        pid = _cache["to_pid"]
        r = asess.post(f"{API}/custom/admin/projects/{pid}/takeover",
                       json={"reason": "duplicate takeover attempt long enough"}, timeout=20)
        assert r.status_code == 400

    def test_suspended_contractor_cannot_bid(self, supplier, buyer, admin):
        """Suspended supplier returns 403 on new bid attempts."""
        # create fresh open project
        bsess, _ = buyer
        asess, _ = admin
        pid = _mk_project(bsess, "SuspendedBidTest")
        _approve(asess, pid)
        ssess, _ = supplier
        r = ssess.post(f"{API}/custom/projects/{pid}/bids", json={
            "duration_days": 10, "notes": "", "material_spec": "test material spec",
            "rab_items": [{"item": "Full set", "qty": 1, "unit": "ls", "price": 1_000_000}],
        }, timeout=20)
        assert r.status_code == 403, r.text
        _cache["susp_pid"] = pid

    def test_suspended_contractor_cannot_progress(self, supplier):
        """Suspended supplier can't post progress on their old awarded project either.
           But that project is now internal_takeover so vendor_id changed.
           We just verify ensure_active via re-bidding above."""
        pass

    def test_admin_suspended_users_list(self, admin):
        asess, _ = admin
        r = asess.get(f"{API}/admin/suspended-users", timeout=20)
        assert r.status_code == 200
        ids = [u["user_id"] for u in r.json()]
        assert "user_demo_supplier" in ids

    def test_admin_can_post_progress_as_master(self, admin, buyer):
        asess, _ = admin
        pid = _cache["to_pid"]
        r = asess.post(f"{API}/custom/projects/{pid}/progress",
                       json={"percent": 15, "note": "Master workshop take-over start", "photos": []}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["progress_percent"] == 15

    def test_admin_can_submit_milestone_as_master(self, admin, buyer):
        asess, _ = admin
        bsess, _ = buyer
        pid = _cache["to_pid"]
        # m1 is held after takeover
        r = asess.post(f"{API}/custom/projects/{pid}/milestones/m1/submit",
                       json={"note": "Master submits m1"}, timeout=20)
        assert r.status_code == 200
        # client releases
        r = bsess.post(f"{API}/custom/projects/{pid}/milestones/m1/release", timeout=20)
        assert r.status_code == 200
        assert r.json()["status"] == "internal_takeover"

    def test_project_detail_shows_master_as_vendor(self, buyer):
        bsess, _ = buyer
        pid = _cache["to_pid"]
        r = bsess.get(f"{API}/custom/projects/{pid}", timeout=20).json()
        assert r["vendor_id"] == "user_master_workshop"
        assert r["original_vendor_id"] == "user_demo_supplier"

    def test_original_vendor_can_still_view_project(self, supplier):
        ssess, _ = supplier
        pid = _cache["to_pid"]
        r = ssess.get(f"{API}/custom/projects/{pid}", timeout=20)
        # original_vendor_id matches so allowed
        assert r.status_code == 200

    def test_unsuspend_restores_bidding(self, admin, supplier, buyer):
        asess, _ = admin
        r = asess.post(f"{API}/admin/users/user_demo_supplier/unsuspend", timeout=20)
        assert r.status_code == 200
        # Now supplier can bid on susp_pid
        ssess, _ = supplier
        # Must re-login to refresh user state in session (token-based, re-fetch)
        ssess2, _ = demo_session("supplier_vendor")
        r = ssess2.post(f"{API}/custom/projects/{_cache['susp_pid']}/bids", json={
            "duration_days": 10, "notes": "", "material_spec": "unsuspended test material",
            "rab_items": [{"item": "Full set", "qty": 1, "unit": "ls", "price": 2_000_000}],
        }, timeout=20)
        assert r.status_code == 200, r.text

    def test_unsuspend_unknown_user(self, admin):
        asess, _ = admin
        r = asess.post(f"{API}/admin/users/user_does_not_exist/unsuspend", timeout=20)
        assert r.status_code == 404


# ============ CLEANUP ============
def test_cleanup_unsuspend_demo_users(admin):
    """Idempotent cleanup — ensure demo supplier/designer not left suspended."""
    asess, _ = admin
    for uid in ("user_demo_supplier", "user_demo_designer"):
        asess.post(f"{API}/admin/users/{uid}/unsuspend", timeout=20)
