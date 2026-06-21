"""
Tests for World Cup 2026 Quiniela — Admin Visual Results Bracket flow.

Covers:
  1. Auth: super-admin login.
  2. /api/bracket/meta returns official groups (A-L) with Group A = México/Sudáfrica/Corea del Sur/Chequia.
  3. PUT /api/bracket/admin/results accepts the BracketOfficialResults payload (group_positions,
     best_thirds, r32/r16/qf/sf_winners, third_place_winner) and persists.
  4. GET /api/bracket/admin/results returns saved data.
  5. POST /api/bracket/submit (mode='pro') + setting matching official results -> prediction
     score reflects round bonuses (r32 +2, r16 +3, qf +5, sf +8, champion via quick +25, etc).
  6. /api/bracket/leaderboard and /api/bracket/admin/predictions reflect score.
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"

SUPER_EMAIL = "pzsuave007@gmail.com"
SUPER_PASS = "MXmedia007"


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_EMAIL, "password": SUPER_PASS},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok
    s.headers["Authorization"] = f"Bearer {tok}"
    return s


@pytest.fixture(scope="session")
def meta():
    r = requests.get(f"{BASE_URL}/api/bracket/meta", timeout=15)
    assert r.status_code == 200
    return r.json()


# -- 1. Bracket meta sanity --
class TestBracketMeta:
    def test_groups_present(self, meta):
        assert "groups" in meta
        assert set(meta["groups"].keys()) == set(list("ABCDEFGHIJKL"))

    def test_group_a_official_teams(self, meta):
        ga = meta["groups"]["A"]
        assert ga[0] == "México"
        assert "Sudáfrica" in ga
        assert "Corea del Sur" in ga
        assert "Chequia" in ga

    def test_pichichi_candidates(self, meta):
        assert isinstance(meta.get("pichichi_candidates"), list)
        assert len(meta["pichichi_candidates"]) >= 5


# -- 2. Admin login / endpoints reachable --
class TestAdminAuth:
    def test_super_admin_login(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == SUPER_EMAIL
        assert data["role"] in ("super_admin", "admin", "owner", "super")

    def test_admin_results_get_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/bracket/admin/results", timeout=10)
        assert r.status_code in (401, 403)

    def test_admin_results_get_ok(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/bracket/admin/results", timeout=10)
        assert r.status_code == 200


# -- 3. PUT /api/bracket/admin/results persists full visual-bracket payload --
class TestAdminResultsPersistence:
    """Saves a complete official-results bracket and verifies GET returns identical fields."""

    @pytest.fixture(scope="class")
    def official_payload(self, meta):
        groups = meta["groups"]
        # Use first 8 third-place teams (index 2 of each group)
        best_thirds = [groups[g][2] for g in list("ABCDEFGH")]
        # 16 R32 winners — pick the 1st-placed team in each group + 4 second-placed-from-other-groups
        gpositions = {g: list(groups[g]) for g in groups}
        # winners in R32: 16 teams advancing — use group-stage 1st + 2nd from every other group (deterministic)
        winners_r32 = [groups[g][0] for g in list("ABCDEFGHIJKL")] + [
            groups[g][1] for g in list("ABCD")
        ]
        assert len(winners_r32) == 16
        winners_r16 = winners_r32[:8]
        winners_qf = winners_r16[:4]
        winners_sf = winners_qf[:2]
        champion = winners_sf[0]
        runner_up = winners_sf[1]
        third_place = winners_qf[2]
        semi_finalists = [winners_qf[2], winners_qf[3]]

        return {
            "champion": champion,
            "runner_up": runner_up,
            "semi_finalists": semi_finalists,
            "top_scorer": "Lionel Messi (Argentina)",
            "final_score_home": 2,
            "final_score_away": 1,
            "mexico_to_quarters": True,
            "group_positions": gpositions,
            "best_thirds": best_thirds,
            "r32_winners": winners_r32,
            "r16_winners": winners_r16,
            "qf_winners": winners_qf,
            "sf_winners": winners_sf,
            "third_place_winner": third_place,
        }

    def test_put_official_results(self, admin_session, official_payload):
        r = admin_session.put(
            f"{BASE_URL}/api/bracket/admin/results",
            json=official_payload,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("results", {}).get("champion") == official_payload["champion"]

    def test_get_returns_saved_results(self, admin_session, official_payload):
        r = admin_session.get(f"{BASE_URL}/api/bracket/admin/results", timeout=10)
        assert r.status_code == 200
        data = r.json()
        for k in (
            "champion",
            "runner_up",
            "top_scorer",
            "final_score_home",
            "final_score_away",
            "mexico_to_quarters",
            "third_place_winner",
        ):
            assert data.get(k) == official_payload[k], f"mismatch for {k}: {data.get(k)!r} vs {official_payload[k]!r}"
        for k in ("best_thirds", "r32_winners", "r16_winners", "qf_winners", "sf_winners"):
            assert data.get(k) == official_payload[k], f"list mismatch for {k}"
        # group_positions: dict equality
        assert data.get("group_positions") == official_payload["group_positions"]


# -- 4. End-to-end: pro submission + matching official results -> score reflects round bonuses --
class TestProBracketScoring:
    @pytest.fixture(scope="class")
    def settings_open(self, admin_session):
        r = admin_session.put(
            f"{BASE_URL}/api/bracket/admin/settings",
            json={"contest_status": "open"},
            timeout=10,
        )
        assert r.status_code == 200

    @pytest.fixture(scope="class")
    def submission(self, meta, settings_open):
        """Submit a 'pro' prediction whose picks_pro perfectly matches the official
        payload we will set in this same class (so all round bonuses fire)."""
        groups = meta["groups"]
        best_thirds = [groups[g][2] for g in list("ABCDEFGH")]
        gpositions = {g: list(groups[g]) for g in groups}
        r32 = [groups[g][0] for g in list("ABCDEFGHIJKL")] + [groups[g][1] for g in list("ABCD")]
        r16 = r32[:8]
        qf = r16[:4]
        sf = qf[:2]
        champion = sf[0]
        runner_up = sf[1]
        third_place = qf[2]

        unique_email = f"TEST_{uuid.uuid4().hex[:10]}@example.com"
        payload = {
            "mode": "pro",
            "name": "TEST Pro Player",
            "city": "City",
            "email": unique_email,
            "whatsapp": "",
            "accept_rules": True,
            "picks_quick": {
                "champion": champion,
                "runner_up": runner_up,
                "semi_final_3": qf[2],
                "semi_final_4": qf[3],
                "top_scorer": "Lionel Messi (Argentina)",
                "final_score_home": 2,
                "final_score_away": 1,
                "mexico_to_quarters": True,
                "favorite_mx_player": "",
            },
            "picks_pro": {
                "group_positions": gpositions,
                "best_thirds": best_thirds,
                "r32_winners": r32,
                "r16_winners": r16,
                "qf_winners": qf,
                "sf_winners": sf,
                "third_place_winner": third_place,
            },
        }
        r = requests.post(f"{BASE_URL}/api/bracket/submit", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        return {
            "id": body["id"],
            "email": unique_email,
            "payload": payload,
        }

    @pytest.fixture(scope="class")
    def trigger_rescore(self, admin_session, submission, meta):
        groups = meta["groups"]
        pp = submission["payload"]["picks_pro"]
        pq = submission["payload"]["picks_quick"]
        official = {
            "champion": pq["champion"],
            "runner_up": pq["runner_up"],
            "semi_finalists": [pp["qf_winners"][2], pp["qf_winners"][3]],
            "top_scorer": pq["top_scorer"],
            "final_score_home": pq["final_score_home"],
            "final_score_away": pq["final_score_away"],
            "mexico_to_quarters": pq["mexico_to_quarters"],
            "group_positions": pp["group_positions"],
            "best_thirds": pp["best_thirds"],
            "r32_winners": pp["r32_winners"],
            "r16_winners": pp["r16_winners"],
            "qf_winners": pp["qf_winners"],
            "sf_winners": pp["sf_winners"],
            "third_place_winner": pp["third_place_winner"],
        }
        r = admin_session.put(f"{BASE_URL}/api/bracket/admin/results", json=official, timeout=20)
        assert r.status_code == 200, r.text
        time.sleep(0.5)
        return official

    def test_admin_predictions_contains_score(self, admin_session, submission, trigger_rescore):
        r = admin_session.get(f"{BASE_URL}/api/bracket/admin/predictions", timeout=15)
        assert r.status_code == 200
        rows = r.json()
        mine = [p for p in rows if p.get("id") == submission["id"]]
        assert mine, "Submitted prediction not found in admin list"
        score = mine[0]["score"]
        # Expected minimum bonuses for a perfectly matching pro bracket:
        #  - r32 +2*16 = 32
        #  - r16 +3*8 = 24
        #  - qf  +5*4 = 20
        #  - sf  +8*2 = 16
        #  - group_positions: 12 groups * (2+1+1) = 48 (1st=+2, 2nd=+1, 3rd=+1)
        #  - best_thirds (8) +2*8 = 16
        #  - third place +5
        #  - quick: champion +25, runner_up +15, both semis +10*2 = 20, top_scorer +15,
        #    exact score +20, mexico_to_quarters +5
        # Total >= 261
        assert score >= 200, f"Score too low for a perfect pro bracket: {score}"

    def test_leaderboard_includes_submission(self, submission, trigger_rescore):
        r = requests.get(f"{BASE_URL}/api/bracket/leaderboard?limit=500", timeout=10)
        assert r.status_code == 200
        # Endpoint may return list or {entries: []}
        data = r.json()
        if isinstance(data, list):
            entries = data
        else:
            entries = data.get("rows") or data.get("entries") or []
        ids = {e.get("id") for e in entries}
        assert submission["id"] in ids, f"Submission not on leaderboard. shape={type(data).__name__} keys={list(data.keys()) if isinstance(data, dict) else 'list'}"
        my_row = next(e for e in entries if e.get("id") == submission["id"])
        assert my_row["score"] > 0


# -- 5. Partial save (admin doesn't need full rounds filled) --
class TestPartialAdminSave:
    def test_partial_save_allowed(self, admin_session):
        partial = {
            "champion": "México",
            "runner_up": "",
            "semi_finalists": [],
            "top_scorer": "",
            "group_positions": {"A": ["México", "Sudáfrica", "Corea del Sur", "Chequia"]},
            "best_thirds": [],
            "r32_winners": [],
            "r16_winners": [],
            "qf_winners": [],
            "sf_winners": [],
            "third_place_winner": "",
        }
        r = admin_session.put(
            f"{BASE_URL}/api/bracket/admin/results", json=partial, timeout=15
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
