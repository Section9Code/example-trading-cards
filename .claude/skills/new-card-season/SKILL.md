---
name: new-card-season
description: Use when the user wants to start a new season or set of trading cards in this repo, such as "make season 3", "new set of cards", or a new theme for cards, before any cards.json for that season exists.
---

# New card season

Sets up `season-N/` so it is ready for card details: a `cards.json` with set metadata and shared prompts, a generated `frame.png`, a `layout` tuned to that frame, a `card-back.png`, and an optional rules card. It does NOT write the cards; `cards` stays `[]`.

Everything runs through `src/v2-compose-cards.ts` (run `node src/v2-compose-cards.ts` with no arguments for usage). `season-2/cards.json` is the worked example: copy its shape, not its theme. Full docs: `src/docs/v2-compose-cards.md`.

## Steps

1. **Ask for the theme.** Ask the user in chat for the theme and any wishes for the colour scheme. Propose the rest and let them change it: set name, number of cards (default 30), stat names that fit the theme (default three; four fit, see season 4), and rarities (default Common, Rare, Legendary). Also ask if the rarity badge goes bottom-left or bottom-right (default: number bottom-left, rarity bottom-right). Every season gets a card back. Ask if the user also wants a rules card (optional; default no), and if so, what the rules are.

2. **Make the folder.** Use the next free `season-N` (look at the existing `season-*` folders). Write `season-N/cards.json` with:
   - `set`: `name`, `totalCards`, `statNames`, `rarities`.
   - `sharedPrompt.format`: one full-bleed borderless illustration, flat 2D (as in season 2).
   - `sharedPrompt.artStyle`: one paragraph naming the style, linework, shading, a palette of 4-6 colours, texture and mood. Every card uses it, so be specific.
   - `sharedPrompt.frame`: a list of lines, each describing one part of the frame:
     - **Border**: colour, material and ornament that fit the theme.
     - **Top-left emblem**: a small emblem with no letters.
     - **Top**: an empty name banner about 10% of the card height.
     - **Bottom**: a pale text panel about a quarter of the card height, with an empty upper half for flavour text and a thin divider across the middle. The panel must be pale, because the text is drawn in dark colours.
     - **Stats row**: the lower half of the panel split into one equal cell per stat, with thin vertical dividers. Each cell has a small bold icon on its left, "no wider than a quarter of the cell", and the right three-quarters empty "for a word like '<longest stat name in capitals>' and a large number". Without the size limit the model draws huge icons and the stat text has no room. Describe each icon in `statNames` order, left to right.
     - **Card number and rarity**: two separate empty badges of the same height on the border below the panel, one in each bottom corner: a wide dark plaque for the number, "about 22% of the card width, so it can hold text like '#30 of 30'", and a wide pale pill for the rarity, "about 25% of the card width, so it can hold a word of nine capital letters". A small plaque and pill side by side in one corner come out too small to read.
     - **Accent colours**: list the allowed accent colours, then add "Do not use pink, magenta or hot pink anywhere on the frame."
     - Leave out the art window and any "no text" rule, because the script adds both.
   - `sharedPrompt.negative`: what the art must not contain.
   - `cards`: `[]`.

3. **Show the frame prompt.** Run `node src/v2-compose-cards.ts frame-prompt season-N/cards.json` and show it to the user. Change `cards.json` until they approve it.

4. **Make the frame.** Each frame is a paid image, so confirm with the user before generating one.
   - If an OpenRouter image tool (MCP) is available: send it the printed prompt at 1024x1536, save the PNG as `season-N/frame.png`, then run `node src/v2-compose-cards.ts layout season-N/cards.json`.
   - Otherwise, if `OPENROUTER_API_KEY` is set: run `node src/v2-compose-cards.ts frame season-N/cards.json`.
   - Otherwise, ask the user to run that command, or to make the image elsewhere from the printed prompt, save it as `season-N/frame.png` and run `layout`. Wait for them to tell you it is done.

5. **Check the frame.** Read `season-N/frame.png` and check that:
   - the window is one clean solid magenta rectangle;
   - there is no text anywhere;
   - there is one icon per stat, in `statNames` order;
   - the number plaque and the rarity pill are both present.

   If the frame fails a check, change `sharedPrompt.frame` and make a new frame. `frame` moves the old frame to `rejected/` and keeps the layout. If `layout` reports "No magenta window", the frame must be made again.

6. **Fit the art to the window.** The art is scaled and cropped to fill the frame's window, so art of a different shape loses its top and bottom or its sides. Before any card art is made, set `sharedPrompt.artSize` in `cards.json` to the shape of `layout.window`:
   - Keep the height at 1024 and set the width to `1024 × window.width ÷ window.height`, rounded to the nearest multiple of 16. For example, a window of 891x640 gives `"artSize": "1424x1024"`.
   - The frame prompt asks for a window height of 55% of the card, or `sharedPrompt.windowHeight` if set, but the real window can differ. Always use the measured `layout.window`.
   - If you make a new frame, check the window again and update `artSize` if its shape changed.
   - Art made before `artSize` was set or changed keeps its old shape. Replace it with `node src/v2-compose-cards.ts redo season-N/cards.json <cardNumber>`, which costs one image per card, so confirm with the user first.

7. **Tune the layout.** `frame` and `layout` write a starting `layout` to `cards.json`. Measure the real frame in pixels (1024x1536) and edit the layout:
   - `text.name`: the centre of the empty banner. Set `maxWidth` to the banner's inner width.
   - `text.flavour`: the centre of the panel's upper half, with `wrap: true`.
   - `stats[i].label` and `stats[i].value`: one entry per stat, in `statNames` order. Put the value in the space to the right of the icon. Put the label there too if it fits; otherwise put it in the strip above the icon, centred on the cell.
   - `text.number`: the centre of the plaque, in light text. `text.rarity`: the centre of the pill, in dark text.
   - `y` is the vertical centre of the text. One-line text shrinks to fit `maxWidth`, using `charWidth` (font size × character count) to estimate its width. Use about 0.75 for Arial Black, and up to 0.95 for short capitalised words in small spaces.

   Then repeat until nothing overflows, overlaps an icon or sits off-centre:
   1. Run `node src/v2-compose-cards.ts preview season-N/cards.json`.
   2. Read `season-N/preview.png`. It shows the longest name and flavour text, the longest rarity and every stat at 10, on grey placeholder art.
   3. Fix any problems in the layout.

8. **Make the card back.** Add `cardBack.prompt` to `cards.json`: the back of one vertical card, filling the image edge to edge, in the set's art style, using the same border as the frame and the set's emblem as the centrepiece, with no text, letters, numbers, pink or magenta. For a back that looks the same either way up, ask for a design mirrored top to bottom, with no single upright object in the middle. Show the user the prompt and confirm before generating, because it is a paid image. Use an OpenRouter image tool (MCP) at 1024x1536 with the same model as `MODEL` in `src/v2-compose-cards.ts`, and save the PNG as `season-N/card-back.png`. `src/v2-compose-cards.ts` has no command for this. If no MCP tool is available, ask the user to make the image elsewhere and save it there. Then read the image and check its style against the frame.

9. **Make the rules card, only if the user wants one.** See `season-6/cards.json` and `season-6/rules-frame.png` for a worked example.
   1. Add `rulesCard` to `cards.json`: `title`, and `steps` as a list of short rules without numbers, because the script adds them. Show the user the wording and change it until they approve it.
   2. Make the card's own frame, using the same generation route as step 8 and confirming first: the same border, emblem and name banner as `frame.png`, with one large, empty, evenly pale panel in place of the window, text panel, icons and badges. Tell it that there is no text anywhere, and do not use magenta. Save it as `season-N/rules-frame.png`.
   3. Add `rulesCard.layout`: `title` is a text box in the banner, `step` is a text box with `wrap: true`, `anchor: "start"` and `y` set to the top of the first step, and `gap` is the space between steps in pixels.
   4. Run `node src/v2-compose-cards.ts rules season-N/cards.json` and read `season-N/rules-card.png`. Repeat until the text stays on the panel and clear of any artwork in its corners. Changing the wording can change the fit, so check it again after each edit.

10. **Hand over.** Tell the user that the season is ready for card details, and show them the final preview. Each card needs `id` (kebab-case of the name), `name`, `cardNumber`, `rarity`, `character`, `poseAndExpression`, `backgroundScene`, `flavourText` and `stats` (0-10 for each stat name). `node src/v2-compose-cards.ts cards season-N/cards.json` then builds the cards.

11. **After the cards are built.** The steps above stop before the cards exist, so do this when the user has built them:
   1. Run `node src/make-small-cards.ts season-N/cards.json`.
   2. Generate `season-N/README.md` from `cards.json`, so that opening the folder on GitHub shows every card. Copy the shape of `season-5/README.md`:
      - A `# Season N: <set name>` heading, the card count, and "Select a card to open the full-size image."
      - A list with the stats, the rarities with their counts, and a link to `cards.json`, then a link back to `../README.md`.
      - The card back and any rules card, as in the "How to play" section of `season-6/README.md`. If there is no rules card, name the section "Card back".
      - A `## Cards` section with one line per card, in card number order, using paths from `image` and `imageSmall` without the leading `./`: `<a href="cards/x.png"><img src="cards/x-small.webp" alt="#1 Name" width="240"></a>`. Keep the lines together with no blank lines, so the cards wrap into a grid.
      - Check that every image path exists and that the number of cards matches `totalCards`. Make the file again if a card changes.
   3. Add the season to the sets table in the main `README.md`, and update any "Seasons 2 to N" wording.

## Common mistakes

| Mistake | Fix |
|---|---|
| Using a dark text panel to suit the theme | Keep the panel pale; the text is drawn in dark colours |
| Using magenta or pink as an accent colour | It breaks the window search; ban it in the accent line |
| Describing the window in the `frame` lines | The script adds the window rules; leave them out |
| Icons in a different order from `statNames` | Labels are drawn by index, so the order must match |
| Tuning the layout without running `preview` | Always check the image; the width estimates are rough |
| Generating a frame without asking | Every frame costs money; confirm first |
| Small number plaque and rarity pill side by side | One wide badge in each bottom corner, with a size in % of card width |
| Icons with no size limit | Say "no wider than a quarter of the cell"; huge icons leave no room for the stat text |
| Assuming a new frame keeps the old positions | A new frame keeps the layout, but its parts move; run `preview` and re-measure |
| Making card art before setting `artSize` | The default square art gets cropped; set it from `layout.window` first |
| Forgetting the season's `README.md` | Generate it after `make-small-cards.ts`, once every card has an `imageSmall` |
| Making a rules card without asking | It is optional; ask in step 1. The card back is not optional |
| Rules text running into the rules frame's artwork | Read `rules-card.png` after every wording change, and make the text smaller if needed |
| Measuring by eye only | Scan pixels with sharp (e.g. find the pale pill by colour) to get exact badge bounds |
