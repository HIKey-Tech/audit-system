/**
 * Allow-listed, read-only view of a Project Plus entity (customer / vendor /
 * client). Sensitive upstream fields (password, NIN, phone numbers, emails) are
 * deliberately not represented here.
 */
export interface ProjectPlusEntity {
  referenceCode: string | null;
  pin: string | null;
  fullName: string;
  entityType: string | null;
  entitySubType: string | null;
  rcNumber: string | null;
  tin: string | null;
  website: string | null;
  contactPersonFullName: string | null;
  status: string | null;
  recordDate: string | null;
  createdBy: string | null;
  finClientId: string | null;
  finVendorId: string | null;
  finCustomerId: string | null;
}

export interface ProjectPlusDocumentType {
  code: string;
  description: string;
}

export interface ProjectPlusStatus {
  reachable: boolean;
  authenticated: boolean;
  lastError: string | null;
  checkedAt: string;
}

export interface ProjectPlusEntityPage {
  items: ProjectPlusEntity[];
  total: number;
  page: number;
  pageSize: number;
}
