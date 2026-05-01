import { useEffect, useRef, useState } from 'react';
import { Hands, Results } from '@mediapipe/hands';

export function useMediaPipeHands() {
  const [ready, setReady] = useState(false);
  const handsRef = useRef<Hands | null>(null);

  useEffect(() => {
    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results: Results) => {
      if (onResultsCallback.current) {
        onResultsCallback.current(results);
      }
    });

    hands.initialize().then(() => {
      handsRef.current = hands;
      setReady(true);
    });

    return () => {
      hands.close();
    };
  }, []);

  const onResultsCallback = useRef<((results: Results) => void) | null>(null);

  const processFrame = async (video: HTMLVideoElement, onResults: (results: Results) => void) => {
    if (handsRef.current && ready) {
      onResultsCallback.current = onResults;
      await handsRef.current.send({ image: video });
    }
  };

  return { ready, processFrame };
}
