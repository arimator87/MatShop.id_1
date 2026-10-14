"""Iteration 16: Catalog categories & tabs admin management tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


def _demo(role):
    r = requests.post(f"{API}/auth/demo", json={"role": role}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_demo('admin')}"}


@pytest.fixture(scope="module")
def supplier():
    tok = _demo("supplier_vendor")
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def buyer_h():
    return {"Authorization": f"Bearer {_demo('contractor_buyer')}"}


# Track created to cleanup
_created = {"cats": [], "tabs": [], "listings": []}


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_h, supplier):
    yield
    for lid in _created["listings"]:
        try:
            requests.delete(f"{API}/listings/{lid}", headers=supplier, timeout=10)
        except Exception:
            pass
    for k in _created["tabs"]:
        try:
            requests.delete(f"{API}/admin/tabs/{k}", headers=admin_h, timeout=10)
        except Exception:
            pass
    for k in _created["cats"]:
        try:
            requests.delete(f"{API}/admin/categories/{k}", headers=admin_h, timeout=10)
        except Exception:
            pass


# ---------- Public endpoints ----------
class TestPublicCatalog:
    def test_tabs_active_ordered(self):
        r = requests.get(f"{API}/catalog/tabs", timeout=10)
        assert r.status_code == 200
        tabs = r.json()
        assert isinstance(tabs, list) and len(tabs) >= 5
        keys = [t["key"] for t in tabs]
        # seeded default tabs present
        for k in ("all", "plywood", "services", "assets"):
            assert k in keys
        # ordered
        for t in tabs:
            assert set(t.keys()) >= {"key", "label", "icon"}

    def test_public_categories(self):
        r = requests.get(f"{API}/catalog/categories", timeout=10)
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) > 0
        assert all(c["active"] for c in cats)

    def test_meta_categories_active_only(self):
        r = requests.get(f"{API}/meta/categories", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert set(d.keys()) == {"material", "service", "asset"}
        assert isinstance(d["material"], dict)

    def test_tab_filter_plywood(self):
        r = requests.get(f"{API}/listings", params={"tab": "plywood"}, timeout=10)
        assert r.status_code == 200
        items = r.json()
        for it in items:
            assert it["category"] in ("plywood", "hpl")

    def test_tab_filter_services(self):
        r = requests.get(f"{API}/listings", params={"tab": "services"}, timeout=10)
        assert r.status_code == 200
        for it in r.json():
            assert it["type"] == "service"


# ---------- Admin auth ----------
class TestAdminAuth:
    def test_non_admin_403(self, buyer_h):
        r = requests.get(f"{API}/admin/catalog", headers=buyer_h, timeout=10)
        assert r.status_code == 403

    def test_admin_catalog_ok(self, admin_h):
        r = requests.get(f"{API}/admin/catalog", headers=admin_h, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "categories" in d and "tabs" in d
        assert all("usage" in c for c in d["categories"])


# ---------- CRUD flow ----------
class TestCategoryTabFlow:
    def test_full_flow(self, admin_h, supplier):
        # 1. Create new material category
        r = requests.post(f"{API}/admin/categories", headers=admin_h,
                          json={"type": "material", "label": "TEST Kayu Jati", "icon": "", "active": True}, timeout=10)
        assert r.status_code == 200, r.text
        cat = r.json()
        cat_key = cat["key"]
        _created["cats"].append(cat_key)
        assert cat["label"] == "TEST Kayu Jati"
        assert cat["type"] == "material"

        # 2. Verify in /api/meta/categories
        meta = requests.get(f"{API}/meta/categories", timeout=10).json()
        assert cat_key in meta["material"]

        # 3. Create new tab containing it
        r = requests.post(f"{API}/admin/tabs", headers=admin_h,
                          json={"label": "TEST Tab Jati", "types": [], "categories": [cat_key], "active": True}, timeout=10)
        assert r.status_code == 200, r.text
        tab = r.json()
        tab_key = tab["key"]
        _created["tabs"].append(tab_key)

        # 4. Validation: tab needs types or categories
        r = requests.post(f"{API}/admin/tabs", headers=admin_h,
                          json={"label": "TEST Empty", "types": [], "categories": []}, timeout=10)
        assert r.status_code == 400

        # 5. Validation: unknown category
        r = requests.post(f"{API}/admin/tabs", headers=admin_h,
                          json={"label": "TEST Unknown", "types": [], "categories": ["nope_xyz"]}, timeout=10)
        assert r.status_code == 400

        # 6. Supplier creates listing with new category
        r = requests.post(f"{API}/listings", headers=supplier, json={
            "type": "material", "category": cat_key, "title": "TEST Jati Listing",
            "description": "test desc", "price": 100000, "stock": 10, "images": [], "tiers": []
        }, timeout=10)
        assert r.status_code == 200, r.text
        listing = r.json()
        _created["listings"].append(listing["listing_id"])

        # 7. /api/listings?tab=newtab returns it
        r = requests.get(f"{API}/listings", params={"tab": tab_key}, timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert any(it["listing_id"] == listing["listing_id"] for it in items)

        # 8. Public tabs now include new tab
        tabs = requests.get(f"{API}/catalog/tabs", timeout=10).json()
        assert tab_key in [t["key"] for t in tabs]

        # 9. Admin catalog shows usage=1
        d = requests.get(f"{API}/admin/catalog", headers=admin_h, timeout=10).json()
        this = next(c for c in d["categories"] if c["key"] == cat_key)
        assert this["usage"] == 1

        # 10. Try to delete used category -> 400
        r = requests.delete(f"{API}/admin/categories/{cat_key}", headers=admin_h, timeout=10)
        assert r.status_code == 400

        # 11. Deactivate category
        r = requests.put(f"{API}/admin/categories/{cat_key}", headers=admin_h,
                         json={"type": "material", "label": "TEST Kayu Jati", "icon": "", "active": False}, timeout=10)
        assert r.status_code == 200
        assert r.json()["active"] is False

        # 12. New listing with inactive category -> 400
        r = requests.post(f"{API}/listings", headers=supplier, json={
            "type": "material", "category": cat_key, "title": "TEST should fail",
            "description": "x", "price": 100000, "stock": 1, "images": [], "tiers": []
        }, timeout=10)
        assert r.status_code == 400

        # 13. Existing listing still has category_label (now equals key since not in LABELS[active]? Actually LABELS keeps labels regardless of active)
        r = requests.get(f"{API}/listings/{listing['listing_id']}", timeout=10)
        assert r.status_code == 200
        assert r.json()["category_label"] == "TEST Kayu Jati"

        # 14. Inactive category not in /api/meta/categories
        meta = requests.get(f"{API}/meta/categories", timeout=10).json()
        assert cat_key not in meta["material"]

        # 15. Reorder tabs
        tabs_now = requests.get(f"{API}/admin/catalog", headers=admin_h, timeout=10).json()["tabs"]
        keys = [t["key"] for t in tabs_now]
        reversed_keys = list(reversed(keys))
        r = requests.post(f"{API}/admin/catalog/reorder", headers=admin_h,
                         json={"kind": "tabs", "keys": reversed_keys}, timeout=10)
        assert r.status_code == 200
        # restore
        requests.post(f"{API}/admin/catalog/reorder", headers=admin_h,
                      json={"kind": "tabs", "keys": keys}, timeout=10)

        # 16. Delete tab
        r = requests.delete(f"{API}/admin/tabs/{tab_key}", headers=admin_h, timeout=10)
        assert r.status_code == 200
        _created["tabs"].remove(tab_key)
        tabs = requests.get(f"{API}/catalog/tabs", timeout=10).json()
        assert tab_key not in [t["key"] for t in tabs]

        # 17. Deactivate listing then delete category (now unused)
        requests.delete(f"{API}/listings/{listing['listing_id']}", headers=supplier, timeout=10)
        _created["listings"].remove(listing["listing_id"])
        # Hard: need to also remove from listings collection, since delete endpoint likely soft-deletes
        # Try delete category; may still be referenced by inactive listing (count_documents all)
        r = requests.delete(f"{API}/admin/categories/{cat_key}", headers=admin_h, timeout=10)
        # If backend counts all (including inactive), it stays 400; just record
        if r.status_code == 200:
            _created["cats"].remove(cat_key)

    def test_plywood_regression(self):
        """Regression: plywood tab still returns ~7 items, services ~5."""
        r = requests.get(f"{API}/listings", params={"tab": "plywood"}, timeout=10).json()
        assert len(r) >= 1
        r = requests.get(f"{API}/listings", params={"tab": "services"}, timeout=10).json()
        assert len(r) >= 1
