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

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function saveCalibration(data: CalibrationData): boolean {
  if (!hasLocalStorage()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    // QuotaExceededError, SecurityError(private mode), etc.
    console.error('Failed to save calibration:', e);
    return false;
  }
}

export function loadCalibration(): CalibrationData | null {
  if (!hasLocalStorage()) return null;
  let saved: string | null;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load calibration:', e);
    return null;
  }
}

export function clearCalibration(): boolean {
  if (!hasLocalStorage()) return false;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
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
// sRGB 순수값보다 실제 무광/유광 스티커의 반사율과 측정된 평균치를 고려하여 조정됨.
// 사용자의 조명 환경에 따라 캘리브레이션을 통해 보정하는 것이 가장 정확합니다.
const DEFAULT_REFERENCES: Record<CubeColor, Lab> = {
  U: { L: 95, a: 0, b: 0 },      // White (흰색)
  R: { L: 53, a: 80, b: 67 },    // Red (빨간색)
  F: { L: 88, a: -79, b: 81 },   // Green (초록색)
  D: { L: 97, a: -12, b: 95 },   // Yellow (노란색)
  L: { L: 67, a: 51, b: 82 },    // Orange (주황색)
  B: { L: 45, a: -15, b: -55 },  // Blue (파란색)
};

export interface ClassificationResult {
  color: CubeColor;
  /** 가장 가까운 참조색까지의 ΔE2000 거리 */
  distance: number;
  bestDistance: number;
  secondDistance: number;
  /** 0..1, 1.0 means perfect match. (second - best) / second. */
  confidence: number;
}

/**
 * Lab 색공간 기반 분류 + 차순위까지 거리 산출.
 * confidence는 (2nd - best) / 2nd 로 정의 — 인접 색상과 얼마나 떨어져 있는지를 나타낸다.
 */
export function classifyColorWithConfidence(
  r: number,
  g: number,
  b: number,
  calibration?: CalibrationData,
): ClassificationResult {
  const currentLab = rgbToLab(r, g, b);
  const references: Record<CubeColor, Lab> = {
    ...DEFAULT_REFERENCES,
    ...(calibration?.references || {}),
  };

  let bestColor: CubeColor = 'U';
  let bestDistance = Infinity;
  let secondDistance = Infinity;

  (Object.keys(references) as CubeColor[]).forEach((color) => {
    const dist = deltaE(currentLab, references[color]);
    if (dist < bestDistance) {
      secondDistance = bestDistance;
      bestDistance = dist;
      bestColor = color;
    } else if (dist < secondDistance) {
      secondDistance = dist;
    }
  });

  const confidence =
    secondDistance > 0 && Number.isFinite(secondDistance)
      ? Math.max(0, Math.min(1, (secondDistance - bestDistance) / secondDistance))
      : 1;

  return {
    color: bestColor,
    distance: bestDistance,
    bestDistance,
    secondDistance,
    confidence,
  };
}

/**
 * Lab 색공간 기반 분류
 */
export function classifyColor(
  r: number,
  g: number,
  b: number,
  calibration?: CalibrationData,
): CubeColor {
  return classifyColorWithConfidence(r, g, b, calibration).color;
}

/**
 * 전역 최적화 분류 (Global Greedy Assignment).
 * 54개의 모든 칸이 수집되었을 때, 각 색상이 정확히 9개씩 할당되도록 최적화합니다.
 * 
 * @param allLabs 54개 칸의 Lab 값 배열 (U1..U9, R1..R9, F1..F9, D1..D9, L1..L9, B1..B9 순서)
 * @param calibration 캘리브레이션 데이터
 * @returns 최적화된 54개의 CubeColor 배열
 */
export function solveColorAssignment(
  allLabs: Lab[],
  calibration?: CalibrationData,
): CubeColor[] {
  const references: Record<CubeColor, Lab> = {
    ...DEFAULT_REFERENCES,
    ...(calibration?.references || {}),
  };
  const colorKeys = Object.keys(references) as CubeColor[];
  
  // 1. 모든 칸(54)과 모든 참조색(6) 사이의 모든 거리 계산
  interface DistanceNode {
    stickerIdx: number;
    color: CubeColor;
    dist: number;
  }
  const distances: DistanceNode[] = [];
  for (let i = 0; i < allLabs.length; i++) {
    for (const color of colorKeys) {
      distances.push({
        stickerIdx: i,
        color,
        dist: deltaE(allLabs[i], references[color]),
      });
    }
  }

  // 2. 거리가 짧은 순서대로 정렬 (Greedy)
  distances.sort((a, b) => a.dist - b.dist);

  // 3. 각 색상별 9개 제한을 지키며 할당
  const result = new Array<CubeColor | null>(allLabs.length).fill(null);
  const counts: Record<CubeColor, number> = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
  let assignedCount = 0;

  for (const node of distances) {
    if (assignedCount === allLabs.length) break;
    if (result[node.stickerIdx] === null && counts[node.color] < 9) {
      result[node.stickerIdx] = node.color;
      counts[node.color]++;
      assignedCount++;
    }
  }

  return result as CubeColor[];
}

export interface Point {
  x: number;
  y: number;
}

export interface CellResult {
  color: CubeColor;
  rgb: [number, number, number];
  lab: Lab;
  /** 0..1, 1.0이면 인접 색상과 거리가 멀어 매우 확신, 0.3 미만이면 불확실. */
  confidence: number;
  /** 가장 가까운 참조색까지의 ΔE2000 거리 */
  distance: number;
}

const SAMPLE_SIZE = 13; // 5 → 13: 169픽셀로 노이즈/스페큘러 하이라이트에 더 강건.

/**
 * 픽셀 배열에서 채널별 중앙값(median) 계산.
 * 평균보다 광택 반사(specular highlight)나 음영 픽셀에 둔감하다.
 */
function medianRgb(data: Uint8ClampedArray): [number, number, number] {
  const n = data.length / 4;
  const rs = new Array<number>(n);
  const gs = new Array<number>(n);
  const bs = new Array<number>(n);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    rs[p] = data[i];
    gs[p] = data[i + 1];
    bs[p] = data[i + 2];
  }
  rs.sort((a, b) => a - b);
  gs.sort((a, b) => a - b);
  bs.sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  return [rs[mid], gs[mid], bs[mid]];
}

/**
 * 4개의 코너 포인트를 기반으로 9칸의 색상 추출 (빌리니어 보간 + 중앙값 샘플링).
 *
 * 정확도 개선 포인트:
 * - 13×13 큰 샘플 영역으로 노이즈 평균화.
 * - 채널별 median으로 큐브 표면 광택 반사를 무시.
 * - 거리 차순위까지 산출해 confidence 제공.
 */
export function extract9Cells(
  ctx: CanvasRenderingContext2D,
  corners: [Point, Point, Point, Point], // TL, TR, BR, BL
  calibration?: CalibrationData,
): CellResult[] {
  const result: CellResult[] = [];

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

      const data = ctx.getImageData(
        Math.max(0, Math.floor(x - SAMPLE_SIZE / 2)),
        Math.max(0, Math.floor(y - SAMPLE_SIZE / 2)),
        SAMPLE_SIZE,
        SAMPLE_SIZE,
      ).data;

      const [medR, medG, medB] = medianRgb(data);
      const cls = classifyColorWithConfidence(medR, medG, medB, calibration);

      result.push({
        color: cls.color,
        rgb: [medR, medG, medB],
        lab: rgbToLab(medR, medG, medB),
        confidence: cls.confidence,
        distance: cls.distance,
      });
    }
  }
  return result;
}
