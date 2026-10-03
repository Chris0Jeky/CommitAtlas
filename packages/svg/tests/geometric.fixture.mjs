export const keys = ["focus", "shipping", "collaboration", "consistency", "breadth", "stewardship"];
export const fixtures = {
  orbit: { rings: [0.3, 0.6, 1], bodies: [{ ring: 0, angle: 40, size: 4, label: "A" }, { ring: 2, angle: 190, size: 7, label: "B" }] },
  radar: { axes: keys, values: [0.2, 0.7, 0.4, 0.9, 0.3, 0.5] },
  terrain: { series: [0, 2, 4, 0, 0, 8, 3], peaks: [{ index: 5, label: "Release" }] },
  timeline: { stations: ["planned", "active", "maintenance", "paused", "archived"], position: 0.25 },
  projectNode: { label: "Synthetic project", disclosure: "public", language: "TypeScript", size: 0.6 },
  sparkline: { series: [0, 2, 4, 0, 0, 8, 3] },
};
