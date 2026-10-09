"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { LETTERS, MAX_CHOICES, MIN_CHOICES, TYPE_ICONS, TYPE_LABELS, choiceClass } from "@/lib/choices";
import type { Choice, QuestionRow, QuestionType, QuizRow, QuizSettings } from "@/lib/types";
import { Letter } from "./Letter";
import { MediaUpload } from "./MediaUpload";

type Draft = Omit<QuestionRow, "id" | "quiz_id" | "position"> & { id?: string };

function emptyDraft(type: QuestionType): Draft {
  return {
    type,
    prompt: type === "image" ? "Quelle est la bonne situation ?" : type === "music" ? "Quel est ce morceau ?" : "",
    media_url: null,
    media_start: 0,
    choices: Array.from({ length: 4 }, () => ({ text: "", image_url: null })),
    correct_index: 0,
    points: 1,
    time_limit: 0,
  };
}

export function QuizEditor({ quizId }: { quizId: string }) {
  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ quiz: QuizRow; questions: QuestionRow[] }>(`/api/admin/quizzes/${quizId}`);
      setQuiz(data.quiz);
      setTitle(data.quiz.title);
      setQuestions(data.questions);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [quizId]);

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

  const saveTitle = () => {
    if (!quiz || title.trim() === quiz.title) return;
    run(async () => setQuiz(await api<QuizRow>(`/api/admin/quizzes/${quizId}`, { method: "PATCH", body: { title } })));
  };

  const saveSetting = (key: keyof QuizSettings, value: number) => {
    if (!quiz || quiz[key] === value) return;
    run(async () => setQuiz(await api<QuizRow>(`/api/admin/quizzes/${quizId}`, { method: "PATCH", body: { [key]: value } })));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    setQuestions(next);
    run(async () => {
      await api(`/api/admin/quizzes/${quizId}/reorder`, { body: { ids: next.map((q) => q.id) } });
    });
  };

  const remove = (q: QuestionRow) => {
    if (!confirm(`Supprimer la question « ${q.prompt} » ?`)) return;
    run(async () => {
      await api(`/api/admin/questions/${q.id}`, { method: "DELETE" });
      await load();
    });
  };

  const save = (d: Draft) =>
    run(async () => {
      const { id, ...body } = d;
      if (id) await api(`/api/admin/questions/${id}`, { method: "PATCH", body });
      else await api("/api/admin/questions", { body: { ...body, quiz_id: quizId } });
      setDraft(null);
      await load();
    });

  if (!quiz) {
    return <div className="admin">{error ? <p className="error-text">{error}</p> : <div className="spinner" />}</div>;
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <Link href="/admin" className="btn btn-ghost btn-small">
          ← Mes quiz
        </Link>
        <input
          className="input title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label="Titre du quiz"
        />
      </header>

      {error && !draft && <p className="error-text">{error}</p>}

      <section className="card">
        <h2>Déroulé automatique</h2>
        <p className="muted small">
          Une fois le quiz lancé, tout s&apos;enchaîne seul : écran des règles, puis chaque question, la bonne réponse et un
          compte à rebours avant la suivante.
        </p>
        <div className="row settings">
          <SettingField label="Temps pour répondre" value={quiz.answer_time} min={5} max={600} onSave={(v) => saveSetting("answer_time", v)} />
          <SettingField label="Pause entre les questions" value={quiz.pause_time} min={3} max={120} onSave={(v) => saveSetting("pause_time", v)} />
          <SettingField label="Affichage des règles" value={quiz.intro_time} min={3} max={300} onSave={(v) => saveSetting("intro_time", v)} />
        </div>
      </section>

      <section className="card">
        <div className="row spread">
          <h2>
            Questions <span className="count-badge">{questions.length}</span>
          </h2>
          <div className="row">
            {(["text", "image", "music"] as QuestionType[]).map((t) => (
              <button key={t} className="btn btn-small btn-primary" onClick={() => setDraft(emptyDraft(t))} disabled={busy}>
                + {TYPE_ICONS[t]} {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {questions.length === 0 ? (
          <p className="muted">Aucune question. Ajoutez une question simple, image ou musicale.</p>
        ) : (
          <ol className="list">
            {questions.map((q, i) => (
              <li key={q.id} className="list-item">
                <span className="q-num">{i + 1}</span>
                <span className="q-type" title={TYPE_LABELS[q.type]}>
                  {TYPE_ICONS[q.type]}
                </span>
                <div className="grow">
                  <strong>{q.prompt}</strong>
                  <span className="q-choices">
                    {q.choices.map((c, ci) => (
                      <span key={ci} className={`mini-choice ${ci === q.correct_index ? "is-correct" : ""}`}>
                        <Letter index={ci} size="sm" />
                        {q.type === "image" && c.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.image_url} alt="" />
                        ) : (
                          c.text
                        )}
                      </span>
                    ))}
                  </span>
                </div>
                <div className="row nowrap">
                  <button className="btn btn-icon btn-ghost" disabled={busy || i === 0} onClick={() => move(i, -1)} title="Monter">
                    ↑
                  </button>
                  <button
                    className="btn btn-icon btn-ghost"
                    disabled={busy || i === questions.length - 1}
                    onClick={() => move(i, 1)}
                    title="Descendre"
                  >
                    ↓
                  </button>
                  <button className="btn btn-small btn-ghost" onClick={() => setDraft({ ...q })} disabled={busy}>
                    ✏️ Éditer
                  </button>
                  <button className="btn btn-icon btn-ghost btn-danger" onClick={() => remove(q)} disabled={busy} title="Supprimer">
                    🗑
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {draft && (
        <QuestionForm
          defaultTime={quiz.answer_time}
          draft={draft}
          busy={busy}
          error={error}
          onCancel={() => {
            setDraft(null);
            setError(null);
          }}
          onSave={save}
        />
      )}
    </div>
  );
}

function SettingField({ label, value, min, max, onSave }: { label: string; value: number; min: number; max: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => {
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n >= min && n <= max) onSave(n);
    else setV(String(value));
  };
  return (
    <label className="inline-field">
      {label}
      <input
        type="number"
        className="input input-narrow"
        min={min}
        max={max}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      s
    </label>
  );
}

function QuestionForm({
  defaultTime,
  draft: initial,
  busy,
  error,
  onCancel,
  onSave,
}: {
  defaultTime: number;
  draft: Draft;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (d: Draft) => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));
  const setChoice = (i: number, patch: Partial<Choice>) =>
    setD((prev) => ({ ...prev, choices: prev.choices.map((c, ci) => (ci === i ? { ...c, ...patch } : c)) }));
  const addChoice = () => set("choices", [...d.choices, { text: "", image_url: null }]);
  const removeChoice = (i: number) =>
    setD((prev) => ({
      ...prev,
      choices: prev.choices.filter((_, ci) => ci !== i),
      correct_index: prev.correct_index === i ? 0 : prev.correct_index > i ? prev.correct_index - 1 : prev.correct_index,
    }));

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form
        className="modal card"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(d);
        }}
      >
        <div className="row spread">
          <h2>{d.id ? "Modifier la question" : "Nouvelle question"}</h2>
          <div className="segmented">
            {(["text", "image", "music"] as QuestionType[]).map((t) => (
              <button
                type="button"
                key={t}
                className={d.type === t ? "active" : ""}
                // L'audio d'une question musicale n'a pas de sens comme image d'illustration, et inversement
                onClick={() =>
                  setD((prev) => ({ ...prev, type: t, media_url: (prev.type === "music") === (t === "music") ? prev.media_url : null }))
                }
              >
                {TYPE_ICONS[t]} {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Intitulé de la question</span>
          <textarea className="input" rows={2} value={d.prompt} onChange={(e) => set("prompt", e.target.value)} required />
        </label>

        {d.type === "music" ? (
          <div className="field">
            <span>Extrait audio (mp3, m4a, ogg…)</span>
            <MediaUpload kind="audio" value={d.media_url} onChange={(url) => set("media_url", url)} />
            <label className="inline-field">
              Démarrer l&apos;extrait à
              <input
                type="number"
                className="input input-narrow"
                min={0}
                step={0.5}
                value={d.media_start}
                onChange={(e) => set("media_start", Number(e.target.value))}
              />
              secondes
            </label>
          </div>
        ) : (
          <div className="field">
            <span>Image d&apos;illustration (facultative, affichée sur le grand écran)</span>
            <MediaUpload kind="image" value={d.media_url} onChange={(url) => set("media_url", url)} />
          </div>
        )}

        <div className="field">
          <span>
            Réponses — cochez la bonne réponse
            {d.type === "text" && <span className="muted small"> · le texte est facultatif : sans texte, seule la lettre s&apos;affiche</span>}
          </span>
          <div className={`choice-editor ${d.type === "image" ? "choice-editor-image" : ""}`}>
            {d.choices.map((c, i) => (
              <div key={i} className={`choice-row ${choiceClass(i)} ${d.correct_index === i ? "is-correct" : ""}`}>
                <label className="correct-toggle" title="Bonne réponse">
                  <input type="radio" name="correct" checked={d.correct_index === i} onChange={() => set("correct_index", i)} />
                  <Letter index={i} />
                </label>
                <div className="grow">
                  {d.type === "image" && (
                    <MediaUpload kind="image" compact value={c.image_url} onChange={(url) => setChoice(i, { image_url: url })} />
                  )}
                  <input
                    className="input"
                    value={c.text}
                    onChange={(e) => setChoice(i, { text: e.target.value })}
                    placeholder={
                      d.type === "image"
                        ? "Légende (facultative)"
                        : d.type === "text"
                          ? `Réponse ${LETTERS[i]} (vide = lettre seule)`
                          : `Réponse ${LETTERS[i]}`
                    }
                  />
                </div>
                {d.choices.length > MIN_CHOICES && (
                  <button type="button" className="btn btn-icon btn-ghost btn-danger" onClick={() => removeChoice(i)} title="Retirer">
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {d.choices.length < MAX_CHOICES && (
            <button type="button" className="btn btn-small btn-ghost" onClick={addChoice}>
              + Ajouter une réponse
            </button>
          )}
        </div>

        <div className="row">
          <label className="inline-field">
            Points
            <input
              type="number"
              className="input input-narrow"
              min={0}
              max={100}
              value={d.points}
              onChange={(e) => set("points", Number(e.target.value))}
            />
          </label>
          <label className="inline-field">
            Temps de réponse
            <input
              type="number"
              className="input input-narrow"
              min={0}
              max={600}
              value={d.time_limit}
              onChange={(e) => set("time_limit", Number(e.target.value))}
            />
            s <span className="muted small">(0 = temps du quiz : {defaultTime} s)</span>
          </label>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="row end">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
