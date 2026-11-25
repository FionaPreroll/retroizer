/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/** Build metadata, injected by vite.config.ts (see build/build-info.ts). */
export interface BuildInfo {
    readonly version: string;
    readonly commit: string | null;
    readonly branch: string | null;
    readonly dirty: boolean;
    readonly builtAt: string;
    readonly repositoryUrl: string;
    readonly ci: {
        readonly workflow: string;
        readonly runNumber: string;
        readonly runAttempt: string;
        readonly url: string;
    } | null;
}

/** Third-party material used by the app (see build/third-party.ts). */
export interface ThirdPartyEntry {
    readonly name: string;
    readonly version: string | null;
    readonly license: string;
    readonly purpose: string;
    readonly url: string;
}

declare const __BUILD_INFO__: BuildInfo;
declare const __THIRD_PARTY__: readonly ThirdPartyEntry[];

export const BUILD_INFO: BuildInfo = __BUILD_INFO__;
export const THIRD_PARTY: readonly ThirdPartyEntry[] = __THIRD_PARTY__;
