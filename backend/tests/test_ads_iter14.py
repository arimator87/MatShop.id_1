"""Iteration 14 — In-Feed Ads enhancement: brand vs vendor types, paid flag, vendor notifications, portfolio sponsored flag."""
import os
import time
import requests
import pytest
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def token(role):
    r = requests.post(f"{API}/auth/demo", json={"role": role}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token('admin')}"})
    return s


@pytest.fixture(scope="module")
def supplier():
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token('supplier_vendor')}"})
    return s


# ---------- Public /api/ads schema ----------
class TestAdsList:
    def test_seed_vendor_ad_live(self):
        ads = requests.get(f"{API}/ads", params={"placement": "home"}).json()
        v = next((a for a in ads if a["ad_id"] == "ad_demo_vendor"), None)
        assert v, "ad_demo_vendor should be live in home placement"
        assert v["ad_type"] == "vendor"
        assert "vendor" in v and v["vendor"]["user_id"] == "user_showcase_workshop"
        assert v["vendor"]["business_name"]
        assert "rating" in v["vendor"] and "review_count" in v["vendor"] and "top_rated" in v["vendor"]
        # image fallback (vendor had empty image → portfolio photo)
        assert v["image"] and v["image"].startswith("http")
        # sensitive fields hidden
        for k in ("contract_value", "paid", "payment_note"):
            assert k not in v, f"field {k} must not be exposed publicly"

    def test_brand_ad_in_catalog(self):
        ads = requests.get(f"{API}/ads", params={"placement": "catalog"}).json()
        b = next((a for a in ads if a["ad_id"] == "ad_demo_hardware"), None)
        assert b and b.get("ad_type", "brand") == "brand"
        assert "paid" not in b and "contract_value" not in b


# ---------- Validation ----------
class TestAdValidation:
    def test_invalid_ad_type(self, admin):
        r = admin.post(f"{API}/admin/ads", json={"ad_type": "garbage", "title": "TEST_x", "placements": ["home"]})
        assert r.status_code == 400

    def test_vendor_type_requires_vendor_id(self, admin):
        r = admin.post(f"{API}/admin/ads", json={"ad_type": "vendor", "title": "TEST_v1", "placements": ["home"]})
        assert r.status_code == 400

    def test_vendor_type_rejects_unverified(self, admin):
        r = admin.post(f"{API}/admin/ads", json={"ad_type": "vendor", "vendor_id": "user_demo_buyer",
                                                 "title": "TEST_v2", "placements": ["home"]})
        assert r.status_code == 400

    def test_brand_requires_advertiser_and_image(self, admin):
        r = admin.post(f"{API}/admin/ads", json={"ad_type": "brand", "title": "TEST_b1", "placements": ["home"]})
        assert r.status_code == 400
        r2 = admin.post(f"{API}/admin/ads", json={"ad_type": "brand", "advertiser": "Acme",
                                                  "image": "", "title": "TEST_b2", "placements": ["home"]})
        assert r2.status_code == 400

    def test_link_url_optional(self, admin):
        # brand ad with empty link_url should be accepted
        r = admin.post(f"{API}/admin/ads", json={
            "ad_type": "brand", "advertiser": "Acme", "image": "https://example.com/i.jpg",
            "title": "TEST_nolink", "placements": ["home"], "link_url": ""})
        assert r.status_code == 200, r.text
        aid = r.json()["ad_id"]
        admin.delete(f"{API}/admin/ads/{aid}")

    def test_unpaid_ad_not_listed(self, admin):
        r = admin.post(f"{API}/admin/ads", json={
            "ad_type": "brand", "advertiser": "Acme", "image": "https://example.com/i.jpg",
            "title": "TEST_unpaid", "placements": ["home"], "paid": False, "active": True})
        assert r.status_code == 200
        aid = r.json()["ad_id"]
        ads = requests.get(f"{API}/ads", params={"placement": "home"}).json()
        assert not any(a["ad_id"] == aid for a in ads), "unpaid ad must not appear"
        admin.delete(f"{API}/admin/ads/{aid}")


# ---------- Vendor notification ----------
class TestVendorNotification:
    def test_notification_fires_once(self, admin, supplier):
        # cleanup any prior TEST_notify ads for user_demo_supplier
        all_ads = admin.get(f"{API}/admin/ads").json()
        for a in all_ads:
            if a.get("vendor_id") == "user_demo_supplier" and a["title"].startswith("TEST_"):
                admin.delete(f"{API}/admin/ads/{a['ad_id']}")

        def count():
            n = supplier.get(f"{API}/notifications").json()
            items = n.get("items", n) if isinstance(n, dict) else n
            return sum(1 for x in items if "Iklan sponsor Anda mulai tayang" in x.get("title", ""))

        before = count()
        r = admin.post(f"{API}/admin/ads", json={
            "ad_type": "vendor", "vendor_id": "user_demo_supplier",
            "title": "TEST_notify_supplier", "placements": ["home", "catalog"],
            "paid": True, "active": True, "link_url": "", "image": ""})
        assert r.status_code == 200, r.text
        aid = r.json()["ad_id"]
        try:
            time.sleep(0.5)
            # subsequent /ads calls must NOT fire duplicate notification
            requests.get(f"{API}/ads", params={"placement": "home"}).json()
            requests.get(f"{API}/ads", params={"placement": "catalog"}).json()
            time.sleep(0.3)

            after = count()
            assert after == before + 1, f"expected exactly 1 new live-ad notification, got delta={after-before}"
        finally:
            admin.delete(f"{API}/admin/ads/{aid}")


# ---------- Portfolio sponsored flag ----------
class TestPortfolioSponsored:
    def test_showcase_workshop_sponsored(self):
        ports = requests.get(f"{API}/portfolios", params={"limit": 50}).json()
        w = next((p for p in ports if p["user_id"] == "user_showcase_workshop"), None)
        assert w, "user_showcase_workshop portfolio should be listed"
        assert w.get("sponsored") is True

    def test_other_vendor_not_sponsored(self):
        ports = requests.get(f"{API}/portfolios", params={"limit": 50}).json()
        others = [p for p in ports if p["user_id"] != "user_showcase_workshop"]
        # at least one non-sponsored vendor exists
        assert any(p.get("sponsored") is False for p in others)
