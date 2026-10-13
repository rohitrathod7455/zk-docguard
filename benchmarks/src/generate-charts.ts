import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resultsDir = path.resolve(__dirname, '../results');
const chartsDir = path.resolve(resultsDir, 'charts');

if (!fs.existsSync(chartsDir)) {
  fs.mkdirSync(chartsDir, { recursive: true });
}

export function generateAllCharts() {
  console.log('[Chart Generator] Generating vector SVG charts from benchmark data...');

  const circuitData = JSON.parse(fs.readFileSync(path.resolve(resultsDir, 'circuit-benchmarks.json'), 'utf8'));
  const gasData = JSON.parse(fs.readFileSync(path.resolve(resultsDir, 'gas-benchmarks.json'), 'utf8'));
  const smtData = JSON.parse(fs.readFileSync(path.resolve(resultsDir, 'smt-benchmarks.json'), 'utf8'));
  const systemData = JSON.parse(fs.readFileSync(path.resolve(resultsDir, 'system-benchmarks.json'), 'utf8'));

  // 1. Chart: Proving Time Comparison (Mode A vs Mode B)
  const chartProvingSvg = `
<svg width="800" height="420" viewBox="0 0 800 420" xmlns="http://www.w3.org/2000/svg" style="background:#15181D; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <rect width="800" height="420" fill="#15181D"/>
  <text x="40" y="45" fill="#F6F4EE" font-size="20" font-weight="600">Groth16 Proving &amp; Verification Latency (Mode A vs Mode B)</text>
  <text x="40" y="70" fill="#8C929D" font-size="13">Measured on desktop (AVX2) and projected mobile WebWorker (ARM64)</text>

  <!-- Legend -->
  <rect x="520" y="40" width="14" height="14" fill="#0E5A4E" rx="2"/>
  <text x="542" y="52" fill="#D0D5DD" font-size="12">Mode A (Disclose)</text>
  <rect x="660" y="40" width="14" height="14" fill="#1F7A4D" rx="2"/>
  <text x="682" y="52" fill="#D0D5DD" font-size="12">Mode B (SMT In-Circuit)</text>

  <!-- Grid -->
  <line x1="80" y1="340" x2="740" y2="340" stroke="#2B313A" stroke-width="1"/>
  <line x1="80" y1="260" x2="740" y2="260" stroke="#2B313A" stroke-width="1" stroke-dasharray="4"/>
  <line x1="80" y1="180" x2="740" y2="180" stroke="#2B313A" stroke-width="1" stroke-dasharray="4"/>
  <line x1="80" y1="100" x2="740" y2="100" stroke="#2B313A" stroke-width="1" stroke-dasharray="4"/>

  <!-- Y-Axis Labels -->
  <text x="65" y="345" fill="#8C929D" font-size="11" text-anchor="end">0 ms</text>
  <text x="65" y="265" fill="#8C929D" font-size="11" text-anchor="end">800 ms</text>
  <text x="65" y="185" fill="#8C929D" font-size="11" text-anchor="end">1,600 ms</text>
  <text x="65" y="105" fill="#8C929D" font-size="11" text-anchor="end">2,400 ms</text>

  <!-- Category 1: Desktop Witness -->
  <rect x="130" y="${340 - (circuitData.circuits.modeA.desktopTiming.averageWitnessTimeMs / 2400) * 240}" width="45" height="${(circuitData.circuits.modeA.desktopTiming.averageWitnessTimeMs / 2400) * 240}" fill="#0E5A4E" rx="3"/>
  <rect x="180" y="${340 - (circuitData.circuits.modeB.desktopTiming.averageWitnessTimeMs / 2400) * 240}" width="45" height="${(circuitData.circuits.modeB.desktopTiming.averageWitnessTimeMs / 2400) * 240}" fill="#1F7A4D" rx="3"/>
  <text x="177" y="365" fill="#D0D5DD" font-size="13" text-anchor="middle">Witness Gen</text>
  <text x="152" y="${330 - (circuitData.circuits.modeA.desktopTiming.averageWitnessTimeMs / 2400) * 240}" fill="#F6F4EE" font-size="11" text-anchor="middle">${circuitData.circuits.modeA.desktopTiming.averageWitnessTimeMs}ms</text>
  <text x="202" y="${330 - (circuitData.circuits.modeB.desktopTiming.averageWitnessTimeMs / 2400) * 240}" fill="#F6F4EE" font-size="11" text-anchor="middle">${circuitData.circuits.modeB.desktopTiming.averageWitnessTimeMs}ms</text>

  <!-- Category 2: Desktop Prove -->
  <rect x="300" y="${340 - (circuitData.circuits.modeA.desktopTiming.averageProvingTimeMs / 2400) * 240}" width="45" height="${(circuitData.circuits.modeA.desktopTiming.averageProvingTimeMs / 2400) * 240}" fill="#0E5A4E" rx="3"/>
  <rect x="350" y="${340 - (circuitData.circuits.modeB.desktopTiming.averageProvingTimeMs / 2400) * 240}" width="45" height="${(circuitData.circuits.modeB.desktopTiming.averageProvingTimeMs / 2400) * 240}" fill="#1F7A4D" rx="3"/>
  <text x="347" y="365" fill="#D0D5DD" font-size="13" text-anchor="middle">Desktop Prove</text>
  <text x="322" y="${330 - (circuitData.circuits.modeA.desktopTiming.averageProvingTimeMs / 2400) * 240}" fill="#F6F4EE" font-size="11" text-anchor="middle">${circuitData.circuits.modeA.desktopTiming.averageProvingTimeMs}ms</text>
  <text x="372" y="${330 - (circuitData.circuits.modeB.desktopTiming.averageProvingTimeMs / 2400) * 240}" fill="#F6F4EE" font-size="11" text-anchor="middle">${circuitData.circuits.modeB.desktopTiming.averageProvingTimeMs}ms</text>

  <!-- Category 3: Mobile Prove (Estimated) -->
  <rect x="470" y="${340 - (circuitData.circuits.modeA.mobileEstimatedTiming.averageProvingTimeMs / 2400) * 240}" width="45" height="${(circuitData.circuits.modeA.mobileEstimatedTiming.averageProvingTimeMs / 2400) * 240}" fill="#0E5A4E" rx="3"/>
  <rect x="520" y="${340 - (circuitData.circuits.modeB.mobileEstimatedTiming.averageProvingTimeMs / 2400) * 240}" width="45" height="${(circuitData.circuits.modeB.mobileEstimatedTiming.averageProvingTimeMs / 2400) * 240}" fill="#1F7A4D" rx="3"/>
  <text x="517" y="365" fill="#D0D5DD" font-size="13" text-anchor="middle">Mobile Prove</text>
  <text x="492" y="${330 - (circuitData.circuits.modeA.mobileEstimatedTiming.averageProvingTimeMs / 2400) * 240}" fill="#F6F4EE" font-size="11" text-anchor="middle">${circuitData.circuits.modeA.mobileEstimatedTiming.averageProvingTimeMs}ms</text>
  <text x="542" y="${330 - (circuitData.circuits.modeB.mobileEstimatedTiming.averageProvingTimeMs / 2400) * 240}" fill="#F6F4EE" font-size="11" text-anchor="middle">${circuitData.circuits.modeB.mobileEstimatedTiming.averageProvingTimeMs}ms</text>

  <!-- Category 4: Node Verification -->
  <rect x="640" y="${340 - (circuitData.circuits.modeA.desktopTiming.averageVerificationTimeMs / 2400) * 240}" width="45" height="${Math.max(4, (circuitData.circuits.modeA.desktopTiming.averageVerificationTimeMs / 2400) * 240)}" fill="#0E5A4E" rx="3"/>
  <rect x="690" y="${340 - (circuitData.circuits.modeB.desktopTiming.averageVerificationTimeMs / 2400) * 240}" width="45" height="${Math.max(4, (circuitData.circuits.modeB.desktopTiming.averageVerificationTimeMs / 2400) * 240)}" fill="#1F7A4D" rx="3"/>
  <text x="687" y="365" fill="#D0D5DD" font-size="13" text-anchor="middle">API Verify</text>
  <text x="662" y="${330 - (circuitData.circuits.modeA.desktopTiming.averageVerificationTimeMs / 2400) * 240}" fill="#F6F4EE" font-size="11" text-anchor="middle">${circuitData.circuits.modeA.desktopTiming.averageVerificationTimeMs}ms</text>
  <text x="712" y="${330 - (circuitData.circuits.modeB.desktopTiming.averageVerificationTimeMs / 2400) * 240}" fill="#F6F4EE" font-size="11" text-anchor="middle">${circuitData.circuits.modeB.desktopTiming.averageVerificationTimeMs}ms</text>
</svg>
  `.trim();
  fs.writeFileSync(path.resolve(chartsDir, 'chart-proving-time.svg'), chartProvingSvg, 'utf8');

  // 2. Chart: Batch Amortization Gas Comparison
  const batchSavings = gasData.batchAmortization;
  const chartBatchSvg = `
<svg width="800" height="400" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" style="background:#15181D; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <rect width="800" height="400" fill="#15181D"/>
  <text x="40" y="45" fill="#F6F4EE" font-size="20" font-weight="600">On-Chain Document Anchoring: Gas per Document</text>
  <text x="40" y="70" fill="#8C929D" font-size="13">Merkle root batch anchoring achieves 99.2% gas reduction at 100 documents</text>

  <!-- Grid -->
  <line x1="80" y1="320" x2="740" y2="320" stroke="#2B313A" stroke-width="1"/>
  <line x1="80" y1="240" x2="740" y2="240" stroke="#2B313A" stroke-width="1" stroke-dasharray="4"/>
  <line x1="80" y1="160" x2="740" y2="160" stroke="#2B313A" stroke-width="1" stroke-dasharray="4"/>
  <line x1="80" y1="80" x2="740" y2="80" stroke="#2B313A" stroke-width="1" stroke-dasharray="4"/>

  <!-- Y-Axis Labels -->
  <text x="65" y="325" fill="#8C929D" font-size="11" text-anchor="end">0</text>
  <text x="65" y="245" fill="#8C929D" font-size="11" text-anchor="end">65k</text>
  <text x="65" y="165" fill="#8C929D" font-size="11" text-anchor="end">130k</text>
  <text x="65" y="85" fill="#8C929D" font-size="11" text-anchor="end">200k gas</text>

  <!-- Bars -->
  <!-- 1. Single -->
  <rect x="120" y="${320 - (batchSavings.singleDocumentRegistrationGas / 200000) * 240}" width="90" height="${(batchSavings.singleDocumentRegistrationGas / 200000) * 240}" fill="#A3302B" rx="3"/>
  <text x="165" y="345" fill="#D0D5DD" font-size="13" text-anchor="middle">Single Doc</text>
  <text x="165" y="${310 - (batchSavings.singleDocumentRegistrationGas / 200000) * 240}" fill="#F6F4EE" font-size="12" font-weight="600" text-anchor="middle">192,308 gas</text>

  <!-- 2. Batch 10 -->
  <rect x="280" y="${320 - (batchSavings.batch10.gasPerDoc / 200000) * 240}" width="90" height="${Math.max(6, (batchSavings.batch10.gasPerDoc / 200000) * 240)}" fill="#0E5A4E" rx="3"/>
  <text x="325" y="345" fill="#D0D5DD" font-size="13" text-anchor="middle">Batch 10</text>
  <text x="325" y="${305 - (batchSavings.batch10.gasPerDoc / 200000) * 240}" fill="#F6F4EE" font-size="12" font-weight="600" text-anchor="middle">14,529 gas</text>

  <!-- 3. Batch 50 -->
  <rect x="440" y="${320 - (batchSavings.batch50.gasPerDoc / 200000) * 240}" width="90" height="${Math.max(6, (batchSavings.batch50.gasPerDoc / 200000) * 240)}" fill="#0E5A4E" rx="3"/>
  <text x="485" y="345" fill="#D0D5DD" font-size="13" text-anchor="middle">Batch 50</text>
  <text x="485" y="${305 - (batchSavings.batch50.gasPerDoc / 200000) * 240}" fill="#F6F4EE" font-size="12" font-weight="600" text-anchor="middle">2,906 gas</text>

  <!-- 4. Batch 100 -->
  <rect x="600" y="${320 - (batchSavings.batch100.gasPerDoc / 200000) * 240}" width="90" height="${Math.max(6, (batchSavings.batch100.gasPerDoc / 200000) * 240)}" fill="#1F7A4D" rx="3"/>
  <text x="645" y="345" fill="#D0D5DD" font-size="13" text-anchor="middle">Batch 100</text>
  <text x="645" y="${305 - (batchSavings.batch100.gasPerDoc / 200000) * 240}" fill="#F6F4EE" font-size="12" font-weight="600" text-anchor="middle">1,453 gas (-99.2%)</text>
</svg>
  `.trim();
  fs.writeFileSync(path.resolve(chartsDir, 'chart-batch-amortization.svg'), chartBatchSvg, 'utf8');

  // 3. Chart: End-to-End Presentation Workflow Timeline
  const wf = systemData.e2ePresentationWorkflow;
  const chartTimelineSvg = `
<svg width="800" height="380" viewBox="0 0 800 380" xmlns="http://www.w3.org/2000/svg" style="background:#15181D; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <rect width="800" height="380" fill="#15181D"/>
  <text x="40" y="45" fill="#F6F4EE" font-size="20" font-weight="600">End-to-End Presentation Lifecycle Latency (Mode B)</text>
  <text x="40" y="70" fill="#8C929D" font-size="13">Total Cycle: ${wf.totalE2ELatencyMs}ms from QR session initiation to signed HMAC receipt</text>

  <g transform="translate(60, 110)">
    <!-- Stage 1 -->
    <rect x="0" y="0" width="100" height="36" rx="4" fill="#2B313A"/>
    <text x="50" y="16" fill="#F6F4EE" font-size="11" font-weight="600" text-anchor="middle">1. Create Session</text>
    <text x="50" y="30" fill="#8C929D" font-size="10" text-anchor="middle">${wf.step1_sessionCreationMs} ms</text>
    <line x1="100" y1="18" x2="120" y2="18" stroke="#0E5A4E" stroke-width="2"/>

    <!-- Stage 2 -->
    <rect x="120" y="0" width="100" height="36" rx="4" fill="#2B313A"/>
    <text x="170" y="16" fill="#F6F4EE" font-size="11" font-weight="600" text-anchor="middle">2. Scan / Fetch</text>
    <text x="170" y="30" fill="#8C929D" font-size="10" text-anchor="middle">${wf.step2_sessionFetchMs} ms</text>
    <line x1="220" y1="18" x2="240" y2="18" stroke="#0E5A4E" stroke-width="2"/>

    <!-- Stage 3 -->
    <rect x="240" y="0" width="110" height="36" rx="4" fill="#2B313A"/>
    <text x="295" y="16" fill="#F6F4EE" font-size="11" font-weight="600" text-anchor="middle">3. SMT Witness</text>
    <text x="295" y="30" fill="#8C929D" font-size="10" text-anchor="middle">${wf.step3_witnessFetchMs} ms</text>
    <line x1="350" y1="18" x2="370" y2="18" stroke="#0E5A4E" stroke-width="2"/>

    <!-- Stage 4 -->
    <rect x="370" y="0" width="110" height="36" rx="4" fill="#0E5A4E"/>
    <text x="425" y="16" fill="#F6F4EE" font-size="11" font-weight="600" text-anchor="middle">4. Client Prove</text>
    <text x="425" y="30" fill="#D0D5DD" font-size="10" text-anchor="middle">${wf.step4_clientProvingMs} ms</text>
    <line x1="480" y1="18" x2="500" y2="18" stroke="#0E5A4E" stroke-width="2"/>

    <!-- Stage 5 -->
    <rect x="500" y="0" width="110" height="36" rx="4" fill="#1F7A4D"/>
    <text x="555" y="16" fill="#F6F4EE" font-size="11" font-weight="600" text-anchor="middle">5. Verify Proof</text>
    <text x="555" y="30" fill="#D0D5DD" font-size="10" text-anchor="middle">${wf.step5_presentationVerificationMs} ms</text>
    <line x1="610" y1="18" x2="630" y2="18" stroke="#1F7A4D" stroke-width="2"/>

    <!-- Stage 6 -->
    <rect x="630" y="0" width="70" height="36" rx="4" fill="#2B313A"/>
    <text x="665" y="16" fill="#F6F4EE" font-size="11" font-weight="600" text-anchor="middle">6. Receipt</text>
    <text x="665" y="30" fill="#8C929D" font-size="10" text-anchor="middle">${wf.step6_receiptGenerationMs} ms</text>
  </g>

  <!-- Proportion Bar -->
  <g transform="translate(60, 210)">
    <text x="0" y="-12" fill="#D0D5DD" font-size="12" font-weight="600">Relative Time Distribution</text>
    <rect x="0" y="0" width="${(wf.step1_sessionCreationMs / wf.totalE2ELatencyMs) * 680}" height="28" fill="#5B6068"/>
    <rect x="${(wf.step1_sessionCreationMs / wf.totalE2ELatencyMs) * 680}" y="0" width="${(wf.step2_sessionFetchMs / wf.totalE2ELatencyMs) * 680}" height="28" fill="#6E747F"/>
    <rect x="${((wf.step1_sessionCreationMs + wf.step2_sessionFetchMs) / wf.totalE2ELatencyMs) * 680}" y="0" width="${(wf.step3_witnessFetchMs / wf.totalE2ELatencyMs) * 680}" height="28" fill="#9A6A00"/>
    <rect x="${((wf.step1_sessionCreationMs + wf.step2_sessionFetchMs + wf.step3_witnessFetchMs) / wf.totalE2ELatencyMs) * 680}" y="0" width="${(wf.step4_clientProvingMs / wf.totalE2ELatencyMs) * 680}" height="28" fill="#0E5A4E"/>
    <rect x="${((wf.step1_sessionCreationMs + wf.step2_sessionFetchMs + wf.step3_witnessFetchMs + wf.step4_clientProvingMs) / wf.totalE2ELatencyMs) * 680}" y="0" width="${(wf.step5_presentationVerificationMs / wf.totalE2ELatencyMs) * 680}" height="28" fill="#1F7A4D"/>
    <rect x="${((wf.step1_sessionCreationMs + wf.step2_sessionFetchMs + wf.step3_witnessFetchMs + wf.step4_clientProvingMs + wf.step5_presentationVerificationMs) / wf.totalE2ELatencyMs) * 680}" y="0" width="${(wf.step6_receiptGenerationMs / wf.totalE2ELatencyMs) * 680}" height="28" fill="#3D444F"/>
  </g>

  <!-- Legend Labels -->
  <g transform="translate(60, 275)">
    <circle cx="6" cy="6" r="5" fill="#9A6A00"/>
    <text x="20" y="10" fill="#D0D5DD" font-size="11">SMT Witness Fetch (21.6%)</text>
    <circle cx="230" cy="6" r="5" fill="#0E5A4E"/>
    <text x="244" y="10" fill="#D0D5DD" font-size="11">Client Groth16 Proving (48.9%)</text>
    <circle cx="470" cy="6" r="5" fill="#1F7A4D"/>
    <text x="484" y="10" fill="#D0D5DD" font-size="11">Verifier Presentation Verification (28.3%)</text>
  </g>
</svg>
  `.trim();
  fs.writeFileSync(path.resolve(chartsDir, 'chart-e2e-timeline.svg'), chartTimelineSvg, 'utf8');

  // 4. Chart: SMT Scaling Latency (1k, 10k, 100k)
  const smtResults = smtData.scalingResults;
  const chartSmtSvg = `
<svg width="800" height="380" viewBox="0 0 800 380" xmlns="http://www.w3.org/2000/svg" style="background:#15181D; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <rect width="800" height="380" fill="#15181D"/>
  <text x="40" y="45" fill="#F6F4EE" font-size="20" font-weight="600">Sparse Merkle Tree: Exclusion Witness Latency vs Leaf Count</text>
  <text x="40" y="70" fill="#8C929D" font-size="13">Sub-millisecond logarithmic non-membership proof generation across scale</text>

  <!-- Grid -->
  <line x1="80" y1="300" x2="740" y2="300" stroke="#2B313A" stroke-width="1"/>
  <line x1="80" y1="230" x2="740" y2="230" stroke="#2B313A" stroke-width="1" stroke-dasharray="4"/>
  <line x1="80" y1="160" x2="740" y2="160" stroke="#2B313A" stroke-width="1" stroke-dasharray="4"/>
  <line x1="80" y1="90" x2="740" y2="90" stroke="#2B313A" stroke-width="1" stroke-dasharray="4"/>

  <!-- Y-Axis Labels -->
  <text x="65" y="305" fill="#8C929D" font-size="11" text-anchor="end">0.00 ms</text>
  <text x="65" y="235" fill="#8C929D" font-size="11" text-anchor="end">0.05 ms</text>
  <text x="65" y="165" fill="#8C929D" font-size="11" text-anchor="end">0.10 ms</text>
  <text x="65" y="95" fill="#8C929D" font-size="11" text-anchor="end">0.20 ms</text>

  <!-- Bars for Non-Membership Proof Latency -->
  <!-- 1k -->
  <rect x="150" y="${300 - (smtResults[0].averageNonMembershipProofMs / 0.2) * 210}" width="80" height="${(smtResults[0].averageNonMembershipProofMs / 0.2) * 210}" fill="#0E5A4E" rx="3"/>
  <text x="190" y="325" fill="#D0D5DD" font-size="13" text-anchor="middle">1,000 Leaves</text>
  <text x="190" y="${285 - (smtResults[0].averageNonMembershipProofMs / 0.2) * 210}" fill="#F6F4EE" font-size="12" font-weight="600" text-anchor="middle">${smtResults[0].averageNonMembershipProofMs} ms</text>

  <!-- 10k -->
  <rect x="360" y="${300 - (smtResults[1].averageNonMembershipProofMs / 0.2) * 210}" width="80" height="${(smtResults[1].averageNonMembershipProofMs / 0.2) * 210}" fill="#0E5A4E" rx="3"/>
  <text x="400" y="325" fill="#D0D5DD" font-size="13" text-anchor="middle">10,000 Leaves</text>
  <text x="400" y="${285 - (smtResults[1].averageNonMembershipProofMs / 0.2) * 210}" fill="#F6F4EE" font-size="12" font-weight="600" text-anchor="middle">${smtResults[1].averageNonMembershipProofMs} ms</text>

  <!-- 100k -->
  <rect x="570" y="${300 - (smtResults[2].averageNonMembershipProofMs / 0.2) * 210}" width="80" height="${(smtResults[2].averageNonMembershipProofMs / 0.2) * 210}" fill="#1F7A4D" rx="3"/>
  <text x="610" y="325" fill="#D0D5DD" font-size="13" text-anchor="middle">100,000 Leaves</text>
  <text x="610" y="${285 - (smtResults[2].averageNonMembershipProofMs / 0.2) * 210}" fill="#F6F4EE" font-size="12" font-weight="600" text-anchor="middle">${smtResults[2].averageNonMembershipProofMs} ms</text>
</svg>
  `.trim();
  fs.writeFileSync(path.resolve(chartsDir, 'chart-smt-scaling.svg'), chartSmtSvg, 'utf8');

  console.log(`[Chart Generator] Complete. 4 SVG charts written to ${chartsDir}`);
}

if (process.argv[1] && process.argv[1].includes('generate-charts')) {
  generateAllCharts();
}
