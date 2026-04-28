import React from "react";
import { Calendar, MapPin, Clock, Ticket, ArrowRight, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useEvents } from "../hooks/useEvents";
import { useLanguage } from "../contexts/LanguageContext";
import { bannerUrl } from "../lib/api";

const CATEGORY_META = {
  concierto: { emoji: "🎶", label: "Concierto", labelEn: "Concert", color: "#7F1D1D" },
  promocion: { emoji: "🎁", label: "Promoción", labelEn: "Promotion", color: "#EA580C" },
  comunidad: { emoji: "🤝", label: "Comunidad", labelEn: "Community", color: "#0E3B26" },
};

function formatDate(dateStr, lang) {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const opts = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
    return date.toLocaleDateString(lang === "es" ? "es-MX" : "en-US", opts);
  } catch {
    return dateStr;
  }
}

function formatDateRange(startStr, endStr, lang) {
  if (!startStr) return "";
  if (!endStr || endStr === startStr) return formatDate(startStr, lang);
  try {
    const [sy, sm, sd] = startStr.split("-").map(Number);
    const [ey, em, ed] = endStr.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    const locale = lang === "es" ? "es-MX" : "en-US";
    if (sy === ey && sm === em) {
      // Same month: "5 – 7 de mayo, 2026"
      const monthYear = end.toLocaleDateString(locale, { month: "long", year: "numeric" });
      const sep = lang === "es" ? "–" : "–";
      const connector = lang === "es" ? " de " : " ";
      return `${sd} ${sep} ${ed}${connector}${monthYear}`;
    }
    const startStr2 = start.toLocaleDateString(locale, { day: "numeric", month: "short" });
    const endStr2 = end.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
    return `${startStr2} – ${endStr2}`;
  } catch {
    return `${startStr} – ${endStr}`;
  }
}

export default function Eventos() {
  const { events, loading } = useEvents();
  const { lang } = useLanguage();

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (events || []).filter((e) => (e.end_date || e.event_date || "") >= today);

  return (
    <div data-testid="eventos-page" className="min-h-screen bg-orange-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#3F0A0A] via-[#7F1D1D] to-[#991B1B] text-white">
        <div className="absolute -top-24 -right-20 w-96 h-96 rounded-full bg-amber-400/20 blur-3xl blob-b pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-rose-500/20 blur-3xl blob-a pointer-events-none" />
        <div className="absolute inset-0 stripes-y opacity-[0.06] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <Link
            to="/"
            data-testid="eventos-back-link"
            className="inline-flex items-center gap-1 text-amber-200 hover:text-amber-300 text-sm font-bold mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            {lang === "es" ? "Volver al inicio" : "Back to home"}
          </Link>
          <span className="inline-flex items-center gap-2 bg-amber-300 text-[#3F0A0A] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.25em] shadow-md mb-3">
            <Calendar className="w-3.5 h-3.5" />
            {lang === "es" ? "Cartelera La Campeona" : "La Campeona Lineup"}
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter leading-[0.95] drop-shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
            {lang === "es" ? "Próximos " : "Upcoming "}
            <span className="font-script font-normal italic text-amber-300 text-5xl sm:text-6xl md:text-7xl block -mt-1">
              {lang === "es" ? "eventos" : "events"}
            </span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-amber-100/90 max-w-2xl leading-relaxed">
            {lang === "es"
              ? "Conciertos, fiestas, promociones y eventos comunitarios respaldados por La Campeona 880 AM · 103.9 FM."
              : "Concerts, parties, promotions and community events brought to you by La Campeona 880 AM · 103.9 FM."}
          </p>
        </div>
      </section>

      {/* Events list */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {loading && (
          <p className="text-slate-500 text-center py-10">
            {lang === "es" ? "Cargando eventos..." : "Loading events..."}
          </p>
        )}
        {!loading && upcoming.length === 0 && (
          <div data-testid="no-events" className="text-center py-16">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-lg font-bold">
              {lang === "es" ? "Pronto habrá nuevos eventos." : "New events coming soon."}
            </p>
            <p className="text-slate-400 mt-1 text-sm">
              {lang === "es"
                ? "Sigue sintonizando — los anunciaremos al aire primero."
                : "Stay tuned — we'll announce them on air first."}
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 items-stretch" data-testid="events-grid">
          {upcoming.map((ev) => {
            const meta = CATEGORY_META[ev.category] || CATEGORY_META.concierto;
            return (
              <article
                key={ev.id}
                data-testid={`event-card-${ev.slug}`}
                className="group relative bg-white rounded-3xl shadow-xl shadow-slate-900/10 overflow-hidden border border-slate-100 transition duration-300 hover:-translate-y-2 hover:shadow-2xl flex flex-col"
              >
                <span
                  className="absolute z-10 top-3 right-3 wiggle px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg"
                  style={{ backgroundColor: ev.color || meta.color }}
                >
                  {meta.emoji} {lang === "es" ? meta.label : meta.labelEn}
                </span>
                <div className="aspect-[16/10] bg-slate-100 overflow-hidden shrink-0">
                  {ev.image_path ? (
                    <img
                      src={bannerUrl(ev.image_path)}
                      alt={ev.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-6xl"
                      style={{ backgroundColor: `${ev.color || meta.color}15`, color: ev.color || meta.color }}
                    >
                      {meta.emoji}
                    </div>
                  )}
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500">
                    {formatDateRange(ev.event_date, ev.end_date, lang)}
                  </p>
                  <h3 className="mt-1 text-2xl font-extrabold text-slate-900 leading-tight">
                    {ev.title}
                  </h3>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    <p className="inline-flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {ev.start_time}–{ev.end_time}
                    </p>
                    {ev.location && (
                      <p className="inline-flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        {ev.location}
                      </p>
                    )}
                  </div>
                  {ev.description && (
                    <p className="text-sm text-slate-600 mt-3 line-clamp-3 leading-relaxed">
                      {ev.description}
                    </p>
                  )}
                  {ev.ticket_url && (
                    <a
                      href={ev.ticket_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`event-tickets-${ev.slug}`}
                      className="mt-auto pt-5 inline-flex items-center gap-2 font-bold text-sm group-hover:gap-3 transition-all"
                      style={{ color: ev.color || meta.color }}
                    >
                      <Ticket className="w-4 h-4" />
                      {lang === "es" ? "Comprar boletos" : "Get tickets"}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
