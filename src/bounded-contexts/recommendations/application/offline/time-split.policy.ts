import type { EvaluationTimeSplit } from './offline-evaluation.types';

export function validateTimeSplit(split: EvaluationTimeSplit): void {
  const windows = [split.train, split.validation, split.test];
  if (windows.some(({ from, to }) => !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to)) {
    throw new Error('Each time split window must have a valid from < to range');
  }
  if (split.train.to > split.validation.from || split.validation.to > split.test.from) {
    throw new Error('Time split windows must be ordered and non-overlapping');
  }
}

export function splitName(timestamp: Date, split: EvaluationTimeSplit): 'train' | 'validation' | 'test' | null {
  validateTimeSplit(split);
  return inWindow(timestamp, split.train) ? 'train' : inWindow(timestamp, split.validation) ? 'validation' : inWindow(timestamp, split.test) ? 'test' : null;
}

function inWindow(value: Date, window: { from: Date; to: Date }) {
  return value >= window.from && value < window.to;
}
