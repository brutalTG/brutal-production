// ============================================================
// DROP JSON SCHEMA — Complete type definitions
// ============================================================
// This file defines the structure of a Drop JSON.
// A Drop is a complete sequence of interactions (questions,
// interstitials, dead drops) that a user plays through.
// ============================================================

export interface RafagaItem {
  text: string;
  optionA: string;
  optionB: string;
}

// --- Question content by type ---

export interface ChoiceQuestion {
  type: "choice";
  text: string;
  /** 2–6 options */
  options: string[];
}

export interface PredictionBetQuestion {
  type: "prediction_bet";
  text: string;
  optionA: string;
  optionB: string;
  /** Max tickets for the bet slider (default: 100) */
  maxTickets?: number;
}

export interface RankingQuestion {
  type: "ranking";
  text: string;
  /** 3–5 items to rank */
  options: string[];
}

export interface ConfesionarioQuestion {
  type: "confesionario";
  text: string;
  /** Message shown on interstitial after submitting (default: "Nadie nunca va a saber lo que escribiste.") */
  interstitialMessage?: string;
}

export interface SliderQuestion {
  type: "slider";
  text: string;
  /** Min value (default: 0) */
  min?: number;
  /** Max value (default: 10) */
  max?: number;
  /** Label for the left end (default: "Nada") */
  labelLeft?: string;
  /** Label for the right end (default: "Totalmente") */
  labelRight?: string;
}

export interface BinaryMediaQuestion {
  type: "binary_media";
  /** URL of the image to display */
  imageUrl: string;
  optionA: string;
  optionB: string;
}

export interface RafagaQuestion {
  type: "rafaga";
  /** Introductory prompt text */
  prompt: string;
  /** Bold part of the prompt */
  promptBold: string;
  /** 2–8 rapid-fire items */
  items: RafagaItem[];
  /** Seconds per item before auto-advance (default: 3) */
  secondsPerItem?: number;
}

export interface DeadDropQuestion {
  type: "dead_drop";
  /** First line typed with Silkscreen typewriter effect */
  firstLine: string;
  /** Code block lines revealed one by one in Fira Code */
  codeLines: string[];
  /** Final lines typed with Silkscreen typewriter */
  lastLines: string[];
  /** Optional hourly variations. Key = hour range "HH-HH" (24h). Overrides default content. */
  hourVariations?: DeadDropVariation[];
}

export interface DeadDropVariation {
  /** Start hour (0-23 inclusive) */
  fromHour: number;
  /** End hour (0-23 inclusive, wraps midnight if from > to) */
  toHour: number;
  /** Override firstLine */
  firstLine?: string;
  /** Override codeLines */
  codeLines?: string[];
  /** Override lastLines */
  lastLines?: string[];
}

export interface TrapQuestion {
  type: "trap";
  text: string;
  /** 2–4 options */
  options: string[];
  /** 0-based index of the correct answer */
  correctIndex: number;
  /** Tickets deducted on wrong answer */
  penalty: number;
}

export interface HotTakeQuestion {
  type: "hot_take";
  /** Statement shown with typewriter effect */
  text: string;
  /** 2–4 response options */
  options: string[];
}

export interface TrapSilentQuestion {
  type: "trap_silent";
  /** Looks like a normal choice — user doesn't know it's a trap */
  text: string;
  /** 2–4 options */
  options: string[];
  /** 0-based index of the correct answer */
  correctIndex: number;
  /** Tickets deducted silently on wrong answer */
  penalty: number;
}

// --- New _visual formats (P4) ---

export interface ChoiceEmojiQuestion {
  type: "choice_emoji";
  /** Premise text (can be empty — emojis alone are the interaction) */
  text: string;
  /** 2–3 emoji options */
  options: string[];
}

export interface ChoiceHybridQuestion {
  type: "choice_hybrid";
  /** Premise text */
  text: string;
  /** Options with emoji embedded (e.g. "Sobrevivo 😏") */
  options: string[];
}

export interface SliderEmojiQuestion {
  type: "slider_emoji";
  text: string;
  min?: number;
  max?: number;
  /** Emoji for left extreme (e.g. "🫣") */
  labelLeft: string;
  /** Emoji for right extreme (e.g. "😏") */
  labelRight: string;
}

export interface RafagaEmojiQuestion {
  type: "rafaga_emoji";
  prompt: string;
  promptBold: string;
  items: RafagaItem[];
  secondsPerItem?: number;
}

export interface HotTakeVisualQuestion {
  type: "hot_take_visual";
  text: string;
  options: string[];
}

export interface MediaReactionQuestion {
  type: "media_reaction";
  /** URL of the background image */
  imageUrl: string;
  /** Optional short text overlay on top of media */
  text?: string;
  /** Interaction mode: "emoji" = 2 emoji buttons, "slider" = emoji slider */
  mode: "emoji" | "slider";
  /** For mode "emoji": 2 emoji options */
  options?: string[];
  /** For mode "slider": emoji labels + range */
  labelLeft?: string;
  labelRight?: string;
  min?: number;
  max?: number;
}

export type QuestionContent =
  | ChoiceQuestion
  | PredictionBetQuestion
  | RankingQuestion
  | ConfesionarioQuestion
  | SliderQuestion
  | BinaryMediaQuestion
  | RafagaQuestion
  | DeadDropQuestion
  | TrapQuestion
  | HotTakeQuestion
  | TrapSilentQuestion
  | ChoiceEmojiQuestion
  | ChoiceHybridQuestion
  | SliderEmojiQuestion
  | RafagaEmojiQuestion
  | HotTakeVisualQuestion
  | MediaReactionQuestion;

// --- Question metadata (applies to all types) ---

export interface QuestionMeta {
  /** Server-side question UUID, injected at runtime by dbToPlayableDrop. */
  id?: string;
  /** Timer in seconds. Use 0 for dead_drop (no timer shown). */
  timer: number;
  /** Reward given on completion. Omit for no reward. */
  reward?: {
    type: "coins" | "tickets";
    value: number;
  };
  /** If present, shows the ResultScreen interstitial after answering */
  result?: {
    /** Percentage to display, e.g. 73 → "73%" */
    percentage: number;
    /** Text shown below percentage, e.g. "Opina igual que vos." */
    text: string;
  };
  /** Signal Pair ID — links two cards that should be read together for BIC analysis */
  signalPairId?: string;
  /** Card classification for analysis. Inferred from reward type if omitted. */
  cardType?: "brand" | "culture" | "trap" | "dead_drop";
  /** Segment IDs — if set, only users in these segments see this question. Empty/undefined = all users. */
  segmentIds?: string[];
}

/** A single interaction in the drop sequence */
export type Question = QuestionMeta & QuestionContent;

// --- Multiplier checkpoint ---

export interface MultiplierCheckpoint {
  /** The multiplier value, e.g. 1.25 */
  multiplier: number;
  /** Display label, e.g. "x1.25" */
  label: string;
}

// --- Reveal screen config ---

export interface RevealConfig {
  /** Profile title shown on reveal. Use \n for line breaks.
   *  e.g. "Calculador\nambiguo frio" */
  title: string;
  /** Profile description text */
  description: string;
  /** Archetype definitions — the engine picks one based on answers */
  archetypes?: RevealArchetype[];
  /** Scoring rules mapping answers → dimension scores */
  scoring?: RevealScoringConfig;
}

export interface RevealArchetype {
  id: string;
  title: string;
  description: string;
  /** Formula: dimension weights. Score = sum(weight * dimensionValue) */
  formula: Record<string, number>;
}

export interface RevealScoringConfig {
  choiceScoring?: { questionIndex: number; optionScores: Record<string, number>[] }[];
  sliderScoring?: { questionIndex: number; ranges: { min: number; max: number; scores: Record<string, number> }[] }[];
  rankingScoring?: { questionIndex: number; firstPlaceScores: Record<string, number>[] }[];
  rafagaScoring?: { questionIndex: number; majorityA: Record<string, number>; majorityB: Record<string, number> }[];
  latencyScoring?: { fastThreshold: number; fastScores: Record<string, number>; slowThreshold: number; slowScores: Record<string, number> };
}

// --- The Drop ---

export interface SplashConfig {
  /** "terminal" = default typewriter mode, "image" = full-screen image/gif */
  mode: "terminal" | "image";
  /** Font family for terminal text and button. Available: Fira_Code, Silkscreen, Roboto */
  fontFamily?: string;
  /** Button text (default: "ENTRO") */
  buttonText?: string;
  /** Button background color (default: "#FFFFFF") */
  buttonBg?: string;
  /** Button text color (default: "#000000") */
  buttonTextColor?: string;
  /** Custom typewriter lines (replaces the default WARNING text) */
  typewriterLines?: string[];
  /** Custom static lines (replaces the default system lines) */
  staticLines?: string[];
  /** For mode "image": URL of the background image or GIF */
  imageUrl?: string;
}

export interface Drop {
  /** Unique drop identifier */
  id: string;
  /** Human-readable name (for admin) */
  name: string;
  /** Schema version for future compatibility */
  version: 1;

  /** Default timeout message when timer runs out (default: "Brutal eligió por vos.") */
  timeoutMessage?: string;

  /** Multiplier checkpoints. Key = question index (0-based) after which the checkpoint triggers.
   *  Example: { "5": { multiplier: 1.25, label: "x1.25" }, "10": { multiplier: 1.5, label: "x1.50" } }
   */
  multiplierCheckpoints: Record<string, MultiplierCheckpoint>;

  /** Configuration for the final reveal screen */
  reveal: RevealConfig;

  /** Optional splash screen customization */
  splash?: SplashConfig;

  /** Optional segment restriction — only users in these segments can access the drop */
  segmentIds?: string[];

  /** The ordered sequence of interactions */
  questions: Question[];
}