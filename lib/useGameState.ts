"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { browserDb } from "./supabase-browser";
import type { GameState } from "./types";

/**
 * État de la partie, rafraîchi en temps réel via Supabase Realtime
 * (avec un rafraîchissement périodique de secours).
 */
export function useGameState(code: string, team: { teamId: string; token: string } | null) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const seq = useRef(0);
  const teamId = team?.teamId;
  const token = team?.token;

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    const qs = teamId && token ? `?team=${encodeURIComponent(teamId)}&token=${encodeURIComponent(token)}` : "";
    try {
      const res = await fetch(`/api/games/${code}/state${qs}`, { cache: "no-store" });
      const data = await res.json();
      if (mine !== seq.current) return; // une réponse plus récente est déjà arrivée
      if (!res.ok) {
        setError(data.error ?? "Erreur de connexion");
        return;
      }
      setError(null);
      setClockOffset(data.serverNow - Date.now());
      setState(data);
    } catch {
      if (mine === seq.current) setError("Connexion perdue, nouvelle tentative…");
    }
  }, [code, teamId, token]);

  useEffect(() => {
    refresh();
    const supabase = browserDb();
    const channel = supabase
      ?.channel(`game-${code}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `code=eq.${code}` }, () => {
        refresh();
      })
      .subscribe();
    const interval = setInterval(refresh, channel ? 4000 : 1500);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase?.removeChannel(channel);
    };
  }, [code, refresh]);

  // À la fin de chaque étape, on redemande l'état : c'est ce qui fait avancer la partie toute seule
  const phaseEndsAt = state?.game.phaseEndsAt ?? null;
  const status = state?.game.status;
  useEffect(() => {
    if (phaseEndsAt === null) return;
    const margin = status === "question" ? 1800 : 250; // délai de grâce des réponses côté serveur
    const delay = Math.max(0, phaseEndsAt - (Date.now() + clockOffset)) + margin;
    const id = setTimeout(refresh, delay);
    return () => clearTimeout(id);
  }, [phaseEndsAt, status, clockOffset, refresh]);

  return { state, error, refresh, clockOffset };
}

/** Secondes restantes avant la fin de l'étape en cours (règles, question ou pause) ; null sans chrono. */
export function useCountdown(state: GameState | null, clockOffset: number): number | null {
  const [, setTick] = useState(0);
  const endsAt = state?.game.phaseEndsAt ?? null;
  const paused = state?.game.pausedRemainingMs ?? null;

  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  if (paused !== null) return Math.ceil(paused / 1000);
  if (endsAt === null) return null;
  // Date.now() est lu à chaque rendu : l'intervalle ne sert qu'à provoquer le rafraîchissement
  return Math.max(0, Math.ceil((endsAt - (Date.now() + clockOffset)) / 1000));
}
