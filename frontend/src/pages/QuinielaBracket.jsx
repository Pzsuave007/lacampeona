import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, ChevronLeft, Trophy, Loader2, Check, ArrowUp, ArrowDown, Share2, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import * as htmlToImage from "html-to-image";
import { api } from "../lib/api";
import BracketExportCard from "../components/BracketExportCard";

/**
 * Visual World Cup 2026 bracket.
 * Steps: datos -> grupos -> mejores 3os -> BRACKET (árbol visual) -> compartir.
 * The knockout rounds (32avos -> Final) are one interactive tournament tree.
 * Mobile: rounds stacked vertically. Desktop (lg+): two-sided bracket
 * converging to the Final in the center. Tap a team to advance it.
 */

const STEPS = [
  { id: "info",    label: "Tus datos" },
  { id: "groups",  label: "Grupos" },
  { id: "thirds",  label: "Mejores 3os" },
  { id: "bracket", label: "Bracket" },
  { id: "review",  label: "Compartir" },
];

const STORAGE_KEY = "lc_bracket_progress";

const EMPTY_FINAL = {
  champion: "", runner_up: "", third_place_winner: "",
  final_score_home: "", final_score_away: "",
  top_scorer: "", mexico_to_quarters: "",
};

// Read persisted wizard progress once (used for lazy state init so a page
// refresh on the Share step keeps the generated bracket id / share link).
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {}; }
  catch { return {}; }
}
const clampStep = (n) => Math.min(Math.max(0, n | 0), STEPS.length - 1);

// Round order from outer to inner. matchIdx within round.
const PREV_ROUND = { sf: "qf", qf: "r16", r16: "r32" };
const ROUND_LABEL = { r32: "32avos", r16: "Octavos", qf: "Cuartos", sf: "Semis", final: "Final" };
const ROUND_MATCHES = { r32: 16, r16: 8, qf: 4, sf: 2 };

// ---- Official FIFA World Cup 2026 Round-of-32 bracket structure ----
// Source: FIFA / Fox Sports official bracket. Each R32 slot is defined by group
// position: W=group winner (1X), R=runner-up (2X), T=one of the best 8 thirds
// (allowed only from the listed groups). The 16 slots are ordered so this app's
// binary tree (r16[i] = r32[2i] vs r32[2i+1], etc.) reproduces the real
// knockout tree converging to the Final.
const W = (g) => ({ t: "w", g });
const R = (g) => ({ t: "r", g });
const T = (groups) => ({ t: "t", groups });

const R32_SLOTS = [
  [W("E"), T(["A", "B", "C", "D", "F"])], // 1E vs 3(ABCDF)
  [W("I"), T(["C", "D", "F", "G", "H"])], // 1I vs 3(CDFGH)
  [W("A"), T(["C", "E", "F", "H", "I"])], // 1A vs 3(CEFHI)
  [W("F"), R("C")],                        // 1F vs 2C
  [W("B"), T(["E", "F", "G", "I", "J"])], // 1B vs 3(EFGIJ)
  [R("K"), R("L")],                        // 2K vs 2L
  [W("D"), T(["B", "E", "F", "I", "J"])], // 1D vs 3(BEFIJ)
  [W("L"), T(["E", "H", "I", "J", "K"])], // 1L vs 3(EHIJK)
  [R("A"), R("B")],                        // 2A vs 2B
  [W("C"), R("F")],                        // 1C vs 2F
  [W("G"), T(["A", "E", "H", "I", "J"])], // 1G vs 3(AEHIJ)
  [R("E"), R("I")],                        // 2E vs 2I
  [W("K"), T(["D", "E", "I", "J", "L"])], // 1K vs 3(DEIJL)
  [R("D"), R("G")],                        // 2D vs 2G
  [W("J"), R("H")],                        // 1J vs 2H
  [W("H"), R("J")],                        // 1H vs 2J
];

const seedLabel = (spec) => (spec.t === "w" ? `1${spec.g}` : spec.t === "r" ? `2${spec.g}` : "3°");
const R32_LABELS = R32_SLOTS.map(([h, a]) => [seedLabel(h), seedLabel(a)]);

// Assign the 8 chosen best-thirds to the 8 "third" slots respecting each slot's
// allowed groups (FIFA rule: a third can only land in specific bracket slots).
// Uses Kuhn's bipartite matching; falls back to filling any free slot.
function matchThirdsToSlots(thirds, slots) {
  const slotMatch = new Array(slots.length).fill(-1);
  const canUse = (k, j) => thirds[k].g && slots[j].groups.includes(thirds[k].g);
  const tryAssign = (k, seen) => {
    for (let j = 0; j < slots.length; j++) {
      if (canUse(k, j) && !seen[j]) {
        seen[j] = true;
        if (slotMatch[j] === -1 || tryAssign(slotMatch[j], seen)) {
          slotMatch[j] = k;
          return true;
        }
      }
    }
    return false;
  };
  for (let k = 0; k < thirds.length; k++) tryAssign(k, new Array(slots.length).fill(false));
  const used = new Set(slotMatch.filter((x) => x !== -1));
  const free = thirds.map((_, k) => k).filter((k) => !used.has(k));
  for (let j = 0; j < slots.length && free.length; j++) {
    if (slotMatch[j] === -1) slotMatch[j] = free.shift();
  }
  const out = {};
  slots.forEach((s, j) => {
    if (slotMatch[j] !== -1) out[`${s.i}-${s.side}`] = thirds[slotMatch[j]].team;
  });
  return out;
}

// Build the 16 R32 matchups (pairs of resolved team names) from the user's
// group standings and chosen best-thirds.
function buildR32Matchups(groupPositions, bestThirds) {
  const groupOfThird = {};
  const validThirds = new Set();
  for (const [g, teams] of Object.entries(groupPositions)) {
    if (teams && teams[2]) { groupOfThird[teams[2]] = g; validThirds.add(teams[2]); }
  }
  const thirdSlots = [];
  R32_SLOTS.forEach(([home, away], i) => {
    if (home.t === "t") thirdSlots.push({ i, side: 0, groups: home.groups });
    if (away.t === "t") thirdSlots.push({ i, side: 1, groups: away.groups });
  });
  // Only use teams that are CURRENTLY a 3rd-place team of their group. This
  // prevents a stale pick (e.g. a team later moved to 1st/2nd) from showing up
  // twice in the bracket.
  const thirds = bestThirds
    .filter((t) => t && validThirds.has(t))
    .map((team) => ({ team, g: groupOfThird[team] }));
  const assigned = matchThirdsToSlots(thirds, thirdSlots);
  const resolve = (spec, key) => {
    if (spec.t === "w") return (groupPositions[spec.g] || [])[0];
    if (spec.t === "r") return (groupPositions[spec.g] || [])[1];
    return assigned[key];
  };
  return R32_SLOTS.map(([home, away], i) => [resolve(home, `${i}-0`), resolve(away, `${i}-1`)]);
}


// Render only one bracket layout (desktop tree OR mobile stack) instead of
// mounting both and CSS-hiding one — avoids duplicated DOM + duplicated testids.
function useIsDesktop() {
  const query = "(min-width: 1024px)";
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export default function QuinielaBracket() {
  const navigate = useNavigate();
  const [saved] = useState(loadSaved);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stepIdx, setStepIdx] = useState(() =>
    saved.stepIdx !== undefined ? clampStep(saved.stepIdx) : 0
  );
  const [saving, setSaving] = useState(false);
  const [submission, setSubmission] = useState(saved.submission || null);

  // form state (lazy-initialised from any persisted progress)
  const [info, setInfo] = useState(saved.info || { name: "", city: "", email: "", whatsapp: "" });
  const [groupPositions, setGroupPositions] = useState(saved.groupPositions || {});
  const [bestThirds, setBestThirds] = useState(saved.bestThirds || []);  // 8 teams
  const [r32, setR32] = useState(saved.r32 || []);   // 16 winners
  const [r16, setR16] = useState(saved.r16 || []);   // 8 winners
  const [qf, setQf]   = useState(saved.qf || []);    // 4 winners
  const [sf, setSf]   = useState(saved.sf || []);    // 2 winners (finalists)
  const [finalPicks, setFinalPicks] = useState(saved.finalPicks || EMPTY_FINAL);

  useEffect(() => {
    api.get("/bracket/meta").then(({ data }) => {
      setMeta(data);
      const init = {};
      for (const [gid, teams] of Object.entries(data.groups || {})) init[gid] = [...teams];
      // Compare the OFFICIAL group memberships (team sets per group, order-agnostic)
      // against any progress saved in this browser. If the official draw changed
      // since the user last played (e.g. the bracket was corrected), their saved
      // groups are stale → reset to the official draw and clear downstream picks.
      const sig = (groups) =>
        Object.entries(groups || {})
          .map(([g, teams]) => `${g}:${[...teams].sort().join("|")}`)
          .sort()
          .join("||");
      const savedGP = saved.groupPositions;
      const stale = !savedGP || sig(savedGP) !== sig(data.groups);
      if (stale) {
        setGroupPositions(init);
        setBestThirds([]);
        setR32([]);
        setR16([]);
        setQf([]);
        setSf([]);
        setFinalPicks(EMPTY_FINAL);
      }
    }).catch(() => toast.error("No se pudo cargar")).finally(() => setLoading(false));
  }, [saved]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        info, groupPositions, bestThirds, r32, r16, qf, sf, finalPicks, stepIdx, submission,
      }));
    } catch { /* ignore */ }
  }, [info, groupPositions, bestThirds, r32, r16, qf, sf, finalPicks, stepIdx, submission]);

  const thirdPlaceTeams = useMemo(() => {
    const out = [];
    for (const teams of Object.values(groupPositions)) {
      if (teams && teams[2]) out.push(teams[2]);
    }
    return out;
  }, [groupPositions]);

  // 16 Round-of-32 matchups (pairs of team names) following the official
  // FIFA 2026 bracket structure (group winners / runners-up / best thirds).
  const r32Matchups = useMemo(
    () => buildR32Matchups(groupPositions, bestThirds),
    [groupPositions, bestThirds]
  );

  const moveTeam = (gid, idx, dir) => {
    const teams = [...(groupPositions[gid] || [])];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= teams.length) return;
    [teams[idx], teams[swapIdx]] = [teams[swapIdx], teams[idx]];
    const next = { ...groupPositions, [gid]: teams };
    setGroupPositions(next);
    // Drop any chosen best-third that is no longer a 3rd-place team after the
    // reorder (prevents a team appearing twice in the bracket).
    const validThirds = new Set(Object.values(next).map((t) => t && t[2]).filter(Boolean));
    setBestThirds((arr) => arr.filter((t) => validThirds.has(t)));
    // group order changed -> invalidate downstream knockout picks
    setR32([]); setR16([]); setQf([]); setSf([]);
    setFinalPicks((f) => ({ ...f, champion: "", runner_up: "", third_place_winner: "" }));
  };

  const toggleBestThird = (team) => {
    setBestThirds((arr) => {
      if (arr.includes(team)) return arr.filter((t) => t !== team);
      if (arr.length >= 8) {
        toast.info("Ya tienes 8 — quita uno para añadir otro");
        return arr;
      }
      return [...arr, team];
    });
    setR32([]); setR16([]); setQf([]); setSf([]);
    setFinalPicks((f) => ({ ...f, champion: "", runner_up: "", third_place_winner: "" }));
  };

  // participants feeding a given (round, idx)
  const getParts = (round, idx) => {
    if (round === "r32") return r32Matchups[idx] || [undefined, undefined];
    if (round === "r16") return [r32[idx * 2], r32[idx * 2 + 1]];
    if (round === "qf")  return [r16[idx * 2], r16[idx * 2 + 1]];
    if (round === "sf")  return [qf[idx * 2], qf[idx * 2 + 1]];
    return [sf[0], sf[1]]; // final
  };

  // official seed labels (1A / 2C / 3°) for a R32 match; null for later rounds
  const getLabels = (round, idx) => (round === "r32" ? R32_LABELS[idx] : null);

  const getWinner = (round, idx) => {
    if (round === "r32") return r32[idx];
    if (round === "r16") return r16[idx];
    if (round === "qf")  return qf[idx];
    if (round === "sf")  return sf[idx];
    return finalPicks.champion; // final
  };

  // remove downstream picks that are no longer valid participants
  const sanitize = (n32, n16, nqf, nsf, nfp) => {
    const a32 = [...n32], a16 = [...n16], aqf = [...nqf], asf = [...nsf];
    for (let i = 0; i < 16; i++) { const o = r32Matchups[i] || []; if (a32[i] && !o.includes(a32[i])) a32[i] = undefined; }
    for (let i = 0; i < 8; i++)  { const o = [a32[2 * i], a32[2 * i + 1]];           if (a16[i] && !o.includes(a16[i])) a16[i] = undefined; }
    for (let i = 0; i < 4; i++)  { const o = [a16[2 * i], a16[2 * i + 1]];           if (aqf[i] && !o.includes(aqf[i])) aqf[i] = undefined; }
    for (let i = 0; i < 2; i++)  { const o = [aqf[2 * i], aqf[2 * i + 1]];           if (asf[i] && !o.includes(asf[i])) asf[i] = undefined; }
    const fp = { ...nfp };
    const finalOpts = [asf[0], asf[1]];
    if (fp.champion && !finalOpts.includes(fp.champion)) { fp.champion = ""; fp.runner_up = ""; }
    else if (fp.champion) { fp.runner_up = finalOpts.find((t) => t && t !== fp.champion) || ""; }
    const sfLosers = aqf.filter((t) => t && !asf.includes(t));
    if (fp.third_place_winner && !sfLosers.includes(fp.third_place_winner)) fp.third_place_winner = "";
    return { a32, a16, aqf, asf, fp };
  };

  const pickWinner = (round, idx, team) => {
    if (!team) return;
    let n32 = r32, n16 = r16, nqf = qf, nsf = sf, nfp = finalPicks;
    if (round === "r32") { n32 = [...r32]; n32[idx] = team; }
    else if (round === "r16") { n16 = [...r16]; n16[idx] = team; }
    else if (round === "qf")  { nqf = [...qf]; nqf[idx] = team; }
    else if (round === "sf")  { nsf = [...sf]; nsf[idx] = team; }
    else if (round === "final") {
      nfp = { ...finalPicks, champion: team, runner_up: [sf[0], sf[1]].find((t) => t && t !== team) || "" };
    }
    const s = sanitize(n32, n16, nqf, nsf, nfp);
    setR32(s.a32); setR16(s.a16); setQf(s.aqf); setSf(s.asf); setFinalPicks(s.fp);
  };

  const canGoNext = () => {
    const s = STEPS[stepIdx] || STEPS[0];
    if (s.id === "info")    return info.name && info.city && info.email;
    if (s.id === "groups")  return true;
    if (s.id === "thirds")  return bestThirds.length === 8;
    if (s.id === "bracket") return !!finalPicks.champion;
    return true;
  };

  const submit = async () => {
    setSaving(true);
    try {
      const otherSemis = qf.filter((t) => t && t !== finalPicks.champion && t !== finalPicks.runner_up);
      const payload = {
        mode: "pro",
        name: info.name,
        city: info.city,
        email: info.email,
        whatsapp: info.whatsapp,
        accept_rules: true,
        picks_quick: {
          champion: finalPicks.champion,
          runner_up: finalPicks.runner_up,
          semi_final_3: otherSemis[0] || "",
          semi_final_4: otherSemis[1] || "",
          top_scorer: finalPicks.top_scorer,
          final_score_home: finalPicks.final_score_home === "" ? null : Number(finalPicks.final_score_home),
          final_score_away: finalPicks.final_score_away === "" ? null : Number(finalPicks.final_score_away),
          mexico_to_quarters: finalPicks.mexico_to_quarters === "" ? null : finalPicks.mexico_to_quarters === "true",
          favorite_mx_player: "",
        },
        picks_pro: {
          group_positions: groupPositions,
          best_thirds: bestThirds,
          r32_winners: r32,
          r16_winners: r16,
          qf_winners: qf,
          sf_winners: sf,
          third_place_winner: finalPicks.third_place_winner,
        },
      };
      const { data } = await api.post("/bracket/submit", payload);
      setSubmission(data);
      setStepIdx(STEPS.findIndex((s) => s.id === "review"));
      toast.success("¡Bracket enviado!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al enviar");
    } finally {
      setSaving(false);
    }
  };

  // Clear all saved progress and start a brand-new bracket from step 1.
  const startNew = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setSubmission(null);
    setInfo({ name: "", city: "", email: "", whatsapp: "" });
    setBestThirds([]);
    setR32([]); setR16([]); setQf([]); setSf([]);
    setFinalPicks(EMPTY_FINAL);
    const init = {};
    for (const [gid, teams] of Object.entries(meta?.groups || {})) init[gid] = [...teams];
    setGroupPositions(init);
    setStepIdx(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando…
      </div>
    );
  }

  const step = STEPS[stepIdx] || STEPS[0];
  const wide = step.id === "bracket";

  return (
    <div className="bg-slate-50 min-h-screen" data-testid="bracket-page">
      <header className="bg-gradient-to-br from-[#3F0A0A] via-[#7F1D1D] to-[#991B1B] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/quiniela" className="inline-flex items-center gap-1.5 text-amber-200 hover:text-white text-sm font-bold mb-2">
            <ChevronLeft className="w-4 h-4" /> Volver
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight inline-flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-300" /> Mi Bracket del Mundial 2026
          </h1>
          <div className="mt-5 flex flex-wrap gap-1 text-xs">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => stepIdx >= i ? setStepIdx(i) : null}
                data-testid={`step-${s.id}`}
                disabled={i > stepIdx}
                className={`px-2.5 py-1 rounded-full transition ${
                  i === stepIdx ? "bg-amber-300 text-slate-900 font-extrabold"
                  : i < stepIdx  ? "bg-white/15 text-white/90 hover:bg-white/25"
                  : "bg-white/5 text-white/40"
                }`}
              >
                {i + 1}. {s.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className={`${wide ? "max-w-7xl" : "max-w-5xl"} mx-auto px-4 sm:px-6 lg:px-8 py-8`}>
        {step.id === "info" && <StepInfo info={info} setInfo={setInfo} />}
        {step.id === "groups" && <StepGroups groupPositions={groupPositions} moveTeam={moveTeam} />}
        {step.id === "thirds" && (
          <StepThirds thirdPlaceTeams={thirdPlaceTeams} bestThirds={bestThirds} toggleBestThird={toggleBestThird} />
        )}
        {step.id === "bracket" && (
          <StepBracket
            getParts={getParts}
            getWinner={getWinner}
            getLabels={getLabels}
            pickWinner={pickWinner}
            finalPicks={finalPicks}
            setFinalPicks={setFinalPicks}
            qf={qf}
            sf={sf}
            pichi={meta?.pichichi_candidates || []}
          />
        )}
        {step.id === "review" && (
          <StepReview submission={submission} info={info} r32={r32} r16={r16} qf={qf} sf={sf} finalPicks={finalPicks} onStartNew={startNew} />
        )}

        {step.id !== "review" && (
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              disabled={stepIdx === 0}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white border-2 border-slate-200 text-slate-700 font-bold disabled:opacity-40 hover:border-orange-300 transition"
              data-testid="bracket-prev"
            >
              <ChevronLeft className="w-4 h-4" /> Atrás
            </button>
            {step.id === "bracket" ? (
              <button
                onClick={submit}
                disabled={!canGoNext() || saving}
                data-testid="bracket-submit"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-full px-8 py-3 transition active:scale-95 shadow-lg disabled:opacity-40"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-5 h-5" />}
                {saving ? "Enviando..." : "¡Enviar mi bracket!"}
              </button>
            ) : (
              <button
                onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
                disabled={!canGoNext()}
                data-testid="bracket-next"
                className="inline-flex items-center gap-1 px-6 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold transition disabled:opacity-40 shadow-md"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------- Match button (one matchup, two teams) ----------

function MatchCard({ round, idx, getParts, getWinner, getLabels, pickWinner, gold, testidPrefix = "bkt" }) {
  const [a, b] = getParts(round, idx);
  const winner = getWinner(round, idx);
  const labels = getLabels ? getLabels(round, idx) : null;
  return (
    <div
      className={`rounded-xl border-2 overflow-hidden shadow-sm w-full ${gold ? "border-amber-400" : "border-slate-200"} bg-white`}
      data-testid={`${testidPrefix}-${round}-${idx}`}
    >
      {[a, b].map((team, ti) => {
        const isWin = winner && winner === team;
        const empty = !team;
        return (
          <button
            key={ti}
            type="button"
            disabled={empty}
            onClick={() => pickWinner(round, idx, team)}
            data-testid={`${testidPrefix}-${round}-${idx}-team-${ti}`}
            className={`w-full flex items-center justify-between gap-1.5 px-2.5 py-2 text-sm font-bold text-left transition ${ti === 0 ? "border-b border-slate-100" : ""} ${
              isWin
                ? gold ? "bg-amber-400 text-slate-900" : "bg-emerald-500 text-white"
                : empty
                ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                : "bg-white text-slate-800 hover:bg-orange-50"
            }`}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              {labels && (
                <span className={`shrink-0 text-[9px] font-black rounded px-1 py-0.5 leading-none ${isWin ? "bg-white/25" : "bg-slate-100 text-slate-500"}`}>
                  {labels[ti]}
                </span>
              )}
              <span className="truncate">{team || "—"}</span>
            </span>
            {isWin && <Check className="w-3.5 h-3.5 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

// connector that merges two child subtrees into the parent ("]" shape)
function Connector({ mirror }) {
  return (
    <div className="relative self-stretch w-6 shrink-0">
      {/* horizontal stubs to each child */}
      <div className={`absolute top-1/4 h-0.5 bg-slate-300 -translate-y-1/2 ${mirror ? "right-0 left-1/2" : "left-0 right-1/2"}`} />
      <div className={`absolute bottom-1/4 h-0.5 bg-slate-300 translate-y-1/2 ${mirror ? "right-0 left-1/2" : "left-0 right-1/2"}`} />
      {/* vertical bar */}
      <div className={`absolute top-1/4 bottom-1/4 w-0.5 bg-slate-300 ${mirror ? "left-1/2" : "right-1/2"}`} />
      {/* horizontal to parent */}
      <div className={`absolute top-1/2 w-1/2 h-0.5 bg-slate-300 -translate-y-1/2 ${mirror ? "left-0" : "right-0"}`} />
    </div>
  );
}

// recursive half-bracket built as a plain function (no self-referencing JSX
// component tag — that pattern crashes the visual-edits babel plugin).
// `mirror` flips it horizontally for the right side of the bracket.
function renderHalf(round, idx, mirror, mc) {
  if (round === "r32") {
    return (
      <div className="flex items-center" style={{ minWidth: 150 }} key={`r32-${idx}`}>
        <MatchCard round="r32" idx={idx} {...mc} />
      </div>
    );
  }
  const prev = PREV_ROUND[round];
  return (
    <div className={`flex items-center ${mirror ? "flex-row-reverse" : ""}`} key={`${round}-${idx}`}>
      <div className="flex flex-col justify-center gap-3">
        {renderHalf(prev, idx * 2, mirror, mc)}
        {renderHalf(prev, idx * 2 + 1, mirror, mc)}
      </div>
      <Connector mirror={mirror} />
      <div className="flex items-center" style={{ minWidth: 150 }}>
        <MatchCard round={round} idx={idx} {...mc} />
      </div>
    </div>
  );
}

// ---------- Step: Bracket (the visual tree) ----------

function StepBracket({ getParts, getWinner, getLabels, pickWinner, finalPicks, setFinalPicks, qf, sf, pichi }) {
  const mc = { getParts, getWinner, getLabels, pickWinner };
  const isDesktop = useIsDesktop();
  return (
    <div data-testid="step-bracket-content">
      <h2 className="text-2xl font-black text-slate-900 mb-1">El Bracket — Eliminatorias</h2>
      <p className="text-slate-500 mb-5">Toca al equipo que crees que avanza en cada partido. Avanza solo hasta la Final 🏆.</p>

      {/* Champion banner */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white px-5 py-3 flex items-center justify-center gap-3 shadow-md" data-testid="bracket-champion-banner">
        <Trophy className="w-6 h-6" />
        <span className="text-sm font-extrabold uppercase tracking-[0.2em]">Campeón:</span>
        <span className="text-xl font-black">{finalPicks.champion || "?"}</span>
      </div>

      {isDesktop ? (
        /* DESKTOP: two-sided converging bracket */
        <div className="overflow-x-auto pb-4">
          <div className="flex items-stretch justify-center gap-2 min-w-max">
            {/* left half feeds SF #0 */}
            {renderHalf("sf", 0, false, mc)}
            {/* center: Final */}
            <div className="flex flex-col items-center justify-center px-2" style={{ minWidth: 170 }}>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-600 mb-2">Final</div>
              <MatchCard round="final" idx={0} gold {...mc} />
            </div>
            {/* right half feeds SF #1 (mirrored) */}
            {renderHalf("sf", 1, true, mc)}
          </div>
        </div>
      ) : (
        /* MOBILE: rounds stacked vertically */
        <div className="space-y-6">
          {["r32", "r16", "qf", "sf"].map((round) => (
            <div key={round}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">{ROUND_LABEL[round]}</span>
                <span className="text-xs text-slate-400">({ROUND_MATCHES[round]} partidos)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array.from({ length: ROUND_MATCHES[round] }).map((_, i) => (
                  <MatchCard key={i} round={round} idx={i} {...mc} />
                ))}
              </div>
            </div>
          ))}
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-600 mb-2 flex items-center gap-1.5">
              <Trophy className="w-4 h-4" /> Final
            </div>
            <MatchCard round="final" idx={0} gold {...mc} />
          </div>
        </div>
      )}

      {/* Final extras */}
      <FinalDetails finalPicks={finalPicks} setFinalPicks={setFinalPicks} qf={qf} sf={sf} pichi={pichi} />
    </div>
  );
}

function FinalDetails({ finalPicks, setFinalPicks, qf, sf, pichi }) {
  const set = (k, v) => setFinalPicks({ ...finalPicks, [k]: v });
  const finalists = sf.filter(Boolean);
  const semifinalists = qf.filter((t) => t && !finalists.includes(t));
  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-300 p-5">
        <h3 className="font-black text-lg text-slate-900 mb-3">🏆 Detalles de la Final</h3>
        <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600">Marcador final</label>
        <div className="flex items-center gap-2 mt-1 mb-4">
          <input data-testid="final-score-home" type="number" min="0" value={finalPicks.final_score_home} onChange={(e) => set("final_score_home", e.target.value)} className="w-16 px-2 py-2 rounded-lg border-2 border-slate-200 text-center text-2xl font-black" placeholder="2" />
          <span className="font-black text-slate-400 text-2xl">-</span>
          <input data-testid="final-score-away" type="number" min="0" value={finalPicks.final_score_away} onChange={(e) => set("final_score_away", e.target.value)} className="w-16 px-2 py-2 rounded-lg border-2 border-slate-200 text-center text-2xl font-black" placeholder="1" />
        </div>
        <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600">Goleador del torneo</label>
        <select data-testid="final-pichichi" value={finalPicks.top_scorer} onChange={(e) => set("top_scorer", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border-2 border-slate-200 bg-white">
          <option value="">— Selecciona —</option>
          {pichi.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-black text-base text-slate-900 mb-2">🥉 Partido del 3er Lugar</h3>
          <p className="text-xs text-slate-500 mb-3">Entre los que perdieron las semifinales: {semifinalists.join(" vs ") || "—"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {semifinalists.map((t) => (
              <button key={t} type="button" onClick={() => set("third_place_winner", t)} data-testid={`third-pick-${t}`}
                className={`px-3 py-2 rounded-xl font-bold text-sm transition ${
                  finalPicks.third_place_winner === t ? "bg-emerald-500 text-white shadow-md" : "bg-slate-50 text-slate-700 hover:bg-emerald-50"
                }`}>
                {finalPicks.third_place_winner === t && "🥉 "} {t}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-black text-base text-slate-900 mb-2">Bonus 🇲🇽</h3>
          <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600">¿México llega a cuartos? (+5 pts)</label>
          <div className="flex gap-2 mt-1">
            {[["true", "Sí"], ["false", "No"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => set("mexico_to_quarters", v)} data-testid={`mxqf-${v}`}
                className={`px-5 py-2 rounded-full font-bold transition ${
                  finalPicks.mexico_to_quarters === v ? "bg-orange-600 text-white shadow-md" : "bg-slate-100 text-slate-700"
                }`}>{l}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Other steps (datos / grupos / 3os / review) ----------

function StepInfo({ info, setInfo }) {
  return (
    <div data-testid="step-info-content" className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8">
      <h2 className="text-2xl font-black text-slate-900 mb-2">Tus datos</h2>
      <p className="text-slate-500 mb-5">Para que podamos contactarte si ganas.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          ["name", "Nombre completo *"],
          ["city", "Ciudad *"],
          ["email", "Email *", "email"],
          ["whatsapp", "WhatsApp (opcional)"],
        ].map(([k, label, type]) => (
          <div key={k}>
            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600">{label}</label>
            <input
              data-testid={`bracket-${k}`}
              type={type || "text"}
              value={info[k]}
              onChange={(e) => setInfo({ ...info, [k]: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-orange-400 focus:outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StepGroups({ groupPositions, moveTeam }) {
  return (
    <div data-testid="step-groups-content">
      <h2 className="text-2xl font-black text-slate-900 mb-2">Fase de Grupos</h2>
      <p className="text-slate-500 mb-5">Reordena los equipos en cada grupo (1º arriba). Los 2 primeros pasan directo a 32avos, y los 3eros entran al siguiente paso.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(groupPositions).map(([gid, teams]) => (
          <div key={gid} className="bg-white rounded-2xl border border-slate-200 p-4" data-testid={`group-${gid}`}>
            <h3 className="font-black text-lg text-slate-900 mb-2">Grupo {gid}</h3>
            <ul className="space-y-1.5">
              {teams.map((team, idx) => (
                <li key={team + idx} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border-2 ${
                  idx === 0 ? "bg-emerald-50 border-emerald-300" :
                  idx === 1 ? "bg-blue-50 border-blue-300" :
                  idx === 2 ? "bg-amber-50 border-amber-300" :
                  "bg-slate-50 border-slate-200"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-white border-2 border-slate-300 text-xs font-black text-slate-700 flex items-center justify-center">{idx + 1}</span>
                    <span className="font-bold text-slate-800 text-sm">{team}</span>
                  </div>
                  <div className="flex gap-1">
                    <button data-testid={`group-${gid}-up-${idx}`} onClick={() => moveTeam(gid, idx, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-white disabled:opacity-30">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button data-testid={`group-${gid}-down-${idx}`} onClick={() => moveTeam(gid, idx, 1)} disabled={idx === 3} className="p-1 rounded hover:bg-white disabled:opacity-30">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepThirds({ thirdPlaceTeams, bestThirds, toggleBestThird }) {
  return (
    <div data-testid="step-thirds-content">
      <h2 className="text-2xl font-black text-slate-900 mb-2">Mejores 8 Terceros</h2>
      <p className="text-slate-500 mb-5">De los 12 equipos en tercer lugar, elige los <strong>8 que crees que avanzarán</strong> a 32avos por mejor diferencia de goles. <span className="font-bold">Seleccionados: {bestThirds.length}/8</span></p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {thirdPlaceTeams.map((team) => {
          const picked = bestThirds.includes(team);
          return (
            <button
              key={team}
              type="button"
              onClick={() => toggleBestThird(team)}
              data-testid={`third-${team}`}
              className={`px-3 py-2.5 rounded-xl border-2 font-bold text-sm transition ${
                picked
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-md"
                  : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300"
              }`}
            >
              {picked && <Check className="w-3.5 h-3.5 inline mr-1" />}
              {team}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepReview({ submission, info, r32, r16, qf, sf, finalPicks, onStartNew }) {
  const [copied, setCopied] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const exportRef = useRef(null);
  const navigate = useNavigate();
  const shareUrl = submission
    ? `${process.env.REACT_APP_BACKEND_URL}/api/bracket/og/${submission.id}`
    : "";
  const shareText = `Mi bracket del Mundial 2026 ⚽🏆: Campeón ${finalPicks.champion} ${finalPicks.final_score_home}-${finalPicks.final_score_away} ${finalPicks.runner_up}. ¡Haz el tuyo en La Campeona 880 AM!`;
  const copyLink = async () => {
    if (!shareUrl) return;
    const markCopied = () => {
      setCopied(true);
      toast.success("¡Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    };
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
        markCopied();
        return;
      }
      throw new Error("clipboard unavailable");
    } catch {
      // Fallback for browsers/contexts where the async clipboard API is blocked
      try {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        markCopied();
      } catch {
        toast.error("No se pudo copiar — mantén presionado el link para copiarlo");
      }
    }
  };
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const shareBracket = async () => {
    if (!shareUrl) return;
    if (canNativeShare) {
      try {
        await navigator.share({ title: "Mi Bracket del Mundial 2026", text: shareText, url: shareUrl });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return; // usuario canceló el menú
        // si el share nativo falla, caemos a copiar el link
      }
    }
    copyLink();
  };
  const shareFb = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank");
  const shareWa = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`, "_blank");

  // ---- Full bracket image (download / share as PNG) ----
  const makeBlob = async () => {
    const node = exportRef.current;
    if (!node) return null;
    // render twice — first pass warms web fonts/images so the export is crisp
    await htmlToImage.toPng(node, { pixelRatio: 2, cacheBust: true });
    return htmlToImage.toBlob(node, { pixelRatio: 2, cacheBust: true });
  };
  const fileName = `mi-bracket-mundial-2026-${(info.name || "fan").trim().replace(/\s+/g, "-").toLowerCase()}.png`;
  const downloadImage = async () => {
    setImgBusy(true);
    try {
      const blob = await makeBlob();
      if (!blob) throw new Error("no blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success("¡Imagen descargada!");
    } catch {
      toast.error("No se pudo generar la imagen, intenta de nuevo");
    } finally {
      setImgBusy(false);
    }
  };
  const shareImage = async () => {
    setImgBusy(true);
    try {
      const blob = await makeBlob();
      if (!blob) throw new Error("no blob");
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Mi Bracket del Mundial 2026", text: shareText });
      } else {
        // Desktop / unsupported → download instead so they can attach it manually
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast.info("Imagen descargada — adjúntala en tu publicación");
      }
    } catch (e) {
      if (!(e && e.name === "AbortError")) toast.error("No se pudo compartir la imagen");
    } finally {
      setImgBusy(false);
    }
  };

  return (
    <div data-testid="step-review-content">
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-3xl p-6 mb-6">
        <div className="flex items-center gap-3">
          <Check className="w-8 h-8" />
          <div>
            <h2 className="text-2xl font-black">¡Bracket guardado!</h2>
            <p className="text-emerald-50 mt-0.5">Tu puntaje inicial: <strong className="text-amber-200">{submission?.score ?? 0} pts</strong> · Se actualiza con los resultados oficiales.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 mb-6">
        <h3 className="font-black text-lg text-slate-900 mb-2">Comparte tu bracket</h3>
        <p className="text-sm text-slate-500 mb-4">Reta a tus amigos a hacer su propio bracket en La Campeona 880 AM.</p>
        {canNativeShare && (
          <button onClick={shareBracket} data-testid="share-native" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-full px-6 py-3 mb-3 transition active:scale-95 shadow-md">
            <Share2 className="w-5 h-5" /> Compartir mi bracket
          </button>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={copyLink} data-testid="share-copy" className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full px-4 py-2.5 transition">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copiado" : "Copiar link"}
          </button>
          <button onClick={shareFb} data-testid="share-fb" className="inline-flex items-center gap-1.5 bg-[#1877F2] hover:bg-[#0d65d9] text-white font-bold rounded-full px-4 py-2.5 transition">
            <Share2 className="w-4 h-4" /> Facebook
          </button>
          <button onClick={shareWa} data-testid="share-wa" className="inline-flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1FAD54] text-white font-bold rounded-full px-4 py-2.5 transition">
            <Share2 className="w-4 h-4" /> WhatsApp
          </button>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">Si el botón Copiar link no funciona en tu teléfono, mantén presionado el texto de abajo para copiarlo.</p>
        <input
          readOnly
          value={shareUrl}
          data-testid="share-url-input"
          onClick={(e) => e.target.select()}
          onFocus={(e) => e.target.select()}
          className="mt-1 w-full text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono"
        />
      </div>

      {/* Download / share the full bracket as an image */}
      <div className="bg-gradient-to-br from-[#3F0A0A] to-[#7F1D1D] text-white rounded-3xl p-6 mb-6">
        <h3 className="font-black text-lg mb-1">Descarga tu bracket completo 🏆</h3>
        <p className="text-sm text-amber-100/90 mb-4">Genera una imagen con todo tu árbol (Octavos → Final) para guardarla o postearla donde quieras.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={downloadImage} disabled={imgBusy} data-testid="bracket-download-img" className="inline-flex items-center justify-center gap-2 bg-amber-300 hover:bg-amber-400 text-[#3F0A0A] font-black rounded-full px-6 py-3 transition active:scale-95 disabled:opacity-50">
            {imgBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} Descargar imagen
          </button>
          <button onClick={shareImage} disabled={imgBusy} data-testid="bracket-share-img" className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-bold rounded-full px-6 py-3 transition active:scale-95 disabled:opacity-50">
            {imgBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />} Compartir imagen
          </button>
        </div>
      </div>

      <BracketVisual info={info} qf={qf} sf={sf} finalPicks={finalPicks} />

      {/* Off-screen full-bracket card used only to render the export PNG */}
      <div data-testid="bracket-export-wrapper" aria-hidden style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", opacity: 0 }}>
        <BracketExportCard ref={exportRef} info={info} r32={r32} r16={r16} qf={qf} sf={sf} finalPicks={finalPicks} />
      </div>

      <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
        <button onClick={() => navigate("/quiniela/leaderboard")} className="inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full px-6 py-3 transition shadow-md">
          <Trophy className="w-5 h-5" /> Ver tabla de posiciones
        </button>
        <button onClick={onStartNew} data-testid="bracket-start-new" className="inline-flex items-center justify-center gap-2 bg-white border-2 border-slate-200 hover:border-orange-300 text-slate-700 font-bold rounded-full px-6 py-3 transition">
          <Trophy className="w-5 h-5" /> Hacer otro bracket
        </button>
      </div>
    </div>
  );
}

function BracketVisual({ info, finalPicks, qf, sf }) {
  return (
    <div className="bg-white rounded-3xl border-2 border-amber-200 overflow-hidden shadow-md" data-testid="bracket-visual">
      <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white px-6 py-4 text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.3em] opacity-90">El bracket de</p>
        <h3 className="text-2xl font-black">{info.name || "Tu nombre"}</h3>
        <p className="text-sm opacity-90">{info.city}</p>
      </div>
      <div className="p-6">
        <div className="text-center mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-600">🏆 Campeón</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{finalPicks.champion || "?"}</p>
          <p className="text-sm text-slate-500 mt-1">
            {finalPicks.champion} {finalPicks.final_score_home}-{finalPicks.final_score_away} {finalPicks.runner_up}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Bucket label="🥈 Subcampeón" team={finalPicks.runner_up} />
          <Bucket label="🥉 3er lugar" team={finalPicks.third_place_winner} />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mt-4 mb-2">Semifinalistas</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {qf.filter(Boolean).slice(0, 4).map((t) => (
            <div key={t} className="bg-emerald-50 border border-emerald-200 rounded-xl px-2 py-1.5 text-sm font-bold text-emerald-800 text-center">{t}</div>
          ))}
        </div>
        {finalPicks.top_scorer && (
          <div className="mt-4 text-center text-sm text-slate-600">
            <span className="font-bold">⚽ Pichichi:</span> {finalPicks.top_scorer}
          </div>
        )}
      </div>
      <div className="bg-slate-900 text-white text-center py-3 text-xs font-bold uppercase tracking-[0.3em]">
        Quiniela del Mundial 2026 · La Campeona 880 AM
      </div>
    </div>
  );
}

function Bucket({ label, team }) {
  return (
    <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="font-black text-slate-900 mt-1 text-lg">{team || "?"}</p>
    </div>
  );
}
