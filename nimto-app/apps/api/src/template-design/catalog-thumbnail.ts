type ThumbnailProfile = {
  eyebrow: string;
  title: string;
  detail: string;
  accent: string;
  secondary: string;
  background: string;
  ink: string;
  motif: string;
  font: "serif" | "sans";
};

const profiles: Record<string, ThumbnailProfile> = {
  "birthday-confetti": {
    eyebrow: "LET'S CELEBRATE",
    title: "Maya's\nBirthday!",
    detail: "Cake, music & bright memories",
    accent: "#ff8eb5",
    secondary: "#58d6ca",
    background: "#fff3d8",
    ink: "#35234c",
    motif: "✦",
    font: "sans",
  },
  "botanical-wedding": {
    eyebrow: "TOGETHER WITH THEIR FAMILIES",
    title: "Maya & Aarav",
    detail: "A garden wedding · Kathmandu",
    accent: "#b78d4d",
    secondary: "#8da18e",
    background: "#f8f3e9",
    ink: "#263a2c",
    motif: "❦",
    font: "serif",
  },
  "neon-house-party": {
    eyebrow: "FRIDAY NIGHT",
    title: "HOUSE\nPARTY",
    detail: "Music up. Lights low.",
    accent: "#00e5c3",
    secondary: "#7028e4",
    background: "#100d1c",
    ink: "#ffffff",
    motif: "✹",
    font: "sans",
  },
  "modern-business-opening": {
    eyebrow: "GRAND OPENING",
    title: "STUDIO\nNORTH",
    detail: "July 18, 2026 · Join the unveiling",
    accent: "#d9ff63",
    secondary: "#b8c3bf",
    background: "#ece9e0",
    ink: "#19201e",
    motif: "↗",
    font: "sans",
  },
  "warm-family-gathering": {
    eyebrow: "HOME IS WHERE WE GATHER",
    title: "Family\nGet-Together",
    detail: "An evening of stories and supper",
    accent: "#b26f42",
    secondary: "#efcfa5",
    background: "#f6e6ce",
    ink: "#583d2c",
    motif: "⌂",
    font: "serif",
  },
  "nepali-mandap-wedding": {
    eyebrow: "शुभ विवाह",
    title: "Aarati &\nSujan",
    detail: "With blessings from our families",
    accent: "#9f212a",
    secondary: "#c9973d",
    background: "#fff8e8",
    ink: "#5a1117",
    motif: "✺",
    font: "serif",
  },
  "dashain-tika-blessing": {
    eyebrow: "विजया दशमी",
    title: "Kandel Family",
    detail: "Tika, jamara & blessings",
    accent: "#c82326",
    secondary: "#3e8a42",
    background: "#fff4dc",
    ink: "#321b12",
    motif: "✦",
    font: "sans",
  },
  "tihar-deusi-bhailo": {
    eyebrow: "LIGHT • MUSIC • BLESSINGS",
    title: "Deusi Bhailo\nNight",
    detail: "Celebrate Tihar with us",
    accent: "#ffd166",
    secondary: "#f72585",
    background: "#11102a",
    ink: "#ffffff",
    motif: "✺",
    font: "sans",
  },
  "bratabandha-ceremony": {
    eyebrow: "A SACRED MILESTONE",
    title: "Aayush's\nBratabandha",
    detail: "Join us in blessing his journey",
    accent: "#a66a28",
    secondary: "#d9bf96",
    background: "#efe3cc",
    ink: "#2d2118",
    motif: "☀",
    font: "serif",
  },
  "pasni-rice-feeding": {
    eyebrow: "FIRST RICE CEREMONY",
    title: "Maya's Pasni",
    detail: "A little milestone, lovingly shared",
    accent: "#be496d",
    secondary: "#ffe5b4",
    background: "#fff4f6",
    ink: "#40202b",
    motif: "❋",
    font: "sans",
  },
  "teej-celebration": {
    eyebrow: "DANCE • DEVOTION • TOGETHERNESS",
    title: "Teej\nCelebration",
    detail: "Wear red and celebrate with us",
    accent: "#ffd166",
    secondary: "#d72f56",
    background: "#9d1235",
    ink: "#ffffff",
    motif: "✽",
    font: "sans",
  },
  "mehendi-sangeet-night": {
    eyebrow: "MEHENDI & SANGEET",
    title: "Nisha &\nSameer",
    detail: "An evening in colour and rhythm",
    accent: "#f6bd60",
    secondary: "#2b6c53",
    background: "#12362f",
    ink: "#fff7e5",
    motif: "✺",
    font: "sans",
  },
  "school-reunion": {
    eyebrow: "OLD FRIENDS, NEW STORIES",
    title: "Himalayan\nSchool",
    detail: "Reunion night · Class of '06",
    accent: "#ffd166",
    secondary: "#2d6cdf",
    background: "#e8edf4",
    ink: "#172033",
    motif: "◆",
    font: "sans",
  },
  "soft-baby-shower": {
    eyebrow: "A LITTLE ONE IS ON THE WAY",
    title: "Anu & Raj",
    detail: "Baby shower · Sunday afternoon",
    accent: "#e0799d",
    secondary: "#cfe7ff",
    background: "#f0f7ff",
    ink: "#263246",
    motif: "☁",
    font: "sans",
  },
  "community-puja": {
    eyebrow: "BLESSINGS & TOGETHERNESS",
    title: "Satyanarayan\nPuja",
    detail: "Prasad and gathering to follow",
    accent: "#e85d35",
    secondary: "#ffcc63",
    background: "#fff2dd",
    ink: "#351d13",
    motif: "◉",
    font: "serif",
  },
};

export function catalogThumbnailHtml(slug: string) {
  const profile = profiles[slug];
  if (!profile) return null;
  const title = profile.title.replace(/\n/g, "<br>");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{background:${profile.background};color:${profile.ink}}.card{position:relative;display:grid;align-content:center;width:100%;height:100%;padding:9% 10%;overflow:hidden;isolation:isolate}.frame,.ornament{position:absolute;pointer-events:none}.frame{inset:6%;border:1px solid ${profile.accent}66;border-radius:18px}.ornament{z-index:-1}.mark{position:absolute;right:9%;top:9%;display:grid;place-items:center;width:17%;aspect-ratio:1;border-radius:50%;background:${profile.accent};color:${profile.background};font:700 clamp(17px,4.5vw,38px)/1 Georgia}.eyebrow{max-width:73%;font:800 clamp(7px,1.5vw,14px)/1.4 Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:${profile.accent}}h1{margin:7% 0 4%;max-width:88%;font:${profile.font === "sans" ? "850" : "600"} clamp(26px,6.8vw,64px)/.91 ${profile.font === "sans" ? "Arial,sans-serif" : "Georgia,serif"};letter-spacing:${profile.font === "sans" ? "-.055em" : "-.035em"}}p{margin:0;max-width:75%;font:600 clamp(9px,1.8vw,16px)/1.4 Arial,sans-serif}.rule{width:17%;height:4px;margin-top:7%;border-radius:99px;background:${profile.accent}}
.birthday-confetti{background:radial-gradient(circle at 13% 20%,${profile.secondary} 0 2%,transparent 2.5%),radial-gradient(circle at 88% 76%,#ffca58 0 2.5%,transparent 3%),radial-gradient(circle at 70% 18%,${profile.accent} 0 1.5%,transparent 2%)}.birthday-confetti .frame{border-radius:32px;border-width:2px}.birthday-confetti .mark{border-radius:18px}.birthday-confetti h1{color:#e04f88}
.botanical-wedding .frame{inset:5%;border-radius:50% 50% 16px 16px}.botanical-wedding .ornament:before,.botanical-wedding .ornament:after{content:"❦";position:absolute;color:${profile.secondary};font-size:clamp(42px,12vw,100px);opacity:.24}.botanical-wedding .ornament:before{left:-4vw;top:-3vh;transform:rotate(-35deg)}.botanical-wedding .ornament:after{right:-96vw;top:62vh;transform:rotate(145deg)}.botanical-wedding .mark{background:${profile.secondary}}
.neon-house-party{background:radial-gradient(circle at 76% 24%,${profile.secondary}77,transparent 27%),${profile.background}}.neon-house-party .frame{border:2px solid ${profile.accent};box-shadow:0 0 28px ${profile.accent}44}.neon-house-party .mark{border-radius:22%;box-shadow:0 0 22px ${profile.accent}77}.neon-house-party h1{text-shadow:3px 3px 0 ${profile.secondary}}
.modern-business-opening{padding-left:14%;background:linear-gradient(90deg,${profile.ink} 0 8%,transparent 8%)}.modern-business-opening .frame{inset:7% 6% 7% 12%;border-radius:0}.modern-business-opening .mark{border-radius:0;color:${profile.ink}}.modern-business-opening h1{font-size:clamp(28px,7.7vw,72px)}
.modern-business-opening .eyebrow{color:${profile.ink}}
.warm-family-gathering .frame{inset:5%;border-radius:48% 48% 16px 16px;background:linear-gradient(180deg,transparent 58%,${profile.secondary}55)}.warm-family-gathering .mark{background:${profile.secondary};color:${profile.ink}}
.nepali-mandap-wedding .frame{inset:5% 12%;border:2px solid ${profile.secondary};border-bottom:0;border-radius:50% 50% 0 0}.nepali-mandap-wedding:before{content:"";position:absolute;left:0;right:0;top:0;height:18%;background:${profile.accent};clip-path:polygon(0 0,100% 0,92% 58%,80% 28%,68% 65%,56% 30%,44% 65%,32% 28%,20% 58%,8% 28%)}.nepali-mandap-wedding .mark{background:${profile.secondary};color:${profile.accent}}
.dashain-tika-blessing{background:radial-gradient(circle at 86% 22%,${profile.accent} 0 11%,transparent 11.5%),radial-gradient(circle at 87% 23%,${profile.secondary} 0 4%,transparent 4.5%)}.dashain-tika-blessing .frame{border-radius:6px}.dashain-tika-blessing .mark{display:none}.dashain-tika-blessing h1{max-width:72%}
.tihar-deusi-bhailo{background:radial-gradient(circle at 18% 18%,${profile.accent} 0 1.2%,transparent 1.8%),radial-gradient(circle at 78% 74%,${profile.secondary} 0 1.2%,transparent 1.8%),linear-gradient(135deg,#11102a,#30123b)}.tihar-deusi-bhailo .frame{border-radius:34px;box-shadow:inset 0 0 30px #f7258522}.tihar-deusi-bhailo .mark{box-shadow:0 0 30px ${profile.accent}88;color:${profile.background}}
.bratabandha-ceremony .frame{inset:6% 8%;border:2px double ${profile.accent};border-radius:50% 50% 8px 8px}.bratabandha-ceremony .mark{width:21%;background:transparent;border:2px solid ${profile.accent};color:${profile.accent}}
.pasni-rice-feeding{background:radial-gradient(circle at 84% 20%,${profile.secondary} 0 16%,transparent 16.5%),radial-gradient(circle at 12% 88%,#f7c9d7 0 13%,transparent 13.5%)}.pasni-rice-feeding .frame{border-radius:32px}.pasni-rice-feeding .mark{background:${profile.secondary};color:${profile.accent}}
.teej-celebration{background:linear-gradient(145deg,#7f0e2d,${profile.background})}.teej-celebration .frame{border:2px solid ${profile.accent};border-radius:50% 50% 16px 16px}.teej-celebration .mark{color:${profile.background}}.teej-celebration h1{color:#fff}.teej-celebration p{color:#ffe8ee}
.mehendi-sangeet-night .frame{inset:5%;border:2px solid ${profile.accent};border-radius:28px}.mehendi-sangeet-night:before{content:"";position:absolute;left:0;right:0;top:0;height:28%;background:${profile.secondary};border-bottom:3px solid ${profile.accent};z-index:-1}.mehendi-sangeet-night .mark{color:${profile.background}}
.school-reunion{padding-top:23%;background:linear-gradient(180deg,${profile.ink} 0 24%,${profile.background} 24%)}.school-reunion .frame{inset:7%;border-color:${profile.secondary};border-radius:20px}.school-reunion .mark{background:${profile.accent};color:${profile.ink}}.school-reunion .eyebrow{color:${profile.secondary}}.school-reunion h1{color:${profile.ink}}
.soft-baby-shower{background:radial-gradient(ellipse at 78% 24%,${profile.secondary} 0 13%,transparent 13.5%),radial-gradient(ellipse at 65% 19%,${profile.secondary} 0 10%,transparent 10.5%),linear-gradient(135deg,#ffd6e755,transparent 55%)}.soft-baby-shower .frame{border-radius:34px}.soft-baby-shower .mark{background:${profile.secondary};color:${profile.accent}}
.community-puja .frame{inset:6% 10%;border-color:${profile.secondary};border-radius:50% 50% 12px 12px}.community-puja:before{content:"";position:absolute;left:36%;top:6%;width:28%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,${profile.accent} 0 22%,${profile.secondary} 23% 42%,transparent 43%);opacity:.45;z-index:-1}.community-puja .mark{background:${profile.secondary};color:${profile.accent}}
</style></head><body><main class="card ${slug}"><div class="frame"></div><div class="ornament"></div><div class="mark">${profile.motif}</div><div class="eyebrow">${profile.eyebrow}</div><h1>${title}</h1><p>${profile.detail}</p><div class="rule"></div></main></body></html>`;
}
