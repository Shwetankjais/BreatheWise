/**
 * BreatheWise API Types
 * Strictly aligned with contract 1.2.0 in packages/contracts/api.d.ts
 */

import type { components, paths } from '../../../../../packages/contracts/api';

export type Schemas = components['schemas'];

// Contract Core Entities
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

// Contract 1.2.0 Additive Entities — Station Catalogue & Observed Rankings
export type StationCatalogue = Schemas['StationCatalogue'];
export type CatalogueStation = Schemas['CatalogueStation'];
export type PollutantAvailability = Schemas['PollutantAvailability'];
export type ObservedRankings = Schemas['ObservedRankings'];
export type ObservedRank = Schemas['ObservedRank'];

// Contract 1.2.0 Additive Entities — Audited Recorded-Clock Archive
export type ArchiveCatalogue = Schemas['ArchiveCatalogue'];
export type ArchiveStation = Schemas['ArchiveStation'];
export type ArchivePollutantCoverage = Schemas['ArchivePollutantCoverage'];
export type ArchiveExplore = Schemas['ArchiveExplore'];
export type ArchiveBucket = Schemas['ArchiveBucket'];
export type ArchiveDistribution = Schemas['ArchiveDistribution'];
export type ArchiveCompare = Schemas['ArchiveCompare'];
export type ArchiveComparisonBucket = Schemas['ArchiveComparisonBucket'];
export type ArchivePairAgreement = Schemas['ArchivePairAgreement'];

// Contract 1.2.0 & 1.3.0 Additive Entities — Model Registry & Evaluation
export type ModelCatalogue = Schemas['ModelCatalogue'];
export type ModelSummary = Schemas['ModelSummary'];
export type ModelEvaluation = Schemas['ModelEvaluation'];
export type HorizonEvaluation = Schemas['HorizonEvaluation'];
export type EvaluationGroup = Schemas['EvaluationGroup'];
export type ErrorMetrics = Schemas['ErrorMetrics'];
export type RecordedSplit = Schemas['RecordedSplit'];
export type PredictionPage = Schemas['PredictionPage'];
export type HeldoutPrediction = Schemas['HeldoutPrediction'];

// Contract 1.3.0 Additive Entities — UTC Models & Issue-Time Purged Cohorts
export type UtcModelEvaluation = Schemas['UtcModelEvaluation'];
export type UtcPredictionPage = Schemas['UtcPredictionPage'];
export type UtcHeldoutPrediction = Schemas['UtcHeldoutPrediction'];
export type UtcSplit = Schemas['UtcSplit'];
export type IssuePurgeSummary = Schemas['IssuePurgeSummary'];
export type BoundaryRowCounts = Schemas['BoundaryRowCounts'];

// Contract 1.2.0 Additive Entities — Route Geometry
export type GeometryRequest = Schemas['GeometryRequest'];
export type GeometryResponse = Schemas['GeometryResponse'];
export type RouteGeometry = Schemas['RouteGeometry'];
export type LineString = Schemas['LineString'];
export type Coordinates = Schemas['Coordinates'];

// Contract 1.3.0 Additive Entities — Shadow Forecast Runs
export type ForecastRunPage = Schemas['ForecastRunPage'];
export type ForecastRunView = Schemas['ForecastRunView'];
export type ForecastRunDetail = Schemas['ForecastRunDetail'];
export type ShadowPoint = Schemas['ShadowPoint'];

export type DataMode = 'live' | 'historical_replay' | 'demo';

// Environmental and Location Context
export type LocationContext = Schemas['LocationContext'];
export type PollutantReading = Schemas['PollutantReading'];
export type WeatherContext = Schemas['WeatherContext'];

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
