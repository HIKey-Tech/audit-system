export interface NotificationTemplateDefinition {
    eventKey: string;
    channel: 'email' | 'in_app';
    name: string;
    subject: string | null;
    body: string;
    description: string;
}
export declare const NOTIFICATION_TEMPLATES: NotificationTemplateDefinition[];
//# sourceMappingURL=notification-templates.constant.d.ts.map