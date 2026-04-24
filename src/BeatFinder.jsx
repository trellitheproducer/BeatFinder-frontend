import { useState, useEffect, useCallback, useRef } from “react”;

// =============================================================================
// CONFIG
// =============================================================================

// ── Backend URL ──────────────────────────────────────────────────────────────
// When developing locally:   http://localhost:8000
// When deployed on Render:   https://your-app.onrender.com
// Set this to your Render/Railway URL after deployment.
const API_BASE = “https://beatfinder-backend.onrender.com”;

// ── In-memory cache (10 minutes TTL) ─────────────────────────────────────────
const cache = {};
const CACHE_TTL = 10 * 60 * 1000;

// =============================================================================
// API HELPERS
// These call your FastAPI backend — which in turn calls YouTube server-side.
// This fixes the iOS Safari CORS block permanently.
// =============================================================================

// Read JWT token saved after login
function getToken() {
try { return localStorage.getItem(“bf_token”) || null; }
catch { return null; }
}

// Save token after login/register
function saveToken(token) {
try { localStorage.setItem(“bf_token”, token); } catch {}
}

// Remove token on logout
function clearToken() {
try { localStorage.removeItem(“bf_token”); } catch {}
}

// Generic authenticated fetch helper
async function apiFetch(path, options = {}) {
const token = getToken();
const headers = {
“Content-Type”: “application/json”,
…(token ? { Authorization: `Bearer ${token}` } : {}),
…(options.headers || {}),
};
const res = await fetch(`${API_BASE}${path}`, { …options, headers });
if (!res.ok) {
const err = await res.json().catch(() => ({ detail: res.statusText }));
throw new Error(err.detail || “API error”);
}
return res.json();
}

// =============================================================================
// YOUTUBE — calls /api/youtube/search on your FastAPI backend
// Backend makes the real googleapis.com call server-side (no CORS issues)
// =============================================================================
async function fetchBeats(artistName) {
const query = artistName;
if (cache[query] && Date.now() - cache[query].ts < CACHE_TTL) {
console.log(`[BeatFinder] Cache hit: "${query}"`);
return { beats: cache[query].data, error: null };
}

console.log(`[BeatFinder] Searching backend for: "${query} type beat"`);
try {
const data = await apiFetch(
`/api/youtube/search?artist=${encodeURIComponent(query)}&max=20`
);
const beats = data.beats || [];
cache[query] = { data: beats, ts: Date.now() };
console.log(`[BeatFinder] Got ${beats.length} beats for "${query}"`);
return { beats, error: null };
} catch (err) {
console.error(”[BeatFinder] fetchBeats error:”, err);
return { beats: [], error: err.message };
}
}

// =============================================================================
// AUTH API — register / login / me / upgrade plan
// =============================================================================
const AuthAPI = {
async register(name, email, password) {
const data = await apiFetch(”/api/auth/register”, {
method: “POST”,
body: JSON.stringify({ name, email, password }),
});
saveToken(data.access_token);
return data.user;
},

async login(email, password) {
const data = await apiFetch(”/api/auth/login”, {
method: “POST”,
body: JSON.stringify({ email, password }),
});
saveToken(data.access_token);
return data.user;
},

async me() {
return apiFetch(”/api/auth/me”);
},

async upgrade(plan) {
return apiFetch(”/api/auth/upgrade”, {
method: “POST”,
body: JSON.stringify({ plan }),
});
},

logout() {
clearToken();
},
};

// =============================================================================
// SAVED BEATS API — syncs with MongoDB via backend
// =============================================================================
const BeatsAPI = {
async list() {
return apiFetch(”/api/beats/”);
},

async save(beat) {
return apiFetch(”/api/beats/”, {
method: “POST”,
body: JSON.stringify({ beat }),
});
},

async remove(videoId) {
return apiFetch(`/api/beats/${videoId}`, { method: “DELETE” });
},
};

// =============================================================================
// HELPERS
// =============================================================================
const GRAD = [
[”#6B21A8”,”#9333EA”],[”#0F4C75”,”#1B6CA8”],[”#7C2D12”,”#C2410C”],
[”#1E3A5F”,”#2563EB”],[”#4A044E”,”#86198F”],[”#065F46”,”#059669”],
[”#7C3AED”,”#A855F7”],[”#9D174D”,”#EC4899”],[”#134E4A”,”#0D9488”],
[”#1E1B4B”,”#4338CA”],[”#1a1a2e”,”#C026D3”],[”#0f3460”,”#F59E0B”],
];
const initials = n => n.split(” “).map(w => w[0]).join(””).slice(0,2).toUpperCase();
const watchUrl  = id => `https://www.youtube.com/watch?v=${id}`;
const embedUrl  = id => `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

// =============================================================================
// ARTIST DATABASE
// =============================================================================
const ARTISTS_USA = [
{id:“21savage”,     name:“21 Savage”,       cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/21_Savage_2019_by_Glenn_Francis.jpg/440px-21_Savage_2019_by_Glenn_Francis.jpg”},
{id:“drake”,        name:“Drake”,            cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Drake_July_2016.jpg/440px-Drake_July_2016.jpg”},
{id:“future”,       name:“Future”,           cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Future_rapper_2019.jpg/440px-Future_rapper_2019.jpg”},
{id:“gunna”,        name:“Gunna”,            cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Gunna_2019.jpg/440px-Gunna_2019.jpg”},
{id:“juicewrld”,    name:“Juice WRLD”,       cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Juice_WRLD_2018.jpg/440px-Juice_WRLD_2018.jpg”},
{id:“kanye”,        name:“Kanye West”,       cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Kanye_West_at_the_2009_Tribeca_Film_Festival.jpg/440px-Kanye_West_at_the_2009_Tribeca_Film_Festival.jpg”},
{id:“kendrick”,     name:“Kendrick Lamar”,   cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Kendrick_Lamar_-*The_Heart_Part_5*%28cropped%29.png/440px-Kendrick_Lamar_-*The_Heart_Part_5*%28cropped%29.png”},
{id:“lilbaby”,      name:“Lil Baby”,         cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Lil_Baby_2019.jpg/440px-Lil_Baby_2019.jpg”},
{id:“lildurk”,      name:“Lil Durk”,         cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Lil_Durk_2021.jpg/440px-Lil_Durk_2021.jpg”},
{id:“liluzivert”,   name:“Lil Uzi Vert”,     cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Lil_Uzi_Vert_2018.jpg/440px-Lil_Uzi_Vert_2018.jpg”},
{id:“metroboomin”,  name:“Metro Boomin”,     cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Metro_Boomin_2022.jpg/440px-Metro_Boomin_2022.jpg”},
{id:“playboicarti”, name:“Playboi Carti”,    cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Playboi_Carti_2018.jpg/440px-Playboi_Carti_2018.jpg”},
{id:“travis”,       name:“Travis Scott”,     cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Travis_Scott_2018.jpg/440px-Travis_Scott_2018.jpg”},
{id:“youngthug”,    name:“Young Thug”,       cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Young_Thug_2016.jpg/440px-Young_Thug_2016.jpg”},
{id:“nba”,          name:“NBA YoungBoy”,     cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NBA_YoungBoy_2018.jpg/440px-NBA_YoungBoy_2018.jpg”},
{id:“cardib”,       name:“Cardi B”,          cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Cardi_B_2019.jpg/440px-Cardi_B_2019.jpg”},
{id:“nickiminaj”,   name:“Nicki Minaj”,      cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Nicki_Minaj_2013.jpg/440px-Nicki_Minaj_2013.jpg”},
{id:“eminem”,       name:“Eminem”,           cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Eminem_-*Concert_for_Valor.jpg/440px-Eminem*-*Concert_for_Valor.jpg”},
{id:“jcole”,        name:“J. Cole”,          cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/J_Cole_2013.jpg/440px-J_Cole_2013.jpg”},
{id:“meekmill”,     name:“Meek Mill”,        cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Meek_Mill_2019.jpg/440px-Meek_Mill_2019.jpg”},
{id:“postmalone”,   name:“Post Malone”,      cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Post_Malone_2019.jpg/440px-Post_Malone_2019.jpg”},
{id:“rodwave”,      name:“Rod Wave”,         cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Rod_Wave_2021.jpg/440px-Rod_Wave_2021.jpg”},
{id:“polo”,         name:“Polo G”,           cat:“Rap”,    flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Polo_G_2019.jpg/440px-Polo_G_2019.jpg”},
{id:“theweeknd”,    name:“The Weeknd”,       cat:“R&B M”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/The_Weeknd*-*Openair_Frauenfeld_2017_10.jpg/440px-The_Weeknd*-_Openair_Frauenfeld_2017_10.jpg”},
{id:“brysonti”,     name:“Bryson Tiller”,    cat:“R&B M”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Bryson_Tiller_2016.jpg/440px-Bryson_Tiller_2016.jpg”},
{id:“chrisb”,       name:“Chris Brown”,      cat:“R&B M”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/4/forty/Chris_Brown_2019.jpg/440px-Chris_Brown_2019.jpg”},
{id:“usher”,        name:“Usher”,            cat:“R&B M”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Usher_2019.jpg/440px-Usher_2019.jpg”},
{id:“frankocean”,   name:“Frank Ocean”,      cat:“R&B M”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Frank_Ocean_2012.jpg/440px-Frank_Ocean_2012.jpg”},
{id:“andersonpaak”, name:“Anderson .Paak”,   cat:“R&B M”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Anderson_Paak_2017.jpg/440px-Anderson_Paak_2017.jpg”},
{id:“giveon”,       name:“Giveon”,           cat:“R&B M”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Giveon_2021.jpg/440px-Giveon_2021.jpg”},
{id:“brentfaiyaz”,  name:“Brent Faiyaz”,     cat:“R&B M”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Brent_Faiyaz_2019.jpg/440px-Brent_Faiyaz_2019.jpg”},
{id:“dvsn”,         name:“dvsn”,             cat:“R&B M”,  flag:“🇺🇸”},
{id:“beyonce”,      name:“Beyonce”,          cat:“R&B F”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Beyonce_at_The_Formation_World_Tour.jpg/440px-Beyonce_at_The_Formation_World_Tour.jpg”},
{id:“sza”,          name:“SZA”,              cat:“R&B F”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/SZA_2017.jpg/440px-SZA_2017.jpg”},
{id:“her”,          name:“H.E.R.”,           cat:“R&B F”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/HER_2018.jpg/440px-HER_2018.jpg”},
{id:“summerwalker”, name:“Summer Walker”,    cat:“R&B F”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Summer_Walker_2019.jpg/440px-Summer_Walker_2019.jpg”},
{id:“keyshia”,      name:“Keyshia Cole”,     cat:“R&B F”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Keyshia_Cole_2010.jpg/440px-Keyshia_Cole_2010.jpg”},
{id:“jhene”,        name:“Jhene Aiko”,       cat:“R&B F”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Jhene_Aiko_2015.jpg/440px-Jhene_Aiko_2015.jpg”},
{id:“arianag”,      name:“Ariana Grande”,    cat:“R&B F”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Ariana_Grande_2018.jpg/440px-Ariana_Grande_2018.jpg”},
{id:“aliciakeys”,   name:“Alicia Keys”,      cat:“R&B F”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Alicia_Keys_2019.jpg/440px-Alicia_Keys_2019.jpg”},
{id:“dojacat”,      name:“Doja Cat”,         cat:“R&B F”,  flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Doja_Cat_2019.jpg/440px-Doja_Cat_2019.jpg”},
{id:“bigsean”,      name:“Big Sean”,         cat:“Detroit”,flag:“🇺🇸”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Big_Sean_2017.jpg/440px-Big_Sean_2017.jpg”},
{id:“teegriz”,      name:“Tee Grizzley”,     cat:“Detroit”,flag:“🇺🇸”},
{id:“babyfaceray”,  name:“Babyface Ray”,     cat:“Detroit”,flag:“🇺🇸”},
{id:“42dugg”,       name:“42 Dugg”,          cat:“Detroit”,flag:“🇺🇸”},
{id:“dannybrown”,   name:“Danny Brown”,      cat:“Detroit”,flag:“🇺🇸”},
{id:“sadababy”,     name:“Sada Baby”,        cat:“Detroit”,flag:“🇺🇸”},
{id:“icewear”,      name:“Icewear Vezzo”,    cat:“Detroit”,flag:“🇺🇸”},
{id:“riodayungo”,   name:“Rio Da Yung OG”,   cat:“Detroit”,flag:“🇺🇸”},
{id:“babytron”,     name:“BabyTron”,         cat:“Detroit”,flag:“🇺🇸”},
{id:“veeze”,        name:“Veeze”,            cat:“Detroit”,flag:“🇺🇸”},
{id:“dejloaf”,      name:“Dej Loaf”,         cat:“Detroit”,flag:“🇺🇸”},
{id:“kashdoll”,     name:“Kash Doll”,        cat:“Detroit”,flag:“🇺🇸”},
{id:“skillababy”,   name:“Skilla Baby”,      cat:“Detroit”,flag:“🇺🇸”},
];

const ARTISTS_UK = [
{id:“ajtracey”,      name:“AJ Tracey”,       cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/AJ_Tracey_2018.jpg/440px-AJ_Tracey_2018.jpg”},
{id:“aitch”,         name:“Aitch”,           cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Aitch_2021.jpg/440px-Aitch_2021.jpg”},
{id:“centralcee”,    name:“Central Cee”,     cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Central_Cee_2022.jpg/440px-Central_Cee_2022.jpg”},
{id:“dblockeurope”,  name:“D-Block Europe”,  cat:“UK Rap”, flag:“🇬🇧”},
{id:“dave”,          name:“Dave”,            cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Dave_rapper_2020.jpg/440px-Dave_rapper_2020.jpg”},
{id:“diggad”,        name:“Digga D”,         cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Digga_D_2021.jpg/440px-Digga_D_2021.jpg”},
{id:“headieone”,     name:“Headie One”,      cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Headie_One_2020.jpg/440px-Headie_One_2020.jpg”},
{id:“jhus”,          name:“J Hus”,           cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/J_Hus_2017.jpg/440px-J_Hus_2017.jpg”},
{id:“ktrap”,         name:“K-Trap”,          cat:“UK Rap”, flag:“🇬🇧”},
{id:“potterpayper”,  name:“Potter Payper”,   cat:“UK Rap”, flag:“🇬🇧”},
{id:“skepta”,        name:“Skepta”,          cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Skepta_2016.jpg/440px-Skepta_2016.jpg”},
{id:“stormzy”,       name:“Stormzy”,         cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Stormzy_2017.jpg/440px-Stormzy_2017.jpg”},
{id:“slowthai”,      name:“Slowthai”,        cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Slowthai_2019.jpg/440px-Slowthai_2019.jpg”},
{id:“ghetts”,        name:“Ghetts”,          cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Ghetts_2021.jpg/440px-Ghetts_2021.jpg”},
{id:“giggs”,         name:“Giggs”,           cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Giggs_rapper_2017.jpg/440px-Giggs_rapper_2017.jpg”},
{id:“dizzee”,        name:“Dizzee Rascal”,   cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Dizzee_Rascal_2013.jpg/440px-Dizzee_Rascal_2013.jpg”},
{id:“wiley”,         name:“Wiley”,           cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Wiley_2012.jpg/440px-Wiley_2012.jpg”},
{id:“jme”,           name:“JME”,             cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/JME_2015.jpg/440px-JME_2015.jpg”},
{id:“kano”,          name:“Kano”,            cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Kano_rapper_2016.jpg/440px-Kano_rapper_2016.jpg”},
{id:“ninesuk”,       name:“Nines”,           cat:“UK Rap”, flag:“🇬🇧”},
{id:“mostack”,       name:“MoStack”,         cat:“UK Rap”, flag:“🇬🇧”},
{id:“fredo”,         name:“Fredo”,           cat:“UK Rap”, flag:“🇬🇧”},
{id:“arrdee”,        name:“ArrDee”,          cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/ArrDee_2022.jpg/440px-ArrDee_2022.jpg”},
{id:“tion”,          name:“Tion Wayne”,      cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Tion_Wayne_2021.jpg/440px-Tion_Wayne_2021.jpg”},
{id:“stefflon”,      name:“Stefflon Don”,    cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Stefflon_Don_2018.jpg/440px-Stefflon_Don_2018.jpg”},
{id:“ladyleshurr”,   name:“Lady Leshurr”,    cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Lady_Leshurr_2016.jpg/440px-Lady_Leshurr_2016.jpg”},
{id:“missdynamite”,  name:“Ms Dynamite”,     cat:“UK Rap”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Ms_Dynamite_2004.jpg/440px-Ms_Dynamite_2004.jpg”},
{id:“craigdavid”,    name:“Craig David”,     cat:“UK R&B”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Craig_David_2016.jpg/440px-Craig_David_2016.jpg”},
{id:“jorja”,         name:“Jorja Smith”,     cat:“UK R&B”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Jorja_Smith_2018.jpg/440px-Jorja_Smith_2018.jpg”},
{id:“rayblk”,        name:“Ray BLK”,         cat:“UK R&B”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Ray_BLK_2017.jpg/440px-Ray_BLK_2017.jpg”},
{id:“mahalia”,       name:“Mahalia”,         cat:“UK R&B”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Mahalia_2019.jpg/440px-Mahalia_2019.jpg”},
{id:“pinkpantheress”,name:“PinkPantheress”,  cat:“UK R&B”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/PinkPantheress_2022.jpg/440px-PinkPantheress_2022.jpg”},
{id:“samsmith”,      name:“Sam Smith”,       cat:“UK R&B”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Sam_Smith_2015.jpg/440px-Sam_Smith_2015.jpg”},
{id:“raye”,          name:“RAYE”,            cat:“UK R&B”, flag:“🇬🇧”, img:“https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/RAYE_2023.jpg/440px-RAYE_2023.jpg”},
{id:“dotrotten”,     name:“Dot Rotten / Zeph Ellis”, cat:“Grime”, flag:“🇬🇧”,
searchOverride:“Dot Rotten Zeph Ellis instrumental grime”},
];

const USA_CATS = [“All”,“Rap”,“R&B M”,“R&B F”,“Detroit”];
const UK_CATS  = [“All”,“UK Rap”,“UK R&B”,“Grime”];

// =============================================================================
// LOCAL STORAGE
// =============================================================================
function loadSaved() {
try { return JSON.parse(localStorage.getItem(“bf_saved”) || “{}”); }
catch { return {}; }
}
function persistSaved(s) {
try { localStorage.setItem(“bf_saved”, JSON.stringify(s)); }
catch (e) { console.warn(”[BeatFinder] Could not save:”, e); }
}

// =============================================================================
// AVATAR
// =============================================================================
// Photo cache — persists across renders so each artist is only fetched once
const photoCache = {};

function Av({ name, size = 88, idx = 0, img }) {
const [g1, g2] = GRAD[idx % GRAD.length];
const [imgErr,  setImgErr]  = useState(false);
const [photo,   setPhoto]   = useState(img || photoCache[name] || null);
const [visible, setVisible] = useState(false);
const ref = useRef(null);

// Intersection Observer — only fetch when avatar scrolls into view
useEffect(() => {
if (!ref.current) return;
const obs = new IntersectionObserver(
([entry]) => { if (entry.isIntersecting) setVisible(true); },
{ threshold: 0.1 }
);
obs.observe(ref.current);
return () => obs.disconnect();
}, []);

// Fetch photo only when visible and not already loaded
useEffect(() => {
if (!visible || photo || img) return;
if (photoCache[name]) { setPhoto(photoCache[name]); return; }
fetch(API_BASE + “/api/youtube/artist-photo?artist=” + encodeURIComponent(name))
.then(r => r.json())
.then(d => {
if (d.photo) {
photoCache[name] = d.photo;
setPhoto(d.photo);
}
})
.catch(() => {});
}, [visible, name, img, photo]);

const src = photo || img;

return (
<div ref={ref} style={{
width: size, height: size, borderRadius: “50%”, flexShrink: 0,
overflow: “hidden”, position: “relative”,
border: “2.5px solid rgba(255,255,255,0.15)”,
background: src && !imgErr ? “#111” : “linear-gradient(135deg,” + g1 + “,” + g2 + “)”,
display: “flex”, alignItems: “center”, justifyContent: “center”,
}}>
{src && !imgErr ? (
<img
src={src}
alt={name}
onError={() => setImgErr(true)}
style={{ width: “100%”, height: “100%”, objectFit: “cover”, display: “block” }}
/>
) : (
<span style={{
fontSize: size * 0.28, fontWeight: 800, color: “white”,
fontFamily: “‘Bebas Neue’,sans-serif”,
}}>
{initials(name)}
</span>
)}
</div>
);
}

// =============================================================================
// FULL-SCREEN PLAYER
// =============================================================================
function Player({ beat, onClose }) {
return (
<div style={{
position: “fixed”, inset: 0, zIndex: 9999, background: “#000”,
display: “flex”, flexDirection: “column”, fontFamily: “‘DM Sans’,sans-serif”,
}}>
<div style={{
display: “flex”, alignItems: “center”, gap: 12,
padding: “14px 16px”, borderBottom: “1px solid #1a1a1a”,
background: “#0a0a0a”, flexShrink: 0,
}}>
<button onClick={onClose} style={{
background: “#1a1a1a”, border: “1px solid #333”, borderRadius: “50%”,
color: “white”, width: 36, height: 36, fontSize: 20, cursor: “pointer”,
display: “flex”, alignItems: “center”, justifyContent: “center”,
}}>
‹
</button>
<div style={{ flex: 1, overflow: “hidden” }}>
<div style={{
color: “white”, fontWeight: 700, fontSize: 13,
whiteSpace: “nowrap”, overflow: “hidden”, textOverflow: “ellipsis”,
}}>
{beat.title}
</div>
<div style={{ color: “#888”, fontSize: 11, marginTop: 2 }}>{beat.channel}</div>
</div>
</div>
<iframe
key={beat.videoId}
src={embedUrl(beat.videoId)}
width=“100%” height=“220”
style={{ display: “block”, border: “none”, background: “#000”, flexShrink: 0 }}
allow=“accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share”
allowFullScreen
title={beat.title}
/>
<div style={{ padding: “16px”, borderBottom: “1px solid #1a1a1a”, background: “#0a0a0a” }}>
<div style={{ color: “white”, fontWeight: 700, fontSize: 14, marginBottom: 4, lineHeight: 1.4 }}>
{beat.title}
</div>
<div style={{ color: “#888”, fontSize: 13 }}>{beat.channel}</div>
</div>
<div style={{ padding: “16px”, background: “#0a0a0a”, flex: 1 }}>
<div style={{ color: “#555”, fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
If the video does not play in-app, tap below to open in YouTube.
</div>
<a
href={watchUrl(beat.videoId)}
target=”_blank”
rel=“noopener noreferrer”
style={{
display: “flex”, alignItems: “center”, justifyContent: “center”, gap: 10,
background: “#FF0000”, borderRadius: 14, color: “white”,
fontWeight: 800, fontSize: 16, padding: “15px”, textDecoration: “none”,
}}
>
▶ Open in YouTube
</a>
</div>
</div>
);
}

// =============================================================================
// BEAT CARD
// =============================================================================
function BeatCard({ beat, savedIds, onSave, onPlay, featured, exclusive }) {
const [imgErr, setImgErr] = useState(false);
const accent  = exclusive ? “#F59E0B” : featured ? “#C026D3” : “#9333EA”;
const isSaved = savedIds.has(beat.videoId);

return (
<div style={{
background: “#111”, borderRadius: 14, overflow: “hidden”, marginBottom: 16,
border: `1px solid ${exclusive ? "#F59E0B33" : featured ? "#C026D333" : "rgba(255,255,255,0.07)"}`,
}}>
<div
style={{
position: “relative”, height: 200,
background: `linear-gradient(135deg,#1a1a2e,${accent}44)`, cursor: “pointer”,
}}
onClick={() => onPlay(beat)}
>
{beat.thumbnail && !imgErr && (
<img
src={beat.thumbnail} alt={beat.title}
onError={() => setImgErr(true)}
style={{ width: “100%”, height: “100%”, objectFit: “cover”, display: “block” }}
/>
)}
<div style={{
position: “absolute”, inset: 0,
background: “linear-gradient(to top,rgba(0,0,0,0.65) 0%,rgba(0,0,0,0.05) 60%,transparent 100%)”,
}} />
<div style={{ position: “absolute”, inset: 0, display: “flex”, alignItems: “center”, justifyContent: “center” }}>
<div style={{
width: 60, height: 60, borderRadius: “50%”, background: accent,
display: “flex”, alignItems: “center”, justifyContent: “center”,
boxShadow: `0 4px 24px ${accent}99`, border: “3px solid rgba(255,255,255,0.3)”,
}}>
<span style={{ fontSize: 22, marginLeft: 5, color: “white” }}>▶</span>
</div>
</div>
{featured && (
<div style={{ position: “absolute”, top: 10, left: 12, background: “#C026D3”, borderRadius: 8, padding: “3px 10px”, fontSize: 11, color: “white”, fontWeight: 800 }}>
⭐ FEATURED
</div>
)}
{exclusive && (
<div style={{ position: “absolute”, top: 10, left: 12, background: “#F59E0B”, borderRadius: 8, padding: “3px 10px”, fontSize: 11, color: “black”, fontWeight: 800 }}>
🔒 EXCLUSIVE
</div>
)}
<div
onClick={e => { e.stopPropagation(); onSave(beat); }}
style={{ position: “absolute”, top: 10, right: 12, fontSize: 22, color: isSaved ? “#C026D3” : “rgba(255,255,255,0.55)”, cursor: “pointer” }}
>
🔖
</div>
</div>
<div style={{ padding: “12px 14px” }}>
<div style={{ color: “white”, fontWeight: 700, fontSize: 13, lineHeight: 1.4, marginBottom: 4 }}>
{beat.title}
</div>
<div style={{ color: “#888”, fontSize: 12, marginBottom: 6 }}>{beat.channel}</div>
<a
href={watchUrl(beat.videoId)}
target=”_blank” rel=“noopener noreferrer”
onClick={e => e.stopPropagation()}
style={{ color: “#FF0000”, fontSize: 11, fontWeight: 700, textDecoration: “none” }}
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
function BeatFeed({ artistName, featured, exclusive, savedIds, onSave, onPlay }) {
const [beats,   setBeats]   = useState([]);
const [loading, setLoading] = useState(true);
const [error,   setError]   = useState(null);

useEffect(() => {
let alive = true;
setLoading(true);
setError(null);
setBeats([]);

```
fetchBeats(artistName).then(({ beats: b, error: e }) => {
  if (!alive) return;
  setBeats(b);
  setError(e);
  setLoading(false);
});

return () => { alive = false; };
```

}, [artistName]);

if (loading) return (
<div style={{ textAlign: “center”, padding: “60px 0”, color: “#555” }}>
<div style={{ fontSize: 36, marginBottom: 10 }}>🎵</div>
<div style={{ fontSize: 13 }}>Finding {artistName} type beats…</div>
</div>
);

if (error && !beats.length) return (
<div style={{ padding: “20px 0” }}>
<div style={{
background: “rgba(220,38,38,0.08)”, border: “1px solid rgba(220,38,38,0.25)”,
borderRadius: 14, padding: 20, textAlign: “center”,
}}>
<div style={{ color: “#F87171”, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
Could not load beats
</div>
<div style={{ color: “#888”, fontSize: 13, lineHeight: 1.6 }}>{error}</div>
</div>
</div>
);

return (
<>
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
<div style={{ textAlign: “center”, padding: “60px 0”, color: “#555”, fontSize: 14 }}>
No beats found.
</div>
)}
</>
);
}

// =============================================================================
// HOME SCREEN
// =============================================================================
function HomeScreen({ savedIds, onSave, onPlay }) {
return (
<div style={{ padding: “0 16px 100px” }}>
<div style={{ textAlign: “center”, padding: “44px 0 30px” }}>
<div style={{
fontFamily: “‘Bebas Neue’,sans-serif”, fontSize: 52, letterSpacing: 5, lineHeight: 1,
background: “linear-gradient(135deg,#C026D3,#9333EA,#06B6D4)”,
WebkitBackgroundClip: “text”, WebkitTextFillColor: “transparent”,
}}>
BEATFINDER
</div>
<div style={{
height: 3, background: “linear-gradient(90deg,#C026D3,#9333EA,#06B6D4)”,
borderRadius: 2, margin: “6px auto 0”, maxWidth: 200,
}} />
<div style={{ color: “#aaa”, fontSize: 14, fontWeight: 600, marginTop: 14, lineHeight: 1.6 }}>
Welcome to the World’s <span style={{ color: “#C026D3”, fontWeight: 800 }}>#1</span> Beat Finder App
</div>
</div>
<div style={{ display: “flex”, alignItems: “center”, justifyContent: “space-between”, marginBottom: 8 }}>
<div style={{ color: “white”, fontWeight: 800, fontSize: 18 }}>⭐ Featured Beats</div>
<div style={{ color: “#888”, fontSize: 12 }}>Live from YouTube</div>
</div>
<div style={{ background: “#111”, borderRadius: 12, padding: “10px 14px”, marginBottom: 20, border: “1px solid #1e1e1e” }}>
<div style={{ color: “#666”, fontSize: 12, lineHeight: 1.6 }}>
🎵 Real YouTube results — tap any artist to find their type beats instantly.
</div>
</div>
<BeatFeed artistName="best free" featured savedIds={savedIds} onSave={onSave} onPlay={onPlay} />
</div>
);
}

// =============================================================================
// ARTISTS SCREEN
// =============================================================================
function ArtistsScreen({ onArtistSelect }) {
const [region, setRegion] = useState(“USA”);
const [cat,    setCat]    = useState(“All”);
const [search, setSearch] = useState(””);

const artists = region === “USA” ? ARTISTS_USA : ARTISTS_UK;
const cats    = region === “USA” ? USA_CATS    : UK_CATS;
const list    = artists.filter(a =>
(cat === “All” || a.cat === cat) &&
a.name.toLowerCase().includes(search.toLowerCase())
);

return (
<div style={{ padding: “0 16px 100px” }}>
<div style={{ display: “flex”, alignItems: “center”, justifyContent: “space-between”, padding: “20px 0 14px” }}>
<div>
<div style={{ color: “white”, fontFamily: “‘Bebas Neue’,sans-serif”, fontSize: 32, letterSpacing: 2 }}>BEATFINDER</div>
<div style={{ color: “#888”, fontSize: 13 }}>Type beats, organized.</div>
</div>
<div style={{ border: “1.5px solid #06B6D4”, borderRadius: 24, padding: “7px 14px”, fontSize: 13, fontWeight: 700, color: “#06B6D4” }}>
✦ AI Picks
</div>
</div>
<div style={{ background: “#1a1a1a”, borderRadius: 12, padding: “10px 14px”, display: “flex”, alignItems: “center”, gap: 10, marginBottom: 12, border: “1px solid #222” }}>
<span style={{ color: “#555” }}>🔍</span>
<input value={search} onChange={e => setSearch(e.target.value)} placeholder=“Search artists”
style={{ background: “none”, border: “none”, outline: “none”, color: “white”, fontSize: 15, flex: 1 }} />
</div>
<div style={{ display: “flex”, gap: 10, marginBottom: 12 }}>
{[“USA”,“UK”].map(r => (
<button key={r} onClick={() => { setRegion(r); setCat(“All”); }}
style={{
borderRadius: 24, padding: “8px 20px”, fontWeight: 700, fontSize: 14, cursor: “pointer”,
border: region === r ? “2px solid #C026D3” : “1.5px solid #333”,
background: “transparent”, color: region === r ? “white” : “#888”,
}}>
{r === “USA” ? “🇺🇸” : “🇬🇧”} {r}
</button>
))}
</div>
<div style={{ display: “flex”, gap: 8, marginBottom: 18, flexWrap: “wrap” }}>
{cats.map(c => (
<button key={c} onClick={() => setCat(c)}
style={{
borderRadius: 20, padding: “5px 13px”, fontSize: 12, fontWeight: 700, cursor: “pointer”,
border: cat === c ? “1.5px solid #C026D3” : “1px solid #333”,
background: cat === c ? “rgba(192,38,211,0.15)” : “transparent”,
color: cat === c ? “#C026D3” : “#666”,
}}>
{c}
</button>
))}
</div>
<div style={{ color: “#555”, fontSize: 12, marginBottom: 14 }}>{list.length} artists</div>
<div style={{ display: “grid”, gridTemplateColumns: “1fr 1fr 1fr”, gap: “20px 10px” }}>
{list.map((a, i) => (
<div key={a.id} onClick={() => onArtistSelect(a)}
style={{ display: “flex”, flexDirection: “column”, alignItems: “center”, cursor: “pointer” }}>
<Av name={a.name} size={88} idx={i} img={a.img} />
<div style={{ color: “white”, fontSize: 11, fontWeight: 600, marginTop: 8, textAlign: “center”, lineHeight: 1.3 }}>
{a.name}
</div>
<div style={{
fontSize: 10, marginTop: 2,
color: a.cat === “Detroit”                       ? “#F59E0B”
: a.cat === “R&B M” || a.cat === “R&B F”  ? “#EC4899”
: a.cat === “Grime”                        ? “#06B6D4” : “#666”,
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
const allA = […ARTISTS_USA, …ARTISTS_UK];
const idx  = allA.findIndex(a => a.id === artist.id);
const searchName = artist.searchOverride || artist.name;
const cc = artist.cat === “Detroit”                          ? “#F59E0B”
: artist.cat === “R&B M” || artist.cat === “R&B F” ? “#EC4899”
: artist.cat === “Grime”                            ? “#06B6D4” : “#888”;

return (
<div style={{ padding: “0 0 100px” }}>
<div style={{ padding: “16px 16px 0” }}>
<button onClick={onBack} style={{ background: “none”, border: “none”, color: “white”, fontSize: 28, cursor: “pointer” }}>
‹
</button>
</div>
<div style={{
margin: “8px 16px 16px”, background: “#111”, borderRadius: 16, padding: “16px”,
display: “flex”, alignItems: “center”, gap: 16, border: “1px solid rgba(255,255,255,0.07)”,
}}>
<Av name={artist.name} size={72} idx={idx >= 0 ? idx : 0} img={artist.img} />
<div>
<div style={{ color: “#aaa”, fontSize: 12, marginBottom: 4 }}>
{artist.flag} {artist.flag === “🇺🇸” ? “USA” : “UK”} · <span style={{ color: cc }}>{artist.cat}</span>
</div>
<div style={{ color: “white”, fontSize: 21, fontWeight: 800, fontFamily: “‘Bebas Neue’,sans-serif”, letterSpacing: 1 }}>
{artist.name}
</div>
<div style={{ color: “#C026D3”, fontSize: 13, fontWeight: 600, marginTop: 2 }}>
Searching: “{searchName} type beat”
</div>
</div>
</div>
<div style={{ padding: “0 16px” }}>
<BeatFeed artistName={searchName} savedIds={savedIds} onSave={onSave} onPlay={onPlay} />
</div>
</div>
);
}

// =============================================================================
// TRENDING SCREEN
// =============================================================================
function TrendingScreen({ savedIds, onSave, onPlay }) {
return (
<div style={{ padding: “0 16px 100px” }}>
<div style={{ padding: “20px 0 0” }}>
<div style={{ background: “linear-gradient(135deg,#1a1a2e,#6B21A8)”, borderRadius: 16, padding: “24px 20px”, marginBottom: 20 }}>
<div style={{ color: “#F59E0B”, fontSize: 13, fontWeight: 800, marginBottom: 6 }}>🔥 TRENDING NOW</div>
<div style={{ color: “white”, fontSize: 26, fontWeight: 800, fontFamily: “‘Bebas Neue’,sans-serif”, letterSpacing: 1 }}>
Hottest type beats
</div>
<div style={{ color: “#aaa”, fontSize: 13, marginTop: 4 }}>Live from YouTube</div>
</div>
</div>
<BeatFeed artistName="trending" savedIds={savedIds} onSave={onSave} onPlay={onPlay} />
</div>
);
}

// =============================================================================
// SEARCH SCREEN
// =============================================================================
function SearchScreen({ savedIds, onSave, onPlay }) {
const [input,  setInput]  = useState(””);
const [active, setActive] = useState(null);

const doSearch = () => { if (input.trim()) setActive(input.trim()); };

return (
<div style={{ padding: “0 16px 100px” }}>
<div style={{ padding: “20px 0 10px” }}>
<div style={{ color: “white”, fontSize: 28, fontWeight: 800, fontFamily: “‘Bebas Neue’,sans-serif”, letterSpacing: 1 }}>
Discover Beats
</div>
<div style={{ color: “#888”, fontSize: 14, marginBottom: 14 }}>Search any artist or vibe</div>
<div style={{ display: “flex”, gap: 10, marginBottom: 20 }}>
<div style={{ flex: 1, background: “#1a1a1a”, borderRadius: 12, padding: “10px 14px”, display: “flex”, alignItems: “center”, gap: 10, border: “1px solid #333” }}>
<span style={{ color: “#555” }}>🔍</span>
<input
value={input} onChange={e => setInput(e.target.value)}
onKeyDown={e => e.key === “Enter” && doSearch()}
placeholder=“e.g. Drake, Central Cee, UK drill…”
style={{ background: “none”, border: “none”, outline: “none”, color: “white”, fontSize: 15, flex: 1 }}
/>
</div>
<button onClick={doSearch}
style={{ background: “#C026D3”, border: “none”, borderRadius: 12, color: “white”, fontWeight: 800, padding: “10px 18px”, fontSize: 14, cursor: “pointer” }}>
Go
</button>
</div>
</div>
{!active ? (
<div style={{ textAlign: “center”, paddingTop: 80, color: “#555” }}>
<div style={{ fontSize: 56, marginBottom: 16 }}>🎵</div>
<div style={{ fontSize: 14, lineHeight: 1.6 }}>
Type an artist name and tap Go.<br />
We’ll find their type beats on YouTube.
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
<div style={{ display: “flex”, flexDirection: “column”, alignItems: “center”, justifyContent: “center”, minHeight: “60vh”, padding: 24, textAlign: “center” }}>
<div style={{ fontSize: 64, marginBottom: 20, opacity: 0.3 }}>🔖</div>
<div style={{ color: “white”, fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Save your favourite beats</div>
<div style={{ color: “#888”, fontSize: 15, marginBottom: 24 }}>Log in to sync saves across devices.</div>
{list.length > 0 && (
<div style={{ width: “100%”, marginBottom: 24 }}>
<div style={{ color: “#888”, fontSize: 13, marginBottom: 12 }}>
{list.length} beat{list.length !== 1 ? “s” : “”} saved locally
</div>
{list.map(beat => (
<BeatCard key={beat.videoId} beat={beat} savedIds={savedIds} onSave={onSave} onPlay={onPlay} />
))}
</div>
)}
<button onClick={onGoProfile}
style={{ background: “#C026D3”, border: “none”, borderRadius: 32, color: “white”, fontWeight: 800, padding: “16px 48px”, fontSize: 16, cursor: “pointer”, width: “100%”, maxWidth: 300 }}>
Log In / Sign Up
</button>
</div>
);
return (
<div style={{ padding: “0 16px 100px” }}>
<div style={{ padding: “20px 0 16px” }}>
<div style={{ color: “white”, fontSize: 28, fontWeight: 800, fontFamily: “‘Bebas Neue’,sans-serif”, letterSpacing: 1 }}>
Saved Beats
</div>
</div>
{list.length === 0 ? (
<div style={{ textAlign: “center”, paddingTop: 60, color: “#555” }}>
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
if (!isPro) return (
<div style={{ display: “flex”, flexDirection: “column”, alignItems: “center”, justifyContent: “center”, minHeight: “75vh”, padding: 28, textAlign: “center” }}>
<div style={{ fontSize: 72, marginBottom: 16 }}>🔒</div>
<div style={{ fontFamily: “‘Bebas Neue’,sans-serif”, fontSize: 32, letterSpacing: 2, color: “#F59E0B”, marginBottom: 8 }}>MEMBERS ONLY</div>
<div style={{ color: “white”, fontSize: 20, fontWeight: 800, marginBottom: 12 }}>Exclusive Beats</div>
<div style={{ color: “#888”, fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
Subscribe to <span style={{ color: “#F59E0B”, fontWeight: 800 }}>Artist Pro</span> or <span style={{ color: “#C026D3”, fontWeight: 800 }}>Producer Pro</span> to unlock.
</div>
{[
{ label: “🎤 Artist Pro”,   price: “4.99/mo”,  color: “#F59E0B”, desc: “Access exclusive beats” },
{ label: “🎛 Producer Pro”, price: “8.99/mo”,  color: “#C026D3”, desc: “Upload beats + exclusive access” },
].map(p => (
<div key={p.label} style={{ background: “#111”, border: `1.5px solid ${p.color}`, borderRadius: 14, padding: “14px 18px”, marginBottom: 12, textAlign: “left”, width: “100%”, maxWidth: 320 }}>
<div style={{ display: “flex”, justifyContent: “space-between” }}>
<div style={{ color: “white”, fontWeight: 800, fontSize: 16 }}>{p.label}</div>
<div style={{ color: p.color, fontWeight: 800 }}>£{p.price}</div>
</div>
<div style={{ color: “#888”, fontSize: 12, marginTop: 6 }}>{p.desc}</div>
</div>
))}
<button onClick={onGoProfile}
style={{ background: “linear-gradient(135deg,#F59E0B,#C026D3)”, border: “none”, borderRadius: 32, color: “white”, fontWeight: 800, padding: “16px 40px”, fontSize: 16, cursor: “pointer”, width: “100%”, maxWidth: 320, marginTop: 8 }}>
Unlock Access
</button>
</div>
);
return (
<div style={{ padding: “0 16px 100px” }}>
<div style={{ padding: “20px 0 6px” }}>
<div style={{ background: “linear-gradient(135deg,#1C1917,rgba(245,158,11,0.12))”, borderRadius: 16, padding: “20px”, marginBottom: 18, border: “1.5px solid rgba(245,158,11,0.3)” }}>
<div style={{ color: “#F59E0B”, fontWeight: 800, fontSize: 13, marginBottom: 4 }}>🔒 MEMBERS ONLY</div>
<div style={{ color: “white”, fontSize: 24, fontWeight: 800, fontFamily: “‘Bebas Neue’,sans-serif”, letterSpacing: 1 }}>Exclusive Beats</div>
<div style={{ color: “#aaa”, fontSize: 13, marginTop: 4 }}>Premium beats — Pro members only.</div>
</div>
</div>
<BeatFeed artistName="exclusive premium" exclusive savedIds={savedIds} onSave={onSave} onPlay={onPlay} />
</div>
);
}

// =============================================================================
// PROFILE SCREEN
// =============================================================================
function ProfileScreen({ user, setUser }) {
const [mode,        setMode]        = useState(“landing”);
const [email,       setEmail]       = useState(””);
const [pw,          setPw]          = useState(””);
const [name,        setName]        = useState(””);
const [ytLink,      setYtLink]      = useState(””);
const [uploads,     setUploads]     = useState([]);
const [plan,        setPlan]        = useState(null);
const [authErr,     setAuthErr]     = useState(””);
const [authLoading, setAuthLoading] = useState(false);

const inp = {
width: “100%”, background: “#1a1a1a”, border: “1px solid #333”,
borderRadius: 12, padding: “14px 16px”, color: “white”, fontSize: 15,
outline: “none”, marginBottom: 12, boxSizing: “border-box”,
};

const PLANS = [
{
id: “artist”, label: “🎤 Artist Pro”, price: “4.99”,
pp: “https://www.paypal.com/paypalme/trellitheproducer/4.99GBP”,
perks: [“Access Exclusive Members area”,“Bookmark unlimited beats”,“Artist verified badge”,“AI beat recommendations”],
},
{
id: “producer”, label: “🎛 Producer Pro”, price: “8.99”,
pp: “https://www.paypal.com/paypalme/trellitheproducer/8.99GBP”,
perks: [“Everything in Artist Pro”,“Upload beats to Home featured”,“Featured in rotation”,“Producer verified badge”,“Analytics”],
},
];

if (user) return (
<div style={{ padding: “0 16px 100px” }}>
<div style={{ padding: “20px 0 16px”, display: “flex”, alignItems: “center”, justifyContent: “space-between” }}>
<div style={{ color: “white”, fontSize: 28, fontWeight: 800, fontFamily: “‘Bebas Neue’,sans-serif”, letterSpacing: 1 }}>My Profile</div>
<button onClick={() => { AuthAPI.logout(); setUser(null); setMode(“landing”); }}
style={{ background: “#1a1a1a”, border: “1px solid #333”, color: “#aaa”, borderRadius: 10, padding: “6px 14px”, cursor: “pointer”, fontSize: 13 }}>
Log out
</button>
</div>
<div style={{ background: “#111”, borderRadius: 16, padding: 20, marginBottom: 20, border: “1px solid rgba(255,255,255,0.07)”, textAlign: “center” }}>
<div style={{ width: 80, height: 80, borderRadius: “50%”, background: “linear-gradient(135deg,#7C2D12,#C026D3)”, display: “flex”, alignItems: “center”, justifyContent: “center”, fontSize: 32, color: “white”, fontWeight: 800, margin: “0 auto 12px” }}>
{user.name[0]?.toUpperCase()}
</div>
<div style={{ color: “white”, fontSize: 20, fontWeight: 800 }}>{user.name}</div>
<div style={{ color: “#888”, fontSize: 13 }}>{user.email}</div>
{user.isPro && <div style={{ marginTop: 8, display: “inline-block”, background: “rgba(192,38,211,0.2)”, border: “1px solid #C026D3”, borderRadius: 20, padding: “4px 14px”, color: “#C026D3”, fontWeight: 800, fontSize: 13 }}>⭐ Producer Pro</div>}
{user.isArtistPro && !user.isPro && <div style={{ marginTop: 8, display: “inline-block”, background: “rgba(245,158,11,0.2)”, border: “1px solid #F59E0B”, borderRadius: 20, padding: “4px 14px”, color: “#F59E0B”, fontWeight: 800, fontSize: 13 }}>🎤 Artist Pro</div>}
</div>
{user.isPro && (
<div>
<div style={{ color: “white”, fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Upload Your Beats</div>
<div style={{ color: “#666”, fontSize: 13, marginBottom: 14 }}>Paste a YouTube link to feature it on the Home page.</div>
<div style={{ background: “#111”, borderRadius: 14, padding: 16, border: “1px solid #222” }}>
<input value={ytLink} onChange={e => setYtLink(e.target.value)} placeholder=“https://youtube.com/watch?v=…” style={inp} />
<button onClick={() => { if (ytLink.trim()) { setUploads(p => […p, { id: Date.now(), url: ytLink, date: new Date().toLocaleDateString() }]); setYtLink(””); }}}
style={{ width: “100%”, background: “#C026D3”, border: “none”, borderRadius: 10, color: “white”, fontWeight: 800, padding: 13, fontSize: 15, cursor: “pointer” }}>
⬆️ Upload Beat
</button>
</div>
{uploads.length > 0 && (
<div style={{ marginTop: 14 }}>
{uploads.map((b, i) => (
<div key={b.id} style={{ background: “#111”, borderRadius: 12, padding: “12px 14px”, marginBottom: 10, border: “1px solid #222” }}>
<div style={{ color: “#C026D3”, fontWeight: 700, fontSize: 13 }}>Beat #{i + 1}</div>
<div style={{ color: “#aaa”, fontSize: 12, wordBreak: “break-all”, marginTop: 4 }}>{b.url}</div>
</div>
))}
</div>
)}
</div>
)}
{!user.isPro && (
<div>
<div style={{ color: “white”, fontWeight: 800, fontSize: 18, marginBottom: 16 }}>
{user.isArtistPro ? “Upgrade to Producer Pro” : “Choose Your Plan”}
</div>
{PLANS.filter(p => !user.isArtistPro || p.id === “producer”).map(pl => (
<div key={pl.id}>
<div onClick={() => setPlan(pl.id)}
style={{ background: plan === pl.id ? “rgba(192,38,211,0.12)” : “#111”, border: `1.5px solid ${plan === pl.id ? "#C026D3" : "#222"}`, borderRadius: 16, padding: 18, marginBottom: 12, cursor: “pointer” }}>
<div style={{ display: “flex”, justifyContent: “space-between”, marginBottom: 10 }}>
<div style={{ color: “white”, fontWeight: 800, fontSize: 17 }}>{pl.label}</div>
<div style={{ color: “#C026D3”, fontWeight: 800, fontSize: 17 }}>£{pl.price}/mo</div>
</div>
{pl.perks.map(p => (
<div key={p} style={{ color: “#ccc”, fontSize: 13, marginBottom: 6, display: “flex”, gap: 8 }}>
<span style={{ color: “#C026D3” }}>✓</span>{p}
</div>
))}
</div>
{plan === pl.id && (
<div style={{ background: “#111”, borderRadius: 14, padding: 16, border: “1px solid #222”, marginBottom: 16 }}>
<div style={{ color: “#888”, fontSize: 13, marginBottom: 12, textAlign: “center”, lineHeight: 1.6 }}>Pay via PayPal, then tap Activate.</div>
<a href={pl.pp} target=”_blank” rel=“noopener noreferrer”
style={{ display: “block”, background: “#0070BA”, borderRadius: 12, color: “white”, fontWeight: 800, padding: 14, fontSize: 16, textAlign: “center”, textDecoration: “none”, marginBottom: 10 }}>
💳 Pay £{pl.price}/mo via PayPal
</a>
<button onClick={() => setUser({ …user, isPro: pl.id === “producer”, isArtistPro: true })}
style={{ width: “100%”, background: “#1a1a1a”, border: “1.5px solid #333”, borderRadius: 12, color: “#aaa”, fontWeight: 700, padding: 12, fontSize: 14, cursor: “pointer” }}>
✅ I’ve Paid — Activate {pl.id === “producer” ? “Producer” : “Artist”} Pro
</button>
</div>
)}
</div>
))}
<div style={{ color: “#444”, fontSize: 11, textAlign: “center”, lineHeight: 1.7, marginTop: 8 }}>
Payments go to trellitheproducer@gmail.com via PayPal.<br />Renews monthly. Cancel anytime.
</div>
</div>
)}
</div>
);

if (mode === “landing”) return (
<div style={{ display: “flex”, flexDirection: “column”, alignItems: “center”, justifyContent: “center”, height: “75vh”, padding: 32, textAlign: “center” }}>
<div style={{ width: 80, height: 80, borderRadius: “50%”, border: “2.5px solid #C026D3”, display: “flex”, alignItems: “center”, justifyContent: “center”, marginBottom: 20 }}>
<span style={{ fontSize: 38 }}>👤</span>
</div>
<div style={{ color: “white”, fontFamily: “‘Bebas Neue’,sans-serif”, fontSize: 34, letterSpacing: 3, marginBottom: 12 }}>BEATFINDER</div>
<div style={{ color: “#888”, fontSize: 14, lineHeight: 1.7, marginBottom: 36 }}>
Create a free account to save beats,<br />or subscribe as an artist or producer.
</div>
<button onClick={() => setMode(“signup”)}
style={{ width: “100%”, background: “#C026D3”, border: “none”, borderRadius: 32, color: “white”, fontWeight: 800, padding: 16, fontSize: 16, cursor: “pointer”, marginBottom: 16 }}>
Create account
</button>
<button onClick={() => setMode(“login”)}
style={{ background: “none”, border: “none”, color: “#06B6D4”, fontWeight: 700, fontSize: 15, cursor: “pointer” }}>
I already have an account
</button>
</div>
);

return (
<div style={{ padding: “40px 24px 100px” }}>
<button onClick={() => setMode(“landing”)} style={{ background: “none”, border: “none”, color: “white”, fontSize: 28, cursor: “pointer”, marginBottom: 20 }}>‹</button>
<div style={{ color: “white”, fontFamily: “‘Bebas Neue’,sans-serif”, fontSize: 30, letterSpacing: 2, marginBottom: 24 }}>
{mode === “signup” ? “CREATE ACCOUNT” : “WELCOME BACK”}
</div>
{mode === “signup” && <input value={name} onChange={e => setName(e.target.value)} placeholder=“Your name” style={inp} />}
<input value={email} onChange={e => setEmail(e.target.value)} placeholder=“Email address” style={inp} />
<input value={pw} onChange={e => setPw(e.target.value)} placeholder=“Password” type=“password” style={{ …inp, marginBottom: 24 }} />
<button onClick={async () => {
if (!email || !pw) return;
setAuthErr(””);
setAuthLoading(true);
try {
const u = mode === “signup”
? await AuthAPI.register(name || email.split(”@”)[0], email, pw)
: await AuthAPI.login(email, pw);
setUser(u);
} catch (e) {
setAuthErr(e.message);
} finally {
setAuthLoading(false);
}
}}
disabled={authLoading}
style={{ width: “100%”, background: “#C026D3”, border: “none”, borderRadius: 32, color: “white”, fontWeight: 800, padding: 16, fontSize: 16, cursor: “pointer”, opacity: authLoading ? 0.6 : 1 }}>
{authLoading ? “Please wait…” : mode === “signup” ? “Create Account” : “Log In”}
</button>
{authErr && <div style={{ color: “#F87171”, fontSize: 13, textAlign: “center”, marginTop: 12 }}>{authErr}</div>}
<div style={{ textAlign: “center”, marginTop: 20 }}>
<span style={{ color: “#888”, fontSize: 14 }}>{mode === “signup” ? “Already have an account? “ : “No account? “}</span>
<button onClick={() => setMode(mode === “signup” ? “login” : “signup”)}
style={{ background: “none”, border: “none”, color: “#06B6D4”, fontWeight: 700, fontSize: 14, cursor: “pointer” }}>
{mode === “signup” ? “Log In” : “Sign Up”}
</button>
</div>
</div>
);
}

// =============================================================================
// BOTTOM NAV
// =============================================================================
const NAV = [
{ id: “home”,      label: “Home”,    icon: “🏠” },
{ id: “artists”,   label: “Artists”, icon: “▦”  },
{ id: “trending”,  label: “Trending”,icon: “🔥” },
{ id: “search”,    label: “Search”,  icon: “🔍” },
{ id: “saved”,     label: “Saved”,   icon: “🔖” },
{ id: “exclusive”, label: “Members”, icon: “🔒” },
{ id: “profile”,   label: “Profile”, icon: “👤” },
];

// =============================================================================
// ROOT APP
// =============================================================================
export default function BeatFinder() {
const [tab,     setTab]     = useState(“home”);
const [artist,  setArtist]  = useState(null);
const [user,    setUser]    = useState(null);
const [playing, setPlaying] = useState(null);

// savedMap: { [videoId]: beat } — localStorage for guests, backend for logged-in users
const [savedMap, setSavedMap] = useState(loadSaved);
const savedIds = new Set(Object.keys(savedMap));

// Restore session from stored JWT on app load
useEffect(() => {
const token = getToken();
if (!token) return;
AuthAPI.me()
.then(u => setUser(u))
.catch(() => clearToken()); // token expired or invalid
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
.catch(e => console.warn(”[BeatFinder] Could not fetch saved beats:”, e));
}, [user]);

const toggleSave = useCallback(beat => {
setSavedMap(prev => {
const next = { …prev };
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
const goTab = id => { setTab(id); if (id !== “artists”) setArtist(null); };

return (
<div style={{ maxWidth: 430, margin: “0 auto”, minHeight: “100vh”, background: “#0a0a0a”, fontFamily: “‘DM Sans’,sans-serif” }}>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />

```
  {playing && <Player beat={playing} onClose={() => setPlaying(null)} />}

  <div style={{ overflowY: "auto", height: "calc(100vh - 72px)" }}>
    {tab === "home"      && <HomeScreen     savedIds={savedIds} onSave={toggleSave} onPlay={handlePlay} />}
    {tab === "artists"   && !artist && <ArtistsScreen onArtistSelect={setArtist} />}
    {tab === "artists"   &&  artist && (
      <ArtistDetailScreen artist={artist} onBack={() => setArtist(null)} onPlay={handlePlay} savedIds={savedIds} onSave={toggleSave} />
    )}
    {tab === "trending"  && <TrendingScreen  savedIds={savedIds} onSave={toggleSave} onPlay={handlePlay} />}
    {tab === "search"    && <SearchScreen    savedIds={savedIds} onSave={toggleSave} onPlay={handlePlay} />}
    {tab === "saved"     && (
      <SavedScreen savedMap={savedMap} savedIds={savedIds} onSave={toggleSave} user={user} onGoProfile={() => goTab("profile")} onPlay={handlePlay} />
    )}
    {tab === "exclusive" && (
      <ExclusiveScreen user={user} onGoProfile={() => goTab("profile")} onPlay={handlePlay} savedIds={savedIds} onSave={toggleSave} />
    )}
    {tab === "profile"   && <ProfileScreen user={user} setUser={setUser} />}
  </div>

  <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(10,10,10,0.97)", borderTop: "1px solid #1a1a1a", display: "flex", height: 72, zIndex: 100, backdropFilter: "blur(20px)" }}>
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
```

);
}
