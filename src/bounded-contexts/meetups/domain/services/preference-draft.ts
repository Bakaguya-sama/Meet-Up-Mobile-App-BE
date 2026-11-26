import type { PreferenceLevel } from '../aggregates/meetup.aggregate';

export interface DraftPreference {
  activityTagId: number;
  level: PreferenceLevel;
}
export type Clarification =
  'none' | 'activity' | 'budget' | 'budget_scope' | 'unsupported';
export type BudgetAction = 'keep' | 'set' | 'clear' | 'clarify';
export interface PreferenceExtraction {
  preferences: Array<{
    activityTagId: number;
    operation: 'set' | 'remove';
    level: PreferenceLevel | null;
    evidence: string;
  }>;
  budget: { action: BudgetAction; amountVnd: number | null; evidence: string };
  clarification: Clarification;
  transcript: string | null;
}
export interface PreferenceDraftState {
  preferences: DraftPreference[];
  effectivePreferences: DraftPreference[];
  budgetVnd: number | null;
  budgetAction: 'keep' | 'set' | 'clear';
  pendingBudgetQuestion: 'none' | 'budget' | 'budget_scope';
  hasChanges: boolean;
  question: Clarification;
}
export class InvalidPreferenceExtraction extends Error {
  constructor() {
    super('Invalid preference extraction');
  }
}
const normalize = (text: string) =>
  text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

const FOREIGN_CURRENCY =
  /(?:[$€£¥฿₩]|(?:^|[^\p{L}])(?:usd|dollars?|eur|euros?|thb|baht|jpy|yen|cny|yuan|rmb|sgd|aud|gbp|cad|krw|won|inr|rupees?|myr|ringgit|php|peso|đô(?:\s+la)?|ngoại tệ)(?=$|[^\p{L}]))/iu;
const GROUP_BUDGET_SCOPE =
  /(?:cả\s+nhóm|tổng\s+(?:tiền\s+)?(?:nhóm|group)|(?:cho|của)\s+(?:cả\s+)?(?:nhóm|team|mọi\s+người)|chia\s+đều|cho\s+\d+\s+người|nhóm\s+\d+\s+người|budget\s+(?:for|of)\s+(?:the\s+)?group|\bgroup\b)/iu;
const PERSONAL_BUDGET_SCOPE =
  /(?:mỗi\s+(?:người|bạn|thành\s+viên)|đầu\s+người|\/\s*người|per\s+person|riêng\s+(?:tôi|mình|tui|em|anh|chị))/iu;

/** Accept one unambiguous VND amount; uncertain ranges/words need a follow-up. */
export function parseBudgetVnd(evidence: string): number | null {
  const text = normalize(evidence);
  if (
    FOREIGN_CURRENCY.test(text) ||
    (GROUP_BUDGET_SCOPE.test(text) && !PERSONAL_BUDGET_SCOPE.test(text)) ||
    /(?:^|\s)-\s*\d/.test(text)
  )
    return null;
  if (/nửa triệu/.test(text) && !/\d/.test(text)) return 500_000;
  const amounts: number[] = [];
  const pattern =
    /(\d+(?:[.,]\d+)*)(?:\s*(triệu|tr|nghìn|ngàn|k|vnd|đồng|đ))?(\d+)?/g;
  for (const match of text.matchAll(pattern)) {
    const [, numeric, unit, tail] = match;
    const thousands = /^\d{1,3}(?:[.,]\d{3})+$/.test(numeric);
    const value = Number(
      thousands ? numeric.replace(/[.,]/g, '') : numeric.replace(',', '.'),
    );
    // A small bare number is ambiguous in Vietnamese chat (e.g. 500 vs 500k).
    // Larger integers can safely be interpreted as VND; explicit units always win.
    if (!unit && value > 0 && value < 10_000) return null;
    const multiplier =
      unit === 'triệu' || unit === 'tr'
        ? 1_000_000
        : ['k', 'ngàn', 'nghìn'].includes(unit ?? '')
          ? 1_000
          : 1;
    if (tail && multiplier === 1) return null;
    amounts.push(
      value * multiplier + (tail ? Number(`0.${tail}`) * multiplier : 0),
    );
  }
  const amount = amounts[0];
  return amounts.length === 1 &&
    Number.isSafeInteger(amount) &&
    amount >= 0 &&
    amount <= 2_147_483_647
    ? amount
    : null;
}

/** Reject malformed provider JSON and unsupported tags, including nested fields. */
export function validatePreferenceExtraction(
  value: unknown,
  tagIds: Set<number>,
  message?: string,
): PreferenceExtraction {
  const fail = (): never => {
    throw new InvalidPreferenceExtraction();
  };
  const object = (v: unknown): Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : fail();
  const exact = (v: Record<string, unknown>, keys: string[]) => {
    if (Object.keys(v).length !== keys.length || keys.some((k) => !(k in v)))
      fail();
  };
  const data = object(value);
  exact(data, ['preferences', 'budget', 'clarification', 'transcript']);
  if (
    !Array.isArray(data.preferences) ||
    data.preferences.length > 30 ||
    typeof data.clarification !== 'string' ||
    !['none', 'activity', 'budget', 'budget_scope', 'unsupported'].includes(
      data.clarification,
    )
  )
    fail();
  if (
    data.transcript !== null &&
    (typeof data.transcript !== 'string' || data.transcript.length > 2000)
  )
    fail();
  if (message !== undefined && data.transcript !== null) fail();
  const source = normalize(
    message ?? (typeof data.transcript === 'string' ? data.transcript : ''),
  );
  if (!source) fail();
  const evidence = (v: unknown) =>
    typeof v === 'string' &&
    v.trim().length > 0 &&
    v.length <= 500 &&
    source.includes(normalize(v));
  const seen = new Set<number>();
  for (const raw of data.preferences as unknown[]) {
    const item = object(raw);
    exact(item, ['activityTagId', 'operation', 'level', 'evidence']);
    if (
      typeof item.activityTagId !== 'number' ||
      !tagIds.has(item.activityTagId) ||
      seen.has(item.activityTagId) ||
      !evidence(item.evidence)
    )
      fail();
    if (
      item.operation === 'set'
        ? typeof item.level !== 'string' ||
          !['high', 'normal', 'avoid'].includes(item.level)
        : item.operation !== 'remove' || item.level !== null
    )
      fail();
    seen.add(item.activityTagId as number);
  }
  const budget = object(data.budget);
  exact(budget, ['action', 'amountVnd', 'evidence']);
  if (
    typeof budget.action !== 'string' ||
    !['keep', 'set', 'clear', 'clarify'].includes(budget.action)
  )
    fail();
  if (budget.action === 'keep') {
    if (budget.evidence !== '' || budget.amountVnd !== null) fail();
  } else {
    if (!evidence(budget.evidence)) fail();
    if (budget.action === 'set') {
      if (
        typeof budget.amountVnd !== 'number' ||
        parseBudgetVnd(budget.evidence as string) !== budget.amountVnd
      )
        fail();
      if (
        GROUP_BUDGET_SCOPE.test(source) &&
        !PERSONAL_BUDGET_SCOPE.test(source)
      )
        fail();
    } else if (budget.amountVnd !== null) fail();
  }
  if (
    budget.action === 'clarify' &&
    !['budget', 'budget_scope'].includes(String(data.clarification))
  )
    fail();
  if (
    ['budget', 'budget_scope'].includes(String(data.clarification)) &&
    budget.action !== 'clarify'
  )
    fail();
  return data as unknown as PreferenceExtraction;
}

export function applyPreferenceExtraction(
  state: PreferenceDraftState,
  extraction: PreferenceExtraction,
): PreferenceDraftState {
  const next = structuredClone(state);
  if (extraction.preferences.length) {
    const tags = new Map(
      next.effectivePreferences.map((p) => [p.activityTagId, p]),
    );
    for (const change of extraction.preferences) {
      if (change.operation === 'remove') tags.delete(change.activityTagId);
      else
        tags.set(change.activityTagId, {
          activityTagId: change.activityTagId,
          level: change.level!,
        });
    }
    // [] triggers profile fallback in PUT. Never accidentally reintroduce removed profile tags.
    if (tags.size === 0) throw new InvalidPreferenceExtraction();
    next.preferences = [...tags.values()].sort(
      (a, b) => a.activityTagId - b.activityTagId,
    );
    next.effectivePreferences = next.preferences;
    next.hasChanges = true;
  }
  const budget = extraction.budget;
  if (budget.action === 'set' || budget.action === 'clear') {
    next.budgetVnd = budget.amountVnd;
    next.budgetAction = budget.action;
    next.pendingBudgetQuestion = 'none';
    next.hasChanges = true;
  } else if (budget.action === 'clarify') {
    next.pendingBudgetQuestion = extraction.clarification as
      'budget' | 'budget_scope';
  }
  next.question =
    extraction.clarification === 'unsupported'
      ? 'unsupported'
      : next.pendingBudgetQuestion !== 'none'
        ? next.pendingBudgetQuestion
        : extraction.clarification;
  if (next.question === 'none' && !next.hasChanges) next.question = 'activity';
  return next;
}

export const PREFERENCE_QUESTIONS: Record<Clarification, string> = {
  none: 'Bạn xem lại sở thích và ngân sách bên dưới, chỉnh sửa nếu cần rồi xác nhận nhé.',
  activity: 'Bạn muốn ăn uống, cà phê, xem phim hay một hoạt động khác?',
  budget:
    'Bạn muốn chi tối đa bao nhiêu VND cho riêng mình? Bạn cũng có thể bỏ qua ngân sách.',
  budget_scope:
    'Bạn cho biết mức chi tối đa của riêng mình bằng VND nhé, thay vì tổng tiền của nhóm.',
  unsupported:
    'Yêu cầu này chưa có trường tương ứng. Bạn có thể chọn các sở thích được hỗ trợ bên dưới.',
};
