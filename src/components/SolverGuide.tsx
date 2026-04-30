import { useState } from 'react';
import { CubeViewer3D } from './CubeViewer3D';
import { moveToKorean, getKoreanParticle } from '../lib/cubeState';
import type { CubeColor } from '../lib/colorDetector';

interface SolverGuideProps {
  faces: Record<CubeColor, CubeColor[] | null>;
  solution: string[];
  onRestart: () => void;
}

export function SolverGuide({ faces, solution, onRestart }: SolverGuideProps) {
  const [step, setStep] = useState(0);
  const isDone = step >= solution.length;
  const currentMove = !isDone ? solution[step] : null;
  const moveInfo = currentMove ? moveToKorean(currentMove) : null;

  return (
    <div className="solver-guide">
      <div className="guide-header">
        <div className="step-counter">
          {!isDone ? (
            <>
              <span className="step-current">{step + 1}</span>
              <span className="step-divider">/</span>
              <span className="step-total">{solution.length}</span>
            </>
          ) : (
            <span className="step-done">완성! 🎉</span>
          )}
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${Math.min(100, (step / Math.max(1, solution.length)) * 100)}%` }}
          />
        </div>
      </div>

      <div className="cube-3d-stage">
        <CubeViewer3D
          faces={faces}
          highlightMove={
            moveInfo
              ? {
                  faceCode: moveInfo.faceCode,
                  clockwise: moveInfo.clockwise,
                  turns: moveInfo.turns,
                }
              : null
          }
        />
      </div>

      {!isDone && moveInfo && (
        <div className="move-card">
          <div className="move-label">이번에 할 일</div>
          <div className="move-text">
            <span className="move-face">{moveInfo.face}</span>을<br />
            <span className="move-direction">
              {moveInfo.direction}
              {moveInfo.turns === 2 ? '' : `${getKoreanParticle(moveInfo.direction)} 한 번`}
            </span>{' '}
            돌려줘!
          </div>
          <div className="move-notation">표기: <code>{currentMove}</code></div>
        </div>
      )}

      {isDone && (
        <div className="done-card">
          <h2>🌟 큐브를 다 풀었어! 🌟</h2>
          <p>정말 잘했어! 다음에 또 도전해볼까?</p>
        </div>
      )}

      <div className="step-controls">
        <button
          className="btn-secondary"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          ← 이전
        </button>
        {!isDone ? (
          <button className="btn-primary" onClick={() => setStep((s) => s + 1)}>
            다음 ✓
          </button>
        ) : (
          <button className="btn-primary" onClick={onRestart}>
            새로 시작 🔄
          </button>
        )}
      </div>

      {!isDone && (
        <button className="btn-ghost" onClick={onRestart}>
          처음부터 다시
        </button>
      )}
    </div>
  );
}
