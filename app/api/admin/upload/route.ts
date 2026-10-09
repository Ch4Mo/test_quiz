import crypto from "crypto";
import { adminGuard, fail, ok, readJson } from "@/lib/http";
import { db, MEDIA_BUCKET } from "@/lib/supabase-server";

/**
 * Prépare l'envoi d'un média : renvoie une URL d'upload signée.
 * Le navigateur envoie ensuite le fichier directement à Supabase Storage,
 * ce qui contourne la limite de 4,5 Mo des fonctions Vercel.
 */
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { filename, contentType } = await readJson(req);
  const type = typeof contentType === "string" ? contentType : "";
  if (!type.startsWith("image/") && !type.startsWith("audio/")) return fail("Seules les images et les fichiers audio sont acceptés.");

  const ext = (typeof filename === "string" ? filename.split(".").pop() : "")?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  const path = `${type.startsWith("audio/") ? "audio" : "images"}/${crypto.randomUUID()}.${ext}`;

  const storage = db().storage.from(MEDIA_BUCKET);
  const { data, error } = await storage.createSignedUploadUrl(path);
  if (error) return fail(`Stockage indisponible : ${error.message}`, 500);
  return ok({ path: data.path, token: data.token, publicUrl: storage.getPublicUrl(path).data.publicUrl });
}
