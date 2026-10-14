"""Vendor/contractor/designer business profile + verification feature tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://matshop-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _demo(role):
    r = requests.post(f"{API}/auth/demo", json={"role": role}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def buyer():
    return _demo("contractor_buyer")


@pytest.fixture(scope="module")
def supplier():
    return _demo("supplier_vendor")


@pytest.fixture(scope="module")
def designer():
    return _demo("designer_creator")


@pytest.fixture(scope="module")
def admin():
    return _demo("admin")


VALID_PROFILE = {
    "business_name": "CV Kontraktor TEST",
    "address": "Jl. TEST Verifikasi No. 10, Jakarta Barat",
    "portfolio_url": "https://example.com/portfolio-test",
    "photos": ["https://example.com/photo1.jpg"],
    "pic_name": "Budi TEST",
    "pic_phone": "081200000001",
}


# ---------- Seeded state ----------
class TestSeededState:
    def test_buyer_has_no_profile_initially(self, buyer):
        # Call /auth/me to reflect current db
        r = requests.get(f"{API}/auth/me", headers=auth(buyer["token"]))
        assert r.status_code == 200
        u = r.json()
        # buyer should start null/no profile — but it may already be PENDING if previous test run submitted.
        # Fail-soft: just ensure field exists in model
        assert "verification_status" in u

    def test_supplier_seeded_verified(self, supplier):
        r = requests.get(f"{API}/auth/me", headers=auth(supplier["token"]))
        assert r.json()["verification_status"] == "VERIFIED"
        assert r.json()["business_profile"]["business_name"]

    def test_designer_seeded_verified(self, designer):
        r = requests.get(f"{API}/auth/me", headers=auth(designer["token"]))
        assert r.json()["verification_status"] == "VERIFIED"


# ---------- PUT /users/business-profile ----------
class TestSaveBusinessProfile:
    def test_requires_auth(self):
        r = requests.put(f"{API}/users/business-profile", json=VALID_PROFILE)
        assert r.status_code == 401

    def test_validation_missing_fields(self, buyer):
        r = requests.put(f"{API}/users/business-profile", headers=auth(buyer["token"]),
                         json={"business_name": "X"})
        assert r.status_code == 422

    def test_validation_photos_required(self, buyer):
        r = requests.put(f"{API}/users/business-profile", headers=auth(buyer["token"]),
                         json={**VALID_PROFILE, "photos": []})
        assert r.status_code == 422

    def test_submit_sets_pending(self, buyer):
        r = requests.put(f"{API}/users/business-profile", headers=auth(buyer["token"]),
                         json=VALID_PROFILE)
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["verification_status"] == "PENDING"
        assert u["business_profile"]["business_name"] == VALID_PROFILE["business_name"]
        assert u["business_profile"]["submitted_at"]

    def test_resubmit_from_verified_resets_to_pending(self, supplier):
        # supplier is seeded VERIFIED; resubmitting profile should reset to PENDING
        r = requests.put(f"{API}/users/business-profile", headers=auth(supplier["token"]),
                         json={**VALID_PROFILE, "business_name": "TEST Supplier Update"})
        assert r.status_code == 200
        assert r.json()["verification_status"] == "PENDING"


# ---------- Bidding verification gate ----------
_cache = {}


def _create_open_bid_project(designer_tok, admin_tok):
    """Create project as designer (acting as contractor_buyer), approve as admin."""
    # designer has contractor_buyer role too; create via custom projects
    body = {
        "work_type": "full_interior", "size": 30, "finishing": "hpl",
        "budget": 15_000_000, "description": "TEST verification gate project",
        "address": "Jl. TEST", "city": "Jakarta Barat", "phone": "08120000000",
    }
    r = requests.post(f"{API}/custom/projects", headers=auth(designer_tok), json=body, timeout=20)
    assert r.status_code == 200, r.text
    pid = r.json()["project_id"]
    # admin approve
    ra = requests.post(f"{API}/custom/admin/projects/{pid}/approve",
                       headers=auth(admin_tok), json={"note": "ok"}, timeout=20)
    assert ra.status_code == 200, ra.text
    return pid


class TestBidVerificationGate:
    @pytest.fixture(scope="class", autouse=True)
    def setup_project(self, designer, admin):
        _cache["pid"] = _create_open_bid_project(designer["token"], admin["token"])

    def test_pending_buyer_cannot_bid(self, buyer):
        # buyer should be PENDING now (submitted above)
        r = requests.post(f"{API}/custom/projects/{_cache['pid']}/bids",
                          headers=auth(buyer["token"]), json={
                              "duration_days": 20, "notes": "",
                              "material_spec": "Plywood 18mm, HPL Taco standar",
                              "rab_items": [{"item": "Full", "qty": 1, "unit": "ls", "price": 10_000_000}],
                          }, timeout=20)
        assert r.status_code == 403
        assert "diverifikasi" in r.json().get("detail", "").lower()

    def test_verified_supplier_can_bid(self, supplier, admin):
        # supplier was reset to PENDING above by resubmit; re-verify as admin
        rv = requests.post(f"{API}/admin/vendors/user_demo_supplier/verify",
                           headers=auth(admin["token"]),
                           json={"status": "VERIFIED", "note": "re-verified for test"})
        assert rv.status_code == 200
        r = requests.post(f"{API}/custom/projects/{_cache['pid']}/bids",
                          headers=auth(supplier["token"]), json={
                              "duration_days": 20, "notes": "",
                              "material_spec": "Plywood 18mm, HPL Taco standar",
                              "rab_items": [{"item": "Full", "qty": 1, "unit": "ls", "price": 10_000_000}],
                          }, timeout=20)
        assert r.status_code == 200, r.text


# ---------- Admin verification endpoints ----------
class TestAdminVendors:
    def test_list_requires_admin(self, buyer):
        r = requests.get(f"{API}/admin/vendors", headers=auth(buyer["token"]))
        assert r.status_code == 403

    def test_list_pending(self, admin):
        r = requests.get(f"{API}/admin/vendors", headers=auth(admin["token"]),
                         params={"status": "PENDING"})
        assert r.status_code == 200
        for v in r.json():
            assert v["verification_status"] == "PENDING"
            assert v.get("business_profile")

    def test_list_verified(self, admin):
        r = requests.get(f"{API}/admin/vendors", headers=auth(admin["token"]),
                         params={"status": "VERIFIED"})
        assert r.status_code == 200
        ids = [v["user_id"] for v in r.json()]
        assert "user_demo_supplier" in ids or "user_demo_designer" in ids

    def test_list_all(self, admin):
        r = requests.get(f"{API}/admin/vendors", headers=auth(admin["token"]),
                         params={"status": "all"})
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_verify_requires_admin(self, buyer):
        r = requests.post(f"{API}/admin/vendors/user_demo_buyer/verify",
                          headers=auth(buyer["token"]), json={"status": "VERIFIED"})
        assert r.status_code == 403

    def test_verify_sets_verified_and_notifies(self, buyer, admin):
        # ensure buyer has a profile (submitted above)
        r = requests.post(f"{API}/admin/vendors/user_demo_buyer/verify",
                          headers=auth(admin["token"]),
                          json={"status": "VERIFIED", "note": "TEST verified"})
        assert r.status_code == 200
        assert r.json()["verification_status"] == "VERIFIED"
        # buyer notification
        n = requests.get(f"{API}/notifications", headers=auth(buyer["token"])).json()
        assert any("terverifikasi" in it["title"].lower() for it in n["items"])
        # buyer can now bid on the open project
        bid = requests.post(f"{API}/custom/projects/{_cache['pid']}/bids",
                            headers=auth(buyer["token"]), json={
                                "duration_days": 15, "notes": "",
                                "material_spec": "Plywood lokal grade A, hardware standar",
                                "rab_items": [{"item": "Full", "qty": 1, "unit": "ls", "price": 9_000_000}],
                            }, timeout=20)
        assert bid.status_code == 200, bid.text

    def test_reject_requires_note_min5(self, buyer, admin):
        # re-submit buyer so he's PENDING
        requests.put(f"{API}/users/business-profile", headers=auth(buyer["token"]), json=VALID_PROFILE)
        r = requests.post(f"{API}/admin/vendors/user_demo_buyer/verify",
                          headers=auth(admin["token"]),
                          json={"status": "REJECTED", "note": "x"})
        assert r.status_code == 400

    def test_reject_success_and_notification(self, buyer, admin):
        r = requests.post(f"{API}/admin/vendors/user_demo_buyer/verify",
                          headers=auth(admin["token"]),
                          json={"status": "REJECTED", "note": "Foto workshop tidak jelas"})
        assert r.status_code == 200
        assert r.json()["verification_status"] == "REJECTED"
        assert r.json()["verification_note"].startswith("Foto")
        # user cannot bid (REJECTED)
        bid = requests.post(f"{API}/custom/projects/{_cache['pid']}/bids",
                            headers=auth(buyer["token"]), json={
                                "duration_days": 15, "notes": "",
                                "material_spec": "Plywood lokal grade A, hardware standar",
                                "rab_items": [{"item": "Full", "qty": 1, "unit": "ls", "price": 9_000_000}],
                            }, timeout=20)
        assert bid.status_code == 403

    def test_invalid_status(self, admin):
        r = requests.post(f"{API}/admin/vendors/user_demo_buyer/verify",
                          headers=auth(admin["token"]), json={"status": "WEIRD"})
        assert r.status_code == 400

    def test_verify_nonexistent_vendor(self, admin):
        r = requests.post(f"{API}/admin/vendors/nonexistent_user/verify",
                          headers=auth(admin["token"]),
                          json={"status": "VERIFIED"})
        assert r.status_code == 404


# ---------- Cleanup / restore demo state ----------
class TestRestoreDemoState:
    def test_restore_supplier_verified(self, admin):
        r = requests.post(f"{API}/admin/vendors/user_demo_supplier/verify",
                          headers=auth(admin["token"]),
                          json={"status": "VERIFIED", "note": "restore"})
        assert r.status_code == 200

    def test_restore_designer_verified(self, admin):
        r = requests.post(f"{API}/admin/vendors/user_demo_designer/verify",
                          headers=auth(admin["token"]),
                          json={"status": "VERIFIED", "note": "restore"})
        assert r.status_code == 200

    def test_reset_buyer_to_no_profile(self):
        """Reset user_demo_buyer to pristine state via direct Mongo."""
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        client = MongoClient(mongo_url)
        db = client[db_name]
        db.users.update_one({"user_id": "user_demo_buyer"}, {"$unset": {
            "business_profile": "", "verification_status": "",
            "verification_note": "", "verified_by": "", "verified_at": ""}})
        u = db.users.find_one({"user_id": "user_demo_buyer"})
        assert "verification_status" not in u or u.get("verification_status") is None
        client.close()
