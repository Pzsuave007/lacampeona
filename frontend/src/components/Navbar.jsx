import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Radio, Menu, X, Languages, LogOut, ShieldCheck } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useStation } from "../contexts/StationContext";

export default function Navbar() {
  const { t, lang, toggle } = useLanguage();
  const { user, logout } = useAuth();
  const { settings } = useStation();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

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
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md group-hover:scale-105 transition">
            <Radio className="w-5 h-5 text-slate-900" strokeWidth={2.5} />
          </span>
          <span className="font-black text-lg tracking-tight text-slate-900">
            {settings?.station_name || "Radio Latina"}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/" end className={linkClass} data-testid="nav-home-link">
            {t.nav.home}
          </NavLink>
          <NavLink to="/advertisers" className={linkClass} data-testid="nav-advertisers-link">
            {t.nav.advertisers}
          </NavLink>
          {user?.role === "admin" && (
            <NavLink to="/admin" className={linkClass} data-testid="nav-admin-link">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> {t.nav.admin}
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
          {user?.role === "admin" && (
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
            <NavLink to="/advertisers" onClick={() => setOpen(false)} className={linkClass} data-testid="nav-mobile-advertisers">
              {t.nav.advertisers}
            </NavLink>
            {user?.role === "admin" && (
              <NavLink to="/admin" onClick={() => setOpen(false)} className={linkClass} data-testid="nav-mobile-admin">
                {t.nav.admin}
              </NavLink>
            )}
            {user === null && (
              <Link to="/login" onClick={() => setOpen(false)} className="px-3 py-2 rounded-full text-sm font-bold bg-slate-900 text-white text-center" data-testid="nav-mobile-login">
                {t.nav.login}
              </Link>
            )}
            {user?.role === "admin" && (
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
