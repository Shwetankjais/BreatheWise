/**
 * BreatheWise Demo Test Fixtures (Isolated Preview Mode)
 * Explicitly labeled synthetic dataset for UI verification when live backend is offline.
 * NOTE: This fixture does not represent live observations or verified model inference.
 */

import {
  City,
  StationView,
  Measurement,
  PlaceView,
  RuleView,
  NotificationView,
  Identity,
  Capabilities,
  Advisory,
  StationCatalogue,
  ObservedRankings,
  ArchiveCatalogue,
  ArchiveExplore,
  ArchiveCompare,
  ModelCatalogue,
  ModelEvaluation,
  PredictionPage,
  GeometryResponse,
  LocationContext,
  PollutantReading
} from './types';

export const DEMO_CITIES: City[] = [
  { id: 'delhi', name: 'Delhi NCR', aliases: ['New Delhi', 'DL'], availability: 'synthetic_demo', eligible_station_count: 40, observed_station_count: 7 },
  { id: 'mumbai', name: 'Mumbai Metro', aliases: ['Bombay', 'MH'], availability: 'synthetic_demo', eligible_station_count: 24, observed_station_count: 3 },
  { id: 'bengaluru', name: 'Bengaluru', aliases: ['Bangalore', 'KA'], availability: 'synthetic_demo', eligible_station_count: 12, observed_station_count: 2 },
  { id: 'hyderabad', name: 'Hyderabad', aliases: ['TS'], availability: 'synthetic_demo', eligible_station_count: 14, observed_station_count: 0 },
  { id: 'kolkata', name: 'Kolkata', aliases: ['Calcutta', 'WB'], availability: 'synthetic_demo', eligible_station_count: 10, observed_station_count: 0 },
  { id: 'pune', name: 'Pune', aliases: ['Poona', 'MH'], availability: 'synthetic_demo', eligible_station_count: 8, observed_station_count: 0 },
  { id: 'chennai', name: 'Chennai', aliases: ['Madras', 'TN'], availability: 'synthetic_demo', eligible_station_count: 9, observed_station_count: 0 },
  { id: 'ahmedabad', name: 'Ahmedabad', aliases: ['GJ'], availability: 'synthetic_demo', eligible_station_count: 9, observed_station_count: 0 },
  { id: 'lucknow', name: 'Lucknow', aliases: ['UP'], availability: 'synthetic_demo', eligible_station_count: 6, observed_station_count: 0 },
  { id: 'ghaziabad', name: 'Ghaziabad', aliases: ['UP'], availability: 'synthetic_demo', eligible_station_count: 5, observed_station_count: 0 },
  { id: 'agra', name: 'Agra', aliases: ['UP'], availability: 'synthetic_demo', eligible_station_count: 6, observed_station_count: 0 },
  { id: 'moradabad', name: 'Moradabad', aliases: ['UP'], availability: 'synthetic_demo', eligible_station_count: 3, observed_station_count: 0 },
  { id: 'jaipur', name: 'Jaipur', aliases: ['RJ'], availability: 'synthetic_demo', eligible_station_count: 7, observed_station_count: 0 },
  { id: 'indore', name: 'Indore', aliases: ['MP'], availability: 'synthetic_demo', eligible_station_count: 4, observed_station_count: 0 },
  { id: 'guwahati', name: 'Guwahati', aliases: ['AS'], availability: 'synthetic_demo', eligible_station_count: 3, observed_station_count: 0 },
  { id: 'srinagar', name: 'Srinagar', aliases: ['JK'], availability: 'synthetic_demo', eligible_station_count: 2, observed_station_count: 0 }
];

export const DEMO_STATIONS: StationView[] = [
  { id: 'delhi-anand-vihar', city_id: 'delhi', name: 'Anand Vihar, Delhi - DPCC', latitude: 28.6476, longitude: 77.3160, source: 'Synthetic Demo', forecast_eligible: false, data_mode: 'demo' },
  { id: 'delhi-punjabi-bagh', city_id: 'delhi', name: 'Punjabi Bagh, Delhi - DPCC', latitude: 28.6740, longitude: 77.1310, source: 'Synthetic Demo', forecast_eligible: false, data_mode: 'demo' },
  { id: 'delhi-mandir-marg', city_id: 'delhi', name: 'Mandir Marg, Delhi - DPCC', latitude: 28.6364, longitude: 77.2010, source: 'Synthetic Demo', forecast_eligible: false, data_mode: 'demo' },
  { id: 'delhi-rk-puram', city_id: 'delhi', name: 'R K Puram, Delhi - DPCC', latitude: 28.5632, longitude: 77.1869, source: 'Synthetic Demo', forecast_eligible: false, data_mode: 'demo' },
  { id: 'delhi-igi-airport', city_id: 'delhi', name: 'IGI Airport (T3), Delhi - IMD', latitude: 28.5562, longitude: 77.0999, source: 'Synthetic Demo', forecast_eligible: false, data_mode: 'demo' },
  { id: 'delhi-lodhi-road', city_id: 'delhi', name: 'Lodhi Road, Delhi - IITM', latitude: 28.5883, longitude: 77.2217, source: 'Synthetic Demo', forecast_eligible: false, data_mode: 'demo' },
  { id: 'delhi-bawana', city_id: 'delhi', name: 'Bawana, Delhi - DPCC', latitude: 28.7762, longitude: 77.0511, source: 'Synthetic Demo', forecast_eligible: false, data_mode: 'demo' },
  { id: 'mumbai-bkc', city_id: 'mumbai', name: 'Bandra Kurla Complex, Mumbai - MPCB', latitude: 19.0657, longitude: 72.8687, source: 'Synthetic Demo', forecast_eligible: false, data_mode: 'demo' },
  { id: 'mumbai-worli', city_id: 'mumbai', name: 'Worli, Mumbai - MPCB', latitude: 19.0166, longitude: 72.8174, source: 'Synthetic Demo', forecast_eligible: false, data_mode: 'demo' },
  { id: 'mumbai-colaba', city_id: 'mumbai', name: 'Colaba, Mumbai - MPCB', latitude: 18.9067, longitude: 72.8147, source: 'Synthetic Demo', forecast_eligible: false, data_mode: 'demo' },
  { id: 'blr-btm-layout', city_id: 'bengaluru', name: 'BTM Layout, Bengaluru - KSPCB', latitude: 12.9128, longitude: 77.6092, source: 'Synthetic Demo', forecast_eligible: false, data_mode: 'demo' },
  { id: 'blr-silk-board', city_id: 'bengaluru', name: 'Central Silk Board, Bengaluru - KSPCB', latitude: 12.9176, longitude: 77.6238, source: 'Synthetic Demo', forecast_eligible: false, data_mode: 'demo' }
];

// Distinct, non-relabeled measurements per station and pollutant
export const DEMO_MEASUREMENTS: Record<string, Measurement> = {
  'delhi-anand-vihar:pm25': {
    station_id: 'delhi-anand-vihar',
    pollutant: 'pm25',
    value: 284.5,
    unit: 'µg/m³',
    original_value: 284.5,
    original_unit: 'µg/m³',
    measured_at: new Date(Date.now() - 18 * 60000).toISOString(),
    available_at: new Date(Date.now() - 5 * 60000).toISOString(),
    observation_age_minutes: 18,
    stale: false,
    source: 'Synthetic Demo Fixture',
    quality_flags: ['synthetic_demo']
  },
  'delhi-anand-vihar:pm10': {
    station_id: 'delhi-anand-vihar',
    pollutant: 'pm10',
    value: 412.0,
    unit: 'µg/m³',
    original_value: 412.0,
    original_unit: 'µg/m³',
    measured_at: new Date(Date.now() - 18 * 60000).toISOString(),
    available_at: new Date(Date.now() - 5 * 60000).toISOString(),
    observation_age_minutes: 18,
    stale: false,
    source: 'Synthetic Demo Fixture',
    quality_flags: ['synthetic_demo']
  },
  'delhi-anand-vihar:no2': {
    station_id: 'delhi-anand-vihar',
    pollutant: 'no2',
    value: 78.4,
    unit: 'µg/m³',
    original_value: 78.4,
    original_unit: 'µg/m³',
    measured_at: new Date(Date.now() - 18 * 60000).toISOString(),
    available_at: new Date(Date.now() - 5 * 60000).toISOString(),
    observation_age_minutes: 18,
    stale: false,
    source: 'Synthetic Demo Fixture',
    quality_flags: ['synthetic_demo']
  },
  'delhi-anand-vihar:co': {
    station_id: 'delhi-anand-vihar',
    pollutant: 'co',
    value: 2150.0,
    unit: 'µg/m³',
    original_value: 2150.0,
    original_unit: 'µg/m³',
    measured_at: new Date(Date.now() - 18 * 60000).toISOString(),
    available_at: new Date(Date.now() - 5 * 60000).toISOString(),
    observation_age_minutes: 18,
    stale: false,
    source: 'Synthetic Demo Fixture',
    quality_flags: ['synthetic_demo']
  },
  'delhi-mandir-marg:pm25': {
    station_id: 'delhi-mandir-marg',
    pollutant: 'pm25',
    value: 168.0,
    unit: 'µg/m³',
    original_value: 168.0,
    original_unit: 'µg/m³',
    measured_at: new Date(Date.now() - 25 * 60000).toISOString(),
    available_at: new Date(Date.now() - 8 * 60000).toISOString(),
    observation_age_minutes: 25,
    stale: false,
    source: 'Synthetic Demo Fixture',
    quality_flags: ['synthetic_demo']
  },
  'delhi-mandir-marg:pm10': {
    station_id: 'delhi-mandir-marg',
    pollutant: 'pm10',
    value: 235.0,
    unit: 'µg/m³',
    original_value: 235.0,
    original_unit: 'µg/m³',
    measured_at: new Date(Date.now() - 25 * 60000).toISOString(),
    available_at: new Date(Date.now() - 8 * 60000).toISOString(),
    observation_age_minutes: 25,
    stale: false,
    source: 'Synthetic Demo Fixture',
    quality_flags: ['synthetic_demo']
  },
  'mumbai-bkc:pm25': {
    station_id: 'mumbai-bkc',
    pollutant: 'pm25',
    value: 82.0,
    unit: 'µg/m³',
    original_value: 82.0,
    original_unit: 'µg/m³',
    measured_at: new Date(Date.now() - 12 * 60000).toISOString(),
    available_at: new Date(Date.now() - 2 * 60000).toISOString(),
    observation_age_minutes: 12,
    stale: false,
    source: 'Synthetic Demo Fixture',
    quality_flags: ['synthetic_demo']
  },
  'blr-silk-board:pm25': {
    station_id: 'blr-silk-board',
    pollutant: 'pm25',
    value: 48.0,
    unit: 'µg/m³',
    original_value: 48.0,
    original_unit: 'µg/m³',
    measured_at: new Date(Date.now() - 30 * 60000).toISOString(),
    available_at: new Date(Date.now() - 10 * 60000).toISOString(),
    observation_age_minutes: 30,
    stale: false,
    source: 'Synthetic Demo Fixture',
    quality_flags: ['synthetic_demo']
  }
};

export const DEMO_CAPABILITIES: Capabilities = {
  alerts: { supported: true, method: 'in_app hourly observed threshold evaluation', requirements_missing: [], supported_scope: ['in_app'] },
  calibrated_exceedance_probability: { supported: false, method: null, requirements_missing: ['conformal evaluation on national split'], supported_scope: [] },
  calibrated_intervals: { supported: false, method: null, requirements_missing: ['quantile regression calibration'], supported_scope: [] },
  continuous_hourly_trajectory: { supported: false, method: null, requirements_missing: ['validated hourly forecast trajectory'], supported_scope: [] },
  declared_artifact_horizons: [1, 3, 6, 12, 24],
  evaluation: { supported: false, method: null, requirements_missing: ['held-out predictions and chronological split dates'], supported_scope: [] },
  history: { supported: true, method: 'canonical validated hourly observation history', requirements_missing: [], supported_scope: ['hourly'] },
  model_forecast: { supported: false, method: null, requirements_missing: ['preprocessing and golden predictions verified'], supported_scope: [] },
  observations: { supported: true, method: 'canonical hourly validated import', requirements_missing: [], supported_scope: ['pm25', 'pm10', 'no2', 'so2', 'o3', 'co'] },
  population_coverage: { supported: false, method: null, requirements_missing: ['complete population raster and extraction provenance'], supported_scope: [] },
  routes: { supported: false, method: null, requirements_missing: ['routing endpoint', 'validated spatial estimator'], supported_scope: [] },
  saved_places: { supported: true, method: 'user-owned persisted coordinates', requirements_missing: [], supported_scope: ['user_isolated'] },
  spatial_exposure: { supported: false, method: null, requirements_missing: ['high-resolution dispersion model'], supported_scope: [] },
  traffic_live: { supported: false, method: null, requirements_missing: ['real-time traffic provider'], supported_scope: [] },
  verified_forecast_horizons: [],
  verified_forecast_pollutants: [],
  weather_scenarios: { supported: false, method: null, requirements_missing: ['dependent feature recomputation and parity verified'], supported_scope: [] }
};

export const DEMO_ADVISORIES: Advisory[] = [
  {
    pollutant: 'pm25',
    title: 'Fine Particulate Matter (PM2.5) — General Public Health Facts',
    summary: 'PM2.5 particles are capable of penetrating deep into the pulmonary alveoli and vascular system. General public education focuses on reducing prolonged outdoor exertion during high-concentration events.',
    source_title: 'WHO: Ambient (outdoor) air quality and health',
    source_url: 'https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health',
    scope: 'general_education',
    review_scope: 'engineering source review; no clinical review',
    reviewed_at: '2026-11-24',
    content_version: '2026-11-24.1',
    limitations: [
      'Educational population-level information; no diagnosis or personal risk estimate.',
      'This content does not assign an official CPCB AQI category or prescribe a safe activity window.'
    ]
  },
  {
    pollutant: 'pm10',
    title: 'Coarse Particulate Matter (PM10) — Environmental Guidance',
    summary: 'Coarse particulates primarily irritate upper airways and mucous membranes. Mitigation includes avoiding road dust, construction vicinity, and wearing particulate-filtering respirators.',
    source_title: 'WHO: Ambient (outdoor) air quality and health',
    source_url: 'https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health',
    scope: 'general_education',
    review_scope: 'engineering source review; no clinical review',
    reviewed_at: '2026-11-24',
    content_version: '2026-11-24.1',
    limitations: [
      'Educational population-level information; no diagnosis or personal risk estimate.',
      'This content does not assign an official CPCB AQI category or prescribe a safe activity window.'
    ]
  }
];

export const DEMO_IDENTITY: Identity = {
  user_id: 'demo-preview-user-uuid',
  preferences: {
    default_city_id: 'delhi',
    display_timezone: 'Asia/Kolkata',
    sensitivity: 'general'
  }
};

// ----------------------------------------------------------------------
// Contract 1.2.0 Demo Datasets
// ----------------------------------------------------------------------

export const DEMO_STATION_CATALOGUE: StationCatalogue = {
  city_id: 'delhi',
  scope: 'bounded imported station cohort; not all-city coverage',
  input_cutoff_at: new Date(Date.now() - 15 * 60000).toISOString(),
  catalogue_verified_at: '2026-11-24T06:00:00Z',
  stations: [
    {
      id: 'delhi-anand-vihar',
      name: 'Anand Vihar, Delhi - DPCC',
      city_id: 'delhi',
      source: 'DPCC',
      provider_revision_pending: false,
      latitude: 28.6476,
      longitude: 77.3160,
      data_mode: 'demo',
      forecast_eligible: false,
      last_refresh_status: 'ok',
      catalogue_verified_at: '2026-11-24T06:00:00Z',
      pollutants: [
        {
          pollutant: 'pm25',
          status: 'available',
          freshness: 'fresh',
          coverage_state: 'reported_complete',
          reported_sensor_units: ['µg/m³'],
          provider_revision_pending: false,
          revision_pending_count: 0,
          measurement: DEMO_MEASUREMENTS['delhi-anand-vihar:pm25'],
          limitations: ['Continuous BAM 1020 monitor']
        },
        {
          pollutant: 'pm10',
          status: 'available',
          freshness: 'fresh',
          coverage_state: 'reported_complete',
          reported_sensor_units: ['µg/m³'],
          provider_revision_pending: false,
          revision_pending_count: 0,
          measurement: DEMO_MEASUREMENTS['delhi-anand-vihar:pm10']
        },
        {
          pollutant: 'no2',
          status: 'available',
          freshness: 'fresh',
          coverage_state: 'reported_partial',
          reported_sensor_units: ['µg/m³'],
          provider_revision_pending: false,
          revision_pending_count: 0,
          measurement: DEMO_MEASUREMENTS['delhi-anand-vihar:no2']
        }
      ]
    },
    {
      id: 'delhi-mandir-marg',
      name: 'Mandir Marg, Delhi - DPCC',
      city_id: 'delhi',
      source: 'DPCC',
      provider_revision_pending: false,
      latitude: 28.6364,
      longitude: 77.2010,
      data_mode: 'demo',
      forecast_eligible: false,
      last_refresh_status: 'ok',
      catalogue_verified_at: '2026-11-24T06:00:00Z',
      pollutants: [
        {
          pollutant: 'pm25',
          status: 'available',
          freshness: 'fresh',
          coverage_state: 'reported_complete',
          reported_sensor_units: ['µg/m³'],
          provider_revision_pending: false,
          revision_pending_count: 0,
          measurement: DEMO_MEASUREMENTS['delhi-mandir-marg:pm25']
        },
        {
          pollutant: 'pm10',
          status: 'available',
          freshness: 'fresh',
          coverage_state: 'reported_complete',
          reported_sensor_units: ['µg/m³'],
          provider_revision_pending: false,
          revision_pending_count: 0,
          measurement: DEMO_MEASUREMENTS['delhi-mandir-marg:pm10']
        }
      ]
    }
  ]
};

export const DEMO_OBSERVED_RANKINGS: ObservedRankings = {
  city_id: 'delhi',
  pollutant: 'pm25',
  unit: 'µg/m³',
  ranking_kind: 'observed_concentration',
  input_cutoff_at: new Date(Date.now() - 15 * 60000).toISOString(),
  includes_stale: false,
  excluded_stale_count: 0,
  excluded_missing_count: 1,
  limitations: [
    'Latest station observations may have different measurement times and partial coverage',
    'Not predicted hotspots, forecasts, area-wide concentration or a common-time city average'
  ],
  rows: [
    {
      rank: 1,
      station: DEMO_STATIONS[0],
      measurement: DEMO_MEASUREMENTS['delhi-anand-vihar:pm25'],
      coverage_state: 'reported_complete',
      provider_revision_pending: false
    },
    {
      rank: 2,
      station: DEMO_STATIONS[2],
      measurement: DEMO_MEASUREMENTS['delhi-mandir-marg:pm25'],
      coverage_state: 'reported_complete',
      provider_revision_pending: false
    }
  ]
};

export const DEMO_ARCHIVE_CATALOGUE: ArchiveCatalogue = {
  dataset_id: 'delhi_observed_archive_v1',
  dataset_fingerprint: 'demo_fingerprint_duckdb_v1',
  dataset_mode: 'recorded_clock',
  clock_basis: 'source_naive_clock_unverified',
  interval_semantics: 'unverified',
  publication_time_known: false,
  timezone: null,
  station_count: 3,
  source_file_count: 3,
  excluded_row_count: 42,
  limitations: [
    'Naive recorded device clocks; unconfirmed timezone and publication times',
    'Quarantined duplicate folders and corrupted timestamps excluded'
  ],
  stations: [
    {
      station_id: 'site_301',
      first_record: '2021-01-01T00:00:00',
      last_record: '2024-03-31T23:00:00',
      grid_rows: 28488,
      expected_count: 28488,
      absent_hour_count: 0,
      labels: ['Anand Vihar, Delhi - DPCC (Archive site_301)'],
      source_folders: ['Delhi_site_301'],
      pollutants: [
        {
          pollutant: 'pm25',
          unit: 'µg/m³',
          valid_count: 27120,
          missing_count: 1368,
          invalid_count: 0,
          coverage_fraction: 0.952
        },
        {
          pollutant: 'pm10',
          unit: 'µg/m³',
          valid_count: 26500,
          missing_count: 1988,
          invalid_count: 0,
          coverage_fraction: 0.930
        },
        {
          pollutant: 'no2',
          unit: 'µg/m³',
          valid_count: 25400,
          missing_count: 3088,
          invalid_count: 0,
          coverage_fraction: 0.892
        },
        {
          pollutant: 'so2',
          unit: 'µg/m³',
          valid_count: 24900,
          missing_count: 3588,
          invalid_count: 0,
          coverage_fraction: 0.874
        },
        {
          pollutant: 'co',
          unit: 'mg/m³',
          valid_count: 26200,
          missing_count: 2288,
          invalid_count: 0,
          coverage_fraction: 0.920
        },
        {
          pollutant: 'o3',
          unit: 'µg/m³',
          valid_count: 25100,
          missing_count: 3388,
          invalid_count: 0,
          coverage_fraction: 0.881
        }
      ]
    },
    {
      station_id: 'site_113',
      first_record: '2021-01-01T00:00:00',
      last_record: '2024-03-31T23:00:00',
      grid_rows: 28488,
      expected_count: 28488,
      absent_hour_count: 0,
      labels: ['R K Puram, Delhi - DPCC (Archive site_113)'],
      source_folders: ['Delhi_site_113'],
      pollutants: [
        {
          pollutant: 'pm25',
          unit: 'µg/m³',
          valid_count: 26800,
          missing_count: 1688,
          invalid_count: 0,
          coverage_fraction: 0.941
        },
        {
          pollutant: 'pm10',
          unit: 'µg/m³',
          valid_count: 26100,
          missing_count: 2388,
          invalid_count: 0,
          coverage_fraction: 0.916
        },
        {
          pollutant: 'no2',
          unit: 'µg/m³',
          valid_count: 25000,
          missing_count: 3488,
          invalid_count: 0,
          coverage_fraction: 0.878
        },
        {
          pollutant: 'so2',
          unit: 'µg/m³',
          valid_count: 24200,
          missing_count: 4288,
          invalid_count: 0,
          coverage_fraction: 0.850
        },
        {
          pollutant: 'co',
          unit: 'mg/m³',
          valid_count: 25800,
          missing_count: 2688,
          invalid_count: 0,
          coverage_fraction: 0.906
        },
        {
          pollutant: 'o3',
          unit: 'µg/m³',
          valid_count: 24700,
          missing_count: 3788,
          invalid_count: 0,
          coverage_fraction: 0.867
        }
      ]
    },
    {
      station_id: 'site_115',
      first_record: '2021-01-01T00:00:00',
      last_record: '2024-03-31T23:00:00',
      grid_rows: 28488,
      expected_count: 28488,
      absent_hour_count: 0,
      labels: ['Punjabi Bagh, Delhi - DPCC (Archive site_115)'],
      source_folders: ['Delhi_site_115'],
      pollutants: [
        {
          pollutant: 'pm25',
          unit: 'µg/m³',
          valid_count: 26150,
          missing_count: 2338,
          invalid_count: 0,
          coverage_fraction: 0.918
        },
        {
          pollutant: 'pm10',
          unit: 'µg/m³',
          valid_count: 25500,
          missing_count: 2988,
          invalid_count: 0,
          coverage_fraction: 0.895
        },
        {
          pollutant: 'no2',
          unit: 'µg/m³',
          valid_count: 24800,
          missing_count: 3688,
          invalid_count: 0,
          coverage_fraction: 0.871
        },
        {
          pollutant: 'so2',
          unit: 'µg/m³',
          valid_count: 23900,
          missing_count: 4588,
          invalid_count: 0,
          coverage_fraction: 0.839
        },
        {
          pollutant: 'co',
          unit: 'mg/m³',
          valid_count: 25300,
          missing_count: 3188,
          invalid_count: 0,
          coverage_fraction: 0.888
        },
        {
          pollutant: 'o3',
          unit: 'µg/m³',
          valid_count: 24300,
          missing_count: 4188,
          invalid_count: 0,
          coverage_fraction: 0.853
        }
      ]
    }
  ]
};

export const DEMO_ARCHIVE_EXPLORE: ArchiveExplore = {
  station_id: 'site_301',
  pollutant: 'pm25',
  unit: 'µg/m³',
  start: '2023-11-01T00:00:00',
  end: '2023-11-08T00:00:00',
  aggregation: 'daily',
  min_count: 18,
  min_coverage: 0.75,
  dataset_id: 'delhi_observed_archive_v1',
  dataset_fingerprint: 'demo_fingerprint_duckdb_v1',
  dataset_mode: 'recorded_clock',
  clock_basis: 'source_naive_clock_unverified',
  interval_semantics: 'unverified',
  publication_time_known: false,
  timezone: null,
  valid_count: 160,
  missing_count: 8,
  invalid_count: 0,
  source_null_count: 8,
  absent_hour_count: 0,
  expected_count: 168,
  coverage_fraction: 0.952,
  lineage_source_files: ['Delhi_site_301_observed.parquet'],
  distribution: {
    count: 160,
    minimum: 142.5,
    mean: 294.8,
    median: 288.0,
    maximum: 485.2,
    p05: 165.0,
    p25: 220.5,
    p75: 360.0,
    p95: 450.0,
    stddev: 74.2
  },
  points: [
    { period_start: '2023-11-01T00:00:00', period_end: '2023-11-02T00:00:00', value: 245.2, valid_count: 24, missing_count: 0, expected_count: 24, coverage_fraction: 1.0, meets_requested_sufficiency: true },
    { period_start: '2023-11-02T00:00:00', period_end: '2023-11-03T00:00:00', value: 312.8, valid_count: 23, missing_count: 1, expected_count: 24, coverage_fraction: 0.958, meets_requested_sufficiency: true },
    { period_start: '2023-11-03T00:00:00', period_end: '2023-11-04T00:00:00', value: 395.4, valid_count: 24, missing_count: 0, expected_count: 24, coverage_fraction: 1.0, meets_requested_sufficiency: true },
    { period_start: '2023-11-04T00:00:00', period_end: '2023-11-05T00:00:00', value: 410.1, valid_count: 22, missing_count: 2, expected_count: 24, coverage_fraction: 0.917, meets_requested_sufficiency: true },
    { period_start: '2023-11-05T00:00:00', period_end: '2023-11-06T00:00:00', value: 280.3, valid_count: 24, missing_count: 0, expected_count: 24, coverage_fraction: 1.0, meets_requested_sufficiency: true },
    { period_start: '2023-11-06T00:00:00', period_end: '2023-11-07T00:00:00', value: 220.6, valid_count: 23, missing_count: 1, expected_count: 24, coverage_fraction: 0.958, meets_requested_sufficiency: true },
    { period_start: '2023-11-07T00:00:00', period_end: '2023-11-08T00:00:00', value: 198.4, valid_count: 20, missing_count: 4, expected_count: 24, coverage_fraction: 0.833, meets_requested_sufficiency: true }
  ]
};

export const DEMO_ARCHIVE_COMPARE: ArchiveCompare = {
  station_ids: ['site_301', 'site_113'],
  pollutant: 'pm25',
  unit: 'µg/m³',
  start: '2023-11-01T00:00:00',
  end: '2023-11-08T00:00:00',
  aggregation: 'daily',
  clock_assumption: 'same_recorded_clock',
  alignment_status: 'conditional_same_recorded_clock_only',
  forecast_evaluation: false,
  dataset_id: 'delhi_observed_archive_v1',
  dataset_fingerprint: 'demo_fingerprint_duckdb_v1',
  dataset_mode: 'recorded_clock',
  clock_basis: 'source_naive_clock_unverified',
  interval_semantics: 'unverified',
  publication_time_known: false,
  timezone: null,
  expected_count: 168,
  matched_hour_count: 154,
  unmatched_or_missing_hour_count: 14,
  limitations: [
    'Comparison assumes identical recorded clocks; differences reflect station divergence, not model skill'
  ],
  pair_agreement: [
    {
      station_a: 'site_301',
      station_b: 'site_113',
      count: 154,
      mean_difference: 42.6,
      mean_absolute_difference: 58.1,
      interpretation: 'Differences between observed station records, not forecast evaluation'
    }
  ],
  points: [
    { period_start: '2023-11-01T00:00:00', period_end: '2023-11-02T00:00:00', means: { site_301: 245.2, site_113: 202.1 }, paired_hour_count: 24, expected_count: 24, paired_coverage_fraction: 1.0 },
    { period_start: '2023-11-02T00:00:00', period_end: '2023-11-03T00:00:00', means: { site_301: 312.8, site_113: 260.4 }, paired_hour_count: 23, expected_count: 24, paired_coverage_fraction: 0.958 },
    { period_start: '2023-11-03T00:00:00', period_end: '2023-11-04T00:00:00', means: { site_301: 395.4, site_113: 340.2 }, paired_hour_count: 24, expected_count: 24, paired_coverage_fraction: 1.0 },
    { period_start: '2023-11-04T00:00:00', period_end: '2023-11-05T00:00:00', means: { site_301: 410.1, site_113: 375.0 }, paired_hour_count: 22, expected_count: 24, paired_coverage_fraction: 0.917 },
    { period_start: '2023-11-05T00:00:00', period_end: '2023-11-06T00:00:00', means: { site_301: 280.3, site_113: 245.8 }, paired_hour_count: 24, expected_count: 24, paired_coverage_fraction: 1.0 },
    { period_start: '2023-11-06T00:00:00', period_end: '2023-11-07T00:00:00', means: { site_301: 220.6, site_113: 185.3 }, paired_hour_count: 23, expected_count: 24, paired_coverage_fraction: 0.958 },
    { period_start: '2023-11-07T00:00:00', period_end: '2023-11-08T00:00:00', means: { site_301: 198.4, site_113: 162.0 }, paired_hour_count: 20, expected_count: 24, paired_coverage_fraction: 0.833 }
  ]
};

export const DEMO_MODELS: ModelCatalogue = {
  models: [
    {
      model_version: 'supplied-native-75-v1',
      kind: 'native_diagnostic',
      dataset_mode: 'diagnostic',
      pollutant: 'pm25',
      target_unit: 'µg/m³',
      status: 'available',
      supported_horizons: [1, 3, 6, 12, 24],
      feature_count: 75,
      live_supported_horizons: [],
      native_diagnostics_ready: true,
      retrospective_evaluation_ready: false,
      live_forecast_ready: false,
      continuous_trajectory_ready: false,
      station_ids: ['site_301'],
      artifact_hashes: {
        model: '2891830caddcb09e651ba382caca4e957569de165c323942be8f04492777fef8'
      },
      limitations: [
        'Supplied 75-feature native adapter is offline diagnostic-only',
        'Original preprocessing, units, wrapper parity and independent validation unverified'
      ]
    },
    {
      model_version: 'delhi-recorded-pm25-v1',
      kind: 'retrospective_forecast',
      dataset_mode: 'recorded_clock',
      clock_basis: 'source_naive_clock_unverified',
      evaluation_cohort: 'target_timestamp_split_only',
      evaluation_path: '/api/v1/models/delhi-recorded-pm25-v1/evaluation',
      predictions_path: '/api/v1/models/delhi-recorded-pm25-v1/predictions',
      pollutant: 'pm25',
      target_unit: 'µg/m³',
      status: 'available',
      supported_horizons: [1, 3, 6, 12, 24],
      feature_count: 39,
      live_supported_horizons: [],
      native_diagnostics_ready: false,
      retrospective_evaluation_ready: true,
      live_forecast_ready: false,
      continuous_trajectory_ready: false,
      station_ids: ['site_301'],
      artifact_hashes: {
        model: 'sha256_mock_hash_delhi_v1'
      },
      limitations: [
        'Discovered boundary-availability limitation: historical target-only evaluation contains split-boundary availability overlaps.',
        'Original values are preserved as qualified historical evidence; see v2 and UTC experiments for issue-time purged primary cohorts.'
      ]
    },
    {
      model_version: 'delhi-recorded-pm25-hourly-v2',
      kind: 'retrospective_forecast',
      dataset_mode: 'recorded_clock',
      clock_basis: 'source_naive_clock_unverified',
      evaluation_cohort: 'fixed_model_issue_time_purged',
      evaluation_path: '/api/v1/models/delhi-recorded-pm25-hourly-v2/evaluation',
      predictions_path: '/api/v1/models/delhi-recorded-pm25-hourly-v2/predictions',
      pollutant: 'pm25',
      target_unit: 'µg/m³',
      status: 'available',
      supported_horizons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
      feature_count: 39,
      live_supported_horizons: [],
      native_diagnostics_ready: false,
      retrospective_evaluation_ready: true,
      live_forecast_ready: false,
      continuous_trajectory_ready: false,
      station_ids: ['site_301'],
      artifact_hashes: {
        model: 'sha256_mock_hash_delhi_v2'
      },
      limitations: [
        'Separate recorded-clock hourly model across all 24 horizons.',
        'Primary evaluation uses fixed_model_issue_time_purged cohort without lookahead.'
      ]
    },
    {
      model_version: 'delhi-openaq-pm25-hourly-v1',
      kind: 'retrospective_forecast',
      dataset_mode: 'utc_provider_history',
      clock_basis: 'UTC_hour_ending',
      evaluation_cohort: 'fixed_model_issue_time_purged',
      evaluation_path: '/api/v1/models/delhi-openaq-pm25-hourly-v1/utc-evaluation',
      predictions_path: '/api/v1/models/delhi-openaq-pm25-hourly-v1/utc-predictions',
      pollutant: 'pm25',
      target_unit: 'µg/m³',
      status: 'available',
      supported_horizons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
      feature_count: 39,
      live_supported_horizons: [],
      native_diagnostics_ready: false,
      retrospective_evaluation_ready: true,
      live_forecast_ready: false,
      continuous_trajectory_ready: false,
      station_ids: ['openaq-235'],
      artifact_hashes: {
        model: 'sha256_mock_hash_delhi_utc_v1'
      },
      limitations: [
        'Separate UTC-native hourly model using verified OpenAQ provider clock and sensor.',
        'Chronological UTC splits; primary evaluation uses fixed_model_issue_time_purged cohort.'
      ]
    }
  ]
};

export const DEMO_MODEL_EVALUATION: ModelEvaluation = {
  model_version: 'delhi-recorded-pm25-v1',
  dataset_mode: 'recorded_clock',
  evaluation_cohort: 'target_timestamp_split_only',
  dataset_sha256: '43cb7d50000f3614657bfadc7f83f2954c879e561e790ccf13b5b75d247558df',
  live_forecast_ready: false,
  publication_time_known: false,
  retrospective_only: true,
  preprocessing: 'no fit/scaling/imputation; native NaN plus explicit lag missing indicators',
  target_transform: 'identity',
  target_unit: 'µg/m³',
  station_ids: ['site_301'],
  supported_horizons: [1, 3, 6, 12, 24],
  target_only_horizons: [],
  input_availability_assumption: 'same_recorded_clock_causal_lags_only',
  limitations: [
    'Retrospective recorded-clock experiment only; source timezone and interval meaning unresolved.',
    'Assumes the recorded current row is known at its recorded clock; historical publication times are unknown.',
    'No live/provider alignment, clinical or spatial readiness.',
    'Baseline persistence strictly evaluated on matched observed hours'
  ],
  features: {
    target: [{ name: 'pm25', formula: 'hourly_concentration', unit: 'µg/m³' }],
    lag: [{ name: 'pm25_lag_1h', formula: 'pm25(t-1)', unit: 'µg/m³' }]
  },
  splits: [
    { name: 'train', start_recorded_at: '2017-01-01T00:00:00', end_recorded_at_exclusive: '2024-01-01T00:00:00' },
    { name: 'validation', start_recorded_at: '2024-01-01T00:00:00', end_recorded_at_exclusive: '2025-01-01T00:00:00' },
    { name: 'test', start_recorded_at: '2025-01-01T00:00:00', end_recorded_at_exclusive: '2026-11-01T00:00:00' }
  ],
  rolling_backtests: {},
  horizons: [
    {
      horizon_h: 1,
      splits: {
        test: {
          all_available: {
            lightgbm: { count: 14718, mae: 18.977, rmse: 30.193, bias: -0.434 },
            persistence: { count: 14718, mae: 20.892, rmse: 33.127, bias: -0.049 },
            previous_day_same_hour: { count: 13977, mae: 47.922, rmse: 73.502, bias: -0.663 }
          },
          common_baseline_cohort: {
            lightgbm: { count: 13977, mae: 18.913, rmse: 30.125, bias: -0.306 },
            persistence: { count: 13977, mae: 20.870, rmse: 33.119, bias: 0.070 }
          },
          high_pollution_definition: 'observed target >= 150 µg/m³',
          high_pollution_threshold_ugm3: 150,
          high_pollution_observed_target_ge_150: {
            lightgbm: { count: 2492, mae: 33.919, rmse: 50.778, bias: -9.203 },
            persistence: { count: 2492, mae: 36.875, rmse: 54.429, bias: -6.037 },
            previous_day_same_hour: { count: 2343, mae: 95.050, rmse: 128.153, bias: -24.343 }
          }
        }
      }
    },
    {
      horizon_h: 3,
      splits: {
        test: {
          all_available: {
            lightgbm: { count: 14710, mae: 30.223, rmse: 43.100, bias: -1.200 },
            persistence: { count: 14710, mae: 38.900, rmse: 52.400, bias: 0.200 },
            previous_day_same_hour: { count: 13970, mae: 48.012, rmse: 73.800, bias: -0.500 }
          },
          common_baseline_cohort: {
            lightgbm: { count: 13970, mae: 30.223, rmse: 43.100, bias: -1.200 },
            persistence: { count: 13970, mae: 38.900, rmse: 52.400, bias: 0.200 }
          },
          high_pollution_definition: 'observed target >= 150 µg/m³',
          high_pollution_threshold_ugm3: 150,
          high_pollution_observed_target_ge_150: {
            lightgbm: { count: 2480, mae: 44.800, rmse: 61.200, bias: -12.100 },
            persistence: { count: 2480, mae: 58.600, rmse: 76.500, bias: -4.200 },
            previous_day_same_hour: { count: 2335, mae: 98.400, rmse: 131.000, bias: -25.200 }
          }
        }
      }
    },
    {
      horizon_h: 6,
      splits: {
        test: {
          all_available: {
            lightgbm: { count: 14700, mae: 34.810, rmse: 48.200, bias: -1.800 },
            persistence: { count: 14700, mae: 51.881, rmse: 67.500, bias: 0.800 },
            previous_day_same_hour: { count: 13960, mae: 47.688, rmse: 73.200, bias: -0.400 }
          },
          common_baseline_cohort: {
            lightgbm: { count: 13960, mae: 34.810, rmse: 48.200, bias: -1.800 },
            persistence: { count: 13960, mae: 51.881, rmse: 67.500, bias: 0.800 }
          },
          high_pollution_definition: 'observed target >= 150 µg/m³',
          high_pollution_threshold_ugm3: 150,
          high_pollution_observed_target_ge_150: {
            lightgbm: { count: 2470, mae: 54.200, rmse: 71.400, bias: -15.400 },
            persistence: { count: 2470, mae: 73.200, rmse: 94.100, bias: -1.500 },
            previous_day_same_hour: { count: 2320, mae: 97.200, rmse: 129.500, bias: -23.800 }
          }
        }
      }
    },
    {
      horizon_h: 12,
      splits: {
        test: {
          all_available: {
            lightgbm: { count: 14680, mae: 37.737, rmse: 52.400, bias: -2.100 },
            persistence: { count: 14680, mae: 59.534, rmse: 77.200, bias: 1.400 },
            previous_day_same_hour: { count: 13940, mae: 47.694, rmse: 73.100, bias: -0.300 }
          },
          common_baseline_cohort: {
            lightgbm: { count: 13940, mae: 37.737, rmse: 52.400, bias: -2.100 },
            persistence: { count: 13940, mae: 59.534, rmse: 77.200, bias: 1.400 }
          },
          high_pollution_definition: 'observed target >= 150 µg/m³',
          high_pollution_threshold_ugm3: 150,
          high_pollution_observed_target_ge_150: {
            lightgbm: { count: 2450, mae: 61.800, rmse: 81.500, bias: -18.200 },
            persistence: { count: 2450, mae: 85.400, rmse: 108.600, bias: 2.100 },
            previous_day_same_hour: { count: 2300, mae: 96.500, rmse: 128.000, bias: -22.500 }
          }
        }
      }
    },
    {
      horizon_h: 24,
      splits: {
        test: {
          all_available: {
            lightgbm: { count: 14640, mae: 39.563, rmse: 54.800, bias: -1.500 },
            persistence: { count: 14640, mae: 47.829, rmse: 73.500, bias: 0.100 },
            previous_day_same_hour: { count: 13900, mae: 47.829, rmse: 73.500, bias: 0.100 }
          },
          common_baseline_cohort: {
            lightgbm: { count: 13900, mae: 39.563, rmse: 54.800, bias: -1.500 },
            persistence: { count: 13900, mae: 47.829, rmse: 73.500, bias: 0.100 }
          },
          high_pollution_definition: 'observed target >= 150 µg/m³',
          high_pollution_threshold_ugm3: 150,
          high_pollution_observed_target_ge_150: {
            lightgbm: { count: 2420, mae: 64.200, rmse: 84.100, bias: -19.500 },
            persistence: { count: 2420, mae: 78.500, rmse: 104.200, bias: -1.200 },
            previous_day_same_hour: { count: 2280, mae: 95.800, rmse: 127.200, bias: -21.800 }
          }
        }
      }
    }
  ]
};

export const DEMO_PREDICTION_PAGE: PredictionPage = {
  model_version: 'delhi-recorded-pm25-v1',
  dataset_mode: 'recorded_clock',
  evaluation_cohort: 'target_timestamp_split_only',
  retrospective_only: true,
  publication_time_known: false,
  timezone: null,
  offset: 0,
  limit: 5,
  total_count: 5,
  unit: 'µg/m³',
  points: [
    { station_id: 'site_301', split: 'test', horizon_h: 1, issue_at_recorded: '2023-11-15T10:00:00', target_at_recorded: '2023-11-15T11:00:00', observed: 278.4, lightgbm: 269.1, persistence: 285.0, previous_day_same_hour: 295.2 },
    { station_id: 'site_301', split: 'test', horizon_h: 1, issue_at_recorded: '2023-11-15T11:00:00', target_at_recorded: '2023-11-15T12:00:00', observed: 262.1, lightgbm: 255.4, persistence: 278.4, previous_day_same_hour: 280.0 },
    { station_id: 'site_301', split: 'test', horizon_h: 1, issue_at_recorded: '2023-11-15T12:00:00', target_at_recorded: '2023-11-15T13:00:00', observed: 245.0, lightgbm: 248.8, persistence: 262.1, previous_day_same_hour: 265.4 },
    { station_id: 'site_301', split: 'test', horizon_h: 1, issue_at_recorded: '2023-11-15T13:00:00', target_at_recorded: '2023-11-15T14:00:00', observed: 231.8, lightgbm: 238.0, persistence: 245.0, previous_day_same_hour: 250.1 },
    { station_id: 'site_301', split: 'test', horizon_h: 1, issue_at_recorded: '2023-11-15T14:00:00', target_at_recorded: '2023-11-15T15:00:00', observed: 228.0, lightgbm: 230.2, persistence: 231.8, previous_day_same_hour: 242.0 }
  ]
};

export const DEMO_GEOMETRY_RESPONSE: GeometryResponse = {
  profile: 'driving',
  provider: 'demo_corridor_fixture',
  alternatives_returned: 2,
  duration_method: 'Demonstration travel duration (Synthetic preview fixture; not computed by actual OSRM provider engine)',
  exposure_ready: false,
  cached: false,
  attribution: 'Demonstration corridor geometries (Synthetic fixture; not computed by actual OSRM provider engine)',
  limitations: [
    'Synthetic demo corridor geometry for interface preview only; not computed by live routing engine',
    'Traffic-aware routing and exposure scoring are unavailable'
  ],
  routes: [
    {
      id: 'route-osrm-1',
      distance_m: 18240,
      estimated_duration_s: 2520, // 42 min
      traffic_aware: false,
      exposure_status: 'unavailable',
      exposure: null,
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2197, 28.6328],
          [77.2410, 28.6290],
          [77.2750, 28.6285],
          [77.3100, 28.6240],
          [77.3649, 28.6280]
        ]
      }
    },
    {
      id: 'route-osrm-2',
      distance_m: 22400,
      estimated_duration_s: 2160, // 36 min
      traffic_aware: false,
      exposure_status: 'unavailable',
      exposure: null,
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2197, 28.6328],
          [77.2300, 28.5900],
          [77.2600, 28.5700],
          [77.3100, 28.5750],
          [77.3400, 28.6100],
          [77.3649, 28.6280]
        ]
      }
    }
  ]
};

export const DEMO_LOCATION_CONTEXT: LocationContext = {
  user_latitude: 28.6139,
  user_longitude: 77.2090,
  nearest_station: DEMO_STATIONS[0],
  distance_km: 1.84,
  in_bounds: true,
  bounds_limit_km: 50.0,
  boundary_message: null,
  ground_pollutants: {
    pm25: {
      pollutant: 'pm25',
      available: true,
      value: 147.0,
      unit: 'µg/m³',
      measured_at: '2026-11-24T10:00:00Z',
      source: 'DPCC - Delhi (Synthetic Demo)',
      quality_flags: ['synthetic_demo'],
      stale: false,
      averaging_period: '1-hour reading (not 24h official NAQI)'
    },
    pm10: {
      pollutant: 'pm10',
      available: true,
      value: 232.0,
      unit: 'µg/m³',
      measured_at: '2026-11-24T10:00:00Z',
      source: 'DPCC - Delhi (Synthetic Demo)',
      quality_flags: ['synthetic_demo'],
      stale: false,
      averaging_period: '1-hour reading (not 24h official NAQI)'
    },
    no2: {
      pollutant: 'no2',
      available: true,
      value: 48.5,
      unit: 'µg/m³',
      measured_at: '2026-11-24T10:00:00Z',
      source: 'DPCC - Delhi (Synthetic Demo)',
      quality_flags: ['synthetic_demo'],
      stale: false,
      averaging_period: '1-hour reading (not 24h official NAQI)'
    },
    so2: {
      pollutant: 'so2',
      available: true,
      value: 14.2,
      unit: 'µg/m³',
      measured_at: '2026-11-24T10:00:00Z',
      source: 'DPCC - Delhi (Synthetic Demo)',
      quality_flags: ['synthetic_demo'],
      stale: false,
      averaging_period: '1-hour reading (not 24h official NAQI)'
    },
    co: {
      pollutant: 'co',
      available: true,
      value: 1.8,
      unit: 'mg/m³',
      measured_at: '2026-11-24T10:00:00Z',
      source: 'DPCC - Delhi (Synthetic Demo)',
      quality_flags: ['synthetic_demo'],
      stale: false,
      averaging_period: '1-hour reading (not 24h official NAQI)'
    },
    o3: {
      pollutant: 'o3',
      available: false,
      value: null,
      unit: null,
      measured_at: null,
      source: null,
      quality_flags: [],
      stale: false,
      averaging_period: '1-hour reading'
    }
  },
  weather: {
    temperature_c: 24.5,
    relative_humidity_pct: 58.0,
    apparent_temperature_c: 25.2,
    wind_speed_kmh: 8.4,
    wind_direction_deg: 290,
    surface_pressure_hpa: 1012.4,
    precipitation_mm: 0.0,
    weather_code: 1,
    condition_description: 'Mainly clear',
    source_timestamp: '2026-11-24T10:00:00Z',
    source: 'Open-Meteo.com (ECMWF/GFS Gridded NWP)',
    estimate_type: 'gridded_numerical_weather_prediction',
    available: true,
    disclaimer: 'Gridded meteorological model estimate from numerical weather prediction (NWP); not a calibrated ground station observation.'
  }
};
