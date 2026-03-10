import { useState, useEffect } from "react";

interface ResultScreenProps {
  percentage: number;
  text?: string;
  onContinue?: () => void;
}

export function ResultScreen({ percentage, text = "Opina igual que vos.", onContinue }: ResultScreenProps) {
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const [showText, setShowText] = useState(false);

  // Animate the percentage fill
  useEffect(() => {
    const duration = 800; // ms
    const start = Date.now();

    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedPercent(Math.round(eased * percentage));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setShowText(true);
      }
    };

    const timeout = setTimeout(() => {
      requestAnimationFrame(animate);
    }, 200);

    return () => clearTimeout(timeout);
  }, [percentage]);

  // Auto-advance after 3 seconds once text is shown
  useEffect(() => {
    if (showText && onContinue) {
      const timer = setTimeout(() => {
        onContinue();
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [showText, onContinue]);

  // SVG parameters
  const size = 240;
  const center = size / 2;
  const radius = 93;
  const thickStroke = 38;

  // Full circle, starts at 12 o'clock, grows clockwise
  const circumference = 2 * Math.PI * radius;

  // Progress fill
  const fillLength = (animatedPercent / 100) * circumference;
  const remainingArc = circumference - fillLength;

  // SVG circles start at 3 o'clock; rotate -90deg to start at 12 o'clock
  const rotationOffset = -90;

  // Dash params (matching Figma: 12 12)
  const dash = 12;
  const gap = 12;

  return (
    <div className="h-dvh flex justify-center font-['Roboto'] overflow-hidden"
      style={{
        backgroundColor: "var(--dynamic-fg, #fff)",
        paddingTop: "var(--tg-safe-top, 0px)",
        paddingBottom: "var(--tg-safe-bottom, 0px)",
      }}
    >
      <div className="w-full max-w-[420px] flex flex-col items-center justify-center h-dvh px-5 py-6 gap-10">
        {/* Circular Progress */}
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="block"
            style={{ transform: `rotate(${rotationOffset}deg)` }}
          >
            {/* Layer 1: Full dashed circle guide */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="var(--dynamic-bg, #000)"
              strokeWidth={6}
              strokeDasharray={`${dash} ${gap}`}
            />

            {/* Layer 2: Thick progress arc */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="var(--dynamic-bg, #000)"
              strokeWidth={thickStroke}
              strokeDasharray={`${fillLength} ${remainingArc}`}
              strokeLinecap="round"
            />

            {/* Layer 3: Dashed center line on filled portion */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="var(--dynamic-fg, #fff)"
              strokeWidth={5}
              strokeDasharray={`${dash} ${gap}`}
              mask="url(#arcMask)"
            />

            <defs>
              <mask id="arcMask">
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke="white"
                  strokeWidth={thickStroke}
                  strokeDasharray={`${fillLength} ${remainingArc}`}
                  strokeLinecap="round"
                />
              </mask>
            </defs>
          </svg>

          {/* Center percentage text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-['Roboto'] font-bold text-[64px] tracking-[-0.64px] leading-none"
              style={{ color: "var(--dynamic-bg, #000)" }}
            >
              {animatedPercent}%
            </span>
          </div>
        </div>

        {/* Bottom text */}
        <p
          className="font-['Roboto'] font-bold text-[26px] tracking-[-0.26px] text-center"
          style={{
            color: "var(--dynamic-bg, #000)",
            opacity: showText ? 1 : 0,
            transform: showText ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.4s ease, transform 0.4s ease",
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
