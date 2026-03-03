import { useEffect } from "react";

interface TimeoutScreenProps {
  onComplete: () => void;
  message?: string;
  duration?: number;
}

export function TimeoutScreen({ onComplete, message = "Brutal eligió por vos.", duration = 1500 }: TimeoutScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, duration);
    return () => clearTimeout(timer);
  }, [onComplete, duration]);

  return (
    <div className="h-dvh flex items-center justify-center font-['Roboto'] px-5 overflow-hidden"
      style={{
        backgroundColor: "var(--dynamic-fg, #fff)",
        paddingTop: "var(--tg-safe-top, 0px)",
        paddingBottom: "var(--tg-safe-bottom, 0px)",
      }}
    >
      <p
        className="font-['Roboto'] font-bold text-[30px] text-center tracking-[-0.3px] w-[284px] whitespace-pre-wrap"
        style={{ color: "var(--dynamic-bg, #000)" }}
      >
        {message}
      </p>
    </div>
  );
}