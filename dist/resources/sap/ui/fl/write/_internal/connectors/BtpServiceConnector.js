/*!
 * OpenUI5
 * (c) Copyright 2009-2024 SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
 */
sap.ui.define(["sap/base/util/merge","sap/ui/fl/Layer","sap/ui/fl/write/_internal/connectors/KeyUserConnector","sap/ui/fl/initial/_internal/connectors/BtpServiceConnector"],function(n,t,e,s){"use strict";var O=n({},e,{layers:[t.CUSTOMER,t.PUBLIC,t.USER],ROUTES:{CHANGES:`${s.ROOT}/changes`,SETTINGS:`${s.ROOT}/settings`,TOKEN:`${s.ROOT}/settings`,VERSIONS:{GET:`${s.ROOT}/versions`,ACTIVATE:`${s.ROOT}/versions/activate`,DISCARD:`${s.ROOT}/versions/draft`,PUBLISH:`${s.ROOT}/versions/publish`},TRANSLATION:{UPLOAD:`${s.ROOT}/translation/texts`,DOWNLOAD:`${s.ROOT}/translation/texts`,GET_SOURCELANGUAGE:`${s.ROOT}/translation/sourcelanguages`},CONTEXTS:`${s.ROOT}/contexts`}});O.initialConnector=s;return O});
//# sourceMappingURL=BtpServiceConnector.js.map