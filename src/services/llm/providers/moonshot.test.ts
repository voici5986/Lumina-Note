import { describe, expect, it } from "vitest";

import { getRecommendedTemperature } from "../temperature";

describe("Moonshot temperature strategy", () => {
  it("uses high default temperature for thinking models", () => {
    expect(getRecommendedTemperature("moonshot", "kimi-k2-thinking")).toBe(1.0);
    expect(getRecommendedTemperature("moonshot", "KIMI-K2-THINKING-TURBO")).toBe(1.0);
  });

  it("uses high default temperature for k2.5 models", () => {
    expect(getRecommendedTemperature("moonshot", "kimi-k2.5")).toBe(1.0);
    expect(getRecommendedTemperature("moonshot", "moonshotai/kimi-k2.5")).toBe(1.0);
    expect(getRecommendedTemperature("moonshot", "kimi-k2-5")).toBe(1.0);
  });

  it("uses moderate defaults for non-thinking models", () => {
    expect(getRecommendedTemperature("moonshot", "moonshot-v1-128k")).toBe(0.7);
    expect(getRecommendedTemperature("moonshot", "kimi-k2-turbo-preview")).toBe(0.6);
  });
});
