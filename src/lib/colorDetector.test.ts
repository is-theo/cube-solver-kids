import { describe, it, expect } from 'vitest';
import { classifyColor, rgbToLab, deltaE } from './colorDetector';

describe('colorDetector', () => {
  describe('rgbToLab', () => {
    it('should convert pure colors correctly to Lab', () => {
      // White
      const white = rgbToLab(255, 255, 255);
      expect(white.l).toBeGreaterThan(90);
      expect(Math.abs(white.a)).toBeLessThan(5);
      expect(Math.abs(white.b)).toBeLessThan(5);

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
      const lab1 = { l: 50, a: 0, b: 0 };
      const lab2 = { l: 60, a: 0, b: 0 };
      expect(deltaE(lab1, lab2)).toBe(10);
    });
  });

  describe('classifyColor', () => {
    it('should classify basic colors using default references', () => {
      expect(classifyColor(255, 255, 255)).toBe('U'); // White
      expect(classifyColor(255, 0, 0)).toBe('R');   // Red
      expect(classifyColor(0, 255, 0)).toBe('F');   // Green
      expect(classifyColor(255, 255, 0)).toBe('D'); // Yellow
      expect(classifyColor(255, 128, 0)).toBe('L'); // Orange
      expect(classifyColor(0, 0, 255)).toBe('B');   // Blue
    });

    it('should handle calibration data', () => {
      const customCalibration = {
        references: {
          U: { l: 10, a: 0, b: 0 }, // Fake White (Dark)
          R: { l: 45, a: 65, b: 45 },
          F: { l: 75, a: -65, b: 45 },
          D: { l: 85, a: 0, b: 85 },
          L: { l: 65, a: 45, b: 75 },
          B: { l: 40, a: 0, b: -50 },
        }
      };
      
      // Even dark gray should be classified as U with this calibration
      expect(classifyColor(20, 20, 20, customCalibration as any)).toBe('U');
    });
  });
});
