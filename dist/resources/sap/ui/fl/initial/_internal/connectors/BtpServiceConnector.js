/*!
 * OpenUI5
 * (c) Copyright 2009-2024 SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
 */
sap.ui.define(["sap/base/util/merge","sap/ui/fl/initial/_internal/connectors/KeyUserConnector","sap/ui/fl/Layer"],function(e,a,n){"use strict";var s="/flex/all";var t="/v3";const i=`${s}${t}`;const r=e({},a,{layers:[n.CUSTOMER,n.PUBLIC,n.USER],ROOT:i,ROUTES:{DATA:`${i}/data`,SETTINGS:`${i}/settings`}});return r});
//# sourceMappingURL=BtpServiceConnector.js.map