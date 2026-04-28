import React from "react";
import { Link } from "react-router-dom";
import {
  Phone,
  MessageCircle,
  Mail,
  Check,
  Sparkles,
  ArrowRight,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { SALES_INFO } from "../data/staticContent";
import { waLink, telLink } from "../lib/api";

export default function Anuncia() {
  const { lang } = useLanguage();
  const sp = SALES_INFO.salesperson;
  const wa = waLink(
    sp.whatsapp,
    lang === "es"
      ? `Hola ${sp.name.split(" ")[0]}, quiero info de los paquetes de publicidad`
      : `Hi ${sp.name.split(" ")[0]}, I'd like info about your ad packages`,
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
            {lang === "es" ? "Tu negocio" : "Your business,"}
            <br />
            <span className="font-script font-normal italic text-amber-300 text-7xl sm:text-8xl lg:text-9xl block -mt-2">
              {lang === "es" ? "en boca de todos" : "everywhere"}
            </span>
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-amber-100/95 leading-snug max-w-2xl font-semibold">
            {SALES_INFO.tagline}
          </p>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl">
            <Stat label={lang === "es" ? "Oyentes/sem" : "Listeners/wk"} number={SALES_INFO.reach.listeners} />
            <Stat label={lang === "es" ? "Hogares" : "Households"} number={SALES_INFO.reach.households} />
            <Stat label={lang === "es" ? "Condados" : "Counties"} number={SALES_INFO.reach.counties} />
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
                {lang === "es" ? "Habla con tu asesora" : "Talk to your rep"}
              </a>
            )}
            <a
              href="#paquetes"
              data-testid="anuncia-hero-packages"
              className="inline-flex items-center gap-2 bg-amber-300 hover:bg-amber-400 text-[#3F0A0A] font-black rounded-full px-7 py-4 transition hover:-translate-y-1 active:scale-95"
            >
              {lang === "es" ? "Ver paquetes" : "See packages"}
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

      {/* Pricing packages */}
      <section id="paquetes" className="bg-orange-50/60 py-14 md:py-20 border-y border-orange-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-600 mb-2">
              {lang === "es" ? "Paquetes" : "Packages"}
            </p>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter">
              {lang === "es" ? "Elige tu " : "Choose your "}
              <span className="font-script font-normal italic text-orange-600">
                {lang === "es" ? "paquete perfecto" : "perfect plan"}
              </span>
            </h2>
            <p className="text-slate-600 mt-3 max-w-xl mx-auto">
              {lang === "es"
                ? "Todo incluido. Sin contratos a largo plazo. Resultados desde la primera semana."
                : "All-inclusive. No long-term contracts. Results from week one."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {SALES_INFO.packages.map((p) => (
              <div
                key={p.id}
                data-testid={`pkg-${p.id}`}
                className={`relative rounded-3xl overflow-hidden bg-white border-2 transition hover:-translate-y-2 hover:shadow-2xl shadow-lg ${
                  p.featured ? "border-orange-500 md:scale-105 z-10" : "border-slate-200"
                }`}
              >
                {p.featured && (
                  <div className="absolute top-0 inset-x-0 bg-orange-600 text-white text-[10px] uppercase tracking-[0.3em] font-black text-center py-1.5">
                    ★ {lang === "es" ? "Más popular" : "Most popular"}
                  </div>
                )}
                <div className={`p-7 ${p.featured ? "pt-12" : ""}`}>
                  <p
                    className="text-[10px] uppercase tracking-[0.3em] font-extrabold mb-1"
                    style={{ color: p.color }}
                  >
                    {p.tagline}
                  </p>
                  <h3 className="text-3xl font-black text-slate-900">{p.name}</h3>
                  <p className="mt-4 flex items-baseline gap-1">
                    <span className="text-5xl font-black tracking-tighter text-slate-900">
                      {p.price}
                    </span>
                    <span className="text-sm font-bold text-slate-500">{p.period}</span>
                  </p>
                  <ul className="mt-6 space-y-2.5">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check
                          className="w-4 h-4 mt-0.5 shrink-0"
                          style={{ color: p.color }}
                        />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`pkg-cta-${p.id}`}
                    className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition active:scale-95 ${
                      p.featured
                        ? "bg-orange-600 hover:bg-orange-700 text-white shadow-lg"
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    }`}
                  >
                    {lang === "es" ? "Quiero este" : "Get this plan"}
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-500 mt-8">
            {lang === "es"
              ? "* Precios en USD. Producción de spots incluida en planes Pro y Patrocinador."
              : "* Prices in USD. Spot production included in Pro and Sponsor plans."}
          </p>
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
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
        <div className="bg-white rounded-3xl border-2 border-orange-200 overflow-hidden grid grid-cols-1 md:grid-cols-2 shadow-xl">
          <div className="relative h-72 md:h-auto bg-slate-100">
            <img
              src={sp.photo}
              alt={sp.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-orange-900/20 to-transparent" />
          </div>
          <div className="p-8 md:p-10 flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-600 mb-2">
              {lang === "es" ? "Tu asesora de ventas" : "Your sales rep"}
            </p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">{sp.name}</h3>
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
