# Chapter 9: Performance Evaluation & Experimental Results

## 9.1 Experimental Setup & Methodology

All performance benchmarks were conducted on a standardized x64 AVX2 test environment running Windows 11 with 16 GB RAM, Node.js v20.18.0, Circom 2.1.9, Snarkjs 0.7.5, and Hardhat EVM (`paris` fork). Smart contract deployments and gas metrics were measured under exact EVM opcode pricing simulating Polygon Amoy.

---

## 9.2 Circuit Benchmarks: Mode A vs. Mode B

Table 9.1 summarizes the R1CS constraint complexity, artifact footprints, and execution latencies for both proving modes.

### Table 9.1: Zero-Knowledge Circuit Complexity and Proving Benchmarks
| Metric | Mode A (`DiscloseModeA`) | Mode B (`DiscloseModeB`) | Delta | Relative Change |
| :--- | :--- | :--- | :--- | :--- |
| **Total Constraints** | 9,144 | 12,933 | +3,789 | +41.4% |
| **Total Wires** | 9,146 | 12,935 | +3,789 | +41.4% |
| **Public Inputs/Outputs** | 26 | 26 | 0 | 0.0% |
| **Powers of Tau Degree ($k$)** | 14 ($2^{14} = 16,384$) | 14 ($2^{14} = 16,384$) | 0 | Same SRS bucket |
| **Proving Key Size (`.zkey`)** | 5.74 MB (5,739,969 B) | 7.70 MB (7,696,108 B) | +1.96 MB | +34.1% |
| **WASM Prover Size (`.wasm`)** | 2.84 MB (2,842,334 B) | 3.31 MB (3,308,284 B) | +0.47 MB | +16.4% |
| **Groth16 Proof Size** | 724 bytes | 724 bytes | 0 | Exact match |
| **Avg. Desktop Witness Time** | 235.5 ms | 232.5 ms | -3.0 ms | -1.3% |
| **Avg. Desktop Proving Time** | 841.2 ms | 801.7 ms | -39.5 ms | -4.7% |
| **Min / Max Proving Time** | 610.6 ms / 1,278.5 ms | 713.9 ms / 883.6 ms | -- | -- |
| **Avg. Desktop Verification** | 14.7 ms | 15.3 ms | +0.6 ms | +4.1% |
| **Mobile Proving Estimate (ARM64)** | 2,397.4 ms | 2,284.8 ms | -112.6 ms | -4.7% |

```
Proving Time Comparison: Mode A vs Mode B (Desktop vs Mobile)
--------------------------------------------------------------------------------
Mode A Desktop (841 ms)  : [========                                        ]
Mode B Desktop (802 ms)  : [========                                        ]
Mode A Mobile (2,397 ms) : [========================                        ]
Mode B Mobile (2,285 ms) : [=======================                         ]
--------------------------------------------------------------------------------
```
*Visual representation referenced from `benchmarks/results/charts/chart-proving-time.svg`.*

### Key Observation:
Despite Mode B introducing 3,789 additional constraints (+41.4%) to verify SMT exclusion, both circuits reside comfortably within the $k=14$ Powers of Tau boundary (capacity 16,384 constraints). Consequently, the FFT and multi-scalar multiplication (MSM) stages operate over identical polynomial domain sizes ($2^{14}$ elements), yielding virtually identical proving times (~800 ms on desktop and ~2.3 seconds on mobile).

---

## 9.3 Smart Contract Gas Consumption & Batch Amortization

Table 9.2 details the deployment and operational gas costs across all on-chain components.

### Table 9.2: Smart Contract Gas Execution Metrics
| Contract / Operation | Gas Consumed (Units) | Est. Cost @ 30 Gwei (POL) | Est. Cost @ $0.40/POL (USD) |
| :--- | :--- | :--- | :--- |
| **Contract Deployments** | | | |
| `IssuerRegistry` | 1,508,850 | 0.0453 POL | $0.0181 |
| `DocumentRegistry` | 1,532,329 | 0.0460 POL | $0.0184 |
| `RevocationRegistry` | 822,610 | 0.0247 POL | $0.0099 |
| `Groth16Verifier` (Mode A) | 859,475 | 0.0258 POL | $0.0103 |
| `Groth16VerifierModeB` | 859,499 | 0.0258 POL | $0.0103 |
| `VerifierGateway` | 884,141 | 0.0265 POL | $0.0106 |
| **Operational Transactions** | | | |
| `IssuerRegistry.applyAsIssuer` | 209,812 | 0.0063 POL | $0.0025 |
| `IssuerRegistry.approveIssuer` | 30,707 | 0.0009 POL | $0.0004 |
| `IssuerRegistry.rotateKey` | 87,736 | 0.0026 POL | $0.0011 |
| `DocumentRegistry.registerDocument` (Single) | 192,308 | 0.0058 POL | $0.0023 |
| `RevocationRegistry.revokeCredential` (Mode A) | 76,049 | 0.0023 POL | $0.0009 |
| `RevocationRegistry.updateRevocationRoot` (Mode B) | 80,530 | 0.0024 POL | $0.0010 |
| `Groth16Verifier.verifyProof` (Mode A standalone) | 384,621 | 0.0115 POL | $0.0046 |
| `Groth16VerifierModeB.verifyProof` (Mode B standalone) | 384,645 | 0.0115 POL | $0.0046 |
| `VerifierGateway.consumeAndVerify` (Mode A) | 432,901 | 0.0130 POL | $0.0052 |
| `VerifierGateway.consumeAndVerify` (Mode B) | 435,258 | 0.0131 POL | $0.0052 |

### Table 9.3: Document Registration Batch Amortization
| Registration Scenario | Total Gas Cost | Effective Gas Per Document | Marginal Cost Per Document | Amortization Savings |
| :--- | :--- | :--- | :--- | :--- |
| **Single Document** | 192,308 | 192,308 | 192,308 gas | 0.0% (Baseline) |
| **Batch of 10 Documents** | 145,289 | 14,529 | 14,529 gas | **92.4% reduction** |
| **Batch of 50 Documents** | 145,289 | 2,906 | 2,906 gas | **98.5% reduction** |
| **Batch of 100 Documents** | 145,301 | 1,453 | 1,453 gas | **99.2% reduction** |

```
Batch Registration Gas Amortization (Gas per Document)
--------------------------------------------------------------------------------
Single Doc (192,308 gas) : [==================================================]
Batch 10 (14,529 gas)    : [====                                              ]
Batch 50 (2,906 gas)     : [=                                                 ]
Batch 100 (1,453 gas)    : [                                                  ] (99.2% Drop)
--------------------------------------------------------------------------------
```
*Visual representation referenced from `benchmarks/results/charts/chart-batch-amortization.svg`.*

---

## 9.4 Sparse Merkle Tree Scaling Benchmarks

Table 9.4 documents the build throughput and non-membership witness extraction latencies across three orders of magnitude of revocation leaves.

### Table 9.4: SMT-10 Performance Across Scaling Horizons
| Leaf Capacity ($N$) | Tree Construction Time | Ingestion Throughput | Incremental Insert Latency | Non-Membership Proof Latency | Membership Proof Latency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1,000 Leaves** | 1,646.4 ms | 607 leaves / sec | 1.52 ms | **0.09 ms** | 0.10 ms |
| **10,000 Leaves** | 19,581.6 ms | 511 leaves / sec | 2.03 ms | **0.13 ms** | 0.11 ms |
| **100,000 Leaves** | 219,314.0 ms | 456 leaves / sec | 2.40 ms | **0.15 ms** | 0.13 ms |

### Logarithmic Scaling Analysis:
While total tree build time scales linearly with initial batch size ($O(N \log d)$), non-membership witness query time scales strictly with tree depth ($d = 10$). Moving from 1,000 leaves to 100,000 leaves (a 100x increase in revocation state) increases witness extraction latency by only **0.06 ms** (from 0.09 ms to 0.15 ms). This empirical result confirms that verifier gateways can service real-time proof requests instantaneously regardless of institutional credential volume.

*Visual representation referenced from `benchmarks/results/charts/chart-smt-scaling.svg`.*

---

## 9.5 End-to-End System Presentation Latency

Figure 9.1 illustrates the breakdown of a complete end-to-end presentation session from initial challenge generation to receipt issuance, totaling **3,217.2 ms**.

### Table 9.5: E2E Presentation Pipeline Timing
| Workflow Stage | Description | Measured Latency | Proportion |
| :--- | :--- | :--- | :--- |
| **Step 1: Session Creation** | Verifier generates session challenge nonce | 22.9 ms | 0.7% |
| **Step 2: Session Fetch** | Client requests session requirements via REST | 10.0 ms | 0.3% |
| **Step 3: Witness Fetch** | Client downloads SMT exclusion path from Issuer API | 694.9 ms | 21.6% |
| **Step 4: Client Proving** | Web Worker synthesizes witness and Groth16 proof | **1,574.4 ms** | **48.9%** |
| **Step 5: Verification** | Gateway verifies proof and checks on-chain state | 911.5 ms | 28.3% |
| **Step 6: Receipt Generation** | Verifier produces HMAC-SHA256 signed presentation token | 3.5 ms | 0.1% |
| **Total Pipeline** | **Full End-to-End Presentation Cycle** | **3,217.2 ms** | **100.0%** |

```
E2E Latency Breakdown (Total: 3,217.2 ms)
--------------------------------------------------------------------------------
Session Setup (33ms)      : [=]
SMT Witness Fetch (695ms) : [======]
Client Proving (1,574ms)  : [==============                                  ]
Verification (912ms)      : [========]
Receipt Gen (3.5ms)       : []
--------------------------------------------------------------------------------
```
*Visual representation referenced from `benchmarks/results/charts/chart-e2e-timeline.svg`.*

---

## 9.6 IPFS Payload Roundtrip Benchmarks

Table 9.6 evaluates encrypted payload transport via Helia IPFS.

### Table 9.6: Helia IPFS Encrypted Storage Performance
| Document Payload Type | Size (Bytes) | Client Encryption | IPFS Upload Latency | Download & Decryption | Total Roundtrip |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Metadata / Claim Assertions** | 1,024 B (1 KB) | 1.77 ms | 243.35 ms | 6.73 ms | 251.85 ms |
| **Detailed Academic Record** | 10,240 B (10 KB) | 0.41 ms | 12.00 ms | 2.95 ms | 15.36 ms |
| **Diploma Certificate (JPEG)** | 102,400 B (100 KB) | 0.24 ms | 11.47 ms | 4.23 ms | 15.94 ms |
| **Full Transcript Package (PDF)** | 512,000 B (500 KB) | 0.85 ms | 13.61 ms | 13.09 ms | 27.55 ms |

---

## 9.7 Ephemeral Sharing Throughput

Evaluating the ephemeral key wrapping module under continuous load yields:
- **Keypair Generation**: 0.85 ms
- **Key Wrapping (`ChaCha20-Poly1305`)**: 5.79 ms
- **Key Unwrapping & Decryption**: 6.12 ms
- **Total Share Cycle**: 12.76 ms
- **Effective Throughput**: **78 shares / second** on a single thread.
