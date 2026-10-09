export type QuestionType = "text" | "image" | "music";

export interface Choice {
  text: string;
  image_url: string | null;
}

export interface QuestionRow {
  id: string;
  quiz_id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  media_url: string | null;
  media_start: number;
  choices: Choice[];
  correct_index: number;
  points: number;
  time_limit: number;
  /** Question jouée lors des parties (cochée dans la console). */
  enabled: boolean;
}

export interface QuizSettings {
  answer_time: number;
  pause_time: number;
  intro_time: number;
}

export interface QuizRow extends QuizSettings {
  id: string;
  title: string;
  created_at: string;
}

export type GameStatus = "lobby" | "intro" | "question" | "reveal" | "finished";

export interface GameRow extends QuizSettings {
  id: string;
  code: string;
  quiz_id: string | null;
  quiz_title: string;
  status: GameStatus;
  question_ids: string[];
  current_index: number;
  question_started_at: string | null;
  phase_ends_at: string | null;
  paused_remaining_ms: number | null;
  version: number;
  created_at: string;
}

/** Question telle qu'envoyée aux écrans : la bonne réponse n'est incluse qu'après la révélation. */
export interface PublicQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  mediaUrl: string | null;
  mediaStart: number;
  choices: { text: string; imageUrl: string | null }[];
  points: number;
  /** Temps de réponse effectif, en secondes. */
  timeLimit: number;
  correctIndex: number | null;
}

export interface TeamState {
  id: string;
  name: string;
  score: number;
  rank: number;
  answered: boolean;
}

export interface GameState {
  serverNow: number;
  game: {
    code: string;
    status: GameStatus;
    quizTitle: string;
    index: number;
    total: number;
    questionStartedAt: number | null;
    /** Heure de fin de l'étape en cours (règles, question, pause), en ms ; null si en pause ou sans chrono. */
    phaseEndsAt: number | null;
    /** Temps restant figé quand la partie est en pause, en ms. */
    pausedRemainingMs: number | null;
    answerTime: number;
    pauseTime: number;
    introTime: number;
  };
  question: PublicQuestion | null;
  /** Équipes dans l'ordre d'arrivée. */
  teams: TeamState[];
  /** Nombre de réponses par choix, uniquement après la révélation. */
  distribution: number[] | null;
  me: {
    id: string;
    name: string;
    score: number;
    rank: number;
    answer: number | null;
    correct: boolean | null;
  } | null;
  /** Vrai si l'équipe demandée n'existe plus (supprimée par l'admin). */
  invalidTeam: boolean;
}
