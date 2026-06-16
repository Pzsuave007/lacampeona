import React from "react";
import {
  Headphones,
  MessageCircle,
  Phone,
  Disc3,
  Mic2,
  Facebook,
  Instagram,
  Clock,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { bannerUrl, waLink, telLink } from "../lib/api";

const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatScheduleShort(slots, lang) {
  if (!slots || slots.length === 0) return "";
  const days = lang === "es" ? DAYS_ES : DAYS_EN;
  // group identical time ranges
  const byRange = new Map();
  slots.forEach((s) => {
    const key = `${s.start_time}-${s.end_time}`;
    if (!byRange.has(key)) byRange.set(key, []);
    byRange.get(key).push(s.day_of_week);
  });
  const parts = [];
  for (const [range, ds] of byRange.entries()) {
    ds.sort((a, b) => a - b);
    // compress consecutive
    let groups = [];
    let cur = [ds[0]];
    for (let i = 1; i < ds.length; i++) {
      if (ds[i] === ds[i - 1] + 1) cur.push(ds[i]);
      else {
        groups.push(cur);
        cur = [ds[i]];
      }
    }
    groups.push(cur);
    const label = groups
      .map((g) => (g.length > 1 ? `${days[g[0]]}–${days[g[g.length - 1]]}` : days[g[0]]))
      .join(", ");
    parts.push(`${label} ${range}`);
  }
  return parts.join(" · ");
}

export default function HostHero({ host, stationName, stationTagline }) {
  const { t, lang } = useLanguage();
  const photo = host.photo_path ? bannerUrl(host.photo_path) : "";
  const color = host.color || "#7F1D1D";
  // The program currently on air (per-slot) takes priority over the host's
  // generic show_name, so the hero changes with the day/time automatically.
  const liveShow = (host.current_program || "").trim() || host.show_name;
  // No pre-filled message: open a blank chat so listeners can send their own
  // text, photos or audio to the DJ.
  const wa = waLink(host.whatsapp);
  const tel = telLink(host.phone);
  const scheduleStr = formatScheduleShort(host.schedule, lang);

  return (
    <section
      data-testid="host-hero"
      className="relative overflow-hidden bg-[#3F0A0A]"
    >
      {/* Photo background */}
      {photo && (
        <div
          className="absolute inset-0 bg-center bg-cover"
          style={{ backgroundImage: `url(${photo})` }}
          aria-hidden
        />
      )}
      {/* Dark wine tint overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(110deg, ${color}f2 0%, ${color}c4 45%, ${color}70 70%, transparent 100%)`,
        }}
      />
      {/* Bottom vignette for legibility */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
      <div className="absolute inset-0 stripes-y opacity-[0.06] pointer-events-none" />
      {/* Decorative blob */}
      <div className="absolute -top-24 -right-24 w-[30rem] h-[30rem] rounded-full bg-amber-400/20 blur-3xl blob-b pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-12 sm:pt-12 sm:pb-16 md:pt-20 md:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-10 items-end">
          {/* Mobile-only DJ portrait card (above the text) */}
          <div className="lg:hidden -mx-2">
            <div className="relative">
              <div
                className="absolute -inset-2 rounded-3xl tilt-r"
                style={{ backgroundColor: "#FCD34D" }}
              />
              <div className="relative bg-white p-2 rounded-3xl shadow-2xl">
                {photo ? (
                  <img
                    src={photo}
                    alt={host.name}
                    className="w-full aspect-[16/10] object-cover rounded-2xl"
                  />
                ) : (
                  <div className="w-full aspect-[16/10] bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400">
                    <Mic2 className="w-12 h-12" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Left: Host info */}
          <div className="lg:col-span-7 text-white rise-in">
            <span className="inline-flex items-center gap-2 bg-amber-300 text-[#3F0A0A] px-3 py-1.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] shadow-md mb-4 sm:mb-5 ring-1 ring-black/10">
              <Mic2 className="w-3.5 h-3.5" />
              {lang === "es" ? "AL AIRE AHORA" : "ON AIR NOW"}
              <span className="hidden sm:inline">· {stationName}</span>
            </span>

            <p className="font-script text-2xl sm:text-3xl lg:text-4xl text-amber-200 -rotate-2 mb-1">
              {lang === "es" ? "con" : "with"}
            </p>
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.95] drop-shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
              data-testid="host-hero-name"
            >
              {host.name}
            </h1>

            {liveShow && (
              <p className="mt-3 sm:mt-4 text-xl sm:text-2xl lg:text-3xl font-extrabold text-amber-300 tracking-tight">
                “{liveShow}”
              </p>
            )}

            {host.tagline && (
              <p className="mt-2 sm:mt-3 text-base sm:text-lg lg:text-xl text-white/90 font-semibold max-w-xl">
                {host.tagline}
              </p>
            )}

            {host.bio && (
              <p className="mt-3 sm:mt-4 text-sm sm:text-base text-white/80 leading-relaxed max-w-xl">
                {host.bio}
              </p>
            )}

            {scheduleStr && (
              <p className="mt-4 sm:mt-5 inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-200 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 sm:px-4 py-1.5 sm:py-2">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {scheduleStr}
              </p>
            )}

            {/* Buttons: stacked on mobile, inline on sm+ */}
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:gap-3">
              <button
                onClick={() => {
                  const btn = document.querySelector('[data-testid="player-play-btn"]');
                  btn && btn.click();
                }}
                data-testid="host-hero-listen"
                className="group inline-flex items-center justify-center gap-2 bg-amber-300 hover:bg-amber-400 text-[#3F0A0A] font-black rounded-full px-6 sm:px-7 py-3.5 sm:py-4 shadow-[0_15px_40px_rgba(252,211,77,0.25)] transition hover:-translate-y-1 active:scale-95 ring-1 ring-black/5 w-full sm:w-auto"
              >
                <Headphones className="w-5 h-5 group-hover:scale-110 transition" />
                {t.home.ctaListen}
              </button>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="host-hero-wa"
                  className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#16A34A] text-white font-bold rounded-full px-6 sm:px-7 py-3.5 sm:py-4 shadow-[0_15px_40px_rgba(37,211,102,0.3)] transition hover:-translate-y-1 active:scale-95 w-full sm:w-auto"
                >
                  <MessageCircle className="w-5 h-5" />
                  {lang === "es" ? "Mándale WhatsApp" : "WhatsApp the DJ"}
                </a>
              )}
              <div className="flex gap-2 sm:contents">
                {tel && (
                  <a
                    href={tel}
                    data-testid="host-hero-call"
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md border border-white/25 hover:bg-white/20 text-white font-bold rounded-full px-5 sm:px-7 py-3.5 sm:py-4 transition hover:-translate-y-1 active:scale-95"
                  >
                    <Phone className="w-5 h-5" />
                    <span className="hidden sm:inline">
                      {lang === "es" ? "Llama al estudio" : "Call the studio"}
                    </span>
                    <span className="sm:hidden">{lang === "es" ? "Llamar" : "Call"}</span>
                  </a>
                )}
                {(host.facebook || host.instagram) && (
                  <div className="inline-flex items-center gap-2">
                    {host.facebook && (
                      <a
                        href={host.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="host-hero-fb"
                        aria-label="Facebook"
                        className="w-12 h-12 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/25 text-white flex items-center justify-center hover:bg-white/20 transition active:scale-95 shrink-0"
                      >
                        <Facebook className="w-5 h-5" />
                      </a>
                    )}
                    {host.instagram && (
                      <a
                        href={host.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="host-hero-ig"
                        aria-label="Instagram"
                        className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/25 text-white flex items-center justify-center hover:bg-white/20 transition active:scale-95 shrink-0"
                      >
                        <Instagram className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Mini stats band */}
            <div className="mt-7 sm:mt-10 flex flex-wrap gap-x-6 gap-y-3 sm:gap-x-8 sm:gap-y-4 text-white/95 pt-5 sm:pt-6 border-t border-white/10 max-w-xl">
              <span className="flex items-baseline gap-1.5 sm:gap-2">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter text-amber-300">
                  880
                </span>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                  AM
                </span>
              </span>
              <span className="flex items-baseline gap-1.5 sm:gap-2">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter text-amber-300">
                  103.9
                </span>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                  FM
                </span>
              </span>
              <span className="flex items-baseline gap-1.5 sm:gap-2">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter text-amber-300">
                  {stationTagline ? "¡LIVE!" : "24/7"}
                </span>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                  {lang === "es" ? "En vivo" : "Live"}
                </span>
              </span>
            </div>
          </div>

          {/* Right: Framed portrait — desktop only */}
          <div className="lg:col-span-5 relative hidden lg:block">
            <div className="relative">
              <div
                className="absolute -inset-4 rounded-[2rem] tilt-r"
                style={{ backgroundColor: "#FCD34D" }}
              />
              <div className="relative bg-white p-3 rounded-[1.75rem] shadow-2xl">
                {photo ? (
                  <img
                    src={photo}
                    alt={host.name}
                    className="w-full aspect-[4/5] object-cover rounded-2xl"
                  />
                ) : (
                  <div className="w-full aspect-[4/5] bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400">
                    <Mic2 className="w-16 h-16" />
                  </div>
                )}
                <div className="mt-3 px-2 pb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-full bg-[#3F0A0A] flex items-center justify-center">
                      <Disc3 className="w-4 h-4 text-amber-300 vinyl-spin" />
                    </span>
                    <div className="leading-tight">
                      <p className="text-[9px] uppercase tracking-[0.2em] text-[#7F1D1D] font-extrabold">
                        {lang === "es" ? "Ahora suena" : "On air"}
                      </p>
                      <p className="font-extrabold text-sm text-slate-900">
                        {liveShow || host.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-end gap-1 h-5" style={{ color: "#7F1D1D" }}>
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className="eq-bar" style={{ height: 14 + (i % 3) * 3 }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
