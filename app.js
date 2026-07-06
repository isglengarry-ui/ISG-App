const API = {
  baseUrl: "https://script.google.com/macros/s/AKfycbyljCckXtpPj-D38P3KODmfzt4iW0vWcXfI1BWB12kypmBdHV762xGJDiwr4FqPDKLB-Q/exec",
  key: "ISG2026",
};

const OWNER_ACCESS_KEY = "ISG_OWNER_UNLOCKED";
const OWNER_PASSCODE = "ISG2026-OWNER";

const ISG_ROLE_KEY = "ISG_ROLE";
const ISG_STAFF_KEY = "ISG_STAFF_NAME";
const ISG_COMM_LOG_KEY = "ISG_COMM_LOG";
const ISG_PAYMENT_METHODS_KEY = "ISG_PAYMENT_METHODS_V1";
const ISG_POSTER_PRICES_KEY = "ISG_POSTER_PRICES_V1";
const STAFF_NAMES_ = ["Chad", "Toufiecka", "Faith", "Wesley", "Ingrid", "Natasché"];
const state = {
  role: (() => { try { return localStorage.getItem(ISG_ROLE_KEY) || "staff"; } catch (_e) { return "staff"; } })(),
  staffName: (() => { try { return localStorage.getItem(ISG_STAFF_KEY) || ""; } catch (_e) { return ""; } })(),
  tab: "staff_board",
  selectedJobNo: "ISG-000047",
  cleanMode: false,
  jobs: [],
  loading: true,
  error: "",
  saving: false,
  saveMessage: "",
  searchQuery: "",
  intakeDraft: {},
  ownerUnlocked: false,
  cartridgeIndex: null,
  cartridgeProducts: null,
  compatibilityMaster: null,
  trinkLookup: null,
  printerMaster: null,
  printerCatalog: null,
  printerConsumableMap: null,
  pricingSettings: null,
  pricingSettingsSyncAttempted: false,
  pricingSaveMessage: "",
  reportFilters: {
    from: "",
    to: "",
    staff: "ALL",
    category: "ALL",
    product: "ALL",
    includeCompleted: true,
  },
  printstationPricebook: null,
  printstationPricebookLoadPromise: null,
  priceAdjustments: null,
  priceCostSettings: null,
  lastRefresh: null,
  savingJobNos: new Set(),
  recentSaves: {},
  actions: [],
  actionsLoading: false,
  actionsFilter: { status: "all", category: "all", priority: "all" },
  actionsNewForm: false,
  staffBoardFilter: "ALL",
  ownerSelectedJobNo: "",
};
let silentRefreshTimer = null;
// If the persisted role is owner/admin but no session unlock exists, silently
// revert to staff. The owner can switch via the role dropdown (which prompts
// per-tab). This avoids surprising staff or anyone opening a fresh tab.
if ((state.role === "owner" || state.role === "admin") && !isOwnerUnlocked_()) {
  state.role = "staff";
}
state.ownerUnlocked = isOwnerUnlocked_();

const ACTIONS_LAST_VISIT_KEY    = "ISG_ACTIONS_LAST_VISIT";
const VINYL_PRICING_STORAGE_KEY  = "ISG_VINYL_PRICING_SETTINGS";
const CANVAS_PRICING_STORAGE_KEY = "ISG_CANVAS_PRICING_SETTINGS";
const PRICE_LIST_STORAGE_KEY = "ISG_PRICE_LIST_V1";
const PRICE_ADJUSTMENTS_STORAGE_KEY = "ISG_PRICE_ADJUSTMENTS_V1";
const PRICE_COST_SETTINGS_STORAGE_KEY = "ISG_PRICE_COST_SETTINGS_V1";
const PRINTSTATION_PRICEBOOK_FILE = "./data/printstation_pricebook_snapshot.json";
const DEFAULT_VINYL_PRICING_SETTINGS = {
  retailPerM2InclVat: 490,
  minimumCharge: 240,
  roundToNearest: 5,
  wastePercent: 12,
  setupFee: 0,
  laborFee: 0,
  markupPercentExVat: 0,
  vatPercent: 15,
  inkCostPerMl: 0,
  inkMlPerM2: 0,
  rollWidthMm: 1370,
  rollLengthM: 50,
  rollCost: 0,
};
state.pricingSettings = loadLocalPricingSettings_() || { ...DEFAULT_VINYL_PRICING_SETTINGS };

const DEFAULT_CANVAS_PRICING_SETTINGS = {
  inkCostPerMl:         16,  // R per ml of ink
  inkMlPerM2:           12,  // ml ink used per m² of print area
  canvasCostPerM2:      85,  // R per m² of canvas media (incl. VAT)
  rollWidthMm:         610,  // physical roll width — full width consumed per print
  mountingAllowanceMm:  80,  // extra canvas on each end (top & bottom) for mounting
  frameCostA1:         149,  // R per frame — A1
  frameCostA2:          79,
  frameCostA3:          31,
  frameCostA4:          20,
  frameCostA5:          11,
};
state.canvasPricingSettings = loadLocalCanvasPricingSettings_() || { ...DEFAULT_CANVAS_PRICING_SETTINGS };

const DEFAULT_PRICE_CATALOG = {
  products: [
    {
      id: "business_cards",
      label: "Business Cards",
      category: "In-house",
      flow: [
        { key: "quantity", label: "Quantity", type: "select", options: [100, 200, 300, 500, 1000, 2000, 5000] },
        { key: "size", label: "Size", type: "select", options: ["90 x 50 mm", "85 x 55 mm"] },
        { key: "sides", label: "Sides", type: "select", options: ["Single Sided", "Double Sided"] },
        { key: "paper", label: "Paper", type: "select", options: ["350gsm Matt", "350gsm Gloss"] },
        { key: "finish", label: "Finish", type: "select", options: ["None", "Gloss OPP", "Matte OPP"] },
        { key: "turnaround", label: "Turnaround", type: "select", options: ["Standard", "Express"] },
      ],
      pricing: {
        quantityBaseInclVat: {
          100: 190,
          200: 285,
          300: 365,
          500: 520,
          1000: 880,
          2000: 1540,
          5000: 3320,
        },
        modifiers: {
          size: { "90 x 50 mm": 1, "85 x 55 mm": 1.06 },
          sides: { "Single Sided": 1, "Double Sided": 1.34 },
          paper: { "350gsm Matt": 1, "350gsm Gloss": 1.05 },
          finish: { "None": 1, "Gloss OPP": 1.22, "Matte OPP": 1.22 },
          turnaround: { "Standard": 1, "Express": 1.22 },
        },
        roundToNearest: 5,
      },
    },
  ],
};

function getCustomPriceListProducts_() {
  return [
    {
      id: "isg_standard_printing",
      slug: "isg-standard-printing",
      name: "Standard Printing",
      templateType: "isg_standard_printing",
      flowFields: [
        {
          key: "size",
          label: "Paper Size",
          options: [
            { value: "A4", label: "A4" },
            { value: "A3", label: "A3" },
            { value: "SRA3", label: "SRA3" },
          ],
        },
        {
          key: "sides",
          label: "Sides",
          options: [
            { value: "Single Sided", label: "Single-Sided" },
            { value: "Double Sided", label: "Double-Sided" },
          ],
        },
        {
          key: "colour",
          label: "Colour",
          options: [
            { value: "Black & White", label: "Black & White" },
            { value: "Colour", label: "Colour" },
          ],
        },
        {
          key: "lamination",
          label: "Lamination",
          options: [
            { value: "None", label: "None" },
            { value: "Pouch 150mic", label: "Pouch 150mic" },
            { value: "Pouch 250mic", label: "Pouch 250mic" },
            { value: "OPP Laminating", label: "OPP Laminating" },
            { value: "Roll Encapsulation", label: "Roll Encapsulation" },
          ],
        },
        {
          key: "binding",
          label: "Binding",
          options: [
            { value: "None", label: "None" },
            { value: "Staple", label: "Staple (free)" },
            { value: "Comb Bind", label: "Comb Bind" },
          ],
        },
        {
          key: "qty",
          label: "Quantity (pages)",
          type: "number",
          min: 1,
          placeholder: "Number of pages",
        },
        {
          key: "num_booklets",
          label: "Number of Booklets",
          type: "number",
          min: 1,
          placeholder: "Number of booklets",
          showWhen: { field: "binding", equals: "Comb Bind" },
        },
      ],
    },
    {
      id: "isg_fridge_calendars_magnets",
      slug: "isg-fridge-calendars-magnets",
      name: "Fridge Calendars & Fridge Magnets",
      url: "https://printstation.co.za/shop/fridge-calendars-a5/",
      basePriceInclVat: 335,
      templateType: "isg_custom_fridge",
      flowFields: [
        {
          key: "product_type",
          label: "Product Type",
          options: [
            { value: "fridge_calendar", label: "Fridge Calendar" },
            { value: "fridge_magnet", label: "Fridge Magnet" },
          ],
        },
        {
          key: "size",
          label: "Size",
          options: [
            { value: "dl", label: "DL" },
            { value: "90x90", label: "90 x 90 mm" },
            { value: "a6", label: "A6" },
            { value: "a5", label: "A5" },
            { value: "a4", label: "A4" },
            { value: "custom", label: "Custom Size" },
          ],
        },
        {
          key: "qty",
          label: "Quantity",
          options: [
            { value: "50", label: "50" },
            { value: "100", label: "100" },
            { value: "250", label: "250" },
            { value: "500", label: "500" },
            { value: "1000", label: "1000" },
          ],
        },
        {
          key: "orientation",
          label: "Orientation",
          options: [
            { value: "portrait", label: "Portrait" },
            { value: "landscape", label: "Landscape" },
          ],
        },
        {
          key: "print_sides",
          label: "Print Sides",
          options: [
            { value: "one_side", label: "1 Side" },
            { value: "two_sides", label: "2 Sides" },
          ],
        },
        {
          key: "finish",
          label: "Finish",
          options: [
            { value: "none", label: "No Lamination" },
            { value: "gloss", label: "Gloss Lamination" },
            { value: "matt", label: "Matt Lamination" },
          ],
        },
        {
          key: "magnet_type",
          label: "Magnet Type",
          options: [
            { value: "strip", label: "Strip Magnet" },
            { value: "full_sheet", label: "Full-Sheet Magnet" },
          ],
        },
        {
          key: "time",
          label: "Turnaround",
          options: [
            { value: "0", label: "7 Business Days" },
            { value: "1", label: "5 Business Days" },
            { value: "2", label: "3 Business Days" },
          ],
        },
        {
          key: "versions",
          label: "Artwork Versions",
          options: [
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3+" },
          ],
        },
      ],
      pricingData: {
        template_type: "isg_custom_fridge",
        quantities: ["50", "100", "250", "500", "1000"],
        default_turnaround: "0",
      },
    },
    {
      id: "isg_car_magnets",
      slug: "isg-car-magnets",
      name: "Car Magnets",
      url: "https://printstation.co.za/shop/car-magnets/",
      basePriceInclVat: 150,
      templateType: "isg_custom_car_magnets",
      flowFields: [
        { key: "qty", label: "Sold In Pairs", options: ["1", "2", "3", "4", "5", "10"].map((v) => ({ value: v, label: v })) },
        { key: "size", label: "Size", options: [
          { value: "200x200", label: "200 x 200 mm" },
          { value: "300x200", label: "300 x 200 mm" },
          { value: "300x300", label: "300 x 300 mm" },
          { value: "400x300", label: "400 x 300 mm" },
          { value: "400x400", label: "400 x 400 mm" },
          { value: "600x400", label: "600 x 400 mm" },
          { value: "700x500", label: "700 x 500 mm" },
          { value: "800x600", label: "800 x 600 mm" },
          { value: "custom", label: "Custom Size" },
        ] },
        { key: "time", label: "Turnaround", options: [
          { value: "0", label: "5 Business Days" },
          { value: "1", label: "3 Business Days" },
          { value: "2", label: "2 Business Days" },
        ] },
        { key: "versions", label: "Artwork Versions", options: [
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3+" },
        ] },
      ],
      pricingData: { template_type: "isg_custom_car_magnets", quantities: ["1", "2", "3", "4", "5", "10"], default_turnaround: "0" },
    },
    {
      id: "isg_x_banners",
      slug: "isg-x-banners",
      name: "X-Banners",
      url: "https://printstation.co.za/shop/x-banner/",
      basePriceInclVat: 485,
      templateType: "isg_custom_x_banners",
      flowFields: [
        { key: "qty", label: "Quantity", options: ["1", "2", "3", "4", "5", "10", "20"].map((v) => ({ value: v, label: v })) },
        { key: "size", label: "Banner Size", options: [
          { value: "1600x590", label: "1600 x 590 mm" },
          { value: "1800x800", label: "1800 x 800 mm" },
        ] },
        { key: "unit_type", label: "Unit Type", options: [
          { value: "print_only", label: "Print Only" },
          { value: "full_unit", label: "Full Unit (Stand + Print)" },
        ] },
        { key: "stock", label: "Material", options: [
          { value: "non_curl_pvc", label: "Non-Curl PVC" },
          { value: "pp_synthetic", label: "PP Synthetic" },
        ] },
        { key: "carry_bag", label: "Carry Bag", options: [
          { value: "included", label: "Included" },
          { value: "none", label: "None" },
        ] },
        { key: "time", label: "Turnaround", options: [
          { value: "0", label: "7 Business Days" },
          { value: "1", label: "5 Business Days" },
          { value: "2", label: "3 Business Days" },
        ] },
        { key: "versions", label: "Artwork Versions", options: [
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3+" },
        ] },
      ],
      pricingData: { template_type: "isg_custom_x_banners", quantities: ["1", "2", "3", "4", "5", "10", "20"], default_turnaround: "0" },
    },
    {
      id: "isg_pvc_banners",
      slug: "isg-pvc-banners",
      name: "PVC Banners",
      url: "https://printstation.co.za/shop/pvc-banners/",
      basePriceInclVat: 150,
      templateType: "isg_custom_pvc_banners",
      flowFields: [
        { key: "qty", label: "Quantity", options: ["1", "2", "3", "4", "5", "10"].map((v) => ({ value: v, label: v })) },
        { key: "size", label: "Banner Size", options: [
          { value: "a2", label: "A2 (594 x 420 mm)" },
          { value: "a1", label: "A1 (841 x 594 mm)" },
          { value: "2x1", label: "2 m x 1 m" },
          { value: "3x1", label: "3 m x 1 m" },
          { value: "custom", label: "Custom Size" },
        ] },
        { key: "sides", label: "Sides", options: [
          { value: "one_side_black_back", label: "One Side - Black Back" },
          { value: "double_sided", label: "Double Sided" },
        ] },
        { key: "finishing", label: "Finishing", options: [
          { value: "none", label: "No Finishing" },
          { value: "eyelets", label: "Eyelets" },
          { value: "hem_eyelets", label: "Hem + Eyelets" },
        ] },
        { key: "time", label: "Turnaround", options: [
          { value: "0", label: "7 Business Days" },
          { value: "1", label: "5 Business Days" },
          { value: "2", label: "3 Business Days" },
        ] },
        { key: "versions", label: "Artwork Versions", options: [
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3+" },
        ] },
      ],
      pricingData: { template_type: "isg_custom_pvc_banners", quantities: ["1", "2", "3", "4", "5", "10"], default_turnaround: "0" },
    },
    {
      id: "isg_pull_up_banners",
      slug: "isg-pull-up-banners",
      name: "Pull Up / Roll Up Banners",
      url: "https://printstation.co.za/shop/pull-up-banners-roll-up-banners/",
      basePriceInclVat: 995,
      templateType: "isg_custom_pullup_banners",
      flowFields: [
        { key: "qty", label: "Quantity", options: ["1", "2", "3", "4", "5", "10", "20"].map((v) => ({ value: v, label: v })) },
        { key: "size", label: "Size", options: [
          { value: "2000x850", label: "2000 x 850 mm" },
          { value: "2000x1000", label: "2000 x 1000 mm" },
        ] },
        { key: "unit_type", label: "Unit Type", options: [
          { value: "full_unit", label: "Full Unit (Incl Print)" },
          { value: "print_only", label: "Print Only / Refill" },
        ] },
        { key: "base_type", label: "Base Type", options: [
          { value: "economy", label: "Economy" },
          { value: "premium", label: "Premium" },
        ] },
        { key: "stock", label: "Material", options: [
          { value: "non_curl_pvc", label: "Non-Curl PVC" },
          { value: "blockout_pp", label: "Blockout PP" },
        ] },
        { key: "time", label: "Turnaround", options: [
          { value: "0", label: "7 Business Days" },
          { value: "1", label: "5 Business Days" },
          { value: "2", label: "3 Business Days" },
        ] },
        { key: "versions", label: "Artwork Versions", options: [
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3+" },
        ] },
      ],
      pricingData: { template_type: "isg_custom_pullup_banners", quantities: ["1", "2", "3", "4", "5", "10", "20"], default_turnaround: "0" },
    },
    {
      id: "isg_certificates",
      slug: "isg-certificates",
      name: "Certificates",
      url: "https://printstation.co.za/shop/certificates/",
      basePriceInclVat: 170,
      templateType: "isg_custom_certificates",
      flowFields: [
        { key: "qty", label: "Print Run", options: ["10", "20", "30", "40", "50", "60", "80", "100", "150", "200", "250", "300"].map((v) => ({ value: v, label: v })) },
        { key: "size", label: "Size", options: [
          { value: "a5", label: "A5" },
          { value: "a4", label: "A4" },
          { value: "a3", label: "A3" },
        ] },
        { key: "paper", label: "Paper Stock", options: [
          { value: "250gsm", label: "250gsm" },
          { value: "300gsm", label: "300gsm" },
          { value: "350gsm", label: "350gsm" },
        ] },
        { key: "orientation", label: "Orientation", options: [
          { value: "portrait", label: "Portrait" },
          { value: "landscape", label: "Landscape" },
        ] },
        { key: "finish", label: "Finish", options: [
          { value: "none", label: "No Lamination" },
          { value: "gloss", label: "Gloss Lamination" },
          { value: "matt", label: "Matt Lamination" },
        ] },
        { key: "time", label: "Turnaround", options: [
          { value: "0", label: "7 Business Days" },
          { value: "1", label: "5 Business Days" },
          { value: "2", label: "3 Business Days" },
        ] },
      ],
      pricingData: { template_type: "isg_custom_certificates", quantities: ["10", "20", "30", "40", "50", "60", "80", "100", "150", "200", "250", "300"], default_turnaround: "0" },
    },
    {
      id: "isg_printed_menus",
      slug: "isg-printed-menus",
      name: "Printed Menus",
      url: "https://printstation.co.za/shop/printed-menus/",
      basePriceInclVat: 110,
      templateType: "isg_custom_printed_menus",
      flowFields: [
        { key: "sets", label: "Sets", options: ["1", "2", "3", "4", "5", "10"].map((v) => ({ value: v, label: v })) },
        { key: "qty", label: "Print Run Per Set", options: ["50", "60", "70", "80", "90", "100", "150"].map((v) => ({ value: v, label: v })) },
        { key: "type", label: "Type", options: [
          { value: "standard", label: "Standard" },
          { value: "single_fold", label: "Single Fold" },
          { value: "letter_fold", label: "Letter Fold" },
          { value: "z_fold", label: "Z-Fold" },
        ] },
        { key: "size", label: "Size", options: [
          { value: "a4", label: "A4" },
          { value: "a3", label: "A3" },
          { value: "dl", label: "DL" },
        ] },
        { key: "paper", label: "Paper", options: [
          { value: "115gsm_gloss", label: "115gsm Gloss" },
          { value: "170gsm_gloss", label: "170gsm Gloss" },
          { value: "250gsm_matt", label: "250gsm Matt" },
        ] },
        { key: "finish", label: "Finish", options: [
          { value: "none", label: "No Lamination" },
          { value: "matt", label: "Matt Lamination" },
          { value: "gloss", label: "Gloss Lamination" },
        ] },
        { key: "time", label: "Turnaround", options: [
          { value: "0", label: "7 Business Days" },
          { value: "1", label: "5 Business Days" },
          { value: "2", label: "3 Business Days" },
        ] },
      ],
      pricingData: { template_type: "isg_custom_printed_menus", quantities: ["50", "60", "70", "80", "90", "100", "150"], default_turnaround: "0" },
    },
    {
      id: "isg_presentation_folders",
      slug: "isg-presentation-folders",
      name: "Presentation Folders",
      url: "https://printstation.co.za/shop/presentation-folders/",
      basePriceInclVat: 340,
      templateType: "isg_custom_presentation_folders",
      flowFields: [
        { key: "qty", label: "Print Run", options: ["30", "40", "50", "60", "70", "80", "90"].map((v) => ({ value: v, label: v })) },
        { key: "size", label: "Size", options: [
          { value: "a4_plus", label: "A4+ (213 x 303mm)" },
          { value: "a4", label: "A4" },
        ] },
        { key: "print_colour", label: "Print Colour", options: [
          { value: "full_colour", label: "Full Colour" },
          { value: "black", label: "Black" },
        ] },
        { key: "type", label: "Type", options: [
          { value: "no_flap", label: "No Flap" },
          { value: "blank_flap", label: "Blank Flap" },
          { value: "printed_flap", label: "Printed Flap" },
        ] },
        { key: "print_sides", label: "Print Sides", options: [
          { value: "outside", label: "Outside" },
          { value: "both_sides", label: "Both Sides" },
        ] },
        { key: "lamination", label: "Lamination", options: [
          { value: "none", label: "No Lamination" },
          { value: "matt", label: "Matt Lamination" },
          { value: "gloss", label: "Gloss Lamination" },
        ] },
        { key: "time", label: "Turnaround", options: [
          { value: "0", label: "7 Business Days" },
          { value: "1", label: "5 Business Days" },
          { value: "2", label: "3 Business Days" },
        ] },
      ],
      pricingData: { template_type: "isg_custom_presentation_folders", quantities: ["30", "40", "50", "60", "70", "80", "90"], default_turnaround: "0" },
    },
    {
      id: "isg_booklets",
      slug: "isg-booklets",
      name: "Booklets (Staple Bound)",
      url: "https://printstation.co.za/shop/booklets-staple-bound/",
      basePriceInclVat: 460,
      templateType: "isg_custom_booklets",
      flowFields: [
        { key: "qty", label: "Print Run", options: ["20", "30", "40", "50", "100"].map((v) => ({ value: v, label: v })).concat([{ value: "custom", label: "Custom Qty" }]) },
        { key: "size", label: "Size", options: [
          { value: "a4", label: "A4" },
          { value: "a5", label: "A5" },
          { value: "a6", label: "A6" },
          { value: "dl", label: "DL" },
          { value: "210x210", label: "210 x 210 mm" },
        ] },
        { key: "pages", label: "Pages", options: [
          { value: "8", label: "8 Pages (4 Inners + 4 Cover)" },
          { value: "12", label: "12 Pages (8 Inners + 4 Cover)" },
          { value: "16", label: "16 Pages (12 Inners + 4 Cover)" },
          { value: "20", label: "20 Pages (16 Inners + 4 Cover)" },
          { value: "24", label: "24 Pages (20 Inners + 4 Cover)" },
          { value: "28", label: "28 Pages (24 Inners + 4 Cover)" },
          { value: "32", label: "32 Pages (28 Inners + 4 Cover)" },
          { value: "36", label: "36 Pages (32 Inners + 4 Cover)" },
          { value: "40", label: "40 Pages (36 Inners + 4 Cover)" },
          { value: "44", label: "44 Pages (40 Inners + 4 Cover)" },
          { value: "48", label: "48 Pages (44 Inners + 4 Cover)" },
          { value: "52", label: "52 Pages (48 Inners + 4 Cover)" },
          { value: "56", label: "56 Pages (52 Inners + 4 Cover)" },
          { value: "60", label: "60 Pages (56 Inners + 4 Cover)" },
          { value: "64", label: "64 Pages (60 Inners + 4 Cover)" },
          { value: "68", label: "68 Pages (64 Inners + 4 Cover)" },
          { value: "72", label: "72 Pages (68 Inners + 4 Cover)" },
          { value: "76", label: "76 Pages (72 Inners + 4 Cover)" },
          { value: "80", label: "80 Pages (76 Inners + 4 Cover)" },
          { value: "84", label: "84 Pages (80 Inners + 4 Cover)" },
          { value: "88", label: "88 Pages (84 Inners + 4 Cover)" },
        ] },
        { key: "colour", label: "Colours", options: [
          { value: "full_colour", label: "Full Colour" },
          { value: "black_white", label: "Black & White" },
        ] },
        { key: "paper", label: "Paper", options: [
          { value: "80gsm_bond", label: "80gsm Bond" },
          { value: "90gsm_bond", label: "90gsm Bond" },
          { value: "115gsm", label: "115gsm" },
          { value: "130gsm", label: "130gsm" },
          { value: "150gsm", label: "150gsm" },
        ] },
        { key: "cover", label: "Cover Paper", options: [
          { value: "80gsm_bond", label: "80gsm Bond" },
          { value: "90gsm", label: "90gsm" },
          { value: "115gsm", label: "115gsm" },
          { value: "120gsm_bond", label: "120gsm Bond" },
          { value: "150gsm", label: "150gsm" },
          { value: "200gsm", label: "200gsm" },
          { value: "250gsm", label: "250gsm" },
        ] },
        { key: "print_colour", label: "Print Colour", options: [
          { value: "full_colour", label: "Full Colour" },
          { value: "black_white", label: "Black & White" },
        ] },
        { key: "lamination", label: "Lamination", options: [
          { value: "none", label: "None" },
          { value: "gloss", label: "OPP Gloss Laminate" },
          { value: "matt", label: "OPP Matt Laminate" },
        ] },
        { key: "time", label: "Print Time", options: [
          { value: "0", label: "5 Days" },
          { value: "1", label: "3 Days" },
          { value: "2", label: "2 Days" },
        ] },
      ],
      pricingData: { template_type: "isg_custom_booklets", quantities: ["20", "30", "40", "50", "100"], default_turnaround: "0" },
    },
    {
      id: "isg_ncr_books",
      slug: "isg-ncr-books",
      name: "NCR Books",
      url: "https://www.shop.webprinter.co.za/marketing-materials/ncr-book/",
      basePriceInclVat: 305,
      templateType: "isg_custom_ncr_books",
      flowFields: [
        { key: "qty", label: "Quantity (Books)", options: ["1","2","3","4","5","10","12","15","20","25","30","50"].map((v) => ({ value: v, label: v })) },
        { key: "size", label: "Size", options: [
          { value: "a6", label: "A6 (148 × 105 mm)" },
          { value: "a5", label: "A5 (210 × 148 mm)" },
          { value: "a4", label: "A4 (297 × 210 mm)" },
        ] },
        { key: "processing", label: "Book Type", options: [
          { value: "50_2x", label: "50 Pages — Duplicate (2-ply)" },
          { value: "100_2x", label: "100 Pages — Duplicate (2-ply)" },
          { value: "50_3x", label: "50 Pages — Triplicate (3-ply)" },
        ] },
        { key: "perf", label: "Perforation", options: [
          { value: "std", label: "Standard Perf" },
          { value: "perf2", label: "Perf × 2" },
        ] },
        { key: "colour_1", label: "1st Sheet Colour", options: [
          { value: "white", label: "White" },
          { value: "blue", label: "Blue" },
          { value: "yellow", label: "Yellow" },
          { value: "green", label: "Green" },
        ] },
        { key: "colour_2", label: "2nd Sheet Colour", options: [
          { value: "white", label: "White" },
          { value: "blue", label: "Blue" },
          { value: "yellow", label: "Yellow" },
          { value: "green", label: "Green" },
        ] },
        { key: "colour_3", label: "3rd Sheet Colour (triplicate only)", options: [
          { value: "white", label: "White" },
          { value: "blue", label: "Blue" },
          { value: "yellow", label: "Yellow" },
          { value: "green", label: "Green" },
        ] },
        { key: "numbering", label: "Sequential Numbering", options: [
          { value: "no", label: "No" },
          { value: "yes", label: "Yes" },
        ] },
      ],
      pricingData: { template_type: "isg_custom_ncr_books", quantities: ["1","2","3","4","5","10","12","15","20","25","30","50"], default_turnaround: "0" },
    },
    {
      id: "isg_name_badges",
      slug: "isg-name-badges",
      name: "Name Badges",
      url: "https://printstation.co.za/shop/name-badges/",
      basePriceInclVat: 115,
      templateType: "isg_custom_name_badges",
      flowFields: [
        { key: "qty", label: "Quantity", options: ["1", "5", "10", "20", "30", "50", "100"].map((v) => ({ value: v, label: v })) },
        { key: "size", label: "Size", options: [
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" },
        ] },
        { key: "shape", label: "Shape", options: [
          { value: "rectangle", label: "Rectangle" },
          { value: "oval", label: "Oval" },
        ] },
        { key: "material", label: "Material", options: [
          { value: "white", label: "White" },
          { value: "silver", label: "Silver" },
          { value: "gold", label: "Gold" },
        ] },
        { key: "fixture", label: "Fixture", options: [
          { value: "pin", label: "Pin" },
          { value: "magnet", label: "Magnet" },
        ] },
        { key: "time", label: "Turnaround", options: [
          { value: "0", label: "7 Business Days" },
          { value: "1", label: "5 Business Days" },
          { value: "2", label: "3 Business Days" },
        ] },
      ],
      pricingData: { template_type: "isg_custom_name_badges", quantities: ["1", "5", "10", "20", "30", "50", "100"], default_turnaround: "0" },
    },
    {
      id: "isg_fridge_calendars",
      slug: "isg-fridge-calendars",
      name: "Fridge Calendars",
      url: "https://printstation.co.za/shop/fridge-calendars-a5/",
      basePriceInclVat: 278,
      templateType: "isg_custom_fridge",
      flowFields: [
        {
          key: "size",
          label: "Size",
          options: [
            { value: "dl", label: "DL" },
            { value: "a5", label: "A5" },
            { value: "a4", label: "A4" },
          ],
        },
        {
          key: "qty",
          label: "Quantity",
          options: [
            { value: "50", label: "50" },
            { value: "100", label: "100" },
            { value: "250", label: "250" },
            { value: "500", label: "500" },
            { value: "1000", label: "1000" },
          ],
        },
        {
          key: "orientation",
          label: "Orientation",
          options: [
            { value: "portrait", label: "Portrait" },
            { value: "landscape", label: "Landscape" },
          ],
        },
        {
          key: "print_sides",
          label: "Print Sides",
          options: [
            { value: "one_side", label: "1 Side" },
            { value: "two_sides", label: "2 Sides" },
          ],
        },
        {
          key: "finish",
          label: "Finish",
          options: [
            { value: "none", label: "No Lamination" },
            { value: "gloss", label: "Gloss Lamination" },
            { value: "matt", label: "Matt Lamination" },
          ],
        },
        {
          key: "time",
          label: "Turnaround",
          options: [
            { value: "0", label: "7 Business Days" },
            { value: "1", label: "5 Business Days" },
            { value: "2", label: "3 Business Days" },
          ],
        },
      ],
      pricingData: {
        template_type: "isg_custom_fridge",
        quantities: ["50", "100", "250", "500", "1000"],
        default_turnaround: "0",
      },
    },
    {
      id: "isg_domed_stickers",
      slug: "isg-domed-stickers",
      name: "Domed Stickers",
      url: "https://printstation.co.za/shop/domed-stickers/",
      basePriceInclVat: 250,
      templateType: "isg_custom_domed_stickers",
      flowFields: [
        { key: "qty", label: "Quantity", options: ["20", "50", "100", "200", "300", "500", "1000"].map((v) => ({ value: v, label: v })) },
        { key: "width_mm", label: "Width (mm)", options: ["20", "30", "40", "50", "60", "80", "100", "150"].map((v) => ({ value: v, label: v })) },
        { key: "length_mm", label: "Length (mm)", options: ["20", "30", "40", "50", "60", "80", "100", "150"].map((v) => ({ value: v, label: v })) },
        { key: "time", label: "Print Time", options: [
          { value: "0", label: "7 Days (Standard)" },
          { value: "1", label: "5 Days" },
          { value: "2", label: "3 Days" },
        ] },
      ],
      pricingData: { template_type: "isg_custom_domed_stickers", quantities: ["20", "50", "100", "200", "300", "500", "1000"], default_turnaround: "0" },
    },
    {
      id: "isg_license_disc_stickers",
      slug: "isg-license-disc-stickers",
      name: "License Disc Stickers",
      url: "https://printstation.co.za/shop/license-disc-stickers/",
      basePriceInclVat: 150,
      templateType: "isg_custom_license_disc_stickers",
      flowFields: [
        { key: "qty", label: "Set Quantity", options: ["10", "20", "50", "100", "150", "200", "250", "300", "400", "500", "600", "700", "800", "900", "1000"].map((v) => ({ value: v, label: v })) },
        { key: "size", label: "Size", options: [{ value: "90x90_circle", label: "90 x 90mm (Circle)" }] },
        { key: "material", label: "Material", options: [{ value: "white_vinyl", label: "White Vinyl" }] },
        { key: "time", label: "Print Time", options: [
          { value: "0", label: "5 Days" },
          { value: "1", label: "3 Days" },
          { value: "2", label: "2 Days" },
        ] },
      ],
      pricingData: { template_type: "isg_custom_license_disc_stickers", quantities: ["10", "20", "50", "100", "150", "200", "250", "300", "400", "500", "600", "700", "800", "900", "1000"], default_turnaround: "0" },
    },
    {
      id: "isg_tent_calendars_dl",
      slug: "isg-tent-calendars-dl",
      name: "Tent Calendars (DL)",
      url: "https://printstation.co.za/shop/tent-calendars-dl/",
      basePriceInclVat: 265,
      templateType: "isg_custom_tent_calendars",
      flowFields: [
        { key: "qty", label: "Quantity (Sets)", options: ["1", "2", "3", "4", "5", "10"].map((v) => ({ value: v, label: v })) },
        { key: "print_run", label: "Print Run", options: ["10", "20", "30", "40", "50", "60", "70", "80", "90", "100", "150", "200", "250", "500", "1000", "1500", "2000", "2500"].map((v) => ({ value: v, label: v })) },
        { key: "size", label: "Size", options: [{ value: "dl_landscape", label: "DL Landscape" }] },
        { key: "sides", label: "Sides", options: [{ value: "one_side_2_panels", label: "One Side (2 Panels)" }] },
        { key: "paper", label: "Paper", options: [{ value: "300gsm_card", label: "300gsm Card" }] },
        { key: "lamination", label: "Lamination", options: [
          { value: "none", label: "None" },
          { value: "gloss", label: "OPP Gloss Laminate" },
          { value: "matt", label: "OPP Matt Laminate" },
        ] },
        { key: "time", label: "Print Time", options: [
          { value: "0", label: "7 Days" },
          { value: "1", label: "5 Days" },
          { value: "2", label: "3 Days" },
        ] },
      ],
      pricingData: { template_type: "isg_custom_tent_calendars", quantities: ["1", "2", "3", "4", "5", "10"], default_turnaround: "0" },
    },
    {
      id: "isg_colop_stamps",
      slug: "isg-colop-stamps",
      name: "Colop Stamps",
      url: "https://printstation.co.za/shop/colop-stamps/",
      basePriceInclVat: 245,
      templateType: "isg_custom_colop_stamps",
      flowFields: [
        { key: "qty", label: "Quantity", options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].map((v) => ({ value: v, label: v })) },
        { key: "stamp_type", label: "Stamp Type", options: [
          { value: "compact", label: "Compact" },
          { value: "standard", label: "Standard" },
          { value: "oblong", label: "Oblong" },
          { value: "round", label: "Round" },
          { value: "dater", label: "Dater" },
        ] },
        { key: "model", label: "Model", options: [
          { value: "c10", label: "Printer C10" },
          { value: "c20", label: "Printer C20" },
          { value: "c30", label: "Printer C30" },
          { value: "c40", label: "Printer C40" },
        ] },
        { key: "pad_colour", label: "Pad Colour", options: [
          { value: "black", label: "Black" },
          { value: "blue", label: "Blue" },
          { value: "red", label: "Red" },
        ] },
        { key: "time", label: "Turnaround", options: [
          { value: "0", label: "7 Business Days" },
          { value: "1", label: "5 Business Days" },
          { value: "2", label: "3 Business Days" },
        ] },
      ],
      pricingData: { template_type: "isg_custom_colop_stamps", quantities: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], default_turnaround: "0" },
    },
    {
      id: "isg_signboards",
      slug: "isg-signboards",
      name: "ABS / Correx / Foam Signboards",
      basePriceInclVat: 115,
      templateType: "isg_custom_signboards",
      flowFields: [
        { key: "qty", label: "Quantity", options: ["1","2","3","4","5","10"].map(v => ({ value: v, label: v })) },
        { key: "size", label: "Size", options: [
          { value: "a6", label: "A6 (105 × 148 mm)" },
          { value: "a5", label: "A5 (148 × 210 mm)" },
          { value: "a4", label: "A4 (210 × 297 mm)" },
          { value: "a3", label: "A3 (297 × 420 mm)" },
          { value: "a2", label: "A2 (420 × 594 mm)" },
          { value: "a1", label: "A1 (594 × 841 mm)" },
          { value: "a0", label: "A0 (841 × 1189 mm)" },
          { value: "sq200", label: "200 × 200 mm Square" },
          { value: "sq300", label: "300 × 300 mm Square" },
          { value: "sq400", label: "400 × 400 mm Square" },
          { value: "sq500", label: "500 × 500 mm Square" },
          { value: "sq600", label: "600 × 600 mm Square" },
          { value: "custom", label: "Custom Size" },
        ]},
        { key: "substrate", label: "Board / Substrate", options: [
          { value: "correx_3mm", label: "Correx 3mm" },
          { value: "abs_0_9mm", label: "ABS Board 0.9mm" },
          { value: "abs_1_5mm", label: "ABS Board 1.5mm" },
          { value: "mfoam_3mm", label: "M-Foam 3mm" },
          { value: "mfoam_5mm", label: "M-Foam 5mm" },
        ]},
        { key: "sides", label: "Sides", options: [
          { value: "one_side", label: "One Side" },
          { value: "double_sided", label: "Double Sided" },
        ]},
        { key: "media", label: "Vinyl Media", options: [
          { value: "gloss_indoor", label: "White Gloss Vinyl Indoor" },
          { value: "gloss_outdoor", label: "White Gloss Vinyl Outdoor" },
        ]},
        { key: "time", label: "Turnaround", options: [
          { value: "0", label: "7 Business Days" },
          { value: "1", label: "5 Business Days" },
          { value: "2", label: "3 Business Days" },
        ]},
      ],
      pricingData: { template_type: "isg_custom_signboards", quantities: ["1","2","3","4","5","10"], default_turnaround: "0" },
    },
    {
      id: "isg_canvas_prints",
      slug: "isg-canvas-prints",
      name: "Canvas Prints",
      url: "https://printstation.co.za/shop/canvas-prints/",
      basePriceInclVat: 200,
      templateType: "isg_custom_canvas",
      flowFields: [
        { key: "size", label: "Size", options: [
          { value: "a1", label: "A1 (594 × 841 mm)" },
          { value: "a2", label: "A2 (420 × 594 mm)" },
          { value: "a3", label: "A3 (297 × 420 mm)" },
          { value: "a4", label: "A4 (210 × 297 mm)" },
          { value: "a5", label: "A5 (148 × 210 mm)" },
          { value: "custom", label: "Custom Size" },
        ]},
      ],
      pricingData: { template_type: "isg_custom_canvas", quantities: ["1"], default_turnaround: "0" },
    },
  ];
}

function isOwnerUnlocked_() {
  try {
    return window.sessionStorage.getItem(OWNER_ACCESS_KEY) === "YES";
  } catch (_err) {
    return false;
  }
}

function setOwnerUnlocked_(unlocked) {
  try {
    window.sessionStorage.setItem(OWNER_ACCESS_KEY, unlocked ? "YES" : "NO");
  } catch (_err) {
    // non-fatal
  }
  state.ownerUnlocked = !!unlocked;
}

function requestOwnerUnlock_() {
  const input = window.prompt("Enter owner passcode");
  if (input === null) return false;
  const ok = String(input || "").trim() === OWNER_PASSCODE;
  if (!ok) {
    window.alert("Incorrect passcode.");
    return false;
  }
  setOwnerUnlocked_(true);
  return true;
}

const demoJobs = [
  { jobNo: "ISG-000047", category: "In-house", customer: "TEST 1 INHOUSE", product: "Business Cards", due: "2026-03-09", status: "Ready", promiseRisk: true, blocked: false, specs: "Size: A6\nQty: 500\nPaper: 350gsm", notes: "Urgent", payment: "Paid", batch: "NONE" },
  { jobNo: "ISG-000048", category: "Outsourced", customer: "Smith & Co", product: "Stamps", due: "2026-03-11", status: "Waiting Approval", promiseRisk: false, blocked: true, specs: "Stamp size 40x40", notes: "", payment: "Paid", batch: "PS-11:00" },
  { jobNo: "ISG-000049", category: "Ink/Stock", customer: "Printer World", product: "HP 123 Black", due: "2026-03-07", status: "Ready to Order", promiseRisk: false, blocked: false, specs: "1 x HP 123 Black", notes: "", payment: "Unpaid", batch: "INK-15:00" },
  { jobNo: "ISG-000050", category: "Returns", customer: "Jane Doe", product: "Cartridge Return", due: "2026-03-08", status: "Return: Awaiting Dispatch", promiseRisk: false, blocked: false, specs: "Brand: Canon\nFault: Faded print", notes: "Call customer", payment: "Paid", batch: "NONE" },
];

const tabsByRole = {
  staff: [
    ["staff_board", "Staff Board"],
    ["job_intake", "Job Intake"],
    ["job_detail", "Job Detail"],
    ["price_list", "Price List"],
    ["vinyl_pricing", "Vinyl Pricing"],
    ["vinyl_queue", "Mimaki Queue"],
    ["batching", "Supplier Orders"],
    ["alerts", "Alerts"],
    ["completed_jobs", "Completed Jobs"],
  ],
  owner: [
    ["owner_dashboard", "Owner Dashboard"],
    ["owner_actions", "Actions"],
    ["job_detail", "Job Detail"],
    ["price_list", "Price List"],
    ["vinyl_pricing", "Vinyl Pricing"],
    ["vinyl_queue", "Mimaki Queue"],
    ["batching", "Supplier Orders"],
    ["owner_reports", "Reports"],
    ["alerts", "Alerts"],
    ["completed_jobs", "Completed Jobs"],
    ["deleted_jobs", "Deleted Jobs"],
  ],
  admin: [
    ["staff_board", "Staff Board"],
    ["owner_dashboard", "Owner Dashboard"],
    ["job_intake", "Job Intake"],
    ["job_detail", "Job Detail"],
    ["price_list", "Price List"],
    ["vinyl_pricing", "Vinyl Pricing"],
    ["vinyl_queue", "Mimaki Queue"],
    ["batching", "Supplier Orders"],
    ["alerts", "Alerts"],
    ["completed_jobs", "Completed Jobs"],
    ["deleted_jobs", "Deleted Jobs"],
  ],
};

function normalizeRole_(rawRole) {
  const v = String(rawRole || "").trim().toLowerCase();
  if (v === "owner" || v.includes("owner") || v.includes("wesley")) return "owner";
  if (v === "admin") return "admin";
  return "staff";
}

function loadLocalPricingSettings_() {
  try {
    const raw = window.localStorage.getItem(VINYL_PRICING_STORAGE_KEY);
    if (!raw) return null;
    return normalizePricingSettings_(JSON.parse(raw));
  } catch (_err) {
    return null;
  }
}

function saveLocalPricingSettings_(settings) {
  try {
    window.localStorage.setItem(VINYL_PRICING_STORAGE_KEY, JSON.stringify(settings || {}));
  } catch (_err) {
    // non-fatal
  }
}

function loadLocalCanvasPricingSettings_() {
  try {
    const raw = window.localStorage.getItem(CANVAS_PRICING_STORAGE_KEY);
    if (!raw) return null;
    const src = JSON.parse(raw);
    const num = (v, fb) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : fb; };
    return {
      inkCostPerMl:         num(src.inkCostPerMl,         DEFAULT_CANVAS_PRICING_SETTINGS.inkCostPerMl),
      inkMlPerM2:           num(src.inkMlPerM2,           DEFAULT_CANVAS_PRICING_SETTINGS.inkMlPerM2),
      canvasCostPerM2:      num(src.canvasCostPerM2,      DEFAULT_CANVAS_PRICING_SETTINGS.canvasCostPerM2),
      rollWidthMm:          num(src.rollWidthMm,          DEFAULT_CANVAS_PRICING_SETTINGS.rollWidthMm),
      mountingAllowanceMm:  num(src.mountingAllowanceMm,  DEFAULT_CANVAS_PRICING_SETTINGS.mountingAllowanceMm),
      frameCostA1:          num(src.frameCostA1,          DEFAULT_CANVAS_PRICING_SETTINGS.frameCostA1),
      frameCostA2:          num(src.frameCostA2,          DEFAULT_CANVAS_PRICING_SETTINGS.frameCostA2),
      frameCostA3:          num(src.frameCostA3,          DEFAULT_CANVAS_PRICING_SETTINGS.frameCostA3),
      frameCostA4:          num(src.frameCostA4,          DEFAULT_CANVAS_PRICING_SETTINGS.frameCostA4),
      frameCostA5:          num(src.frameCostA5,          DEFAULT_CANVAS_PRICING_SETTINGS.frameCostA5),
    };
  } catch (_e) { return null; }
}

function saveLocalCanvasPricingSettings_(settings) {
  try {
    window.localStorage.setItem(CANVAS_PRICING_STORAGE_KEY, JSON.stringify(settings || {}));
  } catch (_e) {}
}

function normalizePricingSettings_(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const legacyWasteFactor = Number(src.wasteFactor);
  const legacyMarkupMultiplier = Number(src.markupMultiplier);
  const legacyInkCostPerM2 = Number(src.inkCostPerM2);

  const wastePercent = Number.isFinite(legacyWasteFactor) && legacyWasteFactor > 0
    ? (legacyWasteFactor - 1) * 100
    : num(src.wastePercent, DEFAULT_VINYL_PRICING_SETTINGS.wastePercent);

  const markupPercentExVat = Number.isFinite(legacyMarkupMultiplier) && legacyMarkupMultiplier > 0
    ? (legacyMarkupMultiplier - 1) * 100
    : num(src.markupPercentExVat, DEFAULT_VINYL_PRICING_SETTINGS.markupPercentExVat);

  const inkCostPerMl = num(src.inkCostPerMl, DEFAULT_VINYL_PRICING_SETTINGS.inkCostPerMl);
  const inkMlPerM2 = num(src.inkMlPerM2, DEFAULT_VINYL_PRICING_SETTINGS.inkMlPerM2);

  const inferredInkCostPerMl = (!Number.isFinite(inkCostPerMl) || inkCostPerMl <= 0) &&
    Number.isFinite(legacyInkCostPerM2) && legacyInkCostPerM2 > 0 &&
    Number.isFinite(inkMlPerM2) && inkMlPerM2 > 0
    ? (legacyInkCostPerM2 / inkMlPerM2)
    : inkCostPerMl;

  return {
    retailPerM2InclVat: num(src.retailPerM2InclVat, DEFAULT_VINYL_PRICING_SETTINGS.retailPerM2InclVat),
    minimumCharge: num(src.minimumCharge, DEFAULT_VINYL_PRICING_SETTINGS.minimumCharge),
    roundToNearest: num(src.roundToNearest, DEFAULT_VINYL_PRICING_SETTINGS.roundToNearest),
    wastePercent: num(wastePercent, DEFAULT_VINYL_PRICING_SETTINGS.wastePercent),
    setupFee: num(src.setupFee, DEFAULT_VINYL_PRICING_SETTINGS.setupFee),
    laborFee: num(src.laborFee, DEFAULT_VINYL_PRICING_SETTINGS.laborFee),
    markupPercentExVat: num(markupPercentExVat, DEFAULT_VINYL_PRICING_SETTINGS.markupPercentExVat),
    vatPercent: num(src.vatPercent, DEFAULT_VINYL_PRICING_SETTINGS.vatPercent),
    inkCostPerMl: num(inferredInkCostPerMl, DEFAULT_VINYL_PRICING_SETTINGS.inkCostPerMl),
    inkMlPerM2: num(src.inkMlPerM2, DEFAULT_VINYL_PRICING_SETTINGS.inkMlPerM2),
    rollWidthMm: num(src.rollWidthMm, DEFAULT_VINYL_PRICING_SETTINGS.rollWidthMm),
    rollLengthM: num(src.rollLengthM, DEFAULT_VINYL_PRICING_SETTINGS.rollLengthM),
    rollCost: num(src.rollCost, DEFAULT_VINYL_PRICING_SETTINGS.rollCost),
  };
}

function getCurrentPricingSettings_() {
  return normalizePricingSettings_(state.pricingSettings || DEFAULT_VINYL_PRICING_SETTINGS);
}

function ensurePricingSettingsSynced_() {
  if (state.pricingSettingsSyncAttempted) return;
  state.pricingSettingsSyncAttempted = true;
  (async () => {
    try {
      const url = `${API.baseUrl}?action=pricingSettings&key=${encodeURIComponent(API.key)}`;
      const res = await fetch(url, { method: "GET" });
      const payload = await res.json();
      if (!payload.ok || !payload.data) return;
      state.pricingSettings = normalizePricingSettings_(payload.data);
      saveLocalPricingSettings_(state.pricingSettings);
      render();
    } catch (_err) {
      // Keep local settings.
    }
  })();
}

async function savePricingSettings_(nextSettings) {
  const normalized = normalizePricingSettings_(nextSettings);
  state.pricingSettings = normalized;
  saveLocalPricingSettings_(normalized);
  state.pricingSaveMessage = "Saved locally";
  render();

  try {
    const res = await fetch(API.baseUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "savePricingSettings",
        key: API.key,
        settings: normalized,
      }),
    });
    const payload = await res.json();
    if (!payload.ok) throw new Error(payload.error || "Could not save to backend");
    state.pricingSaveMessage = "Saved";
  } catch (_err) {
    state.pricingSaveMessage = "Saved locally (backend action not available yet)";
  }
  render();
}

function cloneJson_(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeOptionText_(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

// Resolve the human-readable label for a field value from a product's flowFields.
// Needed because PrintStation pricebook stores option values as numeric indices ('0','1','2'...)
// while our cost models need the actual label text (e.g. "A5 (210 x 148mm)").
function resolveFlowFieldLabel_(product, fieldKey, value) {
  const fields = Array.isArray(product && product.flowFields) ? product.flowFields : [];
  const field = fields.find(f => f.key === fieldKey);
  if (!field) return String(value || "");
  const opts = Array.isArray(field.options) ? field.options : [];
  const opt = opts.find(o => String(o.value || "") === String(value || ""));
  return opt ? String(opt.label || opt.value || "") : String(value || "");
}

function normalizeOptionKey_(value) {
  return normalizeOptionText_(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getProductAdjustmentDefaults_(product) {
  const title = String((product && (product.name || product.label || product.slug)) || "").toLowerCase();
  const isVinyl = title.includes("vinyl") || title.includes("sticker");
  return {
    markupPercent: 0,
    fixedOffset: 0,
    // Match PrintStation-style displayed retail pricing behavior by default.
    roundToNearest: 5,
    minimumPrice: (() => {
      const slug = String(product && (product.slug || product.id) || "").toLowerCase();
      return isVinyl ? 240 : (slug.includes("correx") || slug.includes("sign-board") || slug.includes("abs-foam")) ? 250 : 0;
    })(),
    quantityOverrides: {},
  };
}

function loadLocalPriceAdjustments_() {
  try {
    const raw = window.localStorage.getItem(PRICE_ADJUSTMENTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_err) {
    return {};
  }
}

function saveLocalPriceAdjustments_(map) {
  try {
    window.localStorage.setItem(PRICE_ADJUSTMENTS_STORAGE_KEY, JSON.stringify(map || {}));
  } catch (_err) {
    // non-fatal
  }
}

function getPriceAdjustments_() {
  if (!state.priceAdjustments || typeof state.priceAdjustments !== "object") {
    state.priceAdjustments = loadLocalPriceAdjustments_();
  }
  return state.priceAdjustments;
}

function getAdjustmentForProduct_(product) {
  const defaults = getProductAdjustmentDefaults_(product);
  const map = getPriceAdjustments_();
  const productKey = String(product && (product.slug || product.id || product.name) || "");
  const raw = map[productKey];
  if (!raw || typeof raw !== "object") return defaults;
  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    markupPercent: num(raw.markupPercent, defaults.markupPercent),
    fixedOffset: num(raw.fixedOffset, defaults.fixedOffset),
    roundToNearest: num(raw.roundToNearest, defaults.roundToNearest),
    minimumPrice: num(raw.minimumPrice, defaults.minimumPrice),
    quantityOverrides: Object.entries(raw.quantityOverrides && typeof raw.quantityOverrides === "object" ? raw.quantityOverrides : {})
      .reduce((acc, [k, v]) => {
        const price = Number(v);
        if (!Number.isFinite(price) || price <= 0) return acc;
        // Size-keyed entries (e.g. "210x297::2") are preserved as-is
        if (String(k).includes("::")) { acc[String(k)] = price; return acc; }
        const qty = Number.parseInt(String(k || ""), 10);
        if (!Number.isFinite(qty) || qty <= 0) return acc;
        acc[String(qty)] = price;
        return acc;
      }, {}),
    lfSelectedSize: raw.lfSelectedSize != null ? String(raw.lfSelectedSize) : undefined,
  };
}

function saveAdjustmentForProduct_(product, adjustment) {
  const map = getPriceAdjustments_();
  const productKey = String(product && (product.slug || product.id || product.name) || "");
  if (!productKey) return;
  const overrides = Object.entries(adjustment && adjustment.quantityOverrides && typeof adjustment.quantityOverrides === "object" ? adjustment.quantityOverrides : {})
    .reduce((acc, [k, v]) => {
      const price = Number(v);
      if (!Number.isFinite(price) || price <= 0) return acc;
      // Size-keyed entries (e.g. "210x297::2") are preserved as-is
      if (String(k).includes("::")) { acc[String(k)] = price; return acc; }
      const qty = Number.parseInt(String(k || ""), 10);
      if (!Number.isFinite(qty) || qty <= 0) return acc;
      acc[String(qty)] = price;
      return acc;
    }, {});
  const saved = {
    markupPercent: Number(adjustment.markupPercent || 0),
    fixedOffset: Number(adjustment.fixedOffset || 0),
    roundToNearest: Number(adjustment.roundToNearest || 0),
    minimumPrice: Number(adjustment.minimumPrice || 0),
    quantityOverrides: overrides,
  };
  if (adjustment.lfSelectedSize != null) saved.lfSelectedSize = String(adjustment.lfSelectedSize);
  map[productKey] = saved;
  state.priceAdjustments = map;
  saveLocalPriceAdjustments_(map);
}

function getProductCostDefaults_(product) {
  const id = String(product && (product.id || product.slug || "") || "").toLowerCase();
  const templateType = String(product && product.pricingData && product.pricingData.template_type || "").toLowerCase();
  const isPaperTemplate = [
    "isg_custom_booklets",
    "isg_custom_certificates",
    "isg_custom_printed_menus",
    "isg_custom_presentation_folders",
    "isg_custom_ncr_books",
    "isg_custom_tent_calendars",
    "isg_custom_fridge",
  ].includes(templateType);
  if (id === "isg_booklets" || isPaperTemplate) {
    return {
      clickCostA4BwExVat: 0.15,
      clickCostA4ColourExVat: 0.40,
      clickCostA3BwExVat: 0.29,
      clickCostA3ColourExVat: 0.78,
      paper80gsmBondExVat: 0.116,
      paper90gsmBondExVat: 0.135,
      paper115gsmExVat: 0.262,
      paper120gsmBondExVat: 1.75,
      paper130gsmExVat: 0.292,
      paper150gsmExVat: 0.338,
      paper200gsmExVat: 0.456,
      paper250gsmExVat: 0.570,
      setupExVat: 165,
      stitchExVatPerBook: 0.65,
      laminationExVatPerCover: 1.85,
      wastePercent: 6,
      overheadPercent: 8,
      minMarginQty20to29Percent: 45,
      minMarginQty30to39Percent: 42,
      minMarginQty40to49Percent: 38,
      minMarginQty50to99Percent: 35,
      minMarginQty100PlusPercent: 30,
      printstationBufferPercent: 8,
      rush3DayPercent: 12,
      rush2DayPercent: 22,
    };
  }
  // Printstation resell products — ISG buys at a reseller discount and resells
  const printstationResellTemplates = ["standard", "large_format", "dtf_printing", "canvas_frame", "note_pad"];
  if (printstationResellTemplates.includes(templateType)) {
    return { resellDiscountPercent: 30, handlingOverheadPercent: 5 };
  }
  // Custom ISG in-house / outsourced products
  if (templateType === "isg_custom_car_magnets") {
    return { supplierCostPercent: 42, overheadPercent: 8 };
  }
  if (templateType === "isg_custom_x_banners") {
    return { supplierCostPercent: 30, overheadPercent: 8 };
  }
  if (templateType === "isg_custom_pvc_banners") {
    return { supplierCostPercent: 32, overheadPercent: 8 };
  }
  if (templateType === "isg_custom_pullup_banners") {
    return { supplierCostPercent: 35, overheadPercent: 8 };
  }
  if (templateType === "isg_custom_name_badges") {
    return { supplierCostPercent: 35, overheadPercent: 8 };
  }
  if (templateType === "isg_custom_domed_stickers") {
    return { supplierCostPercent: 42, overheadPercent: 8 };
  }
  if (templateType === "isg_custom_license_disc_stickers") {
    return { supplierCostPercent: 28, overheadPercent: 8 };
  }
  if (templateType === "isg_custom_colop_stamps") {
    return { supplierCostPercent: 42, overheadPercent: 8 };
  }
  if (id === "isg_standard_printing") {
    return {
      clickCostA4BwExVat: 0.15,
      clickCostA4ColourExVat: 0.40,
      clickCostA3BwExVat: 0.29,
      clickCostA3ColourExVat: 0.78,
      paperCostA4ExVat: 0.116,
      paperCostA3ExVat: 0.266,
      bwMarginPercent: 27,
      colourMarginPercent: 75,
      oppLamCostPerMExVat: 2.588,
      oppLamMarginPercent: 69,
      oppLamMinimum: 45,
      encapCostPerMExVat: 8.45,
      encapMarginPercent: 61,
      encapMinimum: 50,
      encapMinimumA2: 75,
      encapMinimumA1: 95,
    };
  }
  return {};
}

function resolvePaperCostPerSheetExVat_(cs, key) {
  const m = {
    "80gsm_bond": Number(cs.paper80gsmBondExVat || 0.116),
    "90gsm_bond": Number(cs.paper90gsmBondExVat || 0.135),
    "115gsm": Number(cs.paper115gsmExVat || 0.262),
    "120gsm_bond": Number(cs.paper120gsmBondExVat || 1.75),
    "130gsm": Number(cs.paper130gsmExVat || 0.292),
    "150gsm": Number(cs.paper150gsmExVat || 0.338),
    "200gsm": Number(cs.paper200gsmExVat || 0.456),
    "250gsm": Number(cs.paper250gsmExVat || 0.570),
    "300gsm": Number(cs.paper250gsmExVat || 0.570) * 1.200, // 0.684/0.570 = Peters Papers A4 ratio
    "350gsm": Number(cs.paper250gsmExVat || 0.570) * 1.510, // 0.861/0.570 = Peters Papers A4 ratio
  };
  const k = String(key || "").toLowerCase();
  return Number(m[k] || m["150gsm"]);
}

function resolveClickCostPerSheetExVat_(cs, sheetSize, printMode) {
  const size = String(sheetSize || "a4").toLowerCase();
  const mode = String(printMode || "full_colour").toLowerCase();
  const isBw = mode === "black_white" || mode === "bw" || mode === "black";
  if (size === "a3") return isBw ? Number(cs.clickCostA3BwExVat || 0.29) : Number(cs.clickCostA3ColourExVat || 0.78);
  return isBw ? Number(cs.clickCostA4BwExVat || 0.15) : Number(cs.clickCostA4ColourExVat || 0.40);
}

function estimatePaperCostQuote_(product, answers, cfg) {
  const cs = getCostSettingsForProduct_(product);
  if (!cs || !Object.keys(cs).length) return null;
  const qty = Math.max(1, Number(cfg && cfg.qty || 1));
  const sheetSize = String(cfg && cfg.sheetSize || "a4").toLowerCase();
  const printMode = String(cfg && cfg.printMode || "full_colour").toLowerCase();
  const sheetsPerUnit = Math.max(0, Number(cfg && cfg.sheetsPerUnit || 1));
  const paperKey = String(cfg && cfg.paperKey || "150gsm");
  const baseInclVat = Math.max(0, Number(cfg && cfg.baseInclVat || 0));
  const extraExVatPerUnit = Math.max(0, Number(cfg && cfg.extraExVatPerUnit || 0));
  const setupExVat = Math.max(0, Number(cfg && cfg.setupExVat != null ? cfg.setupExVat : cs.setupExVat || 165));

  const clickExVatPerSheet = resolveClickCostPerSheetExVat_(cs, sheetSize, printMode);
  const paperExVatPerSheet = resolvePaperCostPerSheetExVat_(cs, paperKey);
  const printExVatPerUnit = clickExVatPerSheet * sheetsPerUnit;
  const paperExVatPerUnit = paperExVatPerSheet * sheetsPerUnit;
  const unitExVat = printExVatPerUnit + paperExVatPerUnit + extraExVatPerUnit;
  const runExVat = (unitExVat * qty) + setupExVat;

  const wastePercent = Number(cs.wastePercent || 6);
  const overheadPercent = Number(cs.overheadPercent || 8);
  const defaultMarginPercent = Number(cs.minMarginQty100PlusPercent || 30);
  const marginPercent = Number(cfg && cfg.minMarginPercent != null ? cfg.minMarginPercent : defaultMarginPercent);
  const margin = Math.max(0.01, Math.min(0.95, marginPercent / 100));
  const bufferPercent = Number(cs.printstationBufferPercent || 8) / 100;

  const exVatWithWaste = runExVat * (1 + (wastePercent / 100));
  const exVatWithOverhead = exVatWithWaste * (1 + (overheadPercent / 100));
  const costBasedInclVat = (exVatWithOverhead / (1 - margin)) * 1.15;
  const floorInclVat = baseInclVat > 0 ? (baseInclVat * (1 + bufferPercent)) : 0;
  const finalInclVat = Math.max(costBasedInclVat, floorInclVat);

  return {
    base: finalInclVat,
    estimatedCostExVat: exVatWithOverhead,
    estimatedCostInclVat: exVatWithOverhead * 1.15,
    costBreakdown: {
      qty,
      sheetSize,
      sheetsPerUnit,
      printMode,
      paperKey,
      clickExVatPerSheet,
      paperExVatPerSheet,
      printExVatPerUnit,
      paperExVatPerUnit,
      extraExVatPerUnit,
      setupExVat,
      wastePercent,
      overheadPercent,
      minMarginPercent: marginPercent,
      printstationBufferPercent: bufferPercent * 100,
    },
  };
}

function applyPaperCostWithFloor_(product, answers, cfg) {
  const estimated = estimatePaperCostQuote_(product, answers, cfg);
  if (!estimated) return { base: Math.max(0, Number(cfg && cfg.baseInclVat || 0)), qty: Math.max(1, Number(cfg && cfg.qty || 1)) };
  return {
    base: estimated.base,
    qty: Math.max(1, Number(cfg && cfg.qty || 1)),
    totalQty: Number(cfg && cfg.totalQty || cfg && cfg.qty || 1),
    estimatedCostExVat: estimated.estimatedCostExVat,
    estimatedCostInclVat: estimated.estimatedCostInclVat,
    costBreakdown: estimated.costBreakdown,
  };
}

function loadLocalPriceCostSettings_() {
  try {
    const raw = window.localStorage.getItem(PRICE_COST_SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_err) {
    return {};
  }
}

function saveLocalPriceCostSettings_(map) {
  try {
    window.localStorage.setItem(PRICE_COST_SETTINGS_STORAGE_KEY, JSON.stringify(map || {}));
  } catch (_err) {
    // non-fatal
  }
}

function getPriceCostSettings_() {
  if (!state.priceCostSettings || typeof state.priceCostSettings !== "object") {
    state.priceCostSettings = loadLocalPriceCostSettings_();
  }
  return state.priceCostSettings;
}

function getCostSettingsForProduct_(product) {
  const defaults = getProductCostDefaults_(product);
  const map = getPriceCostSettings_();
  const productKey = String(product && (product.slug || product.id || product.name) || "");
  const raw = map[productKey];
  if (!raw || typeof raw !== "object") return defaults;
  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return Object.keys(defaults).reduce((acc, k) => {
    acc[k] = num(raw[k], defaults[k]);
    return acc;
  }, {});
}

function saveCostSettingsForProduct_(product, costSettings) {
  const defaults = getProductCostDefaults_(product);
  if (!Object.keys(defaults).length) return;
  const map = getPriceCostSettings_();
  const productKey = String(product && (product.slug || product.id || product.name) || "");
  if (!productKey) return;
  const next = {};
  Object.keys(defaults).forEach((k) => {
    const n = Number(costSettings && costSettings[k]);
    next[k] = Number.isFinite(n) ? n : defaults[k];
  });
  map[productKey] = next;
  state.priceCostSettings = map;
  saveLocalPriceCostSettings_(map);
}

async function ensurePrintstationPricebookLoaded_() {
  if (state.printstationPricebook) return state.printstationPricebook;
  if (state.printstationPricebookLoadPromise) return state.printstationPricebookLoadPromise;
  state.printstationPricebookLoadPromise = (async () => {
    try {
      const res = await fetch(PRINTSTATION_PRICEBOOK_FILE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const products = Array.isArray(payload && payload.products) ? payload.products : [];
      state.printstationPricebook = {
        source: String(payload && payload.source || "PrintStation snapshot"),
        generatedAt: String(payload && payload.generatedAt || ""),
        products,
      };
    } catch (_err) {
      state.printstationPricebook = {
        source: "",
        generatedAt: "",
        products: [],
      };
    } finally {
      state.printstationPricebookLoadPromise = null;
      if (state.tab === "price_list") render();
    }
    return state.printstationPricebook;
  })();
  return state.printstationPricebookLoadPromise;
}

function loadLocalPriceCatalog_() {
  try {
    const raw = window.localStorage.getItem(PRICE_LIST_STORAGE_KEY);
    if (!raw) return cloneJson_(DEFAULT_PRICE_CATALOG);
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.products) || !parsed.products.length) {
      return cloneJson_(DEFAULT_PRICE_CATALOG);
    }
    return parsed;
  } catch (_err) {
    return cloneJson_(DEFAULT_PRICE_CATALOG);
  }
}

function saveLocalPriceCatalog_(catalog) {
  try {
    window.localStorage.setItem(PRICE_LIST_STORAGE_KEY, JSON.stringify(catalog || DEFAULT_PRICE_CATALOG));
  } catch (_err) {
    // non-fatal
  }
}

function getPriceCatalog_() {
  return loadLocalPriceCatalog_();
}

function getProductFromCatalog_(catalog, productId) {
  const source = catalog && Array.isArray(catalog.products) ? catalog.products : [];
  if (!source.length) return null;
  return source.find(p => p.id === productId) || source[0];
}

function roundQuote_(value, roundTo) {
  const v = Number(value || 0);
  const r = Number(roundTo || 0);
  if (!(r > 0)) return v;
  return Math.ceil(v / r) * r;
}

function calcFinishing_(dataMap, optionKey, type, enabled) {
  const res = { price: 0, setup: 0 };
  if (enabled !== "yes" || !dataMap || optionKey === undefined || optionKey === null || optionKey === "" || optionKey === "none") {
    return res;
  }
  if (type === "lamination") {
    const parts = String(optionKey).split("_");
    const idx = parts[0];
    const subtype = parts[1] || "1";
    const row = dataMap[idx];
    if (!row) return res;
    if (String(subtype) === "2") {
      res.price = Number(row.price_2 || 0);
      res.setup = Number(row.setup_2 || 0);
      return res;
    }
    res.price = Number(row.price_1 || 0);
    res.setup = Number(row.setup_1 || 0);
    return res;
  }
  const row = dataMap[optionKey];
  if (!row) return res;
  res.price = Number(row.price || 0);
  res.setup = Number(row.setup || 0);
  return res;
}

function calcFinishingSet_(dataMap, optionKey, _type, enabled, qty) {
  const res = { price: 0, setup: 0, total: 0 };
  if (enabled !== "yes" || !dataMap || optionKey === undefined || optionKey === null || optionKey === "" || optionKey === "none") {
    return res;
  }
  const row = dataMap[optionKey];
  if (!row) return res;
  const price = Number(row.price || 0);
  const setup = Number(row.setup || 0);
  const setQty = Number(row.set_qty || 1) > 0 ? Number(row.set_qty || 1) : 1;
  const sets = Math.ceil((Number(qty || 0) || 0) / setQty);
  const total = (sets * price) + setup;
  return { price, setup, total };
}

function calculatePrintstationStandard_(options, pricingData) {
  const qty = Number.parseInt(String(resolveQtyFromAnswers_(options) || ""), 10) || 0;
  if (!qty) return { base: 0 };

  let versions = Number.parseInt(options.versions, 10) || 1;
  if (versions < 1) versions = 1;
  let versionsCostTotal = 0;
  let totalQty = qty;
  if (String(pricingData.versions_enabled || "") === "yes") {
    const vMin = Number.parseInt(pricingData.versions_min, 10) || 1;
    const vMax = Number.parseInt(pricingData.versions_max, 10) || 0;
    if (versions < vMin) versions = vMin;
    if (vMax > 0 && versions > vMax) versions = vMax;
    totalQty = qty * versions;
    versionsCostTotal = Number(pricingData.versions_cost || 0) * versions;
  }

  const sizeIdx = options.size;
  const sidesIdx = options.sides;
  const paperIdx = options.paper;
  const colourIdx = options.colour;
  const timeIdx = options.time !== undefined && options.time !== null && options.time !== "" ? options.time : pricingData.default_turnaround;

  const paperPrice = pricingData.paper && pricingData.paper[paperIdx] ? Number(pricingData.paper[paperIdx].price || 0) : 0;
  const impPrice = pricingData.impressions && pricingData.impressions[colourIdx] ? Number(pricingData.impressions[colourIdx].price || 0) : 0;
  const sideSetup = pricingData.sides && pricingData.sides[sidesIdx] ? Number(pricingData.sides[sidesIdx].price || 0) : 0;
  const impMult = pricingData.sides && pricingData.sides[sidesIdx] ? Number(pricingData.sides[sidesIdx].mult || 1) : 1;
  const sizeUnits = pricingData.sizes && pricingData.sizes[sizeIdx] ? Number.parseInt(pricingData.sizes[sizeIdx].units, 10) || 1 : 1;
  const unitsPerSheet = sizeUnits > 0 ? sizeUnits : 1;

  const finishLam = calcFinishing_(pricingData.lamination, options.lamination, "lamination", pricingData.lamination_enabled);
  const finishDie = calcFinishing_(pricingData.die_cutting, options.die_cutting, "die_cutting", pricingData.die_cutting_enabled);
  const finishCrease = calcFinishing_(pricingData.creasing, options.creasing, "creasing", pricingData.creasing_enabled);
  const finishPunch = calcFinishingSet_(pricingData.punch_holes, options.punch_holes, "punch_holes", pricingData.punch_holes_enabled, totalQty);
  const finishCorner = calcFinishingSet_(pricingData.rounded_corners, options.rounded_corners, "rounded_corners", pricingData.rounded_corners_enabled, totalQty);

  const sheets = Math.ceil(totalQty / unitsPerSheet);
  const costPerSheet = (impPrice * impMult) + paperPrice + finishLam.price + finishDie.price + finishCrease.price;
  const subtotal = (sheets * costPerSheet) + sideSetup + finishLam.setup + finishDie.setup + finishCrease.setup + finishPunch.total + finishCorner.total + versionsCostTotal;

  let turnaroundMarkup = 0;
  if (pricingData.turnaround && pricingData.turnaround[timeIdx]) {
    turnaroundMarkup = Number(pricingData.turnaround[timeIdx].markup || 0);
  }
  const base = subtotal * (1 + turnaroundMarkup);
  return { base, qty, totalQty };
}

function parseQuantities_(pricingData) {
  const list = Array.isArray(pricingData && pricingData.quantities) ? pricingData.quantities : [];
  const nums = list.map((v) => Number.parseInt(String(v || ""), 10)).filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return [];
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

function buildStandardBaselineAnswers_(pricingData, qty) {
  const pd = pricingData && typeof pricingData === "object" ? pricingData : {};
  const versionsMin = Number.parseInt(String(pd.versions_min || 1), 10);
  const timeDefault = Number.parseInt(String(pd.default_turnaround || 0), 10);
  // Folded products always require creasing — the scraper captured prices with crease[0]
  // selected, so the calibration baseline must match that or we double-count crease cost.
  const creasingDefault = String(pd.creasing_enabled || "") === "yes" ? "0" : "none";
  return {
    qty: String(qty),
    versions: String(Number.isFinite(versionsMin) && versionsMin > 0 ? versionsMin : 1),
    size: "0",
    colour: "0",
    sides: "0",
    paper: "0",
    time: String(Number.isFinite(timeDefault) && timeDefault >= 0 ? timeDefault : 0),
    lamination: "none",
    die_cutting: "none",
    creasing: creasingDefault,
    punch_holes: "0",
    rounded_corners: "0",
  };
}

function resolveStandardBaselineForQty_(product, pricingData, qty) {
  const pd = pricingData && typeof pricingData === "object" ? pricingData : {};
  const targetQty = Number.parseInt(String(qty || ""), 10);
  if (!(targetQty > 0)) return 0;

  // Use live AJAX prices from snapshot when available — these are exact Printstation prices.
  const tiers = product && product.pricingTiers && typeof product.pricingTiers === "object"
    ? product.pricingTiers : null;
  if (tiers) {
    const exact = Number(tiers[String(targetQty)]);
    if (exact > 0) return exact;
    // Interpolate between nearest known tiers for non-standard quantities
    const tierQtys = Object.keys(tiers).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
    if (tierQtys.length > 0) {
      const below = tierQtys.filter((q) => q <= targetQty);
      const above = tierQtys.filter((q) => q > targetQty);
      if (below.length && above.length) {
        const lo = below[below.length - 1];
        const hi = above[0];
        const pLo = Number(tiers[String(lo)]);
        const pHi = Number(tiers[String(hi)]);
        const t = (targetQty - lo) / (hi - lo);
        return Math.round((pLo + t * (pHi - pLo)) * 100) / 100;
      }
      // Beyond the highest tier — extrapolate from last two points
      if (!above.length && tierQtys.length >= 2) {
        const lo = tierQtys[tierQtys.length - 2];
        const hi = tierQtys[tierQtys.length - 1];
        const pLo = Number(tiers[String(lo)]);
        const pHi = Number(tiers[String(hi)]);
        const rate = (pHi - pLo) / (hi - lo);
        return Math.max(pHi, Math.round((pHi + rate * (targetQty - hi)) * 100) / 100);
      }
      // Below the lowest tier — use lowest known price
      return Number(tiers[String(tierQtys[0])]);
    }
  }

  // Formula fallback for products without live tier data.
  const baseDisplayed = Number(product && product.basePriceInclVat || 0);
  if (!(baseDisplayed > 0)) return 0;

  const qtyTiers = parseQuantities_(pd);
  const refQty = qtyTiers.length ? qtyTiers[0] : targetQty;
  const refAnswers = buildStandardBaselineAnswers_(pd, refQty);
  const refRaw = calculatePrintstationStandard_(refAnswers, pd);
  const refCalc = Number(refRaw && refRaw.base || 0);
  const scale = refCalc > 0 ? (baseDisplayed / refCalc) : 1;

  const targetAnswers = buildStandardBaselineAnswers_(pd, targetQty);
  const targetRaw = calculatePrintstationStandard_(targetAnswers, pd);
  const targetBase = Number(targetRaw && targetRaw.base || 0);
  if (targetBase > 0) return targetBase * (scale > 0 ? scale : 1);

  if (targetQty === refQty) return baseDisplayed;
  if (refQty > 0) return baseDisplayed * (targetQty / refQty);
  return baseDisplayed;
}

function resolveQtyFromAnswers_(answers) {
  const src = answers && typeof answers === "object" ? answers : {};
  const candidateKeys = ["qty", "qty[]", "quantity", "ink_qty", "ink_qty[]"];
  for (const k of candidateKeys) {
    const raw = src[k];
    const v = Number.parseInt(String(raw || ""), 10);
    if (Number.isFinite(v) && v > 0) return v;
  }

  // Fallback: any answer key that contains "qty" should be considered.
  for (const [k, raw] of Object.entries(src)) {
    if (!String(k).toLowerCase().includes("qty")) continue;
    const txt = String(raw || "");
    const v = Number.parseInt(txt, 10);
    if (Number.isFinite(v) && v > 0) return v;
    const m = txt.match(/\d+/);
    if (m) {
      const vv = Number.parseInt(m[0], 10);
      if (Number.isFinite(vv) && vv > 0) return vv;
    }
  }
  return 1;
}

function resolveTurnaroundMarkup_(pricingData, answers) {
  const arr = pricingData && Array.isArray(pricingData.turnaround) ? pricingData.turnaround : [];
  if (!arr.length) return 0;
  const candidateKeys = ["time", "turnaround", "ink_time"];
  let idx = -1;
  for (const k of candidateKeys) {
    const v = Number.parseInt(String(answers && answers[k] || ""), 10);
    if (Number.isFinite(v) && v >= 0) {
      idx = v;
      break;
    }
  }
  if (idx < 0 || idx >= arr.length) idx = Number.parseInt(String(pricingData.default_turnaround || 0), 10);
  if (!Number.isFinite(idx) || idx < 0 || idx >= arr.length) idx = 0;
  const row = arr[idx] || {};
  const markup = Number(row.markup || 0);
  return Number.isFinite(markup) ? markup : 0;
}

function parseOptionIndex_(answers, key, fallback = 0) {
  const src = answers && typeof answers === "object" ? answers : {};
  const raw = src[key];
  const n = Number.parseInt(String(raw || ""), 10);
  if (Number.isFinite(n) && n >= 0) return n;
  return fallback;
}

function calcAreaFromSize_(sizeObj) {
  const w = Number(sizeObj && sizeObj.width || 0);
  const h = Number(sizeObj && sizeObj.height || 0);
  if (!(w > 0) || !(h > 0)) return 0;
  return (w / 1000) * (h / 1000);
}

function interpolateTierPrice_(tierMap, qty) {
  const q = Number.parseInt(String(qty || ""), 10);
  if (!(q > 0) || !tierMap || typeof tierMap !== "object") return 0;
  const points = Object.entries(tierMap)
    .map(([k, v]) => ({ qty: Number.parseInt(String(k || ""), 10), price: Number(v) }))
    .filter((p) => Number.isFinite(p.qty) && p.qty > 0 && Number.isFinite(p.price) && p.price > 0)
    .sort((a, b) => a.qty - b.qty);
  if (!points.length) return 0;
  const exact = points.find((p) => p.qty === q);
  if (exact) return exact.price;
  if (q <= points[0].qty) return points[0].price;
  if (q >= points[points.length - 1].qty) {
    const max = points[points.length - 1];
    const unit = max.price / max.qty;
    return unit * q;
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (q <= a.qty || q >= b.qty) continue;
    const t = (q - a.qty) / (b.qty - a.qty);
    return a.price + ((b.price - a.price) * t);
  }
  return 0;
}

function resolveFridgeBaseTier_(productType, size, qty) {
  const calendarTiers = {
    dl: { 50: 295, 100: 535, 250: 1075, 500: 1915, 1000: 3355 },
    a5: { 50: 335, 100: 595, 250: 1260, 500: 2340, 1000: 4140 },
    a4: { 50: 440, 100: 830, 250: 1740, 500: 3300, 1000: 5990 },
  };
  const magnetTiers = {
    "90x90": { 50: 315, 100: 525, 250: 1115, 500: 1990, 1000: 3490 },
    a6: { 50: 370, 100: 675, 250: 1490, 500: 2690, 1000: 4815 },
    a5: { 50: 650, 100: 1240, 250: 2815, 500: 5190, 1000: 9365 },
  };
  const type = String(productType || "fridge_calendar");
  const s = String(size || "").toLowerCase();
  const safeQty = Number.parseInt(String(qty || ""), 10) || 1;
  if (type === "fridge_magnet") {
    const alias = {
      dl: "a6",
      a4: "a5",
      custom: "a5",
    };
    const key = magnetTiers[s] ? s : (alias[s] || "a5");
    let base = interpolateTierPrice_(magnetTiers[key], safeQty);
    if (s === "dl") base *= 0.9;
    if (s === "a4") base *= 1.5;
    if (s === "custom") base *= 1.2;
    return base;
  }
  const calAlias = {
    "90x90": "a5",
    a6: "a5",
    custom: "a5",
  };
  const key = calendarTiers[s] ? s : (calAlias[s] || "a5");
  let base = interpolateTierPrice_(calendarTiers[key], safeQty);
  if (s === "90x90" || s === "a6") base *= 0.85;
  if (s === "custom") base *= 1.15;
  return base;
}

function calculateCustomFridgeQuote_(product, answers) {
  const qty = resolveQtyFromAnswers_(answers);
  const productType = String(answers && answers.product_type || "fridge_calendar");
  const size = String(answers && answers.size || "a5").toLowerCase();
  const printSides = String(answers && answers.print_sides || "one_side");
  const finish = String(answers && answers.finish || "none");
  const magnetType = String(answers && answers.magnet_type || "strip");
  const turnaround = String(answers && answers.time || "0");
  const versions = String(answers && answers.versions || "1");

  let base = resolveFridgeBaseTier_(productType, size, qty);
  if (!(base > 0)) base = Number(product && product.basePriceInclVat || 0) * qty;
  if (!(base > 0)) return { base: 0, qty };

  const sidesFactor = printSides === "two_sides" ? 1.35 : 1;
  const finishFactor = (finish === "gloss" || finish === "matt") ? 1.1 : 1;
  const versionFactor = versions === "2" ? 1.06 : (versions === "3" ? 1.1 : 1);
  const rushFactor = turnaround === "2" ? 1.2 : (turnaround === "1" ? 1.12 : 1);
  const fullSheetAddon = magnetType === "full_sheet" ? (qty * 6) : 0;

  const total = (base * sidesFactor * finishFactor * versionFactor * rushFactor) + fullSheetAddon;
  return { base: Math.max(0, total), qty, totalQty: qty };
}

function calculateCustomCarMagnetsQuote_(product, answers) {
  const qty = resolveQtyFromAnswers_(answers);
  const size = String(answers && answers.size || "300x200").toLowerCase();
  const turnaround = String(answers && answers.time || "0");
  const versions = String(answers && answers.versions || "1");

  // Printstation pricing (pairs, 5-business-day base)
  const tiers = {
    "200x200": { 1: 150, 2: 195, 3: 290, 4: 355, 5: 400, 10: 665 },
    "300x200": { 1: 150, 2: 300, 3: 385, 4: 425, 5: 530, 10: 1015 },
    "300x300": { 1: 220, 2: 380, 3: 460, 4: 605, 5: 745, 10: 1425 },
    "400x300": { 1: 300, 2: 425, 3: 625, 4: 820, 5: 1015, 10: 1925 },
    "400x400": { 1: 355, 2: 540, 3: 790, 4: 1040, 5: 1275, 10: 2420 },
    "600x400": { 1: 425, 2: 790, 3: 1155, 4: 1510, 5: 1850, 10: 3480 },
    "700x500": { 1: 590, 2: 1130, 3: 1640, 4: 2145, 5: 2625, 10: 5005 },
    "800x600": { 1: 790, 2: 1510, 3: 2190, 4: 2865, 5: 3480, 10: 6820 },
  };

  let base;
  if (size === "custom") {
    const w = Number(answers && answers.carMagnetWidth || 0);
    const h = Number(answers && answers.carMagnetHeight || 0);
    const customArea = w * h;
    const sizeAreaList = [
      { key: "200x200", area: 40000 },
      { key: "300x200", area: 60000 },
      { key: "300x300", area: 90000 },
      { key: "400x300", area: 120000 },
      { key: "400x400", area: 160000 },
      { key: "600x400", area: 240000 },
      { key: "700x500", area: 350000 },
      { key: "800x600", area: 480000 },
    ];
    if (!(customArea > 0)) {
      base = 0;
    } else if (customArea <= sizeAreaList[0].area) {
      base = interpolateTierPrice_(tiers[sizeAreaList[0].key], qty);
    } else if (customArea >= sizeAreaList[sizeAreaList.length - 1].area) {
      const lo = sizeAreaList[sizeAreaList.length - 2];
      const hi = sizeAreaList[sizeAreaList.length - 1];
      const loPrice = interpolateTierPrice_(tiers[lo.key], qty);
      const hiPrice = interpolateTierPrice_(tiers[hi.key], qty);
      const t = (customArea - lo.area) / (hi.area - lo.area);
      base = loPrice + (hiPrice - loPrice) * t;
    } else {
      for (let i = 0; i < sizeAreaList.length - 1; i++) {
        const lo = sizeAreaList[i];
        const hi = sizeAreaList[i + 1];
        if (customArea >= lo.area && customArea <= hi.area) {
          const loPrice = interpolateTierPrice_(tiers[lo.key], qty);
          const hiPrice = interpolateTierPrice_(tiers[hi.key], qty);
          const t = (customArea - lo.area) / (hi.area - lo.area);
          base = loPrice + (hiPrice - loPrice) * t;
          break;
        }
      }
    }
  } else {
    base = interpolateTierPrice_(tiers[size] || tiers["300x200"], qty);
  }

  if (!(base > 0)) base = Number(product && product.basePriceInclVat || 0) * qty;
  if (!(base > 0)) return { base: 0, qty };

  // Turnaround: 3-day +10% min R50 extra, 2-day +15% min R100 extra
  let rushAddon = 0;
  if (turnaround === "1") rushAddon = Math.max(50, base * 0.10);
  else if (turnaround === "2") rushAddon = Math.max(100, base * 0.15);

  const versionFactor = versions === "2" ? 1.06 : (versions === "3" ? 1.1 : 1);
  return { base: Math.max(0, (base * versionFactor) + rushAddon), qty, totalQty: qty };
}

function calculateCustomXBannersQuote_(product, answers) {
  const qty = resolveQtyFromAnswers_(answers);
  const size = String(answers && answers.size || "1600x590").toLowerCase();
  const unitType = String(answers && answers.unit_type || "print_only");
  const stock = String(answers && answers.stock || "non_curl_pvc");
  const carryBag = String(answers && answers.carry_bag || "included");
  const turnaround = String(answers && answers.time || "0");
  const versions = String(answers && answers.versions || "1");

  const tiers = {
    "1600x590": { 1: 485, 2: 920, 3: 1320, 4: 1690, 5: 2050, 10: 3890, 20: 7390 },
    "1800x800": { 1: 595, 2: 1130, 3: 1630, 4: 2080, 5: 2520, 10: 4790, 20: 9090 },
  };
  let base = interpolateTierPrice_(tiers[size] || tiers["1600x590"], qty);
  if (!(base > 0)) base = Number(product && product.basePriceInclVat || 0) * qty;
  if (!(base > 0)) return { base: 0, qty };

  const unitFactor = unitType === "full_unit" ? 1.45 : 1;
  const stockFactor = stock === "pp_synthetic" ? 1.08 : 1;
  const bagAddon = (carryBag === "included" && unitType !== "full_unit") ? (qty * 75) : 0;
  const versionFactor = versions === "2" ? 1.06 : (versions === "3" ? 1.1 : 1);
  const rushFactor = turnaround === "2" ? 1.2 : (turnaround === "1" ? 1.12 : 1);
  return { base: Math.max(0, (base * unitFactor * stockFactor * versionFactor * rushFactor) + bagAddon), qty, totalQty: qty };
}

function calculateCustomPvcBannersQuote_(product, answers) {
  const qty = resolveQtyFromAnswers_(answers);
  const size = String(answers && answers.size || "a2").toLowerCase();
  const sides = String(answers && answers.sides || "one_side_black_back");
  const finishing = String(answers && answers.finishing || "none");
  const turnaround = String(answers && answers.time || "0");
  const versions = String(answers && answers.versions || "1");

  const tiers = {
    a2: { 1: 150, 2: 280, 3: 405, 4: 530, 5: 650, 10: 1190 },
    a1: { 1: 230, 2: 430, 3: 630, 4: 820, 5: 995, 10: 1890 },
    "2x1": { 1: 420, 2: 790, 3: 1160, 4: 1510, 5: 1830, 10: 3490 },
    "3x1": { 1: 610, 2: 1150, 3: 1690, 4: 2190, 5: 2670, 10: 5090 },
  };
  let base = interpolateTierPrice_(tiers[size] || tiers.a2, qty);
  if (size === "custom") base = interpolateTierPrice_(tiers["2x1"], qty) * 1.25;
  if (!(base > 0)) base = Number(product && product.basePriceInclVat || 0) * qty;
  if (!(base > 0)) return { base: 0, qty };

  const sidesFactor = sides === "double_sided" ? 1.65 : 1;
  const finishingFactor = finishing === "hem_eyelets" ? 1.16 : (finishing === "eyelets" ? 1.08 : 1);
  const versionFactor = versions === "2" ? 1.06 : (versions === "3" ? 1.1 : 1);
  const rushFactor = turnaround === "2" ? 1.2 : (turnaround === "1" ? 1.12 : 1);
  return { base: Math.max(0, base * sidesFactor * finishingFactor * versionFactor * rushFactor), qty, totalQty: qty };
}

function calculateCustomPullUpBannersQuote_(product, answers) {
  const qty = resolveQtyFromAnswers_(answers);
  const size = String(answers && answers.size || "2000x850").toLowerCase();
  const unitType = String(answers && answers.unit_type || "full_unit");
  const baseType = String(answers && answers.base_type || "economy");
  const stock = String(answers && answers.stock || "non_curl_pvc");
  const turnaround = String(answers && answers.time || "0");
  const versions = String(answers && answers.versions || "1");

  const tiers = {
    "2000x850": { 1: 995, 2: 1890, 3: 2730, 4: 3520, 5: 4250, 10: 8090, 20: 15390 },
    "2000x1000": { 1: 1175, 2: 2235, 3: 3235, 4: 4170, 5: 5030, 10: 9570, 20: 18190 },
  };
  let base = interpolateTierPrice_(tiers[size] || tiers["2000x850"], qty);
  if (!(base > 0)) base = Number(product && product.basePriceInclVat || 0) * qty;
  if (!(base > 0)) return { base: 0, qty };

  const unitFactor = unitType === "print_only" ? 0.58 : 1;
  const baseTypeFactor = baseType === "premium" ? 1.22 : 1;
  const stockFactor = stock === "blockout_pp" ? 1.08 : 1;
  const versionFactor = versions === "2" ? 1.06 : (versions === "3" ? 1.1 : 1);
  const rushFactor = turnaround === "2" ? 1.2 : (turnaround === "1" ? 1.12 : 1);
  return { base: Math.max(0, base * unitFactor * baseTypeFactor * stockFactor * versionFactor * rushFactor), qty, totalQty: qty };
}

function calculateCustomCertificatesQuote_(product, answers) {
  const qty = resolveQtyFromAnswers_(answers);
  const size = String(answers && answers.size || "a4");
  const paper = String(answers && answers.paper || "250gsm");
  const finish = String(answers && answers.finish || "none");
  const turnaround = String(answers && answers.time || "0");
  const tiers = {
    a5: { 10: 145, 20: 220, 30: 295, 40: 360, 50: 430, 60: 495, 80: 620, 100: 740, 150: 1080, 200: 1390, 250: 1690, 300: 1990 },
    a4: { 10: 170, 20: 260, 30: 345, 40: 430, 50: 510, 60: 595, 80: 750, 100: 890, 150: 1310, 200: 1690, 250: 2050, 300: 2410 },
    a3: { 10: 295, 20: 470, 30: 635, 40: 790, 50: 940, 60: 1090, 80: 1390, 100: 1650, 150: 2440, 200: 3150, 250: 3810, 300: 4450 },
  };
  let base = interpolateTierPrice_(tiers[size] || tiers.a4, qty);
  if (!(base > 0)) base = Number(product && product.basePriceInclVat || 0) * qty;
  if (!(base > 0)) return { base: 0, qty };
  const paperFactor = paper === "350gsm" ? 1.1 : (paper === "300gsm" ? 1.05 : 1);
  const finishFactor = (finish === "matt" || finish === "gloss") ? 1.1 : 1;
  const rushFactor = turnaround === "2" ? 1.2 : (turnaround === "1" ? 1.12 : 1);
  const baseline = Math.max(0, base * paperFactor * finishFactor * rushFactor);
  const sheetSize = size === "a3" ? "a3" : "a4";
  const sheetsPerUnit = size === "a3" ? 2 : 1;
  const finishExtra = (finish === "matt" || finish === "gloss") ? 0.95 : 0;
  return applyPaperCostWithFloor_(product, answers, {
    qty,
    totalQty: qty,
    sheetSize,
    printMode: "full_colour",
    sheetsPerUnit,
    paperKey: paper,
    extraExVatPerUnit: finishExtra,
    baseInclVat: baseline,
  });
}

function calculateCustomPrintedMenusQuote_(product, answers) {
  const run = resolveQtyFromAnswers_(answers);
  const sets = Number.parseInt(String(answers && answers.sets || "1"), 10) || 1;
  const qty = run * sets;
  const type = String(answers && answers.type || "standard");
  const size = String(answers && answers.size || "a4");
  const paper = String(answers && answers.paper || "115gsm_gloss");
  const finish = String(answers && answers.finish || "none");
  const turnaround = String(answers && answers.time || "0");

  const tiers = {
    a4: { 50: 110, 60: 125, 70: 140, 80: 155, 90: 170, 100: 185, 150: 260 },
    a3: { 50: 170, 60: 195, 70: 220, 80: 245, 90: 270, 100: 295, 150: 430 },
    dl: { 50: 95, 60: 108, 70: 122, 80: 136, 90: 150, 100: 164, 150: 235 },
  };
  const perSetBase = interpolateTierPrice_(tiers[size] || tiers.a4, run);
  let base = perSetBase * sets;
  if (!(base > 0)) base = Number(product && product.basePriceInclVat || 0) * sets;
  if (!(base > 0)) return { base: 0, qty };

  const typeFactor = type === "single_fold" ? 1.14 : (type === "letter_fold" ? 1.2 : (type === "z_fold" ? 1.22 : 1));
  const paperFactor = paper === "250gsm_matt" ? 1.22 : (paper === "170gsm_gloss" ? 1.1 : 1);
  const finishFactor = (finish === "matt" || finish === "gloss") ? 1.12 : 1;
  const rushFactor = turnaround === "2" ? 1.2 : (turnaround === "1" ? 1.12 : 1);
  const baseline = Math.max(0, base * typeFactor * paperFactor * finishFactor * rushFactor);
  const sheetSize = size === "a3" ? "a3" : "a4";
  const foldSheets = type === "letter_fold" || type === "z_fold" || type === "single_fold" ? 2 : 1;
  const paperKey = paper.includes("250gsm") ? "250gsm" : (paper.includes("170gsm") ? "150gsm" : "115gsm");
  return applyPaperCostWithFloor_(product, answers, {
    qty,
    totalQty: qty,
    sheetSize,
    printMode: "full_colour",
    sheetsPerUnit: foldSheets,
    paperKey,
    extraExVatPerUnit: 0.4,
    baseInclVat: baseline,
  });
}

function calculateCustomPresentationFoldersQuote_(product, answers) {
  const qty = resolveQtyFromAnswers_(answers);
  const size = String(answers && answers.size || "a4_plus");
  const printColour = String(answers && answers.print_colour || "full_colour");
  const type = String(answers && answers.type || "no_flap");
  const printSides = String(answers && answers.print_sides || "outside");
  const lamination = String(answers && answers.lamination || "none");
  const turnaround = String(answers && answers.time || "0");
  const tiers = {
    a4_plus: { 30: 340, 40: 425, 50: 510, 60: 595, 70: 680, 80: 760, 90: 840 },
    a4: { 30: 315, 40: 395, 50: 470, 60: 545, 70: 620, 80: 695, 90: 770 },
  };
  let base = interpolateTierPrice_(tiers[size] || tiers.a4_plus, qty);
  if (!(base > 0)) base = Number(product && product.basePriceInclVat || 0);
  if (!(base > 0)) return { base: 0, qty };
  const colourFactor = printColour === "black" ? 0.85 : 1;
  const typeFactor = type === "blank_flap" ? 1.08 : (type === "printed_flap" ? 1.18 : 1);
  const sidesFactor = printSides === "both_sides" ? 1.2 : 1;
  const lamFactor = (lamination === "matt" || lamination === "gloss") ? 1.1 : 1;
  const rushFactor = turnaround === "2" ? 1.2 : (turnaround === "1" ? 1.12 : 1);
  const baseline = Math.max(0, base * colourFactor * typeFactor * sidesFactor * lamFactor * rushFactor);
  return applyPaperCostWithFloor_(product, answers, {
    qty,
    totalQty: qty,
    sheetSize: "a3",
    printMode: printColour === "black" ? "black_white" : "full_colour",
    sheetsPerUnit: printSides === "both_sides" ? 2 : 1,
    paperKey: "250gsm",
    extraExVatPerUnit: type === "printed_flap" ? 1.2 : (type === "blank_flap" ? 0.8 : 0.5),
    baseInclVat: baseline,
  });
}

function calculateCustomBookletsQuote_(product, answers) {
  const qty = resolveQtyFromAnswers_(answers);
  const size = String(answers && answers.size || "a5");
  const pages = Number.parseInt(String(answers && answers.pages || "8"), 10) || 8;
  const innersColour = String(answers && answers.colour || "full_colour");
  const paper = String(answers && answers.paper || "115gsm");
  const cover = String(answers && answers.cover || "115gsm");
  const coverPrintColour = String(answers && answers.print_colour || "full_colour");
  const lamination = String(answers && answers.lamination || "none");
  const turnaround = String(answers && answers.time || "0");

  const exactByPaper = {
    "80gsm_bond": { 20: 960, 30: 1165, 40: 1390, 50: 1575, 100: 2500 },
    "90gsm_bond": { 20: 965, 30: 1170, 40: 1400, 50: 1585, 100: 2515 },
    "115gsm": { 20: 965, 30: 1175, 40: 1400, 50: 1585, 100: 2520 },
    "130gsm": { 20: 970, 30: 1175, 40: 1405, 50: 1590, 100: 2530 },
    "150gsm": { 20: 970, 30: 1180, 40: 1410, 50: 1595, 100: 2540 },
  };
  const cs = getCostSettingsForProduct_(product);

  function resolvePrintstationFloor_() {
    if (
      size === "a4" &&
      pages === 8 &&
      cover === "120gsm_bond" &&
      innersColour === "full_colour" &&
      coverPrintColour === "full_colour" &&
      lamination === "none" &&
      turnaround === "0"
    ) {
      const exactQtyMap = exactByPaper[paper] || null;
      const exact = Number(exactQtyMap && exactQtyMap[qty] || 0);
      if (Number.isFinite(exact) && exact > 0) return exact;
    }
    return 0;
  }

  function resolveLegacyBaseline_() {
    const baseTiers = { 20: 795, 30: 1010, 40: 1200, 50: 1365, 100: 2580 };
    let base = interpolateTierPrice_(baseTiers, qty);
    if (!(base > 0)) base = Number(product && product.basePriceInclVat || 0) * (qty / 20);
    if (!(base > 0)) return 0;
    const sizeFactor = {
      a4: 1.18,
      a5: 1,
      a6: 0.74,
      dl: 0.86,
      "210x210": 1.18,
    }[size] || 1;
    const pageFactor = pages > 8 ? (1 + ((pages - 8) * 0.026)) : 1;
    const paperFactor = {
      "80gsm_bond": 0.973,
      "90gsm_bond": 0.987,
      "115gsm": 1,
      "130gsm": 1.006,
      "150gsm": 1.012,
    }[paper] || 1;
    const innersColourFactor = innersColour === "black_white" ? 0.72 : 1;
    const coverFactor = {
      "80gsm_bond": 0.96,
      "90gsm": 0.975,
      "115gsm": 1,
      "120gsm_bond": 1.005,
      "150gsm": 1.02,
      "200gsm": 1.045,
      "250gsm": 1.07,
    }[cover] || 1;
    const coverPrintFactor = coverPrintColour === "black_white" ? 0.9 : 1;
    const lamFactor = lamination === "none" ? 1 : (lamination === "gloss" ? 1.075 : 1.085);
    return Math.max(0, base * sizeFactor * pageFactor * paperFactor * innersColourFactor * coverFactor * coverPrintFactor * lamFactor);
  }

  const clickCostExVat = {
    a4_bw: Number(cs.clickCostA4BwExVat || 0.15),
    a4_colour: Number(cs.clickCostA4ColourExVat || 0.40),
    a3_bw: Number(cs.clickCostA3BwExVat || 0.29),
    a3_colour: Number(cs.clickCostA3ColourExVat || 0.78),
  };
  const paperCostExVatPerSheet = {
    "80gsm_bond": Number(cs.paper80gsmBondExVat || 0.116),
    "90gsm_bond": Number(cs.paper90gsmBondExVat || 0.135),
    "115gsm": Number(cs.paper115gsmExVat || 0.262),
    "120gsm_bond": Number(cs.paper120gsmBondExVat || 1.75),
    "130gsm": Number(cs.paper130gsmExVat || 0.292),
    "150gsm": Number(cs.paper150gsmExVat || 0.338),
    "200gsm": Number(cs.paper200gsmExVat || 0.456),
    "250gsm": Number(cs.paper250gsmExVat || 0.570),
  };

  const clickSize = (size === "a4" || size === "210x210") ? "a3" : "a4";
  const innerClickExVat = innersColour === "black_white"
    ? clickCostExVat[`${clickSize}_bw`]
    : clickCostExVat[`${clickSize}_colour`];
  const coverClickExVat = coverPrintColour === "black_white"
    ? clickCostExVat[`${clickSize}_bw`]
    : clickCostExVat[`${clickSize}_colour`];

  const pagesPerInnerSheet = {
    a4: 4,      // A4 booklet printed on SRA3/A3 imposition
    a5: 8,
    a6: 16,
    dl: 12,
    "210x210": 4,
  }[size] || 4;
  const innerPages = Math.max(4, pages) - 4;
  const innerSheetsPerBook = Math.max(1, Math.ceil(innerPages / pagesPerInnerSheet));
  const coverSheetsPerBook = 1;

  const innerPaperExVat = Number(paperCostExVatPerSheet[paper] || paperCostExVatPerSheet["150gsm"]);
  const coverPaperKey = cover === "120gsm_bond" ? "150gsm" : cover;
  const coverPaperExVat = Number(paperCostExVatPerSheet[coverPaperKey] || paperCostExVatPerSheet["150gsm"]);

  const printExVatPerBook = (innerSheetsPerBook * 2 * innerClickExVat) + (coverSheetsPerBook * 2 * coverClickExVat);
  const paperExVatPerBook = (innerSheetsPerBook * innerPaperExVat) + (coverSheetsPerBook * coverPaperExVat);

  const setupExVat = Number(cs.setupExVat || 165);
  const stitchExVatPerBook = Number(cs.stitchExVatPerBook || 0.65);
  const laminationBaseExVatPerCover = Number(cs.laminationExVatPerCover || 1.85);
  const laminationExVatPerCover = lamination === "none" ? 0 : laminationBaseExVatPerCover;
  const wastePercent = Number(cs.wastePercent || 6);
  const overheadPercent = Number(cs.overheadPercent || 8);
  const minMarginByQty = qty >= 100
    ? (Number(cs.minMarginQty100PlusPercent || 30) / 100)
    : qty >= 50
      ? (Number(cs.minMarginQty50to99Percent || 35) / 100)
      : qty >= 40
        ? (Number(cs.minMarginQty40to49Percent || 38) / 100)
        : qty >= 30
          ? (Number(cs.minMarginQty30to39Percent || 42) / 100)
          : (Number(cs.minMarginQty20to29Percent || 45) / 100);

  const unitExVatCost = printExVatPerBook + paperExVatPerBook + stitchExVatPerBook + laminationExVatPerCover;
  const runExVatCost = (unitExVatCost * qty) + setupExVat;
  const exVatWithWaste = runExVatCost * (1 + (wastePercent / 100));
  const exVatWithOverheads = exVatWithWaste * (1 + (overheadPercent / 100));
  const costBasedInclVat = (exVatWithOverheads / Math.max(0.01, (1 - minMarginByQty))) * 1.15;

  const baselineFloor = Math.max(resolvePrintstationFloor_(), resolveLegacyBaseline_());
  const buffer = Number(cs.printstationBufferPercent || 8) / 100;
  const printstationSafetyFloor = baselineFloor > 0 ? baselineFloor * (1 + buffer) : 0;

  const rush3DayFactor = 1 + (Number(cs.rush3DayPercent || 12) / 100);
  const rush2DayFactor = 1 + (Number(cs.rush2DayPercent || 22) / 100);
  const rushFactor = turnaround === "2" ? rush2DayFactor : (turnaround === "1" ? rush3DayFactor : 1);
  const finalInclVat = Math.max(costBasedInclVat, printstationSafetyFloor) * rushFactor;
  const estimatedCostExVat = exVatWithOverheads * rushFactor;
  const estimatedCostInclVat = estimatedCostExVat * 1.15;

  return {
    base: Math.max(0, finalInclVat),
    qty,
    totalQty: qty,
    estimatedCostExVat,
    estimatedCostInclVat,
    costBreakdown: {
      innerSheetsPerBook,
      coverSheetsPerBook,
      printExVatPerBook,
      paperExVatPerBook,
      stitchExVatPerBook,
      laminationExVatPerCover,
      setupExVat,
      wastePercent,
      overheadPercent,
      minMarginByQty,
    },
  };
}

function calculateCustomNcrBooksQuote_(product, answers) {
  const qty = resolveQtyFromAnswers_(answers);
  const size = String(answers && answers.size || "a5");
  const processing = String(answers && answers.processing || "50_2x");
  const perf = String(answers && answers.perf || "std");

  // Webprinter prices — total for the whole order (all books), incl. VAT
  const std = {
    a6: {
      "50_2x":  { 1: 187.85, 2: 343.04, 3: 362.64, 4: 398.57, 5: 423.08, 10: 744.88, 12: 883.72, 15: 1089.54, 20: 1432.58, 25: 1739.68, 30: 2084.35, 50: 3436.88 },
      "100_2x": { 1: 408.64, 2: 565.63, 3: 693.76, 4: 821.89, 5: 857.67, 10: 1344.81, 12: 1553.74, 15: 1864.26, 20: 2381.40, 25: 2850.07, 30: 3148.30, 50: 5434.63 },
      "50_3x":  { 1: 375.16, 2: 506.76, 3: 603.72, 4: 671.83, 5: 737.62, 10: 1163.57, 12: 1319.41, 15: 1564.13, 20: 1979.69, 25: 2359.47, 30: 2562.42, 50: 4452.29 },
    },
    a5: {
      "50_2x":  { 1: 305.46, 2: 571.73, 3: 610.93, 4: 717.11, 5: 735.08, 10: 1354.17, 12: 1746.21, 15: 1968.37, 20: 2603.80, 25: 3206.56, 30: 3817.49, 50: 6248.14 },
      "100_2x": { 1: 535.61, 2: 821.89, 3: 1075.84, 4: 1280.16, 5: 1282.47, 10: 2264.82, 12: 2858.15, 15: 3199.83, 20: 4170.63, 25: 5086.02, 30: 5768.43, 50: 9733.39 },
      "50_3x":  { 1: 476.74, 2: 701.84, 3: 896.92, 4: 1000.81, 5: 1083.93, 10: 1880.42, 12: 2174.78, 15: 2648.06, 20: 3421.46, 25: 3756.22, 30: 4729.53, 50: 8015.74 },
    },
    a4: {
      "50_2x":  { 1: 486.78, 2: 753.04, 3: 808.58, 4: 955.60, 5: 1107.51, 10: 2133.35, 12: 2553.16, 15: 3131.42, 20: 4100.09, 25: 5021.38, 30: 6001.48, 50: 9840.20 },
      "100_2x": { 1: 715.69, 2: 1122.02, 3: 1422.15, 4: 1662.25, 5: 1891.96, 10: 3460.71, 12: 4100.22, 15: 4990.21, 20: 6468.92, 25: 7880.68, 30: 9069.19, 50: 15254.60 },
      "50_3x":  { 1: 672.98, 2: 1092.01, 3: 1390.98, 4: 1541.04, 5: 1746.52, 10: 3169.82, 12: 3695.04, 15: 4523.86, 20: 5910.22, 25: 7196.16, 30: 8280.76, 50: 13909.80 },
    },
  };
  const perf2 = {
    a6: {
      "50_2x":  { 1: 216.03, 2: 394.49, 3: 417.03, 4: 458.36, 5: 486.54, 10: 856.61, 12: 1016.28, 15: 1252.98, 20: 1647.47, 25: 2000.63, 30: 2397.00, 50: 3952.42 },
      "100_2x": { 1: 469.93, 2: 650.47, 3: 797.82, 4: 945.17, 5: 986.33, 10: 1546.53, 12: 1786.80, 15: 2143.90, 20: 2738.61, 25: 3277.58, 30: 3620.54, 50: 6249.83 },
      "50_3x":  { 1: 431.43, 2: 582.77, 3: 694.28, 4: 772.60, 5: 848.27, 10: 1338.11, 12: 1517.32, 15: 1798.75, 20: 2276.65, 25: 2713.39, 30: 2946.78, 50: 5120.13 },
    },
    a5: {
      "50_2x":  { 1: 351.28, 2: 657.48, 3: 702.57, 4: 824.67, 5: 845.34, 10: 1557.30, 12: 2008.14, 15: 2263.62, 20: 2994.37, 25: 3687.54, 30: 4390.11, 50: 7185.36 },
      "100_2x": { 1: 615.96, 2: 945.17, 3: 1237.22, 4: 1472.19, 5: 1474.84, 10: 2604.54, 12: 3286.87, 15: 3679.81, 20: 4796.22, 25: 5848.93, 30: 6633.70, 50: 11193.40 },
      "50_3x":  { 1: 548.25, 2: 807.11, 3: 1031.46, 4: 1150.93, 5: 1246.51, 10: 2162.48, 12: 2500.99, 15: 3045.26, 20: 3934.68, 25: 4319.66, 30: 5438.96, 50: 9218.10 },
    },
    a4: {
      "50_2x":  { 1: 559.80, 2: 866.00, 3: 929.87, 4: 1098.94, 5: 1273.64, 10: 2453.35, 12: 2936.13, 15: 3601.13, 20: 4715.10, 25: 5774.59, 30: 6901.70, 50: 11316.23 },
      "100_2x": { 1: 823.04, 2: 1290.32, 3: 1635.47, 4: 1911.59, 5: 2175.76, 10: 3979.82, 12: 4715.25, 15: 5738.74, 20: 7439.26, 25: 9062.78, 30: 10429.57, 50: 17542.79 },
      "50_3x":  { 1: 773.93, 2: 1255.81, 3: 1599.63, 4: 1772.20, 5: 2008.49, 10: 3645.29, 12: 4249.30, 15: 5202.44, 20: 6796.75, 25: 8275.58, 30: 9522.87, 50: 15996.27 },
    },
  };

  const table = perf === "perf2" ? perf2 : std;
  const procTiers = (table[size] || table.a5)[processing] || table.a5["50_2x"];
  const base = interpolateTierPrice_(procTiers, qty);
  if (!(base > 0)) return { base: 0, qty };
  return { base, qty, totalQty: qty };
}

function calculateCustomNameBadgesQuote_(product, answers) {
  const qty = resolveQtyFromAnswers_(answers);
  const size = String(answers && answers.size || "medium");
  const shape = String(answers && answers.shape || "rectangle");
  const material = String(answers && answers.material || "white");
  const fixture = String(answers && answers.fixture || "pin");
  const turnaround = String(answers && answers.time || "0");
  const tiers = {
    small: { 1: 115, 5: 410, 10: 760, 20: 1390, 30: 1980, 50: 3190, 100: 5990 },
    medium: { 1: 130, 5: 470, 10: 860, 20: 1580, 30: 2260, 50: 3630, 100: 6830 },
    large: { 1: 155, 5: 560, 10: 1030, 20: 1890, 30: 2710, 50: 4350, 100: 8180 },
  };
  let base = interpolateTierPrice_(tiers[size] || tiers.medium, qty);
  if (!(base > 0)) base = Number(product && product.basePriceInclVat || 0) * qty;
  if (!(base > 0)) return { base: 0, qty };
  const shapeFactor = shape === "oval" ? 1.04 : 1;
  const materialFactor = material === "gold" ? 1.12 : (material === "silver" ? 1.08 : 1);
  const fixtureFactor = fixture === "magnet" ? 1.18 : 1;
  const rushFactor = turnaround === "2" ? 1.2 : (turnaround === "1" ? 1.12 : 1);
  return { base: Math.max(0, base * shapeFactor * materialFactor * fixtureFactor * rushFactor), qty, totalQty: qty };
}

function calculateCustomColopStampsQuote_(product, answers) {
  const qty = resolveQtyFromAnswers_(answers);
  const stampType = String(answers && answers.stamp_type || "compact");
  const model = String(answers && answers.model || "c20");
  const pad = String(answers && answers.pad_colour || "black");
  const turnaround = String(answers && answers.time || "0");
  const tiers = {
    c10: { 1: 245, 2: 470, 3: 685, 4: 890, 5: 1090, 6: 1285, 7: 1470, 8: 1650, 9: 1820, 10: 1980 },
    c20: { 1: 285, 2: 545, 3: 795, 4: 1035, 5: 1270, 6: 1500, 7: 1715, 8: 1925, 9: 2125, 10: 2310 },
    c30: { 1: 335, 2: 640, 3: 935, 4: 1220, 5: 1495, 6: 1765, 7: 2020, 8: 2270, 9: 2510, 10: 2740 },
    c40: { 1: 395, 2: 755, 3: 1100, 4: 1430, 5: 1750, 6: 2065, 7: 2360, 8: 2650, 9: 2930, 10: 3190 },
  };
  let base = interpolateTierPrice_(tiers[model] || tiers.c20, qty);
  if (!(base > 0)) base = Number(product && product.basePriceInclVat || 0) * qty;
  if (!(base > 0)) return { base: 0, qty };
  const typeFactor = stampType === "dater" ? 1.22 : (stampType === "round" ? 1.08 : 1);
  const colourFactor = pad === "black" ? 1 : 1.02;
  const rushFactor = turnaround === "2" ? 1.2 : (turnaround === "1" ? 1.12 : 1);
  return { base: Math.max(0, base * typeFactor * colourFactor * rushFactor), qty, totalQty: qty };
}

function calculateCustomSignboardsQuote_(product, answers) {
  const qty = resolveQtyFromAnswers_(answers);
  const size = String(answers && answers.size || "a4").toLowerCase();
  const substrate = String(answers && answers.substrate || "abs_0_9mm").toLowerCase();
  const sides = String(answers && answers.sides || "one_side").toLowerCase();
  const media = String(answers && answers.media || "gloss_indoor").toLowerCase();
  const turnaround = String(answers && answers.time || "0");

  // Base prices at qty=1, one side, ABS 0.9mm, White Gloss Vinyl Indoor
  const base1 = {
    a6: 115, a5: 120, a4: 140, a3: 170, a2: 230, a1: 350, a0: 585,
    sq200: 125, sq300: 150, sq400: 185, sq500: 225, sq600: 285,
  };
  // Area in m² for each size (for substrate/media modifier calculations)
  const sizeAreaM2 = {
    a6: 0.01554, a5: 0.03108, a4: 0.06237, a3: 0.12474, a2: 0.24948,
    a1: 0.49961, a0: 0.99996, sq200: 0.04, sq300: 0.09, sq400: 0.16,
    sq500: 0.25, sq600: 0.36,
  };
  // Sorted by area for custom-size interpolation
  const sizeList = Object.entries(sizeAreaM2).map(([k, a]) => ({ key: k, area: a })).sort((a, b) => a.area - b.area);

  // Substrate rate differential vs ABS 0.9mm (R/m²), passed through with markup
  const subRateDiff = { correx_3mm: -50, abs_0_9mm: 0, abs_1_5mm: 60, mfoam_3mm: 60, mfoam_5mm: 125 };
  // Vinyl media rate differential vs Gloss Indoor (R/m²)
  const medRateDiff = { gloss_indoor: 0, gloss_outdoor: 34 };

  // Quantity discount scale factors (price at qty n = base1 × n × factor)
  const qtyFactors = { 1: 1.00, 2: 0.92, 3: 0.85, 4: 0.80, 5: 0.75, 10: 0.65 };
  const buildTiers = (b) => {
    const t = {};
    Object.entries(qtyFactors).forEach(([q, f]) => { t[Number(q)] = Math.round(b * Number(q) * f); });
    return t;
  };

  let basePrice1;
  let areaM2;

  if (size === "custom") {
    const w = Number(answers && answers.signboardWidth || 0);
    const h = Number(answers && answers.signboardHeight || 0);
    const customArea = (w / 1000) * (h / 1000);
    if (!(customArea > 0)) return { base: 0, qty };
    areaM2 = customArea;
    if (customArea <= sizeList[0].area) {
      basePrice1 = base1[sizeList[0].key];
    } else if (customArea >= sizeList[sizeList.length - 1].area) {
      const lo = sizeList[sizeList.length - 2];
      const hi = sizeList[sizeList.length - 1];
      const t = (customArea - lo.area) / (hi.area - lo.area);
      basePrice1 = base1[lo.key] + (base1[hi.key] - base1[lo.key]) * t;
    } else {
      for (let i = 0; i < sizeList.length - 1; i++) {
        const lo = sizeList[i];
        const hi = sizeList[i + 1];
        if (customArea >= lo.area && customArea <= hi.area) {
          const t = (customArea - lo.area) / (hi.area - lo.area);
          basePrice1 = base1[lo.key] + (base1[hi.key] - base1[lo.key]) * t;
          break;
        }
      }
    }
  } else {
    basePrice1 = base1[size] || base1.a4;
    areaM2 = sizeAreaM2[size] || sizeAreaM2.a4;
  }

  if (!(basePrice1 > 0)) return { base: 0, qty };

  let base = interpolateTierPrice_(buildTiers(basePrice1), qty);
  if (!(base > 0)) base = basePrice1 * qty;

  // Substrate and media modifiers (material cost diff × area × qty, passed through with 1.5× markup)
  const subDiff = (subRateDiff[substrate] || 0) * areaM2 * qty * 1.5;
  const medDiff = (medRateDiff[media] || 0) * areaM2 * qty * 1.5;
  base = Math.max(base + subDiff + medDiff, (basePrice1 * 0.5) * qty);

  // Double sided: substrate already included, adds ~60% for second vinyl + print pass
  if (sides === "double_sided") base *= 1.6;

  // Turnaround rush fee
  let rushAddon = 0;
  if (turnaround === "1") rushAddon = Math.max(50, base * 0.10);
  else if (turnaround === "2") rushAddon = Math.max(100, base * 0.15);

  return { base: Math.max(0, base + rushAddon), qty, totalQty: qty };
}

function calculateCustomCanvasQuote_(product, answers) {
  const size = String(answers && answers.size || "a1").toLowerCase();
  const cs = state.canvasPricingSettings || DEFAULT_CANVAS_PRICING_SETTINGS;

  // Canvas area = full roll width × (frame height + mounting allowance each end).
  // The roll width is fully consumed per print — side offcuts are wasted.
  const rollW  = (cs.rollWidthMm || 610) / 1000;         // m
  const mount  = (cs.mountingAllowanceMm || 80) / 1000;  // m per end

  const prices = { a1: 750, a2: 500, a3: 350, a4: 250, a5: 200 };
  // Frame dimensions (portrait): width × height in mm
  const frameDims = {
    a1: { w: 594, h: 841 }, a2: { w: 420, h: 594 },
    a3: { w: 297, h: 420 }, a4: { w: 210, h: 297 }, a5: { w: 148, h: 210 },
  };
  const frameCosts = { a1: cs.frameCostA1, a2: cs.frameCostA2, a3: cs.frameCostA3, a4: cs.frameCostA4, a5: cs.frameCostA5 };

  if (size === "custom") {
    const w = Number(answers && answers.width_mm || 0);
    const h = Number(answers && answers.height_mm || 0);
    if (!(w >= 400 && w <= 2500 && h >= 400 && h <= 1500)) return { base: 0, qty: 1, totalQty: 1 };
    const printArea  = (w / 1000) * (h / 1000);
    // For custom, use the longer dimension as the roll-length axis
    const frameH = Math.max(w, h) / 1000;
    const canvasArea = rollW * (frameH + 2 * mount);
    const inkCost    = printArea  * cs.inkCostPerMl * cs.inkMlPerM2;
    const mediaCost  = canvasArea * cs.canvasCostPerM2;
    const supplierFrameCost = Math.round(w * h * 900 / 1000000 * 100) / 100;
    const totalCostInclVat  = inkCost + mediaCost + supplierFrameCost;
    const margin = totalCostInclVat < 200  ? 0.60
      : totalCostInclVat < 500  ? 0.55
      : totalCostInclVat < 1000 ? 0.50
      : totalCostInclVat < 2000 ? 0.45
      : 0.40;
    const retail = Math.ceil(totalCostInclVat / (1 - margin) / 10) * 10;
    const note = supplierFrameCost < 1200
      ? "⚠️ Additional shipping charge applies — frame cost is below R1,200. Notify the customer."
      : null;
    return { base: retail, qty: 1, totalQty: 1,
      estimatedCostInclVat: totalCostInclVat, estimatedCostExVat: totalCostInclVat / 1.15, note,
      costBreakdown: { ink: inkCost, canvas: mediaCost, frame: supplierFrameCost,
        inkArea: printArea, canvasArea } };
  }

  const dims       = frameDims[size]   || frameDims.a1;
  const base       = prices[size]      || prices.a1;
  const printArea  = (dims.w / 1000) * (dims.h / 1000);
  const canvasArea = rollW * (dims.h / 1000 + 2 * mount);  // roll width × (frame height + top + bottom)
  const inkCost    = printArea  * cs.inkCostPerMl * cs.inkMlPerM2;
  const mediaCost  = canvasArea * cs.canvasCostPerM2;
  const frameCost  = frameCosts[size]  || frameCosts.a1;
  const totalCostInclVat = inkCost + mediaCost + frameCost;
  return { base, qty: 1, totalQty: 1,
    estimatedCostInclVat: totalCostInclVat, estimatedCostExVat: totalCostInclVat / 1.15,
    costBreakdown: { ink: inkCost, canvas: mediaCost, frame: frameCost,
      inkArea: printArea, canvasArea } };
}

function calculateCustomCanvasFrameQuote_(product, answers) {
  const w = Number(answers && answers.width_mm || 0);
  const h = Number(answers && answers.height_mm || 0);
  if (!(w >= 400 && w <= 2500 && h >= 400 && h <= 1500)) return { base: 0, qty: 1, totalQty: 1 };
  // Blank Print Media formula: W(mm) × H(mm) × 900 / 1,000,000 for 25 mm depth
  const supplierCost = Math.round(w * h * 900 / 1000000 * 100) / 100;
  // Tiered retail margin: starts at 60% (matching A1 canvas) and reduces with frame size
  const margin = supplierCost < 200  ? 0.60
    : supplierCost < 500  ? 0.55
    : supplierCost < 1000 ? 0.50
    : supplierCost < 2000 ? 0.45
    : 0.40;
  const retail = Math.ceil(supplierCost / (1 - margin) / 10) * 10;
  const note = supplierCost < 1200
    ? "⚠️ Additional shipping charge applies — frame cost is below R1,200. Notify the customer."
    : null;
  return { base: retail, qty: 1, totalQty: 1, estimatedCostInclVat: supplierCost, estimatedCostExVat: supplierCost / 1.15, note };
}

function calculateCustomDomedStickersQuote_(product, answers) {
  const qty = resolveQtyFromAnswers_(answers);
  const widthMm = Number.parseInt(String(answers && answers.width_mm || "30"), 10) || 30;
  const lengthMm = Number.parseInt(String(answers && answers.length_mm || "30"), 10) || 30;
  const turnaround = String(answers && answers.time || "0");
  const tiers = { 20: 250, 50: 420, 100: 690, 200: 1250, 300: 1770, 500: 2760, 1000: 5200 };
  let base = interpolateTierPrice_(tiers, qty);
  if (!(base > 0)) base = Number(product && product.basePriceInclVat || 0);
  if (!(base > 0)) return { base: 0, qty };
  const safeArea = Math.max(1, widthMm * lengthMm);
  const areaFactor = Math.pow(safeArea / (30 * 30), 0.55);
  const rushFactor = turnaround === "2" ? 1.16 : (turnaround === "1" ? 1.08 : 1);
  const total = Math.max(250, base * areaFactor * rushFactor);
  return { base: total, qty, totalQty: qty };
}

function calculateCustomLicenseDiscQuote_(product, answers) {
  const qty = resolveQtyFromAnswers_(answers);
  const turnaround = String(answers && answers.time || "0");
  const tiers = {
    10: 150, 20: 240, 50: 495, 100: 890, 150: 1290, 200: 1680, 250: 2050, 300: 2390,
    400: 3040, 500: 3650, 600: 4230, 700: 4780, 800: 5310, 900: 5820, 1000: 6310,
  };
  let base = interpolateTierPrice_(tiers, qty);
  if (!(base > 0)) base = Number(product && product.basePriceInclVat || 0);
  if (!(base > 0)) return { base: 0, qty };
  const rushFactor = turnaround === "2" ? 1.18 : (turnaround === "1" ? 1.1 : 1);
  return { base: Math.max(150, base * rushFactor), qty, totalQty: qty };
}

function calculateCustomTentCalendarsQuote_(product, answers) {
  const sets = resolveQtyFromAnswers_(answers);
  const printRun = Number.parseInt(String(answers && answers.print_run || "100"), 10) || 100;
  const lamination = String(answers && answers.lamination || "none");
  const turnaround = String(answers && answers.time || "0");
  const tiers = {
    10: 125, 20: 150, 30: 175, 40: 200, 50: 220, 60: 235, 70: 250, 80: 258, 90: 262,
    100: 265, 150: 360, 200: 450, 250: 530, 500: 980, 1000: 1760, 1500: 2520, 2000: 3240, 2500: 3960,
  };
  let basePerSet = interpolateTierPrice_(tiers, printRun);
  if (!(basePerSet > 0)) basePerSet = Number(product && product.basePriceInclVat || 0);
  if (!(basePerSet > 0)) return { base: 0, qty: sets, totalQty: sets };
  const lamFactor = (lamination === "gloss" || lamination === "matt") ? 1.08 : 1;
  const rushFactor = turnaround === "2" ? 1.18 : (turnaround === "1" ? 1.1 : 1);
  const baseline = basePerSet * Math.max(1, sets) * lamFactor * rushFactor;
  return applyPaperCostWithFloor_(product, answers, {
    qty: sets,
    totalQty: sets * printRun,
    sheetSize: "a4",
    printMode: "full_colour",
    sheetsPerUnit: Math.max(1, Math.round(printRun / 2)),
    paperKey: "300gsm",
    extraExVatPerUnit: lamination === "none" ? 0 : 6.5,
    baseInclVat: baseline,
  });
}

function buildLargeFormatComboKey_(answers) {
  const a = answers && typeof answers === "object" ? answers : {};
  const colour = String(a.colour !== undefined ? a.colour : "0");
  const media = String(a.media !== undefined ? a.media : "0");
  const sides = String(a.sides !== undefined ? a.sides : "0");
  const substrate = String(a.substrate !== undefined ? a.substrate : "0");
  return `colour=${colour}|media=${media}|sides=${sides}|substrate=${substrate}`;
}

function lookupLargeFormatTierPrice_(comboTiers, qty) {
  if (!comboTiers || typeof comboTiers !== "object") return 0;
  const exact = Number(comboTiers[String(qty)]);
  if (exact > 0) return exact;
  const tierQtys = Object.keys(comboTiers).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
  if (!tierQtys.length) return 0;
  const below = tierQtys.filter((q) => q <= qty);
  const above = tierQtys.filter((q) => q > qty);
  if (below.length && above.length) {
    const lo = below[below.length - 1];
    const hi = above[0];
    const t = (qty - lo) / (hi - lo);
    return Math.round((Number(comboTiers[String(lo)]) + t * (Number(comboTiers[String(hi)]) - Number(comboTiers[String(lo)]))) * 100) / 100;
  }
  if (!above.length && tierQtys.length >= 2) {
    const lo = tierQtys[tierQtys.length - 2];
    const hi = tierQtys[tierQtys.length - 1];
    const rate = (Number(comboTiers[String(hi)]) - Number(comboTiers[String(lo)])) / (hi - lo);
    return Math.max(Number(comboTiers[String(hi)]), Math.round((Number(comboTiers[String(hi)]) + rate * (qty - hi)) * 100) / 100);
  }
  return Number(comboTiers[String(tierQtys[0])]);
}

function calculatePrintstationLargeFormat_(product, answers, pricingData) {
  const pd = pricingData && typeof pricingData === "object" ? pricingData : {};
  const qty = resolveQtyFromAnswers_(answers);

  const media = Array.isArray(pd.lf_media) ? pd.lf_media : [];
  const substrate = Array.isArray(pd.lf_substrate) ? pd.lf_substrate : [];
  const sizes = Array.isArray(pd.lf_predefined_sizes) ? pd.lf_predefined_sizes : [];
  const printing = Array.isArray(pd.lf_printing) ? pd.lf_printing : [];
  const mediaIdx = parseOptionIndex_(answers, "media", 0);
  const substrateIdx = parseOptionIndex_(answers, "substrate", 0);
  const sizeIdx = parseOptionIndex_(answers, "predefined_size", 0);
  const printIdx = parseOptionIndex_(answers, "colour", 0);

  const selMedia = media[mediaIdx] || media[0] || {};
  const selSubstrate = substrate[substrateIdx] || substrate[0] || {};
  const selSize = sizes[sizeIdx] || sizes[0] || {};
  const selPrinting = printing[printIdx] || printing[0] || {};

  // Use live AJAX prices from snapshot — exact Printstation prices per size × option-combo × qty.
  // Keyed by "{width}x{height}" to avoid label collisions (multiple "Square" sizes etc.).
  const liveTiers = product && product.pricingTiers && typeof product.pricingTiers === "object"
    ? product.pricingTiers : null;
  if (liveTiers) {
    const w = Number(selSize && selSize.width || 0);
    const h = Number(selSize && selSize.height || 0);
    const sizeKey = w > 0 && h > 0 ? `${w}x${h}` : null;
    const allSizeTiers = sizeKey && liveTiers[sizeKey] && typeof liveTiers[sizeKey] === "object"
      ? liveTiers[sizeKey] : null;
    if (allSizeTiers) {
      const comboKey = buildLargeFormatComboKey_(answers);
      const defaultKey = "colour=0|media=0|sides=0|substrate=0";
      const comboTiers = allSizeTiers[comboKey] || allSizeTiers[defaultKey] || null;
      const price = lookupLargeFormatTierPrice_(comboTiers, qty);
      if (price > 0) {
        const turnMarkup = resolveTurnaroundMarkup_(pd, answers);
        return { base: price * (1 + turnMarkup), qty, totalQty: qty, _lfSizeKey: sizeKey };
      }
    }
  }

  const minMediaRate = media.length
    ? Math.min(...media.map((m) => Number(m && m.rate || 0)).filter((n) => Number.isFinite(n)))
    : 0;
  const selMediaRate = Number(selMedia && selMedia.rate || 0);
  const selSubstrateRate = Number(selSubstrate && selSubstrate.rate || 0);

  // Use snapshot base as the anchor (what PrintStation exposes publicly),
  // then adjust by large-format option deltas so we don't under-quote.
  let basePerUnit = Number(product && product.basePriceInclVat || 0);

  // Media uplift is materially significant for posters; scale from min media.
  // Empirically, PrintStation poster jumps align to about R5 per media-rate step.
  if (Number.isFinite(selMediaRate) && Number.isFinite(minMediaRate)) {
    const mediaDelta = Math.max(0, selMediaRate - minMediaRate);
    basePerUnit += mediaDelta * 5;
  }

  if (Number.isFinite(selSubstrateRate) && selSubstrateRate > 0) {
    basePerUnit += selSubstrateRate;
  }

  // Respect predefined-size scaling where present.
  if (sizes.length > 1) {
    const baseArea = calcAreaFromSize_(sizes[0]);
    const selArea = calcAreaFromSize_(selSize);
    if (baseArea > 0 && selArea > 0) {
      basePerUnit *= (selArea / baseArea);
    }
  }

  // Qty scaling for large-format:
  // split into one-time setup + variable run portion so higher qty gets lower unit price.
  const printSetup = Number(selPrinting && selPrinting.setup || 0);
  const cuttingSetup = Number(pd.lf_cutting_setup || 0);
  const totalSetup = Math.max(0, printSetup + cuttingSetup);

  let baseBeforeTurnaround = basePerUnit * qty;
  if (totalSetup > 0 && basePerUnit > totalSetup) {
    const variablePerUnit = Math.max(0, basePerUnit - totalSetup);
    baseBeforeTurnaround = (variablePerUnit * qty) + totalSetup;
  }

  const turnMarkup = resolveTurnaroundMarkup_(pd, answers);
  const base = Math.max(0, baseBeforeTurnaround * (1 + turnMarkup));
  return { base, qty, totalQty: qty };
}

function applyPriceAdjustment_(basePrice, qty, adjustment, sizeKey) {
  const base = Number(basePrice || 0);
  const quantity = Number(qty || 0) || 1;
  const quantityOverrides = adjustment && adjustment.quantityOverrides && typeof adjustment.quantityOverrides === "object"
    ? adjustment.quantityOverrides
    : {};
  const sizeQtyKey = sizeKey ? `${sizeKey}::${quantity}` : null;
  const qtyOverride = Number(sizeQtyKey && quantityOverrides[sizeQtyKey] || quantityOverrides[String(quantity)]);
  if (Number.isFinite(qtyOverride) && qtyOverride > 0) {
    const unit = qtyOverride / quantity;
    return {
      finalTotal: qtyOverride,
      unit,
      preRound: qtyOverride,
      quantityOverrideApplied: true,
      quantityOverrideClamped: false,
    };
  }
  const markupFactor = 1 + (Number(adjustment.markupPercent || 0) / 100);
  const shifted = (base * markupFactor) + Number(adjustment.fixedOffset || 0);
  const minApplied = Math.max(shifted, Number(adjustment.minimumPrice || 0));
  const finalTotal = roundQuote_(minApplied, Number(adjustment.roundToNearest || 0));
  const unit = finalTotal / quantity;
  return {
    finalTotal,
    unit,
    preRound: minApplied,
    quantityOverrideApplied: false,
    quantityOverrideClamped: false,
  };
}

function calculatePrintstationQuote_(product, answers, adjustment) {
  if (!product) return null;
  const pricingData = product.pricingData && typeof product.pricingData === "object" ? product.pricingData : null;
  let raw = { base: 0, qty: resolveQtyFromAnswers_(answers) };
  const templateType = String(pricingData && pricingData.template_type || product.templateType || "").toLowerCase();

  if (templateType === "isg_custom_fridge") {
    raw = calculateCustomFridgeQuote_(product, answers);
  } else if (templateType === "isg_custom_domed_stickers") {
    raw = calculateCustomDomedStickersQuote_(product, answers);
  } else if (templateType === "isg_custom_license_disc_stickers") {
    raw = calculateCustomLicenseDiscQuote_(product, answers);
  } else if (templateType === "isg_custom_tent_calendars") {
    raw = calculateCustomTentCalendarsQuote_(product, answers);
  } else if (templateType === "isg_custom_car_magnets") {
    raw = calculateCustomCarMagnetsQuote_(product, answers);
  } else if (templateType === "isg_custom_x_banners") {
    raw = calculateCustomXBannersQuote_(product, answers);
  } else if (templateType === "isg_custom_pvc_banners") {
    raw = calculateCustomPvcBannersQuote_(product, answers);
  } else if (templateType === "isg_custom_pullup_banners") {
    raw = calculateCustomPullUpBannersQuote_(product, answers);
  } else if (templateType === "isg_custom_certificates") {
    raw = calculateCustomCertificatesQuote_(product, answers);
  } else if (templateType === "isg_custom_printed_menus") {
    raw = calculateCustomPrintedMenusQuote_(product, answers);
  } else if (templateType === "isg_custom_presentation_folders") {
    raw = calculateCustomPresentationFoldersQuote_(product, answers);
  } else if (templateType === "isg_custom_booklets") {
    raw = calculateCustomBookletsQuote_(product, answers);
  } else if (templateType === "isg_custom_ncr_books") {
    raw = calculateCustomNcrBooksQuote_(product, answers);
  } else if (templateType === "isg_custom_name_badges") {
    raw = calculateCustomNameBadgesQuote_(product, answers);
  } else if (templateType === "isg_custom_colop_stamps") {
    raw = calculateCustomColopStampsQuote_(product, answers);
  } else if (templateType === "isg_custom_signboards") {
    raw = calculateCustomSignboardsQuote_(product, answers);
  } else if (templateType === "isg_custom_canvas") {
    raw = calculateCustomCanvasQuote_(product, answers);
  } else if (templateType === "isg_custom_canvas_frame") {
    raw = calculateCustomCanvasFrameQuote_(product, answers);
  } else if (pricingData && templateType === "large_format") {
    raw = calculatePrintstationLargeFormat_(product, answers, pricingData);
  } else if (pricingData && (!templateType || templateType === "standard")) {
    raw = calculatePrintstationStandard_(answers, pricingData);
  }
  // Fallback for non-standard templates (large_format, dtf_printing, etc.)
  // so "Calculate Price" always returns a usable quote.
  if (!(raw.base > 0) && Number(product.basePriceInclVat || 0) > 0) {
    const qty = resolveQtyFromAnswers_(answers);
    const turnMarkup = resolveTurnaroundMarkup_(pricingData || {}, answers);
    const base = Number(product.basePriceInclVat || 0) * qty * (1 + turnMarkup);
    raw = { base, qty, totalQty: qty };
  }
  if (raw.base > 0) {
    if (templateType === "standard" && pricingData) {
      // Calibrate against the snapshot: compute ratio of actual Printstation price to
      // formula output at default options, then apply that ratio to the user's formula output.
      // This gives exact prices for default options and proportionally correct prices for
      // all other option combos (sides, paper, lamination, etc.).
      const defaultAnswers = buildStandardBaselineAnswers_(pricingData, raw.qty);
      const defaultCalc = calculatePrintstationStandard_(defaultAnswers, pricingData);
      const snapshotPrice = resolveStandardBaselineForQty_(product, pricingData, raw.qty);
      if (snapshotPrice > 0 && defaultCalc.base > 0) {
        raw.base = raw.base * (snapshotPrice / defaultCalc.base);
      } else if (snapshotPrice > 0) {
        raw.base = Math.max(raw.base, snapshotPrice);
      }
    } else if (templateType !== "large_format") {
      // For large_format, tier prices are the authoritative Printstation prices — don't override them.
      const baseDisplayed = Number(product.basePriceInclVat || 0);
      if (baseDisplayed > 0) raw.base = Math.max(raw.base, baseDisplayed);
    }
  }
  if (!(raw.base > 0)) return null;
  const adjusted = applyPriceAdjustment_(raw.base, raw.qty, adjustment, raw._lfSizeKey || null);
  let estimatedCostInclVat = Number(raw && raw.estimatedCostInclVat || 0);
  let estimatedCostExVat = Number(raw && raw.estimatedCostExVat || 0);
  // If raw calculation didn't include cost data, estimate from product cost settings
  if (!(estimatedCostInclVat > 0)) {
    const cs = getCostSettingsForProduct_(product);
    if (cs && cs.resellDiscountPercent !== undefined) {
      // Printstation resell model: cost = Printstation wholesale × handling overhead
      const discount = Number(cs.resellDiscountPercent || 30) / 100;
      const handling = Number(cs.handlingOverheadPercent || 5) / 100;
      estimatedCostInclVat = raw.base * (1 - discount) * (1 + handling);
      estimatedCostExVat = estimatedCostInclVat / 1.15;
    } else if (cs && cs.supplierCostPercent !== undefined) {
      // Supplier/in-house model: cost = percentage of formula price
      const costPct = Number(cs.supplierCostPercent || 40) / 100;
      const overhead = Number(cs.overheadPercent || 8) / 100;
      estimatedCostInclVat = raw.base * costPct * (1 + overhead);
      estimatedCostExVat = estimatedCostInclVat / 1.15;
    }
  }
  // Override with accurate in-house cost models for products we produce ourselves.
  try {
    const pName = String(product && (product.name || product.label || product.slug) || "").toLowerCase();
    const qty = raw.qty || 1;
    if (pName.includes("business card") && !pName.includes("outsource") && !pName.includes("bulk")) {
      // Business cards: printed in-house on SRA3 350gsm, OPP lam optional.
      const sides = String(answers && answers.sides || "Single Sided");
      const finish = String(answers && answers.finish || "None");
      const lamArg = (finish === "Lamination" || finish === "Gloss Lamination" || finish === "Matt Lamination") ? "Lamination" : "None";
      const inHouseCostExVat = calcBusinessCardCostExVat_(sides, lamArg, qty);
      if (inHouseCostExVat > 0) {
        estimatedCostExVat = inHouseCostExVat;
        estimatedCostInclVat = inHouseCostExVat * 1.15;
      }
    } else if ((pName.includes("flyer") || pName.includes("leaflet")) && !pName.includes("outsource") && !pName.includes("bulk")) {
      // Flyers: printed in-house on SRA3 coated, cut to size.
      // PrintStation stores option values as numeric indices ('0','1','2'...) so resolve labels first.
      const sizeLbl  = resolveFlowFieldLabel_(product, "size",   answers && answers.size);
      const sidesTxt = resolveFlowFieldLabel_(product, "sides",  answers && answers.sides);
      const colrTxt  = resolveFlowFieldLabel_(product, "colour", answers && answers.colour);
      const paperLbl = resolveFlowFieldLabel_(product, "paper",  answers && answers.paper);
      // "A5 (210 x 148mm)" → "A5", "DL (99 x 310mm)" → "DL"
      const outputSize = String(sizeLbl || answers && answers.size || "A5").replace(/\s.*/, "").toUpperCase();
      const sides  = /both/i.test(sidesTxt) ? "Double Sided" : "Single Sided";
      const colour = /black/i.test(colrTxt)  ? "Black & White" : "Colour";
      const rawW   = parseInt(String(paperLbl || answers && answers.paper || "115").replace(/[^0-9]/g, ''), 10) || 115;
      // Map PrintStation weights to nearest Peters Papers weight in our cost table
      const WEIGHT_MAP = { 130: 128, 150: 148, 170: 148 };
      const weight = String(WEIGHT_MAP[rawW] || rawW);
      const lam = String(answers && answers.lamination || answers && answers.finish || "None");
      const inHouseCostExVat = calcFlyerCostExVat_(outputSize, sides, colour, weight, lam, qty);
      if (inHouseCostExVat > 0) {
        estimatedCostExVat = inHouseCostExVat;
        estimatedCostInclVat = inHouseCostExVat * 1.15;
      }
    }
  } catch (_e) { /* leave existing cost estimates in place */ }

  const estimatedMarginRand = estimatedCostInclVat > 0 ? (adjusted.finalTotal - estimatedCostInclVat) : 0;
  const estimatedMarginPercent = estimatedCostInclVat > 0
    ? ((estimatedMarginRand / adjusted.finalTotal) * 100)
    : 0;
  return {
    basePrice: raw.base,
    qty: raw.qty,
    finalTotal: adjusted.finalTotal,
    unit: adjusted.unit,
    preRound: adjusted.preRound,
    quantityOverrideApplied: !!adjusted.quantityOverrideApplied,
    quantityOverrideClamped: !!adjusted.quantityOverrideClamped,
    estimatedCostExVat: estimatedCostExVat > 0 ? estimatedCostExVat : null,
    estimatedCostInclVat: estimatedCostInclVat > 0 ? estimatedCostInclVat : null,
    estimatedMarginRand: estimatedCostInclVat > 0 ? estimatedMarginRand : null,
    estimatedMarginPercent: estimatedCostInclVat > 0 ? estimatedMarginPercent : null,
    costBreakdown: raw && raw.costBreakdown ? raw.costBreakdown : null,
    note: raw && raw.note ? raw.note : null,
  };
}

function calculateCatalogQuote_(product, answers) {
  if (!product || !product.pricing || !answers) return null;
  const pricing = product.pricing || {};
  const qtyMap = pricing.quantityBaseInclVat || {};
  const qtyKey = String(answers.quantity || "");
  const base = Number(qtyMap[qtyKey] || 0);
  if (!(base > 0)) return null;

  const modifiers = pricing.modifiers || {};
  const fields = ["size", "sides", "paper", "finish", "turnaround"];
  let factor = 1;
  fields.forEach((f) => {
    const selected = String(answers[f] || "");
    const map = modifiers[f] || {};
    const m = Number(map[selected] || 1);
    factor *= m > 0 ? m : 1;
  });

  const preRound = base * factor;
  const total = roundQuote_(preRound, pricing.roundToNearest);
  const qty = Number(answers.quantity || 0);
  const unit = qty > 0 ? total / qty : total;
  return {
    base,
    factor,
    preRound,
    total,
    unit,
    roundToNearest: Number(pricing.roundToNearest || 0),
  };
}

const STANDARD_PRINTING_PRICING_ = {
  "A4": {
    "Single Sided": {
      "Black & White": [{maxQty:10,pp:2.50},{maxQty:50,pp:2.00},{maxQty:100,pp:1.50},{maxQty:500,pp:1.40},{maxQty:1000,pp:1.30},{maxQty:Infinity,pp:1.20}],
      "Colour":        [{maxQty:10,pp:8.00},{maxQty:50,pp:6.50},{maxQty:100,pp:5.50},{maxQty:500,pp:5.00},{maxQty:1000,pp:4.50},{maxQty:Infinity,pp:4.00}],
    },
    "Double Sided": {
      "Black & White": [{maxQty:10,pp:3.50},{maxQty:50,pp:2.70},{maxQty:100,pp:2.00},{maxQty:500,pp:1.80},{maxQty:1000,pp:1.70},{maxQty:Infinity,pp:1.50}],
      "Colour":        [{maxQty:10,pp:15.50},{maxQty:50,pp:12.50},{maxQty:100,pp:10.50},{maxQty:500,pp:9.50},{maxQty:1000,pp:8.50},{maxQty:Infinity,pp:7.50}],
    },
  },
  "A3": {
    "Single Sided": {
      "Black & White": [{maxQty:10,pp:3.50},{maxQty:50,pp:2.70},{maxQty:100,pp:2.00},{maxQty:500,pp:1.80},{maxQty:1000,pp:1.70},{maxQty:Infinity,pp:1.50}],
      "Colour":        [{maxQty:10,pp:12.50},{maxQty:50,pp:10.50},{maxQty:100,pp:9.00},{maxQty:500,pp:8.00},{maxQty:1000,pp:7.00},{maxQty:Infinity,pp:5.50}],
    },
    "Double Sided": {
      "Black & White": [{maxQty:10,pp:5.00},{maxQty:50,pp:3.80},{maxQty:100,pp:2.80},{maxQty:500,pp:2.50},{maxQty:1000,pp:2.30},{maxQty:Infinity,pp:1.90}],
      "Colour":        [{maxQty:10,pp:17.00},{maxQty:50,pp:14.00},{maxQty:100,pp:12.00},{maxQty:500,pp:10.50},{maxQty:1000,pp:9.50},{maxQty:Infinity,pp:8.50}],
    },
  },
};
// SRA3 uses the same per-page rates as A3
STANDARD_PRINTING_PRICING_["SRA3"] = STANDARD_PRINTING_PRICING_["A3"];

// Per-sheet pouch lamination prices (incl VAT).
const POUCH_LAMINATION_PRICING_ = {
  "A4": { "Pouch 150mic": 9.00, "Pouch 250mic": 12.00 },
  "A3": { "Pouch 150mic": 15.00, "Pouch 250mic": 17.00 },
  // SRA3 cannot be pouch laminated — must use Roll Encapsulation
};

// Lamination roll costs from supplier invoices (incl VAT).
// Pricing includes 2 waste sheets per run (lead + tail).
const LAM_COSTS_ = {
  // Digi Stick 320mm × 250m gloss: R647/roll = R2.588/m. Roll width 320mm — A2+ not available.
  // Minimum charge covers electricity (heat-up) + setup time.
  opp:   { costPerM: 2.588, rollWidthMm: 320, margin: 0.69, minimum: 45 },
  // 75mic × 635mm × 100m encapsulation: R845/roll = R8.45/m. Roll width 635mm — A0 not available.
  // Per-size minimums (electricity + heat-up). Larger sizes cost more to run.
  encap: { costPerM: 8.45, rollWidthMm: 635, margin: 0.61, minimum: 50,
    sizeMinimums: { "A2": 75, "A1": 95 } },
};

// Portrait sheet dimensions (width × height in mm). Height = roll length consumed per sheet.
const SHEET_DIMS_MM_ = {
  "DL":   { w: 99,  h: 210 },
  "A6":   { w: 105, h: 148 },
  "A5":   { w: 148, h: 210 },
  "A4":   { w: 210, h: 297 },
  "A3":   { w: 297, h: 420 },
  "SRA3": { w: 320, h: 450 },
  "A2":   { w: 420, h: 594 },
  "A1":   { w: 594, h: 841 },
  "A0":   { w: 841, h: 1189 },
};

// Peters Papers coated gloss (PP Print 2 Side Coated) — ex VAT per cut sheet.
const PETERS_COATED_EX_VAT_ = {
  a4:   { 90: 0.213, 115: 0.262, 128: 0.292, 148: 0.338, 200: 0.456, 250: 0.570, 300: 0.684, 350: 0.861 },
  a3:   { 90: 0.445, 115: 0.546, 128: 0.608, 148: 0.703, 200: 0.950, 250: 1.188, 300: 1.426, 350: 1.793 },
  sra3: { 90: 0.445, 115: 0.546, 128: 0.608, 148: 0.703, 200: 0.950, 250: 1.188, 300: 1.426, 350: 1.793 },
};
// Peters Papers Navigator uncoated bond — ex VAT per cut sheet.
const PETERS_BOND_EX_VAT_ = { a4: 0.116, a3: 0.266, sra3: 0.330 };
// TM350 wide-format media cost per m² (ex VAT).
const TM350_MEDIA_PER_M2_ = { bond: 3.95, poster: 20.80, photo: 46.00, canvas: 85.00 };
// TM350 ink usage in ml per m² by media type.
const TM350_INK_ML_PER_M2_ = { bond: 3, poster: 8, photo: 15, canvas: 18 };
// TM350 ink cost per ml (ex VAT).
const TM350_INK_COST_PER_ML_ = 16;
// DTF outsource rates (ex VAT, fixed per sheet).
const DTF_OUTSOURCE_EX_VAT_ = { 'A4': 69, 'A3': 115, '290mm x 1m': 339 };
// Business card yield per SRA3 sheet.
const BC_CARDS_PER_SRA3_ = 18;
// Flyer yield per SRA3 sheet by output size.
const FLYER_PER_SRA3_ = { 'DL': 6, 'A6': 9, 'A5': 4, 'A4': 2, 'A3': 1 };

// Comb bind ring pricing per booklet (black rings only). Covers R4 each — charged separately.
const COMB_BIND_PRICING_ = [
  { maxSheets:  25, size:  "6mm", price: 10 },
  { maxSheets:  45, size:  "8mm", price: 12 },
  { maxSheets:  65, size: "10mm", price: 14 },
  { maxSheets: 100, size: "12mm", price: 16 },
  { maxSheets: 125, size: "14mm", price: 20 },
  { maxSheets: 135, size: "16mm", price: 24 },
  { maxSheets: 160, size: "19mm", price: 26 },
  { maxSheets: 200, size: "22mm", price: 28 },
  { maxSheets: 235, size: "25mm", price: 30 },
  { maxSheets: 260, size: "28mm", price: 32 },
  { maxSheets: 310, size: "32mm", price: 35 },
  { maxSheets: 370, size: "38mm", price: 37 },
  { maxSheets: 435, size: "44mm", price: 42 },
  { maxSheets: 490, size: "51mm", price: 55 },
];

const POSTER_PRINT_DEFAULTS_ = { "A3": 50, "A2": 90, "A1": 150, "A0": 250 };

function getPosterPrintPrices_() {
  try {
    const raw = localStorage.getItem(ISG_POSTER_PRICES_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    return { ...POSTER_PRINT_DEFAULTS_, ...stored };
  } catch (_e) { return { ...POSTER_PRINT_DEFAULTS_ }; }
}

function savePosterPrintPrices_(prices) {
  try { localStorage.setItem(ISG_POSTER_PRICES_KEY, JSON.stringify(prices)); } catch (_e) {}
}

function calculatePosterQuote_(size, lam, qty, prices) {
  if (!(qty > 0)) return null;
  const posterSizes = ["A3", "A2", "A1", "A0"];
  const isKnownSize = posterSizes.includes(size);
  const p = prices || getPosterPrintPrices_();
  const sizePrice = Number(p[size] || 0);
  const hasPrint = isKnownSize && sizePrice > 0;
  const printTotal = hasPrint ? Math.round(qty * sizePrice * 100) / 100 : 0;

  const hasLam = !!(lam && lam !== "None");
  let laminationTotal = 0;
  let laminationMinimumApplied = false;
  let laminationError = null;

  if (hasLam) {
    const dims = SHEET_DIMS_MM_[size];
    const isOpp   = lam === "OPP Laminate";
    const isEncap = lam === "Encapsulation";
    if (isOpp) {
      if (!dims || dims.w > LAM_COSTS_.opp.rollWidthMm) {
        laminationError = `OPP Laminate not available for ${size || "this size"} — roll width (320mm) too narrow. Use Encapsulation instead.`;
      } else {
        const materialPerSheet = (dims.h / 1000) * LAM_COSTS_.opp.costPerM;
        const calculated = Math.round((qty + 2) * materialPerSheet / (1 - LAM_COSTS_.opp.margin) * 100) / 100;
        laminationTotal = Math.max(LAM_COSTS_.opp.minimum, calculated);
        laminationMinimumApplied = laminationTotal === LAM_COSTS_.opp.minimum && calculated < LAM_COSTS_.opp.minimum;
      }
    } else if (isEncap) {
      if (!dims || dims.w > LAM_COSTS_.encap.rollWidthMm) {
        laminationError = `Encapsulation not available for ${size || "this size"} — roll width (635mm) too narrow for A0.`;
      } else {
        const materialPerSheet = (dims.h / 1000) * LAM_COSTS_.encap.costPerM;
        const calculated = Math.round((qty + 2) * materialPerSheet / (1 - LAM_COSTS_.encap.margin) * 100) / 100;
        const sizeMin = (LAM_COSTS_.encap.sizeMinimums || {})[size] || LAM_COSTS_.encap.minimum;
        laminationTotal = Math.max(sizeMin, calculated);
        laminationMinimumApplied = laminationTotal === sizeMin && calculated < sizeMin;
      }
    }
  }

  if (!hasPrint && !hasLam) return null;
  const effectiveLam = laminationError ? 0 : laminationTotal;
  const total = Math.round((printTotal + effectiveLam) * 100) / 100;
  return {
    printTotal, printPp: sizePrice, laminationTotal: effectiveLam,
    laminationMinimumApplied, laminationError, total,
    lam: hasLam ? lam : null, hasPrint, hasLam,
    noPricingForSize: !isKnownSize, size, qty,
  };
}

// ── In-house cost calculators (ex VAT) ───────────────────────────────────────

function calcBusinessCardCostExVat_(sides, lam, qty) {
  try {
    const sheets = Math.ceil(qty / BC_CARDS_PER_SRA3_) + 1; // +1 waste sheet
    const paper = sheets * 1.91; // SRA3 350gsm R1.793 + R0.12 cutting allocation
    const click = sheets * 0.78 * (sides === 'Double Sided' ? 2 : 1);
    const lamCost = lam === 'Lamination' ? sheets * (0.450 * 2.588) : 0;
    return Math.round((paper + click + lamCost) * 100) / 100;
  } catch (_e) { return null; }
}

function calcFlyerCostExVat_(outputSize, sides, colour, weight, lam, qty) {
  try {
    const perSheet = FLYER_PER_SRA3_[outputSize] || 1;
    const sheets = Math.ceil(qty / perSheet) + 1; // +1 waste sheet
    const weightNum = parseInt(String(weight).replace(/[^0-9]/g, ''), 10) || 115;
    const paperCost = sheets * (PETERS_COATED_EX_VAT_.sra3[weightNum] || PETERS_COATED_EX_VAT_.sra3[115]);
    const isColour = colour !== 'Black & White';
    const clickCost = sheets * (isColour ? 0.78 : 0.29) * (sides === 'Double Sided' ? 2 : 1);
    const dims = SHEET_DIMS_MM_['SRA3'] || { w: 320, h: 450 };
    let lamCost = 0;
    if (lam && lam !== 'None') {
      const materialPerSheet = (dims.h / 1000) * LAM_COSTS_.opp.costPerM;
      lamCost = sheets * materialPerSheet;
    }
    return Math.round((paperCost + clickCost + lamCost) * 100) / 100;
  } catch (_e) { return null; }
}

function calcTm350CostExVat_(mediaType, widthMm, heightMm, qty) {
  try {
    const areaM2 = (widthMm / 1000) * (heightMm / 1000);
    const mediaCost = areaM2 * (TM350_MEDIA_PER_M2_[mediaType] || TM350_MEDIA_PER_M2_.poster);
    const inkMl = areaM2 * (TM350_INK_ML_PER_M2_[mediaType] || TM350_INK_ML_PER_M2_.poster);
    const inkCost = inkMl * TM350_INK_COST_PER_ML_;
    return Math.round((mediaCost + inkCost) * qty * 100) / 100;
  } catch (_e) { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────

function calculateStandardPrintingQuote_(size, sides, colour, qty, lamination, binding, numBooklets, costSettings) {
  if (!(qty > 0)) return null;
  const validSizes = ["A4", "A3", "SRA3"];
  if (!validSizes.includes(size)) return null;

  const cs = costSettings || {};
  const isBw = colour === "Black & White";

  // Look up per-page rate from price table
  const sizeKey  = size === "SRA3" ? "A3" : size;
  const sidesKey = sides === "Double Sided" ? "Double Sided" : "Single Sided";
  const colrKey  = isBw ? "Black & White" : "Colour";
  const tiers = (STANDARD_PRINTING_PRICING_[sizeKey] || {})[sidesKey]?.[colrKey] || [];
  const tier = tiers.find(t => qty <= t.maxQty) || tiers[tiers.length - 1];
  if (!tier) return null;
  const pp = tier.pp;
  const printingTotal = Math.round(pp * qty * 100) / 100;
  const oppCostPerM  = Number(cs.oppLamCostPerMExVat  != null ? cs.oppLamCostPerMExVat  : LAM_COSTS_.opp.costPerM);
  const oppMargin    = Number(cs.oppLamMarginPercent   != null ? cs.oppLamMarginPercent / 100 : LAM_COSTS_.opp.margin);
  const oppMinimum   = Number(cs.oppLamMinimum         != null ? cs.oppLamMinimum         : LAM_COSTS_.opp.minimum);
  const encCostPerM  = Number(cs.encapCostPerMExVat    != null ? cs.encapCostPerMExVat    : LAM_COSTS_.encap.costPerM);
  const encMargin    = Number(cs.encapMarginPercent    != null ? cs.encapMarginPercent / 100 : LAM_COSTS_.encap.margin);
  const encMinimum   = Number(cs.encapMinimum          != null ? cs.encapMinimum          : LAM_COSTS_.encap.minimum);
  const encMinA2     = Number(cs.encapMinimumA2        != null ? cs.encapMinimumA2        : LAM_COSTS_.encap.sizeMinimums.A2);
  const encMinA1     = Number(cs.encapMinimumA1        != null ? cs.encapMinimumA1        : LAM_COSTS_.encap.sizeMinimums.A1);

  const lam = String(lamination || "None");
  const isPouchLam = lam === "Pouch 150mic" || lam === "Pouch 250mic";
  const isOppLam = lam === "OPP Laminating";
  const isRollEncap = lam === "Roll Encapsulation";

  let laminationTotal = 0;
  let laminationSeparate = false;
  let laminationError = null;
  let laminationMinimumApplied = false;

  if (isPouchLam) {
    if (size === "SRA3") {
      laminationError = "Pouch lamination is not available for SRA3 — use Roll Encapsulation instead.";
    } else {
      const lamPp = (POUCH_LAMINATION_PRICING_[size] || {})[lam] || 0;
      laminationTotal = Math.round(lamPp * qty * 100) / 100;
    }
  } else if (isOppLam) {
    const dims = SHEET_DIMS_MM_[size];
    if (!dims || dims.w > LAM_COSTS_.opp.rollWidthMm) {
      laminationError = `OPP Laminating is not available for ${size} — roll width (320mm) is too narrow. Use Roll Encapsulation instead.`;
    } else {
      const materialPerSheet = (dims.h / 1000) * oppCostPerM;
      const calculated = Math.round((qty + 2) * materialPerSheet / (1 - oppMargin) * 100) / 100;
      laminationTotal = Math.max(oppMinimum, calculated);
      laminationMinimumApplied = laminationTotal === oppMinimum && calculated < oppMinimum;
    }
  } else if (isRollEncap) {
    const dims = SHEET_DIMS_MM_[size];
    if (!dims || dims.w > LAM_COSTS_.encap.rollWidthMm) {
      laminationError = `Roll Encapsulation is not available for ${size} — roll width (635mm) is too narrow.`;
    } else {
      const materialPerSheet = (dims.h / 1000) * encCostPerM;
      const calculated = Math.round((qty + 2) * materialPerSheet / (1 - encMargin) * 100) / 100;
      const sizeMin = size === "A2" ? encMinA2 : size === "A1" ? encMinA1 : encMinimum;
      laminationTotal = Math.max(sizeMin, calculated);
      laminationMinimumApplied = laminationTotal === sizeMin && calculated < sizeMin;
    }
  }

  const bind = String(binding || "None");
  const nb = Number(numBooklets) || 0;
  let bindingTotal = 0;
  let bindingRingSize = null;
  let bindingPerBooklet = 0;
  let bindingError = null;

  if (bind === "Comb Bind") {
    if (!(nb > 0)) {
      bindingError = "Enter number of booklets to calculate binding cost.";
    } else {
      const sheetsPerBooklet = Math.ceil(qty / nb);
      const bindTier = COMB_BIND_PRICING_.find(t => sheetsPerBooklet <= t.maxSheets);
      if (!bindTier) {
        bindingError = `Too many sheets per booklet (${sheetsPerBooklet}) — max is 490. Increase number of booklets or use a different binding.`;
      } else {
        bindingRingSize = bindTier.size;
        bindingPerBooklet = bindTier.price;
        bindingTotal = Math.round(bindTier.price * nb * 100) / 100;
      }
    }
  }

  const total = Math.round((printingTotal + laminationTotal + bindingTotal) * 100) / 100;
  return { pp, printingTotal, laminationTotal, laminationSeparate, laminationMinimumApplied, laminationError, lam, bindingTotal, bindingRingSize, bindingPerBooklet, bindingError, bind, total, qty, numBooklets: nb };
}

function calculateVinylStickerQuote_(inputs, settings) {
  const widthMm = Number(inputs && inputs.widthMm || 0);
  const heightMm = Number(inputs && inputs.heightMm || 0);
  const qty = Number(inputs && inputs.qty || 0);
  const cfg = normalizePricingSettings_(settings || getCurrentPricingSettings_());

  if (!(widthMm > 0) || !(heightMm > 0) || !(qty > 0)) {
    return null;
  }

  const stickerAreaM2 = (widthMm / 1000) * (heightMm / 1000);
  const baseAreaM2 = stickerAreaM2 * qty;
  const wastePercent = Math.max(0, Number(cfg.wastePercent || 0));
  const totalPrintAreaM2 = baseAreaM2 * (1 + (wastePercent / 100));

  const ratePerM2InclVat = Math.max(0, Number(cfg.retailPerM2InclVat || 0));
  const retailBeforeRounding = totalPrintAreaM2 * ratePerM2InclVat;
  const roundTo = Number(cfg.roundToNearest || 0);
  const rounded = roundTo > 0
    ? Math.ceil(retailBeforeRounding / roundTo) * roundTo
    : retailBeforeRounding;
  const finalRetail = Math.max(250, rounded);
  const pricePerSticker = qty > 0 ? finalRetail / qty : finalRetail;

  return {
    stickerAreaM2,
    totalPrintAreaM2,
    baseAreaM2,
    ratePerM2InclVat,
    retailBeforeRounding,
    finalRetail,
    pricePerSticker,
    roundTo,
  };
}

// PrintStation "Multiple Stickers" formula — derived from live quotes 2026-06-30.
// Price depends only on combined total sticker area across all designs.
// Tiers: ≤0.625m² @ R460/m², 0.625–0.875m² @ R400/m², >0.875m² @ R336.36/m²
// Base fee R217.50, minimum R150. Matches PrintStation retail prices.
const PS_MULTI_STICKER_ = {
  BASE: 217.50,
  T1_CEIL: 0.625, T1_RATE: 460,
  T2_CEIL: 0.875, T2_RATE: 400,
  T3_RATE: 185 / 0.55,   // ≈ R336.36/m²
  MINIMUM: 150,
};

function calculateVinylMultiQuote_(designs) {
  const valid = (designs || []).filter(d => d.widthMm > 0 && d.heightMm > 0 && d.qty > 0);
  if (!valid.length) return null;
  const t = PS_MULTI_STICKER_;
  const lines = valid.map(d => ({
    widthMm: d.widthMm, heightMm: d.heightMm, qty: d.qty,
    areaM2: (d.widthMm / 1000) * (d.heightMm / 1000) * d.qty,
  }));
  const totalAreaM2 = lines.reduce((s, l) => s + l.areaM2, 0);
  let areaPrice;
  if (totalAreaM2 <= t.T1_CEIL) {
    areaPrice = totalAreaM2 * t.T1_RATE;
  } else if (totalAreaM2 <= t.T2_CEIL) {
    areaPrice = t.T1_CEIL * t.T1_RATE + (totalAreaM2 - t.T1_CEIL) * t.T2_RATE;
  } else {
    areaPrice = t.T1_CEIL * t.T1_RATE + (t.T2_CEIL - t.T1_CEIL) * t.T2_RATE + (totalAreaM2 - t.T2_CEIL) * t.T3_RATE;
  }
  const finalTotal = Math.max(t.MINIMUM, Math.round(t.BASE + areaPrice));
  return { lines, totalAreaM2, finalTotal };
}

state.role = normalizeRole_(state.role);

const CATEGORY_THEME = {
  "In-house": { base: "#AFBF73", ink: "#223740", key: "inhouse" },
  "Outsourced": { base: "#345463", ink: "#FFFFFF", key: "outsourced" },
  "Ink/Stock": { base: "#F2DFDE", ink: "#223740", key: "ink" },
  "Returns": { base: "#DAEDEA", ink: "#223740", key: "returns" },
  "Design": { base: "#7B68AE", ink: "#FFFFFF", key: "design" },
};

function getCategoryTheme_(category) {
  return CATEGORY_THEME[category] || { base: "#DAEDEA", ink: "#223740", key: "default" };
}

const TRUSTED_SOURCE_DOMAINS = [
  "printerland.co.za",
  "hp.com",
  "canon.co.za",
  "canon.com",
  "brother.co.za",
  "brother.com",
  "epson.co.za",
  "epson.com",
  "kyoceradocumentsolutions.co.za",
  "kyoceradocumentsolutions.com",
  "ricoh.co.za",
  "ricoh.com",
  "lexmark.com",
  "xerox.com",
];

const MANUAL_PRINTER_OVERRIDES = [
  {
    brand: "HP",
    printerModel: "HP OfficeJet Pro 8123",
    aliases: [
      "OfficeJet Pro 8123",
      "OfficeJet Pro 8123e",
      "HP 8123",
      "HP 8123e",
      "OfficeJet 8123",
      "HP OfficeJet 8123",
    ],
    printerType: "Inkjet",
    approxYear: "",
    consumables: [
      {
        Cartridge: "HP 923 Black/Cyan/Magenta/Yellow",
        Cartridge_Normalized: "HP 923",
        Cartridge_Family: "923",
        Type: "INK",
        Color: "CMYK",
        Supplier_Compatible_SKUs: [],
      },
      {
        Cartridge: "HP 923e Black/Cyan/Magenta/Yellow",
        Cartridge_Normalized: "HP 923E",
        Cartridge_Family: "923E",
        Type: "INK",
        Color: "CMYK",
        Supplier_Compatible_SKUs: [],
      },
    ],
    notes: "Manual override (HP Support: OfficeJet Pro 8123 orderable supplies).",
  },
  {
    brand: "HP",
    printerModel: "HP OfficeJet Pro 9120",
    aliases: [
      "OfficeJet Pro 9120",
      "OfficeJet Pro 9120e",
      "HP 9120",
      "HP 9120e",
      "OfficeJet 9120",
      "HP OfficeJet 9120",
    ],
    printerType: "Inkjet",
    approxYear: "",
    consumables: [
      {
        Cartridge: "HP 936 Black/Cyan/Magenta/Yellow",
        Cartridge_Normalized: "HP 936",
        Cartridge_Family: "936",
        Type: "INK",
        Color: "CMYK",
        Supplier_Compatible_SKUs: [],
      },
      {
        Cartridge: "HP 936e Black/Cyan/Magenta/Yellow",
        Cartridge_Normalized: "HP 936E",
        Cartridge_Family: "936E",
        Type: "INK",
        Color: "CMYK",
        Supplier_Compatible_SKUs: [],
      },
    ],
    notes: "Manual override (HP Support: OfficeJet Pro 9120 orderable supplies).",
  },
];
const FINDER_LOCAL_MAP_KEY = "ISG_FINDER_LOCAL_MAP_V1";

// Strict verified records only. Add new records only when you can cite a trusted source URL.
// Each record can include: cartridges (main), drum, waste, maintenance.
const VERIFIED_CONSUMABLE_DB = [
  {
    printerModel: "Canon PIXMA MG2440",
    aliases: ["canon mg2440", "pixma mg2440", "mg2440"],
    cartridges: ["PG-445", "CL-446", "PG-445XL", "CL-446XL"],
    drum: [],
    waste: [],
    maintenance: [],
    sourceName: "Printerland",
    sourceUrl: "https://www.printerland.co.za/product/pg-445-black-fine-cartridge-180-pages-/133145",
    verifiedOn: "2026-03-18",
    notes: "Consumables listed on product page.",
  },
  {
    printerModel: "Canon PIXMA MG2540",
    aliases: ["canon mg2540", "pixma mg2540", "mg2540"],
    cartridges: ["PG-445", "CL-446", "PG-445XL", "CL-446XL"],
    drum: [],
    waste: [],
    maintenance: [],
    sourceName: "Printerland",
    sourceUrl: "https://www.printerland.co.za/product/pg-445-black-fine-cartridge-180-pages-/133145",
    verifiedOn: "2026-03-18",
    notes: "Consumables listed on product page.",
  },
  {
    printerModel: "Canon iP2840",
    aliases: ["canon ip2840", "ip2840"],
    cartridges: ["PG-445", "CL-446", "PG-445XL", "CL-446XL"],
    drum: [],
    waste: [],
    maintenance: [],
    sourceName: "Printerland",
    sourceUrl: "https://www.printerland.co.za/product/pg-445-black-fine-cartridge-180-pages-/133145",
    verifiedOn: "2026-03-18",
    notes: "Consumables listed on product page.",
  },
  {
    printerModel: "Canon MG2940",
    aliases: ["canon mg2940", "mg2940"],
    cartridges: ["PG-445", "CL-446", "PG-445XL", "CL-446XL"],
    drum: [],
    waste: [],
    maintenance: [],
    sourceName: "Printerland",
    sourceUrl: "https://www.printerland.co.za/product/pg-445-black-fine-cartridge-180-pages-/133145",
    verifiedOn: "2026-03-18",
    notes: "Consumables listed on product page.",
  },
  {
    printerModel: "Canon PIXMA TS3140",
    aliases: ["canon ts3140", "pixma ts3140", "ts3140"],
    cartridges: ["PG-445", "CL-446", "PG-445XL", "CL-446XL"],
    drum: [],
    waste: [],
    maintenance: [],
    sourceName: "Printerland",
    sourceUrl: "https://www.printerland.co.za/consumables/canon-printer-ink-toner-cartridges/canon-multifunction-printer-consumables/canon-pixma-ts3140-multifunction-printer-ink-cartridges/35113",
    verifiedOn: "2026-03-18",
    notes: "Dedicated consumables page.",
  },
  {
    printerModel: "HP DeskJet 2320",
    aliases: ["hp deskjet 2320", "deskjet 2320", "2320"],
    cartridges: ["HP 305 Black", "HP 305 Tri-color"],
    drum: [],
    waste: [],
    maintenance: [],
    sourceName: "Printerland",
    sourceUrl: "https://www.printerland.co.za/product/hp-deskjet-2320/150517",
    verifiedOn: "2026-03-18",
    notes: "In-box consumables include HP 305 setup black/tri-colour.",
  },
  {
    printerModel: "HP DeskJet Plus 4120",
    aliases: ["hp deskjet plus 4120", "deskjet 4120", "4120"],
    cartridges: ["HP 305 Black", "HP 305 Tri-color"],
    drum: [],
    waste: [],
    maintenance: [],
    sourceName: "Printerland",
    sourceUrl: "https://www.printerland.co.za/product/hp-deskjet-plus-4120-all-in-one-printer/149172",
    verifiedOn: "2026-03-18",
    notes: "In-box consumables include HP 305 setup black/tri-colour.",
  },
  {
    printerModel: "Canon i-SENSYS MF237w",
    aliases: ["canon i-sensys mf237w", "mf237w"],
    cartridges: ["Canon Cartridge 737"],
    drum: [],
    waste: [],
    maintenance: [],
    sourceName: "Printerland",
    sourceUrl: "https://www.printerland.co.za/product/canon-i-sensys-mf237w/138988",
    verifiedOn: "2026-03-12",
    notes: "Primary consumable listing only. Add secondary consumables after OEM/supplier verification.",
  },
];

function getCompatibilityRecords_() {
  if (Array.isArray(state.compatibilityMaster) && state.compatibilityMaster.length) {
    return state.compatibilityMaster;
  }
  return VERIFIED_CONSUMABLE_DB;
}

const SPEC_SCHEMAS = {
  inhouse: {
    "Vinyl Stickers": [
      { id: "sticker_width_mm", label: "Sticker Width (mm)", type: "number", placeholder: "e.g. 50" },
      { id: "sticker_height_mm", label: "Sticker Height (mm)", type: "number", placeholder: "e.g. 50" },
      { id: "quantity", label: "Quantity", type: "number" },
      { id: "material", label: "Material", type: "select", options: ["Gloss Vinyl", "Matt Vinyl", "Clear Vinyl", "Other"] },
      { id: "lamination", label: "Lamination", type: "select", options: ["None", "Gloss", "Matt"] },
      { id: "cut_type", label: "Cut Type", type: "select", options: ["Kiss Cut", "Die Cut", "Sheet Cut"] },
    ],
    "Business Cards": [
      { id: "size", label: "Size", type: "select", options: ["90x50mm", "85x55mm", "Custom"] },
      { id: "quantity", label: "Quantity", type: "number" },
      { id: "sides", label: "Sides", type: "select", options: ["Single Sided", "Double Sided"] },
      { id: "paper", label: "Paper / Stock", type: "select", options: ["350gsm Silk", "350gsm Matt", "450gsm", "Other"] },
      { id: "finish", label: "Finish", type: "select", options: ["None", "Gloss OPP", "Matte OPP"] },
    ],
    "Flyers": [
      { id: "size", label: "Size", type: "select", options: ["A6", "A5", "A4", "A3", "DL", "Custom"] },
      { id: "quantity", label: "Quantity", type: "number" },
      { id: "sides", label: "Sides", type: "select", options: ["Single Sided", "Double Sided"] },
      { id: "paper", label: "Paper", type: "select", options: ["115gsm Gloss", "128gsm Gloss", "148gsm Gloss", "200gsm Gloss", "250gsm Gloss", "Other"] },
      { id: "fold", label: "Folding", type: "select", options: ["None", "Half Fold", "Tri Fold"] },
    ],
    "Posters": [
      { id: "size", label: "Size", type: "select", options: ["A3", "A2", "A1", "A0", "Custom"] },
      { id: "quantity", label: "Quantity", type: "number" },
      { id: "material", label: "Material", type: "select", options: ["160gsm", "80gsm Bond"] },
      { id: "lam", label: "Lamination", type: "select", options: ["None", "OPP Laminate", "Encapsulation"] },
    ],
    "Stickers": [
      { id: "size", label: "Size", type: "text", placeholder: "e.g. 50x50mm" },
      { id: "quantity", label: "Quantity", type: "number" },
      { id: "material", label: "Material", type: "select", options: ["Gloss Vinyl", "Matte Vinyl", "Clear Vinyl", "Paper", "Reflective", "Other"] },
      { id: "cut", label: "Cut", type: "select", options: ["Kiss Cut", "Die Cut", "Sheet Cut"] },
      { id: "lam", label: "Lamination", type: "select", options: ["None", "Gloss", "Matt"] },
    ],
    "DTF": [
      { id: "sheet", label: "Sheet Size", type: "select", options: ["A4", "A3", "290mm x 1m"] },
      { id: "quantity", label: "Quantity", type: "number" },
      { id: "fabric", label: "Fabric Type", type: "text", placeholder: "e.g. Cotton / Poly blend" },
      { id: "pressing", label: "Pressing Required", type: "select", options: ["Yes", "No"] },
    ],
    "Standard Printing": [
      { id: "size", label: "Size", type: "select", options: ["A6", "A5", "A4", "A3", "SRA3", "A2", "A1", "A0", "DL", "Custom"] },
      { id: "quantity", label: "Quantity", type: "number" },
      { id: "sides", label: "Sides", type: "select", options: ["Single Sided", "Double Sided"] },
      { id: "colour", label: "Colour", type: "select", options: ["Black & White", "Colour"] },
      { id: "paper", label: "Paper", type: "select", options: ["80gsm Bond", "115gsm Gloss", "128gsm Gloss", "148gsm Gloss", "200gsm Gloss", "250gsm Gloss", "300gsm Gloss", "350gsm Gloss", "Other"] },
      { id: "lamination", label: "Lamination", type: "select", options: ["None", "Pouch 150mic", "Pouch 250mic", "OPP Laminating", "Roll Encapsulation"] },
      { id: "binding", label: "Binding", type: "select", options: ["None", "Staple", "Comb Bind"] },
      { id: "num_booklets", label: "Number of Booklets", type: "number", showWhen: { field: "binding", equals: "Comb Bind" } },
    ],
    "Canvas Prints": [
      { id: "size", label: "Size", type: "select", options: ["A5 (148×210mm)", "A4 (210×297mm)", "A3 (297×420mm)", "A2 (420×594mm)", "A1 (594×841mm)", "Custom"] },
      { id: "width_mm", label: "Width mm (if Custom)", type: "number", showWhen: { field: "size", equals: "Custom" } },
      { id: "height_mm", label: "Height mm (if Custom)", type: "number", showWhen: { field: "size", equals: "Custom" } },
      { id: "quantity", label: "Quantity", type: "number" },
      { id: "frame", label: "Frame / Mount", type: "select", options: ["Stretcher Frame", "Float Frame", "No Frame / Print Only"] },
      { id: "edging", label: "Edging Style", type: "select", options: ["Gallery Wrap (image continues)", "Mirror Wrap", "White Border"] },
    ],
    "Photo Prints": [
      { id: "size", label: "Size", type: "select", options: ["10×15cm (4×6\")", "13×18cm (5×7\")", "15×20cm (6×8\")", "20×25cm (8×10\")", "A4", "A3", "A2", "A1", "Custom"] },
      { id: "dimensions", label: "Custom Dimensions (mm)", type: "text", placeholder: "e.g. 500×700mm", showWhen: { field: "size", equals: "Custom" } },
      { id: "quantity", label: "Quantity", type: "number" },
      { id: "paper", label: "Paper", type: "select", options: ["Gloss", "Satin", "Matte"] },
      { id: "borders", label: "Borders", type: "select", options: ["Borderless", "White Border"] },
    ],
    "Plan Prints": [
      { id: "size", label: "Size", type: "select", options: ["A3", "A2", "A1", "A0"] },
      { id: "quantity", label: "Quantity", type: "number" },
      { id: "colour", label: "Print Type", type: "select", options: ["Black & White", "Colour"] },
      { id: "mounting", label: "Mounting", type: "select", options: ["None", "Foam Board Mount", "Rollup"] },
    ],
    "Correx Boards": [
      { id: "size_type", label: "Size Type", type: "select", options: ["Standard Sizes", "Custom Size"] },
      { id: "size_standard", label: "Standard Size", type: "select", options: ["A0 (841×1189mm)", "A1 (594×841mm)", "A2 (420×594mm)", "A3 (297×420mm)", "A4 (210×297mm)", "A5 (148×210mm)", "Square (200×200mm)", "Square (300×300mm)", "Square (400×400mm)", "Square (500×500mm)", "Square (600×600mm)"], showWhen: { field: "size_type", equals: "Standard Sizes" } },
      { id: "size_custom", label: "Custom Size (mm)", type: "text", placeholder: "e.g. 1200×600mm", showWhen: { field: "size_type", equals: "Custom Size" } },
      { id: "qty", label: "Quantity", type: "number" },
      { id: "substrate", label: "Substrate", type: "select", options: ["Correx Board White 3mm", "ABS Board White - 0.9mm", "ABS Board White - 1.5mm", "M-Foam PVC Board White - 3mm", "M-Foam PVC Board White - 5mm"] },
      { id: "media", label: "Media", type: "select", options: ["White Gloss Vinyl (Indoor)", "White Gloss Vinyl (Outdoor)", "Matte Vinyl (Indoor)", "Matte Vinyl (Outdoor)"] },
      { id: "sides", label: "Sides", type: "select", options: ["One Side", "Two Sides"] },
    ],
    "Car Magnets": [
      { id: "size_type", label: "Size Type", type: "select", options: ["Standard Size", "Custom Size"] },
      { id: "size_standard", label: "Standard Size", type: "select", options: ["200×200mm", "300×200mm", "300×300mm", "400×300mm", "400×400mm", "600×400mm", "700×500mm", "800×600mm"], showWhen: { field: "size_type", equals: "Standard Size" } },
      { id: "size_custom", label: "Custom Size (mm)", type: "text", placeholder: "e.g. 450×350mm (max 800×600mm)", showWhen: { field: "size_type", equals: "Custom Size" } },
      { id: "quantity", label: "Quantity (Pairs)", type: "number" },
      { id: "vinyl_media", label: "Vinyl Media", type: "select", options: ["Gloss Vinyl", "Matte Vinyl"] },
      { id: "artwork_versions", label: "Artwork Versions", type: "select", options: ["1", "2", "3+"] },
    ],
  },
  outsourced: {
    "Business Cards (Bulk/Outsourced)": [
      { id: "size", label: "Card Size", type: "select", options: ["90x50mm", "85x55mm", "Custom"] },
      { id: "quantity", label: "Quantity", type: "number" },
      { id: "sides", label: "Sides", type: "select", options: ["Single Sided", "Double Sided"] },
      { id: "paper", label: "Paper / Stock", type: "select", options: ["350gsm Silk", "350gsm Matt", "450gsm", "Other"] },
      { id: "finish", label: "Finish", type: "select", options: ["None", "Gloss OPP", "Matte OPP"] },
    ],
    "Flyers (Bulk/Outsourced)": [
      { id: "size", label: "Flyer Size", type: "select", options: ["A6", "A5", "A4", "DL", "Custom"] },
      { id: "quantity", label: "Quantity", type: "number" },
      { id: "sides", label: "Sides", type: "select", options: ["Single Sided", "Double Sided"] },
      { id: "paper", label: "Paper", type: "select", options: ["115gsm Gloss", "130gsm Gloss", "170gsm Gloss", "250gsm Gloss", "Other"] },
      { id: "fold", label: "Folding", type: "select", options: ["None", "Half Fold", "Tri Fold"] },
    ],
    "Correx /ABS/ PVC Foam Board": [
      { id: "size_type", label: "Size Type", type: "select", options: ["Standard Sizes", "Custom Size"] },
      {
        id: "size_standard",
        label: "Standard Size",
        type: "select",
        options: [
          "A0 (841 x 1189 mm)",
          "A1 (594 x 841 mm)",
          "A2 (420 x 594 mm)",
          "A3 (297 x 420 mm)",
          "A4 (210 x 297 mm)",
          "A5 (148 x 210 mm)",
          "A6 (105 x 148 mm)",
          "Square (200 x 200 mm)",
          "Square (250 x 250 mm)",
          "Square (300 x 300 mm)",
          "Square (350 x 350 mm)",
          "Square (400 x 400 mm)",
          "Square (500 x 500 mm)",
          "Square (600 x 600 mm)",
        ],
        showWhen: { field: "size_type", equals: "Standard Sizes" },
      },
      {
        id: "size_custom",
        label: "Custom Size (mm)",
        type: "text",
        placeholder: "e.g. 1200 x 600 mm",
        showWhen: { field: "size_type", equals: "Custom Size" },
      },
      { id: "qty", label: "Quantity", type: "number" },
      { id: "print_colour", label: "Print Colour", type: "select", options: ["Full Colour (UV)", "Full Colour + Spot Gloss (UV)"] },
      { id: "media", label: "Media Selection", type: "select", options: ["White Gloss Vinyl (Indoor)", "White Gloss Vinyl (Outdoor)"] },
      {
        id: "substrate",
        label: "Substrate",
        type: "select",
        options: [
          "ABS Board White - 0.9mm",
          "ABS Board White - 1.5mm",
          "Correx Board White 3mm",
          "M-Foam PVC Board White - 3mm",
          "M-Foam PVC Board White - 5mm",
        ],
      },
      { id: "sides", label: "Sides", type: "select", options: ["One Side", "Two Sides"] },
    ],
    "Stamps": [
      { id: "stamp_type", label: "Stamp Type", type: "select", options: ["Self-Inking", "Traditional", "Date Stamp"] },
      { id: "size", label: "Stamp Size", type: "text", placeholder: "e.g. 40x40mm" },
      { id: "ink", label: "Ink Colour", type: "select", options: ["Black", "Blue", "Red", "Green", "Other"] },
      { id: "qty", label: "Quantity", type: "number" },
    ],
    "NCR Books": [
      { id: "size", label: "Book Size", type: "select", options: ["A6", "A5", "A4", "Custom"] },
      { id: "sets", label: "Sets per Book", type: "select", options: ["50", "100"] },
      { id: "plies", label: "Plies", type: "select", options: ["Duplicate (2 Part)", "Triplicate (3 Part)"] },
      { id: "numbering", label: "Numbering", type: "select", options: ["Yes", "No"] },
      { id: "start_no", label: "Starting Number", type: "text", placeholder: "e.g. 0001", showWhen: { field: "numbering", equals: "Yes" } },
      { id: "qty_books", label: "Quantity of Books", type: "number" },
    ],
    "Stickers": [
      { id: "size", label: "Sticker Size", type: "text", placeholder: "e.g. 60x40mm" },
      { id: "material", label: "Material", type: "select", options: ["Paper", "Vinyl", "Clear", "Holographic", "Other"] },
      { id: "qty", label: "Quantity", type: "number" },
      { id: "cut", label: "Cut Type", type: "select", options: ["Kiss Cut", "Die Cut", "Sheet Cut", "Roll"] },
      { id: "lam", label: "Lamination", type: "select", options: ["None", "Gloss", "Matt"] },
    ],
    "DTF": [
      { id: "sheet", label: "Sheet Size", type: "select", options: ["A4", "A3", "290mm x 1m"] },
      { id: "quantity", label: "Quantity", type: "number" },
      { id: "fabric", label: "Fabric Type", type: "text", placeholder: "e.g. Cotton / Poly blend" },
      { id: "pressing", label: "Pressing Required", type: "select", options: ["Yes", "No"] },
    ],
    "Other": [
      { id: "product", label: "Product Name", type: "text", placeholder: "e.g. Wall Banner" },
      { id: "size", label: "Size", type: "text", placeholder: "e.g. 1000x2000mm" },
      { id: "material", label: "Material", type: "text", placeholder: "e.g. PVC Banner" },
      { id: "qty", label: "Quantity", type: "number" },
      { id: "finishing", label: "Finishing", type: "text", placeholder: "e.g. Eyelets every 30cm" },
    ],
  },
  sublimation: {
    "Mug": [
      { id: "type", label: "Type", type: "select", options: ["Standard", "Colour Handle"] },
      { id: "quantity", label: "Quantity", type: "number" },
    ],
    "Tumbler": [
      { id: "type", label: "Type", type: "select", options: ["With Straw", "With Handle"] },
      { id: "quantity", label: "Quantity", type: "number" },
    ],
    "Clock": [
      { id: "specs", label: "Specs", type: "text", placeholder: "e.g. 25cm round, white face" },
      { id: "quantity", label: "Quantity", type: "number" },
    ],
    "Photo Display": [
      { id: "size", label: "Size", type: "select", options: ["20x20cm", "15x20cm"] },
      { id: "quantity", label: "Quantity", type: "number" },
    ],
    "Coaster": [
      { id: "material", label: "Material", type: "select", options: ["Glass", "Ceramic", "MDF"] },
      { id: "shape", label: "Shape", type: "select", options: ["Round", "Square"] },
      { id: "quantity", label: "Quantity", type: "number" },
    ],
    "Can Holder": [
      { id: "quantity", label: "Quantity", type: "number" },
    ],
    "Welcome Sign": [
      { id: "quantity", label: "Quantity", type: "number" },
    ],
    "Puzzle": [
      { id: "quantity", label: "Quantity", type: "number" },
    ],
    "Mouse Pad": [
      { id: "quantity", label: "Quantity", type: "number" },
    ],
  },
};

document.getElementById("role").addEventListener("change", (e) => {
  const nextRole = normalizeRole_(e.target.value);
  if ((nextRole === "owner" || nextRole === "admin") && !isOwnerUnlocked_()) {
    const ok = requestOwnerUnlock_();
    if (!ok) {
      e.target.value = state.role;
      return;
    }
  }
  state.role = nextRole;
  try { localStorage.setItem(ISG_ROLE_KEY, nextRole); } catch (_e) {}
  state.tab = tabsByRole[state.role][0][0];
  render();
});

document.getElementById("cleanMode").addEventListener("change", (e) => {
  state.cleanMode = e.target.checked;
  render();
});

document.getElementById("job-search").addEventListener("input", (e) => {
  state.searchQuery = e.target.value;
  render();
});

function renderTabs() {
  const role = normalizeRole_(state.role);
  state.role = role;
  const tabs = tabsByRole[role] || tabsByRole.staff;
  const el = document.getElementById("tabs");
  if (!el) return;
  el.innerHTML = "";
  if (!tabs.length) return;
  if (!tabs.some(([id]) => id === state.tab)) {
    state.tab = tabs[0][0];
  }
  const completedCount = state.jobs.filter(j => ["Collected", "Closed", "Completed"].includes(j.status) && !isSoftDeleted_(j)).length;
  const toOrderCount = state.jobs.filter(j => !isSoftDeleted_(j) && j.status === "Ready to Order" && ["Outsourced", "Ink/Stock"].includes(j.category)).length;
  const mimakiCount = state.jobs.filter(j => !isSoftDeleted_(j) && j.category === "In-house" && isMimakiJob_(j) && ["Ready", "Batched (Vinyl Print Run)", "In Production"].includes(String(j.status || ""))).length;
  tabs.forEach(([id, label]) => {
    const b = document.createElement("button");
    b.className = state.tab === id ? "active" : "";
    b.onclick = () => { closeJobPanel_(); state.tab = id; render(); };
    const span = document.createElement("span");
    span.textContent = label;
    b.appendChild(span);
    if (id === "completed_jobs" && completedCount > 0) {
      const badge = document.createElement("span");
      badge.className = "tab-badge";
      badge.textContent = completedCount;
      b.appendChild(badge);
    }
    if (id === "batching" && toOrderCount > 0) {
      const badge = document.createElement("span");
      badge.className = "tab-badge tab-badge-urgent";
      badge.textContent = toOrderCount;
      b.appendChild(badge);
    }
    if (id === "vinyl_queue" && mimakiCount > 0) {
      const badge = document.createElement("span");
      badge.className = "tab-badge tab-badge-urgent";
      badge.textContent = mimakiCount;
      b.appendChild(badge);
    }
    el.appendChild(b);
  });
  renderRefreshIndicator_();
}

function applySearchFilter_(jobs) {
  const q = String(state.searchQuery || "").trim().toLowerCase();
  if (!q) return jobs;
  const direct = jobs.filter(j =>
    String(j.jobNo || "").toLowerCase().includes(q) ||
    String(j.customer || "").toLowerCase().includes(q) ||
    String(j.customerEmail || "").toLowerCase().includes(q) ||
    String(j.customerPhone || "").toLowerCase().includes(q)
  );
  const matchedJobNos = new Set(direct.map(j => j.jobNo));
  const matchedGroups = new Set(direct.map(j => j.orderGroup).filter(Boolean));
  return jobs.filter(j =>
    matchedJobNos.has(j.jobNo) ||
    (j.orderGroup && matchedGroups.has(j.orderGroup)) ||
    (j.orderGroup && matchedJobNos.has(j.orderGroup))
  );
}

function laneBuckets(category) {
  const all = applySearchFilter_(state.jobs)
    .filter(j => !isSoftDeleted_(j))
    .filter(j => j.category === category)
    .filter(j => !isCancellationOpen_(j));
  return {
    needs: all.filter(j => ["Waiting Payment", "Waiting Artwork", "Waiting Approval", "Awaiting Artwork Approval", "Awaiting Hard Proof Approval", "Return: Awaiting Dispatch", "Briefing Received", "Awaiting Client Approval"].includes(j.status) || j.blocked || (j.urgent && !["Ready", "Ready to Order", "Order Placed", "Batched (DTF Order)", "Batched (Vinyl Print Run)", "DTF Order Placed", "In Production", "Ready for Collection", "Collected", "Return: Sent to Supplier", "Supplier Feedback Received", "Refund Pending", "Replacement Ordered", "Refund Processed", "Design: In Progress", "Completed", "Closed"].includes(j.status))),
    ready: all.filter(j => ["Ready", "Ready to Order", "Order Placed", "Batched (DTF Order)", "Batched (Vinyl Print Run)", "DTF Order Placed", "In Production", "Ready for Collection", "Return: Sent to Supplier", "Supplier Feedback Received", "Refund Pending", "Replacement Ordered", "Refund Processed", "Design: In Progress", "In Progress", "Approved"].includes(j.status)),
    done: all.filter(j => ["Collected", "Closed"].includes(j.status)),
  };
}

// ── Slide-in job detail panel ─────────────────────────────────────────────

function openJobPanel_(jobNo) {
  const job = state.jobs.find(j => j.jobNo === jobNo);
  if (!job) return;

  let overlay = document.getElementById("job-panel-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "job-panel-overlay";
    overlay.className = "panel-overlay";
    document.body.appendChild(overlay);

    const backdrop = document.createElement("div");
    backdrop.className = "panel-overlay-backdrop";
    backdrop.addEventListener("click", closeJobPanel_);
    overlay.appendChild(backdrop);

    const drawer = document.createElement("div");
    drawer.className = "panel-drawer";
    overlay.appendChild(drawer);
  }

  const drawer = overlay.querySelector(".panel-drawer");
  drawer.innerHTML = buildPanelHtml_(job);
  setupPanelHandlers_(drawer, job);

  requestAnimationFrame(() => overlay.classList.add("open"));
}

function closeJobPanel_() {
  const overlay = document.getElementById("job-panel-overlay");
  if (overlay) overlay.classList.remove("open");
}

// Attaches all interactive event listeners to a rendered panel drawer.
function setupPanelHandlers_(drawer, job) {
  const closeBtn = drawer.querySelector(".panel-close");
  if (closeBtn) closeBtn.addEventListener("click", closeJobPanel_);

  const detailBtn = drawer.querySelector(".panel-btn-detail");
  if (detailBtn) {
    detailBtn.addEventListener("click", () => {
      closeJobPanel_();
      if (state.role === "owner") state.ownerSelectedJobNo = job.jobNo;
      else state.selectedJobNo = job.jobNo;
      state.tab = "job_detail";
      render();
    });
  }

  // Notify button: open external link and auto-log the communication.
  const notifyBtn = drawer.querySelector(".panel-btn-notify");
  if (notifyBtn) {
    notifyBtn.addEventListener("click", () => {
      if (!state.staffName) { window.alert("Please select your name from the Staff dropdown in the header first."); return; }
      const url = notifyBtn.dataset.notifyUrl;
      const type = notifyBtn.dataset.notifyType === "whatsapp" ? "WhatsApp" : "Email";
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      const freshJob = state.jobs.find(j => j.jobNo === job.jobNo) || job;
      addCommLogEntry_(freshJob, type, "Customer notified");
      refreshOpenPanel_();
    });
  }

  // Manual comms log entry.
  const commsLogBtn = drawer.querySelector(".comms-log-btn");
  if (commsLogBtn) {
    commsLogBtn.addEventListener("click", () => {
      if (!state.staffName) { window.alert("Enter your name in the header first."); return; }
      const typeSel = drawer.querySelector(".comms-type-sel");
      const noteInput = drawer.querySelector(".comms-note-input");
      const type = typeSel ? typeSel.value : "Other";
      const note = noteInput ? noteInput.value.trim() : "";
      const freshJob = state.jobs.find(j => j.jobNo === job.jobNo) || job;
      addCommLogEntry_(freshJob, type, note);
      refreshOpenPanel_();
    });
  }

  renderPanelQuickActions_(drawer, job);
}

function refreshOpenPanel_() {
  const overlay = document.getElementById("job-panel-overlay");
  if (!overlay || !overlay.classList.contains("open")) return;
  const drawer = overlay.querySelector(".panel-drawer");
  if (!drawer) return;
  const jobNoEl = drawer.querySelector(".panel-job-no");
  if (!jobNoEl) return;
  const jobNo = jobNoEl.textContent.trim();
  const job = state.jobs.find(j => j.jobNo === jobNo);
  if (!job) return;
  drawer.innerHTML = buildPanelHtml_(job);
  setupPanelHandlers_(drawer, job);
}

function buildCommLogHtml_(job) {
  const log = Array.isArray(job.commLog) ? job.commLog : [];
  const typeClass = t => `comms-type-${String(t || "other").toLowerCase().replace(/[^a-z]/g, "")}`;
  const entries = [...log].reverse().map(e => {
    let dateStr = "";
    try { dateStr = e.ts ? new Date(e.ts).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" }) : ""; } catch(_e) {}
    const isStatus = String(e.type || "") === "Status";
    return `<div class="comms-entry${isStatus ? " comms-entry-status" : ""}">
      <span class="comms-entry-type ${escapeHtml(typeClass(e.type))}">${isStatus ? "✓" : escapeHtml(e.type || "?")}</span>
      <div class="comms-entry-body">
        ${e.note ? `<div class="comms-entry-note">${escapeHtml(e.note)}</div>` : ""}
        <div class="comms-entry-meta">${escapeHtml(e.staff || "?")} · ${escapeHtml(dateStr)}</div>
      </div>
    </div>`;
  }).join("");

  return `<div class="panel-section panel-comms-section">
    <div class="panel-section-title">Activity Log</div>
    <div class="comms-log-list">${entries || `<div class="comms-log-empty">No activity logged yet</div>`}</div>
    <div class="comms-add-row">
      <select class="comms-type-sel">
        <option value="WhatsApp">WhatsApp</option>
        <option value="Email">Email</option>
        <option value="Phone">Phone</option>
        <option value="In-Person">In-Person</option>
        <option value="Other">Other</option>
      </select>
      <input type="text" class="comms-note-input" placeholder="Note (optional)" maxlength="200" />
      <button type="button" class="comms-log-btn">Log</button>
    </div>
  </div>`;
}

function buildPanelHtml_(job) {
  const theme = getCategoryTheme_(job.category);
  const badge = getCardBadge_(job);
  const escH = (s) => escapeHtml(String(s || ""));
  const specsLines = String(job.specs || "").split("\n").filter(Boolean);
  const specsHtml = specsLines.map(l => `<div class="panel-spec-row">${escH(l)}</div>`).join("") || `<div class="panel-spec-row" style="color:var(--muted)">No specs recorded</div>`;

  const isInhouse = job.category === "In-house";
  const metaItems = [
    ["Staff", job.staff],
    ["Category", job.category],
    ["Payment", job.payment],
    job.paymentMethod ? ["Payment Method", job.paymentMethod] : null,
    Number(job.jobValue) > 0 ? ["Job Value", `R${Number(job.jobValue).toFixed(2)}`] : null,
    ["Turnaround", job.turnaroundPurchased],
    isInhouse ? null : ["Supplier", job.supplier],
    isInhouse ? null : ["Partner", job.outsourcePartner],
    ["Artwork Source", job.artworkSource],
    ["Phone", job.customerPhone],
    ["Email", job.customerEmail],
  ].filter(item => {
    if (!item) return false;
    const [, v] = item;
    if (!v || !(v.trim)) return false;
    const s = v.trim().toUpperCase();
    return s && !["TBR", "TBC", "N/A", "NA", "NONE", "-"].includes(s);
  });

  const metaHtml = metaItems.map(([k, v]) => `
    <div class="panel-meta-item">
      <div class="panel-meta-label">${escH(k)}</div>
      <div class="panel-meta-value">${escH(v)}</div>
    </div>`).join("");

  const orderGroupHtml = (() => {
    if (!job.orderGroup) return "";
    const siblings = (state.jobs || []).filter(j =>
      j.orderGroup === job.orderGroup && !isSoftDeleted_(j)
    );
    if (siblings.length < 2) return "";
    const rows = siblings.map(sib => {
      const sibBadge = getCardBadge_(sib);
      const isCurrent = sib.jobNo === job.jobNo;
      return `<div class="order-sibling${isCurrent ? " current" : ""}">
        <span class="order-sibling-no">${escH(sib.jobNo)}</span>
        <span class="order-sibling-product">${escH(sib.product)}</span>
        <span class="badge ${escH(sibBadge.className)}" style="font-size:10px">${escH(sibBadge.text)}</span>
      </div>`;
    }).join("");
    return `<div class="panel-section">
      <div class="panel-section-title">Order ${escH(job.orderGroup)}</div>
      ${rows}
    </div>`;
  })();

  const _cleanNotes = stripInternalNoteLines_(job.notes);
  const notesHtml = _cleanNotes ? `
    <div class="panel-section">
      <div class="panel-section-title">Notes</div>
      <div class="panel-notes">${escH(_cleanNotes)}</div>
    </div>` : "";

  const artworkHtml = job.artworkLink ? `
    <a href="${escH(job.artworkLink)}" target="_blank" rel="noopener noreferrer" class="panel-artwork-btn">View Artwork</a>` : "";

  const urgentTag = job.urgent ? `<span class="panel-tag urgent">URGENT</span>` : "";
  const riskTag = job.promiseRisk ? `<span class="panel-tag risk">PROMISE RISK</span>` : "";

  // ── Notify customer button ───────────────────────────────────────────────
  const notify = buildCustomerNotify_(job);
  // Use a button (not a link) so we can intercept the click and log the comm.
  const notifyHtml = notify
    ? `<button type="button" class="panel-btn-notify ${notify.type === "whatsapp" ? "panel-btn-whatsapp" : "panel-btn-email"}" data-notify-url="${escH(notify.url)}" data-notify-type="${escH(notify.type)}">${notify.type === "whatsapp" ? "WhatsApp Customer" : "Email Customer"}</button>`
    : "";

  // ── Gmail thread search link — only when customer has an email on file ───
  const _gmailEmail = String(job.customerEmail || "").trim();
  const gmailHtml = _gmailEmail
    ? (() => {
        const gmailAccount = "isglengarry@gmail.com";
        const gmailSearchUrl = `https://mail.google.com/mail/?authuser=${gmailAccount}#search/${encodeURIComponent(_gmailEmail)}`;
        return `<a href="${gmailSearchUrl}" target="_blank" rel="noopener noreferrer" class="panel-btn-gmail">View Emails</a>`;
      })()
    : "";

  return `
    <div class="panel-cat-bar" style="background:${theme.base}"></div>
    <div class="panel-header">
      <div class="panel-header-left">
        <div class="panel-job-no">${escH(job.jobNo)}</div>
        <div class="panel-customer">${escH(job.customer)}</div>
        <div class="panel-product">${escH(job.product)}</div>
        <div class="panel-tags">${urgentTag}${riskTag}<span class="badge ${badge.className}">${escH(badge.text)}</span></div>
      </div>
      <button class="panel-close" aria-label="Close panel">&times;</button>
    </div>
    <div id="panel-next-steps" class="next-steps-row panel-next-steps"></div>
    <div class="panel-body">
      <div class="panel-section">
        <div class="panel-section-title">Due Date</div>
        <div class="panel-due">${escH(job.due || "Not set")}</div>
      </div>
      <div class="panel-section">
        <div class="panel-section-title">Specifications</div>
        <div class="panel-specs">${specsHtml}</div>
      </div>
      ${artworkHtml ? `<div class="panel-section">${artworkHtml}</div>` : ""}
      ${notesHtml}
      ${metaItems.length ? `
      <div class="panel-section">
        <div class="panel-section-title">Details</div>
        <div class="panel-meta-grid">${metaHtml}</div>
      </div>` : ""}
      ${orderGroupHtml}
      ${buildCommLogHtml_(job)}
      <div class="panel-actions">
        ${notifyHtml}
        ${gmailHtml}
        <button class="panel-btn-detail">Full Detail View</button>
      </div>
    </div>`;
}

// ── Toast notifications ───────────────────────────────────────────────────

function showToast_(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3500);
}

// ── Refresh indicator ─────────────────────────────────────────────────────

function renderRefreshIndicator_() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;
  let ind = document.getElementById("refresh-indicator");
  if (!ind) {
    ind = document.createElement("div");
    ind.id = "refresh-indicator";
    ind.className = "refresh-indicator";
    topbar.appendChild(ind);
  }
  const now = state.lastRefresh;
  if (!now) {
    ind.innerHTML = `<span class="refresh-dot"></span><span class="refresh-label">Loading…</span>`;
    return;
  }
  const mins = Math.floor((Date.now() - now.getTime()) / 60000);
  const label = mins < 1 ? "just now" : `${mins}m ago`;
  ind.innerHTML = `<span class="refresh-dot"></span><span class="refresh-label">Updated ${label}</span>`;
}

// ─────────────────────────────────────────────────────────────────────────

function card(job) {
  const t = document.getElementById("card-template").content.cloneNode(true);
  const cardEl = t.querySelector(".job-card");
  cardEl.dataset.category = getCategoryTheme_(job.category).key;
  t.querySelector(".job-no").textContent = job.jobNo;
  t.querySelector(".job-customer").textContent = job.customer;
  t.querySelector(".job-product").textContent = job.product;
  const dateLabel = String(job.dateLabel || "Due");
  t.querySelector(".due").textContent = `${dateLabel}: ${job.due}`;
  const badge = t.querySelector(".badge");
  if (state.savingJobNos.has(job.jobNo)) {
    badge.textContent = "Updating…";
    badge.classList.add("saving");
    cardEl.classList.add("card-saving");
  } else {
    const badgeInfo = getCardBadge_(job);
    badge.textContent = badgeInfo.text;
    if (badgeInfo.className) badge.classList.add(badgeInfo.className);
  }
  if (shouldShowUnpaidCardBadge_(job)) {
    const unpaidBadge = document.createElement("span");
    unpaidBadge.className = "badge unpaid-hold";
    unpaidBadge.textContent = "Unpaid";
    t.querySelector(".job-meta").appendChild(unpaidBadge);
  }
  if (String(job.payment || "").trim() === "Pay on Collection") {
    const pocBadge = document.createElement("span");
    pocBadge.className = "badge poc-hold";
    pocBadge.textContent = "Pay on Collection";
    t.querySelector(".job-meta").appendChild(pocBadge);
  }
  if (job.orderGroup) {
    const orderJobs = state.jobs.filter(j => j.orderGroup === job.orderGroup && !isSoftDeleted_(j));
    if (orderJobs.length >= 2) {
      const doneCount = orderJobs.filter(j => ["Collected", "Closed"].includes(j.status)).length;
      const allDone = doneCount === orderJobs.length;
      const orderBadge = document.createElement("span");
      orderBadge.className = "badge order-group";
      orderBadge.textContent = allDone
        ? `Order ${job.orderGroup} · ${orderJobs.length} done`
        : doneCount > 0
          ? `Order ${job.orderGroup} · ${doneCount}/${orderJobs.length} collected`
          : `Order ${job.orderGroup} · ${orderJobs.length} jobs`;
      t.querySelector(".job-meta").appendChild(orderBadge);
    }
  }
  if (job.promiseRisk) {
    const risk = document.createElement("div");
    risk.className = "card-alert risk";
    risk.textContent = "PROMISE RISK";
    t.querySelector(".job-card").appendChild(risk);
  }
  if (job.urgent) {
    const urgent = document.createElement("div");
    urgent.className = "card-alert urgent";
    urgent.textContent = "URGENT REQUEST";
    t.querySelector(".job-card").appendChild(urgent);
  }
  const missingSpecsCard = getIncompleteSpecFields_(job);
  if (missingSpecsCard.length) {
    const specBadge = document.createElement("span");
    specBadge.className = "badge incomplete-specs";
    specBadge.textContent = "Incomplete Specs";
    t.querySelector(".job-meta").appendChild(specBadge);
  }
  if (state.cleanMode) {
    // Clean mode is already handled — text prefixes removed from all cards.
  }
  cardEl.onclick = () => {
    state.selectedJobNo = job.jobNo;
    openJobPanel_(job.jobNo);
  };
  return t;
}

function shouldShowUnpaidCardBadge_(job) {
  const payment = String(job.payment || "").trim();
  const status = String(job.status || "").trim();
  const unpaid = ["Unpaid", "Pending", "Partially Paid"].includes(payment);
  if (!unpaid) return false;
  // Skip duplicate when status already explicitly indicates payment block.
  if (status === "Waiting Payment" || status === "Waiting Payment & Artwork") return false;
  return true;
}

function getCardBadge_(job) {
  const status = String(job.status || "").trim();
  if ((status === "Waiting Artwork" || status === "Waiting Payment & Artwork") && String(job.artworkSource || "").trim() === "ISG to design") {
    return { text: "Design Needed", className: "wait-design" };
  }
  const map = {
    "Waiting Payment": ["Waiting Payment", "wait-payment"],
    "Waiting Artwork": ["Waiting Artwork", "wait-artwork"],
    "Waiting Payment & Artwork": ["Waiting Payment + Artwork", "wait-both"],
    "Waiting Approval": ["Waiting Approval", "wait-approval"],
    "Awaiting Artwork Approval": ["Waiting Artwork Approval", "wait-approval"],
    "Awaiting Hard Proof Approval": ["Waiting Hard Proof Approval", "wait-approval"],
    "Unpaid": ["Unpaid", "wait-payment"],
    "Backordered": ["Backordered", "backorder"],
    "Ready to Order": ["Ready to Order", "ready"],
    "Order Placed": ["Order Placed", "progress"],
    "Batched (DTF Order)": ["Batched (DTF Order)", "progress"],
    "Batched (Vinyl Print Run)": ["Batched (Vinyl Print Run)", "progress"],
    "DTF Order Placed": ["DTF Order Placed", "progress"],
    "Ready": ["Ready", "ready"],
    "In Production": ["In Production", "progress"],
    "Return: Awaiting Dispatch": ["Awaiting Dispatch", "wait-artwork"],
    "Return: Sent to Supplier": ["Sent to Supplier", "progress"],
    "Supplier Feedback Received": ["Supplier Feedback", "progress"],
    "Ready for Collection": ["Ready for Collection", "collection"],
    "Collected": ["Collected", "done"],
    "Closed": ["Closed", "done"],
    "Design: In Progress": ["Design In Progress", "progress"],
  };
  if (map[status]) return { text: map[status][0], className: map[status][1] };
  return { text: status || "Open", className: "open" };
}

function renderBoard(ownerMode = false) {
  const lanes = ownerMode
    ? ["In-house", "Outsourced", "Ink/Stock", "Returns"]
    : ["In-house", "Outsourced", "Ink/Stock", "Returns", "Design"];
  const wrap = document.createElement("section");
  wrap.className = "lanes";
  if (state.cleanMode) wrap.classList.add("clean");

  // ── Staff filter bar (staff board only) ───────────────────────────────────
  if (!ownerMode) {
    const activeJobs = state.jobs.filter(j => !isSoftDeleted_(j) && !isCancellationOpen_(j) && !isJobCompleted_(j));
    const staffNames = dedupeStrings_(activeJobs.map(j => String(j.staff || "").trim()).filter(Boolean)).sort();

    if (staffNames.length > 0) {
      const bar = document.createElement("div");
      bar.className = "staff-filter-bar";
      bar.innerHTML = `
        <label for="sb-staff-filter">Filter by staff:</label>
        <select id="sb-staff-filter">
          <option value="ALL">All staff</option>
          ${staffNames.map(s => `<option value="${escapeHtml(s)}"${state.staffBoardFilter === s ? " selected" : ""}>${escapeHtml(s)}</option>`).join("")}
        </select>
      `;
      bar.querySelector("#sb-staff-filter").addEventListener("change", (e) => {
        state.staffBoardFilter = e.target.value;
        render();
      });
      wrap.appendChild(bar);
    }
  }

  const staffFilter = !ownerMode && state.staffBoardFilter !== "ALL" ? state.staffBoardFilter : null;

  lanes.forEach((name) => {
    const theme = getCategoryTheme_(name);
    const lane = document.createElement("div");
    lane.className = "lane";
    lane.dataset.category = theme.key;
    const total = laneBuckets(name);
    const filterFn = j => !staffFilter || String(j.staff || "").trim() === staffFilter;
    const filteredNeeds = total.needs.filter(filterFn);
    const filteredReady = total.ready.filter(filterFn);
    const allJobs = [...filteredNeeds, ...filteredReady];
    const header = document.createElement("div");
    header.className = "lane-header";
    header.innerHTML = `
      <h3 class="lane-title">${ownerMode ? `${name} (Issues)` : name}</h3>
      <span class="lane-count">${allJobs.length}</span>
    `;
    lane.appendChild(header);
    let ownerNeeds = total.needs;
    if (ownerMode) {
      const needsSet = new Set(total.needs.map(j => j.jobNo));
      if (name === "In-house") {
        const extra = total.ready.filter(j =>
          ["Batched (DTF Order)", "Batched (Vinyl Print Run)"].includes(j.status) && !needsSet.has(j.jobNo)
        );
        ownerNeeds = [...total.needs, ...extra];
      }
      if (name === "Outsourced") {
        const extra = total.ready.filter(j => j.status === "Ready to Order" && !needsSet.has(j.jobNo));
        ownerNeeds = [...total.needs, ...extra];
      }
      if (name === "Ink/Stock") {
        const extra = total.ready.filter(j => j.status === "Ready to Order" && !needsSet.has(j.jobNo));
        ownerNeeds = [...total.needs, ...extra];
      }
      if (name === "Returns") {
        const extra = total.ready.filter(j => !needsSet.has(j.jobNo));
        ownerNeeds = [...total.needs, ...extra];
      }
    }
    const buckets = ownerMode
      ? [["Needs Action", ownerNeeds]]
      : [["Needs Action", filteredNeeds], ["Ready", filteredReady]];

    buckets.forEach(([title, list]) => {
      const sec = document.createElement("div");
      sec.className = `bucket ${title === "Needs Action" ? "bucket-needs" : "bucket-ready"}`;
      sec.innerHTML = `<h4>${title} <span style="font-weight:normal;opacity:.7">(${list.length})</span></h4>`;
      if (!list.length) {
        const p = document.createElement("div");
        p.className = "bucket-empty";
        p.textContent = "All clear";
        sec.appendChild(p);
      } else {
        list.sort((a, z) => a.due.localeCompare(z.due)).forEach(j => sec.appendChild(card(j)));
      }
      lane.appendChild(sec);
    });
    wrap.appendChild(lane);
  });
  return wrap;
}

function isCompletedStatusForCategory_(category, status) {
  if (category === "Returns") return status === "Closed";
  if (category === "Design") return status === "Completed";
  return status === "Collected";
}

function renderOwnerDesignQueue() {
  const panel = document.createElement("section");
  panel.className = "panel job-detail";
  panel.style.marginTop = "10px";
  panel.innerHTML = "<h3>Design Requests</h3>";

  const list = state.jobs
    .filter(j => !isSoftDeleted_(j))
    .filter(j => String(j.artworkSource || "").trim() === "ISG to design")
    .filter(j => !isJobCompleted_(j))
    .sort((a, b) => String(a.due || "").localeCompare(String(b.due || "")));

  if (!list.length) {
    const none = document.createElement("div");
    none.className = "job-customer";
    none.textContent = "None";
    panel.appendChild(none);
    return panel;
  }

  list.forEach(job => panel.appendChild(card(job)));
  return panel;
}

function renderOwnerReports() {
  const panel = document.createElement("section");
  panel.className = "panel reports-root";

  if (state.role !== "owner") {
    panel.innerHTML = "<h3>Reports</h3><div class=\"job-customer\">Owner profile only.</div>";
    return panel;
  }

  const filters = state.reportFilters || {};
  const allJobs = state.jobs.filter(j => !isSoftDeleted_(j));
  const staffOptions = dedupeStrings_(allJobs.map(j => String(j.staff || "").trim()).filter(Boolean)).sort();
  const categoryOptions = dedupeStrings_(allJobs.map(j => String(j.category || "").trim()).filter(Boolean)).sort();
  const fromVal = String(filters.from || "").trim();
  const toVal = String(filters.to || "").trim();

  // Build a lightweight product list based on all current filters except product.
  // This keeps the product dropdown short and relevant.
  const jobsForProductOptions = allJobs.filter((job) => {
    if (filters.includeCompleted === false && isJobCompleted_(job)) return false;
    if (String(filters.staff || "ALL") !== "ALL" && String(job.staff || "").trim() !== String(filters.staff || "")) return false;
    if (String(filters.category || "ALL") !== "ALL" && String(job.category || "").trim() !== String(filters.category || "")) return false;
    if (fromVal || toVal) {
      const d = getReportDateKey_(job);
      if (!d) return false;
      if (fromVal && d < fromVal) return false;
      if (toVal && d > toVal) return false;
    }
    return true;
  });

  const productStats = new Map();
  jobsForProductOptions.forEach((j) => {
    const key = String(j.product || "").trim();
    if (!key) return;
    productStats.set(key, (productStats.get(key) || 0) + 1);
  });
  const productOptions = [...productStats.keys()].sort((a, b) => a.localeCompare(b));
  const topProductOptions = [...productStats.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 14);
  const selectedProduct = productStats.has(String(filters.product || "")) ? String(filters.product || "") : "ALL";

  panel.innerHTML = `
    <h3>Owner Reports</h3>
    <div class="finder-subtitle">Filter jobs by staff, category, product, and date. Export targeted customer contacts for follow-ups and campaigns.</div>
    <div class="report-controls">
      <div class="kv"><label>From</label><input id="rp-from" type="date" value="${escapeHtml(filters.from || "")}" /></div>
      <div class="kv"><label>To</label><input id="rp-to" type="date" value="${escapeHtml(filters.to || "")}" /></div>
      <div class="kv"><label>Staff</label><select id="rp-staff"><option value="ALL">All staff</option>${staffOptions.map(s => `<option value="${escapeHtml(s)}"${String(filters.staff) === s ? " selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select></div>
      <div class="kv"><label>Category</label><select id="rp-category"><option value="ALL">All categories</option>${categoryOptions.map(s => `<option value="${escapeHtml(s)}"${String(filters.category) === s ? " selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select></div>
      <div class="kv report-product-picker"><label>Product</label><div class="report-product-row"><select id="rp-product">
        <option value="ALL">All products (${jobsForProductOptions.length})</option>
        ${topProductOptions.length ? `<optgroup label="Top Products">
          ${topProductOptions.map(([name, count]) => `<option value="${escapeHtml(name)}"${selectedProduct === name ? " selected" : ""}>${escapeHtml(name)} (${count})</option>`).join("")}
        </optgroup>` : ""}
        ${productOptions.length ? `<optgroup label="All Products (A-Z)">
          ${productOptions.map((name) => {
            const count = Number(productStats.get(name) || 0);
            return `<option value="${escapeHtml(name)}"${selectedProduct === name ? " selected" : ""}>${escapeHtml(name)} (${count})</option>`;
          }).join("")}
        </optgroup>` : ""}
      </select><button id="rp-product-clear" type="button" class="secondary">Reset</button></div></div>
      <div class="kv report-checkbox"><label>Include completed</label><input id="rp-completed" type="checkbox" ${filters.includeCompleted !== false ? "checked" : ""} /></div>
    </div>
  `;

  const fromInput = panel.querySelector("#rp-from");
  const toInput = panel.querySelector("#rp-to");
  const staffInput = panel.querySelector("#rp-staff");
  const categoryInput = panel.querySelector("#rp-category");
  const productInput = panel.querySelector("#rp-product");
  const productClearBtn = panel.querySelector("#rp-product-clear");
  const completedInput = panel.querySelector("#rp-completed");

  const filtered = allJobs.filter(job => {
    if (completedInput && !completedInput.checked && isJobCompleted_(job)) return false;
    if (staffInput && staffInput.value !== "ALL" && String(job.staff || "").trim() !== staffInput.value) return false;
    if (categoryInput && categoryInput.value !== "ALL" && String(job.category || "").trim() !== categoryInput.value) return false;
    if (productInput && productInput.value !== "ALL" && String(job.product || "").trim() !== productInput.value) {
      return false;
    }

    const currentFromVal = String(fromInput && fromInput.value || "").trim();
    const currentToVal = String(toInput && toInput.value || "").trim();
    if (!currentFromVal && !currentToVal) return true;
    const d = getReportDateKey_(job);
    if (!d) return false;
    if (currentFromVal && d < currentFromVal) return false;
    if (currentToVal && d > currentToVal) return false;
    return true;
  });

  const totalValue = filtered.reduce((sum, j) => sum + (Number(j.jobValue) || 0), 0);
  const unpaidCount = filtered.filter(j => {
    const p = String(j.payment || "").trim().toLowerCase();
    return p && p !== "paid";
  }).length;
  const promiseRiskCount = filtered.filter(j => !!j.promiseRisk).length;
  const avgValue = filtered.length ? totalValue / filtered.length : 0;
  const visual = renderReportVisualDashboard_(filtered, {
    totalValue,
    unpaidCount,
    promiseRiskCount,
    avgValue,
  });
  panel.appendChild(visual);

  const kpis = document.createElement("div");
  kpis.className = "report-kpis";
  kpis.innerHTML = `
    <article class="report-kpi"><div class="label">Jobs</div><div class="value">${filtered.length}</div></article>
    <article class="report-kpi rp-revenue"><div class="label">Total Value</div><div class="value">${escapeHtml(formatCurrencyR_(totalValue))}</div></article>
    <article class="report-kpi rp-avg"><div class="label">Avg Job Value</div><div class="value">${escapeHtml(formatCurrencyR_(avgValue))}</div></article>
    <article class="report-kpi${unpaidCount > 0 ? " rp-warn" : ""}"><div class="label">Unpaid</div><div class="value">${unpaidCount}</div></article>
    <article class="report-kpi${promiseRiskCount > 0 ? " rp-danger" : ""}"><div class="label">Promise Risk</div><div class="value">${promiseRiskCount}</div></article>
  `;
  panel.appendChild(kpis);

  const breakdown = document.createElement("div");
  breakdown.className = "report-grid";
  breakdown.appendChild(renderReportStaffTable_(filtered));
  breakdown.appendChild(renderReportProductTable_(filtered));
  panel.appendChild(breakdown);

  panel.appendChild(renderReportContacts_(filtered));

  const wire = () => {
    state.reportFilters = {
      from: String(fromInput.value || ""),
      to: String(toInput.value || ""),
      staff: String(staffInput.value || "ALL"),
      category: String(categoryInput.value || "ALL"),
      product: String(productInput.value || ""),
      includeCompleted: !!completedInput.checked,
    };
    render();
  };
  [fromInput, toInput, staffInput, categoryInput, productInput, completedInput].forEach(el => {
    if (!el) return;
    el.addEventListener("change", wire);
  });
  if (productClearBtn) {
    productClearBtn.addEventListener("click", () => {
      if (productInput) productInput.value = "ALL";
      wire();
    });
  }

  return panel;
}

// ─── Owner Actions Tab ────────────────────────────────────────────────────────

const ACTION_CATEGORIES_UI = ["Supplier", "Invoice", "Admin", "Customer Order", "Staff", "Other"];
const ACTION_PRIORITIES_UI = ["High", "Medium", "Low"];
const ACTION_STATUSES_UI   = ["Open", "In Progress", "Done"];

const ACTION_PRIORITY_THEME = {
  "High":   { key: "high",   label: "High",   badgeCls: "action-pri-high"   },
  "Medium": { key: "medium", label: "Medium", badgeCls: "action-pri-medium" },
  "Low":    { key: "low",    label: "Low",    badgeCls: "action-pri-low"    },
};

function renderOwnerActions() {
  const wrap = document.createElement("section");
  wrap.className = "lanes actions-board";

  // ── handover banner ──────────────────────────────────────────────────────
  const lastVisitRaw = (() => { try { return window.localStorage.getItem(ACTIONS_LAST_VISIT_KEY); } catch (_e) { return null; } })();
  const lastVisit = lastVisitRaw ? new Date(lastVisitRaw) : null;
  const sinceNew  = lastVisit ? state.actions.filter(a => {
    const c = a["Created Date"] ? new Date(a["Created Date"]) : null;
    return c && c > lastVisit && a["Status"] !== "Done";
  }) : [];
  const sinceDone = lastVisit ? state.actions.filter(a => {
    const c = a["Created Date"] ? new Date(a["Created Date"]) : null;
    return c && c > lastVisit && a["Status"] === "Done";
  }) : [];
  if (lastVisit && (sinceNew.length || sinceDone.length)) {
    const banner = document.createElement("div");
    banner.className = "actions-handover-banner";
    const parts = [];
    if (sinceNew.length)  parts.push(`<strong>${sinceNew.length}</strong> new action${sinceNew.length > 1 ? "s" : ""} added`);
    if (sinceDone.length) parts.push(`<strong>${sinceDone.length}</strong> marked done`);
    banner.innerHTML = `Since your last visit: ${parts.join(" · ")}`;
    wrap.appendChild(banner);
  }
  try { window.localStorage.setItem(ACTIONS_LAST_VISIT_KEY, new Date().toISOString()); } catch (_e) {}

  // ── header row ─────────────────────────────────────────────────────────
  const hdr = document.createElement("div");
  hdr.className = "actions-board-header";
  hdr.innerHTML = `<h2 style="margin:0;font-size:var(--fs-lane);font-weight:var(--fw-bold)">Actions</h2>`;
  const newBtn = document.createElement("button");
  newBtn.className = "actions-new-btn";
  newBtn.textContent = state.actionsNewForm ? "Cancel" : "+ New Action";
  newBtn.onclick = () => { state.actionsNewForm = !state.actionsNewForm; render(); };
  hdr.appendChild(newBtn);
  wrap.appendChild(hdr);

  // ── new action form ─────────────────────────────────────────────────────
  if (state.actionsNewForm) {
    const form = document.createElement("div");
    form.className = "actions-new-form";
    form.innerHTML = `
      <div class="actions-form-row">
        <label class="actions-form-label">Title</label>
        <input id="act-title" class="actions-form-input" placeholder="What needs to be done?" />
      </div>
      <div class="actions-form-grid">
        <div>
          <label class="actions-form-label">Category</label>
          <select id="act-category" class="actions-form-select">
            ${ACTION_CATEGORIES_UI.map(c => `<option value="${c}">${c}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="actions-form-label">Priority</label>
          <select id="act-priority" class="actions-form-select">
            ${ACTION_PRIORITIES_UI.map(p => `<option value="${p}">${p}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="actions-form-label">Due Date</label>
          <input id="act-due" type="date" class="actions-form-select" />
        </div>
      </div>
      <div class="actions-form-row">
        <label class="actions-form-label">Linked Job #</label>
        <input id="act-job" class="actions-form-input" placeholder="ISG-000001 (optional)" style="max-width:200px"/>
      </div>
      <div class="actions-form-row">
        <label class="actions-form-label">Notes</label>
        <textarea id="act-notes" class="actions-form-input" rows="2" placeholder="Any details…" style="resize:vertical"></textarea>
      </div>
    `;
    const saveBtn = document.createElement("button");
    saveBtn.className = "btn-primary";
    saveBtn.style.marginTop = "8px";
    saveBtn.textContent = "Create Action";
    saveBtn.onclick = async () => {
      const title = String(form.querySelector("#act-title").value || "").trim();
      if (!title) { showToast_("Please enter a title", "warn"); return; }
      saveBtn.disabled = true;
      saveBtn.textContent = "Creating…";
      try {
        const actionData = {
          "Title":        title,
          "Category":     form.querySelector("#act-category").value,
          "Priority":     form.querySelector("#act-priority").value,
          "Due Date":     form.querySelector("#act-due").value,
          "Linked Job #": form.querySelector("#act-job").value,
          "Notes":        form.querySelector("#act-notes").value,
        };
        const res  = await fetch(API.baseUrl, { method: "POST", body: JSON.stringify({ action: "createAction", key: API.key, data: actionData }) });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Failed");
        showToast_("Action created", "success");
        state.actionsNewForm = false;
        await loadActionsOnly_();
        render();
      } catch (err) {
        showToast_("Error: " + (err.message || err), "error");
        saveBtn.disabled = false;
        saveBtn.textContent = "Create Action";
      }
    };
    form.appendChild(saveBtn);
    wrap.appendChild(form);
  }

  // ── lanes: High | Medium | Low | Done ────────────────────────────────────
  const groups = { "High": [], "Medium": [], "Low": [], "Done": [] };
  const deletedActions = [];
  state.actions.forEach(a => {
    if (a["Status"] === "Deleted") { deletedActions.push(a); return; }
    if (a["Status"] === "Done") { groups["Done"].push(a); return; }
    const p = a["Priority"] || "Medium";
    (groups[p] || groups["Medium"]).push(a);
  });

  const lanes = [
    { key: "High",   label: "High Priority",   dataset: "high"   },
    { key: "Medium", label: "Medium Priority",  dataset: "medium" },
    { key: "Low",    label: "Low Priority",     dataset: "low"    },
    { key: "Done",   label: "Done",             dataset: "done"   },
  ];

  lanes.forEach(({ key, label, dataset }) => {
    const items = groups[key] || [];
    const lane = document.createElement("div");
    lane.className = "lane";
    lane.dataset.category = dataset;
    const hdr = document.createElement("div");
    hdr.className = "lane-header";
    hdr.innerHTML = `<h3 class="lane-title">${label}</h3><span class="lane-count">${items.length}</span>`;
    lane.appendChild(hdr);
    const bucket = document.createElement("div");
    bucket.className = "bucket bucket-needs";
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "bucket-empty";
      empty.textContent = "All clear";
      bucket.appendChild(empty);
    } else {
      items.forEach(a => bucket.appendChild(actionCard_(a)));
    }
    lane.appendChild(bucket);
    wrap.appendChild(lane);
  });

  // ── Archive (owner / admin only) ──────────────────────────────────────────
  if ((state.role === "owner" || state.role === "admin") && deletedActions.length) {
    const archiveWrap = document.createElement("div");
    archiveWrap.className = "actions-archive";
    archiveWrap.style.cssText = "grid-column:1/-1;margin-top:24px;border-top:1px solid var(--line);padding-top:16px";

    const archiveToggle = document.createElement("button");
    archiveToggle.className = "archive-toggle-btn";
    archiveToggle.style.cssText = "background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:0.85rem;padding:0;display:flex;align-items:center;gap:6px";
    archiveToggle.innerHTML = `<span class="archive-toggle-icon">▶</span> Archived Actions (${deletedActions.length})`;

    const archiveList = document.createElement("div");
    archiveList.className = "archive-list";
    archiveList.style.cssText = "display:none;margin-top:12px;display:none";
    deletedActions.forEach(a => {
      const card = actionCard_(a);
      card.style.opacity = "0.6";
      archiveList.appendChild(card);
    });

    archiveToggle.addEventListener("click", () => {
      const open = archiveList.style.display !== "none";
      archiveList.style.display = open ? "none" : "grid";
      archiveList.style.gridTemplateColumns = "repeat(auto-fill,minmax(240px,1fr))";
      archiveList.style.gap = "12px";
      archiveToggle.querySelector(".archive-toggle-icon").textContent = open ? "▶" : "▼";
    });

    archiveWrap.appendChild(archiveToggle);
    archiveWrap.appendChild(archiveList);
    wrap.appendChild(archiveWrap);
  }

  return wrap;
}

function actionCard_(action) {
  const id       = action["Action #"]     || "";
  const title    = action["Title"]        || "(untitled)";
  const category = action["Category"]     || "";
  const priority = action["Priority"]     || "";
  const status   = action["Status"]       || "Open";
  const due      = String(action["Due Date"] || "").slice(0, 10);
  const notes    = String(action["Notes"] || "").trim();

  const card = document.createElement("article");
  card.className = "job-card" + (status === "Done" ? " action-card--done" : "");

  const titleEl = document.createElement("div");
  titleEl.className = "job-product action-card__title";
  titleEl.textContent = title;
  card.appendChild(titleEl);

  const catEl = document.createElement("div");
  catEl.className = "job-customer";
  catEl.textContent = category;
  card.appendChild(catEl);

  const noEl = document.createElement("div");
  noEl.className = "job-no action-card__id";
  noEl.textContent = id;
  card.appendChild(noEl);

  const meta = document.createElement("div");
  meta.className = "job-meta";
  if (due) {
    const dueEl = document.createElement("span");
    dueEl.className = "due";
    dueEl.textContent = "Due: " + due;
    meta.appendChild(dueEl);
  }
  const badge = document.createElement("span");
  badge.className = "badge " + statusToBadgeCls_(status);
  badge.textContent = status;
  meta.appendChild(badge);
  card.appendChild(meta);

  if (notes) {
    const notesEl = document.createElement("div");
    notesEl.className = "action-card__notes";
    notesEl.textContent = notes;
    card.appendChild(notesEl);
  }

  card.onclick = () => openActionPanel_(action["Action #"]);
  return card;
}

function statusToBadgeCls_(status) {
  if (status === "Open")        return "open";
  if (status === "In Progress") return "progress";
  if (status === "Done")        return "done";
  return "open";
}

function openActionPanel_(actionId) {
  const action = state.actions.find(a => a["Action #"] === actionId);
  if (!action) return;

  let overlay = document.getElementById("action-panel-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "action-panel-overlay";
    overlay.className = "panel-overlay";
    document.body.appendChild(overlay);
    const backdrop = document.createElement("div");
    backdrop.className = "panel-overlay-backdrop";
    backdrop.addEventListener("click", closeActionPanel_);
    overlay.appendChild(backdrop);
    const drawer = document.createElement("div");
    drawer.className = "panel-drawer";
    overlay.appendChild(drawer);
  }

  const drawer = overlay.querySelector(".panel-drawer");
  drawer.innerHTML = buildActionPanelHtml_(action);
  drawer.querySelector(".panel-close").addEventListener("click", closeActionPanel_);

  // status change — optimistic update then background save
  const statusSel = drawer.querySelector(".action-panel-status");
  if (statusSel) {
    statusSel.addEventListener("change", () => {
      const newStatus = statusSel.value;
      const idx = state.actions.findIndex(a => a["Action #"] === actionId);
      if (idx >= 0) state.actions[idx] = { ...state.actions[idx], "Status": newStatus };
      render();
      openActionPanel_(actionId);
      apiUpdateAction_({ id: actionId, updates: { "Status": newStatus } })
        .then(() => loadActionsOnly_().then(() => { render(); openActionPanel_(actionId); }))
        .catch(err => showToast_("Failed: " + (err.message || err), "error"));
    });
  }

  // save note — optimistic update then background save
  const noteBtn = drawer.querySelector(".action-panel-note-btn");
  if (noteBtn) {
    noteBtn.addEventListener("click", () => {
      const input = drawer.querySelector(".action-panel-note-input");
      const added = String(input ? input.value : "").trim();
      if (!added) return;
      noteBtn.disabled = true;
      const idx = state.actions.findIndex(a => a["Action #"] === actionId);
      const existing = String(idx >= 0 ? state.actions[idx]["Notes"] || "" : action["Notes"] || "");
      const combined = existing ? existing + "\n" + added : added;
      if (idx >= 0) state.actions[idx] = { ...state.actions[idx], "Notes": combined };
      render();
      openActionPanel_(actionId);
      apiUpdateAction_({ id: actionId, updates: { "Notes": combined } })
        .then(() => { showToast_("Note saved", "success"); return loadActionsOnly_(); })
        .then(() => { render(); openActionPanel_(actionId); })
        .catch(err => {
          showToast_("Failed: " + (err.message || err), "error");
          noteBtn.disabled = false;
        });
    });
  }

  // delete action
  const deleteBtn = drawer.querySelector(".action-panel-delete-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const confirmed = window.confirm(`Delete this action?\n"${action["Title"] || actionId}"\n\nThis cannot be undone.`);
      if (!confirmed) return;
      // Optimistically remove from state and close panel immediately
      state.actions = state.actions.filter(a => a["Action #"] !== actionId);
      closeActionPanel_();
      render();
      // Fire delete API in background
      try {
        const res = await fetch(API.baseUrl, {
          method: "POST",
          body: JSON.stringify({ action: "deleteAction", key: API.key, id: actionId }),
        });
        const result = await res.json();
        if (!result.ok) showToast_("Delete failed: " + (result.error || ""), "error");
      } catch (err) {
        showToast_("Delete failed: " + (err.message || err), "error");
      }
    });
  }

  requestAnimationFrame(() => overlay.classList.add("open"));
}

function buildActionPanelHtml_(action) {
  const id       = escapeHtml(action["Action #"]     || "");
  const title    = escapeHtml(action["Title"]        || "(untitled)");
  const category = escapeHtml(action["Category"]     || "");
  const priority = escapeHtml(action["Priority"]     || "");
  const status   = action["Status"]                  || "Open";
  const due      = escapeHtml(String(action["Due Date"] || "").slice(0, 10));
  const linkedJob   = escapeHtml(action["Linked Job #"]    || "");
  const gmailThread = String(action["Gmail Thread ID"]  || "").trim();
  const notes       = escapeHtml(action["Notes"]          || "");
  const created     = escapeHtml(String(action["Created Date"] || "").slice(0, 10));

  const statusOptions = ACTION_STATUSES_UI.map(s =>
    `<option value="${s}"${s === status ? " selected" : ""}>${s}</option>`
  ).join("");

  return `
    <div class="panel-header">
      <div class="panel-header-left">
        <div class="panel-job-no">${id}</div>
        <div class="panel-customer">${title}</div>
      </div>
      <button class="panel-close" aria-label="Close">✕</button>
    </div>
    <div class="panel-body">
      <div class="panel-meta-grid">
        <div class="panel-meta-item">
          <div class="panel-meta-label">Category</div>
          <div class="panel-meta-value">${category || "—"}</div>
        </div>
        <div class="panel-meta-item">
          <div class="panel-meta-label">Priority</div>
          <div class="panel-meta-value">${priority || "—"}</div>
        </div>
        <div class="panel-meta-item">
          <div class="panel-meta-label">Due Date</div>
          <div class="panel-meta-value">${due || "—"}</div>
        </div>
        <div class="panel-meta-item">
          <div class="panel-meta-label">Created</div>
          <div class="panel-meta-value">${created || "—"}</div>
        </div>
        ${linkedJob ? `<div class="panel-meta-item panel-meta-full">
          <div class="panel-meta-label">Linked Job</div>
          <div class="panel-meta-value">${linkedJob}</div>
        </div>` : ""}
        ${gmailThread ? `<div class="panel-meta-item panel-meta-full">
          <a href="https://mail.google.com/mail/?authuser=isglengarry@gmail.com#all/${gmailThread}" target="_blank" rel="noopener noreferrer" class="panel-btn-gmail" style="display:inline-block;margin-top:4px">View Source Email</a>
        </div>` : ""}
      </div>

      <div class="panel-section">
        <div class="panel-section-title">Status</div>
        <select class="action-panel-status" style="padding:6px 10px;border:1px solid var(--line);border-radius:var(--radius-control);font-size:var(--fs-body);background:var(--surface);color:var(--text);width:100%;margin-top:4px">
          ${statusOptions}
        </select>
      </div>

      ${notes ? `<div class="panel-section">
        <div class="panel-section-title">Notes</div>
        <div class="panel-specs">${notes.replace(/\n/g, "<br>")}</div>
      </div>` : ""}

      <div class="panel-section">
        <div class="panel-section-title">Add Note</div>
        <textarea class="action-panel-note-input" rows="3" placeholder="Type a note…" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius-control);font-size:var(--fs-body);resize:vertical;margin-top:4px;font-family:inherit"></textarea>
        <button class="action-panel-note-btn btn-primary" style="margin-top:8px;width:100%">Save Note</button>
      </div>
      <div class="panel-section" style="padding-top:8px;border-top:1px solid var(--line);margin-top:8px">
        <button class="action-panel-delete-btn danger" style="width:100%">Delete Action</button>
      </div>
    </div>
  `;
}

function closeActionPanel_() {
  const overlay = document.getElementById("action-panel-overlay");
  if (overlay) overlay.classList.remove("open");
}


async function loadActionsOnly_() {
  try {
    const url = `${API.baseUrl}?action=actions&key=${encodeURIComponent(API.key)}`;
    const res = await fetch(url, { method: "GET" });
    const payload = await res.json();
    if (payload.ok && Array.isArray(payload.data)) state.actions = payload.data;
  } catch (_e) {}
}

async function apiUpdateAction_(payload) {
  const res  = await fetch(API.baseUrl, {
    method: "POST",
    body: JSON.stringify({ action: "updateAction", key: API.key, ...payload }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Update failed");
  return data;
}

function renderReportVisualDashboard_(jobs, meta = {}) {
  const totalJobs = jobs.length;
  const totalValue = Number(meta.totalValue || 0);
  const avgValue = Number(meta.avgValue || 0);
  const unpaidCount = Number(meta.unpaidCount || 0);
  const promiseRiskCount = Number(meta.promiseRiskCount || 0);

  const needsActionCount = jobs.filter(j => !!j.blocked).length;
  const readyCount = jobs.filter(j =>
    ["Ready", "Ready to Order", "Order Placed", "Batched (Ink Order)", "Batched (DTF Order)", "Batched (Vinyl Print Run)", "DTF Order Placed", "In Production", "Ready for Collection"].includes(String(j.status || ""))
  ).length;
  const completedCount = jobs.filter(j => isJobCompleted_(j)).length;

  const categoryCounts = new Map();
  jobs.forEach(j => {
    const key = String(j.category || "Other");
    categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
  });
  const categoryRows = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topCategory = categoryRows[0] ? categoryRows[0][0] : "-";

  const staffCounts = new Map();
  jobs.forEach(j => {
    const key = String(j.staff || "Unassigned").trim() || "Unassigned";
    staffCounts.set(key, (staffCounts.get(key) || 0) + 1);
  });
  const staffRows = [...staffCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxStaff = staffRows.reduce((m, row) => Math.max(m, row[1]), 0) || 1;

  const riskRate = totalJobs ? Math.round((promiseRiskCount / totalJobs) * 100) : 0;
  const unpaidRate = totalJobs ? Math.round((unpaidCount / totalJobs) * 100) : 0;

  const section = document.createElement("section");
  section.className = "detail-section report-visual";
  const catBarColors_ = { "In-house": "#5a7a18", "Outsourced": "#1b3d52", "Ink/Stock": "#4b5563", "Returns": "#c05505", "Design": "#5a4a8c" };
  const staffBarColors_ = ["#3b6dbf", "#4e8fc7", "#6aa3cc", "#8ab8d4", "#a8ccdd"];
  section.innerHTML = `
    <h4 class="detail-section-title">Dashboard Snapshot</h4>
    <div class="report-visual-grid">
      <article class="report-tile">
        <div class="report-tile-label">Total Jobs</div>
        <div class="report-tile-value">${totalJobs}</div>
        <div class="report-tile-sub">Top category: ${escapeHtml(topCategory)}</div>
      </article>
      <article class="report-tile rp-revenue">
        <div class="report-tile-label">Revenue (Filtered)</div>
        <div class="report-tile-value">${escapeHtml(formatCurrencyR_(totalValue))}</div>
        <div class="report-tile-sub">Avg per job: ${escapeHtml(formatCurrencyR_(avgValue))}</div>
      </article>
      <article class="report-tile">
        <div class="report-tile-label">Workflow Mix</div>
        <div class="report-tile-value small">
          <span>Needs action: ${needsActionCount}</span>
          <span>Ready / active: ${readyCount}</span>
          <span>Completed: ${completedCount}</span>
        </div>
      </article>
      <article class="report-tile${(promiseRiskCount + unpaidCount) > 0 ? " rp-risk" : ""}">
        <div class="report-tile-label">Risk / Unpaid</div>
        <div class="report-tile-value small">
          <span>Promise risk: ${promiseRiskCount} (${riskRate}%)</span>
          <span>Unpaid: ${unpaidCount} (${unpaidRate}%)</span>
        </div>
      </article>
    </div>
    <div class="report-visual-grid second">
      <article class="report-chart-card">
        <div class="report-chart-title">Jobs by Category</div>
        <div class="report-bars">
          ${categoryRows.length ? categoryRows.map(([name, count]) => {
            const pct = totalJobs ? Math.round((count / totalJobs) * 100) : 0;
            const color = catBarColors_[name] || "#5a7fbf";
            return `
              <div class="report-bar-row">
                <div class="report-bar-label">${escapeHtml(name)}</div>
                <div class="report-bar-track"><span style="width:${pct}%;background:${color}"></span></div>
                <div class="report-bar-value">${count}</div>
              </div>
            `;
          }).join("") : "<div class=\"job-customer\">No data</div>"}
        </div>
      </article>
      <article class="report-chart-card">
        <div class="report-chart-title">Top Staff (Job Volume)</div>
        <div class="report-bars">
          ${staffRows.length ? staffRows.map(([name, count], i) => {
            const pct = Math.round((count / maxStaff) * 100);
            const color = staffBarColors_[i % staffBarColors_.length];
            return `
              <div class="report-bar-row">
                <div class="report-bar-label">${escapeHtml(name)}</div>
                <div class="report-bar-track"><span style="width:${pct}%;background:${color}"></span></div>
                <div class="report-bar-value">${count}</div>
              </div>
            `;
          }).join("") : "<div class=\"job-customer\">No staff data</div>"}
        </div>
      </article>
    </div>
  `;
  return section;
}

function getReportDateKey_(job) {
  const raw = String(job.jobReadyAt || job.due || "").trim();
  if (!raw) return "";
  const d = parseDateSafeLocal_(raw);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return formatYmdLocal_(d);
}

function renderReportStaffTable_(jobs) {
  const box = document.createElement("section");
  box.className = "detail-section";
  box.innerHTML = "<h4 class=\"detail-section-title\">Jobs by Staff</h4>";

  const byStaff = new Map();
  jobs.forEach(job => {
    const key = String(job.staff || "Unassigned").trim() || "Unassigned";
    const prev = byStaff.get(key) || { jobs: 0, value: 0, unpaid: 0, risk: 0 };
    prev.jobs += 1;
    prev.value += Number(job.jobValue) || 0;
    const payment = String(job.payment || "").trim().toLowerCase();
    if (payment && payment !== "paid") prev.unpaid += 1;
    if (job.promiseRisk) prev.risk += 1;
    byStaff.set(key, prev);
  });

  const rows = [...byStaff.entries()].sort((a, b) => b[1].jobs - a[1].jobs);
  if (!rows.length) {
    const none = document.createElement("div");
    none.className = "job-customer";
    none.textContent = "No matching jobs.";
    box.appendChild(none);
    return box;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead><tr><th>Staff</th><th>Jobs</th><th>Total Value</th><th>Unpaid</th><th>Promise Risk</th></tr></thead>
    <tbody>
      ${rows.map(([name, m]) => `
        <tr>
          <td>${escapeHtml(name)}</td>
          <td>${m.jobs}</td>
          <td>${escapeHtml(formatCurrencyR_(m.value))}</td>
          <td>${m.unpaid}</td>
          <td>${m.risk}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
  box.appendChild(table);
  return box;
}

function renderReportProductTable_(jobs) {
  const box = document.createElement("section");
  box.className = "detail-section";
  box.innerHTML = "<h4 class=\"detail-section-title\">Jobs by Product</h4>";

  const byProduct = new Map();
  jobs.forEach(job => {
    const key = String(job.product || "Unspecified").trim() || "Unspecified";
    const prev = byProduct.get(key) || { jobs: 0, value: 0 };
    prev.jobs += 1;
    prev.value += Number(job.jobValue) || 0;
    byProduct.set(key, prev);
  });

  const rows = [...byProduct.entries()].sort((a, b) => b[1].jobs - a[1].jobs).slice(0, 25);
  if (!rows.length) {
    const none = document.createElement("div");
    none.className = "job-customer";
    none.textContent = "No matching products.";
    box.appendChild(none);
    return box;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead><tr><th>Product</th><th>Jobs</th><th>Total Value</th></tr></thead>
    <tbody>
      ${rows.map(([name, m]) => `
        <tr>
          <td>${escapeHtml(name)}</td>
          <td>${m.jobs}</td>
          <td>${escapeHtml(formatCurrencyR_(m.value))}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
  box.appendChild(table);
  return box;
}

function renderReportContacts_(jobs) {
  const box = document.createElement("section");
  box.className = "detail-section";
  box.innerHTML = "<h4 class=\"detail-section-title\">Targeted Contact List (current filters)</h4>";

  const contacts = new Map();
  jobs.forEach(job => {
    const phone = String(job.customerPhone || "").trim();
    const email = String(job.customerEmail || "").trim().toLowerCase();
    const customer = String(job.customer || "").trim();
    const key = `${customer}|${phone}|${email}`;
    const prev = contacts.get(key) || {
      customer,
      phone,
      email,
      products: new Set(),
      jobs: 0,
      value: 0,
      lastDate: "",
    };
    prev.products.add(String(job.product || "").trim());
    prev.jobs += 1;
    prev.value += Number(job.jobValue) || 0;
    const d = getReportDateKey_(job);
    if (d && (!prev.lastDate || d > prev.lastDate)) prev.lastDate = d;
    contacts.set(key, prev);
  });

  const shortMonths_ = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const fmtContactDate_ = (ymd) => {
    if (!ymd) return "-";
    const p = ymd.split("-");
    return p.length === 3 ? `${parseInt(p[2])} ${shortMonths_[parseInt(p[1]) - 1]} ${p[0]}` : ymd;
  };
  const rows = [...contacts.values()]
    .filter(c => c.customer || c.phone || c.email)
    .sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""))
    .map(c => ({
      ...c,
      productsText: [...c.products].filter(Boolean).slice(0, 4).join(" | "),
      lastDateDisplay: fmtContactDate_(c.lastDate),
    }));

  const actions = document.createElement("div");
  actions.className = "actions";
  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.textContent = "Export Contacts CSV";
  exportBtn.onclick = () => {
    if (!rows.length) {
      window.alert("No contacts to export for current filters.");
      return;
    }
    const csvRows = [
      ["Customer", "Phone", "Email", "Last Job Date", "Jobs", "Total Value", "Products"],
      ...rows.map(r => [r.customer, r.phone, r.email, r.lastDate, String(r.jobs), Number(r.value).toFixed(2), r.productsText]),
    ];
    downloadCsv_("owner-targeted-contacts.csv", csvRows);
  };
  actions.appendChild(exportBtn);
  box.appendChild(actions);

  if (!rows.length) {
    const none = document.createElement("div");
    none.className = "job-customer";
    none.textContent = "No contacts in current filter.";
    box.appendChild(none);
    return box;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th>Last Job</th><th>Jobs</th><th>Total Value</th><th>Products</th></tr></thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td>${escapeHtml(r.customer)}</td>
          <td>${escapeHtml(r.phone || "-")}</td>
          <td>${escapeHtml(r.email || "-")}</td>
          <td>${escapeHtml(r.lastDateDisplay || "-")}</td>
          <td>${r.jobs}</td>
          <td>${escapeHtml(formatCurrencyR_(r.value))}</td>
          <td>${escapeHtml(r.productsText || "-")}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
  box.appendChild(table);
  return box;
}

function downloadCsv_(filename, rows) {
  const lines = (rows || []).map(cols => (cols || []).map(csvEscapeCell_).join(","));
  const csv = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "export.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscapeCell_(value) {
  const s = String(value === null || value === undefined ? "" : value);
  return `"${s.replace(/"/g, "\"\"")}"`;
}

function renderCancelledQueue(ownerMode = false) {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.style.marginTop = "10px";
  panel.innerHTML = `<h3>${ownerMode ? "Cancelled (Refund Pending)" : "Cancelled Jobs (Pending Refund/Decision)"}</h3>`;

  const list = state.jobs
    .filter(j => !isSoftDeleted_(j))
    .filter(j => isCancellationOpen_(j))
    .sort((a, b) => String(a.due || "").localeCompare(String(b.due || "")));

  if (!list.length) {
    const none = document.createElement("div");
    none.className = "job-customer";
    none.textContent = "None";
    panel.appendChild(none);
    return panel;
  }

  list.forEach(job => {
    const cancelDate = getCancellationDate_(job.notes) || formatYmdLocal_(new Date());
    const node = card({ ...job, status: "Cancelled", due: cancelDate, dateLabel: "Cancellation Date" });
    const reason = getCancellationReason_(job.notes) || "Not logged";
    const ownerAction = getCancellationOwnerAction_(job.notes) || "Not logged";
    const info = document.createElement("div");
    info.className = "card-alert warn";
    info.textContent = `Reason: ${reason}`;
    node.querySelector(".job-card").appendChild(info);
    const infoOwner = document.createElement("div");
    infoOwner.className = "card-alert warn";
    infoOwner.textContent = `Owner Action: ${ownerAction}`;
    node.querySelector(".job-card").appendChild(infoOwner);
    if (ownerMode && job.promiseRisk) {
      const info2 = document.createElement("div");
      info2.className = "card-alert risk";
      info2.textContent = "Investigate delay vs promised date";
      node.querySelector(".job-card").appendChild(info2);
    }
    panel.appendChild(node);
  });
  return panel;
}

function renderDeletedJobs() {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `<h3>Deleted Jobs</h3><p style="color:var(--muted);font-size:13px;margin-bottom:16px">Jobs removed from all views but still in the Sheet. Restore to bring back or permanently delete to remove from the Sheet entirely.</p>`;

  const deleted = state.jobs.filter(j => isSoftDeleted_(j));

  if (!deleted.length) {
    const empty = document.createElement("p");
    empty.style.cssText = "color:var(--muted);font-style:italic";
    empty.textContent = "No deleted jobs.";
    panel.appendChild(empty);
    return panel;
  }

  const table = document.createElement("table");
  table.className = "deleted-jobs-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Job No</th>
        <th>Customer</th>
        <th>Product</th>
        <th>Category</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody></tbody>`;

  const tbody = table.querySelector("tbody");

  deleted.forEach(job => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(job.jobNo)}</strong></td>
      <td>${escapeHtml(job.customer || "—")}</td>
      <td>${escapeHtml(job.product || "—")}</td>
      <td>${escapeHtml(job.category || "—")}</td>
      <td class="row-actions">
        <button class="btn-restore secondary" data-jobno="${escapeHtml(job.jobNo)}">Restore</button>
        <button class="btn-perm-delete danger" data-jobno="${escapeHtml(job.jobNo)}">Delete Permanently</button>
      </td>`;
    tbody.appendChild(tr);
  });

  panel.appendChild(table);

  panel.querySelectorAll(".btn-restore").forEach(btn => {
    btn.onclick = async () => {
      const jobNo = btn.dataset.jobno;
      const job = state.jobs.find(j => j.jobNo === jobNo);
      if (!job) return;
      const cleanNotes = upsertTaggedValue_(job.notes || "", "SOFT_DELETE", "");
      btn.disabled = true;
      btn.textContent = "Restoring…";
      await saveJobChanges(jobNo, { systemStatus: "Cancelled", notes: cleanNotes }, { keepTab: true, quiet: true });
      state.tab = "deleted_jobs";
      render();
    };
  });

  panel.querySelectorAll(".btn-perm-delete").forEach(btn => {
    btn.onclick = async () => {
      const jobNo = btn.dataset.jobno;
      const confirmed = window.confirm(`Permanently delete ${jobNo}? This cannot be undone.`);
      if (!confirmed) return;
      btn.disabled = true;
      btn.textContent = "Deleting…";
      try {
        const res = await fetch(API.baseUrl, {
          method: "POST",
          body: JSON.stringify({ action: "permanentDeleteJob", key: API.key, fastWrite: true, jobNo }),
        });
        const payload = await res.json();
        if (!payload.ok) throw new Error(payload.error || "Delete failed");
        state.jobs = state.jobs.filter(j => j.jobNo !== jobNo);
        state.tab = "deleted_jobs";
        render();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Delete Permanently";
        showToast_("Error: " + err.message, "error");
      }
    };
  });

  return panel;
}

function renderCompletedJobs() {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = "<h3>Completed Jobs</h3>";

  const completed = state.jobs
    .filter(j => !isSoftDeleted_(j))
    .filter(j => isJobCompleted_(j))
    .sort((a, b) => String(b.due || "").localeCompare(String(a.due || "")));

  if (!completed.length) {
    const none = document.createElement("div");
    none.className = "job-customer";
    none.textContent = "No completed jobs yet.";
    panel.appendChild(none);
    return panel;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>Job #</th>
        <th>Customer</th>
        <th>Category</th>
        <th>Product</th>
        <th>Status</th>
        <th>Due</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const body = table.querySelector("tbody");
  completed.forEach(j => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(j.jobNo)}</td>
      <td>${escapeHtml(j.customer)}</td>
      <td>${escapeHtml(j.category)}</td>
      <td>${escapeHtml(j.product)}</td>
      <td>${escapeHtml(j.status)}</td>
      <td>${escapeHtml(j.due || "")}</td>
    `;
    tr.onclick = () => {
      state.selectedJobNo = j.jobNo;
      state.tab = "job_detail";
      render();
    };
    body.appendChild(tr);
  });
  panel.appendChild(table);
  return panel;
}

function renderJobDetail() {
  state.saveMessage = "";
  const isOwner = state.role === "owner";
  const jobNo = isOwner ? state.ownerSelectedJobNo : state.selectedJobNo;
  const job = state.jobs.find(j => j.jobNo === jobNo) || (!isOwner ? state.jobs[0] : null);
  if (!job) {
    const empty = document.createElement("section");
    empty.className = "panel";
    empty.innerHTML = isOwner
      ? "<h3>No job selected</h3><p style='color:var(--text-muted);margin-top:8px'>Click a job card on the Owner Dashboard to view its details here.</p>"
      : "<h3>No job selected</h3>";
    return empty;
  }
  const panel = document.createElement("section");
  panel.className = "panel job-detail";
  const categoryTheme = getCategoryTheme_(job.category);
  panel.style.setProperty("--cat-base", categoryTheme.base);
  const statusOptionsList = getStatusOptionsForJob_(job);
  const statusOptions = statusOptionsList
    .map(s => `<option value="${escapeHtml(s)}"${s === job.status ? " selected" : ""}>${escapeHtml(s)}</option>`)
    .join("");
  const commOptions = ["Not Contacted", "Contacted - Awaiting Reply", "New Date Agreed"]
    .map(s => `<option value="${escapeHtml(s)}"${s === (job.communicationStatus || "") ? " selected" : ""}>${escapeHtml(s)}</option>`)
    .join("");
  const riskNotifiedOptions = ["No", "Yes - Delay", "Yes - New Date", "Yes - General"]
    .map(s => `<option value="${escapeHtml(s)}"${s === (job.customerNotified || "No") ? " selected" : ""}>${escapeHtml(s)}</option>`)
    .join("");
  const readyNotifiedOptions = ["No", "Yes - Ready for Collection"]
    .map(s => `<option value="${escapeHtml(s)}"${s === (job.customerNotified || "No") ? " selected" : ""}>${escapeHtml(s)}</option>`)
    .join("");
  const paymentOptions = ["Paid", "On Account", "Unpaid", "Partially Paid", "Pending", "Pay on Collection"]
    .map(s => `<option value="${escapeHtml(s)}"${s === (job.payment || "") ? " selected" : ""}>${escapeHtml(s)}</option>`)
    .join("");
  const promisedDate = (job.promisedDue || "").slice(0, 10);
  const showPromiseComms = !!job.promiseRisk;
  const showReadyCollectionNotify = job.status === "Ready for Collection";
  const showBatch = false;
  const showHardProofControl = job.category === "In-house" && Number(job.jobValue || 0) >= 2000;
  const isReturnCategory = job.category === "Returns";
  const showCancellationPanel = String(job.status || "") === "Cancelled";
  const showOwnerCancellationFields = state.role === "owner" || state.role === "admin";
  const showWesleyNotifyControl = showCancellationPanel;
  const wesleyNotified = getCancellationWesleyNotified_(job.notes);
  const cancellationReasonOptions = [
    "Not Logged",
    "Promise Risk - Date Mismatch",
    "Price",
    "No Longer Needed",
    "Quality Concern",
    "Other",
  ].map(s => `<option value="${escapeHtml(s)}"${s === getCancellationReason_(job.notes) ? " selected" : ""}>${escapeHtml(s)}</option>`).join("");
  const cancellationOptions = ["Not Logged", "Refund Pending", "Refund Approved", "Refund Completed", "Credit Note Issued", "No Refund", "Owner Review Needed"]
    .map(s => `<option value="${escapeHtml(s)}"${s === getCancellationOutcome_(job.notes) ? " selected" : ""}>${escapeHtml(s)}</option>`)
    .join("");
  const alertPills = [];
  const primaryStatus = ((job.status === "Waiting Artwork" || job.status === "Waiting Payment & Artwork") && String(job.artworkSource || "").trim() === "ISG to design")
    ? { text: "Awaiting Design", className: "design" }
    : getDetailStatusPillMeta_(job.status);
  const paymentNow = String(job.payment || "").trim();
  const hasPaymentWarningPill = ["Unpaid", "Pending", "Partially Paid"].includes(paymentNow);
  const isPayOnCollection = paymentNow === "Pay on Collection";
  const statusIsPaymentBlocked = (job.status === "Waiting Payment" || job.status === "Waiting Payment & Artwork");
  if (primaryStatus) {
    alertPills.push(`<span class="detail-pill ${primaryStatus.className}">STATUS: ${escapeHtml(primaryStatus.text)}</span>`);
  }
  if (hasPaymentWarningPill && !statusIsPaymentBlocked) {
    alertPills.push(`<span class="detail-pill warn">PAYMENT: ${escapeHtml(paymentNow)} — do not hand over before payment</span>`);
  }
  if (isPayOnCollection) {
    alertPills.push(`<span class="detail-pill poc">PAY ON COLLECTION — payment due at handover</span>`);
  }
  if (job.promiseRisk) {
    const risk = getPromiseRiskAlertMeta_(job.communicationStatus, job.customerNotified);
    alertPills.push(`<span class="detail-pill ${risk.className}">${escapeHtml(risk.text)}</span>`);
  }
  if (showCancellationPanel) {
    alertPills.push(`<span class="detail-pill cancel">CANCELLED: Wesley ${wesleyNotified ? "notified" : "not notified"}</span>`);
  }
  if (job.urgent) alertPills.push(`<span class="detail-pill urgent">URGENT REQUEST</span>`);
  // Avoid duplicate payment messaging: if payment pill is already shown for "Waiting Payment", don't repeat status pill.
  if (!hasPaymentWarningPill && job.status === "Waiting Payment") {
    alertPills.push(`<span class="detail-pill warn">AWAITING PAYMENT</span>`);
  }
  const missingSpecs = getIncompleteSpecFields_(job);
  if (missingSpecs.length) {
    alertPills.push(`<span class="detail-pill incomplete-specs">SPECS INCOMPLETE</span>`);
  }
  panel.innerHTML = `
    <h3>${job.jobNo}</h3>
    ${alertPills.length ? `<div class="detail-alerts">${alertPills.join("")}</div>` : ""}
    <div id="jd-next-steps" class="next-steps-row"></div>
    ${showWesleyNotifyControl ? `<div class="kv detail-inline-check"><label>Cancellation Escalated to Wesley</label><input id="jd-cancel-wesley-notified" type="checkbox" ${wesleyNotified ? "checked" : ""} /></div>` : ""}
    <div class="detail-section">
      <h4 class="detail-section-title">Core Workflow</h4>
      <div class="grid-2">
        <div>
          <div class="kv"><label>Status</label><select id="jd-status">${statusOptions}</select></div>
          ${!isReturnCategory ? `<div class="kv"><label>Payment</label><select id="jd-payment">${paymentOptions}</select></div>
          <div class="kv" id="jd-payment-method-row" style="${job.payment === 'Paid' ? '' : 'display:none'}"><label>Payment Method</label><select id="jd-payment-method"><option value="">— select —</option><option value="Card"${(job.paymentMethod||'')==='Card'?' selected':''}>Card</option><option value="EFT"${(job.paymentMethod||'')==='EFT'?' selected':''}>EFT</option><option value="Cash"${(job.paymentMethod||'')==='Cash'?' selected':''}>Cash</option><option value="On Account"${(job.paymentMethod||'')==='On Account'?' selected':''}>On Account</option></select></div>` : ""}
          <div class="kv"><label>Promised Due</label><input id="jd-promised" type="date" value="${promisedDate}" /></div>
          <div class="kv"><label>Calculated Due</label><div class="kv-value">${job.calcDue || "-"}</div></div>
        </div>
        <div>
          <div class="kv"><label>Promise Risk</label><div class="kv-value">${job.promiseRisk ? "Yes" : "No"}</div></div>
          ${showBatch ? `<div class="kv"><label>Batch</label><div class="kv-value">${job.batch}</div></div>` : ""}
          <div class="kv"><label>Category</label><select id="jd-category">${["In-house","Outsourced","Sublimation","Design","Ink/Stock","Returns"].map(c => `<option value="${escapeHtml(c)}"${c === job.category ? " selected" : ""}>${escapeHtml(c)}</option>`).join("")}</select></div>
          <div class="kv"><label>Product</label>
            <div class="ji-product-search-wrap" id="jd-product-wrap">
              <input type="text" class="ji-product-search-input" id="jd-product-search" value="${escapeHtml(job.product)}" autocomplete="off" placeholder="Search or select product…">
              <div class="ji-product-search-results" style="display:none"></div>
              <input type="hidden" id="jd-product-value" value="${escapeHtml(job.product)}">
            </div>
          </div>
          <div class="kv"><label>Staff</label><select id="jd-staff">
            <option value=""></option>
            ${["Chad","Toufiecka","Faith","Wesley","Ingrid","Natasché"].map(n => `<option${n === job.staff ? " selected" : ""}>${escapeHtml(n)}</option>`).join("")}
          </select></div>
          ${!isReturnCategory ? `<div class="kv"><label>Job Value (R)</label><input id="jd-job-value" type="number" step="0.01" min="0" value="${job.jobValue || ""}" placeholder="0.00" /></div>` : ""}
        </div>
      </div>
    </div>
    <div class="detail-section">
      <h4 class="detail-section-title">Customer & Artwork</h4>
      <div class="grid-2">
        <div>
          <div class="kv"><label>Customer</label><div class="kv-value">${job.customer}</div></div>
          <div class="kv"><label>Customer Phone</label><input id="jd-customer-phone" value="${escapeHtml(job.customerPhone || "")}" placeholder="e.g. 0821234567" /></div>
          <div class="kv"><label>Customer Email</label><input id="jd-customer-email" value="${escapeHtml(job.customerEmail || "")}" placeholder="email@example.com" /></div>
          <div class="kv"><label>Order #</label>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <input id="jd-order-group" value="${escapeHtml(job.orderGroup || "")}" placeholder="Leave blank or type existing order #" style="flex:1;min-width:120px;" />
              <button id="jd-add-order-job" type="button" style="white-space:nowrap;">+ Add Job to This Order</button>
            </div>
          </div>
          <div class="kv"><label>Sales Reference</label><input id="jd-sales-ref" value="${escapeHtml(job.salesReference || "")}" placeholder="Hike quote/sale reference" /></div>
          <div class="kv"><label>Customer Approved</label><input id="jd-approved" type="checkbox" ${job.customerApproved ? "checked" : ""} /></div>
          ${showHardProofControl ? `<div class="kv"><label>Hard Proof Approved</label><input id="jd-hard-proof-approved" type="checkbox" ${job.hardProofApproved ? "checked" : ""} /></div>` : ""}
          <div class="kv"><label>Artwork Source</label><select id="jd-artwork-source">
            ${["","Customer supplied now","Customer will send later","WhatsApp","Email","ISG to design","Other"].map(s => `<option value="${escapeHtml(s)}"${s === (job.artworkSource || "") ? " selected" : ""}>${escapeHtml(s || "— select —")}</option>`).join("")}
          </select></div>
        </div>
        <div class="kv">
          <label>Artwork</label>
          <div class="detail-artwork-block">
            <input id="jd-artwork-link-value" type="hidden" value="${escapeHtml(job.artworkLink || "")}" />
            <div id="jd-artwork-current">${renderArtworkCurrentHtml_(job.artworkLink || "")}</div>
            <input id="jd-artwork-file" type="file" />
            <div class="actions">
              <button id="jd-artwork-replace" type="button">Upload Replacement</button>
              <button id="jd-artwork-remove" type="button">Remove Artwork</button>
              <span id="jd-artwork-msg" class="save-msg"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
    ${(showPromiseComms || showReadyCollectionNotify) ? `
    <div class="detail-section">
      <h4 class="detail-section-title">Customer Communication</h4>
      ${showPromiseComms ? `
      <div class="grid-2">
        <div class="kv"><label>Communication (Promise Risk)</label><select id="jd-comm">${commOptions}</select></div>
        <div class="kv"><label>Customer Notified</label><select id="jd-notified-risk">${riskNotifiedOptions}</select></div>
      </div>
      <div class="kv"><label></label><div class="detail-nudge">Please update customer immediately and log the new expected date.</div></div>
      ` : ""}
      ${showReadyCollectionNotify ? `
      <div class="grid-2">
        <div class="kv"><label>Collection Notification</label><select id="jd-notified-ready">${readyNotifiedOptions}</select></div>
        <div class="kv"><label></label><div></div></div>
      </div>` : ""}
    </div>
    ` : ""}
    ${showCancellationPanel ? `
    <div class="detail-section">
      <h4 class="detail-section-title">Cancellation</h4>
      <div class="grid-2">
        <div class="kv"><label>Cancellation Reason</label><select id="jd-cancel-reason">${cancellationReasonOptions}</select></div>
        <div class="kv"><label>Cancellation Outcome</label><select id="jd-cancel-outcome">${cancellationOptions}</select></div>
      </div>
      ${showOwnerCancellationFields ? `<div class="kv"><label>Owner Action / Refund Ref</label><input id="jd-cancel-owner-action" value="${escapeHtml(getCancellationOwnerAction_(job.notes) || "")}" placeholder="e.g. EFT refund ref 12345 / Credit note CN-88" /></div>` : ""}
      ${showOwnerCancellationFields ? `<div class="kv"><label></label><div class="detail-nudge">Owner action required: confirm refund/credit path and update outcome. If due-date mismatch, Wesley should investigate timeline breakdown.</div></div>` : ""}
    </div>
    ` : ""}
    ${(job.orderGroup ? (() => {
      const siblings = state.jobs.filter(j => j.orderGroup === job.orderGroup && j.jobNo !== job.jobNo && !isSoftDeleted_(j));
      if (!siblings.length) return "";
      const rows = siblings.map(s => {
        const done = ["Collected","Closed"].includes(s.status);
        return `<div class="order-sibling${done ? " done" : ""}"><span class="order-sibling-no">${escapeHtml(s.jobNo)}</span><span class="order-sibling-product">${escapeHtml(s.product || s.category || "")}</span><span class="order-sibling-status">${escapeHtml(s.status)}</span></div>`;
      }).join("");
      return `<div class="detail-section"><h4 class="detail-section-title">Other Jobs in This Order</h4>${rows}</div>`;
    })() : "")}
    <div class="detail-section">
      <h4 class="detail-section-title">Activity Log</h4>
      ${buildCommLogHtml_(job)}
    </div>
    <div class="detail-section">
      <h4 class="detail-section-title">Notes & Specs</h4>
      <div class="kv"><label>Notes</label><textarea id="jd-notes" rows="3">${escapeHtml(stripInternalNoteLines_(job.notes))}</textarea></div>
      <div class="kv"><label>Specs</label><div id="jd-specs-container">${renderSpecEditFields_(job)}</div></div>
    </div>
    <div class="actions">
      <span id="jd-quick"></span>
      <button id="jd-save" ${state.saving ? "disabled" : ""}>${state.saving ? "Saving..." : "Save Changes"}</button>
      <span class="save-msg">${state.saveMessage || ""}</span>
      <span class="action-spacer"></span>
      <button id="jd-delete" class="danger">Delete Job</button>
    </div>
  `;
  renderJobDetailQuickActions_(panel, job);

  if (missingSpecs.length) {
    const specsBanner = document.createElement("div");
    specsBanner.className = "specs-incomplete-banner";
    specsBanner.innerHTML = `<strong>Specs incomplete</strong> — Please fill in the missing fields below before this job goes to production.`;
    const specsSection = panel.querySelector("#jd-specs-container");
    if (specsSection) specsSection.closest(".detail-section").insertAdjacentElement("beforebegin", specsBanner);
  }

  setupProductDetailSearch_(panel, job);

  // Spec fields: handle showWhen conditional visibility.
  const jdSpecsContainer = panel.querySelector("#jd-specs-container");
  if (jdSpecsContainer) { wireSpecVisibility_(jdSpecsContainer); wireSublimationSubProduct_(jdSpecsContainer, job); }

  // Re-render spec fields when category changes so the correct schema is used on save.
  const jdCategoryEl = panel.querySelector("#jd-category");
  if (jdCategoryEl && jdSpecsContainer) {
    jdCategoryEl.addEventListener("change", () => {
      const newCat = jdCategoryEl.value;
      const productValueEl = panel.querySelector("#jd-product-value");
      const currentProduct = productValueEl ? productValueEl.value.trim() : job.product;
      const fakeJob = Object.assign({}, job, { category: newCat, product: currentProduct, specs: "" });
      jdSpecsContainer.innerHTML = renderSpecEditFields_(fakeJob);
      wireSpecVisibility_(jdSpecsContainer);
      wireSublimationSubProduct_(jdSpecsContainer, job);
    });
  }

  // Comms log: manual entry in full detail view.
  const jdCommsLogBtn = panel.querySelector(".comms-log-btn");
  if (jdCommsLogBtn) {
    jdCommsLogBtn.addEventListener("click", () => {
      if (!state.staffName) { window.alert("Enter your name in the header first."); return; }
      const typeSel = panel.querySelector(".comms-type-sel");
      const noteInput = panel.querySelector(".comms-note-input");
      const type = typeSel ? typeSel.value : "Other";
      const note = noteInput ? noteInput.value.trim() : "";
      const freshJob = state.jobs.find(j => j.jobNo === job.jobNo) || job;
      addCommLogEntry_(freshJob, type, note);
      render();
    });
  }

  const jdPaymentEl = panel.querySelector("#jd-payment");
  const jdPaymentMethodRow = panel.querySelector("#jd-payment-method-row");
  if (jdPaymentEl && jdPaymentMethodRow) {
    jdPaymentEl.addEventListener("change", () => {
      jdPaymentMethodRow.style.display = jdPaymentEl.value === "Paid" ? "" : "none";
    });
  }
  const addOrderJobBtn = panel.querySelector("#jd-add-order-job");
  if (addOrderJobBtn) {
    addOrderJobBtn.onclick = () => {
      const anchor = job.orderGroup || job.jobNo;
      state.tab = "job_intake";
      state.intakeDraft = {
        customer: job.customer,
        customerPhone: job.customerPhone || "",
        customerEmail: job.customerEmail || "",
        orderGroup: anchor,
      };
      render();
    };
  }
  const artworkValueEl = panel.querySelector("#jd-artwork-link-value");
  const artworkCurrentEl = panel.querySelector("#jd-artwork-current");
  const artworkFileEl = panel.querySelector("#jd-artwork-file");
  const artworkMsgEl = panel.querySelector("#jd-artwork-msg");
  panel.querySelector("#jd-artwork-remove").onclick = () => {
    artworkValueEl.value = "";
    artworkCurrentEl.innerHTML = renderArtworkCurrentHtml_("");
    artworkMsgEl.textContent = "Artwork removed. Click Save Changes.";
  };
  panel.querySelector("#jd-artwork-replace").onclick = async () => {
    const file = artworkFileEl && artworkFileEl.files && artworkFileEl.files[0] ? artworkFileEl.files[0] : null;
    if (!file) {
      artworkMsgEl.textContent = "Choose a file first.";
      return;
    }
    try {
      artworkMsgEl.textContent = "Uploading...";
      const url = await uploadArtworkFile_(file, job.customer || "");
      artworkValueEl.value = url || "";
      if (!artworkValueEl.value) {
        artworkMsgEl.textContent = "Upload failed: no link returned.";
        return;
      }
      const ok = await saveJobChanges(
        job.jobNo,
        {
          artworkLink: artworkValueEl.value,
          "Artwork Upload Link": artworkValueEl.value,
          "Artwork Link": artworkValueEl.value,
          artworkSource: "Customer supplied now",
          "Artwork Source": "Customer supplied now",
        },
        { keepTab: true, quiet: true }
      );
      if (ok) {
        const idx = state.jobs.findIndex(j => j.jobNo === job.jobNo);
        if (idx >= 0) state.jobs[idx] = { ...state.jobs[idx], artworkLink: artworkValueEl.value, artworkSource: "Customer supplied now" };
        artworkCurrentEl.innerHTML = renderArtworkCurrentHtml_(artworkValueEl.value);
        artworkMsgEl.textContent = "Artwork uploaded and saved.";
      } else {
        artworkMsgEl.textContent = "Upload done, but save failed. Click Save Changes.";
      }
    } catch (err) {
      artworkMsgEl.textContent = `Upload failed: ${String(err && err.message ? err.message : err)}`;
    }
  };
  panel.querySelector("#jd-delete").onclick = async () => {
    const confirmed = window.confirm(`Delete ${job.jobNo} (${job.customer})? This cannot be undone.`);
    if (!confirmed) return;
    await deleteJob_(job.jobNo);
  };
  panel.querySelector("#jd-save").onclick = async () => {
    const paymentSelectEl = panel.querySelector("#jd-payment");
    const salesRefEl = panel.querySelector("#jd-sales-ref");
    const salesRef = String(salesRefEl ? salesRefEl.value : "").trim();
    const jobValueEl = panel.querySelector("#jd-job-value");
    const staffDetailEl = panel.querySelector("#jd-staff");
    const artworkSourceDetailEl = panel.querySelector("#jd-artwork-source");
    const phoneDetailEl = panel.querySelector("#jd-customer-phone");
    const emailDetailEl = panel.querySelector("#jd-customer-email");
    const updates = {
      systemStatus: panel.querySelector("#jd-status").value,
      promisedDueDate: panel.querySelector("#jd-promised").value || "",
      customerApproved: panel.querySelector("#jd-approved").checked,
      notes: panel.querySelector("#jd-notes").value || "",
      artworkLink: artworkValueEl ? artworkValueEl.value : "",
      "Artwork Upload Link": artworkValueEl ? artworkValueEl.value : "",
      "Artwork Link": artworkValueEl ? artworkValueEl.value : "",
      ...(jobValueEl ? { "Job Value (R)": parseFloat(jobValueEl.value) || 0, value: parseFloat(jobValueEl.value) || 0 } : {}),
      ...(phoneDetailEl ? { customerPhone: phoneDetailEl.value.trim(), "Customer Phone": phoneDetailEl.value.trim() } : {}),
      ...(emailDetailEl ? { customerEmail: emailDetailEl.value.trim(), "Customer Email": emailDetailEl.value.trim() } : {}),
    };
    const orderGroupEl = panel.querySelector("#jd-order-group");
    if (orderGroupEl) { updates.orderGroup = orderGroupEl.value.trim(); updates["Order #"] = orderGroupEl.value.trim(); }
    const hardProofApprovalEl = panel.querySelector("#jd-hard-proof-approved");
    if (hardProofApprovalEl) {
      updates.notes = upsertHardProofApproved_(updates.notes, !!hardProofApprovalEl.checked);
    }
    if (paymentSelectEl) {
      updates.paymentStatus = paymentSelectEl.value;
    }
    if (staffDetailEl) {
      updates.staff = staffDetailEl.value;
      updates["Staff Responsible"] = staffDetailEl.value;
    }
    if (artworkSourceDetailEl && artworkSourceDetailEl.value !== (job.artworkSource || "")) {
      updates.artworkSource = artworkSourceDetailEl.value;
      updates["Artwork Source"] = artworkSourceDetailEl.value;
    }
    const categoryEl = panel.querySelector("#jd-category");
    const categoryChanged = categoryEl && categoryEl.value !== job.category;
    if (categoryChanged) {
      updates.category = categoryEl.value;
    }
    const effectiveCategory = categoryEl ? categoryEl.value : job.category;
    const productValueEl = panel.querySelector("#jd-product-value");
    const newProduct = productValueEl ? productValueEl.value.trim() : "";
    if (newProduct && (newProduct !== job.product || categoryChanged)) {
      updates.product = newProduct;
      updates.inhouseType = newProduct;
      if (effectiveCategory === "Outsourced") {
        updates["Outsourced Product Type"] = newProduct;
        updates["In-house Product Type"] = "";
      } else {
        updates["In-house Product Type"] = newProduct;
        updates["Outsourced Product Type"] = "";
      }
    }
    if (effectiveCategory === "Returns") updates["Return Sales Reference No."] = salesRef;
    else updates["Hike Quote / Sale Reference"] = salesRef;
    if (paymentSelectEl && paymentSelectEl.value === "Paid" && !salesRef) {
      window.alert("Sales Reference is required when Payment Status is Paid.");
      return;
    }
    const finalStatus = String(updates.systemStatus || job.status || "");
    const finalArtworkLink = String(updates.artworkLink || job.artworkLink || "").trim();
    const isProdCategory = (job.category === "In-house" || job.category === "Outsourced");
    const artworkMissingAllowedStatuses = new Set([
      "Waiting Artwork",
      "Waiting Payment & Artwork",
      "Waiting Payment",
      "Awaiting Artwork Approval",
      "Waiting Approval",
      "Cancelled",
      "Collected",
      "Closed",
    ]);
    const statusIsChanging = finalStatus !== String(job.status || "");
    if (isProdCategory && !finalArtworkLink && !artworkMissingAllowedStatuses.has(finalStatus) && statusIsChanging) {
      window.alert("Artwork file/link is required before setting this status.");
      return;
    }
    if (showHardProofControl) {
      const hardProofApproved = !!(hardProofApprovalEl && hardProofApprovalEl.checked);
      if (!hardProofApproved && statusRequiresHardProofApproval_(finalStatus)) {
        window.alert("Hard proof approval is required before setting this status.");
        return;
      }
    }
    if (updates.artworkLink && (!job.artworkSource || String(job.artworkSource).trim() === "" || String(job.artworkSource).trim() === "Customer will send later")) {
      updates.artworkSource = "Customer supplied now";
      updates["Artwork Source"] = "Customer supplied now";
    }
    if (showPromiseComms) {
      updates.communicationStatus = sanitizeCommunicationStatus_(panel.querySelector("#jd-comm").value);
      updates.customerNotified = panel.querySelector("#jd-notified-risk").value;
    } else if (showReadyCollectionNotify) {
      updates.customerNotified = panel.querySelector("#jd-notified-ready").value;
    }
    if (showCancellationPanel) {
      const reason = panel.querySelector("#jd-cancel-reason").value;
      const selected = panel.querySelector("#jd-cancel-outcome").value;
      if (showOwnerCancellationFields) {
        const ownerAction = String(panel.querySelector("#jd-cancel-owner-action").value || "").trim();
        if (!ownerAction) {
          window.alert("Owner Action / Refund Ref is required for cancelled jobs.");
          return;
        }
        updates.notes = upsertCancellationOwnerAction_(updates.notes, ownerAction);
      }
      updates.notes = upsertCancellationOutcome_(updates.notes, selected);
      updates.notes = upsertCancellationReason_(updates.notes, reason);
      updates.notes = upsertCancellationDate_(updates.notes, getCancellationDate_(updates.notes) || formatYmdLocal_(new Date()));
    }
    const finalStatus2 = String(updates.systemStatus || job.status || "");
    if (finalStatus2 === "Cancelled") {
      const notifyEl = panel.querySelector("#jd-cancel-wesley-notified");
      let wesleyTicked = !!(notifyEl && notifyEl.checked);
      if (!wesleyTicked) {
        if (notifyEl) {
          // Checkbox is visible but not ticked — nudge user to tick it
          window.alert("Please tick the 'Cancellation Escalated to Wesley' checkbox before saving.");
          return;
        }
        // First-time cancellation — checkbox not in DOM yet, confirm via dialog
        const ok = window.confirm("Has Wesley been notified of this cancellation?\n\nClick OK to confirm and cancel this job.");
        if (!ok) return;
        wesleyTicked = true;
      }
      updates.notes = upsertCancellationDate_(updates.notes, getCancellationDate_(updates.notes) || formatYmdLocal_(new Date()));
      updates.notes = upsertCancellationWesleyNotified_(updates.notes, wesleyTicked);
    } else if (showWesleyNotifyControl) {
      const notifyEl = panel.querySelector("#jd-cancel-wesley-notified");
      if (notifyEl) updates.notes = upsertCancellationWesleyNotified_(updates.notes, !!notifyEl.checked);
    }
    const paymentMethodEl = panel.querySelector("#jd-payment-method");
    if (paymentSelectEl && paymentSelectEl.value === "Paid") {
      if (paymentMethodEl && !paymentMethodEl.value) {
        window.alert("Please select a payment method.");
        return;
      }
      if (paymentMethodEl && paymentMethodEl.value) {
        updates.paymentMethod = paymentMethodEl.value;
        updates["Payment Method"] = paymentMethodEl.value;
      }
    }
    // Serialize spec fields — use current category/product, not original job values.
    const effectiveProduct = (newProduct && newProduct.length > 0) ? newProduct : job.product;
    // For sublimation, the sub-product dropdown may have changed — read it from the DOM so the
    // schema reflects the currently visible fields, not the fields from the original job.specs.
    let specsJobForSchema = { ...job, category: effectiveCategory, product: effectiveProduct };
    if (effectiveProduct === "Sublimation" || effectiveCategory === "Sublimation") {
      const subProductEl = panel.querySelector("#jd-spec-sublimation_product");
      if (subProductEl && subProductEl.value) {
        specsJobForSchema = { ...specsJobForSchema, specs: `Product: ${subProductEl.value}` };
      }
    }
    const specSchema = getEditableSpecSchema_(specsJobForSchema);
    if (specSchema) {
      const specLines = [];
      specSchema.fields.forEach(field => {
        if (field.showWhen) {
          const controlEl = panel.querySelector(`#jd-spec-${field.showWhen.field}`);
          if (!controlEl || controlEl.value !== field.showWhen.equals) return;
        }
        const el = panel.querySelector(`#jd-spec-${field.id}`);
        const value = el ? el.value.trim() : "";
        if (value) specLines.push(`${field.label}: ${value}`);
      });
      updates.specs = specLines.join("\n");
      updates["Specs (All Products)"] = updates.specs;
    } else {
      const specsTextEl = panel.querySelector("#jd-specs-text");
      if (specsTextEl) {
        updates.specs = specsTextEl.value;
        updates["Specs (All Products)"] = specsTextEl.value;
      }
    }
    if (finalStatus2 === "Collected" && needsPaymentGate_(job)) {
      showPayOnCollectionGate_(job, panel, async (method, salesRef) => {
        updates.paymentStatus = "Paid";
        updates.paymentMethod = method;
        updates["Payment Method"] = method;
        if (salesRef) updates["Hike Quote / Sale Reference"] = salesRef;
        await saveJobChanges(job.jobNo, updates);
      });
      return;
    }
    await saveJobChanges(job.jobNo, updates);
  };
  return panel;
}

async function deleteJob_(jobNo) {
  const no = String(jobNo || "").trim();
  if (!no) return false;
  state.saving = true;
  state.saveMessage = "";
  render();
  try {
    const res = await fetch(API.baseUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "deleteJob",
        key: API.key,
        fastWrite: true,
        jobNo: no,
      }),
    });
    const payload = await res.json();
    if (!payload.ok) {
      const errText = String(payload.error || "Delete failed");
      if (errText.toLowerCase().includes("unknown action: deletejob")) {
        const current = state.jobs.find(j => j.jobNo === no);
        const notes = upsertTaggedValue_(current && current.notes ? current.notes : "", "SOFT_DELETE", "YES");
        const fallbackOk = await saveJobChanges(
          no,
          { systemStatus: "Cancelled", notes },
          { keepTab: true, quiet: true }
        );
        if (!fallbackOk) throw new Error("Delete fallback failed");
      } else {
        throw new Error(errText);
      }
    }
    // Mark as soft-deleted in local state — keep in state.jobs so Deleted Jobs tab can show it
    const idx = state.jobs.findIndex(j => j.jobNo === no);
    if (idx !== -1) state.jobs[idx] = applyLocalJobUpdates_(state.jobs[idx], { systemStatus: "Cancelled", notes: upsertTaggedValue_(state.jobs[idx].notes || "", "SOFT_DELETE", "YES") });
    const remaining = state.jobs.filter(j => !isSoftDeleted_(j));
    if (remaining.length) {
      state.selectedJobNo = remaining[0].jobNo;
      state.tab = "job_detail";
    } else {
      state.selectedJobNo = "";
      state.tab = "staff_board";
    }
    state.saveMessage = `Deleted ${no}`;
    render();
    scheduleSilentRefresh_(3000);
    return true;
  } catch (err) {
    state.saveMessage = `Delete failed: ${String(err && err.message ? err.message : err)}`;
    render();
    return false;
  } finally {
    state.saving = false;
    render();
  }
}

function renderArtworkCurrentHtml_(url) {
  const u = String(url || "").trim();
  if (!u) return "No artwork uploaded";
  return `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">Open Artwork</a>`;
}

function getStatusOptions(category) {
  if (category === "In-house") return ["Waiting Payment", "Waiting Artwork", "Waiting Payment & Artwork", "Design: In Progress", "Awaiting Artwork Approval", "Awaiting Hard Proof Approval", "Ready", "Batched (DTF Order)", "Batched (Vinyl Print Run)", "DTF Order Placed", "In Production", "Ready for Collection", "Cancelled", "Collected"];
  if (category === "Outsourced") return ["Waiting Payment", "Waiting Artwork", "Waiting Payment & Artwork", "Waiting Approval", "Awaiting Artwork Approval", "Ready to Order", "Order Placed", "In Production", "Ready for Collection", "Cancelled", "Collected"];
  if (category === "Ink/Stock") return ["Unpaid", "Ready to Order", "Order Placed", "Backordered", "Ready for Collection", "Cancelled", "Collected"];
  if (category === "Returns") return ["Return: Awaiting Dispatch", "Return: Sent to Supplier", "Supplier Feedback Received", "Refund Pending", "Refund Processed", "Replacement Ordered", "Ready for Collection", "Cancelled", "Closed"];
  if (category === "Design") return ["Briefing Received", "In Progress", "Awaiting Client Approval", "Approved", "Completed", "Cancelled"];
  return ["Ready"];
}

function sanitizeCommunicationStatus_(value) {
  const allowed = new Set(["Not Contacted", "Contacted - Awaiting Reply", "New Date Agreed"]);
  const v = String(value || "").trim();
  if (allowed.has(v)) return v;
  if (!v) return "Not Contacted";
  const map = {
    "Delay Notified": "Contacted - Awaiting Reply",
    "Awaiting Customer Response": "Contacted - Awaiting Reply",
    "Customer Confirmed New Date": "New Date Agreed",
    "Resolved": "New Date Agreed",
  };
  return map[v] || "Not Contacted";
}

function getPromiseRiskAlertMeta_(communicationStatus, customerNotified) {
  const comm = sanitizeCommunicationStatus_(communicationStatus);
  const notified = String(customerNotified || "").trim();
  if (comm === "Not Contacted") {
    return { className: "risk", text: "PROMISE RISK: customer not contacted yet" };
  }
  if (comm === "New Date Agreed") {
    return { className: "ok", text: "PROMISE RISK: customer informed, new date agreed" };
  }
  if (comm === "Contacted - Awaiting Reply" || notified === "Yes - Delay" || notified === "Yes - New Date" || notified === "Yes - General") {
    return { className: "warn", text: "PROMISE RISK: customer contacted, awaiting confirmation" };
  }
  return { className: "risk", text: "PROMISE RISK: customer not contacted yet" };
}

function getDetailStatusPillMeta_(statusRaw) {
  const status = String(statusRaw || "").trim();
  const map = {
    "Ready": ["Ready", "ok"],
    "Ready to Order": ["Ready to Order", "ok"],
    "Order Placed": ["Order Placed", "info"],
    "Batched (DTF Order)": ["Batched (DTF Order)", "info"],
    "Batched (Vinyl Print Run)": ["Batched (Vinyl Print Run)", "info"],
    "DTF Order Placed": ["DTF Order Placed", "info"],
    "In Production": ["In Production", "info"],
    "Order Placed": ["Order Placed", "info"],
    "Ready for Collection": ["Ready for Collection", "ok"],
    "Collected": ["Collected", "ok"],
    "Waiting Payment": ["Awaiting Payment", "warn"],
    "Waiting Artwork": ["Awaiting Artwork", "warn"],
    "Waiting Payment & Artwork": ["Awaiting Payment + Artwork", "warn"],
    "Waiting Approval": ["Awaiting Artwork Approval", "warn"],
    "Awaiting Artwork Approval": ["Awaiting Artwork Approval", "warn"],
    "Awaiting Hard Proof Approval": ["Awaiting Hard Proof Approval", "warn"],
    "Unpaid": ["Unpaid", "warn"],
    "Backordered": ["Backordered", "risk"],
    "Cancelled": ["Cancelled", "cancel"],
    "Return: Awaiting Dispatch": ["Return: Awaiting Dispatch", "warn"],
    "Return: Sent to Supplier": ["Return: Sent to Supplier", "info"],
    "Supplier Feedback Received": ["Feedback Received", "info"],
    "Refund Pending": ["Refund Pending", "warn"],
    "Refund Processed": ["Refund Processed", "ok"],
    "Replacement Ordered": ["Replacement Ordered", "progress"],
    "Closed": ["Closed", "ok"],
  };
  if (!status) return null;
  if (map[status]) return { text: map[status][0], className: map[status][1] };
  return { text: status, className: "info" };
}

function getCancellationOutcome_(notes) {
  const text = String(notes || "");
  const m = text.match(/\[CANCEL_OUTCOME:([^\]]+)\]/i);
  return m ? m[1].trim() : "";
}

function getCancellationReason_(notes) {
  const text = String(notes || "");
  const m = text.match(/\[CANCEL_REASON:([^\]]+)\]/i);
  return m ? m[1].trim() : "";
}

function getCancellationOwnerAction_(notes) {
  const text = String(notes || "");
  const m = text.match(/\[CANCEL_OWNER:([^\]]+)\]/i);
  return m ? m[1].trim() : "";
}

function getCancellationDate_(notes) {
  const text = String(notes || "");
  const m = text.match(/\[CANCEL_DATE:([^\]]+)\]/i);
  return m ? m[1].trim() : "";
}

function getCancellationWesleyNotified_(notes) {
  const text = String(notes || "");
  const m = text.match(/\[CANCEL_WESLEY_NOTIFIED:([^\]]+)\]/i);
  if (!m) return false;
  return String(m[1] || "").trim().toUpperCase() === "YES";
}

function upsertCancellationOutcome_(notes, outcome) {
  const current = String(notes || "");
  const cleaned = current.replace(/\[CANCEL_OUTCOME:[^\]]+\]/ig, "").replace(/\s+\|\s+$/, "").trim();
  const next = String(outcome || "").trim();
  if (!next || next === "Not Logged") return cleaned;
  return cleaned ? `${cleaned} [CANCEL_OUTCOME:${next}]` : `[CANCEL_OUTCOME:${next}]`;
}

function upsertCancellationReason_(notes, reason) {
  const current = String(notes || "");
  const cleaned = current.replace(/\[CANCEL_REASON:[^\]]+\]/ig, "").replace(/\s+\|\s+$/, "").trim();
  const next = String(reason || "").trim();
  if (!next || next === "Not Logged") return cleaned;
  return cleaned ? `${cleaned} [CANCEL_REASON:${next}]` : `[CANCEL_REASON:${next}]`;
}

function upsertCancellationOwnerAction_(notes, ownerAction) {
  const current = String(notes || "");
  const cleaned = current.replace(/\[CANCEL_OWNER:[^\]]+\]/ig, "").replace(/\s+\|\s+$/, "").trim();
  const next = String(ownerAction || "").trim();
  if (!next) return cleaned;
  return cleaned ? `${cleaned} [CANCEL_OWNER:${next}]` : `[CANCEL_OWNER:${next}]`;
}

function upsertCancellationWesleyNotified_(notes, notified) {
  const current = String(notes || "");
  const cleaned = current.replace(/\[CANCEL_WESLEY_NOTIFIED:[^\]]+\]/ig, "").replace(/\s+\|\s+$/, "").trim();
  const value = notified ? "YES" : "NO";
  return cleaned ? `${cleaned} [CANCEL_WESLEY_NOTIFIED:${value}]` : `[CANCEL_WESLEY_NOTIFIED:${value}]`;
}

function upsertCancellationDate_(notes, dateText) {
  const current = String(notes || "");
  const cleaned = current.replace(/\[CANCEL_DATE:[^\]]+\]/ig, "").replace(/\s+\|\s+$/, "").trim();
  const next = String(dateText || "").trim();
  if (!next) return cleaned;
  return cleaned ? `${cleaned} [CANCEL_DATE:${next}]` : `[CANCEL_DATE:${next}]`;
}

function isCancellationResolved_(job) {
  const outcome = getCancellationOutcome_(job.notes);
  return ["Refund Completed", "Credit Note Issued", "No Refund"].includes(outcome);
}

function isCancellationOpen_(job) {
  return String(job.status || "") === "Cancelled" && !isCancellationResolved_(job);
}

function isSoftDeleted_(job) {
  return extractTaggedValue_(job && job.notes, "SOFT_DELETE").toUpperCase() === "YES";
}

function isJobCompleted_(job) {
  if (isCancellationResolved_(job)) return true;
  return isCompletedStatusForCategory_(job.category, job.status);
}

function getNextStatuses_(job) {
  const status = String(job.status || "").trim();
  const cat = String(job.category || "").trim();
  const isIsgDesign = String(job.artworkSource || "").trim() === "ISG to design";

  // ISG-to-design jobs use a design sub-flow instead of the generic artwork steps
  if (isIsgDesign && (status === "Waiting Artwork" || status === "Waiting Payment & Artwork")) return ["Design: In Progress"];
  if (status === "Design: In Progress") return ["Awaiting Artwork Approval"];

  const map = {
    "In-house": {
      "Waiting Payment":              ["In Production"],
      "Waiting Artwork":              ["Awaiting Artwork Approval", "In Production"],
      "Waiting Payment & Artwork":    ["Waiting Payment", "Waiting Artwork"],
      "Awaiting Artwork Approval":    ["In Production"],
      "Awaiting Hard Proof Approval": ["In Production"],
      "Ready":                        ["In Production", "Ready for Collection"],
      "Batched (DTF Order)":          ["DTF Order Placed"],
      "Batched (Vinyl Print Run)":    ["In Production"],
      "DTF Order Placed":             ["In Production"],
      "In Production":                ["Ready for Collection"],
      "Ready for Collection":         ["Collected"],
    },
    "Outsourced": {
      "Waiting Payment":              ["Ready to Order"],
      "Waiting Artwork":              ["Awaiting Artwork Approval", "Ready to Order"],
      "Waiting Payment & Artwork":    ["Waiting Payment", "Waiting Artwork"],
      "Waiting Approval":             ["Awaiting Artwork Approval", "Ready to Order"],
      "Awaiting Artwork Approval":    ["Ready to Order"],
      "Ready to Order":               ["Order Placed"],
      "Order Placed":                 ["Ready for Collection"],
      "Ready for Collection":         ["Collected"],
    },
    "Ink/Stock": {
      "Unpaid":              ["Ready to Order"],
      "Ready to Order":      ["Order Placed"],
      "Order Placed":        ["Ready for Collection"],
      "Backordered":         ["Order Placed"],
      "Ready for Collection": ["Collected"],
    },
    "Returns": {
      "Return: Awaiting Dispatch":   ["Return: Sent to Supplier"],
      "Return: Sent to Supplier":    ["Supplier Feedback Received"],
      "Supplier Feedback Received":  ["Refund Pending", "Replacement Ordered", "Closed"],
      "Refund Pending":              ["Refund Processed"],
      "Refund Processed":            ["Closed"],
      "Replacement Ordered":         ["Ready for Collection"],
      "Ready for Collection":        ["Collected"],
    },
    "Design": {
      "Briefing Received":        ["In Progress"],
      "In Progress":              ["Awaiting Client Approval"],
      "Awaiting Client Approval": ["Approved", "In Progress"],
      "Approved":                 ["Completed"],
    },
  };
  return (map[cat] && map[cat][status]) || [];
}

function getStatusOptionsForJob_(job) {
  let all = getStatusOptions(job.category);
  if (job.category === "In-house") {
    if (!isDtfJob_(job)) {
      all = all.filter(s => s !== "Batched (DTF Order)" && s !== "DTF Order Placed");
    }
    if (!isMimakiJob_(job)) {
      all = all.filter(s => s !== "Batched (Vinyl Print Run)");
    }
  }
  const current = String(job.status || "");
  const idx = all.indexOf(current);
  if (idx < 0) return all;
  return all.slice(idx);
}

function statusRequiresHardProofApproval_(statusRaw) {
  const status = String(statusRaw || "").trim();
  const gated = new Set([
    "Ready",
    "Batched (DTF Order)",
    "DTF Order Placed",
    "In Production",
    "Ready for Collection",
    "Collected",
  ]);
  return gated.has(status);
}

function getPillDisplay_(currentStatus, targetStatus) {
  if (currentStatus === "Waiting Payment & Artwork" && targetStatus === "Waiting Artwork") {
    return { label: "Mark Paid", icon: "✓", green: true };
  }
  if (currentStatus === "Waiting Payment & Artwork" && targetStatus === "Waiting Payment") {
    return { label: "Artwork Received", icon: "✓", green: false };
  }
  if ((currentStatus === "Waiting Artwork" || currentStatus === "Waiting Payment & Artwork") && targetStatus === "Design: In Progress") {
    return { label: "Start Design", icon: "→", green: false };
  }
  if (currentStatus === "Design: In Progress" && targetStatus === "Awaiting Artwork Approval") {
    return { label: "Send for Approval", icon: "→", green: false };
  }
  const artworkPending = ["Waiting Artwork", "Waiting Approval", "Awaiting Artwork Approval", "Awaiting Hard Proof Approval"];
  if (artworkPending.includes(currentStatus) && (targetStatus === "In Production" || targetStatus === "Ready to Order")) {
    return { label: "Artwork Approved", icon: "✓", green: true };
  }
  if (targetStatus === "Awaiting Artwork Approval") {
    return { label: "Proof Sent to Customer", icon: "→", green: false };
  }
  if (targetStatus === "Order Placed") {
    return { label: "Order Placed", icon: "✓", green: false };
  }
  if (targetStatus === "Batched (DTF Order)") {
    return { label: "Add to DTF Order", icon: "→", green: false };
  }
  if (targetStatus === "Batched (Vinyl Print Run)") {
    return { label: "Add to Vinyl Run", icon: "→", green: false };
  }
  if (targetStatus === "DTF Order Placed") {
    return { label: "DTF Order Placed", icon: "✓", green: false };
  }
  if (targetStatus === "Order Placed") {
    return { label: "Order Placed", icon: "✓", green: false };
  }
  if (targetStatus === "In Production") {
    return { label: "Start Production", icon: "→", green: false };
  }
  if (targetStatus === "Ready for Collection") {
    return { label: "Ready for Collection", icon: "✓", green: true };
  }
  if (targetStatus === "Collected") {
    return { label: "Mark Collected", icon: "✓", green: true };
  }
  if (targetStatus === "Refund Pending") {
    return { label: "Outcome: Refund", icon: "→", green: false };
  }
  if (targetStatus === "Replacement Ordered") {
    return { label: "Outcome: Exchange", icon: "→", green: false };
  }
  if (targetStatus === "Refund Processed") {
    return { label: "Refund Processed", icon: "✓", green: true };
  }
  return { label: targetStatus, icon: "→", green: false };
}

function getPipelineStepLabel_(status) {
  const m = {
    "Waiting Payment & Artwork": "Payment & Artwork",
    "Waiting Payment": "Payment",
    "Waiting Artwork": "Artwork",
    "Waiting Approval": "Approval",
    "Design: In Progress": "Design",
    "Awaiting Artwork Approval": "Artwork Approval",
    "Awaiting Hard Proof Approval": "Hard Proof",
    "Awaiting Client Approval": "Client Approval",
    "Batched (DTF Order)": "DTF Batched",
    "DTF Order Placed": "DTF Ordered",
    "Batched (Vinyl Print Run)": "Vinyl Batched",
    "In Production": "In Production",
    "Ready to Order": "Ready to Order",
    "Order Placed": "Ordered",
    "Ready for Collection": "Ready for Collection",
    "Collected": "Collected",
    "Refund Pending": "Refund Pending",
    "Refund Processed": "Refunded",
    "Replacement Ordered": "Replacement Ordered",
    "Return: Awaiting Dispatch": "Awaiting Dispatch",
    "Return: Sent to Supplier": "Sent to Supplier",
    "Supplier Feedback Received": "Supplier Feedback",
    "Briefing Received": "Briefing",
    "In Progress": "In Progress",
    "Approved": "Approved",
    "Completed": "Completed",
    "Closed": "Closed",
    "Unpaid": "Unpaid",
    "Backordered": "Backordered",
  };
  return m[status] || status;
}

function buildJobPipeline_(job) {
  const status = String(job.status || "").trim();
  const cat = String(job.category || "").trim();
  const isIsgDesign = String(job.artworkSource || "").trim() === "ISG to design";
  const isDtf = isDtfJob_(job);
  const isVinyl = isMimakiJob_(job);
  let pipeline = [];

  if (cat === "In-house") {
    if (isDtf) {
      if (isIsgDesign) {
        pipeline = ["Waiting Artwork", "Design: In Progress", "Awaiting Artwork Approval",
          "In Production", "Ready for Collection", "Collected"];
      } else {
        pipeline = ["Waiting Artwork", "Awaiting Artwork Approval",
          "In Production", "Ready for Collection", "Collected"];
      }
    } else if (isVinyl) {
      pipeline = ["Waiting Artwork", "Batched (Vinyl Print Run)", "In Production", "Ready for Collection", "Collected"];
    } else if (isIsgDesign) {
      pipeline = ["Waiting Artwork", "Design: In Progress", "Awaiting Artwork Approval",
        "In Production", "Ready for Collection", "Collected"];
    } else if (status === "Waiting Payment") {
      pipeline = ["Waiting Payment", "In Production", "Ready for Collection", "Collected"];
    } else {
      pipeline = ["Waiting Artwork", "Awaiting Artwork Approval", "In Production", "Ready for Collection", "Collected"];
    }
  } else if (cat === "Outsourced") {
    if (isIsgDesign) {
      pipeline = ["Waiting Artwork", "Design: In Progress", "Awaiting Artwork Approval",
        "Ready to Order", "Order Placed", "Ready for Collection", "Collected"];
    } else if (status === "Waiting Payment") {
      pipeline = ["Waiting Payment", "Ready to Order", "Order Placed", "Ready for Collection", "Collected"];
    } else {
      pipeline = ["Waiting Artwork", "Awaiting Artwork Approval", "Ready to Order", "Order Placed", "Ready for Collection", "Collected"];
    }
  } else if (cat === "Ink/Stock") {
    if (status === "Unpaid") {
      pipeline = ["Unpaid", "Ready to Order", "Order Placed", "Ready for Collection", "Collected"];
    } else if (status === "Backordered") {
      pipeline = ["Backordered", "Order Placed", "Ready for Collection", "Collected"];
    } else {
      pipeline = ["Ready to Order", "Order Placed", "Ready for Collection", "Collected"];
    }
  } else if (cat === "Returns") {
    if (["Refund Pending", "Refund Processed"].includes(status)) {
      pipeline = ["Return: Awaiting Dispatch", "Return: Sent to Supplier", "Supplier Feedback Received",
        "Refund Pending", "Refund Processed", "Closed"];
    } else if (["Replacement Ordered", "Ready for Collection", "Collected"].includes(status)) {
      pipeline = ["Return: Awaiting Dispatch", "Return: Sent to Supplier", "Supplier Feedback Received",
        "Replacement Ordered", "Ready for Collection", "Collected"];
    } else {
      pipeline = ["Return: Awaiting Dispatch", "Return: Sent to Supplier", "Supplier Feedback Received"];
    }
  } else if (cat === "Design") {
    pipeline = ["Briefing Received", "In Progress", "Awaiting Client Approval", "Approved", "Completed"];
  }

  const currentIdx = pipeline.indexOf(status);
  return { pipeline, currentIdx };
}

function handlePillAction_(toStatus, job, panel) {
  if (toStatus === "Ready for Collection") {
    showReadyForCollectionModal_(job, panel);
  } else if (toStatus === "Collected" && needsPaymentGate_(job)) {
    showPayOnCollectionGate_(job, panel, (method, salesRef) => {
      if (!panel) closeJobPanel_();
      optimisticPillUpdate_(job, { systemStatus: "Collected", paymentStatus: "Paid", paymentMethod: method, "Hike Quote / Sale Reference": salesRef }, panel);
    });
  } else if (toStatus === "Completed" && job.category === "Design" && needsPaymentGate_(job)) {
    showPayOnCollectionGate_(job, panel, (method, salesRef) => {
      if (!panel) closeJobPanel_();
      optimisticPillUpdate_(job, { systemStatus: "Completed", paymentStatus: "Paid", paymentMethod: method, "Hike Quote / Sale Reference": salesRef }, panel);
    });
  } else if (toStatus === "Waiting Artwork" && job.status === "Waiting Payment & Artwork") {
    showPaymentMethodModal_((method, salesRef) => {
      if (!panel) closeJobPanel_();
      optimisticPillUpdate_(job, { systemStatus: "Waiting Artwork", paymentStatus: "Paid", paymentMethod: method, "Hike Quote / Sale Reference": salesRef }, panel);
    }, job);
  } else if (toStatus === "Order Placed" && job.category === "Outsourced" && String(job.outsourcePartner || "") !== "Customisable") {
    if (needsPaymentGate_(job)) { window.alert("This job must be marked as Paid before placing the Printstation order."); return; }
    showPrintstationOrderModal_(job, panel, (ref) => {
      if (!panel) closeJobPanel_();
      optimisticPillUpdate_(job, { systemStatus: "Order Placed", notes: upsertTaggedValue_(job.notes || "", "PS_ORDER", ref) }, panel);
    });
  } else {
    const artworkPendingStatuses = ["Waiting Artwork", "Waiting Approval", "Awaiting Artwork Approval", "Awaiting Hard Proof Approval"];
    const isArtworkApproval = artworkPendingStatuses.includes(job.status) && (toStatus === "In Production" || toStatus === "Ready to Order");
    if (isArtworkApproval) {
      const staffName = state.staffName || "?";
      addCommLogEntry_(job, "Status", `Artwork approved by ${staffName}`);
    }
    if (!panel) closeJobPanel_();
    optimisticPillUpdate_(job, { systemStatus: toStatus, ...(isArtworkApproval ? { customerApproved: true } : {}) }, panel);
  }
}

function renderQuickActionPipeline_(host, job, panel) {
  host.innerHTML = "";

  const { pipeline, currentIdx } = buildJobPipeline_(job);
  const nextStatuses = getNextStatuses_(job);
  const unpaidStatuses = ["Unpaid", "Pending", "Partially Paid"];
  // Suppress the standalone "Mark Paid" pill when a next-status transition already produces one.
  const hasPaidTransition = nextStatuses.some(s => {
    const d = getPillDisplay_(String(job.status || "").trim(), s);
    return d && d.label === "Mark Paid";
  });
  const showPaidPill = !hasPaidTransition && unpaidStatuses.includes(String(job.payment || "").trim());

  // For outsourced jobs in "Ready to Order" that still need payment, intercept the
  // "Order Placed" pill and replace it with a "Collect Payment" step instead.
  const needsCollectPayment =
    job.category === "Outsourced" &&
    String(job.status || "").trim() === "Ready to Order" &&
    needsPaymentGate_(job);

  // When collecting payment is required, suppress the normal actionable pills so
  // "Order Placed" cannot be clicked — it shows as upcoming instead.
  const actionableStatuses = needsCollectPayment ? [] : nextStatuses;

  if (!actionableStatuses.length && !showPaidPill && !needsCollectPayment) return;

  // Actionable next-step pills — always grey dashed (never green; green = completed only)
  actionableStatuses.forEach(toStatus => {
    const { label: pLabel, icon } = getPillDisplay_(job.status, toStatus);
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "next-step-pill";
    pill.innerHTML = `<span class="pill-arrow">${icon}</span> ${escapeHtml(pLabel)}`;
    pill.onclick = () => handlePillAction_(toStatus, job, panel);
    host.appendChild(pill);
  });

  // Collect Payment pill — shown instead of "Order Placed" when payment is outstanding.
  if (needsCollectPayment) {
    const collectPill = document.createElement("button");
    collectPill.type = "button";
    collectPill.className = "next-step-pill";
    collectPill.innerHTML = `<span class="pill-arrow">💳</span> Collect Payment`;
    collectPill.onclick = () => {
      showPaymentMethodModal_((method, salesRef) => {
        if (!panel) closeJobPanel_();
        optimisticPillUpdate_(job, { paymentStatus: "Paid", paymentMethod: method, "Hike Quote / Sale Reference": salesRef }, panel);
      }, job);
    };
    host.appendChild(collectPill);
  }

  // Mark Paid pill — shown for Unpaid/Pending/Partially Paid jobs (grey dashed)
  if (showPaidPill) {
    if (actionableStatuses.length) {
      const sep = document.createElement("span");
      sep.style.cssText = "color:var(--line);font-size:16px;line-height:1";
      sep.textContent = "·";
      host.appendChild(sep);
    }
    const paidPill = document.createElement("button");
    paidPill.type = "button";
    paidPill.className = "next-step-pill";
    paidPill.innerHTML = `<span class="pill-arrow">✓</span> Mark Paid`;
    paidPill.onclick = () => {
      showPaymentMethodModal_((method, salesRef) => {
        if (!panel) closeJobPanel_();
        optimisticPillUpdate_(job, { paymentStatus: "Paid", paymentMethod: method, "Hike Quote / Sale Reference": salesRef }, panel);
      }, job);
    };
    host.appendChild(paidPill);
  }

}

function renderPanelQuickActions_(drawer, job) {
  const host = drawer.querySelector("#panel-next-steps");
  if (!host) return;
  renderQuickActionPipeline_(host, job, null);
}

function renderJobDetailQuickActions_(panel, job) {
  const host = panel.querySelector("#jd-next-steps");
  if (!host) return;
  renderQuickActionPipeline_(host, job, panel);
}

// Surgically re-renders only the one lane affected by a job update, leaving the
// other three lanes untouched. Falls back to a full render() if the board isn't
// currently visible or the lane element can't be found.
function fastLaneUpdate_(updatedJob) {
  if (state.tab !== "staff_board" && state.tab !== "owner_dashboard") return false;
  const themeKey = getCategoryTheme_(updatedJob.category).key;
  const laneEl = document.querySelector(`.lane[data-category="${CSS.escape(themeKey)}"]`);
  if (!laneEl) return false;

  const ownerMode = state.tab === "owner_dashboard";
  const staffFilter = !ownerMode && state.staffBoardFilter !== "ALL" ? state.staffBoardFilter : null;
  const filterFn = j => !staffFilter || String(j.staff || "").trim() === staffFilter;
  const total = laneBuckets(updatedJob.category);
  const filteredNeeds = total.needs.filter(filterFn);
  const filteredReady = total.ready.filter(filterFn);
  const allJobs = [...filteredNeeds, ...filteredReady];

  // Update the lane header count badge.
  const countEl = laneEl.querySelector(".lane-count");
  if (countEl) countEl.textContent = allJobs.length;

  // Remove existing bucket sections and rebuild them.
  laneEl.querySelectorAll(".bucket").forEach(b => b.remove());
  const buckets = ownerMode
    ? [["Needs Action", total.needs]]
    : [["Needs Action", filteredNeeds], ["Ready", filteredReady]];
  buckets.forEach(([title, list]) => {
    const sec = document.createElement("div");
    sec.className = `bucket ${title === "Needs Action" ? "bucket-needs" : "bucket-ready"}`;
    sec.innerHTML = `<h4>${title} <span style="font-weight:normal;opacity:.7">(${list.length})</span></h4>`;
    if (!list.length) {
      const p = document.createElement("div");
      p.className = "bucket-empty";
      p.textContent = "All clear";
      sec.appendChild(p);
    } else {
      list.sort((a, z) => a.due.localeCompare(z.due)).forEach(j => sec.appendChild(card(j)));
    }
    laneEl.appendChild(sec);
  });
  return true;
}

function optimisticPillUpdate_(job, updates, panel) {
  // Apply change locally and re-render immediately — no waiting for the network.
  const idx = state.jobs.findIndex(j => j.jobNo === job.jobNo);
  const snapshot = idx >= 0 ? { ...state.jobs[idx] } : null;
  if (idx >= 0) {
    state.jobs[idx] = applyLocalJobUpdates_(state.jobs[idx], updates);
  }
  // Auto-log status and payment changes to the activity log.
  const hasStatusChange = "systemStatus" in updates;
  const hasPaidChange = "paymentStatus" in updates && updates.paymentStatus === "Paid";
  if (hasStatusChange || hasPaidChange) {
    const parts = [];
    if (hasStatusChange) parts.push(`Status → ${updates.systemStatus}`);
    if (hasPaidChange) {
      const method = updates.paymentMethod ? ` (${updates.paymentMethod})` : "";
      parts.push(`Payment marked as Paid${method}`);
    }
    const freshJob = idx >= 0 ? state.jobs[idx] : job;
    addCommLogEntry_(freshJob, "Status", parts.join(" · "));
  }
  // Sync the status dropdown if it's visible.
  if ("systemStatus" in updates) {
    const statusEl = panel && panel.querySelector("#jd-status");
    if (statusEl) statusEl.value = updates.systemStatus;
  }
  // Fast path: only rebuild the affected lane instead of the entire board.
  const updatedJob = idx >= 0 ? state.jobs[idx] : job;
  // Track recent saves so silent refreshes don't overwrite optimistic state.
  state.recentSaves[job.jobNo] = { updates, ts: Date.now() };
  state.savingJobNos.add(job.jobNo);
  if (!fastLaneUpdate_(updatedJob)) render();
  // Re-render the open panel so its pills reflect the optimistic state immediately.
  refreshOpenPanel_();
  // Fire API in background — revert on failure.
  saveJobChanges(job.jobNo, updates, { keepTab: true, quiet: true, optimistic: true }).then(ok => {
    state.savingJobNos.delete(job.jobNo);
    // Refresh panel again after server responds — catches any server-side status changes.
    const currentJob = idx >= 0 ? state.jobs.find(j => j.jobNo === job.jobNo) || state.jobs[idx] : updatedJob;
    if (!fastLaneUpdate_(currentJob)) render();
    refreshOpenPanel_();
    if (!ok && snapshot && idx >= 0) {
      const revertIdx = state.jobs.findIndex(j => j.jobNo === job.jobNo);
      if (revertIdx >= 0) state.jobs[revertIdx] = snapshot;
      delete state.recentSaves[job.jobNo];
      state.saveMessage = "Save failed — please try again";
      if (!fastLaneUpdate_(snapshot)) render();
      refreshOpenPanel_();
    }
  });
}

function showReadyForCollectionModal_(job, panel) {
  const existing = document.getElementById("rfc-modal");
  if (existing) existing.remove();

  // If this job belongs to an order group, warn if siblings aren't ready yet
  if (job.orderGroup) {
    const notReadySiblings = state.jobs.filter(j =>
      j.orderGroup === job.orderGroup &&
      j.jobNo !== job.jobNo &&
      !isSoftDeleted_(j) &&
      !["Ready for Collection", "Collected", "Closed", "Cancelled"].includes(j.status)
    );
    if (notReadySiblings.length) {
      showOrderReadyGate_(job, notReadySiblings, panel);
      return;
    }
  }

  const phone = String(job.customerPhone || "").trim();
  const email = String(job.customerEmail || "").trim();
  const waNotify    = phone ? buildCustomerNotify_(job) : null;
  const emailNotify = email ? (() => {
    const subject = encodeURIComponent(`Your order ${job.jobNo} is ready for collection`);
    const body    = encodeURIComponent(`Hi ${job.customer},\n\nYour order (${job.jobNo}) is ready for collection at Ink Station Glengarry.\n\nThank you!`);
    return { type: "email", url: `https://mail.google.com/mail/?authuser=isglengarry@gmail.com&view=cm&fs=1&to=${encodeURIComponent(email)}&su=${subject}&body=${body}` };
  })() : null;

  const hasContact = waNotify || emailNotify;
  const bodyText = hasContact
    ? `How would you like to notify <strong>${escapeHtml(job.customer)}</strong>?`
    : `No phone or email on file for <strong>${escapeHtml(job.customer)}</strong> — status will be updated without a notification.`;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "rfc-modal";
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-title">Mark as Ready for Collection?</div>
      <div class="modal-body">${escapeHtml(job.jobNo)}<br><br>${bodyText}</div>
      <div class="modal-actions rfc-modal-actions">
        <button class="secondary" id="rfc-cancel">Cancel</button>
        ${waNotify    ? `<button id="rfc-wa" class="rfc-btn-wa">WhatsApp ${escapeHtml(phone)}</button>` : ""}
        ${emailNotify ? `<button id="rfc-email" class="rfc-btn-email">Email ${escapeHtml(email)}</button>` : ""}
        <button id="rfc-skip" class="secondary">${hasContact ? "Skip notification" : "Confirm"}</button>
      </div>
      ${emailNotify ? `<p style="font-size:11px;color:var(--muted);text-align:center;margin-top:8px;">Sends from: isglengarry@gmail.com</p>` : ""}
    </div>`;
  document.body.appendChild(overlay);

  function confirm_() {
    overlay.remove();
    closeJobPanel_();
    optimisticPillUpdate_(job, { systemStatus: "Ready for Collection" }, panel);
  }

  overlay.querySelector("#rfc-cancel").onclick = () => overlay.remove();
  overlay.querySelector("#rfc-skip").onclick   = () => confirm_();
  if (waNotify) overlay.querySelector("#rfc-wa").onclick = () => {
    addCommLogEntry_(job, "WhatsApp", "Ready for Collection — customer notified");
    confirm_();
    window.open(waNotify.url, "_blank", "noopener,noreferrer");
  };
  if (emailNotify) overlay.querySelector("#rfc-email").onclick = () => {
    addCommLogEntry_(job, "Email", "Ready for Collection — customer notified");
    confirm_();
    window.open(emailNotify.url, "_blank", "noopener,noreferrer");
  };
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}

function showSendingAsModal_(onConfirm) {
  const existing = document.getElementById("sending-as-modal");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "sending-as-modal";
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:320px">
      <div class="modal-title">Sending as…</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:16px 20px 4px">
        ${STAFF_NAMES_.map(n => `<button type="button" class="sending-as-chip${n === (state.staffName || STAFF_NAMES_[0]) ? " selected" : ""}" data-name="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join("")}
      </div>
      <div class="modal-actions" style="margin-top:12px">
        <button class="secondary" id="sending-as-cancel">Cancel</button>
        <button id="sending-as-confirm">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  let selected = state.staffName || STAFF_NAMES_[0];
  overlay.querySelectorAll(".sending-as-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      overlay.querySelectorAll(".sending-as-chip").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selected = btn.dataset.name;
    });
  });
  overlay.querySelector("#sending-as-cancel").onclick = () => overlay.remove();
  overlay.querySelector("#sending-as-confirm").onclick = () => {
    state.staffName = selected;
    try { localStorage.setItem(ISG_STAFF_KEY, selected); } catch (_e) {}
    const el = document.getElementById("staff-name");
    if (el) el.value = selected;
    overlay.remove();
    onConfirm(selected);
  };
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}

function showPaymentMethodModal_(onConfirm, job) {
  const existing = document.getElementById("pmm-modal");
  if (existing) existing.remove();
  const existingSalesRef = String(job && job.salesReference ? job.salesReference : "");
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "pmm-modal";
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-title">Mark as Paid</div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Payment Method <span style="color:var(--danger)">*</span></label>
          <select id="pmm-method" style="width:100%;">
            <option value="">— select —</option>
            <option value="Card">Card</option>
            <option value="EFT">EFT</option>
            <option value="Cash">Cash</option>
            <option value="On Account">On Account</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Hike Quote / Sales Reference <span style="color:var(--danger)">*</span></label>
          <input id="pmm-sales-ref" type="text" value="${escapeHtml(existingSalesRef)}" placeholder="e.g. S1234" style="width:100%;box-sizing:border-box;" />
        </div>
      </div>
      <div class="modal-actions">
        <button class="secondary" id="pmm-cancel">Cancel</button>
        <button id="pmm-confirm">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#pmm-cancel").onclick = () => overlay.remove();
  overlay.querySelector("#pmm-confirm").onclick = () => {
    const method = overlay.querySelector("#pmm-method").value;
    const salesRef = overlay.querySelector("#pmm-sales-ref").value.trim();
    if (!method) { window.alert("Please select a payment method."); return; }
    if (!salesRef) { window.alert("Hike Quote / Sales Reference is required."); return; }
    overlay.remove();
    onConfirm(method, salesRef);
  };
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}

function showPrintstationOrderModal_(job, panel, onConfirmed) {
  const existing = document.getElementById("ps-order-modal");
  if (existing) existing.remove();
  const existingRef = extractTaggedValue_(job.notes || "", "PS_ORDER");
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "ps-order-modal";
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-title">Enter Printstation Order #</div>
      <div class="modal-body">
        <p><strong>${escapeHtml(job.jobNo)} — ${escapeHtml(job.customer)}</strong></p>
        <p style="margin-top:8px;font-size:13px;">Enter the Printstation order number to track this order.</p>
        <div style="margin-top:12px;">
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Printstation Order #</label>
          <input id="ps-order-ref" type="text" value="${escapeHtml(existingRef)}" placeholder="e.g. PS-12345" style="width:100%;box-sizing:border-box;" />
        </div>
      </div>
      <div class="modal-actions">
        <button id="ps-confirm">Mark Order Placed</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector("#ps-order-ref");
  setTimeout(() => input.focus(), 50);
  overlay.querySelector("#ps-confirm").onclick = () => {
    const ref = input.value.trim();
    if (!ref) { input.style.borderColor = "red"; input.focus(); return; }
    overlay.remove();
    onConfirmed(ref);
  };
  input.addEventListener("keydown", e => { if (e.key === "Enter") overlay.querySelector("#ps-confirm").click(); });
}

function needsPaymentGate_(job) {
  const internalCategories = ["Cartridge Return", "Returns"];
  if (internalCategories.includes(job.category)) return false;
  const payment = String(job.payment || "").trim();
  return payment !== "Paid" && payment !== "On Account";
}

function showPayOnCollectionGate_(job, panel, onConfirmed) {
  const existing = document.getElementById("poc-gate-modal");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "poc-gate-modal";
  const existingSalesRef = String(job && job.salesReference ? job.salesReference : "");
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-title">Confirm payment before completing</div>
      <div class="modal-body">
        <p><strong>${escapeHtml(job.jobNo)} — ${escapeHtml(job.customer)}</strong></p>
        <p style="margin-top:8px;">Confirm payment has been received before completing this job.</p>
        <div style="margin-top:12px;">
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Payment Method</label>
          <select id="poc-method" style="width:100%;">
            <option value="">— select —</option>
            <option value="Card">Card</option>
            <option value="EFT">EFT</option>
            <option value="Cash">Cash</option>
            <option value="On Account">On Account</option>
          </select>
        </div>
        <div style="margin-top:12px;">
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Hike / Sale Reference <span style="color:var(--danger)">*</span></label>
          <input id="poc-sales-ref" type="text" value="${escapeHtml(existingSalesRef)}" placeholder="e.g. HK-12345" style="width:100%;box-sizing:border-box;" />
        </div>
      </div>
      <div class="modal-actions">
        <button class="secondary" id="poc-cancel">Cancel</button>
        <button id="poc-confirm">Payment Received — Complete Job</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#poc-cancel").onclick = () => overlay.remove();
  overlay.querySelector("#poc-confirm").onclick = () => {
    const method = overlay.querySelector("#poc-method").value;
    if (!method) { window.alert("Please select a payment method."); return; }
    const salesRef = overlay.querySelector("#poc-sales-ref").value.trim();
    if (!salesRef) { window.alert("Hike / Sale Reference is required."); overlay.querySelector("#poc-sales-ref").focus(); return; }
    overlay.remove();
    onConfirmed(method, salesRef);
  };
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}

// Gate shown when marking "Ready for Collection" but order siblings aren't ready yet
function showOrderReadyGate_(job, notReadySiblings, panel) {
  const existing = document.getElementById("org-modal");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "org-modal";
  const siblingList = notReadySiblings.slice(0, 5).map(s =>
    `<div class="order-sibling">
      <span class="order-sibling-no">${escapeHtml(s.jobNo)}</span>
      <span class="order-sibling-product">${escapeHtml(s.product || s.category || "")}</span>
      <span class="order-sibling-status">${escapeHtml(s.status)}</span>
    </div>`
  ).join("");
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-title">Other jobs in this order aren't ready yet</div>
      <div class="modal-body">
        <p>Order <strong>${escapeHtml(job.orderGroup)}</strong> has ${notReadySiblings.length} job${notReadySiblings.length > 1 ? "s" : ""} still in progress:</p>
        <div style="margin-top:10px;">${siblingList}</div>
        <p style="margin-top:12px;font-size:12px;color:var(--muted);">You can notify the customer now or wait until all jobs are ready.</p>
      </div>
      <div class="modal-actions">
        <button class="secondary" id="org-cancel">Cancel</button>
        <button class="secondary" id="org-ready-only">Mark ready, notify later</button>
        <button id="org-notify-now">Notify customer now</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#org-cancel").onclick = () => overlay.remove();
  overlay.querySelector("#org-ready-only").onclick = () => {
    overlay.remove();
    // Skip notification — just update status
    optimisticPillUpdate_(job, { systemStatus: "Ready for Collection" }, panel);
  };
  overlay.querySelector("#org-notify-now").onclick = () => {
    overlay.remove();
    // Proceed to the normal Ready for Collection modal (notification step)
    // Temporarily clear orderGroup so gate doesn't retrigger
    const jobWithoutGroup = { ...job, orderGroup: "" };
    showReadyForCollectionModal_(jobWithoutGroup, panel);
  };
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}

// Shown after job creation when customer has other open jobs — offer to group them
function showOrderGroupingModal_(newJob, openJobs) {
  const existing = document.getElementById("ogm-modal");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "ogm-modal";
  const jobList = openJobs.slice(0, 5).map(j =>
    `<div class="order-sibling">
      <div class="order-sibling-info">
        <span class="order-sibling-no">${escapeHtml(j.jobNo)}</span>
        <span class="order-sibling-product">${escapeHtml(j.product || j.category || "")}</span>
      </div>
      <span class="order-sibling-status">${escapeHtml(j.status)}</span>
    </div>`
  ).join("");
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-title">Group into one order?</div>
      <div class="modal-body">
        <p><strong>${escapeHtml(newJob.customer)}</strong> has other open jobs. Do you want to group them into a single order?</p>
        <p style="margin-top:6px;font-size:12px;color:var(--muted);">All jobs will share order number <strong>${escapeHtml(newJob.jobNo)}</strong></p>
        <div style="margin-top:12px;">${jobList}</div>
      </div>
      <div class="modal-actions">
        <button class="secondary" id="ogm-no">No, separate order</button>
        <button id="ogm-yes">Yes, group as one order</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#ogm-no").onclick = () => {
    overlay.remove();
    showOrderConfirmationModal_(newJob);
  };
  overlay.querySelector("#ogm-yes").onclick = async () => {
    overlay.remove();
    // Use the oldest existing open job's number as the anchor (preserves the original order #)
    const existingWithGroup = openJobs.find(j => j.orderGroup);
    const anchor = existingWithGroup
      ? existingWithGroup.orderGroup
      : (openJobs.reduce((oldest, j) => j.jobNo < oldest.jobNo ? j : oldest, openJobs[0]).jobNo || newJob.jobNo);
    const jobsToGroup = [newJob, ...openJobs];
    for (const j of jobsToGroup) {
      if (String(j.orderGroup || "") === anchor) continue;
      const idx = state.jobs.findIndex(sj => sj.jobNo === j.jobNo);
      if (idx !== -1) state.jobs[idx] = applyLocalJobUpdates_(state.jobs[idx], { orderGroup: anchor });
      try {
        await fetch(API.baseUrl, {
          method: "POST",
          body: JSON.stringify({
            action: "updateJob",
            key: API.key,
            jobNo: j.jobNo,
            updates: { "Order #": anchor },
          }),
        });
      } catch (_e) {}
    }
    render();
    showOrderConfirmationModal_({ ...newJob, orderGroup: anchor });
  };
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}

// Shown after job creation (and after grouping decision) — offer to send order confirmation
function showOrderConfirmationModal_(job) {
  const existing = document.getElementById("ocm-modal");
  if (existing) existing.remove();
  const orderNo  = String(job.orderGroup || job.jobNo || "").trim();
  const custName = String(job.customer || "").trim();
  const groupJobs = job.orderGroup
    ? state.jobs.filter(j => j.orderGroup === job.orderGroup && !isSoftDeleted_(j))
    : [job];
  const products = [...new Set(groupJobs.map(j => {
    const cat = String(j.category || "").trim();
    if (cat === "Ink/Stock") return "Ink Order";
    if (cat === "Returns") return "Cartridge Return";
    return String(j.product || "").trim();
  }).filter(Boolean))];
  const productStr = products.length > 1 ? products.join(", ") : (products[0] || "");
  const msgLines = [
    `Hi ${custName},`,
    ``,
    `Thank you for your order at Ink Station Glengarry!`,
    ``,
    `Your order number is ${orderNo}${productStr ? ` (${productStr})` : ""}.`,
    ``,
    `We will notify you as soon as your order is ready for collection.`,
    ``,
    `Should you have any questions in the meantime, please don't hesitate to contact us.`,
    ``,
    `Warm regards,`,
    `Ink Station Glengarry`,
    `021 981 3673`,
  ];
  const msg = msgLines.join("\n");
  const phone = String(job.customerPhone || "").trim();
  const email = String(job.customerEmail || "").trim();
  let waUrl = null, emailUrl = null;
  if (phone) {
    const digits = phone.replace(/\D/g, "").replace(/^0/, "27");
    waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
  }
  if (email) {
    const subject = encodeURIComponent(`Your order ${orderNo} — Ink Station Glengarry`);
    emailUrl = `https://mail.google.com/mail/?authuser=isglengarry@gmail.com&view=cm&fs=1&to=${encodeURIComponent(email)}&su=${subject}&body=${encodeURIComponent(msg)}`;
  }
  const hasContact = waUrl || emailUrl;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "ocm-modal";
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-title">Send order confirmation?</div>
      <div class="modal-body">
        <p>Order <strong>${escapeHtml(orderNo)}</strong> — ${escapeHtml(custName)}</p>
        <p style="margin-top:10px;font-size:13px;background:#f8fafc;border-radius:6px;padding:10px;line-height:1.5;color:#334155;">${escapeHtml(msg)}</p>
        ${!hasContact ? `<p style="margin-top:8px;font-size:12px;color:var(--muted);">No phone or email on file — add contact details to send a notification.</p>` : ""}
      </div>
      <div class="modal-actions ocm-actions">
        ${waUrl    ? `<button id="ocm-wa" class="rfc-btn-wa" style="width:100%">WhatsApp ${escapeHtml(phone)}</button>` : ""}
        ${emailUrl ? `<button id="ocm-email" class="rfc-btn-email" style="width:100%">Email ${escapeHtml(email)}</button>` : ""}
      </div>
      <div style="text-align:center;margin-top:10px">
        <button class="secondary" id="ocm-skip" style="font-size:12px;padding:4px 12px">Skip</button>
      </div>
      ${emailUrl ? `<p style="font-size:11px;color:var(--muted);text-align:center;margin-top:8px;">Sends from: isglengarry@gmail.com</p>` : ""}
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#ocm-skip").onclick = () => overlay.remove();
  if (waUrl) overlay.querySelector("#ocm-wa").onclick = () => {
    overlay.remove();
    addCommLogEntry_(job, "WhatsApp", "Order confirmation sent");
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };
  if (emailUrl) overlay.querySelector("#ocm-email").onclick = () => {
    overlay.remove();
    addCommLogEntry_(job, "Email", "Order confirmation sent");
    window.open(emailUrl, "_blank", "noopener,noreferrer");
  };
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}

function renderAlerts() {
  const wrap = document.createElement("section");
  wrap.className = "panel";
  wrap.innerHTML = `
    <div class="actions" style="margin-bottom:8px;">
      <span class="save-msg" style="font-weight:600;">Showing: Critical + Warning</span>
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;">
        <input id="alerts-include-info" type="checkbox" />
        Include Info
      </label>
    </div>
  `;
  const table = document.createElement("table");
  table.innerHTML = "<thead><tr><th>Type</th><th>Job #</th><th>Customer</th><th>Status</th></tr></thead><tbody></tbody>";
  const body = table.querySelector("tbody");
  const includeInfoToggle = wrap.querySelector("#alerts-include-info");
  const renderRows = () => {
    const includeInfo = !!includeInfoToggle.checked;
    body.innerHTML = "";
    state.jobs.filter(j => {
      if (isSoftDeleted_(j)) return false;
      const supplier = String(j.supplier || "").toUpperCase();
      const tvrWatch = supplier.startsWith("TVR");
      const critical = !!(j.promiseRisk || j.blocked);
      const warning = !!tvrWatch;
      const info = !!j.urgent;
      return critical || warning || (includeInfo && info);
    }).forEach(j => {
      const tr = document.createElement("tr");
      const supplier = String(j.supplier || "").toUpperCase();
      const tvrWatch = supplier.startsWith("TVR");
      const type = j.promiseRisk
        ? "PROMISE RISK (Critical)"
        : (j.blocked
          ? "BLOCKED (Critical)"
          : (tvrWatch
            ? "TVR WATCH (Warning)"
            : "URGENT REQUEST (Info)"));
      tr.innerHTML = `<td>${type}</td><td>${j.jobNo}</td><td>${j.customer}</td><td>${j.status}</td>`;
      body.appendChild(tr);
    });
  };
  includeInfoToggle.onchange = renderRows;
  renderRows();
  wrap.appendChild(table);
  return wrap;
}

function normalizeModelKey_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_/]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function modelCanonicalKey_(value) {
  const raw = String(value || "").toUpperCase();
  if (!raw) return "";
  const codeTokens = extractCodeTokens_(raw).map(normalizeCodeKey_).filter(Boolean);
  if (codeTokens.length) {
    const best = codeTokens.sort((a, b) => b.length - a.length)[0];
    if (best) return best;
  }
  const tokens = extractModelTokens_(raw).map(normalizeCodeKey_).filter(Boolean);
  if (tokens.length) return tokens.sort((a, b) => b.length - a.length)[0];
  return normalizeCodeKey_(normalizeModelKey_(raw));
}

function extractModelTokens_(value) {
  const s = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ");
  const m = s.match(/\b[A-Z]{1,8}\d{3,6}[A-Z]?\b/g);
  return m || [];
}

function modelFamilyKey_(token) {
  const t = String(token || "").toUpperCase();
  const m = t.match(/^([A-Z]{1,8})(\d{3,6})/);
  if (!m) return "";
  const prefix = m[1];
  const digits = m[2].slice(0, 3);
  return `${prefix}${digits}`;
}

function modelFamilyKeysFromText_(value) {
  const out = new Set();
  extractModelTokens_(value).forEach((tok) => {
    const upper = String(tok || "").toUpperCase();
    const m = upper.match(/^([A-Z]{1,8})(\d{3,6})/);
    if (!m) return;
    const prefix = m[1];
    const digits = m[2];
    if (digits.length >= 3) out.add(`${prefix}${digits.slice(0, 3)}`);
    if (digits.length >= 4) out.add(`${prefix}${digits.slice(0, 4)}`);
  });
  return Array.from(out);
}

function isTrustedSourceUrl_(url) {
  const u = String(url || "").trim();
  if (!u) return false;
  try {
    const host = new URL(u).hostname.toLowerCase();
    return TRUSTED_SOURCE_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`));
  } catch (_err) {
    return false;
  }
}

function findConsumableMatches_(query, recordsInput) {
  const records = Array.isArray(recordsInput) && recordsInput.length ? recordsInput : getCompatibilityRecords_();
  const q = normalizeModelKey_(query);
  if (!q) return [];
  const exact = records.filter((record) => {
    if (!record || !record.printerModel) return false;
    const model = normalizeModelKey_(record.printerModel);
    if (model === q || model.includes(q) || q.includes(model)) return true;
    const aliases = Array.isArray(record.aliases) ? record.aliases : [];
    return aliases.some((alias) => {
      const a = normalizeModelKey_(alias);
      return a === q || a.includes(q) || q.includes(a);
    });
  }).map((r) => ({ ...r, _matchLevel: "exact" }));
  if (exact.length) return exact;

  // Fallback: same model family (e.g. MG2541 -> MG2540) for better operator guidance.
  const qFamilies = new Set(modelFamilyKeysFromText_(query));
  if (!qFamilies.size) return [];
  return records.filter((record) => {
    if (!record || !record.printerModel) return false;
    const candidates = [record.printerModel].concat(Array.isArray(record.aliases) ? record.aliases : []);
    const fams = candidates.flatMap(v => modelFamilyKeysFromText_(v));
    return fams.some(f => qFamilies.has(f));
  }).map((r) => ({ ...r, _matchLevel: "family" }));
}

function derivePrinterMatchesFromInventory_(query, inventoryRows, recordsInput) {
  const records = Array.isArray(recordsInput) && recordsInput.length ? recordsInput : getCompatibilityRecords_();
  const rows = Array.isArray(inventoryRows) ? inventoryRows : [];
  const familyKeys = new Set();

  const addFamiliesFromText = (text) => {
    modelFamilyKeysFromText_(text).forEach((fam) => familyKeys.add(fam));
  };

  addFamiliesFromText(query);
  rows.forEach((row) => {
    const type = String(row && row.productType || "").toLowerCase();
    const name = String(row && row.name || "");
    if (!type.includes("printer") && !name.toLowerCase().includes("printer")) return;
    addFamiliesFromText(name);
    addFamiliesFromText(String(row && row.tag || ""));
  });

  if (!familyKeys.size) return [];

  const matches = records.filter((record) => {
    const candidates = [record.printerModel].concat(Array.isArray(record.aliases) ? record.aliases : []);
    const fams = candidates.flatMap(v => modelFamilyKeysFromText_(v));
    return fams.some(f => familyKeys.has(f));
  }).map((r) => ({ ...r, _matchLevel: "family", _derivedFromInventory: true }));

  const seen = new Set();
  const out = [];
  matches.forEach((m) => {
    const key = normalizeModelKey_(m.printerModel || "");
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(m);
  });
  return out;
}

function normalizeCodeKey_(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function ensureCartridgeIndexLoaded_() {
  if (state.cartridgeIndex) return state.cartridgeIndex;
  try {
    if (typeof window !== "undefined" && window.CARTRIDGE_INDEX && typeof window.CARTRIDGE_INDEX === "object") {
      state.cartridgeIndex = window.CARTRIDGE_INDEX;
      return state.cartridgeIndex;
    }
  } catch (_err) {
    // ignore and fallback to fetch
  }
  try {
    const res = await fetch("./cartridge_pairs_index.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    state.cartridgeIndex = payload && payload.by_code ? payload.by_code : {};
  } catch (_err) {
    state.cartridgeIndex = {};
  }
  return state.cartridgeIndex;
}

async function ensureCartridgeProductsLoaded_() {
  if (state.cartridgeProducts) return state.cartridgeProducts;
  try {
    const res = await fetch("./cartridge_products_extracted.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    state.cartridgeProducts = Array.isArray(payload) ? payload : [];
  } catch (_err) {
    state.cartridgeProducts = [];
  }
  return state.cartridgeProducts;
}

async function ensurePrinterMasterLoaded_() {
  if (state.printerMaster) return state.printerMaster;
  try {
    const res = await fetch("./printer_master_dataset.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const records = Array.isArray(payload && payload.records) ? payload.records : [];
    const manualRows = buildManualOverrideRows_();
    state.printerMaster = {
      sourceFile: String(payload && payload.sourceFile || ""),
      generatedAt: String(payload && payload.generatedAt || ""),
      count: Number(payload && payload.count || records.length || 0),
      cartridgeIndexByFamily: (payload && payload.cartridgeIndexByFamily && typeof payload.cartridgeIndexByFamily === "object")
        ? payload.cartridgeIndexByFamily
        : {},
      records: mergePrinterMasterRows_((records || []).concat(manualRows)),
    };
  } catch (_err) {
    state.printerMaster = {
      sourceFile: "",
      generatedAt: "",
      count: 0,
      cartridgeIndexByFamily: {},
      records: mergePrinterMasterRows_(buildManualOverrideRows_()),
    };
  }
  return state.printerMaster;
}

function parseCsvRows_(text) {
  const src = String(text || "");
  if (!src.trim()) return [];
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    const next = src[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((x) => String(x || "").trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((x) => String(x || "").trim())) rows.push(row);
  if (!rows.length) return [];

  const headers = rows[0].map((h) => String(h || "").trim());
  return rows.slice(1).map((vals) => {
    const obj = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      obj[h] = String(vals[idx] || "").trim();
    });
    return obj;
  }).filter((o) => Object.values(o).some((v) => String(v || "").trim()));
}

function toCatalogRecord_(row) {
  const brand = String(row && row.brand || "").trim();
  const modelName = String(row && row.model_name || "").trim();
  const modelCode = String(row && row.model_code || "").trim();
  const sourceSite = String(row && row.source_site || "").trim();
  const sourceUrl = String(row && row.source_url || "").trim();
  if (!modelName) return null;
  const aliases = dedupeStrings_([
    modelName,
    modelCode,
    brand ? `${brand} ${modelName}` : "",
    brand ? `${brand} ${modelCode}` : "",
  ].filter(Boolean));
  return {
    brand,
    printerModel: modelName,
    printerNormalized: normalizeCodeKey_(modelName),
    aliases,
    consumables: [],
    cartridgeCodes: [],
    cartridgeText: "",
    cartridgeType: "",
    printerType: String(row && row.printer_type || "").trim(),
    approxYear: "",
    notes: `Catalog source: ${sourceSite || "Retail catalog"}`,
    sourceName: sourceSite,
    sourceUrl,
  };
}

async function ensurePrinterCatalogLoaded_() {
  if (state.printerCatalog) return state.printerCatalog;
  const fileNames = ["./data/printer_catalog_sa.csv", "./data/printer_catalog_computermania.csv"];
  const merged = [];
  for (const fileName of fileNames) {
    try {
      const res = await fetch(fileName);
      if (!res.ok) continue;
      const txt = await res.text();
      const rows = parseCsvRows_(txt);
      rows.forEach((row) => {
        const rec = toCatalogRecord_(row);
        if (rec) merged.push(rec);
      });
    } catch (_err) {
      // ignore missing catalog files
    }
  }
  state.printerCatalog = merged;
  return state.printerCatalog;
}

function toMapConsumable_(row) {
  const cartridge = String(row && row.consumable_code || "").trim();
  const family = String(row && row.consumable_family || cartridge).trim();
  if (!cartridge && !family) return null;
  return {
    Cartridge: cartridge || family,
    Cartridge_Normalized: family || cartridge,
    Cartridge_Family: family || cartridge,
    Type: String(row && row.consumable_type || "").trim(),
    Color: String(row && row.color || "").trim(),
    Supplier_Compatible_SKUs: [],
    Supplier_Compatible_Count: 0,
  };
}

async function ensurePrinterConsumableMapLoaded_() {
  if (state.printerConsumableMap) return state.printerConsumableMap;
  const out = {};
  try {
    const res = await fetch("./data/printer_consumable_map.csv");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = await res.text();
    const rows = parseCsvRows_(txt);
    rows.forEach((row) => {
      const model = String(row && row.model_name || "").trim();
      const modelCode = String(row && row.model_code || "").trim();
      const brand = String(row && row.brand || "").trim();
      const keyMain = normalizeModelKey_(model);
      const keyAlt = normalizeModelKey_(modelCode);
      const cons = toMapConsumable_(row);
      if (!cons) return;
      [keyMain, keyAlt].filter(Boolean).forEach((k) => {
        if (!out[k]) {
          out[k] = {
            brand,
            model,
            modelCode,
            consumables: [],
          };
        }
        out[k].consumables.push(cons);
      });
    });
  } catch (_err) {
    // Keep empty map when missing.
  }
  state.printerConsumableMap = out;
  return state.printerConsumableMap;
}

function mergeFinderRecordsWithMap_(records, mapIndex) {
  const map = mapIndex && typeof mapIndex === "object" ? mapIndex : {};
  return (Array.isArray(records) ? records : []).map((record) => {
    const keyModel = normalizeModelKey_(record && record.printerModel || "");
    const keyNorm = normalizeModelKey_(record && record.printerNormalized || "");
    const mapped = map[keyModel] || map[keyNorm] || null;
    if (!mapped) return record;
    const existing = Array.isArray(record && record.consumables) ? record.consumables : [];
    const mappedList = Array.isArray(mapped && mapped.consumables) ? mapped.consumables : [];
    const baseConsumables = mappedList.length ? mappedList : existing;
    const mergedConsumables = dedupeObjectsByKey_(
      baseConsumables,
      (c) => normalizeCodeKey_(`${c && c.Cartridge_Family || ""}|${c && c.Cartridge || ""}|${c && c.Type || ""}|${c && c.Color || ""}`)
    );
    const mappedCodes = dedupeStrings_(
      mergedConsumables.flatMap((c) => [c && c.Cartridge, c && c.Cartridge_Normalized, c && c.Cartridge_Family]).filter(Boolean)
    );
    return {
      ...record,
      brand: String(record && record.brand || mapped.brand || "").trim(),
      consumables: mergedConsumables,
      cartridgeCodes: dedupeStrings_((Array.isArray(record && record.cartridgeCodes) ? record.cartridgeCodes : []).concat(mappedCodes)),
      cartridgeText: String(record && record.cartridgeText || mappedCodes.join(" / ")).trim(),
    };
  });
}

function mergeFinderSearchRecords_(masterRecords, catalogRecords) {
  const out = new Map();
  const upsert = (record) => {
    const model = String(record && record.printerModel || "").trim();
    if (!model) return;
    const brand = String(record && record.brand || "").trim();
    const key = `${normalizeModelKey_(brand)}|${normalizeModelKey_(model)}`;
    if (!out.has(key)) {
      out.set(key, {
        ...record,
        aliases: dedupeStrings_(Array.isArray(record && record.aliases) ? record.aliases : [model]),
        consumables: Array.isArray(record && record.consumables) ? record.consumables.slice() : [],
        cartridgeCodes: dedupeStrings_(Array.isArray(record && record.cartridgeCodes) ? record.cartridgeCodes : []),
      });
      return;
    }
    const existing = out.get(key);
    existing.aliases = dedupeStrings_((existing.aliases || []).concat(Array.isArray(record && record.aliases) ? record.aliases : []));
    existing.cartridgeCodes = dedupeStrings_((existing.cartridgeCodes || []).concat(Array.isArray(record && record.cartridgeCodes) ? record.cartridgeCodes : []));
    if (!existing.printerType) existing.printerType = String(record && record.printerType || "").trim();
    if (!existing.sourceName) existing.sourceName = String(record && record.sourceName || "").trim();
    if (!existing.sourceUrl) existing.sourceUrl = String(record && record.sourceUrl || "").trim();
    const extraConsumables = Array.isArray(record && record.consumables) ? record.consumables : [];
    if (extraConsumables.length) existing.consumables = (existing.consumables || []).concat(extraConsumables);
    if (!existing.notes) existing.notes = String(record && record.notes || "").trim();
  };
  (Array.isArray(masterRecords) ? masterRecords : []).forEach(upsert);
  (Array.isArray(catalogRecords) ? catalogRecords : []).forEach(upsert);
  return Array.from(out.values());
}

function dedupeObjectsByKey_(list, keyFn) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((item) => {
    const key = String(keyFn ? keyFn(item) : "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

function buildManualOverrideRows_() {
  return MANUAL_PRINTER_OVERRIDES.map((row) => {
    const printerModel = String(row && row.printerModel || "").trim();
    const brand = String(row && row.brand || "").trim();
    const printerNormalized = normalizeCodeKey_(printerModel);
    const aliases = dedupeStrings_(
      (Array.isArray(row && row.aliases) ? row.aliases : [])
        .concat([printerModel, printerNormalized, brand ? `${brand} ${printerModel}` : ""])
        .filter(Boolean)
    );
    const consumables = (Array.isArray(row && row.consumables) ? row.consumables : []).map((c) => {
      const skus = dedupeStrings_(Array.isArray(c && c.Supplier_Compatible_SKUs) ? c.Supplier_Compatible_SKUs : []);
      return {
        Cartridge: String(c && c.Cartridge || "").trim(),
        Cartridge_Normalized: String(c && c.Cartridge_Normalized || c && c.Cartridge_Family || c && c.Cartridge || "").trim(),
        Cartridge_Family: String(c && c.Cartridge_Family || c && c.Cartridge_Normalized || c && c.Cartridge || "").trim(),
        Type: String(c && c.Type || "INK").trim(),
        Color: String(c && c.Color || "").trim(),
        Supplier_Compatible_SKUs: skus,
        Supplier_Compatible_Count: skus.length,
      };
    });
    const cartridgeCodes = dedupeStrings_(
      consumables.flatMap((c) => [c.Cartridge_Family, c.Cartridge_Normalized, c.Cartridge]).filter(Boolean)
    );
    return {
      brand,
      printerModel,
      printerNormalized,
      aliases,
      consumables,
      cartridgeCodes,
      cartridgeText: dedupeStrings_(consumables.map((c) => c.Cartridge).filter(Boolean)).join(" | "),
      cartridgeType: "INK",
      printerType: String(row && row.printerType || "").trim(),
      approxYear: String(row && row.approxYear || "").trim(),
      notes: String(row && row.notes || "").trim(),
      source: "manual_override",
    };
  }).filter((r) => r.printerModel);
}

function mergePrinterMasterRows_(rows) {
  const out = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const printerModel = String(row && row.printerModel || "").trim();
    if (!printerModel) return;
    const key = normalizeModelKey_(printerModel);
    if (!key) return;
    const prev = out.get(key) || {
      brand: String(row && row.brand || "").trim(),
      printerModel,
      aliases: [],
      cartridgeCodes: [],
      cartridgeText: [],
      cartridgeType: String(row && row.cartridgeType || "").trim(),
      printerType: String(row && row.printerType || "").trim(),
      approxYear: String(row && row.approxYear || "").trim(),
    };
    prev.aliases = dedupeStrings_((prev.aliases || []).concat(Array.isArray(row && row.aliases) ? row.aliases : []));
    prev.cartridgeCodes = dedupeStrings_((prev.cartridgeCodes || []).concat(Array.isArray(row && row.cartridgeCodes) ? row.cartridgeCodes : []));
    const cartText = String(row && row.cartridgeText || "").trim();
    if (cartText) prev.cartridgeText = dedupeStrings_((prev.cartridgeText || []).concat([cartText]));
    if (!prev.brand) prev.brand = String(row && row.brand || "").trim();
    if (!prev.cartridgeType) prev.cartridgeType = String(row && row.cartridgeType || "").trim();
    if (!prev.printerType) prev.printerType = String(row && row.printerType || "").trim();
    if (!prev.approxYear) prev.approxYear = String(row && row.approxYear || "").trim();
    out.set(key, prev);
  });
  return Array.from(out.values());
}

function findMasterPrinterMatches_(query, masterRows) {
  const qRaw = String(query || "").trim();
  const qModel = normalizeModelKey_(qRaw);
  const qCode = normalizeCodeKey_(qRaw);
  if (!qModel && !qCode) return [];
  const brandMatch = String(qRaw.match(/\b(canon|hp|epson|brother|samsung|xerox|kyocera|ricoh|lexmark|oki)\b/i)?.[1] || "").toLowerCase();
  const numberTokens = String(qRaw).toUpperCase().match(/\b\d{3,6}\b/g) || [];

  const rows = Array.isArray(masterRows) ? masterRows : [];
  const results = [];
  rows.forEach((row) => {
    const rowBrand = String(row.brand || "").trim().toLowerCase();
    if (brandMatch && rowBrand !== brandMatch) return;
    const modelCandidates = [row.printerModel].concat(Array.isArray(row.aliases) ? row.aliases : []);
    const exactModelMatch = modelCandidates.some((candidate) => normalizeModelKey_(candidate) === qModel);
    const modelHit = modelCandidates.some((candidate) => {
      const c = normalizeModelKey_(candidate);
      return c && (c.includes(qModel) || qModel.includes(c));
    });
    const modelHasNumberHit = numberTokens.length
      ? modelCandidates.some((candidate) => {
          const up = String(candidate || "").toUpperCase();
          return numberTokens.some((n) => up.includes(n));
        })
      : false;
    const codeCandidates = dedupeStrings_(
      (Array.isArray(row.cartridgeCodes) ? row.cartridgeCodes : [])
        .concat(extractConsumableCodesFromText_(String((row.cartridgeText || []).join(" "))))
    );
    const codeHit = codeCandidates.some((code) => {
      const c = normalizeCodeKey_(code);
      return c && qCode && (c.includes(qCode) || qCode.includes(c));
    });
    const textHit = normalizeModelKey_(String((row.cartridgeText || []).join(" "))).includes(qModel);
    if (!(modelHit || codeHit || textHit || modelHasNumberHit)) return;

    let score = 0;
    if (modelHit) score += 3;
    if (codeHit) score += 2;
    if (textHit) score += 1;
    if (modelHasNumberHit) score += 2;
    if (brandMatch && rowBrand === brandMatch) score += 2;
    if (exactModelMatch || normalizeModelKey_(row.printerModel) === qModel) score += 5;
    if (numberTokens.length && !modelHasNumberHit) score -= 2;
    results.push({
      ...row,
      _score: score,
      _match: exactModelMatch ? "Exact printer match" : (modelHit ? "Printer match" : (codeHit ? "Code match" : "Text match")),
      _codes: codeCandidates,
    });
  });

  results.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return String(a.printerModel || "").localeCompare(String(b.printerModel || ""));
  });
  if (!results.length) return [];
  const topScore = results[0]._score || 0;
  const narrowed = results.filter((r) => (r._score || 0) >= (topScore - 2));
  return narrowed.slice(0, 40);
}

function trinkCodesForPrinter_(printerModel, trinkLookup) {
  const lookup = trinkLookup || { modelEntries: [] };
  const entries = Array.isArray(lookup.modelEntries) ? lookup.modelEntries : [];
  const pm = normalizeModelKey_(printerModel);
  if (!pm) return [];
  const exact = entries.find((e) => normalizeModelKey_(e.printerModel) === pm);
  if (exact && Array.isArray(exact.cartridges) && exact.cartridges.length) {
    return dedupeStrings_(exact.cartridges);
  }
  const near = entries.filter((e) => {
    const ek = normalizeModelKey_(e.printerModel);
    return ek && (ek.includes(pm) || pm.includes(ek));
  });
  const merged = dedupeStrings_(near.flatMap((e) => Array.isArray(e.cartridges) ? e.cartridges : []));
  return merged.slice(0, 24);
}

async function ensureCompatibilityMasterLoaded_() {
  if (state.compatibilityMaster) return state.compatibilityMaster;
  try {
    const res = await fetch("./compatibility_master.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    if (Array.isArray(payload)) {
      state.compatibilityMaster = payload.filter((r) => r && r.printerModel);
    } else {
      state.compatibilityMaster = [];
    }
  } catch (_err) {
    state.compatibilityMaster = [];
  }
  return state.compatibilityMaster;
}

async function ensureTrinkLookupLoaded_() {
  if (state.trinkLookup) return state.trinkLookup;
  try {
    const res = await fetch("./trink_compatibility_index.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    state.trinkLookup = buildTrinkLookup_(payload);
  } catch (_err) {
    state.trinkLookup = {
      modelEntries: [],
      byModelKey: {},
      byCodeKey: {},
      items: [],
      generatedAt: "",
      sourceFile: "",
    };
  }
  return state.trinkLookup;
}

function normalizeLooseKey_(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function prettyCode_(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (/^[A-Z]{2,4}\d{2,5}[A-Z]{0,3}$/.test(raw)) {
    const m = raw.match(/^([A-Z]{2,4})(\d{2,5}[A-Z]{0,3})$/);
    if (m) return `${m[1]}-${m[2]}`;
  }
  return raw;
}

function extractConsumableCodesFromText_(text) {
  const src = String(text || "").toUpperCase();
  if (!src) return [];
  const tokens = src.match(/\b[A-Z]{1,6}[- ]?\d{2,6}[A-Z]{0,4}\b/g) || [];
  const out = [];
  const seen = new Set();
  tokens.forEach((token) => {
    const key = normalizeLooseKey_(token);
    if (!key) return;
    if (key.length < 4) return;
    if (/^\d+$/.test(key)) return;
    // Skip obvious printer model tokens to reduce noise.
    if (/^(MG|TR|TS|IP|L|MFC|DCP|HL|ECOSYS|WORKCENTRE|DESKJET|OFFICEJET|ENVY)\d{3,6}/.test(key)) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(prettyCode_(key));
  });
  return out;
}

function extractPrinterModelsFromText_(text) {
  const src = String(text || "").toUpperCase();
  if (!src) return [];
  const out = [];
  const seen = new Set();
  const push = (value) => {
    const cleaned = String(value || "").trim().replace(/\s+/g, " ");
    const key = normalizeLooseKey_(cleaned);
    if (!cleaned || !key) return;
    if (key.length < 4) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(cleaned);
  };

  // Compact model tokens: MG2540, M2635DN, P2235DN, etc.
  const compact = src.match(/\b[A-Z]{1,8}[- ]?\d{3,6}[A-Z]{0,4}\b/g) || [];
  compact.forEach(push);

  // Brand + number tokens: Deskjet 2320, Officejet 6950, etc.
  const branded = src.match(/\b(?:DESKJET|OFFICEJET|LASERJET|PIXMA|ECOSYS|WORKCENTRE|PHOTOSMART|ENVY|I-SENSYS|SENSYS)\s+[A-Z0-9-]{3,12}\b/g) || [];
  branded.forEach(push);

  return out;
}

function skuFamilyKey_(sku) {
  let s = normalizeLooseKey_(sku);
  if (!s) return "";
  s = s
    .replace(/(BLACK|BLK|BK|COLOUR|COLOR|CYAN|MAGENTA|YELLOW)$/g, "")
    .replace(/[CMYK]$/g, "");
  return s;
}

function buildTrinkLookup_(payload) {
  const items = Array.isArray(payload && payload.items) ? payload.items : [];
  const byModelKey = {};
  const byCodeKey = {};
  const modelEntriesMap = {};
  const skuFamilies = {};

  items.forEach((item) => {
    const sku = String(item && item.sku || "").trim();
    if (!sku) return;
    const family = skuFamilyKey_(sku);
    if (!family) return;
    if (!skuFamilies[family]) skuFamilies[family] = [];
    skuFamilies[family].push(item);
  });

  const pushCode = (code, model) => {
    const key = normalizeLooseKey_(code);
    if (!key) return;
    if (!byCodeKey[key]) byCodeKey[key] = new Set();
    byCodeKey[key].add(model);
  };

  items.forEach((item) => {
    const sku = String(item && item.sku || "").trim();
    const family = skuFamilyKey_(sku);
    const siblingRows = family && skuFamilies[family] ? skuFamilies[family] : [item];

    const codes = dedupeStrings_(
      siblingRows.flatMap((row) => extractConsumableCodesFromText_(
        [
          row && row.oemCode,
          row && row.compatibilityText,
          row && row.sku,
        ].join(" ")
      ))
    );
    if (!codes.length) return;

    const modelText = [
      item && item.priceExVat,
      item && item.rowText,
      item && item.compatibilityText,
    ].join(" ");
    const models = extractPrinterModelsFromText_(modelText);
    models.forEach((model) => {
      const modelKey = normalizeLooseKey_(model);
      if (!modelKey) return;
      if (!modelEntriesMap[modelKey]) {
        modelEntriesMap[modelKey] = {
          printerModel: model,
          cartridges: [],
          sourceName: "Trink Supplier List",
          sourceUrl: "",
          verifiedOn: "",
          notes: "Auto-mapped from Trink compatibility workbook.",
        };
      }
      modelEntriesMap[modelKey].cartridges = dedupeStrings_(
        modelEntriesMap[modelKey].cartridges.concat(codes)
      );
      modelEntriesMap[modelKey].verifiedOn = String(payload && payload.generatedAt || "").slice(0, 10);
      modelEntriesMap[modelKey].sourceFile = String(payload && payload.sourceFile || "");

      if (!byModelKey[modelKey]) byModelKey[modelKey] = new Set();
      codes.forEach((code) => {
        byModelKey[modelKey].add(code);
        pushCode(code, modelEntriesMap[modelKey].printerModel);
      });
    });
  });

  const modelEntries = Object.values(modelEntriesMap).sort((a, b) =>
    String(a.printerModel || "").localeCompare(String(b.printerModel || ""))
  );
  const byModelKeyArr = {};
  Object.keys(byModelKey).forEach((k) => { byModelKeyArr[k] = Array.from(byModelKey[k]); });
  const byCodeKeyArr = {};
  Object.keys(byCodeKey).forEach((k) => { byCodeKeyArr[k] = Array.from(byCodeKey[k]); });

  return {
    modelEntries,
    byModelKey: byModelKeyArr,
    byCodeKey: byCodeKeyArr,
    items,
    generatedAt: String(payload && payload.generatedAt || ""),
    sourceFile: String(payload && payload.sourceFile || ""),
  };
}

function findTrinkPrinterMatches_(query, trinkLookup) {
  const lookup = trinkLookup || { modelEntries: [] };
  const q = normalizeLooseKey_(query);
  if (!q) return [];
  const entries = Array.isArray(lookup.modelEntries) ? lookup.modelEntries : [];
  let hits = entries.filter((entry) => {
    const mk = normalizeLooseKey_(entry.printerModel);
    return mk === q || mk.includes(q) || q.includes(mk);
  });

  if (!hits.length) {
    // Family fallback: MG2541 -> MG2540 etc.
    const fam = String(q.match(/^([A-Z]{1,8}\d{3,4})/)?.[1] || "");
    if (fam) {
      hits = entries.filter((entry) => normalizeLooseKey_(entry.printerModel).startsWith(fam));
    }
  }

  return hits.slice(0, 12).map((entry) => ({
    printerModel: entry.printerModel,
    aliases: [entry.printerModel],
    cartridges: dedupeStrings_(entry.cartridges || []),
    drum: [],
    waste: [],
    maintenance: [],
    sourceName: "Trink Supplier List",
    sourceUrl: "",
    verifiedOn: entry.verifiedOn || "",
    notes: entry.notes || "Auto-mapped from Trink workbook.",
    _matchLevel: "exact",
    _trink: true,
  }));
}

function findTrinkPrintersByCode_(queryCode, trinkLookup) {
  const lookup = trinkLookup || { byCodeKey: {} };
  const key = normalizeLooseKey_(queryCode);
  if (!key) return [];
  const out = new Set();
  Object.keys(lookup.byCodeKey || {}).forEach((codeKey) => {
    if (codeKey.includes(key) || key.includes(codeKey)) {
      (lookup.byCodeKey[codeKey] || []).forEach((model) => out.add(model));
    }
  });
  return Array.from(out).slice(0, 20).map((model) => ({ printerModel: model }));
}

function toStringArray_(value) {
  if (Array.isArray(value)) return value.map(v => String(v || "").trim()).filter(Boolean);
  if (value === null || value === undefined) return [];
  return [String(value).trim()].filter(Boolean);
}

function splitCodesInput_(value) {
  return dedupeStrings_(
    String(value || "")
      .split(/[\n,;|]/g)
      .map(v => String(v || "").trim())
      .filter(Boolean)
  );
}

function normalizeFinderRecord_(record) {
  const printerModel = String(record && record.printerModel || "").trim();
  if (!printerModel) return null;
  return {
    printerModel,
    aliases: dedupeStrings_(toStringArray_(record && record.aliases).concat([printerModel])),
    cartridges: dedupeStrings_(toStringArray_(record && record.cartridges)),
    drum: dedupeStrings_(toStringArray_(record && record.drum)),
    waste: dedupeStrings_(toStringArray_(record && record.waste)),
    maintenance: dedupeStrings_(toStringArray_(record && record.maintenance)),
    sourceName: String(record && record.sourceName || "").trim() || "Manual Mapping",
    sourceUrl: String(record && record.sourceUrl || "").trim(),
    verifiedOn: String(record && record.verifiedOn || "").trim() || new Date().toISOString().slice(0, 10),
    notes: String(record && record.notes || "").trim() || "Added by staff from trusted source.",
  };
}

function loadFinderLocalMappings_() {
  try {
    const raw = window.localStorage.getItem(FINDER_LOCAL_MAP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeFinderRecord_)
      .filter(Boolean);
  } catch (_err) {
    return [];
  }
}

function saveFinderLocalMappings_(records) {
  try {
    window.localStorage.setItem(FINDER_LOCAL_MAP_KEY, JSON.stringify(records || []));
    return true;
  } catch (_err) {
    return false;
  }
}

function upsertFinderLocalMapping_(record) {
  const normalized = normalizeFinderRecord_(record);
  if (!normalized) return { ok: false, error: "Printer model is required." };
  const current = loadFinderLocalMappings_();
  const key = normalizeModelKey_(normalized.printerModel);
  const next = current.filter((r) => normalizeModelKey_(r.printerModel) !== key);
  next.unshift(normalized);
  if (!saveFinderLocalMappings_(next)) {
    return { ok: false, error: "Could not save mapping in browser storage." };
  }
  return { ok: true, record: normalized };
}

function mergeCompatibilityRecords_(baseRecords, localRecords) {
  const base = Array.isArray(baseRecords) ? baseRecords : [];
  const local = Array.isArray(localRecords) ? localRecords : [];
  const out = [];
  const seen = new Set();

  local.forEach((r) => {
    const nr = normalizeFinderRecord_(r);
    if (!nr) return;
    const key = normalizeModelKey_(nr.printerModel);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(nr);
  });

  base.forEach((r) => {
    const nr = normalizeFinderRecord_(r);
    if (!nr) return;
    const key = normalizeModelKey_(nr.printerModel);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(nr);
  });

  return out;
}

function getTrustedSearchLinks_(query) {
  const q = encodeURIComponent(String(query || "").trim());
  return [
    {
      label: "Printerland lookup",
      url: `https://www.google.com/search?q=site:printerland.co.za+${q}+cartridge+toner`,
    },
    {
      label: "HP support lookup",
      url: `https://www.google.com/search?q=site:support.hp.com+${q}+cartridge`,
    },
    {
      label: "Canon support lookup",
      url: `https://www.google.com/search?q=site:canon.co.za+${q}+cartridge`,
    },
    {
      label: "Incredible search",
      url: `https://www.google.com/search?q=site:incredible.co.za+${q}+cartridge`,
    },
    {
      label: "HiFi Corp search",
      url: `https://www.google.com/search?q=site:hificorp.co.za+${q}+cartridge`,
    },
  ];
}

async function lookupTrustedConsumables_(query) {
  const q = String(query || "").trim();
  if (!q) return null;
  try {
    const res = await fetch(API.baseUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "lookupConsumables",
        key: API.key,
        query: q,
      }),
    });
    const payload = await res.json();
    if (!payload || !payload.ok) return null;
    return payload.data || null;
  } catch (_err) {
    return null;
  }
}

function dedupePrinterMatches_(rows) {
  const seen = new Set();
  const out = [];
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    const key = normalizeModelKey_(r && r.printerModel ? r.printerModel : "");
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(r);
  });
  return out;
}

function renderFinderCapturePanel_(query, onSaved, autoLookup) {
  const box = document.createElement("section");
  box.className = "finder-capture";
  const links = getTrustedSearchLinks_(query);
  const autoCodes = dedupeStrings_(Array.isArray(autoLookup && autoLookup.consumables) ? autoLookup.consumables : []);
  const autoSourceUrl = String(autoLookup && autoLookup.searchUrl || "").trim();
  const autoSourceName = String(autoLookup && autoLookup.source || "Printerland").trim();
  const autoNotes = String(autoLookup && autoLookup.notes || "").trim();
  const autoCandidates = dedupeStrings_(Array.isArray(autoLookup && autoLookup.printerCandidates) ? autoLookup.printerCandidates : []);

  box.innerHTML = `
    <h4>No Verified Mapping Yet</h4>
    <div class="finder-note">Use a trusted source, then save the mapping below. Next searches will return instantly.</div>
    ${autoCodes.length ? `
      <div class="finder-auto-hint">
        <strong>Auto suggestion found:</strong> ${escapeHtml(autoCodes.join(", "))}
        ${autoNotes ? `<div class="finder-note">${escapeHtml(autoNotes)}</div>` : ""}
        ${autoCandidates.length ? `<div class="finder-note">Likely printers: ${escapeHtml(autoCandidates.slice(0, 4).join(" | "))}</div>` : ""}
      </div>
    ` : ""}
    <div class="finder-link-list">
      ${links.map((l) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>`).join("")}
    </div>
    <div class="finder-capture-grid">
      <div class="kv">
        <label>Printer model</label>
        <input id="finder-map-model" value="${escapeHtml(query)}" />
      </div>
      <div class="kv">
        <label>Source URL (trusted)</label>
        <input id="finder-map-source-url" placeholder="https://www.printerland.co.za/..." value="${escapeHtml(autoSourceUrl)}" />
      </div>
      <div class="kv">
        <label>Source name</label>
        <input id="finder-map-source-name" placeholder="Printerland" value="${escapeHtml(autoSourceName)}" />
      </div>
      <div class="kv">
        <label>Aliases (optional)</label>
        <input id="finder-map-aliases" placeholder="MG2541, Canon MG2541" />
      </div>
      <div class="kv">
        <label>Main cartridges / toners</label>
        <textarea id="finder-map-carts" rows="3" placeholder="PG-445, CL-446">${escapeHtml(autoCodes.join(", "))}</textarea>
      </div>
      <div class="kv">
        <label>Drum / imaging (optional)</label>
        <textarea id="finder-map-drum" rows="2" placeholder="DR-2405"></textarea>
      </div>
      <div class="kv">
        <label>Waste / maintenance (optional)</label>
        <textarea id="finder-map-waste" rows="2" placeholder="MC-G02"></textarea>
      </div>
      <div class="kv">
        <label>Notes (optional)</label>
        <textarea id="finder-map-notes" rows="2" placeholder="Any important note for staff">${escapeHtml(autoNotes)}</textarea>
      </div>
    </div>
    <div class="actions finder-capture-actions">
      <button id="finder-map-save" type="button">Save Mapping</button>
      <span id="finder-map-msg" class="save-msg"></span>
    </div>
  `;

  const saveBtn = box.querySelector("#finder-map-save");
  const msgEl = box.querySelector("#finder-map-msg");
  saveBtn.onclick = () => {
    const printerModel = String(box.querySelector("#finder-map-model").value || "").trim();
    const sourceUrl = String(box.querySelector("#finder-map-source-url").value || "").trim();
    const sourceNameInput = String(box.querySelector("#finder-map-source-name").value || "").trim();
    const aliases = splitCodesInput_(box.querySelector("#finder-map-aliases").value);
    const cartridges = splitCodesInput_(box.querySelector("#finder-map-carts").value);
    const drum = splitCodesInput_(box.querySelector("#finder-map-drum").value);
    const waste = splitCodesInput_(box.querySelector("#finder-map-waste").value);
    const notes = String(box.querySelector("#finder-map-notes").value || "").trim();

    if (!printerModel) {
      msgEl.textContent = "Printer model is required.";
      return;
    }
    if (!sourceUrl || !isTrustedSourceUrl_(sourceUrl)) {
      msgEl.textContent = "Use a trusted source URL (e.g. printerland.co.za, brand support).";
      return;
    }
    if (!cartridges.length && !drum.length && !waste.length) {
      msgEl.textContent = "Add at least one consumable code.";
      return;
    }

    const saved = upsertFinderLocalMapping_({
      printerModel,
      aliases,
      cartridges,
      drum,
      waste,
      maintenance: waste,
      sourceName: sourceNameInput || (new URL(sourceUrl)).hostname.replace(/^www\./, ""),
      sourceUrl,
      notes: notes || "Saved from trusted manual lookup.",
      verifiedOn: new Date().toISOString().slice(0, 10),
    });

    if (!saved.ok) {
      msgEl.textContent = saved.error || "Could not save mapping.";
      return;
    }

    msgEl.textContent = "Mapping saved. Re-running search...";
    if (typeof onSaved === "function") onSaved(saved.record);
  };

  return box;
}

function findCodeMatches_(query, indexByCode) {
  const q = normalizeCodeKey_(query);
  if (!q) return [];
  const idx = indexByCode || {};
  const out = [];
  Object.keys(idx).forEach((code) => {
    const key = normalizeCodeKey_(code);
    if (!key) return;
    if (key.includes(q) || (q.length >= 4 && q.includes(key))) {
      out.push({ code, data: idx[code] });
    }
  });
  out.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  return out.slice(0, 120);
}

function dedupeStrings_(values) {
  const seen = new Set();
  const out = [];
  (Array.isArray(values) ? values : []).forEach((v) => {
    const s = String(v || "").trim();
    if (!s) return;
    const k = s.toUpperCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(s);
  });
  return out;
}

function extractTagsFromProduct_(product) {
  return dedupeStrings_(String(product && product.tag || "").split(/[;,]/g));
}

function findInventoryNameMatches_(query, products) {
  const q = normalizeModelKey_(query);
  if (!q) return [];
  const out = [];
  (Array.isArray(products) ? products : []).forEach((item) => {
    const name = String(item && item.name || "").trim();
    if (!name) return;
    const nn = normalizeModelKey_(name);
    if (!nn) return;
    if (nn.includes(q) || q.includes(nn)) out.push(item);
  });

  // Deduplicate by name+sku so duplicate supplier rows do not flood results.
  const seen = new Set();
  const deduped = [];
  out.forEach((item) => {
    const name = String(item && item.name || "").trim();
    const sku = String(item && item.sku || "").trim();
    const key = `${name.toUpperCase()}|${sku.toUpperCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });

  deduped.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  return deduped.slice(0, 80);
}

function classifyInventoryRowByName_(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("compatible")) return "compatible";
  if (n.includes("original")) return "original";
  return "unknown";
}

function enrichCodeGroupsWithInventory_(groups, inventoryRows) {
  const out = Array.isArray(groups) ? groups.map(g => ({
    ...g,
    originals: Array.isArray(g.originals) ? g.originals.slice() : [],
    compatibles: Array.isArray(g.compatibles) ? g.compatibles.slice() : [],
  })) : [];

  const inv = Array.isArray(inventoryRows) ? inventoryRows : [];
  out.forEach((group) => {
    const famKey = normalizeCodeKey_(group.family);
    if (!famKey) return;
    inv.forEach((row) => {
      const tags = extractTagsFromProduct_(row).map(normalizeCodeKey_);
      const isTagMatch = tags.some(t => t === famKey || t.includes(famKey) || famKey.includes(t));
      if (!isTagMatch) return;
      const name = String(row && row.name || "").trim();
      if (!name) return;
      const payload = {
        name,
        sku: String(row && row.sku || ""),
        brand: String(row && row.brand || ""),
        supplier: String(row && row.supplier || ""),
        productType: String(row && row.productType || ""),
      };
      const kind = classifyInventoryRowByName_(name);
      if (kind === "original") group.originals.push(payload);
      if (kind === "compatible") group.compatibles.push(payload);
    });
    group.originals = dedupeProductList_(group.originals);
    group.compatibles = dedupeProductList_(group.compatibles);
  });
  return out;
}

function numericCoreFromCode_(code) {
  const raw = normalizeCodeKey_(code);
  const m = raw.match(/(\d{3,4})/);
  return m ? m[1] : "";
}

function productDedupeKey_(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/\b(ORIGINAL|COMPATIBLE)\b/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function dedupeProductList_(items) {
  const seen = new Set();
  const out = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    const name = String(item && item.name || "").trim();
    if (!name) return;
    const key = productDedupeKey_(name);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

function productNameListFromIndexByCodes_(codes, indexByCode, kind) {
  const out = [];
  const seen = new Set();
  const list = Array.isArray(codes) ? codes : [];
  list.forEach((code) => {
    const matches = Object.keys(indexByCode || {})
      .filter((k) => codesEquivalent_(k, code))
      .map((k) => ({ code: k, data: indexByCode[k] }));
    matches.forEach((m) => {
      const arr = kind === "original"
        ? (Array.isArray(m.data && m.data.originals) ? m.data.originals : [])
        : (Array.isArray(m.data && m.data.compatibles) ? m.data.compatibles : []);
      arr.forEach((item) => {
        const name = String(item && item.name || "").trim();
        if (!name) return;
        const key = productDedupeKey_(name);
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(name);
      });
    });
  });
  return out;
}

function splitInventoryByCodes_(codes, inventoryProducts) {
  const codeKeys = new Set((Array.isArray(codes) ? codes : []).map(normalizeCodeKey_).filter(Boolean));
  const originals = [];
  const compatibles = [];
  const seen = new Set();

  (Array.isArray(inventoryProducts) ? inventoryProducts : []).forEach((row) => {
    const tags = extractCodesFromInventoryRow_(row).map(normalizeCodeKey_);
    const hit = tags.some((t) => {
      if (!t) return false;
      return Array.from(codeKeys).some((k) => codesEquivalent_(t, k));
    });
    if (!hit) return;

    const name = String(row && row.name || "").trim();
    if (!name) return;
    const key = productDedupeKey_(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const kind = classifyInventoryRowByName_(name);
    if (kind === "original") originals.push(name);
    else if (kind === "compatible") compatibles.push(name);
  });

  return { originals, compatibles };
}

function renderNameLinesOrCodes_(names, fallbackCodes) {
  const rows = Array.isArray(names) ? names.filter(Boolean) : [];
  if (rows.length) return rows.slice(0, 8).map((n) => `<div>${escapeHtml(n)}</div>`).join("");
  const codes = Array.isArray(fallbackCodes) ? fallbackCodes.filter(Boolean) : [];
  if (!codes.length) return "<span class=\"muted\">None listed</span>";
  return renderConsumablesList_(codes);
}

function renderOriginalLines_(names, fallbackCodes) {
  const rows = Array.isArray(names) ? names.filter(Boolean) : [];
  if (rows.length) return rows.slice(0, 8).map((n) => `<div>${escapeHtml(n)}</div>`).join("");
  const codes = Array.isArray(fallbackCodes) ? fallbackCodes.filter(Boolean) : [];
  if (!codes.length) return "<span class=\"muted\">None listed</span>";
  return codes.slice(0, 12).map((code) => `<div>Original ${escapeHtml(code)}</div>`).join("");
}

function isGenericSupplierRow_(row) {
  const supplier = String((row && row.supplier) || "").toLowerCase();
  const name = String((row && row.name) || "").toLowerCase();
  // Some Hike exports have blank supplier for compatible items.
  // Treat explicit "Compatible ..." product names as generic rows too.
  return supplier.includes("trink") || name.includes("compatible");
}

function normalizeFamilyCode_(value) {
  return normalizeCodeKey_(value).replace(/(XXL|XL)$/g, "");
}

function codesEquivalent_(a, b) {
  const aa = normalizeCodeKey_(a);
  const bb = normalizeCodeKey_(b);
  if (!aa || !bb) return false;
  if (aa === bb) return true;
  return normalizeFamilyCode_(aa) === normalizeFamilyCode_(bb);
}

function extractCodesFromInventoryRow_(row) {
  const tags = extractTagsFromProduct_(row);
  const name = String(row && row.name || "").trim();
  const tagRaw = String(row && row.tag || "").trim();
  const fromText = extractConsumableCodesFromText_(`${name} ${tagRaw}`);
  return dedupeStrings_(tags.concat(fromText));
}

function compatibleNamesFromGenericSupplierByCodes_(codes, inventoryProducts, indexByCode) {
  const codeKeys = new Set((Array.isArray(codes) ? codes : []).map(normalizeCodeKey_).filter(Boolean));
  if (!codeKeys.size) return [];

  const out = [];
  const seen = new Set();

  const addName = (name) => {
    const s = String(name || "").trim();
    if (!s) return;
    const key = productDedupeKey_(s);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };

  (Array.isArray(inventoryProducts) ? inventoryProducts : []).forEach((row) => {
    if (!isGenericSupplierRow_(row)) return;
    const tags = extractCodesFromInventoryRow_(row).map(normalizeCodeKey_);
    const hit = tags.some((t) => {
      if (!t) return false;
      return Array.from(codeKeys).some((k) => codesEquivalent_(t, k));
    });
    if (!hit) return;
    addName(row && row.name);
  });

  Object.keys(indexByCode || {}).forEach((code) => {
    const codeHit = Array.from(codeKeys).some((k) => codesEquivalent_(code, k));
    if (!codeHit) return;
    const compatibles = Array.isArray(indexByCode[code] && indexByCode[code].compatibles)
      ? indexByCode[code].compatibles
      : [];
    compatibles.forEach((item) => {
      if (!isGenericSupplierRow_(item)) return;
      addName(item && item.name);
    });
  });

  return out;
}

function compatibleNamesFromTrinkByCodes_(codes, trinkLookup) {
  const codeKeys = new Set((Array.isArray(codes) ? codes : []).map(normalizeCodeKey_).filter(Boolean));
  if (!codeKeys.size) return [];
  const items = Array.isArray(trinkLookup && trinkLookup.items) ? trinkLookup.items : [];
  const out = [];
  const seen = new Set();

  items.forEach((item) => {
    const codeCandidates = extractConsumableCodesFromText_(
      [
        item && item.oemCode,
        item && item.compatibilityText,
        item && item.sku,
        item && item.rowText,
      ].join(" ")
    );
    const hit = codeCandidates.some((code) => {
      const c = normalizeCodeKey_(code);
      if (!c) return false;
      return Array.from(codeKeys).some((k) => codesEquivalent_(c, k));
    });
    if (!hit) return;

    const sku = String(item && item.sku || "").trim();
    const title = String(item && item.compatibilityText || item && item.oemCode || "").trim();
    const display = title
      ? `Compatible ${title}${sku ? ` (Trink ${sku})` : ""}`
      : (sku ? `Compatible Trink ${sku}` : "");
    if (!display) return;
    const key = productDedupeKey_(display);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(display);
  });

  return out;
}

function compatibleNamesFromSkus_(skus, inventoryProducts) {
  const wanted = new Set((Array.isArray(skus) ? skus : []).map((s) => String(s || "").trim().toUpperCase()).filter(Boolean));
  if (!wanted.size) return [];
  const out = [];
  const seen = new Set();
  (Array.isArray(inventoryProducts) ? inventoryProducts : []).forEach((row) => {
    if (!isGenericSupplierRow_(row)) return;
    const sku = String(row && row.sku || "").trim().toUpperCase();
    if (!sku || !wanted.has(sku)) return;
    const name = String(row && row.name || "").trim();
    if (!name) return;
    const key = productDedupeKey_(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(name);
  });
  return out;
}

function groupCodeMatches_(query, matches) {
  const list = Array.isArray(matches) ? matches : [];
  const qNorm = normalizeCodeKey_(query);
  const queryHasCodeDigits = /(\d{3,4})/.test(qNorm);
  if (!queryHasCodeDigits) {
    return list.map(x => ({
      family: x.code,
      aliases: [x.code],
      originals: dedupeProductList_(x.data && x.data.originals),
      compatibles: dedupeProductList_(x.data && x.data.compatibles),
    }));
  }

  const byFamily = new Map();
  list.forEach(({ code, data }) => {
    const core = numericCoreFromCode_(code) || normalizeCodeKey_(code);
    const family = core || String(code || "");
    const prev = byFamily.get(family) || { family, aliases: [], originals: [], compatibles: [] };
    prev.aliases.push(code);
    prev.originals.push(...(Array.isArray(data && data.originals) ? data.originals : []));
    prev.compatibles.push(...(Array.isArray(data && data.compatibles) ? data.compatibles : []));
    byFamily.set(family, prev);
  });

  const grouped = Array.from(byFamily.values()).map((g) => ({
    family: g.family,
    aliases: Array.from(new Set(g.aliases.map(v => String(v || "").trim()).filter(Boolean))).sort(),
    originals: dedupeProductList_(g.originals),
    compatibles: dedupeProductList_(g.compatibles),
  }));
  grouped.sort((a, b) => String(a.family).localeCompare(String(b.family)));
  return grouped;
}

function findPrintersByConsumableCode_(queryCode, recordsInput) {
  const records = Array.isArray(recordsInput) && recordsInput.length ? recordsInput : getCompatibilityRecords_();
  const q = normalizeCodeKey_(queryCode);
  if (!q) return [];
  const printers = [];
  records.forEach((record) => {
    const pools = []
      .concat(record.cartridges || [])
      .concat(record.drum || [])
      .concat(record.waste || [])
      .concat(record.maintenance || []);
    const hit = pools.some(item => normalizeCodeKey_(item).includes(q) || q.includes(normalizeCodeKey_(item)));
    if (hit) printers.push(record);
  });
  return printers;
}

function renderConsumablesList_(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return "<span class=\"muted\">None listed</span>";
  return list.map(v => `<span class="cons-chip">${escapeHtml(v)}</span>`).join(" ");
}

function extractBrandHint_(query) {
  const s = String(query || "").toLowerCase();
  const brands = ["canon", "hp", "epson", "brother", "samsung", "xerox", "kyocera", "ricoh", "lexmark", "oki"];
  return brands.find((b) => s.includes(b)) || "";
}

function extractCodeTokens_(value) {
  const s = String(value || "").toUpperCase();
  const out = new Set();
  const codeish = s.match(/[A-Z]*\d+[A-Z]*/g) || [];
  codeish.forEach((t) => {
    const n = normalizeCodeKey_(t);
    if (!n) return;
    out.add(n);
    const shorter = n.replace(/(FDW|DW|DN|N|X|XL|XXL)$/g, "");
    if (shorter && shorter !== n) out.add(shorter);
  });
  return Array.from(out);
}

function extractNumericTokens_(value) {
  const s = String(value || "").toUpperCase();
  const nums = s.match(/\d{3,6}/g) || [];
  return Array.from(new Set(nums));
}

function normalizeBrandWord_(value) {
  const s = String(value || "").toLowerCase().trim();
  if (!s) return "";
  if (s === "hewlettpackard") return "hp";
  if (s === "epson") return "epson";
  if (s === "canon") return "canon";
  if (s === "brother") return "brother";
  if (s === "samsung") return "samsung";
  if (s === "xerox") return "xerox";
  if (s === "kyocera") return "kyocera";
  if (s === "ricoh") return "ricoh";
  if (s === "lexmark") return "lexmark";
  if (s === "oki") return "oki";
  if (s === "hp") return "hp";
  return s;
}

function splitQueryForModelMatch_(query) {
  const raw = String(query || "").trim();
  const upper = raw.toUpperCase();
  const parts = upper
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const brandToken = parts.find((p) => {
    const b = normalizeBrandWord_(p);
    return ["hp", "canon", "epson", "brother", "samsung", "xerox", "kyocera", "ricoh", "lexmark", "oki"].includes(b);
  }) || "";

  const withoutBrand = parts.filter((p) => normalizeBrandWord_(p) !== normalizeBrandWord_(brandToken));
  const numeric = extractNumericTokens_(raw);
  const codeish = extractCodeTokens_(raw);

  const variants = new Set([raw]);
  if (withoutBrand.length) variants.add(withoutBrand.join(" "));
  if (numeric.length) numeric.forEach((n) => variants.add(n));
  if (codeish.length) codeish.forEach((c) => variants.add(c));

  return {
    brandToken: normalizeBrandWord_(brandToken),
    variants: Array.from(variants),
    numeric,
    codeish,
  };
}

function levenshteinWithin_(a, b, maxDist) {
  const s = String(a || "");
  const t = String(b || "");
  const n = s.length;
  const m = t.length;
  if (!n || !m) return Math.max(n, m) <= maxDist ? Math.max(n, m) : null;
  if (Math.abs(n - m) > maxDist) return null;
  let prev = new Array(m + 1);
  let curr = new Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= m; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return null;
    const tmp = prev; prev = curr; curr = tmp;
  }
  return prev[m] <= maxDist ? prev[m] : null;
}

function computeMatchScore_(candidate, query) {
  const rawCandidate = String(candidate || "").toUpperCase().trim();
  const rawQuery = String(query || "").toUpperCase().trim();
  const c = normalizeCodeKey_(candidate);
  const q = normalizeCodeKey_(query);
  if (!c || !q) return { score: 0, kind: "" };
  if (c === q) return { score: 100, kind: "exact" };

  const qCodes = extractCodeTokens_(rawQuery);
  const cCodes = extractCodeTokens_(rawCandidate);
  if (qCodes.length && cCodes.length) {
    const codeHit = qCodes.some((qc) => cCodes.includes(qc) || cCodes.some((cc) => cc.startsWith(qc) || qc.startsWith(cc)));
    if (codeHit) return { score: 94, kind: "code" };
  }

  const qNums = extractNumericTokens_(rawQuery);
  const cNums = extractNumericTokens_(rawCandidate);
  if (qNums.length && cNums.length) {
    const numsExact = qNums.every((n) => cNums.includes(n));
    if (numsExact) return { score: 90, kind: "num" };
  }

  const qIsShortNumeric = /^\d{3,4}$/.test(q);
  if (qIsShortNumeric) {
    // Avoid loose 515 -> 1515 false positives.
    if (cNums.includes(q)) return { score: 88, kind: "num" };
    return { score: 0, kind: "" };
  }

  if (c.startsWith(q) || q.startsWith(c)) return { score: 84, kind: "prefix" };
  if (c.includes(q) || q.includes(c)) return { score: 68, kind: "contains" };
  const maxDist = q.length >= 8 ? 2 : 1;
  const dist = levenshteinWithin_(c, q, maxDist);
  if (dist !== null) return { score: 50 - (dist * 8), kind: "fuzzy" };
  return { score: 0, kind: "" };
}

function consumableGroupsFromRecord_(record) {
  const out = new Map();
  const push = (obj) => {
    const fam = String(obj.Cartridge_Family || obj.Cartridge_Normalized || obj.Cartridge || "").trim();
    const key = normalizeCodeKey_(fam);
    if (!key) return;
    if (!out.has(key)) {
      const splitCodes = dedupeStrings_(
        extractConsumableCodesFromText_(
          [obj.Cartridge_Normalized, obj.Cartridge_Family, obj.Cartridge].filter(Boolean).join(" ")
        )
      );
      out.set(key, {
        Cartridge: String(obj.Cartridge || fam || "").trim(),
        Cartridge_Normalized: String(obj.Cartridge_Normalized || key).trim(),
        Cartridge_Family: String(obj.Cartridge_Family || fam || key).trim(),
        Type: String(obj.Type || "").trim(),
        Color: String(obj.Color || "").trim(),
        Supplier_Compatible_SKUs: dedupeStrings_(
          Array.isArray(obj.Supplier_Compatible_SKUs) ? obj.Supplier_Compatible_SKUs : []
        ),
        _codes: dedupeStrings_(
          [obj.Cartridge_Normalized, obj.Cartridge_Family, obj.Cartridge]
            .filter(Boolean)
            .concat(splitCodes)
        ),
      });
      return;
    }
    const existing = out.get(key);
    const splitCodes = dedupeStrings_(
      extractConsumableCodesFromText_(
        [obj.Cartridge_Normalized, obj.Cartridge_Family, obj.Cartridge].filter(Boolean).join(" ")
      )
    );
    existing._codes = dedupeStrings_(
      existing._codes
        .concat([obj.Cartridge_Normalized, obj.Cartridge_Family, obj.Cartridge].filter(Boolean))
        .concat(splitCodes)
    );
    if (!existing.Type && obj.Type) existing.Type = String(obj.Type).trim();
    if (!existing.Color && obj.Color) existing.Color = String(obj.Color).trim();
    existing.Supplier_Compatible_SKUs = dedupeStrings_(
      (Array.isArray(existing.Supplier_Compatible_SKUs) ? existing.Supplier_Compatible_SKUs : [])
        .concat(Array.isArray(obj.Supplier_Compatible_SKUs) ? obj.Supplier_Compatible_SKUs : [])
    );
  };

  const rich = Array.isArray(record && record.consumables) ? record.consumables : [];
  if (rich.length) {
    rich.forEach((c) => push(c || {}));
  } else {
    const rawCodes = Array.isArray(record && record.cartridgeCodes) ? record.cartridgeCodes : [];
    rawCodes.forEach((code) => {
      push({
        Cartridge: code,
        Cartridge_Normalized: code,
        Cartridge_Family: code,
        Type: "",
        Color: "",
        Supplier_Compatible_SKUs: [],
      });
    });
  }
  return Array.from(out.values());
}

function searchMasterFinder_(query, records) {
  const qRaw = String(query || "").trim();
  const q = normalizeCodeKey_(qRaw);
  const parsed = splitQueryForModelMatch_(qRaw);
  const brandHint = extractBrandHint_(qRaw) || parsed.brandToken;
  const isCodeLike = /[A-Z]/.test(q) && /\d/.test(q);
  const candidates = [];

  (Array.isArray(records) ? records : []).forEach((record) => {
    const rowBrand = String(record.brand || "").toLowerCase().trim();
    if (brandHint && rowBrand && rowBrand !== brandHint) return;

    const modelCandidates = [record.printerModel, record.printerNormalized]
      .concat(Array.isArray(record.aliases) ? record.aliases : [])
      .concat(record.brand ? [`${record.brand} ${record.printerModel}`] : [])
      .concat(extractCodeTokens_(record.printerModel || ""));
    const combinedModelText = modelCandidates.join(" ");
    let bestModel = { score: 0, kind: "" };
    parsed.variants.forEach((variant) => {
      modelCandidates.forEach((mc) => {
        const m = computeMatchScore_(mc, variant);
        if (m.score > bestModel.score) bestModel = m;
      });
    });

    // Require some model token overlap when query has clear code/numeric intent.
    if (parsed.numeric.length) {
      const modelNums = extractNumericTokens_(combinedModelText);
      const hasNumOverlap = parsed.numeric.some((n) => modelNums.includes(n));
      if (!hasNumOverlap && !isCodeLike) return;
    }
    if (parsed.codeish.length) {
      const modelCodes = extractCodeTokens_(combinedModelText);
      const hasCodeOverlap = parsed.codeish.some((qc) =>
        modelCodes.includes(qc) || modelCodes.some((mc) => mc.startsWith(qc) || qc.startsWith(mc))
      );
      if (!hasCodeOverlap && !isCodeLike) return;
    }

    const groups = consumableGroupsFromRecord_(record);
    const matchedGroups = [];
    let bestCartScore = 0;
    groups.forEach((g) => {
      const fields = [g.Cartridge_Normalized, g.Cartridge_Family, g.Cartridge];
      let best = { score: 0, kind: "" };
      parsed.variants.forEach((variant) => {
        fields.forEach((f) => {
          const m = computeMatchScore_(f, variant);
          if (m.score > best.score) best = m;
        });
      });
      if (best.score > 0) {
        matchedGroups.push({ ...g, _matchScore: best.score, _matchKind: best.kind });
        if (best.score > bestCartScore) bestCartScore = best.score;
      }
    });

    if (!bestModel.score && !bestCartScore) return;
    const brandBoost = (brandHint && rowBrand === brandHint) ? 12 : 0;
    const totalScore = Math.max(bestModel.score, bestCartScore) + brandBoost;
    candidates.push({
      record,
      groups,
      matchedGroups,
      bestModel,
      bestCartScore,
      totalScore,
    });
  });

  candidates.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return String(a.record.printerModel || "").localeCompare(String(b.record.printerModel || ""));
  });

  const topModel = candidates.reduce((m, c) => Math.max(m, c.bestModel.score), 0);
  const topCart = candidates.reduce((m, c) => Math.max(m, c.bestCartScore), 0);
  const intent = (isCodeLike && topCart >= topModel) ? "cartridge" : "printer";
  const top = intent === "printer" ? topModel : topCart;
  let narrowed = candidates.filter((c) => {
    const score = intent === "printer" ? c.bestModel.score : c.bestCartScore;
    const width = intent === "printer" ? 14 : 18;
    return score > 0 && score >= (top - width);
  });

  // If we have exact model matches, keep only those to avoid noisy partial rows.
  const exactModelRows = narrowed.filter((c) => c.bestModel && c.bestModel.score >= 95);
  if (exactModelRows.length) narrowed = exactModelRows;

  // Collapse duplicate printer entries (e.g. catalog title row + mapped row).
  const deduped = new Map();
  narrowed.forEach((c) => {
    const rec = c.record || {};
    const key = [
      normalizeBrandWord_(rec.brand || ""),
      modelCanonicalKey_(rec.printerModel || rec.printerNormalized || ""),
    ].join("|");
    const current = deduped.get(key);
    if (!current) {
      deduped.set(key, c);
      return;
    }
    const currentHasGroups = Array.isArray(current.groups) && current.groups.length > 0;
    const nextHasGroups = Array.isArray(c.groups) && c.groups.length > 0;
    if (nextHasGroups && !currentHasGroups) {
      deduped.set(key, c);
      return;
    }
    if (c.totalScore > current.totalScore) {
      deduped.set(key, c);
    }
  });

  narrowed = Array.from(deduped.values()).slice(0, 40);

  return { intent, rows: narrowed };
}

function renderCartridgeFinder() {
  const wrap = document.createElement("section");
  wrap.className = "panel";
  wrap.innerHTML = `
    <h3>Cartridge Finder</h3>
    <div class="finder-subtitle">Search by printer model or cartridge code (partial matches supported). Master dataset + your Hike product list.</div>
    <div class="finder-controls">
      <div class="kv">
        <label>Printer Model</label>
        <input id="finder-model" placeholder="e.g. TR4640, MG2541, HP 305" />
      </div>
      <button id="finder-search" type="button">Search</button>
      <button id="finder-clear" type="button" class="secondary">Clear</button>
    </div>
    <div id="finder-msg" class="save-msg"></div>
    <div id="finder-results"></div>
  `;

  const modelEl = wrap.querySelector("#finder-model");
  const msgEl = wrap.querySelector("#finder-msg");
  const resultsEl = wrap.querySelector("#finder-results");

  const runSearch = async () => {
    const query = String(modelEl.value || "").trim();
    resultsEl.innerHTML = "";
    if (!query) {
      msgEl.textContent = "Enter a printer model to search.";
      return;
    }
    const master = await ensurePrinterMasterLoaded_();
    const catalog = await ensurePrinterCatalogLoaded_();
    const mapIndex = await ensurePrinterConsumableMapLoaded_();
    const indexByCode = await ensureCartridgeIndexLoaded_();
    const inventoryProducts = await ensureCartridgeProductsLoaded_();
    const trinkLookup = await ensureTrinkLookupLoaded_();
    const mergedRecords = mergeFinderRecordsWithMap_(
      mergeFinderSearchRecords_(master.records, catalog),
      mapIndex
    );
    const finder = searchMasterFinder_(query, mergedRecords);
    const inventoryNameMatches = findInventoryNameMatches_(query, inventoryProducts);
    if (!finder.rows.length && !inventoryNameMatches.length) {
      msgEl.textContent = "No match found in master dataset or your Hike product list.";
      return;
    }

    const bits = [];
    if (finder.rows.length) bits.push(`${finder.rows.length} ${finder.intent === "printer" ? "printer" : "cartridge"} match${finder.rows.length > 1 ? "es" : ""}`);
    if (inventoryNameMatches.length) bits.push(`${inventoryNameMatches.length} inventory name match${inventoryNameMatches.length > 1 ? "es" : ""}`);
    msgEl.textContent = `Found ${bits.join(" + ")}. Search mode: ${finder.intent === "printer" ? "Printer → Cartridges" : "Cartridge → Printers"}.`;

    const uniquePrinters = dedupeStrings_(finder.rows.map((r) => String(r.record && r.record.printerModel || ""))).filter(Boolean);
    if (finder.intent === "printer" && uniquePrinters.length > 1) {
      const refineWrap = document.createElement("div");
      refineWrap.className = "finder-refine";
      const options = [`<option value="ALL">All matched printers</option>`]
        .concat(uniquePrinters.map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`));
      refineWrap.innerHTML = `
        <label for="finder-printer-pick">Filter to one printer:</label>
        <select id="finder-printer-pick">${options.join("")}</select>
      `;
      resultsEl.appendChild(refineWrap);
    }

    const table = document.createElement("table");
    table.innerHTML = finder.intent === "printer"
      ? `
        <thead>
          <tr>
            <th>Printer Model</th>
            <th>Brand</th>
            <th>Match</th>
            <th>Cartridge Family</th>
            <th>Cartridge Normalized</th>
            <th>Type</th>
            <th>Color</th>
            <th>Original</th>
            <th>Compatible</th>
          </tr>
        </thead>
        <tbody></tbody>
      `
      : `
        <thead>
          <tr>
            <th>Printer Model</th>
            <th>Brand</th>
            <th>Match</th>
            <th>Matched Cartridges</th>
            <th>Original</th>
            <th>Compatible</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
    const body = table.querySelector("tbody");
    const drawRows = (rows, pickedPrinter) => {
      body.innerHTML = "";
      const filteredRows = (pickedPrinter && pickedPrinter !== "ALL")
        ? rows.filter((r) => String(r.record && r.record.printerModel || "") === pickedPrinter)
        : rows;

      filteredRows.forEach((candidate) => {
        const record = candidate.record || {};
        const rowGroups = finder.intent === "printer"
          ? (candidate.groups || [])
          : (candidate.matchedGroups || []);

        if (finder.intent === "printer") {
          // Keep one primary consumable set when a model has multiple alternates:
          // prefer the set that has real compatible matches.
          let displayGroups = rowGroups.slice();
          if (displayGroups.length > 1) {
            const scored = displayGroups.map((g, idx) => {
              const groupCodes = dedupeStrings_(
                [g.Cartridge_Normalized, g.Cartridge_Family, g.Cartridge]
                  .concat(Array.isArray(g._codes) ? g._codes : [])
                  .filter(Boolean)
              );
              const skus = Array.isArray(g.Supplier_Compatible_SKUs) ? g.Supplier_Compatible_SKUs : [];
              const bySku = compatibleNamesFromSkus_(skus, inventoryProducts);
              const byTrink = compatibleNamesFromTrinkByCodes_(groupCodes, trinkLookup);
              const byGeneric = compatibleNamesFromGenericSupplierByCodes_(groupCodes, inventoryProducts, indexByCode);
              const compatCount = dedupeStrings_(bySku.concat(byTrink, byGeneric)).length;
              return { g, idx, compatCount };
            });
            scored.sort((a, b) => {
              if (b.compatCount !== a.compatCount) return b.compatCount - a.compatCount;
              return a.idx - b.idx;
            });
            displayGroups = [scored[0].g];
          }

          const familyMap = new Map();
          const normalizedMap = new Map();
          const typeSet = new Set();
          const colorSet = new Set();
          const allCodes = [];
          const masterCompat = [];

          displayGroups.forEach((g) => {
            const fam = String(g.Cartridge_Family || "").trim();
            const famKey = normalizeCodeKey_(fam);
            if (fam && famKey && !familyMap.has(famKey)) familyMap.set(famKey, fam);

            const cn = String(g.Cartridge_Normalized || "").trim();
            const cnKey = normalizeCodeKey_(cn);
            if (cn && cnKey && !normalizedMap.has(cnKey)) normalizedMap.set(cnKey, cn);

            const typ = String(g.Type || "").trim();
            if (typ) typeSet.add(typ);
            const col = String(g.Color || "").trim();
            if (col) colorSet.add(col);

            allCodes.push(g.Cartridge_Normalized, g.Cartridge_Family, g.Cartridge);
            if (Array.isArray(g._codes)) allCodes.push(...g._codes);
            if (Array.isArray(g.Supplier_Compatible_SKUs)) {
              g.Supplier_Compatible_SKUs.forEach((sku) => {
                const s = String(sku || "").trim();
                if (s) masterCompat.push(`Trink ${s}`);
              });
            }
          });

          const groupCodes = dedupeStrings_(allCodes.filter(Boolean));
          const stockSplit = splitInventoryByCodes_(groupCodes, inventoryProducts);
          const idxOriginal = productNameListFromIndexByCodes_(groupCodes, indexByCode, "original");
          const originalNames = dedupeStrings_(stockSplit.originals.concat(idxOriginal));
          const compatibleNames = dedupeStrings_(
            masterCompat.concat(
              compatibleNamesFromSkus_(
                dedupeStrings_(displayGroups.flatMap((g) => Array.isArray(g.Supplier_Compatible_SKUs) ? g.Supplier_Compatible_SKUs : [])),
                inventoryProducts
              ),
              compatibleNamesFromTrinkByCodes_(groupCodes, trinkLookup),
              compatibleNamesFromGenericSupplierByCodes_(groupCodes, inventoryProducts, indexByCode)
            )
          );

          const familyList = Array.from(familyMap.values());
          const normalizedList = Array.from(normalizedMap.values());
          const types = Array.from(typeSet);
          const colors = Array.from(colorSet);
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${escapeHtml(record.printerModel || "-")}</td>
            <td>${escapeHtml(record.brand || "-")}</td>
            <td>${escapeHtml(candidate.bestModel && candidate.bestModel.kind ? candidate.bestModel.kind : "match")}</td>
            <td>${renderConsumablesList_(familyList)}</td>
            <td>${renderConsumablesList_(normalizedList)}</td>
            <td>${escapeHtml(types.join(", ") || "-")}</td>
            <td>${escapeHtml(colors.join(", ") || "-")}</td>
            <td>${renderOriginalLines_(originalNames, groupCodes)}</td>
            <td>${renderNameLinesOrCodes_(compatibleNames, [])}</td>
          `;
          body.appendChild(tr);
          return;
        }

        const matchedCodes = dedupeStrings_(rowGroups.flatMap((g) =>
          [g.Cartridge_Family, g.Cartridge_Normalized].concat(Array.isArray(g._codes) ? g._codes : [])
        ));
        const stockSplit = splitInventoryByCodes_(matchedCodes, inventoryProducts);
        const idxOriginal = productNameListFromIndexByCodes_(matchedCodes, indexByCode, "original");
        const originalNames = dedupeStrings_(stockSplit.originals.concat(idxOriginal));
        const fromMaster = dedupeStrings_(
          rowGroups
            .flatMap((g) => (Array.isArray(g.Supplier_Compatible_SKUs) ? g.Supplier_Compatible_SKUs : []))
            .map((sku) => `Trink ${String(sku || "").trim()}`)
            .filter(Boolean)
        );
        const compatibleNames = dedupeStrings_(
          fromMaster.concat(
            compatibleNamesFromTrinkByCodes_(matchedCodes, trinkLookup),
            compatibleNamesFromGenericSupplierByCodes_(matchedCodes, inventoryProducts, indexByCode)
          )
        );
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(record.printerModel || "-")}</td>
          <td>${escapeHtml(record.brand || "-")}</td>
          <td>${escapeHtml(candidate.bestCartScore ? "cartridge match" : "match")}</td>
          <td>${renderConsumablesList_(matchedCodes)}</td>
          <td>${renderOriginalLines_(originalNames, matchedCodes)}</td>
          <td>${renderNameLinesOrCodes_(compatibleNames, [])}</td>
        `;
        body.appendChild(tr);
      });
    };
    drawRows(finder.rows, "ALL");
    resultsEl.appendChild(table);

    const pickEl = resultsEl.querySelector("#finder-printer-pick");
    if (pickEl) {
      pickEl.addEventListener("change", () => {
        const selected = String(pickEl.value || "ALL");
        drawRows(finder.rows, selected);
      });
    }

    if (inventoryNameMatches.length) {
      const title = document.createElement("h4");
      title.style.marginTop = "12px";
      title.textContent = "Inventory Name Matches (From Your Product List)";
      resultsEl.appendChild(title);

      const details = document.createElement("details");
      details.className = "finder-details";
      const summary = document.createElement("summary");
      summary.textContent = `Show inventory rows (${inventoryNameMatches.length})`;
      details.appendChild(summary);

      const tbl = document.createElement("table");
      tbl.innerHTML = `
        <thead>
          <tr>
            <th>Product Name</th>
            <th>SKU</th>
            <th>Supplier</th>
            <th>Type</th>
            <th>Tag</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const body = tbl.querySelector("tbody");
      const rows = inventoryNameMatches.slice(0, 80);
      rows.forEach((p) => {
        const tags = extractTagsFromProduct_(p);
        const tr = document.createElement("tr");
        tr.dataset.tags = tags.map(t => normalizeCodeKey_(t)).join("|");
        tr.dataset.type = String(p.productType || "").trim().toUpperCase();
        tr.innerHTML = `
          <td>${escapeHtml(String(p.name || "-"))}</td>
          <td>${escapeHtml(String(p.sku || "-"))}</td>
          <td>${escapeHtml(String(p.supplier || "-"))}</td>
          <td>${escapeHtml(String(p.productType || "-"))}</td>
          <td>${tags.length ? tags.map((t) => `<span class="cons-chip">${escapeHtml(t)}</span>`).join(" ") : "<span class=\"muted\">-</span>"}</td>
        `;
        body.appendChild(tr);
      });

      const queryKey = normalizeCodeKey_(query);
      const allTags = dedupeStrings_(
        rows.flatMap((p) => extractTagsFromProduct_(p))
      );
      const refinedTag = allTags.find(t => normalizeCodeKey_(t) === queryKey) || "ALL";

      if (allTags.length > 1) {
        const refine = document.createElement("div");
        refine.className = "finder-refine";
        const options = ["ALL"].concat(allTags);
        refine.innerHTML = `
          <label for="finder-refine-tag">Refine by code:</label>
          <select id="finder-refine-tag">
            ${options.map((t) => {
              const label = t === "ALL" ? "All codes" : t;
              const selected = t === refinedTag ? " selected" : "";
              return `<option value="${escapeHtml(t)}"${selected}>${escapeHtml(label)}</option>`;
            }).join("")}
          </select>
        `;
        details.appendChild(refine);
      }

      const applyRefineFilter = () => {
        const sel = details.querySelector("#finder-refine-tag");
        const selected = sel ? String(sel.value || "ALL") : "ALL";
        const selectedKey = normalizeCodeKey_(selected);
        const trs = Array.from(body.querySelectorAll("tr"));
        trs.forEach((tr) => {
          if (selected === "ALL") {
            tr.style.display = "";
            return;
          }
          const tagsKey = String(tr.dataset.tags || "");
          tr.style.display = tagsKey.split("|").includes(selectedKey) ? "" : "none";
        });
      };

      const refineEl = details.querySelector("#finder-refine-tag");
      if (refineEl) refineEl.addEventListener("change", applyRefineFilter);
      applyRefineFilter();
      details.appendChild(tbl);
      resultsEl.appendChild(details);
    }
  };

  wrap.querySelector("#finder-search").onclick = runSearch;
  wrap.querySelector("#finder-clear").onclick = () => {
    modelEl.value = "";
    msgEl.textContent = "";
    resultsEl.innerHTML = "";
    modelEl.focus();
  };
  modelEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });
  return wrap;
}

function renderBatching() {
  const wrap = document.createElement("section");
  wrap.className = "panel batching-root";
  wrap.innerHTML = "<h3>Supplier Orders</h3>";

  const isOwnerOrAdmin = state.role === "owner" || state.role === "admin";

  const outsourced = state.jobs.filter(j =>
    !isSoftDeleted_(j) &&
    j.category === "Outsourced" &&
    ["Ready to Order", "Order Placed", "In Production", "Ready for Collection"].includes(j.status)
  );
  wrap.appendChild(renderSupplierOrderTable_("Printstation Orders", "PS_ORDER", outsourced, {
    statusOptions: ["Ready to Order", "Order Placed", "Ready for Collection"],
    showOrderRef: true,
    orderRefLabel: "Printstation order #",
  }));

  if (isOwnerOrAdmin) {
    const ink = state.jobs.filter(j =>
      !isSoftDeleted_(j) &&
      j.category === "Ink/Stock" &&
      ["Ready to Order", "Order Placed", "Backordered", "Ready for Collection"].includes(j.status)
    );
    wrap.appendChild(renderSupplierOrderTable_("Ink & Cartridge Orders", "INK_ORDER", ink, {
      statusOptions: ["Ready to Order", "Order Placed", "Backordered", "Ready for Collection"],
      showOrderRef: false,
      showSupplier: true,
    }));

    const dtf = state.jobs.filter(j => {
      if (isSoftDeleted_(j)) return false;
      if (!isDtfJob_(j)) return false;
      if (j.category === "In-house") return ["Ready", "Batched (DTF Order)", "DTF Order Placed", "In Production", "Ready for Collection"].includes(j.status);
      if (j.category === "Outsourced" && j.outsourcePartner === "Customisable") return ["Ready to Order", "Order Placed", "In Production", "Ready for Collection"].includes(j.status);
      return false;
    });
    wrap.appendChild(renderSupplierOrderTable_("DTF Orders — Customisable", "DTF_ORDER", dtf, {
      statusOptions: ["Ready", "Ready to Order", "Batched (DTF Order)", "DTF Order Placed", "Order Placed", "In Production", "Ready for Collection"],
      showOrderRef: false,
    }));
  }

  return wrap;
}

function renderSupplierOrderTable_(title, orderTag, jobs, opts = {}) {
  const box = document.createElement("div");
  box.className = "panel batch-queue batch-ready";
  box.style.marginTop = "10px";

  const h = document.createElement("h3");
  h.textContent = title;
  box.appendChild(h);

  if (!jobs.length) {
    const none = document.createElement("div");
    none.className = "batch-empty";
    none.innerHTML = "<strong>All clear</strong> — nothing to action right now.";
    box.appendChild(none);
    return box;
  }

  const statusOptions = opts.statusOptions || [];
  const showOrderRef = !!opts.showOrderRef;
  const showSupplier = !!opts.showSupplier;

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>Job #</th>
        <th>Customer</th>
        <th>Product</th>
        <th>Due</th>
        ${showSupplier ? "<th>Supplier</th>" : ""}
        <th>Status</th>
        ${showOrderRef ? `<th>${escapeHtml(opts.orderRefLabel || "Order Ref")}</th>` : ""}
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  jobs
    .slice()
    .sort((a, b) => String(a.due || "").localeCompare(String(b.due || "")))
    .forEach(job => {
      const tr = document.createElement("tr");
      const currentRef = extractTaggedValue_(job.notes, orderTag);
      const options = statusOptions
        .map(s => `<option value="${escapeHtml(s)}"${job.status === s ? " selected" : ""}>${escapeHtml(s)}</option>`)
        .join("");
      tr.innerHTML = `
        <td><button class="batch-open-job link-btn" type="button">${escapeHtml(job.jobNo)}</button></td>
        <td>${escapeHtml(job.customer)}</td>
        <td>${escapeHtml(job.product)}</td>
        <td>${escapeHtml(job.due || "-")}</td>
        ${showSupplier ? `<td>${escapeHtml(job.supplier || "-")}</td>` : ""}
        <td><select class="batch-status">${options}</select></td>
        ${showOrderRef ? `<td><input class="batch-order-ref" value="${escapeHtml(currentRef)}" placeholder="${escapeHtml(opts.orderRefLabel || "Order ref")}" style="width:130px" /></td>` : ""}
        <td><button class="batch-save" type="button">Update</button></td>
      `;

      tr.querySelector(".batch-open-job").onclick = () => openJobPanel_(job.jobNo);

      const saveBtn = tr.querySelector(".batch-save");
      const statusSel = tr.querySelector(".batch-status");
      const refInput = tr.querySelector(".batch-order-ref");

      const markDirty = () => { if (saveBtn) saveBtn.classList.add("batch-save-dirty"); };
      if (statusSel) statusSel.addEventListener("change", markDirty);
      if (refInput) refInput.addEventListener("input", markDirty);

      saveBtn.onclick = async () => {
        const nextStatus = statusSel.value;
        const ref = showOrderRef ? String((refInput && refInput.value) || "").trim() : "";
        if (showOrderRef && !ref && nextStatus === "Order Placed") {
          if (refInput) { refInput.style.borderColor = "red"; refInput.focus(); refInput.placeholder = "Required — enter order # first"; }
          return;
        }
        if (refInput) refInput.style.borderColor = "";
        if (nextStatus === "Order Placed" && needsPaymentGate_(job)) {
          window.alert("This job must be marked as Paid before placing the order.");
          return;
        }
        const updates = buildBatchRowUpdates_(job, orderTag, nextStatus, ref);
        if (nextStatus !== job.status) {
          addCommLogEntry_(job, "Status", `Status → ${nextStatus}`);
        }
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
        const ok = await saveJobChanges(job.jobNo, updates, { keepTab: true, quiet: true, inlineBatchFeedback: true });
        if (ok) {
          tr.classList.add("batch-row-saved");
          saveBtn.textContent = "Saved ✓";
          saveBtn.classList.remove("batch-save-dirty");
          setTimeout(() => {
            tr.classList.remove("batch-row-saved");
            saveBtn.textContent = "Update";
            saveBtn.disabled = false;
          }, 1200);
        } else {
          saveBtn.textContent = "Retry";
          saveBtn.disabled = false;
        }
      };

      tbody.appendChild(tr);
    });

  box.appendChild(table);
  return box;
}

function parseDateSafeLocal_(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isDtfJob_(job) {
  const product = String(job.product || "").toLowerCase();
  const rawInhouse = String(job.inhouseType || "").toLowerCase();
  return product.includes("dtf") || rawInhouse.includes("dtf");
}

function isVinylStickerJob_(job) {
  const product = String(job.product || "").toLowerCase();
  const rawInhouse = String(job.inhouseType || "").toLowerCase();
  return product.includes("vinyl stickers") || rawInhouse.includes("vinyl stickers");
}

function isMimakiJob_(job) {
  const p = String(job.product || job.inhouseType || "").toLowerCase();
  return ["vinyl stickers", "stickers", "correx boards", "car magnets", "canvas prints"].some(t => p.includes(t));
}

function getMimakiMediaGroup_(job) {
  const p = String(job.product || job.inhouseType || "").toLowerCase();
  if (p.includes("canvas")) return "canvas";
  const media = [
    getSpecValueFromText_(job.specs, "Vinyl Media"),
    getSpecValueFromText_(job.specs, "Media"),
    getSpecValueFromText_(job.specs, "Material"),
  ].join(" ").toLowerCase();
  if (media.includes("gloss")) return "gloss_vinyl";
  if (media.includes("matte") || media.includes("matt")) return "matte_vinyl";
  return "other";
}

function getMimakiProductionMeta_(job) {
  const p = String(job.product || job.inhouseType || "").toLowerCase();
  const qty = getSpecValueFromText_(job.specs, "Quantity") ||
              getSpecValueFromText_(job.specs, "Quantity (Pairs)") || "-";

  if (p.includes("vinyl stickers")) {
    const w = getSpecValueFromText_(job.specs, "Sticker Width (mm)");
    const h = getSpecValueFromText_(job.specs, "Sticker Height (mm)");
    const size = (w && h) ? `${w}×${h}mm` : (w || h || "-");
    const lam = getSpecValueFromText_(job.specs, "Lamination");
    const cut = getSpecValueFromText_(job.specs, "Cut Type");
    return { size, qty, detail: [lam, cut].filter(v => v && v !== "None").join(" · ") || "-" };
  }
  if (p.includes("canvas")) {
    const size = getSpecValueFromText_(job.specs, "Size");
    const frame = getSpecValueFromText_(job.specs, "Frame / Mount");
    return { size: size || "-", qty, detail: frame || "-" };
  }
  if (p.includes("correx")) {
    const sizeType = getSpecValueFromText_(job.specs, "Size Type");
    const size = sizeType === "Standard Sizes"
      ? getSpecValueFromText_(job.specs, "Standard Size")
      : getSpecValueFromText_(job.specs, "Custom Size (mm)");
    const substrate = getSpecValueFromText_(job.specs, "Substrate");
    return { size: size || "-", qty, detail: substrate || "-" };
  }
  if (p.includes("car magnets")) {
    const sizeType = getSpecValueFromText_(job.specs, "Size Type");
    const size = sizeType === "Standard Size"
      ? getSpecValueFromText_(job.specs, "Standard Size")
      : getSpecValueFromText_(job.specs, "Custom Size (mm)");
    const qtyPairs = getSpecValueFromText_(job.specs, "Quantity (Pairs)");
    const artVer = getSpecValueFromText_(job.specs, "Artwork Versions");
    return { size: size || "-", qty: qtyPairs ? `${qtyPairs} pairs` : "-", detail: artVer ? `${artVer} ver.` : "-" };
  }
  if (p.includes("stickers")) {
    const size = getSpecValueFromText_(job.specs, "Size");
    const lam = getSpecValueFromText_(job.specs, "Lamination");
    return { size: size || "-", qty, detail: lam && lam !== "None" ? lam : "-" };
  }
  return { size: "-", qty, detail: "-" };
}

function parseSpecsToMap_(specsText) {
  const map = {};
  String(specsText || "").split(/\r?\n/).forEach(line => {
    const idx = line.indexOf(": ");
    if (idx > 0) {
      const label = line.slice(0, idx).trim();
      const value = line.slice(idx + 2).trim();
      if (label) map[label] = value;
    }
  });
  return map;
}

function buildSublimationEditSchema_(job) {
  const subProductOptions = Object.keys(SPEC_SCHEMAS.sublimation || {});
  const currentSubProduct = getSpecValueFromText_(String(job.specs || ""), "Product") || "";
  const subFields = (SPEC_SCHEMAS.sublimation || {})[currentSubProduct] || [];
  return {
    fields: [
      { id: "sublimation_product", label: "Product", type: "select", options: subProductOptions },
      ...subFields
    ],
    mode: "sublimation",
    productType: "Sublimation"
  };
}

function getEditableSpecSchema_(job) {
  const cat = String(job.category || "");
  const product = String(job.product || "");
  if (cat === "In-house") {
    if (product === "Sublimation") return buildSublimationEditSchema_(job);
    const inhouse = (SPEC_SCHEMAS.inhouse || {})[product];
    if (inhouse) return { fields: inhouse, mode: "inhouse", productType: product };
    const sub = (SPEC_SCHEMAS.sublimation || {})[product];
    if (sub) return { fields: sub, mode: "sublimation", productType: product };
  }
  if (cat === "Outsourced") {
    const outsourced = (SPEC_SCHEMAS.outsourced || {})[product];
    if (outsourced) return { fields: outsourced, mode: "outsourced", productType: product };
  }
  if (cat === "Sublimation") {
    return buildSublimationEditSchema_(job);
  }
  return null;
}

function renderSpecEditFields_(job) {
  const schema = getEditableSpecSchema_(job);
  const parsedSpecs = parseSpecsToMap_(job.specs);
  if (!schema) {
    return `<textarea id="jd-specs-text" rows="4" style="width:100%;resize:vertical;">${escapeHtml(job.specs || "")}</textarea>`;
  }
  return schema.fields.map(field => {
    const id = `jd-spec-${field.id}`;
    const currentValue = parsedSpecs[field.label] || "";
    const showWhenAttrs = field.showWhen
      ? `data-show-when-field="jd-spec-${field.showWhen.field}" data-show-when-equals="${escapeHtml(String(field.showWhen.equals || ""))}"`
      : "";
    if (field.type === "select") {
      const opts = field.options.map(o => `<option value="${escapeHtml(o)}"${o === currentValue ? " selected" : ""}>${escapeHtml(o)}</option>`).join("");
      return `<div class="kv spec-edit-row" ${showWhenAttrs}><label>${escapeHtml(field.label)}</label><select id="${id}"><option value="">— select —</option>${opts}</select></div>`;
    }
    if (field.type === "number") {
      return `<div class="kv spec-edit-row" ${showWhenAttrs}><label>${escapeHtml(field.label)}</label><input id="${id}" type="number" min="${field.min || 1}" placeholder="${escapeHtml(field.placeholder || "")}" value="${escapeHtml(currentValue)}" /></div>`;
    }
    return `<div class="kv spec-edit-row" ${showWhenAttrs}><label>${escapeHtml(field.label)}</label><input id="${id}" type="text" placeholder="${escapeHtml(field.placeholder || "")}" value="${escapeHtml(currentValue)}" /></div>`;
  }).join("");
}

function getSpecValueFromText_(specs, label) {
  const target = String(label || "").trim().toLowerCase();
  if (!target) return "";
  const lines = String(specs || "").split(/\r?\n/);
  for (const lineRaw of lines) {
    const line = String(lineRaw || "");
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const left = line.slice(0, idx).trim().toLowerCase();
    if (left !== target) continue;
    return line.slice(idx + 1).trim();
  }
  return "";
}

function getIncompleteSpecFields_(job) {
  const catToMode = { "In-house": "inhouse", "Outsourced": "outsourced", "Sublimation": "sublimation" };
  const mode = catToMode[String(job.category || "").trim()];
  if (!mode) return [];
  let productKey = String(job.product || job.inhouseType || "").trim();
  if (mode === "sublimation") {
    const sub = getSpecValueFromText_(job.specs, "Product");
    if (sub) productKey = sub;
  }
  const fields = ((SPEC_SCHEMAS[mode] || {})[productKey] || []);
  if (!fields.length) return [];
  const missing = [];
  fields.forEach(field => {
    if (field.showWhen) {
      const depField = fields.find(f => f.id === field.showWhen.field);
      if (depField) {
        const depValue = getSpecValueFromText_(job.specs, depField.label);
        if (depValue !== String(field.showWhen.equals || "")) return;
      }
    }
    if (!getSpecValueFromText_(job.specs, field.label)) missing.push(field.label);
  });
  return missing;
}

function getVinylBatchMeta_(job) {
  const qty = getSpecValueFromText_(job && job.specs, "Quantity");
  const width = getSpecValueFromText_(job && job.specs, "Sticker Width (mm)");
  const height = getSpecValueFromText_(job && job.specs, "Sticker Height (mm)");
  const size = (width && height) ? `${width} x ${height}` : (width || height || "-");
  return {
    qty: qty || "-",
    size,
  };
}

function getVinylProductionMeta_(job) {
  const base = getVinylBatchMeta_(job);
  return {
    ...base,
    material: getSpecValueFromText_(job && job.specs, "Material") || "-",
    lamination: getSpecValueFromText_(job && job.specs, "Lamination") || "-",
    cutType: getSpecValueFromText_(job && job.specs, "Cut Type") || "-",
  };
}


function buildBatchRowUpdates_(job, orderTag, nextStatus, orderRef) {
  const updates = {
    systemStatus: nextStatus,
    notes: upsertTaggedValue_(job.notes || "", orderTag, orderRef),
  };
  return updates;
}

function extractTaggedValue_(text, tag) {
  const t = String(text || "");
  const re = new RegExp(`\\[${tag}:([^\\]]+)\\]`, "i");
  const m = t.match(re);
  return m ? m[1].trim() : "";
}

function upsertTaggedValue_(text, tag, value) {
  const t = String(text || "");
  const re = new RegExp(`\\[${tag}:[^\\]]+\\]`, "ig");
  const cleaned = t.replace(re, "").trim();
  const v = String(value || "").trim();
  if (!v) return cleaned;
  return cleaned ? `${cleaned} [${tag}:${v}]` : `[${tag}:${v}]`;
}

function getHardProofApproved_(notes) {
  return extractTaggedValue_(notes, "HARD_PROOF_APPROVED").toUpperCase() === "YES";
}

function upsertHardProofApproved_(notes, approved) {
  return upsertTaggedValue_(notes, "HARD_PROOF_APPROVED", approved ? "YES" : "NO");
}

function parseProofRequirementFromSpecs_(specs) {
  const lines = String(specs || "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = String(lines[i] || "").trim();
    if (!/^proof requirement\s*:/i.test(line)) continue;
    return line.split(":").slice(1).join(":").trim();
  }
  return "";
}

function renderVinylQueue() {
  const wrap = document.createElement("section");
  wrap.className = "panel vinyl-queue-root";
  wrap.innerHTML = `
    <h3>Mimaki Production Queue</h3>
    <div class="finder-subtitle">Jobs grouped by media type. Tick Printed when off the machine, Finished when packed and ready for collection.</div>
  `;

  const jobs = state.jobs
    .filter(j => !isSoftDeleted_(j))
    .filter(j => j.category === "In-house")
    .filter(j => isMimakiJob_(j))
    .filter(j => ["Ready", "Batched (Vinyl Print Run)", "In Production"].includes(String(j.status || "")))
    .sort((a, b) => String(a.due || "").localeCompare(String(b.due || "")));

  const toolbar = document.createElement("div");
  toolbar.className = "actions";
  toolbar.innerHTML = `
    <button type="button" id="vq-queue-ready">Queue All Ready Jobs</button>
    <span class="save-msg" id="vq-msg"></span>
  `;
  wrap.appendChild(toolbar);

  const queueReadyBtn = toolbar.querySelector("#vq-queue-ready");
  const msgEl = toolbar.querySelector("#vq-msg");

  queueReadyBtn.onclick = async () => {
    const toQueue = jobs.filter(j => String(j.status || "") === "Ready");
    if (!toQueue.length) {
      if (msgEl) msgEl.textContent = "No Ready Mimaki jobs to queue.";
      return;
    }
    queueReadyBtn.disabled = true;
    queueReadyBtn.textContent = "Queueing...";
    const ok = await bulkSaveJobChanges_(toQueue.map(job => ({
      jobNo: job.jobNo,
      updates: { systemStatus: "Batched (Vinyl Print Run)" },
    })));
    if (msgEl) msgEl.textContent = ok ? `Queued ${toQueue.length} job(s).` : "Could not queue jobs. Retry.";
    queueReadyBtn.disabled = false;
    queueReadyBtn.textContent = "Queue All Ready Jobs";
    if (ok) render();
  };

  if (!jobs.length) {
    const none = document.createElement("div");
    none.style.cssText = "text-align:center;padding:48px 24px;color:var(--muted)";
    none.innerHTML = `
      <div style="font-size:40px;margin-bottom:12px">🎉</div>
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px">Queue is clear</div>
      <div style="font-size:13px;max-width:320px;margin:0 auto">No Mimaki jobs are queued. When jobs reach <strong>Ready</strong> status they will appear here grouped by media.</div>
    `;
    wrap.appendChild(none);
    return wrap;
  }

  const vqStatusMap_ = {
    "Ready":                     { label: "Waiting to Queue", cls: "open" },
    "Batched (Vinyl Print Run)": { label: "In Queue",         cls: "progress" },
    "In Production":             { label: "Printing",         cls: "progress" },
    "Ready for Collection":      { label: "Ready to Collect", cls: "collection" },
  };

  const GROUPS = [
    { key: "gloss_vinyl", label: "Gloss Vinyl",  accent: "#dbeafe" },
    { key: "matte_vinyl", label: "Matte Vinyl",  accent: "#f3e8ff" },
    { key: "canvas",      label: "Canvas",        accent: "#fef3c7" },
    { key: "other",       label: "Other Media",   accent: "#f3f4f6" },
  ];

  const buildJobRow = (job, statusMap) => {
    const status = String(job.status || "");
    const meta = getMimakiProductionMeta_(job);
    const product = String(job.product || job.inhouseType || "-");
    const printedChecked = ["In Production", "Ready for Collection", "Collected"].includes(status);
    const finishedChecked = ["Ready for Collection", "Collected"].includes(status);
    const friendlyStatus = statusMap[status] || { label: status, cls: "open" };

    const tr = document.createElement("tr");
    if (finishedChecked) tr.classList.add("vq-row-done");
    tr.innerHTML = `
      <td><button class="link-btn vq-open-job" type="button">${escapeHtml(job.jobNo)}</button></td>
      <td>${escapeHtml(job.customer || "-")}</td>
      <td>${escapeHtml(product)}</td>
      <td>${escapeHtml(meta.size)}</td>
      <td>${escapeHtml(meta.qty)}</td>
      <td>${escapeHtml(meta.detail)}</td>
      <td>${String(job.artworkLink || "").trim() ? `<button class="link-btn vq-open-art" type="button">Open Artwork</button>` : `<span class="save-msg">No link</span>`}</td>
      <td>${escapeHtml(job.due || "-")}</td>
      <td><input type="checkbox" class="vq-printed" ${printedChecked ? "checked" : ""} /></td>
      <td><input type="checkbox" class="vq-finished" ${finishedChecked ? "checked" : ""} /></td>
      <td><span class="badge ${friendlyStatus.cls}">${escapeHtml(friendlyStatus.label)}</span></td>
    `;

    tr.querySelector(".vq-open-job").onclick = () => {
      state.selectedJobNo = job.jobNo;
      state.tab = "job_detail";
      render();
    };
    const artworkBtn = tr.querySelector(".vq-open-art");
    if (artworkBtn) {
      artworkBtn.onclick = () => {
        const link = String(job.artworkLink || "").trim();
        if (link) window.open(link, "_blank", "noopener,noreferrer");
      };
    }

    const printedCb = tr.querySelector(".vq-printed");
    const finishedCb = tr.querySelector(".vq-finished");
    printedCb.onchange = async () => {
      if (!printedCb.checked || printedChecked) { printedCb.checked = printedChecked; return; }
      printedCb.disabled = true;
      const ok = await saveJobChanges(job.jobNo, { systemStatus: "In Production" }, { keepTab: true, quiet: true });
      if (!ok) printedCb.checked = false;
      printedCb.disabled = false;
      render();
    };
    finishedCb.onchange = async () => {
      if (!finishedCb.checked || finishedChecked) { finishedCb.checked = finishedChecked; return; }
      finishedCb.disabled = true;
      const ok = await saveJobChanges(job.jobNo, { systemStatus: "Ready for Collection" }, { keepTab: true, quiet: true });
      if (!ok) { finishedCb.checked = false; finishedCb.disabled = false; return; }
      finishedCb.disabled = false;
      render();
      const updatedJob = state.jobs.find(j => j.jobNo === job.jobNo);
      if (updatedJob) showReadyForCollectionModal_(updatedJob, null);
    };

    return tr;
  };

  GROUPS.forEach(group => {
    const groupJobs = jobs.filter(j => getMimakiMediaGroup_(j) === group.key);
    if (!groupJobs.length) return;

    const section = document.createElement("div");
    section.style.cssText = "margin-top:20px";

    const heading = document.createElement("div");
    heading.style.cssText = `background:${group.accent};border-radius:8px 8px 0 0;padding:8px 14px;font-weight:700;font-size:14px;border:1px solid var(--line);border-bottom:none`;
    heading.textContent = `${group.label} — ${groupJobs.length} job${groupJobs.length !== 1 ? "s" : ""}`;
    section.appendChild(heading);

    const table = document.createElement("table");
    table.className = "vinyl-queue-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Job #</th><th>Customer</th><th>Product</th><th>Size</th><th>Qty</th><th>Detail</th>
          <th>Artwork</th><th>Due</th><th>Printed</th><th>Finished</th><th>Status</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");
    groupJobs.forEach(job => tbody.appendChild(buildJobRow(job, vqStatusMap_)));
    section.appendChild(table);
    wrap.appendChild(section);
  });

  return wrap;
}

function renderIntake() {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <h3>Job Intake</h3>
    <div class="ji-section">
      <h4>Customer Details</h4>
      <div class="grid-2">
        <div class="kv"><label>Customer Name *</label><input id="ji-customer" required /></div>
        <div class="kv"><label>Customer Phone</label><input id="ji-phone" /></div>
      </div>
      <div class="grid-2">
        <div class="kv"><label>Customer Email</label><input id="ji-email" /></div>
        <div class="kv"><label>Hike Quote / Sales Reference<span id="ji-sales-star" class="req-star" style="display:none"> *</span></label><input id="ji-sales-ref" placeholder="Required when Paid" /></div>
      </div>
      <div class="grid-2">
        <div class="kv"><label>Staff <span class="req-star">*</span></label>
          <select id="ji-staff">
            <option value=""></option>
            <option>Chad</option>
            <option>Toufiecka</option>
            <option>Faith</option>
            <option>Wesley</option>
            <option>Ingrid</option>
            <option>Natasché</option>
          </select>
        </div>
      </div>
      <div class="grid-2">
        <div class="kv"><label>Job Source</label>
          <select id="ji-source">
            <option>Walk-in</option>
            <option>WhatsApp</option>
            <option>Email</option>
            <option>Phone</option>
            <option>App Intake</option>
          </select>
        </div>
        <div class="kv"><label>Notes</label><input id="ji-notes-inline" placeholder="Optional short note" /></div>
      </div>
    </div>

    <div class="ji-section">
      <h4>Job Details</h4>
      <div class="grid-2">
        <div class="kv"><label>Job Type *</label>
          <select id="ji-job-type">
            <option value="In-house Printing">In-house Printing</option>
            <option value="Outsourced Printing">Outsourced Printing</option>
            <option value="Design">Design</option>
            <option value="Ink/Stock Order">Ink/Stock Order</option>
            <option value="Cartridge Return">Cartridge Return</option>
          </select>
        </div>
        <div class="kv" id="ji-payment-row"><label>Payment Status</label>
          <select id="ji-payment">
            <option>Paid</option>
            <option>On Account</option>
            <option selected>Unpaid</option>
            <option>Partially Paid</option>
            <option>Pending</option>
            <option>Pay on Collection</option>
          </select>
        </div>
        <div class="kv" id="ji-payment-method-row" style="display:none"><label>Payment Method</label>
          <select id="ji-payment-method">
            <option value="">— select —</option>
            <option value="Card">Card</option>
            <option value="EFT">EFT</option>
            <option value="Cash">Cash</option>
            <option value="On Account">On Account</option>
          </select>
        </div>
        <div id="ji-poc-warning" style="display:none;font-size:12px;color:#9f3f08;padding:2px 0 4px;">Value exceeds R300 — take payment upfront.</div>
      </div>
      <div class="grid-2">
        <div class="kv" id="ji-value-row"><label>Job Value (R)</label><input id="ji-value" type="number" min="0" step="0.01" /></div>
        <div class="kv"><label></label><div></div></div>
      </div>
      <div class="grid-2" id="ji-turnaround-row">
        <div class="kv"><label>Turnaround Purchased</label>
          <select id="ji-turnaround">
            <option>2 Business Days</option>
            <option>3 Business Days</option>
            <option>5 Business Days</option>
            <option>7 Business Days</option>
          </select>
        </div>
        <div class="kv"><label></label><div></div></div>
      </div>
      <div class="grid-2">
        <div class="kv"><label>Promised Due Date</label><input id="ji-promised" type="date" /></div>
        <div class="kv" id="ji-urgent-row" style="display:none;"><label>Urgent Request (In-house)</label><select id="ji-urgent"><option value="No">No</option><option value="Yes">Yes</option></select></div>
      </div>
      <div class="kv"><label></label><div id="ji-due-hint">Suggested automatically from job type/turnaround.</div></div>
    </div>

    <div class="ji-section" id="ji-artwork-section">
      <h4>Artwork</h4>
      <div class="grid-2">
        <div class="kv"><label>Artwork Source</label>
          <select id="ji-artwork-source">
            <option value="">Select</option>
            <option>Customer supplied now</option>
            <option>Customer will send later</option>
            <option>WhatsApp</option>
            <option>Email</option>
            <option>ISG to design</option>
          </select>
        </div>
        <div class="kv"><label>Artwork Link</label><input id="ji-artwork-link" placeholder="https://..." /></div>
      </div>
      <div class="grid-2">
        <div class="kv"><label>Upload Artwork</label><input id="ji-artwork-file" type="file" /></div>
        <div class="kv"><label></label><div id="ji-upload-msg" class="save-msg"></div></div>
      </div>
      <div class="grid-2">
        <div class="kv" id="ji-artwork-approved-row"><label>Customer Approved Artwork?</label><select id="ji-artwork-approved"><option value="false">No</option><option value="true">Yes</option></select></div>
        <div class="kv"><label></label><div></div></div>
      </div>
    </div>

    <div id="ji-inhouse-section" class="ji-section">
      <h4>In-house Production</h4>
      <div class="grid-2">
        <div class="kv"><label>In-house Product Type</label>
          <div class="ji-product-search-wrap" id="ji-inhouse-search-wrap">
            <input type="text" class="ji-product-search-input" placeholder="Search or select product…" autocomplete="off">
            <div class="ji-product-search-results" style="display:none"></div>
          </div>
          <select id="ji-inhouse-type" style="display:none">
            <option value=""></option>
            <option>Vinyl Stickers</option>
            <option>Business Cards</option>
            <option>Flyers</option>
            <option>Posters</option>
            <option>Plan Prints</option>
            <option>DTF</option>
            <option>Standard Printing</option>
            <option>Photo Prints</option>
            <option>Canvas Prints</option>
            <option>Correx Boards</option>
            <option>Sublimation</option>
            <option>Other</option>
          </select>
        </div>
      </div>
      <div id="ji-inhouse-spec-fields"></div>
      <div id="ji-vinyl-extras" style="display:none;"></div>
      <div id="ji-vinyl-quote" class="ji-vinyl-quote" style="display:none;">
        <div class="spec-question-title">Vinyl Quote Preview (from owner pricing settings)</div>
        <div id="ji-vinyl-breakdown"></div>
        <div class="grid-2" id="ji-vinyl-summary-row">
          <div class="kv"><label>Total Retail Price</label><div id="ji-vinyl-total" class="kv-value">-</div></div>
          <div class="kv"><label>Price Per Sticker</label><div id="ji-vinyl-unit" class="kv-value">-</div></div>
        </div>
        <div class="actions">
          <button type="button" id="ji-vinyl-apply">Use Quote As Job Value</button>
          <span id="ji-vinyl-msg" class="save-msg"></span>
        </div>
      </div>
      <div id="ji-sp-quote" class="ji-vinyl-quote" style="display:none;">
        <div class="spec-question-title">Standard Printing Quote</div>
        <div id="ji-sp-breakdown"></div>
        <div class="actions">
          <button type="button" id="ji-sp-apply">Use Quote As Job Value</button>
          <span id="ji-sp-msg" class="save-msg"></span>
        </div>
      </div>
      <div id="ji-poster-lam-quote" class="ji-vinyl-quote" style="display:none;">
        <div class="spec-question-title">Poster Print Quote</div>
        <div id="ji-poster-lam-breakdown"></div>
        <div id="ji-poster-price-editor" style="display:none;"></div>
        <div class="actions">
          <button type="button" id="ji-poster-lam-apply">Use Quote As Job Value</button>
          <span id="ji-poster-lam-msg" class="save-msg"></span>
        </div>
      </div>
    </div>

    <div id="ji-outsourced-section" class="ji-section" style="display:none;">
      <h4>Outsourced Production</h4>
      <div class="grid-2">
        <div class="kv"><label>Outsourced Product Type</label>
          <div class="ji-product-search-wrap" id="ji-outsourced-search-wrap">
            <input type="text" class="ji-product-search-input" placeholder="Search or select product…" autocomplete="off">
            <div class="ji-product-search-results" style="display:none"></div>
          </div>
          <select id="ji-outsourced-type" style="display:none">
            <option value=""></option>
            <option>Business Cards (Bulk/Outsourced)</option>
            <option>Flyers (Bulk/Outsourced)</option>
            <option>Correx /ABS/ PVC Foam Board</option>
            <option>NCR Books</option>
            <option>Stamps</option>
            <option>Stickers</option>
            <option value="DTF">DTF — Customisable (Wesley to order)</option>
            <option>Other</option>
          </select>
        </div>
        <div class="kv"><label>Outsource Partner</label><select id="ji-partner"><option>Printstation</option><option>Customisable</option><option>Other</option></select></div>
      </div>
      <div class="grid-2">
        <div class="kv"><label>Turnaround Purchased</label><div id="ji-turnaround-readonly">Use Turnaround Purchased in Job Details above.</div></div>
        <div class="kv"><label></label><div></div></div>
      </div>
      <div id="ji-outsourced-spec-fields"></div>
    </div>

    <div id="ji-ink-section" class="ji-section" style="display:none;">
      <h4>Ink/Stock Fields</h4>
      <div class="grid-2">
        <div class="kv"><label>Supplier</label><select id="ji-supplier">
          <option value=""></option>
          <option>TVR - Canon (Original)</option>
          <option>Trink - Compatible Ink</option>
          <option>DCC - HP & Brother (Original)</option>
          <option>Kolok - Brother & Pantum (Original) & Large Format Paper</option>
          <option>Kalideck - Paper</option>
          <option>Peters Paper - Paper</option>
          <option>BSC - Stationery</option>
          <option>Other</option>
        </select></div>
        <div class="kv"><label>Ink/Stock Item</label><input id="ji-ink-item" placeholder="HP 123 Black x1" /></div>
      </div>
      <div class="kv"><label>Ink/Stock Specs</label><textarea id="ji-ink-specs" rows="3" placeholder="Model, quantity, brand"></textarea></div>
    </div>

    <div id="ji-return-section" class="ji-section" style="display:none;">
      <h4>Return Fields</h4>
      <div class="grid-2">
        <div class="kv"><label>Return Supplier</label><select id="ji-return-supplier">
          <option value=""></option>
          <option>TVR - Canon (Original)</option>
          <option>Trink - Compatible Ink</option>
          <option>DCC - HP & Brother (Original)</option>
          <option>Kolok - Brother & Pantum (Original) & Large Format Paper</option>
          <option>Kalideck - Paper</option>
          <option>Peters Paper - Paper</option>
          <option>BSC - Stationery</option>
          <option>Other</option>
        </select></div>
        <div class="kv"><label>Cartridge Brand</label><input id="ji-return-brand" /></div>
      </div>
      <div class="grid-2">
        <div class="kv"><label>Cartridge Model</label><input id="ji-return-model" /></div>
        <div class="kv"><label>Request Type</label><select id="ji-return-request"><option>Refund</option><option>Exchange</option></select></div>
      </div>
      <div class="kv"><label>Fault Description <span class="req-star">*</span></label><textarea id="ji-return-fault" rows="3"></textarea></div>
    </div>

    <div id="ji-design-section" class="ji-section" style="display:none;">
      <h4>Design Brief</h4>
      <div class="grid-2">
        <div class="kv"><label>Design Type <span class="req-star">*</span></label>
          <select id="ji-design-type">
            <option value="">— select —</option>
            <option>Logo Design</option>
            <option>Business Card Design</option>
            <option>Flyer / Leaflet Design</option>
            <option>Poster / Banner Design</option>
            <option>Social Media Graphic</option>
            <option>Signage Design</option>
            <option>Packaging Design</option>
            <option>Other</option>
          </select>
        </div>
        <div class="kv"><label>Deliverable Format</label>
          <select id="ji-design-format">
            <option value="">— select —</option>
            <option>Print-ready PDF</option>
            <option>Editable File (AI / PSD)</option>
            <option>Digital / Web (JPEG / PNG)</option>
            <option>Print-ready PDF + Editable File</option>
            <option>Multiple Formats</option>
          </select>
        </div>
      </div>
      <div class="kv"><label>Brief <span class="req-star">*</span></label><textarea id="ji-design-brief" rows="4" placeholder="Describe what the customer wants — style, colours, text to include, target audience, etc."></textarea></div>
      <div class="kv"><label>Reference / Inspiration Link</label><input id="ji-design-reference" placeholder="https://... (optional)" /></div>
    </div>

    <div id="ji-sublimation-section" class="ji-section" style="display:none;">
      <h4>Sublimation</h4>
      <div class="grid-2">
        <div class="kv"><label>Product <span class="req-star">*</span></label>
          <select id="ji-sublimation-product">
            <option value=""></option>
            <option>Mug</option>
            <option>Tumbler</option>
            <option>Clock</option>
            <option>Photo Display</option>
            <option>Coaster</option>
            <option>Can Holder</option>
            <option>Welcome Sign</option>
            <option>Puzzle</option>
            <option>Mouse Pad</option>
          </select>
        </div>
      </div>
      <div id="ji-sublimation-spec-fields"></div>
    </div>

    <div class="kv"><label>Notes</label><textarea id="ji-notes" rows="3"></textarea></div>
    <div class="actions">
      <button id="ji-save">Create Job</button>
      <button type="button" id="ji-reset" class="secondary">Reset Form</button>
      <span id="ji-msg" class="save-msg"></span>
    </div>
  `;
  hydrateIntakeDraft_(panel);
  bindIntakeDraftInputs_(panel);
  setupProductTypeSearch_(panel, "#ji-inhouse-search-wrap", "ji-inhouse-type");
  setupProductTypeSearch_(panel, "#ji-outsourced-search-wrap", "ji-outsourced-type");

  // Pre-fill from intakeDraft (set when "Add job to this order" is clicked)
  if (state.intakeDraft.customer)       { const el = panel.querySelector("#ji-customer"); if (el && !el.value) el.value = state.intakeDraft.customer; }
  if (state.intakeDraft.customerPhone)  { const el = panel.querySelector("#ji-phone");    if (el && !el.value) el.value = state.intakeDraft.customerPhone; }
  if (state.intakeDraft.customerEmail)  { const el = panel.querySelector("#ji-email");    if (el && !el.value) el.value = state.intakeDraft.customerEmail; }
  if (state.intakeDraft.orderGroup) {
    const banner = document.createElement("div");
    banner.className = "detail-nudge";
    banner.style.marginBottom = "8px";
    banner.textContent = `Linked to order ${state.intakeDraft.orderGroup} — this job will be grouped with existing jobs for ${state.intakeDraft.customer}.`;
    panel.querySelector("h3").after(banner);
  }

  const typeEl = panel.querySelector("#ji-job-type");
  const paymentEl = panel.querySelector("#ji-payment");
  const paymentRow = panel.querySelector("#ji-payment-row");
  const valueRow = panel.querySelector("#ji-value-row");
  const turnaroundEl = panel.querySelector("#ji-turnaround");
  const turnaroundRow = panel.querySelector("#ji-turnaround-row");
  const urgentRow = panel.querySelector("#ji-urgent-row");
  const artworkSection = panel.querySelector("#ji-artwork-section");
  const artworkApprovedRow = panel.querySelector("#ji-artwork-approved-row");
  const artworkApprovedEl = panel.querySelector("#ji-artwork-approved");
  const inhouseTypeEl = panel.querySelector("#ji-inhouse-type");
  const inhouseProofEl = null;
  const outsourcedTypeEl = panel.querySelector("#ji-outsourced-type");
  const inhouseSpecFieldsHost = panel.querySelector("#ji-inhouse-spec-fields");
  const outsourcedSpecFieldsHost = panel.querySelector("#ji-outsourced-spec-fields");
  const dueInput = panel.querySelector("#ji-promised");
  const dueHint = panel.querySelector("#ji-due-hint");
  const artworkFileEl = panel.querySelector("#ji-artwork-file");
  const uploadMsg = panel.querySelector("#ji-upload-msg");
  const artworkLinkEl = panel.querySelector("#ji-artwork-link");
  const artworkSourceEl = panel.querySelector("#ji-artwork-source");
  const inhouseSection = panel.querySelector("#ji-inhouse-section");
  const outsourcedSection = panel.querySelector("#ji-outsourced-section");
  const inkSection = panel.querySelector("#ji-ink-section");
  const returnSection = panel.querySelector("#ji-return-section");
  const sublimationSection = panel.querySelector("#ji-sublimation-section");
  const sublimationProductEl = panel.querySelector("#ji-sublimation-product");
  const sublimationSpecFieldsHost = panel.querySelector("#ji-sublimation-spec-fields");
  const vinylQuoteWrap = panel.querySelector("#ji-vinyl-quote");
  const vinylQuoteTotal = panel.querySelector("#ji-vinyl-total");
  const vinylQuoteUnit = panel.querySelector("#ji-vinyl-unit");
  const vinylQuoteMsg = panel.querySelector("#ji-vinyl-msg");
  const vinylApplyBtn = panel.querySelector("#ji-vinyl-apply");
  const vinylBreakdown = panel.querySelector("#ji-vinyl-breakdown");
  const vinylSummaryRow = panel.querySelector("#ji-vinyl-summary-row");
  const vinylExtrasHost = panel.querySelector("#ji-vinyl-extras");
  let latestVinylQuote = null;
  let vinylExtraDesigns = []; // additional designs beyond design 1

  const getVinylSpecInput_ = (fieldId) => panel.querySelector(`#${getSpecFieldId_("inhouse", "Vinyl Stickers", fieldId)}`);

  const renderVinylExtrasWidget_ = () => {
    if (!vinylExtrasHost) return;
    const rows = vinylExtraDesigns.map((d, i) => `
      <div class="vinyl-extra-row" data-idx="${i}" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <input type="number" class="ved-w" placeholder="W mm" min="1" value="${d.widthMm || ""}" style="width:70px;" />
        <span style="font-size:12px;color:var(--muted)">×</span>
        <input type="number" class="ved-h" placeholder="H mm" min="1" value="${d.heightMm || ""}" style="width:70px;" />
        <span style="font-size:12px;color:var(--muted)">mm</span>
        <input type="number" class="ved-q" placeholder="Qty" min="1" value="${d.qty || ""}" style="width:65px;" />
        <button type="button" class="ved-remove secondary" style="padding:2px 8px;font-size:12px;">✕</button>
      </div>`).join("");
    vinylExtrasHost.innerHTML = `
      <div style="margin:8px 0 4px;font-size:13px;font-weight:600;color:var(--label)">Additional Designs</div>
      <div id="vinyl-extra-rows">${rows}</div>
      <button type="button" id="vinyl-add-design" style="margin-top:4px;font-size:13px;">+ Add Design</button>
    `;
    vinylExtrasHost.querySelectorAll(".ved-remove").forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.closest(".vinyl-extra-row").dataset.idx);
        vinylExtraDesigns.splice(idx, 1);
        renderVinylExtrasWidget_();
        syncVinylIntakeQuote_();
      };
    });
    vinylExtrasHost.querySelectorAll(".ved-w,.ved-h,.ved-q").forEach(input => {
      input.addEventListener("input", () => {
        const row = input.closest(".vinyl-extra-row");
        const idx = Number(row.dataset.idx);
        vinylExtraDesigns[idx] = {
          widthMm:  Number(row.querySelector(".ved-w").value) || 0,
          heightMm: Number(row.querySelector(".ved-h").value) || 0,
          qty:      Number(row.querySelector(".ved-q").value) || 0,
        };
        syncVinylIntakeQuote_();
      });
    });
    const addBtn = vinylExtrasHost.querySelector("#vinyl-add-design");
    if (addBtn) addBtn.onclick = () => {
      vinylExtraDesigns.push({ widthMm: 0, heightMm: 0, qty: 0 });
      renderVinylExtrasWidget_();
      syncVinylIntakeQuote_();
      const newRow = vinylExtrasHost.querySelectorAll(".vinyl-extra-row");
      if (newRow.length) newRow[newRow.length - 1].querySelector(".ved-w").focus();
    };
  };

  const syncVinylIntakeQuote_ = () => {
    const isVinyl = typeEl.value === "In-house Printing" && inhouseTypeEl.value === "Vinyl Stickers";
    if (!vinylQuoteWrap) return;
    vinylQuoteWrap.style.display = isVinyl ? "" : "none";
    if (vinylExtrasHost) vinylExtrasHost.style.display = isVinyl ? "" : "none";
    if (!isVinyl) {
      latestVinylQuote = null;
      if (vinylQuoteTotal) vinylQuoteTotal.textContent = "-";
      if (vinylQuoteUnit) vinylQuoteUnit.textContent = "-";
      if (vinylQuoteMsg) vinylQuoteMsg.textContent = "";
      if (vinylBreakdown) vinylBreakdown.innerHTML = "";
      return;
    }
    const w1 = Number(getVinylSpecInput_("sticker_width_mm") ? getVinylSpecInput_("sticker_width_mm").value : 0);
    const h1 = Number(getVinylSpecInput_("sticker_height_mm") ? getVinylSpecInput_("sticker_height_mm").value : 0);
    const q1 = Number(getVinylSpecInput_("quantity") ? getVinylSpecInput_("quantity").value : 0);
    const allDesigns = [{ widthMm: w1, heightMm: h1, qty: q1 }, ...vinylExtraDesigns];
    const validDesigns = allDesigns.filter(d => d.widthMm > 0 && d.heightMm > 0 && d.qty > 0);
    const multiQuote = calculateVinylMultiQuote_(validDesigns);
    latestVinylQuote = multiQuote;
    if (!multiQuote) {
      if (vinylBreakdown) vinylBreakdown.innerHTML = "";
      if (vinylSummaryRow) vinylSummaryRow.style.display = "";
      if (vinylQuoteTotal) vinylQuoteTotal.textContent = "Enter width, height and quantity";
      if (vinylQuoteUnit) vinylQuoteUnit.textContent = "-";
      if (vinylQuoteMsg) vinylQuoteMsg.textContent = "";
      return;
    }
    const totalQty = multiQuote.lines.reduce((s, l) => s + l.qty, 0);
    if (multiQuote.lines.length > 1) {
      const bRows = multiQuote.lines.map((l, i) =>
        `<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;border-bottom:1px solid var(--border)">
          <span>Design ${i + 1}: ${l.widthMm}×${l.heightMm}mm × ${l.qty}</span>
          <span>${l.areaM2.toFixed(4)} m²</span>
        </div>`).join("");
      if (vinylBreakdown) vinylBreakdown.innerHTML = `<div style="margin-bottom:8px">${bRows}<div style="font-size:11px;color:var(--muted);padding-top:2px">Combined area: ${multiQuote.totalAreaM2.toFixed(4)} m²</div></div>`;
      if (vinylSummaryRow) vinylSummaryRow.style.display = "";
      if (vinylQuoteTotal) vinylQuoteTotal.textContent = formatCurrencyR_(multiQuote.finalTotal);
      if (vinylQuoteUnit) vinylQuoteUnit.textContent = `${totalQty} stickers total`;
    } else {
      if (vinylBreakdown) vinylBreakdown.innerHTML = "";
      if (vinylSummaryRow) vinylSummaryRow.style.display = "";
      if (vinylQuoteTotal) vinylQuoteTotal.textContent = formatCurrencyR_(multiQuote.finalTotal);
      if (vinylQuoteUnit) vinylQuoteUnit.textContent = formatCurrencyR_(multiQuote.finalTotal / totalQty);
    }
    if (vinylQuoteMsg) vinylQuoteMsg.textContent = "";
  };
  const syncTypeSections = () => {
    const t = typeEl.value;
    inhouseSection.style.display = t === "In-house Printing" ? "" : "none";
    outsourcedSection.style.display = t === "Outsourced Printing" ? "" : "none";
    inkSection.style.display = t === "Ink/Stock Order" ? "" : "none";
    returnSection.style.display = t === "Cartridge Return" ? "" : "none";
    if (artworkSection) artworkSection.style.display = (t === "In-house Printing" || t === "Outsourced Printing") ? "" : "none";
    const designSection = panel.querySelector("#ji-design-section");
    if (designSection) designSection.style.display = t === "Design" ? "" : "none";
    if (artworkApprovedRow) artworkApprovedRow.style.display = (t === "In-house Printing" || t === "Outsourced Printing") ? "" : "none";
    if (urgentRow) urgentRow.style.display = t === "In-house Printing" ? "" : "none";
    if (paymentRow) paymentRow.style.display = t === "Cartridge Return" ? "none" : "";
    if (valueRow) valueRow.style.display = t === "Cartridge Return" ? "none" : "";
    if (t === "Cartridge Return") {
      if (paymentEl) paymentEl.value = "";
      const valueEl = panel.querySelector("#ji-value");
      if (valueEl) valueEl.value = "";
    }
    if (t === "Ink/Stock Order" && !["Unpaid", "Partially Paid", "Pending"].includes(paymentEl.value)) {
      paymentEl.value = "Unpaid";
    }
    if (turnaroundRow) turnaroundRow.style.display = (t === "Outsourced Printing") ? "" : "none";
    const suggested = getSuggestedDueDateForInputs_(t, turnaroundEl ? turnaroundEl.value : "");
    if (dueInput && suggested) {
      if (t === "Outsourced Printing") {
        dueInput.value = suggested;
        dueHint.textContent = "Auto-set from Turnaround Purchased (+1 dispatch day).";
      } else if (!dueInput.value) {
        dueInput.value = suggested;
        dueHint.textContent = "Suggested automatically from job type.";
      } else {
        dueHint.textContent = "Suggested automatically from job type.";
      }
    }
    syncVinylIntakeQuote_();
    syncSpIntakeQuote_();
    syncPosterLamQuote_();
  };
  const syncArtworkSourceRules = () => {
    if (!artworkSourceEl) return;
    const hasArtwork = !!String(artworkLinkEl ? artworkLinkEl.value : "").trim();
    const sendLaterOpt = Array.from(artworkSourceEl.options || [])
      .find(o => String(o.value || "").trim() === "Customer will send later");
    if (sendLaterOpt) sendLaterOpt.disabled = hasArtwork;
    if (hasArtwork && artworkSourceEl.value === "Customer will send later") {
      artworkSourceEl.value = "Customer supplied now";
      state.intakeDraft["ji-artwork-source"] = artworkSourceEl.value;
    }
  };
  typeEl.onchange = syncTypeSections;
  if (turnaroundEl) {
    turnaroundEl.onchange = () => {
      if (!dueInput) return;
      const suggested = getSuggestedDueDateForInputs_(typeEl.value, turnaroundEl.value);
      if (suggested && typeEl.value === "Outsourced Printing") {
        dueInput.value = suggested;
        dueHint.textContent = "Updated from Turnaround Purchased (+1 dispatch day).";
      }
    };
  }
  const applyDtfDefaults_ = () => {
    if (turnaroundEl) turnaroundEl.value = "3 Business Days";
    if (dueInput) {
      dueInput.value = formatYmdLocal_(addBusinessDaysLocal_(new Date(), 3));
      if (dueHint) dueHint.textContent = "Auto-set: 3 business days for DTF (Customisable).";
    }
  };
  inhouseTypeEl.onchange = () => {
    const isSub = inhouseTypeEl.value === "Sublimation";
    if (sublimationSection) sublimationSection.style.display = isSub ? "" : "none";
    renderSpecQuestions_(panel, inhouseSpecFieldsHost, "inhouse", isSub ? "" : inhouseTypeEl.value);
    if (inhouseTypeEl.value === "Vinyl Stickers") {
      vinylExtraDesigns = [];
      renderVinylExtrasWidget_();
    } else if (vinylExtrasHost) {
      vinylExtrasHost.style.display = "none";
    }
    syncVinylIntakeQuote_();
    syncSpIntakeQuote_();
    if (inhouseTypeEl.value === "DTF") applyDtfDefaults_();
  };
  outsourcedTypeEl.onchange = () => {
    renderSpecQuestions_(panel, outsourcedSpecFieldsHost, "outsourced", outsourcedTypeEl.value);
    const partnerEl = panel.querySelector("#ji-partner");
    if (outsourcedTypeEl.value === "DTF") {
      if (partnerEl) partnerEl.value = "Customisable";
      applyDtfDefaults_();
    }
  };
  if (sublimationProductEl) {
    sublimationProductEl.onchange = () => {
      renderSpecQuestions_(panel, sublimationSpecFieldsHost, "sublimation", sublimationProductEl.value);
    };
  }
  if (vinylApplyBtn) {
    vinylApplyBtn.onclick = () => {
      if (!latestVinylQuote) {
        if (vinylQuoteMsg) vinylQuoteMsg.textContent = "Enter valid size and quantity first.";
        return;
      }
      const valueEl = panel.querySelector("#ji-value");
      if (valueEl) {
        valueEl.value = Number(latestVinylQuote.finalTotal).toFixed(2);
        state.intakeDraft["ji-value"] = valueEl.value;
      }
      if (vinylQuoteMsg) vinylQuoteMsg.textContent = "Job value updated from quote.";
    };
  }
  inhouseSpecFieldsHost.addEventListener("input", syncVinylIntakeQuote_);
  inhouseSpecFieldsHost.addEventListener("change", syncVinylIntakeQuote_);
  inhouseSpecFieldsHost.addEventListener("keyup", syncVinylIntakeQuote_);
  const spQuoteWrap  = panel.querySelector("#ji-sp-quote");
  const spBreakdown  = panel.querySelector("#ji-sp-breakdown");
  const spQuoteMsg   = panel.querySelector("#ji-sp-msg");
  const spApplyBtn   = panel.querySelector("#ji-sp-apply");
  let latestSpQuote  = null;
  const getSpSpec_ = (fieldId) => panel.querySelector(`#${getSpecFieldId_("inhouse", "Standard Printing", fieldId)}`);
  const syncSpIntakeQuote_ = () => {
    const isSp = typeEl.value === "In-house Printing" && inhouseTypeEl.value === "Standard Printing";
    if (!spQuoteWrap) return;
    spQuoteWrap.style.display = isSp ? "" : "none";
    if (!isSp) { latestSpQuote = null; return; }
    const size        = getSpSpec_("size")        ? getSpSpec_("size").value        : "";
    const sides       = getSpSpec_("sides")       ? getSpSpec_("sides").value       : "";
    const colour      = getSpSpec_("colour")      ? getSpSpec_("colour").value      : "";
    const lamination  = getSpSpec_("lamination")  ? getSpSpec_("lamination").value  : "None";
    const binding     = getSpSpec_("binding")     ? getSpSpec_("binding").value     : "None";
    const numBooklets = Number(getSpSpec_("num_booklets") ? getSpSpec_("num_booklets").value : 0);
    const qty         = Number(getSpSpec_("quantity")     ? getSpSpec_("quantity").value     : 0);
    const quote       = calculateStandardPrintingQuote_(size, sides, colour, qty, lamination, binding, numBooklets);
    latestSpQuote = quote;
    if (!spBreakdown) return;
    if (spQuoteMsg) spQuoteMsg.textContent = "";
    if (!quote) {
      const priceable = ["A4", "A3", "SRA3"].includes(size);
      spBreakdown.innerHTML = `<div class="muted" style="font-size:13px;padding:4px 0">${priceable ? "Complete all fields to see quote" : (size ? "Size not in standard price list" : "—")}</div>`;
      return;
    }
    let rows = "";
    rows += `<div class="sp-quote-row"><span>Printing (${quote.qty} × ${formatCurrencyR_(quote.pp)}/page)</span><span>${formatCurrencyR_(quote.printingTotal)}</span></div>`;
    if (quote.laminationTotal > 0) {
      const lamIsRoll = quote.lam === "OPP Laminating" || quote.lam === "Roll Encapsulation";
      const lamNote = lamIsRoll ? (quote.laminationMinimumApplied ? " — minimum charge" : " (incl. 2 sheets waste)") : "";
      rows += `<div class="sp-quote-row"><span>Lamination — ${escapeHtml(quote.lam)}${lamNote}</span><span>${formatCurrencyR_(quote.laminationTotal)}</span></div>`;
    }
    if (quote.bindingTotal > 0) {
      rows += `<div class="sp-quote-row"><span>Comb Bind — ${escapeHtml(quote.bindingRingSize)} ring × ${quote.numBooklets} booklets (${formatCurrencyR_(quote.bindingPerBooklet)} each)</span><span>${formatCurrencyR_(quote.bindingTotal)}</span></div>`;
      rows += `<div class="sp-quote-subrow">Covers charged separately — R4.00 each (front + back per booklet)</div>`;
    }
    rows += `<div class="sp-quote-row sp-quote-total"><span>Total (Incl VAT)</span><span>${formatCurrencyR_(quote.total)}</span></div>`;
    let notices = "";
    if (quote.laminationError) {
      notices += `<div class="sp-quote-notice sp-notice-error">${escapeHtml(quote.laminationError)}</div>`;
    }
    if (quote.bindingError) {
      notices += `<div class="sp-quote-notice sp-notice-warn">${escapeHtml(quote.bindingError)}</div>`;
    }
    spBreakdown.innerHTML = `<div class="sp-quote-lines">${rows}</div>${notices}`;
  };
  if (spApplyBtn) {
    spApplyBtn.onclick = () => {
      if (!latestSpQuote) { if (spQuoteMsg) spQuoteMsg.textContent = "Enter all fields first."; return; }
      const valueEl = panel.querySelector("#ji-value");
      if (valueEl) { valueEl.value = Number(latestSpQuote.total).toFixed(2); state.intakeDraft["ji-value"] = valueEl.value; }
      if (spQuoteMsg) spQuoteMsg.textContent = "Job value updated from quote.";
    };
  }

  const posterLamWrap   = panel.querySelector("#ji-poster-lam-quote");
  const posterLamBD     = panel.querySelector("#ji-poster-lam-breakdown");
  const posterPriceEd   = panel.querySelector("#ji-poster-price-editor");
  const posterLamMsg    = panel.querySelector("#ji-poster-lam-msg");
  const posterLamApply  = panel.querySelector("#ji-poster-lam-apply");
  let latestPosterQuote = null;
  let posterPrices_     = getPosterPrintPrices_();
  const getPosterSpec_  = (fieldId) => panel.querySelector(`#${getSpecFieldId_("inhouse", "Posters", fieldId)}`);

  const renderPosterPriceEditor_ = () => {
    if (!posterPriceEd) return;
    const isOwner = state.role === "owner" || state.ownerUnlocked;
    if (!isOwner) { posterPriceEd.style.display = "none"; return; }
    posterPriceEd.style.display = "";
    const sizes = ["A3", "A2", "A1", "A0"];
    posterPriceEd.innerHTML = `
      <div style="margin:8px 0 4px;font-size:12px;font-weight:600;color:var(--color-muted);">Print Prices (Owner — editable)</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        ${sizes.map(sz => `
          <div class="kv" style="margin:0;min-width:70px;flex:1;">
            <label style="font-size:11px;">${sz}</label>
            <input type="number" min="0" step="1" data-poster-size="${sz}"
              value="${Number(posterPrices_[sz] || 0).toFixed(0)}"
              style="width:100%;padding:4px 6px;font-size:13px;" />
          </div>`).join("")}
      </div>`;
    posterPriceEd.querySelectorAll("input[data-poster-size]").forEach(inp => {
      inp.addEventListener("input", () => {
        const sz = inp.dataset.posterSize;
        const val = parseFloat(inp.value);
        posterPrices_[sz] = isNaN(val) ? 0 : val;
        savePosterPrintPrices_(posterPrices_);
        syncPosterLamQuote_();
      });
    });
  };

  const syncPosterLamQuote_ = () => {
    const isPoster = typeEl.value === "In-house Printing" && inhouseTypeEl.value === "Posters";
    if (!posterLamWrap) return;
    posterLamWrap.style.display = isPoster ? "" : "none";
    if (!isPoster) { latestPosterQuote = null; return; }
    const size = getPosterSpec_("size") ? getPosterSpec_("size").value : "";
    const lam  = getPosterSpec_("lam")  ? getPosterSpec_("lam").value  : "None";
    const qty  = Number(getPosterSpec_("quantity") ? getPosterSpec_("quantity").value : 0);
    const quote = calculatePosterQuote_(size, lam, qty, posterPrices_);
    latestPosterQuote = quote;
    renderPosterPriceEditor_();
    if (!posterLamBD) return;
    if (posterLamMsg) posterLamMsg.textContent = "";
    if (!size || !(qty > 0)) {
      posterLamBD.innerHTML = `<div class="muted" style="font-size:13px;padding:4px 0">Enter size and quantity to see quote.</div>`;
      return;
    }
    if (!quote) {
      posterLamBD.innerHTML = `<div class="muted" style="font-size:13px;padding:4px 0">${size ? "No pricing set for this size." : "Select a size to see quote."}</div>`;
      return;
    }
    let rows = "";
    if (quote.hasPrint) {
      rows += `<div class="sp-quote-row"><span>Printing (${quote.qty} × ${formatCurrencyR_(quote.printPp)})</span><span>${formatCurrencyR_(quote.printTotal)}</span></div>`;
    } else if (!quote.noPricingForSize) {
      rows += `<div class="sp-quote-row muted"><span>Printing</span><span>—</span></div>`;
    }
    if (quote.hasLam && !quote.laminationError && quote.laminationTotal > 0) {
      const lamNote = quote.laminationMinimumApplied ? " — minimum charge" : " (incl. 2 sheets waste)";
      rows += `<div class="sp-quote-row"><span>Lamination — ${escapeHtml(quote.lam)}${lamNote}</span><span>${formatCurrencyR_(quote.laminationTotal)}</span></div>`;
    }
    rows += `<div class="sp-quote-row sp-quote-total"><span>Total (Incl VAT)</span><span>${formatCurrencyR_(quote.total)}</span></div>`;
    let notices = "";
    if (quote.laminationError) {
      notices += `<div class="sp-quote-notice sp-notice-error">${escapeHtml(quote.laminationError)}</div>`;
    }
    if (quote.noPricingForSize) {
      notices += `<div class="sp-quote-notice sp-notice-warn">No print price set for ${escapeHtml(size)} — set one above to include printing in the total.</div>`;
    }
    posterLamBD.innerHTML = `<div class="sp-quote-lines">${rows}</div>${notices}`;
  };

  if (posterLamApply) {
    posterLamApply.onclick = () => {
      if (!latestPosterQuote || latestPosterQuote.laminationError) {
        if (posterLamMsg) posterLamMsg.textContent = latestPosterQuote && latestPosterQuote.laminationError ? "Fix lamination error first." : "Enter size and quantity first.";
        return;
      }
      const valueEl = panel.querySelector("#ji-value");
      if (valueEl) { valueEl.value = Number(latestPosterQuote.total).toFixed(2); state.intakeDraft["ji-value"] = valueEl.value; }
      if (posterLamMsg) posterLamMsg.textContent = "Job value updated from quote.";
    };
  }

  inhouseSpecFieldsHost.addEventListener("input",  syncSpIntakeQuote_);
  inhouseSpecFieldsHost.addEventListener("change", syncSpIntakeQuote_);
  inhouseSpecFieldsHost.addEventListener("keyup",  syncSpIntakeQuote_);
  inhouseSpecFieldsHost.addEventListener("input",  syncPosterLamQuote_);
  inhouseSpecFieldsHost.addEventListener("change", syncPosterLamQuote_);
  inhouseSpecFieldsHost.addEventListener("keyup",  syncPosterLamQuote_);
  renderSpecQuestions_(panel, inhouseSpecFieldsHost, "inhouse", inhouseTypeEl.value);
  renderSpecQuestions_(panel, outsourcedSpecFieldsHost, "outsourced", outsourcedTypeEl.value);
  renderSpecQuestions_(panel, sublimationSpecFieldsHost, "sublimation", sublimationProductEl ? sublimationProductEl.value : "");
  if (inhouseTypeEl.value === "Vinyl Stickers") renderVinylExtrasWidget_();
  syncTypeSections();
  syncArtworkSourceRules();
  syncVinylIntakeQuote_();
  syncSpIntakeQuote_();
  syncPosterLamQuote_();
  if (artworkLinkEl) {
    artworkLinkEl.addEventListener("input", syncArtworkSourceRules);
    artworkLinkEl.addEventListener("change", syncArtworkSourceRules);
  }
  if (artworkSourceEl) {
    artworkSourceEl.addEventListener("change", syncArtworkSourceRules);
  }
  const jiPaymentEl = panel.querySelector("#ji-payment");
  const jiPaymentMethodRow = panel.querySelector("#ji-payment-method-row");
  const jiPocWarning = panel.querySelector("#ji-poc-warning");
  const jiValueEl = panel.querySelector("#ji-value");
  const syncJiPayment = () => {
    const v = jiPaymentEl ? jiPaymentEl.value : "";
    if (jiPaymentMethodRow) jiPaymentMethodRow.style.display = v === "Paid" ? "" : "none";
    if (jiPocWarning) {
      const val = parseFloat(jiValueEl ? jiValueEl.value : 0) || 0;
      const jobTypeVal = panel.querySelector("#ji-job-type") ? panel.querySelector("#ji-job-type").value : "";
      const isInkOrReturn = jobTypeVal === "Ink/Stock Order" || jobTypeVal === "Cartridge Return";
      jiPocWarning.style.display = (v === "Pay on Collection" && val > 300 && !isInkOrReturn) ? "" : "none";
    }
    const salesStar = panel.querySelector("#ji-sales-star");
    if (salesStar) salesStar.style.display = v === "Paid" ? "" : "none";
  };
  if (jiPaymentEl) jiPaymentEl.addEventListener("change", syncJiPayment);
  if (jiValueEl) jiValueEl.addEventListener("input", syncJiPayment);
  syncJiPayment();

  const jiResetBtn = panel.querySelector("#ji-reset");
  if (jiResetBtn) {
    jiResetBtn.onclick = () => {
      if (!window.confirm("Clear the form and start fresh?")) return;
      state.intakeDraft = {};
      render();
    };
  }

  panel.querySelector("#ji-save").onclick = async () => {
    const msg = panel.querySelector("#ji-msg");
    msg.textContent = "Creating...";
    const jobType = panel.querySelector("#ji-job-type").value || "";
    const inkSpecs = panel.querySelector("#ji-ink-specs").value || "";
    const inkItem = panel.querySelector("#ji-ink-item").value || "";
    const returnFault = panel.querySelector("#ji-return-fault").value || "";
    const inhouseComposedSpecsRaw = composeSpecsFromQuestions_(panel, "inhouse", inhouseTypeEl.value);
    const isVinylMulti = jobType === "In-house Printing" && inhouseTypeEl.value === "Vinyl Stickers" && vinylExtraDesigns.filter(d => d.widthMm > 0 && d.heightMm > 0 && d.qty > 0).length > 0;
    const vinylExtraLines = isVinylMulti
      ? vinylExtraDesigns.filter(d => d.widthMm > 0 && d.heightMm > 0 && d.qty > 0)
          .map((d, i) => `Design ${i + 2}: ${d.widthMm}×${d.heightMm}mm × ${d.qty}`)
          .join("\n")
      : "";
    const inhouseComposedSpecs = isVinylMulti ? [inhouseComposedSpecsRaw, vinylExtraLines].filter(Boolean).join("\n") : inhouseComposedSpecsRaw;
    const outsourcedComposedSpecs = composeSpecsFromQuestions_(panel, "outsourced", outsourcedTypeEl.value);
    const sublimationProduct = sublimationProductEl ? sublimationProductEl.value : "";
    const isSublimation = jobType === "In-house Printing" && inhouseTypeEl.value === "Sublimation";
    const sublimationComposedSpecs = isSublimation
      ? [`Product: ${sublimationProduct}`, composeSpecsFromQuestions_(panel, "sublimation", sublimationProduct)].filter(Boolean).join("\n")
      : "";
    const isDesign = jobType === "Design";
    const designType   = isDesign && panel.querySelector("#ji-design-type")      ? panel.querySelector("#ji-design-type").value      : "";
    const designBrief  = isDesign && panel.querySelector("#ji-design-brief")     ? panel.querySelector("#ji-design-brief").value     : "";
    const designFormat = isDesign && panel.querySelector("#ji-design-format")    ? panel.querySelector("#ji-design-format").value    : "";
    const designRef    = isDesign && panel.querySelector("#ji-design-reference") ? panel.querySelector("#ji-design-reference").value : "";
    const designSpecs  = isDesign
      ? [
          designType   ? `Type: ${designType}`        : "",
          designBrief  ? `Brief: ${designBrief}`      : "",
          designFormat ? `Format: ${designFormat}`    : "",
          designRef    ? `Reference: ${designRef}`    : "",
        ].filter(Boolean).join("\n")
      : "";
    const specs =
      (isSublimation ? sublimationComposedSpecs : jobType === "In-house Printing" ? inhouseComposedSpecs : "") ||
      (jobType === "Outsourced Printing" ? outsourcedComposedSpecs : "") ||
      (jobType === "Ink/Stock Order" ? [inkItem, inkSpecs].filter(Boolean).join("\n") : "") ||
      (isDesign ? designSpecs : "") ||
      "";

    const payload = {
      staff: panel.querySelector("#ji-staff").value || "",
      source: panel.querySelector("#ji-source").value || "App Intake",
      customer: panel.querySelector("#ji-customer").value || "",
      value: panel.querySelector("#ji-value").value || "",
      paymentStatus: panel.querySelector("#ji-payment").value || "",
      paymentMethod: panel.querySelector("#ji-payment-method") ? panel.querySelector("#ji-payment-method").value : "",
      "Payment Method": panel.querySelector("#ji-payment-method") ? panel.querySelector("#ji-payment-method").value : "",
      "Hike Quote / Sale Reference": panel.querySelector("#ji-sales-ref").value || "",
      jobType,
      inhouseType: panel.querySelector("#ji-inhouse-type").value || "",
      "In-house Product Type": panel.querySelector("#ji-inhouse-type").value || "",
      "In-House Product Type": panel.querySelector("#ji-inhouse-type").value || "",
      "Product Type": panel.querySelector("#ji-inhouse-type").value || panel.querySelector("#ji-outsourced-type").value || "",
      outsourcedType: panel.querySelector("#ji-outsourced-type").value || "",
      turnaroundPurchased: jobType === "Outsourced Printing" && panel.querySelector("#ji-turnaround")
        ? panel.querySelector("#ji-turnaround").value
        : "",
      promisedDueDate: panel.querySelector("#ji-promised").value || "",
      artworkSource: panel.querySelector("#ji-artwork-source").value || "",
      artworkLink: panel.querySelector("#ji-artwork-link").value || "",
      "Artwork Upload Link": panel.querySelector("#ji-artwork-link").value || "",
      "Artwork Link": panel.querySelector("#ji-artwork-link").value || "",
      specs,
      notes: panel.querySelector("#ji-notes").value || "",
      outsourcePartner: panel.querySelector("#ji-partner") ? panel.querySelector("#ji-partner").value : "",
      supplier: panel.querySelector("#ji-supplier") ? panel.querySelector("#ji-supplier").value : "",
      customerPhone: normalizePhoneZa_(panel.querySelector("#ji-phone").value || ""),
      customerEmail: panel.querySelector("#ji-email").value || "",
      customerApproved: (jobType === "In-house Printing" || jobType === "Outsourced Printing")
        ? artworkApprovedEl.value === "true"
        : false,
      "Return Supplier": panel.querySelector("#ji-return-supplier") ? panel.querySelector("#ji-return-supplier").value : "",
      "Cartridge Brand": panel.querySelector("#ji-return-brand") ? panel.querySelector("#ji-return-brand").value : "",
      "Cartridge Model": panel.querySelector("#ji-return-model") ? panel.querySelector("#ji-return-model").value : "",
      "Return Request Type": panel.querySelector("#ji-return-request") ? panel.querySelector("#ji-return-request").value : "",
      "Return Fault Description": returnFault,
      "Return Sales Reference No.": panel.querySelector("#ji-sales-ref").value || "",
      orderGroup: state.intakeDraft.orderGroup || "",
      "Order #": state.intakeDraft.orderGroup || "",
    };
    const file = artworkFileEl && artworkFileEl.files && artworkFileEl.files[0] ? artworkFileEl.files[0] : null;
    const hasArtworkInput = !!String(payload.artworkLink || "").trim() || !!file;
    const artworkSourceNow = String(payload.artworkSource || "").trim();
    const sourceRequiresArtworkNow = ["Customer supplied now"].includes(artworkSourceNow);
    if (jobType === "Cartridge Return") {
      payload.value = "";
      payload.paymentStatus = "";
    }
    if (jobType === "In-house Printing" && panel.querySelector("#ji-urgent").value === "Yes") {
      payload.notes = ["URGENT REQUEST", panel.querySelector("#ji-notes-inline").value || "", payload.notes || ""].filter(Boolean).join(" | ");
    } else {
      payload.notes = [panel.querySelector("#ji-notes-inline").value || "", payload.notes || ""].filter(Boolean).join(" | ");
    }

    const errors = [];
    if (!String(payload.staff || "").trim()) {
      errors.push("Staff selection is required.");
    }
    if (!payload.customer.trim()) {
      errors.push("Customer Name is required.");
    }
    if (!jobType.trim()) {
      errors.push("Job Type is required.");
    }
    if (jobType !== "Cartridge Return") {
      const valueNum = Number(payload.value);
      if (!payload.value || Number.isNaN(valueNum) || valueNum <= 0) {
        errors.push("Job Value (R) is required and must be greater than 0.");
      }
    }
    if (jobType === "In-house Printing" || jobType === "Outsourced Printing") {
      if (!payload.artworkSource.trim() && !hasArtworkInput) errors.push("Artwork Source is required when no artwork is uploaded.");
      if (sourceRequiresArtworkNow && !hasArtworkInput) {
        errors.push("Artwork file/upload link is required for the selected Artwork Source.");
      }
    }
    if (jobType !== "Cartridge Return" && payload.paymentStatus === "Paid" && !String(payload["Hike Quote / Sale Reference"] || "").trim()) {
      errors.push("Hike Quote / Sales Reference is required when Payment Status is Paid.");
    }
    if (payload.paymentStatus === "Paid" && !String(payload.paymentMethod || "").trim()) {
      errors.push("Payment method (Card / EFT / Cash / On Account) is required when Payment Status is Paid.");
    }

    if (jobType === "In-house Printing") {
      if (!payload.inhouseType.trim()) errors.push("In-house Product Type is required.");
      if (!inhouseComposedSpecsRaw.trim()) errors.push("Please complete in-house spec questions.");
    }

    if (jobType === "Outsourced Printing") {
      if (!payload.outsourcedType.trim()) errors.push("Outsourced Product Type is required.");
      if (!payload.outsourcePartner.trim()) errors.push("Outsource Partner is required.");
      if (!payload.turnaroundPurchased.trim()) errors.push("Turnaround Purchased is required.");
      if (!outsourcedComposedSpecs.trim()) errors.push("Please complete outsourced spec questions.");
    }

    if (jobType === "Ink/Stock Order") {
      if (!payload.supplier.trim()) errors.push("Supplier is required for Ink/Stock orders.");
      if (!inkItem.trim() && !inkSpecs.trim()) errors.push("Ink/Stock item or specs are required.");
    }

    if (jobType === "Cartridge Return") {
      if (!String(payload["Return Sales Reference No."] || "").trim()) errors.push("Sales Reference is required for Cartridge Returns.");
      if (!payload["Cartridge Brand"].trim()) errors.push("Cartridge Brand is required.");
      if (!payload["Cartridge Model"].trim()) errors.push("Cartridge Model is required.");
      if (!returnFault.trim()) errors.push("Fault Description is required.");
    }

    if (isDesign) {
      if (!designType.trim()) errors.push("Design Type is required.");
      if (!designBrief.trim()) errors.push("Brief is required — describe what the customer wants.");
    }

    if (errors.length) {
      msg.textContent = errors.join(" ");
      return;
    }

    const createdToday = state.jobs.filter(j =>
      String(j.customer || "").trim().toLowerCase() === payload.customer.trim().toLowerCase() &&
      String(j.product || "").trim().toLowerCase() === String(payload.inhouseType || payload.outsourcedType || inkItem || "").trim().toLowerCase()
    );
    if (createdToday.length) {
      const ok = window.confirm("Possible duplicate job found for this customer/product. Create anyway?");
      if (!ok) {
        msg.textContent = "Create cancelled.";
        return;
      }
    }

    try {
      if (payload.artworkLink && payload.artworkSource === "Customer will send later") {
        payload.artworkSource = "Customer supplied now";
      }
      const res = await fetch(API.baseUrl, {
        method: "POST",
      body: JSON.stringify({
        action: "createJob",
        key: API.key,
        fastWrite: true,
        job: payload,
      }),
      });
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || "Create failed");
      const created = toLocalJob(out.data || {});
      if (created.jobNo) {
        state.jobs = [created, ...state.jobs.filter(j => j.jobNo !== created.jobNo)];
        state.selectedJobNo = created.jobNo;
        state.tab = "job_detail";
        state.intakeDraft = {};
      }
      msg.textContent = "Job created.";
      render();
      scheduleSilentRefresh_(5000);
      // Order grouping prompt (only if no order group was pre-set)
      if (created.jobNo && !payload.orderGroup) {
        const sameCustomerOpen = state.jobs.filter(j =>
          j.jobNo !== created.jobNo &&
          String(j.customer || "").trim().toLowerCase() === String(payload.customer || "").trim().toLowerCase() &&
          !["Collected", "Closed", "Cancelled"].includes(j.status) &&
          !isSoftDeleted_(j)
        );
        if (sameCustomerOpen.length) {
          showOrderGroupingModal_(created, sameCustomerOpen);
          return;
        }
      }
      // Order confirmation notification
      if (created.jobNo) {
        showOrderConfirmationModal_(created);
      }
      // Fast UX: create job immediately, then upload artwork in background.
      if (file && !payload.artworkLink && created.jobNo) {
        state.saveMessage = "Job created. Uploading artwork...";
        render();
        (async () => {
          try {
            let url = "";
            let lastErr = "";
            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                url = await uploadArtworkFile_(file, payload.customer || "");
                if (url) break;
              } catch (uErr) {
                lastErr = String(uErr && uErr.message ? uErr.message : uErr);
              }
            }
            if (!url) {
              state.saveMessage = `Job created, but artwork upload failed: ${lastErr || "no link returned"}`;
              render();
              return;
            }
            const ok = await saveJobChanges(
              created.jobNo,
              {
                artworkLink: url,
                "Artwork Upload Link": url,
                "Artwork Link": url,
                artworkSource: "Customer supplied now",
                "Artwork Source": "Customer supplied now",
              },
              { keepTab: true, quiet: true }
            );
            if (ok) {
              const idx = state.jobs.findIndex(j => j.jobNo === created.jobNo);
              if (idx >= 0) state.jobs[idx] = { ...state.jobs[idx], artworkLink: url, artworkSource: "Customer supplied now" };
              state.saveMessage = "Artwork uploaded and linked.";
            } else {
              state.saveMessage = "Job created, but artwork link did not save. Open job and click Save Changes once.";
            }
            render();
          } catch (err2) {
            state.saveMessage = `Job created. Artwork upload failed: ${String(err2 && err2.message ? err2.message : err2)}`;
            render();
          }
        })();
      }
    } catch (err) {
      msg.textContent = `Create failed: ${String(err && err.message ? err.message : err)}`;
    }
  };
  return panel;
}

function renderVinylPricing() {
  ensurePricingSettingsSynced_();
  const settings = getCurrentPricingSettings_();
  const isOwner = state.role === "owner" || state.role === "admin";

  const panel = document.createElement("section");
  panel.className = "panel";

  let customQuoteEnabled = false;
  let customQuoteSettings = normalizePricingSettings_(settings);

  panel.innerHTML = `
    <h3>Vinyl Sticker Pricing</h3>
    <div class="finder-subtitle">Priced using the PrintStation multiple stickers formula. Add one row per design — each can have a different size and quantity.</div>

    <div class="section-title">Sticker Designs</div>
    <div id="vp-design-rows" style="margin-top:8px;"></div>
    <div class="actions" style="margin-top:8px">
      <button id="vp-add-design" type="button" class="secondary">+ Add Design</button>
      <button id="vp-clear" type="button" class="secondary">Clear All</button>
    </div>

    <div id="vp-output" class="panel" style="margin-top:12px"></div>

    ${isOwner ? `
      <div class="section-title" style="margin-top:14px">Pricing Formula Reference</div>
      <div class="finder-subtitle">Based on PrintStation multiple stickers rates (reverse-engineered from live quotes, 2026-06-30).</div>
      <table style="font-size:12px;margin-top:6px"><tbody>
        <tr><td>Base fee</td><td>R217.50</td></tr>
        <tr><td>Up to 0.625 m²</td><td>R460 / m²</td></tr>
        <tr><td>0.625 – 0.875 m²</td><td>R400 / m²</td></tr>
        <tr><td>Above 0.875 m²</td><td>R336 / m²</td></tr>
        <tr><td>Minimum charge</td><td>R150</td></tr>
      </tbody></table>
      <div class="actions" style="margin-top:10px">
        <button id="vs-save" type="button">Save Pricing Settings</button>
        <span class="save-msg" id="vs-msg">${escapeHtml(state.pricingSaveMessage || "")}</span>
      </div>
    ` : ""}
  `;

  const out = panel.querySelector("#vp-output");
  let vpDesigns = [{ widthMm: 0, heightMm: 0, qty: 0 }];

  const renderVpRows = () => {
    const host = panel.querySelector("#vp-design-rows");
    if (!host) return;
    host.innerHTML = vpDesigns.map((d, i) => `
      <div class="vinyl-extra-row" data-idx="${i}" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
        <span style="font-size:12px;color:var(--muted);min-width:56px">Design ${i + 1}</span>
        <input type="number" class="vpr-w" placeholder="Width mm" min="1" value="${d.widthMm || ""}" style="width:90px;" />
        <span style="font-size:12px;color:var(--muted)">×</span>
        <input type="number" class="vpr-h" placeholder="Height mm" min="1" value="${d.heightMm || ""}" style="width:90px;" />
        <span style="font-size:12px;color:var(--muted)">mm</span>
        <input type="number" class="vpr-q" placeholder="Qty" min="1" value="${d.qty || ""}" style="width:75px;" />
        ${vpDesigns.length > 1 ? `<button type="button" class="vpr-remove secondary" style="padding:2px 8px;font-size:12px;">✕</button>` : ""}
      </div>`).join("");
    host.querySelectorAll(".vpr-remove").forEach(btn => {
      btn.onclick = () => {
        vpDesigns.splice(Number(btn.closest(".vinyl-extra-row").dataset.idx), 1);
        renderVpRows();
        renderQuote();
      };
    });
    host.querySelectorAll(".vpr-w,.vpr-h,.vpr-q").forEach(input => {
      input.addEventListener("input", () => {
        const row = input.closest(".vinyl-extra-row");
        const idx = Number(row.dataset.idx);
        vpDesigns[idx] = {
          widthMm:  Number(row.querySelector(".vpr-w").value) || 0,
          heightMm: Number(row.querySelector(".vpr-h").value) || 0,
          qty:      Number(row.querySelector(".vpr-q").value) || 0,
        };
        renderQuote();
      });
    });
  };

  const renderQuote = () => {
    if (isOwner) {
      const toggle = panel.querySelector("#vp-custom-toggle");
      customQuoteEnabled = !!(toggle && toggle.checked);
      if (customQuoteEnabled) {
        customQuoteSettings = normalizePricingSettings_({
          retailPerM2InclVat: Number(panel.querySelector("#vqc-rate").value || 0),
          roundToNearest: Number(panel.querySelector("#vqc-round").value || 0),
          wastePercent: Number(panel.querySelector("#vqc-waste").value || 0),
        });
      }
    }
    const valid = vpDesigns.filter(d => d.widthMm > 0 && d.heightMm > 0 && d.qty > 0);
    const quote = calculateVinylMultiQuote_(valid);
    if (!quote) {
      out.innerHTML = `<div class="muted">Enter width, height and quantity to calculate.</div>`;
      return;
    }
    const totalQty = quote.lines.reduce((s, l) => s + l.qty, 0);
    const lineRows = quote.lines.map((l, i) =>
      `<tr><td>Design ${i + 1} — ${l.widthMm}×${l.heightMm}mm × ${l.qty}</td><td>${l.areaM2.toFixed(4)} m²</td></tr>`
    ).join("");
    const ownerDetails = isOwner ? `
      <tr><td>Total Area</td><td>${quote.totalAreaM2.toFixed(4)} m²</td></tr>` : "";
    out.innerHTML = `
      <h4 style="margin:0 0 8px 0">Quote Result</h4>
      <div class="finder-subtitle" style="margin-bottom:8px">Priced using PrintStation multiple stickers formula.</div>
      <table><tbody>
        ${lineRows}
        ${ownerDetails}
        <tr><td><strong>Total (Incl VAT)</strong>${quote.lines.length > 1 ? ` <span style="font-size:11px;color:var(--muted)">(${totalQty} stickers combined)</span>` : ""}</td><td><strong>${formatCurrencyR_(quote.finalTotal)}</strong></td></tr>
        ${quote.lines.length === 1 ? `<tr><td>Price Per Sticker</td><td>${formatCurrencyR_(quote.finalTotal / totalQty)}</td></tr>` : ""}
      </tbody></table>
    `;
  };

  panel.querySelector("#vp-add-design").onclick = () => {
    vpDesigns.push({ widthMm: 0, heightMm: 0, qty: 0 });
    renderVpRows();
    renderQuote();
    const rows = panel.querySelectorAll(".vinyl-extra-row");
    if (rows.length) rows[rows.length - 1].querySelector(".vpr-w").focus();
  };
  panel.querySelector("#vp-clear").onclick = () => {
    vpDesigns = [{ widthMm: 0, heightMm: 0, qty: 0 }];
    renderVpRows();
    renderQuote();
  };
  renderVpRows();
  renderQuote();

  // ── Canvas Cost Settings (owner only) ────────────────────────
  if (isOwner) {
    const cs = state.canvasPricingSettings || DEFAULT_CANVAS_PRICING_SETTINGS;
    const canvasSection = document.createElement("div");
    canvasSection.className = "panel";
    canvasSection.style.marginTop = "16px";
    canvasSection.innerHTML = `
      <h3 style="margin:0 0 12px">Canvas Print — Material Costs</h3>
      <p style="font-size:13px;color:var(--muted);margin:0 0 16px">These values feed directly into the canvas price list cost and margin calculations. All prices include VAT.</p>
      <div class="grid-2" style="gap:12px 24px">
        <div class="kv"><label>Ink cost (R/ml)</label>
          <input id="cs-ink-per-ml" type="number" min="0" step="0.01" value="${cs.inkCostPerMl}" /></div>
        <div class="kv"><label>Ink usage (ml/m² print area)</label>
          <input id="cs-ink-ml-m2" type="number" min="0" step="0.1" value="${cs.inkMlPerM2}" /></div>
        <div class="kv"><label>Canvas media (R/m²)</label>
          <input id="cs-canvas-m2" type="number" min="0" step="0.01" value="${cs.canvasCostPerM2}" /></div>
        <div class="kv"><label>Roll width (mm)</label>
          <input id="cs-roll-width" type="number" min="100" step="1" value="${cs.rollWidthMm}" /></div>
        <div class="kv"><label>Mounting allowance per end (mm)</label>
          <input id="cs-mount-allow" type="number" min="0" step="5" value="${cs.mountingAllowanceMm}" /></div>
      </div>
      <h4 style="margin:20px 0 10px;font-size:13px">Frame costs (R each, incl. VAT)</h4>
      <div class="grid-2" style="gap:12px 24px">
        <div class="kv"><label>A1 frame</label><input id="cs-frame-a1" type="number" min="0" step="1" value="${cs.frameCostA1}" /></div>
        <div class="kv"><label>A2 frame</label><input id="cs-frame-a2" type="number" min="0" step="1" value="${cs.frameCostA2}" /></div>
        <div class="kv"><label>A3 frame</label><input id="cs-frame-a3" type="number" min="0" step="1" value="${cs.frameCostA3}" /></div>
        <div class="kv"><label>A4 frame</label><input id="cs-frame-a4" type="number" min="0" step="1" value="${cs.frameCostA4}" /></div>
        <div class="kv"><label>A5 frame</label><input id="cs-frame-a5" type="number" min="0" step="1" value="${cs.frameCostA5}" /></div>
      </div>
      <div class="actions" style="margin-top:16px">
        <button id="cs-save">Save Canvas Costs</button>
        <span class="save-msg" id="cs-msg"></span>
      </div>
      <div id="cs-preview" style="margin-top:16px;font-size:13px;color:var(--muted)"></div>
    `;
    panel.appendChild(canvasSection);

    const previewEl = canvasSection.querySelector("#cs-preview");
    const readCanvasInputs = () => ({
      inkCostPerMl:         Number(canvasSection.querySelector("#cs-ink-per-ml").value)   || 0,
      inkMlPerM2:           Number(canvasSection.querySelector("#cs-ink-ml-m2").value)    || 0,
      canvasCostPerM2:      Number(canvasSection.querySelector("#cs-canvas-m2").value)    || 0,
      rollWidthMm:          Number(canvasSection.querySelector("#cs-roll-width").value)   || 610,
      mountingAllowanceMm:  Number(canvasSection.querySelector("#cs-mount-allow").value)  || 80,
      frameCostA1:          Number(canvasSection.querySelector("#cs-frame-a1").value)     || 0,
      frameCostA2:          Number(canvasSection.querySelector("#cs-frame-a2").value)     || 0,
      frameCostA3:          Number(canvasSection.querySelector("#cs-frame-a3").value)     || 0,
      frameCostA4:          Number(canvasSection.querySelector("#cs-frame-a4").value)     || 0,
      frameCostA5:          Number(canvasSection.querySelector("#cs-frame-a5").value)     || 0,
    });
    const renderCanvasPreview = () => {
      const cs2 = readCanvasInputs();
      const rollW = cs2.rollWidthMm / 1000;
      const mount = cs2.mountingAllowanceMm / 1000;
      const sizes = ["a1","a2","a3","a4","a5"];
      const frameDims = {
        a1: { w: 594, h: 841 }, a2: { w: 420, h: 594 },
        a3: { w: 297, h: 420 }, a4: { w: 210, h: 297 }, a5: { w: 148, h: 210 },
      };
      const frameCosts = { a1: cs2.frameCostA1, a2: cs2.frameCostA2, a3: cs2.frameCostA3, a4: cs2.frameCostA4, a5: cs2.frameCostA5 };
      const rows = sizes.map(s => {
        const dims       = frameDims[s];
        const printArea  = (dims.w / 1000) * (dims.h / 1000);
        const canvasArea = rollW * (dims.h / 1000 + 2 * mount);
        const ink    = printArea  * cs2.inkCostPerMl * cs2.inkMlPerM2;
        const canvas = canvasArea * cs2.canvasCostPerM2;
        const frame  = frameCosts[s];
        const total  = ink + canvas + frame;
        return `<tr><td style="font-weight:600">${s.toUpperCase()}</td>
          <td>R${ink.toFixed(2)}</td><td>R${canvas.toFixed(2)}</td><td>R${frame.toFixed(2)}</td>
          <td style="font-weight:600">R${total.toFixed(2)}</td></tr>`;
      }).join("");
      previewEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="color:var(--muted)"><th style="text-align:left">Size</th><th>Ink</th><th>Canvas</th><th>Frame</th><th>Total cost</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
    };
    canvasSection.querySelectorAll("input").forEach(el => el.addEventListener("input", renderCanvasPreview));
    renderCanvasPreview();

    canvasSection.querySelector("#cs-save").onclick = () => {
      const next = readCanvasInputs();
      state.canvasPricingSettings = next;
      saveLocalCanvasPricingSettings_(next);
      canvasSection.querySelector("#cs-msg").textContent = "Saved";
      setTimeout(() => { canvasSection.querySelector("#cs-msg").textContent = ""; }, 2000);
    };
  }

  return panel;
}

function getBaseAnswersForProduct_(product, qty, lfSizeKey) {
  const pricingData = product && product.pricingData;
  const templateType = String(pricingData && pricingData.template_type || product && product.templateType || "").toLowerCase();

  if (templateType === "standard") {
    return buildStandardBaselineAnswers_(pricingData, qty);
  }
  if (templateType === "isg_custom_booklets") {
    return { qty: String(qty), size: "a5", pages: "8", colour: "full_colour", paper: "115gsm", cover: "115gsm", print_colour: "full_colour", lamination: "none", time: "0" };
  }
  // For all other products: use the first available option for each flow field
  const answers = { qty: String(qty), time: "0", versions: "1" };
  const flowFields = Array.isArray(product && product.flowFields) ? product.flowFields : [];
  flowFields.forEach((field) => {
    const key = String(field && field.key || "");
    if (!key || key === "qty" || key === "time" || key === "versions") return;
    const opts = Array.isArray(field.options) ? field.options : [];
    // For large format with a selected size, match the size option by its dimensions
    if (lfSizeKey && (key === "predefined_size" || key === "predefined_sizes")) {
      const [w, h] = lfSizeKey.split("x").map(Number);
      const matchIdx = opts.findIndex((o) => {
        const label = String(o && o.label || "");
        return label.includes(`${w}`) && label.includes(`${h}`);
      });
      if (matchIdx >= 0) { answers[key] = String(matchIdx); return; }
    }
    const firstVal = opts[0] && String(opts[0].value || "");
    if (firstVal) answers[key] = firstVal;
  });
  return answers;
}

function humanizeCostKey_(k) {
  const labels = {
    resellDiscountPercent: "Printstation Resell Discount (%)",
    handlingOverheadPercent: "ISG Handling & Overhead (%)",
    supplierCostPercent: "Supplier / Production Cost (% of formula price)",
    overheadPercent: "ISG Overhead (%)",
    clickCostA4BwExVat: "A4 B&W Click Cost (ex VAT, per side)",
    clickCostA4ColourExVat: "A4 Colour Click Cost (ex VAT, per side)",
    clickCostA3BwExVat: "A3 B&W Click Cost (ex VAT, per side)",
    clickCostA3ColourExVat: "A3 Colour Click Cost (ex VAT, per side)",
    paper80gsmBondExVat: "80gsm Bond Paper Cost (ex VAT, per sheet)",
    paper90gsmBondExVat: "90gsm Bond Paper Cost (ex VAT, per sheet)",
    paper115gsmExVat: "115gsm Paper Cost (ex VAT, per sheet)",
    paper120gsmBondExVat: "120gsm Bond Paper Cost (ex VAT, per sheet)",
    paper130gsmExVat: "130gsm Paper Cost (ex VAT, per sheet)",
    paper150gsmExVat: "150gsm Paper Cost (ex VAT, per sheet)",
    paper200gsmExVat: "200gsm Paper Cost (ex VAT, per sheet)",
    paper250gsmExVat: "250gsm Paper Cost (ex VAT, per sheet)",
    setupExVat: "Job Setup Cost (ex VAT)",
    stitchExVatPerBook: "Staple / Stitch Cost (ex VAT, per book)",
    laminationExVatPerCover: "Lamination Cost (ex VAT, per cover)",
    wastePercent: "Waste % (paper/material offcuts)",
    minMarginQty20to29Percent: "Min Margin % — qty 20–29",
    minMarginQty30to39Percent: "Min Margin % — qty 30–39",
    minMarginQty40to49Percent: "Min Margin % — qty 40–49",
    minMarginQty50to99Percent: "Min Margin % — qty 50–99",
    minMarginQty100PlusPercent: "Min Margin % — qty 100+",
    printstationBufferPercent: "Printstation Safety Buffer %",
    rush3DayPercent: "3-Day Rush Surcharge %",
    rush2DayPercent: "2-Day Rush Surcharge %",
    clickCostA4BwExVat: "A4 B&W Click Cost (ex VAT, per side)",
    clickCostA4ColourExVat: "A4 Colour Click Cost (ex VAT, per side)",
    clickCostA3BwExVat: "A3 B&W Click Cost (ex VAT, per side)",
    clickCostA3ColourExVat: "A3 Colour Click Cost (ex VAT, per side)",
    paperCostA4ExVat: "A4 Paper Cost (ex VAT, per sheet)",
    paperCostA3ExVat: "A3 Paper Cost (ex VAT, per sheet)",
    bwMarginPercent: "B&W Selling Margin (%)",
    colourMarginPercent: "Colour Selling Margin (%)",
    oppLamCostPerMExVat: "OPP Lam — Roll Cost (ex VAT, per metre)",
    oppLamMarginPercent: "OPP Lam — Selling Margin (%)",
    oppLamMinimum: "OPP Lam — Minimum Charge",
    encapCostPerMExVat: "Roll Encap — Roll Cost (ex VAT, per metre)",
    encapMarginPercent: "Roll Encap — Selling Margin (%)",
    encapMinimum: "Roll Encap — Minimum Charge",
    encapMinimumA2: "Roll Encap — A2 Minimum Charge",
    encapMinimumA1: "Roll Encap — A1 Minimum Charge",
  };
  return labels[k] || String(k).replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}

function buildQtyPriceTableRows_(product, adjustment, lfSizeKey) {
  const pricingData = product && product.pricingData;
  const templateType = String(pricingData && pricingData.template_type || product && product.templateType || "").toLowerCase();
  const isCustomBooklets = templateType === "isg_custom_booklets";
  const isStandard = templateType === "standard";

  const isLargeFormat = templateType === "large_format";
  let qtys = [];
  if (isStandard) {
    qtys = parseQuantities_(pricingData);
  } else if (isLargeFormat) {
    const lf_qtys_str = String(pricingData && pricingData.lf_quantities || "");
    qtys = lf_qtys_str.split(",").map((s) => Number(s.trim())).filter((n) => n > 0);
  } else if (Array.isArray(pricingData && pricingData.quantities)) {
    qtys = pricingData.quantities.map(Number).filter((n) => n > 0);
  }
  if (!qtys.length) return { html: "", hasData: false };

  const noAdjust = { markupPercent: 0, fixedOffset: 0, roundToNearest: 0, minimumPrice: 0, quantityOverrides: {} };

  const rows = qtys.map((qty) => {
    let formulaPrice = null;
    let isgCost = null;

    const baseAnswers = getBaseAnswersForProduct_(product, qty, lfSizeKey);
    const quote = calculatePrintstationQuote_(product, baseAnswers, noAdjust);
    if (quote && quote.finalTotal > 0) {
      formulaPrice = quote.finalTotal;
      if (quote.estimatedCostInclVat && quote.estimatedCostInclVat > 0) {
        isgCost = quote.estimatedCostInclVat;
      }
    }

    const qtyKey = String(qty);
    const sizeQtyKey = lfSizeKey ? `${lfSizeKey}::${qtyKey}` : null;
    const ovr = Number(adjustment && adjustment.quantityOverrides && (
      sizeQtyKey ? (adjustment.quantityOverrides[sizeQtyKey] || adjustment.quantityOverrides[qtyKey])
                 : adjustment.quantityOverrides[qtyKey]
    ));
    const hasOverride = Number.isFinite(ovr) && ovr > 0;
    const finalPrice = hasOverride ? ovr : formulaPrice;

    let marginPct = null;
    if (isgCost && finalPrice && finalPrice > 0) {
      marginPct = ((finalPrice - isgCost) / finalPrice) * 100;
    }

    const placeholder = formulaPrice ? String(Math.round(formulaPrice)) : "";
    const inputVal = hasOverride ? String(ovr) : "";
    const fmtFormula = formulaPrice ? formatCurrencyR_(formulaPrice) : "<span style='color:var(--muted)'>—</span>";
    const fmtFinal = finalPrice ? `<strong>${formatCurrencyR_(finalPrice)}</strong>` : "<span style='color:var(--muted)'>—</span>";
    const fmtCost = isgCost ? formatCurrencyR_(isgCost) : "<span style='color:var(--muted)'>—</span>";
    const fmtMargin = marginPct !== null
      ? `<span style="color:${marginPct < 20 ? "var(--danger,#c0392b)" : marginPct < 35 ? "var(--warning,#e67e22)" : "var(--ok,#27ae60)"}">${marginPct.toFixed(1)}%</span>`
      : "<span style='color:var(--muted)'>—</span>";

    return `<tr data-qty="${escapeHtml(qtyKey)}">
      <td style="text-align:center;font-weight:600">${escapeHtml(qtyKey)}</td>
      <td>${fmtFormula}</td>
      <td><input class="qty-table-override" data-qty="${escapeHtml(qtyKey)}" data-size-qty-key="${escapeHtml(sizeQtyKey || qtyKey)}" type="number" step="1" min="0" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(inputVal)}" style="width:90px" /></td>
      <td>${fmtCost}</td>
      <td>${fmtMargin}</td>
      <td>${fmtFinal}</td>
    </tr>`;
  }).join("");

  return { html: rows, hasData: true, isCustomBooklets };
}

function renderPriceList() {
  const panel = document.createElement("section");
  panel.className = "panel";
  const isOwner = state.role === "owner" || state.role === "admin";
  if (!state.printstationPricebook && !state.printstationPricebookLoadPromise) {
    ensurePrintstationPricebookLoaded_();
  }
  const snapshot = state.printstationPricebook;
  if (!snapshot || !Array.isArray(snapshot.products)) {
    panel.innerHTML = `
      <h3>Price List</h3>
      <div class="finder-subtitle">Loading PrintStation snapshot...</div>
    `;
    return panel;
  }

  const customProducts = getCustomPriceListProducts_();
  const classifyGroup = (name) => {
    const n = String(name || "").toLowerCase();
    if (n.includes("standard printing")) return "Standard Printing";
    if (n.includes("business card")) return "Business Cards";
    if (n.includes("flyer") || n.includes("leaflet")) return "Flyers & Leaflets";
    if (n.includes("banner") || n.includes("poster") || n.includes("board") || n.includes("sign") || n.includes("canvas") || n.includes("photo print") || n.includes("frame") || n.includes("car magnet")) return "Signage & Display";
    if (n.includes("sticker") || n.includes("vinyl") || n.includes("label")) return "Stickers & Vinyl";
    if (n.includes("t-shirt") || n.includes("shirt") || n.includes("dtf")) return "Apparel";
    if (n.includes("stamp")) return "Stamps";
    if (n.includes("calendar") || n.includes("magnet") || n.includes("bookmark") || n.includes("notepad") || n.includes("placemat") || n.includes("swing tag") || n.includes("bottle neck") || n.includes("table tent") || n.includes("standee") || n.includes("card")) return "Paper Products";
    return "Other";
  };
  const GROUP_ORDER = ["Standard Printing", "Business Cards", "Flyers & Leaflets", "Signage & Display", "Stickers & Vinyl", "Apparel", "Paper Products", "Stamps", "Other"];
  const PRODUCT_PRIORITY = [
    ["standard business card", 0],
    ["laminated business card", 1],
    ["rounded corner business card", 2],
    ["folded business card", 3],
    ["square business card", 4],
    ["oval business card", 5],
    ["circle business card", 6],
    ["flyer", 0],
    ["folded leaflet", 1],
    ["a2 poster", 0],
    ["poster", 1],
    ["sign board", 2],
    ["board", 3],
    ["canvas", 4],
    ["photo print", 5],
    ["t-shirt", 0],
    ["shirt", 1],
    ["notepad", 0],
    ["bookmark", 1],
    ["fridge calendar", 2],
    ["calendar", 3],
    ["magnet", 4],
    ["placemat", 5],
    ["table tent", 6],
    ["standee", 7],
    ["swing tag", 8],
    ["bottle neck", 9],
  ];
  const productSortKey_ = (name) => {
    const n = String(name || "").toLowerCase();
    for (const [kw, rank] of PRODUCT_PRIORITY) {
      if (n.includes(kw)) return rank;
    }
    return 99;
  };
  // Slugs replaced by in-house custom products — hide the Printstation versions
  const EXCLUDED_SLUGS = new Set(["canvas-prints", "custom-abs-foam-correx-sign-boards"]);
  const products = snapshot.products.filter(p => !EXCLUDED_SLUGS.has(String(p.slug || ""))).concat(customProducts).slice().sort((a, b) => {
    const ga = classifyGroup(a.name);
    const gb = classifyGroup(b.name);
    const gi = GROUP_ORDER.indexOf(ga);
    const gj = GROUP_ORDER.indexOf(gb);
    const gDiff = (gi === -1 ? 999 : gi) - (gj === -1 ? 999 : gj);
    if (gDiff !== 0) return gDiff;
    const pDiff = productSortKey_(a.name) - productSortKey_(b.name);
    if (pDiff !== 0) return pDiff;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
  const presentGroups = new Set(products.map(p => classifyGroup(p.name)));
  const groups = GROUP_ORDER.filter(g => presentGroups.has(g));
  if (!products.length) {
    panel.innerHTML = `
      <h3>Price List</h3>
      <div class="finder-subtitle">No snapshot found. Run: <code>python3 scripts/import_printstation_pricebook.py --apply</code></div>
    `;
    return panel;
  }
  const first = products[0];

  panel.innerHTML = `
    <h3>Price List</h3>
    <div class="kv" style="margin-top:8px">
      <label>Search</label>
      <input id="pl-search" type="search" placeholder="Search products…" autocomplete="off" />
      <div id="pl-search-count" style="font-size:12px;color:var(--muted);margin-top:4px"></div>
    </div>
    <div class="detail-grid" style="margin-top:8px">
      <div class="kv">
        <label>Product Group</label>
        <select id="pl-group">
          <option value="ALL">All products</option>
          ${groups.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("")}
        </select>
      </div>
      <div class="kv">
        <label>Product</label>
        <select id="pl-product">
          ${products.map((p) => `<option value="${escapeHtml(String(p.slug || p.id))}">${escapeHtml(String(p.name || p.slug || p.id))}</option>`).join("")}
        </select>
      </div>
    </div>
    <div id="pl-flow" class="detail-section" style="margin-top:12px"></div>
    <div class="actions" style="margin-top:10px">
      <button id="pl-calc" type="button">Calculate Price</button>
      <button id="pl-clear" type="button" class="secondary">Clear</button>
      <span id="pl-msg" class="save-msg"></span>
    </div>
    <div id="pl-output" class="panel" style="margin-top:12px"></div>
    ${isOwner ? `
      <div class="section-title" style="margin-top:14px">Owner Adjustments (Internal Override)</div>
      <div class="finder-subtitle">Base price comes from snapshot. Adjustments apply internally only.</div>
      <div id="pl-owner" class="detail-section" style="margin-top:8px"></div>
      <div class="actions" style="margin-top:10px">
        <button id="pl-owner-save" type="button">Save Global Settings</button>
        <button id="pl-owner-set-qty" type="button">Set Qty Price</button>
        <button id="pl-owner-clear-qty" type="button" class="secondary">Remove Qty Price</button>
        <button id="pl-owner-reset" type="button" class="secondary">Reset Product To Snapshot</button>
      </div>
      <div class="section-title" style="margin-top:14px">Owner Cost Settings (Internal)</div>
      <div class="finder-subtitle">Cost settings are internal only. They do not change customer-facing products.</div>
      <div id="pl-owner-cost" class="detail-section" style="margin-top:8px"></div>
      <div class="actions" style="margin-top:10px">
        <button id="pl-owner-cost-save" type="button">Save Cost Settings</button>
        <button id="pl-owner-cost-reset" type="button" class="secondary">Reset Cost Settings</button>
      </div>
    ` : ""}
  `;

  const groupSel = panel.querySelector("#pl-group");
  const productSel = panel.querySelector("#pl-product");
  const searchEl = panel.querySelector("#pl-search");
  const flowWrap = panel.querySelector("#pl-flow");
  const out = panel.querySelector("#pl-output");
  const msg = panel.querySelector("#pl-msg");
  const ownerWrap = panel.querySelector("#pl-owner");
  const ownerCostWrap = panel.querySelector("#pl-owner-cost");

  const getFilteredProducts = () => {
    const g = String(groupSel.value || "ALL");
    const q = String(searchEl ? searchEl.value : "").trim().toLowerCase();
    let filtered = g === "ALL" ? products : products.filter((p) => classifyGroup(p.name) === g);
    if (q) filtered = filtered.filter((p) => String(p.name || "").toLowerCase().includes(q));
    return filtered;
  };

  const refreshProductOptions = () => {
    const filtered = getFilteredProducts();
    const current = String(productSel.value || "");
    productSel.innerHTML = filtered
      .map((p) => `<option value="${escapeHtml(String(p.slug || p.id))}">${escapeHtml(String(p.name || p.slug || p.id))}</option>`)
      .join("");
    if (!filtered.length) {
      productSel.innerHTML = `<option value="">No products in this group</option>`;
      return;
    }
    const stillExists = filtered.some((p) => String(p.slug || p.id) === current);
    if (stillExists) productSel.value = current;
  };

  const getProduct = () => {
    const key = String(productSel.value || "");
    const filtered = getFilteredProducts();
    return filtered.find((p) => String(p.slug || p.id) === key) || filtered[0] || first;
  };

  const getFlowFields = (product) => {
    const fields = Array.isArray(product && product.flowFields) ? product.flowFields : [];
    return fields.filter((f) => (Array.isArray(f.options) && f.options.length) || f.type === "number");
  };
  const getProductQuantityOptions = (product) => {
    const flowFields = getFlowFields(product);
    const qtyField = flowFields.find((f) => {
      const key = String(f && f.key || "").toLowerCase();
      return key === "qty" || key === "qty[]" || key.includes("qty");
    });
    if (!qtyField || !Array.isArray(qtyField.options)) return [];
    const nums = qtyField.options
      .map((o) => Number.parseInt(String(o && o.value || ""), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    return Array.from(new Set(nums)).sort((a, b) => a - b);
  };
  const getFieldDomId = (fieldKey) => `pl-field-${normalizeOptionKey_(String(fieldKey || ""))}`;
  const getFieldCustomDomId = (fieldKey) => `${getFieldDomId(fieldKey)}-custom`;

  const renderOwnerAdjustments = (product) => {
    if (!ownerWrap) return;
    const adj = getAdjustmentForProduct_(product);
    const productTitle = String((product && (product.name || product.label || product.slug)) || "").toLowerCase();
    const isVinylSticker = productTitle.includes("vinyl") || productTitle.includes("sticker");
    const isBooklets = String(product && product.id || "") === "isg_booklets";
    const isLargeFormat = String(product && product.templateType || "").toLowerCase() === "large_format";
    const tiers = isLargeFormat && product.pricingTiers && typeof product.pricingTiers === "object" ? product.pricingTiers : null;
    const lfSizes = tiers ? Object.keys(tiers) : [];
    // Default to smallest size (last in array for Correx since they go A0 down to A6)
    const storedLfSize = String(adj.lfSelectedSize || lfSizes[lfSizes.length - 1] || "");
    const lfSizeKey = lfSizes.includes(storedLfSize) ? storedLfSize : (lfSizes[lfSizes.length - 1] || null);
    const { html: tableRows, hasData: hasTable, isCustomBooklets } = buildQtyPriceTableRows_(product, adj, lfSizeKey || undefined);

    const tableConfigNote = isCustomBooklets
      ? "Prices shown for: <strong>A5 · 8 pages · Full Colour · 115gsm · No lamination · Standard delivery</strong>. For other configs the formula scales proportionally."
      : "Formula column shows the calculated Printstation-equivalent price for the base configuration (cheapest options, standard delivery).";

    ownerWrap.innerHTML = `
      <div class="detail-grid">
        <div class="kv">
          <label>Global Price Change (%)</label>
          <input id="pl-owner-markup" type="number" step="0.01" min="0" value="${escapeHtml(String(adj.markupPercent))}" />
        </div>
        <div class="kv">
          <label>Fixed Add-on (R)</label>
          <input id="pl-owner-offset" type="number" step="0.01" min="0" value="${escapeHtml(String(adj.fixedOffset))}" />
        </div>
        <div class="kv">
          <label>Round Up To (R)</label>
          <input id="pl-owner-round" type="number" step="1" min="0" value="${escapeHtml(String(adj.roundToNearest))}" />
        </div>
        <div class="kv">
          <label>Minimum Price (R)</label>
          <input id="pl-owner-min" type="number" step="1" min="0" value="${escapeHtml(String(adj.minimumPrice))}" />
        </div>
      </div>
      <div class="finder-subtitle" style="margin-top:8px">
        Global Price Change (%) scales all tiers proportionally.${isVinylSticker ? " Vinyl/sticker default minimum is R240." : ""}
      </div>
      ${hasTable ? `
        <div class="section-title" style="margin-top:16px">Printstation Price Table</div>
        ${isLargeFormat && lfSizes.length > 1 ? `
          <div class="kv" style="margin-top:8px;max-width:280px">
            <label>Edit prices for size:</label>
            <select id="pl-lf-size-sel">
              ${lfSizes.map((sk) => {
                const [w, h] = sk.split("x");
                const sizeLabel = `${w} × ${h} mm`;
                return `<option value="${escapeHtml(sk)}"${sk === lfSizeKey ? " selected" : ""}>${escapeHtml(sizeLabel)}</option>`;
              }).join("")}
            </select>
          </div>` : ""}
        <div class="finder-subtitle" style="margin-top:4px">${tableConfigNote}</div>
        ${isBooklets ? `<div class="finder-subtitle" style="margin-top:4px;color:var(--warning,#e67e22)">Booklet prices cannot be scraped — enter Printstation\'s exact prices in the "Your Price" column and click Save Qty Prices.</div>` : ""}
        <div style="overflow-x:auto;margin-top:10px">
          <table class="price-table">
            <thead>
              <tr>
                <th>Qty</th>
                <th>Formula Price</th>
                <th>Your Price (Incl VAT)</th>
                <th>ISG Cost</th>
                <th>Margin</th>
                <th>Selling Price</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
        <div class="actions" style="margin-top:8px">
          <button type="button" id="pl-owner-table-save">Save Qty Prices</button>
          <button type="button" id="pl-owner-table-clear" class="secondary">Clear All Overrides</button>
        </div>
      ` : ""}
      <div class="detail-grid" style="margin-top:10px">
        <div class="kv">
          <label>Quick-set One Quantity Tier</label>
          <select id="pl-owner-qty">
            <option value="">Choose quantity tier</option>
            ${getProductQuantityOptions(product).map((q) => `<option value="${escapeHtml(String(q))}">${escapeHtml(String(q))}</option>`).join("")}
          </select>
        </div>
        <div class="kv">
          <label>Exact Total Price (Incl VAT)</label>
          <input id="pl-owner-qty-price" type="number" step="0.01" min="0" placeholder="e.g. 365" />
        </div>
      </div>
    `;

    const qtySel = ownerWrap.querySelector("#pl-owner-qty");
    const qtyPriceInput = ownerWrap.querySelector("#pl-owner-qty-price");
    if (qtySel && qtyPriceInput) {
      qtySel.addEventListener("change", () => {
        const key = String(qtySel.value || "").trim();
        if (!key) { qtyPriceInput.value = ""; return; }
        const existing = Number(adj.quantityOverrides && adj.quantityOverrides[key]);
        qtyPriceInput.value = Number.isFinite(existing) && existing > 0 ? String(existing) : "";
      });
    }

    const tableSaveBtn = ownerWrap.querySelector("#pl-owner-table-save");
    if (tableSaveBtn) {
      tableSaveBtn.addEventListener("click", () => {
        const inputs = Array.from(ownerWrap.querySelectorAll(".qty-table-override"));
        const current = getAdjustmentForProduct_(product);
        const newOverrides = { ...(current.quantityOverrides || {}) };

        // Collect new values and detect the first changed row for delta propagation
        const rows = inputs.map((inp) => ({
          inp,
          sizeQtyKey: String(inp.dataset.sizeQtyKey || inp.dataset.qty || ""),
          qty: Number(inp.dataset.qty),
          newVal: inp.value !== "" ? Number(inp.value) : null,
          oldVal: Number(newOverrides[String(inp.dataset.sizeQtyKey || inp.dataset.qty)]) || null,
          formulaVal: inp.placeholder ? Number(inp.placeholder) : null,
        }));

        // Find first row where the user typed a NEW value that differs from the saved override
        let deltaApplied = false;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (row.newVal === null || !Number.isFinite(row.newVal)) continue;
          const prevSaved = row.oldVal || row.formulaVal || 0;
          if (prevSaved > 0 && Math.abs(row.newVal - prevSaved) > 0.01) {
            // This is the changed row — propagate delta to subsequent rows
            const delta = row.newVal - prevSaved;
            for (let j = i + 1; j < rows.length; j++) {
              const subsequent = rows[j];
              const base = subsequent.oldVal || subsequent.formulaVal || 0;
              if (base > 0) {
                const propagated = Math.max(0, Math.round(base + delta));
                subsequent.inp.value = String(propagated);
                subsequent.newVal = propagated;
              }
            }
            deltaApplied = true;
            break;
          }
        }

        // Save all values
        rows.forEach(({ sizeQtyKey, newVal }) => {
          if (!sizeQtyKey) return;
          if (newVal !== null && Number.isFinite(newVal) && newVal > 0) {
            newOverrides[sizeQtyKey] = newVal;
          } else if (newVal === null) {
            delete newOverrides[sizeQtyKey];
          }
        });

        saveAdjustmentForProduct_(product, { ...current, quantityOverrides: newOverrides });
        if (deltaApplied) {
          msg.textContent = "Prices saved. Delta applied to subsequent quantities.";
        }
        renderFlow();
        calculate();
      });
    }

    const lfSizeSel = ownerWrap.querySelector("#pl-lf-size-sel");
    if (lfSizeSel) {
      lfSizeSel.addEventListener("change", () => {
        const current = getAdjustmentForProduct_(product);
        saveAdjustmentForProduct_(product, { ...current, lfSelectedSize: lfSizeSel.value });
        renderOwnerAdjustments(product);
      });
    }

    const tableClearBtn = ownerWrap.querySelector("#pl-owner-table-clear");
    if (tableClearBtn) {
      tableClearBtn.addEventListener("click", () => {
        const current = getAdjustmentForProduct_(product);
        saveAdjustmentForProduct_(product, { ...current, quantityOverrides: {} });
        renderFlow();
        calculate();
      });
    }
  };

  const renderOwnerCostSettings = (product) => {
    if (!ownerCostWrap) return;
    const defaults = getProductCostDefaults_(product);
    const hasCostModel = defaults && Object.keys(defaults).length > 0;
    if (!hasCostModel) {
      ownerCostWrap.innerHTML = `<div class="finder-subtitle">No editable cost model configured for this product yet.</div>`;
      return;
    }
    const cs = getCostSettingsForProduct_(product);
    const fields = Object.keys(defaults);
    ownerCostWrap.innerHTML = `
      <div class="detail-grid">
        ${fields.map((k) => `
          <div class="kv">
            <label>${escapeHtml(humanizeCostKey_(k))}</label>
            <input id="pl-owner-cost-${escapeHtml(k)}" data-cost-key="${escapeHtml(k)}" type="number" step="0.01" value="${escapeHtml(String(cs[k]))}" />
          </div>
        `).join("")}
      </div>
      <div class="finder-subtitle" style="margin-top:8px">
        Keep values EX VAT where the field name ends with <code>ExVat</code>. Percent fields are entered as whole numbers (example: 8 = 8%).
      </div>
    `;
  };

  const renderFlow = () => {
    const product = getProduct();
    const flowFields = getFlowFields(product);
    const productUrl = String(product && product.url || "");
    flowWrap.innerHTML = `
      <div class="section-title">${escapeHtml(String(product.name || ""))}</div>
      <div class="finder-subtitle">${productUrl ? `<a href="${escapeHtml(productUrl)}" target="_blank" rel="noreferrer">View product page</a>` : ""}</div>
      <div class="detail-grid">
        ${flowFields.map((field) => {
          const swAttr = field.showWhen
            ? ` data-show-when-field="${escapeHtml(String(field.showWhen.field || ""))}" data-show-when-equals="${escapeHtml(String(field.showWhen.equals || ""))}"`
            : "";
          if (field.type === "number") {
            return `
              <div class="kv"${swAttr}${field.showWhen ? ' style="display:none"' : ""}>
                <label>${escapeHtml(String(field.label || field.key))}</label>
                <input id="${escapeHtml(getFieldDomId(field.key))}" type="number"
                  data-field-key="${escapeHtml(String(field.key || ""))}"
                  ${field.min != null ? `min="${escapeHtml(String(field.min))}"` : ""}
                  ${field.max != null ? `max="${escapeHtml(String(field.max))}"` : ""}
                  placeholder="${escapeHtml(String(field.placeholder || ""))}"
                  style="width:100%" />
              </div>
            `;
          }
          const hasCustom = field.options.some((o) => normalizeOptionText_(String(o && o.value || "")).toLowerCase() === "custom");
          const showCustomInput = String(product && product.id || "") === "isg_booklets" && String(field.key || "").toLowerCase() === "qty" && hasCustom;
          const isCanvasSize = String(product && product.id || "") === "isg_canvas_prints" && String(field.key || "") === "size" && hasCustom;
          const isCarMagnetSize = String(product && product.id || "") === "isg_car_magnets" && String(field.key || "") === "size" && hasCustom;
          const isSignboardSize = String(product && product.id || "") === "isg_signboards" && String(field.key || "") === "size" && hasCustom;
          return `
            <div class="kv"${swAttr}${field.showWhen ? ' style="display:none"' : ""}>
              <label>${escapeHtml(String(field.label || field.key))}</label>
              <select id="${escapeHtml(getFieldDomId(field.key))}" data-field-key="${escapeHtml(String(field.key || ""))}">
                <option value="">Select</option>
                ${field.options.map((o) => {
                  const val = normalizeOptionText_(String(o.value));
                  const text = normalizeOptionText_(String(o.label || o.value));
                  return `<option value="${escapeHtml(val)}">${escapeHtml(text)}</option>`;
                }).join("")}
              </select>
              ${showCustomInput ? `<input id="${escapeHtml(getFieldCustomDomId(field.key))}" type="number" min="1" step="1" placeholder="Enter custom quantity" style="display:none;margin-top:8px" />` : ""}
              ${isCanvasSize ? `
                <div id="pl-canvas-custom-dims" style="display:none;margin-top:8px;display:flex;flex-direction:column;gap:6px">
                  <input id="pl-field-canvas-width" type="number" min="400" max="2500" placeholder="Width (mm) — 400 to 2500" style="width:100%" />
                  <input id="pl-field-canvas-height" type="number" min="400" max="1500" placeholder="Height (mm) — 400 to 1500" style="width:100%" />
                </div>
              ` : ""}
              ${isCarMagnetSize ? `
                <div id="pl-car-magnet-custom-dims" style="display:none;margin-top:8px;flex-direction:column;gap:6px">
                  <input id="pl-field-car-magnet-width" type="number" min="100" max="800" placeholder="Width (mm) — max 800" style="width:100%" />
                  <input id="pl-field-car-magnet-height" type="number" min="100" max="600" placeholder="Height (mm) — max 600" style="width:100%" />
                </div>
              ` : ""}
              ${isSignboardSize ? `
                <div id="pl-signboard-custom-dims" style="display:none;margin-top:8px;flex-direction:column;gap:6px">
                  <input id="pl-field-signboard-width" type="number" min="50" max="2400" placeholder="Width (mm)" style="width:100%" />
                  <input id="pl-field-signboard-height" type="number" min="50" max="2400" placeholder="Height (mm)" style="width:100%" />
                </div>
              ` : ""}
            </div>
          `;
        }).join("")}
      </div>
    `;
    if (String(product && product.id || "") === "isg_booklets") {
      const qtySel = panel.querySelector(`#${getFieldDomId("qty")}`);
      const qtyCustom = panel.querySelector(`#${getFieldCustomDomId("qty")}`);
      if (qtySel && qtyCustom) {
        const syncCustomQtyVisibility = () => {
          const isCustom = normalizeOptionText_(String(qtySel.value || "")).toLowerCase() === "custom";
          qtyCustom.style.display = isCustom ? "block" : "none";
          if (!isCustom) qtyCustom.value = "";
        };
        qtySel.addEventListener("change", syncCustomQtyVisibility);
        syncCustomQtyVisibility();
      }
    }
    if (String(product && product.id || "") === "isg_canvas_prints") {
      const sizeSel   = panel.querySelector(`#${getFieldDomId("size")}`);
      const dimsWrap  = panel.querySelector("#pl-canvas-custom-dims");
      if (sizeSel && dimsWrap) {
        const syncDims = () => {
          const isCustom = String(sizeSel.value || "").toLowerCase() === "custom";
          dimsWrap.style.display = isCustom ? "flex" : "none";
          if (!isCustom) {
            const wEl = dimsWrap.querySelector("#pl-field-canvas-width");
            const hEl = dimsWrap.querySelector("#pl-field-canvas-height");
            if (wEl) wEl.value = "";
            if (hEl) hEl.value = "";
          }
        };
        sizeSel.addEventListener("change", syncDims);
        syncDims();
      }
    }
    if (String(product && product.id || "") === "isg_car_magnets") {
      const sizeSel  = panel.querySelector(`#${getFieldDomId("size")}`);
      const dimsWrap = panel.querySelector("#pl-car-magnet-custom-dims");
      if (sizeSel && dimsWrap) {
        const syncDims = () => {
          const isCustom = String(sizeSel.value || "").toLowerCase() === "custom";
          dimsWrap.style.display = isCustom ? "flex" : "none";
          if (!isCustom) {
            const wEl = dimsWrap.querySelector("#pl-field-car-magnet-width");
            const hEl = dimsWrap.querySelector("#pl-field-car-magnet-height");
            if (wEl) wEl.value = "";
            if (hEl) hEl.value = "";
          }
        };
        sizeSel.addEventListener("change", syncDims);
        syncDims();
      }
    }
    if (String(product && product.id || "") === "isg_signboards") {
      const sizeSel  = panel.querySelector(`#${getFieldDomId("size")}`);
      const dimsWrap = panel.querySelector("#pl-signboard-custom-dims");
      if (sizeSel && dimsWrap) {
        const syncDims = () => {
          const isCustom = String(sizeSel.value || "").toLowerCase() === "custom";
          dimsWrap.style.display = isCustom ? "flex" : "none";
          if (!isCustom) {
            const wEl = dimsWrap.querySelector("#pl-field-signboard-width");
            const hEl = dimsWrap.querySelector("#pl-field-signboard-height");
            if (wEl) wEl.value = "";
            if (hEl) hEl.value = "";
          }
        };
        sizeSel.addEventListener("change", syncDims);
        syncDims();
      }
    }
    // Wire up showWhen visibility for flow fields
    flowWrap.querySelectorAll(".kv[data-show-when-field]").forEach((kvDiv) => {
      const controlField = kvDiv.dataset.showWhenField;
      const controlEquals = kvDiv.dataset.showWhenEquals;
      const controlEl = panel.querySelector(`#${getFieldDomId(controlField)}`);
      if (!controlEl) return;
      const sync = () => {
        const matches = normalizeOptionText_(String(controlEl.value || "")) === normalizeOptionText_(controlEquals);
        kvDiv.style.display = matches ? "" : "none";
        if (!matches) {
          const inp = kvDiv.querySelector("input, select");
          if (inp) inp.value = "";
        }
      };
      controlEl.addEventListener("change", sync);
      sync();
    });

    renderOwnerAdjustments(product);
    renderOwnerCostSettings(product);
  };

  const readAnswers = (product) => {
    const ans = {};
    getFlowFields(product).forEach((field) => {
      const el = panel.querySelector(`#${getFieldDomId(field.key)}`);
      let value = field.type === "number"
        ? String(el ? el.value : "")
        : normalizeOptionText_(el ? el.value : "");
      const isBookletsQtyField = String(product && product.id || "") === "isg_booklets" && String(field.key || "").toLowerCase() === "qty";
      if (isBookletsQtyField && value.toLowerCase() === "custom") {
        const customEl = panel.querySelector(`#${getFieldCustomDomId(field.key)}`);
        const customValue = Number.parseInt(String(customEl && customEl.value || ""), 10);
        value = Number.isFinite(customValue) && customValue > 0 ? String(customValue) : "";
      }
      ans[field.key] = value;
      // Also store normalized-key alias to avoid bracket/special-char key misses.
      const alias = normalizeOptionKey_(field.key);
      if (alias && !(alias in ans)) ans[alias] = value;
    });
    if (String(product && product.id || "") === "isg_canvas_prints" && String(ans.size || "").toLowerCase() === "custom") {
      const wEl = panel.querySelector("#pl-field-canvas-width");
      const hEl = panel.querySelector("#pl-field-canvas-height");
      ans.width_mm  = String(wEl ? wEl.value : "");
      ans.height_mm = String(hEl ? hEl.value : "");
    }
    if (String(product && product.id || "") === "isg_car_magnets" && String(ans.size || "").toLowerCase() === "custom") {
      const wEl = panel.querySelector("#pl-field-car-magnet-width");
      const hEl = panel.querySelector("#pl-field-car-magnet-height");
      ans.carMagnetWidth  = String(wEl ? wEl.value : "");
      ans.carMagnetHeight = String(hEl ? hEl.value : "");
    }
    if (String(product && product.id || "") === "isg_signboards" && String(ans.size || "").toLowerCase() === "custom") {
      const wEl = panel.querySelector("#pl-field-signboard-width");
      const hEl = panel.querySelector("#pl-field-signboard-height");
      ans.signboardWidth  = String(wEl ? wEl.value : "");
      ans.signboardHeight = String(hEl ? hEl.value : "");
    }
    return ans;
  };

  const calculate = () => {
    const product = getProduct();
    const flowFields = getFlowFields(product);
    const answers = readAnswers(product);

    // UX: keep Calculate reliable by auto-filling unselected fields.
    // Prefer explicit "None" for optional extras, otherwise use the first available option.
    flowFields.forEach((field) => {
      if (field.type === "number") return; // number inputs are not auto-filled
      if (field.showWhen) {
        const controlVal = normalizeOptionText_(String(answers[field.showWhen.field] || ""));
        if (controlVal !== normalizeOptionText_(String(field.showWhen.equals || ""))) return;
      }
      if (answers[field.key]) return;
      const options = Array.isArray(field.options) ? field.options : [];
      const noneOpt = options.find((o) => {
        const v = normalizeOptionText_(String(o && o.value || "")).toLowerCase();
        const l = normalizeOptionText_(String(o && (o.label || o.value) || "")).toLowerCase();
        return v === "none" || l === "none";
      });
      const fallbackOpt = noneOpt || options.find((o) => {
        const val = normalizeOptionText_(String(o && o.value || ""));
        return val && val.toLowerCase() !== "custom";
      });
      if (!fallbackOpt) return;
      const nextValue = normalizeOptionText_(String(fallbackOpt.value || ""));
      if (!nextValue) return;

      answers[field.key] = nextValue;
      const alias = normalizeOptionKey_(field.key);
      if (alias && !(alias in answers)) answers[alias] = nextValue;

      const el = panel.querySelector(`#${getFieldDomId(field.key)}`);
      if (el) el.value = nextValue;
    });

    const missing = flowFields.filter((f) => {
      if (f.showWhen) {
        const controlVal = normalizeOptionText_(String(answers[f.showWhen.field] || ""));
        if (controlVal !== normalizeOptionText_(String(f.showWhen.equals || ""))) return false;
      }
      if (f.type === "number") return !(Number(answers[f.key]) > 0);
      return !answers[f.key];
    }).map((f) => String(f.label || f.key));
    if (String(product && product.id || "") === "isg_canvas_prints" && String(answers.size || "").toLowerCase() === "custom") {
      if (!(Number(answers.width_mm) >= 400))  missing.push("Width (mm)");
      if (!(Number(answers.height_mm) >= 400)) missing.push("Height (mm)");
    }
    if (String(product && product.id || "") === "isg_car_magnets" && String(answers.size || "").toLowerCase() === "custom") {
      if (!(Number(answers.carMagnetWidth) > 0))  missing.push("Width (mm)");
      if (!(Number(answers.carMagnetHeight) > 0)) missing.push("Height (mm)");
    }
    if (String(product && product.id || "") === "isg_signboards" && String(answers.size || "").toLowerCase() === "custom") {
      if (!(Number(answers.signboardWidth) > 0))  missing.push("Width (mm)");
      if (!(Number(answers.signboardHeight) > 0)) missing.push("Height (mm)");
    }
    if (missing.length) {
      out.innerHTML = `<div class="muted">Complete all fields: ${escapeHtml(missing.join(", "))}</div>`;
      return;
    }

    if (String(product && product.id || "") === "isg_standard_printing") {
      const quote = calculateStandardPrintingQuote_(answers.size, answers.sides, answers.colour, Number(answers.qty), answers.lamination, answers.binding, Number(answers.num_booklets), getCostSettingsForProduct_(product));
      if (!quote) {
        out.innerHTML = `<div class="muted">No pricing available for this combination.</div>`;
        return;
      }
      const nb = Number(answers.num_booklets) || 0;
      let rows = "";
      rows += `<div class="sp-quote-row"><span>Printing — ${escapeHtml(quote.qty)} × ${formatCurrencyR_(quote.pp)}/page</span><span>${formatCurrencyR_(quote.printingTotal)}</span></div>`;
      if (isOwner) {
        rows += `<div class="sp-quote-subrow">Cost: ${formatCurrencyR_(quote.costExVat)}/page ex VAT — effective margin ${Math.round((1 - quote.costExVat / quote.pp) * 100)}%</div>`;
      }
      if (quote.laminationTotal > 0) {
        const lamIsRoll = quote.lam === "OPP Laminating" || quote.lam === "Roll Encapsulation";
        const lamNote = lamIsRoll ? (quote.laminationMinimumApplied ? " — minimum charge" : " (incl. 2 sheets waste)") : "";
        rows += `<div class="sp-quote-row"><span>Lamination — ${escapeHtml(quote.lam)}${lamNote}</span><span>${formatCurrencyR_(quote.laminationTotal)}</span></div>`;
      }
      if (quote.bindingTotal > 0) {
        rows += `<div class="sp-quote-row"><span>Comb Bind — ${escapeHtml(quote.bindingRingSize)} ring × ${nb} booklets (${formatCurrencyR_(quote.bindingPerBooklet)} each)</span><span>${formatCurrencyR_(quote.bindingTotal)}</span></div>`;
        rows += `<div class="sp-quote-subrow">Covers charged separately — R4.00 each (front + back per booklet)</div>`;
      }
      rows += `<div class="sp-quote-row sp-quote-total"><span>Total (Incl VAT)</span><span>${formatCurrencyR_(quote.total)}</span></div>`;
      let notices = "";
      if (quote.laminationError) {
        notices += `<div class="sp-quote-notice sp-notice-error">${escapeHtml(quote.laminationError)}</div>`;
      }
      if (quote.bindingError) {
        notices += `<div class="sp-quote-notice sp-notice-warn">${escapeHtml(quote.bindingError)}</div>`;
      }
      out.innerHTML = `
        <h4 style="margin:0 0 10px 0">Quote Result</h4>
        <div class="sp-quote-lines">${rows}</div>
        ${notices}
      `;
      return;
    }

    const adjustment = getAdjustmentForProduct_(product);
    const quote = calculatePrintstationQuote_(product, answers, adjustment);
    if (!quote) {
      out.innerHTML = `<div class="muted">No price available for this combination in current snapshot.</div>`;
      return;
    }

    const costBreakdownRows = renderCostBreakdownRows_(quote.costBreakdown);
    const ownerDetails = isOwner ? `
      <div class="kv"><label>Snapshot Base</label><div>${formatCurrencyR_(quote.basePrice)}</div></div>
      <div class="kv"><label>Adjusted Before Rounding</label><div>${formatCurrencyR_(quote.preRound)}</div></div>
      ${quote.quantityOverrideApplied ? `<div class="kv"><label>Qty Override</label><div>${quote.quantityOverrideClamped ? "Applied (clamped to baseline floor)" : "Applied"}</div></div>` : ""}
      ${quote.estimatedCostExVat ? `<div class="kv"><label>Estimated Cost (Ex VAT)</label><div>${formatCurrencyR_(quote.estimatedCostExVat)}</div></div>` : ""}
      ${quote.estimatedCostInclVat ? `<div class="kv"><label>Estimated Cost (Incl VAT)</label><div>${formatCurrencyR_(quote.estimatedCostInclVat)}</div></div>` : ""}
      ${quote.estimatedMarginRand != null ? `<div class="kv"><label>Estimated Margin (R)</label><div>${formatCurrencyR_(quote.estimatedMarginRand)}</div></div>` : ""}
      ${quote.estimatedMarginPercent != null ? `<div class="kv"><label>Estimated Margin (%)</label><div>${escapeHtml(`${quote.estimatedMarginPercent.toFixed(1)}%`)}</div></div>` : ""}
      ${costBreakdownRows}
    ` : "";
    const overrideNotice = (!isOwner && quote.quantityOverrideApplied)
      ? `<div class="kv"><label>Pricing Note</label><div>Owner quantity override is active for this quantity.</div></div>`
      : "";

    const noteHtml = quote.note
      ? `<div style="margin-top:10px;padding:10px 14px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;color:#7a4f00;font-weight:600">${escapeHtml(quote.note)}</div>`
      : "";
    out.innerHTML = `
      <h4 style="margin:0 0 8px 0">Quote Result</h4>
      <div class="detail-grid">
        <div class="kv"><label>Total Retail Price (Incl VAT)</label><div><strong>${formatCurrencyR_(quote.finalTotal)}</strong></div></div>
        <div class="kv"><label>Unit Price</label><div>${formatCurrencyR_(quote.unit)}</div></div>
        ${overrideNotice}
        ${ownerDetails}
      </div>
      ${noteHtml}
    `;
  };

  productSel.addEventListener("change", () => {
    msg.textContent = "";
    out.innerHTML = `<div class="muted">Select options and click Calculate Price.</div>`;
    renderFlow();
  });
  groupSel.addEventListener("change", () => {
    msg.textContent = "";
    refreshProductOptions();
    out.innerHTML = `<div class="muted">Select options and click Calculate Price.</div>`;
    renderFlow();
  });
  const searchCountEl = panel.querySelector("#pl-search-count");
  if (searchEl) {
    searchEl.addEventListener("input", () => {
      msg.textContent = "";
      const filtered = getFilteredProducts();
      refreshProductOptions();
      if (searchCountEl) {
        const q = searchEl.value.trim();
        searchCountEl.textContent = q ? `${filtered.length} product${filtered.length === 1 ? "" : "s"} found` : "";
      }
      if (filtered.length > 0) {
        productSel.value = String(filtered[0].slug || filtered[0].id);
      }
      out.innerHTML = `<div class="muted">Select options and click Calculate Price.</div>`;
      renderFlow();
      if (isOwner) renderOwnerAdjustments(getProduct());
    });
    searchEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") panel.querySelector("#pl-calc").click();
    });
  }

  panel.querySelector("#pl-calc").addEventListener("click", calculate);
  panel.querySelector("#pl-clear").addEventListener("click", () => {
    const product = getProduct();
    getFlowFields(product).forEach((field) => {
      const el = panel.querySelector(`#${getFieldDomId(field.key)}`);
      if (el) el.value = "";
    });
    out.innerHTML = `<div class="muted">Select options and click Calculate Price.</div>`;
    msg.textContent = "";
  });

  if (isOwner) {
    const saveBtn = panel.querySelector("#pl-owner-save");
    const setQtyBtn = panel.querySelector("#pl-owner-set-qty");
    const clearQtyBtn = panel.querySelector("#pl-owner-clear-qty");
    const resetBtn = panel.querySelector("#pl-owner-reset");
    const saveCostBtn = panel.querySelector("#pl-owner-cost-save");
    const resetCostBtn = panel.querySelector("#pl-owner-cost-reset");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const product = getProduct();
        const current = getAdjustmentForProduct_(product);
        const next = {
          markupPercent: Number(panel.querySelector("#pl-owner-markup")?.value || 0),
          fixedOffset: Number(panel.querySelector("#pl-owner-offset")?.value || 0),
          roundToNearest: Number(panel.querySelector("#pl-owner-round")?.value || 0),
          minimumPrice: Number(panel.querySelector("#pl-owner-min")?.value || 0),
          quantityOverrides: { ...(current.quantityOverrides || {}) },
        };
        saveAdjustmentForProduct_(product, next);
        msg.textContent = "Global settings saved.";
        renderFlow();
        calculate();
      });
    }
    if (setQtyBtn) {
      setQtyBtn.addEventListener("click", () => {
        const product = getProduct();
        const current = getAdjustmentForProduct_(product);
        const qtyKey = String(panel.querySelector("#pl-owner-qty")?.value || "").trim();
        const qtyPriceRaw = String(panel.querySelector("#pl-owner-qty-price")?.value || "").trim();
        const qtyPrice = Number(qtyPriceRaw);
        if (!qtyKey) {
          msg.textContent = "Choose a quantity tier first.";
          return;
        }
        if (!(Number.isFinite(qtyPrice) && qtyPrice > 0)) {
          msg.textContent = "Enter a valid exact total price.";
          return;
        }
        const next = {
          ...current,
          quantityOverrides: {
            ...(current.quantityOverrides || {}),
            [qtyKey]: qtyPrice,
          },
        };
        saveAdjustmentForProduct_(product, next);
        msg.textContent = `Qty ${qtyKey} price saved.`;
        renderFlow();
        calculate();
      });
    }
    if (clearQtyBtn) {
      clearQtyBtn.addEventListener("click", () => {
        const product = getProduct();
        const current = getAdjustmentForProduct_(product);
        const qtyKey = String(panel.querySelector("#pl-owner-qty")?.value || "").trim();
        if (!qtyKey) {
          msg.textContent = "Choose a quantity tier first.";
          return;
        }
        const nextQuantityOverrides = { ...(current.quantityOverrides || {}) };
        delete nextQuantityOverrides[qtyKey];
        saveAdjustmentForProduct_(product, {
          ...current,
          quantityOverrides: nextQuantityOverrides,
        });
        msg.textContent = `Qty ${qtyKey} price removed.`;
        renderFlow();
        calculate();
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const product = getProduct();
        saveAdjustmentForProduct_(product, getProductAdjustmentDefaults_(product));
        msg.textContent = "Reset to snapshot defaults.";
        renderFlow();
        calculate();
      });
    }
    if (saveCostBtn) {
      saveCostBtn.addEventListener("click", () => {
        const product = getProduct();
        const defaults = getProductCostDefaults_(product);
        const keys = Object.keys(defaults || {});
        if (!keys.length) {
          msg.textContent = "No cost model configured for this product.";
          return;
        }
        const next = {};
        keys.forEach((k) => {
          const el = panel.querySelector(`#pl-owner-cost-${k}`);
          const n = Number(el && el.value);
          next[k] = Number.isFinite(n) ? n : defaults[k];
        });
        saveCostSettingsForProduct_(product, next);
        msg.textContent = "Cost settings saved.";
        renderFlow();
        calculate();
      });
    }
    if (resetCostBtn) {
      resetCostBtn.addEventListener("click", () => {
        const product = getProduct();
        saveCostSettingsForProduct_(product, getProductCostDefaults_(product));
        msg.textContent = "Cost settings reset.";
        renderFlow();
        calculate();
      });
    }
  }

  refreshProductOptions();
  renderFlow();
  out.innerHTML = `<div class="muted">Select options and click Calculate Price.</div>`;
  return panel;
}

function getIntakeAllProducts_() {
  const seen = new Set();
  const items = [];
  const add = (label, value) => {
    const key = (value || label).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ label, value: value || label });
  };
  // Common in-house types first
  ["Vinyl Stickers", "Business Cards", "Flyers", "Posters", "Plan Prints", "DTF",
   "Standard Printing", "Photo Prints", "Canvas Prints", "Correx Boards", "Sublimation"].forEach(n => add(n));
  // Common outsourced types
  ["Business Cards (Bulk/Outsourced)", "Flyers (Bulk/Outsourced)", "Correx /ABS/ PVC Foam Board",
   "NCR Books", "Stamps", "Stickers"].forEach(n => add(n));
  // All pricelist products
  getCustomPriceListProducts_().forEach(p => { if (p.name) add(p.name); });
  return items;
}

function wireSublimationSubProduct_(container, job) {
  const subSel = container.querySelector("#jd-spec-sublimation_product");
  if (!subSel) return;
  subSel.addEventListener("change", () => {
    const newSub = subSel.value;
    const fakeJob = Object.assign({}, job, { product: "Sublimation", specs: `Product: ${newSub}` });
    container.innerHTML = renderSpecEditFields_(fakeJob);
    wireSpecVisibility_(container);
    wireSublimationSubProduct_(container, job);
  });
}

function wireSpecVisibility_(container) {
  const rows = container.querySelectorAll("[data-show-when-field]");
  if (!rows.length) return;
  const update = () => {
    rows.forEach(row => {
      const controlId = row.dataset.showWhenField;
      const equals = row.dataset.showWhenEquals;
      const controlEl = container.querySelector(`#${controlId}`);
      row.style.display = controlEl && controlEl.value === equals ? "" : "none";
    });
  };
  update();
  container.querySelectorAll("select, input").forEach(el => el.addEventListener("change", update));
}

function setupProductDetailSearch_(panel, job) {
  const wrap = panel.querySelector("#jd-product-wrap");
  if (!wrap) return;
  const searchEl = wrap.querySelector("#jd-product-search");
  const resultsEl = wrap.querySelector(".ji-product-search-results");
  const hiddenEl = wrap.querySelector("#jd-product-value");
  if (!searchEl || !resultsEl || !hiddenEl) return;

  const allProducts = getIntakeAllProducts_();
  let committedValue = hiddenEl.value;

  const rerenderSpecs = (newProduct) => {
    const specsContainer = document.getElementById("jd-specs-container");
    if (!specsContainer) return;
    const categoryEl = document.getElementById("jd-category");
    const effectiveCat = categoryEl ? categoryEl.value : job.category;
    const fakeJob = Object.assign({}, job, { category: effectiveCat, product: newProduct, inhouseType: newProduct, specs: "" });
    specsContainer.innerHTML = renderSpecEditFields_(fakeJob);
    wireSpecVisibility_(specsContainer);
    wireSublimationSubProduct_(specsContainer, job);
  };

  const renderResults = (filtered) => {
    if (!filtered.length) { resultsEl.style.display = "none"; return; }
    resultsEl.innerHTML = filtered.slice(0, 20).map(p =>
      `<div class="ji-product-search-item" data-value="${escapeHtml(p.value)}">${escapeHtml(p.label)}</div>`
    ).join("");
    resultsEl.style.display = "block";
  };

  const selectProduct = (value) => {
    searchEl.value = value;
    hiddenEl.value = value;
    committedValue = value;
    resultsEl.style.display = "none";
    rerenderSpecs(value);
  };

  searchEl.addEventListener("input", () => {
    const q = searchEl.value.trim().toLowerCase();
    if (!q) { renderResults(allProducts.slice(0, 12)); return; }
    renderResults(allProducts.filter(p => p.label.toLowerCase().includes(q)));
  });

  searchEl.addEventListener("focus", () => {
    const q = searchEl.value.trim().toLowerCase();
    if (!q) { renderResults(allProducts.slice(0, 12)); return; }
    renderResults(allProducts.filter(p => p.label.toLowerCase().includes(q)));
  });

  searchEl.addEventListener("blur", () => {
    setTimeout(() => {
      searchEl.value = committedValue;
      hiddenEl.value = committedValue;
      resultsEl.style.display = "none";
    }, 150);
  });

  resultsEl.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".ji-product-search-item");
    if (!item) return;
    e.preventDefault();
    selectProduct(item.dataset.value);
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) resultsEl.style.display = "none";
  }, true);
}

function setupProductTypeSearch_(panel, wrapSel, selectId) {
  const wrap = panel.querySelector(wrapSel);
  const selectEl = panel.querySelector(`#${selectId}`);
  if (!wrap || !selectEl) return;
  const searchEl = wrap.querySelector(".ji-product-search-input");
  const resultsEl = wrap.querySelector(".ji-product-search-results");
  if (!searchEl || !resultsEl) return;

  const allProducts = getIntakeAllProducts_();

  const renderResults = (filtered) => {
    if (!filtered.length) { resultsEl.style.display = "none"; return; }
    resultsEl.innerHTML = filtered.slice(0, 20).map(p =>
      `<div class="ji-product-search-item" data-value="${escapeHtml(p.value)}">${escapeHtml(p.label)}</div>`
    ).join("");
    resultsEl.style.display = "block";
  };

  const selectProduct = (value, label) => {
    searchEl.value = label;
    let opt = Array.from(selectEl.options).find(o => (o.value || o.text) === value);
    if (!opt) {
      opt = document.createElement("option");
      opt.value = value;
      opt.text = label;
      selectEl.add(opt);
    }
    selectEl.value = opt.value || opt.text;
    selectEl.dispatchEvent(new Event("change"));
    resultsEl.style.display = "none";
  };

  const syncFromSelect = () => {
    const val = selectEl.value;
    if (val && searchEl.value !== val) searchEl.value = val;
  };

  searchEl.addEventListener("input", () => {
    const q = searchEl.value.trim().toLowerCase();
    if (!q) { renderResults(allProducts.slice(0, 12)); return; }
    renderResults(allProducts.filter(p => p.label.toLowerCase().includes(q)));
  });

  searchEl.addEventListener("focus", () => {
    const q = searchEl.value.trim().toLowerCase();
    if (!q) { renderResults(allProducts.slice(0, 12)); return; }
    renderResults(allProducts.filter(p => p.label.toLowerCase().includes(q)));
  });

  resultsEl.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".ji-product-search-item");
    if (!item) return;
    e.preventDefault();
    selectProduct(item.dataset.value, item.textContent.trim());
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) resultsEl.style.display = "none";
  }, true);

  selectEl.addEventListener("change", syncFromSelect);
  syncFromSelect();
}

function hydrateIntakeDraft_(panel) {
  const ids = [
    "ji-staff", "ji-customer", "ji-phone", "ji-email", "ji-source", "ji-notes-inline",
    "ji-sales-ref",
    "ji-job-type", "ji-payment", "ji-value", "ji-turnaround", "ji-artwork-source",
    "ji-artwork-link", "ji-promised", "ji-artwork-approved", "ji-inhouse-type",
    "ji-inhouse-specs", "ji-outsourced-type", "ji-partner", "ji-outsourced-specs",
    "ji-supplier", "ji-ink-item", "ji-ink-specs", "ji-return-supplier", "ji-return-brand",
    "ji-return-model", "ji-return-request", "ji-return-fault", "ji-notes", "ji-urgent",
    "ji-sublimation-product",
    "ji-design-type", "ji-design-brief", "ji-design-format", "ji-design-reference",
  ];
  ids.forEach(id => {
    const el = panel.querySelector(`#${id}`);
    if (!el) return;
    if (!(id in state.intakeDraft)) return;
    el.value = state.intakeDraft[id];
  });
}

function bindIntakeDraftInputs_(panel) {
  const els = panel.querySelectorAll("input, select, textarea");
  els.forEach(el => {
    if (!el.id || el.type === "file") return;
    const handler = () => { state.intakeDraft[el.id] = el.value; };
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  });
}

function getSuggestedDueDateForInputs_(jobType, turnaroundPurchased) {
  const daysByType = {
    "In-house Printing": 2,
    "Outsourced Printing": 3,
    "Ink/Stock Order": 1,
    "Cartridge Return": 2,
  };
  let days = daysByType[jobType] || 2;
  if (jobType === "Outsourced Printing") {
    const s = String(turnaroundPurchased || "").toLowerCase();
    const m = s.match(/(\d+)/);
    const purchased = m ? Number(m[1]) : 2;
    // Purchased turnaround is production days; suggested customer date includes dispatch day.
    days = purchased + 1;
  }
  const d = addBusinessDaysLocal_(new Date(), days);
  return formatYmdLocal_(d);
}

function readFileAsBase64_(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      if (idx < 0) {
        reject(new Error("Invalid file encoding"));
        return;
      }
      resolve(result.slice(idx + 1));
    };
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

async function uploadArtworkFile_(file, customerName) {
  if (!file) return "";
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("File too large (max 25MB).");
  }
  const base64 = await readFileAsBase64_(file);
  const res = await fetch(API.baseUrl, {
    method: "POST",
    body: JSON.stringify({
      action: "uploadArtwork",
      key: API.key,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      contentBase64: base64,
      customerName: customerName || "",
    }),
  });
  const out = await res.json();
  if (!out.ok) throw new Error(out.error || "Upload failed");
  return out.data && out.data.url ? String(out.data.url) : "";
}

async function refreshJobFromApi_(jobNo) {
  const no = String(jobNo || "").trim();
  if (!no) return;
  try {
    const url = `${API.baseUrl}?action=job&key=${encodeURIComponent(API.key)}&jobNo=${encodeURIComponent(no)}`;
    const res = await fetch(url, { method: "GET" });
    const payload = await res.json();
    if (!payload.ok || !payload.data) return;
    const refreshed = toLocalJob(payload.data);
    if (!refreshed.jobNo) return;
    const idx = state.jobs.findIndex(j => j.jobNo === refreshed.jobNo);
    if (idx >= 0) state.jobs[idx] = { ...state.jobs[idx], ...refreshed };
    else state.jobs.push(refreshed);
    render();
  } catch (_err) {
    // Non-fatal refresh miss; UI already has local optimistic state.
  }
}

function renderSpecQuestions_(panel, host, mode, productType) {
  if (!host) return;
  host.innerHTML = "";
  const fields = ((SPEC_SCHEMAS[mode] || {})[productType] || []);
  if (!fields.length) return;

  const title = document.createElement("div");
  title.className = "spec-question-title";
  title.textContent = "Suggested Spec Questions";
  host.appendChild(title);

  fields.forEach(field => {
    if (!isSpecFieldVisible_(panel, mode, productType, field)) return;
    const row = document.createElement("div");
    row.className = "kv";
    const label = document.createElement("label");
    label.textContent = field.label;
    row.appendChild(label);

    const id = getSpecFieldId_(mode, productType, field.id);
    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "";
      input.appendChild(blank);
      (field.options || []).forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        input.appendChild(o);
      });
    } else {
      input = document.createElement("input");
      input.type = field.type === "number" ? "number" : "text";
      if (field.type === "number") input.min = "0";
      if (field.placeholder) input.placeholder = field.placeholder;
    }
    input.id = id;
    if (id in state.intakeDraft) input.value = state.intakeDraft[id];
    const sync = () => { state.intakeDraft[id] = input.value; };
    input.addEventListener("input", sync);
    input.addEventListener("change", () => {
      sync();
      renderSpecQuestions_(panel, host, mode, productType);
    });
    row.appendChild(input);
    host.appendChild(row);
  });
}

function composeSpecsFromQuestions_(panel, mode, productType) {
  const fields = ((SPEC_SCHEMAS[mode] || {})[productType] || []);
  if (!fields.length) return "";
  const lines = [];
  fields.forEach(field => {
    const id = getSpecFieldId_(mode, productType, field.id);
    const el = panel.querySelector(`#${id}`);
    const value = String(el ? el.value : "").trim();
    if (!value) return;
    lines.push(`${field.label}: ${value}`);
  });
  return lines.join("\n");
}

function getSpecFieldId_(mode, productType, fieldId) {
  const slug = String(productType || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `ji-spec-${mode}-${slug}-${fieldId}`;
}

function isSpecFieldVisible_(panel, mode, productType, field) {
  if (!field || !field.showWhen) return true;
  const depId = getSpecFieldId_(mode, productType, field.showWhen.field);
  const depEl = panel.querySelector(`#${depId}`);
  const depVal = String(depEl ? depEl.value : (state.intakeDraft[depId] || "")).trim();
  return depVal === String(field.showWhen.equals || "").trim();
}

function getEasterSundayLocal_(year) {
  const a = year%19, b=Math.floor(year/100), c=year%100;
  const d=Math.floor(b/4), e=b%4, f=Math.floor((b+8)/25);
  const g=Math.floor((b-f+1)/3), h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4), k=c%4, l=(32+2*e+2*i-h-k)%7;
  const m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31);
  const day=((h+l-7*m+114)%31)+1;
  return new Date(year, month-1, day);
}

function getSaHolidaySetLocal_(year) {
  const set = new Set();
  const addDate = (date) => {
    set.add(`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`);
    if (date.getDay() === 0) {
      const mon = new Date(date);
      mon.setDate(mon.getDate() + 1);
      set.add(`${mon.getFullYear()}-${mon.getMonth()+1}-${mon.getDate()}`);
    }
  };
  [[1,1],[3,21],[4,27],[5,1],[6,16],[8,9],[9,24],[12,16],[12,25],[12,26]].forEach(([m,d]) => addDate(new Date(year, m-1, d)));
  const easter = getEasterSundayLocal_(year);
  const gf = new Date(easter); gf.setDate(easter.getDate() - 2);
  const fd = new Date(easter); fd.setDate(easter.getDate() + 1);
  addDate(gf);
  addDate(fd);
  return set;
}

function addBusinessDaysLocal_(startDate, add) {
  const d = new Date(startDate);
  let count = 0;
  const cache = {};
  while (count < add) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      const yr = d.getFullYear();
      if (!cache[yr]) cache[yr] = getSaHolidaySetLocal_(yr);
      const key = `${yr}-${d.getMonth()+1}-${d.getDate()}`;
      if (!cache[yr].has(key)) count++;
    }
  }
  return d;
}

function formatYmdLocal_(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function render() {
  try {
    renderTabs();
    const app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = "";
    if (state.loading) {
      app.innerHTML = `<section class="panel"><h3>Loading jobs…</h3></section>`;
      return;
    }
    if (state.error) {
      app.innerHTML = `<section class="panel"><h3>Live API unavailable</h3><p>${state.error}</p><p>Showing demo data.</p></section>`;
    }
    if (state.tab === "staff_board") {
      app.appendChild(renderBoard(false));
      app.appendChild(renderCancelledQueue(false));
    }
    if (state.tab === "owner_dashboard") {
      app.appendChild(renderBoard(true));
      app.appendChild(renderOwnerDesignQueue());
      app.appendChild(renderCancelledQueue(true));
    }
    if (state.tab === "owner_reports") app.appendChild(renderOwnerReports());
    if (state.tab === "owner_actions") app.appendChild(renderOwnerActions());
    if (state.tab === "vinyl_queue") app.appendChild(renderVinylQueue());
    if (state.tab === "job_detail") {
      app.appendChild(renderJobDetail());
      try { window.scrollTo({ top: 0, behavior: "instant" }); } catch (_e) { window.scrollTo(0, 0); }
    }
    if (state.tab === "cartridge_finder") app.appendChild(renderCartridgeFinder());
    if (state.tab === "price_list") app.appendChild(renderPriceList());
    if (state.tab === "alerts") app.appendChild(renderAlerts());
    if (state.tab === "batching") app.appendChild(renderBatching());
    if (state.tab === "job_intake") app.appendChild(renderIntake());
    if (state.tab === "vinyl_pricing") app.appendChild(renderVinylPricing());
    if (state.tab === "completed_jobs") app.appendChild(renderCompletedJobs());
    if (state.tab === "deleted_jobs") app.appendChild(renderDeletedJobs());
  } catch (err) {
    const app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = `
      <section class="panel">
        <h3>Render error</h3>
        <p>${escapeHtml(String(err && err.message ? err.message : err))}</p>
      </section>
    `;
  }
}

function toLocalJob(record) {
  const category = String(record["Category"] || "");
  const rawStatus = String(record["System Status"] || "");
  const promised = String(record["Promised Due Date"] || "");
  const calcDue = String(record["Calculated Due Date"] || "");
  const due = (promised || calcDue || "").slice(0, 10);
  const isTerminal = ["Collected", "Closed", "Completed", "Cancelled"].includes(rawStatus);
  const promiseRisk = !isTerminal && !!(promised && calcDue && calcDue.slice(0, 10) > promised.slice(0, 10));
  const specsRaw = String(record["Specs (All Products)"] || "");
  const proofRequirement = "";
  const jobValueRaw = Number(record["Job Value (R)"] || 0);
  const hardProofApproved = getHardProofApproved_(String(record["Notes"] || ""));
  const paymentStatusRaw = String(record["Payment Status"] || "").replace(/^Not Paid$/i, "Unpaid");
  // Pay on Collection doesn't require upfront payment — strip the payment-waiting component
  let status = rawStatus;
  if (paymentStatusRaw === "Pay on Collection") {
    if (status === "Waiting Payment & Artwork") status = "Waiting Artwork";
    else if (status === "Waiting Payment") status = "Ready";
  }
  const blocked = ["Waiting Payment", "Waiting Payment & Artwork", "Waiting Approval", "Awaiting Artwork Approval", "Awaiting Hard Proof Approval", "Unpaid", "Backordered"].includes(status);
  const urgent = String(record["Notes"] || "").toUpperCase().includes("URGENT REQUEST");
  const product = getProductLabelFromRecord_(record);
  const inhouseTypeRaw = getRecordValueByHeaderList_(record, [
    "In-House Product Type",
    "In-house Product Type",
    "Product Type",
  ]) || getRecordValueByHeaderRegex_(record, /^in-?house product type$/i);
  const artworkLinkRaw = getRecordValueByHeaderList_(record, [
    "Artwork Upload Link",
    "Artwork Link",
    "Upload Artwork",
  ]) || getRecordValueByHeaderRegex_(record, /^artwork.*link$/i);
  const customerPhoneRaw = getRecordValueByHeaderList_(record, ["Customer Phone", "Phone"]);
  const customerEmailRaw = getRecordValueByHeaderList_(record, ["Customer Email", "Customer E-mail", "Email"]);
  const salesReferenceRaw = getRecordValueByHeaderList_(record, ["Hike Quote / Sale Reference", "Return Sales Reference No."]);
  return {
    jobNo: String(record["Job #"] || ""),
    category,
    customer: String(record["Customer Name"] || ""),
    staff: String(record["Staff Responsible"] || ""),
    product,
    due,
    calcDue: calcDue.slice(0, 10),
    jobReadyAt: String(record["Job Ready Date"] || record["Form Timestamp"] || ""),
    status,
    promiseRisk,
    blocked,
    urgent,
    specs: specsRaw,
    notes: String(record["Notes"] || ""),
    jobValue: Number(record["Job Value (R)"] || 0),
    payment: paymentStatusRaw,
    batch: String(record["Batch Slot (PS-11:00 / PS-16:00 / INK-15:00 / NONE)"] || "NONE"),
    batchId: String(record["Batch ID"] || ""),
    promisedDue: String(record["Promised Due Date"] || ""),
    turnaroundPurchased: String(record["Turnaround Purchased"] || ""),
    supplier: String(record["Supplier Required"] || ""),
    inhouseType: String(inhouseTypeRaw || ""),
    artworkSource: String(record["Artwork Source"] || ""),
    outsourcePartner: String(record["Outsource Partner"] || ""),
    artworkLink: String(artworkLinkRaw || ""),
    communicationStatus: String(record["Communication Status"] || ""),
    customerNotified: String(record["Customer Notified?"] || "No"),
    customerApproved: record["Customer Approved"] === true || String(record["Customer Approved"]) === "true",
    proofRequirement,
    hardProofApproved,
    customerPhone: normalizePhoneZa_(customerPhoneRaw),
    customerEmail: String(customerEmailRaw || ""),
    salesReference: String(salesReferenceRaw || ""),
    paymentMethod: String(record["Payment Method"] || ""),
    orderGroup: String(record["Order #"] || ""),
    commLog: (() => {
      try { return JSON.parse(String(record["Comm Log"] || "[]")) || []; }
      catch (_e) { return []; }
    })(),
  };
}

function getProductLabelFromRecord_(record) {
  const inhouse = String(
    getRecordValueByHeaderList_(record, ["In-House Product Type", "In-house Product Type", "Product Type"]) ||
    getRecordValueByHeaderRegex_(record, /^in-?house product type$/i) ||
    ""
  ).trim();
  if (inhouse) return inhouse;
  const outsourced = String(record["Outsourced Product Type"] || "").trim();
  if (outsourced) return outsourced;
  const specs = String(record["Specs (All Products)"] || "").trim();
  if (specs) {
    const productLine = specs.split(/\r?\n/).find(line => /product type/i.test(String(line || "")));
    if (productLine) {
      const value = String(productLine).split(":").slice(1).join(":").trim();
      if (value) return value;
    }
  }
  const jobType = String(record["Job Type"] || "").trim();
  if (jobType === "Cartridge Return") return "Cartridge Return";
  if (jobType === "Ink/Stock Order") {
    const specs = String(record["Specs (All Products)"] || "").trim();
    if (!specs) return "Ink/Stock Order";
    const first = specs.split(/\r?\n/)[0].trim();
    const value = first.includes(":") ? first.split(":").slice(1).join(":").trim() : first;
    return value || "Ink/Stock Order";
  }
  return "Unspecified";
}

function getRecordValueByHeaderList_(record, headers) {
  const list = Array.isArray(headers) ? headers : [];
  for (let i = 0; i < list.length; i++) {
    const h = String(list[i] || "").trim();
    if (!h) continue;
    if (Object.prototype.hasOwnProperty.call(record, h)) {
      const v = record[h];
      if (v !== null && v !== undefined && String(v).trim() !== "") return v;
    }
  }
  return "";
}

function getRecordValueByHeaderRegex_(record, regex) {
  if (!record || !regex) return "";
  const keys = Object.keys(record || {});
  for (let i = 0; i < keys.length; i++) {
    const k = String(keys[i] || "").trim();
    if (!k || !regex.test(k)) continue;
    const v = record[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") return v;
  }
  return "";
}

// Appends a communication log entry to a job. Updates local state immediately
// and fires a background save. Caller should call refreshOpenPanel_() if needed.
function loadCommLogStore_() {
  try {
    const raw = localStorage.getItem(ISG_COMM_LOG_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch (_e) { return {}; }
}

function saveCommLogStore_(store) {
  try { localStorage.setItem(ISG_COMM_LOG_KEY, JSON.stringify(store)); } catch (_e) {}
}

function loadPaymentMethodStore_() {
  try {
    const raw = localStorage.getItem(ISG_PAYMENT_METHODS_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch (_e) { return {}; }
}

function savePaymentMethodStore_(store) {
  try { localStorage.setItem(ISG_PAYMENT_METHODS_KEY, JSON.stringify(store)); } catch (_e) {}
}

function persistPaymentMethod_(jobNo, method) {
  if (!jobNo || !String(method || "").trim()) return;
  const store = loadPaymentMethodStore_();
  store[jobNo] = String(method).trim();
  savePaymentMethodStore_(store);
}

const PENDING_SAVES_KEY = "isg_pending_saves_v1";
const PENDING_SAVES_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours fallback

function persistPendingSave_(jobNo, updates) {
  if (!jobNo) return;
  try {
    const store = JSON.parse(localStorage.getItem(PENDING_SAVES_KEY) || "{}");
    // Strip empty sales reference so we never overwrite a real reference with blank.
    const safeUpdates = { ...updates };
    if (!String(safeUpdates["Hike Quote / Sale Reference"] || "").trim()) {
      delete safeUpdates["Hike Quote / Sale Reference"];
    }
    store[jobNo] = { updates: safeUpdates, ts: Date.now() };
    localStorage.setItem(PENDING_SAVES_KEY, JSON.stringify(store));
  } catch (_e) {}
}

function clearPendingSave_(jobNo) {
  if (!jobNo) return;
  try {
    const store = JSON.parse(localStorage.getItem(PENDING_SAVES_KEY) || "{}");
    delete store[jobNo];
    localStorage.setItem(PENDING_SAVES_KEY, JSON.stringify(store));
  } catch (_e) {}
}

function pendingSaveServerMatch_(serverJob, pendingUpdates) {
  // Returns true when the server data already reflects the pending save — GAS has committed it.
  if (pendingUpdates.specs !== undefined && serverJob.specs !== pendingUpdates.specs) return false;
  if (pendingUpdates.category !== undefined && serverJob.category !== pendingUpdates.category) return false;
  if (pendingUpdates.product !== undefined && serverJob.product !== pendingUpdates.product) return false;
  return true;
}

function loadPendingSavesStore_() {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_SAVES_KEY) || "{}");
    const now = Date.now();
    const valid = {};
    Object.keys(raw).forEach(k => {
      if (raw[k] && (now - (raw[k].ts || 0)) < PENDING_SAVES_TTL_MS) valid[k] = raw[k];
    });
    return valid;
  } catch (_e) { return {}; }
}

function addCommLogEntry_(job, type, note) {
  const staff = state.staffName || "?";
  const ts = new Date().toISOString();
  const entry = { ts, type: String(type || "Other"), note: String(note || "").trim(), staff };
  const idx = state.jobs.findIndex(j => j.jobNo === job.jobNo);
  // Always read from live state so stale closure references don't overwrite previous entries.
  const currentJob = idx >= 0 ? state.jobs[idx] : job;
  const existing = Array.isArray(currentJob.commLog) ? currentJob.commLog : [];
  const newLog = [...existing, entry];
  if (idx >= 0) state.jobs[idx] = { ...state.jobs[idx], commLog: newLog };
  // Persist to localStorage so commLog survives page refresh even if backend column isn't live yet.
  const store = loadCommLogStore_();
  store[job.jobNo] = newLog;
  saveCommLogStore_(store);
  saveJobChanges(job.jobNo, { commLog: JSON.stringify(newLog) }, { keepTab: true, quiet: true, optimistic: true, noMerge: true });
}

function buildCustomerNotify_(job) {
  const phone = String(job.customerPhone || "").trim();
  const email = String(job.customerEmail || "").trim();
  const msg   = `Hi ${job.customer}, your order (${job.jobNo}) is ready for collection at Ink Station Glengarry. Thank you!`;
  if (phone) {
    const digits = phone.replace(/\D/g, "").replace(/^0/, "27");
    return { type: "whatsapp", url: `https://wa.me/${digits}?text=${encodeURIComponent(msg)}` };
  }
  if (email) {
    const subject = encodeURIComponent(`Your order ${job.jobNo} is ready for collection`);
    const body    = encodeURIComponent(`Hi ${job.customer},\n\nYour order (${job.jobNo}) is ready for collection at Ink Station Glengarry.\n\nThank you!`);
    return { type: "email", url: `https://mail.google.com/mail/?authuser=isglengarry@gmail.com&view=cm&fs=1&to=${encodeURIComponent(email)}&su=${subject}&body=${body}` };
  }
  return null;
}

function normalizePhoneZa_(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return digits;
  if (digits.startsWith("27")) return `0${digits.slice(2)}`;
  if (digits.length === 9) return `0${digits}`;
  return digits;
}

function formatCurrencyR_(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `R${n.toFixed(2)}`;
}

function renderCostBreakdownRows_(costBreakdown) {
  if (!costBreakdown || typeof costBreakdown !== "object") return "";
  const rows = [];
  const pushCurrency = (label, value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    rows.push(`<div class="kv"><label>${escapeHtml(label)}</label><div>${formatCurrencyR_(n)}</div></div>`);
  };
  const pushNumber = (label, value, digits) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    const out = Number.isFinite(Number(digits)) ? n.toFixed(Number(digits)) : String(n);
    rows.push(`<div class="kv"><label>${escapeHtml(label)}</label><div>${escapeHtml(out)}</div></div>`);
  };
  const pushPercent = (label, value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    rows.push(`<div class="kv"><label>${escapeHtml(label)}</label><div>${escapeHtml(`${n.toFixed(1)}%`)}</div></div>`);
  };
  const pushText = (label, value) => {
    const text = String(value || "").trim();
    if (!text) return;
    rows.push(`<div class="kv"><label>${escapeHtml(label)}</label><div>${escapeHtml(text)}</div></div>`);
  };

  pushNumber("Quantity", costBreakdown.qty);
  pushNumber("Sheets Per Unit", costBreakdown.sheetsPerUnit, 2);
  pushText("Sheet Size", costBreakdown.sheetSize ? String(costBreakdown.sheetSize).toUpperCase() : "");
  pushText("Print Mode", costBreakdown.printMode);
  pushText("Paper Key", costBreakdown.paperKey);
  pushCurrency("Click Cost / Sheet (Ex VAT)", costBreakdown.clickExVatPerSheet);
  pushCurrency("Paper Cost / Sheet (Ex VAT)", costBreakdown.paperExVatPerSheet);
  pushCurrency("Print Cost / Unit (Ex VAT)", costBreakdown.printExVatPerUnit);
  pushCurrency("Paper Cost / Unit (Ex VAT)", costBreakdown.paperExVatPerUnit);
  pushCurrency("Extra Cost / Unit (Ex VAT)", costBreakdown.extraExVatPerUnit);
  pushCurrency("Setup (Ex VAT)", costBreakdown.setupExVat);
  pushPercent("Waste %", costBreakdown.wastePercent);
  pushPercent("Overhead %", costBreakdown.overheadPercent);
  pushPercent("Min Margin %", costBreakdown.minMarginPercent);
  pushPercent("PrintStation Buffer %", costBreakdown.printstationBufferPercent);

  // Canvas-specific breakdown (ink, canvas media, frame).
  if (costBreakdown.ink != null || costBreakdown.canvas != null || costBreakdown.frame != null) {
    if (costBreakdown.inkArea != null) pushNumber("Print Area (m²)", costBreakdown.inkArea, 4);
    if (costBreakdown.canvasArea != null) pushNumber("Canvas Area incl. wrap (m²)", costBreakdown.canvasArea, 4);
    pushCurrency("Ink Cost (Incl VAT)", costBreakdown.ink);
    pushCurrency("Canvas Media Cost (Incl VAT)", costBreakdown.canvas);
    pushCurrency("Frame Cost (Incl VAT)", costBreakdown.frame);
  }

  // Backward compatibility for older booklet-specific breakdown data.
  if (!rows.length) {
    pushNumber("Inner Sheets / Book", costBreakdown.innerSheetsPerBook);
    pushCurrency("Print Cost / Book (Ex VAT)", costBreakdown.printExVatPerBook);
    pushCurrency("Paper Cost / Book (Ex VAT)", costBreakdown.paperExVatPerBook);
    pushCurrency("Setup (Ex VAT)", costBreakdown.setupExVat);
  }
  return rows.join("");
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripInternalNoteLines_(notes) {
  return String(notes || "")
    .split("\n")
    .filter(line => !/^Gmail-MsgId:\s/.test(line.trim()) && !/^Email:\s+"/.test(line.trim()))
    .join("\n")
    .trim();
}

function applyLocalJobUpdates_(job, updates) {
  const next = { ...job };
  if ("systemStatus" in updates) next.status = String(updates.systemStatus || next.status || "");
  if ("paymentStatus" in updates) next.payment = String(updates.paymentStatus || next.payment || "");
  if ("promisedDueDate" in updates) next.promisedDue = String(updates.promisedDueDate || "");
  if ("communicationStatus" in updates) next.communicationStatus = String(updates.communicationStatus || "");
  if ("customerNotified" in updates) next.customerNotified = String(updates.customerNotified || "No");
  if ("customerApproved" in updates) next.customerApproved = !!updates.customerApproved;
  if ("notes" in updates) next.notes = String(updates.notes || "");
  if ("artworkLink" in updates) next.artworkLink = String(updates.artworkLink || "");
  if ("artworkSource" in updates) next.artworkSource = String(updates.artworkSource || "");
  if ("paymentMethod" in updates) {
    next.paymentMethod = String(updates.paymentMethod || "");
    if (next.paymentMethod) persistPaymentMethod_(job.jobNo, next.paymentMethod);
  }
  if ("customerPhone" in updates) next.customerPhone = String(updates.customerPhone || "");
  if ("customerEmail" in updates) next.customerEmail = String(updates.customerEmail || "");
  if ("orderGroup" in updates) next.orderGroup = String(updates.orderGroup || "");
  if ("specs" in updates) next.specs = String(updates.specs || "");
  if ("product" in updates) next.product = String(updates.product || "");
  if ("inhouseType" in updates) next.inhouseType = String(updates.inhouseType || "");
  if ("category" in updates) next.category = String(updates.category || "");
  if ("Hike Quote / Sale Reference" in updates) next.salesReference = String(updates["Hike Quote / Sale Reference"] || "");
  if ("Return Sales Reference No." in updates && !next.salesReference) next.salesReference = String(updates["Return Sales Reference No."] || "");
  if ("commLog" in updates) {
    if (Array.isArray(updates.commLog)) next.commLog = updates.commLog;
    else { try { next.commLog = JSON.parse(String(updates.commLog || "[]")) || []; } catch (_e) {} }
  }
  next.hardProofApproved = getHardProofApproved_(next.notes);

  const promised = (next.promisedDue || "").slice(0, 10);
  const calcDueLocal = (next.calcDue || "").slice(0, 10);
  const isTerminalLocal = ["Collected", "Closed", "Completed", "Cancelled"].includes(next.status);
  next.promiseRisk = !isTerminalLocal && !!(promised && calcDueLocal && calcDueLocal > promised);
  next.blocked = ["Waiting Payment", "Waiting Payment & Artwork", "Waiting Approval", "Awaiting Artwork Approval", "Awaiting Hard Proof Approval", "Unpaid", "Backordered"].includes(next.status);
  next.urgent = String(next.notes || "").toUpperCase().includes("URGENT REQUEST");
  return next;
}

async function saveJobChanges(jobNo, updates, options = {}) {
  const keepTab = !!options.keepTab;
  const quiet = !!options.quiet;
  const inlineBatchFeedback = !!options.inlineBatchFeedback;
  const optimistic = !!options.optimistic;
  const noMerge = !!options.noMerge;
  const renderDuringSave = !(inlineBatchFeedback && quiet && keepTab);
  state.saving = true;
  if (!quiet) state.saveMessage = "";
  // Apply updates to local state before the first render so the panel doesn't flash back
  // to the old value while the network request is in flight (e.g. phone number revert bug).
  let preSnapshot = null;
  if (!optimistic) {
    const preIdx = state.jobs.findIndex(j => j.jobNo === jobNo);
    if (preIdx >= 0) {
      preSnapshot = { ...state.jobs[preIdx] };
      state.jobs[preIdx] = applyLocalJobUpdates_(state.jobs[preIdx], updates);
    }
  }
  if (!optimistic && renderDuringSave) render();
  try {
    console.log("[ISG-DEBUG] saving updates:", JSON.stringify(updates));
    const res = await fetch(API.baseUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "updateJob",
        key: API.key,
        fastWrite: true,
        jobNo,
        updates,
      }),
    });
    const payload = await res.json();
    console.log("[ISG-DEBUG] save response:", JSON.stringify(payload));
    if (!payload.ok) throw new Error(payload.error || "Save failed");
    if (!noMerge && payload.data && typeof payload.data === "object") {
      const updatedJob = toLocalJob(payload.data);
      const mergeIdx = state.jobs.findIndex(j => j.jobNo === jobNo);
      if (mergeIdx >= 0) {
        // Start with server data overlaid on current local state, then re-apply
        // the user's updates on top. fastWrite returns the row before the sheet
        // commits, so the server response is often stale — re-applying updates
        // ensures specs, category, status, notes etc. are never overwritten.
        const serverMerged = { ...state.jobs[mergeIdx], ...updatedJob };
        const merged = applyLocalJobUpdates_(serverMerged, updates);
        // Always keep local paymentMethod / salesReference if server returns blank.
        if (!String(updatedJob.paymentMethod || "").trim() && String(state.jobs[mergeIdx].paymentMethod || "").trim()) {
          merged.paymentMethod = state.jobs[mergeIdx].paymentMethod;
        }
        // If server DID return a paymentMethod, mirror it to localStorage for refresh survival.
        if (String(merged.paymentMethod || "").trim()) {
          persistPaymentMethod_(jobNo, merged.paymentMethod);
        }
        if (!String(updatedJob.salesReference || "").trim() && String(state.jobs[mergeIdx].salesReference || "").trim()) {
          merged.salesReference = state.jobs[mergeIdx].salesReference;
        }
        // Preserve local commLog if the server returned empty.
        if ((!updatedJob.commLog || updatedJob.commLog.length === 0) && Array.isArray(state.jobs[mergeIdx].commLog) && state.jobs[mergeIdx].commLog.length > 0) {
          merged.commLog = state.jobs[mergeIdx].commLog;
        }
        state.jobs[mergeIdx] = merged;
      }
      else state.jobs.push(updatedJob);
    }
    if (!quiet) state.saveMessage = "Saved";
    if (!keepTab) state.tab = "job_detail";
    if (!optimistic && renderDuringSave) render();
    // Auto-queue Mimaki jobs the moment they reach Ready status.
    if (updates.systemStatus === "Ready" && !options.skipAutoQueue) {
      const savedJob = state.jobs.find(j => j.jobNo === jobNo);
      if (savedJob && String(savedJob.category || "") === "In-house" && isMimakiJob_(savedJob)) {
        setTimeout(() => {
          saveJobChanges(jobNo, { systemStatus: "Batched (Vinyl Print Run)" }, { keepTab: true, quiet: true, skipAutoQueue: true });
        }, 200);
      }
    }
    // Track this save so the silent refresh won't overwrite fields before backend propagates.
    if (!noMerge) state.recentSaves[jobNo] = { updates, ts: Date.now() };
    // Persist save to localStorage so F5 refresh doesn't lose changes before GAS commits.
    if (!noMerge) persistPendingSave_(jobNo, updates);
    // Delayed silent refresh keeps data fresh without blocking the save UX.
    scheduleSilentRefresh_(15000);
    return true;
  } catch (err) {
    // Revert the optimistic local update so the panel reflects the unchanged server state.
    delete state.recentSaves[jobNo];
    if (preSnapshot !== null) {
      const revertIdx = state.jobs.findIndex(j => j.jobNo === jobNo);
      if (revertIdx >= 0) state.jobs[revertIdx] = preSnapshot;
    }
    const raw = String(err && err.message ? err.message : err);
    if (raw.toLowerCase().includes("no valid update fields provided")) {
      if (!quiet) state.saveMessage = "No changes to save";
      return false;
    }
    const msg = `Save failed: ${raw}`;
    if (!quiet) state.saveMessage = msg;
    else window.alert(msg);
    if (renderDuringSave) render();
    return false;
  } finally {
    state.saving = false;
    if (!optimistic && renderDuringSave) render();
  }
}

async function bulkSaveJobChanges_(items) {
  const payloadItems = Array.isArray(items) ? items.filter(i => i && i.jobNo && i.updates) : [];
  if (!payloadItems.length) return false;

  state.saving = true;
  state.saveMessage = "";
  render();
  try {
    const res = await fetch(API.baseUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "bulkUpdateJobs",
        key: API.key,
        fastWrite: true,
        items: payloadItems,
      }),
    });
    const payload = await res.json();
    if (!payload.ok) throw new Error(payload.error || "Bulk save failed");

    const updated = Array.isArray(payload.data && payload.data.updated) ? payload.data.updated : [];
    if (updated.length) {
      updated.forEach(rec => {
        const next = toLocalJob(rec);
        if (!next.jobNo) return;
        const idx = state.jobs.findIndex(j => j.jobNo === next.jobNo);
        if (idx >= 0) state.jobs[idx] = { ...state.jobs[idx], ...next };
        else state.jobs.push(next);
      });
    } else {
      payloadItems.forEach(item => {
        const idx = state.jobs.findIndex(j => j.jobNo === item.jobNo);
        if (idx >= 0) {
          state.jobs[idx] = applyLocalJobUpdates_(state.jobs[idx], item.updates || {});
        }
      });
    }

    const errors = Array.isArray(payload.data && payload.data.errors) ? payload.data.errors : [];
    if (errors.length) {
      window.alert(`Bulk update completed with ${errors.length} error(s).`);
    }
    state.saveMessage = "Batch updates saved";
    render();
    scheduleSilentRefresh_(15000);
    return true;
  } catch (err) {
    const raw = String(err && err.message ? err.message : err);
    if (!raw.toLowerCase().includes("no valid update fields provided")) {
      window.alert(`Bulk save failed: ${raw}`);
    }
    return false;
  } finally {
    state.saving = false;
    render();
  }
}

function scheduleSilentRefresh_(delayMs = 3000) {
  if (silentRefreshTimer) clearTimeout(silentRefreshTimer);
  silentRefreshTimer = setTimeout(() => {
    silentRefreshTimer = null;
    if (state.tab === "job_detail" || state.tab === "job_intake" || state.tab === "cartridge_finder" || state.tab === "vinyl_pricing" || state.tab === "price_list") return;
    loadLiveData({ silent: true });
  }, delayMs);
}

async function loadLiveData(options = {}) {
  const silent = !!options.silent;
  if (silent && (state.tab === "job_detail" || state.tab === "job_intake" || state.tab === "cartridge_finder" || state.tab === "vinyl_pricing" || state.tab === "price_list")) return;
  if (!silent) {
    state.loading = true;
    state.error = "";
    render();
  }
  try {
    const url = `${API.baseUrl}?action=jobs&key=${encodeURIComponent(API.key)}&_t=${Date.now()}`;
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const payload = await res.json();
    if (!payload.ok || !Array.isArray(payload.data)) {
      throw new Error(payload.error || "Invalid API response");
    }
    const prevNos = new Set(state.jobs.map(j => j.jobNo));
    const incoming = payload.data.map(toLocalJob).filter(j => j.jobNo);
    // empty sheet is valid — don't fall back to demo data
    if (silent) {
      const newJobs = incoming.filter(j => !prevNos.has(j.jobNo) && !isSoftDeleted_(j));
      const prevMap = new Map(state.jobs.map(j => [j.jobNo, j.status]));
      const changed = incoming.filter(j => !isSoftDeleted_(j) && prevMap.has(j.jobNo) && prevMap.get(j.jobNo) !== j.status);
      if (newJobs.length > 0) showToast_(`${newJobs.length} new job${newJobs.length > 1 ? "s" : ""} added`, "info");
      if (changed.length > 0) showToast_(`${changed.length} job${changed.length > 1 ? "s" : ""} updated`, "info");
    }
    if (silent) {
      // Preserve locally held commLog and paymentMethod that the server doesn't echo back yet.
      const localMap = new Map(state.jobs.map(j => [j.jobNo, j]));
      const storedMethods = loadPaymentMethodStore_();
      const pendingSavesStore = loadPendingSavesStore_();
      const RECENT_STATUS_WINDOW_MS = 30000;
      const now = Date.now();
      state.jobs = incoming.map(serverJob => {
        const local = localMap.get(serverJob.jobNo) || {};
        let merged = serverJob;
        // Restore commLog if server returned empty
        if (Array.isArray(local.commLog) && local.commLog.length > 0 && (!serverJob.commLog || serverJob.commLog.length === 0)) {
          merged = { ...merged, commLog: local.commLog };
        }
        // Restore paymentMethod if server returned blank
        if (!String(serverJob.paymentMethod || "").trim()) {
          const stored = storedMethods[serverJob.jobNo] || String(local.paymentMethod || "").trim();
          if (stored) merged = { ...merged, paymentMethod: stored };
        } else {
          // Server returned a value — keep it fresh in localStorage
          persistPaymentMethod_(serverJob.jobNo, serverJob.paymentMethod);
        }
        // Preserve recently saved changes — prevents silent refresh from
        // overwriting fields before the backend propagates the fastWrite.
        const recentSave = state.recentSaves[serverJob.jobNo];
        if (recentSave && (now - recentSave.ts) < RECENT_STATUS_WINDOW_MS) {
          merged = applyLocalJobUpdates_(merged, recentSave.updates);
        } else if (recentSave && (now - recentSave.ts) >= RECENT_STATUS_WINDOW_MS) {
          delete state.recentSaves[serverJob.jobNo];
        }
        // Fall back to localStorage pending saves if in-memory window has expired.
        const pendingSave = pendingSavesStore[serverJob.jobNo];
        if (pendingSave) {
          if (pendingSaveServerMatch_(serverJob, pendingSave.updates)) {
            clearPendingSave_(serverJob.jobNo); // GAS has committed — no longer needed
          } else {
            merged = applyLocalJobUpdates_(merged, pendingSave.updates);
          }
        }
        return merged;
      });
    } else {
      // On full page load, restore commLog, paymentMethod, and recent saves from localStorage.
      const storedLogs = loadCommLogStore_();
      const storedMethods = loadPaymentMethodStore_();
      const pendingSaves = loadPendingSavesStore_();
      state.jobs = incoming.map(serverJob => {
        let merged = serverJob;
        if (!serverJob.commLog || serverJob.commLog.length === 0) {
          const stored = storedLogs[serverJob.jobNo];
          if (Array.isArray(stored) && stored.length > 0) merged = { ...merged, commLog: stored };
        }
        if (!String(serverJob.paymentMethod || "").trim()) {
          const stored = storedMethods[serverJob.jobNo];
          if (stored) merged = { ...merged, paymentMethod: stored };
        } else {
          persistPaymentMethod_(serverJob.jobNo, serverJob.paymentMethod);
        }
        // Re-apply recent saves so F5 doesn't lose changes before GAS commits to sheet.
        const pending = pendingSaves[serverJob.jobNo];
        if (pending) {
          if (pendingSaveServerMatch_(serverJob, pending.updates)) {
            clearPendingSave_(serverJob.jobNo); // GAS confirmed — clear the entry
          } else {
            merged = applyLocalJobUpdates_(merged, pending.updates);
          }
        }
        return merged;
      });
    }
    state.lastRefresh = new Date();
    if (state.jobs.length && !state.jobs.some(j => j.jobNo === state.selectedJobNo)) {
      state.selectedJobNo = state.jobs[0].jobNo;
    }
    if (state.role === "owner" || state.role === "admin") {
      try {
        const actUrl = `${API.baseUrl}?action=actions&key=${encodeURIComponent(API.key)}`;
        const actRes = await fetch(actUrl, { method: "GET" });
        const actPayload = await actRes.json();
        if (actPayload.ok && Array.isArray(actPayload.data)) state.actions = actPayload.data;
      } catch (_e) {}
    }
    if (silent && state.tab !== "job_intake" && state.tab !== "cartridge_finder" && state.tab !== "vinyl_pricing" && state.tab !== "price_list" && !(state.tab === "owner_actions" && state.actionsNewForm)) render();
  } catch (err) {
    if (!silent) {
      state.error = String(err && err.message ? err.message : err);
      state.jobs = demoJobs.slice();
    }
  } finally {
    if (!silent) {
      state.loading = false;
      render();
    }
  }
}

// Sync the role dropdown to the persisted role
(function () {
  const el = document.getElementById("role");
  if (el && state.role && el.value !== state.role) el.value = state.role;
})();

// Sync staff name dropdown from localStorage and persist changes.
(function () {
  const el = document.getElementById("staff-name");
  if (!el) return;
  if (state.staffName) el.value = state.staffName;
  el.addEventListener("change", () => {
    state.staffName = el.value;
    try { localStorage.setItem(ISG_STAFF_KEY, state.staffName); } catch (_e) {}
  });
})();

// On first load, if no staff name is set, show a full-screen picker before the board.
function showStaffPickerIfNeeded_() {
  if (state.staffName) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "staff-picker-modal";
  overlay.style.cssText = "z-index:9999;backdrop-filter:blur(4px)";
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:340px;text-align:center">
      <div class="modal-title" style="font-size:18px;margin-bottom:4px">Welcome to ISG Operations</div>
      <p style="font-size:13px;color:var(--muted);margin-bottom:16px">Who are you? This will be remembered on this computer.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${STAFF_NAMES_.map(n => `<button type="button" class="sending-as-chip" data-name="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join("")}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll(".sending-as-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const chosen = btn.dataset.name;
      if (!chosen) return;
      state.staffName = chosen;
      try { localStorage.setItem(ISG_STAFF_KEY, chosen); } catch (_e) {}
      const el = document.getElementById("staff-name");
      if (el) el.value = chosen;
      overlay.remove();
      render();
    });
  });
}

loadLiveData().then(() => showStaffPickerIfNeeded_());
setInterval(() => {
  if (!state.saving && state.tab !== "job_intake" && state.tab !== "job_detail" && state.tab !== "cartridge_finder" && state.tab !== "vinyl_pricing" && state.tab !== "price_list" && !(state.tab === "owner_actions" && state.actionsNewForm)) loadLiveData({ silent: true });
}, 30000);
