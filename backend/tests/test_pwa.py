"""PWA tests — manifest, admin update, static assets, service worker."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture
def s():
    return requests.Session()


@pytest.fixture
def admin_tok():
    r = requests.post(f"{BASE}/api/auth/demo", json={"role": "admin"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def buyer_tok():
    r = requests.post(f"{BASE}/api/auth/demo", json={"role": "buyer"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------- static assets ----------
def test_sw_served(s):
    r = s.get(f"{BASE}/sw.js")
    assert r.status_code == 200
    assert "serviceWorker" in r.text or "self.addEventListener" in r.text


def test_offline_html(s):
    r = s.get(f"{BASE}/offline.html")
    assert r.status_code == 200
    assert "offline-page" in r.text


@pytest.mark.parametrize("path", ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", "/icons/apple-touch-icon.png"])
def test_icons_served(s, path):
    r = s.get(f"{BASE}{path}")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/")


def test_index_links(s):
    r = s.get(f"{BASE}/")
    assert r.status_code == 200
    assert '/api/pwa/manifest.json' in r.text
    assert 'apple-touch-icon' in r.text
    assert '#1E242B' in r.text
    assert '<title>MatShop.id</title>' in r.text


# ---------- manifest default ----------
def test_manifest_default(s):
    r = s.get(f"{BASE}/api/pwa/manifest.json")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/manifest+json")
    m = r.json()
    assert m["name"] == "MatShop.id"
    assert m["short_name"] == "MatShop"
    assert m["start_url"] == "/?source=pwa"
    assert m["display"] == "standalone"
    assert m["theme_color"] == "#1E242B"
    assert len(m["icons"]) == 3
    srcs = {i["src"] for i in m["icons"]}
    assert "/icons/icon-192.png" in srcs
    assert "/icons/icon-512.png" in srcs
    assert any(i.get("purpose") == "maskable" for i in m["icons"])


# ---------- admin update ----------
def test_admin_update_pwa_and_reset(s, admin_tok, buyer_tok):
    # non-admin forbidden
    r = s.put(f"{BASE}/api/admin/site-settings", json={"images": {}, "hero": {}, "pwa": {"app_name": "X"}, "sections": []},
              headers={"Authorization": f"Bearer {buyer_tok}"})
    assert r.status_code == 403

    # fetch current to preserve
    cur = s.get(f"{BASE}/api/site-settings").json()
    orig_images = cur.get("images", {})
    orig_hero = cur.get("hero", {})
    orig_sections = cur.get("sections", [])

    # admin update
    payload = {
        "images": orig_images, "hero": orig_hero, "sections": orig_sections,
        "pwa": {"app_name": "TEST_App", "short_name": "TST", "banner_title": "TEST banner title",
                "banner_text": "TEST banner text here", "icon": "/icons/icon-512.png"},
    }
    r = s.put(f"{BASE}/api/admin/site-settings", json=payload, headers={"Authorization": f"Bearer {admin_tok}"})
    assert r.status_code == 200, r.text

    m = s.get(f"{BASE}/api/pwa/manifest.json").json()
    assert m["name"] == "TEST_App"
    assert m["short_name"] == "TST"
    # Icon override -> single 512 icon
    assert len(m["icons"]) == 1
    assert m["icons"][0]["sizes"] == "512x512"
    assert m["icons"][0]["src"] == "/icons/icon-512.png"

    # Site settings reflects pwa fields
    ss = s.get(f"{BASE}/api/site-settings").json()
    assert ss["pwa"]["app_name"] == "TEST_App"
    assert ss["pwa"]["banner_title"] == "TEST banner title"

    # CLEANUP — reset pwa to empty
    reset = {"images": orig_images, "hero": orig_hero, "sections": orig_sections, "pwa": {}}
    r = s.put(f"{BASE}/api/admin/site-settings", json=reset, headers={"Authorization": f"Bearer {admin_tok}"})
    assert r.status_code == 200

    m2 = s.get(f"{BASE}/api/pwa/manifest.json").json()
    assert m2["name"] == "MatShop.id"
    assert len(m2["icons"]) == 3
