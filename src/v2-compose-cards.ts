// Builds each card in a set from three layers: one shared frame, borderless art for the card (both made
// via OpenRouter), and the card's text drawn on top at the positions given in cards.json `layout`.
// Usage (OPENROUTER_API_KEY is only needed when an image must be generated):
//   node src/v2-compose-cards.ts frame-prompt <cards.json>   print the frame prompt, to make the frame elsewhere
//   node src/v2-compose-cards.ts frame   <cards.json>        make the frame, find its art window, save it to layout
//   node src/v2-compose-cards.ts layout  <cards.json>        find the art window in an existing frame.png, save it to layout
//   node src/v2-compose-cards.ts preview <cards.json>        draw a worst-case sample card on grey art to preview.png
//   node src/v2-compose-cards.ts cards   <cards.json>        make missing art, then rebuild every card
//   node src/v2-compose-cards.ts redo    <cards.json> <number> replace one card's art, then rebuild that card
//   node src/v2-compose-cards.ts rules   <cards.json>        draw the rules card's text on rules-frame.png
// An old frame or art image is moved to rejected/, never deleted.
// Output: frame.png, art/<id>.png and cards/<id>.png next to cards.json.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";

/** OpenRouter image model used for the frame and every card. */
const MODEL = "openai/gpt-image-2.5-sunburst";
/** Frame size in pixels, portrait for a trading card. */
const FRAME_SIZE = "1024x1536";
/** Default art size in pixels; `sharedPrompt.artSize` overrides it. The art is cropped to fit the frame window. */
const ART_SIZE = "1024x1024";
const USAGE =
  "Usage: node src/v2-compose-cards.ts frame-prompt|frame|layout|preview|cards|rules <cards.json>  or  node src/v2-compose-cards.ts redo <cards.json> <cardNumber>";

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
  /** Relative path to the finished card image; absent until the image exists. */
  image?: string;
};

/** A rectangle in pixels. */
type Box = { left: number; top: number; width: number; height: number };

/** Where and how to draw one piece of card text. All sizes are in frame pixels. */
type TextBox = {
  /** Anchor point: `y` is the vertical centre of the text, `x` is set by `anchor`. */
  x: number;
  y: number;
  /** Largest font size; one-line text shrinks to fit `maxWidth`. */
  size: number;
  maxWidth: number;
  /** CSS font list; the first one installed is used. */
  font: string;
  colour: string;
  /** Outline colour; no outline when absent. */
  stroke?: string;
  /** Which part of the text sits on `x`. Default "middle". */
  anchor?: "start" | "middle" | "end";
  bold?: boolean;
  italic?: boolean;
  /** Wrap onto more lines at `maxWidth` instead of shrinking. */
  wrap?: boolean;
  /** With `wrap`, makes two-line text even, so no word sits alone on the second line. */
  balance?: boolean;
  /** One-line text that would shrink below this size goes on two lines instead. Off when absent. */
  twoLinesBelow?: number;
  /** Line spacing as a multiple of the font size. Default 1.2. */
  lineHeight?: number;
  /** Average character width as a multiple of the font size, used to fit text. Default 0.6; raise it for wide fonts. */
  charWidth?: number;
};

/** Where the art and text go on the frame. */
type Layout = {
  /** The art window; found by the `frame` command. */
  window: Box;
  /** name: the card name; flavour: the flavour text; number: "#n of total"; rarity: the rarity in capitals. */
  text: Record<"name" | "flavour" | "number" | "rarity", TextBox>;
  /** One cell per stat, in `set.statNames` order: the stat name and its value, beside the frame's stat icon. */
  stats: { label: TextBox; value: TextBox }[];
};

/** The full contents of cards.json: set metadata, the shared prompt parts, the layout and the cards. */
type CardSet = {
  set: { name: string; totalCards: number; statNames: string[]; rarities: string[] };
  /** `frame` describes the look of the shared frame, one line per part. */
  sharedPrompt: { format: string; artStyle: string; frame?: string[]; windowHeight?: number; artSize?: string; negative: string };
  rulesCard?: RulesCard;
  layout?: Layout;
  cards: Card[];
};

/** A set's how-to-play card, drawn over rules-frame.png. `step` is a wrapped box; its `y` is the top of the first step. */
type RulesCard = { title: string; steps: string[]; layout: { title: TextBox; step: TextBox; gap: number } };

/**
 * Builds the prompt for the empty card frame that every card in the set shares.
 * The set's `frame` lines give the look; the window rules are fixed here because findWindow depends on them.
 * @param data The card set, which gives the frame look, art style and negative prompt.
 * @returns The full prompt text.
 * @throws If the set has no `sharedPrompt.frame`.
 */
export function buildFramePrompt(data: CardSet): string {
  const { artStyle, frame, negative } = data.sharedPrompt;
  if (!frame) throw new Error("cards.json needs sharedPrompt.frame to describe the card frame");
  return `EMPTY TRADING CARD FRAME — "${data.set.name}" SET

FORMAT
The front of one vertical trading card, seen flat and straight on, filling the whole image edge to edge. No background around the card, no drop shadow, no perspective, no rounded corners cut away.

ART STYLE
${artStyle}

LAYOUT
${frame.map((line) => `- ${line}`).join("\n")}
- Centre: a large rectangular picture window with a thin inner frame, about 85% of the card width and ${data.sharedPrompt.windowHeight ?? 55}% of the card height, between the name banner and the text panel. Fill the window with solid flat pure magenta (#FF00FF) and nothing else. The window has sharp square corners.

NEGATIVE
No text, letters or numbers anywhere on the card; icons are fine. No character or scene in the window, only flat magenta. Do not use magenta anywhere outside the window. ${negative}`;
}

/**
 * Builds the prompt for one card's art, which fills the frame window, so it has no border or text.
 * @param data The card set, which gives the art style and negative prompt.
 * @param card The card to build the prompt for.
 * @returns The full prompt text.
 */
export function buildArtPrompt(data: CardSet, card: Card): string {
  const { artStyle, negative } = data.sharedPrompt;
  return `CARD ART — ${card.name.toUpperCase()}

FORMAT
One full-bleed illustration that fills the whole image edge to edge. This is only the picture: no card, no border, no frame, no text, no lettering, no logos. The character is shown from the waist up, centred, with nothing important near the edges because the edges may be cropped a little.

ART STYLE (keep identical on every card)
${artStyle}

THIS CARD
Character: ${card.character}
Pose and expression: ${card.poseAndExpression}
Background scene: ${card.backgroundScene}

NEGATIVE
No border, no frame, no text of any kind. ${negative}`;
}

/**
 * Requests one image from the OpenRouter images API.
 * @param prompt The prompt text to send.
 * @param size The image size, e.g. "1024x1536".
 * @returns The decoded PNG image data.
 * @throws If OPENROUTER_API_KEY is not set, the request fails or the response contains no image.
 */
async function generate(prompt: string, size: string): Promise<Buffer> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Set OPENROUTER_API_KEY");
  const res = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, size, n: 1 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new Error(`No image in response: ${JSON.stringify(body).slice(0, 500)}`);
  return Buffer.from(b64, "base64");
}

/** True if the pixel starting at `i` in raw RGB(A) data is window magenta. */
const isMagenta = (data: Buffer, i: number) => data[i] > 200 && data[i + 1] < 80 && data[i + 2] > 200;

/**
 * Finds the magenta picture window in the frame.
 * @param framePath Path to the frame image.
 * @returns The bounding box of all magenta pixels.
 * @throws If the frame has no magenta window.
 */
export async function findWindow(framePath: string): Promise<Box> {
  const { data, info } = await sharp(framePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (isMagenta(data, (y * info.width + x) * 3)) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) throw new Error(`No magenta window in ${framePath}; run the frame command again`);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Makes a starting layout from the frame size and window, following the frame prompt: name above the
 * window; flavour text, then one cell per stat in the panel below it; number and rarity under the panel.
 * The `frame` command writes this to cards.json only when the set has no layout yet; edit it there.
 * @param width Frame width in pixels.
 * @param height Frame height in pixels.
 * @param win The art window.
 * @param statCount How many stat cells the frame has.
 * @returns The layout.
 */
export function defaultLayout(width: number, height: number, win: Box, statCount: number): Layout {
  const cx = Math.round(width / 2);
  const panelTop = win.top + win.height;
  const panel = height - panelTop;
  const body = Math.round(panel * 0.08);
  const cell = win.width / statCount;
  const font = "'Trebuchet MS', Arial, sans-serif";
  const title = "'Arial Black', Impact, sans-serif";
  const dark = "#2a1040";
  const right = win.left + win.width;
  return {
    window: win,
    text: {
      name: { x: cx, y: Math.round(win.top / 2), size: Math.round(win.top * 0.45), maxWidth: Math.round(win.width * 0.9), font: title, colour: "#ffd23f", stroke: dark, charWidth: 0.75 },
      flavour: { x: cx, y: Math.round(panelTop + panel * 0.22), size: body, maxWidth: Math.round(win.width * 0.85), font, colour: dark, italic: true, wrap: true },
      number: { x: Math.round(right - win.width * 0.2), y: Math.round(height - panel * 0.08), size: Math.round(body * 0.7), maxWidth: Math.round(win.width * 0.2), font, colour: "#ffffff", anchor: "end", bold: true },
      rarity: { x: Math.round(right - win.width * 0.1), y: Math.round(height - panel * 0.08), size: Math.round(body * 0.6), maxWidth: Math.round(win.width * 0.15), font: title, colour: dark, charWidth: 0.7 },
    },
    // The text sits right of the icon, which fills the left third of each cell.
    stats: Array.from({ length: statCount }, (_, i) => {
      const x = Math.round(win.left + cell * i + cell * 0.65);
      const maxWidth = Math.round(cell * 0.6);
      return {
        label: { x, y: Math.round(panelTop + panel * 0.55), size: Math.round(body * 0.6), maxWidth, font: title, colour: dark, charWidth: 0.7 },
        value: { x, y: Math.round(panelTop + panel * 0.7), size: Math.round(body * 1.4), maxWidth, font: title, colour: dark, charWidth: 0.7 },
      };
    }),
  };
}

/** Escapes text for use inside SVG. */
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/**
 * Splits text into lines of at most `max` characters, breaking between words.
 * @param text The text to split.
 * @param max The most characters on one line.
 * @returns The lines.
 */
export function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && line.length + 1 + word.length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Splits text into two lines at the word gap that keeps the longer line shortest.
 * @param text The text to split.
 * @returns The two lines, or one line if the text has no word gap.
 */
export function splitInTwo(text: string): string[] {
  const words = text.split(/\s+/);
  const splits = words.slice(1).map((_, i) => [words.slice(0, i + 1).join(" "), words.slice(i + 1).join(" ")]);
  const longer = (lines: string[]) => Math.max(...lines.map((l) => l.length));
  return splits.reduce((best, s) => (longer(s) < longer(best) ? s : best), splits[0] ?? [text]);
}

/**
 * Draws one piece of text as an SVG element, wrapped or shrunk to fit its box and centred on its `y`.
 * ponytail: widths are estimated from character counts, not measured; tune `charWidth` per box if text overflows.
 * @param box Where and how to draw the text.
 * @param text The text to draw.
 * @returns The SVG `<text>` element.
 */
export function textSvg(box: TextBox, text: string): string {
  const cw = box.charWidth ?? 0.6;
  const fit = (chars: number) => Math.min(box.size, box.maxWidth / (chars * cw));
  let size = box.wrap ? box.size : fit(text.length);
  let lines = box.wrap ? wrap(text, Math.floor(box.maxWidth / (size * cw))) : [text];
  if (box.balance && lines.length === 2) lines = splitInTwo(text);
  if (!box.wrap && box.twoLinesBelow && size < box.twoLinesBelow) {
    lines = splitInTwo(text);
    size = fit(Math.max(...lines.map((l) => l.length)));
  }
  const lh = size * (box.lineHeight ?? 1.2);
  const top = box.y - ((lines.length - 1) * lh) / 2;
  const stroke = box.stroke
    ? ` stroke="${box.stroke}" stroke-width="${size * 0.14}" stroke-linejoin="round" paint-order="stroke"`
    : "";
  return `<text font-family="${esc(box.font)}" font-size="${size}" fill="${box.colour}"${stroke} text-anchor="${box.anchor ?? "middle"}" dominant-baseline="central"${box.bold ? ' font-weight="bold"' : ""}${box.italic ? ' font-style="italic"' : ""}>${lines
    .map((l, i) => `<tspan x="${box.x}" y="${top + i * lh}">${esc(l)}</tspan>`)
    .join("")}</text>`;
}

/**
 * Builds the text layer for one card from the set's layout.
 * @param data The card set, which gives the stat names and card total.
 * @param layout Where each piece of text goes.
 * @param card The card to draw.
 * @param width Frame width in pixels.
 * @param height Frame height in pixels.
 * @returns The SVG, the same size as the frame.
 */
export function cardSvg(data: CardSet, layout: Layout, card: Card, width: number, height: number): string {
  const { text, stats } = layout;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  ${textSvg(text.name, card.name.toUpperCase())}
  ${textSvg(text.flavour, card.flavourText)}
  ${data.set.statNames.map((s, i) => textSvg(stats[i].label, s.toUpperCase()) + textSvg(stats[i].value, String(card.stats[s]))).join("\n  ")}
  ${textSvg(text.number, `#${card.cardNumber} of ${data.set.totalCards}`)}
  ${textSvg(text.rarity, card.rarity.toUpperCase())}
</svg>`;
}

/**
 * Builds the text layer for a set's rules card: the title, then each numbered step below the last.
 * @param rules The rules card's text and positions.
 * @returns The SVG, the same size as a card.
 */
export function rulesSvg(rules: RulesCard): string {
  const { step, gap } = rules.layout;
  const lh = step.size * (step.lineHeight ?? 1.2);
  const chars = Math.floor(step.maxWidth / (step.size * (step.charWidth ?? 0.6)));
  let top = step.y;
  const steps = rules.steps.map((text, i) => {
    const numbered = `${i + 1}. ${text}`;
    const lines = wrap(numbered, chars).length;
    const svg = textSvg({ ...step, y: top + ((lines - 1) * lh) / 2 }, numbered);
    top += lines * lh + gap;
    return svg;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536">
  ${textSvg(rules.layout.title, rules.title.toUpperCase())}
  ${steps.join("\n  ")}
</svg>`;
}

/**
 * Puts one card's art behind the frame window and draws the card's text on top. Only the magenta
 * pixels are cut out, so frame ornaments that reach into the window stay over the art.
 * @param framePath Path to the frame image.
 * @param art Path to the card's art, or the art image data.
 * @param data The card set.
 * @param layout Where the art and text go.
 * @param card The card to draw.
 * @returns The finished card as PNG data.
 */
export async function compose(framePath: string, art: string | Buffer, data: CardSet, layout: Layout, card: Card): Promise<Buffer> {
  const { data: frame, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  // The window grown by 2px each side, to reach the magenta-tinted edge pixels just outside it.
  const pad = 2;
  const win = { left: layout.window.left - pad, top: layout.window.top - pad, width: layout.window.width + 2 * pad, height: layout.window.height + 2 * pad };
  // Only inside the window, so stray magenta elsewhere on the frame never leaves a hole with nothing behind it.
  for (let y = win.top; y < win.top + win.height; y++) {
    for (let x = win.left; x < win.left + win.width; x++) {
      const i = (y * width + x) * 4;
      // Looser than isMagenta, to also catch the magenta-tinted edge pixels round ornaments.
      const [r, g, b] = [frame[i], frame[i + 1], frame[i + 2]];
      if (r - g > 60 && b - g > 60) frame[i + 3] = 0;
    }
  }
  const fitted = await sharp(art).resize(win.width, win.height, { fit: "cover" }).toBuffer();
  return sharp({ create: { width, height, channels: 4, background: "#000000" } })
    .composite([
      { input: fitted, left: win.left, top: win.top },
      { input: frame, raw: { width, height, channels: 4 }, left: 0, top: 0 },
      { input: Buffer.from(cardSvg(data, layout, card, width!, height!)), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

if (import.meta.main) {
  const { positionals } = parseArgs({ allowPositionals: true });
  const [command, jsonPath, cardNumber] = positionals;
  const commands = ["frame-prompt", "frame", "layout", "preview", "cards", "redo", "rules"];
  if (!commands.includes(command) || !jsonPath?.endsWith(".json") || (command === "redo" && !cardNumber)) {
    console.error(USAGE);
    process.exit(1);
  }
  /** Folder that holds cards.json; the frame, art and finished cards go here. */
  const dir = dirname(jsonPath);
  const data: CardSet = JSON.parse(readFileSync(jsonPath, "utf8"));
  /** Writes the current card data back to cards.json. */
  const save = () => writeFileSync(jsonPath, JSON.stringify(data, null, 2) + "\n");
  const framePath = join(dir, "frame.png");
  /** Moves a paid-for image to rejected/ with a timestamp, so nothing is lost. */
  const reject = (file: string, name: string) => {
    if (!existsSync(file)) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const to = join(dir, "rejected", `${name}-${stamp}.png`);
    mkdirSync(dirname(to), { recursive: true });
    renameSync(file, to);
    console.log(`moved ${file} -> ${to}`);
  };

  if (command === "frame-prompt") {
    console.log(buildFramePrompt(data));
  } else if (command === "rules") {
    const rules = data.rulesCard;
    if (!rules) throw new Error(`No rulesCard in ${jsonPath}`);
    const svg = rulesSvg(rules);
    const rulesFrame = join(dir, "rules-frame.png");
    if (!existsSync(rulesFrame)) throw new Error(`No ${rulesFrame}; make it first`);
    await sharp(rulesFrame).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toFile(join(dir, "rules-card.png"));
    console.log(`drew ${join(dir, "rules-card.png")}`);
  } else if (command === "frame" || command === "layout") {
    if (command === "frame") {
      console.log("make  frame");
      // Generate first, so a failed call leaves the old frame in place.
      const frame = await generate(buildFramePrompt(data), FRAME_SIZE);
      reject(framePath, "frame");
      writeFileSync(framePath, frame);
    } else if (!existsSync(framePath)) throw new Error(`No ${framePath}; make it first`);
    const win = await findWindow(framePath);
    const { width, height } = await sharp(framePath).metadata();
    // A new frame keeps any text layout already tuned for this set; only the window is replaced.
    data.layout = data.layout ? { ...data.layout, window: win } : defaultLayout(width!, height!, win, data.set.statNames.length);
    save();
    console.log(`frame window ${win.width}x${win.height} at ${win.left},${win.top}; saved to layout in ${jsonPath}`);
  } else {
    const layout = data.layout;
    if (!existsSync(framePath) || !layout) throw new Error(`No frame or layout for ${jsonPath}; run the frame command first`);
    if (command === "preview") {
      /** Returns the longest string, so the preview shows the hardest text to fit. */
      const longest = (xs: string[], fallback: string) => xs.reduce((a, b) => (b.length > a.length ? b : a), fallback);
      const sample = {
        name: longest(data.cards.map((c) => c.name), "Sample Card Name Here"),
        flavourText: longest(data.cards.map((c) => c.flavourText), "A sample line of flavour text, about as long as the longest one will be."),
        cardNumber: data.set.totalCards,
        rarity: longest(data.set.rarities, ""),
        stats: Object.fromEntries(data.set.statNames.map((s) => [s, 10])),
      } as Card;
      const { width, height } = layout.window;
      const grey = await sharp({ create: { width, height, channels: 3, background: "#808080" } }).png().toBuffer();
      writeFileSync(join(dir, "preview.png"), await compose(framePath, grey, data, layout, sample));
      console.log(`drew ${join(dir, "preview.png")}`);
      process.exit(0);
    }
    mkdirSync(join(dir, "art"), { recursive: true });
    mkdirSync(join(dir, "cards"), { recursive: true });

    /** Cards to process on this run: all of them, or only the card being redone. */
    let cards = data.cards;
    if (command === "redo") {
      const card = data.cards.find((c) => c.cardNumber === Number(cardNumber));
      if (!card) throw new Error(`No card number ${cardNumber}`);
      console.log(`make  #${card.cardNumber} ${card.name}`);
      // Generate first, so a failed call leaves the old art in place.
      const art = await generate(buildArtPrompt(data, card), data.sharedPrompt.artSize ?? ART_SIZE);
      const artPath = join(dir, "art", `${card.id}.png`);
      reject(artPath, `${card.id}-art`);
      writeFileSync(artPath, art);
      cards = [card];
    }

    for (const card of cards) {
      const artPath = join(dir, "art", `${card.id}.png`);
      // Never overwrite paid-for art; the finished card is always rebuilt because that is free.
      if (!existsSync(artPath)) {
        console.log(`make  #${card.cardNumber} ${card.name}`);
        try {
          writeFileSync(artPath, await generate(buildArtPrompt(data, card), data.sharedPrompt.artSize ?? ART_SIZE));
        } catch (err) {
          console.error(`fail  #${card.cardNumber} ${card.name}: ${(err as Error).message}`);
          continue;
        }
      }
      const file = `cards/${card.id}.png`;
      writeFileSync(join(dir, file), await compose(framePath, artPath, data, layout, card));
      console.log(`built #${card.cardNumber} ${card.name}`);
      card.image = `./${file}`;
      // Saved after every card so progress survives a crash.
      save();
    }
  }
}
