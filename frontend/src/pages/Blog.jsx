import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Calendar, ArrowRight, Newspaper } from "lucide-react";
import { api, bannerUrl } from "../lib/api";
import { useLanguage } from "../contexts/LanguageContext";

// Strip the AI section labels [CAPTION]/[HASHTAGS]/[CTA] before showing
// a preview, and pull just the caption body.
function captionPreview(text) {
  if (!text) return "";
  const m = text.match(/\[CAPTION\]\s*([\s\S]*?)(?=\n\s*\[(?:HASHTAGS|CTA)\]|$)/i);
  const body = (m ? m[1] : text)
    .replace(/^\s*\[(CAPTION|HASHTAGS|CTA)\]\s*:?\s*$/gim, "")
    .replace(/\[(CAPTION|HASHTAGS|CTA)\]\s*:?/gi, "")
    .trim();
  return body;
}

export default function Blog() {
  const { lang } = useLanguage();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/posts/recent?limit=60")
      .then(({ data }) => { if (!cancelled) setPosts(data || []); })
      .catch(() => { if (!cancelled) setPosts([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div data-testid="blog-page" className="bg-slate-50 min-h-screen">
      <header className="relative overflow-hidden bg-gradient-to-br from-[#3F0A0A] via-[#7F1D1D] to-[#991B1B] text-white">
        <div className="absolute -top-24 -left-20 w-[28rem] h-[28rem] rounded-full bg-rose-600/30 blur-3xl blob-a pointer-events-none" />
        <div className="absolute -bottom-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-amber-400/15 blur-3xl blob-b pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-amber-200 text-xs font-extrabold uppercase tracking-[0.25em] mb-4">
            <Newspaper className="w-3.5 h-3.5" />
            {lang === "es" ? "El blog de La Campeona" : "La Campeona Blog"}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[1.05]" data-testid="blog-title">
            {lang === "es" ? "Historias, recetas y nuestra gente" : "Stories, recipes & our people"}
          </h1>
          <p className="mt-4 text-white/85 max-w-2xl">
            {lang === "es"
              ? "Contenido hecho con cariño para la comunidad latina de Oregon. Sintoniza La Campeona mientras lees."
              : "Made with love for Oregon's Latino community. Tune in to La Campeona while you read."}
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {loading ? (
          <div className="text-slate-500 text-center py-20">Cargando…</div>
        ) : posts.length === 0 ? (
          <div data-testid="blog-empty" className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-orange-200">
            <Newspaper className="w-12 h-12 text-orange-400 mx-auto mb-4" />
            <h3 className="text-xl font-black text-slate-900">
              {lang === "es" ? "Muy pronto" : "Coming soon"}
            </h3>
            <p className="text-slate-500 mt-1">
              {lang === "es"
                ? "Los DJs están preparando contenido. Vuelve pronto."
                : "DJs are crafting content. Check back soon."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((p) => (
              <PostCard key={p.slug} post={p} lang={lang} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function PostCard({ post, lang }) {
  const cover = post.cover_image ? bannerUrl(post.cover_image) : null;
  const preview = captionPreview(post.text);
  const title = post.title || preview.split("\n")[0]?.slice(0, 110) || "Post";
  const dateStr = post.created_at
    ? new Date(post.created_at).toLocaleDateString(lang === "es" ? "es-MX" : "en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <Link
      to={`/p/${post.slug}`}
      data-testid={`blog-card-${post.slug}`}
      className="group bg-white rounded-3xl overflow-hidden border border-slate-200 hover:border-orange-300 hover:shadow-xl transition flex flex-col"
    >
      {cover ? (
        <div className="aspect-video overflow-hidden bg-slate-100">
          <img
            src={cover}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-orange-100 to-rose-100 flex items-center justify-center">
          <Newspaper className="w-12 h-12 text-orange-400" />
        </div>
      )}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-lg font-black text-slate-900 leading-snug line-clamp-3 group-hover:text-orange-600 transition">
          {title}
        </h3>
        {preview && (
          <p className="text-sm text-slate-600 mt-2 line-clamp-3">
            {preview.replace(/^.+?\n/, "")}
          </p>
        )}
        <div className="mt-auto pt-4 flex items-center justify-between text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {dateStr}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            {(post.views_count || 0).toLocaleString()}
          </span>
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-orange-600 group-hover:gap-2 transition-all">
          {lang === "es" ? "Leer post" : "Read post"} <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
}
