sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "sap/vic/dashboard/model/models"
], function (UIComponent, Device, models) {
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

            // create the views based on the url/hash
            this.getRouter().initialize();
        },

    });
});
