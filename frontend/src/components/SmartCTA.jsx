import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Phone, MessageCircle, MapPin, Sparkles, ChevronUp, ChevronDown, X } from "lucide-react";
import { useStation } from "../contexts/StationContext";
import { useLanguage } from "../contexts/LanguageContext";
import { telLink, waLink, mapsLink, bannerUrl } from "../lib/api";

export default function SmartCTA() {
  const { active, settings } = useStation();
  const { t } = useLanguage();
  const location = useLocation();
  const [expanded, setExpanded] = useState(true);
  const [dismissedId, setDismissedId] = useState(null);

  useEffect(() => {
    if (active) setExpanded(true);
  }, [active?.id]);

  if (!active) return null;
  // Hide on login and admin to reduce visual clutter
  if (location.pathname.startsWith("/login") || location.pathname.startsWith("/admin")) return null;
  if (dismissedId === active.id) return null;

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
      className="fixed left-2 right-2 sm:left-4 sm:right-auto bottom-[136px] sm:bottom-28 z-40 mx-auto sm:mx-0 max-w-sm"
    >
      <div className="rounded-3xl shadow-2xl shadow-slate-900/30 border border-white/20 overflow-hidden bg-white rise-in">
        {/* Banner image (horizontal) */}
        {expanded && banner && (
          <div className="relative aspect-[16/9] w-full overflow-hidden">
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
            {/* Close */}
            <button
              data-testid="smart-cta-close"
              onClick={(e) => {
                e.stopPropagation();
                setDismissedId(active.id);
              }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center transition active:scale-95 shadow-md"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header / toggle bar (always visible) */}
        <button
          data-testid="smart-cta-toggle"
          onClick={() => setExpanded((e) => !e)}
          className={`w-full flex items-center gap-3 px-4 py-3 text-white transition ${
            expanded ? "hover:brightness-110" : "hover:brightness-95"
          }`}
          style={{ backgroundColor: color }}
        >
          {!expanded && (
            <span className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
          )}
          <span className="flex-1 text-left">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.25em] opacity-90">
              {t.home.activeBadge}
            </span>
            <span className="block font-extrabold truncate text-base">{active.name}</span>
          </span>
          {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>

        {/* Info + actions */}
        {expanded && (
          <div className="px-4 pt-3 pb-4 bg-white flex flex-col gap-3">
            {active.tagline && (
              <p className="font-script text-2xl leading-none text-slate-900 -rotate-1">
                {active.tagline}
              </p>
            )}
            {active.special_offer && (
              <p
                className="text-sm font-semibold text-slate-700 leading-snug"
                data-testid="smart-cta-offer"
              >
                {active.special_offer}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {tel && (
                <a
                  href={tel}
                  data-testid="smart-cta-call"
                  className="flex flex-col items-center gap-1 text-white rounded-xl px-2 py-3 text-xs font-bold hover:brightness-110 transition active:scale-95 shadow-md"
                  style={{ backgroundColor: color }}
                >
                  <Phone className="w-4 h-4" />
                  {t.home.callNow}
                </a>
              )}
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="smart-cta-whatsapp"
                  className="flex flex-col items-center gap-1 bg-[#25D366] text-white rounded-xl px-2 py-3 text-xs font-bold hover:bg-[#16A34A] transition active:scale-95 shadow-md"
                >
                  <MessageCircle className="w-4 h-4" />
                  {t.home.whatsapp}
                </a>
              )}
              {maps && (
                <a
                  href={maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="smart-cta-directions"
                  className="flex flex-col items-center gap-1 bg-slate-900 text-white rounded-xl px-2 py-3 text-xs font-bold hover:bg-slate-800 transition active:scale-95 shadow-md"
                >
                  <MapPin className="w-4 h-4" />
                  {t.home.directions}
                </a>
              )}
            </div>
            <Link
              to={`/a/${active.slug}`}
              data-testid="smart-cta-visit"
              className="text-center text-xs font-bold text-slate-600 hover:text-slate-900 underline underline-offset-2"
            >
              {t.home.visitPage} →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
