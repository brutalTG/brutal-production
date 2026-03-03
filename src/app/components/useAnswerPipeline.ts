// ============================================================
// useAnswerPipeline — Generic answer handling hook
// ============================================================
// Consolidates the lock → firstQ → latency → store → reward →
// reaction → transition pipeline shared by ALL question handlers.
// ============================================================

import { useCallback, useRef } from "react";
import type { Question } from "./drop-types";
import type { UserAnswer } from "./archetype-engine";
import { markFirstInteraction } from "./latency-tracker";
import { hapticMedium, hapticHeavy } from "./haptics";
import { pickReaction } from "./micro-reaction";
import { recordAnswer } from "./signal-store";
import { REWARD_ANIM_MS, REACTION_MS } from "./survey-constants";
import type { RewardEvent } from "./reward-animation";

// --- Types for the pipeline consumers ---

export interface AnswerContext {
  questionIndex: number;
  question: Question;
  latencyMs: number | undefined;
}

export interface PipelineActions {
  /** Standard flow: store answer → reward → reaction → advance (with result interstitial if q.result) */
  submitStandard: (answer: UserAnswer) => void;
  /** Like standard but with a delay before transition (used by ranking) */
  submitWithDelay: (answer: UserAnswer, delayMs: number) => void;
  /** Confesionario flow: store → reward → reaction → confession_secret screen */
  submitConfesionario: (answer: UserAnswer, message: string) => void;
  /** Trap flow: store → if correct: standard, if incorrect: penalty animation → trap_fail */
  submitTrap: (answer: UserAnswer, correct: boolean, penaltyValue: number) => void;
  /** Trap silent: store → if correct: reward, if wrong: silent penalty. Always transitions. */
  submitTrapSilent: (answer: UserAnswer, correct: boolean, penaltyValue: number) => void;
  /** Raw access to latency capture (for inline handlers like media_reaction) */
  captureLatency: () => number | undefined;
  /** Raw lock acquisition */
  acquireLock: () => boolean;
  /** Mark first question answered (for color switching) */
  markFirstAnswered: () => void;
  /** Store an answer without the full pipeline (dead_drop) */
  storeOnly: (qIdx: number, answer: UserAnswer) => void;
}

interface PipelineConfig {
  questionIndex: number;
  questions: Question[];
  // State setters
  setCoins: React.Dispatch<React.SetStateAction<number>>;
  setTickets: React.Dispatch<React.SetStateAction<number>>;
  setRewardEvent: React.Dispatch<React.SetStateAction<RewardEvent | null>>;
  setReactionText: React.Dispatch<React.SetStateAction<string | null>>;
  setResultConfig: React.Dispatch<React.SetStateAction<{ percentage: number; text: string }>>;
  setScreen: (screen: string) => void;
  setInterstitialMessage: React.Dispatch<React.SetStateAction<string>>;
  setTrapPenaltyValue: React.Dispatch<React.SetStateAction<number>>;
  // Refs
  answersRef: React.MutableRefObject<Record<number, UserAnswer>>;
  rewardIdRef: React.MutableRefObject<number>;
  reactionTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  firstQuestionAnswered: React.MutableRefObject<boolean>;
  // Navigation
  advanceWithMultiplierCheck: () => void;
}

export function useAnswerPipeline(config: PipelineConfig): PipelineActions {
  const {
    questionIndex, questions,
    setCoins, setTickets, setRewardEvent, setReactionText,
    setResultConfig, setScreen, setInterstitialMessage, setTrapPenaltyValue,
    answersRef, rewardIdRef, reactionTimerRef, firstQuestionAnswered,
    advanceWithMultiplierCheck,
  } = config;

  const answerLockedRef = useRef(false);

  // Reset lock when question changes — handled by the caller via questionIndex dep

  const acquireLock = useCallback((): boolean => {
    if (answerLockedRef.current) return false;
    answerLockedRef.current = true;
    return true;
  }, []);

  // Reset lock on question change
  // (We use the fact that this hook is called with a new questionIndex each time)
  const prevQIdx = useRef(questionIndex);
  if (prevQIdx.current !== questionIndex) {
    prevQIdx.current = questionIndex;
    answerLockedRef.current = false;
  }

  const captureLatency = useCallback((): number | undefined => {
    const ms = markFirstInteraction();
    return ms ?? undefined;
  }, []);

  const markFirstAnswered = useCallback(() => {
    if (questionIndex === 0 && !firstQuestionAnswered.current) {
      firstQuestionAnswered.current = true;
    }
  }, [questionIndex, firstQuestionAnswered]);

  const storeOnly = useCallback((qIdx: number, answer: UserAnswer) => {
    answersRef.current[qIdx] = answer;
    recordAnswer(qIdx, answer);
  }, [answersRef]);

  const storeAnswer = useCallback((answer: UserAnswer) => {
    answersRef.current[questionIndex] = answer;
    recordAnswer(questionIndex, answer);
  }, [questionIndex, answersRef]);

  const collectReward = useCallback(() => {
    const q = questions[questionIndex];
    if (!q.reward) return false;
    if (q.reward.type === "coins") {
      setCoins((c) => Math.round((c + q.reward!.value) * 100) / 100);
    } else {
      setTickets((t) => t + q.reward!.value);
    }
    hapticMedium();
    rewardIdRef.current += 1;
    setRewardEvent({ type: q.reward.type, value: q.reward.value, id: rewardIdRef.current });
    return true;
  }, [questionIndex, questions, setCoins, setTickets, setRewardEvent, rewardIdRef]);

  const showReaction = useCallback((latencyMs?: number) => {
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    const text = pickReaction(latencyMs);
    setReactionText(text);
    reactionTimerRef.current = setTimeout(() => {
      setReactionText(null);
      reactionTimerRef.current = null;
    }, REACTION_MS);
  }, [setReactionText, reactionTimerRef]);

  const transitionAfterReward = useCallback(
    (hasReward: boolean, go: () => void) => {
      const delay = hasReward ? REWARD_ANIM_MS : REACTION_MS;
      setTimeout(() => {
        setRewardEvent(null);
        setReactionText(null);
        go();
      }, delay);
    },
    [setRewardEvent, setReactionText]
  );

  const goToResultOrAdvance = useCallback(
    (q: Question, hasReward: boolean) => {
      if (q.result) {
        transitionAfterReward(hasReward, () => {
          setResultConfig(q.result!);
          setScreen("result");
        });
      } else {
        transitionAfterReward(hasReward, advanceWithMultiplierCheck);
      }
    },
    [transitionAfterReward, setResultConfig, setScreen, advanceWithMultiplierCheck]
  );

  // --- Public API ---

  const submitStandard = useCallback(
    (answer: UserAnswer) => {
      storeAnswer(answer);
      const hasReward = collectReward();
      showReaction((answer as { latencyMs?: number }).latencyMs);
      goToResultOrAdvance(questions[questionIndex], hasReward);
    },
    [storeAnswer, collectReward, showReaction, goToResultOrAdvance, questions, questionIndex]
  );

  const submitWithDelay = useCallback(
    (answer: UserAnswer, delayMs: number) => {
      storeAnswer(answer);
      const hasReward = collectReward();
      showReaction((answer as { latencyMs?: number }).latencyMs);
      setTimeout(() => {
        goToResultOrAdvance(questions[questionIndex], hasReward);
      }, delayMs);
    },
    [storeAnswer, collectReward, showReaction, goToResultOrAdvance, questions, questionIndex]
  );

  const submitConfesionario = useCallback(
    (answer: UserAnswer, message: string) => {
      storeAnswer(answer);
      const hasReward = collectReward();
      showReaction((answer as { latencyMs?: number }).latencyMs);
      setInterstitialMessage(message);
      transitionAfterReward(hasReward, () => {
        setScreen("confession_secret");
      });
    },
    [storeAnswer, collectReward, showReaction, setInterstitialMessage, transitionAfterReward, setScreen]
  );

  const submitTrap = useCallback(
    (answer: UserAnswer, correct: boolean, penaltyValue: number) => {
      storeAnswer(answer);
      if (correct) {
        const hasReward = collectReward();
        showReaction((answer as { latencyMs?: number }).latencyMs);
        transitionAfterReward(hasReward, advanceWithMultiplierCheck);
      } else {
        setTickets((t) => Math.max(0, t - penaltyValue));
        hapticHeavy();
        rewardIdRef.current += 1;
        setRewardEvent({ type: "tickets", value: penaltyValue, id: rewardIdRef.current, penalty: true });
        setTrapPenaltyValue(penaltyValue);
        setTimeout(() => {
          setRewardEvent(null);
          setScreen("trap_fail");
        }, REWARD_ANIM_MS);
      }
    },
    [storeAnswer, collectReward, showReaction, transitionAfterReward, advanceWithMultiplierCheck, setTickets, setRewardEvent, rewardIdRef, setTrapPenaltyValue, setScreen]
  );

  const submitTrapSilent = useCallback(
    (answer: UserAnswer, correct: boolean, penaltyValue: number) => {
      storeAnswer(answer);
      const q = questions[questionIndex];
      if (correct) {
        collectReward();
        showReaction((answer as { latencyMs?: number }).latencyMs);
      } else {
        setTickets((t) => Math.max(0, t - penaltyValue));
        showReaction((answer as { latencyMs?: number }).latencyMs);
      }
      const hasReward = correct && !!q.reward;
      goToResultOrAdvance(q, hasReward || !correct);
    },
    [storeAnswer, questions, questionIndex, collectReward, showReaction, setTickets, goToResultOrAdvance]
  );

  return {
    submitStandard,
    submitWithDelay,
    submitConfesionario,
    submitTrap,
    submitTrapSilent,
    captureLatency,
    acquireLock,
    markFirstAnswered,
    storeOnly,
  };
}
