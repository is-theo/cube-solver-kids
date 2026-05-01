import { describe, it, expect, vi } from 'vitest';
import { 
  getCameraErrorMessage, 
  applyCameraConstraints, 
  calculateInitialCorners, 
  adjustCornersForResolution 
} from './cameraUtils';

/**
 * 이 테스트는 태블릿 및 모바일 기기에서 발생할 수 있는 주요 호환성 이슈를
 * 실제 구현체(cameraUtils)를 통해 검증합니다.
 */

describe('Tablet Compatibility Support', () => {
  describe('getCameraErrorMessage', () => {
    it('should handle missing mediaDevices in non-secure contexts', () => {
      const error = { name: 'TypeError' };
      const isSecureContext = false;
      
      expect(getCameraErrorMessage(error, isSecureContext)).toBe('보안 연결(HTTPS)이 필요해요! 주소창 확인 부탁드려요 🔒');
    });

    it('should handle NotAllowedError', () => {
      const error = { name: 'NotAllowedError' };
      expect(getCameraErrorMessage(error, true)).toContain('카메라 권한이 필요해');
    });

    it('should handle NotFoundError', () => {
      const error = { name: 'NotFoundError' };
      expect(getCameraErrorMessage(error, true)).toContain('카메라를 찾을 수 없어요');
    });
  });

  describe('applyCameraConstraints', () => {
    it('should handle unsupported camera capabilities gracefully', async () => {
      const mockTrack = {
        getCapabilities: () => ({}), // Empty capabilities
        applyConstraints: vi.fn().mockResolvedValue(undefined),
      } as unknown as MediaStreamTrack;

      // Should return false if capabilities (like exposureMode) are missing
      const result = await applyCameraConstraints(mockTrack, true);
      expect(result).toBe(false);
      expect(mockTrack.applyConstraints).not.toHaveBeenCalled();
    });

    it('should apply constraints if capabilities are supported', async () => {
      const mockTrack = {
        getCapabilities: () => ({
          exposureMode: ['continuous', 'manual'],
        }),
        applyConstraints: vi.fn().mockResolvedValue(undefined),
      } as unknown as MediaStreamTrack;

      const result = await applyCameraConstraints(mockTrack, true);
      expect(result).toBe(true);
      expect(mockTrack.applyConstraints).toHaveBeenCalledWith({
        advanced: [{ exposureMode: 'manual' }]
      });
    });
  });

  describe('Grid Initialization (Tablet Resolution Support)', () => {
    it('should calculate initial corners centered in the video', () => {
      const vw = 1280;
      const vh = 720;
      const corners = calculateInitialCorners(vw, vh);
      
      expect(corners).toHaveLength(4);
      // Center of 1280x720 is (640, 360)
      // Size is 720 * 0.55 = 396
      // ox = (1280 - 396) / 2 = 442
      // oy = (720 - 396) / 2 = 162
      expect(corners[0]).toEqual({ x: 442, y: 162 });
    });

    it('should adjust corners proportionally when resolution changes', () => {
      const initialCorners: [{x:number, y:number}, {x:number, y:number}, {x:number, y:number}, {x:number, y:number}] = [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 },
      ];
      
      // Double the resolution
      const adjusted = adjustCornersForResolution(initialCorners, 400, 400, 800, 800);
      
      expect(adjusted[0]).toEqual({ x: 200, y: 200 });
      expect(adjusted[2]).toEqual({ x: 400, y: 400 });
    });

    it('should initialize corners if old resolution is 0', () => {
      const initialCorners: [{x:number, y:number}, {x:number, y:number}, {x:number, y:number}, {x:number, y:number}] = [
        { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }
      ];
      const adjusted = adjustCornersForResolution(initialCorners, 0, 0, 1000, 1000);
      
      // Should be centered in 1000x1000
      // size = 1000 * 0.55 = 550
      // ox = (1000 - 550) / 2 = 225
      expect(adjusted[0]).toEqual({ x: 225, y: 225 });
    });
  });
});
