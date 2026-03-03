import { useState, useEffect, useRef } from "react";
import { hapticRigid, hapticHeavy } from "./haptics";

interface CountdownScreenProps {
  onComplete: () => void;
}

export function CountdownScreen({ onComplete }: CountdownScreenProps) {
  const [count, setCount] = useState(3);
  const [scale, setScale] = useState(1);
  const completedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        hapticRigid();
        return prev - 1;
      });
    }, 700);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (count === 0 && !completedRef.current) {
      completedRef.current = true;
      hapticHeavy();
      onComplete();
    }
  }, [count, onComplete]);

  return (
    <div className="flex items-center justify-center h-dvh bg-[#000] overflow-hidden"
      style={{
        paddingTop: "var(--tg-safe-top, 0px)",
        paddingBottom: "var(--tg-safe-bottom, 0px)",
      }}
    >
      <span
        className="font-['Roboto'] font-bold text-white text-[128px] text-center leading-none select-none"
        style={{
          transform: `scale(${scale})`,
          transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
          opacity: count >= 0 ? 1 : 0,
        }}
      >
        {count}
      </span>
    </div>
  );
}