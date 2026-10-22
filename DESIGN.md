---
name: My Practice App
description: A Grade 1 school exercise book on a screen. Green cover, ruled paper, ballpoint-blue buttons and red-ink marking.
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

A Chinese school workbook (练习册) on a tablet. Pale green ruled paper, a dark green cover band, blue-black ink, and a teacher's red pen. The child practises on 田字格 squares, the same squares used on paper. The grown-ups area is the back pages of the same book: plainer and denser, with the same type and palette.

This is an Operate-mode world: it lends type, palette, density and one signature move (the 田字格 square). Navigation and controls stay standard. Buttons look like buttons.

## Colors

- **Paper** `#f2f7ef` is the page; **Card** `#fcfef9` is a sheet on it. **Rule** `#c5dccb` and **Rule strong** `#5e9871` are the ruled lines, borders and 田字格 strokes.
- **Cover** `#1e5a3c` is the green band on Home and the slim bar in the parent area. White text only.
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

Radius 14px for cards, buttons and bands; 10px for rows and inputs in the parent area; 4px for the ❌ button so it differs from ✅ by shape as well as colour. The 优 seal and round badge are circles.

## Components

- **Cover band**: green, the learner's name on a label, and the gear as a translucent square with a white outline.
- **Lesson card**: a worksheet: bold title on a ruled underline, a small subject tag, one blue button per practice type.
- **Keep going**: blue card with a ruler progress bar (a tick every 10%) filled in white.
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
