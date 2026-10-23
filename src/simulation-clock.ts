/** Gameplay always advances in 1/60 s steps, independently of display refresh rate. */
export class SimulationClock {
  private accumulator = 0;
  readonly stepSeconds = 1 / 60;

  reset(): void {
    this.accumulator = 0;
  }

  advance(realSeconds: number, speed: number, update: (dt: number) => void): number {
    if (!Number.isFinite(realSeconds) || realSeconds <= 0) return 0;
    this.accumulator += Math.min(realSeconds, 0.1) * Math.max(0, Math.min(8, speed));
    let steps = 0;
    while (this.accumulator + 1e-9 >= this.stepSeconds) {
      this.accumulator -= this.stepSeconds;
      update(this.stepSeconds);
      steps++;
    }
    return steps;
  }
}
