# ISG App MVP (Phase 1)

This is a local visual MVP for your single-app workflow.

## Run locally
From this folder:

```bash
python3 dev_server.py
```

Then open:

`http://localhost:4173`

## What this MVP includes
- Staff Board lanes
- Owner issues view
- Job Detail view
- Alerts view
- Job Intake placeholder

## Next step (backend wiring)
Connect these views to Google Sheet data via Apps Script Web App endpoints:
- `GET /jobs`
- `GET /jobs/:jobNo`
- `POST /jobs`
- `PATCH /jobs/:jobNo`
- `GET /alerts`
- `POST /batches/printstation`
- `POST /batches/ink`

## Note
This MVP is UI-first and dependency-free to keep setup simple on your machine.
`dev_server.py` includes a local `/api` proxy to avoid browser CORS issues when calling Apps Script.

## SA Printer Coverage Workflow (Cartridge Finder data quality)

Use this when maintaining the printer/cartridge master so coverage is measurable and predictable.

### 1) Create source files from templates

Copy templates in [`data/`](/Users/natascherobarts/Documents/New project 2/isg-app-mvp/data):

- [`printer_catalog_sa_template.csv`](/Users/natascherobarts/Documents/New project 2/isg-app-mvp/data/printer_catalog_sa_template.csv) -> `printer_catalog_sa.csv`
- [`printer_consumable_map_template.csv`](/Users/natascherobarts/Documents/New project 2/isg-app-mvp/data/printer_consumable_map_template.csv) -> `printer_consumable_map.csv`

Keep watchlist in:

- [`top_sa_printers_watchlist.csv`](/Users/natascherobarts/Documents/New project 2/isg-app-mvp/data/top_sa_printers_watchlist.csv)

### 2) Run coverage check

```bash
python3 scripts/check_sa_coverage.py
```

Outputs:

- `data/report_unmapped_catalog.csv` (retailer models missing consumable mapping)
- `data/report_missing_watchlist.csv` (high-priority models still missing)

### 3) Update app dataset from workbook

```bash
python3 scripts/build_printer_master_dataset.py \
  "/path/to/MASTER_DATABASE_WITH_SUPPLIER_EQUIVALENTS_CLEAN.xlsx" \
  "printer_master_dataset.json"
```

This rebuilds the finder dataset including supplier-compatible SKUs where available.
