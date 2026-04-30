import { useEffect, useRef, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { extract9CellsWithRgb, COLOR_HEX, COLOR_NAME_KR } from '../lib/colorDetector';
import type { CubeColor } from '../lib/colorDetector';

interface CameraCaptureProps {
  targetFace: CubeColor;
  instructionText: string;
  onCaptured: (colors: CubeColor[]) => void;
  onSkip?: () => void;
}

const GRID_SIZE_RATIO = 0.55; // 화면 짧은 변 대비 그리드 크기

type LivePreviewCell = { color: CubeColor; rgb: [number, number, number] };

const LIVE_PREVIEW_THROTTLE_MS = 180;
const STABLE_FRAMES_TO_TRIGGER = 8;

export function CameraCapture({ targetFace, instructionText, onCaptured, onSkip }: CameraCaptureProps) {
  const { videoRef, ready, error, retry } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [livePreview, setLivePreview] = useState<LivePreviewCell[] | null>(null);
  const [stable, setStable] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [captured, setCaptured] = useState(false);

  // 매 프레임 변경되는 값은 ref 로 관리해 리렌더링을 피한다
  const stableFramesRef = useRef(0);
  const lastColorsRef = useRef<string>('');
  const lastPreviewPushRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  // targetFace 가 바뀌면 누적 상태 초기화
  useEffect(() => {
    stableFramesRef.current = 0;
    lastColorsRef.current = '';
    lastPreviewPushRef.current = 0;
    setStable(false);
    setLivePreview(null);
    setCountdown(null);
  }, [targetFace]);

  // 메인 분석 루프
  useEffect(() => {
    if (!ready || captured) return;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const overlay = overlayCanvasRef.current;
      if (!video || !canvas || !overlay || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
        overlay.width = vw;
        overlay.height = vh;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const octx = overlay.getContext('2d');
      if (!ctx || !octx) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      ctx.drawImage(video, 0, 0, vw, vh);

      const minDim = Math.min(vw, vh);
      const gridSize = minDim * GRID_SIZE_RATIO;
      const gx = (vw - gridSize) / 2;
      const gy = (vh - gridSize) / 2;

      const cells = extract9CellsWithRgb(ctx, gx, gy, gridSize);

      // 안정성 체크 (ref 사용 → 매 프레임 setState 폭주 제거)
      const colorsKey = cells.map((c) => c.color).join('');
      if (colorsKey === lastColorsRef.current) {
        stableFramesRef.current += 1;
      } else {
        stableFramesRef.current = 0;
        lastColorsRef.current = colorsKey;
      }
      const isStable = stableFramesRef.current >= STABLE_FRAMES_TO_TRIGGER;
      setStable((prev) => (prev !== isStable ? isStable : prev));

      // livePreview 는 ~180ms 주기로만 업데이트
      const now = performance.now();
      if (now - lastPreviewPushRef.current >= LIVE_PREVIEW_THROTTLE_MS) {
        lastPreviewPushRef.current = now;
        setLivePreview(cells);
      }

      // 오버레이 그리기
      octx.clearRect(0, 0, vw, vh);
      octx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      octx.lineWidth = 4;
      octx.strokeRect(gx, gy, gridSize, gridSize);
      const cellSize = gridSize / 3;
      octx.lineWidth = 2;
      octx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      for (let i = 1; i < 3; i++) {
        octx.beginPath();
        octx.moveTo(gx + i * cellSize, gy);
        octx.lineTo(gx + i * cellSize, gy + gridSize);
        octx.stroke();
        octx.beginPath();
        octx.moveTo(gx, gy + i * cellSize);
        octx.lineTo(gx + gridSize, gy + i * cellSize);
        octx.stroke();
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [ready, captured, videoRef]);

  // 안정화 → 카운트다운 → 캡처
  useEffect(() => {
    if (captured || !livePreview) return;

    const centerOk = livePreview[4].color === targetFace;

    if (stable && centerOk && countdown === null) {
      setCountdown(3);
    } else if (!stable && countdown !== null) {
      setCountdown(null);
    }
  }, [stable, livePreview, targetFace, captured, countdown]);

  // 카운트다운 진행
  useEffect(() => {
    if (countdown === null || captured) return;
    if (countdown <= 0) {
      // 캡처!
      if (livePreview) {
        setCaptured(true);
        const colors = livePreview.map((c) => c.color);
        // 짧은 딜레이 후 콜백 (UX)
        setTimeout(() => onCaptured(colors), 350);
      }
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 700);
    return () => clearTimeout(t);
  }, [countdown, captured, livePreview, onCaptured]);

  if (error) {
    return (
      <div className="camera-error">
        <p>{error}</p>
        <button className="btn-primary" onClick={retry}>
          다시 시도
        </button>
      </div>
    );
  }

  const centerOk = livePreview && livePreview[4].color === targetFace;

  return (
    <div className="camera-capture">
      <div className="instruction-card">
        <div className="instruction-step">
          <span className="step-badge" style={{ background: COLOR_HEX[targetFace] }} />
          <span>{instructionText}</span>
        </div>
        {ready && (
          <div className="status-line">
            {!centerOk && livePreview && (
              <span className="status-warn">
                중앙이 <b>{COLOR_NAME_KR[targetFace]}</b>이어야 해요!
              </span>
            )}
            {centerOk && !stable && <span className="status-tip">큐브를 가만히 들어줘 ✋</span>}
            {centerOk && stable && countdown !== null && countdown > 0 && (
              <span className="status-go">곧 찰칵! 📸</span>
            )}
          </div>
        )}
      </div>

      <div className="video-stage">
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <canvas ref={overlayCanvasRef} className="overlay-canvas" />

        {!ready && <div className="loading">카메라 켜는 중... 📷</div>}

        {countdown !== null && countdown > 0 && (
          <div className="countdown">{countdown}</div>
        )}

        {captured && <div className="flash" />}
      </div>

      {livePreview && (
        <div className="live-preview">
          <div className="preview-label">지금 보이는 색깔:</div>
          <div className="preview-grid">
            {livePreview.map((cell, i) => (
              <div
                key={i}
                className="preview-cell"
                style={{ background: COLOR_HEX[cell.color] }}
                title={`RGB: ${cell.rgb.join(',')}`}
              />
            ))}
          </div>
        </div>
      )}

      {onSkip && (
        <button className="btn-ghost" onClick={onSkip}>
          이 면 건너뛰기 (수동 입력)
        </button>
      )}
    </div>
  );
}
