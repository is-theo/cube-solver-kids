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
    it('should assign exactly 9 stickers for each color and protect centers', () => {
      // 54개의 빈 배열 생성
      const labs: Lab[] = new Array(54);
      
      // 센터 인덱스: 4(U), 13(R), 22(F), 31(D), 40(L), 49(B)
      const centerIndices = [4, 13, 22, 31, 40, 49];
      const centerLabs: Lab[] = [
        { L: 95, a: 0, b: 0 },    // U: White
        { L: 53, a: 80, b: 67 },  // R: Red
        { L: 88, a: -79, b: 81 }, // F: Green
        { L: 97, a: -12, b: 95 }, // D: Yellow
        { L: 67, a: 51, b: 82 },  // L: Orange
        { L: 45, a: -15, b: -55 }, // B: Blue
      ];
      
      centerIndices.forEach((idx, i) => {
        labs[idx] = centerLabs[i];
      });

      // 나머지 48칸 채우기
      // 의도적으로 모호한 데이터 생성: 빨강 10개(하나 더), 주황 8개(하나 부족)
      let redCount = 0;
      let orangeCount = 0;
      for (let i = 0; i < 54; i++) {
        if (labs[i]) continue; // 센터 패스

        if (redCount < 9) { // 센터 1개 포함 총 10개가 빨강에 가까움
          labs[i] = { L: 50, a: 75, b: 65 }; // Red-ish
          redCount++;
        } else if (orangeCount < 7) { // 센터 1개 포함 총 8개만 주황에 가까움
          labs[i] = { L: 65, a: 55, b: 75 }; // Orange-ish
          orangeCount++;
        } else if (i < 30) {
          labs[i] = { L: 88, a: -79, b: 81 }; // Green
        } else if (i < 38) {
          labs[i] = { L: 97, a: -12, b: 95 }; // Yellow
        } else if (i < 46) {
          labs[i] = { L: 45, a: -15, b: -55 }; // Blue
        } else {
          labs[i] = { L: 95, a: 0, b: 0 }; // White
        }
      }

      const result = solveColorAssignment(labs);
      
      // 1. 각 색상이 정확히 9개씩인지 확인
      const counts: Record<string, number> = {};
      result.forEach(c => {
        counts[c] = (counts[c] || 0) + 1;
      });
      
      expect(counts['U']).toBe(9);
      expect(counts['R']).toBe(9);
      expect(counts['F']).toBe(9);
      expect(counts['D']).toBe(9);
      expect(counts['L']).toBe(9);
      expect(counts['B']).toBe(9);

      // 2. 센터가 보호되었는지 확인
      expect(result[4]).toBe('U');
      expect(result[13]).toBe('R');
      expect(result[22]).toBe('F');
      expect(result[31]).toBe('D');
      expect(result[40]).toBe('L');
      expect(result[49]).toBe('B');
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
      const originalWindow = (globalThis as any).window;
      // @ts-ignore
      delete (globalThis as any).window;

      expect(loadCalibration()).toBeNull();
      // Should not throw
      saveCalibration({ references: {} });

      (globalThis as any).window = originalWindow;
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
