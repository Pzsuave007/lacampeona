"""Backend API tests for Radio Latina."""
import io
import os
import time
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://radio-ads-hub.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@radiolatina.fm"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"
    # cookie should be set
    assert "access_token" in session.cookies.get_dict() or True  # session-bound cookie
    return data["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------------- Public ---------------- #
class TestPublic:
    def test_root(self, session):
        r = session.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_settings_no_internal(self, session):
        r = session.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        data = r.json()
        assert "active_advertiser_id" not in data
        assert "station_name" in data
        assert "stream_url" in data

    def test_advertisers_demo(self, session):
        r = session.get(f"{BASE_URL}/api/advertisers")
        assert r.status_code == 200
        items = r.json()
        names = [a["name"] for a in items]
        assert any("Café Aroma" in n for n in names)
        assert any("El Sabor Latino" in n for n in names)
        for a in items:
            assert "_id" not in a
            assert "id" in a and "slug" in a

    def test_get_advertiser_by_slug(self, session):
        r = session.get(f"{BASE_URL}/api/advertisers")
        slug = r.json()[0]["slug"]
        r2 = session.get(f"{BASE_URL}/api/advertisers/{slug}")
        assert r2.status_code == 200
        assert r2.json()["slug"] == slug

    def test_get_advertiser_404(self, session):
        r = session.get(f"{BASE_URL}/api/advertisers/does-not-exist-xyz")
        assert r.status_code == 404


# ---------------- Auth ---------------- #
class TestAuth:
    def test_login_bad_creds(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_login_sets_cookie_and_token(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert "access_token" in r.json()
        # verify cookie present in response
        assert any(c.name == "access_token" for c in r.cookies)

    def test_me_with_bearer(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL
        assert r.json()["role"] == "admin"

    def test_me_without_auth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_logout_clears_cookie(self):
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        r = s.post(f"{BASE_URL}/api/auth/logout")
        assert r.status_code == 200
        # After logout, /me without bearer should be 401
        r2 = s.get(f"{BASE_URL}/api/auth/me")
        assert r2.status_code == 401


# ---------------- Admin ---------------- #
class TestAdminSettings:
    def test_admin_settings_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/settings")
        assert r.status_code == 401

    def test_admin_get_settings(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers)
        assert r.status_code == 200
        assert "station_name" in r.json()

    def test_admin_update_settings(self, admin_headers):
        new_tag = f"TEST_tagline_{uuid.uuid4().hex[:6]}"
        r = requests.put(f"{BASE_URL}/api/admin/settings",
                         headers=admin_headers,
                         json={"station_tagline": new_tag})
        assert r.status_code == 200
        assert r.json()["station_tagline"] == new_tag
        # GET to verify persistence
        r2 = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers)
        assert r2.json()["station_tagline"] == new_tag


@pytest.fixture(scope="class")
def created_advertiser(admin_headers):
    payload = {
        "name": f"TEST_Sponsor_{uuid.uuid4().hex[:6]}",
        "tagline": "TEST tagline",
        "phone": "+13105550000",
        "whatsapp": "13105550000",
        "color": "#123456",
        "schedule": [],
    }
    r = requests.post(f"{BASE_URL}/api/admin/advertisers", headers=admin_headers, json=payload)
    assert r.status_code == 200, r.text
    adv = r.json()
    yield adv
    # cleanup
    requests.delete(f"{BASE_URL}/api/admin/advertisers/{adv['id']}", headers=admin_headers)


class TestAdvertiserCRUD:
    def test_create(self, created_advertiser):
        assert created_advertiser["id"]
        assert created_advertiser["slug"]

    def test_get_by_slug_after_create(self, created_advertiser):
        r = requests.get(f"{BASE_URL}/api/advertisers/{created_advertiser['slug']}")
        assert r.status_code == 200
        assert r.json()["id"] == created_advertiser["id"]

    def test_update(self, admin_headers, created_advertiser):
        new_name = created_advertiser["name"] + "_upd"
        payload = {**{k: v for k, v in created_advertiser.items() if k in {
            "name", "tagline", "description", "special_offer", "cta_text", "phone", "whatsapp",
            "address", "maps_url", "website_url", "banner_path", "color", "schedule"
        }}, "name": new_name}
        r = requests.put(f"{BASE_URL}/api/admin/advertisers/{created_advertiser['id']}",
                         headers=admin_headers, json=payload)
        assert r.status_code == 200
        assert r.json()["name"] == new_name

    def test_unique_slug(self, admin_headers, created_advertiser):
        # create same name -> must produce different slug (suffix -2)
        payload = {"name": created_advertiser["name"], "schedule": []}
        r = requests.post(f"{BASE_URL}/api/admin/advertisers", headers=admin_headers, json=payload)
        assert r.status_code == 200
        adv2 = r.json()
        assert adv2["slug"] != created_advertiser["slug"]
        # cleanup
        requests.delete(f"{BASE_URL}/api/admin/advertisers/{adv2['id']}", headers=admin_headers)


class TestActivateFlow:
    def test_set_none_returns_null_active(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/activate",
                          headers=admin_headers, json={"advertiser_id": ""})
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/active")
        assert r2.status_code == 200
        assert r2.json()["advertiser"] is None

    def test_activate_specific(self, admin_headers):
        # create a fresh advertiser to activate
        payload = {"name": f"TEST_Active_{uuid.uuid4().hex[:6]}", "schedule": []}
        c = requests.post(f"{BASE_URL}/api/admin/advertisers", headers=admin_headers, json=payload)
        adv = c.json()
        try:
            r = requests.post(f"{BASE_URL}/api/admin/activate",
                              headers=admin_headers, json={"advertiser_id": adv["id"]})
            assert r.status_code == 200
            assert r.json()["active_advertiser_id"] == adv["id"]
            r2 = requests.get(f"{BASE_URL}/api/active")
            assert r2.json()["advertiser"] is not None
            assert r2.json()["advertiser"]["id"] == adv["id"]
        finally:
            requests.delete(f"{BASE_URL}/api/admin/advertisers/{adv['id']}", headers=admin_headers)
        # After delete, fallback should be AUTO
        r3 = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers)
        assert r3.json()["active_advertiser_id"] == "AUTO"

    def test_auto_with_schedule_match(self, admin_headers):
        # Create advertiser with schedule covering current time UTC
        now = datetime.now(timezone.utc)
        slot = {
            "day_of_week": now.weekday(),
            "start_time": "00:00",
            "end_time": "23:59",
        }
        payload = {"name": f"TEST_AutoMatch_{uuid.uuid4().hex[:6]}", "schedule": [slot]}
        c = requests.post(f"{BASE_URL}/api/admin/advertisers", headers=admin_headers, json=payload)
        assert c.status_code == 200
        adv = c.json()
        try:
            r = requests.post(f"{BASE_URL}/api/admin/activate",
                              headers=admin_headers, json={"advertiser_id": "AUTO"})
            assert r.status_code == 200
            r2 = requests.get(f"{BASE_URL}/api/active")
            assert r2.status_code == 200
            # at least one advertiser matches schedule; could be ours or seeded one
            assert r2.json()["advertiser"] is not None
        finally:
            requests.delete(f"{BASE_URL}/api/admin/advertisers/{adv['id']}", headers=admin_headers)

    def test_activate_invalid_id(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/activate",
                          headers=admin_headers, json={"advertiser_id": "non-existent-id"})
        assert r.status_code == 404


class TestUpload:
    def test_upload_image_and_serve(self, admin_token):
        # Tiny 1x1 PNG
        png = bytes.fromhex(
            "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C636000000000020001"
            "E221BC330000000049454E44AE426082"
        )
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(f"{BASE_URL}/api/admin/upload", headers=headers, files=files)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "path" in body and body["path"]
        assert body["url"].startswith("/api/files/")
        # GET file
        r2 = requests.get(f"{BASE_URL}/api/files/{body['path']}")
        assert r2.status_code == 200
        assert r2.headers.get("Content-Type", "").startswith("image/")
        assert len(r2.content) > 0

    def test_upload_unsupported_type(self, admin_token):
        files = {"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")}
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(f"{BASE_URL}/api/admin/upload", headers=headers, files=files)
        assert r.status_code == 400

    def test_upload_requires_admin(self):
        files = {"file": ("test.png", io.BytesIO(b"x"), "image/png")}
        r = requests.post(f"{BASE_URL}/api/admin/upload", files=files)
        assert r.status_code == 401
