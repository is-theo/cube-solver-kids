import { useEffect, useRef, useState } from 'react';

interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  ready: boolean;
  error: string | null;
  retry: () => void;
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      setError(null);
      setReady(false);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
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

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e: any) {
        const msg =
          e.name === 'NotAllowedError'
            ? '카메라 권한이 필요해! 브라우저에서 허용해줘 📷'
            : e.name === 'NotFoundError'
            ? '카메라를 찾을 수 없어요 😢'
            : `카메라를 켤 수 없어요: ${e.message}`;
        setError(msg);
      }
    }

    start();

    return () => {
      cancelled = true;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [attempt]);

  return {
    videoRef,
    ready,
    error,
    retry: () => setAttempt((a) => a + 1),
  };
}
