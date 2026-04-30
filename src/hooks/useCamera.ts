import { useEffect, useRef, useState } from 'react';

interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  ready: boolean;
  error: string | null;
  retry: () => void;
  lockCamera: () => Promise<void>;
  unlockCamera: () => Promise<void>;
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setError(null);
      setReady(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // 모바일은 후면 카메라 우선
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const err = e as Error;
        if (err.name === 'AbortError') return;
        const msg =
          err.name === 'NotAllowedError'
            ? '카메라 권한이 필요해! 브라우저에서 허용해줘 📷'
            : err.name === 'NotFoundError'
            ? '카메라를 찾을 수 없어요 😢'
            : `카메라를 켤 수 없어요: ${err.message}`;
        setError(msg);
      }
    }

    start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [attempt]);

  const setCameraLock = async (locked: boolean) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

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
      } catch (e) {
        console.warn('Failed to apply camera constraints', e);
      }
    }
  };

  return {
    videoRef,
    ready,
    error,
    retry: () => setAttempt((a) => a + 1),
    lockCamera: () => setCameraLock(true),
    unlockCamera: () => setCameraLock(false),
  };
}
