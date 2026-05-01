export function getCameraConstraints(facingMode: 'user' | 'environment'): MediaStreamConstraints {
  return {
    video: {
      facingMode: facingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  };
}

export function getCameraErrorMessage(error: any, isSecureContext: boolean): string {
  if (error.name === 'NotAllowedError') {
    return '카메라 권한이 필요해! 브라우저에서 허용해줘 📷';
  }
  if (error.name === 'NotFoundError') {
    return '카메라를 찾을 수 없어요 😢';
  }
  
  // 보안 컨텍스트 체크 (navigator.mediaDevices가 없는 경우 등)
  if (!isSecureContext && (error.name === 'TypeError' || !error.name)) {
    return '보안 연결(HTTPS)이 필요해요! 주소창 확인 부탁드려요 🔒';
  }

  return `카메라를 켤 수 없어요: ${error.message || '알 수 없는 오류'}`;
}

export async function applyCameraConstraints(track: MediaStreamTrack, locked: boolean): Promise<boolean> {
  interface ExtendedCapabilities extends MediaTrackCapabilities {
    exposureMode?: string[];
    whiteBalanceMode?: string[];
  }
  interface ExtendedConstraints extends MediaTrackConstraintSet {
    exposureMode?: string;
    whiteBalanceMode?: string;
  }

  const capabilities = (track.getCapabilities?.() || {}) as ExtendedCapabilities;
  const constraints: ExtendedConstraints = {};

  if (capabilities.exposureMode?.includes(locked ? 'manual' : 'continuous')) {
    constraints.exposureMode = locked ? 'manual' : 'continuous';
  }
  if (capabilities.whiteBalanceMode?.includes(locked ? 'manual' : 'continuous')) {
    constraints.whiteBalanceMode = locked ? 'manual' : 'continuous';
  }

  if (Object.keys(constraints).length > 0) {
    try {
      await track.applyConstraints({ advanced: [constraints] });
      return true;
    } catch (e) {
      console.warn('Failed to apply camera constraints', e);
      return false;
    }
  }
  return false;
}

export function calculateInitialCorners(vw: number, vh: number): [{ x: number, y: number }, { x: number, y: number }, { x: number, y: number }, { x: number, y: number }] {
  const size = Math.min(vw, vh) * 0.55;
  const ox = (vw - size) / 2;
  const oy = (vh - size) / 2;
  return [
    { x: ox, y: oy },
    { x: ox + size, y: oy },
    { x: ox + size, y: oy + size },
    { x: ox, y: oy + size },
  ];
}

export function adjustCornersForResolution(
  corners: [{ x: number, y: number }, { x: number, y: number }, { x: number, y: number }, { x: number, y: number }],
  oldW: number,
  oldH: number,
  newW: number,
  newH: number
): [{ x: number, y: number }, { x: number, y: number }, { x: number, y: number }, { x: number, y: number }] {
  if (oldW === 0 || oldH === 0) return calculateInitialCorners(newW, newH);
  
  return corners.map(p => ({
    x: (p.x / oldW) * newW,
    y: (p.y / oldH) * newH
  })) as [{ x: number, y: number }, { x: number, y: number }, { x: number, y: number }, { x: number, y: number }];
}
