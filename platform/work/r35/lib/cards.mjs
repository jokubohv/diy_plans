/**
 * Sanitized text-only source-page excerpt cards for Pantry R35.
 *
 * Every card is generated from this table: quoted instruction text with the printed page number,
 * no address/parcel/permit identity and no raw URLs. Citations point at the card asset plus a
 * pixel region inside the card viewBox (x/y measured from the top-left of the SVG).
 *
 * `kind: 'quote'` blocks are quotations; `kind: 'note'` blocks are conversion annotations.
 */
import { svgEscape, wrapText } from './util.mjs';

export const CARD_WIDTH = 880;
const MARGIN_X = 40;
const TEXT_WIDTH = CARD_WIDTH - MARGIN_X * 2;
const QUOTE_LINE_HEIGHT = 19;
const LABEL_LINE_HEIGHT = 22;

function blockHeight(block) {
  const lines = block.lines.reduce((sum, line) => sum + wrapText(line, 104).length, 0);
  return LABEL_LINE_HEIGHT + lines * QUOTE_LINE_HEIGHT + 6;
}

export const CARDS = [
  {
    id: 'p01-overview',
    file: 'r35-p01-overview.svg',
    title: 'Pantry R35 overview (printed page 1)',
    page: 1,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'ready', kind: 'quote', lines: ['READY: survey and loose practice only · house construction conditional'] },
      {
        key: 'method',
        kind: 'quote',
        lines: [
          'One top plate per wall remains the concept. Exact site connections still require the checks printed beside their steps.',
        ],
      },
      {
        key: 'next',
        kind: 'quote',
        lines: [
          'Next physical action: mark W1 at about 68 in as a trial from the existing finished wall, then locate the actual roof-truss bottom chord and record the cabinet boxes separately. No house cuts or slab holes follow from the drawing alone.',
        ],
      },
    ],
  },
  {
    id: 'p02-plan',
    file: 'r35-p02-plan.svg',
    title: 'Read the finished plan (printed page 2)',
    page: 2,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'inside', kind: 'quote', lines: ['W1 clear inside: 149 in after drywall; cabinet/fridge chain totals 149 in'] },
      { key: 'outside', kind: 'quote', lines: ['W1 outside depth: About 68 in trial from existing finished EX1 wall; 2 in less than original 70'] },
      { key: 'clear', kind: 'quote', lines: ['Clear pantry depth: About 63½ in if W1 finishes 4½ in thick'] },
      { key: 'return', kind: 'quote', lines: ['W2 return: 8⅜ in finished thick; stops at existing column front'] },
      {
        key: 'truss',
        kind: 'quote',
        lines: [
          "The A7 drawing's candidate truss center is about 65⅞ in from an assumed existing finished face; W1's proposed top-plate center at a 68-in outer face is about 65¾ in. This is a layout target, not an as-built connection.",
        ],
      },
      { key: 'concept', kind: 'quote', lines: ['CONCEPT: verify reference faces and the physical truss'] },
    ],
  },
  {
    id: 'p03-elevation',
    file: 'r35-p03-elevation.svg',
    title: 'Cabinet elevation (printed page 3)',
    page: 3,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      {
        key: 'fronts',
        kind: 'quote',
        lines: ['Refrigerator left; the 12-in drawer-over-door base is directly beside it. Two larger drawer bases follow, with two internal fillers.'],
      },
      { key: 'chain', kind: 'quote', lines: ['Wall-side allowance + GE bay + separator: 3¼ + 37 + ¾ = 41 in'] },
      { key: 'boxes', kind: 'quote', lines: ['B1/B2/B3 cabinet boxes: 106½ in measured together; individual widths unknown'] },
      { key: 'fillers', kind: 'quote', lines: ['F1 and F2 between boxes: ¾ + ¾ = 1½ in'] },
      { key: 'total', kind: 'quote', lines: ['Total finished W1 run: 41 + 106½ + 1½ = 149 in'] },
      {
        key: 'operating-fit',
        kind: 'quote',
        lines: [
          'Cabinet seams are illustrative. At 63½ in clear depth, the GE family dimensions plus 2 in rear space leave about 26¾ in to the opposite wall when closed, or about 11 in at the stated 90° door projection; neither proves actual swing. GE\'s family bin-removal note calls for about 14¼ in at the freezer-side wall, much more than the planned 3¼-in left-end allowance. Full-size operating and service checks are required before fixing W1 or the divider.',
        ],
      },
    ],
  },
  {
    id: 'p04-survey',
    file: 'r35-p04-survey.svg',
    title: 'Survey before cutting (printed page 4)',
    page: 4,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      {
        key: 'no-cut',
        kind: 'quote',
        lines: ["Write measured faces on painter's tape and in the field record; do not turn the reported 111-in finished ceiling into a stud cut."],
      },
      { key: 'ready', kind: 'quote', lines: ['READY: non-destructive measuring and removable floor tape'] },
      {
        key: 'steps',
        kind: 'quote',
        lines: [
          '01. Mark the existing finished EX1 wall as depth zero. Tape the proposed W1 room-side finished face at about 68 in. Mark its full 4½-in thickness and the planned 149-in finished inside run.',
          '02. Locate the physical roof-truss bottom chord along the full W1 line; mark its center at both ends and middle. Record any offset from the trial line. Do not infer a fastening point from the A7 PDF alone.',
          '03. Measure W1 inside length at floor, counter height and ceiling. Record W2 column projection/width and the actual contact plane.',
          '04. Measure B1, B2 and B3 separately, the cabinet mounting rails, the chosen shelf-bracket holes, and refrigerator body/door sweep. Tape a 37-in bay and 108-in base row on the floor.',
          "05. Photograph and mark both faces of EX1 and all existing trim. Establish the closet's 37-in inside width, 23-in depth, retained kitchen door and proposed back-wall opening boundaries.",
        ],
      },
      {
        key: 'holds',
        kind: 'quote',
        lines: ['If any endpoint/ceiling plane changes, revise the model, cuts, drywall sheets, trim and cart together. Field survey itself is safe independent work; destructive exposure and drilling remain held.'],
      },
    ],
  },
  {
    id: 'p05-trim',
    file: 'r35-p05-trim.svg',
    title: 'Remove only required baseboard (printed page 5)',
    page: 5,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      {
        key: 'scope',
        kind: 'quote',
        lines: ['Existing trim at wall tie-ins and the new closet passage is included before framing and later replaced at exposed finished faces.'],
      },
      {
        key: 'zones',
        kind: 'quote',
        lines: [
          "TR-01: if a baseboarded existing surface receives W1's left end, mark and remove only trim that blocks its full-height connection and finish tie-in.",
          'TR-02: at the existing column, remove only wrapped baseboard/shoe obstructing the W2 contact. W2 stops at the column front.',
          'TR-03: at EX1, remove trim on both accessible faces only within the approved passage and jamb/return finish limits. Keep the existing kitchen-side pantry door, jamb and casing.',
        ],
      },
      {
        key: 'bounds',
        kind: 'quote',
        lines: [
          "Do not remove an entire room's baseboard by default. EX1 trim work beyond survey waits for the opening location, wall role and service/structural plan. New baseboard is measured after drywall and cabinet fit.",
        ],
      },
    ],
  },
  {
    id: 'p06-parts',
    file: 'r35-p06-parts.svg',
    title: 'Set out the provisional parts (printed page 6)',
    page: 6,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'tray', kind: 'quote', lines: ['A planning tray, not a purchase or cutting release. Verify actual lumber sections, cabinet templates and the accepted connection details first.'] },
      { key: 'conditional', kind: 'quote', lines: ['CONDITIONAL: quantities change with field measurements and connections'] },
      {
        key: 'tray-rows',
        kind: 'quote',
        lines: [
          'W1-S01...S12 — 12 dry 2×4 studs; 1 candidate spare — Heights field-fit',
          'W2-S01...S05 — 5 dry 2×8 studs; 1 candidate spare — Member/connection held',
          'W1-BLOCK — 25 dry 2×6 flat blocks; 4 boards pack, 1 allowance — Bay/rail/fastener held',
          'PRACTICE — 1 separate dry 2×4×10 board — Loose exercise only',
          'GYPSUM — 8 half-inch + 2 five-eighth-inch 4×10 sheets in R35 nest — EX1 patches excluded; edge supports held',
        ],
      },
      {
        key: 'superseded',
        kind: 'quote',
        lines: ['Important distinction: the old R27 … 2×4 W2 studs, 2×4 backing, drywall sheet map, nail count, screw grid and pickup cart are not valid for this revision.'],
      },
      {
        key: 'stock',
        kind: 'quote',
        lines: ['The drywall figure is a rectangular stock study before the EX1 opening, patch shapes, ceiling interface, board selection, waste and inspected seam support. Do not order exact sheet or fastener counts from it.'],
      },
    ],
  },
  {
    id: 'p07-setup',
    file: 'r35-p07-setup.svg',
    title: 'Set up the work area (printed page 7)',
    page: 7,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'ready', kind: 'quote', lines: ['READY: protect, inventory and prove the handling route'] },
      { key: 'helper', kind: 'quote', lines: ['One-person layout and cutting are possible; a helper holds long top plates and handles drywall sheets. Build the walls in place.'] },
      {
        key: 'steps',
        kind: 'quote',
        lines: [
          '01. Protect the tile and set up a clamped cutting bench in the flex room. Prove the carry path for the long plates and 4×10 sheets before enclosing the room.',
          '02. Label W1/W2 plates and studs by ID, pantry/room face and datum end. Keep the room face accessible for backing connectors and inspection.',
          '03. Use a helper and a stable work platform for overhead plates. Accept the temporary support and top/base/end connections before setting any house members; do not rely on a helper alone to hold an unfinished wall.',
        ],
      },
      {
        key: 'method',
        kind: 'quote',
        lines: ['Selected method: plates first, then field-fit studs individually in place. No full-height frame tilt is planned. Keep the single top plate basis; do not copy the video\'s double top plate without revising all dependent heights.'],
      },
      {
        key: 'tools',
        kind: 'quote',
        lines: ['Frame assembly: Ryobi drill/driver, connector-matched nut setter/bit, square, clamps, stable work supports and work platform; helper for top plates.'],
      },
    ],
  },
  {
    id: 'p08-w1-plates',
    file: 'r35-p08-w1-plates.svg',
    title: "Mark W1's two plates (printed page 8)",
    page: 8,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'centres', kind: 'quote', lines: ['W1 candidate 2×4 studs S01-S12 · left-end plate datum 0 — Centers: ¾, 16, 32, 48, 64, 80, 96, 112, 128, 144, 148¾, 156 in'] },
      {
        key: 'steps',
        kind: 'quote',
        lines: [
          '01. After the finished faces and corner receiver are field verified, lay dry W1-TP and accepted sill W1-BP side by side with their left datum ends flush. Mark the same pantry-face arrow on both.',
          '02. From datum zero, square each 1½-in stud footprint across both plates. S11 is a short corner backer and S12 an end member, not a normal 16-in bay.',
          '03. Check first/last member edges against the actual endpoint, then measure both marked plates independently. Do not transfer superseded layout marks.',
        ],
      },
      {
        key: 'arithmetic',
        kind: 'quote',
        lines: ['Conditional arithmetic: 149 in finished inside + ½ in pantry gypsum + 7¼ in W2 core = 156¾ in W1 plate in the current through-corner model. This is not a saw cut until end surfaces and corner support are accepted.'],
      },
      { key: 'hold', kind: 'quote', lines: ['HOUSE CUT HELD: physical endpoints, truss and connection first'] },
    ],
  },
  {
    id: 'p09-w1-frame',
    file: 'r35-p09-w1-frame.svg',
    title: 'Build W1 in place (printed page 9)',
    page: 9,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'scope', kind: 'quote', lines: ['12 candidate 2×4 studs, one bottom plate and one top plate. Install only after the base, top, end and stud connections are accepted.'] },
      { key: 'hold', kind: 'quote', lines: ['HOUSE ASSEMBLY HELD: connection schedule and field heights'] },
      {
        key: 'steps',
        kind: 'quote',
        lines: [
          '01. Install W1-BP on the verified line using the accepted tile/slab anchor detail (Step 12). With a helper, position the single W1-TP and install the accepted nonbearing top restraint (Step 13); transfer stud marks vertically.',
          '02. At S01, measure between the actual installed plate faces. Apply the accepted fit/movement detail, cut one stud and trial-fit it. Do not wedge or jack the roof framing; do not batch-cut from the reported 111-in ceiling height.',
          '03. Plumb the stud in two directions and clamp/support it. Fit the selected angle connector tight to both wood faces in the approved orientation; drive only its listed connector screws into the required holes. Repeat at the opposite stud end.',
        ],
      },
      {
        key: 'method-change',
        kind: 'quote',
        lines: ["The screw/angle concept is a change from original D4 end-nailing. A connector's published screw table does not establish the required number/orientation for this loaded partition. See cards 08A and 11A; no generic toe-screw substitute is specified."],
      },
    ],
  },
  {
    id: 'p10-connector',
    file: 'r35-p10-connector.svg',
    title: 'Screw-fastened metal angles (printed page 10)',
    page: 10,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'conditional', kind: 'quote', lines: ['CONDITIONAL: A34 family; project placement and capacity not released'] },
      {
        key: 'candidate',
        kind: 'quote',
        lines: [
          'Candidate cavity-side connection for review; use actual connector holes. The sketch does not select load directions or an installed quantity.',
          'Angle: 2½ in along bend; each leg 1 7/16 in.',
          'Fastener: SD9112, #9 × 1½ in SD Connector screw.',
          '4 into stud + 4 into plate = 8 per angle.',
          'Four dots per leg are symbols only; use punched holes, not drawn spacing.',
        ],
      },
      {
        key: 'esr-limits',
        kind: 'quote',
        lines: [
          'ESR-3096 Table 5: F1 needs rotation restraint when angles are not paired; F2 is directional, and opposing angles require at least 3 in wood thickness. Do not add a second angle across a 1½-in stud by guess. Verify wood species/grade/moisture and complete loaded-wall restraint.',
        ],
      },
      {
        key: 'limits',
        kind: 'quote',
        lines: ['Source: ICC-ES ESR-3096 (Jan 2026), Table 5 / Fig. 5, p. 8. No load number in this report is a cabinet weight rating. Connector coating at treated plates must match treatment and exposure.'],
      },
    ],
  },
  {
    id: 'p11-w2-layout',
    file: 'r35-p11-w2-layout.svg',
    title: "Mark W2's 2×8 frame (printed page 11)",
    page: 11,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'scope', kind: 'quote', lines: ['W2 is finished 8⅜ in thick to match the existing column and ends at the column front; it does not pass through the column.'] },
      { key: 'chain', kind: 'quote', lines: ['½ in pantry gypsum / 7¼ in actual dry 2×8 core / ⅝ in room-side gypsum — ½ + 7¼ + ⅝ = 8⅜ in finished W2 thickness'] },
      { key: 'plate', kind: 'quote', lines: ['Candidate plate length 53-53⅛ in; actual column contact governs'] },
      {
        key: 'projection',
        kind: 'quote',
        lines: ["02. The current comparison is 53 in using A3's 11-in projection, or 53⅛ in using the user's 10⅞-in projection. Mark the first four candidate stud centers ¾, 16, 32 and 48 in only if they fit the accepted end/detail; field-fit the last member against the true column end."],
      },
      { key: 'hold', kind: 'quote', lines: ['HOUSE CUT HELD: actual column surface and W2 connection detail'] },
    ],
  },
  {
    id: 'p12-w2-frame',
    file: 'r35-p12-w2-frame.svg',
    title: 'Build W2 and connect the walls (printed page 12)',
    page: 12,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'scope', kind: 'quote', lines: ['Five candidate 2×8 studs; one top and one bottom plate. W2 remains 8⅜ in finished, matching the column.'] },
      { key: 'hold', kind: 'quote', lines: ['HOUSE ASSEMBLY HELD: W2 angle layout, corner and column connections'] },
      {
        key: 'steps',
        kind: 'quote',
        lines: [
          '02. Measure between the installed plates at S01-S05 separately. Cut and trial-fit one stud first, then install each stud plumb with the reviewed W2 connector placement and screw pattern. A wider 2×8 is not automatically covered by a 2×4 joint detail.',
          '03. Tie W2 to the verified W1 corner receiver and to sound wood in the existing column using their own selected screw/connector details. The current corner has only 1½ in candidate wood contact; a small stud angle is not its automatic solution.',
        ],
      },
      {
        key: 'stop',
        kind: 'quote',
        lines: ['Do not fasten to existing drywall as a structural receiver or cut the column to make a connector fit. Preserve all required metal connector holes; do not trim or drill a connector to clear an obstruction.'],
      },
    ],
  },
  {
    id: 'p13-practice',
    file: 'r35-p13-practice.svg',
    title: 'Practice the saw and driver (printed page 13)',
    page: 13,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'ready', kind: 'quote', lines: ['READY: loose-stock practice after tool/product checks'] },
      { key: 'owned', kind: 'quote', lines: ['Use the owned Ryobi drill/driver; check its model instructions. Practice is on loose stock, not the house wall or tile.'] },
      {
        key: 'yield',
        kind: 'quote',
        lines: ['02. Dry-fit mock frame: use the separate dry 2×4×10 practice board for two 24-in plates and three 21-in studs. Check the first cut square; dry-fit a 24×24-in rectangle. Use surplus offcuts for a separate angle-and-screw trial; do not consume house parts.'],
      },
      {
        key: 'limits',
        kind: 'quote',
        lines: ['The purchased Ryobi model is not recorded: use its own manual for modes and accessory changes; no clutch number is prescribed. For the SD Connector candidate, use a ¼-in hex nut setter. No hammer-drill mode for driving wood/connector screws. A good mock joint checks technique, not the wall\'s capacity.'],
      },
    ],
  },
  {
    id: 'p14-sd9112',
    file: 'r35-p14-sd9112.svg',
    title: 'Drive connector screws (printed page 14)',
    page: 14,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'conditional', kind: 'quote', lines: ['PRACTICE CARD: actual joint placement still conditional'] },
      {
        key: 'spec',
        kind: 'quote',
        lines: [
          '01. Read the connector stamp and screw box. For this A34 candidate use SD9112 (#9 × 1½ in), with a compatible ¼-in hex nut setter. SDWS structural wood screws are a different product and are not a substitute through these connector holes.',
          '04. Fill the required holes: A34 Table 5 has four screws in each leg. Inspect all eight heads and both members.',
          'Do not countersink, hammer the head down, bend a flange or enlarge a hole to clear drywall.',
        ],
      },
      {
        key: 'nonselected',
        kind: 'quote',
        lines: ['Other plate options are not interchangeable: the A35 bent stud-to-plate A2/C2/D configuration uses 6 + 6 SD9112 screws; A1/C1/E uses 3 + 6. Its wrapped flange/heads can conflict with drywall. Generic mending plates and nail-only stud ties are not selected.'],
      },
      { key: 'sources', kind: 'quote', lines: ['Sources: ESR-3096 Fig. 5 / Table 5; Simpson approved SD Connector applications. Keep the exact product and driver manuals at the work area.'] },
    ],
  },
  {
    id: 'p15-slab',
    file: 'r35-p15-slab.svg',
    title: 'Plan the tile-to-slab base (printed page 15)',
    page: 15,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'hold', kind: 'quote', lines: ['HOLD: no drilling until substrate, services and complete anchor detail clear'] },
      { key: 'retain', kind: 'quote', lines: ['Retain the tile. Hidden holes are acceptable only if surrounding tile stays intact; the actual anchor target is the concrete below.'] },
      {
        key: 'steps',
        kind: 'quote',
        lines: [
          '01. Record the floor stack at W1/W2: tile, mortar or underlayment, and the concrete slab. Identify cracks, loose tile, movement joints, membranes and the actual bearing surface. Protect the tile from dropped tools and grit.',
          '02. Use house drawings and qualified site investigation to clear every proposed hole cylinder, including extra depth, of embedded services, reinforcement/tendons and prohibited joints. A5 depicts under-slab conduit/condensate routes; the PDF cannot certify any exact hole clear.',
        ],
      },
      {
        key: 'limits',
        kind: 'quote',
        lines: ['Never count tile/mortar as anchor embedment or promise crack-free drilling. Do not drill a test hole to discover hidden services. The R27 slab anchor/cart line is not current for this layout.'],
      },
    ],
  },
  {
    id: 'p16-plates',
    file: 'r35-p16-plates.svg',
    title: 'Position plates and restrain walls (printed page 16)',
    page: 16,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'order', kind: 'quote', lines: ['Execute before the stud installation in Steps 08 and 10. W1 first, then W2; helper for overhead pieces.'] },
      { key: 'hold', kind: 'quote', lines: ['HOLD: accepted top, end, slab and temporary restraint details'] },
      {
        key: 'steps',
        kind: 'quote',
        lines: [
          '02. Set the bottom plate on the accepted bearing/separation stack. Align the reference edge to the surveyed line, then install the specified concrete anchors through the prepared tile clearance holes. Do not use the wood connector screws as concrete anchors.',
          '03. Transfer the W1 bottom-plate marks overhead with a checked level or laser. A helper holds the top plate while the accepted nonbearing restraint is installed. Keep the required truss-movement allowance; ordinary rigid stud angles are not truss clips.',
          '04. Repeat for W2 after W1 is stable.',
        ],
      },
      {
        key: 'truss',
        kind: 'quote',
        lines: ['A7 suggests a truss center about 65⅞ in from the existing finish; W1 plate center is about 65¾ in on the 68-in trial. Locate the real chord before fixing this line. If the actual location differs, revise W2, aisle and drywall lengths; do not move the wall by guess or screw into ceiling gypsum.'],
      },
    ],
  },
  {
    id: 'p17-straightening',
    file: 'r35-p17-straightening.svg',
    title: 'Make the frame straight (printed page 17)',
    page: 17,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'hold', kind: 'quote', lines: ['HOLD: straighten only after wall restraints and correction method are accepted'] },
      {
        key: 'steps',
        kind: 'quote',
        lines: [
          '01. At the lumber rack: sight down each 2×4 and 2×8 length from one end. Set aside members with obvious bow, twist, cup, split or damage; mark the crown on usable studs.',
          '02. While fitting studs in place: keep the pantry-side stud faces flush with the plate edges. Plumb and clamp each stud before installing its connectors. Check several joints with a square; do not use screws to pull a badly twisted stud straight.',
        ],
      },
      {
        key: 'correction',
        kind: 'quote',
        lines: ['04. For a cabinet-rail or shelf-bracket station, make the stud and flat 2×6 backing themselves land on the accepted mounting plane; a drywall shim is not a structural screw receiver. Any sistered stud or new fastening detail needs review before use.'],
      },
      {
        key: 'handbook',
        kind: 'quote',
        lines: ['CGC/USG Construction Handbook, ch. 12, printed p. 350, advises checking stud, block and plate alignment before gypsum, straightening badly bowed members and shimming recessed faces flush.'],
      },
    ],
  },
  {
    id: 'p18-backing',
    file: 'r35-p18-backing.svg',
    title: 'Add 2×6 cabinet backing (printed page 18)',
    page: 18,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'hold', kind: 'quote', lines: ['HOLD: actual cabinet rails and block-to-stud/wall load path'] },
      { key: 'scope', kind: 'quote', lines: ["The owner selected 2×6 instead of the approved plan's 2×4 backing. These 25 pieces are between W1 studs, laid flat."] },
      { key: 'short-bay', kind: 'quote', lines: ['Short S10-S11 clear bay: 3¼ in; all bay blocks are field-fit'] },
      {
        key: 'steps',
        kind: 'quote',
        lines: [
          '01. Transfer actual U1/U2/U3 and base cabinet mounting holes/rails to W1. Move the pictured 5½-in-high bands if their real fastener rows differ.',
          '02. Measure each stud bay separately. Trial-cut one dry 2×6 block, put its 5½-in face vertical and pantry-facing flush to the W1 studs, and check the 1½-in depth stays inside the cavity.',
        ],
      },
      { key: 'mix', kind: 'quote', lines: ['Nominal mix: 20×14½ + 2×13¾ + 3×3¼ = 327¼ in. Four 8-ft boards pack on paper; one extra is a field-fit allowance. These are not batch cuts. Shelf brackets use verified full studs and their chosen hardware.'] },
    ],
  },
  {
    id: 'p19-backing-connection',
    file: 'r35-p19-backing-connection.svg',
    title: 'Connect the cabinet backing (printed page 19)',
    page: 19,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'hold', kind: 'quote', lines: ['HOLD: resolve opposing angles before buying backing hardware'] },
      { key: 'flat', kind: 'quote', lines: ['Keep all 25 dry 2×6 blocks, flat: 5½-in face vertical, 1½-in depth. Keep the cabinet fastening plane flush to the pantry-side studs.'] },
      { key: 'space', kind: 'quote', lines: ['The angle leg is 1 7/16 in, so it can fit within the 2-in space behind a flat block. Its 2½-in bend length can run vertically on the 5½-in block face. This checks space only; load direction, screw layout and tool access are still required.'] },
      {
        key: 'conflict',
        kind: 'quote',
        lines: ['03. At studs shared by adjacent blocks, do not install angles on both sides of the 1½-in stud using this generic detail. ESR-3096 requires 3-in minimum wood thickness for opposing angles. Vertical staggering is not a documented exception.'],
      },
      {
        key: 'quantity',
        kind: 'quote',
        lines: ['Do not order 50 angles for 25 blocks by multiplication. The final quantity is unresolved. Shelf brackets remain attached to verified full studs with their own hardware; backing angles do not replace shelf brackets or cabinet mounting screws.'],
      },
    ],
  },
  {
    id: 'p20-ex1',
    file: 'r35-p20-ex1.svg',
    title: 'Make the new closet passage (printed page 20)',
    page: 20,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'hold', kind: 'quote', lines: ['HOLD: existing-wall role, services, support and opening detail'] },
      { key: 'scope', kind: 'quote', lines: ['The existing kitchen-side pantry door stays. The new door-sized walk-through is cut through the back wall of the 37-in-wide, 23-in-deep closet.'] },
      {
        key: 'steps',
        kind: 'quote',
        lines: [
          '01. Identify the complete EX1 wall section on both faces and above the ceiling: gravity/lateral role, posts/straps, header conditions, wires, pipes, insulation and any rated or bracing function.',
          "02. A qualified reviewer sets the exact opening width/location, exposed finish limits, retained members, any temporary support, header/jamb and sill/threshold detail. Do not use the closet's 37-in inside width as an automatic rough opening.",
        ],
      },
      { key: 'scope-limits', kind: 'quote', lines: ['The kitchen-side door, jamb and casing are retained. Neither new W1 nor W2 frame contains this doorway. EX1 framing, patch boards and trim are not included in the new-wall board/stud takeoff.'] },
    ],
  },
  {
    id: 'p21-drywall-faces',
    file: 'r35-p21-drywall-faces.svg',
    title: 'Plan each drywall face (printed page 21)',
    page: 21,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'hold', kind: 'quote', lines: ['HOLD: actual wall planes, edge supports, top detail and EX1 patches'] },
      { key: 'faces', kind: 'quote', lines: ["W1 has ½-in gypsum on both faces. W2's candidate matching-column section uses ½ in on the pantry face and ⅝ in on the room face."] },
      {
        key: 'steps',
        kind: 'quote',
        lines: [
          '01. Before panel cutting, inspect all four faces for confirmed stud/edge receivers, cabinet backing, service map, approved top movement detail and required inspections. Photograph and mark every concealed row.',
          '03. Use 4×10 sheets only after the carry path and helper handling are proven. The numbered concept below nests eight ½-in sheets and two ⅝-in sheets; one spare of each would make 12 sheets before EX1 patches. Verify field heights, waste and stock before ordering.',
        ],
      },
      { key: 'release', kind: 'quote', lines: ['The next three plates give candidate face widths and a specific stock nest, not a cut or screw release. The actual gypsum product, field heights, seam receivers, ceiling movement and corner overlap must agree before cutting or fastening.'] },
    ],
  },
  {
    id: 'p22-drywall-map',
    file: 'r35-p22-drywall-map.svg',
    title: 'Four-face drywall map (drawing on printed page 22)',
    page: 22,
    relationship: 'carry_forward',
    kind: 'drawing_region',
    blocks: [
      { key: 'w1p', kind: 'quote', lines: ['W1 PANTRY FACE · ½ in board — Board width 149½ in · vertical 48 × 120 stock'] },
      { key: 'w1r', kind: 'quote', lines: ['W1 ROOM FACE · ½ in board — Board width 157⅜ in'] },
      { key: 'w2p', kind: 'quote', lines: ['W2 PANTRY FACE · ½ in board — Board width 52⅝ in'] },
      { key: 'w2r', kind: 'quote', lines: ['W2 ROOM FACE · ⅝ in board — Board width 56⅝ in'] },
      { key: 'heights', kind: 'quote', lines: ['x from W1 left plate end · height Hᵢ = field fit'] },
      { key: 'release', kind: 'quote', lines: ['SCHEMATIC — use written dimensions; all cuts and fastening remain conditional.'] },
    ],
  },
  {
    id: 'p23-24-junction',
    file: 'r35-p23-24-junction.svg',
    title: 'Wood junction and gypsum corners (drawings on printed pages 23–24)',
    page: 23,
    relationship: 'carry_forward',
    kind: 'drawing_region',
    blocks: [
      { key: 'junction', kind: 'quote', lines: ['W1 through / W2 butt: wood junction — W1 frame x = 0 → 156¾; y = −4 → −½ · W2 frame x = 149½ → 156¾; y = −½ → C · W2 finishes: x = 149 pantry / x = 157⅜ room · C = 52⅝ candidate column front; no frame through retained column.'] },
      { key: 'footprints', kind: 'quote', lines: ['W1-S11 backer: x = 148–149½. W1-S12 end stud: x = 155¼–156¾.', 'W2-S01: x = 149½–156¾ and y = −½–1; its full-width receiver is not established.'] },
      { key: 'corners', kind: 'quote', lines: ['INSIDE CORNER: W2-P (½) butts to W1-P face. Folded tape + compatible compound only if accepted as a fixed joint.', 'OUTSIDE CORNER: W1-R (½) laps W2-R (⅝). Approved bead + compound; profile field-fit.'] },
      { key: 'chain', kind: 'quote', lines: ['½ + 7¼ core + ⅝ = 8⅜ in'] },
      { key: 'hold', kind: 'quote', lines: ['Connection type, fasteners, access, added blocking and load path require acceptance. This page shows fit and support geometry only. It is not an assembly fastening detail.'] },
    ],
  },
  {
    id: 'p25-drywall-hang',
    file: 'r35-p25-drywall-hang.svg',
    title: 'Hang and fasten drywall (printed page 25)',
    page: 25,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'hold', kind: 'quote', lines: ['HOLD: preclose inspection, panel map and board-specific screw schedule'] },
      {
        key: 'steps',
        kind: 'quote',
        lines: [
          '01. Label each panel by wall and face (for example W1-P-01). Put a full sheet on broad supports. Mark from the measured field size, score the face paper against a straightedge, snap, cut the back paper and rasp the edge square.',
          '02. Dry-fit the first panel against the correct face and edge supports. Verify no outlet, pipe, bracket backing or seam is hidden without its marked opening/support. Make box cutouts to the electrician\'s layout; do not conceal a junction.',
          '04. Use the three preceding drawings to sequence the accepted W1/W2 framing and board laps; then complete EX1 repairs after accepted framing. Inspect each seam/support, top gap and bottom separation before tape.',
        ],
      },
      { key: 'stop', kind: 'quote', lines: ['Do not use framing nails to hang gypsum or drywall screws for structural frame joints. Superseded panel/screw maps cannot be used with W2\'s new ⅝-in side or changed lengths.'] },
    ],
  },
  {
    id: 'p26-finish',
    file: 'r35-p26-finish.svg',
    title: 'Tape, finish, paint and baseboard (printed page 26)',
    page: 26,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'conditional', kind: 'quote', lines: ['CONDITIONAL: board/compound system and finish surfaces first'] },
      {
        key: 'steps',
        kind: 'quote',
        lines: [
          '02. At the pantry inside corner shown on the preceding plate, if an accepted fixed joint is specified, bed folded paper tape into compound along the W1-P/W2-P seam. Use the selected movement-joint detail instead if the connection requires movement.',
          '03. At the room outside corner, fit the selected corner bead to the W1-R lap over W2-R, fasten or embed it by its own instructions, then coat and feather each side.',
          '05. Measure visible finished W1 room face, W2 faces and EX1 returns for matching new baseboard. Reuse sound labeled trim where practical; cut new pieces to measured returns and attach to verified wood, avoiding service paths and the tile.',
        ],
      },
      { key: 'baseboard', kind: 'quote', lines: ['Baseboard behind flush cabinets and the refrigerator is decided from the real cabinet/appliance clearance instructions. Trim removal does not require tile removal or authorize anchor drilling.'] },
    ],
  },
  {
    id: 'p27-fixtures',
    file: 'r35-p27-fixtures.svg',
    title: 'Install cabinets, shelves and the refrigerator (printed page 27)',
    page: 27,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'hold', kind: 'quote', lines: ['HOLD: actual cabinet rail templates, fasteners and full load path'] },
      { key: 'fronts', kind: 'quote', lines: ['B1 is the 12-in drawer-over-door base immediately beside the refrigerator. B2/B3 are larger white drawer bases.'] },
      {
        key: 'steps',
        kind: 'quote',
        lines: [
          '01. Dry-fit all three base boxes on their supported floor locations: B1, F1, B2, F2, B3, starting at the fridge separator. Check total 106½-in box width plus two ¾-in fillers and the actual toe-kick/counter/side scribe.',
          '03. Set the butcher-block counter at the intended 36-in top elevation only after base heights and top thickness are measured. Confirm the planned 26-in clear distance to U1/U2 bottoms at 62 in.',
          '04. Mount U1/U2 36×34 and U3 over-fridge 36×24 using their actual rails/holes into approved W1 wood and connectors. Place three 36-in butcher-block shelves on selected visible heavy-duty brackets fixed into full studs.',
          '05. Set the GE GSE25GYPHCFS in its 37-in clear bay with manufacturer-required clearances. Test door swing, bin removal, walking access and service removal before final panel or filler fastening.',
        ],
      },
      { key: 'load-path', kind: 'quote', lines: ['Upper cabinet and shelf loads cannot be certified by a backing diagram alone. The block-to-stud joint, W1 top/base/end restraints and cabinet/shelf screw instructions must form one accepted load path.'] },
    ],
  },
  {
    id: 'p28-gates',
    file: 'r35-p28-gates.svg',
    title: 'Release and as-built checklist (printed page 28)',
    page: 28,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'status', kind: 'quote', lines: ['SURVEY/PRACTICE READY · house cuts, drilling and loaded fixtures held'] },
      {
        key: 'gates',
        kind: 'quote',
        lines: [
          'G1 layout: W1/W2 measured finished endpoints at 3 heights; physical truss center and approved line',
          'G2 floor: Tile/mortar/slab layers, hole clearance, tested anchor/support and repair approach',
          'G3 frame: W1 and W2 member lengths, screw/connector patterns, top movement, end/corner/temporary restraint',
          'G4 EX1: Wall role/services, approved opening/header/jamb/exposure and retained kitchen door',
          'G5 fixtures: B1/B2/B3 actual widths, cabinet rail templates, shelf brackets/loads, GE operation',
          'G6 close-up: Inspection and photographs of studs, 25 blocks, fasteners, services and board edge supports',
          'G7 finish: Drywall product/face map, trim exposed lengths, cabinet/fridge and door function',
        ],
      },
      {
        key: 'process',
        kind: 'quote',
        lines: [
          '01. Give every concealed photograph an ID and scale. Update the block/stud/service map with actual x and height coordinates.',
          '03. Review the updated measured packet before house cuts, drilling, EX1 alteration or drywall close-up; record as-built changes after installation.',
        ],
      },
      { key: 'limits', kind: 'quote', lines: ['This R35 PDF is the current complete sequence and design record, but it is not a permit, structural approval, or release of held construction details. The named gates identify exactly what still controls those steps.'] },
    ],
  },
  {
    id: 'p29-source-record',
    file: 'r35-p29-source-record.svg',
    title: 'Drawing and source record (printed page 29)',
    page: 29,
    relationship: 'current',
    kind: 'pdf_page',
    blocks: [
      { key: 'status', kind: 'quote', lines: ['R35 PDF: concept and numbered sequence · final construction review held'] },
      {
        key: 'sources',
        kind: 'quote',
        lines: [
          'Approved original house drawing set (identity withheld) — sheets A3/A5/A7/D4/D5 — floor/roof alignment, under-slab routing indicators and original framing details; not an as-built retrofit design.',
          'NIST PS 20-25 (2025) — nominal-to-actual dry 2×6 and 2×8 dimensions; not a connector capacity.',
          'GE GSE25GYP family catalog — refrigerator dimensions and freezer-bin clearance starting point; verify the actual project label and room fit.',
          'National Gypsum High Strength LITE / USG J371 — board-specific and general gypsum handling/finishing; choose the actual installed product.',
          'CGC/USG Construction Handbook ch. 12, p. 350 — correct crooked framing before gypsum; shim recessed panel-bearing faces flush.',
          'Dade City Building Department — confirm the alteration permit and inspection path.',
        ],
      },
      {
        key: 'cart',
        kind: 'quote',
        lines: ['Cart status: the R34 cart still includes a framing nailer and nail strips. Those are no longer required by R35. This revision does not mutate the live cart; exact new connector quantities await the accepted connection schedule.'],
      },
      {
        key: 'review',
        kind: 'quote',
        lines: ['R35 changes assembly to in-place screws/metal connectors. Its separate review covers the revised conditional packet, not engineering approval.'],
      },
    ],
  },
  {
    id: 'esr-3096',
    file: 'r35-esr-3096-excerpt.svg',
    title: 'ICC-ES ESR-3096 (January 2026) — Table 5 / Figure 5 excerpt, printed page 8 of 25',
    page: 8,
    relationship: 'reference',
    kind: 'code_section',
    blocks: [
      { key: 'table', kind: 'quote', lines: ['TABLE 5 — A34 AND 35 FRAMING CONNECTORS: A34 — 4-SD9112 fasteners into each connected member, F1 and F2 load directions (directional connector-table values only; see the report for the tabulated loads).'] },
      { key: 'note4', kind: 'quote', lines: ['4. The tabulated F1 and F2 allowable loads are for a single connector. The terminating member must be constrained against rotation for the F1 load direction when the angle connectors are not used in pairs.'] },
      { key: 'note5', kind: 'quote', lines: ['5. When angles are installed on each side of wood member, the minimum member thickness must be 3 inches.'] },
      { key: 'note6', kind: 'quote', lines: ['6. The F2 load direction is that which results in the terminating member bearing on the flange of the connector. Connectors are required on both sides of the terminating member to resist allowable F2 loads in both directions.'] },
      { key: 'fig5', kind: 'quote', lines: ['FIGURE 5 — A ANGLES: A34 and A35 connector shapes; candidate A34 2½-in bend and 1 7/16-in legs for review only.'] },
      { key: 'note', kind: 'note', lines: ['These are directional connector-table values, not loaded-cabinet capacities. Installed project quantity, orientation, rotation restraint and the complete load path remain held.'] },
    ],
  },
];

/** Render a card, returning the SVG text plus a region index per block. */
export function renderCard(card) {
  const lines = [];
  let y = 118;
  const regions = {};
  const pushText = (x, top, size, fill, weight, text) => {
    const attrs = [`x="${x}"`, `y="${top}"`, `font-family="Arial,Helvetica,sans-serif"`, `font-size="${size}"`, `fill="${fill}"`];
    if (weight) attrs.push(`font-weight="${weight}"`);
    lines.push(`  <text ${attrs.join(' ')}>${svgEscape(text)}</text>`);
  };

  pushText(MARGIN_X, 46, 19, '#1d3733', 'bold', 'Pantry R35 — sanitized source excerpt');
  pushText(MARGIN_X, 72, 14, '#33524b', null, card.title);
  pushText(MARGIN_X, 94, 12, '#5b6f6a', null, 'Text-only card: no address, parcel or permit identity and no raw source links. Quotations keep the printed wording.');

  for (const block of card.blocks) {
    const top = y;
    const label = block.kind === 'quote' ? `printed page ${card.page}${block.noteLabel ? ` — ${block.noteLabel}` : ''}` : 'conversion note';
    pushText(MARGIN_X, y, 11, '#7b8c87', null, label);
    let inner = y + LABEL_LINE_HEIGHT - 4;
    for (const line of block.lines) {
      for (const wrapped of wrapText(line, 104)) {
        pushText(MARGIN_X + 10, inner, 13.5, '#243b37', null, wrapped);
        inner += QUOTE_LINE_HEIGHT;
      }
    }
    const height = inner - top - QUOTE_LINE_HEIGHT + 14;
    y = top + height + 14;
    regions[block.key] = { x: MARGIN_X - 6, y: top - 14, width: TEXT_WIDTH + 12, height };
  }

  const footerY = y + 16;
  const height = Math.ceil(footerY + 30);
  pushText(MARGIN_X, footerY, 11, '#7b8c87', null, `Source family: ${card.file} · printed page ${card.page} of the R35 conditional plan (29 pages).`);

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${height}" viewBox="0 0 ${CARD_WIDTH} ${height}" role="img" aria-label="${svgEscape(card.title)}">`,
    `  <rect x="8" y="8" width="${CARD_WIDTH - 16}" height="${height - 16}" rx="6" fill="#fbfaf6" stroke="#46625b" stroke-width="1.5"/>`,
    ...lines,
    '</svg>',
    '',
  ].join('\n');
  return { svg, regions, height };
}

/** Card lookup: id -> rendered card plus regions. */
export function buildCardSet() {
  const byId = new Map();
  for (const card of CARDS) {
    byId.set(card.id, { card, rendered: renderCard(card) });
  }
  return byId;
}
