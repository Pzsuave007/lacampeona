import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Music } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAdvertisers } from "../hooks/useAdvertisers";
import { bannerUrl } from "../lib/api";

export default function AdvertisersList() {
  const { t } = useLanguage();
  const { advertisers, loading } = useAdvertisers();

  return (
    <div data-testid="advertisers-page" className="min-h-screen">
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-600 mb-2">
          {t.nav.advertisers}
        </p>
        <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter">
          {t.home.sponsorsTitle}
        </h1>
        <p className="text-slate-600 mt-3">{t.home.sponsorsSubtitle}</p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading && <p className="text-slate-500">…</p>}
          {advertisers.map((adv) => (
            <Link
              key={adv.id}
              to={`/a/${adv.slug}`}
              data-testid={`list-advertiser-${adv.slug}`}
              className="group bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100 transition hover:-translate-y-1"
            >
              <div className="aspect-[16/9] bg-slate-100 overflow-hidden">
                {adv.banner_path ? (
                  <img src={bannerUrl(adv.banner_path)} alt={adv.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Music className="w-10 h-10" />
                  </div>
                )}
              </div>
              <div className="p-5">
                <h3 className="text-xl font-extrabold text-slate-900">{adv.name}</h3>
                {adv.tagline && <p className="text-sm text-slate-500 mt-1">{adv.tagline}</p>}
                <div className="mt-4 inline-flex items-center gap-1 text-orange-600 font-bold text-sm">
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
