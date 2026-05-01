// src/modules/messaging/utility/template.utility.ts

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export const renderTemplate = (
  body: string,
  variables: Record<string, string>,
): string =>
  body.replace(PLACEHOLDER_PATTERN, (match, key: string) => {
    const value = variables[key];
    return value === undefined ? match : value;
  });
