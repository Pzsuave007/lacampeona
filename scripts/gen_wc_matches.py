# -*- coding: utf-8 -*-
"""Generate the full FIFA World Cup 2026 schedule (104 matches) as a JS module.
Kickoff stored in US Eastern time (-04:00 EDT); the frontend renders it in
Oregon (Pacific) time. Source: official schedule via ESPN (June 2026)."""

FLAGS = {
    "México": "🇲🇽", "Sudáfrica": "🇿🇦", "Corea del Sur": "🇰🇷", "Chequia": "🇨🇿",
    "Canadá": "🇨🇦", "Bosnia": "🇧🇦", "USA": "🇺🇸", "Paraguay": "🇵🇾",
    "Catar": "🇶🇦", "Suiza": "🇨🇭", "Brasil": "🇧🇷", "Marruecos": "🇲🇦",
    "Haití": "🇭🇹", "Escocia": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Australia": "🇦🇺", "Türkiye": "🇹🇷",
    "Alemania": "🇩🇪", "Curazao": "🇨🇼", "Países Bajos": "🇳🇱", "Japón": "🇯🇵",
    "Costa de Marfil": "🇨🇮", "Ecuador": "🇪🇨", "Suecia": "🇸🇪", "Túnez": "🇹🇳",
    "España": "🇪🇸", "Cabo Verde": "🇨🇻", "Bélgica": "🇧🇪", "Egipto": "🇪🇬",
    "Arabia Saudita": "🇸🇦", "Uruguay": "🇺🇾", "Irán": "🇮🇷", "Nueva Zelanda": "🇳🇿",
    "Francia": "🇫🇷", "Senegal": "🇸🇳", "Irak": "🇮🇶", "Noruega": "🇳🇴",
    "Argentina": "🇦🇷", "Argelia": "🇩🇿", "Austria": "🇦🇹", "Jordania": "🇯🇴",
    "Portugal": "🇵🇹", "Rep. del Congo": "🇨🇩", "Inglaterra": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Croacia": "🇭🇷",
    "Ghana": "🇬🇭", "Panamá": "🇵🇦", "Uzbekistán": "🇺🇿", "Colombia": "🇨🇴",
}

VENUES = {
    "mexcity": "Estadio Azteca · Ciudad de México",
    "guadalajara": "Estadio Akron · Guadalajara",
    "monterrey": "Estadio BBVA · Monterrey",
    "toronto": "BMO Field · Toronto",
    "vancouver": "BC Place · Vancouver",
    "seattle": "Lumen Field · Seattle",
    "la": "SoFi Stadium · Los Ángeles",
    "sf": "Levi's Stadium · San Francisco",
    "kansascity": "Arrowhead Stadium · Kansas City",
    "dallas": "AT&T Stadium · Dallas",
    "houston": "NRG Stadium · Houston",
    "atlanta": "Mercedes-Benz · Atlanta",
    "miami": "Hard Rock Stadium · Miami",
    "boston": "Gillette Stadium · Boston",
    "philadelphia": "Lincoln Financial · Filadelfia",
    "nynj": "MetLife Stadium · Nueva York",
}

KNOCKOUT_FLAG = "🏆"

# (month, day, hh, mm, home, away, group, venueKey)
GROUP = {
    "Fase de Grupos · J1": [
        (6, 11, 17, 0, "México", "Sudáfrica", "A", "mexcity"),
        (6, 11, 22, 0, "Corea del Sur", "Chequia", "A", "guadalajara"),
        (6, 12, 15, 0, "Canadá", "Bosnia", "B", "toronto"),
        (6, 12, 21, 0, "USA", "Paraguay", "D", "la"),
        (6, 13, 15, 0, "Catar", "Suiza", "B", "sf"),
        (6, 13, 18, 0, "Brasil", "Marruecos", "C", "nynj"),
        (6, 13, 21, 0, "Haití", "Escocia", "C", "boston"),
        (6, 14, 0, 0, "Australia", "Türkiye", "D", "vancouver"),
        (6, 14, 13, 0, "Alemania", "Curazao", "E", "houston"),
        (6, 14, 16, 0, "Países Bajos", "Japón", "F", "dallas"),
        (6, 14, 19, 0, "Costa de Marfil", "Ecuador", "E", "philadelphia"),
        (6, 14, 22, 0, "Suecia", "Túnez", "F", "monterrey"),
        (6, 15, 13, 0, "España", "Cabo Verde", "H", "atlanta"),
        (6, 15, 18, 0, "Bélgica", "Egipto", "G", "seattle"),
        (6, 15, 18, 0, "Arabia Saudita", "Uruguay", "H", "miami"),
        (6, 16, 0, 0, "Irán", "Nueva Zelanda", "G", "la"),
        (6, 16, 15, 0, "Francia", "Senegal", "I", "nynj"),
        (6, 16, 18, 0, "Irak", "Noruega", "I", "boston"),
        (6, 16, 21, 0, "Argentina", "Argelia", "J", "kansascity"),
        (6, 17, 0, 0, "Austria", "Jordania", "J", "sf"),
        (6, 17, 13, 0, "Portugal", "Rep. del Congo", "K", "houston"),
        (6, 17, 16, 0, "Inglaterra", "Croacia", "L", "dallas"),
        (6, 17, 19, 0, "Ghana", "Panamá", "L", "toronto"),
        (6, 17, 22, 0, "Uzbekistán", "Colombia", "K", "mexcity"),
    ],
    "Fase de Grupos · J2": [
        (6, 18, 12, 0, "Chequia", "Sudáfrica", "A", "atlanta"),
        (6, 18, 15, 0, "Suiza", "Bosnia", "B", "la"),
        (6, 18, 18, 0, "Canadá", "Catar", "B", "vancouver"),
        (6, 18, 23, 0, "México", "Corea del Sur", "A", "guadalajara"),
        (6, 19, 15, 0, "USA", "Australia", "D", "seattle"),
        (6, 19, 18, 0, "Escocia", "Marruecos", "C", "boston"),
        (6, 19, 21, 0, "Brasil", "Haití", "C", "philadelphia"),
        (6, 20, 0, 0, "Türkiye", "Paraguay", "D", "sf"),
        (6, 20, 13, 0, "Países Bajos", "Suecia", "F", "houston"),
        (6, 20, 16, 0, "Alemania", "Costa de Marfil", "E", "toronto"),
        (6, 20, 20, 0, "Ecuador", "Curazao", "E", "kansascity"),
        (6, 21, 0, 0, "Túnez", "Japón", "F", "monterrey"),
        (6, 21, 12, 0, "España", "Arabia Saudita", "H", "atlanta"),
        (6, 21, 15, 0, "Bélgica", "Irán", "G", "la"),
        (6, 21, 18, 0, "Uruguay", "Cabo Verde", "H", "miami"),
        (6, 21, 21, 0, "Nueva Zelanda", "Egipto", "G", "vancouver"),
        (6, 22, 13, 0, "Argentina", "Austria", "J", "dallas"),
        (6, 22, 17, 0, "Francia", "Irak", "I", "philadelphia"),
        (6, 22, 20, 0, "Noruega", "Senegal", "I", "nynj"),
        (6, 22, 23, 0, "Jordania", "Argelia", "J", "sf"),
        (6, 23, 13, 0, "Portugal", "Uzbekistán", "K", "houston"),
        (6, 23, 16, 0, "Inglaterra", "Ghana", "L", "boston"),
        (6, 23, 19, 0, "Panamá", "Croacia", "L", "toronto"),
        (6, 23, 22, 0, "Colombia", "Rep. del Congo", "K", "guadalajara"),
    ],
    "Fase de Grupos · J3": [
        (6, 24, 15, 0, "Suiza", "Canadá", "B", "vancouver"),
        (6, 24, 15, 0, "Bosnia", "Catar", "B", "seattle"),
        (6, 24, 18, 0, "Escocia", "Brasil", "C", "miami"),
        (6, 24, 18, 0, "Marruecos", "Haití", "C", "atlanta"),
        (6, 24, 21, 0, "Chequia", "México", "A", "mexcity"),
        (6, 24, 21, 0, "Sudáfrica", "Corea del Sur", "A", "monterrey"),
        (6, 25, 16, 0, "Ecuador", "Alemania", "E", "nynj"),
        (6, 25, 16, 0, "Curazao", "Costa de Marfil", "E", "philadelphia"),
        (6, 25, 19, 0, "Japón", "Suecia", "F", "dallas"),
        (6, 25, 19, 0, "Túnez", "Países Bajos", "F", "kansascity"),
        (6, 25, 22, 0, "Türkiye", "USA", "D", "la"),
        (6, 25, 22, 0, "Paraguay", "Australia", "D", "sf"),
        (6, 26, 15, 0, "Noruega", "Francia", "I", "boston"),
        (6, 26, 15, 0, "Senegal", "Irak", "I", "toronto"),
        (6, 26, 20, 0, "Cabo Verde", "Arabia Saudita", "H", "houston"),
        (6, 26, 20, 0, "Uruguay", "España", "H", "guadalajara"),
        (6, 26, 23, 0, "Egipto", "Irán", "G", "seattle"),
        (6, 26, 23, 0, "Nueva Zelanda", "Bélgica", "G", "vancouver"),
        (6, 27, 17, 0, "Panamá", "Inglaterra", "L", "nynj"),
        (6, 27, 17, 0, "Croacia", "Ghana", "L", "philadelphia"),
        (6, 27, 19, 30, "Colombia", "Portugal", "K", "miami"),
        (6, 27, 19, 30, "Rep. del Congo", "Uzbekistán", "K", "atlanta"),
        (6, 27, 22, 0, "Argelia", "Austria", "J", "kansascity"),
        (6, 27, 22, 0, "Jordania", "Argentina", "J", "dallas"),
    ],
}

# (month, day, hh, mm, home, away, stage, venueKey)
KNOCKOUT = [
    (6, 28, 15, 0, "2°A", "2°B", "Dieciseisavos", "la"),
    (6, 29, 13, 0, "1°C", "2°F", "Dieciseisavos", "houston"),
    (6, 29, 16, 30, "1°E", "3° A/B/C/D/F", "Dieciseisavos", "boston"),
    (6, 29, 21, 0, "1°F", "2°C", "Dieciseisavos", "monterrey"),
    (6, 30, 13, 0, "2°E", "2°I", "Dieciseisavos", "dallas"),
    (6, 30, 17, 0, "1°I", "3° C/D/F/G/H", "Dieciseisavos", "nynj"),
    (6, 30, 21, 0, "1°A", "3° C/E/F/H/I", "Dieciseisavos", "mexcity"),
    (7, 1, 12, 0, "1°L", "3° E/H/I/J/K", "Dieciseisavos", "atlanta"),
    (7, 1, 16, 0, "1°G", "3° A/E/H/I/J", "Dieciseisavos", "seattle"),
    (7, 1, 20, 0, "1°D", "3° B/E/F/I/J", "Dieciseisavos", "sf"),
    (7, 2, 15, 0, "1°H", "2°J", "Dieciseisavos", "la"),
    (7, 2, 19, 0, "2°K", "2°L", "Dieciseisavos", "toronto"),
    (7, 2, 23, 0, "1°B", "3° E/F/G/I/J", "Dieciseisavos", "vancouver"),
    (7, 3, 14, 0, "2°D", "2°G", "Dieciseisavos", "dallas"),
    (7, 3, 18, 0, "1°J", "2°H", "Dieciseisavos", "miami"),
    (7, 3, 21, 30, "1°K", "3° D/E/I/J/L", "Dieciseisavos", "kansascity"),
    (7, 4, 13, 0, "Por definir", "Por definir", "Octavos de Final", "houston"),
    (7, 4, 17, 0, "Por definir", "Por definir", "Octavos de Final", "philadelphia"),
    (7, 5, 16, 0, "Por definir", "Por definir", "Octavos de Final", "nynj"),
    (7, 5, 20, 0, "Por definir", "Por definir", "Octavos de Final", "mexcity"),
    (7, 6, 15, 0, "Por definir", "Por definir", "Octavos de Final", "dallas"),
    (7, 6, 17, 0, "Por definir", "Por definir", "Octavos de Final", "seattle"),
    (7, 7, 12, 0, "Por definir", "Por definir", "Octavos de Final", "atlanta"),
    (7, 7, 16, 0, "Por definir", "Por definir", "Octavos de Final", "vancouver"),
    (7, 9, 16, 0, "Por definir", "Por definir", "Cuartos de Final", "boston"),
    (7, 10, 15, 0, "Por definir", "Por definir", "Cuartos de Final", "la"),
    (7, 11, 17, 0, "Por definir", "Por definir", "Cuartos de Final", "miami"),
    (7, 11, 21, 0, "Por definir", "Por definir", "Cuartos de Final", "kansascity"),
    (7, 14, 15, 0, "Por definir", "Por definir", "Semifinal", "dallas"),
    (7, 15, 15, 0, "Por definir", "Por definir", "Semifinal", "atlanta"),
    (7, 18, 17, 0, "Por definir", "Por definir", "Tercer Lugar", "miami"),
    (7, 19, 15, 0, "Por definir", "Por definir", "FINAL", "nynj"),
]

FEATURED_TEAMS = {"México", "USA"}


def iso(m, d, hh, mm):
    return f"2026-{m:02d}-{d:02d}T{hh:02d}:{mm:02d}:00-04:00"


def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')


def team_obj(name, knockout=False):
    flag = FLAGS.get(name, KNOCKOUT_FLAG if knockout else "")
    return f'{{ name: "{esc(name)}", flag: "{flag}" }}'


def main():
    out = []
    out.append("// AUTO-GENERATED — full FIFA World Cup 2026 schedule (104 matches).")
    out.append("// Kickoff is stored in US Eastern (-04:00); displayed in Oregon/Pacific time.")
    out.append("// Regenerate with /app/scripts/gen_wc_matches.py")
    out.append("export const WORLD_CUP_MATCHES = [")

    n = 0
    for stage, rows in GROUP.items():
        for (m, d, hh, mm, home, away, group, venue) in rows:
            n += 1
            feat = home in FEATURED_TEAMS or away in FEATURED_TEAMS
            line = (
                f'  {{ id: "wc-{n:03d}", kickoff: "{iso(m, d, hh, mm)}", '
                f'home: {team_obj(home)}, away: {team_obj(away)}, '
                f'group: "{group}", stage: "{esc(stage)}", venue: "{esc(VENUES[venue])}"'
            )
            if feat:
                line += ", featured: true"
            line += " },"
            out.append(line)

    for (m, d, hh, mm, home, away, stage, venue) in KNOCKOUT:
        n += 1
        is_final = stage == "FINAL"
        line = (
            f'  {{ id: "wc-{n:03d}", kickoff: "{iso(m, d, hh, mm)}", '
            f'home: {team_obj(home, True)}, away: {team_obj(away, True)}, '
            f'group: "", stage: "{esc(stage)}", venue: "{esc(VENUES[venue])}"'
        )
        if is_final:
            line += ", isFinal: true"
        line += " },"
        out.append(line)

    out.append("];")
    out.append("")

    content = "\n".join(out)
    path = "/app/frontend/src/data/worldCupMatches.js"
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Wrote {n} matches to {path}")


if __name__ == "__main__":
    main()
