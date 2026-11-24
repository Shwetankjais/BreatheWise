/**
 * BreatheWise API Types
 * Strictly aligned with contract 1.1.0 in packages/contracts/api.d.ts
 */

import type { components, paths } from '../../../../../packages/contracts/api';

export type Schemas = components['schemas'];

// Contract 1.1.0 Core Entities
export type City = Schemas['City'];
export type StationView = Schemas['StationView'];
export type Measurement = Schemas['Measurement'];
export type Forecast = Schemas['Forecast'];
export type ForecastPoint = Schemas['ForecastPoint'];
export type Capabilities = Schemas['Capabilities'];
export type Capability = Schemas['Capability'];
export type History = Schemas['History'];
export type HistoryPoint = Schemas['HistoryPoint'];
export type PlaceView = Schemas['PlaceView'];
export type PlaceInput = Schemas['PlaceInput'];
export type RuleView = Schemas['RuleView'];
export type RuleInput = Schemas['RuleInput'];
export type NotificationView = Schemas['NotificationView'];
export type Identity = Schemas['Identity'];
export type Preferences = Schemas['Preferences'];
export type Metadata = Schemas['Metadata'];
export type ErrorDetail = Schemas['ErrorDetail'];
export type ErrorResponse = Schemas['ErrorResponse'];
export type Pollutant = Schemas['Pollutant'];
export type Advisory = Schemas['Advisory'];
export type Readiness = Schemas['Readiness'];
export type Health = Schemas['Health'];
export type ActivityRequest = Schemas['ActivityRequest'];
export type RouteRequest = Schemas['RouteRequest'];
export type WeatherRequest = Schemas['WeatherRequest'];

export type DataMode = 'live' | 'historical_replay' | 'demo';

// Official CPCB Breakpoint Categories
export type AQICategory =
  | 'Good'
  | 'Satisfactory'
  | 'Moderate'
  | 'Poor'
  | 'Very Poor'
  | 'Severe';

/**
 * Result envelope returned by client methods
 * Preserves backend response metadata and structured error details without silent swallowing
 */
export type ApiResult<T> =
  | { ok: true; data: T; meta: Metadata; status: number }
  | { ok: false; error: ErrorDetail; meta?: Metadata; status: number };
