export declare enum AssetType {
    Server = "server",
    Endpoint = "endpoint",
    NetworkDevice = "network_device",
    Application = "application",
    Database = "database",
    CloudResource = "cloud_resource",
    InformationAsset = "information_asset",
    BusinessService = "business_service",
    Facility = "facility",
    ThirdPartyService = "third_party_service",
    ProjectAsset = "project_asset",
    Other = "other"
}
export declare enum AssetStatus {
    Active = "active",
    Inactive = "inactive",
    Retired = "retired",
    Disposed = "disposed",
    Unknown = "unknown"
}
export declare enum AssetLifecycleState {
    Proposed = "proposed",
    Active = "active",
    UnderMaintenance = "under_maintenance",
    Inactive = "inactive",
    Retired = "retired",
    Disposed = "disposed",
    Unknown = "unknown"
}
export declare enum AssetRating {
    Low = "low",
    Medium = "medium",
    High = "high",
    Critical = "critical"
}
export declare enum DataClassification {
    Public = "public",
    Internal = "internal",
    Confidential = "confidential",
    Restricted = "restricted"
}
export declare enum AssetSourceSystem {
    Manual = "manual",
    Dynafin = "dynafin",
    Imoc = "imoc",
    ActiveDirectory = "active_directory",
    ProjectPlus = "project_plus",
    SharedDrive = "shared_drive",
    Cmdb = "cmdb",
    Other = "other"
}
export declare enum AssetRelationshipType {
    DependsOn = "depends_on",
    RunsOn = "runs_on",
    StoresDataIn = "stores_data_in",
    ProtectedBy = "protected_by",
    IntegratesWith = "integrates_with",
    Supports = "supports",
    PartOf = "part_of",
    Other = "other"
}
export declare enum AssetAttestationStatus {
    Confirmed = "confirmed",
    ChangesRequired = "changes_required",
    Rejected = "rejected"
}
export declare enum AssetSyncStatus {
    Synced = "synced",
    Pending = "pending",
    Failed = "failed",
    Stale = "stale"
}
export declare enum AssetScopeRole {
    Primary = "primary",
    Supporting = "supporting",
    Dependency = "dependency",
    ExcludedReference = "excluded_reference"
}
//# sourceMappingURL=asset.enum.d.ts.map