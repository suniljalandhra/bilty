# DESIGN.md

> Professional precision meets warm productivity — a B2B transport SaaS that feels like organized paper in good daylight, where data density serves efficiency and a single vibrant cyan says "action."

## 1. Visual Theme & Atmosphere

**Style**: Warm Professional Density
**Keywords**: Paper-calm, precise, efficient, trustworthy, data-dense, keyboard-first, monospace-numbers
**Tone**: Professional and productive — NOT playful, NOT corporate-cold, NOT startup-trendy
**Feel**: Like a well-organized transport office desk with sunlight streaming in — everything has its place, numbers align, and the blue pen marks the important bits.

**Interaction Tier**: L1 (Refined Static)
**Dependencies**: CSS only (no GSAP/ScrollTrigger needed)

**Brand Identity**:
- Logo: **BB** — First "B" in Primary Blue (#00B2FE), second "B" in Primary Dark (#0F172A)
- Wordmark: **BiltyBook** — "Bilty" in Primary Blue, "Book" in Primary Dark
- The split-color treatment reinforces the duality: digital (blue) meets traditional (black)

## 2. Color Palette & Roles

```css
:root {
  /* ═══════════════════════════════════════════════════════════════
     BRAND COLORS
     ═══════════════════════════════════════════════════════════════ */

  /* Primary Blue — Vibrant Sky Blue/Cyan (from logo "B") */
  --primary: #00B2FE;
  --primary-hover: #00A0E6;
  --primary-active: #008FCC;
  --primary-light: #E6F7FF;          /* Tinted backgrounds */
  --primary-rgb: 0, 178, 254;

  /* Primary Dark — Deep Off-Black/Navy (from logo "B" and "Book") */
  --ink: #0F172A;
  --ink-secondary: #1E293B;
  --ink-rgb: 15, 23, 42;

  /* ═══════════════════════════════════════════════════════════════
     SURFACES & BACKGROUNDS
     ═══════════════════════════════════════════════════════════════ */

  /* Canvas — Warm paper-like background (Notion-inspired) */
  --bg: #FAFAF9;                     /* Warm off-white page background */
  --bg-alt: #F5F5F4;                 /* Alternate section backgrounds */
  --bg-rgb: 250, 250, 249;

  /* Surface — Cards, panels, inputs */
  --surface: #FFFFFF;
  --surface-secondary: #F3F4F6;      /* Light gray for nested surfaces */
  --surface-hover: #F9FAFB;
  --surface-rgb: 255, 255, 255;

  /* ═══════════════════════════════════════════════════════════════
     TEXT HIERARCHY
     ═══════════════════════════════════════════════════════════════ */

  --text: #0F172A;                   /* Primary headers, important text */
  --text-secondary: #374151;         /* Body copy, descriptions */
  --text-tertiary: #6B7280;          /* Soft slate — labels, metadata */
  --text-placeholder: #9CA3AF;       /* Input placeholders, disabled */
  --text-inverse: #FFFFFF;           /* Text on colored backgrounds */

  /* ═══════════════════════════════════════════════════════════════
     BORDERS & DIVIDERS
     ═══════════════════════════════════════════════════════════════ */

  --border: #E5E7EB;                 /* Default borders */
  --border-strong: #D1D5DB;          /* Input borders, card edges */
  --border-hover: #9CA3AF;           /* Hover state borders */
  --border-focus: var(--primary);    /* Focus ring color */

  /* ═══════════════════════════════════════════════════════════════
     SEMANTIC STATUS COLORS (Bilty Lifecycle)
     ═══════════════════════════════════════════════════════════════ */

  /* Draft — Amber/Gold (work in progress) */
  --status-draft: #F59E0B;
  --status-draft-bg: #FFFBEB;
  --status-draft-text: #92400E;

  /* Issued — Green (finalized legal document) */
  --status-issued: #10B981;
  --status-issued-bg: #ECFDF5;
  --status-issued-text: #065F46;

  /* Cancelled — Red (voided) */
  --status-cancelled: #EF4444;
  --status-cancelled-bg: #FEF2F2;
  --status-cancelled-text: #991B1B;

  /* Edited — Blue indicator (modified after issue) */
  --status-edited: #3B82F6;
  --status-edited-bg: #EFF6FF;
  --status-edited-text: #1E40AF;

  /* General semantic */
  --success: #10B981;
  --success-bg: #ECFDF5;
  --error: #EF4444;
  --error-hover: #DC2626;
  --error-bg: #FEF2F2;
  --warning: #F59E0B;
  --warning-bg: #FFFBEB;
  --info: var(--primary);
  --info-bg: var(--primary-light);

  /* Accent Purple (for consignee distinction) */
  --accent-purple: #7C3AED;
  --accent-purple-bg: #F3E8FF;
}

/* ═══════════════════════════════════════════════════════════════
   DARK MODE
   ═══════════════════════════════════════════════════════════════ */

[data-theme="dark"] {
  --bg: #0F172A;
  --bg-alt: #1E293B;
  --bg-rgb: 15, 23, 42;

  --surface: #1E293B;
  --surface-secondary: #334155;
  --surface-hover: #374151;
  --surface-rgb: 30, 41, 59;

  --text: #F9FAFB;
  --text-secondary: #E5E7EB;
  --text-tertiary: #9CA3AF;
  --text-placeholder: #6B7280;

  --border: #374151;
  --border-strong: #4B5563;
  --border-hover: #6B7280;

  /* Primary stays vibrant in dark mode */
  --primary: #00B2FE;
  --primary-hover: #33C4FF;
  --primary-light: rgba(0, 178, 254, 0.15);

  /* Status colors adjust for dark backgrounds */
  --status-draft-bg: rgba(245, 158, 11, 0.15);
  --status-issued-bg: rgba(16, 185, 129, 0.15);
  --status-cancelled-bg: rgba(239, 68, 68, 0.15);
  --status-edited-bg: rgba(59, 130, 246, 0.15);
  --error-hover: #F87171;
  --accent-purple-bg: rgba(124, 58, 237, 0.15);
}
```

**Color Rules:**
- All colors via CSS variables — zero hardcoded hex in components
- Primary Blue (#00B2FE) is ONLY for: CTAs, focus rings, active states, links, brand elements
- Never use Primary Blue decoratively — it signals "action" or "active"
- Status colors are semantic: Draft=Amber, Issued=Green, Cancelled=Red, Edited=Blue
- Text on Primary Blue background uses `--text-inverse` (#FFFFFF)
- Warm canvas `--bg` (#FAFAF9) prevents clinical white-screen fatigue

## 3. Typography Rules

**Font Stack:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Monaco, 'Cascadia Mono', monospace;
}

body {
  font-family: var(--font-sans);
  font-feature-settings: 'cv01', 'ss01';  /* Inter alternates */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

| Role | Font | Size | Weight | Line Height | Letter Spacing | Use |
|------|------|------|--------|-------------|----------------|-----|
| Page Title | Inter | 28px | 700 | 1.2 | -0.5px | "Bilty Book", "Settings" |
| Section H2 | Inter | 20px | 600 | 1.3 | -0.3px | Card headers, form sections |
| H3 | Inter | 16px | 600 | 1.4 | -0.1px | Subsection titles |
| Body | Inter | 15px | 400 | 1.5 | 0 | Descriptions, paragraphs |
| Body Small | Inter | 14px | 400 | 1.5 | 0 | Table cells, metadata |
| Label | Inter | 13px | 500 | 1.4 | 0 | Form labels, nav items |
| Caption | Inter | 12px | 400 | 1.4 | 0.1px | Timestamps, helper text |
| Eyebrow | Inter | 11px | 600 | 1.3 | 0.5px | Badges, overlines (uppercase) |
| Mono Body | JetBrains Mono | 14px | 400 | 1.5 | 0 | Bilty numbers, amounts, dates |
| Mono Small | JetBrains Mono | 13px | 400 | 1.4 | 0 | Reference IDs, table numbers |
| Mono Large | JetBrains Mono | 18px | 500 | 1.3 | -0.2px | Grand totals, prominent amounts |

**Typography Rules:**
- Headlines use weight 600-700 with slight negative letter-spacing
- Body copy stays at 400 weight for comfortable reading
- **ALL numbers** (₹ amounts, bilty IDs, dates, phone numbers, GSTIN) use `--font-mono`
- Monospace numbers must right-align in tables for decimal alignment
- Hindi/Devanagari text: add `'Noto Sans Devanagari'` to font stack when needed
- Line height ≥ 1.5 for body text (readability during long data entry)
- **NEVER use**: Comic Sans, Papyrus, decorative fonts, weight < 400 for body

**Text Decoration:**
- Page titles: No gradients, no shadows (professional restraint)
- Primary Blue only appears in text for links and active states
- Status text uses semantic colors (amber/green/red/blue)

## 4. Component Stylings

### Buttons

```css
/* ═══════════════════════════════════════════════════════════════
   BUTTONS
   ═══════════════════════════════════════════════════════════════ */

.btn {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.15s ease;
  white-space: nowrap;
}

/* Primary — The single action color */
.btn-primary {
  background: var(--primary);
  color: var(--text-inverse);
  border-color: var(--primary);
}
.btn-primary:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}
.btn-primary:active {
  background: var(--primary-active);
  transform: translateY(1px);
}
.btn-primary:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.btn-primary:disabled {
  background: var(--border);
  color: var(--text-placeholder);
  cursor: not-allowed;
  border-color: var(--border);
}

/* Secondary — Outlined */
.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border-color: var(--border-strong);
}
.btn-secondary:hover {
  background: var(--surface-hover);
  border-color: var(--border-hover);
}
.btn-secondary:active {
  background: var(--surface-secondary);
}
.btn-secondary:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.btn-secondary:disabled {
  color: var(--text-placeholder);
  cursor: not-allowed;
}

/* Ghost — Minimal chrome */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border-color: transparent;
}
.btn-ghost:hover {
  background: var(--surface-secondary);
  color: var(--text);
}
.btn-ghost:active {
  background: var(--border);
}
.btn-ghost:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Danger — Destructive actions */
.btn-danger {
  background: var(--error);
  color: var(--text-inverse);
  border-color: var(--error);
}
.btn-danger:hover {
  background: #DC2626;
}
.btn-danger:active {
  background: #B91C1C;
}
.btn-danger:focus-visible {
  outline: 2px solid var(--error);
  outline-offset: 2px;
}

/* Icon button */
.btn-icon {
  padding: 8px;
  aspect-ratio: 1;
}

/* Size variants */
.btn-sm {
  font-size: 13px;
  padding: 6px 12px;
}
.btn-lg {
  font-size: 15px;
  padding: 12px 20px;
}
```

### Form Inputs

```css
/* ═══════════════════════════════════════════════════════════════
   FORM INPUTS
   ═══════════════════════════════════════════════════════════════ */

.input,
.select,
.textarea {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  padding: 8px 12px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  width: 100%;
}

.input:hover,
.select:hover,
.textarea:hover {
  border-color: var(--border-hover);
}

.input:focus,
.select:focus,
.textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.15);
}

.input::placeholder,
.textarea::placeholder {
  color: var(--text-placeholder);
}

.input:disabled,
.select:disabled,
.textarea:disabled {
  background: var(--surface-secondary);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

/* Input with error */
.input-error {
  border-color: var(--error);
}
.input-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

/* Money input — Right-aligned monospace */
.input-money {
  font-family: var(--font-mono);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Form label */
.label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.label-required::after {
  content: ' *';
  color: var(--error);
}

/* Helper text */
.helper-text {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.helper-text-error {
  color: var(--error);
}

/* Field group spacing */
.field {
  margin-bottom: 16px;
}
```

### Cards & Sections

```css
/* ═══════════════════════════════════════════════════════════════
   CARDS & SECTIONS
   ═══════════════════════════════════════════════════════════════ */

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

/* Section — Collapsible content group */
.section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--surface-secondary);
  border-bottom: 1px solid var(--border);
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.section-body {
  padding: 16px;
}

/* Clickable card */
.card-interactive {
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.card-interactive:hover {
  border-color: var(--border-hover);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.card-interactive:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

### Status Badges

```css
/* ═══════════════════════════════════════════════════════════════
   STATUS BADGES (Bilty Lifecycle)
   ═══════════════════════════════════════════════════════════════ */

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

/* Draft — Amber */
.badge-draft {
  background: var(--status-draft-bg);
  color: var(--status-draft-text);
}

/* Issued — Green */
.badge-issued {
  background: var(--status-issued-bg);
  color: var(--status-issued-text);
}

/* Cancelled — Red */
.badge-cancelled {
  background: var(--status-cancelled-bg);
  color: var(--status-cancelled-text);
}

/* Edited indicator — Blue (small) */
.badge-edited {
  background: var(--status-edited-bg);
  color: var(--status-edited-text);
  font-size: 10px;
  padding: 2px 6px;
}

/* Generic variants */
.badge-neutral {
  background: var(--surface-secondary);
  color: var(--text-tertiary);
}

.badge-primary {
  background: var(--primary-light);
  color: var(--primary);
}
```

### Tables

```css
/* ═══════════════════════════════════════════════════════════════
   TABLES (Data-dense bilty lists)
   ═══════════════════════════════════════════════════════════════ */

.table-container {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.table th {
  text-align: left;
  padding: 12px 16px;
  background: var(--surface-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;
}

.table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  vertical-align: middle;
}

.table tr:last-child td {
  border-bottom: none;
}

.table tr:hover td {
  background: var(--surface-hover);
}

/* Clickable row */
.table tr.clickable {
  cursor: pointer;
}
.table tr.clickable:focus-visible td {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

/* Monospace columns */
.table .col-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

/* Right-aligned numeric columns */
.table .col-amount {
  text-align: right;
  font-family: var(--font-mono);
}

/* Sortable header */
.table th.sortable {
  cursor: pointer;
  user-select: none;
}
.table th.sortable:hover {
  color: var(--text);
}
.table th.sorted {
  color: var(--primary);
}

/* Row actions (appear on hover) */
.table .row-actions {
  opacity: 0;
  transition: opacity 0.15s ease;
}
.table tr:hover .row-actions {
  opacity: 1;
}

/* Muted row (cancelled) */
.table tr.muted td {
  color: var(--text-tertiary);
}
.table tr.muted .col-mono {
  text-decoration: line-through;
}
```

### Navigation

```css
/* ═══════════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════════ */

/* Sidebar */
.sidebar {
  width: 220px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  overflow-y: auto;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 24px;
}

.sidebar-logo-mark {
  font-family: var(--font-sans);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -1px;
}

/* BB logo: first B blue, second B black */
.sidebar-logo-mark .b-blue {
  color: var(--primary);
}
.sidebar-logo-mark .b-dark {
  color: var(--ink);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.15s ease;
}

.sidebar-link:hover {
  background: var(--surface-secondary);
  color: var(--text);
}

.sidebar-link:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

.sidebar-link.active {
  background: var(--primary-light);
  color: var(--primary);
}

.sidebar-link-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* Top bar */
.topbar {
  height: 56px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.topbar-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.topbar-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.topbar-breadcrumb a {
  color: var(--text-tertiary);
  text-decoration: none;
}
.topbar-breadcrumb a:hover {
  color: var(--primary);
}

.topbar-breadcrumb-separator {
  color: var(--text-placeholder);
}

.topbar-breadcrumb-current {
  color: var(--text);
  font-weight: 500;
}
```

### Dialogs & Modals

```css
/* ═══════════════════════════════════════════════════════════════
   DIALOGS & MODALS
   ═══════════════════════════════════════════════════════════════ */

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.15s ease;
}

.dialog {
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  max-width: 480px;
  width: calc(100% - 32px);
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  animation: slideUp 0.2s ease;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}

.dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.dialog-close {
  padding: 4px;
  border-radius: 4px;
  color: var(--text-tertiary);
}
.dialog-close:hover {
  background: var(--surface-secondary);
  color: var(--text);
}

.dialog-body {
  padding: 24px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  background: var(--surface-secondary);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

## 5. Layout Principles

**Container:**
```css
.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
}

.container-narrow {
  max-width: 800px;
}

.container-wide {
  max-width: 1440px;
}
```

**App Layout:**
```css
.app-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 100vh;
}

.main-content {
  background: var(--bg);
  padding: 24px;
  margin-left: 220px; /* Sidebar width */
}
```

**Spacing Scale:**
| Token | Value | Use |
|-------|-------|-----|
| --space-xs | 4px | Inline gaps, icon padding |
| --space-sm | 8px | Tight component spacing |
| --space-md | 12px | Default component padding |
| --space-lg | 16px | Field spacing, section gaps |
| --space-xl | 24px | Card padding, major gaps |
| --space-2xl | 32px | Section separation |
| --space-3xl | 48px | Page section gaps |

**Spacing CSS:**
```css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;
  --space-3xl: 48px;
}
```

**Grid:**
```css
.grid {
  display: grid;
  gap: var(--space-lg);
}

.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }

/* Form grid — Two columns for related fields */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
}

/* Party grid — Side-by-side consignor/consignee */
.party-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-xl);
}

@media (max-width: 768px) {
  .form-grid,
  .party-grid,
  .grid-2,
  .grid-3,
  .grid-4 {
    grid-template-columns: 1fr;
  }
}
```

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| 0 — Flat | No shadow, `var(--border)` border | Default cards, sections |
| 1 — Subtle | `0 1px 2px rgba(0,0,0,0.04)` | Hover states, buttons |
| 2 — Raised | `0 2px 8px rgba(0,0,0,0.06)` | Dropdowns, popovers |
| 3 — Elevated | `0 8px 24px rgba(0,0,0,0.08)` | Modals, dialogs |
| 4 — Floating | `0 20px 40px rgba(0,0,0,0.12)` | Command palette, sheets |

```css
:root {
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08);
  --shadow-xl: 0 20px 40px rgba(0, 0, 0, 0.12);
}

/* Focus ring — Consistent across all interactive elements */
:root {
  --focus-ring: 0 0 0 3px rgba(var(--primary-rgb), 0.2);
}
```

**Elevation Philosophy:**
- Borders are the primary depth cue (Notion-style hairlines)
- Shadows are subtle and used sparingly
- Elevation increases with importance/focus
- Dark mode uses slightly stronger shadows

## 7. Animation & Interaction

**Motion Philosophy**: Refined and functional — animations serve feedback, not decoration. Fast, purposeful, never distracting.

**Tier**: L1 (Refined Static)

### Base Setup

```css
:root {
  --duration-fast: 0.1s;
  --duration-normal: 0.15s;
  --duration-slow: 0.3s;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Entrance Animation

```css
/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Fade in with subtle rise */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Page content entrance */
.page-enter {
  animation: fadeInUp 0.3s var(--ease-out);
}

/* Scroll reveal (IntersectionObserver trigger) */
.reveal {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.4s var(--ease-out), transform 0.4s var(--ease-out);
}

.reveal.in-view {
  opacity: 1;
  transform: translateY(0);
}
```

### Hover & Focus States

```css
/* Universal transition for interactive elements */
.interactive {
  transition:
    background-color var(--duration-fast) ease,
    border-color var(--duration-fast) ease,
    color var(--duration-fast) ease,
    box-shadow var(--duration-fast) ease,
    transform var(--duration-fast) ease;
}

/* Card hover lift */
.card-hover:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

/* Button press feedback */
.btn:active {
  transform: translateY(1px);
}

/* Link underline animation */
.link-animated {
  position: relative;
  text-decoration: none;
  color: var(--primary);
}

.link-animated::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 0;
  height: 1px;
  background: var(--primary);
  transition: width var(--duration-normal) var(--ease-out);
}

.link-animated:hover::after {
  width: 100%;
}

/* Focus visible ring */
:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
```

### Loading States

```css
/* Skeleton loader */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--surface-secondary) 0%,
    var(--surface) 50%,
    var(--surface-secondary) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Spinner */
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .reveal {
    opacity: 1;
    transform: none;
  }
}
```

## 8. Do's and Don'ts

### Do ✓
- Use Primary Blue (#00B2FE) **only** for CTAs, focus states, active tabs, links
- Use warm off-white (`--bg: #FAFAF9`) as page canvas — never pure white for backgrounds
- Use monospace font (JetBrains Mono) for ALL numbers: ₹ amounts, bilty IDs, dates, GSTIN, phones
- Right-align monetary columns in tables with `tabular-nums`
- Maintain high data density — users scan 25+ rows, don't waste vertical space
- Use status badges consistently: Draft=Amber, Issued=Green, Cancelled=Red
- Include visible focus states on all interactive elements (keyboard accessibility)
- Keep hover states subtle — lift of 1-2px max, subtle shadow increase
- Use the BB logo mark: first B in `--primary`, second B in `--ink`

### Don't ✗
- ❌ Don't use Primary Blue decoratively — it signals "action" only
- ❌ Don't use pure white (#FFFFFF) as page background — use `--bg` (#FAFAF9)
- ❌ Don't mix proportional fonts with numbers — always use `--font-mono` for data
- ❌ Don't use weight 800/900 (black) — max weight is 700
- ❌ Don't use shadows heavier than `--shadow-lg` — this is business software, not a portfolio
- ❌ Don't add gradients, glows, or decorative effects to UI chrome
- ❌ Don't animate anything longer than 0.3s — business users want speed
- ❌ Don't hide critical actions in hover-only states on touch devices
- ❌ Don't use rounded-full (pill) buttons — use 6-8px radius for utility
- ❌ Don't center-align table data — left-align text, right-align numbers
- ❌ Don't use colored backgrounds for entire sections — use borders and spacing

## 9. Responsive Behavior

**Breakpoints:**
| Name | Width | Key Changes |
|------|-------|-------------|
| Desktop | ≥1280px | Full sidebar + content, 3-4 column grids |
| Tablet | 768px–1279px | Sidebar overlay, 2 column grids |
| Mobile | <768px | Bottom nav or hamburger, single column, stacked forms |

**Touch Targets:** Minimum 44×44px on mobile

**Collapsing Strategy:**
- Sidebar → Slides in from left as overlay below 1024px
- Tables → Horizontal scroll with sticky first column, or card layout on mobile
- Form grids → Stack vertically on mobile
- Party side-by-side → Stack consignor above consignee
- Dialog → Full-screen on mobile (bottom sheet pattern)
- Pagination → Simplified Prev/Next on mobile

```css
/* ═══════════════════════════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════════════════════════ */

/* Tablet: Sidebar becomes overlay */
@media (max-width: 1023px) {
  .sidebar {
    position: fixed;
    transform: translateX(-100%);
    z-index: 200;
    transition: transform 0.2s var(--ease-out);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.5);
    z-index: 199;
  }

  .main-content {
    margin-left: 0;
  }

  .topbar {
    padding-left: 16px;
  }

  .topbar-menu-btn {
    display: flex;
  }
}

/* Mobile: Single column everything */
@media (max-width: 767px) {
  .container {
    padding: 0 16px;
  }

  .main-content {
    padding: 16px;
  }

  .card {
    padding: 16px;
    border-radius: 8px;
  }

  .dialog {
    max-width: 100%;
    width: 100%;
    max-height: 100%;
    border-radius: 0;
    margin: 0;
  }

  /* Table as cards on mobile */
  .table-mobile-cards tbody {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .table-mobile-cards tr {
    display: block;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
  }

  .table-mobile-cards td {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border: none;
  }

  .table-mobile-cards td::before {
    content: attr(data-label);
    font-weight: 500;
    color: var(--text-tertiary);
    font-size: 12px;
  }

  .table-mobile-cards thead {
    display: none;
  }

  /* Larger touch targets */
  .btn {
    min-height: 44px;
    padding: 12px 16px;
  }

  .sidebar-link {
    padding: 14px 16px;
  }
}

/* Small mobile */
@media (max-width: 375px) {
  :root {
    font-size: 14px;
  }

  .topbar-title {
    font-size: 14px;
  }
}
```

---

## Quick Reference

### Color Summary
| Role | Light Mode | Dark Mode |
|------|------------|-----------|
| Page Background | #FAFAF9 | #0F172A |
| Card Surface | #FFFFFF | #1E293B |
| Primary Action | #00B2FE | #00B2FE |
| Text Primary | #0F172A | #F9FAFB |
| Text Secondary | #374151 | #E5E7EB |
| Border | #E5E7EB | #374151 |
| Draft Badge | Amber #F59E0B | Amber #F59E0B |
| Issued Badge | Green #10B981 | Green #10B981 |
| Cancelled Badge | Red #EF4444 | Red #EF4444 |

### Typography Summary
| Use | Font | Size | Weight |
|-----|------|------|--------|
| Page title | Inter | 28px | 700 |
| Section header | Inter | 20px | 600 |
| Body | Inter | 15px | 400 |
| Table cell | Inter | 14px | 400 |
| Label | Inter | 13px | 500 |
| **Numbers** | JetBrains Mono | 14px | 400 |
| **Amounts** | JetBrains Mono | 18px | 500 |

### Component Radius
| Component | Radius |
|-----------|--------|
| Button | 8px |
| Input | 6px |
| Card | 12px |
| Badge | 4px |
| Dialog | 12px |

---

*Generated for BiltyBook — Digital Bilty/GR Platform*
