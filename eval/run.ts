import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads packet-NNN.pdf / packet-NNN.truth.json pairs from scripts/out/, runs
 * them through the pipeline (via the Batch API so a full run is cheap), and
 * reports the metrics from the design doc's eval section:
 *
 *   - Split accuracy
 *   - Classification accuracy
 *   - Field accuracy
 *   - Straight-through rate
 *   - Auto-accept error rate (the headline number)
 *   - Planted-error catch rate
 *
 * Then sweeps the auto-accept threshold from 0.5 to 0.99, once using the
 * model's raw confidence and once using the combined (checks-adjusted)
 * score, and writes the comparison into eval/report.md.
 *
 * TODO: everything below the packet loading is unimplemented — needs the
 * pipeline stages wired to a live DB plus the Anthropic Batch API.
 */

const PACKETS_DIR = join(import.meta.dirname, "../scripts/out");

interface PacketTruth {
  packetId: string;
  documents: Array<{ docType: string; pageStart: number; pageEnd: number }>;
}

function loadTruths(): PacketTruth[] {
  return readdirSync(PACKETS_DIR)
    .filter((f) => f.endsWith(".truth.json"))
    .map((f) => JSON.parse(readFileSync(join(PACKETS_DIR, f), "utf8")) as PacketTruth);
}

async function main() {
  const truths = loadTruths();
  console.log(`loaded ${truths.length} packet truths from ${PACKETS_DIR}`);

  // TODO: submit each packet through split/classify/extract/score/route,
  // compare against truths, compute the metrics table above.

  const reportPath = join(import.meta.dirname, "report.md");
  writeFileSync(
    reportPath,
    `# sift eval report\n\nRan against ${truths.length} packets. Metrics not yet computed — see eval/run.ts TODOs.\n`,
  );
  console.log(`wrote ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
