# Vendored fonts

Three static instances, checked in so that the share card does not depend on a
third-party fetch at request time. The card is the unit that travels, and a
missing card is a broken distribution model, so it renders from disk.

The full variable families are loaded through `next/font` for the site itself
(see `app/layout.tsx`); these files exist only for `next/og`, which needs a
static TTF or OTF and cannot read a variable axis. The two Google Fonts faces
were instantiated from their variable masters with `fontTools.varLib.instancer`.

| File | Family | Instance | Card role |
|---|---|---|---|
| `FamiljenGrotesk-Bold.ttf` | Familjen Grotesk | wght 700 | the grade, the score, the wordmark |
| `PublicSans-Regular.ttf` | Public Sans | wght 400 | the headline and the supporting line |
| `JetBrainsMono-Regular.ttf` | JetBrains Mono | wght 400 | the domain and the metadata |

All three are licensed under the SIL Open Font License 1.1, which permits
redistribution, modification and the creation of static instances alongside
this notice.

- Familjen Grotesk — Copyright (c) 2021 The Familjen Grotesk Project Authors. https://github.com/tapper/familjen-grotesk. SIL OFL 1.1.
- Public Sans — Copyright (c) 2015 Impallari Type; forked by the U.S. General Services Administration. https://github.com/uswds/public-sans. SIL OFL 1.1.
- JetBrains Mono — Copyright (c) JetBrains. https://github.com/JetBrains/JetBrainsMono. SIL OFL 1.1.

Full licence text: https://openfontlicense.org/open-font-license-official-text/
