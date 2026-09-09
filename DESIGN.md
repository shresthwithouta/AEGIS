---
name: AEGIS
description: A district emergency operations console drawn as a signed government file — ruled columns, hairlines, a numbered margin rail, and violet stamp-pad ink for authority.
colors:
  jacket: "#d9ddd2"
  jacket-edge: "#cbd0c2"
  sheet: "#f3f5ef"
  sheet-raised: "#fafbf7"
  sheet-sunk: "#e9ece3"
  ink: "#16211c"
  ink-2: "#3f4b45"
  ink-3: "#53605a"
  ink-4: "#616e68"
  rule: "#c2cabb"
  rule-soft: "#d6dccf"
  rule-strong: "#97a292"
  control-edge: "#6b786d"
  stamp: "#5b2d8e"
  tape: "#b4232a"
  seal: "#0f5c4a"
  pencil: "#3a5a7c"
  live: "#0f5c4a"
  sim: "#a3206b"
  warn: "#785710"
  halt: "#b8202c"
  water: "#1d6088"
  sev-clear: "#84958f"
  sev-monitor: "#d9ae3c"
  sev-elevated: "#ce8617"
  sev-severe: "#be5010"
  sev-critical: "#96161d"
  dark-jacket: "#0d1116"
  dark-jacket-edge: "#070a0d"
  dark-sheet: "#141a20"
  dark-sheet-raised: "#1a222a"
  dark-sheet-sunk: "#0f151a"
  dark-ink: "#e3e9e4"
  dark-ink-2: "#b3bdb7"
  dark-ink-3: "#7f8c86"
  dark-ink-4: "#7c8983"
  dark-rule: "#2a343c"
  dark-rule-soft: "#202930"
  dark-rule-strong: "#3d4a53"
  dark-control-edge: "#647178"
  dark-stamp: "#a97ce8"
  dark-tape: "#ea666b"
  dark-seal: "#3fbf9b"
  dark-pencil: "#7aa8d0"
  dark-live: "#3fbf9b"
  dark-sim: "#f28ac6"
  dark-warn: "#d8a63a"
  dark-halt: "#ff5a63"
  dark-water: "#4d94c4"
  dark-sev-clear: "#697872"
  dark-sev-monitor: "#87801f"
  dark-sev-elevated: "#d6ae24"
  dark-sev-severe: "#e5613a"
  dark-sev-critical: "#ff97a4"
typography:
  masthead:
    fontFamily: "Archivo Narrow, Archivo, ui-sans-serif, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.2em"
  display:
    fontFamily: "Archivo Narrow, Archivo, ui-sans-serif, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  display-lg:
    fontFamily: "Archivo Narrow, Archivo, ui-sans-serif, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  numeral:
    fontFamily: "Azeret Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "normal"
    fontFeature: "'tnum' 1, 'lnum' 1"
  reading:
    fontFamily: "Azeret Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
    fontFeature: "'tnum' 1, 'lnum' 1"
  section-head:
    fontFamily: "Archivo Narrow, Archivo, ui-sans-serif, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.08em"
  headline:
    fontFamily: "Archivo Narrow, Archivo, ui-sans-serif, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "Archivo Narrow, Archivo, ui-sans-serif, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.14em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body-dense:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  figure:
    fontFamily: "Azeret Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
    fontFeature: "'tnum' 1, 'lnum' 1"
  label:
    fontFamily: "Archivo Narrow, Archivo, ui-sans-serif, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.11em"
  micro-label:
    fontFamily: "Archivo Narrow, Archivo, ui-sans-serif, sans-serif"
    fontSize: "0.5625rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.1em"
  rail:
    fontFamily: "Azeret Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.625rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.02em"
    fontFeature: "'tnum' 1"
  sub-label:
    fontFamily: "Archivo Narrow, Archivo, ui-sans-serif, sans-serif"
    fontSize: "0.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.13em"
  devanagari:
    fontFamily: "Noto Sans Devanagari, Archivo, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  none: "0px"
  focus-ring: "1px"
spacing:
  hair: "1px"
  xs: "0.25rem"
  sm: "0.4375rem"
  md: "0.625rem"
  lg: "0.8125rem"
  cell-x: "0.75rem"
  gutter: "1rem"
  section: "1.75rem"
  rail: "3.25rem"
components:
  button:
    backgroundColor: "{colors.sheet-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.micro-label}"
    rounded: "{rounded.none}"
    padding: "0.4375rem 0.8125rem"
  button-hover:
    backgroundColor: "{colors.sheet-sunk}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.none}"
    padding: "0.4375rem 0.8125rem"
  button-primary-hover:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.sheet}"
  button-stamp:
    backgroundColor: "{colors.sheet-raised}"
    textColor: "{colors.stamp}"
    rounded: "{rounded.none}"
    padding: "0.4375rem 0.8125rem"
  button-danger:
    backgroundColor: "{colors.sheet-raised}"
    textColor: "{colors.tape}"
    rounded: "{rounded.none}"
    padding: "0.4375rem 0.8125rem"
  input:
    backgroundColor: "{colors.sheet-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    rounded: "{rounded.none}"
    padding: "0.4375rem 0.625rem"
    width: "100%"
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  sheet-raised:
    backgroundColor: "{colors.sheet-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  band-chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.micro-label}"
    rounded: "{rounded.none}"
    padding: "0.0625rem 0.375rem"
  stamp-impression:
    backgroundColor: "transparent"
    textColor: "{colors.stamp}"
    rounded: "{rounded.none}"
    padding: "0.5rem 1rem"
  register-header-cell:
    textColor: "{colors.ink-3}"
    typography: "{typography.label}"
    padding: "0.375rem 0.625rem"
  register-cell:
    textColor: "{colors.ink}"
    typography: "{typography.body-dense}"
    padding: "0.4375rem 0.625rem"
  field-row:
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    padding: "0.4375rem 0.75rem"
---

# Design System: AEGIS

## Overview

**Creative North Star: "The Signed Order"**

AEGIS is drawn as an Indian district file translated into a screen grammar, not as a dashboard. The product of the system is a signed, auditable order, so the interface is the document that carries it: ruled columns, hairline rules, a numbered margin rail on every register, and a stamp that lands on the sheet as an impression rather than a toast. There are no cards anywhere in the build — structure is carried entirely by rules and columns, so a dense screen reads as one continuous document rather than a tray of tiles.

The reading field stays achromatic. Colour is a material in this world, not decoration: violet stamp-pad ink for authority, red-tape crimson for halt, file green for verified, blue pencil for provisional marks. Every one of these sits in a border, an edge rule, a chip stroke or a dot — never behind a figure and, in the severity scale, never inside text. Density is high and deliberate: 0.625rem–0.8125rem is the working range, and the system trusts tabular numerals and hairlines to hold that density legible under pressure rather than reaching for whitespace.

Two grounds ship, and both are real use scenes rather than a preference toggle: a bright district control room with the screen mirrored to a wall (the noting-sheet ground), and the same desk at 03:00 with the room lights down (the ink ground). The grammar is identical across both; only the ground changes. The confirmed anti-references are the dark glowing mission-control template and its opposite, the white tricolour government portal.

**Key Characteristics:**
- Zero border-radius, everywhere, including data marks and stroke caps.
- Hairline rules and ruled columns instead of cards, shadows or fills.
- A numbered margin rail on every register — the serial is the audit trail.
- Tabular, lining numerals on every figure in the system.
- Colour lives in edges, borders and chips; the reading field stays achromatic.
- Two complete themes, defined explicitly rather than derived.

## Colors

A near-achromatic green-grey file ground carrying four saturated "materials" — stamp violet, tape crimson, file green, blue pencil — plus a five-step severity status ramp that is only ever expressed as an edge.

### Primary
- **Stamp-Pad Violet** (`{colors.stamp}` / `{colors.dark-stamp}`): the authority ink. Carries the AEGIS mark, the approval stamp impression, the stamp-tone button border, the active registration ticks, the slide-rule thumb, the caret, selection, the focus ring, and the active phase in the rail. It marks the act of committing, and nothing else.

### Secondary
- **Red-Tape Crimson** (`{colors.tape}` / `{colors.dark-tape}`): halt and rejection. Reject-tone stamp impressions and danger-tone control borders.
- **File Green** (`{colors.seal}` / `{colors.dark-seal}`): verified and approved; also the `live` status tone.
- **Blue Pencil** (`{colors.pencil}` / `{colors.dark-pencil}`): provisional and annotated marks — the officer's soft pass over the sheet, never a committed value.

### Tertiary
- **Plum Provenance** (`{colors.sim}` / `{colors.dark-sim}`): the honesty label. Anything simulated wears it — the drone coverage seam, the "Simulated" provenance mark, sensor-feed coverage bars.
- **Ledger Amber** (`{colors.warn}` / `{colors.dark-warn}`): degraded-but-running — the rule-engine fallback state and cautionary marginal notes.
- **Halt Signal** (`{colors.halt}` / `{colors.dark-halt}`): a blocked or threshold-crossing condition on a live figure, distinct from the tape crimson used on controls.
- **Survey Blue** (`{colors.water}` / `{colors.dark-water}`): flood extent. It sits outside the severity ramp on purpose: extent is a different encoding job from severity, and mixing them would let a deep-water zone read as a critical zone.

### Neutral
- **Jacket** (`{colors.jacket}` / `{colors.dark-jacket}`): the file board the app sits on — page background and masthead ground.
- **Sheet / Sheet Raised / Sheet Sunk** (`{colors.sheet}`, `{colors.sheet-raised}`, `{colors.sheet-sunk}`): the three paper planes. Sheet is the default ruled field; raised carries controls, inputs and floating panels; sunk is the pressed state.
- **Ink, Ink-2, Ink-3** (`{colors.ink}`, `{colors.ink-2}`, `{colors.ink-3}`): the text ramp — primary figures and headings, secondary prose, and captions / column heads / rail serials.
- **Ink-4** (`{colors.ink-4}`): marks only.
- **Rule, Rule-Soft, Rule-Strong** (`{colors.rule}`, `{colors.rule-soft}`, `{colors.rule-strong}`): the ledger skeleton — the default 1px rule, the lighter within-block divider, and the structural rule that closes a register or a masthead.
- **Control Edge** (`{colors.control-edge}` / `{colors.dark-control-edge}`): the boundary of anything interactive.

### Named Rules

**The Edge-Not-Fill Rule.** Severity never colours text and never fills a reading surface. It lives in a 1px chip border, a 2px inset chip edge, a `.band-edge` inset rule, a 3px underline beneath a large numeral, and the foot of a zone cell. Chip and numeral text is always `--ink`. This is a measured constraint, not a preference: the light ramp's pale steps measured 1.5–2.3:1 as 9px text, and a labelled chip is no relief when the label is the failing colour.

**The Marks-Only Rule.** `--ink-4` is for hairline glyphs, disabled states and decorative rules. It never carries text. It clears 4.5:1 on the sheet grounds but not on the jacket, so every text use steps up to `--ink-3` or above. Every other text token clears 4.5:1 on all four grounds in both themes.

**The Two-Material Rule.** Plum (`--sim`) and violet (`--stamp`) are separated by hue, not lightness — roughly ΔE 16 apart. One says a figure is simulated; the other says a human committed to it. Never bring their hues closer, and never substitute one for the other.

**The Status-Scale Rule.** The severity ramp is a labelled status palette, not a categorical or continuous one. CVD separation passes in both themes. Light is lightness-monotonic; dark is not, and cannot be — a yellow-to-red path has no monotonic lightness — which is acceptable only because the ramp always travels with its label and never carries meaning by colour alone.

**The Two-Grounds Rule.** Day and night are both production scenes. Every new token must be specified in both, at the same contrast standard, in all three theme blocks (`:root`, the `prefers-color-scheme: dark` block, and `[data-theme='dark']`). A token defined in one ground only is an unshipped token.

## Typography

**Display Font:** Archivo Narrow (with Archivo, then a system sans fallback)
**Body Font:** Archivo (with `ui-sans-serif`, `system-ui`)
**Label/Mono Font:** Azeret Mono (with `ui-monospace`, SF Mono, Menlo)
**Script Extension:** Noto Sans Devanagari, for the bilingual Hindi field instructions

**Character:** Archivo is a grotesque with genuine form-and-document character; its narrow cut supplies the compressed, letterspaced caps that column heads and field labels need without shouting. Azeret Mono is squared and stamped — the face for every figure in the system. The pairing reads as a printed register rather than a product UI.

### Hierarchy
- **Masthead** (Archivo Narrow 700, 1.0625rem, `0.2em`, uppercase): the AEGIS wordmark on the file's cover line only.
- **Display** (Archivo Narrow 700, 1.75rem rising to 2.125rem at `sm` and above, line-height 1.05, `-0.01em`, uppercase): the page title in `PageHead`, one per screen, constrained to 62ch.
- **Section Head** (Archivo Narrow 600–700, 0.875rem, `0.08–0.12em` where uppercase): the head of a self-contained block *within* a page — an approval-gate title, a trigger banner, a subsystem entry, an after-action finding. Sits between Display and Headline: bigger than a record title, never competing with the page title.
- **Headline** (Archivo Narrow 600, 0.9375rem, line-height 1.25): record titles inside a register row.
- **Title** (Archivo Narrow 700, 0.6875rem, `0.14em`, uppercase): sheet heads — the caption sitting on the rule above a field block.
- **Body** (Archivo 400, 0.8125rem, line-height 1.55): standfirsts and explanatory prose, capped at 70–72ch.
- **Body Dense** (Archivo 400, 0.75rem, line-height 1.5): register cells, marginal notes, empty-state copy.
- **Figure** (Azeret Mono 400, 0.8125rem, tabular lining numerals): every value in a field row.
- **Label** (Archivo Narrow 600, 0.625rem, `0.10–0.11em`, uppercase): column heads and field labels.
- **Reading** (Azeret Mono 600, 1.125rem, tabular): a figure read at a glance from standing distance — the forecast peak, the danger level, the lead time on the preparedness trigger. One step above a field value, well below the severity numeral.
- **Numeral** (Azeret Mono 600, 1.75–2rem, line-height 1, tabular): the single dominant figure on a record — a zone severity or a vulnerability index — carried on a 3px band-coloured rule rather than in a band colour. One per record, never more.
- **Micro Label** (Archivo Narrow 600, 0.5625rem, `0.10–0.11em`, uppercase): band chips, provenance marks, status-dot labels, stage numbers.
- **Rail** (Azeret Mono 400, 0.625rem, `0.02em`, tabular): margin serials, file numbers, hint lines.
- **Sub-label** (Archivo Narrow 600, 0.5rem, `0.12–0.14em`, uppercase): the smallest voice in the system, reserved for a qualifier hanging under something already labelled — the gate number under a stage name, the stamp caption under APPROVED, the expanded wordmark under AEGIS. Never used alone, never used for a value.

### Named Rules

**The Tabular Rule.** Every figure in this system is compared against the figure in the row above it, so `tabular-nums lining-nums` is applied globally to tables, `[data-numeric]` and `.num`, and every mono value carries it — including figures drawn inside SVG. A proportional numeral in a register is a defect.

**The Two-Voice Rule.** Prose is Archivo; every label, head and control is Archivo Narrow in letterspaced caps; every number is Azeret Mono. A number set in the sans faces, or a paragraph set in the narrow cut, is out of the world.

**The Standing-Head Rule.** A page heading carries its own weight — no eyebrow, kicker or category line above it. `PageHead` renders title, standfirst and file number in that order, and nothing before the title.

## Layout

A single centred column of maximum width 110rem, with `0.75rem` horizontal padding rising to `1.25rem` at `sm`, and `1.25rem` / `1.75rem` vertical. The masthead is sticky at the top with a 2px backdrop blur over a 95%-opaque jacket, closed by a `--rule-strong` hairline; beneath it the phase rail sits on its own `--rule` line and never wraps — it scrolls horizontally instead, because losing your place in the phase sequence during an incident is a real cost.

Pages are vertical stacks of sheets with `1.25rem` (operational screens) or `1.75rem` (briefing screens) between blocks. Within a sheet, structure comes from rules, not from padding: a header row closed by `--rule`, then field or register rows each closed by `--rule-soft` with the last border suppressed. Multi-panel arrangements use a plain 3-column grid at `md` with a `1rem` gutter and stack below it.

The spacing rhythm is tight and consistent: `0.4375rem` vertical / `0.75rem` horizontal is the row unit for field rows and register cells; `0.4375rem` / `0.8125rem` is the control unit; `0.625rem` is the small internal gap. The margin rail reserves `3.25rem` (`--rail`). Long-form prose caps at 62–72ch; registers hold a `38rem` minimum width and scroll horizontally rather than reflowing their columns.

## Elevation & Depth

The system is flat by commitment. Depth is tonal — three paper planes (`--sheet-sunk`, `--sheet`, `--sheet-raised`) on the `--jacket` ground — plus hairline rules in three weights. Exactly one ambient shadow ships: `--shadow-1`, used only by `.sheet-raised` to lift a floating panel a millimetre off the board, plus `--stamp-shadow` under the stamp impression. The pressed state of a button is an inset shadow, not a lift. Everything else that would be a shadow in another system is a rule here.

### Shadow Vocabulary
- **Sheet lift** (`box-shadow: 0 1px 2px #16211c14, 0 2px 6px #16211c0f` day / `0 1px 2px #00000059, 0 2px 8px #0000003d` night): the only ambient shadow, and only on `.sheet-raised`.
- **Pressed** (`box-shadow: inset 0 1px 2px #16211c1f`): the active state of `.btn`, reading as the sheet taking pressure.
- **Chip edge** (`box-shadow: inset 2px 0 0 var(--band)`): not depth at all — the severity edge rule, carried as an inset shadow because it must sit inside the 1px border.

### Named Rules

**The Rule-Not-Shadow Rule.** Separation between two blocks is a 1px hairline in `--rule`, `--rule-soft` or `--rule-strong`. Reach for a shadow only when a surface genuinely floats over the page; on a ruled field, a shadow is a card in disguise.

## Shapes

Zero border-radius, everywhere. Sheets, buttons, inputs, chips, stamp impressions, slider thumbs and every drawn data mark are square. SVG strokes use `square` caps and `miter` joins — including the icon set, whose 16-unit grid and 1.25 stroke were chosen so drawn marks sit in the same family as the hairline rules. Rounded ends on a bar or a line would soften the marks out of the world; this deliberately overrides the usual chart-mark convention of rounded data terminals.

The only curve in the system is a `1px` radius on the focus outline, which exists so a 2px violet ring does not pinch at its corners.

Recurring geometry: **registration ticks** (`.ticked`), a 7px corner bracket at top-left and bottom-right of every sheet, growing to 11px and turning stamp-violet on the panel that currently holds the operation. **Hatching** (`.hatch`), a 45° repeating 1px rule at 6px pitch, marks unavailable or out-of-scope areas. Proportions are drawn as flat ruled bars over a `--rule` baseline, animated by `scaleX` rather than `width`.

## Components

### Buttons
- **Shape:** square (0px), 1px border in `--control-edge`, uppercase Archivo Narrow at 0.6875rem / `0.09em`.
- **Default:** raised sheet ground, ink text, control-edge border, `0.4375rem 0.8125rem` padding.
- **Hover / Active:** border steps to `--ink-2` and the ground drops to `--sheet-sunk` over 120ms `ease-out`; active adds the inset pressed shadow. Disabled is 42% opacity with `not-allowed`.
- **Primary:** solid ink ground with sheet-coloured text; hover lightens to `--ink-2`.
- **Stamp tone:** transparent with a violet border and violet text; hover fills with `--stamp-soft` (violet at 15%).
- **Danger tone:** transparent with a tape-crimson border and text; hover fills with 10% tape.

### Chips
- **Band chip:** a 1px border in the severity colour with a 2px inset edge on its left, transparent ground, and **ink-coloured** micro-label text. The severity colour is never the text colour.
- **Provenance mark:** the same silhouette in the provenance tone (live / warn / sim / idle), carrying a 9px inline SVG icon and its label; here the border and text share the tone, because those four colours all clear 4.5:1.
- **Status dot:** a 6px square (never a circle) in the tone, optionally pulsing at 1.9s, with an optional tone-coloured micro label.

### Cards / Containers
There are no cards. The container primitive is the **Sheet**: a `--sheet` ground with a 1px `--rule` border, zero radius, no shadow, and registration ticks at two corners. A Sheet in raised mode swaps to `--sheet-raised` and takes `--shadow-1`. Internal structure is a header row (`0.5rem` / `0.75rem` padding, closed by a `--rule` line) followed by rows separated by `--rule-soft`. Sheets carry no internal padding of their own — content blocks supply their own row padding so rules can run edge to edge.

### Inputs / Fields
- **Style:** raised sheet ground, 1px `--rule` border with the bottom edge stepped up to `--rule-strong` (the writing line of a form field), zero radius, Azeret Mono at 0.8125rem, `0.4375rem 0.625rem` padding, full width. Placeholder is `--ink-4`.
- **Focus:** the border turns stamp-violet and a 2px `--stamp-soft` halo appears; the native outline is suppressed only because that treatment replaces it. Everywhere else, `:focus-visible` is a 2px `--focus` outline at 2px offset.
- **Range control:** a slide rule — a 3px `--rule` track topped by a `--control-edge` hairline, with a 3px × 15px square violet thumb. No round handle, no filled track.

### Navigation
Two tiers in the masthead. The upper carries the AEGIS mark, the wordmark, an expansion line at `lg`, a hairline divider, the file number in the rail voice, the IST incident clock in tabular mono, a reasoning status dot and the day/night toggle. The lower is the phase rail: one unbroken horizontal line of Situation plus the three disaster phases (Before / During / After), each phase preceded by a 1px divider and a violet phase label when active. Items are micro-label caps with a 12px icon and a 2px bottom border — transparent when inactive, `--stamp` when active. Navigation links carry no underline; body links underline in `--rule-strong` at `0.22em` offset.

### The Stamp
The signature component, and the system's one authored moment. An inline-flex block with a **double rule** (2px border plus a 1px inset ring) in stamp violet, uppercase Archivo Narrow at `0.16em`, rotated `-6deg`, at 92% opacity, with `mix-blend-mode: multiply` by day and `screen` at night so it reads as ink absorbed into the sheet rather than a sticker laid on top. It lands with a 480ms `cubic-bezier(0.16, 1, 0.3, 1)` drop — scale 1.5 and 3px blur down to a slight overshoot at 1.015 — and holds. A reject-tone stamp swaps every violet for tape crimson.

### The Stamp Button
Approval is the one irreversible act, so it is the one act that asks for a physical gesture. A stamp-tone button fills a 2px violet rule along its own foot over a 750ms hold, showing live percentage in place of its label; releasing early abandons it. Enter and Space are the same gesture for keyboard. Under `prefers-reduced-motion` the hold degrades to a single press rather than a timed fill, because a motion-free affordance cannot honour a timed one. An optional hint line sits below in the rail voice.

### The Stage Rail
Five stages on one line: a 20px square outline box carrying either a mono stage number or a check glyph, a narrow-caps label, and a 2px bottom border that appears only on the current stage or an open gate. Between stages, a drawn 18px connector — solid `--rule-strong` for done, `3 3` dashed and marching (`.chase`, 900ms linear) for the stage in progress, plain `--rule` for pending. Done is file green; now and open-gate are stamp violet; pending is `--ink-3`.

### The Zone Grid
A drawn SVG lattice at 46px cells with a 26px margin. Each cell carries a low-opacity band wash (0.055 to 0.275, scaled by value), a 1px `--rule` hairline, and — the actual encoding — a hard band-coloured rule along its foot, 1px below a value of 40 and 2.4px above it. Zone id sits top-left at 8px mono in `--ink-3`; the value sits top-right at 13px mono. Drone coverage draws as a plum seam along the top edge, dashed while partial and solid at full. Flood extent is a separate hatch fill in survey blue.

### Notices and States
- **Note:** a marginal note — a 1px left rule in the tone colour, a 12px drawn icon in the tone, and `--ink-2` body text. Never a coloured slab.
- **Empty:** a 22px icon in `--ink-3`, a narrow-caps title, and one line of 46ch guidance, centred.
- **Working:** a violet hairline drawing itself left to right over 520ms (`rule-draw`) beside a narrow-caps label. No spinner exists in this system.

## Do's and Don'ts

### Do:
- **Do** carry every severity signal in an edge — a chip border, a 2px inset, a `.band-edge`, a 3px underline under a numeral, or a cell foot rule — and keep the text `--ink`.
- **Do** set every figure in Azeret Mono with tabular lining numerals, including figures drawn inside SVG.
- **Do** define any new token three times: `:root`, the `prefers-color-scheme: dark` block, and `[data-theme='dark']`. Both grounds are production.
- **Do** separate blocks with a 1px hairline (`--rule`; `--rule-soft` within a block; `--rule-strong` to close a register or masthead).
- **Do** put an interactive boundary on `--control-edge`, not `--rule-strong`, so it clears the 3:1 non-text floor without coarsening the ruled field.
- **Do** label any simulated or model-produced figure with a plum provenance mark; an accurate scope holds up better under questioning than an implied claim.
- **Do** animate proportion with `scaleX` and a 260ms `cubic-bezier(0.16, 1, 0.3, 1)`, never with `width`.
- **Do** give every `.pulse`, `.chase`, `.rule-draw` and stamp landing a `prefers-reduced-motion` off-switch.
- **Do** keep drawn marks on the icon grammar: 16-unit grid, 1.25 stroke, square caps, mitred joins.

### Don't:
- **Don't** introduce a border radius. Not on buttons, chips, inputs, slider thumbs, bars or data terminals. The one exception already in the system is the 1px focus-outline radius.
- **Don't** build a card. If a block needs separation, rule it; if it genuinely floats, use `.sheet-raised` with `--shadow-1`.
- **Don't** set text in `--ink-4`, and don't set any text on the jacket below `--ink-3`.
- **Don't** put `--sim` where `--stamp` belongs, or the reverse. Simulated and signed are different claims about the same figure.
- **Don't** fold `--water` into the severity ramp; flood extent and severity are separate encodings.
- **Don't** put an eyebrow, kicker or category label above a page heading. `PageHead` starts at the title.
- **Don't** use a spinner, a toast, a pill, a rounded progress bar or a glyph-font icon; each has a drawn equivalent in this system.
- **Don't** let the phase rail wrap. It scales and scrolls.
- **Don't** add a second ambient shadow. `--shadow-1` and `--stamp-shadow` are the whole vocabulary.
