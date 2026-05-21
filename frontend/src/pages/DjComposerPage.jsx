import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { Composer } from "./DjStudio";

export default function DjComposerPage({ mode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [templates, setTemplates] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);

  const isEdit = mode === "edit";

  useEffect(() => {
    if (user === null) navigate("/login");
  }, [user, navigate]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const requests = [api.get("/dj/templates")];
        if (isEdit) requests.push(api.get("/dj/drafts"));
        const responses = await Promise.all(requests);
        if (cancelled) return;
        setTemplates(responses[0].data || []);
        if (isEdit) {
          const found = (responses[1].data || []).find((d) => d.id === id);
          if (!found) {
            toast.error("Borrador no encontrado");
            navigate("/dj");
            return;
          }
          setDraft(found);
        }
      } catch (e) {
        if (!cancelled) toast.error(e?.response?.data?.detail || "Error al cargar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (user && (user.role === "dj" || user.role === "admin" || user.role === "super_admin")) load();
    return () => { cancelled = true; };
  }, [user, isEdit, id, navigate]);

  if (!user || (user.role !== "dj" && user.role !== "admin" && user.role !== "super_admin")) {
    return <div className="min-h-screen p-10 text-slate-500">…</div>;
  }

  return (
    <div
      data-testid="dj-composer-page"
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
    >
      <button
        type="button"
        onClick={() => navigate("/dj")}
        data-testid="dj-composer-back"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-orange-600 mb-4 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Volver al Studio
      </button>

      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-extrabold uppercase tracking-[0.2em] mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          {isEdit ? "Editar borrador" : "Nuevo post"}
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">
          {isEdit ? "Edita tu post" : "Crea contenido con IA"}
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando…
        </div>
      ) : (
        <Composer
          mode={isEdit ? "edit" : "new"}
          initial={draft}
          templates={templates}
          onClose={() => navigate("/dj")}
          onSaved={() => navigate("/dj")}
        />
      )}
    </div>
  );
}
