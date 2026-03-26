# Design System Specification: High-End POS Editorial

## 1. Overview & Creative North Star
**Creative North Star: "The Obsidian Concierge"**
This design system rejects the cluttered, "calculator-style" aesthetic of legacy POS systems. Instead, it adopts an editorial, app-first philosophy inspired by high-end fintech and luxury digital workspaces. By utilizing deep tonal layering and aggressive whitespace, we transform a utility tool into a premium experience. 

The system moves beyond the "standard" grid by using **Intentional Asymmetry**. We prioritize high-value actions (like "Checkout" or "Add Tip") with oversized, pulse-animated elements, while secondary information retreats into the background through sophisticated tonal shifts rather than harsh borders.

---

## 2. Colors & Tonal Depth
We operate on a philosophy of "Luminous Depth." The palette relies on the interaction between deep indigo-blacks and metallic-silver accents.

### The Palette (Material Design Convention)
*   **Surface (Primary Background):** `#0c1324`
*   **Primary (Accents/Actions):** `#bec6e0` (A soft, metallic periwinkle)
*   **Surface Container High:** `#23293c` (For primary interactive cards)
*   **Tertiary Container:** `#050060` (Deep indigo for high-contrast "Pulse" effects)

### The "No-Line" Rule
**Strict Mandate:** 1px solid borders are prohibited for sectioning. 
Structure must be defined through background color shifts. To separate a sidebar from a main feed, transition from `surface` to `surface-container-low`. To separate items in a list, use a `3 (1rem)` spacing gap or a subtle shift from `surface-container` to `surface-container-high`.

### Signature Textures: The "Glass & Gradient" Rule
To elevate the UI above generic templates:
*   **Floating Modals:** Use `surface-container-highest` at 80% opacity with a `24px` backdrop-blur.
*   **CTAs:** Apply a linear gradient from `primary` to `primary-fixed-dim` at a 135° angle. This adds a "brushed metal" soul to the buttons that flat hex codes cannot achieve.

---

## 3. Typography: Editorial Authority
The typography system pairs the technical precision of **Inter** with the lifestyle-centric character of **Manrope**.

*   **Display & Headlines (Manrope):** Used for totals, large branding, and empty-state callouts. The wider apertures of Manrope convey a modern, premium friendliness.
    *   *Display-LG:* `3.5rem` / Tight Tracking (-0.02em) / Bold.
*   **Functional UI (Inter):** Used for all transactional data, SKU numbers, and button labels. Inter’s high x-height ensures legibility under harsh retail lighting.
    *   *Body-LG:* `1rem` / Normal Tracking / Regular.
    *   *Label-MD:* `0.75rem` / Wide Tracking (+0.05em) / Medium / All-Caps for secondary metadata.

---

## 4. Elevation & Depth: Tonal Layering
We do not "drop shadows" on every card. We "stack" light.

*   **The Layering Principle:** 
    1.  Base: `surface-container-lowest` (#070d1f)
    2.  Section: `surface-container-low` (#151b2d)
    3.  Interactive Card: `surface-container-high` (#23293c)
*   **Ambient Shadows:** For floating elements (e.g., the Cart Drawer), use a shadow with a `48px` blur, `0px` spread, and 6% opacity of `on-surface`. It should feel like a soft glow, not a dark stain.
*   **The Ghost Border:** If high-contrast accessibility is required, use `outline-variant` (#45464d) at **15% opacity**. It should be felt, not seen.

---

## 5. Key Components

### The "Pulse" FAB (Floating Action Button)
*   **Geometry:** `xl` (3rem) roundedness. 
*   **Visual:** `primary` background with `on-primary` icon. 
*   **Animation:** A secondary ring using `tertiary-container` that pulses from 100% to 140% scale at 0.1 opacity, creating a "heartbeat" effect for the "Complete Sale" action.

### Cards & Transactional Lists
*   **Style:** `DEFAULT` (1rem) or `md` (1.5rem) rounded corners.
*   **Rule:** No dividers. Use `spacing-3` (1rem) to separate list items. 
*   **Interaction:** On-tap/Active state should shift the background to `surface-bright` or apply a `px` (1px) "Ghost Border."

### Navigation: The Fixed Bottom Anchor
*   **Mobile-First:** 88px height to ensure thumb-reach.
*   **Active State:** Instead of a simple color change, the active icon sits atop a `sm` (0.5rem) rounded "pill" of `secondary-container`.

### Input Fields
*   **Style:** Filled, not outlined. Use `surface-container-highest`.
*   **Focus:** Transition the background to `surface-bright` and animate a 2px bottom-bar in `primary`.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use `spacing-10` (3.5rem) for "breathable" margins on desktop views to maintain the premium feel.
*   **Do** use `manrope` for large numeric values (Prices, Quantities) to make them feel like a design element.
*   **Do** use "Soft Touch" targets—ensure every button has a minimum height of `spacing-12` (4rem) for mobile environments.

### Don't:
*   **Don't** use pure black (#000000). Use `surface` (#0c1324) to maintain tonal depth and reduce eye strain.
*   **Don't** use standard 1px gray dividers. They clutter the UI and break the "concierge" aesthetic.
*   **Don't** use sharp corners. The minimum radius for any container is `DEFAULT` (1rem/16px).
*   **Don't** crowd the screen. If a workflow feels cramped, move it to a progressive disclosure pattern (slid-over panels).

---

## 7. Spacing Logic
Avoid "guessing" at padding. Use the Scale:
*   **Touch Padding:** `spacing-4` (1.4rem)
*   **Card-to-Edge:** `spacing-6` (2rem)
*   **Section-to-Section:** `spacing-10` (3.5rem)