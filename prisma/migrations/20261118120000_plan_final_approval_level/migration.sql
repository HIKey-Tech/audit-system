-- Audit programmes now go to the Director General for final approval after the Head of Internal Audit.
-- Only touches a stored approval matrix whose programme chain is still the old single level, and leaves any
-- chain an administrator has already customised unchanged.
UPDATE system_config
SET value = JSON_MODIFY(value, '$.auditPlan', JSON_QUERY('["plan:approve","plan:approve:final"]'))
WHERE [key] = 'approval_matrix'
  AND ISJSON(value) = 1
  AND JSON_VALUE(value, '$.auditPlan[0]') = 'plan:approve'
  AND JSON_VALUE(value, '$.auditPlan[1]') IS NULL;
