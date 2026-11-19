import 'dotenv/config';
import { resolve } from 'node:path';
import dataSource from '../infrastructure/database/typeorm/data-source';
import { recommendationConfigForEnvironment } from '../bounded-contexts/recommendations/application/recommendation-config';
import { OfflineDatasetBuilderService } from '../bounded-contexts/recommendations/application/offline/offline-dataset-builder.service';
import { createOfflineEvaluator } from '../bounded-contexts/recommendations/application/offline/offline-evaluator.service';
import { validateTimeSplit } from '../bounded-contexts/recommendations/application/offline/time-split.policy';
import { TypeOrmOfflineEvaluationSource } from '../bounded-contexts/recommendations/infrastructure/persistence/typeorm/typeorm-offline-evaluation-source';
import { writeOfflineEvaluationArtifacts } from '../bounded-contexts/recommendations/infrastructure/offline/offline-evaluation-artifact-writer';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const from = dateArg(args, 'from');
  const to = dateArg(args, 'to');
  const split = {
    train: { from: dateArg(args, 'train-from'), to: dateArg(args, 'train-to') },
    validation: {
      from: dateArg(args, 'validation-from'),
      to: dateArg(args, 'validation-to'),
    },
    test: { from: dateArg(args, 'test-from'), to: dateArg(args, 'test-to') },
  };
  validateTimeSplit(split);
  if (from > split.train.from || to < split.test.to)
    throw new Error('Dataset --from/--to must cover every time-split window');
  const output = args.output
    ? resolve(args.output)
    : fail(
        '--output is required; the command never chooses a production destination',
      );
  const salt = process.env.OFFLINE_DATASET_PSEUDONYMIZATION_SALT;
  if (!salt)
    throw new Error('OFFLINE_DATASET_PSEUDONYMIZATION_SALT is required');
  await dataSource.initialize();
  try {
    const source = new TypeOrmOfflineEvaluationSource(dataSource);
    const filters = {
      from,
      to,
      algorithmVersion: args['algorithm-version'],
      configVersion: args['config-version'],
    };
    const builder = new OfflineDatasetBuilderService(source, salt);
    const dataset = await builder.build({
      ...filters,
      generatorCommitSha: process.env.GIT_COMMIT_SHA ?? null,
    });
    const evaluator = createOfflineEvaluator(
      source,
      recommendationConfigForEnvironment(process.env.NODE_ENV),
    );
    const report = {
      manifest: dataset.manifest,
      timeSplit: Object.fromEntries(
        Object.entries(split).map(([name, value]) => [
          name,
          { from: value.from.toISOString(), to: value.to.toISOString() },
        ]),
      ),
      strategies: await evaluator.evaluate({
        ...filters,
        k: Number(args.k ?? 5),
      }),
      dataQuality: {
        ...dataset.dataQuality,
        rowsWithUnknownLabel: 0,
        warnings: [
          ...dataset.dataQuality.warningCodes,
          ...(dataset.rows.length
            ? []
            : ['NO_EVALUABLE_IMPRESSIONS_IN_WINDOW']),
        ],
      },
    };
    await writeOfflineEvaluationArtifacts({
      output,
      rows: dataset.rows,
      manifest: dataset.manifest,
      report,
    });
    process.stdout.write(
      `Wrote ${dataset.rows.length} redacted rows to ${output}\n`,
    );
  } finally {
    await dataSource.destroy();
  }
}

function parseArgs(values: string[]) {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--'))
      throw new Error(`Expected --key value, got ${key ?? ''}`);
    parsed[key.slice(2)] = value;
  }
  return parsed;
}
function dateArg(args: Record<string, string>, key: string) {
  const value = args[key] ? new Date(args[key]) : fail(`--${key} is required`);
  if (!Number.isFinite(value.getTime()))
    throw new Error(`--${key} must be an ISO-8601 timestamp`);
  return value;
}
function fail(message: string): never {
  throw new Error(message);
}
void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
