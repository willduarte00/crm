---
name: Kinetic Enterprise
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#191c1e'
  on-tertiary-container: '#818486'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  data-tabular:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  gutter: 24px
  margin-safe: 32px
  max-width: 1440px
---

## Brand & Style
The design system is engineered for high-velocity marketing agencies that require precision and reliability. The brand personality is **Professional, Efficient, and Systematic**. It avoids unnecessary ornamentation in favor of a **Corporate Modern** aesthetic that balances the density of CRM data with the clarity of a premium SaaS product.

The visual style leverages a "Utility-First" philosophy:
- **Minimalism:** Use generous whitespace to prevent data fatigue in complex views like Kanban boards and tables.
- **Precision:** Every element is aligned to a strict grid to evoke a sense of order and institutional trust.
- **Functionality:** UI patterns prioritize speed of thought and action, ensuring that administrative tasks feel frictionless.

## Colors
The palette is anchored by **Deep Navy (#0F172A)** to establish authority and professional grounding. **Vibrant Teal (#0D9488)** serves as the primary action color, providing a refreshing, modern contrast that signifies "active" states and progress.

- **Light Mode (Default):** Uses a tiered grayscale starting from pure white (#FFFFFF) for surfaces, with Slate-50 (#F8FAFC) for background fills to define layout boundaries.
- **Dark Mode:** Transitions to a "Deep Midnight" scheme. The primary surface moves to Slate-950, with borders in Slate-800 to maintain crispness without excessive contrast.
- **Accents:** Use Teal for primary buttons, active navigation states, and success indicators in the Kanban board.

## Typography
This design system utilizes **Inter** exclusively to ensure maximum legibility across dense data environments. The typeface is optimized for screen performance and provides a neutral, systematic tone.

- **Scale:** Use a tight typographic scale to keep information density high without sacrificing hierarchy.
- **Numeric Data:** For tables and dashboards, utilize `font-variant-numeric: tabular-nums` to ensure columns of numbers align perfectly, aiding in quick financial and performance scanning.
- **Hierarchy:** Use bold weights (600-700) sparingly for section headers; secondary information should rely on color shifts (Slate-500) rather than just size reductions.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid Grid**. On desktop, the sidebar is fixed at 260px, while the main content area utilizes a 12-column fluid grid with a maximum container width of 1440px to prevent excessive line lengths on ultra-wide monitors.

- **Rhythm:** An 8px linear scale (with a 4px step for tight UI) governs all padding and margins.
- **Dashboards:** Use a 24px (lg) gutter between widgets to provide clear separation of distinct data sets.
- **Tables:** Use a compact vertical spacing (8px to 12px) for row heights to maximize the number of records visible above the fold.
- **Breakpoints:** 
    - Desktop: 1280px+ (12 columns)
    - Tablet: 768px - 1279px (8 columns, sidebar collapses to icons)
    - Mobile: <767px (4 columns, stacked cards, hidden sidebar)

## Elevation & Depth
To maintain a clean and modern feel, this design system avoids heavy shadows, opting for **Tonal Layering** and **Low-Contrast Outlines**.

- **Level 0 (Background):** Slate-50. Used for the main app background.
- **Level 1 (Cards/Surface):** Pure White. Used for the primary content containers, Kanban cards, and data table rows. These feature a 1px border (#E2E8F0).
- **Level 2 (Dropdowns/Modals):** Pure White with a "Soft Ambient" shadow: `0px 10px 15px -3px rgba(0, 0, 0, 0.1)`. This provides focus without breaking the flat aesthetic.
- **Kanban Interaction:** When a card is dragged, it should transition to Level 2 elevation to provide a tactile sense of "lifting" off the board.

## Shapes
The shape language is **Soft and Disciplined**. It uses subtle rounding to feel modern and approachable while maintaining a "serious" professional structure.

- **Standard Elements (Buttons, Inputs):** 0.25rem (4px). This creates a crisp, architectural look.
- **Containers (Cards, Dashboards):** 0.5rem (8px). Large enough to feel distinct from the background but not overly playful.
- **Status Pills:** Fully rounded (100px) to distinguish them from interactive buttons.

## Components
- **Buttons:** Primary buttons use the Teal (#0D9488) fill with white text. Ghost buttons use the Deep Navy (#0F172A) for text/borders to denote secondary actions.
- **Data Tables:** Headers must stay sticky during scroll. Use a subtle Slate-50 hover state for rows to assist tracking across wide screens. Use Teal for links within the table (e.g., Client Names).
- **Kanban Board:** Columns are Slate-100 backgrounds with 8px rounded corners. Cards are white with a 1px border. Use color-coded vertical "stress bars" on the left edge of cards to indicate priority (Red for high, Teal for low).
- **Input Fields:** Use a 1px border (Slate-300). On focus, the border transitions to Teal with a soft 2px Teal outer glow (20% opacity).
- **Chips/Status:** Use low-saturation background tints of semantic colors (e.g., Light Emerald for "Paid", Light Amber for "Pending") with dark text of the same hue to ensure accessibility.
- **Dashboards:** Utilize "Value Tiles" for KPIs. Large bold numbers in Deep Navy with a small trend indicator (+/- %) in semantic success/error colors.