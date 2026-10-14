"""Iteration 15: new ad placements (home_sections, dashboard) and site-settings endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


# ----- auth helpers -----
def _demo(role):
    r = requests.post(f"{API}/auth/demo", json={"role": role}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _demo("admin")


@pytest.fixture(scope="module")
def buyer_token():
    return _demo("contractor_buyer")


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ----- ad placements -----
class TestAdPlacements:
    def test_home_sections_contains_seed_ads(self):
        r = requests.get(f"{API}/ads", params={"placement": "home_sections"}, timeout=20)
        assert r.status_code == 200
        ids = [a["ad_id"] for a in r.json()]
        assert "ad_demo_cat" in ids
        assert "ad_demo_vendor" in ids

    def test_dashboard_contains_seed_ads(self):
        r = requests.get(f"{API}/ads", params={"placement": "dashboard"}, timeout=20)
        assert r.status_code == 200
        ids = [a["ad_id"] for a in r.json()]
        assert "ad_demo_cat" in ids
        assert "ad_demo_vendor" in ids

    def test_vendor_ad_has_vendor_meta(self):
        r = requests.get(f"{API}/ads", params={"placement": "home_sections"}, timeout=20)
        vendor_ads = [a for a in r.json() if a.get("ad_type") == "vendor"]
        assert vendor_ads
        assert vendor_ads[0]["vendor"]["user_id"] == "user_showcase_workshop"

    def test_create_ad_with_new_placements(self, admin_headers):
        body = {
            "ad_type": "brand", "title": "TEST_ Iter15 Brand",
            "advertiser": "TEST Advertiser",
            "image": "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=900",
            "description": "iter15", "link_url": "https://example.com",
            "cta": "Lihat", "placements": ["home_sections", "dashboard"],
            "active": True, "paid": True,
        }
        r = requests.post(f"{API}/admin/ads", json=body, headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        ad_id = r.json()["ad_id"]
        # verify list
        for p in ("home_sections", "dashboard"):
            lst = requests.get(f"{API}/ads", params={"placement": p}, timeout=20).json()
            assert any(a["ad_id"] == ad_id for a in lst), f"ad missing in {p}"
        # cleanup
        requests.delete(f"{API}/admin/ads/{ad_id}", headers=admin_headers, timeout=20)

    def test_invalid_placement_rejected(self, admin_headers):
        body = {
            "ad_type": "brand", "title": "TEST_ bad",
            "advertiser": "TEST", "image": "https://example.com/x.jpg",
            "placements": ["moon"], "active": True, "paid": True,
        }
        r = requests.post(f"{API}/admin/ads", json=body, headers=admin_headers, timeout=20)
        assert r.status_code == 400


# ----- site settings -----
class TestSiteSettings:
    def test_public_get_ok(self):
        r = requests.get(f"{API}/site-settings", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_put_requires_admin(self, buyer_token):
        h = {"Authorization": f"Bearer {buyer_token}"}
        r = requests.put(f"{API}/admin/site-settings", json={"images": {}, "hero": {}, "sections": []}, headers=h, timeout=20)
        assert r.status_code == 403

    def test_put_rejects_wrong_section_set(self, admin_headers):
        bad = [{"key": "custom_banner", "visible": True}]  # missing others
        r = requests.put(f"{API}/admin/site-settings", json={"images": {}, "hero": {}, "sections": bad}, headers=admin_headers, timeout=20)
        assert r.status_code == 400

    def test_put_accepts_all_8_sections_and_strips_empty(self, admin_headers):
        all_keys = ["custom_banner", "portfolio", "catalog", "ads_strip_a", "popular", "creator", "ads_strip_b", "escrow"]
        payload = {
            "images": {"hero_main": "", "custom_banner": "https://example.com/x.jpg"},
            "hero": {"eyebrow": "", "title": "TEST_ New Title"},
            "sections": [{"key": k, "visible": True} for k in all_keys],
        }
        r = requests.put(f"{API}/admin/site-settings", json=payload, headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "hero_main" not in d["images"]
        assert d["images"].get("custom_banner") == "https://example.com/x.jpg"
        assert "eyebrow" not in d["hero"]
        assert d["hero"].get("title") == "TEST_ New Title"
        assert len(d["sections"]) == 8

        # Verify public GET reflects persisted state
        pub = requests.get(f"{API}/site-settings", timeout=20).json()
        assert pub["hero"]["title"] == "TEST_ New Title"

    def test_cleanup_reset(self, admin_headers):
        r = requests.put(f"{API}/admin/site-settings", json={"images": {}, "hero": {}, "sections": []}, headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["images"] == {} and d["hero"] == {} and d["sections"] == []
