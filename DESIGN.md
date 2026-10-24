---
name: My Practice App
description: A summit climb on a screen. Cream paper, a green hill for Chinese and a lilac one for Math, heavy ink outlines, pill buttons, ballpoint-blue for what can be pressed and red-ink marking.
colors:
  paper: "#f2f7ef"
  card: "#fcfef9"
  ink: "#16213d"
  ink-soft: "#49566f"
  rule: "#c5dccb"
  rule-strong: "#5e9871"
  cover: "#1e5a3c"
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
  sm: "4px"
  md: "10px"
  lg: "14px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    height: "96px"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.accent}"
    rounded: "{rounded.lg}"
    height: "64px"
  button-good:
    backgroundColor: "{colors.good}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    height: "96px"
  button-bad:
    backgroundColor: "{colors.bad}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    height: "96px"
  lesson-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  cover-band:
    backgroundColor: "{colors.cover}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "12px 12px 12px 20px"
---

# Design System: My Practice App

## Overview

A summit climb on a tablet: a trail map of the term's practice. Cream paper, a bright green hill band (lilac for Math), heavy blue-black outlines, and a teacher's red pen. The child practises on 田字格 squares, the same squares used on paper. The grown-ups area is the back pages of the same book: plainer and denser, with the same type and palette.

This is an Operate-mode world: it lends type, palette, density and one signature move (the 田字格 square). Navigation and controls stay standard. Buttons look like buttons.

## Colors

- **Paper** `#f5f1e4` is the page; **Card** `#fffdf6` is a sheet on it. **Rule** `#ddd6bf` is the ruled lines; **Rule strong** `#2c2e2a` is the 3px outline on cards and buttons. The 田字格 strokes keep their own green.
- **Cover** `#8ed462` is the green hill band on Home, practice screens and the parent bar; **Lilac** `#ebc1ff` is Math's hill; **Gold** `#f5e211` is a finished stop, the count pill and the subject tag. Ink text on all of them.
- **Accent** `#1d44c4` (ballpoint blue) means pressable. Nothing that cannot be pressed is blue, except the progress fill and a trick's strategy line.
- **Bad** `#c42b22` is red ink and appears only for marking: ❌ Not yet, the round-number circle, the 优 seal, the update dot, and the parent gate error.
- **Good** `#167a42` is for ✅ and Next.
- True/False pad uses teal `#00697a` and orange `#b85700`, deliberately distinct from accent, good and bad, with white text at 4.5:1 or better.
- Highlighter yellow `#ffef9f` is used once, for the "turn up the volume" hint.

## Typography

Atkinson Hyperlegible Next (self-hosted, no third-party requests) for everything Latin. Practice Kai for the target character and the 优 seal. Headings are weight 800, body 400 to 700. Numbers are tabular. No kickers above headings.

## Layout

Single column, max width 960px, 16px page padding. Lesson cards use an auto-fit grid (min 280px). Practice screens are a stage (the target) above or beside a control stack. Touch targets are at least 64px and primary actions at least 96px; these are enforced by e2e tests.

## Elevation & Depth

Flat. No shadows. Depth comes from 2px ruled borders and the paper/card tint difference.

## Shapes

Radius 28px for cards and bands; pills (999px) for buttons, tags and the gear; 10px for rows and inputs in the parent area; 4px for the ❌ button so it differs from ✅ by shape as well as colour. The 优 seal and round badge are circles.

## Components

- **Cover band**: green, the learner's name, and the gear as a cream pill with an ink outline.
- **Lesson card**: a worksheet: bold title on a ruled underline, a small subject tag, one blue button per practice type.
- **Keep going**: a lesson card's button for a practice type in progress, with the small trail (no ticks) and a 🔄 button beside it.
- **Summit rail** (`StarBar`): one stop per item on a dotted trail, up to 12. Done stops are gold with a ✓, the current one is ringed and numbered. Across the top on narrow screens; up the left, winding to a 🚩, where the screen is at least 640×600.
- **田字格 stage**: a square cell with a dashed cross (`--tian` token). One cell per character in Write; the drawing canvas in Draw.
- **优 seal**: red double-ring stamp on completion; its press animation runs only when reduced motion is not requested.
- **Parent rows**: ruled rows with a › at the end, below a slim green bar.

## Do's and Don'ts

- Do keep blue for things that can be pressed and red for marking only.
- Do keep ✅ and ❌ different in shape as well as colour.
- Do keep the emoji labels (⚡ 🔍 ⚖️ 📖 🧠); PRODUCT.md makes them a brand commitment.
- Don't add shadows, gradients on text, nested cards, or a kicker above a heading.
- Don't load fonts or assets from another origin.
- Don't animate under reduced motion, apart from the `completion-fade` glow.
