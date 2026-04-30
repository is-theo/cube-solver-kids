import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  classifyColor,
  rgbToLab,
  deltaE,
  saveCalibration,
  loadCalibration,
  extract9Cells,
  type CalibrationData,
  type Point,
} from './colorDetector';

describe('colorDetector', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('rgbToLab', () => {
    it('should convert pure colors correctly to Lab', () => {
      // White: D65 (95.047, 100, 108.883) -> Lab (100, 0, 0)
      const white = rgbToLab(255, 255, 255);
      expect(white.L).toBeGreaterThan(99.9);
      expect(Math.abs(white.a)).toBeLessThan(0.1);
      expect(Math.abs(white.b)).toBeLessThan(0.1);

      // Red: rgb(255, 0, 0) -> Lab(53.24, 80.09, 67.20)
      const red = rgbToLab(255, 0, 0);
      expect(red.L).toBeCloseTo(53.24, 1);
      expect(red.a).toBeCloseTo(80.09, 1);
      expect(red.b).toBeCloseTo(67.20, 1);
    });
  });

  describe('deltaE', () => {
    it('should calculate distance correctly', () => {
      const lab1 = { L: 50, a: 0, b: 0 };
      const lab2 = { L: 60, a: 0, b: 0 };
      // For pure L difference, deltaE2000 is similar to CIE76 but not identical due to weighting
      expect(deltaE(lab1, lab2)).toBeGreaterThan(0);
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

    it('should distinguish between Red and Orange even when colors are similar', () => {
      // Standard Red: (255, 0, 0), Standard Orange: (255, 165, 0)
      const reddishOrange = [255, 80, 0]; // Closer to red or orange?
      // In Lab, this should be closer to our Orange or Red reference
      // Let's test the boundary
      expect(classifyColor(255, 40, 0)).toBe('R');
      expect(classifyColor(255, 120, 0)).toBe('L');
    });

    it('should distinguish between White and Yellow in different lighting', () => {
      // Dim white can look like bright yellow in RGB, but Lab L channel helps
      const dimWhite = [180, 180, 180];
      const brightYellow = [255, 255, 100];
      
      expect(classifyColor(dimWhite[0], dimWhite[1], dimWhite[2])).toBe('U');
      expect(classifyColor(brightYellow[0], brightYellow[1], brightYellow[2])).toBe('D');
    });

    it('should handle very dark colors (shadows) gracefully', () => {
      // Very dark blue
      expect(classifyColor(10, 10, 50)).toBe('B');
      // Very dark red
      expect(classifyColor(50, 10, 10)).toBe('R');
    });

    it('should handle calibration data', () => {
      const customCalibration: CalibrationData = {
        references: {
          U: { L: 10, a: 0, b: 0 }, // Fake White (Dark)
        }
      };

      // Even dark gray should be classified as U with this calibration
      expect(classifyColor(20, 20, 20, customCalibration)).toBe('U');
    });

    it('should fall back to default references for missing calibration keys', () => {
      const partialCalibration: CalibrationData = {
        references: {
          R: { L: 10, a: 0, b: 0 }, // Fake Red (Dark)
        }
      };

      // Red should use custom
      expect(classifyColor(20, 20, 20, partialCalibration)).toBe('R');
      // White should still use default
      expect(classifyColor(255, 255, 255, partialCalibration)).toBe('U');
    });
  });

  describe('extract9Cells', () => {
    it('should extract 9 cells using bilinear interpolation', () => {
      const mockCtx = {
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]) // 2 pixels of white
        })
      } as unknown as CanvasRenderingContext2D;

      const corners: [Point, Point, Point, Point] = [
        { x: 0, y: 0 },   // TL
        { x: 300, y: 0 }, // TR
        { x: 300, y: 300 }, // BR
        { x: 0, y: 300 }  // BL
      ];

      const results = extract9Cells(mockCtx, corners);
      expect(results).toHaveLength(9);
      expect(mockCtx.getImageData).toHaveBeenCalledTimes(9);

      // Check if sampling points are roughly where we expect
      // Middle cell (1,1) should be around (150, 150)
      const callArgs = (mockCtx.getImageData as any).mock.calls[4]; // 5th call is (1,1)
      expect(callArgs[0]).toBe(147);
      expect(callArgs[1]).toBe(147);
    });
  });

  describe('storage', () => {
    it('should save and load calibration data', () => {
      const data: CalibrationData = {
        references: {
          U: { L: 100, a: 0, b: 0 },
          R: { L: 50, a: 50, b: 50 },
        }
      };

      saveCalibration(data);
      const loaded = loadCalibration();
      expect(loaded).toEqual(data);
    });
  });
});
