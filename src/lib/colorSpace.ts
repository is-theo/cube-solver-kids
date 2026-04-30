export interface Lab {
  L: number;
  a: number;
  b: number;
}

/**
 * RGB to Lab color space conversion
 * Assumes sRGB input [0, 255]
 */
export function rgbToLab(r: number, g: number, b: number): Lab {
  // 1. Normalize RGB to [0, 1]
  let rN = r / 255;
  let gN = g / 255;
  let bN = b / 255;

  // 2. sRGB to linear RGB (Gamma correction)
  rN = rN > 0.04045 ? Math.pow((rN + 0.055) / 1.055, 2.4) : rN / 12.92;
  gN = gN > 0.04045 ? Math.pow((gN + 0.055) / 1.055, 2.4) : gN / 12.92;
  bN = bN > 0.04045 ? Math.pow((bN + 0.055) / 1.055, 2.4) : bN / 12.92;

  rN *= 100;
  gN *= 100;
  bN *= 100;

  // 3. Linear RGB to XYZ (D65 illuminant)
  // Observer. = 2°, Illuminant = D65
  const x = rN * 0.4124 + gN * 0.3576 + bN * 0.1805;
  const y = rN * 0.2126 + gN * 0.7152 + bN * 0.0722;
  const z = rN * 0.0193 + gN * 0.1192 + bN * 0.9505;

  // 4. XYZ to Lab
  // D65 reference white
  const xW = 95.047;
  const yW = 100.0;
  const zW = 108.883;

  let xN = x / xW;
  let yN = y / yW;
  let zN = z / zW;

  const f = (t: number) => (t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116);

  xN = f(xN);
  yN = f(yN);
  zN = f(zN);

  return {
    L: 116 * yN - 16,
    a: 500 * (xN - yN),
    b: 200 * (yN - zN),
  };
}

/**
 * CIE76 color difference (Euclidean distance in Lab)
 */
export function deltaE76(lab1: Lab, lab2: Lab): number {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * CIEDE2000 color difference
 * More accurate than CIE76, especially for subtle color differences.
 * Reference: http://www.brucelindbloom.com/index.html?Eqn_DeltaE_CIE2000.html
 */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const L1 = lab1.L;
  const a1 = lab1.a;
  const b1 = lab1.b;
  const L2 = lab2.L;
  const a2 = lab2.a;
  const b2 = lab2.b;

  const avgL = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  const avgCp = (C1p + C2p) / 2;

  const h1p = Math.atan2(b1, a1p) >= 0 ? Math.atan2(b1, a1p) : Math.atan2(b1, a1p) + 2 * Math.PI;
  const h2p = Math.atan2(b2, a2p) >= 0 ? Math.atan2(b2, a2p) : Math.atan2(b2, a2p) + 2 * Math.PI;

  const h1p_deg = (h1p * 180) / Math.PI;
  const h2p_deg = (h2p * 180) / Math.PI;

  let dhp = h2p_deg - h1p_deg;
  if (Math.abs(dhp) > 180) {
    if (h2p_deg <= h1p_deg) dhp += 360;
    else dhp -= 360;
  }

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);

  let avgHp = h1p_deg + h2p_deg;
  if (Math.abs(h1p_deg - h2p_deg) > 180) {
    if (avgHp < 360) avgHp += 360;
    else avgHp -= 360;
  }
  avgHp /= 2;

  const T =
    1 -
    0.17 * Math.cos(((avgHp - 30) * Math.PI) / 180) +
    0.24 * Math.cos(((2 * avgHp) * Math.PI) / 180) +
    0.32 * Math.cos(((3 * avgHp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * avgHp - 63) * Math.PI) / 180);

  const sL = 1 + (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
  const sC = 1 + 0.045 * avgCp;
  const sH = 1 + 0.015 * avgCp * T;

  const dTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
  const RT = -RC * Math.sin((2 * dTheta * Math.PI) / 180);

  const kL = 1;
  const kC = 1;
  const kH = 1;

  const de2000 = Math.sqrt(
    Math.pow(dLp / (kL * sL), 2) +
      Math.pow(dCp / (kC * sC), 2) +
      Math.pow(dHp / (kH * sH), 2) +
      RT * (dCp / (kC * sC)) * (dHp / (kH * sH))
  );

  return de2000;
}
