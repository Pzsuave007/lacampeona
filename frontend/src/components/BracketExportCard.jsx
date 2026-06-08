import React, { forwardRef } from "react";
import { Trophy } from "lucide-react";

/**
 * Off-screen, fixed-width "full bracket" card used to export a PNG the user can
 * download / share. Shows Octavos → Cuartos → Semis → Final (16 → 1) as a
 * two-sided tree converging on the champion, branded for La Campeona 880 AM.
 * Inline styles only (most reliable for html-to-image rasterisation).
 */

const WINE = "#7F1D1D";
const GOLD = "#FCD34D";
const SLATE = "#cbd5e1";

function MBox({ a, b, win, gold }) {
  const row = (t, last) => {
    const isWin = !!t && t === win;
    return (
      <div
        style={{
          padding: "7px 10px",
          fontSize: 13,
          fontWeight: 800,
          lineHeight: 1.1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          color: isWin ? (gold ? "#3F0A0A" : "#065F46") : "#334155",
          background: isWin ? (gold ? GOLD : "#D1FAE5") : "#fff",
          borderBottom: last ? "none" : "1px solid #EEF2F7",
        }}
      >
        {t || "—"}
      </div>
    );
  };
  return (
    <div
      style={{
        width: 150,
        border: `2px solid ${gold ? GOLD : SLATE}`,
        borderRadius: 8,
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
      }}
    >
      {row(a, false)}
      {row(b, true)}
    </div>
  );
}

function Conn({ mirror }) {
  const near = mirror ? "right" : "left";
  const far = mirror ? "left" : "right";
  return (
    <div style={{ position: "relative", width: 22, alignSelf: "stretch" }}>
      <div style={{ position: "absolute", top: "25%", [near]: "50%", width: 2, height: "50%", background: "#94A3B8" }} />
      <div style={{ position: "absolute", top: "25%", [near]: "50%", width: "50%", height: 2, background: "#94A3B8" }} />
      <div style={{ position: "absolute", bottom: "25%", [near]: "50%", width: "50%", height: 2, background: "#94A3B8" }} />
      <div style={{ position: "absolute", top: "50%", [far]: 0, width: "50%", height: 2, background: "#94A3B8" }} />
    </div>
  );
}

const BracketExportCard = forwardRef(function BracketExportCard(
  { info = {}, r32 = [], r16 = [], qf = [], sf = [], finalPicks = {} },
  ref
) {
  const parts = {
    oct: (i) => [r32[2 * i], r32[2 * i + 1]],
    cua: (i) => [r16[2 * i], r16[2 * i + 1]],
    sem: (i) => [qf[2 * i], qf[2 * i + 1]],
  };
  const winner = {
    oct: (i) => r16[i],
    cua: (i) => qf[i],
    sem: (i) => sf[i],
  };
  const PREV = { sem: "cua", cua: "oct" };

  const half = (round, idx, mirror) => {
    if (round === "oct") {
      const [a, b] = parts.oct(idx);
      return (
        <div key={`oct-${idx}`} style={{ display: "flex", alignItems: "center" }}>
          <MBox a={a} b={b} win={winner.oct(idx)} />
        </div>
      );
    }
    const prev = PREV[round];
    const [a, b] = parts[round](idx);
    return (
      <div
        key={`${round}-${idx}`}
        style={{ display: "flex", alignItems: "center", flexDirection: mirror ? "row-reverse" : "row" }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
          {half(prev, idx * 2, mirror)}
          {half(prev, idx * 2 + 1, mirror)}
        </div>
        <Conn mirror={mirror} />
        <MBox a={a} b={b} win={winner[round](idx)} />
      </div>
    );
  };

  const colHead = (txt) => (
    <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 900, color: "#FCD34D", textTransform: "uppercase" }}>{txt}</div>
  );

  return (
    <div
      ref={ref}
      style={{
        width: 1260,
        padding: 28,
        background: `linear-gradient(135deg, #3F0A0A 0%, ${WINE} 55%, #991B1B 100%)`,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 6 }}>
            <img src="/logos/la-campeona-880am.png" alt="La Campeona" width={62} height={62} crossOrigin="anonymous" style={{ objectFit: "contain", display: "block" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 900, color: GOLD }}>MI BRACKET · MUNDIAL 2026</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>{info.name || "Tu nombre"}</div>
            {info.city ? <div style={{ fontSize: 13, color: "#FED7AA" }}>{info.city}</div> : null}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: GOLD, lineHeight: 1.1 }}>880 AM · 103.9 FM</div>
          <div style={{ fontSize: 12, color: "#FED7AA" }}>La Campeona · ¡La que manda!</div>
        </div>
      </div>

      {/* Bracket tree */}
      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 18, padding: "18px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px 10px", color: "#fff" }}>
          {colHead("Octavos")}{colHead("Cuartos")}{colHead("Semis")}{colHead("Final")}{colHead("Semis")}{colHead("Cuartos")}{colHead("Octavos")}
        </div>
        <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", height: 600 }}>
          {half("sem", 0, false)}
          {/* Center: Final + Champion */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 10px", minWidth: 180 }}>
            <MBox a={sf[0]} b={sf[1]} win={finalPicks.champion} gold />
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <Trophy size={26} color={GOLD} style={{ display: "block", margin: "0 auto 4px" }} />
              <div style={{ fontSize: 10, letterSpacing: 3, fontWeight: 900, color: GOLD }}>CAMPEÓN</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{finalPicks.champion || "?"}</div>
              {(finalPicks.final_score_home !== "" && finalPicks.final_score_away !== "") ? (
                <div style={{ fontSize: 12, color: "#FED7AA", marginTop: 2 }}>
                  {finalPicks.champion} {finalPicks.final_score_home}-{finalPicks.final_score_away} {finalPicks.runner_up}
                </div>
              ) : null}
              {finalPicks.third_place_winner ? (
                <div style={{ fontSize: 11, color: "#FED7AA", marginTop: 4 }}>3er lugar: {finalPicks.third_place_winner}</div>
              ) : null}
            </div>
          </div>
          {half("sem", 1, true)}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 16, textAlign: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>
        Haz tu bracket gratis en <span style={{ color: GOLD }}>lacampeona880am.com</span>
      </div>
    </div>
  );
});

export default BracketExportCard;
