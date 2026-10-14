"""Backend tests for Custom Furniture / Fit-Out project module (iteration 4)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://matshop-3.preview.emergentagent.com").rstrip("/")
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


# ---------- Meta & estimate ----------
def test_meta():
    r = requests.get(f"{API}/custom/meta", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert set(d["work_types"]) == {"kitchen_set", "wardrobe", "full_interior"}
    assert set(d["finishing"]) == {"hpl", "duco"}
    assert [m["pct"] for m in d["milestones"]] == [30, 40, 30]


@pytest.mark.parametrize("wt,fin,size,lo,hi", [
    ("kitchen_set", "hpl", 4, 2_500_000 * 4, 3_500_000 * 4),
    ("kitchen_set", "duco", 4, 4_000_000 * 4, 5_500_000 * 4),
    ("wardrobe", "hpl", 3, 2_800_000 * 3, 3_800_000 * 3),
    ("wardrobe", "duco", 3, 4_500_000 * 3, 6_000_000 * 3),
    ("full_interior", "hpl", 36, 2_500_000 * 36, 4_000_000 * 36),
    ("full_interior", "duco", 36, 3_500_000 * 36, 5_500_000 * 36),
])
def test_estimate(wt, fin, size, lo, hi):
    r = requests.post(f"{API}/custom/estimate", json={"work_type": wt, "size": size, "finishing": fin}, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["min"] == lo
    assert d["max"] == hi


def test_estimate_invalid():
    r = requests.post(f"{API}/custom/estimate", json={"work_type": "bad", "size": 1, "finishing": "hpl"}, timeout=20)
    assert r.status_code == 400


# ---------- Project create / listing / opportunities ----------
_project_cache = {}


def _create_project(sess):
    body = {
        "work_type": "kitchen_set", "size": 4, "finishing": "hpl",
        "title": "TEST_Kitchen Set 4m HPL",
        "description": "Butuh kitchen set bentuk L dengan rak atas dan bawah.",
        "address": "Jl. Testing No. 1 Kebayoran",
        "city": "Jakarta Selatan", "phone": "081234567890",
        "survey_date": "2026-02-01", "photos": [],
    }
    r = sess.post(f"{API}/custom/projects", json=body, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def test_create_project_requires_auth():
    r = requests.post(f"{API}/custom/projects", json={
        "work_type": "kitchen_set", "size": 4, "finishing": "hpl",
        "title": "Valid title", "description": "Valid description here",
        "address": "Valid address", "city": "Jakarta", "phone": "081234567",
    }, timeout=20)
    assert r.status_code == 401


def test_create_project_min_length_validation(buyer):
    sess, _ = buyer
    r = sess.post(f"{API}/custom/projects", json={"work_type": "kitchen_set", "size": 4, "finishing": "hpl",
                                                  "title": "ab", "description": "short", "address": "x",
                                                  "city": "x", "phone": "x"}, timeout=20)
    assert r.status_code == 422


def test_create_project_and_persist(buyer):
    sess, user = buyer
    p = _create_project(sess)
    _project_cache["id"] = p["project_id"]
    assert p["status"] == "open"
    assert p["estimate_min"] == 2_500_000 * 4
    assert p["estimate_max"] == 3_500_000 * 4
    assert p["client_id"] == user["user_id"]
    # mine
    r = sess.get(f"{API}/custom/projects/mine", timeout=20)
    assert r.status_code == 200
    assert any(x["project_id"] == p["project_id"] for x in r.json())


def test_get_project_as_client(buyer):
    sess, _ = buyer
    r = sess.get(f"{API}/custom/projects/{_project_cache['id']}", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["viewer"] == "client"
    assert "phone" in d  # client sees phone
    assert d["bids"] == []


def test_opportunities_excludes_own_and_hides_phone(buyer, supplier):
    buy_sess, _ = buyer
    sup_sess, _ = supplier
    r = sup_sess.get(f"{API}/custom/opportunities", timeout=20)
    assert r.status_code == 200
    docs = r.json()
    pid = _project_cache["id"]
    found = [d for d in docs if d["project_id"] == pid]
    assert len(found) == 1
    assert "phone" not in found[0]
    assert found[0]["has_my_bid"] is False
    # buyer sees NOT their own
    r2 = buy_sess.get(f"{API}/custom/opportunities", timeout=20)
    assert all(d["client_id"] != _project_cache.get("client_id") for d in r2.json() if d["project_id"] == pid) or \
           all(d["project_id"] != pid for d in r2.json())


# ---------- Bidding ----------
def test_client_cannot_bid_own(buyer):
    sess, _ = buyer
    r = sess.post(f"{API}/custom/projects/{_project_cache['id']}/bids",
                  json={"duration_days": 14, "notes": "", "rab_items": [{"item": "self-bid", "qty": 1, "unit": "ls", "price": 1000}]}, timeout=20)
    assert r.status_code == 400


def test_submit_bid_and_resubmit_updates(supplier):
    sess, user = supplier
    pid = _project_cache["id"]
    r = sess.post(f"{API}/custom/projects/{pid}/bids", json={
        "duration_days": 20, "notes": "Pakai plywood 18mm",
        "rab_items": [{"item": "Kabinet bawah", "qty": 4, "unit": "m", "price": 2_000_000},
                      {"item": "Kabinet atas", "qty": 4, "unit": "m", "price": 1_500_000}],
    }, timeout=20)
    assert r.status_code == 200, r.text
    bid = r.json()
    assert bid["amount"] == 4 * 2_000_000 + 4 * 1_500_000
    assert bid["status"] == "pending"
    _project_cache["bid_id"] = bid["bid_id"]

    # resubmit updates same bid, bid_count stays 1
    r2 = sess.post(f"{API}/custom/projects/{pid}/bids", json={
        "duration_days": 25, "notes": "Updated",
        "rab_items": [{"item": "Full", "qty": 1, "unit": "ls", "price": 12_000_000}],
    }, timeout=20)
    assert r2.status_code == 200
    assert r2.json()["bid_id"] == bid["bid_id"]
    assert r2.json()["amount"] == 12_000_000

    # opportunities now show has_my_bid True + "Sudah ditawar" flag
    opps = sess.get(f"{API}/custom/opportunities", timeout=20).json()
    row = next(d for d in opps if d["project_id"] == pid)
    assert row["has_my_bid"] is True
    assert row["bid_count"] == 1


def test_second_vendor_bid_from_designer(designer):
    sess, _ = designer
    pid = _project_cache["id"]
    r = sess.post(f"{API}/custom/projects/{pid}/bids", json={
        "duration_days": 15, "notes": "Pengrajin kayu",
        "rab_items": [{"item": "All-in", "qty": 1, "unit": "ls", "price": 11_000_000}],
    }, timeout=20)
    assert r.status_code == 200
    _project_cache["designer_bid_id"] = r.json()["bid_id"]
    _project_cache["designer_amount"] = r.json()["amount"]


# ---------- Accept bid + milestones ----------
def test_accept_bid_creates_milestones_and_rejects_others(buyer, supplier, designer):
    buy_sess, _ = buyer
    sup_sess, _ = supplier
    des_sess, _ = designer
    pid = _project_cache["id"]
    accepted_bid_id = _project_cache["bid_id"]  # supplier bid 12_000_000
    r = buy_sess.post(f"{API}/custom/projects/{pid}/bids/{accepted_bid_id}/accept", timeout=20)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["status"] == "awarded"
    assert p["contract_amount"] == 12_000_000
    assert len(p["milestones"]) == 3
    assert p["milestones"][0]["amount"] == round(12_000_000 * 0.30)
    assert p["milestones"][1]["amount"] == round(12_000_000 * 0.40)
    # m3 = remainder
    assert p["milestones"][2]["amount"] == 12_000_000 - p["milestones"][0]["amount"] - p["milestones"][1]["amount"]
    assert all(m["status"] == "pending" for m in p["milestones"])

    # Non-involved user (designer, whose bid was rejected) now gets 403
    r2 = des_sess.get(f"{API}/custom/projects/{pid}", timeout=20)
    assert r2.status_code == 403


# ---------- Milestone flow ----------
def test_milestone_m2_before_m1_fails(buyer):
    sess, _ = buyer
    pid = _project_cache["id"]
    r = sess.post(f"{API}/custom/projects/{pid}/milestones/m2/pay", timeout=20)
    assert r.status_code == 400


def test_milestone_wrong_actor(supplier):
    sess, _ = supplier
    pid = _project_cache["id"]
    # vendor cannot pay
    r = sess.post(f"{API}/custom/projects/{pid}/milestones/m1/pay", timeout=20)
    assert r.status_code == 403


def test_milestone_full_flow(buyer, supplier):
    buy, _ = buyer
    sup, _ = supplier
    pid = _project_cache["id"]

    for key in ("m1", "m2", "m3"):
        r = buy.post(f"{API}/custom/projects/{pid}/milestones/{key}/pay", timeout=20)
        assert r.status_code == 200, r.text
        assert next(m for m in r.json()["milestones"] if m["key"] == key)["status"] == "held"

        # client cannot submit
        rbad = buy.post(f"{API}/custom/projects/{pid}/milestones/{key}/submit",
                        json={"note": "wrong actor test"}, timeout=20)
        assert rbad.status_code == 403

        r = sup.post(f"{API}/custom/projects/{pid}/milestones/{key}/submit",
                     json={"note": f"Progress {key} selesai"}, timeout=20)
        assert r.status_code == 200
        assert next(m for m in r.json()["milestones"] if m["key"] == key)["status"] == "submitted"

        r = buy.post(f"{API}/custom/projects/{pid}/milestones/{key}/release", timeout=20)
        assert r.status_code == 200
        assert next(m for m in r.json()["milestones"] if m["key"] == key)["status"] == "released"

    final = buy.get(f"{API}/custom/projects/{pid}", timeout=20).json()
    assert final["status"] == "completed"


# ---------- Cancel open project ----------
def test_cancel_open_project(buyer):
    sess, _ = buyer
    p = _create_project(sess)
    r = sess.post(f"{API}/custom/projects/{p['project_id']}/cancel", timeout=20)
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"


def test_cancel_awarded_fails(buyer):
    sess, _ = buyer
    r = sess.post(f"{API}/custom/projects/{_project_cache['id']}/cancel", timeout=20)
    assert r.status_code == 400
