/// <reference types="node" />
// Contrasti dei token di colore (WCAG 2.2 AA) in entrambi i temi: testo 4,5:1, confini dei campi 3:1.
// Il file si legge dal disco: Vitest non elabora il CSS importato.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const light = block(":root {");
const dark = { ...light, ...block(':root[data-theme="dark"]') };

describe.each([["chiaro", light], ["scuro", dark]])("tema %s", (_, t) => {
  it("testo normale almeno 4,5:1", () => {
    const pairs: [string, string][] = [["text", "bg"], ["text", "surface"], ["text-muted", "bg"], ["text-muted", "surface"], ["text-muted", "surface-2"],
      ["warning", "warning-bg"], ["warning", "bg"], ["danger", "danger-bg"], ["danger", "bg"], ["accent", "bg"], ["accent-contrast", "accent"]];
    for (const [fg, bg] of pairs) expect(contrast(t[fg], t[bg]), `${fg} su ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it("confini dei campi almeno 3:1", () => {
    for (const bg of ["bg", "surface"]) expect(contrast(t["border-control"], t[bg]), `border-control su ${bg}`).toBeGreaterThanOrEqual(3);
  });
});

// I controlli nativi (date, menu, caselle, barre di scorrimento) seguono il tema solo se il documento lo
// dichiara con color-scheme (audit A-05).
describe("color-scheme", () => {
  const declared = (selector: string) => {
    const start = css.indexOf(selector);
    return css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start)).match(/color-scheme:\s*(\w+)/)?.[1];
  };
  it("chiaro nella radice, scuro nei due blocchi del tema scuro", () => {
    expect(declared(":root {")).toBe("light");
    expect(declared(':root:not([data-theme="light"])')).toBe("dark");
    expect(declared(':root[data-theme="dark"]')).toBe("dark");
  });
});
