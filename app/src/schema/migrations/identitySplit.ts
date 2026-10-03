// Migrazione da schema_version < 1.4.0 (identity.name unico) a >= 1.4.0
// (identity.nome/identity.cognome separati). Euristica: la prima parola del nome
// completo diventa "nome", il resto diventa "cognome" — non sempre corretto per
// nomi composti o cognomi con più parole, per questo la funzione segnala sempre
// se ha applicato la divisione, cosi' il chiamante puo' avvisare il coach e
// permettergli di correggere a mano.
export interface AthleteIdentityLike {
  name?: string;
  nome?: string;
  cognome?: string;
  [key: string]: unknown;
}

export interface IdentitySplitResult {
  identity: AthleteIdentityLike;
  heuristicApplied: boolean;
}

export function splitLegacyName(identity: AthleteIdentityLike | undefined): IdentitySplitResult {
  const source = identity ?? {};
  const { name, nome, cognome, ...rest } = source;

  if (nome !== undefined || cognome !== undefined || typeof name !== "string" || !name.trim()) {
    return { identity: { ...rest, nome, cognome }, heuristicApplied: false };
  }

  const parts = name.trim().split(/\s+/);
  return {
    identity: { ...rest, nome: parts[0], cognome: parts.slice(1).join(" ") },
    heuristicApplied: true
  };
}
