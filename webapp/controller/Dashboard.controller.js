sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/viz/ui5/controls/VizFrame",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/controls/common/feeds/FeedItem"
], function (Controller, JSONModel, Fragment, VizFrame, FlattenedDataset, FeedItem) {
    "use strict";

    return Controller.extend("sap.vic.dashboard.controller.Dashboard", {
        onInit: function () {
            var oModel = new JSONModel({
                "headerExpanded": true
            });
            this.getView().setModel(oModel);

            // set mock model
            var oMockModel = new JSONModel();
            oMockModel.loadData("model/mockData.json");
            this.getView().setModel(oMockModel, "mock");

            var oVizFrame = this.getView().byId("vizFrame");
            var oPopOver = this.getView().byId("idPopOver");
            if (oPopOver) {
                oPopOver.connect(oVizFrame.getVizUid());
            }

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

        onSearch: function (oEvent) {
            var oTestTypeSelect = this.byId("testTypeSelect");
            var oTestPlanSelect = this.byId("testPlanSelect");
            var oDateRange = this.byId("dateRange");

            var sTestType = oTestTypeSelect.getSelectedKey();
            var sTestPlan = oTestPlanSelect.getSelectedKey();
            var oDateFrom = oDateRange.getDateValue();
            var oDateTo = oDateRange.getSecondDateValue();

            var oMockModel = this.getView().getModel("mock");
            var aTestPlans = oMockModel.getProperty("/TestPlans");

            var aFilteredData = aTestPlans.filter(function(oPlan) {
                var bTestTypeMatch = sTestType ? oPlan.testType === sTestType : true;
                var bTestPlanMatch = sTestPlan ? oPlan.id === sTestPlan : true;
                return bTestTypeMatch && bTestPlanMatch;
            });

            var aChartData = [];
            aFilteredData.forEach(function(oPlan) {
                var oChartDataItem = oMockModel.getProperty("/ChartData").find(function(oItem) {
                    return oItem.ProductArea === oPlan.productArea;
                });
                if (oChartDataItem) {
                    aChartData.push(oChartDataItem);
                }
            });

            var oChartModel = new JSONModel({ "ChartData": aChartData });
            var oVizFrame = this.getView().byId("vizFrame");
            oVizFrame.setModel(oChartModel);
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
            var oMockModel = this.getView().getModel("mock");
            var aTestPlans = oMockModel.getProperty("/TestPlans");
            var aFilteredPlans = aTestPlans.filter(function(oPlan) {
                return oPlan.testType === sSelectedTestType;
            });
            var oTestPlanModel = new JSONModel({ "TestPlans": aFilteredPlans });
            oTestPlanSelect.setModel(oTestPlanModel);
            oTestPlanSelect.bindItems({
                path: "/TestPlans",
                template: new sap.ui.core.Item({
                    key: "{id}",
                    text: "{name}"
                })
            });
            oTestPlanSelect.setEnabled(true);
        }
    });
});
