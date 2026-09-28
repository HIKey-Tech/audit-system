"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OidcProvider = exports.UserStatus = void 0;
// src/modules/user/domain/enum/user.enum.ts
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "active";
    UserStatus["INACTIVE"] = "inactive";
    UserStatus["SUSPENDED"] = "suspended";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
var OidcProvider;
(function (OidcProvider) {
    OidcProvider["AZURE_AD"] = "azure_ad";
    OidcProvider["GENERIC"] = "generic";
})(OidcProvider || (exports.OidcProvider = OidcProvider = {}));
//# sourceMappingURL=user.enum.js.map