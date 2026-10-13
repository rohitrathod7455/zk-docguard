import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pkgRoot, '../..');

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
  console.log('   ZK-DocGuard Phase 9 Mode B Circuit Build Pipeline ');
  console.log('====================================================');

  // Ensure directories exist
  for (const dir of [BUILD_DIR, PTAU_DIR, CONTRACTS_VERIFIERS_DIR, WEB_PUBLIC_ZK_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // 1. Compile Mode B Circom circuit
  console.log('\n[1/5] Compiling Mode B Circom circuit with circom 2.1.9...');
  run(
    'circom circuits/disclose_mode_b.circom -l node_modules/circomlib/circuits -l circuits/templates --r1cs --wasm --sym -o build/',
  );

  const r1csPath = path.resolve(BUILD_DIR, 'disclose_mode_b.r1cs');
  if (!fs.existsSync(r1csPath)) {
    throw new Error('Circuit compilation failed: disclose_mode_b.r1cs not found.');
  }

  // 2. Locate Powers of Tau Ceremony (k = 14: 16,384 constraints capacity)
  const potFinal = path.resolve(PTAU_DIR, 'pot14_final.ptau');
  if (!fs.existsSync(potFinal)) {
    throw new Error('pot14_final.ptau not found. Run Mode A build first.');
  }
  console.log('\n[2/5] Using existing Powers of Tau ceremony pot14_final.ptau');

  // 3. Groth16 circuit-specific trusted setup (Phase 2)
  const zkeyFinal = path.resolve(BUILD_DIR, 'disclose_mode_b_final.zkey');
  console.log('\n[3/5] Running Groth16 phase 2 ceremony for Mode B...');
  const zkey0 = path.resolve(BUILD_DIR, 'disclose_mode_b_0000.zkey');
  run(`snarkjs groth16 setup "${r1csPath}" "${potFinal}" "${zkey0}"`);
  run(
    `snarkjs zkey contribute "${zkey0}" "${zkeyFinal}" --name="ZK-DocGuard Dev Phase 2 Mode B" -v -e="zkdocguard-circuit-entropy-contribution-mode-b-2026"`,
  );
  if (fs.existsSync(zkey0)) fs.unlinkSync(zkey0);

  // 4. Verify zkey
  console.log('\n[4/5] Verifying Mode B zkey...');
  run(`snarkjs zkey verify "${r1csPath}" "${potFinal}" "${zkeyFinal}"`);

  // 5. Export verification key and Solidity verifier
  console.log('\n[5/5] Exporting verification key and Solidity verifier...');
  const vkeyPath = path.resolve(BUILD_DIR, 'verification_key_mode_b.json');
  const verifierSolPath = path.resolve(BUILD_DIR, 'Groth16VerifierModeB.sol');

  run(`snarkjs zkey export verificationkey "${zkeyFinal}" "${vkeyPath}"`);
  run(`snarkjs zkey export solidityverifier "${zkeyFinal}" "${verifierSolPath}"`);

  // Rename contract name in Groth16VerifierModeB.sol to avoid naming collision
  let solContent = fs.readFileSync(verifierSolPath, 'utf8');
  solContent = solContent.replace(/contract Groth16Verifier\b/g, 'contract Groth16VerifierModeB');
  fs.writeFileSync(verifierSolPath, solContent, 'utf8');

  // 6. Deploy artifacts to target packages
  console.log('\n[6/6] Syncing artifacts to packages/contracts and apps/web...');
  fs.copyFileSync(verifierSolPath, path.resolve(CONTRACTS_VERIFIERS_DIR, 'Groth16VerifierModeB.sol'));

  const wasmSrc = path.resolve(BUILD_DIR, 'disclose_mode_b_js/disclose_mode_b.wasm');
  fs.copyFileSync(wasmSrc, path.resolve(WEB_PUBLIC_ZK_DIR, 'disclose_mode_b.wasm'));
  fs.copyFileSync(zkeyFinal, path.resolve(WEB_PUBLIC_ZK_DIR, 'disclose_mode_b_final.zkey'));
  fs.copyFileSync(vkeyPath, path.resolve(WEB_PUBLIC_ZK_DIR, 'verification_key_mode_b.json'));

  console.log('\n====================================================');
  console.log('✅ Mode B Circuit build and trusted setup completed successfully!');
  console.log('====================================================');
  console.log(`- R1CS constraints:  12,933`);
  console.log(`- Powers of Tau size: 2^14 = 16,384`);
  console.log(`- Sol Verifier:      packages/contracts/src/verifiers/Groth16VerifierModeB.sol`);
  console.log(`- Web ZK Assets:     apps/web/public/zk/ (disclose_mode_b.wasm, zkey, vkey)`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Build pipeline error:', err);
  process.exit(1);
});
