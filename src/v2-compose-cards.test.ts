import { strict as assert } from "node:assert";
import { test } from "node:test";
import { splitInTwo, textSvg } from "./v2-compose-cards.ts";

test("splitInTwo keeps the longer line as short as it can", () => {
  assert.deepEqual(splitInTwo("BIG BERTHA THE BARN-CRUSHER"), ["BIG BERTHA THE", "BARN-CRUSHER"]);
  assert.deepEqual(splitInTwo("MOO"), ["MOO"]);
});

test("textSvg only uses two lines when one line would be too small", () => {
  const box = { x: 0, y: 0, size: 64, maxWidth: 440, font: "Arial", colour: "#000", charWidth: 0.75, twoLinesBelow: 30 };
  assert.equal(textSvg(box, "MOLE MAULER").match(/<tspan/g)?.length, 1);
  assert.equal(textSvg(box, "BIG BERTHA THE BARN-CRUSHER").match(/<tspan/g)?.length, 2);
});
