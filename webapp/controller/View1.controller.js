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

        return Controller.extend("vicstartintegration.controller.View1", {
            formatter: formatter,
            oCompareView: null,

            onInit: function () {
                var oStateModel = new JSONModel({ headerExpanded: true, chartType: "column", chartNavEnabled: true });
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
                            that.testPlan2Map.set(item.testPlanName, item);
                        });

                        that.getView().setModel(new JSONModel(res), "msimilaritypercent");

                        that.byId("idTblTitle").setText("Test Plans (" + res.length + ")");

                        var aTestPlan = [], aProdArea = [], aTesScp = [];
                        var aTempTestPlan = [], aTempProdArea = [], aTempTesScp = [];
                        res.forEach(function (r) {
                            if (aTempTestPlan.indexOf(r.testPlanName) === -1) { aTempTestPlan.push(r.testPlanName); aTestPlan.push(r); }
                            if (r.ProductArea && aTempProdArea.indexOf(r.ProductArea) === -1) { aTempProdArea.push(r.ProductArea); aProdArea.push(r); }
                            if (aTempTesScp.indexOf(r.TestType) === -1) { aTempTesScp.push(r.TestType); aTesScp.push(r); }
                        });
                        that.getView().setModel(new JSONModel(aTestPlan), "mTestPlan");
                        that.getView().setModel(new JSONModel(aProdArea), "mProdArea");
                        that.getView().setModel(new JSONModel(aTesScp), "mTesScp");

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
                    }
                });
            },

            onChartTypeChange: function (oEvent) {
                var sKey = (oEvent.getParameter("selectedItem") && oEvent.getParameter("selectedItem").getKey()) || oEvent.getSource().getSelectedKey();
                this.getView().getModel("state").setProperty("/chartType", sKey);
                this._applyChartConfig(sKey);
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

            _applyChartConfig: function (sChartType) {
                var oViz = this.byId("mainViz");
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
                        legend: { visible: true } 
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
                        legend: { visible: true } 
                    });
                }
                oViz.invalidate();
            },

            attachAfterRendering: function () {
                var oViz = this.byId("mainViz");
                if (!oViz) {
                    console.warn("mainViz not found");
                    return;
                }

                if (!oViz.__selectHandlerAttached) {
                    oViz.attachSelectData(this._onChartSelectData.bind(this));
                    oViz.__selectHandlerAttached = true;
                }
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
                var parts = inputString.split('_');
                if (parts.length >= 5) {
                    return parts[4];
                } else {
                    return null;
                }
            },

            getProductArea: function (testPlanName) {
                const salesKeywords = ["SALES"];
                const finKeywords = ["FIN_AA", "FIN_AFC", "FIN_COPA", "FIN_CONSL", "FIN_AP", "FIN_AR", "FIN_CM", "FIN_TRM", "FIN_EBRR", "FIN_TAXES", "FIN_AccGL"];
                const ideaKeywords = ["S4CLD_EHS", "PROD_CENT_PLM", "EPPM_FINLED_EPPM"];
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

            onFBGoPress: function (oEvent) {
                var oView = this.getView();
                var oTable = oView.byId("idTblTestPlan");
                var oBinding = oTable.getBinding("items");

                var aOrFilter = [];
                var aAndFilter = [];
                var aSelectedSimilarity = oView.byId("idMCBoxsimilarity").getSelectedKeys();

                aSelectedSimilarity.forEach(function (selectedItem) {
                    var oValue1 = selectedItem.split('%')[0];
                    var oValue2 = selectedItem.split('%')[1]?.split('-')[1];

                    if (oValue1 === '<96') {
                        oValue1 = oValue1.split('<')[1];
                        aOrFilter.push(new sap.ui.model.Filter("percentSuccess", sap.ui.model.FilterOperator.LT, oValue1));

                    } else if (oValue1 === '96' && oValue2 === '98') {
                        aOrFilter.push(new sap.ui.model.Filter("percentSuccess", sap.ui.model.FilterOperator.BT, oValue1, oValue2));
                    } else if (oValue1 === '98' && oValue2 === '99') {
                        oValue2 = '100';
                        aOrFilter.push(new sap.ui.model.Filter("percentSuccess", sap.ui.model.FilterOperator.BT, oValue1, oValue2));
                    } else if (oValue1 === '100') {
                        aOrFilter.push(new sap.ui.model.Filter("percentSuccess", sap.ui.model.FilterOperator.EQ, oValue1));
                    }
                });

                if (aOrFilter.length > 0) {
                    var oCombinedFilter = new sap.ui.model.Filter({
                        filters: aOrFilter,
                        and: false
                    });

                    aAndFilter.push(new sap.ui.model.Filter(aOrFilter, false));
                } else {
                    oBinding.filter([]);
                }

                var sSrchValue = this.getView().byId("idSearchField").getValue();
                if (sSrchValue && sSrchValue !== "" && sSrchValue !== null) {
                    aOrFilter = [];
                    aOrFilter.push(new Filter("testPlanName", FilterOperator.Contains, sSrchValue));
                    aOrFilter.push(new Filter("ProductArea", FilterOperator.Contains, sSrchValue));
                    aOrFilter.push(new Filter("TestType", FilterOperator.Contains, sSrchValue));

                    aAndFilter.push(new sap.ui.model.Filter(aOrFilter, false));
                }

                var aFilterTestPlanItems = oView.byId("idMInpTestPlan").getTokens();
                if (aFilterTestPlanItems && aFilterTestPlanItems.length > 0) {
                    for (var i = 0; i < aFilterTestPlanItems.length; i++) {
                        aOrFilter.push(new Filter("testPlanName", FilterOperator.Contains, aFilterTestPlanItems[i].getProperty("text")));
                    }
                    aAndFilter.push(new Filter(aOrFilter, false));
                }

                aOrFilter = [];
                var aFilterProdAreaItems = oView.byId("idMCBoxProdArea").getSelectedItems();
                if (aFilterProdAreaItems && aFilterProdAreaItems.length > 0) {
                    for (var i = 0; i < aFilterProdAreaItems.length; i++) {
                        aOrFilter.push(new Filter("ProductArea", FilterOperator.Contains, aFilterProdAreaItems[i].getProperty("key")));
                    }
                    aAndFilter.push(new Filter(aOrFilter, false));
                }

                aOrFilter = [];
                var aFilterTestScpItems = oView.byId("idMCBoxTestScope").getSelectedItems();
                if (aFilterTestScpItems && aFilterTestScpItems.length > 0) {
                    for (var i = 0; i < aFilterTestScpItems.length; i++) {
                        aOrFilter.push(new Filter("TestType", FilterOperator.Contains, aFilterTestScpItems[i].getProperty("key")));
                    }
                    aAndFilter.push(new Filter(aOrFilter, false));
                }

                var oFinalFilter = aAndFilter.length > 0 ? new Filter(aAndFilter, true) : null;
                oBinding.filter(oFinalFilter || []);
                oView.byId('idTblTitle').setText("Test Plans (" + oBinding.getLength() + ")");

                this._updateChartWithFilteredData();
            },

            _updateChartWithFilteredData: function () {
                var oView = this.getView();
                var oTable = oView.byId("idTblTestPlan");
                var oBinding = oTable.getBinding("items");

       
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

                var oTestPlan = this.getView().byId("idMInpTestPlan");
                oTestPlan.setTokens([]);

                var oTestType = this.getView().byId("idMCBoxTestScope");
                oTestType.setSelectedKeys([]);

                var oSimilarityComboBox = this.getView().byId("idMCBoxsimilarity");
                oSimilarityComboBox.setSelectedKeys([]);

                var oProductArea = this.getView().byId("idMCBoxProdArea");
                oProductArea.setSelectedKeys([]);

                var oTable = this.getView().byId("idTblTestPlan");
                var oBinding = oTable.getBinding("items");
                oBinding.filter([]);

                this.getView().byId('idTblTitle').setText("Test Plans (" + oBinding.getLength() + ")");

                this._resetChartToOriginalData();
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
            }



        });
    });
