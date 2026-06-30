import React, { useEffect, useMemo, useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { WORLD_CUP_MATCHES } from "../data/staticContent";
import { R32_ACTUAL, R32_SLOTS, useIsDesktop } from "../pages/QuinielaBracket";

// name -> flag emoji, derived from the schedule data.
const FLAGS = (() => {
  const map = {};
  for (const m of WORLD_CUP_MATCHES) {
    if (m.home?.name && m.home?.flag) map[m.home.name] = m.home.flag;
    if (m.away?.name && m.away?.flag) map[m.away.name] = m.away.flag;
  }
  return map;
})();

// name -> ISO code for flagcdn.com (real flag images — render the same on every
// device, unlike flag emoji which Windows shows as 2-letter codes).
const ISO = {
  "México": "mx", "Sudáfrica": "za", "Corea del Sur": "kr", "Chequia": "cz",
  "Canadá": "ca", "Bosnia": "ba", "Catar": "qa", "Suiza": "ch",
  "Brasil": "br", "Marruecos": "ma", "Haití": "ht", "Escocia": "gb-sct",
  "USA": "us", "Paraguay": "py", "Australia": "au", "Türkiye": "tr",
  "Alemania": "de", "Curazao": "cw", "Costa de Marfil": "ci", "Ecuador": "ec",
  "Países Bajos": "nl", "Japón": "jp", "Suecia": "se", "Túnez": "tn",
  "Bélgica": "be", "Egipto": "eg", "Irán": "ir", "Nueva Zelanda": "nz",
  "España": "es", "Cabo Verde": "cv", "Arabia Saudita": "sa", "Uruguay": "uy",
  "Francia": "fr", "Senegal": "sn", "Irak": "iq", "Noruega": "no",
  "Argentina": "ar", "Argelia": "dz", "Austria": "at", "Jordania": "jo",
  "Portugal": "pt", "Rep. del Congo": "cg", "Uzbekistán": "uz", "Colombia": "co",
  "Inglaterra": "gb-eng", "Croacia": "hr", "Ghana": "gh", "Panamá": "pa",
};

function Flag({ team, className = "w-5 h-[15px]" }) {
  const code = ISO[team];
  if (!code) {
    return <span className="text-base leading-none shrink-0">{FLAGS[team] || "🏳️"}</span>;
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      alt={team}
      loading="lazy"
      className={`${className} object-cover rounded-[2px] shrink-0 ring-1 ring-black/20`}
    />
  );
}

const PREV = { sf: "qf", qf: "r16", r16: "r32" };
const ROUND_LABEL = { r32: "16vos", r16: "Octavos", qf: "Cuartos", sf: "Semis" };
const ROUND_COUNT = { r32: 16, r16: 8, qf: 4, sf: 2 };

function seedText(spec) {
  if (!spec) return "";
  if (spec.t === "w") return `1º ${spec.g}`;
  if (spec.t === "r") return `2º ${spec.g}`;
  return `3º · ${(spec.groups || []).join("·")}`;
}

export default function LiveBracket() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    let alive = true;
    api.get("/bracket/official")
      .then(({ data }) => { if (alive) setData(data); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const groups = data?.groups || {};
  const results = data?.results || {};

  const groupPositions = useMemo(() => {
    const gp = results.group_positions;
    return gp && Object.keys(gp).length ? gp : {};
  }, [results]);

  // Group stage is over — the Round-of-32 matchups are the real, known teams.
  const r32Matchups = R32_ACTUAL;

  const r32 = results.r32_winners || [];
  const r16 = results.r16_winners || [];
  const qf = results.qf_winners || [];
  const sf = results.sf_winners || [];
  const champion = results.champion || "";

  const getParts = (round, idx) => {
    if (round === "r32") return r32Matchups[idx] || [undefined, undefined];
    if (round === "r16") return [r32[idx * 2], r32[idx * 2 + 1]];
    if (round === "qf") return [r16[idx * 2], r16[idx * 2 + 1]];
    if (round === "sf") return [qf[idx * 2], qf[idx * 2 + 1]];
    return [sf[0], sf[1]];
  };
  const getWinner = (round, idx) => {
    if (round === "r32") return r32[idx];
    if (round === "r16") return r16[idx];
    if (round === "qf") return qf[idx];
    if (round === "sf") return sf[idx];
    return champion;
  };
  const getSeed = (round, idx) => (round === "r32" ? (R32_SLOTS[idx] || []).map(seedText) : null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-amber-200/70" data-testid="live-bracket-loading">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando bracket…
      </div>
    );
  }

  const hasAny = champion || r32.some(Boolean) || Object.keys(groupPositions).length;

  return (
    <div data-testid="live-bracket">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 text-amber-300 text-[10px] font-black uppercase tracking-[0.3em] mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Al momento
        </div>
        <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center justify-center gap-3">
          <Trophy className="w-8 h-8 text-amber-400" /> Bracket en vivo
        </h3>
        <p className="text-amber-100/60 text-sm mt-1">El árbol del Mundial, actualizado conforme avanzan los partidos.</p>
        {champion && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white px-5 py-2.5 shadow-lg" data-testid="live-bracket-champion">
            <Trophy className="w-5 h-5" />
            <span className="text-xs font-extrabold uppercase tracking-[0.2em]">Campeón</span>
            <span className="text-xl font-black inline-flex items-center gap-2"><Flag team={champion} className="w-6 h-[18px]" /> {champion}</span>
          </div>
        )}
      </div>

      {/* Group cards (top 6 + bottom 6) */}
      <GroupCards groups={groups} />

      {!hasAny && (
        <p className="text-center text-amber-100/50 text-sm my-8" data-testid="live-bracket-empty">
          El bracket se irá llenando cuando empiecen las eliminatorias. ¡Vuelve pronto! 🏆
        </p>
      )}

      {/* Legend: how the 8 best third-placed teams work */}
      <div className="mt-6 rounded-2xl bg-amber-400/[0.07] border border-amber-400/20 p-4 text-sm text-amber-100/80 leading-relaxed" data-testid="live-bracket-thirds-legend">
        <span className="font-black text-amber-300">¿Cómo entran los 8 mejores terceros?</span>{" "}
        De los 12 grupos avanzan los <b>8 mejores terceros lugares</b>, ordenados por <b>puntos</b>, luego <b>diferencia de goles</b> y <b>goles a favor</b> (regla oficial FIFA). Cada uno se coloca en un espacio marcado <span className="font-bold text-white">"3º · A·B·C…"</span> según de qué grupo proviene. En cuanto se definan, aquí aparecerán con su bandera y nombre. 🌎
      </div>

      {/* Bracket tree */}
      <div className="mt-8">
        {isDesktop ? (
          <div className="space-y-10">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-300 mb-3">Lado izquierdo del cuadro</div>
              <div className="overflow-x-auto pb-2">
                <div className="flex justify-center min-w-max">
                  {renderHalf("sf", 0, false, { getParts, getWinner, getSeed })}
                </div>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-300 mb-3">Lado derecho del cuadro</div>
              <div className="overflow-x-auto pb-2">
                <div className="flex justify-center min-w-max">
                  {renderHalf("sf", 1, false, { getParts, getWinner, getSeed })}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center pt-2">
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-400 mb-2 flex items-center gap-1.5">
                <Trophy className="w-4 h-4" /> Final
              </div>
              <div style={{ minWidth: 200 }}>
                <MatchBox round="final" idx={0} gold getParts={getParts} getWinner={getWinner} getSeed={getSeed} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {["r32", "r16", "qf", "sf"].map((round) => (
              <div key={round}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">{ROUND_LABEL[round]}</span>
                  <span className="text-xs text-amber-100/40">({ROUND_COUNT[round]})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Array.from({ length: ROUND_COUNT[round] }).map((_, i) => (
                    <MatchBox key={i} round={round} idx={i} getParts={getParts} getWinner={getWinner} getSeed={getSeed} />
                  ))}
                </div>
              </div>
            ))}
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400 mb-2 flex items-center gap-1.5">
                <Trophy className="w-4 h-4" /> Final
              </div>
              <MatchBox round="final" idx={0} gold getParts={getParts} getWinner={getWinner} getSeed={getSeed} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupCards({ groups }) {
  const ids = Object.keys(groups);
  if (!ids.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5" data-testid="live-bracket-groups">
      {ids.map((gid) => (
        <div key={gid} className="rounded-xl bg-white/[0.04] border border-white/10 p-3" data-testid={`live-group-${gid}`}>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300 mb-2 text-center">Grupo {gid}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {(groups[gid] || []).map((team) => (
              <div key={team} className="flex items-center gap-1.5 min-w-0">
                <Flag team={team} className="w-4 h-3" />
                <span className="text-[11px] font-semibold text-white/80 truncate">{team}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchBox({ round, idx, gold, getParts, getWinner, getSeed }) {
  const [a, b] = getParts(round, idx);
  const winner = getWinner(round, idx);
  const seeds = getSeed ? getSeed(round, idx) : null;
  return (
    <div
      className={`rounded-lg overflow-hidden border w-full ${gold ? "border-amber-400/70" : "border-white/10"} bg-white/[0.04]`}
      style={{ minWidth: 150 }}
      data-testid={`live-${round}-${idx}`}
    >
      {[a, b].map((team, ti) => {
        const isWin = winner && winner === team;
        const label = team || (seeds ? seeds[ti] : "Por definir");
        return (
          <div
            key={ti}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-bold ${ti === 0 ? "border-b border-white/10" : ""} ${
              isWin
                ? gold ? "bg-amber-400 text-slate-900" : "bg-emerald-500/90 text-white"
                : team ? "text-white/85" : "text-white/35"
            }`}
          >
            {team && <Flag team={team} className="w-5 h-[15px]" />}
            <span className="truncate">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Connector({ mirror }) {
  return (
    <div className="relative self-stretch w-6 shrink-0">
      <div className={`absolute top-1/4 h-0.5 bg-white/20 -translate-y-1/2 ${mirror ? "right-0 left-1/2" : "left-0 right-1/2"}`} />
      <div className={`absolute bottom-1/4 h-0.5 bg-white/20 translate-y-1/2 ${mirror ? "right-0 left-1/2" : "left-0 right-1/2"}`} />
      <div className={`absolute top-1/4 bottom-1/4 w-0.5 bg-white/20 ${mirror ? "left-1/2" : "right-1/2"}`} />
      <div className={`absolute top-1/2 w-1/2 h-0.5 bg-white/20 -translate-y-1/2 ${mirror ? "left-0" : "right-0"}`} />
    </div>
  );
}

function renderHalf(round, idx, mirror, mc) {
  if (round === "r32") {
    return (
      <div className="flex items-center" style={{ minWidth: 150 }} key={`r32-${idx}`}>
        <MatchBox round="r32" idx={idx} {...mc} />
      </div>
    );
  }
  const prev = PREV[round];
  return (
    <div className={`flex items-center ${mirror ? "flex-row-reverse" : ""}`} key={`${round}-${idx}`}>
      <div className="flex flex-col justify-center gap-3">
        {renderHalf(prev, idx * 2, mirror, mc)}
        {renderHalf(prev, idx * 2 + 1, mirror, mc)}
      </div>
      <Connector mirror={mirror} />
      <div className="flex items-center" style={{ minWidth: 150 }}>
        <MatchBox round={round} idx={idx} {...mc} />
      </div>
    </div>
  );
}
