import { useState } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { FaceReview } from './components/FaceReview';
import { SolverGuide } from './components/SolverGuide';
import {
  FACE_ORDER,
  FACE_INSTRUCTION_KR,
  createEmptyCubeState,
  isComplete,
  toFaceletString,
  validateCubeState,
  solveCube,
  initSolver,
  type CubeState,
} from './lib/cubeState';
import type { CubeColor } from './lib/colorDetector';

type Phase = 'intro' | 'capturing' | 'review' | 'solving' | 'solution';

export default function App() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [cubeState, setCubeState] = useState<CubeState>(createEmptyCubeState);
  const [currentFaceIdx, setCurrentFaceIdx] = useState(0);
  const [solution, setSolution] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [solverError, setSolverError] = useState<string | null>(null);

  const currentFace = FACE_ORDER[currentFaceIdx];

  const handleCaptured = (colors: CubeColor[]) => {
    setCubeState((prev) => ({
      ...prev,
      faces: { ...prev.faces, [currentFace]: colors },
    }));
    if (currentFaceIdx < FACE_ORDER.length - 1) {
      setCurrentFaceIdx((i) => i + 1);
    } else {
      setPhase('review');
    }
  };

  const handleEditCell = (face: CubeColor, idx: number, newColor: CubeColor) => {
    setCubeState((prev) => {
      const cells = prev.faces[face];
      if (!cells) return prev;
      const next = [...cells];
      next[idx] = newColor;
      return { ...prev, faces: { ...prev.faces, [face]: next } };
    });
    setValidationError(null);
  };

  const handleRetakeFace = (face: CubeColor) => {
    setCubeState((prev) => ({
      ...prev,
      faces: { ...prev.faces, [face]: null },
    }));
    setCurrentFaceIdx(FACE_ORDER.indexOf(face));
    setPhase('capturing');
  };

  const handleConfirm = async () => {
    const result = validateCubeState(cubeState);
    if (!result.valid) {
      setValidationError(result.error || '큐브 상태가 이상해요');
      return;
    }
    setValidationError(null);
    setPhase('solving');
    setSolverError(null);

    try {
      const facelet = toFaceletString(cubeState);
      const sol = await solveCube(facelet);
      if (sol.length === 0) {
        // 이미 풀린 상태
        setSolution([]);
      } else {
        setSolution(sol);
      }
      setPhase('solution');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      setSolverError(`풀이 중 문제가 생겼어요: ${msg}`);
      setPhase('review');
    }
  };

  const handleRestart = () => {
    setCubeState(createEmptyCubeState());
    setCurrentFaceIdx(0);
    setSolution([]);
    setValidationError(null);
    setSolverError(null);
    setPhase('intro');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          🎲 큐브 마법사
        </h1>
        {phase !== 'intro' && (
          <button className="btn-tiny" onClick={handleRestart}>
            처음으로
          </button>
        )}
      </header>

      <main className="app-main">
        {phase === 'intro' && (
          <div className="intro">
            <div className="intro-hero">
              <div className="hero-cube">🎲</div>
              <h2>큐브를 마법처럼 풀어보자!</h2>
              <p>
                카메라로 큐브 6면을 보여주면<br />
                컴퓨터가 풀이 방법을 알려줄거야 ✨
              </p>
            </div>
            <ol className="intro-steps">
              <li>큐브의 6면을 하나씩 카메라에 보여주기 📷</li>
              <li>색깔이 맞는지 같이 확인하기 👀</li>
              <li>화살표 따라서 한 수씩 돌리기 🔄</li>
              <li>완성! 🎉</li>
            </ol>
            <button
              className="btn-primary btn-large"
              onClick={() => {
                setPhase('capturing');
                initSolver(); // 솔버 예열 시작
              }}
            >
              시작하기 🚀
            </button>
          </div>
        )}

        {phase === 'capturing' && (
          <CameraCapture
            key={currentFace}
            targetFace={currentFace}
            instructionText={FACE_INSTRUCTION_KR[currentFace]}
            onCaptured={handleCaptured}
            onSkip={() => {
              // 임시로 모두 해당 색으로 채움 (수동 입력 모드)
              const placeholder: CubeColor[] = Array(9).fill(currentFace);
              handleCaptured(placeholder);
            }}
          />
        )}

        {phase === 'review' && (
          <FaceReview
            faces={cubeState.faces}
            onChange={handleEditCell}
            onConfirm={handleConfirm}
            onRetake={handleRetakeFace}
            validationError={validationError || solverError}
          />
        )}

        {phase === 'solving' && (
          <div className="solving">
            <div className="loader" />
            <p>마법 주문 외우는 중... 🪄</p>
            <p className="loader-hint">처음 한 번은 5초쯤 걸려요!</p>
          </div>
        )}

        {phase === 'solution' && (
          <>
            {solution.length === 0 ? (
              <div className="already-solved">
                <h2>큐브가 이미 다 맞춰져 있어! 🎉</h2>
                <button className="btn-primary" onClick={handleRestart}>
                  새로 시작
                </button>
              </div>
            ) : (
              <SolverGuide
                faces={cubeState.faces}
                solution={solution}
                onRestart={handleRestart}
              />
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        {phase === 'capturing' && (
          <div className="phase-progress">
            <span>면 캡처 진행:</span>
            <div className="phase-dots">
              {FACE_ORDER.map((f, i) => (
                <span
                  key={f}
                  className={`phase-dot ${
                    cubeState.faces[f]
                      ? 'phase-dot-done'
                      : i === currentFaceIdx
                      ? 'phase-dot-current'
                      : ''
                  }`}
                />
              ))}
            </div>
            <span className="phase-count">
              {Object.values(cubeState.faces).filter(Boolean).length}/6
            </span>
          </div>
        )}
      </footer>
    </div>
  );
}
