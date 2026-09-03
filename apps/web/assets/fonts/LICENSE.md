# Vendored fonts

Two static instances, checked in so that the share card does not depend on a
third-party fetch at request time. The card is the unit that travels, and a
missing card is a broken distribution model, so it renders from disk.

The full variable families are loaded through `next/font` for the site itself
(see `app/layout.tsx`); these two files exist only for `next/og`, which needs
TTF or OTF and cannot read a variable axis.

| File | Family | Instance |
|---|---|---|
| `Archivo-ExtraBold.ttf` | Archivo | wght 800, wdth 100 |
| `JetBrainsMono-Regular.ttf` | JetBrains Mono | wght 400 |

Both are licensed under the SIL Open Font License 1.1, which permits
redistribution alongside this notice.

- Archivo — Copyright (c) Omnibus-Type. https://github.com/Omnibus-Type/Archivo
- JetBrains Mono — Copyright (c) JetBrains. https://github.com/JetBrains/JetBrainsMono

Full licence text: https://openfontlicense.org/open-font-license-official-text/
