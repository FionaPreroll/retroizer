/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/* Messages between the page and the render worker. */

import type { Operation, OperationParams, Palette, Progress } from "./core/types.ts";

export interface RenderRequest {
    readonly id: number;
    readonly operation: Operation;
    /** RGBA pixel data; ownership is transferred to the worker. */
    readonly buffer: ArrayBuffer;
    readonly width: number;
    readonly height: number;
    readonly params: OperationParams;
}

export type RenderResponse =
    | { readonly id: number; readonly type: "progress"; readonly progress: Progress }
    | {
          readonly id: number;
          readonly type: "done";
          readonly buffer: ArrayBuffer;
          readonly palette: Palette | null;
      }
    | { readonly id: number; readonly type: "error"; readonly message: string };
