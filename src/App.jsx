import { useState, useCallback, useRef, useEffect } from "react";

// ============================================================
// DESIGN TOKENS (画像トーン: 暗赤シネマ)
// ============================================================
const C = {
  bg:       "#090909",
  surface:  "rgba(18,8,8,0.92)",
  primary:  "#ef4444",     // 赤
  primaryD: "#dc2626",
  primaryG: "rgba(239,68,68,0.25)",
  teal:     "#0ea5e9",     // 青緑 (アクセント)
  gold:     "#fbbf24",
  text:     "#f1f5f9",
  muted:    "#64748b",
  border:   "rgba(239,68,68,0.45)",
};

// ============================================================
// HIRAGANA DATA  (50音 × かいじゅう)
// ============================================================
const HIRAGANA_ROWS = [
  { row: "ア行", kana: ["あ","い","う","え","お"], roma: ["a","i","u","e","o"] },
  { row: "カ行", kana: ["か","き","く","け","こ"], roma: ["ka","ki","ku","ke","ko"] },
  { row: "サ行", kana: ["さ","し","す","せ","そ"], roma: ["sa","shi","su","se","so"] },
  { row: "タ行", kana: ["た","ち","つ","て","と"], roma: ["ta","chi","tsu","te","to"] },
  { row: "ナ行", kana: ["な","に","ぬ","ね","の"], roma: ["na","ni","nu","ne","no"] },
  { row: "ハ行", kana: ["は","ひ","ふ","へ","ほ"], roma: ["ha","hi","fu","he","ho"] },
  { row: "マ行", kana: ["ま","み","む","め","も"], roma: ["ma","mi","mu","me","mo"] },
  { row: "ヤ行", kana: ["や","ゆ","よ"],           roma: ["ya","yu","yo"] },
  { row: "ラ行", kana: ["ら","り","る","れ","ろ"], roma: ["ra","ri","ru","re","ro"] },
  { row: "ワ行", kana: ["わ","を","ん"],           roma: ["wa","wo","n"] },
];
const ALL_KANA = HIRAGANA_ROWS.flatMap((r) => r.kana.map((k, i) => ({ kana: k, roma: r.roma[i] })));

const MONSTERS = ["👾","🦑","🐙","👹","🦖","🤖","👺","🛸"];

function pickMonster(seed) { return MONSTERS[seed % MONSTERS.length]; }

// バトル用: ランダムにかなを n 個選ぶ
function pickBattleKana(n = 5) {
  const shuffled = [...ALL_KANA].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ============================================================
// CITY BOKEH BACKGROUND
// ============================================================
function CityBokeh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      <div style={{ position:"absolute", width:380, height:380, background:"#f97316", filter:"blur(110px)", opacity:0.13, top:"10%", left:"-8%" }} />
      <div style={{ position:"absolute", width:300, height:300, background:"#ea580c", filter:"blur(90px)",  opacity:0.12, top:"5%",  right:"-5%" }} />
      <div style={{ position:"absolute", width:260, height:260, background:"#b45309", filter:"blur(100px)", opacity:0.10, bottom:"15%", left:"15%" }} />
      <div style={{ position:"absolute", width:200, height:200, background:"#0f766e", filter:"blur(80px)",  opacity:0.08, bottom:"20%", right:"10%" }} />
      <div style={{ position:"absolute", width:150, height:150, background:"#dc2626", filter:"blur(70px)",  opacity:0.07, top:"50%",  left:"40%" }} />
    </div>
  );
}

// ============================================================
// HP BAR
// ============================================================
function HPBar({ hp, maxHp, label }) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const color = pct > 60 ? "#22c55e" : pct > 30 ? "#fbbf24" : "#ef4444";
  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:2 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.6rem", color: C.muted, fontFamily:"monospace", letterSpacing:"0.08em" }}>
        <span>{label}</span><span>{hp}/{maxHp}</span>
      </div>
      <div style={{ width:"100%", height:8, background:"rgba(0,0,0,0.5)", borderRadius:4, overflow:"hidden", border:"1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, boxShadow:`0 0 8px ${color}`, borderRadius:4, transition:"width 0.4s ease-out, background 0.4s" }} />
      </div>
    </div>
  );
}

// ============================================================
// COLOR TIMER
// ============================================================
function ColorTimer({ danger }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
      <div style={{ display:"flex", gap:6 }}>
        {[0, 0.3, 0.6].map((delay, i) => (
          <div key={i} style={{
            width:12, height:12, borderRadius:"50%",
            animation: danger
              ? `timerDanger 0.5s ease-in-out ${delay}s infinite`
              : `timerBlink 1.2s ease-in-out ${delay}s infinite`,
          }} />
        ))}
      </div>
      <div style={{ color: C.muted, fontFamily:"monospace", fontSize:"0.5rem", letterSpacing:"0.1em" }}>カラータイマー</div>
    </div>
  );
}

// ============================================================
// PILL BUTTON
// ============================================================
function PillBtn({ children, onClick, variant="primary", style={}, disabled=false }) {
  const base = {
    borderRadius: 999,
    border: "none",
    cursor: disabled ? "default" : "pointer",
    fontFamily: "'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
    fontWeight: 900,
    letterSpacing: "0.12em",
    transition: "all 0.15s",
    userSelect: "none",
    WebkitUserSelect: "none",
    touchAction: "manipulation",
    opacity: disabled ? 0.45 : 1,
  };
  const variants = {
    primary: {
      background: "linear-gradient(180deg, #f87171 0%, #dc2626 50%, #b91c1c 100%)",
      boxShadow: `0 4px 20px rgba(239,68,68,0.5), inset 0 1px 0 rgba(255,255,255,0.2), 0 0 0 2px rgba(185,28,28,0.8)`,
      color: "#fff",
      fontSize: "clamp(1.3rem, 5vw, 1.7rem)",
      padding: "14px 48px",
    },
    secondary: {
      background: "linear-gradient(180deg, rgba(30,20,20,0.9) 0%, rgba(15,10,10,0.95) 100%)",
      boxShadow: `0 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(100,80,80,0.5)`,
      color: C.muted,
      fontSize: "clamp(0.85rem, 3vw, 1rem)",
      padding: "10px 32px",
    },
    teal: {
      background: "linear-gradient(180deg, #38bdf8 0%, #0ea5e9 100%)",
      boxShadow: `0 3px 15px rgba(14,165,233,0.4)`,
      color: "#fff",
      fontSize: "clamp(1rem, 3.5vw, 1.2rem)",
      padding: "12px 40px",
    },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

// ============================================================
// OVERLAY: FLASH + SHUWATCH
// ============================================================
function WhiteFlash({ show }) {
  if (!show) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"white", zIndex:200, pointerEvents:"none",
      animation:"whiteFlashAnim 0.4s ease-out forwards" }} />
  );
}
function ShuwatchText({ show }) {
  if (!show) return null;
  return (
    <div style={{ position:"fixed", inset:0, display:"flex", alignItems:"center", justifyContent:"center", zIndex:210, pointerEvents:"none" }}>
      <div style={{
        fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
        fontSize:"clamp(2.5rem,12vw,5rem)",
        fontWeight:900,
        color:"#fbbf24",
        textShadow:"0 0 20px #f97316, 0 0 45px #ef4444, 4px 4px 0 #000",
        animation:"shuwatchAppear 0.55s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
        letterSpacing:"0.08em",
        whiteSpace:"nowrap",
      }}>
        シュワッチ！
      </div>
    </div>
  );
}

// ============================================================
// GLOBAL CSS
// ============================================================
const GLOBAL_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; }

  @keyframes twinkle {
    0%,100% { opacity:0.15; transform:scale(0.7); }
    50%      { opacity:0.8;  transform:scale(1.5); }
  }
  @keyframes timerBlink {
    0%,100% { background:#0055ff; box-shadow:0 0 8px 2px #0055ff; }
    50%     { background:#ef4444; box-shadow:0 0 12px 4px #ef4444; }
  }
  @keyframes timerDanger {
    0%,100% { background:#ff1111; box-shadow:0 0 14px 5px #ff0000; }
    50%     { background:#ff8800; box-shadow:0 0 8px 2px #ff8800; }
  }
  @keyframes whiteFlashAnim {
    0%   { opacity:0; }
    20%  { opacity:1; }
    100% { opacity:0; }
  }
  @keyframes shuwatchAppear {
    0%   { transform:scale(0.3) rotate(-12deg); opacity:0; }
    50%  { transform:scale(1.25) rotate(4deg);  opacity:1; }
    80%  { transform:scale(0.95) rotate(-1deg); opacity:1; }
    100% { transform:scale(1) rotate(0deg);     opacity:1; }
  }
  @keyframes redGlow {
    0%,100% { text-shadow:0 0 10px #ef4444, 0 0 20px #dc2626; }
    50%     { text-shadow:0 0 20px #ef4444, 0 0 40px #dc2626, 0 0 60px #b91c1c; }
  }
  @keyframes heroFloat {
    0%,100% { transform:translateY(0px); }
    50%     { transform:translateY(-8px); }
  }
  @keyframes heroFlyOut {
    0%   { transform:translateY(0);      opacity:1; }
    20%  { transform:translateY(-15px);  opacity:1; }
    100% { transform:translateY(-150vh); opacity:0; }
  }
  @keyframes monsterHit {
    0%   { filter:drop-shadow(0 0 12px #ff6600); }
    35%  { filter:drop-shadow(0 0 30px #ff0000) brightness(2.5); transform:scale(1.15) rotate(5deg); }
    100% { filter:drop-shadow(0 0 12px #ff6600); transform:scale(1) rotate(0deg); }
  }
  @keyframes monsterDead {
    0%   { opacity:1; transform:scale(1); }
    30%  { transform:scale(1.2) rotate(-10deg); filter:brightness(2); }
    100% { opacity:0; transform:scale(0) rotate(30deg); }
  }
  @keyframes beamShoot {
    0%   { transform:scaleX(0); opacity:0; }
    20%  { transform:scaleX(1); opacity:1; }
    80%  { transform:scaleX(1); opacity:1; }
    100% { transform:scaleX(0); opacity:0; }
  }
  @keyframes pointPulse {
    0%,100% { transform:scale(1);    box-shadow:0 0 0 0 rgba(251,191,36,0.6); }
    50%     { transform:scale(1.18); box-shadow:0 0 0 8px rgba(251,191,36,0); }
  }
  @keyframes statusBadgePulse {
    0%,100% { box-shadow:0 0 8px rgba(251,191,36,0.4); }
    50%     { box-shadow:0 0 18px rgba(251,191,36,0.8); }
  }
  @keyframes screenShake {
    0%,100% { transform:translateX(0); }
    20%     { transform:translateX(-6px); }
    40%     { transform:translateX(6px); }
    60%     { transform:translateX(-4px); }
    80%     { transform:translateX(4px); }
  }
  @keyframes correctFlash {
    0%   { background:rgba(34,197,94,0.3); }
    100% { background:transparent; }
  }
  @keyframes wrongShake {
    0%,100% { transform:translateX(0); }
    25%     { transform:translateX(-8px); }
    75%     { transform:translateX(8px); }
  }
  @keyframes scanline {
    0%   { transform:translateY(0); }
    100% { transform:translateY(4px); }
  }
`;
