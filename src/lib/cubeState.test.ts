import { describe, it, expect } from 'vitest';
import { createEmptyCubeState, isComplete, toFaceletString, validateCubeState } from './cubeState';
import type { CubeColor } from './colorDetector';

describe('cubeState', () => {
  it('should create an empty cube state', () => {
    const state = createEmptyCubeState();
    expect(state.faces.U).toBeNull();
    expect(isComplete(state)).toBe(false);
  });

  it('should identify a complete cube state', () => {
    const state = createEmptyCubeState();
    state.faces = {
      U: Array(9).fill('U'),
      R: Array(9).fill('R'),
      F: Array(9).fill('F'),
      D: Array(9).fill('D'),
      L: Array(9).fill('L'),
      B: Array(9).fill('B'),
    };
    expect(isComplete(state)).toBe(true);
    if (isComplete(state)) {
      expect(toFaceletString(state)).toBe('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
    }
  });

  it('should validate a correct cube state', () => {
    const state = createEmptyCubeState();
    state.faces = {
      U: Array(9).fill('U'),
      R: Array(9).fill('R'),
      F: Array(9).fill('F'),
      D: Array(9).fill('D'),
      L: Array(9).fill('L'),
      B: Array(9).fill('B'),
    };
    const result = validateCubeState(state);
    expect(result.valid).toBe(true);
  });

  it('should fail validation if color counts are wrong', () => {
    const state = createEmptyCubeState();
    state.faces = {
      U: Array(9).fill('U'),
      R: Array(9).fill('R'),
      F: Array(9).fill('F'),
      D: Array(9).fill('D'),
      L: Array(9).fill('L'),
      B: Array(9).fill('B'),
    };
    // Make one U into R
    state.faces.U![0] = 'R'; 
    // Now we have 8 U's and 10 R's
    
    const result = validateCubeState(state);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('흰색 칸이 8개로 잘못 인식됐어요');
  });

  it('should fail validation if centers are wrong', () => {
    const state = createEmptyCubeState();
    state.faces = {
      U: ['U', 'U', 'U', 'U', 'R', 'U', 'U', 'U', 'U'], // Center is R
      R: Array(9).fill('R'),
      F: Array(9).fill('F'),
      D: Array(9).fill('D'),
      L: Array(9).fill('L'),
      B: Array(9).fill('B'),
    };
    
    // Adjust one R to U to pass count check
    state.faces.R![0] = 'U';
    
    const result = validateCubeState(state);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('윗면 (흰색 중심) 중앙이 빨강으로 잘못 인식됐어요');
  });

  it('should fail validation if state is incomplete', () => {
    const state = createEmptyCubeState();
    const result = validateCubeState(state);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('아직 모든 면을 다 보여주지 않았어요');
  });
});
