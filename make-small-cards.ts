// Makes a small web-sized copy of every card image in a set, next to the full-size image, and records both paths in cards.json.
// Usage: node make-small-cards.ts <path/to/cards.json> [more cards.json ...]
// Each card's `image` (relative to cards.json) says where its full-size image is; the small copy goes beside it as `imageSmall`.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";

/** Width of the small image in pixels: half the 1024px card, enough for grids and thumbnails on high-DPI screens. */
const SMALL_WIDTH = 512;

/** Returns the small image path for a full-size image path, e.g. "./cards/x.png" -> "./cards/x-small.webp". */
export const smallName = (file: string) => file.replace(/\.png$/, "-small.webp");

if (import.meta.main) {
  const { positionals: jsonPaths } = parseArgs({ allowPositionals: true });
  if (!jsonPaths.length) {
    console.error("Usage: node make-small-cards.ts <path/to/cards.json> [more cards.json ...]");
    process.exit(1);
  }

  for (const jsonPath of jsonPaths) {
    const dir = dirname(jsonPath);
    const data = JSON.parse(readFileSync(jsonPath, "utf8"));
    for (const card of data.cards) {
      if (!card.image || !existsSync(join(dir, card.image))) {
        console.warn(`no image for #${card.cardNumber} ${card.name} in ${jsonPath}`);
        continue;
      }
      card.imageSmall = smallName(card.image);
      // Always remade, because it is cheap and a rebuilt card must not keep a stale small copy.
      await sharp(join(dir, card.image)).resize({ width: SMALL_WIDTH }).webp({ quality: 80 }).toFile(join(dir, card.imageSmall));
      console.log(`made  ${card.imageSmall}`);
    }
    writeFileSync(jsonPath, JSON.stringify(data, null, 2) + "\n");
    console.log(`updated ${jsonPath}`);
  }
}
