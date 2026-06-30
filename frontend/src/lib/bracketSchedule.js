// Resolves the knockout matches in the Mundial schedule (worldCupMatches.js)
// to real team names as the admin marks winners in /admin/bracket.
//
// The R32 entries (wc-073..wc-088) already carry the real teams (group stage is
// over). For R16 → Final, each schedule id maps to the two bracket-tree feeders
// that produce its teams. Feeders use the SAME tree indexing the bracket uses:
//   r16[i] = winner(r32[2i]) vs winner(r32[2i+1]), and so on up to the Final.
// (Mapping verified vs the official FIFA 2026 knockout schedule + Google bracket.)

const KO_FEEDERS = {
  // Octavos (R16): each feeds from two R32 tree-winners.
  "wc-089": [["r32", 2], ["r32", 3]],
  "wc-090": [["r32", 0], ["r32", 1]],
  "wc-091": [["r32", 8], ["r32", 9]],
  "wc-092": [["r32", 10], ["r32", 11]],
  "wc-093": [["r32", 4], ["r32", 5]],
  "wc-094": [["r32", 6], ["r32", 7]],
  "wc-095": [["r32", 12], ["r32", 13]],
  "wc-096": [["r32", 14], ["r32", 15]],
  // Cuartos (QF).
  "wc-097": [["r16", 0], ["r16", 1]],
  "wc-098": [["r16", 2], ["r16", 3]],
  "wc-099": [["r16", 4], ["r16", 5]],
  "wc-100": [["r16", 6], ["r16", 7]],
  // Semifinales.
  "wc-101": [["qf", 0], ["qf", 1]],
  "wc-102": [["qf", 2], ["qf", 3]],
  // Final.
  "wc-104": [["sf", 0], ["sf", 1]],
};

// Map of schedule id -> [homeTeam|undefined, awayTeam|undefined] from official
// results. Returns {} if there are no results yet.
export function resolveKnockoutTeams(results) {
  if (!results) return {};
  const arrs = {
    r32: results.r32_winners || [],
    r16: results.r16_winners || [],
    qf: results.qf_winners || [],
    sf: results.sf_winners || [],
  };
  const pick = ([round, idx]) => arrs[round]?.[idx] || undefined;
  const out = {};
  for (const [id, [a, b]] of Object.entries(KO_FEEDERS)) {
    out[id] = [pick(a), pick(b)];
  }
  // Match for third place (wc-103): losers of the two semifinals.
  const qf = arrs.qf, sf = arrs.sf;
  const loser = (cands, winner) => cands.find((t) => t && t !== winner) || undefined;
  out["wc-103"] = [loser([qf[0], qf[1]], sf[0]), loser([qf[2], qf[3]], sf[1])];
  return out;
}

// Returns a copy of `matches` with knockout home/away filled in from results.
// `flagOf` maps a team name to its emoji flag.
export function applyKnockoutResults(matches, results, flagOf) {
  const resolved = resolveKnockoutTeams(results);
  if (!Object.keys(resolved).length) return matches;
  return matches.map((m) => {
    const r = resolved[m.id];
    if (!r) return m;
    const [h, a] = r;
    return {
      ...m,
      home: h ? { name: h, flag: flagOf(h) || "🏆" } : m.home,
      away: a ? { name: a, flag: flagOf(a) || "🏆" } : m.away,
    };
  });
}
