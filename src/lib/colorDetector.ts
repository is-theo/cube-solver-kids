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

interface HSV {
  h: number; // 0-360
  s: number; // 0-1
  v: number; // 0-1
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, v };
}

/**
 * RGB → 큐브 색상 분류
 * 조명 변화에 어느 정도 강건하도록 HSV + 휴리스틱 사용
 */
export function classifyColor(r: number, g: number, b: number): CubeColor {
  const { h, s, v } = rgbToHsv(r, g, b);

  // 1. 흰색: 채도 낮고 밝음
  if (s < 0.25 && v > 0.55) return 'U';

  // 2. 어두운 픽셀(채도 낮고 어두움) — 파랑으로 폴백 (검정 큐브 테두리 잘못 잡힐 때 대비)
  if (v < 0.25) return 'B';

  // 3. 색상별 Hue 범위
  // 빨강: 345-360 또는 0-10
  if (h >= 345 || h < 10) return 'R';
  // 주황: 10-40
  if (h >= 10 && h < 40) return 'L';
  // 노랑: 40-70
  if (h >= 40 && h < 70) return 'D';
  // 초록: 70-170
  if (h >= 70 && h < 170) return 'F';
  // 파랑: 170-260
  if (h >= 170 && h < 260) return 'B';
  // 자주/마젠타 영역 → 빨강으로 폴백
  return 'R';
}

/**
 * Canvas의 9칸에서 색상 추출
 * (x, y)는 그리드 좌상단, size는 한 변 길이(px)
 * 각 셀 중앙의 작은 영역 평균을 내서 노이즈 감소
 */
export function extract9Cells(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): CubeColor[] {
  const cellSize = size / 3;
  const sampleSize = Math.max(8, Math.floor(cellSize * 0.3)); // 셀의 30% 영역 샘플
  const colors: CubeColor[] = [];

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = Math.floor(x + col * cellSize + cellSize / 2 - sampleSize / 2);
      const cy = Math.floor(y + row * cellSize + cellSize / 2 - sampleSize / 2);
      const data = ctx.getImageData(cx, cy, sampleSize, sampleSize).data;

      let r = 0,
        g = 0,
        b = 0;
      const pixelCount = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      colors.push(classifyColor(r / pixelCount, g / pixelCount, b / pixelCount));
    }
  }
  return colors;
}

/**
 * 9개 색상의 RGB 평균값도 함께 (UI 표시용)
 */
export function extract9CellsWithRgb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): { color: CubeColor; rgb: [number, number, number] }[] {
  const cellSize = size / 3;
  const sampleSize = Math.max(8, Math.floor(cellSize * 0.3));
  const result: { color: CubeColor; rgb: [number, number, number] }[] = [];

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = Math.floor(x + col * cellSize + cellSize / 2 - sampleSize / 2);
      const cy = Math.floor(y + row * cellSize + cellSize / 2 - sampleSize / 2);
      const data = ctx.getImageData(cx, cy, sampleSize, sampleSize).data;

      let r = 0,
        g = 0,
        b = 0;
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
        color: classifyColor(avgR, avgG, avgB),
        rgb: [Math.round(avgR), Math.round(avgG), Math.round(avgB)],
      });
    }
  }
  return result;
}
