# VIC Dashboard (SAPUI5) – Mock-first, OData-ready

Overview
- Freestyle SAPUI5 dashboard using sap.viz charts, FilterBar, and a table.
- Runs locally with mock JSON data and is pre-wired to consume an OData V2 service when available.
- Target backend: ABAP CDS consumption view exposed as OData V2 (e.g., ZVIC_SRV), annotation-driven for future Fiori Elements migration if desired.

What was wrong and what changed
- Problem: App was bound to a JSON model in manifest, so Smart-like patterns didn’t show real data and no OData was called.
- Fix:
  - Added an OData V2 data source mainService in manifest pointing to /sap/opu/odata/sap/ZVIC_SRV/.
  - Kept mock JSON data as a named model "mock".
  - Updated bindings in the view to explicitly use the "mock" model, so the app runs with stable mock data now.
  - Introduced a "state" view model to hold UI state (e.g., headerExpanded).
  - Controller updated to read from the named "mock" model and to keep a full copy of ChartData for filtering.

Current runtime behavior
- Default unnamed model: OData V2 model configured at "" (not actively used yet in the view).
- Named "mock" model: used by Select, charts, and table for predictable local dev.
- Filtering:
  - Select a Test Type, then the Test Plan dropdown becomes enabled and filtered.
  - Press Go to filter the underlying ChartData; Pie chart recalculates totals.

How to run locally (UI5 Tooling)
1) Requirements:
   - Node.js LTS (16+ recommended)
   - npm i (first time)

2) Commands:
   - npm start
     - Runs ui5 serve -o index.html on a local port (default 8080) and opens the app.

3) UI5 runtime:
   - ui5.yaml uses SAPUI5 1.120.13 and includes library dependencies sap.m, sap.f, sap.ui.comp, sap.viz, etc.

Switching from mock to real OData
Option A: Keep freestyle UI, fetch OData into the view model
- Keep the view bound to the "mock" model but load real data into it from the OData model at runtime.
- Sample controller snippet (pseudo-code) to map OData entity set into ChartData structure:

/* In Dashboard.controller.js, after this.getView().setModel(oMockDataModel, "mock") */
var oODataModel = this.getOwnerComponent().getModel(); // the default OData V2 model ("")
/*
oODataModel.read("/ZI_VIC_UnconfirmedDemandSet", {
  urlParameters: {
    "$select": "WeekOfOrder,ConfirmedDemand,DelayedDemand,UnconfirmedDemand,SDDocumentCategory,Currency,ExchangeRateType",
    "$top": "200"
  },
  success: function(oData) {
    // Map oData.results to ChartData schema [{ ProductArea, Sim100, Sim99, SimLess }, ...]
    // Replace this mapping with logic appropriate for your KPI semantics:
    var aChartData = transformToChartData(oData.results);
    var oMock = this.getView().getModel("mock");
    oMock.setProperty("/ChartData", aChartData);
    oMock.setProperty("/ChartDataFull", aChartData.slice(0));
    this._updatePieChartData(aChartData);
  }.bind(this),
  error: function(e) {
    sap.m.MessageToast.show("OData read failed; using mock data.");
    // App continues using mock data loaded initially
  }
});
*/

- Implement transformToChartData(results) to convert your CDS result rows to what the chart/table expects.

Option B: Move to Fiori Elements Analytical List Page (recommended)
- Create an ALP app pointed to the same OData V2 service.
- Let CDS UI annotations drive SmartFilterBar, SmartChart, and SmartTable automatically.
- Minimal frontend coding; provides native analytical features and export.

Backend: ABAP CDS Consumption View (example)
- Create a CDS analytical cube with measures and dimensions, publish as OData.
- Note: Replace table/field names with your real sources.

@AbapCatalog.sqlViewName: 'ZVIC_UNCVD'
@EndUserText.label: 'VIC - Unconfirmed Demand'
@AccessControl.authorizationCheck: #NOT_REQUIRED
@Analytics.dataCategory: #CUBE
@OData.publish: true
define view ZI_VIC_UnconfirmedDemand
  as select from zsales_orders as so
{
  key so.week_of_order           as WeekOfOrder,
      sum( so.confirmed_amount ) as ConfirmedDemand,
      sum( so.delayed_amount )   as DelayedDemand,
      sum( so.unconfirmed_amount ) as UnconfirmedDemand,
      so.currency                as Currency,
      so.exchange_rate_type      as ExchangeRateType,
      so.sd_document_category    as SDDocumentCategory
}
group by so.week_of_order,
         so.currency,
         so.exchange_rate_type,
         so.sd_document_category

Sample UI/Analytics annotations
- Add to the same CDS or a separate metadata extension. Minimal example:

@UI.selectionField: [{ position: 10 }]
ExchangeRateType;

@UI.selectionField: [{ position: 20 }]
SDDocumentCategory;

@UI.chart: [{
  qualifier: 'UnconfirmedChart',
  chartType: #BAR,
  dimensions: [{ value: 'WeekOfOrder' }],
  measures: [
    { value: 'ConfirmedDemand' },
    { value: 'DelayedDemand' },
    { value: 'UnconfirmedDemand' }
  ]
}]

OData service activation
- If using @OData.publish: true, activate the generated service (IWBEP) and register in Gateway.
- Otherwise, create Service Definition/Binding via ADT and bind as OData V2.
- Register in /IWFND/MAINT_SERVICE (e.g., service name ZVIC_SRV).
- Validate metadata at: https://<host>:<port>/sap/opu/odata/sap/ZVIC_SRV/$metadata

Manifest highlights (already updated)
- Data sources:

  "dataSources": {
    "mainService": {
      "uri": "/sap/opu/odata/sap/ZVIC_SRV/",
      "type": "OData",
      "settings": { "odataVersion": "2.0" }
    },
    "mockData": {
      "uri": "model/mockData.json",
      "type": "JSON"
    }
  }

- Models:

  "models": {
    "": {
      "dataSource": "mainService",
      "type": "sap.ui.model.odata.v2.ODataModel",
      "settings": { "defaultBindingMode": "OneWay" }
    },
    "mock": {
      "dataSource": "mockData",
      "type": "sap.ui.model.json.JSONModel",
      "preload": true
    }
  }

Local proxy to backend (optional)
- If you want to call a remote SAP system from local ui5 serve, add a proxy middleware (e.g., ui5-middleware-simpleproxy).
- Example ui5.yaml snippet (requires installing plugin and configuring):

server:
  customMiddleware:
    - name: ui5-middleware-simpleproxy
      afterMiddleware: compression
      mountPath: /sap
      configuration:
        baseUri: "https://your-backend-host:port/sap"
        strictSSL: false

- Then the manifest uri "/sap/opu/odata/sap/ZVIC_SRV/" works locally via the proxy.

Debugging checklist
- Network:
  - Check calls to /sap/opu/odata/sap/ZVIC_SRV/$metadata and data entity sets.
  - Ensure no *.json mock path is used when expecting OData.
- Metadata:
  - Confirm entity set names used in ALP/manifest match what $metadata exposes.
- Annotations:
  - Verify UI.* annotation terms are present in $metadata or in separate annotation file.
- Console:
  - Look for binding errors or 403/404 (auth/service not found).
- Mock vs. OData:
  - For now, the app binds UI to "mock". To switch, either feed the "mock" model from OData (Option A) or rebind the view to the default model.

Security & Launchpad deployment
- Create Fiori Catalog and Tile; configure target mapping to the app.
- Create PFCG role with the catalog and required backend auth objects; assign to users.
- Transport UI5 app and roles via CTS.
- Align UI5 runtime with platform-provided version (your ui5.yaml uses 1.120.13 which is fine for S/4HANA 2022+; adjust to your landscape).

Performance tips
- Aggregate on the server in CDS (sum, group by) to avoid transferring large row-level data.
- Use $top/$skip for paging on list endpoints.
- Use currency semantics in CDS so measures format properly.

Roadmap (next steps)
- Backend:
  - Implement real CDS view and annotations.
  - Publish service ZVIC_SRV and verify $metadata.
- Frontend:
  - Implement OData read mapping into ChartData (Option A) or create a Fiori Elements ALP (Option B).
  - Add error handling and busy indicators around OData calls.
- CI/CD:
  - Add UI5 tooling build to CI and OPA5/jest tests for basic flows.
  - Use gCTS/Git and code owners to protect main branches.

Appendix: Simple transform mapper (example)
- Replace this logic with the true KPI mapping you need.

/*
function transformToChartData(aODataRows) {
  // Example: group by SDDocumentCategory as ProductArea, and map measures
  var byArea = {};
  aODataRows.forEach(function(r) {
    var area = r.SDDocumentCategory || "N/A";
    if (!byArea[area]) {
      byArea[area] = { ProductArea: area, Sim100: 0, Sim99: 0, SimLess: 0 };
    }
    // Map your CDS measures to the chart KPIs accordingly:
    byArea[area].Sim100 += r.ConfirmedDemand || 0;
    byArea[area].Sim99  += r.DelayedDemand   || 0;
    byArea[area].SimLess+= r.UnconfirmedDemand || 0;
  });
  return Object.keys(byArea).map(function(k){ return byArea[k]; });
}
*/
