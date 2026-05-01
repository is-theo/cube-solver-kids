import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { COLOR_HEX, COLOR_NAME_KR, type CubeColor } from '../lib/colorDetector';
import { FACE_NAME_KR, FACE_ORDER } from '../lib/cubeState';

interface FaceReviewProps {
  faces: Record<CubeColor, CubeColor[] | null>;
  onChange: (face: CubeColor, idx: number, newColor: CubeColor) => void;
  onConfirm: () => void;
  onRetake: (face: CubeColor) => void;
  onMagicFix: () => void;
  validationError?: string | null;
}

const ALL_COLORS: CubeColor[] = ['U', 'R', 'F', 'D', 'L', 'B'];

function FaceCard({ face, faces, onRetake, onChange, setEditingCell }: {
  face: CubeColor;
  faces: Record<CubeColor, CubeColor[] | null>;
  onRetake: (face: CubeColor) => void;
  onChange: (face: CubeColor, idx: number, newColor: CubeColor) => void;
  setEditingCell: (cell: { face: CubeColor; idx: number } | null) => void;
}) {
  const cells = faces[face];
  return (
    <div className="face-card">
      <div className="face-card-header">
        <span className="face-card-title">
          <span className="face-dot" style={{ background: COLOR_HEX[face] }} />
          {FACE_NAME_KR[face].split(' ')[0]}
        </span>
        <button className="btn-tiny-icon" onClick={() => onRetake(face)} title="다시 찍기">🔄</button>
      </div>
      <div className="face-grid-3x3">
        {cells &&
          cells.map((c, i) => (
            <button
              key={i}
              className={`mini-cell ${i === 4 ? 'mini-cell-center' : ''}`}
              style={{ background: COLOR_HEX[c] }}
              onClick={() => i !== 4 && setEditingCell({ face, idx: i })}
              disabled={i === 4}
              aria-label={COLOR_NAME_KR[c]}
            />
          ))}
      </div>
    </div>
  );
}

export function FaceReview({ faces, onChange, onConfirm, onRetake, onMagicFix, validationError }: FaceReviewProps) {
  const [editingCell, setEditingCell] = useState<{ face: CubeColor; idx: number } | null>(null);

  useEffect(() => {
    if (!editingCell) return;
    
    // Scroll lock
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditingCell(null);
    };
    window.addEventListener('keydown', handleEsc);
    
    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleEsc);
    };
  }, [editingCell]);

  const modal = editingCell && (
    <div className="color-picker-modal" onClick={() => setEditingCell(null)}>
      <div className="color-picker-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="picker-title">색깔을 골라줘</div>
        <div className="picker-grid">
          {ALL_COLORS.map((c) => (
            <button
              key={c}
              className="picker-cell"
              style={{ background: COLOR_HEX[c] }}
              onClick={() => {
                onChange(editingCell.face, editingCell.idx, c);
                setEditingCell(null);
              }}
            >
              {COLOR_NAME_KR[c]}
            </button>
          ))}
        </div>
        <button className="btn-ghost" onClick={() => setEditingCell(null)}>
          취소
        </button>
      </div>
    </div>
  );

  return (
    <div className="face-review">
      <h2>색깔이 맞게 인식됐는지 확인해줘! 👀</h2>
      <p className="review-help">
        틀린 칸이 있으면 <b>탭해서 색을 바꿀 수 있어</b>.
      </p>

      {validationError && (
        <div className="validation-error">⚠️ {validationError}</div>
      )}

      <div className="faces-net-grid">
        {/* Row 1: Top (U) */}
        <div className="net-row">
          <div className="net-empty" />
          <FaceCard face="U" faces={faces} onRetake={onRetake} onChange={onChange} setEditingCell={setEditingCell} />
          <div className="net-empty" />
        </div>
        
        {/* Row 2: Left (L), Front (F), Right (R) */}
        <div className="net-row">
          <FaceCard face="L" faces={faces} onRetake={onRetake} onChange={onChange} setEditingCell={setEditingCell} />
          <FaceCard face="F" faces={faces} onRetake={onRetake} onChange={onChange} setEditingCell={setEditingCell} />
          <FaceCard face="R" faces={faces} onRetake={onRetake} onChange={onChange} setEditingCell={setEditingCell} />
        </div>

        {/* Row 3: Down (D) */}
        <div className="net-row">
          <div className="net-empty" />
          <FaceCard face="D" faces={faces} onRetake={onRetake} onChange={onChange} setEditingCell={setEditingCell} />
          <div className="net-empty" />
        </div>

        {/* Row 4: Back (B) */}
        <div className="net-row">
          <div className="net-empty" />
          <FaceCard face="B" faces={faces} onRetake={onRetake} onChange={onChange} setEditingCell={setEditingCell} />
          <div className="net-empty" />
        </div>
      </div>

      <div className="review-actions">
        <button className="btn-secondary" onClick={onMagicFix} title="색상 개수가 안 맞으면 자동으로 맞춰줘요">
          자동 보정 (Magic Fix) ✨
        </button>
        <button className="btn-primary btn-large" onClick={onConfirm}>
          다 맞아! 풀어줘 🪄
        </button>
      </div>

      {editingCell && createPortal(modal, document.body)}
    </div>
  );
}
