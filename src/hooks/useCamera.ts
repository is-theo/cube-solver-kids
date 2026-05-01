import { useEffect, useRef, useState } from 'react';
import { getCameraConstraints, getCameraErrorMessage, applyCameraConstraints } from '../lib/cameraUtils';

interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  ready: boolean;
  error: string | null;
  facingMode: 'user' | 'environment';
  toggleFacingMode: () => void;
  retry: () => void;
  lockCamera: () => Promise<boolean>;
  unlockCamera: () => Promise<boolean>;
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [attempt, setAttempt] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setError(null);
      setReady(false);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError(getCameraErrorMessage({ name: 'TypeError' }, window.isSecureContext));
        return;
      }

      try {
        const constraints = getCameraConstraints(facingMode);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // 기존 스트림 정리
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setError(getCameraErrorMessage(e, window.isSecureContext));
      }
    }

    start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [attempt, facingMode]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const setCameraLock = async (locked: boolean): Promise<boolean> => {
    if (!streamRef.current) return false;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return false;
    return applyCameraConstraints(track, locked);
  };

  return {
    videoRef,
    ready,
    error,
    facingMode,
    toggleFacingMode,
    retry: () => setAttempt((a) => a + 1),
    lockCamera: () => setCameraLock(true),
    unlockCamera: () => setCameraLock(false),
  };
}
