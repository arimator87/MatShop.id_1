"""Backend tests for Reviews / Portfolios / Vendor Profile (iteration 8)."""
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


# ---------- Portfolios filters ----------
def test_portfolios_filters_meta():
    r = requests.get(f"{API}/portfolios/filters", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d["cities"], list)
    for c in ["Bandung", "Bekasi", "Jakarta", "Jepara"]:
        assert c in d["cities"], f"missing city {c} in {d['cities']}"
    assert "kitchen_set" in d["work_types"]
    assert d["work_types"]["kitchen_set"] == "Kitchen Set"


def test_portfolios_list_default():
    r = requests.get(f"{API}/portfolios", timeout=20)
    assert r.status_code == 200
    docs = r.json()
    assert len(docs) >= 2
    for d in docs:
        assert "city" in d and "work_types" in d
        assert "rating_avg" in d and "review_count" in d
        assert "photos" in d and len(d["photos"]) >= 1


def test_portfolios_filter_city_bandung():
    r = requests.get(f"{API}/portfolios", params={"city": "Bandung"}, timeout=20)
    assert r.status_code == 200
    docs = r.json()
    assert len(docs) >= 1
    assert all(d["city"].lower() == "bandung" for d in docs)


def test_portfolios_filter_work_type_kitchen_set():
    r = requests.get(f"{API}/portfolios", params={"work_type": "kitchen_set"}, timeout=20)
    assert r.status_code == 200
    docs = r.json()
    assert len(docs) >= 1
    assert all("kitchen_set" in d["work_types"] for d in docs)


def test_portfolios_sort_rating_desc():
    r = requests.get(f"{API}/portfolios", params={"sort": "rating"}, timeout=20)
    assert r.status_code == 200
    docs = r.json()
    ratings = [d["rating_avg"] for d in docs]
    assert ratings == sorted(ratings, reverse=True)


# ---------- Vendor profile ----------
def test_vendor_profile_showcase_workshop():
    r = requests.get(f"{API}/vendors/user_showcase_workshop", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["user_id"] == "user_showcase_workshop"
    assert d["city"] == "Jepara"
    assert "kitchen_set" in d["work_types"]
    assert d["review_count"] >= 3
    assert d["rating_avg"] >= 4
    assert "breakdown" in d and set(d["breakdown"].keys()) == {5, 4, 3, 2, 1} or set(map(int, d["breakdown"].keys())) == {5, 4, 3, 2, 1}
    assert isinstance(d["reviews"], list) and len(d["reviews"]) >= 3


def test_vendor_profile_unknown_404():
    r = requests.get(f"{API}/vendors/unknown_user_xx", timeout=20)
    assert r.status_code == 404


# ---------- Review from order flow ----------
_cache = {}


def _create_order_release(buyer_sess, buyer_user, supplier_sess):
    # Pick first material listing owned by supplier
    r = buyer_sess.get(f"{API}/listings", params={"type": "material", "limit": 5}, timeout=20)
    listing = next(l for l in r.json() if l["owner_id"] == "user_demo_supplier")
    # Add to cart (fresh cart)
    buyer_sess.delete(f"{API}/cart/items/{listing['listing_id']}", timeout=20)
    r = buyer_sess.post(f"{API}/cart/items", json={"listing_id": listing["listing_id"], "qty": 2}, timeout=20)
    assert r.status_code == 200
    # Checkout
    r = buyer_sess.post(f"{API}/checkout", json={
        "recipient": "TEST Buyer", "phone": "081234567890",
        "address": "Jl. Testing No. 1 Kebayoran", "notes": "",
        "shipping": {"user_demo_supplier": "pickup"},
    }, timeout=20)
    assert r.status_code == 200, r.text
    pay_id = r.json()["payment_id"]
    order_id = r.json()["orders"][0]
    # Pay
    r = buyer_sess.post(f"{API}/payments/{pay_id}/pay", timeout=20)
    assert r.status_code == 200
    # Ship
    r = supplier_sess.post(f"{API}/orders/{order_id}/ship",
                           json={"note": "TEST shipped for review flow"}, timeout=20)
    assert r.status_code == 200, r.text
    # Release
    r = buyer_sess.post(f"{API}/orders/{order_id}/release", timeout=20)
    assert r.status_code == 200
    assert r.json()["status"] == "released"
    return order_id


def test_review_order_e2e(buyer, supplier):
    buy_sess, buy_user = buyer
    sup_sess, _ = supplier
    order_id = _create_order_release(buy_sess, buy_user, sup_sess)
    _cache["order_id"] = order_id

    # Validation: rating out of range
    r = buy_sess.post(f"{API}/reviews",
                      json={"source": "order", "ref_id": order_id, "rating": 6,
                            "comment": "Produk bagus sekali"}, timeout=20)
    assert r.status_code == 422

    # Validation: comment too short
    r = buy_sess.post(f"{API}/reviews",
                      json={"source": "order", "ref_id": order_id, "rating": 5, "comment": "short"}, timeout=20)
    assert r.status_code == 422

    # Success
    r = buy_sess.post(f"{API}/reviews",
                      json={"source": "order", "ref_id": order_id, "rating": 5,
                            "comment": "Material datang tepat waktu, kualitas sesuai spesifikasi."}, timeout=20)
    assert r.status_code == 200, r.text
    rev = r.json()
    assert rev["rating"] == 5
    assert rev["vendor_id"] == "user_demo_supplier"
    assert rev["reviewer_id"] == buy_user["user_id"]

    # Duplicate -> 400
    r = buy_sess.post(f"{API}/reviews",
                      json={"source": "order", "ref_id": order_id, "rating": 4,
                            "comment": "Mencoba review kedua."}, timeout=20)
    assert r.status_code == 400

    # GET /reviews/ref/{ref_id}
    r = buy_sess.get(f"{API}/reviews/ref/{order_id}", timeout=20)
    assert r.status_code == 200
    assert r.json()["review_id"] == rev["review_id"]


def test_review_non_released_order_400(buyer, supplier):
    buy_sess, buy_user = buyer
    sup_sess, _ = supplier
    # Create a new order and only pay (status=held), not shipped/released
    r = buy_sess.get(f"{API}/listings", params={"type": "material", "limit": 5}, timeout=20)
    listing = next(l for l in r.json() if l["owner_id"] == "user_demo_supplier")
    buy_sess.delete(f"{API}/cart/items/{listing['listing_id']}", timeout=20)
    buy_sess.post(f"{API}/cart/items", json={"listing_id": listing["listing_id"], "qty": 1}, timeout=20)
    r = buy_sess.post(f"{API}/checkout", json={
        "recipient": "TEST Buyer", "phone": "081234567890",
        "address": "Jl. Testing No. 1", "notes": "",
        "shipping": {"user_demo_supplier": "pickup"},
    }, timeout=20)
    pay_id = r.json()["payment_id"]
    order_id = r.json()["orders"][0]
    buy_sess.post(f"{API}/payments/{pay_id}/pay", timeout=20)

    r = buy_sess.post(f"{API}/reviews",
                      json={"source": "order", "ref_id": order_id, "rating": 5,
                            "comment": "Belum selesai tapi coba review"}, timeout=20)
    assert r.status_code == 400

    # another user cannot review this order (designer tries)
    des_sess, _ = demo_session("designer_creator")
    r = des_sess.post(f"{API}/reviews",
                      json={"source": "order", "ref_id": order_id, "rating": 5,
                            "comment": "Bukan buyer saya, test akses"}, timeout=20)
    assert r.status_code == 404


def test_review_ref_null_for_unreviewed(buyer):
    buy_sess, _ = buyer
    r = buy_sess.get(f"{API}/reviews/ref/nonexistent_ref_xyz", timeout=20)
    assert r.status_code == 200
    assert r.json() is None


# ---------- Review via project (completed) ----------
def test_review_project_completed(buyer, supplier, admin):
    buy_sess, buy_user = buyer
    sup_sess, _ = supplier
    adm_sess, _ = admin

    # Create + approve + bid + accept + run full milestone flow
    body = {
        "work_type": "kitchen_set", "size": 4, "finishing": "hpl",
        "budget": 12_000_000,
        "title": "TEST_Review Project Kitchen",
        "description": "Testing custom project completion for review flow.",
        "address": "Jl. Review No. 1",
        "city": "Jakarta", "phone": "081234567890",
        "survey_date": "2026-02-01", "photos": [],
    }
    r = buy_sess.post(f"{API}/custom/projects", json=body, timeout=20)
    assert r.status_code == 200, r.text
    pid = r.json()["project_id"]

    # Approve
    r = adm_sess.post(f"{API}/custom/admin/projects/{pid}/approve", json={"note": "ok"}, timeout=20)
    assert r.status_code == 200

    # Supplier bids
    r = sup_sess.post(f"{API}/custom/projects/{pid}/bids", json={
        "duration_days": 20, "notes": "",
        "material_spec": "Plywood 18mm + HPL Taco, engsel Blum full-extension",
        "rab_items": [{"item": "Full", "qty": 1, "unit": "ls", "price": 12_000_000}],
    }, timeout=20)
    assert r.status_code == 200, r.text
    bid_id = r.json()["bid_id"]

    # Accept + pay M1
    r = buy_sess.post(f"{API}/custom/projects/{pid}/bids/{bid_id}/accept", timeout=20)
    assert r.status_code == 200
    r = buy_sess.post(f"{API}/custom/projects/{pid}/milestones/m1/pay", timeout=20)
    assert r.status_code == 200

    # Run m1-m3
    for mid in ("m1", "m2", "m3"):
        if mid != "m1":
            r = buy_sess.post(f"{API}/custom/projects/{pid}/milestones/{mid}/pay", timeout=20)
            assert r.status_code == 200, r.text
        r = sup_sess.post(f"{API}/custom/projects/{pid}/milestones/{mid}/submit",
                          json={"note": f"TEST submit {mid}"}, timeout=20)
        assert r.status_code == 200, r.text
        r = buy_sess.post(f"{API}/custom/projects/{pid}/milestones/{mid}/release", timeout=20)
        assert r.status_code == 200, r.text

    # Verify completed
    r = buy_sess.get(f"{API}/custom/projects/{pid}", timeout=20)
    assert r.status_code == 200
    assert r.json()["status"] == "completed"

    # Non-client cannot review
    des_sess, _ = demo_session("designer_creator")
    r = des_sess.post(f"{API}/reviews",
                      json={"source": "project", "ref_id": pid, "rating": 5,
                            "comment": "Bukan client, test akses"}, timeout=20)
    assert r.status_code == 404

    # Client review succeeds
    r = buy_sess.post(f"{API}/reviews",
                      json={"source": "project", "ref_id": pid, "rating": 5,
                            "comment": "Proyek selesai sesuai timeline, hasil rapi."}, timeout=20)
    assert r.status_code == 200, r.text


# ---------- Business profile accepts city/work_types ----------
def test_business_profile_city_work_types_persisted(admin):
    # Create a fresh test user via session hack? Use designer (verified) — but updating resets to PENDING.
    # Use a throwaway: create new user_sessions-less — not possible. Use buyer who doesn't have profile.
    buy_sess, buy_user = demo_session("contractor_buyer")
    # Buyer has no business_profile; submit then verify immediate persistence of city/work_types.
    r = buy_sess.put(f"{API}/users/business-profile", json={
        "business_name": "TEST CV Review", "address": "Jl. Testing 2",
        "portfolio_url": "https://example.com/p", "photos": ["https://img/1.jpg"],
        "pic_name": "PIC Test", "pic_phone": "081234500099",
        "city": "Surabaya", "work_types": ["kitchen_set", "furniture"],
    }, timeout=20)
    assert r.status_code == 200, r.text
    u = r.json()
    bp = u["business_profile"]
    assert bp["city"] == "Surabaya"
    assert "kitchen_set" in bp["work_types"]
    assert u["verification_status"] == "PENDING"
    # NOTE: buyer demo got business_profile submitted — admin will later see pending; not auto-cleaned.


# ---------- Cleanup: restore demo supplier verification if trashed ----------
def test_zz_restore_demo_supplier_verified(admin):
    adm_sess, _ = admin
    # Ensure demo supplier is VERIFIED (in case any test flipped it to PENDING via profile submit)
    r = adm_sess.get(f"{API}/admin/vendors", params={"status": "PENDING"}, timeout=20)
    for v in r.json():
        if v["user_id"] == "user_demo_supplier":
            adm_sess.post(f"{API}/admin/vendors/user_demo_supplier/verify",
                          json={"status": "VERIFIED", "note": ""}, timeout=20)
            break
