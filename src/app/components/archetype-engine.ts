// ============================================================
// ARCHETYPE ENGINE — Computes dynamic reveal profile from answers
// ============================================================
// Each drop defines archetypes with dimension formulas and
// scoring rules that map user answers to dimension scores.
// The engine picks the archetype with the highest computed score.
// ============================================================

export type DimensionScores = Record<string, number>;

export interface Archetype {
  id: string;
  /** Title shown on reveal (supports \n) */
  title: string;
  /** Description shown below title */
  description: string;
  /** Formula: dimension weights. Score = sum(weight * dimensionValue) */
  formula: DimensionScores;
}

export interface ChoiceScoringRule {
  questionIndex: number;
  /** Score per option index */
  optionScores: DimensionScores[];
}

export interface SliderScoringRule {
  questionIndex: number;
  ranges: { min: number; max: number; scores: DimensionScores }[];
}

export interface RankingScoringRule {
  questionIndex: number;
  /** Scores for whichever option is ranked first */
  firstPlaceScores: DimensionScores[];
}

export interface RafagaScoringRule {
  questionIndex: number;
  /** Scores if majority chose option A */
  majorityA: DimensionScores;
  /** Scores if majority chose option B */
  majorityB: DimensionScores;
}

export interface LatencyScoringRule {
  /** If avg latency < fastThreshold ms → apply fastScores */
  fastThreshold: number;
  fastScores: DimensionScores;
  /** If avg latency > slowThreshold ms → apply slowScores */
  slowThreshold: number;
  slowScores: DimensionScores;
}

export interface ScoringConfig {
  choiceScoring?: ChoiceScoringRule[];
  sliderScoring?: SliderScoringRule[];
  rankingScoring?: RankingScoringRule[];
  rafagaScoring?: RafagaScoringRule[];
  latencyScoring?: LatencyScoringRule;
}

// --- User answer types ---

export type UserAnswer =
  | { type: "choice"; selectedIndex: number; latencyMs?: number }
  | { type: "slider"; value: number; latencyMs?: number }
  | { type: "ranking"; order: string[]; latencyMs?: number }
  | { type: "rafaga"; answers: (string | null)[]; latencyMs?: number }
  | { type: "prediction_bet"; side: "A" | "B"; latencyMs?: number }
  | { type: "trap"; correct: boolean; latencyMs?: number }
  | { type: "trap_silent"; correct: boolean; selectedIndex: number; latencyMs?: number }
  | { type: "confesionario"; latencyMs?: number }
  | { type: "dead_drop"; latencyMs?: number }
  | { type: "hot_take"; selectedIndex: number; latencyMs?: number }
  | { type: "timeout"; latencyMs?: number };

// --- Engine ---

function addScores(target: DimensionScores, source: DimensionScores) {
  for (const [dim, val] of Object.entries(source)) {
    target[dim] = (target[dim] || 0) + val;
  }
}

/** Apply weighted scores: multiply each dimension value by a weight factor */
function addWeightedScores(target: DimensionScores, source: DimensionScores, weight: number) {
  for (const [dim, val] of Object.entries(source)) {
    target[dim] = (target[dim] || 0) + val * weight;
  }
}

export function computeDimensions(
  answers: Record<number, UserAnswer>,
  scoring: ScoringConfig,
  avgLatencyMs: number
): DimensionScores {
  const dims: DimensionScores = {};

  // Choice scoring — also handles hot_take and correct trap_silent
  if (scoring.choiceScoring) {
    for (const rule of scoring.choiceScoring) {
      const answer = answers[rule.questionIndex];
      let selectedIndex: number | undefined;
      if (answer && (answer.type === "choice" || answer.type === "hot_take")) {
        selectedIndex = answer.selectedIndex;
      } else if (answer && answer.type === "trap_silent" && answer.correct) {
        selectedIndex = answer.selectedIndex;
      }
      if (selectedIndex !== undefined && rule.optionScores[selectedIndex]) {
        addScores(dims, rule.optionScores[selectedIndex]);
      }
    }
  }

  // Slider scoring
  if (scoring.sliderScoring) {
    for (const rule of scoring.sliderScoring) {
      const answer = answers[rule.questionIndex];
      if (answer && answer.type === "slider") {
        for (const range of rule.ranges) {
          if (answer.value >= range.min && answer.value <= range.max) {
            addScores(dims, range.scores);
            break;
          }
        }
      }
    }
  }

  // Ranking scoring — handled in computeDimensionsWithOptions with original options

  // Rafaga scoring
  if (scoring.rafagaScoring) {
    for (const rule of scoring.rafagaScoring) {
      const answer = answers[rule.questionIndex];
      if (answer && answer.type === "rafaga") {
        let aCount = 0;
        let bCount = 0;
        for (const a of answer.answers) {
          if (a === "A") aCount++;
          else if (a === "B") bCount++;
        }
        if (aCount >= bCount) {
          addScores(dims, rule.majorityA);
        } else {
          addScores(dims, rule.majorityB);
        }
      }
    }
  }

  // Latency scoring
  if (scoring.latencyScoring && avgLatencyMs > 0) {
    const ls = scoring.latencyScoring;
    if (avgLatencyMs < ls.fastThreshold) {
      addScores(dims, ls.fastScores);
    } else if (avgLatencyMs > ls.slowThreshold) {
      addScores(dims, ls.slowScores);
    }
  }

  return dims;
}

export function pickArchetype(
  dims: DimensionScores,
  archetypes: Archetype[]
): Archetype {
  let bestScore = -Infinity;
  let bestArchetype = archetypes[0];

  for (const arch of archetypes) {
    let score = 0;
    for (const [dim, weight] of Object.entries(arch.formula)) {
      score += weight * (dims[dim] || 0);
    }
    if (score > bestScore) {
      bestScore = score;
      bestArchetype = arch;
    }
  }

  return bestArchetype;
}

// --- Enhanced ranking scoring (needs original options) ---

/** Position weights: 1st gets full score, then decreasing */
const RANKING_POSITION_WEIGHTS = [1.0, 0.5, 0.25, 0.1];

export function computeDimensionsWithOptions(
  answers: Record<number, UserAnswer>,
  scoring: ScoringConfig,
  avgLatencyMs: number,
  questionOptions: Record<number, string[]>
): DimensionScores {
  const dims = computeDimensions(answers, scoring, avgLatencyMs);

  // Ranking scoring: all positions with decreasing weight
  if (scoring.rankingScoring) {
    for (const rule of scoring.rankingScoring) {
      const answer = answers[rule.questionIndex];
      const origOptions = questionOptions[rule.questionIndex];
      if (answer && answer.type === "ranking" && origOptions && answer.order.length > 0) {
        for (let pos = 0; pos < answer.order.length; pos++) {
          const item = answer.order[pos];
          const origIndex = origOptions.indexOf(item);
          const weight = pos < RANKING_POSITION_WEIGHTS.length ? RANKING_POSITION_WEIGHTS[pos] : 0.1;
          if (origIndex >= 0 && rule.firstPlaceScores[origIndex]) {
            addWeightedScores(dims, rule.firstPlaceScores[origIndex], weight);
          }
        }
      }
    }
  }

  return dims;
}
