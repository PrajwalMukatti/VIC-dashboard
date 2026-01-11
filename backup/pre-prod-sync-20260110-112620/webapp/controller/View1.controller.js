sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "./BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/ui/core/routing/History",
    "sap/m/BusyDialog",
    "sap/ui/model/json/JSONModel",
    "sap/m/Token",
    "vicstartintegration/util/formatter",
    "vicstartintegration/util/LogTblPersoService",
    "sap/m/TablePersoController",
    "sap/m/library",
    "sap/viz/ui5/controls/VizFrame",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/controls/common/feeds/FeedItem",
    "sap/ui/export/library",
    "sap/ui/export/Spreadsheet",
    "sap/m/MessageItem",
    "sap/m/MessageView",
    "sap/m/Popover"
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
                console.log("[VIC webapp View1] onInit activated");
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

            // Pre-attach an empty 'mock' model so FilterBar item bindings can resolve before async data loads
            var oMockInit = new JSONModel({
                ChartDataFull: [],
                FilteredFull: [],
                FilteredFullBase: [],
                ChartData: [],
                PieChartData: [],
                TrendData: [],
                TrendVersions: [],
                TrendWindow: null,
                Selections: { TestType: [], ProductArea: [], TestPlan: [], UiVersion: [], Release: [], Similarity: [], DateFrom: null, DateTo: null },
                // Pre-populate lists with "Select All" so controls have initial items before async data arrives
                TestTypes: [{ key: "ALL", text: "Select All" }],
                ProductAreas: [{ key: "ALL", text: "Select All" }],
                Releases: [{ key: "ALL", text: "Select All" }],
                UiVersions: [{ key: "ALL", text: "Select All" }],
                TestPlans: [{ key: "ALL", text: "Select All" }]
            });
            try { oMockInit.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay); oMockInit.setSizeLimit(10000); } catch (eBM3) {}
            this.getView().setModel(oMockInit, "mock");
            try {
                sap.ui.getCore().setModel(oMockInit, "mock");
                var fb = this.getView().byId("idFilterBar");
                if (fb && fb.setModel) { fb.setModel(oMockInit, "mock"); }
                this._ensureFilterItemsPopulated();
                this._syncFilterBarModel();
            } catch (eInitMock) {}

            // Ensure chart dataset/feeds are applied after initial render
            this.getView().attachAfterRendering(function () {
                try {
                    var sType = that.getView().getModel("state").getProperty("/chartType") || "column";
                    that._applyChartConfig(sType);
                    var oViz = that.byId("mainViz");
                    var oPopOver = that.byId("idPopOver");
                    if (oPopOver && oViz) { oPopOver.connect(oViz.getVizUid()); }

                    var oModeSel = that.byId("chartModeSelect");
                    var oTypeSel = that.byId("chartTypeSelect");
                    var sMode = that.getView().getModel("state").getProperty("/chartMode") || "similarity";
                    var sTypeKey = that.getView().getModel("state").getProperty("/chartType") || "column";
                    if (oModeSel) { oModeSel.setSelectedKey(sMode); oModeSel.setEnabled(true); }
                    if (oTypeSel) { oTypeSel.setSelectedKey(sTypeKey); oTypeSel.setEnabled(sMode === "trend" ? false : true); }
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
                    res = that._normalizeArray(res);
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
                    try { oChartModel.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay); oChartModel.setSizeLimit(10000); } catch (eBM4) {}
                    that.getView().setModel(oChartModel, "mock");

                    that._updatePieChartData(res);

                    that._applyChartConfig(oStateModel.getProperty("/chartType") || "column");

                    // Build 'mock' model lists and selections
                    try {
                        var aFull = (res || []).map(function (r) {
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
                        try { oMock.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay); oMock.setSizeLimit(10000); } catch (eBM5) {}
                        that.getView().setModel(oMock, "mock");
                        try { sap.ui.getCore().setModel(oMock, "mock"); } catch (eCore) {}
                        that._rebuildSelectorLists();
                        that._updatePieChartData(aFull);
                        that._applyChartConfig(that.getView().getModel("state").getProperty("/chartType") || "column");
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
                                        var sArea = sAreaRaw.split(/\s+/).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }).join(" ");
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
                    var msimilaritypercent = new JSONModel();
                    res = that._normalizeArray(res);
                    res = that._markBestEntries(res);
                    msimilaritypercent.setData(res);
                    that.getView().byId("idTblTitle").setText("Test Plans (" + res.length + ")");
                    that.getView().setModel(msimilaritypercent, "msimilaritypercent");

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
                    { testPlanName: "S4PUC_2602_INF_1130X_UOQX_SD", ProductArea: "SALES", TestType: "UI5 DRT", percentSuccess: 97.4, executeOn: "2025-09-20" },
                    { testPlanName: "S4PUC_2602_INF_1130X_UOQX_FIN", ProductArea: "FIN", TestType: "UI5 DRT", percentSuccess: 98.6, executeOn: "2025-09-21" },
                    { testPlanName: "S4PUC_2602_INF_1131X_UOQ_QM", ProductArea: "PROCURE", TestType: "UI5 DRT", percentSuccess: 99.1, executeOn: "2025-09-22" },
                    { testPlanName: "S4PUC_2602_INF_1131X_UOQX_PP", ProductArea: "PRODUCE", TestType: "UI5 DRT", percentSuccess: 100, executeOn: "2025-09-18" },
                    { testPlanName: "S4PU_2602_INF_1130X_UOQX_HR", ProductArea: "MASTER DATA", TestType: "UI5 DRT", percentSuccess: 96.2, executeOn: "2025-09-18" },
                    { testPlanName: "S4PUC_2602_INF_1131X_UOQX_EAM", ProductArea: "PRODUCE", TestType: "UI5 DRT", percentSuccess: 98.2, executeOn: "2025-09-17" },
                    { testPlanName: "S4PUC_2602_INF_1131X_UOQX_SERV", ProductArea: "SERVICES", TestType: "UI5 DRT", percentSuccess: 97.9, executeOn: "2025-09-16" },
                    { testPlanName: "S4PUC_2508_INF_1128X_UOQX_SD", ProductArea: "SALES", TestType: "UI5 DRT", percentSuccess: 94.2, executeOn: "2025-08-28" },
                    { testPlanName: "S4PUC_2508_INF_1129X_UOQX_FIN", ProductArea: "FIN", TestType: "UI5 DRT", percentSuccess: 96.7, executeOn: "2025-08-27" },
                    { testPlanName: "S4PUC_2508_INF_1129X_UOQX_MM", ProductArea: "PROCURE", TestType: "UI5 DRT", percentSuccess: 93.8, executeOn: "2025-08-26" },
                    { testPlanName: "S4PUC_2508_INF_1128X_UOQX_QM", ProductArea: "PROCURE", TestType: "UI5 DRT", percentSuccess: 97.3, executeOn: "2025-08-25" },
                    { testPlanName: "S4PUC_2508_INF_1129X_UOQX_PP", ProductArea: "PRODUCE", TestType: "UI5 DRT", percentSuccess: 98.9, execute: "2025-08-24" },
                    { testPlanName: "S4PUC_2508_INF_1128X_UOQX_EAM", ProductArea: "PRODUCE", TestType: "UI5 DRT", percentSuccess: 97.6, executeOn: "2025-08-23" },
                    { testPlanName: "S4PUC_2508_INF_1129X_UOQX_SERV", ProductArea: "SERVICES", TestType: "UI5 DRT", percentSuccess: 95.1, executeOn: "2025-08-22" },
                    { testPlanName: "S4PUC_2508_INF_1128X_UOQX_HR", ProductArea: "MASTER DATA", TestType: "UI5 DRT", percentSuccess: 92.7, executeOn: "2025-08-21" }
                ];

                // ensure table rows carry UiVersion and Release for proper filtering
                try {
                    res.forEach(function (r) {
                        r.UiVersion = r.UiVersion || that.getUiVersion(r.testPlanName);
                        r.Release = r.Release || that.getRelease(r.testPlanName);
                    });
                } catch (eVerRel) {}

                res = that._normalizeArray(res);
                res = that._markBestEntries(res);
                var oTblModel = new JSONModel(res);
                that.getView().setModel(oTblModel, "msimilaritypercent");
                that.byId("idTblTitle").setText("Test Plans (" + res.length + ")");

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

                var oMock = that.getView().getModel("mock");
                if (!oMock) { oMock = new JSONModel({}); }
                oMock.setProperty("/ChartDataFull", aFull.slice(0));
                oMock.setProperty("/FilteredFull", aFull.slice(0));
                oMock.setProperty("/FilteredFullBase", aFull.slice(0));
                oMock.setProperty("/Selections", { TestType: [], ProductArea: [], TestPlan: [], UiVersion: [], Release: [], Similarity: [], DateFrom: null, DateTo: null });

                var chartAgg = that._buildAggregatedChartData(res);
                oMock.setProperty("/ChartData", chartAgg);
                that._updatePieChartData(res);

                that.getView().setModel(oMock, "mock");
                try { sap.ui.getCore().setModel(oMock, "mock"); } catch (eCore) {}
                that._syncFilterBarModel();
                that._rebuildSelectorLists();

                try { that.onFBGoPress(); } catch (e) {}
                var sType = that.getView().getModel("state").getProperty("/chartType") || "column";
                that._applyChartConfig(sType);
            } catch (e) {
                if (console && console.error) console.error("Fallback init failed", e);
            }
        },

        _initLocalFallback: function () {
            var that = this;
            try {
                $.getJSON("localService/testplans.json?t=" + Date.now())
                    .done(function (res) {
                        try { that._handleTestPlanResponse(res); } catch (e) { /* ignore */ }
                    })
                    .fail(function () {
                        // No mock fallback; keep UI state unchanged
                    });
            } catch (e) {
                // swallow
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
                a = that._normalizeArray(a);
                a = that._markBestEntries(a);

                var oTblModel = new JSONModel(a);
                that.getView().setModel(oTblModel, "msimilaritypercent");
                that.byId("idTblTitle").setText("Test Plans (" + a.length + ")");

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

                var chartAgg = that._buildAggregatedChartData(a);
                var oChartModel = that.getView().getModel("mock");
                if (!oChartModel) { oChartModel = new JSONModel({ ChartData: chartAgg }); }
                else { oChartModel.setProperty("/ChartData", chartAgg); }
                that.getView().setModel(oChartModel, "mock");
                try { sap.ui.getCore().setModel(oChartModel, "mock"); } catch (eCore) {}
                that._syncFilterBarModel();
                that._updatePieChartData(a);
                that._applyChartConfig(that.getView().getModel("state").getProperty("/chartType") || "column");

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
                if (val < 96) bucket = "<96%";
                else if (val < 98) bucket = "96%-98%";
                else if (val < 100) bucket = "98%-99%";
                else bucket = "100%";

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

                var _typeSel = this.byId("chartTypeSelect");
                if (_typeSel) { _typeSel.setSelectedKey("line"); _typeSel.setEnabled(false); }
                var _modeSel = this.byId("chartModeSelect");
                if (_modeSel) { _modeSel.setSelectedKey("trend"); _modeSel.setEnabled(true); }
                return;
            }

            if (sChartType === "pie" || sChartType === "donut") {
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
                var oDataset = new sap.viz.ui5.data.FlattenedDataset({
                    data: { path: "mock>/ChartData" },
                    dimensions: [
                        { name: "Product Area", value: "{mock>ProductArea}" }
                    ],
                    measures: [
                        { name: "Sim 100", value: "{mock>Sim100}" },
                        { name: "Sim 99", value: "{mock>Sim99}" },
                        { name: "Sim Less", value: "{mock>SimLess}" }
                    ]
                });
                oViz.setDataset(oDataset);

                oViz.addFeed(new sap.viz.ui5.controls.common.feeds.FeedItem({
                    uid: "valueAxis", type: "Measure", values: ["Sim 100", "Sim 99", "Sim Less"]
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

        onToggleDataLabels: function () {
            var b = this.getView().getModel("state").getProperty("/chartLabels") === true;
            this.getView().getModel("state").setProperty("/chartLabels", !b);
            this._applyChartConfig(this.getView().getModel("state").getProperty("/chartType") || "column");
        },

        onToggleLegend: function () {
            var oState = this.getView().getModel("state");
            var b = oState && oState.getProperty("/legend") === true;
            if (oState) { oState.setProperty("/legend", !b); }
            var oViz = this.byId("mainViz");
            if (oViz) {
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

        onToggleFullScreen: function () {
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
                            contentMiddle: [new sap.m.Title({ text: "Chart - Full Screen" })],
                            contentRight: [new sap.m.Button({
                                icon: "sap-icon://decline",
                                tooltip: "Close",
                                press: function () {
                                    try { that._oFullDlg.close(); } finally { that._exitChartFullScreen(); }
                                }
                            })]
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

        onChartSelect: function () {
            var oVizFrame = this.byId("mainViz");
            var oPopOver = this.byId("idPopOver");
            if (!oPopOver._vizFrame) {
                oPopOver.connect(oVizFrame.getVizUid());
            }
        },

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
                testplan: encodeURIComponent(sCategory || ""),
                productarea: encodeURIComponent(sProductArea || ""),
                executedon: ""
            });

            this._oPopover && this._oPopover.close();
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

        getTestType: function () {
            return "UI5 DRT";
        },

        getProductArea: function (testPlanName) {
            try {
                var parts = String(testPlanName || "").split("_");
                var code = (parts[parts.length - 1] || "").toUpperCase();
                var map = {
                    SD: "SALES",
                    FIN: "FIN",
                    MM: "PROCURE",
                    QM: "PROCURE",
                    PP: "PRODUCE",
                    EAM: "PRODUCE",
                    SERV: "SERVICES",
                    HR: "MASTER DATA"
                };
                return map[code] || "UNKNOWN";
            } catch (e) {
                return "UNKNOWN";
            }
        },

        getRelease: function (testPlanName) {
            try {
                var parts = String(testPlanName || "").split("_");
                return parts.length > 1 ? parts[1] : "";
            } catch (e) { return ""; }
        },

        getUiVersion: function (testPlanName) {
            try {
                var txt = String(testPlanName || "");
                var parts = txt.split("_");

                var infIdx = parts.indexOf("INF");
                if (infIdx >= 0 && parts[infIdx + 1]) {
                    var mAfterInf = parts[infIdx + 1].match(/^(\d+)(?:X)?$/i);
                    if (mAfterInf && mAfterInf[1]) {
                        return mAfterInf[1];
                    }
                }

                for (var i = 0; i < parts.length; i++) {
                    var mx = parts[i].match(/^(\d+)X$/i);
                    if (mx && mx[1]) {
                        return mx[1];
                    }
                }
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

        onTestPlanVH: function () {
            var oView = this.getView();
            if (!this._TestPlanDialog) {
                this._TestPlanDialog = sap.ui.xmlfragment("vicstartintegration.view.fragment.TestPlanVHDialog", this);
                this._TestPlanDialog.addStyleClass("sapUiSizeCompact");
                oView.addDependent(this._TestPlanDialog);
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
            var oFilter = new Filter("testPlanName", FilterOperator.Contains, sValue);
            evt.getSource().getBinding("items").filter([oFilter]);
        },

        TestPlanVHClose: function (evt) {
            var aSelectedItems = evt.getParameter("selectedItems"),
                aSelectedContexts = evt.getParameter("selectedContexts"),
                oMultiInput = this.byId("idMInpTestPlan");
            oMultiInput.removeAllTokens();

            if (aSelectedItems && aSelectedItems.length > 0) {
                for (var j = 0; j < aSelectedItems.length; j++) {
                    oMultiInput.addToken(new Token({ text: aSelectedItems[j].getTitle() }));
                }
            } else if (aSelectedContexts && aSelectedContexts.length > 0) {
                for (var k = 0; k < aSelectedContexts.length; k++) {
                    oMultiInput.addToken(new Token({ text: aSelectedContexts[k].getObject().testPlanName }));
                }
            }
        },

        // Helper: build composite AND filter from current selections
        _buildFiltersFromSelections: function (sel) {
            function normArr(a) { return Array.isArray(a) ? a.filter(function (k) { return k !== "ALL"; }) : []; }
            var aAndFilter = [];

            var aTypes = normArr(sel && sel.TestType);
            if (aTypes.length) {
                aAndFilter.push(new Filter(aTypes.map(function (k) { return new Filter("TestType", FilterOperator.EQ, String(k)); }), false));
            }
            var aAreas = normArr(sel && sel.ProductArea);
            if (aAreas.length) {
                aAndFilter.push(new Filter(aAreas.map(function (k) { return new Filter("ProductArea", FilterOperator.EQ, String(k)); }), false));
            }
            var aPlans = normArr(sel && sel.TestPlan);
            if (aPlans.length) {
                aAndFilter.push(new Filter(aPlans.map(function (k) { return new Filter("testPlanName", FilterOperator.EQ, String(k)); }), false));
            }
            var aVers = normArr(sel && sel.UiVersion).map(String);
            if (aVers.length) {
                aAndFilter.push(new Filter(aVers.map(function (k) { return new Filter("UiVersion", FilterOperator.EQ, String(k)); }), false));
            }
            var aRel = normArr(sel && sel.Release).map(String);
            if (aRel.length) {
                aAndFilter.push(new Filter(aRel.map(function (k) { return new Filter("Release", FilterOperator.EQ, String(k)); }), false));
            }
            var aSim = normArr(sel && sel.Similarity);
            if (aSim.length) {
                var simGroup = [];
                aSim.forEach(function (key) {
                    var m = String(key).match(/^lt(\d+)$/);
                    if (m) {
                        simGroup.push(new Filter("percentSuccess", FilterOperator.LT, Number(m[1])));
                    }
                });
                if (simGroup.length) {
                    aAndFilter.push(new Filter(simGroup, false));
                }
            }
            // search field OR group
            var sSrchValue = "";
            try { sSrchValue = (this.getView().byId("idSearchField").getValue() || "").trim(); } catch (e) {}
            if (sSrchValue) {
                aAndFilter.push(new Filter([
                    new Filter("testPlanName", FilterOperator.Contains, sSrchValue),
                    new Filter("ProductArea", FilterOperator.Contains, sSrchValue),
                    new Filter("TestType", FilterOperator.Contains, sSrchValue)
                ], false));
            }

            return aAndFilter.length ? new Filter(aAndFilter, true) : null;
        },

        // Apply filters to table and update charts/lists
        onFBGoPress: function () {
            var oView = this.getView();
            var oTable = oView.byId("idTblTestPlan");
            var oBinding = oTable.getBinding("items");
            if (!oBinding) { return; }

            var oMock = this.getView().getModel("mock");
            var sel = (oMock && oMock.getProperty("/Selections")) || {};
            var composite = this._buildFiltersFromSelections(sel);

            if (composite) {
                oBinding.filter([composite]);
            } else {
                oBinding.filter([]);
            }
            oView.byId("idTblTitle").setText("Test Plans (" + oBinding.getLength() + ")");
            this._applyFilterModels();
            this._ensureFilterItemsPopulated();
            this._syncMultiComboSelections();
        },

        onFBClearPress: function () {
            var oSearchField = this.getView().byId("idSearchField");
            if (oSearchField) oSearchField.setValue("");

            var oMock = this.getView().getModel("mock");
            if (oMock) {
                oMock.setProperty("/Selections", { TestType: [], ProductArea: [], TestPlan: [], UiVersion: [], Release: [], Similarity: [], DateFrom: null, DateTo: null });
            }
            var ids = ["testTypeSelect", "productAreaSelect", "testPlanSelect", "uiVersionSelect", "releaseSelect", "similaritySelect"];
            for (var i = 0; i < ids.length; i++) {
                var c = this.getView().byId(ids[i]);
                if (c && c.setSelectedKeys) c.setSelectedKeys([]);
            }

            var oTable = this.getView().byId("idTblTestPlan");
            var oBinding = oTable.getBinding("items");
            if (oBinding) oBinding.filter([]);
            this.getView().byId("idTblTitle").setText("Test Plans (" + (oBinding ? oBinding.getLength() : 0) + ")");
            this._rebuildSelectorLists();
            this._applyFilterModels();
            this._ensureFilterItemsPopulated();
            this._syncMultiComboSelections();
        },

        onFBResetPress: function () {
            var oView = this.getView();
            oView.byId("idSearchField").setValue("");
            var oMock = this.getView().getModel("mock");
            if (oMock) {
                oMock.setProperty("/Selections", { TestType: [], ProductArea: [], TestPlan: [], UiVersion: [], Release: [], Similarity: [], DateFrom: null, DateTo: null });
            }
            ["testTypeSelect", "productAreaSelect", "testPlanSelect", "uiVersionSelect", "releaseSelect", "similaritySelect"].forEach(function (id) {
                var c = oView.byId(id);
                if (c && c.setSelectedKeys) { c.setSelectedKeys([]); }
            });
            var oTable = oView.byId("idTblTestPlan");
            var oBinding = oTable.getBinding("items");
            if (oBinding) {
                oBinding.filter([]);
                oView.byId("idTblTitle").setText("Test Plans (" + oBinding.getLength() + ")");
            }
            this._rebuildSelectorLists();
            this._applyFilterModels();
            this._ensureFilterItemsPopulated();
            this._syncMultiComboSelections();
        },

        onFiltersChanged: function () {
            try { this._applyFilterModels(); } catch (e) {}
            try { this._ensureFilterItemsPopulated(); this._syncMultiComboSelections(); } catch (e2) {}
        },

        onTblUpdateFinished: function () {
            try { this._applyFilterModels(); } catch (e) {}
            try { this._ensureFilterItemsPopulated(); this._syncMultiComboSelections(); } catch (e2) {}
        },

        // Normalize row to consistent types for filtering across selections
        _normalizeRow: function (r) {
            var that = this;
            var tp = (r && r.TestType !== undefined) ? r.TestType : that.getTestType(r && r.testPlanName);
            var pa = (r && r.ProductArea !== undefined) ? r.ProductArea : that.getProductArea(r && r.testPlanName);
            var rel = (r && r.Release !== undefined) ? r.Release : that.getRelease(r && r.testPlanName);
            var ver = (r && r.UiVersion !== undefined) ? r.UiVersion : that.getUiVersion(r && r.testPlanName);
            r.TestType = String(tp || "").trim();
            r.ProductArea = String(pa || "").trim();
            r.Release = String(rel || "").trim();
            r.UiVersion = String(ver || "").trim();
            r.testPlanName = String(r.testPlanName || "").trim();
            r.percentSuccess = Number(r.percentSuccess || 0);
            return r;
        },

        _normalizeArray: function (a) {
            var that = this;
            return (a || []).map(function (r) { return that._normalizeRow(r); });
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

            var seenPlans = {};
            var aTestPlan = [];
            (current || []).forEach(function (r) {
                if (r && r.testPlanName && !seenPlans[r.testPlanName]) {
                    seenPlans[r.testPlanName] = true;
                    aTestPlan.push({ testPlanName: r.testPlanName });
                }
            });
            oView.setModel(new JSONModel(aTestPlan), "mTestPlan");

            var seenAreas = {};
            var seenTypes = {};
            var aProdArea = [];
            var aTesScp = [];
            (current || []).forEach(function (r) {
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

            this._rebuildChartModels(current);
        },

        _rebuildChartModels: function (aRows) {
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

            var trend = [];
            try {
                var that = this;

                function verNum(label) {
                    try {
                        var m = String(label || "").match(/\d+/);
                        return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
                    } catch (e) { return Number.MAX_SAFE_INTEGER; }
                }

                var oSel = (oChartModel && oChartModel.getProperty("/Selections")) || {};
                function arr(a) { return Array.isArray(a) ? a.filter(function (k) { return k !== "ALL"; }) : []; }
                function nstr(s) { return s === null || s === undefined ? "" : String(s).trim(); }

                var baseRows = (oChartModel && (oChartModel.getProperty("/FilteredFullBase") || oChartModel.getProperty("/ChartDataFull"))) || [];
                var aSelAreas = arr(oSel.ProductArea);
                var aSelTypes = arr(oSel.TestType);
                var aSelPlans = arr(oSel.TestPlan);
                var aSelVers = arr(oSel.UiVersion);
                var aSelSim = arr(oSel.Similarity);

                function passSimilarity(val) {
                    if (!aSelSim.length) return true;
                    for (var i = 0; i < aSelSim.length; i++) {
                        var m = String(aSelSim[i]).match(/^lt(\d+)$/);
                        if (m) { if (Number(val) < Number(m[1])) return true; }
                    }
                    return false;
                }

                var baseFiltered = (baseRows || []).filter(function (r) {
                    var area = nstr(r && r.ProductArea);
                    var type = nstr(r && r.TestType);
                    var plan = nstr(r && r.TestPlan);
                    var ver = nstr(r && (r.UiVersion || that.getUiVersion(r.testPlanName || r.TestPlan || "")));
                    var ok = true;
                    if (aSelAreas.length && aSelAreas.indexOf(area) === -1) ok = false;
                    if (ok && aSelTypes.length && aSelTypes.indexOf(type) === -1) ok = false;
                    if (ok && aSelPlans.length && aSelPlans.indexOf(plan) === -1) ok = false;
                    if (ok && aSelVers.length && aSelVers.indexOf(ver) === -1) ok = false;
                    var simVal = (r && (r.SimilarityPercent !== undefined ? r.SimilarityPercent : r.percentSuccess));
                    if (ok && !passSimilarity(Number(simVal))) ok = false;
                    return ok;
                });

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
                var _win = oChartModel.getProperty("/TrendWindow");
                if (!_win || typeof _win.startIndex !== "number" || typeof _win.endIndex !== "number") {
                    _win = { startIndex: 0, endIndex: Math.max(0, _versions.length - 1) };
                    oChartModel.setProperty("/TrendWindow", _win);
                }
                var _allow = {};
                for (var _j = _win.startIndex; _j <= _win.endIndex && _j < _versions.length; _j++) { _allow[_versions[_j]] = true; }
                var _windowed = _normalized.filter(function (p) { return !!_allow[p.UiVersionLabel]; });
                oChartModel.setProperty("/TrendData", _windowed);
            }

            this._updatePieChartData(aRows || []);
            if (oChartModel && oChartModel.refresh) { oChartModel.refresh(true); }
        },

        // Synchronize MultiComboBox UI with current Selections
        _syncMultiComboSelections: function () {
            try {
                var v = this.getView();
                var oMock = v.getModel("mock");
                if (!oMock) { return; }
                function arr(a) { return Array.isArray(a) ? a.filter(function (k) { return k !== "ALL"; }) : []; }
                var map = {
                    "testTypeSelect": "/Selections/TestType",
                    "productAreaSelect": "/Selections/ProductArea",
                    "releaseSelect": "/Selections/Release",
                    "uiVersionSelect": "/Selections/UiVersion",
                    "testPlanSelect": "/Selections/TestPlan",
                    "similaritySelect": "/Selections/Similarity"
                };
                Object.keys(map).forEach(function (id) {
                    var c = v.byId(id);
                    var keys = arr(oMock.getProperty(map[id] || "")).map(String);
                    if (c && c.setSelectedKeys) { c.setSelectedKeys(keys); }
                });
            } catch (e) { /* no-op */ }
        },

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
                expandAll("/TestTypes");
                sel.TestType = aKeys;
            } else if (sId.indexOf("productAreaSelect") !== -1) {
                expandAll("/ProductAreas");
                sel.ProductArea = aKeys;
            } else if (sId.indexOf("testPlanSelect") !== -1) {
                expandAll("/TestPlans");
                sel.TestPlan = aKeys;
            } else if (sId.indexOf("uiVersionSelect") !== -1) {
                expandAll("/UiVersions");
                sel.UiVersion = aKeys.map(String);
            } else if (sId.indexOf("releaseSelect") !== -1) {
                expandAll("/Releases");
                sel.Release = aKeys.map(String);
            } else if (sId.indexOf("similaritySelect") !== -1) {
                expandAll(null, ["lt96", "lt97", "lt98", "lt99", "lt100"]);
                sel.Similarity = aKeys;
            }

            oMock.setProperty("/Selections", sel);
            this._rebuildSelectorLists();
            try { this.onFBGoPress(); } catch (e) {}
        },

        _rebuildSelectorLists: function () {
            var oMock = this.getView().getModel("mock");
            if (!oMock) return;
            var aFull = oMock.getProperty("/ChartDataFull") || [];
            var sel = oMock.getProperty("/Selections") || {};

            function n(s) { return s === null || s === undefined ? "" : String(s).trim(); }
            function arr(a) { return Array.isArray(a) ? a.filter(function (k) { return k !== "ALL"; }) : []; }

            var aTypesSel = arr(sel.TestType);
            var aAreasSel = arr(sel.ProductArea);
            var aRelSel = arr(sel.Release).map(String);
            var aVersSel = arr(sel.UiVersion).map(String);
            var aSimSel = arr(sel.Similarity);

            function passSimilarity(val) {
                if (!aSimSel.length) return true;
                for (var i = 0; i < aSimSel.length; i++) {
                    var m = String(aSimSel[i]).match(/^lt(\d+)$/);
                    if (m) { if (Number(val) < Number(m[1])) return true; }
                }
                return false;
            }

            var base = (aFull || []).filter(function (r) {
                var t = n(r.TestType);
                var pa = n(r.ProductArea);
                var rel = n(r.Release);
                var v = n(r.UiVersion);
                var sim = (r.SimilarityPercent !== undefined ? r.SimilarityPercent : r.percentSuccess);

                if (aTypesSel.length && aTypesSel.indexOf(t) === -1) return false;
                if (aAreasSel.length && aAreasSel.indexOf(pa) === -1) return false;
                if (aRelSel.length && aRelSel.indexOf(String(rel)) === -1) return false;
                if (aVersSel.length && aVersSel.indexOf(String(v)) === -1) return false;
                if (!passSimilarity(Number(sim))) return false;
                return true;
            });

            function withAll(arrOut) { return [{ key: "ALL", text: "Select All" }].concat(arrOut); }
            function numSort(a, b) { return (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0); }

            var mTypes = {}, mAreas = {}, mRel = {}, mVers = {}, mPlans = {};
            base.forEach(function (r) {
                var t = n(r.TestType); if (t) mTypes[t] = true;
                var a = n(r.ProductArea); if (a) mAreas[a] = true;
                var rel = String(n(r.Release)); if (rel) mRel[rel] = true;
                var v = String(n(r.UiVersion)); if (v) mVers[v] = true;
                var p = n(r.TestPlan); if (p) mPlans[p] = true;
            });

            var aTypes = Object.keys(mTypes).sort().map(function (k) { return { key: k, text: k }; });
            var aAreas = Object.keys(mAreas).sort().map(function (k) { return { key: k, text: k }; });
            var aRel = Object.keys(mRel).sort(numSort).map(function (k) { return { key: k, text: k }; });
            var aVers = Object.keys(mVers).sort(numSort).map(function (k) { return { key: k, text: k }; });
            var aPlans = Object.keys(mPlans).sort().map(function (k) { return { key: k, text: k }; });

            var relSet = {};
            aRel.forEach(function (it) { relSet[it.key] = true; });
            var aVersFiltered = aVers.filter(function (it) { return !relSet[it.key]; });

            oMock.setProperty("/TestTypes", withAll(aTypes));
            oMock.setProperty("/ProductAreas", withAll(aAreas));
            oMock.setProperty("/Releases", [{ key: "ALL", text: "Select All" }].concat(aRel));
            oMock.setProperty("/UiVersions", [{ key: "ALL", text: "Select All" }].concat(aVersFiltered));
            oMock.setProperty("/TestPlans", withAll(aPlans));

            function prune(selArr, list) {
                var keys = (selArr || []).filter(function (k) { return k !== "ALL"; });
                if (!keys.length) return selArr;
                var set = {};
                (list || []).forEach(function (it) { set[it.key] = true; });
                var valid = keys.filter(function (k) { return !!set[String(k)]; });
                return valid;
            }
            var newSel = {
                TestType: prune(sel.TestType, aTypes),
                ProductArea: prune(sel.ProductArea, aAreas),
                Release: prune(sel.Release, aRel).map(String),
                UiVersion: prune(sel.UiVersion, aVersFiltered).map(String),
                Similarity: arr(sel.Similarity),
                TestPlan: prune(sel.TestPlan, aPlans)
            };
            oMock.setProperty("/Selections", newSel);

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
            } catch (e2) {}
            // force-populate items from mock model to avoid binding timing issues
            this._populateComboBoxItems();
            // ensure UI chips reflect current selections
            this._syncMultiComboSelections();
            this._ensureFilterItemsPopulated();
        },

        _syncFilterBarModel: function () {
            try {
                var fb = this.getView().byId("idFilterBar");
                var m = this.getView().getModel("mock");
                if (fb && m) {
                    fb.setModel(m, "mock");
                }
            } catch (e) { /* no-op */ }
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
                        if (c.setModel) { c.setModel(oMock, "mock"); }
                        if (c.bindAggregation) {
                            c.bindAggregation("items", {
                                path: "mock>" + d.path,
                                template: new sap.ui.core.Item({ key: "{mock>key}", text: "{mock>text}" }),
                                templateShareable: false
                            });
                        }
                    } else {
                        try {
                            if (c.getItems && c.getItems().length === 0) {
                                c.addItem(new sap.ui.core.Item({ key: "ALL", text: "Select All" }));
                                c.addItem(new sap.ui.core.Item({ key: "lt96", text: "Less than 96%" }));
                                c.addItem(new sap.ui.core.Item({ key: "lt97", text: "Less than 97%" }));
                                c.addItem(new sap.ui.core.Item({ key: "lt98", text: "Less than 98%" }));
                                c.addItem(new sap.ui.core.Item({ key: "lt99", text: "Less than 99%" }));
                                c.addItem(new sap.ui.core.Item({ key: "lt100", text: "Less than 100%" }));
                            }
                        } catch (eSim) { /* no-op */ }
                    }
                });
                this._syncMultiComboSelections();
            } catch (e) { /* no-op */ }
        },
 
        // Programmatic population of MultiComboBox items from mock model
        _populateComboBoxItems: function () {
            try {
                var v = this.getView();
                var oMock = v.getModel("mock");
                if (!oMock) { return; }
                var defs = [
                    { id: "testTypeSelect", path: "/TestTypes" },
                    { id: "productAreaSelect", path: "/ProductAreas" },
                    { id: "releaseSelect", path: "/Releases" },
                    { id: "uiVersionSelect", path: "/UiVersions" },
                    { id: "testPlanSelect", path: "/TestPlans" }
                ];
                defs.forEach(function (d) {
                    var c = v.byId(d.id);
                    var a = oMock.getProperty(d.path) || [];
                    if (c && c.removeAllItems && Array.isArray(a)) {
                        c.removeAllItems();
                        a.forEach(function (it) {
                            c.addItem(new sap.ui.core.Item({ key: String(it.key), text: String(it.text) }));
                        });
                    }
                });
                // Similarity static items
                var s = v.byId("similaritySelect");
                if (s && s.getItems && s.getItems().length === 0) {
                    s.addItem(new sap.ui.core.Item({ key: "ALL", text: "Select All" }));
                    s.addItem(new sap.ui.core.Item({ key: "lt96", text: "Less than 96%" }));
                    s.addItem(new sap.ui.core.Item({ key: "lt97", text: "Less than 97%" }));
                    s.addItem(new sap.ui.core.Item({ key: "lt98", text: "Less than 98%" }));
                    s.addItem(new sap.ui.core.Item({ key: "lt99", text: "Less than 99%" }));
                    s.addItem(new sap.ui.core.Item({ key: "lt100", text: "Less than 100%" }));
                }
                // diagnostics
                try {
                    var logIds = ["testTypeSelect","productAreaSelect","releaseSelect","uiVersionSelect","testPlanSelect","similaritySelect"];
                    logIds.forEach(function(id){
                        var c = v.byId(id);
                        var count = c && c.getItems ? c.getItems().length : -1;
                        console.log("[VIC webapp View1] items count for", id, "=", count);
                    });
                } catch (eLog) {}
            } catch (e) { /* no-op */ }
        },
 
        onExport: function () {
            var aCols, oRowBinding, oSettings, oSheet, oTable;

            if (!this._oTable) {
                this._oTable = this.byId("idTblTestPlan");
            }

            oTable = this._oTable;
            var aTableFilterData = [];
            var aIndices = oTable.getBinding("items").aIndices;
            var aTableFullData = oTable.getBinding("items").oList;
            for (var i = 0; i < aIndices.length; i++) {
                aTableFilterData.push(aTableFullData[aIndices[i]]);
            }
            var mTempExportData = new JSONModel(aTableFilterData);
            oRowBinding = mTempExportData.getProperty("/");
            aCols = this.createColumnConfig();

            oSettings = {
                workbook: {
                    columns: aCols
                },
                dataSource: oRowBinding,
                fileName: "VIC test plan Results.xlsx"
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
                label: "Test Plan Name",
                property: "testPlanName",
                type: EdmType.String
            });

            aCols.push({
                label: "Compared On ",
                property: "executeOn",
                type: EdmType.String
            });

            aCols.push({
                label: "Similarity %",
                type: EdmType.String,
                property: "percentSuccess"
            });

            aCols.push({
                label: "Product Area",
                type: EdmType.String,
                property: "ProductArea"
            });

            aCols.push({
                label: "Test Type",
                type: EdmType.String,
                property: "TestType"
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
            var sPath = mParams.sortItem && mParams.sortItem.getKey();
            var bDescending = mParams.sortDescending;

            if (!sPath) {
                sap.m.MessageToast.show("Please select a column to sort.");
                return;
            }

            var sFormattedPath = sPath.replace(/([a-z])([A-Z])/g, "$1 $2");
            sFormattedPath = sFormattedPath.charAt(0).toUpperCase() + sFormattedPath.slice(1);

            var oTable = this.byId("idTblTestPlan");
            var oBinding = oTable.getBinding("items");
            var aSorters = [];
            aSorters.push(new sap.ui.model.Sorter(sPath, bDescending));
            oBinding.sort(aSorters);

            sap.m.MessageToast.show("Sorted by " + sFormattedPath + " in " + (bDescending ? "descending" : "ascending") + " order.");
        },

        onLogsRefresh: function () {
            try { this.onFBGoPress(); } catch (e) {}
        },

        onPersoButtonPressed: function () {
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
                error: function () {
                    sap.m.MessageToast.show("Failed to load data from image comparator service.");
                }
            });
        },

        oCompareClosePress: function () {
            sap.ui.getCore().byId("oCompareUI5VersionBtn").setEnabled(false);
            this.oCompareView.destroy(true);
            this.oCompareView = null;
        },

        onTestImgValueHelp: function () {
            sap.ui.getCore().byId("testImgInput").setValue("");
            sap.ui.getCore().byId("oCompareUI5VersionBtn").setEnabled(false);

            this.oTestImageCompareView = new sap.ui.xmlfragment("vicstartintegration.view.fragment.TestImageCompareView", this);
            this.getView().addDependent(this.oTestImageCompareView);
            this.oTestImageCompareView.open();
        },

        onTestImgDialogClose: function () {
            this.oTestImageCompareView.destroy(true);
            this.oTestImageCompareView = null;
        },

        onTestImgSelect: function () {
            sap.ui.getCore().byId("onTestSelect").setEnabled(true);
            sap.ui.getCore().byId("oTestVersionClear").setEnabled(true);
        },

        onTestImgSelectConfirm: function () {
            var oTable = sap.ui.getCore().byId("testImageTable");
            var oSelectedItem = oTable.getSelectedItem();
            var oContext = oSelectedItem.getBindingContext("testVersionModel");
            var selectedVersion = oContext.getProperty("version");
            sap.ui.getCore().byId("testImgInput").setValue(selectedVersion);
            sap.ui.getCore().byId("oCompareUI5VersionBtn").setEnabled(true);
            this.oTestImageCompareView.destroy(true);
            this.oTestImageCompareView = null;
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
            sap.ui.getCore().byId("oCompareUI5VersionBtn").setEnabled(false);

            $.ajax({
                url: "/VIC_UI_DEV/imageDetail/latest-comparison-status",
                method: "GET",
                success: function (data) {
                    var oTodayDate = new Date();
                    var oTodayDateFormat = oTodayDate.toISOString().split("T")[0];

                    var oTableDataDuplicateCheck = data.some(function (item) {
                        return item.ui5Version2 === sTestVersion && item.executedOn === oTodayDateFormat;
                    });

                    function triggerComparison() {
                        sap.m.MessageToast.show("Comparison Triggered");
                        var sUrl = "/VIC_UI_DEV/imageDetail/snapshot-image-comparison/" + sBaseVersion + "/" + sTestVersion;
                        $.ajax({
                            url: sUrl,
                            method: "POST",
                            success: function () {
                                sap.m.MessageBox.success("Comparison triggered successfully!");
                                sap.ui.getCore().byId("oCompareUI5VersionBtn").setEnabled(true);
                            },
                            error: function (xhr, status, error) {
                                var sErrorMsg = xhr && xhr.responseText ? xhr.responseText : error;
                                sap.m.MessageBox.error("Error triggering comparison: " + sErrorMsg);
                                sap.ui.getCore().byId("oCompareUI5VersionBtn").setEnabled(true);
                            }
                        });
                    }

                    if (oTableDataDuplicateCheck) {
                        sap.m.MessageBox.confirm(
                            "Selected Test Version is already compared today.\nDo you want to trigger it again?",
                            {
                                actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                                onClose: function (oAction) {
                                    if (oAction === sap.m.MessageBox.Action.YES) {
                                        triggerComparison();
                                    } else {
                                        sap.ui.getCore().byId("oCompareUI5VersionBtn").setEnabled(true);
                                    }
                                }
                            }
                        );
                    } else {
                        triggerComparison();
                    }
                },
                error: function () {
                    sap.m.MessageBox.error("Failed to check comparison history.");
                    sap.ui.getCore().byId("oCompareUI5VersionBtn").setEnabled(true);
                }
            });
        },

        oMorePress: function () {
            if (this.onMoreLink) {
                this.onMoreLink.destroy();
                this.onMoreLink = null;
            }
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
