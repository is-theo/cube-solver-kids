import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { COLOR_HEX, type CubeColor } from '../lib/colorDetector';
import { FACE_ORDER } from '../lib/cubeState';

interface CubeViewer3DProps {
  faces: Record<CubeColor, CubeColor[] | null>;
  highlightMove?: {
    faceCode: string;
    clockwise: boolean;
    turns: 1 | 2;
  } | null;
}

const STICKER_SIZE = 0.92;
const CUBIE_SIZE = 1.0;
const GAP = 0.04;

/**
 * 면 9칸을 큐브 표면에 정확히 배치
 *
 * cubejs faceletString 인덱스 (각 면 내):
 *   0 1 2
 *   3 4 5
 *   6 7 8
 *
 * 각 면 좌표계는 표준 큐브 전개도 기준
 */
function getFaceTransforms(face: CubeColor): {
  position: [number, number, number];
  rotation: [number, number, number];
} {
  const map: Record<CubeColor, { position: [number, number, number]; rotation: [number, number, number] }> = {
    U: { position: [0, 1.5 + GAP, 0], rotation: [-Math.PI / 2, 0, 0] },
    D: { position: [0, -1.5 - GAP, 0], rotation: [Math.PI / 2, 0, 0] },
    F: { position: [0, 0, 1.5 + GAP], rotation: [0, 0, 0] },
    B: { position: [0, 0, -1.5 - GAP], rotation: [0, Math.PI, 0] },
    R: { position: [1.5 + GAP, 0, 0], rotation: [0, Math.PI / 2, 0] },
    L: { position: [-1.5 - GAP, 0, 0], rotation: [0, -Math.PI / 2, 0] },
  };
  return map[face];
}

function getStickerLocalPosition(idx: number): [number, number] {
  // idx 0~8 → 그리드 위치 (-1, 0, 1) * (STICKER_SIZE + 작은 간격)
  const row = Math.floor(idx / 3);
  const col = idx % 3;
  const x = (col - 1) * STICKER_SIZE * 1.02;
  const y = (1 - row) * STICKER_SIZE * 1.02; // y는 위가 양수
  return [x, y];
}

export function CubeViewer3D({ faces, highlightMove }: CubeViewer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cubeGroupRef = useRef<THREE.Group | null>(null);
  const arrowGroupRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number>(0);

  // 1회 초기 설정
  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(6, 5, 7);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 조명
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 7);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dir2.position.set(-5, -3, -5);
    scene.add(dir2);

    // 큐브 그룹
    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);
    cubeGroupRef.current = cubeGroup;

    // 검정 코어 (3x3x3 중심부)
    const coreGeo = new THREE.BoxGeometry(2.95, 2.95, 2.95);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    cubeGroup.add(core);

    // 화살표 그룹
    const arrowGroup = new THREE.Group();
    scene.add(arrowGroup);
    arrowGroupRef.current = arrowGroup;

    // 자동 회전 애니메이션
    let lastTime = performance.now();
    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      if (cubeGroupRef.current) {
        cubeGroupRef.current.rotation.y += dt * 0.3;
      }
      if (arrowGroupRef.current) {
        // 화살표는 큐브와 함께 돌아야 함
        arrowGroupRef.current.rotation.y = cubeGroupRef.current?.rotation.y ?? 0;
      }
      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    // 리사이즈
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  // faces가 바뀌면 스티커 재생성
  useEffect(() => {
    const cubeGroup = cubeGroupRef.current;
    if (!cubeGroup) return;

    // 기존 스티커 제거 (코어는 첫 번째 자식이므로 유지)
    const toRemove: THREE.Object3D[] = [];
    cubeGroup.children.forEach((child, i) => {
      if (i > 0) toRemove.push(child); // 0번은 코어
    });
    toRemove.forEach((c) => cubeGroup.remove(c));

    // 면별 9칸 스티커 생성
    FACE_ORDER.forEach((face) => {
      const cells = faces[face];
      const transform = getFaceTransforms(face);
      const faceGroup = new THREE.Group();
      faceGroup.position.set(...transform.position);
      faceGroup.rotation.set(...transform.rotation);

      for (let i = 0; i < 9; i++) {
        const stickerColor = cells ? cells[i] : null;
        const hex = stickerColor ? COLOR_HEX[stickerColor] : '#1a1a1a';
        const stickerGeo = new THREE.PlaneGeometry(STICKER_SIZE, STICKER_SIZE);
        const stickerMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(hex),
          roughness: 0.35,
          metalness: 0.05,
        });
        const sticker = new THREE.Mesh(stickerGeo, stickerMat);
        const [x, y] = getStickerLocalPosition(i);
        sticker.position.set(x, y, 0);
        faceGroup.add(sticker);
      }
      cubeGroup.add(faceGroup);
    });
  }, [faces]);

  // highlightMove에 따라 화살표 표시
  useEffect(() => {
    const arrowGroup = arrowGroupRef.current;
    if (!arrowGroup) return;

    // 기존 화살표 제거
    while (arrowGroup.children.length > 0) {
      arrowGroup.remove(arrowGroup.children[0]);
    }

    if (!highlightMove) return;

    const { faceCode, clockwise } = highlightMove;
    const faceColor = faceCode as CubeColor;
    if (!FACE_ORDER.includes(faceColor)) return;

    const transform = getFaceTransforms(faceColor);

    // 토러스 호 (회전 화살표)
    const radius = 1.7;
    const tube = 0.13;
    const arc = Math.PI * 1.4; // 약 252도 호
    const torusGeo = new THREE.TorusGeometry(radius, tube, 12, 32, arc);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0xff3b8d,
      emissive: 0xff3b8d,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);

    // 면 바깥쪽으로 배치 (해당 면의 법선 방향으로 약간 띄움)
    const offset = 0.5;
    const facePos = new THREE.Vector3(...transform.position);
    const faceNormal = facePos.clone().normalize();
    torus.position.copy(facePos).add(faceNormal.clone().multiplyScalar(offset));

    // 토러스를 면에 평행하게 (lookAt으로 면 법선 방향에 맞춤)
    torus.lookAt(torus.position.clone().add(faceNormal));

    // 시계/반시계 회전 시각적 차이
    if (!clockwise) {
      torus.rotation.z += Math.PI;
    }

    arrowGroup.add(torus);

    // 화살표 머리 (콘) — 호의 끝부분에 배치
    const coneGeo = new THREE.ConeGeometry(tube * 2.5, tube * 5, 12);
    const cone = new THREE.Mesh(coneGeo, torusMat);

    // 화살표 끝 지점 (토러스의 끝 각도)
    const endAngle = clockwise ? arc : -arc;
    const localEnd = new THREE.Vector3(Math.cos(endAngle) * radius, Math.sin(endAngle) * radius, 0);
    localEnd.applyEuler(torus.rotation);
    cone.position.copy(torus.position).add(localEnd);

    // 콘이 진행 방향(접선)을 향하게
    const tangent = new THREE.Vector3(-Math.sin(endAngle), Math.cos(endAngle), 0);
    if (!clockwise) tangent.negate();
    tangent.applyEuler(torus.rotation);
    cone.lookAt(cone.position.clone().add(tangent));
    cone.rotateX(Math.PI / 2);

    arrowGroup.add(cone);

    // 깜빡 효과
    const startTime = performance.now();
    const blink = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const intensity = 0.35 + Math.sin(elapsed * 4) * 0.25;
      torusMat.emissiveIntensity = intensity;
      if (arrowGroup.children.length > 0) {
        requestAnimationFrame(blink);
      }
    };
    requestAnimationFrame(blink);
  }, [highlightMove]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: 280 }} />;
}
