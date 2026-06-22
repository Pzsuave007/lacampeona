import React, { useEffect, useMemo, useState } from "react";
import { Save, Loader2, Trophy, ChevronLeft, ChevronRight, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { StepBracket, buildR32Matchups, R32_LABELS, EMPTY_FINAL } from "./QuinielaBracket";

const STEPS = [
  { id: "groups", label: "Fase de grupos (puntos y goles)" },
  { id: "thirds", label: "Mejores 3os" },
  { id: "bracket", label: "Eliminatorias" },
];

const ZERO = { pts: 0, gf: 0, ga: 0 };

// Sort a list of teams by FIFA criteria: points, goal difference, goals for.
function sortByCriteria(teams, statOf) {
  return [...teams].sort((a, b) => {
    const sa = statOf(a), sb = statOf(b);
    if (sb.pts !== sa.pts) return sb.pts - sa.pts;
    const gda = sa.gf - sa.ga, gdb = sb.gf - sb.ga;
    if (gdb !== gda) return gdb - gda;
    if (sb.gf !== sa.gf) return sb.gf - sa.gf;
    return teams.indexOf(a) - teams.indexOf(b);
  });
}

// Build the official-results bracket. The admin enters group-stage stats; the
// app derives standings + the 8 best third-placed teams, then the admin marks
// the knockout winners. Saves to PUT /api/bracket/admin/results.
export default function AdminResultsBracket({ meta, initialResults, onSaved }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  const [groupStats, setGroupStats] = useState({});
  const [r32, setR32] = useState([]);
  const [r16, setR16] = useState([]);
  const [qf, setQf] = useState([]);
  const [sf, setSf] = useState([]);
  const [finalPicks, setFinalPicks] = useState(EMPTY_FINAL);

  // Seed from meta groups + any previously-saved results.
  useEffect(() => {
    if (!meta) return;
    const r = initialResults || {};
    const stats = {};
    for (const [gid, teams] of Object.entries(meta.groups || {})) {
      stats[gid] = {};
      for (const t of teams) {
        const saved = r.group_stats?.[gid]?.[t];
        stats[gid][t] = saved ? { pts: saved.pts || 0, gf: saved.gf || 0, ga: saved.ga || 0 } : { ...ZERO };
      }
    }
    setGroupStats(stats);
    setR32(r.r32_winners || []);
    setR16(r.r16_winners || []);
    setQf(r.qf_winners || []);
    setSf(r.sf_winners || []);
    setFinalPicks({
      champion: r.champion || "",
      runner_up: r.runner_up || "",
      third_place_winner: r.third_place_winner || "",
      final_score_home: r.final_score_home == null ? "" : r.final_score_home,
      final_score_away: r.final_score_away == null ? "" : r.final_score_away,
      top_scorer: r.top_scorer || "",
      mexico_to_quarters: r.mexico_to_quarters === true ? "true" : r.mexico_to_quarters === false ? "false" : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, initialResults]);

  const statOf = (gid, team) => groupStats[gid]?.[team] || ZERO;

  // Derived standings: each group ordered 1º→4º by the criteria.
  const groupPositions = useMemo(() => {
    const out = {};
    for (const [gid, teams] of Object.entries(meta?.groups || {})) {
      out[gid] = sortByCriteria(teams, (t) => statOf(gid, t));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, groupStats]);

  // The 12 third-placed teams ranked across groups by the same criteria.
  const thirdsRanking = useMemo(() => {
    const thirds = [];
    for (const [gid, ordered] of Object.entries(groupPositions)) {
      const team = ordered[2];
      if (team) {
        const s = statOf(gid, team);
        thirds.push({ team, gid, pts: s.pts, gd: s.gf - s.ga, gf: s.gf });
      }
    }
    thirds.sort((a, b) => (b.pts - a.pts) || (b.gd - a.gd) || (b.gf - a.gf) || a.gid.localeCompare(b.gid));
    return thirds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupPositions, groupStats]);

  const bestThirds = useMemo(() => thirdsRanking.slice(0, 8).map((t) => t.team), [thirdsRanking]);

  const r32Matchups = useMemo(
    () => buildR32Matchups(groupPositions, bestThirds),
    [groupPositions, bestThirds]
  );

  const getParts = (round, idx) => {
    if (round === "r32") return r32Matchups[idx] || [undefined, undefined];
    if (round === "r16") return [r32[idx * 2], r32[idx * 2 + 1]];
    if (round === "qf") return [r16[idx * 2], r16[idx * 2 + 1]];
    if (round === "sf") return [qf[idx * 2], qf[idx * 2 + 1]];
    return [sf[0], sf[1]];
  };
  const getLabels = (round, idx) => (round === "r32" ? R32_LABELS[idx] : null);
  const getWinner = (round, idx) => {
    if (round === "r32") return r32[idx];
    if (round === "r16") return r16[idx];
    if (round === "qf") return qf[idx];
    if (round === "sf") return sf[idx];
    return finalPicks.champion;
  };

  const sanitize = (n32, n16, nqf, nsf, nfp) => {
    const a32 = [...n32], a16 = [...n16], aqf = [...nqf], asf = [...nsf];
    for (let i = 0; i < 16; i++) { const o = r32Matchups[i] || []; if (a32[i] && !o.includes(a32[i])) a32[i] = undefined; }
    for (let i = 0; i < 8; i++) { const o = [a32[2 * i], a32[2 * i + 1]]; if (a16[i] && !o.includes(a16[i])) a16[i] = undefined; }
    for (let i = 0; i < 4; i++) { const o = [a16[2 * i], a16[2 * i + 1]]; if (aqf[i] && !o.includes(aqf[i])) aqf[i] = undefined; }
    for (let i = 0; i < 2; i++) { const o = [aqf[2 * i], aqf[2 * i + 1]]; if (asf[i] && !o.includes(asf[i])) asf[i] = undefined; }
    const fp = { ...nfp };
    const finalOpts = [asf[0], asf[1]];
    if (fp.champion && !finalOpts.includes(fp.champion)) { fp.champion = ""; fp.runner_up = ""; }
    else if (fp.champion) { fp.runner_up = finalOpts.find((t) => t && t !== fp.champion) || ""; }
    const sfLosers = aqf.filter((t) => t && !asf.includes(t));
    if (fp.third_place_winner && !sfLosers.includes(fp.third_place_winner)) fp.third_place_winner = "";
    return { a32, a16, aqf, asf, fp };
  };

  // Re-sanitize knockout picks whenever the standings/matchups change.
  useEffect(() => {
    const s = sanitize(r32, r16, qf, sf, finalPicks);
    const before = JSON.stringify([r32, r16, qf, sf, finalPicks]);
    const after = JSON.stringify([s.a32, s.a16, s.aqf, s.asf, s.fp]);
    if (before !== after) {
      setR32(s.a32); setR16(s.a16); setQf(s.aqf); setSf(s.asf); setFinalPicks(s.fp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r32Matchups]);

  const pickWinner = (round, idx, team) => {
    if (!team) return;
    let n32 = r32, n16 = r16, nqf = qf, nsf = sf, nfp = finalPicks;
    if (round === "r32") { n32 = [...r32]; n32[idx] = team; }
    else if (round === "r16") { n16 = [...r16]; n16[idx] = team; }
    else if (round === "qf") { nqf = [...qf]; nqf[idx] = team; }
    else if (round === "sf") { nsf = [...sf]; nsf[idx] = team; }
    else if (round === "final") {
      nfp = { ...finalPicks, champion: team, runner_up: [sf[0], sf[1]].find((t) => t && t !== team) || "" };
    }
    const s = sanitize(n32, n16, nqf, nsf, nfp);
    setR32(s.a32); setR16(s.a16); setQf(s.aqf); setSf(s.asf); setFinalPicks(s.fp);
  };

  const setStat = (gid, team, key, val) => {
    const n = Math.max(0, parseInt(val, 10) || 0);
    setGroupStats((s) => ({
      ...s,
      [gid]: { ...(s[gid] || {}), [team]: { ...(s[gid]?.[team] || ZERO), [key]: n } },
    }));
  };

  const resetAll = () => {
    const stats = {};
    for (const [gid, teams] of Object.entries(meta?.groups || {})) {
      stats[gid] = {};
      for (const t of teams) stats[gid][t] = { ...ZERO };
    }
    setGroupStats(stats);
    setR32([]); setR16([]); setQf([]); setSf([]);
    setFinalPicks(EMPTY_FINAL);
    toast.info("Estadísticas reiniciadas");
  };

  const save = async () => {
    setSaving(true);
    try {
      const otherSemis = qf.filter((t) => t && t !== finalPicks.champion && t !== finalPicks.runner_up);
      const payload = {
        champion: finalPicks.champion,
        runner_up: finalPicks.runner_up,
        semi_finalists: otherSemis,
        top_scorer: finalPicks.top_scorer,
        final_score_home: finalPicks.final_score_home === "" ? null : Number(finalPicks.final_score_home),
        final_score_away: finalPicks.final_score_away === "" ? null : Number(finalPicks.final_score_away),
        mexico_to_quarters: finalPicks.mexico_to_quarters === "" ? null : finalPicks.mexico_to_quarters === "true",
        group_positions: groupPositions,
        best_thirds: bestThirds,
        group_stats: groupStats,
        r32_winners: r32.filter(Boolean),
        r16_winners: r16.filter(Boolean),
        qf_winners: qf.filter(Boolean),
        sf_winners: sf.filter(Boolean),
        third_place_winner: finalPicks.third_place_winner,
      };
      await api.put("/bracket/admin/results", payload);
      toast.success("Resultados guardados — puntajes recalculados");
      if (onSaved) onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!meta) {
    return (
      <section className="mt-8 bg-white rounded-3xl border border-slate-200 p-6 flex items-center text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando bracket…
      </section>
    );
  }

  const step = STEPS[stepIdx];

  return (
    <section className="mt-8 bg-white rounded-3xl border border-slate-200 p-6" data-testid="admin-results-bracket">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h2 className="font-black text-xl text-slate-900 inline-flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" /> Resultados oficiales (bracket)
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={resetAll} data-testid="admin-bracket-reset" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 px-3 py-2 rounded-full border border-slate-200 hover:border-rose-200 transition">
            <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
          </button>
          <button onClick={save} disabled={saving} data-testid="admin-bracket-save" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-full px-5 py-2.5 transition active:scale-95 shadow-md">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Actualizar bracket
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Captura los <b>puntos y goles</b> de cada equipo en la fase de grupos: el sistema ordena cada grupo (1º→4º) y elige automáticamente a los <b>8 mejores terceros</b> (por puntos, diferencia de goles y goles a favor). Luego marca al ganador de cada partido de eliminatorias. Guarda cuando quieras.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {STEPS.map((s, i) => (
          <button key={s.id} onClick={() => setStepIdx(i)} data-testid={`admin-bracket-step-${s.id}`} className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${i === stepIdx ? "bg-amber-300 text-slate-900" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {i + 1}. {s.label}
          </button>
        ))}
      </div>

      {step.id === "groups" && <GroupStatsEditor meta={meta} groupPositions={groupPositions} statOf={statOf} setStat={setStat} />}
      {step.id === "thirds" && <ThirdsRanking ranking={thirdsRanking} />}
      {step.id === "bracket" && (
        <StepBracket getParts={getParts} getWinner={getWinner} getLabels={getLabels} pickWinner={pickWinner} finalPicks={finalPicks} setFinalPicks={setFinalPicks} qf={qf} sf={sf} pichi={meta?.pichichi_candidates || []} />
      )}

      <div className="mt-6 flex items-center justify-between gap-2">
        <button onClick={() => setStepIdx((i) => Math.max(0, i - 1))} disabled={stepIdx === 0} data-testid="admin-bracket-prev" className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white border-2 border-slate-200 text-slate-700 font-bold disabled:opacity-40 hover:border-orange-300 transition">
          <ChevronLeft className="w-4 h-4" /> Atrás
        </button>
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={saving} data-testid="admin-bracket-save-bottom" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-full px-6 py-2.5 transition active:scale-95 shadow-md">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Actualizar bracket
          </button>
          {stepIdx < STEPS.length - 1 && (
            <button onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))} data-testid="admin-bracket-next" className="inline-flex items-center gap-1 px-5 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold transition shadow-md">
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function StatInput({ value, onChange, testid }) {
  return (
    <input
      type="number"
      min="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testid}
      className="w-12 px-1 py-1 rounded-lg border border-slate-200 text-center text-sm font-bold focus:border-orange-400 focus:outline-none"
    />
  );
}

function GroupStatsEditor({ meta, groupPositions, statOf, setStat }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="group-stats-editor">
      {Object.keys(meta.groups || {}).map((gid) => {
        const ordered = groupPositions[gid] || [];
        return (
          <div key={gid} className="rounded-2xl border border-slate-200 p-3" data-testid={`group-stats-${gid}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-black text-slate-900 text-sm">Grupo {gid}</span>
              <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span className="w-12 text-center">PTS</span>
                <span className="w-12 text-center">GF</span>
                <span className="w-12 text-center">GC</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {ordered.map((team, pos) => {
                const s = statOf(gid, team);
                return (
                  <div key={team} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${pos < 2 ? "bg-emerald-50" : pos === 2 ? "bg-amber-50" : "bg-slate-50"}`}>
                    <span className={`w-5 h-5 shrink-0 rounded-full text-[11px] font-black flex items-center justify-center ${pos < 2 ? "bg-emerald-500 text-white" : pos === 2 ? "bg-amber-400 text-slate-900" : "bg-slate-300 text-slate-700"}`}>
                      {pos + 1}
                    </span>
                    <span className="flex-1 text-sm font-semibold text-slate-800 truncate" title={team}>{team}</span>
                    <StatInput value={s.pts} onChange={(v) => setStat(gid, team, "pts", v)} testid={`stat-${gid}-${team}-pts`} />
                    <StatInput value={s.gf} onChange={(v) => setStat(gid, team, "gf", v)} testid={`stat-${gid}-${team}-gf`} />
                    <StatInput value={s.ga} onChange={(v) => setStat(gid, team, "ga", v)} testid={`stat-${gid}-${team}-ga`} />
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-slate-400">🟢 Clasifican (1º y 2º) · 🟡 3º (posible mejor tercero)</p>
          </div>
        );
      })}
    </div>
  );
}

function ThirdsRanking({ ranking }) {
  return (
    <div data-testid="thirds-ranking">
      <p className="text-sm text-slate-500 mb-4">
        Ranking de los <b>12 terceros lugares</b> por puntos, diferencia de goles y goles a favor. Los <b>8 mejores clasifican</b> automáticamente y entran al bracket. Se calcula con lo que capturaste en la fase de grupos.
      </p>
      <div className="space-y-1.5">
        {ranking.length === 0 && <p className="text-slate-400 text-sm">Captura los puntos y goles en la fase de grupos para ver el ranking.</p>}
        {ranking.map((t, i) => {
          const qualifies = i < 8;
          return (
            <div key={t.team} className={`flex items-center gap-3 rounded-xl px-3 py-2 border ${qualifies ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`} data-testid={`third-rank-${i}`}>
              <span className={`w-7 h-7 shrink-0 rounded-full text-sm font-black flex items-center justify-center ${qualifies ? "bg-emerald-500 text-white" : "bg-slate-300 text-slate-600"}`}>{i + 1}</span>
              <span className="flex-1 font-bold text-slate-800">{t.team} <span className="text-slate-400 font-normal text-xs">(Grupo {t.gid})</span></span>
              <span className="text-xs text-slate-500 hidden sm:inline">{t.pts} pts · DG {t.gd >= 0 ? "+" : ""}{t.gd} · {t.gf} GF</span>
              {qualifies ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold"><CheckCircle2 className="w-4 h-4" /> Clasifica</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-bold"><XCircle className="w-4 h-4" /> Eliminado</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
