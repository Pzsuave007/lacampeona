import React, { useState } from "react";
import { Save, X, Upload, Calendar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, bannerUrl } from "../lib/api";

const empty = {
  title: "",
  description: "",
  location: "",
  event_date: "",
  end_date: "",
  start_time: "19:00",
  end_time: "23:00",
  image_path: "",
  ticket_url: "",
  category: "concierto",
  color: "#7F1D1D",
  promoted_as_cta: false,
  promote_from_date: "",
  priority: 7,
  spots_per_hour: 4,
  spot_duration_sec: 30,
};

const CATEGORIES = [
  { value: "concierto", label: "Concierto", emoji: "🎶" },
  { value: "promocion", label: "Promoción", emoji: "🎁" },
  { value: "comunidad", label: "Comunidad", emoji: "🤝" },
];

export default function AdminEventForm({ initial, onCancel, onSaved }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState({ ...empty, ...(initial || {}) });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const upload = async (file) => {
    if (!file) return null;
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post("/admin/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.path;
  };

  const uploadMain = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = await upload(file);
      if (path) set("image_path", path);
      toast.success("Imagen subida");
    } catch (e) {
      toast.error("Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  const uploadGallery = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const paths = [];
      for (const f of Array.from(files)) {
        const p = await upload(f);
        if (p) paths.push(p);
      }
      setForm((f) => ({ ...f, gallery: [...(f.gallery || []), ...paths] }));
      toast.success(`${paths.length} foto(s) agregada(s)`);
    } catch (e) {
      toast.error("Error al subir galería");
    } finally {
      setUploading(false);
    }
  };

  const removeGalleryImage = (idx) => {
    setForm((f) => ({ ...f, gallery: (f.gallery || []).filter((_, i) => i !== idx) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.event_date) {
      toast.error("Título y fecha son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        priority: Number(form.priority) || 7,
        spots_per_hour: Number(form.spots_per_hour) || 4,
        spot_duration_sec: Number(form.spot_duration_sec) || 30,
        promoted_as_cta: Boolean(form.promoted_as_cta),
        gallery: Array.isArray(form.gallery) ? form.gallery : [],
      };
      if (isEdit) {
        await api.put(`/admin/events/${initial.id}`, payload);
        toast.success("Evento actualizado");
      } else {
        await api.post("/admin/events", payload);
        toast.success("Evento creado");
      }
      onSaved && onSaved();
    } catch (err) {
      toast.error("Error: " + (err?.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="event-form-page" className="min-h-screen bg-slate-50">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter inline-flex items-center gap-3">
            <Calendar className="w-8 h-8 text-[#7F1D1D]" />
            {isEdit ? "Editar evento" : "Nuevo evento"}
          </h1>
          <button
            data-testid="event-form-cancel-btn"
            onClick={onCancel}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 transition"
          >
            <X className="w-4 h-4" /> Cancelar
          </button>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field testid="event-form-title" label="Título" wide value={form.title} onChange={(v) => set("title", v)} required />
            <Field testid="event-form-location" label="Lugar / Venue" value={form.location} onChange={(v) => set("location", v)} placeholder="Salón Aztlan" />
            <Field testid="event-form-address" label="Dirección completa (Google Maps)" value={form.address} onChange={(v) => set("address", v)} placeholder="123 Main St, Dallas, OR 97338" />
            <Field testid="event-form-date" label="Fecha de inicio" type="date" value={form.event_date} onChange={(v) => set("event_date", v)} required />
            <Field testid="event-form-end-date" label="Fecha de fin (opcional)" type="date" value={form.end_date} onChange={(v) => set("end_date", v)} placeholder="Igual que inicio si es 1 día" />
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Categoría</span>
              <select
                data-testid="event-category"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="mt-1 w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-[#7F1D1D] focus:outline-none transition bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </label>
            <Field testid="event-start" label="Hora inicio" type="time" value={form.start_time} onChange={(v) => set("start_time", v)} />
            <Field testid="event-end" label="Hora fin (último día)" type="time" value={form.end_time} onChange={(v) => set("end_time", v)} />
            <Field testid="event-tickets" label="Link a boletos / RSVP" wide value={form.ticket_url} onChange={(v) => set("ticket_url", v)} placeholder="https://eventbrite.com/..." />
            <Field testid="event-color" type="color" label="Color" value={form.color || "#7F1D1D"} onChange={(v) => set("color", v)} />
            <TextArea testid="event-description" label="Descripción" value={form.description} onChange={(v) => set("description", v)} />
          </div>

          {/* Main image upload */}
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Flyer / Imagen principal</span>
            <div className="mt-2 flex items-center gap-4 flex-wrap">
              <div className="w-32 h-20 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                {form.image_path && bannerUrl(form.image_path) && (
                  <img src={bannerUrl(form.image_path)} alt="flyer" className="w-full h-full object-cover" />
                )}
              </div>
              <label
                data-testid="event-upload-label"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold cursor-pointer transition ${
                  uploading ? "bg-slate-200 text-slate-500" : "bg-slate-900 hover:bg-slate-800 text-white"
                }`}
              >
                <Upload className="w-4 h-4" />
                {uploading ? "Subiendo..." : "Subir flyer"}
                <input
                  data-testid="event-upload-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadMain(e.target.files?.[0])}
                />
              </label>
              <input
                data-testid="event-image-url"
                value={form.image_path}
                placeholder="o pega URL/path"
                onChange={(e) => set("image_path", e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-[#7F1D1D] focus:outline-none text-sm"
              />
            </div>
          </div>

          {/* Gallery (multi-photo) */}
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                Galería ({(form.gallery || []).length})
              </span>
              <label
                data-testid="event-gallery-upload-label"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold cursor-pointer transition ${
                  uploading ? "bg-slate-200 text-slate-500" : "bg-[#7F1D1D] hover:bg-[#991B1B] text-white"
                }`}
              >
                <Upload className="w-4 h-4" />
                {uploading ? "Subiendo..." : "Agregar fotos"}
                <input
                  data-testid="event-gallery-upload-input"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => uploadGallery(e.target.files)}
                />
              </label>
            </div>
            {(form.gallery || []).length > 0 && (
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {form.gallery.map((g, i) => (
                  <div
                    key={`${g}-${i}`}
                    className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200"
                    data-testid={`event-gallery-item-${i}`}
                  >
                    <img src={bannerUrl(g)} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(i)}
                      data-testid={`event-gallery-remove-${i}`}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      aria-label="Quitar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {(form.gallery || []).length === 0 && (
              <p className="text-xs text-slate-500 mt-2 italic">
                💡 Agrega fotos extra para enriquecer la página del evento.
              </p>
            )}
          </div>

          {/* SmartCTA promotion */}
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                data-testid="event-promoted"
                type="checkbox"
                checked={Boolean(form.promoted_as_cta)}
                onChange={(e) => set("promoted_as_cta", e.target.checked)}
                className="mt-1 w-5 h-5 accent-amber-600"
              />
              <div className="flex-1">
                <p className="font-extrabold text-amber-900 inline-flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Promocionar como SmartCTA flotante
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  El evento aparecerá en el popup flotante junto a los anunciantes durante su ventana de promoción.
                </p>
              </div>
            </label>

            {form.promoted_as_cta && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 pl-8">
                <Field
                  testid="event-promote-from"
                  type="date"
                  label="Promocionar desde"
                  value={form.promote_from_date || ""}
                  onChange={(v) => set("promote_from_date", v)}
                />
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-700">
                    Spots / hora
                  </span>
                  <input
                    data-testid="event-spots"
                    type="number"
                    min="1"
                    max="60"
                    value={form.spots_per_hour ?? 4}
                    onChange={(e) => set("spots_per_hour", e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border-2 border-amber-200 bg-white focus:border-amber-500 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-700">
                    Duración (seg)
                  </span>
                  <input
                    data-testid="event-duration"
                    type="number"
                    min="5"
                    max="600"
                    value={form.spot_duration_sec ?? 30}
                    onChange={(e) => set("spot_duration_sec", e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border-2 border-amber-200 bg-white focus:border-amber-500 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-700">
                    Prioridad (1–10)
                  </span>
                  <input
                    data-testid="event-priority"
                    type="number"
                    min="1"
                    max="10"
                    value={form.priority ?? 7}
                    onChange={(e) => set("priority", e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border-2 border-amber-200 bg-white focus:border-amber-500 focus:outline-none"
                  />
                </label>
                <p className="md:col-span-4 text-[11px] text-slate-600">
                  💡 Si no defines fecha de inicio, se promociona automáticamente desde 7 días antes del evento.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              data-testid="event-form-cancel-btn-bottom"
              className="px-5 py-2.5 rounded-full text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="event-form-save-btn"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-[#7F1D1D] hover:bg-[#991B1B] disabled:opacity-60 text-white transition active:scale-95"
            >
              <Save className="w-4 h-4" />
              {saving ? "..." : "Guardar"}
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
        className="mt-1 w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-[#7F1D1D] focus:outline-none transition"
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
        className="mt-1 w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-[#7F1D1D] focus:outline-none transition resize-y"
      />
    </label>
  );
}
