"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskScoreBand = exports.RiskStatus = void 0;
var RiskStatus;
(function (RiskStatus) {
    RiskStatus["Open"] = "open";
    RiskStatus["Mitigated"] = "mitigated";
    RiskStatus["Accepted"] = "accepted";
    RiskStatus["Closed"] = "closed";
})(RiskStatus || (exports.RiskStatus = RiskStatus = {}));
var RiskScoreBand;
(function (RiskScoreBand) {
    RiskScoreBand["Low"] = "low";
    RiskScoreBand["Medium"] = "medium";
    RiskScoreBand["High"] = "high";
    RiskScoreBand["Critical"] = "critical";
})(RiskScoreBand || (exports.RiskScoreBand = RiskScoreBand = {}));
//# sourceMappingURL=risk.enum.js.map