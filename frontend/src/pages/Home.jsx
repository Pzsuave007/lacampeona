import React from "react";
import { Link } from "react-router-dom";
import { Phone, MessageCircle, MapPin, ArrowRight, Headphones, Music, Sparkles } from "lucide-react";
import { useStation } from "../contexts/StationContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useAdvertisers } from "../hooks/useAdvertisers";
import { bannerUrl, telLink, waLink, mapsLink } from "../lib/api";

export default function Home() {
  const { active, settings } = useStation();
  const { t } = useLanguage();
  const { advertisers } = useAdvertisers();

  const stationWa = waLink(settings?.station_whatsapp, t.home.heardOnRadio);

  return (
    <div data-testid="home-page" className="min-h-screen">
      {/* Hero */}
      <section
        data-testid="home-hero"
        className="relative overflow-hidden"
        style={{
          backgroundImage: active
            ? `linear-gradient(135deg, ${active.color || "#EA580C"}ee 0%, ${active.color || "#EA580C"}99 60%, transparent 100%), url(${bannerUrl(active.banner_path)})`
            : "linear-gradient(135deg, #EA580C 0%, #F59E0B 60%, #FCD34D 100%)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          {active ? (
            <ActiveHero active={active} t={t} />
          ) : (
            <DefaultHero t={t} stationName={settings?.station_name || "Radio Latina FM"} stationWa={stationWa} />
          )}
        </div>
      </section>

      {/* Featured advertisers */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-600 mb-2">
              {t.home.heroEyebrow}
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
              {t.home.sponsorsTitle}
            </h2>
            <p className="text-slate-600 mt-2">{t.home.sponsorsSubtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="advertisers-grid">
          {advertisers.map((adv) => (
            <Link
              key={adv.id}
              to={`/a/${adv.slug}`}
              data-testid={`advertiser-card-${adv.slug}`}
              className="group bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100 transition hover:-translate-y-1 hover:shadow-2xl"
            >
              <div className="aspect-[16/9] bg-slate-100 overflow-hidden">
                {adv.banner_path ? (
                  <img
                    src={bannerUrl(adv.banner_path)}
                    alt={adv.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Music className="w-10 h-10" />
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: adv.color || "#EA580C" }}
                  />
                  <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500">
                    {adv.tagline || ""}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">{adv.name}</h3>
                {adv.special_offer && (
                  <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                    {adv.special_offer}
                  </p>
                )}
                <div className="mt-4 inline-flex items-center gap-1 text-orange-600 font-bold text-sm">
                  {t.home.visitPage} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                </div>
              </div>
            </Link>
          ))}
          {advertisers.length === 0 && (
            <p className="text-slate-500 col-span-full text-center py-10">
              {t.home.noActive}
            </p>
          )}
        </div>
      </section>

      {/* Bottom strip */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-orange-400 font-bold mb-2">
              24/7
            </p>
            <h3 className="text-2xl font-extrabold">
              {settings?.station_tagline || "El sabor de tu música"}
            </h3>
          </div>
          <a
            href={stationWa || "#"}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="footer-station-wa"
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#16A34A] text-white font-bold rounded-full px-6 py-3 transition active:scale-95"
          >
            <MessageCircle className="w-5 h-5" />
            {t.home.ctaWhatsApp}
          </a>
        </div>
      </section>
    </div>
  );
}

function DefaultHero({ t, stationName, stationWa }) {
  return (
    <div className="text-white max-w-2xl">
      <p className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-[0.25em] mb-5">
        <Headphones className="w-3.5 h-3.5" />
        {t.home.heroEyebrow}
      </p>
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95] drop-shadow-md">
        {t.home.heroTitle}
      </h1>
      <p className="mt-5 text-lg text-white/90 leading-relaxed">
        {t.home.heroSubtitle}
      </p>
      <p className="mt-3 text-white/80 font-semibold">{stationName}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="#player"
          onClick={(e) => {
            e.preventDefault();
            const btn = document.querySelector('[data-testid="player-play-btn"]');
            btn && btn.click();
          }}
          data-testid="hero-listen-btn"
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full px-6 py-3 shadow-lg transition hover:-translate-y-0.5 active:scale-95"
        >
          <Headphones className="w-5 h-5" />
          {t.home.ctaListen}
        </a>
        {stationWa && (
          <a
            href={stationWa}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="hero-wa-btn"
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#16A34A] text-white font-bold rounded-full px-6 py-3 shadow-lg transition hover:-translate-y-0.5 active:scale-95"
          >
            <MessageCircle className="w-5 h-5" />
            {t.home.ctaWhatsApp}
          </a>
        )}
      </div>
    </div>
  );
}

function ActiveHero({ active, t }) {
  const wa = waLink(active.whatsapp, `${t.home.heardOnRadio} — ${active.name}`);
  const tel = telLink(active.phone);
  const maps = mapsLink(active);

  return (
    <div className="text-white max-w-2xl rise-in">
      <span className="inline-flex items-center gap-2 bg-white text-slate-900 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-[0.25em] mb-5 shadow-md">
        <Sparkles className="w-3.5 h-3.5 text-orange-600" />
        {t.home.activeBadge}
      </span>
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95] drop-shadow-md">
        {active.name}
      </h1>
      {active.tagline && (
        <p className="mt-3 text-xl font-bold text-white/95">{active.tagline}</p>
      )}
      {active.special_offer && (
        <p className="mt-4 text-lg text-white/90 leading-relaxed">
          {active.special_offer}
        </p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        {tel && (
          <a
            href={tel}
            data-testid="hero-active-call"
            className="inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-amber-50 font-bold rounded-full px-6 py-3 shadow-lg transition hover:-translate-y-0.5 active:scale-95"
          >
            <Phone className="w-5 h-5" />
            {active.cta_text || t.home.callNow}
          </a>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="hero-active-wa"
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#16A34A] text-white font-bold rounded-full px-6 py-3 shadow-lg transition hover:-translate-y-0.5 active:scale-95"
          >
            <MessageCircle className="w-5 h-5" />
            {t.home.whatsapp}
          </a>
        )}
        {maps && (
          <a
            href={maps}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="hero-active-maps"
            className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm hover:bg-white/25 text-white font-bold rounded-full px-6 py-3 transition hover:-translate-y-0.5 active:scale-95"
          >
            <MapPin className="w-5 h-5" />
            {t.home.directions}
          </a>
        )}
        <Link
          to={`/a/${active.slug}`}
          data-testid="hero-active-visit"
          className="inline-flex items-center gap-2 text-white/90 hover:text-white font-bold rounded-full px-3 py-3 underline underline-offset-2"
        >
          {t.home.visitPage} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
