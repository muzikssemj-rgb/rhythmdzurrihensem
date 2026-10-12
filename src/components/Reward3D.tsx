import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

// Animasi ganjaran 3D ringan (bintang emas berputar + zarah). Dimuat secara malas.

function starShape(outer = 1, inner = 0.45, points = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function Star({ x, delay, scale }: { x: number; delay: number; scale: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.ExtrudeGeometry(starShape(), { depth: 0.25, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2 }), []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = Math.max(0, clock.elapsedTime - delay);
    const s = Math.min(1, t * 2.2) * scale;
    m.scale.setScalar(s * (1 + Math.sin(t * 3) * 0.04));
    m.rotation.y = t * 1.6;
    m.position.y = 0.4 + Math.sin(t * 1.5) * 0.12;
  });
  return (
    <mesh ref={ref} geometry={geo} position={[x, 0.4, 0]} scale={0}>
      <meshStandardMaterial color="#fcd34d" emissive="#f59e0b" emissiveIntensity={0.55} metalness={0.6} roughness={0.25} />
    </mesh>
  );
}

function Particles({ count = 160 }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, speeds } = useMemo(() => {
    const p = new Float32Array(count * 3);
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 9;
      p[i * 3 + 1] = (Math.random() - 0.5) * 5;
      p[i * 3 + 2] = (Math.random() - 0.5) * 2;
      s[i] = 0.2 + Math.random() * 0.6;
    }
    return { positions: p, speeds: s };
  }, [count]);
  useFrame((_, dt) => {
    const pts = ref.current;
    if (!pts) return;
    const arr = pts.geometry.attributes.position!.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1]! += speeds[i]! * dt;
      if (arr[i * 3 + 1]! > 2.8) arr[i * 3 + 1] = -2.8;
    }
    pts.geometry.attributes.position!.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#67e8f9" transparent opacity={0.8} />
    </points>
  );
}

export default function Reward3D({ stars }: { stars: number }) {
  const n = Math.max(1, stars);
  const xs = n === 1 ? [3] : n === 2 ? [2.4, 3.6] : [2, 3, 4];
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <pointLight position={[-3, -2, 3]} intensity={8} color="#a78bfa" />
      {xs.map((x, i) => (
        <Star key={i} x={x} delay={0.3 + i * 0.25} scale={i === Math.floor(xs.length / 2) ? 0.75 : 0.6} />
      ))}
      <Particles />
    </Canvas>
  );
}
