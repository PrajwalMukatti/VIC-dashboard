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

                // Load configurable endpoints (cfg) from model/config.json
                try {
                    var cfg = this.getModel("cfg");
                    if (!cfg) {
                        cfg = new sap.ui.model.json.JSONModel();
                        this.setModel(cfg, "cfg");
                    }
                    if (cfg && cfg.loadData) {
                        cfg.loadData("model/config.json?t=" + Date.now());
                    }
                } catch (eCfg) {
                    if (console && console.warn) console.warn("cfg model init failed:", eCfg);
                }

                // Ensure JSON model 'testPlanDetails' is available and loaded via /EPVP proxy
                try {
                    var tpModel = this.getModel("testPlanDetails");
                    if (!tpModel) {
                        tpModel = new sap.ui.model.json.JSONModel();
                        this.setModel(tpModel, "testPlanDetails");
                    }
                    if (tpModel && tpModel.setSizeLimit) { tpModel.setSizeLimit(10000); }
                    if (tpModel && tpModel.attachRequestCompleted) {
                        tpModel.attachRequestCompleted(function () {
                            try { if (console && console.log) console.log("[testPlanDetails] request completed"); } catch (e) {}
                        });
                    }
                    if (tpModel && tpModel.loadData) {
                        // Allow override via URL param ?tpd=FULL_URL, else use /EPVP/testPlanDetails, else cfg if present
                        var __urlParam = "";
                        try { __urlParam = new URLSearchParams(window.location.search).get("tpd") || ""; } catch (eUP) {}
                        var __cfgUrl = "";
                        try {
                            var __cfg = this.getModel("cfg");
                            __cfgUrl = __cfg && __cfg.getProperty("/testPlanDetailsUrl") || "";
                        } catch (eCU) {}
                        var __base = (__urlParam && __urlParam.length) ? __urlParam : ((__cfgUrl && __cfgUrl.length) ? __cfgUrl : "/EPVP/testPlanDetails");
                        tpModel.loadData(__base + (__base.indexOf("?") > -1 ? "&" : "?") + "t=" + Date.now());
                    }
                } catch (eTP) {
                    if (console && console.warn) console.warn("testPlanDetails model init failed:", eTP);
                }

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
