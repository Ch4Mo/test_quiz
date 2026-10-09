import "server-only";
import { MAX_CHOICES, MIN_CHOICES } from "./choices";
import type { Choice, QuestionType } from "./types";

export interface QuestionInput {
  type: QuestionType;
  prompt: string;
  media_url: string | null;
  media_start: number;
  choices: Choice[];
  correct_index: number;
  points: number;
  time_limit: number;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const int = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

/** Valide et normalise une question envoyée par la console. Renvoie un message d'erreur ou la question. */
export function parseQuestion(body: Record<string, unknown>): { error: string } | { value: QuestionInput } {
  const type = body.type as QuestionType;
  if (!["text", "image", "music"].includes(type)) return { error: "Type de question invalide." };

  const prompt = str(body.prompt);
  if (!prompt) return { error: "L'intitulé de la question est obligatoire." };

  const media_url = str(body.media_url) || null;
  if (type === "music" && !media_url) return { error: "Ajoutez l'extrait audio de la question musicale." };

  const rawChoices = Array.isArray(body.choices) ? body.choices : [];
  const choices: Choice[] = rawChoices.map((c) => {
    const obj = (c ?? {}) as Record<string, unknown>;
    return { text: str(obj.text), image_url: str(obj.image_url) || null };
  });
  if (choices.length < MIN_CHOICES || choices.length > MAX_CHOICES) {
    return { error: `Il faut entre ${MIN_CHOICES} et ${MAX_CHOICES} réponses.` };
  }
  for (const [i, c] of choices.entries()) {
    if (type === "image" && !c.image_url) return { error: `Ajoutez une image pour la réponse ${String.fromCharCode(65 + i)}.` };
    // Question simple : le texte est facultatif (seule la lettre s'affiche, ex. pastilles sur une photo)
    if (type === "music" && !c.text) return { error: `Le texte de la réponse ${String.fromCharCode(65 + i)} est vide.` };
  }

  const correct_index = int(body.correct_index, -1);
  if (correct_index < 0 || correct_index >= choices.length) return { error: "Choisissez la bonne réponse." };

  return {
    value: {
      type,
      prompt,
      media_url,
      media_start: Math.max(0, Number(body.media_start) || 0),
      choices,
      correct_index,
      points: Math.min(100, Math.max(0, int(body.points, 1))),
      time_limit: Math.min(600, Math.max(0, int(body.time_limit, 0))),
    },
  };
}
