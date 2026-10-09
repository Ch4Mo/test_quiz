import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE = "quiz_admin";

function expectedToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return crypto.createHmac("sha256", password).update("quiz-live-admin-v1").digest("hex");
}

export function checkPassword(candidate: string): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  const a = crypto.createHash("sha256").update(candidate).digest();
  const b = crypto.createHash("sha256").update(password).digest();
  return crypto.timingSafeEqual(a, b) ? expectedToken() : null;
}

export async function isAdmin(): Promise<boolean> {
  const expected = expectedToken();
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!expected || !value || value.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

/** Pour les pages : redirige vers la connexion si l'utilisateur n'est pas admin. */
export async function requireAdminPage(next: string): Promise<void> {
  if (!(await isAdmin())) redirect(`/admin/login?next=${encodeURIComponent(next)}`);
}
