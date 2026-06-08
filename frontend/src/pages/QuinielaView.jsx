import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Trophy, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import BracketExportCard from "../components/BracketExportCard";

const CARD_W = 1260;

/** Renders the full bracket card scaled down to fit its container width, so the
 *  ENTIRE bracket is always visible (no horizontal scroll / iframe box). */
function ResponsiveBracket(props) {
  const wrapRef = useRef(null);
  const cardRef = useRef(null);
  const [dims, setDims] = useState({ scale: 1, height: undefined });
  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current, card = cardRef.current;
      if (!wrap || !card) return;
      const scale = Math.min(1, wrap.clientWidth / CARD_W);
      setDims({ scale, height: card.offsetHeight * scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    const t = setTimeout(measure, 600); // re-measure after images/fonts load
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); clearTimeout(t); window.removeEventListener("resize", measure); };
  }, []);
  return (
    <div ref={wrapRef} style={{ width: "100%", height: dims.height, overflow: "hidden" }}>
      <div ref={cardRef} style={{ width: CARD_W, transform: `scale(${dims.scale})`, transformOrigin: "top left" }}>
        <BracketExportCard {...props} />
      </div>
    </div>
  );
}

/**
 * Public read-only view of a participant's bracket — for social media sharing.
 */
export default function QuinielaView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.get(`/bracket/view/${id}`)
      .then(({ data }) => setData(data))
      .catch(() => setErr("Bracket no encontrado"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando…</div>;
  if (err) return (
    <div className="min-h-screen flex items-center justify-center text-slate-600 px-6 text-center">
      <div>
        <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="font-black text-xl">{err}</p>
        <Link to="/quiniela" className="mt-4 inline-flex bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full px-5 py-2.5 transition">Hacer tu bracket</Link>
      </div>
    </div>
  );

  const pp = data.picks_pro || {};
  const pq = data.picks_quick || {};
  const finalPicks = {
    champion: pq.champion,
    runner_up: pq.runner_up,
    final_score_home: pq.final_score_home ?? "",
    final_score_away: pq.final_score_away ?? "",
    third_place_winner: pp.third_place_winner || "",
  };
  // Show the full Octavos→Final tree when the bracket has the knockout picks.
  const hasFullTree =
    Array.isArray(pp.r32_winners) && pp.r32_winners.filter(Boolean).length >= 8 &&
    Array.isArray(pp.qf_winners) && pp.qf_winners.filter(Boolean).length >= 2;

  return (
    <div className="bg-slate-50 min-h-screen" data-testid="bracket-view-page">
      <header className="bg-gradient-to-br from-[#3F0A0A] via-[#7F1D1D] to-[#991B1B] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link to="/quiniela" className="inline-flex items-center gap-1.5 text-amber-200 hover:text-white text-sm font-bold mb-3">
            <ArrowLeft className="w-4 h-4" /> Hacer mi propio bracket
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black inline-flex items-center gap-2">
            <Trophy className="w-8 h-8 text-amber-300" /> Bracket de {data.name}
          </h1>
          <p className="text-white/80 mt-1">{data.city} · Puntaje actual: <strong className="text-amber-200">{data.score} pts</strong></p>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Full bracket of 16 (Octavos → Final) — scaled so the WHOLE tree shows */}
        {hasFullTree && (
          <div className="max-w-[1260px] mx-auto mb-8 rounded-3xl overflow-hidden shadow-xl" data-testid="bracket-view-tree">
            <ResponsiveBracket
              info={{ name: data.name, city: data.city }}
              r32={pp.r32_winners || []}
              r16={pp.r16_winners || []}
              qf={pp.qf_winners || []}
              sf={pp.sf_winners || []}
              finalPicks={finalPicks}
            />
          </div>
        )}

        {/* Summary card */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-3xl border-2 border-amber-200 overflow-hidden shadow-md">
            <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white text-center py-5 px-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.3em] opacity-90">El bracket de</p>
              <h3 className="text-3xl font-black">{data.name}</h3>
              <p className="text-sm opacity-90">{data.city}</p>
            </div>
            <div className="p-6">
              <div className="text-center mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-600">🏆 Campeón</p>
                <p className="text-3xl sm:text-4xl font-black text-slate-900 mt-1">{pq.champion || "?"}</p>
                <p className="text-sm text-slate-500 mt-1">
                  {pq.champion} {pq.final_score_home ?? "?"}-{pq.final_score_away ?? "?"} {pq.runner_up}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">🥈 Subcampeón</p>
                  <p className="font-black text-slate-900 mt-1">{pq.runner_up || "?"}</p>
                </div>
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">🥉 3er lugar</p>
                  <p className="font-black text-slate-900 mt-1">{pp.third_place_winner || "?"}</p>
                </div>
              </div>
              {pp.qf_winners && pp.qf_winners.filter(Boolean).length > 0 && (
                <>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mt-4 mb-2">Semifinalistas</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {pp.qf_winners.filter(Boolean).slice(0, 4).map((t) => (
                      <div key={t} className="bg-emerald-50 border border-emerald-200 rounded-xl px-2 py-1.5 text-sm font-bold text-emerald-800 text-center">{t}</div>
                    ))}
                  </div>
                </>
              )}
              {pq.top_scorer && (
                <div className="mt-5 inline-flex items-center gap-2 bg-amber-100 text-amber-800 rounded-full px-3 py-1.5 text-sm">
                  <Sparkles className="w-4 h-4" /> Pichichi: <strong>{pq.top_scorer}</strong>
                </div>
              )}
            </div>
            <div className="bg-slate-900 text-white text-center py-3 text-xs font-bold uppercase tracking-[0.3em]">
              Quiniela del Mundial 2026 · La Campeona 880 AM
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to="/quiniela/bracket" className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full px-6 py-3 transition shadow-md">
            <Trophy className="w-5 h-5" /> ¡Hacer mi propio bracket!
          </Link>
        </div>
      </main>
    </div>
  );
}
