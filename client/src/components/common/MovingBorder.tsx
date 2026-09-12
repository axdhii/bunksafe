import React from 'react';
import { motion } from 'framer-motion';

interface ButtonWithMovingBorderProps {
  children: React.ReactNode;
  as?: any;
  containerClassName?: string;
  className?: string;
  borderClassName?: string;
  duration?: number;
  borderRadius?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export const ButtonWithMovingBorder: React.FC<ButtonWithMovingBorderProps> = ({
  children,
  as: Component = 'button',
  containerClassName = '',
  className = '',
  borderClassName = '',
  duration = 3000,
  borderRadius = '1.25rem',
  onClick,
  disabled,
}) => {
  return (
    <Component
      onClick={onClick}
      disabled={disabled}
      className={`relative p-[1px] overflow-hidden bg-transparent ${containerClassName}`}
      style={{ borderRadius }}
    >
      <div
        className="absolute inset-0"
        style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}
      >
        <motion.div
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: duration / 1000,
            repeat: Infinity,
            ease: 'linear',
          }}
          className={`w-[200%] h-[200%] -left-1/2 -top-1/2 absolute bg-[conic-gradient(from_0deg,transparent_0_340deg,#ffffff_360deg)] opacity-70 ${borderClassName}`}
        />
      </div>

      <div
        className={`relative bg-black/90 backdrop-blur-xl text-white flex items-center justify-center w-full h-full text-xs font-bold ${className}`}
        style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}
      >
        {children}
      </div>
    </Component>
  );
};
