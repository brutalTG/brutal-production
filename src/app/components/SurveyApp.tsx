// ============================================================
// SURVEY APP — Main survey flow component
// ============================================================

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { RewardEvent } from "./reward-animation";
import type { UserAnswer } from "./archetype-engine";
import type { Question, MultiplierCheckpoint, Drop } from "./drop-types";

// --- Screens ---
import { SplashScreen } from "./splash-screen";
import { CountdownScreen } from "./countdown-screen";
import { TimeoutScreen } from "./timeout-screen";
import { ResultScreen } from "./result-screen";
import { MultiplierUnlockScreen } from "./multiplier-unlock-screen";
import { TrapFailScreen } from "./trap-fail-screen";
import { RevealScreen } from "./reveal-screen";
import { SharedResultPage, parseSharedResult, buildShareUrl } from "./shared-result-page";
import { ShareCard } from "./share-card";
import { MicroReaction } from "./micro-reaction";
import { ProfileScreen } from "./profile-screen";
import { LeaderboardScreen } from "./leaderboard-screen";

// --- Extracted modules ---
import { StoryProgressBar, TimerBar, PlayingBadge, StatPills } from "./SurveyHeader";
import { QuestionRenderer } from "./QuestionRenderer";
import { useAnswerPipeline } from "./useAnswerPipeline";
import {
  REACTION_MS,
  pickTimeoutMessage, buildQuestionOptionsMap, FULLSCREEN_TYPES,
} from "./survey-constants";

// --- Services ---
import { initTelegramSDK, closeMiniApp, getTelegramUserId, getTelegramPlatform } from "./telegram-sdk";
import { markQuestionRendered, getAverageLatency, getInstinctiveCount, getDoubtCount, getTotalTime, formatLatency, resetRecords, getRecords } from "./latency-tracker";
import { getNextDuotonePair } from "./color-generator";
import { startSession, finalizeSession, exportSessionJSON, updateCurrentPosition } from "./signal-store";
import { computeDimensionsWithOptions, pickArchetype } from "./archetype-engine";
import { getReferralLink, detectReferral } from "./referral";
import { uploadSession, waitForUpload, claimRewards } from "./session-uploader";
import { CURRENT_DROP } from "./sample-drop";
import { fetchActiveDrop, fetchPreviewDrop } from "./drop-api";
import { projectId, publicAnonKey } from "/utils/supabase/info";

// ============================================================
// Node Status Gate — checks if Telegram user is an active node
// ============================================================

type NodeStatus = "loading" | "active" | "pending" | "blocked" | "not_found" | "unknown" | "error" | "segment_denied";

function useNodeGate() {
  const [status, setStatus] = useState<NodeStatus>("loading");
  const [nickname, setNickname] = useState<string | null>(null);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const telegramUserId = getTelegramUserId();
    // If not running inside Telegram, skip the gate (dev/preview mode)
    if (!telegramUserId) {
      console.log("[BRUTAL] No Telegram user ID — skipping node gate (dev mode)");
      setStatus("active");
      return;
    }

    // Check preview mode
    const params = new URLSearchParams(window.location.search);
    if (params.has("preview")) {
      console.log("[BRUTAL] Preview mode — skipping node gate");
      setStatus("active");
      return;
    }

    const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-c68eb08c`;

    // Step 1: Check node status
    fetch(`${API_BASE}/node-status?telegramUserId=${telegramUserId}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then((r) => r.json())
      .then((data) => {
        console.log(`[BRUTAL] Node status for ${telegramUserId}:`, data);
        setNickname(data.nickname || null);

        if (data.status !== "active") {
          setStatus(data.status || "unknown");
          return;
        }

        // Step 2: Check segment access for active nodes
        fetch(`${API_BASE}/check-drop-access?telegramUserId=${telegramUserId}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        })
          .then((r) => r.json())
          .then((access) => {
            console.log(`[BRUTAL] Drop access for ${telegramUserId}:`, access);
            if (access.allowed === false && access.reason === "not-in-segment") {
              setStatus("segment_denied");
            } else {
              setStatus("active");
            }
          })
          .catch((err) => {
            console.error("[BRUTAL] Segment access check failed:", err);
            // On error, allow access
            setStatus("active");
          });
      })
      .catch((err) => {
        console.error("[BRUTAL] Node gate check failed:", err);
        // On error, allow access to not block users
        setStatus("active");
      });
  }, []);

  return { status, nickname };
}

function NodeGateScreen({ status, nickname }: { status: NodeStatus; nickname: string | null }) {
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#222] flex items-center justify-center mb-6">
        <span className="text-2xl font-bold text-white font-['Silkscreen']">B</span>
      </div>

      {status === "loading" && (
        <>
          <div className="w-6 h-6 border-2 border-[#333] border-t-white rounded-full animate-spin mb-4" />
          <p className="text-sm text-[#666] font-['Fira_Code']">Verificando acceso...</p>
        </>
      )}

      {status === "pending" && (
        <>
          <h1 className="text-xl font-bold text-white mb-3 font-['Silkscreen']">EN FILA</h1>
          {nickname && <p className="text-sm text-[#888] mb-2">Hola {nickname}</p>}
          <p className="text-sm text-[#666] max-w-[280px] leading-relaxed">
            Tu aplicacion esta siendo revisada. Te vamos a avisar cuando estes adentro.
          </p>
          <div className="mt-6 px-4 py-2 bg-[#111] border border-[#222] rounded-lg">
            <p className="text-[10px] text-[#555] font-['Fira_Code'] uppercase tracking-wider">STATUS: PENDING</p>
          </div>
        </>
      )}

      {status === "blocked" && (
        <>
          <h1 className="text-xl font-bold text-red-400 mb-3 font-['Silkscreen']">BLOQUEADO</h1>
          <p className="text-sm text-[#666] max-w-[280px] leading-relaxed">
            Tu acceso fue revocado. Si crees que es un error, contacta al equipo.
          </p>
          <div className="mt-6 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-[10px] text-red-400 font-['Fira_Code'] uppercase tracking-wider">STATUS: BLOCKED</p>
          </div>
        </>
      )}

      {status === "not_found" && (
        <>
          <h1 className="text-xl font-bold text-yellow-400 mb-3 font-['Silkscreen']">SIN ACCESO</h1>
          <p className="text-sm text-[#666] max-w-[280px] leading-relaxed">
            No encontramos tu aplicacion. Ingresa por /entrar para registrarte primero.
          </p>
          <div className="mt-6 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-[10px] text-yellow-400 font-['Fira_Code'] uppercase tracking-wider">NO APPLICATION</p>
          </div>
        </>
      )}

      {status === "segment_denied" && (
        <>
          <h1 className="text-xl font-bold text-red-400 mb-3 font-['Silkscreen']">ACCESO DENEGADO</h1>
          <p className="text-sm text-[#666] max-w-[280px] leading-relaxed">
            No tienes acceso a este contenido. Si crees que es un error, contacta al equipo.
          </p>
          <div className="mt-6 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-[10px] text-red-400 font-['Fira_Code'] uppercase tracking-wider">STATUS: SEGMENT DENIED</p>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Drop Loader  fetches active/preview drop or falls back
// ============================================================

function useDropLoader() {
  // Start with fallback immediately — no loading screen blocks the UI.
  // The fetch runs in background; if a server/preview drop arrives it swaps in
  // while the user is still on splash/countdown (~5s buffer).
  const [drop, setDrop] = useState<Drop>(CURRENT_DROP);
  const [source, setSource] = useState<"server" | "preview" | "fallback">("fallback");
  const fetchStarted = useRef(false);

  useEffect(() => {
    if (fetchStarted.current) return;
    fetchStarted.current = true;

    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams(window.location.search);
        const isPreview = params.has("preview");

        if (isPreview) {
          const previewDrop = await fetchPreviewDrop();
          if (!cancelled && previewDrop) {
            setDrop(previewDrop);
            setSource("preview");
            return;
          }
        }

        const serverDrop = await fetchActiveDrop();
        if (!cancelled && serverDrop) {
          setDrop(serverDrop);
          setSource("server");
        }
      } catch (err) {
        console.error("[BRUTAL] Drop loader error, keeping fallback:", err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { drop, source };
}

// ============================================================
// Main Survey Component
// ============================================================

export default function SurveyApp() {
  const { drop, source } = useDropLoader();
  const { status: nodeStatus, nickname } = useNodeGate();

  // Shared result page intercept (doesn't need drop)
  const sharedResult = parseSharedResult();
  if (sharedResult) return <SharedResultPage data={sharedResult} />;

  // Node gate: block access for non-active nodes (inside Telegram only)
  if (nodeStatus === "loading" || nodeStatus === "pending" || nodeStatus === "blocked" || nodeStatus === "not_found" || nodeStatus === "segment_denied") {
    return <NodeGateScreen status={nodeStatus} nickname={nickname} />;
  }

  // drop is always available (starts with fallback), no loading gate needed
  return <SurveyCore drop={drop} source={source} />;
}

// ============================================================
// Survey Core — all logic lives here, receives loaded drop
// ============================================================

function SurveyCore({ drop, source }: { drop: Drop; source: string }) {
  // --- Derived from drop (memoized) ---
  const questions: Question[] = drop.questions;
  const totalQuestions = questions.length;
  const MULTIPLIER_CHECKPOINTS = useMemo<Record<number, MultiplierCheckpoint>>(() =>
    Object.fromEntries(Object.entries(drop.multiplierCheckpoints).map(([k, v]) => [Number(k), v])),
    [drop]
  );
  const questionOptionsMap = useMemo(() => buildQuestionOptionsMap(questions), [questions]);

  // --- Core state ---
  const [screen, setScreen] = useState<ScreenType>("splash");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [interstitialMessage, setInterstitialMessage] = useState(drop.timeoutMessage || "Brutal eligio por vos.");
  const [resultConfig, setResultConfig] = useState<{ percentage: number; text: string }>({ percentage: 50, text: "" });

  // --- Rewards ---
  const [coins, setCoins] = useState(0);
  const [tickets, setTickets] = useState(0);
  const [rewardEvent, setRewardEvent] = useState<RewardEvent | null>(null);
  const rewardIdRef = useRef(0);

  // --- Multiplier ---
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [pendingMultiplier, setPendingMultiplier] = useState<{ multiplier: number; label: string } | null>(null);
  const [trapPenaltyValue, setTrapPenaltyValue] = useState(0);

  // --- Micro-reaction ---
  const [reactionText, setReactionText] = useState<string | null>(null);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Refs ---
  const answersRef = useRef<Record<number, UserAnswer>>({});
  const sessionFinalizedRef = useRef(false);
  const firstQuestionAnswered = useRef(false);

  // --- Duotone colors ---
  const [duotoneColors, setDuotoneColors] = useState({ bg: "#000000", fg: "#FFFFFF" });

  useEffect(() => {
    document.body.style.setProperty("--dynamic-bg", duotoneColors.bg);
    document.body.style.setProperty("--dynamic-fg", duotoneColors.fg);
    document.body.style.backgroundColor = duotoneColors.bg;
    document.body.style.color = duotoneColors.fg;
  }, [duotoneColors]);

  const changeColors = useCallback(() => {
    if (!firstQuestionAnswered.current) return;
    const newPair = getNextDuotonePair();
    setDuotoneColors({ bg: newPair.bg, fg: newPair.fg });
  }, []);

  useEffect(() => { changeColors(); }, [screen, questionIndex, changeColors]);

  // --- Init ---
  useEffect(() => { initTelegramSDK(); detectReferral(); }, []);

  // --- Log source ---
  useEffect(() => {
    console.log(`[BRUTAL] Drop loaded from: ${source} — "${drop.name}" (${drop.id}) with ${totalQuestions} questions`);
  }, [drop, source, totalQuestions]);

  // --- Abandon tracking ---
  useEffect(() => {
    const onHidden = () => { if (document.visibilityState === "hidden" && screen === "question") updateCurrentPosition(questionIndex); };
    const onUnload = () => { if (screen === "question") updateCurrentPosition(questionIndex); };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("beforeunload", onUnload);
    return () => { document.removeEventListener("visibilitychange", onHidden); window.removeEventListener("beforeunload", onUnload); };
  }, [screen, questionIndex]);

  // --- Derived ---
  const currentQuestion = questionIndex < totalQuestions ? questions[questionIndex] : null;

  // --- Navigation ---
  const goToNextQuestion = useCallback(() => {
    setRewardEvent(null);
    setReactionText(null);
    if (questionIndex < totalQuestions - 1) {
      setQuestionIndex((i) => i + 1);
      setScreen("question");
    } else {
      setScreen("reveal");
    }
  }, [questionIndex, totalQuestions]);

  const advanceWithMultiplierCheck = useCallback(() => {
    const checkpoint = MULTIPLIER_CHECKPOINTS[questionIndex];
    if (checkpoint) {
      setPendingMultiplier(checkpoint);
      setScreen("multiplier");
    } else {
      goToNextQuestion();
    }
  }, [questionIndex, goToNextQuestion, MULTIPLIER_CHECKPOINTS]);

  // --- Answer pipeline ---
  const pipeline = useAnswerPipeline({
    questionIndex,
    questions,
    setCoins, setTickets, setRewardEvent, setReactionText,
    setResultConfig, setScreen: setScreen as (s: string) => void,
    setInterstitialMessage, setTrapPenaltyValue,
    answersRef, rewardIdRef, reactionTimerRef, firstQuestionAnswered,
    advanceWithMultiplierCheck,
  });

  // --- Latency tracking ---
  useEffect(() => {
    if (screen === "question" && currentQuestion) {
      markQuestionRendered(questionIndex, currentQuestion.type);
      updateCurrentPosition(questionIndex);
    }
  }, [screen, questionIndex, currentQuestion]);

  // --- Archetype computation ---
  const computeArchetype = useCallback(() => {
    const reveal = drop.reveal;
    if (!reveal.archetypes || !reveal.scoring || reveal.archetypes.length === 0) return null;
    const avgLatency = getAverageLatency();
    const dims = computeDimensionsWithOptions(answersRef.current, reveal.scoring, avgLatency, questionOptionsMap);
    return pickArchetype(dims, reveal.archetypes);
  }, [drop, questionOptionsMap]);

  // ====== SCREEN RENDERING ======

  if (screen === "splash") {
    const tgUserId = getTelegramUserId();
    return (
      <SplashScreen
        onEnter={() => setScreen("countdown")}
        totalCards={totalQuestions}
        onProfile={tgUserId ? () => setScreen("profile") : undefined}
        onLeaderboard={() => setScreen("leaderboard")}
        splash={drop.splash}
      />
    );
  }

  if (screen === "countdown") {
    return (
      <CountdownScreen
        onComplete={() => {
          resetRecords();
          startSession(drop.id, drop.name, getTelegramPlatform(), getTelegramUserId());
          setScreen("question");
        }}
      />
    );
  }

  if (screen === "timeout" || screen === "confession_secret") {
    return <TimeoutScreen message={interstitialMessage} onComplete={advanceWithMultiplierCheck} />;
  }

  if (screen === "result") {
    return <ResultScreen percentage={resultConfig.percentage} text={resultConfig.text} onContinue={advanceWithMultiplierCheck} />;
  }

  if (screen === "multiplier" && pendingMultiplier) {
    return (
      <MultiplierUnlockScreen
        multiplier={pendingMultiplier.label}
        onComplete={() => {
          setCurrentMultiplier(pendingMultiplier.multiplier);
          setPendingMultiplier(null);
          goToNextQuestion();
        }}
      />
    );
  }

  if (screen === "trap_fail") {
    return <TrapFailScreen penaltyValue={trapPenaltyValue} onComplete={advanceWithMultiplierCheck} />;
  }

  if (screen === "reveal") {
    const avgLatency = getAverageLatency();
    const instinctive = getInstinctiveCount();
    const doubts = getDoubtCount();
    const totalTime = getTotalTime();
    const archetype = computeArchetype();
    const revealTitle = archetype ? archetype.title : drop.reveal.title;
    const revealDescription = archetype ? archetype.description : drop.reveal.description;

    if (!sessionFinalizedRef.current) {
      sessionFinalizedRef.current = true;
      const archetypeData = archetype ? { id: archetype.id, title: archetype.title } : undefined;
      const session = finalizeSession(questions, getRecords(), { coins, tickets, multiplier: currentMultiplier }, archetypeData, getTelegramUserId());
      if (session) {
        console.log("[BRUTAL] Session finalized:", exportSessionJSON(session));
        uploadSession(session);
      }
    }

    const referralLink = getReferralLink();
    const shareUrl = buildShareUrl({ title: revealTitle, description: revealDescription, dropName: drop.name, latency: formatLatency(avgLatency), totalTime });
    const tgUserId = getTelegramUserId();

    const finalTickets = Math.round(tickets * currentMultiplier);

    return (
      <RevealScreen
        title={revealTitle}
        description={revealDescription}
        metrics={{ latency: formatLatency(avgLatency), instinctiveResponses: `${instinctive}/${totalQuestions}`, doubtMoments: `${doubts}`, totalTime }}
        coins={coins}
        tickets={tickets}
        multiplier={currentMultiplier}
        onClaim={() => { closeMiniApp(); }}
        onClaimRewards={async () => {
          try {
            // Ensure session data is saved first
            await waitForUpload();
            // Then claim rewards on the server
            if (tgUserId) {
              const result = await claimRewards({
                telegramUserId: tgUserId,
                dropId: drop.id,
                coins,
                tickets,
                finalTickets,
              });
              console.log("[BRUTAL] Claim rewards result:", result);
              return result.ok;
            }
            console.warn("[BRUTAL] No telegramUserId for claim — skipping server claim (preview mode)");
            return true; // No user to credit, but let the UI animation proceed
          } catch (err) {
            console.error("[BRUTAL] Claim rewards error:", err);
            return false;
          }
        }}
        onProfile={tgUserId ? () => setScreen("profile") : undefined}
        onLeaderboard={() => setScreen("leaderboard")}
        shareCard={
          <ShareCard
            title={revealTitle}
            description={revealDescription}
            dropName={drop.name}
            metrics={{ latency: formatLatency(avgLatency), instinctiveResponses: `${instinctive}/${totalQuestions}`, totalTime }}
            referralLink={referralLink}
            shareUrl={shareUrl}
          />
        }
      />
    );
  }

  if (screen === "profile") {
    const tgUserId = getTelegramUserId();
    if (!tgUserId) { setScreen(sessionFinalizedRef.current ? "reveal" : "splash"); return null; }
    return (
      <ProfileScreen
        telegramUserId={tgUserId}
        onBack={() => setScreen(sessionFinalizedRef.current ? "reveal" : "splash")}
        onLeaderboard={() => setScreen("leaderboard")}
      />
    );
  }

  if (screen === "leaderboard") {
    return (
      <LeaderboardScreen
        telegramUserId={getTelegramUserId()}
        onBack={() => setScreen(sessionFinalizedRef.current ? "reveal" : "splash")}
        onProfile={() => setScreen("profile")}
      />
    );
  }

  // ====== QUESTION SCREEN ======
  if (screen !== "question" || !currentQuestion) return null;

  // Full-screen question types bypass the header layout
  if (FULLSCREEN_TYPES.has(currentQuestion.type)) {
    return (
      <QuestionRenderer
        question={currentQuestion}
        questionIndex={questionIndex}
        pipeline={pipeline}
        reactionText={reactionText}
        advanceWithMultiplierCheck={advanceWithMultiplierCheck}
        setResultConfig={setResultConfig}
        setScreen={setScreen as (s: string) => void}
      />
    );
  }

  // Standard layout: header + question content
  const formattedCoins = coins % 1 === 0 ? coins.toString() : coins.toFixed(2).replace(".", ",");
  const formattedTickets = tickets.toLocaleString("es-AR");
  const isPenalty = !!rewardEvent?.penalty;

  return (
    <div
      className="h-dvh flex justify-center font-['Roboto'] overflow-hidden"
      style={{ backgroundColor: duotoneColors.bg, color: duotoneColors.fg }}
    >
      <div
        className="w-full max-w-[420px] flex flex-col h-dvh px-5 overflow-hidden"
        style={{
          paddingTop: "calc(var(--tg-safe-top, 0px) + 24px)",
          paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 24px)",
        }}
      >
        {/* Story Progress Bar */}
        <div className="w-full mb-3">
          <StoryProgressBar total={totalQuestions} current={questionIndex} />
        </div>

        {/* Top Header */}
        <div className="w-full flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-['Silkscreen'] text-sm tracking-wide" style={{ color: duotoneColors.fg }}>
                BRUTAL////////////////
              </span>
              {currentMultiplier > 1 && (
                <span
                  className="font-['Fira_Code'] text-[11px] px-2 py-0.5 rounded-full font-bold"
                  style={{ color: duotoneColors.fg, backgroundColor: `${duotoneColors.fg}1a` }}
                >
                  x{currentMultiplier.toFixed(2).replace(/\.?0+$/, "")}
                </span>
              )}
            </div>
            <PlayingBadge />
          </div>

          <div className="flex items-center w-full gap-1.5">
            <div className="w-[45%] shrink-0">
              <TimerBar
                key={questionIndex}
                duration={currentQuestion.timer}
                onTimeUp={() => {
                  pipeline.storeOnly(questionIndex, { type: "timeout" });
                  setInterstitialMessage(pickTimeoutMessage());
                  setScreen("timeout");
                }}
              />
            </div>
            <StatPills
              formattedCoins={formattedCoins}
              formattedTickets={formattedTickets}
              rewardEvent={rewardEvent}
              isPenalty={isPenalty}
            />
          </div>
        </div>

        {/* Question Content */}
        <div className="flex-1 flex flex-col gap-8 overflow-y-auto overflow-x-hidden">
          <QuestionRenderer
            question={currentQuestion}
            questionIndex={questionIndex}
            pipeline={pipeline}
            reactionText={reactionText}
            advanceWithMultiplierCheck={advanceWithMultiplierCheck}
            setResultConfig={setResultConfig}
            setScreen={setScreen as (s: string) => void}
          />
        </div>
      </div>

      {/* Micro-reaction overlay */}
      {reactionText && currentQuestion.type !== "hot_take" && currentQuestion.type !== "hot_take_visual" && (
        <MicroReaction text={reactionText} duration={REACTION_MS} />
      )}
    </div>
  );
}

type ScreenType = "splash" | "countdown" | "question" | "result" | "timeout" | "confession_secret" | "multiplier" | "trap_fail" | "reveal" | "profile" | "leaderboard";