import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Trophy, Loader2, Lock, Unlock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

const STATUS_LABELS = {
  open: "🟢 Abierta (acepta predicciones)",
  locked: "🔒 Cerrada (el Mundial ya empezó)",
  closed: "🏁 Terminada (premio entregado)",
};

export default function AdminBracket() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState(emptyResults());
  const [settings, setSettings] = useState({
    prize_description: "",
    sponsor_advertiser_id: "",
    sponsor_name: "",
    contest_status: "open",
  });
  const [advertisers, setAdvertisers] = useState([]);
  const [predictions, setPredictions] = useState([]);

  useEffect(() => {
    if (user === null) navigate("/login");
  }, [user, navigate]);

  useEffect(() => {
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) return;
    Promise.all([
      api.get("/bracket/admin/results"),
      api.get("/bracket/settings"),
      api.get("/advertisers"),
      api.get("/bracket/admin/predictions"),
    ])
      .then(([r, s, a, p]) => {
        setResults({ ...emptyResults(), ...(r.data || {}) });
        setSettings({ ...settings, ...(s.data || {}) });
        setAdvertisers(a.data || []);
        setPredictions(p.data || []);
      })
      .catch(() => toast.error("Error al cargar"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put("/bracket/admin/settings", settings);
      toast.success("Configuración guardada");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    } finally {
      setSaving(false);
    }
  };

  const saveResults = async () => {
    setSaving(true);
    try {
      const payload = {
        ...results,
        final_score_home: results.final_score_home === "" ? null : Number(results.final_score_home),
        final_score_away: results.final_score_away === "" ? null : Number(results.final_score_away),
        mexico_to_quarters: results.mexico_to_quarters === "" ? null : results.mexico_to_quarters === "true" || results.mexico_to_quarters === true,
        semi_finalists: (results.semi_finalists || []).filter(Boolean),
      };
      await api.put("/bracket/admin/results", payload);
      toast.success("Resultados guardados — puntajes recalculados");
      // Reload predictions to see new scores
      const p = await api.get("/bracket/admin/predictions");
      setPredictions(p.data || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    } finally {
      setSaving(false);
    }
  };

  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    return <div className="min-h-screen p-10 text-slate-500">Sin acceso</div>;
  }
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando…</div>;
  }

  const setR = (k, v) => setResults((r) => ({ ...r, [k]: v }));
  const setS = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="admin-bracket-page">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-orange-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver al admin
      </Link>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-extrabold uppercase tracking-[0.2em] mb-2">
        <Trophy className="w-3.5 h-3.5" /> Quiniela del Mundial 2026
      </div>
      <h1 className="text-3xl sm:text-4xl font-black text-slate-900">Administrar la Quiniela</h1>
      <p className="text-slate-500 mt-1">
        {predictions.length} participantes registrados · actualiza los resultados oficiales y se recalcularán automáticamente.
      </p>

      {/* Settings */}
      <section className="mt-8 bg-white rounded-3xl border border-slate-200 p-6">
        <h2 className="font-black text-xl text-slate-900 inline-flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-orange-500" /> Configuración del concurso
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600">Descripción del premio</label>
            <input data-testid="admin-prize" value={settings.prize_description} onChange={(e) => setS("prize_description", e.target.value)} placeholder="$200 en mercancía de Carnicería X" className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600">Patrocinador (anunciante)</label>
            <select data-testid="admin-sponsor" value={settings.sponsor_advertiser_id} onChange={(e) => setS("sponsor_advertiser_id", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 bg-white">
              <option value="">— Sin patrocinador —</option>
              {advertisers.map((a) => <option key={a.id || a.name} value={a.id || ""}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600">Estado del concurso</label>
            <select data-testid="admin-status" value={settings.contest_status} onChange={(e) => setS("contest_status", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 bg-white">
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={saveSettings} disabled={saving} data-testid="admin-save-settings" className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold rounded-full px-5 py-2.5 transition active:scale-95">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar config
          </button>
        </div>
      </section>

      {/* Official Results */}
      <section className="mt-8 bg-white rounded-3xl border border-slate-200 p-6">
        <h2 className="font-black text-xl text-slate-900 inline-flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-amber-500" /> Resultados oficiales
        </h2>
        <p className="text-sm text-slate-500 mb-5">Conforme se vayan jugando los partidos, actualiza estos campos. Al guardar, todos los puntajes se recalculan en automático.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Text testid="admin-r-champion" label="🥇 Campeón" value={results.champion} onChange={(v) => setR("champion", v)} />
          <Text testid="admin-r-runner" label="🥈 Subcampeón" value={results.runner_up} onChange={(v) => setR("runner_up", v)} />
          <Text testid="admin-r-semi1" label="🥉 Semifinalista #1 (no campeón ni subcampeón)" value={results.semi_finalists[0] || ""} onChange={(v) => setR("semi_finalists", [v, results.semi_finalists[1] || ""])} />
          <Text testid="admin-r-semi2" label="🥉 Semifinalista #2" value={results.semi_finalists[1] || ""} onChange={(v) => setR("semi_finalists", [results.semi_finalists[0] || "", v])} />
          <Text testid="admin-r-pichichi" label="⚽ Goleador del torneo" value={results.top_scorer} onChange={(v) => setR("top_scorer", v)} wide />
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600">📊 Marcador final</label>
            <div className="flex items-center gap-2 mt-1">
              <input data-testid="admin-r-fh" type="number" value={results.final_score_home} onChange={(e) => setR("final_score_home", e.target.value)} className="w-20 px-3 py-2 rounded-xl border-2 border-slate-200 text-center text-2xl font-black" />
              <span className="font-black text-2xl text-slate-400">-</span>
              <input data-testid="admin-r-fa" type="number" value={results.final_score_away} onChange={(e) => setR("final_score_away", e.target.value)} className="w-20 px-3 py-2 rounded-xl border-2 border-slate-200 text-center text-2xl font-black" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600">🇲🇽 ¿México pasó a cuartos?</label>
            <select data-testid="admin-r-mxqf" value={results.mexico_to_quarters === null || results.mexico_to_quarters === undefined ? "" : String(results.mexico_to_quarters)} onChange={(e) => setR("mexico_to_quarters", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 bg-white">
              <option value="">— No definido —</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={saveResults} disabled={saving} data-testid="admin-save-results" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-full px-5 py-2.5 transition active:scale-95 shadow-md">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar y recalcular
          </button>
        </div>
      </section>

      {/* Participants table */}
      <section className="mt-8 bg-white rounded-3xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-black text-xl text-slate-900">Participantes ({predictions.length})</h2>
        </div>
        {predictions.length === 0 ? (
          <p className="px-6 py-8 text-center text-slate-500">Sin participantes todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="admin-participants-table">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2 font-extrabold uppercase tracking-wider text-xs text-slate-600">#</th>
                  <th className="text-left px-4 py-2 font-extrabold uppercase tracking-wider text-xs text-slate-600">Nombre</th>
                  <th className="text-left px-4 py-2 font-extrabold uppercase tracking-wider text-xs text-slate-600">Email</th>
                  <th className="text-left px-4 py-2 font-extrabold uppercase tracking-wider text-xs text-slate-600">WhatsApp</th>
                  <th className="text-left px-4 py-2 font-extrabold uppercase tracking-wider text-xs text-slate-600">Modo</th>
                  <th className="text-right px-4 py-2 font-extrabold uppercase tracking-wider text-xs text-slate-600">Pts</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((p, i) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-4 py-2 font-bold text-slate-500">{i + 1}</td>
                    <td className="px-4 py-2 font-bold text-slate-900">{p.name} <span className="text-slate-400 font-normal text-xs">· {p.city}</span></td>
                    <td className="px-4 py-2 text-slate-600">{p.email}</td>
                    <td className="px-4 py-2 text-slate-600 font-mono text-xs">{p.whatsapp || "—"}</td>
                    <td className="px-4 py-2">{p.mode === "pro" ? "🏆 Pro" : "⚡ Quick"}</td>
                    <td className="px-4 py-2 text-right font-black text-orange-600">{p.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function emptyResults() {
  return {
    champion: "",
    runner_up: "",
    semi_finalists: ["", ""],
    top_scorer: "",
    final_score_home: "",
    final_score_away: "",
    mexico_to_quarters: "",
  };
}

function Text({ label, value, onChange, wide, testid }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600">{label}</label>
      <input data-testid={testid} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-orange-400 focus:outline-none" />
    </div>
  );
}
