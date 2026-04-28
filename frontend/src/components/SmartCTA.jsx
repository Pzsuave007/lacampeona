import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Phone, MessageCircle, MapPin, Sparkles, ChevronUp, Minus } from "lucide-react";
import { useStation } from "../contexts/StationContext";
import { useLanguage } from "../contexts/LanguageContext";
import { telLink, waLink, mapsLink, bannerUrl } from "../lib/api";

export default function SmartCTA() {
  const { active, settings } = useStation();
  const { t } = useLanguage();
  const location = useLocation();
  // Start collapsed on mobile (less invasive), expanded on desktop
  const isMobile = () =>
    typeof window !== "undefined" && window.innerWidth < 640;
  const [expanded, setExpanded] = useState(() => !isMobile());

  useEffect(() => {
    if (active) setExpanded(!isMobile());
  }, [active?.id]);

  if (!active) return null;
  // Hide on login and admin to reduce visual clutter
  if (location.pathname.startsWith("/login") || location.pathname.startsWith("/admin")) return null;

  const wa = waLink(
    active.whatsapp || settings?.station_whatsapp,
    `${t.home.heardOnRadio} — ${active.name}`
  );
  const tel = telLink(active.phone);
  const maps = mapsLink(active);
  const banner = active.banner_path ? bannerUrl(active.banner_path) : "";
  const color = active.color || "#EA580C";

  return (
    <div
      data-testid="smart-cta"
      className="fixed right-2 left-auto sm:left-4 sm:right-auto bottom-[136px] sm:bottom-28 z-40 w-[min(320px,calc(100vw-1rem))] sm:w-auto sm:max-w-sm"
    >
      <div className="rounded-2xl sm:rounded-3xl shadow-2xl shadow-slate-900/30 border border-white/20 overflow-hidden bg-white rise-in">
        {/* Banner image (horizontal) - compact on mobile */}
        {expanded && banner && (
          <div className="relative aspect-[21/9] sm:aspect-[16/9] w-full overflow-hidden">
            <img
              src={banner}
              alt={active.name}
              className="w-full h-full object-cover"
            />
            {/* Color-tinted overlay */}
            <div
              className="absolute inset-0 mix-blend-multiply opacity-30"
              style={{ backgroundColor: color }}
            />
            {/* Bottom gradient for legibility */}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
            {/* Promo badge */}
            <span
              className="absolute top-3 left-3 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-md"
              style={{ backgroundColor: color }}
            >
              <Sparkles className="w-3 h-3" />
              {t.home.activeBadge}
            </span>
            {/* Minimize button (top-right, where X used to be) */}
            <button
              data-testid="smart-cta-minimize"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(false);
              }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center transition active:scale-95 shadow-md"
              aria-label="Minimizar"
              title="Minimizar"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header / toggle bar (always visible) - tap to minimize/expand */}
        <button
          data-testid="smart-cta-toggle"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? "Minimizar" : "Expandir"}
          className={`w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-white transition ${
            expanded ? "hover:brightness-110" : "hover:brightness-95"
          }`}
          style={{ backgroundColor: color }}
        >
          {!expanded && (
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/25 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
          )}
          <span className="flex-1 text-left min-w-0">
            <span className="block text-[9px] sm:text-[10px] font-extrabold uppercase tracking-[0.2em] sm:tracking-[0.25em] opacity-90">
              {t.home.activeBadge}
              {!expanded && (
                <span className="opacity-75 normal-case tracking-normal font-bold">
                  {" · "}
                  {t.home.tapToOpen}
                </span>
              )}
            </span>
            <span className="block font-extrabold truncate text-sm sm:text-base leading-tight">
              {active.name}
            </span>
            {!expanded && active.special_offer && (
              <span
                data-testid="smart-cta-collapsed-offer"
                className="block text-[11px] sm:text-xs font-semibold opacity-95 truncate leading-tight mt-0.5"
              >
                {active.special_offer}
              </span>
            )}
          </span>
          <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            {expanded ? (
              <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </span>
        </button>

        {/* Info + actions */}
        {expanded && (
          <div className="px-3 sm:px-4 pt-2.5 sm:pt-3 pb-3 sm:pb-4 bg-white flex flex-col gap-2.5 sm:gap-3">
            {active.tagline && (
              <p className="font-script text-xl sm:text-2xl leading-none text-slate-900 -rotate-1">
                {active.tagline}
              </p>
            )}
            {active.special_offer && (
              <p
                className="text-xs sm:text-sm font-semibold text-slate-700 leading-snug line-clamp-2"
                data-testid="smart-cta-offer"
              >
                {active.special_offer}
              </p>
            )}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {tel && (
                <a
                  href={tel}
                  data-testid="smart-cta-call"
                  className="flex flex-col items-center gap-0.5 sm:gap-1 text-white rounded-lg sm:rounded-xl px-2 py-2 sm:py-3 text-[11px] sm:text-xs font-bold hover:brightness-110 transition active:scale-95 shadow-md"
                  style={{ backgroundColor: color }}
                >
                  <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {t.home.callNow}
                </a>
              )}
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="smart-cta-whatsapp"
                  className="flex flex-col items-center gap-0.5 sm:gap-1 bg-[#25D366] text-white rounded-lg sm:rounded-xl px-2 py-2 sm:py-3 text-[11px] sm:text-xs font-bold hover:bg-[#16A34A] transition active:scale-95 shadow-md"
                >
                  <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {t.home.whatsapp}
                </a>
              )}
              {maps && (
                <a
                  href={maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="smart-cta-directions"
                  className="flex flex-col items-center gap-0.5 sm:gap-1 bg-slate-900 text-white rounded-lg sm:rounded-xl px-2 py-2 sm:py-3 text-[11px] sm:text-xs font-bold hover:bg-slate-800 transition active:scale-95 shadow-md"
                >
                  <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {t.home.directions}
                </a>
              )}
            </div>
            <Link
              to={`/a/${active.slug}`}
              data-testid="smart-cta-visit"
              className="text-center text-[11px] sm:text-xs font-bold text-slate-600 hover:text-slate-900 underline underline-offset-2"
            >
              {t.home.visitPage} →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
