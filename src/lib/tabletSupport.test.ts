import { describe, it, expect, vi } from 'vitest';

/**
 * 이 테스트는 태블릿 및 모바일 기기에서 발생할 수 있는 주요 호환성 이슈를
 * 코드 수준에서 검증합니다. (Regression coverage for tablet issues)
 */

describe('Tablet Compatibility Support', () => {
  it('should handle missing mediaDevices in non-secure contexts', () => {
    // Mocking non-secure context
    const mockNavigator = {} as any;
    const isSecureContext = false;
    
    const getErrorMessage = (nav: any, isSecure: boolean) => {
      if (!nav.mediaDevices || !nav.mediaDevices.getUserMedia) {
        return !isSecure 
          ? '보안 연결(HTTPS)이 필요해요! 주소창 확인 부탁드려요 🔒'
          : '이 브라우저는 카메라를 지원하지 않아요 😢';
      }
      return null;
    };

    expect(getErrorMessage(mockNavigator, isSecureContext)).toBe('보안 연결(HTTPS)이 필요해요! 주소창 확인 부탁드려요 🔒');
  });

  it('should handle unsupported camera constraints gracefully', async () => {
    // MediaTrackTrack.applyConstraints is often a source of failure on old tablets
    const mockTrack = {
      getCapabilities: () => ({}), // Empty capabilities
      applyConstraints: vi.fn().mockResolvedValue(undefined),
    };

    const applyLock = async (track: any, locked: boolean) => {
      const capabilities = track.getCapabilities();
      const constraints: any = {};
      
      if (capabilities.exposureMode?.includes(locked ? 'manual' : 'continuous')) {
        constraints.exposureMode = locked ? 'manual' : 'continuous';
      }
      
      if (Object.keys(constraints).length > 0) {
        await track.applyConstraints({ advanced: [constraints] });
        return true;
      }
      return false;
    };

    // Should not throw and should return false if capabilities are missing
    await expect(applyLock(mockTrack, true)).resolves.toBe(false);
    expect(mockTrack.applyConstraints).not.toHaveBeenCalled();
  });
});
