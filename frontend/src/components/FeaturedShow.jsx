import React from "react";
import { Sparkles, MessageCircle, Headphones, Clock } from "lucide-react";
import { useStation } from "../contexts/StationContext";
import { useLanguage } from "../contexts/LanguageContext";
import { waLink, bannerUrl } from "../lib/api";

export default function FeaturedShow() {
  const { settings } = useStation();
  const { lang } = useLanguage();

  // Toggle: only render when admin enabled it AND a title is set
  if (!settings?.featured_show_enabled || !settings?.featured_show_title) {
    return null;
  }

  const badge =
    settings.featured_show_badge ||
    (lang === "es" ? "EXCLUSIVO EN LA CAMPEONA" : "EXCLUSIVE ON LA CAMPEONA");
  const title = settings.featured_show_title;
  const host = settings.featured_show_host;
  const description = settings.featured_show_description;
  const schedule = settings.featured_show_schedule;
  const photo = settings.featured_show_photo
    ? bannerUrl(settings.featured_show_photo)
    : null;

  const waNumber = settings.station_whatsapp || "";
  // Only show WhatsApp button when admin explicitly sets a prefill message
  // (some shows don't accept listener messages, so leave blank to hide the button)
  const waPrefill = settings.featured_show_whatsapp_text || "";
  const wa = waPrefill ? waLink(waNumber, waPrefill) : null;

  return (
    <section
      data-testid="featured-show"
      className="relative overflow-hidden bg-[#0a0a0a]"
    >
      {/* Background photo with heavy darken */}
      {photo && (
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `url(${photo})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(2px)",
          }}
          aria-hidden="true"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/40 pointer-events-none" />
      <div className="absolute -top-32 -right-24 w-[30rem] h-[30rem] rounded-full bg-orange-600/20 blur-3xl blob-a pointer-events-none" />
      <div className="absolute -bottom-24 -left-20 w-[26rem] h-[26rem] rounded-full bg-rose-500/15 blur-3xl blob-b pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Text side */}
          <div className="text-white">
            <span
              data-testid="featured-show-badge"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-300 to-orange-400 text-[#3F0A0A] px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-lg mb-5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {badge}
            </span>

            {host && (
              <p className="font-script text-2xl text-amber-300 italic mb-1 -rotate-1">
                {lang === "es" ? "con" : "with"} {host}
              </p>
            )}

            <h2
              data-testid="featured-show-title"
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95] drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
            >
              {title}
            </h2>

            {description && (
              <p className="mt-5 text-base sm:text-lg text-white/80 leading-relaxed max-w-xl">
                {description}
              </p>
            )}

            {schedule && (
              <p className="mt-5 inline-flex items-center gap-2 bg-white/10 border border-white/15 backdrop-blur-md px-4 py-2 rounded-full text-sm font-bold">
                <Clock className="w-4 h-4 text-amber-300" />
                {schedule}
              </p>
            )}

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#play"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .querySelector('[data-testid="player-play-btn"]')
                    ?.click();
                }}
                data-testid="featured-show-listen"
                className="inline-flex items-center gap-2 bg-amber-300 hover:bg-amber-400 text-[#3F0A0A] font-black rounded-full px-7 py-3.5 shadow-[0_15px_40px_rgba(252,211,77,0.3)] transition hover:-translate-y-1 active:scale-95"
              >
                <Headphones className="w-5 h-5" />
                {lang === "es" ? "Escuchar en vivo" : "Listen live"}
              </a>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="featured-show-wa"
                  className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#16A34A] text-white font-bold rounded-full px-7 py-3.5 transition hover:-translate-y-1 active:scale-95 shadow-md"
                >
                  <MessageCircle className="w-5 h-5" />
                  {lang === "es" ? "Mándale WhatsApp" : "Send WhatsApp"}
                </a>
              )}
            </div>
          </div>

          {/* Photo side */}
          {photo ? (
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-br from-amber-300/40 to-rose-500/40 rounded-3xl blur-xl" />
              <img
                src={photo}
                alt={title}
                className="relative w-full aspect-square object-cover rounded-3xl border-4 border-amber-300/60 shadow-2xl"
                data-testid="featured-show-photo"
              />
              <span className="absolute -top-3 -right-3 bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.25em] px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                🔥 Nuevo
              </span>
            </div>
          ) : (
            <div className="hidden md:flex items-center justify-center text-white/30 text-xs italic">
              Sube una foto del show desde el Admin
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
