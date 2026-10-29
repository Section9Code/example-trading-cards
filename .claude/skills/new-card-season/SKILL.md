---
name: new-card-season
description: Use when the user wants to start a new season or set of trading cards in this repo, such as "make season 3", "new set of cards", or a new theme for cards, before any cards.json for that season exists.
---

# New card season

Sets up `season-N/` so it is ready for card details: a `cards.json` with set metadata and shared prompts, a generated `frame.png`, and a `layout` tuned to that frame. It does NOT write the cards; `cards` stays `[]`.

Everything runs through `v2-compose-cards.ts` (run `node v2-compose-cards.ts` with no arguments for usage). `season-2/cards.json` is the worked example: copy its shape, not its theme.

## Steps

1. **Ask for the theme.** Ask the user in chat for the theme and any wishes for the colour scheme. Propose the rest and let them change it: set name, number of cards (default 30), three stat names that fit the theme, and rarities (default Common, Rare, Legendary).

2. **Make the folder.** Use the next free `season-N` (look at the existing `season-*` folders). Write `season-N/cards.json` with:
   - `set`: `name`, `totalCards`, `statNames`, `rarities`.
   - `sharedPrompt.format`: one full-bleed borderless illustration, flat 2D (as in season 2).
   - `sharedPrompt.artStyle`: one paragraph naming the style, linework, shading, a palette of 4-6 colours, texture and mood. Every card uses it, so be specific.
   - `sharedPrompt.frame`: a list of lines, each describing one part of the frame:
     - **Border**: colour, material and ornament that fit the theme.
     - **Top-left emblem**: a small emblem with no letters.
     - **Top**: an empty name banner about 10% of the card height.
     - **Bottom**: a pale text panel about a quarter of the card height, with an empty upper half for flavour text and a thin divider across the middle. The panel must be pale, because the text is drawn in dark colours.
     - **Stats row**: the lower half of the panel split into one equal cell per stat, with thin vertical dividers. Each cell has a small bold icon on its left and empty space on its right. Describe each icon in `statNames` order, left to right.
     - **Card number and rarity**: a small dark plaque for the number with a pale pill-shaped badge on its right, on the border in the bottom-right corner below the panel.
     - **Accent colours**: list the allowed accent colours, then add "Do not use pink, magenta or hot pink anywhere on the frame."
     - Leave out the art window and any "no text" rule, because the script adds both.
   - `sharedPrompt.negative`: what the art must not contain.
   - `cards`: `[]`.

3. **Show the frame prompt.** Run `node v2-compose-cards.ts frame-prompt season-N/cards.json` and show it to the user. Change `cards.json` until they approve it.

4. **Make the frame.** Each frame is a paid image, so confirm with the user before generating one.
   - If an OpenRouter image tool (MCP) is available: send it the printed prompt at 1024x1536, save the PNG as `season-N/frame.png`, then run `node v2-compose-cards.ts layout season-N/cards.json`.
   - Otherwise, if `OPENROUTER_API_KEY` is set: run `node v2-compose-cards.ts frame season-N/cards.json`.
   - Otherwise, ask the user to run that command, or to make the image elsewhere from the printed prompt, save it as `season-N/frame.png` and run `layout`. Wait for them to tell you it is done.

5. **Check the frame.** Read `season-N/frame.png` and check that:
   - the window is one clean solid magenta rectangle;
   - there is no text anywhere;
   - there is one icon per stat, in `statNames` order;
   - the number plaque and the rarity pill are both present.

   If the frame fails a check, change `sharedPrompt.frame` and make a new frame. `frame` moves the old frame to `rejected/` and keeps the layout. If `layout` reports "No magenta window", the frame must be made again.

6. **Tune the layout.** `frame` and `layout` write a starting `layout` to `cards.json`. Measure the real frame in pixels (1024x1536) and edit the layout:
   - `text.name`: the centre of the empty banner. Set `maxWidth` to the banner's inner width.
   - `text.flavour`: the centre of the panel's upper half, with `wrap: true`.
   - `stats[i].label` and `stats[i].value`: one entry per stat, in `statNames` order. Put the value in the space to the right of the icon. Put the label there too if it fits; otherwise put it in the strip above the icon, centred on the cell.
   - `text.number`: the centre of the plaque, in light text. `text.rarity`: the centre of the pill, in dark text.
   - `y` is the vertical centre of the text. One-line text shrinks to fit `maxWidth`, using `charWidth` (font size × character count) to estimate its width. Use about 0.75 for Arial Black, and up to 0.95 for short capitalised words in small spaces.

   Then repeat until nothing overflows, overlaps an icon or sits off-centre:
   1. Run `node v2-compose-cards.ts preview season-N/cards.json`.
   2. Read `season-N/preview.png`. It shows the longest name and flavour text, the longest rarity and every stat at 10, on grey placeholder art.
   3. Fix any problems in the layout.

7. **Hand over.** Tell the user that the season is ready for card details, and show them the final preview. Each card needs `id` (kebab-case of the name), `name`, `cardNumber`, `rarity`, `character`, `poseAndExpression`, `backgroundScene`, `flavourText` and `stats` (0-10 for each stat name). `node v2-compose-cards.ts cards season-N/cards.json` then builds the cards.

## Common mistakes

| Mistake | Fix |
|---|---|
| Using a dark text panel to suit the theme | Keep the panel pale; the text is drawn in dark colours |
| Using magenta or pink as an accent colour | It breaks the window search; ban it in the accent line |
| Describing the window in the `frame` lines | The script adds the window rules; leave them out |
| Icons in a different order from `statNames` | Labels are drawn by index, so the order must match |
| Tuning the layout without running `preview` | Always check the image; the width estimates are rough |
| Generating a frame without asking | Every frame costs money; confirm first |
