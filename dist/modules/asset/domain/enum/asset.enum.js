"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetScopeRole = exports.AssetSyncStatus = exports.AssetAttestationStatus = exports.AssetRelationshipType = exports.AssetSourceSystem = exports.DataClassification = exports.AssetRating = exports.AssetLifecycleState = exports.AssetStatus = exports.AssetType = void 0;
var AssetType;
(function (AssetType) {
    AssetType["Server"] = "server";
    AssetType["Endpoint"] = "endpoint";
    AssetType["NetworkDevice"] = "network_device";
    AssetType["Application"] = "application";
    AssetType["Database"] = "database";
    AssetType["CloudResource"] = "cloud_resource";
    AssetType["InformationAsset"] = "information_asset";
    AssetType["BusinessService"] = "business_service";
    AssetType["Facility"] = "facility";
    AssetType["ThirdPartyService"] = "third_party_service";
    AssetType["ProjectAsset"] = "project_asset";
    AssetType["Other"] = "other";
})(AssetType || (exports.AssetType = AssetType = {}));
var AssetStatus;
(function (AssetStatus) {
    AssetStatus["Active"] = "active";
    AssetStatus["Inactive"] = "inactive";
    AssetStatus["Retired"] = "retired";
    AssetStatus["Disposed"] = "disposed";
    AssetStatus["Unknown"] = "unknown";
})(AssetStatus || (exports.AssetStatus = AssetStatus = {}));
var AssetLifecycleState;
(function (AssetLifecycleState) {
    AssetLifecycleState["Proposed"] = "proposed";
    AssetLifecycleState["Active"] = "active";
    AssetLifecycleState["UnderMaintenance"] = "under_maintenance";
    AssetLifecycleState["Inactive"] = "inactive";
    AssetLifecycleState["Retired"] = "retired";
    AssetLifecycleState["Disposed"] = "disposed";
    AssetLifecycleState["Unknown"] = "unknown";
})(AssetLifecycleState || (exports.AssetLifecycleState = AssetLifecycleState = {}));
var AssetRating;
(function (AssetRating) {
    AssetRating["Low"] = "low";
    AssetRating["Medium"] = "medium";
    AssetRating["High"] = "high";
    AssetRating["Critical"] = "critical";
})(AssetRating || (exports.AssetRating = AssetRating = {}));
var DataClassification;
(function (DataClassification) {
    DataClassification["Public"] = "public";
    DataClassification["Internal"] = "internal";
    DataClassification["Confidential"] = "confidential";
    DataClassification["Restricted"] = "restricted";
})(DataClassification || (exports.DataClassification = DataClassification = {}));
var AssetSourceSystem;
(function (AssetSourceSystem) {
    AssetSourceSystem["Manual"] = "manual";
    AssetSourceSystem["Dynafin"] = "dynafin";
    AssetSourceSystem["Imoc"] = "imoc";
    AssetSourceSystem["ActiveDirectory"] = "active_directory";
    AssetSourceSystem["ProjectPlus"] = "project_plus";
    AssetSourceSystem["SharedDrive"] = "shared_drive";
    AssetSourceSystem["Cmdb"] = "cmdb";
    AssetSourceSystem["Other"] = "other";
})(AssetSourceSystem || (exports.AssetSourceSystem = AssetSourceSystem = {}));
var AssetRelationshipType;
(function (AssetRelationshipType) {
    AssetRelationshipType["DependsOn"] = "depends_on";
    AssetRelationshipType["RunsOn"] = "runs_on";
    AssetRelationshipType["StoresDataIn"] = "stores_data_in";
    AssetRelationshipType["ProtectedBy"] = "protected_by";
    AssetRelationshipType["IntegratesWith"] = "integrates_with";
    AssetRelationshipType["Supports"] = "supports";
    AssetRelationshipType["PartOf"] = "part_of";
    AssetRelationshipType["Other"] = "other";
})(AssetRelationshipType || (exports.AssetRelationshipType = AssetRelationshipType = {}));
var AssetAttestationStatus;
(function (AssetAttestationStatus) {
    AssetAttestationStatus["Confirmed"] = "confirmed";
    AssetAttestationStatus["ChangesRequired"] = "changes_required";
    AssetAttestationStatus["Rejected"] = "rejected";
})(AssetAttestationStatus || (exports.AssetAttestationStatus = AssetAttestationStatus = {}));
var AssetSyncStatus;
(function (AssetSyncStatus) {
    AssetSyncStatus["Synced"] = "synced";
    AssetSyncStatus["Pending"] = "pending";
    AssetSyncStatus["Failed"] = "failed";
    AssetSyncStatus["Stale"] = "stale";
})(AssetSyncStatus || (exports.AssetSyncStatus = AssetSyncStatus = {}));
var AssetScopeRole;
(function (AssetScopeRole) {
    AssetScopeRole["Primary"] = "primary";
    AssetScopeRole["Supporting"] = "supporting";
    AssetScopeRole["Dependency"] = "dependency";
    AssetScopeRole["ExcludedReference"] = "excluded_reference";
})(AssetScopeRole || (exports.AssetScopeRole = AssetScopeRole = {}));
//# sourceMappingURL=asset.enum.js.map