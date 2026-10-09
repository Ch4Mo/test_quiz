"use client";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { TYPE_ICONS, TYPE_LABELS, answerColumns, choiceClass, pts } from "@/lib/choices";
import type { GameState } from "@/lib/types";
import { useCountdown, useGameState } from "@/lib/useGameState";
import { Letter } from "./Letter";
import { MusicPlayer } from "./MusicPlayer";
import { Timer } from "./Timer";

export function HostScreen({ code }: { code: string }) {
  const { state, error, refresh, clockOffset } = useGameState(code, null);
  const remaining = useCountdown(state, clockOffset);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const act = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      setBusy(true);
      setActionError(null);
      try {
        await api(`/api/admin/games/${code}`, { body: { action, ...extra } });
        await refresh();
      } catch (e) {
        setActionError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [code, refresh],
  );

  const status = state?.game.status;
  const running = status === "intro" || status === "question" || status === "reveal";
  const paused = state?.game.pausedRemainingMs !== null && state?.game.pausedRemainingMs !== undefined;

  // Barre d'espace : pause / reprise. Flèche droite : passer à l'étape suivante.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy || !running) return;
      if ((e.target as HTMLElement)?.closest("input, textarea, button")) return;
      if (e.key === " ") {
        e.preventDefault();
        act(paused ? "resume" : "pause");
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        act("skip");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, paused, busy, act]);

  if (!state) {
    return <div className="host center-screen">{error ? <p className="error-text big">{error}</p> : <div className="spinner" />}</div>;
  }

  const { game } = state;
  return (
    <div className={`host host-${game.status}`}>
      {game.status === "lobby" && <Lobby state={state} onKick={(teamId) => act("kick", { teamId })} />}
      {game.status === "intro" && <Rules state={state} remaining={remaining} />}
      {(game.status === "question" || game.status === "reveal") && (
        <QuestionView key={state.question?.id} state={state} remaining={remaining} />
      )}
      {game.status === "finished" && <Podium state={state} />}
      {paused && <div className="paused-banner">⏸ Pause</div>}

      <div className="host-controls">
        {(error || actionError) && <span className="error-text">{actionError ?? error}</span>}
        {game.status === "lobby" && (
          <button className="btn btn-primary" disabled={busy || state.teams.length === 0} onClick={() => act("start")}>
            🚀 Lancer le quiz
          </button>
        )}
        {running && (
          <>
            <button className="btn btn-ghost" disabled={busy} onClick={() => act(paused ? "resume" : "pause")} title="Barre d'espace">
              {paused ? "▶ Reprendre" : "⏸ Pause"}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => act("skip")} title="Flèche droite">
              ⏭ Passer
            </button>
            <button
              className="btn btn-ghost btn-small"
              disabled={busy}
              onClick={() => confirm("Terminer la partie maintenant ?") && act("finish")}
            >
              Terminer
            </button>
          </>
        )}
        <FullscreenButton />
        <Link className="btn btn-ghost btn-small" href="/admin">
          Console
        </Link>
      </div>
    </div>
  );
}

function FullscreenButton() {
  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };
  return (
    <button className="btn btn-ghost btn-small" onClick={toggle} title="Plein écran">
      ⛶
    </button>
  );
}

function Lobby({ state, onKick }: { state: GameState; onKick: (teamId: string) => void }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const joinUrl = `${origin}/play/${state.game.code}`;

  return (
    <div className="lobby">
      <h1 className="host-title">{state.game.quizTitle}</h1>
      <div className="lobby-grid">
        <div className="card qr-card">
          <p className="qr-caption">Scannez pour rejoindre la partie</p>
          <div className="qr-box">{origin && <QRCodeSVG value={joinUrl} size={300} marginSize={1} level="M" />}</div>
          <p className="muted join-url">{joinUrl.replace(/^https?:\/\//, "")}</p>
          <p className="game-code">
            Code <strong>{state.game.code}</strong>
          </p>
        </div>
        <div className="card teams-panel">
          <h2>
            Équipes connectées <span className="count-badge">{state.teams.length}</span>
          </h2>
          {state.teams.length === 0 ? (
            <p className="muted waiting-dots">En attente des équipes</p>
          ) : (
            <ul className="team-chips">
              {state.teams.map((t, i) => (
                <li key={t.id} className={`team-chip ${choiceClass(i)}`}>
                  {t.name}
                  <button
                    className="chip-remove"
                    title="Retirer cette équipe"
                    onClick={() => confirm(`Retirer l'équipe « ${t.name} » ?`) && onKick(t.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Rules({ state, remaining }: { state: GameState; remaining: number | null }) {
  const { answerTime, pauseTime, total } = state.game;
  return (
    <div className="rules">
      <h1 className="host-title">{state.game.quizTitle}</h1>
      {remaining !== null && (
        <p className="rules-countdown">
          Le quiz commence dans <strong>{remaining}</strong>
        </p>
      )}
      <div className="card rules-card">
        <h2>Les règles du jeu</h2>
        <ul className="rules-list">
          <li>
            <span className="rules-icon">❓</span>
            <span>
              <strong>{total} questions</strong> s&apos;affichent ici, sur le grand écran
            </span>
          </li>
          <li>
            <span className="rules-icon">📱</span>
            <span>
              Chaque équipe répond sur son téléphone en touchant <strong>A, B, C…</strong>
            </span>
          </li>
          <li>
            <span className="rules-icon">⏱</span>
            <span>
              <strong>{answerTime} secondes</strong> pour répondre à chaque question
            </span>
          </li>
          <li>
            <span className="rules-icon">🔒</span>
            <span>
              Une fois validée, une réponse est <strong>définitive</strong>
            </span>
          </li>
          <li>
            <span className="rules-icon">✅</span>
            <span>
              La bonne réponse s&apos;affiche, puis la question suivante arrive <strong>{pauseTime} secondes</strong> plus tard
            </span>
          </li>
          <li>
            <span className="rules-icon">▶️</span>
            <span>
              Le quiz <strong>défile tout seul</strong> jusqu&apos;au podium final
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function QuestionView({ state, remaining }: { state: GameState; remaining: number | null }) {
  const q = state.question;
  if (!q) return null;
  const revealed = state.game.status === "reveal";
  const isLast = state.game.index + 1 >= state.game.total;
  const answeredCount = state.teams.filter((t) => t.answered).length;
  const hasImageAside = q.type !== "music" && q.mediaUrl;
  // Réponses sans texte (ex. pastilles A, B, C posées sur une photo) : la photo prend la place
  const lettersOnly = q.type === "text" && q.choices.every((c) => !c.text);

  return (
    <div className={`question-view type-${q.type} ${revealed ? "is-revealed" : ""}`}>
      <div className="topbar">
        <span className="pill">
          Question {state.game.index + 1} / {state.game.total}
        </span>
        <span className="pill pill-soft">
          {TYPE_ICONS[q.type]} {TYPE_LABELS[q.type]}
        </span>
        <span className="pill pill-soft">{pts(q.points)}</span>
        <span className="spacer" />
        <span className="pill pill-soft">
          {answeredCount} / {state.teams.length} ont répondu
        </span>
        {state.game.status === "question" && remaining === 0 && <span className="pill pill-alert">Temps écoulé</span>}
        {state.game.status === "question" && remaining !== null && <Timer seconds={remaining} total={q.timeLimit} />}
        {revealed && !isLast && remaining !== null && (
          <span className="next-countdown">
            Question suivante dans
            <Timer seconds={remaining} total={state.game.pauseTime} calm />
          </span>
        )}
      </div>

      <h1 className="prompt">{q.prompt}</h1>

      {q.type === "music" && q.mediaUrl && (
        <div className="stage">
          <MusicPlayer key={q.id} src={q.mediaUrl} start={q.mediaStart} autoPlay={state.game.status === "question"} />
        </div>
      )}

      <div className={`question-body ${hasImageAside ? "with-aside" : ""}`}>
        {hasImageAside && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="question-image" src={q.mediaUrl!} alt="" />
        )}
        <div
          className={`answers answers-${q.type === "image" ? "image" : "text"} ${q.choices.length > 6 ? "answers-many" : ""} ${lettersOnly ? "answers-letters" : ""}`}
          style={{ ["--cols" as string]: answerColumns(q.choices.length, "host", q.type === "image") }}
        >
          {q.choices.map((c, i) => {
            const status = revealed ? (i === q.correctIndex ? "is-correct" : "is-wrong") : "";
            return (
              <div key={i} className={`answer ${choiceClass(i)} ${status} ${!c.text && q.type !== "image" ? "letter-only" : ""}`}>
                {q.type === "image" && c.imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.imageUrl} alt={c.text || `Réponse ${i + 1}`} />
                    <div className="answer-caption">
                      <Letter index={i} size="lg" />
                      {c.text && <span>{c.text}</span>}
                    </div>
                  </>
                ) : (
                  <>
                    <Letter index={i} size="lg" />
                    {c.text && <span className="answer-text">{c.text}</span>}
                  </>
                )}
                {revealed && state.distribution && (
                  <span className="answer-count">
                    {state.distribution[i]} équipe{state.distribution[i] > 1 ? "s" : ""}
                  </span>
                )}
                {revealed && i === q.correctIndex && <span className="answer-check">✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Après la dernière question : compte à rebours vers les résultats, au centre de l'écran */}
      {revealed && isLast && remaining !== null && (
        <div className="final-countdown">
          <div className="final-countdown-card">
            <span className="final-countdown-icon">🏁</span>
            <p>Quiz terminé ! Résultats dans</p>
            <strong key={remaining}>{remaining}</strong>
          </div>
        </div>
      )}

      <ul className="team-strip">
        {state.teams.map((t) => (
          <li key={t.id} className={t.answered ? "answered" : ""}>
            {t.answered ? "✓ " : ""}
            {t.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ranked(state: GameState) {
  return [...state.teams].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function Podium({ state }: { state: GameState }) {
  const teams = ranked(state);
  const top = [teams[1], teams[0], teams[2]];
  return (
    <div className="final">
      <h1 className="host-title">🏁 Résultats finaux</h1>
      <div className="podium">
        {top.map((t, i) =>
          t ? (
            <div key={t.id} className={`podium-step step-${[2, 1, 3][i]}`}>
              <span className="podium-medal">{["🥈", "🥇", "🥉"][i]}</span>
              <span className="podium-name">{t.name}</span>
              <span className="podium-score">{pts(t.score)}</span>
              <div className="podium-block">{t.rank}</div>
            </div>
          ) : (
            <div key={i} className="podium-step podium-empty" />
          ),
        )}
      </div>
      {teams.length > 3 && (
        <ol className="ranking ranking-compact">
          {teams.slice(3).map((t) => (
            <li key={t.id}>
              <span className="rank-num">{t.rank}</span>
              <span className="rank-name">{t.name}</span>
              <span className="rank-score">{pts(t.score)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
