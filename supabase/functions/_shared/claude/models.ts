// Modelli Claude ammessi da PCoach (decisione del coach D-06, ADR 0020): solo modelli verificati
// con entrambi i flussi. Il feedback usa uno strumento con tool_choice forzato, che i modelli piu'
// recenti (Claude Opus 5.5, Claude Sonnet 5.5, Claude Fable 5.1) rifiutano: prima di aggiungerli
// qui va adattata la chiamata in weekly-feedback e verificato il piano su atleti di prova.
// Modulo puro condiviso tra app, claude-proxy e weekly-feedback.

export interface SupportedModel {
  id: string;
  label: string;
}

export const SUPPORTED_MODELS: readonly SupportedModel[] = [
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" }
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
