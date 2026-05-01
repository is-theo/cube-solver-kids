import { describe, it, expect } from 'vitest';
import { rgbToLab, deltaE2000 } from './colorSpace';

describe('colorSpace', () => {
  describe('rgbToLab', () => {
    it('should convert White correctly', () => {
      const lab = rgbToLab(255, 255, 255);
      expect(lab.L).toBeGreaterThan(99.9);
      expect(Math.abs(lab.a)).toBeLessThan(0.1);
      expect(Math.abs(lab.b)).toBeLessThan(0.1);
    });

    it('should convert Black correctly', () => {
      const lab = rgbToLab(0, 0, 0);
      expect(lab.L).toBe(0);
      expect(lab.a).toBe(0);
      expect(lab.b).toBe(0);
    });

    it('should convert Red correctly', () => {
      const lab = rgbToLab(255, 0, 0);
      // Expected Lab for sRGB(255, 0, 0) is approx (53.24, 80.09, 67.20)
      expect(lab.L).toBeCloseTo(53.24, 1);
      expect(lab.a).toBeCloseTo(80.09, 1);
      expect(lab.b).toBeCloseTo(67.20, 1);
    });
  });

  describe('deltaE2000', () => {
    // Reference pairs from Sharma, Wu, Dalal (2005)
    // Table 1, entries 1-3
    it('should match standard reference pair #1', () => {
      const lab1 = { L: 50.0, a: 2.6772, b: -79.7751 };
      const lab2 = { L: 50.0, a: 0.0, b: -82.7485 };
      expect(deltaE2000(lab1, lab2)).toBeCloseTo(2.0425, 4);
    });

    it('should match standard reference pair #2', () => {
      const lab1 = { L: 50.0, a: 3.1571, b: -77.2803 };
      const lab2 = { L: 50.0, a: 0.0, b: -82.7485 };
      expect(deltaE2000(lab1, lab2)).toBeCloseTo(2.8615, 4);
    });

    it('should match standard reference pair #3', () => {
      const lab1 = { L: 50.0, a: 2.8361, b: -74.0200 };
      const lab2 = { L: 50.0, a: 0.0, b: -82.7485 };
      expect(deltaE2000(lab1, lab2)).toBeCloseTo(3.4412, 4);
    });

    it('should respect kL parameter', () => {
      const lab1 = { L: 50, a: 0, b: 0 };
      const lab2 = { L: 60, a: 0, b: 0 };
      const de1 = deltaE2000(lab1, lab2, 1, 1, 1);
      const de2 = deltaE2000(lab1, lab2, 2, 1, 1);
      expect(de2).toBeCloseTo(de1 / 2, 4);
    });
  });
});
