import { Suspense, lazy } from "react";
import { cn } from "@/lib/utils";

const Spline = lazy(() => import("@splinetool/react-spline"));

interface SplineSceneProps {
  scene: string;
  className?: string;
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  return (
    <Suspense
      fallback={
        <div className={cn("flex h-full w-full items-center justify-center", className)}>
          <span className="spline-loader" aria-hidden="true" />
          <span className="sr-only">Cargando escena 3D…</span>
        </div>
      }
    >
      <Spline scene={scene} className={className} />
    </Suspense>
  );
}
