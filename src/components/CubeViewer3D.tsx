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

type StickerMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
type ArrowMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

const EMPTY_STICKER_HEX = '#1a1a1a';

export function CubeViewer3D({ faces, highlightMove }: CubeViewer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cubeGroupRef = useRef<THREE.Group | null>(null);
  const arrowGroupRef = useRef<THREE.Group | null>(null);
  const stickerMeshesRef = useRef<Record<CubeColor, StickerMesh[]>>({
    U: [], R: [], F: [], D: [], L: [], B: [],
  });
  const arrowMeshesRef = useRef<ArrowMesh[]>([]);
  const blinkFrameRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);

  // 1회 초기 설정 (스티커도 여기서 한번만 생성)
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

    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 7);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dir2.position.set(-5, -3, -5);
    scene.add(dir2);

    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);
    cubeGroupRef.current = cubeGroup;

    const coreGeo = new THREE.BoxGeometry(2.95, 2.95, 2.95);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    cubeGroup.add(core);

    // 스티커 54개를 한 번만 생성하고 ref 에 보관 (faces 변경 시 색만 update)
    const stickerMeshes: Record<CubeColor, StickerMesh[]> = {
      U: [], R: [], F: [], D: [], L: [], B: [],
    };
    FACE_ORDER.forEach((face) => {
      const transform = getFaceTransforms(face);
      const faceGroup = new THREE.Group();
      faceGroup.position.set(...transform.position);
      faceGroup.rotation.set(...transform.rotation);
      for (let i = 0; i < 9; i++) {
        const stickerGeo = new THREE.PlaneGeometry(STICKER_SIZE, STICKER_SIZE);
        const stickerMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(EMPTY_STICKER_HEX),
          roughness: 0.35,
          metalness: 0.05,
        });
        const sticker = new THREE.Mesh(stickerGeo, stickerMat) as StickerMesh;
        const [x, y] = getStickerLocalPosition(i);
        sticker.position.set(x, y, 0);
        faceGroup.add(sticker);
        stickerMeshes[face].push(sticker);
      }
      cubeGroup.add(faceGroup);
    });
    stickerMeshesRef.current = stickerMeshes;

    const arrowGroup = new THREE.Group();
    scene.add(arrowGroup);
    arrowGroupRef.current = arrowGroup;

    let lastTime = performance.now();
    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      if (cubeGroupRef.current) {
        cubeGroupRef.current.rotation.y += dt * 0.3;
      }
      if (arrowGroupRef.current) {
        arrowGroupRef.current.rotation.y = cubeGroupRef.current?.rotation.y ?? 0;
      }
      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

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
      cancelAnimationFrame(blinkFrameRef.current);
      window.removeEventListener('resize', handleResize);

      // 모든 자식의 geometry/material 해제
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose());
          } else if (mat) {
            mat.dispose();
          }
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      stickerMeshesRef.current = { U: [], R: [], F: [], D: [], L: [], B: [] };
      arrowMeshesRef.current = [];
    };
  }, []);

  // faces 변경 시 스티커 색만 업데이트 (geometry/mesh 재생성 없음)
  useEffect(() => {
    const stickerMeshes = stickerMeshesRef.current;
    FACE_ORDER.forEach((face) => {
      const cells = faces[face];
      const meshes = stickerMeshes[face];
      if (!meshes || meshes.length !== 9) return;
      for (let i = 0; i < 9; i++) {
        const stickerColor = cells ? cells[i] : null;
        const hex = stickerColor ? COLOR_HEX[stickerColor] : EMPTY_STICKER_HEX;
        meshes[i].material.color.set(hex);
      }
    });
  }, [faces]);

  // highlightMove에 따라 화살표 표시
  useEffect(() => {
    const arrowGroup = arrowGroupRef.current;
    if (!arrowGroup) return;

    // 이전 화살표를 dispose 까지 포함해서 제거
    const cleanupPrev = () => {
      cancelAnimationFrame(blinkFrameRef.current);
      arrowMeshesRef.current.forEach((m) => {
        arrowGroup.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      });
      arrowMeshesRef.current = [];
    };
    cleanupPrev();

    if (!highlightMove) return undefined;

    const { faceCode, clockwise } = highlightMove;
    const faceColor = faceCode as CubeColor;
    if (!FACE_ORDER.includes(faceColor)) return undefined;

    const transform = getFaceTransforms(faceColor);

    const radius = 1.7;
    const tube = 0.13;
    const arc = Math.PI * 1.4;
    const torusGeo = new THREE.TorusGeometry(radius, tube, 12, 32, arc);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0xff3b8d,
      emissive: 0xff3b8d,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    const torus = new THREE.Mesh(torusGeo, torusMat) as ArrowMesh;

    const offset = 0.5;
    const facePos = new THREE.Vector3(...transform.position);
    const faceNormal = facePos.clone().normalize();
    torus.position.copy(facePos).add(faceNormal.clone().multiplyScalar(offset));
    torus.lookAt(torus.position.clone().add(faceNormal));

    if (!clockwise) {
      torus.rotation.z += Math.PI;
    }

    arrowGroup.add(torus);

    const coneGeo = new THREE.ConeGeometry(tube * 2.5, tube * 5, 12);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0xff3b8d,
      emissive: 0xff3b8d,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat) as ArrowMesh;

    const endAngle = clockwise ? arc : -arc;
    const localEnd = new THREE.Vector3(Math.cos(endAngle) * radius, Math.sin(endAngle) * radius, 0);
    localEnd.applyEuler(torus.rotation);
    cone.position.copy(torus.position).add(localEnd);

    const tangent = new THREE.Vector3(-Math.sin(endAngle), Math.cos(endAngle), 0);
    if (!clockwise) tangent.negate();
    tangent.applyEuler(torus.rotation);
    cone.lookAt(cone.position.clone().add(tangent));
    cone.rotateX(Math.PI / 2);

    arrowGroup.add(cone);
    arrowMeshesRef.current = [torus, cone];

    // 깜빡 효과 (메시가 살아있는 동안만)
    const startTime = performance.now();
    let alive = true;
    const blink = () => {
      if (!alive) return;
      const elapsed = (performance.now() - startTime) / 1000;
      const intensity = 0.35 + Math.sin(elapsed * 4) * 0.25;
      torusMat.emissiveIntensity = intensity;
      coneMat.emissiveIntensity = intensity;
      blinkFrameRef.current = requestAnimationFrame(blink);
    };
    blinkFrameRef.current = requestAnimationFrame(blink);

    return () => {
      alive = false;
      cleanupPrev();
    };
  }, [highlightMove]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: 280 }} />;
}
