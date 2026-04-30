import type CubeJs from 'cubejs';
import { COLOR_NAME_KR, type CubeColor } from './colorDetector';

// 면 캡처 순서 (사용자 가이드 순서)
export const FACE_ORDER: CubeColor[] = ['U', 'R', 'F', 'D', 'L', 'B'];

export const FACE_NAME_KR: Record<CubeColor, string> = {
  U: '윗면 (흰색 중심)',
  R: '오른쪽 면 (빨강 중심)',
  F: '앞면 (초록 중심)',
  D: '바닥면 (노랑 중심)',
  L: '왼쪽 면 (주황 중심)',
  B: '뒷면 (파랑 중심)',
};

export const FACE_INSTRUCTION_KR: Record<CubeColor, string> = {
  U: '🌟 흰색이 중앙에 오도록 윗면을 보여줘!',
  R: '🍎 빨간색이 중앙에 오도록 보여줘!',
  F: '🌿 초록색이 중앙에 오도록 보여줘!',
  D: '🌙 노란색이 중앙에 오도록 보여줘!',
  L: '🦊 주황색이 중앙에 오도록 보여줘!',
  B: '🌊 파란색이 중앙에 오도록 보여줘!',
};

export interface CubeState {
  // 면별 9칸 색상 (cubejs faceletString 순서: U R F D L B)
  faces: Record<CubeColor, CubeColor[] | null>;
}

export type CompletedCubeState = CubeState & {
  faces: Record<CubeColor, CubeColor[]>;
};

export function createEmptyCubeState(): CubeState {
  return {
    faces: { U: null, R: null, F: null, D: null, L: null, B: null },
  };
}

/**
 * 6면 모두 캡처되었는지
 */
export function isComplete(state: CubeState): state is CompletedCubeState {
  return FACE_ORDER.every((f) => state.faces[f] !== null);
}

/**
 * cubejs로 보낼 54자리 faceletString 생성. 완전 캡처된 상태에서만 호출 가능.
 */
export function toFaceletString(state: CompletedCubeState): string {
  return FACE_ORDER.map((f) => state.faces[f].join('')).join('');
}

/**
 * 큐브 상태 사전 검증 (솔버 호출 전)
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function getKoreanParticle(name: string): string {
  const lastChar = name.charCodeAt(name.length - 1);
  if (lastChar < 0xac00 || lastChar > 0xd7a3) return '로';
  const batchimIndex = (lastChar - 0xac00) % 28;
  // batchimIndex 0 is no batchim, 8 is 'ㄹ'. Both take '로'.
  return batchimIndex > 0 && batchimIndex !== 8 ? '으로' : '로';
}

export function validateCubeState(state: CubeState): ValidationResult {
  if (!isComplete(state)) {
    return { valid: false, error: '아직 모든 면을 다 보여주지 않았어요' };
  }

  const errors: string[] = [];

  // 1. 각 면 중심이 그 면의 색이어야 함 (중심이 틀리면 나머지도 틀릴 확률이 높으므로 먼저 체크)
  for (const faceKey of FACE_ORDER) {
    const faceColors = state.faces[faceKey];
    if (faceColors && faceColors[4] !== faceKey) {
      const detectedName = COLOR_NAME_KR[faceColors[4] as CubeColor];
      errors.push(`${FACE_NAME_KR[faceKey]} 중앙이 ${detectedName}${getKoreanParticle(detectedName)} 잘못 인식됐어요. 올바른 면을 보여주세요!`);
    }
  }

  // 2. 각 색상이 정확히 9개씩인지
  const counts: Record<CubeColor, number> = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
  for (const faceKey of FACE_ORDER) {
    const faceColors = state.faces[faceKey];
    if (faceColors) {
      for (const color of faceColors) {
        counts[color]++;
      }
    }
  }
  for (const colorKey of FACE_ORDER) {
    if (counts[colorKey] !== 9) {
      const colorName = COLOR_NAME_KR[colorKey];
      // '흰색' 등은 이미 '색'으로 끝나므로 중복 방지
      const displayName = colorName.endsWith('색') ? colorName : `${colorName}색`;
      errors.push(`${displayName} 칸이 ${counts[colorKey]}개 인식됐어요 (9개가 필요해요)`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('\n') };
  }

  return { valid: true };
}

/**
 * cubejs 동적 import (번들 크기 고려)
 */
type CubeCtor = typeof CubeJs;
let CubeLib: CubeCtor | null = null;
let solverInitialized = false;
let initPromise: Promise<void> | null = null;
let loadPromise: Promise<CubeCtor> | null = null;

async function loadCubeLib(): Promise<CubeCtor> {
  if (CubeLib) return CubeLib;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const mod = await import('cubejs');
    // ESM/CJS 호환
    const ctor = (mod as unknown as { default?: CubeCtor }).default ?? (mod as unknown as CubeCtor);
    CubeLib = ctor;
    return ctor;
  })();

  return loadPromise;
}

/**
 * 솔버 초기화. 약 5초 소요되므로 캡처 시작 시점에 미리 호출하면 대기 시간을 줄일 수 있다.
 * 동시 호출은 동일한 promise를 공유한다.
 */
export async function initSolver(): Promise<void> {
  if (solverInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const Cube = await loadCubeLib();
    Cube.initSolver();
    solverInitialized = true;
  })();

  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

/**
 * 큐브를 풀어서 한 수씩 배열로 반환
 * 예: ["R", "U", "R'", "U'", "F2"]
 */
export async function solveCube(faceletString: string): Promise<string[]> {
  await initSolver();
  if (!CubeLib) {
    throw new Error('Cube solver failed to load');
  }
  const cube = CubeLib.fromString(faceletString);
  const solution = cube.solve();
  if (!solution) return [];
  return solution.split(' ').filter((s) => s.length > 0);
}

/**
 * 한 수를 한국어 가이드로 변환
 * 예: "R" → "오른쪽 면을 시계방향으로 한 번 돌려줘"
 */
export function moveToKorean(move: string): {
  face: string;
  direction: string;
  faceCode: string;
  turns: 1 | 2;
  clockwise: boolean;
} {
  const faceCode = move[0];
  const isPrime = move.includes("'");
  const isDouble = move.includes('2');

  const faceMap: Record<string, string> = {
    U: '윗면',
    D: '바닥면',
    R: '오른쪽 면',
    L: '왼쪽 면',
    F: '앞면',
    B: '뒷면',
  };

  let direction: string;
  if (isDouble) direction = '두 번 (180도)';
  else if (isPrime) direction = '반시계방향 ↺';
  else direction = '시계방향 ↻';

  return {
    face: faceMap[faceCode] || faceCode,
    direction,
    faceCode,
    turns: isDouble ? 2 : 1,
    clockwise: !isPrime,
  };
}
