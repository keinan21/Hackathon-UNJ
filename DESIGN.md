---
name: Precision Logistics
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45474c'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#545f73'
  primary: '#091426'
  on-primary: '#ffffff'
  primary-container: '#1e293b'
  on-primary-container: '#8590a6'
  inverse-primary: '#bcc7de'
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#00190e'
  on-tertiary: '#ffffff'
  tertiary-container: '#00301e'
  on-tertiary-container: '#00a472'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e3fb'
  primary-fixed-dim: '#bcc7de'
  on-primary-fixed: '#111c2d'
  on-primary-fixed-variant: '#3c475a'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  critical-red: '#EF4444'
  slate-gray: '#64748B'
  border-subtle: '#E2E8F0'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
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
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  margin-mobile: 16px
  gutter-mobile: 12px
---

## Brand & Style
The design system is engineered for high-utility, mobile-first inventory management where speed and accuracy are paramount. The brand personality is **authoritative, vigilant, and systematic**, functioning as a reliable co-pilot for inventory supervisors managing perishable goods.

The visual direction follows a **Corporate / Modern** style with **Minimalist** efficiency. It prioritizes data density without sacrificing legibility. High-contrast status indicators (Success, Warning, Critical) provide an immediate scannable layer of "urgency" over a calm, professional slate foundation. The interface uses subtle depth and clear containment to organize complex SKU and Batch data into actionable intelligence.

## Colors
This design system utilizes a high-contrast palette to drive user behavior through color-coded urgency:
- **Primary (Navy):** Used for headers, primary navigation, and stable UI elements to establish trust and authority.
- **Secondary (Warm Orange):** Reserved for "Warning" states and "Days to Expiry" alerts.
- **Tertiary (Teal):** Indicates "Success," "Safe" statuses, and approved "Tebus Murah" promos.
- **Critical Red:** Strictly used for expired batches or immediate stock threats.
- **Neutral (Slate):** The foundation for backgrounds and secondary text, ensuring the chromatic colors remain impactful.

Color is never used purely for decoration; it is a functional tool for ranking the `UrgencyScore`.

## Typography
We utilize **Inter** across all levels for its exceptional legibility in data-heavy mobile environments. 
- **Urgency Focus:** Numbers related to `Days to Expiry` and `UrgencyScore` should use the `data-mono` style to ensure digit alignment and rapid scanning.
- **Hierarchy:** Use `label-caps` for metadata (SKU IDs, Batch numbers) to distinguish them from primary SKU names.
- **Scaling:** Headings scale down slightly on mobile to maximize horizontal space for data tables and list items.

## Layout & Spacing
The layout follows a **fluid grid** model optimized for a single-hand mobile experience. 
- **Grid:** A 4-column fluid layout for mobile, moving to a 12-column grid for tablet/desktop views.
- **Vertical Rhythm:** A strict 4px baseline grid ensures vertical consistency across dense list items.
- **Safe Zones:** Use 16px horizontal margins for all primary content containers to ensure touch-safe interactions near screen edges.
- **Reflow:** On wider screens, the AI Advisor sidebar docks to the right, while the main inventory list expands to fill the primary column.

## Elevation & Depth
Hierarchy is established through **Tonal Layers** and **Low-Contrast Outlines**.
- **Surface Tiers:** Background is `#F8FAFC`. Primary cards use a white background with a 1px border of `#E2E8F0`. 
- **Shadows:** Avoid heavy shadows to maintain a "utility-first" look. Use a single "Soft Lift" shadow (0px 2px 4px rgba(30, 41, 59, 0.05)) for active states or floating action buttons.
- **Depth of Action:** Elements requiring immediate attention (like "Critical" alerts) do not use more depth, but rather more intense color fills to signify urgency.

## Shapes
The shape language is **Soft (0.25rem)**. This provides a professional, "tool-like" feel that is more approachable than sharp corners but more serious than highly rounded "consumer" apps. 
- **Standard Radius:** 4px for buttons and input fields.
- **Container Radius:** 8px (`rounded-lg`) for Batch Cards and Advisor Suggestion blocks.
- **Status Badges:** Use a pill-shape (full radius) to distinguish status indicators from clickable buttons.

## Components
- **Batch Cards:** Must include a left-hand color "stress bar" indicating status (Safe, Warning, Critical). Top right corner is reserved for the `UrgencyScore`.
- **AdvisorSuggestion List Items:** Use a subtle primary-tinted background to differentiate AI-generated suggestions from standard inventory logs. Action buttons within these items should be prominent.
- **Status Badges:** High-contrast background with white text for "Critical" and "Warning." Use a ghost-style (tinted background, colored text) for "Safe" or "Proposed" statuses.
- **Supervisor Approval Buttons:** Full-width primary buttons with a minimum height of 48px to ensure ease of use on mobile.
- **Visual Progress Bars:** For expiry timelines, use a segmented bar representing the category thresholds (e.g., H-7, H-3, H-1). The bar fills from right to left as the date approaches expiry.
- **Input Fields:** Use a solid white fill with a 1px slate-gray border. Focused states should use a 2px Navy border.