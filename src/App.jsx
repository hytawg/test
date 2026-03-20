import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// CHARACTER DATA: stroke points for ゆ・ず・き
// Points are waypoints the user must trace through in order
// SVG coordinate space: 200x200
// ============================================================
const CHARACTERS = [
  {
    char: "ゆ",
    reading: "YU",
    color: "#00BFFF",
    shadowColor: "#0066FF",
    points: [
      { id: 0, x: 100, y: 42, label: "①" },
      { id: 1, x: 152, y: 78, label: "②" },
      { id: 2, x: 148, y: 128, label: "③" },
      { id: 3, x: 100, y: 155, label: "④" },
      { id: 4, x: 52,  y: 120, label: "⑤" },
      { id: 5, x: 56,  y: 72,  label: "⑥" },
      { id: 6, x: 100, y: 175, label: "⑦" },
    ],
    strokePath:
      "M 100 42 C 138 42 158 65 152 78 C 148 98 148 118 100 155 " +
      "C 60 175 38 135 52 120 C 62 108 78 80 100 42 " +
      "M 100 42 L 100 175",
  },
  {
    char: "ず",
    reading: "ZU",
    color: "#FF6B35",
    shadowColor: "#CC3300",
    points: [
      { id: 0, x: 52,  y: 68,  label: "①" },
      { id: 1, x: 148, y: 68,  label: "②" },
      { id: 2, x: 100, y: 92,  label: "③" },
      { id: 3, x: 148, y: 118, label: "④" },
      { id: 4, x: 100, y: 152, label: "⑤" },
      { id: 5, x: 52,  y: 120, label: "⑥" },
      { id: 6, x: 128, y: 42,  label: "⑦" },
      { id: 7, x: 152, y: 36,  label: "⑧" },
    ],
    strokePath:
      "M 52 68 L 148 68 " +
      "M 100 92 C 142 92 152 108 148 118 C 134 142 116 155 100 152 " +
      "C 72 148 48 130 52 120 C 56 108 74 94 100 92 " +
      "M 124 46 L 132 38 M 146 44 L 156 34",
  },
  {
    char: "き",
    reading: "KI",
    color: "#7CFC00",
    shadowColor: "#228B00",
    points: [
      { id: 0, x: 52,  y: 68,  label: "①" },
      { id: 1, x: 148, y: 68,  label: "②" },
      { id: 2, x: 52,  y: 100, label: "③" },
      { id: 3, x: 148, y: 100, label: "④" },
      { id: 4, x: 100, y: 52,  label: "⑤" },
      { id: 5, x: 100, y: 118, label: "⑥" },
      { id: 6, x: 148, y: 154, label: "⑦" },
      { id: 7, x: 84,  y: 168, label: "⑧" },
    ],
    strokePath:
      "M 52 68 L 148 68 " +
      "M 52 100 L 148 100 " +
      "M 100 52 L 100 118 C 112 138 148 148 148 154 C 148 162 118 170 84 168",
  },
];

// ============================================================
// ULTRAMAN SVG CHARACTER
// ============================================================
function UltramanSVG({ glowing }) {
  return (
    <svg width="48" height="74" viewBox="0 0 48 74" xmlns="http://www.w3.org/2000/svg">
      {/* Head fin/crest */}
      <polygon points="24,1 30,11 18,11" fill="#CC0000" />
      {/* Head */}
      <ellipse cx="24" cy="19" rx="12" ry="11" fill="#D8D8D8" />
      {/* Eyes - compound, amber/orange */}
      <ellipse cx="17.5" cy="16" rx="6.5" ry="4" fill="#FF8800" />
      <ellipse cx="30.5" cy="16" rx="6.5" ry="4" fill="#FF8800" />
      {/* Eye inner glow */}
      <ellipse cx="17.5" cy="15" rx="3" ry="1.8" fill="#FFDD44" opacity="0.75" />
      <ellipse cx="30.5" cy="15" rx="3" ry="1.8" fill="#FFDD44" opacity="0.75" />
      {/* Neck */}
      <rect x="19" y="29" width="10" height="5" fill="#D8D8D8" />
      {/* Body */}
      <rect x="13" y="33" width="22" height="23" rx="4" fill="#D8D8D8" />
      {/* Red upper chest stripe */}
      <rect x="13" y="37" width="22" height="6" fill="#CC0000" />
      {/* Color timer (chest) */}
      <circle
        cx="24"
        cy="49"
        r="5"
        fill={glowing ? "#22CCFF" : "#0055BB"}
        style={glowing ? { filter: "drop-shadow(0 0 6px #00AAFF)" } : {}}
      />
      {/* Arms */}
      <rect x="3"  cy="33" x="3"  y="33" width="10" height="20" rx="5" fill="#D8D8D8" />
      <rect x="35" y="33" width="10" height="20" rx="5" fill="#D8D8D8" />
      {/* Arm red stripes */}
      <rect x="3"  y="43" width="10" height="5" fill="#CC0000" />
      <rect x="35" y="43" width="10" height="5" fill="#CC0000" />
      {/* Waist belt */}
      <rect x="13" y="55" width="22" height="5" fill="#CC0000" />
      {/* Legs */}
      <rect x="13" y="59" width="10" height="13" rx="3" fill="#D8D8D8" />
      <rect x="25" y="59" width="10" height="13" rx="3" fill="#D8D8D8" />
      {/* Leg red stripes */}
      <rect x="13" y="66" width="10" height="4" fill="#CC0000" />
      <rect x="25" y="66" width="10" height="4" fill="#CC0000" />
      {/* Feet */}
      <ellipse cx="18" cy="72" rx="8" ry="3.5" fill="#D8D8D8" />
      <ellipse cx="30" cy="72" rx="8" ry="3.5" fill="#D8D8D8" />
    </svg>
  );
}

// ============================================================
// STAR FIELD
// ============================================================
const STAR_DATA = Array.from({ length: 90 }, (_, i) => ({
  id: i,
  x: ((i * 137.508) % 100).toFixed(2),
  y: ((i * 97.3) % 100).toFixed(2),
  size: ((i % 3) + 1).toFixed(1),
  dur: (2 + (i % 4)).toFixed(1),
  delay: ((i * 0.37) % 3).toFixed(2),
}));

function StarField({ fastScroll }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ animation: fastScroll ? "starsScrollFast 0.4s linear infinite" : "none" }}
    >
      {STAR_DATA.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================
// COLOR TIMER
// ============================================================
function ColorTimer() {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        {[0, 0.35, 0.7].map((delay, i) => (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: "14px",
              height: "14px",
              animation: `timerBlink 1s ease-in-out ${delay}s infinite`,
            }}
          />
        ))}
      </div>
      <div
        style={{
          color: "#667799",
          fontFamily: "monospace",
          fontSize: "0.55rem",
          letterSpacing: "0.12em",
        }}
      >
        カラータイマー
      </div>
    </div>
  );
}

// ============================================================
// RETRO WINDOW FRAME
// ============================================================
function RetroFrame({ children, color = "#4488FF", style = {} }) {
  return (
    <div
      style={{
        border: `3px solid ${color}`,
        boxShadow: `0 0 12px ${color}66, inset 0 0 8px rgba(0,0,60,0.4)`,
        background: "rgba(0, 0, 25, 0.95)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================
// SVG CHARACTER DRAWING AREA
// ============================================================
const HIT_RADIUS = 28;

function CharacterSVG({ charData, completedPoints, nextPointId, phase, hitPointId, onPointReached }) {
  const svgRef = useRef(null);
  const isDrawingRef = useRef(false);
  const hitCooldownRef = useRef(false);
  const [userStroke, setUserStroke] = useState([]);

  // Clear user stroke when character changes
  useEffect(() => {
    setUserStroke([]);
    isDrawingRef.current = false;
    hitCooldownRef.current = false;
  }, [charData]);

  const totalPoints = charData.points.length;
  const progress = completedPoints.length / totalPoints;

  const getSVGCoords = (e) => {
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (200 / rect.width),
      y: (e.clientY - rect.top) * (200 / rect.height),
    };
  };

  const tryHitPoint = (pos) => {
    if (phase !== "practice" || hitCooldownRef.current) return;
    const point = charData.points.find((p) => p.id === nextPointId);
    if (!point) return;
    const dx = pos.x - point.x;
    const dy = pos.y - point.y;
    if (Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS) {
      hitCooldownRef.current = true;
      onPointReached(nextPointId);
      setTimeout(() => { hitCooldownRef.current = false; }, 420);
    }
  };

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pos = getSVGCoords(e);
    setUserStroke([pos]);
    tryHitPoint(pos);
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current) return;
    const pos = getSVGCoords(e);
    setUserStroke((prev) => [...prev.slice(-80), pos]);
    tryHitPoint(pos);
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    setUserStroke([]);
  };

  const pathD =
    userStroke.length > 1
      ? userStroke
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(" ")
      : null;

  return (
    <div className="relative" style={{ width: "200px", height: "200px", touchAction: "none" }}>
      <svg
        ref={svgRef}
        width="200"
        height="200"
        viewBox="0 0 200 200"
        className="absolute inset-0"
        style={{ touchAction: "none", cursor: "crosshair", userSelect: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <pattern id="dotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.8" fill="rgba(100,150,255,0.25)" />
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="userGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="200" height="200" fill="url(#dotGrid)" />

        {/* Guide stroke (faint background) */}
        <path
          d={charData.strokePath}
          fill="none"
          stroke={`${charData.color}28`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Progress stroke (lights up as points are hit) */}
        {progress > 0 && (
          <path
            d={charData.strokePath}
            fill="none"
            stroke={charData.color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
            filter="url(#glow)"
            style={{
              strokeDasharray: "600",
              strokeDashoffset: 600 - progress * 600,
              transition: "stroke-dashoffset 0.4s ease-out",
            }}
          />
        )}

        {/* Target point circles */}
        {charData.points.map((point) => {
          const isDone = completedPoints.includes(point.id);
          const isNext = point.id === nextPointId && phase === "practice";
          const isHit = point.id === hitPointId;

          return (
            <g key={point.id} style={{ pointerEvents: "none" }}>
              <circle
                cx={point.x}
                cy={point.y}
                r={18}
                fill={
                  isDone
                    ? "rgba(0, 255, 100, 0.85)"
                    : isHit
                    ? "rgba(255, 80, 0, 0.95)"
                    : isNext
                    ? "rgba(255, 220, 0, 0.88)"
                    : "rgba(60, 90, 160, 0.4)"
                }
                stroke={
                  isDone
                    ? "#00FF80"
                    : isNext
                    ? "#FFD700"
                    : "rgba(140, 180, 255, 0.45)"
                }
                strokeWidth="2"
                style={
                  isNext
                    ? {
                        animation: "svgPointPulse 0.75s ease-in-out infinite",
                        transformBox: "fill-box",
                        transformOrigin: "center",
                      }
                    : isDone
                    ? {
                        animation: "svgPointDone 1.8s ease-in-out infinite",
                      }
                    : isHit
                    ? {
                        transformBox: "fill-box",
                        transformOrigin: "center",
                        transform: "scale(1.4)",
                      }
                    : {}
                }
              />
              <text
                x={point.x}
                y={point.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={isDone ? "#003820" : "#000"}
                style={{
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  fontSize: "11px",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              >
                {isDone ? "✓" : point.label}
              </text>
            </g>
          );
        })}

        {/* User's drawing trail */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="rgba(255, 255, 255, 0.9)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#userGlow)"
            style={{ pointerEvents: "none" }}
          />
        )}
      </svg>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [charIndex, setCharIndex] = useState(0);
  const [completedPoints, setCompletedPoints] = useState([]);
  // phase: "practice" | "hit" | "complete" | "flying"
  const [phase, setPhase] = useState("practice");
  const [hitPointId, setHitPointId] = useState(null);
  const [showShuwatch, setShowShuwatch] = useState(false);
  const [whiteFlash, setWhiteFlash] = useState(false);

  const currentChar = CHARACTERS[charIndex];
  const totalPoints = currentChar.points.length;
  const nextPointId = completedPoints.length;

  const handlePointReached = useCallback(
    (pointId) => {
      if (phase !== "practice") return;
      if (pointId !== nextPointId) return;

      setHitPointId(pointId);
      setPhase("hit");

      setTimeout(() => {
        const newCompleted = [...completedPoints, pointId];
        setCompletedPoints(newCompleted);
        setHitPointId(null);

        if (newCompleted.length === totalPoints) {
          setPhase("complete");

          setWhiteFlash(true);
          setTimeout(() => {
            setWhiteFlash(false);
            setShowShuwatch(true);

            setTimeout(() => {
              setPhase("flying");

              setTimeout(() => {
                const nextIndex = (charIndex + 1) % CHARACTERS.length;
                setCharIndex(nextIndex);
                setCompletedPoints([]);
                setPhase("practice");
                setShowShuwatch(false);
              }, 1600);
            }, 1200);
          }, 380);
        } else {
          setPhase("practice");
        }
      }, 380);
    },
    [phase, nextPointId, completedPoints, totalPoints, charIndex]
  );

  const isFlying = phase === "flying";
  const isComplete = phase === "complete" || phase === "flying";

  return (
    <>
      {/* ── GLOBAL KEYFRAMES ── */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.6); }
        }
        @keyframes starsScrollFast {
          from { transform: translateY(0px); }
          to   { transform: translateY(40px); }
        }
        @keyframes timerBlink {
          0%, 100% {
            background-color: #0055FF;
            box-shadow: 0 0 8px 2px #0055FF;
          }
          50% {
            background-color: #FF1111;
            box-shadow: 0 0 12px 4px #FF1111;
          }
        }
        @keyframes monsterHit {
          0%   { filter: drop-shadow(0 0 10px #FF6600); }
          40%  { filter: drop-shadow(0 0 28px #FF0000) brightness(2.2); }
          100% { filter: drop-shadow(0 0 10px #FF6600); }
        }
        @keyframes ultramanFlyOut {
          0%   { transform: translateY(0);       opacity: 1; }
          30%  { transform: translateY(-20px);   opacity: 1; }
          100% { transform: translateY(-160vh);  opacity: 0; }
        }
        @keyframes whiteFlashAnim {
          0%   { opacity: 0; }
          25%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes shuwatchAppear {
          0%   { transform: scale(0.3) rotate(-12deg); opacity: 0; }
          50%  { transform: scale(1.25) rotate(4deg);  opacity: 1; }
          75%  { transform: scale(0.95) rotate(-1deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg);     opacity: 1; }
        }
        @keyframes svgPointPulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.2); }
        }
        @keyframes svgPointDone {
          0%, 100% { filter: drop-shadow(0 0 3px rgba(0,255,120,0.7)); }
          50%       { filter: drop-shadow(0 0 7px rgba(0,255,120,1)); }
        }
        @keyframes completedGlow {
          0%, 100% { box-shadow: 0 0 6px 2px rgba(0, 255, 120, 0.7); }
          50%       { box-shadow: 0 0 14px 5px rgba(0, 255, 120, 1); }
        }
        @keyframes titleGlow {
          0%, 100% { text-shadow: 0 0 8px #FFD700, 0 0 20px #FF6600; }
          50%       { text-shadow: 0 0 16px #FFD700, 0 0 35px #FF9900, 0 0 50px #FF6600; }
        }
        @keyframes charFlicker {
          0%, 90%, 100% { opacity: 1; }
          92%            { opacity: 0.7; }
          94%            { opacity: 1; }
          96%            { opacity: 0.8; }
        }
        @keyframes scanlineScroll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(4px); }
        }
        @keyframes ultramanGlow {
          0%, 100% { filter: drop-shadow(0 0 8px #00AAFF) drop-shadow(0 0 18px #0044FF); }
          50%       { filter: drop-shadow(0 0 14px #44CCFF) drop-shadow(0 0 28px #0066FF); }
        }
        @keyframes ultramanWin {
          0%, 100% { filter: drop-shadow(0 0 10px #FFD700) drop-shadow(0 0 24px #FF6600); }
          50%       { filter: drop-shadow(0 0 20px #FFD700) drop-shadow(0 0 40px #FF9900); }
        }
      `}</style>

      {/* ── ROOT ── */}
      <div
        className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-start"
        style={{ background: "linear-gradient(180deg, #000318 0%, #000C30 60%, #001050 100%)" }}
      >
        <StarField fastScroll={isFlying} />

        {/* SCANLINE OVERLAY */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)",
            animation: "scanlineScroll 0.12s linear infinite",
            zIndex: 2,
          }}
        />

        {/* WHITE FLASH OVERLAY */}
        {whiteFlash && (
          <div
            className="absolute inset-0 bg-white pointer-events-none"
            style={{ animation: "whiteFlashAnim 0.4s ease-out forwards", zIndex: 60 }}
          />
        )}

        {/* SHUWATCH TEXT */}
        {showShuwatch && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 70 }}
          >
            <div
              style={{
                animation: "shuwatchAppear 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
                fontFamily: "'Courier New', monospace",
                fontSize: "clamp(2.8rem, 13vw, 5.5rem)",
                fontWeight: 900,
                color: "#FFD700",
                textShadow: "0 0 20px #FF8800, 0 0 45px #FF3300, 5px 5px 0 #000, -2px -2px 0 #000",
                letterSpacing: "0.08em",
                whiteSpace: "nowrap",
              }}
            >
              シュワッチ！
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <div
          className="relative flex flex-col items-center w-full max-w-lg px-3 pt-4 pb-6 gap-3"
          style={{ zIndex: 10 }}
        >
          {/* TITLE BAR */}
          <RetroFrame color="#4488FF" style={{ width: "100%", padding: "8px 16px", textAlign: "center" }}>
            <div
              style={{
                color: "#FFD700",
                fontFamily: "monospace",
                fontSize: "clamp(0.9rem, 4vw, 1.2rem)",
                fontWeight: 900,
                letterSpacing: "0.15em",
                animation: "titleGlow 2.5s ease-in-out infinite",
              }}
            >
              ★ ウルトラ文字特訓 ★
            </div>
            <div
              style={{
                color: "#6699CC",
                fontFamily: "monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.18em",
                marginTop: "2px",
              }}
            >
              ULTRA MOJI TOKKUN
            </div>
          </RetroFrame>

          {/* COLOR TIMER */}
          <ColorTimer />

          {/* BATTLE AREA */}
          <div className="w-full flex items-center justify-between gap-2">

            {/* ULTRAMAN (left) */}
            <div
              className="flex flex-col items-center gap-1"
              style={{
                animation: isFlying ? "ultramanFlyOut 1.6s ease-in forwards" : "none",
                minWidth: "72px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  animation: isComplete && !isFlying ? "ultramanWin 0.6s ease-in-out infinite" : "ultramanGlow 3s ease-in-out infinite",
                }}
              >
                <UltramanSVG glowing={isComplete} />
              </div>
              <div
                style={{
                  color: isComplete ? "#FFD700" : "#88CCFF",
                  fontFamily: "monospace",
                  fontSize: "0.58rem",
                  letterSpacing: "0.05em",
                  textShadow: isComplete ? "0 0 8px #FFD700" : "0 0 6px #88CCFF",
                  animation: isComplete && !isFlying ? "svgPointPulse 0.6s ease-in-out infinite" : "none",
                }}
              >
                {isComplete && !isFlying ? "✦ FIGHT ✦" : "ウルトラマン"}
              </div>
            </div>

            {/* CHARACTER PRACTICE FRAME */}
            <RetroFrame
              color={currentChar.color}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                padding: "8px",
                minHeight: "280px",
              }}
            >
              {/* Header row */}
              <div className="flex items-center justify-between w-full px-1">
                <div
                  style={{
                    color: currentChar.color,
                    fontFamily: "monospace",
                    fontSize: "0.65rem",
                    letterSpacing: "0.1em",
                  }}
                >
                  もじ {charIndex + 1}/3
                </div>
                <div
                  style={{
                    color: currentChar.color,
                    fontFamily: "monospace",
                    fontSize: "clamp(1.6rem, 7vw, 2.2rem)",
                    fontWeight: 900,
                    textShadow: `0 0 12px ${currentChar.color}, 0 0 25px ${currentChar.shadowColor}`,
                    animation: "charFlicker 6s ease-in-out infinite",
                  }}
                >
                  {currentChar.char}
                </div>
                <div
                  style={{
                    color: "#556688",
                    fontFamily: "monospace",
                    fontSize: "0.65rem",
                  }}
                >
                  {completedPoints.length}/{totalPoints}
                </div>
              </div>

              {/* SVG drawing area */}
              <CharacterSVG
                charData={currentChar}
                completedPoints={completedPoints}
                nextPointId={nextPointId}
                phase={phase}
                hitPointId={hitPointId}
                onPointReached={handlePointReached}
              />

              {/* Progress bar */}
              <div className="w-full px-1" style={{ paddingBottom: "2px" }}>
                <div
                  style={{
                    width: "100%",
                    height: "10px",
                    background: "rgba(0,0,0,0.6)",
                    border: "1px solid #334466",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(completedPoints.length / totalPoints) * 100}%`,
                      background: `linear-gradient(90deg, ${currentChar.shadowColor}, ${currentChar.color}, #ffffff)`,
                      boxShadow: `0 0 8px ${currentChar.color}`,
                      transition: "width 0.35s ease-out",
                    }}
                  />
                </div>
                <div
                  style={{
                    color: "#8899BB",
                    fontFamily: "monospace",
                    fontSize: "0.6rem",
                    textAlign: "center",
                    marginTop: "3px",
                    letterSpacing: "0.06em",
                  }}
                >
                  {phase === "practice" && `▶ ポイント ${nextPointId + 1} をなぞれ！`}
                  {phase === "hit" && "⚡ こうげきヒット！"}
                  {phase === "complete" && "★ もじかんせい！★"}
                  {phase === "flying" && "🚀 シュワッチ！！"}
                </div>
              </div>
            </RetroFrame>

            {/* MONSTER (right) */}
            <div
              className="flex flex-col items-center gap-1"
              style={{
                minWidth: "72px",
                textAlign: "center",
                filter:
                  phase === "hit"
                    ? "drop-shadow(0 0 20px #FF0000) brightness(2)"
                    : isComplete
                    ? "drop-shadow(0 0 8px #FF4400) brightness(0.4) grayscale(0.6)"
                    : "drop-shadow(0 0 10px #FF5500)",
                animation: phase === "hit" ? "monsterHit 0.38s ease-in-out" : "none",
                transition: "filter 0.3s ease",
              }}
            >
              <div style={{ fontSize: "clamp(2.5rem, 10vw, 4rem)", lineHeight: 1 }}>👾</div>
              <div
                style={{
                  color: isComplete ? "#884422" : phase === "hit" ? "#FF4444" : "#FF8866",
                  fontFamily: "monospace",
                  fontSize: "0.58rem",
                  letterSpacing: "0.05em",
                  textShadow: phase === "hit" ? "0 0 8px #FF0000" : "none",
                  fontWeight: phase === "hit" ? 900 : 400,
                }}
              >
                {phase === "hit"
                  ? "ダメージ！"
                  : isComplete
                  ? "やられた…"
                  : "かいじゅう"}
              </div>
            </div>
          </div>

          {/* INSTRUCTION BOX */}
          <RetroFrame color="#223355" style={{ width: "100%", padding: "6px 12px", textAlign: "center" }}>
            <div
              style={{
                color: "#AABBDD",
                fontFamily: "monospace",
                fontSize: "clamp(0.65rem, 3vw, 0.8rem)",
                letterSpacing: "0.06em",
              }}
            >
              {phase === "practice" && "ひかるポイントを じゅんばんに なぞろう！"}
              {phase === "hit" && "⚡ こうげきヒット！つぎのポイントへ！"}
              {phase === "complete" && "★ もじかんせい！シュワッチ！★"}
              {phase === "flying" && "★★ つぎのもじへ！★★"}
            </div>
          </RetroFrame>

          {/* CHARACTER PROGRESS INDICATOR */}
          <div className="flex items-center gap-4">
            {CHARACTERS.map((c, i) => (
              <div
                key={i}
                className="flex flex-col items-center"
                style={{ transition: "all 0.4s ease" }}
              >
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: i === charIndex ? "2rem" : "1.1rem",
                    color:
                      i < charIndex
                        ? "#00FF80"
                        : i === charIndex
                        ? c.color
                        : "#334455",
                    textShadow:
                      i === charIndex
                        ? `0 0 12px ${c.color}, 0 0 25px ${c.shadowColor}`
                        : "none",
                    transition: "all 0.4s ease",
                  }}
                >
                  {c.char}
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.5rem",
                    color:
                      i < charIndex ? "#00FF80" : i === charIndex ? "#FFD700" : "#334455",
                  }}
                >
                  {i < charIndex ? "★" : i === charIndex ? "▲" : "○"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
