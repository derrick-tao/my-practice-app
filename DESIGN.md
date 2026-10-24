---
name: My Practice App
description: A summit climb on a screen. Cream paper, a green hill for Chinese and a lilac one for Math, heavy ink outlines, pill buttons, ballpoint-blue for what can be pressed and red-ink marking.
colors:
  paper: "#f5f1e4"
  card: "#fffdf6"
  ink: "#16213d"
  ink-soft: "#49566f"
  rule: "#ddd6bf"
  rule-strong: "#2c2e2a"
  cover: "#8ed462"
  lilac: "#ebc1ff"
  gold: "#f5e211"
  flag: "#ff705d"
  accent: "#1d44c4"
  accent-soft: "#e3eafb"
  good: "#167a42"
  bad: "#c42b22"
  true-teal: "#00697a"
  false-orange: "#b85700"
  highlighter: "#ffef9f"
typography:
  display:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, PingFang SC, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.15
  body:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, PingFang SC, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 400
    lineHeight: 1.4
  character:
    fontFamily: "Practice Kai, Kaiti SC, STKaiti, KaiTi, PingFang SC, serif"
    fontSize: "40vmin"
    fontWeight: 400
    lineHeight: 1.15
rounded:
  md: "10px"
  pennant: "16px"
  key: "14px"
  card: "28px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    height: "96px"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    height: "64px"
  button-good:
    backgroundColor: "{colors.good}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    height: "96px"
  button-bad:
    backgroundColor: "{colors.flag}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pennant}"
    height: "96px"
  button-danger:
    backgroundColor: "{colors.card}"
    textColor: "{colors.bad}"
    rounded: "{rounded.pill}"
    height: "64px"
  numpad-key:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.key}"
    height: "72px"
  lesson-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  cover-band:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 12px 12px 20px"
---

# Design System: My Practice App

## Overview

A summit climb on a tablet: a trail map of the term's practice. Cream paper, a bright green hill band (lilac for Math), heavy blue-black outlines, and a teacher's red pen. The child practises on 田字格 squares, the same squares used on paper. The grown-ups area is the back pages of the same book: plainer and denser, with the same type and palette.

This is an Operate-mode world: it lends type, palette, density and one signature move (the 田字格 square). Navigation and controls stay standard. Buttons look like buttons.

## Colors

- **Paper** `#f5f1e4` is the page; **Card** `#fffdf6` is a sheet on it. **Rule** `#ddd6bf` is the ruled lines. **Ink** `#16213d` is text and every 3px outline (cards, buttons, stops, hills). **Rule strong** `#2c2e2a` is only the 2px borders and scrollbar in the parent area. The 田字格 strokes keep their own green.
- **Cover** `#8ed462` is the green hill band on Home, practice screens and the parent bar, and Chinese's hill; **Lilac** `#ebc1ff` is Math's hill (not blue: blue means pressable); **Gold** `#f5e211` is a finished stop, the count pill and the subject tag. Ink text on all of them.
- **Flag** `#ff705d` (coral) is the finished-page lobe, the hill flags, stopped attempts and the ❌ Not yet pennant.
- **Accent** `#1d44c4` (ballpoint blue) means pressable. Nothing that cannot be pressed is blue, except a trick's strategy line. Pressed states darken each fill (`--accent-press`, `--good-press`, `--flag-press`).
- **Bad** `#c42b22` is red ink: marking (the round-number circle, the 优 seal, the update dot, the parent gate error) and destructive actions, which are an outlined red-on-card pill (Erase, Delete, Retry, the confirm's No). The ❌ Not yet button is marking and uses coral, not red.
- **Good** `#167a42` is for ✅ and Next.
- True/False pad uses teal `#00697a` and orange `#b85700`, deliberately distinct from accent, good and bad, with white text at 4.5:1 or better.
- Highlighter yellow `#ffef9f` is used once, for the "turn up the volume" hint.

## Typography

Atkinson Hyperlegible Next (self-hosted, no third-party requests) for everything Latin. Practice Kai for the target character and the 优 seal. Headings are weight 800, body 400 to 700. Numbers are tabular. No kickers above headings.

## Layout

Single column, max width 960px, 16px page padding. Lesson cards use an auto-fit grid (min 280px). Practice screens are a stage (the target) above or beside a control stack. Touch targets are at least 64px and primary actions at least 96px; these are enforced by e2e tests.

## Elevation & Depth

Flat. No shadows. Depth comes from 3px ink outlines and the paper/card tint difference (2px ruled borders in the parent area).

## Shapes

Radius 28px for cards and bands; pills (999px) for buttons, tags and the gear; 14px for number-pad keys; 10px for rows and inputs in the parent area; the ❌ Not yet button is a pennant (squared left end, 16px, pill right end) in coral with an ink outline, so it differs from the green ✅ pill by shape and icon as well as colour. The 优 seal and round badge are circles.

## Components

- **Cover band**: green with ink text, the learner's name, and the gear as a card-coloured pill with an ink outline.
- **Lesson card**: a worksheet topped by a hill (green for Chinese, lilac for Math, from `data-subject`) with a dotted trail of open controls up to a coral flag (it shows no progress); then a bold title on a ruled underline, a small subject tag, one blue button per practice type.
- **Keep going**: a lesson card's button for a practice type in progress, with the small trail of this round's real progress, fitted beside the 🔄 button and the count (the stops shrink on a narrow screen).
- **Summit rail** (`StarBar`): one stop per item on a dotted trail, up to 12 (a longer list shares the stops out, and any progress ticks at least the first). Done stops are gold with a ✓, the current one is ringed and shows its item number. Stops shrink to fit a narrow track. Across the top on narrow screens; up the left, on the dotted line, to a 🚩, where the screen is at least 640×600.
- **田字格 stage**: a square cell with a dashed cross (`--tian` token). One cell per character in Write; the drawing canvas in Draw.
- **Finished page**: a coral lobe behind the screen, a dotted course of ticked gold controls ending in the 优 seal as the finish ring (course hidden on short screens).
- **Number pad**: rounded keys (14px) with a 3px ink outline; the Check key is filled with the accent.
- **优 seal**: red double-ring stamp on completion, ringed in ink, smaller on short screens; its press animation runs only when reduced motion is not requested.
- **Attempt trail** (parent Progress): one stop per attempt, oldest first, gold with a tick when finished, coral when stopped; attempt status is a gold or coral pill.
- **Parent rows**: ruled rows with a › at the end, below a slim green bar.

## Do's and Don'ts

- Do keep blue for things that can be pressed, coral for the ❌ marking button, and red ink for marking marks and destructive actions only.
- Do keep ✅ and ❌ different in shape as well as colour.
- Do keep the emoji labels (⚡ 🔍 ⚖️ 📖 🧠); PRODUCT.md makes them a brand commitment.
- Don't add shadows, gradients on text, nested cards, or a kicker above a heading.
- Don't load fonts or assets from another origin.
- Don't animate under reduced motion, apart from the `completion-fade` glow.
