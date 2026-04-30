// CIE Lab 색공간 변환 + Delta E 거리
// sRGB → Linear sRGB → XYZ (D65) → Lab

export interface Lab {
  L: number;
  a: number;
  b: number;
}

// D65 참조 백색점 (XYZ, Y=100 정규화)
const Xn = 95.047;
const Yn = 100.0;
const Zn = 108.883;

// sRGB 채널 (0-255) → Linear sRGB (0-1)
function srgbToLinear(c: number): number {
  const v = c / 255;
  return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
}

// CIE Lab의 비선형 함수
function fLab(t: number): number {
  const delta = 6 / 29;
  return t > delta * delta * delta
    ? Math.cbrt(t)
    : t / (3 * delta * delta) + 4 / 29;
}

/**
 * sRGB (0-255) → CIE Lab (D65)
 */
export function rgbToLab(r: number, g: number, b: number): Lab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  // Linear sRGB → XYZ (D65), Y in [0,100]
  const X = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) * 100;
  const Y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175) * 100;
  const Z = (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) * 100;

  const fx = fLab(X / Xn);
  const fy = fLab(Y / Yn);
  const fz = fLab(Z / Zn);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * Delta E (CIE76): 두 Lab 색의 유클리드 거리
 */
export function deltaE76(lab1: Lab, lab2: Lab): number {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Delta E (CIEDE2000): 인지적 색차에 더 가까운 거리.
 * 빨강/주황 같이 인접한 색을 구별할 때 76보다 정확.
 * 참고: Sharma, Wu, Dalal (2005)
 */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const avgL = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;

  const G =
    0.5 *
    (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  const avgCp = (C1p + C2p) / 2;

  const h1p = hueAngle(b1, a1p);
  const h2p = hueAngle(b2, a2p);

  let avgHp: number;
  if (Math.abs(h1p - h2p) > 180) {
    avgHp = (h1p + h2p + 360) / 2;
  } else {
    avgHp = (h1p + h2p) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(deg2rad(avgHp - 30)) +
    0.24 * Math.cos(deg2rad(2 * avgHp)) +
    0.32 * Math.cos(deg2rad(3 * avgHp + 6)) -
    0.2 * Math.cos(deg2rad(4 * avgHp - 63));

  let deltaHp = h2p - h1p;
  if (Math.abs(deltaHp) > 180) {
    deltaHp += deltaHp > 0 ? -360 : 360;
  }

  const deltaLp = L2 - L1;
  const deltaCp = C2p - C1p;
  const deltaHpFinal =
    2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(deltaHp / 2));

  const SL =
    1 +
    (0.015 * Math.pow(avgL - 50, 2)) /
      Math.sqrt(20 + Math.pow(avgL - 50, 2));
  const SC = 1 + 0.045 * avgCp;
  const SH = 1 + 0.015 * avgCp * T;

  const deltaTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
  const RC =
    2 *
    Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
  const RT = -RC * Math.sin(deg2rad(2 * deltaTheta));

  return Math.sqrt(
    Math.pow(deltaLp / SL, 2) +
      Math.pow(deltaCp / SC, 2) +
      Math.pow(deltaHpFinal / SH, 2) +
      RT * (deltaCp / SC) * (deltaHpFinal / SH)
  );
}

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

function hueAngle(b: number, ap: number): number {
  if (b === 0 && ap === 0) return 0;
  const angle = (Math.atan2(b, ap) * 180) / Math.PI;
  return angle >= 0 ? angle : angle + 360;
}
