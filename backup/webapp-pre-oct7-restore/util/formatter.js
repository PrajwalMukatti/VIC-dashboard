sap.ui.define([], function () {
	"use strict";
	return {

		StringDateTimeFormat: function (sDateTime) {
			var sFDateTime = sDateTime.split(".")[0];
			var sFDateTimeSub1 = sFDateTime.split(" ")[0];
			var sFDateTimeSub2 = sFDateTime.split(" ")[1];

			var SFinalDate = sFDateTimeSub1.split("-").reverse().join("/");
			var sFinalDateTime = SFinalDate.concat(" ", sFDateTimeSub2);

			return sFinalDateTime;
		},

		StringDateOnlyFormat: function (sDate) {
			var aDate = sDate.split("/");
			var SFinalDate = aDate[1] + "/" + aDate[0] + "/" + aDate[2];

			return SFinalDate;
		},

		DateToString: function (oDate) {
			if (oDate && oDate !== null) {
				var sDate = oDate.getDate();
				var sMonth = oDate.getMonth() + 1;
				var sYear = oDate.getFullYear();
				if (sDate < 10) {
					sDate = "0" + sDate;
				}
				if (sMonth < 10) {
					sMonth = "0" + sMonth;
				}
				return sDate + "/" + sMonth + "/" + sYear;
			} else {
				return oDate;
			}
		},

		DateTimeToString: function (oDate) {
			if (oDate && oDate !== null) {
				var sDate = oDate.getDate();
				var sMonth = oDate.getMonth() + 1;
				var sYear = oDate.getFullYear();
				if (sDate < 10) {
					sDate = "0" + sDate;
				}
				if (sMonth < 10) {
					sMonth = "0" + sMonth;
				}
				return sMonth + "/" + sDate + "/" + sYear;
			} else {
				return oDate;
			}
		},

		setStatusColor: function (sStatus) {
			if (sStatus && sStatus.length > 0) {
				if (sStatus.indexOf("fail") > -1 || sStatus.indexOf("Fail") > -1 || sStatus.indexOf("FAIL") > -1) {
					return "Error";
				} else if (sStatus.indexOf("pass") > -1 || sStatus.indexOf("Pass") > -1 || sStatus.indexOf("PASS") > -1 || sStatus.indexOf("ok") > -
					1 || sStatus.indexOf("OK") > -1 || sStatus.indexOf("Ok") > -1) {
					return "Success";
				} else if (sStatus.indexOf("not") > -1 || sStatus.indexOf("Not") > -1 || sStatus.indexOf("NOT") > -1) {
					return "Warning";
				} else {
					return "None";
				}
			} else {
				return "None";
			}
		},

		setStatusIcon: function (sStatus) {
			if (sStatus && sStatus.length > 0) {
				if (sStatus.indexOf("fail") > -1 || sStatus.indexOf("Fail") > -1 || sStatus.indexOf("FAIL") > -1) {
					return "sap-icon://message-error";
				} else if (sStatus.indexOf("pass") > -1 || sStatus.indexOf("Pass") > -1 || sStatus.indexOf("PASS") > -1 || sStatus.indexOf("ok") > -
					1 || sStatus.indexOf("OK") > -1 || sStatus.indexOf("Ok") > -1) {
					return "sap-icon://message-success";
				} else if (sStatus.indexOf("not") > -1 || sStatus.indexOf("Not") > -1 || sStatus.indexOf("NOT") > -1) {
					return "sap-icon://message-information";
				} else {
					return "None";
				}
			} else {
				return "";
			}
		},

		formatStatus: function (sValue) {
			// switch (sValue) {
			// case "Pass":
			// 	return 7;
			// 	break;
			// case "Fail":
			// 	return 3;
			// 	break;
			// case "OK":
			// 	return 7;
			// 	break;
			// case "Application Error":
			// 	return 3;
			// 	break;
			// default:
			// 	return 8;
			// }
			if (sValue && sValue.length > 0) {
				if (sValue.indexOf("fail") > -1 || sValue.indexOf("Fail") > -1 || sValue.indexOf("FAIL") > -1 ||
					sValue.indexOf("error") > -1 || sValue.indexOf("Error") > -1 || sValue.indexOf("ERROR") > -1) {
					return 3;
				} else if (sValue.indexOf("pass") > -1 || sValue.indexOf("Pass") > -1 || sValue.indexOf("PASS") > -1) {
					return 7;
					// } else if (sValue.indexOf("not") > -1 || sValue.indexOf("Not") > -1 || sValue.indexOf("NOT") > -1) {
					// 	return 8;
				} else if(sValue.indexOf("ok") > -1 || sValue.indexOf("OK") > -1 || sValue.indexOf("Ok") > -1){
					return 7;
				} else {
					return 8;
				}
			} else {
				return 8;
			}
		},

		setSelectEnabled: function (sStatus) {
			if (sStatus && sStatus !== "") {
				if (sStatus.indexOf("pass") > -1 || sStatus.indexOf("Pass") > -1 || sStatus.indexOf("PASS") > -1) {
					return false;
				} else {
					return true;
				}
			} else {
				return true;
			}
		},

		statusIndicator: function (sStatus) {
			// var sIcon;
			// switch (sStatus) {
			// case "Pass":
			// 	sIcon = "success";
			// 	break;
			// case "Fail":
			// 	sIcon = "error";
			// 	break;
			// case "OK":
			// 	sIcon = "success";
			// 	break;
			// case "Application Error":
			// 	sIcon = "error";
			// 	break;
			// default:
			// 	sIcon = "warning";
			// }
			// return "sap-icon://message-" + sIcon;
			if (sStatus && sStatus.length > 0) {
				if (sStatus.indexOf("fail") > -1 || sStatus.indexOf("Fail") > -1 || sStatus.indexOf("FAIL") > -1 ||
					sStatus.indexOf("error") > -1 || sStatus.indexOf("Error") > -1 || sStatus.indexOf("ERROR") > -1) {
					return "sap-icon://message-" + "error";
				} else if (sStatus.indexOf("pass") > -1 || sStatus.indexOf("Pass") > -1 || sStatus.indexOf("PASS") > -1 || sStatus.indexOf("ok") > -
					1 || sStatus.indexOf("OK") > -1 || sStatus.indexOf("Ok") > -1) {
					return "sap-icon://message-" + "success";
				} else if (sStatus.indexOf("not") > -1 || sStatus.indexOf("Not") > -1 || sStatus.indexOf("NOT") > -1) {
					return "sap-icon://message-" + "warning";
				} else {
					return null;
				}
			} else {
				return null;
			}
		},
		
		formatStatusVis:function(sStatus){
			if (sStatus && sStatus.length > 0) {
				return true;
			}else{
				return false;
			}
		},

		OvrRelColor: function (sReliability) {
			if (sReliability && sReliability !== "") {
				var sRelNumber = parseFloat(sReliability.split("%")[0]);
				if (sRelNumber >= 95) {
					return "Success";
				} else if (sRelNumber < 95 && sRelNumber >= 85) {
					return "Warning";
				} else if (sRelNumber < 85) {
					return "Error";
				} else {
					return "None";
				}
			} else {
				return "None";
			}
		},

		formatDateOnly: function (sDateDB) {
			if (sDateDB && sDateDB !== null) {
				var sDateSplit = sDateDB.split("(")[1];
				sDateSplit = sDateSplit.split(")")[0];
				sDateSplit = parseInt(sDateSplit);

				var oDateObj = new Date(sDateSplit);
				var sDate = oDateObj.getDate();
				var sMonth = oDateObj.getMonth() + 1;
				var sYear = oDateObj.getFullYear();
				if (sDate < 10) {
					sDate = "0" + sDate;
				}
				if (sMonth < 10) {
					sMonth = "0" + sMonth;
				}
				return sDate + "/" + sMonth + "/" + sYear;
			} else {
				return sDateDB;
			}
		},
		
		formatDateObject:function(sDateDB){
			if (sDateDB && sDateDB !== null) {
				var sDateSplit = sDateDB.split("(")[1];
				sDateSplit = sDateSplit.split(")")[0];
				sDateSplit = parseInt(sDateSplit);

				var oDateObj = new Date(sDateSplit);
				return oDateObj;
			} else {
				return null;
			}
		},

		formatDateTime: function (sDateDB) {
			if (sDateDB && sDateDB !== null) {
				var sDateSplit = sDateDB.split("(")[1];
				sDateSplit = sDateSplit.split(")")[0];
				sDateSplit = parseInt(sDateSplit);

				var oDateObj = new Date(sDateSplit);
				var sDate = oDateObj.getDate();
				var sMonth = oDateObj.getMonth() + 1;
				var sYear = oDateObj.getFullYear();
				var sHours = oDateObj.getHours();
				var sMins = oDateObj.getMinutes();
				var sSecs = oDateObj.getSeconds();
				if (sDate < 10) {
					sDate = "0" + sDate;
				}
				if (sMonth < 10) {
					sMonth = "0" + sMonth;
				}
				if (sHours < 10) {
					sHours = "0" + sHours;
				}
				if (sMins < 10) {
					sMins = "0" + sMins;
				}
				if (sSecs < 10) {
					sSecs = "0" + sSecs;
				}
				return sDate + "/" + sMonth + "/" + sYear + " " + sHours + ":" + sMins + ":" + sSecs;
			} else {
				return sDateDB;
			}
		},
		
		formatStatusText:function(sStatus){
			if(sStatus && sStatus!==""){
				if(sStatus === "ALMOST_OK"){
					return "OK with Reservations";
				}else{
					return sStatus;
				}
			}else{
				return sStatus;
			}
		},

		formatPercent: function (percent) {
            if (percent) {
                let strPercent = percent.toString();
                let decimalPos = strPercent.indexOf('.');

                if (decimalPos === -1) {

                    return strPercent + '.00%';
                } else {

                    let integerPart = strPercent.substring(0, decimalPos);
                    let decimalPart = strPercent.substring(decimalPos + 1);

                    if (decimalPart.length === 0) {
                        decimalPart = '00';
                    } else if (decimalPart.length === 1) {
                        decimalPart += '0';
                    } else if (decimalPart.length > 2) {
                        decimalPart = decimalPart.substring(0, 2);
                    }

                    return integerPart + '.' + decimalPart + '%';
                }
            } else {
                return '';
            }
        },
	};
});