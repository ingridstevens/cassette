import { describe, expect, it } from "vitest";
import { byteRange, mediaPathFromUrl, mimeFor, peaksCacheName } from "../electron/media";

describe("mediaPathFromUrl", () => {
  it("decodes the path the window encoded", () => {
    expect(mediaPathFromUrl(`media://file/${encodeURIComponent("/Users/a b/Interview #1.m4a")}`)).toBe("/Users/a b/Interview #1.m4a");
    expect(mediaPathFromUrl(`media://file/${encodeURIComponent("C:\\Users\\ä\\x.mp3")}`)).toBe("C:\\Users\\ä\\x.mp3");
  });
  it("refuses other shapes", () => {
    for (const u of ["media://other/%2Fa.mp3", "ftp://file/%2Fa.mp3", "media://file/", "media://file/%E0%A4%A", "media://file/%2Fa.mp3?x=1", "media://file/a%00.mp3", "nonsense"]) expect(mediaPathFromUrl(u)).toBeNull();
  });
});

describe("byteRange", () => {
  it("sends everything without a Range header", () => expect(byteRange(null, 100)).toEqual({ status: 200, start: 0, end: 99 }));
  it("handles a-b, a- and -n", () => {
    expect(byteRange("bytes=10-19", 100)).toEqual({ status: 206, start: 10, end: 19 });
    expect(byteRange("bytes=90-", 100)).toEqual({ status: 206, start: 90, end: 99 });
    expect(byteRange("bytes=-10", 100)).toEqual({ status: 206, start: 90, end: 99 });
    expect(byteRange("bytes=-500", 100)).toEqual({ status: 206, start: 0, end: 99 });
    expect(byteRange("bytes=50-5000", 100)).toEqual({ status: 206, start: 50, end: 99 });
    expect(byteRange("bytes=0-", 100)).toEqual({ status: 206, start: 0, end: 99 });
  });
  it("answers 416 for ranges outside the file or malformed", () => {
    for (const h of ["bytes=100-", "bytes=200-300", "bytes=20-10", "bytes=-", "bytes=-0", "bytes=a-b", "items=0-1", "bytes=0-1,5-6"]) expect(byteRange(h, 100)).toEqual({ status: 416 });
    expect(byteRange("bytes=0-0", 0)).toEqual({ status: 416 });
  });
  it("copes with sizes past 4 GB", () => expect(byteRange("bytes=5000000000-", 6_000_000_000)).toEqual({ status: 206, start: 5_000_000_000, end: 5_999_999_999 }));
});

describe("mimeFor and peaksCacheName", () => {
  it("knows the audio and video types", () => {
    expect(mimeFor("/a/b.MP4")).toBe("video/mp4");
    expect(mimeFor("/a/b.m4a")).toBe("audio/mp4");
    expect(mimeFor("/a/b.bin")).toBe("application/octet-stream");
  });
  it("changes with path, mtime or size", () => {
    const a = peaksCacheName("/a/x.mp3", 1, 2);
    expect(a).toMatch(/^[0-9a-f]{40}\.json$/);
    expect(peaksCacheName("/a/x.mp3", 1, 2)).toBe(a);
    for (const b of [peaksCacheName("/a/y.mp3", 1, 2), peaksCacheName("/a/x.mp3", 2, 2), peaksCacheName("/a/x.mp3", 1, 3)]) expect(b).not.toBe(a);
  });
});
