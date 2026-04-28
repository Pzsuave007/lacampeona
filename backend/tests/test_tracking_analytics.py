"""Tests for tracking & analytics endpoints (impressions/clicks, dashboards, public report tokens)."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@radiolatina.fm"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def sample_advertiser(admin_headers):
    payload = {"name": f"TEST_Track_{uuid.uuid4().hex[:6]}", "schedule": [], "owner_email": "owner@test.com"}
    r = requests.post(f"{BASE_URL}/api/admin/advertisers", headers=admin_headers, json=payload)
    assert r.status_code == 200
    adv = r.json()
    yield adv
    requests.delete(f"{BASE_URL}/api/admin/advertisers/{adv['id']}", headers=admin_headers)


@pytest.fixture(scope="module")
def sample_event(admin_headers):
    payload = {
        "title": f"TEST_TrackEvt_{uuid.uuid4().hex[:6]}",
        "event_date": "2026-12-31",
        "owner_email": "evt@test.com",
    }
    r = requests.post(f"{BASE_URL}/api/admin/events", headers=admin_headers, json=payload)
    assert r.status_code == 200
    ev = r.json()
    yield ev
    requests.delete(f"{BASE_URL}/api/admin/events/{ev['id']}", headers=admin_headers)


# ---------- POST /api/track ----------
class TestTrackEndpoint:
    def test_track_impression_ok(self, sample_advertiser):
        r = requests.post(f"{BASE_URL}/api/track", json={
            "kind": "impression",
            "entity_type": "advertiser",
            "entity_id": sample_advertiser["id"],
            "session_id": f"sess_{uuid.uuid4().hex[:8]}",
        })
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_track_click_kinds(self, sample_advertiser):
        for kind in ["call", "whatsapp", "directions", "visit", "tickets"]:
            r = requests.post(f"{BASE_URL}/api/track", json={
                "kind": kind,
                "entity_type": "advertiser",
                "entity_id": sample_advertiser["id"],
            })
            assert r.status_code == 200, f"{kind}: {r.text}"

    def test_track_invalid_kind_400(self, sample_advertiser):
        r = requests.post(f"{BASE_URL}/api/track", json={
            "kind": "bogus",
            "entity_type": "advertiser",
            "entity_id": sample_advertiser["id"],
        })
        assert r.status_code == 400

    def test_track_invalid_entity_type_400(self, sample_advertiser):
        r = requests.post(f"{BASE_URL}/api/track", json={
            "kind": "impression",
            "entity_type": "host",
            "entity_id": sample_advertiser["id"],
        })
        assert r.status_code == 400

    def test_track_missing_entity_id_skips(self):
        r = requests.post(f"{BASE_URL}/api/track", json={
            "kind": "impression",
            "entity_type": "advertiser",
            "entity_id": "",
        })
        assert r.status_code == 200
        assert r.json().get("skipped") is True

    def test_impression_dedup_within_30s(self, sample_advertiser, admin_headers):
        sess = f"sess_dedup_{uuid.uuid4().hex[:8]}"
        eid = sample_advertiser["id"]
        # Read baseline
        r0 = requests.get(f"{BASE_URL}/api/admin/analytics/advertiser/{eid}", headers=admin_headers)
        before = r0.json()["totals"]["impression"]
        # Fire 3 impressions in quick succession
        for _ in range(3):
            requests.post(f"{BASE_URL}/api/track", json={
                "kind": "impression",
                "entity_type": "advertiser",
                "entity_id": eid,
                "session_id": sess,
            })
        time.sleep(0.5)
        r1 = requests.get(f"{BASE_URL}/api/admin/analytics/advertiser/{eid}", headers=admin_headers)
        after = r1.json()["totals"]["impression"]
        # Should increment by exactly 1 (dedup)
        assert after - before == 1, f"expected +1 (deduped), got +{after - before}"


# ---------- /api/admin/analytics/* ----------
class TestAnalyticsEndpoints:
    def test_overview_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/overview")
        assert r.status_code == 401

    def test_overview_returns_totals_and_items(self, admin_headers, sample_advertiser):
        # Fire some events
        requests.post(f"{BASE_URL}/api/track", json={
            "kind": "impression", "entity_type": "advertiser",
            "entity_id": sample_advertiser["id"], "session_id": f"a_{uuid.uuid4().hex}"})
        requests.post(f"{BASE_URL}/api/track", json={
            "kind": "call", "entity_type": "advertiser",
            "entity_id": sample_advertiser["id"]})
        time.sleep(0.3)
        r = requests.get(f"{BASE_URL}/api/admin/analytics/overview?days=30", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "totals" in data and "items" in data
        assert isinstance(data["items"], list)
        assert "impressions" in data and "clicks" in data and "ctr" in data
        # items sorted desc by impressions
        impressions_seq = [it.get("impressions", 0) for it in data["items"]]
        assert impressions_seq == sorted(impressions_seq, reverse=True)
        # Find our advertiser → must have name & slug enriched
        ours = next((it for it in data["items"] if it["entity_id"] == sample_advertiser["id"]), None)
        assert ours is not None
        assert ours.get("name") == sample_advertiser["name"]
        assert "slug" in ours

    def test_overview_includes_event_enrichment(self, admin_headers, sample_event):
        requests.post(f"{BASE_URL}/api/track", json={
            "kind": "impression", "entity_type": "event",
            "entity_id": sample_event["id"], "session_id": f"ev_{uuid.uuid4().hex}"})
        time.sleep(0.3)
        r = requests.get(f"{BASE_URL}/api/admin/analytics/overview?days=30", headers=admin_headers)
        assert r.status_code == 200
        ours = next((it for it in r.json()["items"] if it["entity_id"] == sample_event["id"]), None)
        assert ours is not None
        assert ours.get("name") == sample_event["title"]  # title -> name
        assert ours.get("entity_type") == "event"

    def test_entity_analytics_advertiser(self, admin_headers, sample_advertiser):
        r = requests.get(
            f"{BASE_URL}/api/admin/analytics/advertiser/{sample_advertiser['id']}?days=30",
            headers=admin_headers,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["entity"]["id"] == sample_advertiser["id"]
        assert d["entity_type"] == "advertiser"
        assert isinstance(d["series"], list)
        assert len(d["series"]) == 30  # 30 daily points

    def test_entity_analytics_event(self, admin_headers, sample_event):
        r = requests.get(
            f"{BASE_URL}/api/admin/analytics/event/{sample_event['id']}?days=14",
            headers=admin_headers,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["entity"]["id"] == sample_event["id"]
        assert len(d["series"]) == 14

    def test_entity_analytics_invalid_type(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/analytics/host/abc", headers=admin_headers)
        assert r.status_code == 400

    def test_entity_analytics_404(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/analytics/advertiser/does-not-exist",
            headers=admin_headers,
        )
        assert r.status_code == 404


# ---------- Report token (public) & private field stripping ----------
class TestReportToken:
    def test_admin_advertisers_includes_token(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/advertisers", headers=admin_headers)
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        for a in items:
            assert "report_token" in a and a["report_token"]
            assert len(a["report_token"]) == 32  # uuid hex

    def test_public_advertisers_strips_private(self):
        r = requests.get(f"{BASE_URL}/api/advertisers")
        assert r.status_code == 200
        for a in r.json():
            assert "report_token" not in a
            assert "owner_email" not in a

    def test_public_advertiser_by_slug_strips_private(self):
        items = requests.get(f"{BASE_URL}/api/advertisers").json()
        slug = items[0]["slug"]
        r = requests.get(f"{BASE_URL}/api/advertisers/{slug}")
        assert r.status_code == 200
        assert "report_token" not in r.json()
        assert "owner_email" not in r.json()

    def test_public_events_strips_private(self):
        r = requests.get(f"{BASE_URL}/api/events?include_past=true")
        assert r.status_code == 200
        for e in r.json():
            assert "report_token" not in e
            assert "owner_email" not in e

    def test_active_endpoint_strips_private(self):
        r = requests.get(f"{BASE_URL}/api/active")
        assert r.status_code == 200
        adv = r.json().get("advertiser")
        if adv:
            assert "report_token" not in adv
            assert "owner_email" not in adv

    def test_report_token_advertiser(self, admin_headers, sample_advertiser):
        # fetch token via admin endpoint
        r = requests.get(f"{BASE_URL}/api/admin/advertisers", headers=admin_headers)
        adv = next(a for a in r.json() if a["id"] == sample_advertiser["id"])
        token = adv["report_token"]
        # public report — no auth
        r2 = requests.get(f"{BASE_URL}/api/report/{token}")
        assert r2.status_code == 200
        d = r2.json()
        assert d["entity_type"] == "advertiser"
        assert d["entity"]["id"] == sample_advertiser["id"]
        assert "report_token" not in d["entity"]
        assert "owner_email" not in d["entity"]
        assert isinstance(d["series"], list)

    def test_report_token_event(self, admin_headers, sample_event):
        # event report_token retrieved from admin events list
        r = requests.get(f"{BASE_URL}/api/admin/events", headers=admin_headers)
        ev = next(e for e in r.json() if e["id"] == sample_event["id"])
        token = ev.get("report_token")
        assert token
        r2 = requests.get(f"{BASE_URL}/api/report/{token}")
        assert r2.status_code == 200
        d = r2.json()
        assert d["entity_type"] == "event"
        assert d["entity"]["id"] == sample_event["id"]
        assert "report_token" not in d["entity"]
        assert "owner_email" not in d["entity"]

    def test_report_invalid_token_404(self):
        r = requests.get(f"{BASE_URL}/api/report/nonexistent-token-xyz")
        assert r.status_code == 404

    def test_new_advertiser_auto_generates_token(self, admin_headers):
        payload = {"name": f"TEST_AutoTok_{uuid.uuid4().hex[:6]}", "schedule": []}
        r = requests.post(f"{BASE_URL}/api/admin/advertisers", headers=admin_headers, json=payload)
        assert r.status_code == 200
        adv = r.json()
        try:
            assert adv.get("report_token")
            assert len(adv["report_token"]) == 32
        finally:
            requests.delete(f"{BASE_URL}/api/admin/advertisers/{adv['id']}", headers=admin_headers)
