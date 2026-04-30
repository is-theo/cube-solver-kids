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

    // Pure Orange
    expect(classifyColor(255, 165, 0)).toBe('L');
  });

  it('should handle shaded and realistic colors', () => {
    // Shaded White
    expect(classifyColor(180, 180, 180)).toBe('U');
    
    // Shaded Red (darker)
    expect(classifyColor(150, 20, 20)).toBe('R');
    
    // Shaded Orange
    expect(classifyColor(200, 100, 20)).toBe('L');

    // Shaded Yellow
    expect(classifyColor(180, 180, 30)).toBe('D');

    // Shaded Blue
    expect(classifyColor(30, 30, 150)).toBe('B');

    // Shaded Green
    expect(classifyColor(30, 150, 30)).toBe('F');
  });

  it('should distinguish between Red and Orange', () => {
    // Very reddish orange
    expect(classifyColor(255, 69, 0)).toBe('L'); // Orange-Red
    // Very orangey red
    expect(classifyColor(255, 30, 0)).toBe('R'); 
  });
});
