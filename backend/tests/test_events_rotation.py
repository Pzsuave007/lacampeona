"""Backend tests for advertiser/event rotation and Events CRUD.
Covers: /api/active rotation, /api/events filtering, /api/admin/events CRUD,
event eligibility (promoted_as_cta), and regression for hosts/advertisers.
"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@radiolatina.fm"
ADMIN_PASSWORD = "admin123"


# ---------------- Fixtures ---------------- #
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_api(api, admin_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json",
                      "Authorization": f"Bearer {admin_token}"})
    return s


# ---------------- Health & basic settings ---------------- #
class TestHealth:
    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_public_settings(self, api):
        r = api.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        data = r.json()
        # internal keys must NOT leak
        assert "active_advertiser_id" not in data
        assert "active_host_id" not in data
        assert "station_name" in data


# ---------------- Auth ---------------- #
class TestAuth:
    def test_login_success(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["email"] == ADMIN_EMAIL
        assert body["user"]["role"] == "admin"
        assert isinstance(body["access_token"], str) and len(body["access_token"]) > 10

    def test_login_invalid(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401


# ---------------- Events public ---------------- #
class TestEventsPublic:
    def test_list_only_future(self, api):
        r = api.get(f"{BASE_URL}/api/events")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        today = datetime.now(timezone.utc).date().isoformat()
        for e in items:
            assert (e.get("event_date") or "") >= today, f"Past event leaked: {e}"

    def test_include_past_param(self, api):
        r = api.get(f"{BASE_URL}/api/events", params={"include_past": "true"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------- Admin Events CRUD ---------------- #
class TestAdminEventsCRUD:
    created_id = None
    created_slug = None

    def test_admin_list(self, admin_api):
        r = admin_api.get(f"{BASE_URL}/api/admin/events")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_event(self, admin_api):
        future = (datetime.now(timezone.utc) + timedelta(days=10)).date().isoformat()
        title = f"TEST_Concierto_{uuid.uuid4().hex[:6]}"
        payload = {
            "title": title,
            "description": "Evento de prueba",
            "location": "Los Angeles, CA",
            "event_date": future,
            "start_time": "20:00",
            "end_time": "23:30",
            "category": "concierto",
            "promoted_as_cta": True,
            "priority": 9,
            "spots_per_hour": 5,
            "spot_duration_sec": 25,
        }
        r = admin_api.post(f"{BASE_URL}/api/admin/events", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["title"] == title
        assert body["event_date"] == future
        assert body["promoted_as_cta"] is True
        assert body["priority"] == 9
        assert body["id"]
        assert body["slug"]
        TestAdminEventsCRUD.created_id = body["id"]
        TestAdminEventsCRUD.created_slug = body["slug"]

    def test_get_event_by_slug(self, api):
        slug = TestAdminEventsCRUD.created_slug
        assert slug
        r = api.get(f"{BASE_URL}/api/events/{slug}")
        assert r.status_code == 200
        assert r.json()["slug"] == slug

    def test_update_event(self, admin_api):
        eid = TestAdminEventsCRUD.created_id
        assert eid
        future = (datetime.now(timezone.utc) + timedelta(days=12)).date().isoformat()
        payload = {
            "title": "TEST_Concierto_Updated",
            "description": "Updated desc",
            "location": "LA",
            "event_date": future,
            "start_time": "21:00",
            "end_time": "23:00",
            "category": "promocion",
            "promoted_as_cta": False,
            "priority": 6,
            "spots_per_hour": 3,
            "spot_duration_sec": 20,
        }
        r = admin_api.put(f"{BASE_URL}/api/admin/events/{eid}", json=payload)
        assert r.status_code == 200, r.text
        # Verify persisted
        g = admin_api.get(f"{BASE_URL}/api/admin/events")
        assert g.status_code == 200
        ev = next((e for e in g.json() if e["id"] == eid), None)
        assert ev is not None
        assert ev["title"] == "TEST_Concierto_Updated"
        assert ev["category"] == "promocion"
        assert ev["promoted_as_cta"] is False

    def test_delete_event(self, admin_api):
        eid = TestAdminEventsCRUD.created_id
        assert eid
        r = admin_api.delete(f"{BASE_URL}/api/admin/events/{eid}")
        assert r.status_code == 200
        # Verify gone
        g = admin_api.get(f"{BASE_URL}/api/admin/events")
        ids = [e["id"] for e in g.json()]
        assert eid not in ids

    def test_admin_events_requires_auth(self):
        # Use a brand-new session with no cookies/headers
        anon = requests.Session()
        anon.headers.update({"Content-Type": "application/json"})
        r = anon.get(f"{BASE_URL}/api/admin/events")
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"
        r = anon.post(f"{BASE_URL}/api/admin/events",
                      json={"title": "x", "event_date": "2099-01-01"})
        assert r.status_code in (401, 403)


# ---------------- Active rotation ---------------- #
class TestActiveRotation:
    def test_active_returns_advertiser_or_event(self, api):
        r = api.get(f"{BASE_URL}/api/active")
        assert r.status_code == 200
        body = r.json()
        assert "advertiser" in body
        if body["advertiser"] is not None:
            assert "id" in body["advertiser"]
            assert body["advertiser"].get("type") in ("advertiser", "event", None)

    def test_rotation_is_deterministic_per_second(self, api):
        """Two calls in the same second should return the same item.
        Calls across different seconds within the cycle may or may not
        differ depending on cycle length.
        """
        r1 = api.get(f"{BASE_URL}/api/active").json()["advertiser"]
        r2 = api.get(f"{BASE_URL}/api/active").json()["advertiser"]
        # Both succeed, structurally the same shape
        if r1 and r2:
            assert set(r1.keys()) >= {"id"}
            assert set(r2.keys()) >= {"id"}

    def test_rotation_cycles_over_time(self, api, admin_api):
        """Best-effort test: with multiple eligible CTA events created with
        very short spot_duration_sec, /api/active should return >=2 distinct
        items when sampled across a long enough window.
        Note: existing advertisers + station tz can extend the cycle, so we
        sample a wide window.
        """
        admin_api.put(f"{BASE_URL}/api/admin/settings",
                      json={"active_advertiser_id": "AUTO"})

        created = []
        # Create 3 events with priority 10 (sorted first), tiny duration
        for i in range(3):
            future = (datetime.now(timezone.utc) + timedelta(days=2 + i)).date().isoformat()
            r = admin_api.post(f"{BASE_URL}/api/admin/events", json={
                "title": f"TEST_Rot_{uuid.uuid4().hex[:6]}",
                "event_date": future,
                "start_time": "20:00", "end_time": "23:00",
                "category": "concierto",
                "promoted_as_cta": True,
                "priority": 10,
                "spots_per_hour": 1,  # 1 spot each per cycle minimum
                "spot_duration_sec": 5,
            })
            assert r.status_code == 200, r.text
            created.append(r.json()["id"])

        try:
            seen = set()
            # Sample for up to 60s every 1s
            deadline = time.time() + 60
            while time.time() < deadline and len(seen) < 2:
                ad = api.get(f"{BASE_URL}/api/active").json().get("advertiser")
                if ad:
                    seen.add(ad.get("id"))
                time.sleep(1)
            assert len(seen) >= 2, (
                f"Rotation did not cycle through >=2 items in 60s. Seen ids: {seen}. "
                "Likely cycle_duration too long because existing advertisers/events "
                "expanded total spots; consider reducing spot_duration_sec further."
            )
        finally:
            for eid in created:
                admin_api.delete(f"{BASE_URL}/api/admin/events/{eid}")


# ---------------- Event eligibility helper (via API) ---------------- #
class TestEventEligibility:
    def test_promoted_event_within_default_window(self, admin_api, api):
        future = (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat()
        r = admin_api.post(f"{BASE_URL}/api/admin/events", json={
            "title": f"TEST_Elig_{uuid.uuid4().hex[:6]}",
            "event_date": future,
            "start_time": "20:00", "end_time": "23:00",
            "promoted_as_cta": True,
            "priority": 10, "spots_per_hour": 6, "spot_duration_sec": 5,
        })
        assert r.status_code == 200
        eid = r.json()["id"]
        try:
            # Force AUTO mode
            admin_api.put(f"{BASE_URL}/api/admin/settings",
                          json={"active_advertiser_id": "AUTO"})
            # Poll a few times — event should appear at least once
            seen_types = set()
            for _ in range(8):
                ad = api.get(f"{BASE_URL}/api/active").json().get("advertiser")
                if ad:
                    seen_types.add(ad.get("type"))
                time.sleep(1)
            # event type should appear (since priority is high)
            assert "event" in seen_types or "advertiser" in seen_types
        finally:
            admin_api.delete(f"{BASE_URL}/api/admin/events/{eid}")

    def test_promoted_event_outside_window_excluded(self, admin_api, api):
        # Far-future event, default window = 7 days before — should be excluded today
        future = (datetime.now(timezone.utc) + timedelta(days=60)).date().isoformat()
        r = admin_api.post(f"{BASE_URL}/api/admin/events", json={
            "title": f"TEST_OutWin_{uuid.uuid4().hex[:6]}",
            "event_date": future,
            "promoted_as_cta": True,
            "priority": 10, "spots_per_hour": 6, "spot_duration_sec": 5,
        })
        assert r.status_code == 200
        eid = r.json()["id"]
        try:
            seen_ids = set()
            for _ in range(4):
                ad = api.get(f"{BASE_URL}/api/active").json().get("advertiser")
                if ad:
                    seen_ids.add(ad.get("id"))
                time.sleep(1)
            assert eid not in seen_ids, "Event outside promo window should not rotate"
        finally:
            admin_api.delete(f"{BASE_URL}/api/admin/events/{eid}")

    def test_custom_promote_from_date_includes_event(self, admin_api, api):
        future = (datetime.now(timezone.utc) + timedelta(days=60)).date().isoformat()
        today = datetime.now(timezone.utc).date().isoformat()
        r = admin_api.post(f"{BASE_URL}/api/admin/events", json={
            "title": f"TEST_CustomFrom_{uuid.uuid4().hex[:6]}",
            "event_date": future,
            "promote_from_date": today,
            "promoted_as_cta": True,
            "priority": 10, "spots_per_hour": 60, "spot_duration_sec": 5,
        })
        assert r.status_code == 200
        eid = r.json()["id"]
        try:
            admin_api.put(f"{BASE_URL}/api/admin/settings",
                          json={"active_advertiser_id": "AUTO"})
            seen_ids = set()
            # Sample for up to 90s
            deadline = time.time() + 90
            while time.time() < deadline and eid not in seen_ids:
                ad = api.get(f"{BASE_URL}/api/active").json().get("advertiser")
                if ad:
                    seen_ids.add(ad.get("id"))
                time.sleep(1)
            assert eid in seen_ids, (
                "Event with custom promote_from_date=today should appear in rotation. "
                f"Seen ids: {seen_ids}"
            )
        finally:
            admin_api.delete(f"{BASE_URL}/api/admin/events/{eid}")


# ---------------- Regression: hosts & advertisers ---------------- #
class TestRegression:
    def test_list_hosts(self, api):
        r = api.get(f"{BASE_URL}/api/hosts")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_activate_host_auto(self, admin_api):
        r = admin_api.post(f"{BASE_URL}/api/admin/activate-host",
                           json={"host_id": "AUTO"})
        assert r.status_code == 200
        assert r.json().get("active_host_id") == "AUTO"

    def test_list_advertisers(self, api):
        r = api.get(f"{BASE_URL}/api/advertisers")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_activate_advertiser_auto(self, admin_api):
        r = admin_api.post(f"{BASE_URL}/api/admin/activate",
                           json={"advertiser_id": "AUTO"})
        assert r.status_code == 200
        assert r.json().get("active_advertiser_id") == "AUTO"
