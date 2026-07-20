import { useRef, useEffect, useState, useCallback } from 'react';
import { useApp } from '../hooks/useApp';

export default function SpeedGraph() {
  const { state } = useApp();
  const canvasRef = useRef(null);
  const [samples, setSamples] = useState([]);

  useEffect(() => {
    const active = state.transfers.filter(t => !t.complete && !t.error);
    if (active.length === 0) {
      if (samples.length > 0) setSamples([]);
      return;
    }
    const interval = setInterval(() => {
      const totalSpeed = active.reduce((sum, t) => {
        const match = t.status?.match(/\(([\d.]+)\s*(KB\/s|MB\/s)\)/);
        if (match) {
          const val = parseFloat(match[1]);
          return sum + (match[2] === 'MB/s' ? val * 1024 : val);
        }
        return sum;
      }, 0);
      setSamples(prev => [...prev, { speed: totalSpeed, ts: Date.now() }].slice(-60));
    }, 1000);
    return () => clearInterval(interval);
  }, [state.transfers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || samples.length < 2) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth * 2;
    const h = canvas.height = canvas.clientHeight * 2;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, w / 2, h / 2);

    const maxSpeed = Math.max(...samples.map(s => s.speed), 1);
    const pad = 4;
    const gw = (w / 2) - pad * 2;
    const gh = (h / 2) - pad * 2;

    ctx.strokeStyle = '#4aa3ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    samples.forEach((s, i) => {
      const x = pad + (i / (samples.length - 1)) * gw;
      const y = pad + gh - (s.speed / maxSpeed) * gh;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = 'rgba(74, 163, 255, 0.1)';
    ctx.lineTo(pad + gw, pad + gh);
    ctx.lineTo(pad, pad + gh);
    ctx.closePath();
    ctx.fill();

    if (samples.length > 0) {
      const latest = samples[samples.length - 1].speed;
      ctx.fillStyle = '#7e8aa0';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(`${latest > 1024 ? (latest / 1024).toFixed(1) + ' MB/s' : latest.toFixed(0) + ' KB/s'}`, pad, 12);
    }
  }, [samples]);

  return (
    <div className="speed-graph">
      <div className="panel-header">
        <h3>Speed</h3>
        <button className="btn small" onClick={() => setSamples([])}>Clear</button>
      </div>
      <canvas ref={canvasRef} className="speed-graph-canvas" />
    </div>
  );
}
