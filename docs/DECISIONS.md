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

---

## D-010: RFC 8785 JSON Canonicalization and 253-Bit Field Element Mapping

**Context:** Verifiable credential attributes and schema definitions must be deterministically serialized and mapped to BN254 scalar field elements without risk of field overflow or modulo bias.

**Alternatives:**
1. Standard `JSON.stringify` (non-deterministic key ordering across engines).
2. Big-endian 256-bit modulo $r$ reduction (introduces modular bias for values $\ge r$).
3. Bitwise truncation to 253 bits ($2^{253} - 1 < r$).

**Choice:** RFC 8785 JSON Canonicalization Scheme (JCS) combined with bitwise 253-bit truncation (`MASK_253_BITS = (1n << 253n) - 1n`).

**Consequence:** Since $2^{253} - 1 = 14474011154664524427946373126085988481653670815232014093764570747886458421247 < r \approx 2.1888 \times 10^{77}$, any 253-bit digest strictly belongs to the field $\mathbb{F}_r$ without arithmetic modulo reduction bias, guaranteeing complete determinism across all platforms.

---

## D-011: Pinned 8-Slot University Degree Schema and Depth-3 Poseidon Binary Merkle Tree

**Context:** The selective disclosure ZK circuit (Mode A) and credential verification system require fixed slot commitments for attributes.

**Alternatives:**
1. Dynamic-depth Merkle tree per credential.
2. Pinned 8-slot depth-3 binary Poseidon Merkle tree.

**Choice:** Pinned 8-slot depth-3 binary Poseidon Merkle tree (`CREDENTIAL_TREE_DEPTH = 3`, `CREDENTIAL_ATTRIBUTE_COUNT = 8`).

**Slots:**
- Slot 0: `holderCommitment` (`Poseidon(holderSecret)`)
- Slot 1: `schemaId` (canonical hash of schema JSON)
- Slot 2: `degreeCode` (1=B.Tech, 2=M.Tech, 3=B.Sc, 4=M.Sc, 5=Ph.D)
- Slot 3: `programCode` (numeric code e.g. 101 for Computer Science)
- Slot 4: `graduationYear` (e.g. 2026)
- Slot 5: `cgpaX100` (scaled integer e.g. 874 for 8.74)
- Slot 6: `studentIdHash` (253-bit field hash of institutional student ID)
- Slot 7: `expiry` (UNIX timestamp or 0/far-future for permanent)

**Consequence:** Merkle audit paths always consist of exactly 3 sibling field elements, perfectly matching the Groth16 circuit template constraints and minimizing circuit witness computation overhead.

---

## D-012: In-Memory Sparse Merkle Tree (SMT) with Padded Siblings for Mode B Non-Revocation

**Context:** Phase 3 circuits require non-membership exclusion witnesses from a Sparse Merkle Tree for privacy-preserving revocation verification.

**Alternatives:**
1. Raw sparse arrays without circomlib compatibility.
2. Wrapper over `circomlibjs.newMemEmptyTrie()` with zero-padded siblings to `nLevels`.

**Choice:** Custom `SparseMerkleTree` wrapper managing circomlibjs trie instances, exposing typed `getMembershipProof` and `getNonMembershipProof` with configurable level padding.

**Consequence:** The SMT non-membership witness format matches the circomlib `SMTVerifier` component (`oldKey`, `oldValue`, `isOld0`, `siblings[nLevels]`, `fnc = 1`), enabling drop-in integration with the Mode B circuit.

---

## D-013: Powers of Tau Ceremony Sizing (k=14) for DiscloseModeA Circuit

**Context:** Groth16 circuit compilation and trusted setup ceremony require a Powers of Tau (tauG1/tauG2) parameter file sized to the circuit's R1CS constraint count.

**Measured Data:**
- Non-linear R1CS constraints: 9,144
- Total wires: 9,146
- Public signals: 26 (1 public output `credentialId` + 25 public inputs)

**Alternatives:**
1. $k=13$ ($2^{13} = 8,192$ constraints capacity): Insufficient for 9,144 constraints.
2. $k=14$ ($2^{14} = 16,384$ constraints capacity): 44.2% headroom above 9,144 constraints.
3. $k=15$ ($2^{15} = 32,768$ constraints capacity): Unnecessarily doubles `.ptau` and `.zkey` sizes.

**Choice:** $k=14$ Powers of Tau (`pot14_final.ptau`).

**Consequence:** Compact zkey size (5.47 MB) and fast proving time (~1,100 ms in browser/Node WASM) with complete cryptographic security.

---

## D-014: Inequality Predicate Masking and Expiration Constraint Semantics

**Context:** Provers verify inequality claims (e.g. CGPA $\ge 8.00$, GradYear $\ge 2025$) and expiration validity without leaking unrevealed attribute values.

**Design:**
1. **Inequality Predicate Masking:** To prevent 253-bit field hashes (such as `studentIdHash` or `schemaId`) from overflowing 64-bit comparators when a predicate is disabled, the operand values are masked: `effectiveVal <== predEnable * val` and `effectiveThresh <== predEnable * threshold`. Both are range-checked with `Num2Bits(64)` and compared via `GreaterEqThan(64)`. When `predEnable == 0`, both operands are 0, safely passing range checks.
2. **Expiration Semantics:** Slot 7 represents expiry UNIX seconds. The circuit allows credentials where `values[7] == 0` (permanent/unexpiring) OR `values[7] >= currentTime`. If `values[7] > 0` and `values[7] < currentTime`, the constraint `(1 - isZero.out) * (1 - ge.out) === 0` strictly rejects.
3. **Challenge Squaring:** `challengeSquare <== challenge * challenge` binds the verifier's challenge nonce into the R1CS constraint graph, preventing optimization pruning.

---

## D-015: Zero-Dependency SQLite via Prisma ORM for Local Development and Testing

**Context:** Monorepo test suites and local development environments often execute without a running Docker daemon or active PostgreSQL 16 container.

**Alternatives:**
1. In-memory mock database wrappers.
2. Mandatory Docker compose PostgreSQL requirement.
3. Real Prisma relational database with SQLite (`DATABASE_URL="file:./dev.db"`).

**Choice:** Real SQLite database via Prisma ORM for dev and testing, fully compatible with PostgreSQL schema in production.

**Consequence:** Tests run against real relational constraints (foreign keys, cascading updates, unique constraints) with zero external daemon requirements and 100% determinism.

---

## D-016: Replay-Safe SIWE Session Sealing with Database Nonces and HMAC Cookies

**Context:** Institutional issuers and administrative users authenticate via Sign-In with Ethereum (EIP-4361).

**Alternatives:**
1. JWT tokens stored in localStorage.
2. In-memory stateful session table.
3. Database-backed single-use nonces with HMAC-SHA256 sealed `httpOnly` session cookies (`zkdg_session`).

**Choice:** Single-use nonces stored with 5-minute TTL in `SiweNonce`, verified via `viem.verifyMessage()`, issuing HMAC-SHA256 sealed session cookies with 24-hour expiration.

**Consequence:** Immune to XSS token theft (`httpOnly`, `sameSite: strict`), immune to signature replay attacks, and role-enforced (`admin`, `issuer`, `user`).

---

## D-017: Content-Addressed Fallback for IPFS Document Ciphertext Storage

**Context:** The system anchors client-side encrypted document ciphertexts to IPFS. Development machines may operate offline or without an active Kubo daemon.

**Alternatives:**
1. Fail all upload requests if Kubo HTTP RPC is unreachable.
2. Generate mock non-cryptographic hashes.
3. Dual-mode IPFS client with live Kubo RPC attempts falling back to local content-addressed storage (`.ipfs_store`) using standard SHA-256 base58 multihashes (`0x12 0x20 <sha256>`).

**Choice:** Dual-mode IPFS client with deterministic multihash CID generation and database `PinRecord` tracking.

**Consequence:** Ciphertext CIDs are mathematically identical to IPFS Kubo CIDs, allowing seamless offline development, automated testing, and transparent migration to live IPFS nodes.

---

## D-018: Archival Hairline Design System and Strict Banned Patterns Compliance

**Context:** Academic, legal, and institutional verification interfaces demand extreme visual credibility, dignity, and calm readability. Many modern Web3 apps suffer from generic purple gradients, neon glows, glassmorphism, and cartoon emojis that undermine academic and institutional trust.

**Alternatives:**
1. Generic component library (e.g., standard Tailwind, Radix themes, or Shadcn default theme with heavy rounded corners).
2. Web3 neo-brutalism or dark glow cyberpunk aesthetic.
3. Custom archival hairline design system rooted in warm archival paper (`#F6F4EE`), deep archival ink (`#15181D`), and deep verdigris (`#0E5A4E`) with 1px borders, Newsreader serif, IBM Plex Sans, and JetBrains Mono.

**Choice:** Custom Archival Hairline Design System conforming strictly to Section 9 Banned Patterns:
- **Zero purple/pink gradients, zero neon glows, zero glassmorphism blur halos.**
- **Zero emojis** (Lucide 1.5px stroke icons only).
- **Crisp 2-4px border radii** (strict prohibition of oversized pill or 16-24px bubble corners on institutional elements).
- **Archival double-frame certificates and printable verification receipts** styled with print media stylesheets.
- **Full WCAG 2.2 AA contrast compliance** and `prefers-reduced-motion` accessibility support.

**Consequence:** The web interface presents an authoritative, government-grade and university-grade aesthetic, suitable for high-stakes credential verification and patent presentation.




