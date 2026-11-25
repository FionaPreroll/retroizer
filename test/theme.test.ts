import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, isTheme, THEMES } from "../src/ui/theme.ts";
import { litSegments } from "../src/ui/status.ts";

describe("themes", () => {
    it("accepts only known themes", () => {
        for (const theme of THEMES) expect(isTheme(theme)).toBe(true);
        expect(isTheme("magenta")).toBe(false);
        expect(isTheme(null)).toBe(false);
        expect(THEMES).toContain(DEFAULT_THEME);
    });
});

describe("litSegments", () => {
    it("maps progress to 24 segments and clamps", () => {
        expect(litSegments(0)).toBe(0);
        expect(litSegments(50)).toBe(12);
        expect(litSegments(100)).toBe(24);
        expect(litSegments(140)).toBe(24);
        expect(litSegments(-5)).toBe(0);
        expect(litSegments(Number.NaN)).toBe(0);
    });
});
