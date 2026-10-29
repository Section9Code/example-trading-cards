// Makes a small web-sized copy of every card image in public/cards and records both paths in the card JSON files.
// Usage: node scripts/make-small-cards.ts [path/to/cards.json ...]
// With no arguments it updates src/app/services/cards/cards.json.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";

/** Folder that holds the full-size card images; the small images are written here too. */
const CARDS_DIR = join(import.meta.dirname, "..", "public", "cards");
/** Width of the small image in pixels: about 2x the widest card on the welcome page, for high-DPI screens. */
const SMALL_WIDTH = 512;

/** Returns the small image file name for a full-size image file name, e.g. "x.png" -> "x-small.webp". */
export const smallName = (file: string) => file.replace(/\.png$/, "-small.webp");

if (import.meta.main) {
  const { positionals } = parseArgs({ allowPositionals: true });
  const jsonPaths = positionals.length
    ? positionals
    : [join(import.meta.dirname, "..", "src", "app", "services", "cards", "cards.json")];

  for (const file of readdirSync(CARDS_DIR).filter((f) => f.endsWith(".png"))) {
    const small = join(CARDS_DIR, smallName(file));
    if (existsSync(small)) continue;
    await sharp(join(CARDS_DIR, file)).resize({ width: SMALL_WIDTH }).webp({ quality: 80 }).toFile(small);
    console.log(`made  ${smallName(file)}`);
  }

  for (const jsonPath of jsonPaths) {
    const data = JSON.parse(readFileSync(jsonPath, "utf8"));
    for (const card of data.cards) {
      const file = `${card.id}.png`;
      if (!existsSync(join(CARDS_DIR, file))) {
        console.warn(`no image for #${card.cardNumber} ${card.name} in ${jsonPath}`);
        continue;
      }
      card.image = `./${file}`;
      card.imageSmall = `./${smallName(file)}`;
    }
    writeFileSync(jsonPath, JSON.stringify(data, null, 2) + "\n");
    console.log(`updated ${jsonPath}`);
  }
}
