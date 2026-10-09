"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { browserDb } from "@/lib/supabase-browser";

const MAX_SIZE_MB = 50;

/** Champ d'upload d'image ou d'audio vers Supabase Storage. */
export function MediaUpload({
  kind,
  value,
  onChange,
  compact = false,
}: {
  kind: "image" | "audio";
  value: string | null;
  onChange: (url: string | null) => void;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Fichier trop lourd (max ${MAX_SIZE_MB} Mo).`);
      return;
    }
    const supabase = browserDb();
    if (!supabase) {
      setError("Supabase n'est pas configuré (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
      return;
    }
    setBusy(true);
    try {
      const { path, token, publicUrl } = await api<{ path: string; token: string; publicUrl: string }>("/api/admin/upload", {
        body: { filename: file.name, contentType: file.type },
      });
      const { error: upErr } = await supabase.storage.from("media").uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      onChange(publicUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className={`upload ${compact ? "upload-compact" : ""}`}>
      {value &&
        (kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="upload-preview" />
        ) : (
          <audio src={value} controls className="upload-audio" />
        ))}
      <div className="upload-actions">
        <button type="button" className="btn btn-small btn-ghost" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Envoi…" : value ? "Remplacer" : kind === "image" ? "📷 Choisir une image" : "🎵 Choisir un fichier audio"}
        </button>
        {value && !busy && (
          <button type="button" className="btn btn-small btn-ghost btn-danger" onClick={() => onChange(null)}>
            Retirer
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept={kind === "image" ? "image/*" : "audio/*"}
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
