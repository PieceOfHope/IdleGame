export function createGameLoop({ tickMs, onTick, onRender }) {
  let rafId = null;
  let lastTime = 0;
  let accumulator = 0;
  const maxAccumulatorMs = tickMs * 10; // 탭 비활성/스로틀 이후 급격한 캐치업(스파이럴) 방지

  function frame(time) {
    const frameDelta = time - lastTime;
    lastTime = time;
    accumulator = Math.min(accumulator + frameDelta, maxAccumulatorMs);
    while (accumulator >= tickMs) {
      onTick(tickMs / 1000);
      accumulator -= tickMs;
    }
    onRender();
    rafId = requestAnimationFrame(frame);
  }

  return {
    start() {
      lastTime = performance.now();
      accumulator = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    },
    resetClock() {
      lastTime = performance.now();
      accumulator = 0;
    },
  };
}
