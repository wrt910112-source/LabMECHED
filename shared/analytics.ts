import type { ExamKind, ScoreGroup } from "./exam";
import type { Timing, TrainingMode, TrainingEvent } from "./training";
export interface LearnerAnalytics {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  practiceMs: number | null;
  examMs: number | null;
  practiceCount: number;
  completedPractice: number;
  activePractice: number;
  examCount: number;
  submitted: number;
  abandoned: number;
  activeExam: number;
  unrecorded: number;
  partial: number;
}
export interface SessionAnalytics {
  id: string;
  mode: TrainingMode;
  userId: string;
  code: string;
  kind: ExamKind;
  version: string;
  status: string;
  startedAt: number;
  endedAt: number | null;
  cohortName: string | null;
  timing: Timing;
  score: number | null;
  criticalRatio: number | null;
  elapsedMs: number;
  waitingMs: number | null;
  skippedMs: number | null;
  errors: number | null;
  corrections: number | null;
  completedGroups: number | null;
  totalGroups: number | null;
  analysisQuality: string;
}
export interface StepAnalytics {
  key: string;
  mode: TrainingMode;
  kind: ExamKind;
  version: string;
  step: string;
  label: string;
  attemptedRounds: number;
  unattemptedRounds: number;
  unrecordedRounds: number;
  partialRounds: number;
  firstSuccesses: number;
  errors: number | null;
  corrections: number | null;
  unfinished: number;
  attemptedLearners: number;
  errorLearners: number;
  firstSuccessRate: number | null;
  errorLearnerRate: number | null;
}
export interface AnalyticsReport {
  version: string;
  generatedAt: number;
  options: { versions: string[]; cohorts: { id: string; name: string }[] };
  summary: {
    learners: number;
    participants: number;
    practiceMs: number | null;
    examMs: number | null;
    practiceCount: number;
    completedPractice: number;
    submitted: number;
    abandoned: number;
    unknownErrors: number;
  };
  learners: LearnerAnalytics[];
  sessions: SessionAnalytics[];
  steps: StepAnalytics[];
  gradeGroups: {
    kind: ExamKind;
    version: string;
    count: number;
    learnerCount: number;
    mean: number;
    median: number;
  }[];
  comparisons: {
    userId: string;
    code: string;
    kind: ExamKind;
    version: string;
    first: number;
    latest: number;
    difference: number | null;
    points: { id: string; at: number; score: number }[];
  }[];
  heatmap: {
    learnerId: string;
    code: string;
    stepKey: string;
    errors: number;
    attempts: number;
    unfinished: number;
  }[];
  categories: Record<string, number>;
}
export interface TrainingDetail {
  result: { groups: ScoreGroup[] } | null;
  checks?: ScoreGroup[];
  events?: TrainingEvent[];
  timing?: Timing;
}
