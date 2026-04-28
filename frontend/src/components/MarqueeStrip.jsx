import React from "react";

export default function MarqueeStrip({ items, color = "#0F172A", textColor = "#FACC15", speed = "marquee-track" }) {
  const all = [...items, ...items, ...items];
  return (
    <div
      data-testid="marquee-strip"
      className="overflow-hidden border-y-4 border-slate-900 select-none"
      style={{ backgroundColor: color, color: textColor }}
    >
      <div className={`flex py-3 ${speed}`}>
        {all.map((it, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-3 mx-6 font-black uppercase tracking-[0.18em] text-sm sm:text-base whitespace-nowrap"
          >
            <span className="text-2xl leading-none" aria-hidden>
              ★
            </span>
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
