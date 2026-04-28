import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Power, Save, Settings, Sparkles, Image as ImageIcon, Music } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useStation } from "../contexts/StationContext";
import { api, bannerUrl } from "../lib/api";
import AdvertiserForm from "./AdminAdvertiserForm";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { settings, loadSettings, loadActive, active } = useStation();
  const navigate = useNavigate();

  const [advertisers, setAdvertisers] = useState([]);
  const [adminSettings, setAdminSettings] = useState(null);
  const [editing, setEditing] = useState(null); // { mode: 'new'|'edit', adv?: {} }

  useEffect(() => {
    if (user === null) navigate("/login");
  }, [user, navigate]);

  const loadAll = async () => {
    const [a, s] = await Promise.all([
      api.get("/advertisers"),
      api.get("/admin/settings"),
    ]);
    setAdvertisers(a.data);
    setAdminSettings(s.data);
  };

  useEffect(() => {
    if (user?.role === "admin") loadAll();
  }, [user]);

  if (!user || user.role !== "admin") {
    return <div className="min-h-screen p-10 text-slate-500">…</div>;
  }

  const activeId = adminSettings?.active_advertiser_id || "";

  const activate = async (id) => {
    await api.post("/admin/activate", { advertiser_id: id });
    await loadAll();
    await loadSettings();
    await loadActive();
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

  const saveSettings = async () => {
    const payload = {
      station_name: adminSettings.station_name,
      station_tagline: adminSettings.station_tagline,
      station_whatsapp: adminSettings.station_whatsapp,
      stream_url: adminSettings.stream_url,
      now_playing: adminSettings.now_playing,
      default_cta_text: adminSettings.default_cta_text,
      default_cta_url: adminSettings.default_cta_url,
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

        {/* Active state card */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
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
        <div className="mt-10 flex items-center justify-between">
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

        {/* Station settings */}
        {adminSettings && (
          <div className="mt-12 bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-5">
              <Settings className="w-5 h-5 text-orange-600" />
              <h2 className="text-2xl font-extrabold text-slate-900">{t.admin.stationSettings}</h2>
            </div>
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
        )}
      </section>
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
