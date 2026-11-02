import type {
  NormalizedOpeningHours,
  NormalizedOpeningPeriod,
  NormalizedOpeningPoint,
} from '../ports/place-search.port';
import type { EligibleCandidate } from './candidate-filter';
import type {
  ScheduledOpeningEvidence,
  ScheduledOpeningStatus,
} from '../../domain/temporal-context';

export const SCHEDULED_OPENING_EVALUATOR_VERSION =
  'scheduled-opening-evaluator-v1';

export interface ScheduledOpeningEvaluation {
  status: ScheduledOpeningStatus;
  evidence: ScheduledOpeningEvidence;
  warnings: string[];
}

interface LocalDateTime {
  year: number;
  month: number;
  dayOfMonth: number;
  dayOfWeek: number;
  hour: number;
  minute: number;
}

export class ScheduledOpeningEvaluator {
  readonly version = SCHEDULED_OPENING_EVALUATOR_VERSION;

  evaluate(
    candidate: Pick<
      EligibleCandidate,
      | 'currentOpeningHours'
      | 'regularOpeningHours'
      | 'timeZoneId'
      | 'utcOffsetMinutes'
    >,
    scheduledAt: Date,
  ): ScheduledOpeningEvaluation {
    if (!Number.isFinite(scheduledAt.getTime())) {
      return this.unknown('INVALID_SCHEDULED_AT');
    }
    const local = toLocalDateTime(
      scheduledAt,
      candidate.timeZoneId,
      candidate.utcOffsetMinutes,
    );
    if (!local) return this.unknown('MISSING_OR_INVALID_TIMEZONE');

    const localDate = formatDate(local);
    const current = candidate.currentOpeningHours;
    const currentCoverage = current ? coverage(current) : null;
    if (current && !currentCoverage) {
      return this.unknown(
        'MISSING_OR_INVALID_CURRENT_HOURS_COVERAGE',
        local,
        candidate,
      );
    }
    if (
      current &&
      currentCoverage &&
      localDate >= currentCoverage.start &&
      localDate <= currentCoverage.end
    ) {
      return this.evaluateHours(current, local, candidate, false, 'CURRENT');
    }

    const regular = candidate.regularOpeningHours;
    if (!regular) {
      return this.unknown('MISSING_OPENING_HOURS', local, candidate);
    }
    return this.evaluateHours(regular, local, candidate, true, 'REGULAR');
  }

  private evaluateHours(
    hours: NormalizedOpeningHours,
    local: LocalDateTime,
    candidate: { timeZoneId?: string; utcOffsetMinutes?: number },
    fallbackToRegularHours: boolean,
    source: 'CURRENT' | 'REGULAR',
  ): ScheduledOpeningEvaluation {
    if (!Array.isArray(hours.periods) || hours.periods.length === 0) {
      return this.unknown(
        'MISSING_OR_INVALID_OPENING_PERIODS',
        local,
        candidate,
      );
    }
    if (!hours.periods.every((period) => validPeriod(period, source))) {
      return this.unknown(
        'MISSING_OR_INVALID_OPENING_PERIODS',
        local,
        candidate,
      );
    }
    const matched = hours.periods.find((period) =>
      source === 'CURRENT'
        ? matchesCurrent(period, local)
        : matchesRegular(period, local),
    );
    const evidence: ScheduledOpeningEvidence = {
      evaluatorVersion: this.version,
      source,
      evaluatedLocalDateTime: formatLocalDateTime(local),
      ...(candidate.timeZoneId ? { timeZoneId: candidate.timeZoneId } : {}),
      ...(Number.isInteger(candidate.utcOffsetMinutes)
        ? { utcOffsetMinutes: candidate.utcOffsetMinutes }
        : {}),
      ...(matched ? { matchedPeriod: clonePeriod(matched) } : {}),
      fallbackToRegularHours,
    };
    return {
      status: matched ? 'OPEN' : 'CLOSED',
      evidence,
      warnings: fallbackToRegularHours ? ['OPENING_FROM_REGULAR_HOURS'] : [],
    };
  }

  private unknown(
    reason: string,
    local?: LocalDateTime,
    candidate?: { timeZoneId?: string; utcOffsetMinutes?: number },
  ): ScheduledOpeningEvaluation {
    return {
      status: 'UNKNOWN',
      evidence: {
        evaluatorVersion: this.version,
        source: 'NONE',
        ...(local
          ? { evaluatedLocalDateTime: formatLocalDateTime(local) }
          : {}),
        ...(candidate?.timeZoneId ? { timeZoneId: candidate.timeZoneId } : {}),
        ...(Number.isInteger(candidate?.utcOffsetMinutes)
          ? { utcOffsetMinutes: candidate!.utcOffsetMinutes }
          : {}),
        fallbackToRegularHours: false,
        reason,
      },
      warnings: ['OPENING_STATUS_UNKNOWN'],
    };
  }
}

function toLocalDateTime(
  value: Date,
  timeZoneId?: string,
  utcOffsetMinutes?: number,
): LocalDateTime | null {
  if (timeZoneId) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZoneId,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        weekday: 'short',
      }).formatToParts(value);
      const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
      );
      const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
        values.weekday,
      );
      const result = {
        year: Number(values.year),
        month: Number(values.month),
        dayOfMonth: Number(values.day),
        dayOfWeek: weekday,
        hour: Number(values.hour),
        minute: Number(values.minute),
      };
      return validLocal(result) ? result : null;
    } catch {
      return null;
    }
  }
  if (
    !Number.isInteger(utcOffsetMinutes) ||
    utcOffsetMinutes! < -14 * 60 ||
    utcOffsetMinutes! > 14 * 60
  ) {
    return null;
  }
  const shifted = new Date(value.getTime() + utcOffsetMinutes! * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    dayOfMonth: shifted.getUTCDate(),
    dayOfWeek: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function validLocal(value: LocalDateTime) {
  return (
    Number.isInteger(value.year) &&
    value.month >= 1 &&
    value.month <= 12 &&
    value.dayOfMonth >= 1 &&
    value.dayOfMonth <= 31 &&
    value.dayOfWeek >= 0 &&
    value.dayOfWeek <= 6 &&
    value.hour >= 0 &&
    value.hour <= 23 &&
    value.minute >= 0 &&
    value.minute <= 59
  );
}

function coverage(hours: NormalizedOpeningHours) {
  if (validDate(hours.coverageStartDate) && validDate(hours.coverageEndDate)) {
    return {
      start: hours.coverageStartDate,
      end: hours.coverageEndDate,
    };
  }
  const dates = hours.periods
    .flatMap((period) => [period.open.date, period.close?.date])
    .filter((date): date is string => validDate(date));
  if (!dates.length) return null;
  dates.sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

function validPeriod(
  period: NormalizedOpeningPeriod,
  source: 'CURRENT' | 'REGULAR',
) {
  return (
    validPoint(period.open, source) &&
    (!period.close || validPoint(period.close, source))
  );
}

function validPoint(
  point: NormalizedOpeningPoint,
  source: 'CURRENT' | 'REGULAR',
) {
  return (
    Number.isInteger(point.day) &&
    point.day >= 0 &&
    point.day <= 6 &&
    Number.isInteger(point.hour) &&
    point.hour >= 0 &&
    point.hour <= 23 &&
    Number.isInteger(point.minute) &&
    point.minute >= 0 &&
    point.minute <= 59 &&
    (source === 'REGULAR' || validDate(point.date))
  );
}

function matchesCurrent(period: NormalizedOpeningPeriod, local: LocalDateTime) {
  const current = localValue(local);
  const start = pointValue(period.open);
  if (!period.close) return current >= start;
  return current >= start && current < pointValue(period.close);
}

function matchesRegular(period: NormalizedOpeningPeriod, local: LocalDateTime) {
  const weekMinutes = 7 * 24 * 60;
  const current = local.dayOfWeek * 24 * 60 + local.hour * 60 + local.minute;
  const start = regularPointValue(period.open);
  if (!period.close) return true;
  let end = regularPointValue(period.close);
  if (end <= start) end += weekMinutes;
  return (
    (current >= start && current < end) ||
    (current + weekMinutes >= start && current + weekMinutes < end)
  );
}

function localValue(local: LocalDateTime) {
  return Date.UTC(
    local.year,
    local.month - 1,
    local.dayOfMonth,
    local.hour,
    local.minute,
  );
}

function pointValue(point: NormalizedOpeningPoint) {
  const [year, month, day] = point.date!.split('-').map(Number);
  return Date.UTC(year, month - 1, day, point.hour, point.minute);
}

function regularPointValue(point: NormalizedOpeningPoint) {
  return point.day * 24 * 60 + point.hour * 60 + point.minute;
}

function validDate(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function formatDate(value: LocalDateTime) {
  return `${value.year.toString().padStart(4, '0')}-${value.month
    .toString()
    .padStart(2, '0')}-${value.dayOfMonth.toString().padStart(2, '0')}`;
}

function formatLocalDateTime(value: LocalDateTime) {
  return `${formatDate(value)}T${value.hour
    .toString()
    .padStart(2, '0')}:${value.minute.toString().padStart(2, '0')}`;
}

function clonePeriod(period: NormalizedOpeningPeriod): NormalizedOpeningPeriod {
  return {
    open: { ...period.open },
    ...(period.close ? { close: { ...period.close } } : {}),
  };
}
