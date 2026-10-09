"use client";
import { useLayoutEffect, useRef } from "react";

/**
 * Texte qui prend la plus grande taille possible tout en tenant entièrement dans sa boîte
 * (largeur et hauteur), quelle que soit sa longueur et la taille de la fenêtre.
 * La boîte doit avoir une taille définie par la mise en page, ou une max-height.
 * Les retours à la ligne saisis dans la console sont conservés.
 */
export function FitText({
  text,
  min = 10,
  max = 64,
  className = "",
  as: Tag = "div",
  size,
  onFit,
}: {
  text: string;
  /** Tailles de police minimale et maximale, en pixels. */
  min?: number;
  max?: number;
  className?: string;
  as?: "div" | "h1";
  /** Taille imposée (ex. la même pour toutes les réponses d'une question) ; doit être ≤ à celle qui tient. */
  size?: number;
  /** Reçoit la plus grande taille qui tient, à chaque recalcul. */
  onFit?: (px: number) => void;
}) {
  const outer = useRef<HTMLElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const forced = useRef(size);
  forced.current = size;
  const report = useRef(onFit);
  report.current = onFit;

  // Taille imposée par le groupe : appliquée sans refaire la mesure
  useLayoutEffect(() => {
    if (size !== undefined && inner.current) inner.current.style.fontSize = `${size}px`;
  }, [size]);

  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!box || !content) return;

    const fit = () => {
      const maxHeight = parseFloat(getComputedStyle(box).maxHeight);
      const height = Number.isFinite(maxHeight) ? Math.min(maxHeight, box.clientHeight || maxHeight) : box.clientHeight;
      const limitH = Number.isFinite(maxHeight) ? maxHeight : height;
      const width = box.clientWidth;
      if (!width || !limitH) return;
      const fits = (size: number) => {
        content.style.fontSize = `${size}px`;
        return content.scrollWidth <= width + 1 && content.offsetHeight <= limitH + 1;
      };
      // Recherche dichotomique de la plus grande taille qui tient
      let lo = min;
      let hi = max;
      if (fits(hi)) lo = hi;
      else {
        for (let i = 0; i < 10 && hi - lo > 0.5; i++) {
          const mid = (lo + hi) / 2;
          if (fits(mid)) lo = mid;
          else hi = mid;
        }
      }
      const best = Math.floor(lo);
      content.style.fontSize = `${Math.min(best, forced.current ?? best)}px`;
      report.current?.(best);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => observer.disconnect();
  }, [text, min, max]);

  return (
    <Tag ref={outer as never} className={`fit-text ${className}`}>
      <span ref={inner} className="fit-text-inner">
        {text}
      </span>
    </Tag>
  );
}
