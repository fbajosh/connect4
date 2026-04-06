type Wisp = {
  angle: number;
  depth: number;
  drift: number;
  lane: number;
  opacity: number;
  scale: number;
  speed: number;
};

type MoggedBackgroundController = {
  setEnabled: (enabled: boolean) => void;
};

const WISP_COUNT = 96;
const MIN_GREY = 0x00;
const MAX_GREY = 0x30;

function randomWisp(depth = Math.random()): Wisp {
  return {
    angle: Math.random() * Math.PI * 2,
    depth,
    drift: (Math.random() - 0.5) * 1.25,
    lane: 0.68 + Math.random() * 0.42,
    opacity: 0.04 + Math.random() * 0.05,
    scale: 0.55 + Math.random() * 1.1,
    speed: 0.15 + Math.random() * 0.32,
  };
}

function greyAt(depth: number): number {
  return Math.round(MIN_GREY + (MAX_GREY - MIN_GREY) * depth);
}

export function createMoggedBackground(canvas: HTMLCanvasElement): MoggedBackgroundController {
  const context = canvas.getContext("2d");
  if (!context) {
    return {
      setEnabled: () => {
        // Canvas 2D unavailable; leave the background static.
      },
    };
  }

  const wisps = Array.from({ length: WISP_COUNT }, () => randomWisp());
  let animationFrame = 0;
  let enabled = false;
  let height = 0;
  let lastTimestamp = 0;
  let width = 0;

  function resize(): void {
    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.max(1, Math.round(width * devicePixelRatio));
    canvas.height = Math.max(1, Math.round(height * devicePixelRatio));
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function drawBackground(timeMs: number): void {
    const minDimension = Math.min(width, height);
    const centerX = width / 2;
    const centerY = height / 2;
    const time = timeMs * 0.00024;

    context.clearRect(0, 0, width, height);

    const baseGradient = context.createRadialGradient(centerX, centerY, minDimension * 0.02, centerX, centerY, minDimension * 0.92);
    baseGradient.addColorStop(0, "#000000");
    baseGradient.addColorStop(0.52, "#141414");
    baseGradient.addColorStop(1, "#303030");
    context.fillStyle = baseGradient;
    context.fillRect(0, 0, width, height);

    const vortexGradient = context.createRadialGradient(centerX, centerY, minDimension * 0.04, centerX, centerY, minDimension * 0.36);
    vortexGradient.addColorStop(0, "rgba(0, 0, 0, 0.72)");
    vortexGradient.addColorStop(0.58, "rgba(24, 24, 24, 0.25)");
    vortexGradient.addColorStop(1, "rgba(24, 24, 24, 0)");
    context.fillStyle = vortexGradient;
    context.fillRect(0, 0, width, height);

    context.globalCompositeOperation = "screen";
    for (const wisp of wisps) {
      const tunnelRadius = Math.pow(wisp.depth, 1.2) * minDimension * wisp.lane;
      const angle = wisp.angle + time * (0.85 + wisp.drift);
      const x = centerX + Math.cos(angle) * tunnelRadius;
      const y = centerY + Math.sin(angle) * tunnelRadius * 0.7;
      const radius = (0.03 + wisp.scale * 0.055) * minDimension * (0.22 + wisp.depth * 1.15);
      const grey = greyAt(0.15 + wisp.depth * 0.85);
      const alpha = wisp.opacity * (0.28 + wisp.depth * 0.95);
      const cloud = context.createRadialGradient(x - radius * 0.16, y - radius * 0.14, radius * 0.08, x, y, radius);
      cloud.addColorStop(0, `rgba(${grey}, ${grey}, ${grey}, ${alpha})`);
      cloud.addColorStop(0.44, `rgba(${grey}, ${grey}, ${grey}, ${alpha * 0.58})`);
      cloud.addColorStop(1, `rgba(${grey}, ${grey}, ${grey}, 0)`);
      context.fillStyle = cloud;
      context.beginPath();
      context.ellipse(x, y, radius * 1.45, radius * 0.82, angle, 0, Math.PI * 2);
      context.fill();
    }
    context.globalCompositeOperation = "source-over";

    const vignette = context.createRadialGradient(centerX, centerY, minDimension * 0.28, centerX, centerY, minDimension * 0.98);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(0.8, "rgba(0, 0, 0, 0.16)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.28)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);
  }

  function step(timestamp: number): void {
    if (!enabled) {
      animationFrame = 0;
      return;
    }

    if (lastTimestamp === 0) {
      lastTimestamp = timestamp;
    }

    const deltaSeconds = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
    lastTimestamp = timestamp;

    for (let index = 0; index < wisps.length; index += 1) {
      const wisp = wisps[index];
      wisp.depth += wisp.speed * deltaSeconds;
      if (wisp.depth >= 1.02) {
        wisps[index] = randomWisp(0.02 + Math.random() * 0.08);
      }
    }

    drawBackground(timestamp);
    animationFrame = window.requestAnimationFrame(step);
  }

  function syncAnimationState(): void {
    if (!enabled) {
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      lastTimestamp = 0;
      context.clearRect(0, 0, width, height);
      return;
    }

    resize();
    drawBackground(lastTimestamp || performance.now());
    if (animationFrame === 0) {
      animationFrame = window.requestAnimationFrame(step);
    }
  }

  window.addEventListener("resize", resize);

  return {
    setEnabled(nextEnabled: boolean): void {
      enabled = nextEnabled;
      syncAnimationState();
    },
  };
}
