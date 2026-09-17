interface MemoryPoint {
  cycle: number;
  usedJsHeapMb: number;
}

const WIDTH = 960;
const HEIGHT = 320;
const MARGIN = { top: 24, right: 24, bottom: 44, left: 56 };

function frame(title: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="Helvetica, Arial, sans-serif" font-size="12">
<rect width="${WIDTH}" height="${HEIGHT}" fill="#10233a"/>
<text x="${MARGIN.left}" y="16" fill="#f7e9c9" font-size="14" font-weight="bold">${title}</text>
${body}
</svg>
`;
}

export function renderFrameTimesChart(frameTimes: readonly number[]): string {
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxMs = Math.max(33.4, ...frameTimes);
  const points = frameTimes
    .map((ms, index) => {
      const x = MARGIN.left + (index / Math.max(1, frameTimes.length - 1)) * plotWidth;
      const y = MARGIN.top + plotHeight - (Math.min(ms, maxMs) / maxMs) * plotHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const budgetY = MARGIN.top + plotHeight - (16.67 / maxMs) * plotHeight;
  const seconds = frameTimes.reduce((sum, ms) => sum + ms, 0) / 1000;
  const ticks = [0, 8.33, 16.67, 25, 33.33]
    .filter((value) => value <= maxMs)
    .map((value) => {
      const y = MARGIN.top + plotHeight - (value / maxMs) * plotHeight;
      return `<line x1="${MARGIN.left}" x2="${WIDTH - MARGIN.right}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#2c4666" stroke-width="1"/>
<text x="${MARGIN.left - 8}" y="${(y + 4).toFixed(1)}" fill="#a9b7cc" text-anchor="end">${value.toFixed(1)} ms</text>`;
    })
    .join('\n');
  const body = `${ticks}
<line x1="${MARGIN.left}" x2="${WIDTH - MARGIN.right}" y1="${budgetY.toFixed(1)}" y2="${budgetY.toFixed(1)}" stroke="#f2c14e" stroke-dasharray="6 4"/>
<polyline points="${points}" fill="none" stroke="#5bd0ff" stroke-width="1"/>
<text x="${MARGIN.left}" y="${HEIGHT - 12}" fill="#a9b7cc">0 s</text>
<text x="${WIDTH - MARGIN.right}" y="${HEIGHT - 12}" fill="#a9b7cc" text-anchor="end">${seconds.toFixed(0)} s</text>
<text x="${WIDTH - MARGIN.right}" y="${(budgetY - 6).toFixed(1)}" fill="#f2c14e" text-anchor="end">16.67 ms budget (60 FPS)</text>`;
  return frame(`Frame time per rendered frame (${frameTimes.length} frames)`, body);
}

export function renderMemoryChart(samples: readonly MemoryPoint[]): string {
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxMb = Math.max(1, ...samples.map((sample) => sample.usedJsHeapMb)) * 1.15;
  const slot = plotWidth / Math.max(1, samples.length);
  const bars = samples
    .map((sample, index) => {
      const height = (sample.usedJsHeapMb / maxMb) * plotHeight;
      const x = MARGIN.left + index * slot + slot * 0.2;
      const y = MARGIN.top + plotHeight - height;
      const label = sample.cycle === 0 ? 'baseline' : `cycle ${sample.cycle}`;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(slot * 0.6).toFixed(1)}" height="${height.toFixed(1)}" fill="#f2c14e"/>
<text x="${(x + slot * 0.3).toFixed(1)}" y="${(y - 6).toFixed(1)}" fill="#f7e9c9" text-anchor="middle">${sample.usedJsHeapMb.toFixed(2)} MB</text>
<text x="${(x + slot * 0.3).toFixed(1)}" y="${HEIGHT - 12}" fill="#a9b7cc" text-anchor="middle">${label}</text>`;
    })
    .join('\n');
  return frame('Used JS heap after each start / play / leave cycle (after forced GC)', bars);
}
