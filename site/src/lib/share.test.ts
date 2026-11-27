import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, sendShareImage, shareFixtureUrl, sharePlayerUrl, shareVenueUrl } from "./share";

describe("share links", () => {
  it("name the player, and his stat and line when there is one", () => {
    expect(sharePlayerUrl("https://x.test/", 12)).toBe("https://x.test/share/player/12");
    expect(sharePlayerUrl("https://x.test", 12, "runs", 24.5)).toBe("https://x.test/share/player/12/runs/24.5");
    expect(sharePlayerUrl("https://x.test", 12, "runs", 24.5, "under")).toBe("https://x.test/share/player/12/runs/24.5/under");
    expect(sharePlayerUrl("https://x.test", 12, "runs", 24.5, "over")).toBe("https://x.test/share/player/12/runs/24.5");
    expect(sharePlayerUrl("https://x.test", 12, "runs", null)).toBe("https://x.test/share/player/12");
  });
  it("name a fixture by its id", () => expect(shareFixtureUrl("https://x.test", "2026-10-29-afghanistan-v-zimbabwe")).toBe("https://x.test/share/fixture/2026-10-29-afghanistan-v-zimbabwe"));
  it("name a ground by its index", () => expect(shareVenueUrl("https://x.test/", 4)).toBe("https://x.test/share/venue/4"));
});

describe("sendShareImage", () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
  const origShare = navigator.share;
  const origCanShare = navigator.canShare;
  const origClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: origShare });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: origCanShare });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: origClipboard });
    vi.restoreAllMocks();
  });

  it("shares files when canShare accepts them", async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    const copied = vi.fn();
    const result = await sendShareImage({ file: blob, text: "hi", title: "T", filename: "p.png", copied });
    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledOnce();
    const arg = (share.mock.calls as unknown as [ShareData][])[0]?.[0];
    expect(arg?.files?.[0]).toBeInstanceOf(File);
    expect(copied).not.toHaveBeenCalled();
  });

  it("downloads and copies text when files cannot be shared", async () => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const copied = vi.fn();
    const saved = vi.fn();
    const result = await sendShareImage({ file: blob, text: "copy me", title: "T", filename: "snap.png", copied, saved });
    expect(result).toBe("downloaded");
    expect(saved).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith("copy me");
    expect(copied).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalled();
  });

  it("returns cancelled when the user aborts the share sheet", async () => {
    const err = new DOMException("Aborted", "AbortError");
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: async () => { throw err; } });
    const result = await sendShareImage({ file: blob, text: "x", title: "T", filename: "p.png", copied: () => undefined });
    expect(result).toBe("cancelled");
  });
});

describe("downloadBlob", () => {
  it("clicks an anchor with the object URL", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    downloadBlob(new Blob(["a"]), "a.png");
    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:x");
  });
});
