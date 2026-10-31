import { describe, expect, it } from "vitest";
import { characterLocationHint, type LocationHintContent } from "../../src/lib/character-location-hints";

const overview = { src: "/character-hints/example/overview.jpg", alt: "遠くから見た展示" };
const detail = { src: "/character-hints/example/detail.jpg", alt: "展示の目印" };
const map = { src: "/character-hints/example/map.jpg", alt: "目印を囲んだ会場の地図" };
const configured: LocationHintContent = { location: "  4プロ会場  ", text: "  赤い看板を探してね。\n近づいたら入口を確認しよう。  ", overview, detail, map };

describe("character location hints", () => {
  it("keeps the wide and close-up photographs in order alongside the map and multiline message", () => {
    const hint = characterLocationHint({ id: "example", departmentId: null }, configured);
    expect(hint.photos.map(photo => photo.image)).toEqual([overview, detail]);
    expect(hint.map).toEqual(map);
    expect(hint.location).toBe("4プロ会場");
    expect(hint.text).toBe("赤い看板を探してね。\n近づいたら入口を確認しよう。");
  });

  it.each(["forest-golem", "thunder-fox", "flame-dragon", "aqua-spirit", "four-pro", "temp-12"])("uses a single photo and no map for stable ID %s even if the local classification differs", id => {
    const hint = characterLocationHint({ id, departmentId: null }, configured);
    expect(hint.singlePhoto).toBe(true); expect(hint.photos).toHaveLength(1);
    expect(hint.photos[0].image).toEqual(overview); expect(hint.map).toBeNull();
  });

  it("handles missing or partially configured content without inventing a location", () => {
    const missing = characterLocationHint({ id: "new-character", departmentId: null });
    expect(missing.photos.map(photo => photo.image)).toEqual([null, null]);
    expect(missing.text).toContain("準備中"); expect(missing.map).toBeNull();
    expect(missing.location).toBe("");
    const partial = characterLocationHint({ id: "example", departmentId: null }, { text: "入口を探そう。", detail });
    expect(partial.photos.map(photo => photo.image)).toEqual([null, detail]);
    expect(partial.text).toBe("入口を探そう。");
    expect(characterLocationHint({ id: "constructor", departmentId: null }).text).toContain("準備中");
  });
});
