import {
  applyPreferenceExtraction,
  parseBudgetVnd,
  validatePreferenceExtraction,
  type PreferenceDraftState,
  type PreferenceExtraction,
} from './preference-draft';

const state: PreferenceDraftState = {
  preferences: [{ activityTagId: 1, level: 'high' }],
  effectivePreferences: [{ activityTagId: 1, level: 'high' }],
  budgetVnd: 250000,
  budgetAction: 'keep',
  pendingBudgetQuestion: 'none',
  hasChanges: false,
  question: 'activity',
};
const extraction = (): PreferenceExtraction => ({
  preferences: [
    { activityTagId: 2, operation: 'set', level: 'normal', evidence: 'cà phê' },
  ],
  budget: { action: 'keep', amountVnd: null, evidence: '' },
  clarification: 'none',
  transcript: null,
});
describe('Preference draft rules', () => {
  it.each([
    ['500k', 500000],
    ['1tr5', 1500000],
    ['1,5 triệu', 1500000],
    ['nửa triệu', 500000],
    ['250.000 VND', 250000],
    ['0 đồng', 0],
  ])('normalizes %s without inventing a cap', (text, expected) => {
    expect(parseBudgetVnd(text)).toBe(expected);
  });
  it.each([
    '100-200k',
    'rẻ',
    '50 usd',
    '200k cả nhóm',
    '-100k',
    '500',
    '50 EUR',
    '200k group',
  ])(
    'rejects ambiguous or invalid money %s',
    (text) => {
      expect(parseBudgetVnd(text)).toBeNull();
    },
  );
  it('merges a new activity and preserves unrelated preferences and budget', () => {
    const next = applyPreferenceExtraction(state, extraction());
    expect(next.preferences).toEqual([
      { activityTagId: 1, level: 'high' },
      { activityTagId: 2, level: 'normal' },
    ]);
    expect(next.budgetVnd).toBe(250000);
    expect(next.budgetAction).toBe('keep');
    expect(state.preferences).toHaveLength(1);
  });
  it('leaves the profile fallback source intact for a budget-only update', () => {
    const input = extraction();
    input.preferences = [];
    input.budget = { action: 'set', amountVnd: 0, evidence: '0 đồng' };
    const next = applyPreferenceExtraction(
      { ...state, preferences: [] },
      input,
    );
    expect(next.preferences).toEqual([]);
    expect(next.effectivePreferences).toEqual(state.effectivePreferences);
    expect(next.budgetVnd).toBe(0);
  });
  it('does not accidentally restore profile tags when removing the last tag', () => {
    const input = extraction();
    input.preferences = [
      { activityTagId: 1, operation: 'remove', level: null, evidence: 'bỏ' },
    ];
    expect(() => applyPreferenceExtraction(state, input)).toThrow();
  });
  it('keeps unresolved budget questions across unrelated turns', () => {
    expect(
      applyPreferenceExtraction(
        { ...state, pendingBudgetQuestion: 'budget_scope' },
        extraction(),
      ).question,
    ).toBe('budget_scope');
  });
  it('does not turn an empty extraction into a confirmable proposal', () => {
    const input = extraction();
    input.preferences = [];
    expect(applyPreferenceExtraction(state, input).question).toBe('activity');
  });
  it('accepts explicit evidence but rejects tag hallucinations, duplicates and invalid nested values', () => {
    expect(
      validatePreferenceExtraction(
        extraction(),
        new Set([1, 2]),
        'Muốn cà phê',
      ),
    ).toEqual(extraction());
    for (const mutate of [
      (v: PreferenceExtraction) => {
        v.preferences[0].activityTagId = 99;
      },
      (v: PreferenceExtraction) => {
        v.preferences.push(v.preferences[0]);
      },
      (v: PreferenceExtraction) => {
        v.preferences[0].evidence = 'bar';
      },
    ]) {
      const input = extraction();
      mutate(input);
      expect(() =>
        validatePreferenceExtraction(input, new Set([1, 2]), 'Muốn cà phê'),
      ).toThrow();
    }
    expect(() =>
      validatePreferenceExtraction(
        { ...extraction(), extra: true },
        new Set([1, 2]),
        'cà phê',
      ),
    ).toThrow();
    expect(() =>
      validatePreferenceExtraction(
        { ...extraction(), preferences: [null] },
        new Set([1, 2]),
        'cà phê',
      ),
    ).toThrow();
  });
  it('rejects invented or group budget and mismatched clarification flags', () => {
    const input = extraction();
    input.preferences = [];
    input.budget = { action: 'set', amountVnd: 500000, evidence: 'rẻ' };
    expect(() =>
      validatePreferenceExtraction(input, new Set(), 'rẻ'),
    ).toThrow();
    input.budget.evidence = '500k';
    expect(() =>
      validatePreferenceExtraction(input, new Set(), '500k cả nhóm'),
    ).toThrow();
    input.budget = { action: 'clarify', amountVnd: null, evidence: 'rẻ' };
    expect(() =>
      validatePreferenceExtraction(input, new Set(), 'rẻ'),
    ).toThrow();
  });
});
