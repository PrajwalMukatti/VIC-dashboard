/**
 * eslint-disable @sap/ui5-jsdocs/no-jsdoc
 */

sap.ui.define([
        "sap/ui/core/UIComponent",
        "sap/ui/Device",
        "vicstartintegration/model/models",
        "sap/ui/model/odata/v2/ODataModel"
    ],
    function (UIComponent, Device, models, ODataModel) {
        "use strict";

        return UIComponent.extend("vicstartintegration.Component", {
            metadata: {
                manifest: "json"
            },

            /**
             * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
             * @public
             * @override
             */
            init: function () {
                // call the base component's init function
                UIComponent.prototype.init.apply(this, arguments);

                // enable routing
                this.getRouter().initialize();

                //  // create and set the StartSrvModel
                var oModel = this.getModel("StartSrvModel");
                if (!oModel) {
                    oModel = new ODataModel(this.getManifestEntry("/sap.app/dataSources/START_SRV").uri);
                    this.setModel(oModel, "StartSrvModel");
                }

                // create and set the STARTPROCESSLOG_SRV model
            var oModel = this.getModel("STARTPROCESSLOG_SRV");
            if (!oModel) {
                oModel = new ODataModel(this.getManifestEntry("/sap.app/dataSources/STARTPROCESSLOG_SRV").uri);
                this.setModel(oModel, "STARTPROCESSLOG_SRV");
            }

                // set the device model
                this.setModel(models.createDeviceModel(), "device");
            }
        });
    }
);
