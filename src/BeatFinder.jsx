/* eslint-disable */
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

        {/* ── Contact creator button ── */}
        {beat.channel && (
          <a
            href={"https://www.youtube.com/results?search_query=" + encodeURIComponent(beat.channel)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              marginTop: 12, width: "100%", borderRadius: 14, padding: "15px",
              fontWeight: 800, fontSize: 15, cursor: "pointer", textDecoration: "none",
              background: "rgba(255,0,0,0.08)",
              border: "1.5px solid rgba(255,0,0,0.35)",
              color: "#ff4444",
              boxSizing: "border-box",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff4444" style={{flexShrink:0}}>
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            Contact {beat.channel} on YouTube
          </a>
        )}

        {/* ── License notice — shown on every beat ── */}
        <div style={{
          marginTop: 12,
          padding: "12px 14px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid #2a2a2a",
          color: "#666",
          fontSize: 12,
          lineHeight: 1.5,
          textAlign: "center",
        }}>
          🎵 To use this beat in Studio Mode, purchase or obtain a valid license from the creator and upload the MP3/WAV file.
        </div>

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

function HomeScreen({ savedIds, onSave, onPlay, user, onGoMembers, onGoProfile, onGenreSearch, savedLyrics, onEditLyric, onGoTrending, onGoStudio }) {
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
    {
      title: "Record in the Studio",
      sub: "Create projects, record vocals over any beat & export your mix",
      emoji: "🎙",
      grad: "linear-gradient(135deg,#0a001a 0%,#1a0033 40%,#4c0080 75%,#7C3AED 100%)",
      cta: "Open Studio",
      studioSlide: true,
      btnColor: "rgba(124,58,237,0.5)",
      btnBorder: "rgba(124,58,237,0.8)",
      badge: "PRO",
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
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={slide.studioSlide ? onGoStudio : slide.trendingSlide ? onGoTrending : onGoProfile} style={{
              background: slide.btnColor || "rgba(255,255,255,0.15)",
              backdropFilter: "blur(10px)",
              border: "1px solid " + (slide.btnBorder || "rgba(255,255,255,0.25)"),
              borderRadius: 22,
              color: "white", fontWeight: 800, fontSize: 13,
              padding: "9px 20px", cursor: "pointer",
            }}>{slide.cta} →</button>
            {slide.badge && (
              <span style={{ background:"rgba(124,58,237,0.4)", border:"1px solid rgba(124,58,237,0.7)", borderRadius:12, color:"#a78bfa", fontSize:10, fontWeight:800, padding:"4px 8px", letterSpacing:1 }}>{slide.badge}</span>
            )}
          </div>

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
// INDEXEDDB AUDIO STORE
// Stores raw WAV ArrayBuffers keyed by clipId — no size limit unlike localStorage.
// DB: "BeatFinderAudio"  |  Store: "clips"  |  key: clipId (string)
// =============================================================================
const AudioDB = (function () {
  const DB_NAME    = "BeatFinderAudio";
  const STORE_NAME = "clips";
  const DB_VERSION = 1;
  let _db = null;

  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME); // key = clipId
        }
      };
      req.onsuccess  = function (e) { _db = e.target.result; resolve(_db); };
      req.onerror    = function (e) { reject(e.target.error); };
    });
  }

  // Save a WAV ArrayBuffer under a clip key
  async function saveClip(clipId, wavArrayBuffer) {
    const db = await openDB();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(wavArrayBuffer, clipId);
      tx.oncomplete = resolve;
      tx.onerror    = function (e) { reject(e.target.error); };
    });
  }

  // Retrieve a WAV ArrayBuffer by clip key (returns null if not found)
  async function getClip(clipId) {
    const db = await openDB();
    return new Promise(function (resolve) {
      const tx  = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(clipId);
      req.onsuccess = function (e) { resolve(e.target.result || null); };
      req.onerror   = function ()  { resolve(null); };
    });
  }

  // Delete one or more clip keys (pass an array of clipIds)
  async function deleteClips(clipIds) {
    if (!clipIds || clipIds.length === 0) return;
    const db = await openDB();
    return new Promise(function (resolve) {
      const tx    = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      clipIds.forEach(function (id) { store.delete(id); });
      tx.oncomplete = resolve;
      tx.onerror    = resolve; // swallow — best effort
    });
  }

  // Delete ALL clips whose key starts with a project prefix  e.g. "proj_<id>_"
  async function deleteProjectClips(projectId) {
    const db = await openDB();
    return new Promise(function (resolve) {
      const tx    = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req   = store.openCursor();
      req.onsuccess = function (e) {
        const cursor = e.target.result;
        if (!cursor) { resolve(); return; }
        if (String(cursor.key).startsWith("proj_" + projectId + "_")) {
          cursor.delete();
        }
        cursor.continue();
      };
      req.onerror = resolve;
    });
  }

  return { saveClip, getClip, deleteClips, deleteProjectClips };
})();

// =============================================================================
// STUDIO SCREEN
// =============================================================================
// iOS-style wheel picker
function WheelPicker({ items, value, onChange, onClose, title, inline, label }) {
  var itemH = 44;
  var visCount = 5;
  var containerH = itemH * visCount;
  var scrollRef = useRef(null);
  var scrollTimeout = useRef(null);

  var idx = Math.max(0, items.indexOf(value));

  useEffect(function() {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = idx * itemH;
    }
  }, []);

  var handleScroll = function(e) {
    clearTimeout(scrollTimeout.current);
    var el = e.target;
    scrollTimeout.current = setTimeout(function() {
      var nearest = Math.round(el.scrollTop / itemH);
      nearest = Math.max(0, Math.min(nearest, items.length - 1));
      // Snap scroll
      el.scrollTo({ top: nearest * itemH, behavior: "smooth" });
      onChange(items[nearest]);
    }, 80);
  };

  var wheel = (
    <div style={{ position:"relative", height:containerH, flex:1 }}>
      {label && <div style={{ position:"absolute", top:0, left:0, right:0, textAlign:"center", color:"#555", fontSize:10, paddingTop:4, zIndex:3 }}>{label}</div>}
      <div style={{ position:"absolute", top:"50%", left:4, right:4, height:itemH, transform:"translateY(-50%)", background:"rgba(192,38,211,0.10)", borderTop:"1px solid rgba(192,38,211,0.3)", borderBottom:"1px solid rgba(192,38,211,0.3)", borderRadius:8, pointerEvents:"none", zIndex:1 }} />
      <div style={{ position:"absolute", top:0, left:0, right:0, height:itemH*1.8, background:"linear-gradient(to bottom,#1c1c1c 30%,transparent)", pointerEvents:"none", zIndex:2 }} />
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:itemH*1.8, background:"linear-gradient(to top,#1c1c1c 30%,transparent)", pointerEvents:"none", zIndex:2 }} />
      <div ref={scrollRef} onScroll={handleScroll}
        style={{ height:"100%", overflowY:"auto", scrollSnapType:"y mandatory", WebkitOverflowScrolling:"touch",
          scrollbarWidth:"none", msOverflowStyle:"none" }}>
        <div style={{ height:itemH * Math.floor(visCount / 2) }} />
        {items.map(function(item) {
          var isSelected = item === value;
          return (
            <div key={item} style={{ height:itemH, display:"flex", alignItems:"center", justifyContent:"center", scrollSnapAlign:"center", cursor:"pointer" }}
              onClick={function(){ onChange(item); if(!inline) onClose(); }}>
              <span style={{ color:isSelected?"white":"#555", fontSize:isSelected?18:15, fontWeight:isSelected?700:400, transition:"all 0.1s", userSelect:"none" }}>
                {item}
              </span>
            </div>
          );
        })}
        <div style={{ height:itemH * Math.floor(visCount / 2) }} />
      </div>
    </div>
  );

  if (inline) return wheel;

  return (
    <div style={{ position:"absolute", inset:0, zIndex:9999, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"flex-end" }}
      onClick={onClose}>
      <div style={{ width:"100%", background:"#1c1c1c", borderRadius:"20px 20px 0 0", paddingBottom:"calc(20px + env(safe-area-inset-bottom))" }}
        onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px 12px", borderBottom:"1px solid #2a2a2a" }}>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#888", fontSize:14, cursor:"pointer" }}>Cancel</button>
          <div style={{ color:"white", fontWeight:700, fontSize:15 }}>{title}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#C026D3", fontSize:14, fontWeight:700, cursor:"pointer" }}>Done</button>
        </div>
        {wheel}
      </div>
    </div>
  );
}


// =============================================================================
// =============================================================================

// =============================================================================

// =============================================================================
// WAVEFORM CANVAS — real PCM rendering
// =============================================================================
function WaveformCanvas({ audioBuffer, color, width, height, playedFraction, dim, trimStart, trimEnd }) {
  const ref = useRef(null);
  useEffect(function () {
    const cv = ref.current;
    if (!cv) return;
    const W = Math.max(1, Math.round(width));
    const H = Math.max(1, Math.round(height));
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    const mid = H / 2;

    if (!audioBuffer) {
      // Placeholder centre line
      ctx.strokeStyle = color + "44";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();
      return;
    }

    const raw = audioBuffer.getChannelData(0);
    const sr  = audioBuffer.sampleRate;

    // Only draw the trimmed region of the buffer
    const tS = Math.max(0, (trimStart || 0) * sr);
    const tE = Math.min(raw.length, ((trimEnd !== undefined && trimEnd !== null) ? trimEnd : audioBuffer.duration) * sr);
    const regionLen = Math.max(1, tE - tS);
    const spp = regionLen / W;

    // Pre-compute peaks from the trimmed region only
    const peaks = new Float32Array(W);
    for (let px = 0; px < W; px++) {
      const s = Math.floor(tS + px * spp);
      const e = Math.min(Math.floor(tS + (px + 1) * spp) + 1, tE);
      let pk = 0;
      for (let i = s; i < e; i++) { const v = Math.abs(raw[i]); if (v > pk) pk = v; }
      peaks[px] = pk;
    }

    const playedPx = Math.floor(W * Math.min(1, Math.max(0, playedFraction)));

    const unplayedAlpha = dim ? "28" : "88";
    const playedAlpha   = dim ? "44" : "ee";

    // Unplayed portion
    ctx.fillStyle = color + unplayedAlpha;
    for (let px = playedPx; px < W; px++) {
      const h = Math.max(1, peaks[px] * mid * 0.92);
      ctx.fillRect(px, mid - h, 1, h * 2);
    }

    // Played portion — brighter
    if (playedPx > 0) {
      ctx.fillStyle = color + playedAlpha;
      for (let px = 0; px < playedPx; px++) {
        const h = Math.max(1, peaks[px] * mid * 0.92);
        ctx.fillRect(px, mid - h, 1, h * 2);
      }
    }
  }, [audioBuffer, width, height, color, playedFraction, dim, trimStart, trimEnd]);

  return (
    <canvas
      ref={ref}
      style={{ display:"block", width:"100%", height:"100%", imageRendering:"pixelated" }}
    />
  );
}


// =============================================================================
// useHistory — undo/redo for tracks state
// =============================================================================
function useHistory(initial) {
  const past    = useRef([]);
  const future  = useRef([]);
  const [state, setStateRaw] = React.useState(initial);

  const setState = function (newState) {
    past.current.push(state);
    if (past.current.length > 50) past.current.shift(); // cap at 50
    future.current = [];
    setStateRaw(newState);
  };

  const undo = function () {
    if (past.current.length === 0) return;
    future.current.push(state);
    const prev = past.current.pop();
    setStateRaw(prev);
  };

  const redo = function () {
    if (future.current.length === 0) return;
    past.current.push(state);
    const next = future.current.pop();
    setStateRaw(next);
  };

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;

  return [state, setState, undo, redo, canUndo, canRedo];
}

// =============================================================================
// STUDIO SCREEN — proper DAW physics
// =============================================================================
//
//  Global coordinate system:
//    xPosition = time * PPS
//
//  Fixed playhead at left: PLAYHEAD_X (from right-column left edge)
//    currentTime = (scrollLeft + PLAYHEAD_X) / PPS
//
//  During playback:
//    container.scrollLeft = currentTime * PPS - PLAYHEAD_X
//
//  Manual scroll:
//    currentTime = (container.scrollLeft + PLAYHEAD_X) / PPS
//
// =============================================================================

// ── Error boundary — catches any render crash inside StudioScreen ──────────
// Without this, a single bad track/clip causes a blank white screen with no
// way out except force-closing the app.
class StudioErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false, errMsg: "" };
  }
  static getDerivedStateFromError(err) {
    return { crashed: true, errMsg: err && err.message ? err.message : String(err) };
  }
  componentDidCatch(err, info) {
    console.error("[BeatFinder] Studio crash:", err, info);
  }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ background:"#0a0a0a", minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32, fontFamily:"'DM Sans',sans-serif", gap:20 }}>
          <div style={{ fontSize:48 }}>⚠️</div>
          <div style={{ color:"white", fontWeight:800, fontSize:18, textAlign:"center" }}>Studio hit a problem</div>
          <div style={{ color:"#555", fontSize:13, textAlign:"center", lineHeight:1.6 }}>
            {this.state.errMsg || "An unexpected error occurred."}
          </div>
          <button
            onClick={function(){
              // Clear any corrupt project data from the active slot and reload
              try { localStorage.removeItem("bf_studio_active"); } catch(e){}
              window.location.reload();
            }}
            style={{ background:"#C026D3", border:"none", borderRadius:24, color:"white", fontWeight:800, fontSize:15, padding:"14px 32px", cursor:"pointer" }}
          >
            Restart Studio
          </button>
          <button
            onClick={function(){
              // Nuclear option — wipe saved projects so a corrupt one can't re-crash
              if (window.confirm("This will delete all saved projects. Continue?")) {
                try { localStorage.removeItem("bf_studio_projects"); } catch(e){}
                window.location.reload();
              }
            }}
            style={{ background:"none", border:"none", color:"#555", fontSize:13, cursor:"pointer" }}
          >
            Clear saved projects &amp; restart
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function StudioScreen({ user, onExit }) {

  // ── Constants ─────────────────────────────────────────────────
  const PPS         = 100;       // PIXELS_PER_SECOND — single source of truth
  const SIDEBAR_W   = 140;       // left column: track headers (locked horizontally)
  const TRACK_H     = 68;        // each track row height
  const RULER_H     = 32;        // timeline ruler height
  const PLAYHEAD_X  = 0;         // playhead flush with sidebar edge — no gap

  // ── Track array: [{id, name, type, audioBuffer, url, isMuted, isSoloed, startTime, duration}]
  const [tracks, setTracks, undoTracks, redoTracks, canUndo, canRedo] = useHistory([]);
  const [bpm,          setBpm]          = useState(120);
  const [timeSigNum,   setTimeSigNum]   = useState(4);
  const [zoom,         setZoom]         = useState(1);
  const [snapToGrid,   setSnapToGrid]   = useState(true);
  const [projectKey,   setProjectKey]   = useState("C major");
  const [projectName,  setProjectName]  = useState("New Project");

  // ── Playback ──────────────────────────────────────────────────
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [isRecording,  setIsRecording]  = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [loopEnabled,  setLoopEnabled]  = useState(false);
  const [loopIn,       setLoopIn]       = useState(0);
  const [loopOut,      setLoopOut]      = useState(0);

  // ── UI ────────────────────────────────────────────────────────
  const [contextMenu,  setContextMenu]  = useState(null); // {region, x, y}
  // ── Multi-select lasso ───────────────────────────────────────
  const [selBox,       setSelBox]       = useState(null);  // {x,y,w,h} in px relative to scroll container
  const [selClipIds,   setSelClipIds]   = useState(new Set()); // selected clip ids
  const selBoxRef      = useRef(null);   // live drag state {startX,startY,scrollX}
  const longPressRef   = useRef(null);   // setTimeout handle for long-press detection
  const [showSettings, setShowSettings] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showProjMenu, setShowProjMenu] = useState(false);
  const [showAddMenu,  setShowAddMenu]  = useState(false);
  const [renamingProj, setRenamingProj] = useState(false);
  const [unsavedAlert, setUnsavedAlert] = useState(false);
  const [isSaved,      setIsSaved]      = useState(false);
  const [savedProjects,setSavedProjects]= useState([]);
  const [saveStatus,   setSaveStatus]   = useState("");
  const [error,        setError]        = useState("");
  const [countIn,      setCountIn]      = useState(0);
  const [exporting,    setExporting]    = useState(false);
  const [exportMsg,    setExportMsg]    = useState("");
  const [bpmDetecting, setBpmDetecting] = useState(false);
  const [detectedBpm,  setDetectedBpm]  = useState(null);
  const [metronomeOn,  setMetronomeOn]  = useState(false);
  const [inputDevice,  setInputDevice]  = useState("default");
  const [recTrail,     setRecTrail]     = useState([]);
  const [recTrackId,   setRecTrackId]   = useState(null);
  const [showTSPicker, setShowTSPicker] = useState(false);
  const [showKeyPick,  setShowKeyPick]  = useState(false);
  const [draggingReg,  setDraggingReg]  = useState(null);
  const [showMixer,    setShowMixer]     = useState(false);
  const [fxTrackId,    setFxTrackId]     = useState(null);
  const [showTakes,    setShowTakes]     = useState(null);
  const [trimmingClip, setTrimmingClip]  = useState(null);
  const [monitoringOn, setMonitoringOn] = useState(false);
  const [monitorVol,   setMonitorVol]   = useState(0.8);
  const [headphonesIn, setHeadphonesIn] = useState(false);
  const [monitorWarn,  setMonitorWarn]  = useState("");
  const [showAutoPitch,setShowAutoPitch] = useState(false);
  const [autoPitch,    setAutoPitch]     = useState({ on:false, key:"C", scale:"major", speed:0.5 });
  const [lowLatency,   setLowLatency]    = useState(true);
  // "builtin" = iPhone built-in mic, "headset" = wired headset mic
  const [micSource,    setMicSource]     = useState("builtin");
  const [availableMics, setAvailableMics] = useState([]);

  // ── Refs ──────────────────────────────────────────────────────
  const actxRef         = useRef(null);
  const masterStartRef  = useRef(0);
  const playheadAtRef   = useRef(0);
  const animRef         = useRef(null);
  const scrollRef       = useRef(null);
  const playheadRef     = useRef(null); // direct DOM ref — updated without React re-render
  const trackContainerRef = useRef(null);
  const sidebarRef      = useRef(null);  // left column (locked horizontal)
  const mediaRecRef     = useRef(null);
  const chunksRef       = useRef([]);
  const recIntRef       = useRef(null);
  const recDurRef       = useRef(0);
  const recStartTimeRef = useRef(0);  // AudioContext-clock-derived timeline position at rec start
  const recStopActxTimeRef = useRef(null); // actx.currentTime snapshot at the moment stop is pressed
  const clipIdRef = useRef(null);
  const countTimerRef   = useRef(null);
  const metroRef        = useRef(null);
  const pinchRef        = useRef(null);
  const zoomRef         = useRef(zoom);
  const scheduledRef    = useRef([]);
  const isPlayingRef    = useRef(false);
  const tracksRef       = useRef([]);  // always mirrors tracks — gives doPlay a fresh snapshot

  // ── Input monitoring refs ──────────────────────────────────────
  const monitorStreamRef    = useRef(null);
  const monitorSrcRef       = useRef(null);
  const monitorGainRef      = useRef(null);
  const monitorAnalyserRef  = useRef(null);
  const monitorCtxRef       = useRef(null); // persistent AudioContext — never closed between sessions
  // Persistent mic stream — requested once on mount, reused for both monitoring and recording
  const micStreamRef        = useRef(null);
  const [micReady,      setMicReady]      = useState(false);
  const [micDenied,     setMicDenied]     = useState(false);
  // effectivePPS changes with zoom — keep a ref so lasso onMove closure can read it
  // MUST be declared here (before line 4743 uses it) to avoid "uninitialized variable" crash
  const effectivePPSRef = useRef(100);
  const lassoContainerRef = useRef(null); // ref to the DAW wrapper — lasso overlay is positioned inside this

  useEffect(function () { zoomRef.current = zoom; }, [zoom]);
  useEffect(function () { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(function () { tracksRef.current = tracks; }, [tracks]);

  // Set initial position — Bar1 under centred playhead at t=0
  useEffect(function () {
    if (scrollRef.current && trackContainerRef.current) {
      if(scrollRef.current) scrollRef.current.scrollLeft = 0;
    }
  }, []);

  // ── Lazy mic permission — requested only when user clicks Record or + Vocal ──
  // We do NOT request on mount. Request is made inside startCountIn/addVocalTrack
  // so the orange mic indicator only appears during actual recording.
  // Browser caches the grant so it never asks twice.
  const requestMicPermissionOnce = async function () {
    if (micReady) return true;
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop — we just needed the permission grant
      stream.getTracks().forEach(function (t) { t.stop(); });
      setMicReady(true);
      return true;
    } catch (e) {
      setMicDenied(true);
      if (e.name === "NotAllowedError") {
        setError("Mic access denied. Go to Settings → Safari → Microphone → Allow.");
      }
      return false;
    }
  };

  // ── Computed ──────────────────────────────────────────────────
  const effectivePPS = PPS * zoom;
  effectivePPSRef.current = effectivePPS; // keep ref in sync for lasso closure
  const spb          = 60 / bpm;
  const spBar        = spb * timeSigNum;
  const totalDur = Math.max(60, currentTime + 30, ...tracks.map(function(t){
    const clips = t.clips || (t.audioBuffer ? [{startTime:t.startTime||0, duration:t.audioBuffer.duration, trimEnd:t.audioBuffer.duration}] : []);
    return Math.max(0, ...clips.map(function(cl){ return (cl.startTime||0)+((cl.trimEnd||cl.duration||0)-(cl.trimStart||0)); }));
  }));
  const totalW       = totalDur * effectivePPS + 300;
  const numBars      = Math.ceil(totalDur / spBar) + 2;
  // Beat tracks always get purple/magenta. Vocal tracks cycle through bright high-contrast colours.
  const COLORS       = ["#3B82F6","#22C55E","#F59E0B","#EC4899","#8B5CF6","#06B6D4","#EF4444","#F97316"];
  const VOCAL_COLORS = ["#38BDF8","#34D399","#FB923C","#F472B6","#A78BFA","#22D3EE","#F87171","#FBBF24"];
  const hasContent   = tracks.length > 0;

  // ── Load projects ─────────────────────────────────────────────
  useEffect(function () {
    try { setSavedProjects(JSON.parse(localStorage.getItem("bf_studio_projects") || "[]")); } catch (e) {}
  }, []);

  // ── AudioContext ──────────────────────────────────────────────
  const getActx = function () {
    if (!actxRef.current || actxRef.current.state === "closed") {
      actxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (actxRef.current.state === "suspended") actxRef.current.resume();
    return actxRef.current;
  };

  // ── Headphone detection + mic enumeration ────────────────────
  // Returns { headphonesConnected, mics: [{deviceId, label, isBuiltIn}] }
  // iOS Safari only reveals real device labels after mic permission is granted.
  // We identify built-in vs headset by label keywords; fallback to sentinel IDs.
  const checkHeadphones = async function () {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter(function(d){ return d.kind === "audiooutput"; });
      const inputs  = devices.filter(function(d){ return d.kind === "audioinput"; });

      const hp = outputs.some(function(d){
        const l = (d.label||"").toLowerCase();
        return l.includes("headphone")||l.includes("earphone")||l.includes("airpods")||l.includes("bluetooth")||l.includes("headset")||l.includes("wired");
      });
      const ok = hp || outputs.length === 0 || outputs.every(function(d){ return !d.label; });
      setHeadphonesIn(ok);

      // Classify mic inputs
      // iOS exposes labels like "iPhone Microphone" and "Headset Microphone" after permission
      let builtInId   = null; // real deviceId of iPhone built-in mic
      let headsetId   = null; // real deviceId of wired headset mic

      inputs.forEach(function(d) {
        if (!d.deviceId) return;
        const l = (d.label||"").toLowerCase();
        const isHeadset = l.includes("headset")||l.includes("wired")||l.includes("external");
        const isBuiltIn = l.includes("iphone")||l.includes("built-in")||l.includes("internal")||l.includes("front");
        if (isHeadset && !headsetId) headsetId = d.deviceId;
        else if (isBuiltIn && !builtInId) builtInId = d.deviceId;
        // "default" deviceId = whatever iOS is currently routing (changes with plug/unplug)
      });

      // Build the two-option list
      // "builtin" sentinel → we'll resolve to the actual built-in deviceId at stream time
      // "headset" sentinel → headset mic (or iOS auto-route when no real id found)
      const mics = [
        { deviceId: builtInId || "builtin", label: "📱 iPhone Mic", isBuiltIn: true },
        { deviceId: headsetId || "headset", label: "🎙 Headset Mic", isBuiltIn: false },
      ];
      setAvailableMics(mics);
      return { headphonesConnected: ok, mics };
    } catch(e){ setHeadphonesIn(true); return { headphonesConnected: true, mics: [] }; }
  };

  useEffect(function () {
    checkHeadphones();
    navigator.mediaDevices.addEventListener("devicechange", checkHeadphones);
    return function(){ navigator.mediaDevices.removeEventListener("devicechange", checkHeadphones); };
  }, []);

  // Auto-switch mic source when headphones are plugged in / pulled out
  // and stop monitoring if headphones pulled while monitoring
  const prevHeadphonesRef = useRef(false);
  useEffect(function () {
    if (headphonesIn && !prevHeadphonesRef.current) {
      // Headphones just plugged in → switch to headset mic automatically
      setMicSource("headset");
      if (monitoringOn) {
        stopMonitoring();
        setTimeout(function(){ startMonitoring(undefined, "headset"); }, 150);
      }
    } else if (!headphonesIn && prevHeadphonesRef.current) {
      // Headphones pulled → switch back to iPhone mic and stop monitoring
      setMicSource("builtin");
      if (monitoringOn) {
        stopMonitoring();
        setMonitorWarn("⚠️ Headphones disconnected — monitoring stopped to prevent feedback.");
      }
    }
    prevHeadphonesRef.current = headphonesIn;
  }, [headphonesIn]);

  // ── Shared mic constraint builder ────────────────────────────
  // Resolves the correct deviceId for "builtin" or "headset" on iOS and returns
  // a getUserMedia audio constraints object. Used by both monitoring and recording
  // so they always use the same mic source the user has selected.
  const buildMicConstraints = async function (wantSource, extraConstraints) {
    const base = Object.assign({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl:  false,
      channelCount:     1,
    }, extraConstraints || {});

    const wantBuiltIn = wantSource === "builtin" || wantSource === "default";

    if (wantBuiltIn) {
      // Try to get the real hardware deviceId for the built-in iPhone mic
      let builtInDeviceId = null;
      const builtInEntry = availableMics.find(function(m){ return m.isBuiltIn; });
      if (builtInEntry && builtInEntry.deviceId && builtInEntry.deviceId !== "builtin") {
        builtInDeviceId = builtInEntry.deviceId;
      }
      if (!builtInDeviceId) {
        // Labels hidden — request permission then re-enumerate to get real IDs
        try {
          const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
          tmp.getTracks().forEach(function(t){ t.stop(); });
          const freshDevices = await navigator.mediaDevices.enumerateDevices();
          freshDevices.filter(function(d){ return d.kind === "audioinput"; }).forEach(function(d){
            const l = (d.label||"").toLowerCase();
            if (!builtInDeviceId && (l.includes("iphone")||l.includes("built-in")||l.includes("internal"))) {
              builtInDeviceId = d.deviceId;
            }
          });
        } catch(e) {}
      }
      base.deviceId = { exact: builtInDeviceId || "default" };
    } else {
      // Headset mic — use known deviceId or let iOS auto-route (no constraint = headset when plugged in)
      const headsetEntry = availableMics.find(function(m){ return !m.isBuiltIn; });
      const headsetId = headsetEntry && headsetEntry.deviceId !== "headset" ? headsetEntry.deviceId : null;
      if (headsetId) base.deviceId = { exact: headsetId };
      // No deviceId → iOS routes to headset automatically when plugged in
    }
    return base;
  };

  // ── Input Monitoring ──────────────────────────────────────────
  // ZERO-LATENCY DESIGN:
  //   • AudioContext is created once and kept alive (no re-init cost on each toggle)
  //   • Mic stream is kept alive via micStreamRef and reused (no getUserMedia round-trip on toggle)
  //   • No sampleRate override — OS native rate avoids hidden resampler latency
  //   • Analyser is a side-branch off gain (not in the signal path) so it adds zero latency
  //   • Graph: mic → merger (mono→stereo) → gain → destination
  //                                              ↘ analyser (side branch, read-only)
  // forceMicSource: pass "builtin" or "headset" directly to avoid reading stale state.
  const startMonitoring = async function (forceLowLatency, forceMicSource) {
    if (monitorSrcRef.current) return; // already wired up
    setMonitorWarn("");

    const check = await checkHeadphones();
    const safe  = check.headphonesConnected !== undefined ? check.headphonesConnected : check;
    if (!safe) {
      setMonitorWarn("⚠️ Plug in headphones — monitoring disabled to prevent feedback.");
      return;
    }

    const useMicSource = forceMicSource !== undefined ? forceMicSource : micSource;
    const audioConstraints = await buildMicConstraints(useMicSource);

    try {
      // ── Reuse existing mic stream — avoids getUserMedia round-trip latency on every toggle ──
      let stream = micStreamRef.current;
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        micStreamRef.current = stream;
      }
      monitorStreamRef.current = stream;

      // ── Reuse or create persistent monitoring AudioContext ──
      // Never closed between sessions — eliminates ~20–50ms re-init cost on each toggle.
      // No sampleRate override: letting the OS use its native rate (usually 44100 on iOS)
      // avoids a hidden software resampler that adds latency.
      if (!monitorCtxRef.current || monitorCtxRef.current.state === "closed") {
        monitorCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({
          latencyHint: "interactive",
        });
      }
      const mCtx = monitorCtxRef.current;
      if (mCtx.state === "suspended") await mCtx.resume();

      const src    = mCtx.createMediaStreamSource(stream);
      const merger = mCtx.createChannelMerger(2);
      const gain   = mCtx.createGain();
      gain.gain.value = monitorVol;

      // Analyser as a SIDE BRANCH off gain — not in the audio path, so zero added latency
      const analyser = mCtx.createAnalyser();
      analyser.fftSize = 256;

      // Duplicate mono mic to both L and R channels
      src.connect(merger, 0, 0);
      src.connect(merger, 0, 1);
      merger.connect(gain);
      gain.connect(mCtx.destination);
      gain.connect(analyser); // side branch — read-only, not in the output chain

      monitorSrcRef.current      = src;
      monitorGainRef.current     = gain;
      monitorAnalyserRef.current = analyser;
      setMonitoringOn(true);
    } catch (e) {
      monitorStreamRef.current = null;
      setMonitorWarn("Could not start monitoring: " + (e.message || e.name));
    }
  };

  const stopMonitoring = function () {
    // Ramp gain to zero first to avoid a click/pop
    if (monitorGainRef.current && monitorCtxRef.current) {
      monitorGainRef.current.gain.setTargetAtTime(0, monitorCtxRef.current.currentTime, 0.02);
    }
    setTimeout(function () {
      // Disconnect all Web Audio nodes
      try { monitorGainRef.current     && monitorGainRef.current.disconnect(); }     catch(e) {}
      try { monitorSrcRef.current      && monitorSrcRef.current.disconnect(); }      catch(e) {}
      try { monitorAnalyserRef.current && monitorAnalyserRef.current.disconnect(); } catch(e) {}

      // ── Fully stop the mic stream tracks ──────────────────────────────────
      // On iOS, any live getUserMedia track holds the audio session in "recording mode"
      // which forces a larger output buffer and adds latency to ALL playback — including
      // the beat. Stopping the tracks releases the session back to playback-only mode.
      // Only do this when not actively recording.
      if (monitorStreamRef.current && !mediaRecRef.current) {
        monitorStreamRef.current.getTracks().forEach(function(t) { t.stop(); });
        micStreamRef.current = null; // clear so next toggle opens a fresh stream
      }

      monitorStreamRef.current   = null;
      monitorSrcRef.current      = null;
      monitorGainRef.current     = null;
      monitorAnalyserRef.current = null;

      // Suspend (not close) the AudioContext so it wakes instantly on next toggle
      if (monitorCtxRef.current && monitorCtxRef.current.state === "running") {
        monitorCtxRef.current.suspend().catch(function(){});
      }
    }, 60);
    setMonitoringOn(false);
  };

  useEffect(function(){
    if (monitorGainRef.current && monitorCtxRef.current) {
      monitorGainRef.current.gain.setTargetAtTime(monitorVol, monitorCtxRef.current.currentTime, 0.01);
    }
  }, [monitorVol]);

  // ── Scroll container helpers ──────────────────────────────────
  // With paddingLeft=PLAYHEAD_X on inner div, Bar1 (x=0) sits exactly under the playhead.
  // scrollLeft=0 → t=0 (Bar1 under playhead). scrollLeft=t*effectivePPS → t plays through.
  const getTimeFromScroll = function () {
    const el = scrollRef.current;
    if (!el) return 0;
    return Math.max(0, el.scrollLeft / effectivePPS);
  };

  // Set the waveform container's translateX so Bar1 is under the centred playhead
  // Formula: offsetX = colWidth/2 - t * PPS
  // At t=0: offsetX = colWidth/2  → Bar1 is at the centre
  // At t=5s: offsetX = colWidth/2 - 500  → content scrolled 500px left
  const setOffsetForTime = function (t) {
    // Now uses scrollLeft — translateX is gone
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, t * effectivePPS);
  };

  // Move playhead div directly — no React re-render, no jitter
  const updatePlayheadDOM = function (t, scrollLeft) {
    const ph = playheadRef.current;
    if (!ph) return;
    const sl  = scrollLeft !== undefined ? scrollLeft : (scrollRef.current ? scrollRef.current.scrollLeft : 0);
    const px  = SIDEBAR_W + t * effectivePPS - sl;
    ph.style.left = px + "px";
  };

  // ── RAF playback loop ─────────────────────────────────────────
  // Mutates DOM transform directly — no React re-render per frame = smooth 60fps
  useEffect(function () {
    if (!isPlaying) { cancelAnimationFrame(animRef.current); return; }
    var lastUIUpdate = 0;
    const tick = function (ts) {
      const actx = actxRef.current;
      if (!actx) return;
      const elapsed = actx.currentTime - masterStartRef.current;
      const t       = playheadAtRef.current + elapsed;
      // Drive scroll + update playhead directly on DOM — no React re-render per frame
      const el = scrollRef.current;
      if (el) {
        el.scrollLeft = Math.max(0, t * effectivePPS);
        updatePlayheadDOM(t, el.scrollLeft);
      }
      // Update timer display at ~30fps only
      if (!lastUIUpdate || ts - lastUIUpdate > 33) {
        setCurrentTime(t);
        lastUIUpdate = ts;
      }
      if (loopEnabled && loopOut > loopIn && t >= loopOut) {
        // Restart audio from loopIn, then let the RAF keep ticking
        stopAll();
        doPlay(loopIn);
        setCurrentTime(loopIn);
        setIsPlaying(true);
        animRef.current = requestAnimationFrame(tick);
        return;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return function () { cancelAnimationFrame(animRef.current); };
  }, [isPlaying, effectivePPS, loopEnabled, loopIn, loopOut]);

  // ── Audio engine — gain nodes persist so mute/solo works in real-time ──
  const gainNodesRef  = useRef({});   // trackId → GainNode
  const masterGainRef = useRef(null); // single master output
  // ── Live FX nodes — updated in real-time without restarting playback ──
  // fxNodesRef.current[trackId] = { eq:{hpf,low,mid,high,lpf}, comp, reverbDry, reverbWet, preDelay, makeupGain }
  const fxNodesRef    = useRef({});   // trackId → live audio node references

  const getOrCreateMaster = function () {
    const actx = getActx();
    if (!masterGainRef.current || masterGainRef.current.context !== actx) {
      masterGainRef.current = actx.createGain();
      masterGainRef.current.gain.value = 1;
      masterGainRef.current.connect(actx.destination);
    }
    return masterGainRef.current;
  };

  // Apply mute/solo to all live gain nodes without restarting playback
  const applyGains = function (updatedTracks) {
    const tList = updatedTracks || tracks;
    const hasSolo = tList.some(function(t){ return t.isSoloed; });
    tList.forEach(function(t){
      const g = gainNodesRef.current[t.id];
      if (!g) return;
      const shouldPlay = !t.isMuted && (!hasSolo || t.isSoloed);
      g.gain.setTargetAtTime(shouldPlay ? 1 : 0, getActx().currentTime, 0.01);
    });
  };

  // ── Real-time FX update — called by upd() whenever FX params change while playing ──
  // Directly mutates live Web Audio nodes so changes are heard immediately with no restart.
  const applyFxLive = function (trackId, effects) {
    const actx = actxRef.current;
    if (!actx || actx.state === "closed") return;
    if (!isPlayingRef.current) return;
    const live = fxNodesRef.current[trackId];
    if (!live) return;
    const fx = effects || {};
    const T = 0.008; // 8ms ramp — smooth, inaudible transition
    const now = actx.currentTime;

    // ── EQ ──
    if (live.eq) {
      const eq = fx.eq || {};
      const on = !!(fx.eq && fx.eq.on);
      live.eq.hpf.frequency.setTargetAtTime(on ? (eq.hpfFreq||80)    : 20,    now, T);
      live.eq.hpf.Q.setTargetAtTime(        on ? (eq.hpfQ||0.707)    : 0.001, now, T);
      live.eq.low.frequency.setTargetAtTime(on ? (eq.lowFreq||200)   : 200,   now, T);
      live.eq.low.gain.setTargetAtTime(     on ? (eq.low||0)         : 0,     now, T);
      live.eq.mid.frequency.setTargetAtTime(on ? (eq.midFreq||1000)  : 1000,  now, T);
      live.eq.mid.gain.setTargetAtTime(     on ? (eq.mid||0)         : 0,     now, T);
      live.eq.mid.Q.setTargetAtTime(        on ? (eq.midQ||1.0)      : 1.0,   now, T);
      live.eq.high.frequency.setTargetAtTime(on ? (eq.highFreq||8000) : 8000, now, T);
      live.eq.high.gain.setTargetAtTime(     on ? (eq.high||0)        : 0,    now, T);
      live.eq.lpf.frequency.setTargetAtTime(on ? (eq.lpfFreq||18000) : 22050, now, T);
      live.eq.lpf.Q.setTargetAtTime(        on ? (eq.lpfQ||0.707)    : 0.001, now, T);
    }

    // ── Compressor ──
    if (live.comp) {
      const compOn = !!(fx.compressor && fx.compressor.on);
      live.comp.threshold.setTargetAtTime(compOn ? (fx.compressor.threshold ?? -24) : 0,     now, T);
      live.comp.ratio.setTargetAtTime(    compOn ? (fx.compressor.ratio ?? 4)       : 1,     now, T);
      live.comp.attack.setTargetAtTime(   compOn ? (fx.compressor.attack ?? 0.003)  : 0.003, now, T);
      live.comp.release.setTargetAtTime(  compOn ? (fx.compressor.release ?? 0.25)  : 0.25,  now, T);
    }

    // ── Makeup gain ──
    if (live.makeupGain) {
      const mgOn = !!(fx.compressor && fx.compressor.on && fx.compressor.makeupGain);
      const mgVal = mgOn ? Math.pow(10, (fx.compressor.makeupGain || 0) / 20) : 1;
      live.makeupGain.gain.setTargetAtTime(mgVal, now, T);
    }

    // ── Reverb wet/dry ──
    if (live.reverb) {
      const revOn = !!(fx.reverb && fx.reverb.on);
      const wet = revOn ? (fx.reverb.wet || 0.25) : 0;
      live.reverb.wetG.gain.setTargetAtTime(wet,     now, T);
      live.reverb.dryG.gain.setTargetAtTime(1 - wet, now, T);
      if (revOn && fx.reverb.preDelay !== undefined) {
        live.reverb.preDelay.delayTime.setTargetAtTime(fx.reverb.preDelay / 1000, now, T);
      }
      // Note: room size changes the IR buffer — requires a brief rebuild only when roomSize changes
      // For smooth real-time feel, we defer that to the next play() call. Wet/dry is instant.
    }
  };

  // Wrap toggleMute/toggleSolo to also update gains live
  const toggleMute = function (id) {
    setTracks(function(prev){
      const next = prev.map(function(t){ return t.id===id?{...t,isMuted:!t.isMuted}:t; });
      applyGains(next);
      return next;
    });
    setIsSaved(false);
  };

  const toggleSolo = function (id) {
    setTracks(function(prev){
      const next = prev.map(function(t){ return t.id===id?{...t,isSoloed:!t.isSoloed}:t; });
      applyGains(next);
      return next;
    });
    setIsSaved(false);
  };

  // ── Stop all audio nodes — hard stop, no glitch ──────────────
  const stopAll = function () {
    cancelAnimationFrame(animRef.current);
    // Stop and disconnect every scheduled source node immediately
    scheduledRef.current.forEach(function (s) {
      try { s.stop(0); } catch (e) {} // stop(0) = immediate
      try { s.disconnect(); } catch (e) {}
    });
    scheduledRef.current = [];
    // Disconnect gain nodes so nothing bleeds through on next play
    Object.values(gainNodesRef.current).forEach(function (g) {
      try { g.disconnect(); } catch (e) {}
    });
    gainNodesRef.current = {};
    // Clear live FX node refs
    fxNodesRef.current = {};
    // Ramp master gain to 0 instantly to cut any tail
    if (masterGainRef.current) {
      try { masterGainRef.current.gain.cancelScheduledValues(0); masterGainRef.current.gain.value = 0; } catch (e) {}
      masterGainRef.current = null; // force recreate on next play
    }
  };

  // ── Play from a given time — all tracks share master destination ──
  const doPlay = function (fromTime) {
    stopAll();
    const actx   = getActx();
    const master = getOrCreateMaster();
    // Schedule audio 50ms ahead so all tracks start at exactly the same moment.
    // masterStartRef MUST equal `now` (the scheduled start), NOT actx.currentTime.
    // Recording timing: playheadAtRef + (startActxTime - masterStartRef).
    // If masterStartRef is 50ms behind `now`, every clip is placed 50ms too early
    // on the timeline, causing it to play back late (behind the beat) on playback.
    const now    = actx.currentTime + 0.05;
    masterStartRef.current = now;
    playheadAtRef.current  = fromTime;

    const hasSolo = tracksRef.current.some(function(t){ return t.isSoloed; });

    // Build Web Audio effects chain for a track, return the gain node for mute/solo control
    const buildChain = function (track) {
      let node = master;
      const fx = track.effects || {};
      const liveNodes = {}; // collect refs for real-time updates

      // Pan
      if (actx.createStereoPanner) {
        const panner = actx.createStereoPanner();
        panner.pan.value = track.pan || 0;
        panner.connect(node); node = panner;
        liveNodes.panner = panner;
      }

      // Makeup gain (post-compressor) — always create so we can update it live
      const mg = actx.createGain();
      mg.gain.value = (fx.compressor && fx.compressor.on && fx.compressor.makeupGain)
        ? Math.pow(10, (fx.compressor.makeupGain || 0) / 20) : 1;
      mg.connect(node); node = mg;
      liveNodes.makeupGain = mg;

      // Track volume
      const volGain = actx.createGain();
      const shouldPlay = !track.isMuted && (!hasSolo || track.isSoloed);
      volGain.gain.value = (track.volume ?? 1) * (shouldPlay ? 1 : 0);
      volGain.connect(node); node = volGain;
      gainNodesRef.current[track.id] = volGain;

      // ── Reverb — always built so wet/dry can be morphed live ──
      // We always allocate the reverb graph; when off, wetG = 0 and dryG = 1
      {
        const sr = actx.sampleRate;
        const preDelaySec = (fx.reverb && fx.reverb.preDelay) ? fx.reverb.preDelay / 1000 : 0;
        const preDelay = actx.createDelay(0.2);
        preDelay.delayTime.value = preDelaySec;
        const roomSize = (fx.reverb && fx.reverb.on) ? (fx.reverb.roomSize || 0.8) : 0.8;
        const len = Math.round(sr * roomSize * 3);
        const ir = actx.createBuffer(2, len, sr);
        for (let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.5);}
        const conv = actx.createConvolver(); conv.buffer = ir;
        const wetVal = (fx.reverb && fx.reverb.on) ? (fx.reverb.wet || 0.25) : 0;
        const dryG = actx.createGain(); dryG.gain.value = 1 - wetVal;
        const wetG = actx.createGain(); wetG.gain.value = wetVal;
        const mix  = actx.createGain();
        dryG.connect(mix); wetG.connect(mix); mix.connect(node);
        preDelay.connect(conv); conv.connect(wetG);
        const split = actx.createGain(); split.gain.value = 1;
        split.connect(dryG); split.connect(preDelay);
        node = split;
        liveNodes.reverb = { dryG, wetG, preDelay, conv };
      }

      // ── 5-band parametric EQ — always built; bypass = unity gain when off ──
      {
        const eq = fx.eq || {};
        const T  = 0.005;
        const eqOn = !!(fx.eq && fx.eq.on);

        const hpf = actx.createBiquadFilter();
        hpf.type = "highpass";
        hpf.frequency.setTargetAtTime(eqOn ? (eq.hpfFreq||80)   : 20,    actx.currentTime, T);
        hpf.Q.setTargetAtTime(        eqOn ? (eq.hpfQ||0.707)   : 0.001, actx.currentTime, T);

        const low = actx.createBiquadFilter();
        low.type = "lowshelf";
        low.frequency.setTargetAtTime(eqOn ? (eq.lowFreq||200)  : 200,   actx.currentTime, T);
        low.gain.setTargetAtTime(     eqOn ? (eq.low||0)        : 0,     actx.currentTime, T);

        const mid = actx.createBiquadFilter();
        mid.type = "peaking";
        mid.frequency.setTargetAtTime(eqOn ? (eq.midFreq||1000) : 1000,  actx.currentTime, T);
        mid.gain.setTargetAtTime(     eqOn ? (eq.mid||0)        : 0,     actx.currentTime, T);
        mid.Q.setTargetAtTime(        eqOn ? (eq.midQ||1.0)     : 1.0,   actx.currentTime, T);

        const high = actx.createBiquadFilter();
        high.type = "highshelf";
        high.frequency.setTargetAtTime(eqOn ? (eq.highFreq||8000) : 8000, actx.currentTime, T);
        high.gain.setTargetAtTime(     eqOn ? (eq.high||0)        : 0,    actx.currentTime, T);

        const lpf = actx.createBiquadFilter();
        lpf.type = "lowpass";
        lpf.frequency.setTargetAtTime(eqOn ? (eq.lpfFreq||18000) : 22050, actx.currentTime, T);
        lpf.Q.setTargetAtTime(        eqOn ? (eq.lpfQ||0.707)    : 0.001, actx.currentTime, T);

        // Chain: hpf → low → mid → high → lpf → [rest of chain]
        lpf.connect(node); high.connect(lpf); mid.connect(high); low.connect(mid); hpf.connect(low);
        node = hpf;
        liveNodes.eq = { hpf, low, mid, high, lpf };
      }

      // ── Compressor — always built; bypass when off via extreme settings ──
      {
        const comp = actx.createDynamicsCompressor();
        const compOn = !!(fx.compressor && fx.compressor.on);
        comp.threshold.value = compOn ? (fx.compressor.threshold ?? -24) : 0;
        comp.ratio.value     = compOn ? (fx.compressor.ratio ?? 4)       : 1;
        comp.attack.value    = compOn ? (fx.compressor.attack ?? 0.003)  : 0.003;
        comp.release.value   = compOn ? (fx.compressor.release ?? 0.25)  : 0.25;
        comp.connect(node); node = comp;
        liveNodes.comp = comp;
      }

      // Auto-Pitch — per-track pitch shift using playback rate scaling
      if (fx.pitch && fx.pitch.on) {
        node._pitchSemitones = fx.pitch.semitones || 0;
      }

      // Store live nodes for this track
      fxNodesRef.current[track.id] = liveNodes;

      return node; // clips connect here
    };

    const scheduleClip = function (track, clip, entryNode) {
      if (clip.active === false || !clip.audioBuffer) return;
      try {
        const buf      = clip.audioBuffer;
        const trimS    = clip.trimStart || 0;
        const trimE    = clip.trimEnd   || buf.duration;
        const trimDur  = Math.max(0, trimE - trimS);
        if (trimDur <= 0) return;
        const clipStart = clip.startTime || 0;
        const clipEnd   = clipStart + trimDur;
        if (clipEnd <= fromTime) return;

        const src = actx.createBufferSource();
        src.buffer = buf;

        // Apply pitch shift via playbackRate — 2^(semitones/12) maps semitones to rate
        // This shifts pitch but also changes tempo proportionally (tape-style).
        // For vocals: keep semitones small (±2-3) to stay natural.
        const semitones = entryNode._pitchSemitones || 0;
        if (semitones !== 0) {
          src.playbackRate.value = Math.pow(2, semitones / 12);
        }

        src.connect(entryNode);

        let when, bufOff;
        if (fromTime <= clipStart) { when=now+(clipStart-fromTime); bufOff=trimS; }
        else                       { when=now; bufOff=trimS+(fromTime-clipStart); }
        const remain = (trimS + trimDur) - bufOff;
        if (remain > 0) { src.start(when, bufOff, remain); scheduledRef.current.push(src); }
      } catch(e) {}
    };

    tracksRef.current.forEach(function(track) {
      const clips = track.clips && track.clips.length > 0
        ? track.clips
        : track.audioBuffer // legacy flat model
          ? [{ id:"lg", audioBuffer:track.audioBuffer, url:track.url, startTime:track.startTime||0, duration:track.audioBuffer.duration, trimStart:0, trimEnd:track.audioBuffer.duration, active:true }]
          : [];
      if (clips.length === 0) return;
      const entryNode = buildChain(track);
      clips.forEach(function(clip){ scheduleClip(track, clip, entryNode); });
    });
  };

  const togglePlay = function () {
    if (isPlaying) {
      stopAll();
      setIsPlaying(false);
      // Freeze playhead at current position — don't jump
      playheadAtRef.current = currentTime;
    } else {
      doPlay(currentTime);
      setIsPlaying(true);
    }
  };

  const rewind = function () {
    stopAll();
    setIsPlaying(false);
    const t = loopEnabled ? loopIn : 0;
    setCurrentTime(t);
    setOffsetForTime(t);
    playheadAtRef.current = t;
    masterStartRef.current = 0;
  };

  const stopRecording = function () {
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
      // Capture the AudioContext clock the instant stop is called —
      // this is used in mr.onstop to derive the true clip end time.
      const actx = actxRef.current;
      recStopActxTimeRef.current = actx ? actx.currentTime : null;
      mediaRecRef.current.stop();
    }
    clearInterval(recIntRef.current);
    clipIdRef.current = null;
    mediaRecRef.current = null;
    stopAll();
    setIsPlaying(false);
  };

  // ── Ruler tap/drag → set loop in/out points ONLY ─────────────
  // Tapping the ruler only creates/adjusts the loop region.
  // It never seeks the playhead or interrupts playback.
  // First tap on empty area: sets loop-in, second tap to the right: sets loop-out.
  // Dragging: if tap lands within 0.3s of loopIn → drag loopIn,
  //           if tap lands within 0.3s of loopOut → drag loopOut,
  //           otherwise start a new loop region from that point.
  const rulerDragRef = useRef(null); // { mode: "in"|"out"|"new", startX, startT }

  const rulerTimeFromClientX = function (clientX) {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect  = el.getBoundingClientRect();
    const laneX = clientX - rect.left - SIDEBAR_W + el.scrollLeft;
    return Math.max(0, laneX / effectivePPS);
  };

  // Ruler always snaps to the nearest bar boundary for clean loop regions.
  // Falls back to beat-snap when bars are very short (high BPM / many beats).
  const snapToBar = function (t) {
    const grid = spBar > 0 ? spBar : spb;
    return Math.max(0, Math.round(t / grid) * grid);
  };

  const handleRulerMouseDown = function (e) {
    e.preventDefault();
    const raw = rulerTimeFromClientX(e.clientX);
    const t   = snapToBar(raw);
    // Snap the grab threshold to one bar so handles feel magnetic
    const grabThresh = Math.max(0.3, spBar * 0.5);
    let mode = "new";
    if (Math.abs(raw - loopIn)  < grabThresh) mode = "in";
    else if (Math.abs(raw - loopOut) < grabThresh) mode = "out";
    rulerDragRef.current = { mode, startX: e.clientX, startT: t };

    if (mode === "new") { setLoopEnabled(true); setLoopIn(t); setLoopOut(snapToBar(t + spBar)); }

    const onMove = function (me) {
      const nt = snapToBar(rulerTimeFromClientX(me.clientX));
      if (rulerDragRef.current.mode === "in")  { setLoopIn(Math.min(nt, loopOut - spBar)); }
      else if (rulerDragRef.current.mode === "out") { setLoopOut(Math.max(nt, loopIn + spBar)); }
      else {
        if (nt > rulerDragRef.current.startT) setLoopOut(Math.max(nt, rulerDragRef.current.startT + spBar));
        else { setLoopIn(Math.min(nt, rulerDragRef.current.startT)); setLoopOut(rulerDragRef.current.startT); }
      }
    };
    const onUp = function () {
      rulerDragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  };

  const handleRulerTouchStart = function (e) {
    e.preventDefault();
    const raw = rulerTimeFromClientX(e.touches[0].clientX);
    const t   = snapToBar(raw);
    const grabThresh = Math.max(0.3, spBar * 0.5);
    let mode = "new";
    if (Math.abs(raw - loopIn)  < grabThresh) mode = "in";
    else if (Math.abs(raw - loopOut) < grabThresh) mode = "out";
    rulerDragRef.current = { mode, startT: t };

    if (mode === "new") { setLoopEnabled(true); setLoopIn(t); setLoopOut(snapToBar(t + spBar)); }
  };

  const handleRulerTouchMove = function (e) {
    e.preventDefault();
    if (!rulerDragRef.current) return;
    const nt = snapToBar(rulerTimeFromClientX(e.touches[0].clientX));
    if (rulerDragRef.current.mode === "in")  { setLoopIn(Math.min(nt, loopOut - spBar)); }
    else if (rulerDragRef.current.mode === "out") { setLoopOut(Math.max(nt, loopIn + spBar)); }
    else {
      if (nt > rulerDragRef.current.startT) setLoopOut(Math.max(nt, rulerDragRef.current.startT + spBar));
      else { setLoopIn(Math.min(nt, rulerDragRef.current.startT)); setLoopOut(rulerDragRef.current.startT); }
    }
  };

  const handleScroll = function (e) {
    // Vertical scroll syncs sidebar only
    if (sidebarRef.current) sidebarRef.current.scrollTop = e.target.scrollTop;
  };

  // ── Snap ──────────────────────────────────────────────────────
  const snapSecs = function (t) {
    if (!snapToGrid) return Math.max(0, t);
    return Math.max(0, Math.round(t / spb) * spb);
  };

  // ── Track/clip helpers (clips[] model) ───────────────────────
  const defaultEffects = function () {
    return {
      reverb:     { on:false, wet:0.25, roomSize:0.8 },
      eq:         { on:false, low:0, mid:0, high:0 },
      compressor: { on:false, threshold:-24, ratio:4, attack:0.003, release:0.25 },
    };
  };

  const addTrackObj = function (obj) {
    // Ensure every track has a color — vocals get VOCAL_COLORS, others get COLORS
    const fallbackColor = (obj.type === "vocal") ? VOCAL_COLORS[0] : COLORS[0];
    const full = { volume:1, pan:0, effects:defaultEffects(), clips:[], color:fallbackColor, ...obj };
    // If old flat model passed in, wrap audioBuffer as a clip
    if (full.audioBuffer && full.clips.length === 0) {
      const buf = full.audioBuffer;
      full.clips = [{ id:full.id+"_c0", audioBuffer:buf, url:full.url, blob:full.blob,
        startTime:full.startTime||0, duration:buf.duration, trimStart:0, trimEnd:buf.duration,
        label:"Main", active:true }];
      delete full.audioBuffer; delete full.url; delete full.blob; delete full.startTime; delete full.duration;
    }
    setTracks(function (prev) { return [...prev, full]; });
    setIsSaved(false);
  };

  const updateTrack = function (id, patch) {
    setTracks(function (prev) { return prev.map(function(t){ return t.id===id?{...t,...patch}:t; }); });
    setIsSaved(false);
  };

  const updateClip = function (trackId, clipId, patch) {
    setTracks(function (prev) {
      return prev.map(function(t) {
        if (t.id !== trackId) return t;
        return { ...t, clips: t.clips.map(function(cl){ return cl.id===clipId?{...cl,...patch}:cl; }) };
      });
    });
    setIsSaved(false);
  };

  const addClipToTrack = function (trackId, clip) {
    setTracks(function (prev) {
      return prev.map(function(t) {
        if (t.id !== trackId) return t;
        // All clips remain active — users can record multiple takes on the same track
        // and they all play back together. Use the track's Takes panel to manage them.
        return { ...t, clips:[...t.clips, {...clip, active:true}] };
      });
    });
    setIsSaved(false);
  };

  const removeClip = function (trackId, clipId) {
    setTracks(function (prev) {
      return prev.map(function(t) {
        if (t.id !== trackId) return t;
        const rem = t.clips.filter(function(cl){ return cl.id!==clipId; });
        // Auto-activate last clip if none active
        if (rem.length > 0 && !rem.some(function(cl){ return cl.active; })) {
          rem[rem.length-1] = {...rem[rem.length-1], active:true};
        }
        return { ...t, clips:rem };
      });
    });
    setContextMenu(null); setIsSaved(false);
  };

  const setActiveClip = function (trackId, clipId) {
    setTracks(function (prev) {
      return prev.map(function(t) {
        if (t.id !== trackId) return t;
        return { ...t, clips: t.clips.map(function(cl){ return {...cl, active:cl.id===clipId}; }) };
      });
    });
  };

  const removeTrack = function (id) {
    setTracks(function (prev) { return prev.filter(function(t){ return t.id!==id; }); });
    setContextMenu(null); setIsSaved(false);
  };

  const cloneTrack = function (track) {
    addTrackObj({
      ...track,
      id: Date.now() + Math.random(),
      name: track.name + " (copy)",
      clips: track.clips ? track.clips.map(function(cl){
        return { ...cl, id:cl.id+"cp", startTime:(cl.startTime||0)+(cl.duration||2)+0.5 };
      }) : [],
    });
    setContextMenu(null);
  };

  const toggleMuteUnused = null; const toggleSoloUnused = null; // replaced above

  // ── Upload beat / audio ───────────────────────────────────────
  const handleFileUpload = async function (e, type) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setError("");
    const actx = getActx();
    for (const file of files) {
      const url  = URL.createObjectURL(file);
      const name = file.name.replace(/\.[^.]+$/, "");
      try {
        const ab  = await file.arrayBuffer();
        const buf = await actx.decodeAudioData(ab.slice(0));
        const tId = Date.now() + Math.random();
        addTrackObj({
          id: tId, name, type: type || "beat",
          isMuted: false, isSoloed: false,
          color: type === "beat" ? "#C026D3" : VOCAL_COLORS[tracks.filter(function(t){return t.type==="vocal";}).length % VOCAL_COLORS.length],
          clips: [{ id:tId+"_c0", audioBuffer:buf, url, startTime:0, duration:buf.duration,
            trimStart:0, trimEnd:buf.duration, label:"Main", active:true }],
        });
        if (type === "beat") { setProjectName(name); setLoopOut(buf.duration); }
      } catch (e2) { setError("Could not decode: " + file.name); }
    }
    setShowAddMenu(false);
    // Reset input so the same file(s) can be re-selected
    e.target.value = "";
  };

  // ── Recording ─────────────────────────────────────────────────
  // ── Resume AudioContext when app returns from background ─────
  useEffect(function () {
    const onVisible = function () {
      if (actxRef.current && actxRef.current.state === "suspended") {
        actxRef.current.resume().then(function () {
          // Re-sync master start so elapsed time is correct
          if (isPlayingRef.current) {
            masterStartRef.current = actxRef.current.currentTime - (playheadAtRef.current);
          }
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return function () {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const [selectedTrackId, setSelectedTrackId] = useState(null); // which vocal track records into

  const startCountIn = async function (trackId) {
    // Request mic permission here (lazy) — only fires on first use, browser caches grant
    const granted = await requestMicPermissionOnce();
    if (!granted) return;

    const vocalTracks = tracks.filter(function(t){ return t.type === "vocal"; });
    let targetId = trackId || selectedTrackId;
    if (!targetId) {
      if (vocalTracks.length > 0) {
        targetId = vocalTracks[vocalTracks.length - 1].id;
      } else {
        // Auto-create vocal track so record works immediately
        const newId = Date.now() + Math.random();
        addTrackObj({ id:newId, name:"Vocal 1", type:"vocal", isMuted:false, isSoloed:false, clips:[], color:VOCAL_COLORS[0] });
        setSelectedTrackId(newId);
        targetId = newId;
      }
    }
    setError(""); setCountIn(3); let n = 3;
    countTimerRef.current = setInterval(function () {
      n--; setCountIn(n);
      if (n <= 0) { clearInterval(countTimerRef.current); setCountIn(0); doRecord(targetId); }
    }, 800);
  };

  const doRecord = async function (targetTrackId) {
    const newClipId = Date.now();
    clipIdRef.current = newClipId;

    try {
      // Build mic constraints using the same helper as monitoring,
      // so the selected mic source (iPhone vs headset) is respected during recording.
      // For recording we turn echo cancellation and noise suppression ON for cleaner vocals.
      const recConstraints = await buildMicConstraints(micSource, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl:  false,
        sampleRate:       44100,
        channelCount:     1,
      });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: recConstraints });

      const actx    = getActx();
      const srcNode = actx.createMediaStreamSource(stream);
      const analyser = actx.createAnalyser(); analyser.fftSize = 256;
      srcNode.connect(analyser);

      setRecTrail([]);
      chunksRef.current = [];

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const mr = new MediaRecorder(stream, { mimeType: mime });

      mr.ondataavailable = function (ev) {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      mr.onstop = async function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        try { analyser.disconnect(); } catch(e) {}
        try { srcNode.disconnect(); } catch(e) {}

        const blob = new Blob(chunksRef.current, { type: mime });
        const url  = URL.createObjectURL(blob);

        let buf = null;
        try {
          const ab = await blob.arrayBuffer();
          buf = await getActx().decodeAudioData(ab.slice(0));
        } catch (decErr) {
          setError("Could not decode recording. Try again.");
          setIsRecording(false); setRecTrackId(null); setRecTrail([]);
          return;
        }

        if (!buf || buf.duration < 0.05) {
          setIsRecording(false); setRecTrackId(null); setRecTrail([]);
          return;
        }

        // ── Ground-truth timing ───────────────────────────────────────────
        // buf.duration = the ONLY reliable measure of how long was captured (always use this).
        // Wall-clock (recDurRef) drifts due to async gaps and codec buffering — never use it.
        //
        // PRIMARY strategy: start-anchor.
        // recStartTimeRef was stamped the instant mr.start() fired, with inputLatency subtracted.
        // clipStartTime = recStartTimeRef (already accounting for mic hardware delay).
        //
        // SECONDARY (sanity check): stop-anchor.
        // stopActxTime was captured when stop() was pressed. If stopAll() hasn't run yet,
        // we can derive stopTimelinePos. If the two methods agree within 50ms we use start-anchor.
        // If they disagree badly it means stopAll() had already reset masterStartRef — start-anchor wins.
        let clipStartTime = recStartTimeRef.current;

        const stopActxTime = recStopActxTimeRef.current;
        if (stopActxTime !== null && masterStartRef.current > 0) {
          const stopTimelinePos  = playheadAtRef.current + (stopActxTime - masterStartRef.current);
          const stopAnchorStart  = Math.max(0, stopTimelinePos - buf.duration);
          const diff = Math.abs(stopAnchorStart - clipStartTime);
          // Only trust stop-anchor if it agrees closely — large diff means masterStart was reset
          if (diff < 0.05) clipStartTime = stopAnchorStart;
          // Otherwise keep start-anchor (recStartTimeRef) — it was stamped before any resets
        }

        // ── Strip leading silence from the decoded buffer ──────────────────
        // On iOS, getUserMedia + MediaRecorder always produce a silent warmup
        // period at the start of the buffer (~50–250ms).
        //
        // trimStart = how far into the buffer audio content begins (skips silent warmup on playback).
        // startTime = clipStartTime — the wall-clock moment mr.start() fired. This is already
        // the correct timeline position. We do NOT shift it forward by leadingSilenceSec because
        // clipStartTime was stamped at mr.start(), not at the first sample — so the silence was
        // captured starting at that exact moment. Shifting startTime forward would place the vocal
        // later than where it was actually performed.
        const SILENCE_THRESHOLD = 0.001; // -60 dBFS
        const MAX_SILENCE_SCAN  = 0.5;   // never strip more than 500ms
        let leadingSilenceSec   = 0;
        try {
          const ch  = buf.getChannelData(0);
          const sr  = buf.sampleRate;
          const max = Math.min(ch.length, Math.floor(sr * MAX_SILENCE_SCAN));
          for (let i = 0; i < max; i++) {
            if (Math.abs(ch[i]) > SILENCE_THRESHOLD) {
              leadingSilenceSec = i / sr;
              break;
            }
          }
        } catch(e) { leadingSilenceSec = 0; }

        const newClip = {
          id: String(Date.now()) + "_rec",
          audioBuffer: buf, url, blob,
          startTime: clipStartTime,       // wall-clock anchor — do NOT adjust for silence
          duration:  buf.duration,
          trimStart: leadingSilenceSec,   // skip silent warmup during playback only
          trimEnd:   buf.duration,
          label: "Take " + new Date().toLocaleTimeString(),
          active: true,
        };

        if (targetTrackId) {
          addClipToTrack(targetTrackId, newClip);
        } else {
          addTrackObj({
            id: Date.now() + Math.random(),
            name: "Vocal " + (tracks.filter(function (t) { return t.type === "vocal"; }).length + 1),
            type: "vocal",
            isMuted: false, isSoloed: false,
            color: VOCAL_COLORS[tracks.filter(function(t){return t.type==="vocal";}).length % VOCAL_COLORS.length],
            clips: [newClip],
          });
        }
        setRecTrail([]); setIsRecording(false); setRecTrackId(null);
      };

      recDurRef.current = 0;

      // ── Start playback FIRST so masterStartRef is stamped before we read the clock ──
      // MUST use playheadAtRef.current (live ref), NOT currentTime (stale React state).
      // currentTime lags by at least one render cycle; using it shifts each take's
      // clipStartTime by whatever the state lag is — making successive takes drift off-beat.
      if (!isPlaying) { doPlay(playheadAtRef.current); setIsPlaying(true); }

      // ── Precise timeline sync ─────────────────────────────────────────────
      // CRITICAL ORDER: read actx.currentTime AFTER doPlay() so masterStartRef.current
      // is already set. Then start the MediaRecorder and take a second clock reading
      // immediately after mr.start() — this is the tightest timestamp we can get for
      // when audio actually started being captured.
      //
      // actx.inputLatency = mic hardware buffer (5–20ms wired). Subtracting it shifts
      // the clip earlier so it aligns with when sound entered the mic, not when the
      // first buffer was handed to the browser.
      //
      // We do NOT use the stop-anchor approach for start because getUserMedia and
      // doPlay() both stamp their clocks before mr.start(), so the start-anchor is
      // the most accurate reference point.

      mr.start(50); // 50ms chunks — tighter than 100ms, reduces end-of-clip timing error

      // Read clock the instant after mr.start() fires — this is our ground truth
      const startActxTime = actx.currentTime;
      const inputLatency  = actx.inputLatency || 0;

      // Timeline position when recording actually started
      const trueStartTime = Math.max(0,
        playheadAtRef.current + (startActxTime - masterStartRef.current) - inputLatency
      );
      recStartTimeRef.current = trueStartTime;

      const recStart = Date.now();
      recIntRef.current = setInterval(function () {
        recDurRef.current = (Date.now() - recStart) / 1000;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (var i = 0; i < data.length; i++) {
          var v = Math.abs(data[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        setRecTrail(function (prev) { return [...prev.slice(-200), peak]; });
      }, 50);

      mediaRecRef.current = mr;
      setIsRecording(true);
      setRecTrackId(targetTrackId);

    } catch (e) {
      if (e.name === "NotAllowedError") {
        setError("Mic access denied. Go to Settings → Safari → Microphone → Allow.");
      } else {
        setError("Could not start recording: " + e.message);
      }
      setCountIn(0);
    }
  };


  // ── Region gestures ───────────────────────────────────────────
  // ── Clip selection & drag state ───────────────────────────────
  // selectedClipId stores clip.id (the actual clip, not the track)
  const [selectedClipId, setSelectedClipId] = useState(null);
  const dragRef = useRef(null);

  const selectClip = function (clipId) {
    setSelectedClipId(clipId);
  };

  const deselectClip = function () {
    setSelectedClipId(null);
  };

  const showClipMenu = function (track, clip, x, y) {
    if (navigator.vibrate) navigator.vibrate(30);
    setContextMenu({ track, clip, x, y });
  };

  // ── Unified clip gesture handlers ─────────────────────────────
  // All handlers receive {track, clip} directly — no more proxy objects

  const handleRegionMouseDown = function (e, track, clip) {
    if (e.button === 2) return;
    e.stopPropagation();
    selectClip(clip.id);
    const startX = e.clientX;
    const startT = clip.startTime || 0;
    let moved = false;
    const onMove = function (me) {
      const dx = me.clientX - startX;
      if (!moved && Math.abs(dx) < 5) return;
      moved = true;
      const newT = snapSecs(startT + dx / effectivePPS);
      updateClip(track.id, clip.id, { startTime: newT });
    };
    const onUp = function () {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ── Multi-select lasso handlers ─────────────────────────────────────────
  // Long-press (1.5s) on blank lane space activates a drag-to-select box.
  // Any clip whose rendered rect overlaps the box gets added to selClipIds.
  // An action bar then appears with Delete and Duplicate for all selected clips.

  const laneScrollRef = scrollRef; // reuse existing scroll container ref

  const getLaneScrollX = function() {
    return laneScrollRef.current ? laneScrollRef.current.scrollLeft : 0;
  };

  const startLassoFromTouch = function(clientX, clientY, laneTop) {
    // Use the DAW wrapper (lassoContainerRef) as the coordinate space —
    // the lasso overlay div is position:absolute inside it, so x/y must be
    // relative to that element, not the scroll container.
    const scrollX = getLaneScrollX();
    const wrapRect = lassoContainerRef.current
      ? lassoContainerRef.current.getBoundingClientRect()
      : { left: 0, top: 0 };
    const containerRect = laneScrollRef.current
      ? laneScrollRef.current.getBoundingClientRect()
      : { left: 0, top: 0 };

    // X is in scroll-content space (accounts for horizontal scroll)
    const absX = clientX - containerRect.left + scrollX;
    // Y is relative to the DAW wrapper (where position:absolute is anchored)
    const absY = clientY - wrapRect.top;

    selBoxRef.current = { startX: absX, startY: absY, scrollX };
    setSelBox({ x: absX, y: absY, w: 0, h: 0 });
    setSelClipIds(new Set());

    const onMove = function(te) {
      if (!selBoxRef.current) return;
      te.preventDefault();
      const tx = te.touches[0].clientX;
      const ty = te.touches[0].clientY;
      const sx = getLaneScrollX();
      const ax = tx - containerRect.left + sx;
      const ay = ty - wrapRect.top;
      const x = Math.min(ax, selBoxRef.current.startX);
      const y = Math.min(ay, selBoxRef.current.startY);
      const w = Math.abs(ax - selBoxRef.current.startX);
      const h = Math.abs(ay - selBoxRef.current.startY);
      setSelBox({ x, y, w, h });

      // Hit-test all clips against the lasso box — check both X and Y
      const hit = new Set();
      tracksRef.current.forEach(function(t, trackIndex) {
        // Each track row sits at: RULER_H + trackIndex * TRACK_H (relative to DAW wrapper top)
        const trackTop    = RULER_H + trackIndex * TRACK_H;
        const trackBottom = trackTop + TRACK_H;
        // Only consider this track if it overlaps the lasso vertically
        if (trackBottom < y || trackTop > y + h) return;
        (t.clips||[]).forEach(function(cl) {
          if (!cl.audioBuffer || cl.active === false) return;
          const trimS  = cl.trimStart || 0;
          const trimE  = cl.trimEnd !== undefined ? cl.trimEnd : cl.audioBuffer.duration;
          const clipL  = (cl.startTime || 0) * effectivePPSRef.current;
          const clipR  = clipL + Math.max(20, (trimE - trimS) * effectivePPSRef.current);
          if (clipR >= x && clipL <= x + w) {
            hit.add(cl.id);
          }
        });
      });
      setSelClipIds(hit);
    };

    const onEnd = function() {
      selBoxRef.current = null;
      setSelBox(null);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };

    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
  };

  const handleLaneLongPress = function(e, track) {
    // Cancel if the touch landed directly on a clip (has data-clipid attribute)
    // The inner mask div always covers the lane so we can't use e.target === e.currentTarget
    if (e.target && e.target.closest && e.target.closest("[data-clipid]")) return;
    // Called from onTouchStart on blank lane space.
    // We start a 1.5s timer; if the finger doesn't move much, activate lasso.
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;

    longPressRef.current = setTimeout(function() {
      longPressRef.current = null;
      // Haptic-style visual pulse then start lasso
      startLassoFromTouch(startX, startY);
    }, 1500);

    const cancelLP = function(te) {
      if (!longPressRef.current) return;
      // Cancel if finger moved more than 8px
      const dx = te.touches[0].clientX - startX;
      const dy = te.touches[0].clientY - startY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }
    };
    const cancelOnEnd = function() {
      if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
      document.removeEventListener("touchmove", cancelLP);
      document.removeEventListener("touchend", cancelOnEnd);
    };
    document.addEventListener("touchmove", cancelLP, { passive: true });
    document.addEventListener("touchend", cancelOnEnd, { passive: true });
  };

  const deleteSelectedClips = function() {
    setTracks(function(prev) {
      return prev.map(function(t) {
        return { ...t, clips: (t.clips||[]).filter(function(cl){ return !selClipIds.has(cl.id); }) };
      });
    });
    setSelClipIds(new Set());
    setSelBox(null);
    setIsSaved(false);
  };

  const duplicateSelectedClips = function() {
    const newIds = new Set();
    const ts = Date.now();
    setTracks(function(prev) {
      return prev.map(function(t) {
        const newClips = [];
        (t.clips||[]).forEach(function(cl) {
          newClips.push(cl);
          if (selClipIds.has(cl.id)) {
            const trimS = cl.trimStart || 0;
            const trimE = cl.trimEnd !== undefined ? cl.trimEnd : cl.audioBuffer.duration;
            const dupId = cl.id + "_dup" + ts;
            newIds.add(dupId);
            newClips.push({
              ...cl,
              id: dupId,
              startTime: (cl.startTime || 0) + (trimE - trimS) + 0.1,
              label: (cl.label || "Take") + " (copy)",
            });
          }
        });
        return { ...t, clips: newClips };
      });
    });
    setSelClipIds(newIds);
    setSelBox(null);
    setIsSaved(false);
  };

  const handleRegionRightClick = function (e, track, clip) {
    e.preventDefault();
    e.stopPropagation();
    selectClip(clip.id);
    showClipMenu(track, clip, e.clientX, e.clientY);
  };

  const handleRegionTouchStart = function (e, track, clip) {
    if (e.touches.length === 2) return;
    e.stopPropagation();
    selectClip(clip.id);
    const startX = e.touches[0].clientX;
    const startT = clip.startTime || 0;
    const menuX  = e.touches[0].clientX;
    const menuY  = e.touches[0].clientY - 60;

    // If this clip is part of a multi-selection, snapshot all selected clips' start times
    // so we can shift them all by the same delta during drag.
    const isMultiDrag = selClipIds.size > 1 && selClipIds.has(clip.id);
    const multiStartTimes = {}; // { clipId: startTime }
    if (isMultiDrag) {
      tracksRef.current.forEach(function(t) {
        (t.clips || []).forEach(function(cl) {
          if (selClipIds.has(cl.id)) {
            multiStartTimes[cl.id] = cl.startTime || 0;
          }
        });
      });
    }

    // Long-press timer — fires if no drag occurs within 500ms
    const lp = setTimeout(function () {
      if (dragRef.current && !dragRef.current.moved) {
        showClipMenu(track, clip, menuX, menuY);
      }
    }, 500);

    dragRef.current = { trackId: track.id, clipId: clip.id, startX, startT, moved: false, lp };

    // Add non-passive touchmove directly on the element so we can preventDefault
    // This stops the scroll container from stealing the gesture during clip drag
    const elem = e.currentTarget;
    const onMove = function (me) {
      if (!dragRef.current) return;
      me.preventDefault(); // must be non-passive to work
      const dx = me.touches[0].clientX - dragRef.current.startX;
      if (Math.abs(dx) > 6) {
        clearTimeout(dragRef.current.lp);
        dragRef.current.moved = true;
        if (isMultiDrag) {
          // Shift every selected clip by the same delta, keeping their relative positions
          const deltaSecs = dx / effectivePPSRef.current;
          setTracks(function(prev) {
            return prev.map(function(t) {
              return {
                ...t,
                clips: (t.clips || []).map(function(cl) {
                  if (!selClipIds.has(cl.id)) return cl;
                  const newT = snapSecs(Math.max(0, multiStartTimes[cl.id] + deltaSecs));
                  return { ...cl, startTime: newT };
                }),
              };
            });
          });
        } else {
          const newT = snapSecs(dragRef.current.startT + dx / effectivePPS);
          updateClip(dragRef.current.trackId, dragRef.current.clipId, { startTime: newT });
        }
      }
    };
    const onEnd = function () {
      clearTimeout(dragRef.current && dragRef.current.lp);
      dragRef.current = null;
      elem.removeEventListener("touchmove", onMove);
      elem.removeEventListener("touchend",  onEnd);
    };
    elem.addEventListener("touchmove", onMove, { passive: false });
    elem.addEventListener("touchend",  onEnd,  { passive: true  });
  };

  // handleRegionTouchMove and handleRegionTouchEnd are now handled by imperative listeners above
  const handleRegionTouchMove = function () {}; // kept for any legacy references
  const handleRegionTouchEnd  = function () {};

  // ── Pinch zoom ────────────────────────────────────────────────
  useEffect(function () {
    const el = scrollRef.current;
    if (!el) return;
    const onStart = function (e) {
      if (e.touches.length !== 2) return;
      const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY;
      pinchRef.current = { dist:Math.sqrt(dx*dx+dy*dy), zoom:zoomRef.current };
    };
    const onMove = function (e) {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY;
      const d=Math.sqrt(dx*dx+dy*dy);
      setZoom(Math.min(4, Math.max(0.25, +(pinchRef.current.zoom*d/pinchRef.current.dist).toFixed(2))));
    };
    const onEnd = function () { pinchRef.current = null; };
    el.addEventListener("touchstart",onStart,{passive:true});
    el.addEventListener("touchmove", onMove, {passive:false});
    el.addEventListener("touchend",  onEnd,  {passive:true});
    return function(){ el.removeEventListener("touchstart",onStart); el.removeEventListener("touchmove",onMove); el.removeEventListener("touchend",onEnd); };
  }, []);

  // ── Metronome ─────────────────────────────────────────────────
  useEffect(function () {
    if (!metronomeOn) { clearInterval(metroRef.current); return; }
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    let beat = 0;
    const tick = function () {
      const osc=ctx.createOscillator(), g=ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = beat%timeSigNum===0?1000:700;
      g.gain.setValueAtTime(0.3,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.05);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.1); beat++;
    };
    tick(); metroRef.current = setInterval(tick, 60000/bpm);
    return function () { clearInterval(metroRef.current); try{ctx.close();}catch(e){} };
  }, [metronomeOn, bpm, timeSigNum]);

  // ── Save/Load ─────────────────────────────────────────────────
  const audioBufferToBase64 = function (buf) {
    try {
      const nc=buf.numberOfChannels, sr=buf.sampleRate, len=buf.length, bl=len*nc*2;
      const ab=new ArrayBuffer(44+bl), dv=new DataView(ab);
      const ws=function(o,s){for(let i=0;i<s.length;i++)dv.setUint8(o+i,s.charCodeAt(i));};
      ws(0,"RIFF");dv.setUint32(4,36+bl,true);ws(8,"WAVE");ws(12,"fmt ");
      dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,nc,true);
      dv.setUint32(24,sr,true);dv.setUint32(28,sr*nc*2,true);dv.setUint16(32,nc*2,true);
      dv.setUint16(34,16,true);ws(36,"data");dv.setUint32(40,bl,true);
      let off=44;
      for(let i=0;i<len;i++)for(let c=0;c<nc;c++){
        const s=Math.max(-1,Math.min(1,buf.getChannelData(c)[i]));
        dv.setInt16(off,s<0?s*0x8000:s*0x7FFF,true);off+=2;
      }
      const bytes=new Uint8Array(ab);
      let b64=""; for(let i=0;i<bytes.length;i++)b64+=String.fromCharCode(bytes[i]);
      return btoa(b64);
    } catch(e){ return null; }
  };

  const base64ToAudioBuffer = async function (b64) {
    try {
      const bin=atob(b64);
      const ab=new ArrayBuffer(bin.length);
      const ua=new Uint8Array(ab);
      for(let i=0;i<bin.length;i++)ua[i]=bin.charCodeAt(i);
      const actx=getActx();
      return await actx.decodeAudioData(ab);
    } catch(e){ return null; }
  };

  const saveProject = async function () {
    try {
      setSaveStatus("Saving...");

      // Generate a stable project id — reuse existing one if this project was already saved
      let list = JSON.parse(localStorage.getItem("bf_studio_projects")||"[]");
      const existingIdx = list.findIndex(function(p){ return p.name===projectName; });
      const projId = (existingIdx >= 0 && list[existingIdx].id) ? list[existingIdx].id : Date.now();

      // ── 1. Save each clip's audio into IndexedDB (no size limit) ──────────
      const savedTracks = await Promise.all(tracks.map(async function(t){
        const savedClips = await Promise.all((t.clips||[]).map(async function(cl){
          // Key: "proj_<projId>_<clipId>"
          const idbKey = "proj_" + projId + "_" + cl.id;
          if (cl.audioBuffer) {
            // Convert AudioBuffer → WAV ArrayBuffer and store in IndexedDB
            const wavBuf = audioBufferToWav(cl.audioBuffer);
            try { await AudioDB.saveClip(idbKey, wavBuf); } catch(e) { console.warn("IDB save clip failed", e); }
          }
          // Return clip metadata only — no audio blobs in localStorage
          return { ...cl, audioBuffer:null, url:null, blob:null, audioB64:null, idbKey };
        }));

        // Legacy flat audioBuffer (beat tracks)
        const trackIdbKey = "proj_" + projId + "_track_" + t.id;
        if (t.audioBuffer) {
          const wavBuf = audioBufferToWav(t.audioBuffer);
          try { await AudioDB.saveClip(trackIdbKey, wavBuf); } catch(e) {}
        }

        return { ...t, audioBuffer:null, url:null, blob:null, audioB64:null, trackIdbKey, clips:savedClips };
      }));

      // ── 2. Save metadata to localStorage (tiny — just names/timing/FX) ───
      const proj = { id:projId, name:projectName, bpm, timeSigNum, projectKey, savedAt:new Date().toISOString(), tracks:savedTracks };
      if (existingIdx >= 0) list[existingIdx] = proj; else list.unshift(proj);
      list = list.slice(0, 10);
      try {
        localStorage.setItem("bf_studio_projects", JSON.stringify(list));
      } catch(quotaErr) {
        list = list.slice(0, 3);
        localStorage.setItem("bf_studio_projects", JSON.stringify(list));
      }

      setSavedProjects(list); setIsSaved(true);
      setSaveStatus("Saved! ✓");
      setTimeout(function(){ setSaveStatus(""); }, 2500);
    } catch(e){
      console.error("[BeatFinder] saveProject error:", e);
      setSaveStatus("Save failed — " + (e.message || "unknown error"));
      setTimeout(function(){ setSaveStatus(""); }, 4000);
    }
  };

  const loadProject = async function (p) {
    setShowProjects(false);
    setSaveStatus("Loading…");
    setError("");
    try {
      stopAll(); setIsPlaying(false);
      setCurrentTime(0); setSelectedClipId(null); setSelectedTrackId(null);
      if (scrollRef.current) scrollRef.current.scrollLeft = 0;

      setProjectName(p.name||"Untitled");
      setBpm(p.bpm||120);
      setTimeSigNum(p.timeSigNum||4);
      setProjectKey(p.projectKey||"C major");

      const actx = getActx();
      if (actx.state === "suspended") {
        try { await actx.resume(); } catch(e) {}
      }

      let missingAudio = false;

      // Restore tracks — pull audio from IndexedDB using the idbKey saved per clip
      const restored = await Promise.all((p.tracks||[]).map(async function(t){

        const restoredClips = await Promise.all((t.clips||[]).map(async function(cl){
          let buf = null;

          // ── New path: audio stored in IndexedDB ──────────────────────────
          if (cl.idbKey) {
            try {
              const wavBuf = await AudioDB.getClip(cl.idbKey);
              if (wavBuf) {
                buf = await actx.decodeAudioData(wavBuf.slice(0)); // slice so buffer isn't detached
              }
            } catch(e) { console.warn("IDB load clip failed", cl.idbKey, e); }
          }

          // ── Legacy path: audio was base64 in the save object ─────────────
          if (!buf && cl.audioB64) {
            buf = await base64ToAudioBuffer(cl.audioB64);
          }

          if (!buf) missingAudio = true;
          return { ...cl, audioBuffer: buf, url: null, blob: null };
        }));

        // Legacy flat audioBuffer (beat tracks)
        let trackBuf = null;
        if (t.trackIdbKey) {
          try {
            const wavBuf = await AudioDB.getClip(t.trackIdbKey);
            if (wavBuf) trackBuf = await actx.decodeAudioData(wavBuf.slice(0));
          } catch(e) {}
        }
        if (!trackBuf && t.audioB64) {
          trackBuf = await base64ToAudioBuffer(t.audioB64);
        }

        return { ...t, audioBuffer: trackBuf, url: null, blob: null, clips: restoredClips };
      }));

      setTracks(restored);
      setIsSaved(true);

      if (missingAudio) {
        setSaveStatus("");
        setError("⚠️ Some audio clips couldn't be restored — they may have been recorded in a different browser/app session.");
        setTimeout(function(){ setError(""); }, 8000);
      } else {
        setSaveStatus("Loaded! ✓");
        setTimeout(function(){ setSaveStatus(""); }, 1500);
      }
    } catch(e) {
      console.error("[BeatFinder] loadProject error:", e);
      setError("Could not load project — " + (e.message||"unknown error"));
      setSaveStatus("");
    }
  };

  const deleteProject = function (id) {
    // Remove audio clips from IndexedDB (best-effort, async — no need to await)
    AudioDB.deleteProjectClips(id).catch(function(){});
    const u = savedProjects.filter(function(p){ return p.id!==id; });
    setSavedProjects(u);
    localStorage.setItem("bf_studio_projects", JSON.stringify(u));
  };

  // ── BPM detect ────────────────────────────────────────────────
  const detectBpm = async function () {
    const beatTrack = tracks.find(function(t){ return t.type==="beat" && t.audioBuffer; });
    if (!beatTrack) return;
    setBpmDetecting(true); setDetectedBpm(null);
    try {
      const raw=beatTrack.audioBuffer.getChannelData(0), SR=beatTrack.audioBuffer.sampleRate, hop=256;
      const envLen=Math.floor(raw.length/hop); const env=new Float32Array(envLen);
      for(let i=0;i<envLen;i++){let s=0;for(let j=i*hop;j<(i+1)*hop&&j<raw.length;j++)s+=raw[j]*raw[j];env[i]=Math.sqrt(s/hop);}
      const onset=new Float32Array(envLen);
      for(let i=1;i<envLen;i++){const d=env[i]-env[i-1];onset[i]=d>0?d:0;}
      const fps=SR/hop,minL=Math.round(fps*60/200),maxL=Math.round(fps*60/60),acLen=Math.min(envLen,Math.round(fps*30));
      let bestL=minL,bestS=-1;
      for(let lag=minL;lag<=maxL;lag++){let sc=0;for(let t=0;t<acLen-lag;t++)sc+=onset[t]*onset[t+lag];sc/=(acLen-lag);if(sc>bestS){bestS=sc;bestL=lag;}}
      let raw2=fps*60/bestL;
      const cands=[raw2,raw2*2,raw2/2,raw2*1.5,raw2/1.5];
      const scored=cands.map(function(cb){
        if(cb<60||cb>200)return{bpm:cb,sc:-1};
        const cl=fps*60/cb;let sc2=0;
        for(let t=0;t<acLen-Math.round(cl);t++)sc2+=onset[t]*onset[t+Math.round(cl)];
        return{bpm:Math.round(cb),sc:sc2/(acLen-Math.round(cl))};
      });
      scored.sort(function(a,b){return b.sc-a.sc;});
      let final=scored[0].sc>0?scored[0].bpm:Math.round(raw2);
      while(final<60)final*=2;while(final>200)final=Math.round(final/2);
      setDetectedBpm(final);setBpm(final);
    }catch(e){setDetectedBpm(-1);}
    setBpmDetecting(false);
  };

  // ── Export ────────────────────────────────────────────────────
  const audioBufferToWav = function (buf) {
    const nc=buf.numberOfChannels,sr=buf.sampleRate,len=buf.length,bl=len*nc*2;
    const ab=new ArrayBuffer(44+bl),dv=new DataView(ab);
    const ws=function(o,s){for(let i=0;i<s.length;i++)dv.setUint8(o+i,s.charCodeAt(i));};
    ws(0,"RIFF");dv.setUint32(4,36+bl,true);ws(8,"WAVE");ws(12,"fmt ");
    dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,nc,true);
    dv.setUint32(24,sr,true);dv.setUint32(28,sr*nc*2,true);dv.setUint16(32,nc*2,true);
    dv.setUint16(34,16,true);ws(36,"data");dv.setUint32(40,bl,true);
    let off=44;
    for(let i=0;i<len;i++)for(let c=0;c<nc;c++){
      const s=Math.max(-1,Math.min(1,buf.getChannelData(c)[i]));
      dv.setInt16(off,s<0?s*0x8000:s*0x7FFF,true);off+=2;
    }
    return new Blob([ab],{type:"audio/wav"});
  };

  const exportMix = async function () {
    setExporting(true);setExportMsg("Preparing...");
    try {
      const SR=44100;
      let totalDur2=0;
      tracks.forEach(function(t){const e=(t.startTime||0)+(t.duration||0);if(e>totalDur2)totalDur2=e;});
      if(totalDur2<0.5){setExportMsg("Nothing to export");setTimeout(function(){setExporting(false);setExportMsg("");},2000);return;}
      const oc=new OfflineAudioContext(2,Math.ceil(totalDur2*SR),SR);
      const dec=async function(url){const r=await fetch(url);const ab=await r.arrayBuffer();return oc.decodeAudioData(ab);};
      const hasSolo=tracks.some(function(t){return t.isSoloed;});
      for(const tr of tracks){
        if(tr.isMuted||!tr.audioBuffer)continue;
        if(hasSolo&&!tr.isSoloed)continue;
        setExportMsg("Loading "+tr.name+"...");
        try{
          // Copy buffer into offline context
          const oc2 = new OfflineAudioContext(tr.audioBuffer.numberOfChannels, tr.audioBuffer.length, tr.audioBuffer.sampleRate);
          const g=oc.createGain();g.gain.value=1;
          const s=oc.createBufferSource();s.buffer=tr.audioBuffer;s.connect(g);g.connect(oc.destination);
          s.start(tr.startTime||0,0,tr.audioBuffer.duration);
        }catch(e){}
      }
      setExportMsg("Rendering...");
      const rendered=await oc.startRendering();
      const wav=audioBufferToWav(rendered);
      const a=document.createElement("a");a.href=URL.createObjectURL(wav);a.download=(projectName||"project")+" - mix.wav";a.click();
      setExportMsg("Done!");setTimeout(function(){setExporting(false);setExportMsg("");},2500);
    }catch(e){setExportMsg("Failed.");setTimeout(function(){setExporting(false);setExportMsg("");},3000);}
  };

  const fmt = function (s) {
    s=Math.max(0,s||0);
    const m=Math.floor(s/60),sec=Math.floor(s%60),ms=Math.floor((s%1)*10);
    return (m<10?"0":"")+m+":"+(sec<10?"0":"")+sec+"."+ms;
  };

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div
      style={{ background:"#080808", height:"calc(100vh - env(safe-area-inset-bottom))", display:"flex", flexDirection:"column", fontFamily:"'DM Sans',sans-serif", overflow:"hidden", WebkitUserSelect:"none", userSelect:"none", WebkitTouchCallout:"none" }}
      onClick={function(){ setContextMenu(null); setShowProjMenu(false); setShowSettings(false); setShowAddMenu(false); setShowProjects(false); setSelectedClipId(null); }}
    >
      {/* ── Overlays ── */}
      {exporting && (
        <div style={{ position:"absolute",inset:0,zIndex:9000,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20 }}>
          <div style={{ width:52,height:52,borderRadius:"50%",border:"3px solid rgba(192,38,211,0.3)",borderTop:"3px solid #C026D3",animation:"bf-spin 0.8s linear infinite" }} />
          <div style={{ color:"white",fontWeight:700,fontSize:16 }}>Exporting Mix</div>
          <div style={{ color:"#888",fontSize:13 }}>{exportMsg}</div>
        </div>
      )}

      {countIn > 0 && (
        <div style={{ position:"absolute",inset:0,zIndex:1000,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column" }}>
          <div style={{ color:"#EF4444",fontSize:100,fontWeight:900,lineHeight:1 }}>{countIn}</div>
          <div style={{ color:"#555",fontSize:14,marginTop:8 }}>Allow mic when prompted</div>
        </div>
      )}

      {contextMenu && (
        <div style={{ position:"fixed", inset:0, zIndex:9000 }} onClick={function(){ setContextMenu(null); }}>
          <div onClick={function(e){ e.stopPropagation(); }} style={{ position:"absolute", top:Math.min(contextMenu.y+8,window.innerHeight-210), left:Math.max(12,Math.min(contextMenu.x-100,window.innerWidth-220)), background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:16, overflow:"hidden", minWidth:204, boxShadow:"0 16px 48px rgba(0,0,0,0.95)" }}>
            <div style={{ padding:"10px 16px 8px", borderBottom:"1px solid #222", display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:contextMenu.track.color,flexShrink:0 }} />
              <span style={{ color:"#666",fontSize:11,fontWeight:600 }}>{contextMenu.clip ? contextMenu.clip.label : contextMenu.track.name}</span>
            </div>
            {contextMenu.clip && (<>
              <button onClick={function(){
                const c = contextMenu.clip; const t = contextMenu.track;
                addClipToTrack(t.id, {...c, id:c.id+"dup", startTime:(c.startTime||0)+(c.duration||2)+0.25, label:c.label+" (copy)", active:true});
                setContextMenu(null);
              }} style={{ display:"flex",alignItems:"center",gap:12,width:"100%",padding:"13px 16px",background:"none",border:"none",borderBottom:"1px solid #111",color:"white",fontSize:14,cursor:"pointer" }}>
                <span style={{ width:20,textAlign:"center" }}>⧉</span> Duplicate
              </button>
              <button onClick={function(){ removeClip(contextMenu.track.id, contextMenu.clip.id); }} style={{ display:"flex",alignItems:"center",gap:12,width:"100%",padding:"13px 16px",background:"none",border:"none",borderBottom:"1px solid #111",color:"#EF4444",fontSize:14,cursor:"pointer" }}>
                <span style={{ width:20,textAlign:"center" }}>🗑</span> Delete clip
              </button>
            </>)}
            <button onClick={function(){
              const n=window.prompt("Rename track:", contextMenu.track.name);
              if(n&&n.trim()) updateTrack(contextMenu.track.id,{name:n.trim()});
              setContextMenu(null);
            }} style={{ display:"flex",alignItems:"center",gap:12,width:"100%",padding:"13px 16px",background:"none",border:"none",borderBottom:"1px solid #111",color:"white",fontSize:14,cursor:"pointer" }}>
              <span style={{ width:20,textAlign:"center" }}>✏️</span> Rename track
            </button>
            <button onClick={function(){ removeTrack(contextMenu.track.id); setContextMenu(null); }} style={{ display:"flex",alignItems:"center",gap:12,width:"100%",padding:"13px 16px",background:"none",border:"none",color:"#EF4444",fontSize:14,cursor:"pointer" }}>
              <span style={{ width:20,textAlign:"center" }}>🗑</span> Delete track
            </button>
          </div>
        </div>
      )}

      {unsavedAlert && (
        <div style={{ position:"absolute",inset:0,zIndex:8000,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:"32px" }}>
          <div style={{ background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:320,textAlign:"center" }}>
            <div style={{ color:"white",fontWeight:800,fontSize:18,marginBottom:10 }}>Unsaved Project</div>
            <div style={{ color:"#888",fontSize:14,marginBottom:28,lineHeight:1.6 }}>Save before {unsavedAlert==="new"?"new project?":"leaving?"}</div>
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              <button onClick={function(){ saveProject();setUnsavedAlert(false);if(unsavedAlert!=="new")onExit();else{setTracks([]);setProjectName("New Project");setIsSaved(false);setCurrentTime(0);} }} style={{ background:"linear-gradient(135deg,#C026D3,#7C3AED)",border:"none",borderRadius:12,color:"white",fontWeight:800,fontSize:15,padding:"14px",cursor:"pointer" }}>Save {unsavedAlert==="new"?"& New":"& Exit"}</button>
              <button onClick={function(){
                setUnsavedAlert(false);
                if(unsavedAlert!=="new"){
                  onExit();
                } else {
                  // Full reset — clear everything so old project can't ghost back
                  stopAll(); setIsPlaying(false);
                  setTracks([]); setProjectName("New Project");
                  setBpm(120); setProjectKey("C major"); setTimeSigNum(4);
                  setCurrentTime(0); setIsSaved(true); setSelectedTrackId(null);
                  if(scrollRef.current) scrollRef.current.scrollLeft = 0;
                }
              }} style={{ background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,color:"#EF4444",fontWeight:700,fontSize:15,padding:"14px",cursor:"pointer" }}>Don't Save</button>
              <button onClick={function(){ setUnsavedAlert(false); }} style={{ background:"none",border:"1px solid #2a2a2a",borderRadius:12,color:"#666",fontSize:14,padding:"12px",cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showTSPicker && (
        <div style={{ position:"absolute",inset:0,zIndex:9999,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-end" }} onClick={function(){ setShowTSPicker(false); }}>
          <div style={{ width:"100%",background:"#1c1c1c",borderRadius:"20px 20px 0 0",paddingBottom:"calc(20px + env(safe-area-inset-bottom))" }} onClick={function(e){ e.stopPropagation(); }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px 12px",borderBottom:"1px solid #2a2a2a" }}>
              <button onClick={function(){ setShowTSPicker(false); }} style={{ background:"none",border:"none",color:"#888",fontSize:14,cursor:"pointer" }}>Cancel</button>
              <span style={{ color:"white",fontWeight:700,fontSize:15 }}>Time Signature</span>
              <button onClick={function(){ setShowTSPicker(false); }} style={{ background:"none",border:"none",color:"#C026D3",fontSize:14,fontWeight:700,cursor:"pointer" }}>Done</button>
            </div>
            <div style={{ display:"flex" }}>
              <WheelPicker items={["2","3","4","5","6","7"]} value={String(timeSigNum)} onChange={function(v){ setTimeSigNum(parseInt(v)); }} onClose={function(){}} inline={true} label="Beats" />
              <div style={{ display:"flex",alignItems:"center",color:"white",fontSize:28,fontWeight:700,padding:"0 8px" }}>/</div>
              <WheelPicker items={["4"]} value="4" onChange={function(){}} onClose={function(){}} inline={true} label="Note" />
            </div>
          </div>
        </div>
      )}

      {showKeyPick && (
        <div style={{ position:"absolute",inset:0,zIndex:9999,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-end" }} onClick={function(){ setShowKeyPick(false); }}>
          <div style={{ width:"100%",background:"#1c1c1c",borderRadius:"20px 20px 0 0",paddingBottom:"calc(20px + env(safe-area-inset-bottom))" }} onClick={function(e){ e.stopPropagation(); }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px 12px",borderBottom:"1px solid #2a2a2a" }}>
              <button onClick={function(){ setShowKeyPick(false); }} style={{ background:"none",border:"none",color:"#888",fontSize:14,cursor:"pointer" }}>Cancel</button>
              <span style={{ color:"white",fontWeight:700,fontSize:15 }}>Project Key</span>
              <button onClick={function(){ setShowKeyPick(false); }} style={{ background:"none",border:"none",color:"#C026D3",fontSize:14,fontWeight:700,cursor:"pointer" }}>Done</button>
            </div>
            <WheelPicker items={["C major","C# major","D major","D# major","E major","F major","F# major","G major","G# major","A major","A# major","B major","C minor","C# minor","D minor","D# minor","E minor","F minor","F# minor","G minor","G# minor","A minor","A# minor","B minor"]} value={projectKey} onChange={function(v){ setProjectKey(v); }} onClose={function(){ setShowKeyPick(false); }} inline={true} />
          </div>
        </div>
      )}

      {showSettings && (
        <div style={{ position:"absolute",inset:0,zIndex:700,background:"rgba(0,0,0,0.85)" }} onClick={function(){ setShowSettings(false); }}>
          <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"#111",borderRadius:"20px 20px 0 0",maxHeight:"88vh",overflowY:"auto" }} onClick={function(e){ e.stopPropagation(); }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px 12px" }}>
              <span style={{ color:"white",fontWeight:800,fontSize:16 }}>Project Settings</span>
              <button onClick={function(){ setShowSettings(false); }} style={{ background:"none",border:"none",color:"#555",fontSize:20,cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ margin:"0 16px 16px",background:"#1a1a1a",borderRadius:14,overflow:"hidden" }}>
              <div style={{ padding:"14px 16px 6px",color:"white",fontWeight:700,fontSize:13 }}>Tempo</div>
              <div style={{ display:"flex",alignItems:"stretch",borderTop:"1px solid #222" }}>
                <button onClick={function(){ setBpm(function(b){ return Math.max(40,b-1); }); }} style={{ flex:1,background:"none",border:"none",borderRight:"1px solid #222",color:"white",fontSize:28,cursor:"pointer",padding:"14px 0" }}>−</button>
                <div onClick={function(){
                  const taps=(window._bfTaps=window._bfTaps||[]),now=Date.now();
                  if(now-(taps[taps.length-1]||0)>3000)taps.length=0;
                  taps.push(now);
                  if(taps.length>=2){const intervals=[];for(let i=1;i<taps.length;i++)intervals.push(taps[i]-taps[i-1]);const avg=intervals.reduce(function(a,b){return a+b;},0)/intervals.length;const d=Math.round(60000/avg);if(d>=40&&d<=220)setBpm(d);}
                }} style={{ flex:2,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"12px 0",cursor:"pointer" }}>
                  <div style={{ color:"white",fontWeight:900,fontSize:40,lineHeight:1 }}>{bpm}</div>
                  <div style={{ color:"#555",fontSize:11,marginTop:4 }}>Tap Tempo</div>
                </div>
                <button onClick={function(){ setBpm(function(b){ return Math.min(220,b+1); }); }} style={{ flex:1,background:"none",border:"none",borderLeft:"1px solid #222",color:"white",fontSize:28,cursor:"pointer",padding:"14px 0" }}>+</button>
              </div>
              <div style={{ padding:"8px 16px 12px" }}>
                <input type="range" min={40} max={220} step={1} value={bpm} onChange={function(e){ setBpm(parseInt(e.target.value)); }} style={{ width:"100%",accentColor:"#C026D3" }} />
              </div>
              {tracks.some(function(t){return t.type==="beat"&&t.audioBuffer;}) && (
                <div style={{ padding:"0 16px 14px",display:"flex",alignItems:"center",gap:10 }}>
                  <button onClick={detectBpm} disabled={bpmDetecting} style={{ background:"rgba(192,38,211,0.15)",border:"1px solid rgba(192,38,211,0.3)",borderRadius:8,color:"#C026D3",fontSize:12,fontWeight:700,padding:"7px 14px",cursor:bpmDetecting?"not-allowed":"pointer",opacity:bpmDetecting?0.6:1 }}>{bpmDetecting?"Detecting...":"Auto-detect BPM"}</button>
                  {detectedBpm>0&&<span style={{ color:"#22C55E",fontSize:12,fontWeight:700 }}>→ {detectedBpm} BPM</span>}
                  {detectedBpm===-1&&<span style={{ color:"#F87171",fontSize:12 }}>Could not detect</span>}
                </div>
              )}
            </div>
            <div style={{ margin:"0 16px 16px",background:"#1a1a1a",borderRadius:14 }}>
              <button onClick={function(){ setShowTSPicker(true); }} style={{ width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px",background:"none",border:"none",cursor:"pointer" }}>
                <span style={{ color:"white",fontWeight:700,fontSize:14 }}>Time Signature</span>
                <span style={{ color:"#C026D3",fontSize:16,fontWeight:700 }}>{timeSigNum}/4 ›</span>
              </button>
            </div>
            <div style={{ margin:"0 16px 16px",background:"#1a1a1a",borderRadius:14 }}>
              <button onClick={function(){ setShowKeyPick(true); }} style={{ width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px",background:"none",border:"none",cursor:"pointer" }}>
                <span style={{ color:"white",fontWeight:700,fontSize:14 }}>Project Key</span>
                <span style={{ color:"#C026D3",fontSize:14,fontWeight:700 }}>{projectKey} ›</span>
              </button>
            </div>
            <div style={{ margin:"0 16px 16px",background:"#1a1a1a",borderRadius:14 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px" }}>
                <div><div style={{ color:"white",fontWeight:700,fontSize:13 }}>Snap to Grid</div><div style={{ color:"#555",fontSize:11,marginTop:2 }}>Snap regions to nearest beat</div></div>
                <button onClick={function(){ setSnapToGrid(function(v){ return !v; }); }} style={{ background:snapToGrid?"rgba(192,38,211,0.2)":"#141414",border:"1px solid "+(snapToGrid?"#C026D3":"#2a2a2a"),borderRadius:20,color:snapToGrid?"#C026D3":"#555",fontWeight:700,fontSize:12,padding:"6px 16px",cursor:"pointer" }}>{snapToGrid?"ON":"OFF"}</button>
              </div>
            </div>
            <div style={{ margin:"0 16px 32px",background:"#1a1a1a",borderRadius:14 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px" }}>
                <div><div style={{ color:"white",fontWeight:700,fontSize:13 }}>Metronome</div><div style={{ color:"#555",fontSize:11,marginTop:2 }}>Click while recording</div></div>
                <button onClick={function(){ setMetronomeOn(function(v){ return !v; }); }} style={{ background:metronomeOn?"rgba(192,38,211,0.2)":"#141414",border:"1px solid "+(metronomeOn?"#C026D3":"#2a2a2a"),borderRadius:20,color:metronomeOn?"#C026D3":"#555",fontWeight:700,fontSize:12,padding:"6px 16px",cursor:"pointer" }}>{metronomeOn?"ON":"OFF"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProjects && (
        <div style={{ position:"absolute",inset:0,zIndex:900,background:"rgba(0,0,0,0.7)" }} onClick={function(){ setShowProjects(false); }}>
          <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"#111",borderRadius:"20px 20px 0 0",padding:"20px 16px 40px",maxHeight:"70vh",overflowY:"auto" }} onClick={function(e){ e.stopPropagation(); }}>
            <div style={{ color:"white",fontWeight:800,fontSize:16,marginBottom:16 }}>Saved Projects</div>
            {savedProjects.length===0
              ?<div style={{ color:"#444",fontSize:14,textAlign:"center",padding:"20px 0" }}>No saved projects</div>
              :savedProjects.map(function(p){
                return(
                  <div key={p.id} style={{ background:"#1a1a1a",borderRadius:12,padding:"12px 14px",marginBottom:10,display:"flex",alignItems:"center" }}>
                    <div onClick={function(){ loadProject(p); }} style={{ flex:1,cursor:"pointer" }}>
                      <div style={{ color:"white",fontWeight:700,fontSize:14 }}>{p.name}</div>
                      <div style={{ color:"#555",fontSize:11,marginTop:2 }}>{p.tracks.length} tracks · {p.bpm||120} BPM</div>
                    </div>
                    <button onClick={function(){ deleteProject(p.id); }} style={{ background:"none",border:"none",color:"#444",fontSize:16,cursor:"pointer",padding:"4px 8px" }}>✕</button>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      {/* ══ TOP BAR ══════════════════════════════════════════════ */}
      <div style={{ display:"flex",alignItems:"center",padding:"10px 12px",borderBottom:"1px solid #141414",background:"#0a0a0a",flexShrink:0,gap:6,zIndex:50 }}>
        <button onClick={function(){ if(!isSaved&&hasContent)setUnsavedAlert(true);else onExit(); }} style={{ background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,color:"#888",width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#888"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        </button>
        {/* Undo / Redo */}
        <button onClick={undoTracks} disabled={!canUndo} title="Undo" style={{ background:"#141414",border:"1px solid #222",borderRadius:7,color:canUndo?"#aaa":"#333",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:canUndo?"pointer":"not-allowed",flexShrink:0,fontSize:14 }}>↩</button>
        <button onClick={redoTracks} disabled={!canRedo} title="Redo" style={{ background:"#141414",border:"1px solid #222",borderRadius:7,color:canRedo?"#aaa":"#333",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:canRedo?"pointer":"not-allowed",flexShrink:0,fontSize:14 }}>↪</button>
        {renamingProj
          ?<input autoFocus defaultValue={projectName} onBlur={function(e){ setProjectName(e.target.value||projectName);setRenamingProj(false);setIsSaved(false); }} onKeyDown={function(e){ if(e.key==="Enter"){setProjectName(e.target.value||projectName);setRenamingProj(false);setIsSaved(false);} }} style={{ background:"none",border:"none",borderBottom:"1px solid #C026D3",color:"white",fontSize:13,fontWeight:700,outline:"none",flex:1,padding:"0 0 2px" }} />
          :<span style={{ color:"white",fontWeight:700,fontSize:12,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{projectName}</span>
        }
        <button onClick={function(e){ e.stopPropagation();setShowProjMenu(function(v){return !v;});setShowSettings(false); }} style={{ background:showProjMenu?"rgba(192,38,211,0.15)":"#1a1a1a",border:"1px solid "+(showProjMenu?"rgba(192,38,211,0.4)":"#2a2a2a"),borderRadius:8,color:"#aaa",fontSize:13,fontWeight:700,padding:"5px 10px",cursor:"pointer",flexShrink:0,letterSpacing:2 }}>···</button>
        <button onClick={function(e){ e.stopPropagation();setShowProjMenu(false);setShowSettings(function(v){return !v;}); }} style={{ background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,color:"#888",fontSize:12,padding:"5px 8px",cursor:"pointer",flexShrink:0 }}>⚙</button>
        <div style={{ color:isRecording?"#EF4444":"#aaa",fontSize:11,fontFamily:"monospace",fontWeight:700,flexShrink:0,background:"#141414",border:"1px solid #222",borderRadius:6,padding:"4px 7px" }}>{fmt(currentTime)}</div>
      </div>

      {showProjMenu&&(
        <div style={{ position:"absolute",top:58,right:52,zIndex:6000 }} onClick={function(e){ e.stopPropagation(); }}>
          <div style={{ background:"#0d0d0d",border:"1px solid #2a2a2a",borderRadius:14,overflow:"hidden",minWidth:200,boxShadow:"0 8px 40px rgba(0,0,0,0.9)" }}>
            {[
              {label:"💾  Save",         fn:function(){setShowProjMenu(false);saveProject();}},
              {label:"📋  Save As…",     fn:function(){setShowProjMenu(false);setTimeout(function(){const n=window.prompt("Save as:",projectName+" (copy)");if(n){setProjectName(n);setIsSaved(false);setTimeout(saveProject,50);}},50);}},
              {label:"✏️  Rename",       fn:function(){setShowProjMenu(false);setRenamingProj(true);}},
              {label:"📂  All Projects", fn:function(){setShowProjMenu(false);setTimeout(function(){setShowProjects(true);},50);}},
              {label:"⬇️  Export Mix",   fn:function(){setShowProjMenu(false);setTimeout(exportMix,50);},hi:true},
              {label:"🆕  New Project",  fn:function(){setShowProjMenu(false);setTimeout(function(){
                if(!isSaved&&hasContent) setUnsavedAlert("new");
                else{
                  stopAll(); setIsPlaying(false);
                  setTracks([]); setProjectName("New Project");
                  setBpm(120); setProjectKey("C major"); setTimeSigNum(4);
                  setCurrentTime(0); setIsSaved(true); setSelectedTrackId(null);
                  if(scrollRef.current) scrollRef.current.scrollLeft = 0;
                }
              },50);},sep:true},
            ].map(function(item){
              return <button key={item.label} onClick={item.fn} style={{ display:"block",width:"100%",textAlign:"left",padding:"13px 16px",background:item.hi?"rgba(192,38,211,0.08)":"none",border:"none",borderBottom:"1px solid #1a1a1a",borderTop:item.sep?"1px solid #2a2a2a":"none",color:item.hi||item.sep?"#C026D3":"white",fontSize:14,cursor:"pointer" }}>{item.label}</button>;
            })}
          </div>
        </div>
      )}

      {saveStatus&&<div style={{ background:"rgba(34,197,94,0.1)",borderBottom:"1px solid rgba(34,197,94,0.2)",color:"#22C55E",fontSize:12,padding:"5px 16px",textAlign:"center",flexShrink:0 }}>{saveStatus}</div>}
      {error&&<div style={{ background:"rgba(239,68,68,0.1)",borderBottom:"1px solid rgba(239,68,68,0.2)",color:"#F87171",fontSize:12,padding:"5px 16px",textAlign:"center",flexShrink:0 }}>{error}</div>}

      {/* Zoom / Loop bar — monitoring toggle lives here too */}
      <div style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 12px",background:"#090909",borderBottom:"1px solid #0f0f0f",flexShrink:0 }}>
        <button onClick={function(){ setZoom(function(z){return Math.max(0.25,+(z-0.25).toFixed(2));});}} style={{ background:"#141414",border:"1px solid #222",borderRadius:5,color:"#888",fontSize:16,width:24,height:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>-</button>
        <span style={{ color:"#555",fontSize:10,fontFamily:"monospace",width:32,textAlign:"center" }}>{zoom}x</span>
        <button onClick={function(){ setZoom(function(z){return Math.min(4,+(z+0.25).toFixed(2));});}} style={{ background:"#141414",border:"1px solid #222",borderRadius:5,color:"#888",fontSize:16,width:24,height:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>
        <div style={{ width:1,background:"#1a1a1a",height:14,margin:"0 4px" }} />
        <button onClick={function(){ setLoopEnabled(function(v){return !v;});}} style={{ background:loopEnabled?"rgba(59,130,246,0.2)":"#141414",border:"1px solid "+(loopEnabled?"#3B82F6":"#222"),borderRadius:6,color:loopEnabled?"#3B82F6":"#555",fontSize:10,fontWeight:700,padding:"3px 8px",cursor:"pointer" }}>LOOP</button>
        <div style={{ flex:1 }} />
        {/* 🎧 Input monitoring toggle */}
        <button
          onClick={function(){ monitoringOn ? stopMonitoring() : startMonitoring(); }}
          style={{ display:"flex",alignItems:"center",gap:5,background:monitoringOn?"rgba(34,197,94,0.15)":"#141414",border:"1px solid "+(monitoringOn?"#22C55E":"#2a2a2a"),borderRadius:8,padding:"4px 8px",cursor:"pointer" }}
        >
          <span style={{ fontSize:13 }}>🎧</span>
          <div style={{ width:22,height:12,borderRadius:6,background:monitoringOn?"#22C55E":"#333",position:"relative",transition:"background 0.15s" }}>
            <div style={{ position:"absolute",top:2,left:monitoringOn?10:2,width:8,height:8,borderRadius:"50%",background:"white",transition:"left 0.15s" }} />
          </div>
        </button>
        {monitoringOn && (
          <input type="range" min={0} max={1} step={0.05} value={monitorVol}
            onChange={function(e){ setMonitorVol(parseFloat(e.target.value)); }}
            style={{ width:50,accentColor:"#22C55E",height:2 }} />
        )}
        {/* Mic source picker — shown when headphones are in */}
        {headphonesIn && (
          <select
            value={micSource}
            onChange={function(e){
              const next = e.target.value;
              setMicSource(next);
              if (monitoringOn) { stopMonitoring(); setTimeout(function(){ startMonitoring(undefined, next); }, 150); }
            }}
            title="Choose microphone source"
            style={{ background:"#141414",border:"1px solid #2a2a2a",borderRadius:6,color:"#aaa",fontSize:9,fontWeight:700,padding:"3px 5px",cursor:"pointer",outline:"none",maxWidth:115 }}
          >
            <option value="builtin">📱 iPhone Mic</option>
            <option value="headset">🎙 Headset Mic</option>
          </select>
        )}
      </div>
      {monitorWarn && <div style={{ background:"rgba(245,158,11,0.1)",borderBottom:"1px solid rgba(245,158,11,0.2)",color:"#F59E0B",fontSize:11,padding:"4px 16px",textAlign:"center",flexShrink:0 }}>{monitorWarn}</div>}

      {/* ══ DAW LAYOUT — sticky track headers + shared horizontal scroll ════
          Single scrollable div holds ruler + all track rows.
          Track name column uses position:sticky,left:0 — never scrolls away.
          Ruler uses position:sticky,top:0 — always visible.
          One scrollLeft drives everything — zero sync bugs.
      ══════════════════════════════════════════════════════════════════════ */}
      <div ref={lassoContainerRef} style={{ flex:1, minHeight:0, overflow:"hidden", position:"relative" }}>

        {/* Playhead — position updated directly via DOM ref, no React re-render = smooth */}
        <div
          ref={playheadRef}
          style={{
            position:"absolute",
            top:0, bottom:0,
            left: SIDEBAR_W, // initial position (t=0), updated by updatePlayheadDOM
            width:1, zIndex:40, pointerEvents:"none",
            willChange:"left", // GPU hint for smooth animation
          }}
        >
          <div style={{ position:"absolute", top:RULER_H-8, left:-5, width:0, height:0, borderLeft:"5px solid transparent", borderRight:"5px solid transparent", borderTop:"8px solid white" }} />
          <div style={{ position:"absolute", top:RULER_H, bottom:0, width:1, background:"rgba(255,255,255,0.88)" }} />
          <div style={{ position:"absolute", top:0, height:RULER_H, width:1, background:"rgba(255,255,255,0.22)" }} />
        </div>

        {/* THE single scroll container — overflow-x:scroll drives ruler + lanes together */}
        <div
          ref={scrollRef}
          style={{
            width:"100%", height:"100%",
            overflowX:"scroll", overflowY:"auto",
            WebkitOverflowScrolling:"touch",
            scrollbarWidth:"thin", scrollbarColor:"#2a2a2a #0a0a0a",
          }}
          onScroll={function(e){
            const sl = e.target.scrollLeft;
            if (!isPlayingRef.current) {
              const t = Math.max(0, sl / effectivePPS);
              setCurrentTime(t);
              playheadAtRef.current = t;
              updatePlayheadDOM(t, sl);
            } else {
              // During playback: playhead is driven by RAF, just update DOM position
              const actx = actxRef.current;
              const t = actx ? playheadAtRef.current + (actx.currentTime - masterStartRef.current) : playheadAtRef.current;
              updatePlayheadDOM(t, sl);
            }
          }}
        >
          {/* Inner content — wide enough for whole project */}
          <div style={{ minWidth: SIDEBAR_W + totalW + 400, position:"relative" }}>

            {/* ── RULER ROW — sticky top so it stays visible on vertical scroll ── */}
            <div style={{ display:"flex", position:"sticky", top:0, zIndex:25, height:RULER_H }}>

              {/* Sticky corner: TRACKS label */}
              <div style={{
                width:SIDEBAR_W, flexShrink:0,
                position:"sticky", left:0, zIndex:26,
                background:"#0a0a0a", borderRight:"1px solid #141414",
                borderBottom:"1px solid #1a1a1a",
                display:"flex", alignItems:"center", paddingLeft:10,
              }}>
                <span style={{ color:"#333", fontSize:9, fontWeight:700 }}>TRACKS</span>
              </div>

              {/* Ruler tick area — tap to seek */}
              <div
                style={{ flex:1, position:"relative", background:"#0c0c0c", borderBottom:"1px solid #1a1a1a", cursor:"col-resize", touchAction:"none" }}
                onMouseDown={handleRulerMouseDown}
                onTouchStart={handleRulerTouchStart}
                onTouchMove={handleRulerTouchMove}
              >
                {Array.from({length:numBars}, function(_,bi){
                  const bx = bi * spBar * effectivePPS;
                  return (
                    <div key={bi} style={{ position:"absolute", left:bx, top:0, bottom:0 }}>
                      <div style={{ position:"absolute", left:0, top:0, bottom:0, width:1, background:bi===0?"#555":"#1e1e1e" }} />
                      <span style={{ position:"absolute", top:5, left:4, color:"#555", fontSize:9, fontFamily:"monospace", fontWeight:700, userSelect:"none" }}>{bi+1}</span>
                      {Array.from({length:timeSigNum}, function(_,di){
                        if (di===0) return null;
                        return <div key={di} style={{ position:"absolute", left:di*spb*effectivePPS, top:Math.round(RULER_H*0.55), bottom:0, width:1, background:"#181818" }} />;
                      })}
                    </div>
                  );
                })}
                {loopEnabled&&loopOut>loopIn&&(
                  <div style={{ position:"absolute", left:loopIn*effectivePPS, width:(loopOut-loopIn)*effectivePPS, top:0, bottom:0, background:"rgba(59,130,246,0.1)", borderLeft:"2px solid #3B82F6", borderRight:"2px solid #3B82F6", pointerEvents:"none" }}>
                    <span style={{ position:"absolute", top:4, left:4, color:"#3B82F6", fontSize:8, fontWeight:700 }}>LOOP</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── TRACK ROWS ── each is a flex row: sticky header | lane ── */}
            {tracks.map(function(track){
              const isRec   = isRecording && recTrackId === track.id;
              const hasSolo = tracks.some(function(t){return t.isSoloed;});
              const dimmed  = hasSolo && !track.isSoloed;
              const clips   = track.clips || [];
              return (
                <div key={track.id} style={{ display:"flex", height:TRACK_H, borderBottom:"1px solid #0f0f0f", opacity:dimmed?0.4:1 }}>

                  {/* Track header — sticky left, never scrolls away horizontally */}
                  <div
                    onClick={function(){ setSelectedTrackId(track.id); }}
                    style={{
                      width:SIDEBAR_W, flexShrink:0,
                      position:"sticky", left:0, zIndex:10,
                      background:selectedTrackId===track.id?"rgba(192,38,211)":"#0a0a0a",
                      borderRight:"1px solid #141414",
                      padding:"5px 7px", display:"flex", flexDirection:"column", justifyContent:"space-between",
                      cursor:"pointer",
                    }}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <div style={{ width:7, height:7, borderRadius:"50%", background:isRec?"#EF4444":track.color, flexShrink:0 }} />
                      <span style={{ color:"white", fontSize:10, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{track.name}</span>
                      <span style={{ color:"#444", fontSize:9 }}>{track.type==="beat"?"🎵":"🎙"}</span>
                    </div>
                    <div style={{ display:"flex", gap:3, alignItems:"center" }}>
                      <button onClick={function(e){ e.stopPropagation(); toggleMute(track.id); }} style={{ background:track.isMuted?"rgba(245,158,11,0.2)":"#1a1a1a", border:"1px solid "+(track.isMuted?"#F59E0B":"#2a2a2a"), borderRadius:4, color:track.isMuted?"#F59E0B":"#555", fontSize:8, padding:"2px 4px", cursor:"pointer", fontWeight:700 }}>M</button>
                      <button onClick={function(e){ e.stopPropagation(); toggleSolo(track.id); }} style={{ background:track.isSoloed?"rgba(34,197,94,0.2)":"#1a1a1a", border:"1px solid "+(track.isSoloed?"#22C55E":"#2a2a2a"), borderRadius:4, color:track.isSoloed?"#22C55E":"#555", fontSize:8, padding:"2px 4px", cursor:"pointer", fontWeight:700 }}>S</button>
                      <button onClick={function(e){ e.stopPropagation(); setFxTrackId(function(v){ return v===track.id?null:track.id; }); }} style={{ background:fxTrackId===track.id?"rgba(139,92,246,0.2)":"#1a1a1a", border:"1px solid "+(fxTrackId===track.id?"#8B5CF6":"#2a2a2a"), borderRadius:4, color:fxTrackId===track.id?"#8B5CF6":"#555", fontSize:7, padding:"2px 4px", cursor:"pointer", fontWeight:700 }}>FX</button>
                      {track.clips&&track.clips.length>1&&(
                        <button onClick={function(e){ e.stopPropagation(); setShowTakes(function(v){ return v===track.id?null:track.id; }); }} style={{ background:showTakes===track.id?"rgba(59,130,246,0.2)":"#1a1a1a", border:"1px solid "+(showTakes===track.id?"#3B82F6":"#2a2a2a"), borderRadius:4, color:showTakes===track.id?"#3B82F6":"#555", fontSize:7, padding:"2px 4px", cursor:"pointer", fontWeight:700 }}>{track.clips.length}✦</button>
                      )}
                      <button onClick={function(e){ e.stopPropagation(); removeTrack(track.id); }} style={{ background:"none", border:"none", color:"#333", fontSize:10, cursor:"pointer", marginLeft:"auto", padding:"0 2px" }}>✕</button>
                    </div>
                  </div>

                  {/* Lane outer — overflow:visible for trim handles only */}
                  <div style={{
                    position:"relative", flex:1,
                    overflow:"visible",
                    isolation:"isolate",
                  }}
                    onClick={function(e){
                      deselectClip(e);
                      // Clear multi-selection when clicking empty space —
                      // check both the outer lane and the inner mask (which covers the full area)
                      const t = e.target;
                      const isClip = t && t.closest && t.closest("[data-clipid]");
                      if (!isClip) { setSelBox(null); setSelClipIds(new Set()); }
                    }}
                    onTouchStart={function(e){ handleLaneLongPress(e, track); }}
                  >

                    {/* ── INNER MASK — hard overflow:hidden, everything inside is clipped ── */}
                    <div style={{ position:"absolute", inset:0, overflow:"hidden", background:"#0a0a0a" }}>
                      {/* Beat grid */}
                      {Array.from({length:Math.ceil(totalDur/spb)+1}, function(_,i){
                        return <div key={i} style={{ position:"absolute", left:i*spb*effectivePPS, top:0, bottom:0, width:1, background:i%timeSigNum===0?"#191919":"#131313", pointerEvents:"none" }} />;
                      })}
                      {/* Recording trail — inside mask, can never bleed left */}
                      {isRec&&recTrail.length>0&&(
                        <div style={{ position:"absolute", left:Math.max(0,currentTime*effectivePPS-recTrail.length*2), top:4, height:TRACK_H-8, display:"flex", alignItems:"center", pointerEvents:"none" }}>
                          {recTrail.map(function(v,i){ return <div key={i} style={{ width:2, background:track.color||"#EF4444", borderRadius:1, height:Math.max(2,v*(TRACK_H-12)), opacity:0.4+0.6*(i/recTrail.length) }} />; })}
                        </div>
                      )}
                      {/* Clip bodies — inside mask so waveforms never bleed outside lane */}
                      {clips.map(function(clip){
                        if (!clip.audioBuffer) return null;
                        const trimS   = clip.trimStart || 0;
                        const trimE   = clip.trimEnd !== undefined ? clip.trimEnd : (clip.audioBuffer ? clip.audioBuffer.duration : clip.duration || 2);
                        const clipW   = Math.max(20, (trimE - trimS) * effectivePPS);
                        const clipL   = Math.max(0, (clip.startTime || 0) * effectivePPS);
                        const playedF = Math.max(0, Math.min(1, (currentTime - (clip.startTime||0)) / (trimE - trimS || 1)));
                        const isSel      = selectedClipId === clip.id;
                        const isActv     = clip.active !== false;
                        const isMultiSel = selClipIds.has(clip.id);
                        return (
                          <div
                            key={clip.id + "_body"}
                            data-clipid={clip.id}
                            onClick={function(e){ e.stopPropagation(); selectClip(clip.id); }}
                            onMouseDown={function(e){ handleRegionMouseDown(e, track, clip); }}
                            onTouchStart={function(e){ handleRegionTouchStart(e, track, clip); }}
                            onContextMenu={function(e){ handleRegionRightClick(e, track, clip); }}
                            style={{
                              position:"absolute", left:clipL, top:3, width:clipW, height:TRACK_H-6,
                              borderRadius:6, overflow:"hidden", touchAction:"none",
                              background: isActv ? "#111" : "#0a0a0a",
                              border: isMultiSel ? "2px solid #FACC15" : isSel ? "2px solid "+track.color : "1.5px solid "+(isActv?track.color+"66":track.color+"22"),
                              boxShadow: isMultiSel ? "0 0 10px rgba(250,204,21,0.4)" : isSel ? "inset 0 0 0 1px "+track.color+"33" : "none",
                              opacity: isActv ? 1 : 0.3,
                              cursor:"grab", zIndex: isMultiSel ? 3 : isActv ? 2 : 1,
                              transition:"border 0.12s, box-shadow 0.12s",
                            }}
                          >
                            <WaveformCanvas audioBuffer={clip.audioBuffer} color={track.color}
                              width={Math.max(1,Math.round(clipW))} height={TRACK_H-6}
                              playedFraction={playedF} dim={!isActv}
                              trimStart={trimS} trimEnd={trimE} />
                            <div style={{ position:"absolute", bottom:2, left:6, right:isSel?14:6, color:"rgba(255,255,255,0.85)", fontSize:7, fontWeight:700, pointerEvents:"none", textShadow:"0 1px 3px rgba(0,0,0,0.95)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {clip.label}{!isActv?" (inactive)":""}
                            </div>
                            {isSel&&<div style={{ position:"absolute", top:3, right:3, width:5, height:5, borderRadius:"50%", background:track.color, pointerEvents:"none" }} />}
                          </div>
                        );
                      })}
                    </div>{/* end inner mask */}

                    {/* ── TRIM HANDLES — in outer overflow:visible div, positioned to match clip bodies ── */}
                    {clips.map(function(clip){
                      if (!clip.audioBuffer) return null;
                      const trimS  = clip.trimStart || 0;
                      const trimE  = clip.trimEnd !== undefined ? clip.trimEnd : (clip.audioBuffer ? clip.audioBuffer.duration : clip.duration || 2);
                      const clipW  = Math.max(20, (trimE - trimS) * effectivePPS);
                      const clipL  = Math.max(0, (clip.startTime || 0) * effectivePPS);
                      const bufDur = clip.audioBuffer ? clip.audioBuffer.duration : (clip.duration || 2);
                      const isSel  = selectedClipId === clip.id;
                      const pps    = effectivePPS;
                      return (
                        <div key={clip.id+"_handles"} style={{ position:"absolute", left:clipL, top:3, width:clipW, height:TRACK_H-6, pointerEvents:"none", zIndex:3 }}>
                          {/* Left */}
                          <div style={{ position:"absolute", left:-10, top:0, bottom:0, width:18, cursor:"ew-resize", display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"all", touchAction:"none" }}
                            onMouseDown={function(e){
                              e.stopPropagation(); e.preventDefault();
                              const x0=e.clientX, ts0=trimS, cs0=clip.startTime||0;
                              const mv=function(me){ const d=(me.clientX-x0)/pps; const ts=Math.max(0,Math.min(ts0+d,trimE-0.05)); updateClip(track.id,clip.id,{trimStart:+ts.toFixed(4),startTime:Math.max(0,+(cs0+(ts-ts0)).toFixed(4))}); };
                              const up=function(){ document.removeEventListener("mousemove",mv); document.removeEventListener("mouseup",up); };
                              document.addEventListener("mousemove",mv); document.addEventListener("mouseup",up);
                            }}
                            onTouchStart={function(e){
                              e.stopPropagation(); e.preventDefault();
                              const x0=e.touches[0].clientX, ts0=trimS, cs0=clip.startTime||0;
                              const mv=function(te){ const d=(te.touches[0].clientX-x0)/pps; const ts=Math.max(0,Math.min(ts0+d,trimE-0.05)); updateClip(track.id,clip.id,{trimStart:+ts.toFixed(4),startTime:Math.max(0,+(cs0+(ts-ts0)).toFixed(4))}); };
                              const up=function(){ document.removeEventListener("touchmove",mv); document.removeEventListener("touchend",up); };
                              document.addEventListener("touchmove",mv,{passive:false}); document.addEventListener("touchend",up,{passive:true});
                            }}
                          ><div style={{ width:4, height:26, borderRadius:3, background:track.color, opacity:isSel?1:0.5, boxShadow:"0 0 5px "+track.color+"88" }} /></div>
                          {/* Right */}
                          <div style={{ position:"absolute", right:-10, top:0, bottom:0, width:18, cursor:"ew-resize", display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"all", touchAction:"none" }}
                            onMouseDown={function(e){
                              e.stopPropagation(); e.preventDefault();
                              const x0=e.clientX, te0=trimE;
                              const mv=function(me){ const te=Math.max(trimS+0.05,Math.min(te0+(me.clientX-x0)/pps,bufDur)); updateClip(track.id,clip.id,{trimEnd:+te.toFixed(4)}); };
                              const up=function(){ document.removeEventListener("mousemove",mv); document.removeEventListener("mouseup",up); };
                              document.addEventListener("mousemove",mv); document.addEventListener("mouseup",up);
                            }}
                            onTouchStart={function(e){
                              e.stopPropagation(); e.preventDefault();
                              const x0=e.touches[0].clientX, te0=trimE;
                              const mv=function(te){ const newTE=Math.max(trimS+0.05,Math.min(te0+(te.touches[0].clientX-x0)/pps,bufDur)); updateClip(track.id,clip.id,{trimEnd:+newTE.toFixed(4)}); };
                              const up=function(){ document.removeEventListener("touchmove",mv); document.removeEventListener("touchend",up); };
                              document.addEventListener("touchmove",mv,{passive:false}); document.addEventListener("touchend",up,{passive:true});
                            }}
                          ><div style={{ width:4, height:26, borderRadius:3, background:track.color, opacity:isSel?1:0.5, boxShadow:"0 0 5px "+track.color+"88" }} /></div>
                        </div>
                      );
                    })}

                  </div>{/* end lane outer */}
                </div>
              );
            })}

            {/* Add track row */}
            <div style={{ display:"flex", height:48, borderBottom:"1px solid #111" }}>
              <div style={{ width:SIDEBAR_W, flexShrink:0, position:"sticky", left:0, zIndex:10, background:"#0a0a0a", borderRight:"1px solid #141414" }}>
                <button onClick={function(e){ e.stopPropagation(); setShowAddMenu(function(v){return !v;}); }} style={{ width:"100%", height:"100%", background:"transparent", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ color:showAddMenu?"#C026D3":"#444", fontSize:24, fontWeight:300 }}>+</span>
                </button>
              </div>
              <div style={{ flex:1, background:"#090909" }} />
            </div>

          </div>{/* end inner */}
        </div>{/* end scroll container */}
      {/* ── Lasso selection box overlay — inside DAW wrapper so coords match ── */}
      {selBox && selBox.w > 4 && selBox.h > 4 && (
        <div style={{
          position:"absolute",
          left: selBox.x - (scrollRef.current ? scrollRef.current.scrollLeft : 0),
          top:  selBox.y,
          width: selBox.w,
          height: selBox.h,
          border: "2px solid #FACC15",
          background: "rgba(250,204,21,0.08)",
          borderRadius: 4,
          pointerEvents: "none",
          zIndex: 500,
        }} />
      )}
      </div>{/* end DAW layout */}

      {/* ── Multi-select action bar ──────────────────────────────────────────── */}
      {selClipIds.size > 0 && (
        <div style={{
          position:"absolute", bottom: 90, left:"50%", transform:"translateX(-50%)",
          zIndex: 600,
          background:"#1c1c1c", border:"1px solid #333",
          borderRadius:20, padding:"10px 18px",
          display:"flex", alignItems:"center", gap:12,
          boxShadow:"0 8px 32px rgba(0,0,0,0.9)",
        }}>
          <span style={{ color:"#FACC15", fontSize:12, fontWeight:700 }}>
            {selClipIds.size} clip{selClipIds.size > 1 ? "s" : ""} selected
          </span>
          <div style={{ width:1, height:20, background:"#333" }} />
          <button
            onClick={duplicateSelectedClips}
            style={{ background:"rgba(250,204,21,0.1)", border:"1px solid rgba(250,204,21,0.3)", borderRadius:10, color:"#FACC15", fontSize:13, fontWeight:700, padding:"8px 14px", cursor:"pointer" }}
          >⧉ Duplicate</button>
          <button
            onClick={deleteSelectedClips}
            style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, color:"#EF4444", fontSize:13, fontWeight:700, padding:"8px 14px", cursor:"pointer" }}
          >🗑 Delete</button>
          <button
            onClick={function(){ setSelClipIds(new Set()); setSelBox(null); }}
            style={{ background:"none", border:"none", color:"#555", fontSize:18, cursor:"pointer", padding:"0 4px", lineHeight:1 }}
          >✕</button>
        </div>
      )}

      {/* Add menu popup */}
      {showAddMenu&&(
        <div style={{ position:"absolute",bottom:90,left:12,zIndex:400,background:"#1c1c1c",border:"1px solid #2a2a2a",borderRadius:14,overflow:"hidden",minWidth:220,boxShadow:"0 8px 32px rgba(0,0,0,0.8)" }} onClick={function(e){ e.stopPropagation(); }}>
          <div style={{ padding:"10px 16px 6px",color:"#555",fontSize:10,fontWeight:700 }}>ADD TO PROJECT</div>
          <label style={{ display:"block",cursor:"pointer" }}>
            <div style={{ padding:"12px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid #1a1a1a" }}>
              <div style={{ width:32,height:32,borderRadius:8,background:"rgba(59,130,246,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>🎵</div>
              <div><div style={{ color:"white",fontWeight:700,fontSize:13 }}>Upload Audio</div><div style={{ color:"#555",fontSize:11 }}>Beat, vocal, any audio file</div></div>
            </div>
            <input type="file" accept=".mp3,.wav,.m4a,.aac,audio/*" multiple onChange={function(e){handleFileUpload(e,"beat");}} style={{ display:"none" }} />
          </label>
          <div style={{ padding:"12px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer" }} onClick={function(){
            // Just create the track — recording only starts when user presses record button
            const newId = Date.now() + Math.random();
            const vocalN = tracks.filter(function(t){return t.type==="vocal";}).length + 1;
            addTrackObj({ id:newId, name:"Vocal "+vocalN, type:"vocal", isMuted:false, isSoloed:false, clips:[], color:VOCAL_COLORS[vocalN % VOCAL_COLORS.length] });
            setSelectedTrackId(newId);
            setShowAddMenu(false);
          }}>
            <div style={{ width:32,height:32,borderRadius:8,background:"rgba(239,68,68,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>🎙</div>
            <div><div style={{ color:"white",fontWeight:700,fontSize:13 }}>Record Vocals</div><div style={{ color:"#555",fontSize:11 }}>Record new take</div></div>
          </div>
        </div>
      )}

      {/* ══ FX PANEL ═══════════════════════════════════════════ */}
      {fxTrackId && (function(){
        const t = tracks.find(function(tr){ return tr.id===fxTrackId; });
        if (!t) return null;
        const fx = t.effects || {};
        const upd = function(section, patch){
          const newEffects = { ...t.effects, [section]:{ ...(t.effects[section]||{}), ...patch } };
          updateTrack(t.id, { effects: newEffects });
          // Apply changes to live audio nodes immediately — no playback restart needed
          applyFxLive(t.id, newEffects);
        };

        // ── Rotary Knob — arc and track share identical radius + strokeWidth ──
        const Knob = function({ label, value, min, max, step, unit, onChange, color }) {
          const startRef = useRef(null);
          color = color || "#8B5CF6";
          const norm  = Math.max(0, Math.min(1, (value - min) / (max - min)));
          const angle = -140 + norm * 280;  // sweeps from -140° to +140° (280° total arc)

          // Geometry: r is the CENTRE radius of the stroke.
          // Both track circle and arc path use identical r and strokeWidth so they overlay exactly.
          const SW = 4;       // strokeWidth — same for track AND arc
          const r  = 20;      // arc/circle radius to stroke centre
          const PAD = SW / 2 + 2; // padding = half stroke + 2px safety margin
          const cx = r + PAD, cy = r + PAD;
          const SIZE = (r + PAD) * 2;  // total SVG width/height

          const toXY = function(deg) {
            const rad = (deg - 90) * Math.PI / 180;
            return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
          };
          const startA = toXY(-140);
          const endA   = toXY(angle);
          // largeArc: the swept angle is (angle - (-140)) = angle + 140.
          // Large arc flag should be 1 when swept angle > 180°, i.e. angle > 40°
          const sweptDeg  = angle - (-140);  // always 0..280
          const largeArc  = sweptDeg > 180 ? 1 : 0;
          const arcD = `M ${startA.x.toFixed(2)} ${startA.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${endA.x.toFixed(2)} ${endA.y.toFixed(2)}`;

          const onPointerDown = function(e) {
            e.preventDefault();
            startRef.current = { y: e.clientY, val: value };
            const onMove = function(me) {
              const dy  = startRef.current.y - me.clientY;
              const raw = startRef.current.val + (dy / 100) * (max - min);
              const clamped = Math.min(max, Math.max(min, raw));
              const snapped = step ? Math.round(clamped / step) * step : clamped;
              onChange(+snapped.toFixed(3));
            };
            const onUp = function() {
              document.removeEventListener("pointermove", onMove);
              document.removeEventListener("pointerup",  onUp);
            };
            document.addEventListener("pointermove", onMove);
            document.addEventListener("pointerup",   onUp);
          };

          const display = unit === "dB" ? (value >= 0 ? "+" : "") + value + "dB"
                        : unit === "%" ? Math.round(value * 100) + "%"
                        : unit === "ms" ? value + "ms"
                        : unit === ":1" ? value + ":1"
                        : unit === "Q"  ? value
                        : unit === " st" ? (value >= 0 ? "+" : "") + value + " st"
                        : value + (unit || "");

          return (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, userSelect:"none" }}>
              {/* viewBox matches SIZE exactly; overflow:visible lets the dot glow bleed out */}
              <svg
                width={SIZE} height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                style={{ overflow:"visible", cursor:"ns-resize", touchAction:"none" }}
                onPointerDown={onPointerDown}
              >
                {/* Track — identical strokeWidth to arc */}
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e1e" strokeWidth={SW} strokeLinecap="round"
                  strokeDasharray={`${2*Math.PI*r * 280/360} ${2*Math.PI*r}`}
                  strokeDashoffset={`${2*Math.PI*r * (90+140)/360}`}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
                {/* Coloured arc — sweeps from startA to endA */}
                {norm > 0 && <path d={arcD} fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" />}
                {/* End dot — sits exactly on the arc */}
                <circle cx={endA.x} cy={endA.y} r={SW * 0.9} fill={color} />
                {/* Centre cap */}
                <circle cx={cx} cy={cy} r={r * 0.42} fill="#0d0d0d" stroke="#2a2a2a" strokeWidth={1.5} />
              </svg>
              <div style={{ color:"white", fontSize:9, fontWeight:700, lineHeight:1 }}>{display}</div>
              <div style={{ color:"#444", fontSize:7, textAlign:"center", lineHeight:1.2 }}>{label}</div>
            </div>
          );
        };

        // ── 5-band EQ Graph with accurate Bezier filter response ──
        // =================================================================
        // PRODUCTION 5-BAND PARAMETRIC EQ
        // Based on Audio EQ Cookbook (Bristow-Johnson)
        // https://www.w3.org/TR/audio-eq-cookbook/
        //
        // Bug fixes vs previous version:
        //  1. freqToX was wrong: log10(f/20)/log10(1000) ≠ log-scale 20Hz-20kHz
        //     Fix: divide by log10(20000/20) = log10(1000) = 3 — actually that
        //     WAS correct BUT the freq range was 20-20000 not 20-20020, AND
        //     low/high shelf had hardcoded freq (200Hz, 4000Hz) ignoring params.
        //  2. bandMag used wrong phi formula — produces NaN near Nyquist
        //     Fix: exact z-domain complex evaluation (Re²+Im²) per band
        //  3. Cascaded dB sum is correct (logs are additive for cascade)
        //  4. All 5 bands now fully parametric (freq movable on all bands)
        // =================================================================
        const EQ_SR = 44100;

        // Normalised biquad coefficients — a0 divided out (always 1)
        const eqCalcCoeffs = function(type, freq, gainDB, Q) {
          const f  = Math.max(10, Math.min(freq, EQ_SR * 0.499));
          const w0 = 2 * Math.PI * f / EQ_SR;
          const cw = Math.cos(w0), sw = Math.sin(w0);
          const A  = Math.pow(10, gainDB / 40);
          const aq = sw / (2 * Math.max(0.001, Q));
          let b0,b1,b2,a0,a1,a2;
          if (type === "peaking") {
            b0=1+aq*A; b1=-2*cw; b2=1-aq*A; a0=1+aq/A; a1=-2*cw; a2=1-aq/A;
          } else if (type === "lowshelf") {
            const sa=2*Math.sqrt(A)*aq;
            b0=A*((A+1)-(A-1)*cw+sa); b1=2*A*((A-1)-(A+1)*cw); b2=A*((A+1)-(A-1)*cw-sa);
            a0=(A+1)+(A-1)*cw+sa; a1=-2*((A-1)+(A+1)*cw); a2=(A+1)+(A-1)*cw-sa;
          } else if (type === "highshelf") {
            const sa=2*Math.sqrt(A)*aq;
            b0=A*((A+1)+(A-1)*cw+sa); b1=-2*A*((A-1)+(A+1)*cw); b2=A*((A+1)+(A-1)*cw-sa);
            a0=(A+1)-(A-1)*cw+sa; a1=2*((A-1)-(A+1)*cw); a2=(A+1)-(A-1)*cw-sa;
          } else if (type === "highpass") {
            b0=(1+cw)/2; b1=-(1+cw); b2=(1+cw)/2; a0=1+aq; a1=-2*cw; a2=1-aq;
          } else { // lowpass
            b0=(1-cw)/2; b1=1-cw; b2=(1-cw)/2; a0=1+aq; a1=-2*cw; a2=1-aq;
          }
          if (Math.abs(a0) < 1e-30) return { b0:1, b1:0, b2:0, a1:0, a2:0 };
          return { b0:b0/a0, b1:b1/a0, b2:b2/a0, a1:a1/a0, a2:a2/a0 };
        };

        // Exact z-domain magnitude |H(e^jw)|² — numerically stable at all freqs
        const eqEvalMag = function(c, f) {
          const w   = 2 * Math.PI * Math.max(1, f) / EQ_SR;
          const cw  = Math.cos(w),  sw  = Math.sin(w);
          const cw2 = Math.cos(2*w), sw2 = Math.sin(2*w);
          const bRe = c.b0 + c.b1*cw + c.b2*cw2;
          const bIm =        c.b1*sw + c.b2*sw2;
          const aRe = 1    + c.a1*cw + c.a2*cw2;
          const aIm =        c.a1*sw + c.a2*sw2;
          const den = aRe*aRe + aIm*aIm;
          if (den < 1e-30) return 0;
          return 20 * Math.log10(Math.sqrt((bRe*bRe + bIm*bIm) / den));
        };

        const EQGraph = function({ eq, onDrag }) {
          const W = 300, H = 130;

          const bands = [
            { key:"hpf",  type:"highpass",  freq:eq.hpfFreq||80,    gain:0,          q:eq.hpfQ||0.707,  color:"#EF4444", drag:"x",  label:"HPF" },
            { key:"low",  type:"lowshelf",  freq:eq.lowFreq||200,   gain:eq.low||0,  q:eq.lowQ||0.707,  color:"#3B82F6", drag:"xy", label:"LOW" },
            { key:"mid",  type:"peaking",   freq:eq.midFreq||1000,  gain:eq.mid||0,  q:eq.midQ||1.0,    color:"#22C55E", drag:"xy", label:"MID" },
            { key:"high", type:"highshelf", freq:eq.highFreq||8000, gain:eq.high||0, q:eq.highQ||0.707, color:"#F59E0B", drag:"xy", label:"HI"  },
            { key:"lpf",  type:"lowpass",   freq:eq.lpfFreq||18000, gain:0,          q:eq.lpfQ||0.707,  color:"#EF4444", drag:"x",  label:"LPF" },
          ];

          // Log-correct X axis: 20Hz at left, 20kHz at right
          const LOG_RANGE = Math.log10(20000 / 20);
          const freqToX = function(f) { return W * Math.log10(Math.max(20,f) / 20) / LOG_RANGE; };
          const xToFreq = function(x) { return Math.round(20 * Math.pow(20000/20, Math.max(0,Math.min(1,x/W)))); };
          const gainToY = function(g) { return H/2 - (Math.max(-15,Math.min(15,g)) / 15) * (H/2 - 10); };
          const yToGain = function(y) { return +((H/2-y)/(H/2-10)*15).toFixed(1); };

          // Build composite response curve — sum dB magnitudes (correct for cascade)
          const nPts = 180;
          const pts  = [];
          for (let i = 0; i <= nPts; i++) {
            const f = 20 * Math.pow(20000/20, i/nPts);
            let db = 0;
            bands.forEach(function(b){ db += eqEvalMag(eqCalcCoeffs(b.type,b.freq,b.gain,b.q), f); });
            pts.push([freqToX(f), gainToY(Math.max(-18,Math.min(18,db)))]);
          }

          // Catmull-Rom to cubic bezier for smooth curve
          let path = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
          for (let i=1; i<pts.length-1; i++) {
            const [x0,y0]=pts[i-1], [x1,y1]=pts[i], [x2,y2]=pts[i+1];
            path += ` C ${((x0+x1)/2).toFixed(1)} ${y0.toFixed(1)} ${((x1+x2)/2).toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
          }
          const [lx,ly]=pts[pts.length-1]; path += ` L ${lx.toFixed(1)} ${ly.toFixed(1)}`;
          const fill = path + ` L ${W} ${H/2} L 0 ${H/2} Z`;

          const dragging = useRef(null);
          const svgRef   = useRef(null);

          return (
            <svg ref={svgRef} width={W} height={H}
              style={{ display:"block", background:"#060606", borderRadius:8, touchAction:"none", cursor:"crosshair" }}
              onMouseMove={function(e){
                const b=dragging.current; if(!b||!svgRef.current) return;
                const r=svgRef.current.getBoundingClientRect();
                const x=e.clientX-r.left, y=e.clientY-r.top;
                const patch={};
                if(b.drag==="x"||b.drag==="xy"){
                  const f=xToFreq(x);
                  if(b.key==="hpf") patch.hpfFreq=Math.max(20,Math.min(2000,f));
                  if(b.key==="lpf") patch.lpfFreq=Math.max(1000,Math.min(20000,f));
                  if(b.key==="low") patch.lowFreq=Math.max(20,Math.min(2000,f));
                  if(b.key==="mid") patch.midFreq=Math.max(100,Math.min(10000,f));
                  if(b.key==="high") patch.highFreq=Math.max(500,Math.min(20000,f));
                }
                if(b.drag==="y"||b.drag==="xy"){
                  const g=Math.max(-15,Math.min(15,yToGain(y)));
                  if(b.key==="low") patch.low=g;
                  if(b.key==="mid") patch.mid=g;
                  if(b.key==="high") patch.high=g;
                }
                if(Object.keys(patch).length) onDrag(patch);
              }}
              onMouseUp={function(){dragging.current=null;}}
              onMouseLeave={function(){dragging.current=null;}}
              onTouchMove={function(e){
                e.preventDefault();
                const b=dragging.current; if(!b||!svgRef.current) return;
                const r=svgRef.current.getBoundingClientRect();
                const x=e.touches[0].clientX-r.left, y=e.touches[0].clientY-r.top;
                const patch={};
                if(b.drag==="x"||b.drag==="xy"){
                  const f=xToFreq(x);
                  if(b.key==="hpf") patch.hpfFreq=Math.max(20,Math.min(2000,f));
                  if(b.key==="lpf") patch.lpfFreq=Math.max(1000,Math.min(20000,f));
                  if(b.key==="low") patch.lowFreq=Math.max(20,Math.min(2000,f));
                  if(b.key==="mid") patch.midFreq=Math.max(100,Math.min(10000,f));
                  if(b.key==="high") patch.highFreq=Math.max(500,Math.min(20000,f));
                }
                if(b.drag==="y"||b.drag==="xy"){
                  const g=Math.max(-15,Math.min(15,yToGain(y)));
                  if(b.key==="low") patch.low=g;
                  if(b.key==="mid") patch.mid=g;
                  if(b.key==="high") patch.high=g;
                }
                if(Object.keys(patch).length) onDrag(patch);
              }}
              onTouchEnd={function(){dragging.current=null;}}
            >
              {/* Frequency grid */}
              {[20,50,100,200,500,1000,2000,5000,10000,20000].map(function(f){
                const x=freqToX(f); const major=[100,1000,10000].includes(f);
                return <line key={f} x1={x} y1={0} x2={x} y2={H} stroke={major?"#1e1e1e":"#111"} strokeWidth={major?1.5:1}/>;
              })}
              {/* Gain grid */}
              {[-12,-6,0,6,12].map(function(g){
                const y=gainToY(g);
                return <g key={g}>
                  <line x1={0} y1={y} x2={W} y2={y} stroke={g===0?"#252525":"#141414"} strokeWidth={g===0?1.5:1}/>
                  <text x={3} y={y-2} fill="#222" fontSize={7}>{g>0?"+":""}{g}</text>
                </g>;
              })}
              {/* Frequency labels */}
              {[100,1000,10000].map(function(f){
                return <text key={f} x={freqToX(f)} y={H-3} fill="#222" fontSize={7} textAnchor="middle">{f>=1000?f/1000+"k":f}</text>;
              })}
              <path d={fill} fill="rgba(147,51,234,0.07)"/>
              <path d={path} fill="none" stroke="#9333EA" strokeWidth={2} strokeLinecap="round"/>
              {bands.map(function(b){
                const hx=freqToX(b.freq), hy=gainToY(b.gain);
                const cur=b.drag==="x"?"ew-resize":b.drag==="y"?"ns-resize":"move";
                return <g key={b.key}>
                  <line x1={hx} y1={0} x2={hx} y2={H} stroke={b.color+"28"} strokeWidth={1} strokeDasharray="3 3"/>
                  <circle cx={hx} cy={hy} r={12} fill={b.color+"10"} stroke={b.color+"28"} strokeWidth={1}/>
                  <circle cx={hx} cy={hy} r={8} fill={b.color} fillOpacity={0.9} stroke="#060606" strokeWidth={2}
                    style={{cursor:cur}}
                    onMouseDown={function(e){e.preventDefault();e.stopPropagation();dragging.current=b;}}
                    onTouchStart={function(e){e.preventDefault();e.stopPropagation();dragging.current=b;}}/>
                  <text x={hx} y={hy+3} fill="white" fontSize={6} textAnchor="middle" fontWeight="800" pointerEvents="none">{b.label}</text>
                </g>;
              })}
            </svg>
          );
        };

        // ── Compressor curve ──
        const CompGraph = function({ threshold, ratio }) {
          const W = 150, H = 110;
          const dBtoP = function(db) { return (db + 60) / 60; };
          const pts = [];
          for (let i = 0; i <= 60; i++) {
            const inDb = -60 + i;
            const outDb = inDb < threshold ? inDb : threshold + (inDb - threshold) / ratio;
            pts.push(`${W*dBtoP(inDb)},${H*(1-dBtoP(outDb))}`);
          }
          const thX = W * dBtoP(threshold);
          return (
            <svg width={W} height={H} style={{ display:"block", background:"#080808", borderRadius:8, flexShrink:0 }}>
              <line x1={0} y1={H} x2={W} y2={0} stroke="#1e1e1e" strokeWidth={1} strokeDasharray="4 3" />
              <path d={"M "+pts.join(" L ")} fill="none" stroke="#8B5CF6" strokeWidth={2} strokeLinecap="round" />
              <path d={"M "+pts.join(" L ")+` L ${W} ${H} L 0 ${H} Z`} fill="rgba(139,92,246,0.1)" />
              <line x1={thX} y1={0} x2={thX} y2={H} stroke="#EF4444" strokeWidth={1} strokeDasharray="3 2" />
              <text x={thX+3} y={11} fill="#EF4444" fontSize={8}>{threshold}dB</text>
              <text x={3}   y={10}  fill="#444" fontSize={7}>OUT</text>
              <text x={W-22} y={H-3} fill="#444" fontSize={7}>IN</text>
            </svg>
          );
        };

        // ── Reverb visualiser ──
        const ReverbViz = function({ wet, roomSize }) {
          const W = 140, H = 80;
          const decay = roomSize * 3;
          return (
            <svg width={W} height={H} style={{ display:"block", background:"#080808", borderRadius:8, flexShrink:0 }}>
              <line x1={0} y1={H/2} x2={W} y2={H/2} stroke="#1a1a1a" strokeWidth={1} />
              {Array.from({length:28}, function(_,i){
                const x   = (i/27)*W;
                const amp = Math.exp(-i/(decay*4)) * (H/2 - 5) * wet;
                const j   = (Math.sin(i*7.3)*0.4+0.6) * amp;
                return <line key={i} x1={x} y1={H/2-j} x2={x} y2={H/2+j}
                  stroke={`rgba(192,38,211,${0.25+0.75*Math.exp(-i/5)})`} strokeWidth={2} />;
              })}
            </svg>
          );
        };

        // ── EQ defaults including new 5-band fields ──
        const eq5 = {
          hpfFreq:80, hpfQ:0.707,
          lowFreq:200, low:0, lowQ:0.707,
          midFreq:1000, mid:0, midQ:1.0,
          highFreq:8000, high:0, highQ:0.707,
          lpfFreq:18000, lpfQ:0.707,
          ...fx.eq,
        };

        return (
          <div style={{ position:"absolute", inset:0, zIndex:800, background:"rgba(0,0,0,0.97)", display:"flex", flexDirection:"column", overflowY:"auto" }} onClick={function(e){ e.stopPropagation(); }}>
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:"1px solid #1e1e1e", background:"#0a0a0a", flexShrink:0, position:"sticky", top:0, zIndex:10 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:t.color, marginRight:8 }} />
              <span style={{ color:"white", fontWeight:800, fontSize:14, flex:1 }}>{t.name} — Effects</span>
              <button onClick={function(){ setFxTrackId(null); }} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, color:"#888", fontSize:13, padding:"5px 14px", cursor:"pointer" }}>Done</button>
            </div>

            <div style={{ flex:1, padding:"14px", display:"flex", flexDirection:"column", gap:12 }}>

              {/* ── 5-BAND EQ ── */}
              <div style={{ background:"#111", borderRadius:14, overflow:"hidden", border:"1px solid "+(eq5.on?"#3B82F6":"#1e1e1e") }}>
                <div style={{ display:"flex", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid #1e1e1e", gap:8 }}>
                  <span style={{ color:"#3B82F6", fontWeight:800, fontSize:12, letterSpacing:2 }}>EQ</span>
                  <span style={{ color:"#333", fontSize:10, flex:1 }}>5-Band Parametric</span>
                  <span style={{ color:"#444", fontSize:9 }}>Drag handles</span>
                  <button onClick={function(){ upd("eq",{on:!fx.eq?.on}); }}
                    style={{ background:fx.eq?.on?"#3B82F6":"#222", border:"none", borderRadius:6, color:"white", fontSize:10, fontWeight:700, padding:"4px 10px", cursor:"pointer" }}>
                    {fx.eq?.on ? "ON" : "OFF"}
                  </button>
                </div>
                <div style={{ padding:"12px 14px", opacity:fx.eq?.on?1:0.35 }}>
                  <EQGraph eq={eq5} onDrag={function(patch){ upd("eq", patch); }} />
                  {/* Stacked freq+gain pairs — fits mobile width without scrolling */}
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:12, gap:2 }}>
                    {/* HPF — only frequency */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                      <div style={{ color:"#EF4444", fontSize:7, fontWeight:800, letterSpacing:1 }}>HPF</div>
                      <Knob label="Hz" value={eq5.hpfFreq} min={20} max={2000} step={1} unit="Hz" color="#EF4444"
                        onChange={function(v){ upd("eq",{hpfFreq:v}); }} />
                    </div>
                    <div style={{ width:1, background:"#1a1a1a", alignSelf:"stretch", margin:"0 1px" }} />
                    {/* LOW — freq + gain stacked */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                      <div style={{ color:"#3B82F6", fontSize:7, fontWeight:800, letterSpacing:1 }}>LOW</div>
                      <Knob label="Hz" value={eq5.lowFreq} min={20} max={2000} step={1} unit="Hz" color="#3B82F6"
                        onChange={function(v){ upd("eq",{lowFreq:v}); }} />
                      <Knob label="dB" value={eq5.low} min={-15} max={15} step={0.5} unit="dB" color="#3B82F6"
                        onChange={function(v){ upd("eq",{low:v}); }} />
                    </div>
                    <div style={{ width:1, background:"#1a1a1a", alignSelf:"stretch", margin:"0 1px" }} />
                    {/* MID — freq + gain + Q stacked */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                      <div style={{ color:"#22C55E", fontSize:7, fontWeight:800, letterSpacing:1 }}>MID</div>
                      <Knob label="Hz" value={eq5.midFreq} min={100} max={10000} step={10} unit="Hz" color="#22C55E"
                        onChange={function(v){ upd("eq",{midFreq:v}); }} />
                      <Knob label="dB" value={eq5.mid} min={-15} max={15} step={0.5} unit="dB" color="#22C55E"
                        onChange={function(v){ upd("eq",{mid:v}); }} />
                      <Knob label="Q" value={eq5.midQ} min={0.1} max={10} step={0.1} unit="Q" color="#22C55E"
                        onChange={function(v){ upd("eq",{midQ:v}); }} />
                    </div>
                    <div style={{ width:1, background:"#1a1a1a", alignSelf:"stretch", margin:"0 1px" }} />
                    {/* HIGH — freq + gain stacked */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                      <div style={{ color:"#F59E0B", fontSize:7, fontWeight:800, letterSpacing:1 }}>HIGH</div>
                      <Knob label="Hz" value={eq5.highFreq} min={500} max={20000} step={100} unit="Hz" color="#F59E0B"
                        onChange={function(v){ upd("eq",{highFreq:v}); }} />
                      <Knob label="dB" value={eq5.high} min={-15} max={15} step={0.5} unit="dB" color="#F59E0B"
                        onChange={function(v){ upd("eq",{high:v}); }} />
                    </div>
                    <div style={{ width:1, background:"#1a1a1a", alignSelf:"stretch", margin:"0 1px" }} />
                    {/* LPF — only frequency */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                      <div style={{ color:"#EF4444", fontSize:7, fontWeight:800, letterSpacing:1 }}>LPF</div>
                      <Knob label="Hz" value={eq5.lpfFreq} min={1000} max={20000} step={100} unit="Hz" color="#EF4444"
                        onChange={function(v){ upd("eq",{lpfFreq:v}); }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── COMPRESSOR ── */}
              <div style={{ background:"#111", borderRadius:14, overflow:"hidden", border:"1px solid "+(fx.compressor?.on?"#8B5CF6":"#1e1e1e") }}>
                <div style={{ display:"flex", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid #1e1e1e", gap:8 }}>
                  <span style={{ color:"#8B5CF6", fontWeight:800, fontSize:12, letterSpacing:2 }}>COMP</span>
                  <span style={{ color:"#333", fontSize:10, flex:1 }}>Dynamics Compressor</span>
                  <button onClick={function(){ upd("compressor",{on:!fx.compressor?.on}); }}
                    style={{ background:fx.compressor?.on?"#8B5CF6":"#222", border:"none", borderRadius:6, color:"white", fontSize:10, fontWeight:700, padding:"4px 10px", cursor:"pointer" }}>
                    {fx.compressor?.on ? "ON" : "OFF"}
                  </button>
                </div>
                <div style={{ padding:"12px 14px", opacity:fx.compressor?.on?1:0.35 }}>
                  <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                    <CompGraph threshold={fx.compressor?.threshold??-24} ratio={fx.compressor?.ratio??4} />
                    {/* overflow:visible so knob arcs don't clip at edges */}
                    <div style={{ display:"flex", flexWrap:"wrap", gap:10, justifyContent:"center", flex:1, overflow:"visible", padding:"4px" }}>
                      {[
                        { key:"threshold",  label:"THRESH",    val:fx.compressor?.threshold??-24,                           min:-60,  max:0,    step:1,   unit:"dB" },
                        { key:"ratio",      label:"RATIO",     val:fx.compressor?.ratio??4,                                 min:1,    max:20,   step:0.5, unit:":1" },
                        { key:"attack",     label:"ATTACK",    val:Math.round((fx.compressor?.attack??0.003)*1000),          min:1,    max:200,  step:1,   unit:"ms",
                          onChange:function(v){ upd("compressor",{attack:v/1000}); } },
                        { key:"release",    label:"RELEASE",   val:Math.round((fx.compressor?.release??0.25)*1000),          min:10,   max:2000, step:10,  unit:"ms",
                          onChange:function(v){ upd("compressor",{release:v/1000}); } },
                        { key:"makeupGain", label:"MAKEUP",    val:fx.compressor?.makeupGain??0,                            min:0,    max:24,   step:0.5, unit:"dB",
                          color:"#22C55E" },
                      ].map(function(p){
                        return <Knob key={p.key} label={p.label} value={p.val} min={p.min} max={p.max} step={p.step} unit={p.unit} color={p.color}
                          onChange={p.onChange||function(v){ upd("compressor",{[p.key]:v}); }} />;
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── REVERB ── */}
              <div style={{ background:"#111", borderRadius:14, overflow:"hidden", border:"1px solid "+(fx.reverb?.on?"#C026D3":"#1e1e1e") }}>
                <div style={{ display:"flex", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid #1e1e1e", gap:8 }}>
                  <span style={{ color:"#C026D3", fontWeight:800, fontSize:12, letterSpacing:2 }}>REVERB</span>
                  <span style={{ color:"#333", fontSize:10, flex:1 }}>Convolution Room</span>
                  <button onClick={function(){ upd("reverb",{on:!fx.reverb?.on}); }}
                    style={{ background:fx.reverb?.on?"#C026D3":"#222", border:"none", borderRadius:6, color:"white", fontSize:10, fontWeight:700, padding:"4px 10px", cursor:"pointer" }}>
                    {fx.reverb?.on ? "ON" : "OFF"}
                  </button>
                </div>
                <div style={{ padding:"12px 14px", opacity:fx.reverb?.on?1:0.35 }}>
                  <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                    <ReverbViz wet={fx.reverb?.wet??0.25} roomSize={fx.reverb?.roomSize??0.8} />
                    {/* overflow:visible prevents knob stroke clipping */}
                    <div style={{ display:"flex", flexWrap:"wrap", gap:12, flex:1, justifyContent:"center", overflow:"visible", padding:"4px" }}>
                      <Knob label="WET"       value={fx.reverb?.wet??0.25}          min={0}   max={1}   step={0.01} unit="%" color="#C026D3"
                        onChange={function(v){ upd("reverb",{wet:v}); }} />
                      <Knob label="ROOM"      value={fx.reverb?.roomSize??0.8}       min={0.1} max={1}   step={0.01} unit="%" color="#C026D3"
                        onChange={function(v){ upd("reverb",{roomSize:v}); }} />
                      <Knob label="PRE-DELAY" value={fx.reverb?.preDelay??0}         min={0}   max={100} step={1}    unit="ms" color="#8B5CF6"
                        onChange={function(v){ upd("reverb",{preDelay:v}); }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── PITCH / AUTO-TUNE ── per-track, fully functional ── */}
              <div style={{ background:"#111", borderRadius:14, overflow:"hidden", border:"1px solid "+(fx.pitch?.on?"#C026D3":"#1e1e1e") }}>
                <div style={{ display:"flex", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid #1e1e1e", gap:8 }}>
                  <span style={{ color:"#C026D3", fontWeight:800, fontSize:12, letterSpacing:2 }}>♪ PITCH</span>
                  <span style={{ color:"#333", fontSize:10, flex:1 }}>Auto-Tune / Pitch Shift</span>
                  <button onClick={function(){ upd("pitch",{on:!fx.pitch?.on}); }}
                    style={{ background:fx.pitch?.on?"#C026D3":"#222", border:"none", borderRadius:6, color:"white", fontSize:10, fontWeight:700, padding:"4px 10px", cursor:"pointer" }}>
                    {fx.pitch?.on ? "ON" : "OFF"}
                  </button>
                </div>
                <div style={{ padding:"12px 14px", opacity:fx.pitch?.on?1:0.35 }}>
                  {/* Semitone pitch shift knob */}
                  <div style={{ display:"flex", gap:16, alignItems:"flex-start", flexWrap:"wrap" }}>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                      <Knob label="PITCH SHIFT" value={fx.pitch?.semitones??0} min={-12} max={12} step={1} unit=" st" color="#C026D3"
                        onChange={function(v){ upd("pitch",{semitones:v}); }} />
                      <div style={{ color:"#444", fontSize:8, textAlign:"center" }}>
                        {(fx.pitch?.semitones||0)>0?"↑ "+(fx.pitch?.semitones)+" semitones up":(fx.pitch?.semitones||0)<0?"↓ "+Math.abs(fx.pitch?.semitones)+" semitones down":"No shift"}
                      </div>
                    </div>
                    {/* Key snap */}
                    <div style={{ flex:1 }}>
                      <div style={{ color:"#555", fontSize:9, fontWeight:700, marginBottom:6 }}>SNAP KEY</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
                        {["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"].map(function(k){
                          const isActive = fx.pitch?.key===k;
                          return <button key={k} onClick={function(){ upd("pitch",{key:k}); }}
                            style={{ background:isActive?"#C026D3":"#1a1a1a", border:"1px solid "+(isActive?"#C026D3":"#222"), borderRadius:5, color:isActive?"white":"#555", fontSize:9, fontWeight:700, padding:"3px 6px", cursor:"pointer", minWidth:28 }}>{k}</button>;
                        })}
                      </div>
                      <div style={{ display:"flex", gap:6 }}>
                        {["major","minor","chromatic"].map(function(s){
                          const isA = fx.pitch?.scale===s;
                          return <button key={s} onClick={function(){ upd("pitch",{scale:s}); }}
                            style={{ background:isA?"rgba(192,38,211,0.2)":"#141414", border:"1px solid "+(isA?"#C026D3":"#222"), borderRadius:5, color:isA?"#C026D3":"#555", fontSize:8, fontWeight:700, padding:"3px 8px", cursor:"pointer", textTransform:"capitalize" }}>{s}</button>;
                        })}
                      </div>
                    </div>
                    {/* Retune speed */}
                    <div style={{ display:"flex", flexDirection:"column", gap:4, minWidth:100 }}>
                      <div style={{ color:"#555", fontSize:9, fontWeight:700 }}>RETUNE SPEED</div>
                      <input type="range" min={0} max={1} step={0.01} value={fx.pitch?.speed??0.5}
                        onChange={function(e){ upd("pitch",{speed:+e.target.value}); }}
                        style={{ accentColor:"#C026D3", width:"100%" }} />
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <span style={{ color:"#444", fontSize:7 }}>Natural</span>
                        <span style={{ color:"#C026D3", fontSize:8, fontWeight:700 }}>{Math.round((fx.pitch?.speed??0.5)*100)}%</span>
                        <span style={{ color:"#444", fontSize:7 }}>Robotic</span>
                      </div>
                      <div style={{ color:"#2a2a2a", fontSize:7, marginTop:2 }}>Pitch shift uses playback rate scaling. For natural vocals keep shift within ±3 semitones.</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ══ TAKES / COMPING PANEL ══════════════════════════════ */}
      {showTakes && (function(){
        const t = tracks.find(function(tr){ return tr.id===showTakes; });
        if (!t || !t.clips || t.clips.length <= 1) return null;
        return (
          <div style={{ background:"#0f0f0f",borderTop:"1px solid #1e1e1e",padding:"10px 14px",flexShrink:0,maxHeight:140,overflowY:"auto" }} onClick={function(e){ e.stopPropagation(); }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
              <span style={{ color:"#3B82F6",fontWeight:700,fontSize:12 }}>Takes — {t.name}</span>
              <button onClick={function(){ setShowTakes(null); }} style={{ background:"none",border:"none",color:"#555",fontSize:16,cursor:"pointer" }}>✕</button>
            </div>
            {t.clips.map(function(cl,idx){
              return (
                <div key={cl.id} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6,padding:"6px 8px",background:cl.active?"rgba(59,130,246,0.1)":"#111",borderRadius:8,border:"1px solid "+(cl.active?"#3B82F6":"#1e1e1e") }}>
                  <div style={{ width:5,height:5,borderRadius:"50%",background:cl.active?"#3B82F6":"#333" }} />
                  <span style={{ color:cl.active?"white":"#555",fontSize:11,flex:1 }}>{cl.label || ("Take "+(idx+1))}</span>
                  <span style={{ color:"#333",fontSize:9 }}>{cl.duration?cl.duration.toFixed(1)+"s":""}</span>
                  <button onClick={function(){ setActiveClip(t.id, cl.id); }} style={{ background:cl.active?"#3B82F6":"#1e1e1e",border:"none",borderRadius:5,color:"white",fontSize:9,padding:"3px 8px",cursor:"pointer",fontWeight:700 }}>{cl.active?"Active":"Use"}</button>
                  <button onClick={function(){ removeClip(t.id, cl.id); }} style={{ background:"none",border:"none",color:"#444",fontSize:12,cursor:"pointer" }}>🗑</button>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ══ MIXER ═══════════════════════════════════════════════ */}
      {showMixer && (
        <div style={{ background:"#0c0c0c",borderTop:"1px solid #1e1e1e",padding:"10px 8px",flexShrink:0,overflowX:"auto" }} onClick={function(e){ e.stopPropagation(); }}>
          <div style={{ display:"flex",gap:6,minWidth:"max-content" }}>
            {tracks.map(function(t){
              return (
                <div key={t.id} style={{ width:64,background:"#141414",borderRadius:10,padding:"8px 6px",display:"flex",flexDirection:"column",alignItems:"center",gap:6,border:"1px solid #1e1e1e" }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:t.color }} />
                  <span style={{ color:"#888",fontSize:8,fontWeight:700,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%" }}>{t.name}</span>
                  {/* Pan knob — simple slider */}
                  <div style={{ width:"100%" }}>
                    <div style={{ color:"#555",fontSize:7,textAlign:"center" }}>PAN {t.pan>0?"+":""}{Math.round((t.pan||0)*100)}</div>
                    <input type="range" min={-1} max={1} step={0.05} value={t.pan||0} onChange={function(e){ updateTrack(t.id,{pan:+e.target.value}); }} style={{ width:"100%",accentColor:t.color,height:2 }} />
                  </div>
                  {/* Volume fader */}
                  <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2,width:"100%" }}>
                    <div style={{ color:"#555",fontSize:7 }}>{Math.round((t.volume??1)*100)}</div>
                    <input type="range" min={0} max={1.5} step={0.01} value={t.volume??1} onChange={function(e){ updateTrack(t.id,{volume:+e.target.value}); }} style={{ width:"100%",accentColor:t.color,height:3 }} />
                  </div>
                  {/* Mute */}
                  <button onClick={function(){ toggleMute(t.id); }} style={{ background:t.isMuted?"rgba(245,158,11,0.2)":"#1a1a1a",border:"1px solid "+(t.isMuted?"#F59E0B":"#2a2a2a"),borderRadius:4,color:t.isMuted?"#F59E0B":"#555",fontSize:8,padding:"2px 0",cursor:"pointer",fontWeight:700,width:"100%" }}>M</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ TRANSPORT ════════════════════════════════════════════ */}
      <div style={{ background:"#0a0a0a",borderTop:"1px solid #141414",padding:"8px 16px",paddingBottom:"calc(8px + env(safe-area-inset-bottom))",flexShrink:0,zIndex:50 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ width:40,height:40,borderRadius:10,background:showMixer?"rgba(139,92,246,0.2)":"#141414",border:"1px solid "+(showMixer?"#8B5CF6":"#222"),display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer" }} onClick={function(){ setShowMixer(function(v){return !v;}); }}>
            <span style={{ fontSize:14 }}>🎚</span>
          </div>
          <button onClick={rewind} style={{ width:36,height:36,borderRadius:8,background:"#141414",border:"1px solid #222",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
          </button>
          <button onClick={function(){ if(isRecording)stopRecording();else startCountIn(selectedTrackId); }} disabled={countIn>0} style={{ width:52,height:52,borderRadius:"50%",background:isRecording?"#EF4444":"linear-gradient(135deg,#EF4444,#DC2626)",border:isRecording?"3px solid rgba(239,68,68,0.5)":"3px solid rgba(239,68,68,0.2)",cursor:countIn>0?"not-allowed":"pointer",opacity:countIn>0?0.4:1,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:isRecording?"0 0 20px rgba(239,68,68,0.5)":"none" }}>
            {isRecording?<div style={{ width:16,height:16,background:"white",borderRadius:3 }} />:<div style={{ width:20,height:20,background:"white",borderRadius:"50%" }} />}
          </button>
          <button onClick={togglePlay} style={{ width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#C026D3,#7C3AED)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
            {isPlaying?<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>:<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>}
          </button>
          <div style={{ width:40,height:40,borderRadius:10,background:"#141414",border:"1px solid #222",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
            <span style={{ color:"#555",fontSize:11,fontWeight:800,lineHeight:1 }}>{zoom}x</span>
            <span style={{ color:"#333",fontSize:7 }}>ZOOM</span>
          </div>
        </div>
      </div>

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
            overflowY: t === "studio" ? "hidden" : "auto",
            height: t === "studio"
              ? "calc(100vh - env(safe-area-inset-bottom))"
              : "calc(100vh - calc(72px + env(safe-area-inset-bottom)))",
            WebkitOverflowScrolling: "touch",
          }}>
            {t === "home"      && <HomeScreen savedIds={savedIds} onSave={toggleSave} onPlay={handlePlay} user={user} onGoMembers={() => goTab("exclusive")} onGoProfile={() => goTab("profile")} onGenreSearch={q => { setSearchQuery(q); goTab("search"); }} savedLyrics={savedLyrics} onEditLyric={handleEditLyric} onGoTrending={() => goTab("trending")} onGoStudio={() => goTab("studio")} />}
            {t === "artists"   && <ArtistsScreen onPlay={handlePlay} savedIds={savedIds} onSave={toggleSave} />}
            {t === "trending"  && <TrendingScreen savedIds={savedIds} onSave={toggleSave} onPlay={handlePlay} />}
            {t === "search"    && <SearchScreen savedIds={savedIds} onSave={toggleSave} onPlay={handlePlay} initialQuery={searchQuery} onClearInitial={() => setSearchQuery("")} />}
            {t === "saved"     && <SavedScreen savedMap={savedMap} savedIds={savedIds} onSave={toggleSave} user={user} onGoProfile={() => goTab("profile")} onPlay={handlePlay} />}
            {t === "studio"    && <StudioErrorBoundary><StudioScreen user={user} onExit={() => goTab("home")} /></StudioErrorBoundary>}
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
          display: tab === "studio" ? "none" : "flex",
          height: "calc(68px + env(safe-area-inset-bottom))",
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
