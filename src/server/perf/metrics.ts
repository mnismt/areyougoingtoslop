const samples: number[] = [];
const MAX_SAMPLES = 200;

export const recordScoreTiming = (durationMs: number) => {
  samples.push(durationMs);
  if (samples.length > MAX_SAMPLES) {
    samples.shift();
  }
};

export const getScoreP95 = () => {
  if (samples.length === 0) {
    return null;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, index)];
};
