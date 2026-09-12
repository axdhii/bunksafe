import React, { useEffect, useRef, useState } from 'react';

interface BackgroundGradientAnimationProps {
  gradientBackgroundStart?: string;
  gradientBackgroundEnd?: string;
  firstColor?: string;
  secondColor?: string;
  thirdColor?: string;
  fourthColor?: string;
  fifthColor?: string;
  pointerColor?: string;
  size?: string;
  blendingValue?: string;
  children?: React.ReactNode;
  className?: string;
  interactive?: boolean;
  containerClassName?: string;
}

export const BackgroundGradientAnimation: React.FC<BackgroundGradientAnimationProps> = ({
  gradientBackgroundStart = 'rgb(0, 0, 0)',
  gradientBackgroundEnd = 'rgb(0, 0, 0)',
  firstColor = '255, 255, 255',
  secondColor = '161, 161, 170',
  thirdColor = '113, 113, 122',
  fourthColor = '82, 82, 91',
  fifthColor = '39, 39, 42',
  pointerColor = '255, 255, 255',
  size = '80%',
  blendingValue = 'hard-light',
  children,
  className = '',
  interactive = true,
  containerClassName = '',
}) => {
  const interactiveRef = useRef<HTMLDivElement>(null);
  const [curX, setCurX] = useState(0);
  const [curY, setCurY] = useState(0);
  const [tgX, setTgX] = useState(0);
  const [tgY, setTgY] = useState(0);

  useEffect(() => {
    let animationFrameId: number;

    const move = () => {
      setCurX((prev) => prev + (tgX - prev) * 0.1);
      setCurY((prev) => prev + (tgY - prev) * 0.1);
      animationFrameId = requestAnimationFrame(move);
    };

    animationFrameId = requestAnimationFrame(move);
    return () => cancelAnimationFrame(animationFrameId);
  }, [tgX, tgY]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (interactiveRef.current) {
      const rect = interactiveRef.current.getBoundingClientRect();
      setTgX(event.clientX - rect.left);
      setTgY(event.clientY - rect.top);
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className={`relative w-full h-full overflow-hidden top-0 left-0 bg-[linear-gradient(40deg,var(--gradient-background-start),var(--gradient-background-end))] ${containerClassName}`}
      style={
        {
          '--gradient-background-start': gradientBackgroundStart,
          '--gradient-background-end': gradientBackgroundEnd,
          '--first-color': firstColor,
          '--second-color': secondColor,
          '--third-color': thirdColor,
          '--fourth-color': fourthColor,
          '--fifth-color': fifthColor,
          '--pointer-color': pointerColor,
          '--size': size,
          '--blending-value': blendingValue,
        } as React.CSSProperties
      }
    >
      {/* SVG filter for organic liquid distortion */}
      <svg className="hidden">
        <defs>
          <filter id="blurMe">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {/* Animated Gradient Circles Mesh */}
      <div className="gradients-container absolute inset-0 [filter:url(#blurMe)_blur(40px)] pointer-events-none opacity-40">
        <div
          className="absolute [background:radial-gradient(circle_at_center,_var(--first-color)_0,_var(--first-color)_50%)_no-repeat] [mix-blend-mode:var(--blending-value)] w-[var(--size)] h-[var(--size)] top-[calc(50%-var(--size)/2)] left-[calc(50%-var(--size)/2)] [transform-origin:center_center] animate-first opacity-100"
          style={{ background: `radial-gradient(circle at center, rgba(${firstColor}, 0.8) 0, rgba(${firstColor}, 0) 50%)` }}
        />
        <div
          className="absolute [background:radial-gradient(circle_at_center,_rgba(var(--second-color),_0.8)_0,_rgba(var(--second-color),_0)_50%)_no-repeat] [mix-blend-mode:var(--blending-value)] w-[var(--size)] h-[var(--size)] top-[calc(50%-var(--size)/2)] left-[calc(50%-var(--size)/2)] [transform-origin:calc(50%-400px)] animate-second opacity-100"
          style={{ background: `radial-gradient(circle at center, rgba(${secondColor}, 0.8) 0, rgba(${secondColor}, 0) 50%)` }}
        />
        <div
          className="absolute [background:radial-gradient(circle_at_center,_rgba(var(--third-color),_0.8)_0,_rgba(var(--third-color),_0)_50%)_no-repeat] [mix-blend-mode:var(--blending-value)] w-[var(--size)] h-[var(--size)] top-[calc(50%-var(--size)/2)] left-[calc(50%-var(--size)/2)] [transform-origin:calc(50%+400px)] animate-third opacity-100"
          style={{ background: `radial-gradient(circle at center, rgba(${thirdColor}, 0.8) 0, rgba(${thirdColor}, 0) 50%)` }}
        />

        {interactive && (
          <div
            ref={interactiveRef}
            className="absolute [mix-blend-mode:var(--blending-value)] w-[250px] h-[250px] -top-[125px] -left-[125px] rounded-full opacity-70 pointer-events-none transition-transform duration-75"
            style={{
              background: `radial-gradient(circle at center, rgba(${pointerColor}, 0.6) 0, rgba(${pointerColor}, 0) 50%)`,
              transform: `translate(${curX}px, ${curY}px)`,
            }}
          />
        )}
      </div>

      <div className={`relative z-10 ${className}`}>{children}</div>
    </div>
  );
};
