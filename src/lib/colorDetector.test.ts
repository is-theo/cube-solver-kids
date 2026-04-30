import { describe, it, expect } from 'vitest';
import { classifyColor, rgbToHsv } from './colorDetector';

describe('colorDetector', () => {
  it('should convert RGB to HSV correctly', () => {
    // Red
    let hsv = rgbToHsv(255, 0, 0);
    expect(hsv.h).toBe(0);
    expect(hsv.s).toBe(1);
    expect(hsv.v).toBe(1);

    // White
    hsv = rgbToHsv(255, 255, 255);
    expect(hsv.s).toBe(0);
    expect(hsv.v).toBe(1);
  });

  it('should classify colors correctly', () => {
    // Pure White
    expect(classifyColor(255, 255, 255)).toBe('U');
    
    // Pure Red
    expect(classifyColor(255, 0, 0)).toBe('R');
    
    // Pure Green
    expect(classifyColor(0, 255, 0)).toBe('F');
    
    // Pure Yellow
    expect(classifyColor(255, 255, 0)).toBe('D');
    
    // Pure Blue
    expect(classifyColor(0, 0, 255)).toBe('B');

    // Orange-ish
    expect(classifyColor(255, 165, 0)).toBe('L');
  });

  it('should handle slightly shaded white', () => {
    // Slightly grey/shaded white
    expect(classifyColor(200, 200, 200)).toBe('U');
  });
});
