"""MatShop.id backend regression tests."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://matshop-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _demo_login(role):
    r = requests.post(f"{API}/auth/demo", json={"role": role}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def buyer():
    return _demo_login("contractor_buyer")


@pytest.fixture(scope="session")
def supplier():
    return _demo_login("supplier_vendor")


@pytest.fixture(scope="session")
def designer():
    return _demo_login("designer_creator")


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Public endpoints ----------
class TestPublic:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert "MatShop" in r.json()["message"]

    def test_categories(self):
        r = requests.get(f"{API}/meta/categories")
        assert r.status_code == 200
        data = r.json()
        assert "material" in data and "plywood" in data["material"]

    @pytest.mark.parametrize("tab", ["all", "plywood", "spc", "wallpanel", "services", "assets"])
    def test_listings_tabs(self, tab):
        r = requests.get(f"{API}/listings", params={"tab": tab})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # file_url hidden in public listings
        for d in data:
            assert "file_url" not in d
            assert "category_label" in d

    def test_listings_search_sort(self):
        r = requests.get(f"{API}/listings", params={"q": "a", "sort": "price_asc"})
        assert r.status_code == 200
        prices = [d["price"] for d in r.json()]
        assert prices == sorted(prices)

    def test_listing_detail_tiers(self):
        docs = requests.get(f"{API}/listings", params={"tab": "all"}).json()
        assert len(docs) > 0
        lid = docs[0]["listing_id"]
        r = requests.get(f"{API}/listings/{lid}")
        assert r.status_code == 200
        assert r.json()["listing_id"] == lid

    def test_listing_not_found(self):
        r = requests.get(f"{API}/listings/nonexistent_xxx")
        assert r.status_code == 404


# ---------- Auth ----------
class TestAuth:
    def test_demo_login(self, buyer):
        assert buyer["user"]["user_id"] == "user_demo_buyer"
        assert buyer["token"]

    def test_demo_invalid_role(self):
        r = requests.post(f"{API}/auth/demo", json={"role": "bogus"})
        assert r.status_code == 400

    def test_me(self, buyer):
        r = requests.get(f"{API}/auth/me", headers=auth(buyer["token"]))
        assert r.status_code == 200
        assert r.json()["user_id"] == "user_demo_buyer"

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_role_switch(self, supplier):
        r = requests.post(f"{API}/users/roles/switch", json={"role": "contractor_buyer"},
                          headers=auth(supplier["token"]))
        assert r.status_code == 200
        assert r.json()["active_role"] == "contractor_buyer"


# ---------- Listings CRUD & permissions ----------
class TestListings:
    def test_buyer_cannot_create_material(self, buyer):
        r = requests.post(f"{API}/listings", headers=auth(buyer["token"]), json={
            "type": "material", "category": "plywood", "title": "TEST_bad", "price": 1000,
        })
        assert r.status_code == 403

    def test_supplier_create_update_delete(self, supplier):
        payload = {
            "type": "material", "category": "plywood", "title": "TEST_Plywood_X",
            "description": "test", "price": 100000, "unit": "lembar", "stock": 100,
            "tiers": [{"min_qty": 50, "price": 90000}], "images": ["https://x/img.jpg"],
        }
        r = requests.post(f"{API}/listings", headers=auth(supplier["token"]), json=payload)
        assert r.status_code == 200, r.text
        lid = r.json()["listing_id"]

        # update
        payload["price"] = 110000
        payload["tiers"] = [{"min_qty": 50, "price": 95000}]
        r2 = requests.put(f"{API}/listings/{lid}", headers=auth(supplier["token"]), json=payload)
        assert r2.status_code == 200
        assert r2.json()["price"] == 110000

        # verify persistence via GET
        r3 = requests.get(f"{API}/listings/{lid}")
        assert r3.status_code == 200
        assert r3.json()["price"] == 110000

        # delete
        r4 = requests.delete(f"{API}/listings/{lid}", headers=auth(supplier["token"]))
        assert r4.status_code == 200

        # should 404
        assert requests.get(f"{API}/listings/{lid}").status_code == 404

    def test_tier_price_validation(self, supplier):
        r = requests.post(f"{API}/listings", headers=auth(supplier["token"]), json={
            "type": "material", "category": "plywood", "title": "TEST_bad_tier", "price": 1000,
            "tiers": [{"min_qty": 50, "price": 2000}],
        })
        assert r.status_code == 400

    def test_asset_requires_file_url(self, designer):
        r = requests.post(f"{API}/listings", headers=auth(designer["token"]), json={
            "type": "asset", "category": "skp", "title": "TEST_asset_nofile", "price": 50000,
        })
        assert r.status_code == 400

    def test_designer_create_service_and_asset(self, designer):
        r1 = requests.post(f"{API}/listings", headers=auth(designer["token"]), json={
            "type": "service", "category": "arsitektur", "title": "TEST_service",
            "price": 500000, "delivery_days": 7, "revisions": 2,
        })
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/listings", headers=auth(designer["token"]), json={
            "type": "asset", "category": "skp", "title": "TEST_asset",
            "price": 150000, "file_url": "https://example.com/f.skp", "file_format": "skp",
        })
        assert r2.status_code == 200
        # cleanup
        requests.delete(f"{API}/listings/{r1.json()['listing_id']}", headers=auth(designer["token"]))
        requests.delete(f"{API}/listings/{r2.json()['listing_id']}", headers=auth(designer["token"]))


# ---------- Cart ----------
class TestCart:
    def test_cart_flow_and_ownership(self, buyer, supplier):
        # find a material not owned by buyer
        listings = requests.get(f"{API}/listings", params={"tab": "all"}).json()
        material = next(l for l in listings if l["type"] == "material" and l["owner_id"] != "user_demo_buyer")

        # buyer adds to cart
        r = requests.post(f"{API}/cart/items", headers=auth(buyer["token"]),
                          json={"listing_id": material["listing_id"], "qty": 60})
        assert r.status_code == 200
        data = r.json()
        item = next(i for i in data["items"] if i["listing"]["listing_id"] == material["listing_id"])
        assert item["qty"] == 60
        # wholesale should trigger if tier exists at <=60
        if material.get("tiers"):
            min_tier_q = min(t["min_qty"] for t in material["tiers"])
            if 60 >= min_tier_q:
                assert item["is_wholesale"] is True

        # update qty
        r2 = requests.put(f"{API}/cart/items/{material['listing_id']}",
                          headers=auth(buyer["token"]), json={"qty": 2})
        assert r2.status_code == 200

        # remove
        r3 = requests.delete(f"{API}/cart/items/{material['listing_id']}",
                             headers=auth(buyer["token"]))
        assert r3.status_code == 200
        assert not any(i["listing"]["listing_id"] == material["listing_id"] for i in r3.json()["items"])

    def test_cannot_add_own_listing(self, supplier):
        own = requests.get(f"{API}/my/listings", headers=auth(supplier["token"])).json()
        if not own:
            pytest.skip("no owned listings")
        r = requests.post(f"{API}/cart/items", headers=auth(supplier["token"]),
                         json={"listing_id": own[0]["listing_id"], "qty": 1})
        assert r.status_code == 400


# ---------- Full checkout → pay → ship → release ----------
class TestOrderFlow:
    def test_full_escrow_flow(self, buyer, supplier):
        # clear buyer cart first
        cart = requests.get(f"{API}/cart", headers=auth(buyer["token"])).json()
        for it in cart["items"]:
            requests.delete(f"{API}/cart/items/{it['listing']['listing_id']}",
                            headers=auth(buyer["token"]))

        # pick a material and an asset
        listings = requests.get(f"{API}/listings", params={"tab": "all"}).json()
        mats = [l for l in listings if l["type"] == "material" and l["owner_id"] != "user_demo_buyer"]
        assets = requests.get(f"{API}/listings", params={"tab": "assets"}).json()
        if not mats or not assets:
            pytest.skip("insufficient seed data")
        mat = mats[0]
        asset = assets[0]

        # add both
        requests.post(f"{API}/cart/items", headers=auth(buyer["token"]),
                      json={"listing_id": mat["listing_id"], "qty": 2})
        requests.post(f"{API}/cart/items", headers=auth(buyer["token"]),
                      json={"listing_id": asset["listing_id"], "qty": 5})

        # verify asset qty forced to 1
        cart = requests.get(f"{API}/cart", headers=auth(buyer["token"])).json()
        asset_item = next(i for i in cart["items"] if i["listing"]["listing_id"] == asset["listing_id"])
        assert asset_item["qty"] == 1, "non-material qty must be 1"

        # checkout
        r = requests.post(f"{API}/checkout", headers=auth(buyer["token"]), json={
            "recipient": "Test Buyer", "phone": "081234567890",
            "address": "Jl. Test No. 1, Jakarta", "notes": "TEST order",
        })
        assert r.status_code == 200, r.text
        chk = r.json()
        payment_id = chk["payment_id"]
        order_ids = chk["orders"]
        assert len(order_ids) >= 1
        # service fee
        assert chk["service_fee"] == 2500

        # payment status
        p = requests.get(f"{API}/payments/{payment_id}", headers=auth(buyer["token"])).json()
        assert p["status"] == "pending"

        # pay
        pay = requests.post(f"{API}/payments/{payment_id}/pay", headers=auth(buyer["token"]))
        assert pay.status_code == 200
        assert pay.json()["status"] == "paid"

        time.sleep(0.5)
        # fetch orders as buyer
        orders = requests.get(f"{API}/orders", headers=auth(buyer["token"]), params={"role": "buyer"}).json()
        my_orders = [o for o in orders if o["order_id"] in order_ids]
        assert len(my_orders) == len(order_ids)

        mat_order = next((o for o in my_orders if any(i["type"] == "material" for i in o["items"])), None)
        asset_order = next((o for o in my_orders if all(i["type"] == "asset" for i in o["items"])), None)

        if asset_order:
            assert asset_order["status"] == "shipped", f"asset order should auto-ship, got {asset_order['status']}"
            # download asset
            aid = next(i["listing_id"] for i in asset_order["items"] if i["type"] == "asset")
            dr = requests.get(f"{API}/orders/{asset_order['order_id']}/download/{aid}",
                              headers=auth(buyer["token"]))
            assert dr.status_code == 200
            assert "file_url" in dr.json()

        if mat_order:
            assert mat_order["status"] == "held"
            # supplier ships
            if mat_order["seller_id"] == "user_demo_supplier":
                sr = requests.post(f"{API}/orders/{mat_order['order_id']}/ship",
                                   headers=auth(supplier["token"]), json={"note": "Dikirim via JNE"})
                assert sr.status_code == 200
                assert sr.json()["status"] == "shipped"
                # buyer releases
                rr = requests.post(f"{API}/orders/{mat_order['order_id']}/release",
                                   headers=auth(buyer["token"]))
                assert rr.status_code == 200
                assert rr.json()["status"] == "released"

    def test_seller_stats(self, supplier):
        r = requests.get(f"{API}/seller/stats", headers=auth(supplier["token"]))
        assert r.status_code == 200
        d = r.json()
        for k in ("held", "released", "orders", "pending_action", "listings"):
            assert k in d
