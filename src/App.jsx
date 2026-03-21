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
// HERO SVG  (ウルトラマン風シルエット: シルバー×赤)
// ============================================================
function HeroSVG({ size = 120, style = {} }) {
  return (
    <svg width={size} height={Math.round(size * 1.72)} viewBox="0 0 60 103" fill="none"
      xmlns="http://www.w3.org/2000/svg" style={{ display:"block", ...style }}>
      {/* ─ crest ─ */}
      <polygon points="30,0 25,11 35,11" fill="#c8d4e4"/>
      <rect x="28" y="8" width="4" height="5" rx="1" fill="#4a90d0"/>
      {/* ─ head ─ */}
      <ellipse cx="30" cy="20" rx="11" ry="13" fill="#bcc8d8"/>
      {/* face mask */}
      <ellipse cx="30" cy="21" rx="9" ry="9" fill="#1c2430"/>
      {/* eyes */}
      <polygon points="21,18 27,14 29,20 23,21" fill="#f59e0b"/>
      <polygon points="39,18 33,14 31,20 37,21" fill="#f59e0b"/>
      {/* head side marks */}
      <rect x="19" y="18" width="2" height="6" rx="1" fill="#4a90d0"/>
      <rect x="39" y="18" width="2" height="6" rx="1" fill="#4a90d0"/>
      {/* ─ neck ─ */}
      <rect x="27" y="32" width="6" height="5" fill="#8898ac"/>
      {/* ─ shoulders ─ */}
      <ellipse cx="14" cy="41" rx="9" ry="6" fill="#708090"/>
      <ellipse cx="46" cy="41" rx="9" ry="6" fill="#708090"/>
      {/* ─ torso ─ */}
      <path d="M16,36 L44,36 L42,68 L18,68 Z" fill="#bcc8d8"/>
      {/* red stripe pattern */}
      <path d="M30,38 C23,43 17,52 20,59 C25,53 30,51 30,51 C30,51 35,53 40,59 C43,52 37,43 30,38 Z" fill="#b91c1c"/>
      <path d="M30,51 C24,56 18,64 20,70 L30,65 L40,70 C42,64 36,56 30,51 Z" fill="#991515"/>
      {/* color timer */}
      <ellipse cx="30" cy="43" rx="4" ry="2.5" fill="#ef4444">
        <animate attributeName="fill" values="#ef4444;#3b82f6;#ef4444" dur="1.5s" repeatCount="indefinite"/>
      </ellipse>
      {/* ─ arms ─ */}
      <rect x="5"  y="35" width="10" height="22" rx="3" fill="#bcc8d8" transform="rotate(-8 10 46)"/>
      <rect x="4"  y="56" width="9"  height="17" rx="3" fill="#9caabb" transform="rotate(-14 8 64)"/>
      <ellipse cx="7"  cy="74" rx="5" ry="4" fill="#9caabb" transform="rotate(-14 7 74)"/>
      <rect x="45" y="35" width="10" height="22" rx="3" fill="#bcc8d8" transform="rotate(8 50 46)"/>
      <rect x="47" y="56" width="9"  height="17" rx="3" fill="#9caabb" transform="rotate(14 52 64)"/>
      <ellipse cx="53" cy="74" rx="5" ry="4" fill="#9caabb" transform="rotate(14 53 74)"/>
      {/* ─ waist ─ */}
      <rect x="18" y="68" width="24" height="6" rx="2" fill="#506070"/>
      {/* ─ legs ─ */}
      <rect x="18" y="74" width="11" height="17" rx="3" fill="#bcc8d8"/>
      <rect x="31" y="74" width="11" height="17" rx="3" fill="#bcc8d8"/>
      {/* red knee bands */}
      <rect x="18" y="81" width="11" height="4" rx="1" fill="#b91c1c"/>
      <rect x="31" y="81" width="11" height="4" rx="1" fill="#b91c1c"/>
      {/* shins */}
      <rect x="19" y="91" width="9"  height="12" rx="2" fill="#9caabb"/>
      <rect x="32" y="91" width="9"  height="12" rx="2" fill="#9caabb"/>
      {/* feet */}
      <ellipse cx="23" cy="103" rx="9" ry="3.5" fill="#708090"/>
      <ellipse cx="37" cy="103" rx="9" ry="3.5" fill="#708090"/>
    </svg>
  );
}

// ============================================================
// KAIJU SVG  (怪獣風シルエット: 茶色装甲・角・爪)
// ============================================================
function KaijuSVG({ size = 120, style = {} }) {
  return (
    <svg width={size} height={Math.round(size * 1.45)} viewBox="0 0 80 116" fill="none"
      xmlns="http://www.w3.org/2000/svg" style={{ display:"block", ...style }}>
      {/* ─ tail ─ */}
      <path d="M58,80 Q72,68 76,54 Q79,42 72,37" stroke="#b08840" strokeWidth="8"
        fill="none" strokeLinecap="round"/>
      <polygon points="68,32 76,35 73,44" fill="#907030"/>
      {/* ─ horns ─ */}
      <polygon points="24,2  18,20 30,20" fill="#6b5228"/>
      <polygon points="37,5  33,18 43,18" fill="#6b5228"/>
      <polygon points="14,8  10,22 20,22" fill="#7a6030" transform="rotate(-10 15 15)"/>
      {/* ─ head ─ */}
      <ellipse cx="36" cy="30" rx="21" ry="18" fill="#c8a060"/>
      {/* crack lines on head */}
      <path d="M30,14 L33,30" stroke="#6b4a20" strokeWidth="1.5"/>
      <path d="M40,16 L38,30" stroke="#6b4a20" strokeWidth="1.5"/>
      <path d="M22,24 L36,28" stroke="#6b4a20" strokeWidth="1.2"/>
      {/* eye */}
      <circle cx="26" cy="26" r="6" fill="#0a0808"/>
      <circle cx="27" cy="25" r="2.5" fill="#dc2626"/>
      <circle cx="27.8" cy="24.2" r="1" fill="#ff6060"/>
      {/* teeth */}
      <polygon points="24,40 27,47 30,40" fill="#ddd0a0"/>
      <polygon points="32,41 35,48 38,41" fill="#ddd0a0"/>
      <polygon points="40,40 43,46 46,40" fill="#ddd0a0"/>
      {/* ─ body ─ */}
      <path d="M10,48 L62,48 L58,90 L14,90 Z" fill="#c09858"/>
      {/* body armor cracks */}
      <path d="M36,54 L30,66 L40,63 Z"      stroke="#6b4a20" strokeWidth="2" fill="none"/>
      <path d="M24,60 L36,63"               stroke="#6b4a20" strokeWidth="1.5"/>
      <path d="M48,60 L36,63"               stroke="#6b4a20" strokeWidth="1.5"/>
      <path d="M20,72 L30,76 L26,84"        stroke="#7a5a28" strokeWidth="1.2"/>
      <path d="M50,72 L42,76 L46,84"        stroke="#7a5a28" strokeWidth="1.2"/>
      {/* ─ arms (raised / threatening) ─ */}
      <rect x="-2" y="42" width="14" height="30" rx="5" fill="#b88840" transform="rotate(-22 5 57)"/>
      <rect x="-6" y="68" width="12" height="22" rx="4" fill="#a07830" transform="rotate(-35 0 79)"/>
      {/* claws L */}
      <polygon points="-10,83 -6,76  -1,84" fill="#504020"/>
      <polygon points="-3, 87  1,80   6,88" fill="#504020"/>
      <polygon points="4, 89  8,82  13,90" fill="#504020"/>
      {/* arm R */}
      <rect x="58" y="42" width="14" height="30" rx="5" fill="#b88840" transform="rotate(22 65 57)"/>
      <rect x="64" y="68" width="12" height="22" rx="4" fill="#a07830" transform="rotate(35 70 79)"/>
      {/* claws R */}
      <polygon points="80,83 76,76 71,84" fill="#504020"/>
      <polygon points="73,87 69,80 64,88" fill="#504020"/>
      <polygon points="66,89 62,82 57,90" fill="#504020"/>
      {/* ─ waist ─ */}
      <rect x="16" y="90" width="38" height="7" rx="2" fill="#a07838"/>
      {/* ─ legs ─ */}
      <rect x="15" y="97" width="16" height="19" rx="5" fill="#b88840"/>
      <rect x="39" y="97" width="16" height="19" rx="5" fill="#b88840"/>
      {/* feet */}
      <ellipse cx="23" cy="116" rx="12" ry="4.5" fill="#907030"/>
      <ellipse cx="47" cy="116" rx="12" ry="4.5" fill="#907030"/>
      {/* toe claws */}
      <polygon points="13,115 10,122 16,116" fill="#504020"/>
      <polygon points="21,117 19,124 25,118" fill="#504020"/>
      <polygon points="37,115 34,122 40,116" fill="#504020"/>
      <polygon points="45,117 43,124 49,118" fill="#504020"/>
    </svg>
  );
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
  @keyframes cardGlowPulse {
    0%,100% { box-shadow: 0 0 20px rgba(239,68,68,0.25), 0 0 50px rgba(239,68,68,0.10), inset 0 0 20px rgba(239,68,68,0.04); }
    50%     { box-shadow: 0 0 35px rgba(239,68,68,0.45), 0 0 80px rgba(239,68,68,0.20), inset 0 0 30px rgba(239,68,68,0.08); }
  }
  @keyframes btnPulse {
    0%,100% { box-shadow: 0 4px 20px rgba(239,68,68,0.5), inset 0 1px 0 rgba(255,255,255,0.2), 0 0 0 2px rgba(185,28,28,0.8); }
    50%     { box-shadow: 0 6px 32px rgba(239,68,68,0.75), inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 3px rgba(220,38,38,0.9), 0 0 50px rgba(239,68,68,0.25); }
  }
  @keyframes badgePulse {
    0%,100% { border-color: rgba(251,191,36,0.5); box-shadow: 0 0 8px rgba(251,191,36,0.3); }
    50%     { border-color: rgba(251,191,36,0.9); box-shadow: 0 0 18px rgba(251,191,36,0.6); }
  }
  @keyframes titleGlow {
    0%,100% { text-shadow: 0 0 10px rgba(239,68,68,0.5), 0 0 20px rgba(220,38,38,0.3); }
    50%     { text-shadow: 0 0 18px rgba(239,68,68,0.8), 0 0 35px rgba(220,38,38,0.5), 0 0 60px rgba(185,28,28,0.3); }
  }
`;

// ============================================================
// HOME SCREEN  (画像: 暗赤シネマ / Ultraman style)
// ============================================================
function HomeScreen({ onBattle, onTokkun, onZukan }) {
  return (
    <div style={{
      position:"relative", minHeight:"100dvh", width:"100%",
      background: C.bg,
      display:"flex", flexDirection:"column", alignItems:"center",
      overflow:"hidden",
    }}>
      <CityBokeh />

      {/* ── TOP BAR ─────────────────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:480,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"16px 20px 8px",
      }}>
        {/* left: profile icon */}
        <button style={{
          width:40, height:40, borderRadius:8, cursor:"pointer",
          border:"1.5px dashed rgba(239,68,68,0.4)",
          background:"rgba(239,68,68,0.06)",
          display:"flex", alignItems:"center", justifyContent:"center",
          color:"rgba(239,68,68,0.7)",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </button>

        {/* center: title */}
        <div style={{
          fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
          fontWeight:900,
          fontSize:"clamp(0.9rem, 4vw, 1.15rem)",
          letterSpacing:"0.06em",
          color: C.primary,
          animation:"titleGlow 3s ease-in-out infinite",
        }}>
          ウルトラマンゆずき
        </div>

        {/* right: reload icon */}
        <button style={{
          width:40, height:40, borderRadius:8, cursor:"pointer",
          border:"1.5px dashed rgba(100,116,139,0.3)",
          background:"rgba(255,255,255,0.03)",
          display:"flex", alignItems:"center", justifyContent:"center",
          color: C.muted,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
          </svg>
        </button>
      </div>

      {/* ── HERO CARD ────────────────────────────────────── */}
      <div style={{ position:"relative", zIndex:10, marginTop:8 }}>
        {/* outer dashed ring */}
        <div style={{
          width:"min(58vw, 240px)", height:"min(70vw, 290px)",
          border:"1.5px dashed rgba(239,68,68,0.3)",
          borderRadius:16,
          padding:4,
        }}>
          {/* card body */}
          <div style={{
            width:"100%", height:"100%",
            background:"linear-gradient(160deg, #120808 0%, #0a0404 60%, #130d0d 100%)",
            border:"2px solid rgba(239,68,68,0.55)",
            borderRadius:13,
            animation:"cardGlowPulse 4s ease-in-out infinite",
            display:"flex", alignItems:"center", justifyContent:"center",
            overflow:"hidden",
            position:"relative",
          }}>
            {/* scan-line overlay */}
            <div style={{
              position:"absolute", inset:0,
              background:"repeating-linear-gradient(to bottom, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)",
              pointerEvents:"none",
            }} />
            {/* hero SVG */}
            <div style={{
              filter:"drop-shadow(0 0 18px rgba(239,68,68,0.7))",
              animation:"heroFloat 3s ease-in-out infinite",
            }}>
              <HeroSVG size={Math.min(window.innerWidth * 0.42, 200)}/>
            </div>
            {/* corner accent lines */}
            {[
              { top:0, left:0,  borderTop:"2px solid #ef4444", borderLeft:"2px solid #ef4444",  borderRadius:"12px 0 0 0" },
              { top:0, right:0, borderTop:"2px solid #ef4444", borderRight:"2px solid #ef4444", borderRadius:"0 12px 0 0" },
              { bottom:0, left:0,  borderBottom:"2px solid #ef4444", borderLeft:"2px solid #ef4444",  borderRadius:"0 0 0 12px" },
              { bottom:0, right:0, borderBottom:"2px solid #ef4444", borderRight:"2px solid #ef4444", borderRadius:"0 0 12px 0" },
            ].map((s, i) => (
              <div key={i} style={{ position:"absolute", width:20, height:20, ...s }} />
            ))}
          </div>
        </div>

        {/* STATUS badge (top-right of card) */}
        <div style={{
          position:"absolute", top:-10, right:-14,
          background:"rgba(8,6,4,0.95)",
          border:"1.5px solid rgba(251,191,36,0.6)",
          borderRadius:20,
          padding:"4px 10px",
          backdropFilter:"blur(8px)",
          animation:"badgePulse 2.5s ease-in-out infinite",
        }}>
          <div style={{ color: C.muted, fontFamily:"monospace", fontSize:"0.42rem", letterSpacing:"0.15em" }}>STATUS</div>
          <div style={{ color: C.gold,  fontFamily:"monospace", fontSize:"0.62rem", fontWeight:900, letterSpacing:"0.06em" }}>MAX ENERGY</div>
        </div>
      </div>

      {/* ── NAME + SUBTITLE ──────────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10, marginTop:14,
        textAlign:"center",
      }}>
        {/* glass panel */}
        <div style={{
          background:"rgba(10,4,4,0.65)",
          border:"1px solid rgba(255,255,255,0.06)",
          borderRadius:14,
          padding:"10px 36px 12px",
          backdropFilter:"blur(10px)",
        }}>
          <div style={{
            fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
            fontWeight:900,
            fontSize:"clamp(2.5rem, 12vw, 3.8rem)",
            color:"#fff",
            lineHeight:1.05,
            textShadow:"3px 3px 0 rgba(185,28,28,0.5), 0 0 12px rgba(239,68,68,0.4)",
          }}>
            ゆずき
          </div>
          <div style={{
            color: C.teal,
            fontFamily:"monospace",
            fontSize:"clamp(0.7rem, 2.8vw, 0.9rem)",
            letterSpacing:"0.14em",
            marginTop:4,
          }}>
            ひかりのバトル
          </div>
        </div>
      </div>

      {/* ── BUTTONS ──────────────────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10,
        marginTop:20,
        width:"100%", maxWidth:380,
        padding:"0 24px",
        display:"flex", flexDirection:"column", alignItems:"center", gap:12,
      }}>
        {/* しゅつげき — big red pill with dashed outline ring */}
        <div style={{ position:"relative", width:"100%" }}>
          <div style={{
            position:"absolute", inset:-5,
            border:"1.5px dashed rgba(239,68,68,0.35)",
            borderRadius:999,
            pointerEvents:"none",
          }} />
          <button
            onClick={onBattle}
            style={{
              width:"100%", height:62,
              background:"linear-gradient(180deg, #f87171 0%, #dc2626 50%, #b91c1c 100%)",
              border:"2px solid rgba(255,255,255,0.18)",
              borderRadius:999,
              color:"#fff",
              fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
              fontWeight:900,
              fontSize:"clamp(1.4rem, 5.5vw, 1.8rem)",
              letterSpacing:"0.12em",
              cursor:"pointer",
              animation:"btnPulse 2s ease-in-out infinite",
            }}
          >
            しゅつげき
          </button>
        </div>

        {/* second row: とっくん + ずかん */}
        <div style={{ display:"flex", gap:10, width:"100%" }}>
          <button
            onClick={onTokkun}
            style={{
              flex:1, height:46,
              background:"linear-gradient(180deg, rgba(28,16,16,0.92) 0%, rgba(14,8,8,0.96) 100%)",
              border:"1px solid rgba(120,80,80,0.4)",
              borderRadius:999,
              color: C.muted,
              fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',monospace,sans-serif",
              fontWeight:700,
              fontSize:"clamp(0.8rem, 3vw, 1rem)",
              letterSpacing:"0.1em",
              cursor:"pointer",
            }}
          >
            ⚡ とっくん
          </button>
          <button
            onClick={onZukan}
            style={{
              flex:1, height:46,
              background:"linear-gradient(180deg, rgba(28,16,16,0.92) 0%, rgba(14,8,8,0.96) 100%)",
              border:"1px solid rgba(120,80,80,0.4)",
              borderRadius:999,
              color: C.muted,
              fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',monospace,sans-serif",
              fontWeight:700,
              fontSize:"clamp(0.8rem, 3vw, 1rem)",
              letterSpacing:"0.1em",
              cursor:"pointer",
            }}
          >
            📖 ずかん
          </button>
        </div>
      </div>

      {/* bottom spacing */}
      <div style={{ height: 32 }} />
    </div>
  );
}

// ============================================================
// BATTLE SCREEN
// ============================================================
const HERO_MAX_HP    = 5;
const MONSTER_MAX_HP = 6;
const COVERAGE_THRESHOLD = 0.22; // 22% 以上なぞれたら成功 (緩め)
const MAX_MISS = 3;               // 3 回失敗でモンスターが反撃

// ガイド文字のピクセルをオフスクリーンCanvasに描画して
// なぞりCanvasとのカバレッジを計算する
function evalCoverage(guideKana, tracingCanvas) {
  const dpr  = window.devicePixelRatio || 1;
  const size = tracingCanvas.offsetWidth;

  const guide  = document.createElement("canvas");
  guide.width  = tracingCanvas.width;
  guide.height = tracingCanvas.height;
  const gCtx   = guide.getContext("2d");
  gCtx.scale(dpr, dpr);
  gCtx.fillStyle    = "white";
  gCtx.font         = `900 ${size * 0.77}px 'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif`;
  gCtx.textAlign    = "center";
  gCtx.textBaseline = "middle";
  gCtx.fillText(guideKana, size / 2, size / 2);

  const gPx = gCtx.getImageData(0, 0, guide.width, guide.height).data;
  const dPx = tracingCanvas.getContext("2d")
    .getImageData(0, 0, tracingCanvas.width, tracingCanvas.height).data;

  let total = 0, covered = 0;
  for (let i = 3; i < gPx.length; i += 4) {
    if (gPx[i] > 100) { total++; if (dPx[i] > 60) covered++; }
  }
  return total > 0 ? covered / total : 0;
}

function randKana() {
  return ALL_KANA[Math.floor(Math.random() * ALL_KANA.length)];
}

function BattleScreen({ onHome }) {
  const canvasWrapRef = useRef(null);

  const [heroHp,    setHeroHp]    = useState(HERO_MAX_HP);
  const [monsterHp, setMonsterHp] = useState(MONSTER_MAX_HP);
  const [kana,      setKana]      = useState(randKana);
  const [phase,     setPhase]     = useState("idle"); // idle|checking|correct|miss|monsterAtk|win|lose
  const [score,     setScore]     = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [hasStroke, setHasStroke] = useState(false);
  const [feedback,  setFeedback]  = useState(""); // overlay text

  const heroDanger  = heroHp <= 2;
  const isCorrect   = phase === "correct";
  const isMonsterAtk = phase === "monsterAtk";
  const isWin       = phase === "win";
  const isLose      = phase === "lose";

  const getCanvas = () => canvasWrapRef.current?.querySelector("canvas");

  const goNextKana = useCallback((currentPhase, currentScore, curMHp, curHHp) => {
    setFeedback("");
    setHasStroke(false);
    setMissCount(0);
    if (curMHp <= 0) { setPhase("win");  return; }
    if (curHHp <= 0) { setPhase("lose"); return; }
    setPhase("idle");
    setKana(randKana());
  }, []);

  // ── こうげき！ボタン ──────────────────────────────
  const handleAttack = useCallback(() => {
    if (phase !== "idle" || !hasStroke) return;
    setPhase("checking");

    const canvas = getCanvas();
    if (!canvas) { setPhase("idle"); return; }

    const cov = evalCoverage(kana.kana, canvas);

    if (cov >= COVERAGE_THRESHOLD) {
      // ヒット
      const nextMHp = monsterHp - 1;
      setMonsterHp(nextMHp);
      setScore(s => s + 10);
      setFeedback("シュワッチ！");
      setPhase("correct");
      setTimeout(() => goNextKana("correct", score + 10, nextMHp, heroHp), 1100);
    } else {
      // ミス
      const newMiss = missCount + 1;
      setMissCount(newMiss);
      if (newMiss >= MAX_MISS) {
        // モンスター反撃
        setFeedback("やられた！");
        setPhase("monsterAtk");
        const nextHHp = heroHp - 1;
        setHeroHp(nextHHp);
        setTimeout(() => goNextKana("monsterAtk", score, monsterHp, nextHHp), 1000);
      } else {
        setFeedback(`もう一度！ (${newMiss}/${MAX_MISS})`);
        setPhase("miss");
        setTimeout(() => {
          setPhase("idle");
          setFeedback("");
          getCanvas()?._clear?.();
          setHasStroke(false);
        }, 900);
      }
    }
  }, [phase, hasStroke, kana, monsterHp, heroHp, missCount, score, goNextKana]);

  // ── ギブアップ ──────────────────────────────────
  const handleGiveUp = () => {
    if (phase !== "idle") return;
    const nextHHp = heroHp - 1;
    setHeroHp(nextHHp);
    goNextKana("giveup", score, monsterHp, nextHHp);
  };

  // ── 消す ────────────────────────────────────────
  const handleClear = () => {
    if (phase !== "idle") return;
    getCanvas()?._clear?.();
    setHasStroke(false);
  };

  const restart = () => {
    setHeroHp(HERO_MAX_HP); setMonsterHp(MONSTER_MAX_HP);
    setScore(0); setPhase("idle");
    setMissCount(0); setHasStroke(false); setFeedback("");
    setKana(randKana());
  };

  return (
    <div style={{
      position:"relative", minHeight:"100dvh", width:"100%",
      background: C.bg,
      display:"flex", flexDirection:"column", alignItems:"center",
      overflow:"hidden",
    }}>
      <CityBokeh />

      {/* ── HEADER ─────────────────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:520,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"12px 20px 4px",
      }}>
        <button onClick={onHome} style={{
          background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)",
          borderRadius:8, color:C.primary, cursor:"pointer",
          padding:"6px 14px", fontFamily:"monospace", fontSize:"0.75rem", letterSpacing:"0.08em",
        }}>← もどる</button>
        <div style={{ fontFamily:"monospace", fontSize:"0.75rem", color: C.muted }}>
          スコア: <span style={{ color: C.gold, fontWeight:900 }}>{score}</span>
        </div>
        <ColorTimer danger={heroDanger} />
      </div>

      {/* ── HP BARS ────────────────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:520,
        padding:"0 20px", display:"flex", gap:12,
      }}>
        <div style={{ flex:1 }}>
          <HPBar hp={heroHp}    maxHp={HERO_MAX_HP}    label="⚡ ゆずき" />
        </div>
        <div style={{ flex:1 }}>
          <HPBar hp={monsterHp} maxHp={MONSTER_MAX_HP} label="🦖 かいじゅう" />
        </div>
      </div>

      {/* ── ARENA ──────────────────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:520,
        padding:"6px 20px 0",
      }}>
        <div style={{
          position:"relative", height:"min(36vw, 170px)",
          background:"linear-gradient(180deg, rgba(20,8,8,0.75) 0%, rgba(8,4,4,0.92) 100%)",
          border:"1px solid rgba(239,68,68,0.18)",
          borderRadius:12,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 clamp(12px,5vw,36px)",
          overflow:"hidden",
          animation: isMonsterAtk ? "screenShake 0.45s ease-out" : "none",
        }}>
          {/* scanlines */}
          <div style={{
            position:"absolute", inset:0, pointerEvents:"none",
            background:"repeating-linear-gradient(to bottom, transparent, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)",
          }} />

          {/* 正解フラッシュ */}
          {isCorrect && (
            <div style={{
              position:"absolute", inset:0, borderRadius:12, zIndex:5, pointerEvents:"none",
              background:"rgba(34,197,94,0.12)",
              animation:"correctFlash 1s ease-out forwards",
            }} />
          )}

          {/* feedback テキスト */}
          {feedback && (
            <div style={{
              position:"absolute", inset:0, zIndex:6, pointerEvents:"none",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <div style={{
                fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
                fontWeight:900,
                fontSize:"clamp(1.2rem,5vw,1.8rem)",
                color: isCorrect ? C.gold : "#f87171",
                textShadow: isCorrect
                  ? "0 0 16px rgba(251,191,36,0.9)"
                  : "0 0 16px rgba(239,68,68,0.9)",
                letterSpacing:"0.06em",
                animation:"shuwatchAppear 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
              }}>{feedback}</div>
            </div>
          )}

          {/* ヒーロー */}
          <div style={{
            filter: isLose
              ? "grayscale(1) opacity(0.3)"
              : heroDanger
              ? "drop-shadow(0 0 14px rgba(255,80,80,0.9))"
              : "drop-shadow(0 0 12px rgba(120,200,255,0.7))",
            animation: isLose ? "none"
              : isMonsterAtk ? "wrongShake 0.45s ease-out"
              : "heroFloat 3s ease-in-out infinite",
          }}>
            <HeroSVG size={Math.min(window.innerWidth * 0.2, 88)}/>
          </div>

          {/* ビーム */}
          {isCorrect && (
            <div style={{
              position:"absolute",
              left:"clamp(55px,16vw,95px)",
              right:"clamp(55px,16vw,95px)",
              top:"50%", transform:"translateY(-50%)",
              height:6, borderRadius:3,
              background:"linear-gradient(90deg, #38bdf8, #a78bfa, #f472b6)",
              boxShadow:"0 0 16px #38bdf8, 0 0 30px #a78bfa",
              animation:"beamShoot 0.8s ease-out forwards",
              transformOrigin:"left center",
              zIndex:4,
            }} />
          )}

          {/* モンスター */}
          <div style={{
            filter: isWin
              ? "grayscale(1) opacity(0)"
              : "drop-shadow(0 0 14px rgba(239,68,68,0.7))",
            animation: isWin ? "monsterDead 0.7s ease-out forwards"
              : isCorrect ? "monsterHit 0.6s ease-out"
              : "heroFloat 2.5s ease-in-out 0.4s infinite",
          }}>
            <KaijuSVG size={Math.min(window.innerWidth * 0.22, 96)}/>
          </div>
        </div>
      </div>

      {/* ── なぞりエリア ────────────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:520,
        padding:"8px 20px 0",
        display:"flex", flexDirection:"column", alignItems:"center", gap:8,
        flex:1,
      }}>
        {/* 読み方ラベル */}
        <div style={{
          display:"flex", alignItems:"center", gap:8,
          background:"rgba(14,165,233,0.1)",
          border:"1px solid rgba(14,165,233,0.3)",
          borderRadius:24, padding:"5px 18px",
        }}>
          <span style={{
            fontFamily:"monospace", fontWeight:900,
            fontSize:"clamp(0.85rem,3vw,1.1rem)",
            color: C.teal, letterSpacing:"0.12em",
            textShadow:`0 0 10px ${C.teal}`,
          }}>{kana.roma}</span>
          <span style={{ color: C.muted, fontFamily:"monospace", fontSize:"0.55rem", letterSpacing:"0.1em" }}>
            この文字をなぞれ！
          </span>
        </div>

        {/* キャンバス */}
        <div ref={canvasWrapRef} style={{ width:"min(68vw, 320px)" }}>
          <TracingCanvas
            guideKana={kana.kana}
            onFirstStroke={() => setHasStroke(true)}
          />
        </div>

        {/* ミス残り表示 */}
        {missCount > 0 && phase === "idle" && (
          <div style={{ display:"flex", gap:6 }}>
            {Array.from({ length: MAX_MISS }).map((_, i) => (
              <div key={i} style={{
                width:10, height:10, borderRadius:"50%",
                background: i < missCount ? "#ef4444" : "rgba(239,68,68,0.2)",
                boxShadow: i < missCount ? "0 0 6px #ef4444" : "none",
              }} />
            ))}
          </div>
        )}

        {/* ボタン */}
        <div style={{ display:"flex", gap:10, width:"100%", maxWidth:380 }}>
          <button onClick={handleClear} disabled={!hasStroke || phase !== "idle"}
            style={{
              flex:1, height:50,
              background:"rgba(22,10,10,0.85)",
              border:"1.5px solid rgba(120,60,60,0.4)", borderRadius:12,
              color: hasStroke && phase === "idle" ? "#f87171" : C.muted,
              fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
              fontWeight:700, fontSize:"0.9rem", letterSpacing:"0.08em",
              cursor: hasStroke && phase === "idle" ? "pointer" : "default",
              opacity: hasStroke && phase === "idle" ? 1 : 0.4,
              transition:"all 0.2s",
            }}>消す</button>

          <button onClick={handleAttack} disabled={!hasStroke || phase !== "idle"}
            style={{
              flex:2, height:50,
              background: hasStroke && phase === "idle"
                ? "linear-gradient(180deg,#f87171,#dc2626)"
                : "rgba(60,20,20,0.6)",
              border:"2px solid rgba(255,255,255,0.12)", borderRadius:12,
              color:"#fff",
              fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
              fontWeight:900, fontSize:"clamp(0.95rem,3.5vw,1.1rem)", letterSpacing:"0.1em",
              cursor: hasStroke && phase === "idle" ? "pointer" : "default",
              opacity: hasStroke && phase === "idle" ? 1 : 0.45,
              boxShadow: hasStroke && phase === "idle" ? "0 3px 14px rgba(239,68,68,0.45)" : "none",
              transition:"all 0.2s",
            }}>こうげき！</button>

          <button onClick={handleGiveUp} disabled={phase !== "idle"}
            style={{
              flex:1, height:50,
              background:"rgba(22,10,10,0.85)",
              border:"1.5px solid rgba(120,60,60,0.4)", borderRadius:12,
              color: C.muted,
              fontFamily:"monospace", fontSize:"0.7rem", letterSpacing:"0.06em",
              cursor: phase === "idle" ? "pointer" : "default",
              opacity: phase === "idle" ? 1 : 0.4,
            }}>スキップ</button>
        </div>
      </div>

      <div style={{ height:16 }} />

      {/* ── WIN / LOSE OVERLAY ─────────────────────────── */}
      {(isWin || isLose) && (
        <div style={{
          position:"fixed", inset:0, zIndex:100,
          background:"rgba(0,0,0,0.82)", backdropFilter:"blur(6px)",
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:20,
        }}>
          <div style={{
            fontSize:"clamp(3rem,14vw,5rem)",
            animation:"shuwatchAppear 0.55s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
          }}>
            {isWin ? "🏆" : "💀"}
          </div>
          <div style={{
            fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif", fontWeight:900,
            fontSize:"clamp(1.5rem,7vw,2.5rem)",
            color: isWin ? C.gold : "#f87171",
            textShadow: isWin ? "0 0 20px rgba(251,191,36,0.8)" : "0 0 20px rgba(239,68,68,0.8)",
            letterSpacing:"0.1em",
          }}>{isWin ? "しょうり！" : "やられた…"}</div>
          <div style={{ color: C.muted, fontFamily:"monospace", fontSize:"0.8rem" }}>
            スコア: <span style={{ color: C.gold, fontWeight:900 }}>{score}</span>
          </div>
          <div style={{ display:"flex", gap:12, marginTop:8 }}>
            <button onClick={restart} style={{
              padding:"12px 32px", borderRadius:999,
              background:"linear-gradient(180deg,#f87171,#dc2626)",
              border:"none", color:"#fff",
              fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
              fontWeight:900, fontSize:"1rem", letterSpacing:"0.1em",
              cursor:"pointer", boxShadow:"0 4px 16px rgba(239,68,68,0.5)",
            }}>もういちど</button>
            <button onClick={onHome} style={{
              padding:"12px 32px", borderRadius:999,
              background:"rgba(30,15,15,0.9)",
              border:"1px solid rgba(120,60,60,0.5)",
              color: C.muted, fontFamily:"monospace", fontSize:"0.9rem", cursor:"pointer",
            }}>ホームへ</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TOKKUN SCREEN  (フラッシュカード練習)
// ============================================================
// ============================================================
// TRACING CANVAS  (スタイラス・ペン入力)
// ============================================================
function TracingCanvas({ guideKana, onFirstStroke }) {
  const canvasRef  = useRef(null);
  const isDrawing  = useRef(false);
  const lastPt     = useRef(null);
  const hasDrawn   = useRef(false);

  // キャラが変わるたびにキャンバスをリセット + DPR 設定
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr  = window.devicePixelRatio || 1;
    const side = canvas.offsetWidth;
    canvas.width  = side * dpr;
    canvas.height = side * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    hasDrawn.current = false;
  }, [guideKana]);

  // 親から「消す」を呼べるよう imperative API を公開
  useEffect(() => {
    canvasRef.current._clear = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      hasDrawn.current = false;
    };
  });

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      // スタイラス pressure: 0→1。マウス/タッチは 0.5 固定
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  const startStroke = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    isDrawing.current = true;
    if (!hasDrawn.current) {
      hasDrawn.current = true;
      onFirstStroke?.();
    }
    const pos = getPos(e);
    lastPt.current = pos;
    // 点打ち (筆おろし)
    const ctx = canvasRef.current.getContext("2d");
    const r   = Math.max(2, pos.pressure * 6);
    ctx.fillStyle   = "#ef4444";
    ctx.shadowBlur  = 12;
    ctx.shadowColor = "rgba(239,68,68,0.7)";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const continueStroke = (e) => {
    if (!isDrawing.current || !lastPt.current) return;
    e.preventDefault();
    const ctx  = canvasRef.current.getContext("2d");
    const pos  = getPos(e);
    const prev = lastPt.current;
    const w    = Math.max(3, pos.pressure * 12 + 2);

    ctx.lineWidth   = w;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.strokeStyle = "#ef4444";
    ctx.shadowBlur  = 10;
    ctx.shadowColor = "rgba(239,68,68,0.55)";
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pos.x,  pos.y);
    ctx.stroke();

    lastPt.current = pos;
  };

  const endStroke = () => {
    isDrawing.current = false;
    lastPt.current    = null;
  };

  return (
    <div style={{ position:"relative", width:"100%", aspectRatio:"1/1" }}>
      {/* ガイド文字 (なぞる目安 — 赤みがかった35%で明確に表示) */}
      <div style={{
        position:"absolute", inset:0, zIndex:1,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:"min(62vw, 340px)",
        fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
        fontWeight:900,
        color:"rgba(255,160,80,0.38)",
        textShadow:"0 0 24px rgba(239,68,68,0.45), 0 0 8px rgba(255,120,60,0.3)",
        lineHeight:1,
        userSelect:"none", pointerEvents:"none",
      }}>{guideKana}</div>

      {/* 補助グリッド線 (縦横中心) */}
      <div style={{
        position:"absolute", inset:0, zIndex:1, pointerEvents:"none",
        backgroundImage:`
          linear-gradient(rgba(239,68,68,0.18) 1px, transparent 1px),
          linear-gradient(90deg, rgba(239,68,68,0.18) 1px, transparent 1px)
        `,
        backgroundSize:"50% 50%",
        backgroundPosition:"50% 50%",
      }} />

      {/* 枠線 + 内側グロー */}
      <div style={{
        position:"absolute", inset:0, zIndex:3,
        border:"2.5px solid rgba(239,68,68,0.70)",
        borderRadius:16,
        boxShadow:"inset 0 0 32px rgba(239,68,68,0.12), 0 0 12px rgba(239,68,68,0.2)",
        pointerEvents:"none",
      }} />

      {/* 描画キャンバス */}
      <canvas
        ref={canvasRef}
        style={{
          display:"block", position:"relative", zIndex:2,
          width:"100%", height:"100%",
          borderRadius:14,
          background:"rgba(38,16,10,0.97)",  // 少し明るい暗色
          touchAction:"none",
          cursor:"crosshair",
        }}
        onPointerDown={startStroke}
        onPointerMove={continueStroke}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
      />
    </div>
  );
}

// ============================================================
// TOKKUN SCREEN  (スタイラスなぞり練習)
// ============================================================
function TokkunScreen({ onHome }) {
  const deck        = useRef([...ALL_KANA].sort(() => Math.random() - 0.5)).current;
  const [idx,       setIdx]       = useState(0);
  const [done,      setDone]      = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [phase,     setPhase]     = useState("idle"); // idle | ok | miss
  const canvasRef   = useRef(null);

  const card     = deck[idx];
  const total    = deck.length;
  const progress = Math.round((idx / total) * 100);

  const getCanvas = () => canvasRef.current?.querySelector("canvas");

  const clearCanvas = () => {
    getCanvas()?._clear?.();
    setHasStroke(false);
  };

  const goNext = () => {
    setPhase("idle");
    setHasStroke(false);
    if (idx + 1 >= total) { setDone(true); return; }
    setIdx(i => i + 1);
  };

  const handleJudge = () => {
    if (!hasStroke || phase !== "idle") return;
    const canvas = getCanvas();
    if (!canvas) return;
    const cov = evalCoverage(card.kana, canvas);
    if (cov >= COVERAGE_THRESHOLD) {
      setPhase("ok");
      setTimeout(goNext, 900);
    } else {
      setPhase("miss");
      setTimeout(() => {
        clearCanvas();
        setPhase("idle");
      }, 900);
    }
  };

  const restart = () => {
    deck.sort(() => Math.random() - 0.5);
    setIdx(0);
    setDone(false);
    setHasStroke(false);
    setPhase("idle");
  };

  return (
    <div style={{
      position:"relative", minHeight:"100dvh", width:"100%",
      background: C.bg,
      display:"flex", flexDirection:"column", alignItems:"center",
      overflow:"hidden",
    }}>
      <CityBokeh />

      {/* ── HEADER ─────────────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:520,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 20px 8px",
      }}>
        <button onClick={onHome} style={{
          background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)",
          borderRadius:8, color:C.primary, cursor:"pointer",
          padding:"6px 14px", fontFamily:"monospace", fontSize:"0.75rem", letterSpacing:"0.08em",
        }}>← もどる</button>
        <div style={{ fontFamily:"monospace", fontSize:"0.8rem", letterSpacing:"0.12em", color: C.teal }}>
          ✏️ とっくん (なぞり)
        </div>
        <div style={{ fontFamily:"monospace", fontSize:"0.7rem", color: C.muted }}>
          {idx + 1} / {total}
        </div>
      </div>

      {/* ── PROGRESS BAR ───────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:520,
        padding:"0 20px 8px",
      }}>
        <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden" }}>
          <div style={{
            height:"100%", width:`${progress}%`,
            background:`linear-gradient(90deg, ${C.teal}, ${C.primary})`,
            borderRadius:2, transition:"width 0.3s ease-out",
          }} />
        </div>
      </div>

      {/* ── MAIN: なぞりエリア ──────────────────────── */}
      {!done && (
        <div style={{
          position:"relative", zIndex:10,
          width:"100%", maxWidth:520,
          padding:"0 20px",
          display:"flex", flexDirection:"column", alignItems:"center", gap:12,
          flex:1,
        }}>
          {/* 読み方ラベル */}
          <div style={{
            display:"flex", alignItems:"center", gap:10,
            background:"rgba(14,165,233,0.1)",
            border:"1px solid rgba(14,165,233,0.3)",
            borderRadius:24, padding:"6px 20px",
          }}>
            <span style={{
              fontFamily:"monospace", fontWeight:900,
              fontSize:"clamp(0.9rem,3.5vw,1.2rem)",
              color: C.teal, letterSpacing:"0.12em",
              textShadow:`0 0 10px ${C.teal}`,
            }}>{card.roma}</span>
            <span style={{ color: C.muted, fontFamily:"monospace", fontSize:"0.6rem", letterSpacing:"0.1em" }}>
              よみかた
            </span>
          </div>

          {/* キャンバス + 判定フィードバックオーバーレイ */}
          <div ref={canvasRef} style={{ width:"min(80vw, 440px)", position:"relative" }}>
            <TracingCanvas
              guideKana={card.kana}
              onFirstStroke={() => setHasStroke(true)}
            />
            {/* 判定結果オーバーレイ */}
            {phase !== "idle" && (
              <div style={{
                position:"absolute", inset:0, zIndex:20, borderRadius:16,
                display:"flex", alignItems:"center", justifyContent:"center",
                background: phase === "ok"
                  ? "rgba(34,197,94,0.18)"
                  : "rgba(239,68,68,0.18)",
                border: `2.5px solid ${phase === "ok" ? "#22c55e" : "#ef4444"}`,
                animation:"correctFlash 0.9s ease-out forwards",
                pointerEvents:"none",
              }}>
                <div style={{
                  fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
                  fontWeight:900,
                  fontSize:"clamp(2rem,10vw,3.5rem)",
                  color: phase === "ok" ? "#86efac" : "#f87171",
                  textShadow: phase === "ok"
                    ? "0 0 20px rgba(34,197,94,0.9)"
                    : "0 0 20px rgba(239,68,68,0.9)",
                  letterSpacing:"0.06em",
                  animation:"shuwatchAppear 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
                }}>
                  {phase === "ok" ? "できた！" : "もう一度！"}
                </div>
              </div>
            )}
          </div>

          {/* ヒント */}
          <div style={{
            fontFamily:"monospace", fontSize:"0.6rem",
            color:"rgba(100,116,139,0.7)", letterSpacing:"0.1em",
            textAlign:"center",
          }}>
            オレンジの文字をスタイラスでなぞろう
          </div>

          {/* 操作ボタン */}
          <div style={{ display:"flex", gap:12, width:"100%", maxWidth:380, marginTop:4 }}>
            <button
              onClick={clearCanvas}
              disabled={!hasStroke || phase !== "idle"}
              style={{
                flex:1, height:52,
                background:"rgba(22,10,10,0.85)",
                border:"1.5px solid rgba(120,60,60,0.4)",
                borderRadius:12,
                color: hasStroke && phase === "idle" ? "#f87171" : C.muted,
                fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',monospace,sans-serif",
                fontWeight:700, fontSize:"0.95rem", letterSpacing:"0.08em",
                cursor: hasStroke && phase === "idle" ? "pointer" : "default",
                opacity: hasStroke && phase === "idle" ? 1 : 0.4,
                transition:"all 0.2s",
              }}
            >消す</button>
            <button
              onClick={handleJudge}
              disabled={!hasStroke || phase !== "idle"}
              style={{
                flex:2, height:52,
                background: hasStroke && phase === "idle"
                  ? "linear-gradient(180deg, #f87171 0%, #dc2626 100%)"
                  : "rgba(60,20,20,0.6)",
                border:"2px solid rgba(255,255,255,0.15)",
                borderRadius:12,
                color:"#fff",
                fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
                fontWeight:900, fontSize:"1rem", letterSpacing:"0.1em",
                cursor: hasStroke && phase === "idle" ? "pointer" : "default",
                opacity: hasStroke && phase === "idle" ? 1 : 0.5,
                boxShadow: hasStroke && phase === "idle" ? "0 3px 14px rgba(239,68,68,0.45)" : "none",
                transition:"all 0.2s",
              }}
            >はんてい！</button>
          </div>
        </div>
      )}

      {/* ── DONE OVERLAY ───────────────────────────── */}
      {done && (
        <div style={{
          position:"fixed", inset:0, zIndex:100,
          background:"rgba(0,0,0,0.85)", backdropFilter:"blur(6px)",
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:18,
        }}>
          <div style={{ fontSize:"4rem" }}>⚡</div>
          <div style={{
            fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
            fontWeight:900, fontSize:"clamp(1.5rem,7vw,2.2rem)",
            color: C.gold, letterSpacing:"0.1em",
            textShadow:"0 0 20px rgba(251,191,36,0.7)",
          }}>とっくん かんりょう！</div>
          <div style={{ color: C.muted, fontFamily:"monospace", fontSize:"0.75rem" }}>
            {total}文字 なぞった！
          </div>
          <div style={{ display:"flex", gap:12, marginTop:8 }}>
            <button onClick={restart} style={{
              padding:"12px 28px", borderRadius:999,
              background:"linear-gradient(180deg,#f87171,#dc2626)",
              border:"none", color:"#fff",
              fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
              fontWeight:900, fontSize:"0.95rem", letterSpacing:"0.1em",
              cursor:"pointer", boxShadow:"0 4px 16px rgba(239,68,68,0.5)",
            }}>もういちど</button>
            <button onClick={onHome} style={{
              padding:"12px 28px", borderRadius:999,
              background:"rgba(30,15,15,0.9)",
              border:"1px solid rgba(120,60,60,0.5)",
              color: C.muted, fontFamily:"monospace",
              fontSize:"0.9rem", cursor:"pointer",
            }}>ホームへ</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ZUKAN SCREEN  (50音ずかん)
// ============================================================
function ZukanScreen({ onHome }) {
  const [selected, setSelected] = useState(null); // { kana, roma } | null

  return (
    <div style={{
      position:"relative", minHeight:"100dvh", width:"100%",
      background: C.bg,
      display:"flex", flexDirection:"column", alignItems:"center",
      overflow:"hidden",
    }}>
      <CityBokeh />

      {/* header */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:520,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 20px 8px",
      }}>
        <button onClick={onHome} style={{
          background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)",
          borderRadius:8, color:C.primary, cursor:"pointer",
          padding:"6px 14px", fontFamily:"monospace", fontSize:"0.75rem", letterSpacing:"0.08em",
        }}>← もどる</button>
        <div style={{ fontFamily:"monospace", fontSize:"0.8rem", letterSpacing:"0.12em", color: C.teal }}>
          📖 ひらがなずかん
        </div>
        <div style={{ width:60 }} />
      </div>

      {/* 50-on grid by row */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:520,
        padding:"0 12px 24px", overflowY:"auto",
        display:"flex", flexDirection:"column", gap:10,
      }}>
        {HIRAGANA_ROWS.map((row) => (
          <div key={row.row}>
            {/* row label */}
            <div style={{
              fontFamily:"monospace", fontSize:"0.55rem", color: C.muted,
              letterSpacing:"0.15em", marginBottom:4, paddingLeft:4,
            }}>{row.row}</div>
            {/* cells */}
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {row.kana.map((kana, i) => {
                const roma = row.roma[i];
                const isSelected = selected?.kana === kana;
                return (
                  <button
                    key={kana}
                    onClick={() => setSelected(isSelected ? null : { kana, roma })}
                    style={{
                      width: "clamp(52px,17vw,72px)",
                      height:"clamp(56px,18vw,76px)",
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(239,68,68,0.3), rgba(185,28,28,0.2))"
                        : "linear-gradient(135deg, rgba(22,10,10,0.88) 0%, rgba(14,6,6,0.94) 100%)",
                      border: isSelected
                        ? `2px solid ${C.primary}`
                        : "1.5px solid rgba(100,50,50,0.45)",
                      borderRadius:10,
                      cursor:"pointer",
                      display:"flex", flexDirection:"column",
                      alignItems:"center", justifyContent:"center", gap:3,
                      boxShadow: isSelected
                        ? "0 0 16px rgba(239,68,68,0.4)"
                        : "none",
                      transition:"all 0.15s",
                    }}
                  >
                    <div style={{
                      fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
                      fontWeight:900,
                      fontSize:"clamp(1.4rem,5vw,2rem)",
                      color: isSelected ? "#fff" : "#cbd5e1",
                      textShadow: isSelected ? "0 0 10px rgba(239,68,68,0.6)" : "none",
                      lineHeight:1,
                    }}>{kana}</div>
                    <div style={{
                      fontFamily:"monospace",
                      fontSize:"clamp(0.5rem,1.8vw,0.65rem)",
                      color: isSelected ? C.teal : C.muted,
                      letterSpacing:"0.04em",
                    }}>{roma}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* selected detail popup */}
      {selected && (
        <div style={{
          position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
          zIndex:50,
          background:"rgba(10,4,4,0.95)", backdropFilter:"blur(12px)",
          border:`2px solid ${C.border}`,
          borderRadius:20, padding:"16px 40px",
          boxShadow:"0 0 32px rgba(239,68,68,0.3)",
          display:"flex", flexDirection:"column", alignItems:"center", gap:6,
          minWidth:160,
        }}>
          <div style={{
            fontSize:"clamp(3rem,12vw,4.5rem)",
            fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
            fontWeight:900, color:"#fff",
            textShadow:"0 0 16px rgba(239,68,68,0.5)",
            lineHeight:1,
          }}>{selected.kana}</div>
          <div style={{
            fontFamily:"monospace", fontSize:"clamp(1rem,3.5vw,1.4rem)",
            fontWeight:900, color: C.teal,
            letterSpacing:"0.1em",
            textShadow:`0 0 10px ${C.teal}`,
          }}>{selected.roma}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SCREEN TRANSITION WRAPPER
// ============================================================
const TRANSITION_CSS = `
  @keyframes screenFadeIn {
    from { opacity: 0; transform: translateY(12px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  @keyframes screenFadeOut {
    from { opacity: 1; transform: translateY(0)     scale(1);    }
    to   { opacity: 0; transform: translateY(-12px) scale(0.98); }
  }
`;

function ScreenTransition({ screenKey, children }) {
  const [visible, setVisible] = useState(true);
  const prevKey = useRef(screenKey);

  useEffect(() => {
    if (prevKey.current !== screenKey) {
      prevKey.current = screenKey;
      setVisible(false);
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    }
  }, [screenKey]);

  return (
    <div
      key={screenKey}
      style={{
        animation: visible
          ? "screenFadeIn 0.35s cubic-bezier(0.22,1,0.36,1) forwards"
          : "screenFadeOut 0.2s ease-in forwards",
      }}
    >
      {children}
    </div>
  );
}

// ============================================================
// APP  — メインの状態機械
// ============================================================
const SCREENS = ["home", "battle", "tokkun", "zukan"];

export default function App() {
  const [screen,  setScreen]  = useState("home");
  const [prevScr, setPrevScr] = useState(null);

  // スクロールをトップにリセット
  const go = useCallback((next) => {
    setPrevScr(screen);
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [screen]);

  // ブラウザ Back ボタン対応
  useEffect(() => {
    const onPop = () => {
      if (screen !== "home") go("home");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [screen, go]);

  // 画面が変わるたびに history エントリを積む
  useEffect(() => {
    if (screen !== "home") {
      window.history.pushState({ screen }, "", `#${screen}`);
    } else {
      window.history.replaceState({ screen: "home" }, "", "#");
    }
  }, [screen]);

  return (
    <>
      <style>{GLOBAL_CSS + TRANSITION_CSS}</style>
      <ScreenTransition screenKey={screen}>
        {screen === "home"   && (
          <HomeScreen
            onBattle={() => go("battle")}
            onTokkun={() => go("tokkun")}
            onZukan ={() => go("zukan")}
          />
        )}
        {screen === "battle" && <BattleScreen onHome={() => go("home")} />}
        {screen === "tokkun" && <TokkunScreen onHome={() => go("home")} />}
        {screen === "zukan"  && <ZukanScreen  onHome={() => go("home")} />}
      </ScreenTransition>
    </>
  );
}
