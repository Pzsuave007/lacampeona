import React, { useState } from "react";
import { Save, X, Upload, Plus, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api, bannerUrl } from "../lib/api";
import { useLanguage } from "../contexts/LanguageContext";

const empty = {
  name: "",
  tagline: "",
  description: "",
  special_offer: "",
  cta_text: "Order Now",
  phone: "",
  whatsapp: "",
  address: "",
  maps_url: "",
  website_url: "",
  weekly_ad_url: "",
  banner_path: "",
  color: "#EA580C",
  schedule: [],
};

export default function AdvertiserForm({ initial, onCancel, onSaved }) {
  const { t } = useLanguage();
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState({ ...empty, ...(initial || {}) });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshWeeklyAd = async () => {
    if (!initial?.id) return;
    setRefreshing(true);
    try {
      const { data } = await api.post(`/admin/advertisers/${initial.id}/weekly-ad/refresh`);
      if (data.ok) {
        toast.success(`✅ Ofertas actualizadas: ${data.images?.length || 0} imágenes${data.pdf_url ? " + PDF" : ""}${data.date_range ? ` (${data.date_range})` : ""}`);
      } else {
        toast.error(data.error || "No se encontraron ofertas en esa página");
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al actualizar ofertas");
    } finally {
      setRefreshing(false);
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      set("banner_path", data.path);
      toast.success("Banner subido");
    } catch (e) {
      toast.error("Error al subir banner");
    } finally {
      setUploading(false);
    }
  };

  const addSlot = () => {
    set("schedule", [...form.schedule, { day_of_week: 0, start_time: "12:00", end_time: "13:00" }]);
  };
  const removeSlot = (i) => set("schedule", form.schedule.filter((_, idx) => idx !== i));
  const updateSlot = (i, k, v) =>
    set(
      "schedule",
      form.schedule.map((s, idx) => (idx === i ? { ...s, [k]: v } : s))
    );

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        priority: Number(form.priority) || 5,
        spots_per_hour: Number(form.spots_per_hour) || 4,
        spot_duration_sec: Number(form.spot_duration_sec) || 30,
        schedule: form.schedule.map((s) => ({
          day_of_week: Number(s.day_of_week),
          start_time: s.start_time,
          end_time: s.end_time,
        })),
      };
      if (isEdit) {
        await api.put(`/admin/advertisers/${initial.id}`, payload);
        toast.success(t.admin.updated);
      } else {
        await api.post("/admin/advertisers", payload);
        toast.success(t.admin.created);
      }
      onSaved && onSaved();
    } catch (err) {
      toast.error("Error: " + (err?.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="advertiser-form-page" className="min-h-screen bg-slate-50">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter">
            {isEdit ? t.admin.editAdvertiser : t.admin.newAdvertiser}
          </h1>
          <button
            data-testid="form-cancel-btn"
            onClick={onCancel}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 transition"
          >
            <X className="w-4 h-4" /> {t.admin.cancel}
          </button>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field testid="form-name" label="Nombre" value={form.name} onChange={(v) => set("name", v)} required />
            <Field testid="form-tagline" label="Tagline" value={form.tagline} onChange={(v) => set("tagline", v)} />
            <Field testid="form-cta" label="CTA Text" value={form.cta_text} onChange={(v) => set("cta_text", v)} />
            <Field testid="form-color" type="color" label="Color" value={form.color || "#EA580C"} onChange={(v) => set("color", v)} />
            <Field testid="form-phone" label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
            <Field testid="form-whatsapp" label="WhatsApp (sin +)" placeholder="13105550100" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} />
            <Field testid="form-address" label="Address" wide value={form.address} onChange={(v) => set("address", v)} />
            <Field testid="form-maps" label="Google Maps URL" wide value={form.maps_url} onChange={(v) => set("maps_url", v)} />
            <Field testid="form-website" label="Website URL" wide value={form.website_url} onChange={(v) => set("website_url", v)} />
            <Field testid="form-weekly-ad" label="URL del Weekly Ad (ofertas semanales — auto)" wide placeholder="https://www.mymegafoods.com/weekly-ad" value={form.weekly_ad_url} onChange={(v) => set("weekly_ad_url", v)} />
            <TextArea testid="form-description" label="Description" value={form.description} onChange={(v) => set("description", v)} />
            <TextArea testid="form-offer" label="Special Offer" value={form.special_offer} onChange={(v) => set("special_offer", v)} />
          </div>

          {form.weekly_ad_url && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3" data-testid="weekly-ad-admin-box">
              <div>
                <h4 className="text-sm font-extrabold text-emerald-900 uppercase tracking-wider">🛒 Ofertas semanales automáticas</h4>
                <p className="text-xs text-slate-600 mt-1">El sistema lee la página del cliente y muestra el folleto en su ficha. Se refresca solo varias veces al día. {!isEdit && "Guarda primero para poder actualizar manualmente."}</p>
              </div>
              {isEdit && (
                <button
                  type="button"
                  data-testid="weekly-ad-refresh-btn"
                  onClick={refreshWeeklyAd}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition active:scale-95 shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Actualizando..." : "Actualizar ahora"}
                </button>
              )}
            </div>
          )}

          {/* Banner upload */}
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Banner</span>
            <div className="mt-2 flex items-center gap-4">
              <div className="w-32 h-20 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                {form.banner_path && bannerUrl(form.banner_path) && (
                  <img src={bannerUrl(form.banner_path)} alt="banner" className="w-full h-full object-cover" />
                )}
              </div>
              <label
                data-testid="form-upload-label"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold cursor-pointer transition ${
                  uploading ? "bg-slate-200 text-slate-500" : "bg-slate-900 hover:bg-slate-800 text-white"
                }`}
              >
                <Upload className="w-4 h-4" />
                {uploading ? "Subiendo..." : t.admin.uploadBanner}
                <input
                  data-testid="form-upload-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => upload(e.target.files?.[0])}
                />
              </label>
              <input
                data-testid="form-banner-url"
                value={form.banner_path}
                placeholder="o pega URL/path"
                onChange={(e) => set("banner_path", e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          {/* Pauta — traffic settings */}
          <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-extrabold text-orange-900 uppercase tracking-wider">
                Pauta publicitaria
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Define cuántas veces y por cuánto tiempo aparece este anuncio durante sus franjas activas.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.15em] text-slate-700">
                  Repeticiones / hora
                </span>
                <input
                  data-testid="form-spots-per-hour"
                  type="number"
                  min="1"
                  max="60"
                  value={form.spots_per_hour ?? 4}
                  onChange={(e) => set("spots_per_hour", e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border-2 border-orange-200 bg-white focus:border-orange-500 focus:outline-none transition"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Cada {form.spots_per_hour ? Math.round(60 / form.spots_per_hour) : "—"} min
                </p>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.15em] text-slate-700">
                  Duración del spot (seg)
                </span>
                <input
                  data-testid="form-spot-duration"
                  type="number"
                  min="5"
                  max="600"
                  value={form.spot_duration_sec ?? 30}
                  onChange={(e) => set("spot_duration_sec", e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border-2 border-orange-200 bg-white focus:border-orange-500 focus:outline-none transition"
                />
                <p className="text-[10px] text-slate-500 mt-1">Tiempo visible cada vez</p>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.15em] text-slate-700">
                  Prioridad (1–10)
                </span>
                <input
                  data-testid="form-priority"
                  type="number"
                  min="1"
                  max="10"
                  value={form.priority ?? 5}
                  onChange={(e) => set("priority", e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border-2 border-orange-200 bg-white focus:border-orange-500 focus:outline-none transition"
                />
                <p className="text-[10px] text-slate-500 mt-1">Más alto gana solapes</p>
              </label>
            </div>
            <p className="text-xs text-orange-900 bg-orange-100 rounded-lg px-3 py-2 mt-3">
              📊 <b>Resumen:</b>{" "}
              {form.spots_per_hour || 4} spots/h × {form.spot_duration_sec || 30}s ={" "}
              <b>
                {Math.round(((form.spots_per_hour || 4) * (form.spot_duration_sec || 30) / 3600) * 100)}%
              </b>{" "}
              del tiempo visible · prioridad {form.priority || 5}
            </p>
          </div>

          {/* Schedule */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">{t.admin.schedule}</span>
              <button
                type="button"
                data-testid="form-add-slot"
                onClick={addSlot}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-100 hover:bg-orange-200 text-orange-700 transition"
              >
                <Plus className="w-3.5 h-3.5" /> {t.admin.addSlot}
              </button>
            </div>
            <div className="space-y-2">
              {form.schedule.map((s, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 bg-slate-50 rounded-xl p-2">
                  <select
                    data-testid={`form-slot-day-${i}`}
                    value={s.day_of_week}
                    onChange={(e) => updateSlot(i, "day_of_week", Number(e.target.value))}
                    className="px-3 py-2 rounded-lg border-2 border-slate-200 bg-white text-sm font-bold"
                  >
                    {t.days.map((d, idx) => (
                      <option key={idx} value={idx}>{d}</option>
                    ))}
                  </select>
                  <input
                    data-testid={`form-slot-start-${i}`}
                    type="time"
                    value={s.start_time}
                    onChange={(e) => updateSlot(i, "start_time", e.target.value)}
                    className="px-3 py-2 rounded-lg border-2 border-slate-200 bg-white text-sm"
                  />
                  <span className="text-slate-500 text-sm">→</span>
                  <input
                    data-testid={`form-slot-end-${i}`}
                    type="time"
                    value={s.end_time}
                    onChange={(e) => updateSlot(i, "end_time", e.target.value)}
                    className="px-3 py-2 rounded-lg border-2 border-slate-200 bg-white text-sm"
                  />
                  <button
                    type="button"
                    data-testid={`form-slot-remove-${i}`}
                    onClick={() => removeSlot(i)}
                    className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {form.schedule.length === 0 && (
                <p className="text-sm text-slate-500">Sin horario. El anunciante solo se mostrará si lo activas manualmente.</p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              data-testid="form-cancel-btn-bottom"
              className="px-5 py-2.5 rounded-full text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 transition"
            >
              {t.admin.cancel}
            </button>
            <button
              type="submit"
              data-testid="form-save-btn"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white transition active:scale-95"
            >
              <Save className="w-4 h-4" />
              {saving ? "..." : t.admin.save}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, testid, wide, required }) {
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">{label}</span>
      <input
        data-testid={testid}
        type={type}
        value={value || ""}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, testid }) {
  return (
    <label className="block md:col-span-2">
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">{label}</span>
      <textarea
        data-testid={testid}
        value={value || ""}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition resize-y"
      />
    </label>
  );
}
