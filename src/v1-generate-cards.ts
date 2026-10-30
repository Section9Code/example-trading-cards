// Generates a card image for each card in cards.json via OpenRouter, saves it as cards/<id>.png next to cards.json and records its path.
// Usage: OPENROUTER_API_KEY=... node src/v1-generate-cards.ts [path/to/cards.json] [--redo <cardNumber>]
// --redo moves that card's image to rejected/ and regenerates only that card.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

/** OpenRouter image model used for every card. */
const MODEL = "openai/gpt-image-2.5-sunburst";
/** Output image size in pixels (width x height), portrait for a trading card. */
const SIZE = "1024x1536";

/** One card entry in cards.json. */
type Card = {
  id: string;
  name: string;
  cardNumber: number;
  rarity: string;
  character: string;
  poseAndExpression: string;
  backgroundScene: string;
  flavourText: string;
  stats: Record<string, number>;
  /** Relative path to the generated image; absent until the image exists. */
  image?: string;
};

/** The full contents of cards.json: set metadata, the shared prompt parts and the cards. */
type CardSet = {
  set: { totalCards: number; statNames: string[] };
  sharedPrompt: { format: string; artStyle: string; cardLayout: string[]; negative: string };
  cards: Card[];
};

/**
 * Builds the image prompt for one card from the set's shared prompt parts and the card's own details.
 * @param data The card set, which gives the shared format, style, layout and stat names.
 * @param card The card to build the prompt for.
 * @returns The full prompt text.
 */
export function buildPrompt(data: CardSet, card: Card): string {
  const { format, artStyle, cardLayout, negative } = data.sharedPrompt;
  const stats = data.set.statNames.map((s) => `${s} ${card.stats[s]}`).join(" / ");
  return `TRADING CARD — ${card.name.toUpperCase()}

FORMAT
${format}

ART STYLE (keep identical on every card)
${artStyle}

CARD LAYOUT (keep identical on every card)
${cardLayout.map((line) => `- ${line}`).join("\n")}

THIS CARD
Character: ${card.character}
Pose and expression: ${card.poseAndExpression}
Background scene: ${card.backgroundScene}
Flavour text: "${card.flavourText}"
Stats: ${stats}
Rarity: ${card.rarity}
Card number: #${card.cardNumber} of ${data.set.totalCards}

NEGATIVE
${negative}`;
}

/**
 * Requests one image from the OpenRouter images API.
 * @param prompt The prompt text to send.
 * @param apiKey The OpenRouter API key.
 * @returns The decoded PNG image data.
 * @throws If the request fails or the response contains no image.
 */
async function generate(prompt: string, apiKey: string): Promise<Buffer> {
  const res = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, size: SIZE, n: 1 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new Error(`No image in response: ${JSON.stringify(body).slice(0, 500)}`);
  return Buffer.from(b64, "base64");
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    options: { redo: { type: "string" } },
    allowPositionals: true,
  });
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Set OPENROUTER_API_KEY");
  const jsonPath = positionals[0] ?? join(import.meta.dirname, "cards.json");
  /** Folder that holds cards.json and the generated images. */
  const dir = dirname(jsonPath);
  const data: CardSet = JSON.parse(readFileSync(jsonPath, "utf8"));
  /** Writes the current card data back to cards.json. */
  const save = () => writeFileSync(jsonPath, JSON.stringify(data, null, 2) + "\n");

  /** Cards to process on this run: all of them, or only the card given with --redo. */
  let cards = data.cards;
  if (values.redo !== undefined) {
    const card = data.cards.find((c) => c.cardNumber === Number(values.redo));
    if (!card) throw new Error(`No card number ${values.redo}`);
    const current = join(dir, "cards", `${card.id}.png`);
    if (existsSync(current)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const rejected = join(dir, "rejected", `${card.id}-${stamp}.png`);
      mkdirSync(dirname(rejected), { recursive: true });
      renameSync(current, rejected);
      console.log(`moved #${card.cardNumber} ${card.name} -> ${rejected}`);
    }
    // Cleared and saved now, so a failed regenerate is retried on the next normal run.
    delete card.image;
    save();
    cards = [card];
  }

  mkdirSync(join(dir, "cards"), { recursive: true });
  for (const card of cards) {
    const file = `cards/${card.id}.png`;
    // Never overwrite a paid-for image, even one the JSON doesn't know about yet.
    if (card.image || existsSync(join(dir, file))) {
      console.log(`skipped #${card.cardNumber} ${card.name}`);
    } else {
      console.log(`make  #${card.cardNumber} ${card.name}`);
      try {
        writeFileSync(join(dir, file), await generate(buildPrompt(data, card), apiKey));
      } catch (err) {
        console.error(`fail  #${card.cardNumber} ${card.name}: ${(err as Error).message}`);
        continue;
      }
    }
    card.image = `./${file}`;
    // Saved after every card so progress survives a crash.
    save();
  }
}
