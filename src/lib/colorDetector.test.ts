import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  classifyColor,
  classifyColorWithConfidence,
  rgbToLab,
  deltaE,
  saveCalibration,
  loadCalibration,
  extract9Cells,
  solveColorAssignment,
  type CalibrationData,
  type Point,
} from './colorDetector';
import type { Lab } from './colorSpace';

describe('colorDetector', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.restoreAllMocks();
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
      expect(deltaE(lab1, lab2)).toBeGreaterThan(0);
    });
  });

  describe('classifyColor', () => {
    it('should classify basic colors using updated references', () => {
      expect(classifyColor(255, 255, 255)).toBe('U'); // White
      expect(classifyColor(200, 30, 40)).toBe('R');   // Red
      expect(classifyColor(40, 200, 100)).toBe('F');  // Green
      expect(classifyColor(240, 220, 20)).toBe('D');  // Yellow
      expect(classifyColor(255, 130, 40)).toBe('L');  // Orange
      expect(classifyColor(30, 80, 200)).toBe('B');   // Blue
    });

    it('should distinguish between Red and Orange accurately', () => {
      // Pure Red vs Pure Orange
      expect(classifyColor(255, 0, 0)).toBe('R');
      expect(classifyColor(255, 165, 0)).toBe('L');
      
      // Edge cases
      expect(classifyColor(255, 60, 0)).toBe('R');
      expect(classifyColor(255, 110, 0)).toBe('L');
    });

    it('should handle lighting variations (shadows and highlights)', () => {
      // Very dark grey (120, 120, 120) is close to White but should have lower confidence
      const result = classifyColorWithConfidence(120, 120, 120);
      expect(result.color).toBe('U');
      expect(result.confidence).toBeLessThan(0.7);

      // Bright yellow vs Pale yellow
      expect(classifyColor(255, 255, 0)).toBe('D');
      expect(classifyColor(200, 200, 100)).toBe('D');
    });

    it('should handle calibration data', () => {
      const customCalibration: CalibrationData = {
        references: {
          U: { L: 10, a: 0, b: 0 }, // Fake White (Dark)
        }
      };
      expect(classifyColor(20, 20, 20, customCalibration)).toBe('U');
    });
  });

  describe('classifyColorWithConfidence', () => {
    it('should return high confidence for clear matches', () => {
      const result = classifyColorWithConfidence(255, 255, 255);
      expect(result.color).toBe('U');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should return low confidence for ambiguous colors', () => {
      // Something between Red and Orange
      // Red: { L: 53, a: 80, b: 67 }
      // Orange: { L: 67, a: 51, b: 82 }
      const result = classifyColorWithConfidence(255, 100, 40); 
      expect(result.confidence).toBeLessThan(0.6);
    });
  });

  describe('solveColorAssignment', () => {
    it('should assign exactly 9 stickers for each color even with ambiguous input', () => {
      // Create 54 stickers: 10 "almost red", 8 "almost orange", and 36 others perfectly
      const labs: Lab[] = [];
      
      // 10 "almost red" (will try to compete for Red)
      for (let i = 0; i < 10; i++) labs.push({ L: 50, a: 70, b: 60 });
      // 8 "almost orange"
      for (let i = 0; i < 8; i++) labs.push({ L: 65, a: 50, b: 80 });
      
      // 9 Green
      for (let i = 0; i < 9; i++) labs.push({ L: 88, a: -79, b: 81 });
      // 9 Yellow
      for (let i = 0; i < 9; i++) labs.push({ L: 97, a: -12, b: 95 });
      // 9 Blue
      for (let i = 0; i < 9; i++) labs.push({ L: 45, a: -15, b: -55 });
      // 9 White
      for (let i = 0; i < 9; i++) labs.push({ L: 95, a: 0, b: 0 });

      const result = solveColorAssignment(labs);
      
      const counts: Record<string, number> = {};
      result.forEach(c => {
        counts[c] = (counts[c] || 0) + 1;
      });
      
      expect(counts['R']).toBe(9);
      expect(counts['L']).toBe(9);
      expect(counts['F']).toBe(9);
      expect(counts['D']).toBe(9);
      expect(counts['B']).toBe(9);
      expect(counts['U']).toBe(9);
    });
  });

  describe('extract9Cells', () => {
    it('should extract colors and confidence from 9 different regions', () => {
      // Mock getImageData to return different colors based on coordinates
      const mockCtx = {
        getImageData: vi.fn((x, y) => {
          // Return White for top row, Red for middle, Blue for bottom
          let r = 0, g = 0, b = 0;
          if (y < 100) { r = 255; g = 255; b = 255; }
          else if (y < 200) { r = 255; g = 0; b = 0; }
          else { r = 0; g = 0; b = 255; }
          
          const data = new Uint8ClampedArray(100); // 5x5 * 4
          for (let i = 0; i < data.length; i += 4) {
            data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = 255;
          }
          return { data };
        })
      } as unknown as CanvasRenderingContext2D;

      const corners: [Point, Point, Point, Point] = [
        { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }
      ];

      const results = extract9Cells(mockCtx, corners);
      expect(results).toHaveLength(9);
      expect(results[0]).toHaveProperty('confidence');
      expect(results[0]).toHaveProperty('distance');
      
      // Top row (index 0,1,2) should be U (White)
      expect(results[0].color).toBe('U');
      expect(results[1].color).toBe('U');
      expect(results[2].color).toBe('U');
      
      // Middle row (index 3,4,5) should be R (Red)
      expect(results[3].color).toBe('R');
      expect(results[4].color).toBe('R');
      expect(results[5].color).toBe('R');
      
      // Bottom row (index 6,7,8) should be B (Blue)
      expect(results[6].color).toBe('B');
      expect(results[7].color).toBe('B');
      expect(results[8].color).toBe('B');
    });
  });

  describe('storage and error handling', () => {
    it('should save and load calibration data', () => {
      const data: CalibrationData = {
        references: { U: { L: 100, a: 0, b: 0 } }
      };
      saveCalibration(data);
      expect(loadCalibration()).toEqual(data);
    });

    it('should handle localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockSetItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Quota exceeded');
      });

      saveCalibration({ references: {} });
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save calibration:', expect.any(Error));
      
      mockSetItem.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should handle SSR (no window)', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      expect(loadCalibration()).toBeNull();
      // Should not throw
      saveCalibration({ references: {} });

      global.window = originalWindow;
    });

    it('should handle corrupted calibration data', () => {
      localStorage.setItem('rubiks_calibration', 'invalid-json{');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(loadCalibration()).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load calibration:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});
