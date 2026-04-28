import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Phone, MessageCircle, MapPin, Sparkles, ChevronUp, ChevronDown } from "lucide-react";
import { useStation } from "../contexts/StationContext";
import { useLanguage } from "../contexts/LanguageContext";
import { telLink, waLink, mapsLink } from "../lib/api";

export default function SmartCTA() {
  const { active, settings } = useStation();
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (active) setExpanded(true);
  }, [active?.id]);

  if (!active) return null;

  const wa = waLink(active.whatsapp || settings?.station_whatsapp, t.home.heardOnRadio + " — " + active.name);
  const tel = telLink(active.phone);
  const maps = mapsLink(active);

  return (
    <div
      data-testid="smart-cta"
      className="fixed left-2 right-2 sm:left-4 sm:right-auto bottom-[136px] sm:bottom-28 z-40 mx-auto sm:mx-0 max-w-md"
    >
      <div
        className="rounded-3xl shadow-2xl shadow-slate-900/20 border border-white/30 overflow-hidden text-white rise-in"
        style={{ backgroundColor: active.color || "#EA580C" }}
      >
        <button
          data-testid="smart-cta-toggle"
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/10 transition"
        >
          <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </span>
          <span className="flex-1 text-left">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.25em] opacity-90">
              {t.home.activeBadge}
            </span>
            <span className="block font-bold truncate">{active.name}</span>
          </span>
          {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>

        {expanded && (
          <div className="px-4 pb-4 pt-1 flex flex-col gap-2">
            {active.special_offer && (
              <p className="text-sm opacity-95 leading-snug" data-testid="smart-cta-offer">
                {active.special_offer}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {tel && (
                <a
                  href={tel}
                  data-testid="smart-cta-call"
                  className="flex flex-col items-center gap-1 bg-white text-slate-900 rounded-xl px-2 py-3 text-xs font-bold hover:bg-amber-50 transition active:scale-95"
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
                  className="flex flex-col items-center gap-1 bg-[#25D366] text-white rounded-xl px-2 py-3 text-xs font-bold hover:bg-[#16A34A] transition active:scale-95"
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
                  className="flex flex-col items-center gap-1 bg-white text-slate-900 rounded-xl px-2 py-3 text-xs font-bold hover:bg-amber-50 transition active:scale-95"
                >
                  <MapPin className="w-4 h-4" />
                  {t.home.directions}
                </a>
              )}
            </div>
            <Link
              to={`/a/${active.slug}`}
              data-testid="smart-cta-visit"
              className="text-center text-xs font-bold underline underline-offset-2 mt-1"
            >
              {t.home.visitPage} →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
