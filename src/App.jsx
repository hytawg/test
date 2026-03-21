import { useState, useCallback, useRef, useEffect } from "react";

// ============================================================
// DESIGN TOKENS (アーケード/CRT パレット)
// ============================================================
const C = {
  bg:       "#040a04",
  surface:  "rgba(4,16,4,0.94)",
  primary:  "#ff2222",     // あか
  primaryD: "#cc0000",
  primaryG: "rgba(255,34,34,0.20)",
  teal:     "#00e5ff",     // しあん
  gold:     "#ffb800",     // あんばー
  text:     "#39ff14",     // ふぉすふぁ グリーン
  muted:    "#1a6b1a",
  border:   "rgba(57,255,20,0.35)",
};

// ============================================================
// HIRAGANA DATA  (50音 × かいじゅう)
// ============================================================
const HIRAGANA_ROWS = [
  { row: "アぎょう", kana: ["あ","い","う","え","お"], roma: ["a","i","u","e","o"] },
  { row: "カぎょう", kana: ["か","き","く","け","こ"], roma: ["ka","ki","ku","ke","ko"] },
  { row: "サぎょう", kana: ["さ","し","す","せ","そ"], roma: ["sa","shi","su","se","so"] },
  { row: "タぎょう", kana: ["た","ち","つ","て","と"], roma: ["ta","chi","tsu","te","to"] },
  { row: "ナぎょう", kana: ["な","に","ぬ","ね","の"], roma: ["na","ni","nu","ne","no"] },
  { row: "ハぎょう", kana: ["は","ひ","ふ","へ","ほ"], roma: ["ha","hi","fu","he","ho"] },
  { row: "マぎょう", kana: ["ま","み","む","め","も"], roma: ["ma","mi","mu","me","mo"] },
  { row: "ザぎょう", kana: ["ざ","じ","ず","ぜ","ぞ"], roma: ["za","ji","zu","ze","zo"] },
  { row: "ヤぎょう", kana: ["や","ゆ","よ"],           roma: ["ya","yu","yo"] },
  { row: "ラぎょう", kana: ["ら","り","る","れ","ろ"], roma: ["ra","ri","ru","re","ro"] },
  { row: "ワぎょう", kana: ["わ","を","ん"],           roma: ["wa","wo","n"] },
];
const ALL_KANA = [
  ...HIRAGANA_ROWS.flatMap((r) => r.kana.map((k, i) => ({ kana: k, roma: r.roma[i] }))),
  { kana: "が", roma: "ga" }, // ステージ1特殊文字
];

const KATAKANA_ROWS = [
  { row: "アぎょう", kana: ["ア","イ","ウ","エ","オ"], roma: ["a","i","u","e","o"] },
  { row: "カぎょう", kana: ["カ","キ","ク","ケ","コ"], roma: ["ka","ki","ku","ke","ko"] },
  { row: "サぎょう", kana: ["サ","シ","ス","セ","ソ"], roma: ["sa","shi","su","se","so"] },
  { row: "タぎょう", kana: ["タ","チ","ツ","テ","ト"], roma: ["ta","chi","tsu","te","to"] },
  { row: "ナぎょう", kana: ["ナ","ニ","ヌ","ネ","ノ"], roma: ["na","ni","nu","ne","no"] },
  { row: "ハぎょう", kana: ["ハ","ヒ","フ","ヘ","ホ"], roma: ["ha","hi","fu","he","ho"] },
  { row: "マぎょう", kana: ["マ","ミ","ム","メ","モ"], roma: ["ma","mi","mu","me","mo"] },
  { row: "ザぎょう", kana: ["ザ","ジ","ズ","ゼ","ゾ"], roma: ["za","ji","zu","ze","zo"] },
  { row: "ヤぎょう", kana: ["ヤ","ユ","ヨ"],           roma: ["ya","yu","yo"] },
  { row: "ラぎょう", kana: ["ラ","リ","ル","レ","ロ"], roma: ["ra","ri","ru","re","ro"] },
  { row: "ワぎょう", kana: ["ワ","ヲ","ン"],           roma: ["wa","wo","n"] },
];
const ALL_KATAKANA = [
  ...KATAKANA_ROWS.flatMap((r) => r.kana.map((k, i) => ({ kana: k, roma: r.roma[i] }))),
  { kana: "ガ", roma: "ga" },
];

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

// ── スタンプちょう (localStorage) ────────────────────────────────
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

// ── 敵定義 (各行セット) ─────────────────────────────────────
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
function EnemyImg({ file, size = 120 }) {
  const src = `${import.meta.env.BASE_URL}${file}`;
  return (
    <img src={src} alt="てき" width={size} height={size}
      style={{ display:"block", objectFit:"contain" }} />
  );
}

const ENEMY_DEFS = [
  // ステージ1: あわがゆずきの6文字 (とくべつステージ)
  { id:0, name:"いせりある",   row:"とくべつ", kana:["あ","わ","が","ゆ","ず","き"], color:"#8b5cf6", desc:"でんきのかいじゅう",     Svg: ({ size }) => <EnemyImg file="enemy1.png" size={size} /> },
  // ステージ2以降: 各行5文字
  { id:1, name:"ごらいあす",   row:"アぎょう",     kana:["あ","い","う","え","お"],       color:"#0ea5e9", desc:"うちゅうのかいじゅう",   Svg: ({ size }) => <EnemyImg file="enemy2.png" size={size} /> },
  { id:2, name:"がいあ",       row:"カぎょう",     kana:["か","き","く","け","こ"],       color:"#f97316", desc:"ちからじまんのかいじゅう", Svg: ({ size }) => <EnemyImg file="enemy3.png" size={size} /> },
  { id:3, name:"ごるどん",     row:"サぎょう",     kana:["さ","し","す","せ","そ"],       color:"#a16207", desc:"しっぽがつよいかいじゅう", Svg: ({ size }) => <EnemyImg file="enemy4.png" size={size} /> },
  { id:4, name:"まんてぃす",   row:"タぎょう",     kana:["た","ち","つ","て","と"],       color:"#64748b", desc:"みつのかおのかいじゅう",   Svg: ({ size }) => <EnemyImg file="enemy5.png" size={size} /> },
  { id:5, name:"おぶりびおん", row:"ナぎょう",     kana:["な","に","ぬ","ね","の"],       color:"#f59e0b", desc:"おなかでたべるかいじゅう", Svg: ({ size }) => <EnemyImg file="enemy6.png" size={size} /> },
  { id:6, name:"いばらぎらん", row:"ハぎょう",     kana:["は","ひ","ふ","へ","ほ"],       color:"#16a34a", desc:"からだじゅうとげのあるかいじゅう",   Svg: ({ size }) => <EnemyImg file="enemy7.png" size={size} /> },
  { id:7, name:"ぜろぎおす",   row:"マぎょう",     kana:["ま","み","む","め","も"],       color:"#4f46e5", desc:"くうかんをゆがめるかいじゅう",       Svg: ({ size }) => <EnemyImg file="enemy8.png" size={size} /> },
  { id:8, name:"まぐねしる",   row:"ザぎょう",     kana:["ざ","じ","ず","ぜ","ぞ"],       color:"#0891b2", desc:"じばをあやつるかいじゅう",           Svg: ({ size }) => <EnemyImg file="enemy9.png" size={size} /> },
  { id:9, name:"あんくがん",   row:"ヤぎょう",     kana:["や","ゆ","よ"],                 color:"#b45309", desc:"こだいからよみがえったかいじゅう",   Svg: ({ size }) => <EnemyImg file="enemy10.png" size={size} /> },
  { id:10, name:"ぐらびどん",  row:"ラぎょう",     kana:["ら","り","る","れ","ろ"],       color:"#7c3aed", desc:"ちょうじゅうりょくのかいじゅう",     Svg: ({ size }) => <EnemyImg file="enemy10.png" size={size} /> },
  { id:11, name:"ぐらびどん",  row:"ワぎょう",     kana:["わ","を","ん"],                 color:"#6d28d9", desc:"ちょうじゅうりょくのさいきょうかいじゅう", Svg: ({ size }) => <EnemyImg file="enemy10.png" size={size} /> },
];

const KATAKANA_ENEMY_DEFS = [
  { id:100, name:"かたかなおう",  row:"とくべつ", kana:["ア","ワ","ガ","ユ","ズ","キ"], color:"#8b5cf6", desc:"かたかなのおうさま",           Svg: ({ size }) => <EnemyImg file="enemy1.png" size={size} /> },
  { id:101, name:"あるふぁ",     row:"アぎょう", kana:["ア","イ","ウ","エ","オ"],     color:"#0ea5e9", desc:"うちゅうのかいじゅう",         Svg: ({ size }) => <EnemyImg file="enemy2.png" size={size} /> },
  { id:102, name:"かっぱ",       row:"カぎょう", kana:["カ","キ","ク","ケ","コ"],     color:"#f97316", desc:"ちからじまんのかいじゅう",     Svg: ({ size }) => <EnemyImg file="enemy3.png" size={size} /> },
  { id:103, name:"しぐま",       row:"サぎょう", kana:["サ","シ","ス","セ","ソ"],     color:"#a16207", desc:"しっぽがつよいかいじゅう",     Svg: ({ size }) => <EnemyImg file="enemy4.png" size={size} /> },
  { id:104, name:"たう",         row:"タぎょう", kana:["タ","チ","ツ","テ","ト"],     color:"#64748b", desc:"みつのかおのかいじゅう",       Svg: ({ size }) => <EnemyImg file="enemy5.png" size={size} /> },
  { id:105, name:"ぬー",         row:"ナぎょう", kana:["ナ","ニ","ヌ","ネ","ノ"],     color:"#f59e0b", desc:"おなかでたべるかいじゅう",     Svg: ({ size }) => <EnemyImg file="enemy6.png" size={size} /> },
  { id:106, name:"ふぁい",       row:"ハぎょう", kana:["ハ","ヒ","フ","ヘ","ホ"],     color:"#16a34a", desc:"からだじゅうとげのあるかいじゅう", Svg: ({ size }) => <EnemyImg file="enemy7.png" size={size} /> },
  { id:107, name:"むー",         row:"マぎょう", kana:["マ","ミ","ム","メ","モ"],     color:"#4f46e5", desc:"くうかんをゆがめるかいじゅう",   Svg: ({ size }) => <EnemyImg file="enemy8.png" size={size} /> },
  { id:108, name:"ぜーた",       row:"ザぎょう", kana:["ザ","ジ","ズ","ゼ","ゾ"],     color:"#0891b2", desc:"じばをあやつるかいじゅう",       Svg: ({ size }) => <EnemyImg file="enemy9.png" size={size} /> },
  { id:109, name:"うぷしろん",   row:"ヤぎょう", kana:["ヤ","ユ","ヨ"],               color:"#b45309", desc:"こだいからよみがえったかいじゅう", Svg: ({ size }) => <EnemyImg file="enemy10.png" size={size} /> },
  { id:110, name:"らむだ",       row:"ラぎょう", kana:["ラ","リ","ル","レ","ロ"],     color:"#7c3aed", desc:"ちょうじゅうりょくのかいじゅう",   Svg: ({ size }) => <EnemyImg file="enemy10.png" size={size} /> },
  { id:111, name:"おめが",       row:"ワぎょう", kana:["ワ","ヲ","ン"],               color:"#6d28d9", desc:"さいきょうのかたかなかいじゅう",   Svg: ({ size }) => <EnemyImg file="enemy10.png" size={size} /> },
];

// ============================================================
// HERO SVG  (ウルトラマンゆずき / レベル対応)
// ============================================================
function HeroImg({ size = 120, mode = "shomen", style = {} }) {
  const base = import.meta.env.BASE_URL;
  const src = mode === "kougeki"
    ? `${base}senshi_kougeki.png`
    : mode === "migi"
    ? `${base}senshi_migi.png`
    : `${base}senshi_shomen.png`;
  const h = Math.round(size * 1.72);
  return (
    <img src={src} alt="せんし" width={size} height={h}
      style={{ display:"block", objectFit:"contain", ...style }} />
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
// STARFIELD BACKGROUND
// ============================================================
function CityBokeh() {
  const stars = [
    { top:"5%",  left:"12%",  size:2, delay:"0s",    dur:"2.8s" },
    { top:"12%", left:"78%",  size:1, delay:"0.4s",  dur:"3.2s" },
    { top:"8%",  left:"45%",  size:2, delay:"1.1s",  dur:"2.5s" },
    { top:"20%", left:"90%",  size:1, delay:"0.7s",  dur:"3.8s" },
    { top:"18%", left:"30%",  size:1, delay:"0.2s",  dur:"2.9s" },
    { top:"32%", left:"5%",   size:2, delay:"1.5s",  dur:"3.1s" },
    { top:"35%", left:"60%",  size:1, delay:"0.9s",  dur:"2.6s" },
    { top:"28%", left:"82%",  size:2, delay:"0.3s",  dur:"3.5s" },
    { top:"45%", left:"22%",  size:1, delay:"1.8s",  dur:"2.7s" },
    { top:"50%", left:"70%",  size:2, delay:"0.6s",  dur:"3.0s" },
    { top:"55%", left:"38%",  size:1, delay:"1.2s",  dur:"2.4s" },
    { top:"60%", left:"88%",  size:2, delay:"0.1s",  dur:"3.6s" },
    { top:"65%", left:"15%",  size:1, delay:"2.0s",  dur:"2.8s" },
    { top:"70%", left:"52%",  size:2, delay:"0.8s",  dur:"3.3s" },
    { top:"78%", left:"75%",  size:1, delay:"1.4s",  dur:"2.9s" },
    { top:"82%", left:"8%",   size:2, delay:"0.5s",  dur:"3.7s" },
    { top:"88%", left:"35%",  size:1, delay:"1.7s",  dur:"2.5s" },
    { top:"92%", left:"65%",  size:2, delay:"0.0s",  dur:"3.4s" },
    { top:"3%",  left:"55%",  size:1, delay:"2.3s",  dur:"2.6s" },
    { top:"40%", left:"95%",  size:2, delay:"1.0s",  dur:"3.0s" },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {stars.map((s, i) => (
        <div key={i} style={{
          position:"absolute", top:s.top, left:s.left,
          width:s.size, height:s.size, borderRadius:"50%",
          background:"#39ff14",
          animation:`twinkle ${s.dur} ${s.delay} ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

// ============================================================
// HP BAR (ピクセルセグメント)
// ============================================================
function HPBar({ hp, maxHp, label }) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const segs = 20;
  const filled = Math.round((pct / 100) * segs);
  const color = pct > 60 ? "#39ff14" : pct > 30 ? "#ffb800" : "#ff2222";
  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:3 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.45rem", color: C.gold, fontFamily:"'Press Start 2P',monospace", letterSpacing:"0.05em" }}>
        <span>{label}</span><span>{hp}/{maxHp}</span>
      </div>
      <div style={{ display:"flex", gap:2 }}>
        {Array.from({ length: segs }, (_, i) => (
          <div key={i} style={{
            flex:1, height:8,
            background: i < filled ? color : "rgba(0,0,0,0.6)",
            border: `1px solid ${i < filled ? color : "rgba(57,255,20,0.15)"}`,
            boxShadow: i < filled ? `0 0 4px ${color}` : "none",
            transition: "background 0.3s, box-shadow 0.3s",
          }} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// COLOR TIMER (アーケードスタイル)
// ============================================================
function ColorTimer({ danger }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <div style={{ display:"flex", gap:5, padding:"4px 8px", border:`1px solid ${danger ? "#ff2222" : C.gold}`, background:"rgba(0,0,0,0.7)" }}>
        {[0, 0.25, 0.5].map((delay, i) => (
          <div key={i} style={{
            width:10, height:10,
            background: danger ? "#ff2222" : C.gold,
            animation: danger
              ? `timerDanger 0.4s ease-in-out ${delay}s infinite`
              : `seg-pulse 1.0s ease-in-out ${delay}s infinite`,
            boxShadow: danger ? `0 0 6px #ff2222` : `0 0 6px ${C.gold}`,
          }} />
        ))}
      </div>
      <div style={{ color: C.gold, fontFamily:"'Press Start 2P',monospace", fontSize:"0.38rem", letterSpacing:"0.05em", animation:"amber-flicker 4s linear infinite" }}>からーたいまー</div>
    </div>
  );
}

// ============================================================
// PILL BUTTON (アーケードベベルボタン)
// ============================================================
function PillBtn({ children, onClick, variant="primary", style={}, disabled=false }) {
  const base = {
    borderRadius: 0,
    cursor: disabled ? "default" : "pointer",
    fontFamily: "'Press Start 2P', monospace",
    letterSpacing: "0.05em",
    transition: "all 0.1s",
    userSelect: "none",
    WebkitUserSelect: "none",
    touchAction: "manipulation",
    opacity: disabled ? 0.4 : 1,
    textTransform: "uppercase",
    position: "relative",
    display: "inline-block",
  };
  const variants = {
    primary: {
      background: "#ff2222",
      border: "2px solid #ff6666",
      borderBottom: "4px solid #880000",
      boxShadow: `0 0 12px rgba(255,34,34,0.6), inset 0 1px 0 rgba(255,150,150,0.3)`,
      color: "#fff",
      fontSize: "clamp(0.7rem, 3.5vw, 0.9rem)",
      padding: "12px 32px",
      animation: disabled ? "none" : "btnPulse 2s ease-in-out infinite",
    },
    secondary: {
      background: "rgba(4,16,4,0.9)",
      border: `1px solid ${C.border}`,
      borderBottom: `3px solid rgba(57,255,20,0.15)`,
      boxShadow: `0 0 6px rgba(57,255,20,0.1)`,
      color: C.muted,
      fontSize: "clamp(0.55rem, 2.5vw, 0.7rem)",
      padding: "10px 24px",
    },
    teal: {
      background: "#003344",
      border: `2px solid ${C.teal}`,
      borderBottom: `4px solid #001a22`,
      boxShadow: `0 0 12px rgba(0,229,255,0.4)`,
      color: C.teal,
      fontSize: "clamp(0.6rem, 3vw, 0.8rem)",
      padding: "10px 28px",
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
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #000;
    font-family: 'Press Start 2P', monospace;
  }
  .arcade-cabinet {
    position: relative;
    max-width: 480px;
    margin: 0 auto;
    min-height: 100dvh;
    background: ${C.bg};
    border-left:  2px solid #111;
    border-right: 2px solid #111;
    overflow: hidden;
    isolation: isolate;
  }
  .arcade-cabinet::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,0.18) 2px,
      rgba(0,0,0,0.18) 4px
    );
    pointer-events: none;
    z-index: 9999;
    animation: scanline 0.12s linear infinite;
  }

  @keyframes amber-flicker {
    0%,19%,21%,23%,25%,54%,56%,100% { opacity:1; }
    20%,22%,24%,55% { opacity:0.6; }
  }
  @keyframes phosphor-glow {
    0%,100% { text-shadow: 0 0 4px #39ff14, 0 0 10px #39ff14; }
    50%     { text-shadow: 0 0 8px #39ff14, 0 0 24px #39ff14, 0 0 40px #39ff14; }
  }
  @keyframes seg-pulse {
    0%,100% { box-shadow: 0 0 6px #ffb800, inset 0 0 4px #ffb800; }
    50%     { box-shadow: 0 0 14px #ffb800, inset 0 0 10px #ffb800; }
  }
  @keyframes hint-blink {
    0%,49% { opacity:1; }
    50%,100% { opacity:0; }
  }
  @keyframes crt-on {
    0%   { transform: scaleY(0.01) scaleX(1); opacity:0.8; }
    30%  { transform: scaleY(1)    scaleX(1); opacity:1; }
    100% { transform: scaleY(1)    scaleX(1); opacity:1; }
  }

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
function HomeScreen({ onBattle, onTokkun, onZukan, onKakitori, kanaMode, onToggleKanaMode }) {
  const [xp,    setXp]    = useState(getXP);
  const [level, setLevel] = useState(() => calcLevel(getXP()));
  useEffect(() => { const v = getXP(); setXp(v); setLevel(calcLevel(v)); }, []);
  const pct = xpBasePct(xp);

  // XP セグメント
  const xpSegs = 16;
  const xpFilled = Math.round((pct / 100) * xpSegs);

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
        position:"relative", zIndex:10, width:"100%",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"12px 16px 8px",
        borderBottom:`1px solid ${C.border}`,
        background:"rgba(4,10,4,0.85)",
      }}>
        {/* left: profile icon */}
        <button style={{
          width:36, height:36, cursor:"pointer",
          border:`1px solid ${C.border}`,
          background:"rgba(57,255,20,0.05)",
          display:"flex", alignItems:"center", justifyContent:"center",
          color: C.text,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </button>

        {/* center: title */}
        <div style={{
          fontFamily:"'Press Start 2P', monospace",
          fontSize:"clamp(0.5rem, 2.8vw, 0.7rem)",
          color: C.text,
          animation:"phosphor-glow 3s ease-in-out infinite",
          letterSpacing:"0.05em",
          textAlign:"center",
        }}>
          うるとらまんゆずき
        </div>

        {/* right: Lv badge */}
        <div style={{
          padding:"4px 8px",
          border:`1px solid ${C.gold}`,
          background:"rgba(0,0,0,0.7)",
          animation:"seg-pulse 2.5s ease-in-out infinite",
        }}>
          <div style={{ color: C.gold, fontFamily:"'Press Start 2P',monospace", fontSize:"0.45rem" }}>Lv.{level}</div>
        </div>
      </div>

      {/* ── HERO CARD ────────────────────────────────────── */}
      <div style={{ position:"relative", zIndex:10, marginTop:16 }}>
        {/* card body */}
        <div style={{
          width:"min(58vw, 220px)", height:"min(68vw, 270px)",
          background:"linear-gradient(160deg, #010a01 0%, #020d02 60%, #041004 100%)",
          border:`2px solid ${C.text}`,
          boxShadow:`0 0 18px rgba(57,255,20,0.3), inset 0 0 18px rgba(57,255,20,0.04)`,
          animation:"cardGlowPulse 4s ease-in-out infinite",
          display:"flex", alignItems:"center", justifyContent:"center",
          overflow:"hidden",
          position:"relative",
        }}>
          {/* hero SVG */}
          <div style={{
            filter: level >= 7
              ? "drop-shadow(0 0 10px #ffb800)"
              : "drop-shadow(0 0 14px #39ff14)",
            animation: level >= 7
              ? "heroAura 2s ease-in-out infinite"
              : "heroFloat 3s ease-in-out infinite",
          }}>
            <HeroImg size={Math.min(window.innerWidth * 0.42, 190)} mode="shomen"/>
          </div>
          {/* corner brackets */}
          {[
            { top:0,    left:0,    borderTop:`2px solid ${C.text}`,    borderLeft:`2px solid ${C.text}` },
            { top:0,    right:0,   borderTop:`2px solid ${C.text}`,    borderRight:`2px solid ${C.text}` },
            { bottom:0, left:0,    borderBottom:`2px solid ${C.text}`, borderLeft:`2px solid ${C.text}` },
            { bottom:0, right:0,   borderBottom:`2px solid ${C.text}`, borderRight:`2px solid ${C.text}` },
          ].map((s, i) => (
            <div key={i} style={{ position:"absolute", width:16, height:16, ...s }} />
          ))}
        </div>

        {/* LEVEL badge (top-right of card) */}
        <div style={{
          position:"absolute", top:-8, right:-12,
          background:"rgba(4,10,4,0.97)",
          border:`1px solid ${C.gold}`,
          padding:"3px 10px",
          animation:"seg-pulse 2.5s ease-in-out infinite",
        }}>
          <div style={{ color: C.gold, fontFamily:"'Press Start 2P',monospace", fontSize:"0.38rem", letterSpacing:"0.1em" }}>LEVEL</div>
          <div style={{ color: C.gold, fontFamily:"'Press Start 2P',monospace", fontSize:"0.65rem" }}>
            {level}
          </div>
        </div>
      </div>

      {/* ── NAME + SUBTITLE ──────────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10, marginTop:14,
        textAlign:"center",
        padding:"0 16px",
      }}>
        <div style={{
          fontFamily:"'Press Start 2P', monospace",
          fontSize:"clamp(1.4rem, 8vw, 2.2rem)",
          color: C.text,
          lineHeight:1.2,
          textShadow:`3px 3px 0 #006600, 0 0 20px #39ff14`,
          animation:"phosphor-glow 4s ease-in-out infinite",
        }}>
          ゆずき
        </div>
        <div style={{
          color: C.teal,
          fontFamily:"'Press Start 2P',monospace",
          fontSize:"clamp(0.4rem, 2vw, 0.55rem)",
          letterSpacing:"0.08em",
          marginTop:6,
          animation:"amber-flicker 5s linear infinite",
        }}>
          ひかりのばとる
        </div>
      </div>

      {/* ── XP バー ───────────────────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:380,
        padding:"10px 20px 0",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
          <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.4rem", color: C.gold }}>
            {level < LEVEL_MAX ? `つぎのれべるまで ${LEVEL_XP[level] - xp}XP` : "MAX!!"}
          </span>
          <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.4rem", color: C.gold }}>
            {xp}XP
          </span>
        </div>
        <div style={{ display:"flex", gap:2 }}>
          {Array.from({ length: xpSegs }, (_, i) => (
            <div key={i} style={{
              flex:1, height:7,
              background: i < xpFilled ? C.teal : "rgba(0,0,0,0.5)",
              border: `1px solid ${i < xpFilled ? C.teal : "rgba(0,229,255,0.12)"}`,
              boxShadow: i < xpFilled ? `0 0 4px ${C.teal}` : "none",
            }} />
          ))}
        </div>
      </div>

      {/* ── BUTTONS ──────────────────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10,
        marginTop:20,
        width:"100%", maxWidth:380,
        padding:"0 20px",
        display:"flex", flexDirection:"column", alignItems:"center", gap:10,
      }}>
        {/* なぞりばとる */}
        <button
          onClick={onBattle}
          style={{
            width:"100%", height:54,
            background:"#ff2222",
            border:"2px solid #ff6666",
            borderBottom:"4px solid #880000",
            color:"#fff",
            fontFamily:"'Press Start 2P', monospace",
            fontSize:"clamp(0.6rem,3.5vw,0.8rem)",
            letterSpacing:"0.05em", cursor:"pointer",
            boxShadow:"0 0 16px rgba(255,34,34,0.5)",
            animation:"btnPulse 2s ease-in-out infinite",
          }}
        >▶ なぞりばとる</button>

        {/* かきとりバトル */}
        <button
          onClick={onKakitori}
          style={{
            width:"100%", height:54,
            background:"#440077",
            border:"2px solid #9933cc",
            borderBottom:"4px solid #220044",
            color:"#dd88ff",
            fontFamily:"'Press Start 2P', monospace",
            fontSize:"clamp(0.6rem,3.5vw,0.8rem)",
            letterSpacing:"0.05em", cursor:"pointer",
            boxShadow:"0 0 16px rgba(150,50,220,0.45)",
            animation:"btnPulse 2.3s ease-in-out infinite",
          }}
        >▶ かきとりばとる</button>

        {/* とっくん + ずかん */}
        <div style={{ display:"flex", gap:8, width:"100%" }}>
          {[
            { label:"⚡ とっくん", fn: onTokkun },
            { label:"📖 ずかん",   fn: onZukan  },
          ].map(({ label, fn }) => (
            <button key={label} onClick={fn} style={{
              flex:1, height:44,
              background:"rgba(4,16,4,0.92)",
              border:`1px solid ${C.border}`,
              borderBottom:`3px solid rgba(57,255,20,0.15)`,
              color: C.muted,
              fontFamily:"'Press Start 2P', monospace",
              fontSize:"clamp(0.45rem, 2.2vw, 0.6rem)",
              letterSpacing:"0.04em", cursor:"pointer",
            }}>{label}</button>
          ))}
        </div>
      </div>

        {/* かな モード切替 */}
        <div style={{
          position:"relative", zIndex:10,
          width:"100%", maxWidth:380,
          padding:"0 20px",
          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          marginTop:4,
        }}>
          <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.38rem", color: C.muted }}>もじしゅるい:</span>
          <button
            onClick={onToggleKanaMode}
            style={{
              padding:"7px 16px",
              background: kanaMode === "katakana" ? C.teal : "#003300",
              border: `2px solid ${kanaMode === "katakana" ? C.teal : C.border}`,
              borderBottom: `4px solid ${kanaMode === "katakana" ? "#007777" : "#001a00"}`,
              color: kanaMode === "katakana" ? "#000" : C.muted,
              fontFamily:"'Press Start 2P',monospace", fontSize:"0.45rem",
              cursor:"pointer",
              boxShadow: kanaMode === "katakana" ? `0 0 12px rgba(0,229,255,0.5)` : "none",
              letterSpacing:"0.05em",
            }}
          >
            {kanaMode === "hiragana" ? "ひらがな ▶" : "◀ カタカナ"}
          </button>
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
  gCtx.font         = `900 ${size * 0.77}px 'Hiragino Mincho ProN','Yu Mincho','YuMincho','Noto Serif JP',serif`;
  gCtx.textAlign    = "center";
  gCtx.textBaseline = "middle";
  // シャドウで判定ゾーンを周囲に広げ、ズレに寛容にする
  gCtx.shadowBlur   = size * 0.06;
  gCtx.shadowColor  = "white";
  gCtx.fillText(guideKana, size / 2, size / 2);
  gCtx.shadowBlur   = 0;
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
  const [guideOn,     setGuideOn]     = useState(false);
  const level = calcLevel(xp);

  // 文字が変わるたびに読み上げ + 書き順リセット
  useEffect(() => {
    speak(kana.kana, { rate: 0.75, pitch: 1.1 });
    setGuideOn(false);
  }, [kana]);

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
        position:"relative", zIndex:10, width:"100%",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 16px 6px",
        borderBottom:`1px solid ${C.border}`,
        background:"rgba(4,10,4,0.85)",
      }}>
        <button onClick={onHome} style={{
          background:"rgba(57,255,20,0.05)", border:`1px solid ${C.border}`,
          color: C.text, cursor:"pointer",
          padding:"5px 12px", fontFamily:"'Press Start 2P',monospace", fontSize:"0.4rem", letterSpacing:"0.05em",
        }}>◀ もどる</button>
        <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.4rem", color: C.gold, animation:"seg-pulse 2s infinite" }}>
          SCORE <span style={{ color: C.gold }}>{score}</span>
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
          background:"linear-gradient(180deg, #010a01 0%, #020d02 100%)",
          border:`1px solid ${C.border}`,
          boxShadow:`inset 0 0 20px rgba(57,255,20,0.04)`,
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
                fontFamily:"'Press Start 2P',monospace",
                fontSize:"clamp(0.6rem,3.5vw,0.9rem)",
                color: isCorrect ? C.gold : C.primary,
                textShadow: isCorrect
                  ? `0 0 16px ${C.gold}`
                  : `0 0 16px ${C.primary}`,
                letterSpacing:"0.05em",
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
            <HeroImg size={Math.min(window.innerWidth * 0.2, 88)} mode={isCorrect ? "kougeki" : "migi"}/>
          </div>

          {/* ビーム */}
          {isCorrect && (
            <div style={{
              position:"absolute",
              left:"clamp(55px,16vw,95px)",
              right:"clamp(55px,16vw,95px)",
              top:"50%", transform:"translateY(-50%)",
              height:6, borderRadius:3,
              background:`linear-gradient(90deg, ${C.teal}, ${C.text}, ${C.gold})`,
              boxShadow:`0 0 16px ${C.teal}, 0 0 30px ${C.text}`,
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
        {/* 読み方ラベル + 書き順ボタン */}
        <div style={{ width:"min(68vw, 320px)", display:"flex", alignItems:"center", gap:6 }}>
          <div style={{
            flex:1,
            display:"flex", alignItems:"center", gap:8,
            background:"rgba(0,229,255,0.06)",
            border:`1px solid ${C.teal}`,
            padding:"6px 12px",
            boxShadow:`0 0 8px rgba(0,229,255,0.2)`,
          }}>
            <span style={{
              fontFamily:"'Press Start 2P',monospace",
              fontSize:"clamp(0.7rem,3vw,0.9rem)",
              color: C.teal, letterSpacing:"0.08em",
              textShadow:`0 0 10px ${C.teal}`,
            }}>{kana.roma}</span>
            <span style={{ color: C.muted, fontFamily:"'Press Start 2P',monospace", fontSize:"0.38rem" }}>
              なぞれ！
            </span>
            <button
              onClick={() => speak(kana.kana, {rate:0.75, pitch:1.1})}
              style={{background:"none",border:"none",cursor:"pointer",fontSize:"1rem",padding:"2px 4px",lineHeight:1}}
            >🔊</button>
          </div>
          {(STROKE_DATA[kana.kana] || []).length > 0 && (
            <button
              onClick={() => setGuideOn(v => !v)}
              style={{
                flexShrink:0,
                padding:"6px 10px",
                background: guideOn ? C.teal : "#005566",
                border:`2px solid ${C.teal}`,
                borderBottom:`4px solid #003344`,
                color: guideOn ? "#000" : C.teal,
                fontFamily:"'Press Start 2P',monospace", fontSize:"0.38rem",
                cursor:"pointer",
                boxShadow: `0 0 10px rgba(0,229,255,0.5)`,
              }}
            >✍<br/>かきじゅん</button>
          )}
        </div>

        {/* キャンバス */}
        <div ref={canvasWrapRef} style={{ width:"min(68vw, 320px)" }}>
          <TracingCanvas
            guideKana={kana.kana}
            onFirstStroke={() => setHasStroke(true)}
          />
        </div>

        {/* 書き順ガイド（キャンバス直下） */}
        <div style={{ width:"min(68vw, 320px)" }}>
          <StrokeOrderGuide kana={kana.kana} visible={guideOn} />
        </div>

        {/* ミス残り表示 */}
        {missCount > 0 && phase === "idle" && (
          <div style={{ display:"flex", gap:5 }}>
            {Array.from({ length: MAX_MISS }).map((_, i) => (
              <div key={i} style={{
                width:10, height:10,
                background: i < missCount ? C.primary : "rgba(255,34,34,0.15)",
                border: `1px solid ${i < missCount ? C.primary : "rgba(255,34,34,0.3)"}`,
                boxShadow: i < missCount ? `0 0 6px ${C.primary}` : "none",
              }} />
            ))}
          </div>
        )}

        {/* ボタン */}
        <div style={{ display:"flex", gap:8, width:"100%", maxWidth:380 }}>
          <button onClick={handleClear} disabled={!hasStroke || phase !== "idle"}
            style={{
              flex:1, height:50,
              background:"rgba(4,16,4,0.9)",
              border:`1px solid ${C.border}`,
              borderBottom:`3px solid rgba(57,255,20,0.15)`,
              color: hasStroke && phase === "idle" ? C.text : C.muted,
              fontFamily:"'Press Start 2P',monospace",
              fontSize:"0.45rem", letterSpacing:"0.04em",
              cursor: hasStroke && phase === "idle" ? "pointer" : "default",
              opacity: hasStroke && phase === "idle" ? 1 : 0.35,
              transition:"all 0.15s",
            }}>けす</button>

          <button onClick={handleAttack} disabled={!hasStroke || phase !== "idle"}
            style={{
              flex:2, height:50,
              background: hasStroke && phase === "idle" ? C.primary : "rgba(40,10,10,0.7)",
              border: `2px solid ${hasStroke && phase === "idle" ? "#ff6666" : "rgba(255,34,34,0.2)"}`,
              borderBottom: `4px solid ${hasStroke && phase === "idle" ? "#880000" : "rgba(255,34,34,0.1)"}`,
              color:"#fff",
              fontFamily:"'Press Start 2P',monospace",
              fontSize:"clamp(0.5rem,2.5vw,0.65rem)", letterSpacing:"0.05em",
              cursor: hasStroke && phase === "idle" ? "pointer" : "default",
              opacity: hasStroke && phase === "idle" ? 1 : 0.4,
              boxShadow: hasStroke && phase === "idle" ? `0 0 14px rgba(255,34,34,0.5)` : "none",
              transition:"all 0.15s",
            }}>こうげき！</button>

          <button onClick={handleGiveUp} disabled={phase !== "idle"}
            style={{
              flex:1, height:50,
              background:"rgba(4,16,4,0.9)",
              border:`1px solid ${C.border}`,
              borderBottom:`3px solid rgba(57,255,20,0.15)`,
              color: C.muted,
              fontFamily:"'Press Start 2P',monospace", fontSize:"0.38rem", letterSpacing:"0.03em",
              cursor: phase === "idle" ? "pointer" : "default",
              opacity: phase === "idle" ? 1 : 0.35,
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
            fontFamily:"'Press Start 2P',monospace",
            fontSize:"clamp(0.9rem,5vw,1.4rem)",
            color: isWin ? C.gold : C.primary,
            textShadow: isWin ? `0 0 20px ${C.gold}` : `0 0 20px ${C.primary}`,
            letterSpacing:"0.05em",
            animation:"phosphor-glow 2s ease-in-out infinite",
          }}>{isWin ? "しょうり！" : "やられた…"}</div>
          <div style={{ color: C.muted, fontFamily:"'Press Start 2P',monospace", fontSize:"0.45rem" }}>
            SCORE <span style={{ color: C.gold }}>{score}</span>
            {isWin && <span style={{ color: C.teal, marginLeft:8 }}>+{score} XP</span>}
          </div>
          {/* レベルアップバッジ */}
          {isWin && leveledUp && (
            <div style={{
              background:"rgba(4,10,4,0.95)",
              border:`2px solid ${C.gold}`,
              padding:"8px 24px",
              fontFamily:"'Press Start 2P',monospace",
              fontSize:"clamp(0.55rem,3vw,0.75rem)",
              color: C.gold, letterSpacing:"0.05em",
              boxShadow:`0 0 24px rgba(255,184,0,0.7)`,
              animation:"levelUpBadge 0.5s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
            }}>
              ▲ LEVEL UP! Lv.{calcLevel(xp)}
            </div>
          )}
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <button onClick={restart} style={{
              padding:"11px 28px",
              background: C.primary,
              border:"2px solid #ff6666",
              borderBottom:"4px solid #880000",
              color:"#fff",
              fontFamily:"'Press Start 2P',monospace",
              fontSize:"0.55rem", letterSpacing:"0.05em",
              cursor:"pointer", boxShadow:`0 0 14px rgba(255,34,34,0.5)`,
            }}>もういちど</button>
            <button onClick={onHome} style={{
              padding:"11px 28px",
              background:"rgba(4,16,4,0.9)",
              border:`1px solid ${C.border}`,
              borderBottom:`3px solid rgba(57,255,20,0.15)`,
              color: C.muted, fontFamily:"'Press Start 2P',monospace", fontSize:"0.5rem", cursor:"pointer",
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
  "あ":[SD("M31.01,33c0.88,0.88,2.75,1.82,5.25,1.75c8.62-0.25,20-2.12,29.5-4.25c1.51-0.34,4.62-0.88,6.62-0.5",31.01,33), SD("M49.76,17.62c0.88,1,1.82,3.26,1.38,5.25c-3.75,16.75-6.25,38.13-5.13,53.63c0.41,5.7,1.88,10.88,3.38,13.62",49.76,17.62), SD("M65.63,44.12c0.75,1.12,1.16,4.39,0.5,6.12c-4.62,12.26-11.24,23.76-25.37,35.76c-6.86,5.83-15.88,3.75-16.25-8.38c-0.34-10.87,13.38-23.12,32.38-26.74c12.42-2.37,27,1.38,30.5,12.75c4.05,13.18-3.76,26.37-20.88,30.49",65.63,44.12)],
  "い":[SD("M21.5,29.66c2.01,2.17,2.61,4.68,2.17,7.43c-3.09,19.16-1.03,32.01,7.93,41.45c6.12,6.45,6.26,3.14,7.04-5.21",21.5,29.66), SD("M72.96,36.51c9.44,8.05,17.79,18.82,18.41,33.83",72.96,36.51)],
  "う":[SD("M42,15.5c5.62,2.12,9.62,3,12.88,3c8.27,0,8,1.12-0.38,5.5",42,15.5), SD("M33,42.38c2.12,1.12,4.12,2.88,8.5,1.38c4.38-1.5,12.75-7.12,18.5-7c5.75,0.12,10.25,5,10.25,18c0,15.49-8.25,30.24-24.37,41.24",33,42.38)],
  "え":[SD("M40.52,13.25c5.62,2.12,10,3,14.12,3c8.27,0,8,1.12-0.38,5.5",40.52,13.25), SD("M32.52,45.12c1.88,1.25,4.5,1.75,7.38,0.62c3.29-1.29,17-7.88,21.25-9.88c4.25-2,8.32,0.04,4.38,4.62c-12.26,14.27-27.26,31.52-39.51,44.4c-3.26,3.42-0.58,3.54,1.5,1.37c13.5-14.12,18.12-20.12,23.62-20.12c7.13,0,3.5,16.75,6.75,22.38c3.25,5.63,19.12,3.75,26.12,2.12",32.52,45.12)],
  "お":[SD("M22.88,35.12c1.38,1,3.62,2.38,6,2.12c2.38-0.26,19.62-5.12,21.12-5.74c1.5-0.62,4-1.25,5.88-2",22.88,35.12), SD("M41.5,16.12c2.25,1,3.59,4.39,3.12,7.38c-2.5,16.12-3.37,45.53-2.25,58.38c0.75,8.62-0.64,10.45-7.12,7.12c-5.13-2.62-13.75-8-13.75-12.38c0-7.5,24.38-23.62,44.75-23.62c17.25,0,25,8.25,25,17.25c0,8.25-9.38,18.88-26.75,21",41.5,16.12), SD("M73,22.12c5.38,2.62,8.88,5.88,10.62,8.25c2.27,3.08,0.38,4.5-1.12,5",73,22.12)],
  "か":[SD("M24.62,38.62c1.88,1.62,4.65,2.33,8.62,1c25.5-8.5,29.5-4.13,29.5,7.62c0,9.38-1.24,17.46-4.25,25.25c-7.62,19.76-10.87,17.39-16.12,10.89",24.62,38.62), SD("M48.5,17.5c1,1.38,1.29,4.7,0.5,7.12c-5,15.25-18.02,40.93-19.62,43.88c-3.12,5.75-6.38,11.88-9.38,16.25",48.5,17.5), SD("M77.37,31.62c7.5,6.88,13.25,15.75,15,24.88",77.37,31.62)],
  "き":[SD("M30.5,30.25c1.88,0.75,4.64,1.06,5.88,0.88c6.75-1,22.25-4.5,26.5-6c2.17-0.76,3.5-1.25,4.88-2.12",30.5,30.25), SD("M36.25,48.7c2.01,0.85,4.97,1.2,6.29,0.99c7.23-1.13,23.82-5.09,28.37-6.79c2.32-0.86,3.75-1.41,5.22-2.4",36.25,48.7), SD("M42,14.12c1.5,0.88,3.13,2.94,4,5.12c5.5,13.76,16,29.26,26.37,40.76c7.64,8.47,9.12,9.38-6,3.88",42,14.12), SD("M33.75,83.25c10.62,9.75,27.25,8.62,38.12,5",33.75,83.25)],
  "く":[SD("M60.66,15c0.5,1.62,0.35,5.44-1,7.38c-6.75,9.62-14.3,19.08-18.62,24.5c-4,5-3.79,7.03-0.88,11c5.5,7.5,12.75,18.75,17.62,27.25c1.48,2.59,2.75,4.75,4.5,8.62",60.66,15)],
  "け":[SD("M24.67,19.75c1.25,1.5,2.62,3.75,2.12,6.38c-3,15.88-6.5,29.5-4.88,44.62c2.02,18.84,2.25,4.75,6.75-3.5",24.67,19.75), SD("M53.67,38.62c2.12,1.38,4.28,1.89,6.88,1.5c8.25-1.25,15.39-2.57,20.62-4c2.76-0.74,5.26-1.12,6.88-1.12",53.67,38.62), SD("M71.67,14.38c2.13,1.37,2.88,3.35,2.88,5.12c0,11.62,0.12,20.38,0.12,30.12c0,20.75-0.62,30.88-12.5,42.25",71.67,14.38)],
  "こ":[SD("M34.75,26.75c1.12,0.88,2.91,2.01,6,1.5c7.62-1.25,14.11-2.56,22.38-2.62c15.5-0.12,5.88,5-5.75,9",34.75,26.75), SD("M30,68.12c2.25,14.5,15.26,17.96,31,16.75c6.5-0.5,11.88-1.25,17.62-2.88",30,68.12)],
  "さ":[SD("M27,38.9c2.42,1.33,5.38,1.47,8.32,1.06c8.79-1.24,28.67-7.76,34.15-10.43c2.79-1.36,3.78-1.91,6.28-3.53",27,38.9), SD("M41.5,13.88c1.5,0.88,3.63,2.94,4.5,5.12c5.5,13.75,15.25,27.62,26.87,39.5c7.98,8.15,6.38,10-6,3.12",41.5,13.88), SD("M35.25,80.5c4.5,11.75,20.88,12.5,38.38,7.5",35.25,80.5)],
  "し":[SD("M39.12,17.5c1.25,3.12,0.93,6.74,0.38,10.25c-2.12,13.5-3,26.5-3,39.12c0,27.38,19.88,30.12,45.5,17.25",39.12,17.5)],
  "す":[SD("M15.5,37.12c2.88,2.12,6.94,1.51,12.75,0.25c16.12-3.5,36.14-5.38,46.62-6.5c7-0.75,11.88-0.62,17.75,0.12",15.5,37.12), SD("M57.62,13.38c2,1.5,2.75,3.25,2.75,5.88c0,10.38,0,35.12,0,40.75c0,14.62-15.62,16.38-15.62,1.75c0-14.25,18-14.12,18,6.38c0,13.25-7.75,21.5-16,28.38",57.62,13.38)],
  "せ":[SD("M16.5,49.93c2.88,2.42,6.86,1.57,12.75,0.53c19-3.34,33-5.72,47.12-7.64c6.99-0.95,11.88-1.21,17.75-0.36",16.5,49.93), SD("M69.74,17.75c2,1.5,2.75,3.25,2.75,5.88c0,10.38,0,17.88,0,23.5c0,25.62-5.75,23.25-11.88,19",69.74,17.75), SD("M35.62,26.25c2,1.5,2.75,3.25,2.75,5.88c0,10.38,0,28.38,0,34c0,14.5,6.38,19.55,20.14,19.55c10.24,0,13.74,0.07,22.61-1.68",35.62,26.25)],
  "そ":[SD("M38.4,22c1.88,1.25,4.98,1.05,7.5,0.38c6.5-1.75,13.25-3.75,19.38-5.38c4.63-1.23,7.18,2.06,3.62,5.25c-12.12,10.87-31.14,24.4-40,30.25c-6.25,4.12-5.88,5.75,1.38,3.88c17.08-4.42,35.96-8.68,50.12-10.38c9.38-1.12,9.62,0.12,0.5,1.38c-15.82,2.17-34.38,14.25-34.38,26.5c0,12.88,11.62,20.38,31.5,16.62",38.4,22)],
  "た":[SD("M24.38,35.38c1.38,0.62,3.88,1.51,6.38,1.12c6.5-1,16.25-2.88,24.88-4.75c2.64-0.57,5.38-1.5,7.62-2.38",24.38,35.38), SD("M45,16.88c0.75,1.25,0.87,3.62,0.38,5.25c-6.35,20.94-12.75,36.37-18.88,52.37c-1.36,3.56-4.75,11.75-6,14.62",45,16.88), SD("M56.38,53.25c12.38-2.75,18.25-3.7,23.62-3.12c15.12,1.62-1.12,2.25-4.25,4.88",56.38,53.25), SD("M54.13,82.25c4.38,7,14.25,8.12,34.5,5.62",54.13,82.25)],
  "ち":[SD("M24.5,32.62c1.38,0.62,3.88,1.51,6.38,1.12c6.5-1,18.25-4.12,26.88-6c2.64-0.57,5.38-1.5,7.62-2.38",24.5,32.62), SD("M45.62,15.62c0.75,1.25,0.71,3.58,0.38,5.25c-3,15-4.25,22.59-8.38,38.62c-3.25,12.62-5.38,11.12,3.62,4.38c8.29-6.21,19.75-9.5,28.5-9.5c8.62,0,14.58,5.88,14.5,14.5c-0.12,13.5-16.5,20.62-29.88,23.25",45.62,15.62)],
  "つ":[SD("M14,44.75c1.88,1.62,4.68,2.09,8.12,0.62c17.88-7.62,30-11.12,44.88-10.88c12.56,0.21,22.98,7.17,22.87,19.17c-0.18,18.77-24.75,28.71-45.01,32.08",14,44.75)],
  "て":[SD("M20.5,26.38c1.87,1.62,4.42,1.97,8.12,1.37c21.75-3.5,33-5.12,50.12-8.38c12.34-2.34,13-0.88,0.38,1.38c-17.89,3.19-33.78,19.12-33.78,37.62c0,20.5,17.91,30.25,35.16,30.25",20.5,26.38)],
  "と":[SD("M35.5,18.38c1.74,0.74,3.62,2.62,4.12,5.37c0.5,2.75,4.75,25,5.38,28.12",35.5,18.38), SD("M78.12,25.5c0.25,1.88,0.04,4.09-2.25,5.75c-6.37,4.63-13.22,8.49-22.75,15.25c-12.88,9.12-21.62,18.38-21.62,27.5c0,10.12,8.5,13.88,26.88,13.88c6.25,0,14.75-0.12,21.62-1.25",78.12,25.5)],
  "な":[SD("M22.88,28.96c1.18,0.58,3.3,1.1,5.47,1.05c5.53-0.13,10.9-0.98,16.52-2.42c4.82-1.23,9.13-3.12,11.38-4.22",22.88,28.96), SD("M42.99,14c0.63,0.89,0.56,2.52,0.31,3.72c-2.96,14.16-7.95,26.56-14.25,37.87c-2.05,3.69-4.25,7.24-6.55,10.65",42.99,14), SD("M72.26,23.25c6.88,2.5,12.62,5.62,14.75,9.5c4.06,7.41-0.25,3.38-3.5,3.88",72.26,23.25), SD("M68.88,44.62c-1,1.88-2.14,5.24-1.88,8.25c0.62,7,1.5,13.12,1.5,20.62c0,20-27.88,19.75-27.88,9.38c0-5.62,8.25-8.25,13.88-8.25c8.75,0,21.5,3.25,29.75,11.5",68.88,44.62)],
  "に":[SD("M24.53,22.75c1.25,1.5,1.62,3.75,1.12,6.38c-3,15.88-9,32.5-7.38,47.62c2.02,18.84,4.5,5.75,8.5-3.5",24.53,22.75), SD("M53.2,30.64c0.96,0.79,2.44,1.58,5.1,1.35c6.98-0.61,15.01-3.3,22.04-3.36c13.19-0.11,1.5,3.75-8.39,7.35",53.2,30.64), SD("M52.53,68c1.76,12.92,11.92,16.01,24.23,14.93c5.08-0.45,8.9-0.8,14.27-2.06",52.53,68)],
  "ぬ":[SD("M25.38,28.5c2,1.38,2.97,3.23,3.38,5.88c1.87,12.18,4.12,23.92,8.54,34.67c1.79,4.36,3.96,8.33,6.84,12.46",25.38,28.5), SD("M57.12,19.25c0.88,2.12,1.06,3.79,0.62,5.88c-3.12,15-13.14,39.81-18.12,48.62c-11.87,21-20.62,1.25-20.62-4.5c0-22.63,43.75-44.25,62.36-29.59c7.66,6.03,9.8,14.58,9.14,23.34c-2,26.75-32.88,28.38-32.88,16.88c0-9.38,17.38-7.12,27.12-1.12c3.1,1.91,7.25,5.25,9.5,7.5",57.12,19.25)],
  "ね":[SD("M33.29,14.5c1.62,1.62,2.1,3.21,1.88,5.88c-1.03,11.93-2.06,31.66-2.53,53.12c-0.1,4.62-0.18,9.31-0.22,14",33.29,14.5), SD("M17.16,37.88c1.62,0.88,3.25,1.38,5.62,0.75c2.14-0.56,7.8-2.31,12.37-4.03c6.26-2.35,6.88-1.47,3.12,3.63c-5.56,7.53-13.02,17.38-18.48,26.77c-5.6,9.62-3.45,8.3,2,3c19.12-18.62,38.5-39.12,54.12-39.12c11.38,0,12.88,11.25,12.88,32.5c0,28.62-30.18,24.88-30.18,16.26c0-9.63,18.73-7.82,28.06-1.88c2.75,1.75,5.88,4.88,7.5,6.75",17.16,37.88)],
  "の":[SD("M53.82,28.62c1,1.5,1.34,4.12,0.88,6.62c-1.75,9.5-6.89,25-10.75,33.12c-9.63,20.26-16.55,14.74-24.38-1.98c-9.13-19.5,23.5-48.88,50.63-40.38c32.38,10.15,28,54.62-4.75,60.88",53.82,28.62)],
  "は":[SD("M24.51,18c1.25,1.5,2.15,4,1.62,6.62c-3.5,17.62-6.98,36.4-4,54.88c2.5,15.5,1.12,2,5.62-6.25",24.51,18), SD("M49.64,37.89c2.41,1.57,4.85,2.16,7.8,1.71c9.36-1.43,17.46-2.94,23.4-4.57c3.12-0.86,5.96-1.29,7.8-1.29",49.64,37.89), SD("M69.77,16.5c2.25,2.12,2.88,4.12,2.88,6.5c0,2.38,1.5,38.62,1.5,48c0,22.5-30.62,19.62-30.62,10.5c0-9.75,23.88-5.62,29.5-2.88c5.62,2.74,11.98,8.26,13.36,9.38",69.77,16.5)],
  "ひ":[SD("M20,25.12c1.25,0.88,3.75,2.25,6.5,1.38c2.75-0.87,7.31-2.38,11.38-4.5c6-3.12,8.42-1.01,4.25,4c-27.13,32.62-23.76,58.5-1.52,62.88c18.07,3.56,37.63-16.38,35.63-56.51c-0.72-14.5-0.17-14.78,4.12-1.75c3.76,11.38,10.26,20.76,16.14,26.5",20,25.12)],
  "ふ":[SD("M42.63,15.62c3.62,3.38,7.5,5.38,12.74,6.13c9.59,1.37,3.5,3.38-1.88,6.12",42.63,15.62), SD("M43.63,46.88c1.88,4.62,7.5,9.41,14.25,17.5c10.62,12.74,0.49,30-19.13,21.62",43.63,46.88), SD("M16.5,73.38c0.75,4,1.88,8.12,5,10.12c1.16,0.74,0.12-3.38,13.25-9.12",16.5,73.38), SD("M80.13,61.88c5.12,3.38,10.28,7.49,11.38,8.88c6.75,8.5-0.25,4.62-4.62,7.12",80.13,61.88)],
  "へ":[SD("M15,48.75c2.25,1.62,4.67,1.96,7-0.38c3.62-3.62,7.46-6.54,11.25-10.5c5.5-5.75,8.48-4.75,13.12-0.88c12.12,10.12,30.38,25.12,33.38,27.38c3,2.26,12.37,10.38,13.87,11.63",15,48.75)],
  "ほ":[SD("M24.51,18.75c1.25,1.5,2.15,4,1.62,6.62c-3.5,17.63-6.98,37.4-4,55.88c2.5,15.5,1.12,2,5.62-6.25",24.51,18.75), SD("M53.08,21.13c1.9,1.28,3.82,1.76,6.14,1.4c7.36-1.17,13.73-2.4,18.41-3.73c2.46-0.7,4.69-1.05,6.13-1.05",53.08,21.13), SD("M53.83,44.3c2.21,1.44,4.46,1.98,7.16,1.57c8.59-1.31,15.78-2.44,21.23-3.94c2.87-0.79,5.72-1.18,7.41-1.18",53.83,44.3), SD("M72.51,23c1.38,1.62,1.62,4.12,1.62,6.5c0,2.38,2,35.12,2,44.5c0,17.5-29.88,17.12-29.88,8c0-9.75,21.38-7.88,29.5-2.88c5.33,3.28,12,8.25,13.38,9.38",72.51,23)],
  "ま":[SD("M29.83,32.28c2.2,1.15,4.43,1.5,7.14,1.26c11.54-1.04,25.94-3.12,34.66-4.85c2.87-0.57,5.45-0.44,7.13-0.44",29.83,32.28), SD("M33.83,51.84c2.45,1.61,4.94,1.72,7.94,1.26c9.52-1.46,17.87-3.1,27.03-5.16c3.22-0.72,6.34-1.32,8.21-1.32",33.83,51.84), SD("M55.81,14c1.52,1.8,1.8,4.57,1.8,7.19c0,2.63,0.46,43.88,0.46,54.25c0,21.3-30.07,19.96-30.07,9.86c0-10.79,25.88-9.93,38.57-3.18c6.12,3.25,11.55,6.38,14.8,9.13",55.81,14)],
  "み":[SD("M32.5,26c1.88,1.75,4.06,1.7,6.88,1.25c3.88-0.62,7.62-1.75,11.88-3.12c4.26-1.37,6.25-0.12,4.5,5.12c-1.75,5.24-6.66,17.39-12,30.12c-13.63,32.51-29.26,29.26-29.26,18.63c0-14.25,20.48-15.36,33-13.5c18.5,2.75,30,6.62,44.38,14.25",32.5,26), SD("M79.38,54.75c0.75,2.38,0.49,4.37,0,6.25c-2.12,8.12-7.5,25-22.12,33.75",79.38,54.75)],
  "む":[SD("M19.59,31.65c2.1,1.55,4.24,1.66,6.81,1.21c8.17-1.41,15.33-2.98,23.19-4.96c2.76-0.69,5.44-1.27,7.05-1.27",19.59,31.65), SD("M37.02,15.5c1.62,1.25,2.31,2.88,2.12,5.25c-0.88,11.12-1.5,20.75-4,34.88c-3.61,20.44-19.25,16.99-18.62,7.37c0.5-7.74,6.25-12.86,12.62-13.5c5-0.5,14.28,1.93,5.88,15c-12.62,19.62-11.42,24.51,5.11,25.54c10.98,0.68,19.26,0.72,28.49-0.92c14.15-2.5,7.4-2.63,7.4-11.13",37.02,15.5), SD("M78.52,36.25c6.88,3.12,11.71,5.95,14.88,10.12c6.25,8.25-1.38,3.62-4.5,4.5",78.52,36.25)],
  "め":[SD("M27.48,31.75c1.75,1,2.41,3.09,2.5,5.25c0.5,11.62,2.75,23.5,7.25,31.38c1.39,2.44,5.38,8.5,7.25,10.38",27.48,31.75), SD("M59.6,19.38c1,1.5,1.35,4.12,0.88,6.62c-2.75,14.62-13.62,37.75-20.1,47.24c-12.28,17.14-16.78,13.14-22.28,0.64c-5.38-15.38,26.4-42.18,53.42-35.28c29.08,8.27,23.96,46.02-7.98,50.15",59.6,19.38)],
  "も":[SD("M49.17,14.75c1.88,1.88,1.86,4.52,1.12,8c-3,14.25-5,26.62-7,42.12c-2.55,19.73-0.75,29.88,17,29.86c20.25-0.02,28.63-13.11,20.01-35.73",49.17,14.75), SD("M26.54,34.62c1.12,0.88,2.87,2.21,6,2c11.12-0.75,20-2.12,27.74-3.46c3.88-0.67,5.88-1.17,8.88-1.04",26.54,34.62), SD("M26.42,53.38c-1.5,4,1,6.75,7.75,6.75c8.75,0,17.62-1,22.88-1.88c2.01-0.33,5.38-1,7.5-1.75",26.42,53.38)],
  "や":[SD("M18,49.38c1.88,1.62,5.25,2.5,8.62,0.88c18.51-8.88,35.76-19.38,50.83-19.26c9.02,0.14,16.01,4.13,15.93,12.29c0,8.33-10.88,16.58-24.5,17.83",18,49.38), SD("M47.13,15.88c5.12,0.88,10.41,4.05,11.5,6.62c2.12,5-1,2.38-2.88,2.62",47.13,15.88), SD("M30,24.38c2.38,1.88,3.28,2.87,3.88,5.25c2.62,10.5,11.12,41.12,14.75,52.5c0.65,2.04,1.88,6.25,2.88,9.38",30,24.38)],
  "ゆ":[SD("M21.05,25.38c1.38,1.5,2.02,4.13,1.5,6.25c-2.88,11.75-4,22.25-2.12,35c2.77,18.85,1.12,3.88,3.25-1.5c9-22.75,27.24-34.5,44.38-34.5c16.88,0,21.88,11.38,21.88,20.25c0,27.38-30.88,29.62-43,16.75",21.05,25.38), SD("M58.42,16.75c2.62,1.75,3.17,3.13,3.5,7.12c0.88,10.5,1.4,18.72,1.62,29.38c0.5,24-6.25,32-12.38,39.25",58.42,16.75)],
  "よ":[SD("M58.24,35.38c7.5-1.28,13.74-2.63,18.5-4.1c2.5-0.77,4.77-1.15,6.25-1.15",58.24,35.38), SD("M54.62,13.88c2.25,2.12,2.98,4.13,2.88,6.5c-0.75,17-0.12,34.88,1.39,53.5c1.88,23.07-34.89,20.88-34.89,11.5c0-12,26.25-8,35.98-4.12c8.1,3.23,11.52,4.88,18.52,10.38",54.62,13.88)],
  "ら":[SD("M35.33,15c3.75,3,9.22,4.41,16.5,4.25c11.12-0.25-0.25,2.38-1.25,3.5",35.33,15), SD("M35.83,35.75c-2.14,4.34-2.79,8.67-3.11,13.24c-0.42,5.84-0.31,12.05-2.14,19.13c-3.16,12.27,1.49,4.77,3,3.5c11.88-10,21.7-12.67,32.61-12.49c9.21,0.15,16.85,5.19,16.76,13.88c-0.12,13.6-14.24,21.49-32.49,22.49",35.83,35.75)],
  "り":[SD("M38.75,25.25c1.25,1.5,2.24,4.03,1.62,6.62c-2.88,12.13-6.29,29.65-4.25,42.38c2,12.5,1.75-0.75,5.62-6.25",38.75,25.25), SD("M69.37,18.75c2.25,2.12,2.88,4.12,2.88,6.5c0,2.38,0,26.38,0,35.75c0,16.5-5,25.75-12.62,33.12",69.37,18.75)],
  "る":[SD("M34.31,20.38c1.75,1.25,4.62,2.62,8.5,1.5c3.88-1.12,9.62-2.5,15.62-4.62c6-2.12,7.5-0.12,4.38,4.25c-3.12,4.37-18.89,24.62-27.75,34c-8.5,9-13.09,11.89,0.75,3.25c15.62-9.75,43-10.88,43,13.38c0,22.5-40.88,24.5-40.88,12.62c0-11.25,18.12-8.75,24.38-0.38",34.31,20.38)],
  "れ":[SD("M34.48,13c1.5,1.38,2.83,3.74,2.5,6.38c-0.5,4-2.75,44.5-2.75,52.88c0,8.38,0.12,16.62,0.12,19.5",34.48,13), SD("M16.98,40.75c2.12,1.38,3.74,1.46,7.5,0c4.5-1.75,6.55-2.66,13-5.5c4.25-1.88,4.4,0.24,2.5,3.5c-5.25,9-10.5,16.75-18.88,27.62c-7.55,9.81-6.93,12.85,3.25,3.12c14-13.38,20.34-19.76,33.88-32.5c6.38-6,19.39-12.09,18.14,0.88c-1.02,10.63-1.89,22.13-2.29,30.75c-1.02,21.71,11.53,18,20.15,8.63",16.98,40.75)],
  "ろ":[SD("M36.95,21.88c1.5,2,4.62,3.62,8.5,2.5c3.88-1.12,8.12-2.25,14.12-4.38c6-2.13,6.53-0.1,3.38,4.25c-7.88,10.88-18,22.75-27.5,35.25c-7.49,9.86-10.68,11.32,2.88,2.25c17.38-11.62,46.62-14,46.62,8.12c0,15.62-16,22.5-32.12,25.12",36.95,21.88)],
  "わ":[SD("M38.53,14.75c1.5,1.38,2.22,3.73,2,6.38c-1,11.87-2.75,44.49-2.75,52.87c0,8.38-0.62,16.62-0.62,19.5",38.53,14.75), SD("M17.53,40.75c2.12,1.38,3.68,1.3,7.5,0c5.88-2,9.8-3.16,16.25-6c4.25-1.88,6.12,0,2.75,4c-6.72,7.96-13,16.5-22.12,27.88c-7.75,9.66-7.54,12.21,3,2.88c21.88-19.38,49.75-35.62,63.5-21c14.36,15.27,1.62,36.62-23.38,42.62",17.53,40.75)],
  "を":[SD("M28.56,27.87c1.62,1.13,3.17,1.64,6.01,1.12c10.86-1.99,16.74-3.37,24.71-4.72c3.64-0.62,5.65-0.93,8.4-0.75",28.56,27.87), SD("M49.93,14.38c0.75,1,1.48,3.22,0.38,5.62c-4.62,10.12-10,20.75-17.12,30.25c-9.25,12.33-9.25,11.19,2.12,2.5c9-6.88,23.75-12.12,22.88,19.88",49.93,14.38), SD("M83.06,39.88c0.62,1.75,0,4-3,5.75c-3,1.75-49.62,24.16-44.75,38.25c3.28,9.48,17.93,9.12,29.98,7.75c4.48-0.51,9.15-1.12,12.4-1.75",83.06,39.88)],
  "ん":[SD("M56.35,16.5c0.75,1.75,1.13,5.83-0.38,8.25c-7,11.25-27.22,43.47-33.88,54.37c-9,14.75-7.62,16.25,1.5,1.25c17.86-29.36,32-23.76,32-6.75c0,25,19,26.5,34.25-5",56.35,16.5)],
  "が":[SD("M24.62,38.62c1.88,1.62,4.65,2.33,8.62,1c25.5-8.5,29.5-4.13,29.5,7.62c0,9.38-1.24,17.46-4.25,25.25c-7.62,19.76-10.87,17.39-16.12,10.89",24.62,38.62), SD("M48.5,17.5c1,1.38,1.29,4.7,0.5,7.12c-5,15.25-18.02,40.93-19.62,43.88c-3.12,5.75-6.38,11.88-9.38,16.25",48.5,17.5), SD("M77.37,31.62c7.5,6.88,13.25,15.75,15,24.88",77.37,31.62), SD("M80.5,18.25c2.75,1.75,6,5.38,7.75,8.5",80.5,18.25), SD("M86.87,13.38c3.06,1.57,6.68,4.82,8.62,7.62",86.87,13.38)],
  "ぎ":[SD("M30.5,30.5c1.88,0.75,4.64,1.06,5.88,0.88c6.75-1,22.25-4.5,26.5-6c2.17-0.76,3.5-1.25,4.88-2.12",30.5,30.5), SD("M36.25,48.95c2.01,0.85,4.97,1.2,6.29,0.99c7.23-1.13,23.82-5.09,28.37-6.79c2.32-0.86,3.75-1.41,5.22-2.4",36.25,48.95), SD("M42,14.38c1.5,0.88,3.13,2.94,4,5.12c5.5,13.75,16,29.25,26.38,40.75c7.64,8.47,9.12,9.38-6,3.88",42,14.38), SD("M33.75,83.5c10.62,9.75,27.25,8.62,38.12,5",33.75,83.5), SD("M77.37,19c2.75,1.75,6,5.38,7.75,8.5",77.37,19), SD("M83.75,14.12c3.06,1.57,6.68,4.82,8.62,7.62",83.75,14.12)],
  "ぐ":[SD("M60.66,15c0.5,2.12,0.75,5-1,7.38c-6.97,9.46-14.29,19.09-18.62,24.5c-4,5-3.79,7.03-0.88,11c5.5,7.5,12.75,18.75,17.62,27.25c1.48,2.59,2.75,4.75,4.5,8.62",60.66,15), SD("M73.54,30c2.75,1.75,6,5.38,7.75,8.5",73.54,30), SD("M79.91,25.12c3.06,1.57,6.68,4.82,8.62,7.62",79.91,25.12)],
  "ざ":[SD("M27,39.15c2.42,1.33,5.38,1.47,8.32,1.06c8.79-1.24,28.67-8.01,34.15-10.68c2.79-1.36,3.78-1.91,6.28-3.53",27,39.15), SD("M41.5,14.12c1.5,0.88,3.63,2.95,4.5,5.13c5.5,13.75,15.25,27.63,26.88,39.5c7.98,8.15,6.38,10-6,3.12",41.5,14.12), SD("M35.25,80.75c4.5,11.75,20.88,12.5,38.38,7.5",35.25,80.75), SD("M79.88,14.25c2.75,1.75,6,5.38,7.75,8.5",79.88,14.25), SD("M86.25,9.38c3.06,1.57,6.68,4.82,8.62,7.62",86.25,9.38)],
  "ず":[SD("M15.5,37.12c2.88,2.12,6.94,1.51,12.75,0.25c16.12-3.5,36.14-5.38,46.62-6.5c7-0.75,11.88-0.62,17.75,0.12",15.5,37.12), SD("M57.62,13.38c2,1.5,2.75,3.25,2.75,5.88c0,10.38,0,35.12,0,40.75c0,14.62-15.62,16.38-15.62,1.75c0-14.25,18-14.12,18,6.38c0,13.25-7.75,21.5-16,28.38",57.62,13.38), SD("M77,13c2.75,1.75,6,5.38,7.75,8.5",77,13), SD("M83.37,8.12c3.06,1.57,6.68,4.82,8.62,7.62",83.37,8.12)],
  "だ":[SD("M24.38,35.38c1.38,0.62,3.88,1.51,6.38,1.12c6.5-1,16.25-2.88,24.88-4.75c2.64-0.57,5.38-1.5,7.62-2.38",24.38,35.38), SD("M45,16.88c0.75,1.25,0.87,3.62,0.38,5.25c-6.35,20.94-12.75,36.37-18.88,52.37c-1.36,3.56-4.75,11.75-6,14.62",45,16.88), SD("M56.38,53.25c12.38-2.75,18.25-3.7,23.62-3.12c15.12,1.62-1.12,2.25-4.25,4.88",56.38,53.25), SD("M54.13,82.25c4.38,7,14.25,8.12,34.5,5.62",54.13,82.25), SD("M76,22.5c2.75,1.75,6,5.38,7.75,8.5",76,22.5), SD("M82.38,17.62c3.06,1.57,6.68,4.82,8.62,7.62",82.38,17.62)],
  "ぢ":[SD("M24.5,32.88c1.38,0.62,3.88,1.51,6.38,1.12c6.5-1,18.25-4.12,26.88-6c2.64-0.57,5.38-1.5,7.62-2.38",24.5,32.88), SD("M45.63,15.88c0.75,1.25,0.71,3.58,0.38,5.25c-3,15-4.25,22.59-8.38,38.62c-3.26,12.63-5.38,11.13,3.62,4.37c8.29-6.21,19.75-9.5,28.5-9.5c8.62,0,14.58,5.88,14.5,14.5c-0.12,13.5-16.5,20.62-29.88,23.25",45.63,15.88), SD("M74.63,21.75c2.75,1.75,6,5.38,7.75,8.5",74.63,21.75), SD("M81,16.88c3.06,1.57,6.68,4.82,8.62,7.62",81,16.88)],
  "づ":[SD("M14,44.75c1.88,1.62,4.68,2.09,8.12,0.62c17.88-7.62,30-11.12,44.88-10.88c12.56,0.21,22.98,7.17,22.87,19.17c-0.18,18.77-24.75,28.71-45.01,32.08",14,44.75), SD("M81,18c2.75,1.75,6,5.38,7.75,8.5",81,18), SD("M87.38,13.12c3.06,1.57,6.68,4.82,8.62,7.62",87.38,13.12)],
  "で":[SD("M20.5,26.38c1.87,1.62,4.42,1.97,8.12,1.37c21.75-3.5,33-5.12,50.12-8.38c12.34-2.34,13-0.88,0.38,1.38c-17.89,3.19-33.78,19.12-33.78,37.62c0,20.5,17.91,30.25,35.16,30.25",20.5,26.38), SD("M75,41.75c2.75,1.75,6,5.38,7.75,8.5",75,41.75), SD("M81.37,36.88c3.06,1.57,6.68,4.82,8.62,7.62",81.37,36.88)],
  "ど":[SD("M35.5,18.38c1.74,0.74,3.62,2.62,4.12,5.37c0.5,2.75,4.75,25,5.38,28.12",35.5,18.38), SD("M78.12,25.5c0.25,1.88,0.04,4.09-2.25,5.75c-6.37,4.63-13.21,8.49-22.75,15.25c-12.88,9.12-21.62,18.38-21.62,27.5c0,10.12,8.5,13.88,26.88,13.88c6.25,0,14.75-0.12,21.62-1.25",78.12,25.5), SD("M84.24,14.5c2.75,1.75,6,5.38,7.75,8.5",84.24,14.5), SD("M90.62,9.62c3.06,1.57,6.68,4.82,8.62,7.62",90.62,9.62)],
  "ば":[SD("M24.75,17.75c1.25,1.5,1.9,4.25,1.38,6.88c-3.5,17.62-6.98,36.4-4,54.88c2.5,15.5,1.12,2,5.62-6.25",24.75,17.75), SD("M49.88,37.89c2.41,1.57,4.85,2.41,7.8,1.96c9.36-1.43,17.21-3.19,23.15-4.82c3.12-0.86,5.96-1.29,7.8-1.29",49.88,37.89), SD("M69.75,16.5c2.26,2.12,2.88,4.12,2.88,6.5c0,2.38,1.5,38.62,1.5,48c0,22.5-30.62,19.62-30.62,10.5c0-9.75,23.88-5.62,29.5-2.88c5.62,2.74,12,8.25,13.38,9.38",69.75,16.5), SD("M84.75,15.25c2.75,1.75,6,5.38,7.75,8.5",84.75,15.25), SD("M91.13,10.38c3.06,1.57,6.68,4.82,8.62,7.62",91.13,10.38)],
  "び":[SD("M20,25.12c1.25,0.88,3.75,2.25,6.5,1.38c2.75-0.87,7.31-2.38,11.38-4.5c6-3.12,8.42-1.01,4.25,4c-27.13,32.62-23.76,58.5-1.52,62.88c18.07,3.56,37.63-16.38,35.63-56.51c-0.72-14.5-0.17-14.78,4.12-1.75c3.76,11.38,10.26,20.76,16.14,26.5",20,25.12), SD("M86.5,13.5c2.75,1.75,6,5.38,7.75,8.5",86.5,13.5), SD("M92.87,8.62c3.06,1.57,6.68,4.82,8.62,7.62",92.87,8.62)],
  "ぶ":[SD("M42.12,15.62c3.62,3.38,7.5,5.38,12.75,6.12c9.59,1.37,3.5,3.38-1.88,6.12",42.12,15.62), SD("M43.12,46.88c1.88,4.62,7.5,9.41,14.25,17.5c10.62,12.75,0.5,30-19.12,21.62",43.12,46.88), SD("M16.5,73.88c0.75,4,1.88,8.12,5,10.12c1.16,0.74,0.12-3.38,13.25-9.12",16.5,73.88), SD("M79.62,61.88c5.5,3.38,10.28,7.49,11.38,8.88c6.75,8.5-0.25,4.62-4.62,7.12",79.62,61.88), SD("M73.62,16.25c2.75,1.75,6,5.38,7.75,8.5",73.62,16.25), SD("M80,11.38c3.06,1.57,6.68,4.82,8.62,7.62",80,11.38)],
};

// ============================================================
// STROKE ORDER POPUP  (happylilac 形式・静的表示)
// ============================================================
function StrokeOrderGuide({ kana, visible }) {
  const strokes = STROKE_DATA[kana] || [];
  if (!visible || strokes.length === 0) return null;

  return (
    <div style={{
      width:"100%",
      background:"rgba(4,16,4,0.97)",
      border:`1px solid ${C.border}`,
      borderTop:`2px solid ${C.teal}`,
      padding:"10px 8px 14px",
    }}>
      {/* ヘッダー */}
      <div style={{
        fontFamily:"'Press Start 2P',monospace", fontSize:"0.38rem",
        color: C.teal, letterSpacing:"0.05em", marginBottom:8, textAlign:"center",
        textShadow:`0 0 6px ${C.teal}`,
      }}>
        「{kana}」のかきじゅん　{strokes.length}かく
      </div>
      {/* 書き順グリッド */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
        {strokes.map((_, stepIdx) => (
          <div key={stepIdx} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <div style={{
              width:18, height:18,
              background: stepIdx === strokes.length - 1 ? C.primary : "rgba(57,255,20,0.15)",
              border: `1px solid ${stepIdx === strokes.length - 1 ? C.primary : C.border}`,
              color: stepIdx === strokes.length - 1 ? "#fff" : C.text,
              fontSize:"0.5rem", fontFamily:"'Press Start 2P',monospace",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>{stepIdx + 1}</div>
            <div style={{
              width:68, height:68,
              background:"#ddd8d0",
              border: stepIdx === strokes.length - 1 ? `2px solid ${C.primary}` : `1px solid #aaa`,
              overflow:"hidden",
            }}>
              <svg viewBox="0 0 109 109" width="68" height="68">
                {strokes.map((s, i) => i > stepIdx && (
                  <path key={`g${i}`} d={s.d}
                    stroke="#d1d5db" strokeWidth="3.5" fill="none"
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                ))}
                {strokes.slice(0, stepIdx).map((s, i) => (
                  <path key={`p${i}`} d={s.d}
                    stroke="#374151" strokeWidth="4" fill="none"
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                ))}
                <path d={strokes[stepIdx].d}
                  stroke="#e53e3e" strokeWidth="4.5" fill="none"
                  strokeLinecap="round" strokeLinejoin="round"
                />
                <circle cx={strokes[stepIdx].sx} cy={strokes[stepIdx].sy} r="5.5" fill="#e53e3e" />
                <text x={strokes[stepIdx].sx} y={strokes[stepIdx].sy + 4}
                  textAnchor="middle" fill="#fff"
                  fontSize="6.5" fontWeight="bold" fontFamily="monospace"
                >{stepIdx + 1}</text>
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// TRACING CANVAS  (スタイラス・ペン入力)
// ============================================================
function TracingCanvas({ guideKana, onFirstStroke, freeWrite = false }) {
  const canvasRef    = useRef(null);
  const isDrawing    = useRef(false);
  const lastPt       = useRef(null);
  const hasDrawn     = useRef(false);

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
    <div style={{
      position:"relative", width:"100%", aspectRatio:"1/1",
      background:"#ddd8d0",
      borderRadius:14,
      overflow:"hidden",
      border:"2.5px solid rgba(239,68,68,0.65)",
      boxShadow:"0 0 10px rgba(239,68,68,0.18)",
    }}>
      {/* 田字格グリッド + ガイド文字 (KanjiVG SVG) */}
      <svg
        viewBox="0 0 100 100"
        style={{
          position:"absolute", inset:0, zIndex:1,
          width:"100%", height:"100%",
          pointerEvents:"none",
          overflow:"visible",
        }}
      >
        {/* 田字格：縦横中心線 + 外枠 */}
        <rect x="0" y="0" width="100" height="100"
          fill="none" stroke="rgba(120,100,80,0.25)" strokeWidth="0.8"
        />
        <line x1="50" y1="0" x2="50" y2="100"
          stroke="rgba(120,100,80,0.25)" strokeWidth="0.8"
          strokeDasharray="4 3"
        />
        <line x1="0" y1="50" x2="100" y2="50"
          stroke="rgba(120,100,80,0.25)" strokeWidth="0.8"
          strokeDasharray="4 3"
        />

        {/* ガイド文字：KanjiVGパスをスケールして表示 */}
        {!freeWrite && (STROKE_DATA[guideKana] || []).map((s, i) => (
          <path
            key={i}
            d={s.d}
            stroke="rgba(231,19,44,0.38)"
            strokeWidth="4.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            /* KanjiVGは109×109座標系 → 100×100にスケール */
            transform="scale(0.9174)"
          />
        ))}
      </svg>

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
function TokkunScreen({ onHome, kanaMode = "hiragana" }) {
  const srcDeck = kanaMode === "katakana" ? ALL_KATAKANA : ALL_KANA;
  const deck        = useRef([...srcDeck].sort(() => Math.random() - 0.5)).current;
  const [idx,       setIdx]       = useState(0);
  const [done,      setDone]      = useState(false);
  const [hasStroke,   setHasStroke]   = useState(false);
  const [phase,       setPhase]       = useState("idle"); // idle | ok | miss
  const [confettiKey, setConfettiKey] = useState(0);
  const [guideOn,     setGuideOn]     = useState(false);
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
    setGuideOn(false);
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
        position:"relative", zIndex:10, width:"100%",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 16px 6px",
        borderBottom:`1px solid ${C.border}`,
        background:"rgba(4,10,4,0.85)",
      }}>
        <button onClick={onHome} style={{
          background:"rgba(57,255,20,0.05)", border:`1px solid ${C.border}`,
          color: C.text, cursor:"pointer",
          padding:"5px 12px", fontFamily:"'Press Start 2P',monospace", fontSize:"0.4rem",
        }}>◀ もどる</button>
        <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.5rem", letterSpacing:"0.05em", color: C.teal, animation:"amber-flicker 4s linear infinite" }}>
          とっくん
        </div>
        <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.4rem", color: C.gold }}>
          {idx + 1}/{total}
        </div>
      </div>

      {/* ── PROGRESS BAR (ピクセルセグメント) ───── */}
      <div style={{
        position:"relative", zIndex:10, width:"100%",
        padding:"6px 16px 4px",
      }}>
        {(() => {
          const segs = 20;
          const filled = Math.round((progress / 100) * segs);
          return (
            <div style={{ display:"flex", gap:2 }}>
              {Array.from({ length: segs }, (_, i) => (
                <div key={i} style={{
                  flex:1, height:5,
                  background: i < filled ? C.teal : "rgba(0,229,255,0.1)",
                  border: `1px solid ${i < filled ? C.teal : "rgba(0,229,255,0.12)"}`,
                  boxShadow: i < filled ? `0 0 3px ${C.teal}` : "none",
                }} />
              ))}
            </div>
          );
        })()}
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
          {/* 読み方ラベル + 書き順ボタン */}
          <div style={{ width:"min(80vw, 440px)", display:"flex", alignItems:"center", gap:6 }}>
            <div style={{
              flex:1,
              display:"flex", alignItems:"center", gap:8,
              background:"rgba(0,229,255,0.06)",
              border:`1px solid ${C.teal}`,
              padding:"6px 12px",
              boxShadow:`0 0 8px rgba(0,229,255,0.2)`,
            }}>
              <span style={{
                fontFamily:"'Press Start 2P',monospace",
                fontSize:"clamp(0.7rem,3vw,0.9rem)",
                color: C.teal, letterSpacing:"0.08em",
                textShadow:`0 0 10px ${C.teal}`,
              }}>{card.roma}</span>
              <span style={{ color: C.muted, fontFamily:"'Press Start 2P',monospace", fontSize:"0.35rem" }}>
                よみかた
              </span>
              <button
                onClick={() => speak(card.kana, {rate:0.75, pitch:1.1})}
                style={{background:"none",border:"none",cursor:"pointer",fontSize:"1rem",padding:"2px 4px",lineHeight:1}}
              >🔊</button>
            </div>
            {(STROKE_DATA[card.kana] || []).length > 0 && (
              <button
                onClick={() => setGuideOn(v => !v)}
                style={{
                  flexShrink:0,
                  padding:"6px 10px",
                  background: guideOn ? "rgba(0,229,255,0.15)" : "rgba(4,16,4,0.9)",
                  border:`1px solid ${guideOn ? C.teal : C.border}`,
                  color: guideOn ? C.teal : C.muted,
                  fontFamily:"'Press Start 2P',monospace", fontSize:"0.38rem",
                  cursor:"pointer",
                  boxShadow: guideOn ? `0 0 8px rgba(0,229,255,0.3)` : "none",
                }}
              >✍<br/>かきじゅん</button>
            )}
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
                position:"absolute", inset:0, zIndex:20,
                display:"flex", alignItems:"center", justifyContent:"center",
                background: phase === "ok"
                  ? "rgba(57,255,20,0.12)"
                  : "rgba(255,34,34,0.12)",
                border: `2px solid ${phase === "ok" ? C.text : C.primary}`,
                animation:"correctFlash 0.9s ease-out forwards",
                pointerEvents:"none",
              }}>
                <div style={{
                  fontFamily:"'Press Start 2P',monospace",
                  fontSize:"clamp(0.7rem,5vw,1.1rem)",
                  color: phase === "ok" ? C.text : C.primary,
                  textShadow: phase === "ok"
                    ? `0 0 20px ${C.text}`
                    : `0 0 20px ${C.primary}`,
                  letterSpacing:"0.05em",
                  animation:"shuwatchAppear 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
                }}>
                  {phase === "ok" ? "できた！" : "もう一度！"}
                </div>
              </div>
            )}
          </div>

          {/* ヒント */}
          <div style={{
            fontFamily:"'Press Start 2P',monospace", fontSize:"0.35rem",
            color: C.muted, letterSpacing:"0.05em",
            textAlign:"center", animation:"hint-blink 2s step-end infinite",
          }}>
            オレンジのもじをなぞろう
          </div>

          {/* 操作ボタン */}
          <div style={{ display:"flex", gap:8, width:"100%", maxWidth:380, marginTop:4 }}>
            <button
              onClick={clearCanvas}
              disabled={!hasStroke || phase !== "idle"}
              style={{
                flex:1, height:50,
                background:"rgba(4,16,4,0.9)",
                border:`1px solid ${C.border}`,
                borderBottom:`3px solid rgba(57,255,20,0.15)`,
                color: hasStroke && phase === "idle" ? C.text : C.muted,
                fontFamily:"'Press Start 2P',monospace",
                fontSize:"0.45rem", letterSpacing:"0.04em",
                cursor: hasStroke && phase === "idle" ? "pointer" : "default",
                opacity: hasStroke && phase === "idle" ? 1 : 0.35,
                transition:"all 0.15s",
              }}
            >けす</button>
            <button
              onClick={handleJudge}
              disabled={!hasStroke || phase !== "idle"}
              style={{
                flex:2, height:50,
                background: hasStroke && phase === "idle" ? C.primary : "rgba(40,10,10,0.7)",
                border:`2px solid ${hasStroke && phase === "idle" ? "#ff6666" : "rgba(255,34,34,0.2)"}`,
                borderBottom:`4px solid ${hasStroke && phase === "idle" ? "#880000" : "rgba(255,34,34,0.1)"}`,
                color:"#fff",
                fontFamily:"'Press Start 2P',monospace",
                fontSize:"clamp(0.5rem,2.5vw,0.65rem)", letterSpacing:"0.05em",
                cursor: hasStroke && phase === "idle" ? "pointer" : "default",
                opacity: hasStroke && phase === "idle" ? 1 : 0.4,
                boxShadow: hasStroke && phase === "idle" ? `0 0 14px rgba(255,34,34,0.5)` : "none",
                transition:"all 0.15s",
              }}
            >はんてい！</button>
          </div>

          {/* 書き順ガイド（キャンバス直下） */}
          <div style={{ width:"min(80vw, 440px)" }}>
            <StrokeOrderGuide kana={card.kana} visible={guideOn} />
          </div>
        </div>
      )}

      {/* ── DONE OVERLAY ───────────────────────────── */}
      {done && (
        <div style={{
          position:"fixed", inset:0, zIndex:100,
          background:"rgba(0,0,0,0.88)",
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:16,
        }}>
          <div style={{ fontSize:"3rem" }}>⚡</div>
          <div style={{
            fontFamily:"'Press Start 2P',monospace",
            fontSize:"clamp(0.7rem,4vw,1rem)",
            color: C.gold, letterSpacing:"0.05em",
            textShadow:`0 0 20px ${C.gold}`,
            animation:"phosphor-glow 2s ease-in-out infinite",
          }}>とっくん かんりょう！</div>
          <div style={{ color: C.muted, fontFamily:"'Press Start 2P',monospace", fontSize:"0.4rem" }}>
            {total}もじ なぞった！
          </div>
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <button onClick={restart} style={{
              padding:"10px 24px",
              background: C.primary,
              border:"2px solid #ff6666",
              borderBottom:"4px solid #880000",
              color:"#fff",
              fontFamily:"'Press Start 2P',monospace",
              fontSize:"0.55rem", letterSpacing:"0.05em",
              cursor:"pointer", boxShadow:`0 0 14px rgba(255,34,34,0.5)`,
            }}>もういちど</button>
            <button onClick={onHome} style={{
              padding:"10px 24px",
              background:"rgba(4,16,4,0.9)",
              border:`1px solid ${C.border}`,
              borderBottom:`3px solid rgba(57,255,20,0.15)`,
              color: C.muted, fontFamily:"'Press Start 2P',monospace", fontSize:"0.5rem", cursor:"pointer",
            }}>ホームへ</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// KAKITORI SCREEN  (下書きなし書き取り判定 / HARD MODE)
// ============================================================
const KAKITORI_XP = 8; // 1文字成功で獲得するXP

function KakitoriScreen({ onHome, enemy }) {
  const PP = "#dd88ff";
  const PL = "#bb66dd";
  const PD = "#440077";

  const kanaSet     = useRef(kanaOf(enemy.kana)).current;
  const pickKana    = useCallback(() => kanaSet[Math.floor(Math.random() * kanaSet.length)], [kanaSet]);
  const canvasWrapRef = useRef(null);

  const monsterMaxHp = kanaSet.length;

  const [heroHp,    setHeroHp]    = useState(HERO_MAX_HP);
  const [monsterHp, setMonsterHp] = useState(monsterMaxHp);
  const [kana,      setKana]      = useState(pickKana);
  const [phase,     setPhase]     = useState("idle"); // idle|checking|correct|miss|monsterAtk|win|lose
  const [score,     setScore]     = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [hasStroke,   setHasStroke]   = useState(false);
  const [feedback,    setFeedback]    = useState("");
  const [confettiKey, setConfettiKey] = useState(0);
  const [xp,          setXp]          = useState(getXP);
  const [leveledUp,   setLeveledUp]   = useState(false);
  const [peeking,     setPeeking]     = useState(false);
  const [peekLock,    setPeekLock]    = useState(false);
  // 出題済みかなを追跡してすべて正解で勝利
  const answered = useRef(new Set()).current;

  const level       = calcLevel(xp);
  const heroDanger  = heroHp <= 2;
  const isCorrect   = phase === "correct";
  const isMonsterAtk = phase === "monsterAtk";
  const isWin       = phase === "win";
  const isLose      = phase === "lose";

  useEffect(() => { speak(kana.kana, { rate: 0.75, pitch: 1.1 }); }, [kana]);

  const getCanvas = () => canvasWrapRef.current?.querySelector("canvas");

  const goNextKana = useCallback((curMHp, curHHp, curScore) => {
    setFeedback("");
    setHasStroke(false);
    setMissCount(0);
    if (curMHp <= 0) { setPhase("win"); return; }
    if (curHHp <= 0) { setPhase("lose"); return; }
    setPhase("idle");
    // まだ答えていないかなを優先
    const remaining = kanaSet.filter(k => !answered.has(k.kana));
    const next = remaining.length > 0
      ? remaining[Math.floor(Math.random() * remaining.length)]
      : pickKana();
    setKana(next);
  }, [kanaSet, answered, pickKana]);

  const handleJudge = useCallback(() => {
    if (phase !== "idle" || !hasStroke) return;
    setPhase("checking");
    const canvas = getCanvas();
    if (!canvas) { setPhase("idle"); return; }
    let cov = 0;
    try { cov = evalCoverage(kana.kana, canvas); } catch { setPhase("idle"); return; }

    if (cov >= COVERAGE_THRESHOLD) {
      const nextMHp  = monsterHp - 1;
      const newScore = score + 10;
      setMonsterHp(nextMHp);
      setScore(newScore);
      answered.add(kana.kana);
      saveStamp(kana.kana);
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
      setTimeout(() => {
        goNextKana(nextMHp, heroHp, newScore);
        getCanvas()?._clear?.();
      }, 1300);
    } else {
      const newMiss = missCount + 1;
      setMissCount(newMiss);
      if (newMiss >= MAX_MISS) {
        speak(randItem(ENCOURAGE));
        setFeedback("やられた！");
        setPhase("monsterAtk");
        const nextHHp = heroHp - 1;
        setHeroHp(nextHHp);
        setTimeout(() => {
          goNextKana(monsterHp, nextHHp, score);
          getCanvas()?._clear?.();
        }, 1000);
      } else {
        speak(randItem(ENCOURAGE));
        setFeedback(`もう一度！ (${newMiss}/${MAX_MISS})`);
        setPhase("miss");
        setTimeout(() => {
          setPhase("idle"); setFeedback("");
          getCanvas()?._clear?.(); setHasStroke(false);
        }, 900);
      }
    }
  }, [phase, hasStroke, kana, monsterHp, heroHp, missCount, score, goNextKana, answered, xp]);

  const handleClear = () => { if (phase !== "idle") return; getCanvas()?._clear?.(); setHasStroke(false); };

  // チラ見: 1.5秒だけ文字表示
  const handlePeek = () => {
    if (peekLock || peeking || phase !== "idle") return;
    speak(kana.kana, { rate: 0.75, pitch: 1.1 });
    setPeeking(true);
    setTimeout(() => {
      setPeeking(false);
      setPeekLock(true);
      setTimeout(() => setPeekLock(false), 3000);
    }, 1500);
  };

  const restart = () => {
    answered.clear();
    setHeroHp(HERO_MAX_HP); setMonsterHp(monsterMaxHp);
    setScore(0); setPhase("idle"); setMissCount(0);
    setHasStroke(false); setFeedback(""); setLeveledUp(false);
    setXp(getXP()); setKana(pickKana());
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

      {/* チラ見オーバーレイ */}
      {peeking && (
        <div style={{
          position:"fixed", inset:0, zIndex:250, pointerEvents:"none",
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:12,
          background:"rgba(0,0,0,0.88)",
        }}>
          <div style={{
            fontSize:"min(48vw, 220px)",
            fontFamily:"monospace",
            fontWeight:900, color: PP,
            textShadow:`0 0 40px ${PP}`,
            lineHeight:1,
            animation:"shuwatchAppear 0.3s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
          }}>{kana.kana}</div>
          <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"clamp(0.7rem,4vw,1rem)", color: PP, letterSpacing:"0.08em" }}>
            {kana.roma}
          </div>
          <div style={{ color: C.muted, fontFamily:"'Press Start 2P',monospace", fontSize:"0.38rem" }}>おぼえてね！</div>
        </div>
      )}

      {/* HEADER */}
      <div style={{
        position:"relative", zIndex:10, width:"100%",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 16px 6px",
        borderBottom:`1px solid ${C.border}`,
        background:"rgba(4,10,4,0.85)",
      }}>
        <button onClick={onHome} style={{
          background:"rgba(57,255,20,0.05)", border:`1px solid ${C.border}`,
          color: C.text, cursor:"pointer",
          padding:"5px 12px", fontFamily:"'Press Start 2P',monospace", fontSize:"0.4rem",
        }}>◀ もどる</button>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.35rem", color: PP, letterSpacing:"0.1em" }}>⚔ HARD MODE</div>
          <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.4rem", color: C.gold }}>
            SCORE <span style={{ color: C.gold }}>{score}</span>
          </div>
        </div>
        <ColorTimer danger={heroDanger} />
      </div>

      {/* HP BARS */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:520,
        padding:"0 20px", display:"flex", gap:12,
      }}>
        <div style={{ flex:1 }}>
          <HPBar hp={heroHp}    maxHp={HERO_MAX_HP}    label="⚡ ゆずき" />
        </div>
        <div style={{ flex:1 }}>
          <HPBar hp={monsterHp} maxHp={monsterMaxHp} label={`🦖 ${enemy.name}`} />
        </div>
      </div>

      {/* ARENA */}
      <div style={{
        position:"relative", zIndex:10, width:"100%",
        padding:"6px 16px 0",
      }}>
        <div style={{
          position:"relative", height:"min(36vw, 160px)",
          background:"linear-gradient(180deg, #010a01 0%, #020d02 100%)",
          border:`1px solid ${C.border}`,
          boxShadow:`inset 0 0 16px rgba(57,255,20,0.04)`,
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
              background:"rgba(168,85,247,0.15)",
              animation:"correctFlash 1s ease-out forwards",
            }} />
          )}
          {/* feedback */}
          {feedback && (
            <div style={{
              position:"absolute", inset:0, zIndex:6, pointerEvents:"none",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <div style={{
                fontFamily:"'Press Start 2P',monospace",
                fontSize:"clamp(0.6rem,3.5vw,0.9rem)",
                color: isCorrect ? C.gold : C.primary,
                textShadow: isCorrect ? `0 0 16px ${C.gold}` : `0 0 16px ${C.primary}`,
                letterSpacing:"0.05em",
                animation:"shuwatchAppear 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
              }}>{feedback}</div>
            </div>
          )}
          {/* ヒーロー */}
          <div style={{
            filter: isLose ? "grayscale(1) opacity(0.3)"
              : heroDanger ? "drop-shadow(0 0 14px rgba(255,80,80,0.9))"
              : "drop-shadow(0 0 12px rgba(168,85,247,0.8))",
            animation: isLose ? "none"
              : isMonsterAtk ? "wrongShake 0.45s ease-out"
              : "heroFloat 3s ease-in-out infinite",
          }}>
            <HeroImg size={Math.min(window.innerWidth * 0.2, 88)} mode={isCorrect ? "kougeki" : "migi"}/>
          </div>
          {/* ビーム (紫) */}
          {isCorrect && (
            <div style={{
              position:"absolute",
              left:"clamp(55px,16vw,95px)",
              right:"clamp(55px,16vw,95px)",
              top:"50%", transform:"translateY(-50%)",
              height:6, borderRadius:3,
              background:`linear-gradient(90deg, ${PP}, ${C.teal}, ${PP})`,
              boxShadow:`0 0 16px ${PP}, 0 0 30px ${C.teal}`,
              animation:"beamShoot 0.8s ease-out forwards",
              transformOrigin:"left center",
              zIndex:4,
            }} />
          )}
          {/* モンスター */}
          <div style={{
            filter: isWin ? "grayscale(1) opacity(0)" : `drop-shadow(0 0 14px ${enemy.color}99)`,
            animation: isWin ? "monsterDead 0.7s ease-out forwards"
              : isCorrect ? "monsterHit 0.6s ease-out"
              : "heroFloat 2.5s ease-in-out 0.4s infinite",
          }}>
            <enemy.Svg size={Math.min(window.innerWidth * 0.22, 96)}/>
          </div>
        </div>
      </div>

      {/* 書き取りエリア */}
      <div style={{
        position:"relative", zIndex:10, width:"100%",
        padding:"8px 16px 0",
        display:"flex", flexDirection:"column", alignItems:"center", gap:8,
        flex:1,
      }}>
        {/* 読み方ラベル */}
        <div style={{
          display:"flex", alignItems:"center", gap:8,
          background:`${PP}0a`,
          border:`1px solid ${PP}`,
          padding:"6px 16px",
          boxShadow:`0 0 8px ${PP}33`,
        }}>
          <span style={{
            fontFamily:"'Press Start 2P',monospace",
            fontSize:"clamp(0.7rem,3vw,0.9rem)",
            color: PP, letterSpacing:"0.08em",
            textShadow:`0 0 10px ${PP}`,
          }}>{kana.roma}</span>
          <span style={{ color: C.muted, fontFamily:"'Press Start 2P',monospace", fontSize:"0.38rem" }}>
            かけ！
          </span>
          <button
            onClick={() => speak(kana.kana, {rate:0.75, pitch:1.1})}
            style={{background:"none",border:"none",cursor:"pointer",fontSize:"1rem",padding:"2px 4px",lineHeight:1}}
          >🔊</button>
        </div>

        {/* キャンバス */}
        <div ref={canvasWrapRef} style={{ width:"min(68vw, 320px)" }}>
          <TracingCanvas
            guideKana={kana.kana}
            onFirstStroke={() => setHasStroke(true)}
            showStrokeBtn={false}
            freeWrite={true}
          />
        </div>

        {/* ミス残り */}
        {missCount > 0 && phase === "idle" && (
          <div style={{ display:"flex", gap:5 }}>
            {Array.from({ length: MAX_MISS }).map((_, i) => (
              <div key={i} style={{
                width:10, height:10,
                background: i < missCount ? C.primary : "rgba(255,34,34,0.15)",
                border: `1px solid ${i < missCount ? C.primary : "rgba(255,34,34,0.3)"}`,
                boxShadow: i < missCount ? `0 0 6px ${C.primary}` : "none",
              }} />
            ))}
          </div>
        )}

        {/* ボタン */}
        <div style={{ display:"flex", gap:8, width:"100%", maxWidth:380 }}>
          <button onClick={handleClear} disabled={!hasStroke || phase !== "idle"}
            style={{
              flex:1, height:50,
              background:"rgba(4,16,4,0.9)",
              border:`1px solid ${C.border}`,
              borderBottom:`3px solid rgba(57,255,20,0.15)`,
              color: hasStroke && phase === "idle" ? C.text : C.muted,
              fontFamily:"'Press Start 2P',monospace",
              fontSize:"0.45rem", letterSpacing:"0.04em",
              cursor: hasStroke && phase === "idle" ? "pointer" : "default",
              opacity: hasStroke && phase === "idle" ? 1 : 0.35,
              transition:"all 0.15s",
            }}>けす</button>

          <button onClick={handleJudge} disabled={!hasStroke || phase !== "idle"}
            style={{
              flex:2, height:50,
              background: hasStroke && phase === "idle" ? PD : "rgba(20,10,40,0.7)",
              border:`2px solid ${hasStroke && phase === "idle" ? PP : `${PP}33`}`,
              borderBottom:`4px solid ${hasStroke && phase === "idle" ? "#220033" : `${PP}11`}`,
              color: hasStroke && phase === "idle" ? PP : C.muted,
              fontFamily:"'Press Start 2P',monospace",
              fontSize:"clamp(0.5rem,2.5vw,0.65rem)", letterSpacing:"0.05em",
              cursor: hasStroke && phase === "idle" ? "pointer" : "default",
              opacity: hasStroke && phase === "idle" ? 1 : 0.4,
              boxShadow: hasStroke && phase === "idle" ? `0 0 14px ${PP}66` : "none",
              transition:"all 0.15s",
            }}>はんてい！</button>

          <button onClick={handlePeek} disabled={peekLock || peeking || phase !== "idle"}
            style={{
              flex:1, height:50,
              background: peekLock ? "rgba(4,16,4,0.9)" : `${PP}15`,
              border:`1px solid ${peekLock ? `${PP}22` : `${PP}88`}`,
              borderBottom:`3px solid ${peekLock ? `${PP}11` : `${PP}44`}`,
              color: peekLock ? C.muted : PP,
              fontFamily:"'Press Start 2P',monospace",
              fontSize:"0.5rem", letterSpacing:"0.03em",
              cursor: (peekLock || peeking || phase !== "idle") ? "default" : "pointer",
              opacity: phase !== "idle" ? 0.35 : 1,
              transition:"all 0.15s",
            }}>{peekLock ? "⏳" : "👁"}</button>
        </div>
      </div>

      <div style={{ height:16 }} />

      {/* WIN / LOSE OVERLAY */}
      {(isWin || isLose) && (
        <div style={{
          position:"fixed", inset:0, zIndex:100,
          background:"rgba(0,0,0,0.88)",
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:16,
        }}>
          <div style={{
            fontSize:"clamp(2.5rem,12vw,4rem)",
            animation:"shuwatchAppear 0.55s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
          }}>{isWin ? "🏆" : "💀"}</div>
          <div style={{
            fontFamily:"'Press Start 2P',monospace",
            fontSize:"clamp(0.65rem,4vw,0.9rem)",
            color: isWin ? PP : C.primary,
            textShadow: isWin ? `0 0 20px ${PP}` : `0 0 20px ${C.primary}`,
            letterSpacing:"0.05em",
            animation:"phosphor-glow 2s ease-in-out infinite",
          }}>{isWin ? "かきとり かんりょう！" : "やられた…"}</div>
          <div style={{ color: C.muted, fontFamily:"'Press Start 2P',monospace", fontSize:"0.4rem" }}>
            SCORE <span style={{ color: C.gold }}>{score}</span>
            {isWin && <span style={{ color: PP, marginLeft:8 }}>+{score} XP</span>}
          </div>
          {isWin && leveledUp && (
            <div style={{
              background:"rgba(4,10,4,0.95)",
              border:`2px solid ${PP}`,
              padding:"8px 24px",
              fontFamily:"'Press Start 2P',monospace",
              fontSize:"clamp(0.5rem,3vw,0.7rem)",
              color: PP, letterSpacing:"0.05em",
              boxShadow:`0 0 24px ${PP}66`,
              animation:"levelUpBadge 0.5s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
            }}>▲ LEVEL UP! Lv.{calcLevel(xp)}</div>
          )}
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <button onClick={restart} style={{
              padding:"10px 24px",
              background: PD,
              border:`2px solid ${PP}`,
              borderBottom:`4px solid #110022`,
              color: PP,
              fontFamily:"'Press Start 2P',monospace",
              fontSize:"0.55rem", letterSpacing:"0.05em",
              cursor:"pointer", boxShadow:`0 0 14px ${PP}66`,
            }}>もういちど</button>
            <button onClick={onHome} style={{
              padding:"10px 24px",
              background:"rgba(4,16,4,0.9)",
              border:`1px solid ${C.border}`,
              borderBottom:`3px solid rgba(57,255,20,0.15)`,
              color: C.muted, fontFamily:"'Press Start 2P',monospace", fontSize:"0.5rem", cursor:"pointer",
            }}>ホームへ</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// KAKITORI SELECT SCREEN  (かきとりバトル / HARD MODE)
// ============================================================
function KakitoriSelectScreen({ onSelect, onHome, kanaMode = "hiragana" }) {
  const PP = "#dd88ff";
  const enemies = kanaMode === "katakana" ? KATAKANA_ENEMY_DEFS : ENEMY_DEFS;
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
        position:"relative", zIndex:10, width:"100%",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 16px 6px",
        borderBottom:`1px solid ${C.border}`,
        background:"rgba(4,10,4,0.85)",
      }}>
        <button onClick={onHome} style={{
          background:"rgba(57,255,20,0.05)", border:`1px solid ${C.border}`,
          color: C.text, cursor:"pointer",
          padding:"5px 12px", fontFamily:"'Press Start 2P',monospace", fontSize:"0.4rem",
        }}>◀ もどる</button>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.38rem", color: PP, letterSpacing:"0.1em", marginBottom:3 }}>⚔ HARD MODE</div>
          <div style={{
            fontFamily:"'Press Start 2P',monospace",
            fontSize:"clamp(0.5rem,2.5vw,0.65rem)",
            color: PP, letterSpacing:"0.05em",
            textShadow:`0 0 10px rgba(221,136,255,0.6)`,
          }}>かきとりばとる</div>
        </div>
        <div style={{ width:60 }} />
      </div>

      {/* description */}
      <div style={{
        position:"relative", zIndex:10, width:"100%",
        padding:"8px 16px 6px",
      }}>
        <div style={{
          background:"rgba(44,0,66,0.3)",
          border:`1px solid ${PP}44`,
          padding:"7px 12px",
          fontFamily:"'Press Start 2P',monospace", fontSize:"0.38rem",
          color: PP, letterSpacing:"0.04em", lineHeight:1.8,
        }}>
          ★ ガイドなし！こえをよくきいてもじをかこう
        </div>
      </div>

      {/* enemy cards */}
      <div style={{
        position:"relative", zIndex:10,
        width:"100%",
        padding:"4px 16px 24px",
        display:"flex", flexDirection:"column", gap:8,
        overflowY:"auto", flex:1,
      }}>
        {enemies.map((enemy, i) => (
          <button
            key={enemy.id}
            onClick={() => onSelect(enemy)}
            style={{
              width:"100%",
              background:"rgba(4,10,4,0.9)",
              border:`1px solid ${i === 0 ? PP : C.border}`,
              borderLeft:`3px solid ${i === 0 ? PP : C.border}`,
              padding:"10px 12px",
              cursor:"pointer",
              display:"flex", alignItems:"center", gap:12,
              boxShadow: i === 0 ? `0 0 12px ${PP}44` : "none",
              transition:"all 0.12s",
              textAlign:"left",
              position:"relative",
            }}
          >
            {i === 0 && (
              <div style={{
                position:"absolute", top:6, right:8,
                background: PP, padding:"2px 7px",
                fontFamily:"'Press Start 2P',monospace", fontSize:"0.32rem", color:"#000",
                letterSpacing:"0.05em",
              }}>さいしょ</div>
            )}
            <div style={{
              position:"absolute", bottom:6, right:8,
              border:`1px solid ${PP}66`,
              padding:"2px 7px",
              fontFamily:"'Press Start 2P',monospace", fontSize:"0.3rem",
              color: PP, letterSpacing:"0.04em",
            }}>NO GUIDE</div>

            <div style={{ flexShrink:0, filter:`drop-shadow(0 0 6px ${PP}88)` }}>
              <enemy.Svg size={52}/>
            </div>

            <div style={{ flex:1, display:"flex", flexDirection:"column", gap:5 }}>
              <div style={{
                fontFamily:"'Press Start 2P',monospace",
                fontSize:"clamp(0.5rem,2.5vw,0.65rem)",
                color: C.text, letterSpacing:"0.04em",
              }}>{enemy.name}</div>
              <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.32rem", color: C.muted }}>{enemy.desc}</div>
              {enemy.row && (
                <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.35rem", color: PP }}>{enemy.row}</div>
              )}
              <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                {enemy.kana.map(k => (
                  <div key={k} style={{
                    width:34, height:34,
                    background:`${PP}18`,
                    border:`1px solid ${PP}55`,
                    display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center",
                  }}>
                    <div style={{ fontFamily:"monospace", fontWeight:900, fontSize:"1rem", color: C.text, lineHeight:1 }}>{k}</div>
                    <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.28rem", color: PP }}>
                      {ALL_KANA.find(a => a.kana === k)?.roma}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ color: PP, fontSize:"1.2rem", flexShrink:0 }}>›</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ENEMY SELECT SCREEN  (てきをえらべ！)
// ============================================================
function EnemySelectScreen({ onSelect, onHome, kanaMode = "hiragana" }) {
  const enemies = kanaMode === "katakana" ? KATAKANA_ENEMY_DEFS : ENEMY_DEFS;
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
        position:"relative", zIndex:10, width:"100%",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 16px 6px",
        borderBottom:`1px solid ${C.border}`,
        background:"rgba(4,10,4,0.85)",
      }}>
        <button onClick={onHome} style={{
          background:"rgba(57,255,20,0.05)", border:`1px solid ${C.border}`,
          color: C.text, cursor:"pointer",
          padding:"5px 12px", fontFamily:"'Press Start 2P',monospace", fontSize:"0.4rem",
        }}>◀ もどる</button>
        <div style={{
          fontFamily:"'Press Start 2P',monospace",
          fontSize:"clamp(0.5rem,2.5vw,0.65rem)",
          color: C.primary, letterSpacing:"0.05em",
          textShadow:`0 0 10px ${C.primary}`,
          animation:"phosphor-glow 3s ease-in-out infinite",
        }}>てきをえらべ！</div>
        <div style={{ width:60 }} />
      </div>

      {/* enemy cards */}
      <div style={{
        position:"relative", zIndex:10,
        width:"100%",
        padding:"8px 16px 24px",
        display:"flex", flexDirection:"column", gap:8,
        overflowY:"auto", flex:1,
      }}>
        {enemies.map((enemy, i) => (
          <button
            key={enemy.id}
            onClick={() => onSelect(enemy)}
            style={{
              width:"100%",
              background:"rgba(4,10,4,0.9)",
              border:`1px solid ${i === 0 ? enemy.color : C.border}`,
              borderLeft:`3px solid ${i === 0 ? enemy.color : C.border}`,
              padding:"10px 12px",
              cursor:"pointer",
              display:"flex", alignItems:"center", gap:12,
              boxShadow: i === 0 ? `0 0 12px ${enemy.color}44` : "none",
              transition:"all 0.12s",
              textAlign:"left",
              position:"relative",
            }}
          >
            {i === 0 && (
              <div style={{
                position:"absolute", top:6, right:8,
                background: enemy.color, padding:"2px 7px",
                fontFamily:"'Press Start 2P',monospace", fontSize:"0.32rem", color:"#000",
                letterSpacing:"0.05em",
              }}>さいしょ</div>
            )}

            <div style={{
              flexShrink:0,
              filter:`drop-shadow(0 0 6px ${enemy.color}88)`,
            }}>
              <enemy.Svg size={52}/>
            </div>

            <div style={{ flex:1, display:"flex", flexDirection:"column", gap:5 }}>
              <div style={{
                fontFamily:"'Press Start 2P',monospace",
                fontSize:"clamp(0.5rem,2.5vw,0.65rem)",
                color: C.text, letterSpacing:"0.04em",
              }}>{enemy.name}</div>
              <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.32rem", color: C.muted }}>{enemy.desc}</div>
              {enemy.row && (
                <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.35rem", color: enemy.color }}>{enemy.row}</div>
              )}
              <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                {enemy.kana.map(k => (
                  <div key={k} style={{
                    width:34, height:34,
                    background:`${enemy.color}18`,
                    border:`1px solid ${enemy.color}55`,
                    display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center",
                  }}>
                    <div style={{ fontFamily:"monospace", fontWeight:900, fontSize:"1rem", color: C.text, lineHeight:1 }}>{k}</div>
                    <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.28rem", color: enemy.color }}>
                      {ALL_KANA.find(a => a.kana === k)?.roma}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ color: enemy.color, fontSize:"1.2rem", flexShrink:0 }}>›</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ZUKAN SCREEN  (50音ずかん)
// ============================================================
function ZukanScreen({ onHome, kanaMode = "hiragana" }) {
  const [selected, setSelected] = useState(null);
  const [stamps,   setStamps]   = useState(() => getStamps());
  const [tab,      setTab]      = useState("kana"); // "kana" | "stamp"

  const handleKanaTap = (kana, roma) => {
    setSelected(prev => prev?.kana === kana ? null : { kana, roma });
    speak(kana, { rate: 0.75, pitch: 1.1 });
  };

  const TAB = (active) => ({
    flex:1, padding:"9px 0", background: active ? "rgba(57,255,20,0.07)" : "transparent", border:"none",
    borderBottom: active ? `2px solid ${C.text}` : `2px solid ${C.border}`,
    color: active ? C.text : C.muted,
    fontFamily:"'Press Start 2P',monospace",
    fontSize:"0.4rem", letterSpacing:"0.04em",
    cursor:"pointer", transition:"all 0.15s",
    textShadow: active ? `0 0 6px ${C.text}` : "none",
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
        position:"relative", zIndex:10, width:"100%",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 16px 6px",
        borderBottom:`1px solid ${C.border}`,
        background:"rgba(4,10,4,0.85)",
      }}>
        <button onClick={onHome} style={{
          background:"rgba(57,255,20,0.05)", border:`1px solid ${C.border}`,
          color: C.text, cursor:"pointer",
          padding:"5px 12px", fontFamily:"'Press Start 2P',monospace", fontSize:"0.4rem",
        }}>◀ もどる</button>
        <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.45rem", letterSpacing:"0.05em", color: C.teal, animation:"amber-flicker 5s linear infinite" }}>
          {tab === "kana" ? (kanaMode === "katakana" ? "カタカナずかん" : "ひらがなずかん") : "スタンプちょう"}
        </div>
        <div style={{ width:60 }} />
      </div>

      {/* tabs */}
      <div style={{
        position:"relative", zIndex:10, width:"100%",
        display:"flex", padding:"0",
        background:"rgba(4,10,4,0.7)",
      }}>
        <button style={TAB(tab === "kana")}  onClick={() => setTab("kana")}>📖 ずかん</button>
        <button style={TAB(tab === "stamp")} onClick={() => { setStamps(getStamps()); setTab("stamp"); }}>
          ⭐ スタンプ({stamps.size}/{kanaMode === "katakana" ? ALL_KATAKANA.length : ALL_KANA.length})
        </button>
      </div>

      {/* ── KANA TAB ─────────────────────────────── */}
      {tab === "kana" && (
        <div style={{
          position:"relative", zIndex:10, width:"100%",
          padding:"8px 12px 120px", overflowY:"auto",
          display:"flex", flexDirection:"column", gap:8,
        }}>
          {(kanaMode === "katakana" ? KATAKANA_ROWS : HIRAGANA_ROWS).map((row) => (
            <div key={row.row}>
              <div style={{
                fontFamily:"'Press Start 2P',monospace", fontSize:"0.38rem", color: C.gold,
                letterSpacing:"0.1em", marginBottom:4, paddingLeft:4,
              }}>{row.row}</div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {row.kana.map((kana, i) => {
                  const roma = row.roma[i];
                  const isSel    = selected?.kana === kana;
                  const hasStamp = stamps.has(kana);
                  return (
                    <button
                      key={kana}
                      onClick={() => handleKanaTap(kana, roma)}
                      style={{
                        width:"clamp(50px,17vw,68px)", height:"clamp(54px,18vw,72px)",
                        position:"relative",
                        background: isSel
                          ? "rgba(57,255,20,0.12)"
                          : "rgba(4,16,4,0.88)",
                        border: isSel ? `2px solid ${C.text}` : `1px solid ${C.border}`,
                        borderBottom: isSel ? `3px solid #006600` : `2px solid rgba(57,255,20,0.1)`,
                        cursor:"pointer",
                        display:"flex", flexDirection:"column",
                        alignItems:"center", justifyContent:"center", gap:3,
                        boxShadow: isSel ? `0 0 12px rgba(57,255,20,0.4)` : "none",
                        transition:"all 0.12s",
                      }}
                    >
                      {hasStamp && (
                        <span style={{position:"absolute",top:2,right:2,fontSize:"0.5rem",lineHeight:1}}>⭐</span>
                      )}
                      <div style={{
                        fontFamily:"monospace",
                        fontWeight:900, fontSize:"clamp(1.3rem,5vw,1.8rem)",
                        color: isSel ? C.text : "#88aa88",
                        textShadow: isSel ? `0 0 8px ${C.text}` : "none",
                        lineHeight:1,
                      }}>{kana}</div>
                      <div style={{
                        fontFamily:"'Press Start 2P',monospace", fontSize:"clamp(0.3rem,1.5vw,0.4rem)",
                        color: isSel ? C.teal : C.muted, letterSpacing:"0.03em",
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
          position:"relative", zIndex:10, width:"100%",
          padding:"12px 14px 32px", overflowY:"auto", flex:1,
        }}>
          {/* progress (ピクセルセグメント) */}
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
              <span style={{
                fontFamily:"'Press Start 2P',monospace",
                fontSize:"0.45rem", color: C.gold,
              }}>{stamps.size} もじ あつめた！</span>
              <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"0.38rem", color: C.muted }}>
                / {kanaMode === "katakana" ? ALL_KATAKANA.length : ALL_KANA.length}
              </span>
            </div>
            {(() => {
              const segs = 20;
              const totalKana = kanaMode === "katakana" ? ALL_KATAKANA.length : ALL_KANA.length;
              const filled = Math.round((stamps.size / totalKana) * segs);
              return (
                <div style={{ display:"flex", gap:2 }}>
                  {Array.from({ length: segs }, (_, i) => (
                    <div key={i} style={{
                      flex:1, height:6,
                      background: i < filled ? C.gold : "rgba(255,184,0,0.1)",
                      border: `1px solid ${i < filled ? C.gold : "rgba(255,184,0,0.15)"}`,
                      boxShadow: i < filled ? `0 0 3px ${C.gold}` : "none",
                    }} />
                  ))}
                </div>
              );
            })()}
          </div>

          {/* stamp grid */}
          <div style={{display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center"}}>
            {(kanaMode === "katakana" ? ALL_KATAKANA : ALL_KANA).map(({kana, roma}) => {
              const collected = stamps.has(kana);
              return (
                <div
                  key={kana}
                  onClick={() => collected && speak(kana, {rate:0.75, pitch:1.1})}
                  style={{
                    width:52, height:62,
                    background: collected ? "rgba(60,40,0,0.9)" : "rgba(4,16,4,0.8)",
                    border: collected
                      ? `2px solid ${C.gold}`
                      : `1px solid ${C.border}`,
                    borderBottom: collected ? `3px solid #664400` : `2px solid rgba(57,255,20,0.1)`,
                    display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center", gap:2,
                    boxShadow: collected ? `0 0 10px rgba(255,184,0,0.4)` : "none",
                    cursor: collected ? "pointer" : "default",
                    animation: collected ? "stampPop 0.4s ease-out" : "none",
                    transition:"box-shadow 0.2s",
                  }}
                >
                  <div style={{
                    fontFamily:"monospace",
                    fontWeight:900, fontSize:"1.5rem", lineHeight:1,
                    color: collected ? C.gold : "rgba(57,255,20,0.15)",
                  }}>
                    {collected ? kana : "？"}
                  </div>
                  <div style={{
                    fontFamily:"'Press Start 2P',monospace", fontSize:"0.3rem",
                    color: collected ? "#cc8800" : "rgba(57,255,20,0.1)",
                    letterSpacing:"0.02em",
                  }}>
                    {collected ? roma : "···"}
                  </div>
                </div>
              );
            })}
          </div>

          {stamps.size === (kanaMode === "katakana" ? ALL_KATAKANA.length : ALL_KANA.length) && (
            <div style={{
              textAlign:"center", marginTop:20,
              fontFamily:"'Press Start 2P',monospace",
              fontSize:"0.6rem",
              color: C.gold, textShadow:`0 0 16px ${C.gold}`,
              animation:"phosphor-glow 2s ease-in-out infinite",
            }}>🏆 ぜんぶ あつめた！</div>
          )}
        </div>
      )}

      {/* selected popup — kana tab only */}
      {tab === "kana" && selected && (
        <div style={{
          position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)",
          zIndex:50,
          background:"rgba(4,10,4,0.97)",
          border:`2px solid ${C.text}`,
          borderBottom:`4px solid #006600`,
          boxShadow:`0 0 24px rgba(57,255,20,0.4)`,
          padding:"14px 32px",
          display:"flex", flexDirection:"column", alignItems:"center", gap:6,
          minWidth:160,
        }}>
          <div style={{
            fontSize:"clamp(3rem,12vw,4rem)",
            fontFamily:"monospace",
            fontWeight:900, color: C.text,
            textShadow:`0 0 20px ${C.text}`, lineHeight:1,
          }}>{selected.kana}</div>
          <div style={{
            fontFamily:"'Press Start 2P',monospace", fontSize:"clamp(0.7rem,3vw,0.9rem)",
            color: C.teal, letterSpacing:"0.08em",
            textShadow:`0 0 10px ${C.teal}`,
          }}>{selected.roma}</div>
          <button
            onClick={() => speak(selected.kana, {rate:0.75, pitch:1.1})}
            style={{
              marginTop:4, padding:"5px 18px",
              background:`rgba(0,229,255,0.08)`, border:`1px solid ${C.teal}`,
              color: C.teal,
              fontFamily:"'Press Start 2P',monospace", fontSize:"0.38rem",
              cursor:"pointer", letterSpacing:"0.05em",
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
  const [screen,        setScreen]        = useState("home");
  const [prevScr,       setPrevScr]       = useState(null);
  const [kanaMode,      setKanaMode]      = useState("hiragana"); // "hiragana" | "katakana"
  const [enemy,         setEnemy]         = useState(ENEMY_DEFS[0]);
  const [kakitoriEnemy, setKakitoriEnemy] = useState(ENEMY_DEFS[0]);

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
    <div onContextMenu={(e) => e.preventDefault()} style={{ background:"#000", minHeight:"100dvh" }}>
      <style>{GLOBAL_CSS + TRANSITION_CSS}</style>
      <div className="arcade-cabinet">
      <ScreenTransition screenKey={screen}>
        {screen === "home"   && (
          <HomeScreen
            onBattle         ={() => go("enemySelect")}
            onTokkun         ={() => go("tokkun")}
            onZukan          ={() => go("zukan")}
            onKakitori       ={() => go("kakitori_select")}
            kanaMode         ={kanaMode}
            onToggleKanaMode ={() => setKanaMode(m => m === "hiragana" ? "katakana" : "hiragana")}
          />
        )}
        {screen === "enemySelect" && (
          <EnemySelectScreen
            onHome={() => go("home")}
            onSelect={(e) => { setEnemy(e); go("battle"); }}
            kanaMode={kanaMode}
          />
        )}
        {screen === "battle" && <BattleScreen onHome={() => go("home")} enemy={enemy} />}
        {screen === "kakitori_select" && (
          <KakitoriSelectScreen
            onHome={() => go("home")}
            onSelect={(e) => { setKakitoriEnemy(e); go("kakitori"); }}
            kanaMode={kanaMode}
          />
        )}
        {screen === "kakitori" && <KakitoriScreen onHome={() => go("home")} enemy={kakitoriEnemy} />}
        {screen === "tokkun"   && <TokkunScreen   onHome={() => go("home")} kanaMode={kanaMode} />}
        {screen === "zukan"    && <ZukanScreen    onHome={() => go("home")} kanaMode={kanaMode} />}
      </ScreenTransition>
      </div>
    </div>
  );
}
