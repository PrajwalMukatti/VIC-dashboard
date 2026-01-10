sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "./BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/ui/core/routing/History",
    "sap/m/BusyDialog",
    "sap/ui/model/json/JSONModel",
    'sap/m/Token',
    "vicstartintegration/util/formatter",
    "vicstartintegration/util/LogTblPersoService",
    'sap/m/TablePersoController',
    'sap/m/library',
    "sap/viz/ui5/controls/VizFrame",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/controls/common/feeds/FeedItem",
    'sap/ui/export/library',
    'sap/ui/export/Spreadsheet',
    'sap/m/MessageItem',
    'sap/m/MessageView',
    'sap/m/Popover'
],
    function (Controller, BaseController, Filter, FilterOperator, MessageBox, History, BusyDialog, JSONModel, Token,
        formatter, LogTblPersoService, TablePersoController, mlibrary, VizFrame, FlattenedDataset, FeedItem, exportLibrary, Spreadsheet, MessageItem,
        MessageView, Popover) {
        "use strict";

        var ResetAllMode = mlibrary.ResetAllMode;
        var EdmType = exportLibrary.EdmType;
        var ExeDate1 = null;
        var ExeDate2 = null;
        var testPlan1Map = new Map();
        var testPlan2Map = new Map();

        return Controller.extend("vicstartintegration.controller.View1", {
            formatter: formatter,
            oCompareView: null,
            onInit: function () {
                var that = this;
                this.testPlan1Map;
                this.testPlan2Map;

                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                oRouter.getRoute("Route1").attachPatternMatched(this.onRouteMatched, this);

                this._oTPC = new TablePersoController({
                    table: this.byId("idTblTestPlan"),
                    componentName: "vicstartintegration",
                    persoService: LogTblPersoService
                }).activate();

                var oStateModel = new JSONModel({
                    headerExpanded: true,
                    chartType: "line",
                    chartMode: "trend",
                    chartNavEnabled: true,
                    chartLabels: true,
                    legend: true
                });
                try { oStateModel.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay); oStateModel.setSizeLimit(10000); } catch (eBM1) {}
                this.getView().setModel(oStateModel, "state");

                var oViewModel = new JSONModel({ view: "chart" });
                try { oViewModel.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay); oViewModel.setSizeLimit(10000); } catch (eBM2) {}
                this.getView().setModel(oViewModel, "view");

                // Seed removed: use real data (GitHub/local JSON). FilterBar items populate after data loads.

                // Ensure chart dataset/feeds are applied after initial render (even if local/mock fallback is used)
                this.getView().attachAfterRendering(function () {
                    try {
                        var sType = that.getView().getModel("state").getProperty("/chartType") || "column";
                        that._applyChartConfig(sType);
                        var oViz = that.byId("mainViz");
                        var oPopOver = that.byId("idPopOver");
                        if (oPopOver && oViz) { oPopOver.connect(oViz.getVizUid()); }

                        // Lock to Trend (Timeline) + Line from the first render
                        var oModeSel = that.byId("chartModeSelect");
                        var oTypeSel = that.byId("chartTypeSelect");
                        var sMode = that.getView().getModel("state").getProperty("/chartMode") || "similarity";
                        var sTypeKey = that.getView().getModel("state").getProperty("/chartType") || "column";
                        if (oModeSel) { oModeSel.setSelectedKey(sMode); oModeSel.setEnabled(true); }
                        if (oTypeSel) { oTypeSel.setSelectedKey(sTypeKey); oTypeSel.setEnabled(sMode === "trend" ? false : true); }
                        // Ensure FilterBar's MultiComboBoxes are bound/populated after first render
                        try { that._ensureFilterItemsPopulated(); } catch (e0) {}
                        setTimeout(function () {
                            try { that._ensureFilterItemsPopulated(); } catch (e1) {}
                        }, 200);
                    } catch (e) { /* no-op */ }
                });

                // First populate UI from local JSON (for instant data), then refresh from GitHub
                try { that._initLocalFallback(); } catch (e) {}
                try { that._loadExternalData(); } catch (e) { try { that._initLocalFallback(); } catch (err) {} }


                $.ajax({
                    url: "https://raw.githubusercontent.com/PrajwalMukatti/VIC-dashboard/main/real-data-space/vic_new_dashboard/vicstartintegration/webapp/localService/testplans.json?t=" + Date.now(),
                    type: 'GET',
                    async: true,
                    dataType: "json",
                    error: function () { try { that._initLocalFallback(); } catch (e) {} },
                    success: function (res) {

                        var testPlan2Map = new Map();
                        res.forEach(function (item) {
                            var testPlanName = item.testPlanName;
                            item.TestType = that.getTestType(testPlanName);
                            item.ProductArea = that.getProductArea(testPlanName);
                            item.Release = that.getRelease(testPlanName);
                            item.UiVersion = that.getUiVersion(testPlanName);
                            testPlan2Map.set(testPlanName, item);
                        });

                        that._allRows = res.slice();
                        res = that._markBestEntries(res);
                        var msimilaritypercent = new JSONModel(res);
                        that.getView().setModel(msimilaritypercent, "msimilaritypercent");
                        that.byId("idTblTitle").setText("Test Plans (" + res.length + ")");

                        var aTestPlan = [], aProdArea = [], aTesScp = [];
                        var aTempTestPlan = [], aTempProdArea = [], aTempTesScp = [];

                        res.forEach(function (r) {
                            if (aTempTestPlan.indexOf(r.testPlanName) === -1) {
                                aTempTestPlan.push(r.testPlanName); aTestPlan.push(r);
                            }
                            if (r.ProductArea && aTempProdArea.indexOf(r.ProductArea) === -1) {
                                aTempProdArea.push(r.ProductArea); aProdArea.push(r);
                            }
                            if (aTempTesScp.indexOf(r.TestType) === -1) {
                                aTempTesScp.push(r.TestType); aTesScp.push(r);
                            }
                        });

                        that.getView().setModel(new JSONModel(aTestPlan), "mTestPlan");
                        that.getView().setModel(new JSONModel(aProdArea), "mProdArea");
                        that.getView().setModel(new JSONModel(aTesScp), "mTesScp");

                        var chartAgg = that._buildAggregatedChartData(res);
                        var oChartModel = new JSONModel({ ChartData: chartAgg });
                        that.getView().setModel(oChartModel, "mock");

                        that._updatePieChartData(res);

                        that._applyChartConfig(oStateModel.getProperty("/chartType") || "column");

                        // Build 'mock' model lists and selections to mirror old dropdown style
                        try {
                            // 1) ChartDataFull from API result (per plan rows)
                            var aFull = (res || []).map(function (r) {
                                return {
                                    TestType: r.TestType || "",
                                    ProductArea: r.ProductArea || "",
                                    TestPlan: r.testPlanName || "",
                                    UiVersion: r.UiVersion || that.getUiVersion(r.testPlanName) || "",
                                    Release: r.Release || that.getRelease(r.testPlanName) || "",
                                    SimilarityPercent: Number(r.percentSuccess || 0) || 0,
                                    Sim100: 0, Sim99: 0, SimLess: 0 // optional metrics not used here
                                };
                            });

                            // 2) Aggregated ChartData by ProductArea
                            var mAgg = {};
                            aFull.forEach(function (r) {
                                var pa = (r.ProductArea || "").trim();
                                if (!pa) return;
                                if (!mAgg[pa]) mAgg[pa] = { ProductArea: pa, Sim100: 0, Sim99: 0, SimLess: 0 };
                                // Optional aggregation placeholders; keep 0s
                            });
                            var aAgg = Object.keys(mAgg).sort().map(function (k) { return mAgg[k]; });

                            // 3) Initialize mock model with lists and selections
                            var oMock = new JSONModel({
                                ChartDataFull: aFull.slice(0),
                                ChartData: that._buildAggregatedChartData(res),
                                FilteredFull: aFull.slice(0),
                                FilteredFullBase: aFull.slice(0),
                                Selections: { TestType: [], ProductArea: [], TestPlan: [], UiVersion: [], Release: [], Similarity: [], DateFrom: null, DateTo: null },
                                TestTypes: [],
                                ProductAreas: [],
                                TestPlans: [],
                                PieChartData: []
                            });
                            try { oMock.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay); oMock.setSizeLimit(10000); } catch (eBM4) {}
                            that.getView().setModel(oMock, "mock");
                            try { sap.ui.getCore().setModel(oMock, "mock"); } catch (eCore) {}
                            // Build initial lists with "Select All"
                            that._rebuildSelectorLists();
                            // Initialize pie chart on full dataset
                            that._updatePieChartData(aFull);
                            // Re-apply chart config now that the full 'mock' model is set
                            that._applyChartConfig(that.getView().getModel("state").getProperty("/chartType") || "column");
                            // Auto-apply default filters (e.g., latest Product Release) to update table/chart
                            try { that.onFBGoPress(); } catch (e) {}
                        } catch (e) {
                            if (console && console.warn) console.warn("Failed to init mock lists:", e);
                        }

                        that.getView().attachAfterRendering(function () {
                            var oViz = that.byId("mainViz");
                            var oPopOver = that.byId("idPopOver");

                            if (oPopOver && oViz) {
                                oPopOver.connect(oViz.getVizUid());
                            }

                            // if (oViz) {
                            //     oViz.attachSelectData(this.onTestPlanPress, this);
                            // }

                            if (oViz) {
                                oViz.attachSelectData(function (oEvent) {
                                    var aData = oEvent.getParameter("data");
                                    if (!aData || !aData.length) return;

                                    var raw = aData[0].data || aData[0];
                                    var sCategory = raw.Status || raw["Similarity %"] || raw.Bucket;
                                    var sProductArea = raw["Product Area"] || raw.ProductArea;

                                    var aFilters = [];
                                    if (sCategory === "<96%") {
                                        aFilters.push(new sap.ui.model.Filter("percentSuccess", "LT", 96));
                                    } else if (sCategory === "96%-98%") {
                                        aFilters.push(new sap.ui.model.Filter("percentSuccess", "BT", 96, 98));
                                    } else if (sCategory === "98%-99%") {
                                        aFilters.push(new sap.ui.model.Filter("percentSuccess", "BT", 98, 99));
                                    } else if (sCategory === "100%") {
                                        aFilters.push(new sap.ui.model.Filter("percentSuccess", "EQ", 100));
                                    }

                                    if (sProductArea) {
                                        aFilters.push(new sap.ui.model.Filter("ProductArea", "EQ", sProductArea));
                                    }

                                    var oTable = that.byId("idTblTestPlan");
                                    var oBinding = oTable.getBinding("items");
                                    if (oBinding) {
                                        oBinding.filter(aFilters);
                                        that.getView().getModel("view").setProperty("/view", "table");
                                        that.byId("idTblTitle").setText("Test Plans (" + oBinding.getLength() + ")");
                                        try {
                                            var sAreaRaw = (sProductArea && String(sProductArea).trim()) ? String(sProductArea).trim() : "Selected";
                                            var sArea = sAreaRaw.split(/\s+/).map(function(w){ return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }).join(" ");
                                            sap.m.MessageToast.show(sArea + " Area Tabular view navigation successful for selected criteria");
                                        } catch (e) { /* no-op */ }
                                    }
                                });
                            }

                        });
                    }
                });
            },


            onRouteMatched: function () {

                var that = this;
                var aTempTestPlan = [];
                var aTestPlan = [];
                var aTempProdArea = [];
                var aProdArea = [];
                var aTempTesScp = [];
                var aTesScp = [];

                $.ajax({
                    url: "https://raw.githubusercontent.com/PrajwalMukatti/VIC-dashboard/main/real-data-space/vic_new_dashboard/vicstartintegration/webapp/localService/testplans.json?t=" + Date.now(),
                    type: 'GET',
                    async: true,
                    dataType: "json",
                    error: function () { try { that._initLocalFallback(); } catch (e) {} },
                    success: function (res) {

                        var testPlan2Map = new Map();
                        res.forEach(function (item) {

                            var testPlanName = item.testPlanName;

                            var testType = that.getTestType(testPlanName);
                            item.TestType = testType;

                            var productArea = that.getProductArea(testPlanName);
                            item.ProductArea = productArea;

                            item.Release = that.getRelease(testPlanName);
                            item.UiVersion = that.getUiVersion(testPlanName);

                            testPlan2Map.set(testPlanName, item);
                        });
                        console.log(testPlan2Map);
                        var msimilaritypercent = new JSONModel();
                        msimilaritypercent.success;
                        res = that._markBestEntries(res);
                        msimilaritypercent.setData(res);
                        that.getView().byId("idTblTitle").setText("Test Plans (" + res.length + ")");

                        that.getView().setModel(msimilaritypercent, "msimilaritypercent");
                        console.log(msimilaritypercent);

                        for (var i = 0; i < res.length; i++) {
                            if (aTempTestPlan.indexOf(res[i].testPlanName) === -1) {
                                aTempTestPlan.push(res[i].testPlanName);
                                aTestPlan.push(res[i]);

                            }
                            if (res[i].ProductArea && res[i].ProductArea !== "" && aTempProdArea.indexOf(res[i].ProductArea) === -1) {
                                aTempProdArea.push(res[i].ProductArea);
                                aProdArea.push(res[i]);
                            }
                            if (aTempTesScp.indexOf(res[i].TestType) === -1) {
                                aTempTesScp.push(res[i].TestType);
                                aTesScp.push(res[i]);
                            }
                        }
                        var mTestPlan = new JSONModel(aTestPlan);
                        that.getView().setModel(mTestPlan, "mTestPlan");

                        var mProdArea = new JSONModel(aProdArea);
                        that.getView().setModel(mProdArea, "mProdArea");

                        var mTesScp = new JSONModel(aTesScp);
                        that.getView().setModel(mTesScp, "mTesScp");
                    }
                });

            },

            onChartTypeChange: function (oEvent) {
                var sKey = (oEvent.getParameter("selectedItem") && oEvent.getParameter("selectedItem").getKey()) || oEvent.getSource().getSelectedKey();
                this.getView().getModel("state").setProperty("/chartType", sKey);
                this._applyChartConfig(sKey);
            },

            onChartModeChange: function (oEvent) {
                var sKey = (oEvent.getParameter("selectedItem") && oEvent.getParameter("selectedItem").getKey()) || oEvent.getSource().getSelectedKey();
                var oState = this.getView().getModel("state");
                oState.setProperty("/chartMode", sKey || "similarity");

                var oTypeSel = this.byId("chartTypeSelect");
                if (sKey === "trend") {
                    // Only line chart makes sense for trend mode
                    oState.setProperty("/chartType", "line");
                    if (oTypeSel) { oTypeSel.setEnabled(false); }
                    this._applyChartConfig("line");
                } else {
                    if (oTypeSel) { oTypeSel.setEnabled(true); }
                    this._applyChartConfig(oState.getProperty("/chartType") || "column");
                }
            },

            onViewChange: function (oEvent) {
                var sKey = (oEvent.getParameter("item") && oEvent.getParameter("item").getKey())
                    || (oEvent.getParameter("selectedItem") && oEvent.getParameter("selectedItem").getKey());
                if (!sKey) {
                    sKey = oEvent.getSource().getSelectedKey();
                }
                this.getView().getModel("view").setProperty("/view", sKey === "table" ? "table" : "chart");
            },

            // Fallback initializer: populates models with local mock when backend is unavailable
            _initMockFallback: function () {
                var that = this;
                try {
                    var res = [
                        // Release 2602, various UI5 versions
                        { testPlanName: "S4PUC_2602_INF_1130X_UOQX_SD",     ProductArea: "SALES",        TestType: "UI5 DRT", percentSuccess: 97.4, executeOn: "2025-09-20" },
                        { testPlanName: "S4PUC_2602_INF_1130X_UOQX_FIN",    ProductArea: "FIN",          TestType: "UI5 DRT", percentSuccess: 98.6, executeOn: "2025-09-21" },
                        { testPlanName: "S4PUC_2602_INF_1131X_UOQX_MM",     ProductArea: "PROCURE",      TestType: "UI5 DRT", percentSuccess: 95.3, executeOn: "2025-09-19" },
                        { testPlanName: "S4PUC_2602_INF_1X_UOQX_QM",     ProductArea: "PROCURE",      TestType: "UI DRT", percentSuccess: 99.1, executeOn: "2025-09-22" },
                        { testPlanName: "S4PUC_2602_INF_1131X_UOQX_PP",     ProductArea: "PRODUCE",      TestType: "UI5 DRT", percentSuccess: 100,  executeOn: "2025-09-18" },
                        { testPlanName: "S4PUC_2602_INF_1130X_UOQX_HR",     ProductArea: "MASTER DATA",  TestType: "UI5 DRT", percentSuccess: 96.2, executeOn: "2025-09-18" },
                        { testPlanName: "S4PUC_2602_INF_1131X_UOQX_EAM",    ProductArea: "PRODUCE",      TestType: "UI5 DRT", percentSuccess: 98.2, executeOn: "2025-09-17" },
                        { testPlanName: "S4PUC_2602_INF_1131X_UOQX_SERV",   ProductArea: "SERVICES",     TestType: "UI5 DRT", percentSuccess: 97.9, executeOn: "2025-09-16" },

                        // Release 2508, earlier UI5 versions
                        { testPlanName: "S4PUC_2508_INF_1128X_UOQX_SD",     ProductArea: "SALES",        TestType: "UI5 DRT", percentSuccess: 94.2, executeOn: "2025-08-28" },
                        { testPlanName: "S4PUC_2508_INF_1129X_UOQX_FIN",    ProductArea: "FIN",          TestType: "UI5 DRT", percentSuccess: 96.7, executeOn: "2025-08-27" },
                        { testPlanName: "S4PUC_2508_INF_1129X_UOQX_MM",     ProductArea: "PROCURE",      TestType: "UI5 DRT", percentSuccess: 93.8, executeOn: "2025-08-26" },
                        { testPlanName: "S4PUC_2508_INF_1128X_UOQX_QM",     ProductArea: "PROCURE",      TestType: "UI5 DRT", percentSuccess: 97.3, executeOn: "2025-08-25" },
                        { testPlanName: "S4PUC_2508_INF_1129X_UOQX_PP",     ProductArea: "PRODUCE",      TestType: "UI5 DRT", percentSuccess: 98.9, executeOn: "2025-08-24" },
                        { testPlanName: "S4PUC_2508_INF_1128X_UOQX_EAM",    ProductArea: "PRODUCE",      TestType: "UI5 DRT", percentSuccess: 97.6, executeOn: "2025-08-23" },
                        { testPlanName: "S4PUC_250_INF_1129X_UOQX_SERV",   ProductArea: "SERVICES",     TestType: "UI5 DRT", percentSuccess: 95.1, executeOn: "2025-08-22" },
                        { testPlanName: "S4PUC_2508_INF_1128X_UOQX_HR",     ProductArea: "MASTER DATA",  TestType: "UI5 DRT", percentSuccess: 92.7, executeOn: "2025-08-21" }
                    ];

                    // Annotate best rows and table model
                    res = that._markBestEntries(res);
                    var oTblModel = new JSONModel(res);
                    that.getView().setModel(oTblModel, "msimilaritypercent");
                    that.byId("idTblTitle").setText("Test Plans (" + res.length + ")");

                    // Build full per-plan dataset for dropdowns and charts
                    var aFull = res.map(function (r) {
                        return {
                            TestType: r.TestType || "",
                            ProductArea: r.ProductArea || "",
                            TestPlan: r.testPlanName || "",
                            UiVersion: r.UiVersion || that.getUiVersion(r.testPlanName) || "",
                            Release: r.Release || that.getRelease(r.testPlanName) || "",
                            SimilarityPercent: Number(r.percentSuccess || 0) || 0,
                            Sim100: 0, Sim99: 0, SimLess: 0
                        };
                    });

                    // Create/refresh mock model (lists + chart data)
                    var oMock = that.getView().getModel("mock");
                    if (!oMock) { oMock = new JSONModel({}); }
                    oMock.setProperty("/ChartDataFull", aFull.slice(0));
                    oMock.setProperty("/FilteredFull", aFull.slice(0));
                    oMock.setProperty("/FilteredFullBase", aFull.slice(0));
                    oMock.setProperty("/Selections", { TestType: [], ProductArea: [], TestPlan: [], UiVersion: [], Release: [], Similarity: [], DateFrom: null, DateTo: null });

                    // Chart datasets
                    var chartAgg = that._buildAggregatedChartData(res);
                    oMock.setProperty("/ChartData", chartAgg);
                    that._updatePieChartData(res);

                    that.getView().setModel(oMock, "mock");
                    try { sap.ui.getCore().setModel(oMock, "mock"); } catch (eCore) {}
                    // Build selector lists with "Select All"
                    that._rebuildSelectorLists();

                    // Ensure viz config applied
                    try { that.onFBGoPress(); } catch (e) {}
                    var sType = that.getView().getModel("state").getProperty("/chartType") || "column";
                    that._applyChartConfig(sType);
                } catch (e) {
                    if (console && console.error) console.error("Fallback init failed", e);
                }
            },

            _initLocalFallback: function () {
                // Load packaged real dataset (not mock) from same-origin to ensure UI populates instantly
                var that = this;
                try {
                    $.getJSON("localService/testplans.json?t=" + Date.now())
                        .done(function (res) {
                            try { that._handleTestPlanResponse(res); } catch (e) { /* no-op */ }
                        })
                        .fail(function (xhr, status, err) {
                            if (console && console.warn) console.warn("Local dataset load failed:", status || (xhr && xhr.status), err);
                        });
                } catch (e) {
                    if (console && console.warn) console.warn("Local dataset load exception:", e);
                }
            },

            _loadExternalData: function () {
                var that = this;
                var urls = [
                    "https://raw.githubusercontent.com/PrajwalMukatti/VIC-dashboard/main/real-data-space/vic_new_dashboard/vicstartintegration/webapp/localService/testplans.json",
                    "https://raw.githubusercontent.com/PrajwalMukatti/VIC-dashboard/master/real-data-space/vic_new_dashboard/vicstartintegration/webapp/localService/testplans.json"
                ];
                function tryNext(i) {
                    if (i >= urls.length) {
                        try { that._initLocalFallback(); } catch (e) {}
                        return;
                    }
                    $.ajax({
                        url: urls[i] + "?t=" + Date.now(),
                        type: 'GET',
                        dataType: "json",
                        async: true
                    }).done(function (res) {
                        try { that._handleTestPlanResponse(res); } catch (e) {
                            try { that._initLocalFallback(); } catch (err) {}
                        }
                    }).fail(function () {
                        tryNext(i + 1);
                    });
                }
                tryNext(0);
            },

            _handleTestPlanResponse: function (res) {
                var that = this;
                try {
                    var a = Array.isArray(res) ? res.slice(0) : (res && res.results) ? res.results.slice(0) : [];
                    // Annotate rows
                    var testPlan2Map = new Map();
                    a.forEach(function (item) {
                        var testPlanName = item.testPlanName;
                        item.TestType = item.TestType || that.getTestType(testPlanName);
                        item.ProductArea = item.ProductArea || that.getProductArea(testPlanName);
                        item.Release = item.Release || that.getRelease(testPlanName);
                        item.UiVersion = item.UiVersion || that.getUiVersion(testPlanName);
                        testPlan2Map.set(testPlanName, item);
                    });

                    that._allRows = a.slice(0);
                    a = that._markBestEntries(a);

                    // Table model
                    var oTblModel = new JSONModel(a);
                    that.getView().setModel(oTblModel, "msimilaritypercent");
                    that.byId("idTblTitle").setText("Test Plans (" + a.length + ")");

                    // Unique lists
                    var aTestPlan = [], aProdArea = [], aTesScp = [];
                    var aTempTestPlan = [], aTempProdArea = [], aTempTesScp = [];
                    a.forEach(function (r) {
                        if (aTempTestPlan.indexOf(r.testPlanName) === -1) { aTempTestPlan.push(r.testPlanName); aTestPlan.push(r); }
                        if (r.ProductArea && aTempProdArea.indexOf(r.ProductArea) === -1) { aTempProdArea.push(r.ProductArea); aProdArea.push(r); }
                        if (aTempTesScp.indexOf(r.TestType) === -1) { aTempTesScp.push(r.TestType); aTesScp.push(r); }
                    });
                    that.getView().setModel(new JSONModel(aTestPlan), "mTestPlan");
                    that.getView().setModel(new JSONModel(aProdArea), "mProdArea");
                    that.getView().setModel(new JSONModel(aTesScp), "mTesScp");

                    // Chart aggregated + pie
                    var chartAgg = that._buildAggregatedChartData(a);
                    var oChartModel = that.getView().getModel("mock");
                    if (!oChartModel) { oChartModel = new JSONModel({ ChartData: chartAgg }); }
                    else { oChartModel.setProperty("/ChartData", chartAgg); }
                    that.getView().setModel(oChartModel, "mock");
                    try { sap.ui.getCore().setModel(oChartModel, "mock"); } catch (eCore) {}
                    that._updatePieChartData(a);
                    that._applyChartConfig(that.getView().getModel("state").getProperty("/chartType") || "column");

                    // Build ChartDataFull + Selections and lists
                    var aFull = (a || []).map(function (r) {
                        return {
                            TestType: r.TestType || "",
                            ProductArea: r.ProductArea || "",
                            TestPlan: r.testPlanName || "",
                            UiVersion: r.UiVersion || that.getUiVersion(r.testPlanName) || "",
                            Release: r.Release || that.getRelease(r.testPlanName) || "",
                            SimilarityPercent: Number(r.percentSuccess || 0) || 0,
                            Sim100: 0, Sim99: 0, SimLess: 0
                        };
                    });
                    if (!oChartModel) { oChartModel = new JSONModel({}); }
                    oChartModel.setProperty("/ChartDataFull", aFull.slice(0));
                    oChartModel.setProperty("/FilteredFull", aFull.slice(0));
                    oChartModel.setProperty("/FilteredFullBase", aFull.slice(0));
                    if (!oChartModel.getProperty("/Selections")) {
                        oChartModel.setProperty("/Selections", { TestType: [], ProductArea: [], TestPlan: [], UiVersion: [], Release: [], Similarity: [], DateFrom: null, DateTo: null });
                    }
                    that.getView().setModel(oChartModel, "mock");
                    that._rebuildSelectorLists();
                    that._updatePieChartData(aFull);
                    that._applyChartConfig(that.getView().getModel("state").getProperty("/chartType") || "column");
                    try { that.onFBGoPress(); } catch (e) {}
                } catch (e) {
                    try { that._initLocalFallback(); } catch (err) {}
                }
            },

            _transformToChartData: function (aRows) {
                var aResult = [];
                (aRows || []).forEach(function (r) {
                    var val = Number(r.percentSuccess) || 0;
                    var bucket = "";

                    if (val < 96) {
                        bucket = "<96%";
                    } else if (val < 98) {
                        bucket = "96%-98%";
                    } else if (val < 100) {
                        bucket = "98%-99%";
                    } else {
                        bucket = "100%";
                    }

                    aResult.push({
                        ProductArea: r.ProductArea || "N/A",
                        Bucket: bucket,
                        Count: 1,                         
                        testPlanName: r.testPlanName,   
                        percentSuccess: val
                    });
                });
                return aResult;
            },

            // Build aggregated dataset like old app: Sim100 / Sim99 / SimLess by ProductArea
            _buildAggregatedChartData: function (aRows) {
                var map = {};
                (aRows || []).forEach(function (r) {
                    var pa = (r.ProductArea || "N/A").trim();
                    var val = Number(r.percentSuccess) || 0;
                    if (!map[pa]) { map[pa] = { ProductArea: pa, Sim100: 0, Sim99: 0, SimLess: 0 }; }
                    if (val === 100) {
                        map[pa].Sim100 += 1;
                    } else if (val >= 98 && val < 100) {
                        map[pa].Sim99 += 1;
                    } else {
                        map[pa].SimLess += 1;
                    }
                });
                return Object.keys(map).sort().map(function (k) { return map[k]; });
            },

            _updatePieChartData: function (aData) {
                var oMockModel = this.getView().getModel("mock");
                if (!oMockModel) return;

                var oPieChartTotals = {
                    lt96: { count: 0, plans: [] },
                    "96_98": { count: 0, plans: [] },
                    "98_99": { count: 0, plans: [] },
                    "100": { count: 0, plans: [] }
                };

                aData.forEach(function (item) {
                    var val = Number(item.percentSuccess) || 0;
                    if (val < 96) {
                        oPieChartTotals.lt96.count++;
                        oPieChartTotals.lt96.plans.push(item.testPlanName);
                    } else if (val >= 96 && val < 98) {
                        oPieChartTotals["96_98"].count++;
                        oPieChartTotals["96_98"].plans.push(item.testPlanName);
                    } else if (val >= 98 && val < 100) {
                        oPieChartTotals["98_99"].count++;
                        oPieChartTotals["98_99"].plans.push(item.testPlanName);
                    } else if (val === 100) {
                        oPieChartTotals["100"].count++;
                        oPieChartTotals["100"].plans.push(item.testPlanName);
                    }
                });

                var aPieChartData = [
                    { Status: "<96%", Count: oPieChartTotals.lt96.count, Plans: oPieChartTotals.lt96.plans },
                    { Status: "96%-98%", Count: oPieChartTotals["96_98"].count, Plans: oPieChartTotals["96_98"].plans },
                    { Status: "98%-99%", Count: oPieChartTotals["98_99"].count, Plans: oPieChartTotals["98_99"].plans },
                    { Status: "100%", Count: oPieChartTotals["100"].count, Plans: oPieChartTotals["100"].plans }
                ];

                oMockModel.setProperty("/PieChartData", aPieChartData);
            },

            _onChartSelectData: function (oEvent) {
                var data = oEvent.getParameter("data");
                if (!data || !data[0] || !data[0].data) return;

                var oSelected = data[0].data;
                var sBucket = oSelected["Similarity %"];
                var sProductArea = oSelected["Product Area"];

                var oTable = this.byId("idTblTestPlan");
                var oBinding = oTable.getBinding("items");
                var aFilters = [];

                if (sBucket) {
                    if (sBucket === "<96%") {
                        aFilters.push(new sap.ui.model.Filter("percentSuccess", "LT", 96));
                    } else if (sBucket === "96%-98%") {
                        aFilters.push(new sap.ui.model.Filter("percentSuccess", "BT", 96, 97.9999));
                    } else if (sBucket === "98%-99%") {
                        aFilters.push(new sap.ui.model.Filter("percentSuccess", "BT", 98, 99));
                    } else if (sBucket === "100%") {
                        aFilters.push(new sap.ui.model.Filter("percentSuccess", "EQ", 100));
                    }
                }

                if (sProductArea) {
                    aFilters.push(new sap.ui.model.Filter("ProductArea", "EQ", sProductArea));
                }

                if (oBinding) {
                    oBinding.filter(aFilters);
                }
                this.getView().getModel("view").setProperty("/view", "table");
            },

            _applyChartConfig: function (sChartType) {
                var oViz = this.byId("mainViz");
                if (!oViz) return;

                var oChartModel = this.getView().getModel("mock");
                if (!oChartModel) return;

                oViz.removeAllFeeds();
                oViz.setDataset(null);

                var sMode = this.getView().getModel("state").getProperty("/chartMode") || "similarity";
                if (sMode === "trend") {
                    var oTrendDataset = new sap.viz.ui5.data.FlattenedDataset({
                        data: { path: "mock>/TrendData" },
                        dimensions: [
                            { name: "UI5 Version", value: "{UiVersionLabel}" },
                            { name: "Product Area", value: "{ProductArea}" }
                        ],
                        measures: [
                            { name: "Similarity %", value: "{SimilarityPercent}" }
                        ]
                    });
                    oViz.setDataset(oTrendDataset);

                    oViz.addFeed(new sap.viz.ui5.controls.common.feeds.FeedItem({
                        uid: "valueAxis", type: "Measure", values: ["Similarity %"]
                    }));
                    oViz.addFeed(new sap.viz.ui5.controls.common.feeds.FeedItem({
                        uid: "categoryAxis", type: "Dimension", values: ["UI5 Version"]
                    }));
                    oViz.addFeed(new sap.viz.ui5.controls.common.feeds.FeedItem({
                        uid: "color", type: "Dimension", values: ["Product Area"]
                    }));

                    // Force line chart for trend mode and set title
                    oViz.setVizType("line");
                    oViz.setVizProperties({
                        title: { visible: true, text: "Trendline Chart" },
                        plotArea: {
                            dataLabel: { visible: this.getView().getModel("state").getProperty("/chartLabels") === true },
                            marker: { visible: true, size: 5 },
                            showGap: true
                        },
                        legend: { visible: this.getView().getModel("state").getProperty("/legend") === true },
                        valueAxis: { title: { visible: true, text: "Similarity %" } },
                        categoryAxis: { title: { visible: true, text: "UI Version" } },
                        interaction: { zoom: { enablement: "disabled" }, pan: { enablement: "disabled" } }
                    });
                    // Ensure type selector is disabled in Trend; allow switching mode to Similarity
                    var _typeSel = this.byId("chartTypeSelect");
                    if (_typeSel) { _typeSel.setSelectedKey("line"); _typeSel.setEnabled(false); }
                    var _modeSel = this.byId("chartModeSelect");
                    if (_modeSel) { _modeSel.setSelectedKey("trend"); _modeSel.setEnabled(true); }
                    return;
                }

                if (sChartType === "pie" || sChartType === "donut") {

                    // Similarity mode Pie/Donut should show Product Area distribution (Similarity Count)
                    var oPADataset = new sap.viz.ui5.data.FlattenedDataset({
                        data: { path: "mock>/ChartData" },
                        dimensions: [
                            { name: "Product Area", value: "{mock>ProductArea}" }
                        ],
                        measures: [
                            { name: "Similarity Count", value: "{mock>Total}" }
                        ]
                    });
                    oViz.setDataset(oPADataset);

                    oViz.addFeed(new sap.viz.ui5.controls.common.feeds.FeedItem({
                        uid: "size", type: "Measure", values: ["Similarity Count"]
                    }));
                    oViz.addFeed(new sap.viz.ui5.controls.common.feeds.FeedItem({
                        uid: "color", type: "Dimension", values: ["Product Area"]
                    }));

                    oViz.setVizType(sChartType);
                    oViz.setVizProperties({
                        title: { visible: true, text: "similarity chart" },
                        plotArea: { dataLabel: { visible: this.getView().getModel("state").getProperty("/chartLabels") === true }, innerRadius: sChartType === "donut" ? 60 : 0 },
                        legend: { visible: this.getView().getModel("state").getProperty("/legend") === true },
                        valueAxis: { title: { visible: true, text: "Similarity Count" } },
                        categoryAxis: { title: { visible: true, text: "Product Area" } },
                        interaction: { zoom: { enablement: "enabled" }, pan: { enablement: "enabled" } }
                    });

                } else {
                    // Use aggregated series (Sim100/Sim99/SimLess) by Product Area
                    var oDataset = new sap.viz.ui5.data.FlattenedDataset({
                        data: { path: "mock>/ChartData" },
                        dimensions: [
                            { name: "Product Area", value: "{mock>ProductArea}" }
                        ],
                        measures: [
                            { name: "Sim 100", value: "{mock>Sim100}" },
                            { name: "Sim 99",  value: "{mock>Sim99}" },
                            { name: "Sim Less",value: "{mock>SimLess}" }
                        ]
                    });
                    oViz.setDataset(oDataset);

                    oViz.addFeed(new sap.viz.ui5.controls.common.feeds.FeedItem({
                        uid: "valueAxis", type: "Measure", values: ["Sim 100","Sim 99","Sim Less"]
                    }));
                    oViz.addFeed(new sap.viz.ui5.controls.common.feeds.FeedItem({
                        uid: "categoryAxis", type: "Dimension", values: ["Product Area"]
                    }));

                    var sType = sChartType;
                    if (sChartType === "stacked_column") sType = "stacked_column";
                    if (sChartType === "stacked_bar") sType = "stacked_bar";
                    oViz.setVizType(sType);

                    oViz.setVizProperties({
                        title: { visible: true, text: "similarity chart" },
                        plotArea: { dataLabel: { visible: this.getView().getModel("state").getProperty("/chartLabels") === true } },
                        legend: { visible: this.getView().getModel("state").getProperty("/legend") === true },
                        valueAxis: { title: { visible: true, text: "Similarity Count" } },
                        categoryAxis: { title: { visible: true, text: "Product Area" } },
                        interaction: { zoom: { enablement: "enabled" }, pan: { enablement: "enabled" } }
                    });
                }
            },

            onToggleDataLabels: function (oEvent) {
                var b = this.getView().getModel("state").getProperty("/chartLabels") === true;
                this.getView().getModel("state").setProperty("/chartLabels", !b);
                this._applyChartConfig(this.getView().getModel("state").getProperty("/chartType") || "column");
            },

            onToggleLegend: function (oEvent) {
                var oState = this.getView().getModel("state");
                var b = oState && oState.getProperty("/legend") === true;
                if (oState) { oState.setProperty("/legend", !b); }
                var oViz = this.byId("mainViz");
                if (oViz) {
                    // Apply legend visibility directly without rebuilding dataset
                    oViz.setVizProperties({ legend: { visible: !b } });
                }
            },

            onExportChartSvg: function () {
                try {
                    var oViz = this.byId("mainViz");
                    var dom = oViz && oViz.getDomRef();
                    var svg = dom && dom.querySelector("svg");
                    if (!svg) {
                        sap.m.MessageToast.show("SVG not found. Try Full Screen first, then export.");
                        return;
                    }
                    var xml = new XMLSerializer().serializeToString(svg);
                    // Prefer UI5 File utility; fallback to data URL
                    try {
                        sap.ui.core.util.File.save(xml, "chart", "svg", "image/svg+xml");
                    } catch (e) {
                        var a = document.createElement("a");
                        a.download = "chart.svg";
                        a.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    }
                } catch (err) {
                    sap.m.MessageBox.error("Failed to export SVG: " + (err && err.message ? err.message : err));
                }
            },

            onToggleFullScreen: function (oEvent) {
                var that = this;
                var oViz = this.byId("mainViz");
                var oBox = this.byId("chartBox");
                var btn = this.byId("chartFull");

                if (!this._isFull) {
                    if (!this._oFullDlg) {
                        this._oFullDlg = new sap.m.Dialog({
                            contentWidth: "100%",
                            contentHeight: "100%",
                            stretch: true,
                            showHeader: true,
                            customHeader: new sap.m.Bar({
                                contentMiddle: [ new sap.m.Title({ text: "Chart - Full Screen" }) ],
                                contentRight: [ new sap.m.Button({
                                    icon: "sap-icon://decline",
                                    tooltip: "Close",
                                    press: function () {
                                        try { that._oFullDlg.close(); } finally { that._exitChartFullScreen(); }
                                    }
                                }) ]
                            }),
                            escapeHandler: function (oPromise) {
                                try { that._exitChartFullScreen(); } finally { oPromise.resolve(); }
                            },
                            afterClose: function () {
                                try { that._exitChartFullScreen(); } catch (e) {}
                            }
                        });
                    }
                    try { oBox.removeItem(oViz); } catch (e) {}
                    this._oFullDlg.addContent(oViz);
                    this._oFullDlg.open();
                    this._isFull = true;
                    if (btn) { btn.setText("Exit Full Screen"); btn.setIcon("sap-icon://exit-full-screen"); btn.setPressed(true); }
                    var oPop = this.byId("idPopOver");
                    if (oPop && oViz) { oPop.connect(oViz.getVizUid()); }
                } else {
                    this._exitChartFullScreen();
                }
            },

            _exitChartFullScreen: function () {
                var oViz = this.byId("mainViz");
                var oBox = this.byId("chartBox");
                var btn = this.byId("chartFull");

                if (this._oFullDlg) {
                    try {
                        this._oFullDlg.removeAllContent();
                        this._oFullDlg.close();
                    } catch (e) {}
                }
                try { oBox.addItem(oViz); } catch (e) {}
                this._isFull = false;
                if (btn) { btn.setText("Full Screen"); btn.setIcon("sap-icon://full-screen"); btn.setPressed(false); }
                var oPop = this.byId("idPopOver");
                if (oPop && oViz) { oPop.connect(oViz.getVizUid()); }
            },

            onChartSelect: function (oEvent) {
                var oVizFrame = this.byId("mainViz");
                var oPopOver = this.byId("idPopOver");
                if (!oPopOver._vizFrame) {
                   oPopOver.connect(oVizFrame.getVizUid());
                }
            },

            // Programmatic zoom controls for Trend mode (uses /TrendWindow over /TrendVersions)
            onChartZoomIn: function () {
                var oState = this.getView().getModel("state");
                var sMode = oState && oState.getProperty("/chartMode");
                if (sMode !== "trend") { return; }
                var oMock = this.getView().getModel("mock");
                if (!oMock) { return; }
                var aVers = oMock.getProperty("/TrendVersions") || [];
                var win = oMock.getProperty("/TrendWindow") || { startIndex: 0, endIndex: Math.max(0, aVers.length - 1) };
                if (aVers.length <= 2) { return; }
                if (win.endIndex - win.startIndex <= 2) { return; }
                win.startIndex = Math.min(win.startIndex + 1, Math.max(0, aVers.length - 2));
                win.endIndex = Math.max(win.endIndex - 1, win.startIndex + 1);
                oMock.setProperty("/TrendWindow", win);
                this._applyTrendWindow();
            },

            onChartZoomOut: function () {
                var oState = this.getView().getModel("state");
                var sMode = oState && oState.getProperty("/chartMode");
                if (sMode !== "trend") { return; }
                var oMock = this.getView().getModel("mock");
                if (!oMock) { return; }
                var aVers = oMock.getProperty("/TrendVersions") || [];
                var win = oMock.getProperty("/TrendWindow") || { startIndex: 0, endIndex: Math.max(0, aVers.length - 1) };
                if (!aVers.length) { return; }
                if (win.startIndex > 0) { win.startIndex -= 1; }
                if (win.endIndex < aVers.length - 1) { win.endIndex += 1; }
                oMock.setProperty("/TrendWindow", win);
                this._applyTrendWindow();
            },

            _applyTrendWindow: function () {
                try {
                    var oMock = this.getView().getModel("mock");
                    if (!oMock) { return; }
                    var aVers = oMock.getProperty("/TrendVersions") || [];
                    var win = oMock.getProperty("/TrendWindow");
                    if (!win || typeof win.startIndex !== "number" || typeof win.endIndex !== "number") {
                        win = { startIndex: 0, endIndex: Math.max(0, aVers.length - 1) };
                        oMock.setProperty("/TrendWindow", win);
                    }
                    var aFull = oMock.getProperty("/TrendDataFull") || [];
                    var allow = {};
                    for (var i = win.startIndex; i <= win.endIndex && i < aVers.length; i++) {
                        allow[aVers[i]] = true;
                    }
                    var windowed = aFull.filter(function (p) { return !!allow[String(p.UiVersionLabel || "")]; });
                    oMock.setProperty("/TrendData", windowed);
                    if (oMock.refresh) { oMock.refresh(true); }
                } catch (e) { /* no-op */ }
            },

            onTestPlanPress: function (oEvent) {
                var aData = oEvent.getParameter("data");
                if (!aData || !aData.length) return;

                var raw = aData[0].data || aData[0];
                var sCategory = raw.Status || raw["Similarity %"] || raw.Bucket;
                var sProductArea = raw["Product Area"] || raw.ProductArea;

                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("Route2", {
                    testplan: encodeURIComponent(sCategory || ""),   // adjust if you want specific testPlanName
                    productarea: encodeURIComponent(sProductArea || ""),
                    executedon: ""                                   // if you don’t have executedOn, pass empty
                });

                this._oPopover.close(); // if you want popover to close
            },


            _navigateToTestPlanInternal: function (sKey) {
                var oMock = this.getView().getModel("mock");
                var aFull = oMock.getProperty("/ChartDataFull") || oMock.getProperty("/ChartData") || [];
                var aFiltered = aFull.filter(function (r) {
                    return r.TestPlan === sKey || r.ProductArea === sKey || r.TestPlanId === sKey;
                });
                if (aFiltered.length) {
                    oMock.setProperty("/ChartData", aFiltered);
                    this._updatePieChartData(aFiltered);
                }
               
                this.getView().getModel("view").setProperty("/view", "table");
                var sId = (aFiltered[0] && (aFiltered[0].TestPlanId || aFiltered[0].ProductArea)) || sKey;
                this.getOwnerComponent().getRouter().navTo("detail", { id: encodeURIComponent(sId) });
            },

            getTestType: function (inputString) {
                // Stable test type label for these plan runs
                return "UI5 DRT";
            },

            getProductArea: function (testPlanName) {
                // Parse the last token of the testPlanName (e.g., ..._SD, ..._FIN, ..._MM, ..._PP, ..._EAM, ..._SERV, ..._HR)
                try {
                    var parts = String(testPlanName || "").split("_");
                    var code = (parts[parts.length - 1] || "").toUpperCase();
                    var map = {
                        SD:   "SALES",
                        FIN:  "FIN",
                        MM:   "PROCURE",
                        QM:   "PROCURE",
                        PP:   "PRODUCE",
                        EAM:  "PRODUCE",
                        SERV: "SERVICES",
                        HR:   "MASTER DATA"
                    };
                    return map[code] || "UNKNOWN";
                } catch (e) {
                    return "UNKNOWN";
                }
            },

            getRelease: function (testPlanName) {
                try {
                    var parts = String(testPlanName || "").split("_");
                    // Example: S4PUC_2602_INF_1130X_...
                    return parts.length > 1 ? parts[1] : "";
                } catch (e) { return ""; }
            },

            getUiVersion: function (testPlanName) {
                try {
                    var txt = String(testPlanName || "");
                    var parts = txt.split("_");

                    // Strict rule: UI5 version is the token right AFTER 'INF' (e.g., S4PUC_2602_INF_1130X_... -> 1130)
                    var infIdx = parts.indexOf("INF");
                    if (infIdx >= 0 && parts[infIdx + 1]) {
                        var mAfterInf = parts[infIdx + 1].match(/^(\d+)(?:X)?$/i);
                        if (mAfterInf && mAfterInf[1]) {
                            return mAfterInf[1];
                        }
                    }

                    // Secondary rule: any token ending with X (e.g., 1130X) indicates UI5 version
                    for (var i = 0; i < parts.length; i++) {
                        var mx = parts[i].match(/^(\d+)X$/i);
                        if (mx && mx[1]) {
                            return mx[1];
                        }
                    }

                    // No reliable UI5 version found
                    return "";
                } catch (e) { return ""; }
            },
 
            onLogRowPress: function (oEvent) {

                var oView = this.getView();
                var oSearchField = this.getView().byId("idSearchField");
                if (oSearchField) {
                    oSearchField.setValue("");
                }


                var oMultiInputFilter = this.getView().byId("idMInpTestPlan");
                if (oMultiInputFilter) {
                    oMultiInputFilter.setValue("");
                    oMultiInputFilter.removeAllTokens();
                }


                var aMultiComboBoxIds = ["idMCBoxTestScope", "idMCBoxsimilarity", "idMCBoxProdArea"];
                aMultiComboBoxIds.forEach(function (sId) {
                    var oMultiComboBox = oView.byId(sId);
                    if (oMultiComboBox) {
                        oMultiComboBox.setSelectedKeys([]);
                        oMultiComboBox.removeAllSelectedItems();
                    }
                });

                var oCurrObj = oEvent.getSource().getBindingContext("msimilaritypercent").getObject();
                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);

                oRouter.navTo("Route2", {
                    testplan: encodeURIComponent(oCurrObj.testPlanName),
                    productarea: encodeURIComponent(oCurrObj.ProductArea),
                    executedon: encodeURIComponent(oCurrObj.executeOn)

                });
            },

            onLiveChange: function (oEvent) {
                oEvent.getSource().setValueState(sap.ui.core.ValueState.None);
                oEvent.getSource().setValueStateText();
            },

            onTestPlanVH: function (evt) {
                var oView = this.getView();
                if (!this._TestPlanDialog) {
                    this._TestPlanDialog = sap.ui.xmlfragment("vicstartintegration.view.fragment.TestPlanVHDialog", this);
                    this._TestPlanDialog.addStyleClass("sapUiSizeCompact");
                    oView.addDependent(this._oValueHelpDialog);
                }
                this._TestPlanDialog.setModel(oView.getModel("mTestPlan"), "mTestPlan");

                var oMultiInput = this.byId("idMInpTestPlan");
                var aTokens = oMultiInput.getTokens();
                var aVHItems = this._TestPlanDialog.getItems();
                for (var j = 0; j < aVHItems.length; j++) {
                    aVHItems[j].setSelected(false);
                }
                if (aTokens && aTokens.length > 0) {
                    for (var i = 0; i < aTokens.length; i++) {
                        for (var j = 0; j < aVHItems.length; j++) {
                            if (aTokens[i].getText() === aVHItems[j].getTitle()) {
                                aVHItems[j].setSelected(true);
                            }
                        }
                    }
                }

                this._TestPlanDialog.open();
            },

            TestPlanVHSearch: function (evt) {
                var sValue = evt.getParameter("value");
                var oFilter = new Filter(
                    "testPlanName",
                    FilterOperator.Contains,
                    sValue
                );
                evt.getSource().getBinding("items").filter([oFilter]);
            },

            TestPlanVHClose: function (evt) {
                var aSelectedItems = evt.getParameter("selectedItems"),
                    aSelectedContexts = evt.getParameter("selectedContexts"),
                    oMultiInput = this.byId("idMInpTestPlan");
                oMultiInput.removeAllTokens();

                if (aSelectedItems && aSelectedItems.length > 0) {

                    for (var j = 0; j < aSelectedItems.length; j++) {
                        oMultiInput.addToken(new Token({
                            text: aSelectedItems[j].getTitle()
                        }));
                    }
                } else if (aSelectedContexts && aSelectedContexts.length > 0) {
                    for (var k = 0; k < aSelectedContexts.length; k++) {
                        oMultiInput.addToken(new Token({
                            text: aSelectedContexts[k].getObject().testPlanName
                        }));
                    }
                }
            },

            onFBGoPress: function () {
                // Apply filters to the msimilaritypercent table based on 'mock' selections (Select All supported)
                var oView = this.getView();
                var oTable = oView.byId("idTblTestPlan");
                var oBinding = oTable.getBinding("items");
                if (!oBinding) { return; }

                var oMock = this.getView().getModel("mock");
                var sel = (oMock && oMock.getProperty("/Selections")) || {};
                function normArr(a){ return Array.isArray(a) ? a.filter(function(k){return k!=="ALL";}) : []; }

                var aAndFilter = [];
                var aOrFilter;

                // Similarity thresholds (ltXX keys)
                var aSim = normArr(sel.Similarity);
                if (aSim.length) {
                    aOrFilter = [];
                    aSim.forEach(function (key) {
                        var m = String(key).match(/^lt(\d+)$/);
                        if (!m) return;
                        var th = Number(m[1]);
                        aOrFilter.push(new Filter("percentSuccess", FilterOperator.LT, th));
                    });
                    if (aOrFilter.length) aAndFilter.push(new Filter(aOrFilter, false));
                }

                // Search field
                var sSrchValue = this.getView().byId("idSearchField").getValue();
                if (sSrchValue && sSrchValue.trim() !== "") {
                    aOrFilter = [];
                    aOrFilter.push(new Filter("testPlanName", FilterOperator.Contains, sSrchValue));
                    aOrFilter.push(new Filter("ProductArea",  FilterOperator.Contains, sSrchValue));
                    aOrFilter.push(new Filter("TestType",     FilterOperator.Contains, sSrchValue));
                    aAndFilter.push(new Filter(aOrFilter, false));
                }

                // Test Plan selections (array)
                var aPlans = normArr(sel.TestPlan);
                if (aPlans.length) {
                    aOrFilter = [];
                    aPlans.forEach(function (p) {
                        aOrFilter.push(new Filter("testPlanName", FilterOperator.EQ, p));
                    });
                    aAndFilter.push(new Filter(aOrFilter, false));
                }

                // Product Area selections (array)
                var aAreas = normArr(sel.ProductArea);
                if (aAreas.length) {
                    aOrFilter = [];
                    aAreas.forEach(function (pa) {
                        aOrFilter.push(new Filter("ProductArea", FilterOperator.EQ, pa));
                    });
                    aAndFilter.push(new Filter(aOrFilter, false));
                }

                // Test Type selections (array)
                var aTypes = normArr(sel.TestType);
                if (aTypes.length) {
                    aOrFilter = [];
                    aTypes.forEach(function (tt) {
                        aOrFilter.push(new Filter("TestType", FilterOperator.EQ, tt));
                    });
                    aAndFilter.push(new Filter(aOrFilter, false));
                }

                // UI Version selections (array)
                var aVers = normArr(sel.UiVersion);
                if (aVers.length) {
                    aOrFilter = [];
                    aVers.forEach(function (v) {
                        aOrFilter.push(new Filter("UiVersion", FilterOperator.EQ, v));
                    });
                    aAndFilter.push(new Filter(aOrFilter, false));
                }

                // Release selections (array)
                var aRel = normArr(sel.Release);
                if (aRel.length) {
                    aOrFilter = [];
                    aRel.forEach(function (r) {
                        aOrFilter.push(new Filter("Release", FilterOperator.EQ, r));
                    });
                    aAndFilter.push(new Filter(aOrFilter, false));
                }

                // Apply filters
                if (aAndFilter.length) {
                    oBinding.filter(new Filter(aAndFilter, true));
                } else {
                    oBinding.filter([]);
                }
                oView.byId('idTblTitle').setText("Test Plans (" + oBinding.getLength() + ")");
                // Update charts and dependent dropdowns to reflect current filtered table
                this._applyFilterModels();
            },

            onFBClearPress: function () {
                // Clear UI + selections and remove table filters
                var oSearchField = this.getView().byId("idSearchField");
                if (oSearchField) oSearchField.setValue("");

                var oMock = this.getView().getModel("mock");
                if (oMock) {
                    oMock.setProperty("/Selections", { TestType: [], ProductArea: [], TestPlan: [], UiVersion: [], Release: [], Similarity: [], DateFrom: null, DateTo: null });
                }
                var ids = ["testTypeSelect","productAreaSelect","testPlanSelect","uiVersionSelect","releaseSelect","similaritySelect"];
                for (var i=0;i<ids.length;i++) {
                    var c = this.getView().byId(ids[i]);
                    if (c && c.setSelectedKeys) c.setSelectedKeys([]);
                }

                var oTable = this.getView().byId("idTblTestPlan");
                var oBinding = oTable.getBinding("items");
                if (oBinding) oBinding.filter([]);
                this.getView().byId('idTblTitle').setText("Test Plans (" + (oBinding ? oBinding.getLength() : 0) + ")");
                // Rebuild lists after clear
                this._rebuildSelectorLists();
                // Sync charts with cleared filters (full dataset)
                this._applyFilterModels();
            },

            onFBResetPress: function () {
                var oView = this.getView();
                oView.byId("idSearchField").setValue("");
                // Reset selections model
                var oMock = this.getView().getModel("mock");
                if (oMock) {
                    oMock.setProperty("/Selections", { TestType: [], ProductArea: [], TestPlan: [], UiVersion: [], Release: [], Similarity: [], DateFrom: null, DateTo: null });
                }
                // Clear MultiComboBoxes (new IDs)
                ["testTypeSelect","productAreaSelect","testPlanSelect","uiVersionSelect","releaseSelect","similaritySelect"].forEach(function(id){
                    var c = oView.byId(id);
                    if (c && c.setSelectedKeys) { c.setSelectedKeys([]); }
                });
                // Clear table filters
                var oTable = oView.byId("idTblTestPlan");
                var oBinding = oTable.getBinding("items");
                if (oBinding) {
                    oBinding.filter([]);
                    oView.byId("idTblTitle").setText("Test Plans (" + oBinding.getLength() + ")");
                }
                // Rebuild dependent lists
                this._rebuildSelectorLists();
                // Sync charts after reset
                this._applyFilterModels();
            },

            onFiltersChanged: function (oEvent) {
                var oView = this.getView();
                var aFilters = [];
                var aFilterProdAreaItems = oView.byId("idMCBoxProdArea").getSelectedItems() || [];
                var aFilterTestScpItems = oView.byId("idMCBoxTestScope").getSelectedItems() || [];

                if (aFilterProdAreaItems.length > 0) {
                    var aOr = [];
                    for (var i = 0; i < aFilterProdAreaItems.length; i++) {
                        aOr.push(new Filter("ProductArea", FilterOperator.Contains, aFilterProdAreaItems[i].getProperty("key")));
                    }
                    aFilters.push(new Filter(aOr, false));
                }

                if (aFilterTestScpItems.length > 0) {
                    var aOr2 = [];
                    for (var j = 0; j < aFilterTestScpItems.length; j++) {
                        aOr2.push(new Filter("TestType", FilterOperator.Contains, aFilterTestScpItems[j].getProperty("key")));
                    }
                    aFilters.push(new Filter(aOr2, false));
                }


                var oTable = oView.byId("idTblTestPlan");
                var oBinding = oTable.getBinding("items");
                if (oBinding) {
                    oBinding.filter(aFilters);
                    oView.byId("idTblTitle").setText("Test Plans (" + oBinding.getLength() + ")");
                }

                // Rebuild dropdown sources and charts from current filtered set
                this._applyFilterModels();
            },

            // Ensure charts always reflect the table after any binding update (incl. Adapt Filters + Go)
            onTblUpdateFinished: function () {
                try { this._applyFilterModels(); } catch (e) {}
            },


            _markBestEntries: function (aRows) {
                try {
                    var grouped = {};
                    (aRows || []).forEach(function (r) {
                        var key = (r.ProductArea || "UNKNOWN") + "|" + (r.TestType || "UNKNOWN");
                        if (!grouped[key]) {
                            grouped[key] = { max: Number(r.percentSuccess) || 0 };
                        } else {
                            grouped[key].max = Math.max(grouped[key].max, Number(r.percentSuccess) || 0);
                        }
                    });
                    (aRows || []).forEach(function (r) {
                        var key = (r.ProductArea || "UNKNOWN") + "|" + (r.TestType || "UNKNOWN");
                        var max = grouped[key] && grouped[key].max || 0;
                        r.isBest = (Number(r.percentSuccess) || 0) >= max;
                    });
                } catch (e) {
                    (aRows || []).forEach(function (r) { r.isBest = false; });
                }
                return aRows;
            },

            _applyFilterModels: function () {
                var oView = this.getView();
                var oTable = oView.byId("idTblTestPlan");
                var oBinding = oTable.getBinding("items");
                if (!oBinding) { return; }

                // Build current filtered dataset robustly across binding types
                var current = [];
                try {
                    var aCtx = (oBinding.getCurrentContexts && oBinding.getCurrentContexts())
                        || (oBinding.getContexts && oBinding.getContexts(0, oBinding.getLength && oBinding.getLength()))
                        || [];
                    for (var i = 0; i < aCtx.length; i++) {
                        var obj = aCtx[i] && aCtx[i].getObject ? aCtx[i].getObject() : null;
                        if (obj) { current.push(obj); }
                    }
                } catch (e) {
                    var aIndices = oBinding.aIndices || [];
                    var aList = oBinding.oList || [];
                    for (var j = 0; j < aIndices.length; j++) {
                        current.push(aList[aIndices[j]]);
                    }
                }

                // Restrict Test Plan VH list
                var seenPlans = {};
                var aTestPlan = [];
                (current || []).forEach(function (r) {
                    if (r && r.testPlanName && !seenPlans[r.testPlanName]) {
                        seenPlans[r.testPlanName] = true;
                        aTestPlan.push({ testPlanName: r.testPlanName });
                    }
                });
                oView.setModel(new JSONModel(aTestPlan), "mTestPlan");

                // Build master lists (Product Area, Test Type) from full dataset to keep options intact
                var oMockModel2 = this.getView().getModel("mock");
                var fullAll = (oMockModel2 && oMockModel2.getProperty("/ChartDataFull")) || [];
                var seenAreas = {};
                var seenTypes = {};
                var aProdArea = [];
                var aTesScp = [];
                (fullAll || []).forEach(function (r) {
                    if (r && r.ProductArea && !seenAreas[r.ProductArea]) {
                        seenAreas[r.ProductArea] = true;
                        aProdArea.push({ ProductArea: r.ProductArea });
                    }
                    if (r && r.TestType && !seenTypes[r.TestType]) {
                        seenTypes[r.TestType] = true;
                        aTesScp.push({ TestType: r.TestType });
                    }
                });
                oView.setModel(new JSONModel(aProdArea), "mProdArea");
                oView.setModel(new JSONModel(aTesScp), "mTesScp");

                // Update dependent lists (Release, UiVersion, TestPlan) based only on master selections (TestType, ProductArea)
                var oMockModel = this.getView().getModel("mock");
                if (oMockModel) {
                    var full = oMockModel.getProperty("/ChartDataFull") || [];
                    var sel = oMockModel.getProperty("/Selections") || {};
                    function arr(a){ return Array.isArray(a) ? a.filter(function(k){return k!=="ALL";}) : []; }
                    var aTypesSel = arr(sel.TestType);
                    var aAreasSel = arr(sel.ProductArea);

                    function keepByMasters(r){
                        var ok = true;
                        if (aTypesSel.length && aTypesSel.indexOf(String(r.TestType||"")) === -1) ok = false;
                        if (aAreasSel.length && aAreasSel.indexOf(String(r.ProductArea||"")) === -1) ok = false;
                        return ok;
                    }
                    var filtered = full.filter(keepByMasters);

                    function toKeyText(list, prop){
                        var set = {};
                        (list || []).forEach(function (r) {
                            var v = (r && r[prop]) ? String(r[prop]).trim() : "";
                            if (v) { set[v] = true; }
                        });
                        return Object.keys(set).sort().map(function (k) { return { key: k, text: k }; });
                    }
                    function withAll(arr){ return [{ key: "ALL", text: "Select All" }].concat(arr); }

                    var aRel   = toKeyText(filtered, "Release");
                    var aVers  = toKeyText(filtered, "UiVersion");
                    var aPlans = toKeyText(filtered, "TestPlan");

                    // Only cascade dependent lists; keep master lists (TestTypes/ProductAreas) intact
                    oMockModel.setProperty("/Releases", withAll(aRel));
                    oMockModel.setProperty("/UiVersions", withAll(aVers));
                    oMockModel.setProperty("/TestPlans", withAll(aPlans));

                    // Prune dependent selections that no longer match master selections
                    function prune(selArr, list){
                        var set = {};
                        (list || []).forEach(function (it){ if (it && it.key) { set[it.key] = true; } });
                        return (selArr || []).filter(function (k){ return k !== "ALL" && !!set[k]; });
                    }
                    var newSel = {
                        TestType: sel.TestType || [],
                        ProductArea: sel.ProductArea || [],
                        Release: prune(sel.Release, aRel),
                        UiVersion: prune(sel.UiVersion, aVers),
                        Similarity: (sel.Similarity || []).filter(function(k){ return /^lt\d+$/.test(k); }),
                        TestPlan: prune(sel.TestPlan, aPlans)
                    };
                    oMockModel.setProperty("/Selections", newSel);
                    if (oMockModel.refresh) { oMockModel.refresh(true); }

                    // Reflect pruned dependent selections in UI controls (keep masters intact)
                    try {
                        var vUpd = this.getView();
                        var uiSelMap = {
                            "releaseSelect": newSel.Release || [],
                            "uiVersionSelect": newSel.UiVersion || [],
                            "testPlanSelect": newSel.TestPlan || []
                        };
                        Object.keys(uiSelMap).forEach(function (id) {
                            var c = vUpd.byId(id);
                            if (c && c.setSelectedKeys) { c.setSelectedKeys(uiSelMap[id]); }
                        });
                    } catch (eKeys) { /* no-op */ }
                }

                // Update charts to reflect filtered dataset
                this._rebuildChartModels(current);
            },

            _rebuildChartModels: function (aRows) {
                // Use aggregated dataset (Sim100/Sim99/SimLess by ProductArea) for column/bar charts
                var agg = this._buildAggregatedChartData(aRows || []);
                var aggWithTotal = (agg || []).map(function (it) {
                    return Object.assign({}, it, { Total: Number(it.Sim100 || 0) + Number(it.Sim99 || 0) + Number(it.SimLess || 0) });
                });
                var oChartModel = this.getView().getModel("mock");
                if (!oChartModel) {
                    oChartModel = new JSONModel({ ChartData: aggWithTotal });
                    this.getView().setModel(oChartModel, "mock");
                } else {
                    oChartModel.setProperty("/ChartData", aggWithTotal);
                }

                // Build trend line dataset:
                // - X = full UI5 version timeline (earliest to latest) from the unfiltered dataset
                // - Color = Product Area
                // - Y = Similarity %, with nulls before the first available version so lines start where data exists
                var trend = [];
                try {
                    var that = this;

                    function verNum(label) {
                        try {
                            var m = String(label || "").match(/\d+/);
                            return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
                        } catch (e) { return Number.MAX_SAFE_INTEGER; }
                    }

                    // 1) Determine base rows for TREND from full dataset filtered by current selections (not by table binding)
                    var oSel = (oChartModel && oChartModel.getProperty("/Selections")) || {};
                    function arr(a){ return Array.isArray(a) ? a.filter(function(k){return k!=="ALL";}) : []; }
                    function nstr(s){ return s===null||s===undefined?"":String(s).trim(); }

                    var baseRows = (oChartModel && (oChartModel.getProperty("/FilteredFullBase") || oChartModel.getProperty("/ChartDataFull"))) || [];
                    var aSelAreas = arr(oSel.ProductArea);
                    var aSelTypes = arr(oSel.TestType);
                    var aSelPlans = arr(oSel.TestPlan);
                    var aSelVers = arr(oSel.UiVersion);
                    var aSelRel  = []; // Ignore Release filter in Trend timeline to show full version history
                    var aSelSim  = arr(oSel.Similarity);

                    function passSimilarity(val){
                        if (!aSelSim.length) return true;
                        for (var i=0;i<aSelSim.length;i++){
                            var m = String(aSelSim[i]).match(/^lt(\d+)$/);
                            if (m){ if (Number(val) < Number(m[1])) return true; }
                        }
                        return false;
                    }

                    var baseFiltered = (baseRows || []).filter(function(r){
                        var area = nstr(r && r.ProductArea);
                        var type = nstr(r && r.TestType);
                        var plan = nstr(r && r.TestPlan);
                        var ver  = nstr(r && (r.UiVersion || that.getUiVersion(r.testPlanName || r.TestPlan || "")));
                        var rel  = nstr(r && r.Release);
                        var ok = true;
                        if (aSelAreas.length && aSelAreas.indexOf(area) === -1) ok = false;
                        if (ok && aSelTypes.length && aSelTypes.indexOf(type) === -1) ok = false;
                        if (ok && aSelPlans.length && aSelPlans.indexOf(plan) === -1) ok = false;
                        if (ok && aSelVers.length && aSelVers.indexOf(ver) === -1) ok = false;
                        var simVal = (r && (r.SimilarityPercent !== undefined ? r.SimilarityPercent : r.percentSuccess));
                        if (ok && !passSimilarity(Number(simVal))) ok = false;
                        return ok;
                    });

                    // 2) Build full version axis from ENTIRE dataset (ChartDataFull) to ensure older versions always appear,
                    //    then aggregate current baseFiltered rows by Area+Version.
                    var mAllVersions = {};
                    var axisRows = (oChartModel && oChartModel.getProperty("/ChartDataFull")) || [];
                    (axisRows || []).forEach(function (r) {
                        var vLabel = nstr(r && (r.UiVersion || that.getUiVersion(r.testPlanName || r.TestPlan || "")));
                        if (vLabel) { mAllVersions[vLabel] = true; }
                    });
                    var aAllVersions = Object.keys(mAllVersions).sort(function (a, b) { return verNum(a) - verNum(b); });

                    var mAreas = {};
                    var mAreasSet = {};
                    (baseFiltered || []).forEach(function (r) {
                        var area = nstr(r && r.ProductArea) || "N/A";
                        var vLabel = nstr(r && (r.UiVersion || that.getUiVersion(r.testPlanName || r.TestPlan || "")));
                        if (!vLabel) { return; }
                        if (!mAreas[area]) { mAreas[area] = {}; }
                        if (!mAreas[area][vLabel]) { mAreas[area][vLabel] = { sum: 0, count: 0 }; }
                        var val = Number(r && (r.SimilarityPercent !== undefined ? r.SimilarityPercent : r.percentSuccess));
                        if (!isNaN(val)) {
                            mAreas[area][vLabel].sum += val;
                            mAreas[area][vLabel].count += 1;
                        }
                        mAreasSet[area] = true;
                    });

                    // 3) Emit points for every version with nulls for gaps (showGap handles)
                    Object.keys(mAreasSet).forEach(function (area) {
                        aAllVersions.forEach(function (vLabel) {
                            var rec = mAreas[area] && mAreas[area][vLabel];
                            var val = (rec && rec.count > 0) ? (rec.sum / rec.count) : null;
                            trend.push({
                                UiVersionLabel: vLabel,
                                ProductArea: area,
                                SimilarityPercent: val
                            });
                        });
                    });
                } catch (e) { /* ignore */ }
                // Normalize and filter dimension fields to avoid [50053] Incomplete dimensions binding
                var _normalized = [];
                for (var _i = 0; _i < trend.length; _i++) {
                    var _v = String(trend[_i].UiVersionLabel || "");
                    var _a = String(trend[_i].ProductArea || "");
                    if (!_v || !_a) { continue; }
                    trend[_i].UiVersionLabel = _v;
                    trend[_i].ProductArea = _a;
                    _normalized.push(trend[_i]);
                }
                if (oChartModel) {
                    // Persist full trend dataset and version list to support zooming
                    oChartModel.setProperty("/TrendDataFull", _normalized);
                    var _verSet = {};
                    for (var _k = 0; _k < _normalized.length; _k++) { _verSet[_normalized[_k].UiVersionLabel] = true; }
                    var _versions = Object.keys(_verSet).sort(function (a, b) {
                        try {
                            var ma = String(a || "").match(/\d+/), mb = String(b || "").match(/\d+/);
                            return (ma ? parseInt(ma[0], 10) : 0) - (mb ? parseInt(mb[0], 10) : 0);
                        } catch (e) { return 0; }
                    });
                    oChartModel.setProperty("/TrendVersions", _versions);
                    // Initialize zoom window if missing
                    var _win = oChartModel.getProperty("/TrendWindow");
                    if (!_win || typeof _win.startIndex !== "number" || typeof _win.endIndex !== "number") {
                        _win = { startIndex: 0, endIndex: Math.max(0, _versions.length - 1) };
                        oChartModel.setProperty("/TrendWindow", _win);
                    }
                    // Apply current window to visible TrendData
                    var _allow = {};
                    for (var _j = _win.startIndex; _j <= _win.endIndex && _j < _versions.length; _j++) { _allow[_versions[_j]] = true; }
                    var _windowed = _normalized.filter(function (p) { return !!_allow[p.UiVersionLabel]; });
                    oChartModel.setProperty("/TrendData", _windowed);
                }

                // Keep pie chart in sync based on raw rows
                this._updatePieChartData(aRows || []);
                if (oChartModel && oChartModel.refresh) { oChartModel.refresh(true); }
            },

            // Dropdown style logic (Select All + cascading restriction)
            onMultiChange: function (oEvent) {
                var oSrc = oEvent.getSource();
                var sId = oSrc && oSrc.getId ? oSrc.getId() : "";
                var oMock = this.getView().getModel("mock");
                if (!oMock) return;
                var sel = oMock.getProperty("/Selections") || {};
                var aKeys = (oSrc.getSelectedKeys && oSrc.getSelectedKeys()) || [];

                function expandAll(listPath, staticAll) {
                    if (aKeys.indexOf("ALL") !== -1) {
                        if (listPath) {
                            var all = (oMock.getProperty(listPath) || [])
                              .map(function (it) { return it.key; })
                              .filter(function (k) { return k !== "ALL"; });
                            aKeys = all;
                            if (oSrc.setSelectedKeys) { oSrc.setSelectedKeys(aKeys); }
                        } else if (staticAll && staticAll.length) {
                            aKeys = staticAll.slice();
                            if (oSrc.setSelectedKeys) { oSrc.setSelectedKeys(aKeys); }
                        }
                    }
                }

                if (sId.indexOf("testTypeSelect") !== -1) {
                    // Master: Test Type
                    // Expand "ALL" to concrete keys and compute delta (removed types)
                    var prevTypes = (sel.TestType || []).slice();
                    expandAll("/TestTypes");
                    sel.TestType = aKeys;
                    var removedTypes = prevTypes.filter(function (t) { return aKeys.indexOf(t) === -1; });

                    // Remove only cascading selections that belong to removed Test Types
                    if (removedTypes.length) {
                        try {
                            var oMock = this.getView().getModel("mock");
                            var full = (oMock && oMock.getProperty("/ChartDataFull")) || [];
                            var planToType = {};
                            (full || []).forEach(function (r) {
                                var p = String(r.TestPlan || "");
                                var tt = String(r.TestType || "");
                                if (p) { planToType[p] = tt; }
                            });
                            sel.TestPlan = (sel.TestPlan || []).filter(function (p) {
                                var tt = planToType[p] || "";
                                return removedTypes.indexOf(tt) === -1;
                            });
                        } catch (eType) { /* no-op */ }
                    }
                    // Do not blanket-clear Release/UiVersion; they will be pruned downstream
                } else if (sId.indexOf("productAreaSelect") !== -1) {
                    // Master: Product Area
                    // Expand "ALL" to concrete keys and compute delta (removed areas)
                    var prevAreas = (sel.ProductArea || []).slice();
                    expandAll("/ProductAreas");
                    sel.ProductArea = aKeys;
                    var removedAreas = prevAreas.filter(function (pa) { return aKeys.indexOf(pa) === -1; });

                    // Remove only cascading selections that belong to removed Product Areas
                    if (removedAreas.length) {
                        try {
                            var oMock2 = this.getView().getModel("mock");
                            var full2 = (oMock2 && oMock2.getProperty("/ChartDataFull")) || [];
                            var planToArea = {};
                            (full2 || []).forEach(function (r) {
                                var p = String(r.TestPlan || "");
                                var pa = String(r.ProductArea || "");
                                if (p) { planToArea[p] = pa; }
                            });
                            sel.TestPlan = (sel.TestPlan || []).filter(function (p) {
                                var pa = planToArea[p] || "";
                                return removedAreas.indexOf(pa) === -1;
                            });
                        } catch (eArea) { /* no-op */ }
                    }
                    // Do not blanket-clear Release/UiVersion; they will be pruned downstream
                } else if (sId.indexOf("testPlanSelect") !== -1) {
                    expandAll("/TestPlans");
                    sel.TestPlan = aKeys;
                } else if (sId.indexOf("uiVersionSelect") !== -1) {
                    expandAll("/UiVersions");
                    sel.UiVersion = aKeys;
                } else if (sId.indexOf("releaseSelect") !== -1) {
                    expandAll("/Releases");
                    sel.Release = aKeys;
                } else if (sId.indexOf("similaritySelect") !== -1) {
                    expandAll(null, ["lt96","lt97","lt98","lt99","lt100"]);
                    sel.Similarity = aKeys;
                }

                oMock.setProperty("/Selections", sel);
                try { this.onFBGoPress(); } catch (e) {}
            },

            _rebuildSelectorLists: function () {
                var oMock = this.getView().getModel("mock");
                if (!oMock) return;
                var aFull = oMock.getProperty("/ChartDataFull") || [];
                var sel = oMock.getProperty("/Selections") || {};

                function n(s){ return s===null||s===undefined?"":String(s).trim(); }
                function arr(a){ return Array.isArray(a) ? a.filter(function(k){return k!=="ALL";}) : []; }

                // Current selections across all dimensions
                var aTypesSel = arr(sel.TestType);
                var aAreasSel = arr(sel.ProductArea);
                var aRelSel   = arr(sel.Release);
                var aVersSel  = arr(sel.UiVersion);
                var aSimSel   = arr(sel.Similarity);

                function passSimilarity(val){
                    if (!aSimSel.length) return true;
                    for (var i=0;i<aSimSel.length;i++){
                        var m = String(aSimSel[i]).match(/^lt(\d+)$/);
                        if (m){ if (Number(val) < Number(m[1])) return true; }
                    }
                    return false;
                }

                // Use full dataset (non-cascading) for option lists to prevent options disappearing when user selects filters
                var base = (aFull || []);

                function withAll(arr){ return [{key:"ALL", text:"Select All"}].concat(arr); }
                function numSort(a,b){ return (parseInt(a,10)||0) - (parseInt(b,10)||0); }

                // Build lists from filtered base, so everything is interlinked
                var mTypes = {}, mAreas = {}, mRel = {}, mVers = {}, mPlans = {};
                base.forEach(function (r) {
                    var t = n(r.TestType); if (t) mTypes[t] = true;
                    var a = n(r.ProductArea); if (a) mAreas[a] = true;
                    var rel = n(r.Release); if (rel) mRel[rel] = true;
                    var v = n(r.UiVersion); if (v) mVers[v] = true;
                    var p = n(r.TestPlan); if (p) mPlans[p] = true;
                });

                var aTypes = Object.keys(mTypes).sort().map(function (k){ return { key:k, text:k }; });
                var aAreas = Object.keys(mAreas).sort().map(function (k){ return { key:k, text:k }; });
                var aRel   = Object.keys(mRel).sort(numSort).map(function(k){ return { key:k, text:k }; });
                var aVers  = Object.keys(mVers).sort(numSort).map(function(k){ return { key:k, text:k }; });
                var aPlans = Object.keys(mPlans).sort().map(function (k){ return { key:k, text:k }; });

                // Exclude release tokens from versions if they accidentally match numeric labels
                var relSet = {};
                aRel.forEach(function(it){ relSet[it.key] = true; });
                var aVersFiltered = aVers.filter(function(it){ return !relSet[it.key]; });

                oMock.setProperty("/TestTypes", withAll(aTypes));
                oMock.setProperty("/ProductAreas", withAll(aAreas));
                oMock.setProperty("/Releases", [{key:"ALL", text:"Select All"}].concat(aRel));
                oMock.setProperty("/UiVersions", [{key:"ALL", text:"Select All"}].concat(aVersFiltered));
                oMock.setProperty("/TestPlans", withAll(aPlans));

                // Validate and prune current selections that are no longer available
                function prune(selArr, list){
                    var keys = (selArr || []).filter(function(k){return k!=="ALL";});
                    if (!keys.length) return selArr;
                    var set = {};
                    (list || []).forEach(function(it){ set[it.key] = true; });
                    var valid = keys.filter(function(k){ return !!set[k]; });
                    return valid;
                }
                var newSel = {
                    TestType: prune(sel.TestType, aTypes),
                    ProductArea: prune(sel.ProductArea, aAreas),
                    Release: prune(sel.Release, aRel),
                    UiVersion: prune(sel.UiVersion, aVersFiltered),
                    Similarity: arr(sel.Similarity),
                    TestPlan: prune(sel.TestPlan, aPlans)
                };
                oMock.setProperty("/Selections", newSel);
                // Debug: verify lists populated for MultiComboBoxes
                try {
                    console.log("[mock lists]", {
                        types: (aTypes && aTypes.length) || 0,
                        areas: (aAreas && aAreas.length) || 0,
                        releases: (aRel && aRel.length) || 0,
                        versions: (aVersFiltered && aVersFiltered.length) || 0,
                        plans: (aPlans && aPlans.length) || 0
                    });
                } catch (e) {}
                // Ensure MultiComboBox item bindings are established on plain server
                // Some environments require explicit bindAggregation calls after model updates.
                try {
                    var v = this.getView();
                    var defs = [
                        { id: "testTypeSelect", path: "/TestTypes" },
                        { id: "productAreaSelect", path: "/ProductAreas" },
                        { id: "releaseSelect", path: "/Releases" },
                        { id: "uiVersionSelect", path: "/UiVersions" },
                        { id: "testPlanSelect", path: "/TestPlans" }
                    ];
                    defs.forEach(function (d) {
                        var c = v.byId(d.id);
                        if (c && c.bindAggregation) {
                            c.bindAggregation("items", {
                                path: "mock>" + d.path,
                                template: new sap.ui.core.Item({ key: "{mock>key}", text: "{mock>text}" }),
                                templateShareable: false
                            });
                        }
                    });
                    if (oMock && oMock.refresh) { oMock.refresh(true); }
                    try { this._ensureFilterItemsPopulated(); } catch (e3) {}
                } catch (e2) {}
            },

            _ensureFilterItemsPopulated: function () {
                try {
                    var v = this.getView();
                    var oMock = v.getModel("mock");
                    if (!oMock) { return; }
                    var fb = v.byId("idFilterBar");
                    if (fb && fb.setModel) { fb.setModel(oMock, "mock"); }
                    var defs = [
                        { id: "testTypeSelect", path: "/TestTypes" },
                        { id: "productAreaSelect", path: "/ProductAreas" },
                        { id: "releaseSelect", path: "/Releases" },
                        { id: "uiVersionSelect", path: "/UiVersions" },
                        { id: "testPlanSelect", path: "/TestPlans" },
                        { id: "similaritySelect", path: null }
                    ];
                    defs.forEach(function (d) {
                        var c = v.byId(d.id);
                        if (!c) { return; }
                        if (d.path) {
                            // Bind to named "mock" model once; avoid manual injection to prevent render-phase errors
                            if (c.setModel) { c.setModel(oMock, "mock"); }
                            if (c.bindAggregation) {
                                c.bindAggregation("items", {
                                    path: "mock>" + d.path,
                                    template: new sap.ui.core.Item({ key: "{mock>key}", text: "{mock>text}" }),
                                    templateShareable: false
                                });
                            }
                            // Ensure bindings update and restore previously selected keys
                            try {
                                if (c.updateBindings) { c.updateBindings(true); }
                                var selMap2 = {
                                    "testTypeSelect": "/Selections/TestType",
                                    "productAreaSelect": "/Selections/ProductArea",
                                    "releaseSelect": "/Selections/Release",
                                    "uiVersionSelect": "/Selections/UiVersion",
                                    "testPlanSelect": "/Selections/TestPlan"
                                };
                                var selPath2 = selMap2[d.id];
                                if (selPath2 && c.setSelectedKeys) {
                                    var keys2 = (oMock.getProperty(selPath2) || []).filter(function (k) { return k !== "ALL"; });
                                    c.setSelectedKeys(keys2);
                                }
                            } catch (eInner) { /* no-op */ }
                        } else {
                            // Static Similarity items fallback (no model path)
                            try {
                                if (c.getItems && c.getItems().length === 0) {
                                    c.addItem(new sap.ui.core.Item({ key: "ALL",  text: "Select All" }));
                                    c.addItem(new sap.ui.core.Item({ key: "lt96", text: "Less than 96%" }));
                                    c.addItem(new sap.ui.core.Item({ key: "lt97", text: "Less than 97%" }));
                                    c.addItem(new sap.ui.core.Item({ key: "lt98", text: "Less than 98%" }));
                                    c.addItem(new sap.ui.core.Item({ key: "lt99", text: "Less than 99%" }));
                                    c.addItem(new sap.ui.core.Item({ key: "lt100",text: "Less than 100%" }));
                                }
                            } catch (eSim) { /* no-op */ }
                        }
                    });
                    // Avoid forcing applyChanges inside render phases; bindings will update naturally
                } catch (e) { /* no-op */ }
            },

            onExport: function () {
                var aCols, oRowBinding, oSettings, oSheet, oTable;

                if (!this._oTable) {
                    this._oTable = this.byId('idTblTestPlan');
                }

                oTable = this._oTable;
                var aTableFilterData = [];
                var aIndices = oTable.getBinding('items').aIndices;
                var aTableFullData = oTable.getBinding('items').oList;
                for (var i = 0; i < aIndices.length; i++) {
                    aTableFilterData.push(aTableFullData[aIndices[i]]);
                }
                var mTempExportData = new JSONModel(aTableFilterData);
                oRowBinding = mTempExportData.getProperty("/");
                aCols = this.createColumnConfig();

                oSettings = {
                    workbook: {
                        columns: aCols,
                    },
                    dataSource: oRowBinding,
                    fileName: 'VIC test plan Results.xlsx',
                };

                oSheet = new Spreadsheet(oSettings);
                var sMsg = "Do you want to export data to excel?";
                sap.m.MessageBox.show(sMsg, {
                    title: "Export",
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.OK,
                    initialFocus: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        if (sAction === "OK") {
                            oSheet.build().finally(function () {
                                oSheet.destroy();
                            });
                        }
                    }
                });
            },

            createColumnConfig: function () {
                var aCols = [];

                aCols.push({
                    label: 'Test Plan Name',
                    property: 'testPlanName',
                    type: EdmType.String,
                });

                aCols.push({
                    label: 'Compared On ',
                    property: 'executeOn',
                    type: EdmType.String,
                });

                aCols.push({
                    label: 'Similarity %',
                    type: EdmType.String,
                    property: 'percentSuccess',
                });

                aCols.push({
                    label: 'Product Area',
                    type: EdmType.String,
                    property: 'ProductArea',
                });

                aCols.push({
                    label: 'Test Type',
                    type: EdmType.String,
                    property: 'TestType',
                });

                return aCols;
            },

            handleSortButtonPressed: function () {
                if (!this._SortDialog) {
                    this._SortDialog = sap.ui.xmlfragment("vicstartintegration.view.fragment.LogListSortDialog", this);
                    this.getView().addDependent(this._SortDialog);
                    this._SortDialog.addStyleClass("sapUiSizeCompact");
                }
                this._SortDialog.open();
            },

            handleSortDialogConfirm: function (oEvent) {
                var mParams = oEvent.getParameters();
                var sPath = mParams.sortItem?.getKey(); 
                var bDescending = mParams.sortDescending;

                if (!sPath) {
                    sap.m.MessageToast.show("Please select a column to sort.");
                    return;
                }

                var sFormattedPath = sPath.replace(/([a-z])([A-Z])/g, '$1 $2'); 
                sFormattedPath = sFormattedPath.charAt(0).toUpperCase() + sFormattedPath.slice(1); 

                var oTable = this.byId("idTblTestPlan");
                var oBinding = oTable.getBinding("items");
                var aSorters = [];

                aSorters.push(new sap.ui.model.Sorter(sPath, bDescending));
                oBinding.sort(aSorters);

                sap.m.MessageToast.show(`Sorted by ${sFormattedPath} in ${bDescending ? "descending" : "ascending"} order.`);
            },

            onLogsRefresh: function () {
                try { this.onFBGoPress(); } catch (e) {}
            },

            onPersoButtonPressed: function (oEvent) {
                this._oTPC.openDialog();
            },

            onSearchFieldPress: function (oEvent) {

                var sQuery = oEvent.getSource().getValue();

                var oTable = this.byId("idTblTestPlan");
                var oBinding = oTable.getBinding("items");

                var aFilters = [];
                if (sQuery && sQuery.trim() !== "") {
                    aFilters.push(new sap.ui.model.Filter([
                        new sap.ui.model.Filter("testPlanName", sap.ui.model.FilterOperator.Contains, sQuery),
                        new sap.ui.model.Filter("ProductArea", sap.ui.model.FilterOperator.Contains, sQuery),
                        new sap.ui.model.Filter("TestType", sap.ui.model.FilterOperator.Contains, sQuery)
                    ], false)); 
                }

                oBinding.filter(aFilters);

                if (!oBinding.getLength()) {
                    sap.m.MessageToast.show("No matching results found");
                }
            },

            oCompareButton: function () {

                var that = this;
                if (!this.oCompareView) {
                    this.oCompareView = new sap.ui.xmlfragment("vicstartintegration.view.fragment.CompareView", this);
                    this.getView().addDependent(this.oCompareView);
                }
                this.oCompareView.open();
                sap.ui.getCore().byId("baseImgInput").setValue("1.139.0-SNAPSHOT(20250729-0116)");

                $.ajax({
                    url: "/VIC_UI_DEV/imageDetail/dailyOQ-details",
                    method: "GET",
                    dataType: "json",
                    success: function (data) {

                        var baseVersion = "1.139.0-SNAPSHOT(20250729-0116)";
                        var filteredData = data.filter(function (item) {
                            return item.ui5Version !== baseVersion;
                        });


                        var oTestUI5VersionModel = new sap.ui.model.json.JSONModel({ items: filteredData });
                        that.getView().setModel(oTestUI5VersionModel, "testVersionModel");
                    },
                    error: function (xhr, status, error) {
                        sap.m.MessageToast.show("Failed to load data from image comparator service.");
                    }
                });

            },

            oCompareClosePress: function () {
                sap.ui.getCore().byId("oCompareUI5VersionBtn").setEnabled(false);
                this.oCompareView.destroy(true)
                this.oCompareView = null;
            },

            onTestImgValueHelp: function () {
                sap.ui.getCore().byId("testImgInput").setValue("")
                sap.ui.getCore().byId('oCompareUI5VersionBtn').setEnabled(false)

                this.oTestImageCompareView = new sap.ui.xmlfragment("vicstartintegration.view.fragment.TestImageCompareView", this)
                this.getView().addDependent(this.oTestImageCompareView)
                this.oTestImageCompareView.open()
            },

            onTestImgDialogClose: function () {
                this.oTestImageCompareView.destroy(true)
                this.oTestImageCompareView = null;
            },

            onTestImgSelect: function (oEvent) {
                sap.ui.getCore().byId('onTestSelect').setEnabled(true)
                sap.ui.getCore().by("oTestVersionClear").setEnabled(true);
            },

            onTestImgSelectConfirm: function () {
                var oDialog = sap.ui.getCore().byId("testImageDialog");
                var oTable = sap.ui.getCore().byId("testImageTable");
                var oSelectedItem = oTable.getSelectedItem();
                var oContext = oSelectedItem.getBindingContext("testVersionModel");
                var selectedVersion = oContext.getProperty("version");
                sap.ui.getCore().byId("testImgInput").setValue(selectedVersion);
                sap.ui.getCore().byId('oCompareUI5VersionBtn').setEnabled(true)
                this.oTestImageCompareView.destroy(true)
                this.oTestImageCompareView = null

            },

            onTestImgClearConfirm: function () {
                var oTable = sap.ui.getCore().byId("testImageTable");
                if (oTable) {
                    oTable.removeSelections();
                }
                sap.ui.getCore().byId("onTestSelect").setEnabled(false);
                sap.ui.getCore().byId("oTestVersionClear").setEnabled(false);
            },

            onCompareSubmit: function () {
                var sBaseVersion = sap.ui.getCore().byId("baseImgInput").getValue();
                var sTestVersion = sap.ui.getCore().byId("testImgInput").getValue();
                sap.ui.getCore().byId('oCompareUI5VersionBtn').setEnabled(false);

                $.ajax({
                    url: "/VIC_UI_DEV/imageDetail/latest-comparison-status",
                    method: "GET",
                    success: function (data) {
                        var oTodayDate = new Date();
                        var oTodayDateFormat = oTodayDate.toISOString().split("T")[0];

                        var oTableDataDuplicateCheck = data.some(function (item) {
                            return item.ui5Version2 === sTestVersion && item.executedOn === oTodayDateFormat;
                        });


                        if (oTableDataDuplicateCheck) {
                            sap.m.MessageBox.confirm(
                                "Selected Test Version is already compared today.\nDo you want to trigger it again?",
                                {
                                    actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                                    onClose: function (oAction) {
                                        if (oAction === sap.m.MessageBox.Action.YES) {
                                            triggerComparison();
                                        } else {
                                            sap.ui.getCore().byId('oCompareUI5VersionBtn').setEnabled(true);
                                        }
                                    }
                                }
                            );
                            return;
                        } else {
                            triggerComparison();
                        }

                        function triggerComparison() {
                            sap.m.MessageToast.show("Comparison Triggered");

                            var sUrl = "/VIC_UI_DEV/imageDetail/snapshot-image-comparison/" +
                                sBaseVersion + "/" + sTestVersion;

                            $.ajax({
                                url: sUrl,
                                method: "POST",
                                success: function (data) {
                                    sap.m.MessageBox.success("Comparison triggered successfully!");
                                    sap.ui.getCore().byId('oCompareUI5VersionBtn').setEnabled(true);
                                },
                                error: function (xhr, status, error) {
                                    var sErrorMsg = xhr && xhr.responseText ? xhr.responseText : error;
                                    sap.m.MessageBox.error("Error triggering comparison: " + sErrorMsg);
                                    sap.ui.getCore().byId('oCompareUI5VersionBtn').setEnabled(true);
                                }
                            });
                        }
                    },
                    error: function () {
                        sap.m.MessageBox.error("Failed to check comparison history.");
                        sap.ui.getCore().byId('oCompareUI5VersionBtn').setEnabled(true);
                    }
                });
            },

            oMorePress: function () {
                this.onMoreLink.destroy();
                this.onMoreLink = null;
            },

            onMoreLinkPress: function () {

                var oDialog = sap.ui.getCore().byId("compareDialog");
                var oTableContainer = sap.ui.getCore().byId("compareTableContainer");
                var oMoreButton = sap.ui.getCore().byId("oCompareUI5VerdsionBtn");

                if (oTableContainer.getVisible()) {

                    oDialog.setContentWidth("60%");
                    oDialog.setContentHeight("35%");
                    oTableContainer.setVisible(false);
                    oMoreButton.setText("More");
                } else {

                    oDialog.setContentWidth("90%");
                    oDialog.setContentHeight("75%");
                    oTableContainer.setVisible(true);
                    oMoreButton.setText("Less");


                    $.ajax({
                        url: "/VIC_UI_DEV/imageDetail/latest-comparison-status",
                        method: "GET",
                        success: function (data) {
                            debugger

                            var oModel = new sap.ui.model.json.JSONModel({ tableData: data });
                            sap.ui.getCore().setModel(oModel, "comparisonModel");

                            var oTable = sap.ui.getCore().byId("compareTable1");
                            oTable.setModel(oModel, "comparisonModel");

                        },
                        error: function (err) {
                            sap.m.MessageToast.show("Failed to fetch data");
                            console.error("GET failed", err);
                        }
                    });
                }
            }



        });
    });
