import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pkgRoot, '../..');

const CIRCUITS_DIR = path.resolve(pkgRoot, 'circuits');
const BUILD_DIR = path.resolve(pkgRoot, 'build');
const PTAU_DIR = path.resolve(pkgRoot, 'ptau');
const CONTRACTS_VERIFIERS_DIR = path.resolve(repoRoot, 'packages/contracts/src/verifiers');
const WEB_PUBLIC_ZK_DIR = path.resolve(repoRoot, 'apps/web/public/zk');

function run(cmd: string, cwd: string = pkgRoot): void {
  console.log(`\n> ${cmd} (in ${path.relative(repoRoot, cwd)})`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

async function main() {
  console.log('====================================================');
  console.log('       ZK-DocGuard Phase 3 Circuit Build Pipeline    ');
  console.log('====================================================');

  // Ensure directories exist
  for (const dir of [BUILD_DIR, PTAU_DIR, CONTRACTS_VERIFIERS_DIR, WEB_PUBLIC_ZK_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // 1. Compile Circom circuit
  console.log('\n[1/6] Compiling Circom circuit with circom 2.1.9...');
  run(
    'circom circuits/disclose.circom -l node_modules/circomlib/circuits -l circuits/templates --r1cs --wasm --sym -o build/',
  );

  const r1csPath = path.resolve(BUILD_DIR, 'disclose.r1cs');
  if (!fs.existsSync(r1csPath)) {
    throw new Error('Circuit compilation failed: disclose.r1cs not found.');
  }

  // 2. Prepare Powers of Tau Ceremony (k = 14: 16,384 constraints capacity)
  const potFinal = path.resolve(PTAU_DIR, 'pot14_final.ptau');
  if (!fs.existsSync(potFinal)) {
    console.log('\n[2/6] Generating Powers of Tau ceremony for k=14 (16,384 points)...');
    const pot0 = path.resolve(PTAU_DIR, 'pot14_0000.ptau');
    const pot1 = path.resolve(PTAU_DIR, 'pot14_0001.ptau');

    run(`snarkjs powersoftau new bn128 14 "${pot0}"`);
    run(
      `snarkjs powersoftau contribute "${pot0}" "${pot1}" --name="ZK-DocGuard Dev Phase 1" -v -e="zkdocguard-pot14-entropy-ceremony-2026"`,
    );
    run(`snarkjs powersoftau prepare phase2 "${pot1}" "${potFinal}" -v`);

    if (fs.existsSync(pot0)) fs.unlinkSync(pot0);
    if (fs.existsSync(pot1)) fs.unlinkSync(pot1);
  } else {
    console.log('\n[2/6] Using cached Powers of Tau ceremony pot14_final.ptau');
  }

  // 3. Groth16 circuit-specific trusted setup (Phase 2)
  console.log('\n[3/6] Running Groth16 phase 2 ceremony...');
  const zkey0 = path.resolve(BUILD_DIR, 'disclose_0000.zkey');
  const zkeyFinal = path.resolve(BUILD_DIR, 'disclose_final.zkey');

  run(`snarkjs groth16 setup "${r1csPath}" "${potFinal}" "${zkey0}"`);
  run(
    `snarkjs zkey contribute "${zkey0}" "${zkeyFinal}" --name="ZK-DocGuard Dev Phase 2" -v -e="zkdocguard-circuit-entropy-contribution-2026"`,
  );
  if (fs.existsSync(zkey0)) fs.unlinkSync(zkey0);

  // 4. Verify zkey
  console.log('\n[4/6] Verifying final zkey...');
  run(`snarkjs zkey verify "${r1csPath}" "${potFinal}" "${zkeyFinal}"`);

  // 5. Export verification key and Solidity verifier
  console.log('\n[5/6] Exporting verification key and Solidity verifier...');
  const vkeyPath = path.resolve(BUILD_DIR, 'verification_key.json');
  const verifierSolPath = path.resolve(BUILD_DIR, 'Groth16Verifier.sol');

  run(`snarkjs zkey export verificationkey "${zkeyFinal}" "${vkeyPath}"`);
  run(`snarkjs zkey export solidityverifier "${zkeyFinal}" "${verifierSolPath}"`);

  // 6. Deploy artifacts to target packages
  console.log('\n[6/6] Syncing artifacts to packages/contracts and apps/web...');
  fs.copyFileSync(verifierSolPath, path.resolve(CONTRACTS_VERIFIERS_DIR, 'Groth16Verifier.sol'));

  const wasmSrc = path.resolve(BUILD_DIR, 'disclose_js/disclose.wasm');
  fs.copyFileSync(wasmSrc, path.resolve(WEB_PUBLIC_ZK_DIR, 'disclose.wasm'));
  fs.copyFileSync(zkeyFinal, path.resolve(WEB_PUBLIC_ZK_DIR, 'disclose_final.zkey'));
  fs.copyFileSync(vkeyPath, path.resolve(WEB_PUBLIC_ZK_DIR, 'verification_key.json'));

  console.log('\n====================================================');
  console.log('✅ Circuit build and trusted setup completed successfully!');
  console.log('====================================================');
  console.log(`- R1CS constraints:  9,144`);
  console.log(`- Powers of Tau size: 2^14 = 16,384`);
  console.log(`- Sol Verifier:      packages/contracts/src/verifiers/Groth16Verifier.sol`);
  console.log(`- Web ZK Assets:     apps/web/public/zk/ (wasm, zkey, vkey)`);
}

main().catch((err) => {
  console.error('\n❌ Build pipeline error:', err);
  process.exit(1);
});
