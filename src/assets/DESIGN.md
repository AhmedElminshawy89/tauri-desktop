# Design System Specification: The Kinetic Precision POS

## 1. Overview & Creative North Star: "The Digital Concierge"
In a high-pressure retail or restaurant environment, the interface must be more than a tool—it must be an effortless extension of the operator. Our Creative North Star is **"The Digital Concierge."** This means moving away from the "industrial calculator" look of legacy POS systems and toward a sophisticated, editorial experience that feels premium yet hyper-efficient.

We break the "template" look through **Tonal Depth** and **Asymmetric Balance**. By utilizing high-contrast typography (Manrope for structure, Inter for data) and layered surfaces instead of rigid lines, we create an interface that breathes. The goal is to reduce cognitive load by using visual "weight" rather than visual "clutter."

---

## 2. Colors: Depth Over Definition
This system utilizes a sophisticated teal palette (`#006067`) to evoke trust and precision. 

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off the UI. Separation must be achieved through background shifts. For example, a `surface-container-low` (`#f3f4f5`) sidebar sitting against a `surface` (`#f8f9fa`) main stage.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. 
- **Base Layer:** `surface` (`#f8f9fa`)
- **Interaction Zones:** `surface-container-low` (`#f3f4f5`)
- **Active Cards/Modals:** `surface-container-lowest` (`#ffffff`) for maximum "pop."
- **Nesting:** To define a search bar within a header, do not draw a box; use `surface-container-high` (`#e7e8e9`) to "sink" the input into the surface.

### The "Glass & Gradient" Rule
For high-action areas like the "Pay" button or "Total Amount," use a signature gradient transitioning from `primary` (`#006067`) to `primary-container` (`#007b83`). For floating overlays (e.g., quick-edit modifiers), use **Glassmorphism**: `surface-container-lowest` at 80% opacity with a `16px` backdrop blur.

---

## 3. Typography: The Editorial Edge
We pair **Manrope** (Display/Headline) with **Inter** (Body/Labels) to bridge the gap between high-end brand aesthetics and technical readability.

*   **Display & Headlines (Manrope):** Use `headline-md` (1.75rem) for category names. The geometric nature of Manrope ensures bilingual clarity for Arabic characters, maintaining a professional "architectural" feel.
*   **Body & Data (Inter):** Use `body-md` (0.875rem) for product descriptions. Inter’s high x-height is essential for the fast-paced scanning of cart items.
*   **Action Labels:** `label-md` (0.75rem) in Medium or Semi-Bold weight for buttons to ensure they remain legible even when scaled down on smaller tablets.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "heavy" for a modern POS. We use **Tonal Layering**.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` background. This creates a natural, soft lift.
*   **Ambient Shadows:** For floating elements like a "Discount" popover, use an extra-diffused shadow: `0px 12px 32px rgba(25, 28, 29, 0.06)`. The tint is derived from the `on-surface` color, never pure black.
*   **The "Ghost Border" Fallback:** If a container needs more definition (e.g., in high-glare environments), use the `outline-variant` (`#bdc9ca`) at **15% opacity**. Never use 100% opaque borders.

---

## 5. Signature Components

### Product Cards
*   **Layout:** Vertical stack with `xl` (0.75rem) rounded corners.
*   **Styling:** Use `surface-container-lowest` background. No borders.
*   **Pricing:** Placed in the top-right using `title-sm` in `primary` teal to draw the eye immediately.
*   **Interaction:** On tap, use a subtle scale-down effect (98%) rather than a color change to mimic a physical button.

### Category Tabs
*   **Style:** Pill-shaped (`full` roundedness) using `surface-container-high`.
*   **Active State:** Transitions to `primary` with `on-primary` text. Use a subtle `primary-fixed-dim` outer glow to indicate focus.
*   **Spacing:** `spacing-4` (0.9rem) between tabs to prevent "fat-finger" errors.

### The Cart Data Table
*   **Structure:** Forbid divider lines. Use `spacing-3` (0.6rem) of vertical white space between rows.
*   **Zebra Toasting:** Instead of lines, use a alternating background of `surface-container-low` and `surface-container-lowest` for every other item.
*   **Typography:** The "Total" must be `headline-sm` using `primary` color to anchor the screen.

### Adaptive Input Fields
*   **Design:** Use a "filled" style with `surface-container-highest`. 
*   **Focus State:** A 2px bottom-bar using `primary` teal. No full-box outline. This maintains the "clean" aesthetic while providing clear affordance.

---

## 6. Do’s and Don’ts

### Do
*   **DO** use `surface-dim` for inactive overlay states to maintain a "muted" background.
*   **DO** ensure the Arabic line-height is 1.5x the English line-height to account for descending characters in scripts like Jawi or standard Naskh.
*   **DO** use the `tertiary` (`#834718`) color for "Refunding" or "Voiding"—it provides a warm warning that is distinct from the "Error" red.

### Don't
*   **DON'T** use `error` red for "Delete" buttons in the cart. Use a subtle `on-surface-variant` and reserve `error` for critical system failures or "Payment Declined."
*   **DON'T** use 90-degree corners. Everything must use the `md` (0.375rem) to `xl` (0.75rem) radius scale to feel approachable and modern.
*   **DON'T** crowd the screen. If the cart has more than 10 items, use a fade-out gradient at the bottom of the list to indicate scrollability, rather than a visible scrollbar.

---

## 7. Spacing Strategy
Utilize the **"Breathe" Spacing Scale**. 
- Use `spacing-8` (1.75rem) for external page margins.
- Use `spacing-2.5` (0.5rem) for internal card padding.
- High-pressure buttons (e.g., "Checkout") must have a minimum height of `spacing-16` (3.5rem) to ensure 100% hit accuracy.