"""Backend tests for Sprint 1 Content Studio (DJ) endpoints + auth role/host_slug + regression."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://radio-engage-mx.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@radiolatina.fm"
ADMIN_PASSWORD = "admin123"
DJ_EMAIL = "dj@radiolatina.fm"
DJ_PASSWORD = "dj123"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def dj_token():
    return _login(DJ_EMAIL, DJ_PASSWORD)["access_token"]


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)["access_token"]


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Auth role / host_slug ----------
class TestAuth:
    def test_dj_login_role_and_host_slug(self):
        data = _login(DJ_EMAIL, DJ_PASSWORD)
        assert data["user"]["role"] == "dj"
        assert data["user"]["host_slug"]
        assert isinstance(data["access_token"], str)

    def test_admin_login_role(self):
        data = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert data["user"]["role"] == "admin"
        assert "host_slug" in data["user"]

    def test_me_returns_role_and_host_slug(self, dj_token):
        r = requests.get(f"{API}/auth/me", headers=_h(dj_token), timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "dj"
        assert d["host_slug"]


# ---------- /api/dj/me ----------
class TestDjMe:
    def test_dj_me_unauth_returns_401(self):
        r = requests.get(f"{API}/dj/me", timeout=10)
        assert r.status_code == 401

    def test_dj_me_for_dj(self, dj_token):
        r = requests.get(f"{API}/dj/me", headers=_h(dj_token), timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "dj"
        assert d["host_slug"]
        assert d["host"] is not None
        assert d["host"]["slug"] == d["host_slug"]

    def test_dj_me_for_admin(self, admin_token):
        r = requests.get(f"{API}/dj/me", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"


# ---------- /api/dj/templates ----------
class TestTemplates:
    def test_templates_returns_8(self, dj_token):
        r = requests.get(f"{API}/dj/templates", headers=_h(dj_token), timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) == 8
        keys = {it["key"] for it in items}
        expected = {
            "today_in_history", "hot_take", "throwback", "poll",
            "behind_scenes", "important_day", "inspirational_quote",
            "musical_recommendation",
        }
        assert keys == expected
        for it in items:
            assert "label" in it and "emoji" in it and "description" in it
            assert "fields" in it and isinstance(it["fields"], list)
            assert "instruction" not in it  # must NOT leak

    def test_templates_unauth(self):
        r = requests.get(f"{API}/dj/templates", timeout=10)
        assert r.status_code == 401


# ---------- /api/dj/generate ----------
class TestGenerate:
    def test_invalid_template_returns_400(self, dj_token):
        r = requests.post(
            f"{API}/dj/generate",
            headers=_h(dj_token),
            json={"template_type": "not_a_template", "inputs": {}},
            timeout=30,
        )
        assert r.status_code == 400

    @pytest.mark.timeout(120)
    def test_generate_musical_recommendation(self, dj_token):
        r = requests.post(
            f"{API}/dj/generate",
            headers=_h(dj_token),
            json={
                "template_type": "musical_recommendation",
                "platform": "instagram",
                "inputs": {
                    "song_artist": "Karol G - Mañana Será Bonito",
                    "why": "Es perfecta para manejar al trabajo",
                },
            },
            timeout=90,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "text" in d and isinstance(d["text"], str) and len(d["text"]) > 50
        text = d["text"]
        assert "[CAPTION]" in text
        assert "[HASHTAGS]" in text
        assert "[CTA]" in text

    @pytest.mark.timeout(120)
    def test_generate_with_save_persists_draft(self, dj_token):
        r = requests.post(
            f"{API}/dj/generate",
            headers=_h(dj_token),
            json={
                "template_type": "hot_take",
                "platform": "instagram",
                "inputs": {"topic": "TEST_¿Bad Bunny es el rey del reggaeton?"},
                "save": True,
            },
            timeout=90,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "draft" in d
        draft = d["draft"]
        assert draft["id"] and draft["text"] == d["text"]
        assert draft["status"] == "draft"
        # cleanup
        requests.delete(f"{API}/dj/drafts/{draft['id']}", headers=_h(dj_token), timeout=10)


# ---------- Drafts CRUD + permissions ----------
class TestDraftsCRUD:
    def test_full_crud(self, dj_token):
        # CREATE
        r = requests.post(
            f"{API}/dj/drafts",
            headers=_h(dj_token),
            json={
                "template_type": "throwback",
                "inputs": {"memory": "TEST_recuerdo"},
                "text": "TEST_TEXT_INITIAL",
                "platform": "instagram",
                "title": "TEST_TITLE",
                "status": "draft",
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        draft = r.json()
        did = draft["id"]
        assert draft["host_slug"]
        assert draft["text"] == "TEST_TEXT_INITIAL"
        assert draft["status"] == "draft"

        # LIST
        r = requests.get(f"{API}/dj/drafts", headers=_h(dj_token), timeout=10)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert did in ids

        # PATCH
        r = requests.patch(
            f"{API}/dj/drafts/{did}",
            headers=_h(dj_token),
            json={"text": "TEST_TEXT_UPDATED", "status": "scheduled", "scheduled_at": "2026-02-01"},
            timeout=10,
        )
        assert r.status_code == 200
        upd = r.json()
        assert upd["text"] == "TEST_TEXT_UPDATED"
        assert upd["status"] == "scheduled"
        assert upd["scheduled_at"] == "2026-02-01"

        # DELETE
        r = requests.delete(f"{API}/dj/drafts/{did}", headers=_h(dj_token), timeout=10)
        assert r.status_code == 200

        # Verify gone
        r = requests.get(f"{API}/dj/drafts", headers=_h(dj_token), timeout=10)
        assert did not in [x["id"] for x in r.json()]

    def test_dj_sees_only_own_host_slug(self, dj_token, admin_token):
        # Admin creates a draft (host_slug='__admin__')
        r = requests.post(
            f"{API}/dj/drafts",
            headers=_h(admin_token),
            json={
                "template_type": "poll",
                "inputs": {"question": "TEST_q", "options": "a,b"},
                "text": "TEST_ADMIN_DRAFT",
            },
            timeout=10,
        )
        assert r.status_code == 200
        admin_draft_id = r.json()["id"]
        assert r.json()["host_slug"] == "__admin__"

        # DJ list should NOT include this admin draft
        r = requests.get(f"{API}/dj/drafts", headers=_h(dj_token), timeout=10)
        ids = [x["id"] for x in r.json()]
        assert admin_draft_id not in ids

        # DJ cannot patch admin draft
        r = requests.patch(
            f"{API}/dj/drafts/{admin_draft_id}",
            headers=_h(dj_token),
            json={"text": "hack"},
            timeout=10,
        )
        assert r.status_code == 403

        # DJ cannot delete admin draft
        r = requests.delete(f"{API}/dj/drafts/{admin_draft_id}", headers=_h(dj_token), timeout=10)
        assert r.status_code == 403

        # Admin cleanup
        r = requests.delete(f"{API}/dj/drafts/{admin_draft_id}", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200

    def test_admin_can_use_dj_endpoints(self, admin_token):
        r = requests.get(f"{API}/dj/templates", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        r = requests.get(f"{API}/dj/drafts", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200


# ---------- /api/dj/suggest (AI ideation) ----------
class TestSuggest:
    def test_suggest_unauth_returns_401(self):
        r = requests.post(f"{API}/dj/suggest", json={"template_type": "today_in_history"}, timeout=10)
        assert r.status_code == 401

    def test_suggest_invalid_template_returns_400(self, dj_token):
        r = requests.post(
            f"{API}/dj/suggest",
            headers=_h(dj_token),
            json={"template_type": "not_a_template"},
            timeout=15,
        )
        assert r.status_code == 400

    @pytest.mark.timeout(120)
    def test_suggest_today_in_history_returns_10(self, dj_token):
        r = requests.post(
            f"{API}/dj/suggest",
            headers=_h(dj_token),
            json={"template_type": "today_in_history"},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["template_type"] == "today_in_history"
        assert "suggestions" in d
        sugg = d["suggestions"]
        assert isinstance(sugg, list)
        assert len(sugg) == 10, f"Expected 10, got {len(sugg)}"
        for s in sugg:
            assert "title" in s and isinstance(s["title"], str) and len(s["title"]) > 0
            assert "inputs" in s and isinstance(s["inputs"], dict)

    @pytest.mark.timeout(120)
    def test_suggest_poll_returns_10_with_question_and_options(self, dj_token):
        r = requests.post(
            f"{API}/dj/suggest",
            headers=_h(dj_token),
            json={"template_type": "poll"},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        sugg = d["suggestions"]
        assert isinstance(sugg, list)
        assert len(sugg) == 10
        # poll template's fields are 'question' and 'options'
        valid_keys = {"question", "options"}
        # Most suggestions should have at least one valid key (server filters by valid_keys)
        with_keys = [s for s in sugg if set(s["inputs"].keys()) & valid_keys]
        assert len(with_keys) >= 8, f"Expected >=8 suggestions with question/options, got {len(with_keys)}"
        # Check at least one has both
        with_both = [s for s in sugg if {"question", "options"}.issubset(set(s["inputs"].keys()))]
        assert len(with_both) >= 5, f"Expected >=5 suggestions with both question and options, got {len(with_both)}"


# ---------- Regression on existing endpoints ----------
class TestRegression:
    def test_active(self):
        r = requests.get(f"{API}/active", timeout=10)
        assert r.status_code == 200
        assert "advertiser" in r.json()

    def test_advertisers(self):
        r = requests.get(f"{API}/advertisers", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_events(self):
        r = requests.get(f"{API}/events", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_overview(self, admin_token):
        r = requests.get(f"{API}/admin/analytics/overview", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "totals" in d

    def test_track_endpoint(self):
        r = requests.post(
            f"{API}/track",
            json={"kind": "impression", "entity_type": "advertiser", "entity_id": "TEST_NONE", "session_id": "TEST_S"},
            timeout=10,
        )
        assert r.status_code == 200
