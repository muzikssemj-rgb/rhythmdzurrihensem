import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { SessionSnapshot } from '@/features/rhythm-practice/sessionEngine';
import type { LiveJudgement } from '@/features/rhythm-practice/usePracticeSession';

// ============================================================
// Lapisan 3D AR (Three.js / React Three Fiber) di atas video kamera:
//  • Trek detik 3D — orb menyala mengikut JAM AUDIO (bukan frame rate)
//  • Letupan bintang/cahaya untuk tepukan tepat
//  • Not muzik 3D terapung (dekoratif, bilangan kecil untuk prestasi)
// ============================================================

const JCOLOR: Record<LiveJudgement, string> = {
  perfect: '#4ade80',
  ontime: '#22d3ee',
  early: '#fbbf24',
  late: '#fb923c',
  extra: '#c084fc',
  rest: '#f43f5e',
};

function BeatTrack({ beats, getSnapshot }: { beats: number; getSnapshot: () => SessionSnapshot | null }) {
  const group = useRef<THREE.Group>(null);
  const orbs = useRef<THREE.Mesh[]>([]);
  const { viewport } = useThree();
  const spacing = Math.min(1.1, (viewport.width * 0.7) / Math.max(1, beats));
  const radius = Math.min(0.18, spacing * 0.22);
  useFrame(({ clock }) => {
    const s = getSnapshot();
    const active = s && (s.phase === 'playing' || s.phase === 'countin') ? s.beatInBar : -1;
    // kecerahan reput dalam detik (diselaraskan dengan masa muzik)
    const frac = s ? ((s.musicTime / 1) % 1 + 1) % 1 : 0;
    orbs.current.forEach((m, i) => {
      if (!m) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      const on = i === active;
      const target = on ? 1.45 - Math.min(0.4, frac * 0.4) : 1;
      m.scale.lerp(new THREE.Vector3(target, target, target), 0.35);
      mat.emissiveIntensity = on ? 2.2 : 0.35;
      mat.color.set(on ? (i === 0 ? '#fcd34d' : '#22d3ee') : '#64748b');
      mat.emissive.set(on ? (i === 0 ? '#f59e0b' : '#06b6d4') : '#1e1b4b');
    });
    if (group.current) group.current.rotation.x = -0.25 + Math.sin(clock.elapsedTime * 0.6) * 0.03;
  });
  return (
    <group ref={group} position={[0, -viewport.height * 0.02, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[(spacing * beats) / 2 + 0.3, 0.02, 8, 64, Math.PI]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.6} />
      </mesh>
      {Array.from({ length: beats }, (_, i) => (
        <mesh key={i} position={[(i - (beats - 1) / 2) * spacing, 0, 0]} ref={(el) => void (el && (orbs.current[i] = el))}>
          <sphereGeometry args={[radius, 24, 24]} />
          <meshStandardMaterial color="#64748b" emissive="#1e1b4b" roughness={0.3} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

interface Burst {
  born: number;
  color: THREE.Color;
  origin: THREE.Vector3;
  big: boolean;
}

const MAX_P = 240;

function Bursts({ judgement }: { judgement: { j: LiveJudgement; n: number } | null }) {
  const pts = useRef<THREE.Points>(null);
  const bursts = useRef<Burst[]>([]);
  const { viewport, clock } = useThree();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_P * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_P * 3), 3));
    return g;
  }, []);
  const dirs = useMemo(() => Array.from({ length: 40 }, () => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize()), []);

  useEffect(() => {
    if (!judgement) return;
    const good = judgement.j === 'perfect' || judgement.j === 'ontime';
    bursts.current.push({
      born: clock.elapsedTime,
      color: new THREE.Color(JCOLOR[judgement.j]),
      origin: new THREE.Vector3((Math.random() - 0.5) * viewport.width * 0.5, -viewport.height * 0.05, 0.5),
      big: good,
    });
    if (bursts.current.length > 6) bursts.current.shift();
  }, [judgement, clock, viewport]);

  useFrame(({ clock: c }) => {
    const pos = geo.attributes.position!.array as Float32Array;
    const col = geo.attributes.color!.array as Float32Array;
    let k = 0;
    for (const b of bursts.current) {
      const age = c.elapsedTime - b.born;
      if (age > 0.9) continue;
      const n = b.big ? 40 : 16;
      const r = (b.big ? 2.2 : 1.1) * age;
      const fade = 1 - age / 0.9;
      for (let i = 0; i < n && k < MAX_P; i++, k++) {
        const d = dirs[i]!;
        pos[k * 3] = b.origin.x + d.x * r;
        pos[k * 3 + 1] = b.origin.y + d.y * r - age * age * 1.5;
        pos[k * 3 + 2] = b.origin.z + d.z * r;
        col[k * 3] = b.color.r * fade;
        col[k * 3 + 1] = b.color.g * fade;
        col[k * 3 + 2] = b.color.b * fade;
      }
    }
    for (; k < MAX_P; k++) {
      pos[k * 3] = 9999;
      pos[k * 3 + 1] = 9999;
    }
    geo.attributes.position!.needsUpdate = true;
    geo.attributes.color!.needsUpdate = true;
    if (pts.current) pts.current.visible = bursts.current.length > 0;
  });

  return (
    <points ref={pts} geometry={geo}>
      <pointsMaterial size={0.11} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function FloatingNote({ seed }: { seed: number }) {
  const ref = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const r = useMemo(() => {
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    return { x: (rnd() - 0.5) * viewport.width * 0.95, y: (rnd() - 0.5) * viewport.height * 0.8, sp: 0.3 + rnd() * 0.5, ph: rnd() * 6 };
  }, [seed, viewport]);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * r.sp + r.ph;
    g.position.set(r.x + Math.sin(t) * 0.25, r.y + Math.cos(t * 0.8) * 0.3, -1.5);
    g.rotation.z = Math.sin(t) * 0.3;
    g.rotation.y = t * 0.6;
  });
  return (
    <group ref={ref} scale={0.45}>
      <mesh rotation={[0, 0, -0.35]}>
        <sphereGeometry args={[0.32, 20, 16]} />
        <meshStandardMaterial color="#fcd34d" emissive="#b45309" emissiveIntensity={0.4} metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh position={[0.28, 0.75, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.5, 8]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
    </group>
  );
}

export function ArScene({
  beats,
  getSnapshot,
  judgement,
  reducedMotion,
}: {
  beats: number;
  getSnapshot: () => SessionSnapshot | null;
  judgement: { j: LiveJudgement; n: number } | null;
  reducedMotion: boolean;
}) {
  return (
    <Canvas
      className="!absolute inset-0"
      camera={{ position: [0, 0, 6], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      style={{ pointerEvents: 'none' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 4, 5]} intensity={1.4} />
      <BeatTrack beats={beats} getSnapshot={getSnapshot} />
      {!reducedMotion && <Bursts judgement={judgement} />}
      {!reducedMotion && [1, 2, 3, 4].map((s) => <FloatingNote key={s} seed={s} />)}
    </Canvas>
  );
}
