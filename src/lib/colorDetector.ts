import { Lab, rgbToLab, deltaE2000 } from './colorSpace';

// 큐브 색상 6가지 (cubejs 표준 표기)
export type CubeColor = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
// U=White(위), R=Red(오), F=Green(앞), D=Yellow(아래), L=Orange(왼), B=Blue(뒤)

export const COLOR_HEX: Record<CubeColor, string> = {
  U: '#ffffff', // White
  R: '#e63946', // Red
  F: '#06d6a0', // Green
  D: '#ffd60a', // Yellow
  L: '#ff8c42', // Orange
  B: '#0077b6', // Blue
};

export const COLOR_NAME_KR: Record<CubeColor, string> = {
  U: '흰색',
  R: '빨간색',
  F: '초록색',
  D: '노란색',
  L: '주황색',
  B: '파란색',
};

export type { Lab };
export { rgbToLab };

export interface CalibrationData {
  references: Partial<Record<CubeColor, Lab>>;
}

const STORAGE_KEY = 'rubiks_calibration';

export function saveCalibration(data: CalibrationData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save calibration:', e);
  }
}

export function loadCalibration(): CalibrationData | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load calibration:', e);
    return null;
  }
}

/**
 * Delta E (CIEDE2000) - colorSpace.ts의 deltaE2000 재사용
 * 주황(L)/빨강(R) 같은 인접 색상 구분 정확도가 deltaE76보다 높음.
 */
export function deltaE(lab1: Lab, lab2: Lab): number {
  return deltaE2000(lab1, lab2);
}

// 기본 참조값 (D65 기준 큐브 스티커의 일반적인 Lab 값)
// sRGB 순수값보다 실제 무광/유광 스티커의 반사율을 고려하여 조정됨
const DEFAULT_REFERENCES: Record<CubeColor, Lab> = {
  U: { L: 95, a: 0, b: 0 },      // White (흰색)
  R: { L: 53, a: 80, b: 67 },    // Red (빨간색)
  F: { L: 88, a: -79, b: 81 },   // Green (초록색)
  D: { L: 97, a: -12, b: 95 },   // Yellow (노란색)
  L: { L: 67, a: 51, b: 82 },    // Orange (주황색)
  B: { L: 45, a: -15, b: -55 },  // Blue (파란색)
};

/**
 * Lab 색공간 기반 분류
 */
export function classifyColor(r: number, g: number, b: number, calibration?: CalibrationData): CubeColor {
  const currentLab = rgbToLab(r, g, b);
  const references = { ...DEFAULT_REFERENCES, ...(calibration?.references || {}) };

  let minDistance = Infinity;
  let closest: CubeColor = 'U';

  (Object.keys(references) as CubeColor[]).forEach((color) => {
    const dist = deltaE(currentLab, references[color]!);
    if (dist < minDistance) {
      minDistance = dist;
      closest = color;
    }
  });

  return closest;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * 4개의 코너 포인트를 기반으로 9칸의 색상 추출 (빌리니어 보간)
 */
export function extract9Cells(
  ctx: CanvasRenderingContext2D,
  corners: [Point, Point, Point, Point], // TL, TR, BR, BL
  calibration?: CalibrationData
): { color: CubeColor; rgb: [number, number, number]; lab: Lab }[] {
  const result: { color: CubeColor; rgb: [number, number, number]; lab: Lab }[] = [];

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      // 셀의 중심 좌표 계산 (0.16, 0.5, 0.83 영역)
      const u = (col + 0.5) / 3;
      const v = (row + 0.5) / 3;

      // Bilinear interpolation
      const x =
        (1 - u) * (1 - v) * corners[0].x +
        u * (1 - v) * corners[1].x +
        u * v * corners[2].x +
        (1 - u) * v * corners[3].x;
      const y =
        (1 - u) * (1 - v) * corners[0].y +
        u * (1 - v) * corners[1].y +
        u * v * corners[2].y +
        (1 - u) * v * corners[3].y;

      const sampleSize = 5;
      const data = ctx.getImageData(
        Math.floor(x - sampleSize / 2),
        Math.floor(y - sampleSize / 2),
        sampleSize,
        sampleSize
      ).data;

      let r = 0, g = 0, b = 0;
      const pixelCount = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      const avgR = r / pixelCount;
      const avgG = g / pixelCount;
      const avgB = b / pixelCount;

      result.push({
        color: classifyColor(avgR, avgG, avgB, calibration),
        rgb: [Math.round(avgR), Math.round(avgG), Math.round(avgB)],
        lab: rgbToLab(avgR, avgG, avgB),
      });
    }
  }
  return result;
}
