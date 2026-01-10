sap.ui.define(
    [
      "./BaseController",
      "sap/ui/model/json/JSONModel",
      "sap/ui/core/mvc/Controller"
    ],
    function(BaseController,JSONModel) {
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
            this.getOwnerComponent().getModel("StartSrvModel").metadataLoaded().
              then(fnSetAppNotBusy);
            this.getOwnerComponent().getModel("StartSrvModel").attachMetadataFailed(fnSetAppNotBusy);

    //         var oModel = this.getOwnerComponent().getModel("StartSrvModel");
    // if (oModel) {
    //     oModel.metadataLoaded().then(fnSetAppNotBusy);
    //     oModel.attachMetadataFailed(fnSetAppNotBusy);
    // } else {
    //     console.error("StartSrvModel is not available.");
    // }
      
            // apply content density mode to root view
          //  this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
          
        }
      });
    }
  );
  