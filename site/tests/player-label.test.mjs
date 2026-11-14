import assert from "node:assert/strict";
import { isHexPlayerId, resolvePlayerLabel } from "@cricket/engine/player-label.js";
import { describe, it } from "node:test";

describe("resolvePlayerLabel", () => {
  it("passes through a real scorecard name", () => {
    assert.equal(resolvePlayerLabel("H Shahidi", { bookName: "Hashmatullah Shahidi" }), "H Shahidi");
  });
  it("prefers the book spelling, then the catalog, when the store holds only a hex id", () => {
    assert.equal(isHexPlayerId("4b4af5fb"), true);
    assert.equal(resolvePlayerLabel("4b4af5fb", { bookName: "Hashmatullah Shahidi", catalogName: "Other" }), "Hashmatullah Shahidi");
    assert.equal(resolvePlayerLabel("4b4af5fb", { catalogName: "Hashmatullah Shahidi" }), "Hashmatullah Shahidi");
    assert.equal(resolvePlayerLabel("4b4af5fb", {}), "4b4af5fb");
  });
  it("ignores a hex book_name so a catalog name can win", () => {
    assert.equal(resolvePlayerLabel("4b4af5fb", { bookName: "4b4af5fb", catalogName: "Hashmatullah Shahidi" }), "Hashmatullah Shahidi");
  });
});
