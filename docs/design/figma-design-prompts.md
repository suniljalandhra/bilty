# Figma Design Prompts — Bilty V1 Redesign

Progressive prompts for redesigning the Bilty platform UI. Design language: Linear's speed and minimalism, Notion's content-first clarity, QuickBooks' professional business density.

**Design principles to maintain across all screens:**
- Keyboard-first interactions (visible shortcuts, focus states)
- High information density without clutter
- Monospace for numbers/IDs, proportional for text
- Muted chrome, vibrant data
- Fast perceived performance (skeleton states, instant feedback)

---

## Phase 1: Design System Foundation

### Prompt 1.1 — Color Tokens

```
Design a color system for a B2B transport logistics SaaS used daily by Indian transport company staff. The app handles legal documents (bilty/lorry receipts) so it must feel trustworthy and professional, not playful.

Create both light and dark mode palettes with these semantic tokens:

Background layers:
- bg-base: App background
- bg-surface: Cards, panels
- bg-surface-secondary: Nested surfaces, table rows on hover
- bg-overlay: Modal backdrops

Text hierarchy:
- text-primary: Main content, headings
- text-secondary: Labels, metadata
- text-tertiary: Placeholders, disabled
- text-inverse: Text on colored backgrounds

Interactive:
- accent-primary: Primary actions, links, focus rings
- accent-primary-hover: Hover state
- accent-subtle: Selected backgrounds, active nav items

Status (for document lifecycle):
- status-draft: Amber/gold — work in progress
- status-issued: Green — finalized legal document
- status-cancelled: Red — voided
- status-edited: Blue indicator — modified after issue

Borders:
- border-default: Subtle dividers
- border-strong: Input borders, card edges

Reference: Linear's muted purples with vibrant accents, QuickBooks' professional blue-gray palette. Avoid pure black or white. The palette should work for 8+ hours of daily use without eye strain.
```

### Prompt 1.2 — Typography Scale

```
Design a typography system for a document-heavy B2B application. Users create, review, and print legal transport receipts with monetary amounts, reference numbers, addresses, and audit trails.

Requirements:
- Primary font: Inter or similar grotesque sans-serif (clarity at small sizes)
- Monospace font: JetBrains Mono or similar (for bilty numbers, amounts, dates, reference IDs)
- Support for Devanagari script (Hindi party names, addresses)

Scale (use for UI, not documents):
- Display: Page titles (Bilty Book, Settings)
- Heading: Section headers, card titles
- Body: Default text, descriptions
- Body-small: Table cells, metadata, timestamps
- Caption: Help text, field hints
- Mono-body: Bilty numbers (#BLT-2024-0001), amounts (₹12,450.00)
- Mono-small: Reference IDs, timestamps in tables

Specifications needed:
- Font sizes (rem)
- Line heights
- Letter spacing (especially for monospace)
- Font weights per level

Reference: Linear's tight but readable density. Notion's generous line-height for content. The system must remain legible when showing 25+ bilty rows in a table.
```

### Prompt 1.3 — Spacing and Layout Grid

```
Design a spacing system and layout grid for a desktop-first B2B SaaS with responsive mobile support.

Desktop layout (1280px+):
- Fixed left sidebar: 220px (collapsible to 64px icon-only)
- Main content area with max-width constraint
- Optional right panel for detail views (400-500px)

Spacing scale (base unit 4px):
- 4px (xs): Inline spacing, icon gaps
- 8px (sm): Tight component padding
- 12px (md): Default component padding
- 16px (lg): Section spacing
- 24px (xl): Card padding, major section gaps
- 32px (2xl): Page section separation
- 48px (3xl): Major layout divisions

Component spacing patterns:
- Form field vertical gap: 16px
- Button group gap: 8px
- Table cell padding: 12px horizontal, 8px vertical
- Card padding: 24px
- Sidebar item padding: 12px horizontal, 8px vertical

Responsive breakpoints:
- Desktop: 1280px+
- Tablet: 768px - 1279px (sidebar becomes overlay)
- Mobile: < 768px (bottom nav or hamburger)

Reference: Linear's dense but breathable layouts. Every element should have intentional spacing, no arbitrary gaps.
```

### Prompt 1.4 — Core Components

```
Design a component library for a B2B transport SaaS. Components should feel fast, professional, and keyboard-accessible.

Buttons:
- Primary: Solid accent color, used sparingly (1 per view)
- Secondary: Outlined or ghost, for supporting actions
- Danger: Destructive actions (cancel bilty, remove team member)
- Ghost: Minimal chrome, for toolbars and dense areas
- Icon-only: Square aspect, with tooltip
- States: Default, hover, active, focus (visible ring), disabled, loading

Form inputs:
- Text field: Clean border, visible label, optional helper text
- Select/dropdown: Custom styled, keyboard navigable
- Money input: Rupee prefix, thousand separators, decimal alignment
- Date picker: Calendar popup, keyboard entry support
- Textarea: Auto-growing, character count when limited

Status badges:
- Draft: Amber background, dark amber text
- Issued: Green background, dark green text
- Cancelled: Red background, dark red text, strikethrough optional
- Edited: Small blue indicator badge

Tables:
- Dense rows with hover highlight
- Sortable column headers with indicators
- Sticky header on scroll
- Row actions on hover (view, edit, print)
- Empty state with clear call-to-action
- Loading skeleton for rows

Cards:
- Subtle shadow or border, not both
- Clear visual hierarchy within
- Optional header with title and action

Modals/Dialogs:
- Centered with backdrop
- Clear title, close button
- Action buttons right-aligned (cancel left, confirm right)
- Escape key closes, click outside closes (unless destructive)

Reference: Linear's crisp button states, Notion's clean form fields, QuickBooks' business-appropriate density.
```

---

## Phase 2: Authentication Screens

### Prompt 2.1 — Login Page

```
Design a login page for Bilty — a B2B SaaS for Indian transport companies to digitize their lorry receipts.

Layout:
- Split screen on desktop: Left side branding/illustration, right side form
- Mobile: Stacked, form prominent

Left panel (desktop):
- Product name and tagline
- Simple illustration or abstract pattern suggesting logistics/documents
- Muted colors, not distracting

Login form:
- Email field
- Password field with show/hide toggle
- "Remember me" checkbox
- Primary "Sign in" button (full width)
- Divider with "or"
- "Continue with Google" button (Google icon, outlined style)
- Links: "Forgot password?" and "Create account"

Footer:
- Minimal: copyright, privacy policy link

Visual tone:
- Professional and trustworthy
- Fast and focused (no unnecessary elements)
- Should load instantly (no heavy images)

Reference: Linear's minimal login, Stripe's confidence-building simplicity.
```

### Prompt 2.2 — Registration Page

```
Design a registration page for Bilty. New users sign up with email, then set up their company during onboarding.

Form fields:
- Full name
- Email
- Password (with strength indicator: weak/medium/strong)
- Confirm password
- Checkbox: "I agree to Terms of Service and Privacy Policy" (links open in new tab)

Primary action:
- "Create account" button
- Below: "Already have an account? Sign in"

Password requirements (shown as helper text or inline validation):
- Minimum 8 characters
- At least one number
- At least one uppercase letter

After submission:
- Show "Check your email" confirmation state (same page, form replaced with message)
- Email verification required before proceeding

Design notes:
- Match login page visual language
- Single column form, not overwhelming
- Clear error states per field (inline, not just toast)
```

### Prompt 2.3 — Password Recovery Flow

```
Design the password recovery flow: forgot password, email sent confirmation, and reset password pages.

Forgot Password:
- Simple form: email field + "Send reset link" button
- Helper text: "We'll send you a link to reset your password"
- Back to login link

Email Sent Confirmation:
- Success icon (checkmark in circle)
- "Check your email" heading
- "We sent a password reset link to [email]. Link expires in 1 hour."
- "Didn't receive it? Resend" link
- Return to login link

Reset Password Page (accessed via email link):
- Heading: "Set new password"
- New password field (with requirements)
- Confirm password field
- "Reset password" button
- On success: redirect to login with success toast

Error states:
- Expired link: Clear message with option to request new one
- Invalid link: Same treatment

Visual consistency with login/register pages.
```

---

## Phase 3: Onboarding

### Prompt 3.1 — Company Setup

```
Design the company onboarding flow for first-time users after email verification. This sets up their transport company profile.

Step indicator:
- 2 steps: "Company Details" → "Choose Layout"
- Progress bar or numbered steps

Company Details form:
- Company name (required)
- Company address (textarea, required)
- GSTIN (optional, 15-character format)
- PAN (optional, 10-character format)
- Phone number (required)
- Email (pre-filled from signup, editable)
- Logo upload (optional, drag-drop zone with file picker fallback, accepts PNG/JPEG, max 2MB)

Form layout:
- Single column on mobile
- Two columns on desktop for shorter fields (GSTIN/PAN side by side)
- Logo upload prominent but optional-feeling

Primary action: "Continue" button
Back action: None (first step), or allow logout only

Design notes:
- This is the user's first real interaction with the app, make it feel smooth and achievable
- Don't overwhelm — these are just basics, more settings available later
- Clear field labels and helper text where format is specific (GSTIN: 15 characters, e.g., 27AABCU9603R1ZM)
```

### Prompt 3.2 — Layout Selection

```
Design a layout picker for the second onboarding step. Users choose their preferred PDF bilty format from 5 options.

Layout:
- Heading: "Choose your bilty layout"
- Subtitle: "This will be used when printing or sharing biltys. You can change it anytime in settings."
- Grid of 5 layout preview cards

Each layout card:
- Thumbnail preview of the PDF layout (mockup, not actual document)
- Layout name below thumbnail
- Radio button or selection indicator
- On hover: subtle scale or border highlight
- Selected state: accent border, checkmark badge

Layout options (names to show):
1. "Classic" — Traditional transport document style
2. "Modern" — Clean contemporary layout
3. "Compact" — Efficient single-page focus
4. "Detailed" — Comprehensive with all fields visible
5. "Minimal" — Essential information only

Grid layout:
- 3 columns on desktop, 2 on tablet, 1 on mobile (scrollable)
- Cards should be large enough to see layout structure

Primary action: "Complete setup" button
Back: "Back" link to previous step

After completion: Redirect to main app (Bilty list)
```

---

## Phase 4: App Shell

### Prompt 4.1 — Sidebar Navigation

```
Design the main app sidebar for Bilty. Users spend hours daily in this app, so navigation must be fast and unobtrusive.

Sidebar structure:
- Fixed left, 220px wide (desktop), collapsible to 64px icons-only
- Sticky, full viewport height

Header area:
- Company logo (from onboarding) or company initial avatar
- Company name (truncated if long)
- Collapse/expand toggle button

Navigation items:
- Bilty Book (primary workspace) — icon: document/receipt
- Parties (address book) — icon: users/contacts
- Settings — icon: gear/cog
- Team (admin only) — icon: people group

Navigation item design:
- Icon + label
- Hover: subtle background
- Active: accent background tint, accent text color, left border indicator
- Keyboard focus visible
- Collapsed mode: icons only with tooltips

Bottom section:
- User avatar + name (or email)
- Dropdown or menu: Settings, Sign out
- Theme toggle (light/dark) — optional, could be in settings

Mobile behavior:
- Sidebar becomes overlay (slide from left)
- Hamburger menu in top bar
- Tap outside or X to close

Reference: Linear's sidebar density and quick switching, Notion's clean icons.
```

### Prompt 4.2 — Top Bar / Header

```
Design the top bar that sits above the main content area. It provides context and global actions.

Layout:
- Fixed height (48-56px)
- Full width of content area (not overlapping sidebar)
- Subtle bottom border

Left side:
- Breadcrumb or page title
  - Simple pages: Just title ("Bilty Book", "Settings")
  - Detail pages: "Bilty Book / #BLT-2024-0001" (clickable parent)
- Breadcrumb uses muted color, current page uses primary text

Right side:
- Global actions (contextual):
  - On Bilty list: "New Bilty" primary button
  - On Settings: None or "Save" when form is dirty
- Search trigger (optional for V1): Icon button that opens command palette
- User avatar (if not in sidebar, but prefer sidebar)

Mobile:
- Hamburger menu (left) replacing sidebar
- Page title (center)
- Primary action (right) if applicable

Keep it minimal — the top bar shouldn't compete with content.
```

### Prompt 4.3 — Page Layout Templates

```
Design page layout templates for different page types in the app.

Template 1 — List page (Bilty Book, Parties):
- Page header: Title + optional subtitle + primary action button
- Filters/search bar below header
- Data table taking remaining space
- Pagination at bottom (or infinite scroll with "Load more")

Template 2 — Form page (New Bilty, Edit Bilty):
- Page header with title and actions (Save, Cancel)
- Form content in a scrollable area
- Sections visually grouped with headings
- Sticky footer with primary actions (mobile) or actions in header (desktop)

Template 3 — Detail page (View Bilty):
- Page header with title, status badge, and actions (Edit, Print, Share)
- Content in sections: document preview, metadata, audit trail
- Sidebar with quick info (optional) or single column

Template 4 — Settings page:
- Page header with title
- Vertical tabs or sections (Company, Team, Preferences)
- Form content for active section
- Save indicator or auto-save with toast confirmation

Consistent patterns:
- Page header height and alignment
- Content max-width with centered alignment
- Consistent padding from edges
- Loading states (skeleton) for each template
```

---

## Phase 5: Bilty List (Main Workspace)

### Prompt 5.1 — Empty State

```
Design the empty state for the Bilty Book when a company has no biltys yet.

Layout:
- Centered in the content area
- Not too large (shouldn't feel like error page)

Content:
- Illustration: Simple line art of a document or receipt (subtle, not childish)
- Heading: "No biltys yet"
- Description: "Create your first bilty to get started. All your lorry receipts will appear here."
- Primary action: "Create your first bilty" button

Design notes:
- This is an encouraging state, not an error
- The button should be clearly the next step
- Subtle illustration, could be abstract shapes suggesting documents
- Consider showing keyboard shortcut hint: "or press N"

Also design empty state for search/filter with no results:
- "No biltys match your filters"
- "Try adjusting your search or filters"
- "Clear filters" link
```

### Prompt 5.2 — Bilty Table

```
Design the main bilty list table for daily use by transport company staff. This is the most-used screen in the app.

Table columns:
1. Bilty No. (monospace, e.g., #BLT-2024-0001) — primary identifier
2. Status badge (Draft/Issued/Cancelled)
3. Date (issue date or created date for drafts)
4. From → To (route, truncated with tooltip)
5. Consignor (party name, truncated)
6. Vehicle (number)
7. Amount (₹ formatted, right-aligned)
8. Actions (hover-reveal: View, Edit, Print icons)

Table features:
- Sortable columns: Date, Amount, Bilty No.
- Row click navigates to detail view
- Hover state: subtle background, show action icons
- Selected state (for future bulk actions): checkbox column
- Sticky header on scroll

Row density:
- Comfortable but dense (allow 20-25 visible rows on 1080p)
- No wasted vertical space
- Zebra striping optional (prefer hover-only distinction)

Status column:
- Badge with status color
- If Issued + Edited: show "Issued" badge with small "Edited" indicator

Special rows:
- Cancelled bilty: Entire row muted, strikethrough on bilty number optional

Loading state:
- Skeleton rows (6-8 rows of animated placeholders)

Mobile table:
- Card layout instead of table
- Each card shows: Bilty No., Status, Date, Route, Amount
- Tap to view
```

### Prompt 5.3 — Search and Filters

```
Design the search and filter bar for the Bilty Book.

Layout:
- Horizontal bar below page header
- Search input on left, filters on right

Search input:
- Icon inside field (search/magnifier)
- Placeholder: "Search by bilty no., party, route, vehicle..."
- Instant search (filter as you type, debounced)
- Clear button when has value
- Keyboard shortcut hint: "/" or "Cmd+K"

Filter controls:
- Status dropdown: All, Draft, Issued, Cancelled (multi-select optional)
- Date range: "Last 7 days", "Last 30 days", "This month", "Custom range"
- Custom date range picker when selected

Filter states:
- Default: Muted/ghost appearance
- Active filter: Visible indicator (dot, accent color, or count badge)
- Clear all filters: Link appears when any filter is active

Responsive:
- Desktop: All visible inline
- Tablet: Search full width, filters in dropdown/popover
- Mobile: Search with filter icon button that opens filter sheet

Design notes:
- Filters should feel fast, not like a complex form
- Show result count: "Showing 47 biltys" or "47 of 128 biltys"
- Filters persist in URL (shareable/bookmarkable state)
```

### Prompt 5.4 — Pagination

```
Design pagination for the bilty table. Default is 25 rows per page.

Layout:
- Below the table, right-aligned or centered
- Shows on any result set, even single page (for consistency)

Components:
- Page info: "Showing 1-25 of 128"
- Per-page selector: Dropdown with 25, 50, 100 options
- Page navigation: Previous/Next buttons with page numbers

Page numbers:
- Show first, last, current, and nearby pages
- Ellipsis for gaps: 1 ... 4 5 [6] 7 8 ... 15
- Current page highlighted

Button states:
- Previous disabled on first page
- Next disabled on last page
- Current page not clickable

Keyboard support:
- Arrow keys could navigate when table is focused (optional)

Mobile:
- Simplified: "Page 3 of 15" with Prev/Next buttons
- Swipe to paginate optional

Alternative: Infinite scroll with "Load more" button
- Shows "Loaded 50 of 128" count
- "Load more" button or auto-load on scroll
- Prefer pagination for now (easier to bookmark/share position)
```

---

## Phase 6: Bilty Form (Create/Edit)

### Prompt 6.1 — Form Structure Overview

```
Design the bilty creation/edit form. This is a dense data entry form used multiple times daily by transport office staff.

Page header:
- Title: "New Bilty" or "Edit Bilty #BLT-2024-0001"
- Status badge (on edit)
- Actions: "Save as Draft" (secondary), "Issue" (primary), "Cancel" (link)

Form sections (collapsible optional):
1. Route & Date
2. Consignor (from party)
3. Consignee (to party)
4. Goods & Packages
5. Vehicle & Driver
6. Charges
7. References (E-way bills, Invoices)
8. Additional Details (insurance, remarks)

Form layout:
- Single column on mobile
- Two columns on desktop where sensible (route from/to side by side)
- Section headers clearly separate concerns
- Progressive disclosure: show common fields, reveal advanced in accordions

Visual hierarchy:
- Required fields marked (asterisk or different styling)
- Labels above inputs (not inline/floating for clarity)
- Helper text where format is specific
- Error messages inline below fields

Sticky footer (mobile) or header actions (desktop):
- Always visible save/issue buttons
- Dirty state indicator if unsaved changes

Keyboard navigation:
- Tab through fields logically
- Enter in field doesn't submit (Ctrl+Enter or button click does)
```

### Prompt 6.2 — Party Selection Fields

```
Design the consignor/consignee selection UI. Users select from their address book or enter manually.

Two-column layout (desktop):
- Left: Consignor (From party)
- Right: Consignee (To party)

Party selection component:
- Combobox/autocomplete input
- Placeholder: "Search or select party..."
- Shows parties from address book as user types
- Dropdown shows: Party name, GSTIN (if available), phone
- "Add new party" option at bottom of dropdown

Selected state:
- Card/block showing selected party details:
  - Name (prominent)
  - Address
  - GSTIN (if available)
  - Phone
  - "Change" button to re-select
  - "Edit" link to modify details for this bilty only

Manual entry mode:
- Toggle or link: "Enter manually instead"
- Reveals form fields: Name, Address, GSTIN, Phone
- All editable inline

Party card design:
- Light background, subtle border
- Name in bold, other details in secondary text
- Compact but readable

Validation:
- Party name required
- Address required for issuance
- GSTIN format validation (15 chars, alphanumeric pattern)

Mobile:
- Stack vertically (consignor above consignee)
- Full-width party selection
```

### Prompt 6.3 — Goods and Weight Section

```
Design the goods/consignment section of the bilty form.

Fields:
- Goods description (textarea, required)
- Number of packages (numeric input)
- Packing type (text input or select: Bags, Cartons, Loose, etc.)
- Actual weight (numeric) + Unit selector (kg, quintal, tonne)
- Chargeable weight (optional, same unit)
- Volume in CBM (optional numeric with 2 decimals)
- Delivery type: Radio/toggle — Door delivery / Godown delivery

Layout:
- Packages and packing type side by side
- Actual weight with unit selector inline (number input + dropdown)
- Chargeable weight below or beside
- Volume as optional field (show with toggle or always visible)

Weight input design:
- Number input with unit dropdown attached (like currency input pattern)
- "1250 kg" or "12.5 tonnes"
- Unit selector: Compact dropdown (kg, quintal, tonne)
- Auto-conversion display optional

Goods description:
- Larger textarea (3-4 rows default)
- Character count optional
- Placeholder: "Description of goods being transported..."

Delivery type:
- Simple radio buttons or toggle switch
- "Door delivery" / "Godown delivery"
- Default based on company settings (if applicable)
```

### Prompt 6.4 — Vehicle and Driver Section

```
Design the vehicle and driver input section.

Fields:
- Vehicle number (text input, required for issuance)
- Vehicle type (optional text or select: Truck, Trailer, Container, etc.)
- Driver name (text input)
- Driver phone (phone input with validation)
- Driver license number (optional text input)

Layout:
- Vehicle number prominent (frequently searched field)
- Driver fields grouped together
- Two-column where sensible (name + phone side by side)

Vehicle number input:
- Uppercase transformation
- Indian vehicle format hint: "e.g., MH12AB1234"
- Consider autocomplete from recent vehicles (future enhancement)

Driver phone:
- Indian format: +91 or 10-digit
- Validation for 10-digit mobile numbers

Design notes:
- This section is simpler than parties
- Vehicle number is a key identifier, make it easy to scan
- Driver details are secondary but required for some operations
```

### Prompt 6.5 — Charges Section

```
Design the charges/financial section of the bilty form. This handles money and must be precise.

Fields:
- Freight type: Radio buttons — Paid, To Pay, Billed
- Freight amount (money input, required)
- Loading charges (money input, optional)
- Unloading charges (money input, optional)
- Statistical charges (money input, optional)
- Express charges (money input, optional)
- Other charges (money input, optional)
- Grand Total (calculated, read-only, prominent)

Money input design:
- Rupee symbol (₹) prefix
- Thousand separators (12,450.00)
- Right-aligned numbers
- 2 decimal places for paise
- Monospace font for alignment

Layout:
- Freight type selector prominent at top
- Charges in a compact table/list format:
  | Freight          | ₹ [______] |
  | Loading          | ₹ [______] |
  | Unloading        | ₹ [______] |
  | Statistical      | ₹ [______] |
  | Express          | ₹ [______] |
  | Other            | ₹ [______] |
  |------------------|------------|
  | Grand Total      | ₹ 12,450.00 |

Grand total:
- Calculated automatically as sum
- Bold, larger text
- Read-only (not editable)
- Updates in real-time as charges change

Validation:
- Non-negative amounts only
- Max value validation (per PRD: 99,999,999,999 paise = ₹999,99,99,999.99)
- Freight amount required for issuance

Freight type visual:
- Segmented control or radio buttons
- Clear active state
- "Paid" = collected from consignor
- "To Pay" = collect from consignee
- "Billed" = invoice later
```

### Prompt 6.6 — References Section (E-way Bills, Invoices)

```
Design the references section for e-way bills and goods invoices. A bilty can have multiple of each.

E-way Bill References:
- Heading: "E-way Bills" with "Add" button
- List of e-way bill numbers (can be empty)
- Each item: 12-digit number input with remove button
- Validation: exactly 12 digits, numeric only, unique within bilty
- "Add e-way bill" link/button below list

Invoice References:
- Heading: "Invoices" with "Add" button
- Each invoice has:
  - Invoice number (text, required, unique within bilty)
  - Invoice date (date picker, optional)
  - Declared value (money input, optional)
- "Add invoice" link/button

Add interaction:
- Click "Add" → new empty row appears
- Focus moves to new input
- Empty rows auto-remove on blur (or explicit remove)

Remove interaction:
- X button on each row
- Immediate removal (no confirmation for empty rows)
- Confirm for rows with data optional

Layout:
- Each section in its own card/box
- Compact rows for references
- E-way bills: Single column of inputs
- Invoices: Three columns (number, date, value) or stacked on mobile

Empty state:
- "No e-way bills added" with "Add" link
- "No invoices added" with "Add" link

Validation errors:
- Inline: "Must be exactly 12 digits"
- Inline: "Duplicate invoice number"
```

### Prompt 6.7 — Edit Mode Specifics

```
Design the additional UI needed when editing an existing bilty (vs. creating new).

Page header changes:
- Title: "Edit Bilty #BLT-2024-0001"
- Status badge showing current status
- For issued biltys: Warning notice about audit trail

Edit reason (for issued biltys):
- Required text field: "Reason for edit"
- Helper: "This will be recorded in the audit trail"
- Appears above save button or as modal on save
- Only required when editing issued bilty, not drafts

Version conflict handling:
- If another user edited while you were editing:
- Modal: "This bilty was updated by [name] at [time]"
- Options: "Review changes" / "Overwrite anyway" / "Discard my changes"
- Review changes: Show diff of what changed

Read-only fields on issued bilty:
- Bilty number (never editable)
- Issue date (locked after issuance)
- Issued by (locked)

Visual indicators:
- Subtle banner: "Editing issued bilty — changes will be audited"
- Different background tint for issued bilty edit mode (optional)

Cancel button behavior:
- If form is dirty: Confirm dialog
- "You have unsaved changes. Discard?"
- Options: "Keep editing" / "Discard changes"
```

---

## Phase 7: Bilty Detail View

### Prompt 7.1 — Document Header and Actions

```
Design the header section for viewing a single bilty. This page shows the complete bilty with print/share options.

Page header:
- Back link: "← Bilty Book" (returns to list)
- Bilty number: "#BLT-2024-0001" (large, monospace)
- Status badge: Draft / Issued / Cancelled
- If edited: "Edited" indicator badge
- Dates: "Issued: 15 Sep 2024 • Created: 14 Sep 2024"

Action buttons (right side of header):
- Primary: "Edit" (for drafts and issued non-cancelled)
- Secondary: "Print" (dropdown: A4, 80mm thermal)
- Secondary: "Share" (opens share dialog)
- Danger: "Cancel Bilty" (for issued biltys, with confirmation)

Cancelled bilty header:
- Status badge prominent: Red "Cancelled" badge
- Cancellation info: "Cancelled on 16 Sep 2024 by [name]"
- Reason shown: "Duplicate entry"
- Actions: Disabled edit, "Print" still available (shows cancelled watermark)

Draft bilty header:
- "Draft" badge (amber)
- Primary action: "Issue" button (prominent)
- Secondary: "Edit", "Delete Draft"
- No share/print for drafts (or disabled with tooltip)

Mobile layout:
- Bilty number and status stacked
- Actions in bottom sticky bar or overflow menu
```

### Prompt 7.2 — Document Content Display

```
Design the bilty document display for screen viewing (not print). This shows all bilty data in a readable format.

Document container:
- Card/panel with subtle elevation
- White/light background (even in dark mode for document feel)
- Max-width constrained, centered
- Print-preview feeling but optimized for screen

Document sections:

1. Header band:
   - Company logo (left)
   - "BILTY / LORRY RECEIPT" title (center)
   - Bilty number and date (right)
   - Status watermark for Draft/Cancelled

2. Route block:
   - From: [Origin city/location]
   - To: [Destination city/location]
   - Visual connector (line or arrow)

3. Parties block (two columns):
   - Consignor (left): Name, Address, GSTIN, Phone
   - Consignee (right): Same fields
   - Clear labels above each

4. Consignment details:
   - Goods description
   - Packages: "25 Bags"
   - Weight: "1,250 kg (Chargeable: 1,300 kg)"
   - Volume: "2.5 CBM"
   - Vehicle: "MH12AB1234"
   - Driver: "Name, Phone"

5. Charges table:
   - Two columns: Description | Amount
   - All charge items
   - Grand Total row (bold, larger)

6. References:
   - E-way bills: Listed with numbers
   - Invoices: Number, date, value per row

7. Footer:
   - Copy label indicator (if applicable)
   - Terms reference

Design notes:
- Monospace for numbers, amounts, dates, references
- Clear visual grouping
- Not just raw data dump — structured like a document
- Should feel like a digital version of the paper form
```

### Prompt 7.3 — Audit Trail

```
Design the audit trail display for bilty version history. Shown below the document or in a separate tab.

Section header:
- "History" or "Audit Trail"
- Collapse/expand toggle for long histories

Timeline layout:
- Vertical timeline with events
- Most recent at top
- Connected line between events

Event types:
1. Created: "Created as draft" — timestamp, actor
2. Issued: "Issued as #BLT-2024-0001" — timestamp, actor
3. Edited: "Edited" — timestamp, actor, reason, what changed
4. Cancelled: "Cancelled" — timestamp, actor, reason

Event card design:
- Icon indicating type (plus, checkmark, pencil, x)
- Actor name
- Relative timestamp: "2 hours ago" with full date on hover
- For edits: Expandable "View changes" showing diff

Changes display (for edits):
- Simple diff format:
  "Freight: ₹10,000 → ₹12,000"
  "Consignor address: [old] → [new]"
- Or side-by-side for complex changes

Timeline visual:
- Vertical line connecting events
- Circle/dot for each event
- Status-colored: Green (issue), Blue (edit), Red (cancel), Gray (create)

Compact mode:
- Show last 3 events, "Show all" link for more
- Or scrollable container with fixed height

Mobile:
- Full-width cards, vertical stacking
- Same timeline metaphor but adapted
```

### Prompt 7.4 — Share Dialog

```
Design the PDF sharing dialog for generating WhatsApp-shareable links.

Dialog trigger:
- "Share" button in bilty detail header
- Only available for issued (non-cancelled) biltys

Dialog content:
- Title: "Share Bilty #BLT-2024-0001"
- Subtitle: "Generate a link to share this bilty as PDF"

Options:
- Format: Radio buttons — A4 / 80mm (thermal)
- Expiry: Dropdown — 1 day, 3 days, 7 days (default)
- Copy: Radio buttons — Consignor / Consignee / Driver / Office

Generate action:
- "Generate Link" button
- On click: Shows loading, then generated link

Generated state:
- Link text box with copy button
- "Link expires in 7 days"
- "Share via WhatsApp" button (opens WhatsApp with pre-filled message)
- "Generate another" link to reset

Active shares section:
- Below generator, if shares exist
- "Active Links" heading
- Table: Created date, Expiry, Copy type, Revoke button
- Revoke confirms: "This will invalidate this link immediately"

Empty state:
- "No active links"

Security note (subtle):
- "Shared PDFs show a fixed version. Edits create new versions."
- Or just tooltip on info icon

Dialog size:
- Medium width (400-500px)
- Scrollable if many active links
```

---

## Phase 8: Parties (Address Book)

### Prompt 8.1 — Parties List

```
Design the Parties/Address book page. This manages consignors and consignees used in biltys.

Page header:
- Title: "Parties"
- Subtitle: "Manage your consignors and consignees"
- Primary action: "Add Party" button

Search:
- Search input: "Search by name, GSTIN, or phone..."
- Instant filtering

Table columns:
1. Name — party name (primary identifier)
2. Role — "Consignor" or "Consignee" badge
3. GSTIN — formatted or "—" if not set
4. Phone — phone number
5. City — extracted from address or separate field
6. Status — "Active" / "Archived" badge
7. Actions — Edit, Archive (hover reveal)

Table features:
- Sortable by name
- Filter by role (All / Consignors / Consignees)
- Filter by status (Active / Archived) — default Active only
- Row click opens edit dialog or side panel

Empty state:
- "No parties yet"
- "Add your first party to quickly select them when creating biltys"
- "Add Party" button

Archived parties:
- Muted row styling
- "Restore" action instead of "Archive"
- Helper: "Archived parties can still be viewed on existing biltys"
```

### Prompt 8.2 — Party Form (Add/Edit)

```
Design the add/edit party form. Can be a dialog/modal or side panel.

Form fields:
- Party name (required)
- Role: Radio — Consignor / Consignee / Both
- Address (textarea, required)
- City (optional, for easier searching)
- GSTIN (optional, 15-char validation)
- PAN (optional, 10-char validation)
- Phone (optional, 10-digit validation)
- Email (optional, email validation)

Form layout:
- Single column
- Dialog: 400-450px width
- Or slide-in panel from right (500px)

Role selection:
- Radio buttons or segmented control
- "Consignor", "Consignee", "Both"
- "Both" allows party to be used in either field

Validation:
- Real-time inline validation
- GSTIN format: 2 digits + 10 alphanumeric + 1 digit + 1 alpha + 1 check digit
- PAN format: 5 alpha + 4 digits + 1 alpha

Actions:
- "Save" primary button
- "Cancel" link/button
- For edit: "Archive" danger link (bottom, separate from main actions)

Success:
- Close dialog
- Show toast: "Party added" / "Party updated"
- List refreshes to show new/updated party
```

---

## Phase 9: Settings

### Prompt 9.1 — Settings Page Structure

```
Design the Settings page structure. Contains company profile and preferences.

Navigation:
- Vertical tabs or section links on left (desktop)
- Full-width accordion sections (mobile)

Sections:
1. Company Profile — logo, name, address, tax IDs
2. Print Settings — default layout, copy labels, terms
3. Notifications — email preferences (future)
4. Theme — light/dark mode toggle

Layout:
- Left: Section navigation (200px)
- Right: Active section content (remaining width, max-width constrained)

Section design:
- Section title
- Description text
- Form fields grouped logically
- "Save" button per section or auto-save

Auto-save option:
- Instead of explicit save buttons
- "Saving..." indicator on change
- "Saved" confirmation
- Or "You have unsaved changes" with single Save button

Mobile:
- Tab bar at top or accordion sections
- Full-width forms
```

### Prompt 9.2 — Company Profile Form

```
Design the Company Profile settings section.

Fields grouped:

Basic Information:
- Company name (text input)
- Company address (textarea)
- Phone number
- Email

Tax Information:
- GSTIN (formatted input with validation)
- PAN (formatted input with validation)

Branding:
- Logo upload zone
  - Current logo preview (if set)
  - "Upload new" or drag-drop zone
  - "Remove" link if logo exists
  - Supported: PNG, JPEG, max 2MB
  - Preview: Square crop or contain within bounds

Bank Details (for print on bilty):
- Bank name
- Account number
- IFSC code
- Account holder name
- (Or single textarea for flexibility)

Legal/Print Settings:
- Jurisdiction (text: "Courts at [City]")
- Carriage terms (textarea)
- Demurrage terms (textarea)

Layout:
- Logical groupings with subtle dividers or spacing
- Not all fields mandatory — save partial state
- Helper text for format expectations
```

### Prompt 9.3 — Team Management (Admin Only)

```
Design the Team management page. Only visible to company admins. Manages employee access.

Page header:
- Title: "Team"
- Subtitle: "Manage who can access your company's biltys"
- Primary action: "Invite Member" button

Team table:
- Columns: Name, Email, Role (Admin/Member), Status (Active/Pending), Joined, Actions
- Current user row highlighted: "You" badge
- Admin badge for admins, Member badge for members

Pending invitations:
- Status: "Pending" with timestamp
- Actions: "Resend invite", "Revoke"
- Visually distinct: Muted or different background

Active members:
- Actions: "Change role" (dropdown), "Remove" (if not self)
- Can't remove yourself
- Can't demote last admin

Invite dialog:
- Email input (required, valid email)
- Role selector: Admin / Member
- "Send Invitation" button
- Helper: "They'll receive an email with a link to join"

Role change:
- Inline dropdown or click-to-edit
- Confirm for admin → member demotion

Remove member:
- Confirm dialog: "Remove [name] from your team?"
- "They will lose access to all company biltys immediately."
- "Remove" danger button

Empty state (no team members except self):
- "You're the only team member"
- "Invite your team to collaborate on biltys"
- "Invite Member" button
```

---

## Phase 10: Responsive and Mobile Considerations

### Prompt 10.1 — Mobile Navigation

```
Design the mobile navigation pattern for viewport < 768px.

Option A — Bottom tab bar:
- 4-5 tabs maximum
- Icons with labels below
- Active state: Accent color fill
- Tabs: Biltys, Parties, Settings, (Profile/Account)
- Consistent across all pages

Option B — Hamburger slide-out:
- Hamburger icon in top-left
- Slides in from left
- Overlay on content
- Same nav items as desktop sidebar
- Close on item tap or tap outside

Recommendation: Bottom tabs for this app
- Primary workflows are distinct pages
- Users switch between them frequently
- Feels more native/app-like

Top bar (mobile):
- Page title (center)
- Menu/back icon (left)
- Primary action icon (right) — e.g., + for new bilty

Gesture support (optional):
- Swipe from left edge opens nav (if hamburger)
- Swipe right to go back (if appropriate)
```

### Prompt 10.2 — Mobile Table/List Patterns

```
Design mobile-friendly alternatives to data tables.

Card list (for bilty list, parties):
- Each record as a card
- Key info visible: Primary ID, status, date, amount
- Tap to navigate to detail
- Swipe actions optional (archive, delete)

Card layout for bilty:
- Top row: "#BLT-2024-0001" + Status badge
- Second row: "15 Sep 2024"
- Third row: "Chennai → Mumbai"
- Fourth row: "₹12,450"
- Right side: Chevron indicating tap-to-view

Card layout for party:
- Name (bold)
- Role badge
- GSTIN or phone below
- Tap to edit

Filtering on mobile:
- Search input always visible
- Filters in bottom sheet, triggered by filter icon
- Applied filters shown as chips below search
- "Clear all" link when filters active

Pagination:
- "Load more" button at bottom (infinite scroll feel)
- Or simple prev/next with page number

List performance:
- Virtualized list if many items
- Skeleton loading for initial load
- Pull-to-refresh gesture
```

### Prompt 10.3 — Mobile Form Patterns

```
Design mobile-optimized form patterns for bilty creation.

Full-screen form:
- Form takes full viewport
- No sidebar distractions
- Sticky header with back arrow, title, action button
- Sticky footer with primary action (optional redundancy)

Sections as steps (optional wizard):
- Progress indicator at top
- One section per screen
- "Next" / "Back" navigation
- Review step before submission
- Or: All sections visible, scroll-based with sticky section headers

Section collapse:
- Each section as expandable accordion
- Completed sections show summary when collapsed
- Active section expanded

Input optimizations:
- Large touch targets (44px minimum height)
- Appropriate keyboard types: numeric, email, tel
- Auto-advance to next field on valid entry (optional)
- Clear button on text inputs

Party selection (mobile):
- Full-screen search sheet
- List of parties with search
- Tap to select and return
- "Add new" option

Date picker:
- Native date picker or custom calendar sheet
- Should respect device locale

Money input:
- Numeric keyboard with decimal
- Large digits for easy entry
- Real-time formatting
```

---

## Usage Notes for Designer

### Working progressively:
1. Start with Design System (Phase 1) — establish tokens
2. Build Auth screens (Phase 2) — simple pages, set the tone
3. Build App Shell (Phase 4) — establish navigation patterns
4. Build core workflow: List → Form → Detail (Phases 5-7)
5. Add supporting pages: Parties, Settings (Phases 8-9)
6. Refine responsive patterns throughout

### Key design principles to maintain:
- **Keyboard-first**: Power users will use keyboard shortcuts
- **Dense but readable**: Show more data, use space efficiently
- **Status is visible**: Badge every bilty, clear lifecycle indication
- **Numbers are monospace**: Financial data, IDs, dates
- **Fast perceived speed**: Skeleton states, instant feedback
- **Professional, not playful**: This is daily work software, not a consumer app

### Reference apps to study:
- **Linear**: Navigation, density, keyboard shortcuts, speed feel
- **Notion**: Typography, content hierarchy, spacing
- **QuickBooks**: Form patterns, financial data display, business tone
- **Stripe Dashboard**: Clean data tables, professional polish

### Avoid:
- Generic "modern startup" aesthetics
- Excessive whitespace that reduces data density
- Playful illustrations or animations
- Complex hover states that don't work on touch
- Tiny click targets
- Hiding important actions in menus
