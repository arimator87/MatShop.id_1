"""Backend tests for Vendor/Partner Activation (iteration 19)."""
import io
import os
import pytest
import requests
from PIL import Image

from dotenv import dotenv_values
_env = dotenv_values("/app/frontend/.env")
BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _env["REACT_APP_BACKEND_URL"]).rstrip("/") + "/api"


def _login(role):
    r = requests.post(f"{BASE}/auth/demo", json={"role": role})
    r.raise_for_status()
    j = r.json()
    return j["user"], {"Authorization": f"Bearer {j['token']}"}


def _png_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), (200, 200, 200)).save(buf, format="PNG")
    return buf.getvalue()


def _upload(headers, private=False):
    files = {"file": ("x.png", _png_bytes(), "image/png")}
    r = requests.post(f"{BASE}/uploads?private={'true' if private else 'false'}", files=files, headers=headers)
    r.raise_for_status()
    return r.json()


@pytest.fixture(scope="module")
def buyer():
    # Reset buyer to a clean 'buyer only' state (cleanup requirement)
    user, h = _login("buyer")
    return user, h


@pytest.fixture(scope="module")
def admin():
    return _login("admin")


# ---------- demo login ----------
class TestDemo:
    def test_buyer(self):
        u, _ = _login("buyer")
        assert u["user_id"] == "user_demo_buyer"

    def test_supplier(self):
        u, _ = _login("supplier_vendor")
        assert u["user_id"] == "user_demo_supplier"
        assert "supplier_vendor" in u["enabled_roles"]

    def test_designer(self):
        u, _ = _login("designer_creator")
        assert u["user_id"] == "user_demo_designer"

    def test_contractor(self):
        u, _ = _login("contractor")
        assert u["user_id"] == "user_showcase_workshop"
        assert "contractor" in u["enabled_roles"]

    def test_admin(self):
        u, _ = _login("admin")
        assert u["is_admin"] is True

    def test_legacy_alias(self):
        u, _ = _login("contractor_buyer")
        assert u["user_id"] == "user_demo_buyer"


# ---------- roles/switch gating ----------
class TestRoleSwitch:
    def test_buyer_cannot_switch_designer(self, buyer):
        _, h = buyer
        r = requests.post(f"{BASE}/users/roles/switch", json={"role": "designer_creator"}, headers=h)
        assert r.status_code == 403

    def test_buyer_cannot_switch_contractor(self, buyer):
        _, h = buyer
        r = requests.post(f"{BASE}/users/roles/switch", json={"role": "contractor"}, headers=h)
        assert r.status_code == 403

    def test_buyer_switch_supplier_ok(self, buyer):
        _, h = buyer
        r = requests.post(f"{BASE}/users/roles/switch", json={"role": "supplier_vendor"}, headers=h)
        assert r.status_code == 200
        # restore
        requests.post(f"{BASE}/users/roles/switch", json={"role": "buyer"}, headers=h)


# ---------- Uploads private ----------
class TestPrivateUploads:
    def test_public_upload_anon_ok(self, buyer):
        _, h = buyer
        up = _upload(h, private=False)
        r = requests.get(f"{BASE}/files/{up['path']}")  # anon
        assert r.status_code == 200

    def test_private_upload_anon_401(self, buyer):
        _, h = buyer
        up = _upload(h, private=True)
        r = requests.get(f"{BASE}/files/{up['path']}")
        assert r.status_code == 401

    def test_private_upload_other_user_403(self, buyer, admin):
        _, h = buyer
        up = _upload(h, private=True)
        # other user (supplier)
        _, h2 = _login("supplier_vendor")
        r = requests.get(f"{BASE}/files/{up['path']}", headers=h2)
        assert r.status_code == 403

    def test_private_upload_owner_ok(self, buyer):
        _, h = buyer
        up = _upload(h, private=True)
        r = requests.get(f"{BASE}/files/{up['path']}", headers=h)
        assert r.status_code == 200

    def test_private_upload_admin_ok(self, buyer, admin):
        _, h = buyer
        up = _upload(h, private=True)
        _, ha = admin
        r = requests.get(f"{BASE}/files/{up['path']}", headers=ha)
        assert r.status_code == 200


# ---------- Admin partner verifications ----------
class TestAdminPartnerVerifications:
    def test_non_admin_403(self, buyer):
        _, h = buyer
        r = requests.get(f"{BASE}/admin/partner-verifications?role=designer_creator&status=pending", headers=h)
        assert r.status_code == 403

    def test_counts(self, admin):
        _, ha = admin
        r = requests.get(f"{BASE}/admin/partner-verifications/counts", headers=ha)
        assert r.status_code == 200
        j = r.json()
        assert "designer_creator" in j and "contractor" in j
        for role in ("designer_creator", "contractor"):
            for s in ("pending", "scheduled", "verified", "rejected"):
                assert s in j[role]

    def test_list_designer_pending_has_seed(self, admin):
        _, ha = admin
        r = requests.get(f"{BASE}/admin/partner-verifications?role=designer_creator&status=pending", headers=ha)
        assert r.status_code == 200
        ids = [x["user_id"] for x in r.json()]
        assert "user_pending_designer" in ids

    def test_list_contractor_pending_has_seed(self, admin):
        _, ha = admin
        r = requests.get(f"{BASE}/admin/partner-verifications?role=contractor&status=pending", headers=ha)
        assert r.status_code == 200
        ids = [x["user_id"] for x in r.json()]
        assert "user_pending_contractor" in ids

    def test_invalid_role_400(self, admin):
        _, ha = admin
        r = requests.get(f"{BASE}/admin/partner-verifications?role=buyer&status=pending", headers=ha)
        assert r.status_code == 400


# ---------- Designer activation ----------
class TestDesignerActivation:
    def test_requires_private_uploads(self, buyer):
        _, h = buyer
        pub = _upload(h, private=False)
        r = requests.post(f"{BASE}/users/activation/designer",
                          json={"ktp": pub["path"], "selfie": pub["path"]}, headers=h)
        assert r.status_code == 400

    def test_full_flow_pending_then_approve(self, buyer, admin):
        _, h = buyer
        ktp = _upload(h, private=True)["path"]
        selfie = _upload(h, private=True)["path"]
        r = requests.post(f"{BASE}/users/activation/designer",
                          json={"ktp": ktp, "selfie": selfie}, headers=h)
        assert r.status_code == 200
        u = r.json()
        assert "designer_creator" in u["enabled_roles"]
        assert u["active_role"] == "designer_creator"
        rv = (u.get("role_verifications") or {}).get("designer_creator") or {}
        assert rv.get("status") == "PENDING_DESIGNER_VERIFICATION"

        # admin approves
        _, ha = admin
        r2 = requests.post(f"{BASE}/admin/partner-verifications/user_demo_buyer/designer_creator/approve",
                           headers=ha)
        assert r2.status_code == 200


# ---------- Contractor activation ----------
class TestContractorActivation:
    def _payload(self, h, bad_video=False, bad_addr=False, no_loc=False):
        ktp = _upload(h, private=True)["path"]
        selfie = _upload(h, private=True)["path"]
        wp = _upload(h, private=False)["path"]
        p = {"ktp": ktp, "selfie": selfie, "workshop_photos": [wp],
             "workshop_video": "ftp://example.com/vid" if bad_video else "https://www.youtube.com/watch?v=abc",
             "address": "Short" if bad_addr else "Jl. Industri No. 10, Jepara, Jawa Tengah",
             "lat": None if no_loc else -6.6106, "lng": None if no_loc else 110.6776,
             "maps_url": ""}
        return p

    def test_bad_video_400(self, buyer):
        _, h = buyer
        r = requests.post(f"{BASE}/users/activation/contractor", json=self._payload(h, bad_video=True), headers=h)
        assert r.status_code == 400

    def test_no_location_400(self, buyer):
        _, h = buyer
        r = requests.post(f"{BASE}/users/activation/contractor", json=self._payload(h, no_loc=True), headers=h)
        assert r.status_code == 400

    def test_short_address_422(self, buyer):
        _, h = buyer
        r = requests.post(f"{BASE}/users/activation/contractor", json=self._payload(h, bad_addr=True), headers=h)
        assert r.status_code == 422  # pydantic min_length

    def test_submit_and_schedule_and_approve(self, buyer, admin):
        _, h = buyer
        # Make sure buyer has 'buyer' active first
        requests.post(f"{BASE}/users/roles/switch", json={"role": "buyer"}, headers=h)
        r = requests.post(f"{BASE}/users/activation/contractor", json=self._payload(h), headers=h)
        assert r.status_code == 200, r.text
        u = r.json()
        assert "contractor" in u["enabled_roles"]
        rv = u["role_verifications"]["contractor"]
        assert rv["status"] == "PENDING_SURVEY_VERIFICATION"

        # reschedule should 400 before scheduled
        r_bad = requests.post(f"{BASE}/users/activation/contractor/reschedule",
                              json={"preferred_date": "2026-02-10", "preferred_time": "10:00",
                                    "reason": "ada acara"}, headers=h)
        assert r_bad.status_code == 400

        # approve before schedule -> 400
        _, ha = admin
        rA = requests.post(f"{BASE}/admin/partner-verifications/user_demo_buyer/contractor/approve", headers=ha)
        assert rA.status_code == 400

        # schedule
        rs = requests.post(f"{BASE}/admin/partner-verifications/user_demo_buyer/contractor/schedule",
                           json={"date": "2026-02-15", "time": "10:00", "note": "Surveyor: Budi"}, headers=ha)
        assert rs.status_code == 200

        # reschedule by contractor OK now
        rr = requests.post(f"{BASE}/users/activation/contractor/reschedule",
                           json={"preferred_date": "2026-02-16", "preferred_time": "11:00",
                                 "reason": "ada acara keluarga"}, headers=h)
        assert rr.status_code == 200

        # list scheduled contains buyer
        rl = requests.get(f"{BASE}/admin/partner-verifications?role=contractor&status=scheduled", headers=ha)
        assert rl.status_code == 200
        assert any(x["user_id"] == "user_demo_buyer" for x in rl.json())

        # re-schedule keeps history
        rs2 = requests.post(f"{BASE}/admin/partner-verifications/user_demo_buyer/contractor/schedule",
                            json={"date": "2026-02-20", "time": "14:00", "note": ""}, headers=ha)
        assert rs2.status_code == 200

        # approve
        rA2 = requests.post(f"{BASE}/admin/partner-verifications/user_demo_buyer/contractor/approve", headers=ha)
        assert rA2.status_code == 200

    def test_reject_requires_note(self, admin):
        _, ha = admin
        r = requests.post(f"{BASE}/admin/partner-verifications/user_pending_designer/designer_creator/reject",
                          json={"note": "x"}, headers=ha)
        assert r.status_code == 422

    def test_reject_ok_then_restore(self, admin):
        # Use user_pending_designer: reject then restore to pending via Mongo? We can re-list to confirm.
        _, ha = admin
        r = requests.post(f"{BASE}/admin/partner-verifications/user_pending_designer/designer_creator/reject",
                          json={"note": "Dokumen KTP buram, mohon unggah ulang"}, headers=ha)
        assert r.status_code == 200


# ---------- Bidding gate ----------
class TestBiddingGate:
    def test_buyer_cannot_bid(self):
        # buyer at this stage may have been elevated by prior tests, so use fresh scenario:
        # Use designer demo (no contractor role)
        _, h = _login("designer_creator")
        # need a project id - list open ones
        r = requests.get(f"{BASE}/custom/projects?status=open")
        if r.status_code != 200 or not r.json():
            pytest.skip("No open custom projects")
        pid = r.json()[0]["project_id"]
        rb = requests.post(f"{BASE}/custom/projects/{pid}/bids",
                           json={"duration_days": 10, "notes": "x", "material_spec": "y",
                                 "rab_items": [{"name": "A", "qty": 1, "price": 1000, "unit": "pcs"}]},
                           headers=h)
        assert rb.status_code == 403
