sap.ui.define([], function () {
  "use strict";

  function normNumber(n, fallback) {
    var v = Number(n);
    return Number.isFinite(v) ? v : fallback;
  }

  function clone(o) {
    return o && typeof o === "object" ? Object.assign({}, o) : o;
  }

  function isRichRow(row) {
    return !!(row && (row.Sim100 !== undefined || row.TestPlanType !== undefined));
  }

  function adaptRow(row, totalTests) {
    // Already rich -> return as-is
    if (isRichRow(row)) {
      return row;
    }

    var r = clone(row) || {};
    var simPct = normNumber(r.SimilarityPercent, 95);
    // Ensure SimilarityPercent is populated for filtering logic
    r.SimilarityPercent = simPct;

    // Measures from similarity; deterministic, non-negative
    var sim100 = Math.max(0, Math.round(totalTests * (simPct / 100)));
    var remainder = Math.max(0, totalTests - sim100);
    var sim99 = Math.max(0, Math.round(remainder * 0.5));
    var simLess = Math.max(0, totalTests - sim100 - sim99);

    r.Sim100 = sim100;
    r.Sim99 = sim99;
    r.SimLess = simLess;

    if (r.TestPlanType === undefined || r.TestPlanType === null) {
      var tt = (r.TestType && String(r.TestType).trim()) || "Unknown";
      var first = tt.split(/\s+/)[0] || "Unknown";
      r.TestPlanType = first + "-auto";
    }

    if (!("Date" in r)) r.Date = null;
    if (!("Release" in r)) r.Release = "";

    return r;
  }

  function adaptRows(aFull, options) {
    var opts = options || {};
    var totalTests = Number.isFinite(opts.totalTests) ? opts.totalTests : 100;

    if (!Array.isArray(aFull)) return [];

    // If any row is already rich, assume whole dataset is rich and return as-is (idempotent safeguard)
    if (aFull.some(isRichRow)) {
      return aFull;
    }
    return aFull.map(function (row) { return adaptRow(row, totalTests); });
  }

  return {
    adaptRows: adaptRows
  };
});
