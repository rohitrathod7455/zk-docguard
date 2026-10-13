import { runCircuitBenchmarks } from './circuit-benchmarks.js';
import { runSmtBenchmarks } from './smt-benchmarks.js';
import { generateAllCharts } from './generate-charts.js';

async function main() {
  console.log('====================================================');
  console.log('   ZK-DOCGUARD BENCHMARK & METRICS VALIDATION SUITE  ');
  console.log('====================================================');

  console.log('\n[1/3] Running Circuit Benchmarks...');
  await runCircuitBenchmarks();

  console.log('\n[2/3] Running Sparse Merkle Tree Scaling Benchmarks...');
  await runSmtBenchmarks();

  console.log('\n[3/3] Generating Vector Charts...');
  generateAllCharts();

  console.log('\n All benchmarks executed successfully and written to benchmarks/results/');
  process.exit(0);
}

main().catch((err) => {
  console.error('Benchmark suite execution failed:', err);
  process.exit(1);
});
