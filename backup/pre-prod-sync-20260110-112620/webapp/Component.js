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
                if (console && console.log) console.log("[vicstartintegration] Component init start");

                // enable routing
                if (console && console.log) console.log("[vicstartintegration] Router initializing...");
                this.getRouter().initialize();
                if (console && console.log) console.log("[vicstartintegration] Router initialized");

                // Lazy model setup: do not force-create OData models at boot.
                // Manifest preloads are disabled; controllers/views will attach models as needed.
                try {
                    var startSrv = this.getModel("StartSrvModel");
                    var logSrv = this.getModel("STARTPROCESSLOG_SRV");
                    // Intentionally no immediate instantiation to avoid blocking when proxy/credentials are unavailable.
                } catch (e) {
                    if (console && console.warn) console.warn("Deferred OData model init due to environment:", e);
                }

                // set the device model
                this.setModel(models.createDeviceModel(), "device");

            }
        });
    }
);
