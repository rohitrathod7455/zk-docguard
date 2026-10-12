/**
 * Web Worker for in-browser Groth16 zk-SNARK witness calculation and proof generation
 * Keeps the main UI thread fluid at 60fps during intense polynomial arithmetic.
 */

// @ts-expect-error snarkjs lacks comprehensive browser worker typings
import * as snarkjs from 'snarkjs';

export interface WorkerProveRequest {
  type: 'PROVE';
  inputs: Record<string, unknown>;
  wasmPathOrUrl: string;
  zkeyPathOrUrl: string;
}

export interface WorkerProgressMessage {
  type: 'PROGRESS';
  step: 'loading_assets' | 'generating_witness' | 'proving_groth16' | 'complete';
  progress: number; // 0 - 100
  message: string;
}

export interface WorkerSuccessMessage {
  type: 'SUCCESS';
  proof: Record<string, unknown>;
  publicSignals: string[];
  durationMs: number;
}

export interface WorkerErrorMessage {
  type: 'ERROR';
  error: string;
}

self.onmessage = async (event: MessageEvent<WorkerProveRequest>) => {
  const { type, inputs, wasmPathOrUrl, zkeyPathOrUrl } = event.data;

  if (type !== 'PROVE') {
    return;
  }

  const startTime = performance.now();

  try {
    // 1. Notify starting asset loading
    self.postMessage({
      type: 'PROGRESS',
      step: 'loading_assets',
      progress: 20,
      message: 'Loading circuit WASM and proving parameters...',
    } satisfies WorkerProgressMessage);

    // 2. Notify starting witness generation
    self.postMessage({
      type: 'PROGRESS',
      step: 'generating_witness',
      progress: 45,
      message: 'Computing witness signals and Poseidon commitments...',
    } satisfies WorkerProgressMessage);

    // 3. Groth16 fullProve runs witness generation and Groth16 multi-scalar multiplication
    self.postMessage({
      type: 'PROGRESS',
      step: 'proving_groth16',
      progress: 70,
      message: 'Synthesizing Groth16 zero-knowledge proof...',
    } satisfies WorkerProgressMessage);

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputs,
      wasmPathOrUrl,
      zkeyPathOrUrl
    );

    const durationMs = Math.round(performance.now() - startTime);

    self.postMessage({
      type: 'PROGRESS',
      step: 'complete',
      progress: 100,
      message: 'Zero-knowledge proof synthesized successfully.',
    } satisfies WorkerProgressMessage);

    self.postMessage({
      type: 'SUCCESS',
      proof,
      publicSignals,
      durationMs,
    } satisfies WorkerSuccessMessage);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    self.postMessage({
      type: 'ERROR',
      error: errorMsg,
    } satisfies WorkerErrorMessage);
  }
};
