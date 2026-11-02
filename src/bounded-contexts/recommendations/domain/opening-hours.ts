export interface NormalizedOpeningPoint {
  day: number;
  hour: number;
  minute: number;
  /** Local calendar date supplied by currentOpeningHours, formatted YYYY-MM-DD. */
  date?: string;
}

export interface NormalizedOpeningPeriod {
  open: NormalizedOpeningPoint;
  close?: NormalizedOpeningPoint;
}

export interface NormalizedOpeningHours {
  source: 'CURRENT' | 'REGULAR';
  periods: NormalizedOpeningPeriod[];
  /** Inclusive local-date coverage for CURRENT hours. */
  coverageStartDate?: string;
  coverageEndDate?: string;
}
