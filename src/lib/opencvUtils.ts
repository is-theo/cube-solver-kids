/**
 * OpenCV.js utilities for cube face detection.
 * Note: cv must be available globally from a script tag.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export function detectCubeOutline(canvas: HTMLCanvasElement): [Point, Point, Point, Point] | null {
  const cv = (window as any).cv;
  if (!cv || !cv.Mat) return null;

  let src = cv.imread(canvas);
  let gray = new cv.Mat();
  let blurred = new cv.Mat();
  let edged = new cv.Mat();

  // 1. Grayscale and blur to reduce noise
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

  // 2. Edge detection
  cv.Canny(blurred, edged, 50, 150);

  // 3. Find contours
  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(edged, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  let bestCorners: [Point, Point, Point, Point] | null = null;
  let maxArea = 0;

  for (let i = 0; i < contours.size(); ++i) {
    let cnt = contours.get(i);
    let area = cv.contourArea(cnt);
    let perimeter = cv.arcLength(cnt, true);
    let approx = new cv.Mat();
    cv.approxPolyDP(cnt, approx, 0.02 * perimeter, true);

    // Cube face should be square-ish (4 corners) and have a minimum size
    if (approx.rows === 4 && area > 5000) {
      // Check if it's convex and somewhat square
      // For simplicity, we just take the largest one for now
      if (area > maxArea) {
        maxArea = area;
        bestCorners = [
          { x: approx.data32S[0], y: approx.data32S[1] },
          { x: approx.data32S[2], y: approx.data32S[3] },
          { x: approx.data32S[4], y: approx.data32S[5] },
          { x: approx.data32S[6], y: approx.data32S[7] },
        ];
      }
    }
    approx.delete();
    cnt.delete();
  }

  src.delete();
  gray.delete();
  blurred.delete();
  edged.delete();
  contours.delete();
  hierarchy.delete();

  // Sort corners: top-left, top-right, bottom-right, bottom-left
  if (bestCorners) {
    return sortCorners(bestCorners);
  }

  return null;
}

function sortCorners(corners: [Point, Point, Point, Point]): [Point, Point, Point, Point] {
  // Simple sort based on sum and difference
  // tl: min(x+y), br: max(x+y), tr: min(y-x), bl: max(y-x)
  const sorted = [...corners].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const tl = sorted[0];
  const br = sorted[3];
  
  const remaining = [sorted[1], sorted[2]];
  remaining.sort((a, b) => (a.y - a.x) - (b.y - b.x));
  const tr = remaining[0];
  const bl = remaining[1];

  return [tl, tr, br, bl];
}

export function isOpenCVReady(): boolean {
  const cv = (window as any).cv;
  return !!(cv && cv.Mat);
}
