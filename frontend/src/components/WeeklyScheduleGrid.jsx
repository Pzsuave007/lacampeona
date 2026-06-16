import React, { useMemo, useState } from "react";
import { Mic2, ChevronLeft, ChevronRight } from "lucide-react";
import { bannerUrl } from "../lib/api";

const DAYS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DAYS_SHORT_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function toMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export default function WeeklyScheduleGrid({ hosts, onEditHost, timezone }) {
  // Show only hours where there is content + a small buffer
  const slots = useMemo(() => {
    const all = [];
    hosts.forEach((h) => {
      (h.schedule || []).forEach((s) => {
        const start = toMin(s.start_time);
        const endRaw = toMin(s.end_time);
        const end = endRaw <= start ? endRaw + 24 * 60 : endRaw;
        all.push({ host: h, day: s.day_of_week, start, end, raw: s });
      });
    });
    return all;
  }, [hosts]);

  const minHour = useMemo(() => {
    if (slots.length === 0) return 6;
    return Math.max(0, Math.floor(Math.min(...slots.map((s) => s.start)) / 60) - 1);
  }, [slots]);

  const maxHour = useMemo(() => {
    if (slots.length === 0) return 24;
    return Math.min(24, Math.ceil(Math.max(...slots.map((s) => s.end)) / 60) + 1);
  }, [slots]);

  const totalHours = Math.max(6, maxHour - minHour);
  const hourPx = 56; // height of each hour row
  const gridHeight = totalHours * hourPx;

  // Group overlapping slots within the same day to render them side-by-side
  const slotsByDay = useMemo(() => {
    const days = Array.from({ length: 7 }, () => []);
    slots.forEach((s) => {
      // Account for overflow across days (end > 24*60 means it spills into next day)
      // For simplicity, we just clamp the end at the day's max
      const day = s.day;
      days[day].push(s);
    });
    days.forEach((arr) => arr.sort((a, b) => a.start - b.start));
    // Assign columns to overlapping slots
    days.forEach((arr) => {
      const cols = [];
      arr.forEach((s) => {
        let col = 0;
        while (cols[col] && cols[col] >= s.start) col++;
        cols[col] = s.end;
        s.col = col;
      });
      const totalCols = cols.length || 1;
      arr.forEach((s) => (s.totalCols = totalCols));
    });
    return days;
  }, [slots]);

  const todayWeekday = (() => {
    // Use station tz if provided
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone || "America/Los_Angeles",
        weekday: "short",
      });
      const wd = fmt.format(new Date());
      const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
      return map[wd] ?? new Date().getDay() - 1;
    } catch {
      return (new Date().getDay() + 6) % 7;
    }
  })();

  const nowMin = (() => {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone || "America/Los_Angeles",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const parts = fmt.format(new Date()).split(":");
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    } catch {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    }
  })();

  return (
    <div data-testid="weekly-schedule-grid" className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Days header */}
      <div className="grid" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
        <div className="bg-slate-100" />
        {DAYS_ES.map((d, i) => (
          <div
            key={i}
            className={`text-center py-3 border-l border-slate-200 ${
              i === todayWeekday ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-700"
            }`}
          >
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold">
              <span className="hidden md:inline">{d}</span>
              <span className="md:hidden">{DAYS_SHORT_ES[i]}</span>
            </div>
            {i === todayWeekday && (
              <div className="text-[10px] font-extrabold text-amber-600 mt-0.5">HOY</div>
            )}
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="grid relative" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
        {/* Hour labels column */}
        <div className="border-t border-slate-200">
          {Array.from({ length: totalHours }).map((_, i) => (
            <div
              key={i}
              className="text-[10px] font-bold text-slate-400 text-right pr-2"
              style={{ height: hourPx, paddingTop: 4 }}
            >
              {String(minHour + i).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        {Array.from({ length: 7 }).map((_, dayIdx) => (
          <div
            key={dayIdx}
            className={`relative border-l border-t border-slate-200 ${
              dayIdx === todayWeekday ? "bg-amber-50/40" : ""
            }`}
            style={{ height: gridHeight }}
          >
            {/* hour grid lines */}
            {Array.from({ length: totalHours }).map((_, i) => (
              <div
                key={i}
                className="absolute inset-x-0 border-b border-dashed border-slate-100"
                style={{ top: i * hourPx, height: hourPx }}
              />
            ))}

            {/* Slot blocks */}
            {slotsByDay[dayIdx].map((s, idx) => {
              const top = ((s.start - minHour * 60) / 60) * hourPx;
              const visibleEnd = Math.min(s.end, maxHour * 60);
              const heightPx = ((visibleEnd - s.start) / 60) * hourPx;
              const widthPct = 100 / s.totalCols;
              const left = s.col * widthPct;
              const color = s.host.color || "#7F1D1D";
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onEditHost && onEditHost(s.host)}
                  data-testid={`grid-slot-${s.host.slug}-${dayIdx}-${idx}`}
                  className="absolute rounded-lg overflow-hidden text-white text-left p-2 shadow-md hover:shadow-xl hover:z-10 transition-all hover:-translate-y-0.5 ring-1 ring-white/20"
                  style={{
                    top,
                    height: Math.max(heightPx - 4, 30),
                    left: `calc(${left}% + 2px)`,
                    width: `calc(${widthPct}% - 4px)`,
                    backgroundColor: color,
                  }}
                >
                  <div className="flex items-start gap-1.5">
                    {s.host.photo_path && (
                      <img
                        src={bannerUrl(s.host.photo_path)}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover ring-2 ring-white/30 shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider opacity-90 font-extrabold leading-none">
                        {s.raw.start_time}–{s.raw.end_time}
                      </p>
                      <p className="text-xs font-extrabold truncate leading-tight mt-0.5">
                        {s.raw.program || s.host.show_name || s.host.name}
                      </p>
                      {heightPx > 50 && (
                        <p className="text-[10px] opacity-90 truncate leading-tight mt-0.5">
                          {s.host.name}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* "Now" line on today */}
            {dayIdx === todayWeekday &&
              nowMin >= minHour * 60 &&
              nowMin <= maxHour * 60 && (
                <>
                  <div
                    className="absolute inset-x-0 z-20 border-t-2 border-red-500"
                    style={{ top: ((nowMin - minHour * 60) / 60) * hourPx }}
                  >
                    <span className="absolute -left-1 -top-2 w-3 h-3 rounded-full bg-red-500 live-dot shadow-lg" />
                  </div>
                </>
              )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 live-dot" />
          <span className="font-bold">Hora actual ({timezone || "America/Los_Angeles"})</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" />
            Hoy
          </span>
          <span>·</span>
          <span>Click en una franja para editar al locutor</span>
        </div>
      </div>
    </div>
  );
}
