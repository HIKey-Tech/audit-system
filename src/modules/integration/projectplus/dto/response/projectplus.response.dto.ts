import { Projectplus_Entity_Link } from '@prisma/client';

export interface ProjectPlusEntityLinkResponseDto {
  id: string;
  engagementId: string;
  customerType: string;
  referenceCode: string;
  fullName: string;
  entityType: string | null;
  entitySubType: string | null;
  rcNumber: string | null;
  tin: string | null;
  lastStatus: string | null;
  lastSyncedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const mapProjectPlusLinkToResponse = (l: Projectplus_Entity_Link): ProjectPlusEntityLinkResponseDto => ({
  id: l.id,
  engagementId: l.engagement_id,
  customerType: l.customer_type,
  referenceCode: l.reference_code,
  fullName: l.full_name,
  entityType: l.entity_type,
  entitySubType: l.entity_sub_type,
  rcNumber: l.rc_number,
  tin: l.tin,
  lastStatus: l.last_status,
  lastSyncedAt: l.last_synced_at ? l.last_synced_at.toISOString() : null,
  isActive: l.is_active,
  createdAt: l.created_at.toISOString(),
  updatedAt: l.updated_at.toISOString(),
});
