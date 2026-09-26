import React, { useEffect, useRef } from 'react';

interface VoiceAudioWaveformProps {
  isActive: boolean;
  state: 'idle' | 'listening' | 'parsing' | 'working' | 'ready';
}

export const VoiceAudioWaveform: React.FC<VoiceAudioWaveformProps> = ({ isActive, state }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Color scheme based on state
      let strokeColor = '#3b82f6';
      if (state === 'listening') strokeColor = '#ef4444';
      else if (state === 'parsing') strokeColor = '#f59e0b';
      else if (state === 'working') strokeColor = '#38bdf8';
      else strokeColor = '#10b981';

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();

      const numPoints = 64;
      for (let i = 0; i <= numPoints; i++) {
        const x = (i / numPoints) * width;
        let amplitude = isActive ? (state === 'listening' ? 14 : 7) : 1.5;

        // Wave math
        const y =
          centerY +
          Math.sin(i * 0.2 + phase) * amplitude * Math.sin((i / numPoints) * Math.PI) +
          Math.cos(i * 0.4 - phase * 0.8) * (amplitude * 0.5);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      phase += isActive ? 0.12 : 0.03;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive, state]);

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-[#0d1424] rounded-lg border border-[#1e2a40]">
      <canvas ref={canvasRef} width={140} height={24} className="rounded" />
    </div>
  );
};
