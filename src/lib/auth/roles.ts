export type AppRole = "consultor" | "editor" | "auditor";

export const ROLE_LABELS: Record<AppRole, string> = {
  consultor: "Consultor",
  editor: "Editor",
  auditor: "Auditor",
};

export const ALLOWED_DOMAINS = ["obramax.com.br", "ext.obramax.com.br"] as const;

export function isCorporateEmail(email: string | null | undefined): boolean {
  const domain = (email ?? "").toLowerCase().split("@")[1] ?? "";
  return (ALLOWED_DOMAINS as readonly string[]).includes(domain);
}
