import { useEffect, useRef, useState } from 'react';

// Use a more robust import style for MediaPipe Hands to handle Vite/ESM/CJS interop issues.
// Note: In some environments, @mediapipe/hands might be exported as a default or a named export.
import * as HandsNS from '@mediapipe/hands';

export function useMediaPipeHands() {
  const [ready, setReady] = useState(false);
  const handsRef = useRef<any>(null);
  const onResultsCallback = useRef<((results: any) => void) | null>(null);

  useEffect(() => {
    let hands: any = null;
    let isClosed = false;

    try {
      // Handle different export styles for MediaPipe Hands
      const HandsConstructor = (HandsNS as any).Hands || (HandsNS as any).default?.Hands || HandsNS;
      
      if (typeof HandsConstructor !== 'function') {
        console.warn('MediaPipe Hands constructor not found. Real-time hand detection will be disabled.');
        return;
      }

      hands = new HandsConstructor({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        },
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      hands.onResults((results: any) => {
        if (!isClosed && onResultsCallback.current) {
          onResultsCallback.current(results);
        }
      });

      hands.initialize()
        .then(() => {
          if (!isClosed) {
            handsRef.current = hands;
            setReady(true);
            console.log('MediaPipe Hands initialized successfully.');
          }
        })
        .catch((err: any) => {
          console.error('Failed to initialize MediaPipe Hands:', err);
        });
    } catch (err) {
      console.error('Error during MediaPipe Hands setup:', err);
    }

    return () => {
      isClosed = true;
      if (hands && typeof hands.close === 'function') {
        try {
          hands.close();
        } catch (e) {
          console.warn('Error closing MediaPipe hands:', e);
        }
      }
    };
  }, []);

  const processFrame = async (video: HTMLVideoElement, onResults: (results: any) => void) => {
    if (handsRef.current && ready) {
      onResultsCallback.current = onResults;
      try {
        await handsRef.current.send({ image: video });
      } catch (err) {
        console.error('Error processing frame with MediaPipe Hands:', err);
      }
    }
  };

  return { ready, processFrame };
}
