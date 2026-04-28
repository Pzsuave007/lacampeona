import React from "react";
import { Phone, MessageCircle, MapPin, Eye, MousePointerClick, TrendingUp, Ticket, ExternalLink } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const KIND_META = {
  call: { label: "Llamadas", icon: Phone, color: "#EA580C" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "#25D366" },
  directions: { label: "Direcciones", icon: MapPin, color: "#0F172A" },
  visit: { label: "Ver más", icon: ExternalLink, color: "#7F1D1D" },
  tickets: { label: "Boletos", icon: Ticket, color: "#B45309" },
};

function StatCard({ icon: Icon, label, value, sub, color = "#7F1D1D" }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
          style={{ backgroundColor: color }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          {label}
        </p>
      </div>
      <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function shortDate(ds) {
  const [, m, d] = ds.split("-").map(Number);
  return `${d}/${m}`;
}

export default function ReportDashboard({ stats, entityName, entityType }) {
  if (!stats) return null;
  const { totals = {}, impressions = 0, clicks = 0, ctr = 0, series = [], days = 30 } = stats;
  const ctrPct = (ctr * 100).toFixed(1);

  // Aggregate series data for the chart
  const chartData = series.map((d) => ({
    date: shortDate(d.date),
    impresiones: d.impression || 0,
    clicks: (d.call || 0) + (d.whatsapp || 0) + (d.directions || 0) + (d.visit || 0) + (d.tickets || 0),
  }));

  const kindEntries = Object.entries(KIND_META).filter(([k]) => (totals[k] || 0) > 0 || k !== "tickets");

  return (
    <div data-testid="report-dashboard" className="space-y-6">
      {/* Top-line metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={Eye}
          label="Impresiones"
          value={impressions.toLocaleString("es-MX")}
          sub={`Últimos ${days} días`}
          color="#7F1D1D"
        />
        <StatCard
          icon={MousePointerClick}
          label="Clicks totales"
          value={clicks.toLocaleString("es-MX")}
          sub={`Últimos ${days} días`}
          color="#EA580C"
        />
        <StatCard
          icon={TrendingUp}
          label="CTR"
          value={`${ctrPct}%`}
          sub="Clicks / Impresiones"
          color="#0E3B26"
        />
        <StatCard
          icon={Phone}
          label="Engagement"
          value={`${(totals.call || 0) + (totals.whatsapp || 0)}`}
          sub="Llamadas + WhatsApp"
          color="#25D366"
        />
      </div>

      {/* Time series chart */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-extrabold text-slate-900 inline-flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#7F1D1D]" />
            Actividad diaria
          </h3>
          <span className="text-xs text-slate-500">Últimos {days} días</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="impresiones"
                stroke="#7F1D1D"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="clicks"
                stroke="#EA580C"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Click breakdown */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-extrabold text-slate-900 inline-flex items-center gap-2 mb-4">
          <MousePointerClick className="w-4 h-4 text-orange-600" />
          Clicks por tipo
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" data-testid="report-clicks-breakdown">
          {kindEntries.map(([k, meta]) => {
            const Icon = meta.icon;
            const count = totals[k] || 0;
            const pct = clicks > 0 ? Math.round((count / clicks) * 100) : 0;
            return (
              <div
                key={k}
                data-testid={`report-clicks-${k}`}
                className="rounded-xl border border-slate-100 p-3 flex flex-col items-center text-center"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white mb-2"
                  style={{ backgroundColor: meta.color }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {meta.label}
                </p>
                <p className="text-2xl font-black text-slate-900 mt-1">{count}</p>
                <p className="text-[10px] text-slate-400">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {(impressions === 0 && clicks === 0) && (
        <p className="text-center text-sm text-slate-500 py-3">
          Aún no hay actividad registrada para {entityType === "event" ? "este evento" : "este anunciante"}. Las métricas se actualizarán automáticamente.
        </p>
      )}
    </div>
  );
}
