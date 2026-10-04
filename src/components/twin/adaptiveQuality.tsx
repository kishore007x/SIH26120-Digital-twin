// Frame-rate–driven quality fallback shared by the 3D canvases.
// Step 1 drops the pixel ratio to 1; step 2 also turns off ambient-occlusion post-processing.
// Only ever steps down within a session, so the view never oscillates.
import { useCallback, useState } from 'react';
import { PerformanceMonitor } from '@react-three/drei';

export function useAdaptiveQuality(maxDpr = 1.5) {
  const [level, setLevel] = useState(0);
  const decline = useCallback(() => setLevel((l) => Math.min(2, l + 1)), []);
  return {
    dpr: level >= 1 ? 1 : ([1, maxDpr] as [number, number]),
    /** false once the frame rate forced post-processing off */
    allowPost: level < 2,
    monitor: <PerformanceMonitor bounds={() => [40, 55]} flipflops={Infinity} onDecline={decline} />,
  };
}
