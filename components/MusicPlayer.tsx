"use client";
import { useEffect, useRef, useState } from "react";

/** Lecteur de l'extrait musical sur l'écran de jeu. Démarre automatiquement à chaque nouvelle question. */
export function MusicPlayer({ src, start, autoPlay }: { src: string; start: number; autoPlay: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const playFromStart = () => {
    const el = audio.current;
    if (!el) return;
    el.currentTime = start;
    el.play().then(
      () => setBlocked(false),
      () => setBlocked(true),
    );
  };

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const ready = () => {
      el.currentTime = start;
      if (autoPlay) playFromStart();
    };
    if (el.readyState >= 1) ready();
    else el.addEventListener("loadedmetadata", ready, { once: true });
    return () => el.removeEventListener("loadedmetadata", ready);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, start]);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) el.play().then(() => setBlocked(false), () => setBlocked(true));
    else el.pause();
  };

  return (
    <div className="music">
      <audio ref={audio} src={src} preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      <div className={`equalizer ${playing ? "is-playing" : ""}`} aria-hidden>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
      <div className="music-controls">
        <button className="btn btn-round" onClick={toggle} aria-label={playing ? "Pause" : "Lecture"}>
          {playing ? "❚❚" : "▶"}
        </button>
        <button className="btn btn-round btn-ghost" onClick={playFromStart} aria-label="Rejouer l'extrait">
          ↺
        </button>
      </div>
      {blocked && <p className="muted">Cliquez sur ▶ pour lancer l&apos;extrait.</p>}
    </div>
  );
}
