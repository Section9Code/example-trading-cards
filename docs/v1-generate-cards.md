# v1: `v1-generate-cards.ts`

This script made the season 1 cards. It asks the image model for each card as one complete image: the frame, the art and the text, all together.

This is simple, but the model draws the frame again for each card. So the frame is a little different on every card, and the model sometimes spells the text wrong. For a set with the same frame on every card, use [v2](v2-compose-cards.md).

## Before you start

- Use Node.js 22.18 or later. It runs `.ts` files directly.
- Set `OPENROUTER_API_KEY` to your OpenRouter API key. Every run needs it.
- This script has no dependencies, so you do not need `npm install`.

## Usage

```sh
node v1-generate-cards.ts <path/to/cards.json> [--redo <cardNumber>]
```

| Argument | What it does |
|---|---|
| `<path/to/cards.json>` | The set to make cards for. Always give the path: the default is a `cards.json` next to the script, and the repo does not have one. |
| `--redo <cardNumber>` | Moves that card's image to `rejected/`, then makes a new image for that card only. |

## What it does

1. Reads `cards.json`.
2. For each card, builds one prompt from `sharedPrompt` and the card's own fields. [PROMPTS.md](../PROMPTS.md) shows the prompt template.
3. Asks OpenRouter (model `openai/gpt-image-2.5-sunburst`, 1024 × 1536) for the image.
4. Saves the image as `<id>.png` next to `cards.json`, and writes its path to the card's `image` field.

It saves `cards.json` after each card. If a run stops part of the way through, run it again: it skips the cards that already have an image.

It never overwrites an image that you paid for. It skips a card if the card has an `image` field or if `<id>.png` already exists. If one card fails, the script shows `fail` for it and goes on to the next card.

## `cards.json` fields that it uses

| Field | Used for |
|---|---|
| `set.totalCards`, `set.statNames` | The card number text ("#3 of 30") and the order of the stats |
| `sharedPrompt.format` | The FORMAT section of the prompt |
| `sharedPrompt.artStyle` | The ART STYLE section |
| `sharedPrompt.cardLayout` | The CARD LAYOUT section, one bullet for each item |
| `sharedPrompt.negative` | The NEGATIVE section |
| `cards[i]` | `name`, `character`, `poseAndExpression`, `backgroundScene`, `flavourText`, `stats`, `rarity`, `cardNumber` |

[season-1/cards.json](../season-1/cards.json) is a complete example.

## Examples

Make every card in season 1 that does not have an image yet:

```sh
node v1-generate-cards.ts season-1/cards.json
```

```text
skipped #1 Sir Clankalot
skipped #2 Deep-Six Dan
...
```

Make a new image for card 7 (Giggles the Grim). The old image goes to `season-1/rejected/`:

```sh
node v1-generate-cards.ts season-1/cards.json --redo 7
```

```text
moved #7 Giggles the Grim -> season-1/rejected/giggles-the-grim-2026-10-29T14-00-00-000Z.png
make  #7 Giggles the Grim
```

`--redo` moves the old image before it asks for the new one. If the request fails, card 7 has no image. Run the script again without `--redo` to make it.
