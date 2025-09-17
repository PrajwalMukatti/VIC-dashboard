sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/viz/ui5/controls/VizFrame",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/controls/common/feeds/FeedItem",
    "sap/ui/export/library",
    "sap/ui/export/Spreadsheet",
    "sap/m/MessageToast",
    "sap/m/ActionSheet",
    "sap/m/Dialog",
    "sap/m/Image",
    "sap/vic/dashboard/model/rowAdapter"
], function (Controller, JSONModel, Fragment, VizFrame, FlattenedDataset, FeedItem, exportLibrary, Spreadsheet, MessageToast, ActionSheet, Dialog, Image, RowAdapter) {
    "use strict";

    return Controller.extend("sap.vic.dashboard.controller.Dashboard", {
        onInit: function () {
            // Use the Component-level state model so view bindings (state>/...) stay in sync
            var oStateModel = this.getOwnerComponent().getModel("state") || new JSONModel({});
            if (oStateModel.getProperty("/headerExpanded") === undefined) {
                oStateModel.setProperty("/headerExpanded", true);
            }
            if (!oStateModel.getProperty("/chartType")) {
                oStateModel.setProperty("/chartType", "column");
            }
            if (oStateModel.getProperty("/chartNavEnabled") === undefined) {
                oStateModel.setProperty("/chartNavEnabled", false);
            }
            this.getView().setModel(oStateModel, "state");

            var oViewModel = new JSONModel({
                view: "table",
                chartZoom: 1
            });
            this.getView().setModel(oViewModel, "view");
            // Initialize table column metadata, sort/filter state for Table View
            this._onInitTableSettings();

            // ShellBar: ensure 'shell' model and detect FLP environment to control visibility
            if (!this.getView().getModel("shell")) {
                this.getView().setModel(new JSONModel({
                    ui: {
                        shell: {
                            logo: "/resources/sap-ui-core/images/sap-logo.png",
                            title: "VIC Dashboard",
                            subTitle: "Version 2",
                            profile: { initials: "VD" },
                            version: "v2"
                        }
                    }
                }), "shell");
            }
            try {
                var bInFLP = !!(window.sap && sap.ushell && sap.ushell.Container);
                this.getOwnerComponent().getModel("state").setProperty("/isInFLP", bInFLP);
            } catch (e) {
                this.getOwnerComponent().getModel("state").setProperty("/isInFLP", false);
            }

            // Load mock data as named model
            var oMockDataModel = new JSONModel();
            oMockDataModel.loadData("model/mockData.json");
            oMockDataModel.attachRequestCompleted(function () {
                // Build ChartDataFull from the richest available source in the mock JSON:
                // 1) Use ChartDataFull if present
                // 2) Else synthesize from TestPlans (preferred for v2 file)
                // 3) Else fall back to legacy ChartData (aggregated)
                var aFull = oMockDataModel.getProperty("/ChartDataFull");
                if (!Array.isArray(aFull) || !aFull.length) {
                    var aPlans = oMockDataModel.getProperty("/TestPlans") || [];
                    if (Array.isArray(aPlans) && aPlans.length) {
                        aFull = aPlans.map(function (p) {
                            return {
                                TestType: p.testType || "",
                                TestPlan: p.name || "",
                                ProductArea: p.productArea || "",
                                SimilarityPercent: null, // adapter will apply fallback (e.g., 95)
                                TestPlanId: p.id || ""
                            };
                        });
                    } else {
                        var aLegacy = oMockDataModel.getProperty("/ChartData") || [];
                        aFull = aLegacy.slice(0);
                    }
                }
                // Adapt simplified rows to rich shape (idempotent; no-op if already rich)
                try {
                    if (RowAdapter && RowAdapter.adaptRows) {
                        aFull = RowAdapter.adaptRows(aFull, { totalTests: 100 });
                    }
                } catch (e) {
                    if (console && console.warn) { console.warn("RowAdapter error:", e); }
                }
                // Set enriched per-plan dataset
                oMockDataModel.setProperty("/ChartDataFull", aFull.slice(0));
                // Set initial aggregated ChartData by ProductArea (use existing ChartData if already provided)
                var aAgg = oMockDataModel.getProperty("/ChartData");
                if (!Array.isArray(aAgg) || !aAgg.length) {
                    var m = {};
                    aFull.forEach(function (r) {
                        var pa = (r.ProductArea || "").trim();
                        if (!pa) return;
                        if (!m[pa]) m[pa] = { ProductArea: pa, Sim100: 0, Sim99: 0, SimLess: 0 };
                        m[pa].Sim100 += Number(r.Sim100 || 0);
                        m[pa].Sim99  += Number(r.Sim99 || 0);
                        m[pa].SimLess+= Number(r.SimLess || 0);
                    });
                    aAgg = Object.keys(m).sort().map(function (k) { return m[k]; });
                }
                oMockDataModel.setProperty("/ChartData", aAgg);
                // Initialize filtered full dataset for charts (per-plan data)
                oMockDataModel.setProperty("/FilteredFull", aFull.slice(0));
                // Init selections (arrays for multi-select) and compute initial dependent lists
                oMockDataModel.setProperty("/Selections", {
                    TestType: [], ProductArea: [], TestPlan: [], Similarity: [], DateFrom: null, DateTo: null
                });
                this._rebuildSelectorLists();
                // Initialize pie chart aggregation based on full data
                this._updatePieChartData(aFull);
                try { console.info("[Adapter] Initialized rows:", aFull.length); } catch (e) {}
            }.bind(this));
            this.getView().setModel(oMockDataModel, "mock");
            this.getOwnerComponent().getEventBus().subscribe("vic", "odataAvailable", this._onODataAvailable, this);

            this.getView().attachAfterRendering(function() {
                var oViz = this.getView().byId("mainViz");
                if (oViz) {
                    // basic properties + labels
                    oViz.setVizProperties({
                        plotArea: { dataLabel: { visible: true } },
                        title: { visible: false }
                    });
                    var oPopOver = this.getView().byId("idPopOver");
                    if (oPopOver) {
                        oPopOver.connect(oViz.getVizUid());
                    }
                    // ensure feeds/dataset reflect current type
                    var sType = this.getView().getModel("state").getProperty("/chartType") || "column";
                    this._applyChartConfig(sType);
                    // apply initial zoom (CSS scale) for chart container
                    var z = (this.getView().getModel("view").getProperty("/chartZoom") || 1);
                    if (this._applyChartZoom) { this._applyChartZoom(z); }
                }
            }.bind(this));
        },

        // ShellBar handlers (visible only when not inside FLP)
        onShellSearch: function (oEvent) {
            var sQuery = oEvent && (oEvent.getParameter("query") || oEvent.getParameter("value"));
            if (!sQuery || !String(sQuery).trim()) {
                // No-op; keep current dataset
                return;
            }
            var oMock = this.getView().getModel("mock");
            var aFull = oMock.getProperty("/ChartDataFull") || [];
            var s = String(sQuery).toLowerCase();
            var aFiltered = aFull.filter(function (r) {
                return (r && r.TestPlan && String(r.TestPlan).toLowerCase().indexOf(s) !== -1);
            });
            oMock.setProperty("/ChartData", aFiltered);
            // Show table view for results
            var oVM = this.getView().getModel("view");
            if (oVM) { oVM.setProperty("/view", "table"); }
            MessageToast.show("Search results: " + aFiltered.length);
        },

        onNotificationsPressed: function () {
            MessageToast.show("Notifications – implement list here.");
        },

        onProfilePressed: function () {
            MessageToast.show("Profile – open user menu here.");
        },

        onPressAppLogo: function () {
            // Simple home action: switch to chart view
            var oVM = this.getView().getModel("view");
            if (oVM) { oVM.setProperty("/view", "chart"); }
            MessageToast.show("Home");
        },

        onPressHelp: function () {
            MessageToast.show("Help – open documentation.");
        },

        onValueHelpRequested: function (oEvent) {
            var sInputValue = oEvent.getSource().getId();
            var oView = this.getView();

            if (sInputValue.includes("testType")) {
                if (!this._pValueHelpDialog) {
                    this._pValueHelpDialog = Fragment.load({
                        id: oView.getId(),
                        name: "sap.vic.dashboard.view.ValueHelpDialog",
                        controller: this
                    }).then(function (oValueHelpDialog) {
                        oView.addDependent(oValueHelpDialog);
                        return oValueHelpDialog;
                    });
                }
                this._pValueHelpDialog.then(function (oValueHelpDialog) {
                    oValueHelpDialog.open();
                });
            } else if (sInputValue.includes("testPlan")) {
                if (!this._pTestPlanValueHelpDialog) {
                    this._pTestPlanValueHelpDialog = Fragment.load({
                        id: oView.getId(),
                        name: "sap.vic.dashboard.view.TestPlanValueHelpDialog",
                        controller: this
                    }).then(function (oValueHelpDialog) {
                        oView.addDependent(oValueHelpDialog);
                        return oValueHelpDialog;
                    });
                }
                this._pTestPlanValueHelpDialog.then(function (oValueHelpDialog) {
                    oValueHelpDialog.open();
                });
            }
        },

        onValueHelpOkPress: function (oEvent) {
            var aTokens = oEvent.getParameter("tokens");
            var sFieldName = this._getFieldName(oEvent.getSource().getId());
            var oInput = this.byId(sFieldName);
            oInput.setTokens(aTokens);
            oEvent.getSource().close();
        },

        onValueHelpCancelPress: function (oEvent) {
            oEvent.getSource().close();
        },

        onPressGo: function () {
            // Sync selections from UI once and apply filters
            this._getSelectionsFromUI();
            this._applyAllFilters();
        },

        _updatePieChartData: function(aData) {
            var oMockModel = this.getView().getModel("mock");
            if (!oMockModel) { return; }
            var aChartData = aData || oMockModel.getProperty("/ChartData");
            if (!aChartData) { return; }
            
            var oPieChartTotals = {
                "Sim100": 0,
                "Sim99": 0,
                "SimLess": 0
            };

            aChartData.forEach(function(oItem) {
                oPieChartTotals.Sim100 += oItem.Sim100 || 0;
                oPieChartTotals.Sim99 += oItem.Sim99 || 0;
                oPieChartTotals.SimLess += oItem.SimLess || 0;
            });

            var aPieChartData = [
                { "Status": "Sim100", "Count": oPieChartTotals.Sim100 },
                { "Status": "Sim99", "Count": oPieChartTotals.Sim99 },
                { "Status": "SimLess", "Count": oPieChartTotals.SimLess }
            ];

            oMockModel.setProperty("/PieChartData", aPieChartData);
        },

        _isLiveMode: function () {
            var oState = this.getOwnerComponent().getModel("state");
            return oState && oState.getProperty("/liveMode");
        },

        _onODataAvailable: function () {
            var oOData = this.getOwnerComponent().getModel();
            var that = this;
            var sEntitySet = "/ZI_VIC_UnconfirmedDemandSet";
            oOData.read(sEntitySet, {
                urlParameters: { "$top": "200", "$format": "json" },
                success: function (oData) {
                    var aTransformed = that._transformToChartData(oData.results || []);
                    var oMock = that.getView().getModel("mock");
                    oMock.setProperty("/ChartData", aTransformed);
                    oMock.setProperty("/ChartDataFull", aTransformed.slice(0));
                    that._updatePieChartData(aTransformed);
                },
                error: function () {
                    // stay on mock
                }
            });
        },

        _transformToChartData: function (aRows) {
            return (aRows || []).map(function (r) {
                return {
                    ProductArea: r.SDDocumentCategory || r.ProductArea || "N/A",
                    Sim100: Number(r.ConfirmedDemand) || 0,
                    Sim99: Number(r.DelayedDemand) || 0,
                    SimLess: Number(r.UnconfirmedDemand) || 0
                };
            });
        },

        _fmtDate: function (d) {
            var pad = function (n) { return n < 10 ? "0" + n : n; };
            return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
        },
        
        _fmtDateTime: function (d) {
            return this._fmtDate(d) + "T00:00:00";
        },

        onReset: function (oEvent) {
            // Implement reset logic here
        },

        onChartSelectChange: function(oEvent) {
            // Implement chart change logic here
        },

        _getFieldName: function(sControlId) {
            if (sControlId.includes("testType")) {
                return "testTypeInput";
            } else if (sControlId.includes("testPlan")) {
                return "testPlanInput";
            }
        },

        onTestTypeChange: function(oEvent) {
            var sSelectedTestType = oEvent.getParameter("selectedItem").getKey();
            var oTestPlanSelect = this.byId("testPlanSelect");
            var oModel = this.getView().getModel("mock");
            var aTestPlans = oModel.getProperty("/TestPlans") || [];
            var aFilteredPlans = aTestPlans.filter(function(oPlan) {
                return oPlan.testType === sSelectedTestType;
            });
            oTestPlanSelect.bindItems({
                path: "testPlan>/TestPlans",
                template: new sap.ui.core.Item({
                    key: "{testPlan>id}",
                    text: "{testPlan>name}"
                })
            });
            oTestPlanSelect.setModel(new JSONModel({ "TestPlans": aFilteredPlans }), "testPlan");
            oTestPlanSelect.setEnabled(true);
        },

        onViewChange: function(oEvent) {
            var sKey = oEvent.getParameter("key");
            var oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/view", sKey);
            // when switching back to chart, re-apply current zoom level
            if (sKey === "chart" && this._applyChartZoom) {
                var z = oViewModel.getProperty("/chartZoom") || 1;
                this._applyChartZoom(z);
            }
        },
        
        onToggleLive: function(oEvent) {
            var bPressed = oEvent.getParameter("state") || oEvent.getParameter("pressed");
            this.getOwnerComponent().getModel("state").setProperty("/liveMode", !!bPressed);
            if (bPressed) {
                this.getOwnerComponent().getEventBus().publish("vic", "odataAvailable");
            }
        },

        // Disabled in UI; kept for future auth wiring
        onExecute: function () {
            MessageToast.show("Execute requires VIC team authorization before activation.");
        },

        onToggleChartNav: function(oEvent) {
            var bPressed = oEvent.getParameter("pressed");
            this.getView().getModel("state").setProperty("/chartNavEnabled", !!bPressed);
        },

        onChartTypeChange: function(oEvent) {
            var sKey = (oEvent.getParameter("selectedItem") && oEvent.getParameter("selectedItem").getKey()) || oEvent.getSource().getSelectedKey();
            this.getView().getModel("state").setProperty("/chartType", sKey);
            this._applyChartConfig(sKey);
        },

        _applyChartConfig: function(sChartType) {
            var oViz = this.byId("mainViz");
            if (!oViz) { return; }

            // Clear feeds and set dataset based on chart type
            oViz.removeAllFeeds();

            if (sChartType === "pie" || sChartType === "donut") {
                // Use aggregated PieChartData
                var oPieDataset = new FlattenedDataset({
                    data: { path: "mock>/PieChartData" },
                    dimensions: [{ name: "label", value: "{Status}" }],
                    measures: [{ name: "value", value: "{Count}" }]
                });
                oViz.setDataset(oPieDataset);

                var feedSize = new FeedItem({ uid: "size", type: "Measure", values: ["value"] });
                var feedColor = new FeedItem({ uid: "color", type: "Dimension", values: ["label"] });
                oViz.addFeed(feedSize);
                oViz.addFeed(feedColor);
                oViz.setVizType("pie");
                // Donut look via vizProperties
                if (sChartType === "donut") {
                    oViz.setVizProperties({ plotArea: { innerRadius: 60 } });
                } else {
                    oViz.setVizProperties({ plotArea: { innerRadius: 0 } });
                }
            } else {
                // Column / Bar / Line / Stacked variants on per-plan dataset
                var oDataset = new FlattenedDataset({
                    data: { path: "mock>/FilteredFull" },
                    dimensions: [{ name: "TestPlan", value: "{mock>TestPlan}" }],
                    measures: [
                        { name: "Sim100", value: "{mock>Sim100}" },
                        { name: "Sim99", value: "{mock>Sim99}" },
                        { name: "SimLess", value: "{mock>SimLess}" }
                    ]
                });
                oViz.setDataset(oDataset);

                var feedValue = new FeedItem({ uid: "valueAxis", type: "Measure", values: ["Sim100","Sim99","SimLess"] });
                var feedCategory = new FeedItem({ uid: "categoryAxis", type: "Dimension", values: ["TestPlan"] });
                oViz.addFeed(feedValue);
                oViz.addFeed(feedCategory);

                // handle stacked variants
                var sType = sChartType;
                if (sChartType === "stacked_column") sType = "stacked_column";
                if (sChartType === "stacked_bar") sType = "stacked_bar";
                oViz.setVizType(sType);
            }
        },

        onChartSelect: function (oEvent) {
            var aData = oEvent.getParameter("data");
            if (!aData || !aData.length) { return; }
            var oHit = aData[0];
            var oData = (oHit && (oHit.data || oHit.dataContext)) || {};

            // Prefer explicit TestPlanId, then TestPlan
            var sPlanId = oData.TestPlanId || oData.testPlanId || oData.TestPlan || oData.testplan;
            if (sPlanId) {
                this._navigateToTestPlan(String(sPlanId));
                return;
            }
            // Fallback: navigate with ProductArea/label
            var sArea = oData.ProductArea || oData.productarea || oData.label;
            if (sArea) {
                this._navigateToTestPlan("AREA-" + String(sArea));
            }
        },

        _navigateToTestPlanInternal: function(sKey) {
            var oMock = this.getView().getModel("mock");
            var aFull = oMock.getProperty("/ChartDataFull") || oMock.getProperty("/ChartData") || [];
            var aFiltered = aFull.filter(function(r){
                return r.TestPlan === sKey || r.ProductArea === sKey || r.TestPlanId === sKey;
            });
            if (aFiltered.length) {
                oMock.setProperty("/ChartData", aFiltered);
                this._updatePieChartData(aFiltered);
            }
            // switch to table and navigate to detail page (first matching item)
            this.getView().getModel("view").setProperty("/view", "table");
            var sId = (aFiltered[0] && (aFiltered[0].TestPlanId || aFiltered[0].ProductArea)) || sKey;
            this.getOwnerComponent().getRouter().navTo("detail", { id: encodeURIComponent(sId) });
        },

        // Navigate to TestPlan detail - uses router if available; fallback to hash
        _navigateToTestPlan: function (sTestPlanId) {
            if (!sTestPlanId) { return; }
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            if (oRouter && typeof oRouter.navTo === "function") {
                try {
                    // If your app defines a 'TestPlanDetail' route, this will work.
                    oRouter.navTo("TestPlanDetail", { planId: encodeURIComponent(sTestPlanId) }, false);
                    return;
                } catch (e) {
                    if (console && console.warn) { console.warn("Router nav failed, fallback to hash:", e); }
                }
            }
            // Fallback to hash navigation (dummy page)
            window.location.hash = "#/TestPlan/" + encodeURIComponent(sTestPlanId);
        },

        onRowPress: function(oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oCtx = oItem && oItem.getBindingContext("mock");
            var oObj = oCtx && oCtx.getObject();
            if (!oObj) { return; }
            var sId = oObj.TestPlanId || oObj.ProductArea || "";
            this.getOwnerComponent().getRouter().navTo("detail", { id: encodeURIComponent(sId) });
        },

        createColumnConfig: function() {
            return [
                { label: 'Product Area', property: 'ProductArea', type: 'string' },
                { label: 'Sim 100', property: 'Sim100', type: 'number' },
                { label: 'Sim 99', property: 'Sim99', type: 'number' },
                { label: 'Sim Less', property: 'SimLess', type: 'number' }
            ];
        },

        onExport: function() {
            var oTable = this.byId('tableView');
            var oRowBinding = oTable.getBinding('items');
            var aCols = this.createColumnConfig();

            // In case there is no data, the binding will be undefined.
            if (!oRowBinding) {
                sap.m.MessageToast.show("No data to export.");
                return;
            }

            var oModel = oRowBinding.getModel();
            var oModelData = oModel.getProperty(oRowBinding.getPath());

            if (!oModelData || oModelData.length === 0) {
                sap.m.MessageToast.show("No data to export.");
                return;
            }

            var oSettings = {
                workbook: {
                    columns: aCols
                },
                dataSource: oModelData,
                fileName: 'DashboardData.xlsx',
                worker: false // for local execution
            };

            var oSheet = new Spreadsheet(oSettings);
            oSheet.build().then(function() {
                sap.m.MessageToast.show("Data exported successfully.");
            }).finally(function() {
                oSheet.destroy();
            });
        },

        // ===== Column settings & table sort/filter implementation =====
        _onInitTableSettings: function () {
            var oView = this.getView();
            var vm = oView.getModel("view");
            if (!vm) {
                vm = new JSONModel({ view: "table", chartZoom: 1 });
                oView.setModel(vm, "view");
            }
            if (!vm.getProperty("/columns")) {
                vm.setProperty("/columns", {
                    ProductArea:        { key: "ProductArea",        label: "Product Area",     visible: true,  type: "string" },
                    TestType:           { key: "TestType",           label: "Test Type",       visible: true,  type: "string" },
                    TestPlan:           { key: "TestPlan",           label: "Test Plan",       visible: true,  type: "string" },
                    Sim100:             { key: "Sim100",             label: "Sim 100",         visible: true,  type: "number" },
                    Sim99:              { key: "Sim99",              label: "Sim 99",          visible: true,  type: "number" },
                    SimLess:            { key: "SimLess",            label: "Sim Less",        visible: true,  type: "number" },
                    SimilarityPercent:  { key: "SimilarityPercent",  label: "Similarity %",    visible: true,  type: "number" },
                    TestPlanId:         { key: "TestPlanId",         label: "TestPlanId",      visible: true,  type: "string" }
                });
            }
            if (!vm.getProperty("/tableSort")) {
                vm.setProperty("/tableSort", { key: null, dir: "asc" });
            }
            if (!vm.getProperty("/tableFilters")) {
                vm.setProperty("/tableFilters", {});
            }
        },
        
        onOpenColumnSettings: function () {
            var that = this;
            var oView = this.getView();
            var oViewModel = oView.getModel("view");
            if (!oViewModel) { this._onInitTableSettings(); oViewModel = oView.getModel("view"); }
        
            if (this._oSettingsDialog) {
                this._oSettingsDialog.open();
                return;
            }
        
            // Columns tab
            var oColumnsVBox = new sap.m.VBox({ width: "100%" });
            var oSearch = new sap.m.SearchField({
                placeholder: "Search columns",
                liveChange: function (oEvt) {
                    var s = (oEvt.getParameter("newValue") || "").toLowerCase();
                    oColsList.getItems().forEach(function (chk) {
                        var txt = (chk.data("label") || "").toLowerCase();
                        chk.setVisible(!s || txt.indexOf(s) !== -1);
                    });
                },
                width: "100%"
            });
            var oHideUnselected = new sap.m.Switch({
                state: false, change: function (oEvt) {
                    var b = !!oEvt.getParameter("state");
                    oColsList.getItems().forEach(function (chk) {
                        if (!chk.getSelected()) chk.setVisible(!b);
                    });
                }
            });
            var oColsHeader = new sap.m.HBox({
                items: [ oSearch, new sap.m.Label({ text: "Hide Unselected" }), oHideUnselected ],
                justifyContent: "SpaceBetween"
            });
            var aColsMeta = Object.keys(oViewModel.getProperty("/columns") || {}).map(function (k) {
                return oViewModel.getProperty("/columns/" + k);
            });
            var oColsList = new sap.m.VBox({ width: "100%", items: [] });
            aColsMeta.forEach(function (col) {
                var oChk = new sap.m.CheckBox({ text: col.label, selected: !!col.visible });
                oChk.data("colKey", col.key);
                oChk.data("label", col.label);
                oColsList.addItem(oChk);
            });
            oColumnsVBox.addItem(oColsHeader);
            oColumnsVBox.addItem(oColsList);
        
            // Sort tab
            var aColOptions = aColsMeta.map(function (c) { return new sap.ui.core.Item({ key: c.key, text: c.label }); });
            var oSortVBox = new sap.m.VBox({
                items: [
                    new sap.m.Label({ text: "Sort by" }),
                    new sap.m.Select({ id: this.createId("settingsSortCol"), items: aColOptions, width: "100%" }),
                    new sap.m.SegmentedButton({
                        id: this.createId("settingsSortDir"),
                        selectedKey: "asc",
                        items: [
                            new sap.m.SegmentedButtonItem({ key: "asc", text: "Ascending" }),
                            new sap.m.SegmentedButtonItem({ key: "desc", text: "Descending" })
                        ]
                    })
                ]
            });
        
            // Filter tab
            var oFilterVBox = new sap.m.VBox({ items: [] });
            aColsMeta.forEach(function (c) {
                var oLabel = new sap.m.Label({ text: c.label });
                var oInput = new sap.m.Input({ width: "100%" });
                oInput.data("colKey", c.key);
                oFilterVBox.addItem(oLabel);
                oFilterVBox.addItem(oInput);
            });
        
            var oIconTabs = new sap.m.IconTabBar({
                items: [
                    new sap.m.IconTabFilter({ text: "Columns", key: "columns", content: [ oColumnsVBox ] }),
                    new sap.m.IconTabFilter({ text: "Sort", key: "sort", content: [ oSortVBox ] }),
                    new sap.m.IconTabFilter({ text: "Filter", key: "filter", content: [ oFilterVBox ] })
                ]
            });
        
            this._oSettingsDialog = new sap.m.Dialog({
                title: "View Settings",
                contentWidth: "800px",
                content: [ oIconTabs ],
                beginButton: new sap.m.Button({
                    text: "OK",
                    press: function () {
                        // Columns
                        oColsList.getItems().forEach(function (chk) {
                            var key = chk.data("colKey");
                            oViewModel.setProperty("/columns/" + key + "/visible", chk.getSelected());
                        });
                        // Sort
                        var sCol = that.byId(that.createId("settingsSortCol")).getSelectedKey();
                        var sDir = that.byId(that.createId("settingsSortDir")).getSelectedKey();
                        oViewModel.setProperty("/tableSort/key", sCol);
                        oViewModel.setProperty("/tableSort/dir", sDir);
                        if (sCol) { that._applyTableSort(sCol, sDir); }
                        // Filters
                        var filters = {};
                        oFilterVBox.getItems().forEach(function (it) {
                            if (it && it.isA && it.isA("sap.m.Input")) {
                                var key = it.data("colKey");
                                var val = it.getValue && it.getValue();
                                if (key && val && String(val).trim()) { filters[key] = String(val).trim(); }
                            }
                        });
                        oViewModel.setProperty("/tableFilters", filters);
                        that._applyTableFilters(filters);
                        that._oSettingsDialog.close();
                    }
                }),
                endButton: new sap.m.Button({ text: "Cancel", press: function () { that._oSettingsDialog.close(); } }),
                beforeOpen: function () {
                    // sync current state
                    oColsList.getItems().forEach(function (chk) {
                        var key = chk.data("colKey");
                        chk.setSelected(!!oViewModel.getProperty("/columns/" + key + "/visible"));
                    });
                    var sKey = oViewModel.getProperty("/tableSort/key") || "";
                    var sDir = oViewModel.getProperty("/tableSort/dir") || "asc";
                    var oSel = that.byId(that.createId("settingsSortCol"));
                    var oDir = that.byId(that.createId("settingsSortDir"));
                    if (oSel) oSel.setSelectedKey(sKey);
                    if (oDir) oDir.setSelectedKey(sDir);
                    var filters = oViewModel.getProperty("/tableFilters") || {};
                    oFilterVBox.getItems().forEach(function (it) {
                        if (it && it.isA && it.isA("sap.m.Input")) {
                            var k = it.data("colKey");
                            it.setValue(filters[k] || "");
                        }
                    });
                }
            });
            this.getView().addDependent(this._oSettingsDialog);
            this._oSettingsDialog.open();
        },
        
        _applyTableSort: function (colKey, dir) {
            var oMock = this.getView().getModel("mock");
            var aData = (oMock && oMock.getProperty("/ChartData")) || [];
            if (!colKey) return;
            var isNumeric = !!(aData.length && typeof aData[0][colKey] === "number");
            aData.sort(function (a, b) {
                var av = a[colKey], bv = b[colKey];
                if (av === undefined || av === null) av = isNumeric ? -Infinity : "";
                if (bv === undefined || bv === null) bv = isNumeric ? -Infinity : "";
                if (isNumeric) { return dir === "asc" ? av - bv : bv - av; }
                var sA = String(av).toLowerCase(), sB = String(bv).toLowerCase();
                if (sA < sB) return dir === "asc" ? -1 : 1;
                if (sA > sB) return dir === "asc" ? 1 : -1;
                return 0;
            });
            oMock.setProperty("/ChartData", aData.slice());
        },
        
        _applyTableFilters: function (filters) {
            var oMock = this.getView().getModel("mock");
            if (!oMock) return;
            var aBase = (oMock.getProperty("/ChartData") || []).slice();
            if (!filters || !Object.keys(filters).length) {
                // no additional table filters; leave as-is (main dashboard filters apply elsewhere)
                return;
            }
            var aFiltered = aBase.filter(function (r) {
                if (!r) return false;
                return Object.keys(filters).every(function (k) {
                    var val = filters[k];
                    if (!val) return true;
                    var cell = r[k];
                    if (cell === undefined || cell === null) return false;
                    return String(cell).toLowerCase().indexOf(String(val).toLowerCase()) !== -1;
                });
            });
            oMock.setProperty("/ChartData", aFiltered);
            // keep pie in sync with displayed rows (optional)
            if (typeof this._updatePieChartData === "function") {
                this._updatePieChartData(aFiltered);
            }
        },
        
        onHeaderSortPress: function (oEvt) {
            var sCol = oEvt.getSource().data("col");
            var vm = this.getView().getModel("view");
            var prev = (vm && vm.getProperty("/tableSort")) || { key: null, dir: "asc" };
            var newDir = (prev.key === sCol ? (prev.dir === "asc" ? "desc" : "asc") : "asc");
            vm.setProperty("/tableSort/key", sCol);
            vm.setProperty("/tableSort/dir", newDir);
            this._applyTableSort(sCol, newDir);
        },
        
        onHeaderFilterPress: function (oEvt) {
            var sCol = oEvt.getSource().data("col");
            var that = this;
            var vm = this.getView().getModel("view");
            var filters = (vm && vm.getProperty("/tableFilters")) || {};
            var oInput = new sap.m.Input({ placeholder: "Filter value (contains)", width: "260px", value: filters[sCol] || "" });
            var oPop = new sap.m.Popover({
                title: "Filter " + sCol,
                placement: "Bottom",
                content: [ oInput ],
                beginButton: new sap.m.Button({
                    text: "Apply",
                    press: function () {
                        var val = oInput.getValue();
                        if (val && String(val).trim()) filters[sCol] = String(val).trim();
                        else delete filters[sCol];
                        vm.setProperty("/tableFilters", filters);
                        that._applyTableFilters(filters);
                        oPop.close();
                    }
                }),
                endButton: new sap.m.Button({
                    text: "Clear",
                    press: function () {
                        delete filters[sCol];
                        vm.setProperty("/tableFilters", filters);
                        that._applyTableFilters(filters);
                        oPop.close();
                    }
                })
            });
            this.getView().addDependent(oPop);
            oPop.addStyleClass("sapUiPopupWithPadding");
            oPop.openBy(oEvt.getSource());
        },

        // Chart settings action sheet with Maximize/Restore/Copy actions
        onOpenChartSettings: function () {
            var that = this;
            if (!this._oChartActionSheet) {
                this._oChartActionSheet = new ActionSheet({
                    placement: "Bottom",
                    buttons: [
                        new sap.m.Button({ text: "Maximize", icon: "sap-icon://full-screen", press: function(){ that._openChartFullscreen(); } }),
                        new sap.m.Button({ text: "Restore", icon: "sap-icon://exit-full-screen", press: function(){ that._closeChartFullscreen(); } }),
                        new sap.m.Button({ text: "Copy Chart", icon: "sap-icon://copy", press: function(){ that._copyChartToClipboard(); } })
                    ]
                });
                this.getView().addDependent(this._oChartActionSheet);
            }
            var oBtn = this.byId("btnChartSettings");
            if (oBtn) {
                this._oChartActionSheet.openBy(oBtn);
            } else {
                this._oChartActionSheet.open();
            }
        },

        _openChartFullscreen: function () {
            var that = this;
            var oViz = this.byId("mainViz");
            if (!oViz) { MessageToast.show("Chart not available"); return; }

            if (!this._oChartDlg) {
                this._oChartDlg = new Dialog({
                    title: "Chart",
                    stretch: true,
                    horizontalScrolling: false,
                    verticalScrolling: false,
                    endButton: new sap.m.Button({ text: "Close", press: function(){ that._closeChartFullscreen(); } })
                });
                this.getView().addDependent(this._oChartDlg);
            }

            if (!this._vizParent) {
                this._vizParent = oViz.getParent();
            }
            // detach from parent
            if (this._vizParent) {
                if (this._vizParent.removeItem) { this._vizParent.removeItem(oViz); }
                else if (this._vizParent.removeContent) { this._vizParent.removeContent(oViz); }
            }
            this._oChartDlg.addContent(oViz);
            this._oChartDlg.open();
        },

        _closeChartFullscreen: function () {
            var oViz = this.byId("mainViz");
            if (this._oChartDlg) {
                this._oChartDlg.close();
                if (oViz) {
                    this._oChartDlg.removeContent(oViz);
                }
            }
            if (oViz && this._vizParent) {
                if (this._vizParent.addItem) { this._vizParent.addItem(oViz); }
                else if (this._vizParent.addContent) { this._vizParent.addContent(oViz); }
            }
        },

        _copyChartToClipboard: function () {
            var oViz = this.byId("mainViz");
            if (!oViz) { MessageToast.show("Chart not available"); return; }
            var el = oViz.getDomRef && oViz.getDomRef();
            if (!el) { MessageToast.show("Chart not rendered yet"); return; }
            var svg = el.querySelector && el.querySelector("svg");
            if (!svg) { MessageToast.show("Chart SVG not found"); return; }

            try {
                var xml = new XMLSerializer().serializeToString(svg);
                var svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
                var url = URL.createObjectURL(svgBlob);
                var img = new Image();
                img.onload = function () {
                    var canvas = document.createElement("canvas");
                    canvas.width = img.width || 1600;
                    canvas.height = img.height || 900;
                    var ctx = canvas.getContext("2d");
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    canvas.toBlob(function (blob) {
                        if (navigator.clipboard && window.ClipboardItem) {
                            navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })])
                                .then(function () { MessageToast.show("Chart copied to clipboard"); })
                                .catch(function () {
                                    var a = document.createElement("a");
                                    a.href = URL.createObjectURL(blob);
                                    a.download = "chart.png";
                                    a.click();
                                    MessageToast.show("Downloaded chart.png");
                                });
                        } else {
                            var a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = "chart.png";
                            a.click();
                            MessageToast.show("Downloaded chart.png");
                        }
                        URL.revokeObjectURL(url);
                    }, "image/png");
                };
                img.onerror = function(){ URL.revokeObjectURL(url); MessageToast.show("Copy failed"); };
                img.src = url;
            } catch (e) {
                if (console && console.error) console.error(e);
                MessageToast.show("Copy failed");
            }
        },
        
        // Chart actions: Maximize, Copy, Zoom In/Out
        onMaximizeChart: function () {
            this._openChartFullscreen();
        },

        onCopyChart: function () {
            this._copyChartToClipboard();
        },

        onZoomIn: function () {
            var oView = this.getView().getModel("view");
            var scale = oView.getProperty("/chartZoom") || 1;
            scale = Math.min(3, Math.round((scale + 0.25) * 100) / 100);
            oView.setProperty("/chartZoom", scale);
            this._applyChartZoom(scale);
        },
        onZoomOut: function () {
            var oView = this.getView().getModel("view");
            var scale = oView.getProperty("/chartZoom") || 1;
            scale = Math.max(0.5, Math.round((scale - 0.25) * 100) / 100);
            oView.setProperty("/chartZoom", scale);
            this._applyChartZoom(scale);
        },
        _applyChartZoom: function (scale) {
            try {
                // Only zoom the chart canvas (wrapper around VizFrame), not the action buttons
                var oCanvasBox = this.byId("chartCanvas");
                if (!oCanvasBox) return;
                var dom = oCanvasBox.getDomRef();
                if (!dom) return;
                dom.style.transformOrigin = "50% 0";
                dom.style.transform = "scale(" + scale + ")";
                // Adjust minHeight so scaled content isn't clipped
                var baseHeight = 420; // matches VizFrame height in view
                dom.style.minHeight = (baseHeight * scale) + "px";
            } catch (e) {
                if (console && console.warn) console.warn("applyChartZoom failed", e);
            }
        },
        
        // New: change handler for any FilterBar field (live filtering + dependent lists)
        onFilterBarChange: function () {
            // For date range or other single-select fields using 'change'
            this._getSelectionsFromUI();
            this._rebuildSelectorLists();
        },

        // Handle MultiComboBox selection changes (Select All + arrays in model)
        onMultiChange: function (oEvent) {
            var oSrc = oEvent.getSource();
            var sId = oSrc && oSrc.getId ? oSrc.getId() : "";
            var oMock = this.getView().getModel("mock");
            if (!oMock) return;
            var sel = oMock.getProperty("/Selections") || {};

            // current selected keys from the MultiComboBox
            var aKeys = (oSrc.getSelectedKeys && oSrc.getSelectedKeys()) || [];

            // Expand "ALL" to full list (do not keep "ALL" selected)
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
            } else if (sId.indexOf("similaritySelect") !== -1) {
                // static similarities
                expandAll(null, ["lt96","lt97","lt98","lt99","lt100"]);
                sel.Similarity = aKeys;
            }

            oMock.setProperty("/Selections", sel);
            // Rebuild only dependent lists (plans). Do not auto-apply filters.
            this._rebuildSelectorLists();
        },

        // Clear/Reset handler from FilterBar Clear button
        onFilterBarClear: function () {
            var oMock = this.getView().getModel("mock");
            if (!oMock) { return; }
            var aFull = oMock.getProperty("/ChartDataFull") || [];

            // Reset selections to arrays empty (treated as "All")
            var sel = {
                TestType: [], ProductArea: [], TestPlan: [], Similarity: [], DateFrom: null, DateTo: null
            };
            oMock.setProperty("/Selections", sel);

            // Clear UI controls
            var aIds = ["testTypeSelect","productAreaSelect","testPlanSelect","similaritySelect"];
            for (var i = 0; i < aIds.length; i++) {
                var c = this.byId(aIds[i]);
                if (c && c.setSelectedKeys) { c.setSelectedKeys([]); }
            }
            var oDR = this.byId("dateRange");
            if (oDR) {
                if (oDR.setDateValue) oDR.setDateValue(null);
                if (oDR.setSecondDateValue) oDR.setSecondDateValue(null);
                if (oDR.setValue) oDR.setValue("");
            }

            // Rebuild lists (TestType/ProductArea full; TestPlan intersection from empty → all)
            this._rebuildSelectorLists();

            // Restore full aggregated data to ChartData
            var m = {};
            aFull.forEach(function (r) {
                var pa = (r.ProductArea || "").trim();
                if (!pa) return;
                if (!m[pa]) m[pa] = { ProductArea: pa, Sim100: 0, Sim99: 0, SimLess: 0 };
                m[pa].Sim100 += Number(r.Sim100 || 0);
                m[pa].Sim99  += Number(r.Sim99 || 0);
                m[pa].SimLess+= Number(r.SimLess || 0);
            });
            var aAgg = Object.keys(m).sort().map(function (k) { return m[k]; });
            oMock.setProperty("/ChartData", aAgg.length ? aAgg : aFull.slice(0));

            // Update pie based on full dataset
            this._updatePieChartData(aFull);
        },

        // New: read current UI selections into mock>/Selections
        _getSelectionsFromUI: function () {
            var oMock = this.getView().getModel("mock");
            if (!oMock) { return; }
            var oSel = oMock.getProperty("/Selections") || {};

            var oType = this.byId("testTypeSelect");
            var oPlan = this.byId("testPlanSelect");
            var oArea = this.byId("productAreaSelect");
            var oSim  = this.byId("similaritySelect");
            var oDR   = this.byId("dateRange");

            oSel.TestType    = oType && oType.getSelectedKeys ? (oType.getSelectedKeys() || []) : (oSel.TestType || []);
            oSel.TestPlan    = oPlan && oPlan.getSelectedKeys ? (oPlan.getSelectedKeys() || []) : (oSel.TestPlan || []);
            oSel.ProductArea = oArea && oArea.getSelectedKeys ? (oArea.getSelectedKeys() || []) : (oSel.ProductArea || []);
            oSel.Similarity  = oSim && oSim.getSelectedKeys ? (oSim.getSelectedKeys() || []) : (oSel.Similarity || []);

            if (oDR && oDR.getDateValue && oDR.getSecondDateValue) {
                var dFrom = oDR.getDateValue();
                var dTo   = oDR.getSecondDateValue();
                oSel.DateFrom = dFrom ? new Date(dFrom).toISOString() : null;
                oSel.DateTo   = dTo   ? new Date(dTo).toISOString()   : null;
            }

            oMock.setProperty("/Selections", oSel);
        },

        // New: recompute lists with requested rules (multi-select + Select All)
        _rebuildSelectorLists: function () {
            var oMock = this.getView().getModel("mock");
            if (!oMock) return;
            var aFull = oMock.getProperty("/ChartDataFull") || [];
            var sel = oMock.getProperty("/Selections") || {};

            function n(s){ return s===null||s===undefined?"":String(s).trim(); }
            function eq(a,b){ return n(a).toLowerCase()===n(b).toLowerCase(); }

            // Normalize arrays (empty array means All)
            var aTypesSel = Array.isArray(sel.TestType) ? sel.TestType.filter(function(k){return k!=="ALL";}) : [];
            var aAreasSel = Array.isArray(sel.ProductArea) ? sel.ProductArea.filter(function(k){return k!=="ALL";}) : [];

            // 1) Always-full TestTypes and ProductAreas from all rows
            var mTypes = {}, mAreas = {};
            aFull.forEach(function (r) {
                if (!r) return;
                var t = n(r.TestType); if (t) mTypes[t] = true;
                var a = n(r.ProductArea); if (a) mAreas[a] = true;
            });
            var aTypes = Object.keys(mTypes).sort().map(function (k){ return { key:k, text:k }; });
            var aAreas = Object.keys(mAreas).sort().map(function (k){ return { key:k, text:k }; });

            function withAll(arr){ return [{key:"ALL", text:"Select All"}].concat(arr); }

            // 2) TestPlans depends on selected arrays (intersection)
            var mPlans = {};
            aFull.forEach(function (r) {
                if (!r) return;
                if (aTypesSel.length && aTypesSel.indexOf(n(r.TestType)) === -1) return;
                if (aAreasSel.length && aAreasSel.indexOf(n(r.ProductArea)) === -1) return;
                var p = n(r.TestPlan); if (p) mPlans[p] = true;
            });
            var aPlans = Object.keys(mPlans).sort().map(function (k){ return { key:k, text:k }; });

            // 3) Write lists to model, prepending "Select All"
            oMock.setProperty("/TestTypes", withAll(aTypes));
            oMock.setProperty("/ProductAreas", withAll(aAreas));
            oMock.setProperty("/TestPlans", withAll(aPlans));

            // 4) Clear only TestPlan if invalid (consider arrays)
            var aPlanSel = Array.isArray(sel.TestPlan) ? sel.TestPlan.filter(function(k){return k!=="ALL";}) : [];
            if (aPlanSel.length) {
                var set = {};
                aPlans.forEach(function(p){ set[p.key] = true; });
                var stillValid = aPlanSel.filter(function(k){ return !!set[k]; });
                if (stillValid.length !== aPlanSel.length) {
                    sel.TestPlan = stillValid;
                    oMock.setProperty("/Selections", sel);
                }
            }
        },

        // New: filter ChartDataFull by selections and update ChartData and pie
        _applyAllFilters: function () {
            var oMock = this.getView().getModel("mock");
            if (!oMock) return;
            var aFull = oMock.getProperty("/ChartDataFull") || [];
            var s = oMock.getProperty("/Selections") || {};

            function n(s){ return s===null||s===undefined?"":String(s).trim(); }
            function inArr(arr, v){ return arr.indexOf(n(v)) !== -1; }

            var dFrom = s.DateFrom ? new Date(s.DateFrom) : null;
            var dTo   = s.DateTo   ? new Date(s.DateTo)   : null;

            var aTypes = Array.isArray(s.TestType) ? s.TestType.filter(function(k){return k!=="ALL";}) : [];
            var aAreas = Array.isArray(s.ProductArea) ? s.ProductArea.filter(function(k){return k!=="ALL";}) : [];
            var aPlans = Array.isArray(s.TestPlan) ? s.TestPlan.filter(function(k){return k!=="ALL";}) : [];
            var aSim   = Array.isArray(s.Similarity) ? s.Similarity.filter(function(k){return k!=="ALL";}) : [];

            var aFiltered = aFull.filter(function (r) {
                if (aTypes.length && !inArr(aTypes, r.TestType)) return false;
                if (aAreas.length && !inArr(aAreas, r.ProductArea)) return false;
                if (aPlans.length && !inArr(aPlans, r.TestPlan)) return false;

                if (aSim.length) {
                    var rSim = Number(r.SimilarityPercent || 0);
                    var ok = aSim.some(function (key) {
                        var m = String(key).match(/^lt(\d+)$/);
                        if (!m) return false;
                        var th = Number(m[1]);
                        return rSim < th;
                    });
                    if (!ok) return false;
                }

                if (dFrom || dTo) {
                    var rDate = r.Date ? new Date(r.Date) : null;
                    if (dFrom && rDate && rDate < dFrom) return false;
                    if (dTo && rDate && rDate > dTo) return false;
                }
                return true;
            });

            // Update chart dataset (per-plan)
            oMock.setProperty("/FilteredFull", aFiltered);

            // Aggregate filtered rows by ProductArea for ChartData/table/chart display
            var m = {};
            aFiltered.forEach(function (r) {
                var pa = (r.ProductArea || "").trim();
                if (!pa) return;
                if (!m[pa]) m[pa] = { ProductArea: pa, Sim100: 0, Sim99: 0, SimLess: 0 };
                m[pa].Sim100 += Number(r.Sim100 || 0);
                m[pa].Sim99  += Number(r.Sim99 || 0);
                m[pa].SimLess+= Number(r.SimLess || 0);
            });
            var aAgg = Object.keys(m).sort().map(function (k) { return m[k]; });

            oMock.setProperty("/ChartData", aAgg);
            this._updatePieChartData(aFiltered);
        }

    });
});
