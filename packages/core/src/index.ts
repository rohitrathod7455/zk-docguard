/**
 * @module @zk-docguard/core
 * @description Shared library for ZK-DocGuard: cryptographic primitives, DID management,
 * Verifiable Credential construction & verification, schema registry, field encoding,
 * SMT revocation helpers, and smart contract client wrappers.
 */
export const CORE_VERSION = '0.1.0';

export * from './crypto/index.js';
export * from './did/index.js';
export * from './schema/index.js';
export * from './vc/index.js';
export * from './smt/index.js';
export * from './contracts/index.js';
