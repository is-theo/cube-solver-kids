import { describe, it, expect } from 'vitest';
import { createEmptyCubeState, isComplete, validateCubeState, CubeState } from './cubeState';
import type { CubeColor } from './colorDetector';

describe('cubeState', () => {
  it('should create an empty cube state', () => {
    const state = createEmptyCubeState();
    expect(state.faces.U).toBeNull();
    expect(isComplete(state)).toBe(false);
  });

  it('should validate a correct cube state', () => {
    const state: CubeState = {
      faces: {
        U: Array(9).fill('U'),
        R: Array(9).fill('R'),
        F: Array(9).fill('F'),
        D: Array(9).fill('D'),
        L: Array(9).fill('L'),
        B: Array(9).fill('B'),
      }
    };
    expect(isComplete(state)).toBe(true);
    expect(validateCubeState(state).valid).toBe(true);
  });

  it('should fail validation if counts are wrong', () => {
    const state: CubeState = {
      faces: {
        U: Array(9).fill('U'),
        R: Array(9).fill('R'),
        F: Array(9).fill('F'),
        D: Array(9).fill('D'),
        L: Array(9).fill('L'),
        B: [...Array(8).fill('B'), 'U'], // Extra U, missing B
      }
    };
    const result = validateCubeState(state);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('U색 칸이 10개로 잘못 인식됐어요');
  });

  it('should fail validation if centers are wrong', () => {
    const state = createEmptyCubeState();
    state.faces = {
      U: ['U', 'U', 'U', 'U', 'R', 'U', 'U', 'U', 'U'], // Center (index 4) is R
      R: Array(9).fill('R') as CubeColor[],
      F: Array(9).fill('F') as CubeColor[],
      D: Array(9).fill('D') as CubeColor[],
      L: Array(9).fill('L') as CubeColor[],
      B: Array(9).fill('B') as CubeColor[],
    };
    
    // Adjust counts so it passes the first check but fails the second
    // Above state has 8 U's and 10 R's overall.
    (state.faces.R as CubeColor[])[0] = 'U'; // Now we have 9 U's and 9 R's.
    
    const result = validateCubeState(state);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('U면 중앙이 R로 잘못 인식됐어요');
  });

  it('should fail validation if state is incomplete', () => {
    const state = createEmptyCubeState();
    const result = validateCubeState(state);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('아직 모든 면을 다 보여주지 않았어요');
  });
});
