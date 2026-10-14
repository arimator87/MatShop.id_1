"""Iteration 9: vendor reply to reviews + review photos + bid vendor rating."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def demo(role):
    s = requests.Session()
    r = s.post(f"{API}/auth/demo", json={"role": role}, timeout=30)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s, r.json()["user"]


@pytest.fixture(scope="module")
def buyer():
    return demo("contractor_buyer")


@pytest.fixture(scope="module")
def supplier():
    return demo("supplier_vendor")


@pytest.fixture(scope="module")
def designer():
    return demo("designer_creator")


@pytest.fixture(scope="module")
def admin():
    return demo("admin")


# ---------- Helpers ----------
def create_released_order(buy_sess, sup_sess):
    r = buy_sess.get(f"{API}/listings", params={"type": "material", "limit": 5}, timeout=20)
    listing = next(l for l in r.json() if l["owner_id"] == "user_demo_supplier")
    buy_sess.delete(f"{API}/cart/items/{listing['listing_id']}", timeout=20)
    r = buy_sess.post(f"{API}/cart/items", json={"listing_id": listing["listing_id"], "qty": 1}, timeout=20)
    assert r.status_code == 200
    r = buy_sess.post(f"{API}/checkout", json={
        "recipient": "TEST Buyer", "phone": "081234567890",
        "address": "Jl. Review Reply No. 9", "notes": "",
        "shipping": {"user_demo_supplier": "pickup"},
    }, timeout=20)
    assert r.status_code == 200, r.text
    pay_id = r.json()["payment_id"]
    order_id = r.json()["orders"][0]
    assert buy_sess.post(f"{API}/payments/{pay_id}/pay", timeout=20).status_code == 200
    assert sup_sess.post(f"{API}/orders/{order_id}/ship", json={"note": "ship"}, timeout=20).status_code == 200
    assert buy_sess.post(f"{API}/orders/{order_id}/release", timeout=20).status_code == 200
    return order_id


# ---------- Review photos ----------
def test_review_with_photos_persists(buyer, supplier):
    buy_sess, _ = buyer
    sup_sess, _ = supplier
    order_id = create_released_order(buy_sess, sup_sess)
    photos = [f"https://img.example.com/p{i}.jpg" for i in range(4)]
    r = buy_sess.post(f"{API}/reviews", json={
        "source": "order", "ref_id": order_id, "rating": 5,
        "comment": "Hasil material sangat memuaskan, kualitas premium.",
        "photos": photos,
    }, timeout=20)
    assert r.status_code == 200, r.text
    rev = r.json()
    assert rev["photos"] == photos
    # Verify persistence via vendor profile
    r = requests.get(f"{API}/vendors/user_demo_supplier", timeout=20)
    assert r.status_code == 200
    found = next((x for x in r.json()["reviews"] if x["review_id"] == rev["review_id"]), None)
    assert found and found["photos"] == photos


def test_review_photos_exceeds_max_422(buyer, supplier):
    buy_sess, _ = buyer
    sup_sess, _ = supplier
    order_id = create_released_order(buy_sess, sup_sess)
    photos = [f"https://img.example.com/x{i}.jpg" for i in range(5)]
    r = buy_sess.post(f"{API}/reviews", json={
        "source": "order", "ref_id": order_id, "rating": 4,
        "comment": "Lebih dari 4 foto harus ditolak.",
        "photos": photos,
    }, timeout=20)
    assert r.status_code == 422


# ---------- Reply to review ----------
_cache = {}


def _get_supplier_real_review(buy_sess, sup_sess):
    """Create (if needed) a real (non-seed) review on user_demo_supplier by buyer."""
    order_id = create_released_order(buy_sess, sup_sess)
    r = buy_sess.post(f"{API}/reviews", json={
        "source": "order", "ref_id": order_id, "rating": 5,
        "comment": "Reply flow test — review real non-seed.",
    }, timeout=20)
    assert r.status_code == 200
    return r.json()


def test_reply_vendor_owner_ok_edit_and_other_forbidden(buyer, supplier, designer):
    buy_sess, buy_user = buyer
    sup_sess, _ = supplier
    des_sess, _ = designer
    rev = _get_supplier_real_review(buy_sess, sup_sess)
    rid = rev["review_id"]
    _cache["review_id"] = rid
    _cache["reviewer_id"] = buy_user["user_id"]

    # Text too short -> 422
    r = sup_sess.put(f"{API}/reviews/{rid}/reply", json={"text": "ok"}, timeout=20)
    assert r.status_code == 422

    # First reply by vendor owner
    r = sup_sess.put(f"{API}/reviews/{rid}/reply", json={"text": "Terima kasih atas ulasannya!"}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["reply"]["text"] == "Terima kasih atas ulasannya!"
    first_at = data["reply"]["at"]
    assert data["reply"]["edited_at"] is None

    # Edit reply - at preserved, edited_at set
    r = sup_sess.put(f"{API}/reviews/{rid}/reply", json={"text": "Terima kasih sudah berbelanja di toko kami!"}, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["reply"]["at"] == first_at
    assert data["reply"]["edited_at"] is not None
    assert data["reply"]["text"] == "Terima kasih sudah berbelanja di toko kami!"

    # Designer (not vendor owner) -> 403
    r = des_sess.put(f"{API}/reviews/{rid}/reply", json={"text": "Saya bukan vendor"}, timeout=20)
    assert r.status_code == 403

    # Buyer (reviewer, not vendor) -> 403
    r = buy_sess.put(f"{API}/reviews/{rid}/reply", json={"text": "Saya reviewer"}, timeout=20)
    assert r.status_code == 403


def test_reply_unknown_review_404(supplier):
    sup_sess, _ = supplier
    r = sup_sess.put(f"{API}/reviews/rev_doesnotexist/reply", json={"text": "halo dunia"}, timeout=20)
    assert r.status_code == 404


def test_reply_notification_to_reviewer(buyer):
    buy_sess, _ = buyer
    r = buy_sess.get(f"{API}/notifications", timeout=20)
    assert r.status_code == 200
    data = r.json()
    notifs = data["items"] if isinstance(data, dict) and "items" in data else data
    assert any("membalas ulasan" in (n.get("title") or "").lower() for n in notifs), \
        f"Expected 'Vendor membalas ulasan Anda' notification; got: {[n.get('title') for n in notifs][:10]}"


def test_reply_seed_review_no_notification(supplier):
    """Seeded review rev_seed_7 (user_demo_supplier) reviewer_id='seed' -> replying must not create notif."""
    sup_sess, _ = supplier
    # Find a seed review on user_demo_supplier
    r = requests.get(f"{API}/vendors/user_demo_supplier", timeout=20)
    seed_rev = next((x for x in r.json()["reviews"] if x["reviewer_id"] == "seed"), None)
    if not seed_rev:
        pytest.skip("No seed review found on user_demo_supplier")
    rid = seed_rev["review_id"]
    r = sup_sess.put(f"{API}/reviews/{rid}/reply", json={"text": "Terima kasih atas ulasan seed-nya"}, timeout=20)
    assert r.status_code == 200
    # No way to query reviewer 'seed' notifications; just ensure endpoint succeeded without error.


# ---------- Bid vendor rating in custom project ----------
def test_custom_project_bids_include_vendor_rating(buyer, supplier, admin):
    buy_sess, _ = buyer
    sup_sess, _ = supplier
    adm_sess, _ = admin
    body = {
        "work_type": "kitchen_set", "size": 3, "finishing": "hpl",
        "budget": 8_000_000,
        "title": "TEST_Iter9 Bid Rating Project",
        "description": "Testing bid vendor_rating & review count payload.",
        "address": "Jl. Bid Rating No. 1", "city": "Jakarta", "phone": "081234567890",
        "survey_date": "2026-02-10", "photos": [],
    }
    r = buy_sess.post(f"{API}/custom/projects", json=body, timeout=20)
    assert r.status_code == 200
    pid = r.json()["project_id"]
    assert adm_sess.post(f"{API}/custom/admin/projects/{pid}/approve", json={"note": "ok"}, timeout=20).status_code == 200
    r = sup_sess.post(f"{API}/custom/projects/{pid}/bids", json={
        "duration_days": 15, "notes": "",
        "material_spec": "Plywood 18mm meranti + HPL Taco solid walnut",
        "rab_items": [{"item": "Full package", "qty": 1, "unit": "ls", "price": 8_000_000}],
    }, timeout=20)
    assert r.status_code == 200

    r = buy_sess.get(f"{API}/custom/projects/{pid}", timeout=20)
    assert r.status_code == 200
    bids = r.json()["bids"]
    assert len(bids) == 1
    b = bids[0]
    assert "vendor_rating" in b and "vendor_review_count" in b
    assert isinstance(b["vendor_rating"], (int, float))
    assert isinstance(b["vendor_review_count"], int)
    assert b["vendor_review_count"] >= 1  # supplier has real + seed reviews
