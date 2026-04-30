import { describe, it, expect } from 'vitest';
import { classifyColor, rgbToHsv } from './colorDetector';

describe('colorDetector', () => {
  describe('rgbToHsv', () => {
    it('should convert pure colors correctly', () => {
      // Red
      let hsv = rgbToHsv(255, 0, 0);
      expect(hsv.h).toBe(0);
      expect(hsv.s).toBe(1);
      expect(hsv.v).toBe(1);

      // Green
      hsv = rgbToHsv(0, 255, 0);
      expect(hsv.h).toBe(120);
      expect(hsv.s).toBe(1);
      expect(hsv.v).toBe(1);

      // Blue
      hsv = rgbToHsv(0, 0, 255);
      expect(hsv.h).toBe(240);
      expect(hsv.s).toBe(1);
      expect(hsv.v).toBe(1);
    });

    it('should handle grayscale colors', () => {
      // White
      let hsv = rgbToHsv(255, 255, 255);
      expect(hsv.s).toBe(0);
      expect(hsv.v).toBe(1);

      // Gray
      hsv = rgbToHsv(128, 128, 128);
      expect(hsv.s).toBe(0);
      expect(Math.round(hsv.v * 100)).toBe(50);
    });
  });

  describe('classifyColor', () => {
    it('should classify pure colors (U, R, F, D, L, B)', () => {
      expect(classifyColor(255, 255, 255)).toBe('U'); // White
      expect(classifyColor(255, 0, 0)).toBe('R');   // Red
      expect(classifyColor(0, 255, 0)).toBe('F');   // Green
      expect(classifyColor(255, 255, 0)).toBe('D'); // Yellow
      expect(classifyColor(255, 128, 0)).toBe('L'); // Orange
      expect(classifyColor(0, 0, 255)).toBe('B');   // Blue
    });

    it('should handle shaded and dim environments', () => {
      // Shaded White (Grayish)
      expect(classifyColor(150, 150, 150)).toBe('U');
      
      // Dark Red
      expect(classifyColor(100, 20, 20)).toBe('R');
      
      // Dark Blue
      expect(classifyColor(20, 20, 100)).toBe('B');
      
      // Dim Yellow
      expect(classifyColor(120, 120, 30)).toBe('D');
    });

    it('should distinguish Red from Orange at the boundary', () => {
      // Reddish Orange
      expect(classifyColor(255, 60, 0)).toBe('L');
      // Orangey Red
      expect(classifyColor(255, 30, 0)).toBe('R');
    });

    it('should handle white detection with color balance (robustness)', () => {
      // Pale yellow that should NOT be white
      expect(classifyColor(255, 255, 200)).toBe('D');
      
      // Slightly bluish white that SHOULD be white
      expect(classifyColor(240, 240, 255)).toBe('U');

      // Very dark gray that should be white (or handled as such for center matching)
      expect(classifyColor(60, 60, 60)).toBe('U');
    });

    it('should fallback Magenta/Purple to Red', () => {
      // Magenta
      expect(classifyColor(255, 0, 255)).toBe('R');
    });
  });
});
