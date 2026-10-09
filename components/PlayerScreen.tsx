"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { LETTERS, answerColumns, choiceClass, pts } from "@/lib/choices";
import type { GameState } from "@/lib/types";
import { useCountdown, useGameState } from "@/lib/useGameState";
import { Letter } from "./Letter";

type TeamAuth = { teamId: string; token: string; name: string };

const storageKey = (code: string) => `quiz-live-team-${code}`;

function readTeam(code: string): TeamAuth | null {
  try {
    const raw = localStorage.getItem(storageKey(code));
    return raw ? (JSON.parse(raw) as TeamAuth) : null;
  } catch {
    return null;
  }
}

function writeTeam(code: string, team: TeamAuth | null) {
  try {
    if (team) localStorage.setItem(storageKey(code), JSON.stringify(team));
    else localStorage.removeItem(storageKey(code));
  } catch {
    /* navigation privée : l'équipe ne sera simplement pas mémorisée */
  }
}

export function PlayerScreen({ code }: { code: string }) {
  const [team, setTeam] = useState<TeamAuth | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [kicked, setKicked] = useState(false);
  const { state, error, refresh, clockOffset } = useGameState(code, team);

  useEffect(() => {
    setTeam(readTeam(code));
    setLoaded(true);
  }, [code]);

  useEffect(() => {
    if (state?.invalidTeam) {
      writeTeam(code, null);
      setTeam(null);
      setKicked(true);
    }
  }, [state?.invalidTeam, code]);

  const onJoined = (t: TeamAuth) => {
    writeTeam(code, t);
    setKicked(false);
    setTeam(t);
  };

  let content: React.ReactNode;
  if (!loaded || (!state && !error)) {
    content = <div className="spinner" />;
  } else if (!state) {
    content = <Message icon="⚠️" title="Oups" text={error ?? ""} />;
  } else if (!team) {
    content =
      state.game.status === "lobby" ? (
        <JoinForm code={code} title={state.game.quizTitle} kicked={kicked} onJoined={onJoined} />
      ) : (
        <Message icon="⏳" title="Partie en cours" text="Le quiz a déjà commencé, il n'est plus possible de rejoindre." />
      );
  } else if (!state.me) {
    content = <div className="spinner" />;
  } else {
    content = <TeamView code={code} team={team} state={state} clockOffset={clockOffset} refresh={refresh} />;
  }

  return (
    <div className="player">
      {state?.me && (
        <header className="player-header">
          <span className="player-team">{state.me.name}</span>
          <span className="player-score">{pts(state.me.score)}</span>
        </header>
      )}
      <main className="player-main">{content}</main>
      {error && state && <p className="player-offline">{error}</p>}
    </div>
  );
}

function Message({ icon, title, text, tone }: { icon: string; title: string; text?: string; tone?: "good" | "bad" }) {
  return (
    <div className={`message ${tone ? `message-${tone}` : ""}`}>
      <div className="message-icon">{icon}</div>
      <h1>{title}</h1>
      {text && <p>{text}</p>}
    </div>
  );
}

function JoinForm({ code, title, kicked, onJoined }: { code: string; title: string; kicked: boolean; onJoined: (t: TeamAuth) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(kicked ? "Votre équipe a été retirée de la partie. Vous pouvez la recréer." : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ teamId: string; token: string; name: string }>(`/api/games/${code}/join`, { body: { name } });
      onJoined(res);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className="join" onSubmit={submit}>
      <p className="muted">Bienvenue au quiz</p>
      <h1>{title}</h1>
      <label htmlFor="team-name">Nom de votre équipe</label>
      <input
        id="team-name"
        className="input input-big"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        placeholder="Les Génies"
        autoComplete="off"
        autoFocus
      />
      {error && <p className="error-text">{error}</p>}
      <button className="btn btn-primary btn-block btn-big" disabled={busy || !name.trim()}>
        {busy ? "Connexion…" : "Rejoindre la partie"}
      </button>
    </form>
  );
}

function TeamView({
  code,
  team,
  state,
  clockOffset,
  refresh,
}: {
  code: string;
  team: TeamAuth;
  state: GameState;
  clockOffset: number;
  refresh: () => Promise<void>;
}) {
  const me = state.me!;
  const q = state.question;
  const remaining = useCountdown(state, clockOffset);
  const position = `Question ${state.game.index + 1} / ${state.game.total}`;

  switch (state.game.status) {
    case "lobby":
      return (
        <div className="message">
          <div className="message-icon">✅</div>
          <h1>Vous êtes inscrits !</h1>
          <p>
            En attente du lancement du quiz… <br />
            {state.teams.length} équipe{state.teams.length > 1 ? "s" : ""} connectée{state.teams.length > 1 ? "s" : ""}
          </p>
          <div className="spinner spinner-small" />
          <p className="muted small">Gardez cette page ouverte. Les questions s&apos;affichent sur le grand écran.</p>
        </div>
      );

    case "intro":
      return (
        <div className="message">
          <div className="message-icon">🚀</div>
          <h1>C&apos;est parti !</h1>
          {remaining !== null && (
            <p className="big-countdown">
              Première question dans <strong>{remaining}</strong>
            </p>
          )}
          <ul className="phone-rules">
            <li>⏱ {state.game.answerTime} secondes pour répondre</li>
            <li>🔒 Une réponse validée est définitive</li>
            <li>▶️ Les questions défilent toutes seules</li>
          </ul>
        </div>
      );

    case "question":
      if (!q) return null;
      if (me.answer !== null) {
        return (
          <div className="message">
            <p className="muted">{position}</p>
            <div className="message-icon">🔒</div>
            <h1>Réponse enregistrée</h1>
            <div className={`locked-answer ${choiceClass(me.answer)}`}>
              <Letter index={me.answer} size="lg" />
              <span>{q.choices[me.answer]?.text}</span>
            </div>
            <p className="muted">Elle ne peut plus être modifiée. Rendez-vous sur le grand écran !</p>
          </div>
        );
      }
      if (remaining === 0) {
        return <Message icon="⌛" title="Temps écoulé" text="Vous n'avez pas répondu à temps pour cette question." tone="bad" />;
      }
      return <AnswerPad key={q.id} code={code} team={team} state={state} remaining={remaining} refresh={refresh} />;

    case "reveal": {
      if (!q || q.correctIndex === null) return null;
      const solution = `La bonne réponse était ${LETTERS[q.correctIndex]}${q.choices[q.correctIndex]?.text ? ` : ${q.choices[q.correctIndex].text}` : ""}.`;
      const next =
        remaining !== null ? (
          <p className="muted next-hint">
            {state.game.index + 1 < state.game.total ? "Question suivante" : "Résultats"} dans {remaining} s
          </p>
        ) : null;
      if (me.answer === null) {
        return (
          <>
            <Message icon="😶" title="Pas de réponse" text={solution} tone="bad" />
            {next}
          </>
        );
      }
      return (
        <>
          {me.correct ? (
            <Message icon="🎉" title="Bonne réponse !" text={`+${q.points} point${q.points > 1 ? "s" : ""} pour votre équipe`} tone="good" />
          ) : (
            <Message icon="❌" title="Raté…" text={solution} tone="bad" />
          )}
          {next}
        </>
      );
    }

    case "finished":
      return (
        <Message
          icon={me.rank === 1 ? "🥇" : me.rank === 2 ? "🥈" : me.rank === 3 ? "🥉" : "🏁"}
          title="Partie terminée !"
          text={`Votre équipe termine ${me.rank}${me.rank === 1 ? "re" : "e"} avec ${me.score} point${me.score > 1 ? "s" : ""}. Merci d'avoir joué !`}
          tone={me.rank === 1 ? "good" : undefined}
        />
      );
  }
}

function AnswerPad({
  code,
  team,
  state,
  remaining,
  refresh,
}: {
  code: string;
  team: TeamAuth;
  state: GameState;
  remaining: number | null;
  refresh: () => Promise<void>;
}) {
  const q = state.question!;
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (selected === null) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/games/${code}/answer`, {
        body: { teamId: team.teamId, token: team.token, questionId: q.id, choice: selected },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  return (
    <div className="pad">
      <div className="pad-top">
        <span className="muted">
          Question {state.game.index + 1} / {state.game.total}
        </span>
        {remaining !== null && <span className={`pad-timer ${remaining <= 5 ? "urgent" : ""}`}>⏱ {remaining}s</span>}
      </div>
      <p className="pad-hint">{selected === null ? "Choisissez votre réponse" : "Confirmez votre choix"}</p>
      <div
        className={`pad-grid ${q.choices.length > 6 ? "pad-many" : ""}`}
        style={{ ["--cols" as string]: answerColumns(q.choices.length, "phone") }}
      >
        {q.choices.map((c, i) => (
          <button
            key={i}
            className={`pad-btn ${choiceClass(i)} ${selected === i ? "is-selected" : ""} ${selected !== null && selected !== i ? "is-dimmed" : ""}`}
            onClick={() => setSelected(i)}
            disabled={busy}
          >
            {q.type === "image" && c.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.imageUrl} alt="" />
            ) : null}
            <span className="pad-letter">{LETTERS[i]}</span>
            {q.type !== "image" && c.text && <span className="pad-text">{c.text}</span>}
          </button>
        ))}
      </div>
      {error && <p className="error-text">{error}</p>}
      <button className="btn btn-primary btn-block btn-big" disabled={selected === null || busy} onClick={submit}>
        {busy ? "Envoi…" : selected === null ? "Valider" : `Valider la réponse ${LETTERS[selected]}`}
      </button>
      <p className="muted small center">⚠️ Une fois validée, la réponse ne peut plus être modifiée.</p>
    </div>
  );
}
