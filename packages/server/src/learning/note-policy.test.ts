import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NOTE_TYPE_BY_REASON } from "@quantum/shared";
import { evaluateAppendNote } from "./note-policy.js";

describe("append_note reason_code freeze", () => {
  it("maps 1–4 onto 思考/疑问/拓展 and rejects English names", () => {
    assert.equal(evaluateAppendNote("心得", 1).type, "思考");
    assert.equal(evaluateAppendNote("误解", 2).type, "疑问");
    assert.equal(evaluateAppendNote("旁支", 3).type, "拓展");
    assert.equal(evaluateAppendNote("往返", 4).type, "疑问");
    assert.equal(evaluateAppendNote("心得", "1").reason_code, 1);
    assert.equal(NOTE_TYPE_BY_REASON[1], "思考");
    assert.equal(NOTE_TYPE_BY_REASON[4], "疑问");
    const bad = evaluateAppendNote("旧名", "friction");
    assert.equal(bad.ok, false);
    assert.equal(bad.reason_code, 0);
  });
});
