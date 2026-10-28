# Building Image Prompts from `cards.json`

Each `cards.json` file has everything you need to write a full prompt for an image generator. The prompt has two parts:

- **Shared parts** come from `sharedPrompt`. They are the same for every card, so all the cards in a set have the same look.
- **Card parts** come from one entry in `cards`. They describe one character.

## Prompt template

Replace each `{...}` with the field shown. Keep the section headings. They help the image generator keep the parts apart.

```text
TRADING CARD — {card.name in UPPER CASE}

FORMAT
{sharedPrompt.format}

ART STYLE (keep identical on every card)
{sharedPrompt.artStyle}

CARD LAYOUT (keep identical on every card)
- {sharedPrompt.cardLayout[0]}
- {sharedPrompt.cardLayout[1]}
- ...one line for each item

THIS CARD
Character: {card.character}
Pose and expression: {card.poseAndExpression}
Background scene: {card.backgroundScene}
Flavour text: "{card.flavourText}"
Stats: {statName} {value} / {statName} {value} / {statName} {value}
Rarity: {card.rarity}
Card number: #{card.cardNumber} of {set.totalCards}

NEGATIVE
{sharedPrompt.negative}
```

Put the stats in the order given by `set.statNames`. For season 1 that order is Courage, Snacks, Sneakiness.

## Field map

| Prompt section | Source in `cards.json` |
|---|---|
| Title | `cards[i].name`, in upper case |
| FORMAT | `sharedPrompt.format` |
| ART STYLE | `sharedPrompt.artStyle` |
| CARD LAYOUT | `sharedPrompt.cardLayout` (one bullet for each item) |
| Character | `cards[i].character` |
| Pose and expression | `cards[i].poseAndExpression` |
| Background scene | `cards[i].backgroundScene` |
| Flavour text | `cards[i].flavourText`, in quotes |
| Stats | `cards[i].stats`, in `set.statNames` order |
| Rarity | `cards[i].rarity` |
| Card number | `cards[i].cardNumber` and `set.totalCards` |
| NEGATIVE | `sharedPrompt.negative` |

## Example: Tilt-a-Bot

This is the card with `"id": "tilt-a-bot"` from [season-1/cards.json](season-1/cards.json):

```text
TRADING CARD — TILT-A-BOT

FORMAT
A single vertical trading card, portrait orientation, 2.5:3.5 aspect ratio, centred on a plain neutral background with a slight drop shadow. The card has rounded corners and a thick printed border. Flat 2D illustration, no 3D rendering, no photorealism.

ART STYLE (keep identical on every card)
Classic American Saturday-morning cartoon style of the late 1980s and early 1990s, in the manner of Hanna-Barbera television animation: bold clean black ink outlines of uniform weight, flat cel-shaded colours with no gradients, simple two-tone shadows, slightly exaggerated proportions, expressive faces with large simple eyes and thick eyebrows, hand-painted background feel with soft airbrushed skies and muted gouache textures. Limited palette: warm oranges, mustard yellow, teal, purple, olive green, with heavy use of deep purple and dark teal for spooky shadows. Slight halftone print grain and subtle colour misregistration like a vintage printed card. Overall mood: playful, mysterious, a little spooky but friendly.

CARD LAYOUT (keep identical on every card)
- Top banner: the character name in chunky, slightly wobbly 1980s cartoon title lettering, bright yellow with a dark purple outline.
- Centre: a large character portrait box with a thin inner frame, character shown from the waist up in a dynamic pose against a themed background.
- Bottom panel: a cream-coloured text box with a short flavour line in a rounded sans-serif, and three small stat icons with numbers.
- Border: thick teal border with a thin orange pinstripe inside it; small retro starburst logo in the top-left corner; card number and rarity gem in the bottom-right corner.

THIS CARD
Character: A boxy, clunky 1950s-style robot built from a rusted carnival ride car — a rounded teal body with peeling orange racing stripes and a faded number "7" on the chest. Riveted silver arms with pincer claws, a domed head with a single round glowing orange eye, an antenna topped with a tiny flickering light bulb, and a grille mouth that lights up in a jagged grin. One shoulder has a cracked carousel-horse head bolted on as a decoration, and loose wires spark from a dented panel on the side. A limp string of burnt-out fairground bulbs is draped around the neck like a scarf.
Pose and expression: Lurching forward with one claw raised and the other holding a half-crushed bag of popcorn, eye wide and glowing, head tilted at a creepy angle as if it's just noticed you.
Background scene: An abandoned amusement park at night — a rusting Ferris wheel looming in the background with only a few bulbs still lit, a collapsed roller coaster track, a faded "FUNLAND" entrance arch with missing letters, a tilted cotton-candy stand, overgrown weeds cracking through the pavement, thick fog at ground level, and a deep purple sky with a sickly yellow-green moon.
Flavour text: "Please keep your arms and legs inside the robot."
Stats: Courage 8 / Snacks 2 / Sneakiness 3
Rarity: Rare
Card number: #23 of 30

NEGATIVE
No photorealism, no 3D render, no anime style, no modern vector/flat-design look, no gradients, no watermarks, no extra text beyond what is specified, no blurry or cut-off borders, no real or existing cartoon characters.
```

## Build the prompt with a script

This Python script uses only the standard library. It prints the prompt for one card:

```python
# build_prompt.py — usage: python build_prompt.py season-1/cards.json tilt-a-bot
import json, sys

data = json.load(open(sys.argv[1], encoding="utf-8"))
s, p = data["set"], data["sharedPrompt"]
card = next(c for c in data["cards"] if c["id"] == sys.argv[2])

layout = "\n".join(f"- {line}" for line in p["cardLayout"])
stats = " / ".join(f"{name} {card['stats'][name]}" for name in s["statNames"])

print(f"""TRADING CARD — {card['name'].upper()}

FORMAT
{p['format']}

ART STYLE (keep identical on every card)
{p['artStyle']}

CARD LAYOUT (keep identical on every card)
{layout}

THIS CARD
Character: {card['character']}
Pose and expression: {card['poseAndExpression']}
Background scene: {card['backgroundScene']}
Flavour text: "{card['flavourText']}"
Stats: {stats}
Rarity: {card['rarity']}
Card number: #{card['cardNumber']} of {s['totalCards']}

NEGATIVE
{p['negative']}""")
```

On Windows, set `PYTHONIOENCODING=utf-8` before you run the script. If you don't, the em dashes can print incorrectly.

## Make your own cards

To add a character in the same style, add a new entry to `cards` with the same fields. Then build its prompt. Do not change the `sharedPrompt` text, so the new card matches the rest of the set.
