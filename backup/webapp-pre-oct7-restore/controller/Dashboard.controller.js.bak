sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/viz/ui5/controls/VizFrame",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/controls/common/feeds/FeedItem",
    "sap/ui/export/library",
    "sap/ui/export/Spreadsheet"
], function (Controller, JSONModel, Fragment, VizFrame, FlattenedDataset, FeedItem, exportLibrary, Spreadsheet) {
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
                view: "table"
            });
            this.getView().setModel(oViewModel, "view");

            // Load mock data as named model
            var oMockDataModel = new JSONModel();
            oMockDataModel.loadData("model/mockData.json");
            oMockDataModel.attachRequestCompleted(function () {
                // Keep a copy of full dataset for filtering
                var aAllChartData = oMockDataModel.getProperty("/ChartData") || [];
                oMockDataModel.setProperty("/ChartDataFull", aAllChartData.slice(0));
                // Initialize current chart data to full dataset for initial render
                oMockDataModel.setProperty("/ChartData", aAllChartData.slice(0));
                // Initialize pie chart aggregation based on full data
                this._updatePieChartData(aAllChartData);
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
                }
            }.bind(this));
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

        onPressGo: function (oEvent) {
            var oTestTypeSelect = this.byId("testTypeSelect");
            var oTestPlanSelect = this.byId("testPlanSelect");
            var oDateRange = this.byId("dateRange");

            var sTestType = oTestTypeSelect.getSelectedKey();
            var sTestPlan = oTestPlanSelect.getSelectedKey();
            var oDateFrom = oDateRange.getDateValue();
            var oDateTo = oDateRange.getSecondDateValue();

            if (this._isLiveMode()) {
                var aFilters = [];
                if (sTestType) { aFilters.push("SDDocumentCategory eq '" + encodeURIComponent(sTestType) + "'"); }
                if (sTestPlan) { aFilters.push("TestPlan eq '" + encodeURIComponent(sTestPlan) + "'"); }
                if (oDateFrom) { aFilters.push("WeekOfOrder ge datetime'" + this._fmtDateTime(oDateFrom) + "'"); }
                if (oDateTo) { aFilters.push("WeekOfOrder le datetime'" + this._fmtDateTime(oDateTo) + "'"); }
                var sFilter = aFilters.join(" and ");

                var oOData = this.getOwnerComponent().getModel();
                var that = this;
                oOData.read("/ZI_VIC_UnconfirmedDemandSet", {
                    urlParameters: sFilter ? { "$filter": sFilter, "$format": "json" } : { "$format": "json" },
                    success: function(oData) {
                        var aTransformed = that._transformToChartData(oData.results || []);
                        var oMock = that.getView().getModel("mock");
                        oMock.setProperty("/ChartData", aTransformed);
                        oMock.setProperty("/ChartDataFull", aTransformed.slice(0));
                        that._updatePieChartData(aTransformed);
                    },
                    error: function(err) {
                        // sap.m.MessageToast.show("Live read failed; retaining last data");
                    }
                });
                return;
            }

            var oMockModel = this.getView().getModel("mock");
            var aTestPlans = oMockModel.getProperty("/TestPlans") || [];

            var aFilteredData = aTestPlans.filter(function(oPlan) {
                var bTestTypeMatch = sTestType ? oPlan.testType === sTestType : true;
                var bTestPlanMatch = sTestPlan ? oPlan.id === sTestPlan : true;
                return bTestTypeMatch && bTestPlanMatch;
            });

            var aChartData = [];
            var aAllChartData = oMockModel.getProperty("/ChartDataFull") || oMockModel.getProperty("/ChartData") || [];
            aFilteredData.forEach(function(oPlan) {
                var oChartDataItem = aAllChartData.find(function(oItem) {
                    return oItem.ProductArea === oPlan.productArea;
                });
                if (oChartDataItem) {
                    aChartData.push(oChartDataItem);
                }
            });

            oMockModel.setProperty("/ChartData", aChartData);
            this._updatePieChartData(aChartData);
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
            this.getView().getModel("view").setProperty("/view", sKey);
        },
        
        onToggleLive: function(oEvent) {
            var bPressed = oEvent.getParameter("state") || oEvent.getParameter("pressed");
            this.getOwnerComponent().getModel("state").setProperty("/liveMode", !!bPressed);
            if (bPressed) {
                this.getOwnerComponent().getEventBus().publish("vic", "odataAvailable");
            }
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
                // Column / Bar / Line / Stacked variants on ChartData
                var oDataset = new FlattenedDataset({
                    data: { path: "mock>/ChartData" },
                    dimensions: [{ name: "ProductArea", value: "{mock>ProductArea}" }],
                    measures: [
                        { name: "Sim100", value: "{mock>Sim100}" },
                        { name: "Sim99", value: "{mock>Sim99}" },
                        { name: "SimLess", value: "{mock>SimLess}" }
                    ]
                });
                oViz.setDataset(oDataset);

                var feedValue = new FeedItem({ uid: "valueAxis", type: "Measure", values: ["Sim100","Sim99","SimLess"] });
                var feedCategory = new FeedItem({ uid: "categoryAxis", type: "Dimension", values: ["ProductArea"] });
                oViz.addFeed(feedValue);
                oViz.addFeed(feedCategory);

                // handle stacked variants
                var sType = sChartType;
                if (sChartType === "stacked_column") sType = "stacked_column";
                if (sChartType === "stacked_bar") sType = "stacked_bar";
                oViz.setVizType(sType);
            }
        },

        onChartSelect: function(oEvent) {
            var aData = oEvent.getParameter("data");
            if (!aData || !aData.length) { return; }
            var oPt = aData[0];
            var oCtx = (oPt && (oPt.data || oPt.dataContext || {})) || {};
            var sKey = oCtx.TestPlan || oCtx.ProductArea || oCtx.label || "";
            if (!sKey) { return; }

            var bNav = this.getView().getModel("state").getProperty("/chartNavEnabled");
            if (!bNav) {
                sap.m.MessageToast.show("Selected: " + sKey);
                return;
            }
            // Internal navigation to table filtered + navigate to detail page
            this._navigateToTestPlanInternal(sKey);
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
        }

    });
});
