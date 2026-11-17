// Configurable thresholds for the Dynafin financial analyses (reporting spec §6.6:
// "authorised users shall be able to modify the thresholds without software redevelopment").
//
// They live in `system_config`, so they appear in Settings → Config and every change is
// written to the audit trail with the old and new value (see SystemConfigService). If a
// row is missing or unreadable the built-in defaults below apply, so analyses never fail
// because of configuration.
import { prisma } from '../../../shared/prisma/prisma.client';
import { logger } from '../../../shared/utils/logger.util';
import {
  DEFAULT_HIGH_VALUE_EXPENDITURE_THRESHOLD,
  DEFAULT_HIGH_VALUE_THRESHOLD,
} from './analyzers/high-value-transactions.analyzer';

export const DYNAFIN_CONFIG_KEYS = {
  highValue: 'dynafin.high_value_threshold',
  highValueExpenditure: 'dynafin.high_value_expenditure_threshold',
} as const;

/** Keys whose old/new values are written to the audit trail when changed. */
export const isDynafinConfigKey = (key: string): boolean => key.startsWith('dynafin.');

const DEFINITIONS: Array<{ key: string; value: number; description: string }> = [
  {
    key: DYNAFIN_CONFIG_KEYS.highValue,
    value: DEFAULT_HIGH_VALUE_THRESHOLD,
    description:
      'High-value transaction threshold (₦). Individual transactions strictly ABOVE this amount are reported weekly; an amount exactly equal does not qualify and transactions are never added together.',
  },
  {
    key: DYNAFIN_CONFIG_KEYS.highValueExpenditure,
    value: DEFAULT_HIGH_VALUE_EXPENDITURE_THRESHOLD,
    description:
      'High-value expenditure threshold (₦) for the nine named expenditure categories. Individual transactions strictly ABOVE this amount are reported weekly.',
  },
];

/**
 * Parses an admin-typed amount ("10,000,000", "₦5000000"). Null when unusable — and a blank,
 * zero or negative value is unusable: a threshold of ₦0 would flag every transaction, so a
 * blanked-out setting must fall back to the default rather than become zero.
 */
export const parseThreshold = (raw: string | null | undefined): number | null => {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).replace(/[,\s₦]/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n > 0 ? n : null;
};

/**
 * Creates the threshold rows when they do not exist — never overwrites a value an
 * administrator has set. Safe to run on every start. Never throws: a failure here must
 * not stop the application.
 */
export const ensureDynafinConfigDefaults = async (): Promise<void> => {
  try {
    for (const def of DEFINITIONS) {
      await prisma.system_Config.upsert({
        where: { key: def.key },
        create: { key: def.key, value: String(def.value), description: def.description, is_public: false },
        update: {},
      });
    }
  } catch (err) {
    logger.warn('Dynafin threshold defaults could not be ensured', { err });
  }
};
