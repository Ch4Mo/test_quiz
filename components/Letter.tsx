import { LETTERS, choiceClass } from "@/lib/choices";

export function Letter({ index, size = "md" }: { index: number; size?: "sm" | "md" | "lg" }) {
  return <span className={`letter letter-${size} ${choiceClass(index)}`}>{LETTERS[index]}</span>;
}
