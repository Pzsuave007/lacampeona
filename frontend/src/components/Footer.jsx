import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Footer() {
  const { lang } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer
      data-testid="site-footer"
      className="relative bg-slate-950 text-white/70 border-t border-white/10 app-bottom-pad"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
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
