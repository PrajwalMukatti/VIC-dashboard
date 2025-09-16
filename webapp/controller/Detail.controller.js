sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/routing/History",
  "sap/m/MessageToast"
], function (Controller, JSONModel, History, MessageToast) {
  "use strict";

  return Controller.extend("sap.vic.dashboard.controller.Detail", {
    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      this._oRouter.getRoute("detail").attachPatternMatched(this._onObjectMatched, this);

      // lightweight detail model
      var oDetail = new JSONModel({});
      this.getView().setModel(oDetail, "detail");
    },

    _onObjectMatched: function (oEvent) {
      var sId = oEvent.getParameter("arguments").id || "";
      try { sId = decodeURIComponent(sId); } catch (e) {}

      // Source data is the mock model; when live, you can switch to OData read
      var oMock = this.getView().getModel("mock");
      var aChart = (oMock && (oMock.getProperty("/ChartDataFull") || oMock.getProperty("/ChartData"))) || [];
      var oRow = aChart.find(function (r) {
        return r.TestPlanId === sId || r.ProductArea === sId || r.TestPlan === sId;
      });

      if (!oRow) {
        // fallback: construct a minimal object
        oRow = { id: sId, TestPlan: sId, ProductArea: "", Sim100: 0, Sim99: 0, SimLess: 0 };
      }

      // Normalize ID and title fields on the detail model
      var oDetail = {
        id: oRow.TestPlanId || sId,
        TestPlan: oRow.TestPlan || sId,
        ProductArea: oRow.ProductArea || "",
        Sim100: oRow.Sim100 || 0,
        Sim99: oRow.Sim99 || 0,
        SimLess: oRow.SimLess || 0
      };

      this.getView().getModel("detail").setData(oDetail);
      try {
        MessageToast.show("Opened detail for: " + (oDetail.TestPlan || oDetail.id));
      } catch (e) { /* ignore */ }
    },

    onNavBack: function () {
      var oHistory = History.getInstance();
      var sPreviousHash = oHistory.getPreviousHash();
      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        // fallback to dashboard
        this.getOwnerComponent().getRouter().navTo("dashboard", {}, true);
      }
    }
  });
});
