export const ASSET_TYPES = [
  ['server', 'Server'],
  ['endpoint', 'Endpoint'],
  ['network_device', 'Network device'],
  ['application', 'Application'],
  ['database', 'Database'],
  ['cloud_resource', 'Cloud resource'],
  ['information_asset', 'Information asset'],
  ['business_service', 'Business service'],
  ['facility', 'Facility'],
  ['third_party_service', 'Third-party service'],
  ['project_asset', 'Project asset'],
  ['other', 'Other'],
] as const;

export const ASSET_STATUSES = [
  ['active', 'Active'],
  ['inactive', 'Inactive'],
  ['retired', 'Retired'],
  ['disposed', 'Disposed'],
  ['unknown', 'Unknown'],
] as const;

export const ASSET_LIFECYCLES = [
  ['proposed', 'Proposed'],
  ['active', 'Active'],
  ['under_maintenance', 'Under maintenance'],
  ['inactive', 'Inactive'],
  ['retired', 'Retired'],
  ['disposed', 'Disposed'],
  ['unknown', 'Unknown'],
] as const;

export const ASSET_RATINGS = [
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
  ['critical', 'Critical'],
] as const;

export const DATA_CLASSIFICATIONS = [
  ['public', 'Public'],
  ['internal', 'Internal'],
  ['confidential', 'Confidential'],
  ['restricted', 'Restricted'],
] as const;

export const ASSET_SOURCE_SYSTEMS = [
  ['manual', 'Manual'],
  ['dynafin', 'Dynafin'],
  ['imoc', 'IMOC'],
  ['active_directory', 'Active Directory'],
  ['project_plus', 'Project Plus'],
  ['shared_drive', 'Shared Drive'],
  ['cmdb', 'CMDB'],
  ['other', 'Other'],
] as const;

export const ASSET_RELATIONSHIP_TYPES = [
  ['depends_on', 'Depends on'],
  ['runs_on', 'Runs on'],
  ['stores_data_in', 'Stores data in'],
  ['protected_by', 'Protected by'],
  ['integrates_with', 'Integrates with'],
  ['supports', 'Supports'],
  ['part_of', 'Part of'],
  ['other', 'Other'],
] as const;

export const ASSET_ATTESTATION_STATUSES = [
  ['confirmed', 'Confirmed'],
  ['changes_required', 'Changes required'],
  ['rejected', 'Rejected'],
] as const;

export const ASSET_SYNC_STATUSES = [
  ['synced', 'Synced'],
  ['pending', 'Pending'],
  ['failed', 'Failed'],
  ['stale', 'Stale'],
] as const;

export const ASSET_SCOPE_ROLES = [
  ['primary', 'Primary'],
  ['supporting', 'Supporting'],
  ['dependency', 'Dependency'],
  ['excluded_reference', 'Excluded reference'],
] as const;

const labels = new Map<string, string>([
  ...ASSET_TYPES,
  ...ASSET_STATUSES,
  ...ASSET_LIFECYCLES,
  ...ASSET_RATINGS,
  ...DATA_CLASSIFICATIONS,
  ...ASSET_SOURCE_SYSTEMS,
  ...ASSET_RELATIONSHIP_TYPES,
  ...ASSET_ATTESTATION_STATUSES,
  ...ASSET_SYNC_STATUSES,
  ...ASSET_SCOPE_ROLES,
]);

export const assetLabel = (value: string | null | undefined): string => {
  if (!value) return '—';
  return labels.get(value) ?? value.replace(/_/g, ' ');
};

export const assetRatingTone = (
  value: string,
): 'red' | 'amber' | 'green' | 'gray' | 'blue' => {
  if (value === 'critical') return 'red';
  if (value === 'high') return 'amber';
  if (value === 'medium') return 'blue';
  if (value === 'low') return 'green';
  return 'gray';
};

export const assetClassificationTone = (
  value: string,
): 'red' | 'amber' | 'green' | 'gray' | 'blue' => {
  if (value === 'restricted') return 'red';
  if (value === 'confidential') return 'amber';
  if (value === 'internal') return 'blue';
  if (value === 'public') return 'green';
  return 'gray';
};
