import "server-only";
import { NextResponse } from "next/server";
import { isAdmin } from "./auth";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Renvoie une réponse 401 si l'appelant n'est pas admin, sinon null. */
export async function adminGuard() {
  return (await isAdmin()) ? null : fail("Accès réservé à l'admin.", 401);
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

/** Code d'erreur Postgres pour une contrainte d'unicité violée. */
export const UNIQUE_VIOLATION = "23505";
