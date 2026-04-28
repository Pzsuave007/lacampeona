import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Calendar, Sparkles, Share2 } from "lucide-react";
import { api, bannerUrl } from "../lib/api";
import ReportDashboard from "../components/ReportDashboard";
import { useStation } from "../contexts/StationContext";

export default function ReportePublic() {
  const { token } = useParams();
  const { settings } = useStation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [days, setDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(false);
    (async () => {
      try {
        const { data } = await api.get(`/report/${token}?days=${days}`);
        if (!cancelled) setData(data);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, days]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-600 gap-2 px-4 text-center">
        <p className="text-lg font-bold">Reporte no disponible</p>
        <p className="text-sm text-slate-500">Verifica el link que recibiste o contacta a la radio.</p>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen p-10 text-slate-500">Cargando reporte…</div>;
  }

  const { entity, entity_type } = data;
  const isEvent = entity_type === "event";
  const name = isEvent ? entity.title : entity.name;
  const banner = entity.banner_path || entity.image_path;
  const color = entity.color || "#7F1D1D";

  return (
    <div data-testid="reporte-public" className="min-h-screen bg-slate-50 pb-32">
      {/* Hero */}
      <section
        className="relative overflow-hidden text-white"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, #0F172A 100%)`,
        }}
      >
        <div className="absolute -top-24 -right-20 w-96 h-96 rounded-full bg-amber-300/15 blur-3xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-sm overflow-hidden shrink-0">
              {banner ? (
                <img src={bannerUrl(banner)} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">
                  {isEvent ? "📅" : "★"}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-200 inline-flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                Reporte de actividad
              </p>
              <h1
                data-testid="reporte-name"
                className="mt-1 text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter leading-tight"
              >
                {name}
              </h1>
              <p className="mt-2 text-sm sm:text-base text-white/80">
                {settings?.station_name || "KWIP La Campeona"} · 880 AM · 103.9 FM
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Period selector */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mr-2">
            Periodo
          </span>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              data-testid={`reporte-period-${d}`}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                days === d
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              {d} días
            </button>
          ))}
        </div>
      </section>

      {/* Dashboard */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <ReportDashboard stats={data} entityName={name} entityType={entity_type} />
      </section>

      {/* Footer */}
      <p className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 text-center text-xs text-slate-400">
        Este reporte es generado por {settings?.station_name || "KWIP La Campeona"} para uso exclusivo del anunciante. Los datos se actualizan en tiempo real.
      </p>
    </div>
  );
}
