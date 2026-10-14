"""Tests for popup banners + sponsored ads (iteration 13)."""
import os
import requests
import pytest
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def demo_token(role):
    r = requests.post(f"{API}/auth/demo", json={"role": role}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {demo_token('admin')}"})
    return s


@pytest.fixture(scope="module")
def buyer():
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {demo_token('contractor_buyer')}"})
    return s


# ---------- Banners ----------
class TestBanners:
    def test_active_banner_public(self):
        r = requests.get(f"{API}/banners/active", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data is not None
        assert data["banner_id"] == "bnr_demo_grosir"
        assert data["active"] is True

    def test_admin_only_list(self, buyer):
        r = buyer.get(f"{API}/admin/banners")
        assert r.status_code == 403

    def test_admin_list(self, admin):
        r = admin.get(f"{API}/admin/banners")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_activate_deactivates_others(self, admin):
        payload = {"name": "TEST_banner_a", "image": "https://example.com/a.jpg",
                   "link_url": "/katalog", "active": True}
        r = admin.post(f"{API}/admin/banners", json=payload)
        assert r.status_code == 200, r.text
        bid = r.json()["banner_id"]
        # seed should now be inactive
        all_b = admin.get(f"{API}/admin/banners").json()
        actives = [b for b in all_b if b["active"]]
        assert len(actives) == 1 and actives[0]["banner_id"] == bid
        # restore
        admin.put(f"{API}/admin/banners/bnr_demo_grosir",
                  json={"name": "Promo Grosir Material",
                        "image": "https://static.prod-images.emergentagent.com/jobs/1baca0b2-3240-4aa4-832e-f51cecfeea66/images/fa5311ae1e4e62884a09ae1082101d6c5c053c2ab4a46c51b44eb8b600e823f2.jpeg",
                        "link_url": "/katalog?tab=all", "active": True})
        admin.delete(f"{API}/admin/banners/{bid}")
        # verify active again
        a = requests.get(f"{API}/banners/active").json()
        assert a and a["banner_id"] == "bnr_demo_grosir"

    def test_update_dates_invalid(self, admin):
        payload = {"name": "TEST_banner_b", "image": "https://example.com/b.jpg",
                   "active": False, "start_date": "2025-02-10", "end_date": "2025-02-01"}
        r = admin.post(f"{API}/admin/banners", json=payload)
        assert r.status_code == 400

    def test_delete_404(self, admin):
        r = admin.delete(f"{API}/admin/banners/does_not_exist")
        assert r.status_code == 404


# ---------- Ads ----------
class TestAds:
    def test_list_home(self):
        r = requests.get(f"{API}/ads?placement=home", timeout=20)
        assert r.status_code == 200
        ads = r.json()
        assert any(a["ad_id"] == "ad_demo_cat" for a in ads)

    def test_list_catalog(self):
        r = requests.get(f"{API}/ads?placement=catalog").json()
        ids = {a["ad_id"] for a in r}
        assert {"ad_demo_cat", "ad_demo_hardware"} <= ids

    def test_click_increments(self, admin):
        before = next(a for a in admin.get(f"{API}/admin/ads").json() if a["ad_id"] == "ad_demo_cat")["clicks"]
        r = requests.post(f"{API}/ads/ad_demo_cat/click")
        assert r.status_code == 200
        after = next(a for a in admin.get(f"{API}/admin/ads").json() if a["ad_id"] == "ad_demo_cat")["clicks"]
        assert after == before + 1

    def test_admin_required(self, buyer):
        assert buyer.get(f"{API}/admin/ads").status_code == 403

    def test_create_invalid_placement(self, admin):
        payload = {"title": "TEST_ad_bad", "advertiser": "Acme", "image": "https://example.com/i.jpg",
                   "description": "", "link_url": "https://x", "cta": "Go",
                   "placements": ["invalid"], "active": True}
        r = admin.post(f"{API}/admin/ads", json=payload)
        assert r.status_code == 400

    def test_create_empty_placements_422(self, admin):
        payload = {"title": "TEST_ad_empty", "advertiser": "Acme", "image": "https://example.com/i.jpg",
                   "link_url": "https://x", "placements": []}
        r = admin.post(f"{API}/admin/ads", json=payload)
        assert r.status_code == 422

    def test_create_date_order(self, admin):
        payload = {"title": "TEST_ad_date", "advertiser": "Acme", "image": "https://example.com/i.jpg",
                   "link_url": "https://x", "placements": ["home"],
                   "start_date": "2025-03-10", "end_date": "2025-03-01"}
        r = admin.post(f"{API}/admin/ads", json=payload)
        assert r.status_code == 400

    def test_full_crud_ad(self, admin):
        payload = {"title": "TEST_ad_crud", "advertiser": "Acme", "image": "https://example.com/i.jpg",
                   "description": "d", "link_url": "https://acme", "cta": "Go",
                   "placements": ["home"], "active": True}
        r = admin.post(f"{API}/admin/ads", json=payload)
        assert r.status_code == 200
        aid = r.json()["ad_id"]
        # update
        payload["title"] = "TEST_ad_crud2"
        r2 = admin.put(f"{API}/admin/ads/{aid}", json=payload)
        assert r2.status_code == 200 and r2.json()["title"] == "TEST_ad_crud2"
        # delete
        assert admin.delete(f"{API}/admin/ads/{aid}").status_code == 200
        assert admin.delete(f"{API}/admin/ads/{aid}").status_code == 404
