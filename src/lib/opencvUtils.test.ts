import { describe, it, expect, vi } from 'vitest';
import { detectCubeOutline, isOpenCVReady } from './opencvUtils';

describe('opencvUtils', () => {
  it('isOpenCVReady returns true when cv is on window', () => {
    (window as any).cv = { Mat: {} };
    expect(isOpenCVReady()).toBe(true);
    delete (window as any).cv;
    expect(isOpenCVReady()).toBe(false);
  });

  it('detectCubeOutline returns null if cv is not ready', () => {
    const canvas = document.createElement('canvas');
    expect(detectCubeOutline(canvas)).toBeNull();
  });

  it('detectCubeOutline attempts to find contours if cv is ready', () => {
    const mockMat = {
      delete: vi.fn(),
      rows: 0,
      data32S: [],
    };
    
    const mockCv = {
      Mat: vi.fn(() => mockMat),
      imread: vi.fn(() => mockMat),
      cvtColor: vi.fn(),
      GaussianBlur: vi.fn(),
      Canny: vi.fn(),
      findContours: vi.fn(),
      contourArea: vi.fn(() => 10000),
      arcLength: vi.fn(() => 400),
      approxPolyDP: vi.fn((cnt, approx) => {
        approx.rows = 4;
        approx.data32S = [10, 10, 100, 10, 100, 100, 10, 100];
      }),
      MatVector: vi.fn(() => ({
        size: () => 1,
        get: () => mockMat,
        delete: vi.fn(),
      })),
      RETR_EXTERNAL: 0,
      CHAIN_APPROX_SIMPLE: 1,
      COLOR_RGBA2GRAY: 2,
      Size: vi.fn(),
    };

    (window as any).cv = mockCv;

    const canvas = document.createElement('canvas');
    const result = detectCubeOutline(canvas);

    expect(result).not.toBeNull();
    if (result) {
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ x: 10, y: 10 });
    }

    delete (window as any).cv;
  });
});
