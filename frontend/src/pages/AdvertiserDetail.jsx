import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Phone, MessageCircle, MapPin, ArrowLeft, Sparkles, Globe, ShoppingCart, Calendar, Download, ExternalLink } from "lucide-react";
import { api, bannerUrl, telLink, waLink, mapsLink } from "../lib/api";
import { useLanguage } from "../contexts/LanguageContext";

export default function AdvertiserDetail() {
  const { slug } = useParams();
  const { t } = useLanguage();
  const [adv, setAdv] = useState(null);
  const [error, setError] = useState(false);
  const [weeklyAd, setWeeklyAd] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setAdv(null);
    setError(false);
    setWeeklyAd(null);
    (async () => {
      try {
        const { data } = await api.get(`/advertisers/${slug}`);
        if (!cancelled) setAdv(data);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    // Fetch weekly ad separately so a slow scrape never blocks the page.
    (async () => {
      try {
        const { data } = await api.get(`/advertisers/${slug}/weekly-ad`);
        if (!cancelled) setWeeklyAd(data);
      } catch {
        if (!cancelled) setWeeklyAd(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Not found.{" "}
        <Link to="/" className="ml-2 underline">
          ← Home
        </Link>
      </div>
    );
  }
  if (!adv) {
    return <div className="min-h-screen p-10 text-slate-500">…</div>;
  }

  const tel = telLink(adv.phone);
  const wa = waLink(adv.whatsapp, `${t.home.heardOnRadio} — ${adv.name}`);
  const maps = mapsLink(adv);

  return (
    <div data-testid="advertiser-detail" className="min-h-screen">
      <section
        className="relative"
        style={{
          backgroundImage: `linear-gradient(135deg, ${adv.color || "#EA580C"}ee, ${adv.color || "#EA580C"}99), url(${bannerUrl(adv.banner_path)})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 text-white">
          <Link
            to="/advertisers"
            data-testid="advertiser-back"
            className="inline-flex items-center gap-2 text-white/90 hover:text-white font-bold mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> {t.advertiser.back}
          </Link>
          {adv.tagline && (
            <p className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-[0.25em] mb-4">
              <Sparkles className="w-3.5 h-3.5" /> {adv.tagline}
            </p>
          )}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95] drop-shadow-md">
            {adv.name}
          </h1>
          {adv.description && (
            <p className="mt-5 text-lg max-w-2xl text-white/90 leading-relaxed">
              {adv.description}
            </p>
          )}
        </div>
      </section>

      {weeklyAd?.enabled && (weeklyAd.images?.length > 0 || weeklyAd.pdf_url) && (
        <section data-testid="weekly-ad-section" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-6 sm:p-8 border-b border-slate-100">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600 mb-1 inline-flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> Especiales de la semana
                </p>
                {weeklyAd.date_range && (
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 inline-flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-emerald-600" /> {weeklyAd.date_range}
                  </h2>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {weeklyAd.pdf_url && (
                  <a
                    href={weeklyAd.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="weekly-ad-pdf"
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-full px-5 py-2.5 transition active:scale-95"
                  >
                    <Download className="w-4 h-4" /> Descargar PDF
                  </a>
                )}
                {weeklyAd.source_url && (
                  <a
                    href={weeklyAd.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="weekly-ad-source"
                    className="inline-flex items-center gap-2 bg-white border-2 border-slate-200 hover:border-slate-900 text-slate-900 font-bold rounded-full px-5 py-2.5 transition active:scale-95"
                  >
                    <ExternalLink className="w-4 h-4" /> Ver en su sitio
                  </a>
                )}
              </div>
            </div>
            {weeklyAd.images?.length > 0 && (
              <div className="p-4 sm:p-6 grid grid-cols-1 gap-5 bg-slate-50">
                {weeklyAd.images.map((src, i) => (
                  <a
                    key={i}
                    href={weeklyAd.pdf_url || src}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`weekly-ad-img-${i}`}
                    className="block rounded-2xl overflow-hidden border border-slate-200 bg-white hover:shadow-lg transition group"
                  >
                    <img
                      src={src}
                      alt={`Folleto de ofertas página ${i + 1}`}
                      loading="lazy"
                      className="w-full h-auto group-hover:scale-[1.01] transition duration-500"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        {adv.special_offer && (
          <div className="md:col-span-2 bg-white rounded-3xl border border-orange-100 p-6 sm:p-8 shadow-xl shadow-slate-200/50">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-600 mb-2">
              {t.advertiser.offer}
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {adv.special_offer}
            </h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {tel && (
                <a
                  href={tel}
                  data-testid="adv-call-btn"
                  className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full px-6 py-3 transition active:scale-95 shadow-[0_8px_30px_rgba(234,88,12,0.3)]"
                >
                  <Phone className="w-5 h-5" /> {adv.cta_text || t.home.callNow}
                </a>
              )}
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="adv-wa-btn"
                  className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#16A34A] text-white font-bold rounded-full px-6 py-3 transition active:scale-95"
                >
                  <MessageCircle className="w-5 h-5" /> {t.home.whatsapp}
                </a>
              )}
              {maps && (
                <a
                  href={maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="adv-maps-btn"
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full px-6 py-3 transition active:scale-95"
                >
                  <MapPin className="w-5 h-5" /> {t.home.directions}
                </a>
              )}
              {adv.website_url && (
                <a
                  href={adv.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="adv-web-btn"
                  className="inline-flex items-center gap-2 bg-white border-2 border-slate-200 hover:border-slate-900 text-slate-900 font-bold rounded-full px-6 py-3 transition active:scale-95"
                >
                  <Globe className="w-5 h-5" /> {t.advertiser.visitWebsite}
                </a>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xl shadow-slate-200/50">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-600 mb-2">
            {t.advertiser.contact}
          </p>
          <ul className="text-slate-700 space-y-3">
            {adv.phone && (
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-orange-600" />
                <a href={tel} className="font-bold hover:underline" data-testid="adv-side-phone">
                  {adv.phone}
                </a>
              </li>
            )}
            {adv.whatsapp && (
              <li className="flex items-center gap-3">
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
                <a href={wa} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" data-testid="adv-side-wa">
                  +{adv.whatsapp}
                </a>
              </li>
            )}
            {adv.address && (
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-orange-600 mt-1" />
                <a href={maps} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" data-testid="adv-side-address">
                  {adv.address}
                </a>
              </li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
