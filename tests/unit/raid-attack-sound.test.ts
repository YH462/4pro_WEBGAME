import { describe, expect, it } from "vitest";
import { raidCounterSamples, raidImpactSamples } from "../../src/lib/raid-attack-sound";

describe("shared raid impact", () => {
  it.each([32000, 44100, 48000])("gives the boss a distinct, bounded breath impact at %i Hz", rate => {
    const samples = raidCounterSamples(rate), critical = raidImpactSamples(rate, true);
    expect(Math.abs(samples[0])).toBe(0); expect(Math.abs(samples.at(-1)!)).toBe(0);
    expect(samples.every(sample => Number.isFinite(sample) && Math.abs(sample) <= .65)).toBe(true);
    const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
    expect(rms).toBeGreaterThan(.05); expect(rms).toBeLessThan(.3);
    expect(samples.length / rate).toBeCloseTo(1.3, 3);
    expect([...samples.slice(0, critical.length)]).not.toEqual([...critical]);
    expect(samples.slice(rate).some(sample => Math.abs(sample) > .001)).toBe(true);
  });
  it.each([32000, 44100, 48000])("produces bounded, audible, click-free envelopes at %i Hz", rate => {
    for (const critical of [false, true]) {
      const samples = raidImpactSamples(rate, critical);
      expect(Math.abs(samples[0])).toBe(0); expect(Math.abs(samples.at(-1)!)).toBe(0);
      expect(samples.every(sample => Number.isFinite(sample) && Math.abs(sample) <= .65)).toBe(true);
      const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
      expect(rms).toBeGreaterThan(.05); expect(rms).toBeLessThan(.3);
      expect(samples.length / rate).toBeLessThanOrEqual(.9);
    }
    const normal = raidImpactSamples(rate, false), critical = raidImpactSamples(rate, true);
    expect(critical.length).toBeGreaterThan(normal.length);
    expect([...critical.slice(0, normal.length)]).not.toEqual([...normal]);
    const bassFraction = (samples: Float32Array) => {
      const alpha = 1 - Math.exp(-2 * Math.PI * 120 / rate);
      let low = 0, bass = 0, total = 0;
      for (const sample of samples) { low += (sample - low) * alpha; bass += low * low; total += sample * sample; }
      return bass / total;
    };
    // Critical hits must differ in timbre, not just gain or duration.
    expect(bassFraction(critical)).toBeGreaterThan(bassFraction(normal) * 1.2);
  });
});
