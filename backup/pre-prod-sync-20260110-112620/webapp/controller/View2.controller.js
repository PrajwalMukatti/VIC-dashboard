sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "./BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/ui/core/routing/History",
    "sap/ui/model/Sorter",
    "sap/ui/core/Fragment",
    // "sap/ui/comp/library",
    "sap/m/BusyDialog",
    "sap/ui/core/ValueState",
    "sap/m/Dialog",
    "sap/m/DialogType",
    "sap/m/Button",
    "sap/m/ButtonType",
    "sap/m/Input",
    "sap/m/Text",
    "sap/ui/model/json/JSONModel",
    'sap/m/Token',
    'sap/m/ColumnListItem',
    "vicstartintegration/util/formatter",
    "vicstartintegration/util/TPTblPersoService",
    "vicstartintegration/util/ColorFormatter",
    'sap/m/TablePersoController',
    'sap/m/library',
    'sap/ui/core/util/Export',
    'sap/ui/core/util/ExportTypeCSV',
    'sap/ui/export/library',
    'sap/ui/export/Spreadsheet'
],
function (Controller, BaseController, Filter, FilterOperator, MessageBox, History, Sorter, Fragment, BusyDialog, ValueState, Dialog,
    DialogType, Button, ButtonType, Input, Text, JSONModel, Token, ColumnListItem,
    formatter, TPTblPersoService,ColorFormatter, TablePersoController, mlibrary, Export, ExportTypeCSV, exportLibrary, Spreadsheet) {
    "use strict";
    var oBindingComboBox;
    var ResetAllMode = mlibrary.ResetAllMode;
    var EdmType = exportLibrary.EdmType;
    var testplanName;
    var AllArray = [];
    var Clog;

    return BaseController.extend("vicstartintegration.controller.View2", {
        formatter: formatter,

        // onInit: function () {
        //     var that = this;
        //     this._isEditMode = false;
        //     var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        //     oRouter.getRoute("Route2").attachPatternMatched(this.onRouteMatched, this);


        //     this._mViewSettingsDialogs = {};

        //     this.oEditableTemplate = new sap.m.ColumnListItem({
        //         cells: [
        //             new sap.m.Text({
        //                 text: "{msimilarity>testCaseName}"
        //             }),
        //             new sap.m.Text({
        //                 text: "{msimilarity>executeOn}"
        //             }),
        //             new sap.m.Text({
        //                 text: "{msimilarity>percentSuccess}",
        //             }).bindProperty("text", {
        //                 path: "msimilarity>percentSuccess",
        //                 formatter: that.formatter.formatPercent
        //             }),

        //             new sap.m.Select({
                       
        //                 selectedKey: "{path:'msimilarity>vicStatus', mode: 'sap.ui.model.BindingMode.TwoWay'}",
        //                 forceSelection: false,
        //                 change: this.onStatusSelectChange.bind(this),
        //                 items: [
        //                     new sap.ui.core.Item({
        //                         key: "Pass",
        //                         text: "Pass",
        //                         enabled: false
        //                     }),
        //                     new sap.ui.core.Item({
        //                         key: "Fail",
        //                         text: "Fail",
        //                         enabled: false
        //                     }),
        //                     new sap.ui.core.Item({
        //                         key: "Analyze",
        //                         text: "Analyze",
        //                         enabled: false
        //                     }),
        //                     new sap.ui.core.Item({
        //                         key: "Manual OK",
        //                         text: "Manual OK"
        //                     }),
        //                     new sap.ui.core.Item({
        //                         key: "Manual Fail",
        //                         text: "Manual Fail"
        //                     })
        //                 ]
        //             }).bindProperty("enabled", {
        //                 path: "msimilarity>vicStatus",
        //                 formatter: that.formatter.setSelectEnabled
        //             }),
        //             new sap.ui.core.Icon({
        //                 src: "sap-icon://notes",
        //                 tooltip: "Click to add/edit remarks",
        //                 press: this.onRemarksPress.bind(this),
        //                 color: {
        //                     path: "msimilarity>comment",
        //                     formatter: function (val) {
        //                         return val ? "#e52929" : "#6a6d70"; // Red if exists, gray otherwise
        //                     }
        //                 }
        //             }),      
        //             new sap.m.Button({
        //                 text: "Link",
        //                 press: this.onLinkPress.bind(this),
        //                 visible: "{= ${msimilarity>Link} !== '' }"
        //             }),

        //         ]
        //     });

        //     this.oReadOnlyTemplate = new ColumnListItem({
        //         cells: [
        //             new sap.m.Text({
        //                 text: "{msimilarity>testCaseName}"
        //             }),
        //             new sap.m.Text({
        //                 text: "{msimilarity>executeOn}"
        //             }),
        //             new sap.m.Text({
        //                 text: "{msimilarity>percentSuccess}",
        //             }).bindProperty("text", {
        //                 path: "msimilarity>percentSuccess",
        //                 formatter: that.formatter.formatPercent
        //             }),
        //             new sap.tnt.InfoLabel({
        //                 text: "{msimilarity>vicStatus}",
        //             }).bindProperty("icon", {
        //                 path: "msimilarity>vicStatus",
        //                 formatter: that.formatter.statusIndicator
        //             }).bindProperty("colorScheme", {
        //                 path: "msimilarity>vicStatus",
        //                 formatter: that.formatter.formatStatus
        //             }),
        //             new sap.ui.core.Icon({
        //                 src: "sap-icon://notes",
        //                 tooltip: {
        //                     parts: ["msimilarity>comment"],
        //                     formatter: function (val) {
        //                         return val ? val : "No remarks";
        //                     }
        //                 },
        //                 press: this.onRemarksPress.bind(this),
        //                 color: {
        //                     path: "msimilarity>comment",
        //                     formatter: function (val) {
        //                         return val ? "#e52929" : "#6a6d70"; // Red if remarks present
        //                     }
        //                 }
        //             }),
        //             new sap.m.Button({
        //                 text: "Link",
        //                 press: this.onLinkPress.bind(this), // Link button press event handler
        //                 visible: "{= ${msimilarity>Link} !== '' }" // Display the button only if the Link value is not empty
        //             }),
        //         ]
        //     });

        //     if (!this._oTPC) {
        //         this._oTPC = new TablePersoController({
        //             table: this.getView().byId("table0"),
        //             componentName: "vicstartintegration",
        //             persoService: TPTblPersoService
        //         }).activate();
        //     }
        // },

       onInit: function () {
    var that = this;
    this._isEditMode = false;
    var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
    oRouter.getRoute("Route2").attachPatternMatched(this.onRouteMatched, this);

    this._mViewSettingsDialogs = {};

    // ---------------- Existing table templates (untouched) ----------------
    this.oEditableTemplate = new sap.m.ColumnListItem({
        cells: [
            new sap.m.Text({ text: "{msimilarity>testCaseName}" }),
            new sap.m.Text({ text: "{msimilarity>executeOn}" }),
            new sap.m.Text({
                text: "{msimilarity>percentSuccess}"
            }).bindProperty("text", {
                path: "msimilarity>percentSuccess",
                formatter: that.formatter.formatPercent
            }),
            new sap.m.Select({
                selectedKey: "{path:'msimilarity>vicStatus', mode: 'sap.ui.model.BindingMode.TwoWay'}",
                forceSelection: false,
                change: this.onStatusSelectChange.bind(this),
                items: [
                    new sap.ui.core.Item({ key: "Pass", text: "Pass", enabled: false }),
                    new sap.ui.core.Item({ key: "Fail", text: "Fail", enabled: false }),
                    new sap.ui.core.Item({ key: "Analyze", text: "Analyze", enabled: false }),
                    new sap.ui.core.Item({ key: "Manual OK", text: "Manual OK" }),
                    new sap.ui.core.Item({ key: "Manual Fail", text: "Manual Fail" })
                ]
            }).bindProperty("enabled", {
                path: "msimilarity>vicStatus",
                formatter: that.formatter.setSelectEnabled
            }),
            new sap.ui.core.Icon({
                src: "sap-icon://notes",
                tooltip: "Click to add/edit remarks",
                press: this.onRemarksPress.bind(this),
                color: {
                    path: "msimilarity>comment",
                    formatter: function (val) {
                        return val ? "#e52929" : "#6a6d70";
                    }
                }
            }),
            new sap.m.Button({
                text: "Link",
                press: this.onLinkPress.bind(this),
                visible: "{= ${msimilarity>Link} !== '' }"
            })
        ]
    });

    this.oReadOnlyTemplate = new ColumnListItem({
        cells: [
            new sap.m.Text({ text: "{msimilarity>testCaseName}" }),
            new sap.m.Text({ text: "{msimilarity>executeOn}" }),
            new sap.m.Text({
                text: "{msimilarity>percentSuccess}"
            }).bindProperty("text", {
                path: "msimilarity>percentSuccess",
                formatter: that.formatter.formatPercent
            }),
            new sap.tnt.InfoLabel({
                text: "{msimilarity>vicStatus}"
            }).bindProperty("icon", {
                path: "msimilarity>vicStatus",
                formatter: that.formatter.statusIndicator
            }).bindProperty("colorScheme", {
                path: "msimilarity>vicStatus",
                formatter: that.formatter.formatStatus
            }),
            new sap.ui.core.Icon({
                src: "sap-icon://notes",
                tooltip: {
                    parts: ["msimilarity>comment"],
                    formatter: function (val) {
                        return val ? val : "No remarks";
                    }
                },
                press: this.onRemarksPress.bind(this),
                color: {
                    path: "msimilarity>comment",
                    formatter: function (val) {
                        return val ? "#e52929" : "#6a6d70";
                    }
                }
            }),
            new sap.m.Button({
                text: "Link",
                press: this.onLinkPress.bind(this),
                visible: "{= ${msimilarity>Link} !== '' }"
            })
        ]
    });

    if (!this._oTPC) {
        this._oTPC = new TablePersoController({
            table: this.getView().byId("table0"),
            componentName: "vicstartintegration",
            persoService: TPTblPersoService
        }).activate();
    }

    // ---------------- NEW: attach chart selection handler ----------------
    this.getView().addEventDelegate({
        onAfterRendering: function () {
            var oViz = that.getView().byId("mainViz");
            if (oViz && !oViz._bSelectAttached) {
                oViz.attachSelectData(that.onChartSelectData, that);
                oViz._bSelectAttached = true; // ensure only once
            }
        }
    });
},

// ---------------- NEW: chart section click ----------------
onChartSelectData: function (oEvent) {
    var aData = oEvent.getParameter("data");
    if (!aData || !aData.length) return;

    var raw = aData[0].data || aData[0];
    var sCategory = raw.Status || raw["Similarity %"] || raw.Bucket;
    var sProductArea = raw["Product Area"] || raw.ProductArea;
    var iCount = raw.Measure || raw.Count || 0;

    // Create Popover
    if (!this._oPopover) {
        this._oPopover = new sap.m.Popover({
            title: "Test Plans",
            contentWidth: "200px",
            content: [
                new sap.m.VBox("idPopoverBox", {
                    items: []
                })
            ]
        });
    }

    var oVBox = this._oPopover.getContent()[0];
    oVBox.destroyItems();
    oVBox.addItem(new sap.m.Text({
        text: iCount + " Test Plans in this section"
    }));
    oVBox.addItem(new sap.m.Button({
        text: "View Details",
        type: "Emphasized",
        press: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("Route2", {
                testplan: encodeURIComponent(sCategory || ""),
                productarea: encodeURIComponent(sProductArea || ""),
                executedon: ""
            });
            this._oPopover.close();
        }.bind(this)
    }));

    var oViz = this.getView().byId("mainViz");
    this._oPopover.openBy(oViz);
},
 

        onRouteMatched: function (oEvent) {
        
            var that = this;
            var testplan = decodeURIComponent(oEvent.getParameter("arguments").testplan);
            testplanName = testplan;
            var tp_date = decodeURIComponent(oEvent.getParameter("arguments").executedon);
            var productarea = oEvent.getParameter("arguments").productarea;
            productarea = decodeURIComponent(oEvent.getParameter("arguments").productarea);
            var oView = this.getView();
            oView.byId("idTxtTestPlanName").setText((testplan === "-" ? "" : testplan));
            oView.byId("idExecDate").setText(tp_date === "-" ? "" : tp_date);
            oView.byId("idTxtProdArea").setText(productarea === "-" ? "" : productarea);
            var aLogDataToSave = [];
            sap.ui.getCore().setModel(aLogDataToSave, "aLogDataToSave");
            var oBusyDialog = new sap.m.BusyDialog();
            oBusyDialog.open();
            $.ajax({
                url: "/VIC_UI_DEV/imageDetail/get-test-plan-details/" + testplan,
                type: 'GET',
                async: true,
                success: function (res) {
                    oBusyDialog.close();
                    res.Key = "No Data"
                    AllArray = structuredClone(res);

                    var comparedData = new JSONModel();
                    comparedData.success;
                    comparedData.setData(res);
                    that.getView().setModel(comparedData, "comparedData");
                    for (let i = 0; i < res.length; i++) {
                        res[i].serialNumber = i + 1;
                    }
                    var msimilarity = new JSONModel();
                    msimilarity.success;
                    msimilarity.setData(res);
                    that.getView().byId("tableTitle").setText("Test Cases (" + res.length + ")");
                    that.getView().setModel(msimilarity, "msimilarity");
                    that.getView().byId('table0').setModel(msimilarity, "msimilarity")

                    let percentCategories = {
                        '96-98': [],
                        '98-99': [],
                        '100': [],
                        '<96': []
                    };
                    
                    res.forEach(item => {
                        const percent = item.percentSuccess;
                        if (percent >= 96 && percent < 98) {
                            percentCategories['96-98'].push(item);
                        } else if (percent >= 98 && percent < 100) {
                            percentCategories['98-99'].push(item);
                        } else if (percent === 100) {
                            percentCategories['100'].push(item);
                        } else {
                            percentCategories['<96'].push(item);
                        }
                    });
                    const tileMap = {
                        '<96': "lessthan90Id",
                        '96-98': "greaterthan90Id",
                        '98-99': "greaterthan95Id",
                        '100': "greaterthan99Id"
                    };
                    
                    Object.keys(tileMap).forEach(key => {
                        const tile = that.getView().byId(tileMap[key]);
                        if (tile) {
                            tile.setText("Count: " + percentCategories[key].length);
                        }
                    });
                        
                },
            });

        },

        _onPageNavButtonPress: function () {
            var that = this;
            if (that.routeFlag) {
                that.routeFlag = undefined;
                that.aPackageList = [];
            }
            window.history.go(-1);
        },
        
        filterAndDisplayData: function (filterFn) {
          const filteredData = AllArray.filter(filterFn);

          if (filteredData.length === 0) {
        sap.m.MessageToast.show("No Data");
        this.getView().byId('onExportTable').setEnabled(false)
        this.getView().byId('idStatusSearch').setEnabled(false)
        this.getView().byId('editButton').setEnabled(false)
        this.getView().byId('onSorting').setEnabled(false)
            }
          else{
            this.getView().byId('onExportTable').setEnabled(true)
            this.getView().byId('idStatusSearch').setEnabled(true)
            this.getView().byId('editButton').setEnabled(true)
            this.getView().byId('onSorting').setEnabled(true)

            }

    const oView = this.getView();
    const oModel = oView.getModel("msimilarity");
    oModel.oData = filteredData;
    oModel.refresh(true);
    oView.byId("tableTitle").setText("Test Cases (" + filteredData.length + ")");
        },

        onFirstTilePress: function () {
        this.filterAndDisplayData(val => val.percentSuccess < 96);
        },

        onSecondTilePress: function () {
        this.filterAndDisplayData(val => val.percentSuccess >= 96 && val.percentSuccess < 98);
        },

        onThirdTilePress: function () {
        this.filterAndDisplayData(val => val.percentSuccess >= 98 && val.percentSuccess < 100);
        },

        onFourthTilePress: function () {
         this.filterAndDisplayData(val => val.percentSuccess === 100);
        },

        onDefaultTiles: function () {
           this.filterAndDisplayData(val => val.percentSuccess >= 96 && val.percentSuccess < 100);
        },

        onShowAllData: function () {
           this.filterAndDisplayData(() => true);
        },

        onLinkPress: function (oEvent) {
            var that = this;
            var oCurrentObj = oEvent.getSource().getBindingContext("msimilarity").getObject();

            var log1 = oCurrentObj.log1;
            var log2 = oCurrentObj.log2;
            var clog = oCurrentObj.cLog;
            Clog = clog;
            var testCaseId = oCurrentObj.testCaseId;
            var testcasename = oCurrentObj.testCaseName

            var sUrl =
                "https://camouflage-uidev.cfapps.eu12.hana.ondemand.com/camouflage/index.html#/View3Detail/" +
                testCaseId + "/" + log1 + "/" + log2 + "/" + clog + "/" + "VIC-UI" + "/" + testcasename;

            window.open(sUrl, "_blank");
        },

        onSearchButton: function (oEvent) {
            var orFilter = [];
            var sSrchValue = this.getView().byId("idStatusSearch").getValue();
            var oTable = this.getView().byId("table0");
            var aTableItems = oTable.getBinding("items");

            if (sSrchValue && sSrchValue !== "") {
                orFilter.push(new sap.ui.model.Filter("testCaseName", sap.ui.model.FilterOperator.Contains, sSrchValue));
            } else {
                orFilter.push(new sap.ui.model.Filter("testCaseName", sap.ui.model.FilterOperator.Contains, sSrchValue));
            }

            aTableItems.filter(new sap.ui.model.Filter(orFilter, false));
            this.getView().byId("tableTitle").setProperty("text", "Logs (" + aTableItems.getLength() + ")");
        },

        formatPercent: function (percent) {
            if (percent == null || percent === '') {
                return '';
            }
        
            let num = Number(percent);
            if (isNaN(num)) {
                return '';
            }
        
            return num.toFixed(2) + '%';
        },
        
        onExport: function () {
            var aCols, oRowBinding, oSettings, oSheet, oTable;

            if (!this._oTable) {
                this._oTable = this.byId('table0');
            }

            oTable = this._oTable;
            var aTableFilterData = [];
            var aIndices = oTable.getBinding('items').aIndices;
            var aTableFullData = oTable.getBinding('items').oList;
            for (var i = 0; i < aIndices.length; i++) {
                aTableFilterData.push(aTableFullData[aIndices[i]]);
            }
            var mTempExportData = new JSONModel(aTableFilterData);
            oRowBinding = mTempExportData.getProperty("/");
            aCols = this.createColumnConfig();

            oSettings = {
                workbook: {
                    columns: aCols,
                   
                },
                dataSource: oRowBinding,
                fileName: 'VIC test case Results.xlsx',
                };

            oSheet = new Spreadsheet(oSettings);
            var sMsg = "Do you want to export data to excel?";
            sap.m.MessageBox.show(sMsg, {
                title: "Export",
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                initialFocus: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === "OK") {
                        oSheet.build().finally(function () {
                            oSheet.destroy();
                        });
                    }
                }
            });
        },

        createColumnConfig: function () {
            var aCols = [];

            aCols.push({
                label: 'Test Case Name',
                property: 'testCaseName',
                type: EdmType.String,
            });

            aCols.push({
                label: 'Compared On ',
                property: 'executeOn',
                type: EdmType.String,
            });

            aCols.push({
                label: 'Similarity %',
                type: EdmType.String,
                property: 'percentSuccess',
            });

            return aCols;
        },

        onPersoButtonPressed: function () {
            this._oTPC.openDialog();
        },

        onEdit: function () {
            
            this._isEditMode = true;
            this._originalData = JSON.parse(JSON.stringify(this.getView().getModel("msimilarity").getData()));
            this.byId("editButton").setVisible(false);
            this.byId("save").setVisible(true);
            this.byId("cancel").setVisible(true);
            this.byId("footerbar").setVisible(true);
            var currentData = this.getView().getModel("msimilarity").getData();
            this.rebindTable(this.oEditableTemplate, "Edit");
            this.getView().getModel("msimilarity").setData(currentData);

        },

        rebindTable: function (oTemplate, sFlag) {
            var oModel = this.getView().getModel("msimilarity");
            this.oTable = this.getView().byId("table0");
            this.oTable.setModel(oModel, "msimilarity");
            this.oTable.bindAggregation("items", "msimilarity>/", oTemplate);

            if (sFlag === "Display") { 
                if (this._SortDialog) {
                    var sSortDesc = this._SortDialog.getSortDescending();
                    var sSortPath = "";
                    for (var i = 0; i < this._SortDialog.getSortItems().length; i++) {
                        if (this._SortDialog.getSortItems()[i].getSelected() === true) {
                            sSortPath = this._SortDialog.getSortItems()[i].getKey();
                        }
                    }
                    if (sSortPath && sSortPath !== "") {
                        var aSorters = [];
                        aSorters.push(new sap.ui.model.Sorter(sSortPath, sSortDesc));
                        this.oTable.getBinding("items").sort(aSorters);
                    }
                } else {
                    var oTableItems = this.getView().byId("table0").getBinding("items");
                    var aSorters = [];
                    aSorters.push(new sap.ui.model.Sorter("status", false)); // Default sorting by status
                    oTableItems.sort(aSorters);
                }
            }

            if (this.getView().byId("idStatusSearch").getValue() !== "") {
                this.onSearchButton();
            }
        },

        onStatusSelectChange: function (evt) {
            var oSelLog = evt.getSource().getParent().getBindingContext("msimilarity").getObject();
            var aLogDataToSave = sap.ui.getCore().getModel("aLogDataToSave") || [];
            console.log(aLogDataToSave)
            console.log(aLogDataToSave.length)

            // Store the original data in tempLogData if it doesn't exist yet
            var aOriginalLogData = sap.ui.getCore().getModel("originalLogData") || [];

            // Check if the entry already exists in the original data
            var bAlreadyInOriginal = aOriginalLogData.some(function (log) {
                return log.testCaseId === oSelLog.testCaseId;
            });

            if (!bAlreadyInOriginal) {
                var oOriginalCopy = $.extend(true, {}, oSelLog);
                aOriginalLogData.push(oOriginalCopy);
                sap.ui.getCore().setModel(aOriginalLogData, "originalLogData");
            }

            // Handle temporary selection change
            var sSelLogExistFlag = false;
            for (var i = 0; i < aLogDataToSave.length; i++) {
                if (oSelLog.testCaseId === aLogDataToSave[i].testCaseId) {
                    sSelLogExistFlag = true;
                    break;
                }
            }

            if (sSelLogExistFlag) {
                aLogDataToSave[i].vicStatus = evt.getSource().getSelectedKey();
            } else {
                var atempSelLog = $.map([oSelLog], function (obj) {
                    return $.extend(true, {}, obj);
                });
                atempSelLog[0].vicStatus = evt.getSource().getSelectedKey();
                aLogDataToSave.push(atempSelLog[0]);
            }

            sap.ui.getCore().setModel(aLogDataToSave, "aLogDataToSave");
        },

        onCancel: function (evt) {
            debugger
            var that = this;

            if (this.getView().byId("save").getVisible() === true) {
                sap.m.MessageBox.confirm("Changes will be lost, do you want to continue?", {
                    title: "Cancel",
                    actions: ["OK", "Cancel"],
                    onClose: function (sButton) {
                        if (sButton === "OK") {
                            // Revert the data to the original stored data
                            var oModel = that.getView().getModel("msimilarity");
                            oModel.setData(that._originalData);
                            oModel.refresh(); // Make sure the UI is updated with the original data

                            // Reset the view to display mode
                            that.byId("editButton").setVisible(true);
                            that.byId("save").setVisible(false);
                            that.byId("cancel").setVisible(false);
                            that.byId("footerbar").setVisible(false);
                            that._isEditMode = false;
                            // Rebind the table with the original read-only template
                            that.rebindTable(that.oReadOnlyTemplate, "Display");
                        }
                    }
                });
            }
        },

        onMessageInformationDialogPress: function () {
            var that = this;
            if (!this.oInfoMessageDialog) {
                this.oInfoMessageDialog = new Dialog({
                    type: DialogType.Message,
                    title: "Details",
                    state: ValueState.Information,
                    content: [
                        new Text({
                            text: "Test Cases considered for VIC : " + "\n Test Cases passed: " + "\n Test Cases failed:" +
                                "\n Test Cases with status as OK: " + "\n Test Cases with status as Application error: "
                        })
                    ],
                    beginButton: new Button({
                        type: ButtonType.Emphasized,
                        text: "OK",
                        press: function () {
                            this.oInfoMessageDialog.close();
                        }.bind(this)
                    })
                });
            }

            this.oInfoMessageDialog.open();
        },

        handleSortButtonPressed: function () {
            if (!this._oSortDialog) {
                this._oSortDialog = sap.ui.xmlfragment("vicstartintegration.view.fragment.LogDetailsSortDialog", this);
                this.getView().addDependent(this._oSortDialog);
            }
            this._oSortDialog.open();
        },

        handleSortDialogConfirm: function (oEvent) {
            var mParams = oEvent.getParameters();
            var sPath = mParams.sortItem?.getKey(); // Get the key of the selected SortItem
            var bDescending = mParams.sortDescending;
        
            if (!sPath) {
                sap.m.MessageToast.show("Please select a column to sort.");
                return;
            }

        // Convert camelCase or PascalCase to readable format
         var sFormattedPath = sPath.replace(/([a-z])([A-Z])/g, '$1 $2'); // Add space before uppercase letters
         sFormattedPath = sFormattedPath.charAt(0).toUpperCase() + sFormattedPath.slice(1); // Capitalize first letter
        
            var oTable = this.byId("table0");
            var oBinding = oTable.getBinding("items");
            var aSorters = [];
        
            // Add the Sorter with the selected path and sort order
            aSorters.push(new sap.ui.model.Sorter(sPath, bDescending));
            oBinding.sort(aSorters);
        
            sap.m.MessageToast.show(`Sorted by ${sFormattedPath} in ${bDescending ? "descending" : "ascending"} order.`);
        },

        onSave: function () {
            var that = this;
            var aLogDataToSave = sap.ui.getCore().getModel("aLogDataToSave");
        
            if (aLogDataToSave && aLogDataToSave.length > 0) {
                sap.m.MessageBox.confirm("Do you want to save changes?", {
                    title: "Confirmation",
                    actions: ["OK", "Cancel"],
                    onClose: function (sButton) {
                        if (sButton === "OK") {
                            var updatePromises = aLogDataToSave.map(function (logData) {
                                var clog = logData.cLog;
                                var newStatus = logData.vicStatus;
                                var comment = logData.comment || "";
        
                                var oPayload = {
                                    cLog: clog,
                                    newStatus: newStatus,
                                    comment: comment
                                };
        
                                return new Promise(function (resolve, reject) {
                                    $.ajax({
                                        url: "/VIC_UI_DEV/imageDetail/update-vic-status",
                                        type: "PUT",
                                        headers: {
                                            "Content-Type": "application/json"
                                        },
                                        data: JSON.stringify(oPayload),
                                        success: function () {
                                            resolve();
                                        },
                                        error: function (err) {
                                            console.error("API Error for", clog, ":", err);
                                            reject(err);
                                        }
                                    });
                                });
                            });
        
                            Promise.all(updatePromises)
                                .then(function () {
                                    that.updateLogDetailModel();
                                    sap.m.MessageToast.show("Data saved successfully.");
        
                                    that.byId("editButton").setVisible(true);
                                    that.byId("save").setVisible(false);
                                    that.byId("cancel").setVisible(false);
                                    that.byId("footerbar").setVisible(false);
                                    that._isEditMode = false;
        
                                    that.rebindTable(that.oReadOnlyTemplate, "Display");
                                    sap.ui.getCore().setModel([], "aLogDataToSave");
                                })
                                .catch(function (error) {
                                    sap.m.MessageToast.show("Failed to save one or more entries.");
                                });
                        }
                    }
                });
            } else {
                sap.m.MessageToast.show("No changes have been made.");
                that.onCancel();
            }
        },
          
        updateLogDetailModel: function () {
            var mLogDetail = this.oTable.getModel("msimilarity"); // Get the table's model
            var aLogDetail = mLogDetail.getProperty("/"); // Retrieve model data
            var aLogDataToSave = sap.ui.getCore().getModel("aLogDataToSave");

            for (var i = 0; i < aLogDataToSave.length; i++) {
                for (var j = 0; j < aLogDetail.length; j++) {
                    // Match records by `testCaseId` and update `vicStatus`
                    if (aLogDetail[j].testCaseId === aLogDataToSave[i].testCaseId) {
                        aLogDetail[j].vicStatus = aLogDataToSave[i].vicStatus;
                        aLogDetail[j].comment = aLogDataToSave[i].comment;
                    }
                }
            }

            // Refresh the model to reflect changes in the UI
            mLogDetail.refresh(true);
        },

        onRemarksPress: function (evt) {
            var oButton = evt.getSource();
            var oContext = oButton.getParent().getBindingContext("msimilarity");
            var sRemarks = oContext.getProperty("comment") || "";
        
            if (!this._RemarksDialog) {
                this._RemarksDialog = sap.ui.xmlfragment("vicstartintegration.view.fragment.remarks", this);
                this._RemarksDialog.addStyleClass("sapUiSizeCompact");
                this._RemarksDialog.setModel(this.getView().getModel("i18n"), "i18n");
            }
        
            var oText = sap.ui.getCore().byId("idTextRemarks");
            var oTextarea = sap.ui.getCore().byId("idTextareaRemarks");
        
            if (this._isEditMode) {
                oText.setVisible(false);
                oTextarea.setVisible(true);
                oTextarea.setValue(sRemarks);
            } else {
                oText.setVisible(true);
                oTextarea.setVisible(false);
                oText.setText(sRemarks);
            }
        
            this._RemarksDialog.setBindingContext(oContext, "msimilarity");
            this._RemarksDialog.openBy(oButton);
        },

        onRemarksDlgClose: function () {
            if (this._isEditMode) {
                var oTextarea = sap.ui.getCore().byId("idTextareaRemarks");
                var sNewRemarks = oTextarea.getValue();
                var oContext = this._RemarksDialog.getBindingContext("msimilarity");
        
                if (oContext) {
                    oContext.getModel().setProperty(oContext.getPath() + "/comment", sNewRemarks);
        
                    var oSelLog = oContext.getObject();
                    var aLogDataToSave = sap.ui.getCore().getModel("aLogDataToSave") || [];
        
                    var iIndex = aLogDataToSave.findIndex(function (log) {
                        return log.testCaseId === oSelLog.testCaseId;
                    });
        
                    if (iIndex >= 0) {
                        aLogDataToSave[iIndex].comment = sNewRemarks;
                    } else {
                        var oCopy = $.extend(true, {}, oSelLog);
                        oCopy.remarks = sNewRemarks;
                        aLogDataToSave.push(oCopy);
                    }
        
                    sap.ui.getCore().setModel(aLogDataToSave, "aLogDataToSave");
                }
            }
        
            this._RemarksDialog.close();
        }
        
        
    });
});