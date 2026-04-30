import type { CubeColor } from './colorDetector';

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

export function createEmptyCubeState(): CubeState {
  return {
    faces: { U: null, R: null, F: null, D: null, L: null, B: null },
  };
}

/**
 * 6면 모두 캡처되었는지
 */
export function isComplete(state: CubeState): boolean {
  return FACE_ORDER.every((f) => state.faces[f] !== null);
}

/**
 * cubejs로 보낼 54자리 faceletString 생성
 */
export function toFaceletString(state: CubeState): string {
  return FACE_ORDER.map((f) => state.faces[f]!.join('')).join('');
}

/**
 * 큐브 상태 사전 검증 (솔버 호출 전)
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateCubeState(state: CubeState): ValidationResult {
  if (!isComplete(state)) {
    return { valid: false, error: '아직 모든 면을 다 보여주지 않았어요' };
  }

  // 1. 각 색상이 정확히 9개씩인지
  const counts: Record<CubeColor, number> = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
  for (const face of FACE_ORDER) {
    for (const color of state.faces[face]!) {
      counts[color]++;
    }
  }
  for (const color of FACE_ORDER) {
    if (counts[color] !== 9) {
      return {
        valid: false,
        error: `${color}색 칸이 ${counts[color]}개로 잘못 인식됐어요 (9개 필요)`,
      };
    }
  }

  // 2. 각 면 중심이 그 면의 색이어야 함
  for (const face of FACE_ORDER) {
    if (state.faces[face]![4] !== face) {
      return {
        valid: false,
        error: `${face}면 중앙이 ${state.faces[face]![4]}로 잘못 인식됐어요`,
      };
    }
  }

  return { valid: true };
}

/**
 * cubejs 동적 import (번들 크기 고려)
 */
let CubeLib: any = null;
let solverInitialized = false;

export async function initSolver(): Promise<void> {
  if (solverInitialized) return;
  if (!CubeLib) {
    const mod = await import('cubejs');
    CubeLib = mod.default || mod;
  }
  // initSolver는 약 5초 정도 걸리는 무거운 초기화
  CubeLib.initSolver();
  solverInitialized = true;
}

/**
 * 큐브를 풀어서 한 수씩 배열로 반환
 * 예: ["R", "U", "R'", "U'", "F2"]
 */
export async function solveCube(faceletString: string): Promise<string[]> {
  await initSolver();
  const cube = CubeLib.fromString(faceletString);
  const solution: string = cube.solve();
  if (!solution) return [];
  return solution.split(' ').filter((s: string) => s.length > 0);
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
