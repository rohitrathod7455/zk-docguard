# ZK-DocGuard — Step-by-Step Production Deployment Guide

This guide walks you through deploying ZK-DocGuard from scratch, covering smart contract deployment on Polygon Amoy (or Sepolia/Local), backend API microservices, IPFS storage, and the Next.js 15 PWA frontend.

---

## 1. Pre-Deployment Readiness & System Verification

Before initiating deployment, verify that your machine has the necessary toolchain installed:

- **Node.js**: $\ge 20.0.0$ LTS (`node -v`)
- **pnpm**: $\ge 9.0.0$ (`pnpm -v`)
- **Git**: (`git --version`)

Verify the integrity of the monorepo by running:
```bash
# 1. Verify build across all 8 workspaces
pnpm build

# 2. Verify TypeScript type safety
pnpm typecheck

# 3. Verify linters
pnpm lint

# 4. Verify tests
pnpm test
```

---

## 2. Deployment Architecture Options

Choose the deployment architecture that fits your target environment:

| Component | Option A: Fully Local / Dev | Option B: Public Testnet (Polygon Amoy) | Option C: Docker Compose |
| :--- | :--- | :--- | :--- |
| **Blockchain** | Hardhat Node (Chain ID 31337) | Polygon Amoy Testnet (Chain ID 80002) | Hardhat Node or Polygon Amoy |
| **Smart Contracts** | Local `deploy:local` | Testnet `deploy:amoy` | Pre-deployed or containerized |
| **Database** | SQLite WAL (`dev.db`) | SQLite or PostgreSQL 16 | PostgreSQL 16 container |
| **Storage** | In-Memory / Local IPFS (5001) | Pinata Cloud IPFS Gateway | IPFS Kubo Container (v0.32.1) |
| **Backend API** | Fastify on `localhost:3001` | Cloud VPS / Render / Railway | `zkdg-prod-api` container |
| **Frontend PWA** | Next.js on `localhost:3000` | Vercel / Cloud VPS / Standalone | `zkdg-prod-web` container |

---

## 3. Step-by-Step Deployment: Polygon Amoy Testnet (Option B)

### Step 3.1: Environment Configuration (`.env`)

Create a root `.env` file from the provided `.env.example`:

```bash
cp .env.example .env
```

Populate the required environment variables:

```ini
# ---- General ----
NODE_ENV=production

# ---- Blockchain Deployment ----
# Deployer private key with funded Amoy MATIC/POL (get testnet POL from https://faucet.polygon.technology/)
DEPLOYER_PRIVATE_KEY=your_private_key_without_0x
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
POLYGONSCAN_API_KEY=your_polygonscan_api_key_for_verification

# ---- IPFS & Cloud Pinning ----
IPFS_API_URL=http://localhost:5001
IPFS_GATEWAY_URL=https://gateway.pinata.cloud/ipfs/
PINATA_JWT=your_pinata_jwt_token_here
PINATA_GATEWAY_URL=https://your-subdomain.mypinata.cloud/ipfs/

# ---- Backend API ----
DATABASE_URL="file:./dev.db"
# Or for PostgreSQL:
# DATABASE_URL="postgresql://user:password@host:5432/zkdocguard"
API_HOST=0.0.0.0
API_PORT=3001
LOG_LEVEL=info
SESSION_SECRET=create_a_random_64_character_hex_string_here_1234567890

# ---- Frontend Configuration ----
NEXT_PUBLIC_API_URL=https://api.yourdomain.com  # or http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=80002
NEXT_PUBLIC_RPC_URL=https://rpc-amoy.polygon.technology
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

---

### Step 3.2: Smart Contract Deployment

Deploy all 6 system contracts (`IssuerRegistry`, `DocumentRegistry`, `RevocationRegistry`, `Groth16Verifier`, `Groth16VerifierModeB`, and `VerifierGateway`) to Polygon Amoy:

```bash
pnpm --filter @zk-docguard/contracts deploy:amoy
```

#### Expected Terminal Output:
```
Deploying ZK-DocGuard contracts to: amoy (chainId: 80002)
Deployer address: 0x...
Deployer balance: 1.50 POL

[1/6] Deploying IssuerRegistry...
✔ IssuerRegistry deployed to: 0x...
[2/6] Deploying DocumentRegistry...
✔ DocumentRegistry deployed to: 0x...
[3/6] Deploying RevocationRegistry...
✔ RevocationRegistry deployed to: 0x...
[4/6] Deploying Groth16Verifier (Mode A)...
✔ Groth16Verifier (Mode A) deployed to: 0x...
[5/6] Deploying Groth16VerifierModeB (Mode B)...
✔ Groth16VerifierModeB (Mode B) deployed to: 0x...
[6/6] Deploying VerifierGateway...
✔ VerifierGateway deployed to: 0x...

✔ Deployment addresses saved to: packages/contracts/deployments/amoy.json
✔ Exported network addresses to @zk-docguard/core: packages/core/src/contracts/addresses.json
```

Copy the output addresses and optionally paste them into your `.env`:
```ini
NEXT_PUBLIC_ISSUER_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_DOCUMENT_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_REVOCATION_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_VERIFIER_GATEWAY_ADDRESS=0x...
```

---

### Step 3.3: Verify Contracts on Polygonscan

Verify the deployed contract bytecodes on Polygonscan for full public transparency:

```bash
pnpm --filter @zk-docguard/contracts hardhat run scripts/verify-scan.ts --network amoy
```

---

### Step 3.4: Database Migration & Seeding

Navigate to the API service and initialize the database schema:

```bash
# 1. Run Prisma database migrations / push schema
pnpm --filter @zk-docguard/api exec prisma db push

# 2. Seed initial accredited institution and sample test credentials
pnpm seed
```

This creates:
- **Northfield Institute of Technology** (`did:ethr:80002:0x70997970C51812dc3A010C7d01b50e0d17dc79C8`)
- BabyJubJub active key epoch
- Sample valid student credentials (Alex Vance, Elena Rostova)
- Sample revoked credential for negative verification testing (Marcus Brody)

---

### Step 3.5: Launch the Backend API

To run the API with PM2, systemd, or Node directly:

```bash
# Production start
node apps/api/dist/server.js
```
The API is now listening on port `3001` (or your configured `API_PORT`).
- Health & OpenAPI documentation: `http://localhost:3001/docs`

---

### Step 3.6: Launch the Next.js Frontend PWA

Build and start the Next.js production server:

```bash
# 1. Build optimized production bundle
pnpm --filter @zk-docguard/web build

# 2. Start Next.js production server
pnpm --filter @zk-docguard/web start
```
The citizen wallet and verification portals are now live on port `3000`.

---

## 4. Alternative: One-Command Docker Deployment (Option C)

If you have Docker and Docker Compose installed, you can spin up the complete production cluster in a single command:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Services launched:
1. `zkdg-prod-postgres`: PostgreSQL 16 database with persistent volume `prod_pgdata`
2. `zkdg-prod-ipfs`: Kubo IPFS v0.32.1 with server profile and volume `prod_ipfsdata`
3. `zkdg-prod-api`: Fastify 5.x backend service on port `3001`
4. `zkdg-prod-web`: Next.js 15 standalone PWA frontend on port `3000`

### Checking Container Health:
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

---

## 5. Post-Deployment Verification & Smoke Test

Once deployed, execute a smoke test to confirm that all layers are communicating properly:

1. **API Health Check**:
   ```bash
   curl http://localhost:3001/v1/issuers
   ```
   Should return HTTP 200 with Northfield Institute of Technology.

2. **Frontend Portals Check**:
   - Navigate to `http://localhost:3000` $\rightarrow$ Landing page should render without errors.
   - Navigate to `http://localhost:3000/wallet` $\rightarrow$ SSI wallet vault opens, showing demo student credentials.
   - Navigate to `http://localhost:3000/verifier` $\rightarrow$ Create a challenge session and ensure the pairing QR code displays.

3. **End-to-End Cryptographic Smoke Test**:
   ```bash
   pnpm demo
   ```
   Should execute all 8 stages in under 16 seconds, confirming complete cryptographic alignment across contracts, circuits, IPFS, and provers.
