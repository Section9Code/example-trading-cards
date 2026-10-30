# v2: `v2-compose-cards.ts`

This script made the season 2 and season 3 cards. It builds each card from three layers:

1. **The frame.** One empty card frame for the whole set, `frame.png`. The picture window in the frame is solid magenta.
2. **The art.** One picture for each card, `art/<id>.png`, with no border and no text.
3. **The text.** The name, flavour text, stats, card number and rarity, drawn on top by the script.

The script puts the art behind the magenta window and draws the text at the positions in the `layout` section of `cards.json`. So every card in a set has the same frame, and the text is always spelled correctly. For the older method, where the model draws the whole card, see [v1](v1-generate-cards.md).

## Before you start

- Use Node.js 22.18 or later. It runs `.ts` files directly.
- Run `npm install --prefix src`. The script uses [sharp](https://sharp.pixelplumbing.com/) to work with images.
- Set `OPENROUTER_API_KEY` to your OpenRouter API key. Only `frame`, `cards` (when art is missing) and `redo` need it, because only they make images.

## Usage

```sh
node src/v2-compose-cards.ts <command> <path/to/cards.json> [cardNumber]
```

Run it with no arguments to see the usage line.

| Command | Paid? | What it does |
|---|---|---|
| `frame-prompt` | No | Shows the frame prompt. Use it to check the prompt, or to make the frame with a different tool. |
| `frame` | Yes, 1 image | Makes a new frame, finds its magenta window and saves the window to `layout`. |
| `layout` | No | Finds the magenta window in the `frame.png` that is there now and saves it to `layout`. Use it after you make the frame with a different tool. |
| `preview` | No | Draws a sample card on grey art to `preview.png`. It uses the longest name and flavour text in the set, so you can see if the text fits. |
| `cards` | Yes, 1 image for each card with no art | Makes the art for each card that has none, then builds every card again. |
| `redo <cardNumber>` | Yes, 1 image | Makes new art for one card, then builds that card again. |

## Files

All files go in the folder that holds `cards.json`:

| File | Made by |
|---|---|
| `frame.png` | `frame` |
| `art/<id>.png` | `cards`, `redo` |
| `cards/<id>.png` | `cards`, `redo` (the finished card, 1024 × 1536) |
| `preview.png` | `preview` |
| `rejected/` | `frame`, `redo` (the old frame or art) |

The script never deletes an image that you paid for:

- `frame` and `redo` make the new image first. Only then do they move the old one to `rejected/`, with the time in its name. If the request fails, the old image stays where it is.
- `cards` never makes art for a card that already has it. It saves `cards.json` after each card, so if a run stops part of the way through, run it again. If one card fails, it shows `fail` for that card and goes on to the next.

Building the finished cards from the frame and art is free. `cards` builds every card again on each run, so a change to `layout` or to a card's text needs only a `cards` run.

## `cards.json` fields that it uses

### `sharedPrompt`

| Field | Used for |
|---|---|
| `artStyle` | The art style for the frame and for every card's art |
| `frame` | A list of lines that describe the frame: the border, name banner, text panel, stat icons, number plaque and rarity badge. The script adds the rules for the magenta window. |
| `negative` | What the images must not contain |

### `cards[i]`

`id`, `name`, `cardNumber`, `rarity`, `character`, `poseAndExpression`, `backgroundScene`, `flavourText` and `stats` (one value from 0 to 10 for each name in `set.statNames`). The art prompt uses `character`, `poseAndExpression` and `backgroundScene`. The text layer uses the other fields. After a card is built, the script writes its path to `image`.

### `layout`

`frame` and `layout` write `layout.window`, the magenta window in the frame. The first `frame` run also writes a starting layout for the text. After that, a new frame keeps the text layout, because you adjust it to fit each frame by hand.

```jsonc
"layout": {
  "window": { "left": 79, "top": 168, "width": 866, "height": 752 },
  "text": {
    "name":    { /* text box */ },
    "flavour": { /* text box */ },
    "number":  { /* text box: "#3 of 30" */ },
    "rarity":  { /* text box: the rarity in capitals */ }
  },
  "stats": [
    { "label": { /* text box */ }, "value": { /* text box */ } }
    // one entry for each stat, in set.statNames order
  ]
}
```

Each text box has these fields. All sizes are in pixels on the 1024 × 1536 frame.

| Field | Default | What it does |
|---|---|---|
| `x`, `y` | | Where the text goes. `y` is the vertical centre of the text. `anchor` sets which part of the text is at `x`. |
| `size` | | The largest font size. |
| `maxWidth` | | The widest the text can be. Text on one line gets smaller to fit. |
| `font` | | A CSS font list, for example `"'Arial Black', Impact, sans-serif"`. |
| `colour` | | The text colour. |
| `stroke` | No outline | The outline colour. |
| `anchor` | `"middle"` | `"start"`, `"middle"` or `"end"`. |
| `bold`, `italic` | `false` | The font style. |
| `wrap` | `false` | Puts the text on more lines at `maxWidth`, and keeps the font size. |
| `twoLinesBelow` | off | If one-line text would shrink below this size, puts it on two lines instead. |
| `lineHeight` | `1.2` | The line spacing, as a multiple of the font size. |
| `charWidth` | `0.6` | The average letter width, as a multiple of the font size. The script uses it to fit text, because it does not measure the text. Make it larger for wide fonts, or if text goes outside its box. |

[season-2/cards.json](../../season-2/cards.json) and [season-3/cards.json](../../season-3/cards.json) are complete examples.

## Examples

### Make a new set

1. Write `cards.json` with `set`, `sharedPrompt` and an empty `cards` list. Check the frame prompt:

   ```sh
   node src/v2-compose-cards.ts frame-prompt season-4/cards.json
   ```

2. Make the frame:

   ```sh
   node src/v2-compose-cards.ts frame season-4/cards.json
   ```

   ```text
   make  frame
   frame window 866x752 at 79,168; saved to layout in season-4/cards.json
   ```

3. Draw a preview, and look at `season-4/preview.png`. Change the text boxes in `layout` until all the text fits, and draw the preview again after each change:

   ```sh
   node src/v2-compose-cards.ts preview season-4/cards.json
   ```

4. Add the cards to `cards`, then make the art and build the cards:

   ```sh
   node src/v2-compose-cards.ts cards season-4/cards.json
   ```

   ```text
   make  #1 <first card name>
   built #1 <first card name>
   ...
   ```

### Replace a frame

If the frame is wrong (for example, the rarity badge is too small), change the lines in `sharedPrompt.frame` and make a new frame. The old one goes to `rejected/`:

```sh
node src/v2-compose-cards.ts frame season-3/cards.json
node src/v2-compose-cards.ts preview season-3/cards.json
```

The new frame can put things in different places. Draw a preview, move the text boxes to match, then build the cards again. This is free, because the art is already there:

```sh
node src/v2-compose-cards.ts cards season-3/cards.json
```

### Make new art for one card

Change the card's `character`, `poseAndExpression` or `backgroundScene` if necessary, then:

```sh
node src/v2-compose-cards.ts redo season-2/cards.json 24
```

```text
make  #24 Siren of the Shoals
moved season-2/art/siren-of-the-shoals.png -> season-2/rejected/siren-of-the-shoals-art-2026-10-29T13-07-09-548Z.png
built #24 Siren of the Shoals
```

### Use a frame from a different tool

Show the prompt, make the image at 1024 × 1536 with your tool and save it as `frame.png`. Then find its window:

```sh
node src/v2-compose-cards.ts frame-prompt season-4/cards.json
node src/v2-compose-cards.ts layout season-4/cards.json
```
