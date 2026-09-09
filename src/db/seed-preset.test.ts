import { describe, expect, it } from "vitest";
import { presetUntukThreshold, THRESHOLD_PRESETS, thresholdDariPreset } from "./thresholdPresets";

describe("presetUntukThreshold — 6 → 4 mapping", () => {
  it("[7,3,1] → 🥛", () => {
    expect(presetUntukThreshold([7, 3, 1]).emoji).toBe("🥛");
  });
  it("[14,7,3] → 📦", () => {
    expect(presetUntukThreshold([14, 7, 3]).emoji).toBe("📦");
  });
  it("[30,14,7] → 🌾", () => {
    expect(presetUntukThreshold([30, 14, 7]).emoji).toBe("🌾");
  });
  it("[60,30,14] → 🪨", () => {
    expect(presetUntukThreshold([60, 30, 14]).emoji).toBe("🪨");
  });
  it("[90,30,14] → 🪨 (FALLBACK)", () => {
    expect(presetUntukThreshold([90, 30, 14]).emoji).toBe("🪨");
  });
  it("[180,90,30] → 🪨 (FALLBACK)", () => {
    expect(presetUntukThreshold([180, 90, 30]).emoji).toBe("🪨");
  });
  it("non-menurun → preset terdekat", () => {
    expect(presetUntukThreshold([1, 2, 3]).emoji).toBe("🥛"); // terdekat ke [7,3,1]
  });
});

describe("thresholdDariPreset", () => {
  it("🥛 → [7,3,1]", () => {
    expect(thresholdDariPreset("🥛")).toEqual([7, 3, 1]);
  });
  it("📦 → [14,7,3]", () => {
    expect(thresholdDariPreset("📦")).toEqual([14, 7, 3]);
  });
  it("🌾 → [30,14,7]", () => {
    expect(thresholdDariPreset("🌾")).toEqual([30, 14, 7]);
  });
  it("🪨 → [60,30,14]", () => {
    expect(thresholdDariPreset("🪨")).toEqual([60, 30, 14]);
  });
  it("emoji tidak ada → undefined", () => {
    expect(thresholdDariPreset("❌")).toBeUndefined();
  });
});

describe("THRESHOLD_PRESETS", () => {
  it("tepat 4 preset", () => {
    expect(THRESHOLD_PRESETS).toHaveLength(4);
  });
  it("label Bahasa Indonesia", () => {
    const labels = THRESHOLD_PRESETS.map((p) => p.label);
    expect(labels).toEqual(["Susu/Segar", "Snack/Kering", "Semikonstan", "Tahan"]);
  });
});
