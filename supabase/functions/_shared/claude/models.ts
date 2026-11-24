// Modelli Claude ammessi da PCoach (decisione del coach D-06, ADR 0020 e 0041): solo modelli verificati
// con entrambi i flussi. La generazione del piano chiede testo, il feedback un output strutturato
// (output_config.format); entrambi spengono il thinking con `between_tools`, che esiste solo su
// Claude Sonnet 5.5: prima di aggiungere un altro modello vanno adattate le due chiamate
// (_shared/claude/request.ts) e verificato il piano su atleti di prova.
// Modulo puro condiviso tra app, claude-proxy e weekly-feedback.

export interface SupportedModel {
  id: string;
  label: string;
}

export const SUPPORTED_MODELS: readonly SupportedModel[] = [
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" }
];

export const DEFAULT_MODEL = SUPPORTED_MODELS[0].id;

export function isSupportedModel(id: unknown): id is string {
  return typeof id === "string" && SUPPORTED_MODELS.some((m) => m.id === id);
}

/** Il modello richiesto se ammesso, altrimenti quello predefinito. */
export function resolveModel(...candidates: unknown[]): string {
  for (const c of candidates) if (isSupportedModel(c)) return c;
  return DEFAULT_MODEL;
}
