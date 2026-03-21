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
            {/* hero emoji */}
            <div style={{
              fontSize:"clamp(5rem, 20vw, 8.5rem)",
              filter:"drop-shadow(0 0 18px rgba(239,68,68,0.7))",
              animation:"heroFloat 3s ease-in-out infinite",
              userSelect:"none",
            }}>
              🦸
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
const HERO_MAX_HP  = 5;
const MONSTER_MAX_HP = 6;

function makeQuestion(pool) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const correct  = shuffled[0];
  // wrong choices: 3 from whole ALL_KANA set (exclude correct)
  const wrongs = ALL_KANA.filter(k => k.roma !== correct.roma)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  return {
    kana:    correct.kana,
    answer:  correct.roma,
    options: [correct, ...wrongs].sort(() => Math.random() - 0.5).map(k => k.roma),
  };
}

function BattleScreen({ onHome }) {
  const monsterEmoji = useRef(MONSTERS[Math.floor(Math.random() * MONSTERS.length)]).current;
  const pool         = useRef(ALL_KANA).current;

  const [heroHp,    setHeroHp]    = useState(HERO_MAX_HP);
  const [monsterHp, setMonsterHp] = useState(MONSTER_MAX_HP);
  const [question,  setQuestion]  = useState(() => makeQuestion(pool));
  const [phase,     setPhase]     = useState("idle"); // idle | correct | wrong | win | lose
  const [score,     setScore]     = useState(0);
  const [flash,     setFlash]     = useState(null);  // "correct" | "wrong" | null

  const nextQuestion = useCallback(() => {
    setQuestion(makeQuestion(pool));
    setPhase("idle");
    setFlash(null);
  }, [pool]);

  const handleAnswer = useCallback((chosen) => {
    if (phase !== "idle") return;

    if (chosen === question.answer) {
      // ─ correct ─
      setFlash("correct");
      setPhase("correct");
      const nextMHp = monsterHp - 1;
      setMonsterHp(nextMHp);
      setScore(s => s + 10);
      if (nextMHp <= 0) {
        setTimeout(() => setPhase("win"), 700);
      } else {
        setTimeout(nextQuestion, 900);
      }
    } else {
      // ─ wrong ─
      setFlash("wrong");
      setPhase("wrong");
      const nextHHp = heroHp - 1;
      setHeroHp(nextHHp);
      if (nextHHp <= 0) {
        setTimeout(() => setPhase("lose"), 700);
      } else {
        setTimeout(nextQuestion, 900);
      }
    }
  }, [phase, question, monsterHp, heroHp, nextQuestion]);

  const restart = () => {
    setHeroHp(HERO_MAX_HP);
    setMonsterHp(MONSTER_MAX_HP);
    setScore(0);
    setQuestion(makeQuestion(pool));
    setPhase("idle");
    setFlash(null);
  };

  const heroDanger   = heroHp <= 2;
  const monsterDead  = phase === "win";
  const heroDead     = phase === "lose";

  // option button color
  const optionStyle = (opt) => {
    if (phase === "idle") return {};
    if (opt === question.answer && (phase === "correct" || phase === "wrong")) {
      return { background:"rgba(34,197,94,0.3)", borderColor:"#22c55e", color:"#86efac" };
    }
    return {};
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
        position:"relative", zIndex:10, width:"100%", maxWidth:480,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 20px 6px",
      }}>
        <button
          onClick={onHome}
          style={{
            background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)",
            borderRadius:8, color:C.primary, cursor:"pointer",
            padding:"6px 14px", fontFamily:"monospace", fontSize:"0.75rem", letterSpacing:"0.08em",
          }}
        >
          ← もどる
        </button>
        <div style={{
          fontFamily:"monospace", fontSize:"0.75rem", color: C.muted, letterSpacing:"0.1em",
        }}>
          スコア: <span style={{ color: C.gold, fontWeight:900 }}>{score}</span>
        </div>
        <ColorTimer danger={heroDanger} />
      </div>

      {/* ── ARENA ──────────────────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:480,
        padding:"0 20px", marginTop:4,
        display:"flex", flexDirection:"column", gap:8,
      }}>
        {/* HP bars */}
        <div style={{ display:"flex", gap:12 }}>
          <div style={{ flex:1 }}>
            <HPBar hp={heroHp}    maxHp={HERO_MAX_HP}    label="🦸 ゆずき" />
          </div>
          <div style={{ flex:1 }}>
            <HPBar hp={monsterHp} maxHp={MONSTER_MAX_HP} label={`${monsterEmoji} かいじゅう`} />
          </div>
        </div>

        {/* battlefield */}
        <div style={{
          position:"relative", height:"min(42vw, 200px)",
          background:"linear-gradient(180deg, rgba(20,8,8,0.7) 0%, rgba(10,4,4,0.9) 100%)",
          border:"1px solid rgba(239,68,68,0.2)",
          borderRadius:12,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 clamp(16px,6vw,40px)",
          overflow:"hidden",
          animation: flash === "wrong" ? "screenShake 0.4s ease-out" : "none",
        }}>
          {/* scan lines */}
          <div style={{
            position:"absolute", inset:0, pointerEvents:"none",
            background:"repeating-linear-gradient(to bottom, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)",
          }} />

          {/* correct flash overlay */}
          {flash === "correct" && (
            <div style={{
              position:"absolute", inset:0, borderRadius:12,
              background:"rgba(34,197,94,0.15)",
              animation:"correctFlash 0.8s ease-out forwards",
              pointerEvents:"none", zIndex:5,
            }} />
          )}

          {/* hero */}
          <div style={{
            fontSize:"clamp(3rem,12vw,5rem)",
            filter: heroDead
              ? "grayscale(1) opacity(0.3)"
              : heroDanger
              ? "drop-shadow(0 0 14px rgba(255,50,50,0.9))"
              : "drop-shadow(0 0 10px rgba(100,180,255,0.6))",
            animation: heroDead ? "none"
              : flash === "wrong" ? "wrongShake 0.4s ease-out"
              : "heroFloat 3s ease-in-out infinite",
            userSelect:"none",
          }}>
            🦸
          </div>

          {/* beam — only during correct phase */}
          {flash === "correct" && (
            <div style={{
              position:"absolute",
              left:"clamp(60px,18vw,100px)",
              right:"clamp(60px,18vw,100px)",
              top:"50%", transform:"translateY(-50%)",
              height:6, borderRadius:3,
              background:"linear-gradient(90deg, #38bdf8, #a78bfa, #f472b6)",
              boxShadow:"0 0 16px #38bdf8, 0 0 30px #a78bfa",
              animation:"beamShoot 0.7s ease-out forwards",
              transformOrigin:"left center",
              zIndex:4,
            }} />
          )}

          {/* monster */}
          <div style={{
            fontSize:"clamp(3rem,13vw,5.5rem)",
            filter: monsterDead
              ? "grayscale(1) opacity(0)"
              : "drop-shadow(0 0 12px rgba(239,68,68,0.6))",
            animation: monsterDead ? "monsterDead 0.7s ease-out forwards"
              : flash === "correct" ? "monsterHit 0.6s ease-out"
              : "heroFloat 2.5s ease-in-out 0.4s infinite",
            userSelect:"none",
          }}>
            {monsterEmoji}
          </div>
        </div>
      </div>

      {/* ── QUESTION CARD ──────────────────────────────── */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:480,
        padding:"0 20px", marginTop:12,
        display:"flex", flexDirection:"column", alignItems:"center", gap:12,
      }}>
        {/* kana display */}
        <div style={{
          background:"linear-gradient(135deg, rgba(20,8,8,0.9) 0%, rgba(12,4,4,0.95) 100%)",
          border:`2px solid ${C.border}`,
          borderRadius:16,
          padding:"12px 40px",
          boxShadow:`0 0 24px rgba(239,68,68,0.15), inset 0 0 16px rgba(239,68,68,0.05)`,
          textAlign:"center",
        }}>
          <div style={{ color: C.muted, fontFamily:"monospace", fontSize:"0.55rem", letterSpacing:"0.15em", marginBottom:4 }}>
            よみかた は？
          </div>
          <div style={{
            fontSize:"clamp(3.5rem,16vw,6rem)",
            fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
            fontWeight:900,
            color: "#fff",
            textShadow:"0 0 20px rgba(239,68,68,0.5), 3px 3px 0 rgba(185,28,28,0.4)",
            lineHeight:1,
            userSelect:"none",
          }}>
            {question.kana}
          </div>
        </div>

        {/* answer options: 2×2 grid */}
        <div style={{
          display:"grid", gridTemplateColumns:"1fr 1fr", gap:10,
          width:"100%",
        }}>
          {question.options.map((opt) => (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              style={{
                height: 54,
                background:"linear-gradient(180deg, rgba(28,14,14,0.92) 0%, rgba(16,8,8,0.96) 100%)",
                border:"1.5px solid rgba(120,60,60,0.5)",
                borderRadius:12,
                color: "#e2e8f0",
                fontFamily:"monospace",
                fontWeight:700,
                fontSize:"clamp(1rem,4vw,1.25rem)",
                letterSpacing:"0.08em",
                cursor: phase !== "idle" ? "default" : "pointer",
                transition:"all 0.15s",
                ...optionStyle(opt),
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* ── WIN / LOSE OVERLAY ─────────────────────────── */}
      {(phase === "win" || phase === "lose") && (
        <div style={{
          position:"fixed", inset:0, zIndex:100,
          background:"rgba(0,0,0,0.82)",
          backdropFilter:"blur(6px)",
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:20,
        }}>
          <div style={{
            fontSize:"clamp(3rem,14vw,5rem)",
            animation:"shuwatchAppear 0.55s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
          }}>
            {phase === "win" ? "🏆" : "💀"}
          </div>
          <div style={{
            fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
            fontWeight:900,
            fontSize:"clamp(1.5rem,7vw,2.5rem)",
            color: phase === "win" ? C.gold : "#f87171",
            textShadow: phase === "win"
              ? "0 0 20px rgba(251,191,36,0.8)"
              : "0 0 20px rgba(239,68,68,0.8)",
            letterSpacing:"0.1em",
          }}>
            {phase === "win" ? "しょうり！" : "やられた…"}
          </div>
          <div style={{ color: C.muted, fontFamily:"monospace", fontSize:"0.8rem" }}>
            スコア: <span style={{ color: C.gold, fontWeight:900 }}>{score}</span>
          </div>
          <div style={{ display:"flex", gap:12, marginTop:8 }}>
            <button
              onClick={restart}
              style={{
                padding:"12px 32px", borderRadius:999,
                background:"linear-gradient(180deg,#f87171,#dc2626)",
                border:"none", color:"#fff",
                fontFamily:"'Hiragino Kaku Gothic Pro',sans-serif",
                fontWeight:900, fontSize:"1rem", letterSpacing:"0.1em",
                cursor:"pointer",
                boxShadow:"0 4px 16px rgba(239,68,68,0.5)",
              }}
            >
              もういちど
            </button>
            <button
              onClick={onHome}
              style={{
                padding:"12px 32px", borderRadius:999,
                background:"rgba(30,15,15,0.9)",
                border:"1px solid rgba(120,60,60,0.5)",
                color: C.muted,
                fontFamily:"monospace", fontSize:"0.9rem", letterSpacing:"0.08em",
                cursor:"pointer",
              }}
            >
              ホームへ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TOKKUN SCREEN  (フラッシュカード練習)
// ============================================================
function TokkunScreen({ onHome }) {
  const deck = useRef([...ALL_KANA].sort(() => Math.random() - 0.5)).current;
  const [idx,       setIdx]       = useState(0);
  const [flipped,   setFlipped]   = useState(false);
  const [correct,   setCorrect]   = useState(0);
  const [wrong,     setWrong]     = useState(0);
  const [done,      setDone]      = useState(false);
  const [feedback,  setFeedback]  = useState(null); // "correct"|"wrong"|null

  const card = deck[idx];
  const total = deck.length;

  const advance = (result) => {
    if (result === "correct") setCorrect(c => c + 1);
    else                      setWrong(w => w + 1);
    setFeedback(result);
    setTimeout(() => {
      setFeedback(null);
      setFlipped(false);
      if (idx + 1 >= total) setDone(true);
      else setIdx(i => i + 1);
    }, 400);
  };

  const restart = () => {
    deck.sort(() => Math.random() - 0.5);
    setIdx(0); setFlipped(false);
    setCorrect(0); setWrong(0);
    setDone(false); setFeedback(null);
  };

  const progress = Math.round((idx / total) * 100);

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
        position:"relative", zIndex:10, width:"100%", maxWidth:480,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 20px 8px",
      }}>
        <button onClick={onHome} style={{
          background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)",
          borderRadius:8, color:C.primary, cursor:"pointer",
          padding:"6px 14px", fontFamily:"monospace", fontSize:"0.75rem", letterSpacing:"0.08em",
        }}>← もどる</button>
        <div style={{ fontFamily:"monospace", fontSize:"0.8rem", letterSpacing:"0.12em", color: C.teal }}>
          ⚡ とっくん
        </div>
        <div style={{ fontFamily:"monospace", fontSize:"0.7rem", color: C.muted }}>
          {idx + 1} / {total}
        </div>
      </div>

      {/* progress bar */}
      <div style={{
        position:"relative", zIndex:10, width:"100%", maxWidth:480,
        padding:"0 20px", marginBottom:4,
      }}>
        <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden" }}>
          <div style={{
            height:"100%", width:`${progress}%`,
            background:`linear-gradient(90deg, ${C.teal}, ${C.primary})`,
            borderRadius:2, transition:"width 0.3s ease-out",
          }} />
        </div>
        <div style={{
          display:"flex", justifyContent:"space-between",
          fontFamily:"monospace", fontSize:"0.55rem", color: C.muted, marginTop:3,
        }}>
          <span style={{ color:"#22c55e" }}>✓ {correct}</span>
          <span style={{ color:"#f87171" }}>✗ {wrong}</span>
        </div>
      </div>

      {/* flash card */}
      {!done && (
        <div style={{
          position:"relative", zIndex:10, width:"100%", maxWidth:420,
          padding:"0 20px", flex:1,
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          gap:16,
        }}>
          <button
            onClick={() => !flipped && setFlipped(true)}
            style={{
              width:"100%", minHeight:220,
              background: feedback === "correct"
                ? "rgba(34,197,94,0.15)"
                : feedback === "wrong"
                ? "rgba(239,68,68,0.15)"
                : "linear-gradient(135deg, rgba(22,10,10,0.92) 0%, rgba(12,5,5,0.96) 100%)",
              border: `2px solid ${
                feedback === "correct" ? "#22c55e"
                : feedback === "wrong"  ? "#ef4444"
                : "rgba(239,68,68,0.4)"
              }`,
              borderRadius:20,
              cursor: flipped ? "default" : "pointer",
              display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center", gap:12,
              boxShadow: feedback === "correct"
                ? "0 0 30px rgba(34,197,94,0.3)"
                : feedback === "wrong"
                ? "0 0 30px rgba(239,68,68,0.3)"
                : "0 0 24px rgba(239,68,68,0.12)",
              transition:"all 0.25s",
            }}
          >
            <div style={{
              fontSize:"clamp(4rem,18vw,7rem)",
              fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif",
              fontWeight:900,
              color:"#fff",
              textShadow:"0 0 20px rgba(239,68,68,0.4), 3px 3px 0 rgba(185,28,28,0.35)",
              userSelect:"none",
            }}>{card.kana}</div>

            {!flipped ? (
              <div style={{
                fontFamily:"monospace", fontSize:"0.7rem", color: C.muted,
                letterSpacing:"0.12em",
              }}>タップしてこたえを見る</div>
            ) : (
              <div style={{
                fontFamily:"monospace", fontSize:"clamp(1.2rem,5vw,1.8rem)",
                fontWeight:900, color: C.teal,
                letterSpacing:"0.1em",
                textShadow:`0 0 12px ${C.teal}`,
              }}>{card.roma}</div>
            )}
          </button>

          {/* answer buttons — only show after flip */}
          {flipped && !feedback && (
            <div style={{ display:"flex", gap:12, width:"100%" }}>
              <button
                onClick={() => advance("wrong")}
                style={{
                  flex:1, height:52,
                  background:"rgba(239,68,68,0.12)",
                  border:"1.5px solid rgba(239,68,68,0.5)",
                  borderRadius:12,
                  color:"#f87171", fontFamily:"monospace",
                  fontWeight:700, fontSize:"0.9rem", letterSpacing:"0.08em",
                  cursor:"pointer",
                }}
              >✗ むずかしい</button>
              <button
                onClick={() => advance("correct")}
                style={{
                  flex:1, height:52,
                  background:"rgba(34,197,94,0.12)",
                  border:"1.5px solid rgba(34,197,94,0.5)",
                  borderRadius:12,
                  color:"#86efac", fontFamily:"monospace",
                  fontWeight:700, fontSize:"0.9rem", letterSpacing:"0.08em",
                  cursor:"pointer",
                }}
              >✓ わかった！</button>
            </div>
          )}
        </div>
      )}

      {/* done overlay */}
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
          <div style={{ display:"flex", gap:24, fontFamily:"monospace", fontSize:"1rem" }}>
            <span style={{ color:"#86efac" }}>✓ {correct}</span>
            <span style={{ color:"#f87171" }}>✗ {wrong}</span>
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
// APP  (仮: タスク5で差し替え)
// ============================================================
export default function App() {
  const [screen, setScreen] = useState("home");
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      {screen === "home"   && <HomeScreen   onBattle={() => setScreen("battle")} onTokkun={() => setScreen("tokkun")} onZukan={() => setScreen("zukan")} />}
      {screen === "battle" && <BattleScreen onHome={() => setScreen("home")} />}
      {screen === "tokkun" && <TokkunScreen onHome={() => setScreen("home")} />}
      {screen === "zukan"  && <ZukanScreen  onHome={() => setScreen("home")} />}
    </>
  );
}
