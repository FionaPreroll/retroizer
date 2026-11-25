import { describe, expect, it } from "vitest";
import { rgbToHex } from "../src/core/color.ts";
import { formatStatusLine } from "../src/ui/status.ts";

describe("rgbToHex", () => {
    it("formats, rounds and clamps", () => {
        expect(rgbToHex([255, 204, 0])).toBe("#FFCC00");
        expect(rgbToHex([0.4, 15.6, 300])).toBe("#0010FF");
    });
});

describe("formatStatusLine", () => {
    it("pads short and truncates long messages to 24 characters", () => {
        expect(formatStatusLine("READY")).toBe("READY".padEnd(24));
        const long = formatStatusLine("ERROR", "Failed to read clipboard contents");
        expect(long).toHaveLength(24);
        expect(long.endsWith("..")).toBe(true);
    });
});
