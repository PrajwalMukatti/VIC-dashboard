sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "sap/vic/dashboard/model/models",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (UIComponent, Device, models, JSONModel, MessageToast) {
    "use strict";

    return UIComponent.extend("sap.vic.dashboard.Component", {

        metadata: {
            manifest: "json"
        },

        init: function () {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // enable routing
            this.getRouter().initialize();

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // global app state
            var oState = new JSONModel({
                headerExpanded: true,
                liveMode: false,
                forceLive: false
            });
            this.setModel(oState, "state");

            // Try to connect to OData service (unnamed default model from manifest)
            var oODataModel = this.getModel();
            if (oODataModel && typeof oODataModel.metadataLoaded === "function") {
                oODataModel.metadataLoaded().then(function () {
                    // OData reachable: switch app to live mode and notify listeners
                    oState.setProperty("/liveMode", true);
                    try {
                        MessageToast.show("OData service connected — Live mode");
                    } catch (e) { /* ignore in tests */ }
                    this.getEventBus().publish("vic", "odataAvailable");
                }.bind(this)).catch(function () {
                    // If developer forces live, enable even if metadata fails
                    if (oState.getProperty("/forceLive")) {
                        oState.setProperty("/liveMode", true);
                        try { MessageToast.show("Force-live enabled (developer)"); } catch (e) { /* ignore */ }
                        this.getEventBus().publish("vic", "odataAvailable");
                    }
                    // otherwise remain in mock mode
                }.bind(this));
            }
        }

    });
});
