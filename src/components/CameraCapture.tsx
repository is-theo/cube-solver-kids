import { useEffect, useRef, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import {
  extract9Cells,
  COLOR_HEX,
  COLOR_NAME_KR,
  loadCalibration,
  saveCalibration,
} from '../lib/colorDetector';
import type { CubeColor, Point, CalibrationData, Lab } from '../lib/colorDetector';

interface CameraCaptureProps {
  targetFace: CubeColor;
  instructionText: string;
  onCaptured: (colors: CubeColor[], labs: Lab[]) => void;
  onSkip?: () => void;
}

const LIVE_PREVIEW_THROTTLE_MS = 100;
const STABLE_FRAMES_TO_TRIGGER = 8;

type LivePreviewCell = { color: CubeColor; rgb: [number, number, number]; lab: Lab };

export function CameraCapture({ targetFace, instructionText, onCaptured, onSkip }: CameraCaptureProps) {
  const { videoRef, ready, error, retry, lockCamera, unlockCamera, facingMode, toggleFacingMode } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [livePreview, setLivePreview] = useState<LivePreviewCell[] | null>(null);
  const [stable, setStable] = useState(false);
  const [stableCount, setStableCount] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [captured, setCaptured] = useState(false);
  const [debug, setDebug] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationData | null>(() => loadCalibration());
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibStep, setCalibStep] = useState<CubeColor | null>(null);

  // 4코너 좌표 (비디오 좌표계 기준)
  const [corners, setCorners] = useState<[Point, Point, Point, Point]>([
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 300 },
    { x: 100, y: 300 },
  ]);

  const stableFramesRef = useRef(0);
  const lastColorsRef = useRef<string>('');
  const lastPreviewPushRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const calibRafRef = useRef<number>(0);
  const videoSizeRef = useRef({ w: 0, h: 0 });

  // 초기 그리드 설정 및 해상도 변경 대응
  useEffect(() => {
    if (ready && videoRef.current) {
      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      
      // 해상도가 바뀌었거나 아직 설정되지 않은 경우
      if (vw !== videoSizeRef.current.w || vh !== videoSizeRef.current.h) {
        const oldW = videoSizeRef.current.w;
        const oldH = videoSizeRef.current.h;
        videoSizeRef.current = { w: vw, h: vh };

        if (oldW === 0) {
          // 최초 로드 시 중앙에 그리드 배치
          const size = Math.min(vw, vh) * 0.55;
          const ox = (vw - size) / 2;
          const oy = (vh - size) / 2;
          setCorners([
            { x: ox, y: oy },
            { x: ox + size, y: oy },
            { x: ox + size, y: oy + size },
            { x: ox, y: oy + size },
          ]);
        } else {
          // 해상도 변경 시 기존 코너 좌표 비율에 맞춰 조정
          setCorners(prev => prev.map(p => ({
            x: (p.x / oldW) * vw,
            y: (p.y / oldH) * vh
          })) as [Point, Point, Point, Point]);
        }
      }
    }
  }, [ready]);

  useEffect(() => {
    stableFramesRef.current = 0;
    lastColorsRef.current = '';
    setStable(false);
    setLivePreview(null);
    setCountdown(null);
  }, [targetFace]);

  const startCalibration = () => {
    setIsCalibrating(true);
    setCalibStep('U'); // 흰색부터 시작
  };

  const handleCalibrationCapture = () => {
    if (!livePreview || !calibStep) return;
    const centerLab = livePreview[4].lab;
    const nextRefs: Partial<Record<CubeColor, Lab>> = { 
      ...(calibration?.references || {}), 
      [calibStep]: centerLab 
    };
    const nextCalib: CalibrationData = { references: nextRefs };
    setCalibration(nextCalib);
    saveCalibration(nextCalib); // 중간 단계에서도 저장하여 이탈 시 데이터 보존

    // 다음 색상 순서: U -> R -> F -> D -> L -> B
    const order: CubeColor[] = ['U', 'R', 'F', 'D', 'L', 'B'];
    const idx = order.indexOf(calibStep);
    if (idx < order.length - 1) {
      setCalibStep(order[idx + 1]);
    } else {
      setIsCalibrating(false);
      setCalibStep(null);
    }
  };

  // 메인 분석 루프
  useEffect(() => {
    if (!ready || captured || isCalibrating) return;
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

      const cells = extract9Cells(ctx, corners, calibration || undefined);

      // 안정성 체크
      const colorsKey = cells.map((c) => c.color).join('');
      if (colorsKey === lastColorsRef.current) {
        stableFramesRef.current += 1;
      } else {
        stableFramesRef.current = 0;
        lastColorsRef.current = colorsKey;
      }
      const isStable = stableFramesRef.current >= STABLE_FRAMES_TO_TRIGGER;
      setStable((prev) => (prev !== isStable ? isStable : prev));
      setStableCount(stableFramesRef.current);

      const now = performance.now();
      if (now - lastPreviewPushRef.current >= LIVE_PREVIEW_THROTTLE_MS) {
        lastPreviewPushRef.current = now;
        setLivePreview(cells);
      }

      // 오버레이 그리기
      octx.clearRect(0, 0, vw, vh);
      octx.strokeStyle = isStable ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)';
      octx.lineWidth = 3;

      // 외곽선
      octx.beginPath();
      octx.moveTo(corners[0].x, corners[0].y);
      octx.lineTo(corners[1].x, corners[1].y);
      octx.lineTo(corners[2].x, corners[2].y);
      octx.lineTo(corners[3].x, corners[3].y);
      octx.closePath();
      octx.stroke();

      // 내부 격자
      octx.lineWidth = 1.5;
      for (let i = 1; i < 3; i++) {
        const t = i / 3;
        // 세로선
        octx.beginPath();
        octx.moveTo((1 - t) * corners[0].x + t * corners[1].x, (1 - t) * corners[0].y + t * corners[1].y);
        octx.lineTo((1 - t) * corners[3].x + t * corners[2].x, (1 - t) * corners[3].y + t * corners[2].y);
        octx.stroke();
        // 가로선
        octx.beginPath();
        octx.moveTo((1 - t) * corners[0].x + t * corners[3].x, (1 - t) * corners[0].y + t * corners[3].y);
        octx.lineTo((1 - t) * corners[1].x + t * corners[2].x, (1 - t) * corners[1].y + t * corners[2].y);
        octx.stroke();
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [ready, captured, corners, calibration, isCalibrating]);

  // Calibration loop (dedicated)
  useEffect(() => {
    if (!ready || !isCalibrating) return;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) {
        calibRafRef.current = requestAnimationFrame(tick);
        return;
      }
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const cells = extract9Cells(ctx, corners, undefined);
        setLivePreview(cells);
      }
      calibRafRef.current = requestAnimationFrame(tick);
    };
    calibRafRef.current = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(calibRafRef.current);
    };
  }, [ready, isCalibrating, corners]);

  useEffect(() => {
    if (captured || !livePreview || isCalibrating) return;
    const centerOk = livePreview[4].color === targetFace;
    if (stable && centerOk && countdown === null) {
      setCountdown(3);
      lockCamera();
    } else if (!stable && countdown !== null) {
      setCountdown(null);
      unlockCamera();
    }
  }, [stable, livePreview, targetFace, captured, countdown, isCalibrating]);

  useEffect(() => {
    if (countdown === null || captured) return;
    if (countdown <= 0) {
      if (livePreview) {
        setCaptured(true);
        const colors = livePreview.map((c) => c.color);
        const labs = livePreview.map((c) => c.lab);
        setTimeout(() => {
          onCaptured(colors, labs);
          unlockCamera();
        }, 350);
      }
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 700);
    return () => clearTimeout(t);
  }, [countdown, captured, livePreview, onCaptured]);

  const handleCornerMove = (idx: number, e: React.TouchEvent | React.MouseEvent | MouseEvent) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = video.getBoundingClientRect();
    let clientX: number;
    let clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * video.videoWidth;
    const y = ((clientY - rect.top) / rect.height) * video.videoHeight;

    const next = [...corners] as [Point, Point, Point, Point];
    next[idx] = { x, y };
    setCorners(next);
  };

  if (error) {
    return (
      <div className="camera-error">
        <p>{error}</p>
        <button className="btn-primary" onClick={retry}>다시 시도</button>
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
        {ready && !isCalibrating && (
          <div className="status-line">
            {!centerOk && livePreview && (
              <span className="status-warn">중앙이 <b>{COLOR_NAME_KR[targetFace]}</b>이어야 해요!</span>
            )}
            {centerOk && !stable && (
              <div className="stability-progress">
                <span className="status-tip">큐브를 가만히 들어줘 ✋</span>
                <div className="stability-bar-bg">
                  <div 
                    className="stability-bar-fill" 
                    style={{ width: `${(stableCount / STABLE_FRAMES_TO_TRIGGER) * 100}%` }} 
                  />
                </div>
              </div>
            )}
            {centerOk && stable && countdown !== null && countdown > 0 && <span className="status-go">곧 찰칵! 📸</span>}
          </div>
        )}
      </div>

      <div className="video-stage">
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <canvas ref={overlayCanvasRef} className="overlay-canvas" />

        {!isCalibrating && videoSizeRef.current.w > 0 && corners.map((p, i) => (
          <div
            key={i}
            className="corner-handle"
            style={{
              left: `${(p.x / videoSizeRef.current.w) * 100}%`,
              top: `${(p.y / videoSizeRef.current.h) * 100}%`,
            }}
            onMouseDown={() => {
              const move = (me: MouseEvent) => handleCornerMove(i, me);
              const up = () => {
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
              };
              window.addEventListener('mousemove', move);
              window.addEventListener('mouseup', up);
            }}
            onTouchMove={(e) => handleCornerMove(i, e)}
          />
        ))}

        {debug && livePreview && (
          <div className="debug-panel">
            {livePreview.map((c, i) => (
              <div key={i}>
                #{i}: L{Math.round(c.lab.L)} a{Math.round(c.lab.a)} b{Math.round(c.lab.b)}
              </div>
            ))}
            <div>Stable: {stable ? 'Y' : 'N'} ({stableFramesRef.current})</div>
          </div>
        )}

        {isCalibrating && calibStep && (
          <div className="calibration-overlay">
            <h3>색상 캘리브레이션</h3>
            <p>화면 중앙에 <b>{COLOR_NAME_KR[calibStep]}</b> 조각을 맞춰주세요.</p>
            <div className="calibration-target" style={{ borderColor: COLOR_HEX[calibStep] }}>
              {livePreview && (
                <div style={{ width: '80%', height: '80%', background: `rgb(${livePreview[4].rgb.join(',')})` }} />
              )}
            </div>
            <button className="btn-primary" onClick={handleCalibrationCapture}>
              이 색상 저장
            </button>
          </div>
        )}

        {!ready && <div className="loading">카메라 켜는 중... 📷</div>}
        {countdown !== null && countdown > 0 && <div className="countdown">{countdown}</div>}
        {captured && <div className="flash" />}
      </div>

      <div className="camera-controls">
        <button className="btn-tiny" onClick={toggleFacingMode}>
          {facingMode === 'environment' ? '전면 카메라로' : '후면 카메라로'}
        </button>
        <button className="btn-tiny" onClick={() => setDebug(!debug)}>디버그 {debug ? '끄기' : '켜기'}</button>
        <button className="btn-tiny" onClick={startCalibration} disabled={isCalibrating}>캘리브레이션</button>
      </div>

      {livePreview && !isCalibrating && (
        <div className="live-preview">
          <div className="preview-label">인식 중:</div>
          <div className="preview-grid">
            {livePreview.map((cell, i) => (
              <div key={i} className="preview-cell" style={{ background: COLOR_HEX[cell.color] }} />
            ))}
          </div>
        </div>
      )}

      {onSkip && <button className="btn-ghost" onClick={onSkip}>이 면 건너뛰기 (수동 입력)</button>}
    </div>
  );
}
