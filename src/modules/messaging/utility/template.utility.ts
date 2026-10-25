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

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;

/**
 * Plain-text email body → HTML. Line breaks are kept (email clients collapse bare
 * newlines), every value is escaped (request descriptions and comments are user
 * text), URLs become links, and an "Open in IAMS" button points at `actionUrl`.
 */
export const plainTextToEmailHtml = (text: string, actionUrl: string): string => {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((para) => escapeHtml(para).replace(URL_PATTERN, '<a href="$1">$1</a>').replace(/\n/g, '<br>'))
    .map((para) => `<p style="margin:0 0 14px">${para}</p>`)
    .join('');
  const href = escapeHtml(actionUrl);
  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1A202C">',
    paragraphs,
    `<p style="margin:20px 0 0"><a href="${href}" style="display:inline-block;background:#008751;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold">Open in IAMS</a></p>`,
    `<p style="margin:12px 0 0;font-size:12px;color:#5A6470">Or copy this link: <a href="${href}">${href}</a></p>`,
    '</div>',
  ].join('');
};
