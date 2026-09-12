import React, { useState, useEffect } from 'react';

interface Ripple {
  x: number;
  y: number;
  id: number;
}

export const InteractiveBackground: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const newRipple = { x: e.clientX, y: e.clientY, id: Date.now() };
      setRipples((prev) => [...prev.slice(-4), newRipple]);
    };

    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-black text-zinc-100 overflow-x-hidden font-sans">
      {/* Background Subtle Grid Pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Subtle Ambient Vignette Lighting */}
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Interactive Click/Tap Energy Pulse Waves */}
      {ripples.map((r) => (
        <div
          key={r.id}
          className="fixed pointer-events-none rounded-full border border-white/20 animate-[ping_1.2s_cubic-bezier(0,0,0.2,1)_forwards]"
          style={{
            left: r.x - 30,
            top: r.y - 30,
            width: 60,
            height: 60,
            boxShadow: '0 0 40px rgba(255, 255, 255, 0.05)',
          }}
        />
      ))}

      <div className="relative z-10">{children}</div>
    </div>
  );
};
