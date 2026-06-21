import React, { useEffect, useMemo, useState } from "react";
import { Save, Loader2, Trophy, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import {
  StepGroups,
  StepThirds,
  StepBracket,
  buildR32Matchups,
  R32_LABELS,
  EMPTY_FINAL,
} from "./QuinielaBracket";

const STEPS = [
  { id: "groups", label: "Grupos (1º/2º/3º)" },
  { id: "thirds", label: "Mejores 3os" },
  { id: "bracket", label: "Eliminatorias" },
];

// Build the official-results bracket visually (admin marks the REAL winners).
// Saves to PUT /api/bracket/admin/results which recalculates everyone's score.
export default function AdminResultsBracket({ meta, initialResults, onSaved }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  const [groupPositions, setGroupPositions] = useState({});
  const [bestThirds, setBestThirds] = useState([]);
  const [r32, setR32] = useState([]);
  const [r16, setR16] = useState([]);
  const [qf, setQf] = useState([]);
  const [sf, setSf] = useState([]);
  const [finalPicks, setFinalPicks] = useState(EMPTY_FINAL);

  // Seed state from meta (official groups) + any previously-saved results.
  useEffect(() => {
    if (!meta) return;
    const r = initialResults || {};
    const defaultGroups = {};
    for (const [gid, teams] of Object.entries(meta.groups || {})) defaultGroups[gid] = [...teams];
    const gp = r.group_positions && Object.keys(r.group_positions).length ? r.group_positions : defaultGroups;
    setGroupPositions(gp);
    setBestThirds(r.best_thirds || []);
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

  const r32Matchups = useMemo(
    () => buildR32Matchups(groupPositions, bestThirds),
    [groupPositions, bestThirds]
  );

  const thirdPlaceTeams = useMemo(() => {
    const out = [];
    for (const teams of Object.values(groupPositions)) {
      if (teams && teams[2]) out.push(teams[2]);
    }
    return out;
  }, [groupPositions]);

  const moveTeam = (gid, idx, dir) => {
    const teams = [...(groupPositions[gid] || [])];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= teams.length) return;
    [teams[idx], teams[swapIdx]] = [teams[swapIdx], teams[idx]];
    const next = { ...groupPositions, [gid]: teams };
    setGroupPositions(next);
    const validThirds = new Set(Object.values(next).map((t) => t && t[2]).filter(Boolean));
    setBestThirds((arr) => arr.filter((t) => validThirds.has(t)));
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

  const resetGroups = () => {
    const init = {};
    for (const [gid, teams] of Object.entries(meta?.groups || {})) init[gid] = [...teams];
    setGroupPositions(init);
    setBestThirds([]);
    setR32([]); setR16([]); setQf([]); setSf([]);
    setFinalPicks(EMPTY_FINAL);
    toast.info("Bracket reiniciado al sorteo oficial");
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
          <button
            onClick={resetGroups}
            data-testid="admin-bracket-reset"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 px-3 py-2 rounded-full border border-slate-200 hover:border-rose-200 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
          </button>
          <button
            onClick={save}
            disabled={saving}
            data-testid="admin-bracket-save"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-full px-5 py-2.5 transition active:scale-95 shadow-md"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar y recalcular
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Marca los resultados REALES conforme avanza el Mundial: ordena cada grupo (1º arriba), elige los 8 mejores terceros que avanzaron, y toca al equipo ganador en cada partido. Puedes guardar en cualquier momento — los puntajes se recalculan al instante.
      </p>

      {/* Step tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStepIdx(i)}
            data-testid={`admin-bracket-step-${s.id}`}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
              i === stepIdx ? "bg-amber-300 text-slate-900" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>

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

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          disabled={stepIdx === 0}
          data-testid="admin-bracket-prev"
          className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white border-2 border-slate-200 text-slate-700 font-bold disabled:opacity-40 hover:border-orange-300 transition"
        >
          <ChevronLeft className="w-4 h-4" /> Atrás
        </button>
        {stepIdx < STEPS.length - 1 ? (
          <button
            onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
            data-testid="admin-bracket-next"
            className="inline-flex items-center gap-1 px-6 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold transition shadow-md"
          >
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={save}
            disabled={saving}
            data-testid="admin-bracket-save-bottom"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-full px-6 py-2.5 transition active:scale-95 shadow-md"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar y recalcular
          </button>
        )}
      </div>
    </section>
  );
}
