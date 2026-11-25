/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/** Bounded undo/redo stacks of snapshots (canvas ImageData in the app). */
export class History<T> {
    private readonly limit: number;
    private undoStack: T[] = [];
    private redoStack: T[] = [];

    /** @param limit maximum number of undo steps kept */
    constructor(limit = 10) {
        this.limit = limit;
    }

    /** Number of undo steps currently stored. */
    get size(): number {
        return this.undoStack.length;
    }

    get capacity(): number {
        return this.limit;
    }

    get canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    get canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /** Record the state before a change. Clears the redo stack. */
    push(snapshot: T): void {
        this.undoStack.push(snapshot);
        if (this.undoStack.length > this.limit) this.undoStack.shift();
        this.redoStack = [];
    }

    /** Returns the state to restore (or null); `current` becomes redoable. */
    undo(current: T): T | null {
        const previous = this.undoStack.pop();
        if (previous === undefined) return null;
        this.redoStack.push(current);
        return previous;
    }

    /** Returns the state to restore (or null); `current` becomes undoable. */
    redo(current: T): T | null {
        const next = this.redoStack.pop();
        if (next === undefined) return null;
        this.undoStack.push(current);
        return next;
    }

    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
    }
}
