import React, { createContext, useContext, useEffect, useState } from "react";
import { translations } from "../lib/translations";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("rl_lang") || "es");

  useEffect(() => {
    localStorage.setItem("rl_lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const toggle = () => setLang((l) => (l === "es" ? "en" : "es"));
  const t = translations[lang];

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
