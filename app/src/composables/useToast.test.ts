// Durata e pausa dei toast (audit A-08, decisione D-02): gli informativi restano in base alla lunghezza
// e si fermano finche' il puntatore o il focus sono sul toast; gli errori restano finche' non si chiudono.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, infoDuration, pauseToast, resumeToast, showToast, useToast } from "./useToast";

describe("toast", () => {
  const { visible, kind } = useToast();
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    dismissToast();
    vi.useRealTimers();
  });

  it("la durata cresce con la lunghezza del testo, entro un minimo e un massimo", () => {
    expect(infoDuration("Seduta approvata.")).toBe(4000 + 17 * 60);
    expect(infoDuration("")).toBe(4000);
    expect(infoDuration("x".repeat(400))).toBe(10000);
    // Il messaggio informativo più lungo dell'app (157 caratteri) arriva al massimo.
    expect(infoDuration("La proposta del 10 ott 2026 partiva dal 5 ott, una data già passata: è stata scartata.".padEnd(157, "."))).toBe(10000);
  });

  it("un toast informativo sparisce dopo la sua durata", () => {
    showToast("Seduta approvata.");
    vi.advanceTimersByTime(infoDuration("Seduta approvata.") - 1);
    expect(visible.value).toBe(true);
    vi.advanceTimersByTime(1);
    expect(visible.value).toBe(false);
  });

  it("in pausa non sparisce; alla ripresa resta almeno il tempo per rileggerlo", () => {
    showToast("Seduta approvata.");
    vi.advanceTimersByTime(4000);
    pauseToast();
    vi.advanceTimersByTime(60_000);
    expect(visible.value).toBe(true);
    resumeToast();
    vi.advanceTimersByTime(1999);
    expect(visible.value).toBe(true);
    vi.advanceTimersByTime(1);
    expect(visible.value).toBe(false);
  });

  it("un errore resta finché non viene chiuso, anche dopo pausa e ripresa", () => {
    showToast("Salvataggio non riuscito.", "error");
    pauseToast();
    resumeToast();
    vi.advanceTimersByTime(60_000);
    expect(visible.value).toBe(true);
    expect(kind.value).toBe("error");
    dismissToast();
    expect(visible.value).toBe(false);
  });

  it("un nuovo messaggio riparte con la sua durata e annulla la pausa del precedente", () => {
    showToast("Primo.");
    pauseToast();
    showToast("Modifiche salvate.");
    vi.advanceTimersByTime(infoDuration("Modifiche salvate."));
    expect(visible.value).toBe(false);
  });
});
