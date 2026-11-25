/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/** Look up an element by id and check its type; throws if the page markup is out of sync. */
export function byId<T extends HTMLElement>(
    id: string,
    type: abstract new () => T,
    root: Document = document,
): T {
    const element = root.getElementById(id);
    if (!(element instanceof type)) {
        throw new Error(`#${id} is missing or not a ${type.name}`);
    }
    return element;
}
