/** Lettres A à Z : une réponse par lettre. */
export const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
export const MAX_CHOICES = LETTERS.length;
export const MIN_CHOICES = 2;

/** Nombre de couleurs de la palette (voir globals.css) ; au-delà, les couleurs se répètent. */
const COLOR_COUNT = 12;

export function choiceClass(index: number): string {
  return `choice-${index % COLOR_COUNT}`;
}

/** Nombre de colonnes de la grille de réponses, selon le nombre de réponses. */
export function answerColumns(count: number, screen: "host" | "phone", images = false): number {
  if (screen === "phone") return count <= 6 ? 2 : count <= 12 ? 3 : 4;
  if (images && count === 3) return 3;
  return count <= 4 ? 2 : count <= 9 ? 3 : count <= 16 ? 4 : count <= 20 ? 5 : 6;
}

export const TYPE_LABELS: Record<string, string> = {
  text: "Question simple",
  image: "Question image",
  music: "Question musicale",
};

export const TYPE_ICONS: Record<string, string> = {
  text: "💬",
  image: "🖼️",
  music: "🎵",
};

/** « 1 pt », « 3 pts » */
export function pts(n: number): string {
  return `${n} pt${Math.abs(n) > 1 ? "s" : ""}`;
}
