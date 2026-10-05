# ZK-DocGuard — Architecture Decision Record

> Each decision: context, options, choice, consequence.

---

## D-001: Monorepo tooling

**Context:** Need a monorepo to share types, ABIs, and crypto between contracts, API, and web.

**Options:**

1. Nx — mature, but opinionated and heavy
2. Turborepo + pnpm workspaces — lightweight, task caching, native pnpm support
3. Lerna — legacy, maintenance mode

**Choice:** Turborepo + pnpm workspaces

**Consequence:** Minimal config, fast builds via caching, easy to add packages. Turborepo does not manage dependency graph directly (pnpm does), so `turbo.json` only defines tasks.

---

## D-002: Solidity version and EVM target

**Context:** Contracts must deploy to Polygon Amoy (PoS testnet, chainId 80002) and Sepolia.

**Options:**

1. Solidity 0.8.24 + `evmVersion: "paris"` — safe, no PUSH0 issues
2. Solidity 0.8.26 + `evmVersion: "cancun"` — newer but may not be supported on all targets

**Choice:** Solidity 0.8.24, `evmVersion: "paris"`

**Consequence:** Compatible with all target chains. Avoids PUSH0 opcode issues on chains that haven't adopted Shanghai.

---

## D-003: ethers v6 vs viem

**Context:** Need an EVM library for contract interactions.

**Options:**

1. ethers v6 — used with Hardhat natively via `@nomicfoundation/hardhat-ethers`
2. viem — used by wagmi, lighter, tree-shakeable

**Choice:** Both — ethers v6 for Hardhat test/deploy scripts (it's native), viem for the core library and frontend (via wagmi).

**Consequence:** Must maintain two sets of contract interaction code, but each is optimized for its context.

---

## D-004: Docker availability

**Context:** Docker is not currently installed on the development machine.

**Options:**

1. Require Docker for all dev work
2. Make Docker optional — provide the compose file but allow local alternatives

**Choice:** Docker is optional for development. Hardhat node runs natively via `npx hardhat node`. PostgreSQL and IPFS can be installed locally or run via Docker. Docker Compose file is provided for convenience and is required for CI.

**Consequence:** Development can proceed without Docker. CI uses Docker services. Docker Compose file is tested structurally.

---

## D-005: Node version

**Context:** Master prompt specifies Node 20 LTS.

**Options:**

1. Node 20 LTS (specified)
2. Node 22 LTS (installed on dev machine: v22.20.0)

**Choice:** Use Node 22 (already installed), set `engines` to `>=20.0.0` for compatibility.

**Consequence:** Dev machine runs Node 22 which is a superset of Node 20 features. CI uses Node 20 to validate compatibility.

---

## D-006: Custom Errors and NatSpec in Contracts

**Context:** Smart contracts need clear error reporting with low gas consumption and comprehensive documentation.

**Options:**

1. Traditional `require(condition, "error message")` strings
2. Custom errors with typed parameters (`revert MyError(param)`)

**Choice:** Custom errors for all revert conditions combined with strict NatSpec comments.

**Consequence:** Significantly reduced deployment and execution bytecode size, gas savings (~20-50 gas per revert), and typed error handling in client libraries.

---

## D-007: Batch Issuance Merkle Scheme

**Context:** Institutions issuing thousands of credentials need an inexpensive on-chain anchor without writing individual storage slots per credential.

**Options:**

1. Individual on-chain registrations (147k gas per document)
2. Standard binary Merkle tree with sorted pairs using OpenZeppelin's `MerkleProof` library

**Choice:** OpenZeppelin `MerkleProof` sorted pair tree with a single `registerBatch(batchRoot, count, manifestCid)` transaction (~145k gas for unlimited documents).

**Consequence:** Batch anchoring cost is constant O(1) gas on-chain regardless of batch size. Individual documents verify in O(log N) through `verifyInBatch`.

---

## D-008: Revocation Ring Buffer Size

**Context:** Verifiers need to check non-membership proofs against an SMT root that may have been updated between proof generation and on-chain verification.

**Options:**

1. Only the single latest root valid (brittle to race conditions when other credentials are revoked)
2. Unbounded root history array (growing storage, expensive lookup)
3. Fixed-size ring buffer of recent roots (32 elements)

**Choice:** 32-element ring buffer (`ROOT_HISTORY_SIZE = 32`).

**Consequence:** Proofs referencing roots from the last 32 epochs remain valid, providing a reliable tolerance window for concurrent revocations while bounding storage and iteration gas (~64k gas per root update).

---

## D-009: Slither Static Analysis Findings Acceptance

**Context:** Slither security analysis identified timestamp usage and internal OpenZeppelin dependencies.

**Findings & Rationale:**

1. `block.timestamp` in expiry comparisons and key grace periods: Accepted because block timestamps cannot be manipulated by miners beyond a few seconds (EVM post-Merge has fixed 12s slots). Expiry and grace windows operate on orders of days or years.
2. `assembly` in OpenZeppelin `Hashes.sol`: Accepted as standard audited OpenZeppelin library code.
3. `naming-convention`: Solhint requires `UPPER_SNAKE_CASE` for immutable variables (`ISSUER_REGISTRY`), while Slither flags non-mixedCase. The Solhint standard was maintained.
