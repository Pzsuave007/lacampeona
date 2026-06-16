import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Power, Save, Settings, Sparkles, Music, Mic2, Calendar, CalendarDays, BarChart3, Copy, Eye, MousePointerClick, TrendingUp, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useStation } from "../contexts/StationContext";
import { api, bannerUrl } from "../lib/api";
import AdvertiserForm from "./AdminAdvertiserForm";
import AdminHostForm from "./AdminHostForm";
import AdminEventForm from "./AdminEventForm";
import WeeklyScheduleGrid from "../components/WeeklyScheduleGrid";
import ReportDashboard from "../components/ReportDashboard";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { settings, loadSettings, loadActive, loadLiveHost, active, liveHost } = useStation();
  const navigate = useNavigate();

  const [advertisers, setAdvertisers] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [adminSettings, setAdminSettings] = useState(null);
  const [editing, setEditing] = useState(null); // { mode: 'new'|'edit', adv?: {} }
  const [editingHost, setEditingHost] = useState(null); // { mode, host? }
  const [editingEvent, setEditingEvent] = useState(null); // { mode, event? }
  const [tab, setTab] = useState(() => localStorage.getItem("rl_admin_tab") || "radio");

  useEffect(() => {
    localStorage.setItem("rl_admin_tab", tab);
  }, [tab]);

  useEffect(() => {
    if (user === null) navigate("/login");
  }, [user, navigate]);

  const loadAll = async () => {
    const [a, h, ev, s] = await Promise.all([
      api.get("/admin/advertisers"),
      api.get("/hosts"),
      api.get("/admin/events"),
      api.get("/admin/settings"),
    ]);
    setAdvertisers(a.data);
    setHosts(h.data);
    setEvents(ev.data);
    setAdminSettings(s.data);
  };

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "super_admin") loadAll();
  }, [user]);

  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    return <div className="min-h-screen p-10 text-slate-500">…</div>;
  }

  const activeId = adminSettings?.active_advertiser_id || "";
  const activeHostId = adminSettings?.active_host_id || "";

  const activate = async (id) => {
    await api.post("/admin/activate", { advertiser_id: id });
    await loadAll();
    await loadSettings();
    await loadActive();
    if (id && id !== "AUTO") toast.success(t.admin.activated);
    else toast.success(t.admin.deactivated);
  };

  const activateHost = async (id) => {
    await api.post("/admin/activate-host", { host_id: id });
    await loadAll();
    await loadSettings();
    await loadLiveHost();
    if (id && id !== "AUTO") toast.success(t.admin.activated);
    else toast.success(t.admin.deactivated);
  };

  const onDelete = async (adv) => {
    if (!window.confirm(t.admin.confirmDelete)) return;
    await api.delete(`/admin/advertisers/${adv.id}`);
    await loadAll();
    await loadActive();
    toast.success(t.admin.deleted);
  };

  const onDeleteHost = async (h) => {
    if (!window.confirm(t.admin.confirmDelete)) return;
    await api.delete(`/admin/hosts/${h.id}`);
    await loadAll();
    await loadLiveHost();
    toast.success(t.admin.deleted);
  };

  const onDeleteEvent = async (ev) => {
    if (!window.confirm("¿Eliminar este evento?")) return;
    await api.delete(`/admin/events/${ev.id}`);
    await loadAll();
    await loadActive();
    toast.success("Evento eliminado");
  };

  const saveSettings = async () => {
    const payload = {
      station_name: adminSettings.station_name,
      station_tagline: adminSettings.station_tagline,
      station_whatsapp: adminSettings.station_whatsapp,
      stream_url: adminSettings.stream_url,
      now_playing: adminSettings.now_playing,
      timezone: adminSettings.timezone,
      default_cta_text: adminSettings.default_cta_text,
      default_cta_url: adminSettings.default_cta_url,
      cta_pause_seconds: Number(adminSettings.cta_pause_seconds ?? 60),
      default_hero_bg: adminSettings.default_hero_bg,
      default_artwork: adminSettings.default_artwork,
      // Anúnciate page
      sales_hero_title: adminSettings.sales_hero_title,
      sales_hero_subtitle: adminSettings.sales_hero_subtitle,
      sales_tagline: adminSettings.sales_tagline,
      sales_stat_listeners: adminSettings.sales_stat_listeners,
      sales_stat_households: adminSettings.sales_stat_households,
      sales_stat_counties: adminSettings.sales_stat_counties,
      sales_person_name: adminSettings.sales_person_name,
      sales_person_title: adminSettings.sales_person_title,
      sales_person_phone: adminSettings.sales_person_phone,
      sales_person_whatsapp: adminSettings.sales_person_whatsapp,
      sales_person_email: adminSettings.sales_person_email,
      sales_person_quote: adminSettings.sales_person_quote,
      sales_person_photo: adminSettings.sales_person_photo,
      // Branding
      station_logo: adminSettings.station_logo,
      // Featured Show
      featured_show_enabled: !!adminSettings.featured_show_enabled,
      featured_show_badge: adminSettings.featured_show_badge,
      featured_show_title: adminSettings.featured_show_title,
      featured_show_host: adminSettings.featured_show_host,
      featured_show_description: adminSettings.featured_show_description,
      featured_show_schedule: adminSettings.featured_show_schedule,
      featured_show_photo: adminSettings.featured_show_photo,
      featured_show_whatsapp_text: adminSettings.featured_show_whatsapp_text,
    };
    const { data } = await api.put("/admin/settings", payload);
    setAdminSettings(data);
    await loadSettings();
    toast.success(t.admin.saved);
  };

  if (editing) {
    return (
      <AdvertiserForm
        initial={editing.adv}
        onCancel={() => setEditing(null)}
        onSaved={async () => {
          await loadAll();
          await loadActive();
          setEditing(null);
        }}
      />
    );
  }

  if (editingHost) {
    return (
      <AdminHostForm
        initial={editingHost.host}
        onCancel={() => setEditingHost(null)}
        onSaved={async () => {
          await loadAll();
          await loadLiveHost();
          setEditingHost(null);
        }}
      />
    );
  }

  if (editingEvent) {
    return (
      <AdminEventForm
        initial={editingEvent.event}
        onCancel={() => setEditingEvent(null)}
        onSaved={async () => {
          await loadAll();
          await loadActive();
          setEditingEvent(null);
        }}
      />
    );
  }

  return (
    <div data-testid="admin-page" className="min-h-screen bg-slate-50">
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-600 mb-2">
          Admin
        </p>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter">
          {t.admin.title}
        </h1>
        <p className="text-slate-600 mt-2">{t.admin.subtitle}</p>

        {/* Quick admin shortcuts */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/admin/bracket"
            data-testid="admin-bracket-link"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-bold rounded-full px-4 py-2 text-sm transition active:scale-95 shadow-md"
          >
            🏆 Quiniela del Mundial 2026
          </Link>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex flex-wrap gap-2 border-b border-slate-200">
          {[
            { id: "radio", label: "Radio", icon: Settings, color: "text-orange-600" },
            { id: "hosts", label: "Locutores", icon: Mic2, color: "text-[#7F1D1D]" },
            { id: "ads", label: "Anunciantes", icon: Sparkles, color: "text-orange-600" },
            { id: "events", label: "Eventos", icon: CalendarDays, color: "text-[#7F1D1D]" },
            { id: "reports", label: "Reportes", icon: BarChart3, color: "text-orange-600" },
          ].map((tb) => {
            const Icon = tb.icon;
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                data-testid={`admin-tab-${tb.id}`}
                onClick={() => setTab(tb.id)}
                className={`relative inline-flex items-center gap-2 px-5 py-3 text-sm font-bold transition -mb-px border-b-2 ${
                  active
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? tb.color : ""}`} />
                {tb.label}
                {tb.id === "hosts" && liveHost && (
                  <span className="ml-1 inline-flex items-center gap-1 bg-[#7F1D1D] text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300 live-dot" />
                    Live
                  </span>
                )}
                {tb.id === "ads" && active && (
                  <span className="ml-1 text-[10px] font-extrabold uppercase text-orange-600">
                    {activeId === "AUTO" ? "AUTO" : activeId ? "ON" : "—"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ===================== TAB: RADIO ===================== */}
        {tab === "radio" && adminSettings && (
          <div className="mt-8 space-y-8" data-testid="tab-radio">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-1">
                <Settings className="w-5 h-5 text-orange-600" />
                <h2 className="text-2xl font-extrabold text-slate-900">{t.admin.stationSettings}</h2>
              </div>
              <p className="text-sm text-slate-500 mb-5">
                Configura el nombre, frecuencia, stream y zona horaria de la emisora.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingField
                  testid="set-station-name"
                  label={t.admin.stationName}
                  value={adminSettings.station_name || ""}
                  onChange={(v) => setAdminSettings({ ...adminSettings, station_name: v })}
                />
                <SettingField
                  testid="set-station-tagline"
                  label={t.admin.stationTagline}
                  value={adminSettings.station_tagline || ""}
                  onChange={(v) => setAdminSettings({ ...adminSettings, station_tagline: v })}
                />
                <SettingField
                  testid="set-station-wa"
                  label={t.admin.stationWhatsapp}
                  placeholder="13105550100"
                  value={adminSettings.station_whatsapp || ""}
                  onChange={(v) => setAdminSettings({ ...adminSettings, station_whatsapp: v })}
                />
                <SettingField
                  testid="set-now-playing"
                  label={t.admin.nowPlaying}
                  value={adminSettings.now_playing || ""}
                  onChange={(v) => setAdminSettings({ ...adminSettings, now_playing: v })}
                />
                <SettingField
                  testid="set-stream-url"
                  wide
                  label={t.admin.streamUrl}
                  value={adminSettings.stream_url || ""}
                  onChange={(v) => setAdminSettings({ ...adminSettings, stream_url: v })}
                />
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                    Zona horaria de la emisora
                  </span>
                  <select
                    data-testid="set-timezone"
                    value={adminSettings.timezone || "America/Los_Angeles"}
                    onChange={(e) => setAdminSettings({ ...adminSettings, timezone: e.target.value })}
                    className="mt-1 w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition bg-white"
                  >
                    <option value="America/Los_Angeles">Oregon / California (PST/PDT)</option>
                    <option value="America/Denver">Colorado / Arizona (MST/MDT)</option>
                    <option value="America/Chicago">Chicago / Texas (CST/CDT)</option>
                    <option value="America/New_York">New York / Florida (EST/EDT)</option>
                    <option value="America/Mexico_City">Ciudad de México (CST)</option>
                    <option value="America/Bogota">Bogotá / Lima (COT)</option>
                    <option value="America/Buenos_Aires">Buenos Aires (ART)</option>
                    <option value="UTC">UTC (Universal)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Los horarios de los locutores y anunciantes se evalúan en esta zona.
                  </p>
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                    Pausa entre anuncios (segundos)
                  </span>
                  <input
                    data-testid="set-cta-pause"
                    type="number"
                    min="0"
                    max="600"
                    value={adminSettings.cta_pause_seconds ?? 60}
                    onChange={(e) =>
                      setAdminSettings({ ...adminSettings, cta_pause_seconds: e.target.value })
                    }
                    className="mt-1 w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition bg-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Segundos sin anuncio entre cada spot (default 60s). Pon 0 para rotación continua.
                  </p>
                </label>

                {/* Default Hero Background (used when no host is live) */}
                <HeroBgField
                  testid="hero-bg"
                  iconLabel="Fondo del Hero (cuando no hay locutor en vivo)"
                  helpText="Aparece en la página principal cuando ningún locutor está al aire. Si lo dejas vacío, se usa la imagen por defecto."
                  value={adminSettings.default_hero_bg || ""}
                  onChange={(v) => setAdminSettings({ ...adminSettings, default_hero_bg: v })}
                />

                {/* Default Artwork (used when no song image is available) */}
                <HeroBgField
                  testid="artwork"
                  iconLabel="Foto del disco (cuando no hay carátula de canción)"
                  helpText="Aparece en el disco girando y en el player cuando no hay carátula real de la canción (ej: durante shows en vivo o anuncios). Recomendado: imagen cuadrada del logo o foto del estudio."
                  value={adminSettings.default_artwork || ""}
                  onChange={(v) => setAdminSettings({ ...adminSettings, default_artwork: v })}
                />

                {/* Station Logo */}
                <HeroBgField
                  testid="station-logo"
                  iconLabel="Logo de la estación (navbar)"
                  helpText="Aparece en la barra superior. Recomendado: PNG transparente, mínimo 1000×400 px para que se vea nítido en pantallas Retina. Si lo dejas vacío, se usa el logo por defecto."
                  value={adminSettings.station_logo || ""}
                  onChange={(v) => setAdminSettings({ ...adminSettings, station_logo: v })}
                />
              </div>

              {/* ====================================================== */}
              {/* Show Destacado (Featured Show)                          */}
              {/* ====================================================== */}
              <div className="mt-8 pt-8 border-t-2 border-dashed border-amber-300">
                <h3 className="text-2xl font-black text-slate-900 mb-1 flex items-center gap-2">
                  🔥 Show Destacado
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  Aparece como sección especial en el Home, justo después del Hero. Úsalo para promocionar programas exclusivos o nacionales (ej: "El Show del Genio Lucas").
                </p>

                <label className="flex items-center gap-3 mb-5 cursor-pointer bg-amber-50 border-2 border-amber-200 rounded-xl px-4 py-3 hover:border-amber-400 transition">
                  <input
                    type="checkbox"
                    checked={!!adminSettings.featured_show_enabled}
                    onChange={(e) =>
                      setAdminSettings({
                        ...adminSettings,
                        featured_show_enabled: e.target.checked,
                      })
                    }
                    data-testid="set-featured-show-enabled"
                    className="w-5 h-5 accent-orange-600"
                  />
                  <span className="font-bold text-slate-900">
                    Mostrar sección de show destacado en el Home
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <SettingField
                    label="Badge superior"
                    value={adminSettings.featured_show_badge || ""}
                    placeholder="EXCLUSIVO EN LA CAMPEONA"
                    onChange={(v) => setAdminSettings({ ...adminSettings, featured_show_badge: v })}
                    testid="set-fs-badge"
                  />
                  <SettingField
                    label="Título del show"
                    value={adminSettings.featured_show_title || ""}
                    placeholder="El Show del Genio Lucas"
                    onChange={(v) => setAdminSettings({ ...adminSettings, featured_show_title: v })}
                    testid="set-fs-title"
                  />
                  <SettingField
                    label="Nombre del host"
                    value={adminSettings.featured_show_host || ""}
                    placeholder="Genio Lucas"
                    onChange={(v) => setAdminSettings({ ...adminSettings, featured_show_host: v })}
                    testid="set-fs-host"
                  />
                  <SettingField
                    label="Horario"
                    value={adminSettings.featured_show_schedule || ""}
                    placeholder="Lun-Vie · 8AM - 10AM"
                    onChange={(v) => setAdminSettings({ ...adminSettings, featured_show_schedule: v })}
                    testid="set-fs-schedule"
                  />
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                      Descripción
                    </span>
                    <textarea
                      value={adminSettings.featured_show_description || ""}
                      placeholder="1-3 oraciones que enganchen. Ej: 'Programa nacional con humor, noticias y la mejor música regional. Solo en La Campeona, todos los días.'"
                      onChange={(e) =>
                        setAdminSettings({
                          ...adminSettings,
                          featured_show_description: e.target.value,
                        })
                      }
                      rows={3}
                      data-testid="set-fs-description"
                      className="mt-2 w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition resize-none"
                    />
                  </label>
                  <SettingField
                    wide
                    label="Mensaje pre-cargado en WhatsApp (déjalo vacío para ocultar el botón)"
                    value={adminSettings.featured_show_whatsapp_text || ""}
                    placeholder="Vacío = no muestra botón de WhatsApp"
                    onChange={(v) =>
                      setAdminSettings({
                        ...adminSettings,
                        featured_show_whatsapp_text: v,
                      })
                    }
                    testid="set-fs-wa-text"
                  />

                  {/* Foto del show */}
                  <HeroBgField
                    testid="fs-photo"
                    iconLabel="Foto del show (cuadrada, alta calidad)"
                    helpText="Recomendado: foto cuadrada 800×800 px o más. Puede ser foto del host, logo del programa, o arte promocional."
                    value={adminSettings.featured_show_photo || ""}
                    onChange={(v) =>
                      setAdminSettings({ ...adminSettings, featured_show_photo: v })
                    }
                  />
                </div>
              </div>

              {/* ====================================================== */}
              {/* Sección Anúnciate                                        */}
              {/* ====================================================== */}
              <div className="mt-8 pt-8 border-t-2 border-dashed border-orange-200">
                <h3 className="text-2xl font-black text-slate-900 mb-1">Página Anúnciate</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Edita el contenido de la página <code className="bg-slate-100 px-1.5 py-0.5 rounded">/anuncia</code> donde tus prospectos te contactan.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <SettingField
                    label="Título principal (Hero)"
                    value={adminSettings.sales_hero_title || ""}
                    placeholder="Tu negocio"
                    onChange={(v) => setAdminSettings({ ...adminSettings, sales_hero_title: v })}
                    testid="set-sales-hero-title"
                  />
                  <SettingField
                    label="Subtítulo cursiva (Hero)"
                    value={adminSettings.sales_hero_subtitle || ""}
                    placeholder="en boca de todos"
                    onChange={(v) => setAdminSettings({ ...adminSettings, sales_hero_subtitle: v })}
                    testid="set-sales-hero-subtitle"
                  />
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                      Tagline (debajo del título)
                    </span>
                    <textarea
                      value={adminSettings.sales_tagline || ""}
                      placeholder="Tu negocio se escucha en toda la Willamette Valley"
                      onChange={(e) =>
                        setAdminSettings({ ...adminSettings, sales_tagline: e.target.value })
                      }
                      rows={2}
                      data-testid="set-sales-tagline"
                      className="mt-2 w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition resize-none"
                    />
                  </label>

                  {/* Stats */}
                  <SettingField
                    label="Estadística — Oyentes/sem"
                    value={adminSettings.sales_stat_listeners || ""}
                    placeholder="180,000+"
                    onChange={(v) => setAdminSettings({ ...adminSettings, sales_stat_listeners: v })}
                    testid="set-stat-listeners"
                  />
                  <SettingField
                    label="Estadística — Hogares"
                    value={adminSettings.sales_stat_households || ""}
                    placeholder="65,000+"
                    onChange={(v) => setAdminSettings({ ...adminSettings, sales_stat_households: v })}
                    testid="set-stat-households"
                  />
                  <SettingField
                    label="Estadística — Condados"
                    value={adminSettings.sales_stat_counties || ""}
                    placeholder="8"
                    onChange={(v) => setAdminSettings({ ...adminSettings, sales_stat_counties: v })}
                    testid="set-stat-counties"
                  />
                </div>

                {/* ----- Asesora de ventas ----- */}
                <h4 className="mt-8 text-lg font-black text-slate-900">Asesora de ventas</h4>
                <p className="text-xs text-slate-500 mb-4">
                  Datos de contacto que aparecen en la sección de la asesora.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <SettingField
                    label="Nombre"
                    value={adminSettings.sales_person_name || ""}
                    placeholder="María Hernández"
                    onChange={(v) => setAdminSettings({ ...adminSettings, sales_person_name: v })}
                    testid="set-sp-name"
                  />
                  <SettingField
                    label="Cargo / Título"
                    value={adminSettings.sales_person_title || ""}
                    placeholder="Asesora de ventas — La Campeona 880 AM"
                    onChange={(v) => setAdminSettings({ ...adminSettings, sales_person_title: v })}
                    testid="set-sp-title"
                  />
                  <SettingField
                    label="Teléfono (formato +1...)"
                    value={adminSettings.sales_person_phone || ""}
                    placeholder="+15036230244"
                    onChange={(v) => setAdminSettings({ ...adminSettings, sales_person_phone: v })}
                    testid="set-sp-phone"
                  />
                  <SettingField
                    label="WhatsApp (solo dígitos, ej. 15036230244)"
                    value={adminSettings.sales_person_whatsapp || ""}
                    placeholder="15036230244"
                    onChange={(v) => setAdminSettings({ ...adminSettings, sales_person_whatsapp: v })}
                    testid="set-sp-wa"
                  />
                  <SettingField
                    label="Email"
                    value={adminSettings.sales_person_email || ""}
                    placeholder="ventas@lacampeona.com"
                    onChange={(v) => setAdminSettings({ ...adminSettings, sales_person_email: v })}
                    testid="set-sp-email"
                  />
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                      Frase/Quote (en cursiva en la página)
                    </span>
                    <textarea
                      value={adminSettings.sales_person_quote || ""}
                      placeholder="Cuéntame de tu negocio en 5 minutos y te diseño el paquete que te conviene."
                      onChange={(e) =>
                        setAdminSettings({
                          ...adminSettings,
                          sales_person_quote: e.target.value,
                        })
                      }
                      rows={2}
                      data-testid="set-sp-quote"
                      className="mt-2 w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition resize-none"
                    />
                  </label>

                  {/* Photo upload */}
                  <HeroBgField
                    testid="sp-photo"
                    iconLabel="Foto de la asesora"
                    helpText="Recomendado: 800×800 px o más grande. Cuadrada o vertical. Puedes pegar una URL o subir desde tu computadora."
                    value={adminSettings.sales_person_photo || ""}
                    onChange={(v) => setAdminSettings({ ...adminSettings, sales_person_photo: v })}
                  />
                </div>
              </div>
              <button
                data-testid="settings-save-btn"
                onClick={saveSettings}
                className="mt-5 inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full px-5 py-2.5 transition active:scale-95"
              >
                <Save className="w-4 h-4" />
                {t.admin.save}
              </button>
            </div>

            {/* Quick stats card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Locutores" value={hosts.length} icon={Mic2} accent="#7F1D1D" />
              <StatCard label="Anunciantes" value={advertisers.length} icon={Sparkles} accent="#EA580C" />
              <StatCard
                label="Al aire ahora"
                value={liveHost ? liveHost.show_name || liveHost.name : "—"}
                icon={Mic2}
                accent="#7F1D1D"
                small
              />
            </div>
          </div>
        )}

        {/* ===================== TAB: HOSTS ===================== */}
        {tab === "hosts" && (
          <div className="mt-8 space-y-8" data-testid="tab-hosts">
            {/* Live host status */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7F1D1D] mb-1 inline-flex items-center gap-2">
              <Mic2 className="w-4 h-4" /> Al aire ahora
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xl font-extrabold text-slate-900" data-testid="admin-live-host-name">
                {liveHost ? `${liveHost.name} · ${liveHost.show_name || ""}` : activeHostId === "AUTO" ? "Automático (por horario)" : "Ninguno"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              data-testid="admin-host-set-auto-btn"
              onClick={() => activateHost("AUTO")}
              className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                activeHostId === "AUTO" ? "bg-[#7F1D1D] text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-900"
              }`}
            >
              Automático (horario)
            </button>
            <button
              data-testid="admin-host-set-none-btn"
              onClick={() => activateHost("")}
              className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                activeHostId === "" ? "bg-[#7F1D1D] text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-900"
              }`}
            >
              Ninguno
            </button>
          </div>
        </div>

        {/* Hosts list */}
        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold text-slate-900 inline-flex items-center gap-2">
            <Mic2 className="w-5 h-5 text-[#7F1D1D]" /> Locutores
          </h2>
          <button
            data-testid="admin-new-host-btn"
            onClick={() => setEditingHost({ mode: "new" })}
            className="inline-flex items-center gap-2 bg-[#7F1D1D] hover:bg-[#991B1B] text-white font-bold rounded-full px-5 py-2.5 transition active:scale-95 shadow-md"
          >
            <Plus className="w-4 h-4" />
            Nuevo locutor
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="admin-hosts-grid">
          {hosts.map((h) => {
            const isLive = activeHostId === h.id || (liveHost && liveHost.id === h.id);
            return (
              <div
                key={h.id}
                data-testid={`admin-host-card-${h.slug}`}
                className={`bg-white rounded-2xl border ${
                  isLive ? "border-[#7F1D1D] ring-2 ring-red-200" : "border-slate-200"
                } p-5 flex gap-4`}
              >
                <div className="w-20 h-24 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                  {h.photo_path ? (
                    <img src={bannerUrl(h.photo_path)} alt={h.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Mic2 className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-slate-900 truncate">{h.name}</h3>
                      <p className="text-xs text-slate-500 truncate">
                        {h.show_name ? `“${h.show_name}”` : h.tagline || ""}
                      </p>
                    </div>
                    {isLive && (
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] bg-[#7F1D1D] text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                        LIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {h.schedule?.length || 0} franjas · {h.whatsapp ? `WA +${h.whatsapp}` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      data-testid={`admin-host-activate-${h.slug}`}
                      onClick={() => activateHost(activeHostId === h.id ? "" : h.id)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                        activeHostId === h.id
                          ? "bg-[#7F1D1D] text-white hover:bg-[#991B1B]"
                          : "bg-red-50 text-[#7F1D1D] hover:bg-red-100"
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {activeHostId === h.id ? "Desactivar" : "Poner al aire"}
                    </button>
                    <button
                      data-testid={`admin-host-edit-${h.slug}`}
                      onClick={() => setEditingHost({ mode: "edit", host: h })}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      data-testid={`admin-host-profile-${h.slug}`}
                      onClick={() => navigate(`/dj/perfil?host=${h.slug}`)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Vista locutor
                    </button>
                    <button
                      data-testid={`admin-host-delete-${h.slug}`}
                      onClick={() => onDeleteHost(h)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {hosts.length === 0 && (
            <p className="col-span-full text-slate-500 text-center py-6">
              Aún no hay locutores. Crea el primero con el botón “Nuevo locutor”.
            </p>
          )}
        </div>

        {/* Weekly calendar grid */}
        {hosts.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold text-slate-900 inline-flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#7F1D1D]" /> Programación de la semana
              </h3>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                {adminSettings?.timezone || "America/Los_Angeles"}
              </span>
            </div>
            <WeeklyScheduleGrid
              hosts={hosts}
              timezone={adminSettings?.timezone}
              onEditHost={(h) => setEditingHost({ mode: "edit", host: h })}
            />
            <p className="text-xs text-slate-500 mt-3">
              💡 El sistema cambia al locutor automáticamente cuando entra una franja activa.
              Asegúrate de tener el modo <b>“Automático (horario)”</b> seleccionado arriba.
            </p>
          </div>
        )}
          </div>
        )}

        {/* ===================== TAB: ADS ===================== */}
        {tab === "ads" && (
          <div className="mt-8 space-y-8" data-testid="tab-ads">
            {/* Active advertiser status */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">
                  {t.admin.activeNow}
                </p>
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-orange-600" />
                  <span className="text-xl font-extrabold text-slate-900" data-testid="admin-active-name">
                    {active ? active.name : activeId === "AUTO" ? t.admin.auto : t.admin.none}
                  </span>
                </div>
                {activeId === "AUTO" && (
                  <p className="text-xs text-slate-500 mt-2 max-w-xl">{t.admin.autoExplain}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  data-testid="admin-set-auto-btn"
                  onClick={() => activate("AUTO")}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                    activeId === "AUTO" ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                  }`}
                >
                  {t.admin.auto}
                </button>
                <button
                  data-testid="admin-set-none-btn"
                  onClick={() => activate("")}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                    activeId === "" ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                  }`}
                >
                  {t.admin.none}
                </button>
              </div>
            </div>

            {/* Advertisers list */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-extrabold text-slate-900">{t.nav.advertisers}</h2>
          <button
            data-testid="admin-new-advertiser-btn"
            onClick={() => setEditing({ mode: "new" })}
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full px-5 py-2.5 transition active:scale-95 shadow-md"
          >
            <Plus className="w-4 h-4" />
            {t.admin.newAdvertiser}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="admin-advertisers-grid">
          {advertisers.map((adv) => {
            const isActive = activeId === adv.id;
            return (
              <div
                key={adv.id}
                className={`bg-white rounded-2xl border ${isActive ? "border-orange-400 ring-2 ring-orange-200" : "border-slate-200"} p-5 flex gap-4`}
                data-testid={`admin-adv-card-${adv.slug}`}
              >
                <div className="w-24 h-24 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                  {adv.banner_path ? (
                    <img src={bannerUrl(adv.banner_path)} alt={adv.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Music className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold text-slate-900 truncate">{adv.name}</h3>
                      <p className="text-xs text-slate-500 truncate">{adv.tagline || ""}</p>
                    </div>
                    {isActive && (
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] bg-orange-600 text-white px-2 py-0.5 rounded-full">
                        ON
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {adv.phone} {adv.whatsapp ? `• WA +${adv.whatsapp}` : ""}
                  </p>
                  <p className="text-[11px] text-orange-700 font-bold mt-1">
                    📊 {adv.spots_per_hour || 4} spots/h × {adv.spot_duration_sec || 30}s · prioridad {adv.priority || 5}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      data-testid={`admin-activate-${adv.slug}`}
                      onClick={() => activate(isActive ? "" : adv.id)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                        isActive
                          ? "bg-slate-900 text-white hover:bg-slate-800"
                          : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {isActive ? t.admin.deactivate : t.admin.activate}
                    </button>
                    <button
                      data-testid={`admin-edit-${adv.slug}`}
                      onClick={() => setEditing({ mode: "edit", adv })}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      data-testid={`admin-delete-${adv.slug}`}
                      onClick={() => onDelete(adv)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t.admin.delete}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
            </div>
          </div>
        )}

        {/* ===================== TAB: EVENTS ===================== */}
        {tab === "events" && (
          <div className="mt-8 space-y-6" data-testid="tab-events">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 inline-flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-[#7F1D1D]" /> Eventos
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Conciertos, promociones y actividades comunitarias. Los eventos pasados se ocultan automáticamente.
                </p>
              </div>
              <button
                data-testid="admin-new-event-btn"
                onClick={() => setEditingEvent({ mode: "new" })}
                className="inline-flex items-center gap-2 bg-[#7F1D1D] hover:bg-[#991B1B] text-white font-bold rounded-full px-5 py-2.5 transition active:scale-95 shadow-md"
              >
                <Plus className="w-4 h-4" />
                Nuevo evento
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="admin-events-grid">
              {events.map((ev) => (
                <EventAdminCard
                  key={ev.id}
                  ev={ev}
                  onEdit={() => setEditingEvent({ mode: "edit", event: ev })}
                  onDelete={() => onDeleteEvent(ev)}
                />
              ))}
              {events.length === 0 && (
                <p className="col-span-full text-slate-500 text-center py-10">
                  Aún no hay eventos. Crea el primero con el botón "Nuevo evento".
                </p>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: REPORTS ===================== */}
        {tab === "reports" && (
          <ReportsTab advertisers={advertisers} events={events} />
        )}
      </section>
    </div>
  );
}

function ReportsTab({ advertisers, events }) {
  const [overview, setOverview] = useState(null);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/admin/analytics/overview?days=${days}`);
        setOverview(data);
      } catch (e) {
        toast.error("Error cargando reportes");
      }
    })();
  }, [days]);

  useEffect(() => {
    if (!selected) {
      setDetails(null);
      return;
    }
    (async () => {
      try {
        const { data } = await api.get(
          `/admin/analytics/${selected.entity_type}/${selected.id}?days=${days}`
        );
        setDetails(data);
      } catch (e) {
        toast.error("Error cargando detalle");
      }
    })();
  }, [selected, days]);

  const allEntities = [
    ...advertisers.map((a) => ({ ...a, entity_type: "advertiser", display: a.name })),
    ...events.map((e) => ({ ...e, entity_type: "event", display: e.title })),
  ];

  const copyReportLink = (entity) => {
    const link = `${window.location.origin}/reporte/${entity.report_token}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      toast.success("Link copiado al portapapeles");
    } else {
      window.prompt("Copia este link:", link);
    }
  };

  return (
    <div className="mt-8 space-y-6" data-testid="tab-reports">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 inline-flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-600" /> Reportes
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Impresiones, clicks y CTR por anunciante y evento. Comparte el link con cada cliente para que vea su propio dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Periodo</span>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              data-testid={`reports-period-${d}`}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                days === d ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4" data-testid="reports-overview">
          <OverviewStat icon={Eye} label="Impresiones" value={overview.impressions} color="#7F1D1D" />
          <OverviewStat icon={MousePointerClick} label="Clicks" value={overview.clicks} color="#EA580C" />
          <OverviewStat icon={TrendingUp} label="CTR" value={`${(overview.ctr * 100).toFixed(1)}%`} color="#0E3B26" />
          <OverviewStat icon={Sparkles} label="Items activos" value={overview.items?.length || 0} color="#25D366" />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-sm font-extrabold text-slate-900">Por anunciante / evento</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="reports-entities-table">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-bold">Nombre</th>
                <th className="text-left px-4 py-3 font-bold">Tipo</th>
                <th className="text-right px-4 py-3 font-bold">Impr.</th>
                <th className="text-right px-4 py-3 font-bold">Clicks</th>
                <th className="text-right px-4 py-3 font-bold">CTR</th>
                <th className="text-right px-4 py-3 font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {allEntities.map((entity) => {
                const stats = (overview?.items || []).find((it) => it.entity_id === entity.id) || { impressions: 0, clicks: 0, ctr: 0 };
                return (
                  <tr key={entity.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-bold text-slate-900">{entity.display}</td>
                    <td className="px-4 py-3 text-slate-500">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          entity.entity_type === "event" ? "bg-amber-100 text-amber-800" : "bg-orange-100 text-orange-800"
                        }`}
                      >
                        {entity.entity_type === "event" ? "Evento" : "Anuncio"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{stats.impressions || 0}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{stats.clicks || 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{((stats.ctr || 0) * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <button
                          data-testid={`report-view-${entity.id}`}
                          onClick={() => setSelected({ entity_type: entity.entity_type, id: entity.id })}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 transition"
                        >
                          <BarChart3 className="w-3 h-3" /> Ver
                        </button>
                        {entity.report_token && (
                          <button
                            data-testid={`report-copy-${entity.id}`}
                            onClick={() => copyReportLink(entity)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-orange-100 hover:bg-orange-200 text-orange-800 transition"
                            title="Copiar link para enviar al dueño"
                          >
                            <Copy className="w-3 h-3" /> Link
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {allEntities.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-slate-500 py-10">
                    Aún no hay anunciantes ni eventos para reportar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && details && (
        <div className="bg-orange-50 rounded-2xl border-2 border-orange-200 p-5" data-testid="reports-drilldown">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <h3 className="text-lg font-extrabold text-slate-900">
              📊 {details.entity?.name || details.entity?.title || "—"}
            </h3>
            <button
              data-testid="reports-close-drilldown"
              onClick={() => setSelected(null)}
              className="text-xs text-slate-600 hover:text-slate-900 font-bold underline"
            >
              Cerrar
            </button>
          </div>
          <ReportDashboard stats={details} entityName={details.entity?.name || details.entity?.title} entityType={selected.entity_type} />
        </div>
      )}
    </div>
  );
}

function OverviewStat({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: color }}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      </div>
      <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{value}</p>
    </div>
  );
}


function EventAdminCard({ ev, onEdit, onDelete }) {
  const today = new Date().toISOString().slice(0, 10);
  const isPast = (ev.event_date || "") < today;
  const isToday = (ev.event_date || "") === today;
  const categoryEmoji = { concierto: "🎶", promocion: "🎁", comunidad: "🤝" }[ev.category] || "📅";
  return (
    <div
      data-testid={`admin-event-card-${ev.slug}`}
      className={`bg-white rounded-2xl border ${isToday ? "border-amber-400 ring-2 ring-amber-200" : "border-slate-200"} p-5 flex gap-4`}
    >
      <div className="w-24 h-24 rounded-xl bg-slate-100 overflow-hidden shrink-0">
        {ev.image_path ? (
          <img src={bannerUrl(ev.image_path)} alt={ev.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-3xl">
            {categoryEmoji}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-extrabold text-slate-900 truncate">{ev.title}</h3>
            <p className="text-xs text-slate-500 truncate">
              {categoryEmoji} {ev.location || "Sin ubicación"}
            </p>
          </div>
          {isToday && (
            <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] bg-amber-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">
              HOY
            </span>
          )}
          {isPast && (
            <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] bg-slate-300 text-slate-600 px-2 py-0.5 rounded-full whitespace-nowrap">
              PASADO
            </span>
          )}
        </div>
        <p className="text-xs text-slate-700 mt-1.5 font-bold">
          📅 {ev.event_date}
          {ev.end_date && ev.end_date !== ev.event_date ? ` → ${ev.end_date}` : ""}
          {" "}· {ev.start_time}–{ev.end_time}
        </p>
        {ev.promoted_as_cta && (
          <p className="text-[11px] text-amber-700 font-bold mt-1 inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> SmartCTA · {ev.spots_per_hour}/h × {ev.spot_duration_sec}s · pri {ev.priority}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            data-testid={`admin-event-edit-${ev.slug}`}
            onClick={onEdit}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 transition"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </button>
          <button
            data-testid={`admin-event-delete-${ev.slug}`}
            onClick={onDelete}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingField({ label, value, onChange, placeholder, testid, wide }) {
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">{label}</span>
      <input
        data-testid={testid}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition"
      />
    </label>
  );
}

function StatCard({ label, value, icon: Icon, accent = "#7F1D1D", small }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
      <span
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${accent}1A`, color: accent }}
      >
        <Icon className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
          {label}
        </p>
        <p className={`font-black text-slate-900 truncate ${small ? "text-lg" : "text-3xl"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function HeroBgField({ value, onChange, testid = "hero-bg", iconLabel, helpText }) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(data.path);
      toast.success("Imagen subida — recuerda guardar");
    } catch (e) {
      toast.error("Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <label className="block sm:col-span-2">
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 flex items-center gap-2">
        <ImageIcon className="w-3.5 h-3.5" />
        {iconLabel}
      </span>
      <div className="mt-2 flex flex-col sm:flex-row gap-3 items-start">
        {value && (
          <div className="relative w-32 h-20 rounded-xl overflow-hidden border-2 border-slate-200 shrink-0">
            <img
              src={bannerUrl(value)}
              alt="preview"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => onChange("")}
              data-testid={`${testid}-clear-btn`}
              title="Quitar y volver al default"
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex-1 w-full space-y-2">
          <input
            data-testid={`set-${testid}-url`}
            type="text"
            value={value || ""}
            placeholder="Pega una URL de imagen, o sube una abajo"
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition"
          />
          <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-full px-4 py-2 transition active:scale-95">
            <ImageIcon className="w-4 h-4" />
            {uploading ? "Subiendo..." : "Subir desde mi computadora"}
            <input
              type="file"
              accept="image/*"
              data-testid={`${testid}-upload-input`}
              onChange={(e) => upload(e.target.files?.[0])}
              className="hidden"
              disabled={uploading}
            />
          </label>
          <p className="text-[11px] text-slate-500">{helpText}</p>
        </div>
      </div>
    </label>
  );
}
