import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Ticket,
  Share2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { api, bannerUrl, mapsLink } from "../lib/api";
import { useLanguage } from "../contexts/LanguageContext";

const CATEGORY_META = {
  concierto: { emoji: "🎶", label: "Concierto", labelEn: "Concert" },
  promocion: { emoji: "🎁", label: "Promoción", labelEn: "Promotion" },
  comunidad: { emoji: "🤝", label: "Comunidad", labelEn: "Community" },
};

function formatDateRange(startStr, endStr, lang) {
  if (!startStr) return "";
  try {
    const [sy, sm, sd] = startStr.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd);
    const locale = lang === "es" ? "es-MX" : "en-US";
    if (!endStr || endStr === startStr) {
      return start.toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    const [ey, em, ed] = endStr.split("-").map(Number);
    const end = new Date(ey, em - 1, ed);
    if (sy === ey && sm === em) {
      const monthYear = end.toLocaleDateString(locale, { month: "long", year: "numeric" });
      const connector = lang === "es" ? " de " : " ";
      return `${sd} – ${ed}${connector}${monthYear}`;
    }
    const a = start.toLocaleDateString(locale, { day: "numeric", month: "short" });
    const b = end.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
    return `${a} – ${b}`;
  } catch {
    return startStr;
  }
}

export default function EventoLanding() {
  const { slug } = useParams();
  const { lang } = useLanguage();
  const [ev, setEv] = useState(null);
  const [error, setError] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setEv(null);
    setError(false);
    (async () => {
      try {
        const { data } = await api.get(`/events/${slug}`);
        if (!cancelled) setEv(data);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-600 gap-2">
        <p>{lang === "es" ? "Evento no encontrado." : "Event not found."}</p>
        <Link to="/eventos" className="underline text-[#7F1D1D] font-bold">
          ← {lang === "es" ? "Volver a Eventos" : "Back to Events"}
        </Link>
      </div>
    );
  }
  if (!ev) {
    return <div className="min-h-screen p-10 text-slate-500">…</div>;
  }

  const meta = CATEGORY_META[ev.category] || CATEGORY_META.concierto;
  const color = ev.color || "#7F1D1D";
  const allImages = [ev.image_path, ...(ev.gallery || [])].filter(Boolean);
  const heroImg = allImages[galleryIdx] || ev.image_path;
  const maps = mapsLink({ address: ev.address || ev.location });

  const onShare = async () => {
    const url = window.location.href;
    const title = ev.title;
    const text = `${ev.title} — ${formatDateRange(ev.event_date, ev.end_date, lang)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // user cancelled
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      alert(lang === "es" ? "¡Link copiado!" : "Link copied!");
    } catch {
      // ignore
    }
  };

  return (
    <div data-testid="evento-landing" className="min-h-screen bg-orange-50 pb-32">
      {/* Hero with main image */}
      <section className="relative">
        <div className="relative aspect-[16/8] sm:aspect-[16/6] overflow-hidden bg-slate-900">
          {heroImg ? (
            <img
              src={bannerUrl(heroImg)}
              alt={ev.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-9xl"
              style={{ backgroundColor: color, opacity: 0.7 }}
            >
              {meta.emoji}
            </div>
          )}
          {/* Dark gradient bottom */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
          {/* Color tint */}
          <div
            className="absolute inset-0 mix-blend-multiply opacity-25"
            style={{ backgroundColor: color }}
          />

          {/* Gallery navigation */}
          {allImages.length > 1 && (
            <>
              <button
                data-testid="event-gallery-prev"
                onClick={() => setGalleryIdx((i) => (i - 1 + allImages.length) % allImages.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/30 hover:bg-white/50 backdrop-blur-md text-white flex items-center justify-center transition active:scale-95"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                data-testid="event-gallery-next"
                onClick={() => setGalleryIdx((i) => (i + 1) % allImages.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/30 hover:bg-white/50 backdrop-blur-md text-white flex items-center justify-center transition active:scale-95"
                aria-label="Siguiente"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {allImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setGalleryIdx(i)}
                    data-testid={`event-gallery-dot-${i}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === galleryIdx ? "w-6 bg-white" : "w-1.5 bg-white/50"
                    }`}
                    aria-label={`Foto ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Title overlay */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 sm:-mt-40 z-10">
          <Link
            to="/eventos"
            data-testid="evento-back-link"
            className="inline-flex items-center gap-1 text-amber-200 hover:text-white text-sm font-bold mb-3"
          >
            <ChevronLeft className="w-4 h-4" />
            {lang === "es" ? "Volver a Eventos" : "Back to Events"}
          </Link>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.25em] text-white shadow-md mb-3"
            style={{ backgroundColor: color }}
          >
            {meta.emoji} {lang === "es" ? meta.label : meta.labelEn}
          </span>
          <h1
            data-testid="evento-title"
            className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter leading-[0.95] text-white drop-shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
          >
            {ev.title}
          </h1>
          <p className="mt-3 text-base sm:text-lg font-bold text-amber-200 drop-shadow-md">
            {formatDateRange(ev.event_date, ev.end_date, lang)}
          </p>
        </div>
      </section>

      {/* Main grid */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: description + gallery thumbnails */}
        <div className="lg:col-span-2 space-y-6">
          {ev.description && (
            <div
              data-testid="evento-description"
              className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 sm:p-8"
            >
              <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-3">
                {lang === "es" ? "Sobre el evento" : "About the event"}
              </h2>
              <p className="text-slate-700 leading-relaxed whitespace-pre-line text-base">
                {ev.description}
              </p>
            </div>
          )}

          {allImages.length > 1 && (
            <div
              data-testid="evento-gallery"
              className="bg-white rounded-2xl shadow-md border border-slate-100 p-6"
            >
              <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-3">
                {lang === "es" ? "Galería" : "Gallery"}
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setGalleryIdx(i);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    data-testid={`evento-gallery-thumb-${i}`}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition active:scale-95 ${
                      i === galleryIdx ? "border-[#7F1D1D] ring-2 ring-[#7F1D1D]/20" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <img src={bannerUrl(img)} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: info card with date, time, location, tickets */}
        <aside className="lg:col-span-1 space-y-4">
          {/* Date / Time card */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-[#7F1D1D] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  {lang === "es" ? "Fecha" : "Date"}
                </p>
                <p className="font-extrabold text-slate-900 leading-tight">
                  {formatDateRange(ev.event_date, ev.end_date, lang)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-[#7F1D1D] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  {lang === "es" ? "Horario" : "Hours"}
                </p>
                <p className="font-extrabold text-slate-900">
                  {ev.start_time} – {ev.end_time}
                </p>
              </div>
            </div>
            {(ev.location || ev.address) && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#7F1D1D] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    {lang === "es" ? "Ubicación" : "Location"}
                  </p>
                  <p className="font-extrabold text-slate-900 leading-tight">
                    {ev.location}
                  </p>
                  {ev.address && ev.address !== ev.location && (
                    <p className="text-sm text-slate-600 mt-0.5">{ev.address}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2.5">
            {ev.ticket_url && (
              <a
                href={ev.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="evento-tickets-btn"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-white font-extrabold transition active:scale-95 shadow-lg hover:-translate-y-0.5"
                style={{ backgroundColor: color }}
              >
                <Ticket className="w-5 h-5" />
                {lang === "es" ? "Comprar boletos" : "Get tickets"}
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            {maps && (
              <a
                href={maps}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="evento-directions-btn"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold transition active:scale-95 shadow-md hover:-translate-y-0.5"
              >
                <MapPin className="w-5 h-5" />
                {lang === "es" ? "Cómo llegar" : "Get directions"}
              </a>
            )}
            <button
              onClick={onShare}
              data-testid="evento-share-btn"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-900 font-bold transition active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              {lang === "es" ? "Compartir" : "Share"}
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}
