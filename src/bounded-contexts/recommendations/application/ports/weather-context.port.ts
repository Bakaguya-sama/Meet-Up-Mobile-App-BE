export const WEATHER_CONTEXT = Symbol('WEATHER_CONTEXT');

export type WeatherAvailability = 'AVAILABLE' | 'UNAVAILABLE' | 'OUT_OF_RANGE';
export type PlaceExposure = 'INDOOR' | 'OUTDOOR' | 'UNKNOWN';

export interface WeatherForecastRequest {
  latitude: number;
  longitude: number;
  scheduledAt: Date;
}

export interface WeatherForecast {
  availability: WeatherAvailability;
  /** Normalized severity in [0, 1]; only meaningful for AVAILABLE evidence. */
  severity?: number;
  provider: string;
  observedAt?: string;
}

export interface WeatherContextPort {
  forecast(input: WeatherForecastRequest): Promise<WeatherForecast>;
}
