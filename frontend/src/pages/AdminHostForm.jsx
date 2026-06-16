import React, { useState } from "react";
import { Save, X, Upload, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, bannerUrl } from "../lib/api";
import { useLanguage } from "../contexts/LanguageContext";

const empty = {
  name: "",
  show_name: "",
  tagline: "",
  bio: "",
  photo_path: "",
  phone: "",
  whatsapp: "",
  facebook: "",
  instagram: "",
  color: "#7F1D1D",
  schedule: [],
};

export default function AdminHostForm({ initial, onCancel, onSaved }) {
  const { t } = useLanguage();
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState({ ...empty, ...(initial || {}) });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      set("photo_path", data.path);
      toast.success("Foto subida");
    } catch (e) {
      toast.error("Error al subir foto");
    } finally {
      setUploading(false);
    }
  };

  const addSlot = () =>
    set("schedule", [
      ...form.schedule,
      { day_of_week: 0, start_time: "09:00", end_time: "12:00", program: "" },
    ]);
  const removeSlot = (i) => set("schedule", form.schedule.filter((_, idx) => idx !== i));
  const updateSlot = (i, k, v) =>
    set(
      "schedule",
      form.schedule.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)),
    );

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        schedule: form.schedule.map((s) => ({
          day_of_week: Number(s.day_of_week),
          start_time: s.start_time,
          end_time: s.end_time,
          program: (s.program || "").trim(),
        })),
      };
      if (isEdit) {
        await api.put(`/admin/hosts/${initial.id}`, payload);
        toast.success("Locutor actualizado");
      } else {
        await api.post("/admin/hosts", payload);
        toast.success("Locutor creado");
      }
      onSaved && onSaved();
    } catch (err) {
      toast.error("Error: " + (err?.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="host-form-page" className="min-h-screen bg-slate-50">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter">
            {isEdit ? "Editar locutor" : "Nuevo locutor"}
          </h1>
          <button
            data-testid="host-form-cancel-btn"
            onClick={onCancel}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 transition"
          >
            <X className="w-4 h-4" /> {t.admin.cancel}
          </button>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field testid="host-form-name" label="Nombre del locutor" value={form.name} onChange={(v) => set("name", v)} required />
            <Field testid="host-form-show" label="Nombre del programa" value={form.show_name} onChange={(v) => set("show_name", v)} />
            <Field testid="host-form-tagline" label="Eslogan" wide value={form.tagline} onChange={(v) => set("tagline", v)} />
            <Field testid="host-form-phone" label="Teléfono" value={form.phone} onChange={(v) => set("phone", v)} />
            <Field testid="host-form-whatsapp" label="WhatsApp (sin +)" placeholder="15036230244" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} />
            <Field testid="host-form-facebook" label="Facebook URL" value={form.facebook} onChange={(v) => set("facebook", v)} />
            <Field testid="host-form-instagram" label="Instagram URL" value={form.instagram} onChange={(v) => set("instagram", v)} />
            <Field testid="host-form-color" type="color" label="Color" value={form.color || "#7F1D1D"} onChange={(v) => set("color", v)} />
            <TextArea testid="host-form-bio" label="Bio / Descripción" value={form.bio} onChange={(v) => set("bio", v)} />
          </div>

          {/* Photo upload */}
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Foto</span>
            <div className="mt-2 flex items-center gap-4">
              <div className="w-20 h-24 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                {form.photo_path && bannerUrl(form.photo_path) && (
                  <img src={bannerUrl(form.photo_path)} alt="foto" className="w-full h-full object-cover" />
                )}
              </div>
              <label
                data-testid="host-form-upload-label"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold cursor-pointer transition ${
                  uploading ? "bg-slate-200 text-slate-500" : "bg-slate-900 hover:bg-slate-800 text-white"
                }`}
              >
                <Upload className="w-4 h-4" />
                {uploading ? "Subiendo..." : "Subir foto"}
                <input
                  data-testid="host-form-upload-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => upload(e.target.files?.[0])}
                />
              </label>
              <input
                data-testid="host-form-photo-url"
                value={form.photo_path}
                placeholder="o pega URL/path"
                onChange={(e) => set("photo_path", e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          {/* Schedule */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                {t.admin.schedule}
              </span>
              <button
                type="button"
                data-testid="host-form-add-slot"
                onClick={addSlot}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-100 hover:bg-orange-200 text-orange-700 transition"
              >
                <Plus className="w-3.5 h-3.5" /> {t.admin.addSlot}
              </button>
            </div>
            <div className="space-y-2">
              {form.schedule.map((s, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-2">
                  <div className="flex flex-wrap items-center gap-2">
                  <select
                    data-testid={`host-slot-day-${i}`}
                    value={s.day_of_week}
                    onChange={(e) => updateSlot(i, "day_of_week", Number(e.target.value))}
                    className="px-3 py-2 rounded-lg border-2 border-slate-200 bg-white text-sm font-bold"
                  >
                    {t.days.map((d, idx) => (
                      <option key={idx} value={idx}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <input
                    data-testid={`host-slot-start-${i}`}
                    type="time"
                    value={s.start_time}
                    onChange={(e) => updateSlot(i, "start_time", e.target.value)}
                    className="px-3 py-2 rounded-lg border-2 border-slate-200 bg-white text-sm"
                  />
                  <span className="text-slate-500 text-sm">→</span>
                  <input
                    data-testid={`host-slot-end-${i}`}
                    type="time"
                    value={s.end_time}
                    onChange={(e) => updateSlot(i, "end_time", e.target.value)}
                    className="px-3 py-2 rounded-lg border-2 border-slate-200 bg-white text-sm"
                  />
                  <button
                    type="button"
                    data-testid={`host-slot-remove-${i}`}
                    onClick={() => removeSlot(i)}
                    className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  </div>
                  <input
                    data-testid={`host-slot-program-${i}`}
                    value={s.program || ""}
                    onChange={(e) => updateSlot(i, "program", e.target.value)}
                    placeholder='Programa de esta franja (ej. "Cuenta tu Chisme")'
                    className="mt-2 w-full px-3 py-2 rounded-lg border-2 border-slate-200 bg-white focus:border-orange-500 focus:outline-none text-sm font-semibold"
                  />
                </div>
              ))}
              {form.schedule.length === 0 && (
                <p className="text-sm text-slate-500">
                  Sin horario. El locutor solo se mostrará si lo activas manualmente.
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-full text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 transition"
            >
              {t.admin.cancel}
            </button>
            <button
              type="submit"
              data-testid="host-form-save-btn"
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
