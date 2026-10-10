import { describe, expect, it } from "vitest";
import { disciplineLabel, formatDate, formatSigned } from "./constants";

describe("formatDate", () => {
  it("formatta una data YYYY-MM-DD in italiano, come giorno locale", () => {
    expect(formatDate("2026-10-10")).toBe("10 ott 2026");
    expect(formatDate("2026-01-01", false)).toBe("1 gen");
  });

  it("restituisce stringa vuota per valori assenti e il valore originale se non interpretabile", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("")).toBe("");
    expect(formatDate("non una data")).toBe("non una data");
  });
});

describe("formatSigned", () => {
  it("mostra sempre il segno, con il vero segno meno", () => {
    expect(formatSigned(4.4)).toBe("+4");
    expect(formatSigned(-12)).toBe("−12");
    expect(formatSigned(0.2)).toBe("0");
  });
});

describe("disciplineLabel", () => {
  it("traduce le chiavi note e lascia invariate le altre", () => {
    expect(disciplineLabel("running")).toBe("Corsa");
    expect(disciplineLabel("triathlon")).toBe("Triathlon");
    expect(disciplineLabel("rowing")).toBe("rowing");
    expect(disciplineLabel(null)).toBe("");
  });
});
