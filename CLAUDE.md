# ISG App — Claude Context

## What this is
Staff-facing operations web app for ISG Lengarry (print/signage shop). Vanilla JS single-page app.

## Key files
- `app.js` — all logic (products, pricing, UI, job intake, spec schemas)
- `index.html` — app shell
- `styles.css` — all styling

## GitHub
Remote: `https://github.com/isglengarry-ui/ISG-App.git` (branch: `main`)
**Always push after changes.**

## Architecture to know before editing

**Products & pricing**
- Outsourced/Printstation products: `getCustomPriceListProducts_()` (~line 144)
- In-house products: `DEFAULT_PRICE_CATALOG` (~line 107)
- Pricing functions: `calculateCustomCarMagnetsQuote_`, `calculateCustomXBannersQuote_`, etc.
- `interpolateTierPrice_(tierMap, qty)` — interpolates between quantity price tiers

**Job intake spec fields**
- Defined in `SPEC_SCHEMAS` object — sections: `inhouse`, `outsourced`, `sublimation`
- Each product key maps to an array of field definitions (`id`, `label`, `type`, `options`, optional `showWhen`)
- Rendered by `renderSpecQuestions_()`, composed to text by `composeSpecsFromQuestions_()`

**Job intake UI**
- In-house product type: searchable combobox (`#ji-inhouse-search-wrap`) backed by hidden `<select id="ji-inhouse-type">`
- Outsourced product type: same pattern (`#ji-outsourced-search-wrap` / `#ji-outsourced-type`)
- Sublimation sub-products: `<select id="ji-sublimation-product">` + `#ji-sublimation-spec-fields`
- Hydration (restoring draft): `hydrateIntakeDraft_()` — add new field IDs to the `ids` array there

**Pricelist UI (owner)**
- Flow fields rendered by `renderFlow()` inside the pricelist panel closure
- Custom dimension inputs (e.g. car magnets, canvas): injected in HTML template, wired in the block after `renderFlow()`
- `readAnswers()` — reads all field values; add custom field reads here
- `calculate()` — validates and runs pricing; add missing-field checks here

## Recent changes (this session — 2026-07-03)
- Added Mouse Pad to sublimation products
- Custom size option for Car Magnets in pricelist (area interpolation, max 800×600mm)
- Job intake product type dropdowns replaced with searchable comboboxes (searches all pricelist products)
- Car Magnets added to `SPEC_SCHEMAS.inhouse` with size, quantity (pairs), and artwork versions fields

## Syntax check before committing
```
node --check app.js
```
