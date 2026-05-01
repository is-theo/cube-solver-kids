# 🎲 큐브 마법사 (Cube Solver for Kids)

3x3 루빅스 큐브를 카메라로 인식하고 풀이를 단계별로 가이드해주는 웹앱.
초등 저학년(8-10세) 아이용으로 디자인됨.

## ✨ 기능

- 📷 **카메라로 6면 순차 캡처** (안정화되면 자동 카운트다운)
- 🎨 **9칸 색상 자동 인식** (CIE Lab 색공간 및 Delta E 2000 거리 기반)
  - sRGB를 선형화한 후 D65 광원 기준 XYZ를 거쳐 Lab으로 변환하여 조명 변화에 강함
  - Delta E 76보다 정교한 **Delta E 2000** 공식을 기본으로 사용
  - 6면 주위 환경에 맞춘 **사용자 캘리브레이션** 기능 제공 (localStorage 저장)
- ✏️ **인식 결과 수동 수정** 가능 (틀린 칸 탭해서 색 바꾸기)
- 🪄 **Kociemba 솔버** (cubejs)로 평균 20수 이내 풀이
- 🎯 **Three.js 3D 큐브** + 화살표로 한 수씩 가이드

## 🛠 기술 스택

- Vite + React 18 + TypeScript
- **MediaPipe Hands**: 실시간 손 추적 및 큐브 영역 감지
- **OpenCV.js (v4.5.2)**: Canny Edge/Contour Detection 기반 큐브 면 윤곽 추출 (CDN 로드)
- Three.js (3D 큐브 시각화)
- cubejs (Kociemba 알고리즘 큐브 솔버)
- WebRTC `getUserMedia` (카메라)
- Canvas 2D + Lab 색공간 분류 (Delta E)

## 🚀 설치 및 실행

```bash
npm install
npm run dev
```

### 외부 의존성 (Runtime Dependencies)
- **MediaPipe**: `@mediapipe/hands`, `@mediapipe/camera_utils` 패키지가 설치되어 있어야 합니다.
- **OpenCV.js**: 앱 시작 시 `https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.5.2-build.2/dist/opencv.js`에서 스크립트를 비동기로 로드합니다. 네트워크 연결이 필요하며, 로드 실패 시 실시간 자동 정렬 기능이 제한될 수 있습니다.

## 🧪 테스트 (Testing)

본 프로젝트는 `vitest`를 사용하여 핵심 로직의 정확성을 검증합니다.

```bash
npm test
```

### 테스트 범위 (Scope)
*   **자동 테스트 (Vitest)**: 핵심 알고리즘 및 데이터 변환 로직 (핵심 단위 테스트 통과).
    *   **OpenCV 유틸리티**: 캔버스 이미지로부터 큐브 윤곽(4개 점) 추출 로직 검증 (`src/lib/opencvUtils.test.ts`)
    *   **색상 인식**: RGB ↔ Lab 변환 정확도 및 Delta E 2000 공식 검증
    *   **카메라 제약 조건**: 브라우저/기기별 Facing Mode 대응 로직
    *   **태블릿 호환성**: 보안 컨텍스트 체크 및 제약 조건 예외 처리 회귀 테스트 (`src/lib/tabletSupport.test.ts`)
    *   **큐브 상태**: Facelet 유효성 검사 및 솔버 연동 데이터 정규화
*   **수동 검증 (Manual Verification)**: 하드웨어 및 브라우저 API 의존적 기능.
    *   **MediaPipe 연동**: 손 추적 핸들러 연동 및 실시간 프레임 처리 안정성.
    *   **카메라 전환**: 전면/후면 카메라 토글 및 스트림 재시작 (다양한 장치에서 동작 확인).
    *   **카메라 잠금**: 실제 환경에서의 노출/화이트밸런스 고정 동작.
    *   **UI 반응성**: 저사양 기기에서의 3D 렌더링 및 카메라 오버레이 지연 시간.

> 💡 **참고**: 카메라 하드웨어 제어 루프는 브라우저 환경 및 실제 장치 의존성이 높아 자동화된 단위 테스트 대신 [카메라 가이드](./docs/CAMERA_GUIDE.md) 및 [문제 해결 가이드](./docs/TROUBLESHOOTING.md)의 검증 절차에 따라 수동으로 확인되었습니다.

## 🎮 사용법

1. **시작하기** 클릭
2. 흰 → 빨강 → 초록 → 노랑 → 주황 → 파랑 순으로 면 캡처
   - **자동 정렬**: 손으로 큐브를 잡으면 MediaPipe가 감지하고 OpenCV가 격자를 자동으로 맞춰줍니다.
   - **수동 조정**: 자동 정렬이 잘 안 될 경우, 화면의 4개 코너를 직접 드래그하여 맞출 수 있습니다 (드래그 시 자동 정렬 일시 중지).
   - 중심 색이 맞고 큐브가 안정적으로 보이면 3-2-1 카운트다운 후 자동 캡처
3. 6면 인식 결과 확인 → 잘못된 칸은 탭해서 수정
4. **다 맞아! 풀어줘** 클릭
5. 화살표 따라 한 수씩 돌리기

## 📁 폴더 구조

```
src/
├── components/
│   ├── CameraCapture.tsx    # 카메라 + 9칸 그리드 + 자동 정렬/캡처 루프
│   ├── CubeViewer3D.tsx     # Three.js 3D 큐브 + 화살표 시각화
│   ├── FaceReview.tsx       # 6면 색상 최종 확인 및 수동 수정
│   └── SolverGuide.tsx      # 단계별 풀이 가이드
├── hooks/
│   ├── useCamera.ts         # WebRTC 카메라 제어 (노출/화이트밸런스 고정)
│   └── useMediaPipeHands.ts  # MediaPipe Hands 모델 로드 및 프레임 처리
├── lib/
│   ├── opencvUtils.ts       # OpenCV.js 기반 큐브 윤곽/격자 검출
│   ├── opencvUtils.test.ts  # OpenCV 유틸리티 단위 테스트
│   ├── colorDetector.ts     # RGB → Lab → 6색 분류 및 캘리브레이션
│   ├── colorDetector.test.ts # 색 인식 알고리즘 테스트
│   ├── colorSpace.ts        # sRGB-Lab 변환 및 DeltaE 2000 공식
│   ├── colorSpace.test.ts   # 색공간 변환 정확도 검증
│   ├── cubeState.ts         # 큐브 상태 관리 및 cubejs 솔버 연동
│   ├── cubeState.test.ts    # 상태 유효성 및 솔버 로직 테스트
│   └── tabletSupport.test.ts # 태블릿/모바일 호환성 회귀 테스트
├── styles/
│   └── global.css
├── types/
│   └── cubejs.d.ts          # 라이브러리 타입 정의
├── App.tsx                  # 전역 상태 및 라우팅 (State Machine)
└── main.tsx
```

## 🧪 색 인식 정확도 팁

큐브 색 인식은 **조명 영향이 큽니다**. 상세한 조작법은 [카메라 가이드](./docs/CAMERA_GUIDE.md)를 참고하세요. 정확도를 높이려면:

- 밝고 균일한 조명 (직사광선/그늘 경계 피하기)
- 큐브 면이 카메라에 평행하게
- 격자 안에 면이 꽉 차게
- 색상이 잘 안 맞으면 **디버그 패널**에서 실시간 Lab 값을 확인하고 필요시 캘리브레이션.

만약 인식이 자주 틀리면, 면 캡처 단계에서 **"이 면 건너뛰기"** 버튼으로 수동 입력 모드 → 검토 화면에서 색 직접 지정.

## 🔮 실시간 인식 (2단계 구현 완료)

현재 MediaPipe Hands와 OpenCV.js를 통한 실시간 인식이 구현되어 있습니다:

1. MediaPipe Hands로 큐브를 잡은 손 위치 추적
2. OpenCV.js를 이용한 큐브 면 윤곽 검출 (Canny edge + Contour)
3. 9칸 그리드 자동 정렬
4. 프레임마다 색 인식 + 안정화 자동 캡처

## 📝 라이선스

MIT
