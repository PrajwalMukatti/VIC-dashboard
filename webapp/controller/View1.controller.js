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
    'sap/ui/core/util/Export',
    'sap/ui/core/util/ExportTypeCSV',
    'sap/ui/export/library',
    'sap/ui/export/Spreadsheet',
    'sap/m/MessageItem',
    'sap/m/MessageView',
    'sap/m/Popover'
],
    function (Controller, BaseController, Filter, FilterOperator, MessageBox, History, BusyDialog, JSONModel, Token,
        formatter, LogTblPersoService, TablePersoController, mlibrary, VizFrame, FlattenedDataset, FeedItem, Export, ExportTypeCSV,
        exportLibrary, Spreadsheet, MessageItem, MessageView, Popover) {
        "use strict";

        var ResetAllMode = mlibrary.ResetAllMode;
        var EdmType = exportLibrary.EdmType;
        var ExeDate1 = null;
        var ExeDate2 = null;
        var testPlan1Map = new Map();
        var testPlan2Map = new Map();
        var SELECT_ALL_TEXT = "Select All";

        return Controller.extend("vicstartintegration.controller.View1", {
            formatter: formatter,
            oCompareView: null,

onInit: function () {
                var oStateModel = new JSONModel({ headerExpanded: true, chartType: "column", chartNavEnabled: true, legendVisible: true, zoomLevelMain: 1, panXMain: 0, panYMain: 0, zoomLevelFull: 1, panXFull: 0, panYFull: 0 });
                this.getView().setModel(oStateModel, "state");

                var oViewModel = new JSONModel({ view: "chart" });
                this.getView().setModel(oViewModel, "view");

                this._oTPC = new TablePersoController({
                    table: this.byId("idTblTestPlan"),
                    componentName: "vicstartintegration",
                    persoService: LogTblPersoService
                }).activate();

                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                oRouter.getRoute("Route1").attachPatternMatched(this.onRouteMatched, this);

                this._ensureSelectAllInSimilarityModel();
                this._loadData();
            },

            onRouteMatched: function () {
                this._loadData();
            },

            _loadData: function () {
                var that = this;
                $.ajax({
                    url: "/VIC_UI_DEV/imageDetail/get-all-testplan-percentsuccess",
                    type: 'GET',
                    async: true,
                    success: function (res) {
                
                        that.testPlan2Map = new Map();
                        res.forEach(function (item) {
                            item.TestType = that.getTestType(item.testPlanName);
                            item.ProductArea = that.getProductArea(item.testPlanName);
                            item.Release = that.parseReleaseFromName(item.testPlanName);
                            item.UI5Version = that.parseUI5VersionFromName(item.testPlanName);
                            that.testPlan2Map.set(item.testPlanName, item);
                        });

                        that.getView().setModel(new JSONModel(res), "msimilaritypercent");

                        that.byId("idTblTitle").setText("Test Plans (" + res.length + ")");

                        var aTestPlan = [], aProdArea = [], aTesScp = [], aRelease = [], aUI5Version = [];
                        var aTempTestPlan = [], aTempProdArea = [], aTempTesScp = [], aTempRelease = [], aTempUI5Version = [];
                        res.forEach(function (r) {
                            if (aTempTestPlan.indexOf(r.testPlanName) === -1) { aTempTestPlan.push(r.testPlanName); aTestPlan.push(r); }
                            if (r.ProductArea && aTempProdArea.indexOf(r.ProductArea) === -1) { aTempProdArea.push(r.ProductArea); aProdArea.push(r); }
                            if (aTempTesScp.indexOf(r.TestType) === -1) { aTempTesScp.push(r.TestType); aTesScp.push(r); }
                            if (r.Release && aTempRelease.indexOf(r.Release) === -1) { aTempRelease.push(r.Release); aRelease.push({ Release: r.Release }); }
                            if (r.UI5Version && aTempUI5Version.indexOf(r.UI5Version) === -1) { aTempUI5Version.push(r.UI5Version); aUI5Version.push({ UI5Version: r.UI5Version }); }
                        });
                        // Prepend "Select All" item at the top for all dropdowns
                        aProdArea.unshift({ ProductArea: SELECT_ALL_TEXT });
                        aRelease.unshift({ Release: SELECT_ALL_TEXT });
                        aUI5Version.unshift({ UI5Version: SELECT_ALL_TEXT });
                        aTestPlan.unshift({ testPlanName: SELECT_ALL_TEXT });
                        aTesScp.unshift({ TestType: SELECT_ALL_TEXT });

                        that.getView().setModel(new JSONModel(aTestPlan), "mTestPlan");
                        that.getView().setModel(new JSONModel(aProdArea), "mProdArea");
                        that.getView().setModel(new JSONModel(aTesScp), "mTesScp");
                        that.getView().setModel(new JSONModel(aRelease), "mRelease");
                        that.getView().setModel(new JSONModel(aUI5Version), "mUI5Version");

                        var chartData = that._transformToChartData(res);
                        var oChartModel = that.getView().getModel("mock");
                        if (!oChartModel) {
                            oChartModel = new JSONModel({ ChartData: chartData });
                            that.getView().setModel(oChartModel, "mock");
                        } else {
                            oChartModel.setProperty("/ChartData", chartData);
                        }

                        that._updatePieChartData(res);
                        that._applyChartConfig(that.getView().getModel("state").getProperty("/chartType"));

                        that.attachAfterRendering();
                    },
                    error: function () {
                        $.getJSON(sap.ui.require.toUrl("vicstartintegration/localService/testplans.json")).done(function (res) {
                            that.testPlan2Map = new Map();
                            res.forEach(function (item) {
                                item.TestType = that.getTestType(item.testPlanName);
                                item.ProductArea = that.getProductArea(item.testPlanName);
                                item.Release = that.parseReleaseFromName(item.testPlanName);
                                item.UI5Version = that.parseUI5VersionFromName(item.testPlanName);
                                that.testPlan2Map.set(item.testPlanName, item);
                            });

                            that.getView().setModel(new JSONModel(res), "msimilaritypercent");
                            that.byId("idTblTitle").setText("Test Plans (" + res.length + ")");

                            var aTestPlan = [], aProdArea = [], aTesScp = [], aRelease = [], aUI5Version = [];
                            var aTempTestPlan = [], aTempProdArea = [], aTempTesScp = [], aTempRelease = [], aTempUI5Version = [];
                            res.forEach(function (r) {
                                if (aTempTestPlan.indexOf(r.testPlanName) === -1) { aTempTestPlan.push(r.testPlanName); aTestPlan.push(r); }
                                if (r.ProductArea && aTempProdArea.indexOf(r.ProductArea) === -1) { aTempProdArea.push(r.ProductArea); aProdArea.push(r); }
                                if (aTempTesScp.indexOf(r.TestType) === -1) { aTempTesScp.push(r.TestType); aTesScp.push(r); }
                                if (r.Release && aTempRelease.indexOf(r.Release) === -1) { aTempRelease.push(r.Release); aRelease.push({ Release: r.Release }); }
                                if (r.UI5Version && aTempUI5Version.indexOf(r.UI5Version) === -1) { aTempUI5Version.push(r.UI5Version); aUI5Version.push({ UI5Version: r.UI5Version }); }
                            });
                            // Prepend "Select All" item at the top for all dropdowns
                            aProdArea.unshift({ ProductArea: SELECT_ALL_TEXT });
                            aRelease.unshift({ Release: SELECT_ALL_TEXT });
                            aUI5Version.unshift({ UI5Version: SELECT_ALL_TEXT });
                            aTestPlan.unshift({ testPlanName: SELECT_ALL_TEXT });
                            aTesScp.unshift({ TestType: SELECT_ALL_TEXT });

                            that.getView().setModel(new JSONModel(aTestPlan), "mTestPlan");
                            that.getView().setModel(new JSONModel(aProdArea), "mProdArea");
                            that.getView().setModel(new JSONModel(aTesScp), "mTesScp");
                            that.getView().setModel(new JSONModel(aRelease), "mRelease");
                            that.getView().setModel(new JSONModel(aUI5Version), "mUI5Version");

                            var chartData = that._transformToChartData(res);
                            var oChartModel = that.getView().getModel("mock");
                            if (!oChartModel) {
                                oChartModel = new JSONModel({ ChartData: chartData });
                                that.getView().setModel(oChartModel, "mock");
                            } else {
                                oChartModel.setProperty("/ChartData", chartData);
                            }

                            that._updatePieChartData(res);
                            that._applyChartConfig(that.getView().getModel("state").getProperty("/chartType"));

                            that.attachAfterRendering();
                        }).fail(function () {
                            MessageBox.error("Failed to load test plan data from backend and local fallback.");
                        });
                    }
                });
            },

            onChartTypeChange: function (oEvent) {
                var sKey = (oEvent.getParameter("selectedItem") && oEvent.getParameter("selectedItem").getKey()) || oEvent.getSource().getSelectedKey();
                this.getView().getModel("state").setProperty("/chartType", sKey);
                this._applyChartConfig(sKey);
            },

            onViewChange: function (oEvent) {
                var sKey = (oEvent.getSource && oEvent.getSource().getSelectedKey) ? oEvent.getSource().getSelectedKey() :
                    (oEvent.getParameter && oEvent.getParameter("selectedItem") ? oEvent.getParameter("selectedItem").getKey() : null);
                if (sKey) {
                    this.getView().getModel("view").setProperty("/view", sKey);
                }
            },

            onDownloadChartImage: function () {
                try {
                    var oViz = this.byId("mainViz");
                    if (!oViz) { sap.m.MessageToast.show("Chart not available."); return; }
                    var oDom = oViz.getDomRef();
                    if (!oDom) { sap.m.MessageToast.show("Chart not ready."); return; }
                    var oSvg = oDom.querySelector("svg");
                    if (!oSvg) { sap.m.MessageToast.show("Chart SVG not found."); return; }

                    var serializer = new XMLSerializer();
                    var sSVG = serializer.serializeToString(oSvg);

                    var width = parseInt(oSvg.getAttribute("width"), 10) || oDom.clientWidth || 1200;
                    var height = parseInt(oSvg.getAttribute("height"), 10) || oDom.clientHeight || 420;

                    var svgBlob = new Blob([sSVG], { type: "image/svg+xml;charset=utf-8" });
                    var url = URL.createObjectURL(svgBlob);
                    var img = new Image();
                    img.onload = function () {
                        try {
                            var canvas = document.createElement("canvas");
                            canvas.width = width;
                            canvas.height = height;
                            var ctx = canvas.getContext("2d");

                            // white background for better readability
                            ctx.fillStyle = "#ffffff";
                            ctx.fillRect(0, 0, width, height);
                            ctx.drawImage(img, 0, 0, width, height);

                            canvas.toBlob(function (blob) {
                                var a = document.createElement("a");
                                a.href = URL.createObjectURL(blob);
                                a.download = "vic-chart-" + new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19) + ".png";
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(a.href);
                                URL.revokeObjectURL(url);
                            }, "image/png");
                        } catch (e2) {
                            sap.m.MessageToast.show("PNG export failed, falling back to SVG.");
                            var a2 = document.createElement("a");
                            a2.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(sSVG);
                            a2.download = "vic-chart.svg";
                            document.body.appendChild(a2);
                            a2.click();
                            document.body.removeChild(a2);
                            URL.revokeObjectURL(url);
                        }
                    };
                    img.onerror = function () {
                        sap.m.MessageToast.show("Failed to render chart image.");
                        URL.revokeObjectURL(url);
                    };
                    img.src = url;
                } catch (e) {
                    sap.m.MessageToast.show("Download failed.");
                }
            },

            _transformToChartData: function (aRows) {
                var mGroups = {}; 

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

                    var key = (r.ProductArea || "N/A") + "|" + bucket;

                    if (!mGroups[key]) {
                        mGroups[key] = {
                            ProductArea: r.ProductArea || "N/A",
                            Bucket: bucket,
                            Count: 0,
                            TestPlans: []
                        };
                    }

                    mGroups[key].Count++;
                    mGroups[key].TestPlans.push({
                        testPlanName: r.testPlanName,
                        ProductArea: r.ProductArea,
                        executedOn: r.executeOn
                    });
                });

                return Object.values(mGroups);
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

_applyChartConfig: function (sChartType, oVizTarget) {
                var oViz = oVizTarget || this.byId("mainViz");
                if (!oViz) return;

                var oChartModel = this.getView().getModel("mock");
                if (!oChartModel) return;

                oViz.removeAllFeeds();
                oViz.setDataset(null);

                if (sChartType === "pie" || sChartType === "donut") {

                    var oPieDataset = new sap.viz.ui5.data.FlattenedDataset({
                        data: { path: "mock>/PieChartData" },
                        dimensions: [
                            { name: "Similarity Category", value: "{mock>Status}" }
                        ],
                        measures: [
                            { name: "Test Plan", value: "{mock>Count}" }
                        ]
                    });
                    oViz.setDataset(oPieDataset);

                    oViz.addFeed(new sap.viz.ui5.controls.common.feeds.FeedItem({
                        uid: "size", type: "Measure", values: ["Test Plan"]
                    }));
                    oViz.addFeed(new sap.viz.ui5.controls.common.feeds.FeedItem({
                        uid: "color", type: "Dimension", values: ["Similarity Category"]
                    }));

                    oViz.setVizType(sChartType);
                    oViz.setVizProperties({
                        general: { title: { visible: false } }, 
                        plotArea: { dataLabel: { visible: true }, innerRadius: sChartType === "donut" ? 60 : 0 },
                        legend: { visible: this.getView().getModel("state").getProperty("/legendVisible") } 
                    });

                } else {

                    var oDataset = new sap.viz.ui5.data.FlattenedDataset({
                        data: { path: "mock>/ChartData" },
                        dimensions: [
                            { name: "Product Area", value: "{mock>ProductArea}" },
                            { name: "Similarity Category", value: "{mock>Bucket}" }
                        ],
                        measures: [
                            { name: "Test Plan", value: "{mock>Count}" }
                        ]
                    });
                    oViz.setDataset(oDataset);

                    oViz.addFeed(new sap.viz.ui5.controls.common.feeds.FeedItem({
                        uid: "valueAxis", type: "Measure", values: ["Test Plan"]
                    }));
                    oViz.addFeed(new sap.viz.ui5.controls.common.feeds.FeedItem({
                        uid: "categoryAxis", type: "Dimension", values: ["Product Area"]
                    }));
                    oViz.addFeed(new sap.viz.ui5.controls.common.feeds.FeedItem({
                        uid: "color", type: "Dimension", values: ["Similarity Category"]
                    }));

                    oViz.setVizType(sChartType);
                    oViz.setVizProperties({
                        general: { title: { visible: false } }, 
                        plotArea: { dataLabel: { visible: true } }, 
                        legend: { visible: this.getView().getModel("state").getProperty("/legendVisible") } 
                    });
                }
                oViz.invalidate();
            },

            // Select All helpers
            _ensureSelectAllInSimilarityModel: function () {
                try {
                    var oSimModel = this.getView().getModel("mSimilarity");
                    if (!oSimModel || !oSimModel.getData) { return; }
                    var data = oSimModel.getData();
                    if (data && Array.isArray(data.similaritySet)) {
                        var found = false;
                        for (var i = 0; i < data.similaritySet.length; i++) {
                            if (data.similaritySet[i] && data.similaritySet[i].Description === SELECT_ALL_TEXT) {
                                found = true; break;
                            }
                        }
                        if (!found) {
                            data.similaritySet.unshift({ Description: SELECT_ALL_TEXT });
                            oSimModel.refresh(true);
                        }
                    }
                } catch (e) {
                    // no-op
                }
            },

            _collectVisibleKeysFromMCB: function (oMCB) {
                var aItems = oMCB && oMCB.getItems ? oMCB.getItems() : [];
                var aKeys = [];
                for (var i = 0; i < aItems.length; i++) {
                    var k = aItems[i].getKey && aItems[i].getKey();
                    if (k && k !== SELECT_ALL_TEXT) { aKeys.push(k); }
                }
                return aKeys;
            },

            _applySelectAllIfRequested: function (oMCB) {
                if (!oMCB || !oMCB.getSelectedKeys) { return; }
                var aKeys = oMCB.getSelectedKeys() || [];
                if (aKeys.indexOf(SELECT_ALL_TEXT) !== -1) {
                    var aAll = this._collectVisibleKeysFromMCB(oMCB);
                    oMCB.setSelectedKeys(aAll);
                }
            },

attachAfterRendering: function () {
                var oViz = this.byId("mainViz");
                if (!oViz) {
                    console.warn("mainViz not found");
                    return;
                }

                // Ensure viz popover is connected to the current VizFrame
                var oPopover = this.byId("idPopOver");
                if (oPopover && !oPopover.__connected) {
                    try {
                        oPopover.connect(oViz.getVizUid());
                        oPopover.__connected = true;
                    } catch (e) {
                        // no-op: connect may throw if viz is not ready yet
                    }
                }

                if (!oViz.__selectHandlerAttached) {
                    oViz.attachSelectData(this._onChartSelectData.bind(this));
                    oViz.__selectHandlerAttached = true;
                }

                if (!oViz.__renderCompleteAttached) {
                    oViz.attachRenderComplete(function () {
                        this._applyZoomAndPan(oViz, false);
                        this._attachPanHandlers(oViz, false);
                    }.bind(this));
                    oViz.__renderCompleteAttached = true;
                }
                // Apply initial zoom/pan visuals
                this._applyZoomAndPan(oViz, false);
                this._attachPanHandlers(oViz, false);
            },

            _onChartSelectData: function (oEvent) {
                var aData = oEvent && oEvent.getParameter ? oEvent.getParameter("data") : null;
                if (!aData || !aData.length) return;

                var raw = aData[0].data || aData[0];
                var sBucket = raw["Similarity %"] || raw.Status || raw.Bucket || raw["Similarity Category"];
                var sProductArea = raw["Product Area"] || raw.ProductArea;

                var aFilters = [];

                if (sBucket) {
                    if (sBucket === "<96%") {
                        aFilters.push(new sap.ui.model.Filter("percentSuccess", "LT", 96));
                    } else if (sBucket === "96%-98%") {
                        aFilters.push(new sap.ui.model.Filter("percentSuccess", "BT", 96, 97.9999));
                    } else if (sBucket === "98%-99%") {
                        aFilters.push(new sap.ui.model.Filter("percentSuccess", "BT", 98, 99.9999));
                    } else if (sBucket === "100%") {
                        aFilters.push(new sap.ui.model.Filter("percentSuccess", "EQ", 100));
                    }
                }

                if (sProductArea) {
                    aFilters.push(new sap.ui.model.Filter("ProductArea", "EQ", sProductArea));
                }

                var oTable = this.byId("idTblTestPlan");
                if (!oTable) return;

                var oBinding = oTable.getBinding("items");
                if (oBinding) {
                    oBinding.filter(aFilters);

                    this.getView().getModel("view").setProperty("/view", "table");

                    var iLength = oBinding.getLength ? oBinding.getLength() : 0;
                    this.byId("idTblTitle").setText("Test Plans (" + iLength + ")");
                }
            },

            getTestType: function (inputString) {
                if (!inputString) { return null; }
                var parts = inputString.split('_');

                // Prefer known test type tokens if present
                var knownTypes = ["E2E", "UNIT", "QA", "SMOKE", "REGRESSION", "UAT", "PERF", "INTEGRATION"];
                for (var i = 0; i < parts.length; i++) {
                    if (knownTypes.indexOf(parts[i]) !== -1) {
                        return parts[i];
                    }
                }

                // Fallback: token immediately before the release token (25xx/26xx) is likely the test type
                for (var j = 1; j < parts.length; j++) {
                    if (/^2(?:5|6)\d{2}$/.test(parts[j])) {
                        return parts[j - 1] || null;
                    }
                }

                // Last fallback: common position for names like FIN_TRM_AB_UNIT_2612_1.141
                return parts.length >= 4 ? parts[3] : null;
            },

            getProductArea: function (testPlanName) {
                const salesKeywords = ["SALES"];
                const finKeywords = ["FIN_AA", "FIN_AFC", "FIN_COPA", "FIN_CONSL", "FIN_AP", "FIN_AR", "FIN_CM", "FIN_TRM", "FIN_EBRR", "FIN_TAXES", "FIN_AccGL"];
                const ideaKeywords = ["S4CLD_E", "PROD_CENT_PLM", "EPPM_FINLED_EPPM"];
                const procureKeywords = ["PROCURE", "VC_MMIM"];
                const servicesKeywords = ["S4CLD_SERV"];
                const produceKeyword = ["OPR_MFG_EAM"];
                const tradeKeyword = ["TX_ITR"];
                const cloudFoundationKeyword = ["CLD_FND"];
                const cloudMasterDataKeyword = ["MDM"];

                function includesAny(testPlanName, keywords) {
                    return keywords.some(keyword => testPlanName.includes(keyword));
                }

                if (includesAny(testPlanName, salesKeywords)) {
                    return "SALES";
                } else if (includesAny(testPlanName, finKeywords)) {
                    return "FIN";
                } else if (includesAny(testPlanName, ideaKeywords)) {
                    return "IDEA";
                } else if (includesAny(testPlanName, procureKeywords)) {
                    return "PROCURE";
                } else if (includesAny(testPlanName, servicesKeywords)) {
                    return "SERVICES";
                } else if (includesAny(testPlanName, produceKeyword)) {
                    return "PRODUCE";
                } else if (includesAny(testPlanName, tradeKeyword)) {
                    return "TRADE";
                } else if (includesAny(testPlanName, cloudFoundationKeyword)) {
                    return "CLOUD FOUNDATION";
                } else if (includesAny(testPlanName, cloudMasterDataKeyword)) {
                    return "MASTER DATA";
                } else {
                    return "UNKNOWN"; 
                }
            },

            parseReleaseFromName: function (name) {
                if (!name) { return null; }
                // Prefer separator-delimited token like '2508' or '2602'
                var parts = String(name).split(/[_\s\-\.\|]+/);
                for (var i = 0; i < parts.length; i++) {
                    var token = parts[i];
                    if (/^2(?:5|6)\d{2}$/.test(token)) {
                        return token;
                    }
                }
                // Fallback: find standalone 2500-2699 occurrence with word boundaries
                var m = String(name).match(/\b2(?:5|6)\d{2}\b/);
                return m ? m[0] : null;
            },

            parseUI5VersionFromName: function (name) {
                if (!name) { return null; }
                // Prefer underscore-/separator-delimited token like '1141X' or '1141x' (normalize to uppercase)
                var parts = String(name).split(/[_\s\-\.\|]+/);
                for (var i = 0; i < parts.length; i++) {
                    var token = parts[i];
                    // 4-digit + X/x (e.g., 1141X or 1141x)
                    if (/^\d{4}[Xx]$/.test(token)) {
                        return token.toUpperCase();
                    }
                    // Also accept 3-digit + X/x (e.g., 114X or 114x)
                    if (/^\d{3}[Xx]$/.test(token)) {
                        return token.toUpperCase();
                    }
                }
                // Fallback: detect '1.141' style and convert to '1141X'
                var m2 = String(name).match(/\b1\.(\d{3})\b/);
                if (m2 && m2[1]) {
                    var minor = parseInt(m2[1], 10);
                    var val = 1000 + minor;
                    return String(val) + "X";
                }
                // Last resort: generic match without word-boundary constraints
                var m3 = String(name).match(/(\d{3,4}[Xx])/);
                if (m3 && m3[1]) { return m3[1].toUpperCase(); }
                return null;
            },


            onLogRowPress: function (oEvent) {

                var oView = this.getView();
                var oSearchField = this.getView().byId("idSearchField");
                if (oSearchField) {
                    oSearchField.setValue("");
                }


                var oMCBTestPlan = oView.byId("idMCBoxTestPlan");
                if (oMCBTestPlan) {
                    oMCBTestPlan.setSelectedKeys([]);
                    oMCBTestPlan.removeAllSelectedItems();
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

            onFBGoPress: function (oEvent) {
                var oView = this.getView();
                var oTable = oView.byId("idTblTestPlan");
                if (!oTable) { return; }
                var oBinding = oTable.getBinding("items");
                if (!oBinding) { return; }

                var aOrFilter = [];
                var aAndFilter = [];
                var aSelectedSimilarity = oView.byId("idMCBoxsimilarity").getSelectedKeys();

                aSelectedSimilarity.forEach(function (selectedItem) {
                    if (selectedItem === SELECT_ALL_TEXT) { return; }
                    var sText = selectedItem;

                    if (sText.indexOf("<96") === 0 || sText.indexOf("<96") === 0) {
                        aOrFilter.push(new sap.ui.model.Filter("percentSuccess", sap.ui.model.FilterOperator.LT, 96));
                    } else if (sText.indexOf("96%-98%") === 0) {
                        aOrFilter.push(new sap.ui.model.Filter("percentSuccess", sap.ui.model.FilterOperator.BT, 96, 97.9999));
                    } else if (sText.indexOf("98%-99%") === 0) {
                        aOrFilter.push(new sap.ui.model.Filter("percentSuccess", sap.ui.model.FilterOperator.BT, 98, 99.9999));
                    } else if (sText.indexOf("100%") === 0) {
                        aOrFilter.push(new sap.ui.model.Filter("percentSuccess", sap.ui.model.FilterOperator.EQ, 100));
                    }
                });

                if (aOrFilter.length > 0) {
                    aAndFilter.push(new sap.ui.model.Filter(aOrFilter, false));
                }

                var sSrchValue = this.getView().byId("idSearchField").getValue();
                if (sSrchValue && sSrchValue !== "" && sSrchValue !== null) {
                    aOrFilter = [];
                    aOrFilter.push(new Filter("testPlanName", FilterOperator.Contains, sSrchValue));
                    aOrFilter.push(new Filter("ProductArea", FilterOperator.Contains, sSrchValue));
                    aOrFilter.push(new Filter("TestType", FilterOperator.Contains, sSrchValue));

                    aAndFilter.push(new sap.ui.model.Filter(aOrFilter, false));
                }

                aOrFilter = [];
                var oMCBTestPlan = oView.byId("idMCBoxTestPlan");
                if (oMCBTestPlan) {
                    var aFilterTestPlanItems = oMCBTestPlan.getSelectedItems();
                    if (aFilterTestPlanItems && aFilterTestPlanItems.length > 0) {
                        for (var i = 0; i < aFilterTestPlanItems.length; i++) {
                            var k = aFilterTestPlanItems[i].getProperty("key");
                            if (k === SELECT_ALL_TEXT) { continue; }
                            aOrFilter.push(new Filter("testPlanName", FilterOperator.Contains, k));
                        }
                        if (aOrFilter.length > 0) {
                            aAndFilter.push(new Filter(aOrFilter, false));
                        }
                    }
                }

                aOrFilter = [];
                var oMCBTestScope = oView.byId("idMCBoxTestScope");
                var aFilterTestScpItems = oMCBTestScope ? oMCBTestScope.getSelectedItems() : null;
                if (aFilterTestScpItems && aFilterTestScpItems.length > 0) {
                    for (var i = 0; i < aFilterTestScpItems.length; i++) {
                        var k = aFilterTestScpItems[i].getProperty("key");
                        if (k === SELECT_ALL_TEXT) { continue; }
                        aOrFilter.push(new Filter("TestType", FilterOperator.Contains, k));
                    }
                    if (aOrFilter.length > 0) {
                        aAndFilter.push(new Filter(aOrFilter, false));
                    }
                }


                // Product Area filter (OR within dropdown, AND with others)
                aOrFilter = [];
                var aFilterProdAreaItems = oView.byId("idMCBoxProdArea").getSelectedItems();
                if (aFilterProdAreaItems && aFilterProdAreaItems.length > 0) {
                    for (var i = 0; i < aFilterProdAreaItems.length; i++) {
                        var k = aFilterProdAreaItems[i].getProperty("key");
                        if (k === SELECT_ALL_TEXT) { continue; }
                        aOrFilter.push(new Filter("ProductArea", FilterOperator.EQ, k));
                    }
                    if (aOrFilter.length > 0) {
                        aAndFilter.push(new Filter(aOrFilter, false));
                    }
                }

                // Release filter (OR within dropdown, AND with others)
                aOrFilter = [];
                var aFilterReleaseItems = oView.byId("idMCBoxRelease").getSelectedItems();
                if (aFilterReleaseItems && aFilterReleaseItems.length > 0) {
                    for (var i = 0; i < aFilterReleaseItems.length; i++) {
                        var k = aFilterReleaseItems[i].getProperty("key");
                        if (k === SELECT_ALL_TEXT) { continue; }
                        aOrFilter.push(new Filter("Release", FilterOperator.EQ, k));
                    }
                    if (aOrFilter.length > 0) {
                        aAndFilter.push(new Filter(aOrFilter, false));
                    }
                }

                // UI5 Version filter (OR within dropdown, AND with others)
                aOrFilter = [];
                var oUI5MCB = oView.byId("idMCBoxUI5Version");
                if (oUI5MCB) {
                    var aFilterUI5Items = oUI5MCB.getSelectedItems();
                    if (aFilterUI5Items && aFilterUI5Items.length >0) {
                        for (var i = 0; i < aFilterUI5Items.length; i++) {
                            var k = aFilterUI5Items[i].getProperty("key");
                            if (k === SELECT_ALL_TEXT) { continue; }
                            aOrFilter.push(new Filter("UI5Version", FilterOperator.EQ, k));
                        }
                        if (aOrFilter.length > 0) {
                            aAndFilter.push(new Filter(aOrFilter, false));
                        }
                    }
                }

                var oFinalFilter = aAndFilter.length > 0 ? new Filter(aAndFilter, true) : null;
                oBinding.filter(oFinalFilter || []);
                oView.byId('idTblTitle').setText("Test Plans (" + oBinding.getLength() + ")");

                this._updateChartWithFilteredData();
                this._refreshDropdownOptions();
            },

            onReleaseChange: function (oEvent) {
                this._applySelectAllIfRequested(oEvent.getSource());
                this.onFBGoPress();
                this._refreshDropdownOptions();
            },

            onTestPlanChange: function (oEvent) {
                this._applySelectAllIfRequested(oEvent.getSource());
                this.onFBGoPress();
                this._refreshDropdownOptions();
            },

            onUI5VersionChange: function (oEvent) {
                this._applySelectAllIfRequested(oEvent.getSource());
                this.onFBGoPress();
                this._refreshDropdownOptions();
            },

            onTestTypeChange: function (oEvent) {
                this._applySelectAllIfRequested(oEvent.getSource());
                this.onFBGoPress();
                this._refreshDropdownOptions();
            },

            onProductAreaChange: function (oEvent) {
                this._applySelectAllIfRequested(oEvent.getSource());
                this.onFBGoPress();
                this._refreshDropdownOptions();
            },

            onSimilatitySelect: function (oEvent) {
                this._applySelectAllIfRequested(oEvent.getSource());
                this.onFBGoPress();
                this._refreshDropdownOptions();
            },

            onFBResetPress: function () {
                this.onFBClearPress();
            },

            onTblUpdateFinished: function () {
                var oTable = this.byId("idTblTestPlan");
                if (oTable) {
                    var oBinding = oTable.getBinding("items");
                    if (oBinding) {
                        this.byId("idTblTitle").setText("Test Plans (" + oBinding.getLength() + ")");
                    }
                }
            },

            onLogsRefresh: function () {
                this._loadData();
            },

            onChartSelect: function (oEvent) {
                this._onChartSelectData(oEvent);
            },

            _refreshDropdownOptions: function () {
                var oView = this.getView();

                // Always start from full original dataset (upstream-only recompute)
                var oOriginalModel = oView.getModel("msimilaritypercent");
                var dataAll = (oOriginalModel && oOriginalModel.getData()) || [];

                // Current selections
                var oPA = oView.byId("idMCBoxProdArea");
                var selPA = oPA ? oPA.getSelectedKeys() : [];

                var oRel = oView.byId("idMCBoxRelease");
                var selRelease = oRel ? oRel.getSelectedKeys() : [];

                var oUI5 = oView.byId("idMCBoxUI5Version");
                var selUI5 = oUI5 ? oUI5.getSelectedKeys() : [];

                var oSim = oView.byId("idMCBoxsimilarity");
                var selSim = oSim ? oSim.getSelectedKeys() : [];

                // Helper to map percentSuccess to bucket label
                function bucketLabel(val) {
                    var v = Number(val) || 0;
                    if (v < 96) { return "<96%"; }
                    if (v < 98) { return "96%-98%"; }
                    if (v < 100) { return "98%-99%"; }
                    return "100%";
                }

                // Product Area options: always from full data (never restricted)
                var prodAreaSet = {};
                (dataAll || []).forEach(function (r) {
                    if (r.ProductArea) { prodAreaSet[r.ProductArea] = true; }
                });
                var aProdArea = Object.keys(prodAreaSet).sort().map(function (x) { return { ProductArea: x }; });
                aProdArea.unshift({ ProductArea: SELECT_ALL_TEXT });
                oView.setModel(new JSONModel(aProdArea), "mProdArea");

                // Release options: depends only on selected Product Areas (union)
                var baseForRelease = selPA && selPA.length
                    ? dataAll.filter(function (r) { return r.ProductArea && selPA.indexOf(r.ProductArea) !== -1; })
                    : dataAll;
                var releaseSet = {};
                (baseForRelease || []).forEach(function (r) {
                    if (r.Release) { releaseSet[r.Release] = true; }
                });
                var aRelease = Object.keys(releaseSet).sort().map(function (x) { return { Release: x }; });
                aRelease.unshift({ Release: SELECT_ALL_TEXT });
                oView.setModel(new JSONModel(aRelease), "mRelease");

                // UI5 Version options: depends on Product Areas + Releases (union)
                var baseForUI5 = (selRelease && selRelease.length)
                    ? baseForRelease.filter(function (r) { return r.Release && selRelease.indexOf(r.Release) !== -1; })
                    : baseForRelease;
                var ui5Set = {};
                (baseForUI5 || []).forEach(function (r) {
                    if (r.UI5Version) { ui5Set[r.UI5Version] = true; }
                });
                var aUI5Version = Object.keys(ui5Set).sort().map(function (x) { return { UI5Version: x }; });
                aUI5Version.unshift({ UI5Version: SELECT_ALL_TEXT });
                oView.setModel(new JSONModel(aUI5Version), "mUI5Version");

                // Available similarity buckets under current upstream filters (PA + Release)
                var simSet = {};
                (baseForUI5 || []).forEach(function (r) {
                    simSet[bucketLabel(r.percentSuccess)] = true;
                });
                var aAvailSimKeys = Object.keys(simSet);

                // Test Plan options: depends on Product Areas + Releases + UI5 Versions + Similarity
                var baseForTP = (selUI5 && selUI5.length)
                    ? baseForUI5.filter(function (r) { return r.UI5Version && selUI5.indexOf(r.UI5Version) !== -1; })
                    : baseForUI5;

                if (selSim && selSim.length) {
                    baseForTP = baseForTP.filter(function (r) {
                        return selSim.indexOf(bucketLabel(r.percentSuccess)) !== -1;
                    });
                }

                var testPlanSet = {};
                (baseForTP || []).forEach(function (r) {
                    if (r.testPlanName) { testPlanSet[r.testPlanName] = true; }
                });
                var aTestPlan = Object.keys(testPlanSet).sort().map(function (x) { return { testPlanName: x }; });
                aTestPlan.unshift({ testPlanName: SELECT_ALL_TEXT });
                oView.setModel(new JSONModel(aTestPlan), "mTestPlan");

                // Test Type list (leave available globally; keep minimal impact)
                var testTypeSet = {};
                (dataAll || []).forEach(function (r) {
                    if (r.TestType) { testTypeSet[r.TestType] = true; }
                });
                var aTesScp = Object.keys(testTypeSet).sort().map(function (x) { return { TestType: x }; });
                aTesScp.unshift({ TestType: SELECT_ALL_TEXT });
                oView.setModel(new JSONModel(aTesScp), "mTesScp");

                // Intersect selected keys against what is now available.
                function _intersectSelectedKeys(sControlId, aAvailableKeys) {
                    var oMCB = oView.byId(sControlId);
                    if (!oMCB) { return; }
                    var aKeys = oMCB.getSelectedKeys();
                    var aNewKeys = (aKeys || []).filter(function (k) { return aAvailableKeys.indexOf(k) !== -1; });
                    oMCB.setSelectedKeys(aNewKeys);
                }

                // Keep PA keys valid (list is universe, so this is largely a no-op)
                _intersectSelectedKeys("idMCBoxProdArea", aProdArea.map(function (o) { return o.ProductArea; }).filter(function (k) { return k !== SELECT_ALL_TEXT; }));

                // Prune downstream invalid selections
                _intersectSelectedKeys("idMCBoxRelease", aRelease.map(function (o) { return o.Release; }).filter(function (k) { return k !== SELECT_ALL_TEXT }));
                _intersectSelectedKeys("idMCBoxUI5Version", aUI5Version.map(function (o) { return o.UI5Version; }).filter(function (k) { return k !== SELECT_ALL_TEXT; }));
                _intersectSelectedKeys("idMCBoxTestPlan", aTestPlan.map(function (o) { return o.testPlanName; }).filter(function (k) { return k !== SELECT_ALL_TEXT; }));
                _intersectSelectedKeys("idMCBoxTestScope", aTesScp.map(function (o) { return o.TestType; }).filter(function (k) { return k !== SELECT_ALL_TEXT; }));

                // Prune similarity selections to available buckets under current upstream filters
                _intersectSelectedKeys("idMCBoxsimilarity", aAvailSimKeys);
            },

            _updateChartWithFilteredData: function () {
                var oView = this.getView();
                var oTable = oView.byId("idTblTestPlan");
                if (!oTable) { return; }
                var oBinding = oTable.getBinding("items");
                if (!oBinding) { return; }

       
                var aFilteredData = [];
                if (oBinding && oBinding.getContexts) {
                    var aContexts = oBinding.getContexts();
                    aFilteredData = aContexts.map(function (oContext) {
                        return oContext.getObject();
                    });
                }

                if (aFilteredData.length === 0) {
                    var oOriginalModel = oView.getModel("msimilaritypercent");
                    aFilteredData = oOriginalModel ? oOriginalModel.getData() : [];
                }

                var chartData = this._transformToChartData(aFilteredData);
                var oChartModel = oView.getModel("mock");

                if (oChartModel) {
                    oChartModel.setProperty("/ChartData", chartData);

                    this._updatePieChartData(aFilteredData);

                    var sCurrentChartType = oView.getModel("state").getProperty("/chartType");
                    this._applyChartConfig(sCurrentChartType);
                }
            },

            onFBClearPress: function () {
                var oSearchField = this.getView().byId("idSearchField");
                oSearchField.setValue("");

                var oTestPlan = this.getView().byId("idMCBoxTestPlan");
                if (oTestPlan) { oTestPlan.setSelectedKeys([]); }

                var oTestType = this.getView().byId("idMCBoxTestScope");
                if (oTestType) { oTestType.setSelectedKeys([]); }

                var oSimilarityComboBox = this.getView().byId("idMCBoxsimilarity");
                oSimilarityComboBox.setSelectedKeys([]);

                var oProductArea = this.getView().byId("idMCBoxProdArea");
                oProductArea.setSelectedKeys([]);

                var oRelease = this.getView().byId("idMCBoxRelease");
                if (oRelease) { oRelease.setSelectedKeys([]); }

                var oUI5Version = this.getView().byId("idMCBoxUI5Version");
                if (oUI5Version) { oUI5Version.setSelectedKeys([]); }

                var oTable = this.getView().byId("idTblTestPlan");
                if (!oTable) { return; }
                var oBinding = oTable.getBinding("items");
                if (!oBinding) { return; }
                oBinding.filter([]);

                this.getView().byId('idTblTitle').setText("Test Plans (" + oBinding.getLength() + ")");

                this._resetChartToOriginalData();
                this._refreshDropdownOptions();
            },

            _resetChartToOriginalData: function () {
                var oView = this.getView();
                var oOriginalModel = oView.getModel("msimilaritypercent");

                if (oOriginalModel) {
                    var aOriginalData = oOriginalModel.getData();

                    var chartData = this._transformToChartData(aOriginalData);
                    var oChartModel = oView.getModel("mock");

                    if (oChartModel) {
                        oChartModel.setProperty("/ChartData", chartData);

                        this._updatePieChartData(aOriginalData);

                        var sCurrentChartType = oView.getModel("state").getProperty("/chartType");
                        this._applyChartConfig(sCurrentChartType);
                    }
                }
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

            onPersoButtonPressed: function (oEvent) {
                this._oTPC.openDialog();
            },

            onSearchFieldPress: function (oEvent) {

                // Delegate to consolidated filter handler so Search composes with all other filters
                // (OR within a single MultiComboBox and AND across different controls)
                this.onFBGoPress();

            },

            oCompareButton: function () {

                var that = this;
                if (!this.oCompareView) {
                    this.oCompareView = new sap.ui.xmlfragment("vicstartintegration.view.fragment.CompareView", this);
                    this.getView().addDependent(this.oCompareView);
                }
                this.oCompareView.open();
                sap.ui.getCore().byId("baseImgInput").setValue("1.141.0-SNAPSHOT(20250923-0118)");

                $.ajax({
                    url: "/VIC_UI_DEV/imageDetail/dailyOQ-details",
                    method: "GET",
                    dataType: "json",
                    success: function (data) {

                        var baseVersion = "1.141.0-SNAPSHOT(20250923-0118)";
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
                sap.ui.getCore().byId("oTestVersionClear").setEnabled(true);
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
            },

            // Full screen popup with chart and controls
            onOpenChartFullScreen: function () {
                if (!this._oChartDialog) {
                    this._oChartDialog = new sap.m.Dialog({
                        stretch: true,
                        contentWidth: "100%",
                        contentHeight: "100%",
                        customHeader: new sap.m.Bar({
                            contentMiddle: [
                                new sap.m.Button({ icon: "sap-icon://zoom-in", tooltip: "Zoom In", press: this.onZoomIn.bind(this) }),
                                new sap.m.Button({ icon: "sap-icon://zoom-out", tooltip: "Zoom Out", press: this.onZoomOut.bind(this) }),
                                new sap.m.Button({ icon: "sap-icon://reset", tooltip: "Reset Zoom", press: this.onResetZoom.bind(this) }),
                                new sap.m.Button({ icon: "sap-icon://legend", tooltip: "Show/Hide Legend", press: this.onToggleLegend.bind(this) }),
                                new sap.m.Button({ icon: "sap-icon://download", tooltip: "Download Chart Image", press: this.onDownloadChartImage.bind(this) }),
                                new sap.m.Button({ icon: "sap-icon://exit-full-screen", tooltip: "Close", press: this.onCloseChartFullScreen.bind(this) })
                            ]
                        })
                    });

                    var oFullViz = new VizFrame(this.createId("fullViz"), {
                        height: "85vh",
                        width: "100%",
                        uiConfig: { applicationSet: "fiori" },
                        vizType: this.getView().getModel("state").getProperty("/chartType")
                    });
                    oFullViz.setModel(this.getView().getModel("mock"), "mock");
                    this._applyChartConfig(this.getView().getModel("state").getProperty("/chartType"), oFullViz);
                    this._oChartDialog.addContent(oFullViz);
                    this.getView().addDependent(this._oChartDialog);

                    var oPopover = this.byId("idPopOver");
                    if (oPopover) {
                        try { oPopover.connect(oFullViz.getVizUid()); } catch (e) { /* no-op */ }
                    }

                    oFullViz.attachRenderComplete(function () {
                        this._applyZoomAndPan(oFullViz, true);
                        this._attachPanHandlers(oFullViz, true);
                    }.bind(this));
                } else {
                    var oFullViz = this.byId("fullViz");
                    if (oFullViz) {
                        this._applyChartConfig(this.getView().getModel("state").getProperty("/chartType"), oFullViz);
                        var oPopover = this.byId("idPopOver");
                        if (oPopover) {
                            try { oPopover.connect(oFullViz.getVizUid()); } catch (e) {}
                        }
                    }
                }
                this._oChartDialog.open();
            },

            onCloseChartFullScreen: function () {
                if (this._oChartDialog) {
                    var oPopover = this.byId("idPopOver");
                    var oMainViz = this.byId("mainViz");
                    if (oPopover && oMainViz) {
                        try { oPopover.connect(oMainViz.getVizUid()); } catch (e) {}
                    }
                    this._oChartDialog.close();
                }
            },

            onZoomIn: function () {
                var bFull = !!(this._oChartDialog && this._oChartDialog.isOpen && this._oChartDialog.isOpen());
                var sSuffix = bFull ? "Full" : "Main";
                var oState = this.getView().getModel("state");
                var z = Number(oState.getProperty("/zoomLevel" + sSuffix)) || 1;
                z = Math.min(4, z + 0.25);
                oState.setProperty("/zoomLevel" + sSuffix, z);
                var oViz = this.byId(bFull ? "fullViz" : "mainViz");
                this._applyZoomAndPan(oViz, bFull);
            },

onZoomOut: function () {
                var bFull = !!(this._oChartDialog && this._oChartDialog.isOpen && this._oChartDialog.isOpen());
                var sSuffix = bFull ? "Full" : "Main";
                var oState = this.getView().getModel("state");
                var z = Number(oState.getProperty("/zoomLevel" + sSuffix)) || 1;
                z = Math.max(1, z - 0.25);
                oState.setProperty("/zoomLevel" + sSuffix, z);
                if (z === 1) {
                    oState.setProperty("/panX" + sSuffix, 0);
                    oState.setProperty("/panY" + sSuffix, 0);
                }
                var oViz = this.byId(bFull ? "fullViz" : "mainViz");
                this._applyZoomAndPan(oViz, bFull);
            },

            onResetZoom: function () {
                var bFull = !!(this._oChartDialog && this._oChartDialog.isOpen && this._oChartDialog.isOpen());
                var sSuffix = bFull ? "Full" : "Main";
                var oState = this.getView().getModel("state");
                oState.setProperty("/zoomLevel" + sSuffix, 1);
                oState.setProperty("/panX" + sSuffix, 0);
                oState.setProperty("/panY" + sSuffix, 0);
                var oViz = this.byId(bFull ? "fullViz" : "mainViz");
                this._applyZoomAndPan(oViz, bFull);
            },

            onToggleLegend: function () {
                var oState = this.getView().getModel("state");
                var bVisible = !!oState.getProperty("/legendVisible");
                bVisible = !bVisible;
                oState.setProperty("/legendVisible", bVisible);
                var oMainViz = this.byId("mainViz");
                if (oMainViz) { try { oMainViz.setVizProperties({ legend: { visible: bVisible } }); } catch (e) {} }
                var oFullViz = this.byId("fullViz");
                if (oFullViz) { try { oFullViz.setVizProperties({ legend: { visible: bVisible } }); } catch (e) {} }
            },

_applyZoomAndPan: function (oViz, bFull) {
                if (!oViz) return;
                var oState = this.getView().getModel("state");
                var sSuffix = bFull ? "Full" : "Main";
                var z = Number(oState.getProperty("/zoomLevel" + sSuffix)) || 1;
                var panX = Number(oState.getProperty("/panX" + sSuffix)) || 0;
                var panY = Number(oState.getProperty("/panY" + sSuffix)) || 0;
                var oDom = oViz.getDomRef();
                if (!oDom) return;
                var oSvg = oDom.querySelector("svg");
                if (!oSvg) return;

                oDom.classList.add("viz-pan-container");
                oSvg.classList.add("viz-svg-zoom");
                oSvg.style.transformOrigin = "0 0";
                oSvg.style.transform = "translate(" + panX + "px," + panY + "px) scale(" + z + ")";
            },

            _attachPanHandlers: function (oViz, bFull) {
                if (!oViz || oViz.__panHandlersAttached) return;
                var oState = this.getView().getModel("state");
                var sSuffix = bFull ? "Full" : "Main";
                var oDom = oViz.getDomRef();
                if (!oDom) return;
                var oSvg = oDom.querySelector("svg");
                if (!oSvg) return;

                var that = this;
                var dragging = false;
                var lastX = 0, lastY = 0;

                function onMouseDown(e) {
                    var z = Number(oState.getProperty("/zoomLevel" + sSuffix)) || 1;
                    if (z <= 1) return;
                    dragging = true;
                    lastX = e.clientX;
                    lastY = e.clientY;
                    oSvg.classList.add("dragging");
                    e.preventDefault();
                }
                function onMouseMove(e) {
                    if (!dragging) return;
                    var panX = Number(oState.getProperty("/panX" + sSuffix)) || 0;
                    var panY = Number(oState.getProperty("/panY" + sSuffix)) || 0;
                    panX += (e.clientX - lastX);
                    panY += (e.clientY - lastY);
                    lastX = e.clientX;
                    lastY = e.clientY;
                    oState.setProperty("/panX" + sSuffix, panX);
                    oState.setProperty("/panY" + sSuffix, panY);
                    that._applyZoomAndPan(oViz, bFull);
                }
                function onMouseUp() {
                    if (!dragging) return;
                    dragging = false;
                    oSvg.classList.remove("dragging");
                }

                oSvg.addEventListener("mousedown", onMouseDown);
                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);

                oSvg.addEventListener("touchstart", function (e) {
                    var z = Number(oState.getProperty("/zoomLevel" + sSuffix)) || 1;
                    if (z <= 1) return;
                    var t = e.touches[0];
                    dragging = true;
                    lastX = t.clientX;
                    lastY = t.clientY;
                    oSvg.classList.add("dragging");
                }, { passive: true });
                window.addEventListener("touchmove", function (e) {
                    if (!dragging) return;
                    var t = e.touches[0];
                    var panX = Number(oState.getProperty("/panX" + sSuffix)) || 0;
                    var panY = Number(oState.getProperty("/panY" + sSuffix)) || 0;
                    panX += (t.clientX - lastX);
                    panY += (t.clientY - lastY);
                    lastX = t.clientX;
                    lastY = t.clientY;
                    oState.setProperty("/panX" + sSuffix, panX);
                    oState.setProperty("/panY" + sSuffix, panY);
                    that._applyZoomAndPan(oViz, bFull);
                }, { passive: true });
                window.addEventListener("touchend", function () {
                    if (!dragging) return;
                    dragging = false;
                    oSvg.classList.remove("dragging");
                });

                oViz.__panHandlersAttached = true;
            }



        });
    });
