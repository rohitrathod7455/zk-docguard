# ZK-DocGuard

**Privacy-Preserving Blockchain Document Verification System using Zero-Knowledge Proofs and Self-Sovereign Identity**

---

## Overview

ZK-DocGuard enables institutions to issue verifiable credentials anchored on an EVM blockchain, with documents encrypted and stored on IPFS. Holders generate zero-knowledge proofs in the browser to selectively disclose credential attributes — proving claims like "degree = B.Tech" or "graduation year ≥ 2020" without revealing the full document.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed diagrams.

## Quick Start

### Prerequisites

- Node.js ≥ 20
- pnpm 9
- Docker + Docker Compose (optional, for services)

### Setup

```bash
# Clone and install
git clone <repo-url>
cd zk-docguard
pnpm install

# Copy environment variables
cp .env.example .env

# Start development services (optional, requires Docker)
docker compose up -d

# Run all checks
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### Development

```bash
# Start all dev servers
pnpm dev

# Run tests
pnpm test

# Format code
pnpm format
```

## Project Structure

```
zk-docguard/
├── packages/
│   ├── contracts/    # Solidity smart contracts (Hardhat)
│   ├── circuits/     # Circom ZK circuits
│   ├── core/         # Shared TypeScript library
│   └── config/       # Shared configurations
├── apps/
│   ├── api/          # Fastify backend service
│   └── web/          # Next.js frontend
├── e2e/              # End-to-end tests
├── benchmarks/       # Performance benchmarks
└── docs/             # Documentation
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Decisions](docs/DECISIONS.md)
- [Progress](docs/PROGRESS.md)

## License

MIT
