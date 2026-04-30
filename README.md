# 🎲 큐브 마법사 (Cube Solver for Kids)

3x3 루빅스 큐브를 카메라로 인식하고 풀이를 단계별로 가이드해주는 웹앱.
초등 저학년(8-10세) 아이용으로 디자인됨.

## ✨ 기능

- 📷 **카메라로 6면 순차 캡처** (안정화되면 자동 카운트다운)
- 🎨 **9칸 색상 자동 인식** (Lab 색공간 및 델타 E 거리 기반, 캘리브레이션 지원)
- ✏️ **인식 결과 수동 수정** 가능 (틀린 칸 탭해서 색 바꾸기)
- 🪄 **Kociemba 솔버** (cubejs)로 평균 20수 이내 풀이
- 🎯 **Three.js 3D 큐브** + 화살표로 한 수씩 가이드

## 🛠 기술 스택

- Vite + React 18 + TypeScript
- Three.js (3D 큐브 시각화)
- cubejs (Kociemba 알고리즘 큐브 솔버)
- WebRTC `getUserMedia` (카메라)
- Canvas 2D + Lab 색공간 분류 (Delta E)

## 🚀 설치 및 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:5173 접속.

## 🧪 테스트 (Testing)

본 프로젝트는 `vitest`를 사용하여 핵심 로직의 정확성을 검증합니다.

```bash
npm test
```

### 테스트 범위 (Scope)
*   **핵심 알고리즘**: RGB → Lab 변환, 델타 E 기반 색상 분류, 큐브 상태 검증 및 Facelet 변환.
*   **제외 범위**: 카메라 하드웨어 접근, 브라우저 Canvas 렌더링, THREE.js 시각화 등의 UI/환경 의존적인 부분은 현재 유닛 테스트 범위에서 제외되어 있습니다.

> ⚠️ **카메라는 HTTPS 또는 localhost에서만 동작**합니다.
> 모바일에서 테스트하려면 `vite --host`로 띄우고 PC에서 ngrok 등 HTTPS 터널 사용을 권장.

## 🎮 사용법

1. **시작하기** 클릭
2. 흰 → 빨강 → 초록 → 노랑 → 주황 → 파랑 순으로 면 캡처
   - 화면 격자에 큐브를 맞춰 들기 (4개 코너 조절 가능)
   - 중심 색이 맞고 큐브가 안정적으로 보이면 3-2-1 카운트다운 후 자동 캡처
3. 6면 인식 결과 확인 → 잘못된 칸은 탭해서 수정
4. **다 맞아! 풀어줘** 클릭
5. 화살표 따라 한 수씩 돌리기

## 📁 폴더 구조

```
src/
├── components/
│   ├── CameraCapture.tsx    # 카메라 + 9칸 그리드 + 4코너 조정 + 자동 캡처
│   ├── CubeViewer3D.tsx     # Three.js 3D 큐브 + 화살표
│   ├── FaceReview.tsx       # 6면 색상 확인/수정
│   └── SolverGuide.tsx      # 한 수씩 가이드
├── hooks/
│   └── useCamera.ts         # WebRTC 카메라 훅 (노출/화이트밸런스 고정 지원)
├── lib/
│   ├── colorDetector.ts     # RGB → Lab → 6색 분류 (Calibration 지원)
│   └── cubeState.ts         # 큐브 상태 + cubejs 솔버 래퍼
├── styles/
│   └── global.css
├── App.tsx                  # 전체 흐름 제어 (state machine)
└── main.tsx
```

## 🧪 색 인식 정확도 팁

큐브 색 인식은 **조명 영향이 큽니다**. 정확도를 높이려면:

- 밝고 균일한 조명 (직사광선/그늘 경계 피하기)
- 큐브 면이 카메라에 평행하게
- 격자 안에 면이 꽉 차게
- 색상이 잘 안 맞으면 **디버그 패널**에서 실시간 Lab 값을 확인하고 필요시 캘리브레이션.

만약 인식이 자주 틀리면, 면 캡처 단계에서 **"이 면 건너뛰기"** 버튼으로 수동 입력 모드 → 검토 화면에서 색 직접 지정.

## 🔮 다음 단계 (2단계 - 실시간 인식)

현재는 6면 순차 캡처 방식. 실시간 인식을 추가하려면:

1. MediaPipe Hands로 큐브를 잡은 손 위치 추적
2. 손 사이 ROI에서 큐브 면 윤곽 검출 (Canny edge 등)
3. ROI 기반 9칸 그리드 호모그래피 정렬
4. 프레임마다 색 인식 + 안정화

OpenCV.js를 추가하면 면 검출이 훨씬 견고해집니다.

## 📝 라이선스

MIT
