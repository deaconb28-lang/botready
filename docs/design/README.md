# Handoff: BotReady — marketing site, account, and app

## Overview

BotReady is an AEO (answer engine optimization) tool for solo founders. It requests a customer's page as five different clients — Chrome plus four declared AI agents — compares what each one got back, scores the result, and generates the files that fix the gaps.

Three surfaces are covered here:

| File | Surface |
| --- | --- |
| `BotReady v3.dc.html` | Public marketing site: landing page, results page, "What we check", pricing, crawler docs, public index, dashboard preview |
| `BotReady Account.dc.html` | Sign-in screen and the signed-in account area: domains, plan & billing, settings |
| `BotReady App.dc.html` | The product itself: sidebar shell with eight views around one scanned property |

## About the design files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. Each is a single self-contained page written against a small internal template runtime (`<x-dc>`, `{{ }}` holes, `<sc-for>`, `<sc-if>`); that runtime is a prototyping tool and is **not** part of the handoff.

The task is to **recreate these designs in the target codebase's existing environment** — React, Next.js, Vue, whatever is in place — using its established routing, component, and styling patterns. If no environment exists yet, pick the framework that fits the product (a React/Next.js app is the natural fit for a marketing site plus an authenticated dashboard) and implement there.

Read the HTML for exact values. Every style in these files is inline, so the styling of any element can be read directly off that element.

## Fidelity

**High-fidelity.** Colors, typography, spacing, borders, shadows, copy, and interaction states are final. Recreate them pixel-for-pixel using the codebase's own component primitives. Where these files repeat literal values inline, the production version should lift them into the design tokens listed below.

---

## Design tokens

### Color

| Token | Hex | Use |
| --- | --- | --- |
| `canvas` | `#EDEBFB` | Page background (lavender) |
| `surface` | `#FFFFFF` | Cards, panels, inputs |
| `surface-alt` | `#F6F5FE` | Inset fields, muted panels |
| `ink` | `#111318` | Text, every border, every hard shadow |
| `body` | `#3F4450` | Body copy on light surfaces |
| `muted` | `#5A646F` | Secondary copy |
| `subtle` | `#8B90A0` | Mono labels, metadata |
| `violet` | `#4B44F5` | Primary brand, links, feature panels |
| `violet-tint` | `#EFEEFE` | Violet chip backgrounds |
| `lime` | `#C6F53C` | Active nav, pass states, primary CTA on dark |
| `lime-tint` | `#F6FDE6` | Pass card tint |
| `coral` | `#FF6B5A` | Fail states, blocked agents, the C− grade |
| `coral-tint` | `#FFE3DE` | Fail card tint |
| `amber` | `#FFCF5C` | Warn states |
| `amber-tint` | `#FFF9EA` | Warn card tint |
| `green` | `#2E9B5E` | Post-fix "A" grade, healthy domain |
| `green-tint` | `#E9FBD2` | Healthy alert background |
| `teal` | `#7ED9C3` | Actionability category |
| `pink` | `#F2A0D8` | Freshness category |
| `rule` | `#EFEEFA` | Row dividers inside bordered cards |

Text on `coral`, `lime`, `amber`, `teal`, and `pink` is always `ink`. Text on `violet` and `green` is always white.

### Typography

Three families, from Google Fonts:

- **Familjen Grotesk** (500/600/700) — all headings, grades, big numbers. Always tight: `letter-spacing: -.02em` at card size, `-.035em` at page-title size.
- **Public Sans** (400/500/600/700) — body copy, buttons, labels.
- **JetBrains Mono** (400/500/700) — every eyebrow, status chip, metric, file name, terminal block, and metadata line. Eyebrows are uppercase with `letter-spacing: .12em`–`.14em` at 10.5–12px.

Scale in use:

| Role | Size / line-height | Family |
| --- | --- | --- |
| Hero h1 | `clamp(46px, 7vw, 86px)` / 1.02 | Familjen 700 |
| Page h1 | 36–38px / 1.02 | Familjen 700 |
| Section h2 | `clamp(30px, 4vw, 46px)` / 1.06 | Familjen 700 |
| Card h3 | 17–19px / 1.2 | Familjen 700 |
| Body | 15–16.5px / 1.55–1.65 | Public Sans 400 |
| Small body | 14–14.5px / 1.5 | Public Sans 400 |
| Mono label | 10.5–12px, `.12em` tracking | JetBrains 500/700 |
| Mono data | 12.5–13.5px | JetBrains 400/500 |

### Shape, border, elevation

This is a hard-edged "neo-brutalist" system. There are no soft shadows anywhere.

- Every card, chip, button, input, and toggle carries `border: 2px solid #111318`.
- Elevation is a **hard offset shadow, no blur**: `box-shadow: Npx Npx 0 #111318`. `3px` for small cards, `4px` for standard cards, `5–7px` for hero panels. Two panels shift the shadow color for emphasis: the dark "check" panel uses `7px 7px 0 #4B44F5`, the dark weights chart uses `5px 5px 0 #4B44F5`, and the Editor's code viewer uses `4px 4px 0 #4B44F5`.
- Radii: `9–12px` chips and buttons, `14–16px` cards, `18–20px` large panels, `99px` pills.
- Hover on a lifted card: `transform: translate(-2px,-2px)` with the shadow growing 2px, `transition: all .18s`.
- Primary button hover swaps background to `violet` (on light) or `#FFFFFF` (on dark/lime).

### Spacing

Base scale 4px. Common: card padding 18–22px, panel padding 26–44px, section vertical rhythm 76–80px, grid gaps 16–20px, page gutters 24–28px.

### Motion

| Name | Definition | Use |
| --- | --- | --- |
| `riseIn` | `opacity 0→1`, `translateY(8–10px)→0`, `.3–.5s ease both` | Disclosure panels, check pips (staggered 60–80ms) |
| `blink` | `opacity .35→1→.35`, `1.05–1.8s step-end infinite` | Text cursors, "not retrieved" label |
| `dashFlow` | `background-position → 22px 0`, `.7–.8s linear infinite` | Dashed request connectors |
| `marquee` | `translateX(0 → -50%)`, `26s linear infinite` | Scrolling user-agent list |
| bar/width transitions | `.6–.8s ease` | Score bars, category bars |

All animation is wrapped in `@media (prefers-reduced-motion: reduce)` which sets `animation-duration: .001ms` and `animation-iteration-count: 1`. Keep that.

---

## Domain model

The whole product is one object graph. Suggested shape:

```ts
type Client = "chrome" | "claudebot" | "gptbot" | "perplexity" | "google-ext";

interface ClientResult {
  client: Client;
  status: number;            // 200, 403, 429…
  readableChars: number;
  note: string;              // "cf-mitigated: challenge", "body is client-side", "412 KB · 89 ms"
  tone: "ok" | "warn" | "bad";
}

interface CategoryScore {
  key: "retrievability" | "discovery" | "representation" | "structure" | "actionability" | "freshness";
  weightPct: number;         // 25, 20, 20, 15, 15, 5
  checks: number;            // 4, 4, 4, 3, 4, 2
  points: number;            // 35, 21, 20, 15, 15, 5
  earnedPct: number;
}

interface Finding {
  checkKey: string;          // agent_status_parity, js_dependency_ratio, …
  plainTitle: string;        // shown in Plain English mode
  techTitle: string;         // shown in Technical mode
  plainBody: string;
  techBody: string;
  points: number;
  fixLabel: string;          // "one WAF rule"
  rawDetail: string;         // request/response text shown under "Show details"
  severity: "fail" | "warn";
}

interface Scan {
  id: string;                // "run 04"
  domain: string;
  score: number;             // 0–100
  grade: string;             // "C−"
  previousScore?: number;
  ranAt: string;
  clients: ClientResult[];
  categories: CategoryScore[];
  findings: Finding[];
  generatedFiles: GeneratedFile[];  // llms.txt, robots.txt, waf-rule.txt, pricing.jsonld
  agentPrompt: string;       // the coding-agent prompt sold with the fix pack
}
```

Scoring: a category's score is the share of its available points earned. Pass earns all, warn earns half, fail earns none, a skipped check leaves the denominator rather than counting as zero. Total is 21 checks / 111 points across six categories, at scoring version 1.2. Every stored score should record the scoring version that produced it, so a re-weighting re-scores history instead of quietly rewriting it.

---

## `BotReady v3.dc.html` — marketing site

Seven views behind one client-side `page` state: `home`, `results`, `check`, `pricing`, `crawler`, `index`, `dash`. In production these should be **real routes** (`/`, `/r/:domain`, `/what-we-check`, `/pricing`, `/bot`, `/index/:category`, `/app`) — the prototype only uses state because it is a single file.

### Global: the Plain ⇄ Technical toggle

The header carries a two-state language switch. It swaps roughly forty strings across every page: hero copy, section headings, all finding titles and bodies, the example chat answer, result summaries, and the index lede. It is **not** a translation layer — the two registers say different things to different readers (a solo founder vs. an engineer).

Implement as a single `mode: "plain" | "tech"` in app state (persist to `localStorage`), with copy stored as two parallel dictionaries. Do not machine-derive one from the other.

### Header

Sticky, `rgba(247,247,244,.88)` blur background over the canvas, 2px bottom rule. Left: 28px violet rounded-square mark with a lime `b` in mono, then "BotReady" in Familjen 700 19px. Center nav (Public Sans 500 14.5px, `#5A646F`): Why AEO, What we check, Pricing, Index, Crawler. Right: the mode toggle, "Log in", and a black "Run a check" button.

"Why AEO" scrolls to `#aeo` on the home page rather than navigating (smooth scroll, 80px offset for the sticky header).

### Home

1. **Hero** — centered, max 1000px. A white "NEW" pill announcing the mode-dependent badge line; the h1 "Are you BotReady?"; the mode-dependent subhead (max 50ch). Then the **scan card**: white, 2px border, `5px 5px 0` shadow, holding three tabs (URL / Sitemap / Domain — each changes the input prefix and placeholder), a mono input with a **blinking 2px caret shown only while the field is empty**, and a lime-shadowed "Run the check" button. Under it: `free · no account · ~30 seconds` and a "see an example result" link.
2. **Chat proof** — a realistic assistant transcript: user bubble (right-aligned, `#EEF1F6`, radius `16px 16px 4px 16px`), assistant bubble (left, fixed `width: 88%`, `min-height: 96px` so it holds shape while typing). The answer types in at ~16ms/char. A verdict chip below reads "Yoursite: not mentioned" (coral) and a button flips to the fixed state, which re-types an answer citing the customer first and turns the chip lime. Beside it: "THE PROBLEM [01]" and three bullets.
3. **Five-agent race** — violet panel, `6px 6px 0` shadow. A lime "GET / ×5" node, an animated dashed connector, and five agent rows that arrive one at a time on a 620ms interval (looping 0→7 so the set rests fully-arrived before restarting). Unarrived rows sit at `translateX(-8px)`, `opacity .5`, status `···`. Below, a marquee of twelve real crawler user-agent strings.
4. **Browser vs agent [02]** — a browser-chrome card rendering a plausible product page (200 OK, 9,240 readable characters) beside a black terminal card showing the ClaudeBot 403 with `cf-mitigated: challenge` and `(nothing readable)`. **Note:** the blank line before "(nothing readable)" must be part of a text node that also contains visible text — a whitespace-only node gets collapsed and the response reads as one broken line.
5. **Why AEO matters [03]** (`id="aeo"`) — three cards: the shortlist forming without you (competitor chips in lime, yours struck through in dashed coral with a blinking "not retrieved"), the 403 stamp (rotated `-7deg` on coral), and the four generated file chips staggering in on violet.
6. **The check [04]** — black panel with `7px 7px 0` violet shadow: three white step cards with lime hard shadows and lime numbered chips, then four lime stat figures (5 clients, 21 checks, 30s, 0 code).
7. **Closing CTA** — white panel, "So — are you BotReady?".

### Results

Report header: score counting up during the scan, `/ 100`, a coral "Grade C+" chip, the mode-dependent summary, and a "Get the fix pack — $17" button. Six category cells with colored bars follow (`<50%` coral, `<75%` ink, else green). Below: findings ordered by effort, each with a severity dot, points, a violet fix chip, and a "Show details" disclosure revealing the raw request/response. A sticky side panel lists what each of the five clients got.

The scan animation runs 1500ms with a cubic ease-out on `requestAnimationFrame` — **plus a `setTimeout(dur + 250)` that unconditionally writes the final score and `done` state**, because rAF is paused in a hidden tab and the score would otherwise stick at 0 forever.

### What we check

Published weights, rendered as graphics rather than a table:

- A black bar chart (`5px 5px 0` violet shadow) of the six weights, each bar in its category color with a lime border, heights normalized against the 25% maximum.
- One tinted card per category: a big weight chip in the category color, name, description, one outlined pip per check (staggered `riseIn`), and checks/points on the baseline.
- A lime "Everything adds up" strip: 100% / 21 checks / 111 points.

Then the five clients with their exact user-agent strings (Chrome is the control), and the individual checks with their `snake_case` keys and failure thresholds.

### Pricing

Three tiers: **Free** (the check), **$17 one time** (the fix pack, dark card), **$7/month** (monitoring). The fix-pack card carries the highlighted callout that closes the sale — lime block, 2px border, `5px 5px 0` violet shadow, a black "Get BotReady now!" tag, and a mini terminal line `$ claude "apply botready-fixes.md"` with a blinking cursor. The offer: *a full prompt for your coding agent. Paste it into Claude Code or Cursor and your site fixes itself.*

Below the tiers, a violet closing banner: a "30 SECONDS FROM NOW" badge, "Get BotReady now", a coral **C−** tile connected by an animated dashed line to a green **A** tile, the four file chips, the terminal line, and both CTAs. Then the short "Why the score is free" explanation.

### Crawler, Index, Dashboard

Crawler is a documentation page kept close to the original wording — how to block us (two robots.txt lines), what we request (six numbered steps), what we do not do, and a contact address. Index is a ranked table of scanned domains. Dashboard previews the monitoring view.

---

## `BotReady Account.dc.html` — auth + account

### Sign-in

Split screen, both halves full height. Left (max 400px): mark and wordmark, "Welcome back", a "Continue with Google" button (2px border, `4px 4px 0` shadow, hover lime) whose Google mark is a 20px conic-gradient disc in the four brand colors, an "or" divider, and a magic-link email field — no password anywhere. Right: violet panel, 2px left border, holding a "WHAT IS WAITING INSIDE" badge, three white benefit cards (score history / alerts / fix pack), and a black terminal line `$ botready watch shiplog.dev` with a blinking cursor.

Any sign-in control enters the app. Production needs real Google OAuth plus a magic-link email flow.

### Signed in

Header: wordmark, three lime-when-active pills (Domains, Plan & billing, Settings), the signed-in email, and a Sign out button that hovers coral.

- **Domains** — a card per domain: name, last-checked, a grade tile (coral for failing, green for healthy), all five client statuses as chips, and the current alert in a tinted bordered block. A dashed "One slot left" card fills the empty slot. Recent alerts list below.
- **Plan & billing** — violet current-plan card at **$7/month** with "Manage billing" and "Cancel plan"; a usage panel with three bordered progress bars (domains 2 of 3, scans 9 of 30, fix packs 4); renewal date and card ending. Invoices below, including a **$17.00** fix pack line.
- **Settings** — four rows with 56×32px pill toggles (lime when on, 24px white knob, `.2s` transition): weekly re-scan, alert on any drop, monthly digest, show my score in the public index.

---

## `BotReady App.dc.html` — the product

Fixed 272px white sidebar with a 2px right border, against the lavender canvas.

**Header** — mark and wordmark; three surface pills (App / Landing page / Mobile); "signed in · shiplog.dev". *Known gap: only the App pill is wired. Either implement the other two views or remove them.*

**Sidebar** — a PROPERTY card (domain, coral grade chip, `57/100 · run 04`); a DIAGNOSE group (Overview, All issues, Page detail, Competitors); a FIX & WATCH group (Editor, Prompt watch, Settings, New scan); and a violet promo card pinned to the bottom: "Two file drops get you to an A" / "Get the pack — $17". Active nav rows are lime with a `2px 2px 0` shadow; each row carries a right-aligned mono meta value.

**Views**

1. **Overview** — headline "Chrome gets the tour. The bots get bounced.", the scan summary, and a "Re-run scan" button that shows "Scanning…" for 1800ms while the grade card reads "re-reading as 5 agents…". Below: a coral grade card (88px `C−` over a mono metadata block), the five-agent request panel with its animated dashed connector, six metric cards (llms.txt renders **solid coral** because it is a 404, the rest white with a colored bar), and a violet banner selling the pack.
2. **All issues** — six findings, each with a severity dot, points, a lime fix chip, and a "Show details" disclosure holding the raw request/response.
3. **Page detail** — `/pricing` raw response (coral header) beside the rendered result (lime header): 118 readable characters against 4,910. Four verdict rows below.
4. **Competitors** — four domains ranked by score, agents OK, and prompts cited. The customer sits last with `0 of 12 prompts`.
5. **Editor** — file list beside a black code viewer with a violet hard shadow. Four generated files: `llms.txt`, `robots.txt`, `waf-rule.txt`, `pricing.jsonld`. An "A after these" chip sits by the title.
6. **Prompt watch** — the tracked prompts with cited / not cited chips.
7. **Settings** — the same four toggles as the account area.
8. **New scan** — a single URL field with a lime submit.

---

## Interaction inventory

| Behavior | Detail |
| --- | --- |
| Language toggle | Swaps ~40 strings; re-triggers the chat typing animation |
| Chat typing | 16ms per character; restarts on mode change and on the fix flip |
| Agent race | 620ms per row, loops 0→7 |
| Scan | 1500–1800ms; rAF ease-out **with a timeout fallback that writes the final state** |
| Disclosures | One open at a time (`openFinding` index, `-1` for none) |
| Nav | Resets scroll to top; "Why AEO" smooth-scrolls with an 80px offset |
| Hover | Cards lift 2px with the shadow growing; buttons swap fill |
| Toggles | Justify-content flip, `.2s` background transition |

## Responsive behavior

Every multi-column grid uses `repeat(auto-fit, minmax(Npx, 1fr))` — 220px for category cells, 280–300px for card rows, 320–340px for two-up panels — so columns collapse without media queries. Buttons, nav items, chips, and status pills are all `white-space: nowrap`; several defects in review came from labels wrapping mid-word. The app's 272px sidebar does not yet collapse — production needs a drawer under ~900px.

## Accessibility

- Every interactive element is a real `<button>`; keep that and add visible focus rings (the prototype relies on the browser default).
- Contrast is safe on the palette as documented; do not put white text on lime, amber, coral, teal, or pink.
- The reduced-motion block is required, not optional — the marquee, the race, and the blinking cursors are all continuous.
- Score and status must not be conveyed by color alone: every chip carries its status code or word as text.

## Assets

None. There are no images, icons, or SVG illustrations in any file — every graphic (the browser chrome, terminal cards, grade tiles, bar charts, check pips, the Google mark, the 403 stamp) is built from bordered divs and CSS gradients. Fonts come from Google Fonts: Familjen Grotesk, Public Sans, JetBrains Mono.

Bullet markers in pricing lists use inline SVG data URIs; replace them with a list component in production.

## Content notes

All domains, scores, competitor names, invoices, and prompt results are **placeholder data**. `shiplog.dev` and `yoursite.com` are fictional. The crawler documentation copy is close to BotReady's real published wording and should be treated as content to carry over rather than rewrite.

The footer credit reads "designed with love by Deacon Brantley @ itsdeacon.com".

## Files in this bundle

- `BotReady v3.dc.html` — marketing site, seven views
- `BotReady Account.dc.html` — sign-in and account, three views
- `BotReady App.dc.html` — product shell, eight views
- `screenshots/` — reference captures of each surface

### Screenshot index

| File | Shows |
| --- | --- |
| `01-site.png` | Home: hero and scan card |
| `02-site.png` | Home: chat proof and five-agent race |
| `03-site.png` | Home: browser vs agent, why AEO |
| `04-site.png` | What we check: weights chart and category cards |
| `05-site.png` | Pricing: three tiers with the fix-pack callout |
| `06-site.png` | Pricing: closing banner, C− → A |
| `07-site.png` | Results: report header, categories, findings |
| `08-site.png` | Public index |
| `01-account.png` | Sign-in split screen |
| `02-account.png` | Account: domains |
| `03-account.png` | Account: plan and billing |
| `04-account.png` | Account: settings |
| `01-app.png` | App: overview |
| `02-app.png` | App: all issues |
| `03-app.png` | App: page detail |
| `04-app.png` | App: competitors |
| `05-app.png` | App: editor |
| `06-app.png` | App: prompt watch |

Screenshots are captured at the prototype's default width; they are a visual reference, not a measurement source. Read exact values off the HTML.
