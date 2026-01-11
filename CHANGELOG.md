# Changelog

All notable changes to this project will be documented in this file.

## [3.1.0] - 2026-01-11 (Stable)
Type: Stable release

Summary:
- Implements upstream-only dropdown filtering and selection pruning across Product Area → Release → UI5 Version → Similarity → Test Plan.
- Ensures filters remain enabled/expandable at all times and users are never trapped by invalid selections.
- Fixes release parsing to include 25xx and 26xx tokens; broadens UI5 Version parsing.
- Verified with FLP sandbox; charts and table update instantly without page reloads.

Acceptance criteria mapping:
- Product Area (PA) always lists all areas:
  - PA options are recomputed from the full dataset (msimilaritypercent), never constrained by downstream filters.
- Union logic:
  - Multiple PA selections: Release and UI5 Version show union of values that exist in ANY selected PA.
- Dependency chain respected:
  - Release depends on selected PA(s).
  - UI5 Version depends on selected PA(s) + selected Release(s).
  - Similarity and Test Plan reflect all currently selected higher-level filters dynamically.
- Removal logic:
  - Removing a selection updates downstream filters immediately and auto-prunes invalid selections; results refresh instantly.
- Non-regression rules:
  - Dropdowns remain enabled and never collapse permanently.
  - No downstream-to-upstream restriction.
  - No hardcoded values and no free-text submission.

Technical changes:
- webapp/controller/View1.controller.js
  - parseReleaseFromName(name):
    - Detects releases of the form 25xx and 26xx via tokenized scan and word-boundary fallback.
  - parseUI5VersionFromName(name):
    - Accepts tokens like 1141X/114x and 1.141 → normalized to 1141X.
  - getTestType(name):
    - Prefers known tokens (E2E, UNIT, QA, SMOKE, REGRESSION, UAT, PERF, INTEGRATION).
    - Fallback uses token immediately before the 25xx/26xx token.
  - _refreshDropdownOptions():
    - Recomputes options using full original dataset (model "msimilaritypercent") only in the upstream direction.
    - Option lists:
      - mProdArea = Full set (unrestricted).
      - mRelease = Union derived from selected PA(s).
      - mUI5Version = Union derived from selected PA(s) + Release(s).
      - mTestPlan = Derived from upstream filters + Similarity.
      - mTesScp (Test Type) = Global list (minimal impact).
    - Similarity buckets derived from percentSuccess into [<96%, 96%-98%, 98%-99%, 100%].
    - _intersectSelectedKeys() prunes Release/UI5 Version/Test Plan/TestScope/Similarity selections against availability to prevent trapping.
  - onFBGoPress():
    - Consolidates AND-across-controls and OR-within-control filter composition using sap.ui.model.Filter.
    - Keeps chart/table in sync with filtered results.
  - _updateChartWithFilteredData(), _resetChartToOriginalData(), _applyChartConfig():
    - Ensure chart reflects filtered or full data consistently; updates viz properties; supports pie/donut/column/bar/line/stacked.

- webapp/view/View1.view.xml
  - FilterBar order: Search → Product Area → Release → UI5 Version → Similarity → Test Plan.
  - MultiComboBox controls wired via selectionFinish to onFBGoPress + _refreshDropdownOptions to keep recompute incremental and responsive.

- Versioning:
  - package.json: 3.0.0 → 3.1.0
  - webapp/manifest.json (sap.app.applicationVersion.version): 3.0.0 → 3.1.0

Validation performed (FLP Sandbox):
- Verified PA remains fully expandable and always contains all areas after any selection.
- With multiple PA selected (e.g., SALES + IDEA), Release shows union across both.
- With Release=2602 set, UI5 Version lists only versions that exist under 2602 within chosen PA(s).
- Removing PA/Release/UI5 Version/Similarity/Test Plan selections prunes downstream invalid selections immediately and updates results (no reloads).
- Chart/Table counts update in sync with filter changes.

Known limitations / Breaking changes:
- None. Changes are internal to filtering logic and parsing helpers; no external API or routing changes.

## [3.0.0] - 2025-xx-xx
- Previous baseline (pre-stability refactor for dropdown filtering).
