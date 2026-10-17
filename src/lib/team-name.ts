export function formatOpponentDisplayName(name: string) {
  return name
    .replace(/\s+U[\s-]?\d{1,2}(?:\s?[A-Z])?$/i, "")
    .replace(/^(?:KVV\.?|K\.?|Koninklijke)\s+/i, "")
    .trim();
}
