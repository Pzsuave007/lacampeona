import React from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Footer() {
  const { lang } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer
      data-testid="site-footer"
      className="relative bg-slate-950 text-white/70 border-t border-white/10 app-bottom-pad"
    >
      {/* Business / utility nav */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 pb-6 border-b border-white/10">
          {/* Negocios */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300 mb-3">
              {lang === "es" ? "Negocios" : "Business"}
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/anuncia"
                  data-testid="footer-link-anuncia"
                  className="inline-flex items-center gap-1.5 hover:text-amber-300 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {lang === "es" ? "Anúnciate" : "Advertise"}
                </Link>
              </li>
              <li>
                <Link
                  to="/advertisers"
                  data-testid="footer-link-advertisers"
                  className="hover:text-amber-300 transition"
                >
                  {lang === "es" ? "Nuestros anunciantes" : "Our advertisers"}
                </Link>
              </li>
            </ul>
          </div>

          {/* Programación */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300 mb-3">
              {lang === "es" ? "Entretenimiento" : "Entertainment"}
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/eventos"
                  data-testid="footer-link-eventos"
                  className="hover:text-amber-300 transition"
                >
                  {lang === "es" ? "Eventos" : "Events"}
                </Link>
              </li>
              <li>
                <Link
                  to="/mundial"
                  data-testid="footer-link-mundial"
                  className="hover:text-amber-300 transition"
                >
                  🏆 Mundial 2026
                </Link>
              </li>
            </ul>
          </div>

          {/* Cuenta */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300 mb-3">
              {lang === "es" ? "Equipo" : "Team"}
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/login"
                  data-testid="footer-link-login"
                  className="hover:text-amber-300 transition"
                >
                  {lang === "es" ? "Iniciar sesión" : "Log in"}
                </Link>
              </li>
            </ul>
          </div>

          {/* Estación */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300 mb-3">
              {lang === "es" ? "Estación" : "Station"}
            </p>
            <p className="text-sm leading-relaxed text-white/60">
              KWIP La Campeona
              <br />
              880 AM / 103.9 FM
              <br />
              Dallas, Oregon
            </p>
          </div>
        </div>
      </div>

      {/* Copyright row */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        <p className="order-2 sm:order-1">
          © {year} KWIP La Campeona 880 AM / 103.9 FM
        </p>
        <p className="order-1 sm:order-2 text-center">
          {lang === "es" ? "Diseñado y hospedado por" : "Designed & hosted by"}{" "}
          <a
            href="https://uni2mkt.com"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="footer-uni2-link"
            className="font-bold text-orange-400 hover:text-orange-300 underline decoration-dotted underline-offset-4 transition"
          >
            Uni2 Marketing Group
          </a>
        </p>
      </div>
    </footer>
  );
}
