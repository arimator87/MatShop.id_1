"""Iteration 10 tests — Top Rated badges + Invite vendor to project."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE}/api"


def demo(role):
    r = requests.post(f"{API}/auth/demo", json={"role": role})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_tok():
    return demo("admin")


@pytest.fixture(scope="module")
def buyer_tok():
    return demo("contractor_buyer")


@pytest.fixture(scope="module")
def supplier_tok():
    return demo("supplier_vendor")


@pytest.fixture(scope="module")
def designer_tok():
    return demo("designer_creator")


# --------- Portfolios top_rated ---------
def test_portfolios_include_top_rated_fields():
    r = requests.get(f"{API}/portfolios", params={"limit": 50})
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    for v in data:
        assert "top_rated" in v
        assert "completed_total" in v
        assert "offline_projects" in v


def test_portfolios_top_rated_filter_returns_only_two_seeded():
    r = requests.get(f"{API}/portfolios", params={"top_rated": "true", "limit": 50})
    assert r.status_code == 200
    data = r.json()
    ids = {v["user_id"] for v in data}
    # seed-expected top rated
    assert "user_showcase_workshop" in ids  # Kayu Rupa Workshop
    assert "user_demo_supplier" in ids  # PT Material Nusantara
    for v in data:
        assert v["top_rated"] is True


def test_vendor_profile_includes_top_rated():
    r = requests.get(f"{API}/vendors/user_showcase_workshop")
    assert r.status_code == 200
    assert r.json()["top_rated"] is True


# --------- Admin reviews ---------
def test_admin_review_create_promotes_showcase_interior_then_delete_reverts(admin_tok, buyer_tok):
    vendor_id = "user_showcase_interior"
    # baseline
    r = requests.get(f"{API}/vendors/{vendor_id}")
    assert r.status_code == 200
    before = r.json()
    assert before["top_rated"] is False  # 2 reviews, 2 done

    payload = {"vendor_id": vendor_id, "reviewer_name": "TEST Klien Offline",
               "subject": "TEST Kitchen Set 3m", "rating": 5,
               "comment": "Testimoni offline oleh admin untuk verifikasi badge.", "photos": []}

    # non-admin -> 403
    nr = requests.post(f"{API}/admin/reviews", json=payload, headers=H(buyer_tok))
    assert nr.status_code == 403

    # unknown vendor -> 404
    bad = requests.post(f"{API}/admin/reviews", json={**payload, "vendor_id": "nope"}, headers=H(admin_tok))
    assert bad.status_code == 404

    # validation: short comment
    v422 = requests.post(f"{API}/admin/reviews", json={**payload, "comment": "x"}, headers=H(admin_tok))
    assert v422.status_code == 422

    # create
    cr = requests.post(f"{API}/admin/reviews", json=payload, headers=H(admin_tok))
    assert cr.status_code == 200, cr.text
    rid = cr.json()["review_id"]

    try:
        # list contains it
        lst = requests.get(f"{API}/admin/reviews", headers=H(admin_tok))
        assert lst.status_code == 200
        assert any(x["review_id"] == rid for x in lst.json())

        # now vendor should be top_rated
        r2 = requests.get(f"{API}/vendors/{vendor_id}")
        d = r2.json()
        assert d["top_rated"] is True
        assert d["offline_projects"] >= before["offline_projects"] + 1
        assert d["completed_total"] == before["completed_total"] + 1
    finally:
        dr = requests.delete(f"{API}/admin/reviews/{rid}", headers=H(admin_tok))
        assert dr.status_code == 200

    # revert
    r3 = requests.get(f"{API}/vendors/{vendor_id}")
    assert r3.json()["top_rated"] is False

    # delete unknown -> 404
    d404 = requests.delete(f"{API}/admin/reviews/nope_xx", headers=H(admin_tok))
    assert d404.status_code == 404


# --------- Invite vendor to project ---------
def _create_open_project(buyer_tok, admin_tok, title="TEST Invite Project"):
    body = {"work_type": "kitchen_set", "budget": 20000000, "size": 3, "finishing": "hpl",
            "title": title, "description": "TEST invite project description sufficient.",
            "address": "Jl. Test 1, Jakarta", "city": "Jakarta", "phone": "08123456789"}
    r = requests.post(f"{API}/custom/projects", json=body, headers=H(buyer_tok))
    assert r.status_code == 200, r.text
    pid = r.json()["project_id"]
    ap = requests.post(f"{API}/custom/admin/projects/{pid}/approve", json={"note": ""}, headers=H(admin_tok))
    assert ap.status_code == 200
    assert ap.json()["status"] == "open"
    return pid


def test_invite_flow_full(buyer_tok, admin_tok, supplier_tok, designer_tok):
    pid = _create_open_project(buyer_tok, admin_tok)
    try:
        # non-owner forbidden
        f403 = requests.post(f"{API}/custom/projects/{pid}/invite", json={"vendor_id": "user_showcase_workshop"},
                             headers=H(supplier_tok))
        assert f403.status_code == 403

        # self invite -> 400 (buyer invites own user_id)
        self_r = requests.post(f"{API}/custom/projects/{pid}/invite", json={"vendor_id": "user_demo_buyer"},
                               headers=H(buyer_tok))
        assert self_r.status_code == 400

        # unverified / unknown vendor
        unk = requests.post(f"{API}/custom/projects/{pid}/invite", json={"vendor_id": "nope_vendor_id"},
                            headers=H(buyer_tok))
        assert unk.status_code == 404

        # success: invite supplier demo
        ok = requests.post(f"{API}/custom/projects/{pid}/invite", json={"vendor_id": "user_demo_supplier"},
                           headers=H(buyer_tok))
        assert ok.status_code == 200, ok.text
        assert "user_demo_supplier" in ok.json()["invited_vendor_ids"]

        # duplicate -> 400
        dup = requests.post(f"{API}/custom/projects/{pid}/invite", json={"vendor_id": "user_demo_supplier"},
                            headers=H(buyer_tok))
        assert dup.status_code == 400

        # project GET as buyer: invited_vendor_ids persisted & timeline event
        pr = requests.get(f"{API}/custom/projects/{pid}", headers=H(buyer_tok)).json()
        assert "user_demo_supplier" in pr.get("invited_vendor_ids", [])
        assert any("mengundang" in ev["note"].lower() for ev in pr["timeline"])

        # supplier notifications include invitation
        notifs = requests.get(f"{API}/notifications", headers=H(supplier_tok)).json()
        items = notifs if isinstance(notifs, list) else notifs.get("items", [])
        assert any("Undangan menawar" in n["title"] for n in items)

        # supplier opportunities: this project present with invited=true and sorted first
        opps = requests.get(f"{API}/custom/opportunities", headers=H(supplier_tok)).json()
        assert len(opps) >= 1
        match = [o for o in opps if o["project_id"] == pid]
        assert match and match[0]["invited"] is True
        assert opps[0]["invited"] is True

        # designer (not invited) sees project with invited=false
        opps_d = requests.get(f"{API}/custom/opportunities", headers=H(designer_tok)).json()
        match_d = [o for o in opps_d if o["project_id"] == pid]
        assert match_d and match_d[0]["invited"] is False

        # test invite on non-open project: cancel then try
        requests.post(f"{API}/custom/projects/{pid}/cancel", headers=H(buyer_tok))
        bad_state = requests.post(f"{API}/custom/projects/{pid}/invite", json={"vendor_id": "user_showcase_workshop"},
                                  headers=H(buyer_tok))
        assert bad_state.status_code == 400
    finally:
        # best-effort: project left cancelled; no extra mongo cleanup
        pass


def test_bids_include_vendor_top_rated(buyer_tok, admin_tok, supplier_tok):
    pid = _create_open_project(buyer_tok, admin_tok, title="TEST Bid Top Rated")
    bid = {"duration_days": 10, "notes": "TEST", "material_spec": "HPL TACO",
           "rab_items": [{"item": "Kitchen", "qty": 1, "unit": "ls", "price": 15000000}]}
    br = requests.post(f"{API}/custom/projects/{pid}/bids", json=bid, headers=H(supplier_tok))
    assert br.status_code == 200, br.text
    pr = requests.get(f"{API}/custom/projects/{pid}", headers=H(buyer_tok)).json()
    assert pr["bids"], "no bids"
    assert "vendor_top_rated" in pr["bids"][0]
    assert "vendor_rating" in pr["bids"][0]
    requests.post(f"{API}/custom/projects/{pid}/cancel", headers=H(buyer_tok))
