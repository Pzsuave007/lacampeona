import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Save, Upload, Plus, Trash2, Loader2, Mic2, Clock, CalendarDays, UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useStation } from "../contexts/StationContext";
import { api, bannerUrl } from "../lib/api";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const EMPTY = {
  show_name: "", tagline: "", bio: "", photo_path: "",
  phone: "", whatsapp: "", facebook: "", instagram: "",
  color: "#7F1D1D", schedule: [],
};

export default function DjProfilePage() {
  const { user } = useAuth();
  const { loadLiveHost } = useStation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const adminSlug = searchParams.get("host") || "";
  const [hosts, setHosts] = useState([]);
  const [host, setHost] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user === null) navigate("/login");
  }, [user, navigate]);

  // Admins get the full host list for the selector dropdown.
  useEffect(() => {
    if (!isAdmin) return;
    api.get("/hosts").then(({ data }) => setHosts(data || [])).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        // Admin viewing the picker but no host chosen yet → nothing to load.
        if (isAdmin && !adminSlug) {
          if (!cancelled) { setHost(null); setForm(EMPTY); }
          return;
        }
        const { data } = await api.get("/dj/host", {
          params: isAdmin && adminSlug ? { slug: adminSlug } : {},
        });
        if (cancelled) return;
        setHost(data.host);
        setForm(data.host ? { ...EMPTY, ...data.host } : EMPTY);
      } catch (e) {
        if (!cancelled) toast.error(e?.response?.data?.detail || "Error al cargar el perfil");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (user && (user.role === "dj" || isAdmin)) load();
    return () => { cancelled = true; };
  }, [user, isAdmin, adminSlug]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/dj/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      set("photo_path", data.path);
      toast.success("Foto subida");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al subir la foto");
    } finally {
      setUploading(false);
    }
  };

  const addSlot = () =>
    set("schedule", [
      ...form.schedule,
      { day_of_week: 0, start_time: "09:00", end_time: "11:00", program: "" },
    ]);
  const removeSlot = (i) => set("schedule", form.schedule.filter((_, idx) => idx !== i));
  const updateSlot = (i, k, v) =>
    set("schedule", form.schedule.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        show_name: form.show_name, tagline: form.tagline, bio: form.bio,
        photo_path: form.photo_path, phone: form.phone, whatsapp: form.whatsapp,
        facebook: form.facebook, instagram: form.instagram, color: form.color,
        schedule: form.schedule.map((s) => ({
          day_of_week: Number(s.day_of_week),
          start_time: s.start_time,
          end_time: s.end_time,
          program: (s.program || "").trim(),
        })),
      };
      const { data } = await api.put("/dj/host", payload, {
        params: isAdmin && adminSlug ? { slug: adminSlug } : {},
      });
      setHost(data);
      setForm({ ...EMPTY, ...data });
      loadLiveHost && loadLiveHost(); // refresh hero everywhere right away
      toast.success("✅ El espacio del locutor fue actualizado");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!user || (user.role !== "dj" && user.role !== "admin" && user.role !== "super_admin")) {
    return <div className="min-h-screen p-10 text-slate-500">…</div>;
  }

  return (
    <div data-testid="dj-profile-page" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        type="button"
        onClick={() => navigate(isAdmin ? "/admin" : "/dj")}
        data-testid="dj-profile-back"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-orange-600 mb-4 transition"
      >
        <ArrowLeft className="w-4 h-4" /> {isAdmin ? "Volver al Admin" : "Volver al Studio"}
      </button>

      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-extrabold uppercase tracking-[0.2em] mb-2">
          <UserCog className="w-3.5 h-3.5" /> {isAdmin ? "Perfil del locutor (vista admin)" : "Mi Perfil"}
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">
          {isAdmin ? "Espacio del locutor en el hero" : "Tu espacio en el hero"}
        </h1>
        <p className="text-slate-500 mt-1">
          {isAdmin
            ? "Revisa y edita el hero y los programas del locutor, tal como lo ve él. Los cambios se ven al instante en el sitio."
            : "Edita tu foto, tus datos y los programas que haces cada día. Los cambios se ven al instante en el sitio."}
        </p>
      </div>

      {isAdmin && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-6" data-testid="admin-host-picker">
          <label className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
            Elige un locutor para ver/editar su espacio
          </label>
          <select
            data-testid="admin-host-select"
            value={adminSlug}
            onChange={(e) => setSearchParams(e.target.value ? { host: e.target.value } : {})}
            className="mt-2 w-full px-4 py-2.5 rounded-xl border-2 border-amber-300 bg-white font-bold"
          >
            <option value="">— Selecciona un locutor —</option>
            {hosts.map((h) => (
              <option key={h.slug} value={h.slug}>
                {h.name}{h.show_name ? ` · ${h.show_name}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando…
        </div>
      ) : isAdmin && !adminSlug ? (
        <div data-testid="dj-profile-pick-prompt" className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-amber-200">
          <UserCog className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-900">Selecciona un locutor arriba</h3>
          <p className="text-slate-500 mt-1">Elige un locutor del menú para revisar y editar su perfil y programas.</p>
        </div>
      ) : !host ? (
        <div data-testid="dj-profile-no-host" className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-orange-200">
          <Mic2 className="w-12 h-12 text-orange-400 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-900">Aún no tienes un locutor asignado</h3>
          <p className="text-slate-500 mt-1">Pídele al administrador que te asigne un locutor para poder editar tu hero.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Identity (read-only) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden shrink-0">
              {form.photo_path && bannerUrl(form.photo_path) && (
                <img src={bannerUrl(form.photo_path)} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Locutor (lo asigna el admin)</p>
              <p className="font-black text-slate-900 truncate" data-testid="dj-profile-host-name">{host.name}</p>
            </div>
          </div>

          {/* Profile fields */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
            <h2 className="font-black text-lg text-slate-900">Tu información</h2>

            {/* Photo */}
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Foto del hero</span>
              <div className="mt-2 flex items-center gap-4">
                <div className="w-24 h-28 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                  {form.photo_path && bannerUrl(form.photo_path) && (
                    <img src={bannerUrl(form.photo_path)} alt="foto" className="w-full h-full object-cover" data-testid="dj-profile-photo-preview" />
                  )}
                </div>
                <label
                  data-testid="dj-profile-upload-label"
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold cursor-pointer transition ${uploading ? "bg-slate-200 text-slate-500" : "bg-slate-900 hover:bg-slate-800 text-white"}`}
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Subiendo..." : "Subir foto"}
                  <input
                    data-testid="dj-profile-upload-input"
                    type="file" accept="image/*" className="hidden"
                    onChange={(e) => upload(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProfileField testid="dj-profile-show" label="Nombre de tu programa" placeholder="El Show de la Jarochita" value={form.show_name} onChange={(v) => set("show_name", v)} wide />
              <ProfileField testid="dj-profile-tagline" label="Eslogan" placeholder="¡La que te pone a bailar!" value={form.tagline} onChange={(v) => set("tagline", v)} wide />
              <ProfileTextArea testid="dj-profile-bio" label="Bio / Descripción" value={form.bio} onChange={(v) => set("bio", v)} />
              <ProfileField testid="dj-profile-phone" label="Teléfono del estudio" value={form.phone} onChange={(v) => set("phone", v)} />
              <div className="md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">WhatsApp del hero</span>
                <div data-testid="dj-profile-whatsapp-note" className="mt-1 w-full px-4 py-2.5 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm text-slate-500">
                  📞 El botón de WhatsApp del hero usa el número de la <strong>cabina</strong> (lo configura el administrador en Ajustes). Es el mismo para todos los locutores.
                </div>
              </div>
              <ProfileField testid="dj-profile-facebook" label="Facebook URL" value={form.facebook} onChange={(v) => set("facebook", v)} />
              <ProfileField testid="dj-profile-instagram" label="Instagram URL" value={form.instagram} onChange={(v) => set("instagram", v)} />
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Color del hero</span>
                <input
                  data-testid="dj-profile-color"
                  type="color"
                  value={form.color || "#7F1D1D"}
                  onChange={(e) => set("color", e.target.value)}
                  className="mt-1 w-full h-11 px-2 py-1 rounded-xl border-2 border-slate-200 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Schedule / programs */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <h2 className="font-black text-lg text-slate-900 inline-flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-orange-600" /> Tus programas por día
                </h2>
                <p className="text-sm text-slate-500 mt-1">Cada franja puede tener su propio programa. El hero mostrará el de la hora actual.</p>
              </div>
              <button
                type="button"
                data-testid="dj-profile-add-slot"
                onClick={addSlot}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-100 hover:bg-orange-200 text-orange-700 transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>

            <div className="space-y-3 mt-4" data-testid="dj-profile-schedule">
              {form.schedule.map((s, i) => (
                <div key={i} data-testid={`dj-slot-${i}`} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      data-testid={`dj-slot-day-${i}`}
                      value={s.day_of_week}
                      onChange={(e) => updateSlot(i, "day_of_week", Number(e.target.value))}
                      className="px-3 py-2 rounded-lg border-2 border-slate-200 bg-white text-sm font-bold"
                    >
                      {DAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                    </select>
                    <input
                      data-testid={`dj-slot-start-${i}`}
                      type="time" value={s.start_time}
                      onChange={(e) => updateSlot(i, "start_time", e.target.value)}
                      className="px-3 py-2 rounded-lg border-2 border-slate-200 bg-white text-sm"
                    />
                    <span className="text-slate-500 text-sm">→</span>
                    <input
                      data-testid={`dj-slot-end-${i}`}
                      type="time" value={s.end_time}
                      onChange={(e) => updateSlot(i, "end_time", e.target.value)}
                      className="px-3 py-2 rounded-lg border-2 border-slate-200 bg-white text-sm"
                    />
                    <button
                      type="button"
                      data-testid={`dj-slot-remove-${i}`}
                      onClick={() => removeSlot(i)}
                      className="ml-auto inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    data-testid={`dj-slot-program-${i}`}
                    value={s.program || ""}
                    onChange={(e) => updateSlot(i, "program", e.target.value)}
                    placeholder='Nombre del programa (ej. "Top 40 con la Jarochita")'
                    className="mt-2 w-full px-3 py-2 rounded-lg border-2 border-slate-200 focus:border-orange-500 focus:outline-none text-sm font-semibold"
                  />
                </div>
              ))}
              {form.schedule.length === 0 && (
                <p className="text-sm text-slate-500 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Sin horarios todavía. Agrega tu primer programa.
                </p>
              )}
            </div>
          </div>

          {/* Save bar */}
          <div className="sticky bottom-24 sm:bottom-4 z-10 flex justify-end">
            <button
              data-testid="dj-profile-save-btn"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-black rounded-full px-7 py-3.5 transition active:scale-95 shadow-[0_10px_30px_rgba(234,88,12,0.4)]"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileField({ label, value, onChange, placeholder, testid, wide }) {
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">{label}</span>
      <input
        data-testid={testid}
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition"
      />
    </label>
  );
}

function ProfileTextArea({ label, value, onChange, testid }) {
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
