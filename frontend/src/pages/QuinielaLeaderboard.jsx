import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Crown, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { api } from "../lib/api";

export default function QuinielaLeaderboard() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/bracket/leaderboard?limit=100"), api.get("/bracket/settings")])
      .then(([l, s]) => {
        setRows(l.data.rows || []);
        setTotal(l.data.total || 0);
        setSettings(s.data || null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-slate-50 min-h-screen" data-testid="quiniela-leaderboard-page">
      <header className="relative overflow-hidden bg-gradient-to-br from-[#3F0A0A] via-[#7F1D1D] to-[#991B1B] text-white">
        <div className="absolute -top-24 -left-20 w-[28rem] h-[28rem] rounded-full bg-rose-600/30 blur-3xl pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-10">
          <Link to="/quiniela" className="inline-flex items-center gap-1.5 text-amber-200 hover:text-white text-sm font-bold mb-4">
            <ArrowLeft className="w-4 h-4" /> Volver a la quiniela
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-amber-200 text-xs font-extrabold uppercase tracking-[0.25em] mb-4">
            <Trophy className="w-3.5 h-3.5" /> Tabla de posiciones
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter">
            ¿Quién va al frente?
          </h1>
          <p className="mt-3 text-white/80">
            <strong className="text-amber-200">{total}</strong> personas participando · puntajes se actualizan cuando el admin marca resultados oficiales.
          </p>
          {settings?.prize_description && (
            <p className="mt-2 text-sm text-amber-100 inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Premio: {settings.prize_description}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {loading ? (
          <div className="text-slate-500 text-center py-20">
            <Loader2 className="w-6 h-6 animate-spin mr-2 inline" /> Cargando…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-orange-200" data-testid="leaderboard-empty">
            <Trophy className="w-12 h-12 text-orange-300 mx-auto mb-3" />
            <h3 className="text-xl font-black text-slate-900">Aún no hay participantes</h3>
            <p className="text-slate-500 mt-1">Sé el primero en llenar tu quiniela.</p>
            <Link to="/quiniela" className="mt-5 inline-flex bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full px-6 py-2.5 transition">
              Hacer mi quiniela
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <table className="w-full" data-testid="leaderboard-table">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-600">#</th>
                  <th className="text-left px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-600">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-600 hidden sm:table-cell">Ciudad</th>
                  <th className="text-left px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-600 hidden sm:table-cell">Modo</th>
                  <th className="text-right px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-600">Pts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} data-testid={`leaderboard-row-${i + 1}`} className={`border-b border-slate-100 ${i === 0 ? "bg-gradient-to-r from-amber-50 to-yellow-50" : ""}`}>
                    <td className="px-4 py-3 font-black text-slate-700">
                      {i === 0 ? <Crown className="w-5 h-5 text-amber-500 inline" /> : `#${i + 1}`}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{r.name}</td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{r.city}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-[10px] font-extrabold uppercase rounded-full px-2 py-0.5 ${r.mode === "pro" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}>
                        {r.mode === "pro" ? "🏆 Pro" : "⚡ Quick"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-orange-600 text-lg">{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
