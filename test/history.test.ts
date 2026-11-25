import { describe, expect, it } from "vitest";
import { History } from "../src/ui/history.ts";

describe("History", () => {
    it("undoes and redoes", () => {
        const history = new History<string>(10);
        history.push("a");
        expect(history.undo("b")).toBe("a");
        expect(history.redo("a")).toBe("b");
        expect(history.redo("b")).toBeNull();
    });

    it("keeps at most `limit` undo steps", () => {
        const history = new History<string>(2);
        ["a", "b", "c"].forEach((s) => {
            history.push(s);
        });
        expect(history.undo("d")).toBe("c");
        expect(history.undo("c")).toBe("b");
        expect(history.undo("b")).toBeNull();
    });

    it("clears redo on push", () => {
        const history = new History<string>();
        history.push("a");
        history.undo("b");
        history.push("x");
        expect(history.canRedo).toBe(false);
        expect(history.redo("y")).toBeNull();
    });
});
