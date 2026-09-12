import React, { useEffect, useRef } from 'react';

interface AuroraShaderCanvasProps {
  className?: string;
  speedMultiplier?: number;
}

export const AuroraShaderCanvas: React.FC<AuroraShaderCanvasProps> = ({
  className = '',
  speedMultiplier = 1.0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    // Monochrome Liquid Glass Wave parameters
    const waves = [
      { color: 'rgba(255, 255, 255, 0.04)', frequency: 0.003, amplitude: 80, speed: 0.006 },
      { color: 'rgba(255, 255, 255, 0.025)', frequency: 0.0025, amplitude: 100, speed: 0.009 },
      { color: 'rgba(255, 255, 255, 0.02)', frequency: 0.004, amplitude: 60, speed: 0.005 },
      { color: 'rgba(255, 255, 255, 0.015)', frequency: 0.002, amplitude: 120, speed: 0.008 },
    ];

    const render = () => {
      time += 1 * speedMultiplier;
      const width = canvas.width;
      const height = canvas.height;

      // Pure Native Black Base
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Render layered fluid mathematical sine waves
      waves.forEach((wave, idx) => {
        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let x = 0; x <= width; x += 10) {
          const y =
            height / 2 +
            Math.sin(x * wave.frequency + time * wave.speed + idx) * wave.amplitude +
            Math.cos((x + time) * 0.001) * 30;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, wave.color);
        gradient.addColorStop(1, 'rgba(9, 13, 22, 0.0)');
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // Subtle ambient glowing light orb in background
      const orbX = width * 0.7 + Math.sin(time * 0.005) * 100;
      const orbY = height * 0.3 + Math.cos(time * 0.005) * 60;
      const orbGradient = ctx.createRadialGradient(orbX, orbY, 10, orbX, orbY, Math.min(width, height) * 0.6);
      orbGradient.addColorStop(0, 'rgba(124, 58, 237, 0.15)');
      orbGradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.08)');
      orbGradient.addColorStop(1, 'rgba(9, 13, 22, 0.0)');
      ctx.fillStyle = orbGradient;
      ctx.fillRect(0, 0, width, height);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [speedMultiplier]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  );
};
