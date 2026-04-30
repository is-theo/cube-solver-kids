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
  R: '빨강',
  F: '초록',
  D: '노랑',
  L: '주황',
  B: '파랑',
};

export interface Lab {
  l: number;
  a: number;
  b: number;
}

export interface CalibrationData {
  references: Record<CubeColor, Lab>;
}

const STORAGE_KEY = 'rubiks_calibration';

export function saveCalibration(data: CalibrationData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadCalibration(): CalibrationData | null {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

/**
 * RGB to XYZ conversion
 */
function rgbToXyz(r: number, g: number, b: number): { x: number; y: number; z: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  r *= 100;
  g *= 100;
  b *= 100;

  // D65 illuminant
  const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = r * 0.0193 + g * 0.1192 + b * 0.9505;

  return { x, y, z };
}

/**
 * XYZ to Lab conversion
 */
export function xyzToLab(x: number, y: number, z: number): Lab {
  // D65
  x /= 95.047;
  y /= 100.0;
  z /= 108.883;

  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  return {
    l: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const { x, y, z } = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

/**
 * Delta E (CIE76) - 간단한 유클리드 거리
 */
export function deltaE(lab1: Lab, lab2: Lab): number {
  return Math.sqrt(
    Math.pow(lab1.l - lab2.l, 2) + Math.pow(lab1.a - lab2.a, 2) + Math.pow(lab1.b - lab2.b, 2)
  );
}

// 기본 참조값 (D65 기준 대략적인 Lab 값들)
const DEFAULT_REFERENCES: Record<CubeColor, Lab> = {
  U: { l: 95, a: 0, b: 0 },    // White
  R: { l: 45, a: 65, b: 45 },  // Red
  F: { l: 75, a: -65, b: 45 }, // Green
  D: { l: 85, a: 0, b: 85 },   // Yellow
  L: { l: 65, a: 45, b: 75 },  // Orange
  B: { l: 40, a: 0, b: -50 },  // Blue
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
    const dist = deltaE(currentLab, references[color]);
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
