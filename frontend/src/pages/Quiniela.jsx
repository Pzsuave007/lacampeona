import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trophy, Flame, Loader2, Sparkles, Award, Lock, ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";
import { api, bannerUrl } from "../lib/api";
import { useLanguage } from "../contexts/LanguageContext";

const MODE_LABELS = {
  quick: { label: "Quick Pick", emoji: "⚡", desc: "5-7 predicciones · ~2 min · perfecto si no te quieres complicar" },
  pro: { label: "Pro Bracket", emoji: "🏆", desc: "Bracket COMPLETO paso a paso (grupos, octavos, cuartos, semis, final) + visual para compartir · ~10 min" },
};

const STORAGE_KEY = "lc_quiniela_token";

export default function Quiniela() {
  const { lang } = useLanguage();
  const [meta, setMeta] = useState(null);
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState({ total: 0 });
  const [mode, setMode] = useState("quick");
  const [step, setStep] = useState("intro"); // intro | form | done
  const [submitted, setSubmitted] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [form, setForm] = useState({
    name: "",
    city: "",
    email: "",
    whatsapp: "",
    accept_rules: false,
    picks_quick: {
      champion: "",
      runner_up: "",
      semi_final_3: "",
      semi_final_4: "",
      top_scorer: "",
      final_score_home: "",
      final_score_away: "",
      mexico_to_quarters: "",
      favorite_mx_player: "",
    },
    picks_pro: {
      group_winners: {},
      round_of_16: [],
      quarter_finalists: [],
      third_place: "",
    },
  });

  useEffect(() => {
    Promise.all([
      api.get("/bracket/meta"),
      api.get("/bracket/settings"),
      api.get("/bracket/leaderboard?limit=1"),
    ])
      .then(([m, s, l]) => {
        setMeta(m.data);
        setSettings(s.data);
        setStats({ total: l.data.total || 0 });
      })
      .catch(() => toast.error("No pudimos cargar la quiniela"))
      .finally(() => setLoading(false));
  }, []);

  const updateQuick = (k, v) =>
    setForm((f) => ({ ...f, picks_quick: { ...f.picks_quick, [k]: v } }));

  const updateProGroup = (gid, team) =>
    setForm((f) => ({
      ...f,
      picks_pro: {
        ...f.picks_pro,
        group_winners: { ...f.picks_pro.group_winners, [gid]: team },
      },
    }));

  const submit = async () => {
    if (!form.name || !form.city || !form.email) {
      toast.error("Completa nombre, ciudad y email");
      return;
    }
    if (!form.accept_rules) {
      toast.error("Acepta las reglas para participar");
      return;
    }
    const pq = form.picks_quick;
    if (!pq.champion || !pq.runner_up) {
      toast.error("Elige al menos el campeón y subcampeón");
      return;
    }
    try {
      const payload = {
        mode,
        name: form.name,
        city: form.city,
        email: form.email,
        whatsapp: form.whatsapp,
        accept_rules: true,
        picks_quick: {
          ...pq,
          final_score_home: pq.final_score_home === "" ? null : Number(pq.final_score_home),
          final_score_away: pq.final_score_away === "" ? null : Number(pq.final_score_away),
          mexico_to_quarters:
            pq.mexico_to_quarters === ""
              ? null
              : pq.mexico_to_quarters === "true" || pq.mexico_to_quarters === true,
        },
        picks_pro: mode === "pro" ? form.picks_pro : null,
      };
      const { data } = await api.post("/bracket/submit", payload);
      try { localStorage.setItem(STORAGE_KEY, data.edit_token); } catch { /* ignore */ }
      setSubmitted(data);
      setStep("done");
      toast.success("¡Quiniela enviada!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al enviar");
    }
  };

  const locked = settings?.contest_status && settings.contest_status !== "open";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando…
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen" data-testid="quiniela-page">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#3F0A0A] via-[#7F1D1D] to-[#991B1B] text-white">
        <div className="absolute -top-24 -left-20 w-[28rem] h-[28rem] rounded-full bg-rose-600/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-amber-200 text-xs font-extrabold uppercase tracking-[0.25em] mb-4">
            <Trophy className="w-3.5 h-3.5" /> Mundial 2026
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[1.05]" data-testid="quiniela-title">
            La Quiniela de La Campeona
          </h1>
          <p className="mt-4 text-white/85 max-w-2xl text-lg">
            Predice los resultados del Mundial y gana premios. La persona más cercana a la realidad se lleva el premio.
          </p>
          {settings?.prize_description && (
            <div className="mt-5 inline-flex items-center gap-2 bg-amber-400/20 border border-amber-300/40 rounded-2xl px-4 py-2" data-testid="quiniela-prize">
              <Award className="w-5 h-5 text-amber-200" />
              <span className="font-bold text-amber-50">{settings.prize_description}</span>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur rounded-full px-3 py-1.5">
              <Users className="w-4 h-4" />
              <strong className="font-black">{stats.total}</strong> participantes
            </span>
            <Link
              to="/quiniela/leaderboard"
              data-testid="quiniela-leaderboard-link"
              className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold rounded-full px-3 py-1.5 transition"
            >
              <Trophy className="w-4 h-4" /> Ver tabla de posiciones
            </Link>
          </div>
        </div>
      </header>

      {/* Sponsor strip */}
      {settings?.sponsor && (
        <div className="bg-white border-b border-slate-200" data-testid="quiniela-sponsor">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-4 flex-wrap">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-orange-600">Patrocinador</span>
            {settings.sponsor.banner_path && (
              <img
                src={/^https?:\/\//i.test(settings.sponsor.banner_path) ? settings.sponsor.banner_path : bannerUrl(settings.sponsor.banner_path)}
                alt={settings.sponsor.name}
                className="h-10 max-h-12 object-contain"
              />
            )}
            <span className="font-black text-slate-900">{settings.sponsor.name}</span>
            {settings.sponsor.tagline && (
              <span className="text-sm text-slate-500">— {settings.sponsor.tagline}</span>
            )}
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {locked && step !== "done" ? (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-8 text-center">
            <Lock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-2xl font-black text-slate-900">La quiniela ya está cerrada</h2>
            <p className="text-slate-600 mt-2">
              {settings.contest_status === "closed"
                ? "El Mundial terminó. ¡Gracias por participar!"
                : "El Mundial ya empezó. No se aceptan más predicciones."}
            </p>
            <Link
              to="/quiniela/leaderboard"
              className="mt-6 inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full px-6 py-3 transition"
            >
              <Trophy className="w-5 h-5" /> Ver tabla de posiciones
            </Link>
          </div>
        ) : step === "intro" ? (
          <ModePicker mode={mode} setMode={setMode} onStart={() => setStep("form")} />
        ) : step === "form" ? (
          <QuinielaForm
            mode={mode}
            meta={meta}
            form={form}
            setForm={setForm}
            updateQuick={updateQuick}
            updateProGroup={updateProGroup}
            onBack={() => setStep("intro")}
            onSubmit={submit}
          />
        ) : (
          <DoneScreen submitted={submitted} setStep={setStep} />
        )}
      </main>
    </div>
  );
}

function ModePicker({ mode, setMode, onStart }) {
  const navigate = useNavigate();
  return (
    <div data-testid="quiniela-mode-picker">
      <h2 className="text-2xl font-black text-slate-900 mb-2">Elige cómo quieres jugar</h2>
      <p className="text-slate-600 mb-6">Puedes hacer una versión rápida o predicciones más completas.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(["quick", "pro"]).map((k) => (
          <button
            key={k}
            type="button"
            data-testid={`quiniela-mode-${k}`}
            onClick={() => setMode(k)}
            className={`text-left p-6 rounded-3xl border-2 transition ${
              mode === k
                ? "border-orange-500 bg-orange-50 shadow-md"
                : "border-slate-200 bg-white hover:border-orange-300"
            }`}
          >
            <div className="text-4xl">{MODE_LABELS[k].emoji}</div>
            <div className="mt-2 font-black text-slate-900 text-xl">{MODE_LABELS[k].label}</div>
            <p className="text-sm text-slate-600 mt-1">{MODE_LABELS[k].desc}</p>
            <div className="mt-3 text-xs font-bold text-orange-600">
              {k === "quick" ? "Hasta 100 puntos" : "Hasta 250+ puntos · visual para compartir"}
            </div>
          </button>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <button
          onClick={() => mode === "pro" ? navigate("/quiniela/bracket") : onStart()}
          data-testid="quiniela-start"
          className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full px-6 py-3 transition active:scale-95 shadow-md"
        >
          Empezar quiniela <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function QuinielaForm({ mode, meta, form, setForm, updateQuick, updateProGroup, onBack, onSubmit }) {
  const teams = meta?.teams || [];
  const pichi = meta?.pichichi_candidates || [];
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pq = form.picks_quick;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8" data-testid="quiniela-form">
      <button onClick={onBack} className="text-sm font-bold text-slate-500 hover:text-orange-600 mb-4">
        ← Cambiar modo
      </button>
      <div className="flex items-center gap-2 mb-6">
        <span className="text-3xl">{MODE_LABELS[mode].emoji}</span>
        <h2 className="text-2xl font-black text-slate-900">{MODE_LABELS[mode].label}</h2>
      </div>

      {/* Personal info */}
      <Section title="Tus datos" icon={<Sparkles className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field testid="q-name" label="Nombre completo *" value={form.name} onChange={(v) => set("name", v)} />
          <Field testid="q-city" label="Ciudad *" value={form.city} onChange={(v) => set("city", v)} placeholder="Dallas, OR" />
          <Field testid="q-email" type="email" label="Email *" value={form.email} onChange={(v) => set("email", v)} placeholder="tu@email.com" />
          <Field testid="q-whatsapp" label="WhatsApp (opcional)" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} placeholder="15035551234" />
        </div>
      </Section>

      {/* Quick picks */}
      <Section title="🏆 Predicciones principales" icon={<Trophy className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select testid="q-champion" label="🥇 Campeón del Mundial (25 pts)" value={pq.champion} onChange={(v) => updateQuick("champion", v)} options={teams} required />
          <Select testid="q-runner-up" label="🥈 Subcampeón (15 pts)" value={pq.runner_up} onChange={(v) => updateQuick("runner_up", v)} options={teams} required />
          <Select testid="q-semi-3" label="🥉 Otra semifinalista #1 (10 pts)" value={pq.semi_final_3} onChange={(v) => updateQuick("semi_final_3", v)} options={teams} />
          <Select testid="q-semi-4" label="🥉 Otra semifinalista #2 (10 pts)" value={pq.semi_final_4} onChange={(v) => updateQuick("semi_final_4", v)} options={teams} />
          <Select testid="q-pichichi" label="⚽ Goleador del torneo (15 pts)" value={pq.top_scorer} onChange={(v) => updateQuick("top_scorer", v)} options={pichi} wide />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600">📊 Marcador exacto de la final (20 pts si exacto · 5 pts si solo aciertas ganador)</label>
            <div className="flex items-center gap-2 mt-1">
              <input data-testid="q-final-home" type="number" min="0" max="20" value={pq.final_score_home} onChange={(e) => updateQuick("final_score_home", e.target.value)} placeholder="2" className="w-20 px-3 py-2 rounded-xl border-2 border-slate-200 text-center text-2xl font-black" />
              <span className="text-slate-400 font-black text-2xl">-</span>
              <input data-testid="q-final-away" type="number" min="0" max="20" value={pq.final_score_away} onChange={(e) => updateQuick("final_score_away", e.target.value)} placeholder="1" className="w-20 px-3 py-2 rounded-xl border-2 border-slate-200 text-center text-2xl font-black" />
              <span className="text-xs text-slate-500 ml-2">{pq.champion} vs {pq.runner_up}</span>
            </div>
          </div>
          <Select testid="q-mexico-qf" label="🇲🇽 ¿México llega a cuartos? (5 pts)" value={pq.mexico_to_quarters} onChange={(v) => updateQuick("mexico_to_quarters", v)} options={[{ value: "true", label: "Sí" }, { value: "false", label: "No" }]} optionLabel="label" optionValue="value" />
        </div>
        <Field testid="q-fav-mx" label="🎯 Tu jugador favorito de la Selección Mexicana (solo por gusto)" value={pq.favorite_mx_player} onChange={(v) => updateQuick("favorite_mx_player", v)} placeholder="Santi Giménez, Edson Álvarez…" wide />
      </Section>

      {/* Pro extras */}
      {mode === "pro" && (
        <Section title="🏟️ Ganadores de grupo (+1 pt cada uno · 12 grupos)" icon={<Flame className="w-4 h-4" />}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {(meta?.group_ids || []).map((gid) => (
              <Select
                key={gid}
                testid={`q-group-${gid}`}
                label={`Grupo ${gid}`}
                value={form.picks_pro.group_winners[gid] || ""}
                onChange={(v) => updateProGroup(gid, v)}
                options={teams}
                small
              />
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">Tip: Octavos y cuartos los puedes detallar después al editar tu quiniela.</p>
        </Section>
      )}

      {/* Rules */}
      <div className="mt-6 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
        <label className="flex items-start gap-2 cursor-pointer" data-testid="q-accept-rules-wrap">
          <input
            type="checkbox"
            data-testid="q-accept-rules"
            checked={form.accept_rules}
            onChange={(e) => set("accept_rules", e.target.checked)}
            className="mt-1 w-4 h-4 accent-orange-600"
          />
          <span className="text-sm text-slate-700">
            Acepto las reglas: <strong>una participación por persona</strong> (si envío de nuevo se actualiza la anterior con el mismo email). El ganador será el que más puntos sume al final del Mundial 2026. La Campeona 880 AM puede contactarme por email o WhatsApp para informar el resultado.
          </span>
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          data-testid="quiniela-submit"
          onClick={onSubmit}
          className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-full px-8 py-3 transition active:scale-95 shadow-lg"
        >
          ¡Enviar mi quiniela! 🏆
        </button>
      </div>
    </div>
  );
}

function DoneScreen({ submitted, setStep }) {
  return (
    <div className="bg-white rounded-3xl border border-green-200 p-8 text-center" data-testid="quiniela-done">
      <div className="w-16 h-16 mx-auto bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
        <Trophy className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-black text-slate-900">¡Quiniela registrada!</h2>
      <p className="text-slate-600 mt-2">
        Te avisaremos por email o WhatsApp si quedas entre los ganadores. Mientras tanto, sigue las posiciones en vivo.
      </p>
      <div className="mt-2 text-xs text-slate-500">
        Tu puntaje inicial: <strong className="font-black text-slate-900">{submitted?.score ?? 0}</strong> pts (sube conforme el admin marque resultados oficiales).
      </div>
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <Link to="/quiniela/leaderboard" data-testid="quiniela-done-leaderboard" className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full px-6 py-3 transition">
          <Trophy className="w-5 h-5" /> Ver tabla
        </Link>
        <button onClick={() => setStep("intro")} className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full px-6 py-3 transition">
          Volver al inicio
        </button>
      </div>
    </div>
  );
}

// ---------- small UI primitives ----------
function Section({ title, icon, children }) {
  return (
    <div className="mt-6">
      <h3 className="font-black text-lg text-slate-900 inline-flex items-center gap-2 mb-3">
        {icon}<span>{title}</span>
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", wide, testid }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600">{label}</label>
      <input
        data-testid={testid}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-orange-400 focus:outline-none"
      />
    </div>
  );
}

function Select({ label, value, onChange, options, required, optionLabel, optionValue, small, wide, testid }) {
  // options can be: ["A","B"] OR [{label, value}]
  const norm = useMemo(() =>
    options.map((o) => (typeof o === "string" ? { label: o, value: o } : { label: o[optionLabel || "label"], value: o[optionValue || "value"] }))
  , [options, optionLabel, optionValue]);
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <label className={`font-bold uppercase tracking-[0.15em] text-slate-600 ${small ? "text-[10px]" : "text-xs"}`}>{label}</label>
      <select
        data-testid={testid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-orange-400 focus:outline-none bg-white"
      >
        <option value="">{required ? "— Selecciona —" : "— Opcional —"}</option>
        {norm.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
