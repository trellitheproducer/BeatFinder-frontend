import { useState, useEffect, useCallback } from "react";

// =============================================================================
// CONFIG
// =============================================================================

// ── Backend URL ──────────────────────────────────────────────────────────────
// When developing locally:   http://localhost:8000
// When deployed on Render:   https://your-app.onrender.com
// Set this to your Render/Railway URL after deployment.
const API_BASE = "https://beatfinder-backend.onrender.com";

// ── In-memory cache (10 minutes TTL) ─────────────────────────────────────────
const cache = {};
const CACHE_TTL = 10 * 60 * 1000;

// =============================================================================
// API HELPERS
// =============================================================================

function getToken() {
  try { return localStorage.getItem("bf_token") || null; }
  catch { return null; }
}

function saveToken(token) {
  try { localStorage.setItem("bf_token", token); } catch {}
}

function clearToken() {
  try { localStorage.removeItem("bf_token"); } catch {}
}

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
// YOUTUBE FETCH
// =============================================================================

async function fetchBeats(artistName, page, filterTitle, maxResults) {
  const pageNum  = page || 1;
  const maxNum   = maxResults || 20;
  const doFilter = filterTitle !== false;

  const query = artistName + "|page" + pageNum + "|filter" + doFilter + "|max" + maxNum;

  if (cache[query] && Date.now() - cache[query].ts < CACHE_TTL) {
    return { beats: cache[query].data, error: null };
  }

  try {
    const data = await apiFetch(
      "/api/youtube/search?artist=" + encodeURIComponent(artistName) +
      "&max=" + maxNum + "&page=" + pageNum +
      "&filter_title=" + (doFilter ? "true" : "false")
    );

    const beats = data.beats || [];
    cache[query] = { data: beats, ts: Date.now() };

    return { beats, error: null };
  } catch (err) {
    return { beats: [], error: err.message };
  }
}

// =============================================================================
// AUTH API
// =============================================================================

const AuthAPI = {
  async register(name, email, password) {
    const data = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    saveToken(data.access_token);
    return data.user;
  },

  async login(email, password) {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveToken(data.access_token);
    return data.user;
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
// SAVED BEATS API
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

const watchUrl = id => `https://www.youtube.com/watch?v=${id}`;
const embedUrl = id => `https://www.youtube.com/embed/${id}?autoplay=1`;

// =============================================================================
// ROOT APP
// =============================================================================

export default function BeatFinder() {
  const [tab, setTab] = useState("home");
  const [user, setUser] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [savedMap, setSavedMap] = useState({});

  const savedIds = new Set(Object.keys(savedMap));

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    AuthAPI.me()
      .then(setUser)
      .catch(() => clearToken());
  }, []);

  const toggleSave = useCallback(beat => {
    setSavedMap(prev => {
      const next = { ...prev };
      if (next[beat.videoId]) {
        delete next[beat.videoId];
        if (user) BeatsAPI.remove(beat.videoId);
      } else {
        next[beat.videoId] = beat;
        if (user) BeatsAPI.save(beat);
      }
      return next;
    });
  }, [user]);

  return (
    <div style={{ padding: 20, color: "white" }}>
      <h1>BeatFinder</h1>
      <p>App is running</p>
    </div>
  );
}
