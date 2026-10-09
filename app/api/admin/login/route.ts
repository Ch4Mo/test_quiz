import { ADMIN_COOKIE, checkPassword } from "@/lib/auth";
import { fail, ok, readJson } from "@/lib/http";

export async function POST(req: Request) {
  if (!process.env.ADMIN_PASSWORD) return fail("ADMIN_PASSWORD n'est pas configuré sur le serveur.", 500);
  const { password } = await readJson(req);
  const token = checkPassword(typeof password === "string" ? password : "");
  if (!token) return fail("Mot de passe incorrect.", 401);
  const res = ok({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
