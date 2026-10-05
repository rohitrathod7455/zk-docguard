declare module 'circomlibjs' {
  export interface BabyJub {
    p: bigint;
    order: bigint;
    subOrder: bigint;
    Base8: [bigint, bigint];
    zero: [bigint, bigint];
    F: {
      p: bigint;
      e(x: bigint | number | string): bigint;
      toObject(x: bigint): bigint;
      toString(x: bigint, base?: number): string;
    };
    add(p1: [bigint, bigint], p2: [bigint, bigint]): [bigint, bigint];
    mulPointEscalar(base: [bigint, bigint], scalar: bigint): [bigint, bigint];
    packPoint(p: [bigint, bigint]): Uint8Array;
    unpackPoint(buff: Uint8Array): [bigint, bigint] | null;
  }

  export interface Eddsa {
    babyJub: BabyJub;
    F: {
      p: bigint;
      e(x: bigint | number | string): bigint;
      toObject(x: bigint): bigint;
      toString(x: bigint, base?: number): string;
    };
    prv2pub(prvKey: Uint8Array): [bigint, bigint];
    signPoseidon(
      prvKey: Uint8Array,
      msg: bigint,
    ): {
      R8: [bigint, bigint];
      S: bigint;
    };
    verifyPoseidon(
      msg: bigint,
      sig: { R8: [bigint, bigint]; S: bigint },
      pubKey: [bigint, bigint],
    ): boolean;
    packSignature(sig: { R8: [bigint, bigint]; S: bigint }): Uint8Array;
    unpackSignature(buff: Uint8Array): { R8: [bigint, bigint]; S: bigint };
  }

  export interface Poseidon {
    (inputs: (bigint | number | string)[]): bigint;
    F: {
      p: bigint;
      e(x: bigint | number | string): bigint;
      toObject(x: bigint): bigint;
      toString(x: bigint, base?: number): string;
    };
  }

  export interface SMTFindResult {
    found: boolean;
    foundValue?: Uint8Array;
    isOld0: boolean;
    notFoundKey?: Uint8Array;
    notFoundValue?: Uint8Array;
    siblings: Uint8Array[];
  }

  export interface SMT {
    root: Uint8Array;
    F: {
      toObject(x: Uint8Array | bigint): bigint;
      e(x: bigint | number | string): Uint8Array | bigint;
    };
    insert(key: bigint | Uint8Array, value: bigint | Uint8Array): Promise<void>;
    delete(key: bigint | Uint8Array): Promise<void>;
    update(key: bigint | Uint8Array, value: bigint | Uint8Array): Promise<void>;
    find(key: bigint | Uint8Array): Promise<SMTFindResult>;
  }

  export function buildPoseidon(): Promise<Poseidon>;
  export function buildEddsa(): Promise<Eddsa>;
  export function buildBabyjub(): Promise<BabyJub>;
  export function newMemEmptyTrie(): Promise<SMT>;
}
