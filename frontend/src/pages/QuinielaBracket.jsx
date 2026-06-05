import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, ChevronLeft, Trophy, Loader2, Check, ArrowUp, ArrowDown, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

/**
 * Visual World Cup 2026 bracket wizard.
 * Linear, step-by-step. Each step is a focused screen. Final step shows the
 * complete visual bracket + share button.
 */

const STEPS = [
  { id: "info",         label: "Tus datos" },
  { id: "groups",       label: "Grupos" },
  { id: "thirds",       label: "Mejores 3os" },
  { id: "r32",          label: "32avos" },
  { id: "r16",          label: "Octavos" },
  { id: "qf",           label: "Cuartos" },
  { id: "sf",           label: "Semifinales" },
  { id: "final",        label: "Final" },
  { id: "review",       label: "Compartir" },
];

const STORAGE_KEY = "lc_bracket_progress";

export default function QuinielaBracket() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submission, setSubmission] = useState(null); // {id, edit_token, score} when saved

  // form state
  const [info, setInfo] = useState({ name: "", city: "", email: "", whatsapp: "" });
  // groups: {"A": [team1, team2, team3, team4], ...} — order = position
  const [groupPositions, setGroupPositions] = useState({});
  const [bestThirds, setBestThirds] = useState([]);  // 8 teams
  const [r32, setR32] = useState([]);   // 16 winners
  const [r16, setR16] = useState([]);   // 8 winners
  const [qf, setQf]   = useState([]);   // 4 winners
  const [sf, setSf]   = useState([]);   // 2 winners (finalists)
  const [finalPicks, setFinalPicks] = useState({
    champion: "", runner_up: "", third_place_winner: "",
    final_score_home: "", final_score_away: "",
    top_scorer: "", mexico_to_quarters: "",
  });

  useEffect(() => {
    api.get("/bracket/meta").then(({ data }) => {
      setMeta(data);
      // Initialize groupPositions with the official order
      const init = {};
      for (const [gid, teams] of Object.entries(data.groups || {})) init[gid] = [...teams];
      setGroupPositions(init);
    }).catch(() => toast.error("No se pudo cargar")).finally(() => setLoading(false));

    // Restore from localStorage if there's progress
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved) {
        if (saved.info) setInfo(saved.info);
        if (saved.groupPositions) setGroupPositions(saved.groupPositions);
        if (saved.bestThirds) setBestThirds(saved.bestThirds);
        if (saved.r32) setR32(saved.r32);
        if (saved.r16) setR16(saved.r16);
        if (saved.qf) setQf(saved.qf);
        if (saved.sf) setSf(saved.sf);
        if (saved.finalPicks) setFinalPicks(saved.finalPicks);
        if (saved.stepIdx !== undefined) setStepIdx(saved.stepIdx);
      }
    } catch { /* ignore */ }
  }, []);

  // Persist locally on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        info, groupPositions, bestThirds, r32, r16, qf, sf, finalPicks, stepIdx,
      }));
    } catch { /* ignore */ }
  }, [info, groupPositions, bestThirds, r32, r16, qf, sf, finalPicks, stepIdx]);

  // Derived: list of 3rd place teams from groups (for "best 3rds" step)
  const thirdPlaceTeams = useMemo(() => {
    const out = [];
    for (const teams of Object.values(groupPositions)) {
      if (teams && teams[2]) out.push(teams[2]);
    }
    return out;
  }, [groupPositions]);

  // Derived: 32 teams advancing (top 2 of each group + 8 best thirds)
  const r32Teams = useMemo(() => {
    const top12 = [];
    const second12 = [];
    for (const teams of Object.values(groupPositions)) {
      if (teams && teams[0]) top12.push(teams[0]);
      if (teams && teams[1]) second12.push(teams[1]);
    }
    return [...top12, ...second12, ...bestThirds];
  }, [groupPositions, bestThirds]);

  const moveTeam = (gid, idx, dir) => {
    setGroupPositions((g) => {
      const teams = [...(g[gid] || [])];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= teams.length) return g;
      [teams[idx], teams[swapIdx]] = [teams[swapIdx], teams[idx]];
      return { ...g, [gid]: teams };
    });
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
  };

  const pickWinner = (setter, currentList, slotIdx, team) => {
    const next = [...currentList];
    next[slotIdx] = team;
    setter(next);
  };

  const canGoNext = () => {
    const s = STEPS[stepIdx];
    if (s.id === "info")    return info.name && info.city && info.email;
    if (s.id === "groups")  return true;
    if (s.id === "thirds")  return bestThirds.length === 8;
    if (s.id === "r32")     return r32.filter(Boolean).length === 16;
    if (s.id === "r16")     return r16.filter(Boolean).length === 8;
    if (s.id === "qf")      return qf.filter(Boolean).length === 4;
    if (s.id === "sf")      return sf.filter(Boolean).length === 2;
    if (s.id === "final")   return finalPicks.champion && finalPicks.runner_up;
    return true;
  };

  const submit = async () => {
    setSaving(true);
    try {
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
          semi_final_3: sf[0] !== finalPicks.champion && sf[0] !== finalPicks.runner_up
            ? sf[0] : (qf.find((t) => t !== finalPicks.champion && t !== finalPicks.runner_up) || ""),
          semi_final_4: sf[1] !== finalPicks.champion && sf[1] !== finalPicks.runner_up
            ? sf[1] : (qf.find((t) => t !== finalPicks.champion && t !== finalPicks.runner_up && t !== sf[0]) || ""),
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando…
      </div>
    );
  }

  const step = STEPS[stepIdx];

  return (
    <div className="bg-slate-50 min-h-screen" data-testid="bracket-page">
      {/* Header */}
      <header className="bg-gradient-to-br from-[#3F0A0A] via-[#7F1D1D] to-[#991B1B] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/quiniela" className="inline-flex items-center gap-1.5 text-amber-200 hover:text-white text-sm font-bold mb-2">
            <ChevronLeft className="w-4 h-4" /> Volver
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight inline-flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-300" /> Mi Bracket del Mundial 2026
          </h1>
          {/* Steps progress */}
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {step.id === "info" && <StepInfo info={info} setInfo={setInfo} />}
        {step.id === "groups" && (
          <StepGroups groupPositions={groupPositions} moveTeam={moveTeam} />
        )}
        {step.id === "thirds" && (
          <StepThirds thirdPlaceTeams={thirdPlaceTeams} bestThirds={bestThirds} toggleBestThird={toggleBestThird} />
        )}
        {step.id === "r32" && (
          <StepKnockout title="32avos de Final" subtitle="16 partidos: elige quién pasa a Octavos" teams={r32Teams} winners={r32} setWinners={setR32} slotCount={16} pairSize={2} />
        )}
        {step.id === "r16" && (
          <StepKnockout title="Octavos de Final" subtitle="8 partidos: elige quién pasa a Cuartos" teams={r32.filter(Boolean)} winners={r16} setWinners={setR16} slotCount={8} pairSize={2} />
        )}
        {step.id === "qf" && (
          <StepKnockout title="Cuartos de Final" subtitle="4 partidos: elige quién pasa a Semis" teams={r16.filter(Boolean)} winners={qf} setWinners={setQf} slotCount={4} pairSize={2} />
        )}
        {step.id === "sf" && (
          <StepKnockout title="Semifinales" subtitle="2 partidos: elige quién va a la Final" teams={qf.filter(Boolean)} winners={sf} setWinners={setSf} slotCount={2} pairSize={2} />
        )}
        {step.id === "final" && (
          <StepFinal sf={sf} qf={qf} finalPicks={finalPicks} setFinalPicks={setFinalPicks} pichi={meta?.pichichi_candidates || []} />
        )}
        {step.id === "review" && (
          <StepReview
            submission={submission}
            info={info}
            groupPositions={groupPositions}
            bestThirds={bestThirds}
            r32={r32}
            r16={r16}
            qf={qf}
            sf={sf}
            finalPicks={finalPicks}
          />
        )}

        {/* Nav buttons */}
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
            {step.id === "final" ? (
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

// ----- Step components -----

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

function StepKnockout({ title, subtitle, teams, winners, setWinners, slotCount, pairSize = 2 }) {
  // Generate matchups: pair teams[0] vs teams[1], [2] vs [3], ...
  const matchups = useMemo(() => {
    const m = [];
    for (let i = 0; i < slotCount; i++) {
      const teamA = teams[i * pairSize] || "—";
      const teamB = teams[i * pairSize + 1] || "—";
      m.push([teamA, teamB]);
    }
    return m;
  }, [teams, slotCount, pairSize]);

  const pick = (matchIdx, team) => {
    const next = [...winners];
    next[matchIdx] = team;
    setWinners(next);
  };

  return (
    <div>
      <h2 className="text-2xl font-black text-slate-900 mb-1">{title}</h2>
      <p className="text-slate-500 mb-5">{subtitle}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {matchups.map(([a, b], idx) => (
          <div key={idx} className="bg-white rounded-2xl border-2 border-slate-200 p-3" data-testid={`match-${idx}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Partido {idx + 1}</div>
            {[a, b].map((team, ti) => (
              <button
                key={team + ti}
                type="button"
                disabled={team === "—"}
                onClick={() => pick(idx, team)}
                data-testid={`match-${idx}-pick-${ti}`}
                className={`w-full text-left px-3 py-2.5 rounded-xl font-bold transition mt-1 first:mt-0 ${
                  winners[idx] === team
                    ? "bg-emerald-500 text-white shadow-md"
                    : team === "—"
                    ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                    : "bg-slate-50 text-slate-800 hover:bg-orange-50 hover:ring-2 hover:ring-orange-200"
                }`}
              >
                {winners[idx] === team && <Check className="w-3.5 h-3.5 inline mr-1" />} {team}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepFinal({ sf, qf, finalPicks, setFinalPicks, pichi }) {
  const finalists = sf.filter(Boolean);
  const set = (k, v) => setFinalPicks({ ...finalPicks, [k]: v });
  const semifinalists = qf.filter((t) => !finalists.includes(t));
  return (
    <div data-testid="step-final-content">
      <h2 className="text-2xl font-black text-slate-900 mb-1">Final + 3er Lugar</h2>
      <p className="text-slate-500 mb-5">Tus 2 finalistas: <strong>{finalists.join(" vs ") || "—"}</strong></p>

      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border-2 border-amber-300 p-6">
        <h3 className="font-black text-xl text-slate-900 mb-3">🏆 La Final</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {finalists.map((t) => (
            <button key={t} type="button" onClick={() => {
              set("champion", t);
              set("runner_up", finalists.find((f) => f !== t) || "");
            }} data-testid={`final-pick-${t}`}
              className={`px-4 py-3 rounded-xl font-black text-lg transition ${
                finalPicks.champion === t ? "bg-amber-400 text-slate-900 shadow-lg" : "bg-white text-slate-700 hover:bg-amber-100"
              }`}>
              {finalPicks.champion === t && "🏆 "} {t}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600">Marcador final</label>
            <div className="flex items-center gap-2 mt-1">
              <input data-testid="final-score-home" type="number" min="0" value={finalPicks.final_score_home} onChange={(e) => set("final_score_home", e.target.value)} className="w-16 px-2 py-2 rounded-lg border-2 border-slate-200 text-center text-2xl font-black" placeholder="2" />
              <span className="font-black text-slate-400 text-2xl">-</span>
              <input data-testid="final-score-away" type="number" min="0" value={finalPicks.final_score_away} onChange={(e) => set("final_score_away", e.target.value)} className="w-16 px-2 py-2 rounded-lg border-2 border-slate-200 text-center text-2xl font-black" placeholder="1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600">Goleador del torneo</label>
            <select data-testid="final-pichichi" value={finalPicks.top_scorer} onChange={(e) => set("top_scorer", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border-2 border-slate-200 bg-white">
              <option value="">— Selecciona —</option>
              {pichi.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-5 bg-white rounded-3xl border border-slate-200 p-6">
        <h3 className="font-black text-lg text-slate-900 mb-3">🥉 Partido del 3er Lugar</h3>
        <p className="text-sm text-slate-500 mb-3">Entre los que perdieron las semifinales: {semifinalists.join(" vs ") || "—"}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {semifinalists.map((t) => (
            <button key={t} type="button" onClick={() => set("third_place_winner", t)} data-testid={`third-pick-${t}`}
              className={`px-4 py-2.5 rounded-xl font-bold transition ${
                finalPicks.third_place_winner === t ? "bg-emerald-500 text-white shadow-md" : "bg-slate-50 text-slate-700 hover:bg-emerald-50"
              }`}>
              {finalPicks.third_place_winner === t && "🥉 "} {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 bg-white rounded-3xl border border-slate-200 p-6">
        <h3 className="font-black text-lg text-slate-900 mb-3">Bonus 🇲🇽</h3>
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
  );
}

function StepReview({ submission, info, groupPositions, bestThirds, r32, r16, qf, sf, finalPicks }) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const shareUrl = submission ? `${window.location.origin}/quiniela/ver/${submission.id}` : "";
  const shareText = `Mi bracket del Mundial 2026 ⚽🏆: Campeón ${finalPicks.champion} ${finalPicks.final_score_home}-${finalPicks.final_score_away} ${finalPicks.runner_up}. ¡Haz el tuyo en La Campeona 880 AM!`;
  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const shareFb = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank");
  const shareWa = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`, "_blank");

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
      </div>

      {/* Visual bracket summary */}
      <BracketVisual info={info} groupPositions={groupPositions} r32={r32} r16={r16} qf={qf} sf={sf} finalPicks={finalPicks} />

      <div className="mt-6 flex justify-center">
        <button onClick={() => navigate("/quiniela/leaderboard")} className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full px-6 py-3 transition shadow-md">
          <Trophy className="w-5 h-5" /> Ver tabla de posiciones
        </button>
      </div>
    </div>
  );
}

function BracketVisual({ info, finalPicks, qf, sf }) {
  // Visual rendering of the knockout side of the bracket — easy to screenshot
  return (
    <div className="bg-white rounded-3xl border-2 border-amber-200 overflow-hidden shadow-md" data-testid="bracket-visual">
      <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white px-6 py-4 text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.3em] opacity-90">El bracket de</p>
        <h3 className="text-2xl font-black">{info.name || "Tu nombre"}</h3>
        <p className="text-sm opacity-90">{info.city}</p>
      </div>
      <div className="p-6">
        {/* Champion box */}
        <div className="text-center mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-600">🏆 Campeón</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{finalPicks.champion || "?"}</p>
          <p className="text-sm text-slate-500 mt-1">
            {finalPicks.champion} {finalPicks.final_score_home}-{finalPicks.final_score_away} {finalPicks.runner_up}
          </p>
        </div>

        {/* Semis */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Bucket label="🥈 Subcampeón" team={finalPicks.runner_up} />
          <Bucket label="🥉 3er lugar" team={finalPicks.third_place_winner} />
        </div>

        {/* Semifinalists (= QF winners minus the finalists) */}
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
