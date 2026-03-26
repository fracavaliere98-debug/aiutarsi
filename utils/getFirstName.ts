export function getFirstName(rawName?: string | null): string {
  const normalized = String(rawName || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  return normalized.split(" ")[0] || "";
}
