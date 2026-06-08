import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X, Languages, LogOut, ShieldCheck, Crown } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useStation } from "../contexts/StationContext";
import { bannerUrl } from "../lib/api";

const DEFAULT_LOGO = "/logos/la-campeona-880am.png";

export default function Navbar() {
  const { t, lang, toggle } = useLanguage();
  const { user, logout } = useAuth();
  const { settings } = useStation();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const logoSrc = settings?.station_logo ? bannerUrl(settings.station_logo) : DEFAULT_LOGO;

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-full text-sm font-bold transition ${
      isActive
        ? "bg-slate-900 text-white"
        : "text-slate-700 hover:bg-orange-100"
    }`;

  return (
    <header
      data-testid="navbar"
      className="sticky top-0 z-40 bg-orange-50/80 backdrop-blur-xl border-b border-orange-900/10"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <Link
          to="/"
          data-testid="nav-home-logo"
          className="flex items-center gap-2 group"
        >
          <img
            src={logoSrc}
            alt="La Campeona 880 AM"
            width="160"
            height="64"
            className="h-12 sm:h-14 w-auto object-contain group-hover:scale-105 transition drop-shadow-[0_2px_4px_rgba(0,0,0,0.18)]"
            style={{ imageRendering: "auto" }}
          />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/" end className={linkClass} data-testid="nav-home-link">
            {t.nav.home}
          </NavLink>
          <NavLink to="/mundial" className={linkClass} data-testid="nav-mundial-link">
            <span className="inline-flex items-center gap-1">🏆 Mundial</span>
          </NavLink>
          <NavLink to="/eventos" className={linkClass} data-testid="nav-eventos-link">
            <span className="inline-flex items-center gap-1">📅 {lang === "es" ? "Eventos" : "Events"}</span>
          </NavLink>
          <NavLink to="/blog" className={linkClass} data-testid="nav-blog-link">
            <span className="inline-flex items-center gap-1">📰 Blog</span>
          </NavLink>
          <NavLink to="/quiniela" className={linkClass} data-testid="nav-quiniela-link">
            <span className="inline-flex items-center gap-1">🏆 Quiniela</span>
          </NavLink>
          <NavLink to="/advertisers" className={linkClass} data-testid="nav-advertisers-link">
            {t.nav.advertisers}
          </NavLink>
          {(user?.role === "admin" || user?.role === "super_admin") && (
            <NavLink to="/admin" className={linkClass} data-testid="nav-admin-link">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> {t.nav.admin}
              </span>
            </NavLink>
          )}
          {user?.role === "dj" && (
            <NavLink to="/dj" className={linkClass} data-testid="nav-dj-link">
              <span className="inline-flex items-center gap-1">✨ Studio</span>
            </NavLink>
          )}
          {user?.role === "super_admin" && (
            <NavLink to="/super" className={linkClass} data-testid="nav-super-link">
              <span className="inline-flex items-center gap-1">
                <Crown className="w-4 h-4" /> Super
              </span>
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button
            data-testid="lang-toggle-btn"
            onClick={toggle}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-extrabold uppercase tracking-widest text-orange-600 bg-white border border-orange-200 hover:border-orange-400 transition"
          >
            <Languages className="w-4 h-4" />
            {lang.toUpperCase()}
          </button>

          {user === null && (
            <Link
              to="/login"
              data-testid="nav-login-link"
              className="hidden sm:inline-flex px-4 py-2 rounded-full text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition"
            >
              {t.nav.login}
            </Link>
          )}
          {(user?.role === "admin" || user?.role === "super_admin" || user?.role === "dj") && (
            <button
              data-testid="nav-logout-btn"
              onClick={async () => {
                await logout();
                navigate("/");
              }}
              className="hidden sm:inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm font-bold text-slate-700 hover:bg-orange-100 transition"
            >
              <LogOut className="w-4 h-4" />
              {t.nav.logout}
            </button>
          )}

          <button
            data-testid="nav-mobile-toggle"
            className="md:hidden w-10 h-10 rounded-full bg-white border border-orange-200 flex items-center justify-center"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-orange-900/10 bg-white">
          <div className="px-4 py-3 flex flex-col gap-1">
            <NavLink to="/" end onClick={() => setOpen(false)} className={linkClass} data-testid="nav-mobile-home">
              {t.nav.home}
            </NavLink>
            <NavLink to="/mundial" onClick={() => setOpen(false)} className={linkClass} data-testid="nav-mobile-mundial">
              🏆 Mundial
            </NavLink>
            <NavLink to="/eventos" onClick={() => setOpen(false)} className={linkClass} data-testid="nav-mobile-eventos">
              📅 {lang === "es" ? "Eventos" : "Events"}
            </NavLink>
            <NavLink to="/blog" onClick={() => setOpen(false)} className={linkClass} data-testid="nav-mobile-blog">
              📰 Blog
            </NavLink>
            <NavLink to="/quiniela" onClick={() => setOpen(false)} className={linkClass} data-testid="nav-mobile-quiniela">
              🏆 Quiniela
            </NavLink>
            <NavLink to="/advertisers" onClick={() => setOpen(false)} className={linkClass} data-testid="nav-mobile-advertisers">
              {t.nav.advertisers}
            </NavLink>
            {(user?.role === "admin" || user?.role === "super_admin") && (
              <NavLink to="/admin" onClick={() => setOpen(false)} className={linkClass} data-testid="nav-mobile-admin">
                {t.nav.admin}
              </NavLink>
            )}
            {user?.role === "dj" && (
              <NavLink to="/dj" onClick={() => setOpen(false)} className={linkClass} data-testid="nav-mobile-dj">
                ✨ Studio
              </NavLink>
            )}
            {user?.role === "super_admin" && (
              <NavLink to="/super" onClick={() => setOpen(false)} className={linkClass} data-testid="nav-mobile-super">
                👑 Super
              </NavLink>
            )}
            {user === null && (
              <Link to="/login" onClick={() => setOpen(false)} className="px-3 py-2 rounded-full text-sm font-bold bg-slate-900 text-white text-center" data-testid="nav-mobile-login">
                {t.nav.login}
              </Link>
            )}
            {(user?.role === "admin" || user?.role === "super_admin" || user?.role === "dj") && (
              <button
                data-testid="nav-mobile-logout"
                onClick={async () => {
                  await logout();
                  setOpen(false);
                  navigate("/");
                }}
                className="px-3 py-2 rounded-full text-sm font-bold text-slate-700 text-left hover:bg-orange-100"
              >
                {t.nav.logout}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
