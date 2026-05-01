import { useState } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { FaceReview } from './components/FaceReview';
import { SolverGuide } from './components/SolverGuide';
import {
  FACE_ORDER,
  FACE_INSTRUCTION_KR,
  createEmptyCubeState,
  initSolver,
  isComplete,
  toFaceletString,
  validateCubeState,
  solveCube,
  type CubeState,
} from './lib/cubeState';
import { solveColorAssignment, loadCalibration, type CubeColor, type Lab } from './lib/colorDetector';

type Phase = 'intro' | 'capturing' | 'review' | 'solving' | 'solution';

export default function App() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [cubeState, setCubeState] = useState<CubeState>(createEmptyCubeState);
  const [currentFaceIdx, setCurrentFaceIdx] = useState(0);
  const [solution, setSolution] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [solverError, setSolverError] = useState<string | null>(null);

  const currentFace = FACE_ORDER[currentFaceIdx];

  const handleCaptured = (colors: CubeColor[], labs: Lab[]) => {
    setCubeState((prev) => ({
      ...prev,
      faces: { ...prev.faces, [currentFace]: colors },
      faceLabs: { ...prev.faceLabs, [currentFace]: labs },
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

  const handleMagicFix = () => {
    // 6면의 Lab 데이터를 하나의 배열(54개)로 합치기 (U R F D L B 순서)
    const allLabs: Lab[] = [];
    for (const face of FACE_ORDER) {
      const labs = cubeState.faceLabs[face];
      if (labs) {
        allLabs.push(...labs);
      } else {
        // 데이터가 없으면 기본값(L:0, a:0, b:0)으로 채움 (보통은 다 있어야 함)
        allLabs.push(...Array(9).fill({ L: 0, a: 0, b: 0 }));
      }
    }

    const calibration = loadCalibration();
    const optimized = solveColorAssignment(allLabs, calibration || undefined);

    // 다시 면별로 쪼개서 상태 업데이트
    setCubeState((prev) => {
      const nextFaces = { ...prev.faces };
      FACE_ORDER.forEach((face, faceIdx) => {
        nextFaces[face] = optimized.slice(faceIdx * 9, (faceIdx + 1) * 9);
      });
      return { ...prev, faces: nextFaces };
    });
    setValidationError(null);
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
      if (!isComplete(cubeState)) {
        setValidationError('아직 모든 면을 다 보여주지 않았어요');
        return;
      }
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
                try {
                  // UI를 먼저 'capturing' 페이즈로 전환하여 사용자에게 즉각적인 피드백을 제공합니다.
                  setPhase('capturing');
                  
                  // [태블릿 최적화] 솔버(cubejs) 예열: 무거운 테이블 생성 연산(~5초)이 UI 스레드를 차단하여
                  // 화면 전환 애니메이션이 멈추는 현상을 방지하기 위해 지연 실행합니다.
                  // 기존 500ms에서 2000ms로 늘려 카메라도 함께 초기화될 충분한 시간을 벌어줍니다.
                  const initTask = () => {
                    initSolver().catch((err) => {
                      console.error('Failed to initialize solver:', err);
                    });
                  };

                  if ('requestIdleCallback' in window) {
                    (window as any).requestIdleCallback(() => setTimeout(initTask, 1500));
                  } else {
                    setTimeout(initTask, 2000);
                  }
                } catch (err) {
                  console.error('Error starting capture phase:', err);
                  alert('카메라 화면을 불러오는 중 오류가 발생했습니다.');
                }
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
              const dummyLabs: Lab[] = Array(9).fill({ L: 0, a: 0, b: 0 });
              handleCaptured(placeholder, dummyLabs);
            }}
          />
        )}

        {phase === 'review' && (
          <FaceReview
            faces={cubeState.faces}
            onChange={handleEditCell}
            onConfirm={handleConfirm}
            onRetake={handleRetakeFace}
            onMagicFix={handleMagicFix}
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
