import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Trash2,
  RotateCw,
  Scissors,
  Eye,
  Ruler,
  Crosshair,
  Tag,
  Box,
  Grid3x3,
  Layers,
} from 'lucide-react';
import type {
  AssemblyPoint,
  CameraAngles,
  CameraViewPreset,
  RenderMode,
  SectionPlaneState,
  ViewportBackgroundConfig,
} from '../types/vessel';
import {
  buildAssembliesScene,
  disposeObjectTree,
  exportSceneToAsciiStl,
} from '../scene/vesselGeometry';
import {
  computeSceneMeshStats,
  exportSceneToAsciiStlWithUnit,
  exportSceneToBinaryStl,
  exportSceneToGlb,
  exportSceneToIges,
  exportSceneToObjAndMtl,
  exportSceneToStepAp214,
  type Export3DFormat,
  type SceneMeshStats,
} from '../scene/cadExporters';
import { CubeViewIcon } from './CadIcons';

export interface ExternalMeshModel {
  name: string;
  object: THREE.Group;
  stats: SceneMeshStats;
  loadToken: number;
}

export interface Exported3DFileBundle {
  primary: { fileName: string; data: string | ArrayBuffer; mime: string };
  secondary?: { fileName: string; data: string; mime: string };
}

export interface Viewport3DHandle {
  exportStl: (name?: string) => string;
  exportModel: (
    format: Export3DFormat,
    name?: string,
    unit?: 'mm' | 'm'
  ) => Promise<Exported3DFileBundle>;
  getMeshStats: () => SceneMeshStats;
  setView: (preset: CameraViewPreset) => void;
  setCameraAngles: (angles: CameraAngles) => void;
}

interface Viewport3DProps {
  assemblies: AssemblyPoint[];
  selectedComponentId: string | null;
  selectedSubNode?: string | null;
  documentLoadVersion?: number;
  externalMeshModel?: ExternalMeshModel | null;
  onClearExternalModel?: () => void;
  renderMode: RenderMode;
  bgConfig: ViewportBackgroundConfig;
  sectionState: SectionPlaneState;
  explodeFactor: number;
  showOrigin: boolean;
  showNozzleTags: boolean;
  measureMode: boolean;
  onSelectComponent: (componentId: string | null) => void;
  onCameraAnglesChange?: (angles: CameraAngles) => void;
  onRenderModeChange: (mode: RenderMode) => void;
  onDeleteSelected: () => void;
  onToggleOrientation: () => void;
  onToggleSectionDialog: () => void;
  onToggleVisibility: () => void;
  onToggleMeasureMode: () => void;
  onToggleOrigin: () => void;
  onToggleNozzleTags: () => void;
}

interface ProjectedTag {
  id: string;
  tag: string;
  x: number;
  y: number;
  visible: boolean;
}

const _projVec = new THREE.Vector3();
const _boxSize = new THREE.Vector3();
const _boxCenter = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createViewportBackgroundTexture(bg: ViewportBackgroundConfig): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    if (bg.mode === 'solid') {
      ctx.fillStyle = bg.topColor;
      ctx.fillRect(0, 0, 256, 256);
    } else if (bg.mode === 'grid') {
      ctx.fillStyle = bg.topColor;
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 256; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 256);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(256, i);
        ctx.stroke();
      }
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, bg.topColor);
      grad.addColorStop(1, bg.bottomColor);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export const Viewport3D = React.forwardRef<Viewport3DHandle, Viewport3DProps>(
  (
    {
      assemblies,
      selectedComponentId,
      selectedSubNode = null,
      documentLoadVersion = 0,
      externalMeshModel = null,
      onClearExternalModel,
      renderMode,
      bgConfig,
      sectionState,
      explodeFactor,
      showOrigin,
      showNozzleTags,
      measureMode,
      onSelectComponent,
      onCameraAnglesChange,
      onRenderModeChange,
      onDeleteSelected,
      onToggleOrientation,
      onToggleSectionDialog,
      onToggleVisibility,
      onToggleMeasureMode,
      onToggleOrigin,
      onToggleNozzleTags,
    },
    ref
  ) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const [projectedTags, setProjectedTags] = useState<ProjectedTag[]>([]);
    const [measureDistanceMm, setMeasureDistanceMm] = useState<number | null>(null);
    const [measurePointsCount, setMeasurePointsCount] = useState<number>(0);
    const [cubeTransform, setCubeTransform] = useState<string>('rotateX(-22deg) rotateY(-38deg)');
    const [webglLost, setWebglLost] = useState(false);

    // Refs to bridge React state with imperative Three.js lifecycle without remounting
    const onSelectRef = useRef(onSelectComponent);
    onSelectRef.current = onSelectComponent;
    const onCameraAnglesRef = useRef(onCameraAnglesChange);
    onCameraAnglesRef.current = onCameraAnglesChange;
    const measureModeRef = useRef(measureMode);
    measureModeRef.current = measureMode;
    const showNozzleTagsRef = useRef(showNozzleTags);
    showNozzleTagsRef.current = showNozzleTags;

    const threeRef = useRef<{
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      renderer: THREE.WebGLRenderer;
      controls: OrbitControls;
      modelContainer: THREE.Group;
      originGroup: THREE.Group;
      measureGroup: THREE.Group;
      selectables: THREE.Object3D[];
      nozzleAnchors: Array<{ id: string; tag: string; worldPos: THREE.Vector3 }>;
      boundingBox: THREE.Box3;
      clippingPlanes: THREE.Plane[];
      measurePoints: THREE.Vector3[];
      baseFitDistance: number;
      isSoftwareGl: boolean;
      requestRender: () => void;
      applyViewPreset: (preset: CameraViewPreset, instant?: boolean) => void;
      applyCameraAngles: (angles: CameraAngles) => void;
    } | null>(null);

    // Initialize WebGL scene ONCE
    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const isSoftwareGl = detectSoftwareWebGL();
      const width = Math.max(100, container.clientWidth);
      const height = Math.max(100, container.clientHeight);

      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(36, width / height, 0.05, 200);
      camera.position.set(4.5, 2.8, 5.2);

      const renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.localClippingEnabled = false;
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const initBgTex = createViewportBackgroundTexture(bgConfig);
      scene.background = initBgTex;

      container.replaceChildren();
      container.appendChild(renderer.domElement);

      // Studio PBR Environment Reflection (RoomEnvironment on every device, balanced intensity)
      const pmrem = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      const envRT = pmrem.fromScene(roomEnv, 0.04);
      scene.environment = envRT.texture;
      scene.environmentIntensity = 0.52;
      roomEnv.dispose();
      pmrem.dispose();

      // 3-Point CAD Studio Lighting Rig (warm key + cool hemisphere fill + crisp rim)
      const hemiLight = new THREE.HemisphereLight(0xedf5ff, 0x6f8296, 0.58);
      scene.add(hemiLight);

      const keyLight = new THREE.DirectionalLight(0xfff3de, 1.45);
      keyLight.position.set(6, 9, 7);
      if (!isSoftwareGl) {
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        keyLight.shadow.bias = -0.0005;
        keyLight.shadow.normalBias = 0.02;
      }
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0xbfdbfe, 0.52);
      rimLight.position.set(-7, -3, -6);
      scene.add(rimLight);

      const modelContainer = new THREE.Group();
      scene.add(modelContainer);

      // Origin datum axes + centerlines (Page 8 style)
      const originGroup = new THREE.Group();
      const axisLen = 4.5;
      const makeAxisLine = (a: THREE.Vector3, b: THREE.Vector3, color: number) => {
        const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
        return new THREE.Line(
          geo,
          new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 })
        );
      };
      originGroup.add(
        makeAxisLine(new THREE.Vector3(-axisLen, 0, 0), new THREE.Vector3(axisLen, 0, 0), 0xef4444),
        makeAxisLine(new THREE.Vector3(0, -axisLen, 0), new THREE.Vector3(0, axisLen, 0), 0x22c55e),
        makeAxisLine(new THREE.Vector3(0, 0, -axisLen), new THREE.Vector3(0, 0, axisLen), 0x2563eb)
      );
      const originDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xdc2626 })
      );
      originGroup.add(originDot);
      scene.add(originGroup);

      // Measurement overlay group
      const measureGroup = new THREE.Group();
      scene.add(measureGroup);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = !isSoftwareGl;
      controls.dampingFactor = 0.08;
      controls.screenSpacePanning = true;
      controls.minDistance = 0.4;
      controls.maxDistance = 60;
      // Match GHPV mouse controls (Left=Rotate, Middle=Pan, Right=Pan/Zoom, Wheel=Zoom)
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.DOLLY,
      };

      let rafId = 0;
      let timerId = 0;
      let disposed = false;
      let renderBusy = false;
      let renderDirty = false;
      let animatingCam = false;
      let lastOverlayUpdate = 0;
      let lastW = width;
      let lastH = height;

      const updateHudProjections = () => {
        const now = performance.now();
        if (now - lastOverlayUpdate < 60 && !isSoftwareGl) return;
        lastOverlayUpdate = now;

        // Sync ViewCube orientation from camera inverse rotation (conjugate Y for CSS +Y-down)
        const invMat = new THREE.Matrix4().extractRotation(camera.matrixWorldInverse);
        const euler = new THREE.Euler().setFromRotationMatrix(invMat, 'XYZ');
        const rx = (-THREE.MathUtils.radToDeg(euler.x)).toFixed(1);
        const ry = THREE.MathUtils.radToDeg(euler.y).toFixed(1);
        const rz = (-THREE.MathUtils.radToDeg(euler.z)).toFixed(1);
        setCubeTransform(`rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`);

        const state = threeRef.current;
        if (!state || !showNozzleTagsRef.current) return;
        const w = renderer.domElement.clientWidth;
        const h = renderer.domElement.clientHeight;
        const nextTags: ProjectedTag[] = state.nozzleAnchors.map((anc) => {
          _projVec.copy(anc.worldPos).project(camera);
          const visible = _projVec.z >= -1 && _projVec.z <= 1;
          return {
            id: anc.id,
            tag: anc.tag,
            x: ((_projVec.x + 1) / 2) * w,
            y: ((-_projVec.y + 1) / 2) * h,
            visible,
          };
        });
        setProjectedTags(nextTags);
      };

      const afterDraw = (cb: () => void) => {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (!gl || typeof gl.fenceSync !== 'function') {
          timerId = window.setTimeout(cb, 32);
          return;
        }
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        let polls = 0;
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          polls += 1;
          const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (status === gl.UNSIGNALED && polls < 10) {
            timerId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            timerId = window.setTimeout(cb, 32);
          }
        };
        timerId = window.setTimeout(poll, 5);
      };

      const performRender = () => {
        if (disposed) return;
        renderDirty = false;
        if (animatingCam) {
          const alpha = isSoftwareGl ? 1 : 0.22;
          camera.position.lerp(_targetCamPos, alpha);
          controls.target.lerp(_targetLookAt, alpha);
          if (
            camera.position.distanceTo(_targetCamPos) < 0.015 &&
            controls.target.distanceTo(_targetLookAt) < 0.015
          ) {
            camera.position.copy(_targetCamPos);
            controls.target.copy(_targetLookAt);
            animatingCam = false;
          } else {
            renderDirty = true;
          }
        }
        controls.update();
        renderer.render(scene, camera);
        updateHudProjections();

        const done = () => {
          if (disposed) return;
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      };

      const requestRender = () => {
        if (disposed) return;
        if (renderBusy) {
          renderDirty = true;
          return;
        }
        renderBusy = true;
        rafId = requestAnimationFrame(performRender);
      };

      const applyViewPreset = (preset: CameraViewPreset, instant = false) => {
        const state = threeRef.current;
        if (!state) return;
        state.boundingBox.getCenter(_boxCenter);
        state.boundingBox.getSize(_boxSize);

        const vFovRad = THREE.MathUtils.degToRad(camera.fov);
        const aspect = Math.max(0.5, camera.aspect);
        const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);

        // Compute projected width/height based on view direction so tall towers never crop
        const isTopBottom = preset === 'top' || preset === 'bottom';
        const isSide = preset === 'left' || preset === 'right';
        const projH = isTopBottom ? Math.max(_boxSize.z, 1.0) : Math.max(_boxSize.y, 1.0);
        const projW = isSide
          ? Math.max(_boxSize.z, 1.0)
          : isTopBottom
          ? Math.max(_boxSize.x, 1.0)
          : Math.max(Math.hypot(_boxSize.x, _boxSize.z), 1.2);

        const fitH = projH / (2 * Math.tan(vFovRad / 2));
        const fitW = projW / (2 * Math.tan(hFovRad / 2));
        const depthOffset = Math.max(_boxSize.x, _boxSize.y, _boxSize.z) * 0.35;
        const dist = Math.max(fitH, fitW) * 1.22 + depthOffset;
        state.baseFitDistance = dist;

        _targetLookAt.copy(_boxCenter);

        switch (preset) {
          case 'front':
            _targetCamPos.set(_boxCenter.x, _boxCenter.y, _boxCenter.z + dist);
            break;
          case 'back':
            _targetCamPos.set(_boxCenter.x, _boxCenter.y, _boxCenter.z - dist);
            break;
          case 'left':
            _targetCamPos.set(_boxCenter.x - dist, _boxCenter.y, _boxCenter.z);
            break;
          case 'right':
            _targetCamPos.set(_boxCenter.x + dist, _boxCenter.y, _boxCenter.z);
            break;
          case 'top':
            _targetCamPos.set(_boxCenter.x, _boxCenter.y + dist, _boxCenter.z + 0.01);
            break;
          case 'bottom':
            _targetCamPos.set(_boxCenter.x, _boxCenter.y - dist, _boxCenter.z + 0.01);
            break;
          case 'iso':
          case 'fit':
          default: {
            const isoDir = new THREE.Vector3(0.66, 0.38, 0.68).normalize();
            _targetCamPos.copy(_boxCenter).addScaledVector(isoDir, dist);
            break;
          }
        }

        if (instant || isSoftwareGl) {
          camera.position.copy(_targetCamPos);
          controls.target.copy(_targetLookAt);
          animatingCam = false;
        } else {
          animatingCam = true;
        }
        requestRender();
      };

      const applyCameraAngles = (angles: CameraAngles) => {
        const state = threeRef.current;
        if (!state) return;
        state.boundingBox.getCenter(_boxCenter);
        const az = THREE.MathUtils.degToRad(angles.azimuthDeg);
        const el = THREE.MathUtils.degToRad(Math.max(-80, Math.min(80, angles.elevationDeg)));
        const zoomFactor = 100 / Math.max(30, angles.zoomPercent);
        const radius = Math.max(0.8, state.baseFitDistance * zoomFactor);

        const x = _boxCenter.x + radius * Math.cos(el) * Math.sin(az);
        const y = _boxCenter.y + radius * Math.sin(el);
        const z = _boxCenter.z + radius * Math.cos(el) * Math.cos(az);

        animatingCam = false;
        controls.target.copy(_boxCenter);
        camera.position.set(x, y, z);
        requestRender();
      };

      let lastAngleEmit = 0;
      const emitCameraAngles = () => {
        const cb = onCameraAnglesRef.current;
        const state = threeRef.current;
        if (!cb || !state) return;
        const now = performance.now();
        if (now - lastAngleEmit < 120) return;
        lastAngleEmit = now;

        const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
        const r = Math.max(0.1, offset.length());
        const el = THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, offset.y / r))));
        const az = THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z));
        const zoomPercent = Math.max(40, Math.min(220, Math.round((state.baseFitDistance / r) * 100)));
        cb({ azimuthDeg: az, elevationDeg: el, zoomPercent });
      };

      controls.addEventListener('start', () => {
        animatingCam = false;
      });
      controls.addEventListener('change', () => {
        requestRender();
        emitCameraAngles();
      });

      // Pointer click selection & 2-point distance measurement
      const raycaster = new THREE.Raycaster();
      const pointerDownPos = new THREE.Vector2();
      const ndc = new THREE.Vector2();

      const onPointerDown = (e: PointerEvent) => {
        pointerDownPos.set(e.clientX, e.clientY);
      };

      const onPointerUp = (e: PointerEvent) => {
        if (e.button !== 0) return;
        const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
        if (moveDist > 5) return; // Was orbit drag

        const state = threeRef.current;
        if (!state) return;

        const rect = renderer.domElement.getBoundingClientRect();
        ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);

        const hits = raycaster.intersectObjects(state.selectables, false);

        if (measureModeRef.current) {
          if (hits.length > 0) {
            const pt = hits[0].point.clone();
            if (state.measurePoints.length >= 2) {
              state.measurePoints = [];
              disposeObjectTree(state.measureGroup);
              state.measureGroup.clear();
            }
            state.measurePoints.push(pt);

            const dot = new THREE.Mesh(
              new THREE.SphereGeometry(0.035, 12, 12),
              new THREE.MeshBasicMaterial({ color: 0xe11d48 })
            );
            dot.position.copy(pt);
            state.measureGroup.add(dot);

            if (state.measurePoints.length === 2) {
              const [p1, p2] = state.measurePoints;
              const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
              const line = new THREE.Line(
                lineGeo,
                new THREE.LineBasicMaterial({ color: 0xe11d48 })
              );
              state.measureGroup.add(line);
              const mm = Math.round(p1.distanceTo(p2) * 1000 * 10) / 10;
              setMeasureDistanceMm(mm);
            } else {
              setMeasureDistanceMm(null);
            }
            setMeasurePointsCount(state.measurePoints.length);
            requestRender();
          }
          return;
        }

        if (hits.length > 0) {
          const compId = hits[0].object.userData.componentId as string | undefined;
          if (compId) {
            onSelectRef.current(compId);
          }
        }
      };

      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointerup', onPointerUp);

      const handleContextLost = (ev: Event) => {
        ev.preventDefault();
        setWebglLost(true);
      };
      const handleContextRestored = () => {
        setWebglLost(false);
        requestRender();
      };
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

      const ro = new ResizeObserver(() => {
        const w = Math.max(100, container.clientWidth);
        const h = Math.max(100, container.clientHeight);
        if (w === lastW && h === lastH) return;
        lastW = w;
        lastH = h;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (!renderBusy) {
          renderBusy = true;
          performRender();
        } else {
          renderDirty = true;
        }
      });
      ro.observe(container);

      threeRef.current = {
        scene,
        camera,
        renderer,
        controls,
        modelContainer,
        originGroup,
        measureGroup,
        selectables: [],
        nozzleAnchors: [],
        boundingBox: new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1)),
        clippingPlanes: [],
        measurePoints: [],
        baseFitDistance: 6.5,
        isSoftwareGl,
        requestRender,
        applyViewPreset,
        applyCameraAngles,
      };

      return () => {
        disposed = true;
        cancelAnimationFrame(rafId);
        clearTimeout(timerId);
        ro.disconnect();
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
        renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
        controls.dispose();
        disposeObjectTree(modelContainer);
        disposeObjectTree(measureGroup);
        if (scene.background instanceof THREE.Texture) {
          scene.background.dispose();
        }
        envRT.dispose();
        renderer.dispose();
        threeRef.current = null;
      };
    }, []);

    // Sync scene.background texture whenever bgConfig changes in Dlg_Config
    useEffect(() => {
      const state = threeRef.current;
      if (!state) return;
      if (state.scene.background instanceof THREE.Texture) {
        state.scene.background.dispose();
      }
      state.scene.background = createViewportBackgroundTexture(bgConfig);
      state.requestRender();
    }, [bgConfig]);

    // Track whether this is the first time a preset/assembly set loads so we auto-fit once
    const prevAssemblyKeyRef = useRef<string>('');

    // Rebuild 3D vessel geometry when assemblies, selection, renderMode, or section planes change
    useEffect(() => {
      const state = threeRef.current;
      if (!state) return;

      // Build active clipping planes
      const planes: THREE.Plane[] = [];
      if (sectionState.enabled) {
        if (sectionState.xEnabled) {
          const sign = sectionState.xFlip ? 1 : -1;
          planes.push(new THREE.Plane(new THREE.Vector3(sign, 0, 0), -sign * (sectionState.xPos / 1000)));
        }
        if (sectionState.yEnabled) {
          const sign = sectionState.yFlip ? 1 : -1;
          planes.push(new THREE.Plane(new THREE.Vector3(0, sign, 0), -sign * (sectionState.yPos / 1000)));
        }
        if (sectionState.zEnabled) {
          const sign = sectionState.zFlip ? 1 : -1;
          planes.push(new THREE.Plane(new THREE.Vector3(0, 0, sign), -sign * (sectionState.zPos / 1000)));
        }
      }
      state.clippingPlanes = planes;
      state.renderer.localClippingEnabled = planes.length > 0;

      disposeObjectTree(state.modelContainer);
      state.modelContainer.clear();

      if (externalMeshModel) {
        const cloned = externalMeshModel.object.clone(true);
        const extSelectables: THREE.Object3D[] = [];
        cloned.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            m.geometry = m.geometry.clone();
            const cloneMat = (orig: THREE.Material) => {
              const mat = orig.clone() as THREE.MeshStandardMaterial;
              mat.wireframe = renderMode === 'wireframe';
              mat.clippingPlanes = planes;
              mat.clipShadows = planes.length > 0;
              if (renderMode === 'hiddenline') {
                mat.color = new THREE.Color('#f8fafc');
                mat.roughness = 0.85;
                mat.metalness = 0.05;
              }
              return mat;
            };
            m.material = Array.isArray(m.material)
              ? m.material.map(cloneMat)
              : cloneMat(m.material);
            extSelectables.push(m);
            if (renderMode === 'hiddenline') {
              const edges = new THREE.EdgesGeometry(m.geometry, 24);
              const line = new THREE.LineSegments(
                edges,
                new THREE.LineBasicMaterial({
                  color: 0x1e293b,
                  clippingPlanes: planes,
                })
              );
              m.add(line);
            }
          }
        });
        state.modelContainer.add(cloned);
        state.modelContainer.updateMatrixWorld(true);
        const extBox = new THREE.Box3().setFromObject(cloned);
        if (extBox.isEmpty()) {
          extBox.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
        }
        state.selectables = extSelectables;
        state.nozzleAnchors = [];
        state.boundingBox = extBox;

        const extKey = `ext:${externalMeshModel.name}:${externalMeshModel.loadToken}`;
        if (prevAssemblyKeyRef.current !== extKey) {
          prevAssemblyKeyRef.current = extKey;
          state.applyViewPreset('iso', true);
        } else {
          state.requestRender();
        }
        return;
      }

      const built = buildAssembliesScene(
        assemblies,
        selectedComponentId,
        renderMode,
        planes,
        explodeFactor,
        selectedSubNode
      );
      state.modelContainer.add(built.rootGroup);
      state.selectables = built.selectableMeshes;
      state.nozzleAnchors = built.nozzleAnchors;
      state.boundingBox = built.boundingBox;

      const assemblyKey = `doc:${documentLoadVersion}|${assemblies.map((a) => `${a.id}:${a.orientation}`).join('|')}|exp:${explodeFactor > 0.01 ? 1 : 0}`;
      if (prevAssemblyKeyRef.current !== assemblyKey) {
        prevAssemblyKeyRef.current = assemblyKey;
        state.applyViewPreset('iso', true);
      } else {
        state.requestRender();
      }
    }, [assemblies, selectedComponentId, selectedSubNode, documentLoadVersion, externalMeshModel, renderMode, sectionState, explodeFactor]);

    // Toggle origin visibility
    useEffect(() => {
      const state = threeRef.current;
      if (!state) return;
      state.originGroup.visible = showOrigin;
      state.requestRender();
    }, [showOrigin]);

    // Toggle nozzle tags
    useEffect(() => {
      if (!showNozzleTags) {
        setProjectedTags([]);
      } else {
        threeRef.current?.requestRender();
      }
    }, [showNozzleTags]);

    // Clear measure markers when turning off measure mode
    useEffect(() => {
      const state = threeRef.current;
      if (!state) return;
      if (!measureMode) {
        state.measurePoints = [];
        disposeObjectTree(state.measureGroup);
        state.measureGroup.clear();
        setMeasureDistanceMm(null);
        setMeasurePointsCount(0);
        state.requestRender();
      }
    }, [measureMode]);

    useImperativeHandle(ref, () => ({
      exportStl: (name = 'GHPV_Vessel') => {
        const state = threeRef.current;
        if (!state) return '';
        return exportSceneToAsciiStl(state.modelContainer, name);
      },
      exportModel: async (format: Export3DFormat, name = 'GHPV_Vessel', unit: 'mm' | 'm' = 'mm') => {
        const state = threeRef.current;
        if (!state) throw new Error('三维视口尚未初始化');
        const safeBase = (name || 'GHPV_Vessel').replace(/[^\w\u4e00-\u9fa5-]/g, '_') || 'GHPV_Vessel';

        switch (format) {
          case 'step': {
            const stp = exportSceneToStepAp214(state.modelContainer, safeBase, unit);
            return {
              primary: { fileName: `${safeBase}.stp`, data: stp, mime: 'application/step' },
            };
          }
          case 'iges': {
            const igs = exportSceneToIges(state.modelContainer, safeBase, unit);
            return {
              primary: { fileName: `${safeBase}.igs`, data: igs, mime: 'model/iges' },
            };
          }
          case 'stl_bin': {
            const buf = exportSceneToBinaryStl(state.modelContainer, safeBase, unit);
            return {
              primary: { fileName: `${safeBase}.stl`, data: buf, mime: 'model/stl' },
            };
          }
          case 'stl_ascii': {
            const stl = exportSceneToAsciiStlWithUnit(state.modelContainer, safeBase, unit);
            return {
              primary: { fileName: `${safeBase}_ascii.stl`, data: stl, mime: 'model/stl' },
            };
          }
          case 'obj': {
            const { obj, mtl } = exportSceneToObjAndMtl(state.modelContainer, safeBase, unit);
            return {
              primary: { fileName: `${safeBase}.obj`, data: obj, mime: 'text/plain;charset=utf-8' },
              secondary: { fileName: `${safeBase}.mtl`, data: mtl, mime: 'text/plain;charset=utf-8' },
            };
          }
          case 'glb': {
            const glb = await exportSceneToGlb(state.modelContainer);
            return {
              primary: { fileName: `${safeBase}.glb`, data: glb, mime: 'model/gltf-binary' },
            };
          }
        }
      },
      getMeshStats: () => {
        const state = threeRef.current;
        if (!state) {
          return { meshCount: 0, triangleCount: 0, sizeMm: [0, 0, 0] };
        }
        return computeSceneMeshStats(state.modelContainer);
      },
      setView: (preset: CameraViewPreset) => {
        threeRef.current?.applyViewPreset(preset, false);
      },
      setCameraAngles: (angles: CameraAngles) => {
        threeRef.current?.applyCameraAngles(angles);
      },
    }));

    // Compute viewport background style matching GHPV Dlg_Config (Page 7)
    const viewportBgStyle: React.CSSProperties =
      bgConfig.mode === 'solid'
        ? { background: bgConfig.topColor }
        : bgConfig.mode === 'grid'
        ? {
            backgroundColor: bgConfig.topColor,
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.22) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }
        : {
            background: `linear-gradient(180deg, ${bgConfig.topColor} 0%, ${bgConfig.bottomColor} 100%)`,
          };

    const viewPresets: Array<{ key: CameraViewPreset; label: string }> = [
      { key: 'fit', label: '缩放模型' },
      { key: 'front', label: '前视图' },
      { key: 'top', label: '俯视图' },
      { key: 'left', label: '左视图' },
      { key: 'back', label: '后视图' },
      { key: 'right', label: '右视图' },
      { key: 'bottom', label: '仰视图' },
      { key: 'iso', label: '轴侧视图' },
    ];

    return (
      <section className="flex-1 min-w-0 h-full flex flex-col bg-[#f3f4f6] overflow-hidden">
        {/* Sub-Toolbar: 视口方向 | 呈现模式 | 操作 (exact GHPV pages 5-8) */}
        <div className="h-[44px] px-2 flex items-center gap-3 bg-[#f3f5f8] border-b border-[#cbd5e1] shrink-0 overflow-x-auto select-none">
          {/* Group 1: 视口方向 */}
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] leading-none text-[#475569] mb-0.5">视口方向</span>
            <div className="flex items-center gap-0.5">
              {viewPresets.map((vp) => (
                <button
                  key={vp.key}
                  type="button"
                  title={vp.label}
                  aria-label={vp.label}
                  onClick={() => threeRef.current?.applyViewPreset(vp.key, false)}
                  className="w-[24px] h-[24px] flex items-center justify-center rounded-[2px] border border-transparent hover:bg-[#dbeafe] hover:border-[#93c5fd] transition-colors"
                >
                  <CubeViewIcon face={vp.key} />
                </button>
              ))}
            </div>
          </div>

          <div className="h-7 w-[1px] bg-[#cbd5e1] shrink-0" />

          {/* Group 2: 呈现模式 */}
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] leading-none text-[#475569] mb-0.5">呈现模式</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                title="实体渲染模式"
                aria-label="实体渲染模式"
                onClick={() => onRenderModeChange('solid')}
                className={`w-[24px] h-[24px] flex items-center justify-center rounded-[2px] border transition-colors ${
                  renderMode === 'solid'
                    ? 'bg-[#dbeafe] border-[#3b82f6] text-[#1d4ed8]'
                    : 'border-transparent text-[#475569] hover:bg-[#e2e8f0]'
                }`}
              >
                <Box className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="线框模式"
                aria-label="线框模式"
                onClick={() => onRenderModeChange('wireframe')}
                className={`w-[24px] h-[24px] flex items-center justify-center rounded-[2px] border transition-colors ${
                  renderMode === 'wireframe'
                    ? 'bg-[#dbeafe] border-[#3b82f6] text-[#1d4ed8]'
                    : 'border-transparent text-[#475569] hover:bg-[#e2e8f0]'
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="投影线框模式"
                aria-label="投影线框模式"
                onClick={() => onRenderModeChange('hiddenline')}
                className={`w-[24px] h-[24px] flex items-center justify-center rounded-[2px] border transition-colors ${
                  renderMode === 'hiddenline'
                    ? 'bg-[#dbeafe] border-[#3b82f6] text-[#1d4ed8]'
                    : 'border-transparent text-[#475569] hover:bg-[#e2e8f0]'
                }`}
              >
                <Layers className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="h-7 w-[1px] bg-[#cbd5e1] shrink-0" />

          {/* Group 3: 操作 (exact 7 GHPV buttons from Page 7-8) */}
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] leading-none text-[#475569] mb-0.5">操作</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                title="删除模型"
                aria-label="删除模型"
                onClick={onDeleteSelected}
                className="w-[24px] h-[24px] flex items-center justify-center rounded-[2px] border border-transparent text-[#475569] hover:bg-[#fee2e2] hover:border-[#fca5a5] hover:text-[#dc2626] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="立式卧式转换"
                aria-label="立式卧式转换"
                onClick={onToggleOrientation}
                className="w-[24px] h-[24px] flex items-center justify-center rounded-[2px] border border-transparent text-[#475569] hover:bg-[#dbeafe] hover:border-[#93c5fd] hover:text-[#1d4ed8] transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="剖视图"
                aria-label="剖视图"
                onClick={onToggleSectionDialog}
                className={`w-[24px] h-[24px] flex items-center justify-center rounded-[2px] border transition-colors ${
                  sectionState.enabled
                    ? 'bg-[#dbeafe] border-[#3b82f6] text-[#1d4ed8]'
                    : 'border-transparent text-[#475569] hover:bg-[#dbeafe] hover:border-[#93c5fd]'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="模型显示/隐藏"
                aria-label="模型显示或隐藏"
                onClick={onToggleVisibility}
                className="w-[24px] h-[24px] flex items-center justify-center rounded-[2px] border border-transparent text-[#475569] hover:bg-[#dbeafe] hover:border-[#93c5fd] hover:text-[#1d4ed8] transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="测量两点距离"
                aria-label="测量"
                onClick={onToggleMeasureMode}
                className={`w-[24px] h-[24px] flex items-center justify-center rounded-[2px] border transition-colors ${
                  measureMode
                    ? 'bg-[#fee2e2] border-[#f87171] text-[#b91c1c]'
                    : 'border-transparent text-[#475569] hover:bg-[#dbeafe] hover:border-[#93c5fd]'
                }`}
              >
                <Ruler className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="模型起始点展示"
                aria-label="模型起始点展示"
                onClick={onToggleOrigin}
                className={`w-[24px] h-[24px] flex items-center justify-center rounded-[2px] border transition-colors ${
                  showOrigin
                    ? 'bg-[#dbeafe] border-[#3b82f6] text-[#1d4ed8]'
                    : 'border-transparent text-[#475569] hover:bg-[#dbeafe] hover:border-[#93c5fd]'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="显示管口符号"
                aria-label="显示管口符号"
                onClick={onToggleNozzleTags}
                className={`w-[24px] h-[24px] flex items-center justify-center rounded-[2px] border transition-colors ${
                  showNozzleTags
                    ? 'bg-[#dbeafe] border-[#3b82f6] text-[#1d4ed8]'
                    : 'border-transparent text-[#475569] hover:bg-[#dbeafe] hover:border-[#93c5fd]'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 视口 Tab Label Strip */}
        <div className="h-[19px] px-2 flex items-center justify-between bg-[#eef1f5] border-b border-[#cbd5e1] text-[10.5px] text-[#475569] shrink-0 select-none">
          <span>视口</span>
          <span className="text-[#64748b] tabular-nums">
            {measureMode
              ? measureDistanceMm !== null
                ? `测量结果: ${measureDistanceMm.toFixed(1)} mm (点击模型重新选点)`
                : `测量模式: 请在模型上依次点击两点 (${measurePointsCount}/2)`
              : '左键旋转 · 右键缩放 · 中键平移 · 点击元件选中'}
          </span>
        </div>

        {/* Main 3D Viewport Container */}
        <div
          className="relative flex-1 min-h-0 w-full overflow-hidden"
          style={viewportBgStyle}
          data-testid="viewport-3d-container"
        >
          {/* Isolated WebGL Canvas Mount */}
          <div ref={mountRef} className="w-full h-full" />

          {/* External Imported 3D Mesh Preview Banner */}
          {externalMeshModel && (
            <div className="absolute top-2.5 left-3 z-20 flex items-center gap-2 px-2.5 py-1 bg-white/95 border border-[#60a5fa] shadow-sm rounded-[2px] text-[11px] text-[#0f172a] tabular-nums">
              <span className="px-1.5 py-0.5 bg-[#eff6ff] text-[#1d4ed8] font-semibold rounded-[2px] text-[10px]">
                外部 3D 模型查看
              </span>
              <span className="font-semibold truncate max-w-[180px]" title={externalMeshModel.name}>
                {externalMeshModel.name}
              </span>
              <span className="text-[#475569] hidden sm:inline">
                {externalMeshModel.stats.triangleCount.toLocaleString()} 面 · {externalMeshModel.stats.sizeMm[0]}×
                {externalMeshModel.stats.sizeMm[1]}×{externalMeshModel.stats.sizeMm[2]} mm
              </span>
              {onClearExternalModel && (
                <button
                  type="button"
                  onClick={onClearExternalModel}
                  className="ml-1 px-2 py-0.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[10.5px] rounded-[2px]"
                >
                  返回参数化模型
                </button>
              )}
            </div>
          )}

          {webglLost && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#f1f5f9] text-[#334155] text-sm">
              WebGL 渲染上下文已暂停，正在恢复视图…
            </div>
          )}

          {/* Projected 3D Nozzle Callout Tags (Page 8: N1, N2, N3...) */}
          {showNozzleTags &&
            projectedTags.map(
              (t) =>
                t.visible && (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectComponent(t.id)}
                    style={{
                      transform: `translate(${Math.round(t.x)}px, ${Math.round(t.y - 16)}px)`,
                    }}
                    className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 px-1 py-0 text-[12px] font-bold text-[#0f172a] bg-white/80 border border-[#94a3b8] rounded-[2px] shadow-xs hover:bg-[#dbeafe] pointer-events-auto cursor-pointer"
                  >
                    {t.tag}
                  </button>
                )
            )}

          {/* Interactive Chinese 3D ViewCube (top-right, matches Pages 4, 5, 8, 9, 20) */}
          <div
            className="absolute top-3 right-4 w-[66px] h-[66px] select-none pointer-events-auto"
            style={{ perspective: '240px' }}
            aria-label="三维视角导航魔方"
          >
            <div
              className="relative w-full h-full"
              style={{
                transformStyle: 'preserve-3d',
                transform: cubeTransform,
              }}
            >
              {(
                [
                  { label: '前', preset: 'front' as CameraViewPreset, tf: 'translateZ(22px)' },
                  { label: '后', preset: 'back' as CameraViewPreset, tf: 'rotateY(180deg) translateZ(22px)' },
                  { label: '右', preset: 'right' as CameraViewPreset, tf: 'rotateY(90deg) translateZ(22px)' },
                  { label: '左', preset: 'left' as CameraViewPreset, tf: 'rotateY(-90deg) translateZ(22px)' },
                  { label: '顶', preset: 'top' as CameraViewPreset, tf: 'rotateX(90deg) translateZ(22px)' },
                  { label: '底', preset: 'bottom' as CameraViewPreset, tf: 'rotateX(-90deg) translateZ(22px)' },
                ]
              ).map((face) => (
                <button
                  key={face.label}
                  type="button"
                  onClick={() => threeRef.current?.applyViewPreset(face.preset, false)}
                  style={{
                    transform: face.tf,
                    backfaceVisibility: 'hidden',
                  }}
                  className="absolute left-[11px] top-[11px] w-[44px] h-[44px] flex items-center justify-center bg-[#f1f5f9]/90 hover:bg-[#dbeafe] border border-[#64748b] text-[13px] font-semibold text-[#1e3a8a] cursor-pointer"
                >
                  {face.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom-left Coordinate Triad Indicator (matches Pages 5, 39) */}
          <div className="absolute bottom-2.5 left-3 pointer-events-none select-none">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <line x1="12" y1="32" x2="36" y2="32" stroke="#dc2626" strokeWidth="1.8" />
              <text x="37" y="35" fill="#dc2626" fontSize="9" fontWeight="700">X</text>
              <line x1="12" y1="32" x2="12" y2="8" stroke="#16a34a" strokeWidth="1.8" />
              <text x="9" y="7" fill="#16a34a" fontSize="9" fontWeight="700">Y</text>
              <line x1="12" y1="32" x2="25" y2="21" stroke="#2563eb" strokeWidth="1.8" />
              <text x="26" y="21" fill="#2563eb" fontSize="9" fontWeight="700">Z</text>
            </svg>
          </div>
        </div>
      </section>
    );
  }
);

Viewport3D.displayName = 'Viewport3D';
