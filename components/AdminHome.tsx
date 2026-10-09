"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

interface QuizSummary {
  id: string;
  title: string;
  questionCount: number;
  enabledCount: number;
}
interface GameSummary {
  code: string;
  quiz_title: string;
  status: string;
  is_test: boolean;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  lobby: "Salle d'attente",
  intro: "En cours",
  question: "En cours",
  reveal: "En cours",
  finished: "Terminée",
};

export function AdminHome() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ quizzes: QuizSummary[]; games: GameSummary[] }>("/api/admin/quizzes");
      setQuizzes(data.quizzes);
      setGames(data.games);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const quiz = await api<{ id: string }>("/api/admin/quizzes", { body: { title } });
      router.push(`/admin/quiz/${quiz.id}`);
    });
  };

  const launch = (quiz: QuizSummary, test = false) =>
    run(async () => {
      const game = await api<{ code: string }>("/api/admin/games", { body: { quizId: quiz.id, test } });
      router.push(`/host/${game.code}`);
    });

  const remove = (quiz: QuizSummary) => {
    if (!confirm(`Supprimer définitivement le quiz « ${quiz.title} » et ses questions ?`)) return;
    run(async () => {
      await api(`/api/admin/quizzes/${quiz.id}`, { method: "DELETE" });
      await load();
    });
  };

  const removeGame = (game: GameSummary) => {
    if (!confirm(`Supprimer la partie ${game.code} (${game.quiz_title}) de l'historique ?`)) return;
    run(async () => {
      await api(`/api/admin/games/${game.code}`, { method: "DELETE" });
      await load();
    });
  };

  const clearGames = () => {
    if (!confirm("Effacer tout l'historique des parties, y compris celles en cours ? Les équipes et réponses seront supprimées.")) return;
    run(async () => {
      await api("/api/admin/games", { method: "DELETE" });
      await load();
    });
  };

  const logout = async () => {
    await api("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <div className="admin">
      <header className="admin-header">
        <h1>🎯 Console Quiz</h1>
        <button className="btn btn-ghost btn-small" onClick={logout}>
          Se déconnecter
        </button>
      </header>

      {error && <p className="error-text">{error}</p>}

      <section className="card">
        <h2>Mes quiz</h2>
        <form className="row" onSubmit={create}>
          <input className="input" placeholder="Titre du nouveau quiz" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn btn-primary" disabled={busy}>
            + Créer un quiz
          </button>
        </form>

        {quizzes === null ? (
          <div className="spinner spinner-small" />
        ) : quizzes.length === 0 ? (
          <p className="muted">Aucun quiz pour l&apos;instant. Créez-en un pour commencer.</p>
        ) : (
          <ul className="list">
            {quizzes.map((q) => (
              <li key={q.id} className="list-item">
                <div className="grow">
                  <strong>{q.title}</strong>
                  <span className="muted small">
                    {q.questionCount} question{q.questionCount > 1 ? "s" : ""}
                    {q.enabledCount < q.questionCount && ` · ${q.enabledCount} cochée${q.enabledCount > 1 ? "s" : ""}`}
                  </span>
                </div>
                <Link className="btn btn-small btn-ghost" href={`/admin/quiz/${q.id}`}>
                  ✏️ Éditer
                </Link>
                <button
                  className="btn btn-small btn-ghost"
                  disabled={busy || q.enabledCount === 0}
                  onClick={() => launch(q, true)}
                  title="Partie d'essai : démarrage sans équipe, avec un téléphone de test dans une fenêtre"
                >
                  🧪 Tester
                </button>
                <button className="btn btn-small btn-primary" disabled={busy || q.enabledCount === 0} onClick={() => launch(q)}>
                  ▶ Lancer une partie
                </button>
                <button className="btn btn-small btn-ghost btn-danger" disabled={busy} onClick={() => remove(q)} title="Supprimer">
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {games.length > 0 && (
        <section className="card">
          <div className="row spread">
            <h2>Parties récentes</h2>
            <button className="btn btn-small btn-ghost btn-danger" disabled={busy} onClick={clearGames}>
              🗑 Effacer l&apos;historique
            </button>
          </div>
          <ul className="list">
            {games.map((g) => (
              <li key={g.code} className="list-item">
                <span className="code-tag">{g.code}</span>
                <div className="grow">
                  <strong>
                    {g.quiz_title} {g.is_test && <span className="test-tag">TEST</span>}
                  </strong>
                  <span className="muted small">
                    {new Date(g.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} · {STATUS_LABELS[g.status]}
                  </span>
                </div>
                <Link className="btn btn-small btn-ghost" href={`/host/${g.code}`}>
                  🖥 Ouvrir l&apos;écran de jeu
                </Link>
                <button className="btn btn-small btn-ghost btn-danger" disabled={busy} onClick={() => removeGame(g)} title="Supprimer cette partie">
                  🗑
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
