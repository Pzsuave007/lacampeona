import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Plus, Trash2, Copy, Pencil, Calendar as CalendarIcon, Save, X, Loader2, ListChecks, Wand2, ChevronLeft, ChevronRight, Lightbulb, RefreshCw, Newspaper, Search, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { api, bannerUrl } from "../lib/api";

const PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "tiktok", label: "TikTok" },
  { key: "twitter", label: "X / Twitter" },
];

const STATUS_LABEL = {
  draft: "Borrador",
  scheduled: "Programado",
  published: "Publicado",
};

const STATUS_COLOR = {
  draft: "bg-slate-200 text-slate-700",
  scheduled: "bg-amber-100 text-amber-800",
  published: "bg-emerald-100 text-emerald-800",
};

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DjStudio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // list | calendar

  useEffect(() => {
    if (user === null) navigate("/login");
  }, [user, navigate]);

  const loadAll = async () => {
    try {
      const [m, t, d] = await Promise.all([
        api.get("/dj/me"),
        api.get("/dj/templates"),
        api.get("/dj/drafts"),
      ]);
      setMe(m.data);
      setTemplates(t.data);
      setDrafts(d.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error cargando estudio");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (user.role === "dj" || user.role === "admin" || user.role === "super_admin")) loadAll();
  }, [user]);

  if (!user || (user.role !== "dj" && user.role !== "admin" && user.role !== "super_admin")) {
    return <div className="min-h-screen p-10 text-slate-500">…</div>;
  }

  const onDelete = async (id) => {
    if (!confirm("¿Eliminar borrador?")) return;
    await api.delete(`/dj/drafts/${id}`);
    toast.success("Borrador eliminado");
    loadAll();
  };

  const onCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const onGenerateImage = async (draft, style = "illustration") => {
    try {
      toast.info(style === "realistic" ? "Generando imagen realista..." : "Generando ilustración...");
      const { data } = await api.post("/dj/generate-image", {
        draft_id: draft.id,
        aspect: "wide",
        style,
      });
      // Optimistically update the draft in local state so the new image
      // shows up immediately without waiting for another network round-trip.
      if (data?.path) {
        setDrafts((prev) =>
          prev.map((d) =>
            d.id === draft.id ? { ...d, cover_image: data.path } : d,
          ),
        );
      }
      toast.success("✨ Imagen generada");
      // Refetch in the background to sync any other fields (updated_at, etc.).
      loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al generar imagen");
    }
  };

  const onSetStatus = async (draft, status) => {
    await api.patch(`/dj/drafts/${draft.id}`, { status });
    loadAll();
  };

  return (
    <div data-testid="dj-studio" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-extrabold uppercase tracking-[0.2em] mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Content Studio
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight" data-testid="dj-studio-title">
            Hola{me?.host?.show_name ? `, ${me.host.show_name}` : me?.name ? `, ${me.name}` : ""} 👋
          </h1>
          <p className="text-slate-500 mt-1">Contenido pensado para tu audiencia: mujeres 40+, regional mexicano y romántico clásico. Sin reggaetón moderno.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="dj-view-list-btn"
            onClick={() => setView("list")}
            className={`px-4 py-2 rounded-full text-sm font-bold transition ${view === "list" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
          >
            <ListChecks className="w-4 h-4 inline mr-1" /> Lista
          </button>
          <button
            data-testid="dj-view-calendar-btn"
            onClick={() => setView("calendar")}
            className={`px-4 py-2 rounded-full text-sm font-bold transition ${view === "calendar" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
          >
            <CalendarIcon className="w-4 h-4 inline mr-1" /> Calendario
          </button>
          <button
            data-testid="dj-my-profile-btn"
            onClick={() => navigate("/dj/perfil")}
            className="px-4 py-2 rounded-full text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
          >
            <UserCog className="w-4 h-4 inline mr-1" /> Mi Perfil
          </button>
          <button
            data-testid="dj-new-draft-btn"
            onClick={() => navigate("/dj/nuevo")}
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full px-5 py-2.5 transition active:scale-95 shadow-[0_8px_30px_rgba(234,88,12,0.3)]"
          >
            <Plus className="w-4 h-4" /> Nuevo post
          </button>
        </div>
      </header>

      {loading ? (
        <div className="text-slate-500">Cargando…</div>
      ) : view === "list" ? (
        <DraftsList
          drafts={drafts}
          templates={templates}
          onEdit={(d) => navigate(`/dj/editar/${d.id}`)}
          onDelete={onDelete}
          onCopy={onCopy}
          onSetStatus={onSetStatus}
          onGenerateImage={onGenerateImage}
        />
      ) : (
        <CalendarView drafts={drafts} onEdit={(d) => navigate(`/dj/editar/${d.id}`)} />
      )}
    </div>
  );
}

function DraftsList({ drafts, templates, onEdit, onDelete, onCopy, onSetStatus, onGenerateImage }) {
  if (!drafts.length) {
    return (
      <div data-testid="dj-empty-state" className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-orange-200">
        <Sparkles className="w-12 h-12 text-orange-400 mx-auto mb-4" />
        <h3 className="text-xl font-black text-slate-900">Aún no tienes borradores</h3>
        <p className="text-slate-500 mt-1">Crea tu primer post con IA en menos de 30 segundos.</p>
      </div>
    );
  }
  const tmplLabel = (key) => templates.find((t) => t.key === key)?.label || key;
  const tmplEmoji = (key) => templates.find((t) => t.key === key)?.emoji || "✨";
  return (
    <div className="grid gap-4" data-testid="dj-drafts-list">
      {drafts.map((d) => (
        <div key={d.id} data-testid={`dj-draft-${d.id}`} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl">{tmplEmoji(d.template_type)}</span>
              <span className="font-bold text-slate-900">{tmplLabel(d.template_type)}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold uppercase">{d.platform}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_COLOR[d.status] || STATUS_COLOR.draft}`}>{STATUS_LABEL[d.status] || d.status}</span>
              {d.scheduled_at && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold">📅 {formatDate(d.scheduled_at)}</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button data-testid={`dj-draft-copy-${d.id}`} onClick={() => onCopy(d.text)} className="p-2 rounded-full hover:bg-slate-100 text-slate-600" title="Copiar"><Copy className="w-4 h-4" /></button>
              <button data-testid={`dj-draft-edit-${d.id}`} onClick={() => onEdit(d)} className="p-2 rounded-full hover:bg-slate-100 text-slate-600" title="Editar"><Pencil className="w-4 h-4" /></button>
              <button data-testid={`dj-draft-delete-${d.id}`} onClick={() => onDelete(d.id)} className="p-2 rounded-full hover:bg-red-50 text-red-600" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-100">{d.text}</pre>

          {/* Cover image */}
          <DraftCoverImage draft={d} onGenerateImage={onGenerateImage} />

          {/* Public landing link (drives social → web traffic) */}
          {d.slug && (
            <div className="mt-3 flex items-center gap-2 flex-wrap text-xs bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl px-3 py-2">
              <span className="font-bold text-amber-700 uppercase tracking-wider">🔗 Link público:</span>
              <code className="text-slate-700 break-all">{window.location.origin}/p/{d.slug}</code>
              <button
                data-testid={`dj-draft-copylink-${d.id}`}
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/p/${d.slug}`);
                  toast.success("Link copiado — pégalo en tu post de redes sociales");
                }}
                className="ml-auto inline-flex items-center gap-1 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold rounded-full px-2.5 py-1 transition"
              >
                <Copy className="w-3 h-3" /> Copiar
              </button>
              <a
                href={`/p/${d.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`dj-draft-preview-${d.id}`}
                className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded-full px-2.5 py-1 transition"
              >
                👁 Ver
              </a>
            </div>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {Object.keys(STATUS_LABEL).map((s) => (
              <button
                key={s}
                onClick={() => onSetStatus(d, s)}
                disabled={d.status === s}
                className={`text-xs font-bold px-3 py-1 rounded-full transition ${d.status === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-400">Creado {formatDate(d.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DraftCoverImage({ draft, onGenerateImage }) {
  const [busy, setBusy] = useState(null); // null | "illustration" | "realistic"
  const handleGen = async (style) => {
    setBusy(style);
    try {
      await onGenerateImage(draft, style);
    } finally {
      setBusy(null);
    }
  };
  if (draft.cover_image) {
    return (
      <div className="mt-3 relative group">
        <img
          src={bannerUrl(draft.cover_image)}
          alt="Cover"
          className="w-full aspect-video object-cover rounded-xl border border-slate-200"
          data-testid={`dj-draft-cover-${draft.id}`}
        />
        <div className="absolute top-2 right-2 flex gap-1.5">
          <button
            onClick={() => handleGen("illustration")}
            disabled={!!busy}
            data-testid={`dj-draft-regen-illustration-${draft.id}`}
            className="inline-flex items-center gap-1 bg-slate-900/85 hover:bg-slate-900 text-white text-[10px] font-bold rounded-full px-3 py-1.5 opacity-90 hover:opacity-100 transition disabled:opacity-50"
          >
            {busy === "illustration" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            🎨 Ilustración
          </button>
          <button
            onClick={() => handleGen("realistic")}
            disabled={!!busy}
            data-testid={`dj-draft-regen-realistic-${draft.id}`}
            className="inline-flex items-center gap-1 bg-slate-900/85 hover:bg-slate-900 text-white text-[10px] font-bold rounded-full px-3 py-1.5 opacity-90 hover:opacity-100 transition disabled:opacity-50"
          >
            {busy === "realistic" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            📷 Realista
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-dashed border-purple-300 rounded-xl p-4">
      <p className="text-sm font-bold text-purple-700 text-center mb-1">Generar imagen con IA</p>
      <p className="text-[10px] text-slate-500 text-center mb-3">Elige el estilo · Gemini Nano Banana · 5-10 seg</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleGen("illustration")}
          disabled={!!busy}
          data-testid={`dj-draft-gen-illustration-${draft.id}`}
          className="bg-white hover:bg-purple-100 border-2 border-purple-200 hover:border-purple-500 rounded-xl py-4 flex flex-col items-center justify-center gap-1 transition disabled:opacity-60"
        >
          {busy === "illustration" ? <Loader2 className="w-5 h-5 text-purple-600 animate-spin" /> : <span className="text-xl">🎨</span>}
          <span className="text-xs font-bold text-purple-700">{busy === "illustration" ? "Generando..." : "Ilustración"}</span>
        </button>
        <button
          onClick={() => handleGen("realistic")}
          disabled={!!busy}
          data-testid={`dj-draft-gen-realistic-${draft.id}`}
          className="bg-white hover:bg-purple-100 border-2 border-purple-200 hover:border-purple-500 rounded-xl py-4 flex flex-col items-center justify-center gap-1 transition disabled:opacity-60"
        >
          {busy === "realistic" ? <Loader2 className="w-5 h-5 text-purple-600 animate-spin" /> : <span className="text-xl">📷</span>}
          <span className="text-xs font-bold text-purple-700">{busy === "realistic" ? "Generando..." : "Realista"}</span>
        </button>
      </div>
    </div>
  );
}

function CalendarView({ drafts, onEdit }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const monthLabel = cursor.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  const days = useMemo(() => {
    const first = new Date(cursor);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const startDay = first.getDay(); // 0=Sun
    const out = [];
    for (let i = 0; i < startDay; i++) out.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      out.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    }
    return out;
  }, [cursor]);

  const draftsByDate = useMemo(() => {
    const map = {};
    drafts.forEach((d) => {
      const key = (d.scheduled_at || d.created_at || "").slice(0, 10);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [drafts]);

  return (
    <div data-testid="dj-calendar-view" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <button data-testid="dj-cal-prev" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-2 rounded-full hover:bg-slate-100"><ChevronLeft className="w-5 h-5" /></button>
        <h3 className="font-black text-lg capitalize">{monthLabel}</h3>
        <button data-testid="dj-cal-next" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-2 rounded-full hover:bg-slate-100"><ChevronRight className="w-5 h-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs font-bold text-slate-500 uppercase mb-2 text-center">
        {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          if (!d) return <div key={i} className="h-24" />;
          const key = d.toISOString().slice(0, 10);
          const list = draftsByDate[key] || [];
          const isToday = key === todayISO();
          return (
            <div key={i} className={`h-24 rounded-lg border ${isToday ? "border-orange-400 bg-orange-50" : "border-slate-100 bg-slate-50"} p-1 overflow-hidden`}>
              <div className={`text-xs font-bold ${isToday ? "text-orange-700" : "text-slate-600"}`}>{d.getDate()}</div>
              <div className="space-y-0.5 mt-1">
                {list.slice(0, 2).map((dr) => (
                  <button
                    key={dr.id}
                    onClick={() => onEdit(dr)}
                    className="block w-full text-left text-[10px] truncate px-1 py-0.5 rounded bg-white border border-slate-200 hover:border-orange-400"
                    title={dr.text.slice(0, 80)}
                  >
                    {dr.text.split("\n").find(Boolean)?.slice(0, 24) || "Borrador"}
                  </button>
                ))}
                {list.length > 2 && <div className="text-[10px] text-slate-500">+{list.length - 2} más</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Composer({ mode, initial, templates, onClose, onSaved }) {
  const editing = mode === "edit" && initial;
  const [step, setStep] = useState(editing ? "edit" : "pick"); // pick | inputs | edit
  const [tmpl, setTmpl] = useState(() => {
    if (editing) return templates.find((t) => t.key === initial.template_type) || null;
    return null;
  });
  const [inputs, setInputs] = useState(() => editing?.inputs || {});
  const [platform, setPlatform] = useState(editing?.platform || "instagram");
  const [text, setText] = useState(editing?.text || "");
  const [status, setStatus] = useState(editing?.status || "draft");
  const [scheduledAt, setScheduledAt] = useState((editing?.scheduled_at || "").slice(0, 10));
  const [fbPostUrl, setFbPostUrl] = useState(editing?.fb_post_url || "");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [variantTone, setVariantTone] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [newsQuery, setNewsQuery] = useState("");
  const [newsResults, setNewsResults] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const isNews = tmpl?.key === "news_repost";

  const searchNews = async (category = "") => {
    setNewsLoading(true);
    try {
      const { data } = await api.post("/dj/news-search", { query: newsQuery, category });
      setNewsResults(data.results || []);
      if (!data.results?.length) toast.error("No se encontraron noticias. Prueba otra búsqueda.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al buscar noticias");
    } finally {
      setNewsLoading(false);
    }
  };

  const pickNews = async (item) => {
    const ni = { headline: item.title, source: item.source || "", angle: "" };
    setInputs(ni);
    setGenerating(true);
    try {
      const { data } = await api.post("/dj/generate", {
        template_type: tmpl.key,
        inputs: ni,
        platform,
        save: false,
      });
      setText(data.text);
      setStep("edit");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Generación falló");
    } finally {
      setGenerating(false);
    }
  };

  const fetchSuggestions = async () => {
    setSuggesting(true);
    try {
      const { data } = await api.post("/dj/suggest", { template_type: tmpl.key });
      setSuggestions(data.suggestions || []);
      if (!data.suggestions?.length) toast.error("No hubo sugerencias, inténtalo de nuevo");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudieron cargar las ideas");
    } finally {
      setSuggesting(false);
    }
  };

  const pickSuggestion = async (s) => {
    setInputs(s.inputs || {});
    // Generate immediately with the chosen idea
    setGenerating(true);
    try {
      const { data } = await api.post("/dj/generate", {
        template_type: tmpl.key,
        inputs: s.inputs || {},
        platform,
        save: false,
      });
      setText(data.text);
      setStep("edit");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Generación falló");
    } finally {
      setGenerating(false);
    }
  };

  const generate = async (tone = "") => {
    setGenerating(true);
    try {
      const { data } = await api.post("/dj/generate", {
        template_type: tmpl.key,
        inputs,
        platform,
        save: false,
        variant_tone: tone || "",
      });
      setText(data.text);
      setStep("edit");
      if (tone) toast.success("¡Variante generada!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Generación falló");
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/dj/drafts/${initial.id}`, {
          text,
          platform,
          status,
          scheduled_at: scheduledAt || "",
          fb_post_url: fbPostUrl.trim(),
        });
      } else {
        await api.post("/dj/drafts", {
          template_type: tmpl.key,
          inputs,
          text,
          platform,
          status,
          scheduled_at: scheduledAt || "",
          fb_post_url: fbPostUrl.trim(),
        });
      }
      toast.success("Guardado");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden" data-testid="dj-composer">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-4 flex items-center justify-between">
        <h2 className="font-black text-lg text-slate-900">
          {editing ? "Editar borrador" : step === "pick" ? "Elige plantilla" : step === "inputs" ? `${tmpl?.emoji} ${tmpl?.label}` : "Vista previa"}
        </h2>
        <button data-testid="dj-composer-close" onClick={onClose} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-full hover:bg-slate-100">
          <X className="w-4 h-4" /> Cancelar
        </button>
      </div>

        {step === "pick" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5" data-testid="dj-templates">
            {templates.map((t) => (
              <button
                key={t.key}
                data-testid={`dj-template-${t.key}`}
                onClick={() => { setTmpl(t); setStep("inputs"); setSuggestions([]); setInputs({}); }}
                className="text-left bg-orange-50 hover:bg-orange-100 border-2 border-transparent hover:border-orange-300 rounded-2xl p-4 transition"
              >
                <div className="text-3xl mb-2">{t.emoji}</div>
                <div className="font-black text-slate-900">{t.label}</div>
                <div className="text-sm text-slate-600 mt-1">{t.description}</div>
              </button>
            ))}
          </div>
        )}

        {step === "inputs" && tmpl && (
          <div className="p-5 space-y-4" data-testid="dj-inputs-form">
            <p className="text-sm text-slate-600">{tmpl.description}</p>

            {/* News search panel — only for the Noticia template */}
            {isNews && (
              <div className="rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/60 p-4" data-testid="dj-news-panel">
                <div className="flex items-center gap-2 mb-1">
                  <Newspaper className="w-5 h-5 text-sky-600" />
                  <span className="font-bold text-sky-900">Buscar noticias reales (últimos 7 días)</span>
                </div>
                <p className="text-[11px] text-sky-700 mb-3">Farándula, música, deportes y comunidad. Sin política, inmigración ni temas religiosos polémicos.</p>
                <div className="flex flex-wrap gap-1.5 mb-3" data-testid="dj-news-categories">
                  {[
                    { key: "farandula", label: "🌟 Farándula" },
                    { key: "musica", label: "🎵 Música" },
                    { key: "deportes", label: "⚽ Deportes" },
                    { key: "local", label: "🏘️ Oregon local" },
                    { key: "internacional", label: "🌎 Internacional" },
                    { key: "entretenimiento", label: "🎬 Entretenimiento" },
                  ].map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      data-testid={`dj-news-cat-${c.key}`}
                      onClick={() => { setNewsQuery(""); searchNews(c.key); }}
                      disabled={newsLoading || generating}
                      className="text-xs font-bold px-3 py-1.5 rounded-full bg-white border border-sky-200 text-sky-700 hover:bg-sky-100 transition disabled:opacity-50"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    data-testid="dj-news-query"
                    value={newsQuery}
                    onChange={(e) => setNewsQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") searchNews(); }}
                    placeholder="Ej: Shakira, concierto en Salem, Liga MX…"
                    className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-sky-500 focus:outline-none transition text-sm"
                  />
                  <button
                    type="button"
                    data-testid="dj-news-search-btn"
                    onClick={() => searchNews()}
                    disabled={newsLoading || generating}
                    className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl px-4 py-2.5 transition active:scale-95"
                  >
                    {newsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Buscar
                  </button>
                </div>
                {newsResults.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1" data-testid="dj-news-results">
                    {newsResults.map((n, i) => (
                      <button
                        key={i}
                        type="button"
                        data-testid={`dj-news-result-${i}`}
                        onClick={() => pickNews(n)}
                        disabled={generating}
                        className="w-full text-left bg-white hover:bg-sky-50 border border-sky-200 hover:border-sky-400 rounded-xl p-3 transition disabled:opacity-50 group"
                      >
                        <div className="flex items-start gap-2">
                          <Newspaper className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm text-slate-900 leading-snug">{n.title}</div>
                            {n.source && <div className="text-[11px] text-slate-500 mt-0.5">{n.source}</div>}
                          </div>
                          <Wand2 className="w-4 h-4 text-sky-500 opacity-0 group-hover:opacity-100 transition shrink-0 mt-0.5" />
                        </div>
                      </button>
                    ))}
                    <p className="text-[11px] text-sky-700 text-center pt-1">Toca una noticia para generar el post al instante</p>
                  </div>
                )}
              </div>
            )}

            {/* AI suggestions panel */}
            {!isNews && (
            <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-4" data-testid="dj-suggestions-panel">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-600" />
                  <span className="font-bold text-amber-900">¿Sin idea? Deja que la IA proponga</span>
                </div>
                <button
                  data-testid="dj-suggest-btn"
                  onClick={fetchSuggestions}
                  disabled={suggesting || generating}
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-sm rounded-full px-4 py-2 transition active:scale-95"
                >
                  {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                  {suggesting ? "Buscando ideas…" : suggestions.length ? "Otras 10 ideas" : "Dame 10 ideas"}
                </button>
              </div>
              {suggestions.length > 0 && (
                <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1" data-testid="dj-suggestions-list">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      data-testid={`dj-suggestion-${i}`}
                      onClick={() => pickSuggestion(s)}
                      disabled={generating}
                      className="w-full text-left bg-white hover:bg-orange-50 border border-amber-200 hover:border-orange-400 rounded-xl p-3 transition disabled:opacity-50 group"
                    >
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-black flex items-center justify-center">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-slate-900">{s.title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {Object.entries(s.inputs || {}).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                          </div>
                        </div>
                        <Wand2 className="w-4 h-4 text-orange-500 opacity-0 group-hover:opacity-100 transition shrink-0 mt-0.5" />
                      </div>
                    </button>
                  ))}
                  <p className="text-[11px] text-amber-700 text-center pt-1">Toca una idea para generar el post al instante</p>
                </div>
              )}
            </div>
            )}

            <div className="text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-400 py-1">{isNews ? "— o escribe la noticia manualmente —" : "— o llena los campos manualmente —"}</div>

            {tmpl.fields.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                  {f.label}{f.required && <span className="text-red-500"> *</span>}
                </label>
                <input
                  data-testid={`dj-input-${f.key}`}
                  value={inputs[f.key] || ""}
                  onChange={(e) => setInputs({ ...inputs, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="mt-1 w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition"
                />
              </div>
            ))}
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Plataforma</label>
              <div className="mt-1 flex gap-2 flex-wrap">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.key}
                    data-testid={`dj-platform-${p.key}`}
                    onClick={() => setPlatform(p.key)}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition ${platform === p.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button onClick={() => setStep("pick")} className="px-4 py-2 rounded-full text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200">Atrás</button>
              <button
                data-testid="dj-generate-btn"
                onClick={() => generate("")}
                disabled={generating || tmpl.fields.some((f) => f.required && !(inputs[f.key] || "").trim())}
                className="ml-auto inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold rounded-full px-5 py-2.5 transition active:scale-95"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {generating ? "Generando…" : "Generar con IA"}
              </button>
            </div>
          </div>
        )}

        {step === "edit" && (
          <div className="p-5 space-y-4" data-testid="dj-edit-form">
            <textarea
              data-testid="dj-text-area"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition font-sans text-sm"
            />

            {tmpl && (
              <div className="rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/50 p-4" data-testid="dj-variants">
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">Generar variante con otro tono</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: "casual", label: "🤙 Casual" },
                    { key: "motivational", label: "🚀 Motivacional" },
                    { key: "shorter", label: "⚡ Corto (X)" },
                    { key: "emotional", label: "💖 Emocional" },
                  ].map((t) => (
                    <button
                      key={t.key}
                      data-testid={`dj-variant-${t.key}`}
                      onClick={() => { setVariantTone(t.key); generate(t.key); }}
                      disabled={generating}
                      className={`text-sm font-bold px-4 py-2 rounded-full transition disabled:opacity-50 ${variantTone === t.key && generating ? "bg-orange-600 text-white" : "bg-white border-2 border-orange-300 text-orange-700 hover:bg-orange-100"}`}
                    >
                      {generating && variantTone === t.key ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">El texto actual se reemplazará. Si te gustó, copia o guarda primero.</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Plataforma</label>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200">
                  {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Estado</label>
                <select data-testid="dj-status-select" value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200">
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Programar (opcional)</label>
                <input data-testid="dj-scheduled-at" type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200" />
              </div>
            </div>

            {/* Facebook post URL — to embed the FB post + comments on the public page */}
            <div className="rounded-2xl border-2 border-[#1877F2]/30 bg-blue-50/50 p-4">
              <label className="text-xs font-bold uppercase tracking-[0.2em] text-[#1877F2] flex items-center gap-2">
                <span>📘</span> Link del post de Facebook (opcional)
              </label>
              <input
                data-testid="dj-fb-post-url"
                type="url"
                value={fbPostUrl}
                onChange={(e) => setFbPostUrl(e.target.value)}
                placeholder="https://www.facebook.com/photo/?fbid=... o https://www.facebook.com/lacampeona/posts/..."
                className="mt-2 w-full px-3 py-2 rounded-xl border-2 border-blue-200 focus:border-[#1877F2] focus:outline-none text-sm font-mono"
              />
              <p className="text-[11px] text-slate-600 mt-1.5">
                Después de publicar en Facebook, copia el link del post y pégalo aquí. El post aparecerá embebido en la página
                con sus comentarios reales de Facebook.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              {!editing && (
                <button onClick={() => setStep("inputs")} className="px-4 py-2 rounded-full text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200">Volver</button>
              )}
              <button
                data-testid="dj-copy-btn"
                onClick={async () => { try { await navigator.clipboard.writeText(text); toast.success("Copiado"); } catch { toast.error("Error"); } }}
                className="px-4 py-2 rounded-full text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 inline-flex items-center gap-1"
              ><Copy className="w-4 h-4" /> Copiar</button>
              <button
                data-testid="dj-save-btn"
                onClick={save}
                disabled={saving || !text.trim()}
                className="ml-auto inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold rounded-full px-5 py-2.5 transition active:scale-95"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Guardando…" : "Guardar borrador"}
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
