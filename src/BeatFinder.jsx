import React, { useState, useEffect, useCallback, useRef } from "react";
// =============================================================================
// PREMIUM LOADER COMPONENT
// =============================================================================
const LOADER_STYLE = `
  @keyframes bf-spin  { to { transform: rotate(360deg); } }
  @keyframes bf-pulse { 0%,100% { opacity:0.4; transform:scaleY(0.5); } 50% { opacity:1; transform:scaleY(1); } }
  @keyframes bf-fade  { from { opacity:0; } to { opacity:1; } }
  @keyframes bf-fadein-up { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes bf-scale-in  { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
  @keyframes bf-play-pulse { 0%,100% { box-shadow:0 0 0 0 rgba(192,38,211,0.4); } 70% { box-shadow:0 0 0 10px rgba(192,38,211,0); } }
  @keyframes bf-tab-in     { from { opacity:0; transform:translateX(8px); } to { opacity:1; transform:translateX(0); } }
  .bf-page    { animation: bf-fadein-up 0.28s cubic-bezier(0.22,1,0.36,1) both; }
  .bf-card    { animation: bf-scale-in  0.22s cubic-bezier(0.22,1,0.36,1) both; }
  .bf-tab-in  { animation: bf-tab-in   0.22s cubic-bezier(0.22,1,0.36,1) both; }
  .bf-btn     { transition: transform 0.12s ease, opacity 0.12s ease; }
  .bf-btn:active { transform: scale(0.93); opacity: 0.8; }
  .bf-nav-btn { transition: transform 0.15s cubic-bezier(0.34,1.56,0.64,1), color 0.15s ease; }
  .bf-nav-btn:active { transform: scale(0.85); }
  .bf-play    { animation: bf-play-pulse 2s ease infinite; }
  .bf-carousel { scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }
  * { scrollbar-width: none; -ms-overflow-style: none; }
  *::-webkit-scrollbar { display: none; }
  .bf-save    { transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), color 0.15s ease; }
  .bf-save:active { transform: scale(1.3); }
  .bf-spinner {
    width: 44px; height: 44px; border-radius: 50%;
    border: 3px solid rgba(192,38,211,0.15);
    border-top-color: #C026D3;
    animation: bf-spin 0.8s linear infinite;
    filter: drop-shadow(0 0 8px rgba(192,38,211,0.5));
  }
  .bf-bars { display:flex; align-items:flex-end; gap:4px; height:28px; }
  .bf-bar {
    width: 5px; border-radius: 3px;
    background: linear-gradient(180deg,#C026D3,#7C3AED);
    animation: bf-pulse 1s ease-in-out infinite;
    filter: drop-shadow(0 0 4px rgba(192,38,211,0.6));
  }
  .bf-bar:nth-child(1) { height:14px; animation-delay:0s; }
  .bf-bar:nth-child(2) { height:22px; animation-delay:0.15s; }
  .bf-bar:nth-child(3) { height:28px; animation-delay:0.3s; }
  .bf-bar:nth-child(4) { height:22px; animation-delay:0.45s; }
  .bf-bar:nth-child(5) { height:14px; animation-delay:0.6s; }
  .bf-loader { animation: bf-fade 0.2s ease; }
`;

function BFLoader({ text, type }) {
  return (
    <div className="bf-loader" style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "60px 20px", gap: 20,
    }}>
      <style>{LOADER_STYLE}</style>
      {type === "bars" ? (
        <div className="bf-bars">
          <div className="bf-bar" />
          <div className="bf-bar" />
          <div className="bf-bar" />
          <div className="bf-bar" />
          <div className="bf-bar" />
        </div>
      ) : (
        <div className="bf-spinner" />
      )}
      {text && (
        <div style={{
          color: "#6b6b6b", fontSize: 11, fontWeight: 600,
          letterSpacing: 2, opacity: 0.8,
        }}>
          {text}
        </div>
      )}
    </div>
  );
}



// =============================================================================
// CONFIG
// =============================================================================

// -- Backend URL --------------------------------------------------------------
// When developing locally:   http://localhost:8000
// When deployed on Render:   https://your-app.onrender.com
// Set this to your Render/Railway URL after deployment.
const API_BASE = "https://beatfinder-backend.onrender.com";

// -- In-memory cache (10 minutes TTL) -----------------------------------------
const cache = {};
const CACHE_TTL = 10 * 60 * 1000;
const CACHE_VER = "v2";

// =============================================================================
// API HELPERS
// These call your FastAPI backend - which in turn calls YouTube server-side.
// This fixes the iOS Safari CORS block permanently.
// =============================================================================

// Read JWT token saved after login
function getToken() {
  try { return localStorage.getItem("bf_token") || null; }
  catch { return null; }
}

// Save token after login/register
function saveToken(token) {
  try { localStorage.setItem("bf_token", token); } catch {}
}

// Remove token on logout
function clearToken() {
  try { localStorage.removeItem("bf_token"); } catch {}
}

// Generic authenticated fetch helper
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API error");
  }
  return res.json();
}

// =============================================================================
// YOUTUBE - calls /api/youtube/search on your FastAPI backend
// Backend makes the real googleapis.com call server-side (no CORS issues)
// =============================================================================
// Words that indicate a track is a song/music video NOT an instrumental beat
// All signals are matched case-insensitively via .toLowerCase() in isLikelyInstrumental
const VOCAL_SIGNALS = [
  // English video signals
  "official video", "official music video", "music video", "official mv",
  "official clip", "official audio", "official single", "official hd",
  "lyrics video", "lyric video", "with lyrics", "letra",
  "visualizer", "visual video", "audio visual",
  // Song/artist signals
  "feat.", "ft.", " ft ", " feat ", "featuring",
  "(clean)", "(explicit)", "(dirty)", "(radio edit)",
  "sing along", "karaoke", "cover", "remix ft",
  "out now", "new song", "new single", "new music",
  // Spanish/Portuguese
  "oficial video", "video oficial", "videoclip oficial",
  "vid oficial", "clip oficial", "musica oficial",
  "clipe oficial", "video clipe", "videoclipe",
  // French/other
  "clip officiel", "video officielle",
  // Short forms
  "(mv)", "[mv]", "m/v", "music vid", "musicvideo",
  // Streaming/release signals
  "vevo", "out now", "available now", "stream now",
  "listen now", "spotify", "apple music",
  // Other giveaways
  "dance video", "dance performance", "live performance",
  "behind the scenes", "bts video", "making of",
];

// Words that are GOOD signals (real type beats)
const BEAT_SIGNALS = [
  "type beat", "type beat)", "type beat]", "instrumental",
  "free beat", "beat free", "no copyright", "(free)", "[free]",
  "prod.", "beat prod", "rap beat", "trap beat", "drill beat",
  "r&b beat", "afrobeat beat", "melodic beat",
];

function isLikelyInstrumental(title) {
  if (!title) return true;
  const t = title.toLowerCase();
  // Reject vocal/video signals FIRST - these override even "type beat" in the title
  if (VOCAL_SIGNALS.some(s => t.includes(s))) return false;
  // Then allow strong beat signals
  if (BEAT_SIGNALS.some(s => t.includes(s))) return true;
  // Reject "Artist - Song" pattern with no beat keywords
  if (t.includes(" - ") && !t.includes("beat") && !t.includes("instrumental") && !t.includes("free")) {
    if (t.includes("official") || t.includes("audio") || t.includes("video") || t.includes("vevo")) return false;
  }
  // Reject if title has no beat-related word at all AND is very short (likely a song title)
  const hasBeatWord = ["beat", "instrumental", "free", "prod", "type", "drill", "trap", "rnb", "afro"].some(w => t.includes(w));
  if (!hasBeatWord && t.length < 30) return false;
  return true;
}

async function fetchBeats(artistName, page, filterTitle, maxResults, extraQueries) {
  const pageNum     = page || 1;
  const maxNum      = maxResults || 10;
  const doFilter    = filterTitle !== false;
  const query       = CACHE_VER + "|" + artistName + "|page" + pageNum + "|filter" + doFilter + "|max" + maxNum;
  if (cache[query] && Date.now() - cache[query].ts < CACHE_TTL) {
    return { beats: cache[query].data, error: null };
  }

  let url = "/api/youtube/search?artist=" + encodeURIComponent(artistName) +
              "&max=" + maxNum + "&page=" + pageNum +
              "&filter_title=" + (doFilter ? "true" : "false");
  if (extraQueries) {
    url += "&extra_queries=" + encodeURIComponent(extraQueries);
  }

  // Try up to 2 times - first page of an artist builds the master cache
  // which can take a few seconds on Render free tier
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const data  = await apiFetch(url);
      const raw   = data.beats || [];
      const beats = raw.filter(b => isLikelyInstrumental(b.title));
      cache[query] = { data: beats, ts: Date.now() };
      return { beats, error: null };
    } catch (err) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 3000)); // wait 3s then retry
      } else {
        console.error("[BeatFinder] fetchBeats error:", err);
        return { beats: [], error: err.message };
      }
    }
  }
}

// =============================================================================
// AUTH API - register / login / me / upgrade plan
// =============================================================================
const AuthAPI = {
  async register(name, email, password) {
    const data = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    saveToken(data.access_token);
    const u = data.user;
    return { ...u, isPro: u.plan === "producer", isArtistPro: u.plan === "artist" || u.plan === "producer" };
  },

  async login(email, password) {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveToken(data.access_token);
    const u = data.user;
    return { ...u, isPro: u.plan === "producer", isArtistPro: u.plan === "artist" || u.plan === "producer" };
  },

  async me() {
    return apiFetch("/api/auth/me");
  },

  async upgrade(plan) {
    return apiFetch("/api/auth/upgrade", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });
  },

  logout() {
    clearToken();
  },
};

// =============================================================================
// SAVED BEATS API - syncs with MongoDB via backend
// =============================================================================
const BeatsAPI = {
  async list() {
    return apiFetch("/api/beats/");
  },

  async save(beat) {
    return apiFetch("/api/beats/", {
      method: "POST",
      body: JSON.stringify({ beat }),
    });
  },

  async remove(videoId) {
    return apiFetch(`/api/beats/${videoId}`, { method: "DELETE" });
  },
};

// =============================================================================
// HELPERS
// =============================================================================
const GRAD = [
  ["#6B21A8","#9333EA"],["#0F4C75","#1B6CA8"],["#7C2D12","#C2410C"],
  ["#1E3A5F","#2563EB"],["#4A044E","#86198F"],["#065F46","#059669"],
  ["#7C3AED","#A855F7"],["#9D174D","#EC4899"],["#134E4A","#0D9488"],
  ["#1E1B4B","#4338CA"],["#1a1a2e","#C026D3"],["#0f3460","#F59E0B"],
];
const initials = n => n.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
const watchUrl  = id => `https://www.youtube.com/watch?v=${id}`;
const embedUrl  = id => `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

// =============================================================================
// ARTIST DATABASE
// =============================================================================
const ARTISTS_USA = [
  {id:"21savage",     name:"21 Savage",       cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/fYpYhVVd/IMG-8822.jpg"},
  {id:"drake",        name:"Drake",            cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/2YWV4nrW/IMG-8823.jpg"},
  {id:"future",       name:"Future",           cat:"Melodic Trap",    flag:"🇺🇸", img:"https://i.ibb.co/60Qd6jMC/IMG-8824.jpg"},
  {id:"gunna",        name:"Gunna",            cat:"Melodic Trap",    flag:"🇺🇸", img:"https://i.ibb.co/VcJgbWCs/IMG-8825.jpg"},
  {id:"juicewrld",    name:"Juice WRLD",       cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/jcHpx7y/IMG-8826.jpg"},
  {id:"kanye",        name:"Kanye West",       cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/dsK2fm4n/IMG-8827.webp"},
  {id:"kendrick",     name:"Kendrick Lamar",   cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/bgSH1S6Q/IMG-8830.jpg"},
  {id:"lilbaby",      name:"Lil Baby",         cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/d0D2Y42W/IMG-8829.webp"},
  {id:"lildurk",      name:"Lil Durk",         cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/7J7dP8BR/IMG-8831.webp"},
  {id:"liluzivert",   name:"Lil Uzi Vert",     cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/n8Q57Jss/IMG-8832.webp"},
  {id:"metroboomin",  name:"Metro Boomin",     cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/9mm1S7sM/IMG-8833.jpg"},
  {id:"playboicarti", name:"Playboi Carti",    cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/tM7ZQzSB/IMG-8834.webp"},
  {id:"travis",       name:"Travis Scott",     cat:"Melodic Trap",    flag:"🇺🇸", img:"https://i.ibb.co/Cp0FHyBg/IMG-8836.jpg"},
  {id:"youngthug",    name:"Young Thug",       cat:"Melodic Trap",    flag:"🇺🇸", img:"https://i.ibb.co/zV1sYHXn/IMG-8837.jpg"},
  {id:"nba",          name:"NBA YoungBoy",     cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/mFbR32cY/IMG-8838.webp"},
  {id:"cardib",       name:"Cardi B",          cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/7JMkDL10/IMG-6284.webp"},
  {id:"nickiminaj",   name:"Nicki Minaj",      cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/m5t5f1HL/IMG-4065.webp"},
  {id:"eminem",       name:"Eminem",           cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/6cW6jMHX/IMG-8841.webp"},
  {id:"jcole",        name:"J. Cole",          cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/mVJhFfRt/IMG-8842.webp"},
  {id:"meekmill",     name:"Meek Mill",        cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/mC37B3Lw/IMG-8843.webp"},
  {id:"postmalone",   name:"Post Malone",      cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/kgSFqDRb/IMG-8844.webp"},
  {id:"rodwave",      name:"Rod Wave",         cat:"Melodic Trap",    flag:"🇺🇸", img:"https://i.ibb.co/DPHp7cPh/IMG-8845.jpg"},
  {id:"polo",         name:"Polo G",           cat:"Melodic Trap",    flag:"🇺🇸", img:"https://i.ibb.co/jvfchwXm/IMG-8846.png"},
  {id:"theweeknd",    name:"The Weeknd",       cat:"R&B M",  flag:"🇺🇸", img:"https://i.ibb.co/Z6rN9BrN/IMG-8847.webp"},
  {id:"brysonti",     name:"Bryson Tiller",    cat:"R&B M",  flag:"🇺🇸", img:"https://i.ibb.co/QjTk82kR/IMG-8848.webp"},
  {id:"chrisb",       name:"Chris Brown",      cat:"R&B M",  flag:"🇺🇸", img:"https://i.ibb.co/9H372SLV/IMG-8849.jpg"},
  {id:"usher",        name:"Usher",            cat:"R&B M",  flag:"🇺🇸", img:"https://i.ibb.co/LdydQV0X/IMG-8850.jpg"},
  {id:"frankocean",   name:"Frank Ocean",      cat:"R&B M",  flag:"🇺🇸", img:"https://i.ibb.co/sdVkLKRB/IMG-8851.webp"},
  {id:"andersonpaak", name:"Anderson .Paak",   cat:"R&B M",  flag:"🇺🇸", img:"https://i.ibb.co/Kp7yvqrB/IMG-8852.jpg"},
  {id:"giveon",       name:"Giveon",           cat:"R&B M",  flag:"🇺🇸", img:"https://i.ibb.co/GBV1wLq/IMG-8853.webp"},
  {id:"brentfaiyaz",  name:"Brent Faiyaz",     cat:"R&B M",  flag:"🇺🇸", img:"https://i.ibb.co/Vdxx2GW/IMG-8854.webp"},
  {id:"dvsn",         name:"dvsn",             cat:"R&B M",  flag:"🇺🇸", img:"https://i.ibb.co/Pz9LzfL6/IMG-8855.webp"},
  {id:"beyonce",      name:"Beyonce",          cat:"R&B F",  flag:"🇺🇸", img:"https://i.ibb.co/gL6kCMjJ/IMG-8856.jpg"},
  {id:"sza",          name:"SZA",              cat:"R&B F",  flag:"🇺🇸", img:"https://i.ibb.co/bR7C82ZF/IMG-8857.webp"},
  {id:"her",          name:"H.E.R.",           cat:"R&B F",  flag:"🇺🇸", img:"https://i.ibb.co/Gfc3bSZG/IMG-8858.jpg"},
  {id:"summerwalker", name:"Summer Walker",    cat:"R&B F",  flag:"🇺🇸", img:"https://i.ibb.co/xqQWTsX2/IMG-8859.webp"},
  {id:"keyshia",      name:"Keyshia Cole",     cat:"R&B F",  flag:"🇺🇸", img:"https://i.ibb.co/99GS9GDq/IMG-8860.webp"},
  {id:"jhene",        name:"Jhene Aiko",       cat:"R&B F",  flag:"🇺🇸", img:"https://i.ibb.co/S7066VKt/IMG-8861.webp"},
  {id:"arianag",      name:"Ariana Grande",    cat:"R&B F",  flag:"🇺🇸", img:"https://i.ibb.co/gLjRyWdF/IMG-8862.webp"},
  {id:"aliciakeys",   name:"Alicia Keys",      cat:"R&B F",  flag:"🇺🇸", img:"https://i.ibb.co/4ZCbsmFX/IMG-8863.jpg"},
  {id:"dojacat",      name:"Doja Cat",         cat:"R&B F",  flag:"🇺🇸", img:"https://i.ibb.co/rfL5rhYq/IMG-8865.webp"},
  {id:"bigsean",      name:"Big Sean",         cat:"Detroit",flag:"🇺🇸", img:"https://i.ibb.co/0yJFMLNj/IMG-8866.webp"},
  {id:"teegriz",      name:"Tee Grizzley",     cat:"Detroit",flag:"🇺🇸", img:"https://i.ibb.co/s4KN0fM/IMG-8867.jpg"},
  {id:"babyfaceray",  name:"Babyface Ray",     cat:"Detroit",flag:"🇺🇸", img:"https://i.ibb.co/7xNtvmMr/IMG-8868.webp"},
  {id:"42dugg",       name:"42 Dugg",          cat:"Detroit",flag:"🇺🇸", img:"https://i.ibb.co/hJb1QF8c/IMG-8869.webp"},
  {id:"dannybrown",   name:"Danny Brown",      cat:"Detroit",flag:"🇺🇸", img:"https://i.ibb.co/1YWcSv08/IMG-8870.webp"},
  {id:"sadababy",     name:"Sada Baby",        cat:"Detroit",       flag:"🇺🇸", img:"https://i.ibb.co/N2TGpp2F/IMG-8871.webp"},
  {id:"icewear",      name:"Icewear Vezzo",    cat:"Detroit",       flag:"🇺🇸", img:"https://i.ibb.co/VGBxyCT/IMG-8872.jpg"},
  {id:"riodayungo",   name:"Rio Da Yung OG",   cat:"Detroit",       flag:"🇺🇸", img:"https://i.ibb.co/N6DwJT93/IMG-8873.jpg"},
  {id:"babytron",     name:"BabyTron",         cat:"Detroit",       flag:"🇺🇸", img:"https://i.ibb.co/Wpc8GgpR/IMG-8874.webp"},
  {id:"veeze",        name:"Veeze",            cat:"Detroit",       flag:"🇺🇸", img:"https://i.ibb.co/MxfsY9vm/IMG-8875.webp"},
  {id:"dejloaf",      name:"Dej Loaf",         cat:"Detroit",       flag:"🇺🇸", img:"https://i.ibb.co/h1dXZ33r/IMG-8876.webp"},
  {id:"kashdoll",     name:"Kash Doll",        cat:"Detroit",       flag:"🇺🇸", img:"https://i.ibb.co/k6KfLyc1/IMG-8877.jpg"},
  {id:"skillababy",   name:"Skilla Baby",      cat:"Detroit",       flag:"🇺🇸", img:"https://i.ibb.co/4n9Hd8tx/IMG-8878.webp"},
  {id:"jiprince",     name:"J.I The Prince Of N.Y", cat:"Melodic Trap", flag:"🇺🇸", img:"https://i.ibb.co/tww7qV0F/IMG-9133.jpg",
   searchOverride:"J.I type beat", filterTitle: false,
   extraQueries:"J.I type beat,J.I Type Beats,J.I Instrumental,J.I TYPE BEATS!"},
  {id:"liltjay",      name:"Lil TJay",         cat:"Melodic Trap",  flag:"🇺🇸", img:"https://i.ibb.co/N23pQpRT/IMG-9134.jpg"},
  {id:"aboogie",      name:"A Boogie Wit Da Hoodie", cat:"Melodic Trap", flag:"🇺🇸", img:"https://i.ibb.co/chpLfGPc/IMG-9136.jpg"},
  {id:"sleepyhallow",  name:"Sleepy Hallow",   cat:"Melodic Trap",  flag:"🇺🇸", img:"https://i.ibb.co/zHmXPCgp/IMG-9137.webp"},
  {id:"stunnagambino", name:"Stunna Gambino",  cat:"Melodic Trap",  flag:"🇺🇸", img:"https://i.ibb.co/pjZYNBM0/IMG-9138.jpg"},
];

const ARTISTS_UK = [
  {id:"ajtracey",      name:"AJ Tracey",       cat:"Grime", flag:"🇬🇧", img:"https://i.ibb.co/KjMjGVhN/IMG-0480.jpg"},
  {id:"aitch",         name:"Aitch",           cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/jdvJ4Zc/IMG-0481.jpg"},
  {id:"centralcee",    name:"Central Cee",     cat:"UK Drill", flag:"🇬🇧", img:"https://i.ibb.co/wZvG4SdH/IMG-0482.jpg"},
  {id:"dblockeurope",  name:"D Block Europe",  cat:"UK Melodic Trap", flag:"🇬🇧", img:"https://i.ibb.co/Zp7BHx0G/IMG-0483.webp"},
  {id:"dave",          name:"Dave",            cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/qLyG67SS/IMG-0484.jpg"},
  {id:"diggad",        name:"Digga D",         cat:"UK Drill", flag:"🇬🇧", img:"https://i.ibb.co/Y4KX0hXn/IMG-0485.jpg"},
  {id:"headieone",     name:"Headie One",      cat:"UK Drill", flag:"🇬🇧", img:"https://i.ibb.co/mCD7Nx50/IMG-0486.png"},
  {id:"jhus",          name:"J Hus",           cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/b5jyBxCP/IMG-0487.jpg"},
  {id:"ktrap",         name:"K-Trap",          cat:"UK Drill", flag:"🇬🇧", img:"https://i.ibb.co/svhjVGHB/IMG-0488.jpg"},
  {id:"potterpayper",  name:"Potter Payper",   cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/ymV2XKF2/IMG-0489.jpg"},
  {id:"skepta",        name:"Skepta",          cat:"Grime", flag:"🇬🇧", img:"https://i.ibb.co/G3sL0H8k/IMG-0490.jpg"},
  {id:"stormzy",       name:"Stormzy",         cat:"Grime", flag:"🇬🇧", img:"https://i.ibb.co/wh8fMHWz/IMG-0491.jpg"},
  {id:"slowthai",      name:"Slowthai",        cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/60QrHxQT/IMG-0492.jpg"},
  {id:"ghetts",        name:"Ghetts",          cat:"Grime", flag:"🇬🇧", img:"https://i.ibb.co/4RjsrCpc/IMG-0493.jpg"},
  {id:"giggs",         name:"Giggs",           cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/39VkxCr5/IMG-0494.jpg"},
  {id:"dizzee",        name:"Dizzee Rascal",   cat:"Grime", flag:"🇬🇧", img:"https://i.ibb.co/bgyCJp2M/IMG-0495.jpg"},
  {id:"wiley",         name:"Wiley",           cat:"Grime", flag:"🇬🇧", img:"https://i.ibb.co/pvQsZPdh/IMG-0496.jpg"},
  {id:"jme",           name:"JME",             cat:"Grime", flag:"🇬🇧", img:"https://i.ibb.co/LDWqsQ86/IMG-0497.jpg"},
  {id:"kano",          name:"Kano",            cat:"Grime", flag:"🇬🇧", img:"https://i.ibb.co/HDMKt6Xq/IMG-0498.jpg"},
  {id:"ninesuk",       name:"Nines",           cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/hxsGJh3k/IMG-0499.jpg"},
  {id:"mostack",       name:"MoStack",         cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/q3KNrDwY/IMG-8879.webp"},
  {id:"fredo",         name:"Fredo",           cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/jk5h5zMS/IMG-8880.jpg"},
  {id:"arrdee",        name:"ArrDee",          cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/hFnJzqzF/IMG-8881.webp"},
  {id:"tion",          name:"Tion Wayne",      cat:"UK Drill", flag:"🇬🇧", img:"https://i.ibb.co/r2sjzVnQ/IMG-8882.webp"},
  {id:"stefflon",      name:"Stefflon Don",    cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/VpksVFhH/IMG-8883.webp"},
  {id:"ladyleshurr",   name:"Lady Leshurr",    cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/p6z8yYJN/IMG-8884.jpg"},
  {id:"missdynamite",  name:"Ms Dynamite",     cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/0yg4SZQn/IMG-8885.webp"},
  {id:"craigdavid",    name:"Craig David",     cat:"UK R&B", flag:"🇬🇧", img:"https://i.ibb.co/nMd0VdzF/IMG-8887.jpg"},
  {id:"jorja",         name:"Jorja Smith",     cat:"UK R&B", flag:"🇬🇧", img:"https://i.ibb.co/KjQr64LN/IMG-8888.jpg"},
  {id:"rayblk",        name:"Ray BLK",         cat:"UK R&B", flag:"🇬🇧", img:"https://i.ibb.co/9H0P51ZW/IMG-8889.webp"},
  {id:"mahalia",       name:"Mahalia",         cat:"UK R&B", flag:"🇬🇧", img:"https://i.ibb.co/mFzQQyfQ/IMG-8890.webp"},
  {id:"pinkpantheress",name:"PinkPantheress",  cat:"UK R&B", flag:"🇬🇧", img:"https://i.ibb.co/WNDS1kY1/IMG-8891.webp"},
  {id:"raye",          name:"RAYE",            cat:"UK R&B", flag:"🇬🇧", img:"https://i.ibb.co/RT1QhM5C/IMG-8893.png"},
  {id:"dotrotten",     name:"Dot Rotten / Zeph Ellis", cat:"Grime", flag:"🇬🇧", img:"https://i.ibb.co/tTtkNPnb/IMG-8894.webp",
   searchOverride:"Dot Rotten Zeph Ellis instrumental",
   filterTitle: false,
   instrumentalOnly: true},
  {id:"mhuncho",       name:"M Huncho",        cat:"UK Melodic Trap", flag:"🇬🇧", img:"https://i.ibb.co/HLqRYYFv/IMG-9140.webp"},
  {id:"nafesmallz",    name:"Nafe Smallz",     cat:"UK Melodic Trap", flag:"🇬🇧", img:"https://i.ibb.co/s9JR82ym/IMG-9141.jpg"},
  {id:"yxngbane",      name:"Yxng Bane",       cat:"UK Melodic Trap", flag:"🇬🇧", img:"https://i.ibb.co/WNj0TwHK/IMG-9142.webp"},
  {id:"byoung",        name:"B Young",         cat:"UK Melodic Trap", flag:"🇬🇧", img:"https://i.ibb.co/rf0PdBBq/IMG-9143.jpg",
   blockedChannels:["Prod.B.Young","BYoungBeats","B Young Beats","prod b young"]},
  {id:"yungfume",      name:"Yung Fume",       cat:"UK Melodic Trap", flag:"🇬🇧", img:"https://i.ibb.co/nN52pN5P/IMG-9144.webp"},
  {id:"wewantwraiths", name:"wewantwraiths",   cat:"UK Melodic Trap", flag:"🇬🇧", img:"https://i.ibb.co/6R0qMMG0/IMG-9145.jpg"},
];

const ARTISTS_JAMAICA = [
  {id:"bobmarley",     name:"Bob Marley",        cat:"Reggae",    flag:"🇯🇲", img:"https://i.ibb.co/bj20Yf1B/IMG-8938.webp"},
  {id:"shaggy",        name:"Shaggy",            cat:"Dancehall", flag:"🇯🇲", img:"https://i.ibb.co/kV0TpHDB/IMG-8957.webp"},
  {id:"seanpaul",      name:"Sean Paul",          cat:"Dancehall", flag:"🇯🇲", img:"https://i.ibb.co/KcDyfPW5/IMG-8945.webp"},
  {id:"popcaan",       name:"Popcaan",            cat:"Dancehall", flag:"🇯🇲", img:"https://i.ibb.co/wFXD4tkW/IMG-8946.jpg"},
  {id:"alkaline",      name:"Alkaline",           cat:"Dancehall", flag:"🇯🇲", img:"https://i.ibb.co/vvmF4ktR/IMG-8947.webp"},
  {id:"vybzkartel",    name:"Vybz Kartel",        cat:"Dancehall", flag:"🇯🇲", img:"https://i.ibb.co/JjqgMmzC/IMG-8948.webp"},
  {id:"mavadogee",     name:"Mavado",             cat:"Dancehall", flag:"🇯🇲", img:"https://i.ibb.co/qMys8fNq/IMG-8949.webp"},
  {id:"burnaboys",     name:"Busy Signal",        cat:"Reggae",    flag:"🇯🇲", img:"https://i.ibb.co/JFbknRg7/IMG-8944.webp"},
  {id:"chronixx",      name:"Chronixx",           cat:"Reggae",    flag:"🇯🇲", img:"https://i.ibb.co/kgBwMtfw/IMG-8939.webp"},
  {id:"protoje",       name:"Protoje",            cat:"Reggae",    flag:"🇯🇲", img:"https://i.ibb.co/VcHv91Pn/IMG-8940.jpg"},
  {id:"koffee",        name:"Koffee",             cat:"Reggae",    flag:"🇯🇲", img:"https://i.ibb.co/FFnPTyS/IMG-8941.webp"},
  {id:"aidonia",       name:"Aidonia",            cat:"Bashment",  flag:"🇯🇲", img:"https://i.ibb.co/4Rgx7WJv/IMG-8956.webp"},
  {id:"spicejamaica",  name:"Spice",              cat:"Bashment",  flag:"🇯🇲", img:"https://i.ibb.co/CpQybJm2/IMG-8955.jpg"},
  {id:"demarcojamaica",name:"Demarco",            cat:"Bashment",  flag:"🇯🇲", img:"https://i.ibb.co/WWBjbJQw/IMG-8954.jpg"},
  {id:"masicka",       name:"Masicka",            cat:"Dancehall", flag:"🇯🇲", img:"https://i.ibb.co/8LYx9Z8D/IMG-8950.webp"},
  {id:"skillibeng",    name:"Skillibeng",         cat:"Dancehall", flag:"🇯🇲", img:"https://i.ibb.co/Z64DBgz1/IMG-8951.webp"},
  {id:"jahcure",       name:"Jah Cure",           cat:"Reggae",    flag:"🇯🇲", img:"https://i.ibb.co/hxF3wXSz/IMG-8942.webp"},
  {id:"tarrus",        name:"Tarrus Riley",       cat:"Reggae",    flag:"🇯🇲", img:"https://i.ibb.co/LXcMdNzY/IMG-8943.webp"},
  {id:"munga",         name:"Munga Honorable",    cat:"Dancehall", flag:"🇯🇲", img:"https://i.ibb.co/3m70P0v9/IMG-8953.webp"},
  {id:"konshens",      name:"Konshens",           cat:"Dancehall", flag:"🇯🇲", img:"https://i.ibb.co/39LG5x19/IMG-8952.webp"},
];

const ARTISTS_AFRICA = [
  {id:"burnaboy",      name:"Burna Boy",          cat:"Afrobeats", flag:"🇳🇬", img:"https://i.ibb.co/4nVk9JbV/IMG-8906.webp"},
  {id:"wizkid",        name:"WizKid",             cat:"Afrobeats", flag:"🇳🇬", img:"https://i.ibb.co/08BSCx1/IMG-8907.webp"},
  {id:"davido",        name:"Davido",             cat:"Afrobeats", flag:"🇳🇬", img:"https://i.ibb.co/5X0D7Qvx/IMG-8908.webp"},
  {id:"asake",         name:"Asake",              cat:"Afrobeats", flag:"🇳🇬", img:"https://i.ibb.co/qM7nKW4S/IMG-8909.png"},
  {id:"ruema",         name:"Rema",               cat:"Afrobeats", flag:"🇳🇬", img:"https://i.ibb.co/j9rMjRBY/IMG-8910.png"},
  {id:"ckay",          name:"CKay",               cat:"Afrobeats", flag:"🇳🇬", img:"https://i.ibb.co/5XLSCcbZ/IMG-8911.webp"},
  {id:"omah",          name:"Omah Lay",           cat:"Afrobeats", flag:"🇳🇬", img:"https://i.ibb.co/pjjCH4tf/IMG-8912.webp"},
  {id:"ayra",          name:"Ayra Starr",         cat:"Afrobeats", flag:"🇳🇬", img:"https://i.ibb.co/FbC9fmqv/IMG-8913.webp"},
  {id:"tiwasavage",    name:"Tiwa Savage",        cat:"Afrobeats", flag:"🇳🇬", img:"https://i.ibb.co/SD09jqCy/IMG-8914.webp"},
  {id:"olamide",       name:"Olamide",            cat:"Afrobeats", flag:"🇳🇬", img:"https://i.ibb.co/CsnM8t38/IMG-8915.webp"},
  {id:"afrobeatz",     name:"Fireboy DML",        cat:"Afrobeats", flag:"🇳🇬", img:"https://i.ibb.co/rKF6XD24/IMG-8916.webp"},
  {id:"joeboy",        name:"Joeboy",             cat:"Afrobeats", flag:"🇳🇬", img:"https://i.ibb.co/Ps5zG4b4/IMG-8917.webp"},
  {id:"kizzdaniel",    name:"Kizz Daniel",        cat:"Afrobeats", flag:"🇳🇬", img:"https://i.ibb.co/FPkV9tC/IMG-8918.webp"},
  {id:"tems",          name:"Tems",               cat:"Afrobeats", flag:"🇳🇬", img:"https://i.ibb.co/DD1TRV16/IMG-8919.webp"},
  {id:"amaarae",       name:"Amaarae",            cat:"Afrobeats", flag:"🇬🇭", img:"https://i.ibb.co/DHsWm7pj/IMG-8920.webp"},
  {id:"blacksherif",   name:"Black Sherif",       cat:"Afrobeats", flag:"🇬🇭", img:"https://i.ibb.co/xtycqz11/IMG-8921.webp"},
  {id:"sarkodie",      name:"Sarkodie",           cat:"Afrobeats", flag:"🇬🇭", img:"https://i.ibb.co/V09ZjRNk/IMG-8922.webp"},
  {id:"stonebwoy",     name:"Stonebwoy",          cat:"Afrobeats", flag:"🇬🇭", img:"https://i.ibb.co/Vcms8Rrc/IMG-8923.webp"},
  {id:"masterkg",      name:"Master KG",          cat:"Tribal House", flag:"🇿🇦", img:"https://i.ibb.co/4bGNbww/IMG-8926.webp"},
  {id:"nomcebo",       name:"Nomcebo Zikode",     cat:"Tribal House", flag:"🇿🇦", img:"https://i.ibb.co/7JK6qYV9/IMG-8927.webp"},
  {id:"kabza",         name:"Kabza De Small",     cat:"Tribal House", flag:"🇿🇦", img:"https://i.ibb.co/WvqF2PpG/IMG-8928.webp"},
  {id:"djmaphorisa",   name:"DJ Maphorisa",       cat:"Tribal House", flag:"🇿🇦", img:"https://i.ibb.co/Kj4b9SGt/IMG-8929.webp"},
  {id:"sho",           name:"Sho Madjozi",        cat:"Afrobeats", flag:"🇿🇦", img:"https://i.ibb.co/jk1wmtnn/IMG-8924.jpg"},
  {id:"nasty",         name:"Nasty C",            cat:"Afrobeats", flag:"🇿🇦", img:"https://i.ibb.co/Y7w048Kd/IMG-8925.webp"},
  {id:"ladydu",        name:"Lady Du",            cat:"Tribal House", flag:"🇿🇦", img:"https://i.ibb.co/whmMj9M5/IMG-8930.webp"},
];

const USA_CATS     = ["All","Rap","R&B M","R&B F","Detroit","Melodic Trap"];
const UK_CATS      = ["All","UK Rap","UK Drill","UK R&B","Grime","UK Melodic Trap"];
const JAMAICA_CATS = ["All","Reggae","Dancehall","Bashment"];
const AFRICA_CATS  = ["All","Afrobeats","Tribal House"];

// =============================================================================
// LOCAL STORAGE
// =============================================================================
function loadSaved() {
  try { return JSON.parse(localStorage.getItem("bf_saved") || "{}"); }
  catch { return {}; }
}
function persistSaved(s) {
  try { localStorage.setItem("bf_saved", JSON.stringify(s)); }
  catch (e) { console.warn("[BeatFinder] Could not save:", e); }
}

// =============================================================================
// AVATAR
// =============================================================================
function Av({ name, size = 88, idx = 0, img }) {
  const [g1, g2] = GRAD[idx % GRAD.length];
  const [imgErr, setImgErr] = useState(false);

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      overflow: "hidden", position: "relative",
      border: "2.5px solid rgba(255,255,255,0.15)",
      background: img && !imgErr ? "#111" : "linear-gradient(135deg," + g1 + "," + g2 + ")",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {img && !imgErr ? (
        <img
          src={img}
          alt={name}
          onError={() => setImgErr(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <span style={{
          fontSize: size * 0.28, fontWeight: 800, color: "white",
          fontFamily: "'Bebas Neue',sans-serif",
        }}>
          {initials(name)}
        </span>
      )}
    </div>
  );
}



// =============================================================================
// AI LYRIC ASSISTANT - local rhyme engine, no API needed, 100% free
// =============================================================================

// =============================================================================
// LYRIC ASSISTANT ENGINE - local rhyme generator
// =============================================================================


// =============================================================================
// AI LYRIC ASSISTANT ENGINE
// =============================================================================

function getLastLine(lyrics) {
  var lines = lyrics.split(String.fromCharCode(10)).filter(function(l){ return l.trim().length > 0; });
  return lines.length > 0 ? lines[lines.length - 1].trim() : "";
}

function cleanWord(w) { return w.replace(/[^a-zA-Z]/g, "").toLowerCase(); }

function extractTarget(line) {
  var words = line.trim().split(" ").filter(function(w){ return w.trim().length > 0; });
  var cleaned = words.map(cleanWord).filter(function(w){ return w.length > 0; });
  var w1 = cleaned.length > 0 ? cleaned[cleaned.length - 1] : "";
  var w2 = cleaned.length > 1 ? cleaned[cleaned.length - 2] : "";
  var w3 = cleaned.length > 2 ? cleaned[cleaned.length - 3] : "";
  return { w1: w1, w2: w2, w3: w3 };
}

function detectScheme(lines) {
  if (lines.length < 2) return "AA";
  var ends = lines.slice(-4).map(function(l){
    var ws = l.trim().split(" ");
    return cleanWord(ws[ws.length - 1]);
  });
  if (ends.length >= 4 && ends[0] === ends[2] && ends[1] === ends[3]) return "ABAB";
  if (ends.length >= 2 && ends[ends.length-1] === ends[ends.length-2]) return "AA";
  return "ABAB";
}

// Filter out obscure/unusable rhyme words
var REJECT_WORDS = {
  "a":1,"an":1,"the":1,"and":1,"or":1,"but":1,"if":1,"in":1,"on":1,"at":1,
  "to":1,"for":1,"of":1,"with":1,"by":1,"as":1,"is":1,"it":1,"be":1,"we":1,
  "he":1,"she":1,"they":1,"i":1,"you":1,"my":1,"your":1,"our":1,"this":1,
  "that":1,"was":1,"were":1,"are":1,"am":1,"had":1,"has":1,"have":1,"do":1,
  "did":1,"not":1,"no":1,"so":1,"up":1,"oh":1,"ah":1,"uh":1
};

function isUsable(word) {
  if (!word) return false;
  var w = word.toLowerCase().trim();
  // Must be 2-12 letters only
  if (w.length < 2 || w.length > 12) return false;
  if (/[^a-z]/.test(w)) return false;
  // Reject stop words
  if (REJECT_WORDS[w]) return false;
  // Reject if it looks like an obscure word (very low scrabble-style score for common letters)
  // Simple heuristic: if it contains q,x,z heavily it's obscure
  var rare = (w.match(/[qxz]/g) || []).length;
  if (rare > 1) return false;
  return true;
}


// Fetch rhymes from Datamuse for BOTH the last word AND the 2-word phrase
function fetchRhymes(target) {
  // Query 1: sounds-like the full 2-word phrase (e.g. "been through")
  var phraseQuery = target.w2 ? (target.w2 + " " + target.w1) : target.w1;
  // Query 2: perfect rhymes of last word
  // Query 3: near rhymes of last word
  var urls = [
    "https://api.datamuse.com/words?sl=" + encodeURIComponent(phraseQuery) + "&max=100",
    "https://api.datamuse.com/words?rel_rhy=" + encodeURIComponent(target.w1) + "&max=100",
    "https://api.datamuse.com/words?rel_nry=" + encodeURIComponent(target.w1) + "&max=50",
  ];

  return Promise.all(urls.map(function(url){
    return fetch(url).then(function(r){ return r.json(); }).catch(function(){ return []; });
  })).then(function(results) {
    // Phrase sounds-like: these are words that sound like the whole phrase
    var phraseWords = results[0].map(function(w){ return w.word; }).filter(isUsable);
    // Perfect rhymes of last word
    var perfWords   = results[1].map(function(w){ return w.word; }).filter(isUsable);
    // Near rhymes of last word
    var nearWords   = results[2].map(function(w){ return w.word; }).filter(function(w){
      return isUsable(w) && perfWords.indexOf(w) === -1;
    });

    return {
      phrase:  phraseWords,
      perfect: perfWords,
      near:    nearWords,
      query:   phraseQuery,
    };
  }).catch(function(){
    return { phrase: [], perfect: [], near: [], query: phraseQuery };
  });
}

// Reconstruct rhyme phrase matching the target structure
// "been through" with rhyme word "true" -> "stayed true"
// "been through" with rhyme word "knew" -> "always knew"
// We keep the SAME NUMBER of words and same trailing structure
function buildRhymePhrase(rhymeWord, target) {
  if (!target.w2) return rhymeWord;
  // Replace w1 with rhymeWord, keep w2
  // But if rhymeWord sounds like the whole phrase, just use it directly
  // For 2-word targets: verb + rhymeWord
  var connectors = ["been","go","stay","came","felt","kept","done","run","held","stood","ride","live","move","seen","know","feel","through","for","still","always","never"];
  // Pick a connector that sounds natural
  var idx = connectors.indexOf(target.w2);
  var connector = idx > -1 ? connectors[idx] : "stay";
  return connector + " " + rhymeWord;
}

// Bar templates - {R} is replaced with the full rhyme phrase
// Every bar is a complete meaningful sentence
var BARS = [
  "You know I held it down through everything just {R}",
  "They never saw the tears but I was always {R}",
  "Came from nothing, still I found a way to {R}",
  "Put my trust in God and vowed to always {R}",
  "I ain't gone cap, I'm telling you I had to {R}",
  "All the nights I cried alone I chose to {R}",
  "Pressure builds the diamond, I was born to {R}",
  "Real ones never fold, we always gonna {R}",
  "Through the darkest nights I told myself to {R}",
  "God kept pushing, so I had no choice but {R}",
  "Late nights, cold winters, still I chose to {R}",
  "Everything they took from me I had to {R}",
  "Momma always told me never quit so I {R}",
  "They doubted every move I made but I {R}",
  "All the sacrifice was worth it now I {R}",
];

function buildBar(rhymePhrase, index) {
  var template = BARS[index % BARS.length];
  return template.replace("{R}", rhymePhrase);
}

function barQuality(bar) {
  if (!bar || typeof bar !== "string") return false;
  var words = bar.trim().split(" ");
  return words.length >= 7 && words.length <= 18;
}


// =============================================================================
// RHYME FINDER
// =============================================================================
function RhymeFinder({ onClose, onInsert }) {
  const [word,     setWord]     = useState("");
  const [results,  setResults]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState("");

  const findRhymes = function() {
    var w = word.trim().toLowerCase();
    if (!w) return;
    setLoading(true);
    setResults(null);
    setSearched(w);

    var words = w.trim().split(/\s+/);
    var isMultiWord = words.length > 1;

    if (isMultiWord) {
      // Fetch rhymes for each word independently then combine
      var fetches = words.map(function(word) {
        return fetch("https://api.datamuse.com/words?rel_rhy=" + encodeURIComponent(word) + "&max=80")
          .then(function(r){ return r.json(); });
      });

      Promise.all(fetches).then(function(results) {
        // results[0] = rhymes for first word, results[1] = rhymes for second word etc
        // Build combinations: pick one from each and combine
        var rhymeSets = results.map(function(set) {
          return (set || []).map(function(r){ return r.word; });
        });

        // Generate multi-syllable combos — pair rhymes from each word position
        var combos = [];
        var max = 30;
        var setA = rhymeSets[0] || [];
        var setB = rhymeSets[rhymeSets.length - 1] || [];
        var len = Math.min(setA.length, setB.length, max);
        for (var i = 0; i < len; i++) {
          var combo = words.map(function(_, idx) {
            var set = rhymeSets[idx] || [];
            return set[i % set.length] || words[idx];
          }).join(" ");
          combos.push({ word: combo });
        }

        // Also fetch regular rhymes for the last word
        fetch("https://api.datamuse.com/words?rel_rhy=" + encodeURIComponent(words[words.length - 1]) + "&max=100")
          .then(function(r){ return r.json(); })
          .then(function(perfect) {
            fetch("https://api.datamuse.com/words?rel_nry=" + encodeURIComponent(words[words.length - 1]) + "&max=50")
              .then(function(r){ return r.json(); })
              .then(function(near) {
                var ending = words[words.length - 1].slice(-2);
                var tightNear = (near || []).filter(function(r) {
                  return r.word.slice(-2) === ending || r.score > 800;
                });
                setResults({ perfect: perfect || [], near: tightNear, multiSyllable: combos, isMultiWord: true });
                setLoading(false);
              });
          });
      }).catch(function() {
        setResults({ perfect: [], near: [], multiSyllable: [], isMultiWord: true });
        setLoading(false);
      });

    } else {
      // Single word — perfect + near rhymes only
      Promise.all([
        fetch("https://api.datamuse.com/words?rel_rhy=" + encodeURIComponent(w) + "&max=100").then(function(r){ return r.json(); }),
        fetch("https://api.datamuse.com/words?rel_nry=" + encodeURIComponent(w) + "&max=50").then(function(r){ return r.json(); }),
      ]).then(function(data) {
        var allRhymes = (data[0] || []).filter(function(r){ return r.word.indexOf(" ") === -1; });
        var allNear   = (data[1] || []).filter(function(r){ return r.word.indexOf(" ") === -1; });

        // Perfect rhymes: only words with score above 300 (Datamuse scores true rhymes highest)
        var perfect = allRhymes.filter(function(r){ return (r.score || 0) >= 300; });
        // If too few, lower threshold
        if (perfect.length < 5) perfect = allRhymes.filter(function(r){ return (r.score || 0) >= 100; });
        if (perfect.length === 0) perfect = allRhymes.slice(0, 20);

        // Near rhymes: only from rel_nry, not already in perfect, tightly filtered by ending
        var perfectWords = new Set(perfect.map(function(r){ return r.word; }));
        var ending3 = w.slice(-3);
        var near = allNear.filter(function(r){
          return !perfectWords.has(r.word) && (r.score || 0) > 800;
        });

        setResults({ perfect, near, multiSyllable: null, isMultiWord: false });
        setLoading(false);
      }).catch(function() {
        setResults({ perfect: [], near: [], multiSyllable: null, isMultiWord: false });
        setLoading(false);
      });
    }
  };

  var RhymeChip = function(props) {
    return (
      <button
        onClick={function() { onInsert(props.word); }}
        style={{
          background: "rgba(255,255,255,0.05)", border: "1px solid #2a2a2a",
          borderRadius: 20, padding: "5px 12px", color: "white",
          fontSize: 13, fontWeight: 500, cursor: "pointer", flexShrink: 0,
          fontFamily: "'DM Sans',sans-serif",
        }}>
        {props.word}
      </button>
    );
  };

  var Section = function(props) {
    if (!props.words || props.words.length === 0) return null;
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: props.color || "#888", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, marginBottom: 8 }}>
          {props.title} ({props.words.length})
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {props.words.map(function(r) {
            return <RhymeChip key={r.word} word={r.word} />;
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      background: "#0a0f1a", borderTop: "1px solid rgba(6,182,212,0.3)",
      paddingBottom: "calc(0px + env(safe-area-inset-bottom))",
      maxHeight: 320, display: "flex", flexDirection: "column",
    }}>
      <div style={{ padding: "12px 16px 10px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ color: "#06B6D4", fontWeight: 800, fontSize: 13 }}>🎯 Rhyme Finder</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={word}
            onChange={function(e) { setWord(e.target.value); }}
            onKeyDown={function(e) { if (e.key === "Enter") findRhymes(); }}
            placeholder="Type a word e.g. love, night, fire..."
            style={{
              flex: 1, background: "#1a1a2a", border: "1px solid #2a2a3a",
              borderRadius: 10, padding: "10px 12px", color: "white",
              fontSize: 13, outline: "none",
            }}
          />
          <button onClick={findRhymes} disabled={loading || !word.trim()} style={{
            background: loading || !word.trim() ? "#1a1a2a" : "linear-gradient(135deg,#06B6D4,#0891B2)",
            border: "none", borderRadius: 10, color: "white",
            fontWeight: 800, fontSize: 13, padding: "10px 16px",
            cursor: loading || !word.trim() ? "not-allowed" : "pointer",
            opacity: loading || !word.trim() ? 0.5 : 1, flexShrink: 0,
          }}>
            {loading ? "..." : "Find"}
          </button>
        </div>
      </div>

      {results && (
        <div style={{ overflowY: "auto", padding: "0 16px 16px", flex: 1 }}>
          {results.perfect.length === 0 && results.near.length === 0 ? (
            <div style={{ color: "#444", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
              No rhymes found for "{searched}"
            </div>
          ) : (
            <div>
              {results.isMultiWord && results.multiSyllable && results.multiSyllable.length > 0 && (
                <Section title="MULTI-SYLLABLE RHYMES" words={results.multiSyllable} color="#C026D3" />
              )}
              <Section title="PERFECT RHYMES" words={results.perfect} color="#06B6D4" />
              <Section title="NEAR RHYMES" words={results.near} color="#F59E0B" />
            </div>
          )}
        </div>
      )}

      {!results && !loading && (
        <div style={{ color: "#333", fontSize: 12, textAlign: "center", padding: "12px 0" }}>
          Tap a rhyme to insert it into your lyrics
        </div>
      )}
    </div>
  );
}

function LyricsNotepad({ beat, onClose, onSaveLyric, initialLyric, lyricIndex }) {
  const [text,       setText]       = useState(initialLyric ? initialLyric.text  : "");
  const [title,      setTitle]      = useState(initialLyric ? initialLyric.title : "");
  const [saved,      setSaved]      = useState(false);
  const [aiOpen,     setAiOpen]     = useState(null);
  const scrollRef = useCallback(node => {
    if (node) node.scrollTop = 0;
  }, []);
  const isEditing = initialLyric !== undefined && initialLyric !== null;

  const handleSave = () => {
    if (!text.trim()) return;
    const lyric = {
      id:        isEditing ? initialLyric.id : Date.now(),
      title:     title.trim() || (beat ? beat.title : "Untitled"),
      text:      text.trim(),
      beatTitle: beat ? beat.title : (initialLyric ? initialLyric.beatTitle : ""),
      beatId:    beat ? beat.videoId : (initialLyric ? initialLyric.beatId : ""),
      beat:      beat || (initialLyric ? initialLyric.beat : null),
      savedAt:   isEditing ? initialLyric.savedAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveLyric(lyric, isEditing ? lyricIndex : null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div ref={scrollRef} style={{
      position: "fixed", inset: 0, zIndex: 10001,
      background: "#0a0a0a", display: "flex",
      flexDirection: "column", fontFamily: "'DM Sans',sans-serif",
      paddingTop: "env(safe-area-inset-top)",
    }}>
      <div style={{ background: "#0a0a0a", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid #1a1a1a" }}>
          <button onClick={onClose} style={{
            background: "#1a1a1a", border: "1px solid #333", borderRadius: "50%",
            color: "white", width: 36, height: 36, fontSize: 20, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            ←
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#C026D3", fontWeight: 800, fontSize: 13 }}>✍️ Lyrics Notepad</div>
          </div>
          <button onClick={handleSave} style={{
            background: saved ? "#22C55E" : "#C026D3",
            border: "none", borderRadius: 20, color: "white",
            fontWeight: 800, fontSize: 13, padding: "8px 16px", cursor: "pointer",
          }}>
            {saved ? "Saved!" : "Save"}
          </button>
        </div>

        {beat && (
          <div style={{ borderBottom: "1px solid #1a1a1a", background: "#000" }}>
            <iframe
              key={beat.videoId}
              src={"https://www.youtube.com/embed/" + beat.videoId + "?autoplay=0&rel=0"}
              width="100%"
              height="160"
              style={{ display: "block", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={beat.title}
            />
            <div style={{ padding: "8px 16px", background: "#0d0d0d" }}>
              <div style={{ color: "white", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {beat.title}
              </div>
              <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>{beat.channel}</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid #1a1a1a", background: "#0a0a0a" }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Song title (optional)"
          style={{
            width: "100%", background: "#1a1a1a", border: "1px solid #333",
            borderRadius: 10, padding: "10px 14px", color: "white",
            fontSize: 14, outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Start writing your lyrics here... Writer's block? Tap the AI Lyric Assistant button below!"
        style={{
          flex: 1, background: "#0d0d0d", border: "none", outline: "none",
          color: "white", fontSize: 15, lineHeight: 1.8, padding: "16px",
          resize: "none", fontFamily: "'DM Sans',sans-serif",
          WebkitUserSelect: "text", userSelect: "text",
        }}
      />

      {/* Rhyme Finder Panel */}
      {aiOpen === "rhymes" && (
        <RhymeFinder onClose={() => setAiOpen(null)} onInsert={word => {
          setText(prev => prev ? prev + " " + word : word);
        }} />
      )}

      <div style={{
        padding: "10px 16px",
        background: "#0a0a0a",
        borderTop: aiOpen ? "none" : "1px solid #1a1a1a",
        paddingBottom: aiOpen ? 0 : "calc(10px + env(safe-area-inset-bottom))",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <div style={{ color: "#444", fontSize: 11, flexShrink: 0 }}>
          {text.length} chars • {text.split(" ").filter(function(w){return w.length > 0;}).length} words
        </div>
        <button onClick={() => setAiOpen(aiOpen === "rhymes" ? null : "rhymes")} style={{
          background: aiOpen === "rhymes" ? "rgba(6,182,212,0.2)" : "rgba(6,182,212,0.15)",
          border: "1px solid " + (aiOpen === "rhymes" ? "#06B6D4" : "rgba(6,182,212,0.4)"),
          borderRadius: 20, color: "#06B6D4", fontWeight: 800,
          fontSize: 12, padding: "8px 14px", cursor: "pointer",
        }}>
          🎯 Rhyme Finder
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// FULL-SCREEN PLAYER
// =============================================================================
function Player({ beat, onClose, savedIds, onSave, isArtistPro, onOpenLyrics, savedLyrics, onEditLyric, onGoMembers }) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: "calc(72px + env(safe-area-inset-bottom))", zIndex: 9999, background: "#000",
      display: "flex", flexDirection: "column", fontFamily: "'DM Sans',sans-serif",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px", borderBottom: "1px solid #1a1a1a",
        background: "#0a0a0a", flexShrink: 0,
        paddingTop: "calc(14px + env(safe-area-inset-top))",
      }}>
        <button onClick={onClose} style={{
          background: "#1a1a1a", border: "1px solid #333", borderRadius: "50%",
          color: "white", width: 36, height: 36, fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          ←
        </button>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{
            color: "white", fontWeight: 700, fontSize: 13,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {beat.title}
          </div>
          <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>{beat.channel}</div>
        </div>
      </div>
      <iframe
        key={beat.videoId}
        src={embedUrl(beat.videoId)}
        width="100%" height="220"
        style={{ display: "block", border: "none", background: "#000", flexShrink: 0 }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        title={beat.title}
      />
      <div style={{ padding: "16px", borderBottom: "1px solid #1a1a1a", background: "#0a0a0a" }}>
        <div style={{ color: "white", fontWeight: 700, fontSize: 14, marginBottom: 4, lineHeight: 1.4 }}>
          {beat.title}
        </div>
        <div style={{ color: "#888", fontSize: 13 }}>{beat.channel}</div>
      </div>
      <div style={{ padding: "16px", background: "#0a0a0a", flex: 1 }}>
        <div style={{ color: "#555", fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
          If the video does not play in-app, tap below to open in YouTube.
        </div>
        <a
          href={watchUrl(beat.videoId)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            background: "#FF0000", borderRadius: 14, color: "white",
            fontWeight: 800, fontSize: 16, padding: "15px", textDecoration: "none",
          }}
        >
          ▶ Open in YouTube
        </a>
        <button
          onClick={() => onSave(beat)}
          style={{
            marginTop: 12, width: "100%", borderRadius: 14, padding: "15px",
            fontWeight: 800, fontSize: 16, cursor: "pointer",
            background: savedIds.has(beat.videoId) ? "rgba(192,38,211,0.15)" : "#1a1a1a",
            border: savedIds.has(beat.videoId) ? "2px solid #C026D3" : "1.5px solid #333",
            color: savedIds.has(beat.videoId) ? "#C026D3" : "#aaa",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          {savedIds.has(beat.videoId) ? "🔖 Saved to Favourites" : "🔖 Save to Favourites"}
        </button>
        {isArtistPro ? (
          <>
            <button
              onClick={() => onOpenLyrics(beat)}
              style={{
                marginTop: 10, width: "100%", borderRadius: 14, padding: "15px",
                fontWeight: 800, fontSize: 16, cursor: "pointer",
                background: "rgba(192,38,211,0.1)",
                border: "1.5px solid #C026D3", color: "#C026D3",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
            >
              &#9997;&#65039; Write Lyrics to This Beat
            </button>
            {savedLyrics && savedLyrics.find(l => l.beatId === beat.videoId) && (
              <button
                onClick={() => { var idx = savedLyrics.findIndex(l => l.beatId === beat.videoId); onEditLyric(savedLyrics[idx], idx); }}
                style={{
                  marginTop: 10, width: "100%", borderRadius: 14, padding: "15px",
                  fontWeight: 800, fontSize: 15, cursor: "pointer",
                  background: "rgba(34,197,94,0.1)",
                  border: "1.5px solid #22C55E", color: "#22C55E",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                }}
              >
                📄 Open Existing Lyrics - {savedLyrics.find(l => l.beatId === beat.videoId).title}
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => { onClose(); onGoMembers && onGoMembers(); }}
            style={{
              marginTop: 10, width: "100%", borderRadius: 14, padding: "15px",
              fontWeight: 800, fontSize: 15, cursor: "pointer",
              background: "#111", border: "1.5px solid #2a2a2a", color: "#444",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}
          >
            🔐 Purchase plan to write lyrics
          </button>
        )}

      </div>
    </div>
  );
}

// =============================================================================
// BEAT CARD
// =============================================================================
function BeatCard({ beat, savedIds, onSave, onPlay, featured, exclusive }) {
  const [imgErr, setImgErr] = useState(false);
  const isSaved  = savedIds.has(beat.videoId);
  const accentClr = exclusive ? "#F59E0B" : featured ? "#C026D3" : "#7C3AED";
  const borderClr = exclusive ? "rgba(245,158,11,0.25)" : featured ? "rgba(192,38,211,0.25)" : "rgba(255,255,255,0.06)";
  const glowClr   = exclusive ? "rgba(245,158,11,0.35)" : "rgba(192,38,211,0.35)";

  return (
    <div className="bf-card" style={{
      background: "linear-gradient(180deg,#161616 0%,#111 100%)",
      borderRadius: 18, overflow: "hidden", marginBottom: 16,
      border: "1px solid " + borderClr,
      boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
    }}>
      {/* Thumbnail */}
      <div style={{ position: "relative", height: 190, cursor: "pointer", overflow: "hidden" }}
           onClick={() => onPlay(beat)}>
        {beat.thumbnail && !imgErr ? (
          <img src={beat.thumbnail} alt={beat.title} onError={() => setImgErr(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: "scale(1.02)" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1a1a2e," + accentClr + "44)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 40, opacity: 0.3 }}>🎵</span>
          </div>
        )}
        {/* Gradient overlay */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.15) 50%,rgba(0,0,0,0.05) 100%)" }} />
        {/* Premium play button */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="bf-play" style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg," + accentClr + ",rgba(124,58,237,0.9))",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 0 3px rgba(255,255,255,0.12), 0 8px 32px " + glowClr,
            backdropFilter: "blur(4px)",
          }}>
            <span style={{ fontSize: 20, marginLeft: 4, color: "white" }}>▶</span>
          </div>
        </div>
        {/* Badges */}
        {(featured || exclusive) && (
          <div style={{ position: "absolute", top: 10, left: 12 }}>
            <div style={{ background: featured ? "linear-gradient(135deg,#C026D3,#7C3AED)" : "linear-gradient(135deg,#F59E0B,#EF4444)", borderRadius: 20, padding: "4px 12px", fontSize: 10, color: "white", fontWeight: 800, letterSpacing: 0.5 }}>
              {featured ? "⭐ FEATURED" : "🔒 EXCLUSIVE"}
            </div>
          </div>
        )}
        {/* Save button */}
        <button className="bf-save" onClick={e => { e.stopPropagation(); onSave(beat); }}
          style={{ position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            background: isSaved ? "rgba(192,38,211,0.9)" : "rgba(0,0,0,0.55)",
            backdropFilter: "blur(8px)",
            boxShadow: isSaved ? "0 0 12px rgba(192,38,211,0.5)" : "none",
            color: isSaved ? "white" : "rgba(255,255,255,0.7)",
          }}>
          🔖
        </button>
        {/* View count at bottom of image */}
        {beat.viewsLabel && (
          <div style={{ position: "absolute", bottom: 10, left: 12 }}>
            <div style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", border: "1px solid rgba(192,38,211,0.4)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#C026D3", fontWeight: 700 }}>
              {beat.viewsLabel}
            </div>
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: "14px 16px 12px" }}>
        <div onClick={() => onPlay(beat)} style={{ color: "white", fontWeight: 700, fontSize: 14, lineHeight: 1.45, marginBottom: 6, cursor: "pointer",
          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {beat.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ color: "#666", fontSize: 12, fontWeight: 500 }}>{beat.channel}</div>
          <a href={watchUrl(beat.videoId)} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,0,0,0.1)", border: "1px solid rgba(255,0,0,0.25)", borderRadius: 20, padding: "3px 10px", color: "#FF4444", fontSize: 10, fontWeight: 700, textDecoration: "none" }}>
            ▶ YouTube
          </a>
        </div>
      </div>
    </div>
  );
}


// =============================================================================
// BEAT FEED
// =============================================================================
function BeatFeed({ artistName, featured, exclusive, savedIds, onSave, onPlay, showPagination, filterTitle, instrumentalOnly, max, extraQueries, blockedChannels }) {
  const [beats,   setBeats]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [page,    setPage]    = useState(1);
  const TOTAL_PAGES = 10;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setBeats([]);
    window.scrollTo(0, 0);

    fetchBeats(artistName, page, filterTitle, max || 20, extraQueries).then(({ beats: b, error: e }) => {
      if (!alive) return;
      const INSTRUMENTAL_KEYWORDS = ["instrumental", "riddim", "beat", "free beat", "backing track"];
      let filtered = instrumentalOnly
        ? b.filter(beat => INSTRUMENTAL_KEYWORDS.some(kw => beat.title.toLowerCase().includes(kw)))
        : b;
      if (blockedChannels && blockedChannels.length > 0) {
        const blocked = blockedChannels.map(c => c.toLowerCase());
        filtered = filtered.filter(beat => !blocked.some(c => beat.channel.toLowerCase().includes(c)));
      }
      setBeats(filtered);
      setError(e);
      setLoading(false);
    });

    return () => { alive = false; };
  }, [artistName, page]);

  const PageNav = () => {
    if (!showPagination) return null;
    return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, background: "#111", borderRadius: 12, padding: "10px 14px", border: "1px solid #1e1e1e" }}>
      <button
        onClick={() => { if (page > 1) setPage(p => p - 1); }}
        disabled={page === 1}
        style={{
          background: page === 1 ? "transparent" : "#1a1a1a",
          border: page === 1 ? "1px solid #222" : "1px solid #444",
          borderRadius: 10, color: page === 1 ? "#333" : "white",
          fontWeight: 800, fontSize: 14, padding: "8px 16px", cursor: page === 1 ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}>
        Prev
      </button>
      <div style={{ color: "#888", fontSize: 13, fontWeight: 600 }}>
        Page {page} of {TOTAL_PAGES}
      </div>
      <button
        onClick={() => { if (page < TOTAL_PAGES) setPage(p => p + 1); }}
        disabled={page === TOTAL_PAGES}
        style={{
          background: page === TOTAL_PAGES ? "transparent" : "#C026D3",
          border: page === TOTAL_PAGES ? "1px solid #222" : "none",
          borderRadius: 10, color: page === TOTAL_PAGES ? "#333" : "white",
          fontWeight: 800, fontSize: 14, padding: "8px 16px", cursor: page === TOTAL_PAGES ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}>
        Next
      </button>
    </div>
    );
  };

  if (loading) return <BFLoader type="bars" text="LOADING BEATS...PLEASE BE PATIENT." />;

  if (error && !beats.length) return (
    <div style={{ padding: "20px 0" }}>
      <div style={{
        background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)",
        borderRadius: 14, padding: 20, textAlign: "center",
      }}>
        <div style={{ color: "#F87171", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
          Could not load beats
        </div>
        <div style={{ color: "#888", fontSize: 13, lineHeight: 1.6 }}>{error}</div>
      </div>
    </div>
  );

  return (
    <>
      <PageNav />
      {beats.map(beat => (
        <BeatCard
          key={beat.videoId}
          beat={beat}
          savedIds={savedIds}
          onSave={onSave}
          onPlay={onPlay}
          featured={featured}
          exclusive={exclusive}
        />
      ))}
      {!beats.length && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#555", fontSize: 14 }}>
          No beats found.
        </div>
      )}

      {showPagination && (
        <div style={{ padding: "20px 0 40px" }}>
          <div style={{ color: "#555", fontSize: 12, textAlign: "center", marginBottom: 14 }}>
            Page {page} of {TOTAL_PAGES}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: page === p ? "#C026D3" : "#1a1a1a",
                  border: page === p ? "2px solid #C026D3" : "1.5px solid #333",
                  color: page === p ? "white" : "#888",
                  fontWeight: page === p ? 800 : 600,
                  fontSize: 14, cursor: "pointer",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// =============================================================================
// HOME SCREEN
// =============================================================================
// =============================================================================
// WORKSPACE SECTION - personalised dashboard for Artist Pro & Producer Pro
// =============================================================================
function WorkspaceSection({ user, savedLyrics, onEditLyric, onPlay, savedIds, onSave, onGenreSearch, onGoMembers }) {
  const isProducer = user?.isPro || user?.plan === "producer";

  const [beatOfDay,      setBeatOfDay]      = useState(null);
  const [botdLoading,    setBotdLoading]    = useState(true);
  const [vibeActive,     setVibeActive]     = useState(null);
  const [producerStats,  setProducerStats]  = useState(null);

  const VIBES = [
    { label: "Hype",     q: "hard trap type beat",      emoji: "🔥", color: "#EF4444" },
    { label: "Chill",    q: "chill lo fi type beat",    emoji: "😌", color: "#3B82F6" },
    { label: "Dark",     q: "dark drill type beat",     emoji: "🌑", color: "#8B5CF6" },
    { label: "Melodic",  q: "melodic type beat",        emoji: "🌊", color: "#06B6D4" },
    { label: "Romantic", q: "romantic r&b type beat",   emoji: "💜", color: "#EC4899" },
  ];

  // Derive top genre from recent searches stored in localStorage
  var topGenre = null;
  try {
    var recents = JSON.parse(localStorage.getItem("bf_recents") || "[]");
    var genreKeywords = ["trap","drill","rnb","r&b","afro","melodic","dancehall","sad","lo-fi","lofi","boom bap","reggae","grime"];
    for (var ri = 0; ri < recents.length; ri++) {
      var r = recents[ri].toLowerCase();
      for (var gi = 0; gi < genreKeywords.length; gi++) {
        if (r.includes(genreKeywords[gi])) { topGenre = recents[ri]; break; }
      }
      if (topGenre) break;
    }
    if (!topGenre && recents.length > 0) topGenre = recents[0];
  } catch (e) {}

  // Last unfinished lyric
  var lastLyric = null;
  if (savedLyrics && savedLyrics.length > 0) {
    lastLyric = savedLyrics[savedLyrics.length - 1];
  }

  // Beat of the Day - fetch once and cache in sessionStorage
  useEffect(function() {
    var cacheKey = "bf_botd_" + new Date().toDateString();
    try {
      var cached = sessionStorage.getItem(cacheKey);
      if (cached) { setBeatOfDay(JSON.parse(cached)); setBotdLoading(false); return; }
    } catch(e) {}

    var queries = ["type beat free 2025", "melodic trap type beat free", "uk drill type beat free"];
    var q = queries[new Date().getDate() % queries.length];
    apiFetch("/api/youtube/search?artist=" + encodeURIComponent(q) + "&max=20&page=1&filter_title=false")
      .then(function(d) {
        var beats = d.beats || [];
        if (beats.length > 0) {
          var pick = beats[new Date().getDate() % beats.length];
          try { sessionStorage.setItem(cacheKey, JSON.stringify(pick)); } catch(e) {}
          setBeatOfDay(pick);
        }
        setBotdLoading(false);
      })
      .catch(function() { setBotdLoading(false); });
  }, []);

  // Producer stats
  useEffect(function() {
    if (!isProducer) return;
    Promise.all([
      apiFetch("/api/producer/my-beats").catch(function() { return []; }),
      apiFetch("/api/producer/my-leases").catch(function() { return []; }),
    ]).then(function(results) {
      var beats = results[0];
      var leases = results[1];
      var totalRevenue = leases.reduce(function(s, l) {
        var p = parseFloat((l.price || "0").replace(/[^0-9.]/g, ""));
        return s + (isNaN(p) ? 0 : p);
      }, 0);
      var totalDownloads = beats.reduce(function(s, b) { return s + (b.downloads || 0); }, 0);
      setProducerStats({
        totalBeats: beats.length,
        totalDownloads: totalDownloads,
        totalRevenue: totalRevenue.toFixed(2),
        recentSales: leases.length,
      });
    });
  }, [isProducer]);

  // BeatFinder Rank - based on saves count (gamified)
  var savedCount = savedIds ? savedIds.size : 0;
  var rank = savedCount >= 50 ? "Top 1%" : savedCount >= 30 ? "Top 5%" : savedCount >= 20 ? "Top 10%" : savedCount >= 10 ? "Top 25%" : savedCount >= 5 ? "Top 50%" : "Rising";
  var rankEmoji = savedCount >= 30 ? "👑" : savedCount >= 10 ? "⭐" : "🔥";
  var streak = Math.min(savedCount + (savedLyrics ? savedLyrics.length : 0), 99);

  var firstName = user && user.name ? user.name.split(" ")[0] : "";

  var cardStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14, padding: "14px 12px",
    cursor: "pointer", textAlign: "left",
    width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "0 16px", marginBottom: 28 }}>
      <div style={{
        background: "linear-gradient(135deg,#080014,#10002e,#0a0020)",
        border: "1px solid rgba(192,38,211,0.25)",
        borderRadius: 20, padding: "20px 16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}>
        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ color: "#C026D3", fontSize: 10, fontWeight: 800, letterSpacing: 2.5, marginBottom: 5 }}>
            YOUR WORKSPACE
          </div>
          <div style={{ color: "white", fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>
            {"Welcome back" + (firstName ? ", " + firstName : "") + " 👋"}
          </div>
          {isProducer && (
            <div style={{ color: "#C026D3", fontSize: 12, fontWeight: 600, marginTop: 3 }}>Producer Pro</div>
          )}
        </div>

        {/* 1. YOUR VIBE RIGHT NOW */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#888", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10 }}>
            🎯 YOUR VIBE RIGHT NOW
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {VIBES.map(function(v) {
              var isActive = vibeActive === v.label;
              return (
                <button
                  key={v.label}
                  onClick={function() {
                    setVibeActive(v.label);
                    onGenreSearch(v.q);
                  }}
                  style={{
                    flexShrink: 0, padding: "7px 13px", borderRadius: 20, cursor: "pointer",
                    border: "1.5px solid " + (isActive ? v.color : "rgba(255,255,255,0.1)"),
                    background: isActive ? v.color + "22" : "rgba(255,255,255,0.03)",
                    color: isActive ? v.color : "#777",
                    fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 5,
                    transition: "all 0.15s ease",
                  }}>
                  <span style={{ fontSize: 13 }}>{v.emoji}</span>
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 16 }} />

        {/* 2. TOP GENRE */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#888", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10 }}>
            🔥 YOUR TOP GENRE
          </div>
          {topGenre ? (
            <button
              onClick={function() { onGenreSearch(topGenre); }}
              style={{
                width: "100%", background: "linear-gradient(135deg,rgba(192,38,211,0.15),rgba(124,58,237,0.15))",
                border: "1.5px solid rgba(192,38,211,0.35)", borderRadius: 12,
                padding: "12px 14px", cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                boxSizing: "border-box",
              }}>
              <div>
                <div style={{ color: "white", fontWeight: 700, fontSize: 14 }}>{topGenre}</div>
                <div style={{ color: "#C026D3", fontSize: 11, marginTop: 2 }}>You keep coming back to this</div>
              </div>
              <span style={{ color: "#C026D3", fontSize: 18 }}>&#9654;</span>
            </button>
          ) : (
            <div style={{ color: "#444", fontSize: 13, fontStyle: "italic", padding: "10px 0" }}>
              Search a few artists to unlock your top genre
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 16 }} />

        {/* 3. CONTINUE WRITING */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#888", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10 }}>
            ✍️ CONTINUE WRITING
          </div>
          {lastLyric ? (
            <button
              onClick={function() { onEditLyric(lastLyric, savedLyrics.length - 1); }}
              style={{
                width: "100%", background: "rgba(192,38,211,0.08)",
                border: "1.5px solid rgba(192,38,211,0.25)", borderRadius: 12,
                padding: "12px 14px", cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", gap: 12,
                boxSizing: "border-box",
              }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: "linear-gradient(135deg,#6B21A8,#C026D3)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>
                ✍️
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ color: "white", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {lastLyric.title || "Untitled"}
                </div>
                <div style={{ color: "#C026D3", fontSize: 11, marginTop: 2 }}>
                  {lastLyric.text ? (lastLyric.text.split(" ").length + " words") : "Empty"} — tap to continue
                </div>
              </div>
              <span style={{ color: "#555", fontSize: 18 }}>&#62;</span>
            </button>
          ) : (
            <button
              onClick={function() { onGoMembers(); }}
              style={{
                width: "100%", background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
                padding: "12px 14px", cursor: "pointer", textAlign: "center",
                color: "#555", fontSize: 13, boxSizing: "border-box",
              }}>
              No lyrics yet — play a beat and tap Write Lyrics
            </button>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 16 }} />

        {/* 4. BEAT OF THE DAY */}
        <div style={{ marginBottom: isProducer ? 16 : 0 }}>
          <div style={{ color: "#888", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10 }}>
            🎵 BEAT OF THE DAY
          </div>
          {botdLoading ? (
            <div style={{ color: "#444", fontSize: 13, padding: "10px 0" }}>Finding your beat...</div>
          ) : beatOfDay ? (
            <div
              onClick={function() { onPlay(beatOfDay); }}
              style={{
                display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                background: "linear-gradient(135deg,rgba(245,158,11,0.08),rgba(239,68,68,0.08))",
                border: "1.5px solid rgba(245,158,11,0.25)", borderRadius: 12, padding: "10px 12px",
              }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <img
                  src={beatOfDay.thumbnail || "https://img.youtube.com/vi/" + beatOfDay.videoId + "/hqdefault.jpg"}
                  alt={beatOfDay.title}
                  style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", display: "block" }}
                />
                <div style={{
                  position: "absolute", inset: 0, borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(0,0,0,0.4)",
                }}>
                  <span style={{ color: "white", fontSize: 16 }}>&#9654;</span>
                </div>
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ color: "white", fontWeight: 700, fontSize: 13, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {beatOfDay.title}
                </div>
                <div style={{ color: "#F59E0B", fontSize: 11, marginTop: 3, fontWeight: 600 }}>
                  Picked for you today
                </div>
              </div>
              <button
                className="bf-save"
                onClick={function(e) { e.stopPropagation(); onSave(beatOfDay); }}
                style={{
                  flexShrink: 0, width: 30, height: 30, borderRadius: "50%", border: "none",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  background: savedIds && savedIds.has(beatOfDay.videoId) ? "rgba(192,38,211,0.9)" : "rgba(255,255,255,0.08)",
                  color: savedIds && savedIds.has(beatOfDay.videoId) ? "white" : "rgba(255,255,255,0.5)",
                }}>
                🔖
              </button>
            </div>
          ) : (
            <div style={{ color: "#444", fontSize: 13, fontStyle: "italic" }}>Could not load today's beat</div>
          )}
        </div>

        {/* PRODUCER ONLY SECTIONS */}
        {isProducer && (
          <div>
            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 16 }} />

            {/* 5. PRODUCER EARNINGS SNAPSHOT */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: "#888", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10 }}>
                💰 PRODUCER EARNINGS SNAPSHOT
              </div>
              {producerStats ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Beats Uploaded",  value: producerStats.totalBeats,     color: "#C026D3", icon: "🎵" },
                    { label: "Total Downloads",  value: producerStats.totalDownloads, color: "#3B82F6", icon: "⬇️" },
                    { label: "Total Revenue",    value: "£" + producerStats.totalRevenue, color: "#22C55E", icon: "💸" },
                    { label: "Leases Sold",      value: producerStats.recentSales,   color: "#F59E0B", icon: "📝" },
                  ].map(function(stat) {
                    return (
                      <div key={stat.label} style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 12, padding: "12px 10px", textAlign: "center",
                      }}>
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{stat.icon}</div>
                        <div style={{ color: stat.color, fontWeight: 800, fontSize: 18, lineHeight: 1 }}>
                          {stat.value}
                        </div>
                        <div style={{ color: "#555", fontSize: 10, fontWeight: 600, marginTop: 4, letterSpacing: 0.5 }}>
                          {stat.label.toUpperCase()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: "#444", fontSize: 13, padding: "10px 0" }}>Loading your stats...</div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 16 }} />

            {/* 6. BEATFINDER RANK */}
            <div>
              <div style={{ color: "#888", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10 }}>
                🏆 YOUR BEATFINDER RANK
              </div>
              <div style={{
                background: "linear-gradient(135deg,rgba(192,38,211,0.12),rgba(245,158,11,0.12))",
                border: "1.5px solid rgba(192,38,211,0.2)",
                borderRadius: 14, padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: "linear-gradient(135deg,#C026D3,#F59E0B)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                }}>
                  {rankEmoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "white", fontWeight: 800, fontSize: 16 }}>{rank}</div>
                  <div style={{ color: "#888", fontSize: 12, marginTop: 2 }}>
                    {streak} activity points this week
                  </div>
                </div>
                <div style={{
                  background: "linear-gradient(135deg,#C026D3,#7C3AED)",
                  borderRadius: 20, padding: "5px 14px",
                  color: "white", fontWeight: 800, fontSize: 12, flexShrink: 0,
                }}>
                  PRO
                </div>
              </div>
              <div style={{ color: "#444", fontSize: 11, marginTop: 8, textAlign: "center" }}>
                Save more beats and write more lyrics to climb the ranks
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HomeScreen({ savedIds, onSave, onPlay, user, onGoMembers, onGoProfile, onGenreSearch, savedLyrics, onEditLyric, onGoTrending }) {
  const [heroIndex, setHeroIndex] = useState(0);

  const HERO_SLIDES = [
    {
      title: "Find Your Sound",
      sub: "Millions of type beats - one tap away",
      emoji: "🎵",
      grad: "linear-gradient(135deg,#12002a 0%,#3b0070 60%,#C026D3 100%)",
      cta: "Explore Beats",
      btnColor: "rgba(192,38,211,0.5)",
      btnBorder: "rgba(192,38,211,0.7)",
    },
    {
      title: "Write & Save Lyrics",
      sub: "Write lyrics whilst beats play & save to your profile",
      emoji: "📝",
      grad: "linear-gradient(135deg,#001a0a 0%,#003318 40%,#065f2f 75%,#16A34A 100%)",
      cta: "Write Lyrics",
      lyricsSlide: true,
      btnColor: "rgba(22,163,74,0.5)",
      btnBorder: "rgba(22,163,74,0.7)",
    },
    {
      title: "Rhyme Finder",
      sub: "Find perfect rhymes & multi-syllable rhymes while you write",
      emoji: "✍️",
      grad: "linear-gradient(135deg,#1a0a00 0%,#3d1800 40%,#7c3500 75%,#EA580C 100%)",
      cta: "Try It Now",
      lyricsSlide: true,
      btnColor: "rgba(234,88,12,0.5)",
      btnBorder: "rgba(234,88,12,0.7)",
    },
    {
      title: "Discover Rising Producers",
      sub: "Tap in with producers worldwide",
      emoji: "🎯",
      grad: "linear-gradient(135deg,#001230 0%,#002a70 60%,#3B82F6 100%)",
      cta: "Find Producers",
      btnColor: "rgba(59,130,246,0.5)",
      btnBorder: "rgba(59,130,246,0.7)",
      trendingSlide: true,
    },
    {
      title: "Sell Your Beats",
      sub: "Upload, price, and earn on every lease",
      emoji: "🎛",
      grad: "linear-gradient(135deg,#180800 0%,#3a1500 60%,#F59E0B 100%)",
      cta: "Go Producer Pro",
      btnColor: "rgba(245,158,11,0.5)",
      btnBorder: "rgba(245,158,11,0.7)",
    },
  ];

  const GENRES = [
    { label: "Trap",       q: "trap type beat",       color: "#C026D3", emoji: "🔥" },
    { label: "UK Drill",   q: "uk drill type beat",   color: "#3B82F6", emoji: "🎯" },
    { label: "R&B",        q: "rnb type beat",        color: "#F59E0B", emoji: "🎵" },
    { label: "Afrobeat",   q: "afrobeat type beat",   color: "#22C55E", emoji: "🌍" },
    { label: "Melodic",    q: "melodic type beat",    color: "#818CF8", emoji: "🌊" },
    { label: "Dancehall",  q: "dancehall riddim",     color: "#EC4899", emoji: "🎪" },
  ];

  const [heroPaused, setHeroPaused] = useState(false);
  const heroTouchX = useRef(null);

  useEffect(() => {
    if (heroPaused) return;
    const t = setInterval(() => setHeroIndex(i => (i + 1) % HERO_SLIDES.length), 4200);
    return () => clearInterval(t);
  }, [heroPaused]);

  const slide = HERO_SLIDES[heroIndex];

  const handleHeroTouchStart = (e) => {
    heroTouchX.current = e.touches[0].clientX;
    setHeroPaused(true);
  };

  const handleHeroTouchEnd = (e) => {
    if (heroTouchX.current === null) return;
    const diff = heroTouchX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        setHeroIndex(i => (i + 1) % HERO_SLIDES.length);
      } else {
        setHeroIndex(i => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
      }
    }
    heroTouchX.current = null;
    setTimeout(() => setHeroPaused(false), 3000);
  };

  const SectionHead = ({ emoji, title, sub }) => (
    <div style={{ paddingLeft: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
        <span style={{ color: "white", fontWeight: 800, fontSize: 16,
          fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>{title}</span>
      </div>
      {sub && <div style={{ color: "#555", fontSize: 12, marginLeft: 26 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="bf-page" style={{ paddingBottom: 100, overflowX: "hidden" }}>

      {/* Logo */}
      <div style={{ padding: "18px 16px 0" }}>
        <img
          src="https://i.ibb.co/9myqbFB7/2-BB02064-13-F6-476-C-89-FF-B1-EDDAE0-C709.png"
          alt="BeatFinder"
          style={{ width: "100%", maxWidth: 320, display: "block", margin: "0 auto" }}
        />
      </div>

      {/* Hero Banner */}
      <div style={{ padding: "14px 16px 0" }}>
        <div
          onTouchStart={handleHeroTouchStart}
          onTouchEnd={handleHeroTouchEnd}
          style={{
          background: slide.grad, borderRadius: 22, padding: "22px 20px 18px",
          marginBottom: 20, position: "relative", overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          minHeight: 140,
          transition: "background 0.4s ease",
          userSelect: "none",
        }}>
          {/* Large bg emoji */}
          <div style={{
            position: "absolute", right: -8, top: -12,
            fontSize: 90, opacity: 0.1, lineHeight: 1, userSelect: "none",
          }}>{slide.emoji}</div>

          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 800,
            letterSpacing: 2.5, marginBottom: 8 }}>BEATFINDER</div>
          <div style={{ color: "white", fontSize: 24, fontWeight: 900,
            lineHeight: 1.1, marginBottom: 6, fontFamily: "'Bebas Neue',sans-serif",
            letterSpacing: 1 }}>{slide.title}</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13,
            marginBottom: 18, lineHeight: 1.5 }}>{slide.sub}</div>
          <button onClick={slide.trendingSlide ? onGoTrending : onGoProfile} style={{
            background: slide.btnColor || "rgba(255,255,255,0.15)",
            backdropFilter: "blur(10px)",
            border: "1px solid " + (slide.btnBorder || "rgba(255,255,255,0.25)"),
            borderRadius: 22,
            color: "white", fontWeight: 800, fontSize: 13,
            padding: "9px 20px", cursor: "pointer",
          }}>{slide.cta} →</button>

          {/* Dot indicators */}
          <div style={{ position: "absolute", bottom: 14, right: 16,
            display: "flex", gap: 5, alignItems: "center" }}>
            {HERO_SLIDES.map((_, i) => (
              <div key={i} onClick={() => setHeroIndex(i)} style={{
                width: i === heroIndex ? 18 : 5, height: 5, borderRadius: 3,
                background: i === heroIndex ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)",
                cursor: "pointer", transition: "all 0.35s cubic-bezier(0.22,1,0.36,1)",
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Pro upsell strip for free users */}
      {(!user || (!user.isPro && !user.isArtistPro)) && (
        <div style={{ padding: "0 16px", marginBottom: 22 }}>
          <div style={{
            background: "linear-gradient(135deg,#0d0020,#1a0040)",
            border: "1px solid rgba(192,38,211,0.25)",
            borderRadius: 16, padding: "13px 16px",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{ fontSize: 28 }}>🔒</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "white", fontWeight: 800, fontSize: 14, marginBottom: 2 }}>
                Unlock Pro
              </div>
              <div style={{ color: "#666", fontSize: 12 }}>Lyrics, MP3s, exclusive beats</div>
            </div>
            <button onClick={onGoProfile} className="bf-btn" style={{
              background: "linear-gradient(135deg,#C026D3,#7C3AED)",
              border: "none", borderRadius: 20, color: "white",
              fontWeight: 800, fontSize: 12, padding: "8px 16px",
              cursor: "pointer", flexShrink: 0,
            }}>From £4.99</button>
          </div>
        </div>
      )}

      {/* Featured Beats Carousel */}
      <div style={{ marginBottom: 28 }}>
        <SectionHead emoji="⭐" title="FEATURED BEATS" sub="Hand-picked from YouTube" />
        <FeaturedCarousel savedIds={savedIds} onSave={onSave} onPlay={onPlay} />
      </div>

      {/* Genre chips */}
      <div style={{ marginBottom: 28 }}>
        <SectionHead emoji="🎯" title="BROWSE BY GENRE" />
        <div className="bf-carousel" style={{ overflowX: "auto", scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch", paddingLeft: 16 }}>
          <div style={{ display: "flex", gap: 10, paddingRight: 16 }}>
            {GENRES.map(g => (
              <div key={g.label} onClick={() => onGenreSearch(g.q)} style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: 7,
                background: g.color + "18",
                border: "1.5px solid " + g.color + "44",
                borderRadius: 50, padding: "9px 18px", cursor: "pointer",
              }}>
                <span style={{ fontSize: 15 }}>{g.emoji}</span>
                <span style={{ color: "white", fontWeight: 700, fontSize: 13,
                  whiteSpace: "nowrap" }}>{g.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>



      {/* Pro personalised workspace */}
      {user?.isArtistPro && (
        <WorkspaceSection
          user={user}
          savedLyrics={savedLyrics || []}
          onEditLyric={onEditLyric}
          onPlay={onPlay}
          savedIds={savedIds}
          onSave={onSave}
          onGenreSearch={onGenreSearch}
          onGoMembers={onGoMembers}
        />
      )}
    </div>
  );
}

function FeaturedCarousel({ savedIds, onSave, onPlay }) {
  const [beats, setBeats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/youtube/search?artist=best+free+beats&page=1&filter_title=false&max=8")
      .then(d => { setBeats(d.beats || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ paddingLeft: 16 }}>
      <BFLoader type="bars" text="LOADING BEATS...PLEASE BE PATIENT." />
    </div>
  );

  return (
    <div className="bf-carousel" style={{
      overflowX: "auto", scrollbarWidth: "none",
      WebkitOverflowScrolling: "touch", paddingLeft: 16,
    }}>
      <div style={{ display: "flex", gap: 12, paddingRight: 16 }}>
        {beats.map(beat => {
          const isSaved = savedIds.has(beat.videoId);
          return (
            <div key={beat.videoId} className="bf-card" onClick={() => onPlay(beat)} style={{
              flexShrink: 0, width: 178, cursor: "pointer",
              background: "linear-gradient(180deg,#1a1a1a,#111)",
              borderRadius: 16, overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}>
              <div style={{ position: "relative", height: 112, overflow: "hidden" }}>
                <img
                  src={beat.thumbnail || "https://img.youtube.com/vi/" + beat.videoId + "/hqdefault.jpg"}
                  alt={beat.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                <div style={{ position: "absolute", inset: 0,
                  background: "linear-gradient(to top,rgba(0,0,0,0.7),transparent 55%)" }} />
                <div style={{ position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className="bf-play" style={{
                    width: 42, height: 42, borderRadius: "50%",
                    background: "linear-gradient(135deg,#C026D3,#7C3AED)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 0 3px rgba(255,255,255,0.12),0 6px 20px rgba(192,38,211,0.5)",
                  }}>
                    <span style={{ fontSize: 16, marginLeft: 3, color: "white" }}>▶</span>
                  </div>
                </div>
                <button className="bf-save" onClick={e => { e.stopPropagation(); onSave(beat); }} style={{
                  position: "absolute", top: 7, right: 7,
                  width: 30, height: 30, borderRadius: "50%", border: "none",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 14,
                  background: isSaved ? "rgba(192,38,211,0.9)" : "rgba(0,0,0,0.65)",
                  color: isSaved ? "white" : "rgba(255,255,255,0.6)",
                  boxShadow: isSaved ? "0 0 10px rgba(192,38,211,0.5)" : "none",
                }}>🔖</button>
              </div>
              <div style={{ padding: "10px 12px 12px" }}>
                <div style={{
                  color: "white", fontSize: 12, fontWeight: 700, lineHeight: 1.4,
                  overflow: "hidden", display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical", marginBottom: 4,
                }}>{beat.title}</div>
                <div style={{ color: "#555", fontSize: 10, fontWeight: 500 }}>{beat.channel}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendingStrip({ savedIds, onSave, onPlay }) {
  const [beats, setBeats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/youtube/trending")
      .then(d => { setBeats((d.beats || []).slice(0, 6)); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ paddingLeft: 16 }}>
      <BFLoader type="bars" text="LOADING BEATS...PLEASE BE PATIENT." />
    </div>
  );

  if (!beats.length) return null;

  return (
    <div className="bf-carousel" style={{
      overflowX: "auto", scrollbarWidth: "none",
      WebkitOverflowScrolling: "touch", paddingLeft: 16,
    }}>
      <div style={{ display: "flex", gap: 12, paddingRight: 16 }}>
        {beats.map((beat, i) => {
          const isSaved = savedIds.has(beat.videoId);
          return (
            <div key={beat.videoId} className="bf-card" onClick={() => onPlay(beat)} style={{
              flexShrink: 0, width: 152, cursor: "pointer",
              background: "linear-gradient(180deg,#161616,#0f0f0f)",
              borderRadius: 14, overflow: "hidden",
              border: "1px solid rgba(245,158,11,0.12)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            }}>
              <div style={{ position: "relative", height: 96, overflow: "hidden" }}>
                <img
                  src={beat.thumbnail || "https://img.youtube.com/vi/" + beat.videoId + "/hqdefault.jpg"}
                  alt={beat.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} />
                {/* Rank badge */}
                <div style={{
                  position: "absolute", top: 7, left: 8,
                  background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
                  border: "1px solid rgba(245,158,11,0.4)",
                  borderRadius: 20, padding: "2px 9px",
                  fontSize: 10, color: "#F59E0B", fontWeight: 900,
                }}>#{i + 1}</div>
                <div style={{ position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "linear-gradient(135deg,#F59E0B,#EF4444)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 16px rgba(245,158,11,0.5)",
                  }}>
                    <span style={{ fontSize: 14, marginLeft: 3, color: "white" }}>▶</span>
                  </div>
                </div>
                <button className="bf-save" onClick={e => { e.stopPropagation(); onSave(beat); }} style={{
                  position: "absolute", top: 5, right: 6,
                  width: 26, height: 26, borderRadius: "50%", border: "none",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 12,
                  background: isSaved ? "rgba(192,38,211,0.9)" : "rgba(0,0,0,0.65)",
                  color: isSaved ? "white" : "rgba(255,255,255,0.5)",
                }}>🔖</button>
              </div>
              <div style={{ padding: "8px 10px 10px" }}>
                <div style={{
                  color: "white", fontSize: 11, fontWeight: 700, lineHeight: 1.35,
                  overflow: "hidden", display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical", marginBottom: 3,
                }}>{beat.title}</div>
                <div style={{ color: "#555", fontSize: 10 }}>{beat.channel}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// =============================================================================
// ARTISTS SCREEN
// =============================================================================
function ArtistsScreen({ onPlay, savedIds, onSave }) {
  const [region,       setRegion]       = useState("USA");
  const [cat,          setCat]          = useState("All");
  const [search,       setSearch]       = useState("");
  const [selectedArtist, setSelectedArtist] = useState(null);

  // If an artist is selected, show their beat page
  if (selectedArtist) {
    return (
      <ArtistDetailScreen
        artist={selectedArtist}
        onBack={() => setSelectedArtist(null)}
        onPlay={onPlay}
        savedIds={savedIds}
        onSave={onSave}
      />
    );
  }

  const REGION_MAP = {
    USA:     { artists: ARTISTS_USA,     cats: USA_CATS     },
    UK:      { artists: ARTISTS_UK,      cats: UK_CATS      },
    JAMAICA: { artists: ARTISTS_JAMAICA, cats: JAMAICA_CATS },
    AFRICA:  { artists: ARTISTS_AFRICA,  cats: AFRICA_CATS  },
  };
  const artists = REGION_MAP[region].artists;
  const cats    = REGION_MAP[region].cats;
  const list    = artists.filter(a =>
    (cat === "All" || a.cat === cat) &&
    a.name.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0 14px" }}>
        <div>
          <div style={{ color: "white", fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, letterSpacing: 2 }}>BEATFINDER</div>
          <div style={{ color: "#888", fontSize: 13 }}>Type beats, organized.</div>
        </div>
        <img
          src="https://i.ibb.co/v4wcZVJW/IMG-9119.jpg"
          alt="BeatFinder Logo"
          style={{
            width: 72, height: 72, borderRadius: 16,
            objectFit: "cover", flexShrink: 0,

          }}
        />
      </div>
      <div style={{ background: "#1a1a1a", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 12, border: "1px solid #222" }}>
        <span style={{ color: "#555" }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search artists"
          style={{ background: "none", border: "none", outline: "none", color: "white", fontSize: 15, flex: 1 }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { id: "USA",     label: "🇺🇸 USA"     },
          { id: "UK",      label: "🇬🇧 UK"      },
          { id: "JAMAICA", label: "🇯🇲 Jamaica"  },
          { id: "AFRICA",  label: "🇳🇬 Africa"   },
        ].map(r => (
          <button key={r.id} onClick={() => { setRegion(r.id); setCat("All"); }}
            style={{
              borderRadius: 24, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer",
              border: region === r.id ? "2px solid #C026D3" : "1.5px solid #333",
              background: "transparent", color: region === r.id ? "white" : "#888",
            }}>
            {r.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {cats.map(c => {
          const chipColor = c === "Melodic Trap"    ? "#38BDF8"
                          : c === "UK Melodic Trap" ? "#38BDF8"
                          : c === "Detroit"          ? "#F59E0B"
                          : c === "UK Drill"         ? "#4ADE80"
                          : c === "Rap"              ? "#EF4444"
                          : c === "UK Rap"           ? "#EF4444"
                          : c === "UK R&B"           ? "#EC4899"
                          : c === "Grime"            ? "#A78BFA"
                          : "#C026D3";
          const isActive = cat === c;
          return (
            <button key={c} onClick={() => setCat(c)}
              style={{
                borderRadius: 20, padding: "5px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                border: isActive ? "1.5px solid " + chipColor : "1px solid #333",
                background: isActive ? chipColor + "26" : "transparent",
                color: isActive ? chipColor : "#666",
              }}>
              {c}
            </button>
          );
        })}
      </div>
      <div style={{ color: "#555", fontSize: 12, marginBottom: 14 }}>{list.length} artists</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px 10px" }}>
        {list.map((a, i) => (
          <div key={a.id} onClick={() => setSelectedArtist(a)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
            <Av name={a.name} size={88} idx={i} img={a.img} />
            <div style={{ color: "white", fontSize: 11, fontWeight: 600, marginTop: 8, textAlign: "center", lineHeight: 1.3 }}>
              {a.name}
            </div>
            <div style={{
              fontSize: 10, marginTop: 2,
              color: a.cat === "Detroit"                         ? "#F59E0B"
                   : a.cat === "R&B M" || a.cat === "R&B F"    ? "#EC4899"
                   : a.cat === "UK R&B"                         ? "#EC4899"
                   : a.cat === "Grime"                          ? "#A78BFA"
                   : a.cat === "Reggae"                         ? "#22C55E"
                   : a.cat === "Dancehall" || a.cat === "Bashment" ? "#F97316"
                   : a.cat === "Afrobeats"                      ? "#EAB308"
                   : a.cat === "Tribal House"                   ? "#A78BFA"
                   : a.cat === "Melodic Trap"                   ? "#38BDF8"
                   : a.cat === "UK Melodic Trap"                ? "#38BDF8"
                   : a.cat === "UK Drill"                       ? "#4ADE80"
                   : a.cat === "Rap" || a.cat === "UK Rap"      ? "#EF4444" : "#666",
            }}>
              {a.cat}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// ARTIST DETAIL
// =============================================================================
function ArtistDetailScreen({ artist, onBack, onPlay, savedIds, onSave }) {
  const allA = [...ARTISTS_USA, ...ARTISTS_UK, ...ARTISTS_JAMAICA, ...ARTISTS_AFRICA];
  const idx  = allA.findIndex(a => a.id === artist.id);
  const searchName = artist.searchOverride || artist.name;
  const cc = artist.cat === "Detroit"                              ? "#F59E0B"
           : artist.cat === "R&B M" || artist.cat === "R&B F"    ? "#EC4899"
           : artist.cat === "UK R&B"                              ? "#EC4899"
           : artist.cat === "Grime"                               ? "#A78BFA"
           : artist.cat === "Reggae"                              ? "#22C55E"
           : artist.cat === "Dancehall" || artist.cat === "Bashment" ? "#F97316"
           : artist.cat === "Afrobeats"                           ? "#EAB308"
           : artist.cat === "Tribal House"                        ? "#A78BFA"
           : artist.cat === "Melodic Trap"                        ? "#38BDF8"
           : artist.cat === "UK Melodic Trap"                     ? "#38BDF8"
           : artist.cat === "UK Drill"                            ? "#4ADE80"
           : artist.cat === "Rap" || artist.cat === "UK Rap"      ? "#EF4444" : "#888";

  return (
    <div style={{ padding: "0 0 100px" }}>
      <div style={{ padding: "16px 16px 0" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "white", fontSize: 28, cursor: "pointer" }}>
          ←
        </button>
      </div>
      <div style={{
        margin: "8px 16px 16px", background: "#111", borderRadius: 16, padding: "16px",
        display: "flex", alignItems: "center", gap: 16, border: "1px solid rgba(255,255,255,0.07)",
      }}>
        <Av name={artist.name} size={72} idx={idx >= 0 ? idx : 0} img={artist.img} />
        <div>
          <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>
            {artist.flag} {artist.flag === "🇺🇸" ? "USA" : artist.flag === "🇬🇧" ? "UK" : artist.flag === "🇯🇲" ? "Jamaica" : "Africa"} • <span style={{ color: cc }}>{artist.cat}</span>
          </div>
          <div style={{ color: "white", fontSize: 21, fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>
            {artist.name}
          </div>
          <div style={{ color: "#C026D3", fontSize: 13, fontWeight: 600, marginTop: 2 }}>
            Searching: "{searchName} type beat"
          </div>
        </div>
      </div>
      <div style={{ padding: "0 16px" }}>
        <BeatFeed artistName={searchName} savedIds={savedIds} onSave={onSave} onPlay={onPlay} showPagination filterTitle={artist.filterTitle !== false} instrumentalOnly={!!artist.instrumentalOnly} max={10} extraQueries={artist.extraQueries || null} blockedChannels={artist.blockedChannels || null} />
      </div>
    </div>
  );
}



// =============================================================================
// BEAT LEASE CARD
// =============================================================================
function BeatLeaseCard({ beat, user }) {
  const [loading,   setLoading]   = useState(false);
  const [err,       setErr]       = useState("");
  const [previewing,setPreviewing]= useState(false);
  const isFree  = beat.price === "free";

  const handleBuyLease = async () => {
    if (!user) { setErr("Please log in to purchase a lease"); return; }
    setLoading(true);
    setErr("");
    try {
      const result = await apiFetch("/api/producer/beats/" + beat.id + "/buy-lease", { method: "POST" });
      window.location.href = result.checkout_url;
    } catch (e) {
      setErr(e.message);
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      await apiFetch("/api/producer/beats/" + beat.id + "/download", { method: "POST" });
      const a = document.createElement("a");
      a.href     = beat.url;
      a.download = beat.title + ".mp3";
      a.target   = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("Download error:", e);
    }
  };

  return (
    <div style={{ background: "#111", borderRadius: 14, padding: "16px", marginBottom: 14, border: "1px solid rgba(245,158,11,0.2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: "white", fontWeight: 700, fontSize: 15, lineHeight: 1.4, marginBottom: 6 }}>
            {beat.title}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#F59E0B", fontWeight: 700 }}>
              {beat.genre}
            </div>
            <div style={{ background: isFree ? "rgba(34,197,94,0.15)" : "rgba(192,38,211,0.15)", border: "1px solid " + (isFree ? "rgba(34,197,94,0.3)" : "rgba(192,38,211,0.3)"), borderRadius: 20, padding: "2px 10px", fontSize: 11, color: isFree ? "#22C55E" : "#C026D3", fontWeight: 700 }}>
              {isFree ? "FREE" : beat.price}
            </div>
          </div>
        </div>
      </div>

      <div style={{ color: "#666", fontSize: 12, marginBottom: 12 }}>
        By <span style={{ color: "#C026D3", fontWeight: 700 }}>{beat.producer}</span> • {beat.downloads} downloads
      </div>

      {err && <div style={{ color: "#F87171", fontSize: 12, marginBottom: 10 }}>{err}</div>}

      <button
        onClick={() => setPreviewing(!previewing)}
        style={{
          width: "100%", borderRadius: 12, padding: "11px",
          background: previewing ? "rgba(99,91,255,0.2)" : "transparent",
          border: "1.5px solid " + (previewing ? "#635BFF" : "#333"),
          color: previewing ? "#635BFF" : "#888",
          fontWeight: 700, fontSize: 14, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          marginBottom: 10,
        }}
      >
        {previewing ? "⏹ Stop Preview" : "▶ Preview Beat"}
      </button>

      {previewing && beat.url && (
        <audio
          src={beat.url + "#t=60,90"}
          autoPlay
          controls
          controlsList="nodownload"
          style={{ width: "100%", marginBottom: 10, borderRadius: 8, height: 36 }}
          onTimeUpdate={e => {
            const el = e.target;
            // Stop at 30 seconds of playback (1:00 - 1:30)
            if (el.currentTime >= 90) {
              el.pause();
              setPreviewing(false);
            }
          }}
          onEnded={() => setPreviewing(false)}
        />
      )}

      {isFree ? (
        <button onClick={handleDownload} style={{
          width: "100%", borderRadius: 12, padding: "14px",
          background: "linear-gradient(135deg,#22C55E,#16A34A)",
          border: "none", color: "white", fontWeight: 800, fontSize: 15,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          ⬇️ Download Free MP3
        </button>
      ) : (
        <button onClick={handleBuyLease} disabled={loading} style={{
          width: "100%", borderRadius: 12, padding: "14px",
          background: loading ? "#333" : "linear-gradient(135deg,#C026D3,#7C3AED)",
          border: "none", color: "white", fontWeight: 800, fontSize: 15,
          cursor: loading ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          {loading ? "Loading..." : "🎵 Buy Lease - " + beat.price}
        </button>
      )}
    </div>
  );
}

// =============================================================================
// PRODUCER BEATS SCREEN
// =============================================================================
function ProducerBeatsScreen({ onPlay, savedIds, onSave, user }) {
  const [beats,   setBeats]   = useState([]);
  const [leases,  setLeases]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/producer/beats"),
      user ? apiFetch("/api/producer/my-leases").catch(() => []) : Promise.resolve([]),
    ]).then(([b, l]) => {
      setBeats(b);
      setLeases(l);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [user]);



  const header = (
    <div style={{ padding: "20px 0 16px" }}>
      <div style={{ background: "linear-gradient(135deg,#1C1917,rgba(245,158,11,0.2))", borderRadius: 16, padding: "24px 20px", marginBottom: 20, border: "1.5px solid rgba(245,158,11,0.3)" }}>
        <div style={{ color: "#F59E0B", fontSize: 13, fontWeight: 800, marginBottom: 6 }}>🎵 PRODUCER BEATS</div>
        <div style={{ color: "white", fontSize: 26, fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>
          Download MP3s
        </div>
        <div style={{ color: "#aaa", fontSize: 13, marginTop: 4 }}>Beats uploaded by verified producers</div>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ padding: "0 16px 100px" }}>
      {header}
      <BFLoader type="spinner" text="LOADING BEATS...PLEASE BE PATIENT." />
    </div>
  );

  if (error) return (
    <div style={{ padding: "0 16px 100px" }}>
      {header}
      <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 14, padding: 20, textAlign: "center" }}>
        <div style={{ color: "#F87171", fontWeight: 700, fontSize: 15 }}>Could not load beats</div>
        <div style={{ color: "#888", fontSize: 13, marginTop: 8 }}>{error}</div>
      </div>
    </div>
  );

  if (beats.length === 0) return (
    <div style={{ padding: "0 16px 100px" }}>
      {header}
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎛</div>
        <div style={{ color: "white", fontWeight: 800, fontSize: 17, marginBottom: 8 }}>
          No beats have been uploaded yet.
        </div>
        <div style={{ color: "#555", fontSize: 13, lineHeight: 1.7 }}>
          Producer Pro members can upload beats<br />from their Profile tab.
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "0 16px 100px" }}>
      {header}

      {leases.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: "white", fontWeight: 800, fontSize: 16, marginBottom: 12 }}>✅ Your Purchased Leases</div>
          {leases.map(lease => (
            <div key={lease.id} style={{ background: "#111", borderRadius: 14, padding: 16, marginBottom: 12, border: "1px solid rgba(34,197,94,0.3)" }}>
              <div style={{ color: "white", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{lease.beat_title}</div>
              <div style={{ color: "#666", fontSize: 12, marginBottom: 12 }}>By {lease.producer} • {lease.price} • {new Date(lease.purchased_at).toLocaleDateString()}</div>
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = lease.beat_url;
                  a.download = lease.beat_title + ".mp3";
                  a.target = "_blank";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                style={{ width: "100%", borderRadius: 12, padding: "13px", background: "linear-gradient(135deg,#22C55E,#16A34A)", border: "none", color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                ⬇️ Download Your Lease MP3
              </button>
            </div>
          ))}
          <div style={{ height: 1, background: "#1a1a1a", marginBottom: 20 }} />
          <div style={{ color: "#888", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>All Available Beats</div>
        </div>
      )}

      {beats.map(beat => (
        <BeatLeaseCard key={beat.id} beat={beat} user={user} />
      ))}
    </div>
  );
}

// =============================================================================
// TRENDING SCREEN
// =============================================================================
function TrendingScreen({ savedIds, onSave, onPlay }) {
  const [trending,  setTrending]  = useState([]);
  const [rising,    setRising]    = useState([]);
  const [fresh,     setFresh]     = useState([]);
  const [tLoading,  setTLoading]  = useState(true);
  const [rLoading,  setRLoading]  = useState(true);
  const [fLoading,  setFLoading]  = useState(true);

  useEffect(() => {
    apiFetch("/api/youtube/trending")
      .then(d => { setTrending(d.beats || []); setTLoading(false); })
      .catch(() => setTLoading(false));

    apiFetch("/api/producer/beats")
      .then(d => { setRising(d || []); setRLoading(false); })
      .catch(() => {
        apiFetch("/api/youtube/search?artist=type+beat+new&page=2&filter_title=false&max=10")
          .then(d => { setRising(d.beats || []); setRLoading(false); })
          .catch(() => setRLoading(false));
      });

    apiFetch("/api/youtube/search?artist=type+beat+2025&page=1&filter_title=false&max=10")
      .then(d => { setFresh(d.beats || []); setFLoading(false); })
      .catch(() => setFLoading(false));
  }, []);

  // Horizontal carousel card - compact version for side-scroll
  const CarouselCard = ({ beat }) => {
    const isSaved = savedIds.has(beat.videoId);
    return (
      <div onClick={() => onPlay(beat)} className="bf-card" style={{
        flexShrink: 0, width: 168, cursor: "pointer",
        background: "linear-gradient(180deg,#161616,#111)",
        borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)",
        overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}>
        <div style={{ position: "relative", height: 108, overflow: "hidden" }}>
          <img
            src={beat.thumbnail || ("https://img.youtube.com/vi/" + beat.videoId + "/hqdefault.jpg")}
            alt={beat.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,0.6),transparent 60%)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="bf-play" style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "linear-gradient(135deg,#C026D3,#7C3AED)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 0 2px rgba(255,255,255,0.15), 0 4px 16px rgba(192,38,211,0.4)",
            }}>
              <span style={{ fontSize: 14, marginLeft: 3, color: "white" }}>&#9654;</span>
            </div>
          </div>
          <button className="bf-save" onClick={e => { e.stopPropagation(); onSave(beat); }} style={{
            position: "absolute", top: 6, right: 6, width: 28, height: 28,
            borderRadius: "50%", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
            background: isSaved ? "rgba(192,38,211,0.9)" : "rgba(0,0,0,0.6)",
            color: isSaved ? "white" : "rgba(255,255,255,0.6)",
            boxShadow: isSaved ? "0 0 8px rgba(192,38,211,0.5)" : "none",
          }}>
            🔖
          </button>
        </div>
        <div style={{ padding: "10px 12px 12px" }}>
          <div style={{ color: "white", fontSize: 12, fontWeight: 700, lineHeight: 1.4, marginBottom: 4,
            overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {beat.title}
          </div>
          <div style={{ color: "#555", fontSize: 10, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {beat.channel}
          </div>
        </div>
      </div>
    );
  };

  // Producer carousel card (no videoId)
  const ProducerCard = ({ beat }) => (
    <div style={{
      flexShrink: 0, width: 160,
      background: "#111", borderRadius: 14,
      border: "1px solid rgba(34,197,94,0.2)", overflow: "hidden",
    }}>
      <div style={{
        height: 100, background: "linear-gradient(135deg,#052e16,#166534)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
      }}>
        🎛
      </div>
      <div style={{ padding: "10px 10px 12px" }}>
        <div style={{ color: "white", fontSize: 12, fontWeight: 700, lineHeight: 1.4, marginBottom: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {beat.title}
        </div>
        <div style={{ color: "#22C55E", fontSize: 11 }}>{beat.producer}</div>
        <div style={{ marginTop: 8 }}>
          {beat.url && (
            <audio
              src={beat.url + "#t=60,90"}
              controls
              controlsList="nodownload"
              style={{ width: "100%", height: 28, borderRadius: 6 }}
            />
          )}
        </div>
      </div>
    </div>
  );

  const SectionHeader = ({ emoji, title, subtitle, color }) => (
    <div style={{ marginBottom: 14, paddingLeft: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 20 }}>{emoji}</span>
        <div style={{ color: color || "#C026D3", fontWeight: 800, fontSize: 16, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>{title}</div>
      </div>
      {subtitle && <div style={{ color: "#555", fontSize: 12, marginLeft: 28 }}>{subtitle}</div>}
    </div>
  );

  const LoadingRow = () => (
    <div style={{ paddingLeft: 16, marginBottom: 32 }}>
      <BFLoader type="bars" text="Loading beats...please be patient." />
    </div>
  );

  return (
    <div style={{ paddingTop: 20, paddingBottom: 100 }}>
      
      <div style={{ padding: "0 16px", marginBottom: 28 }}>
        <div style={{ background: "linear-gradient(135deg,#1a1a2e,#6B21A8)", borderRadius: 16, padding: "20px" }}>
          <div style={{ color: "#F59E0B", fontSize: 13, fontWeight: 800, marginBottom: 4 }}>DISCOVER</div>
          <div style={{ color: "white", fontSize: 26, fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>Trending & Rising</div>
          <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>Viral beats + emerging producers</div>
        </div>
      </div>

      
      <SectionHeader emoji="🔥" title="TRENDING ON YOUTUBE" subtitle="1M+ views, sorted by most viewed" color="#F59E0B" />
      {tLoading ? <LoadingRow /> : (
        <div className="bf-carousel" style={{ overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", paddingLeft: 16, paddingBottom: 4, marginBottom: 32 }}>
          <div style={{ display: "flex", gap: 12, paddingRight: 16 }}>
            {trending.length === 0
              ? <div style={{ color: "#444", fontSize: 13, padding: "20px 0" }}>No trending beats found.</div>
              : trending.map(beat => <CarouselCard key={beat.videoId} beat={beat} />)
            }
          </div>
        </div>
      )}

      
      <SectionHeader emoji="🚀" title="RISING PRODUCERS" subtitle="New uploads from producers" color="#22C55E" />
      {rLoading ? <LoadingRow /> : (
        <div style={{ overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", paddingLeft: 16, paddingBottom: 4, marginBottom: 32 }}>
          <div style={{ display: "flex", gap: 12, paddingRight: 16 }}>
            {rising.length === 0 ? (
              <div style={{ background: "#111", borderRadius: 14, padding: "20px 24px", border: "1px solid #1e1e1e", color: "#555", fontSize: 13 }}>
                No producer uploads yet
              </div>
            ) : rising.map((beat, i) => (
              beat.videoId
                ? <CarouselCard key={beat.videoId} beat={beat} />
                : <ProducerCard key={beat.id || i} beat={beat} />
            ))}
          </div>
        </div>
      )}

      
      <SectionHeader emoji="🎯" title="FRESH UPLOADS" subtitle="Newest beats uploaded recently" color="#06B6D4" />
      {fLoading ? <LoadingRow /> : (
        <div style={{ overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", paddingLeft: 16, paddingBottom: 4, marginBottom: 32 }}>
          <div style={{ display: "flex", gap: 12, paddingRight: 16 }}>
            {fresh.length === 0
              ? <div style={{ color: "#444", fontSize: 13, padding: "20px 0" }}>No fresh beats found.</div>
              : fresh.map(beat => <CarouselCard key={beat.videoId} beat={beat} />)
            }
          </div>
        </div>
      )}
    </div>
  );
}


// =============================================================================
// SEARCH SCREEN
// =============================================================================
function SearchScreen({ savedIds, onSave, onPlay, initialQuery, onClearInitial }) {
  const [input,   setInput]   = useState("");
  const [active,  setActive]  = useState(null);

  useEffect(() => {
    if (initialQuery) {
      setInput(initialQuery);
      setActive(initialQuery);
      if (onClearInitial) onClearInitial();
    }
  }, [initialQuery]);
  const [recents, setRecents] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bf_recents") || "[]"); } catch { return []; }
  });

  const doSearch = (term) => {
    const q = (term || input).trim();
    if (!q) return;
    setActive(q);
    setInput(q);
    // Save to recents
    setRecents(prev => {
      const next = [q, ...prev.filter(r => r.toLowerCase() !== q.toLowerCase())].slice(0, 6);
      try { localStorage.setItem("bf_recents", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const clearRecents = () => {
    setRecents([]);
    try { localStorage.removeItem("bf_recents"); } catch {}
  };

  const POPULAR = [
    "Drake", "Travis Scott", "Lil Baby", "Central Cee",
    "Afrobeat", "UK Drill", "Melodic Trap", "Polo G",
  ];

  const GENRES = [
    { label: "Rap",      q: "Rap Type Beat" },
    { label: "Drill",    q: "UK Drill Type Beat" },
    { label: "R&B",      q: "R&B Type Beat" },
    { label: "Afrobeat", q: "Afrobeat Type Beat" },
    { label: "Melodic",  q: "Melodic Type Beat" },
    { label: "Trap",     q: "Trap Type Beat" },
    { label: "Dancehall",q: "Dancehall Riddim" },
    { label: "Sad",      q: "Sad Type Beat" },
  ];

  const Chip = ({ label, onPress, color }) => (
    <button onClick={onPress} style={{
      flexShrink: 0, padding: "7px 14px", borderRadius: 20, cursor: "pointer",
      border: "1.5px solid " + (color || "#2a2a2a"),
      background: color ? "rgba(192,38,211,0.1)" : "#111",
      color: color || "#888", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap",
    }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ padding: "20px 0 10px" }}>
        <div style={{ color: "white", fontSize: 28, fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>
          Discover Beats
        </div>
        <div style={{ color: "#888", fontSize: 13, marginBottom: 14 }}>Search any artist, genre or vibe</div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, background: "#1a1a1a", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, border: "1px solid #333" }}>
            <span style={{ color: "#555" }}>🔍</span>
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder="e.g. Drake, Central Cee, UK drill..."
              style={{ background: "none", border: "none", outline: "none", color: "white", fontSize: 15, flex: 1 }}
            />
            {input.length > 0 && (
              <button onClick={() => { setInput(""); setActive(null); }} style={{ background: "none", border: "none", color: "#555", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}>
                &#10005;
              </button>
            )}
          </div>
          <button onClick={() => doSearch()} style={{ background: "#C026D3", border: "none", borderRadius: 12, color: "white", fontWeight: 800, padding: "10px 18px", fontSize: 14, cursor: "pointer" }}>
            Go
          </button>
        </div>

        
        <div style={{ overflowX: "auto", scrollbarWidth: "none", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 8, paddingBottom: 4 }}>
            {GENRES.map(g => (
              <button key={g.label} onClick={() => doSearch(g.q)} style={{
                flexShrink: 0, padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                border: "1.5px solid #2a2a2a", background: "#111",
                color: "#888", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap",
              }}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!active ? (
        <div>
          
          {recents.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ color: "#aaa", fontWeight: 700, fontSize: 13 }}>Recent Searches</div>
                <button onClick={clearRecents} style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer" }}>Clear</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {recents.map(r => (
                  <button key={r} onClick={() => doSearch(r)} style={{
                    padding: "7px 14px", borderRadius: 20, cursor: "pointer",
                    border: "1.5px solid #1e1e1e", background: "#111",
                    color: "#ccc", fontWeight: 600, fontSize: 13,
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <span style={{ fontSize: 11, color: "#555" }}>&#128337;</span>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          
          <div style={{ marginBottom: 28 }}>
            <div style={{ color: "#aaa", fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Popular Searches</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {POPULAR.map(p => (
                <button key={p} onClick={() => doSearch(p)} style={{
                  padding: "7px 14px", borderRadius: 20, cursor: "pointer",
                  border: "1.5px solid rgba(192,38,211,0.3)",
                  background: "rgba(192,38,211,0.08)",
                  color: "#C026D3", fontWeight: 700, fontSize: 13,
                }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          
          <div style={{ textAlign: "center", paddingTop: 20, color: "#444" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🎵</div>
            <div style={{ fontSize: 14, color: "#555", lineHeight: 1.8 }}>
              Search any artist or tap a genre above<br />
              to find type beats instantly
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ color: "white", fontWeight: 700, fontSize: 15 }}>Results for "{active}"</div>
            <button onClick={() => { setActive(null); setInput(""); }} style={{ background: "none", border: "none", color: "#C026D3", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Clear
            </button>
          </div>
          <BeatFeed artistName={active} savedIds={savedIds} onSave={onSave} onPlay={onPlay} />
        </div>
      )}
    </div>
  );
}


// =============================================================================
// SAVED SCREEN
// =============================================================================
function SavedScreen({ savedMap, savedIds, onSave, onPlay, user, onGoProfile }) {
  const list = user ? Object.values(savedMap) : [];

  const [sort,         setSort]         = useState("recent");
  const [activeFolder, setActiveFolder] = useState("all");
  const [folders,      setFolders]      = useState(() => {
    try { return JSON.parse(localStorage.getItem("bf_folders") || "{}"); } catch { return {}; }
  });
  const [addingTo,     setAddingTo]     = useState(null); // videoId being added to folder
  const [newFolder,    setNewFolder]    = useState("");

  const PRESET_FOLDERS = ["Freestyle", "Drill", "R&B", "Favourites", "Fire"];

  const saveFolders = (next) => {
    setFolders(next);
    try { localStorage.setItem("bf_folders", JSON.stringify(next)); } catch {}
  };

  const addToFolder = (videoId, folderName) => {
    const next = { ...folders };
    if (!next[folderName]) next[folderName] = [];
    if (next[folderName].indexOf(videoId) === -1) next[folderName].push(videoId);
    saveFolders(next);
    setAddingTo(null);
  };

  const removeFromFolder = (videoId, folderName) => {
    const next = { ...folders };
    if (next[folderName]) next[folderName] = next[folderName].filter(id => id !== videoId);
    saveFolders(next);
  };

  const createAndAdd = (videoId) => {
    if (!newFolder.trim()) return;
    addToFolder(videoId, newFolder.trim());
    setNewFolder("");
  };

  const allFolderNames = Object.keys(folders).filter(f => folders[f].length > 0);

  const filteredList = activeFolder === "all"
    ? list
    : list.filter(b => folders[activeFolder] && folders[activeFolder].indexOf(b.videoId) > -1);

  const sortedList = [...filteredList].sort((a, b) => {
    if (sort === "recent") return 0; // already in insertion order
    if (sort === "alpha")  return (a.title || "").localeCompare(b.title || "");
    return 0;
  });

  if (!user) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>🔖</div>
      <div style={{ color: "white", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Your Beat Library</div>
      <div style={{ color: "#888", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
        Create an account to save beats,<br />build collections and sync across devices.
      </div>
      <button onClick={onGoProfile} style={{ width: "100%", maxWidth: 300, background: "linear-gradient(135deg,#C026D3,#7C3AED)", border: "none", borderRadius: 32, color: "white", fontWeight: 800, padding: 16, fontSize: 16, cursor: "pointer", marginBottom: 14 }}>
        Create Account
      </button>
      <button onClick={onGoProfile} style={{ background: "none", border: "none", color: "#06B6D4", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
        Log In
      </button>
    </div>
  );

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ padding: "20px 0 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 }}>
          <div style={{ color: "white", fontSize: 28, fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>Beat Library</div>
          <div style={{ color: "#555", fontSize: 13 }}>{list.length} saved</div>
        </div>
        <div style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>Your personal beat collection</div>

        
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[{ id: "recent", label: "Recently Saved" }, { id: "alpha", label: "A - Z" }].map(s => (
            <button key={s.id} onClick={() => setSort(s.id)} style={{
              padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontWeight: 700, fontSize: 12,
              border: sort === s.id ? "1.5px solid #C026D3" : "1.5px solid #2a2a2a",
              background: sort === s.id ? "rgba(192,38,211,0.12)" : "#111",
              color: sort === s.id ? "#C026D3" : "#666",
            }}>
              {s.label}
            </button>
          ))}
        </div>

        
        {(allFolderNames.length > 0 || list.length > 0) && (
          <div style={{ overflowX: "auto", scrollbarWidth: "none", marginBottom: 4 }}>
            <div style={{ display: "flex", gap: 8, paddingBottom: 4 }}>
              <button onClick={() => setActiveFolder("all")} style={{
                flexShrink: 0, padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontWeight: 700, fontSize: 12,
                border: activeFolder === "all" ? "1.5px solid #C026D3" : "1.5px solid #2a2a2a",
                background: activeFolder === "all" ? "rgba(192,38,211,0.12)" : "#111",
                color: activeFolder === "all" ? "#C026D3" : "#666",
              }}>
                All ({list.length})
              </button>
              {allFolderNames.map(f => (
                <button key={f} onClick={() => setActiveFolder(f)} style={{
                  flexShrink: 0, padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontWeight: 700, fontSize: 12,
                  border: activeFolder === f ? "1.5px solid #F59E0B" : "1.5px solid #2a2a2a",
                  background: activeFolder === f ? "rgba(245,158,11,0.12)" : "#111",
                  color: activeFolder === f ? "#F59E0B" : "#666",
                }}>
                  {f} ({folders[f] ? folders[f].length : 0})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      
      {list.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: 60 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔖</div>
          <div style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 8 }}>No beats saved yet</div>
          <div style={{ color: "#555", fontSize: 14, lineHeight: 1.8, marginBottom: 24 }}>
            Tap the 🔖 bookmark icon on any beat<br />to start building your library
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {["Browse Artists", "Check Trending", "Search a Vibe"].map(t => (
              <div key={t} style={{ padding: "8px 16px", borderRadius: 20, border: "1.5px solid #2a2a2a", color: "#555", fontSize: 13 }}>{t}</div>
            ))}
          </div>
        </div>
      ) : filteredList.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <div style={{ color: "#555", fontSize: 14 }}>No beats in this collection yet</div>
          <div style={{ color: "#444", fontSize: 12, marginTop: 6 }}>Tap the folder icon on any beat to add it here</div>
        </div>
      ) : (
        sortedList.map(beat => (
          <div key={beat.videoId} style={{ position: "relative" }}>
            <BeatCard beat={beat} savedIds={savedIds} onSave={onSave} onPlay={onPlay} />

            
            <div style={{ marginTop: -8, marginBottom: 14, display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 4 }}>
              {addingTo === beat.videoId ? (
                <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: "10px 12px", width: "100%", boxSizing: "border-box" }}>
                  <div style={{ color: "#aaa", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>ADD TO COLLECTION</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {PRESET_FOLDERS.filter(f => !folders[f] || folders[f].indexOf(beat.videoId) === -1).map(f => (
                      <button key={f} onClick={() => addToFolder(beat.videoId, f)} style={{
                        padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontWeight: 600, fontSize: 12,
                        border: "1.5px solid #F59E0B", background: "rgba(245,158,11,0.1)", color: "#F59E0B",
                      }}>{f}</button>
                    ))}
                    {allFolderNames.filter(f => PRESET_FOLDERS.indexOf(f) === -1 && (!folders[f] || folders[f].indexOf(beat.videoId) === -1)).map(f => (
                      <button key={f} onClick={() => addToFolder(beat.videoId, f)} style={{
                        padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontWeight: 600, fontSize: 12,
                        border: "1.5px solid #C026D3", background: "rgba(192,38,211,0.1)", color: "#C026D3",
                      }}>{f}</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={newFolder} onChange={e => setNewFolder(e.target.value)}
                      placeholder="New collection name..."
                      onKeyDown={e => e.key === "Enter" && createAndAdd(beat.videoId)}
                      style={{ flex: 1, background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: "7px 10px", color: "white", fontSize: 13, outline: "none" }}
                    />
                    <button onClick={() => createAndAdd(beat.videoId)} style={{ background: "#C026D3", border: "none", borderRadius: 8, color: "white", fontWeight: 700, fontSize: 12, padding: "7px 12px", cursor: "pointer" }}>
                      Create
                    </button>
                    <button onClick={() => setAddingTo(null)} style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#555", fontSize: 12, padding: "7px 10px", cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button onClick={() => setAddingTo(beat.videoId)} style={{
                    padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontWeight: 600, fontSize: 11,
                    border: "1.5px solid #2a2a2a", background: "transparent", color: "#555",
                  }}>
                    + Collection
                  </button>
                  {allFolderNames.filter(f => folders[f] && folders[f].indexOf(beat.videoId) > -1).map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
                      <span style={{ color: "#F59E0B", fontSize: 11, fontWeight: 700 }}>{f}</span>
                      <button onClick={() => removeFromFolder(beat.videoId, f)} style={{ background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer", padding: 0, lineHeight: 1 }}>&#10005;</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}


// =============================================================================
// EXCLUSIVE MEMBERS SCREEN
// =============================================================================
function ExclusiveScreen({ user, onGoProfile, onPlay, savedIds, onSave }) {
  const isPro = user?.isPro || user?.isArtistPro;
  const [tab, setTab] = useState("beats");

  // Non-member locked screen
  if (!isPro) return (
    <div style={{ paddingBottom: 100, overflowY: "auto" }}>
      
      <div style={{ background: "linear-gradient(160deg,#1a0a00,#2d1500,#1C1917)", padding: "32px 20px 24px", textAlign: "center", borderBottom: "1px solid rgba(245,158,11,0.15)" }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🔒</div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 34, letterSpacing: 3, color: "#F59E0B", marginBottom: 6 }}>MEMBERS ONLY</div>
        <div style={{ color: "#aaa", fontSize: 14, lineHeight: 1.6, maxWidth: 300, margin: "0 auto" }}>
          Join the BeatFinder community and unlock the full producer ecosystem
        </div>
      </div>

      
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ color: "#F59E0B", fontWeight: 800, fontSize: 12, letterSpacing: 1, marginBottom: 14, textAlign: "center" }}>WHAT YOU UNLOCK</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { icon: "🎵", title: "Exclusive Beats", desc: "Access member-only beats unavailable anywhere else" },
            { icon: "⬇️", title: "MP3 Downloads", desc: "Download and buy leases directly from producers" },
            { icon: "✍️", title: "Lyric Studio", desc: "Access exclusive member beats with AI assistance" },
            { icon: "🎛", title: "Producer Tools", desc: "Upload beats, sell leases and get paid instantly" },
          ].map(v => (
            <div key={v.title} style={{ background: "#111", borderRadius: 14, padding: 14, border: "1px solid rgba(245,158,11,0.15)" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{v.icon}</div>
              <div style={{ color: "white", fontWeight: 800, fontSize: 13, marginBottom: 4 }}>{v.title}</div>
              <div style={{ color: "#555", fontSize: 11, lineHeight: 1.5 }}>{v.desc}</div>
            </div>
          ))}
        </div>

        
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: "#888", fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 12, textAlign: "center" }}>CHOOSE YOUR PLAN</div>
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { label: "🎤 Artist Pro", price: "£4.99/mo", color: "#F59E0B", perks: ["Write lyrics to beats", "Save unlimited beats", "Exclusive member beats", "Download MP3s", "Purchase leases", "Bookmark unlimited beats"] },
              { label: "🎛 Producer Pro", price: "£8.99/mo", color: "#C026D3", perks: ["Everything in Artist Pro", "Upload & sell beats", "Sell MP3 leases", "Download stats", "Verified badge", "Featured in rotation"] },
            ].map(p => (
              <div key={p.label} style={{ flex: 1, background: "#111", border: "1.5px solid " + p.color, borderRadius: 14, padding: "14px 12px", textAlign: "left" }}>
                <div style={{ color: "white", fontWeight: 800, fontSize: 13, marginBottom: 2 }}>{p.label}</div>
                <div style={{ color: p.color, fontWeight: 800, fontSize: 16, marginBottom: 12 }}>{p.price}</div>
                {p.perks.map(perk => (
                  <div key={perk} style={{ color: "#bbb", fontSize: 11, marginBottom: 6, lineHeight: 1.3, display: "flex", alignItems: "flex-start", gap: 5 }}>
                    <span style={{ color: p.color, flexShrink: 0, fontWeight: 900 }}>+</span>
                    <span>{perk}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        
        <button onClick={onGoProfile} style={{ width: "100%", background: "linear-gradient(135deg,#F59E0B,#C026D3)", border: "none", borderRadius: 32, color: "white", fontWeight: 800, padding: "16px", fontSize: 16, cursor: "pointer", marginBottom: 20 }}>
          Unlock Access
        </button>

        
        <div style={{ background: "#111", borderRadius: 14, padding: "14px 16px", border: "1px solid #1e1e1e", marginBottom: 20 }}>
          <div style={{ color: "#555", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>WHY PRODUCERS LOVE IT</div>
          {[
            { icon: "💳", text: "Get paid instantly via Stripe" },
            { icon: "🎵", text: "Your beats reach real artists daily" },
            { icon: "📊", text: "Track downloads and sales" },
          ].map(r => (
            <div key={r.text} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, color: "#888", fontSize: 13 }}>
              <span>{r.icon}</span>
              <span>{r.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Logged-in pro member view
  return (
    <div style={{ padding: "0 16px 100px" }}>
      
      <div style={{ padding: "20px 0 14px" }}>
        <div style={{ background: "linear-gradient(135deg,#1C1917,rgba(245,158,11,0.12))", borderRadius: 16, padding: "20px", marginBottom: 18, border: "1.5px solid rgba(245,158,11,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: "#F59E0B", fontWeight: 800, fontSize: 12, marginBottom: 4, letterSpacing: 1 }}>🔒 MEMBERS ONLY</div>
              <div style={{ color: "white", fontSize: 24, fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>Members Area</div>
              <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>Exclusive beats and downloadable MP3s</div>
            </div>
            <div style={{ background: user?.isPro ? "rgba(192,38,211,0.2)" : "rgba(245,158,11,0.2)", border: "1px solid " + (user?.isPro ? "#C026D3" : "#F59E0B"), borderRadius: 20, padding: "6px 12px", fontSize: 11, color: user?.isPro ? "#C026D3" : "#F59E0B", fontWeight: 800 }}>
              {user?.isPro ? "PRODUCER PRO" : "ARTIST PRO"}
            </div>
          </div>
        </div>

        
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button onClick={() => setTab("beats")} style={{ flex: 1, padding: "12px", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", border: tab === "beats" ? "2px solid #F59E0B" : "1.5px solid #333", background: tab === "beats" ? "rgba(245,158,11,0.15)" : "transparent", color: tab === "beats" ? "#F59E0B" : "#666" }}>
            🔥 Exclusive Beats
          </button>
          <button onClick={() => setTab("mp3s")} style={{ flex: 1, padding: "12px", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", border: tab === "mp3s" ? "2px solid #C026D3" : "1.5px solid #333", background: tab === "mp3s" ? "rgba(192,38,211,0.15)" : "transparent", color: tab === "mp3s" ? "#C026D3" : "#666" }}>
            ⬇️ MP3 Downloads
          </button>
        </div>
      </div>

      {tab === "beats" && (
        <div>
          
          <div style={{ background: "linear-gradient(135deg,#1a0040,#2d0060)", borderRadius: 16, padding: "16px", marginBottom: 20, border: "1px solid rgba(192,38,211,0.3)" }}>
            <div style={{ color: "#C026D3", fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>FEATURED PRODUCER</div>
            <div style={{ color: "white", fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Top producers upload here daily</div>
            <div style={{ color: "#888", fontSize: 12 }}>Exclusive content only available to members</div>
          </div>

          <div style={{ color: "#F59E0B", fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 12 }}>EXCLUSIVE DROPS</div>
          <BeatFeed artistName="exclusive premium" savedIds={savedIds} onSave={onSave} onPlay={onPlay} filterTitle={false} />
        </div>
      )}

      {tab === "mp3s" && (
        <ProducerBeatsScreen onPlay={onPlay} savedIds={savedIds} onSave={onSave} user={user} />
      )}
    </div>
  );
}


// =============================================================================
// LYRIC CARD - shows saved lyric with beat, opens full lyric view
// =============================================================================
function LyricCard({ lyric, lyricIndex, onDelete, onEditLyric }) {
  return (
    <div style={{ background: "#111", borderRadius: 14, marginBottom: 12, border: "1px solid #1e1e1e", overflow: "hidden" }}>
      <div
        onClick={() => onEditLyric(lyric, lyricIndex)}
        style={{ padding: "16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: "linear-gradient(135deg,#6B21A8,#C026D3)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
        }}>
          ✍️
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ color: "white", fontWeight: 700, fontSize: 15, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {lyric.title}
          </div>
          {lyric.beatTitle && (
            <div style={{ color: "#C026D3", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              🎵 {lyric.beatTitle}
            </div>
          )}
          <div style={{ color: "#555", fontSize: 11, marginTop: 3 }}>
            {lyric.updatedAt
              ? "Edited " + new Date(lyric.updatedAt).toLocaleDateString()
              : new Date(lyric.savedAt).toLocaleDateString()}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ color: "#444", fontSize: 18 }}>></span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ background: "none", border: "none", color: "#555", fontSize: 16, cursor: "pointer", padding: 4 }}>
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}


// =============================================================================
// PUBLIC PROFILE SCREEN
// =============================================================================
function PublicProfileScreen({ username, onBack, onPlay, savedIds, onSave }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    apiFetch("/api/auth/profile/" + encodeURIComponent(username))
      .then(d => { setProfile(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [username]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "80px 24px", color: "#555" }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>👤</div>
      <div style={{ fontSize: 13 }}>Loading profile...</div>
    </div>
  );

  if (error || !profile) return (
    <div style={{ textAlign: "center", padding: "80px 24px", color: "#555" }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>😕</div>
      <div style={{ fontSize: 15, color: "#888" }}>Profile not found</div>
      <button onClick={onBack} style={{ marginTop: 20, background: "#1a1a1a", border: "1px solid #333", borderRadius: 12, color: "white", padding: "10px 24px", cursor: "pointer" }}>Go Back</button>
    </div>
  );

  const planLabel = profile.plan === "producer" ? "⭐ Producer Pro" : profile.plan === "artist" ? "🎤 Artist Pro" : null;
  const planColor = profile.plan === "producer" ? "#C026D3" : "#F59E0B";

  const handleDownload = async (beat) => {
    try {
      await apiFetch("/api/producer/beats/" + beat.id + "/download", { method: "POST" });
      const a = document.createElement("a");
      a.href = beat.url; a.download = beat.title + ".mp3"; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ padding: "0 0 100px" }}>
      <div style={{ padding: "16px 16px 0" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "white", fontSize: 28, cursor: "pointer" }}>←</button>
      </div>

      <div style={{ margin: "8px 16px 20px", background: "#111", borderRadius: 16, padding: 20, border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#6B21A8,#C026D3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 12px" }}>
          👤
        </div>
        <div style={{ color: "white", fontSize: 22, fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>
          {profile.username}
        </div>
        <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>{profile.name}</div>
        {planLabel && (
          <div style={{ marginTop: 8, display: "inline-block", background: "rgba(192,38,211,0.15)", border: "1px solid " + planColor, borderRadius: 20, padding: "4px 14px", color: planColor, fontWeight: 800, fontSize: 12 }}>
            {planLabel}
          </div>
        )}
      </div>

      {profile.beats && profile.beats.length > 0 && (
        <div style={{ padding: "0 16px" }}>
          <div style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 14 }}>🎵 Beats by {profile.username}</div>
          {profile.beats.map(beat => (
            <div key={beat.id} style={{ background: "#111", borderRadius: 14, padding: 16, marginBottom: 12, border: "1px solid rgba(245,158,11,0.2)" }}>
              <div style={{ color: "white", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{beat.title}</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <div style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#F59E0B", fontWeight: 700 }}>{beat.genre}</div>
                <div style={{ background: beat.price === "free" ? "rgba(34,197,94,0.15)" : "rgba(192,38,211,0.15)", border: "1px solid " + (beat.price === "free" ? "rgba(34,197,94,0.3)" : "rgba(192,38,211,0.3)"), borderRadius: 20, padding: "2px 10px", fontSize: 11, color: beat.price === "free" ? "#22C55E" : "#C026D3", fontWeight: 700 }}>{beat.price === "free" ? "FREE" : beat.price}</div>
              </div>
              <div style={{ color: "#555", fontSize: 12, marginBottom: 12 }}>{beat.downloads} downloads</div>
              <button onClick={() => handleDownload(beat)} style={{ width: "100%", borderRadius: 12, padding: "13px", background: "linear-gradient(135deg,#F59E0B,#EF4444)", border: "none", color: "white", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                ⬇️ Download MP3
              </button>
            </div>
          ))}
        </div>
      )}

      {(!profile.beats || profile.beats.length === 0) && (
        <div style={{ textAlign: "center", padding: "40px 24px", color: "#555" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎛</div>
          <div style={{ fontSize: 14 }}>No beats uploaded yet</div>
        </div>
      )}
    </div>
  );
}


// =============================================================================
// STRIPE CONNECT SECTION - for Producer Pro profile
// =============================================================================
function StripeConnectSection({ user }) {
  const [status,  setStatus]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    apiFetch("/api/producer/stripe-status")
      .then(d => { setStatus(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const result = await apiFetch("/api/producer/connect-stripe", { method: "POST" });
      window.location.href = result.url;
    } catch (e) {
      setConnecting(false);
      setStatus({ connected: false, error: e.message });
    }
  };

  return (
    <div style={{ background: "#111", borderRadius: 14, padding: 16, border: "1px solid #222", marginBottom: 4 }}>
      <div style={{ color: "white", fontWeight: 800, fontSize: 16, marginBottom: 6 }}>💳 Stripe Payouts</div>
      <div style={{ color: "#666", fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
        Connect your Stripe account to receive payments when artists buy your beat leases.
      </div>
      {loading ? (
        <div style={{ color: "#555", fontSize: 13 }}>Checking status...</div>
      ) : status?.connected ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 20, padding: "6px 14px", color: "#22C55E", fontWeight: 700, fontSize: 13 }}>
            ✓ Stripe Connected
          </div>
          <div style={{ color: "#555", fontSize: 12 }}>Payouts {status.payouts_enabled ? "enabled" : "pending"}</div>
        </div>
      ) : (
        <>
          {status?.error && (
            <div style={{ color: "#F87171", fontSize: 12, marginBottom: 10, background: "rgba(220,38,38,0.1)", borderRadius: 8, padding: "8px 12px" }}>
              {status.error}
            </div>
          )}
          <button
            onClick={handleConnect}
            disabled={connecting}
            style={{
              width: "100%", background: connecting ? "#333" : "linear-gradient(135deg,#635BFF,#8B5CF6)",
              border: "none", borderRadius: 12, color: "white",
              fontWeight: 800, fontSize: 15, padding: "13px", cursor: connecting ? "not-allowed" : "pointer",
            }}
          >
            {connecting ? "Redirecting to Stripe..." : "Connect Stripe Account"}
          </button>
        </>
      )}
    </div>
  );
}


// =============================================================================
// MY UPLOADS - Producer Pro tab to manage uploaded beats
// =============================================================================
function MyUploadsSection({ user }) {
  const [beats,    setBeats]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editId,   setEditId]   = useState(null);
  const [editTitle,setEditTitle]= useState("");
  const [editGenre,setEditGenre]= useState("");
  const [editPrice,setEditPrice]= useState("");
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState("");

  const load = () => {
    setLoading(true);
    apiFetch("/api/producer/my-beats")
      .then(d => { setBeats(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (beat) => {
    setEditId(beat.id);
    setEditTitle(beat.title);
    setEditGenre(beat.genre);
    setEditPrice(beat.price);
    setMsg("");
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      await apiFetch("/api/producer/beats/" + editId + "/update", {
        method: "POST",
        body: JSON.stringify({ title: editTitle, genre: editGenre, price: editPrice }),
      });
      setMsg("Updated!");
      setEditId(null);
      load();
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (beatId, title) => {
    if (!window.confirm("Delete " + title + "? This cannot be undone.")) return;
    try {
      await apiFetch("/api/producer/beats/" + beatId, { method: "DELETE" });
      setBeats(prev => prev.filter(b => b.id !== beatId));
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  if (loading) return <BFLoader type="spinner" text="Loading your beats..." />;

  return (
    <div>
      <div style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 6 }}>🎛 My Uploaded Beats</div>
      <div style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>Edit or delete your uploaded beats.</div>

      {msg && <div style={{ color: msg.startsWith("Error") ? "#F87171" : "#22C55E", fontSize: 13, marginBottom: 12, textAlign: "center", fontWeight: 600 }}>{msg}</div>}

      {beats.length === 0 && (
        <div style={{ background: "#111", borderRadius: 14, padding: 20, textAlign: "center", border: "1px solid #222" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎵</div>
          <div style={{ color: "#555", fontSize: 14 }}>No beats uploaded yet.</div>
        </div>
      )}

      {beats.map(beat => (
        <div key={beat.id} style={{ background: "#111", borderRadius: 14, padding: 16, marginBottom: 12, border: "1px solid #1e1e1e" }}>
          {editId === beat.id ? (
            <div>
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Beat title"
                style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
              />
              <input
                value={editGenre}
                onChange={e => setEditGenre(e.target.value)}
                placeholder="Genre"
                style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
              />
              <input
                value={editPrice}
                onChange={e => setEditPrice(e.target.value)}
                placeholder="Price e.g. free or £50"
                style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: "#C026D3", border: "none", borderRadius: 10, color: "white", fontWeight: 800, padding: "11px", fontSize: 14, cursor: "pointer" }}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button onClick={() => setEditId(null)} style={{ flex: 1, background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, color: "#aaa", fontWeight: 700, padding: "11px", fontSize: 14, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ color: "white", fontWeight: 700, fontSize: 15, flex: 1 }}>{beat.title}</div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => handleEdit(beat)} style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#aaa", fontSize: 13, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(beat.id, beat.title)} style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, color: "#F87171", fontSize: 13, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>
                    Delete
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#F59E0B", fontWeight: 700 }}>{beat.genre}</div>
                <div style={{ background: "rgba(192,38,211,0.15)", border: "1px solid rgba(192,38,211,0.3)", borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#C026D3", fontWeight: 700 }}>{beat.price}</div>
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#555" }}>{beat.downloads} downloads</div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}




// =============================================================================
// ROOT AUTH SCREEN - shown at app root when no user logged in
// =============================================================================
function RootAuthScreen({ onLogin }) {
  const [mode,        setMode]        = useState("landing");
  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [pw,          setPw]          = useState("");
  const [rememberMe,  setRememberMe]  = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authErr,     setAuthErr]     = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bf_saved_email");
      if (saved) { setEmail(saved); setRememberMe(true); }
    } catch {}
  }, []);

  const inp = {
    width: "100%", background: "#1a1a1a", border: "1px solid #333",
    borderRadius: 12, padding: "14px 16px", color: "white",
    fontSize: 16, outline: "none", marginBottom: 16, boxSizing: "border-box",
  };

  if (mode === "forgot") return <ForgotPasswordScreen onBack={() => setMode("login")} />;

  if (mode === "landing") return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", padding: 32, textAlign: "center" }}>
      <img src="https://i.ibb.co/9myqbFB7/2-BB02064-13-F6-476-C-89-FF-B1-EDDAE0-C709.png" alt="BeatFinder" style={{ width: "100%", maxWidth: 300, marginBottom: 32 }} />
      <div style={{ color: "#aaa", fontSize: 14, marginBottom: 36, lineHeight: 1.7 }}>
        Create an account to save beats,<br />or subscribe as an artist or producer.
      </div>
      <button onClick={() => setMode("signup")}
        style={{ width: "100%", background: "#C026D3", border: "none", borderRadius: 32, color: "white", fontWeight: 800, padding: 16, fontSize: 16, cursor: "pointer", marginBottom: 16 }}>
        Create Account
      </button>
      <button onClick={() => setMode("login")}
        style={{ background: "none", border: "none", color: "#06B6D4", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
        I already have an account
      </button>
    </div>
  );

  return (
    <div style={{ padding: "40px 24px 100px" }}>
      <button onClick={() => setMode("landing")} style={{ background: "none", border: "none", color: "white", fontSize: 28, cursor: "pointer", marginBottom: 20 }}>
        &#8592;
      </button>
      <div style={{ color: "white", fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, letterSpacing: 2, marginBottom: 24 }}>
        {mode === "signup" ? "CREATE ACCOUNT" : "WELCOME BACK"}
      </div>
      {mode === "signup" && <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inp} />}
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" type="email" style={inp} />
      <input value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" type="password" style={{ ...inp, marginBottom: 16 }} />
      {mode === "login" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} id="rm" />
          <label htmlFor="rm" style={{ color: "#888", fontSize: 13 }}>Remember my login</label>
        </div>
      )}
      <button
        disabled={authLoading}
        onClick={async () => {
          setAuthErr("");
          if (mode === "login" && !pw.trim()) { setAuthErr("Please enter your password"); return; }
          setAuthLoading(true);
          try {
            const u = mode === "signup"
              ? await AuthAPI.register(name || email.split("@")[0], email, pw)
              : await AuthAPI.login(email, pw);
            if (rememberMe) {
              try { localStorage.setItem("bf_saved_email", email); } catch {}
            } else {
              try { localStorage.removeItem("bf_saved_email"); } catch {}
            }
            onLogin(u);
          } catch (e) {
            setAuthErr(e.message);
          } finally {
            setAuthLoading(false);
          }
        }}
        style={{ width: "100%", background: authLoading ? "#555" : "#C026D3", border: "none", borderRadius: 32, color: "white", fontWeight: 800, padding: 16, fontSize: 16, cursor: "pointer", opacity: authLoading ? 0.6 : 1 }}>
        {authLoading ? "Please wait..." : mode === "signup" ? "Create Account" : "Log In"}
      </button>
      {authErr && <div style={{ color: "#F87171", fontSize: 13, textAlign: "center", marginTop: 12 }}>{authErr}</div>}
      <div style={{ textAlign: "center", marginTop: 20 }}>
        <span style={{ color: "#888", fontSize: 14 }}>{mode === "signup" ? "Already have an account? " : "No account? "}</span>
        <button onClick={() => { setAuthErr(""); setMode(mode === "signup" ? "login" : "signup"); }}
          style={{ background: "none", border: "none", color: "#06B6D4", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {mode === "signup" ? "Log In" : "Sign Up"}
        </button>
      </div>
      {mode === "login" && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button onClick={e => { e.preventDefault(); e.stopPropagation(); setMode("forgot"); }}
            style={{ background: "none", border: "none", color: "#666", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
            Forgot your password?
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// RESET PASSWORD SCREEN - shown when user visits app with ?reset_token=
// =============================================================================
function ResetPasswordScreen({ token, onDone }) {
  const [newPw,    setNewPw]    = useState("");
  const [confirmPw,setConfirmPw]= useState("");
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState("");
  const [done,     setDone]     = useState(false);

  const inp = {
    width: "100%", background: "#1a1a1a", border: "1px solid #333",
    borderRadius: 12, padding: "14px 16px", color: "white",
    fontSize: 16, outline: "none", marginBottom: 14, boxSizing: "border-box",
  };

  const handleReset = async () => {
    if (!newPw || !confirmPw) return;
    if (newPw !== confirmPw) { setMsg("Passwords do not match"); return; }
    if (newPw.length < 6)    { setMsg("Password must be at least 6 characters"); return; }
    setLoading(true);
    setMsg("");
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, new_password: newPw }),
      });
      setDone(true);
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "60px 24px 100px", fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ color: "white", fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, letterSpacing: 2, marginBottom: 8 }}>
        RESET PASSWORD
      </div>
      <div style={{ color: "#888", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
        Enter your new password below.
      </div>

      {!done ? (
        <>
          <input value={newPw}     onChange={e => setNewPw(e.target.value)}     type="password" placeholder="New password"     style={inp} />
          <input value={confirmPw} onChange={e => setConfirmPw(e.target.value)} type="password" placeholder="Confirm password" style={inp} />
          {msg && <div style={{ color: msg.startsWith("Error") ? "#F87171" : "#22C55E", fontSize: 13, marginBottom: 12 }}>{msg}</div>}
          <button onClick={handleReset} disabled={loading} style={{ width: "100%", background: loading ? "#333" : "#C026D3", border: "none", borderRadius: 32, color: "white", fontWeight: 800, padding: 16, fontSize: 16, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Resetting..." : "Set New Password"}
          </button>
        </>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ color: "#22C55E", fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Password Reset!</div>
          <div style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>You can now log in with your new password.</div>
          <button onClick={onDone} style={{ background: "#C026D3", border: "none", borderRadius: 32, color: "white", fontWeight: 800, padding: "14px 40px", fontSize: 16, cursor: "pointer" }}>
            Go to Log In
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// FORGOT PASSWORD SCREEN
// =============================================================================
function ForgotPasswordScreen({ onBack }) {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState("");
  const [sent,    setSent]    = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setMsg("");
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
      setMsg("Reset link sent! Check your email inbox.");
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    width: "100%", background: "#1a1a1a", border: "1px solid #333",
    borderRadius: 12, padding: "14px 16px", color: "white",
    fontSize: 16, outline: "none", marginBottom: 16, boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "40px 24px 100px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "white", fontSize: 28, cursor: "pointer", marginBottom: 20 }}>←</button>
      <div style={{ color: "white", fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, letterSpacing: 2, marginBottom: 8 }}>
        FORGOT PASSWORD
      </div>
      <div style={{ color: "#888", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
        Enter the email address you used to sign up and we'll send you a link to reset your password.
      </div>

      {!sent ? (
        <>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Your email address"
            type="email"
            style={inp}
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: "100%", background: loading ? "#333" : "#C026D3", border: "none", borderRadius: 32, color: "white", fontWeight: 800, padding: 16, fontSize: 16, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </>
      ) : (
        <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 14, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
          <div style={{ color: "#22C55E", fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Email Sent!</div>
          <div style={{ color: "#888", fontSize: 14, lineHeight: 1.7 }}>
            Check your inbox at <span style={{ color: "white", fontWeight: 600 }}>{email}</span> for a password reset link. It expires in 1 hour.
          </div>
        </div>
      )}

      {msg && !sent && (
        <div style={{ color: msg.startsWith("Error") ? "#F87171" : "#22C55E", fontSize: 13, textAlign: "center", marginTop: 12 }}>{msg}</div>
      )}

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#06B6D4", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Back to Log In
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// PROFILE SCREEN
// =============================================================================
function SectionBack({ label, onBack }) {
  return (
    <button onClick={onBack}
      style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: "#C026D3", fontWeight: 700, fontSize: 14, cursor: "pointer", padding: "0 0 16px" }}>
      &#8592; {label}
    </button>
  );
}

function ProfileScreen({ user, setUser, onLogout, savedLyrics, setSavedLyrics, onPlayBeat, onEditLyric }) {
  const [mode,        setMode]        = useState("landing");
  const [email,       setEmail]       = useState(() => {
    try { return localStorage.getItem("bf_remember") === "1" ? (localStorage.getItem("bf_saved_email") || "") : ""; } catch { return ""; }
  });
  const [pw,          setPw]          = useState("");
  const [name,        setName]        = useState("");
  const [ytLink,        setYtLink]        = useState("");
  const [uploads,       setUploads]       = useState([]);
  const [plan,          setPlan]          = useState(null);
  const [usernameInput,    setUsernameInput]    = useState(user?.username || "");
  const [usernameMsg,      setUsernameMsg]      = useState("");
  const [uploadGenre,      setUploadGenre]      = useState("");
  const [uploadPrice,      setUploadPrice]      = useState("");
  const [uploadFile,       setUploadFile]       = useState(null);
  const [uploadLoading,    setUploadLoading]    = useState(false);
  const [uploadMsg,        setUploadMsg]        = useState("");
  const [settingsOpen,     setSettingsOpen]     = useState(false);
  const [newUsername,      setNewUsername]      = useState("");
  const [currentPw,        setCurrentPw]        = useState("");
  const [newPw,            setNewPw]            = useState("");
  const [confirmPw,        setConfirmPw]        = useState("");
  const [settingsMsg,      setSettingsMsg]      = useState("");
  const [authErr,     setAuthErr]     = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [rememberMe,  setRememberMe]  = useState(() => {
    try { return localStorage.getItem("bf_remember") === "1"; } catch { return false; }
  });

  const inp = {
    width: "100%", background: "#1a1a1a", border: "1px solid #333",
    borderRadius: 12, padding: "14px 16px", color: "white", fontSize: 15,
    outline: "none", marginBottom: 12, boxSizing: "border-box",
  };

  const PLANS = [
    {
      id: "artist", label: "🎤 Artist Pro", price: "4.99",
      perks: ["Access Exclusive Members area","Bookmark unlimited beats","Artist verified badge","Personalised recommendations"],
    },
    {
      id: "producer", label: "🎛 Producer Pro", price: "8.99",
      perks: ["Everything in Artist Pro","Upload beats to Home featured","Featured in rotation","Producer verified badge","Analytics"],
    },
  ];

  // Add activeSection state for dashboard navigation
  const [activeSection, setActiveSection] = useState(null);
  const [producerStats, setProducerStats] = useState(null);

  useEffect(() => {
    if (user?.isPro) {
      Promise.all([
        apiFetch("/api/producer/my-beats").catch(() => []),
        apiFetch("/api/producer/my-leases").catch(() => []),
        apiFetch("/api/producer/stripe-status").catch(() => ({})),
      ]).then(([beats, leases, stripe]) => {
        const totalDownloads = beats.reduce((s, b) => s + (b.downloads || 0), 0);
        const totalRevenue   = leases.reduce((s, l) => {
          const p = parseFloat((l.price || "0").replace(/[^0-9.]/g, ""));
          return s + (isNaN(p) ? 0 : p);
        }, 0);
        const topBeat = beats.reduce((best, b) => (!best || b.downloads > best.downloads) ? b : best, null);
        setProducerStats({
          totalBeats: beats.length,
          totalDownloads,
          totalRevenue: totalRevenue.toFixed(2),
          topBeat: topBeat ? topBeat.title : "No beats yet",
          stripeConnected: stripe.connected || false,
          recentSales: leases.slice(0, 5),
        });
      });
    }
  }, [user]);

  if (!user) {
    if (mode === "forgot") return <ForgotPasswordScreen onBack={() => setMode("login")} />;
    if (mode === "landing") return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "75vh", padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>👤</div>
        <div style={{ color: "white", fontSize: 24, fontWeight: 800, marginBottom: 8 }}>My Profile</div>
        <div style={{ color: "#888", fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>Log in to access your saved beats, lyrics, and pro features.</div>
        <button onClick={() => setMode("signup")} style={{ width: "100%", maxWidth: 320, background: "#C026D3", border: "none", borderRadius: 32, color: "white", fontWeight: 800, padding: 16, fontSize: 16, cursor: "pointer", marginBottom: 14 }}>
          Create Account
        </button>
        <button onClick={() => setMode("login")} style={{ background: "none", border: "none", color: "#06B6D4", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          I already have an account
        </button>
      </div>
    );
    return (
      <div style={{ padding: "40px 24px 100px" }}>
        <button onClick={() => setMode("landing")} style={{ background: "none", border: "none", color: "white", fontSize: 28, cursor: "pointer", marginBottom: 20 }}>&#8592;</button>
        <div style={{ color: "white", fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, letterSpacing: 2, marginBottom: 24 }}>
          {mode === "signup" ? "CREATE ACCOUNT" : "WELCOME BACK"}
        </div>
        {mode === "signup" && <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inp} />}
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" type="email" style={inp} />
        <input value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" type="password" style={{ ...inp, marginBottom: 16 }} />
        {mode === "login" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} id="rm" />
            <label htmlFor="rm" style={{ color: "#888", fontSize: 13 }}>Remember my login</label>
          </div>
        )}
        <button disabled={authLoading} onClick={async () => {
          setAuthErr("");
          if (mode === "login" && !pw.trim()) { setAuthErr("Please enter your password"); return; }
          setAuthLoading(true);
          try {
            const u = mode === "signup"
              ? await AuthAPI.register(name || email.split("@")[0], email, pw)
              : await AuthAPI.login(email, pw);
            if (rememberMe) { try { localStorage.setItem("bf_saved_email", email); localStorage.setItem("bf_remember", "1"); } catch {} }
            else { try { localStorage.removeItem("bf_saved_email"); localStorage.removeItem("bf_remember"); } catch {} }
            setUser(u);
          } catch (e) { setAuthErr(e.message); }
          finally { setAuthLoading(false); }
        }} style={{ width: "100%", background: authLoading ? "#555" : "#C026D3", border: "none", borderRadius: 32, color: "white", fontWeight: 800, padding: 16, fontSize: 16, cursor: "pointer" }}>
          {authLoading ? "Please wait..." : mode === "signup" ? "Create Account" : "Log In"}
        </button>
        {authErr && <div style={{ color: "#F87171", fontSize: 13, textAlign: "center", marginTop: 12 }}>{authErr}</div>}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <span style={{ color: "#888", fontSize: 14 }}>{mode === "signup" ? "Already have an account? " : "No account? "}</span>
          <button onClick={() => { setAuthErr(""); setMode(mode === "signup" ? "login" : "signup"); }}
            style={{ background: "none", border: "none", color: "#06B6D4", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {mode === "signup" ? "Log In" : "Sign Up"}
          </button>
        </div>
        {mode === "login" && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); setMode("forgot"); }}
              style={{ background: "none", border: "none", color: "#666", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
              Forgot your password?
            </button>
          </div>
        )}
      </div>
    );
  }

  if (user) {
    const goSection = (s) => setActiveSection(activeSection === s ? null : s);

    return (
    <div style={{ padding: "0 16px 100px" }}>
      
      <div style={{ padding: "20px 0 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ color: "white", fontSize: 28, fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>My Profile</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative" }}>
          <button onClick={() => setSettingsOpen(!settingsOpen)}
            style={{ background: "#1a1a1a", border: "1px solid #333", color: "#aaa", borderRadius: 10, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>
            ⚙️ Settings
          </button>
          <button onClick={() => { onLogout(); }}
            style={{ background: "#1a1a1a", border: "1px solid #333", color: "#aaa", borderRadius: 10, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>
            Log out
          </button>
          {settingsOpen && (
            <div style={{ position: "absolute", top: 44, right: 0, zIndex: 100, background: "#111", border: "1px solid #333", borderRadius: 14, padding: 20, width: 300, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ color: "white", fontWeight: 800, fontSize: 16 }}>⚙️ Settings</div>
                <button onClick={() => setSettingsOpen(false)} style={{ background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>USERNAME</div>
              <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder={user.username || "Set your username"}
                style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
              <button onClick={async () => {
                if (!newUsername.trim()) return;
                try {
                  await apiFetch("/api/auth/set-username", { method: "POST", body: JSON.stringify({ username: newUsername.trim() }) });
                  setUser({ ...user, username: newUsername.trim() }); setNewUsername(""); setSettingsMsg("Username updated!"); setTimeout(() => setSettingsMsg(""), 2500);
                } catch (e) { setSettingsMsg("Error: " + e.message); }
              }} style={{ width: "100%", background: "#C026D3", border: "none", borderRadius: 10, color: "white", fontWeight: 800, padding: "10px", fontSize: 14, cursor: "pointer", marginBottom: 16 }}>
                {user.username ? "Update Username" : "Set Username"}
              </button>
              <div style={{ height: 1, background: "#1e1e1e", marginBottom: 16 }} />
              <div style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>CHANGE PASSWORD</div>
              <input value={currentPw} onChange={e => setCurrentPw(e.target.value)} type="password" placeholder="Current password"
                style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
              <input value={newPw} onChange={e => setNewPw(e.target.value)} type="password" placeholder="New password"
                style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
              <input value={confirmPw} onChange={e => setConfirmPw(e.target.value)} type="password" placeholder="Confirm new password"
                style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
              <button onClick={async () => {
                if (!currentPw || !newPw) return;
                if (newPw !== confirmPw) { setSettingsMsg("Passwords do not match"); return; }
                if (newPw.length < 6) { setSettingsMsg("Password must be at least 6 characters"); return; }
                try {
                  await apiFetch("/api/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: currentPw, new_password: newPw }) });
                  setCurrentPw(""); setNewPw(""); setConfirmPw(""); setSettingsMsg("Password changed!"); setTimeout(() => setSettingsMsg(""), 2500);
                } catch (e) { setSettingsMsg("Error: " + e.message); }
              }} style={{ width: "100%", background: "#1a1a1a", border: "1.5px solid #333", borderRadius: 10, color: "#aaa", fontWeight: 800, padding: "10px", fontSize: 14, cursor: "pointer", marginBottom: 8 }}>
                Change Password
              </button>
              {settingsMsg && <div style={{ color: settingsMsg.startsWith("Error") ? "#F87171" : "#22C55E", fontSize: 13, textAlign: "center", fontWeight: 600 }}>{settingsMsg}</div>}
            </div>
          )}
        </div>
      </div>

      
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: "white", fontWeight: 800, fontSize: 18 }}>{user.name}</div>
        <div style={{ color: "#666", fontSize: 13 }}>{user.email}</div>
        {user.username && <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>@{user.username}</div>}
        <div style={{ marginTop: 8 }}>
          {user.isPro && <span style={{ display: "inline-block", background: "rgba(192,38,211,0.2)", border: "1px solid #C026D3", borderRadius: 20, padding: "4px 14px", color: "#C026D3", fontWeight: 800, fontSize: 12, marginRight: 6 }}>⭐ Producer Pro</span>}
          {user.isArtistPro && !user.isPro && <span style={{ display: "inline-block", background: "rgba(245,158,11,0.2)", border: "1px solid #F59E0B", borderRadius: 20, padding: "4px 14px", color: "#F59E0B", fontWeight: 800, fontSize: 12 }}>🎤 Artist Pro</span>}
        </div>
      </div>

      
      {!activeSection && (
        <div>
          
          {user.isArtistPro && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>🎤 ARTIST TOOLS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  
                  { id: "lyrics",  icon: "✍️", label: "My Lyrics",    desc: savedLyrics.length + " saved",    color: "#C026D3" },
                  { id: "members", icon: "🎵", label: "Members Area", desc: "Exclusive beats",                 color: "#F59E0B" },
                ].map(item => (
                  <button key={item.id} onClick={() => goSection(item.id)}
                    style={{ background: "#111", borderRadius: 14, padding: "16px 12px", border: "1.5px solid #1e1e1e", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
                    <div style={{ color: "white", fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                    <div style={{ color: item.color, fontSize: 12, marginTop: 3 }}>{item.desc}</div>
                  </button>
                ))}
              </div>

              
              {savedLyrics.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "#444", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>RECENT LYRICS</div>
                  {savedLyrics.slice(0, 2).map((lyric, i) => (
                    <div key={i} onClick={() => onEditLyric(lyric, i)}
                      style={{ background: "#111", borderRadius: 10, padding: "10px 14px", marginBottom: 6, border: "1px solid #1e1e1e", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ color: "white", fontWeight: 600, fontSize: 13 }}>{lyric.title || "Untitled"}</div>
                        <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>{lyric.beatTitle}</div>
                      </div>
                      <span style={{ color: "#C026D3", fontSize: 16 }}>&#9654;</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          
          {user.isPro && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>🎹 PRODUCER TOOLS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { id: "upload",  icon: "⬆️", label: "Upload Beat",  desc: "Add new beat",       color: "#C026D3" },
                  { id: "manage",  icon: "🎛", label: "My Uploads",   desc: uploads.length + " beats", color: "#F59E0B" },
                  { id: "stripe",  icon: "💳", label: "Stripe Payouts", desc: producerStats?.stripeConnected ? "Connected" : "Not connected", color: "#22C55E" },
                  { id: "stats",   icon: "📊", label: "Analytics",    desc: producerStats ? producerStats.totalDownloads + " downloads" : "Loading...", color: "#818CF8" },
                ].map(item => (
                  <button key={item.id} onClick={() => goSection(item.id)}
                    style={{ background: "#111", borderRadius: 14, padding: "16px 12px", border: "1.5px solid #1e1e1e", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
                    <div style={{ color: "white", fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                    <div style={{ color: item.color, fontSize: 12, marginTop: 3 }}>{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          
          {!user.isArtistPro && (
            <div style={{ background: "linear-gradient(135deg,#1a0a00,#1a1000)", borderRadius: 16, padding: 16, marginBottom: 20, border: "1px solid rgba(245,158,11,0.2)" }}>
              <div style={{ color: "#F59E0B", fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Upgrade to Pro</div>
              <div style={{ color: "#888", fontSize: 13, marginBottom: 14 }}>Unlock lyrics, exclusive beats, MP3 downloads and more from £4.99/mo</div>
              <button onClick={() => goSection("upgrade")} style={{ background: "linear-gradient(135deg,#F59E0B,#C026D3)", border: "none", borderRadius: 20, color: "white", fontWeight: 800, fontSize: 14, padding: "10px 24px", cursor: "pointer" }}>
                View Plans
              </button>
            </div>
          )}

          
        </div>
      )}

      

      

      {activeSection === "lyrics" && (
        <div>
          <SectionBack onBack={() => setActiveSection(null)} label="Back to Dashboard" />
          <div style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 6 }}>My Lyrics</div>
          <div style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>Tap any lyric to continue writing</div>
          {savedLyrics.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#555" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✍️</div>
              <div>No saved lyrics yet. Open a beat and tap Write Lyrics.</div>
            </div>
          ) : savedLyrics.map(function(lyric, i) {
            return (
              <div key={i} style={{ background: "#111", borderRadius: 14, padding: 16, marginBottom: 12, border: "1px solid #1e1e1e" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "white", fontWeight: 700, fontSize: 15 }}>{lyric.title || "Untitled"}</div>
                    <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>{lyric.beatTitle}</div>
                  </div>
                  <button onClick={function(){ 
                    var lyricId = lyric.id;
                    setSavedLyrics(function(prev){ 
                      var next = prev.filter(function(_, j){ return j !== i; }); 
                      try { localStorage.setItem("bf_lyrics", JSON.stringify(next)); } catch(e){} 
                      return next; 
                    });
                    if (user) {
                      apiFetch("/api/lyrics/" + lyricId, { method: "DELETE" }).catch(() => {});
                    }
                  }}
                    style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, color: "#F87171", fontSize: 12, padding: "4px 10px", cursor: "pointer" }}>
                    Delete
                  </button>
                </div>
                <button onClick={function(){ onEditLyric(lyric, i); }}
                  style={{ width: "100%", background: "rgba(192,38,211,0.1)", border: "1.5px solid #C026D3", borderRadius: 10, color: "#C026D3", fontWeight: 700, fontSize: 14, padding: "10px", cursor: "pointer", marginTop: 6 }}>
                  ✍️ Continue Writing
                </button>
              </div>
            );
          })}
        </div>
      )}

      {activeSection === "upload" && (
        <div>
          <SectionBack onBack={() => setActiveSection(null)} label="Back to Dashboard" />
          <div style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Upload Your Beat</div>
          <div style={{ color: "#666", fontSize: 13, marginBottom: 14 }}>Upload MP3 files to sell leases to artists.</div>
          <div style={{ background: "#111", borderRadius: 14, padding: 16, border: "1px solid #222" }}>
            <input value={ytLink} onChange={e => setYtLink(e.target.value)} placeholder="Beat title e.g. Dark Trap Beat" style={inp} />
            <input value={uploadGenre || ""} onChange={e => setUploadGenre(e.target.value)} placeholder="Genre e.g. Trap, R&B, Afrobeats" style={inp} />
            <input value={uploadPrice || ""} onChange={e => setUploadPrice(e.target.value)} placeholder="Price e.g. free or £9.99" style={inp} />
            <input type="file" accept=".mp3,audio/mpeg" onChange={e => setUploadFile(e.target.files[0])}
              style={{ width: "100%", marginBottom: 12, color: "#aaa", fontSize: 14 }} />
            <button disabled={uploadLoading} onClick={async () => {
              if (!ytLink.trim() || !uploadFile) { setUploadMsg("Please fill all fields and select an MP3"); return; }
              setUploadLoading(true); setUploadMsg("");
              try {
                const fd = new FormData();
                fd.append("title", ytLink.trim()); fd.append("genre", uploadGenre || ""); fd.append("price", uploadPrice || "free"); fd.append("file", uploadFile);
                const token = typeof getToken === "function" ? getToken() : (localStorage.getItem("bf_token") || "");
                const res = await fetch(API_BASE + "/api/producer/upload", { method: "POST", headers: { "Authorization": "Bearer " + token }, body: fd });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || "Upload failed");
                setUploads(prev => [data.beat, ...prev]); setUploadMsg("Beat uploaded!"); setYtLink(""); setUploadGenre(""); setUploadPrice(""); setUploadFile(null);
              } catch (e) { setUploadMsg("Error: " + e.message); }
              setUploadLoading(false);
            }} style={{ width: "100%", background: uploadLoading ? "#333" : "#C026D3", border: "none", borderRadius: 12, color: "white", fontWeight: 800, fontSize: 15, padding: "14px", cursor: uploadLoading ? "not-allowed" : "pointer" }}>
              {uploadLoading ? "Uploading..." : "Upload Beat"}
            </button>
            {uploadMsg && <div style={{ marginTop: 10, color: uploadMsg.startsWith("Error") ? "#F87171" : "#22C55E", fontSize: 13, textAlign: "center" }}>{uploadMsg}</div>}
          </div>
        </div>
      )}

      {activeSection === "manage" && (
        <div>
          <SectionBack onBack={() => setActiveSection(null)} label="Back to Dashboard" />
          <MyUploadsSection user={user} />
        </div>
      )}

      {activeSection === "stripe" && (
        <div>
          <SectionBack onBack={() => setActiveSection(null)} label="Back to Dashboard" />
          <div style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 16 }}>Stripe Payouts</div>
          <StripeConnectSection />
        </div>
      )}

      {activeSection === "stats" && (
        <div>
          <SectionBack onBack={() => setActiveSection(null)} label="Back to Dashboard" />
          <div style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 16 }}>Analytics</div>
          {!producerStats ? (
            <BFLoader type="spinner" text="Loading your stats..." />
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "Beats Uploaded",   value: producerStats.totalBeats,     color: "#C026D3" },
                  { label: "Total Downloads",   value: producerStats.totalDownloads, color: "#F59E0B" },
                  { label: "Total Revenue",     value: "£" + producerStats.totalRevenue, color: "#22C55E" },
                  { label: "Stripe",            value: producerStats.stripeConnected ? "Connected" : "Not connected", color: "#818CF8" },
                ].map(stat => (
                  <div key={stat.label} style={{ background: "#111", borderRadius: 14, padding: 16, border: "1px solid #1e1e1e" }}>
                    <div style={{ color: stat.color, fontWeight: 800, fontSize: 20 }}>{stat.value}</div>
                    <div style={{ color: "#555", fontSize: 12, marginTop: 4 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "#111", borderRadius: 14, padding: 16, border: "1px solid #1e1e1e", marginBottom: 16 }}>
                <div style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>TOP PERFORMING BEAT</div>
                <div style={{ color: "white", fontWeight: 700, fontSize: 15 }}>{producerStats.topBeat}</div>
              </div>
              {producerStats.recentSales.length > 0 && (
                <div style={{ background: "#111", borderRadius: 14, padding: 16, border: "1px solid #1e1e1e" }}>
                  <div style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>RECENT SALES</div>
                  {producerStats.recentSales.map((sale, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, marginBottom: 10, borderBottom: i < producerStats.recentSales.length - 1 ? "1px solid #1e1e1e" : "none" }}>
                      <div>
                        <div style={{ color: "white", fontSize: 13, fontWeight: 600 }}>{sale.beat_title}</div>
                        <div style={{ color: "#555", fontSize: 11 }}>{new Date(sale.purchased_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ color: "#22C55E", fontWeight: 800, fontSize: 14 }}>{sale.price}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeSection === "upgrade" && (
        <div>
          <SectionBack onBack={() => setActiveSection(null)} label="Back to Dashboard" />
          <div style={{ color: "white", fontWeight: 800, fontSize: 20, marginBottom: 16 }}>Choose Your Plan</div>
          {PLANS.map(plan => (
            <div key={plan.id} style={{ background: "#111", borderRadius: 16, padding: 20, marginBottom: 14, border: "1.5px solid #333" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ color: "white", fontWeight: 800, fontSize: 18 }}>{plan.label}</div>
                <div style={{ color: "#C026D3", fontWeight: 800, fontSize: 18 }}>£{plan.price}/mo</div>
              </div>
              {plan.perks.map(perk => (
                <div key={perk} style={{ color: "#aaa", fontSize: 14, marginBottom: 6, display: "flex", gap: 8 }}>
                  <span style={{ color: "#C026D3" }}>+</span>{perk}
                </div>
              ))}
              <button onClick={async () => {
                try {
                  const priceId = plan.id === "artist" ? "price_1TQDoFFHyNSCxas89UpDKiro" : "price_1TQDpBFHyNSCxas8cktbqw1n";
                  const r = await apiFetch("/api/stripe/create-checkout", { method: "POST", body: JSON.stringify({ price_id: priceId }) });
                  window.location.href = r.checkout_url;
                } catch (e) { alert("Error: " + e.message); }
              }} style={{ width: "100%", background: "linear-gradient(135deg,#C026D3,#7C3AED)", border: "none", borderRadius: 12, color: "white", fontWeight: 800, fontSize: 15, padding: "14px", cursor: "pointer", marginTop: 12 }}>
                Subscribe - £{plan.price}/mo
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  }
}


// =============================================================================
// BOTTOM NAV
// =============================================================================
// =============================================================================
// STUDIO SCREEN
// =============================================================================
function StudioScreen({ user }) {
  const [beatUrl,          setBeatUrl]         = useState(null);
  const [beatName,         setBeatName]        = useState("");
  const [isPlaying,        setIsPlaying]       = useState(false);
  const [isRecording,      setIsRecording]     = useState(false);
  const [recordingTrackId, setRecordingTrackId]= useState(null);
  const [tracks,           setTracks]          = useState([]);
  const [beatTime,         setBeatTime]        = useState(0);
  const [beatDuration,     setBeatDuration]    = useState(0);
  const [error,            setError]           = useState("");
  const [countIn,          setCountIn]         = useState(0);
  const [contextMenu,      setContextMenu]     = useState(null);
  const [editingTrack,     setEditingTrack]    = useState(null);
  const [analyserData,     setAnalyserData]    = useState(new Uint8Array(64).fill(10));
  const [recBars,          setRecBars]         = useState(new Uint8Array(32).fill(5));
  const [projectName,      setProjectName]     = useState("New Project");
  const [editingProject,   setEditingProject]  = useState(false);
  const [savedProjects,    setSavedProjects]   = useState([]);
  const [showProjects,     setShowProjects]    = useState(false);
  const [saveStatus,       setSaveStatus]      = useState("");
  const [loopEnabled,      setLoopEnabled]     = useState(false);
  const [loopIn,           setLoopIn]          = useState(0);
  const [loopOut,          setLoopOut]         = useState(0);
  const [settingLoop,      setSettingLoop]     = useState(null);
  const [metronomeOn,      setMetronomeOn]     = useState(false);
  const [bpm,              setBpm]             = useState(120);
  const [trimming,         setTrimming]        = useState(null);
  const [showSettings,     setShowSettings]    = useState(false);
  const [showAddMenu,      setShowAddMenu]     = useState(false);
  const [timeSigNum,       setTimeSigNum]      = useState(4);
  const [timeSigDen,       setTimeSigDen]      = useState(4);
  const [projectKey,       setProjectKey]      = useState("C major");
  const [inputDevice,      setInputDevice]     = useState("default");
  const [audioDevices,     setAudioDevices]    = useState([]);
  const [tapTimes,         setTapTimes]        = useState([]);
  const lastTapRef         = useRef(0);

  const audioRef      = useRef(null);
  const mediaRecRef   = useRef(null);
  const chunksRef     = useRef([]);
  const recTimerRef   = useRef(null);
  const animFrameRef  = useRef(null);
  const analyserRef   = useRef(null);
  const audioCtxRef   = useRef(null);
  const takeAudiosRef = useRef({});
  const countTimerRef = useRef(null);
  const loopCheckRef  = useRef(null);
  const metroRef      = useRef(null);
  const metroCtxRef   = useRef(null);
  const beatRef       = useRef(0);

  var hasContent = beatUrl || tracks.length > 0;

  useEffect(function() {
    try { setSavedProjects(JSON.parse(localStorage.getItem("bf_studio_projects") || "[]")); } catch(e) {}
  }, []);

  useEffect(function() {
    if (!loopEnabled || !audioRef.current) return;
    var check = setInterval(function() {
      if (audioRef.current && audioRef.current.currentTime >= loopOut && loopOut > loopIn)
        audioRef.current.currentTime = loopIn;
    }, 100);
    loopCheckRef.current = check;
    return function() { clearInterval(check); };
  }, [loopEnabled, loopIn, loopOut]);

  useEffect(function() {
    if (!metronomeOn) { if (metroRef.current) clearInterval(metroRef.current); return; }
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    metroCtxRef.current = ctx;
    var tick = function() {
      var osc = ctx.createOscillator(); var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = beatRef.current % 4 === 0 ? 1000 : 800;
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
      beatRef.current++;
    };
    tick();
    metroRef.current = setInterval(tick, Math.round(60000 / bpm));
    return function() { clearInterval(metroRef.current); try { ctx.close(); } catch(e) {} };
  }, [metronomeOn, bpm]);

  useEffect(function() {
    if (!isPlaying || !analyserRef.current) return;
    var go = function() {
      var d = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(d);
      setAnalyserData(new Uint8Array(d.slice(0, 64)));
      animFrameRef.current = requestAnimationFrame(go);
    };
    animFrameRef.current = requestAnimationFrame(go);
    return function() { cancelAnimationFrame(animFrameRef.current); };
  }, [isPlaying]);

  useEffect(function() {
    if (!isRecording) return;
    var id = setInterval(function() {
      setRecBars(function() {
        var a = new Uint8Array(32);
        for (var i = 0; i < 32; i++) a[i] = Math.floor(Math.random() * 80 + 15);
        return a;
      });
    }, 80);
    return function() { clearInterval(id); };
  }, [isRecording]);

  var fmt = function(s) {
    s = Math.floor(s || 0); var m = Math.floor(s / 60); var sec = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (sec < 10 ? "0" : "") + sec;
  };

  var makeTrack = function(n) {
    return { id: Date.now() + Math.random(), name: "Vocal " + n, muted: false, solo: false, volume: 1, takes: [],
      color: ["#22C55E","#3B82F6","#F59E0B","#EC4899","#8B5CF6","#06B6D4"][n % 6] };
  };

  var setupAudioContext = function() {
    try {
      if (audioCtxRef.current) audioCtxRef.current.close();
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var analyser = ctx.createAnalyser(); analyser.fftSize = 128;
      var source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser); analyser.connect(ctx.destination);
      audioCtxRef.current = ctx; analyserRef.current = analyser;
    } catch(e) {}
  };

  const [bpmDetecting,   setBpmDetecting]  = useState(false);
  const [detectedBpm,    setDetectedBpm]   = useState(null);
  const [zoom,           setZoom]          = useState(1);    // 1 = default, 2 = 2x zoom etc
  const [timelineScroll, setTimelineScroll]= useState(0);
  const timelineRulerRef = useRef(null);
  const tracksScrollRef  = useRef(null);

  var detectBpm = async function() {
    if (!beatUrl) return;
    setBpmDetecting(true);
    setDetectedBpm(null);
    try {
      var response = await fetch(beatUrl);
      var arrayBuffer = await response.arrayBuffer();
      var offlineCtx = new OfflineAudioContext(1, 44100 * 30, 44100);
      var audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

      // Analyse first 30 seconds for BPM using peak detection
      var data = audioBuffer.getChannelData(0);
      var sampleRate = audioBuffer.sampleRate;

      // Low-pass filter simulation — take every 512th sample
      var step = 512;
      var filtered = [];
      for (var i = 0; i < data.length; i += step) {
        var sum = 0;
        for (var j = i; j < Math.min(i + step, data.length); j++) {
          sum += Math.abs(data[j]);
        }
        filtered.push(sum / step);
      }

      // Find peaks
      var threshold = 0;
      for (var k = 0; k < filtered.length; k++) threshold += filtered[k];
      threshold = (threshold / filtered.length) * 1.5;

      var peaks = [];
      var minDist = Math.floor(sampleRate * 0.3 / step); // min 0.3s between peaks
      var lastPeak = -minDist;
      for (var p = 0; p < filtered.length; p++) {
        if (filtered[p] > threshold && p - lastPeak > minDist) {
          peaks.push(p);
          lastPeak = p;
        }
      }

      if (peaks.length < 4) { setBpmDetecting(false); setDetectedBpm(-1); return; }

      // Calculate intervals between peaks
      var intervals = [];
      for (var n = 1; n < Math.min(peaks.length, 20); n++) {
        intervals.push((peaks[n] - peaks[n-1]) * step / sampleRate);
      }
      var avgInterval = intervals.reduce(function(a,b){ return a+b; }, 0) / intervals.length;
      var rawBpm = Math.round(60 / avgInterval);

      // Normalise to 60-200 range
      while (rawBpm < 60)  rawBpm *= 2;
      while (rawBpm > 200) rawBpm /= 2;
      rawBpm = Math.round(rawBpm);

      setDetectedBpm(rawBpm);
      setBpm(rawBpm);
      setBpmDetecting(false);
    } catch(e) {
      console.warn("BPM detection failed:", e);
      setBpmDetecting(false);
      setDetectedBpm(-1);
    }
  };

  // Auto-scroll ruler to keep playhead in view
  useEffect(function() {
    if (!isPlaying || !timelineRulerRef.current) return;
    var ruler = timelineRulerRef.current;
    var secondsPerBar  = (60 / bpm) * 4;
    var totalBars      = beatDuration > 0 ? Math.ceil(beatDuration / secondsPerBar) + 2 : 16;
    var rulerWidth     = Math.max(totalBars * 80 * zoom, 800);
    var pxPerSecond    = beatDuration > 0 ? rulerWidth / beatDuration : rulerWidth / (totalBars * secondsPerBar);
    var playheadPx     = beatTime * pxPerSecond;
    var visibleWidth   = ruler.clientWidth;
    var scrollLeft     = ruler.scrollLeft;
    if (playheadPx > scrollLeft + visibleWidth - 60) {
      ruler.scrollLeft = playheadPx - visibleWidth / 2;
      if (tracksScrollRef.current) tracksScrollRef.current.scrollLeft = ruler.scrollLeft;
    }
  }, [beatTime, isPlaying]);

  // Tap tempo
  var handleTapTempo = function() {
    var now = Date.now();
    var gap = now - lastTapRef.current;
    lastTapRef.current = now;
    if (gap > 3000) {
      setTapTimes([now]);
      return;
    }
    setTapTimes(function(prev) {
      var next = [...prev, now].slice(-8);
      if (next.length >= 2) {
        var intervals = [];
        for (var i = 1; i < next.length; i++) intervals.push(next[i] - next[i-1]);
        var avg = intervals.reduce(function(a,b){return a+b;},0) / intervals.length;
        var detected = Math.round(60000 / avg);
        if (detected >= 40 && detected <= 220) setBpm(detected);
      }
      return next;
    });
  };

  // Enumerate audio input devices
  var loadAudioDevices = function() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then(function(devices) {
      var inputs = devices.filter(function(d){ return d.kind === "audioinput"; });
      setAudioDevices(inputs);
    }).catch(function(){});
  };

  var saveProject = function() {
    try {
      var project = { id: Date.now(), name: projectName, beatName, savedAt: new Date().toISOString(),
        beatDuration, loopIn, loopOut, loopEnabled, bpm,
        tracks: tracks.map(function(t){ return { ...t, takes: t.takes.map(function(tk){ return { ...tk, url: null, blob: null }; }) }; }) };
      var list = JSON.parse(localStorage.getItem("bf_studio_projects") || "[]");
      var idx = list.findIndex(function(p){ return p.name === projectName; });
      if (idx >= 0) list[idx] = project; else list.unshift(project);
      list = list.slice(0, 10);
      localStorage.setItem("bf_studio_projects", JSON.stringify(list));
      setSavedProjects(list);
      setSaveStatus("Saved!"); setTimeout(function(){ setSaveStatus(""); }, 2000);
    } catch(e) {}
  };

  var loadProject = function(p) {
    setProjectName(p.name); setBeatName(p.beatName||"");
    setLoopIn(p.loopIn||0); setLoopOut(p.loopOut||0); setLoopEnabled(p.loopEnabled||false); setBpm(p.bpm||120);
    setTracks(p.tracks.map(function(t){ return { ...t, takes: t.takes.map(function(tk){ return { ...tk, url: null, blob: null }; }) }; }));
    setShowProjects(false);
    setSaveStatus("Loaded — re-upload beat to restore audio"); setTimeout(function(){ setSaveStatus(""); }, 4000);
  };

  var deleteProject = function(id) {
    var u = savedProjects.filter(function(p){ return p.id !== id; });
    setSavedProjects(u); localStorage.setItem("bf_studio_projects", JSON.stringify(u));
  };

  var handleBeatUpload = function(e) {
    var file = e.target.files[0]; if (!file) return;
    var ext = file.name.split(".").pop().toLowerCase();
    if (!file.type.startsWith("audio/") && ["mp3","wav","m4a","aac","ogg"].indexOf(ext) < 0) { setError("Please upload an audio file"); return; }
    setError("");
    var url = URL.createObjectURL(file);
    setBeatUrl(url);
    var name = file.name.replace(/\.[^.]+$/, "");
    setBeatName(name); setProjectName(name);
    setIsPlaying(false);
    if (tracks.length === 0) setTracks([makeTrack(1)]);
    setShowAddMenu(false);
    setTimeout(function() {
      if (audioRef.current) { audioRef.current.src = url; audioRef.current.load(); try { setupAudioContext(); } catch(e) {} }
    }, 100);
  };

  var addVocalTrack = function() {
    setTracks(function(p){ return [...p, makeTrack(p.length + 1)]; });
    setShowAddMenu(false);
  };

  var resumeCtx = function() { if (audioCtxRef.current && audioCtxRef.current.state==="suspended") audioCtxRef.current.resume(); };

  var togglePlay = function() {
    if (!audioRef.current || !beatUrl) return;
    resumeCtx();
    if (isPlaying) {
      audioRef.current.pause();
      Object.values(takeAudiosRef.current).forEach(function(a){ a.pause(); });
      setIsPlaying(false);
    } else {
      if (loopEnabled && loopOut > loopIn) audioRef.current.currentTime = loopIn;
      audioRef.current.play(); setIsPlaying(true);
    }
  };

  var rewind = function() {
    if (audioRef.current) audioRef.current.currentTime = loopEnabled ? loopIn : 0;
    Object.values(takeAudiosRef.current).forEach(function(a){ a.pause(); a.currentTime=0; });
    setIsPlaying(false);
  };

  var startCountIn = function(trackId) {
    setError(""); setCountIn(4); var n = 4;
    countTimerRef.current = setInterval(function() {
      n--; setCountIn(n);
      if (n <= 0) { clearInterval(countTimerRef.current); setCountIn(0); doRecord(trackId); }
    }, 800);
  };

  var doRecord = async function(trackId) {
    try {
      // Show a brief explanation before the iOS permission dialog appears
      setError("");

      // Check if permissions API is available
      if (navigator.permissions) {
        try {
          var micPerm = await navigator.permissions.query({ name: "microphone" });
          if (micPerm.state === "denied") {
            setError("Microphone blocked. Go to iPhone Settings → Safari → Microphone and set to Allow.");
            setCountIn(0);
            return;
          }
        } catch(e) {}
      }

      var audioConstraints = { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 };
      if (inputDevice && inputDevice !== "default") audioConstraints.deviceId = { exact: inputDevice };
      var stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      chunksRef.current = [];
      var mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      var mr = new MediaRecorder(stream, { mimeType });
      mr.ondataavailable = function(e) { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = function() {
        var blob = new Blob(chunksRef.current, { type: mimeType });
        var url  = URL.createObjectURL(blob);
        var elapsed = recTimerRef._elapsed || 0;
        var beatOffset = audioRef.current ? Math.max(0, audioRef.current.currentTime - elapsed) : 0;
        setTracks(function(prev) {
          return prev.map(function(t) {
            if (t.id !== trackId) return t;
            return { ...t, takes: [{ id: Date.now(), url, blob, mimeType, duration: elapsed,
              beatOffset, trimStart: 0, trimEnd: elapsed,
              label: "Take " + (t.takes.length+1), date: new Date().toLocaleTimeString(),
              bars: Array.from({length:48},function(_,i){return 15+Math.sin(i*0.5)*12+Math.cos(i*0.3)*8;})
            }, ...t.takes] };
          });
        });
        stream.getTracks().forEach(function(t){ t.stop(); });
        clearInterval(recTimerRef.current); recTimerRef._elapsed = 0;
        setIsRecording(false); setRecordingTrackId(null);
      };
      mediaRecRef.current = mr;
      var sec = 0; recTimerRef._elapsed = 0;
      recTimerRef.current = setInterval(function(){ sec++; recTimerRef._elapsed = sec; }, 1000);
      mr.start(100); setIsRecording(true); setRecordingTrackId(trackId);
      if (audioRef.current && beatUrl && !isPlaying) {
        resumeCtx();
        if (loopEnabled && loopOut > loopIn) audioRef.current.currentTime = loopIn;
        audioRef.current.play(); setIsPlaying(true);
      }
    } catch(e) {
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setError("Mic access denied. Go to iPhone Settings → Safari → Microphone → Allow.");
      } else if (e.name === "NotFoundError") {
        setError("No microphone found on this device.");
      } else {
        setError("Could not access microphone. Check Settings → Safari → Microphone.");
      }
      setCountIn(0);
    }
  };

  var stopRecording = function() { if (mediaRecRef.current && isRecording) mediaRecRef.current.stop(); };

  var playTake = function(take, track) {
    if (!take.url) return;
    if (takeAudiosRef.current[take.id]) { takeAudiosRef.current[take.id].pause(); delete takeAudiosRef.current[take.id]; return; }
    if (audioRef.current && beatUrl) { audioRef.current.currentTime = take.beatOffset; resumeCtx(); audioRef.current.play(); setIsPlaying(true); }
    var ta = new Audio(take.url); ta.currentTime = take.trimStart || 0; ta.volume = track.muted ? 0 : track.volume; ta.play();
    takeAudiosRef.current[take.id] = ta;
    ta.onended = function() { delete takeAudiosRef.current[take.id]; };
  };

  var applyTrim = function(trackId, takeId, side, pct) {
    setTracks(function(prev) {
      return prev.map(function(t) {
        if (t.id !== trackId) return t;
        return { ...t, takes: t.takes.map(function(tk) {
          if (tk.id !== takeId) return tk;
          var dur = tk.duration;
          if (side==="start") return { ...tk, trimStart: Math.max(0, Math.min(pct*dur, tk.trimEnd-0.5)) };
          if (side==="end")   return { ...tk, trimEnd:   Math.min(dur, Math.max(pct*dur, tk.trimStart+0.5)) };
          return tk;
        }) };
      });
    });
  };

  var handleTakeLongPress = function(e, trackId, take) {
    e.preventDefault();
    var rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({ trackId, take, x: rect.left, y: rect.bottom });
  };

  var deleteTake    = function(tId,tkId){ setTracks(function(p){ return p.map(function(t){ return t.id!==tId?t:{...t,takes:t.takes.filter(function(tk){return tk.id!==tkId;})}; }); }); setContextMenu(null); };
  var duplicateTake = function(tId,take){ setTracks(function(p){ return p.map(function(t){ return t.id!==tId?t:{...t,takes:[{...take,id:Date.now(),label:take.label+" (copy)"},...t.takes]}; }); }); setContextMenu(null); };
  var downloadTake  = function(take,name){ if(!take.url)return; var ext=take.mimeType&&take.mimeType.includes("mp4")?"m4a":"webm"; var a=document.createElement("a"); a.href=take.url; a.download=(beatName||"project")+" - "+name+" - "+take.label+"."+ext; a.click(); setContextMenu(null); };

  var toggleMute  = function(id){ setTracks(function(p){ return p.map(function(t){ return t.id===id?{...t,muted:!t.muted}:t; }); }); };
  var toggleSolo  = function(id){ setTracks(function(p){ return p.map(function(t){ return t.id===id?{...t,solo:!t.solo}:t; }); }); };
  var setVolume   = function(id,v){ setTracks(function(p){ return p.map(function(t){ return t.id===id?{...t,volume:v}:t; }); }); };
  var renameTrack = function(id,n){ setTracks(function(p){ return p.map(function(t){ return t.id===id?{...t,name:n}:t; }); }); setEditingTrack(null); };
  var deleteTrack = function(id){ setTracks(function(p){ return p.filter(function(t){ return t.id!==id; }); }); };

  var progress   = beatDuration > 0 ? (beatTime/beatDuration)*100 : 0;
  var bars       = Array.from(analyserData);
  var loopInPct  = beatDuration > 0 ? (loopIn/beatDuration)*100 : 0;
  var loopOutPct = beatDuration > 0 ? (loopOut/beatDuration)*100 : 0;

  // ── Timeline ruler computed vars ──────────────────────────────
  var _bpb   = timeSigNum;
  var _spb   = 60 / bpm;
  var _sbar  = _spb * _bpb;
  var _tbars = beatDuration > 0 ? Math.ceil(beatDuration / _sbar) + 2 : 16;
  var _rw    = Math.max(_tbars * 80 * zoom, 800);
  var _pps   = beatDuration > 0 ? _rw / beatDuration : _rw / (_tbars * _sbar);
  var _phPx  = beatTime * _pps;
  var _liPx  = loopIn  * _pps;
  var _loPx  = loopOut * _pps;
  var _onRS  = function(e) { setTimelineScroll(e.target.scrollLeft); if (tracksScrollRef.current) tracksScrollRef.current.scrollLeft = e.target.scrollLeft; };
  var _onRC  = function(e) { if (settingLoop) return; var rect=e.currentTarget.getBoundingClientRect(); var x=e.clientX-rect.left+e.currentTarget.scrollLeft; if (audioRef.current && beatDuration>0) audioRef.current.currentTime=Math.min(x/_pps,beatDuration); };
  var _onLD  = function(side) { return function(e) { e.stopPropagation(); var sx=e.clientX; var sv=side==='in'?loopIn:loopOut; var onM=function(me){ var dt=(me.clientX-sx)/_pps; var nT=Math.max(0,Math.min(sv+dt,beatDuration)); if(side==='in') setLoopIn(Math.min(nT,loopOut-0.5)); if(side==='out') setLoopOut(Math.max(nT,loopIn+0.5)); }; var onU=function(){ document.removeEventListener('mousemove',onM); document.removeEventListener('mouseup',onU); }; document.addEventListener('mousemove',onM); document.addEventListener('mouseup',onU); }; };
  var timelineRuler = (
    <div style={{ flexShrink:0 }}>
      <div style={{ display: "flex", alignItems: "center", gap:6, padding: "4px 12px", background: "#090909", borderBottom: "1px solid #0f0f0f" }}>
        <button onClick={function(){ setZoom(function(z){ return Math.max(0.5,+(z-0.5).toFixed(1)); }); }} style={{ background: "#141414", border: "1px solid #222", borderRadius:5, color: "#888", fontSize:16, width:24, height:24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight:1 }}>-</button>
        <span style={{ color: "#555", fontSize:10, fontFamily: "monospace", width:28, textAlign: "center" }}>{zoom}x</span>
        <button onClick={function(){ setZoom(function(z){ return Math.min(4,+(z+0.5).toFixed(1)); }); }} style={{ background: "#141414", border: "1px solid #222", borderRadius:5, color: "#888", fontSize:16, width:24, height:24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight:1 }}>+</button>
        <div style={{ width:1, background: "#1a1a1a", height:14, margin: "0 4px" }} />
        <button onClick={function(){ setLoopEnabled(function(v){return !v;}); }} style={{ background:loopEnabled?"rgba(59,130,246,0.2)":"#141414", border:"1px solid "+(loopEnabled?"#3B82F6":"#222"), borderRadius:6, color:loopEnabled?"#3B82F6":"#555", fontSize:10, fontWeight:700, padding:"3px 8px", cursor:"pointer" }}>LOOP</button>
        {loopEnabled && <span style={{ color: "#3B82F6", fontSize:10, fontFamily: "monospace" }}>{fmt(loopIn)} - {fmt(loopOut)}</span>}
      </div>
      <div ref={timelineRulerRef} onScroll={_onRS} onClick={_onRC}
        style={{ overflowX: "auto", overflowY: "hidden", height:38, background: "#0c0c0c", borderBottom: "1px solid #141414", position: "relative", cursor: "pointer" }}>
        <div style={{ position: "relative", width:_rw, height: "100%", flexShrink:0 }}>
          {loopEnabled && _loPx > _liPx && (
            <div style={{ position: "absolute", left:_liPx, width:_loPx-_liPx, top:0, bottom:0, background: "rgba(59,130,246,0.12)", zIndex:1 }}>
              <div onMouseDown={_onLD('in')} style={{ position: "absolute", left:-2, top:0, bottom:0, width:6, background: "#3B82F6", cursor: "ew-resize", zIndex:3, borderRadius: "2px 0 0 2px" }} />
              <div onMouseDown={_onLD('out')} style={{ position: "absolute", right:-2, top:0, bottom:0, width:6, background: "#3B82F6", cursor: "ew-resize", zIndex:3, borderRadius: "0 2px 2px 0" }} />
              <span style={{ position: "absolute", top:2, left:8, color: "#3B82F6", fontSize:9, fontWeight:700, pointerEvents: "none" }}>LOOP</span>
            </div>
          )}
          {Array.from({length:_tbars+1}, function(_,bi){
            var bx = bi * _sbar * _pps;
            return (
              <div key={bi} style={{ position: "absolute", left:bx, top:0, bottom:0 }}>
                <div style={{ position: "absolute", left:0, top:0, bottom:0, width:1, background:bi===0?'#333': "#1e1e1e" }} />
                {bi < _tbars && <span style={{ position: "absolute", top:3, left:4, color: "#555", fontSize:9, fontFamily: "monospace", fontWeight:700, userSelect: "none" }}>{bi+1}</span>}
                {Array.from({length:_bpb}, function(_,di){
                  if (di===0) return null;
                  return <div key={di} style={{ position: "absolute", left:di*_spb*_pps, top:16, bottom:0, width:1, background: "#181818" }}><span style={{ position: "absolute", top:2, left:2, color: "#252525", fontSize:7, fontFamily: "monospace", userSelect: "none" }}>{di+1}</span></div>;
                })}
              </div>
            );
          })}
          <div style={{ position: "absolute", left:_phPx, top:0, bottom:0, width:2, background: "#C026D3", zIndex:10, pointerEvents: "none" }}>
            <div style={{ position: "absolute", top:0, left:-5, width:0, height:0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "8px solid #C026D3" }} />
          </div>
        </div>
      </div>
    </div>
  );

  var _trimmingTrack = trimming ? tracks.find(function(t){ return t.id===trimming.trackId; }) : null;
  var _trimmingTake  = _trimmingTrack ? _trimmingTrack.takes.find(function(tk){ return tk.id===trimming.takeId; }) : null;
  var _trimmingDur   = _trimmingTake ? (_trimmingTake.duration || 1) : 1;
  var trimmingPanel  = _trimmingTrack && _trimmingTake ? (
    <div style={{ position:"absolute", inset:0, zIndex:800, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"flex-end" }}>
      <div style={{ width:"100%", background:"#111", borderRadius:"20px 20px 0 0", padding:"20px 20px 32px" }}>
        <div style={{ color:"white", fontWeight:800, fontSize:16, marginBottom:16 }}>Trim — {_trimmingTake.label}</div>
        <div style={{ position:"relative", height:56, marginBottom:20, background:"#1a1a1a", borderRadius:8, overflow:"hidden" }}>
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", gap:1, padding:"0 4px" }}>
            {_trimmingTake.bars.map(function(v,i){ return React.createElement("div", {key:i, style:{ flex:1, background:_trimmingTrack.color, borderRadius:1, height:Math.max(2,(v/40)*50), opacity:0.4 }}); })}
          </div>
          <div style={{ position:"absolute", top:0, bottom:0, left:((_trimmingTake.trimStart||0)/_trimmingDur*100)+"%", width:(((_trimmingTake.trimEnd||_trimmingDur)-(_trimmingTake.trimStart||0))/_trimmingDur*100)+"%", background:_trimmingTrack.color+"22", border:"2px solid "+_trimmingTrack.color, borderRadius:4 }} />
        </div>
        <div style={{ display:"flex", gap:16, marginBottom:16 }}>
          <div style={{ flex:1 }}>
            <div style={{ color:"#888", fontSize:10, marginBottom:6 }}>START</div>
            <input type="range" min={0} max={100} step={0.5} value={((_trimmingTake.trimStart||0)/_trimmingDur)*100}
              onChange={function(e){ applyTrim(trimming.trackId,trimming.takeId,"start",parseFloat(e.target.value)/100); }}
              style={{ width:"100%", accentColor:_trimmingTrack.color }} />
            <div style={{ color:_trimmingTrack.color, fontSize:11, fontFamily:"monospace" }}>{fmt(_trimmingTake.trimStart||0)}</div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ color:"#888", fontSize:10, marginBottom:6 }}>END</div>
            <input type="range" min={0} max={100} step={0.5} value={((_trimmingTake.trimEnd||_trimmingDur)/_trimmingDur)*100}
              onChange={function(e){ applyTrim(trimming.trackId,trimming.takeId,"end",parseFloat(e.target.value)/100); }}
              style={{ width:"100%", accentColor:_trimmingTrack.color }} />
            <div style={{ color:_trimmingTrack.color, fontSize:11, fontFamily:"monospace" }}>{fmt(_trimmingTake.trimEnd||_trimmingDur)}</div>
          </div>
        </div>
        <button onClick={function(){ setTrimming(null); }} style={{ width:"100%", background:"linear-gradient(135deg,#C026D3,#7C3AED)", border:"none", borderRadius:12, color:"white", fontWeight:800, fontSize:15, padding:"14px", cursor:"pointer" }}>Done</button>
      </div>
    </div>
  ) : null;

  return (
    <div style={{ background:"#080808", height:"calc(100vh - calc(68px + env(safe-area-inset-bottom)))", display:"flex", flexDirection:"column", fontFamily:"'DM Sans',sans-serif", position:"relative" }}
      onClick={function(){ setContextMenu(null); setShowProjects(false); setShowSettings(false); setShowAddMenu(false); }}>

      {/* Count-in */}
      {countIn > 0 && (
        <div style={{ position:"absolute", inset:0, zIndex:1000, background:"rgba(0,0,0,0.9)", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column" }}>
          <div style={{ color:"#EF4444", fontSize:110, fontWeight:900, fontFamily:"'Bebas Neue',sans-serif", lineHeight:1 }}>{countIn}</div>
          <div style={{ color:"#555", fontSize:16, marginTop:8 }}>Get ready...</div>
          {countIn === 4 && (
            <div style={{ marginTop:16, color:"#444", fontSize:11, textAlign:"center", padding:"0 32px" }}>
              Allow microphone access when prompted
            </div>
          )}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div style={{ position:"fixed", top:Math.min(contextMenu.y+4,window.innerHeight-230), left:Math.max(8,Math.min(contextMenu.x,window.innerWidth-185)), zIndex:5000, background:"#1c1c1c", border:"1px solid #2a2a2a", borderRadius:14, overflow:"hidden", minWidth:175, boxShadow:"0 8px 32px rgba(0,0,0,0.8)" }}
          onClick={function(e){ e.stopPropagation(); }}>
          <div style={{ padding:"10px 16px 8px", color:"#555", fontSize:11, borderBottom:"1px solid #222" }}>{contextMenu.take.label}</div>
          {[
            {icon:"▶",label:"Play",      fn:function(){ playTake(contextMenu.take,tracks.find(function(t){return t.id===contextMenu.trackId;})); setContextMenu(null); }},
            {icon:"✂",label:"Trim",      fn:function(){ setTrimming({trackId:contextMenu.trackId,takeId:contextMenu.take.id}); setContextMenu(null); }},
            {icon:"⬇",label:"Download",  fn:function(){ downloadTake(contextMenu.take,tracks.find(function(t){return t.id===contextMenu.trackId;})?.name||""); }},
            {icon:"⧉",label:"Duplicate", fn:function(){ duplicateTake(contextMenu.trackId,contextMenu.take); }},
            {icon:"✕",label:"Delete",    fn:function(){ deleteTake(contextMenu.trackId,contextMenu.take.id); }, danger:true},
          ].map(function(item){
            return <button key={item.label} onClick={item.fn} style={{ display:"block", width:"100%", textAlign:"left", padding:"12px 16px", background:"none", border:"none", borderBottom:"1px solid #1a1a1a", color:item.danger?"#EF4444":"white", fontSize:14, cursor:"pointer" }}>{item.icon}  {item.label}</button>;
          })}
        </div>
      )}

      {/* Trim panel */}
      {trimming && tracks.find(function(t){ return t.id===trimming.trackId; }) && tracks.find(function(t){ return t.id===trimming.trackId; }).takes.find(function(tk){ return tk.id===trimming.takeId; }) && trimmingPanel}

      {/* Settings */}
      {showSettings && (
        <div style={{ position:"absolute", inset:0, zIndex:700, background:"rgba(0,0,0,0.85)" }} onClick={function(){ setShowSettings(false); }}>
          <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"#111", borderRadius:"20px 20px 0 0", maxHeight:"88vh", overflowY:"auto" }} onClick={function(e){ e.stopPropagation(); }}>

            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 20px 12px" }}>
              <div style={{ color:"white", fontWeight:800, fontSize:16 }}>Project Settings</div>
              <button onClick={function(){ setShowSettings(false); }} style={{ background:"none", border:"none", color:"#555", fontSize:20, cursor:"pointer" }}>✕</button>
            </div>

            {/* ── TEMPO ── */}
            <div style={{ margin:"0 16px 16px", background:"#1a1a1a", borderRadius:14, overflow:"hidden" }}>
              <div style={{ padding:"14px 16px 6px", color:"white", fontWeight:700, fontSize:13 }}>Tempo</div>
              {/* BPM row */}
              <div style={{ display:"flex", alignItems:"stretch", borderTop:"1px solid #222" }}>
                <button onClick={function(){ setBpm(function(b){ return Math.max(40,b-1); }); }}
                  style={{ flex:1, background:"none", border:"none", borderRight:"1px solid #222", color:"white", fontSize:28, fontWeight:300, cursor:"pointer", padding:"16px 0" }}>−</button>
                <div style={{ flex:2, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"12px 0", cursor:"pointer" }}
                  onClick={handleTapTempo}>
                  <div style={{ color:"white", fontWeight:900, fontSize:40, lineHeight:1 }}>{bpm}</div>
                  <div style={{ color:"#555", fontSize:11, marginTop:4 }}>Tap Tempo</div>
                </div>
                <button onClick={function(){ setBpm(function(b){ return Math.min(220,b+1); }); }}
                  style={{ flex:1, background:"none", border:"none", borderLeft:"1px solid #222", color:"white", fontSize:28, fontWeight:300, cursor:"pointer", padding:"16px 0" }}>+</button>
              </div>
              {/* BPM slider */}
              <div style={{ padding:"8px 16px 12px" }}>
                <input type="range" min={40} max={220} step={1} value={bpm}
                  onChange={function(e){ setBpm(parseInt(e.target.value)); }}
                  style={{ width:"100%", accentColor:"#C026D3" }} />
                <div style={{ display:"flex", justifyContent:"space-between", color:"#444", fontSize:10, marginTop:2 }}>
                  <span>40</span><span>220</span>
                </div>
              </div>
              {/* Auto-detect */}
              {beatUrl && (
                <div style={{ padding:"0 16px 14px", display:"flex", alignItems:"center", gap:10 }}>
                  <button onClick={detectBpm} disabled={bpmDetecting}
                    style={{ background:"rgba(192,38,211,0.15)", border:"1px solid rgba(192,38,211,0.3)", borderRadius:8, color:"#C026D3", fontSize:12, fontWeight:700, padding:"7px 14px", cursor:bpmDetecting?"not-allowed":"pointer", opacity:bpmDetecting?0.6:1 }}>
                    {bpmDetecting ? "Detecting..." : "Auto-detect BPM"}
                  </button>
                  {detectedBpm > 0 && <span style={{ color:"#22C55E", fontSize:12, fontWeight:700 }}>→ {detectedBpm} BPM</span>}
                  {detectedBpm === -1 && <span style={{ color:"#F87171", fontSize:12 }}>Could not detect</span>}
                </div>
              )}
            </div>

            {/* ── TIME SIGNATURE ── */}
            <div style={{ margin:"0 16px 16px", background:"#1a1a1a", borderRadius:14, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:"1px solid #222" }}>
                <div style={{ color:"white", fontWeight:700, fontSize:13 }}>Time Signature</div>
                <div style={{ color:"#888", fontSize:13 }}>{timeSigNum}/{timeSigDen}</div>
              </div>
              <div style={{ display:"flex", gap:16, padding:"14px 16px" }}>
                {/* Numerator */}
                <div style={{ flex:1 }}>
                  <div style={{ color:"#555", fontSize:10, marginBottom:8, textAlign:"center" }}>Beats per bar</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {[2,3,4,5,6,7].map(function(n){
                      return (
                        <button key={n} onClick={function(){ setTimeSigNum(n); }}
                          style={{ background:timeSigNum===n?"rgba(192,38,211,0.2)":"#141414", border:"1px solid "+(timeSigNum===n?"#C026D3":"#222"), borderRadius:8, color:timeSigNum===n?"#C026D3":"#666", fontSize:14, fontWeight:timeSigNum===n?800:400, padding:"8px", cursor:"pointer" }}>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Denominator */}
                <div style={{ flex:1 }}>
                  <div style={{ color:"#555", fontSize:10, marginBottom:8, textAlign:"center" }}>Note value</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {[2,4,8,16].map(function(n){
                      return (
                        <button key={n} onClick={function(){ setTimeSigDen(n); }}
                          style={{ background:timeSigDen===n?"rgba(192,38,211,0.2)":"#141414", border:"1px solid "+(timeSigDen===n?"#C026D3":"#222"), borderRadius:8, color:timeSigDen===n?"#C026D3":"#666", fontSize:14, fontWeight:timeSigDen===n?800:400, padding:"8px", cursor:"pointer" }}>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── PROJECT KEY ── */}
            <div style={{ margin:"0 16px 16px", background:"#1a1a1a", borderRadius:14, overflow:"hidden" }}>
              <div style={{ padding:"14px 16px", borderBottom:"1px solid #222", color:"white", fontWeight:700, fontSize:13 }}>Project Key</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, padding:"12px 16px" }}>
                {["C major","C# major","D major","D# major","E major","F major","F# major","G major","G# major","A major","A# major","B major",
                  "C minor","C# minor","D minor","D# minor","E minor","F minor","F# minor","G minor","G# minor","A minor","A# minor","B minor"].map(function(k){
                  return (
                    <button key={k} onClick={function(){ setProjectKey(k); }}
                      style={{ background:projectKey===k?"rgba(192,38,211,0.2)":"#141414", border:"1px solid "+(projectKey===k?"#C026D3":"#222"), borderRadius:20, color:projectKey===k?"#C026D3":"#666", fontSize:11, fontWeight:projectKey===k?700:400, padding:"5px 10px", cursor:"pointer" }}>
                      {k}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── INPUT DEVICE ── */}
            <div style={{ margin:"0 16px 16px", background:"#1a1a1a", borderRadius:14, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:"1px solid #222" }}>
                <div style={{ color:"white", fontWeight:700, fontSize:13 }}>Input Device</div>
                <button onClick={loadAudioDevices} style={{ background:"none", border:"none", color:"#C026D3", fontSize:12, cursor:"pointer" }}>Refresh</button>
              </div>
              {/* Default options always available */}
              {[
                { id:"default",  label:"iPhone Microphone",  icon:"📱" },
                { id:"headset",  label:"Headset / AirPods",   icon:"🎧" },
              ].map(function(opt){
                return (
                  <button key={opt.id} onClick={function(){ setInputDevice(opt.id); }}
                    style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:"none", border:"none", borderBottom:"1px solid #1a1a1a", cursor:"pointer" }}>
                    <span style={{ fontSize:18 }}>{opt.icon}</span>
                    <span style={{ color:"white", fontSize:13, flex:1, textAlign:"left" }}>{opt.label}</span>
                    <div style={{ width:18, height:18, borderRadius:"50%", border:"2px solid "+(inputDevice===opt.id?"#C026D3":"#333"), background:inputDevice===opt.id?"#C026D3":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {inputDevice===opt.id && <div style={{ width:6, height:6, borderRadius:"50%", background:"white" }} />}
                    </div>
                  </button>
                );
              })}
              {/* Additional enumerated devices */}
              {audioDevices.filter(function(d){ return d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications"; }).map(function(d){
                return (
                  <button key={d.deviceId} onClick={function(){ setInputDevice(d.deviceId); }}
                    style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:"none", border:"none", borderBottom:"1px solid #1a1a1a", cursor:"pointer" }}>
                    <span style={{ fontSize:18 }}>🎙</span>
                    <span style={{ color:"white", fontSize:13, flex:1, textAlign:"left" }}>{d.label || "External Mic"}</span>
                    <div style={{ width:18, height:18, borderRadius:"50%", border:"2px solid "+(inputDevice===d.deviceId?"#C026D3":"#333"), background:inputDevice===d.deviceId?"#C026D3":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {inputDevice===d.deviceId && <div style={{ width:6, height:6, borderRadius:"50%", background:"white" }} />}
                    </div>
                  </button>
                );
              })}
              <div style={{ padding:"8px 16px 12px", color:"#444", fontSize:11 }}>
                iOS auto-routes to headset when plugged in. Tap Refresh after connecting a device.
              </div>
            </div>

            {/* ── METRONOME ── */}
            <div style={{ margin:"0 16px 16px", background:"#1a1a1a", borderRadius:14, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px" }}>
                <div>
                  <div style={{ color:"white", fontWeight:700, fontSize:13 }}>Metronome</div>
                  <div style={{ color:"#555", fontSize:11, marginTop:2 }}>Click track while recording</div>
                </div>
                <button onClick={function(){ setMetronomeOn(function(v){ return !v; }); }}
                  style={{ background:metronomeOn?"rgba(192,38,211,0.2)":"#141414", border:"1px solid "+(metronomeOn?"#C026D3":"#2a2a2a"), borderRadius:20, color:metronomeOn?"#C026D3":"#555", fontWeight:700, fontSize:12, padding:"6px 16px", cursor:"pointer" }}>
                  {metronomeOn?"ON":"OFF"}
                </button>
              </div>
            </div>

            {/* ── CHANGE BEAT ── */}
            <label style={{ cursor:"pointer", display:"block", margin:"0 16px 32px" }}>
              <div style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ color:"white", fontWeight:700, fontSize:13 }}>Beat File</div>
                  <div style={{ color:"#555", fontSize:12, marginTop:2 }}>{beatName||"No beat loaded"}</div>
                </div>
                <span style={{ color:"#C026D3", fontSize:13, fontWeight:700 }}>Upload</span>
              </div>
              <input type="file" accept=".mp3,.wav,.m4a,.aac,audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/*" onChange={handleBeatUpload} style={{ display:"none" }} />
            </label>

          </div>
        </div>
      )}

      {/* Projects */}
      {showProjects && (
        <div style={{ position:"absolute", inset:0, zIndex:900, background:"rgba(0,0,0,0.7)" }} onClick={function(){ setShowProjects(false); }}>
          <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"#111", borderRadius:"20px 20px 0 0", padding:"20px 16px 40px", maxHeight:"70vh", overflowY:"auto" }} onClick={function(e){ e.stopPropagation(); }}>
            <div style={{ color:"white", fontWeight:800, fontSize:16, marginBottom:16 }}>Saved Projects</div>
            {savedProjects.length===0 ? <div style={{ color:"#444", fontSize:14, textAlign:"center", padding:"20px 0" }}>No saved projects yet</div>
            : savedProjects.map(function(p){
              return (
                <div key={p.id} style={{ background:"#1a1a1a", borderRadius:12, padding:"12px 14px", marginBottom:10, display:"flex", alignItems:"center" }}>
                  <div onClick={function(){ loadProject(p); }} style={{ flex:1, cursor:"pointer" }}>
                    <div style={{ color:"white", fontWeight:700, fontSize:14 }}>{p.name}</div>
                    <div style={{ color:"#555", fontSize:11, marginTop:2 }}>{p.tracks.length} tracks • {p.bpm||120} BPM • {new Date(p.savedAt).toLocaleDateString()}</div>
                  </div>
                  <button onClick={function(){ deleteProject(p.id); }} style={{ background:"none", border:"none", color:"#444", fontSize:16, cursor:"pointer", padding:"4px 8px" }}>✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div style={{ display:"flex", alignItems:"center", padding:"10px 12px", borderBottom:"1px solid #141414", background:"#0a0a0a", flexShrink:0, gap:8 }}>
        {editingProject ? (
          <input autoFocus defaultValue={projectName}
            onBlur={function(e){ setProjectName(e.target.value||projectName); setEditingProject(false); }}
            onKeyDown={function(e){ if(e.key==="Enter"){ setProjectName(e.target.value||projectName); setEditingProject(false); } }}
            style={{ background:"none", border:"none", borderBottom:"1px solid #C026D3", color:"white", fontSize:13, fontWeight:700, outline:"none", flex:1, padding:0 }} />
        ) : (
          <div onClick={function(){ setEditingProject(true); }} style={{ color:"white", fontWeight:700, fontSize:13, cursor:"text", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{projectName}</div>
        )}
        <div style={{ display:"flex", gap:5, flexShrink:0, alignItems:"center" }}>
          <button onClick={function(e){ e.stopPropagation(); setShowProjects(function(v){return !v;}); }} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, color:"#888", fontSize:9, fontWeight:700, padding:"5px 7px", cursor:"pointer" }}>PROJECTS</button>
          {hasContent && (
            <button onClick={saveProject} style={{ background:saveStatus?"rgba(34,197,94,0.2)":"rgba(192,38,211,0.15)", border:"1px solid "+(saveStatus?"#22C55E":"rgba(192,38,211,0.3)"), borderRadius:8, color:saveStatus?"#22C55E":"#C026D3", fontSize:9, fontWeight:700, padding:"5px 7px", cursor:"pointer" }}>{saveStatus||"SAVE"}</button>
          )}
          <button onClick={function(e){ e.stopPropagation(); setShowSettings(function(v){return !v;}); }} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, color:"#888", fontSize:12, padding:"5px 8px", cursor:"pointer" }}>⚙</button>
        </div>
        <div style={{ color: isRecording ? "#EF4444" : "#aaa", fontSize: 12, fontFamily: "monospace", fontWeight: 700, flexShrink: 0, background: "#141414", border: "1px solid #222", borderRadius: 6, padding: "4px 8px" }}>{fmt(beatTime)} / {fmt(beatDuration)}</div>
      </div>

      {/* Metronome indicator */}
      {metronomeOn && (
        <div style={{ background:"rgba(192,38,211,0.08)", borderBottom:"1px solid rgba(192,38,211,0.15)", padding:"4px 12px", display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#C026D3" }} />
          <span style={{ color:"#C026D3", fontSize:10, fontWeight:700 }}>METRONOME — {bpm} BPM</span>
        </div>
      )}

      {/* ── DAW TIMELINE RULER ─────────────────────────────── */}
      {timelineRuler}

      {/* TRACKS AREA — always visible */}
      <div ref={tracksScrollRef}
        style={{ flex:1, overflowY:"auto", overflowX:"hidden" }}
        onScroll={function(e){
          setTimelineScroll(e.target.scrollLeft);
          if (timelineRulerRef.current) timelineRulerRef.current.scrollLeft = e.target.scrollLeft;
        }}>

        {/* Beat track — only show when beat is loaded */}
        {beatUrl && (
        <div style={{ borderBottom:"1px solid #111", display:"flex", minHeight:60 }}>
          <div style={{ width:90, flexShrink:0, background:"#0d0d0d", borderRight:"1px solid #141414", padding:"8px 10px", display:"flex", flexDirection:"column", justifyContent:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:2 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#C026D3" }} />
              <span style={{ color:"white", fontSize:10, fontWeight:700 }}>BEAT</span>
            </div>
            <div style={{ color:"#333", fontSize:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{beatName}</div>
          </div>
          <div style={{ flex:1, background:"linear-gradient(180deg,rgba(192,38,211,0.1),rgba(192,38,211,0.03))", display:"flex", alignItems:"center", padding:"6px 4px", gap:1, overflow:"hidden" }}>
            {bars.map(function(v,i){
              var h = isPlaying ? Math.max(3,(v/255)*42) : 18+Math.sin(i*0.4)*10;
              return <div key={i} style={{ flex:1, background:i<(progress/100*bars.length)?"#C026D3":"rgba(192,38,211,0.3)", borderRadius:1, height:h }} />;
            })}
          </div>
        </div>
        )}

        {/* Vocal tracks */}
        {tracks.map(function(track){
          var isRecordingThis = isRecording && recordingTrackId===track.id;
          return (
            <div key={track.id} style={{ borderBottom:"1px solid #0f0f0f" }}>
              <div style={{ display:"flex", alignItems:"stretch", minHeight:58 }}>
                <div style={{ width:90, flexShrink:0, background:"#0a0a0a", borderRight:"1px solid #141414", padding:"6px 8px", display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:isRecordingThis?"#EF4444":track.color, flexShrink:0 }} />
                    {editingTrack===track.id ? (
                      <input autoFocus defaultValue={track.name} onBlur={function(e){ renameTrack(track.id,e.target.value||track.name); }} onKeyDown={function(e){ if(e.key==="Enter") renameTrack(track.id,e.target.value||track.name); }} style={{ background:"none", border:"none", borderBottom:"1px solid #C026D3", color:"white", fontSize:10, width:"100%", outline:"none", padding:0 }} />
                    ) : (
                      <span onClick={function(){ setEditingTrack(track.id); }} style={{ color:"white", fontSize:10, fontWeight:700, cursor:"text", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{track.name}</span>
                    )}
                  </div>
                  <div style={{ display:"flex", gap:3, alignItems:"center" }}>
                    <button onClick={function(){ toggleMute(track.id); }} style={{ background:track.muted?"#F59E0B22":"#1a1a1a", border:"1px solid "+(track.muted?"#F59E0B":"#2a2a2a"), borderRadius:4, color:track.muted?"#F59E0B":"#555", fontSize:8, padding:"2px 5px", cursor:"pointer", fontWeight:700 }}>M</button>
                    <button onClick={function(){ toggleSolo(track.id); }} style={{ background:track.solo?"#22C55E22":"#1a1a1a", border:"1px solid "+(track.solo?"#22C55E":"#2a2a2a"), borderRadius:4, color:track.solo?"#22C55E":"#555", fontSize:8, padding:"2px 5px", cursor:"pointer", fontWeight:700 }}>S</button>
                    <input type="range" min={0} max={1} step={0.05} value={track.volume} onChange={function(e){ setVolume(track.id,parseFloat(e.target.value)); }} style={{ width:28, accentColor:track.color, height:2 }} />
                    <button onClick={function(){ deleteTrack(track.id); }} style={{ background:"none", border:"none", color:"#333", fontSize:10, cursor:"pointer", padding:"0 2px", marginLeft:"auto" }}>✕</button>
                  </div>
                </div>
                <div style={{ flex:1, overflowX:"auto", display:"flex", alignItems:"stretch", background:"#090909" }}>
                  {isRecordingThis ? (
                    <div style={{ flex:1, minWidth:200, background:"linear-gradient(180deg,rgba(239,68,68,0.1),rgba(239,68,68,0.03))", display:"flex", alignItems:"center", padding:"6px 4px", gap:1 }}>
                      {Array.from(recBars).map(function(v,i){ return <div key={i} style={{ flex:1, background:"#EF4444", borderRadius:1, height:Math.max(3,(v/90)*40) }} />; })}
                    </div>
                  ) : track.takes.length===0 ? (
                    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ color:"#222", fontSize:11 }}>No takes yet</span></div>
                  ) : (
                    <div style={{ display:"flex", gap:3, padding:"6px", alignItems:"center" }}>
                      {track.takes.map(function(take){
                        var w = take.duration>0 ? Math.max(60,((take.trimEnd||take.duration)-(take.trimStart||0))/take.duration*110) : 110;
                        return (
                          <div key={take.id}
                            onContextMenu={function(e){ handleTakeLongPress(e,track.id,take); }}
                            onTouchStart={function(e){ var t=setTimeout(function(){ handleTakeLongPress(e,track.id,take); },500); e.currentTarget._lp=t; }}
                            onTouchEnd={function(e){ clearTimeout(e.currentTarget._lp); }}
                            onClick={function(){ take.url&&playTake(take,track); }}
                            style={{ flexShrink:0, width:w, height:46, borderRadius:6, background:"linear-gradient(180deg,"+track.color+"22,"+track.color+"08)", border:"1px solid "+track.color+"44", overflow:"hidden", cursor:take.url?"pointer":"default", position:"relative", opacity:take.url?1:0.5 }}>
                            <div style={{ display:"flex", alignItems:"center", padding:"4px 3px", gap:0.5, height:"100%" }}>
                              {take.bars.map(function(v,i){ return <div key={i} style={{ flex:1, background:track.color, borderRadius:0.5, height:Math.max(2,(v/40)*30), opacity:0.7 }} />; })}
                            </div>
                            <div style={{ position:"absolute", bottom:2, left:4, color:"rgba(255,255,255,0.5)", fontSize:8 }}>{take.label}</div>
                            {(take.trimStart>0||(take.trimEnd<take.duration&&take.trimEnd>0)) && <div style={{ position:"absolute", top:2, right:4, color:"rgba(255,255,255,0.4)", fontSize:8 }}>✂</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              {/* Per-track record button */}
              <div style={{ background:"#080808", padding:"4px 8px 4px 96px", borderTop:"1px solid #0f0f0f" }}>
                {isRecordingThis ? (
                  <button onClick={stopRecording} style={{ background:"#EF444422", border:"1px solid #EF4444", borderRadius:6, color:"#EF4444", fontSize:11, fontWeight:700, padding:"4px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:8, height:8, background:"#EF4444", borderRadius:2 }} /> Stop
                  </button>
                ) : (
                  <button onClick={function(){ if(!isRecording&&!countIn) startCountIn(track.id); }} disabled={isRecording||countIn>0}
                    style={{ background:"#141414", border:"1px solid #2a2a2a", borderRadius:6, color:(isRecording||countIn>0)?"#333":"#EF4444", fontSize:11, fontWeight:700, padding:"4px 14px", cursor:(isRecording||countIn>0)?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:8, height:8, background:(isRecording||countIn>0)?"#333":"#EF4444", borderRadius:"50%" }} /> Record
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add track / upload beat row — always visible, BandLab style */}
        <div style={{ borderBottom:"1px solid #111", display:"flex", minHeight:52 }}>
          <button onClick={function(e){ e.stopPropagation(); setShowAddMenu(function(v){ return !v; }); }}
            style={{ width:"100%", background:showAddMenu?"rgba(192,38,211,0.06)":"none", border:"none", padding:"0 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:8, background:"#1a1a1a", border:"1px solid #2a2a2a", display:"flex", alignItems:"center", justifyContent:"center", color:showAddMenu?"#C026D3":"#555", fontSize:22, fontWeight:300, lineHeight:1, flexShrink:0 }}>+</div>
            <span style={{ color:"#333", fontSize:12 }}>Add track</span>
          </button>
        </div>
      </div>

      {/* Status messages */}
      {saveStatus && <div style={{ background:saveStatus.includes("Loaded")?"rgba(59,130,246,0.1)":"rgba(34,197,94,0.1)", borderTop:"1px solid rgba(34,197,94,0.2)", color:saveStatus.includes("Loaded")?"#3B82F6":"#22C55E", fontSize:12, padding:"6px 16px", textAlign:"center", flexShrink:0 }}>{saveStatus}</div>}
      {error && <div style={{ background:"rgba(239,68,68,0.1)", borderTop:"1px solid rgba(239,68,68,0.2)", color:"#F87171", fontSize:12, padding:"6px 16px", textAlign:"center", flexShrink:0 }}>{error}</div>}

      {/* + Add menu popup */}
      {showAddMenu && (
        <div style={{ position:"absolute", bottom:90, right:16, zIndex:400, background:"#1c1c1c", border:"1px solid #2a2a2a", borderRadius:14, overflow:"hidden", minWidth:200, boxShadow:"0 8px 32px rgba(0,0,0,0.8)" }}
          onClick={function(e){ e.stopPropagation(); }}>
          <div style={{ padding:"10px 16px 6px", color:"#555", fontSize:10, fontWeight:700 }}>ADD TO PROJECT</div>
          <label style={{ display:"block", cursor:"pointer" }}>
            <div style={{ padding:"12px 16px", display:"flex", alignItems:"center", gap:12, borderBottom:"1px solid #1a1a1a" }}
              onMouseEnter={function(e){ e.currentTarget.style.background="#252525"; }}
              onMouseLeave={function(e){ e.currentTarget.style.background="transparent"; }}>
              <div style={{ width:32, height:32, borderRadius:8, background:"rgba(192,38,211,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🎵</div>
              <div><div style={{ color:"white", fontWeight:700, fontSize:13 }}>Upload Beat</div><div style={{ color:"#555", fontSize:11 }}>MP3 or WAV from Files</div></div>
            </div>
            <input type="file" accept=".mp3,.wav,.m4a,.aac,audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/*" onChange={handleBeatUpload} style={{ display:"none" }} />
          </label>
          <div style={{ padding:"12px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}
            onClick={addVocalTrack}
            onMouseEnter={function(e){ e.currentTarget.style.background="#252525"; }}
            onMouseLeave={function(e){ e.currentTarget.style.background="transparent"; }}>
            <div style={{ width:32, height:32, borderRadius:8, background:"rgba(239,68,68,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🎙</div>
            <div><div style={{ color:"white", fontWeight:700, fontSize:13 }}>Add Vocal Track</div><div style={{ color:"#555", fontSize:11 }}>Record a new layer</div></div>
          </div>
        </div>
      )}

      {/* TRANSPORT */}
      <div style={{ background:"#0a0a0a", borderTop:"1px solid #141414", padding:"8px 16px", flexShrink:0 }}>
        {beatUrl && (
          <div style={{ position:"relative", marginBottom:8 }}>
            <input type="range" min={0} max={beatDuration||100} step={0.1} value={beatTime}
              onChange={function(e){ if(audioRef.current) audioRef.current.currentTime=parseFloat(e.target.value); }}
              style={{ width:"100%", accentColor:"#C026D3", display:"block" }} />
            {loopEnabled && beatDuration>0 && <div style={{ position:"absolute", top:0, left:loopInPct+"%", width:(loopOutPct-loopInPct)+"%", height:"100%", background:"rgba(59,130,246,0.15)", pointerEvents:"none" }} />}
          </div>
        )}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          {/* spacer */}
          <div style={{ width:40 }} />

          <button onClick={rewind} style={{ width:36, height:36, borderRadius:8, background:"#141414", border:"1px solid #222", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
          </button>

          <button onClick={function(){ if(isRecording){stopRecording();}else if(tracks.length>0&&!countIn){startCountIn(tracks[tracks.length-1].id);}else if(tracks.length===0){addVocalTrack();} }} disabled={countIn>0}
            style={{ width:52, height:52, borderRadius:"50%", background:isRecording?"#EF4444":"linear-gradient(135deg,#EF4444,#DC2626)", border:isRecording?"3px solid rgba(239,68,68,0.5)":"3px solid rgba(239,68,68,0.2)", cursor:countIn>0?"not-allowed":"pointer", opacity:countIn>0?0.4:1, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:isRecording?"0 0 20px rgba(239,68,68,0.5)":"none" }}>
            {isRecording?<div style={{ width:16, height:16, background:"white", borderRadius:3 }} />:<div style={{ width:20, height:20, background:"white", borderRadius:"50%" }} />}
          </button>

          <button onClick={togglePlay} disabled={!beatUrl} style={{ width:40, height:40, borderRadius:"50%", background:beatUrl?"linear-gradient(135deg,#C026D3,#7C3AED)":"#141414", border:"none", cursor:beatUrl?"pointer":"not-allowed", opacity:beatUrl?1:0.4, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {isPlaying?<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>:<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>}
          </button>

          <div style={{ width:36, height:36, borderRadius:8, background:"#141414", border:"1px solid #222", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
            <span style={{ color:tracks.length>0?"#C026D3":"#444", fontSize:13, fontWeight:800, lineHeight:1 }}>{tracks.length}</span>
            <span style={{ color:"#333", fontSize:7 }}>TRACKS</span>
          </div>
        </div>
      </div>

      <audio ref={audioRef}
        onTimeUpdate={function(e){ setBeatTime(e.target.currentTime); }}
        onDurationChange={function(e){ setBeatDuration(e.target.duration); setLoopOut(e.target.duration); }}
        onEnded={function(){ if(!loopEnabled) setIsPlaying(false); }}
        style={{ display:"none" }} />
    </div>
  );
}



const NAV = [
  { id: "home",      label: "Home",    icon: "🏠" },
  { id: "artists",   label: "Artists", icon: "▦"  },
  { id: "trending",  label: "Trending",icon: "🔥" },
  { id: "search",    label: "Search",  icon: "🔍" },
  { id: "saved",     label: "Saved",   icon: "🔖" },
  { id: "studio",    label: "Studio",  icon: "🎙" },
  { id: "exclusive", label: "Members", icon: "🔒" },
  { id: "profile",   label: "Profile", icon: "👤" },
];

// =============================================================================
// ROOT APP
// =============================================================================
// =============================================================================
// SPLASH SCREEN
// =============================================================================
function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false);

  useEffect(function() {
    var fadeTimer = setTimeout(function() { setFading(true); }, 1200);
    var doneTimer = setTimeout(function() { onDone(); }, 1600);
    return function() { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "#0a0a0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "opacity 0.4s ease",
      opacity: fading ? 0 : 1,
      pointerEvents: fading ? "none" : "all",
    }}>
      <img
        src="/splash.png"
        alt="BeatFinder"
        style={{
          width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center",
          display: "block",
        }}
      />
    </div>
  );
}

export default function BeatFinder() {
  const [splashDone, setSplashDone] = useState(false);
  const [tab,     setTab]     = useState("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [artist,  setArtist]  = useState(null); // kept for compatibility
  const [user,    setUser]    = useState(null);
  const [playing, setPlaying] = useState(null);

  // savedMap: { [videoId]: beat } - localStorage for guests, backend for logged-in users
  const [savedMap, setSavedMap] = useState(loadSaved);
  const savedIds = new Set(Object.keys(savedMap));

  // Handle reset token from URL
  const resetToken = new URLSearchParams(window.location.search).get("reset_token");

  // Clear local saves if not logged in - guests shouldn't have saved state
  useEffect(() => {
    if (!user) {
      setSavedMap({});
    }
  }, [user]);

  // Restore session from stored JWT on app load
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    AuthAPI.me()
      .then(u => {
        setUser({
          ...u,
          isPro:       u.plan === "producer",
          isArtistPro: u.plan === "artist" || u.plan === "producer",
        });
      })
      .catch(() => clearToken());
  }, []);

  // When user logs in, pull their saved beats from the backend
  useEffect(() => {
    if (!user) return;
    BeatsAPI.list()
      .then(list => {
        const map = {};
        list.forEach(b => { map[b.video_id] = { videoId: b.video_id, title: b.title, channel: b.channel, thumbnail: b.thumbnail }; });
        setSavedMap(map);
        persistSaved(map);
      })
      .catch(e => console.warn("[BeatFinder] Could not fetch saved beats:", e));
  }, [user]);

  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const toggleSave = useCallback(beat => {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    setSavedMap(prev => {
      const next = { ...prev };
      if (next[beat.videoId]) {
        delete next[beat.videoId];
        BeatsAPI.remove(beat.videoId).catch(console.warn);
      } else {
        next[beat.videoId] = beat;
        BeatsAPI.save(beat).catch(console.warn);
      }
      persistSaved(next);
      return next;
    });
  }, [user]);


  const handleSaveLyric = useCallback((lyric, editIndex) => {
    setSavedLyrics(prev => {
      let next;
      if (editIndex !== null && editIndex !== undefined) {
        next = prev.map((l, i) => i === editIndex ? lyric : l);
      } else {
        next = [lyric, ...prev];
      }
      // Always keep localStorage as guest fallback
      try { localStorage.setItem("bf_lyrics", JSON.stringify(next)); } catch {}
      // Persist to backend if logged in
      if (user) {
        apiFetch("/api/lyrics", { method: "POST", body: JSON.stringify(lyric) }).catch(() => {});
      }
      return next;
    });
  }, [user]);

  const handleOpenLyrics = useCallback(beat => {
    setPlaying(null);
    setLyricsBeat(beat);
    setEditingLyric(null);
    setEditingIndex(null);
    setLyricsOpen(true);
  }, []);

  const handleEditLyric = useCallback((lyric, index) => {
    setLyricsBeat(lyric.beat || null);
    setEditingLyric(lyric);
    setEditingIndex(index);
    setLyricsOpen(true);
  }, []);

  const handlePlay = useCallback(beat => setPlaying(beat), []);
  const goTab = id => {
    setPlaying(null);
    setTab(id);
  };

  // Lyrics state — backed by MongoDB for logged-in users, localStorage for guests
  const [lyricsOpen,    setLyricsOpen]    = useState(false);
  const [lyricsBeat,    setLyricsBeat]    = useState(null);
  const [editingLyric,  setEditingLyric]  = useState(null);
  const [editingIndex,  setEditingIndex]  = useState(null);
  const [publicProfile, setPublicProfile] = useState(null);
  const [savedLyrics,   setSavedLyrics]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("bf_lyrics") || "[]"); } catch { return []; }
  });

  // When user logs in: fetch their lyrics from backend, migrate any local ones
  useEffect(() => {
    if (!user) return;
    apiFetch("/api/lyrics")
      .then(cloudLyrics => {
        var localLyrics = [];
        try { localLyrics = JSON.parse(localStorage.getItem("bf_lyrics") || "[]"); } catch(e) {}
        const cloudIds = new Set(cloudLyrics.map(l => l.id));
        const toMigrate = localLyrics.filter(l => !cloudIds.has(l.id));
        if (toMigrate.length > 0) {
          apiFetch("/api/lyrics/bulk-import", {
            method: "POST",
            body: JSON.stringify({ lyrics: toMigrate }),
          }).then(() => {
            // Merge migrated lyrics into cloud set
            setSavedLyrics([...cloudLyrics, ...toMigrate]);
            try { localStorage.removeItem("bf_lyrics"); } catch {}
          }).catch(() => setSavedLyrics(cloudLyrics));
        } else {
          setSavedLyrics(cloudLyrics);
          try { localStorage.removeItem("bf_lyrics"); } catch {}
        }
      })
      .catch(() => {
        // Backend unavailable — fall back to localStorage silently
      });
  }, [user?.id]);

  const isArtistPro = user?.isPro || user?.isArtistPro || user?.plan === "artist" || user?.plan === "producer";


  if (resetToken) {
    return (
      <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans',sans-serif", paddingTop: "env(safe-area-inset-top)" }}>
        <ResetPasswordScreen token={resetToken} onDone={() => { window.history.replaceState({}, "", "/"); window.location.reload(); }} />
      </div>
    );
  }

  return (
    <div key="app-root" style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans',sans-serif", paddingTop: "env(safe-area-inset-top)" }}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />

      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}

      {showAuthPrompt && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 20000,
          background: "rgba(0,0,0,0.85)", display: "flex",
          alignItems: "center", justifyContent: "center",
          padding: 24, fontFamily: "'DM Sans',sans-serif",
        }} onClick={() => setShowAuthPrompt(false)}>
          <div style={{
            background: "#111", border: "1.5px solid #C026D3",
            borderRadius: 20, padding: 28, width: "100%", maxWidth: 340,
            textAlign: "center",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>🔖</div>
            <div style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
              Save Your Beats
            </div>
            <div style={{ color: "#888", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
              Create a free account to save beats and sync your library across devices.
            </div>
            <button onClick={() => { setShowAuthPrompt(false); goTab("profile"); }}
              style={{ width: "100%", background: "linear-gradient(135deg,#C026D3,#7C3AED)", border: "none", borderRadius: 32, color: "white", fontWeight: 800, fontSize: 16, padding: "14px", cursor: "pointer", marginBottom: 12 }}>
              Create Account
            </button>
            <button onClick={() => setShowAuthPrompt(false)}
              style={{ background: "none", border: "none", color: "#555", fontSize: 14, cursor: "pointer" }}>
              Maybe later
            </button>
          </div>
        </div>
      )}

      {publicProfile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "#0a0a0a", overflowY: "auto", paddingTop: "env(safe-area-inset-top)" }}>
          <PublicProfileScreen username={publicProfile} onBack={() => setPublicProfile(null)} onPlay={handlePlay} savedIds={savedIds} onSave={toggleSave} />
        </div>
      )}

      <div style={{ position: "relative" }}>
        {["home","artists","trending","search","saved","studio","exclusive"].map(t => (
          <div key={t} style={{
            display: tab === t ? "block" : "none",
            overflowY: "auto",
            height: "calc(100vh - calc(72px + env(safe-area-inset-bottom)))",
            WebkitOverflowScrolling: "touch",
          }}>
            {t === "home"      && <HomeScreen savedIds={savedIds} onSave={toggleSave} onPlay={handlePlay} user={user} onGoMembers={() => goTab("exclusive")} onGoProfile={() => goTab("profile")} onGenreSearch={q => { setSearchQuery(q); goTab("search"); }} savedLyrics={savedLyrics} onEditLyric={handleEditLyric} onGoTrending={() => goTab("trending")} />}
            {t === "artists"   && <ArtistsScreen onPlay={handlePlay} savedIds={savedIds} onSave={toggleSave} />}
            {t === "trending"  && <TrendingScreen savedIds={savedIds} onSave={toggleSave} onPlay={handlePlay} />}
            {t === "search"    && <SearchScreen savedIds={savedIds} onSave={toggleSave} onPlay={handlePlay} initialQuery={searchQuery} onClearInitial={() => setSearchQuery("")} />}
            {t === "saved"     && <SavedScreen savedMap={savedMap} savedIds={savedIds} onSave={toggleSave} user={user} onGoProfile={() => goTab("profile")} onPlay={handlePlay} />}
            {t === "studio"    && <StudioScreen user={user} />}
            {t === "exclusive" && <ExclusiveScreen user={user} onGoProfile={() => goTab("profile")} onPlay={handlePlay} savedIds={savedIds} onSave={toggleSave} />}
          </div>
        ))}
        {tab === "profile" && (
          <div style={{ overflowY: "auto", height: "calc(100vh - calc(72px + env(safe-area-inset-bottom)))", WebkitOverflowScrolling: "touch" }}>
            <ProfileScreen key={user ? user.id : "guest"} user={user} setUser={setUser} onLogout={() => { AuthAPI.logout(); setUser(null); }} savedLyrics={savedLyrics} setSavedLyrics={setSavedLyrics} onPlayBeat={handlePlay} onEditLyric={handleEditLyric} />
          </div>
        )}
      </div>

      {lyricsOpen && <LyricsNotepad beat={lyricsBeat} onClose={() => { setLyricsOpen(false); setEditingLyric(null); setEditingIndex(null); }} onSaveLyric={handleSaveLyric} initialLyric={editingLyric} lyricIndex={editingIndex} />}
      {playing && (
        <Player
          beat={playing}
          onClose={() => setPlaying(null)}
          savedIds={savedIds}
          onSave={toggleSave}
          isArtistPro={user?.isPro || user?.isArtistPro}
          onGoMembers={() => goTab("exclusive")}
          onOpenLyrics={handleOpenLyrics}
          savedLyrics={savedLyrics}
          onEditLyric={handleEditLyric}
        />
      )}
      <div style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 430,
          background: "rgba(8,8,8,0.92)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex", height: "calc(68px + env(safe-area-inset-bottom))",
          zIndex: 100, backdropFilter: "blur(24px)",
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
        }}>
        {NAV.map(n => {
          const isPro    = user?.isPro || user?.isArtistPro;
          const locked   = n.id === "exclusive" && (!user || !isPro);
          const isActive = tab === n.id;
          const activeColor = n.id === "exclusive" ? "#F59E0B" : "#C026D3";
          return (
            <button key={n.id} onClick={() => goTab(n.id)} className="bf-nav-btn"
              style={{
                flex: 1, background: "none", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                color: isActive ? activeColor : locked ? "#F59E0B44" : "#444",
                position: "relative", paddingTop: 8,
                transition: "color 0.2s ease",
              }}>
              {/* Active indicator dot */}
              {isActive && (
                <div style={{
                  position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                  width: 20, height: 2, borderRadius: 1,
                  background: activeColor,
                  boxShadow: "0 0 8px " + activeColor,
                }} />
              )}
              {/* Active glow bg */}
              {isActive && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: "radial-gradient(ellipse at 50% 80%, " + activeColor + "18 0%, transparent 70%)",
                  borderRadius: 12,
                  pointerEvents: "none",
                }} />
              )}
              <span style={{
                fontSize: 17,
                filter: isActive ? "drop-shadow(0 0 6px " + activeColor + ")" : "none",
                transition: "filter 0.2s ease",
                lineHeight: 1,
              }}>{n.icon}</span>
              <span style={{
                fontSize: 9, fontWeight: isActive ? 800 : 600,
                letterSpacing: isActive ? 0.3 : 0,
                transition: "all 0.2s ease",
              }}>{n.label}</span>
              {locked && <div style={{
                position: "absolute", top: 6, right: "calc(50% - 14px)",
                background: "#F59E0B", borderRadius: "50%",
                width: 7, height: 7,
              }} />}
              {n.id === "saved" && savedIds.size > 0 && (
                <div style={{
                  position: "absolute", top: 5, right: "calc(50% - 16px)",
                  background: "#C026D3", borderRadius: "50%",
                  fontSize: 8, fontWeight: 800, color: "white",
                  padding: "1px 4px", minWidth: 14, textAlign: "center",
                  lineHeight: "14px", height: 14,
                  boxShadow: "0 0 6px rgba(192,38,211,0.6)",
                }}>
                  {savedIds.size}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
  }
