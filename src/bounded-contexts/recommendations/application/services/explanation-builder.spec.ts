import { ExplanationBuilder } from './explanation-builder';

describe('ExplanationBuilder', () => {
  const metrics = {
    rank: 2,
    groupUtility: 0.73,
    candidateLeastMiseryUtility: 0.61,
    paretoLevel: 1,
    inclusionProbability: 0.84,
    avgEtaSeconds: 720,
    maxEtaSeconds: 900,
    scheduledOpeningStatus: 'OPEN' as const,
  };

  it.each([
    ['min-sum', 'MIN_SUM_RANKED'],
    ['min-max', 'MIN_MAX_RANKED'],
    ['fair-pareto-v1', 'FAIR_PARETO_RANKED'],
  ] as const)('maps %s to the deterministic summary code', (strategy, code) => {
    expect(
      new ExplanationBuilder().build(strategy, metrics, 3, []),
    ).toMatchObject({ summaryCode: code });
  });

  it('uses exact snapshot values with explicit unit and source', () => {
    expect(
      new ExplanationBuilder().build('fair-pareto-v1', metrics, 3, [
        'OPENING_STATUS_UNKNOWN',
        'OPENING_STATUS_UNKNOWN',
      ]),
    ).toEqual({
      summaryCode: 'FAIR_PARETO_RANKED',
      facts: [
        { key: 'rank', value: 2, unit: 'COUNT', source: 'ENGINE' },
        { key: 'effectiveK', value: 3, unit: 'COUNT', source: 'ENGINE' },
        {
          key: 'avgEtaSeconds',
          value: 720,
          unit: 'SECOND',
          source: 'ROUTES',
        },
        {
          key: 'maxEtaSeconds',
          value: 900,
          unit: 'SECOND',
          source: 'ROUTES',
        },
        {
          key: 'candidateLeastMiseryUtility',
          value: 0.61,
          unit: 'UTILITY_0_1',
          source: 'ENGINE',
        },
        {
          key: 'groupUtility',
          value: 0.73,
          unit: 'UTILITY_0_1',
          source: 'ENGINE',
        },
        { key: 'scheduledOpeningStatus', value: 'OPEN', source: 'PLACES' },
        { key: 'paretoLevel', value: 1, unit: 'COUNT', source: 'ENGINE' },
        {
          key: 'inclusionProbability',
          value: 0.84,
          unit: 'PROBABILITY_0_1',
          source: 'ENGINE',
        },
      ],
      warnings: ['OPENING_STATUS_UNKNOWN'],
    });
  });

  it('does not emit unsupported superlative claims', () => {
    const serialized = JSON.stringify(
      new ExplanationBuilder().build('fair-pareto-v1', metrics, 3, []),
    ).toLocaleLowerCase('vi');
    expect(serialized).not.toMatch(/gần nhất|công bằng nhất|mọi người thích/);
  });
});
