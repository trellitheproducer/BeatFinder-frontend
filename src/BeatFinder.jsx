import React, { useState, useEffect, useCallback } from "react";

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
async function fetchBeats(artistName, page, filterTitle, maxResults) {
  const pageNum     = page || 1;
  const maxNum      = maxResults || 10;
  const doFilter    = filterTitle !== false;
  const query       = artistName + "|page" + pageNum + "|filter" + doFilter + "|max" + maxNum;
  if (cache[query] && Date.now() - cache[query].ts < CACHE_TTL) {
    return { beats: cache[query].data, error: null };
  }

  const filterParam = doFilter ? "true" : "false";
  const url = "/api/youtube/search?artist=" + encodeURIComponent(artistName) +
              "&max=" + maxNum + "&page=" + pageNum +
              "&filter_title=" + filterParam;

  // Try up to 2 times - first page of an artist builds the master cache
  // which can take a few seconds on Render free tier
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const data  = await apiFetch(url);
      const beats = data.beats || [];
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
  {id:"future",       name:"Future",           cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/60Qd6jMC/IMG-8824.jpg"},
  {id:"gunna",        name:"Gunna",            cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/VcJgbWCs/IMG-8825.jpg"},
  {id:"juicewrld",    name:"Juice WRLD",       cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/jcHpx7y/IMG-8826.jpg"},
  {id:"kanye",        name:"Kanye West",       cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/dsK2fm4n/IMG-8827.webp"},
  {id:"kendrick",     name:"Kendrick Lamar",   cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/bgSH1S6Q/IMG-8830.jpg"},
  {id:"lilbaby",      name:"Lil Baby",         cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/d0D2Y42W/IMG-8829.webp"},
  {id:"lildurk",      name:"Lil Durk",         cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/7J7dP8BR/IMG-8831.webp"},
  {id:"liluzivert",   name:"Lil Uzi Vert",     cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/n8Q57Jss/IMG-8832.webp"},
  {id:"metroboomin",  name:"Metro Boomin",     cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/9mm1S7sM/IMG-8833.jpg"},
  {id:"playboicarti", name:"Playboi Carti",    cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/tM7ZQzSB/IMG-8834.webp"},
  {id:"travis",       name:"Travis Scott",     cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/Cp0FHyBg/IMG-8836.jpg"},
  {id:"youngthug",    name:"Young Thug",       cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/zV1sYHXn/IMG-8837.jpg"},
  {id:"nba",          name:"NBA YoungBoy",     cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/mFbR32cY/IMG-8838.webp"},
  {id:"cardib",       name:"Cardi B",          cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/7JMkDL10/IMG-6284.webp"},
  {id:"nickiminaj",   name:"Nicki Minaj",      cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/m5t5f1HL/IMG-4065.webp"},
  {id:"eminem",       name:"Eminem",           cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/6cW6jMHX/IMG-8841.webp"},
  {id:"jcole",        name:"J. Cole",          cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/mVJhFfRt/IMG-8842.webp"},
  {id:"meekmill",     name:"Meek Mill",        cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/mC37B3Lw/IMG-8843.webp"},
  {id:"postmalone",   name:"Post Malone",      cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/kgSFqDRb/IMG-8844.webp"},
  {id:"rodwave",      name:"Rod Wave",         cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/DPHp7cPh/IMG-8845.jpg"},
  {id:"polo",         name:"Polo G",           cat:"Rap",    flag:"🇺🇸", img:"https://i.ibb.co/jvfchwXm/IMG-8846.png"},
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
  {id:"sadababy",     name:"Sada Baby",        cat:"Detroit",flag:"🇺🇸", img:"https://i.ibb.co/N2TGpp2F/IMG-8871.webp"},
  {id:"icewear",      name:"Icewear Vezzo",    cat:"Detroit",flag:"🇺🇸", img:"https://i.ibb.co/VGBxyCT/IMG-8872.jpg"},
  {id:"riodayungo",   name:"Rio Da Yung OG",   cat:"Detroit",flag:"🇺🇸", img:"https://i.ibb.co/N6DwJT93/IMG-8873.jpg"},
  {id:"babytron",     name:"BabyTron",         cat:"Detroit",flag:"🇺🇸", img:"https://i.ibb.co/Wpc8GgpR/IMG-8874.webp"},
  {id:"veeze",        name:"Veeze",            cat:"Detroit",flag:"🇺🇸", img:"https://i.ibb.co/MxfsY9vm/IMG-8875.webp"},
  {id:"dejloaf",      name:"Dej Loaf",         cat:"Detroit",flag:"🇺🇸", img:"https://i.ibb.co/h1dXZ33r/IMG-8876.webp"},
  {id:"kashdoll",     name:"Kash Doll",        cat:"Detroit",flag:"🇺🇸", img:"https://i.ibb.co/k6KfLyc1/IMG-8877.jpg"},
  {id:"skillababy",   name:"Skilla Baby",      cat:"Detroit",flag:"🇺🇸", img:"https://i.ibb.co/4n9Hd8tx/IMG-8878.webp"},
];

const ARTISTS_UK = [
  {id:"ajtracey",      name:"AJ Tracey",       cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/KjMjGVhN/IMG-0480.jpg"},
  {id:"aitch",         name:"Aitch",           cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/jdvJ4Zc/IMG-0481.jpg"},
  {id:"centralcee",    name:"Central Cee",     cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/wZvG4SdH/IMG-0482.jpg"},
  {id:"dblockeurope",  name:"D Block Europe",  cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/Zp7BHx0G/IMG-0483.webp"},
  {id:"dave",          name:"Dave",            cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/qLyG67SS/IMG-0484.jpg"},
  {id:"diggad",        name:"Digga D",         cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/Y4KX0hXn/IMG-0485.jpg"},
  {id:"headieone",     name:"Headie One",      cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/mCD7Nx50/IMG-0486.png"},
  {id:"jhus",          name:"J Hus",           cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/b5jyBxCP/IMG-0487.jpg"},
  {id:"ktrap",         name:"K-Trap",          cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/svhjVGHB/IMG-0488.jpg"},
  {id:"potterpayper",  name:"Potter Payper",   cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/ymV2XKF2/IMG-0489.jpg"},
  {id:"skepta",        name:"Skepta",          cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/G3sL0H8k/IMG-0490.jpg"},
  {id:"stormzy",       name:"Stormzy",         cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/wh8fMHWz/IMG-0491.jpg"},
  {id:"slowthai",      name:"Slowthai",        cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/60QrHxQT/IMG-0492.jpg"},
  {id:"ghetts",        name:"Ghetts",          cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/4RjsrCpc/IMG-0493.jpg"},
  {id:"giggs",         name:"Giggs",           cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/39VkxCr5/IMG-0494.jpg"},
  {id:"dizzee",        name:"Dizzee Rascal",   cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/bgyCJp2M/IMG-0495.jpg"},
  {id:"wiley",         name:"Wiley",           cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/pvQsZPdh/IMG-0496.jpg"},
  {id:"jme",           name:"JME",             cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/LDWqsQ86/IMG-0497.jpg"},
  {id:"kano",          name:"Kano",            cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/HDMKt6Xq/IMG-0498.jpg"},
  {id:"ninesuk",       name:"Nines",           cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/hxsGJh3k/IMG-0499.jpg"},
  {id:"mostack",       name:"MoStack",         cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/q3KNrDwY/IMG-8879.webp"},
  {id:"fredo",         name:"Fredo",           cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/jk5h5zMS/IMG-8880.jpg"},
  {id:"arrdee",        name:"ArrDee",          cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/hFnJzqzF/IMG-8881.webp"},
  {id:"tion",          name:"Tion Wayne",      cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/r2sjzVnQ/IMG-8882.webp"},
  {id:"stefflon",      name:"Stefflon Don",    cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/VpksVFhH/IMG-8883.webp"},
  {id:"ladyleshurr",   name:"Lady Leshurr",    cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/p6z8yYJN/IMG-8884.jpg"},
  {id:"missdynamite",  name:"Ms Dynamite",     cat:"UK Rap", flag:"🇬🇧", img:"https://i.ibb.co/0yg4SZQn/IMG-8885.webp"},
  {id:"craigdavid",    name:"Craig David",     cat:"UK R&B", flag:"🇬🇧", img:"https://i.ibb.co/nMd0VdzF/IMG-8887.jpg"},
  {id:"jorja",         name:"Jorja Smith",     cat:"UK R&B", flag:"🇬🇧", img:"https://i.ibb.co/KjQr64LN/IMG-8888.jpg"},
  {id:"rayblk",        name:"Ray BLK",         cat:"UK R&B", flag:"🇬🇧", img:"https://i.ibb.co/9H0P51ZW/IMG-8889.webp"},
  {id:"mahalia",       name:"Mahalia",         cat:"UK R&B", flag:"🇬🇧", img:"https://i.ibb.co/mFzQQyfQ/IMG-8890.webp"},
  {id:"pinkpantheress",name:"PinkPantheress",  cat:"UK R&B", flag:"🇬🇧", img:"https://i.ibb.co/WNDS1kY1/IMG-8891.webp"},
  {id:"samsmith",      name:"Sam Smith",       cat:"UK R&B", flag:"🇬🇧", img:"https://i.ibb.co/d0gvQhH4/IMG-8892.jpg"},
  {id:"raye",          name:"RAYE",            cat:"UK R&B", flag:"🇬🇧", img:"https://i.ibb.co/RT1QhM5C/IMG-8893.png"},
  {id:"dotrotten",     name:"Dot Rotten / Zeph Ellis", cat:"Grime", flag:"🇬🇧", img:"https://i.ibb.co/tTtkNPnb/IMG-8894.webp",
   searchOverride:"Dot Rotten Zeph Ellis instrumental",
   filterTitle: false,
   instrumentalOnly: true},
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

const USA_CATS     = ["All","Rap","R&B M","R&B F","Detroit"];
const UK_CATS      = ["All","UK Rap","UK R&B","Grime"];
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

// Large rhyme groups - words grouped by shared ending sound
const RHYME_GROUPS = [
  // -eep / -eap / -ee sounds
  ["jeep","deep","sleep","keep","sweep","creep","leap","heap","reap","cheap","steep","beep","weep","peep","seep","sheep","fleet","street","beat","feat","heat","meat","neat","seat","treat","tweet","concrete","elite","compete","repeat","defeat","retreat","complete","athlete","heartbeat","deadbeat","discreet","delete","deplete"],
  // -ack / -act / -ax
  ["back","track","stack","black","crack","attack","setback","flashback","payback","comeback","feedback","kickback","throwback","knack","hack","slack","pack","rack","lack","jack","shack","snack","smack","whack","fact","act","pact","exact","impact","abstract","contract","extract","distract","attract","interact","react"],
  // -ay / -ey / -ade
  ["day","way","say","play","stay","pray","pay","slay","okay","away","today","highway","relay","display","portray","betray","decay","convey","hooray","spray","stray","bay","clay","gray","lay","may","ray","sway","blade","shade","fade","grade","made","trade","wade","arcade","decade","cascade","blockade","crusade","parade","upgrade","grenade","lemonade"],
  // -ight / -ite / -yte
  ["night","right","fight","light","sight","might","tight","bright","flight","white","ignite","despite","delight","tonight","midnight","highlight","moonlight","flashlight","insight","invite","excite","unite","recite","polite","alight","fright","height","kite","quite","write","bite","dynamite","satellite","parasite","appetite","overnight","spotlight","gunfight","fistfight","dogfight"],
  // -ow / -ow (long o)
  ["know","flow","show","glow","grow","slow","go","though","below","bestow","shadow","tomorrow","sorrow","follow","hollow","borrow","plateau","although","ago","radio","studio","vertigo","overflow","overthrow","undertow","rainbow","elbow","window","outgrow","forgo"],
  // -een / -ean / -ine
  ["seen","mean","clean","dream","team","scheme","supreme","between","machine","routine","serene","marine","obscene","intervene","magazine","lean","keen","queen","screen","scene","bean","green","preen","sheen","teen","wean","mainstream","downstream","upstream","daydream","nightmare","moonbeam","sunbeam"],
  // -ine / -ime / -ind
  ["mine","shine","fine","line","time","crime","rhyme","sublime","overtime","prime","dime","lime","grime","vine","wine","pine","nine","spine","divine","design","align","define","refine","combine","decline","confine","outline","sunshine","moonshine","sideline","deadline","grind","mind","find","blind","kind","bind","remind","behind","mankind","unwind","rewind","mastermind","intertwined"],
  // -ake / -ake
  ["take","make","break","shake","wake","fake","mistake","heartbreak","forsake","earthquake","stake","lake","bake","rake","sake","cake","flake","snake","awake","intake","overtake","remake","cupcake","snowflake","namesake","daybreak","outbreak","jailbreak","handshake","keepsake"],
  // -one / -oan / -own (long o)
  ["alone","phone","throne","zone","stone","bone","tone","moan","groan","unknown","microphone","milestone","cornerstone","shown","blown","grown","flown","own","known","thrown","postpone","ozone","cyclone","backbone","jawbone","headstone","limestone","gravestone","home","roam","foam","chrome","dome","gnome","poem","loam","syndrome","metronome","palindrome"],
  // -ound / -own (rhymes with crown)
  ["ground","found","sound","around","bound","pound","profound","surround","background","underground","playground","rebound","compound","astound","abound","renowned","expound","confound","dumbfound","crown","down","town","drown","clown","brown","frown","gown","noun","renown","downtown","uptown","countdown","breakdown","rundown","showdown","shutdown","lockdown","meltdown"],
  // -eal / -eel / -eal
  ["real","feel","deal","heal","steel","wheel","appeal","reveal","conceal","ideal","ordeal","surreal","kneel","meal","seal","zeal","peel","repeal","congeal","genteel","squeal","teal","veal","unreal","steel-toed","on one knee","let it be free"],
  // -ame / -aim / -ame
  ["same","name","game","flame","claim","frame","blame","shame","fame","came","tame","aim","exclaim","proclaim","acclaim","defame","inflame","became","reclaim","rename","nickname","ballgame","endgame","war game","mind game","wild game"],
  // -old / -olled
  ["told","bold","cold","gold","hold","sold","fold","old","unfold","withhold","behold","enrolled","controlled","consoled","manifold","household","threshold","stronghold","blindfold","marigold","pot of gold"],
  // -ead / -ed / -ead (rhymes with dead)
  ["dead","head","said","bread","spread","thread","dread","led","red","fed","bed","shed","instead","ahead","misled","mislead","unread","widespread","forehead","godhead","hothead","deadhead","figurehead","overhead"],
  // -eed / -ead (rhymes with lead)
  ["need","lead","freed","greed","creed","speed","bleed","feed","seed","weed","proceed","succeed","indeed","concede","agreed","guaranteed","stampede","supersede","centipede","proceed"],
  // -ive / -ive (long i)
  ["live","give","drive","thrive","survive","arrive","revive","derive","connive","contrive","deprive","alive","nosedive","overdrive","archive","beehive","high five","deep dive","swan dive","crash and dive"],
  // -art / -eart
  ["heart","start","smart","apart","depart","impart","restart","sweetheart","chart","dart","cart","part","tart","art","counterpart","fall apart","shopping cart","sacred heart","state of the art","change of heart","broken heart"],
  // -all / -aul / -awl
  ["call","fall","wall","hall","tall","ball","crawl","stall","install","recall","overall","downfall","rainfall","nightfall","windfall","freefall","enthrall","befall","appall","forestall","protocol","alcohol","wherewithal","Montreal","free-for-all","behind the ball"],
  // -ide / -ied
  ["ride","side","hide","guide","pride","tried","cried","denied","applied","relied","supplied","inside","outside","worldwide","override","provide","divide","reside","confide","decide","beside","collide","subside","upside","downside","fireside","riverside","landslide","riptide","homicide","coincide","justified","amplified","satisfied","glorified","modified","occupied","terrified","unified","verified","certified","identified","notified","solidified"],
  // -ess / -est
  ["stress","bless","less","yes","guess","mess","address","express","impress","confess","success","progress","access","excess","darkness","weakness","sadness","madness","gladness","princess","fortress","nevertheless","loneliness","happiness","emptiness","bitterness","best","rest","test","west","quest","chest","nest","pest","vest","arrest","contest","invest","protest","suggest","manifest","interest","forest","harvest"],
  // -ee / -ee (free, see)
  ["free","see","be","me","key","tree","agree","degree","guarantee","destiny","energy","memory","victory","history","mystery","category","territory","possibility","opportunity","ability","reality","mentality","brutality","loyalty","royalty","penalty","specialty","philosophy","democracy","conspiracy","emergency","currency","frequency","legacy","advocacy","diplomacy","pharmacy","privacy","prophecy","therapy","mystery","poetry","properly","separately","differently","together with me","set us free","what's meant to be","eventually","naturally","finally free","independently"],
  // -un / -one (rhymes with sun)
  ["run","done","one","gun","sun","fun","won","begun","outdone","outrun","undone","overcome","someone","anyone","everyone","none","bun","nun","pun","spun","stun","number one","on the run","under the gun","get it done","all as one","second to none","hit and run","just begun","kingdom come"],
  // -ong / -ong
  ["strong","long","song","wrong","along","belong","prolong","lifelong","headstrong","all along","sing along","come along","play along","get along","before long","stay strong","be strong","move along","go along","tagalong","singalong","all night long","carry on","move on","carry strong"],
  // -ock / -op / -ot
  ["block","clock","knock","lock","mock","rock","shock","sock","stock","dock","flock","unlock","deadlock","gridlock","padlock","o clock","hard knock","around the clock","hip hop","nonstop","rooftop","desktop","backdrop","raindrop","hilltop"],
  // -ool / -ule / -ool
  ["cool","fool","rule","school","tool","pool","fuel","duel","jewel","cruel","overrule","old school","swimming pool","golden rule","April fool","beautiful","powerful","masterful","meaningful","wonderful","colorful","plentiful","bountiful","dutiful","merciful","successful","faithful","grateful","hateful","wasteful","peaceful","cheerful","fearful","careful","tearful","playful","hopeful","soulful","truthful","youthful"],
  // -op / -op
  ["drop","stop","shop","pop","hop","crop","flop","mop","prop","swap","top","nonstop","laptop","rooftop","backdrop","raindrop","teardrop","dewdrop","hilltop","workshop","hip hop","tip top","over the top","drop by drop","ready to drop","can't stop won't stop"],
  // -uck / -ug / -unk
  ["stuck","luck","duck","truck","chuck","pluck","struck","muck","buck","cluck","amuck","starstruck","dumbstruck","thunderstruck","lady luck","down on my luck","pass the buck","out of luck"],
  // -ug / -ub / -ud
  ["thug","drug","bug","hug","jug","mug","plug","rug","shrug","slug","snug","tug","dug","grub","club","hub","rub","sub","tub","shrub","nightclub","hot tub","sugarplum","overcome","come from","kingdom come"],
];



// Sentence templates for building suggestions
const TEMPLATES = [
  (w) => "I been " + randomFrom(["moving","working","grinding","fighting","climbing","building","pushing"]) + " ever since I found my " + w,
  (w) => "They " + randomFrom(["can't","won't","don't"]) + " understand the way I " + randomFrom(["feel","move","think","shine","flow"]) + ", I " + randomFrom(["stay","keep","hold"]) + " true to my " + w,
  (w) => randomFrom(["Yeah","Aye","Look","Real talk"]) + ", " + randomFrom(["every","all","through the"]) + " " + randomFrom(["night","day","moment","season"]) + " I " + randomFrom(["chase","seek","find","hold"]) + " the " + w,
  (w) => randomFrom(["Came too far","Gone too deep","Moved too fast"]) + " to ever " + randomFrom(["stop now","turn back","slow down"]) + ", I own my " + w,
  (w) => randomFrom(["Stay","Keep","Hold"]) + " " + randomFrom(["solid","focused","patient","humble","moving"]) + ", " + randomFrom(["never","won't","can't"]) + " " + randomFrom(["fold","break","stop","fall"]) + ", I live by the " + w,
  (w) => "From the " + randomFrom(["bottom","struggle","darkness","mud","ground"]) + " I " + randomFrom(["rose","climbed","fought my way"]) + " to the " + w,
  (w) => randomFrom(["No cap","On God","Facts","Real"]) + ", " + randomFrom(["everything I","all I ever","only thing I"]) + " " + randomFrom(["touch","build","chase","want"]) + " turns to " + w,
  (w) => "Through " + randomFrom(["the rain","the pain","every storm","the dark"]) + " I " + randomFrom(["found","kept","held onto"]) + " my " + w,
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getLastWord(line) {
  const words = line.trim().split(" ").filter(w => w.length > 0);
  return words[words.length - 1].replace(/[^a-zA-Z]/g, "").toLowerCase();
}

function findRhymeGroup(word) {
  // Find which group contains this word
  for (const group of RHYME_GROUPS) {
    if (group.includes(word)) return group;
  }
  // Try suffix matching
  const suffixes = ["ight","ound","ame","old","eat","eed","ide","all","ack","eal","one","ow","ay","ine","ake","ive","art","ee","op","un","ess","ind","own","top"];
  for (const suf of suffixes) {
    if (word.endsWith(suf)) {
      const group = RHYME_GROUPS.find(g => g[0].endsWith(suf));
      if (group) return group;
    }
  }
  // Last resort - find partial matches
  if (word.length >= 3) {
    const tail = word.slice(-3);
    const group = RHYME_GROUPS.find(g => g.some(w => w.endsWith(tail)));
    if (group) return group;
  }
  return null;
}

function detectScheme(lines) {
  if (lines.length < 2) return "Couplet (AA)";
  const last4 = lines.slice(-4).map(l => getLastWord(l));
  const groups = last4.map(w => {
    const g = findRhymeGroup(w);
    return g ? g[0] : w;
  });
  if (lines.length >= 4) {
    const [a, b, c, d] = groups;
    if (a === c && b === d) return "ABAB";
    if (a === b && c === d) return "AABB";
    if (b === d) return "ABAB (cross rhyme)";
    if (a === b) return "AABB (couplet)";
  }
  if (groups[0] === groups[1]) return "AA (couplet)";
  return "AB (alternating)";
}

function generateSuggestions(lyrics, beat, seed) {
  const lines = lyrics.split("\n").filter(l => l.trim());
  if (lines.length === 0) return null;

  const lastLine = lines[lines.length - 1];
  const lastWord = getLastWord(lastLine);
  const scheme   = detectScheme(lines);

  // Find rhyme group for last word
  const group    = findRhymeGroup(lastWord);
  const rhymes   = group ? group.filter(w => w !== lastWord) : [];

  // Shuffle using seed for variety
  const shuffleArr = (arr, s) => {
    const a   = [...arr];
    let   idx = s ? (s % Math.max(1, a.length)) : 0;
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.floor(Math.random() * (i + 1)) + idx) % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
      idx++;
    }
    return a;
  };

  const shuffled = shuffleArr(rhymes, seed || Date.now());
  const trio     = shuffled.slice(0, 3);

  const templates = shuffleArr(TEMPLATES, seed ? seed + 1 : Date.now() + 1);

  const suggestions = trio.length >= 3
    ? trio.map((rw, i) => templates[i % templates.length](rw))
    : trio.length > 0
    ? trio.map((rw, i) => templates[i % templates.length](rw))
    : [
        "Keep pushing forward, never look back",
        "Stay focused on the path, never slack",
        "Through the struggle I remain on track",
      ];

  return {
    rhyme_scheme:     scheme,
    last_rhyme_sound: '"' + lastWord + '"',
    last_line:        lastLine,
    suggestions,
  };
}

function AiLyricAssistant({ text, beat, onSuggest }) {
  const [results, setResults] = useState(null);
  const [open,    setOpen]    = useState(false);
  const [callCount, setCallCount] = useState(0);

  const generate = (currentText, count) => {
    const lines   = currentText.split("\n").filter(l => l.trim().length > 0);
    if (lines.length === 0) return null;

    const lastLine = lines[lines.length - 1].trim();
    const words    = lastLine.split(" ").filter(w => w.length > 0);
    const lastWord = words[words.length - 1].replace(/[^a-zA-Z]/gi, "").toLowerCase();

    // Find rhyming words - check exact match first, then suffix match
    const found = [];
    // Pass 1: exact word match
    for (const group of RHYME_GROUPS) {
      if (group.includes(lastWord)) {
        found.push(...group.filter(w => w !== lastWord));
        break;
      }
    }
    // Pass 2: suffix match (last 3 chars)
    if (found.length === 0 && lastWord.length >= 3) {
      const tail3 = lastWord.slice(-3);
      const tail2 = lastWord.slice(-2);
      for (const group of RHYME_GROUPS) {
        if (group.some(w => w.endsWith(tail3) || (tail2.length === 2 && w.endsWith(tail2)))) {
          found.push(...group.filter(w => w !== lastWord));
          break;
        }
      }
    }
    // Pass 3: any partial match
    if (found.length === 0 && lastWord.length >= 2) {
      const tail2 = lastWord.slice(-2);
      for (const group of RHYME_GROUPS) {
        if (group.some(w => w.endsWith(tail2))) {
          found.push(...group.filter(w => w !== lastWord));
          break;
        }
      }
    }

    // Rotate through rhymes based on call count so regenerate always differs
    const pool     = found.length > 0 ? found : ["strong","on","gone","long","along","belong","song","wrong","prolong"];
    const offset   = (count * 3) % Math.max(1, pool.length);
    const trio     = [];
    for (let i = 0; i < 3; i++) {
      trio.push(pool[(offset + i) % pool.length]);
    }

    // Build sentences using different templates per call
    const starters = [
      ["I been moving", "They watching", "Can't stop now", "Stay focused", "No looking back", "Keep it going", "Eyes on the prize", "Never fold"],
      ["Came too far", "Built different", "Through the struggle", "From the bottom", "Against all odds", "Grind don't stop", "Real ones know", "On my way"],
      ["Yeah I", "Watch me", "Told myself", "Every day I", "Since day one I", "Moving in silence", "Let them talk", "Trust the process"],
    ];
    const templateSet = starters[count % starters.length];

    const suggestions = trio.map((rhymeWord, i) => {
      const starter = templateSet[(i + count) % templateSet.length];
      const middles = ["keep pushing til I find my", "stay solid and I hold my", "never stop until I reach the", "rise above and claim my", "grind it out and earn my", "move in silence chase my"];
      const middle  = middles[(i + count) % middles.length];
      return starter + " " + middle + " " + rhymeWord;
    });

    const scheme = lines.length >= 2 ? detectScheme(lines) : "Building...";

    return {
      lastLine,
      lastWord,
      scheme,
      suggestions,
    };
  };

  const handleOpen = () => {
    const next = callCount + 1;
    setCallCount(next);
    const r = generate(text, next);
    if (!r) {
      setOpen(true);
      setResults(null);
      return;
    }
    setResults(r);
    setOpen(true);
  };

  const handleRegenerate = () => {
    const next = callCount + 1;
    setCallCount(next);
    const r = generate(text, next);
    setResults(r);
  };

  return (
    <div>
      <button onClick={handleOpen} style={{
        width: "100%", borderRadius: 14, padding: "15px",
        fontWeight: 800, fontSize: 15, cursor: "pointer", border: "none",
        background: "linear-gradient(135deg,#6B21A8,#C026D3)", color: "white",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        ✨ AI Lyric Assistant
      </button>

      {open && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10002, background: "#0a0a0a",
          display: "flex", flexDirection: "column", fontFamily: "'DM Sans',sans-serif",
          paddingTop: "env(safe-area-inset-top)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 16px", borderBottom: "1px solid #1a1a1a", background: "#0a0a0a",
          }}>
            <button onClick={() => setOpen(false)} style={{
              background: "#1a1a1a", border: "1px solid #333", borderRadius: "50%",
              color: "white", width: 36, height: 36, fontSize: 20, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#C026D3", fontWeight: 800, fontSize: 14 }}>✨ Lyric Assistant</div>
              <div style={{ color: "#555", fontSize: 11 }}>Tap a suggestion to add it</div>
            </div>
            <button onClick={handleRegenerate} style={{
              background: "#C026D3", border: "none", borderRadius: 20,
              color: "white", fontWeight: 800, fontSize: 12, padding: "7px 16px", cursor: "pointer",
            }}>
              🔄 New Options
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {!results && (
              <div style={{ color: "#F87171", textAlign: "center", padding: 20 }}>
                Write at least one line first!
              </div>
            )}

            {results && (
              <>
                <div style={{ background: "#111", borderRadius: 12, padding: 14, marginBottom: 16, border: "1px solid #1e1e1e" }}>
                  <div style={{ color: "#555", fontSize: 11, marginBottom: 4 }}>ANALYSING LAST LINE</div>
                  <div style={{ color: "white", fontSize: 13, fontStyle: "italic", marginBottom: 8 }}>"{results.lastLine}"</div>
                  <div style={{ color: "#555", fontSize: 11 }}>Rhyming with: <span style={{ color: "#F59E0B", fontWeight: 700 }}>"{results.lastWord}"</span> • Scheme: <span style={{ color: "#aaa" }}>{results.scheme}</span></div>
                </div>

                <div style={{ color: "#555", fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: 1 }}>SUGGESTED NEXT LINES - TAP TO ADD</div>

                {results.suggestions.map((line, i) => (
                  <div key={i + "-" + callCount} onClick={() => { onSuggest(line); setOpen(false); }}
                    style={{ background: "#111", borderRadius: 14, padding: 16, marginBottom: 12, border: "1px solid #1e1e1e", cursor: "pointer" }}>
                    <div style={{ color: "#555", fontSize: 11, marginBottom: 6, fontWeight: 700 }}>OPTION {i + 1}</div>
                    <div style={{ color: "white", fontSize: 15, lineHeight: 1.6, fontStyle: "italic" }}>"{line}"</div>
                    <div style={{ color: "#C026D3", fontSize: 12, marginTop: 8, fontWeight: 600 }}>+ Add to lyrics</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// LYRICS NOTEPAD - Artist Pro only, appears over the player
// =============================================================================
function LyricsNotepad({ beat, onClose, onSaveLyric, initialLyric, lyricIndex }) {
  const [text,  setText]  = useState(initialLyric ? initialLyric.text  : "");
  const [title, setTitle] = useState(initialLyric ? initialLyric.title : "");
  const [saved, setSaved] = useState(false);
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
    <div style={{
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
              src={"https://www.youtube.com/embed/" + beat.videoId + "?autoplay=1&rel=0"}
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
        placeholder="Start writing your lyrics here... Writer's block? Tap the AI Lyric Assistant button below - it will analyse your rhyme scheme and suggest the perfect next line to keep you flowing."
        style={{
          flex: 1, background: "#0d0d0d", border: "none", outline: "none",
          color: "white", fontSize: 15, lineHeight: 1.8, padding: "16px",
          resize: "none", fontFamily: "'DM Sans',sans-serif",
        }}
        autoFocus
      />

      <div style={{
        padding: "12px 16px", background: "#0a0a0a",
        borderTop: "1px solid #1a1a1a",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <div style={{ color: "#444", fontSize: 11, textAlign: "center" }}>
          {text.length} characters • {text.split(" ").filter(function(w){return w.length > 0;}).length} words
        </div>
        <AiLyricAssistant text={text} beat={beat} onSuggest={s => { setText(p => p ? p + String.fromCharCode(10) + s : s); }} />
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
        {(() => {
          const existingLyric = savedLyrics ? savedLyrics.find(l => l.beatId === beat.videoId) : null;
          const existingIndex = savedLyrics ? savedLyrics.findIndex(l => l.beatId === beat.videoId) : -1;

          if (isArtistPro) {
            return (
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
                  ✍️ Write Lyrics to This Beat
                </button>
                {existingLyric && (
                  <button
                    onClick={() => onEditLyric(existingLyric, existingIndex)}
                    style={{
                      marginTop: 10, width: "100%", borderRadius: 14, padding: "15px",
                      fontWeight: 800, fontSize: 15, cursor: "pointer",
                      background: "rgba(34,197,94,0.1)",
                      border: "1.5px solid #22C55E", color: "#22C55E",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    }}
                  >
                    📄 Open Existing Lyrics - {existingLyric.title}
                  </button>
                )}
              </>
            );
          }

          // Locked state for non-subscribers
          return (
            <button
              onClick={() => { onClose(); onGoMembers && onGoMembers(); }}
              style={{
                marginTop: 10, width: "100%", borderRadius: 14, padding: "15px",
                fontWeight: 800, fontSize: 15, cursor: "pointer",
                background: "#111",
                border: "1.5px solid #2a2a2a",
                color: "#444",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
            >
              🔒 Subscribe to Write Lyrics
            </button>
          );
        })()}

      </div>
    </div>
  );
}

// =============================================================================
// BEAT CARD
// =============================================================================
function BeatCard({ beat, savedIds, onSave, onPlay, featured, exclusive }) {
  const [imgErr, setImgErr] = useState(false);
  const accent  = exclusive ? "#F59E0B" : featured ? "#C026D3" : "#9333EA";
  const isSaved = savedIds.has(beat.videoId);

  return (
    <div style={{
      background: "#111", borderRadius: 14, overflow: "hidden", marginBottom: 16,
      border: `1px solid ${exclusive ? "#F59E0B33" : featured ? "#C026D333" : "rgba(255,255,255,0.07)"}`,
    }}>
      <div
        style={{
          position: "relative", height: 200,
          background: `linear-gradient(135deg,#1a1a2e,${accent}44)`, cursor: "pointer",
        }}
        onClick={() => onPlay(beat)}
      >
        {beat.thumbnail && !imgErr && (
          <img
            src={beat.thumbnail} alt={beat.title}
            onError={() => setImgErr(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top,rgba(0,0,0,0.65) 0%,rgba(0,0,0,0.05) 60%,transparent 100%)",
        }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%", background: accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 24px ${accent}99`, border: "3px solid rgba(255,255,255,0.3)",
          }}>
            <span style={{ fontSize: 22, marginLeft: 5, color: "white" }}>▶</span>
          </div>
        </div>
        {featured && (
          <div style={{ position: "absolute", top: 10, left: 12, background: "#C026D3", borderRadius: 8, padding: "3px 10px", fontSize: 11, color: "white", fontWeight: 800 }}>
            ⭐ FEATURED
          </div>
        )}
        {exclusive && (
          <div style={{ position: "absolute", top: 10, left: 12, background: "#F59E0B", borderRadius: 8, padding: "3px 10px", fontSize: 11, color: "black", fontWeight: 800 }}>
            🔒 EXCLUSIVE
          </div>
        )}
        <div
          onClick={e => { e.stopPropagation(); onSave(beat); }}
          style={{ position: "absolute", top: 10, right: 12, fontSize: 22, color: isSaved ? "#C026D3" : "rgba(255,255,255,0.55)", cursor: "pointer" }}
        >
          🔖
        </div>
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div
          onClick={() => onPlay(beat)}
          style={{ color: "white", fontWeight: 700, fontSize: 13, lineHeight: 1.4, marginBottom: 4, cursor: "pointer" }}>
          {beat.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ color: "#888", fontSize: 12 }}>{beat.channel}</div>
          {beat.viewsLabel && (
            <div style={{ background: "rgba(192,38,211,0.15)", border: "1px solid rgba(192,38,211,0.3)", borderRadius: 20, padding: "2px 8px", fontSize: 11, color: "#C026D3", fontWeight: 700 }}>
              {beat.viewsLabel}
            </div>
          )}
        </div>
        <a
          href={watchUrl(beat.videoId)}
          target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ color: "#FF0000", fontSize: 11, fontWeight: 700, textDecoration: "none" }}
        >
          ▶ Open in YouTube ↗
        </a>
      </div>
    </div>
  );
}

// =============================================================================
// BEAT FEED
// =============================================================================
function BeatFeed({ artistName, featured, exclusive, savedIds, onSave, onPlay, showPagination, filterTitle, instrumentalOnly, max }) {
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

    fetchBeats(artistName, page, filterTitle, max || 20).then(({ beats: b, error: e }) => {
      if (!alive) return;
      // Filter to instrumentals only if flag is set (e.g. Dot Rotten)
      const INSTRUMENTAL_KEYWORDS = ["instrumental", "riddim", "beat", "free beat", "backing track"];
      const filtered = instrumentalOnly
        ? b.filter(beat => INSTRUMENTAL_KEYWORDS.some(kw => beat.title.toLowerCase().includes(kw)))
        : b;
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

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>🎵</div>
      <div style={{ fontSize: 13 }}>Finding {artistName} type beats...</div>
      {page === 1 && <div style={{ fontSize: 11, color: "#444", marginTop: 6 }}>First load builds the full beat library - may take a few seconds</div>}
    </div>
  );

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
function HomeScreen({ savedIds, onSave, onPlay, user, onGoMembers }) {
  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ textAlign: "center", padding: "24px 0 20px" }}>
        <img
          src="https://i.ibb.co/9myqbFB7/2-BB02064-13-F6-476-C-89-FF-B1-EDDAE0-C709.png"
          alt="BeatFinder"
          style={{ width: "100%", maxWidth: 380, display: "block", margin: "0 auto" }}
        />
      </div>
      {(!user || (!user.isPro && !user.isArtistPro)) && (
        <div style={{
          background: "linear-gradient(135deg,#1a0a2e,#2d1060)",
          border: "1.5px solid rgba(192,38,211,0.4)",
          borderRadius: 16, padding: "18px 20px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 22 }}>🔒</div>
            <div style={{ color: "#C026D3", fontWeight: 800, fontSize: 13, letterSpacing: 0.5 }}>PRO FEATURES AVAILABLE</div>
          </div>
          <div style={{ color: "white", fontWeight: 800, fontSize: 16, marginBottom: 10, lineHeight: 1.4 }}>
            Take your music further with a Pro plan
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
            {["✍️  Write lyrics while beats play", "💾  Save & edit your lyrics anytime", "🎵  Access exclusive member beats", "⬇️  Download & buy MP3 leases", "✨  AI Lyric Assistant for writer's block", "🎛️  Upload & sell your own beats"].map(f => (
              <div key={f} style={{ color: "#bbb", fontSize: 12 }}>{f}</div>
            ))}
          </div>
          <button onClick={onGoMembers} style={{
            width: "100%", background: "linear-gradient(135deg,#C026D3,#7C3AED)",
            border: "none", borderRadius: 12, color: "white",
            fontWeight: 800, fontSize: 15, padding: "13px", cursor: "pointer",
          }}>
            View Plans - From £4.99/mo
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ color: "white", fontWeight: 800, fontSize: 18 }}>⭐ Featured Beats</div>
        <div style={{ color: "#888", fontSize: 12 }}>Live from YouTube</div>
      </div>
      <div style={{ background: "#111", borderRadius: 12, padding: "10px 14px", marginBottom: 20, border: "1px solid #1e1e1e" }}>
        <div style={{ color: "#666", fontSize: 12, lineHeight: 1.6 }}>
          🎵 Featured beats from producers worldwide - tap any video to play beats instantly.
        </div>
      </div>
      <BeatFeed artistName="best free beats" featured savedIds={savedIds} onSave={onSave} onPlay={onPlay} filterTitle={false} max={10} />
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
  );

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0 14px" }}>
        <div>
          <div style={{ color: "white", fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, letterSpacing: 2 }}>BEATFINDER</div>
          <div style={{ color: "#888", fontSize: 13 }}>Type beats, organized.</div>
        </div>

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
        {cats.map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{
              borderRadius: 20, padding: "5px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              border: cat === c ? "1.5px solid #C026D3" : "1px solid #333",
              background: cat === c ? "rgba(192,38,211,0.15)" : "transparent",
              color: cat === c ? "#C026D3" : "#666",
            }}>
            {c}
          </button>
        ))}
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
                   : a.cat === "Grime"                          ? "#06B6D4"
                   : a.cat === "Reggae"                         ? "#22C55E"
                   : a.cat === "Dancehall" || a.cat === "Bashment" ? "#F97316"
                   : a.cat === "Afrobeats"                      ? "#EAB308"
                   : a.cat === "Tribal House"                   ? "#A78BFA" : "#666",
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
           : artist.cat === "Grime"                               ? "#06B6D4"
           : artist.cat === "Reggae"                              ? "#22C55E"
           : artist.cat === "Dancehall" || artist.cat === "Bashment" ? "#F97316"
           : artist.cat === "Afrobeats"                           ? "#EAB308"
           : artist.cat === "Tribal House"                        ? "#A78BFA" : "#888";

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
        <BeatFeed artistName={searchName} savedIds={savedIds} onSave={onSave} onPlay={onPlay} showPagination filterTitle={artist.filterTitle !== false} instrumentalOnly={!!artist.instrumentalOnly} max={10} />
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



  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ background: "linear-gradient(135deg,#1C1917,rgba(245,158,11,0.2))", borderRadius: 16, padding: "24px 20px", marginBottom: 20, border: "1.5px solid rgba(245,158,11,0.3)" }}>
          <div style={{ color: "#F59E0B", fontSize: 13, fontWeight: 800, marginBottom: 6 }}>🎵 PRODUCER BEATS</div>
          <div style={{ color: "white", fontSize: 26, fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>
            Download MP3s
          </div>
          <div style={{ color: "#aaa", fontSize: 13, marginTop: 4 }}>Beats uploaded by verified producers</div>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎵</div>
          <div style={{ fontSize: 13 }}>Loading producer beats...</div>
        </div>
      )}

      {error && (
        <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 14, padding: 20, textAlign: "center" }}>
          <div style={{ color: "#F87171", fontWeight: 700, fontSize: 15 }}>Could not load beats</div>
          <div style={{ color: "#888", fontSize: 13, marginTop: 8 }}>{error}</div>
        </div>
      )}

      {!loading && beats.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎛</div>
          <div style={{ fontSize: 15, color: "#888", lineHeight: 1.7 }}>
            No beats uploaded yet.<br />
            Producer Pro members can upload beats<br />from their Profile tab.
          </div>
        </div>
      )}

      {!loading && leases.length > 0 && (
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

      {!loading && beats.map(beat => (
        <BeatLeaseCard key={beat.id} beat={beat} user={user} />
      ))}
    </div>
  );
}

// =============================================================================
// TRENDING SCREEN
// =============================================================================
function TrendingScreen({ savedIds, onSave, onPlay }) {
  const [beats,   setBeats]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    apiFetch("/api/youtube/trending")
      .then(d => { setBeats(d.beats || []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ padding: "20px 0 0" }}>
        <div style={{ background: "linear-gradient(135deg,#1a1a2e,#6B21A8)", borderRadius: 16, padding: "24px 20px", marginBottom: 20 }}>
          <div style={{ color: "#F59E0B", fontSize: 13, fontWeight: 800, marginBottom: 6 }}>🔥 TRENDING NOW</div>
          <div style={{ color: "white", fontSize: 26, fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>
            Hottest type beats
          </div>
          <div style={{ color: "#aaa", fontSize: 13, marginTop: 4 }}>1M+ views only - sorted by most viewed</div>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔥</div>
          <div style={{ fontSize: 13 }}>Finding viral beats with 1M+ views...</div>
        </div>
      )}

      {error && !beats.length && (
        <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 14, padding: 20, textAlign: "center" }}>
          <div style={{ color: "#F87171", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Could not load trending beats</div>
          <div style={{ color: "#888", fontSize: 13 }}>{error}</div>
        </div>
      )}

      {!loading && beats.map(beat => (
        <BeatCard key={beat.videoId} beat={beat} savedIds={savedIds} onSave={onSave} onPlay={onPlay} />
      ))}

      {!loading && !beats.length && !error && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>No trending beats found.</div>
      )}
    </div>
  );
}

// =============================================================================
// SEARCH SCREEN
// =============================================================================
function SearchScreen({ savedIds, onSave, onPlay }) {
  const [input,  setInput]  = useState("");
  const [active, setActive] = useState(null);

  const doSearch = () => { if (input.trim()) setActive(input.trim()); };

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ padding: "20px 0 10px" }}>
        <div style={{ color: "white", fontSize: 28, fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>
          Discover Beats
        </div>
        <div style={{ color: "#888", fontSize: 14, marginBottom: 14 }}>Search any artist or vibe</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, background: "#1a1a1a", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, border: "1px solid #333" }}>
            <span style={{ color: "#555" }}>🔍</span>
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder="e.g. Drake, Central Cee, UK drill..."
              style={{ background: "none", border: "none", outline: "none", color: "white", fontSize: 15, flex: 1 }}
            />
          </div>
          <button onClick={doSearch}
            style={{ background: "#C026D3", border: "none", borderRadius: 12, color: "white", fontWeight: 800, padding: "10px 18px", fontSize: 14, cursor: "pointer" }}>
            Go
          </button>
        </div>
      </div>
      {!active ? (
        <div style={{ textAlign: "center", paddingTop: 80, color: "#555" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎵</div>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            Type an artist name and tap Go.<br />
            We'll find their type beats on YouTube.
          </div>
        </div>
      ) : (
        <BeatFeed artistName={active} savedIds={savedIds} onSave={onSave} onPlay={onPlay} />
      )}
    </div>
  );
}

// =============================================================================
// SAVED SCREEN
// =============================================================================
function SavedScreen({ savedMap, savedIds, onSave, onPlay, user, onGoProfile }) {
  const list = Object.values(savedMap);
  if (!user) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 64, marginBottom: 20, opacity: 0.3 }}>🔖</div>
      <div style={{ color: "white", fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Save your favourite beats</div>
      <div style={{ color: "#888", fontSize: 15, marginBottom: 24 }}>Log in to sync saves across devices.</div>
      {list.length > 0 && (
        <div style={{ width: "100%", marginBottom: 24 }}>
          <div style={{ color: "#888", fontSize: 13, marginBottom: 12 }}>
            {list.length} beat{list.length !== 1 ? "s" : ""} saved locally
          </div>
          {list.map(beat => (
            <BeatCard key={beat.videoId} beat={beat} savedIds={savedIds} onSave={onSave} onPlay={onPlay} />
          ))}
        </div>
      )}
      <button onClick={onGoProfile}
        style={{ background: "#C026D3", border: "none", borderRadius: 32, color: "white", fontWeight: 800, padding: "16px 48px", fontSize: 16, cursor: "pointer", width: "100%", maxWidth: 300 }}>
        Log In / Sign Up
      </button>
    </div>
  );
  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ color: "white", fontSize: 28, fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>
          Saved Beats
        </div>
      </div>
      {list.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: 60, color: "#555" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔖</div>
          <div>No saved beats yet.<br />Tap 🔖 on any beat!</div>
        </div>
      ) : (
        list.map(beat => (
          <BeatCard key={beat.videoId} beat={beat} savedIds={savedIds} onSave={onSave} onPlay={onPlay} />
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

  if (!isPro) return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "calc(100vh - 80px)",
      padding: "0 20px", textAlign: "center", overflow: "hidden",
    }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2, color: "#F59E0B", marginBottom: 4 }}>MEMBERS ONLY</div>
      <div style={{ color: "#888", fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
        Unlock exclusive beats, MP3s and more.
      </div>

      <div style={{ display: "flex", gap: 10, width: "100%", marginBottom: 14 }}>
        {[
          {
            label: "🎤 Artist Pro",
            price: "£4.99/mo",
            color: "#F59E0B",
            perks: [
              "Write lyrics to beats",
              "Save & edit lyrics",
              "Exclusive member beats",
              "Download MP3s",
              "Purchase leases",
              "Bookmark unlimited beats",
            ],
          },
          {
            label: "🎛 Producer Pro",
            price: "£8.99/mo",
            color: "#C026D3",
            perks: [
              "Everything in Artist Pro",
              "Upload & sell beats",
              "Sell MP3 leases",
              "Download stats",
              "Verified badge",
              "Featured in rotation",
            ],
          },
        ].map(p => (
          <div key={p.label} style={{ flex: 1, background: "#111", border: "1.5px solid " + p.color, borderRadius: 14, padding: "12px", textAlign: "left" }}>
            <div style={{ color: "white", fontWeight: 800, fontSize: 13, marginBottom: 2 }}>{p.label}</div>
            <div style={{ color: p.color, fontWeight: 800, fontSize: 13, marginBottom: 10 }}>{p.price}</div>
            {p.perks.map(perk => (
              <div key={perk} style={{ color: "#bbb", fontSize: 11, marginBottom: 5, lineHeight: 1.3, display: "flex", alignItems: "flex-start", gap: 5 }}>
                <span style={{ color: p.color, fontWeight: 900, flexShrink: 0 }}>•</span>
                <span>{perk}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <button onClick={onGoProfile}
        style={{ background: "linear-gradient(135deg,#F59E0B,#C026D3)", border: "none", borderRadius: 32, color: "white", fontWeight: 800, padding: "14px 40px", fontSize: 16, cursor: "pointer", width: "100%" }}>
        Unlock Access
      </button>
    </div>
  );

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ padding: "20px 0 14px" }}>
        <div style={{ background: "linear-gradient(135deg,#1C1917,rgba(245,158,11,0.12))", borderRadius: 16, padding: "20px", marginBottom: 18, border: "1.5px solid rgba(245,158,11,0.3)" }}>
          <div style={{ color: "#F59E0B", fontWeight: 800, fontSize: 13, marginBottom: 4 }}>🔒 MEMBERS ONLY</div>
          <div style={{ color: "white", fontSize: 24, fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>Members Area</div>
          <div style={{ color: "#aaa", fontSize: 13, marginTop: 4 }}>Exclusive beats and downloadable MP3s</div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button onClick={() => setTab("beats")}
            style={{ flex: 1, padding: "12px", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", border: tab === "beats" ? "2px solid #F59E0B" : "1.5px solid #333", background: tab === "beats" ? "rgba(245,158,11,0.15)" : "transparent", color: tab === "beats" ? "#F59E0B" : "#666" }}>
            🔥 Exclusive Beats
          </button>
          <button onClick={() => setTab("mp3s")}
            style={{ flex: 1, padding: "12px", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", border: tab === "mp3s" ? "2px solid #C026D3" : "1.5px solid #333", background: tab === "mp3s" ? "rgba(192,38,211,0.15)" : "transparent", color: tab === "mp3s" ? "#C026D3" : "#666" }}>
            ⬇️ MP3 Downloads
          </button>
        </div>
      </div>

      {tab === "beats" && (
        <BeatFeed artistName="exclusive premium" exclusive savedIds={savedIds} onSave={onSave} onPlay={onPlay} filterTitle={false} />
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
      {status?.connected && (
        <button
          onClick={async () => {
            try {
              const r = await apiFetch("/api/producer/sync-stripe", { method: "POST" });
              alert("Synced! " + r.updated + " beat(s) updated.");
            } catch (e) {
              alert("Error: " + e.message);
            }
          }}
          style={{ marginTop: 10, width: "100%", background: "transparent", border: "1px solid #333", borderRadius: 12, color: "#888", fontWeight: 600, fontSize: 13, padding: "10px", cursor: "pointer" }}
        >
          Sync Stripe to My Beats
        </button>
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

  if (loading) return <div style={{ color: "#555", fontSize: 13, padding: "20px 0" }}>Loading your beats...</div>;

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
  const [activationCode,   setActivationCode]   = useState("");
  const [activationErr,    setActivationErr]    = useState("");
  const [activationSuccess,setActivationSuccess]= useState("");
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
      perks: ["Access Exclusive Members area","Bookmark unlimited beats","Artist verified badge","AI beat recommendations"],
    },
    {
      id: "producer", label: "🎛 Producer Pro", price: "8.99",
      perks: ["Everything in Artist Pro","Upload beats to Home featured","Featured in rotation","Producer verified badge","Analytics"],
    },
  ];

  if (user) return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ padding: "20px 0 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ color: "white", fontSize: 28, fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>My Profile</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative" }}>
          <button onClick={() => setSettingsOpen(!settingsOpen)}
            style={{ background: "#1a1a1a", border: "1px solid #333", color: "#aaa", borderRadius: 10, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>
            ⚙️ Settings
          </button>
          <button onClick={() => { onLogout && onLogout(); setMode("landing"); }}
            style={{ background: "#1a1a1a", border: "1px solid #333", color: "#aaa", borderRadius: 10, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>
            Log out
          </button>
          {settingsOpen && (
            <div style={{
              position: "absolute", top: 44, right: 0, zIndex: 100,
              background: "#111", border: "1px solid #333", borderRadius: 14,
              padding: 20, width: 300, boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ color: "white", fontWeight: 800, fontSize: 16 }}>⚙️ Settings</div>
                <button onClick={() => setSettingsOpen(false)} style={{ background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>

              <div style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>USERNAME</div>
              <input
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder={user.username || "Set your username"}
                style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
              />
              <button
                onClick={async () => {
                  if (!newUsername.trim()) return;
                  try {
                    await apiFetch("/api/auth/set-username", { method: "POST", body: JSON.stringify({ username: newUsername.trim() }) });
                    setUser({ ...user, username: newUsername.trim() });
                    setNewUsername("");
                    setSettingsMsg("Username updated!");
                    setTimeout(() => setSettingsMsg(""), 2500);
                  } catch (e) { setSettingsMsg("Error: " + e.message); }
                }}
                style={{ width: "100%", background: "#C026D3", border: "none", borderRadius: 10, color: "white", fontWeight: 800, padding: "10px", fontSize: 14, cursor: "pointer", marginBottom: 16 }}
              >
                {user.username ? "Update Username" : "Set Username"}
              </button>

              <div style={{ height: 1, background: "#1e1e1e", marginBottom: 16 }} />

              <div style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>CHANGE PASSWORD</div>
              <input
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                type="password"
                placeholder="Current password"
                style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
              />
              <input
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                type="password"
                placeholder="New password"
                style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
              />
              <input
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                type="password"
                placeholder="Confirm new password"
                style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
              />
              <button
                onClick={async () => {
                  if (!currentPw || !newPw) return;
                  if (newPw !== confirmPw) { setSettingsMsg("Passwords do not match"); return; }
                  if (newPw.length < 6) { setSettingsMsg("Password must be at least 6 characters"); return; }
                  try {
                    await apiFetch("/api/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: currentPw, new_password: newPw }) });
                    setCurrentPw(""); setNewPw(""); setConfirmPw("");
                    setSettingsMsg("Password changed successfully!");
                    setTimeout(() => setSettingsMsg(""), 2500);
                  } catch (e) { setSettingsMsg("Error: " + e.message); }
                }}
                style={{ width: "100%", background: "#1a1a1a", border: "1.5px solid #333", borderRadius: 10, color: "#aaa", fontWeight: 800, padding: "10px", fontSize: 14, cursor: "pointer", marginBottom: 8 }}
              >
                Change Password
              </button>

              {settingsMsg && (
                <div style={{ color: settingsMsg.startsWith("Error") ? "#F87171" : "#22C55E", fontSize: 13, textAlign: "center", fontWeight: 600 }}>
                  {settingsMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ background: "#111", borderRadius: 16, padding: 20, marginBottom: 20, border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#7C2D12,#C026D3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "white", fontWeight: 800, margin: "0 auto 12px" }}>
          {user.name[0]?.toUpperCase()}
        </div>
        <div style={{ color: "white", fontSize: 20, fontWeight: 800 }}>{user.name}</div>
        <div style={{ color: "#888", fontSize: 13 }}>{user.email}</div>
        {user.isPro && <div style={{ marginTop: 8, display: "inline-block", background: "rgba(192,38,211,0.2)", border: "1px solid #C026D3", borderRadius: 20, padding: "4px 14px", color: "#C026D3", fontWeight: 800, fontSize: 13 }}>⭐ Producer Pro</div>}
        {user.isArtistPro && !user.isPro && <div style={{ marginTop: 8, display: "inline-block", background: "rgba(245,158,11,0.2)", border: "1px solid #F59E0B", borderRadius: 20, padding: "4px 14px", color: "#F59E0B", fontWeight: 800, fontSize: 13 }}>🎤 Artist Pro</div>}
        {user.username && (
          <div style={{ marginTop: 6, color: "#555", fontSize: 12 }}>@{user.username}</div>
        )}
      </div>


            {user.isPro && (
        <div style={{ marginBottom: 24 }}>
          <StripeConnectSection />
        </div>
      )}

      {user.isPro && (() => {
        const [producerTab, setProducerTab] = useState("upload");
        return (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button onClick={() => setProducerTab("upload")}
              style={{ flex: 1, padding: "10px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", border: producerTab === "upload" ? "2px solid #C026D3" : "1.5px solid #333", background: producerTab === "upload" ? "rgba(192,38,211,0.15)" : "transparent", color: producerTab === "upload" ? "#C026D3" : "#666" }}>
              ⬆️ Upload Beat
            </button>
            <button onClick={() => setProducerTab("manage")}
              style={{ flex: 1, padding: "10px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", border: producerTab === "manage" ? "2px solid #F59E0B" : "1.5px solid #333", background: producerTab === "manage" ? "rgba(245,158,11,0.15)" : "transparent", color: producerTab === "manage" ? "#F59E0B" : "#666" }}>
              🎛 My Uploads
            </button>
          </div>

          {producerTab === "manage" && <MyUploadsSection user={user} />}

          {producerTab === "upload" && <div>
          <div style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Upload Your Beats</div>
          <div style={{ color: "#666", fontSize: 13, marginBottom: 14 }}>Upload MP3 files - they appear in the MP3s tab for users to download.</div>
          <div style={{ background: "#111", borderRadius: 14, padding: 16, border: "1px solid #222" }}>
            <input value={ytLink} onChange={e => setYtLink(e.target.value)} placeholder="Beat title e.g. Dark Trap Beat" style={inp} />
            <input value={uploadGenre || ""} onChange={e => setUploadGenre(e.target.value)} placeholder="Genre e.g. Trap, R&B, Afrobeats" style={inp} />
            <input value={uploadPrice || ""} onChange={e => setUploadPrice(e.target.value)} placeholder='Price e.g. free or £9.99' style={inp} />
            <label style={{ display: "block", background: "#1a1a1a", border: "1.5px dashed #444", borderRadius: 10, padding: "16px", textAlign: "center", cursor: "pointer", marginBottom: 12 }}>
              <input type="file" accept=".mp3" onChange={e => setUploadFile(e.target.files[0])} style={{ display: "none" }} />
              <div style={{ fontSize: 24, marginBottom: 6 }}>🎵</div>
              <div style={{ color: uploadFile ? "#22C55E" : "#666", fontSize: 13, fontWeight: 600 }}>
                {uploadFile ? uploadFile.name : "Tap to select MP3 file"}
              </div>
            </label>
            <button
              onClick={async () => {
                if (!ytLink.trim() || !uploadFile) return;
                setUploadLoading(true);
                setUploadMsg("");
                try {
                  const token = localStorage.getItem("bf_token");
                  const form  = new FormData();
                  form.append("title",  ytLink.trim());
                  form.append("genre",  uploadGenre || "General");
                  form.append("price",  uploadPrice || "free");
                  form.append("file",   uploadFile);
                  const res = await fetch(API_BASE + "/api/producer/upload", {
                    method: "POST",
                    headers: { Authorization: "Bearer " + token },
                    body: form,
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.detail || "Upload failed");
                  setUploads(p => [...p, data.beat]);
                  setYtLink(""); setUploadGenre(""); setUploadPrice(""); setUploadFile(null);
                  setUploadMsg("Beat uploaded successfully!");
                } catch (e) {
                  setUploadMsg("Error: " + e.message);
                } finally {
                  setUploadLoading(false);
                }
              }}
              disabled={uploadLoading}
              style={{ width: "100%", background: uploadLoading ? "#333" : "#C026D3", border: "none", borderRadius: 10, color: "white", fontWeight: 800, padding: 13, fontSize: 15, cursor: uploadLoading ? "not-allowed" : "pointer" }}>
              {uploadLoading ? "Uploading..." : "⬆️ Upload Beat"}
            </button>
            {uploadMsg && (
              <div style={{ marginTop: 10, color: uploadMsg.startsWith("Error") ? "#F87171" : "#22C55E", fontSize: 13, textAlign: "center", fontWeight: 600 }}>
                {uploadMsg}
              </div>
            )}
          </div>
          {uploads.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {uploads.map((b, i) => (
                <div key={b.id || i} style={{ background: "#111", borderRadius: 12, padding: "12px 14px", marginBottom: 10, border: "1px solid #222" }}>
                  <div style={{ color: "#C026D3", fontWeight: 700, fontSize: 13 }}>{b.title}</div>
                  <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>{b.genre} • {b.price}</div>
                </div>
              ))}
            </div>
          )}
          </div>}
        </div>
        );
      })()}
      {(user.isPro || user.isArtistPro || user.plan === "artist" || user.plan === "producer") && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 6 }}>✍️ My Lyrics</div>
          <div style={{ color: "#666", fontSize: 13, marginBottom: 14 }}>Lyrics you wrote while listening to beats.</div>
          {(!savedLyrics || savedLyrics.length === 0) ? (
            <div style={{ background: "#111", borderRadius: 14, padding: 20, border: "1px solid #222", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✍️</div>
              <div style={{ color: "#555", fontSize: 14 }}>No lyrics saved yet.<br />Play a beat and tap Write Lyrics!</div>
            </div>
          ) : (
            savedLyrics.map((lyric, i) => (
              <LyricCard
                key={lyric.id || i}
                lyric={lyric}
                lyricIndex={i}
                onDelete={() => {
                  const next = savedLyrics.filter((_, idx) => idx !== i);
                  setSavedLyrics(next);
                  try { localStorage.setItem("bf_lyrics", JSON.stringify(next)); } catch {}
                }}
                onEditLyric={onEditLyric}
              />
            ))
          )}
        </div>
      )}

      {!user.isPro && (
        <div>
          <div style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 16 }}>
            {user.isArtistPro ? "Upgrade to Producer Pro" : "Choose Your Plan"}
          </div>
          {PLANS.filter(p => !user.isArtistPro || p.id === "producer").map(pl => (
            <div key={pl.id}>
              <div onClick={() => setPlan(pl.id)}
                style={{ background: plan === pl.id ? "rgba(192,38,211,0.12)" : "#111", border: `1.5px solid ${plan === pl.id ? "#C026D3" : "#222"}`, borderRadius: 16, padding: 18, marginBottom: 12, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ color: "white", fontWeight: 800, fontSize: 17 }}>{pl.label}</div>
                  <div style={{ color: "#C026D3", fontWeight: 800, fontSize: 17 }}>£{pl.price}/mo</div>
                </div>
                {pl.perks.map(p => (
                  <div key={p} style={{ color: "#ccc", fontSize: 13, marginBottom: 6, display: "flex", gap: 8 }}>
                    <span style={{ color: "#C026D3" }}>✓</span>{p}
                  </div>
                ))}
              </div>
              {plan === pl.id && (
                <div style={{ background: "#111", borderRadius: 14, padding: 16, border: "1px solid #222", marginBottom: 16 }}>
                  <div style={{ color: "#888", fontSize: 13, marginBottom: 16, textAlign: "center", lineHeight: 1.8 }}>
                    Pay securely with card, Apple Pay or Google Pay.<br />
                    Your activation code is emailed to you instantly after payment.
                  </div>

                  <button
                    onClick={async () => {
                      setActivationErr("");
                      try {
                        const result = await apiFetch("/api/stripe/create-checkout", {
                          method: "POST",
                          body: JSON.stringify({ plan: pl.id }),
                        });
                        window.location.href = result.checkout_url;
                      } catch (e) {
                        setActivationErr(e.message);
                      }
                    }}
                    style={{ width: "100%", background: "linear-gradient(135deg,#635BFF,#8B5CF6)", border: "none", borderRadius: 12, color: "white", fontWeight: 800, padding: 14, fontSize: 16, cursor: "pointer", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    💳 Pay £{pl.price}/mo with Card
                  </button>

                  <div style={{ color: "#555", fontSize: 12, textAlign: "center", marginBottom: 16 }}>
                    - or enter your activation code below -
                  </div>

                  <input
                    value={activationCode}
                    onChange={e => setActivationCode(e.target.value.toUpperCase())}
                    placeholder="Activation code e.g. PRD-A1B2C3"
                    style={{ width: "100%", background: "#1a1a1a", border: "1.5px solid #444", borderRadius: 12, padding: "13px 14px", color: "white", fontSize: 14, marginBottom: 10, boxSizing: "border-box", outline: "none", letterSpacing: 2, fontWeight: 700 }}
                  />
                  {activationErr && <div style={{ color: "#F87171", fontSize: 13, marginBottom: 10, textAlign: "center" }}>{activationErr}</div>}
                  {activationSuccess && <div style={{ color: "#22C55E", fontSize: 13, marginBottom: 10, textAlign: "center" }}>{activationSuccess}</div>}
                  <button
                    onClick={async () => {
                      if (!activationCode.trim()) return;
                      setActivationErr("");
                      setActivationSuccess("");
                      try {
                        const result = await apiFetch("/api/auth/activate", {
                          method: "POST",
                          body: JSON.stringify({ code: activationCode.trim() }),
                        });
                        setActivationSuccess(result.message || "Plan activated!");
                        setUser({ ...user, plan: result.plan, isPro: result.plan === "producer", isArtistPro: result.plan === "artist" || result.plan === "producer" });
                      } catch (e) {
                        setActivationErr(e.message);
                      }
                    }}
                    style={{ width: "100%", background: "#1a1a1a", border: "1.5px solid #C026D3", borderRadius: 12, color: "#C026D3", fontWeight: 800, padding: 13, fontSize: 15, cursor: "pointer" }}>
                    🔑 Activate with Code
                  </button>
                </div>
              )}
            </div>
          ))}
          <div style={{ color: "#444", fontSize: 11, textAlign: "center", lineHeight: 1.7, marginTop: 8 }}>
            Payments processed securely by Stripe.<br />Renews monthly. Cancel anytime.
          </div>
        </div>
      )}
    </div>
  );

  if (mode === "landing") return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "75vh", padding: 32, textAlign: "center" }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", border: "2.5px solid #C026D3", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 38 }}>👤</span>
      </div>
      <div style={{ color: "white", fontFamily: "'Bebas Neue',sans-serif", fontSize: 34, letterSpacing: 3, marginBottom: 12 }}>BEATFINDER</div>
      <div style={{ color: "#888", fontSize: 14, lineHeight: 1.7, marginBottom: 36 }}>
        Create a free account to save beats,<br />or subscribe as an artist or producer.
      </div>
      <button onClick={() => setMode("signup")}
        style={{ width: "100%", background: "#C026D3", border: "none", borderRadius: 32, color: "white", fontWeight: 800, padding: 16, fontSize: 16, cursor: "pointer", marginBottom: 16 }}>
        Create account
      </button>
      <button onClick={() => setMode("login")}
        style={{ background: "none", border: "none", color: "#06B6D4", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
        I already have an account
      </button>
    </div>
  );

  if (mode === "forgot") return <ForgotPasswordScreen onBack={() => setMode("login")} />;

  return (
    <div style={{ padding: "40px 24px 100px" }}>
      <button onClick={() => setMode("landing")} style={{ background: "none", border: "none", color: "white", fontSize: 28, cursor: "pointer", marginBottom: 20 }}>←</button>
      <div style={{ color: "white", fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, letterSpacing: 2, marginBottom: 24 }}>
        {mode === "signup" ? "CREATE ACCOUNT" : "WELCOME BACK"}
      </div>
      {mode === "signup" && <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inp} />}
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" style={inp} />
      <input value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" type="password" style={{ ...inp, marginBottom: 16 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <div
          onClick={() => {
            const next = !rememberMe;
            setRememberMe(next);
            try { localStorage.setItem("bf_remember", next ? "1" : "0"); } catch {}
          }}
          style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer",
            background: rememberMe ? "#C026D3" : "transparent",
            border: rememberMe ? "2px solid #C026D3" : "2px solid #444",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {rememberMe && <span style={{ color: "white", fontSize: 14, fontWeight: 900 }}>✓</span>}
        </div>
        <span style={{ color: "#aaa", fontSize: 14, cursor: "pointer" }} onClick={() => {
          const next = !rememberMe;
          setRememberMe(next);
          try { localStorage.setItem("bf_remember", next ? "1" : "0"); } catch {}
        }}>
          Remember my login
        </span>
      </div>

      <button onClick={async () => {
        if (!email || !pw) return;
        setAuthErr("");
        setAuthLoading(true);
        try {
          if (mode === "login" && !pw.trim()) {
            setAuthErr("Please enter your password");
            setAuthLoading(false);
            return;
          }
          const u = mode === "signup"
            ? await AuthAPI.register(name || email.split("@")[0], email, pw)
            : await AuthAPI.login(email, pw);
          if (rememberMe) {
            try { localStorage.setItem("bf_saved_email", email); } catch {}
          } else {
            try { localStorage.removeItem("bf_saved_email"); } catch {}
          }
          setUser(u);
          setMode("landing");
        } catch (e) {
          setAuthErr(e.message);
        } finally {
          setAuthLoading(false);
        }
      }}
        disabled={authLoading}
        style={{ width: "100%", background: "#C026D3", border: "none", borderRadius: 32, color: "white", fontWeight: 800, padding: 16, fontSize: 16, cursor: "pointer", opacity: authLoading ? 0.6 : 1 }}>
        {authLoading ? "Please wait..." : mode === "signup" ? "Create Account" : "Log In"}
      </button>
      {authErr && <div style={{ color: "#F87171", fontSize: 13, textAlign: "center", marginTop: 12 }}>{authErr}</div>}
      <div style={{ textAlign: "center", marginTop: 20 }}>
        <span style={{ color: "#888", fontSize: 14 }}>{mode === "signup" ? "Already have an account? " : "No account? "}</span>
        <button onClick={() => setMode(mode === "signup" ? "login" : "signup")}
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
// BOTTOM NAV
// =============================================================================
const NAV = [
  { id: "home",      label: "Home",    icon: "🏠" },
  { id: "artists",   label: "Artists", icon: "▦"  },
  { id: "trending",  label: "Trending",icon: "🔥" },
  { id: "search",    label: "Search",  icon: "🔍" },
  { id: "saved",     label: "Saved",   icon: "🔖" },
  { id: "exclusive", label: "Members", icon: "🔒" },
  { id: "profile",   label: "Profile", icon: "👤" },
];

// =============================================================================
// ROOT APP
// =============================================================================
export default function BeatFinder() {
  const [tab,     setTab]     = useState("home");
  const [artist,  setArtist]  = useState(null); // kept for compatibility
  const [user,    setUser]    = useState(null);
  const [playing, setPlaying] = useState(null);

  // savedMap: { [videoId]: beat } - localStorage for guests, backend for logged-in users
  const [savedMap, setSavedMap] = useState(loadSaved);
  const savedIds = new Set(Object.keys(savedMap));

  // Handle reset token from URL
  const resetToken = new URLSearchParams(window.location.search).get("reset_token");

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
        setTab("home");
        setVisitedTabs(new Set(["home"]));
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

  const toggleSave = useCallback(beat => {
    setSavedMap(prev => {
      const next = { ...prev };
      if (next[beat.videoId]) {
        delete next[beat.videoId];
        if (user) BeatsAPI.remove(beat.videoId).catch(console.warn);
      } else {
        next[beat.videoId] = beat;
        if (user) BeatsAPI.save(beat).catch(console.warn);
      }
      persistSaved(next);
      return next;
    });
  }, [user]);

  const handlePlay = useCallback(beat => setPlaying(beat), []);
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(["home", "profile"]));

  const goTab = id => {
    setPlaying(null);
    setTab(id);
    setVisitedTabs(prev => new Set([...prev, id]));
    // Never reset artist - Artists tab manages its own state
  };

  // Lyrics state
  const [lyricsOpen,    setLyricsOpen]    = useState(false);
  const [lyricsBeat,    setLyricsBeat]    = useState(null);
  const [editingLyric,  setEditingLyric]  = useState(null);
  const [editingIndex,  setEditingIndex]  = useState(null);
  const [publicProfile, setPublicProfile] = useState(null);
  const [savedLyrics,  setSavedLyrics]  = useState(() => {
    try { return JSON.parse(localStorage.getItem("bf_lyrics") || "[]"); } catch { return []; }
  });

  const isArtistPro = user?.isPro || user?.isArtistPro || user?.plan === "artist" || user?.plan === "producer";

  const handleOpenLyrics = useCallback(beat => {
    setPlaying(null);   // stop the YouTube player
    setLyricsBeat(beat);
    setEditingLyric(null);
    setEditingIndex(null);
    setLyricsOpen(true);
  }, []);

  const handleEditLyric = useCallback((lyric, index) => {
    setEditingLyric(lyric);
    setEditingIndex(index);
    setLyricsBeat(lyric.beat || null);
    // Play beat first, then open notepad on top
    if (lyric.beat) {
      setPlaying(lyric.beat);
    }
    setLyricsOpen(true);
  }, []);

  const handleSaveLyric = useCallback((lyric, editIndex) => {
    setSavedLyrics(prev => {
      let next;
      if (editIndex !== null && editIndex !== undefined) {
        next = prev.map((l, i) => i === editIndex ? lyric : l);
      } else {
        next = [lyric, ...prev];
      }
      try { localStorage.setItem("bf_lyrics", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  if (resetToken) {
    return (
      <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans',sans-serif", paddingTop: "env(safe-area-inset-top)" }}>
        <ResetPasswordScreen token={resetToken} onDone={() => { window.history.replaceState({}, "", "/"); window.location.reload(); }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans',sans-serif", paddingTop: "env(safe-area-inset-top)" }}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />

      {playing && <Player beat={playing} onClose={() => setPlaying(null)} savedIds={savedIds} onSave={toggleSave} isArtistPro={isArtistPro} onOpenLyrics={handleOpenLyrics} savedLyrics={savedLyrics} onEditLyric={handleEditLyric} onGoMembers={() => { setPlaying(null); setTab("exclusive"); }} />}
      {lyricsOpen && <LyricsNotepad beat={lyricsBeat} onClose={() => { setLyricsOpen(false); setEditingLyric(null); setEditingIndex(null); }} onSaveLyric={handleSaveLyric} initialLyric={editingLyric} lyricIndex={editingIndex} />}
      {publicProfile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "#0a0a0a", overflowY: "auto", paddingTop: "env(safe-area-inset-top)" }}>
          <PublicProfileScreen username={publicProfile} onBack={() => setPublicProfile(null)} onPlay={handlePlay} savedIds={savedIds} onSave={toggleSave} />
        </div>
      )}

      <div style={{ overflowY: "auto", height: "calc(100vh - 72px)" }}>
        {visitedTabs.has("home")      && <div style={{ display: tab === "home"      ? "block" : "none" }}><HomeScreen savedIds={savedIds} onSave={toggleSave} onPlay={handlePlay} user={user} onGoMembers={() => setTab("exclusive")} /></div>}
        {visitedTabs.has("artists")   && <div style={{ display: tab === "artists"   ? "block" : "none" }}><ArtistsScreen onPlay={handlePlay} savedIds={savedIds} onSave={toggleSave} /></div>}
        {visitedTabs.has("trending")  && <div style={{ display: tab === "trending"  ? "block" : "none" }}><TrendingScreen  savedIds={savedIds} onSave={toggleSave} onPlay={handlePlay} /></div>}
        {visitedTabs.has("search")    && <div style={{ display: tab === "search"    ? "block" : "none" }}><SearchScreen    savedIds={savedIds} onSave={toggleSave} onPlay={handlePlay} /></div>}
        {visitedTabs.has("saved")     && <div style={{ display: tab === "saved"     ? "block" : "none" }}><SavedScreen savedMap={savedMap} savedIds={savedIds} onSave={toggleSave} user={user} onGoProfile={() => goTab("profile")} onPlay={handlePlay} /></div>}
        {visitedTabs.has("exclusive") && <div style={{ display: tab === "exclusive" ? "block" : "none" }}><ExclusiveScreen user={user} onGoProfile={() => goTab("profile")} onPlay={handlePlay} savedIds={savedIds} onSave={toggleSave} /></div>}
        {visitedTabs.has("profile")   && <div style={{ display: tab === "profile"   ? "block" : "none" }}><ProfileScreen user={user} setUser={u => { setUser(u); if (u) { setTab("home"); setVisitedTabs(new Set(["home", "profile"])); } }} onLogout={() => { AuthAPI.logout(); setUser(null); setTab("home"); setVisitedTabs(new Set(["home", "profile"])); }} savedLyrics={savedLyrics} setSavedLyrics={setSavedLyrics} onPlayBeat={handlePlay} onEditLyric={handleEditLyric} /></div>}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(10,10,10,0.97)", borderTop: "1px solid #1a1a1a", display: "flex", height: "calc(72px + env(safe-area-inset-bottom))", zIndex: 100, backdropFilter: "blur(20px)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {NAV.map(n => {
          const isPro    = user?.isPro || user?.isArtistPro;
          const locked   = n.id === "exclusive" && !isPro;
          const isActive = tab === n.id;
          return (
            <button key={n.id} onClick={() => goTab(n.id)}
              style={{
                flex: 1, background: "none", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                color: isActive ? (n.id === "exclusive" ? "#F59E0B" : "#C026D3") : locked ? "#F59E0B55" : "#555",
                position: "relative",
              }}>
              <span style={{ fontSize: 15 }}>{n.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 700 }}>{n.label}</span>
              {locked && <div style={{ position: "absolute", top: 8, right: "calc(50% - 12px)", width: 7, height: 7, borderRadius: "50%", background: "#F59E0B" }} />}
              {n.id === "saved" && savedIds.size > 0 && (
                <div style={{ position: "absolute", top: 6, right: "calc(50% - 14px)", background: "#C026D3", borderRadius: 10, fontSize: 9, fontWeight: 800, color: "white", padding: "1px 5px", minWidth: 16, textAlign: "center" }}>
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
