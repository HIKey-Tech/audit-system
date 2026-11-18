import {
  GBB_APPROVAL_HEADERS,
  GBB_CHANGE_CONTROL_NOTE,
  GBB_CHANGE_HISTORY_HEADERS,
  GBB_CONFIDENTIALITY_NOTICE,
  GBB_DISTRIBUTION_HEADERS,
  GBB_DOC_INFO_LABELS,
  GBB_ORG_NAME,
  GBB_VALIDITY_HEADING,
  gbbValidityText,
  loadGbbLogoFlat,
} from '../../../shared/documents/gbb-document.constants';

const esc = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const table = (header: readonly string[] | null, rows: string[][]): string =>
  `<table><tbody>${header ? `<tr>${header.map((h) => `<th><p>${esc(h)}</p></th>`).join('')}</tr>` : ''}${rows
    .map((r) => `<tr>${r.map((c) => `<td><p>${c ? esc(c) : ''}</p></td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;

/**
 * The starting content of a document begun from the GBB template: the same cover, document information, change
 * history, distribution, approval and change-control front matter as GBB's controlled documents, followed by a
 * body to write in. Everything is ordinary editable content: nothing is locked, so it can be changed freely.
 */
export const buildGbbTemplateContent = (opts: { title: string; author: string; reference: string; date: string }): string => {
  const logo = `data:image/png;base64,${loadGbbLogoFlat().toString('base64')}`;
  const info = [
    opts.reference,
    'Version 1.0',
    opts.date,
    'Internal Audit',
    '',
    opts.author,
    '',
    'Internal Use Only',
    'Draft',
  ];
  return [
    `<p style="text-align: center"><img src="${logo}" alt="Galaxy Backbone Limited" width="170"></p>`,
    `<h1 style="text-align: center">${esc(GBB_ORG_NAME)}</h1>`,
    `<h1 style="text-align: center">${esc(opts.title)}</h1>`,
    `<p style="text-align: center"><strong>Version 1.0</strong></p>`,
    `<p style="text-align: center"><em><u>DOCUMENT REFERENCE NUMBER:</u></em></p>`,
    `<p style="text-align: center"><em>${esc(opts.reference)}</em></p>`,
    `<p style="text-align: center"><strong>Confidentiality</strong></p>`,
    `<p style="text-align: center">${esc(GBB_CONFIDENTIALITY_NOTICE)}</p>`,
    `<hr>`,
    `<h2>Document Information</h2>`,
    table(null, GBB_DOC_INFO_LABELS.map((label, i) => [label, info[i] ?? ''])),
    `<h2>Change history</h2>`,
    table(GBB_CHANGE_HISTORY_HEADERS, [['1.0', opts.date, opts.author, 'Initial version']]),
    `<h2>Distribution List</h2>`,
    table(GBB_DISTRIBUTION_HEADERS, [['', '', '']]),
    `<h2>Approval List</h2>`,
    table(GBB_APPROVAL_HEADERS, [['', '', '', '']]),
    `<h2>Change Control</h2>`,
    `<p>${esc(GBB_CHANGE_CONTROL_NOTE)}</p>`,
    `<hr>`,
    `<h1>1. Introduction</h1>`,
    `<p></p>`,
    `<h1>${esc(GBB_VALIDITY_HEADING)}</h1>`,
    `<p>${esc(gbbValidityText(opts.date))}</p>`,
  ].join('');
};
