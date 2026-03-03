import { useState, useEffect, useRef, useCallback } from "react";

interface DeadDropScreenProps {
  firstLine: string;
  codeLines: string[];
  lastLines: string[];
  onComplete: () => void;
}

const TYPEWRITER_SPEED = 55; // ms per character
const CODE_LINE_DELAY = 90; // ms between code lines appearing
const CURSOR_BLINK_MS = 400; // ms per blink cycle
const CURSOR_BLINKS = 2; // blink N times after everything is done
const POST_BLINK_DELAY = 400; // ms after last blink before auto-advancing

export function DeadDropScreen({
  firstLine,
  codeLines,
  lastLines,
  onComplete,
}: DeadDropScreenProps) {
  // Phases: "typing_first" → "code_reveal" → "typing_last" → "cursor_blink" → "done"
  const [phase, setPhase] = useState<
    "typing_first" | "code_reveal" | "typing_last" | "cursor_blink" | "done"
  >("typing_first");

  // First line typewriter
  const [firstLineText, setFirstLineText] = useState("");

  // Code block reveal (line by line)
  const [visibleCodeLines, setVisibleCodeLines] = useState(0);

  // Last lines typewriter (types each line sequentially)
  const [lastLinesText, setLastLinesText] = useState<string[]>(() =>
    lastLines.map(() => "")
  );
  const [currentLastLineIdx, setCurrentLastLineIdx] = useState(0);

  // Cursor blink
  const [cursorVisible, setCursorVisible] = useState(true);
  const blinkCountRef = useRef(0);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Phase 1: Typewriter for first line
  useEffect(() => {
    if (phase !== "typing_first") return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i <= firstLine.length) {
        setFirstLineText(firstLine.slice(0, i));
      } else {
        clearInterval(interval);
        // Small pause then move to code
        setTimeout(() => setPhase("code_reveal"), 300);
      }
    }, TYPEWRITER_SPEED);
    return () => clearInterval(interval);
  }, [phase, firstLine]);

  // Phase 2: Reveal code lines one by one
  useEffect(() => {
    if (phase !== "code_reveal") return;
    let line = 0;
    const interval = setInterval(() => {
      line++;
      if (line <= codeLines.length) {
        setVisibleCodeLines(line);
      } else {
        clearInterval(interval);
        setTimeout(() => setPhase("typing_last"), 250);
      }
    }, CODE_LINE_DELAY);
    return () => clearInterval(interval);
  }, [phase, codeLines.length]);

  // Phase 3: Typewriter for last lines (one after another)
  useEffect(() => {
    if (phase !== "typing_last") return;
    const lineIdx = currentLastLineIdx;
    if (lineIdx >= lastLines.length) {
      setPhase("cursor_blink");
      return;
    }

    const fullText = lastLines[lineIdx];
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i <= fullText.length) {
        setLastLinesText((prev) => {
          const next = [...prev];
          next[lineIdx] = fullText.slice(0, i);
          return next;
        });
      } else {
        clearInterval(interval);
        setTimeout(() => setCurrentLastLineIdx((idx) => idx + 1), 120);
      }
    }, TYPEWRITER_SPEED);
    return () => clearInterval(interval);
  }, [phase, currentLastLineIdx, lastLines]);

  // Phase 4: Cursor blinks twice then auto-advance
  useEffect(() => {
    if (phase !== "cursor_blink") return;
    blinkCountRef.current = 0;

    const interval = setInterval(() => {
      setCursorVisible((v) => {
        if (!v) blinkCountRef.current++;
        return !v;
      });

      if (blinkCountRef.current >= CURSOR_BLINKS) {
        clearInterval(interval);
        setCursorVisible(false);
        setTimeout(() => {
          setPhase("done");
          onCompleteRef.current();
        }, POST_BLINK_DELAY);
      }
    }, CURSOR_BLINK_MS);

    return () => clearInterval(interval);
  }, [phase]);

  // Determine if the cursor block should show (always during typing, blinks at end)
  const showCursor =
    phase === "typing_first" ||
    phase === "typing_last" ||
    (phase === "cursor_blink" && cursorVisible);

  // Find where the cursor should attach
  const cursorBlock = (
    <span
      className="inline-block w-[8px] h-[15px] align-middle ml-[2px]"
      style={{ backgroundColor: "var(--dynamic-fg, #fff)", opacity: showCursor ? 1 : 0 }}
    />
  );

  return (
    <div className="h-dvh flex justify-center font-['Fira_Code'] overflow-hidden" style={{ backgroundColor: "var(--dynamic-bg, #000)" }}>
      <div
        className="w-full max-w-[420px] flex flex-col justify-center h-dvh px-5"
        style={{
          paddingTop: "calc(var(--tg-safe-top, 0px) + 24px)",
          paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 24px)",
        }}
      >
        <div className="flex flex-col gap-0">
          {/* First line — Silkscreen typewriter */}
          <p className="font-['Silkscreen'] text-[15px] leading-[22px] mb-0 whitespace-pre-wrap" style={{ color: "var(--dynamic-fg, #fff)" }}>
            {firstLineText}
            {phase === "typing_first" && cursorBlock}
          </p>

          {/* Empty line spacer */}
          <div className="h-[22px]" />

          {/* Code block — Fira Code, line by line reveal */}
          {codeLines.slice(0, visibleCodeLines).map((line, i) => (
            <p
              key={i}
              className="text-[14px] leading-[22px] mb-0 whitespace-pre-wrap"
              style={{ color: "var(--dynamic-fg, #fff)" }}
            >
              {line || "\u00A0"}
            </p>
          ))}

          {/* Spacer after code (show once code is fully visible) */}
          {visibleCodeLines >= codeLines.length && (
            <>
              <div className="h-[22px]" />

              {/* Last lines — Silkscreen typewriter */}
              {lastLines.map((_, i) => {
                const text = lastLinesText[i];
                const isCurrentLine =
                  phase === "typing_last" && i === currentLastLineIdx;
                const isLastTypedLine =
                  phase === "cursor_blink" && i === lastLines.length - 1;

                return (
                  <p
                    key={i}
                    className="font-['Silkscreen'] text-[15px] leading-[22px] mb-0 whitespace-pre-wrap"
                    style={{ color: "var(--dynamic-fg, #fff)" }}
                  >
                    {text || (i < currentLastLineIdx ? lastLines[i] : "\u00A0")}
                    {(isCurrentLine || isLastTypedLine) && cursorBlock}
                  </p>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}