import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { OfflineDatasetManifest, OfflineDatasetRow } from '../../application/offline/offline-evaluation.types';

/** Writes only caller-selected paths; it never chooses a default export destination. */
export async function writeOfflineEvaluationArtifacts(input: {
  output: string;
  rows: OfflineDatasetRow[];
  manifest: OfflineDatasetManifest;
  report: unknown;
}): Promise<{ datasetPath: string; manifestPath: string; reportPath: string }> {
  const manifestPath = `${input.output}.manifest.json`;
  const reportPath = `${input.output}.report.json`;
  await mkdir(dirname(input.output), { recursive: true });
  await writeFile(
    input.output,
    `${input.rows.map((row) => JSON.stringify(row)).join('\n')}${input.rows.length ? '\n' : ''}`,
    'utf8',
  );
  await writeFile(manifestPath, `${JSON.stringify(input.manifest, null, 2)}\n`, 'utf8');
  await writeFile(reportPath, `${JSON.stringify(input.report, null, 2)}\n`, 'utf8');
  return { datasetPath: input.output, manifestPath, reportPath };
}
