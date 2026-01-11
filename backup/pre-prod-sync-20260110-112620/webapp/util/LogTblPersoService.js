sap.ui.define(['jquery.sap.global'],
	function(jQuery) {
	"use strict";

	// Very simple page-context personalization
	// persistence service, not for productive use!
	var LogTblPersoService = {

		oData : {
			_persoSchemaVersion: "1.0",
			aColumns : [
				{
					id: "vicstartintegration-idTblTestPlan-testPlan",
					order: 0,
					text: "Test Plan",
					visible: true
				},
				// {
				// 	id: "vicstartintegration-idTblTestPlan-automateName",
				// 	order: 1,
				// 	text: "Automate Name",
				// 	visible: true
				// },
				{
					id: "vicstartintegration-idTblTestPlan-productArea",
					order: 1,
					text: "Product Area",
					visible: true
				},
				{
					id: "vicstartintegration-idTblTestPlan-testScope",
					order: 2,
					text: "Test Scope",
					visible: true
				},
				{
					id: "vicstartintegration-idTblTestPlan-release",
					order: 3,
					text: "Release",
					visible: true
				},
				// {
				// 	id: "vicstartintegration-idTblTestPlan-status",
				// 	order: 3,
				// 	text: "Status",
				// 	visible: true
				// },
				{
					id: "vicstartintegration-idTblTestPlan-reliability",
					order: 4,
					text: "Reliability",
					visible: true
				},
				{
					id: "vicstartintegration-idTblTestPlan-analysedDate",
					order: 5,
					text: "Analysis Date",
					visible: true
				},
				// {
				// 	id: "vicstartintegration-idTblTestPlan-failureReason",
				// 	order: 5,
				// 	text: "Failure Reason",
				// 	visible: true
				// },
				// {
				// 	id: "vicstartintegration-idTblTestPlan-callforaction",
				// 	order: 6,
				// 	text: "Call for Action",
				// 	visible: false
				// },
				// {
				// 	id: "vicstartintegration-idTblTestPlan-analyzedStatus",
				// 	order: 9,
				// 	text: "Analyzed Status",
				// 	visible: false
				// },
				// {
				// 	id: "vicstartintegration-idTblTestPlan-testConfig",
				// 	order: 10,
				// 	text: "Test Configuration",
				// 	visible: false
				// }
			]
		},

		oResetData : {
			_persoSchemaVersion: "1.0",
			aColumns : [
				{
					id: "vicstartintegration-idTblTestPlan-testPlan",
					order: 0,
					text: "Test Plan",
					visible: true
				},
				{
					id: "vicstartintegration-idTblTestPlan-productArea",
					order: 1,
					text: "Product Area",
					visible: true
				},
				{
					id: "vicstartintegration-idTblTestPlan-testScope",
					order: 2,
					text: "Test Scope",
					visible: true
				},
				{
					id: "vicstartintegration-idTblTestPlan-release",
					order: 3,
					text: "Release",
					visible: true
				},
				// {
				// 	id: "vicstartintegration-idTblTestPlan-status",
				// 	order: 3,
				// 	text: "Status",
				// 	visible: true
				// },
				{
					id: "vicstartintegration-idTblTestPlan-reliability",
					order: 4,
					text: "Reliability",
					visible: true
				},
				{
					id: "vicstartintegration-idTblTestPlan-analysedDate",
					order: 5,
					text: "Analysis Date",
					visible: true
				},
				// {
				// 	id: "vicstartintegration-idTblTestPlan-failureReason",
				// 	order: 5,
				// 	text: "Failure Reason",
				// 	visible: true
				// },
				// {
				// 	id: "vicstartintegration-idTblTestPlan-callforaction",
				// 	order: 6,
				// 	text: "Call for Action",
				// 	visible: false
				// },
				// {
				// 	id: "vicstartintegration-idTblTestPlan-analyzedStatus",
				// 	order: 9,
				// 	text: "Analyzed Status",
				// 	visible: false
				// },
				// {
				// 	id: "vicstartintegration-idTblTestPlan-testConfig",
				// 	order: 10,
				// 	text: "Test Configuration",
				// 	visible: false
				// }
			]
		},


		getPersData : function () {
			var oDeferred = new jQuery.Deferred();
			if (!this._oBundle) {
				this._oBundle = this.oData;
			}
			oDeferred.resolve(this._oBundle);
			// setTimeout(function() {
			// 	oDeferred.resolve(this._oBundle);
			// }.bind(this), 2000);
			return oDeferred.promise();
		},

		setPersData : function (oBundle) {
			var oDeferred = new jQuery.Deferred();
			this._oBundle = oBundle;
			oDeferred.resolve();
			return oDeferred.promise();
		},

		getResetPersData : function () {
			var oDeferred = new jQuery.Deferred();

			// oDeferred.resolve(this.oResetData);

			setTimeout(function() {
				oDeferred.resolve(this.oResetData);
			}.bind(this), 2000);

			return oDeferred.promise();
		},

		resetPersData : function () {
			var oDeferred = new jQuery.Deferred();

			//set personalization
			this._oBundle = this.oResetData;

			//reset personalization, i.e. display table as defined
			//this._oBundle = null;

			oDeferred.resolve();

			// setTimeout(function() {
			// 	this._oBundle = this.oResetData;
			// 	oDeferred.resolve();
			// }.bind(this), 2000);

			return oDeferred.promise();
		},

		//this caption callback will modify the TablePersoDialog' entry for the 'Weight' column
		//to 'Weight (Important!)', but will leave all other column names as they are.
		getCaption : function (oColumn) {
			if (oColumn.getHeader() && oColumn.getHeader().getText) {
				if (oColumn.getHeader().getText() === "Weight") {
					return "Weight (Important!)";
				}
			}
			return null;
		},

		getGroup : function(oColumn) {
			if ( oColumn.getId().indexOf('productCol') != -1 ||
					oColumn.getId().indexOf('supplierCol') != -1) {
				return "Primary Group";
			}
			return "Secondary Group";
		}
	};

	return LogTblPersoService;

});
