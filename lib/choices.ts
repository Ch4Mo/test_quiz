export const LETTERS = ["A", "B", "C", "D", "E", "F"];
export const MAX_CHOICES = LETTERS.length;
export const MIN_CHOICES = 2;

export function choiceClass(index: number): string {
  return `choice-${LETTERS[index]?.toLowerCase() ?? "a"}`;
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
