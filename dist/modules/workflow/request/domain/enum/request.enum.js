"use strict";
// Ad-hoc workflow request enums. SQL Server has no native enums, so these
// mirror the String columns on workflow_requests / steps / actions.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestActionType = exports.RequestStepStatus = exports.RequestStatus = void 0;
var RequestStatus;
(function (RequestStatus) {
    RequestStatus["Pending"] = "pending";
    RequestStatus["Completed"] = "completed";
    RequestStatus["Rejected"] = "rejected";
    RequestStatus["Cancelled"] = "cancelled";
})(RequestStatus || (exports.RequestStatus = RequestStatus = {}));
var RequestStepStatus;
(function (RequestStepStatus) {
    RequestStepStatus["Pending"] = "pending";
    RequestStepStatus["Approved"] = "approved";
    RequestStepStatus["Signed"] = "signed";
    RequestStepStatus["Rejected"] = "rejected";
})(RequestStepStatus || (exports.RequestStepStatus = RequestStepStatus = {}));
var RequestActionType;
(function (RequestActionType) {
    RequestActionType["Approve"] = "approve";
    RequestActionType["Reject"] = "reject";
    RequestActionType["Sign"] = "sign";
    RequestActionType["Comment"] = "comment";
})(RequestActionType || (exports.RequestActionType = RequestActionType = {}));
//# sourceMappingURL=request.enum.js.map