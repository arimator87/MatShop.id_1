"""Iteration 11 tests: Favorites, Invitation respond, Review report & admin resolve."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def demo(role):
    r = requests.post(f"{BASE}/api/auth/demo", json={"role": role})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def tokens():
    return {r: demo(r) for r in ("contractor_buyer", "supplier_vendor", "designer_creator", "admin")}


# -------- Favorites --------
class TestFavorites:
    def test_me_has_favorite_vendor_ids(self, tokens):
        r = requests.get(f"{BASE}/api/auth/me", headers=H(tokens["contractor_buyer"]))
        assert r.status_code == 200
        assert "favorite_vendor_ids" in r.json()

    def test_toggle_unknown_vendor_404(self, tokens):
        r = requests.post(f"{BASE}/api/favorites/user_does_not_exist", headers=H(tokens["contractor_buyer"]))
        assert r.status_code == 404

    def test_self_favorite_400(self, tokens):
        # supplier favoriting themselves
        r = requests.post(f"{BASE}/api/favorites/user_demo_supplier", headers=H(tokens["supplier_vendor"]))
        assert r.status_code == 400

    def test_toggle_add_then_remove_and_list(self, tokens):
        tok = tokens["contractor_buyer"]
        vid = "user_demo_supplier"
        # ensure clean state - remove first if present
        me = requests.get(f"{BASE}/api/auth/me", headers=H(tok)).json()
        if vid in me.get("favorite_vendor_ids", []):
            requests.post(f"{BASE}/api/favorites/{vid}", headers=H(tok))
        # add
        r = requests.post(f"{BASE}/api/favorites/{vid}", headers=H(tok))
        assert r.status_code == 200
        d = r.json()
        assert d["favorite"] is True
        assert vid in d["favorite_vendor_ids"]
        # list
        lst = requests.get(f"{BASE}/api/favorites", headers=H(tok))
        assert lst.status_code == 200
        assert any(x["user_id"] == vid for x in lst.json())
        # me reflects
        me2 = requests.get(f"{BASE}/api/auth/me", headers=H(tok)).json()
        assert vid in me2["favorite_vendor_ids"]
        # toggle off
        r2 = requests.post(f"{BASE}/api/favorites/{vid}", headers=H(tok))
        assert r2.status_code == 200
        assert r2.json()["favorite"] is False
        assert vid not in r2.json()["favorite_vendor_ids"]


# -------- Invitation respond --------
@pytest.fixture(scope="module")
def invited_project(tokens):
    """Create a project as buyer, approve as admin, invite supplier."""
    # Create project
    body = {"work_type": "kitchen_set", "budget": 10_000_000, "size": 3, "finishing": "hpl",
            "title": "TEST Iteration 11 Invitation", "description": "Test project for invitation respond",
            "address": "Jl TEST 1", "city": "Jakarta", "phone": "08123456789"}
    r = requests.post(f"{BASE}/api/custom/projects", json=body, headers=H(tokens["contractor_buyer"]))
    assert r.status_code == 200, r.text
    pid = r.json()["project_id"]
    # Admin approve
    r = requests.post(f"{BASE}/api/custom/admin/projects/{pid}/approve", json={"note": ""}, headers=H(tokens["admin"]))
    assert r.status_code == 200
    # Invite supplier
    r = requests.post(f"{BASE}/api/custom/projects/{pid}/invite", json={"vendor_id": "user_demo_supplier"},
                      headers=H(tokens["contractor_buyer"]))
    assert r.status_code == 200
    yield pid
    # Cleanup: cancel
    requests.post(f"{BASE}/api/custom/projects/{pid}/cancel", headers=H(tokens["contractor_buyer"]))


class TestInvitationRespond:
    def test_non_invited_vendor_404(self, tokens, invited_project):
        # designer not invited
        r = requests.post(f"{BASE}/api/custom/projects/{invited_project}/invitation/respond",
                          json={"accept": True}, headers=H(tokens["designer_creator"]))
        assert r.status_code == 404

    def test_opportunities_shows_invitation_status_and_no_leak(self, tokens, invited_project):
        r = requests.get(f"{BASE}/api/custom/opportunities", headers=H(tokens["supplier_vendor"]))
        assert r.status_code == 200
        proj = next((p for p in r.json() if p["project_id"] == invited_project), None)
        assert proj is not None
        assert proj.get("invited") is True
        assert proj.get("invitation_status") == "pending"
        assert "invitations" not in proj

    def test_decline_with_reason(self, tokens, invited_project):
        # First create a separate project to decline (so we don't interfere with accept test)
        body = {"work_type": "wardrobe", "budget": 5_000_000, "size": 2, "finishing": "hpl",
                "title": "TEST Iter11 Decline", "description": "Decline test project",
                "address": "Jl TEST", "city": "Bandung", "phone": "08123456789"}
        r = requests.post(f"{BASE}/api/custom/projects", json=body, headers=H(tokens["contractor_buyer"]))
        pid = r.json()["project_id"]
        requests.post(f"{BASE}/api/custom/admin/projects/{pid}/approve", json={"note": ""}, headers=H(tokens["admin"]))
        requests.post(f"{BASE}/api/custom/projects/{pid}/invite", json={"vendor_id": "user_demo_supplier"},
                      headers=H(tokens["contractor_buyer"]))
        # Decline
        r = requests.post(f"{BASE}/api/custom/projects/{pid}/invitation/respond",
                          json={"accept": False, "reason": "Jadwal penuh"}, headers=H(tokens["supplier_vendor"]))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "declined"
        assert r.json()["reason"] == "Jadwal penuh"
        # Second respond -> 400
        r2 = requests.post(f"{BASE}/api/custom/projects/{pid}/invitation/respond",
                           json={"accept": True}, headers=H(tokens["supplier_vendor"]))
        assert r2.status_code == 400
        # Client sees invitation status
        pr = requests.get(f"{BASE}/api/custom/projects/{pid}", headers=H(tokens["contractor_buyer"])).json()
        inv = pr["invitations"]
        assert len(inv) == 1 and inv[0]["status"] == "declined"
        # Vendor sees only own invitation
        pr_v = requests.get(f"{BASE}/api/custom/projects/{pid}", headers=H(tokens["supplier_vendor"])).json()
        assert len(pr_v["invitations"]) == 1
        assert pr_v["invitations"][0]["vendor_id"] == "user_demo_supplier"
        # Timeline event
        assert any("menolak undangan" in e["note"] for e in pr["timeline"])
        # Client notification
        notes = requests.get(f"{BASE}/api/notifications", headers=H(tokens["contractor_buyer"])).json()["items"]
        assert any("Undangan ditolak" in n["title"] for n in notes)
        # Cleanup
        requests.post(f"{BASE}/api/custom/projects/{pid}/cancel", headers=H(tokens["contractor_buyer"]))

    def test_accept_updates_status_and_notifies(self, tokens, invited_project):
        pid = invited_project
        r = requests.post(f"{BASE}/api/custom/projects/{pid}/invitation/respond",
                          json={"accept": True}, headers=H(tokens["supplier_vendor"]))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "accepted"
        # Client notification
        notes = requests.get(f"{BASE}/api/notifications", headers=H(tokens["contractor_buyer"])).json()["items"]
        assert any("Undangan diterima" in n["title"] for n in notes)


# -------- Review report --------
@pytest.fixture
def reported_review(tokens):
    """Admin creates a review on supplier, supplier reports it. Returns review_id. Cleans up at end."""
    body = {"vendor_id": "user_demo_supplier", "reviewer_name": "TEST Reviewer",
            "subject": "TEST Iter11 Subject", "rating": 5,
            "comment": "TEST iteration 11 report flow review comment."}
    r = requests.post(f"{BASE}/api/admin/reviews", json=body, headers=H(tokens["admin"]))
    assert r.status_code == 200, r.text
    rid = r.json()["review_id"]
    yield rid
    requests.delete(f"{BASE}/api/admin/reviews/{rid}", headers=H(tokens["admin"]))


class TestReviewReport:
    def test_only_owner_can_report(self, tokens, reported_review):
        # buyer tries 403
        r = requests.post(f"{BASE}/api/reviews/{reported_review}/report",
                          json={"reason": "spam"}, headers=H(tokens["contractor_buyer"]))
        assert r.status_code == 403

    def test_invalid_reason_400(self, tokens, reported_review):
        r = requests.post(f"{BASE}/api/reviews/{reported_review}/report",
                          json={"reason": "bogus"}, headers=H(tokens["supplier_vendor"]))
        assert r.status_code == 400

    def test_report_and_duplicate(self, tokens, reported_review):
        rid = reported_review
        r = requests.post(f"{BASE}/api/reviews/{rid}/report",
                          json={"reason": "not_client", "note": "Bukan klien saya"},
                          headers=H(tokens["supplier_vendor"]))
        assert r.status_code == 200, r.text
        assert r.json()["report"]["status"] == "pending"
        assert r.json()["report"]["reason"] == "not_client"
        # duplicate -> 400
        r2 = requests.post(f"{BASE}/api/reviews/{rid}/report",
                           json={"reason": "spam"}, headers=H(tokens["supplier_vendor"]))
        assert r2.status_code == 400

    def test_review_visible_while_pending(self, tokens, reported_review):
        # Report it first
        requests.post(f"{BASE}/api/reviews/{reported_review}/report",
                      json={"reason": "spam"}, headers=H(tokens["supplier_vendor"]))
        v = requests.get(f"{BASE}/api/vendors/user_demo_supplier").json()
        assert any(r["review_id"] == reported_review for r in v["reviews"])


# -------- Admin review-reports --------
class TestAdminReviewReports:
    def test_non_admin_forbidden(self, tokens):
        r = requests.get(f"{BASE}/api/admin/review-reports", headers=H(tokens["contractor_buyer"]))
        assert r.status_code == 403

    def test_list_pending(self, tokens, reported_review):
        rid = reported_review
        requests.post(f"{BASE}/api/reviews/{rid}/report",
                      json={"reason": "spam"}, headers=H(tokens["supplier_vendor"]))
        r = requests.get(f"{BASE}/api/admin/review-reports?status=pending", headers=H(tokens["admin"]))
        assert r.status_code == 200
        assert any(x["review_id"] == rid for x in r.json())

    def test_hide_excludes_from_vendor_and_recomputes(self, tokens, reported_review):
        rid = reported_review
        # vendor rating before
        vb = requests.get(f"{BASE}/api/vendors/user_demo_supplier").json()
        count_before, avg_before = vb["review_count"], vb["rating_avg"]
        # report
        requests.post(f"{BASE}/api/reviews/{rid}/report",
                      json={"reason": "spam"}, headers=H(tokens["supplier_vendor"]))
        # resolve hide
        r = requests.post(f"{BASE}/api/admin/review-reports/{rid}/resolve",
                          json={"action": "hide", "note": "Terbukti spam"}, headers=H(tokens["admin"]))
        assert r.status_code == 200, r.text
        assert r.json()["report"]["status"] == "hidden"
        assert r.json()["hidden"] is True
        # vendor profile no longer shows review and count decreased
        va = requests.get(f"{BASE}/api/vendors/user_demo_supplier").json()
        assert not any(x["review_id"] == rid for x in va["reviews"])
        assert va["review_count"] == count_before - 1
        # resolving again -> 404 (no longer pending)
        r2 = requests.post(f"{BASE}/api/admin/review-reports/{rid}/resolve",
                           json={"action": "hide"}, headers=H(tokens["admin"]))
        assert r2.status_code == 404
        # vendor notified
        notes = requests.get(f"{BASE}/api/notifications", headers=H(tokens["supplier_vendor"])).json()["items"]
        assert any("Laporan ulasan disetujui" in n["title"] for n in notes)

    def test_reject_keeps_review(self, tokens, reported_review):
        rid = reported_review
        requests.post(f"{BASE}/api/reviews/{rid}/report",
                      json={"reason": "other", "note": "x"}, headers=H(tokens["supplier_vendor"]))
        r = requests.post(f"{BASE}/api/admin/review-reports/{rid}/resolve",
                          json={"action": "reject", "note": "Ulasan valid"}, headers=H(tokens["admin"]))
        assert r.status_code == 200
        assert r.json()["report"]["status"] == "rejected"
        assert r.json().get("hidden") in (False, None)
        # Still visible
        v = requests.get(f"{BASE}/api/vendors/user_demo_supplier").json()
        assert any(x["review_id"] == rid for x in v["reviews"])
        # filter rejected lists it
        r2 = requests.get(f"{BASE}/api/admin/review-reports?status=rejected", headers=H(tokens["admin"]))
        assert any(x["review_id"] == rid for x in r2.json())

    def test_invalid_action(self, tokens, reported_review):
        rid = reported_review
        requests.post(f"{BASE}/api/reviews/{rid}/report",
                      json={"reason": "spam"}, headers=H(tokens["supplier_vendor"]))
        r = requests.post(f"{BASE}/api/admin/review-reports/{rid}/resolve",
                          json={"action": "delete"}, headers=H(tokens["admin"]))
        assert r.status_code == 400
