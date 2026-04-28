import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Music, Sparkles } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAdvertisers } from "../hooks/useAdvertisers";
import { bannerUrl } from "../lib/api";

export default function AdvertisersList() {
  const { t, lang } = useLanguage();
  const { advertisers, loading } = useAdvertisers();

  return (
    <div data-testid="advertisers-page" className="min-h-screen">
      <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-100 border-b-2 border-slate-900/5">
        <div className="absolute -top-16 -left-10 w-72 h-72 rounded-full bg-orange-300/40 blur-3xl blob-a pointer-events-none" />
        <div className="absolute -bottom-10 right-10 w-72 h-72 rounded-full bg-pink-300/30 blur-3xl blob-b pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-orange-600 mb-3 inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            {t.nav.advertisers}
          </p>
          <h1 className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tighter leading-[0.92]">
            {lang === "es" ? "Negocios " : "Businesses "}
            <span className="font-script font-normal italic text-orange-600">
              {lang === "es" ? "que suenan" : "that rock"}
            </span>
          </h1>
          <p className="text-slate-700 mt-3 max-w-md">{t.home.sponsorsSubtitle}</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {loading && <p className="text-slate-500">…</p>}
          {advertisers.map((adv, idx) => (
            <Link
              key={adv.id}
              to={`/a/${adv.slug}`}
              data-testid={`list-advertiser-${adv.slug}`}
              className={`group relative bg-white rounded-3xl shadow-xl shadow-slate-900/10 overflow-hidden border border-slate-100 transition duration-300 hover:-translate-y-2 hover:shadow-2xl ${
                idx % 3 === 1 ? "sm:translate-y-3" : ""
              }`}
            >
              <span
                className="absolute z-10 top-3 right-3 wiggle px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg"
                style={{ backgroundColor: adv.color || "#EA580C" }}
              >
                ★ Promo
              </span>
              <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
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
              <div className="p-6">
                <h3 className="text-2xl font-extrabold text-slate-900 leading-tight">{adv.name}</h3>
                {adv.tagline && (
                  <p className="text-sm text-slate-500 mt-1 italic">{adv.tagline}</p>
                )}
                {adv.special_offer && (
                  <p className="text-sm text-slate-600 mt-3 line-clamp-2">{adv.special_offer}</p>
                )}
                <div className="mt-5 inline-flex items-center gap-1 text-orange-600 font-bold text-sm group-hover:gap-2 transition-all">
                  {t.home.visitPage} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
