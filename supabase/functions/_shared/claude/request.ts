// Parti comuni alle chiamate di PCoach alla Messages API (claude-proxy e weekly-feedback), ADR 0041.
// Modulo puro: niente fetch qui, solo intestazioni, parametri e lettura della risposta.

export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

/** Intestazioni: la beta abilita il fallback lato server sui rifiuti (`fallbacks`). */
export function anthropicHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "server-side-fallback-2026-07-01",
  };
}

/** Effort esplicito: con `between_tools` sono ammessi solo i livelli fino a `high`. */
export const EFFORT = "high";

/**
 * Parametri comuni del corpo della richiesta.
 * - `between_tools`: nessun ragionamento esteso prima della risposta (come con Sonnet 4.5), cosi'
 *   durata e token restano prevedibili; senza strumenti non produce blocchi di thinking.
 * - `fallbacks: "default"`: un rifiuto per le categorie che il server sa ripetere viene ripetuto su
 *   un altro modello; il modello effettivo e' sempre quello di `data.model`.
 */
export const COMMON_BODY = {
  thinking: { type: "between_tools" },
  fallbacks: "default",
} as const;

interface ContentBlock { type: string; text?: string }

/** Solo i blocchi di testo della risposta, nell'ordine in cui arrivano. */
export function responseText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return (content as ContentBlock[])
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
}
