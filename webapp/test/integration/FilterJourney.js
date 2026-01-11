/*global QUnit */
sap.ui.define([
  "sap/ui/test/opaQunit",
  "sap/ui/test/Opa5"
], function (opaTest, Opa5) {
  "use strict";

  QUnit.module("Filtering Journey");

  function setMCBSelectedKeys(sId, aKeys) {
    return {
      id: sId,
      check: function (oMCB) {
        return !!oMCB && typeof oMCB.getItems === "function" && oMCB.getItems().length > 0;
      },
      success: function (oMCB) {
        oMCB.setSelectedKeys(aKeys || []);
        // Trigger immediate reactivity via selectionFinish (as wired in the view)
        oMCB.fireSelectionFinish({ selectedItems: oMCB.getSelectedItems() });
      },
      errorMessage: "MultiComboBox with id '" + sId + "' not found or items not loaded"
    };
  }

  function assertTblCount(iExpected) {
    return {
      id: "idTblTitle",
      success: function (oTitle) {
        var text = oTitle.getText() || "";
        var m = text.match(/\((\d+)\)/);
        var count = m ? parseInt(m[1], 10) : 0;
        Opa5.assert.strictEqual(count, iExpected, "Table shows " + iExpected + " filtered items");
      },
      errorMessage: "Table title not found"
    };
  }

  function assertModelListLength(sControlId, sModelName, iExpected) {
    return {
      id: sControlId,
      success: function (oCtrl) {
        var oModel = oCtrl.getModel(sModelName);
        var aData = oModel && oModel.getData();
        var len = Array.isArray(aData) ? aData.length : 0;
        Opa5.assert.strictEqual(len, iExpected, sModelName + " has " + iExpected + " options");
      },
      errorMessage: "Control '" + sControlId + "' not found"
    };
  }

  opaTest("Test Plan OR logic with MultiComboBox selections", function (Given, When, Then) {
    Given.iStartMyApp();

    When.waitFor(setMCBSelectedKeys("idMCBoxTestPlan", [
      "FIN_AA_X_Y_E2E_2611_1.141",
      "FIN_AA_M_N_E2E_2611_1.141"
    ]));

    When.waitFor({
      id: "viewSwitch",
      success: function (oSeg) {
        oSeg.setSelectedKey("table");
        var aItems = oSeg.getItems ? oSeg.getItems() : [];
        oSeg.fireSelectionChange({ selectedItem: aItems && aItems[1] ? aItems[1] : null });
      },
      errorMessage: "View switch not found"
    });
    Then.waitFor(assertTblCount(2));
    Then.iTeardownMyApp();
  });

  opaTest("AND logic across Product Area, Test Type, Release (no Test Plan)", function (Given, When, Then) {
    Given.iStartMyApp();

    // Ensure Test Plan selection cleared
    When.waitFor(setMCBSelectedKeys("idMCBoxTestPlan", []));

    // Select Product Areas: FIN and SALES (OR within dropdown)
    When.waitFor(setMCBSelectedKeys("idMCBoxProdArea", ["FIN", "SALES"]));

    // Select Test Type: E2E
    When.waitFor(setMCBSelectedKeys("idMCBoxTestScope", ["E2E"]));

    // Select Releases: 2611 and 2612
    When.waitFor(setMCBSelectedKeys("idMCBoxRelease", ["2611", "2612"]));

    // Expect 3 items (2 FIN@2611 + 1 SALES@2612)
    When.waitFor({
      id: "viewSwitch",
      success: function (oSeg) {
        oSeg.setSelectedKey("table");
        var aItems = oSeg.getItems ? oSeg.getItems() : [];
        oSeg.fireSelectionChange({ selectedItem: aItems && aItems[1] ? aItems[1] : null });
      },
      errorMessage: "View switch not found"
    });
    Then.waitFor(assertTblCount(3));
    Then.iTeardownMyApp();
  });

  opaTest("Dynamic recomputation of Test Plan options and Clear reset", function (Given, When, Then) {
    Given.iStartMyApp();

    // Narrow filters to FIN + E2E + 2611
    When.waitFor(setMCBSelectedKeys("idMCBoxProdArea", ["FIN"]));
    When.waitFor(setMCBSelectedKeys("idMCBoxTestScope", ["E2E"]));
    When.waitFor(setMCBSelectedKeys("idMCBoxRelease", ["2611"]));

    // Test Plan options should shrink to FIN@2611 E2E (2)
    Then.waitFor(assertModelListLength("idMCBoxTestPlan", "mTestPlan", 2));

    // Clear via FilterBar
    When.waitFor({
      id: "idFilterBar",
      success: function (oFB) {
        oFB.fireClear();
      },
      errorMessage: "FilterBar not found"
    });

    // Test Plan options should restore to all (4)
    Then.waitFor(assertModelListLength("idMCBoxTestPlan", "mTestPlan", 4));
    Then.iTeardownMyApp();
  });

  opaTest("UI5 Version field is not present", function (Given, When, Then) {
    Given.iStartMyApp();

    Then.waitFor({
      check: function () {
        return !sap.ui.getCore().byId("idMCBoxUI5Version");
      },
      success: function () {
        Opa5.assert.ok(true, "UI5 Version MultiComboBox is not present as required");
      }
    });

    Then.iTeardownMyApp();
  });
});
