export declare const renderTemplate: (body: string, variables: Record<string, string>) => string;
/**
 * Plain-text email body → HTML. Line breaks are kept (email clients collapse bare
 * newlines), every value is escaped (request descriptions and comments are user
 * text), URLs become links, and an "Open in IAMS" button points at `actionUrl`.
 */
export declare const plainTextToEmailHtml: (text: string, actionUrl: string) => string;
//# sourceMappingURL=template.utility.d.ts.map