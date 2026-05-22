import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Share2,
  MessageCircle,
  Copy,
  Facebook,
  Eye,
  ArrowLeft,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { api, bannerUrl, waLink } from "../lib/api";
import { useStation } from "../contexts/StationContext";
import { useLanguage } from "../contexts/LanguageContext";

export default function Post() {
  const { slug } = useParams();
  const { settings } = useStation();
  const { lang } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fbRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/posts/${slug}`)
      .then(({ data }) => {
        if (!cancelled) {
          setData(data);
          // OpenGraph-ish: update title for share previews on apps that re-fetch
          if (data?.post?.title || data?.post?.text) {
            const cleanText = stripDjLabels(data.post.text || "");
            document.title = `${data.post.title || cleanText.slice(0, 60)} · La Campeona 880 AM`;
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.response?.status === 404 ? "404" : "error");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [slug]);

  // Load Facebook SDK for comments embed (once per session)
  useEffect(() => {
    if (!data?.post?.fb_post_url) return;
    if (window.FB) {
      try { window.FB.XFBML.parse(); } catch {}
      return;
    }
    if (document.getElementById("fb-sdk")) return;
    const script = document.createElement("script");
    script.id = "fb-sdk";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = `https://connect.facebook.net/${lang === "es" ? "es_LA" : "en_US"}/sdk.js#xfbml=1&version=v18.0`;
    document.body.appendChild(script);
  }, [data?.post?.fb_post_url, lang]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 font-bold animate-pulse">Cargando...</p>
      </div>
    );
  }
  if (error === "404") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <p className="text-6xl mb-3">🤔</p>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Post no encontrado</h1>
        <p className="text-slate-500 mb-6">Quizás fue removido o el link es incorrecto.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full px-6 py-3 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>
      </div>
    );
  }

  const { post, advertiser, host } = data || {};
  const parsed = parseDjText(post?.text || "");
  const title =
    post?.title ||
    parsed.caption.split("\n")[0]?.slice(0, 120) ||
    "Post";
  const cover = post?.cover_image ? bannerUrl(post.cover_image) : null;
  const publicUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const shareWa = waLink(
    settings?.station_whatsapp || "",
    `Mira esto: ${title}\n\n${publicUrl}`,
  );
  const shareFb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`;

  return (
    <div data-testid="post-page" className="bg-slate-50 min-h-screen">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#3F0A0A] via-[#7F1D1D] to-[#991B1B] text-white">
        <div className="absolute -top-24 -left-20 w-[28rem] h-[28rem] rounded-full bg-rose-600/30 blur-3xl blob-a pointer-events-none" />
        <div className="absolute -bottom-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-amber-400/15 blur-3xl blob-b pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12">
          <Link to="/" className="inline-flex items-center gap-2 text-amber-200 hover:text-amber-100 text-sm font-bold mb-5 transition">
            <ArrowLeft className="w-4 h-4" /> La Campeona 880 AM
          </Link>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-[1.05]" data-testid="post-title">
            {title}
          </h1>
          <div className="mt-4 flex flex-wrap gap-3 items-center text-sm text-white/80">
            {host?.name && (
              <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full">
                <span className="text-amber-300">por</span> {host.name}
              </span>
            )}
            {post?.created_at && (
              <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(post.created_at).toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full">
              <Eye className="w-3.5 h-3.5" />
              {(post?.views_count || 0).toLocaleString()} vistas
            </span>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {cover && (
          <img
            src={cover}
            alt={title}
            className="w-full aspect-video object-cover rounded-2xl shadow-lg mb-8"
            data-testid="post-cover"
          />
        )}

        <article className="prose prose-lg max-w-none text-slate-800 leading-relaxed whitespace-pre-line" data-testid="post-body">
          {parsed.caption}
        </article>

        {parsed.cta && (
          <div
            data-testid="post-cta"
            className="mt-6 bg-amber-50 border-l-4 border-amber-500 rounded-r-2xl px-5 py-4 text-slate-800 text-lg font-medium whitespace-pre-line"
          >
            {parsed.cta}
          </div>
        )}

        {parsed.hashtags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2" data-testid="post-hashtags">
            {parsed.hashtags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center bg-orange-100 text-orange-700 text-sm font-bold rounded-full px-3 py-1"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Listen-live nudge */}
        <div className="mt-10 bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-2xl p-6 sm:p-8 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200 mb-2">
            🎶 EN VIVO AHORA
          </p>
          <h3 className="text-2xl sm:text-3xl font-black mb-1">
            La Campeona 880 AM
          </h3>
          <p className="text-white/85 mb-4">
            {lang === "es"
              ? "Dale play al reproductor de abajo y sigue escuchando mientras lees."
              : "Hit play below and keep listening while you read."}
          </p>
          <button
            type="button"
            onClick={() => {
              document.querySelector('[data-testid="player-play-btn"]')?.click();
            }}
            data-testid="post-listen-btn"
            className="inline-flex items-center gap-2 bg-white text-orange-700 font-black rounded-full px-7 py-3 shadow-md hover:scale-105 active:scale-95 transition"
          >
            ▶ {lang === "es" ? "Escuchar en vivo" : "Listen live"}
          </button>
        </div>

        {/* Share buttons */}
        <div className="mt-8 flex flex-wrap gap-2.5 items-center">
          <span className="text-sm font-bold text-slate-600 mr-1 inline-flex items-center gap-1.5">
            <Share2 className="w-4 h-4" /> Compartir:
          </span>
          {shareWa && (
            <a
              href={shareWa}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="post-share-wa"
              className="inline-flex items-center gap-1.5 bg-[#25D366] hover:bg-[#16A34A] text-white text-sm font-bold rounded-full px-4 py-2 transition active:scale-95"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          )}
          <a
            href={shareFb}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="post-share-fb"
            className="inline-flex items-center gap-1.5 bg-[#1877F2] hover:bg-[#1456b8] text-white text-sm font-bold rounded-full px-4 py-2 transition active:scale-95"
          >
            <Facebook className="w-4 h-4" /> Facebook
          </a>
          <button
            type="button"
            onClick={handleCopy}
            data-testid="post-share-copy"
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-full px-4 py-2 transition active:scale-95"
          >
            <Copy className="w-4 h-4" /> Copiar link
          </button>
        </div>

        {/* Featured advertiser */}
        {advertiser && (
          <FeaturedAdvertiser advertiser={advertiser} lang={lang} />
        )}

        {/* Embedded Facebook post + its real comments */}
        {post?.fb_post_url && (
          <section className="mt-10" data-testid="fb-post-section">
            <h3 className="text-lg font-black text-slate-900 mb-3 inline-flex items-center gap-2">
              <Facebook className="w-5 h-5 text-[#1877F2]" />
              {lang === "es" ? "Ver en Facebook" : "See on Facebook"}
            </h3>
            <div id="fb-root" />
            <div className="fb-post-wrap flex justify-center bg-slate-100 rounded-2xl p-3 border border-slate-200 overflow-hidden">
              <div
                ref={fbRef}
                className="fb-post"
                data-href={post.fb_post_url}
                data-width="500"
                data-show-text="true"
                data-testid="fb-post-embed"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              {lang === "es"
                ? "Si no carga, abre el post directo en Facebook"
                : "If it doesn't load, open the post directly on Facebook"}{" "}
              <a
                href={post.fb_post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#1877F2] hover:underline"
              >
                {lang === "es" ? "aquí" : "here"}
              </a>
              .
            </p>
          </section>
        )}

        {/* Related posts */}
        <RelatedPosts currentSlug={slug} />
      </main>
    </div>
  );
}

function FeaturedAdvertiser({ advertiser, lang }) {
  const name = advertiser.name || advertiser.business_name || "";
  const banner = advertiser.banner_path || advertiser.logo_path || "";
  // banner_path can be a full URL (external CDN) or a relative storage path
  const bannerSrc = banner
    ? (/^https?:\/\//i.test(banner) ? banner : bannerUrl(banner))
    : null;
  const mapsHref = advertiser.maps_url
    || (advertiser.address ? `https://maps.google.com/?q=${encodeURIComponent(advertiser.address)}` : null);
  const waHref = advertiser.whatsapp
    ? `https://wa.me/${advertiser.whatsapp.replace(/[^0-9]/g, "")}`
    : null;

  return (
    <div
      data-testid="post-advertiser"
      className="mt-10 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border-2 border-amber-200 rounded-2xl overflow-hidden"
    >
      {bannerSrc && (
        <a
          href={advertiser.slug ? `/a/${advertiser.slug}` : "#"}
          className="block bg-white"
          data-testid="post-advertiser-banner"
        >
          <img
            src={bannerSrc}
            alt={name}
            className="w-full max-h-64 object-contain bg-white"
          />
        </a>
      )}
      <div className="p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-orange-600 mb-3">
          ⭐ {lang === "es" ? "Patrocinador destacado" : "Featured sponsor"}
        </p>
        <h4 className="text-xl sm:text-2xl font-black text-slate-900">
          {name}
        </h4>
        {advertiser.tagline && (
          <p className="text-slate-600 mt-1">{advertiser.tagline}</p>
        )}
        {advertiser.special_offer && (
          <p className="mt-2 inline-block bg-rose-100 text-rose-700 text-sm font-bold rounded-full px-3 py-1">
            🎁 {advertiser.special_offer}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {advertiser.phone && (
            <a
              href={`tel:${advertiser.phone}`}
              className="inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-full px-4 py-2 transition active:scale-95"
            >
              📞 {advertiser.phone}
            </a>
          )}
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#25D366] hover:bg-[#16A34A] text-white text-sm font-bold rounded-full px-4 py-2 transition active:scale-95"
            >
              💬 WhatsApp
            </a>
          )}
          {mapsHref && (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-full px-4 py-2 transition active:scale-95"
            >
              📍 {lang === "es" ? "Direcciones" : "Directions"}
            </a>
          )}
          {advertiser.website_url && (
            <a
              href={advertiser.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-full px-4 py-2 transition active:scale-95"
            >
              🔗 {lang === "es" ? "Sitio web" : "Website"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function RelatedPosts({ currentSlug }) {
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    api
      .get("/posts/recent?limit=6")
      .then(({ data }) => setPosts((data || []).filter((p) => p.slug !== currentSlug).slice(0, 3)))
      .catch(() => setPosts([]));
  }, [currentSlug]);
  if (!posts.length) return null;
  return (
    <section className="mt-12">
      <h3 className="text-lg font-black text-slate-900 mb-4 inline-flex items-center gap-2">
        📚 Más posts
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {posts.map((p) => (
          <Link
            key={p.slug}
            to={`/p/${p.slug}`}
            data-testid={`related-post-${p.slug}`}
            className="block bg-white rounded-2xl border border-slate-200 hover:border-orange-400 hover:shadow-md transition p-4"
          >
            <p className="text-sm font-bold text-slate-900 line-clamp-3">{p.title || stripDjLabels(p.text || "").slice(0, 100)}</p>
            <p className="text-xs text-slate-500 mt-2 inline-flex items-center gap-1">
              <Eye className="w-3 h-3" /> {(p.views_count || 0).toLocaleString()}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

// --- AI text parsing helpers ---
// The DJ Studio AI returns posts shaped as:
//   [CAPTION]
//   <body>
//
//   [HASHTAGS]
//   #foo #bar
//
//   [CTA]
//   <call to action>
// These section labels are an internal contract — they MUST NOT appear in the
// public view. We split the text into three pieces for friendly rendering.
function stripDjLabels(text) {
  return (text || "")
    .replace(/^\s*\[(CAPTION|HASHTAGS|CTA)\]\s*:?\s*$/gim, "")
    .replace(/\[(CAPTION|HASHTAGS|CTA)\]\s*:?/gi, "")
    .trim();
}

function parseDjText(text) {
  const empty = { caption: "", hashtags: [], cta: "" };
  if (!text) return empty;

  const section = (label) => {
    const re = new RegExp(
      `\\[${label}\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[(?:CAPTION|HASHTAGS|CTA)\\]|$)`,
      "i",
    );
    const m = text.match(re);
    return m ? m[1].trim() : "";
  };

  const captionRaw = section("CAPTION");
  const hashtagsRaw = section("HASHTAGS");
  const ctaRaw = section("CTA");

  // If no labels at all, treat the whole thing as caption (and try to lift any
  // trailing # line into hashtags).
  if (!captionRaw && !hashtagsRaw && !ctaRaw) {
    const lines = text.trim().split(/\n/);
    const tagLineIdx = lines.findIndex((l) => /^\s*#\S+/.test(l));
    if (tagLineIdx > 0) {
      return {
        caption: lines.slice(0, tagLineIdx).join("\n").trim(),
        hashtags: lines
          .slice(tagLineIdx)
          .join(" ")
          .match(/#[\p{L}0-9_]+/gu) || [],
        cta: "",
      };
    }
    return { caption: text.trim(), hashtags: [], cta: "" };
  }

  return {
    caption: captionRaw,
    hashtags: hashtagsRaw.match(/#[\p{L}0-9_]+/gu) || [],
    cta: ctaRaw,
  };
}
