/* tslint:disable */
/* eslint-disable */

export class Commit {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    commit: Uint8Array;
    epoch: bigint;
    get welcome(): Uint8Array | undefined;
    set welcome(value: Uint8Array | null | undefined);
}

export class Opened {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    epoch: bigint;
    plaintext: Uint8Array;
    sender: Uint8Array;
}

export class PulseDevice {
    free(): void;
    [Symbol.dispose](): void;
    addMembers(group_id: Uint8Array, key_packages: Uint8Array[]): Commit;
    createGroup(group_id: Uint8Array): bigint;
    currentEpoch(group_id: Uint8Array): bigint;
    decrypt(group_id: Uint8Array, frame: Uint8Array, sender_key: Uint8Array): Opened;
    discardPending(group_id: Uint8Array): void;
    dropGroup(group_id: Uint8Array): void;
    encrypt(group_id: Uint8Array, plaintext: Uint8Array): Uint8Array;
    epochKey(group_id: Uint8Array, epoch: bigint): Uint8Array | undefined;
    exportState(): Uint8Array;
    static frameSender(frame: Uint8Array): Uint8Array;
    /**
     * Signed public snapshot of the group, published so other devices can join on their own.
     */
    groupInfo(group_id: Uint8Array): Uint8Array;
    hasGroup(group_id: Uint8Array): boolean;
    identityKey(): Uint8Array;
    importEpochKey(group_id: Uint8Array, epoch: bigint, key: Uint8Array): void;
    /**
     * Joins from a published snapshot (MLS external commit). The group is in place on
     * return but must not be used until the server accepts the commit.
     */
    joinExternal(group_id: Uint8Array, group_info: Uint8Array, epoch: bigint): Commit;
    join(welcome: Uint8Array): Uint8Array;
    /**
     * Signature key of a current member, or undefined if not in the group.
     */
    keyPackageIdentity(key_package: Uint8Array): Uint8Array;
    keyPackage(): Uint8Array;
    /**
     * Identities of the devices currently in the group.
     */
    memberIdentities(group_id: Uint8Array): Uint8Array[];
    memberKey(group_id: Uint8Array, identity: Uint8Array): Uint8Array | undefined;
    mergePending(group_id: Uint8Array): bigint;
    constructor(identity: Uint8Array);
    /**
     * Applies another device's commit; `sender` is the identity the server says sent it.
     */
    processCommit(group_id: Uint8Array, commit: Uint8Array, sender: Uint8Array): bigint;
    removeMembers(group_id: Uint8Array, identities: Uint8Array[]): Commit;
    static restore(state: Uint8Array): PulseDevice;
    selfUpdate(group_id: Uint8Array): Commit;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_commit_free: (a: number, b: number) => void;
    readonly __wbg_get_commit_commit: (a: number, b: number) => void;
    readonly __wbg_get_commit_epoch: (a: number) => bigint;
    readonly __wbg_get_commit_welcome: (a: number, b: number) => void;
    readonly __wbg_get_opened_epoch: (a: number) => bigint;
    readonly __wbg_get_opened_plaintext: (a: number, b: number) => void;
    readonly __wbg_get_opened_sender: (a: number, b: number) => void;
    readonly __wbg_opened_free: (a: number, b: number) => void;
    readonly __wbg_pulsedevice_free: (a: number, b: number) => void;
    readonly __wbg_set_commit_commit: (a: number, b: number, c: number) => void;
    readonly __wbg_set_commit_epoch: (a: number, b: bigint) => void;
    readonly __wbg_set_commit_welcome: (a: number, b: number, c: number) => void;
    readonly __wbg_set_opened_epoch: (a: number, b: bigint) => void;
    readonly __wbg_set_opened_plaintext: (a: number, b: number, c: number) => void;
    readonly __wbg_set_opened_sender: (a: number, b: number, c: number) => void;
    readonly pulsedevice_addMembers: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly pulsedevice_createGroup: (a: number, b: number, c: number, d: number) => void;
    readonly pulsedevice_currentEpoch: (a: number, b: number, c: number, d: number) => void;
    readonly pulsedevice_decrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly pulsedevice_discardPending: (a: number, b: number, c: number, d: number) => void;
    readonly pulsedevice_dropGroup: (a: number, b: number, c: number, d: number) => void;
    readonly pulsedevice_encrypt: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly pulsedevice_epochKey: (a: number, b: number, c: number, d: number, e: bigint) => void;
    readonly pulsedevice_exportState: (a: number, b: number) => void;
    readonly pulsedevice_frameSender: (a: number, b: number, c: number) => void;
    readonly pulsedevice_groupInfo: (a: number, b: number, c: number, d: number) => void;
    readonly pulsedevice_hasGroup: (a: number, b: number, c: number) => number;
    readonly pulsedevice_identityKey: (a: number, b: number) => void;
    readonly pulsedevice_importEpochKey: (a: number, b: number, c: number, d: number, e: bigint, f: number, g: number) => void;
    readonly pulsedevice_join: (a: number, b: number, c: number, d: number) => void;
    readonly pulsedevice_joinExternal: (a: number, b: number, c: number, d: number, e: number, f: number, g: bigint) => void;
    readonly pulsedevice_keyPackage: (a: number, b: number) => void;
    readonly pulsedevice_keyPackageIdentity: (a: number, b: number, c: number, d: number) => void;
    readonly pulsedevice_memberIdentities: (a: number, b: number, c: number, d: number) => void;
    readonly pulsedevice_memberKey: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly pulsedevice_mergePending: (a: number, b: number, c: number, d: number) => void;
    readonly pulsedevice_new: (a: number, b: number, c: number) => void;
    readonly pulsedevice_processCommit: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly pulsedevice_removeMembers: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly pulsedevice_restore: (a: number, b: number, c: number) => void;
    readonly pulsedevice_selfUpdate: (a: number, b: number, c: number, d: number) => void;
    readonly __wbindgen_export: (a: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export3: (a: number, b: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
