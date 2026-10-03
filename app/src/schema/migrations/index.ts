// Punto unico di ingresso per le migrazioni di schema applicate ai profili letti da
// Supabase: idempotente, un profilo già nel formato corrente passa invariato.
import type { AthleteTrainingProfile } from "../types.generated";
import { splitLegacyName } from "./identitySplit";

export interface ProfileMigrationResult {
  profile: AthleteTrainingProfile;
  heuristicApplied: boolean;
}

export function migrateProfile(profile: AthleteTrainingProfile): ProfileMigrationResult {
  const { identity, heuristicApplied } = splitLegacyName(profile.identity);
  if (!heuristicApplied) return { profile, heuristicApplied: false };
  return {
    profile: { ...profile, identity: identity as AthleteTrainingProfile["identity"] },
    heuristicApplied: true
  };
}
