export type Locale = "en" | "es";

export function resolveLocale(acceptLanguage?: string, fallback: Locale = "en"): Locale {
  const preferred = acceptLanguage?.split(",")[0]?.trim().toLowerCase();
  if (!preferred) return fallback;
  return preferred === "es" || preferred.startsWith("es-") ? "es" : "en";
}
