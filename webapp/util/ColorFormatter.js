sap.ui.define(function () {
	"use strict";
	return {
		getColor: function (sStatus) {
			switch (sStatus) {
			case "Error":
				return "None";
			case "Success":
				return "Error";
			default:
				return "None";
			}
		}
	};
},true);