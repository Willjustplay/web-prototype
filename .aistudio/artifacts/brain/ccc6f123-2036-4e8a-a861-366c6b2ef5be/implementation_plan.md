# Compact High-Density Product Catalog & Popup Plan

## 1. Overview & Goals
Redesign both the homepage store catalog grid (`#katalog`) and the product detail checkout popup (`ProductModal`) so cards and popup views are significantly smaller, cleaner, and capable of fitting many products on screen at once.

## 2. Planned Changes

### A. High-Density Catalog Grid (`/src/components/Catalog.jsx`)
- **Multi-Column Responsive Grid (`data-testid="catalog-grid"` & `data-testid="catalog-loading"`)**:
  - Upgrade grid columns to **2–3 columns on mobile** (`grid-cols-2` / `grid-cols-3` via the mobile layout toggle), **3–4 columns on tablet** (`sm:grid-cols-3 md:grid-cols-4`), and **5–6 columns on desktop** (`lg:grid-cols-5 xl:grid-cols-6`) with tight spacing (`gap-2 sm:gap-2.5 lg:gap-3`).
- **Compact Product Card Anatomy**:
  - **Thumbnail**: Compact `aspect-[16/10]` frame with a small top-left status/promo badge (`text-[8px] px-1.5 py-0.5`), a compact top-right wishlist button (`w-6 h-6`), and a minimal bottom-right gallery counter.
  - **Essential Card Body**: Tighter padding (`p-2.5 pb-1.5`) displaying only the unboxed **Game Tag** + **Condition/Status** line and a 2-line **Product Title** (`text-[11px] sm:text-xs leading-snug`).
  - **Streamlined Price Footer**: Compact bottom bar (`px-2.5 pb-2.5 pt-1.5`) showing the primary **IDR Price** (`text-xs sm:text-[13px] font-mono font-bold text-neon`) and a compact `w-6 h-6` action arrow, removing secondary rating/sold/USD clutter from the small card surface while preserving `data-testid` attributes for compatibility.

### B. Compact Product Popup with Multi-Product Quick Switcher (`/src/components/ProductModal.jsx` & `/src/pages/Home.jsx`)
- **Smaller Modal Footprint**:
  - Reduce modal container width from `max-w-4xl` to `max-w-2xl sm:max-w-3xl` with tighter internal padding (`p-3 sm:p-4`) and a more compact media column (`md:col-span-5` media + `md:col-span-7` checkout) so the popup fits comfortably without scrolling on desktop.
  - Tighten spec bar, input heights (`py-2`), payment tabs, and action buttons (`py-2.5`) for a crisp, high-density layout.
- **In-Popup Multi-Product Grid/Strip**:
  - Pass `products` and `onSelectProduct` from `/src/pages/Home.jsx` to `<ProductModal />`.
  - Add a compact scrollable/grid **"Other Products"** mini-selector inside the popup so users can browse and switch across many products directly inside the popup without closing and reopening it.

## 3. Verification
- Run `lint_applet` and `compile_applet` to verify zero TypeScript or build errors.
- Confirm all existing `data-testid` hooks remain intact for automated and interactive flows.
