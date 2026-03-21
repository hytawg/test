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

// ── 音声フィードバック (Web Speech API) ─────────────────────
const PRAISE    = ["すごーい！","やったね！","うまい！","かんぺき！","さいこう！","よくできました！"];
const ENCOURAGE = ["もういちど！","がんばれ！","できるよ！"];
function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function speak(text, { rate = 0.9, pitch = 1.3 } = {}) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang  = "ja-JP";
  u.rate  = rate;
  u.pitch = pitch;
  window.speechSynthesis.speak(u);
}

// ── スタンプ帳 (localStorage) ────────────────────────────────
const STAMP_KEY = "yuzuki_stamps_v1";
function getStamps()     { try { return new Set(JSON.parse(localStorage.getItem(STAMP_KEY) || "[]")); } catch { return new Set(); } }
function saveStamp(kana) { const s = getStamps(); s.add(kana); localStorage.setItem(STAMP_KEY, JSON.stringify([...s])); }

// ── 経験値 / レベルシステム ───────────────────────────────────
const XP_KEY   = "yuzuki_xp_v1";
const LEVEL_XP = [0, 60, 160, 320, 540, 820, 1160, 1560, 2020]; // 各レベルの累計XP閾値
const LEVEL_MAX = LEVEL_XP.length;
function getXP()  { return parseInt(localStorage.getItem(XP_KEY) || "0", 10); }
function addXP(n) { const v = getXP() + n; localStorage.setItem(XP_KEY, String(v)); return v; }
function calcLevel(xp) {
  for (let i = LEVEL_MAX - 1; i >= 0; i--) if (xp >= LEVEL_XP[i]) return i + 1;
  return 1;
}
function xpBasePct(xp) {
  const lv = calcLevel(xp);
  if (lv >= LEVEL_MAX) return 100;
  const base = LEVEL_XP[lv - 1], next = LEVEL_XP[lv];
  return Math.round(((xp - base) / (next - base)) * 100);
}
// レベル別ヒーローカラーパレット
function heroColors(lv) {
  const gold = lv >= 7, blue = lv >= 5;
  return {
    crest:   lv >= 2 ? "#fbbf24" : "#c8d4e4",
    gem:     lv >= 2 ? "#f59e0b" : "#4a90d0",
    body:    gold ? "#fde68a" : blue ? "#b8d4e8" : "#bcc8d8",
    shoulder:lv >= 3 ? "#22d3ee" : "#708090",
    neck:    gold ? "#fcd34d" : blue ? "#a0c0d8" : "#8898ac",
    stripe:  lv >= 6 ? "#fbbf24" : lv >= 4 ? "#ea7c1a" : "#b91c1c",
    stripe2: lv >= 6 ? "#f59e0b" : lv >= 4 ? "#c96010" : "#991515",
    timer:   lv >= 7 ? "#fbbf24" : "#ef4444",
    armor:   gold ? "#fcd34d" : blue ? "#90b8d0" : "#9caabb",
    waist:   lv >= 4 ? "#ca8a04" : "#506070",
    foot:    lv >= 3 ? "#2563eb" : "#708090",
    sideBar: lv >= 3 ? "#22d3ee" : "#4a90d0",
    eye:     "#f59e0b",
  };
}

// ── 敵定義 (各3文字セット) ──────────────────────────────────
function kanaOf(chars) {
  return chars.map(k => ALL_KANA.find(a => a.kana === k)).filter(Boolean);
}

// ── 怪獣SVG: エレキング (電気ウナギ型 / 紫×黄) ──────────────
function SvgEleking({ size = 120 }) {
  const h = Math.round(size * 1.5);
  return (
    <svg width={size} height={h} viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* tail fin */}
      <ellipse cx="40" cy="115" rx="22" ry="6" fill="#5b21b6"/>
      {/* body — elongated */}
      <rect x="26" y="40" width="28" height="70" rx="14" fill="#7c3aed"/>
      {/* stripe bands */}
      {[55,68,81].map(y => <rect key={y} x="26" y={y} width="28" height="5" rx="2" fill="#fbbf24" opacity="0.85"/>)}
      {/* neck */}
      <rect x="32" y="20" width="16" height="24" rx="8" fill="#6d28d9"/>
      {/* head */}
      <ellipse cx="40" cy="17" rx="15" ry="13" fill="#7c3aed"/>
      {/* eyes */}
      <ellipse cx="33" cy="15" rx="5" ry="4" fill="#fbbf24"/>
      <ellipse cx="47" cy="15" rx="5" ry="4" fill="#fbbf24"/>
      <circle cx="33" cy="15" r="2" fill="#1e1b4b"/>
      <circle cx="47" cy="15" r="2" fill="#1e1b4b"/>
      {/* antennae */}
      <line x1="36" y1="5"  x2="30" y2="-2" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="44" y1="5"  x2="50" y2="-2" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="30" cy="-2" r="3" fill="#fbbf24"/>
      <circle cx="50" cy="-2" r="3" fill="#fbbf24"/>
      {/* arms / fins */}
      <path d="M26,60 Q10,55 8,68 Q12,72 26,70Z" fill="#6d28d9"/>
      <path d="M54,60 Q70,55 72,68 Q68,72 54,70Z" fill="#6d28d9"/>
      {/* lightning bolt */}
      <polygon points="42,44 36,58 41,56 35,72 46,54 41,57Z" fill="#fbbf24"/>
    </svg>
  );
}

// ── 怪獣SVG: バルタン星人 (ハサミ手の宇宙人 / 紺×銀) ────────
function SvgBaltan({ size = 120 }) {
  const h = Math.round(size * 1.4);
  return (
    <svg width={size} height={h} viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* body */}
      <path d="M30,50 L70,50 L66,100 L34,100Z" fill="#1e3a5f"/>
      {/* stripes */}
      {[62,75,88].map(y => <rect key={y} x="34" y={y} width="32" height="4" rx="2" fill="#475569" opacity="0.7"/>)}
      {/* neck */}
      <rect x="40" y="36" width="20" height="18" rx="8" fill="#1e3a5f"/>
      {/* head — bug-like */}
      <ellipse cx="50" cy="26" rx="22" ry="20" fill="#1e3a5f"/>
      {/* compound eyes */}
      <ellipse cx="34" cy="22" rx="10" ry="9" fill="#0ea5e9"/>
      <ellipse cx="66" cy="22" rx="10" ry="9" fill="#0ea5e9"/>
      {[{cx:31,cy:20},{cx:37,cy:20},{cx:34,cy:25}].map((p,i)=><circle key={i} cx={p.cx} cy={p.cy} r="2.5" fill="#0c4a6e"/>)}
      {[{cx:63,cy:20},{cx:69,cy:20},{cx:66,cy:25}].map((p,i)=><circle key={i} cx={p.cx} cy={p.cy} r="2.5" fill="#0c4a6e"/>)}
      {/* crest */}
      <polygon points="50,6 44,16 56,16" fill="#334155"/>
      {/* BIG CLAW HANDS */}
      {/* left arm */}
      <rect x="10" y="48" width="22" height="12" rx="6" fill="#1e3a5f"/>
      {/* left claw — U shape */}
      <path d="M4,58 Q-4,65 2,78 Q6,84 12,78 L12,66 Q8,60 12,58Z" fill="#334155"/>
      <path d="M20,58 Q28,65 22,78 Q18,84 12,78 L12,66 Q16,60 12,58Z" fill="#334155"/>
      <line x1="12" y1="60" x2="12" y2="76" stroke="#0ea5e9" strokeWidth="1.5"/>
      {/* right arm */}
      <rect x="68" y="48" width="22" height="12" rx="6" fill="#1e3a5f"/>
      {/* right claw */}
      <path d="M80,58 Q72,65 78,78 Q82,84 88,78 L88,66 Q84,60 88,58Z" fill="#334155"/>
      <path d="M96,58 Q104,65 98,78 Q94,84 88,78 L88,66 Q92,60 88,58Z" fill="#334155"/>
      <line x1="88" y1="60" x2="88" y2="76" stroke="#0ea5e9" strokeWidth="1.5"/>
      {/* legs */}
      <rect x="33" y="100" width="14" height="22" rx="5" fill="#1e3a5f"/>
      <rect x="53" y="100" width="14" height="22" rx="5" fill="#1e3a5f"/>
      <ellipse cx="40" cy="123" rx="10" ry="4" fill="#0f172a"/>
      <ellipse cx="60" cy="123" rx="10" ry="4" fill="#0f172a"/>
    </svg>
  );
}

// ── 怪獣SVG: レッドキング (岩石ゴリラ型 / 赤橙) ────────────
function SvgRedKing({ size = 120 }) {
  const h = Math.round(size * 1.1);
  return (
    <svg width={size} height={h} viewBox="0 0 110 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* enormous body — wide & squat */}
      <ellipse cx="55" cy="72" rx="42" ry="36" fill="#c2410c"/>
      {/* rock bumps */}
      {[{cx:20,cy:58},{cx:88,cy:58},{cx:35,cy:46},{cx:75,cy:46},{cx:55,cy:44}].map((p,i)=>
        <circle key={i} cx={p.cx} cy={p.cy} r="8" fill="#9a3412" opacity="0.7"/>)}
      {/* tiny head directly on body */}
      <ellipse cx="55" cy="38" rx="20" ry="18" fill="#c2410c"/>
      <ellipse cx="44" cy="34" rx="6" ry="5" fill="#7c2d12"/>
      <ellipse cx="66" cy="34" rx="6" ry="5" fill="#7c2d12"/>
      <circle cx="44" cy="34" r="2.5" fill="#fef2f2"/>
      <circle cx="66" cy="34" r="2.5" fill="#fef2f2"/>
      {/* brow ridge */}
      <path d="M36,30 Q55,24 74,30" stroke="#7c2d12" strokeWidth="4" fill="none" strokeLinecap="round"/>
      {/* nose */}
      <ellipse cx="55" cy="42" rx="5" ry="3" fill="#9a3412"/>
      {/* mouth */}
      <path d="M44,48 Q55,54 66,48" stroke="#7c2d12" strokeWidth="3" fill="none" strokeLinecap="round"/>
      {/* HUGE arms */}
      <ellipse cx="10" cy="72" rx="14" ry="26" fill="#b45309" transform="rotate(-15 10 72)"/>
      <ellipse cx="100" cy="72" rx="14" ry="26" fill="#b45309" transform="rotate(15 100 72)"/>
      {/* knuckles L */}
      {[-8,0,8].map((dy,i)=><circle key={i} cx="4" cy={88+dy} r="4" fill="#92400e"/>)}
      {[-8,0,8].map((dy,i)=><circle key={i} cx="106" cy={88+dy} r="4" fill="#92400e"/>)}
      {/* legs — short */}
      <rect x="35" y="100" width="16" height="12" rx="5" fill="#9a3412"/>
      <rect x="59" y="100" width="16" height="12" rx="5" fill="#9a3412"/>
    </svg>
  );
}

// ── 怪獣SVG: ゴモラ (恐竜型 / 褐色) ─────────────────────────
function SvgGomora({ size = 120 }) {
  const h = Math.round(size * 1.3);
  return (
    <svg width={size} height={h} viewBox="0 0 110 130" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* tail — sweeping right */}
      <path d="M70,90 Q95,80 105,62 Q112,48 104,40" stroke="#78350f" strokeWidth="12" fill="none" strokeLinecap="round"/>
      <polygon points="100,34 108,38 105,48" fill="#713f12"/>
      {/* body */}
      <ellipse cx="50" cy="82" rx="36" ry="30" fill="#92400e"/>
      {/* back spines */}
      {[{x:32,y:56},{x:44,y:50},{x:56,y:48},{x:68,y:52}].map((p,i)=>
        <polygon key={i} points={`${p.x},${p.y} ${p.x-5},${p.y+14} ${p.x+5},${p.y+14}`} fill="#78350f"/>)}
      {/* neck */}
      <rect x="32" y="50" width="22" height="28" rx="10" fill="#92400e"/>
      {/* head */}
      <ellipse cx="36" cy="40" rx="24" ry="17" fill="#a16207"/>
      {/* nose horn */}
      <polygon points="16,38 8,28 20,33" fill="#78350f"/>
      {/* eye */}
      <circle cx="26" cy="34" r="7" fill="#0a0808"/>
      <circle cx="27" cy="33" r="3" fill="#dc2626"/>
      <circle cx="28" cy="32" r="1.2" fill="#fca5a5"/>
      {/* mouth */}
      <path d="M16,46 Q36,54 56,46" stroke="#78350f" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      {/* teeth */}
      {[20,28,36,44].map(x=><polygon key={x} points={`${x},47 ${x+3},53 ${x+6},47`} fill="#fef9c3"/>)}
      {/* arms */}
      <path d="M20,72 Q8,70 6,84 Q8,92 18,90 L22,80Z" fill="#a16207"/>
      <path d="M72,72 Q84,70 86,84 Q84,92 74,90 L70,80Z" fill="#a16207"/>
      {/* legs */}
      <rect x="28" y="106" width="18" height="24" rx="6" fill="#92400e"/>
      <rect x="56" y="106" width="18" height="24" rx="6" fill="#92400e"/>
      {/* claws */}
      {[26,34,42].map(x=><polygon key={x} points={`${x},130 ${x+2},138 ${x+5},130`} fill="#78350f"/>)}
      {[54,62,70].map(x=><polygon key={x} points={`${x},130 ${x+2},138 ${x+5},130`} fill="#78350f"/>)}
    </svg>
  );
}

// ── 怪獣SVG: ダダ (幾何学宇宙人 / 白黒) ─────────────────────
function SvgDada({ size = 120 }) {
  const h = Math.round(size * 1.6);
  return (
    <svg width={size} height={h} viewBox="0 0 70 112" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* body — slim rectangular */}
      <rect x="18" y="44" width="34" height="50" rx="4" fill="#e2e8f0"/>
      {/* body pattern */}
      <rect x="18" y="44" width="17" height="50" rx="0" fill="#1e293b"/>
      <rect x="35" y="44" width="17" height="25" rx="0" fill="#94a3b8"/>
      <rect x="35" y="69" width="17" height="25" rx="0" fill="#475569"/>
      {/* border lines */}
      <rect x="18" y="44" width="34" height="50" rx="4" stroke="#64748b" strokeWidth="1.5" fill="none"/>
      {/* neck */}
      <rect x="28" y="34" width="14" height="14" rx="2" fill="#94a3b8"/>
      {/* head — 3-section rectangle */}
      <rect x="14" y="8" width="42" height="30" rx="3" fill="#f8fafc"/>
      {/* left third — dark */}
      <rect x="14" y="8" width="14" height="30" rx="3" fill="#1e293b"/>
      {/* middle third — gray */}
      <rect x="28" y="8" width="14" height="30" fill="#64748b"/>
      {/* right third — light */}
      <rect x="42" y="8" width="14" height="30" rx="3" fill="#cbd5e1"/>
      {/* eyes — each third has one */}
      <ellipse cx="21" cy="20" rx="4" ry="5" fill="#38bdf8"/>
      <ellipse cx="35" cy="20" rx="4" ry="5" fill="#f59e0b"/>
      <ellipse cx="49" cy="20" rx="4" ry="5" fill="#ef4444"/>
      <circle cx="21" cy="20" r="2" fill="#0c0a09"/>
      <circle cx="35" cy="20" r="2" fill="#0c0a09"/>
      <circle cx="49" cy="20" r="2" fill="#0c0a09"/>
      {/* mouth line */}
      <line x1="14" y1="32" x2="56" y2="32" stroke="#334155" strokeWidth="1.5"/>
      {/* arms — thin rectangular */}
      <rect x="2"  y="46" width="16" height="8" rx="3" fill="#e2e8f0"/>
      <rect x="52" y="46" width="16" height="8" rx="3" fill="#1e293b"/>
      {/* hands */}
      <rect x="0"  y="52" width="10" height="18" rx="3" fill="#cbd5e1"/>
      <rect x="60" y="52" width="10" height="18" rx="3" fill="#334155"/>
      {/* legs */}
      <rect x="20" y="94" width="12" height="18" rx="3" fill="#1e293b"/>
      <rect x="38" y="94" width="12" height="18" rx="3" fill="#e2e8f0"/>
      {/* feet */}
      <rect x="17" y="109" width="18" height="6" rx="2" fill="#0f172a"/>
      <rect x="35" y="109" width="18" height="6" rx="2" fill="#f8fafc"/>
    </svg>
  );
}

// ── 怪獣SVG: ベムスター (腹口の星型 / オレンジ) ─────────────
function SvgBemstar({ size = 120 }) {
  const h = Math.round(size * 1.15);
  return (
    <svg width={size} height={h} viewBox="0 0 110 126" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* main body — pentagon */}
      <polygon points="55,10 98,38 82,88 28,88 12,38" fill="#d97706"/>
      {/* body shading */}
      <polygon points="55,10 98,38 82,88 28,88 12,38" fill="none" stroke="#92400e" strokeWidth="3"/>
      {/* texture bumps */}
      {[{cx:35,cy:45},{cx:75,cy:45},{cx:55,cy:32},{cx:40,cy:68},{cx:70,cy:68}].map((p,i)=>
        <circle key={i} cx={p.cx} cy={p.cy} r="7" fill="#b45309" opacity="0.5"/>)}
      {/* BELLY MOUTH — center */}
      <ellipse cx="55" cy="58" rx="22" ry="16" fill="#7c2d12"/>
      <ellipse cx="55" cy="58" rx="18" ry="12" fill="#0a0808"/>
      {/* teeth around mouth */}
      {[0,1,2,3,4,5].map(i => {
        const a = (i/6)*Math.PI*2 - Math.PI/2;
        const r=15, tx=55+r*Math.cos(a), ty=58+r*Math.sin(a);
        const ix=55+10*Math.cos(a), iy=58+10*Math.sin(a);
        return <polygon key={i} points={`${tx},${ty} ${tx+4*Math.cos(a+1.2)},${ty+4*Math.sin(a+1.2)} ${ix},${iy} ${tx+4*Math.cos(a-1.2)},${ty+4*Math.sin(a-1.2)}`} fill="#fef9c3"/>;
      })}
      {/* eyes — top of body */}
      <circle cx="42" cy="30" r="8" fill="#fbbf24"/>
      <circle cx="68" cy="30" r="8" fill="#fbbf24"/>
      <circle cx="42" cy="30" r="4" fill="#0a0808"/>
      <circle cx="68" cy="30" r="4" fill="#0a0808"/>
      {/* wings/arms */}
      <path d="M12,38 Q-4,32 -2,50 Q4,60 18,58" fill="#f59e0b" stroke="#d97706" strokeWidth="1.5"/>
      <path d="M98,38 Q114,32 112,50 Q106,60 92,58" fill="#f59e0b" stroke="#d97706" strokeWidth="1.5"/>
      {/* short legs */}
      <rect x="36" y="88" width="14" height="20" rx="5" fill="#b45309"/>
      <rect x="60" y="88" width="14" height="20" rx="5" fill="#b45309"/>
      <ellipse cx="43" cy="109" rx="10" ry="4" fill="#92400e"/>
      <ellipse cx="67" cy="109" rx="10" ry="4" fill="#92400e"/>
    </svg>
  );
}

// ── 敵定義 (各3文字セット + 固有SVG) ───────────────────────
const ENEMY_DEFS = [
  { id:0, name:"エレキング",   kana:["ゆ","ず","き"], color:"#8b5cf6", desc:"でんきのかいじゅう", Svg: SvgEleking  },
  { id:1, name:"バルタン星人", kana:["あ","い","う"], color:"#0ea5e9", desc:"うちゅうのかいじゅう", Svg: SvgBaltan   },
  { id:2, name:"レッドキング", kana:["か","き","く"], color:"#f97316", desc:"ちからじまんのかいじゅう", Svg: SvgRedKing  },
  { id:3, name:"ゴモラ",       kana:["さ","し","す"], color:"#a16207", desc:"しっぽがつよいかいじゅう", Svg: SvgGomora   },
  { id:4, name:"ダダ",         kana:["た","ち","つ"], color:"#64748b", desc:"みつのかおのかいじゅう", Svg: SvgDada     },
  { id:5, name:"ベムスター",   kana:["な","に","ぬ"], color:"#f59e0b", desc:"おなかでたべるかいじゅう", Svg: SvgBemstar  },
];

// ============================================================
// HERO SVG  (ウルトラマンゆずき / レベル対応)
// ============================================================
function HeroSVG({ size = 120, level = 1, style = {} }) {
  const hc = heroColors(level);
  const timerVals = level >= 7
    ? `${hc.timer};#a78bfa;${hc.timer}`
    : `${hc.timer};#3b82f6;${hc.timer}`;
  return (
    <svg width={size} height={Math.round(size * 1.72)} viewBox="0 0 60 103" fill="none"
      xmlns="http://www.w3.org/2000/svg" style={{ display:"block", ...style }}>
      {/* lv9+: crown */}
      {level >= 9 && (
        <g>
          <polygon points="30,-8 24,2 30,0 36,2" fill="#fbbf24"/>
          <polygon points="24,2 18,0 22,6" fill="#f59e0b"/>
          <polygon points="36,2 42,0 38,6" fill="#f59e0b"/>
          <circle cx="30" cy="-4" r="2.5" fill="#a78bfa"/>
        </g>
      )}
      {/* ─ crest ─ */}
      <polygon points="30,0 25,11 35,11" fill={hc.crest}/>
      <rect x="28" y="8" width="4" height="5" rx="1" fill={hc.gem}/>
      {/* ─ head ─ */}
      <ellipse cx="30" cy="20" rx="11" ry="13" fill={hc.body}/>
      {/* face mask */}
      <ellipse cx="30" cy="21" rx="9" ry="9" fill="#1c2430"/>
      {/* eyes */}
      <polygon points="21,18 27,14 29,20 23,21" fill={hc.eye}/>
      <polygon points="39,18 33,14 31,20 37,21" fill={hc.eye}/>
      {/* head side marks */}
      <rect x="19" y="18" width="2" height="6" rx="1" fill={hc.sideBar}/>
      <rect x="39" y="18" width="2" height="6" rx="1" fill={hc.sideBar}/>
      {/* ─ neck ─ */}
      <rect x="27" y="32" width="6" height="5" fill={hc.neck}/>
      {/* ─ shoulders ─ */}
      <ellipse cx="14" cy="41" rx="9" ry="6" fill={hc.shoulder}/>
      <ellipse cx="46" cy="41" rx="9" ry="6" fill={hc.shoulder}/>
      {/* lv3+: shoulder gems */}
      {level >= 3 && <>
        <circle cx="14" cy="41" r="3" fill="#0ea5e9" opacity="0.8"/>
        <circle cx="46" cy="41" r="3" fill="#0ea5e9" opacity="0.8"/>
      </>}
      {/* ─ torso ─ */}
      <path d="M16,36 L44,36 L42,68 L18,68 Z" fill={hc.body}/>
      {/* stripe pattern */}
      <path d="M30,38 C23,43 17,52 20,59 C25,53 30,51 30,51 C30,51 35,53 40,59 C43,52 37,43 30,38 Z" fill={hc.stripe}/>
      <path d="M30,51 C24,56 18,64 20,70 L30,65 L40,70 C42,64 36,56 30,51 Z" fill={hc.stripe2}/>
      {/* lv4+: waist gem */}
      {level >= 4 && <circle cx="30" cy="71" r="2.5" fill="#fbbf24" opacity="0.9"/>}
      {/* color timer */}
      <ellipse cx="30" cy="43" rx="4" ry="2.5" fill={hc.timer}>
        <animate attributeName="fill" values={timerVals} dur={level >= 7 ? "0.8s" : "1.5s"} repeatCount="indefinite"/>
      </ellipse>
      {/* lv5+: second timer dot */}
      {level >= 5 && (
        <ellipse cx="30" cy="43" rx="2" ry="1.2" fill="rgba(255,255,255,0.5)">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="0.8s" repeatCount="indefinite"/>
        </ellipse>
      )}
      {/* ─ arms ─ */}
      <rect x="5"  y="35" width="10" height="22" rx="3" fill={hc.body}    transform="rotate(-8 10 46)"/>
      <rect x="4"  y="56" width="9"  height="17" rx="3" fill={hc.armor}   transform="rotate(-14 8 64)"/>
      <ellipse cx="7"  cy="74" rx="5" ry="4" fill={hc.armor} transform="rotate(-14 7 74)"/>
      <rect x="45" y="35" width="10" height="22" rx="3" fill={hc.body}    transform="rotate(8 50 46)"/>
      <rect x="47" y="56" width="9"  height="17" rx="3" fill={hc.armor}   transform="rotate(14 52 64)"/>
      <ellipse cx="53" cy="74" rx="5" ry="4" fill={hc.armor} transform="rotate(14 53 74)"/>
      {/* ─ waist ─ */}
      <rect x="18" y="68" width="24" height="6" rx="2" fill={hc.waist}/>
      {/* ─ legs ─ */}
      <rect x="18" y="74" width="11" height="17" rx="3" fill={hc.body}/>
      <rect x="31" y="74" width="11" height="17" rx="3" fill={hc.body}/>
      {/* knee bands */}
      <rect x="18" y="81" width="11" height="4" rx="1" fill={hc.stripe}/>
      <rect x="31" y="81" width="11" height="4" rx="1" fill={hc.stripe}/>
      {/* shins */}
      <rect x="19" y="91" width="9"  height="12" rx="2" fill={hc.armor}/>
      <rect x="32" y="91" width="9"  height="12" rx="2" fill={hc.armor}/>
      {/* feet */}
      <ellipse cx="23" cy="103" rx="9" ry="3.5" fill={hc.foot}/>
      <ellipse cx="37" cy="103" rx="9" ry="3.5" fill={hc.foot}/>
      {/* lv8+: energy sparks */}
      {level >= 8 && <>
        <circle cx="8"  cy="38" r="1.5" fill="#fbbf24" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0;0.8" dur="1.2s" begin="0s"   repeatCount="indefinite"/>
        </circle>
        <circle cx="52" cy="38" r="1.5" fill="#a78bfa" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0;0.8" dur="1.2s" begin="0.4s" repeatCount="indefinite"/>
        </circle>
        <circle cx="14" cy="70" r="1.5" fill="#fbbf24" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0;0.8" dur="1.2s" begin="0.8s" repeatCount="indefinite"/>
        </circle>
        <circle cx="46" cy="70" r="1.5" fill="#a78bfa" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0;0.8" dur="1.2s" begin="1.2s" repeatCount="indefinite"/>
        </circle>
      </>}
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
  @keyframes confettiFall {
    0%   { opacity: 1; transform: translateY(0)     rotate(0deg);   }
    85%  { opacity: 1; }
    100% { opacity: 0; transform: translateY(110vh) rotate(600deg); }
  }
  @keyframes stampPop {
    0%   { opacity: 0; transform: scale(0)   rotate(-15deg); }
    65%  { opacity: 1; transform: scale(1.2) rotate(4deg);   }
    100% { opacity: 1; transform: scale(1)   rotate(0deg);   }
  }
  @keyframes strokeFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes strokeNumPop {
    0%   { transform: scale(0); } 60% { transform: scale(1.3); } 100% { transform: scale(1); }
  }
  @keyframes levelUpBadge {
    0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
    50%  { transform: scale(1.3) rotate(5deg);  opacity: 1; }
    100% { transform: scale(1) rotate(0deg);    opacity: 1; }
  }
  @keyframes xpFill {
    from { width: 0; }
  }
  @keyframes heroAura {
    0%,100% { filter: drop-shadow(0 0 12px rgba(251,191,36,0.7)); }
    50%     { filter: drop-shadow(0 0 28px rgba(251,191,36,1.0)) drop-shadow(0 0 48px rgba(251,191,36,0.4)); }
  }
`;

// ── 紙吹雪コンポーネント ────────────────────────────────────
const CONF_COLORS = ["#ef4444","#fbbf24","#22c55e","#0ea5e9","#a78bfa","#f472b6","#fb923c"];
function Confetti() {
  const pieces = useRef(
    Array.from({length: 45}, (_, i) => ({
      id: i, x: Math.random() * 100, delay: Math.random() * 0.8,
      color: CONF_COLORS[i % CONF_COLORS.length],
      w: 6 + Math.random() * 10, h: 8 + Math.random() * 14,
      rot: Math.random() * 360, circle: i % 3 === 0,
    }))
  ).current;
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:400,overflow:"hidden"}}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position:"absolute", left:`${p.x}%`, top:"-30px",
          width:p.w, height:p.circle ? p.w : p.h,
          background:p.color,
          borderRadius:p.circle ? "50%" : "2px",
          animation:`confettiFall 2s ease-in ${p.delay}s forwards`,
          transform:`rotate(${p.rot}deg)`,
        }}/>
      ))}
    </div>
  );
}

// ============================================================
// HOME SCREEN  (画像: 暗赤シネマ / Ultraman style)
// ============================================================
function HomeScreen({ onBattle, onTokkun, onZukan, onKakitori }) {
  const [xp,    setXp]    = useState(getXP);
  const [level, setLevel] = useState(() => calcLevel(getXP()));
  useEffect(() => { const v = getXP(); setXp(v); setLevel(calcLevel(v)); }, []);
  const pct = xpBasePct(xp);

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
              filter: level >= 7
                ? "none"
                : "drop-shadow(0 0 18px rgba(239,68,68,0.7))",
              animation: level >= 7
                ? "heroAura 2s ease-in-out infinite"
                : "heroFloat 3s ease-in-out infinite",
            }}>
              <HeroSVG size={Math.min(window.innerWidth * 0.42, 200)} level={level}/>
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

        {/* LEVEL badge (top-right of card) */}
        <div style={{
          position:"absolute", top:-10, right:-14,
          background:"rgba(8,6,4,0.95)",
          border:`1.5px solid ${level >= 7 ? "#fbbf24" : "rgba(251,191,36,0.6)"}`,
          borderRadius:20,
          padding:"4px 12px",
          backdropFilter:"blur(8px)",
          animation:"badgePulse 2.5s ease-in-out infinite",
        }}>
          <div style={{ color: C.muted, fontFamily:"monospace", fontSize:"0.42rem", letterSpacing:"0.15em" }}>LEVEL</div>
          <div style={{ color: C.gold,  fontFamily:"monospace", fontSize:"0.78rem", fontWeight:900, letterSpacing:"0.06em" }}>
            Lv.{level}
          </div>
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

      {/* ── XP バー ───────────────────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:380,
        padding:"6px 24px 0",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <span style={{
              fontFamily:"monospace", fontWeight:900, fontSize:"0.75rem",
              color: C.gold, letterSpacing:"0.06em",
            }}>Lv.{level}</span>
            <span style={{ fontFamily:"monospace", fontSize:"0.58rem", color: C.muted, letterSpacing:"0.05em" }}>
              {level < LEVEL_MAX ? `次のレベルまで ${LEVEL_XP[level] - xp} XP` : "MAX LEVEL！"}
            </span>
          </div>
          <span style={{ fontFamily:"monospace", fontSize:"0.58rem", color:"rgba(251,191,36,0.6)" }}>
            {xp} XP
          </span>
        </div>
        <div style={{ height:7, background:"rgba(255,255,255,0.07)", borderRadius:4, overflow:"hidden", border:"1px solid rgba(251,191,36,0.18)" }}>
          <div style={{
            height:"100%", width:`${pct}%`,
            background:`linear-gradient(90deg, ${C.teal}, ${C.gold})`,
            borderRadius:4,
            boxShadow:"0 0 8px rgba(251,191,36,0.4)",
            transition:"width 0.8s ease-out",
          }}/>
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
        {(() => {
          const subBtnStyle = {
            flex:1, height:46,
            background:"linear-gradient(180deg, rgba(28,16,16,0.92) 0%, rgba(14,8,8,0.96) 100%)",
            border:"1px solid rgba(120,80,80,0.4)",
            borderRadius:999, color: C.muted,
            fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',monospace,sans-serif",
            fontWeight:700, fontSize:"clamp(0.8rem, 3vw, 1rem)",
            letterSpacing:"0.1em", cursor:"pointer",
          };
          return (<>
            <div style={{ display:"flex", gap:10, width:"100%" }}>
              <button onClick={onTokkun} style={subBtnStyle}>⚡ とっくん</button>
              <button onClick={onZukan}  style={subBtnStyle}>📖 ずかん</button>
            </div>
            <button
              onClick={onKakitori}
              style={{
                width:"100%", height:48,
                background:"linear-gradient(180deg, rgba(8,24,32,0.95) 0%, rgba(4,14,20,0.98) 100%)",
                border:`1.5px solid rgba(14,165,233,0.5)`,
                borderRadius:999, color: C.teal,
                fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
                fontWeight:900, fontSize:"clamp(0.85rem,3.2vw,1.05rem)",
                letterSpacing:"0.1em", cursor:"pointer",
                boxShadow:"0 0 12px rgba(14,165,233,0.2)",
                transition:"all 0.2s",
              }}
            >✏ かきとりモード</button>
          </>);
        })()}
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
const COVERAGE_THRESHOLD = 0.10; // 10% 以上なぞれたら成功
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

function BattleScreen({ onHome, enemy }) {
  const kanaSet     = useRef(kanaOf(enemy.kana)).current;
  const pickKana    = useCallback(() => kanaSet[Math.floor(Math.random() * kanaSet.length)], [kanaSet]);
  const canvasWrapRef = useRef(null);

  const [heroHp,    setHeroHp]    = useState(HERO_MAX_HP);
  const [monsterHp, setMonsterHp] = useState(MONSTER_MAX_HP);
  const [kana,      setKana]      = useState(pickKana);
  const [phase,     setPhase]     = useState("idle"); // idle|checking|correct|miss|monsterAtk|win|lose
  const [score,     setScore]     = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [hasStroke,   setHasStroke]   = useState(false);
  const [feedback,    setFeedback]    = useState(""); // overlay text
  const [confettiKey, setConfettiKey] = useState(0);
  const [xp,          setXp]          = useState(getXP);
  const [leveledUp,   setLeveledUp]   = useState(false);
  const level = calcLevel(xp);

  // 文字が変わるたびに読み上げ
  useEffect(() => { speak(kana.kana, { rate: 0.75, pitch: 1.1 }); }, [kana]);

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
    setKana(pickKana());
  }, []);

  // ── こうげき！ボタン ──────────────────────────────
  const handleAttack = useCallback(() => {
    if (phase !== "idle" || !hasStroke) return;
    setPhase("checking");

    const canvas = getCanvas();
    if (!canvas) { setPhase("idle"); return; }

    let cov = 0;
    try {
      cov = evalCoverage(kana.kana, canvas);
    } catch (err) {
      console.warn("evalCoverage error:", err);
      setPhase("idle");
      return;
    }

    if (cov >= COVERAGE_THRESHOLD) {
      // ヒット
      const nextMHp  = monsterHp - 1;
      const newScore = score + 10;
      setMonsterHp(nextMHp);
      setScore(newScore);
      // 勝利XP付与
      if (nextMHp <= 0) {
        const oldLv = calcLevel(xp);
        const newXp = addXP(newScore);
        setXp(newXp);
        if (calcLevel(newXp) > oldLv) setLeveledUp(true);
      }
      setFeedback("シュワッチ！");
      setPhase("correct");
      speak(randItem(PRAISE));
      setConfettiKey(k => k + 1);
      saveStamp(kana.kana);
      setTimeout(() => {
        goNextKana("correct", score + 10, nextMHp, heroHp);
        getCanvas()?._clear?.();   // 攻撃後にキャンバスをリセット
      }, 1300);
    } else {
      // ミス
      const newMiss = missCount + 1;
      setMissCount(newMiss);
      if (newMiss >= MAX_MISS) {
        // モンスター反撃
        speak(randItem(ENCOURAGE));
        setFeedback("やられた！");
        setPhase("monsterAtk");
        const nextHHp = heroHp - 1;
        setHeroHp(nextHHp);
        setTimeout(() => {
          goNextKana("monsterAtk", score, monsterHp, nextHHp);
          getCanvas()?._clear?.();
        }, 1000);
      } else {
        speak(randItem(ENCOURAGE));
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
    setLeveledUp(false);
    const v = getXP(); setXp(v); // 最新XPを反映
    setKana(pickKana());
  };

  return (
    <div style={{
      position:"relative", minHeight:"100dvh", width:"100%",
      background: C.bg,
      display:"flex", flexDirection:"column", alignItems:"center",
      overflow:"hidden",
    }}>
      {confettiKey > 0 && <Confetti key={confettiKey}/>}
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
          <HPBar hp={monsterHp} maxHp={MONSTER_MAX_HP} label={`🦖 ${enemy.name}`} />
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
              : level >= 7
              ? "none"
              : heroDanger
              ? "drop-shadow(0 0 14px rgba(255,80,80,0.9))"
              : "drop-shadow(0 0 12px rgba(120,200,255,0.7))",
            animation: isLose ? "none"
              : level >= 7 ? "heroAura 2s ease-in-out infinite"
              : isMonsterAtk ? "wrongShake 0.45s ease-out"
              : "heroFloat 3s ease-in-out infinite",
          }}>
            <HeroSVG size={Math.min(window.innerWidth * 0.2, 88)} level={level}/>
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
            <enemy.Svg size={Math.min(window.innerWidth * 0.22, 96)}/>
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
          <button
            onClick={() => speak(kana.kana, {rate:0.75, pitch:1.1})}
            style={{background:"none",border:"none",cursor:"pointer",fontSize:"1.1rem",padding:"2px 4px",lineHeight:1}}
          >🔊</button>
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
            {isWin && <span style={{ color: C.teal, marginLeft:8 }}>+{score} XP</span>}
          </div>
          {/* レベルアップバッジ */}
          {isWin && leveledUp && (
            <div style={{
              background:"linear-gradient(135deg, #fbbf24, #f59e0b)",
              border:"2px solid #fde68a",
              borderRadius:16, padding:"8px 28px",
              fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
              fontWeight:900, fontSize:"clamp(1rem,4vw,1.4rem)",
              color:"#1c1200", letterSpacing:"0.08em",
              boxShadow:"0 0 24px rgba(251,191,36,0.7)",
              animation:"levelUpBadge 0.5s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
            }}>
              ⬆ LEVEL UP！ Lv.{calcLevel(xp)}
            </div>
          )}
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
// STROKE ORDER DATA  (書き順 SVG パス / 100×100 座標系)
// s=stroke path、sx/sy=ストローク開始点
// ============================================================
const SD = (d, sx, sy) => ({ d, sx, sy });
const STROKE_DATA = {
  // ア行
  "あ":[SD("M28,26 L72,26",28,26), SD("M14,45 L86,45",14,45), SD("M63,27 C70,46 58,66 40,75 C26,82 14,74 18,63 C23,52 50,48 63,45",63,27)],
  "い":[SD("M36,18 C34,36 31,58 35,80",36,18), SD("M65,16 C62,33 57,55 48,74 C44,80 40,83 37,83",65,16)],
  "う":[SD("M36,22 L64,22",36,22), SD("M36,36 L64,36 L64,50 L36,50 L36,36",36,36), SD("M50,50 C56,62 57,73 50,82 C44,88 36,88 30,84",50,50)],
  "え":[SD("M20,26 L80,26",20,26), SD("M50,26 L50,48",50,26), SD("M18,60 L82,60",18,60), SD("M50,60 C56,68 60,74 56,82 C52,88 44,90 38,86",50,60)],
  "お":[SD("M28,22 L72,22",28,22), SD("M14,42 L86,42",14,42), SD("M50,22 C56,35 58,52 54,68 C50,80 42,88 34,86",50,22)],
  // カ行
  "か":[SD("M22,22 L22,82",22,22), SD("M18,50 L82,50",18,50), SD("M65,18 C72,35 70,56 60,72 C52,84 44,88 38,86",65,18)],
  "き":[SD("M18,22 L82,22",18,22), SD("M18,44 L82,44",18,44), SD("M50,22 C55,32 56,40 50,48",50,22), SD("M40,56 C55,62 68,72 64,82 C60,90 46,92 38,88 C26,82 22,68 30,60 C36,54 50,54 60,58",40,56)],
  "く":[SD("M68,16 C74,30 72,50 60,64 C50,74 38,80 28,82",68,16)],
  "け":[SD("M26,18 L26,82",26,18), SD("M26,46 L74,36",26,46), SD("M74,36 L74,82",74,36)],
  "こ":[SD("M16,28 L84,28",16,28), SD("M16,72 L84,72",16,72)],
  // サ行
  "さ":[SD("M18,28 L82,28",18,28), SD("M18,56 L82,56",18,56), SD("M55,28 C60,46 58,64 50,76 C44,84 36,88 28,86",55,28)],
  "し":[SD("M50,16 C52,35 54,58 50,74 C46,84 38,88 30,86",50,16)],
  "す":[SD("M18,28 L82,28",18,28), SD("M50,14 L50,62 C52,70 58,74 64,72",50,14), SD("M34,76 C40,82 54,86 64,80",34,76)],
  "せ":[SD("M28,18 L28,82",28,18), SD("M18,46 L82,46",18,46), SD("M28,46 C44,36 72,34 78,46 C82,54 76,68 56,72 C44,76 34,74 28,68",28,46)],
  "そ":[SD("M20,22 L80,22",20,22), SD("M50,22 C58,36 64,50 56,64 C48,76 36,80 26,76",50,22), SD("M40,64 C50,70 64,72 72,64",40,64)],
  // タ行
  "た":[SD("M18,28 L82,28",18,28), SD("M50,14 L50,52",50,14), SD("M28,52 L72,52",28,52), SD("M65,52 C70,64 68,76 58,84 C50,90 40,90 34,86",65,52)],
  "ち":[SD("M18,26 L82,26",18,26), SD("M55,18 C62,32 64,48 58,62 C52,74 42,80 32,76 C22,72 18,62 22,52 C26,40 40,36 56,40",55,18)],
  "つ":[SD("M72,20 C80,36 78,58 64,72 C52,84 36,88 24,84",72,20)],
  "て":[SD("M16,30 L84,30",16,30), SD("M50,16 L50,42 C52,56 60,64 68,68",50,16)],
  "と":[SD("M44,16 L44,52",44,16), SD("M26,52 C32,60 50,70 66,60 C76,54 76,38 64,30",26,52)],
  // ナ行
  "な":[SD("M20,28 L80,28",20,28), SD("M50,14 L50,52",50,14), SD("M28,52 L72,52",28,52), SD("M65,52 C72,64 70,76 58,84 C44,90 30,86 24,76 C20,68 24,58 34,54 C44,50 56,52 62,58",65,52)],
  "に":[SD("M26,18 L26,82",26,18), SD("M26,50 L74,50",26,50), SD("M74,36 L74,82",74,36)],
  "ぬ":[SD("M26,18 C28,36 26,56 22,74 C18,82 14,84 12,82",26,18), SD("M54,18 C58,32 60,48 54,64 C46,78 36,82 28,80",54,18), SD("M40,60 C48,68 60,74 68,68 C76,60 76,46 68,38 C60,30 48,28 44,32",40,60)],
  "ね":[SD("M26,18 L26,82",26,18), SD("M26,46 L74,36 L74,78 C72,86 60,88 48,84 C36,78 26,68 26,60",26,46)],
  "の":[SD("M64,18 C74,28 78,44 72,58 C64,74 48,82 34,78 C20,72 14,58 18,44 C22,30 36,22 50,24 C62,26 72,36 72,48",64,18)],
  // ハ行
  "は":[SD("M26,18 L26,82",26,18), SD("M26,46 L74,36",26,46), SD("M74,36 C80,50 80,64 72,74 C64,82 52,84 44,78",74,36)],
  "ひ":[SD("M50,14 C56,26 60,44 56,60 C50,74 38,82 28,80 C16,76 12,62 18,50 C24,38 40,34 56,38",50,14)],
  "ふ":[SD("M30,22 L70,22",30,22), SD("M26,40 C36,30 64,30 74,40",26,40), SD("M20,60 C30,54 46,50 46,62 C46,72 36,78 26,76",20,60), SD("M54,60 C64,54 78,56 80,66 C82,76 72,82 60,78",54,60)],
  "へ":[SD("M20,60 C36,28 56,22 80,50",20,60)],
  "ほ":[SD("M26,18 L26,82",26,18), SD("M16,48 L84,48",16,48), SD("M58,18 C64,28 64,40 58,48",58,18), SD("M58,56 C66,66 68,76 60,84 C52,90 40,88 32,80",58,56)],
  // マ行
  "ま":[SD("M16,26 L84,26",16,26), SD("M16,48 L84,48",16,48), SD("M50,26 C56,38 58,56 52,70 C46,82 36,88 26,86",50,26)],
  "み":[SD("M26,22 C28,38 26,54 20,70",26,22), SD("M58,18 C62,32 62,50 56,62 C48,76 34,80 24,76",58,18), SD("M50,54 C58,62 70,68 78,62",50,54)],
  "む":[SD("M38,18 L38,52",38,18), SD("M18,40 L82,40",18,40), SD("M52,40 C62,50 68,64 60,74 C52,84 38,86 28,80 C18,74 16,62 22,52 C28,42 42,40 52,48",52,40)],
  "め":[SD("M28,18 C30,34 28,52 24,70",28,18), SD("M58,18 C64,30 66,46 60,60 C52,74 40,78 30,74 C46,70 60,62 62,50 C64,38 56,28 46,26",58,18)],
  "も":[SD("M16,28 L84,28",16,28), SD("M16,50 L84,50",16,50), SD("M50,28 C56,40 58,56 52,68 C46,78 38,84 30,82",50,28)],
  // ヤ行
  "や":[SD("M50,16 C54,30 54,48 48,62",50,16), SD("M22,44 C32,36 52,32 62,38 C72,44 74,58 64,66",22,44), SD("M28,72 L72,72",28,72)],
  "ゆ":[SD("M26,28 C28,42 24,58 18,72",26,28), SD("M46,18 L46,86",46,18), SD("M46,40 L82,40 L82,76 L46,76",46,40)],
  "よ":[SD("M44,16 C48,28 48,44 42,56",44,16), SD("M16,36 L84,36",16,36), SD("M16,66 L84,66",16,66)],
  // ラ行
  "ら":[SD("M16,26 L84,26",16,26), SD("M50,26 C58,40 62,58 54,70 C46,82 34,86 24,84",50,26)],
  "り":[SD("M36,18 C38,36 34,58 28,76",36,18), SD("M64,18 C66,36 64,56 58,68 C52,80 42,84 34,82",64,18)],
  "る":[SD("M50,16 C60,24 68,38 64,52 C58,66 44,70 34,64 C22,56 20,40 28,30 C36,20 52,20 60,28 C66,36 64,48 56,54",50,16)],
  "れ":[SD("M26,18 L26,82",26,18), SD("M26,46 C40,38 62,36 72,46 C80,54 78,68 64,76 C52,82 38,80 28,72",26,46)],
  "ろ":[SD("M18,26 L82,26",18,26), SD("M50,26 C60,38 64,54 56,66 C48,78 34,82 24,78",50,26)],
  // ワ行
  "わ":[SD("M26,18 L26,82",26,18), SD("M26,46 C40,36 64,34 74,46 C82,54 80,68 66,76 C52,82 38,78 30,68",26,46)],
  "を":[SD("M14,22 L86,22",14,22), SD("M14,42 L86,42",14,42), SD("M50,42 C58,56 62,70 54,80 C46,90 32,90 24,82",50,42)],
  "ん":[SD("M50,16 C56,26 60,42 54,56 C46,70 34,74 24,70",50,16)],
  // 濁音
  "が":[SD("M22,22 L22,82",22,22), SD("M18,50 L82,50",18,50), SD("M65,18 C72,35 70,56 60,72 C52,84 44,88 38,86",65,18)],
  "ぎ":[SD("M18,22 L82,22",18,22), SD("M18,44 L82,44",18,44), SD("M50,22 C55,32 56,40 50,48",50,22), SD("M40,56 C55,62 68,72 64,82 C60,90 46,92 38,88 C26,82 22,68 30,60",40,56)],
  "ぐ":[SD("M68,16 C74,30 72,50 60,64 C50,74 38,80 28,82",68,16)],
  "ざ":[SD("M18,28 L82,28",18,28), SD("M18,56 L82,56",18,56), SD("M55,28 C60,46 58,64 50,76 C44,84 36,88 28,86",55,28)],
  "ず":[SD("M18,28 L82,28",18,28), SD("M50,14 L50,62 C52,70 58,74 64,72",50,14), SD("M34,76 C40,82 54,86 64,80",34,76)],
  "だ":[SD("M18,28 L82,28",18,28), SD("M50,14 L50,52",50,14), SD("M28,52 L72,52",28,52), SD("M65,52 C70,64 68,76 58,84 C50,90 40,90 34,86",65,52)],
  "ぢ":[SD("M18,26 L82,26",18,26), SD("M55,18 C62,32 64,48 58,62 C52,74 42,80 32,76 C22,72 18,62 22,52 C26,40 40,36 56,40",55,18)],
  "づ":[SD("M72,20 C80,36 78,58 64,72 C52,84 36,88 24,84",72,20)],
  "で":[SD("M16,30 L84,30",16,30), SD("M50,16 L50,42 C52,56 60,64 68,68",50,16)],
  "ど":[SD("M44,16 L44,52",44,16), SD("M26,52 C32,60 50,70 66,60 C76,54 76,38 64,30",26,52)],
  "ば":[SD("M26,18 L26,82",26,18), SD("M26,46 L74,36",26,46), SD("M74,36 C80,50 80,64 72,74 C64,82 52,84 44,78",74,36)],
  "び":[SD("M50,14 C56,26 60,44 56,60 C50,74 38,82 28,80 C16,76 12,62 18,50 C24,38 40,34 56,38",50,14)],
  "ぶ":[SD("M30,22 L70,22",30,22), SD("M26,40 C36,30 64,30 74,40",26,40), SD("M20,60 C30,54 46,50 46,62 C46,72 36,78 26,76",20,60), SD("M54,60 C64,54 78,56 80,66 C82,76 72,82 60,78",54,60)],
};

// ============================================================
// STROKE ORDER GUIDE  (書き順フェード表示)
// ============================================================
const STROKE_COLORS = ["#ef4444", "#22c55e", "#0ea5e9", "#ec4899"];

function StrokeOrderGuide({ kana, visible, onDone }) {
  const [step, setStep] = useState(-1);
  const strokes = STROKE_DATA[kana] || [];

  useEffect(() => {
    if (!visible || strokes.length === 0) { onDone?.(); return; }
    setStep(0);
    let cur = 0;
    const timer = setInterval(() => {
      cur++;
      if (cur >= strokes.length) {
        clearInterval(timer);
        setTimeout(() => onDone?.(), 1500);
        return;
      }
      setStep(cur);
    }, 900);
    return () => clearInterval(timer);
  }, [visible, kana]); // eslint-disable-line

  if (!visible || strokes.length === 0) return null;

  return (
    <div style={{ position:"absolute", inset:0, zIndex:10, pointerEvents:"none", borderRadius:14 }}>
      <svg viewBox="0 0 100 100" style={{ position:"absolute", inset:0, width:"100%", height:"100%", overflow:"visible" }}>
        {/* 各ストロークをフェードイン */}
        {strokes.slice(0, step + 1).map((s, i) => (
          <path
            key={`stroke-${i}-${kana}`}
            d={s.d}
            stroke={STROKE_COLORS[i % STROKE_COLORS.length]}
            strokeWidth="6"
            fill="none" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: i === step ? "strokeFadeIn 0.5s ease-out forwards" : "none" }}
          />
        ))}
        {/* 番号サークル */}
        {strokes.slice(0, step + 1).map((s, i) => (
          <g key={`num-${i}-${kana}`} style={{ animation: i === step ? "strokeNumPop 0.3s ease-out" : "none" }}>
            <circle cx={s.sx} cy={s.sy} r="8"
              fill={STROKE_COLORS[i % STROKE_COLORS.length]}
              stroke="#fff" strokeWidth="1.5"
            />
            <text x={s.sx} y={s.sy + 3.8} textAnchor="middle"
              fill="white" fontSize="9" fontWeight="900"
              fontFamily="monospace">{i + 1}</text>
          </g>
        ))}
      </svg>
      {/* ラベル */}
      <div style={{
        position:"absolute", top:6, left:6,
        background:"rgba(14,165,233,0.18)", border:"1px solid rgba(14,165,233,0.5)",
        borderRadius:6, padding:"2px 8px",
        fontFamily:"monospace", fontSize:"0.55rem", color:"#22d3ee", letterSpacing:"0.08em",
      }}>
        {step + 1} / {strokes.length} かくめ
      </div>
    </div>
  );
}

// ============================================================
// TRACING CANVAS  (スタイラス・ペン入力)
// ============================================================
function TracingCanvas({ guideKana, onFirstStroke, showStrokeBtn = true, freeWrite = false }) {
  const canvasRef    = useRef(null);
  const isDrawing    = useRef(false);
  const lastPt       = useRef(null);
  const hasDrawn     = useRef(false);
  const [guideOn,    setGuideOn]    = useState(false);
  const [guideKey,   setGuideKey]   = useState(0);

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
    setGuideOn(false); // 文字が変わったらガイドをリセット
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

  const hasStrokeData = (STROKE_DATA[guideKana] || []).length > 0;

  return (
    <div style={{
      position:"relative", width:"100%", aspectRatio:"1/1",
      background:"#ddd8d0",
      borderRadius:14,
      overflow:"hidden",
      border:"2.5px solid rgba(239,68,68,0.65)",
      boxShadow:"0 0 10px rgba(239,68,68,0.18)",
    }}>
      {/* 書き順ガイドオーバーレイ */}
      <StrokeOrderGuide
        kana={guideKana}
        visible={guideOn}
        onDone={() => setGuideOn(false)}
      />

      {/* 書き順ボタン */}
      {showStrokeBtn && hasStrokeData && (
        <button
          onClick={() => { setGuideOn(true); setGuideKey(k => k + 1); }}
          style={{
            position:"absolute", bottom:8, right:8, zIndex:15,
            background:"rgba(14,165,233,0.18)", border:"1px solid rgba(14,165,233,0.55)",
            borderRadius:8, padding:"4px 10px",
            color:"#22d3ee", fontFamily:"monospace", fontSize:"0.6rem",
            letterSpacing:"0.08em", cursor:"pointer",
            pointerEvents:"auto",
          }}
        >✍ 書き順</button>
      )}

      {/* ガイド文字 (なぞる目安 — #E7132C で明確に表示) */}
      <div style={{
        position:"absolute", inset:0, zIndex:1,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:"min(62vw, 340px)",
        fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
        fontWeight:900,
        color: freeWrite ? "transparent" : "rgba(231,19,44,0.40)",
        lineHeight:1,
        userSelect:"none", pointerEvents:"none",
        transition:"color 0.25s",
      }}>{guideKana}</div>

      {/* 補助グリッド線 (縦横中心) */}
      <div style={{
        position:"absolute", inset:0, zIndex:1, pointerEvents:"none",
        backgroundImage:`
          linear-gradient(rgba(100,80,60,0.15) 1px, transparent 1px),
          linear-gradient(90deg, rgba(100,80,60,0.15) 1px, transparent 1px)
        `,
        backgroundSize:"50% 50%",
        backgroundPosition:"50% 50%",
      }} />

      {/* 描画キャンバス — 背景は透明にして下のガイドを見せる */}
      <canvas
        ref={canvasRef}
        style={{
          display:"block", position:"relative", zIndex:2,
          width:"100%", height:"100%",
          background:"transparent",
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
  const [hasStroke,   setHasStroke]   = useState(false);
  const [phase,       setPhase]       = useState("idle"); // idle | ok | miss
  const [confettiKey, setConfettiKey] = useState(0);
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
      speak(randItem(PRAISE));
      setConfettiKey(k => k + 1);
      saveStamp(card.kana);
      setPhase("ok");
      setTimeout(goNext, 1200);
    } else {
      speak(randItem(ENCOURAGE));
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
      {confettiKey > 0 && <Confetti key={confettiKey}/>}
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
            <button
              onClick={() => speak(card.kana, {rate:0.75, pitch:1.1})}
              style={{background:"none",border:"none",cursor:"pointer",fontSize:"1.1rem",padding:"2px 4px",lineHeight:1}}
            >🔊</button>
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
// KAKITORI SCREEN  (下書きなし自由書き判定)
// ============================================================
const KAKITORI_XP = 8; // 1文字成功で獲得するXP

function KakitoriScreen({ onHome }) {
  // スタンプ済み文字を優先、3文字未満なら全文字
  const stamps  = useRef(getStamps()).current;
  const raw     = useRef(
    stamps.size >= 3
      ? ALL_KANA.filter(k => stamps.has(k.kana))
      : [...ALL_KANA]
  ).current;
  const deck    = useRef([...raw].sort(() => Math.random() - 0.5)).current;

  const [idx,         setIdx]         = useState(0);
  const [done,        setDone]        = useState(false);
  const [hasStroke,   setHasStroke]   = useState(false);
  const [phase,       setPhase]       = useState("idle"); // idle|ok|miss
  const [peeking,     setPeeking]     = useState(false);
  const [peekLock,    setPeekLock]    = useState(false); // クールダウン
  const [confettiKey, setConfettiKey] = useState(0);
  const [xpEarned,    setXpEarned]    = useState(0); // このセッションで稼いだXP
  const [correctCount,setCorrectCount]= useState(0);
  const canvasRef = useRef(null);

  const card     = deck[idx];
  const total    = deck.length;
  const progress = Math.round((idx / total) * 100);

  const getCanvas = () => canvasRef.current?.querySelector("canvas");
  const clearCanvas = () => { getCanvas()?._clear?.(); setHasStroke(false); };

  const goNext = useCallback(() => {
    setPhase("idle"); setHasStroke(false);
    if (idx + 1 >= total) { setDone(true); return; }
    setIdx(i => i + 1);
  }, [idx, total]);

  const handleJudge = () => {
    if (!hasStroke || phase !== "idle") return;
    const canvas = getCanvas();
    if (!canvas) return;
    let cov = 0;
    try { cov = evalCoverage(card.kana, canvas); } catch { setPhase("idle"); return; }

    if (cov >= COVERAGE_THRESHOLD) {
      speak(randItem(PRAISE));
      setConfettiKey(k => k + 1);
      saveStamp(card.kana);
      addXP(KAKITORI_XP);
      setXpEarned(n => n + KAKITORI_XP);
      setCorrectCount(n => n + 1);
      setPhase("ok");
      setTimeout(goNext, 1200);
    } else {
      speak(randItem(ENCOURAGE));
      setPhase("miss");
      setTimeout(() => { clearCanvas(); setPhase("idle"); }, 900);
    }
  };

  // チラ見: 文字を1.5秒だけ表示
  const handlePeek = () => {
    if (peekLock || peeking) return;
    speak(card.kana, { rate: 0.75, pitch: 1.1 });
    setPeeking(true);
    setTimeout(() => {
      setPeeking(false);
      setPeekLock(true);
      setTimeout(() => setPeekLock(false), 3000); // 3秒クールダウン
    }, 1500);
  };

  const restart = () => {
    deck.sort(() => Math.random() - 0.5);
    setIdx(0); setDone(false); setHasStroke(false);
    setPhase("idle"); setXpEarned(0); setCorrectCount(0);
  };

  return (
    <div style={{
      position:"relative", minHeight:"100dvh", width:"100%",
      background: C.bg,
      display:"flex", flexDirection:"column", alignItems:"center",
      overflow:"hidden",
    }}>
      {confettiKey > 0 && <Confetti key={confettiKey}/>}
      <CityBokeh />

      {/* ── チラ見オーバーレイ ───────────────────────────── */}
      {peeking && (
        <div style={{
          position:"fixed", inset:0, zIndex:250, pointerEvents:"none",
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:12,
          background:"rgba(0,0,0,0.78)", backdropFilter:"blur(4px)",
        }}>
          <div style={{
            fontSize:"min(48vw, 220px)",
            fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
            fontWeight:900, color:"rgba(255,255,255,0.95)",
            textShadow:`0 0 40px ${C.teal}, 0 0 80px rgba(14,165,233,0.4)`,
            lineHeight:1,
            animation:"shuwatchAppear 0.3s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
          }}>{card.kana}</div>
          <div style={{
            fontFamily:"monospace", fontWeight:900,
            fontSize:"clamp(1.2rem,4vw,1.6rem)",
            color: C.teal, letterSpacing:"0.12em",
            textShadow:`0 0 10px ${C.teal}`,
          }}>{card.roma}</div>
          <div style={{ color: C.muted, fontFamily:"monospace", fontSize:"0.65rem", letterSpacing:"0.1em", marginTop:4 }}>
            おぼえてね！
          </div>
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────── */}
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
          ✏ かきとりモード
        </div>
        <div style={{ fontFamily:"monospace", fontSize:"0.7rem", color: C.muted }}>
          {idx + 1} / {total}
        </div>
      </div>

      {/* ── プログレスバー ──────────────────────────────── */}
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:520, padding:"0 20px 8px" }}>
        <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden" }}>
          <div style={{
            height:"100%", width:`${progress}%`,
            background:`linear-gradient(90deg, ${C.teal}, ${C.gold})`,
            borderRadius:2, transition:"width 0.3s ease-out",
          }} />
        </div>
      </div>

      {/* ── メインエリア ────────────────────────────────── */}
      {!done && (
        <div style={{
          position:"relative", zIndex:10, width:"100%", maxWidth:520,
          padding:"0 20px",
          display:"flex", flexDirection:"column", alignItems:"center", gap:12,
          flex:1,
        }}>
          {/* プロンプト */}
          <div style={{
            display:"flex", alignItems:"center", gap:10,
            background:"rgba(14,165,233,0.1)",
            border:"1px solid rgba(14,165,233,0.3)",
            borderRadius:24, padding:"8px 22px",
          }}>
            <span style={{
              fontFamily:"monospace", fontWeight:900,
              fontSize:"clamp(1rem,3.5vw,1.3rem)",
              color: C.teal, letterSpacing:"0.14em",
              textShadow:`0 0 10px ${C.teal}`,
            }}>{card.roma}</span>
            <span style={{ color: C.muted, fontFamily:"monospace", fontSize:"0.6rem", letterSpacing:"0.1em" }}>
              のもじをかいてみよう！
            </span>
          </div>

          {/* キャンバス + 判定オーバーレイ */}
          <div ref={canvasRef} style={{ width:"min(80vw, 440px)", position:"relative" }}>
            <TracingCanvas
              guideKana={card.kana}
              onFirstStroke={() => setHasStroke(true)}
              showStrokeBtn={false}
              freeWrite={true}
            />
            {phase !== "idle" && (
              <div style={{
                position:"absolute", inset:0, zIndex:20, borderRadius:16,
                display:"flex", alignItems:"center", justifyContent:"center",
                background: phase === "ok"
                  ? "rgba(34,197,94,0.18)"
                  : "rgba(239,68,68,0.18)",
                border:`2.5px solid ${phase === "ok" ? "#22c55e" : "#ef4444"}`,
                animation:"correctFlash 0.9s ease-out forwards",
                pointerEvents:"none",
              }}>
                {/* 正解時は文字を表示 */}
                {phase === "ok" && (
                  <div style={{
                    fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
                    fontWeight:900, lineHeight:1,
                    fontSize:"clamp(3rem,18vw,6rem)",
                    color:"rgba(34,197,94,0.9)",
                    textShadow:"0 0 24px rgba(34,197,94,0.8)",
                    animation:"shuwatchAppear 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
                  }}>{card.kana}</div>
                )}
                {phase === "miss" && (
                  <div style={{
                    fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
                    fontWeight:900, fontSize:"clamp(1.6rem,8vw,2.5rem)",
                    color:"#f87171",
                    textShadow:"0 0 20px rgba(239,68,68,0.9)",
                    animation:"shuwatchAppear 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
                  }}>もう一度！</div>
                )}
              </div>
            )}
          </div>

          {/* チラ見 + 操作ボタン */}
          <div style={{ display:"flex", gap:10, width:"100%", maxWidth:380 }}>
            {/* チラ見ボタン */}
            <button
              onClick={handlePeek}
              disabled={peekLock || peeking || phase !== "idle"}
              style={{
                flex:1, height:52,
                background: peekLock
                  ? "rgba(14,30,30,0.6)"
                  : "rgba(14,165,233,0.12)",
                border:`1.5px solid ${peekLock ? "rgba(14,165,233,0.15)" : "rgba(14,165,233,0.5)"}`,
                borderRadius:12,
                color: peekLock ? C.muted : C.teal,
                fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
                fontWeight:700, fontSize:"0.85rem", letterSpacing:"0.06em",
                cursor: (peekLock || peeking || phase !== "idle") ? "default" : "pointer",
                opacity: phase !== "idle" ? 0.4 : 1,
                transition:"all 0.2s",
              }}
            >{peekLock ? "⏳" : "👁 チラ見"}</button>

            {/* 消すボタン */}
            <button
              onClick={clearCanvas}
              disabled={!hasStroke || phase !== "idle"}
              style={{
                flex:1, height:52,
                background:"rgba(22,10,10,0.85)",
                border:"1.5px solid rgba(120,60,60,0.4)", borderRadius:12,
                color: hasStroke && phase === "idle" ? "#f87171" : C.muted,
                fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
                fontWeight:700, fontSize:"0.9rem", letterSpacing:"0.08em",
                cursor: hasStroke && phase === "idle" ? "pointer" : "default",
                opacity: hasStroke && phase === "idle" ? 1 : 0.4,
                transition:"all 0.2s",
              }}>消す</button>

            {/* はんていボタン */}
            <button
              onClick={handleJudge}
              disabled={!hasStroke || phase !== "idle"}
              style={{
                flex:2, height:52,
                background: hasStroke && phase === "idle"
                  ? `linear-gradient(180deg, ${C.teal} 0%, #0284c7 100%)`
                  : "rgba(14,30,40,0.6)",
                border:"2px solid rgba(255,255,255,0.12)", borderRadius:12,
                color:"#fff",
                fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
                fontWeight:900, fontSize:"clamp(0.9rem,3.5vw,1.1rem)", letterSpacing:"0.1em",
                cursor: hasStroke && phase === "idle" ? "pointer" : "default",
                opacity: hasStroke && phase === "idle" ? 1 : 0.45,
                boxShadow: hasStroke && phase === "idle" ? `0 3px 14px rgba(14,165,233,0.5)` : "none",
                transition:"all 0.2s",
              }}>はんてい！</button>
          </div>

          {/* XPヒント */}
          <div style={{
            fontFamily:"monospace", fontSize:"0.6rem",
            color:"rgba(14,165,233,0.5)", letterSpacing:"0.08em",
          }}>
            せいかいで +{KAKITORI_XP} XP
          </div>
        </div>
      )}

      {/* ── DONE OVERLAY ────────────────────────────────── */}
      {done && (
        <div style={{
          position:"fixed", inset:0, zIndex:100,
          background:"rgba(0,0,0,0.85)", backdropFilter:"blur(6px)",
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:16,
        }}>
          <div style={{ fontSize:"4rem" }}>✏</div>
          <div style={{
            fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
            fontWeight:900, fontSize:"clamp(1.4rem,6vw,2rem)",
            color: C.gold, letterSpacing:"0.1em",
            textShadow:"0 0 20px rgba(251,191,36,0.7)",
          }}>かきとり かんりょう！</div>
          <div style={{ display:"flex", gap:16, marginTop:4 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"monospace", fontSize:"0.6rem", color: C.muted, marginBottom:2 }}>せいかい</div>
              <div style={{ fontFamily:"monospace", fontWeight:900, fontSize:"1.2rem", color:"#86efac" }}>
                {correctCount} / {total}
              </div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"monospace", fontSize:"0.6rem", color: C.muted, marginBottom:2 }}>かくとく XP</div>
              <div style={{ fontFamily:"monospace", fontWeight:900, fontSize:"1.2rem", color: C.gold }}>
                +{xpEarned}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:12, marginTop:8 }}>
            <button onClick={restart} style={{
              padding:"12px 28px", borderRadius:999,
              background:`linear-gradient(180deg, ${C.teal}, #0284c7)`,
              border:"none", color:"#fff",
              fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
              fontWeight:900, fontSize:"0.95rem", letterSpacing:"0.1em",
              cursor:"pointer", boxShadow:`0 4px 16px rgba(14,165,233,0.5)`,
            }}>もういちど</button>
            <button onClick={onHome} style={{
              padding:"12px 28px", borderRadius:999,
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
// ENEMY SELECT SCREEN  (てきをえらべ！)
// ============================================================
function EnemySelectScreen({ onSelect, onHome }) {
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
        padding:"14px 20px 6px",
      }}>
        <button onClick={onHome} style={{
          background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)",
          borderRadius:8, color:C.primary, cursor:"pointer",
          padding:"6px 14px", fontFamily:"monospace", fontSize:"0.75rem", letterSpacing:"0.08em",
        }}>← もどる</button>
        <div style={{
          fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
          fontWeight:900, fontSize:"clamp(1rem,4vw,1.3rem)",
          color: C.primary, letterSpacing:"0.08em",
          textShadow:"0 0 12px rgba(239,68,68,0.5)",
        }}>てきをえらべ！</div>
        <div style={{ width:60 }} />
      </div>

      {/* enemy cards */}
      <div style={{
        position:"relative", zIndex:10,
        width:"100%", maxWidth:520,
        padding:"8px 16px 24px",
        display:"flex", flexDirection:"column", gap:12,
        overflowY:"auto", flex:1,
      }}>
        {ENEMY_DEFS.map((enemy, i) => (
          <button
            key={enemy.id}
            onClick={() => onSelect(enemy)}
            style={{
              width:"100%",
              background:"linear-gradient(135deg, rgba(20,8,8,0.92) 0%, rgba(12,5,5,0.96) 100%)",
              border:`2px solid ${i === 0 ? enemy.color : "rgba(100,50,50,0.45)"}`,
              borderRadius:14,
              padding:"12px 16px",
              cursor:"pointer",
              display:"flex", alignItems:"center", gap:14,
              boxShadow: i === 0 ? `0 0 16px ${enemy.color}44` : "none",
              transition:"all 0.15s",
              textAlign:"left",
              position:"relative",
              overflow:"hidden",
            }}
          >
            {/* first enemy badge */}
            {i === 0 && (
              <div style={{
                position:"absolute", top:8, right:10,
                background: enemy.color, borderRadius:6,
                padding:"2px 8px",
                fontFamily:"monospace", fontSize:"0.55rem", color:"#fff",
                fontWeight:700, letterSpacing:"0.1em",
              }}>さいしょの てき</div>
            )}

            {/* mini kaiju */}
            <div style={{
              flexShrink:0,
              filter:`drop-shadow(0 0 8px ${enemy.color}88)`,
            }}>
              <enemy.Svg size={56}/>
            </div>

            {/* info */}
            <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
              <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                <span style={{
                  fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
                  fontWeight:900, fontSize:"clamp(1rem,4vw,1.2rem)",
                  color:"#f1f5f9", letterSpacing:"0.04em",
                }}>{enemy.name}</span>
                <span style={{
                  fontFamily:"monospace", fontSize:"0.6rem",
                  color: C.muted, letterSpacing:"0.06em",
                }}>{enemy.desc}</span>
              </div>

              {/* kana badges */}
              <div style={{ display:"flex", gap:8 }}>
                {enemy.kana.map(k => (
                  <div key={k} style={{
                    width:44, height:44,
                    background:`${enemy.color}22`,
                    border:`1.5px solid ${enemy.color}66`,
                    borderRadius:10,
                    display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center",
                  }}>
                    <div style={{
                      fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
                      fontWeight:900, fontSize:"1.3rem",
                      color:"#f1f5f9", lineHeight:1,
                    }}>{k}</div>
                    <div style={{
                      fontFamily:"monospace", fontSize:"0.5rem",
                      color: enemy.color, letterSpacing:"0.04em",
                    }}>{ALL_KANA.find(a => a.kana === k)?.roma}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* arrow */}
            <div style={{ color: enemy.color, fontSize:"1.4rem", flexShrink:0 }}>›</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ZUKAN SCREEN  (50音ずかん)
// ============================================================
function ZukanScreen({ onHome }) {
  const [selected, setSelected] = useState(null);
  const [stamps,   setStamps]   = useState(() => getStamps());
  const [tab,      setTab]      = useState("kana"); // "kana" | "stamp"

  const handleKanaTap = (kana, roma) => {
    setSelected(prev => prev?.kana === kana ? null : { kana, roma });
    speak(kana, { rate: 0.75, pitch: 1.1 });
  };

  const TAB = (active) => ({
    flex:1, padding:"9px 0", background:"transparent", border:"none",
    borderBottom: active ? `2.5px solid ${C.primary}` : "2.5px solid transparent",
    color: active ? C.primary : C.muted,
    fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',monospace,sans-serif",
    fontWeight:700, fontSize:"0.8rem", letterSpacing:"0.06em",
    cursor:"pointer", transition:"all 0.18s",
  });

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
        padding:"14px 20px 6px",
      }}>
        <button onClick={onHome} style={{
          background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)",
          borderRadius:8, color:C.primary, cursor:"pointer",
          padding:"6px 14px", fontFamily:"monospace", fontSize:"0.75rem", letterSpacing:"0.08em",
        }}>← もどる</button>
        <div style={{ fontFamily:"monospace", fontSize:"0.8rem", letterSpacing:"0.12em", color: C.teal }}>
          {tab === "kana" ? "📖 ひらがなずかん" : "⭐ スタンプ帳"}
        </div>
        <div style={{ width:60 }} />
      </div>

      {/* tabs */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:520,
        display:"flex", padding:"0 20px",
        borderBottom:"1px solid rgba(239,68,68,0.12)",
      }}>
        <button style={TAB(tab === "kana")}  onClick={() => setTab("kana")}>📖 ずかん</button>
        <button style={TAB(tab === "stamp")} onClick={() => { setStamps(getStamps()); setTab("stamp"); }}>
          ⭐ スタンプ（{stamps.size}/{ALL_KANA.length}）
        </button>
      </div>

      {/* ── KANA TAB ─────────────────────────────── */}
      {tab === "kana" && (
        <div style={{
          position:"relative", zIndex:10, width:"100%", maxWidth:520,
          padding:"8px 12px 120px", overflowY:"auto",
          display:"flex", flexDirection:"column", gap:10,
        }}>
          {HIRAGANA_ROWS.map((row) => (
            <div key={row.row}>
              <div style={{
                fontFamily:"monospace", fontSize:"0.55rem", color: C.muted,
                letterSpacing:"0.15em", marginBottom:4, paddingLeft:4,
              }}>{row.row}</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {row.kana.map((kana, i) => {
                  const roma = row.roma[i];
                  const isSel     = selected?.kana === kana;
                  const hasStamp  = stamps.has(kana);
                  return (
                    <button
                      key={kana}
                      onClick={() => handleKanaTap(kana, roma)}
                      style={{
                        width:"clamp(52px,17vw,72px)", height:"clamp(56px,18vw,76px)",
                        position:"relative",
                        background: isSel
                          ? "linear-gradient(135deg, rgba(239,68,68,0.3), rgba(185,28,28,0.2))"
                          : "linear-gradient(135deg, rgba(22,10,10,0.88), rgba(14,6,6,0.94))",
                        border: isSel ? `2px solid ${C.primary}` : "1.5px solid rgba(100,50,50,0.45)",
                        borderRadius:10, cursor:"pointer",
                        display:"flex", flexDirection:"column",
                        alignItems:"center", justifyContent:"center", gap:3,
                        boxShadow: isSel ? "0 0 16px rgba(239,68,68,0.4)" : "none",
                        transition:"all 0.15s",
                      }}
                    >
                      {hasStamp && (
                        <span style={{position:"absolute",top:2,right:3,fontSize:"0.55rem",lineHeight:1}}>⭐</span>
                      )}
                      <div style={{
                        fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
                        fontWeight:900, fontSize:"clamp(1.4rem,5vw,2rem)",
                        color: isSel ? "#fff" : "#cbd5e1",
                        textShadow: isSel ? "0 0 10px rgba(239,68,68,0.6)" : "none",
                        lineHeight:1,
                      }}>{kana}</div>
                      <div style={{
                        fontFamily:"monospace", fontSize:"clamp(0.5rem,1.8vw,0.65rem)",
                        color: isSel ? C.teal : C.muted, letterSpacing:"0.04em",
                      }}>{roma}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── STAMP TAB ──────────────────────────────── */}
      {tab === "stamp" && (
        <div style={{
          position:"relative", zIndex:10, width:"100%", maxWidth:520,
          padding:"14px 16px 32px", overflowY:"auto", flex:1,
        }}>
          {/* progress */}
          <div style={{ marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
              <span style={{
                fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
                fontWeight:900, fontSize:"0.95rem", color:C.gold,
              }}>{stamps.size} もじ あつめた！</span>
              <span style={{fontFamily:"monospace", fontSize:"0.65rem", color:C.muted}}>
                / {ALL_KANA.length}
              </span>
            </div>
            <div style={{height:6, background:"rgba(255,255,255,0.06)", borderRadius:3, overflow:"hidden"}}>
              <div style={{
                height:"100%", width:`${(stamps.size / ALL_KANA.length) * 100}%`,
                background:`linear-gradient(90deg,${C.gold},${C.primary})`,
                borderRadius:3, transition:"width 0.5s ease-out",
              }}/>
            </div>
          </div>

          {/* stamp grid */}
          <div style={{display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center"}}>
            {ALL_KANA.map(({kana, roma}) => {
              const collected = stamps.has(kana);
              return (
                <div
                  key={kana}
                  onClick={() => collected && speak(kana, {rate:0.75, pitch:1.1})}
                  style={{
                    width:56, height:66,
                    background: collected
                      ? "linear-gradient(135deg, #fbbf24, #f59e0b)"
                      : "rgba(30,15,15,0.7)",
                    borderRadius:12,
                    border: collected
                      ? "2px solid rgba(251,191,36,0.8)"
                      : "1.5px dashed rgba(100,60,60,0.35)",
                    display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center", gap:2,
                    boxShadow: collected ? "0 0 14px rgba(251,191,36,0.4), inset 0 1px 0 rgba(255,255,255,0.3)" : "none",
                    cursor: collected ? "pointer" : "default",
                    animation: collected ? "stampPop 0.4s ease-out" : "none",
                    transition:"box-shadow 0.2s",
                  }}
                >
                  <div style={{
                    fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
                    fontWeight:900, fontSize:"1.65rem", lineHeight:1,
                    color: collected ? "#1c1200" : "rgba(100,80,80,0.2)",
                  }}>
                    {collected ? kana : "？"}
                  </div>
                  <div style={{
                    fontFamily:"monospace", fontSize:"0.48rem",
                    color: collected ? "#92400e" : "rgba(100,80,80,0.2)",
                    letterSpacing:"0.02em",
                  }}>
                    {collected ? roma : "·····"}
                  </div>
                </div>
              );
            })}
          </div>

          {stamps.size === ALL_KANA.length && (
            <div style={{
              textAlign:"center", marginTop:24,
              fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
              fontWeight:900, fontSize:"1.1rem",
              color:C.gold, textShadow:"0 0 16px rgba(251,191,36,0.7)",
            }}>🏆 ぜんぶ あつめた！すごい！！</div>
          )}
        </div>
      )}

      {/* selected popup — kana tab only */}
      {tab === "kana" && selected && (
        <div style={{
          position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
          zIndex:50,
          background:"rgba(10,4,4,0.95)", backdropFilter:"blur(12px)",
          border:`2px solid ${C.border}`,
          borderRadius:20, padding:"16px 40px",
          boxShadow:"0 0 32px rgba(239,68,68,0.3)",
          display:"flex", flexDirection:"column", alignItems:"center", gap:6,
          minWidth:180,
        }}>
          <div style={{
            fontSize:"clamp(3rem,12vw,4.5rem)",
            fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
            fontWeight:900, color:"#fff",
            textShadow:"0 0 16px rgba(239,68,68,0.5)", lineHeight:1,
          }}>{selected.kana}</div>
          <div style={{
            fontFamily:"monospace", fontSize:"clamp(1rem,3.5vw,1.4rem)",
            fontWeight:900, color: C.teal, letterSpacing:"0.1em",
            textShadow:`0 0 10px ${C.teal}`,
          }}>{selected.roma}</div>
          <button
            onClick={() => speak(selected.kana, {rate:0.75, pitch:1.1})}
            style={{
              marginTop:4, padding:"6px 22px",
              background:"rgba(14,165,233,0.15)", border:"1px solid rgba(14,165,233,0.4)",
              borderRadius:999, color:C.teal,
              fontFamily:"monospace", fontSize:"0.75rem",
              cursor:"pointer", letterSpacing:"0.08em",
            }}
          >🔊 よみあげる</button>
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
  const [enemy,   setEnemy]   = useState(ENEMY_DEFS[0]); // 選択中の敵

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
            onBattle   ={() => go("enemySelect")}
            onTokkun   ={() => go("tokkun")}
            onZukan    ={() => go("zukan")}
            onKakitori ={() => go("kakitori")}
          />
        )}
        {screen === "enemySelect" && (
          <EnemySelectScreen
            onHome={() => go("home")}
            onSelect={(e) => { setEnemy(e); go("battle"); }}
          />
        )}
        {screen === "battle" && <BattleScreen onHome={() => go("home")} enemy={enemy} />}
        {screen === "tokkun"   && <TokkunScreen   onHome={() => go("home")} />}
        {screen === "kakitori" && <KakitoriScreen onHome={() => go("home")} />}
        {screen === "zukan"    && <ZukanScreen    onHome={() => go("home")} />}
      </ScreenTransition>
    </>
  );
}
