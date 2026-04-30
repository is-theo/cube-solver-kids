import { describe, it, expect, beforeEach } from 'vitest';
import { classifyColor, rgbToLab, deltaE, saveCalibration, loadCalibration, type CalibrationData, type CubeColor, type Lab } from './colorDetector';

describe('colorDetector', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('rgbToLab', () => {
    it('should convert pure colors correctly to Lab', () => {
      // White
      const white = rgbToLab(255, 255, 255);
      expect(white.L).toBeGreaterThan(99); // More precise conversion in colorSpace.ts
      expect(Math.abs(white.a)).toBeLessThan(1);
      expect(Math.abs(white.b)).toBeLessThan(1);

      // Red
      const red = rgbToLab(255, 0, 0);
      expect(red.a).toBeGreaterThan(50);

      // Blue
      const blue = rgbToLab(0, 0, 255);
      expect(blue.b).toBeLessThan(-50);
    });
  });

  describe('deltaE', () => {
    it('should calculate distance correctly', () => {
      const lab1 = { L: 50, a: 0, b: 0 };
      const lab2 = { L: 60, a: 0, b: 0 };
      expect(deltaE(lab1, lab2)).toBeCloseTo(10);
    });
  });

  describe('classifyColor', () => {
    it('should classify basic colors using default references', () => {
      expect(classifyColor(255, 255, 255)).toBe('U'); // White
      expect(classifyColor(230, 50, 50)).toBe('R');   // Red-ish
      expect(classifyColor(0, 214, 160)).toBe('F');   // Green-ish
      expect(classifyColor(255, 214, 10)).toBe('D');  // Yellow-ish
      expect(classifyColor(255, 140, 66)).toBe('L');  // Orange-ish
      expect(classifyColor(0, 119, 182)).toBe('B');   // Blue-ish
    });

    it('should handle calibration data', () => {
      const customCalibration: CalibrationData = {
        references: {
          U: { L: 10, a: 0, b: 0 }, // Fake White (Dark)
          R: { L: 45, a: 65, b: 45 },
          F: { L: 75, a: -65, b: 45 },
          D: { L: 85, a: 0, b: 85 },
          L: { L: 65, a: 45, b: 75 },
          B: { L: 40, a: 0, b: -50 },
        }
      };
      
      // Even dark gray should be classified as U with this calibration
      expect(classifyColor(20, 20, 20, customCalibration)).toBe('U');
    });

    it('should fall back to default references for missing calibration keys', () => {
      // Only calibrate Red, others should use defaults
      const partialCalibration: CalibrationData = {
        references: {
          R: { L: 10, a: 0, b: 0 }, // Fake Red (Dark)
        } as unknown as Record<CubeColor, Lab>
      };
      
      // Red should use custom
      expect(classifyColor(20, 20, 20, partialCalibration as CalibrationData)).toBe('R');
      // White should still use default
      expect(classifyColor(255, 255, 255, partialCalibration as CalibrationData)).toBe('U');
    });
  });

  describe('storage', () => {
    it('should save and load calibration data', () => {
      const data: CalibrationData = {
        references: {
          U: { L: 100, a: 0, b: 0 },
          R: { L: 50, a: 50, b: 50 },
          F: { L: 50, a: -50, b: 50 },
          D: { L: 90, a: 0, b: 90 },
          L: { L: 60, a: 30, b: 60 },
          B: { L: 30, a: 0, b: -30 },
        }
      };
      
      saveCalibration(data);
      const loaded = loadCalibration();
      expect(loaded).toEqual(data);
    });

    it('should return null if no calibration is saved', () => {
      localStorage.clear();
      expect(loadCalibration()).toBeNull();
    });
  });
});
