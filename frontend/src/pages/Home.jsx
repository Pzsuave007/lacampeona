import React from "react";
import { Link } from "react-router-dom";
import {
  Phone,
  MessageCircle,
  MapPin,
  ArrowRight,
  Headphones,
  Music,
  Sparkles,
  Radio as RadioIcon,
  Disc3,
  Mic2,
} from "lucide-react";
import { useStation } from "../contexts/StationContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useAdvertisers } from "../hooks/useAdvertisers";
import { bannerUrl, telLink, waLink, mapsLink } from "../lib/api";
import MarqueeStrip from "../components/MarqueeStrip";
import HostHero from "../components/HostHero";
import { useEvents } from "../hooks/useEvents";

const HERO_BG = "https://images.pexels.com/photos/32213239/pexels-photo-32213239.jpeg";
const POLA_1 = "https://images.pexels.com/photos/4651036/pexels-photo-4651036.jpeg";
const POLA_2 = "https://images.pexels.com/photos/3851837/pexels-photo-3851837.jpeg";
const VIBE_BG = "https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg";

export default function Home() {
  const { settings, liveHost, nowPlaying } = useStation();
  const { t, lang } = useLanguage();
  const { advertisers } = useAdvertisers();
  const { events } = useEvents();

  const stationWa = waLink(settings?.station_whatsapp, t.home.heardOnRadio);
  const stationName = settings?.station_name || "KWIP La Campeona";

  const tickerEs = [
    "EN VIVO 24/7",
    "TU MÚSICA SIN PARAR",
    "PROMOS EXCLUSIVAS",
    "DESDE DALLAS, OREGON",
    "RITMO LATINO",
    "LLAMA AL ESTUDIO",
  ];
  const tickerEn = [
    "LIVE 24/7",
    "NON-STOP MUSIC",
    "EXCLUSIVE DEALS",
    "FROM DALLAS, OREGON",
    "LATIN BEATS",
    "CALL THE STUDIO",
  ];

  return (
    <div data-testid="home-page" className="min-h-screen">
      {liveHost ? (
        <HostHero
          host={liveHost}
          stationName={stationName}
          stationTagline={settings?.station_tagline}
        />
      ) : (
        <DefaultHero
          t={t}
          stationName={stationName}
          tagline={settings?.station_tagline}
          stationWa={stationWa}
          lang={lang}
          heroBg={settings?.default_hero_bg}
        />
      )}

      {/* Live ticker strip */}
      <MarqueeStrip
        items={lang === "es" ? tickerEs : tickerEn}
        color="#0F172A"
        textColor="#FACC15"
      />

      {/* Mundial 2026 teaser */}
      <MundialTeaser lang={lang} />

      {/* Upcoming events teaser */}
      {events && events.length > 0 && <EventsTeaser events={events} lang={lang} />}

      {/* Vibe / "what's the show" section with photos */}
      <VibeSection settings={settings} lang={lang} nowPlaying={nowPlaying} />

      {/* Featured advertisers */}
      <section
        id="advertisers"
        className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24"
      >
        <div className="absolute inset-0 dot-grid opacity-50 pointer-events-none" />
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-600 mb-2 inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> {t.home.heroEyebrow}
              </p>
              <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter">
                {t.home.sponsorsTitle}
              </h2>
              <p className="text-slate-600 mt-2 max-w-md">{t.home.sponsorsSubtitle}</p>
            </div>
            <div className="flex items-center gap-4">
              <p className="font-script text-3xl text-orange-600 leading-none rotate-[-4deg] hidden md:block">
                {lang === "es" ? "¡Apóyalos!" : "Support them!"}
              </p>
              <Link
                to="/anuncia"
                data-testid="sponsors-header-cta"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full px-5 py-3 transition active:scale-95 shadow-[0_10px_30px_rgba(234,88,12,0.35)] hover:-translate-y-0.5 whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                {lang === "es" ? "Anúnciate aquí" : "Advertise here"}
              </Link>
            </div>
          </div>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 items-stretch"
            data-testid="advertisers-grid"
          >
            {advertisers.map((adv) => (
              <Link
                key={adv.id}
                to={`/a/${adv.slug}`}
                data-testid={`advertiser-card-${adv.slug}`}
                className="group relative bg-white rounded-3xl shadow-xl shadow-slate-900/10 overflow-hidden border border-slate-100 transition duration-300 hover:-translate-y-2 hover:shadow-2xl flex flex-col"
              >
                {/* Sticker */}
                <span
                  className="absolute z-10 top-3 right-3 wiggle px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg"
                  style={{ backgroundColor: adv.color || "#EA580C" }}
                >
                  ★ {adv.tagline ? "Hot" : "Promo"}
                </span>

                <div className="aspect-[16/10] bg-slate-100 overflow-hidden shrink-0">
                  {adv.banner_path ? (
                    <img
                      src={bannerUrl(adv.banner_path)}
                      alt={adv.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Music className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: adv.color || "#EA580C" }}
                    />
                    <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500 truncate">
                      {adv.tagline || "Local business"}
                    </span>
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900 leading-tight">
                    {adv.name}
                  </h3>
                  {adv.special_offer && (
                    <p className="text-sm text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                      {adv.special_offer}
                    </p>
                  )}
                  <div className="mt-auto pt-5 inline-flex items-center gap-1 text-orange-600 font-bold text-sm group-hover:gap-2 transition-all">
                    {t.home.visitPage}{" "}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
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
        </div>
      </section>

      {/* Community CTA */}
      <CommunitySection
        t={t}
        lang={lang}
        stationWa={stationWa}
        tagline={settings?.station_tagline}
      />
    </div>
  );
}

/* --------------------- Default Hero --------------------- */
function DefaultHero({ t, stationName, tagline, stationWa, lang, heroBg }) {
  const bgUrl = heroBg ? bannerUrl(heroBg) : HERO_BG;
  return (
    <section
      data-testid="home-hero"
      className="relative overflow-hidden bg-gradient-to-br from-[#3F0A0A] via-[#7F1D1D] to-[#991B1B]"
    >
      {/* Decorative blobs — warm ember + gold */}
      <div className="absolute -top-24 -left-28 w-[28rem] h-[28rem] rounded-full bg-rose-600/30 blur-3xl blob-a pointer-events-none" />
      <div className="absolute top-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-amber-400/20 blur-3xl blob-b pointer-events-none" />
      <div className="absolute inset-0 stripes-y opacity-[0.06] pointer-events-none" />
      {/* Subtle top vignette */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

      {/* Background image — darkened */}
      <div
        className="absolute inset-0 opacity-[0.18] mix-blend-luminosity"
        style={{
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 sm:pt-12 sm:pb-16 md:pt-20 md:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          {/* Left: Headline */}
          <div className="lg:col-span-7 text-white rise-in">
            <span className="inline-flex items-center gap-2 bg-amber-300 text-[#3F0A0A] px-3 py-1.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] shadow-md mb-4 sm:mb-6 ring-1 ring-black/10">
              <span className="w-2 h-2 rounded-full bg-red-700 live-dot" />
              {t.live.label} · {stationName}
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.92] drop-shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
              {lang === "es" ? (
                <>
                  ¡La que
                  <br />
                  <span className="font-script font-normal italic text-amber-300 text-6xl sm:text-7xl md:text-8xl lg:text-9xl block -mt-1 sm:-mt-2">
                    manda!
                  </span>
                </>
              ) : (
                <>
                  The one that
                  <br />
                  <span className="font-script font-normal italic text-amber-300 text-6xl sm:text-7xl md:text-8xl lg:text-9xl block -mt-1 sm:-mt-2">
                    rules!
                  </span>
                </>
              )}
            </h1>
            <p className="mt-4 sm:mt-5 text-base sm:text-lg lg:text-xl text-amber-100/95 leading-snug max-w-xl font-semibold tracking-wide">
              {tagline || "880 AM · 103.9 FM"}
            </p>
            <p className="mt-2 sm:mt-3 text-sm sm:text-base text-white/80 leading-relaxed max-w-xl">
              {lang === "es"
                ? "Música regional mexicana, noticias y promociones de tus negocios favoritos — en vivo, desde Dallas, Oregon."
                : "Regional Mexican music, news, and offers from your favorite local businesses — live from Dallas, Oregon."}
            </p>
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:gap-3">
              <button
                onClick={() => {
                  const btn = document.querySelector('[data-testid="player-play-btn"]');
                  btn && btn.click();
                }}
                data-testid="hero-listen-btn"
                className="group inline-flex items-center justify-center gap-2 bg-amber-300 hover:bg-amber-400 text-[#3F0A0A] font-black rounded-full px-6 sm:px-7 py-3.5 sm:py-4 shadow-[0_15px_40px_rgba(252,211,77,0.25)] transition hover:-translate-y-1 active:scale-95 ring-1 ring-black/5 w-full sm:w-auto"
              >
                <Headphones className="w-5 h-5 group-hover:scale-110 transition" />
                {t.home.ctaListen}
              </button>
              {stationWa && (
                <a
                  href={stationWa}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="hero-wa-btn"
                  className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#16A34A] text-white font-bold rounded-full px-6 sm:px-7 py-3.5 sm:py-4 shadow-[0_15px_40px_rgba(37,211,102,0.3)] transition hover:-translate-y-1 active:scale-95 w-full sm:w-auto"
                >
                  <MessageCircle className="w-5 h-5" />
                  {t.home.ctaWhatsApp}
                </a>
              )}
              <a
                href="tel:+15036230244"
                data-testid="hero-call-btn"
                className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md border border-white/25 hover:bg-white/20 text-white font-bold rounded-full px-6 sm:px-7 py-3.5 sm:py-4 transition hover:-translate-y-1 active:scale-95 w-full sm:w-auto"
              >
                <Phone className="w-5 h-5" />
                {lang === "es" ? "Llama al estudio" : "Call the studio"}
              </a>
            </div>

            {/* Mini stats */}
            <div className="mt-7 sm:mt-10 flex flex-wrap gap-x-6 gap-y-3 sm:gap-x-8 sm:gap-y-4 text-white/95 pt-5 sm:pt-6 border-t border-white/10 max-w-xl">
              <Stat number="880" label={lang === "es" ? "AM" : "AM"} />
              <Stat number="103.9" label={lang === "es" ? "FM" : "FM"} />
              <Stat number="24/7" label={lang === "es" ? "En vivo" : "Live"} />
            </div>
          </div>

          {/* Right: Brand logo stack */}
          <div className="lg:col-span-5 relative h-[420px] hidden lg:block">
            <BrandPolaroid
              src="https://customer-assets.emergentagent.com/job_radio-ads-hub/artifacts/nebxp78j_logo_old_remake_fm-2018.png"
              caption="880 AM"
              tone="amber"
              className="absolute top-0 left-6 tilt-l w-64"
            />
            <BrandPolaroid
              src="https://customer-assets.emergentagent.com/job_radio-ads-hub/artifacts/2nch7aix_LaCampeona-fuego-logot-big%20%281%29.png"
              caption="103.9 FM"
              tone="rose"
              className="absolute top-32 right-0 tilt-r w-64"
            />
            <div className="absolute bottom-0 left-16 bg-[#3F0A0A] text-white rounded-3xl p-5 w-72 shadow-2xl rise-in rise-delay-3 border-4 border-amber-300">
              <div className="flex items-center gap-3 mb-2">
                <span className="w-10 h-10 rounded-full bg-amber-300 flex items-center justify-center">
                  <Disc3 className="w-5 h-5 text-[#3F0A0A] vinyl-spin" />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] font-extrabold text-amber-300">
                    {t.live.nowPlaying}
                  </p>
                  <p className="font-bold text-sm leading-tight">La Campeona · 880 AM</p>
                </div>
              </div>
              <div className="flex items-end gap-1 h-6 text-amber-300">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="eq-bar" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Polaroid({ src, caption, className = "" }) {
  return (
    <div
      className={`bg-white p-3 pb-5 rounded-md shadow-2xl shadow-slate-900/30 transition duration-300 cursor-default ${className}`}
    >
      <div className="aspect-square overflow-hidden rounded-sm">
        <img src={src} alt={caption} className="w-full h-full object-cover" />
      </div>
      <p className="mt-2 text-center font-script text-2xl text-slate-900">{caption}</p>
    </div>
  );
}

function BrandPolaroid({ src, caption, tone = "amber", className = "" }) {
  const toneCls = tone === "rose" ? "text-rose-600" : "text-amber-600";
  return (
    <div
      className={`bg-white p-3 pb-5 rounded-md shadow-2xl shadow-black/40 transition duration-300 cursor-default ${className}`}
    >
      <div className="aspect-square overflow-hidden rounded-sm bg-white flex items-center justify-center p-3">
        <img src={src} alt={caption} className="w-full h-full object-contain" />
      </div>
      <p className={`mt-2 text-center font-script text-3xl ${toneCls}`}>{caption}</p>
    </div>
  );
}

function Stat({ number, label }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-3xl sm:text-4xl font-black tracking-tighter text-amber-300 drop-shadow-[0_4px_20px_rgba(252,211,77,0.25)]">
        {number}
      </span>
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
        {label}
      </span>
    </div>
  );
}

function MundialTeaser({ lang }) {
  return (
    <section
      data-testid="mundial-teaser"
      className="relative overflow-hidden bg-gradient-to-br from-[#0F2A1A] via-[#0E3B26] to-[#155D32] text-white"
    >
      <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-amber-400/15 blur-3xl blob-b pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-emerald-400/15 blur-3xl blob-a pointer-events-none" />
      <div className="absolute inset-0 stripes-y opacity-[0.05] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-14 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        <div className="md:col-span-8">
          <span className="inline-flex items-center gap-2 bg-amber-300 text-[#0F2A1A] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.25em] shadow-md mb-3">
            🏆 {lang === "es" ? "Transmisión exclusiva en español" : "Exclusive Spanish broadcast"}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter leading-tight">
            {lang === "es" ? "Mundial 2026 " : "World Cup 2026 "}
            <span className="font-script font-normal italic text-amber-300 text-4xl sm:text-5xl lg:text-6xl">
              {lang === "es" ? "en La Campeona" : "on La Campeona"}
            </span>
          </h2>
          <p className="mt-2 text-white/85 max-w-xl">
            {lang === "es"
              ? "Cada partido del mundial, narrado en vivo. 🇲🇽🇺🇸🇨🇦 Junio – Julio 2026."
              : "Every World Cup match, called live. 🇲🇽🇺🇸🇨🇦 June – July 2026."}
          </p>
        </div>
        <div className="md:col-span-4 flex md:justify-end">
          <Link
            to="/mundial"
            data-testid="home-to-mundial"
            className="inline-flex items-center gap-2 bg-amber-300 hover:bg-amber-400 text-[#0F2A1A] font-black rounded-full px-6 py-3 transition active:scale-95 shadow-[0_15px_40px_rgba(252,211,77,0.25)] hover:-translate-y-0.5"
          >
            {lang === "es" ? "Ver calendario" : "See schedule"}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* --------------------- Active Advertiser Hero --------------------- */
function ActiveHero({ active, t }) {
  const wa = waLink(active.whatsapp, `${t.home.heardOnRadio} — ${active.name}`);
  const tel = telLink(active.phone);
  const maps = mapsLink(active);
  const color = active.color || "#EA580C";

  return (
    <section
      data-testid="home-hero"
      className="relative overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(135deg, ${color}f5 0%, ${color}dd 50%, ${color}aa 100%), url(${bannerUrl(
          active.banner_path
        )})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 stripes-y opacity-[0.08] pointer-events-none" />
      <div className="absolute -top-24 -right-20 w-96 h-96 rounded-full bg-yellow-300/30 blur-3xl blob-b pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 text-white rise-in">
            <span className="inline-flex items-center gap-2 bg-yellow-300 text-slate-900 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.25em] shadow-lg mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              {t.home.activeBadge}
            </span>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.92] drop-shadow-md">
              {active.name}
            </h1>
            {active.tagline && (
              <p className="mt-4 font-script text-3xl sm:text-4xl text-yellow-200 -rotate-1">
                {active.tagline}
              </p>
            )}
            {active.special_offer && (
              <p className="mt-5 text-lg sm:text-xl text-white/95 leading-relaxed max-w-xl">
                {active.special_offer}
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              {tel && (
                <a
                  href={tel}
                  data-testid="hero-active-call"
                  className="inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-amber-50 font-bold rounded-full px-7 py-4 shadow-2xl transition hover:-translate-y-1 active:scale-95"
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
                  className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#16A34A] text-white font-bold rounded-full px-7 py-4 shadow-2xl transition hover:-translate-y-1 active:scale-95"
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
                  className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md hover:bg-white/25 border border-white/30 text-white font-bold rounded-full px-7 py-4 transition hover:-translate-y-1 active:scale-95"
                >
                  <MapPin className="w-5 h-5" />
                  {t.home.directions}
                </a>
              )}
              <Link
                to={`/a/${active.slug}`}
                data-testid="hero-active-visit"
                className="inline-flex items-center gap-2 text-white/90 hover:text-white font-bold rounded-full px-3 py-4 underline underline-offset-2"
              >
                {t.home.visitPage} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Right: framed banner */}
          <div className="lg:col-span-5 hidden lg:block">
            <div className="relative">
              <div className="absolute -inset-4 bg-yellow-300 rounded-3xl tilt-r" />
              <div className="relative bg-white p-3 rounded-3xl shadow-2xl">
                <img
                  src={bannerUrl(active.banner_path)}
                  alt={active.name}
                  className="w-full aspect-[4/3] object-cover rounded-2xl"
                />
                <p className="mt-3 text-center font-script text-3xl text-slate-900">
                  ¡Tu nuevo lugar favorito!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------- Events teaser --------------------- */
function EventsTeaser({ events, lang }) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (events || []).filter((e) => (e.end_date || e.event_date || "") >= today).slice(0, 3);
  if (upcoming.length === 0) return null;

  const fmt = (ev) => {
    if (!ev?.event_date) return "";
    try {
      const [y, m, d] = ev.event_date.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      const start = date.toLocaleDateString(lang === "es" ? "es-MX" : "en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      if (ev.end_date && ev.end_date !== ev.event_date) {
        const [ey, em, ed] = ev.end_date.split("-").map(Number);
        const endDate = new Date(ey, em - 1, ed);
        const endStr = endDate.toLocaleDateString(lang === "es" ? "es-MX" : "en-US", {
          day: "numeric",
          month: "short",
        });
        return `${start} – ${endStr}`;
      }
      return start;
    } catch {
      return ev.event_date;
    }
  };

  return (
    <section
      data-testid="events-teaser"
      className="relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#3F0A0A] to-[#7F1D1D] text-white py-14 md:py-18"
    >
      <div className="absolute -top-24 -right-20 w-96 h-96 rounded-full bg-amber-400/15 blur-3xl blob-b pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-rose-500/20 blur-3xl blob-a pointer-events-none" />
      <div className="absolute inset-0 stripes-y opacity-[0.05] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300 mb-2 inline-flex items-center gap-2">
              📅 {lang === "es" ? "Cartelera" : "Lineup"}
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">
              {lang === "es" ? "Próximos " : "Upcoming "}
              <span className="font-script font-normal italic text-amber-300 text-4xl sm:text-5xl lg:text-6xl">
                {lang === "es" ? "eventos" : "events"}
              </span>
            </h2>
          </div>
          <Link
            to="/eventos"
            data-testid="home-events-cta"
            className="inline-flex items-center gap-2 bg-amber-300 hover:bg-amber-400 text-[#3F0A0A] font-black rounded-full px-5 py-3 transition active:scale-95 shadow-[0_15px_40px_rgba(252,211,77,0.25)] hover:-translate-y-0.5 whitespace-nowrap"
          >
            {lang === "es" ? "Ver todos" : "See all"}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5" data-testid="events-teaser-grid">
          {upcoming.map((ev) => {
            const meta = { concierto: "🎶", promocion: "🎁", comunidad: "🤝" }[ev.category] || "📅";
            return (
              <Link
                key={ev.id}
                to={`/eventos/${ev.slug}`}
                data-testid={`event-teaser-${ev.slug}`}
                className="group bg-white/8 hover:bg-white/15 backdrop-blur-sm border border-white/15 rounded-2xl overflow-hidden transition hover:-translate-y-1"
              >
                <div className="aspect-[16/10] bg-white/5 overflow-hidden">
                  {ev.image_path ? (
                    <img
                      src={bannerUrl(ev.image_path)}
                      alt={ev.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-6xl"
                      style={{ backgroundColor: ev.color || "#7F1D1D", opacity: 0.4 }}
                    >
                      {meta}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-300">
                    {fmt(ev)} · {ev.start_time}
                  </p>
                  <h3 className="mt-1 text-lg font-extrabold leading-tight line-clamp-2">
                    {ev.title}
                  </h3>
                  {ev.location && (
                    <p className="mt-1 text-xs text-white/70 truncate">{ev.location}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* --------------------- Vibe section --------------------- */
function VibeSection({ settings, lang, nowPlaying }) {
  const hasLiveMeta = nowPlaying?.ok && (nowPlaying?.title || nowPlaying?.artist);
  const npTitle = hasLiveMeta ? nowPlaying.title : (settings?.now_playing || "El Show de la Tarde");
  const npArtist = hasLiveMeta ? nowPlaying.artist : "";
  const npImage = hasLiveMeta ? nowPlaying.image : "";
  return (
    <section
      className="relative overflow-hidden text-white py-20 md:py-28"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(15,23,42,0.92), rgba(120,53,15,0.85)), url(${VIBE_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute -top-10 left-10 w-72 h-72 rounded-full bg-orange-500/40 blur-3xl blob-a pointer-events-none" />
      <div className="absolute -bottom-10 right-10 w-72 h-72 rounded-full bg-pink-500/30 blur-3xl blob-b pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-300 mb-3 inline-flex items-center gap-2">
            <Mic2 className="w-4 h-4" /> {lang === "es" ? "El show del momento" : "On-air right now"}
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter">
            {lang === "es" ? "Música, " : "Music, "}
            <span className="font-script font-normal italic text-yellow-300 text-5xl sm:text-6xl lg:text-7xl">
              {lang === "es" ? "sabor " : "flavor "}
            </span>
            {lang === "es" ? "y comunidad." : "and community."}
          </h2>
          <p className="mt-5 text-lg text-white/85 leading-relaxed max-w-md">
            {lang === "es"
              ? "Música regional mexicana, corridos, banda, norteño y cumbia — 24 horas al día desde Dallas, Oregon, para toda la Willamette Valley y Portland."
              : "Regional Mexican, corridos, banda, norteño and cumbia — 24 hours a day from Dallas, Oregon, reaching all of Willamette Valley and Portland."}
          </p>
          <div className="mt-7 flex items-center gap-4">
            <div className="flex items-end gap-1 h-10 text-yellow-300">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="eq-bar" style={{ height: 28 + (i % 3) * 8 }} />
              ))}
            </div>
            <p className="text-sm">
              <span className="block text-[10px] uppercase tracking-[0.25em] text-yellow-300 font-bold">
                {lang === "es" ? "Sonando ahora" : "Now playing"}
              </span>
              <span className="font-bold text-lg block truncate max-w-[260px]" title={npTitle}>
                {npTitle}
              </span>
              {npArtist && (
                <span className="block text-xs text-white/70 truncate max-w-[260px]" title={npArtist}>
                  {npArtist}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: visual */}
        <div className="relative h-[380px] flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-72 h-72 rounded-full bg-yellow-300/20 blur-2xl" />
          </div>
          <div className="relative w-72 h-72 rounded-full bg-slate-900 border-8 border-yellow-300 flex items-center justify-center vinyl-spin shadow-2xl">
            <div className="w-44 h-44 rounded-full overflow-hidden bg-gradient-to-br from-orange-600 to-amber-500 flex items-center justify-center">
              {npImage ? (
                <img
                  src={npImage}
                  alt={npTitle}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <RadioIcon className="w-12 h-12 text-slate-900" strokeWidth={2.5} />
              )}
            </div>
            <div className="absolute w-3 h-3 rounded-full bg-yellow-300 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            {/* Grooves */}
            <div className="absolute inset-4 rounded-full border border-white/10" />
            <div className="absolute inset-10 rounded-full border border-white/10" />
            <div className="absolute inset-16 rounded-full border border-white/10" />
          </div>
          {/* Speech bubble */}
          <div className="absolute -top-2 right-4 bg-yellow-300 text-slate-900 rounded-2xl px-4 py-2 font-script text-2xl tilt-r shadow-lg">
            ¡Súbele!
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------- Community / Footer CTA --------------------- */
function CommunitySection({ t, lang, stationWa, tagline }) {
  return (
    <section className="relative bg-slate-900 text-white overflow-hidden">
      <div className="absolute inset-0 dot-grid opacity-[0.08]" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-orange-500/30 blur-3xl blob-a pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-yellow-300/20 blur-3xl blob-b pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        <div className="md:col-span-2">
          <p className="text-xs uppercase tracking-[0.3em] text-orange-400 font-bold mb-3">
            {lang === "es" ? "Únete a la fiesta" : "Join the party"}
          </p>
          <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">
            {tagline || (lang === "es" ? "El sabor de tu música" : "The flavor of your music")}
          </h3>
          <p className="mt-4 text-white/80 max-w-xl">
            {lang === "es"
              ? "Saluda al estudio, pide tu canción, o cuéntanos qué negocio quieres descubrir esta semana."
              : "Say hi to the studio, request a song, or tell us which local business to feature this week."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {stationWa && (
              <a
                href={stationWa}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="community-wa-btn"
                className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#16A34A] text-white font-bold rounded-full px-6 py-3 transition active:scale-95 shadow-lg"
              >
                <MessageCircle className="w-5 h-5" />
                {t.home.ctaWhatsApp}
              </a>
            )}
            <Link
              to="/advertisers"
              data-testid="community-advertisers-btn"
              className="inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-yellow-100 font-bold rounded-full px-6 py-3 transition active:scale-95"
            >
              <ArrowRight className="w-5 h-5" />
              {t.nav.advertisers}
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-3 bg-orange-500 rounded-3xl tilt-l" />
          <div className="relative bg-yellow-300 text-slate-900 rounded-3xl p-7 shadow-2xl">
            <p className="font-script text-3xl leading-none -rotate-2">¡Hola, oyente!</p>
            <p className="mt-3 font-bold text-lg leading-tight">
              {lang === "es"
                ? "Nuestro estudio nunca cierra. Llámanos cuando quieras."
                : "Our studio never closes. Call us anytime."}
            </p>
            <div className="mt-4 flex items-center gap-2 text-slate-900/80">
              <Phone className="w-4 h-4" />
              <span className="text-sm font-bold">+1 (503) 623-0244</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
