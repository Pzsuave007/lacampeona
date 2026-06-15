import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  Calendar,
  CalendarPlus,
  MapPin,
  Radio as RadioIcon,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useStation } from "../contexts/StationContext";
import { WORLD_CUP_INFO, WORLD_CUP_MATCHES } from "../data/staticContent";
import { waLink } from "../lib/api";

const TZ = "America/Los_Angeles"; // Oregon / Pacific — match times shown in PDT

function fmtDate(iso, lang) {
  const d = new Date(iso);
  const opts = { weekday: "short", day: "numeric", month: "short", timeZone: TZ };
  return d.toLocaleDateString(lang === "es" ? "es-MX" : "en-US", opts);
}
function fmtTime(iso, lang) {
  const d = new Date(iso);
  // Always 12-hour AM/PM (e.g. "3:00 PM") — clearer than 24h for listeners.
  const opts = { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ };
  return d.toLocaleTimeString("en-US", opts);
}

// Group matches by date string
function groupByDay(matches, lang) {
  const map = new Map();
  for (const m of matches) {
    const key = fmtDate(m.kickoff, lang);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  }
  return Array.from(map.entries());
}

// ---- Add a match to the phone/computer calendar (.ics, works on iOS+Android) ----
const pad2 = (n) => String(n).padStart(2, "0");
function icsStamp(d) {
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  );
}
const icsEsc = (s) =>
  String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

function addMatchToCalendar(match, lang) {
  const start = new Date(match.kickoff);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // ~2h
  const listenUrl = (typeof window !== "undefined" ? window.location.origin : "https://lacampeona880am.com");
  const matchup = `${match.home.name} vs ${match.away.name}`;
  const title = `⚽ ${matchup} — Mundial 2026`;
  const desc = (lang === "es"
    ? `Escucha el partido EN VIVO en La Campeona 880 AM. Abre la app: ${listenUrl}`
    : `Listen LIVE on La Campeona 880 AM. Open the app: ${listenUrl}`);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Campeona 880 AM//Mundial 2026//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${match.id}@lacampeona880am.com`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEsc(title)}`,
    `DESCRIPTION:${icsEsc(desc)}`,
    `LOCATION:${icsEsc(match.venue)}`,
    `URL:${listenUrl}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEsc((lang === "es" ? "Pronto en La Campeona: " : "Soon on La Campeona: ") + matchup)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${match.id}-mundial2026.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Show only matches from "today" through the next `days-1` days. Past matches
// are hidden. Before the tournament starts (or if today has no games yet), the
// window anchors to the earliest upcoming match so the calendar is never empty.
function filterUpcoming(matches, days = 4) {
  if (!matches || matches.length === 0) return [];
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const today = startOfDay(new Date());
  const firstMatch = startOfDay(
    matches.reduce((min, m) => {
      const k = new Date(m.kickoff);
      return k < min ? k : min;
    }, new Date(matches[0].kickoff))
  );
  const anchor = today > firstMatch ? today : firstMatch; // max(today, firstMatch)
  const end = new Date(anchor);
  end.setDate(end.getDate() + (days - 1));
  end.setHours(23, 59, 59, 999);
  return matches.filter((m) => {
    const k = new Date(m.kickoff);
    return k >= anchor && k <= end;
  });
}

export default function Mundial() {
  const { lang } = useLanguage();
  const { settings } = useStation();
  const [showAll, setShowAll] = useState(false);
  const grouped = showAll
    ? groupByDay(WORLD_CUP_MATCHES, lang)
    : groupByDay(filterUpcoming(WORLD_CUP_MATCHES, 4), lang);
  const stationWa = waLink(
    settings?.station_whatsapp,
    lang === "es"
      ? "Hola, quiero info de la cobertura del Mundial en La Campeona"
      : "Hi, I want info about World Cup coverage on La Campeona",
  );

  return (
    <div data-testid="mundial-page" className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0F2A1A] via-[#0E3B26] to-[#155D32]">
        <div className="absolute -top-24 -left-20 w-[28rem] h-[28rem] rounded-full bg-emerald-400/15 blur-3xl blob-a pointer-events-none" />
        <div className="absolute top-32 -right-20 w-[28rem] h-[28rem] rounded-full bg-amber-400/20 blur-3xl blob-b pointer-events-none" />
        <div className="absolute inset-0 stripes-y opacity-[0.06]" />
        {/* Soccer ball pattern subtle */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 20%, white 2px, transparent 3px), radial-gradient(circle at 70% 60%, white 2px, transparent 3px)",
            backgroundSize: "180px 180px",
          }}
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 md:pt-20 md:pb-20 text-white">
          <span className="inline-flex items-center gap-2 bg-amber-300 text-[#0F2A1A] px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.25em] shadow-md mb-6">
            <Trophy className="w-3.5 h-3.5" />
            {WORLD_CUP_INFO.exclusiveLine}
          </span>
          <p className="font-script text-3xl sm:text-4xl text-amber-200 -rotate-2 mb-2">
            {lang === "es" ? "vívelo con" : "live it with"}
          </p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.92] drop-shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
            <span className="block text-white">Mundial</span>
            <span className="font-script font-normal italic text-amber-300 text-7xl sm:text-8xl lg:text-9xl block -mt-2">
              ¡{lang === "es" ? "en vivo" : "live"}!
            </span>
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-amber-100/95 leading-snug max-w-2xl font-semibold">
            {WORLD_CUP_INFO.edition} · {WORLD_CUP_INFO.hostCountries}
          </p>
          <p className="mt-3 text-white/85 max-w-2xl">
            {lang === "es"
              ? "La Campeona 880 AM · 103.9 FM Fuego transmite los partidos del Mundial 2026 EN ESPAÑOL, en vivo y exclusivos para todo Oregon."
              : "La Campeona 880 AM · 103.9 FM Fuego brings every World Cup 2026 match LIVE in Spanish, exclusive across Oregon."}
          </p>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
            <Stat label="Equipos" number={WORLD_CUP_INFO.teams} />
            <Stat label="Partidos" number={WORLD_CUP_INFO.matches} />
            <Stat label="Sedes" number="3" sub="USA · CAN · MEX" />
            <Stat label="Inicia" number="11 Jun" sub="2026" />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => {
                const btn = document.querySelector('[data-testid="player-play-btn"]');
                btn && btn.click();
              }}
              data-testid="mundial-listen-btn"
              className="group inline-flex items-center gap-2 bg-amber-300 hover:bg-amber-400 text-[#0F2A1A] font-black rounded-full px-7 py-4 shadow-[0_15px_40px_rgba(252,211,77,0.25)] transition hover:-translate-y-1 active:scale-95"
            >
              <RadioIcon className="w-5 h-5" />
              {lang === "es" ? "Escucha en vivo" : "Listen live"}
            </button>
            {stationWa && (
              <a
                href={stationWa}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="mundial-wa-btn"
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/25 hover:bg-white/20 text-white font-bold rounded-full px-7 py-4 transition hover:-translate-y-1 active:scale-95"
              >
                {lang === "es" ? "Pregunta por patrocinios" : "Ask about sponsorship"}
                <ChevronRight className="w-5 h-5" />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Match calendar */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
        <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700 mb-2 inline-flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {showAll
                ? (lang === "es" ? "Calendario completo" : "Full schedule")
                : (lang === "es" ? "Próximos partidos" : "Upcoming matches")}
            </p>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter">
              {showAll ? (
                <>
                  {lang === "es" ? "Los " : "All "}
                  <span className="font-script font-normal italic text-emerald-700">
                    {lang === "es" ? "104 partidos" : "104 matches"}
                  </span>
                </>
              ) : (
                <>
                  {lang === "es" ? "Hoy y los " : "Today & the "}
                  <span className="font-script font-normal italic text-emerald-700">
                    {lang === "es" ? "próximos días" : "next days"}
                  </span>
                </>
              )}
            </h2>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => setShowAll((v) => !v)}
              data-testid="toggle-all-matches"
              className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-full px-5 py-2.5 transition active:scale-95 shadow-sm"
            >
              <Calendar className="w-4 h-4" />
              {showAll
                ? (lang === "es" ? "Ver solo próximos" : "Show upcoming only")
                : (lang === "es" ? "Ver calendario completo" : "View full schedule")}
            </button>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              {lang === "es" ? "Hora de Oregon (PDT)" : "Oregon time (PDT)"}
            </span>
          </div>
        </div>

        {grouped.length === 0 ? (
          <div className="text-center py-16 bg-emerald-50 rounded-3xl border-2 border-dashed border-emerald-200">
            <Trophy className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
            <p className="font-black text-xl text-slate-700">
              {lang === "es" ? "No hay partidos en los próximos días" : "No matches in the next few days"}
            </p>
            <p className="text-slate-500 mt-1">
              {lang === "es" ? "Vuelve pronto para la siguiente jornada." : "Check back soon for the next round."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(([day, items]) => (
              <div key={day}>
                <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-slate-500 mb-3 inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" /> {day}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((m) => (
                    <MatchCard key={m.id} match={m} lang={lang} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quiniela / Bracket section (moved here from the main menu) */}
      <section className="bg-gradient-to-br from-[#3F0A0A] via-[#7F1D1D] to-[#991B1B] text-white py-14 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-300 font-bold mb-2 inline-flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                {lang === "es" ? "Juega gratis" : "Play free"}
              </p>
              <h3 className="text-4xl sm:text-5xl font-black tracking-tighter leading-[0.95]">
                {lang === "es" ? "La Quiniela del " : "The "}
                <span className="font-script font-normal italic text-amber-300">
                  {lang === "es" ? "Mundial 2026" : "World Cup 2026 bracket"}
                </span>
              </h3>
              <p className="mt-4 text-amber-100/90 max-w-xl">
                {lang === "es"
                  ? "Arma tu bracket completo, predice al campeón y reta a tus amigos. ¡El que más puntos sume gana!"
                  : "Build your full bracket, predict the champion and challenge your friends. Top points wins!"}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                to="/quiniela/bracket"
                data-testid="mundial-quiniela-cta"
                className="inline-flex items-center justify-center gap-2 bg-amber-300 hover:bg-amber-400 text-[#3F0A0A] font-black rounded-full px-7 py-4 transition active:scale-95 shadow-lg"
              >
                <Trophy className="w-5 h-5" />
                {lang === "es" ? "Hacer mi bracket" : "Make my bracket"}
              </Link>
              <Link
                to="/quiniela/leaderboard"
                data-testid="mundial-leaderboard-cta"
                className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/25 hover:bg-white/20 text-white font-bold rounded-full px-7 py-3 transition active:scale-95"
              >
                {lang === "es" ? "Ver tabla de posiciones" : "View leaderboard"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA bottom */}
      <section className="bg-[#0F2A1A] text-white py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300 font-bold mb-2">
              {lang === "es" ? "Patrocinios disponibles" : "Sponsorships available"}
            </p>
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight">
              {lang === "es"
                ? "Tu marca al lado de cada gol del Mundial."
                : "Your brand next to every goal."}
            </h3>
            <p className="mt-3 text-white/80 max-w-xl">
              {lang === "es"
                ? "Spots premium, menciones del comentarista y patrocinio exclusivo de partidos clave."
                : "Premium spots, in-commentary mentions, and exclusive game sponsorships."}
            </p>
          </div>
          <Link
            to="/anuncia"
            data-testid="mundial-to-sales"
            className="inline-flex items-center justify-center gap-2 bg-amber-300 hover:bg-amber-400 text-[#0F2A1A] font-black rounded-full px-7 py-4 transition active:scale-95 shadow-lg"
          >
            {lang === "es" ? "Ver paquetes" : "See packages"}
            <Sparkles className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, number, sub }) {
  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3">
      <p className="text-3xl font-black tracking-tighter text-amber-300">{number}</p>
      <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/80">{label}</p>
      {sub && <p className="text-[10px] text-white/60 mt-0.5">{sub}</p>}
    </div>
  );
}

function MatchCard({ match, lang }) {
  const { home, away, stage, venue, featured, isFinal } = match;
  return (
    <div
      data-testid={`match-card-${match.id}`}
      className={`relative rounded-2xl overflow-hidden border-2 transition hover:-translate-y-1 hover:shadow-xl ${
        isFinal
          ? "border-amber-400 bg-gradient-to-br from-amber-50 to-amber-100"
          : featured
            ? "border-emerald-700 bg-white"
            : "border-slate-200 bg-white"
      }`}
    >
      {featured && !isFinal && (
        <span className="absolute top-3 right-3 wiggle px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] text-white bg-emerald-700 shadow-md">
          ★ Destacado
        </span>
      )}
      {isFinal && (
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] text-amber-900 bg-amber-300 shadow-md">
          🏆 Final
        </span>
      )}
      <div className="p-5">
        <p className="text-[10px] uppercase tracking-[0.25em] font-extrabold text-slate-500 mb-3">
          {stage}
        </p>
        <div className="flex items-center gap-3 mb-4">
          <Team team={home} />
          <span className="text-xs font-black text-slate-400 uppercase">vs</span>
          <Team team={away} reverse />
        </div>
        <div className="flex items-center gap-2 text-[12px] font-bold text-slate-700 mb-1">
          <span className="font-mono text-base text-emerald-700 font-black">
            {fmtTime(match.kickoff, lang)}
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">PDT</span>
        </div>
        <p className="text-[12px] text-slate-500 inline-flex items-start gap-1">
          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {venue}
        </p>
        <button
          onClick={() => addMatchToCalendar(match, lang)}
          data-testid={`add-calendar-${match.id}`}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[13px] rounded-full px-4 py-2.5 transition active:scale-95"
        >
          <CalendarPlus className="w-4 h-4" />
          {lang === "es" ? "Añadir a mi calendario" : "Add to my calendar"}
        </button>
      </div>
      <div
        className={`px-5 py-2 text-[11px] font-extrabold uppercase tracking-wider flex items-center justify-between ${
          isFinal
            ? "bg-amber-300 text-amber-900"
            : "bg-slate-900 text-amber-300"
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          <RadioIcon className="w-3.5 h-3.5" />
          La Campeona 880 AM
        </span>
        <span className="opacity-80">{lang === "es" ? "EN VIVO" : "LIVE"}</span>
      </div>
    </div>
  );
}

function Team({ team, reverse }) {
  return (
    <div className={`flex-1 flex items-center gap-2 ${reverse ? "flex-row-reverse text-right" : ""}`}>
      <span className="text-3xl leading-none">{team.flag}</span>
      <p className="font-extrabold text-slate-900 truncate">{team.name}</p>
    </div>
  );
}
