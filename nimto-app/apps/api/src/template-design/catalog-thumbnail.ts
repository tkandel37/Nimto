type ThumbnailProfile = {
  eyebrow: string;
  title: string;
  detail: string;
  accent: string;
  background: string;
  ink: string;
  motif: string;
  style: "classic" | "editorial" | "modern";
};

const profiles: Record<string, ThumbnailProfile> = {
  "birthday-confetti": {
    eyebrow: "YOU'RE INVITED",
    title: "A Birthday\nCelebration",
    detail: "Cake, music & bright memories",
    accent: "#f04e45",
    background: "#fff3c7",
    ink: "#17213b",
    motif: "✦",
    style: "editorial",
  },
  "botanical-wedding": {
    eyebrow: "TOGETHER WITH THEIR FAMILIES",
    title: "Maya & Aarav",
    detail: "A garden wedding · Kathmandu",
    accent: "#9a6a4f",
    background: "#f3eee5",
    ink: "#29483a",
    motif: "❦",
    style: "classic",
  },
  "neon-house-party": {
    eyebrow: "FRIDAY NIGHT",
    title: "HOUSE\nPARTY",
    detail: "Music up. Lights low.",
    accent: "#eaff39",
    background: "#151526",
    ink: "#ffffff",
    motif: "✹",
    style: "modern",
  },
  "modern-business-opening": {
    eyebrow: "GRAND OPENING",
    title: "A new chapter\nbegins.",
    detail: "Join us for the unveiling",
    accent: "#e05a3f",
    background: "#f0eee8",
    ink: "#18231f",
    motif: "↗",
    style: "editorial",
  },
  "warm-family-gathering": {
    eyebrow: "HOME IS WHERE WE GATHER",
    title: "Family\nTogether",
    detail: "An evening of stories and supper",
    accent: "#c96e4b",
    background: "#f8e8d5",
    ink: "#51352c",
    motif: "⌂",
    style: "classic",
  },
  "nepali-mandap-wedding": {
    eyebrow: "शुभ विवाह",
    title: "Aarati &\nSujan",
    detail: "With blessings from our families",
    accent: "#b72727",
    background: "#fff1d6",
    ink: "#5e1717",
    motif: "✺",
    style: "classic",
  },
  "dashain-tika-blessing": {
    eyebrow: "विजया दशमी",
    title: "Dashain\nBlessings",
    detail: "Tika, jamara & family",
    accent: "#c3312f",
    background: "#fff0d2",
    ink: "#633015",
    motif: "✦",
    style: "classic",
  },
  "tihar-deusi-bhailo": {
    eyebrow: "LIGHT • MUSIC • BLESSINGS",
    title: "Tihar\nEvening",
    detail: "Deusi Bhailo with family",
    accent: "#f2a52b",
    background: "#182534",
    ink: "#fff6d5",
    motif: "✺",
    style: "modern",
  },
  "bratabandha-ceremony": {
    eyebrow: "A SACRED MILESTONE",
    title: "Bratabandha",
    detail: "Join us in blessing the journey",
    accent: "#d17b35",
    background: "#f8ead2",
    ink: "#643c22",
    motif: "☀",
    style: "classic",
  },
  "pasni-rice-feeding": {
    eyebrow: "FIRST RICE CEREMONY",
    title: "Aarav's\nPasni",
    detail: "A little milestone, lovingly shared",
    accent: "#d49258",
    background: "#f6eee7",
    ink: "#594239",
    motif: "❋",
    style: "editorial",
  },
  "teej-celebration": {
    eyebrow: "DANCE • DEVOTION • TOGETHERNESS",
    title: "Teej\nCelebration",
    detail: "Wear red and celebrate with us",
    accent: "#d7264f",
    background: "#fff0ee",
    ink: "#64152c",
    motif: "✽",
    style: "editorial",
  },
  "mehendi-sangeet-night": {
    eyebrow: "MEHENDI & SANGEET",
    title: "Nisha &\nSagar",
    detail: "An evening in colour and rhythm",
    accent: "#e9ad46",
    background: "#173f31",
    ink: "#fff7df",
    motif: "✺",
    style: "classic",
  },
  "school-reunion": {
    eyebrow: "OLD FRIENDS, NEW STORIES",
    title: "Class of '06",
    detail: "Reunion night · 6 PM",
    accent: "#ffd166",
    background: "#172238",
    ink: "#f7f9ff",
    motif: "◆",
    style: "modern",
  },
  "soft-baby-shower": {
    eyebrow: "A LITTLE ONE IS ON THE WAY",
    title: "Anu & Raj",
    detail: "Baby shower · Sunday afternoon",
    accent: "#e47aa7",
    background: "#faeaf2",
    ink: "#28334a",
    motif: "☁",
    style: "editorial",
  },
  "community-puja": {
    eyebrow: "BLESSINGS & TOGETHERNESS",
    title: "Satyanarayan\nPuja",
    detail: "Prasad and gathering to follow",
    accent: "#e96834",
    background: "#fff4df",
    ink: "#85351e",
    motif: "◉",
    style: "classic",
  },
};

export function catalogThumbnailHtml(slug: string) {
  const profile = profiles[slug];
  if (!profile) return null;
  const title = profile.title.replace(/\n/g, "<br>");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:Georgia,serif;background:${profile.background};color:${profile.ink}}.card{position:relative;display:grid;align-content:center;width:100%;height:100%;padding:8% 10%;isolation:isolate}.card:before{content:"";position:absolute;inset:6%;border:1px solid ${profile.accent}55;border-radius:${profile.style === "modern" ? "28px" : "48% 48% 18px 18px"};z-index:-1}.mark{position:absolute;right:9%;top:9%;display:grid;place-items:center;width:18%;aspect-ratio:1;border-radius:${profile.style === "modern" ? "24%" : "50%"};background:${profile.accent};color:${profile.style === "modern" ? profile.background : "#fff"};font:700 clamp(18px,5vw,42px)/1 Georgia}.eyebrow{max-width:72%;font:700 clamp(8px,1.6vw,15px)/1.4 Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:${profile.accent}}h1{margin:7% 0 4%;max-width:86%;font:${profile.style === "modern" ? "800" : "600"} clamp(28px,7.2vw,68px)/.9 ${profile.style === "modern" ? "Arial,sans-serif" : "Georgia,serif"};letter-spacing:${profile.style === "modern" ? "-.06em" : "-.035em"}}p{margin:0;max-width:70%;font:500 clamp(10px,2vw,17px)/1.4 Arial,sans-serif}.rule{width:17%;height:4px;margin-top:7%;background:${profile.accent};border-radius:99px}</style></head><body><main class="card"><div class="mark">${profile.motif}</div><div class="eyebrow">${profile.eyebrow}</div><h1>${title}</h1><p>${profile.detail}</p><div class="rule"></div></main></body></html>`;
}
