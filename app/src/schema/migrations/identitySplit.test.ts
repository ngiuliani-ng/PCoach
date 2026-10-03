import { describe, it, expect } from "vitest";
import { splitLegacyName } from "./identitySplit";

describe("splitLegacyName", () => {
  it("divide un nome legacy con due parole in nome/cognome", () => {
    const result = splitLegacyName({ name: "Mario Rossi" });
    expect(result.identity.nome).toBe("Mario");
    expect(result.identity.cognome).toBe("Rossi");
    expect(result.heuristicApplied).toBe(true);
  });

  it("mette tutte le parole oltre la prima nel cognome (euristica)", () => {
    const result = splitLegacyName({ name: "Maria De Luca" });
    expect(result.identity.nome).toBe("Maria");
    expect(result.identity.cognome).toBe("De Luca");
    expect(result.heuristicApplied).toBe(true);
  });

  it("gestisce un nome con una sola parola lasciando il cognome vuoto", () => {
    const result = splitLegacyName({ name: "Mario" });
    expect(result.identity.nome).toBe("Mario");
    expect(result.identity.cognome).toBe("");
    expect(result.heuristicApplied).toBe(true);
  });

  it("non applica la migrazione se nome/cognome sono già presenti", () => {
    const result = splitLegacyName({ nome: "Mario", cognome: "Rossi" });
    expect(result.identity.nome).toBe("Mario");
    expect(result.identity.cognome).toBe("Rossi");
    expect(result.heuristicApplied).toBe(false);
  });

  it("non applica la migrazione se non c'è alcun nome", () => {
    const result = splitLegacyName({});
    expect(result.identity.nome).toBeUndefined();
    expect(result.identity.cognome).toBeUndefined();
    expect(result.heuristicApplied).toBe(false);
  });

  it("non applica la migrazione per identity undefined", () => {
    const result = splitLegacyName(undefined);
    expect(result.identity.nome).toBeUndefined();
    expect(result.heuristicApplied).toBe(false);
  });

  it("rimuove il campo legacy name dal risultato", () => {
    const result = splitLegacyName({ name: "Mario Rossi", email: "mario@example.com" });
    expect("name" in result.identity).toBe(false);
    expect(result.identity.email).toBe("mario@example.com");
  });
});
