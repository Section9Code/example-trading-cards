import { strict as assert } from "node:assert";
import { test } from "node:test";
import { rulesSvg, splitInTwo, textSvg } from "./v2-compose-cards.ts";

test("splitInTwo keeps the longer line as short as it can", () => {
  assert.deepEqual(splitInTwo("BIG BERTHA THE BARN-CRUSHER"), ["BIG BERTHA THE", "BARN-CRUSHER"]);
  assert.deepEqual(splitInTwo("MOO"), ["MOO"]);
});

test("textSvg only uses two lines when one line would be too small", () => {
  const box = { x: 0, y: 0, size: 64, maxWidth: 440, font: "Arial", colour: "#000", charWidth: 0.75, twoLinesBelow: 30 };
  assert.equal(textSvg(box, "MOLE MAULER").match(/<tspan/g)?.length, 1);
  assert.equal(textSvg(box, "BIG BERTHA THE BARN-CRUSHER").match(/<tspan/g)?.length, 2);
});

test("rulesSvg numbers each step and stacks it below the last", () => {
  const box = { x: 0, y: 100, size: 10, maxWidth: 100, font: "Arial", colour: "#000", wrap: true, charWidth: 1, lineHeight: 1 };
  const svg = rulesSvg({ title: "Rules", steps: ["one two three", "four"], layout: { title: box, step: box, gap: 5 } });
  assert.match(svg, /1\. one two/);
  // Step one takes two lines of 10, then a gap of 5.
  assert.match(svg, /y="125">2\. four/);
});

test("textSvg balance evens out two wrapped lines", () => {
  const box = { x: 0, y: 0, size: 10, maxWidth: 300, font: "Arial", colour: "#000", wrap: true, charWidth: 1, balance: true };
  const lines = [...textSvg(box, "Nobody remembers making it. It remembers you.").matchAll(/>([^<]+)<\/tspan>/g)].map((m) => m[1]);
  assert.deepEqual(lines, ["Nobody remembers making", "it. It remembers you."]);
});
