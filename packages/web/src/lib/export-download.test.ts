import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { exportDownloadPath } from "./export-download.ts";

describe("export download is not fake-green", () => {
  it("requires ok and a real /api/exports/ path", () => {
    assert.equal(exportDownloadPath({ ok: true, downloadPath: "/api/exports/top/x.md" }), "/api/exports/top/x.md");
    assert.equal(exportDownloadPath({ ok: false, downloadPath: "/api/exports/top/x.md" }), null);
    assert.equal(exportDownloadPath({ ok: true, format: "html" }), null);
    assert.equal(exportDownloadPath({ ok: true, downloadPath: "" }), null);
    assert.equal(exportDownloadPath({ ok: true, downloadPath: "/tmp/x.md" }), null);
    assert.equal(exportDownloadPath({ ok: true, downloadPath: "/api/exports/../secret" }), null);
  });
});
