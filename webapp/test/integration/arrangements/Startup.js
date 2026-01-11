sap.ui.define([
	"sap/ui/test/Opa5"
], function (Opa5) {
	"use strict";

	return Opa5.extend("integration.arrangements.Startup", {

		iStartMyApp: function (oOptionsParameter) {
			var oOptions = oOptionsParameter || {};

			// start the app with a minimal delay to make tests fast but still async to discover basic timing issues
			oOptions.delay = oOptions.delay || 50;

			// Deterministic test dataset for filtering validations (4 plans)
			var TEST_DATA = [
				{ testPlanName: "FIN_AA_X_Y_E2E_2611_1.141", percentSuccess: 98, executeOn: "2025-10-01" },
				{ testPlanName: "FIN_AA_M_N_E2E_2611_1.141", percentSuccess: 96.5, executeOn: "2025-10-02" },
				{ testPlanName: "SALES_ZZ_QA_E2E_2612_1.141", percentSuccess: 99, executeOn: "2025-10-02" },
				{ testPlanName: "FIN_TRM_AB_UNIT_2612_1.141", percentSuccess: 95, executeOn: "2025-10-03" }
			];

			// Stub jQuery.ajax for the specific endpoint used by the app to load data
			var origAjax = $.ajax;
			this.__origAjax = origAjax;
			$.ajax = function (options) {
				if (options && options.url === "/VIC_UI_DEV/imageDetail/get-all-testplan-percentsuccess" && (options.type === "GET" || !options.type)) {
					setTimeout(function () {
						if (typeof options.success === "function") {
							options.success(TEST_DATA);
						}
					}, 0);
					return;
				}
				return origAjax.apply($, arguments);
			};

			// start the app UI component
			this.iStartMyUIComponent({
				componentConfig: {
					name: "vicstartintegration",
					async: true
				},
				hash: oOptions.hash,
				autoWait: oOptions.autoWait
			});
		},

		// Restore ajax stub on teardown to avoid leaking across tests
		iTeardownMyApp: function () {
			if (this.__origAjax) {
				$.ajax = this.__origAjax;
				this.__origAjax = null;
			}
			Opa5.prototype.iTeardownMyApp.apply(this, arguments);
		}
	});
});
