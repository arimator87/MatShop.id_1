"""Iteration 3 — Admin mediation, dispute evidence, cargo tracking, NPWP tax."""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


def _demo(role):
    r = requests.post(f"{API}/auth/demo", json={"role": role}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


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


def _clear_cart(tok):
    cart = requests.get(f"{API}/cart", headers=auth(tok)).json()
    for it in cart["items"]:
        requests.delete(f"{API}/cart/items/{it['listing']['listing_id']}", headers=auth(tok))


def _create_material(sup_tok, ship_method_fee=5000):
    r = requests.post(f"{API}/listings", headers=auth(sup_tok), json={
        "type": "material", "category": "plywood",
        "title": f"TEST_it3_{uuid.uuid4().hex[:6]}",
        "description": "test", "price": 100000, "unit": "lembar", "stock": 500,
        "images": ["https://x/img.jpg"],
        "shipping_fee_per_unit": ship_method_fee,
        "warehouse_location": "TEST Gudang BSD",
    })
    assert r.status_code == 200, r.text
    return r.json()


def _held_order(buyer_tok, sup_tok, shipping_method="pickup"):
    lst = _create_material(sup_tok)
    _clear_cart(buyer_tok)
    requests.post(f"{API}/cart/items", headers=auth(buyer_tok),
                  json={"listing_id": lst["listing_id"], "qty": 2})
    chk = requests.post(f"{API}/checkout", headers=auth(buyer_tok), json={
        "recipient": "Test", "phone": "081234567890",
        "address": "Jl. Proyek No.9, Jakarta",
        "shipping": {"user_demo_supplier": shipping_method},
    }).json()
    requests.post(f"{API}/payments/{chk['payment_id']}/pay", headers=auth(buyer_tok))
    return lst, chk["orders"][0]


# ===== Admin auth =====
class TestAdminAuth:
    def test_admin_demo_login(self, admin):
        assert admin["user"]["user_id"] == "user_demo_admin"
        assert admin["user"]["is_admin"] is True

    def test_non_admin_disputes_403(self, buyer):
        r = requests.get(f"{API}/admin/disputes", headers=auth(buyer["token"]))
        assert r.status_code == 403

    def test_admin_stats(self, admin):
        r = requests.get(f"{API}/admin/stats", headers=auth(admin["token"]))
        assert r.status_code == 200
        d = r.json()
        for k in ("open", "frozen_amount", "refunded", "released"):
            assert k in d

    def test_admin_disputes_list(self, admin):
        r = requests.get(f"{API}/admin/disputes", headers=auth(admin["token"]), params={"state": "open"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ===== Admin resolve =====
class TestAdminResolve:
    def test_resolve_refund_buyer(self, buyer, supplier, admin):
        lst, oid = _held_order(buyer["token"], supplier["token"])
        try:
            # open dispute
            requests.post(f"{API}/orders/{oid}/dispute", headers=auth(buyer["token"]),
                          json={"reason": "Barang rusak parah tidak sesuai"})
            # admin resolve
            r = requests.post(f"{API}/admin/orders/{oid}/resolve",
                              headers=auth(admin["token"]),
                              json={"decision": "refund_buyer", "note": "Terbukti rusak dari foto"})
            assert r.status_code == 200
            d = r.json()
            assert d["status"] == "refunded"
            assert d["dispute"]["status"] == "resolved"
            assert d["dispute"]["decision"] == "refund_buyer"
            assert d["dispute"]["admin_note"].startswith("Terbukti")
        finally:
            requests.delete(f"{API}/listings/{lst['listing_id']}", headers=auth(supplier["token"]))

    def test_resolve_release_vendor(self, buyer, supplier, admin):
        lst, oid = _held_order(buyer["token"], supplier["token"])
        try:
            requests.post(f"{API}/orders/{oid}/dispute", headers=auth(buyer["token"]),
                          json={"reason": "Belum sampai padahal invoice sudah bayar"})
            r = requests.post(f"{API}/admin/orders/{oid}/resolve",
                              headers=auth(admin["token"]),
                              json={"decision": "release_vendor", "note": "Bukti pengiriman valid"})
            assert r.status_code == 200
            d = r.json()
            assert d["status"] == "released"
            assert d["dispute"]["decision"] == "release_vendor"
        finally:
            requests.delete(f"{API}/listings/{lst['listing_id']}", headers=auth(supplier["token"]))

    def test_resolve_non_disputed_400(self, buyer, supplier, admin):
        lst, oid = _held_order(buyer["token"], supplier["token"])
        try:
            r = requests.post(f"{API}/admin/orders/{oid}/resolve",
                              headers=auth(admin["token"]),
                              json={"decision": "refund_buyer", "note": "bukan dispute"})
            assert r.status_code == 400
        finally:
            requests.delete(f"{API}/listings/{lst['listing_id']}", headers=auth(supplier["token"]))

    def test_resolve_invalid_decision(self, buyer, supplier, admin):
        lst, oid = _held_order(buyer["token"], supplier["token"])
        try:
            requests.post(f"{API}/orders/{oid}/dispute", headers=auth(buyer["token"]),
                          json={"reason": "foo bar baz lorem"})
            r = requests.post(f"{API}/admin/orders/{oid}/resolve",
                              headers=auth(admin["token"]),
                              json={"decision": "bogus", "note": "test invalid"})
            assert r.status_code == 400
        finally:
            requests.delete(f"{API}/listings/{lst['listing_id']}", headers=auth(supplier["token"]))

    def test_admin_can_see_any_order(self, buyer, supplier, admin):
        # find_order allows admin to view foreign orders
        lst, oid = _held_order(buyer["token"], supplier["token"])
        try:
            r = requests.get(f"{API}/orders/{oid}", headers=auth(admin["token"]))
            assert r.status_code == 200
            assert r.json()["order_id"] == oid
        finally:
            requests.delete(f"{API}/listings/{lst['listing_id']}", headers=auth(supplier["token"]))


# ===== Dispute evidence =====
class TestDisputeEvidence:
    def test_dispute_accepts_evidence(self, buyer, supplier):
        lst, oid = _held_order(buyer["token"], supplier["token"])
        try:
            evidence = [f"/api/files/img_{i}.jpg" for i in range(3)]
            r = requests.post(f"{API}/orders/{oid}/dispute", headers=auth(buyer["token"]),
                              json={"reason": "Barang pecah lihat foto", "evidence": evidence})
            assert r.status_code == 200
            assert r.json()["dispute"]["evidence"] == evidence
        finally:
            requests.delete(f"{API}/listings/{lst['listing_id']}", headers=auth(supplier["token"]))

    def test_dispute_evidence_max_6(self, buyer, supplier):
        lst, oid = _held_order(buyer["token"], supplier["token"])
        try:
            evidence = [f"/x/{i}.jpg" for i in range(7)]
            r = requests.post(f"{API}/orders/{oid}/dispute", headers=auth(buyer["token"]),
                              json={"reason": "banyak sekali foto", "evidence": evidence})
            assert r.status_code == 422
        finally:
            requests.delete(f"{API}/listings/{lst['listing_id']}", headers=auth(supplier["token"]))

    def test_seller_sees_evidence(self, buyer, supplier):
        lst, oid = _held_order(buyer["token"], supplier["token"])
        try:
            ev = ["/api/files/a.jpg"]
            requests.post(f"{API}/orders/{oid}/dispute", headers=auth(buyer["token"]),
                          json={"reason": "foto terlampir", "evidence": ev})
            o = requests.get(f"{API}/orders/{oid}", headers=auth(supplier["token"])).json()
            assert o.get("dispute", {}).get("evidence") == ev
        finally:
            requests.delete(f"{API}/listings/{lst['listing_id']}", headers=auth(supplier["token"]))

    def test_uploads_requires_auth(self):
        r = requests.post(f"{API}/uploads", files={"file": ("x.jpg", b"\x00\x00", "image/jpeg")})
        assert r.status_code == 401

    def test_uploads_image_ok(self, buyer):
        # small valid JPEG header
        content = (b"\xff\xd8\xff\xe0" + b"\x00" * 100)
        r = requests.post(f"{API}/uploads", headers=auth(buyer["token"]),
                         files={"file": ("evidence.jpg", content, "image/jpeg")})
        assert r.status_code == 200, r.text
        assert "url" in r.json() and r.json()["url"].startswith("/api/files/")

    def test_uploads_bad_type(self, buyer):
        r = requests.post(f"{API}/uploads", headers=auth(buyer["token"]),
                         files={"file": ("x.pdf", b"%PDF-1.4", "application/pdf")})
        assert r.status_code == 400


# ===== Cargo tracking =====
class TestTracking:
    def test_cargo_ship_initializes_tracking(self, buyer, supplier):
        lst, oid = _held_order(buyer["token"], supplier["token"], shipping_method="vendor_cargo")
        try:
            # supplier ships
            sr = requests.post(f"{API}/orders/{oid}/ship", headers=auth(supplier["token"]),
                               json={"note": "Berangkat sekarang"})
            assert sr.status_code == 200
            o = requests.get(f"{API}/orders/{oid}", headers=auth(buyer["token"])).json()
            stages = [t["stage"] for t in o.get("tracking") or []]
            assert "loading" in stages and "departed" in stages
        finally:
            requests.delete(f"{API}/listings/{lst['listing_id']}", headers=auth(supplier["token"]))

    def test_tracking_forward_in_transit_arrived(self, buyer, supplier):
        lst, oid = _held_order(buyer["token"], supplier["token"], shipping_method="vendor_cargo")
        try:
            requests.post(f"{API}/orders/{oid}/ship", headers=auth(supplier["token"]),
                          json={"note": "shipping now"})
            # in_transit
            r1 = requests.post(f"{API}/orders/{oid}/tracking", headers=auth(supplier["token"]),
                               json={"stage": "in_transit", "location": "Tol Jagorawi KM 15",
                                     "note": "Perjalanan lancar"})
            assert r1.status_code == 200, r1.text
            # repeat in_transit allowed
            r2 = requests.post(f"{API}/orders/{oid}/tracking", headers=auth(supplier["token"]),
                               json={"stage": "in_transit", "location": "Rest Area"})
            assert r2.status_code == 200
            # arrived (location defaults to project address when empty)
            r3 = requests.post(f"{API}/orders/{oid}/tracking", headers=auth(supplier["token"]),
                               json={"stage": "arrived", "location": ""})
            assert r3.status_code == 200
            o = r3.json()
            last = o["tracking"][-1]
            assert last["stage"] == "arrived"
            assert "Jl. Proyek" in last["location"]
            # after arrived, further tracking rejected
            r4 = requests.post(f"{API}/orders/{oid}/tracking", headers=auth(supplier["token"]),
                               json={"stage": "arrived", "location": "x"})
            assert r4.status_code == 400
        finally:
            requests.delete(f"{API}/listings/{lst['listing_id']}", headers=auth(supplier["token"]))

    def test_tracking_backward_rejected(self, buyer, supplier):
        lst, oid = _held_order(buyer["token"], supplier["token"], shipping_method="vendor_cargo")
        try:
            requests.post(f"{API}/orders/{oid}/ship", headers=auth(supplier["token"]),
                          json={"note": "ship"})
            # last stage after ship is 'departed'; attempting 'loading' should fail
            r = requests.post(f"{API}/orders/{oid}/tracking", headers=auth(supplier["token"]),
                              json={"stage": "loading", "location": "x"})
            assert r.status_code == 400
        finally:
            requests.delete(f"{API}/listings/{lst['listing_id']}", headers=auth(supplier["token"]))

    def test_tracking_rejected_for_pickup(self, buyer, supplier):
        lst, oid = _held_order(buyer["token"], supplier["token"], shipping_method="pickup")
        try:
            requests.post(f"{API}/orders/{oid}/ship", headers=auth(supplier["token"]),
                          json={"note": "ready"})
            r = requests.post(f"{API}/orders/{oid}/tracking", headers=auth(supplier["token"]),
                              json={"stage": "in_transit", "location": "x"})
            assert r.status_code == 400
        finally:
            requests.delete(f"{API}/listings/{lst['listing_id']}", headers=auth(supplier["token"]))


# ===== NPWP / Tax =====
class TestTaxInfo:
    def test_npwp_validation_15or16(self, buyer):
        bad = requests.put(f"{API}/users/tax-profile", headers=auth(buyer["token"]),
                           json={"company_name": "PT Testing", "npwp": "1234", "company_address": "Jl. Pajak 1"})
        assert bad.status_code == 422
        ok = requests.put(f"{API}/users/tax-profile", headers=auth(buyer["token"]),
                          json={"company_name": "PT Testing", "npwp": "01.234.567.8-901.000",
                                "company_address": "Jl. Pajak No.1, Jakarta"})
        assert ok.status_code == 200
        # digits stripped and saved on user
        me = requests.get(f"{API}/auth/me", headers=auth(buyer["token"])).json()
        assert me["tax_profile"]["npwp"] == "012345678901000"

    def test_checkout_saves_tax_info_and_prefills(self, buyer, supplier):
        lst = _create_material(supplier["token"])
        try:
            _clear_cart(buyer["token"])
            requests.post(f"{API}/cart/items", headers=auth(buyer["token"]),
                          json={"listing_id": lst["listing_id"], "qty": 1})
            tax = {"company_name": "PT MatShop Buyer",
                   "npwp": "99.888.777.6-555.000",
                   "company_address": "Jl. Faktur 10, Jakarta"}
            chk = requests.post(f"{API}/checkout", headers=auth(buyer["token"]), json={
                "recipient": "Test Buyer", "phone": "0812345678", "address": "Jl. Proyek Site",
                "shipping": {"user_demo_supplier": "pickup"},
                "tax_info": tax,
            }).json()
            oid = chk["orders"][0]
            # pay then verify order.tax_info persisted
            requests.post(f"{API}/payments/{chk['payment_id']}/pay", headers=auth(buyer["token"]))
            o = requests.get(f"{API}/orders/{oid}", headers=auth(buyer["token"])).json()
            assert o["tax_info"]["npwp"] == "998887776555000"
            assert o["tax_info"]["company_name"] == "PT MatShop Buyer"
            # user.tax_profile also saved
            me = requests.get(f"{API}/auth/me", headers=auth(buyer["token"])).json()
            assert me["tax_profile"]["npwp"] == "998887776555000"
            # invoice PDF includes NPWP + DPP/PPN rows (basic check: PDF built OK)
            pdf = requests.get(f"{API}/orders/{oid}/invoice.pdf", headers=auth(buyer["token"]))
            assert pdf.status_code == 200
            assert pdf.content[:4] == b"%PDF"
        finally:
            _clear_cart(buyer["token"])
            requests.delete(f"{API}/listings/{lst['listing_id']}", headers=auth(supplier["token"]))

    def test_order_tax_info_put(self, buyer, supplier):
        lst, oid = _held_order(buyer["token"], supplier["token"])
        try:
            r = requests.put(f"{API}/orders/{oid}/tax-info", headers=auth(buyer["token"]),
                             json={"company_name": "PT Edited",
                                   "npwp": "112233445566778",
                                   "company_address": "Jl. Baru No.5, Bandung"})
            assert r.status_code == 200
            o = requests.get(f"{API}/orders/{oid}", headers=auth(buyer["token"])).json()
            assert o["tax_info"]["company_name"] == "PT Edited"
            assert o["tax_info"]["npwp"] == "112233445566778"
        finally:
            requests.delete(f"{API}/listings/{lst['listing_id']}", headers=auth(supplier["token"]))

    def test_order_tax_info_not_owner_404(self, buyer, supplier, designer):
        lst, oid = _held_order(buyer["token"], supplier["token"])
        try:
            r = requests.put(f"{API}/orders/{oid}/tax-info", headers=auth(designer["token"]),
                             json={"company_name": "Hack",
                                   "npwp": "112233445566778",
                                   "company_address": "attacker addr"})
            assert r.status_code == 404
        finally:
            requests.delete(f"{API}/listings/{lst['listing_id']}", headers=auth(supplier["token"]))
