import React from "react";
import { Link } from "react-router-dom";
import {
  Phone,
  MessageCircle,
  Mail,
  Sparkles,
  ArrowRight,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useStation } from "../contexts/StationContext";
import { SALES_INFO } from "../data/staticContent";
import { waLink, telLink, bannerUrl } from "../lib/api";

export default function Anuncia() {
  const { lang } = useLanguage();
  const { settings } = useStation();

  // Merge admin settings with static defaults (settings wins, fallback to static)
  const staticSp = SALES_INFO.salesperson;
  const sp = {
    name: settings?.sales_person_name || staticSp.name,
    title: settings?.sales_person_title || staticSp.title,
    phone: settings?.sales_person_phone || staticSp.phone,
    whatsapp: settings?.sales_person_whatsapp || staticSp.whatsapp,
    email: settings?.sales_person_email || staticSp.email,
    quote: settings?.sales_person_quote || staticSp.quote,
    photo: settings?.sales_person_photo
      ? bannerUrl(settings.sales_person_photo)
      : staticSp.photo,
  };
  const heroTitle = settings?.sales_hero_title || (lang === "es" ? "Tu negocio" : "Your business,");
  const heroSubtitle =
    settings?.sales_hero_subtitle ||
    (lang === "es" ? "en boca de todos" : "everywhere");
  const tagline = settings?.sales_tagline || SALES_INFO.tagline;
  const reach = {
    listeners: settings?.sales_stat_listeners || SALES_INFO.reach.listeners,
    households: settings?.sales_stat_households || SALES_INFO.reach.households,
    counties: settings?.sales_stat_counties || SALES_INFO.reach.counties,
  };

  const wa = waLink(
    sp.whatsapp,
    lang === "es"
      ? `Hola ${sp.name.split(" ")[0]}, quiero info de la publicidad en La Campeona`
      : `Hi ${sp.name.split(" ")[0]}, I'd like info about advertising on La Campeona`,
  );

  return (
    <div data-testid="anuncia-page" className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#3F0A0A] via-[#7F1D1D] to-[#991B1B]">
        <div className="absolute -top-24 -left-20 w-[28rem] h-[28rem] rounded-full bg-rose-600/30 blur-3xl blob-a pointer-events-none" />
        <div className="absolute top-32 -right-20 w-[28rem] h-[28rem] rounded-full bg-amber-400/20 blur-3xl blob-b pointer-events-none" />
        <div className="absolute inset-0 stripes-y opacity-[0.07]" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 md:pt-20 md:pb-20 text-white">
          <span className="inline-flex items-center gap-2 bg-amber-300 text-[#3F0A0A] px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.25em] shadow-md mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            {lang === "es" ? "Anúnciate en La Campeona" : "Advertise on La Campeona"}
          </span>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.92] drop-shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
            {heroTitle}
            <br />
            <span className="font-script font-normal italic text-amber-300 text-7xl sm:text-8xl lg:text-9xl block -mt-2">
              {heroSubtitle}
            </span>
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-amber-100/95 leading-snug max-w-2xl font-semibold">
            {tagline}
          </p>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl">
            <Stat label={lang === "es" ? "Oyentes/sem" : "Listeners/wk"} number={reach.listeners} />
            <Stat label={lang === "es" ? "Hogares" : "Households"} number={reach.households} />
            <Stat label={lang === "es" ? "Condados" : "Counties"} number={reach.counties} />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="anuncia-hero-wa"
                className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#16A34A] text-white font-bold rounded-full px-7 py-4 shadow-[0_15px_40px_rgba(37,211,102,0.3)] transition hover:-translate-y-1 active:scale-95"
              >
                <MessageCircle className="w-5 h-5" />
                {lang === "es" ? "Habla con tu asesor" : "Talk to your rep"}
              </a>
            )}
            <a
              href="#asesora"
              data-testid="anuncia-hero-contact"
              className="inline-flex items-center gap-2 bg-amber-300 hover:bg-amber-400 text-[#3F0A0A] font-black rounded-full px-7 py-4 transition hover:-translate-y-1 active:scale-95"
            >
              {lang === "es" ? "Contactar ventas" : "Contact sales"}
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      {/* Why us — Reasons */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-600 mb-2 inline-flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          {lang === "es" ? "Por qué La Campeona" : "Why La Campeona"}
        </p>
        <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter mb-10">
          {lang === "es" ? "Más que un anuncio. " : "More than an ad. "}
          <span className="font-script font-normal italic text-orange-600">
            {lang === "es" ? "una conexión." : "a connection."}
          </span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {SALES_INFO.reasons.map((r, i) => (
            <div
              key={i}
              data-testid={`reason-${i}`}
              className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-orange-400 hover:-translate-y-1 transition shadow-sm hover:shadow-md"
            >
              <span className="text-4xl block mb-3">{r.icon}</span>
              <h3 className="font-extrabold text-lg text-slate-900 mb-1">{r.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Mundial cross-sell */}
      <section className="bg-[#0F2A1A] text-white py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300 font-bold mb-2 inline-flex items-center gap-2">
              <Trophy className="w-4 h-4" /> Mundial 2026
            </p>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
              {lang === "es"
                ? "¿Quieres patrocinar partidos del Mundial?"
                : "Want to sponsor World Cup matches?"}
            </h3>
            <p className="mt-2 text-white/80 max-w-xl">
              {lang === "es"
                ? "Tenemos los derechos exclusivos en español. Pregunta por los paquetes especiales del Mundial."
                : "We have the exclusive Spanish-language rights. Ask about our World Cup packages."}
            </p>
          </div>
          <Link
            to="/mundial"
            className="inline-flex items-center justify-center gap-2 bg-amber-300 hover:bg-amber-400 text-[#0F2A1A] font-black rounded-full px-6 py-3 transition active:scale-95"
          >
            {lang === "es" ? "Ver el calendario" : "See schedule"}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Sales person */}
      <section id="asesora" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
        <div className="bg-white rounded-3xl border-2 border-orange-200 overflow-hidden grid grid-cols-1 md:grid-cols-2 shadow-xl">
          <div className="relative h-72 md:h-auto bg-slate-100">
            <img
              src={sp.photo}
              alt={sp.name}
              className="w-full h-full object-cover"
              data-testid="sales-person-photo"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-orange-900/20 to-transparent" />
          </div>
          <div className="p-8 md:p-10 flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-600 mb-2">
              {lang === "es" ? "Tu Asesor de ventas" : "Your sales rep"}
            </p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight" data-testid="sales-person-name">
              {sp.name}
            </h3>
            <p className="text-slate-500 text-sm mt-1">{sp.title}</p>
            <p className="font-script text-2xl text-orange-600 mt-4 -rotate-1">"{sp.quote}"</p>

            <div className="mt-6 flex flex-col gap-2.5">
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="sales-wa"
                  className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#16A34A] text-white font-bold rounded-full px-5 py-3 transition active:scale-95 shadow-md"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp · +{sp.whatsapp.replace(/^1/, "1 ")}
                </a>
              )}
              <a
                href={telLink(sp.phone)}
                data-testid="sales-call"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full px-5 py-3 transition active:scale-95 shadow-md"
              >
                <Phone className="w-4 h-4" />
                {sp.phone}
              </a>
              <a
                href={`mailto:${sp.email}`}
                data-testid="sales-email"
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full px-5 py-3 transition active:scale-95"
              >
                <Mail className="w-4 h-4" />
                {sp.email}
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, number }) {
  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3">
      <p className="text-3xl font-black tracking-tighter text-amber-300">{number}</p>
      <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/80">{label}</p>
    </div>
  );
}
