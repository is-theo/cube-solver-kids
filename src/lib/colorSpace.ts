// CIE Lab 색공간 변환 유틸리티
// sRGB(D65) → 선형 RGB → XYZ → Lab

export interface Lab {
  L: number; // 0-100
  a: number; // ~-128..127
  b: number; // ~-128..127
}

const D65 = { x: 0.95047, y: 1.0, z: 1.08883 };

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function labF(t: number): number {
  return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175;
  const z = lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041;

  const fx = labF(x / D65.x);
  const fy = labF(y / D65.y);
  const fz = labF(z / D65.z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * CIE76 Delta E (단순 유클리디안). 빠르고 큐브 6색 분리에는 충분히 정확.
 */
export function deltaE76(a: Lab, b: Lab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Lab 평균. 동일 색을 여러 샘플에서 평균낼 때 사용.
 */
export function averageLab(samples: Lab[]): Lab {
  if (samples.length === 0) return { L: 0, a: 0, b: 0 };
  let L = 0;
  let a = 0;
  let b = 0;
  for (const s of samples) {
    L += s.L;
    a += s.a;
    b += s.b;
  }
  const n = samples.length;
  return { L: L / n, a: a / n, b: b / n };
}
