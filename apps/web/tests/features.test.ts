import { describe, it, expect } from 'vitest';
import { apiClient } from '../src/lib/api/client';
import { calculateSubIndex, getAQICategory } from '../src/lib/aqi';

describe('BreatheWise Features Verification & Scientific Integrity', () => {
  it('RULE 4: Honest capabilities expose continuous_hourly_trajectory as unsupported', async () => {
    apiClient.setDemoMode(true);
    const capsRes = await apiClient.getCapabilities();
    expect(capsRes.ok).toBe(true);
    if (capsRes.ok) {
      const caps = capsRes.data;
      expect(caps.continuous_hourly_trajectory.supported).toBe(false);
      expect(caps.continuous_hourly_trajectory.requirements_missing).toBeDefined();
      expect(caps.continuous_hourly_trajectory.requirements_missing?.length).toBeGreaterThan(0);
      expect(caps.continuous_hourly_trajectory.requirements_missing?.[0]).toContain('validated hourly forecast trajectory');
    }
  });

  it('RULE 4: Weather scenarios capability is unsupported and requires original pipeline source', async () => {
    apiClient.setDemoMode(true);
    const capsRes = await apiClient.getCapabilities();
    expect(capsRes.ok).toBe(true);
    if (capsRes.ok) {
      const caps = capsRes.data;
      expect(caps.weather_scenarios.supported).toBe(false);
      expect(caps.weather_scenarios.requirements_missing).toBeDefined();
      expect(caps.weather_scenarios.requirements_missing).toContain('dependent feature recomputation and parity verified');
    }
  });

  it('RULE 5: Does not calculate overall CPCB AQI from instantaneous PM2.5 (uses indicative sub-index)', () => {
    // 1h observation 180 µg/m³
    const subIndex = calculateSubIndex('pm25', 180);
    expect(subIndex).toBeGreaterThan(300);
    expect(subIndex).toBeLessThanOrEqual(400);

    const category = getAQICategory(subIndex);
    expect(category).toBe('Very Poor');

    // Values strictly adhere to CPCB breakpoint boundaries
    expect(calculateSubIndex('pm25', 30)).toBe(50);
    expect(calculateSubIndex('pm25', 60)).toBe(100);
    expect(calculateSubIndex('pm25', 90)).toBe(200);
    expect(calculateSubIndex('pm25', 120)).toBe(300);
    expect(calculateSubIndex('pm25', 250)).toBe(400);
  });

  it('RULE 5: Population coverage is honest and disclaims uniform safe-air boundaries', async () => {
    apiClient.setDemoMode(true);
    const capsRes = await apiClient.getCapabilities();
    expect(capsRes.ok).toBe(true);
    if (capsRes.ok) {
      const caps = capsRes.data;
      expect(caps.population_coverage.supported).toBe(false);
      expect(caps.population_coverage.requirements_missing).toBeDefined();
      expect(caps.population_coverage.requirements_missing).toContain('complete population raster and extraction provenance');
    }
  });

  it('RULE 5: Model audit reflects verified static findings and gates runtime evaluation', async () => {
    apiClient.setDemoMode(true);
    const capsRes = await apiClient.getCapabilities();
    expect(capsRes.ok).toBe(true);
    if (capsRes.ok) {
      const caps = capsRes.data;
      expect(caps.evaluation.supported).toBe(false);
      expect(caps.evaluation.requirements_missing).toContain('held-out predictions and chronological split dates');
    }
  });

  it('RULE 5: Health advisories cite WHO guidance and disclaim clinical review', async () => {
    apiClient.setDemoMode(true);
    const advRes = await apiClient.getAdvisories('pm25');
    expect(advRes.ok).toBe(true);
    if (advRes.ok) {
      expect(advRes.data.length).toBeGreaterThanOrEqual(1);
      for (const adv of advRes.data) {
        expect(adv.review_scope).toBe('engineering source review; no clinical review');
        expect(adv.limitations.some(l => l.includes('Educational population-level information'))).toBe(true);
      }
    }
  });

  it('Hotspots query truthfully returns 503 MODEL_UNAVAILABLE consistent with model_forecast=false', async () => {
    apiClient.setDemoMode(true);
    const hotspotsRes = await apiClient.getHotspots('delhi', 6, 0, 'pm25');
    expect(hotspotsRes.ok).toBe(false);
    if (!hotspotsRes.ok) {
      expect(hotspotsRes.status).toBe(503);
      expect(hotspotsRes.error.code).toBe('MODEL_UNAVAILABLE');
      expect(hotspotsRes.error.message).toContain('currently unavailable');
    }
  });
});
