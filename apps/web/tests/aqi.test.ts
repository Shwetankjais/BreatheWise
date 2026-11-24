import { describe, it, expect } from 'vitest';
import {
  calculateSubIndex,
  getAQICategory,
  formatToIST,
  CPCB_BREAKPOINTS
} from '../src/lib/aqi';

describe('CPCB NAQI Calculation and Standards', () => {
  it('correctly calculates PM2.5 sub-index at breakpoint boundaries', () => {
    // 0-30 -> Good (0-50)
    expect(calculateSubIndex('pm25', 15)).toBe(25);
    expect(calculateSubIndex('pm25', 30)).toBe(50);

    // 30-60 -> Satisfactory (50-100)
    expect(calculateSubIndex('pm25', 60)).toBe(100);

    // 60-90 -> Moderate (100-200)
    expect(calculateSubIndex('pm25', 90)).toBe(200);

    // 90-120 -> Poor (200-300)
    expect(calculateSubIndex('pm25', 120)).toBe(300);

    // 120-250 -> Very Poor (300-400)
    expect(calculateSubIndex('pm25', 250)).toBe(400);

    // 250-500 -> Severe (400-500)
    expect(calculateSubIndex('pm25', 375)).toBe(450);
    expect(calculateSubIndex('pm25', 500)).toBe(500);
  });

  it('correctly interpolates fractional concentration values without returning 0', () => {
    // Fractional 30.5 falls in 30-60 band -> between 50 and 100
    const subIndex30_5 = calculateSubIndex('pm25', 30.5);
    expect(subIndex30_5).toBeGreaterThan(50);
    expect(subIndex30_5).toBeLessThanOrEqual(52);

    // Fractional 90.5 falls in 90-120 band -> between 200 and 300
    const subIndex90_5 = calculateSubIndex('pm25', 90.5);
    expect(subIndex90_5).toBeGreaterThan(200);
    expect(subIndex90_5).toBeLessThanOrEqual(205);

    // Fractional 61.5 falls in 60-90 band
    const subIndex61_5 = calculateSubIndex('pm25', 61.5);
    expect(subIndex61_5).toBeGreaterThan(100);
    expect(subIndex61_5).toBeLessThan(110);
  });

  it('correctly evaluates CO in canonical µg/m³ units', () => {
    // 0 - 1000 µg/m³ (0 - 1.0 mg/m³) -> Good (0-50)
    expect(calculateSubIndex('co', 500)).toBe(25);
    expect(calculateSubIndex('co', 1000)).toBe(50);

    // 1000 - 2000 µg/m³ (1.0 - 2.0 mg/m³) -> Satisfactory (50-100)
    expect(calculateSubIndex('co', 1500)).toBe(75);
    expect(calculateSubIndex('co', 2000)).toBe(100);

    // 2000 - 10000 µg/m³ (2.0 - 10.0 mg/m³) -> Moderate (100-200)
    expect(calculateSubIndex('co', 6000)).toBe(150);
    expect(calculateSubIndex('co', 10000)).toBe(200);
  });

  it('correctly maps numeric AQI to official CPCB categories', () => {
    expect(getAQICategory(35)).toBe('Good');
    expect(getAQICategory(75)).toBe('Satisfactory');
    expect(getAQICategory(150)).toBe('Moderate');
    expect(getAQICategory(250)).toBe('Poor');
    expect(getAQICategory(350)).toBe('Very Poor');
    expect(getAQICategory(450)).toBe('Severe');
    expect(getAQICategory(500)).toBe('Severe');
  });

  it('formats UTC ISO timestamp to labeled Indian Standard Time (+05:30)', () => {
    const utcTime = '2026-11-23T18:30:00Z';
    const istString = formatToIST(utcTime);
    expect(istString).toContain('IST');
    // 18:30 UTC + 5:30 = 00:00 next day (24 Nov)
    expect(istString).toContain('24');
  });
});
