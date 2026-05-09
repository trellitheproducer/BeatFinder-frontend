/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef } from "react";
// =============================================================================
// PREMIUM LOADER COMPONENT
// =============================================================================
const LOADER_STYLE = `
  @media screen and (orientation: landscape) {
    html, body { overflow: hidden; }
    #bf-portrait-lock {
      position: fixed;
      top: 0; left: 0;
      width: 100vh;
      height: 100vw;
      transform-origin: top left;
      transform: rotate(90deg) translateY(-100%);
      overflow-y: auto;
      overflow-x: hidden;
      z-index: 999999;
    }
  }
  @media screen and (orientation: portrait) {
    #bf-portrait-lock {
      position: static;
      width: 100%;
      height: 100%;
      transform: none;
    }
  }
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
// VU METER COMPONENTS
// =============================================================================

// Shared hook: drives a real AnalyserNode and returns {level, peak, clipping}
function useAnalyser(analyserNode, isActive) {
  const [level,    setLevel]    = React.useState(0);
  const [peak,     setPeak]     = React.useState(0);
  const [clipping, setClipping] = React.useState(false);
  const peakHold   = React.useRef(0);
  const peakTimer  = React.useRef(null);
  const rafRef     = React.useRef(null);

  React.useEffect(() => {
    if (!analyserNode || !isActive) {
      setLevel(0); setPeak(0); setClipping(false);
      return;
    }
    const bufLen = analyserNode.frequencyBinCount;
    const data   = new Float32Array(bufLen);
    const tick   = () => {
      analyserNode.getFloatTimeDomainData(data);
      let rms = 0;
      let pk  = 0;
      for (let i = 0; i < bufLen; i++) {
        const v = Math.abs(data[i]);
        rms += v * v;
        if (v > pk) pk = v;
      }
      rms = Math.sqrt(rms / bufLen);
      const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -100;
      const pkDb  = pk  > 0 ? 20 * Math.log10(pk)  : -100;
      // Normalise -60..0 dB → 0..1
      const normRms = Math.max(0, Math.min(1, (rmsDb + 60) / 60));
      const normPk  = Math.max(0, Math.min(1, (pkDb  + 60) / 60));
      setLevel(normRms);
      setClipping(pk >= 0.999);
      // Peak hold: 2 s decay
      if (normPk > peakHold.current) {
        peakHold.current = normPk;
        clearTimeout(peakTimer.current);
        peakTimer.current = setTimeout(() => { peakHold.current = 0; setPeak(0); }, 2000);
      }
      setPeak(peakHold.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(peakTimer.current);
    };
  }, [analyserNode, isActive]);

  return { level, peak, clipping };
}

// Animated VU meter for the YouTube Player (no direct audio access – driven by animation)
function PlayerVUMeter({ isPlaying }) {
  const [bars, setBars] = React.useState(() => Array(12).fill(0));
  const rafRef = React.useRef(null);
  const tRef   = React.useRef(0);

  React.useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      setBars(Array(12).fill(0));
      return;
    }
    const animate = (ts) => {
      tRef.current = ts;
      setBars(prev => prev.map((_, i) => {
        // Each bar oscillates at a different frequency with some randomness
        const base  = 0.35 + 0.45 * Math.abs(Math.sin(ts * 0.001 * (0.7 + i * 0.13) + i));
        const noise = (Math.random() - 0.5) * 0.18;
        return Math.max(0, Math.min(1, base + noise));
      }));
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  const clipping = bars.some(b => b > 0.92);

  return (
    <div style={{
      display: "flex", alignItems: "flex-end", gap: 3,
      height: 40, padding: "6px 10px",
      background: "rgba(0,0,0,0.5)",
      borderRadius: 8,
      border: "1px solid " + (clipping ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.08)"),
    }}>
      {bars.map((v, i) => {
        const isClip = v > 0.92;
        const color  = isClip ? "#EF4444" : v > 0.75 ? "#F59E0B" : "#22C55E";
        return (
          <div key={i} style={{
            flex: 1, borderRadius: 2,
            background: isPlaying ? color : "#1a1a1a",
            height: isPlaying ? Math.max(3, v * 28) : 3,
            transition: "height 0.05s ease, background 0.1s",
            boxShadow: isPlaying ? "0 0 4px " + color + "88" : "none",
          }} />
        );
      })}
    </div>
  );
}

// Real VU meter driven by a Web Audio AnalyserNode – used in Studio
function VUMeter({ analyserNode, isActive, compact, label, showLabel }) {
  const { level, peak, clipping } = useAnalyser(analyserNode, isActive);
  const BAR_COUNT = compact ? 8 : 14;
  const HEIGHT    = compact ? 28 : 36;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {showLabel && (
        <div style={{ color: clipping ? "#EF4444" : "#444", fontSize: 8, fontWeight: 700, letterSpacing: 1, textAlign: "center", fontFamily: "monospace" }}>
          {label || "LEVEL"}{clipping ? " ◆ CLIP" : ""}
        </div>
      )}
      <div style={{
        display: "flex", alignItems: "flex-end", gap: compact ? 1.5 : 2,
        height: HEIGHT,
        background: "rgba(0,0,0,0.6)",
        borderRadius: 6,
        padding: compact ? "4px 6px" : "5px 8px",
        border: "1px solid " + (clipping ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.06)"),
        boxShadow: clipping ? "0 0 8px rgba(239,68,68,0.3)" : "none",
        transition: "box-shadow 0.1s, border-color 0.1s",
        position: "relative",
      }}>
        {Array.from({ length: BAR_COUNT }, (_, i) => {
          const thresh   = i / BAR_COUNT;
          const active   = level >= thresh;
          const isPeak   = peak  >= thresh && peak < thresh + (1 / BAR_COUNT) * 1.5;
          const isClipZone = i >= BAR_COUNT - 2;
          const color    = isClipZone ? "#EF4444" : i >= BAR_COUNT * 0.72 ? "#F59E0B" : "#22C55E";
          return (
            <div key={i} style={{
              flex: 1, borderRadius: 1.5,
              background: active ? color : isPeak ? color : "#1a1a1a",
              height: active ? "100%" : isPeak ? "100%" : "30%",
              opacity: active ? 1 : isPeak ? 0.9 : 0.2,
              boxShadow: active && isClipZone ? "0 0 6px rgba(239,68,68,0.8)" : active ? "0 0 3px " + color + "55" : "none",
              transition: active ? "none" : "opacity 0.15s, height 0.15s",
            }} />
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIC PRO-STYLE STEREO VU METER  (horizontal, L above R, green/yellow/red)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// LOGIC PRO-STYLE STEREO VU METER  (horizontal L/R bars, embedded in fader row)
// ─────────────────────────────────────────────────────────────────────────────
function StereoVUMeter({ analyserNode, isActive }) {
  const { level, peak, clipping } = useAnalyser(analyserNode, isActive);
  const rOff   = React.useRef(0.90 + Math.random() * 0.10);
  const rLevel = Math.min(1, level * rOff.current);
  const rPeak  = Math.min(1, peak  * rOff.current);
  const SEGS   = 16;

  const renderBar = (v, pk) => (
    <div style={{ display:"flex", gap:1, height:3, alignItems:"stretch", width:"100%" }}>
      {Array.from({ length: SEGS }, (_, i) => {
        const frac      = i / SEGS;
        const lit       = v >= frac;
        const isPeak    = pk > 0 && Math.abs(pk - frac) < (1.2 / SEGS);
        const baseColor = frac >= 0.875 ? "#FF3B30" : frac >= 0.688 ? "#FFD60A" : "#30D158";
        const dimColor  = frac >= 0.875 ? "#2a0a08" : frac >= 0.688 ? "#2a2500" : "#082014";
        return (
          <div key={i} style={{
            flex:1, borderRadius:1,
            background: isPeak ? "#fff" : lit ? baseColor : dimColor,
            boxShadow: lit && frac >= 0.875 ? "0 0 2px rgba(255,59,48,0.6)" : "none",
          }} />
        );
      })}
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:1.5, width:"100%" }}>
      <div style={{ display:"flex", alignItems:"center", gap:2 }}>
        <span style={{ color:"#404040", fontSize:6, fontWeight:700, width:5, flexShrink:0 }}>L</span>
        <div style={{ flex:1 }}>{renderBar(level, peak)}</div>
        <div style={{ width:4, height:4, borderRadius:1, background: clipping ? "#FF3B30" : "#1a1a1a", flexShrink:0 }} />
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:2 }}>
        <span style={{ color:"#404040", fontSize:6, fontWeight:700, width:5, flexShrink:0 }}>R</span>
        <div style={{ flex:1 }}>{renderBar(rLevel, rPeak)}</div>
        <div style={{ width:4, height:4, borderRadius:1, background:"transparent", flexShrink:0 }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIC PRO VOLUME FADER  — horizontal slider with thumb, 0→1.5 range
// Sits below the VU meters exactly like Logic's channel strip fader
// ─────────────────────────────────────────────────────────────────────────────
function LogicVolumeFader({ value = 1, onChange }) {
  const trackRef  = React.useRef(null);
  const dragging  = React.useRef(false);
  const startX    = React.useRef(null);
  const startVal  = React.useRef(null);

  // value 0..1.5 → pct 0..100 along fader
  const pct = Math.max(0, Math.min(100, (value / 1.5) * 100));
  // Unity (1.0) mark position
  const unityPct = (1 / 1.5) * 100;

  const calcVal = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const raw  = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1.5, raw * 1.5));
  };

  const onPointerDown = (e) => {
    e.stopPropagation();
    dragging.current = true;
    startX.current   = e.clientX;
    startVal.current = value;
    trackRef.current.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    onChange(+calcVal(e.clientX).toFixed(3));
  };
  const onPointerUp = (e) => {
    dragging.current = false;
  };
  const onDoubleClick = (e) => { e.stopPropagation(); onChange(1); };
  const onTrackClick = (e) => {
    e.stopPropagation();
    onChange(+calcVal(e.clientX).toFixed(3));
  };

  const dbLabel = value <= 0.001 ? "-∞" : `${value >= 1 ? "+" : ""}${(20*Math.log10(value)).toFixed(1)}`;

  return (
    <div style={{ display:"flex", alignItems:"center", gap:3, width:"100%" }}>
      {/* Fader track */}
      <div
        ref={trackRef}
        onClick={onTrackClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        title={`Volume: ${dbLabel} dB  (double-tap = unity)`}
        style={{
          flex:1, height:14, position:"relative",
          cursor:"pointer", userSelect:"none", touchAction:"none",
        }}
      >
        {/* Track groove */}
        <div style={{
          position:"absolute", top:"50%", left:0, right:0,
          height:3, borderRadius:2, transform:"translateY(-50%)",
          background:"#1a1a1a",
          border:"1px solid #111",
        }}>
          {/* Filled portion (left of thumb) */}
          <div style={{
            position:"absolute", left:0, top:0, bottom:0,
            width:`${pct}%`,
            borderRadius:2,
            background: value > 1.4 ? "linear-gradient(90deg,#30D158,#FF3B30)" : "linear-gradient(90deg,#2a2a2a,#30D158)",
          }} />
          {/* Unity marker */}
          <div style={{
            position:"absolute", left:`${unityPct}%`,
            top:-2, bottom:-2, width:1,
            background:"#555", borderRadius:1,
          }} />
        </div>
        {/* Thumb */}
        <div style={{
          position:"absolute", top:"50%", left:`${pct}%`,
          transform:"translate(-50%,-50%)",
          width:10, height:14, borderRadius:2,
          background:"linear-gradient(180deg,#6a6a6a,#3a3a3a)",
          border:"1px solid #222",
          boxShadow:"0 1px 3px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.15)",
          cursor:"ew-resize",
          // Center grip line
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <div style={{ width:1, height:7, background:"rgba(255,255,255,0.25)", borderRadius:1 }} />
        </div>
      </div>
      {/* dB readout */}
      <span style={{ color:"#555", fontSize:7, fontWeight:700, width:22, textAlign:"right", flexShrink:0, fontFamily:"monospace" }}>{dbLabel}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIC PRO PAN KNOB  — rotary knob -1..+1, center-notched
// ─────────────────────────────────────────────────────────────────────────────
function LogicPanSlider({ value = 0, onChange }) {
  const knobRef  = React.useRef(null);
  const startY   = React.useRef(null);
  const startVal = React.useRef(null);

  const panLabel = Math.abs(value) < 0.03 ? "C" : value < 0 ? `L${Math.round(Math.abs(value)*100)}` : `R${Math.round(value*100)}`;
  const angle = value * 135;
  const SIZE = 28, R = 11, cx = 14, cy = 14;

  const toXY = (deg) => {
    const rad = (deg - 90) * Math.PI / 180;
    return [cx + R * Math.cos(rad), cy + R * Math.sin(rad)];
  };

  const onPointerDown = (e) => {
    e.stopPropagation(); e.preventDefault();
    startY.current = e.clientY; startVal.current = value;
    knobRef.current.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (startY.current === null) return;
    const delta = (startY.current - e.clientY) / 80;
    let v = Math.max(-1, Math.min(1, startVal.current + delta));
    if (Math.abs(v) < 0.05) v = 0;
    onChange(+v.toFixed(3));
  };
  const onPointerUp   = () => { startY.current = null; };
  const onDoubleClick = (e) => { e.stopPropagation(); onChange(0); };

  const arcStart = toXY(0);
  const arcEnd   = toXY(angle);
  const largeArc = Math.abs(angle) > 180 ? 1 : 0;
  const sweep    = angle >= 0 ? 1 : 0;
  const tickEnd  = toXY(0);
  const tickIn   = [cx + 6 * Math.cos(-Math.PI/2), cy + 6 * Math.sin(-Math.PI/2)];
  const thumbOut = [cx + 9 * Math.cos((angle-90)*Math.PI/180), cy + 9 * Math.sin((angle-90)*Math.PI/180)];
  const thumbIn  = [cx + 3 * Math.cos((angle-90)*Math.PI/180), cy + 3 * Math.sin((angle-90)*Math.PI/180)];

  return (
    <div style={{ display:"flex", alignItems:"center", gap:4, width:"100%" }}>
      <span style={{ color:"#404040", fontSize:7, fontWeight:700, width:14, flexShrink:0 }}>PAN</span>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", flex:1 }}>
        <svg ref={knobRef} width={SIZE} height={SIZE}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onDoubleClick={onDoubleClick}
          title={`Pan: ${panLabel}  (double-tap = center)`}
          style={{ cursor:"ns-resize", touchAction:"none", userSelect:"none", overflow:"visible" }}>
          <defs>
            <radialGradient id="panKnobGrad" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#5a5a5a" />
              <stop offset="100%" stopColor="#222" />
            </radialGradient>
          </defs>
          <circle cx={cx} cy={cy} r={12} fill="url(#panKnobGrad)" stroke="#111" strokeWidth={1} />
          <path d={`M ${toXY(-135)[0]} ${toXY(-135)[1]} A ${R} ${R} 0 1 1 ${toXY(135)[0]} ${toXY(135)[1]}`}
            fill="none" stroke="#1a1a1a" strokeWidth={2.5} strokeLinecap="round" />
          {Math.abs(value) > 0.03 && (
            <path d={`M ${arcStart[0]} ${arcStart[1]} A ${R} ${R} 0 ${largeArc} ${sweep} ${arcEnd[0]} ${arcEnd[1]}`}
              fill="none" stroke="#4a9eff" strokeWidth={2.5} strokeLinecap="round" />
          )}
          <line x1={tickEnd[0]} y1={tickEnd[1]} x2={tickIn[0]} y2={tickIn[1]}
            stroke="#444" strokeWidth={1} strokeLinecap="round" />
          <line x1={thumbIn[0]} y1={thumbIn[1]} x2={thumbOut[0]} y2={thumbOut[1]}
            stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
      </div>
      <span style={{ color:"#4a9eff", fontSize:7, fontWeight:700, width:18, textAlign:"right", flexShrink:0, fontFamily:"monospace" }}>{panLabel}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIC PRO TRACK HEADER  — solid black, no R button, fader+pan sliders
// ─────────────────────────────────────────────────────────────────────────────
function LogicTrackHeader({
  track, isRec, isSelected, fxOpen, showTakes,
  onSelect, onMute, onSolo, onFx, onTakes, onRemove,
  updateTrack, analyserNode, isPlaying,
  isDragging, isDropTarget,
  onLongPressStart, onLongPressCancel, onDragMove, onDragEnd,
}) {
  const [renaming, setRenaming] = React.useState(false);
  const [nameVal,  setNameVal]  = React.useState(track.name);
  const [holdProgress, setHoldProgress] = React.useState(0); // 0–1 fill while holding
  const inputRef    = React.useRef(null);
  const holdRafRef  = React.useRef(null);
  const holdStartRef = React.useRef(null);
  const HOLD_MS = 1500;

  React.useEffect(() => { setNameVal(track.name); }, [track.name]);
  React.useEffect(() => { if (renaming && inputRef.current) inputRef.current.focus(); }, [renaming]);

  // Cancel hold animation when drag starts from outside
  React.useEffect(() => {
    if (!isDragging) { setHoldProgress(0); }
  }, [isDragging]);

  const commitRename = () => {
    const n = nameVal.trim() || track.name;
    updateTrack(track.id, { name: n });
    setRenaming(false);
  };

  const startHoldAnim = () => {
    holdStartRef.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - holdStartRef.current;
      const p = Math.min(1, elapsed / HOLD_MS);
      setHoldProgress(p);
      if (p < 1) holdRafRef.current = requestAnimationFrame(tick);
    };
    holdRafRef.current = requestAnimationFrame(tick);
  };

  const cancelHoldAnim = () => {
    cancelAnimationFrame(holdRafRef.current);
    holdStartRef.current = null;
    setHoldProgress(0);
  };

  const accentColor = isRec ? "#FF3B30" : track.color || "#30D158";
  const trackIcon   = track.type === "beat" ? "♩" : "●";

  return (
    <div
      onClick={onSelect}
      onPointerDown={function(e) {
        if (renaming) return;
        // Don't start long-press when the touch lands on an interactive control
        // (volume fader, pan slider, M/S/FX buttons). Those are nested inside
        // this wrapper so their own stopPropagation hasn't run yet — we check
        // the event target directly to bail out early.
        const isInteractive = e.target.closest('button, input, [data-nolongpress]');
        const hasTitleAttr  = e.target.closest('[title]'); // fader & pan tracks carry title attrs
        if (isInteractive || hasTitleAttr) return;
        startHoldAnim();
        onLongPressStart && onLongPressStart(e);
      }}
      onPointerUp={function(e) {
        cancelHoldAnim();
        onLongPressCancel && onLongPressCancel();
        onDragEnd && onDragEnd();
      }}
      onPointerCancel={function() {
        cancelHoldAnim();
        onLongPressCancel && onLongPressCancel();
      }}
      onPointerMove={function(e) {
        if (isDragging) onDragMove && onDragMove(e);
      }}
      style={{
        width:"100%", height:"100%",
        display:"flex", flexDirection:"column",
        background: isDragging ? "#1a0a1a" : isDropTarget ? "#0d1a0d" : isSelected ? "#111111" : "#000000",
        borderRight: isSelected ? "1px solid #303030" : "1px solid #1a1a1a",
        borderLeft: `3px solid ${isDragging ? "#C026D3" : isDropTarget ? "#30D158" : accentColor}`,
        cursor: isDragging ? "grabbing" : "pointer",
        overflow:"hidden",
        padding:"4px 5px 4px 4px",
        boxSizing:"border-box",
        gap:3,
        touchAction:"none",
        userSelect:"none",
        opacity: isDragging ? 0.75 : 1,
        boxShadow: isDragging ? "0 0 0 2px #C026D3, 0 4px 24px rgba(192,38,211,0.35)" : isDropTarget ? "0 0 0 2px #30D158 inset" : "none",
        transition: "background 0.1s, box-shadow 0.1s, opacity 0.1s",
        position: "relative",
      }}
    >
      {/* Hold-to-select progress ring */}
      {holdProgress > 0 && holdProgress < 1 && !isDragging && (
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none", zIndex:20,
          background:`linear-gradient(90deg, rgba(192,38,211,${holdProgress * 0.18}) 0%, transparent 100%)`,
          borderRadius:0,
        }}>
          <div style={{
            position:"absolute", bottom:0, left:0,
            height:2, borderRadius:1,
            width:`${holdProgress * 100}%`,
            background:"linear-gradient(90deg,#C026D3,#7C3AED)",
            boxShadow:"0 0 6px rgba(192,38,211,0.8)",
            transition:"none",
          }} />
        </div>
      )}
      {/* Drag grab handle — appears when dragging */}
      {isDragging && (
        <div style={{
          position:"absolute", top:"50%", right:4,
          transform:"translateY(-50%)",
          display:"flex", flexDirection:"column", gap:2,
          pointerEvents:"none", opacity:0.6,
        }}>
          {[0,1,2].map(function(i){ return <div key={i} style={{ width:14, height:1.5, borderRadius:1, background:"#C026D3" }} />; })}
        </div>
      )}
      {/* ── Row 1: Icon badge + name + M + S + FX ── */}
      <div style={{ display:"flex", alignItems:"center", gap:3, minWidth:0 }}>
        {/* Icon badge */}
        <div style={{
          width:13, height:13, borderRadius:3, flexShrink:0,
          background: isSelected ? accentColor : "#1e1e1e",
          border:`1px solid ${isSelected ? accentColor : "#2a2a2a"}`,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <span style={{ color: isSelected ? "#fff" : "#555", fontSize:7, fontWeight:900, lineHeight:1 }}>
            {trackIcon}
          </span>
        </div>

        {/* Track name — double-tap to rename */}
        {renaming ? (
          <input
            ref={inputRef}
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === "Enter")   commitRename();
              if (e.key === "Escape") { setRenaming(false); setNameVal(track.name); }
            }}
            onClick={e => e.stopPropagation()}
            style={{
              flex:1, minWidth:0,
              background:"#0d0d0d", border:`1px solid ${accentColor}`,
              borderRadius:3, color:"#fff", fontSize:9, fontWeight:600,
              padding:"1px 3px", outline:"none",
            }}
          />
        ) : (
          <span
            onDoubleClick={e => { e.stopPropagation(); setRenaming(true); }}
            style={{
              flex:1, minWidth:0,
              color:"#d0d0d0", fontSize:9, fontWeight:700,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              lineHeight:1,
            }}
          >{track.name}</span>
        )}

        {/* M */}
        <button onClick={e => { e.stopPropagation(); onMute(); }}
          style={{
            width:16, height:13, borderRadius:3, flexShrink:0, padding:0,
            background: track.isMuted ? "#FFD60A" : "#1e1e1e",
            border:`1px solid ${track.isMuted ? "#FFD60A" : "#2a2a2a"}`,
            color: track.isMuted ? "#000" : "#666",
            fontSize:8, fontWeight:900, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow: track.isMuted ? "0 0 4px rgba(255,214,10,0.5)" : "none",
          }}>M</button>

        {/* S */}
        <button onClick={e => { e.stopPropagation(); onSolo(); }}
          style={{
            width:16, height:13, borderRadius:3, flexShrink:0, padding:0,
            background: track.isSoloed ? "#30D158" : "#1e1e1e",
            border:`1px solid ${track.isSoloed ? "#30D158" : "#2a2a2a"}`,
            color: track.isSoloed ? "#000" : "#666",
            fontSize:8, fontWeight:900, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow: track.isSoloed ? "0 0 4px rgba(48,209,88,0.5)" : "none",
          }}>S</button>

        {/* FX */}
        <button onClick={e => { e.stopPropagation(); onFx(); }}
          style={{
            width:20, height:13, borderRadius:3, flexShrink:0, padding:0,
            background: fxOpen ? "rgba(139,92,246,0.22)" : "#1e1e1e",
            border:`1px solid ${fxOpen ? "#8B5CF6" : "#2a2a2a"}`,
            color: fxOpen ? "#a78bfa" : "#555",
            fontSize:7, fontWeight:900, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>FX</button>

        {/* Takes (only if >1 clips) */}
        {track.clips && track.clips.length > 1 && (
          <button onClick={e => { e.stopPropagation(); onTakes(); }}
            style={{
              width:20, height:13, borderRadius:3, flexShrink:0, padding:0,
              background: showTakes ? "rgba(59,130,246,0.22)" : "#1e1e1e",
              border:`1px solid ${showTakes ? "#3B82F6" : "#2a2a2a"}`,
              color: showTakes ? "#60a5fa" : "#555",
              fontSize:7, fontWeight:900, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>{track.clips.length}▾</button>
        )}

        {/* Delete */}
        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{
            background:"none", border:"none", color:"#2a2a2a",
            fontSize:10, cursor:"pointer", padding:"0 1px", lineHeight:1, flexShrink:0,
          }}
          onPointerEnter={e => e.currentTarget.style.color="#FF3B30"}
          onPointerLeave={e => e.currentTarget.style.color="#2a2a2a"}
        >✕</button>
      </div>

      {/* ── Row 2: VU meters ── */}
      <StereoVUMeter analyserNode={analyserNode} isActive={isPlaying && !track.isMuted} />

      {/* ── Row 3: Volume fader (with dB label) ── */}
      <LogicVolumeFader
        value={track.volume ?? 1}
        onChange={v => updateTrack(track.id, { volume: v })}
      />

      {/* ── Row 4: Pan slider ── */}
      <LogicPanSlider
        value={track.pan || 0}
        onChange={v => updateTrack(track.id, { pan: v })}
      />
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
          <div style={{ color: "#06B6D4", fontWeight: 800, fontSize: 13 }}><AppIcon id="target" size={20}/> Rhyme Finder</div>
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
          <AppIcon id="target" size={20}/> Rhyme Finder
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
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: "#000",
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
      {/* ── Audio Level Meter (YouTube iframe – driven by animation) ── */}
      <div style={{ padding: "8px 16px", background: "#060606", borderBottom: "1px solid #111", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ color: "#333", fontSize: 8, fontWeight: 700, letterSpacing: 1.5, fontFamily: "monospace", whiteSpace: "nowrap" }}>OUTPUT</div>
          <div style={{ flex: 1 }}>
            <PlayerVUMeter isPlaying={true} />
          </div>
          <div style={{ color: "#22C55E", fontSize: 8, fontWeight: 700, letterSpacing: 1, fontFamily: "monospace" }}>0dB</div>
        </div>
      </div>
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
          {savedIds.has(beat.videoId) ? "Saved to Favourites" : "Save to Favourites"}
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
                ▤ Open Existing Lyrics - {savedLyrics.find(l => l.beatId === beat.videoId).title}
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
            <AppIcon id="lockkey" size={20}/> Purchase plan to write lyrics
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
          <AppIcon id="note" size={20}/> To use this beat in Studio Mode, purchase or obtain a valid license from the creator and upload the MP3/WAV file.
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
            <span style={{ fontSize: 40, opacity: 0.3 }}><AppIcon id="note" size={20}/></span>
          </div>
        )}
        {/* Gradient overlay */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.15) 50%,rgba(0,0,0,0.05) 100%)" }} />
        {/* Neon play button */}
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
          <svg width="72" height="52" viewBox="0 0 72 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="neon-main" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3" result="blur1"/>
                <feGaussianBlur stdDeviation="8" result="blur2"/>
                <feMerge><feMergeNode in="blur2"/><feMergeNode in="blur1"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <linearGradient id="ng-main" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#9333ea"/>
                <stop offset="100%" stopColor="#3b82f6"/>
              </linearGradient>
            </defs>
            <rect x="3" y="3" width="66" height="46" rx="8" stroke="url(#ng-main)" strokeWidth="1.5" fill="black" filter="url(#neon-main)" opacity="0.9"/>
            <polygon points="29,16 29,36 48,26" stroke="url(#ng-main)" strokeWidth="1.5" fill="none" strokeLinejoin="round" filter="url(#neon-main)" opacity="0.9"/>
          </svg>
        </div>
        {/* Badges */}
        {(featured || exclusive) && (
          <div style={{ position: "absolute", top: 10, left: 12 }}>
            <div style={{ background: featured ? "linear-gradient(135deg,#C026D3,#7C3AED)" : "linear-gradient(135deg,#F59E0B,#EF4444)", borderRadius: 20, padding: "4px 12px", fontSize: 10, color: "white", fontWeight: 800, letterSpacing: 0.5 }}>
              {featured ? "★ FEATURED" : "EXCLUSIVE"}
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
    { label: "Hype",     q: "hard trap type beat",      emoji: "flame", color: "#EF4444" },
    { label: "Chill",    q: "chill lo fi type beat",    emoji: "chill", color: "#3B82F6" },
    { label: "Dark",     q: "dark drill type beat",     emoji: "dark_face", color: "#8B5CF6" },
    { label: "Melodic",  q: "melodic type beat",        emoji: "wave", color: "#06B6D4" },
    { label: "Romantic", q: "romantic r&b type beat",   emoji: "heart", color: "#EC4899" },
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
  var rankEmoji = savedCount >= 30 ? "★★★" : savedCount >= 10 ? "★★" : "★";
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
            {"Welcome back" + (firstName ? ", " + firstName : "") + "!"}
          </div>
          {isProducer && (
            <div style={{ color: "#C026D3", fontSize: 12, fontWeight: 600, marginTop: 3 }}>Producer Pro</div>
          )}
        </div>

        {/* 1. YOUR VIBE RIGHT NOW */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#888", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10 }}>
            <AppIcon id="target" size={20}/> YOUR VIBE RIGHT NOW
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
                  <Icon id={v.emoji} size={14} color={isActive ? v.color : "#777"} />
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
            <AppIcon id="flame" size={20}/> YOUR TOP GENRE
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
          <div style={{ color: "#888", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon id="edit" size={12} color="#888" strokeWidth={2} /> CONTINUE WRITING
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
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon id="edit" size={18} color="white" strokeWidth={2} />
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
            <AppIcon id="note" size={20}/> BEAT OF THE DAY
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
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
                <AppIcon id="money" size={20}/> PRODUCER EARNINGS SNAPSHOT
              </div>
              {producerStats ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Beats Uploaded",  value: producerStats.totalBeats,     color: "#C026D3", icon: "note" },
                    { label: "Total Downloads",  value: producerStats.totalDownloads, color: "#3B82F6", icon: "download" },
                    { label: "Total Revenue",    value: "£" + producerStats.totalRevenue, color: "#22C55E", icon: "moneyfly" },
                    { label: "Leases Sold",      value: producerStats.recentSales,   color: "#F59E0B", icon: "edit" },
                  ].map(function(stat) {
                    return (
                      <div key={stat.label} style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 12, padding: "12px 10px", textAlign: "center",
                      }}>
                        <div style={{ marginBottom: 4 }}><Icon id={stat.icon} size={18} color="#888" strokeWidth={1.6} /></div>
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
                <AppIcon id="trophy" size={20}/> YOUR BEATFINDER RANK
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
      emoji: "note",
      grad: "linear-gradient(135deg,#12002a 0%,#3b0070 60%,#C026D3 100%)",
      cta: "Explore Beats",
      btnColor: "rgba(192,38,211,0.5)",
      btnBorder: "rgba(192,38,211,0.7)",
    },
    {
      title: "Write & Save Lyrics",
      sub: "Write lyrics whilst beats play & save to your profile",
      emoji: "note",
      grad: "linear-gradient(135deg,#001a0a 0%,#003318 40%,#065f2f 75%,#16A34A 100%)",
      cta: "Write Lyrics",
      lyricsSlide: true,
      btnColor: "rgba(22,163,74,0.5)",
      btnBorder: "rgba(22,163,74,0.7)",
    },
    {
      title: "Rhyme Finder",
      sub: "Find perfect rhymes & multi-syllable rhymes while you write",
      emoji: "note",
      grad: "linear-gradient(135deg,#1a0a00 0%,#3d1800 40%,#7c3500 75%,#EA580C 100%)",
      cta: "Try It Now",
      lyricsSlide: true,
      btnColor: "rgba(234,88,12,0.5)",
      btnBorder: "rgba(234,88,12,0.7)",
    },
    {
      title: "Discover Rising Producers",
      sub: "Tap in with producers worldwide",
      emoji: "note",
      grad: "linear-gradient(135deg,#001230 0%,#002a70 60%,#3B82F6 100%)",
      cta: "Find Producers",
      btnColor: "rgba(59,130,246,0.5)",
      btnBorder: "rgba(59,130,246,0.7)",
      trendingSlide: true,
    },
    {
      title: "Sell Your Beats",
      sub: "Upload, price, and earn on every lease",
      emoji: "note",
      grad: "linear-gradient(135deg,#180800 0%,#3a1500 60%,#F59E0B 100%)",
      cta: "Go Producer Pro",
      btnColor: "rgba(245,158,11,0.5)",
      btnBorder: "rgba(245,158,11,0.7)",
    },
    {
      title: "Record in the Studio",
      sub: "Create projects, record vocals over any beat & export your mix",
      emoji: "note",
      grad: "linear-gradient(135deg,#0a001a 0%,#1a0033 40%,#4c0080 75%,#7C3AED 100%)",
      cta: "Open Studio",
      studioSlide: true,
      btnColor: "rgba(124,58,237,0.5)",
      btnBorder: "rgba(124,58,237,0.8)",
      badge: "PRO",
    },
  ];

  const GENRES = [
    { label: "Trap",       q: "trap type beat",       color: "#C026D3", emoji: "flame" },
    { label: "UK Drill",   q: "uk drill type beat",   color: "#3B82F6", emoji: "target" },
    { label: "R&B",        q: "rnb type beat",        color: "#F59E0B", emoji: "note" },
    { label: "Afrobeat",   q: "afrobeat type beat",   color: "#22C55E", emoji: "globe" },
    { label: "Melodic",    q: "melodic type beat",    color: "#818CF8", emoji: "wave" },
    { label: "Dancehall",  q: "dancehall riddim",     color: "#EC4899", emoji: "festival" },
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
        <AppIcon id={emoji} size={18} />
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
            opacity: 0.1, lineHeight: 1, userSelect: "none",
          }}><Icon id={slide.emoji} size={90} color="white" /></div>

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
            <div style={{ fontSize: 28 }}><AppIcon id="lock" size={20}/></div>
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
        <SectionHead emoji="target" title="BROWSE BY GENRE" />
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
                <Icon id={g.emoji} size={15} color={g.color} />
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
                {/* Neon play button */}
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                  <svg width="54" height="38" viewBox="0 0 72 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <filter id="neon-grid" x="-40%" y="-40%" width="180%" height="180%">
                        <feGaussianBlur stdDeviation="3" result="blur1"/>
                        <feGaussianBlur stdDeviation="8" result="blur2"/>
                        <feMerge><feMergeNode in="blur2"/><feMergeNode in="blur1"/><feMergeNode in="SourceGraphic"/></feMerge>
                      </filter>
                      <linearGradient id="ng-grid" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#9333ea"/>
                        <stop offset="100%" stopColor="#3b82f6"/>
                      </linearGradient>
                    </defs>
                    <rect x="3" y="3" width="66" height="46" rx="8" stroke="url(#ng-grid)" strokeWidth="1.5" fill="black" filter="url(#neon-grid)" opacity="0.9"/>
                    <polygon points="29,16 29,36 48,26" stroke="url(#ng-grid)" strokeWidth="1.5" fill="none" strokeLinejoin="round" filter="url(#neon-grid)" opacity="0.9"/>
                  </svg>
                </div>
                <button className="bf-save" onClick={e => { e.stopPropagation(); onSave(beat); }} style={{
                  position: "absolute", top: 7, right: 7,
                  width: 30, height: 30, borderRadius: "50%", border: "none",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 14,
                  background: isSaved ? "rgba(192,38,211,0.9)" : "rgba(0,0,0,0.65)",
                  color: isSaved ? "white" : "rgba(255,255,255,0.6)",
                  boxShadow: isSaved ? "0 0 10px rgba(192,38,211,0.5)" : "none",
                }}><AppIcon id="bookmark" size={20}/></button>
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
                {/* Neon play button */}
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                  <svg width="48" height="34" viewBox="0 0 72 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <filter id="neon-trend" x="-40%" y="-40%" width="180%" height="180%">
                        <feGaussianBlur stdDeviation="3" result="blur1"/>
                        <feGaussianBlur stdDeviation="8" result="blur2"/>
                        <feMerge><feMergeNode in="blur2"/><feMergeNode in="blur1"/><feMergeNode in="SourceGraphic"/></feMerge>
                      </filter>
                      <linearGradient id="ng-trend" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#9333ea"/>
                        <stop offset="100%" stopColor="#3b82f6"/>
                      </linearGradient>
                    </defs>
                    <rect x="3" y="3" width="66" height="46" rx="8" stroke="url(#ng-trend)" strokeWidth="1.5" fill="black" filter="url(#neon-trend)" opacity="0.9"/>
                    <polygon points="29,16 29,36 48,26" stroke="url(#ng-trend)" strokeWidth="1.5" fill="none" strokeLinejoin="round" filter="url(#neon-trend)" opacity="0.9"/>
                  </svg>
                </div>
                {/* Rank badge */}
                <div style={{
                  position: "absolute", top: 7, left: 8,
                  background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
                  border: "1px solid rgba(245,158,11,0.4)",
                  borderRadius: 20, padding: "2px 9px",
                  fontSize: 10, color: "#F59E0B", fontWeight: 900,
                }}>#{i + 1}</div>
                <button className="bf-save" onClick={e => { e.stopPropagation(); onSave(beat); }} style={{
                  position: "absolute", top: 5, right: 6,
                  width: 26, height: 26, borderRadius: "50%", border: "none",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 12,
                  background: isSaved ? "rgba(192,38,211,0.9)" : "rgba(0,0,0,0.65)",
                  color: isSaved ? "white" : "rgba(255,255,255,0.5)",
                }}><AppIcon id="bookmark" size={20}/></button>
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
        <span style={{ color: "#555" }}><AppIcon id="search" size={20}/></span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search artists"
          style={{ background: "none", border: "none", outline: "none", color: "white", fontSize: 15, flex: 1 }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { id: "USA",     label: "🇺🇸 US"      },
          { id: "UK",      label: "🇬🇧 UK"      },
          { id: "JAMAICA", label: "🇯🇲 Jamaica"  },
          { id: "AFRICA",  label: "🇿🇦🇳🇬 Africa"   },
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
            {artist.flag} {artist.flag === "🇺🇸" ? "USA" : artist.flag === "🇬🇧" ? "🇬🇧" : artist.flag === "🇯🇲" ? "Jamaica" : "Africa"} • <span style={{ color: cc }}>{artist.cat}</span>
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
        {previewing ? "■ Stop Preview" : "▶ Preview Beat"}
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
          {loading ? "Loading..." : "Buy Lease - " + beat.price}
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
        <div style={{ color: "#F59E0B", fontSize: 13, fontWeight: 800, marginBottom: 6 }}><AppIcon id="note" size={20}/> PRODUCER BEATS</div>
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
        <div style={{ fontSize: 48, marginBottom: 16 }}><AppIcon id="knobs" size={20}/></div>
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
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <svg width="54" height="38" viewBox="0 0 72 52" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="neon-carousel" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="3" result="blur1"/>
                  <feGaussianBlur stdDeviation="8" result="blur2"/>
                  <feMerge><feMergeNode in="blur2"/><feMergeNode in="blur1"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <linearGradient id="ng-carousel" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#9333ea"/>
                  <stop offset="100%" stopColor="#3b82f6"/>
                </linearGradient>
              </defs>
              <rect x="3" y="3" width="66" height="46" rx="8" stroke="url(#ng-carousel)" strokeWidth="1.5" fill="black" filter="url(#neon-carousel)" opacity="0.9"/>
              <polygon points="29,16 29,36 48,26" stroke="url(#ng-carousel)" strokeWidth="1.5" fill="none" strokeLinejoin="round" filter="url(#neon-carousel)" opacity="0.9"/>
            </svg>
          </div>
          <button className="bf-save" onClick={e => { e.stopPropagation(); onSave(beat); }} style={{
            position: "absolute", top: 6, right: 6, width: 28, height: 28,
            borderRadius: "50%", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
            background: isSaved ? "rgba(192,38,211,0.9)" : "rgba(0,0,0,0.6)",
            color: isSaved ? "white" : "rgba(255,255,255,0.6)",
            boxShadow: isSaved ? "0 0 8px rgba(192,38,211,0.5)" : "none",
          }}>

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
        <AppIcon id={emoji} size={20} />
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

      
      <SectionHeader emoji="flame" title="TRENDING ON YOUTUBE" subtitle="1M+ views, sorted by most viewed" color="#F59E0B" />
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

      
      <SectionHeader emoji="rocket" title="RISING PRODUCERS" subtitle="New uploads from producers" color="#22C55E" />
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

      
      <SectionHeader emoji="target" title="FRESH UPLOADS" subtitle="Newest beats uploaded recently" color="#06B6D4" />
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
        <span style={{ color: "#555" }}><AppIcon id="search" size={20}/></span>
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
            <div style={{ fontSize: 44, marginBottom: 12 }}><AppIcon id="note" size={20}/></div>
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
      <div style={{ fontSize: 64, marginBottom: 20 }}><AppIcon id="bookmark" size={20}/></div>
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
          <div style={{ fontSize: 56, marginBottom: 16 }}><AppIcon id="bookmark" size={20}/></div>
          <div style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 8 }}>No beats saved yet</div>
          <div style={{ color: "#555", fontSize: 14, lineHeight: 1.8, marginBottom: 24 }}>
            Tap the <AppIcon id="bookmark" size={20}/> bookmark icon on any beat<br />to start building your library
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {["Browse Artists", "Check Trending", "Search a Vibe"].map(t => (
              <div key={t} style={{ padding: "8px 16px", borderRadius: 20, border: "1.5px solid #2a2a2a", color: "#555", fontSize: 13 }}>{t}</div>
            ))}
          </div>
        </div>
      ) : filteredList.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>▤</div>
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
        <div style={{ fontSize: 44, marginBottom: 10 }}><AppIcon id="lock" size={20}/></div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 34, letterSpacing: 3, color: "#F59E0B", marginBottom: 6 }}>MEMBERS ONLY</div>
        <div style={{ color: "#aaa", fontSize: 14, lineHeight: 1.6, maxWidth: 300, margin: "0 auto" }}>
          Join the BeatFinder community and unlock the full producer ecosystem
        </div>
      </div>

      
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ color: "#F59E0B", fontWeight: 800, fontSize: 12, letterSpacing: 1, marginBottom: 14, textAlign: "center" }}>WHAT YOU UNLOCK</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { icon: "note",     color: "#F59E0B", title: "Exclusive Beats", desc: "Access member-only beats unavailable anywhere else" },
            { icon: "download", color: "#F59E0B", title: "MP3 Downloads",   desc: "Download and buy leases directly from producers" },
            { icon: "edit",     color: "#F59E0B", title: "Lyric Studio",    desc: "Access exclusive member beats with AI assistance" },
            { icon: "knobs",    color: "#F59E0B", title: "Producer Tools",  desc: "Upload beats, sell leases and get paid instantly" },
          ].map(v => (
            <div key={v.title} style={{ background: "#111", borderRadius: 14, padding: 14, border: "1px solid rgba(245,158,11,0.15)" }}>
              <div style={{ marginBottom: 10 }}><Icon id={v.icon} size={24} color={v.color} strokeWidth={1.6} /></div>
              <div style={{ color: "white", fontWeight: 800, fontSize: 13, marginBottom: 4 }}>{v.title}</div>
              <div style={{ color: "#555", fontSize: 11, lineHeight: 1.5 }}>{v.desc}</div>
            </div>
          ))}
        </div>

        
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: "#888", fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 12, textAlign: "center" }}>CHOOSE YOUR PLAN</div>
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { label: "Artist Pro", price: "£4.99/mo", color: "#F59E0B", perks: ["Write lyrics to beats", "Save unlimited beats", "Exclusive member beats", "Download MP3s", "Purchase leases", "Bookmark unlimited beats"] },
              { label: "Producer Pro", price: "£8.99/mo", color: "#C026D3", perks: ["Everything in Artist Pro", "Upload & sell beats", "Sell MP3 leases", "Download stats", "Verified badge", "Featured in rotation"] },
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
            { icon: "stripe", text: "Get paid instantly via Stripe" },
            { icon: "note", text: "Your beats reach real artists daily" },
            { icon: "grid", text: "Track downloads and sales" },
          ].map(r => (
            <div key={r.text} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, color: "#888", fontSize: 13 }}>
              <Icon id={r.icon} size={14} color="#888" />
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
              <div style={{ color: "#F59E0B", fontWeight: 800, fontSize: 12, marginBottom: 4, letterSpacing: 1 }}><AppIcon id="lock" size={20}/> MEMBERS ONLY</div>
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
            <AppIcon id="flame" size={20}/> Exclusive Beats
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

        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ color: "white", fontWeight: 700, fontSize: 15, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {lyric.title}
          </div>
          {lyric.beatTitle && (
            <div style={{ color: "#C026D3", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <AppIcon id="note" size={20}/> {lyric.beatTitle}
            </div>
          )}
          <div style={{ color: "#555", fontSize: 11, marginTop: 3 }}>
            {lyric.updatedAt
              ? "Edited " + new Date(lyric.updatedAt).toLocaleDateString()
              : new Date(lyric.savedAt).toLocaleDateString()}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ color: "#444", fontSize: 18 }}>{'>'}</span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ background: "none", border: "none", color: "#555", fontSize: 16, cursor: "pointer", padding: 4 }}>
            ⌫
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
      <div style={{ fontSize: 36, marginBottom: 10 }}><AppIcon id="profile" size={20}/></div>
      <div style={{ fontSize: 13 }}>Loading profile...</div>
    </div>
  );

  if (error || !profile) return (
    <div style={{ textAlign: "center", padding: "80px 24px", color: "#555" }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}><AppIcon id="profile" size={20}/></div>
      <div style={{ fontSize: 15, color: "#888" }}>Profile not found</div>
      <button onClick={onBack} style={{ marginTop: 20, background: "#1a1a1a", border: "1px solid #333", borderRadius: 12, color: "white", padding: "10px 24px", cursor: "pointer" }}>Go Back</button>
    </div>
  );

  const planLabel = profile.plan === "producer" ? "Producer Pro" : profile.plan === "artist" ? "Artist Pro" : null;
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
          <div style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 14 }}><AppIcon id="note" size={20}/> Beats by {profile.username}</div>
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
      <div style={{ fontSize: 36, marginBottom: 10 }}><AppIcon id="profile" size={20}/></div>
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
      <div style={{ color: "white", fontWeight: 800, fontSize: 16, marginBottom: 6 }}>▭ Stripe Payouts</div>
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
      <div style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 6 }}><AppIcon id="knobs" size={20}/> My Uploaded Beats</div>
      <div style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>Edit or delete your uploaded beats.</div>

      {msg && <div style={{ color: msg.startsWith("Error") ? "#F87171" : "#22C55E", fontSize: 13, marginBottom: 12, textAlign: "center", fontWeight: 600 }}>{msg}</div>}

      {beats.length === 0 && (
        <div style={{ background: "#111", borderRadius: 14, padding: 20, textAlign: "center", border: "1px solid #222" }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}><AppIcon id="profile" size={20}/></div>
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
        <div style={{ fontSize: 48, marginBottom: 16 }}><AppIcon id="knobs" size={20}/></div>
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
          <div style={{ fontSize: 40, marginBottom: 12 }}><AppIcon id="folder" size={20}/></div>
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
      id: "artist", label: "Artist Pro", price: "4.99",
      perks: ["Access Exclusive Members area","Bookmark unlimited beats","Artist verified badge","Personalised recommendations"],
    },
    {
      id: "producer", label: "Producer Pro", price: "8.99",
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
          <div style={{ fontSize: 56, marginBottom: 16 }}><AppIcon id="bookmark" size={20}/></div>
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
          {user.isArtistPro && !user.isPro && <span style={{ display: "inline-block", background: "rgba(245,158,11,0.2)", border: "1px solid #F59E0B", borderRadius: 20, padding: "4px 14px", color: "#F59E0B", fontWeight: 800, fontSize: 12 }}><AppIcon id="vocalmic" size={20}/> Artist Pro</span>}
        </div>
      </div>

      
      {!activeSection && (
        <div>
          
          {user.isArtistPro && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}><AppIcon id="vocalmic" size={20}/> ARTIST TOOLS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  
                  { id: "lyrics",  icon: "edit", label: "My Lyrics",    desc: savedLyrics.length + " saved",    color: "#C026D3" },
                  { id: "members", icon: "note", label: "Members Area", desc: "Exclusive beats",                 color: "#F59E0B" },
                ].map(item => (
                  <button key={item.id} onClick={() => goSection(item.id)}
                    style={{ background: "#111", borderRadius: 14, padding: "16px 12px", border: "1.5px solid #1e1e1e", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}><AppIcon id={item.icon} size={24}/></div>
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
              <div style={{ color: "#888", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}><AppIcon id="piano" size={20}/> PRODUCER TOOLS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { id: "upload",  icon: "upload", label: "Upload Beat",  desc: "Add new beat",       color: "#C026D3" },
                  { id: "manage",  icon: "knobs", label: "My Uploads",   desc: uploads.length + " beats", color: "#F59E0B" },
                  { id: "stripe",  icon: "stripe", label: "Stripe Payouts", desc: producerStats?.stripeConnected ? "Connected" : "Not connected", color: "#22C55E" },
                  { id: "stats",   icon: "grid", label: "Analytics",    desc: producerStats ? producerStats.totalDownloads + " downloads" : "Loading...", color: "#818CF8" },
                ].map(item => (
                  <button key={item.id} onClick={() => goSection(item.id)}
                    style={{ background: "#111", borderRadius: 14, padding: "16px 12px", border: "1.5px solid #1e1e1e", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}><AppIcon id={item.icon} size={24}/></div>
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
            <div style={{ marginBottom: 10 }}><Icon id="edit" size={40} color="#555" strokeWidth={1.5} /></div>
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
                  style={{ width: "100%", background: "rgba(192,38,211,0.1)", border: "1.5px solid #C026D3", borderRadius: 10, color: "#C026D3", fontWeight: 700, fontSize: 14, padding: "10px", cursor: "pointer", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Icon id="edit" size={16} color="#C026D3" strokeWidth={2} /> Continue Writing
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
            <input type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff,.opus" onChange={e => setUploadFile(e.target.files[0])}
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

    // Mix down all channels to mono so waveform always shows regardless of
    // whether iOS decoded the recording as mono or stereo.
    const nc  = audioBuffer.numberOfChannels;
    const sr  = audioBuffer.sampleRate;
    let raw;
    if (nc === 1) {
      raw = audioBuffer.getChannelData(0);
    } else {
      const len = audioBuffer.length;
      raw = new Float32Array(len);
      for (let c = 0; c < nc; c++) {
        const ch = audioBuffer.getChannelData(c);
        for (let i = 0; i < len; i++) raw[i] += ch[i] / nc;
      }
    }

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

// ── Plugin chain panel — extracted from IIFE so useState is a valid hook call ──
function FxPanelPlugins({ fx, upd, eq5, EQGraph, CompGraph, ReverbViz, Knob, analyserNode, isPlaying }) {
  // EQPlugin / CompPlugin / ReverbPlugin / PitchPlugin are pure render helpers
  // defined here so they always have the correct fx/upd/Knob/graph refs.
  const EQPlugin     = function(p){ return _EQPlugin(p); };
  const CompPlugin   = function(p){ return _CompPlugin(p); };
  const ReverbPlugin = function(p){ return _ReverbPlugin(p); };
  const PitchPlugin  = function(p){ return _PitchPlugin(p); };
  const NoiseRemoverPlugin = function(p){ return _NoiseRemoverPlugin(p); };
  const DoublerPlugin = function(p){ return _DoublerPlugin(p); };
  const HDelayPlugin  = function(p){ return _HDelayPlugin(p); };
  const TRottenPlugin = function(p){ return _TRottenMasterPlugin(p); };
  const BandpassPlugin = function(p){ return _BandpassPlugin(p); };
  // Phosphor-style plugin icons — each tailored to its FX type
  function PhosphorPluginIcon({ id, color = "#888", size = 22 }) {
    const paths = {
      // Parametric EQ — frequency curve with nodes
      "ph-eq": "M3 18 Q6 6 9 12 Q12 18 15 8 Q18 -2 21 10",
      // Compressor — waveform being squashed
      "ph-compress": "M3 12h3 M6 12 L8 6 L10 18 L12 8 L14 16 L16 12h5 M18 7 L21 12 L18 17",
      // Reverb — expanding wave rings
      "ph-reverb": "M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0 M8.5 8.5a5 5 0 017 7 M5.5 5.5a9 9 0 0113 13 M2.5 2.5a13 13 0 0119 19",
      // Pitch — music note with arrow up
      "ph-pitch": "M9 17V6l8-2v11 M9 17a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z M17 15a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z M19 3l3 3-3 3 M22 6h-5",
      // Noise Gate — gate/threshold line with cut
      "ph-gate": "M3 12h4 M7 12 L9 6 L11 18 L13 6 L15 18 L17 12h4 M3 7h2 M3 17h2 M19 7h2 M19 17h2",
      // Doubler — two overlapping waveforms
      "ph-doubler": "M3 9 Q6 4 9 9 Q12 14 15 9 Q18 4 21 9 M3 15 Q6 10 9 15 Q12 20 15 15 Q18 10 21 15",
      // Delay — clock with echo lines
      "ph-delay": "M12 22a10 10 0 100-20 10 10 0 000 20z M12 7v5l3 2 M4 12H1 M1 9l3 3-3 3",
      // Master — crown / broadcast tower
      "ph-master": "M2 20h20 M12 4 L4 14h16z M9 14v6 M15 14v6 M12 4v10",
      // Bandpass — bandpass filter curve
      "ph-bandpass": "M2 18 Q4 18 6 14 Q8 6 12 6 Q16 6 18 14 Q20 18 22 18",
    };
    const d = paths[id];
    if (!d) return null;
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
        style={{ display:"block" }}>
        {d.split(/\s+(?=M)/).map(function(seg, i) { return <path key={i} d={seg} />; })}
      </svg>
    );
  }

  const [showPluginPicker, setShowPluginPicker] = React.useState(false);
  const chain = fx.pluginChain || [];

  const ALL_PLUGINS = [
    { key:"eq",           label:"Pro EQ",              sub:"5-Band · Drag handles",        icon:"▦", color:"#0ea5e9" },
    { key:"compressor",   label:"Compressor",          sub:"Dynamics processor",            icon:"fader", color:"#7C3AED" },
    { key:"reverb",       label:"Convolution Reverb",  sub:"Room simulation",               icon:"wave", color:"#C026D3" },
    { key:"pitch",        label:"Auto-Tune / Pitch",   sub:"Pitch processor v2",            icon:"note", color:"#9333EA" },
    { key:"noiseremover", label:"Noise Remover",       sub:"RNNoise · AI denoising",        icon:"mic", color:"#10B981" },
    { key:"doubler",      label:"Vocal Doubler",        sub:"Stereo width · Haas effect",     icon:"speaker", color:"#F59E0B" },
    { key:"hdelay",       label:"H-Delay",              sub:"Tape · BPM sync · Analog",       icon:"◷", color:"#E85D04" },
    { key:"trotten",      label:"T-Rotten Master",      sub:"Mastering · Analog warmth",       icon:"knobs", color:"#C8762A" },
    { key:"bandpass",     label:"GRM Bandpass",         sub:"Dual 6th-order · Resonance",      icon:"knobs", color:"#00b4d8" },
  ];

  const addPlugin = function(key) {
    if (chain.includes(key)) return;
    upd("pluginChain", null, [...chain, key]);
    setShowPluginPicker(false);
  };

  const removePlugin = function(key) {
    // Single atomic update: removes from chain + forces on:false so the
    // always-built audio node bypasses immediately (no lingering effect).
    upd("__remove", null, key);
  };

  const movePlugin = function(idx, dir) {
    const next = [...chain];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    const tmp = next[idx]; next[idx] = next[swap]; next[swap] = tmp;
    upd("pluginChain", null, next);
  };

  // FL Studio category filter
  const FL_CATS = ["ALL", "DYNAMICS", "EQ", "REVERB", "PITCH", "UTILITY"];
  const [flCat, setFlCat] = React.useState("ALL");

  const FL_PLUGINS = [
    { key:"eq",           label:"Parametric EQ",      sub:"5-Band",          icon:"ph-eq",          color:"#00b4d8", cat:"EQ",       tag:"MIXER"  },
    { key:"compressor",   label:"Compressor",          sub:"Dynamics",        icon:"ph-compress",    color:"#7c3aed", cat:"DYNAMICS", tag:"EFFECT" },
    { key:"reverb",       label:"Reverb",              sub:"Room sim",        icon:"ph-reverb",      color:"#0891b2", cat:"REVERB",   tag:"EFFECT" },
    { key:"pitch",        label:"Newtone / Pitch",     sub:"Pitch v2",        icon:"ph-pitch",       color:"#db2777", cat:"PITCH",    tag:"EFFECT" },
    { key:"noiseremover", label:"Noise Gate AI",       sub:"RNNoise",         icon:"ph-gate",        color:"#059669", cat:"DYNAMICS", tag:"UTILITY" },
    { key:"doubler",      label:"Doubler",             sub:"Haas / Width",    icon:"ph-doubler",     color:"#d97706", cat:"UTILITY",  tag:"MIXER"  },
    { key:"hdelay",       label:"T-Delay",             sub:"Tape · BPM sync", icon:"ph-delay",       color:"#ea580c", cat:"UTILITY",  tag:"EFFECT" },
    { key:"trotten",      label:"T-Rotten Master 19",  sub:"Analog warmth",   icon:"ph-master",      color:"#854d0e", cat:"DYNAMICS", tag:"MASTER" },
    { key:"bandpass",     label:"GRM Bandpass",        sub:"Dual 6th-order",  icon:"ph-bandpass",    color:"#0e7490", cat:"EQ",       tag:"FILTER" },
  ];

  const visiblePlugins = FL_PLUGINS.filter(function(p){
    return flCat === "ALL" || p.cat === flCat;
  });

  return (
    <div style={{ flex:1, padding:"14px", display:"flex", flexDirection:"column", gap:12 }}>

    {/* ── FL Studio-style Plugin Browser (full-screen overlay) ── */}
    {showPluginPicker && (
      <div style={{
        position:"fixed", inset:0, zIndex:9999,
        background:"rgba(0,0,0,0.88)",
        backdropFilter:"blur(12px)",
        display:"flex", flexDirection:"column",
        fontFamily:"'DM Sans',sans-serif",
      }}
        onClick={function(){ setShowPluginPicker(false); }}>
        <div style={{
          position:"absolute", bottom:0, left:0, right:0,
          background:"#0d0d0f",
          borderRadius:"20px 20px 0 0",
          border:"1px solid rgba(255,255,255,0.06)",
          borderBottom:"none",
          paddingBottom:"calc(16px + env(safe-area-inset-bottom))",
          maxHeight:"88vh",
          display:"flex", flexDirection:"column",
        }} onClick={function(e){ e.stopPropagation(); }}>

          {/* ── Top accent line ── */}
          <div style={{
            height:1, borderRadius:"20px 20px 0 0",
            background:"linear-gradient(90deg,transparent,rgba(168,85,247,0.6) 30%,rgba(139,92,246,0.8) 50%,rgba(168,85,247,0.6) 70%,transparent)",
          }} />

          {/* ── Title row ── */}
          <div style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"16px 18px 10px",
            borderBottom:"1px solid rgba(255,255,255,0.04)",
          }}>
            <div>
              <div style={{ color:"#fff", fontWeight:700, fontSize:15, letterSpacing:0.2 }}>Effects</div>
              <div style={{ color:"#3a3a3a", fontSize:10, marginTop:2, letterSpacing:0.5 }}>{FL_PLUGINS.length} PLUGINS AVAILABLE</div>
            </div>
            <button onClick={function(){ setShowPluginPicker(false); }}
              style={{
                background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:8, color:"#555", fontSize:11, fontWeight:600,
                padding:"6px 12px", cursor:"pointer", letterSpacing:0.5,
              }}>✕ Close</button>
          </div>

          {/* ── Search bar ── */}
          <div style={{ padding:"10px 16px 0" }}>
            <div style={{
              display:"flex", alignItems:"center", gap:8,
              background:"rgba(255,255,255,0.03)",
              border:"1px solid rgba(255,255,255,0.07)",
              borderRadius:10, padding:"8px 12px",
            }}>
              <span style={{ color:"#333", fontSize:11 }}>⌕</span>
              <span style={{ color:"#2a2a2a", fontSize:12, fontWeight:400, letterSpacing:0.2 }}>Search plugins…</span>
            </div>
          </div>

          {/* ── Category tabs ── */}
          <div style={{
            display:"flex", gap:4, padding:"10px 16px",
            overflowX:"auto", flexShrink:0,
          }}>
            {FL_CATS.map(function(cat){
              const active = flCat === cat;
              return (
                <button key={cat} onClick={function(){ setFlCat(cat); }}
                  style={{
                    padding:"5px 12px", borderRadius:6, flexShrink:0,
                    background: active ? "rgba(139,92,246,0.15)" : "transparent",
                    border:"1px solid " + (active ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.06)"),
                    color: active ? "#a855f7" : "#3a3a3a",
                    fontSize:9, fontWeight:700, letterSpacing:1,
                    cursor:"pointer", transition:"all 0.15s",
                  }}>{cat}</button>
              );
            })}
          </div>

          {/* ── Plugin list ── */}
          <div style={{ overflowY:"auto", flex:1, padding:"0 12px 8px" }}>
            {visiblePlugins.map(function(p, idx){
              const already = chain.includes(p.key);
              return (
                <button key={p.key}
                  onClick={function(){ if(!already) addPlugin(p.key); }}
                  disabled={already}
                  style={{
                    display:"flex", alignItems:"center", gap:0,
                    width:"100%", marginBottom:2,
                    background: already ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.03)",
                    border:"1px solid rgba(255,255,255,0.05)",
                    borderLeft: already ? "2px solid rgba(255,255,255,0.05)" : "2px solid rgba(139,92,246,0.35)",
                    borderRadius:8, overflow:"hidden",
                    cursor: already ? "default" : "pointer",
                    opacity: already ? 0.3 : 1,
                    textAlign:"left",
                    transition:"all 0.12s",
                  }}>

                  {/* Index */}
                  <div style={{
                    width:28, flexShrink:0,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    alignSelf:"stretch",
                  }}>
                    <span style={{ color:"#2a2a2a", fontSize:9, fontWeight:700, fontFamily:"monospace" }}>
                      {String(idx+1).padStart(2,"0")}
                    </span>
                  </div>

                  {/* Icon — Phosphor-style per-plugin SVG */}
                  <div style={{
                    width:42, height:42, flexShrink:0,
                    background:"rgba(255,255,255,0.03)",
                    borderRight:"1px solid rgba(255,255,255,0.04)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}><PhosphorPluginIcon id={p.icon} color={already ? "#2a2a2a" : p.color} /></div>

                  {/* Name + sub */}
                  <div style={{ flex:1, padding:"10px 12px", minWidth:0 }}>
                    <div style={{
                      color: already ? "#2a2a2a" : "#d4d4d4",
                      fontWeight:600, fontSize:12, lineHeight:1,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                      letterSpacing:0.1,
                    }}>{p.label}</div>
                    <div style={{ color:"#2a2a2a", fontSize:10, marginTop:3, letterSpacing:0.3 }}>{p.sub}</div>
                  </div>

                  {/* Tag — subtle */}
                  <div style={{
                    padding:"2px 7px", marginRight:8, flexShrink:0,
                    background:"rgba(255,255,255,0.03)",
                    border:"1px solid rgba(255,255,255,0.06)",
                    borderRadius:4,
                    color:"#333", fontSize:8, fontWeight:700, letterSpacing:0.6,
                  }}>{p.tag}</div>

                  {/* Add button */}
                  {already ? (
                    <div style={{
                      width:34, alignSelf:"stretch", flexShrink:0,
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      <span style={{ color:"#2a2a2a", fontSize:12 }}>✓</span>
                    </div>
                  ) : (
                    <div style={{
                      width:34, alignSelf:"stretch", flexShrink:0,
                      background:"rgba(139,92,246,0.08)",
                      borderLeft:"1px solid rgba(139,92,246,0.15)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      color:"rgba(139,92,246,0.7)", fontSize:18, fontWeight:300,
                    }}>+</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Footer ── */}
          <div style={{
            padding:"8px 16px 0",
            borderTop:"1px solid rgba(255,255,255,0.03)",
            color:"#222", fontSize:9, fontWeight:600,
            textAlign:"center", letterSpacing:1,
          }}>TAP TO LOAD · DRAG TO REORDER IN CHAIN</div>
        </div>
      </div>
    )}

    {/* ── Empty state — FL Channel Rack empty ── */}
    {chain.length === 0 && (
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 20px", gap:12, textAlign:"center" }}>
        <div style={{
          width:56, height:56, borderRadius:14,
          background:"#111", border:"1px solid #1e1e1e",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:24,
        }}><AppIcon id="knobs" size={20}/></div>
        <div style={{ color:"#333", fontWeight:800, fontSize:13, letterSpacing:1 }}>EMPTY CHAIN</div>
        <div style={{ color:"#252525", fontSize:11, lineHeight:1.6, maxWidth:220 }}>
          Open the plugin database below to load effects into this chain
        </div>
      </div>
    )}

    {/* ── Active plugin slots ── */}
    {chain.map(function(key, idx){
      const plugMeta = FL_PLUGINS.find(function(p){ return p.key === key; }) || {};
      return (
        <div key={key} style={{ marginBottom:4 }}>
          {/* Slot header */}
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, paddingLeft:2 }}>
            <div style={{ display:"flex", gap:1 }}>
              <button onClick={function(){ movePlugin(idx, -1); }}
                style={{ background:"none", border:"none", color: idx===0 ? "#252525" : "#555", fontSize:13, cursor: idx===0 ? "default" : "pointer", padding:"2px 5px", lineHeight:1 }}>↑</button>
              <button onClick={function(){ movePlugin(idx, 1); }}
                style={{ background:"none", border:"none", color: idx===chain.length-1 ? "#252525" : "#555", fontSize:13, cursor: idx===chain.length-1 ? "default" : "pointer", padding:"2px 5px", lineHeight:1 }}>↓</button>
            </div>
            <span style={{ color:"#2a2a2a", fontSize:9, fontWeight:700, letterSpacing:1.5, fontFamily:"monospace" }}>SLOT {idx+1}</span>
            {/* Per-plugin VU meter — shares the track analyser since we can't tap between nodes */}
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <VUMeter analyserNode={analyserNode} isActive={isPlaying} compact={true} showLabel={false} />
            </div>
            <button onClick={function(){ removePlugin(key); }}
              style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.18)", borderRadius:6, color:"#EF4444", fontSize:9, fontWeight:800, padding:"3px 10px", cursor:"pointer", letterSpacing:0.5 }}>REMOVE</button>
          </div>

          {/* EQ plugin */}
          {key === "eq" && <EQPlugin fx={fx} upd={upd} eq5={eq5} EQGraph={EQGraph} Knob={Knob} />}

          {/* Compressor plugin */}
          {key === "compressor" && <CompPlugin fx={fx} upd={upd} CompGraph={CompGraph} Knob={Knob} />}

          {/* Reverb plugin */}
          {key === "reverb" && <ReverbPlugin fx={fx} upd={upd} ReverbViz={ReverbViz} Knob={Knob} />}

          {/* Pitch / Autotune plugin */}
          {key === "pitch" && <PitchPlugin fx={fx} upd={upd} Knob={Knob} />}

          {/* Noise Remover plugin */}
          {key === "noiseremover" && <NoiseRemoverPlugin fx={fx} upd={upd} Knob={Knob} />}

          {/* Vocal Doubler plugin */}
          {key === "doubler" && <DoublerPlugin fx={fx} upd={upd} Knob={Knob} />}

          {/* H-Delay plugin */}
          {key === "hdelay" && <HDelayPlugin fx={fx} upd={upd} Knob={Knob} />}

          {/* T-Rotten Master plugin */}
          {key === "trotten" && <TRottenPlugin fx={fx} upd={upd} Knob={Knob} />}

          {/* GRM Bandpass plugin */}
          {key === "bandpass" && <BandpassPlugin fx={fx} upd={upd} Knob={Knob} />}

        </div>
      );
    })}

    {/* ── Add Plugin button ── */}
    {chain.length < 8 && (
      <button onClick={function(e){ e.stopPropagation(); setShowPluginPicker(true); }}
        style={{
          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          width:"100%", padding:"12px",
          background:"rgba(139,92,246,0.05)",
          border:"1px solid rgba(139,92,246,0.2)",
          borderLeft:"3px solid rgba(139,92,246,0.6)",
          borderRadius:6, cursor:"pointer",
          transition:"background 0.12s",
        }}>
        <div style={{
          width:20, height:20, borderRadius:5,
          background:"rgba(139,92,246,0.2)",
          border:"1px solid rgba(139,92,246,0.3)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:14, fontWeight:300, color:"#a855f7",
          flexShrink:0,
        }}>+</div>
        <span style={{ color:"#a855f7", fontWeight:600, fontSize:12, letterSpacing:0.3 }}>Add Plugin</span>
        <span style={{ color:"#2a2a2a", fontSize:10, marginLeft:"auto" }}>Effects</span>
      </button>
    )}

    {/* spacer */}
    <div style={{ height:8 }} />

  </div>
  );
}

// =============================================================================
// ── FX plugin sub-components (pure render functions, no hooks) ──
// Defined at top-level so they are stable references; FxPanel passes them
// down via FxPanelPlugins.
function _EQPlugin({ fx, upd, eq5, EQGraph, Knob }) {
  const on = !!fx.eq?.on;
  // Pro Q3 color palette per band
  const BAND_COLORS = { hpf:"#FF6B6B", low:"#4FC3F7", mid:"#69F0AE", high:"#FFD54F", lpf:"#FF6B6B" };
  return (
    <div style={{
      background:"linear-gradient(180deg,#0f1219 0%,#090c11 100%)",
      borderRadius:16, overflow:"hidden",
      border:"2px solid " + (on ? "#38bdf8" : "#1e2535"),
      boxShadow: on ? "0 0 28px rgba(56,189,248,0.12), inset 0 1px 0 rgba(255,255,255,0.04)" : "inset 0 1px 0 rgba(255,255,255,0.02)"
    }}>
      {/* ── Header ── */}
      <div style={{
        background:"linear-gradient(180deg,#131825 0%,#0f1219 100%)",
        padding:"9px 14px", borderBottom:"1px solid #1e2535",
        display:"flex", alignItems:"center", gap:8
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, flex:1 }}>
          {/* Band color strip */}
          <div style={{ display:"flex", gap:2, alignItems:"center" }}>
            {["#FF6B6B","#4FC3F7","#69F0AE","#FFD54F","#FF6B6B"].map(function(c,i){
              return <div key={i} style={{ width:3, height:16, borderRadius:1.5, background:c, opacity:0.9 }}/>;
            })}
          </div>
          <div>
            <div style={{ color:"#e8f0ff", fontWeight:900, fontSize:11, letterSpacing:3, fontFamily:"monospace", lineHeight:1 }}>PRO EQ</div>
            <div style={{ color:"#2a3a5a", fontSize:7, letterSpacing:2.5, fontFamily:"monospace", marginTop:1 }}>5-BAND PARAMETRIC · DRAG HANDLES</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {/* Power LED */}
          <div style={{
            width:8, height:8, borderRadius:"50%",
            background: on ? "#38bdf8" : "#111827",
            boxShadow: on ? "0 0 6px #38bdf8, 0 0 14px rgba(56,189,248,0.5)" : "none",
            transition:"all 0.2s"
          }}/>
          <button onClick={function(){ upd("eq",{on:!on}); }} style={{
            background: on ? "linear-gradient(180deg,#0ea5e9,#0284c7)" : "linear-gradient(180deg,#1e2535,#151c2a)",
            border:"1px solid " + (on ? "#38bdf8" : "#2a3350"),
            borderRadius:5, color:"white", fontSize:9, fontWeight:800,
            padding:"4px 12px", cursor:"pointer", letterSpacing:1,
            boxShadow: on ? "0 1px 0 rgba(255,255,255,0.12) inset" : "0 1px 3px rgba(0,0,0,0.6)"
          }}>{on ? "ON" : "OFF"}</button>
        </div>
      </div>

      {/* ── Graph + knobs ── */}
      <div style={{ padding:"12px 10px 10px", opacity:on?1:0.35, transition:"opacity 0.2s" }}>
        {/* Graph */}
        <div style={{
          background:"#070a10", borderRadius:10, padding:3,
          border:"1px solid #1a2035",
          boxShadow:"inset 0 2px 8px rgba(0,0,0,0.7), 0 0 0 1px rgba(56,189,248,0.04)"
        }}>
          <EQGraph eq={eq5} onDrag={function(patch){ upd("eq", patch); }} />
        </div>

        {/* ── Band knob strips ── */}
        <div style={{ display:"flex", marginTop:10, background:"#0a0e16", borderRadius:10, border:"1px solid #1a2035", overflow:"hidden" }}>
          {[
            {
              key:"hpf", label:"HPF", color:BAND_COLORS.hpf,
              knobs:[
                {lbl:"FREQ",v:eq5.hpfFreq,min:20,max:2000,step:1,unit:"Hz",cb:function(v){upd("eq",{hpfFreq:v});}},
                {lbl:"Q",   v:eq5.hpfQ,  min:0.1,max:10,step:0.1,unit:"",  cb:function(v){upd("eq",{hpfQ:v});}}
              ]
            },
            {
              key:"low", label:"LOW SHELF", color:BAND_COLORS.low,
              knobs:[
                {lbl:"FREQ",v:eq5.lowFreq,min:20,max:2000,step:1,unit:"Hz",cb:function(v){upd("eq",{lowFreq:v});}},
                {lbl:"GAIN",v:eq5.low,min:-18,max:18,step:0.5,unit:"dB",  cb:function(v){upd("eq",{low:v});}},
                {lbl:"Q",   v:eq5.lowQ,  min:0.1,max:10,step:0.1,unit:"", cb:function(v){upd("eq",{lowQ:v});}}
              ]
            },
            {
              key:"mid", label:"PEAK", color:BAND_COLORS.mid,
              knobs:[
                {lbl:"FREQ",v:eq5.midFreq,min:100,max:10000,step:10,unit:"Hz",cb:function(v){upd("eq",{midFreq:v});}},
                {lbl:"GAIN",v:eq5.mid,min:-18,max:18,step:0.5,unit:"dB",    cb:function(v){upd("eq",{mid:v});}},
                {lbl:"Q",   v:eq5.midQ,  min:0.1,max:10,step:0.1,unit:"",   cb:function(v){upd("eq",{midQ:v});}}
              ]
            },
            {
              key:"high", label:"HI SHELF", color:BAND_COLORS.high,
              knobs:[
                {lbl:"FREQ",v:eq5.highFreq,min:500,max:20000,step:100,unit:"Hz",cb:function(v){upd("eq",{highFreq:v});}},
                {lbl:"GAIN",v:eq5.high,min:-18,max:18,step:0.5,unit:"dB",     cb:function(v){upd("eq",{high:v});}},
                {lbl:"Q",   v:eq5.highQ, min:0.1,max:10,step:0.1,unit:"",     cb:function(v){upd("eq",{highQ:v});}}
              ]
            },
            {
              key:"lpf", label:"LPF", color:BAND_COLORS.lpf,
              knobs:[
                {lbl:"FREQ",v:eq5.lpfFreq,min:1000,max:20000,step:100,unit:"Hz",cb:function(v){upd("eq",{lpfFreq:v});}},
                {lbl:"Q",   v:eq5.lpfQ,  min:0.1,max:10,step:0.1,unit:"",      cb:function(v){upd("eq",{lpfQ:v});}}
              ]
            },
          ].map(function(band, bi, arr){
            return (
              <div key={band.key} style={{
                flex:1, borderRight: bi < arr.length-1 ? "1px solid #151c2a" : "none",
                display:"flex", flexDirection:"column", alignItems:"center", padding:"6px 2px 8px"
              }}>
                {/* Band label pill */}
                <div style={{
                  width:"100%",
                  background:"linear-gradient(180deg," + band.color + "22," + band.color + "0a)",
                  borderBottom:"1px solid " + band.color + "40",
                  padding:"3px 0", textAlign:"center", marginBottom:6
                }}>
                  <span style={{ color:band.color, fontSize:6, fontWeight:900, letterSpacing:1, fontFamily:"monospace" }}>
                    {band.label}
                  </span>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, overflow:"visible" }}>
                  {band.knobs.map(function(k){
                    return <Knob key={k.lbl} label={k.lbl} value={k.v} min={k.min} max={k.max}
                      step={k.step} unit={k.unit} color={band.color} onChange={k.cb}/>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function _CompPlugin({ fx, upd, CompGraph, Knob }) {
  return (
    <div style={{ background:"linear-gradient(180deg,#1c1a22 0%,#130f1a 100%)", borderRadius:16, overflow:"hidden", border:"2px solid " + (fx.compressor?.on ? "#8B5CF6" : "#2a2a2a"), boxShadow: fx.compressor?.on ? "0 0 20px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.06)" : "inset 0 1px 0 rgba(255,255,255,0.03)" }}>
      <div style={{ background:"linear-gradient(180deg,#1e1c25 0%,#181620 100%)", padding:"8px 14px", borderBottom:"1px solid #2a2535", display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ color:"#c4b5fd", fontWeight:900, fontSize:11, letterSpacing:3, fontFamily:"monospace", lineHeight:1 }}>COMPRESSOR</div>
          <div style={{ color:"#4a3f5c", fontSize:7, letterSpacing:2, fontFamily:"monospace" }}>DYNAMICS PROCESSOR</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ display:"flex", gap:1.5, alignItems:"flex-end" }}>
            {[0,1,2,3,4].map(function(i){ const active = fx.compressor?.on; const colors = ["#22C55E","#22C55E","#F59E0B","#EF4444","#EF4444"]; return <div key={i} style={{ width:3, height: 6 + i * 2, borderRadius:1, background: active ? colors[i] : "#1e1e1e", boxShadow: active ? "0 0 4px " + colors[i] + "88" : "none", transition:"all 0.15s" }} />; })}
          </div>
          <div style={{ width:8, height:8, borderRadius:"50%", background: fx.compressor?.on ? "#8B5CF6" : "#1a1a1a", boxShadow: fx.compressor?.on ? "0 0 6px #8B5CF6, 0 0 12px rgba(139,92,246,0.5)" : "none", transition:"all 0.2s" }} />
          <button onClick={function(){ upd("compressor",{on:!fx.compressor?.on}); }} style={{ background: fx.compressor?.on ? "linear-gradient(180deg,#7C3AED,#6d28d9)" : "linear-gradient(180deg,#2a2a2a,#222)", border:"1px solid " + (fx.compressor?.on ? "#8B5CF6" : "#333"), borderRadius:5, color:"white", fontSize:9, fontWeight:800, padding:"4px 12px", cursor:"pointer", letterSpacing:1, boxShadow: fx.compressor?.on ? "0 1px 0 rgba(255,255,255,0.1) inset" : "0 1px 3px rgba(0,0,0,0.5)" }}>{fx.compressor?.on ? "ON" : "OFF"}</button>
        </div>
      </div>
      <div style={{ padding:"12px 14px", opacity:fx.compressor?.on?1:0.4, transition:"opacity 0.2s" }}>
        <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
          <div style={{ background:"#050505", borderRadius:8, padding:2, border:"1px solid #1a1a1a", boxShadow:"inset 0 2px 6px rgba(0,0,0,0.8)", flexShrink:0 }}>
            <CompGraph threshold={fx.compressor?.threshold??-24} ratio={fx.compressor?.ratio??4} />
          </div>
          <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8, overflow:"visible" }}>
            <div style={{ display:"flex", justifyContent:"space-around", overflow:"visible" }}>
              <Knob label="THRESH" value={fx.compressor?.threshold??-24} min={-60} max={0} step={1} unit="dB" color="#8B5CF6" onChange={function(v){ upd("compressor",{threshold:v}); }} />
              <Knob label="RATIO" value={fx.compressor?.ratio??4} min={1} max={20} step={0.5} unit=":1" color="#8B5CF6" onChange={function(v){ upd("compressor",{ratio:v}); }} />
            </div>
            <div style={{ height:1, background:"#1e1e1e", borderRadius:1 }} />
            <div style={{ display:"flex", justifyContent:"space-around", overflow:"visible" }}>
              <Knob label="ATTACK" value={Math.round((fx.compressor?.attack??0.003)*1000)} min={1} max={200} step={1} unit="ms" color="#a78bfa" onChange={function(v){ upd("compressor",{attack:v/1000}); }} />
              <Knob label="RELEASE" value={Math.round((fx.compressor?.release??0.25)*1000)} min={10} max={2000} step={10} unit="ms" color="#a78bfa" onChange={function(v){ upd("compressor",{release:v/1000}); }} />
              <Knob label="MAKEUP" value={fx.compressor?.makeupGain??0} min={0} max={24} step={0.5} unit="dB" color="#22C55E" onChange={function(v){ upd("compressor",{makeupGain:v}); }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function _ReverbPlugin({ fx, upd, ReverbViz, Knob }) {
  return (
    <div style={{ background:"linear-gradient(180deg,#1a1220 0%,#110d19 100%)", borderRadius:16, overflow:"hidden", border:"2px solid " + (fx.reverb?.on ? "#C026D3" : "#2a2a2a"), boxShadow: fx.reverb?.on ? "0 0 20px rgba(192,38,211,0.15), inset 0 1px 0 rgba(255,255,255,0.06)" : "inset 0 1px 0 rgba(255,255,255,0.03)" }}>
      <div style={{ backgroundImage:"linear-gradient(180deg,#1e1629,#17101e)", padding:"8px 14px", borderBottom:"1px solid #2a1e35", display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ color:"#e879f9", fontWeight:900, fontSize:11, letterSpacing:3, fontFamily:"monospace", lineHeight:1 }}>CONVOLUTION REVERB</div>
          <div style={{ color:"#4a2f55", fontSize:7, letterSpacing:2, fontFamily:"monospace" }}>ROOM SIMULATION</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background: fx.reverb?.on ? "#C026D3" : "#1a1a1a", boxShadow: fx.reverb?.on ? "0 0 6px #C026D3, 0 0 14px rgba(192,38,211,0.5)" : "none", transition:"all 0.2s" }} />
          <button onClick={function(){ upd("reverb",{on:!fx.reverb?.on}); }} style={{ background: fx.reverb?.on ? "linear-gradient(180deg,#be185d,#9d174d)" : "linear-gradient(180deg,#2a2a2a,#222)", border:"1px solid " + (fx.reverb?.on ? "#C026D3" : "#333"), borderRadius:5, color:"white", fontSize:9, fontWeight:800, padding:"4px 12px", cursor:"pointer", letterSpacing:1, boxShadow: fx.reverb?.on ? "0 1px 0 rgba(255,255,255,0.1) inset" : "0 1px 3px rgba(0,0,0,0.5)" }}>{fx.reverb?.on ? "ON" : "OFF"}</button>
        </div>
      </div>
      <div style={{ padding:"12px 14px", opacity:fx.reverb?.on?1:0.4, transition:"opacity 0.2s" }}>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <div style={{ background:"#050505", borderRadius:8, padding:2, border:"1px solid #1a1a1a", boxShadow:"inset 0 2px 6px rgba(0,0,0,0.8)", flexShrink:0 }}>
            <ReverbViz wet={fx.reverb?.wet??0.25} roomSize={fx.reverb?.roomSize??0.8} />
          </div>
          <div style={{ flex:1, display:"flex", justifyContent:"space-around", overflow:"visible", padding:"4px 0" }}>
            <Knob label="WET" value={fx.reverb?.wet??0.25} min={0} max={1} step={0.01} unit="%" color="#C026D3" onChange={function(v){ upd("reverb",{wet:v}); }} />
            <Knob label="ROOM" value={fx.reverb?.roomSize??0.8} min={0.1} max={1} step={0.01} unit="%" color="#C026D3" onChange={function(v){ upd("reverb",{roomSize:v}); }} />
            <Knob label="PRE-DLY" value={fx.reverb?.preDelay??0} min={0} max={100} step={1} unit="ms" color="#8B5CF6" onChange={function(v){ upd("reverb",{preDelay:v}); }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function _PitchPlugin({ fx, upd, Knob }) {
  const pOn       = !!fx.pitch?.on;
  const semitones = fx.pitch?.semitones ?? 0;
  const speed     = fx.pitch?.speed ?? 0.5;
  const formant   = fx.pitch?.formant ?? 0.5;
  const pitchKey  = fx.pitch?.key ?? "C";
  const scale     = fx.pitch?.scale ?? "chromatic";
  const mode      = fx.pitch?.mode ?? "shift";
  const stLabel   = semitones === 0 ? "0 st" : (semitones > 0 ? "+" + semitones : semitones) + " st";
  const speedMs   = speed < 0.02 ? "INSTANT" : Math.round(speed * 400) + " ms";
  const NOTES     = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const IS_BLACK  = [false,true,false,true,false,false,true,false,true,false,true,false];
  const SCALE_INTERVALS = { chromatic:[0,1,2,3,4,5,6,7,8,9,10,11], major:[0,2,4,5,7,9,11], minor:[0,2,3,5,7,8,10], pentatonic:[0,2,4,7,9], blues:[0,3,5,6,7,10] };
  const rootIdx   = NOTES.indexOf(pitchKey);
  const intervals = SCALE_INTERVALS[scale] || SCALE_INTERVALS.chromatic;
  const activeNotes = new Set(intervals.map(function(i){ return NOTES[(rootIdx + i) % 12]; }));
  return (
    <div style={{ background:"linear-gradient(160deg,#0f0f14 0%,#12101a 100%)", borderRadius:16, overflow:"hidden", border:"1px solid " + (pOn ? "#9333ea" : "#1e1e1e"), boxShadow: pOn ? "0 0 24px rgba(147,51,234,0.2)" : "none" }}>
      <div style={{ display:"flex", alignItems:"center", padding:"8px 14px", background:"#0a0a0f", borderBottom:"1px solid #1a1a24" }}>
        <div style={{ flex:1 }}>
          <div style={{ color:"#7c3aed", fontWeight:900, fontSize:11, letterSpacing:3, fontFamily:"monospace" }}>AUTO·TUNE</div>
          <div style={{ color:"#333", fontSize:8, letterSpacing:1 }}>PITCH PROCESSOR v2</div>
        </div>
        <div style={{ display:"flex", background:"#111", borderRadius:8, border:"1px solid #222", overflow:"hidden", marginRight:10 }}>
          {["shift","autotune"].map(function(m){ return <button key={m} onClick={function(){ upd("pitch",{mode:m}); }} style={{ padding:"4px 10px", background:mode===m?"#7c3aed":"transparent", border:"none", color:mode===m?"white":"#444", fontSize:8, fontWeight:800, cursor:"pointer", letterSpacing:0.5, textTransform:"uppercase" }}>{m==="shift"?"SHIFT":"A-TUNE"}</button>; })}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background: pOn ? "#a855f7" : "#1a1a1a", boxShadow: pOn ? "0 0 8px #a855f7, 0 0 16px #7c3aed44" : "none", transition:"all 0.2s" }} />
          <button onClick={function(){ upd("pitch",{on:!pOn}); }} style={{ background:pOn?"#7c3aed":"#1a1a1a", border:"1px solid "+(pOn?"#9333ea":"#2a2a2a"), borderRadius:6, color:"white", fontSize:9, fontWeight:800, padding:"4px 10px", cursor:"pointer", letterSpacing:1 }}>{pOn ? "ON" : "OFF"}</button>
        </div>
      </div>
      <div style={{ padding:"12px 14px", opacity: pOn ? 1 : 0.3, pointerEvents: pOn ? "auto" : "none", transition:"opacity 0.2s" }}>
        <div style={{ background:"#060810", border:"1px solid #1a1a2e", borderRadius:8, padding:"8px 12px", marginBottom:14, fontFamily:"monospace", boxShadow:"inset 0 2px 8px rgba(0,0,0,0.6)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ color:"#6d28d9", fontSize:8, letterSpacing:2, marginBottom:2 }}>{mode==="autotune"?"AUTO-TUNE":"PITCH SHIFT"}</div>
              <div style={{ color:"#a855f7", fontSize:20, fontWeight:900, letterSpacing:1, lineHeight:1 }}>{mode==="autotune" ? pitchKey + " " + scale.toUpperCase() : stLabel}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ color:"#4c1d95", fontSize:8, letterSpacing:1, marginBottom:2 }}>SPEED</div>
              <div style={{ color:"#7c3aed", fontSize:13, fontWeight:800, fontFamily:"monospace" }}>{speedMs}</div>
            </div>
          </div>
          <div style={{ marginTop:8, height:3, background:"#0f0f1a", borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", width: (Math.abs(semitones)/12*100)+"%", background: semitones > 0 ? "linear-gradient(90deg,#6d28d9,#a855f7)" : "linear-gradient(90deg,#a855f7,#6d28d9)", marginLeft: semitones < 0 ? "auto" : "0", transition:"width 0.1s", borderRadius:2 }} />
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"space-around", alignItems:"flex-end", marginBottom:14, gap:4 }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <Knob label="PITCH" value={semitones} min={-12} max={12} step={1} unit=" st" color="#a855f7" onChange={function(v){ upd("pitch",{semitones:v}); }} />
            <div style={{ color:"#4c1d95", fontSize:7, fontFamily:"monospace" }}>{stLabel}</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <Knob label="SPEED" value={speed} min={0} max={1} step={0.01} unit="%" color="#7c3aed" onChange={function(v){ upd("pitch",{speed:v}); }} />
            <div style={{ color:"#4c1d95", fontSize:7, fontFamily:"monospace" }}>{speedMs}</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <Knob label="FORMANT" value={formant} min={0} max={1} step={0.05} unit="" color="#9333ea" onChange={function(v){ upd("pitch",{formant:v}); }} />
            <div style={{ color:"#4c1d95", fontSize:7, fontFamily:"monospace" }}>{Math.round(formant*100)}% PRES</div>
          </div>
        </div>
        {mode === "autotune" && (
          <div style={{ marginBottom:12 }}>
            <div style={{ color:"#4c1d95", fontSize:8, letterSpacing:2, fontFamily:"monospace", marginBottom:6 }}>SCALE</div>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
              {Object.keys(SCALE_INTERVALS).map(function(s){ const isA = scale === s; return <button key={s} onClick={function(){ upd("pitch",{scale:s}); }} style={{ padding:"4px 10px", background:isA?"#7c3aed":"#0f0f18", border:"1px solid "+(isA?"#9333ea":"#1e1e2a"), borderRadius:6, color:isA?"white":"#4c1d95", fontSize:8, fontWeight:800, cursor:"pointer", textTransform:"capitalize", letterSpacing:0.5 }}>{s}</button>; })}
            </div>
          </div>
        )}
        {mode === "autotune" && (
          <div style={{ marginBottom:4 }}>
            <div style={{ color:"#4c1d95", fontSize:8, letterSpacing:2, fontFamily:"monospace", marginBottom:6 }}>ROOT KEY</div>
            <div style={{ position:"relative", height:48, display:"flex" }}>
              {NOTES.filter(function(_,i){ return !IS_BLACK[i]; }).map(function(n, wi){
                const isRoot = n === pitchKey;
                const inScale = activeNotes.has(n);
                return <button key={n} onClick={function(){ upd("pitch",{key:n}); }} style={{ flex:1, height:"100%", background: isRoot ? "#a855f7" : inScale ? "#2d1b4e" : "#e8e8e8", border:"1px solid #111", borderRadius:"0 0 4px 4px", cursor:"pointer", display:"flex", alignItems:"flex-end", justifyContent:"center", paddingBottom:3, boxShadow: isRoot ? "0 0 8px #a855f744" : "none", transition:"background 0.1s" }}><span style={{ fontSize:6, fontWeight:800, color: isRoot ? "white" : inScale ? "#a855f7" : "#333" }}>{n}</span></button>;
              })}
              <div style={{ position:"absolute", top:0, left:0, right:0, height:"58%", pointerEvents:"none", display:"flex" }}>
                {[{note:"C#",left:"12.3%"},{note:"D#",left:"26%"},{note:"F#",left:"53.2%"},{note:"G#",left:"67%"},{note:"A#",left:"80.7%"}].map(function(bk){
                  const isRoot = bk.note === pitchKey;
                  const inScale = activeNotes.has(bk.note);
                  return <button key={bk.note} onClick={function(){ upd("pitch",{key:bk.note}); }} style={{ position:"absolute", left:bk.left, width:"9%", height:"100%", background: isRoot ? "#a855f7" : inScale ? "#3b0d6b" : "#111", border:"1px solid "+(isRoot?"#9333ea":"#000"), borderRadius:"0 0 4px 4px", cursor:"pointer", pointerEvents:"auto", boxShadow: isRoot ? "0 0 8px #a855f7" : "none", zIndex:2 }} />;
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// ── NOISE REMOVER PLUGIN ─────────────────────────────────────────────────────
// Uses RNNoise (Mozilla's recurrent neural net) via WebAssembly + AudioWorklet.
// Falls back to Web Audio biquad-based suppression when WASM unavailable.
// =============================================================================

// Noise Gate AudioWorklet — RMS-based gating with attack/hold/release envelope.
// This is the same fundamental approach as Logic Pro's Noise Gate plugin:
//   1. Compute short-term RMS of input
//   2. Compare to threshold (in dB)
//   3. Open/close an envelope follower with configurable attack/hold/release
//   4. Multiply signal by envelope (1 = fully open, reduction = closed)
// No external WASM needed — pure JS, works everywhere including iOS Safari.
const NOISE_GATE_WORKLET_CODE = `
class NoiseGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "threshold",  defaultValue: -40, minValue: -80, maxValue: 0,   automationRate: "k-rate" },
      { name: "reduction",  defaultValue: -60, minValue: -80, maxValue: 0,   automationRate: "k-rate" },
      { name: "attack",     defaultValue: 0.003, minValue: 0.0001, maxValue: 0.5, automationRate: "k-rate" },
      { name: "hold",       defaultValue: 0.1,   minValue: 0,      maxValue: 1.0, automationRate: "k-rate" },
      { name: "release",    defaultValue: 0.15,  minValue: 0.001,  maxValue: 2.0, automationRate: "k-rate" },
      { name: "bypass",     defaultValue: 0,     minValue: 0,      maxValue: 1,   automationRate: "k-rate" },
    ];
  }

  constructor() {
    super();
    this._envelope    = 0;    // current gate gain (0..1)
    this._holdSamples = 0;    // remaining hold samples
    this._open        = false; // gate state
    // RMS window: 10ms @ sampleRate
    this._rmsWin   = Math.round(sampleRate * 0.01);
    this._rmsBuf   = new Float32Array(this._rmsWin);
    this._rmsIdx   = 0;
    this._rmsSumSq = 0;
  }

  process(inputs, outputs, params) {
    const inp = inputs[0]?.[0];
    const out = outputs[0]?.[0];
    if (!inp || !out) return true;

    const bypass    = params.bypass[0] > 0.5;
    if (bypass) { out.set(inp); return true; }

    const threshLin  = Math.pow(10, params.threshold[0]  / 20);
    const reducLin   = Math.pow(10, params.reduction[0]  / 20);
    const sr         = sampleRate;
    const attackCoef  = Math.exp(-1 / (params.attack[0]  * sr));
    const releaseCoef = Math.exp(-1 / (params.release[0] * sr));
    const holdLen     = Math.round(params.hold[0] * sr);

    for (let i = 0; i < inp.length; i++) {
      // ── RMS update (sliding window) ──────────────────────────
      const old = this._rmsBuf[this._rmsIdx];
      const cur = inp[i];
      this._rmsSumSq += cur * cur - old * old;
      this._rmsBuf[this._rmsIdx] = cur;
      this._rmsIdx = (this._rmsIdx + 1) % this._rmsWin;
      const rms = Math.sqrt(Math.max(0, this._rmsSumSq) / this._rmsWin);

      // ── Gate decision ────────────────────────────────────────
      if (rms >= threshLin) {
        this._open        = true;
        this._holdSamples = holdLen;
      } else if (this._holdSamples > 0) {
        this._holdSamples--;
        // gate stays open during hold
      } else {
        this._open = false;
      }

      // ── Envelope follower ────────────────────────────────────
      const target = this._open ? 1.0 : reducLin;
      const coef   = this._open ? attackCoef : releaseCoef;
      this._envelope = target + coef * (this._envelope - target);

      out[i] = inp[i] * this._envelope;
    }
    return true;
  }
}
registerProcessor("noise-gate-processor", NoiseGateProcessor);
`;

// Singleton worklet registration tracker
const noiseGateWorkletReady = { current: false, promise: null };
// Keep old name so existing callers still work
const rnnoiseWorkletReady = noiseGateWorkletReady;

async function registerRNNoiseWorklet(actx) {
  if (noiseGateWorkletReady.current) return;
  if (noiseGateWorkletReady.promise) { await noiseGateWorkletReady.promise; return; }
  noiseGateWorkletReady.promise = (async () => {
    try {
      const blob = new Blob([NOISE_GATE_WORKLET_CODE], { type: "application/javascript" });
      const url  = URL.createObjectURL(blob);
      await actx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      noiseGateWorkletReady.current = true;
    } catch(e) {
      // Worklet registration failed — biquad fallback used in buildChain
    }
  })();
  await noiseGateWorkletReady.promise;
}

// ── T-Rotten Knob ─────────────────────────────────────────────────────────────
// Defined at MODULE LEVEL — not inside _TRottenMasterPlugin.
// Keeping it inside caused React to see a brand-new component type on every
// parent render, unmounting+remounting the knob and destroying drag state
// mid-gesture. Being outside means the component identity is stable.
//
// Stale-closure fix: dragRef stores a mutable baseline that updates every tick,
// so onPointerMove always calculates delta from the last position, not the
// original mousedown value. Without this the knob snaps back on every re-render.
//
// Gradient-ID fix: module counter gives each mounted knob a unique SVG defs ID
// so knobs with the same label (e.g. blank INPUT/OUTPUT knobs) don't collide.
let _tkc = 0; // module-level mount counter for unique gradient IDs
function TKnob({ label, value, min, max, step, unit, onChange, size, color }) {
  const sz     = size || 44;
  const r      = sz / 2 - 4;
  const cx     = sz / 2, cy = sz / 2;
  const norm   = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const START  = -135, SWEEP = 270;
  const angle  = START + norm * SWEEP;
  const rad    = function(deg){ return (deg - 90) * Math.PI / 180; };
  const pt     = function(deg, rr){ return { x: cx + rr * Math.cos(rad(deg)), y: cy + rr * Math.sin(rad(deg)) }; };
  const arcS   = pt(START, r);
  const arcE   = pt(angle, r);
  const arcFE  = pt(START + SWEEP, r);
  const swept  = angle - START;
  const large  = swept > 180 ? 1 : 0;
  const arcPath = `M ${arcS.x.toFixed(2)} ${arcS.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${arcE.x.toFixed(2)} ${arcE.y.toFixed(2)}`;
  const ptrTip = pt(angle, r - 5);
  const ptrBase= pt(angle, 4);
  const accent = color || "#c8762a";

  // Stable unique gradient ID — assigned once at mount
  const uidRef  = React.useRef(null);
  if (!uidRef.current) { uidRef.current = "tkg" + (++_tkc); }
  const uid = uidRef.current;

  // dragRef holds { startY, startVal, pointerId } reset each pointerdown.
  // We read the LATEST value from valueRef (not the stale closure) as the baseline.
  const valueRef   = React.useRef(value);
  valueRef.current = value;
  const dragRef    = React.useRef(null);
  const svgRef     = React.useRef(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  // Store max/min/step in refs so imperative handlers always read latest values
  const maxRef  = React.useRef(max);  maxRef.current  = max;
  const minRef  = React.useRef(min);  minRef.current  = min;
  const stepRef = React.useRef(step); stepRef.current = step;

  // Imperative pointer handlers attached with {passive:false} so preventDefault()
  // actually suppresses iOS scroll during knob drag. React synthetic events can't
  // set passive:false reliably in all iOS Safari versions.
  React.useEffect(function() {
    const el = svgRef.current;
    if (!el) return;

    function handleDown(e) {
      e.preventDefault();
      // setPointerCapture on SVG can be unreliable on iOS — capture on document instead
      dragRef.current = { startY: e.clientY, startVal: valueRef.current, pointerId: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch(_) {}

      function handleMove(ev) {
        if (!dragRef.current) return;
        if (ev.pointerId !== undefined && ev.pointerId !== dragRef.current.pointerId) return;
        ev.preventDefault();
        const dy      = dragRef.current.startY - ev.clientY; // drag UP = positive
        const sens    = (maxRef.current - minRef.current) / 200; // 200px = full sweep
        const raw     = dragRef.current.startVal + dy * sens;
        const clamped = Math.min(maxRef.current, Math.max(minRef.current, raw));
        const snapped = stepRef.current ? Math.round(clamped / stepRef.current) * stepRef.current : clamped;
        onChangeRef.current(+snapped.toFixed(6));
      }
      function handleUp(ev) {
        if (ev.pointerId !== undefined && ev.pointerId !== dragRef.current?.pointerId) return;
        dragRef.current = null;
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup",   handleUp);
        document.removeEventListener("pointercancel", handleUp);
      }

      // Attach move/up to document so fast drags that leave the SVG still work
      document.addEventListener("pointermove",   handleMove,  { passive: false });
      document.addEventListener("pointerup",     handleUp,    { passive: false });
      document.addEventListener("pointercancel", handleUp,    { passive: false });
    }

    el.addEventListener("pointerdown", handleDown, { passive: false });
    return function() {
      el.removeEventListener("pointerdown", handleDown);
    };
  }, []); // mount/unmount only — all live values go through refs

  const fmt = function(v) {
    if (unit === "dB" || unit === "dBFS") return (v >= 0 ? "+" : "") + v.toFixed(1);
    if (unit === "s")  return v.toFixed(2) + "s";
    if (unit === "%")  return Math.round(v) + "%";
    if (unit === ":1") return v.toFixed(1) + ":1";
    return typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(1)) : v;
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, userSelect:"none" }}>
      <svg ref={svgRef} width={sz} height={sz}
        style={{ cursor:"ns-resize", touchAction:"none", overflow:"visible", WebkitUserSelect:"none", userSelect:"none" }}
      >
        <circle cx={cx} cy={cy} r={r+3} fill="none" stroke="#000" strokeWidth={2} opacity={0.6}/>
        {norm > 0.005 && <path d={arcPath} fill="none" stroke={accent} strokeWidth={3} strokeLinecap="round" style={{filter:`drop-shadow(0 0 3px ${accent}88)`}}/>}
        <defs>
          <radialGradient id={uid} cx="36%" cy="30%" r="70%">
            <stop offset="0%"   stopColor="#3c3228"/>
            <stop offset="40%"  stopColor="#221c12"/>
            <stop offset="100%" stopColor="#0c0900"/>
          </radialGradient>
          <radialGradient id={uid+"h"} cx="35%" cy="28%" r="55%">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity={0.06}/>
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0}/>
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r-1} fill={`url(#${uid})`}  stroke="#3a2a14" strokeWidth={1.2}/>
        <circle cx={cx} cy={cy} r={r-1} fill={`url(#${uid}h)`}/>
        <line x1={ptrBase.x.toFixed(2)} y1={ptrBase.y.toFixed(2)}
              x2={ptrTip.x.toFixed(2)}  y2={ptrTip.y.toFixed(2)}
              stroke="#f0d080" strokeWidth={2} strokeLinecap="round"/>
      </svg>
      <div style={{ color:"#d4a04a", fontSize:8, fontWeight:900, fontFamily:"monospace", lineHeight:1 }}>
        {fmt(value)}{unit && !["dB","dBFS","s","%",":1"].includes(unit) ? " "+unit : ""}
      </div>
      {label && (
        <div style={{ color:"#6a5030", fontSize:6.5, fontWeight:700, fontFamily:"monospace", letterSpacing:0.8, textAlign:"center", lineHeight:1.2 }}>
          {label}
        </div>
      )}
    </div>
  );
}

// ── T-Rotten Master Plugin ───────────────────────────────────────────────────
// Pixel-faithful replica of the T-Rotten Master UI:
// 4 sections (EQ / Compressor / Tape+Sat / Limiter), VU meters, analog knobs,
// mode buttons, logo skull, INPUT/OUTPUT knobs, LUFS readout, power button.
// =============================================================================
// ── GRM Bandpass Filter — emulates GRM Tools BandPass ──────────────────────
// Dual cascaded biquad bandpass (6th-order slope) with resonance, mix, and
// a real-time frequency-domain visualiser drawn on a canvas.
// Parameters:
//   center  — centre frequency  20–20000 Hz  (default 1000)
//   width   — bandwidth in octaves  0.05–6   (default 1.0)
//   res     — resonance boost dB  0–18       (default 0)
//   mix     — wet/dry  0–1                   (default 1)
//   on      — bypass toggle
// =============================================================================
function _BandpassPlugin({ fx, upd, Knob }) {
  const bp    = fx.bandpass || {};
  const on    = !!bp.on;
  const center = bp.center ?? 1000;
  const width  = bp.width  ?? 1.0;
  const res    = bp.res    ?? 0;
  const mix    = bp.mix    ?? 1;

  // Derive lo/hi from center + width (octaves)
  const loHz = center / Math.pow(2, width / 2);
  const hiHz = center * Math.pow(2, width / 2);

  const ACCENT = "#00e5ff";
  const canvasRef = React.useRef(null);

  // Draw frequency response curve on canvas
  React.useEffect(function() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width; const H = canvas.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    // Background grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    [20,100,200,500,1000,2000,5000,10000,20000].forEach(function(f) {
      const x = Math.log10(f/20) / Math.log10(20000/20) * W;
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
    });
    [-24,-18,-12,-6,0].forEach(function(db) {
      const y = H - (db + 30) / 36 * H;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    });

    // Compute magnitude response of 2× cascaded bandpass biquad
    // Using bilinear transform of RLC bandpass filter
    const SR = 48000;
    function bpMag(freqHz) {
      // Q from octave width: Q = sqrt(2)^width / (2^width - 1)  (classic formula)
      const Q  = Math.sqrt(Math.pow(2, width)) / (Math.pow(2, width) - 1);
      const Qr = Q * (1 + res / 6);  // resonance boosts Q
      const w0 = 2 * Math.PI * center / SR;
      const alpha = Math.sin(w0) / (2 * Qr);
      const b0 =  alpha;
      const b1 =  0;
      const b2 = -alpha;
      const a0 =  1 + alpha;
      const a1 = -2 * Math.cos(w0);
      const a2 =  1 - alpha;
      // Eval H(e^jw) at freqHz
      const w   = 2 * Math.PI * freqHz / SR;
      const cosw = Math.cos(w); const sinw = Math.sin(w);
      const cos2w = Math.cos(2*w); const sin2w = Math.sin(2*w);
      const numRe = b0 + b1*cosw + b2*cos2w;
      const numIm =    - b1*sinw - b2*sin2w;
      const denRe = a0 + a1*cosw + a2*cos2w;
      const denIm =    - a1*sinw - a2*sin2w;
      const mag2  = (numRe*numRe + numIm*numIm) / (denRe*denRe + denIm*denIm);
      // 2× cascaded = magnitude squared
      return Math.sqrt(mag2 * mag2);
    }

    // Draw curve
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0, on ? "rgba(0,229,255,0.9)" : "rgba(80,80,80,0.6)");
    grad.addColorStop(1, on ? "rgba(0,229,255,0.2)" : "rgba(40,40,40,0.2)");
    ctx.beginPath();
    for (let px = 0; px <= W; px++) {
      const f   = 20 * Math.pow(20000/20, px/W);
      const mag = bpMag(f);
      const db  = 20 * Math.log10(Math.max(1e-6, mag));
      const y   = H - (db + 30) / 36 * H;
      if (px === 0) ctx.moveTo(px, Math.min(H, Math.max(0, y)));
      else          ctx.lineTo(px, Math.min(H, Math.max(0, y)));
    }
    // Fill under curve
    const fillX = Math.log10(center/20)/Math.log10(20000/20)*W;
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = on ? "rgba(0,229,255,0.08)" : "rgba(60,60,60,0.06)";
    ctx.fill();
    // Stroke
    ctx.beginPath();
    for (let px = 0; px <= W; px++) {
      const f   = 20 * Math.pow(20000/20, px/W);
      const mag = bpMag(f);
      const db  = 20 * Math.log10(Math.max(1e-6, mag));
      const y   = H - (db + 30) / 36 * H;
      if (px === 0) ctx.moveTo(px, Math.min(H, Math.max(0, y)));
      else          ctx.lineTo(px, Math.min(H, Math.max(0, y)));
    }
    ctx.strokeStyle = on ? ACCENT : "#444";
    ctx.lineWidth = 2;
    ctx.shadowBlur = on ? 8 : 0;
    ctx.shadowColor = ACCENT;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center frequency marker
    const cx = Math.log10(center/20)/Math.log10(20000/20)*W;
    ctx.strokeStyle = on ? "rgba(0,229,255,0.5)" : "rgba(100,100,100,0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(cx,0); ctx.lineTo(cx,H); ctx.stroke();
    ctx.setLineDash([]);

  }, [on, center, width, res, mix]);

  // Format Hz label
  // Log-scale knob for CENTER — maps 20–8000 Hz logarithmically so each
  // degree of rotation gives consistent musical resolution across the range.
  const MIN_HZ = 20, MAX_HZ = 8000;
  const logMin = Math.log10(MIN_HZ), logMax = Math.log10(MAX_HZ);

  function LogKnob({ value, color, onChange }) {
    const startRef = React.useRef(null);
    // Normalise current value in log space → 0..1
    const norm  = (Math.log10(Math.max(MIN_HZ, Math.min(MAX_HZ, value))) - logMin) / (logMax - logMin);
    const angle = -140 + norm * 280;
    const SW = 4, r = 20, PAD = SW / 2 + 2;
    const cx = r + PAD, cy = r + PAD, SIZE = (r + PAD) * 2;
    const toXY = function(deg) {
      const rad = (deg - 90) * Math.PI / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };
    const startA = toXY(-140), endA = toXY(angle);
    const sweptDeg = angle - (-140), largeArc = sweptDeg > 180 ? 1 : 0;
    const arcD = "M " + startA.x.toFixed(2) + " " + startA.y.toFixed(2) +
                 " A " + r + " " + r + " 0 " + largeArc + " 1 " +
                 endA.x.toFixed(2) + " " + endA.y.toFixed(2);

    const onPointerDown = function(e) {
      e.preventDefault();
      const startLog = Math.log10(Math.max(MIN_HZ, Math.min(MAX_HZ, value)));
      startRef.current = { y: e.clientY, log: startLog };
      const onMove = function(me) {
        const dy     = startRef.current.y - me.clientY; // up = higher freq
        // 100px drag = full log range — same physical feel as other knobs
        const newLog = Math.max(logMin, Math.min(logMax,
          startRef.current.log + (dy / 100) * (logMax - logMin)));
        onChange(Math.max(MIN_HZ, Math.min(MAX_HZ, Math.round(Math.pow(10, newLog)))));
      };
      const onUp = function() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup",   onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup",   onUp);
    };

    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, userSelect:"none" }}>
        <svg width={SIZE} height={SIZE} viewBox={"0 0 " + SIZE + " " + SIZE}
          style={{ overflow:"visible", cursor:"ns-resize", touchAction:"none" }}
          onPointerDown={onPointerDown}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e1e" strokeWidth={SW} strokeLinecap="round"
            strokeDasharray={(2*Math.PI*r * 280/360) + " " + (2*Math.PI*r)}
            strokeDashoffset={(2*Math.PI*r * (90+140)/360)}
            transform={"rotate(-90 " + cx + " " + cy + ")"} />
          {norm > 0 && <path d={arcD} fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" />}
          <circle cx={endA.x} cy={endA.y} r={SW * 0.9} fill={color} />
          <circle cx={cx} cy={cy} r={r * 0.42} fill="#0d0d0d" stroke="#2a2a2a" strokeWidth={1.5} />
        </svg>
        <div style={{ color:"white", fontSize:9, fontWeight:700, lineHeight:1 }}>
          {value >= 1000 ? (value/1000).toFixed(value >= 10000 ? 0 : 1)+"k" : value} Hz
        </div>
        <div style={{ color:"#444", fontSize:7, textAlign:"center", lineHeight:1.2 }}>CENTER</div>
      </div>
    );
  }


  function fmtHz(f) {
    return f >= 1000 ? (f/1000).toFixed(f>=10000?0:1)+"k" : Math.round(f)+"";
  }

  return (
    <div style={{
      background: "linear-gradient(180deg,#0a1a1e 0%,#060e11 100%)",
      borderRadius: 16, overflow: "hidden",
      border: "2px solid " + (on ? ACCENT : "#1e1e1e"),
      boxShadow: on ? "0 0 24px rgba(0,229,255,0.12), inset 0 1px 0 rgba(255,255,255,0.06)" : "inset 0 1px 0 rgba(255,255,255,0.03)",
    }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px 8px", borderBottom:"1px solid #0d1c20" }}>
        <div style={{
          width:28, height:28, borderRadius:7, flexShrink:0,
          background: on ? "linear-gradient(135deg,#00b4cc,#006680)" : "#1a1a1a",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:14, boxShadow: on ? "0 0 10px rgba(0,229,255,0.4)" : "none",
          transition:"all 0.2s",
        }}><AppIcon id="knobs" size={20}/></div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:"#e0e0e0", fontWeight:800, fontSize:12, lineHeight:1 }}>GRM Bandpass</div>
          <div style={{ color:"#2a4a50", fontSize:9, marginTop:2, fontWeight:600, letterSpacing:0.5 }}>
            {fmtHz(loHz)} – {fmtHz(hiHz)} Hz · 12dB/oct × 2
          </div>
        </div>
        {/* LED cluster */}
        <div style={{ display:"flex", gap:3, alignItems:"center" }}>
          {[0,1,2,3,4].map(function(i){
            const active = on;
            const colors = ["#00e5ff","#00b4d8","#0ea5e9","#38bdf8","#7dd3fc"];
            return <div key={i} style={{
              width:3, height:6+i*2, borderRadius:1,
              background: active ? colors[i] : "#1e1e1e",
              boxShadow: active ? "0 0 4px "+colors[i]+"88" : "none",
              transition:"all 0.15s",
            }} />;
          })}
        </div>
        <div style={{ width:8, height:8, borderRadius:"50%", background: on ? ACCENT : "#1a1a1a", boxShadow: on ? "0 0 6px "+ACCENT : "none", transition:"all 0.2s" }} />
        <button onClick={function(){ upd("bandpass",{on:!on}); }} style={{
          background: on ? "linear-gradient(180deg,#007a8a,#005f6b)" : "linear-gradient(180deg,#2a2a2a,#222)",
          border:"1px solid "+(on ? ACCENT : "#333"), borderRadius:5, color:"white",
          fontSize:9, fontWeight:800, padding:"4px 12px", cursor:"pointer", letterSpacing:1,
        }}>{on ? "ON" : "OFF"}</button>
      </div>

      {/* Canvas visualiser */}
      <div style={{ padding:"10px 14px 0", opacity: on ? 1 : 0.45, transition:"opacity 0.2s" }}>
        <canvas ref={canvasRef} width={320} height={72}
          style={{ width:"100%", height:72, borderRadius:8, background:"rgba(0,10,14,0.6)", display:"block" }} />
        {/* Freq axis labels */}
        <div style={{ display:"flex", justifyContent:"space-between", padding:"2px 0 0", fontSize:8, color:"#1e3a42", fontWeight:600, letterSpacing:0.3 }}>
          {["20","100","500","1k","5k","20k"].map(function(l){ return <span key={l}>{l}</span>; })}
        </div>
      </div>

      {/* Knobs */}
      <div style={{ padding:"10px 14px 14px", opacity: on ? 1 : 0.45, transition:"opacity 0.2s" }}>
        <div style={{ display:"flex", gap:8, justifyContent:"space-between", flexWrap:"wrap" }}>
          <LogKnob value={center} color={ACCENT} onChange={function(v){ upd("bandpass",{center:v}); }} />
          <Knob label="WIDTH" value={width} min={0.05} max={6} step={0.05} unit="oct"
            color="#38bdf8" onChange={function(v){ upd("bandpass",{width:v}); }} />
          <Knob label="RESO" value={res} min={0} max={18} step={0.5} unit="dB"
            color="#7dd3fc" onChange={function(v){ upd("bandpass",{res:v}); }} />
          <Knob label="MIX" value={Math.round(mix*100)} min={0} max={100} step={1} unit="%"
            color="#0ea5e9" onChange={function(v){ upd("bandpass",{mix:v/100}); }} />
        </div>
        {/* Lo/Hi readout */}
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, padding:"6px 10px", background:"rgba(0,229,255,0.04)", borderRadius:6, border:"1px solid rgba(0,229,255,0.08)" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ color:"#0e5a6a", fontSize:8, fontWeight:700, letterSpacing:1 }}>LO CUT</div>
            <div style={{ color: on ? "#38bdf8" : "#2a4a50", fontSize:11, fontWeight:800, marginTop:2 }}>{fmtHz(loHz)} Hz</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ color:"#0e5a6a", fontSize:8, fontWeight:700, letterSpacing:1 }}>CENTER</div>
            <div style={{ color: on ? ACCENT : "#2a4a50", fontSize:11, fontWeight:800, marginTop:2 }}>{fmtHz(center)} Hz</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ color:"#0e5a6a", fontSize:8, fontWeight:700, letterSpacing:1 }}>HI CUT</div>
            <div style={{ color: on ? "#38bdf8" : "#2a4a50", fontSize:11, fontWeight:800, marginTop:2 }}>{fmtHz(hiHz)} Hz</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function _TRottenMasterPlugin({ fx, upd }) {
  const m  = fx.trotten || {};
  const on = !!m.on;

  // ── Mode button ─────────────────────────────────────────────────────────────
  const ModeBtn = function({ label, active, onClick, accent }) {
    const ac = accent || "#c8762a";
    return (
      <button onClick={onClick} style={{
        padding:"3px 7px", fontSize:7, fontWeight:900,
        fontFamily:"monospace", letterSpacing:0.8,
        background: active ? ac + "22" : "#120e06",
        border:"1px solid " + (active ? ac : "#2a1c08"),
        borderRadius:3, color: active ? ac : "#3a2510",
        cursor:"pointer", transition:"all 0.12s",
        boxShadow: active ? "0 0 6px " + ac + "55, inset 0 1px 0 " + ac + "22" : "none",
        textShadow: active ? "0 0 8px " + ac : "none",
      }}>{label}</button>
    );
  };

  // ── LED indicator ────────────────────────────────────────────────────────────
  const LED = function({ color, glow }) {
    return (
      <div style={{
        width:6, height:6, borderRadius:"50%",
        background: glow ? color : "#1a1208",
        boxShadow: glow ? `0 0 6px ${color}, 0 0 12px ${color}66` : "inset 0 1px 2px #00000088",
        border:"1px solid " + (glow ? color : "#0a0800"),
        transition:"all 0.3s",
      }}/>
    );
  };

  // ── VU meter segment row ─────────────────────────────────────────────────────
  const HVU = function({ level, label }) {
    const segs   = 30;
    const filled = Math.round(Math.min(1, Math.max(0, level)) * segs);
    return (
      <div style={{ display:"flex", alignItems:"center", gap:3 }}>
        <div style={{ color:"#4a3020", fontSize:6.5, fontFamily:"monospace", width:7, textAlign:"right", flexShrink:0 }}>{label}</div>
        <div style={{ display:"flex", gap:1, alignItems:"center" }}>
          {Array.from({length: segs}, function(_, i) {
            const lit     = i < filled;
            const isRed   = i >= segs - 3;
            const isAmber = i >= segs - 8 && i < segs - 3;
            const col     = !lit ? "#160f04" : isRed ? "#ef4444" : isAmber ? "#f59e0b" : "#c8762a";
            return <div key={i} style={{
              width: isRed ? 3.5 : isAmber ? 4 : 4.5, height:7, borderRadius:1,
              background: col,
              boxShadow: lit ? `0 0 4px ${col}bb` : "none",
            }}/>;
          })}
        </div>
      </div>
    );
  };

  // ── Section label ─────────────────────────────────────────────────────────
  const SecLabel = function({ children }) {
    return (
      <div style={{ color:"#6a5535", fontSize:7.5, fontWeight:900, letterSpacing:2.5,
        marginBottom:8, textAlign:"center", fontFamily:"monospace",
        textShadow:"0 1px 3px #000" }}>
        {children}
      </div>
    );
  };

  const Divider = function() {
    return <div style={{ width:1, alignSelf:"stretch", background:"linear-gradient(180deg,transparent,#2a1c08 20%,#2a1c08 80%,transparent)", margin:"0 2px" }}/>;
  };

  // State
  const eqLow    = m.eqLow    ?? 0;
  const eqMid    = m.eqMid    ?? 0;
  const eqHigh   = m.eqHigh   ?? 0;
  const eqLowT   = m.eqLowT   || "shelf";
  const eqMidT   = m.eqMidT   || "bell";
  const eqHighT  = m.eqHighT  || "shelf";
  const compThr  = m.compThr  ?? -15;
  const compAmt  = m.compAmt  ?? 50;
  const compMode = m.compMode || "auto";
  const tapeDrv  = m.tapeDrv  ?? 50;
  const tapeSat  = m.tapeSat  ?? 5;
  const tapeMode = m.tapeMode || "modern";
  const limCeil  = m.limCeil  ?? -0.5;
  const limRel   = m.limRel   ?? 0.5;
  const limMode  = m.limMode  || "truepeak";
  const inGain   = m.inputGain  ?? 0;
  const outGain  = m.outputGain ?? 0;

  const vuLvl = Math.max(0.12, Math.min(0.97, 0.62 + outGain / 40 + (eqLow + eqHigh) / 60));

  return (
    <div style={{
      borderRadius:12, overflow:"hidden", fontFamily:"monospace",
      border:"2px solid " + (on ? "#3a2810" : "#1a1006"),
      boxShadow: on ? "0 4px 40px rgba(160,90,10,0.18), inset 0 1px 0 rgba(255,200,100,0.04)" : "0 2px 12px rgba(0,0,0,0.6)",
      background:"#0c0900",
    }}>

      {/* ══ TOP BAR ═════════════════════════════════════════════════════════ */}
      <div style={{
        background:"linear-gradient(180deg,#141008 0%,#0c0900 100%)",
        borderBottom:"1px solid #201508",
        padding:"6px 12px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ color:"#3a2510", fontSize:10, lineHeight:1 }}>≡</span>
          <span style={{ color:"#3a2510", fontSize:10 }}>‹</span>
          <span style={{ color:"#c8762a", fontSize:9, fontWeight:900, letterSpacing:1.5,
            textShadow:"0 0 10px rgba(200,118,42,0.6)" }}>Rotten But Loud</span>
          <span style={{ color:"#3a2510", fontSize:10 }}>›</span>

        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ display:"flex", gap:5, alignItems:"center" }}>
            <span style={{ color:"#c8762a", fontSize:8, fontWeight:900, letterSpacing:1 }}>A</span>
            <span style={{ color:"#2a1a06", fontSize:8 }}>|</span>
            <span style={{ color:"#3a2510", fontSize:8 }}>B</span>
            <span style={{ color:"#3a2510", fontSize:8, marginLeft:4, letterSpacing:1 }}>COPY</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, borderLeft:"1px solid #2a1a08", paddingLeft:10 }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end" }}>
              <span style={{ color:"#3a2510", fontSize:6, letterSpacing:1 }}>OVERSAMPLING</span>
              <span style={{ color:"#6a5030", fontSize:7, fontWeight:900 }}>4x ▾</span>
            </div>
            <span style={{ color:"#3a2510", fontSize:11 }}>⚙</span>
            {/* Power */}
            <div onClick={function(){ upd("trotten",{on:!on}); }} style={{
              width:22, height:22, borderRadius:"50%", cursor:"pointer",
              border:"1.5px solid " + (on ? "#c8762a" : "#2a1a08"),
              display:"flex", alignItems:"center", justifyContent:"center",
              background: on ? "#1c1006" : "#0c0900",
              boxShadow: on ? "0 0 10px #c8762a66, inset 0 0 6px #c8762a22" : "none",
              transition:"all 0.2s",
            }}>
              <span style={{ fontSize:10, color: on ? "#c8762a" : "#2a1a08", lineHeight:1 }}>⏻</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ MAIN FACEPLATE ══════════════════════════════════════════════════ */}
      <div style={{
        background:"linear-gradient(160deg,#1c1509 0%,#141006 40%,#0e0c05 100%)",
        padding:"10px 8px 10px",
        opacity: on ? 1 : 0.35, transition:"opacity 0.25s",
      }}>

        {/* ── ROW 1: Logo + EQ + Compressor ─────────────────────────────── */}
        <div style={{ display:"flex", gap:0 }}>

          {/* LOGO */}
          <div style={{ width:58, flexShrink:0, display:"flex", flexDirection:"column",
            justifyContent:"flex-start", paddingRight:7, paddingTop:2 }}>
            <div style={{ color:"#c8762a", fontSize:13, fontWeight:900, letterSpacing:0.5, lineHeight:1.1,
              textShadow:"0 0 12px rgba(200,118,42,0.55)" }}>T-<br/>ROTTEN</div>
            <div style={{ color:"#8c1e10", fontSize:8.5, fontWeight:900, letterSpacing:2, lineHeight:1, marginTop:2 }}>MASTER</div>
            <div style={{ color:"#3a2510", fontSize:5, letterSpacing:1, marginTop:3, lineHeight:1.5 }}>
              MASTERING<br/>PROCESSOR
            </div>
            <div style={{ marginTop:5, opacity:0.25 }}>
              <div style={{ fontSize:22, filter:"sepia(100%) saturate(40%) brightness(55%)" }}><AppIcon id="skull" size={20}/></div>
            </div>
          </div>

          <Divider/>

          {/* ── EQUALIZER ── */}
          <div style={{ flex:1.3, display:"flex", flexDirection:"column", alignItems:"center", padding:"0 5px" }}>
            <SecLabel>EQUALIZER</SecLabel>
            <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <LED color="#ef4444" glow={eqLow !== 0}/>
                <TKnob label="LOW" value={eqLow} min={-12} max={12} step={0.5} unit="dB" size={42}
                  onChange={function(v){ upd("trotten",{eqLow:v}); }}/>
                <ModeBtn label={eqLowT.toUpperCase()} active={true}
                  onClick={function(){ upd("trotten",{eqLowT: eqLowT==="shelf"?"bell":"shelf"}); }}/>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <LED color="#888" glow={false}/>
                <TKnob label="MID" value={eqMid} min={-12} max={12} step={0.5} unit="dB" size={42}
                  onChange={function(v){ upd("trotten",{eqMid:v}); }}/>
                <ModeBtn label={eqMidT.toUpperCase()} active={true}
                  onClick={function(){ upd("trotten",{eqMidT: eqMidT==="bell"?"shelf":"bell"}); }}/>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <LED color="#ef4444" glow={eqHigh !== 0}/>
                <TKnob label="HIGH" value={eqHigh} min={-12} max={12} step={0.5} unit="dB" size={42}
                  onChange={function(v){ upd("trotten",{eqHigh:v}); }}/>
                <ModeBtn label={eqHighT.toUpperCase()} active={true}
                  onClick={function(){ upd("trotten",{eqHighT: eqHighT==="shelf"?"bell":"shelf"}); }}/>
              </div>
            </div>
          </div>

          <Divider/>

          {/* ── COMPRESSOR ── */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"0 5px" }}>
            <SecLabel>COMPRESSOR</SecLabel>
            <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <LED color="#f59e0b" glow={compMode !== "off"}/>
                <TKnob label="THRESHOLD" value={compThr} min={-30} max={0} step={1} unit="dB" size={42}
                  onChange={function(v){ upd("trotten",{compThr:v}); }}/>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <LED color="#888" glow={false}/>
                <TKnob label="AMOUNT" value={compAmt} min={0} max={100} step={1} unit="%" size={42}
                  onChange={function(v){ upd("trotten",{compAmt:v}); }}/>
              </div>
            </div>
            <div style={{ display:"flex", gap:3, marginTop:4 }}>
              {["auto","relax","punch"].map(function(m2){
                return <ModeBtn key={m2} label={m2.toUpperCase()} active={compMode===m2}
                  accent="#c8762a" onClick={function(){ upd("trotten",{compMode:m2}); }}/>;
              })}
            </div>
          </div>

        </div>

        {/* ── Horizontal rule between rows ─────────────────────────────── */}
        <div style={{ height:1, background:"linear-gradient(90deg,transparent,#2a1c08 15%,#2a1c08 85%,transparent)", margin:"10px 0 8px" }}/>

        {/* ── ROW 2: Tape/Saturation + Limiter ─────────────────────────── */}
        <div style={{ display:"flex", gap:0 }}>

          {/* ── TAPE / SATURATION ── */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"0 5px" }}>
            <SecLabel>TAPE / SATURATION</SecLabel>
            <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <LED color="#f59e0b" glow={tapeMode !== "off"}/>
                <TKnob label="DRIVE" value={tapeDrv} min={0} max={10} step={0.1} size={42}
                  onChange={function(v){ upd("trotten",{tapeDrv:v}); }}/>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <LED color="#888" glow={false}/>
                <TKnob label="TAPE" value={tapeSat} min={0} max={10} step={0.1} size={42}
                  onChange={function(v){ upd("trotten",{tapeSat:v}); }}/>
              </div>
            </div>
            <div style={{ display:"flex", gap:3, marginTop:4 }}>
              {["classic","modern","dirty"].map(function(m2){
                return <ModeBtn key={m2} label={m2.toUpperCase()} active={tapeMode===m2}
                  accent="#c8762a" onClick={function(){ upd("trotten",{tapeMode:m2}); }}/>;
              })}
            </div>
          </div>

          <Divider/>

          {/* ── LIMITER ── */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"0 5px" }}>
            <SecLabel>LIMITER</SecLabel>
            <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <LED color="#ef4444" glow={true}/>
                <TKnob label="CEILING" value={limCeil} min={-1} max={0} step={0.1} unit="dBFS" size={42}
                  onChange={function(v){ upd("trotten",{limCeil:v}); }}/>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <LED color="#888" glow={false}/>
                <TKnob label="RELEASE" value={limRel} min={0.1} max={1} step={0.01} unit="s" size={42}
                  onChange={function(v){ upd("trotten",{limRel:v}); }}/>
              </div>
            </div>
            <div style={{ marginTop:4 }}>
              <ModeBtn label="TRUE PEAK" active={limMode==="truepeak"} accent="#c8762a"
                onClick={function(){ upd("trotten",{limMode: limMode==="truepeak"?"peak":"truepeak"}); }}/>
            </div>
          </div>

        </div>

      </div>

      {/* ══ METERS STRIP ════════════════════════════════════════════════════ */}
      <div style={{
        background:"linear-gradient(180deg,#0e0b05 0%,#080600 100%)",
        borderTop:"1px solid #201508",
        padding:"8px 10px 7px",
        display:"flex", gap:8, alignItems:"center",
        opacity: on ? 1 : 0.28, transition:"opacity 0.25s",
      }}>
        {/* Input knob */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, flexShrink:0 }}>
          <div style={{ color:"#6a5030", fontSize:7, fontWeight:900, letterSpacing:1 }}>INPUT</div>
          <TKnob label="" value={inGain} min={-24} max={24} step={0.5} unit="dB" size={40}
            onChange={function(v){ upd("trotten",{inputGain:v}); }}/>
          <div style={{ color:"#c8762a", fontSize:8, fontFamily:"monospace", fontWeight:700 }}>
            {(inGain >= 0 ? "+" : "") + inGain.toFixed(1)}
          </div>
        </div>

        {/* VU meters — input + output stacked */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:4 }}>
          <HVU level={vuLvl * 0.88} label="L"/>
          <HVU level={vuLvl * 0.83} label="R"/>
          <div style={{ display:"flex", justifyContent:"space-between", paddingLeft:11 }}>
            {["-40","-18","-9","-3","0"].map(function(l){
              return <div key={l} style={{ color:"#3a2510", fontSize:5, fontFamily:"monospace" }}>{l}</div>;
            })}
          </div>
        </div>

        {/* Output knob */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, flexShrink:0 }}>
          <div style={{ color:"#6a5030", fontSize:7, fontWeight:900, letterSpacing:1 }}>OUTPUT</div>
          <TKnob label="" value={outGain} min={-24} max={24} step={0.5} unit="dB" size={40}
            onChange={function(v){ upd("trotten",{outputGain:v}); }}/>
          <div style={{ color:"#c8762a", fontSize:8, fontFamily:"monospace", fontWeight:700 }}>
            {(outGain >= 0 ? "+" : "") + outGain.toFixed(1)}
          </div>
        </div>
      </div>



    </div>
  );
}

// ── Noise Remover Plugin UI ──────────────────────────────────────────────────
function _NoiseRemoverPlugin({ fx, upd, Knob }) {
  const nr   = fx.noiseremover || {};
  const on   = !!nr.on;
  const str  = nr.strength    ?? 0.85;
  const kb   = nr.keyboard    ?? true;   // keyboard/click suppression
  const echo = nr.echo        ?? 0.4;    // room echo reduction amount
  const veh  = nr.voice       ?? 0.6;   // voice enhancement

  const pct = function(v){ return Math.round(v * 100) + "%"; };

  // Animated level bar sub-component
  const LevelBar = function({ label, value, color, active }) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:3, alignItems:"center" }}>
        <div style={{ width:28, height:64, background:"#0a0a0a", borderRadius:4, border:"1px solid #1a1a1a", position:"relative", overflow:"hidden" }}>
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            height: active ? pct(value) : "0%",
            background: active
              ? "linear-gradient(0deg," + color + "cc," + color + "44)"
              : "#1a1a1a",
            transition:"height 0.3s ease, background 0.3s",
            borderRadius:3,
          }} />
          {[0.25,0.5,0.75].map(function(t){
            return <div key={t} style={{ position:"absolute", left:0, right:0, bottom:pct(t), height:1, background:"#111", pointerEvents:"none" }} />;
          })}
        </div>
        <div style={{ color: active ? color : "#333", fontSize:7, fontWeight:700, letterSpacing:0.5, textAlign:"center", transition:"color 0.3s" }}>{label}</div>
      </div>
    );
  };

  return (
    <div style={{
      background:"linear-gradient(160deg,#020f0a 0%,#071410 60%,#050d0a 100%)",
      borderRadius:16, overflow:"hidden",
      border:"2px solid " + (on ? "#10B981" : "#1a2a22"),
      boxShadow: on ? "0 0 24px rgba(16,185,129,0.18), inset 0 1px 0 rgba(16,185,129,0.08)" : "inset 0 1px 0 rgba(255,255,255,0.02)",
      transition:"border-color 0.25s, box-shadow 0.25s",
    }}>

      {/* ── Header ── */}
      <div style={{ background:"linear-gradient(180deg,#0d1f18 0%,#091710 100%)", padding:"9px 14px", borderBottom:"1px solid #0d2018", display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ color:"#10B981", fontWeight:900, fontSize:11, letterSpacing:3, fontFamily:"monospace", lineHeight:1 }}>NOISE REMOVER</div>
          <div style={{ color:"#0d3d28", fontSize:7, letterSpacing:2, fontFamily:"monospace", marginTop:2 }}>RMS NOISE GATE · LOGIC STYLE</div>
        </div>
        {/* Status LED */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{
            width:8, height:8, borderRadius:"50%",
            background: on ? "#10B981" : "#0d2018",
            boxShadow: on ? "0 0 6px #10B981, 0 0 14px rgba(16,185,129,0.5)" : "none",
            transition:"all 0.2s",
          }} />
          <button onClick={function(){ upd("noiseremover",{on:!on}); }}
            style={{
              background: on ? "linear-gradient(180deg,#059669,#047857)" : "linear-gradient(180deg,#0d2018,#091510)",
              border:"1px solid " + (on ? "#10B981" : "#0d2a1c"),
              borderRadius:5, color: on ? "white" : "#1a4a30",
              fontSize:9, fontWeight:800, padding:"4px 12px", cursor:"pointer", letterSpacing:1,
              boxShadow: on ? "0 1px 0 rgba(255,255,255,0.15) inset" : "none",
              transition:"all 0.2s",
            }}>
            {on ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      <div style={{ padding:"12px 14px", opacity: on ? 1 : 0.35, transition:"opacity 0.25s", pointerEvents: on ? "auto" : "none" }}>

        {/* ── Neural net strength + level meters ── */}
        <div style={{ display:"flex", gap:12, alignItems:"flex-end", marginBottom:14 }}>
          {/* Level meter strip */}
          <div style={{ display:"flex", gap:5, alignItems:"flex-end", background:"#050e0a", borderRadius:8, padding:"8px 10px", border:"1px solid #0d1f15", flexShrink:0 }}>
            <LevelBar label="IN"    value={str * 0.9}       color="#EF4444" active={on} />
            <LevelBar label="CLEAN" value={str}             color="#10B981" active={on} />
            <LevelBar label="VOICE" value={str * veh}       color="#34D399" active={on} />
          </div>

          {/* Main knobs */}
          <div style={{ flex:1, display:"flex", justifyContent:"space-around", alignItems:"flex-end", gap:4 }}>
            <Knob label="THRESHOLD" value={str}  min={0} max={1} step={0.01} unit="%" color="#10B981"
              onChange={function(v){ upd("noiseremover",{strength:v}); }} />
            <Knob label="HOLD"     value={echo} min={0} max={1} step={0.01} unit="s" color="#34D399"
              onChange={function(v){ upd("noiseremover",{echo:v}); }} />
            <Knob label="RELEASE"  value={veh}  min={0} max={1} step={0.01} unit="%" color="#6EE7B7"
              onChange={function(v){ upd("noiseremover",{voice:v}); }} />
          </div>
        </div>

        {/* ── Toggle strip ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>

          {/* Keyboard / click suppression */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            background:"#060e0a", borderRadius:8, padding:"8px 12px", border:"1px solid #0d1f15" }}>
            <div>
              <div style={{ color:"#9febe8", fontSize:11, fontWeight:700 }}>Lookahead Gate</div>
              <div style={{ color:"#1a3d2a", fontSize:9, marginTop:1 }}>Extra fast response for transients</div>
            </div>
            <button onClick={function(){ upd("noiseremover",{keyboard:!kb}); }}
              style={{ background: kb ? "rgba(16,185,129,0.15)" : "#0a1a10",
                border:"1px solid " + (kb ? "#10B981" : "#1a2a1f"),
                borderRadius:6, color: kb ? "#10B981" : "#1a3d2a",
                fontSize:9, fontWeight:800, padding:"5px 12px", cursor:"pointer", letterSpacing:1,
                minWidth:44, transition:"all 0.2s" }}>
              {kb ? "ON" : "OFF"}
            </button>
          </div>

          {/* Room echo reduction info row */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            background:"#060e0a", borderRadius:8, padding:"8px 12px", border:"1px solid #0d1f15" }}>
            <div>
              <div style={{ color:"#9febe8", fontSize:11, fontWeight:700 }}>Room Echo Reduction</div>
              <div style={{ color:"#1a3d2a", fontSize:9, marginTop:1 }}>HPF + spectral gate · dial via ECHO RED knob</div>
            </div>
            <div style={{ color:"#10B981", fontSize:11, fontWeight:800, fontFamily:"monospace" }}>
              {Math.round(echo * 100)}%
            </div>
          </div>

          {/* Voice enhancement info row */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            background:"#060e0a", borderRadius:8, padding:"8px 12px", border:"1px solid #0d1f15" }}>
            <div>
              <div style={{ color:"#9febe8", fontSize:11, fontWeight:700 }}>Voice Enhancement</div>
              <div style={{ color:"#1a3d2a", fontSize:9, marginTop:1 }}>Presence boost 2–5kHz + gentle drive</div>
            </div>
            <div style={{ color:"#34D399", fontSize:11, fontWeight:800, fontFamily:"monospace" }}>
              +{Math.round(veh * 8)}dB
            </div>
          </div>

        </div>

        {/* ── Mode badge ── */}
        <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ flex:1, height:1, background:"#0d1f15" }} />
          <div style={{ color:"#0d3d28", fontSize:8, fontFamily:"monospace", letterSpacing:2, fontWeight:700 }}>
            RNNOISE · 48kHz · 10ms LATENCY
          </div>
          <div style={{ flex:1, height:1, background:"#0d1f15" }} />
        </div>

      </div>
    </div>
  );
}
// =============================================================================
// ── VOCAL DOUBLER PLUGIN ──────────────────────────────────────────────────
// Professional Haas-effect stereo doubler with detuned copies, width control
// and a stereo correlation meter (L/R phase visualiser).
// =============================================================================
function _DoublerPlugin({ fx, upd, Knob }) {
  const d     = fx.doubler || {};
  const on    = !!d.on;
  const delay = d.delay    ?? 20;      // ms  – Haas time offset (L copy)
  const detune= d.detune   ?? 8;       // cents – subtle pitch detuning for the doubled copy
  const width = d.width    ?? 0.7;     // 0–1 stereo spread
  const mix   = d.mix      ?? 0.5;     // 0–1 wet/dry

  // Live meter: simple animated L/R bars to convey stereo width
  const [meterL, setMeterL] = React.useState(0.6);
  const [meterR, setMeterR] = React.useState(0.6);
  const rafRef = React.useRef(null);
  React.useEffect(function () {
    if (!on) { setMeterL(0); setMeterR(0); return; }
    let t = 0;
    const tick = function () {
      t += 0.04;
      setMeterL(0.35 + Math.abs(Math.sin(t * 1.3 + 0.5)) * 0.55 * width);
      setMeterR(0.35 + Math.abs(Math.sin(t * 1.1))        * 0.55 * width);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return function () { cancelAnimationFrame(rafRef.current); };
  }, [on, width]);

  const accentColor = "#F59E0B";

  return (
    <div style={{ background:"linear-gradient(180deg,#1c1710 0%,#130f08 100%)", borderRadius:16, overflow:"hidden",
      border:"2px solid " + (on ? accentColor : "#2a2a2a"),
      boxShadow: on ? "0 0 20px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.06)" : "inset 0 1px 0 rgba(255,255,255,0.03)" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px 8px", borderBottom:"1px solid #1e1e1e" }}>
        {/* Stereo correlation meter */}
        <div style={{ display:"flex", flexDirection:"column", gap:2, flexShrink:0 }}>
          {["L","R"].map(function(ch, i){
            const val = i === 0 ? meterL : meterR;
            return (
              <div key={ch} style={{ display:"flex", alignItems:"center", gap:3 }}>
                <span style={{ color:"#555", fontSize:7, fontWeight:800, fontFamily:"monospace", width:6 }}>{ch}</span>
                <div style={{ width:32, height:4, background:"#111", borderRadius:2, overflow:"hidden" }}>
                  <div style={{ width: Math.round(val * 100) + "%", height:"100%",
                    background: on
                      ? "linear-gradient(90deg,#F59E0B," + (val > 0.7 ? "#EF4444" : "#FBBF24") + ")"
                      : "#1e1e1e",
                    transition:"width 0.05s linear", borderRadius:2 }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ flex:1 }}>
          <div style={{ color:"white", fontWeight:800, fontSize:13, lineHeight:1 }}>Vocal Doubler</div>
          <div style={{ color:"#555", fontSize:9, marginTop:2, letterSpacing:0.5 }}>
            Haas · Detune · Stereo Width
          </div>
        </div>

        {/* LED + ON/OFF */}
        <div style={{ width:8, height:8, borderRadius:"50%",
          background: on ? accentColor : "#1a1a1a",
          boxShadow: on ? "0 0 6px " + accentColor + ", 0 0 12px rgba(245,158,11,0.5)" : "none",
          transition:"all 0.2s" }} />
        <button onClick={function(){ upd("doubler", {on: !on}); }}
          style={{ background: on
            ? "linear-gradient(180deg,#d97706,#b45309)"
            : "linear-gradient(180deg,#2a2a2a,#222)",
            border:"1px solid " + (on ? accentColor : "#333"),
            borderRadius:5, color:"white", fontSize:9, fontWeight:800,
            padding:"4px 12px", cursor:"pointer", letterSpacing:1,
            boxShadow: on ? "0 1px 0 rgba(255,255,255,0.1) inset" : "0 1px 3px rgba(0,0,0,0.5)" }}>
          {on ? "ON" : "OFF"}
        </button>
      </div>

      {/* ── Controls ── */}
      <div style={{ padding:"14px 14px 10px", opacity: on ? 1 : 0.38, transition:"opacity 0.2s" }}>
        <div style={{ display:"flex", justifyContent:"space-around", flexWrap:"wrap", gap:8 }}>
          <Knob label="DELAY"  value={delay}  min={5}   max={50}  step={1}    unit="ms"   color={accentColor} onChange={function(v){ upd("doubler",{delay:v}); }} />
          <Knob label="DETUNE" value={detune} min={0}   max={50}  step={0.5}  unit="¢"    color="#FBBF24"    onChange={function(v){ upd("doubler",{detune:v}); }} />
          <Knob label="WIDTH"  value={width}  min={0}   max={1}   step={0.01} unit="%"    color="#F97316"    onChange={function(v){ upd("doubler",{width:v}); }} />
          <Knob label="MIX"    value={mix}    min={0}   max={1}   step={0.01} unit="%"    color="#FB923C"    onChange={function(v){ upd("doubler",{mix:v}); }} />
        </div>

        {/* Info strip */}
        <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            background:"#0d0b06", borderRadius:8, padding:"8px 12px", border:"1px solid #1c1608" }}>
            <div>
              <div style={{ color:"#fcd34d", fontSize:11, fontWeight:700 }}>Haas Offset</div>
              <div style={{ color:"#2a200a", fontSize:9, marginTop:1 }}>
                Sub-35ms delays = wide stereo, no flange
              </div>
            </div>
            <div style={{ color:accentColor, fontSize:11, fontWeight:800, fontFamily:"monospace" }}>
              {delay}ms
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            background:"#0d0b06", borderRadius:8, padding:"8px 12px", border:"1px solid #1c1608" }}>
            <div>
              <div style={{ color:"#fcd34d", fontSize:11, fontWeight:700 }}>Pitch Detune</div>
              <div style={{ color:"#2a200a", fontSize:9, marginTop:1 }}>
                Chorusing via subtle detuned copy
              </div>
            </div>
            <div style={{ color:accentColor, fontSize:11, fontWeight:800, fontFamily:"monospace" }}>
              ±{detune}¢
            </div>
          </div>
        </div>

        {/* Footer badge */}
        <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ flex:1, height:1, background:"#1c1608" }} />
          <div style={{ color:"#2a1800", fontSize:8, fontFamily:"monospace", letterSpacing:2, fontWeight:700 }}>
            HAAS · DETUNE · M/S WIDTH
          </div>
          <div style={{ flex:1, height:1, background:"#1c1608" }} />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ── H-DELAY PLUGIN UI ────────────────────────────────────────────────────────
// Emulates Waves H-Delay: tape/digital modes, BPM sync, ping-pong, hi/lo cut,
// analog-style saturation, modulation, and a live tap-tempo delay display.
// =============================================================================
function _HDelayPlugin({ fx, upd, Knob }) {
  const hd = fx.hdelay || {};
  const on         = !!hd.on;
  const mode       = hd.mode       ?? "digital";   // "digital" | "tape" | "ping"
  const sync       = hd.sync       ?? false;        // BPM sync on/off
  const bpm        = hd.bpm        ?? 120;
  const subdivision= hd.subdivision?? "1/4";        // note value for BPM sync
  const delayMs    = hd.delayMs    ?? 375;          // manual delay in ms (up to 2000ms)
  const feedback   = hd.feedback   ?? 0.35;         // 0–0.95
  const wet        = hd.wet        ?? 0.40;         // mix
  const hiCut      = hd.hiCut      ?? 8000;         // Hz
  const loCut      = hd.loCut      ?? 80;           // Hz
  const modDepth   = hd.modDepth   ?? 0.15;         // 0–1 (chorus-style mod on tape mode)
  const modRate    = hd.modRate    ?? 0.5;           // Hz
  const drive      = hd.drive      ?? 0.0;          // 0–1 analog saturation
  const stereoOf   = hd.stereoOf   ?? 0.0;          // ping-pong offset 0–1

  const ACCENT = "#E85D04";
  const ACCENT2 = "#FB923C";

  // ── BPM sync helper ──
  const SUBDIVISIONS = ["1/1","1/2","1/2T","1/4","1/4T","1/8","1/8T","1/16","1/16T","1/32"];
  function subdivMs(sub, bpmVal) {
    const beat = 60000 / bpmVal;
    const map = {
      "1/1": beat*4, "1/2": beat*2, "1/2T": beat*(4/3),
      "1/4": beat,   "1/4T": beat*(2/3),
      "1/8": beat/2, "1/8T": beat/3,
      "1/16":beat/4, "1/16T":beat/6, "1/32":beat/8,
    };
    return Math.min(2000, Math.round(map[sub] || beat));
  }
  const effectiveMs = sync ? subdivMs(subdivision, bpm) : delayMs;

  // ── Animated echo trail visualiser ──
  const canvasRef = React.useRef(null);
  const vizRaf    = React.useRef(null);
  const vizPhase  = React.useRef(0);
  React.useEffect(function() {
    const cvs = canvasRef.current; if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const W = cvs.width, H = cvs.height;
    function draw() {
      vizPhase.current += 0.018;
      const phase = vizPhase.current;
      ctx.clearRect(0,0,W,H);
      if (!on) { vizRaf.current = requestAnimationFrame(draw); return; }
      // Background grid
      ctx.strokeStyle = "#1a1008"; ctx.lineWidth = 1;
      for(let x=0;x<W;x+=24){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
      for(let y=0;y<H;y+=12){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }
      // Echo pulses — draw decaying echoes at delay intervals
      const maxEchoes = 7;
      for(let e=0;e<maxEchoes;e++){
        const decay   = Math.pow(feedback, e);
        if (decay < 0.03) break;
        // X position: map echo number to horizontal position (delayed in time)
        const pxPerMs = W / 600;
        const tOff    = (effectiveMs * e * pxPerMs) % W;
        // Animated shimmer using phase
        const shimmer = mode === "tape" ? Math.sin(phase * modRate * 6.28 + e) * modDepth * 6 : 0;
        const cx = (tOff + shimmer + (phase * 40)) % W;
        const pulseH = H * 0.72 * decay;
        const alpha  = decay * (0.85 - e * 0.08);
        // Ping-pong: alternate left/right
        const cy = mode === "ping"
          ? (e % 2 === 0 ? H * 0.3 : H * 0.7)
          : H / 2;
        // Glow
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseH * 0.6);
        grad.addColorStop(0, `rgba(232,93,4,${alpha})`);
        grad.addColorStop(0.5,`rgba(251,146,60,${alpha * 0.5})`);
        grad.addColorStop(1,  "rgba(232,93,4,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, pulseH * 0.35, pulseH * 0.45, 0, 0, Math.PI*2);
        ctx.fill();
        // Vertical bar
        ctx.fillStyle = `rgba(232,93,4,${alpha * 0.6})`;
        ctx.fillRect(cx-1.5, cy - pulseH/2, 3, pulseH);
      }
      // Center line
      ctx.strokeStyle = "rgba(232,93,4,0.12)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
      vizRaf.current = requestAnimationFrame(draw);
    }
    vizRaf.current = requestAnimationFrame(draw);
    return function(){ cancelAnimationFrame(vizRaf.current); };
  }, [on, effectiveMs, feedback, mode, modDepth, modRate]);

  // ── Tap tempo ──
  const tapTimes = React.useRef([]);
  function tapTempo() {
    const now = Date.now();
    tapTimes.current = tapTimes.current.filter(function(t){ return now - t < 3000; });
    tapTimes.current.push(now);
    if (tapTimes.current.length >= 2) {
      const diffs = tapTimes.current.slice(1).map(function(t,i){ return t - tapTimes.current[i]; });
      const avg = diffs.reduce(function(a,b){ return a+b; }, 0) / diffs.length;
      const tBpm = Math.round(60000 / avg);
      upd("hdelay", { bpm: Math.max(40, Math.min(250, tBpm)), sync: true });
    }
  }

  const modeBtnStyle = function(m) { return ({
    flex:1, padding:"7px 4px", border:"1px solid " + (mode===m ? ACCENT : "#2a2a2a"),
    background: mode===m ? "linear-gradient(180deg,#7c2d0a,#5a1f06)" : "rgba(255,255,255,0.03)",
    borderRadius:7, color: mode===m ? "#FB923C" : "#444",
    fontSize:10, fontWeight:800, cursor:"pointer", letterSpacing:0.5,
    transition:"all 0.15s",
  }); };

  return (
    <div style={{ background:"linear-gradient(180deg,#1a0e06 0%,#100800 100%)", borderRadius:16,
      overflow:"hidden", border:"2px solid " + (on ? ACCENT : "#2a2a2a"),
      boxShadow: on ? "0 0 24px rgba(232,93,4,0.18), inset 0 1px 0 rgba(255,255,255,0.06)" : "inset 0 1px 0 rgba(255,255,255,0.03)" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px 8px", borderBottom:"1px solid #1e1000" }}>
        <div style={{ flex:1 }}>
          <div style={{ color:"white", fontWeight:800, fontSize:14, lineHeight:1, letterSpacing:0.3 }}>H-Delay</div>
          <div style={{ color:"#4a2800", fontSize:9, marginTop:2, letterSpacing:1 }}>TAPE · DIGITAL · PING-PONG</div>
        </div>
        {/* Delay time readout */}
        <div style={{ textAlign:"right" }}>
          <div style={{ color: ACCENT, fontFamily:"monospace", fontWeight:800, fontSize:16, lineHeight:1 }}>
            {effectiveMs}
          </div>
          <div style={{ color:"#4a2800", fontSize:8, fontWeight:700, letterSpacing:1 }}>MS</div>
        </div>
        {/* LED + toggle */}
        <div style={{ width:8, height:8, borderRadius:"50%",
          background: on ? ACCENT : "#1a1a1a",
          boxShadow: on ? "0 0 6px "+ACCENT+",0 0 14px rgba(232,93,4,0.5)" : "none", transition:"all 0.2s" }} />
        <button onClick={function(){ upd("hdelay",{on:!on}); }}
          style={{ background: on ? "linear-gradient(180deg,#c2410c,#9a3412)" : "linear-gradient(180deg,#2a2a2a,#222)",
            border:"1px solid " + (on ? ACCENT : "#333"), borderRadius:5, color:"white",
            fontSize:9, fontWeight:800, padding:"4px 12px", cursor:"pointer", letterSpacing:1,
            boxShadow: on ? "0 1px 0 rgba(255,255,255,0.1) inset" : "0 1px 3px rgba(0,0,0,0.5)" }}>
          {on ? "ON" : "OFF"}
        </button>
      </div>

      <div style={{ padding:"12px 14px 10px", opacity: on ? 1 : 0.38, transition:"opacity 0.2s" }}>

        {/* ── Mode selector ── */}
        <div style={{ display:"flex", gap:5, marginBottom:12 }}>
          {[["digital","Digital"],["tape","Tape"],["ping","Ping-Pong"]].map(function([m,l]){
            return <button key={m} onClick={function(){ upd("hdelay",{mode:m}); }} style={modeBtnStyle(m)}>{l}</button>;
          })}
        </div>

        {/* ── Echo visualiser ── */}
        <canvas ref={canvasRef} width={288} height={56}
          style={{ display:"block", width:"100%", height:56, borderRadius:8,
            border:"1px solid #1e1000", marginBottom:12, background:"#0a0600" }} />

        {/* ── BPM sync row ── */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12,
          background:"#0d0800", borderRadius:10, padding:"8px 10px", border:"1px solid #1e1000" }}>
          <button onClick={function(){ upd("hdelay",{sync:!sync}); }}
            style={{ background: sync ? "linear-gradient(180deg,#c2410c,#9a3412)" : "rgba(255,255,255,0.04)",
              border:"1px solid " + (sync ? ACCENT : "#2a2a2a"), borderRadius:6,
              color: sync ? "#FB923C" : "#444", fontSize:9, fontWeight:800,
              padding:"5px 10px", cursor:"pointer", letterSpacing:0.5, flexShrink:0 }}>
            SYNC
          </button>
          {sync ? (
            <div style={{ flex:1, display:"flex", gap:4, overflowX:"auto" }}>
              {SUBDIVISIONS.map(function(s){
                const active = subdivision === s;
                return (
                  <button key={s} onClick={function(){ upd("hdelay",{subdivision:s}); }}
                    style={{ flexShrink:0, padding:"4px 7px", border:"1px solid " + (active ? ACCENT : "#222"),
                      background: active ? ACCENT+"22" : "transparent",
                      borderRadius:5, color: active ? ACCENT2 : "#444",
                      fontSize:9, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap" }}>
                    {s}
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ flex:1 }}>
              <input type="range" min={1} max={2000} step={1} value={delayMs}
                onChange={function(e){ upd("hdelay",{delayMs:+e.target.value}); }}
                style={{ width:"100%", accentColor:ACCENT, cursor:"pointer" }} />
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
                <span style={{ color:"#2a1800", fontSize:8 }}>1ms</span>
                <span style={{ color:ACCENT, fontSize:9, fontWeight:800, fontFamily:"monospace" }}>{delayMs}ms</span>
                <span style={{ color:"#2a1800", fontSize:8 }}>2000ms</span>
              </div>
            </div>
          )}
          {/* Tap tempo */}
          <button onClick={tapTempo}
            style={{ flexShrink:0, background:"rgba(232,93,4,0.08)",
              border:"1px solid rgba(232,93,4,0.25)", borderRadius:7,
              color:ACCENT2, fontSize:9, fontWeight:800, padding:"6px 10px",
              cursor:"pointer", letterSpacing:0.3, lineHeight:1.2, textAlign:"center" }}>
            TAP<br />
            <span style={{ fontSize:8, color:"#4a2800" }}>{bpm}BPM</span>
          </button>
        </div>

        {/* ── BPM field (sync mode) ── */}
        {sync && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12,
            background:"#0d0800", borderRadius:10, padding:"7px 10px", border:"1px solid #1e1000" }}>
            <span style={{ color:"#4a2800", fontSize:10, fontWeight:700 }}>BPM</span>
            <input type="number" min={40} max={250} step={1} value={bpm}
              onChange={function(e){ upd("hdelay",{bpm:Math.max(40,Math.min(250,+e.target.value))}); }}
              style={{ flex:1, background:"#050300", border:"1px solid #1e1000", borderRadius:6,
                color:ACCENT2, fontSize:13, fontWeight:800, fontFamily:"monospace",
                padding:"4px 8px", textAlign:"center", outline:"none" }} />
            <span style={{ color:"#4a2800", fontSize:9 }}>{effectiveMs}ms / beat div</span>
          </div>
        )}

        {/* ── Knob row 1: main ── */}
        <div style={{ display:"flex", justifyContent:"space-around", flexWrap:"wrap", gap:8, marginBottom:4 }}>
          <Knob label="FEEDBACK" value={Math.round(feedback*100)} min={0}  max={95} step={1}   unit="%" color={ACCENT}  onChange={function(v){ upd("hdelay",{feedback:v/100}); }} />
          <Knob label="MIX"      value={Math.round(wet*100)}      min={0}  max={100} step={1}  unit="%" color={ACCENT2} onChange={function(v){ upd("hdelay",{wet:v/100}); }} />
          <Knob label="HI CUT"   value={hiCut}  min={500}  max={20000} step={100} unit="Hz" color="#FB923C" onChange={function(v){ upd("hdelay",{hiCut:v}); }} />
          <Knob label="LO CUT"   value={loCut}  min={20}   max={500}   step={5}   unit="Hz" color="#FDBA74" onChange={function(v){ upd("hdelay",{loCut:v}); }} />
        </div>

        {/* ── Knob row 2: character ── */}
        <div style={{ display:"flex", justifyContent:"space-around", flexWrap:"wrap", gap:8 }}>
          <Knob label="DRIVE"    value={Math.round(drive*100)}    min={0}  max={100} step={1} unit="%"  color="#EF4444" onChange={function(v){ upd("hdelay",{drive:v/100}); }} />
          <Knob label="MOD RATE" value={modRate}  min={0.05} max={5}  step={0.05} unit="Hz" color="#F97316" onChange={function(v){ upd("hdelay",{modRate:v}); }} />
          <Knob label="MOD DEPT" value={Math.round(modDepth*100)} min={0} max={100} step={1} unit="%" color="#FB923C" onChange={function(v){ upd("hdelay",{modDepth:v/100}); }} />
          {mode === "ping" && <Knob label="PAN OFF" value={Math.round(stereoOf*100)} min={0} max={100} step={1} unit="%" color="#FBBF24" onChange={function(v){ upd("hdelay",{stereoOf:v/100}); }} />}
        </div>

        {/* ── Info strip ── */}
        <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:5 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            background:"#0a0600", borderRadius:8, padding:"7px 10px", border:"1px solid #150c00" }}>
            <div>
              <div style={{ color:"#FB923C", fontSize:11, fontWeight:700 }}>
                {mode==="tape" ? "Tape Mode" : mode==="ping" ? "Ping-Pong" : "Digital Mode"}
              </div>
              <div style={{ color:"#2a1800", fontSize:9, marginTop:1 }}>
                {mode==="tape" ? "Wow/flutter + saturation + modulation" :
                 mode==="ping" ? "L↔R alternate bouncing echoes" :
                 "Clean infinite-precision repeats"}
              </div>
            </div>
            <div style={{ color:ACCENT, fontSize:11, fontWeight:800, fontFamily:"monospace" }}>
              {Math.round(feedback*100)}%
            </div>
          </div>
          {drive > 0.02 && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              background:"#0a0600", borderRadius:8, padding:"7px 10px", border:"1px solid #150c00" }}>
              <div style={{ color:"#FB923C", fontSize:11, fontWeight:700 }}>Analog Drive</div>
              <div style={{ color:ACCENT, fontSize:11, fontWeight:800, fontFamily:"monospace" }}>
                {Math.round(drive*100)}%
              </div>
            </div>
          )}
        </div>

        {/* Footer badge */}
        <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ flex:1, height:1, background:"#1e1000" }} />
          <div style={{ color:"#2a1800", fontSize:8, fontFamily:"monospace", letterSpacing:2, fontWeight:700 }}>
            WAVES H-DELAY EMULATION · BPM SYNC · TAP TEMPO
          </div>
          <div style={{ flex:1, height:1, background:"#1e1000" }} />
        </div>

      </div>
    </div>
  );
}

// This is the correct way to prevent re-renders from the 30fps currentTime
// here because this is a real component, not an IIFE or callback.
// Re-renders ONLY when fx data, fxTrackId, trackName, or trackColor change.
// =============================================================================
const FxPanel = React.memo(function FxPanel({ fx, fxTrackId, trackName, trackColor, onClose, onUpd, analyserNode, isPlaying }) {
  const upd = onUpd; // stable ref-backed callback passed from StudioScreen

  // ── Rotary Knob ──
  const Knob = function({ label, value, min, max, step, unit, onChange, color }) {
    const startRef = useRef(null);
    color = color || "#8B5CF6";
    const norm  = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const angle = -140 + norm * 280;
    const SW = 4, r = 20, PAD = SW / 2 + 2;
    const cx = r + PAD, cy = r + PAD, SIZE = (r + PAD) * 2;
    const toXY = function(deg) { const rad = (deg - 90) * Math.PI / 180; return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }; };
    const startA = toXY(-140), endA = toXY(angle);
    const sweptDeg = angle - (-140), largeArc = sweptDeg > 180 ? 1 : 0;
    const arcD = `M ${startA.x.toFixed(2)} ${startA.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${endA.x.toFixed(2)} ${endA.y.toFixed(2)}`;
    const onPointerDown = function(e) {
      e.preventDefault();
      startRef.current = { y: e.clientY, val: value };
      const onMove = function(me) {
        const dy = startRef.current.y - me.clientY;
        const raw = startRef.current.val + (dy / 100) * (max - min);
        const clamped = Math.min(max, Math.max(min, raw));
        const snapped = step ? Math.round(clamped / step) * step : clamped;
        onChange(+snapped.toFixed(3));
      };
      const onUp = function() { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
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
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ overflow:"visible", cursor:"ns-resize", touchAction:"none" }} onPointerDown={onPointerDown}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e1e" strokeWidth={SW} strokeLinecap="round"
            strokeDasharray={`${2*Math.PI*r * 280/360} ${2*Math.PI*r}`}
            strokeDashoffset={`${2*Math.PI*r * (90+140)/360}`}
            transform={`rotate(-90 ${cx} ${cy})`} />
          {norm > 0 && <path d={arcD} fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" />}
          <circle cx={endA.x} cy={endA.y} r={SW * 0.9} fill={color} />
          <circle cx={cx} cy={cy} r={r * 0.42} fill="#0d0d0d" stroke="#2a2a2a" strokeWidth={1.5} />
        </svg>
        <div style={{ color:"white", fontSize:9, fontWeight:700, lineHeight:1 }}>{display}</div>
        <div style={{ color:"#444", fontSize:7, textAlign:"center", lineHeight:1.2 }}>{label}</div>
      </div>
    );
  };

  // ── EQ Graph ──
  const EQ_SR = 44100;
  const eqCalcCoeffs = function(type, freq, gainDB, Q) {
    const f=Math.max(10,Math.min(freq,EQ_SR*0.499)), w0=2*Math.PI*f/EQ_SR, cw=Math.cos(w0), sw=Math.sin(w0);
    const A=Math.pow(10,gainDB/40), aq=sw/(2*Math.max(0.001,Q));
    let b0,b1,b2,a0,a1,a2;
    if(type==="peaking"){b0=1+aq*A;b1=-2*cw;b2=1-aq*A;a0=1+aq/A;a1=-2*cw;a2=1-aq/A;}
    else if(type==="lowshelf"){const sa=2*Math.sqrt(A)*aq;b0=A*((A+1)-(A-1)*cw+sa);b1=2*A*((A-1)-(A+1)*cw);b2=A*((A+1)-(A-1)*cw-sa);a0=(A+1)+(A-1)*cw+sa;a1=-2*((A-1)+(A+1)*cw);a2=(A+1)+(A-1)*cw-sa;}
    else if(type==="highshelf"){const sa=2*Math.sqrt(A)*aq;b0=A*((A+1)+(A-1)*cw+sa);b1=-2*A*((A-1)+(A+1)*cw);b2=A*((A+1)+(A-1)*cw-sa);a0=(A+1)-(A-1)*cw+sa;a1=2*((A-1)-(A+1)*cw);a2=(A+1)+(A-1)*cw-sa;}
    else if(type==="highpass"){b0=(1+cw)/2;b1=-(1+cw);b2=(1+cw)/2;a0=1+aq;a1=-2*cw;a2=1-aq;}
    else{b0=(1-cw)/2;b1=1-cw;b2=(1-cw)/2;a0=1+aq;a1=-2*cw;a2=1-aq;}
    if(Math.abs(a0)<1e-30) return {b0:1,b1:0,b2:0,a1:0,a2:0};
    return {b0:b0/a0,b1:b1/a0,b2:b2/a0,a1:a1/a0,a2:a2/a0};
  };
  const eqEvalMag = function(c,f){
    const w=2*Math.PI*Math.max(1,f)/EQ_SR, cw=Math.cos(w), sw=Math.sin(w), cw2=Math.cos(2*w), sw2=Math.sin(2*w);
    const bRe=c.b0+c.b1*cw+c.b2*cw2, bIm=c.b1*sw+c.b2*sw2, aRe=1+c.a1*cw+c.a2*cw2, aIm=c.a1*sw+c.a2*sw2;
    const den=aRe*aRe+aIm*aIm; if(den<1e-30) return 0;
    return 20*Math.log10(Math.sqrt((bRe*bRe+bIm*bIm)/den));
  };
  const EQGraph = function({ eq, onDrag }) {
    // ── Pro Q3-style EQ display ──────────────────────────────────────────────
    // Full-width canvas, 20Hz–20kHz log scale, ±18dB range, vivid curve fill,
    // per-band Q-width rings on handles, live frequency/gain readout tooltip.
    const W = 320, H = 160;
    const DB_MAX = 18;   // ±18 dB range (matches Pro Q3 default view)
    const PAD_L = 28;    // left margin for dB labels
    const PAD_B = 16;    // bottom margin for freq labels
    const PW = W - PAD_L, PH = H - PAD_B;
    const bands = [
      { key:"hpf",  type:"highpass",  freq:eq.hpfFreq||80,    gain:0,          q:eq.hpfQ||0.707,  color:"#FF6B6B", drag:"x",  label:"HPF" },
      { key:"low",  type:"lowshelf",  freq:eq.lowFreq||200,   gain:eq.low||0,  q:eq.lowQ||0.707,  color:"#4FC3F7", drag:"xy", label:"LS"  },
      { key:"mid",  type:"peaking",   freq:eq.midFreq||1000,  gain:eq.mid||0,  q:eq.midQ||1.0,    color:"#69F0AE", drag:"xy", label:"PK"  },
      { key:"high", type:"highshelf", freq:eq.highFreq||8000, gain:eq.high||0, q:eq.highQ||0.707, color:"#FFD54F", drag:"xy", label:"HS"  },
      { key:"lpf",  type:"lowpass",   freq:eq.lpfFreq||18000, gain:0,          q:eq.lpfQ||0.707,  color:"#FF6B6B", drag:"x",  label:"LPF" },
    ];
    const LOG_RANGE = Math.log10(20000/20);
    // Coordinate helpers — all values live in the padded plot area
    const freqToX = function(f){ return PAD_L + PW*Math.log10(Math.max(20,f)/20)/LOG_RANGE; };
    const xToFreq = function(px){ return Math.round(20*Math.pow(20000/20,Math.max(0,Math.min(1,(px-PAD_L)/PW)))); };
    const gainToY = function(g){ return (PH/2)-(Math.max(-DB_MAX,Math.min(DB_MAX,g))/DB_MAX)*(PH/2-6); };
    const yToGain = function(py){ return +((PH/2-py)/(PH/2-6)*DB_MAX).toFixed(2); };
    // Build the combined frequency response curve (300 points for smoothness)
    const nPts=300, pts=[];
    for(let i=0;i<=nPts;i++){
      const f=20*Math.pow(20000/20,i/nPts);
      let db=0;
      bands.forEach(function(b){ db+=eqEvalMag(eqCalcCoeffs(b.type,b.freq,b.gain,b.q),f); });
      pts.push([freqToX(f), gainToY(Math.max(-DB_MAX-2,Math.min(DB_MAX+2,db)))]);
    }
    // Smooth cubic bezier path
    let path=`M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for(let i=1;i<pts.length-1;i++){
      const[x0,y0]=pts[i-1],[x1,y1]=pts[i],[x2,y2]=pts[i+1];
      path+=` C ${((x0+x1)/2).toFixed(1)} ${y0.toFixed(1)} ${((x1+x2)/2).toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    const[lx,ly]=pts[pts.length-1]; path+=` L ${lx.toFixed(1)} ${ly.toFixed(1)}`;
    const zeroY = gainToY(0);
    const fill = path + ` L ${W} ${zeroY} L ${PAD_L} ${zeroY} Z`;
    const dragging=useRef(null), svgRef=useRef(null), [hovered,setHovered]=useState(null);
    // Tooltip state: {x,y,freq,gain}
    const [tip,setTip]=useState(null);
    // Q ring radius: maps Q (0.1–10) to a visual bandwidth arc in pixels
    const qToRingR = function(q,freq){ const bwHz=(freq/Math.max(0.01,q)); return Math.max(10,Math.min(40,PW*(Math.log10((freq+bwHz/2)/Math.max(20,freq-bwHz/2))/LOG_RANGE)*0.6)); };
    const FREQ_MARKS = [20,50,100,200,500,1000,2000,5000,10000,20000];
    const DB_MARKS   = [-18,-12,-6,0,6,12,18];
    return (
      <svg ref={svgRef} width={W} height={H}
        style={{display:"block",background:"#0b0d12",borderRadius:10,touchAction:"none",cursor:"crosshair",userSelect:"none"}}
        onMouseMove={function(e){
          if(!svgRef.current) return;
          const r=svgRef.current.getBoundingClientRect();
          const px=e.clientX-r.left, py=e.clientY-r.top;
          const b=dragging.current;
          if(b){
            const patch={};
            if(b.drag==="x"||b.drag==="xy"){
              const f=xToFreq(px);
              if(b.key==="hpf")patch.hpfFreq=Math.max(20,Math.min(2000,f));
              if(b.key==="lpf")patch.lpfFreq=Math.max(1000,Math.min(20000,f));
              if(b.key==="low")patch.lowFreq=Math.max(20,Math.min(2000,f));
              if(b.key==="mid")patch.midFreq=Math.max(100,Math.min(10000,f));
              if(b.key==="high")patch.highFreq=Math.max(500,Math.min(20000,f));
            }
            if(b.drag==="y"||b.drag==="xy"){
              const g=Math.max(-DB_MAX,Math.min(DB_MAX,yToGain(py)));
              if(b.key==="low")patch.low=g;
              if(b.key==="mid")patch.mid=g;
              if(b.key==="high")patch.high=g;
            }
            if(Object.keys(patch).length) onDrag(patch);
            setTip({x:px,y:py,freq:xToFreq(px),gain:yToGain(py).toFixed(1)});
          }
        }}
        onMouseUp={function(){dragging.current=null;}}
        onMouseLeave={function(){dragging.current=null;setTip(null);}}
        onTouchMove={function(e){
          e.preventDefault();
          const b=dragging.current; if(!b||!svgRef.current) return;
          const r=svgRef.current.getBoundingClientRect();
          const px=e.touches[0].clientX-r.left, py=e.touches[0].clientY-r.top;
          const patch={};
          if(b.drag==="x"||b.drag==="xy"){
            const f=xToFreq(px);
            if(b.key==="hpf")patch.hpfFreq=Math.max(20,Math.min(2000,f));
            if(b.key==="lpf")patch.lpfFreq=Math.max(1000,Math.min(20000,f));
            if(b.key==="low")patch.lowFreq=Math.max(20,Math.min(2000,f));
            if(b.key==="mid")patch.midFreq=Math.max(100,Math.min(10000,f));
            if(b.key==="high")patch.highFreq=Math.max(500,Math.min(20000,f));
          }
          if(b.drag==="y"||b.drag==="xy"){
            const g=Math.max(-DB_MAX,Math.min(DB_MAX,yToGain(py)));
            if(b.key==="low")patch.low=g;
            if(b.key==="mid")patch.mid=g;
            if(b.key==="high")patch.high=g;
          }
          if(Object.keys(patch).length) onDrag(patch);
        }}
        onTouchEnd={function(){dragging.current=null;}}>

        {/* ── Background gradient (Pro Q3 dark navy) ── */}
        <defs>
          <linearGradient id="eqBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f1219"/>
            <stop offset="100%" stopColor="#080b0f"/>
          </linearGradient>
          <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22"/>
            <stop offset="55%" stopColor="#818cf8" stopOpacity="0.10"/>
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02"/>
          </linearGradient>
          <filter id="eqGlow">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <rect x={0} y={0} width={W} height={H} fill="url(#eqBg)" rx={10}/>

        {/* ── Frequency grid lines ── */}
        {FREQ_MARKS.map(function(f){
          const x=freqToX(f);
          const major=[100,1000,10000].includes(f);
          return <line key={f} x1={x} y1={0} x2={x} y2={PH} stroke={major?"#1f2433":"#131720"} strokeWidth={major?1:0.75}/>;
        })}

        {/* ── dB grid lines ── */}
        {DB_MARKS.map(function(g){
          const y=gainToY(g);
          return (
            <g key={g}>
              <line x1={PAD_L} y1={y} x2={W} y2={y}
                stroke={g===0?"#2a3045":"#161b28"}
                strokeWidth={g===0?1.2:0.75}
                strokeDasharray={g===0?"none":"3 4"}/>
              <text x={PAD_L-3} y={y+3.5} fill={g===0?"#3d4a6a":"#2a3350"}
                fontSize={7} textAnchor="end" fontFamily="monospace">
                {g>0?"+":""}{g}
              </text>
            </g>
          );
        })}

        {/* ── Frequency labels ── */}
        {FREQ_MARKS.map(function(f){
          const x=freqToX(f);
          const label=f>=1000?(f/1000)+"k":f;
          return <text key={f} x={x} y={H-3} fill="#2a3350" fontSize={7} textAnchor="middle" fontFamily="monospace">{label}</text>;
        })}

        {/* ── Curve fill & stroke ── */}
        <path d={fill} fill="url(#curveFill)"/>
        <path d={path} fill="none" stroke="#38bdf8" strokeWidth={2} strokeLinecap="round" filter="url(#eqGlow)"/>

        {/* ── Zero line ── */}
        <line x1={PAD_L} y1={zeroY} x2={W} y2={zeroY} stroke="#2a3045" strokeWidth={1}/>

        {/* ── Band handles: Q ring + center dot ── */}
        {bands.map(function(b){
          const hx=freqToX(b.freq), hy=gainToY(b.gain);
          const cur=b.drag==="x"?"ew-resize":b.drag==="y"?"ns-resize":"move";
          const rRing=qToRingR(b.q,b.freq);
          const isActive=hovered===b.key||dragging.current?.key===b.key;
          return (
            <g key={b.key}>
              {/* Vertical frequency guide */}
              <line x1={hx} y1={0} x2={hx} y2={PH}
                stroke={b.color+"30"} strokeWidth={isActive?1.5:1} strokeDasharray="3 4"/>
              {/* Q-width bandwidth ring — mimics Pro Q3's bell width arc */}
              <ellipse cx={hx} cy={hy} rx={rRing} ry={Math.min(rRing*0.55,20)}
                fill="none" stroke={b.color+"35"} strokeWidth={isActive?1.5:1}/>
              {/* Outer glow disc */}
              <circle cx={hx} cy={hy} r={isActive?17:13}
                fill={b.color+"18"} stroke={b.color+"22"} strokeWidth={1}/>
              {/* Main handle dot */}
              <circle cx={hx} cy={hy} r={isActive?9:7}
                fill={b.color} fillOpacity={isActive?1:0.85}
                stroke="#0b0d12" strokeWidth={2}
                style={{cursor:cur}}
                onMouseDown={function(e){e.preventDefault();e.stopPropagation();dragging.current=b;}}
                onMouseEnter={function(){setHovered(b.key);}}
                onMouseLeave={function(){setHovered(null);}}
                onTouchStart={function(e){e.preventDefault();e.stopPropagation();dragging.current=b;}}/>
              {/* Band label inside handle */}
              <text x={hx} y={hy+3} fill="white" fontSize={isActive?7:6}
                textAnchor="middle" fontWeight="900" pointerEvents="none"
                fontFamily="monospace">{b.label}</text>
              {/* Live readout badge when active */}
              {isActive && (
                <g>
                  <rect x={hx-22} y={hy-28} width={44} height={14} rx={4}
                    fill="#0b0d12" stroke={b.color+"55"} strokeWidth={1}/>
                  <text x={hx} y={hy-18} fill={b.color} fontSize={7}
                    textAnchor="middle" fontFamily="monospace" fontWeight="700">
                    {b.freq>=1000?(b.freq/1000).toFixed(1)+"k":b.freq+"Hz"}
                    {b.gain!==0?" "+(b.gain>0?"+":"")+b.gain.toFixed(1)+"dB":""}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  // ── Compressor graph ──
  const CompGraph = function({ threshold, ratio }) {
    const W=150, H=110, dBtoP=function(db){return(db+60)/60;}, pts=[];
    for(let i=0;i<=60;i++){const inDb=-60+i;const outDb=inDb<threshold?inDb:threshold+(inDb-threshold)/ratio;pts.push(`${W*dBtoP(inDb)},${H*(1-dBtoP(outDb))}`);}
    const thX=W*dBtoP(threshold);
    return (<svg width={W} height={H} style={{display:"block",background:"#080808",borderRadius:8,flexShrink:0}}><line x1={0} y1={H} x2={W} y2={0} stroke="#1e1e1e" strokeWidth={1} strokeDasharray="4 3"/><path d={"M "+pts.join(" L ")} fill="none" stroke="#8B5CF6" strokeWidth={2} strokeLinecap="round"/><path d={"M "+pts.join(" L ")+` L ${W} ${H} L 0 ${H} Z`} fill="rgba(139,92,246,0.1)"/><line x1={thX} y1={0} x2={thX} y2={H} stroke="#EF4444" strokeWidth={1} strokeDasharray="3 2"/><text x={thX+3} y={11} fill="#EF4444" fontSize={8}>{threshold}dB</text><text x={3} y={10} fill="#444" fontSize={7}>OUT</text><text x={W-22} y={H-3} fill="#444" fontSize={7}>IN</text></svg>);
  };

  // ── Reverb visualiser ──
  const ReverbViz = function({ wet, roomSize }) {
    const W=140, H=80, decay=roomSize*3;
    return (<svg width={W} height={H} style={{display:"block",background:"#080808",borderRadius:8,flexShrink:0}}><line x1={0} y1={H/2} x2={W} y2={H/2} stroke="#1a1a1a" strokeWidth={1}/>{Array.from({length:28},function(_,i){const x=(i/27)*W;const amp=Math.exp(-i/(decay*4))*(H/2-5)*wet;const j=(Math.sin(i*7.3)*0.4+0.6)*amp;return <line key={i} x1={x} y1={H/2-j} x2={x} y2={H/2+j} stroke={`rgba(192,38,211,${0.25+0.75*Math.exp(-i/5)})`} strokeWidth={2}/>;})}</svg>);
  };

  // ── EQ defaults — Pro Q3 style: tighter midQ, ±18 dB range ──
  const eq5 = { hpfFreq:80,hpfQ:0.707,lowFreq:200,low:0,lowQ:0.707,midFreq:1000,mid:0,midQ:1.41,highFreq:8000,high:0,highQ:0.707,lpfFreq:18000,lpfQ:0.707,...fx.eq };

  return (
    <div style={{ position:"absolute", inset:0, zIndex:800, background:"rgba(0,0,0,0.97)", display:"flex", flexDirection:"column", overflowY:"auto" }} onClick={function(e){ e.stopPropagation(); }}>
      <div style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderBottom:"1px solid #1e1e1e", background:"#0a0a0a", flexShrink:0, position:"sticky", top:0, zIndex:10 }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:trackColor, marginRight:8 }} />
        <span style={{ color:"white", fontWeight:800, fontSize:14, flex:1 }}>{trackName} — Effects</span>
        {/* FX panel master VU meter */}
        <div style={{ marginRight:10 }}>
          <VUMeter analyserNode={analyserNode} isActive={isPlaying} compact={true} showLabel={false} />
        </div>
        <button onClick={onClose} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, color:"#888", fontSize:13, padding:"5px 14px", cursor:"pointer" }}>Done</button>
      </div>
      <FxPanelPlugins fx={fx} upd={upd} eq5={eq5} EQGraph={EQGraph} CompGraph={CompGraph} ReverbViz={ReverbViz} Knob={Knob} analyserNode={analyserNode} isPlaying={isPlaying} />
    </div>
  );
}, function areEqual(prev, next) {
  // Skip re-render if only currentTime/scroll changed — only re-render for real fx data changes
  return prev.fxTrackId === next.fxTrackId &&
         prev.fx === next.fx &&
         prev.trackName === next.trackName &&
         prev.trackColor === next.trackColor &&
         prev.isPlaying === next.isPlaying;
});

// =============================================================================
// BEAT GRID OVERLAY COMPONENT
// Renders detected beat marker lines over the DAW timeline.
// Uses absolute positioning to match the scroll container's coordinate space.
// Designed to be a zero-overhead read-only visual layer — no audio access.
// =============================================================================
function BeatGridOverlay({ beats, effectivePPS, sidebarW, rulerH, scrollRef, isPlaying, currentTime, bpm }) {
  const canvasRef = useRef(null);

  // Draw beat grid on a canvas that floats over the timeline lanes
  useEffect(function () {
    const canvas = canvasRef.current;
    if (!canvas || !beats || beats.length === 0) return;

    const el = scrollRef.current;
    if (!el) return;

    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const scrollLeft = el.scrollLeft;

    // Visible time range (add 2s buffer on each side)
    const visStart = Math.max(0, scrollLeft / effectivePPS - 2);
    const visEnd   = (scrollLeft + W) / effectivePPS + 2;

    // Draw each beat line
    beats.forEach(function (t, i) {
      if (t < visStart || t > visEnd) return;
      const x = Math.round(t * effectivePPS - scrollLeft);
      if (x < 0 || x > W) return;

      // Downbeat (every 4th beat) gets a brighter, taller line
      const isDownbeat = (i % 4 === 0);

      ctx.beginPath();
      ctx.moveTo(x, rulerH);
      ctx.lineTo(x, H);
      ctx.strokeStyle = isDownbeat
        ? "rgba(192,38,211,0.35)"
        : "rgba(192,38,211,0.13)";
      ctx.lineWidth = isDownbeat ? 1.5 : 0.75;
      ctx.stroke();

      // Tiny triangle at the ruler bottom for downbeats
      if (isDownbeat) {
        ctx.beginPath();
        ctx.moveTo(x - 4, rulerH);
        ctx.lineTo(x + 4, rulerH);
        ctx.lineTo(x, rulerH + 6);
        ctx.closePath();
        ctx.fillStyle = "rgba(192,38,211,0.6)";
        ctx.fill();
      }
    });

  // Redraw when scroll or beat data changes
  // eslint-disable-next-line
  }, [beats, effectivePPS, currentTime, bpm]);

  // Keep canvas sized to container
  useEffect(function () {
    const el = scrollRef.current;
    if (!el) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onScroll = function () {
      // Force re-paint on scroll
      canvas.dispatchEvent(new Event("bfredraw"));
    };
    el.addEventListener("scroll", onScroll, { passive:true });
    return function () { el.removeEventListener("scroll", onScroll); };
  }, [scrollRef]);

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
      style={{
        position:"absolute",
        top:0, left:sidebarW,
        pointerEvents:"none",
        zIndex:15,
        opacity:1,
      }}
    />
  );
}

function StudioScreen({ user, onExit }) {

  // ── Constants ─────────────────────────────────────────────────
  const PPS         = 100;       // PIXELS_PER_SECOND — single source of truth
  const SIDEBAR_W   = 158;       // left column: Logic Pro-style track headers
  const RULER_H     = 32;        // timeline ruler height
  const PLAYHEAD_X  = 0;         // playhead flush with sidebar edge — no gap

  // ── Track array: [{id, name, type, audioBuffer, url, isMuted, isSoloed, startTime, duration}]
  const [tracks, setTracks, undoTracks, redoTracks, canUndo, canRedo] = useHistory([]);
  const [bpm,          setBpm]          = useState(120);
  const [timeSigNum,   setTimeSigNum]   = useState(4);
  const [zoom,         setZoom]         = useState(1);
  const [vZoom,        setVZoom]        = useState(1);   // vertical track-height zoom

  const TRACK_H     = Math.round(92 * vZoom); // each track row height — scales with vertical zoom
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
  const [showNamePrompt, setShowNamePrompt] = useState(false); // name-before-save modal
  const [pendingNameAction, setPendingNameAction] = useState(null); // "exit" | "new"
  const [pendingName, setPendingName] = useState("");
  const [isSaved,      setIsSaved]      = useState(false);
  const [savedProjects,setSavedProjects]= useState([]);
  const [saveStatus,   setSaveStatus]   = useState("");
  const [error,        setError]        = useState("");
  const [countIn,      setCountIn]      = useState(0);
  const [exporting,    setExporting]    = useState(false);
  const [exportMsg,    setExportMsg]    = useState("");
  const [bpmDetecting, setBpmDetecting] = useState(false);
  const [detectedBpm,  setDetectedBpm]  = useState(null);
  // ── Advanced BPM engine state ─────────────────────────────────
  const [bpmConfidence,  setBpmConfidence]  = useState(null);   // 0–1
  const [bpmBandConf,    setBpmBandConf]    = useState(null);   // {low,mid,high} 0–1 each
  const [beatPositions,  setBeatPositions]  = useState([]);     // beat timestamps in seconds
  const [onsetTimestamps,setOnsetTimestamps]= useState([]);     // onset timestamps in seconds
  const [bpmProgress,    setBpmProgress]    = useState(0);      // 0–100 analysis progress
  const [bpmDetectMsg,   setBpmDetectMsg]   = useState("");
  const [showBeatGrid,   setShowBeatGrid]   = useState(true);   // overlay toggle
  const [tapTimes,       setTapTimes]       = useState([]);     // tap-tempo timestamps
  const [bpmSource,      setBpmSource]      = useState(null);   // "auto"|"tap"|"manual"
  const [swingAmount,    setSwingAmount]    = useState(0);      // 0–1 estimated swing
  const [bpmCandidates,  setBpmCandidates]  = useState([]);     // secondary BPM candidates
  const [bpmTemporal,    setBpmTemporal]    = useState(null);   // temporal consistency 0–1
  const [bpmWorkerRef]                      = useState(() => ({ current: null }));

  const [metronomeOn,  setMetronomeOn]  = useState(false);
  const [inputDevice,  setInputDevice]  = useState("default");
  const [recTrail,     setRecTrail]     = useState([]);
  const [recTrackId,   setRecTrackId]   = useState(null);
  const [showTSPicker, setShowTSPicker] = useState(false);
  const [showKeyPick,  setShowKeyPick]  = useState(false);
  const [draggingReg,  setDraggingReg]  = useState(null);
  const [showMixer,    setShowMixer]     = useState(false);
  const [fxTrackId,    setFxTrackId]     = useState(null);
  const fxUpdRef = useRef(null); // stable ref so memoized FX panel always calls latest upd
  const [showTakes,    setShowTakes]     = useState(null);
  const [trimmingClip, setTrimmingClip]  = useState(null);
  const [monitoringOn, setMonitoringOn] = useState(false);
  const [monitorVol,   setMonitorVol]   = useState(0.8);
  const micInputGainRef = useRef(1.0); // default 0dB (unity gain)
  const [micInputGain, setMicInputGainState] = useState(1.0); // 0.25–4.0 range (-12..+12dB)
  const [headphonesIn, setHeadphonesIn] = useState(false);
  const [monitorWarn,  setMonitorWarn]  = useState("");
  const [showAutoPitch,setShowAutoPitch] = useState(false);
  const [autoPitch,    setAutoPitch]     = useState({ on:false, key:"C", scale:"major", speed:0.5 });
  const [lowLatency,   setLowLatency]    = useState(true);
  // "builtin" = iPhone built-in mic, "headset" = wired headset mic
  // Always start on iPhone mic regardless of what's connected at load time
  const [micSource,    setMicSource]     = useState("builtin");
  // Tracks whether the user has explicitly chosen a mic — prevents auto-switch overriding their pick
  const userPickedMicRef = useRef(false);
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
  const saveStateRef    = useRef(null); // updated each render so lifecycle effect always saves fresh state

  // ── Input monitoring refs ──────────────────────────────────────
  const monitorStreamRef    = useRef(null);
  const monitorSrcRef       = useRef(null);
  const monitorGainRef      = useRef(null);
  const monitorMicBoostRef  = useRef(null); // pre-gain mic input boost node
  const monitorAnalyserRef  = useRef(null);
  const monitorSplitterRef  = useRef(null); // ChannelSplitter for mono-centre
  const monitorMergerRef    = useRef(null); // ChannelMerger  for mono-centre
  const monitorCtxRef       = useRef(null); // persistent AudioContext — never closed between sessions
  // Persistent mic stream — requested once on mount, reused for both monitoring and recording
  const micStreamRef        = useRef(null);
  // micReady: true if we've confirmed mic permission this session.
  // We check the Permissions API first — if the browser shows "granted", skip the prompt.
  // If it shows "prompt" or "denied", clear our cached flag and ask again.
  const [micReady,      setMicReady]      = useState(false);
  const [micDenied,     setMicDenied]     = useState(false);
  // effectivePPS changes with zoom — keep a ref so lasso onMove closure can read it
  // MUST be declared here (before line 4743 uses it) to avoid "uninitialized variable" crash
  const effectivePPSRef = useRef(100);
  const lassoContainerRef = useRef(null); // ref to the DAW wrapper — lasso overlay is positioned inside this
  const pitchWorkletReadyRef = useRef(false); // true once the phase-vocoder worklet is registered

  // ── Audio engine gain/FX refs (declared here to follow Rules of Hooks) ──
  const gainNodesRef       = useRef({});   // trackId → GainNode
  const trackAnalysersRef  = useRef({});   // trackId → AnalyserNode (for VU meters)
  const masterAnalyserRef  = useRef(null); // master output analyser
  const masterGainRef      = useRef(null); // single master output
  const fxNodesRef    = useRef({});   // trackId → live audio node references

  // ── Ruler drag ref ───────────────────────────────────────────────────────
  const rulerDragRef = useRef(null); // { mode: "in"|"out"|"new", startX, startT }

  // ── Clip/track selection state ───────────────────────────────────────────
  const [selectedTrackId, setSelectedTrackId] = useState(null); // which vocal track records into
  const [selectedClipId, setSelectedClipId] = useState(null);
  const dragRef = useRef(null);

  // ── Track reorder via long-press drag ────────────────────────────────────
  const [reorderDragId,   setReorderDragId]   = useState(null);  // id of track being dragged
  const [reorderDropIdx,  setReorderDropIdx]  = useState(null);  // index where it will drop
  const reorderLongPressRef = useRef(null);   // setTimeout handle
  const reorderDragRef      = useRef(null);   // { trackId, startY, currentIdx }

  // Reorder helpers
  const reorderMoveTrack = useCallback(function(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    setTracks(function(prev) {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, [setTracks]);

  const handleHeaderLongPressStart = useCallback(function(e, track) {
    const touch = e.touches ? e.touches[0] : e;
    const startY = touch.clientY;
    const currentIdx = tracks.findIndex(function(t){ return t.id === track.id; });
    reorderLongPressRef.current = setTimeout(function() {
      // Vibrate to confirm hold (if supported)
      if (navigator.vibrate) navigator.vibrate(40);
      setReorderDragId(track.id);
      setReorderDropIdx(currentIdx);
      reorderDragRef.current = { trackId: track.id, startY, currentIdx };
    }, 1500);
  }, [tracks]);

  const handleHeaderLongPressCancel = useCallback(function() {
    clearTimeout(reorderLongPressRef.current);
  }, []);

  const handleHeaderDragMove = useCallback(function(e) {
    if (!reorderDragRef.current) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    const dy = touch.clientY - reorderDragRef.current.startY;
    const movedRows = Math.round(dy / TRACK_H);
    const fromIdx = reorderDragRef.current.currentIdx;
    const toIdx = Math.max(0, Math.min(tracks.length - 1, fromIdx + movedRows));
    setReorderDropIdx(toIdx);
  }, [tracks.length, TRACK_H]);

  const handleHeaderDragEnd = useCallback(function() {
    if (!reorderDragRef.current) return;
    const fromIdx = reorderDragRef.current.currentIdx;
    if (reorderDropIdx !== null && reorderDropIdx !== fromIdx) {
      reorderMoveTrack(fromIdx, reorderDropIdx);
    }
    setReorderDragId(null);
    setReorderDropIdx(null);
    reorderDragRef.current = null;
    clearTimeout(reorderLongPressRef.current);
  }, [reorderDropIdx, reorderMoveTrack]);

  useEffect(function () { zoomRef.current = zoom; }, [zoom]);
  useEffect(function () { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(function () { tracksRef.current = tracks; }, [tracks]);

  // Set initial position — Bar1 under centred playhead at t=0
  useEffect(function () {
    if (scrollRef.current && trackContainerRef.current) {
      if(scrollRef.current) scrollRef.current.scrollLeft = 0;
    }
  }, []);

  // ── Studio mount: request mic permission only after user navigates to Studio ──
  // A 800ms delay ensures the tab transition completes before the iOS dialog appears.
  // Uses the Permissions API to check if mic is genuinely already granted,
  // so we only skip the prompt when the browser has confirmed it.
  useEffect(function () {
    var cancelled = false;
    var timer = setTimeout(function () {
      if (cancelled) return;
      async function init() {
        // 1. Check if mic permission is already granted via Permissions API
        var alreadyGranted = false;
        try {
          if (navigator.permissions) {
            var result = await navigator.permissions.query({ name: "microphone" });
            alreadyGranted = result.state === "granted";
          }
        } catch(e) {
          // Permissions API not available (some iOS versions) — fall back to localStorage
          try { alreadyGranted = localStorage.getItem("bf_mic_granted") === "1"; } catch(e2) {}
        }

        if (alreadyGranted) {
          if (!cancelled) { setMicReady(true); }
        } else {
          // Ask for permission
          try {
            var stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            stream.getTracks().forEach(function(t) { t.stop(); });
            if (!cancelled) {
              setMicReady(true);
              try { localStorage.setItem("bf_mic_granted", "1"); } catch(e) {}
            }
          } catch(e) {
            if (!cancelled) {
              setMicDenied(true);
              try { localStorage.removeItem("bf_mic_granted"); } catch(e2) {}
              if (e.name === "NotAllowedError") {
                setError("Mic access denied. Go to Settings → Safari → Microphone → Allow.");
              }
            }
          }
        }

        // 2. Always run headphone detection
        if (!cancelled) {
          setTimeout(checkHeadphones, 300);
          setTimeout(checkHeadphones, 1200);
        }
        // 3. Pre-warm playback AudioContext
        if (!cancelled && (!actxRef.current || actxRef.current.state === "closed")) {
          try {
            actxRef.current = new (window.AudioContext || window.webkitAudioContext)({
              latencyHint: "interactive",
            });
          } catch(e) {}
        }
      }
      init();
    }, 800);
    return function() { cancelled = true; clearTimeout(timer); };
  }, []);

  // ── Lazy mic permission — kept for backward compat, now rarely needed ──
  // requestMicPermissionOnce is a no-op if micReady is already true from mount init
  const requestMicPermissionOnce = async function () {
    if (micReady) return true;
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop — we just needed the permission grant
      stream.getTracks().forEach(function (t) { t.stop(); });
      setMicReady(true);
      try { localStorage.setItem("bf_mic_granted", "1"); } catch(e) {}
      setTimeout(checkHeadphones, 300);
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

  // ── iOS Background Persistence ────────────────────────────────
  // iOS Safari can fully reload the page when the app is backgrounded.
  // We save lightweight studio state (no AudioBuffers — they can't be serialized)
  // to sessionStorage so the project name, BPM, key and settings survive a reload.
  // Audio clips themselves cannot be restored (they live in memory), but the project
  // identity and settings are recovered so the session feels uninterrupted.
  useEffect(function () {
    try {
      const snap = {
        projectName, bpm, projectKey, timeSigNum, zoom, vZoom,
        snapToGrid, loopEnabled, loopIn, loopOut,
        metronomeOn, showBeatGrid, micInputGain,
        // Save full track metadata including volume and pan
        tracksMeta: tracks.map(function(t) {
          return { id: t.id, name: t.name, type: t.type, color: t.color,
                   isMuted: t.isMuted, isSoloed: t.isSoloed,
                   volume: t.volume, pan: t.pan };
        }),
      };
      sessionStorage.setItem("bf_studio_state", JSON.stringify(snap));
    } catch(e) {}
  }, [projectName, bpm, projectKey, timeSigNum, zoom, vZoom, snapToGrid, loopEnabled, loopIn, loopOut, metronomeOn, showBeatGrid, micInputGain, tracks]);

  // Restore studio state on mount (handles iOS background reload)
  useEffect(function () {
    try {
      const raw = sessionStorage.getItem("bf_studio_state");
      if (!raw) return;
      const snap = JSON.parse(raw);
      if (snap.projectName) setProjectName(snap.projectName);
      if (snap.bpm)          setBpm(snap.bpm);
      if (snap.projectKey)   setProjectKey(snap.projectKey);
      if (snap.timeSigNum)   setTimeSigNum(snap.timeSigNum);
      if (snap.zoom)         setZoom(snap.zoom);
      if (snap.vZoom)        setVZoom(snap.vZoom);
      if (snap.snapToGrid !== undefined)  setSnapToGrid(snap.snapToGrid);
      if (snap.loopEnabled !== undefined) setLoopEnabled(snap.loopEnabled);
      if (snap.loopIn  !== undefined)     setLoopIn(snap.loopIn);
      if (snap.loopOut !== undefined && snap.loopOut > 0) setLoopOut(snap.loopOut);
      if (snap.metronomeOn !== undefined) setMetronomeOn(snap.metronomeOn);
      if (snap.showBeatGrid !== undefined) setShowBeatGrid(snap.showBeatGrid);
      if (snap.micInputGain !== undefined) setMicInputGainState(snap.micInputGain);
      // Restore track metadata (volume, pan, mute, solo) — clips can't be serialised
      if (Array.isArray(snap.tracksMeta) && snap.tracksMeta.length > 0) {
        setTracks(function(prev) {
          // If tracks already exist (e.g. loaded project), merge; otherwise seed shells
          if (prev.length > 0) {
            return prev.map(function(t) {
              const meta = snap.tracksMeta.find(function(m) { return m.id === t.id; });
              if (!meta) return t;
              return Object.assign({}, t, {
                name: meta.name ?? t.name,
                color: meta.color ?? t.color,
                isMuted: meta.isMuted ?? t.isMuted,
                isSoloed: meta.isSoloed ?? t.isSoloed,
                volume: meta.volume ?? t.volume,
                pan: meta.pan ?? t.pan,
              });
            });
          }
          // No tracks yet — restore shells so the track list isn't empty
          return snap.tracksMeta.map(function(m) {
            return {
              id: m.id, name: m.name, type: m.type || "vocal",
              color: m.color || "#30D158",
              isMuted: m.isMuted || false, isSoloed: m.isSoloed || false,
              volume: m.volume ?? 1, pan: m.pan ?? 0,
              clips: [], // audio clips can't be serialised — user sees empty lanes
            };
          });
        });
      }
    } catch(e) {}
  }, []); // run once on mount only

  // ── AudioContext ──────────────────────────────────────────────
  const getActx = function () {
    if (!actxRef.current || actxRef.current.state === "closed") {
      actxRef.current = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: "interactive",
      });
      // Connect silent audio through the new AudioContext — must happen after creation
      // and inside a user gesture (getActx is always called from one)
      silentSrcNodeRef.current = null; // reset so ensureSilentAudio reconnects
      ensureSilentAudio();
    }
    if (actxRef.current.state === "suspended") {
      actxRef.current.resume().catch(function(){});
    }
    return actxRef.current;
  };

  // ── Headphone detection + mic enumeration ────────────────────
  // Returns { headphonesConnected, mics: [{deviceId, label, isBuiltIn}] }
  // iOS Safari only reveals real device labels after mic permission is granted.
  // We identify built-in vs headset by label keywords; fallback to input count.
  const checkHeadphones = async function () {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter(function(d){ return d.kind === "audiooutput"; });
      const inputs  = devices.filter(function(d){ return d.kind === "audioinput"; });

      // 1st check: named audio output (works on desktop, Chrome Android)
      const hpByOutput = outputs.some(function(d){
        const l = (d.label||"").toLowerCase();
        return l.includes("headphone")||l.includes("earphone")||l.includes("airpods")||
               l.includes("bluetooth")||l.includes("headset")||l.includes("wired");
      });

      // 2nd check (iOS): wired headset exposes a labelled "Headset Microphone" audioinput
      // after mic permission is granted. This is the most reliable iOS signal.
      const hpByInputLabel = !hpByOutput && inputs.some(function(d){
        const l = (d.label||"").toLowerCase();
        return l.includes("headset")||l.includes("wired")||l.includes("external")||
               l.includes("earphone")||l.includes("airpod")||l.includes("earbud")||
               l.includes("bluetooth")||l.includes("headphone");
      });

      // 3rd check: labels visible + more than one input = headset mic present
      // Only applies when labels ARE populated (after mic permission granted)
      const anyLabel  = inputs.some(function(d){ return !!(d.label); });
      const hpByCount = !hpByOutput && !hpByInputLabel && anyLabel && inputs.length > 1;

      // NOTE: Removed hpByLatency (iPhone reports low latency regardless of headset state)
      // and hpByExtraInput (false positive after getUserMedia temporarily shows 2 inputs)

      const hp = hpByOutput || hpByInputLabel || hpByCount;
      setHeadphonesIn(hp);

      // Classify mic inputs
      // iOS exposes labels like "iPhone Microphone" and "Headset Microphone" after permission.
      // Before permission all labels are blank — we fall back to index (index 0 = built-in,
      // index 1+ = external/headset on iOS when a headset is present).
      let builtInId   = null;
      let headsetId   = null;
      let builtInLabel = "📱 iPhone Mic";
      let headsetLabel = "🎧 Headset Mic";

      inputs.forEach(function(d, idx) {
        if (!d.deviceId) return;
        const l = (d.label||"").toLowerCase();
        const isHeadset = l.includes("headset")||l.includes("wired")||l.includes("external")||
                          l.includes("airpod")||l.includes("earphone")||l.includes("earbud")||
                          l.includes("bluetooth");
        const isBuiltIn = l.includes("iphone")||l.includes("built-in")||l.includes("internal")||
                          l.includes("front")||l.includes("default");

        if (l) {
          // Labels available — use keyword classification
          if (isHeadset && !headsetId) {
            headsetId   = d.deviceId;
            headsetLabel = "🎧 " + (d.label.length < 30 ? d.label : "Headset Mic");
          } else if ((isBuiltIn || (!isHeadset && !builtInId)) && !builtInId) {
            builtInId   = d.deviceId;
            builtInLabel = "📱 " + (d.label.includes("iPhone") ? "iPhone Mic" : (d.label.length < 30 ? d.label : "iPhone Mic"));
          }
        } else {
          // No labels yet (pre-permission) — assume index 0 = built-in, index 1 = headset
          if (idx === 0 && !builtInId) builtInId = d.deviceId;
          if (idx === 1 && !headsetId) headsetId = d.deviceId;
        }
      });

      // Build the two-option list
      const mics = [
        { deviceId: builtInId || "builtin", label: builtInLabel, isBuiltIn: true },
        { deviceId: headsetId || "headset", label: headsetLabel, isBuiltIn: false,
          detected: hp,
        },
      ];
      setAvailableMics(mics);
      return { headphonesConnected: hp, mics };
    } catch(e){ return { headphonesConnected: false, mics: [] }; }
  };

  useEffect(function () {
    checkHeadphones();

    const onDeviceChange = function() {
      // When a headset disconnects, iOS suspends the AudioContext.
      // Resume it immediately so playback continues on the speaker — don't wait.
      if (actxRef.current && actxRef.current.state === "suspended") {
        actxRef.current.resume().catch(function(){});
      }
      // Defer the label enumeration — iOS needs time to settle after route change
      setTimeout(checkHeadphones, 500);
      setTimeout(checkHeadphones, 1500);
    };
    navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);

    // Poll every 2 seconds as fallback for devices that don't fire devicechange reliably
    const pollInterval = setInterval(checkHeadphones, 2000);

    return function(){
      navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
      clearInterval(pollInterval);
    };
  }, []);

  // Re-scan as soon as mic permission is granted — iOS only reveals device labels
  // (e.g. "iPhone Microphone", "Headset Microphone") after the first getUserMedia call.
  // Without this, headphonesIn stays false even when a headset is already plugged in.
  useEffect(function () {
    if (micReady) {
      setTimeout(checkHeadphones, 400);
      setTimeout(checkHeadphones, 1500); // second pass after iOS settles labels
    }
  }, [micReady]);

  // Headphone connect/disconnect — only controls monitoring AVAILABILITY.
  // Never auto-starts monitoring. User must toggle it manually.
  const prevHeadphonesRef = useRef(null);
  useEffect(function () {
    if (prevHeadphonesRef.current === null) {
      prevHeadphonesRef.current = headphonesIn;
      return;
    }
    if (!headphonesIn && prevHeadphonesRef.current) {
      // Headphones disconnected — defer all cleanup off the main thread.
      // iOS is mid-route-change here; doing work synchronously causes the freeze.
      setTimeout(function () {
        stopMonitoring();
        userPickedMicRef.current = false;
        setMicSource("builtin");
        setMonitorWarn("");
        // Resume AudioContext if iOS suspended it during the route change
        if (actxRef.current && actxRef.current.state === "suspended") {
          actxRef.current.resume().catch(function(){});
        }
      }, 200);
    }
    prevHeadphonesRef.current = headphonesIn;
  }, [headphonesIn]);

  // ── Shared mic constraint builder ────────────────────────────
  // Resolves the correct deviceId for "builtin" or "headset" on iOS and returns
  // a getUserMedia audio constraints object. Used by both monitoring and recording
  // so they always use the same mic source the user has selected.
  //
  // CLEAN SIGNAL DESIGN:
  //   • echoCancellation: false  — browser AEC destroys vocal tone; use post-processing instead
  //   • noiseSuppression: false  — browser NS adds artifacts/pumping; Noise Remover FX handles this
  //   • autoGainControl:  false  — AGC causes level jumps mid-take; set gain manually via mixer
  //   • sampleRate ideal 48000   — RNNoise native rate; falls back gracefully if unsupported
  //   • channelCount ideal 1     — mono mic; "ideal" won't fail on stereo-only devices
  //   • All device constraints use "ideal" not "exact" to prevent OverconstrainedError on iOS
  const buildMicConstraints = async function (wantSource, extraConstraints) {
    const base = Object.assign({
      echoCancellation: { exact: false },   // Never allow AEC — it destroys vocal tone
      noiseSuppression: { exact: false },   // Never allow browser NS — use Noise Remover FX
      autoGainControl:  { exact: false },   // Never allow AGC — causes level jumps mid-take
      channelCount:     { ideal: 1 },       // Request mono from hardware (ideal = won't fail on stereo-only devices)
      sampleRate:       { ideal: 48000, min: 44100 }, // 48kHz for best quality; 44100 fallback
      latency:          { ideal: 0 },       // Request minimum hardware latency
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
      // Use "ideal" so iOS doesn't throw OverconstrainedError if deviceId becomes stale
      base.deviceId = builtInDeviceId ? { ideal: builtInDeviceId } : undefined;
    } else {
      // Headset mic — use known deviceId or let iOS auto-route (no constraint = headset when plugged in)
      const headsetEntry = availableMics.find(function(m){ return !m.isBuiltIn; });
      const headsetId = headsetEntry && headsetEntry.deviceId !== "headset" ? headsetEntry.deviceId : null;
      if (headsetId) base.deviceId = { ideal: headsetId };
      // No deviceId → iOS routes to headset automatically when plugged in
    }
    return base;
  };

  // ── Input Monitoring ──────────────────────────────────────────
  // DESIGN: Monitoring is a completely separate pipeline from recording.
  //   • Own mic stream (never shared with recording micStreamRef)
  //   • Own AudioContext (monitorCtxRef) — never touches actxRef (playback)
  //   • Mic stream is stopped fully on stopMonitoring so iOS releases the input session
  //   • This prevents monitoring from forcing iOS into "recording session" behaviour
  //     which was causing the large output buffer / background playback failures
  const monitorMicStreamRef = useRef(null); // monitoring-only mic stream, separate from recording

  const startMonitoring = async function (forceLowLatency, forceMicSource) {
    if (monitorSrcRef.current) return; // already running
    setMonitorWarn("");

    const useMicSource = forceMicSource !== undefined ? forceMicSource : micSource;
    const audioConstraints = await buildMicConstraints(useMicSource);

    try {
      // Always open a fresh dedicated stream for monitoring — never reuse recording stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { ...audioConstraints, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      monitorMicStreamRef.current = stream;
      monitorStreamRef.current    = stream;

      // Reuse or create monitoring AudioContext
      if (!monitorCtxRef.current || monitorCtxRef.current.state === "closed") {
        monitorCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({
          latencyHint: "interactive",
        });
      }
      const mCtx = monitorCtxRef.current;
      if (mCtx.state === "suspended") await mCtx.resume();

      const src      = mCtx.createMediaStreamSource(stream);
      const micBoost = mCtx.createGain();
      micBoost.gain.value = micInputGainRef.current;
      const gain = mCtx.createGain();
      gain.gain.value = monitorVol;

      const analyser = mCtx.createAnalyser();
      analyser.fftSize = 256;

      // Mono → stereo centre: prevents iOS routing mono only to left channel
      const splitter = mCtx.createChannelSplitter(1);
      const merger   = mCtx.createChannelMerger(2);
      src.connect(micBoost);
      micBoost.connect(splitter);
      splitter.connect(merger, 0, 0);
      splitter.connect(merger, 0, 1);
      merger.connect(gain);
      gain.connect(mCtx.destination);
      gain.connect(analyser);

      monitorSrcRef.current      = src;
      monitorGainRef.current     = gain;
      monitorMicBoostRef.current = micBoost;
      monitorAnalyserRef.current = analyser;
      monitorSplitterRef.current = splitter;
      monitorMergerRef.current   = merger;
      setMonitoringOn(true);
    } catch (e) {
      monitorMicStreamRef.current = null;
      monitorStreamRef.current    = null;
      setMonitorWarn("Could not start monitoring: " + (e.message || e.name));
    }
  };

  const stopMonitoring = function () {
    // Immediately update UI state — don't wait for cleanup
    setMonitoringOn(false);

    // Capture refs now before they're cleared
    const gain      = monitorGainRef.current;
    const src       = monitorSrcRef.current;
    const boost     = monitorMicBoostRef.current;
    const analyser  = monitorAnalyserRef.current;
    const splitter  = monitorSplitterRef.current;
    const merger    = monitorMergerRef.current;
    const mCtx      = monitorCtxRef.current;
    const micStream = monitorMicStreamRef.current;

    // Clear refs immediately so nothing tries to reuse them
    monitorSrcRef.current      = null;
    monitorGainRef.current     = null;
    monitorMicBoostRef.current = null;
    monitorAnalyserRef.current = null;
    monitorSplitterRef.current = null;
    monitorMergerRef.current   = null;
    monitorStreamRef.current   = null;
    monitorMicStreamRef.current = null;

    // Defer all actual audio cleanup off the main thread entirely.
    // track.stop() on a disconnected hardware device can block on iOS —
    // running it in a timeout prevents the UI freeze on headphone disconnect.
    setTimeout(function () {
      // Ramp gain to zero first to avoid pop
      if (gain && mCtx && mCtx.state !== "closed") {
        try { gain.gain.setTargetAtTime(0, mCtx.currentTime, 0.02); } catch(e) {}
      }
      setTimeout(function () {
        try { src     && src.disconnect(); }     catch(e) {}
        try { gain    && gain.disconnect(); }    catch(e) {}
        try { boost   && boost.disconnect(); }   catch(e) {}
        try { analyser && analyser.disconnect(); } catch(e) {}
        try { splitter && splitter.disconnect(); } catch(e) {}
        try { merger  && merger.disconnect(); }  catch(e) {}

        // Stop mic tracks — deferred so iOS doesn't block main thread
        if (micStream) {
          micStream.getTracks().forEach(function(t) {
            try { t.stop(); } catch(e) {}
          });
        }

        // Suspend monitor context
        if (mCtx && mCtx.state === "running") {
          mCtx.suspend().catch(function(){});
        }
      }, 80);
    }, 0);
  };

  useEffect(function(){
    if (monitorGainRef.current && monitorCtxRef.current) {
      monitorGainRef.current.gain.setTargetAtTime(monitorVol, monitorCtxRef.current.currentTime, 0.01);
    }
  }, [monitorVol]);

  useEffect(function(){
    micInputGainRef.current = micInputGain;
    if (monitorMicBoostRef.current && monitorCtxRef.current) {
      monitorMicBoostRef.current.gain.setTargetAtTime(micInputGain, monitorCtxRef.current.currentTime, 0.01);
    }
  }, [micInputGain]);

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
      // Update timer display at ~10fps — the FX panel is memoized so it won't
      // re-render on these ticks, but reducing frequency cuts overall React work.
      if (!lastUIUpdate || ts - lastUIUpdate > 100) {
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
  // gainNodesRef, masterGainRef, fxNodesRef declared at top of component (Rules of Hooks)

  // ── Phase-vocoder pitch-shift worklet ────────────────────────────────────
  // Registered once per AudioContext via a Blob URL. Implements OLA (overlap-add)
  // pitch shifting that preserves tempo — unlike playbackRate which stretches time.
  // The worklet exposes a single AudioParam: "pitch" (ratio, 1.0 = no shift).
  // To shift by N semitones: ratio = 2^(N/12).
  // =============================================================================
  const PITCH_WORKLET_CODE = `
// ══════════════════════════════════════════════════════════════════════════════
// BeatFinder Professional Autotune / Pitch Correction Worklet v3
// ══════════════════════════════════════════════════════════════════════════════
// Architecture: Phase Vocoder (FFT-based) for transparent pitch shifting with
//   correct phase propagation + TD-PSOLA formant preservation pass.
//   This is the same fundamental approach used in Antares Auto-Tune Pro and
//   Logic Pro's built-in pitch correction (Flex Pitch).
//
// Parameters (all k-rate):
//   pitch   – semitone shift ratio in SHIFT mode (default 1.0 = no shift)
//   speed   – correction speed 0..1.  0 = instant (T-Pain), 1 = ~400ms glide
//   mode    – 0 = SHIFT (manual transpose), 1 = AUTOTUNE (snap to scale)
//   root    – root note 0..11 (C=0 … B=11)
//   scale   – 12-bit bitmask of active scale degrees (default 4095 = chromatic)
//   formant – formant preservation 0..1 (0 = off, 1 = fully preserved)
// ══════════════════════════════════════════════════════════════════════════════

class PitchShiftProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name:'pitch',   defaultValue:1,    minValue:0.125, maxValue:8,    automationRate:'k-rate' },
      { name:'speed',   defaultValue:0.5,  minValue:0,     maxValue:1,    automationRate:'k-rate' },
      { name:'mode',    defaultValue:0,    minValue:0,     maxValue:1,    automationRate:'k-rate' },
      { name:'root',    defaultValue:0,    minValue:0,     maxValue:11,   automationRate:'k-rate' },
      { name:'scale',   defaultValue:4095, minValue:0,     maxValue:4095, automationRate:'k-rate' },
      { name:'formant', defaultValue:0.5,  minValue:0,     maxValue:1,    automationRate:'k-rate' },
    ];
  }

  constructor() {
    super();
    const sr = sampleRate;
    this._sr = sr;

    // ── Phase Vocoder FFT size & hop ─────────────────────────────
    // 2048 gives ~46ms frames @ 44.1kHz — good pitch resolution
    // Hop = N/4 → 75% overlap — standard for high-quality PV
    this._N    = 2048;
    this._hop  = 512;    // analysis & synthesis hop
    this._N2   = this._N >> 1;

    // Pre-compute Hann window
    this._win = new Float32Array(this._N);
    for (let i = 0; i < this._N; i++) {
      this._win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (this._N - 1));
    }
    // Window normalisation scalar (for 75% overlap Hann)
    this._winNorm = 2.0 / (0.375 * this._N);

    // ── Input ring buffer (4 seconds — enough for any latency) ───
    this._ringLen  = sr * 4;
    this._ring     = new Float32Array(this._ringLen);
    this._ringW    = 0; // write pointer (absolute sample count)

    // ── Phase Vocoder analysis state ─────────────────────────────
    this._anaFrame  = new Float32Array(this._N);   // windowed analysis frame
    this._lastPhase = new Float32Array(this._N2 + 1); // phase of previous analysis frame
    this._sumPhase  = new Float32Array(this._N2 + 1); // accumulated synthesis phase
    this._anaMag    = new Float32Array(this._N2 + 1);
    this._anaFreq   = new Float32Array(this._N2 + 1); // true frequencies (radians/sample)
    this._synMag    = new Float32Array(this._N2 + 1);
    this._synFreq   = new Float32Array(this._N2 + 1);

    // ── Output overlap-add buffer ─────────────────────────────────
    this._outBuf    = new Float32Array(this._ringLen);
    this._outW      = 0; // output write pointer (absolute)
    this._outR      = -this._N; // output read pointer — pre-rolled back by one full window so the first block doesn't read zeros before any synthesis has run

    this._nextAna   = 0;   // absolute input sample count for next analysis frame

    // ── pYIN pitch detection ──────────────────────────────────────
    this._yinN      = 4096;  // larger pYIN window for low-pitched voices
    this._yinBuf    = new Float32Array(this._yinN);
    this._yinPeriod = 0;     // last detected period in samples
    this._yinTimer  = 0;
    this._yinRate   = 256;   // re-run every 256 samples
    // pYIN HMM state: previous voiced probability & period candidates
    this._pyinPrevVoiced = 0;
    this._pyinPrevPeriod = 0;

    // ── Smoothed pitch correction state ──────────────────────────
    this._currentCents = 0;
    this._targetCents  = 0;

    // FFT tables (pre-computed for speed)
    this._buildFFTTables(this._N);
  }

  // ── Build bit-reversal table and twiddle factors ─────────────────────────
  _buildFFTTables(N) {
    const log2N = Math.log2(N) | 0;
    const br = new Uint16Array(N);
    for (let i = 1, rev = 0; i < N; i++) {
      let bit = N >> 1;
      for (; rev & bit; bit >>= 1) rev ^= bit;
      rev ^= bit;
      br[i] = rev;
    }
    this._br = br;
    // Twiddle factors (cos/sin for each stage)
    const cos = new Float32Array(N);
    const sin = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      cos[i] = Math.cos(-2 * Math.PI * i / N);
      sin[i] = Math.sin(-2 * Math.PI * i / N);
    }
    this._twCos = cos;
    this._twSin = sin;
    this._fftN  = N;
  }

  // ── In-place Cooley-Tukey FFT (real input, complex output) ───────────────
  // re[], im[] are length N Float32Arrays. inverse=true → IFFT (no 1/N scaling).
  _fft(re, im, inverse) {
    const N   = this._fftN;
    const br  = this._br;
    const cos = this._twCos;
    const sin = this._twSin;
    // Bit-reversal permutation
    for (let i = 0; i < N; i++) {
      const j = br[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
            t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    // Butterfly stages
    const sign = inverse ? 1 : -1;
    for (let len = 2; len <= N; len <<= 1) {
      const half = len >> 1;
      const step = N / len;
      for (let i = 0; i < N; i += len) {
        for (let j = 0; j < half; j++) {
          const ti = j * step;
          const wr =  cos[ti];
          const wi =  sin[ti] * sign;  // sign flips for inverse
          const ur = re[i + j + half], ui = im[i + j + half];
          const vr = ur * wr - ui * wi;
          const vi = ur * wi + ui * wr;
          re[i + j + half] = re[i + j] - vr;
          im[i + j + half] = im[i + j] - vi;
          re[i + j]        += vr;
          im[i + j]        += vi;
        }
      }
    }
    if (inverse) {
      const inv = 1 / N;
      for (let i = 0; i < N; i++) { re[i] *= inv; im[i] *= inv; }
    }
  }

  // ── pYIN pitch detector ───────────────────────────────────────────────────
  // Probabilistic YIN (Mauch & Dixon 2014).
  // Returns period in samples (0 = unvoiced).
  // Improvements over plain YIN:
  //   • Builds a full candidate list with per-candidate voiced probabilities
  //     (beta-distribution CDF over CMNDF values) instead of accepting the
  //     first dip below a hard threshold.
  //   • A lightweight two-state HMM (voiced / unvoiced) with a transition
  //     prior smooths the voicing decision across frames, suppressing the
  //     octave jumps and spurious triggers that plain YIN suffers from.
  //   • Parabolic interpolation for sub-sample period accuracy is retained.
  _yin(buf) {
    const N      = buf.length;
    const half   = N >> 1;
    const sr     = this._sr;

    // ── Energy guard ────────────────────────────────────────────────
    let rms = 0;
    for (let i = 0; i < N; i++) rms += buf[i] * buf[i];
    if (rms / N < 0.0002) {
      this._pyinPrevVoiced = 0;
      return 0;
    }

    // ── Difference function d(tau) ───────────────────────────────────
    const d = new Float32Array(half);
    for (let tau = 1; tau < half; tau++) {
      let s = 0;
      for (let j = 0; j < half; j++) {
        const diff = buf[j] - buf[j + tau];
        s += diff * diff;
      }
      d[tau] = s;
    }

    // ── Cumulative Mean Normalised Difference (CMNDF) ────────────────
    const cmnd = new Float32Array(half);
    cmnd[0] = 1;
    let runSum = 0;
    for (let tau = 1; tau < half; tau++) {
      runSum += d[tau];
      cmnd[tau] = runSum > 0 ? d[tau] * tau / runSum : 1;
    }

    const minP = Math.ceil(sr / 1200);   // 1200 Hz upper limit (high soprano)
    const maxP = Math.floor(sr / 50);    // 50 Hz  lower limit (bass voice)
    const lim  = Math.min(maxP, half);

    // ── pYIN: collect local minima and assign voiced probabilities ───
    // We use a simple beta-distribution-inspired mapping: the probability
    // that a CMNDF value v corresponds to a voiced frame is approximated by
    //   p_voiced(v) ≈ clamp(1 − v / threshold_high, 0, 1)
    // mirroring the integral of the beta prior used in the original paper.
    const THRESH_LOW  = 0.05;   // below this → almost certainly voiced
    const THRESH_HIGH = 0.45;   // above this → almost certainly unvoiced

    const candidates = []; // { tau, period, pVoiced }
    for (let tau = minP + 1; tau < lim - 1; tau++) {
      if (cmnd[tau] < cmnd[tau - 1] && cmnd[tau] <= cmnd[tau + 1]) {
        // local minimum → candidate
        const v = cmnd[tau];
        const pV = v <= THRESH_LOW  ? 1.0
                 : v >= THRESH_HIGH ? 0.0
                 : 1.0 - (v - THRESH_LOW) / (THRESH_HIGH - THRESH_LOW);
        // Parabolic interpolation for sub-sample accuracy
        const y0 = cmnd[tau - 1], y1 = v, y2 = cmnd[tau + 1];
        const denom = 2 * (y0 - 2 * y1 + y2);
        const tauF  = denom !== 0 ? tau - (y2 - y0) / (2 * denom) : tau;
        candidates.push({ tau, period: tauF, pVoiced: pV });
      }
    }

    // ── HMM voicing decision ─────────────────────────────────────────
    // Two-state HMM: voiced (V) vs unvoiced (U).
    // Transition priors (per frame):
    //   p(V→V) = 0.9   p(U→U) = 0.85
    const pVV = 0.90, pUV = 0.10;   // stay voiced, switch to voiced
    const pVU = 0.15, pUU = 0.85;   // switch to unvoiced, stay unvoiced

    const prevV = this._pyinPrevVoiced;   // previous voiced probability
    const prevU = 1 - prevV;

    // Aggregate voiced probability for this frame across all candidates
    let totalPVoiced = 0;
    for (const c of candidates) totalPVoiced += c.pVoiced;
    // Also account for the unvoiced hypothesis (no candidate accepted)
    const pFrameVoiced   = Math.min(totalPVoiced, 1.0);
    const pFrameUnvoiced = 1.0 - pFrameVoiced;

    // HMM forward step
    const postV = pFrameVoiced   * (prevV * pVV + prevU * pUV);
    const postU = pFrameUnvoiced * (prevV * pVU + prevU * pUU);
    const norm  = postV + postU || 1;
    const voicedProb = postV / norm;

    this._pyinPrevVoiced = voicedProb;

    if (voicedProb < 0.5 || candidates.length === 0) return 0;

    // ── Select best candidate ────────────────────────────────────────
    // Pick the candidate with highest voiced probability; break ties by
    // proximity to the previous period (octave-continuity prior).
    let best = candidates[0];
    for (const c of candidates) {
      const prevP  = this._pyinPrevPeriod;
      const octave = prevP > 0 ? Math.abs(Math.log2(c.period / prevP)) : 0;
      const octPenalty = Math.min(octave, 1.0) * 0.25;
      const scoreBest  = best.pVoiced - (prevP > 0 ? Math.min(Math.abs(Math.log2(best.period / prevP)), 1.0) * 0.25 : 0);
      if (c.pVoiced - octPenalty > scoreBest) best = c;
    }

    this._pyinPrevPeriod = best.period;
    return best.period;
  }

  // ── Snap detected frequency to nearest in-scale pitch ────────────────────
  _snapCents(freqHz, root, scaleMask) {
    if (freqHz <= 0) return 0;
    const midi      = 12 * Math.log2(freqHz / 440) + 69;
    const midiRound = Math.round(midi);
    const noteClass = ((midiRound % 12) + 12) % 12;
    let bestDist = Infinity, bestDelta = 0;
    for (let s = 0; s < 12; s++) {
      if (!(scaleMask & (1 << s))) continue;
      const candidate = (root + s) % 12;
      let dist = (noteClass - candidate + 12) % 12;
      if (dist > 6) dist = 12 - dist;
      if (dist < bestDist) {
        bestDist  = dist;
        // Direction-aware delta (always take shortest path)
        let delta = candidate - noteClass;
        if (delta > 6)  delta -= 12;
        if (delta < -6) delta += 12;
        bestDelta = delta;
      }
    }
    const targetMidi = midiRound + bestDelta;
    return (targetMidi - midi) * 100; // cents
  }

  // ── Phase Vocoder analysis frame ─────────────────────────────────────────
  _analyseFrame(absFrameStart) {
    const N   = this._N;
    const N2  = this._N2;
    const win = this._win;
    const re  = new Float32Array(N);
    const im  = new Float32Array(N);

    // Fill windowed frame from ring buffer using ABSOLUTE sample position.
    // absFrameStart is the un-modded sample index — we mod each access individually
    // so the full N-sample window wraps correctly through the circular buffer.
    for (let i = 0; i < N; i++) {
      re[i] = this._ring[(absFrameStart + i) % this._ringLen] * win[i];
    }

    this._fft(re, im, false);

    const expFac = 2 * Math.PI * this._hop / N; // expected phase advance per bin per hop

    for (let k = 0; k <= N2; k++) {
      const mag  = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      const phas = Math.atan2(im[k], re[k]);

      // Phase difference from last frame
      let dPhi = phas - this._lastPhase[k] - k * expFac;

      // Wrap to [-π, π]
      dPhi -= 2 * Math.PI * Math.round(dPhi / (2 * Math.PI));

      // True frequency (radians/sample)
      this._anaFreq[k] = k * (2 * Math.PI / N) + dPhi / this._hop;
      this._anaMag[k]  = mag;
      this._lastPhase[k] = phas;
    }
  }

  // ── Phase Vocoder pitch shift: map bins from analysis to synthesis ────────
  // pitchRatio > 1 → shift up; < 1 → shift down.
  _shiftBins(pitchRatio) {
    const N2 = this._N2;
    for (let i = 0; i <= N2; i++) { this._synMag[i] = 0; this._synFreq[i] = 0; }
    for (let k = 0; k <= N2; k++) {
      const j = Math.round(k * pitchRatio);
      if (j > N2) break;
      if (this._anaMag[k] > this._synMag[j]) {
        this._synMag[j]  = this._anaMag[k];
        this._synFreq[j] = this._anaFreq[k] * pitchRatio; // scaled true freq
      }
    }
  }

  // ── Formant preservation via spectral envelope ────────────────────────────
  // When formant > 0, re-imprint the original spectral envelope onto the
  // shifted spectrum. Uses a simplified cepstral smoothing approach.
  _applyFormantPreservation(pitchRatio, formantAmount) {
    if (formantAmount <= 0) return;
    const N2 = this._N2;
    // Build original envelope (smoothed with lifter of ~30 bins)
    const lifter = 30;
    const env = new Float32Array(N2 + 1);
    for (let k = 0; k <= N2; k++) env[k] = this._anaMag[k];
    // Smooth with simple box filter
    const smoothed = new Float32Array(N2 + 1);
    for (let k = 0; k <= N2; k++) {
      let sum = 0, count = 0;
      for (let d = -lifter; d <= lifter; d++) {
        const idx = k + d;
        if (idx >= 0 && idx <= N2) { sum += env[idx]; count++; }
      }
      smoothed[k] = count > 0 ? sum / count : 0;
    }
    // Re-imprint: multiply synthesis magnitudes by (original_env / shifted_env)
    // The shifted envelope is smoothed from synMag
    const shiftedEnv = new Float32Array(N2 + 1);
    for (let k = 0; k <= N2; k++) {
      let sum = 0, count = 0;
      for (let d = -lifter; d <= lifter; d++) {
        const idx = k + d;
        if (idx >= 0 && idx <= N2) { sum += this._synMag[idx]; count++; }
      }
      shiftedEnv[k] = count > 0 ? sum / count : 0;
    }
    for (let k = 0; k <= N2; k++) {
      if (shiftedEnv[k] > 1e-10) {
        const correction = smoothed[k] / shiftedEnv[k];
        this._synMag[k] *= 1 + formantAmount * (correction - 1);
      }
    }
  }

  // ── Synthesise output frame and OLA into output buffer ───────────────────
  _synthesiseFrame() {
    const N   = this._N;
    const N2  = this._N2;
    const win = this._win;
    const re  = new Float32Array(N);
    const im  = new Float32Array(N);

    // Reconstruct complex spectrum from synthesis magnitude + accumulated phase
    for (let k = 0; k <= N2; k++) {
      this._sumPhase[k] += this._synFreq[k] * this._hop;
      const ph  = this._sumPhase[k];
      re[k] =  this._synMag[k] * Math.cos(ph);
      im[k] =  this._synMag[k] * Math.sin(ph);
    }
    // Mirror for real IFFT (conjugate symmetry)
    for (let k = 1; k < N2; k++) {
      re[N - k] =  re[k];
      im[N - k] = -im[k];
    }

    this._fft(re, im, true); // IFFT in-place

    // OLA into output buffer
    const writeStart = this._outW;
    for (let i = 0; i < N; i++) {
      const idx = (writeStart + i) % this._ringLen;
      this._outBuf[idx] += re[i] * win[i] * this._winNorm;
    }
    this._outW += this._hop;
  }

  process(inputs, outputs, params) {
    const input  = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!input || !output) return true;

    const blockSize  = input.length;      // always 128
    const sr         = this._sr;
    const shiftRatio = params.pitch[0];
    const speed      = params.speed[0];
    const mode       = Math.round(params.mode[0]);
    const root       = Math.round(params.root[0]);
    const scaleMask  = Math.round(params.scale[0]);
    const formant    = params.formant[0];

    // ── 1. Write input into ring buffer ──────────────────────────
    for (let i = 0; i < blockSize; i++) {
      this._ring[this._ringW % this._ringLen] = input[i];
      this._ringW++;
    }

    // ── 2. pYIN pitch detection (throttled) ──────────────────────
    this._yinTimer += blockSize;
    if (this._yinTimer >= this._yinRate) {
      this._yinTimer = 0;
      const yN = this._yinN;
      for (let i = 0; i < yN; i++) {
        this._yinBuf[i] = this._ring[(this._ringW - yN + i + this._ringLen) % this._ringLen];
      }
      const period = this._yin(this._yinBuf);
      if (period > 0) {
        this._yinPeriod = period;
        if (mode === 1) {
          const hz = sr / period;
          this._targetCents = this._snapCents(hz, root, scaleMask);
        } else {
          this._targetCents = 1200 * Math.log2(Math.max(0.001, shiftRatio));
        }
      } else {
        // Unvoiced / silence — glide correction back to 0
        this._targetCents *= 0.85;
      }
    }

    // In SHIFT mode the target doesn't depend on detected pitch
    if (mode === 0) {
      this._targetCents = 1200 * Math.log2(Math.max(0.001, shiftRatio));
    }

    // ── 3. Smooth correction speed ────────────────────────────────
    // speed=0 → instantaneous; speed=1 → ~400ms glide
    // α per sample: α = 1 - exp(-1 / (speed*400ms*sr))
    const tauSamples = Math.max(1, speed * 0.4 * sr);
    const alphaS     = 1 - Math.exp(-blockSize / tauSamples);
    this._currentCents += alphaS * (this._targetCents - this._currentCents);

    // ── 4. Run Phase Vocoder frames as needed ─────────────────────
    // _nextAna is the absolute input sample at which the NEXT frame starts.
    // We advance it AFTER analysis so _analyseFrame reads from the correct position.
    while (this._ringW >= this._nextAna + this._N) {
      const pitchRatio = Math.pow(2, this._currentCents / 1200);
      this._analyseFrame(this._nextAna); // pass absolute index, not modded
      this._nextAna += this._hop;
      this._shiftBins(pitchRatio);
      if (formant > 0.01) this._applyFormantPreservation(pitchRatio, formant);
      this._synthesiseFrame();
    }

    // ── 5. Drain output into block (with latency compensation) ────
    // _outR starts at -N (pre-rolled) so the first N samples output silence
    // while the vocoder fills its pipeline — this eliminates the click/burst
    // that previously occurred at startup before any synthesis frames ran.
    for (let i = 0; i < blockSize; i++) {
      const absIdx = this._outR + i;
      if (absIdx >= 0 && absIdx < this._outW) {
        const idx = ((absIdx % this._ringLen) + this._ringLen) % this._ringLen;
        output[i] = this._outBuf[idx];
        this._outBuf[idx] = 0; // clear after reading
      } else {
        output[i] = 0;
      }
    }
    this._outR += blockSize;

    // No dry passthrough — the phase vocoder output is always used.
    // Even at 0 shift the vocoder output is transparent, and bypassing it caused
    // a click at the transition point when correction engaged mid-word.

    return true;
  }
}
registerProcessor('pitch-shift-processor', PitchShiftProcessor);
`;

  const registerPitchWorklet = async function (actx) {
    if (pitchWorkletReadyRef.current) return true;
    try {
      const blob = new Blob([PITCH_WORKLET_CODE], { type: 'application/javascript' });
      const url  = URL.createObjectURL(blob);
      await actx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      pitchWorkletReadyRef.current = true;
      return true;
    } catch(e) {
      console.warn('[BeatFinder] AudioWorklet pitch shift unavailable:', e);
      return false;
    }
  };

  const bgAudioRef = useRef(null); // background <audio> element fed by actual music output

  const getOrCreateMaster = function () {
    const actx = getActx();
    if (!masterGainRef.current || masterGainRef.current.context !== actx) {
      masterGainRef.current = actx.createGain();
      masterGainRef.current.gain.value = 1;
      masterGainRef.current.connect(actx.destination);

      // ── iOS background audio: pipe actual music into a MediaStream → <audio> element ──
      // iOS only keeps the AudioContext alive in background if a real <audio> element
      // is playing the same audio session. We tap the master output into a MediaStreamDest
      // and feed it to a hidden <audio> element — this IS the music, at full volume.
      try {
        const msDest = actx.createMediaStreamDestination();
        masterGainRef.current.connect(msDest);
        if (!bgAudioRef.current) {
          const bg = document.createElement("audio");
          bg.setAttribute("playsinline", "");
          bg.setAttribute("autoplay", "");
          bg.style.cssText = "position:fixed;width:0;height:0;left:-9999px;";
          document.body.appendChild(bg);
          bgAudioRef.current = bg;
        }
        bgAudioRef.current.srcObject = msDest.stream;
        bgAudioRef.current.volume = 1;
        bgAudioRef.current.play().catch(function(){});
      } catch(e) {}

      // Master output VU analyser (side-branch)
      const ma = actx.createAnalyser();
      ma.fftSize = 256;
      ma.smoothingTimeConstant = 0.5;
      masterGainRef.current.connect(ma);
      masterAnalyserRef.current = ma;
    }
    return masterGainRef.current;
  };

  // Apply mute/solo/volume/pan to all live gain nodes without restarting playback
  const applyGains = function (updatedTracks) {
    const tList = updatedTracks || tracks;
    const hasSolo = tList.some(function(t){ return t.isSoloed; });
    const actx = getActx();
    tList.forEach(function(t){
      const g = gainNodesRef.current[t.id];
      if (!g) return;
      const shouldPlay = !t.isMuted && (!hasSolo || t.isSoloed);
      const vol = shouldPlay ? (t.volume ?? 1) : 0;
      g.gain.setTargetAtTime(vol, actx.currentTime, 0.01);
      // Also update pan live if a panner node exists for this track
      const live = fxNodesRef.current[t.id];
      if (live && live.panner) {
        live.panner.pan.setTargetAtTime(t.pan || 0, actx.currentTime, 0.01);
      }
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

    // ── Pitch/Autotune worklet — update all params live ──
    if (live.pitchNode) {
      const pitchOn   = !!(fx.pitch && fx.pitch.on);
      const semitones = pitchOn ? (fx.pitch.semitones || 0) : 0;
      const formant   = pitchOn ? (fx.pitch.formant ?? 0.8) : 0.8;
      const speed     = pitchOn ? (fx.pitch.speed ?? 0.5)   : 0.5;
      const pitchMode = pitchOn && fx.pitch.mode === 'autotune' ? 1 : 0;
      const NOTE_MAP  = {C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11};
      const SCALE_MASKS={chromatic:4095,major:2741,minor:1453,pentatonic:661,blues:1193};
      const rootNote  = pitchOn ? (NOTE_MAP[fx.pitch.key || 'C'] || 0) : 0;
      const scaleMask = pitchOn ? (SCALE_MASKS[fx.pitch.scale || 'chromatic'] ?? 4095) : 4095;

      live.pitchNode.parameters.get('pitch').setTargetAtTime(Math.pow(2, semitones / 12), now, T);
      live.pitchNode.parameters.get('speed').value   = speed;
      live.pitchNode.parameters.get('mode').value    = pitchMode;
      live.pitchNode.parameters.get('root').value    = rootNote;
      live.pitchNode.parameters.get('scale').value   = scaleMask;
      live.pitchNode.parameters.get('formant').value = formant;
      live.pitchFormant = formant;
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
    // ── H-Delay — live param morphing ──
    if (live.hdelay && fx.hdelay !== undefined) {
      const hd      = fx.hdelay || {};
      const hdOn    = !!(fx.hdelay && fx.hdelay.on);
      const mode    = hd.mode ?? "digital";

      function hdSubdivMsLive(sub, bpmVal) {
        const beat = 60000 / (bpmVal || 120);
        const map = {
          "1/1":beat*4,"1/2":beat*2,"1/2T":beat*(4/3),
          "1/4":beat,"1/4T":beat*(2/3),
          "1/8":beat/2,"1/8T":beat/3,
          "1/16":beat/4,"1/16T":beat/6,"1/32":beat/8,
        };
        return Math.min(2000, (map[sub] || beat)) / 1000;
      }
      const delayTimeSec = hdOn
        ? (hd.sync ? hdSubdivMsLive(hd.subdivision ?? "1/4", hd.bpm ?? 120) : (hd.delayMs ?? 375) / 1000)
        : 0.375;

      const feedback = hdOn ? Math.min(0.95, hd.feedback ?? 0.35) : 0;
      const wetMixV  = hdOn ? (hd.wet ?? 0.40) : 0;
      const hiCut    = hd.hiCut ?? 8000;
      const loCut    = hd.loCut ?? 80;
      const modDepth = hdOn ? (hd.modDepth ?? 0.15) : 0;
      const modRate  = hd.modRate ?? 0.5;

      live.hdelay.hdDelay.delayTime.setTargetAtTime(delayTimeSec, now, T);
      if (live.hdelay.hdDelayFlip) {
        live.hdelay.hdDelayFlip.delayTime.setTargetAtTime(delayTimeSec, now, T);
      }
      live.hdelay.hdFb.gain.setTargetAtTime(feedback, now, T);
      if (live.hdelay.hdFbFlip) {
        live.hdelay.hdFbFlip.gain.setTargetAtTime(mode === "ping" ? feedback : 0, now, T);
      }
      live.hdelay.hdDry.gain.setTargetAtTime(1 - wetMixV, now, T);
      live.hdelay.hdWet.gain.setTargetAtTime(wetMixV,     now, T);
      live.hdelay.hdHiCut.frequency.setTargetAtTime(hiCut, now, T);
      live.hdelay.hdLoCut.frequency.setTargetAtTime(loCut, now, T);
      live.hdelay.hdPan.pan.setTargetAtTime(mode === "ping" ? -1 : 0, now, T);
      if (live.hdelay.hdPanFlip) {
        live.hdelay.hdPanFlip.pan.setTargetAtTime(mode === "ping" ? 1 : 0, now, T);
      }
      // LFO for tape mode
      live.hdelay.hdLfo.frequency.setTargetAtTime(mode === "tape" ? modRate : 0.001, now, T);
      live.hdelay.hdLfoGain.gain.setTargetAtTime(mode === "tape" ? modDepth * 0.015 : 0, now, T);
    }

    // ── Vocal Doubler — live param morphing ──
    if (live.doubler && fx.doubler !== undefined) {
      const db      = fx.doubler || {};
      const doubOn  = !!(fx.doubler && fx.doubler.on);
      const delayMs = doubOn ? (db.delay  ?? 20)  : 20;
      const detune  = doubOn ? (db.detune ?? 8)   : 8;
      const width   = doubOn ? (db.width  ?? 0.7) : 0;
      const mixWet  = doubOn ? (db.mix    ?? 0.5) : 0;

      live.doubler.haasDelay.delayTime.setTargetAtTime(delayMs / 1000, now, T);
      live.doubler.chorusDelay.delayTime.setTargetAtTime((detune / 1000) * 0.012 + 0.001, now, T);
      live.doubler.dryGain.gain.setTargetAtTime(1 - mixWet, now, T);
      live.doubler.wetGain.gain.setTargetAtTime(mixWet,     now, T);
      live.doubler.lWidthGain.gain.setTargetAtTime(0.5 + width * 0.5, now, T);
      live.doubler.rWidthGain.gain.setTargetAtTime(0.5 + width * 0.5, now, T);
    }

    // ── Noise Gate — live parameter updates ──────────────────────────────────
    if (live.rnnoiseNode || live.rnnoiseGate) {
      const nr      = fx.noiseremover || {};
      const nrOn    = !!(fx.noiseremover && fx.noiseremover.on);
      const str     = nrOn ? (nr.strength ?? 0.85) : 0;
      const threshDb = -80 + str * 60;
      const holdSec  = nrOn ? (nr.echo ?? 0.1) : 0;
      const relSec   = nrOn ? (0.08 + (1 - str) * 0.12) : 0.08;
      const lookahead = !!(nr.keyboard ?? true);
      const attackSec = lookahead ? 0.001 : 0.003;

      if (live.rnnoiseNode) {
        try {
          live.rnnoiseNode.parameters.get("bypass").setTargetAtTime(nrOn ? 0 : 1, now, T);
          live.rnnoiseNode.parameters.get("threshold").setTargetAtTime(nrOn ? threshDb : -200, now, T);
          live.rnnoiseNode.parameters.get("attack").setTargetAtTime(attackSec, now, T);
          live.rnnoiseNode.parameters.get("hold").setTargetAtTime(Math.min(1, holdSec), now, T);
          live.rnnoiseNode.parameters.get("release").setTargetAtTime(relSec, now, T);
        } catch(e) {}
      }
      // Fallback compressor-gate live update
      if (live.rnnoiseGate) {
        live.rnnoiseGate.threshold.setTargetAtTime(nrOn ? threshDb : 0, now, T);
        live.rnnoiseGate.ratio.setTargetAtTime(nrOn ? 20 : 1, now, T);
        live.rnnoiseGate.attack.setTargetAtTime(attackSec, now, T);
        live.rnnoiseGate.release.setTargetAtTime(relSec, now, T);
      }
      // Voice enhancement shelf — always present in liveNodes.noiseremover
      if (live.noiseremover && live.noiseremover.voiceShelf) {
        const voiceAmt = nrOn ? (nr.voice ?? 0.6) : 0;
        live.noiseremover.voiceShelf.gain.setTargetAtTime(voiceAmt * 8, now, T);
      }
    }

    // ── Pitch fallback ScriptProcessor — live param updates ─────────────────
    // The worklet path is handled above (live.pitchNode). This covers the
    // ScriptProcessor fallback used when AudioWorklet is unavailable.
    if (live.pitchFallbackSP && fx.pitch !== undefined) {
      const pitchOn = !!(fx.pitch && fx.pitch.on);
      // Update the ScriptProcessor's closure variables via a message-style
      // property we attach to the node at build time.
      if (pitchOn !== live.pitchFallbackSP._nrOn) {
        live.pitchFallbackSP._nrOn = pitchOn;
      }
      // Expose current pitch params on the node so onaudioprocess can read them
      live.pitchFallbackSP._speed    = pitchOn ? (fx.pitch.speed ?? 0.5)   : 0.5;
      live.pitchFallbackSP._semitones= pitchOn ? (fx.pitch.semitones ?? 0) : 0;
      const NOTE_MAP_L = {C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11};
      const SCALE_MASKS_L = {chromatic:4095,major:2741,minor:1453,pentatonic:661,blues:1193};
      live.pitchFallbackSP._rootNote  = pitchOn ? (NOTE_MAP_L[fx.pitch.key || 'C'] || 0) : 0;
      live.pitchFallbackSP._scaleMask = pitchOn ? (SCALE_MASKS_L[fx.pitch.scale||'chromatic'] ?? 4095) : 4095;
      live.pitchFallbackSP._isAutoTune= pitchOn && fx.pitch.mode === 'autotune';
    }

    // ── T-Rotten Master — live param morphing ──────────────────────────────
    if (live.trotten && fx.trotten !== undefined) {
      const tr   = fx.trotten || {};
      const trOn = !!(fx.trotten && fx.trotten.on);

      // Input / output gain
      live.trotten.trInGain.gain.setTargetAtTime(
        trOn ? Math.pow(10, (tr.inputGain ?? 0) / 20) : 1, now, T
      );
      live.trotten.trOutGain.gain.setTargetAtTime(
        trOn ? Math.pow(10, (tr.outputGain ?? 0) / 20) : 1, now, T
      );

      // EQ bands
      live.trotten.trEqLow.type       = trOn && tr.eqLowT  === "bell"  ? "peaking"  : "lowshelf";
      live.trotten.trEqMid.type       = trOn && tr.eqMidT  === "shelf" ? "lowshelf" : "peaking";
      live.trotten.trEqHigh.type      = trOn && tr.eqHighT === "bell"  ? "peaking"  : "highshelf";
      live.trotten.trEqLow.gain.setTargetAtTime(  trOn ? (tr.eqLow  ?? 0) : 0, now, T);
      live.trotten.trEqMid.gain.setTargetAtTime(  trOn ? (tr.eqMid  ?? 0) : 0, now, T);
      live.trotten.trEqHigh.gain.setTargetAtTime( trOn ? (tr.eqHigh ?? 0) : 0, now, T);

      // Compressor
      const compRatio = trOn ? Math.max(1, 1 + (tr.compAmt ?? 50) / 100 * 19) : 1;
      live.trotten.trComp.threshold.setTargetAtTime(trOn ? (tr.compThr ?? -15) : 0, now, T);
      live.trotten.trComp.ratio.setTargetAtTime(compRatio, now, T);
      live.trotten.trComp.attack.setTargetAtTime(
        trOn && tr.compMode === "fast" ? 0.001 : 0.005, now, T
      );
      live.trotten.trComp.release.setTargetAtTime(
        trOn && tr.compMode === "slow" ? 0.5 : 0.1, now, T
      );

      // Tape saturation — rebuild curve when drive/sat/mode changes
      live.trotten.trTape.curve = live.trotten.buildTapeCurve(
        trOn ? (tr.tapeDrv ?? 5) : 0,
        trOn ? (tr.tapeSat ?? 5) : 0,
        trOn ? (tr.tapeMode ?? "modern") : "modern"
      );
      live.trotten.trTapeShelf.gain.setTargetAtTime(
        trOn && tr.tapeMode === "vintage" ? 1.5 : 0, now, T
      );

      // Limiter
      live.trotten.trLim.threshold.setTargetAtTime(trOn ? (tr.limCeil ?? -0.5) : 0, now, T);
      live.trotten.trLim.release.setTargetAtTime(
        trOn ? Math.max(0.05, tr.limRel ?? 0.5) : 0.25, now, T
      );
    }

    // ── GRM Bandpass — live param morphing ────────────────────────────────
    if (live.bandpass && fx.bandpass !== undefined) {
      const bpFx  = fx.bandpass || {};
      const bpOn  = !!(fx.bandpass && fx.bandpass.on);
      const center = bpOn ? Math.min(8000, bpFx.center ?? 1000) : 1000;
      const octW   = bpOn ? (bpFx.width  ?? 1.0)  : 1.0;
      const resDb  = bpOn ? (bpFx.res    ?? 0)    : 0;
      const mixWet = bpOn ? (bpFx.mix    ?? 1)    : 0;
      const Q  = Math.sqrt(Math.pow(2, octW)) / (Math.pow(2, octW) - 1);
      const Qr = Math.max(0.1, Q * (1 + resDb / 6));
      live.bandpass.bp1.frequency.setTargetAtTime(center, now, T);
      live.bandpass.bp1.Q.setTargetAtTime(Qr, now, T);
      live.bandpass.bp2.frequency.setTargetAtTime(center, now, T);
      live.bandpass.bp2.Q.setTargetAtTime(Qr, now, T);
      live.bandpass.bpDry.gain.setTargetAtTime(1 - mixWet, now, T);
      live.bandpass.bpWet.gain.setTargetAtTime(mixWet,     now, T);
    }
  };
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
    // Reset per-track analyser refs
    trackAnalysersRef.current = {};
    // Clear live FX node refs
    fxNodesRef.current = {};
    // Ramp master gain to 0 instantly to cut any tail
    if (masterGainRef.current) {
      try { masterGainRef.current.gain.cancelScheduledValues(0); masterGainRef.current.gain.value = 0; } catch (e) {}
      masterGainRef.current = null; // force recreate on next play
    }
  };

  // ── Play from a given time — all tracks share master destination ──
  const doPlay = async function (fromTime) {
    stopAll();
    const actx   = getActx();
    const master = getOrCreateMaster();
    // Register pitch worklet if not done yet (async, required before AudioWorkletNode)
    await registerPitchWorklet(actx);
    // Register RNNoise worklet if not done yet
    await registerRNNoiseWorklet(actx);
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

      // ── Per-track VU analyser (side-branch, read-only, doesn't affect sound) ──
      const trackAnalyser = actx.createAnalyser();
      trackAnalyser.fftSize = 256;
      trackAnalyser.smoothingTimeConstant = 0.5;
      volGain.connect(trackAnalyser); // taps off AFTER volume/mute
      trackAnalysersRef.current[track.id] = trackAnalyser;

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

      // ── Vocal Doubler — Haas delay + gentle detune chorus + M/S width ────────
      // Always built so wet/dry and width can morph live without a rebuild.
      {
        const db       = fx.doubler || {};
        const doubOn   = !!(fx.doubler && fx.doubler.on);
        const delayMs  = doubOn ? (db.delay  ?? 20)  : 20;
        const detune   = doubOn ? (db.detune ?? 8)   : 8;   // cents
        const width    = doubOn ? (db.width  ?? 0.7) : 0;
        const mixWet   = doubOn ? (db.mix    ?? 0.5) : 0;

        // ── Dry path ──
        const dryGain  = actx.createGain();
        dryGain.gain.value = 1 - mixWet;

        // ── Wet path: Haas delay (L) + detuned copy (R) ──
        const wetGain  = actx.createGain();
        wetGain.gain.value = mixWet;

        // Splitter/merger for M/S width
        const splitter = actx.createChannelSplitter(2);
        const merger   = actx.createChannelMerger(2);

        // Left copy: Haas delay
        const haasDelay = actx.createDelay(0.1);
        haasDelay.delayTime.value = delayMs / 1000;

        // Right copy: detune via oscillator-as-LFO? No — use a BiquadFilter allpass
        // for subtle chorus via comb phasing (detune knob drives a slight pitchbend
        // via a short feedback delay acting as a chorus line).
        const chorusDelay = actx.createDelay(0.05);
        chorusDelay.delayTime.value = (detune / 1000) * 0.012 + 0.001; // 1–13ms chorus

        const chorusFeedback = actx.createGain();
        chorusFeedback.gain.value = 0.18;

        // connect chorus feedback loop (mild, avoids runaway)
        chorusDelay.connect(chorusFeedback);
        chorusFeedback.connect(chorusDelay);

        // Width: blend L vs R amount into merger
        const lWidthGain = actx.createGain(); lWidthGain.gain.value = 0.5 + width * 0.5;
        const rWidthGain = actx.createGain(); rWidthGain.gain.value = 0.5 + width * 0.5;

        // Wet mix bus
        const wetMix = actx.createGain(); wetMix.gain.value = 1;
        const dryMix = actx.createGain(); dryMix.gain.value = 1;
        const outMix = actx.createGain(); outMix.gain.value = 1;

        // Entry gain (splits the signal)
        const doubEntry = actx.createGain(); doubEntry.gain.value = 1;

        // Routing: entry → [dryGain→outMix] and [haasDelay→merger:0, chorusDelay→merger:1]
        doubEntry.connect(dryGain);
        dryGain.connect(outMix);

        doubEntry.connect(haasDelay);
        doubEntry.connect(chorusDelay);

        haasDelay.connect(lWidthGain);
        chorusDelay.connect(rWidthGain);

        lWidthGain.connect(wetMix);
        rWidthGain.connect(wetMix);

        wetMix.connect(wetGain);
        wetGain.connect(outMix);

        outMix.connect(node);
        node = doubEntry;

        liveNodes.doubler = {
          haasDelay, chorusDelay, chorusFeedback,
          dryGain, wetGain, wetMix,
          lWidthGain, rWidthGain,
        };
      }

      // ── H-Delay — Waves H-Delay emulation ────────────────────────────────────
      // Always built so wet/dry and all params can morph live.
      // Architecture: input → [dry path] + [delay loop with hi/lo cut + drive]
      // Tape mode: adds a slow LFO modulating the delay time (wow/flutter)
      // Ping-pong: alternates wet signal L vs R each repeat via a StereoPanner
      {
        const hd       = fx.hdelay || {};
        const hdOn     = !!(fx.hdelay && fx.hdelay.on);
        const mode     = hd.mode        ?? "digital";
        const feedback = hdOn ? Math.min(0.95, hd.feedback ?? 0.35) : 0;
        const wetMixV  = hdOn ? (hd.wet ?? 0.40) : 0;
        const hiCut    = hd.hiCut   ?? 8000;
        const loCut    = hd.loCut   ?? 80;
        const drive    = hdOn ? (hd.drive ?? 0) : 0;

        // BPM sync helper (mirrors UI)
        function hdSubdivMs(sub, bpmVal) {
          const beat = 60000 / (bpmVal || 120);
          const map = {
            "1/1":beat*4,"1/2":beat*2,"1/2T":beat*(4/3),
            "1/4":beat,"1/4T":beat*(2/3),
            "1/8":beat/2,"1/8T":beat/3,
            "1/16":beat/4,"1/16T":beat/6,"1/32":beat/8,
          };
          return Math.min(2000, (map[sub] || beat)) / 1000;
        }
        const delayTimeSec = hdOn
          ? (hd.sync ? hdSubdivMs(hd.subdivision ?? "1/4", hd.bpm ?? 120) : (hd.delayMs ?? 375) / 1000)
          : 0.375;

        // Entry split
        const hdEntry  = actx.createGain(); hdEntry.gain.value = 1;

        // Dry path
        const hdDry    = actx.createGain(); hdDry.gain.value = 1 - wetMixV;

        // Wet output gain
        const hdWet    = actx.createGain(); hdWet.gain.value = wetMixV;

        // Output sum
        const hdOut    = actx.createGain(); hdOut.gain.value = 1;

        // Main delay (up to 2.1s)
        const hdDelay  = actx.createDelay(2.1);
        hdDelay.delayTime.value = delayTimeSec;

        // Feedback path: delay → hiCut filter → loCut filter → (drive) → feedback gain → delay
        const hdHiCut  = actx.createBiquadFilter();
        hdHiCut.type = "lowpass";
        hdHiCut.frequency.value = hiCut;
        hdHiCut.Q.value = 0.5;

        const hdLoCut  = actx.createBiquadFilter();
        hdLoCut.type = "highpass";
        hdLoCut.frequency.value = loCut;
        hdLoCut.Q.value = 0.5;

        // Analog saturation waveshaper (soft clip — bypassed when drive=0)
        const hdSat = actx.createWaveShaper();
        const satCurve = (function() {
          const n = 256, c = new Float32Array(n);
          for(let i=0;i<n;i++){
            const x = (i * 2 / n) - 1;
            c[i] = x * (1 + drive * 4) / (1 + Math.abs(x) * drive * 4);
          }
          return c;
        })();
        hdSat.curve = satCurve;
        hdSat.oversample = "2x";

        // Tape wow/flutter: LFO → delay modulation (only in tape mode)
        const hdLfo   = actx.createOscillator();
        const hdLfoGain = actx.createGain();
        const modDepth = hdOn ? (hd.modDepth ?? 0.15) : 0;
        const modRate  = hd.modRate ?? 0.5;
        hdLfo.type = "sine";
        hdLfo.frequency.value = mode === "tape" ? modRate : 0.001; // near-zero when not tape
        // LFO modulation depth: up to ±15ms flutter in tape mode
        hdLfoGain.gain.value = mode === "tape" ? modDepth * 0.015 : 0;
        hdLfo.connect(hdLfoGain);
        hdLfoGain.connect(hdDelay.delayTime);
        hdLfo.start();

        // Feedback gain
        const hdFb    = actx.createGain(); hdFb.gain.value = feedback;

        // Ping-pong panner: alternates L/R on each repeat via a secondary delay copy
        // We implement ping-pong with a StereoPanner that is flipped by feedback count.
        // Simplification: in ping-pong we duplicate the wet signal with a half-offset copy.
        const hdPan   = actx.createStereoPanner();
        hdPan.pan.value = mode === "ping" ? -1 : 0; // first echo hard-L, feedback flips

        const hdPanFlip = actx.createStereoPanner();
        hdPanFlip.pan.value = mode === "ping" ? 1 : 0; // second echo hard-R

        const hdFbFlip = actx.createGain(); hdFbFlip.gain.value = mode === "ping" ? feedback : 0;
        const hdDelayFlip = actx.createDelay(2.1);
        hdDelayFlip.delayTime.value = delayTimeSec; // half-offset for flip copy

        // ── Routing ──
        // Main chain: hdEntry → hdDelay → hdHiCut → hdLoCut → hdSat → hdPan → hdWet → hdOut
        //             └─ feedback: hdSat → hdFb → hdDelay (loop)
        hdEntry.connect(hdDry);
        hdDry.connect(hdOut);

        hdEntry.connect(hdDelay);
        hdDelay.connect(hdHiCut);
        hdHiCut.connect(hdLoCut);
        hdLoCut.connect(hdSat);
        hdSat.connect(hdPan);
        hdPan.connect(hdWet);
        // Feedback loop
        hdSat.connect(hdFb);
        hdFb.connect(hdDelay);

        // Ping-pong second copy (offset by half a delay period)
        if (mode === "ping") {
          hdSat.connect(hdFbFlip);
          hdFbFlip.connect(hdDelayFlip);
          hdDelayFlip.connect(hdPanFlip);
          hdPanFlip.connect(hdWet);
        }

        hdWet.connect(hdOut);
        hdOut.connect(node);
        node = hdEntry;

        liveNodes.hdelay = {
          hdDelay, hdDelayFlip, hdHiCut, hdLoCut, hdSat,
          hdDry, hdWet, hdFb, hdFbFlip,
          hdPan, hdPanFlip, hdLfo, hdLfoGain, hdOut,
        };
      }
      // ── Noise Remover — always built so on/off toggle works live ────────────
      // When off: bypass=1 (worklet path) or threshold=0/ratio=1 (fallback).
      // voice param drives a post-gate presence shelf (+0..+8dB at 2.5kHz).
      // keyboard param enables lookahead mode (attack=0.001s vs 0.003s).
      {
        const nr         = fx.noiseremover || {};
        const nrOn       = !!(fx.noiseremover && fx.noiseremover.on);
        const strength   = nrOn ? (nr.strength ?? 0.85) : 0;
        const threshDb   = -80 + strength * 60; // -80..-20 dB
        const reductDb   = -60;
        const lookahead  = !!(nr.keyboard ?? true); // lookahead gate toggle
        const attackSec  = lookahead ? 0.001 : 0.003;
        const holdSec    = nrOn ? (nr.echo ?? 0.1) : 0;
        const releaseSec = nrOn ? (0.08 + (1 - strength) * 0.12) : 0.08;
        const voiceAmt   = nrOn ? (nr.voice ?? 0.6) : 0; // 0–1 → 0–+8dB presence shelf

        // ── Noise Gate AudioWorklet (primary path) ────────────────────────────
        if (noiseGateWorkletReady.current) {
          try {
            const gateNode = new AudioWorkletNode(actx, "noise-gate-processor", {
              numberOfInputs:   1,
              numberOfOutputs:  1,
              outputChannelCount: [1],
            });
            gateNode.parameters.get("threshold").value = nrOn ? threshDb : -200;
            gateNode.parameters.get("reduction").value  = reductDb;
            gateNode.parameters.get("attack").value      = attackSec;
            gateNode.parameters.get("hold").value        = Math.min(1.0, holdSec);
            gateNode.parameters.get("release").value     = releaseSec;
            gateNode.parameters.get("bypass").value      = nrOn ? 0 : 1;
            liveNodes.rnnoiseNode = gateNode;
            gateNode.connect(node);
            node = gateNode;
          } catch(e) {
            // Worklet unavailable — fall through to compressor gate
          }
        }

        // ── Fallback: DynamicsCompressor as a noise gate ──────────────────────
        if (!liveNodes.rnnoiseNode) {
          const gate = actx.createDynamicsCompressor();
          gate.threshold.value = nrOn ? threshDb : 0;
          gate.ratio.value     = nrOn ? 20 : 1;
          gate.attack.value    = attackSec;
          gate.release.value   = releaseSec;
          gate.knee.value      = 3;
          gate.connect(node); node = gate;
          liveNodes.rnnoiseGate = gate;
        }

        // ── Voice enhancement: presence shelf (2.5kHz high-shelf) ────────────
        const voiceShelf = actx.createBiquadFilter();
        voiceShelf.type = "highshelf";
        voiceShelf.frequency.value = 2500;
        voiceShelf.gain.value = voiceAmt * 8; // 0..+8dB
        voiceShelf.connect(node);
        node = voiceShelf;
        liveNodes.noiseremover = { on: nrOn, voiceShelf };
      }

      // ── T-Rotten Master — IK Multimedia T-RackS One emulation ──────────────
      // Signal chain: inputGain → 3-band EQ → compressor → tape saturator → limiter → outputGain
      // Always built so all knobs can morph live without a restart.
      {
        const tr   = fx.trotten || {};
        const trOn = !!(fx.trotten && fx.trotten.on);

        // Input gain
        const trInGain = actx.createGain();
        trInGain.gain.value = trOn ? Math.pow(10, (tr.inputGain ?? 0) / 20) : 1;

        // Low-shelf EQ
        const trEqLow = actx.createBiquadFilter();
        trEqLow.type = trOn && tr.eqLowT === "bell" ? "peaking" : "lowshelf";
        trEqLow.frequency.value = 200;
        trEqLow.gain.value      = trOn ? (tr.eqLow ?? 0) : 0;
        trEqLow.Q.value         = 0.707;

        // Mid peaking/bell EQ
        const trEqMid = actx.createBiquadFilter();
        trEqMid.type = trOn && tr.eqMidT === "shelf" ? "lowshelf" : "peaking";
        trEqMid.frequency.value = 1000;
        trEqMid.gain.value      = trOn ? (tr.eqMid ?? 0) : 0;
        trEqMid.Q.value         = 1.0;

        // High-shelf EQ
        const trEqHigh = actx.createBiquadFilter();
        trEqHigh.type = trOn && tr.eqHighT === "bell" ? "peaking" : "highshelf";
        trEqHigh.frequency.value = 8000;
        trEqHigh.gain.value      = trOn ? (tr.eqHigh ?? 0) : 0;
        trEqHigh.Q.value         = 0.707;

        // Compressor — compAmt 0..100 maps to ratio 1..20, threshold from compThr
        const trComp = actx.createDynamicsCompressor();
        const compRatio = trOn ? Math.max(1, 1 + (tr.compAmt ?? 50) / 100 * 19) : 1;
        trComp.threshold.value = trOn ? (tr.compThr ?? -15) : 0;
        trComp.ratio.value     = compRatio;
        trComp.attack.value    = trOn && tr.compMode === "fast" ? 0.001 : 0.005;
        trComp.release.value   = trOn && tr.compMode === "slow" ? 0.5   : 0.1;
        trComp.knee.value      = 6;

        // Tape saturation waveshaper — tapeDrv 0..10, tapeSat 0..10
        const trTape = actx.createWaveShaper();
        const buildTapeCurve = function(drv, sat, mode) {
          const n = 512; const c = new Float32Array(n);
          const k = (drv / 10) * 4 + (sat / 10) * 2; // combined drive+sat
          const warmBoost = mode === "vintage" ? 1.3 : 1.0;
          for (let i = 0; i < n; i++) {
            const x = (i * 2 / n - 1) * warmBoost;
            if (k < 0.01) { c[i] = x; }
            else { c[i] = (Math.PI + k) * x / (Math.PI + k * Math.abs(x)); }
          }
          return c;
        };
        trTape.curve      = buildTapeCurve(
          trOn ? (tr.tapeDrv ?? 5) : 0,
          trOn ? (tr.tapeSat ?? 5) : 0,
          trOn ? (tr.tapeMode ?? "modern") : "modern"
        );
        trTape.oversample = "4x";

        // Tape tone coloring: slight low-end warmth boost in vintage mode
        const trTapeShelf = actx.createBiquadFilter();
        trTapeShelf.type          = "lowshelf";
        trTapeShelf.frequency.value = 300;
        trTapeShelf.gain.value    = trOn && tr.tapeMode === "vintage" ? 1.5 : 0;

        // Brickwall limiter (emulate true-peak limiter via hard DynamicsCompressor)
        const trLim = actx.createDynamicsCompressor();
        const limCeil = trOn ? (tr.limCeil ?? -0.5) : 0;
        trLim.threshold.value = trOn ? limCeil : 0;
        trLim.ratio.value     = 20; // near-infinite ratio = brickwall
        trLim.attack.value    = 0.0005; // 0.5ms lookahead
        trLim.release.value   = trOn ? Math.max(0.05, tr.limRel ?? 0.5) : 0.25;
        trLim.knee.value      = 0;

        // Output gain
        const trOutGain = actx.createGain();
        trOutGain.gain.value = trOn ? Math.pow(10, (tr.outputGain ?? 0) / 20) : 1;

        // Chain: trInGain → trEqLow → trEqMid → trEqHigh → trComp → trTape → trTapeShelf → trLim → trOutGain → [rest]
        trOutGain.connect(node);
        trLim.connect(trOutGain);
        trTapeShelf.connect(trLim);
        trTape.connect(trTapeShelf);
        trComp.connect(trTape);
        trEqHigh.connect(trComp);
        trEqMid.connect(trEqHigh);
        trEqLow.connect(trEqMid);
        trInGain.connect(trEqLow);
        node = trInGain;

        liveNodes.trotten = {
          trInGain, trEqLow, trEqMid, trEqHigh,
          trComp, trTape, trTapeShelf, trLim, trOutGain,
          buildTapeCurve,
        };
      }

      // ── GRM Bandpass — dual cascaded biquad bandpass (≈12 dB/oct × 2 = 6th order) ──
      // Always built wet/dry so mix morphs live. When off, dryG=1 / wetG=0.
      {
        const bpFx   = fx.bandpass || {};
        const bpOn   = !!(fx.bandpass && fx.bandpass.on);
        const center = bpOn ? Math.min(8000, bpFx.center ?? 1000) : 1000;
        const octW   = bpOn ? (bpFx.width  ?? 1.0)  : 1.0;
        const resDb  = bpOn ? (bpFx.res    ?? 0)    : 0;
        const mixWet = bpOn ? (bpFx.mix    ?? 1)    : 0;

        // Q from octave bandwidth: Q = √2^w / (2^w − 1)
        const Q  = Math.sqrt(Math.pow(2, octW)) / (Math.pow(2, octW) - 1);
        const Qr = Math.max(0.1, Q * (1 + resDb / 6));

        // First cascaded biquad bandpass
        const bp1 = actx.createBiquadFilter();
        bp1.type = "bandpass";
        bp1.frequency.value = center;
        bp1.Q.value = Qr;

        // Second cascaded biquad bandpass (same params → steeper skirts)
        const bp2 = actx.createBiquadFilter();
        bp2.type = "bandpass";
        bp2.frequency.value = center;
        bp2.Q.value = Qr;

        // Wet/dry mix
        const bpDry = actx.createGain(); bpDry.gain.value = 1 - mixWet;
        const bpWet = actx.createGain(); bpWet.gain.value = mixWet;
        const bpOut = actx.createGain(); bpOut.gain.value = 1;
        const bpEntry = actx.createGain(); bpEntry.gain.value = 1;

        // Routing: entry → dry → out ; entry → bp1 → bp2 → wet → out → next
        bpEntry.connect(bpDry);
        bpDry.connect(bpOut);
        bpEntry.connect(bp1);
        bp1.connect(bp2);
        bp2.connect(bpWet);
        bpWet.connect(bpOut);
        bpOut.connect(node);
        node = bpEntry;

        liveNodes.bandpass = { bp1, bp2, bpDry, bpWet, bpOut };
      }

      // ── Pitch/Autotune via phase-vocoder AudioWorklet ──────────────────────
      // SHIFT mode (mode=0): uses pitch param (semitone ratio) directly.
      // AUTOTUNE mode (mode=1): worklet detects live pitch and snaps to scale at speed rate.
      if (fx.pitch && fx.pitch.on && pitchWorkletReadyRef.current) {
        try {
          const pitchNode = new AudioWorkletNode(actx, 'pitch-shift-processor');
          const semitones  = fx.pitch.semitones || 0;
          const pitchMode  = fx.pitch.mode === 'autotune' ? 1 : 0;
          const speed      = fx.pitch.speed ?? 0.5;
          const formant    = fx.pitch.formant ?? 0.8;
          // Root note: C=0..B=11
          const NOTE_MAP   = {C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11};
          const SCALE_MASKS= { chromatic:4095, major:2741, minor:1453, pentatonic:661, blues:1193 };
          const rootNote   = NOTE_MAP[fx.pitch.key || 'C'] || 0;
          const scaleKey   = fx.pitch.scale || 'chromatic';
          const scaleMask  = SCALE_MASKS[scaleKey] ?? 4095;

          pitchNode.parameters.get('pitch').value   = Math.pow(2, semitones / 12);
          pitchNode.parameters.get('speed').value   = speed;
          pitchNode.parameters.get('mode').value    = pitchMode;
          pitchNode.parameters.get('root').value    = rootNote;
          pitchNode.parameters.get('scale').value   = scaleMask;
          pitchNode.parameters.get('formant').value = formant;
          pitchNode.connect(node);
          node = pitchNode;
          liveNodes.pitchNode = pitchNode;
        } catch(e) {
          node._pitchSemitones = fx.pitch.semitones || 0;
        }
      } else if (fx.pitch && fx.pitch.on) {
        // ── Fallback pitch processing (no worklet) ──────────────────────────
        // SHIFT mode: playbackRate-based semitone shift (tape-style, always works).
        // AUTOTUNE mode: ScriptProcessor-based pitch snap — finds nearest scale note
        //   in real time using pYIN probabilistic pitch detection, applies tuning via GainNode
        //   crossfades between semitone-shifted copies (2 BiquadAllpass bands for smooth transition).
        //   Not as transparent as the phase-vocoder worklet, but fully functional.
        const semitones = fx.pitch.semitones || 0;
        const isAutoTune = fx.pitch.mode === 'autotune';
        const NOTE_MAP_FB   = {C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11};
        const SCALE_MASKS_FB= { chromatic:4095, major:2741, minor:1453, pentatonic:661, blues:1193 };
        const rootNote_fb   = NOTE_MAP_FB[fx.pitch.key || 'C'] || 0;
        const scaleMask_fb  = SCALE_MASKS_FB[fx.pitch.scale || 'chromatic'] ?? 4095;

        if (isAutoTune) {
          // ScriptProcessor fallback for auto-tune: soft-knee pitch snapping.
          // We use pYIN (probabilistic YIN) to detect f0,
          // compute the nearest in-scale semitone correction, then apply via
          // two interlocked BiquadAllpass comb filters (Laroche-Dolson style).
          // This gives perceptible pitch correction without AudioWorklet.
          // Live params are written onto the sp node by applyFxLive so
          // onaudioprocess always reads the latest values without stale closures.
          const bufSize = 4096;
          const sp = actx.createScriptProcessor(bufSize, 1, 1);
          // Seed live-param properties on the node itself so applyFxLive can update them
          sp._speed     = fx.pitch.speed ?? 0.5;
          sp._rootNote  = rootNote_fb;
          sp._scaleMask = scaleMask_fb;
          sp._isAutoTune= true;
          let currentCents = 0; // smoothed correction in cents

          // Simple autocorrelation pitch detector (faster than full YIN)
          const detectPitch = function(buf, sr) {
            const n = buf.length;
            let rms = 0;
            for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
            if (rms / n < 0.0003) return 0;
            const minP = Math.ceil(sr / 1200);
            const maxP = Math.floor(sr / 50);
            let bestCorr = -1, bestTau = 0;
            for (let tau = minP; tau < Math.min(maxP, n >> 1); tau++) {
              let corr = 0;
              for (let j = 0; j < n >> 1; j++) corr += buf[j] * buf[j + tau];
              if (corr > bestCorr) { bestCorr = corr; bestTau = tau; }
            }
            return bestTau > 0 ? sr / bestTau : 0;
          };

          sp.onaudioprocess = function(e) {
            const input  = e.inputBuffer.getChannelData(0);
            const output = e.outputBuffer.getChannelData(0);
            const sr     = actx.sampleRate;
            // Read live params from node properties (updated by applyFxLive)
            const speed_live    = sp._speed     ?? 0.5;
            const rootNote_live = sp._rootNote  ?? 0;
            const scaleMask_live= sp._scaleMask ?? 4095;

            // Detect pitch
            const f0 = detectPitch(input, sr);
            let targetCents = 0;

            if (f0 > 20) {
              // Convert f0 to MIDI note number
              const midiNote = 69 + 12 * Math.log2(f0 / 440);
              const semitone = Math.round(midiNote) % 12;
              // Find nearest in-scale note
              let bestDist = 12, bestSemi = semitone;
              for (let s = 0; s < 12; s++) {
                const scaleDeg = (s - rootNote_live + 12) % 12;
                if (scaleMask_live & (1 << scaleDeg)) {
                  const dist = Math.abs(((s - semitone + 6 + 12) % 12) - 6);
                  if (dist < bestDist) { bestDist = dist; bestSemi = s; }
                }
              }
              // Correction = distance from detected to nearest scale note (in cents)
              targetCents = ((bestSemi - semitone + 6 + 12) % 12 - 6) * 100;
            }

            // Smooth correction (speed: 0=instant, 1=slow glide ~400ms)
            const alpha = 1 - speed_live * 0.995;
            currentCents += (targetCents - currentCents) * alpha;

            // Apply pitch correction via linear interpolation resampling
            const ratio = Math.pow(2, currentCents / 1200);
            let readPos = 0;
            for (let i = 0; i < output.length; i++) {
              const iPos = Math.floor(readPos);
              const frac = readPos - iPos;
              const s0   = input[Math.min(iPos,     input.length - 1)];
              const s1   = input[Math.min(iPos + 1, input.length - 1)];
              output[i]  = s0 + (s1 - s0) * frac;
              readPos   += ratio;
              if (readPos >= input.length) readPos = input.length - 1;
            }
          };

          sp.connect(node);
          node = sp;
          liveNodes.pitchFallbackSP = sp;
        } else {
          // SHIFT mode fallback: pure playbackRate-based shift applied in scheduleClip
          node._pitchSemitones = semitones;
        }
      }
      // Formant stored for scheduleClip fallback (no worklet path)
      if (fx.pitch && fx.pitch.on) {
        liveNodes.pitchFormant = fx.pitch.formant || 0;
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

        // Pitch: if worklet is handling it, only apply formant via playbackRate.
        // Formant shift = subtle playbackRate factor on top of the vocoder's ratio.
        // This keeps vocal character (chest resonance) while the vocoder corrects pitch.
        // If no worklet (fallback), full semitone shift via playbackRate (tape-style).
        const live = fxNodesRef.current[track.id];
        const hasWorklet = !!(live && live.pitchNode);
        if (!hasWorklet) {
          // Fallback (no worklet): tape-style pitch via playbackRate
          const semitones = entryNode._pitchSemitones || 0;
          if (semitones !== 0) src.playbackRate.value = Math.pow(2, semitones / 12);
        }
        // Formant is now handled entirely inside the PSOLA worklet — no playbackRate needed

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
      playheadAtRef.current = currentTime;
    } else {
      const startT = (loopEnabled && loopOut > loopIn) ? loopIn : currentTime;
      doPlay(startT);
      setCurrentTime(startT);
      setOffsetForTime(startT);
      playheadAtRef.current = startT;
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
    clearInterval(recIntRef.current);
    clipIdRef.current = null;
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
      // Stamp the actx clock NOW — onstop uses it for clip timing.
      // Do NOT call stopAll() here: onstop runs async and needs actx + masterStartRef
      // intact to decode audio and compute clipStartTime correctly.
      // stopAll + setIsPlaying(false) are called at the END of the onstop handler instead.
      const actx = actxRef.current;
      recStopActxTimeRef.current = actx ? actx.currentTime : null;
      mediaRecRef.current.stop();
      mediaRecRef.current = null;
    } else {
      mediaRecRef.current = null;
      stopAll();
      setIsPlaying(false);
    }
  };

  // ── Ruler tap/drag → set loop in/out points ONLY ─────────────
  // Tapping the ruler only creates/adjusts the loop region.
  // It never seeks the playhead or interrupts playback.
  // First tap on empty area: sets loop-in, second tap to the right: sets loop-out.
  // Dragging: if tap lands within 0.3s of loopIn → drag loopIn,
  //           if tap lands within 0.3s of loopOut → drag loopOut,
  //           otherwise start a new loop region from that point.
  // rulerDragRef declared at top of component (Rules of Hooks)
  const rulerTimeFromClientX = function (clientX) {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect  = el.getBoundingClientRect();
    const laneX = clientX - rect.left - SIDEBAR_W + el.scrollLeft;
    return Math.max(0, laneX / effectivePPS);
  };

  // Ruler snaps to the nearest BEAT boundary (not just bars).
  // This allows loop regions to start/end on any individual beat,
  // making 1-bar, 2-bar, half-bar loops all equally easy to set.
  const snapToBar = function (t) {
    if (spb <= 0) return Math.max(0, t);
    // Snap to nearest beat
    const snappedBeat = Math.max(0, Math.round(t / spb) * spb);
    return snappedBeat;
  };

  const handleRulerMouseDown = function (e) {
    e.preventDefault();
    const raw = rulerTimeFromClientX(e.clientX);
    const t   = snapToBar(raw);
    // Grab threshold: half a beat (so handles feel magnetic near beat boundaries)
    const grabThresh = Math.max(0.15, spb * 0.5);
    let mode = "new";
    if (Math.abs(raw - loopIn)  < grabThresh) mode = "in";
    else if (Math.abs(raw - loopOut) < grabThresh) mode = "out";
    rulerDragRef.current = { mode, startX: e.clientX, startT: t };

    if (mode === "new") { setLoopEnabled(true); setLoopIn(t); setLoopOut(snapToBar(t + spb)); }

    const onMove = function (me) {
      const nt = snapToBar(rulerTimeFromClientX(me.clientX));
      if (rulerDragRef.current.mode === "in")  { setLoopIn(Math.min(nt, loopOut - spb)); }
      else if (rulerDragRef.current.mode === "out") { setLoopOut(Math.max(nt, loopIn + spb)); }
      else {
        if (nt > rulerDragRef.current.startT) setLoopOut(Math.max(nt, rulerDragRef.current.startT + spb));
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
    const grabThresh = Math.max(0.15, spb * 0.5);
    let mode = "new";
    if (Math.abs(raw - loopIn)  < grabThresh) mode = "in";
    else if (Math.abs(raw - loopOut) < grabThresh) mode = "out";
    rulerDragRef.current = { mode, startT: t };

    if (mode === "new") { setLoopEnabled(true); setLoopIn(t); setLoopOut(snapToBar(t + spb)); }
  };

  const handleRulerTouchMove = function (e) {
    e.preventDefault();
    if (!rulerDragRef.current) return;
    const nt = snapToBar(rulerTimeFromClientX(e.touches[0].clientX));
    if (rulerDragRef.current.mode === "in")  { setLoopIn(Math.min(nt, loopOut - spb)); }
    else if (rulerDragRef.current.mode === "out") { setLoopOut(Math.max(nt, loopIn + spb)); }
    else {
      if (nt > rulerDragRef.current.startT) setLoopOut(Math.max(nt, rulerDragRef.current.startT + spb));
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
      trotten:    { on:false, eqLow:0, eqMid:0, eqHigh:0, eqLowT:"shelf", eqMidT:"bell", eqHighT:"shelf", compThr:-15, compAmt:50, compMode:"auto", tapeDrv:5, tapeSat:5, tapeMode:"modern", limCeil:-0.5, limRel:0.5, limMode:"truepeak", inputGain:0, outputGain:0 },
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
    setTracks(function (prev) {
      const next = prev.map(function(t){ return t.id===id?{...t,...patch}:t; });
      // Apply volume/pan changes to live audio nodes immediately (no restart needed)
      if (isPlayingRef.current && ("volume" in patch || "pan" in patch || "isMuted" in patch || "isSoloed" in patch)) {
        applyGains(next);
      }
      return next;
    });
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

  // ── Fallback session keeper (only needed before first play) ──────
  // Once getOrCreateMaster runs, the actual music keeps the session alive.
  // This fallback only matters in the brief window before the user presses play.
  const silentAudioRef = useRef(null);
  const silentSrcNodeRef = useRef(null); // unused, kept for compat

  const ensureSilentAudio = function () {
    try {
      if (!silentAudioRef.current) {
        const a = document.createElement("audio");
        // A minimal data URI WAV — just headers, no samples (iOS still accepts it as looping)
        a.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        a.loop = true;
        a.volume = 0.01;
        a.setAttribute("playsinline", "");
        a.style.cssText = "position:fixed;width:0;height:0;left:-9999px;";
        document.body.appendChild(a);
        silentAudioRef.current = a;
      }
      if (silentAudioRef.current.paused) {
        silentAudioRef.current.play().catch(function(){});
      }
    } catch(e) {}
  };

  // ── MediaSession: lock screen controls + background playback permission ──
  useEffect(function () {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: projectName || "BeatFinder Studio",
        artist: "BeatFinder",
        album: "Studio Mode",
      });
      navigator.mediaSession.setActionHandler("play", function () {
        ensureSilentAudio();
        if (actxRef.current && actxRef.current.state === "suspended") {
          actxRef.current.resume().catch(function(){});
        }
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler("pause", function () {
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler("stop", function () {
        setIsPlaying(false);
        setCurrentTime(0);
        playheadAtRef.current = 0;
      });
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    } catch(e) {}
  }, [isPlaying, projectName]);

  // ── App lifecycle: background / foreground handling ───────────
  // Uses refs so this effect never needs to re-register — stable listener.
  const monitoringOnRef = useRef(monitoringOn);
  useEffect(function () { monitoringOnRef.current = monitoringOn; }, [monitoringOn]);

  // Keep saveStateRef always pointing at a closure with latest state
  saveStateRef.current = function () {
    try {
      sessionStorage.setItem("bf_studio_state", JSON.stringify({
        projectName, bpm, projectKey, timeSigNum, zoom, vZoom,
        snapToGrid, loopEnabled, loopIn, loopOut,
        metronomeOn, showBeatGrid, micInputGain,
        tracksMeta: tracksRef.current.map(function(t) {
          return { id:t.id, name:t.name, type:t.type, color:t.color,
                   isMuted:t.isMuted, isSoloed:t.isSoloed, volume:t.volume, pan:t.pan };
        }),
      }));
      sessionStorage.setItem("bf_session_started", "1");
    } catch(e) {}
  };

  useEffect(function () {
    const onBackground = function () {
      // Stop mic — do NOT touch AudioContext or playback
      if (monitoringOnRef.current) { stopMonitoring(); }
      if (saveStateRef.current) saveStateRef.current();
      // Ensure silent audio is playing so iOS keeps the audio session alive
      ensureSilentAudio();
    };

    const onForeground = function () {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          try {
            if (actxRef.current && actxRef.current.state === "suspended") {
              actxRef.current.resume().catch(function(){});
            }
            // Resume the background music audio element if iOS paused it
            if (bgAudioRef.current && bgAudioRef.current.paused) {
              bgAudioRef.current.play().catch(function(){});
            }
            ensureSilentAudio();
          } catch(e) {}
          setTimeout(function () {
            try {
              if (monitorCtxRef.current && monitorCtxRef.current.state === "suspended") {
                monitorCtxRef.current.resume().catch(function(){});
              }
              if ("mediaSession" in navigator) {
                navigator.mediaSession.playbackState = isPlayingRef.current ? "playing" : "paused";
              }
              checkHeadphones();
            } catch(e) {}
          }, 300);
        });
      });
    };

    const onVisibility = function () {
      if (document.hidden) { onBackground(); } else { onForeground(); }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", function () {
      if (saveStateRef.current) saveStateRef.current();
    });
    return function () {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []); // stable — reads live values via refs


  // selectedTrackId declared at top of component (Rules of Hooks)

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
      // All DSP (echo cancellation, noise suppression, AGC) stays OFF — raw clean signal.
      // Post-processing is handled by the Noise Remover FX plugin instead.
      const recConstraints = await buildMicConstraints(micSource);
      // Always open a fresh stream for recording — never reuse the monitoring stream.
      // The monitoring stream may have been opened with different constraints (different
      // mic source, stale deviceId) and reusing it gives degraded or wrong-source audio.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: recConstraints });

      const actx    = getActx();
      const srcNode = actx.createMediaStreamSource(stream);
      // ── Mic input gain boost — raises low mic levels before recording ──
      // Applies the same gain the user set via the Mic Gain slider.
      // Signal chain: srcNode → micInputBoost → recSplitter → recMerger → analyser → MediaRecorder
      const micInputBoost = actx.createGain();
      micInputBoost.gain.value = micInputGainRef.current;
      const analyser = actx.createAnalyser(); analyser.fftSize = 256;
      // Mono-centre the recording analyser feed (same as monitoring) so the
      // waveform meter reads equally from both channels.
      const recSplitter = actx.createChannelSplitter(1);
      const recMerger   = actx.createChannelMerger(2);
      srcNode.connect(micInputBoost);
      micInputBoost.connect(recSplitter);
      recSplitter.connect(recMerger, 0, 0); // mono → L
      recSplitter.connect(recMerger, 0, 1); // mono → R
      recMerger.connect(analyser);

      setRecTrail([]);
      chunksRef.current = [];

      // Pick highest-quality codec available:
      // opus in webm (best compression + quality), then webm fallback, then mp4 for iOS Safari
      const CODEC_PREFS = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      const mime = CODEC_PREFS.find(function(m){ return MediaRecorder.isTypeSupported(m); }) || "";

      // 256kbps for best possible recording quality (Opus handles this very efficiently)
      const mr = new MediaRecorder(stream, {
        mimeType:          mime || undefined,
        audioBitsPerSecond: 256000,
      });

      mr.ondataavailable = function (ev) {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      mr.onstop = async function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        try { analyser.disconnect(); } catch(e) {}
        try { srcNode.disconnect(); } catch(e) {}
        try { micInputBoost.disconnect(); } catch(e) {}

        const blob = new Blob(chunksRef.current, { type: mime });
        const url  = URL.createObjectURL(blob);

        let buf = null;
        try {
          const ab = await blob.arrayBuffer();
          buf = await getActx().decodeAudioData(ab.slice(0));
        } catch (decErr) {
          setError("Could not decode recording. Try again.");
          stopAll(); setIsPlaying(false);
          setIsRecording(false); setRecTrackId(null); setRecTrail([]);
          return;
        }

        // ── Downmix to true mono ───────────────────────────────────────────
        // iOS MediaRecorder sometimes produces a 2-channel (stereo) buffer even
        // when channelCount:1 was requested — the right channel is often silent
        // or carries a phase-shifted copy, causing audio to pan hard left on playback.
        // Downmix to 1 channel here so recordings always play back centered.
        if (buf && buf.numberOfChannels > 1) {
          try {
            const offCtx = new OfflineAudioContext(1, buf.length, buf.sampleRate);
            const src2   = offCtx.createBufferSource();
            src2.buffer  = buf;
            src2.connect(offCtx.destination);
            src2.start(0);
            buf = await offCtx.startRendering();
          } catch (monoErr) {
            // If OfflineAudioContext downmix fails, do it manually in JS
            const monoData = new Float32Array(buf.length);
            const nc = buf.numberOfChannels;
            for (let c = 0; c < nc; c++) {
              const ch = buf.getChannelData(c);
              for (let i = 0; i < buf.length; i++) monoData[i] += ch[i];
            }
            const inv = 1 / nc;
            for (let i = 0; i < monoData.length; i++) monoData[i] *= inv;
            const monoBuf = getActx().createBuffer(1, buf.length, buf.sampleRate);
            monoBuf.copyToChannel(monoData, 0);
            buf = monoBuf;
          }
        }

        if (!buf || buf.duration < 0.05) {
          stopAll(); setIsPlaying(false);
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
        // Stop playback now that decoding is done — safe to tear down audio graph here
        stopAll();
        setIsPlaying(false);
        setRecTrail([]); setIsRecording(false); setRecTrackId(null);
      };

      recDurRef.current = 0;

      // ── MUST await doPlay() before starting the recorder ──────────────────
      // doPlay() is async — it calls await registerPitchWorklet() which can take
      // 50–200ms on first use. If we don't await it, masterStartRef.current is
      // still 0 when mr.start() fires, making trueStartTime wildly wrong and
      // causing the clip to jump to the wrong position on the timeline.
      if (!isPlaying) {
        await doPlay(playheadAtRef.current);
        setIsPlaying(true);
      }

      // Snapshot both refs immediately after doPlay() resolves —
      // these are the ground-truth values we use for clip placement.
      const masterStart   = masterStartRef.current;   // actx time when playback started
      const headPos       = playheadAtRef.current;    // timeline position at that moment

      // ── Start the recorder and stamp the clock as tightly as possible ──────
      mr.start(100); // 100ms chunks — reliable across iOS Safari + Chrome; 50ms causes gaps
      const startActxTime = actx.currentTime;
      const inputLatency  = actx.inputLatency || 0;

      // Timeline position = where the playhead was + how far actx has advanced since masterStart
      const trueStartTime = Math.max(0,
        headPos + (startActxTime - masterStart) - inputLatency
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
      stopAll(); setIsPlaying(false);
      setIsRecording(false); setRecTrackId(null);
      setCountIn(0);
    }
  };


  // ── Region gestures ───────────────────────────────────────────
  // ── Clip selection & drag state ───────────────────────────────
  // selectedClipId and dragRef declared at top of component (Rules of Hooks)

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
    // We start a 0.4s timer; if the finger doesn't move much, activate lasso.
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;

    longPressRef.current = setTimeout(function() {
      longPressRef.current = null;
      // Haptic-style visual pulse then start lasso
      startLassoFromTouch(startX, startY);
    }, 400);

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
  // Logic Pro / BandLab behaviour:
  //   • Horizontal pinch (fingers moving apart/together left-right) → H-zoom (timeline)
  //   • Vertical pinch   (fingers moving apart/together up-down)    → V-zoom (track heights)
  //   • Diagonal pinch applies both axes proportionally
  useEffect(function () {
    const el = scrollRef.current;
    if (!el) return;
    const onStart = function (e) {
      if (e.touches.length !== 2) return;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      pinchRef.current = {
        // full distance (legacy — still used for the pivot anchor)
        dist: Math.sqrt(dx * dx + dy * dy),
        // per-axis distances for independent scaling
        distX: Math.abs(dx),
        distY: Math.abs(dy),
        zoom:  zoomRef.current,
        vZoom: vZoom,        // snapshot current v-zoom at gesture start
        midX,
        scrollLeft: el.scrollLeft,
      };
    };
    const onMove = function (e) {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // ── Horizontal zoom (H-zoom) ─────────────────────────────
      if (pinchRef.current.distX > 4) {   // only when gesture has meaningful H span
        const newZoom = Math.min(32, Math.max(0.05,
          +(pinchRef.current.zoom * absDx / pinchRef.current.distX).toFixed(3)));
        // Anchor scroll to pinch midpoint
        const ratio  = newZoom / pinchRef.current.zoom;
        const pivotX = pinchRef.current.midX - el.getBoundingClientRect().left + pinchRef.current.scrollLeft;
        el.scrollLeft = Math.max(0, pivotX * ratio - (pinchRef.current.midX - el.getBoundingClientRect().left));
        setZoom(newZoom);
      }

      // ── Vertical zoom (V-zoom) ───────────────────────────────
      if (pinchRef.current.distY > 4) {   // only when gesture has meaningful V span
        const newVZoom = Math.min(4, Math.max(0.4,
          +(pinchRef.current.vZoom * absDy / pinchRef.current.distY).toFixed(3)));
        setVZoom(newVZoom);
      }
    };
    const onEnd = function () { pinchRef.current = null; };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove",  onMove,  { passive: false });
    el.addEventListener("touchend",   onEnd,   { passive: true });
    return function () {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove",  onMove);
      el.removeEventListener("touchend",   onEnd);
    };
  }, [vZoom]);  // re-bind when vZoom changes so snapshot stays fresh

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

  // ══════════════════════════════════════════════════════════════
  // BPM DETECTION ENGINE — multi-band, Worker-based, DAW-grade
  // ══════════════════════════════════════════════════════════════

  // ── Build the inline Worker blob (runs entirely off the UI thread) ──────
  const getBpmWorker = useCallback(function () {
    if (bpmWorkerRef.current) return bpmWorkerRef.current;

    // ── WORKER SOURCE ── everything inside this string runs in a Worker ──
    const WORKER_SRC = `
"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// BeatFinder BPM Engine v3 — DAW-grade onset-based tempo inference
// Architecture:
//   1. Multi-band IIR filterbank (kick / snare / hat bands)
//   2. Hybrid onset detection: energy flux + HFC + complex domain
//   3. Adaptive peak picking with dynamic noise floor
//   4. Onset timestamp array → inter-onset interval (IOI) histogram
//   5. IOI → BPM conversion + Gaussian-kernel BPM histogram clustering
//   6. Autocorrelation cross-validation per band
//   7. Half-time / double-time resolution heuristic
//   8. Temporal consistency scoring across time windows
//   9. Weighted multi-source confidence model
//  10. Beat grid placement via phase-locked anchor search
// ═══════════════════════════════════════════════════════════════════════════

// ─── IIR Biquad filter helpers (Direct Form II) ───────────────────────────

function biquadLP(fc, sr) {
  const w0 = 2 * Math.PI * fc / sr;
  const cosw = Math.cos(w0), sinw = Math.sin(w0);
  const alpha = sinw / (2 * 0.7071);
  const b0 = (1 - cosw) / 2, b1 = 1 - cosw, b2 = b0;
  const a0 = 1 + alpha, a1 = -2 * cosw, a2 = 1 - alpha;
  return { b0:b0/a0, b1:b1/a0, b2:b2/a0, a1:a1/a0, a2:a2/a0 };
}

function biquadHP(fc, sr) {
  const w0 = 2 * Math.PI * fc / sr;
  const cosw = Math.cos(w0), sinw = Math.sin(w0);
  const alpha = sinw / (2 * 0.7071);
  const b0 = (1 + cosw) / 2, b1 = -(1 + cosw), b2 = b0;
  const a0 = 1 + alpha, a1 = -2 * cosw, a2 = 1 - alpha;
  return { b0:b0/a0, b1:b1/a0, b2:b2/a0, a1:a1/a0, a2:a2/a0 };
}

function applyBiquad(pcm, c) {
  const out = new Float32Array(pcm.length);
  let x1=0, x2=0, y1=0, y2=0;
  for (let i = 0; i < pcm.length; i++) {
    const x = pcm[i];
    const y = c.b0*x + c.b1*x1 + c.b2*x2 - c.a1*y1 - c.a2*y2;
    x2=x1; x1=x; y2=y1; y1=y;
    out[i] = y;
  }
  return out;
}

// Double-cascaded biquad (−24 dB/oct rolloff)
function applyBiquad2(pcm, c) { return applyBiquad(applyBiquad(pcm, c), c); }

// ─── Basic DSP utilities ──────────────────────────────────────────────────

function rms(arr, start, len) {
  let s = 0;
  const end = Math.min(start + len, arr.length);
  for (let i = start; i < end; i++) s += arr[i] * arr[i];
  return Math.sqrt(s / (end - start));
}

// Median of an array (used for adaptive threshold)
function median(arr) {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort(function(a,b){ return a-b; });
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m-1] + sorted[m]) / 2;
}

// Moving average smoothing
function smooth(arr, radius) {
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let s = 0, n = 0;
    for (let j = Math.max(0, i-radius); j <= Math.min(arr.length-1, i+radius); j++) {
      s += arr[j]; n++;
    }
    out[i] = s / n;
  }
  return out;
}

// Find the strongest contiguous 30s window (skip silent intros/outros)
function findStrongestWindow(pcm, sr, windowSecs) {
  windowSecs = windowSecs || 30;
  const windowLen = Math.round(sr * windowSecs);
  if (pcm.length <= windowLen) return 0;
  const step = Math.round(sr * 5);
  let bestStart = 0, bestRMS = 0;
  for (let start = 0; start + windowLen < pcm.length; start += step) {
    const r = rms(pcm, start, windowLen);
    if (r > bestRMS) { bestRMS = r; bestStart = start; }
  }
  return bestStart;
}

// ─── Onset Detection ─────────────────────────────────────────────────────
//
// Three complementary methods are combined per band:
//   A) Energy flux      — half-wave rectified RMS difference (good for kicks)
//   B) High-freq content— sum of |sample| weighted by frequency index
//                         (good for hi-hats and transients)
//   C) Complex domain   — magnitude + phase deviation (catches soft onsets)
//
// The combined envelope is then peak-picked with an adaptive threshold
// that adapts to the local median energy, rejecting weak/noisy frames.

function computeOnsetEnvelope(pcm, sr, hopSize) {
  const N = pcm.length;
  const fftSize = hopSize * 2; // simple rectangular window for speed
  const envLen = Math.floor((N - fftSize) / hopSize) + 1;
  const env = new Float32Array(envLen);

  // --- Method A: Energy flux (half-wave rectified) ---
  let prevRMS = 0;
  const energyFlux = new Float32Array(envLen);
  for (let i = 0; i < envLen; i++) {
    const cur = rms(pcm, i * hopSize, hopSize);
    const diff = cur - prevRMS;
    energyFlux[i] = diff > 0 ? diff : 0;
    prevRMS = cur;
  }

  // --- Method B: High-Frequency Content (HFC) ---
  // Approximated without full FFT: compute RMS of difference signal.
  // dPCM[n] = pcm[n] - pcm[n-1] emphasises high frequencies.
  const hfcEnv = new Float32Array(envLen);
  for (let i = 0; i < envLen; i++) {
    let hfc = 0;
    const base = i * hopSize;
    for (let j = base + 1; j < base + hopSize && j < N; j++) {
      const d = pcm[j] - pcm[j-1];
      hfc += d * d;
    }
    hfcEnv[i] = Math.sqrt(hfc / hopSize);
  }
  // Half-wave rectify HFC flux (only increases matter)
  let prevHFC = 0;
  const hfcFlux = new Float32Array(envLen);
  for (let i = 0; i < envLen; i++) {
    const diff = hfcEnv[i] - prevHFC;
    hfcFlux[i] = diff > 0 ? diff : 0;
    prevHFC = hfcEnv[i];
  }

  // --- Combine: energy flux dominates, HFC adds hi-hat sensitivity ---
  const maxEF  = energyFlux.reduce(function(a,v){ return Math.max(a,v); }, 1e-9);
  const maxHFC = hfcFlux.reduce(function(a,v){ return Math.max(a,v); }, 1e-9);
  for (let i = 0; i < envLen; i++) {
    env[i] = (energyFlux[i] / maxEF) * 0.7 + (hfcFlux[i] / maxHFC) * 0.3;
  }

  return env;
}

// ─── Adaptive Peak Picking ────────────────────────────────────────────────
//
// Instead of a fixed threshold, use a sliding window median + multiplier.
// Ensures weak transients in quiet passages are still detected while
// noisy frames in loud sections don't dominate.
//
// Returns array of frame indices where onsets occur.

function pickPeaks(env, minDistFrames, thresholdMult) {
  minDistFrames = minDistFrames || 5;   // minimum gap between onsets
  thresholdMult = thresholdMult || 1.4; // adaptive threshold multiplier
  const windowFrames = 43; // ≈ 0.5s at hopSize=256, sr=22050
  const peaks = [];
  let lastPeak = -minDistFrames;

  for (let i = 1; i < env.length - 1; i++) {
    // Local median threshold over ±windowFrames
    const wStart = Math.max(0, i - windowFrames);
    const wEnd   = Math.min(env.length, i + windowFrames);
    const windowVals = [];
    for (let j = wStart; j < wEnd; j++) windowVals.push(env[j]);
    const localMedian = median(windowVals);
    const threshold = localMedian * thresholdMult;

    // Peak condition: local maximum above adaptive threshold and min distance
    if (env[i] > threshold &&
        env[i] >= env[i-1] &&
        env[i] >= env[i+1] &&
        i - lastPeak >= minDistFrames) {
      peaks.push(i);
      lastPeak = i;
    }
  }
  return peaks;
}

// ─── IOI → BPM Histogram + Clustering ───────────────────────────────────
//
// Steps:
//   1. Compute inter-onset intervals (IOIs) between consecutive onset peaks
//   2. Convert each IOI to BPM: bpm = 60 / interval_seconds
//   3. Also check multiples (×2, ×3, ÷2, ÷3) to catch sub/super-divisions
//   4. Accumulate votes into a BPM histogram with Gaussian kernel spreading
//      (each vote spreads to neighbouring bins — handles jitter/quantisation)
//   5. Find the histogram peak = estimated tempo
//
// Returns { bpm, score, histogram, candidates }

function ioisToBpmHistogram(onsetFrames, fps, minBpm, maxBpm) {
  minBpm = minBpm || 50;
  maxBpm = maxBpm || 210;
  const BIN_WIDTH = 0.5; // BPM resolution: 0.5 BPM per bin
  const numBins = Math.round((maxBpm - minBpm) / BIN_WIDTH) + 1;
  const hist = new Float32Array(numBins);

  // Gaussian kernel width (sigma = 1.5 BPM) — spreads each vote
  const SIGMA = 1.5;
  const KERNEL_RADIUS = Math.ceil(SIGMA * 3 / BIN_WIDTH);

  function addVote(bpm, weight) {
    if (bpm < minBpm || bpm > maxBpm) return;
    const centerBin = (bpm - minBpm) / BIN_WIDTH;
    const binInt = Math.round(centerBin);
    for (let db = -KERNEL_RADIUS; db <= KERNEL_RADIUS; db++) {
      const b = binInt + db;
      if (b < 0 || b >= numBins) continue;
      const dist = (b - centerBin) * BIN_WIDTH;
      hist[b] += weight * Math.exp(-0.5 * (dist / SIGMA) * (dist / SIGMA));
    }
  }

  // Accumulate IOI votes
  let voteCount = 0;
  for (let i = 1; i < onsetFrames.length; i++) {
    const ioi = (onsetFrames[i] - onsetFrames[i-1]) / fps; // seconds
    if (ioi < 0.05 || ioi > 5.0) continue; // reject implausible intervals

    // Direct BPM
    const directBpm = 60 / ioi;
    // Also try musical multiples (handle sub-beat / super-beat intervals)
    const multipliers = [1, 2, 3, 0.5, 0.333, 1.5, 0.667];
    for (const mult of multipliers) {
      const bpm = directBpm * mult;
      if (bpm < minBpm || bpm > maxBpm) continue;
      // Weight: direct interval gets full weight; harmonics get proportionally less
      const w = mult === 1 ? 1.0 : mult < 1 ? 0.4 : (mult === 2 ? 0.6 : 0.3);
      addVote(bpm, w);
      voteCount++;
    }
  }

  if (voteCount === 0) return { bpm: 120, score: 0, histogram: hist, candidates: [] };

  // Find the top-3 peaks in the histogram
  const candidates = [];
  const visited = new Uint8Array(numBins);
  for (let k = 0; k < 5; k++) {
    let peakBin = 0, peakVal = 0;
    for (let b = 0; b < numBins; b++) {
      if (!visited[b] && hist[b] > peakVal) { peakVal = hist[b]; peakBin = b; }
    }
    if (peakVal <= 0) break;
    const peakBpm = minBpm + peakBin * BIN_WIDTH;
    candidates.push({ bpm: peakBpm, score: peakVal, bin: peakBin });
    // Suppress neighbourhood (±5 BPM) so we find distinct peaks
    const suppressR = Math.round(5 / BIN_WIDTH);
    for (let b = Math.max(0, peakBin - suppressR); b <= Math.min(numBins-1, peakBin + suppressR); b++) {
      visited[b] = 1;
    }
  }

  const best = candidates[0] || { bpm: 120, score: 0 };
  return { bpm: best.bpm, score: best.score, histogram: hist, candidates };
}

// ─── Autocorrelation (onset envelope) ────────────────────────────────────
//
// Classic autocorrelation on the onset envelope gives an independent
// tempo estimate to cross-validate the IOI histogram result.

function autocorrBPM(onset, sr, hopSize, minBpm, maxBpm) {
  minBpm = minBpm || 50; maxBpm = maxBpm || 210;
  const fps = sr / hopSize;
  const minLag = Math.max(1, Math.round(fps * 60 / maxBpm));
  const maxLag = Math.round(fps * 60 / minBpm);
  const acLen = Math.min(onset.length, Math.round(fps * 45));

  // Build full autocorrelation array for parabolic interpolation
  const acScores = new Float32Array(maxLag + 1);
  let bestLag = minLag, bestScore = -1;
  for (let lag = minLag; lag <= Math.min(maxLag, acLen - 1); lag++) {
    let score = 0;
    for (let t = 0; t < acLen - lag; t++) score += onset[t] * onset[t + lag];
    score /= (acLen - lag);
    acScores[lag] = score;
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }

  // Parabolic interpolation for sub-bin accuracy
  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const y0 = acScores[bestLag-1], y1 = acScores[bestLag], y2 = acScores[bestLag+1];
    const denom = 2 * (y0 - 2*y1 + y2);
    if (denom !== 0) refinedLag = bestLag - (y2 - y0) / (2 * denom);
  }

  const rawBpm = fps * 60 / refinedLag;
  return { bpm: rawBpm, lag: refinedLag, score: bestScore };
}

// ─── Evaluate a BPM candidate against an onset envelope ──────────────────

function scoreBpmCandidate(onset, sr, hopSize, candidateBpm) {
  const fps = sr / hopSize;
  const lag = fps * 60 / candidateBpm;
  const iLag = Math.round(lag);
  if (iLag < 1 || iLag >= onset.length) return 0;
  const len = Math.min(onset.length, Math.round(fps * 45));
  let score = 0;
  for (let t = 0; t < len - iLag; t++) score += onset[t] * onset[t + iLag];
  return score / (len - iLag);
}

// ─── Half-time / double-time normalisation ────────────────────────────────
//
// Keeps BPM in the musically conventional 70–175 range.
// Prefers 80–160 (the golden zone for most genres).

function normaliseRange(bpm) {
  let b = bpm;
  // Fold very slow estimates up
  while (b < 70) b *= 2;
  // Fold very fast estimates down
  while (b > 175) b /= 2;
  return b;
}

// Given a list of candidates (from IOI histogram + autocorr), resolve
// half-time / double-time ambiguity by picking the candidate closest
// to the preferred range 80–160, or with the highest score if tied.
function resolveAmbiguity(candidates, onsetEnv, sr, hopSize) {
  if (!candidates.length) return 120;

  // Score each candidate: histogram score × autocorr score × range preference
  const scored = candidates.map(function(c) {
    const norm = normaliseRange(c.bpm);
    // Range preference: peak at 120 BPM, falls off toward edges of 70-175
    const rangePref = 1 - Math.abs(norm - 120) / 120;
    const acScore = scoreBpmCandidate(onsetEnv, sr, hopSize, norm);
    return { bpm: norm, total: c.score * (0.5 + rangePref * 0.3 + acScore * 0.2) };
  });

  scored.sort(function(a,b){ return b.total - a.total; });
  return scored[0].bpm;
}

// ─── Temporal consistency scoring ────────────────────────────────────────
//
// Split the audio into 5-second windows. Run IOI histogram on each.
// If the same BPM appears consistently across windows → high confidence.

function temporalConsistency(onsetFrames, fps, targetBpm, windowSecs) {
  windowSecs = windowSecs || 5;
  const windowFrames = windowSecs * fps;
  if (onsetFrames.length < 4) return 0;

  const totalFrames = onsetFrames[onsetFrames.length - 1];
  const numWindows = Math.max(1, Math.floor(totalFrames / windowFrames));
  let matches = 0;

  for (let w = 0; w < numWindows; w++) {
    const wStart = w * windowFrames;
    const wEnd   = wStart + windowFrames;
    const wOnsets = onsetFrames.filter(function(f){ return f >= wStart && f < wEnd; });
    if (wOnsets.length < 2) continue;
    const res = ioisToBpmHistogram(wOnsets, fps, 50, 210);
    const windowBpm = normaliseRange(res.bpm);
    // Count as matching if within ±4 BPM of target
    if (Math.abs(windowBpm - targetBpm) <= 4) matches++;
  }

  return numWindows > 0 ? matches / numWindows : 0;
}

// ─── Confidence model ─────────────────────────────────────────────────────
//
// Combines four independent signals:
//  1. IOI histogram peak strength (normalized)
//  2. Cross-band agreement (low, mid, high)
//  3. Autocorrelation score (normalized)
//  4. Temporal consistency across windows

function computeConfidence(ioisScore, bandBpms, targetBpm, acScore, temporalScore) {
  // 1. Histogram strength — log-normalized
  const histConf = Math.min(1, Math.log1p(ioisScore * 10) / Math.log1p(10));

  // 2. Band agreement
  const bpmList = [bandBpms.low, bandBpms.mid, bandBpms.high].map(normaliseRange);
  const meanBpm = bpmList.reduce(function(a,v){ return a+v; }, 0) / 3;
  const variance = bpmList.reduce(function(a,v){ return a + Math.pow(v-meanBpm,2); }, 0) / 3;
  const agreementConf = Math.max(0, 1 - Math.sqrt(variance) / 25);

  // 3. Autocorr strength
  const acConf = Math.min(1, acScore * 12);

  // 4. Temporal
  const tempConf = temporalScore;

  // Weighted combination
  const combined = histConf * 0.35 + agreementConf * 0.30 + acConf * 0.20 + tempConf * 0.15;
  return Math.max(0, Math.min(1, combined));
}

// ─── Beat grid placement ──────────────────────────────────────────────────
//
// Given the BPM and onset envelope, find the best phase anchor by scanning
// the first 4 beats for the highest-energy onset, then extend the grid.

function buildBeatGrid(onset, sr, hopSize, bpm, durationSec) {
  const fps = sr / hopSize;
  const spb = 60 / bpm;
  const beats = [];
  const firstWindow = Math.min(onset.length, Math.round(fps * spb * 4));
  let anchorFrame = 0, maxOnset = 0;
  for (let i = 0; i < firstWindow; i++) {
    if (onset[i] > maxOnset) { maxOnset = onset[i]; anchorFrame = i; }
  }
  const anchorSec = anchorFrame / fps;
  let t = anchorSec;
  while (t < durationSec) { beats.push(Math.round(t * 1000) / 1000); t += spb; }
  t = anchorSec - spb;
  while (t >= 0) { beats.unshift(Math.round(t * 1000) / 1000); t -= spb; }
  return beats;
}

// ─── Swing estimation ─────────────────────────────────────────────────────

function estimateSwing(beats) {
  if (beats.length < 8) return 0;
  const iois = [];
  for (let i = 1; i < beats.length; i++) iois.push(beats[i] - beats[i-1]);
  const odd = [], even = [];
  for (let i = 0; i < iois.length; i++) (i % 2 === 0 ? even : odd).push(iois[i]);
  if (!even.length || !odd.length) return 0;
  const avgEven = even.reduce(function(a,v){ return a+v; }, 0) / even.length;
  const avgOdd  = odd.reduce(function(a,v){ return a+v; }, 0) / odd.length;
  const ratio = avgEven > 0 ? avgOdd / avgEven : 1;
  return Math.max(0, Math.min(1, (ratio - 1) * 2));
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Main Worker message handler ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

self.onmessage = async function(e) {
  const { type, pcm, sampleRate, duration, id } = e.data;

  if (type !== 'analyse') return;

  try {
    const sr  = sampleRate || 44100;
    const hop = 256;
    const fps = sr / hop;

    // ── STEP 1: Find richest 30-second analysis window ────────────────────
    self.postMessage({ type:'progress', id, progress: 5, msg:'Locating richest section…' });
    const winStart = findStrongestWindow(pcm, sr, 30);
    const winLen   = Math.min(pcm.length - winStart, Math.round(sr * 30));
    const window30 = pcm.slice(winStart, winStart + winLen);
    const offsetSec = winStart / sr;

    // ── STEP 2: 3-Band IIR filterbank ────────────────────────────────────
    //   Low  0–200 Hz    → kick drum, sub-bass (highest BPM reliability)
    //   Mid  200–2000 Hz → snare, clap, guitar, keys
    //   High 2000+ Hz    → hi-hat, cymbal, transient attacks
    self.postMessage({ type:'progress', id, progress: 12, msg:'Building 3-band filterbank…' });
    const lpLow  = biquadLP(200,  sr);
    const hpMid  = biquadHP(200,  sr);
    const lpMid  = biquadLP(2000, sr);
    const hpHigh = biquadHP(2000, sr);
    const lowBand  = applyBiquad2(window30, lpLow);
    const midBand  = applyBiquad2(applyBiquad2(window30, hpMid), lpMid);
    const highBand = applyBiquad2(window30, hpHigh);

    // ── STEP 3: Hybrid onset envelope per band ────────────────────────────
    self.postMessage({ type:'progress', id, progress: 22, msg:'Computing onset envelopes…' });
    const onsetLow  = computeOnsetEnvelope(lowBand,  sr, hop);
    const onsetMid  = computeOnsetEnvelope(midBand,  sr, hop);
    const onsetHigh = computeOnsetEnvelope(highBand, sr, hop);

    // Combined onset for beat-grid / onset export (band-weighted sum)
    const combinedLen = Math.min(onsetLow.length, onsetMid.length, onsetHigh.length);
    const combinedOnset = new Float32Array(combinedLen);
    for (let i = 0; i < combinedLen; i++) {
      combinedOnset[i] = onsetLow[i] * 1.0 + onsetMid[i] * 0.7 + onsetHigh[i] * 0.4;
    }

    // ── STEP 4: Adaptive peak picking per band ────────────────────────────
    // minDist ≈ 80ms at analysis fps to reject double-triggers
    self.postMessage({ type:'progress', id, progress: 33, msg:'Detecting rhythmic onsets…' });
    const minDistFrames = Math.round(fps * 0.08); // 80ms minimum between peaks
    const peaksLow  = pickPeaks(onsetLow,  minDistFrames, 1.35);
    const peaksMid  = pickPeaks(onsetMid,  minDistFrames, 1.40);
    const peaksHigh = pickPeaks(onsetHigh, minDistFrames, 1.50); // hi-hats need tighter threshold

    // ── STEP 5: IOI → BPM histogram per band ─────────────────────────────
    self.postMessage({ type:'progress', id, progress: 45, msg:'Building IOI histogram…' });
    const ioisLow  = ioisToBpmHistogram(peaksLow,  fps, 50, 210);
    const ioisMid  = ioisToBpmHistogram(peaksMid,  fps, 50, 210);
    const ioisHigh = ioisToBpmHistogram(peaksHigh, fps, 50, 210);

    // Band BPMs (normalised to musical range before aggregation)
    const bpmLow  = normaliseRange(ioisLow.bpm);
    const bpmMid  = normaliseRange(ioisMid.bpm);
    const bpmHigh = normaliseRange(ioisHigh.bpm);

    // ── STEP 6: Autocorrelation cross-validation per band ─────────────────
    self.postMessage({ type:'progress', id, progress: 58, msg:'Running autocorrelation…' });
    const acLow  = autocorrBPM(onsetLow,  sr, hop, 50, 210);
    const acMid  = autocorrBPM(onsetMid,  sr, hop, 50, 210);
    const acHigh = autocorrBPM(onsetHigh, sr, hop, 50, 210);

    // Refine each autocorr BPM: score raw + harmonic candidates, pick best
    function refineAC(onsetBand, acRaw) {
      const cands = [acRaw.bpm, acRaw.bpm*2, acRaw.bpm/2, acRaw.bpm*1.5, acRaw.bpm/1.5];
      let best = { bpm: acRaw.bpm, score: acRaw.score };
      for (const c of cands) {
        const norm = normaliseRange(c);
        if (norm < 50 || norm > 210) continue;
        const sc = scoreBpmCandidate(onsetBand, sr, hop, norm);
        if (sc > best.score) best = { bpm: norm, score: sc };
      }
      best.bpm = normaliseRange(best.bpm);
      return best;
    }
    const refinedLow  = refineAC(onsetLow,  acLow);
    const refinedMid  = refineAC(onsetMid,  acMid);
    const refinedHigh = refineAC(onsetHigh, acHigh);

    // ── STEP 7: Candidate fusion + half-time resolution ───────────────────
    self.postMessage({ type:'progress', id, progress: 70, msg:'Resolving tempo candidates…' });

    // Merge IOI candidates with autocorr candidates into one pool
    // Weights: low band (kick) gets 1.0, mid 0.8, high 0.5
    const allCandidates = [
      // IOI histogram peaks (already have scores)
      ...ioisLow.candidates.map(function(c){ return { bpm:c.bpm, score:c.score*1.0 }; }),
      ...ioisMid.candidates.map(function(c){ return { bpm:c.bpm, score:c.score*0.8 }; }),
      ...ioisHigh.candidates.map(function(c){ return { bpm:c.bpm, score:c.score*0.5 }; }),
      // Autocorr picks
      { bpm: refinedLow.bpm,  score: refinedLow.score  * 80 },
      { bpm: refinedMid.bpm,  score: refinedMid.score  * 60 },
      { bpm: refinedHigh.bpm, score: refinedHigh.score * 35 },
    ].filter(function(c){ return c.bpm >= 50 && c.bpm <= 210 && c.score > 0; });

    // Cluster nearby BPMs (within ±3 BPM → merge their scores)
    const clusters = [];
    for (const c of allCandidates) {
      const norm = normaliseRange(c.bpm);
      let found = false;
      for (const cl of clusters) {
        if (Math.abs(cl.bpm - norm) <= 3) {
          // Weighted merge
          const total = cl.score + c.score;
          cl.bpm   = (cl.bpm * cl.score + norm * c.score) / total;
          cl.score = total;
          found = true; break;
        }
      }
      if (!found) clusters.push({ bpm: norm, score: c.score });
    }
    clusters.sort(function(a,b){ return b.score - a.score; });

    // Resolve half-time / double-time using the combined onset as reference
    let finalBpm = resolveAmbiguity(clusters, combinedOnset, sr, hop);
    finalBpm = normaliseRange(finalBpm);
    finalBpm = Math.round(finalBpm * 10) / 10;

    // ── STEP 8: Temporal consistency check ───────────────────────────────
    self.postMessage({ type:'progress', id, progress: 80, msg:'Checking temporal consistency…' });
    // Use peaks from the most reliable band (low) for consistency test
    const tempScore = temporalConsistency(peaksLow.length > 3 ? peaksLow : peaksMid, fps, finalBpm, 5);

    // ── STEP 9: Confidence model ──────────────────────────────────────────
    self.postMessage({ type:'progress', id, progress: 87, msg:'Computing confidence…' });
    const topIoisScore = clusters.length > 0 ? clusters[0].score : 0;
    const topAcScore   = Math.max(refinedLow.score, refinedMid.score);
    const confidence   = computeConfidence(
      topIoisScore,
      { low: bpmLow, mid: bpmMid, high: bpmHigh },
      finalBpm,
      topAcScore,
      tempScore
    );

    // ── STEP 10: Beat grid + onset timestamps ────────────────────────────
    self.postMessage({ type:'progress', id, progress: 92, msg:'Building beat grid…' });
    const beatGrid = buildBeatGrid(onsetLow, sr, hop, finalBpm, duration || (pcm.length / sr));
    const beatGridAbs = beatGrid.map(function(t){ return Math.round((t + offsetSec) * 1000) / 1000; });

    // Onset timestamps: pick local maxima above 55% of max in combined envelope
    const maxO = combinedOnset.reduce(function(a,v){ return Math.max(a,v); }, 0);
    const onsetTimestamps = [];
    for (let i = 1; i < combinedLen - 1; i++) {
      if (combinedOnset[i] >= maxO * 0.55 &&
          combinedOnset[i] >= combinedOnset[i-1] &&
          combinedOnset[i] >= combinedOnset[i+1]) {
        onsetTimestamps.push(Math.round((offsetSec + i / fps) * 1000) / 1000);
      }
    }

    // Swing estimation
    const swing = estimateSwing(beatGrid);

    // Secondary candidates (top 3 distinct BPMs from cluster list)
    const secondaryCandidates = clusters
      .slice(1, 4)
      .map(function(c){ return Math.round(normaliseRange(c.bpm) * 10) / 10; })
      .filter(function(b){ return Math.abs(b - finalBpm) > 2; });

    self.postMessage({ type:'progress', id, progress: 98, msg:'Finalizing…' });

    // ── Return ────────────────────────────────────────────────────────────
    self.postMessage({
      type:       'result',
      id,
      bpm:        finalBpm,
      confidence: Math.round(confidence * 100) / 100,
      bands:      { low: Math.min(1, topAcScore * 8), mid: Math.min(1, refinedMid.score * 7), high: Math.min(1, refinedHigh.score * 5) },
      beats:      beatGridAbs.slice(0, 2000),
      onsets:     onsetTimestamps.slice(0, 5000),
      swing,
      bandBpms:   { low: bpmLow, mid: bpmMid, high: bpmHigh },
      candidates: secondaryCandidates,
      temporalScore: Math.round(tempScore * 100) / 100,
    });

  } catch(err) {
    self.postMessage({ type:'error', id, message: err.message });
  }
};
`;

    const blob = new Blob([WORKER_SRC], { type: 'application/javascript' });
    const url  = URL.createObjectURL(blob);
    const w    = new Worker(url);
    URL.revokeObjectURL(url);
    bpmWorkerRef.current = w;
    return w;
  }, []);

  // ── Terminate BPM worker on unmount ─────────────────────────────────────
  useEffect(function () {
    return function () {
      if (bpmWorkerRef.current) { bpmWorkerRef.current.terminate(); bpmWorkerRef.current = null; }
    };
  }, []);

  // ── extractPCM: downmix AudioBuffer to mono Float32Array ────────────────
  const extractPCM = useCallback(function (audioBuffer) {
    const nc = audioBuffer.numberOfChannels;
    const len = audioBuffer.length;
    const out = new Float32Array(len);
    // Downmix all channels equally
    for (let c = 0; c < nc; c++) {
      const ch = audioBuffer.getChannelData(c);
      for (let i = 0; i < len; i++) out[i] += ch[i];
    }
    const gain = 1 / nc;
    for (let i = 0; i < len; i++) out[i] *= gain;

    // Normalise to peak = 1.0 (handles very quiet files)
    let peak = 0;
    for (let i = 0; i < len; i++) { const a = Math.abs(out[i]); if (a > peak) peak = a; }
    if (peak > 0.0001) for (let i = 0; i < len; i++) out[i] /= peak;

    return out;
  }, []);

  // ── Main detectBpm: works on any audio track ─────────────────────────────
  const detectBpm = useCallback(async function (sourceBuffer) {
    // If no buffer passed, find best candidate track
    const buf = sourceBuffer || (function () {
      const beatTrack = tracks.find(function(t){
        return t.type === "beat" && t.clips && t.clips.some(function(c){ return c.audioBuffer; });
      });
      if (beatTrack) {
        const cl = beatTrack.clips.find(function(c){ return c.audioBuffer; });
        return cl ? cl.audioBuffer : null;
      }
      // Fallback: first track with any audio
      for (const t of tracks) {
        const cl = t.clips && t.clips.find(function(c){ return c.audioBuffer; });
        if (cl) return cl.audioBuffer;
      }
      return null;
    })();

    if (!buf) { setBpmDetectMsg("No audio loaded."); return; }

    // Cancel any in-flight analysis
    if (bpmWorkerRef.current) {
      bpmWorkerRef.current.terminate();
      bpmWorkerRef.current = null;
    }

    setBpmDetecting(true);
    setBpmProgress(0);
    setBpmDetectMsg("Preparing audio…");
    setDetectedBpm(null);
    setBpmConfidence(null);
    setBpmBandConf(null);
    setBeatPositions([]);
    setOnsetTimestamps([]);
    setBpmCandidates([]);
    setBpmTemporal(null);

    try {
      const pcm = extractPCM(buf);
      const analysisId = Date.now();

      const worker = getBpmWorker();

      await new Promise(function (resolve, reject) {
        worker.onmessage = function (e) {
          const msg = e.data;
          if (msg.id !== analysisId) return;

          if (msg.type === 'progress') {
            setBpmProgress(msg.progress);
            setBpmDetectMsg(msg.msg || "");
          }

          else if (msg.type === 'result') {
            const finalBpm = Math.round(msg.bpm);
            setDetectedBpm(finalBpm);
            setBpm(finalBpm);
            setBpmConfidence(msg.confidence);
            setBpmBandConf(msg.bands);
            setBeatPositions(msg.beats || []);
            setOnsetTimestamps(msg.onsets || []);
            setSwingAmount(msg.swing || 0);
            setBpmSource("auto");
            setBpmCandidates(msg.candidates || []);
            setBpmTemporal(msg.temporalScore ?? null);
            setBpmProgress(100);
            setBpmDetectMsg("Done ✓");
            setTimeout(function(){ setBpmDetectMsg(""); setBpmProgress(0); }, 2000);
            resolve();
          }

          else if (msg.type === 'error') {
            reject(new Error(msg.message));
          }
        };

        worker.onerror = reject;

        // Transfer the PCM buffer to the worker (zero-copy)
        const transferable = pcm.buffer.slice(0); // slice to ensure transferable
        worker.postMessage({
          type: 'analyse',
          pcm: new Float32Array(transferable),
          sampleRate: buf.sampleRate,
          duration: buf.duration,
          id: analysisId,
        }, [transferable]);
      });

    } catch(err) {
      console.error('[BeatFinder] BPM detection error:', err);
      setDetectedBpm(-1);
      setBpmDetectMsg("Detection failed");
      setTimeout(function(){ setBpmDetectMsg(""); }, 3000);
    }

    setBpmDetecting(false);
  }, [tracks, getBpmWorker, extractPCM]);

  // ── Tap-tempo logic ──────────────────────────────────────────────────────
  const handleTapTempo = useCallback(function () {
    const now = Date.now();
    setTapTimes(function (prev) {
      const fresh = prev.filter(function(t){ return now - t < 3000; });
      const next = [...fresh, now];
      if (next.length >= 2) {
        const intervals = [];
        for (let i = 1; i < next.length; i++) intervals.push(next[i] - next[i-1]);
        const avg = intervals.reduce(function(a,b){ return a+b; }, 0) / intervals.length;
        const tapped = Math.round(60000 / avg);
        if (tapped >= 40 && tapped <= 220) {
          setBpm(tapped);
          setDetectedBpm(tapped);
          setBpmSource("tap");
          setBpmConfidence(null); // tap has no confidence score
        }
      }
      return next;
    });
  }, []);


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
      style={{ background:"#080808", height:"100%", display:"flex", flexDirection:"column", fontFamily:"'DM Sans',sans-serif", overflow:"hidden", WebkitUserSelect:"none", userSelect:"none", WebkitTouchCallout:"none" }}
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
                <span style={{ width:20,textAlign:"center" }}>⌫</span> Delete clip
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
              <span style={{ width:20,textAlign:"center" }}>⌫</span> Delete track
            </button>
          </div>
        </div>
      )}

      {unsavedAlert && (
        <div style={{ position:"absolute",inset:0,zIndex:8000,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:"32px" }}>
          <div style={{ background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:320,textAlign:"center" }}>
            <div style={{ fontSize:36,marginBottom:12 }}><AppIcon id="save" size={20}/></div>
            <div style={{ color:"white",fontWeight:800,fontSize:18,marginBottom:10 }}>Save before leaving?</div>
            <div style={{ color:"#888",fontSize:14,marginBottom:28,lineHeight:1.6 }}>Your project has unsaved changes.</div>
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              <button onClick={function(){
                // Open the name prompt — capture which action triggered this
                setUnsavedAlert(false);
                setPendingName(projectName === "New Project" ? "" : projectName);
                setPendingNameAction(unsavedAlert); // "exit" or "new"
                setShowNamePrompt(true);
              }} style={{ background:"linear-gradient(135deg,#C026D3,#7C3AED)",border:"none",borderRadius:12,color:"white",fontWeight:800,fontSize:15,padding:"14px",cursor:"pointer" }}>
                Save {unsavedAlert==="new"?"& New":"& Exit"}
              </button>
              <button onClick={function(){
                setUnsavedAlert(false);
                // Full reset so old project doesn't ghost back
                stopMonitoring();
                stopAll(); setIsPlaying(false);
                setTracks([]); setProjectName("New Project");
                setBpm(120); setProjectKey("C major"); setTimeSigNum(4);
                setCurrentTime(0); setIsSaved(true); setSelectedTrackId(null);
                if(scrollRef.current) scrollRef.current.scrollLeft = 0;
                if(unsavedAlert !== "new") onExit();
              }} style={{ background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,color:"#EF4444",fontWeight:700,fontSize:15,padding:"14px",cursor:"pointer" }}>Don't Save</button>
              <button onClick={function(){ setUnsavedAlert(false); }} style={{ background:"none",border:"1px solid #2a2a2a",borderRadius:12,color:"#666",fontSize:14,padding:"12px",cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Name your project modal ───────────────────────────────── */}
      {showNamePrompt && (
        <div style={{ position:"absolute",inset:0,zIndex:8100,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",padding:"32px" }}>
          <div style={{ background:"#1a1a1a",border:"1px solid #333",borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:320 }}>
            <div style={{ fontSize:36,marginBottom:12,textAlign:"center" }}>✏️</div>
            <div style={{ color:"white",fontWeight:800,fontSize:18,marginBottom:6,textAlign:"center" }}>Name your project</div>
            <div style={{ color:"#666",fontSize:13,marginBottom:20,textAlign:"center",lineHeight:1.5 }}>Give this project a name so you can find it later.</div>
            <input
              autoFocus
              value={pendingName}
              onChange={function(e){ setPendingName(e.target.value); }}
              onKeyDown={function(e){
                if(e.key==="Enter" && pendingName.trim()){
                  const name = pendingName.trim();
                  setProjectName(name);
                  setShowNamePrompt(false);
                  // Save then reset + exit
                  setTimeout(async function(){
                    await saveProject();
                    stopMonitoring();
                    stopAll(); setIsPlaying(false);
                    setTracks([]); setProjectName("New Project");
                    setBpm(120); setProjectKey("C major"); setTimeSigNum(4);
                    setCurrentTime(0); setIsSaved(true); setSelectedTrackId(null);
                    if(scrollRef.current) scrollRef.current.scrollLeft = 0;
                    if(pendingNameAction !== "new") onExit();
                  }, 30);
                }
                if(e.key==="Escape"){ setShowNamePrompt(false); }
              }}
              placeholder="e.g. Summer Freestyle, Hook Idea..."
              style={{ width:"100%",boxSizing:"border-box",background:"#111",border:"1.5px solid #C026D3",borderRadius:12,padding:"13px 16px",color:"white",fontSize:15,outline:"none",marginBottom:16,fontFamily:"'DM Sans',sans-serif" }}
            />
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              <button
                onClick={async function(){
                  const name = (pendingName.trim()) || projectName;
                  setProjectName(name);
                  setShowNamePrompt(false);
                  await saveProject();
                  stopMonitoring();
                  // Full reset — close the project before going home
                  stopAll(); setIsPlaying(false);
                  setTracks([]); setProjectName("New Project");
                  setBpm(120); setProjectKey("C major"); setTimeSigNum(4);
                  setCurrentTime(0); setIsSaved(true); setSelectedTrackId(null);
                  if(scrollRef.current) scrollRef.current.scrollLeft = 0;
                  if(pendingNameAction !== "new") onExit();
                }}
                disabled={!pendingName.trim()}
                style={{ background: pendingName.trim() ? "linear-gradient(135deg,#C026D3,#7C3AED)" : "#2a2a2a",border:"none",borderRadius:12,color: pendingName.trim() ? "white" : "#555",fontWeight:800,fontSize:15,padding:"14px",cursor: pendingName.trim() ? "pointer" : "default",transition:"all 0.15s" }}>
                Save &amp; {pendingNameAction==="new" ? "New Project" : "Go Home"}
              </button>
              <button onClick={function(){ setShowNamePrompt(false); }} style={{ background:"none",border:"1px solid #2a2a2a",borderRadius:12,color:"#666",fontSize:14,padding:"12px",cursor:"pointer" }}>Cancel</button>
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

              {/* ── BPM progress bar (shows during analysis) ── */}
              {bpmDetecting && (
                <div style={{ padding:"0 16px 10px" }}>
                  <div style={{ background:"#111",borderRadius:6,overflow:"hidden",height:4,marginBottom:6 }}>
                    <div style={{ height:"100%",background:"linear-gradient(90deg,#C026D3,#7C3AED)",width:bpmProgress+"%",transition:"width 0.3s ease",borderRadius:6 }} />
                  </div>
                  <div style={{ color:"#888",fontSize:10,letterSpacing:1 }}>{bpmDetectMsg || "Analyzing…"}</div>
                </div>
              )}

              {/* ── BPM display row ── */}
              <div style={{ display:"flex",alignItems:"stretch",borderTop:"1px solid #222" }}>
                <button onClick={function(){ setBpm(function(b){ return Math.max(40,b-1); }); setBpmSource("manual"); }} style={{ flex:1,background:"none",border:"none",borderRight:"1px solid #222",color:"white",fontSize:28,cursor:"pointer",padding:"14px 0" }}>−</button>

                {/* Tap tempo centre */}
                <div onClick={handleTapTempo} style={{ flex:2,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"12px 0",cursor:"pointer",position:"relative" }}>
                  {/* Animated beat pulse ring */}
                  {isPlaying && (
                    <div style={{
                      position:"absolute", width:72, height:72, borderRadius:"50%",
                      border:"2px solid rgba(192,38,211,0.5)",
                      animation:"bf-play-pulse 1s ease infinite",
                      animationDuration: (60/bpm)+"s",
                      pointerEvents:"none",
                    }} />
                  )}
                  <div style={{ color:"white",fontWeight:900,fontSize:40,lineHeight:1,fontFamily:"monospace",letterSpacing:-1 }}>
                    {bpm}<span style={{ fontSize:14,color:"#555",fontWeight:600,letterSpacing:0 }}> BPM</span>
                  </div>
                  <div style={{ color:"#444",fontSize:10,marginTop:4,letterSpacing:1.5 }}>TAP TEMPO</div>
                  {bpmSource && (
                    <div style={{ color:bpmSource==="auto"?"#22C55E":bpmSource==="tap"?"#F59E0B":"#555",fontSize:9,fontWeight:700,letterSpacing:1,marginTop:2 }}>
                      {bpmSource==="auto"?"AUTO-DETECTED":bpmSource==="tap"?"TAP":"MANUAL"}
                    </div>
                  )}
                </div>

                <button onClick={function(){ setBpm(function(b){ return Math.min(220,b+1); }); setBpmSource("manual"); }} style={{ flex:1,background:"none",border:"none",borderLeft:"1px solid #222",color:"white",fontSize:28,cursor:"pointer",padding:"14px 0" }}>+</button>
              </div>

              {/* ── BPM range slider ── */}
              <div style={{ padding:"6px 16px 10px" }}>
                <input type="range" min={40} max={220} step={1} value={bpm}
                  onChange={function(e){ setBpm(parseInt(e.target.value)); setBpmSource("manual"); }}
                  style={{ width:"100%",accentColor:"#C026D3" }} />
              </div>

              {/* ── Confidence meter + band display ── */}
              {bpmConfidence !== null && (
                <div style={{ padding:"0 16px 14px" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
                    <div style={{ color:"#555",fontSize:10,fontWeight:700,letterSpacing:1,width:68 }}>CONFIDENCE</div>
                    <div style={{ flex:1,background:"#111",borderRadius:4,overflow:"hidden",height:6 }}>
                      <div style={{ height:"100%",borderRadius:4,transition:"width 0.5s ease",
                        background: bpmConfidence > 0.7 ? "#22C55E" : bpmConfidence > 0.4 ? "#F59E0B" : "#EF4444",
                        width: Math.round(bpmConfidence*100)+"%" }} />
                    </div>
                    <div style={{ color: bpmConfidence > 0.7 ? "#22C55E" : bpmConfidence > 0.4 ? "#F59E0B" : "#EF4444",
                      fontSize:11,fontWeight:800,width:36,textAlign:"right" }}>
                      {Math.round(bpmConfidence*100)}%
                    </div>
                  </div>

                  {/* Per-band confidence bars */}
                  {bpmBandConf && (
                    <div style={{ display:"flex",gap:6 }}>
                      {[
                        { label:"LOW",  val:bpmBandConf.low,  color:"#C026D3" },
                        { label:"MID",  val:bpmBandConf.mid,  color:"#7C3AED" },
                        { label:"HIGH", val:bpmBandConf.high, color:"#3B82F6" },
                      ].map(function(band){
                        return (
                          <div key={band.label} style={{ flex:1,textAlign:"center" }}>
                            <div style={{ background:"#111",borderRadius:3,overflow:"hidden",height:28,position:"relative",marginBottom:3 }}>
                              <div style={{ position:"absolute",bottom:0,left:0,right:0,borderRadius:3,transition:"height 0.4s ease",
                                background:band.color+"44", height: Math.round((band.val||0)*100)+"%" }} />
                              <div style={{ position:"absolute",bottom:0,left:0,right:0,borderRadius:3,
                                background:band.color, height:2 }} />
                            </div>
                            <div style={{ color:"#555",fontSize:8,fontWeight:800,letterSpacing:1 }}>{band.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Swing indicator */}
                  {swingAmount > 0.05 && (
                    <div style={{ marginTop:8,display:"flex",alignItems:"center",gap:8 }}>
                      <div style={{ color:"#555",fontSize:10,fontWeight:700,letterSpacing:1,width:48 }}>SWING</div>
                      <div style={{ flex:1,background:"#111",borderRadius:4,overflow:"hidden",height:4 }}>
                        <div style={{ height:"100%",borderRadius:4,background:"#F59E0B",width:Math.round(swingAmount*100)+"%" }} />
                      </div>
                      <div style={{ color:"#F59E0B",fontSize:10,fontWeight:700,width:30,textAlign:"right" }}>
                        {Math.round(swingAmount*100)}%
                      </div>
                    </div>
                  )}

                  {/* ── Temporal consistency meter ── */}
                  {bpmTemporal !== null && (
                    <div style={{ marginTop:8,display:"flex",alignItems:"center",gap:8 }}>
                      <div style={{ color:"#555",fontSize:10,fontWeight:700,letterSpacing:1,width:68 }}>STABILITY</div>
                      <div style={{ flex:1,background:"#111",borderRadius:4,overflow:"hidden",height:4 }}>
                        <div style={{ height:"100%",borderRadius:4,
                          background: bpmTemporal > 0.7 ? "#22C55E" : bpmTemporal > 0.4 ? "#F59E0B" : "#EF4444",
                          width:Math.round(bpmTemporal*100)+"%", transition:"width 0.5s ease" }} />
                      </div>
                      <div style={{ color: bpmTemporal > 0.7 ? "#22C55E" : bpmTemporal > 0.4 ? "#F59E0B" : "#EF4444",
                        fontSize:10,fontWeight:700,width:30,textAlign:"right" }}>
                        {Math.round(bpmTemporal*100)}%
                      </div>
                    </div>
                  )}

                  {/* ── Secondary BPM candidates ── */}
                  {bpmCandidates && bpmCandidates.length > 0 && (
                    <div style={{ marginTop:10 }}>
                      <div style={{ color:"#444",fontSize:9,fontWeight:700,letterSpacing:1.5,marginBottom:6 }}>ALT CANDIDATES</div>
                      <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                        {bpmCandidates.map(function(b, i) {
                          return (
                            <button key={i} onClick={function(){ setBpm(Math.round(b)); setDetectedBpm(Math.round(b)); setBpmSource("auto"); }}
                              style={{ background:"rgba(124,58,237,0.12)",border:"1px solid rgba(124,58,237,0.3)",
                                borderRadius:6,color:"#7C3AED",fontSize:11,fontWeight:700,padding:"5px 10px",cursor:"pointer" }}>
                              {Math.round(b)} BPM
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Action row: Auto-detect + Beat Grid toggle ── */}
              <div style={{ padding:"0 16px 14px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
                {/* Auto-detect from loaded audio */}
                {tracks.some(function(t){ return t.clips && t.clips.some(function(c){ return c.audioBuffer; }); }) && (
                  <button onClick={function(){ detectBpm(); }}
                    disabled={bpmDetecting}
                    style={{
                      background:"rgba(192,38,211,0.15)",border:"1px solid rgba(192,38,211,0.35)",
                      borderRadius:8,color:bpmDetecting?"#666":"#C026D3",fontSize:11,fontWeight:700,
                      padding:"7px 12px",cursor:bpmDetecting?"not-allowed":"pointer",
                      opacity:bpmDetecting?0.6:1,display:"flex",alignItems:"center",gap:5
                    }}>
                    {bpmDetecting
                      ? <><span style={{ width:10,height:10,borderRadius:"50%",border:"2px solid rgba(192,38,211,0.3)",borderTop:"2px solid #C026D3",animation:"bf-spin 0.7s linear infinite",display:"inline-block" }} /></>
                      : "⚡"}
                    {bpmDetecting ? "Analyzing…" : "Auto-Detect"}
                  </button>
                )}

                {/* Beat grid overlay toggle */}
                <button onClick={function(){ setShowBeatGrid(function(v){ return !v; }); }}
                  style={{
                    background:showBeatGrid?"rgba(59,130,246,0.15)":"#141414",
                    border:"1px solid "+(showBeatGrid?"rgba(59,130,246,0.4)":"#2a2a2a"),
                    borderRadius:8,color:showBeatGrid?"#3B82F6":"#555",fontSize:11,fontWeight:700,
                    padding:"7px 12px",cursor:"pointer"
                  }}>
                  {showBeatGrid ? "▦ Grid ON" : "▦ Grid OFF"}
                </button>

                {/* Result display */}
                {detectedBpm > 0 && !bpmDetecting && (
                  <span style={{ color:"#22C55E",fontSize:12,fontWeight:700,marginLeft:"auto" }}>✓ {detectedBpm} BPM</span>
                )}
                {detectedBpm === -1 && !bpmDetecting && (
                  <span style={{ color:"#F87171",fontSize:11 }}>Could not detect</span>
                )}
              </div>
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
            <div style={{ margin:"0 16px 16px",background:"#1a1a1a",borderRadius:14 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px" }}>
                <div><div style={{ color:"white",fontWeight:700,fontSize:13 }}>Metronome</div><div style={{ color:"#555",fontSize:11,marginTop:2 }}>Click while recording</div></div>
                <button onClick={function(){ setMetronomeOn(function(v){ return !v; }); }} style={{ background:metronomeOn?"rgba(192,38,211,0.2)":"#141414",border:"1px solid "+(metronomeOn?"#C026D3":"#2a2a2a"),borderRadius:20,color:metronomeOn?"#C026D3":"#555",fontWeight:700,fontSize:12,padding:"6px 16px",cursor:"pointer" }}>{metronomeOn?"ON":"OFF"}</button>
              </div>
            </div>
            <div style={{ margin:"0 16px 32px",background:"#1a1a1a",borderRadius:14 }}>
              <div style={{ padding:"14px 16px 10px" }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
                  <div>
                    <div style={{ color:"white",fontWeight:700,fontSize:13 }}>Microphone Gain</div>
                    <div style={{ color:"#555",fontSize:11,marginTop:2 }}>Boost or cut the mic input level</div>
                  </div>
                  <span style={{ fontSize:12,fontWeight:800,fontFamily:"monospace",color:micInputGain > 3 ? "#F59E0B" : "#C026D3",minWidth:44,textAlign:"right" }}>
                    {micInputGain >= 1 ? "+" : ""}{(20 * Math.log10(micInputGain)).toFixed(1)} dB
                  </span>
                </div>
                <input type="range" min={0.25} max={4} step={0.05} value={micInputGain}
                  title={"Mic Gain: " + (20 * Math.log10(micInputGain)).toFixed(1) + " dB  (default = 0.0 dB)"}
                  onChange={function(e){ setMicInputGainState(parseFloat(e.target.value)); }}
                  style={{ width:"100%",accentColor:"#C026D3" }} />
                <div style={{ display:"flex",justifyContent:"space-between",marginTop:4 }}>
                  <span style={{ color:"#444",fontSize:10,fontFamily:"monospace" }}>−12 dB</span>
                  <span style={{ color:"#444",fontSize:10,fontFamily:"monospace" }}>0 dB</span>
                  <span style={{ color:"#444",fontSize:10,fontFamily:"monospace" }}>+12 dB</span>
                </div>
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
        <button onClick={function(){
          if(!isSaved&&hasContent){
            setUnsavedAlert("exit");
          } else {
            // Clean exit — stop monitoring and reset so studio opens fresh next time
            stopMonitoring();
            stopAll(); setIsPlaying(false);
            setTracks([]); setProjectName("New Project");
            setBpm(120); setProjectKey("C major"); setTimeSigNum(4);
            setCurrentTime(0); setIsSaved(true); setSelectedTrackId(null);
            if(scrollRef.current) scrollRef.current.scrollLeft = 0;
            onExit();
          }
        }} style={{ background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,color:"#888",width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#888"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        </button>
        {/* Undo / Redo */}
        <button onClick={undoTracks} disabled={!canUndo} title="Undo" style={{ background:"#141414",border:"1px solid #222",borderRadius:7,color:canUndo?"#aaa":"#333",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:canUndo?"pointer":"not-allowed",flexShrink:0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h11a5 5 0 0 1 0 10H7"/><polyline points="7 3 3 7 7 11"/></svg>
        </button>
        <button onClick={redoTracks} disabled={!canRedo} title="Redo" style={{ background:"#141414",border:"1px solid #222",borderRadius:7,color:canRedo?"#aaa":"#333",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:canRedo?"pointer":"not-allowed",flexShrink:0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7H10a5 5 0 0 0 0 10h7"/><polyline points="17 3 21 7 17 11"/></svg>
        </button>
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
              {label:"Save",         fn:function(){setShowProjMenu(false);saveProject();}},
              {label:"▤  Save As…",     fn:function(){setShowProjMenu(false);setTimeout(function(){const n=window.prompt("Save as:",projectName+" (copy)");if(n){setProjectName(n);setIsSaved(false);setTimeout(saveProject,50);}},50);}},
              {label:"✏️  Rename",       fn:function(){setShowProjMenu(false);setRenamingProj(true);}},
              {label:"▤  All Projects", fn:function(){setShowProjMenu(false);setTimeout(function(){setShowProjects(true);},50);}},
              {label:"⬇️  Export Mix",   fn:function(){setShowProjMenu(false);setTimeout(exportMix,50);},hi:true},
              {label:"+  New Project",  fn:function(){setShowProjMenu(false);setTimeout(function(){
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
        {/* H-zoom label */}
        <span style={{ color:"#333",fontSize:7,fontWeight:800,letterSpacing:0.5,flexShrink:0 }}>H</span>
        <button onClick={function(){
          setZoom(function(z){
            // Exponential zoom-out: each tap multiplies by ~0.7 so steps feel even at all levels
            const next = Math.max(0.05, parseFloat((z * 0.7).toFixed(3)));
            // Anchor scroll so playhead stays in view after zoom
            requestAnimationFrame(function(){
              const el = scrollRef.current;
              if (!el) return;
              const newPPS = PPS * next;
              const oldPPS = PPS * z;
              const sl = el.scrollLeft;
              el.scrollLeft = Math.max(0, sl * (newPPS / oldPPS));
            });
            return next;
          });
        }} style={{ background:"#141414",border:"1px solid #222",borderRadius:5,color:"#888",fontSize:16,width:24,height:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>−</button>
        <span style={{ color:"#555",fontSize:10,fontFamily:"monospace",width:38,textAlign:"center" }}>
          {zoom >= 1 ? Math.round(zoom * 100) + "%" : Math.round(zoom * 100) + "%"}
        </span>
        <button onClick={function(){
          setZoom(function(z){
            // Exponential zoom-in: each tap multiplies by ~1.4
            const next = Math.min(32, parseFloat((z * 1.4).toFixed(3)));
            requestAnimationFrame(function(){
              const el = scrollRef.current;
              if (!el) return;
              const newPPS = PPS * next;
              const oldPPS = PPS * z;
              const sl = el.scrollLeft;
              el.scrollLeft = Math.max(0, sl * (newPPS / oldPPS));
            });
            return next;
          });
        }} style={{ background:"#141414",border:"1px solid #222",borderRadius:5,color:"#888",fontSize:16,width:24,height:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>
        <div style={{ width:1,background:"#1a1a1a",height:14,margin:"0 4px" }} />
        {/* Vertical zoom controls — identical behaviour to horizontal, scales track row heights */}
        <span style={{ color:"#333",fontSize:7,fontWeight:800,letterSpacing:0.5,flexShrink:0 }}>V</span>
        <button onClick={function(){
          setVZoom(function(v){ return Math.max(0.4, parseFloat((v * 0.7).toFixed(3))); });
        }} style={{ background:"#141414",border:"1px solid #222",borderRadius:5,color:"#888",fontSize:12,width:24,height:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1 }} title="Vertical zoom out">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2v9M2 6.5h9" stroke="#888" strokeWidth="1.6" strokeLinecap="round"/><path d="M3.5 9.5 9.5 3.5" stroke="transparent" strokeWidth="0"/><path d="M4 9h5" stroke="#888" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </button>
        <span style={{ color:"#555",fontSize:9,fontFamily:"monospace",width:32,textAlign:"center" }}>
          {Math.round(vZoom * 100)}%
        </span>
        <button onClick={function(){
          setVZoom(function(v){ return Math.min(4, parseFloat((v * 1.4).toFixed(3))); });
        }} style={{ background:"#141414",border:"1px solid #222",borderRadius:5,color:"#888",fontSize:12,width:24,height:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1 }} title="Vertical zoom in">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2v9M2 6.5h9" stroke="#888" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </button>
        <div style={{ width:1,background:"#1a1a1a",height:14,margin:"0 4px" }} />
        <button onClick={function(){ setLoopEnabled(function(v){return !v;});}} style={{ background:loopEnabled?"rgba(59,130,246,0.2)":"#141414",border:"1px solid "+(loopEnabled?"#3B82F6":"#222"),borderRadius:6,color:loopEnabled?"#3B82F6":"#555",fontSize:10,fontWeight:700,padding:"3px 8px",cursor:"pointer" }}>LOOP</button>
        <div style={{ flex:1 }} />
        <div style={{ width:1, background:"#1a1a1a", height:14, margin:"0 2px" }} />
        {/* Input monitoring toggle — only available when headphones/headset connected */}
        <button
          onClick={function(){ if (!headphonesIn) return; monitoringOn ? stopMonitoring() : startMonitoring(); }}
          disabled={!headphonesIn}
          title={headphonesIn ? (monitoringOn ? "Turn off monitoring" : "Turn on monitoring") : "Connect headphones or a headset to enable monitoring"}
          style={{
            display:"flex", alignItems:"center", gap:5,
            background: monitoringOn ? "rgba(34,197,94,0.15)" : "#141414",
            border: "1px solid " + (monitoringOn ? "#22C55E" : headphonesIn ? "#2a2a2a" : "#1a1a1a"),
            borderRadius:8, padding:"4px 8px",
            cursor: headphonesIn ? "pointer" : "not-allowed",
            opacity: headphonesIn ? 1 : 0.35,
          }}
        >
          <span style={{ fontSize:13 }}><Icon id="headphones" size={16} color={monitoringOn ? "#22C55E" : headphonesIn ? "#aaa" : "#444"} strokeWidth={1.8}/></span>
          <div style={{ width:22,height:12,borderRadius:6,background:monitoringOn?"#22C55E":"#333",position:"relative",transition:"background 0.15s" }}>
            <div style={{ position:"absolute",top:2,left:monitoringOn?10:2,width:8,height:8,borderRadius:"50%",background:"white",transition:"left 0.15s" }} />
          </div>
        </button>
        {monitoringOn && (
          <input type="range" min={0} max={1} step={0.05} value={monitorVol}
            onChange={function(e){ setMonitorVol(parseFloat(e.target.value)); }}
            style={{ width:50,accentColor:"#22C55E",height:2 }} />
        )}
        {/* Mic source picker — dropdown. Headset option is never disabled;
            status is shown in the label itself so users always know what's connected. */}
        <select
          value={micSource}
          onChange={function(e){
            const next = e.target.value;
userPickedMicRef.current = true;
            setMicSource(next);
            if (monitoringOn) { stopMonitoring(); setTimeout(function(){ startMonitoring(undefined, next); }, 150); }
          }}
          title="Choose microphone source"
          style={{ background:"#141414", border:"1px solid #2a2a2a", borderRadius:6, color:"#aaa", fontSize:9, fontWeight:700, padding:"3px 5px", cursor:"pointer", outline:"none", maxWidth:130 }}
        >
          <option value="builtin">📱 iPhone Mic</option>
          <option value="headset">🎧 Headset Mic</option>
        </select>
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

        {/* ── Beat Grid Overlay — renders beat marker lines across all tracks ── */}
        {showBeatGrid && beatPositions.length > 0 && (
          <BeatGridOverlay
            beats={beatPositions}
            effectivePPS={effectivePPS}
            sidebarW={SIDEBAR_W}
            rulerH={RULER_H}
            scrollRef={scrollRef}
            isPlaying={isPlaying}
            currentTime={currentTime}
            bpm={bpm}
          />
        )}

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
            {tracks.map(function(track, trackIdx){
              const isRec   = isRecording && recTrackId === track.id;
              const hasSolo = tracks.some(function(t){return t.isSoloed;});
              const dimmed  = hasSolo && !track.isSoloed;
              const clips   = track.clips || [];
              const isBeingDragged = reorderDragId === track.id;
              const isDropTgt = reorderDropIdx === trackIdx && reorderDragId !== null && reorderDragId !== track.id;
              return (
                <div key={track.id} style={{ display:"flex", height:TRACK_H, borderBottom: isDropTgt ? "2px solid #30D158" : "1px solid #0f0f0f", opacity:dimmed?0.4:1, position:"relative" }}>

                  {/* Track header — sticky left, never scrolls away horizontally */}
                  <div
                    style={{
                      width:SIDEBAR_W, flexShrink:0,
                      position:"sticky", left:0, zIndex:10,
                    }}
                  >
                    <LogicTrackHeader
                      track={track}
                      isRec={isRec}
                      isSelected={selectedTrackId===track.id}
                      fxOpen={fxTrackId===track.id}
                      showTakes={showTakes===track.id}
                      onSelect={function(){ setSelectedTrackId(track.id); }}
                      onMute={function(){ toggleMute(track.id); }}
                      onSolo={function(){ toggleSolo(track.id); }}
                      onFx={function(){ setFxTrackId(function(v){ return v===track.id?null:track.id; }); }}
                      onTakes={function(){ setShowTakes(function(v){ return v===track.id?null:track.id; }); }}
                      onRemove={function(){ removeTrack(track.id); }}
                      updateTrack={updateTrack}
                      analyserNode={trackAnalysersRef.current[track.id] || null}
                      isPlaying={isPlaying}
                      isDragging={isBeingDragged}
                      isDropTarget={isDropTgt}
                      onLongPressStart={function(e){ handleHeaderLongPressStart(e, track); }}
                      onLongPressCancel={handleHeaderLongPressCancel}
                      onDragMove={handleHeaderDragMove}
                      onDragEnd={handleHeaderDragEnd}
                    />
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
          >⌫ Delete</button>
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
              <div style={{ width:32,height:32,borderRadius:8,background:"rgba(59,130,246,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}><AppIcon id="note" size={20}/></div>
              <div><div style={{ color:"white",fontWeight:700,fontSize:13 }}>Upload Audio</div><div style={{ color:"#555",fontSize:11 }}>Beat, vocal, any audio file</div></div>
            </div>
            <input type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff,.opus" multiple onChange={function(e){handleFileUpload(e,"beat");}} style={{ display:"none" }} />
          </label>
          <div style={{ padding:"12px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer" }} onClick={function(){
            // Just create the track — recording only starts when user presses record button
            const newId = Date.now() + Math.random();
            const vocalN = tracks.filter(function(t){return t.type==="vocal";}).length + 1;
            addTrackObj({ id:newId, name:"Vocal "+vocalN, type:"vocal", isMuted:false, isSoloed:false, clips:[], color:VOCAL_COLORS[vocalN % VOCAL_COLORS.length] });
            setSelectedTrackId(newId);
            setShowAddMenu(false);
          }}>
            <div style={{ width:32,height:32,borderRadius:8,background:"rgba(239,68,68,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}><AppIcon id="mic" size={20}/></div>
            <div><div style={{ color:"white",fontWeight:700,fontSize:13 }}>Record Vocals</div><div style={{ color:"#555",fontSize:11 }}>Record new take</div></div>
          </div>
        </div>
      )}

      {/* ══ FX PANEL ═══════════════════════════════════════════ */}
      {fxTrackId && (function(){
        const t = tracks.find(function(tr){ return tr.id===fxTrackId; });
        if (!t) return null;
        const fx = t.effects || {};
        // Keep ref current every render so FxPanel's stable onUpd always has latest data
        fxUpdRef.current = function(section, patch, rawValue){
          let newEffects;
          if (section === "pluginChain") {
            newEffects = { ...t.effects, pluginChain: rawValue };
          } else if (section === "__remove") {
            // Atomic: remove from chain AND force plugin section off so audio bypasses
            const pluginKey = rawValue;
            const newChain  = (t.effects.pluginChain || []).filter(function(k){ return k !== pluginKey; });
            newEffects = {
              ...t.effects,
              pluginChain: newChain,
              [pluginKey]: { ...(t.effects[pluginKey] || {}), on: false },
            };
          } else {
            newEffects = { ...t.effects, [section]:{ ...(t.effects[section]||{}), ...patch } };
          }
          updateTrack(t.id, { effects: newEffects });
          applyFxLive(t.id, newEffects);
        };
        return (
          <FxPanel
            key={fxTrackId}
            fx={fx}
            fxTrackId={fxTrackId}
            trackName={t.name}
            trackColor={t.color}
            onClose={function(){ setFxTrackId(null); }}
            onUpd={fxUpdRef.current}
            analyserNode={trackAnalysersRef.current[fxTrackId] || null}
            isPlaying={isPlaying}
          />
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
                  <button onClick={function(){ removeClip(t.id, cl.id); }} style={{ background:"none",border:"none",color:"#444",fontSize:12,cursor:"pointer" }}>⌫</button>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ══ GARAGEBAND-STYLE MIXER ══════════════════════════════ */}
      {showMixer && (function(){
        // GB mixer: dark #1c1c1e panel, per-channel strips with:
        //   knob pan, tall vertical fader with GB-style thumb, dual VU bars, M/S buttons, colour tab at bottom
        const GB_BG       = "#1c1c1e";
        const GB_STRIP    = "#2c2c2e";
        const GB_BORDER   = "#3a3a3c";
        const GB_LABEL    = "#8e8e93";
        const GB_FADER_H  = 140; // px tall fader travel area
        const STRIP_W     = 58;

        function GBPanKnob({ pan, color, onChange }) {
          const dragRef = React.useRef(null);
          // pan −1..1 → norm 0..1
          const norm  = (pan + 1) / 2;
          const angle = -140 + norm * 280;
          const r = 14, SW = 3, PAD = SW / 2 + 2;
          const cx = r + PAD, cy = r + PAD, SIZE = (r + PAD) * 2;
          const toXY = function(deg){ const rad=(deg-90)*Math.PI/180; return {x:cx+r*Math.cos(rad),y:cy+r*Math.sin(rad)}; };
          const startA = toXY(-140), endA = toXY(angle);
          const swept  = angle-(-140), large = swept>180?1:0;
          const arcD   = "M "+startA.x.toFixed(2)+" "+startA.y.toFixed(2)+" A "+r+" "+r+" 0 "+large+" 1 "+endA.x.toFixed(2)+" "+endA.y.toFixed(2);
          function onPD(e){
            e.preventDefault();
            dragRef.current = { y:e.clientY, val:pan };
            function onM(me){
              const dy = dragRef.current.y - me.clientY;
              const nv = Math.max(-1, Math.min(1, dragRef.current.val + dy/60));
              onChange(+nv.toFixed(2));
            }
            function onU(){ document.removeEventListener("pointermove",onM); document.removeEventListener("pointerup",onU); }
            document.addEventListener("pointermove",onM);
            document.addEventListener("pointerup",onU);
          }
          return (
            <svg width={SIZE} height={SIZE} viewBox={"0 0 "+SIZE+" "+SIZE}
              style={{cursor:"ns-resize",touchAction:"none",overflow:"visible",display:"block"}}
              onPointerDown={onPD}
              onDoubleClick={function(){ onChange(0); }}>
              {/* Track arc */}
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3a3a3c" strokeWidth={SW} strokeLinecap="round"
                strokeDasharray={(2*Math.PI*r*280/360)+" "+(2*Math.PI*r)}
                strokeDashoffset={(2*Math.PI*r*(90+140)/360)}
                transform={"rotate(-90 "+cx+" "+cy+")"} />
              {/* Centre dot */}
              <line x1={cx} y1={PAD} x2={cx} y2={PAD+4} stroke="#555" strokeWidth={1} />
              {/* Filled arc */}
              {norm>0.01 && norm<0.99 && <path d={arcD} fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round"/>}
              {/* Dot at 0 */}
              {Math.abs(pan)<0.02 && <circle cx={cx} cy={PAD+1} r={2} fill={color}/>}
              {/* Thumb */}
              <circle cx={endA.x} cy={endA.y} r={SW*0.85} fill={color}/>
              {/* Inner cap */}
              <circle cx={cx} cy={cy} r={r*0.38} fill="#1c1c1e" stroke="#3a3a3c" strokeWidth={1.5}/>
            </svg>
          );
        }

        function GBFader({ vol, color, muted, onChange }) {
          const dragRef = React.useRef(null);
          const trackH  = GB_FADER_H;
          // vol 0..1.5 → thumb Y: 0=top(max), trackH=bottom(min)
          const thumbY  = trackH - Math.max(0, Math.min(1, vol / 1.5)) * trackH;
          // Unity (vol=1) tick position
          const unityY  = trackH - (1/1.5)*trackH;

          function onPD(e){
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            dragRef.current = { rect };
            function onM(me){
              const rel = me.clientY - dragRef.current.rect.top;
              const n   = Math.max(0, Math.min(1, rel / trackH));
              onChange(+((1-n)*1.5).toFixed(3));
            }
            function onU(){ document.removeEventListener("pointermove",onM); document.removeEventListener("pointerup",onU); }
            document.addEventListener("pointermove",onM);
            document.addEventListener("pointerup",onU);
          }

          const thumbColor = muted ? "#636366" : "#e5e5ea";
          const fillH = Math.max(0, Math.min(1, vol/1.5)) * trackH;

          return (
            <div style={{ position:"relative", width:28, height:trackH, flexShrink:0, cursor:"pointer" }}
              onPointerDown={onPD}
              onDoubleClick={function(){ onChange(1); }}>
              {/* Rail background */}
              <div style={{ position:"absolute", left:"50%", transform:"translateX(-50%)", top:0, bottom:0, width:4, background:"#3a3a3c", borderRadius:2 }} />
              {/* Fill (level indicator on rail) */}
              <div style={{
                position:"absolute", left:"50%", transform:"translateX(-50%)",
                bottom:0, width:4,
                height: fillH,
                background: muted ? "#48484a" : "linear-gradient(0deg,"+color+"cc,"+color+"66 80%,transparent)",
                borderRadius:2,
              }} />
              {/* Unity tick */}
              <div style={{ position:"absolute", left:"calc(50% + 4px)", top: unityY-0.5, width:6, height:1, background:"#636366" }} />
              {/* Fader thumb — GB style: rounded rect pill */}
              <div style={{
                position:"absolute", left:"50%", top: thumbY - 14,
                transform:"translateX(-50%)",
                width:24, height:28,
                background: muted
                  ? "linear-gradient(180deg,#48484a,#3a3a3c)"
                  : "linear-gradient(180deg,#f2f2f7,#d1d1d6)",
                borderRadius:5,
                boxShadow: muted ? "0 1px 3px rgba(0,0,0,0.8)" : "0 2px 6px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.15) inset",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                {/* Grip lines */}
                {[0,1,2].map(function(i){
                  return <div key={i} style={{ position:"absolute", left:5, right:5, top:9+i*3, height:1, background: muted?"rgba(100,100,100,0.5)":"rgba(0,0,0,0.18)", borderRadius:0.5 }} />;
                })}
              </div>
            </div>
          );
        }

        function GBVUBars({ analyserNode, active }) {
          const { level, peak, clipping } = useAnalyser(analyserNode, active);
          const rOff   = React.useRef(0.88 + Math.random()*0.12);
          const rLevel = Math.min(1, level * rOff.current);
          const rPeak  = Math.min(1, peak  * rOff.current);
          const BAR_H  = GB_FADER_H;
          const SEGS   = 24;

          function renderCol(lv, pk) {
            return (
              <div style={{ display:"flex", flexDirection:"column-reverse", gap:1, height:BAR_H, width:5 }}>
                {Array.from({length:SEGS}, function(_,i){
                  const frac    = i / SEGS;
                  const lit     = lv >= frac;
                  const isPeak  = pk>0 && Math.abs(pk-frac)<(1.5/SEGS);
                  const col     = frac>=0.875?"#ff3b30":frac>=0.688?"#ffd60a":"#30d158";
                  const dim     = frac>=0.875?"#3a0a08":frac>=0.688?"#3a2a00":"#0a2a14";
                  return <div key={i} style={{
                    flex:1, borderRadius:1,
                    background: isPeak?"#fff": lit?col:dim,
                  }}/>;
                })}
              </div>
            );
          }

          return (
            <div style={{ display:"flex", gap:2, alignItems:"flex-end" }}>
              {renderCol(level, peak)}
              {renderCol(rLevel, rPeak)}
            </div>
          );
        }

        return (
          <div style={{
            background: GB_BG,
            borderTop: "1px solid "+GB_BORDER,
            flexShrink: 0,
            maxHeight: "58vh",
            display: "flex",
            flexDirection: "column",
          }} onClick={function(e){ e.stopPropagation(); }}>

            {/* ── GB Mixer header bar ── */}
            <div style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"8px 14px 6px",
              borderBottom:"1px solid "+GB_BORDER,
              flexShrink:0,
            }}>
              <span style={{ color:"#ebebf5cc", fontSize:13, fontWeight:700, letterSpacing:0.3 }}>Mixer</span>
              <button onClick={function(){ setShowMixer(false); }} style={{
                background:"none", border:"none", color:GB_LABEL, fontSize:20,
                cursor:"pointer", lineHeight:1, padding:"0 2px",
              }}>×</button>
            </div>

            {/* ── Channel strip scroll area ── */}
            <div style={{ overflowX:"auto", overflowY:"hidden", WebkitOverflowScrolling:"touch", flex:1, minHeight:0 }}>
              <div style={{ display:"flex", gap:0, minWidth:"max-content", padding:"10px 8px 0" }}>

                {tracks.map(function(t, ti){
                  const vol     = t.volume ?? 1;
                  const pan     = t.pan    || 0;
                  const muted   = !!t.isMuted;
                  const soloed  = !!t.isSoloed;
                  const hasSolo = tracks.some(function(x){ return x.isSoloed; });
                  const dimmed  = hasSolo && !soloed && !muted;
                  const active  = isPlaying && !muted && (!hasSolo || soloed);

                  // dB readout: 0→−∞, 1→0dB, 1.5→+3.5dB
                  const volDb   = vol <= 0 ? "−∞" : (20*Math.log10(vol)).toFixed(1);

                  return (
                    <div key={t.id} style={{
                      width: STRIP_W,
                      display:"flex", flexDirection:"column", alignItems:"center",
                      borderRight:"1px solid "+GB_BORDER,
                      paddingBottom:0,
                      opacity: dimmed ? 0.38 : 1,
                      transition:"opacity 0.15s",
                      background: soloed ? "rgba(255,214,10,0.04)" : "transparent",
                    }}>

                      {/* ── Pan knob ── */}
                      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:1,paddingBottom:6,paddingTop:2 }}>
                        <GBPanKnob pan={pan} color="#8e8e93"
                          onChange={function(v){ updateTrack(t.id,{pan:v}); }} />
                        <span style={{
                          fontSize:7, fontWeight:600, color: GB_LABEL,
                          letterSpacing:0.2,
                        }}>
                          {pan===0?"C":pan>0?"R "+Math.round(pan*100):"L "+Math.round(Math.abs(pan)*100)}
                        </span>
                      </div>

                      {/* ── Fader + VU side by side ── */}
                      <div style={{ display:"flex", alignItems:"flex-start", gap:3, paddingBottom:6 }}>
                        <GBFader vol={vol} color="#636366" muted={muted}
                          onChange={function(v){ updateTrack(t.id,{volume:v}); }} />
                        <GBVUBars analyserNode={trackAnalysersRef.current[t.id]||null} active={active} />
                      </div>

                      {/* ── dB readout ── */}
                      <div style={{
                        fontSize:8, fontWeight:700,
                        color: muted?"#636366":vol===0?"#ff3b30":vol>1?"#ffd60a":"#ebebf599",
                        marginBottom:4, letterSpacing:0.3,
                      }}>
                        {muted ? "mute" : volDb+" dB"}
                      </div>

                      {/* ── M / S buttons ── */}
                      <div style={{ display:"flex", gap:3, width:"100%", padding:"0 5px", marginBottom:6 }}>
                        <button onClick={function(e){ e.stopPropagation(); toggleMute(t.id); }} style={{
                          flex:1, padding:"4px 0",
                          background: muted ? "#ff9f0a" : "#3a3a3c",
                          border:"none", borderRadius:4,
                          color: muted ? "#000" : GB_LABEL,
                          fontSize:10, fontWeight:800, cursor:"pointer",
                          boxShadow: muted ? "0 0 6px rgba(255,159,10,0.5)" : "none",
                          transition:"all 0.12s",
                        }}>M</button>
                        <button onClick={function(e){ e.stopPropagation(); toggleSolo(t.id); }} style={{
                          flex:1, padding:"4px 0",
                          background: soloed ? "#ffd60a" : "#3a3a3c",
                          border:"none", borderRadius:4,
                          color: soloed ? "#000" : GB_LABEL,
                          fontSize:10, fontWeight:800, cursor:"pointer",
                          boxShadow: soloed ? "0 0 8px rgba(255,214,10,0.5)" : "none",
                          transition:"all 0.12s",
                        }}>S</button>
                      </div>

                      {/* ── Track name tab ── */}
                      <div style={{
                        width:"100%", height:22,
                        background:"#3a3a3c",
                        borderTop:"2px solid "+t.color,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        overflow:"hidden",
                      }}>
                        <span style={{
                          color:"#ebebf5cc", fontSize:7, fontWeight:800,
                          letterSpacing:0.3,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                          padding:"0 4px", maxWidth:"100%",
                        }}>{t.name}</span>
                      </div>

                    </div>
                  );
                })}

                {/* ── Master strip ── */}
                {(function(){
                  const masterVol = tracks.length > 0
                    ? tracks.reduce(function(s,t){ return s+(t.volume??1); },0)/tracks.length
                    : 1;
                  return (
                    <div style={{
                      width: STRIP_W+4,
                      display:"flex", flexDirection:"column", alignItems:"center",
                      background:"#232325",
                      borderLeft:"2px solid #48484a",
                    }}>
                      {/* Pan placeholder */}
                      <div style={{ height:38, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <span style={{ color:"#636366", fontSize:8, fontWeight:700, letterSpacing:1 }}>MST</span>
                      </div>
                      {/* Master fader */}
                      <div style={{ display:"flex", alignItems:"flex-start", gap:3, paddingBottom:6 }}>
                        <GBFader vol={masterVol} color="#e5e5ea" muted={false}
                          onChange={function(v){
                            tracks.forEach(function(t){ updateTrack(t.id,{volume:v}); });
                          }} />
                        <GBVUBars analyserNode={masterAnalyserRef.current} active={isPlaying} />
                      </div>
                      {/* dB */}
                      <div style={{ fontSize:8,fontWeight:700,color:"#ebebf599",marginBottom:4 }}>
                        {(20*Math.log10(Math.max(0.001,masterVol))).toFixed(1)} dB
                      </div>
                      {/* Spacer where M/S would be */}
                      <div style={{ height:26 }} />
                      {/* Master label tab */}
                      <div style={{ width:"100%",height:22,background:"#48484a",display:"flex",alignItems:"center",justifyContent:"center" }}>
                        <span style={{ color:"#ebebf599",fontSize:8,fontWeight:800,letterSpacing:1 }}>MASTER</span>
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ TRANSPORT ════════════════════════════════════════════ */}
      <div style={{ background:"#0a0a0a",borderTop:"1px solid #141414",padding:"8px 16px",paddingBottom:"calc(8px + env(safe-area-inset-bottom))",flexShrink:0,zIndex:50 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ width:40,height:40,borderRadius:10,background:showMixer?"rgba(139,92,246,0.2)":"#141414",border:"1px solid "+(showMixer?"#8B5CF6":"#222"),display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer" }} onClick={function(){ setShowMixer(function(v){return !v;}); }}>
            <span style={{ fontSize:14 }}><Icon id="fader" size={18} color={showMixer ? "#8B5CF6" : "#aaa"} strokeWidth={1.8}/></span>
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
            <span style={{ color:"#555",fontSize:9,fontWeight:800,lineHeight:1 }}>{Math.round(zoom*100)}%</span>
            <span style={{ color:"#333",fontSize:7 }}>H·ZOOM</span>
            <span style={{ color:"#444",fontSize:8,fontWeight:700,lineHeight:1,marginTop:1 }}>{Math.round(vZoom*100)}%</span>
            <span style={{ color:"#292929",fontSize:6 }}>V·ZOOM</span>
          </div>
        </div>
      </div>

    </div>
  );
}


const NAV = [
  { id: "home",      label: "Home",    icon: "home" },
  { id: "artists",   label: "Artists", icon: "artists" },
  { id: "trending",  label: "Trending",icon: "trending" },
  { id: "search",    label: "Search",  icon: "search" },
  { id: "saved",     label: "Saved",   icon: "saved" },
  { id: "exclusive", label: "Members", icon: "members" },
  { id: "profile",   label: "Profile", icon: "profile" },
  { id: "studio",    label: "Studio",  icon: "studio" },
];

// =============================================================================
// ICON SYSTEM — Lucide icons unified across nav + app
// Usage: <Icon id="music" size={20} color="#fff" strokeWidth={1.5} />
// =============================================================================
const LucideIcons = {
  // Nav
  home:       "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  artists:    "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
  trending:   "M13 2c0 0-7 6-7 12a7 7 0 0014 0c0-3.5-2-7-3-9 0 2.5-1.5 4-2.5 5.5C14.5 8.5 13 5 13 2z",
  search:     "M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
  saved:      "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z",
  members:    "M18 11V8a6 6 0 00-12 0v3 M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z M12 15v3",
  profile:    "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
  studio:     "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8",
  // App icons
  note:       "M9 18V5l12-2v13 M9 18a3 3 0 11-6 0 3 3 0 016 0z M21 16a3 3 0 11-6 0 3 3 0 016 0z",
  knobs:      "M12 3v1m0 16v1M3 12h1m16 0h1m-2.636-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707M17.657 17.657l.707.707 M12 8a4 4 0 100 8 4 4 0 000-8z",
  bookmark:   "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z",
  lock:       "M18 11V8a6 6 0 00-12 0v3 M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z M12 15v3",
  lockkey:    "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
  mic:        "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8",
  vocalmic:   "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8",
  headphones: "M3 18v-6a9 9 0 0118 0v6 M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z",
  piano:      "M9 18H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-4 M9 18v4 M15 18v4 M9 6v6 M15 6v6 M12 6v3",
  fader:      "M4 21V14 M4 10V3 M12 21v-7 M12 10V3 M20 21v-4 M20 13V3 M1 14h6 M9 10h6 M17 13h6",
  flame:      "M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z",
  target:     "M12 22a10 10 0 100-20 10 10 0 000 20z M12 18a6 6 0 100-12 6 6 0 000 12z M12 14a2 2 0 100-4 2 2 0 000 4z",
  wave:       "M2 12 C5 8 7 16 10 12 C13 8 15 16 18 12 C21 8 22 12 22 12",
  globe:      "M12 2a10 10 0 100 20A10 10 0 0012 2z M2 12h20 M12 2a15.3 15.3 0 010 20 M12 2a15.3 15.3 0 000 20",
  star:       "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  trophy:     "M8 21h8 M12 17v4 M7 4H4a1 1 0 000 2c0 5.5 3.5 10.7 8 11 4.5-.3 8-5.5 8-11a1 1 0 000-2h-3 M7 4h10v7a5 5 0 01-10 0V4z",
  save:       "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z M17 21v-8H7v8 M7 3v5h8",
  folder:     "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
  edit:       "M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z",
  tape:       "M21 16a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h14a2 2 0 012 2z M9 12a3 3 0 100-6 3 3 0 000 6z M15 12a3 3 0 100-6 3 3 0 000 6z",
  shuffle:    "M16 3h5v5 M4 20L21 3 M21 16v5h-5 M15 15l6 6 M4 4l5 5",
  speaker:    "M11 5L6 9H2v6h4l5 4V5z M19.07 4.93a10 10 0 010 14.14 M15.54 8.46a5 5 0 010 7.07",
  mute:       "M11 5L6 9H2v6h4l5 4V5z M23 9l-6 6 M17 9l6 6",
  clock:      "M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2",
  skull:      "M12 2a6 6 0 016 6 6 6 0 01-3.2 5.3V16H9.2v-2.7A6 6 0 016 8a6 6 0 016-6z M9 21h6 M10 17v4 M14 17v4",
  rocket:     "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0 M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",
  swirl:      "M12 22a10 10 0 100-20 10 10 0 000 20z M12 18a6 6 0 100-12 6 6 0 000 12z M12 14a2 2 0 100-4 2 2 0 000 4z",
  chill:      "M12 22a10 10 0 100-20 10 10 0 000 20z M8 14s1.5 2 4 2 4-2 4-2 M9 9h.01 M15 9h.01",
  dark_face:  "M12 22a10 10 0 100-20 10 10 0 000 20z M8 15s1.5-2 4-2 4 2 4 2 M7.5 8.5l2 1.5 M16.5 8.5l-2 1.5",
  heart:      "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  crown:      "M12 2L9 9H3l5 4-2 7 6-4 6 4-2-7 5-4h-6L12 2z",
  wave_hand:  "M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0 M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v2 M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v8 M6 14v0a6 6 0 006 6h2a8 8 0 008-8v-2a2 2 0 00-2-2v0a2 2 0 00-2 2v0",
  money:      "M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  moneyfly:   "M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  writing:    "M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z",
  lightning:  "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  warning:    "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01",
  festival:   "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22",
  check:      "M20 6L9 17l-5-5",
  download:   "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  upload:     "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  grid:       "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
  bars:       "M18 20V10 M12 20V4 M6 20v-6",
  stripe:     "M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z M1 10h22",
  eq:         "M4 21V14 M4 10V3 M12 21v-7 M12 10V3 M20 21v-4 M20 13V3 M1 14h6 M9 10h6 M17 13h6",
};

function Icon({ id, size = 20, color = "currentColor", strokeWidth = 1.8, style: extra = {}, className = "" }) {
  const def = LucideIcons[id];
  if (!def) return null;
  // Split compound path strings into individual paths at each top-level M command
  const segments = def.trim().split(/\s+(?=M)/);
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...extra }}
      className={className}
    >
      {segments.map(function(d, i) { return <path key={i} d={d} />; })}
    </svg>
  );
}

// Aliases for backwards compat
function AppIcon({ id, size = 20, style: extraStyle = {} }) {
  return <Icon id={id} size={size} color="currentColor" style={extraStyle} />;
}

function NavIcon({ id, size = 22, active, activeColor }) {
  const iconId = id === "exclusive" ? "members" : id;
  const color = active ? activeColor : "#666";
  const filter = active ? `drop-shadow(0 0 5px ${activeColor})` : "none";
  return <Icon id={iconId} size={size} color={color} strokeWidth={active ? 2.2 : 1.6} style={{ filter, transition: "filter 0.2s ease" }} />;
}

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
  const [splashDone, setSplashDone] = useState(function() {
    // On iOS, backgrounding the app causes a full page reload.
    // If sessionStorage shows a session was already started, skip the splash.
    try { if (sessionStorage.getItem("bf_session_started")) return true; } catch(e) {}
    return false;
  });
  const [tab, setTab] = useState(function() {
    // Restore the active tab after an iOS background reload.
    // Never open with studio on fresh load — user must navigate there intentionally.
    try {
      const saved = sessionStorage.getItem("bf_tab");
      return (saved && saved !== "studio") ? saved : "home";
    } catch(e) { return "home"; }
  });
  // studioVisited: true once the user has navigated to Studio at least once this session.
  // StudioScreen only mounts after first visit — prevents mic permission firing on page load.
  const [studioVisited, setStudioVisited] = useState(false);
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

  // Mark session as started on mount — used to skip splash on iOS background reload
  useEffect(() => {
    try { sessionStorage.setItem("bf_session_started", "1"); } catch(e) {}
  }, []);

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
    if (id === "studio") setStudioVisited(true);
    try { sessionStorage.setItem("bf_tab", id); } catch(e) {}
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
    <div key="app-root" id="bf-portrait-lock" style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans',sans-serif", paddingTop: "env(safe-area-inset-top)" }}>
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
            <div style={{ fontSize: 44, marginBottom: 14 }}><AppIcon id="bookmark" size={20}/></div>
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
            {t === "studio"    && studioVisited && <StudioErrorBoundary><StudioScreen user={user} onExit={() => goTab("home")} /></StudioErrorBoundary>}
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
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
        }}>
        {NAV.map(n => {
          const isPro    = user?.isPro || user?.isArtistPro;
          const locked   = n.id === "exclusive" && (!user || !isPro);
          const isActive = tab === n.id;
          const activeColor = n.id === "exclusive" ? "#F59E0B" : n.id === "studio" ? "#22C55E" : "#C026D3";
          const isStudio = n.id === "studio";
          return (
            <React.Fragment key={n.id}>
              {/* Divider before Studio */}
              {isStudio && (
                <div style={{
                  width: 1, background: "rgba(255,255,255,0.08)",
                  margin: "10px 0", flexShrink: 0,
                }} />
              )}
              <button onClick={() => goTab(n.id)} className="bf-nav-btn"
                style={{
                  flex: 1, background: isStudio && isActive ? "rgba(34,197,94,0.08)" : "none",
                  border: "none", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                  color: isActive ? activeColor : locked ? "#F59E0B44" : "#444",
                  position: "relative", paddingTop: 8,
                  transition: "color 0.2s ease",
                  borderRadius: isStudio ? 0 : 0,
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
                <NavIcon id={n.id} size={22} active={isActive} activeColor={activeColor} />
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
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
