sap.ui.define(
    [
      "./BaseController",
      "sap/ui/model/json/JSONModel",
      "sap/ui/core/routing/History"
    ],
    function(BaseController, JSONModel, History) {
      "use strict";
  
      return BaseController.extend("vicstartintegration.controller.App", {
        onInit : function () {
          var oViewModel,
            fnSetAppNotBusy,
            iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();

            oViewModel = new JSONModel({
              busy : true,
              delay : 0
            });
            this.setModel(oViewModel, "appView");
      
            fnSetAppNotBusy = function() {
              oViewModel.setProperty("/busy", false);
              oViewModel.setProperty("/delay", iOriginalBusyDelay);
            };
      
            // disable busy indication when the metadata is loaded and in case of errors
            // Make robust: model may be unavailable in local dev (proxy timeouts). Do not throw.
            var oModel = this.getOwnerComponent().getModel("StartSrvModel");
            if (oModel && oModel.metadataLoaded) {
              oModel.metadataLoaded().then(fnSetAppNotBusy);
              if (oModel.attachMetadataFailed) {
                oModel.attachMetadataFailed(fnSetAppNotBusy);
              }
            } else {
              if (console && console.warn) console.warn("[vicstartintegration] StartSrvModel unavailable; proceeding without blocking UI");
              fnSetAppNotBusy();
            }

    //         var oModel = this.getOwnerComponent().getModel("StartSrvModel");
    // if (oModel) {
    //     oModel.metadataLoaded().then(fnSetAppNotBusy);
    //     oModel.attachMetadataFailed(fnSetAppNotBusy);
    // } else {
    //     console.error("StartSrvModel is not available.");
    // }
      
            // apply content density mode to root view
          //  this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
          
        },

        onShellNavBack: function () {
          try {
            var sPrevHash = History && History.getInstance().getPreviousHash();
            if (sPrevHash !== undefined && sPrevHash !== null) {
              window.history.go(-1);
            } else {
              var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
              if (oRouter && oRouter.navTo) {
                oRouter.navTo("Route1", {}, true);
              }
            }
          } catch (e) {
            try { window.history.go(-1); } catch (err) {}
          }
        },

        onShellGlobalSearch: function (oEvent) {
          try {
            var sQuery = (oEvent && oEvent.getParameter && oEvent.getParameter("query")) || "";
            var oApp = this.byId("app");
            var oCurrent = oApp && oApp.getCurrentPage ? oApp.getCurrentPage() : null;
            if (oCurrent && oCurrent.byId) {
              var oSearch = oCurrent.byId("idSearchField");
              if (oSearch && oSearch.setValue) {
                oSearch.setValue(sQuery);
                var oCtrl = oCurrent.getController && oCurrent.getController();
                if (oCtrl && oCtrl.onSearchFieldPress) {
                  oCtrl.onSearchFieldPress({ getSource: function(){ return oSearch; } });
                  return;
                }
              }
            }
          } catch (e) {}
        }
      });
    }
  );
