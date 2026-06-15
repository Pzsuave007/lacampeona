// World Cup 2026 — OFFICIAL FIXTURES (post-draw, Dec 6, 2025)
// Sources: FIFA, ESPN, Fox Sports, Sky Sports (as of Feb 2026)
// Times are in PT (Pacific Time, Oregon local) — June/July uses PDT (UTC-7).
// La Campeona broadcasts the Spanish-language calls of every match below.

export const WORLD_CUP_INFO = {
  edition: "FIFA World Cup 2026™",
  hostCountries: "🇺🇸 USA · 🇨🇦 Canadá · 🇲🇽 México",
  startDate: "2026-06-11",
  endDate: "2026-07-19",
  teams: 48,
  matches: 104,
  rightsHolder: "La Campeona 880 AM · 103.9 FM Fuego",
  exclusiveLine: "Transmisiones EXCLUSIVAS en español",
};

// Each match: kickoff in ISO with offset, teams with flag emoji, group, stage, venue
// We focus on the matches most relevant to La Campeona's Latino audience:
//   - All Mexico (Group A), USA (Group D), Argentina (Group J) matches
//   - All other Spanish-speaking nations (Brazil, Colombia, Spain, Uruguay, Ecuador)
//   - Key knockout matches
export { WORLD_CUP_MATCHES } from "./worldCupMatches";

export const SALES_INFO = {
  tagline: "Tu negocio se escucha en toda la Willamette Valley",
  reach: {
    listeners: "180,000+",
    households: "65,000+",
    counties: "8",
  },
  packages: [
    {
      id: "starter",
      name: "Arranque",
      tagline: "Pequeño negocio local",
      price: "$199",
      period: "/ semana",
      color: "#7F1D1D",
      featured: false,
      features: [
        "10 spots de 30 segundos al día",
        "Mención del locutor en vivo (1x al día)",
        "Listado en página web",
        "Reporte semanal por WhatsApp",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      tagline: "El más popular",
      price: "$449",
      period: "/ semana",
      color: "#EA580C",
      featured: true,
      features: [
        "20 spots de 30 segundos al día",
        "Banner activo en website (rotación)",
        "2 menciones del DJ por hora pico",
        "Página dedicada del negocio en lacampeona.com",
        "Botón directo: WhatsApp · Llamada · Mapa",
        "Reporte detallado de clics semanal",
      ],
    },
    {
      id: "premium",
      name: "Patrocinador",
      tagline: "Tu marca en el aire",
      price: "$899",
      period: "/ semana",
      color: "#FACC15",
      featured: false,
      features: [
        "Patrocinio exclusivo de un programa o segmento",
        "30+ spots de 60 segundos",
        "Hero takeover en la página",
        "Entrevistas y promociones en vivo",
        "Eventos remotos (1 al mes)",
        "Soporte de producción de spots GRATIS",
      ],
    },
  ],
  reasons: [
    {
      icon: "🎯",
      title: "Audiencia 100% latina",
      text: "Decisores de compra que escuchan en su idioma todos los días.",
    },
    {
      icon: "📈",
      title: "Resultados medibles",
      text: "Cada llamada y mensaje desde la web se rastrea por anunciante.",
    },
    {
      icon: "🤝",
      title: "Trato directo",
      text: "Sin intermediarios. Tu asesor te contesta en horas, no en días.",
    },
    {
      icon: "🔥",
      title: "Producción incluida",
      text: "Producimos tu spot con voces profesionales de la emisora.",
    },
  ],
  salesperson: {
    name: "María Hernández",
    title: "Asesora de ventas — La Campeona 880 AM",
    phone: "+15036230244",
    whatsapp: "15036230244",
    email: "ventas@lacampeona.com",
    photo: "https://images.pexels.com/photos/3760854/pexels-photo-3760854.jpeg",
    quote: "Cuéntame de tu negocio en 5 minutos y te diseño el paquete que te conviene.",
  },
};
