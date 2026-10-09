import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // N'accepte que les chemins internes pour éviter les redirections ouvertes
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  return <LoginForm next={target} />;
}
