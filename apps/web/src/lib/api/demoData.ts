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
  Advisory
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
