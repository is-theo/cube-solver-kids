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
