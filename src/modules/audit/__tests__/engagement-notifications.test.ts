import { NOTIFICATION_TEMPLATES } from '../../messaging/constants/notification-templates.constant';

describe('engagement assignment notification templates', () => {
  it('contains email and in_app templates for auditee_assigned', () => {
    const emailTpl = NOTIFICATION_TEMPLATES.find(
      (t) => t.eventKey === 'audit.engagement.auditee_assigned' && t.channel === 'email',
    );
    const inAppTpl = NOTIFICATION_TEMPLATES.find(
      (t) => t.eventKey === 'audit.engagement.auditee_assigned' && t.channel === 'in_app',
    );

    expect(emailTpl).toBeDefined();
    expect(emailTpl?.subject).toContain('{{entityName}}');
    expect(emailTpl?.body).toContain('{{auditeeName}}');
    expect(emailTpl?.body).toContain('{{engagementTitle}}');
    expect(emailTpl?.body).toContain('{{plannedStartDate}}');
    expect(emailTpl?.body).toContain('{{plannedEndDate}}');
    expect(emailTpl?.body).toContain('{{leadAuditorName}}');
    expect(emailTpl?.body).toContain('{{managerName}}');
    expect(emailTpl?.body).toContain('log in to IAMS');

    expect(inAppTpl).toBeDefined();
    expect(inAppTpl?.body).toContain('{{entityName}}');
    expect(inAppTpl?.body).toContain('{{engagementTitle}}');
  });

  it('contains email and in_app templates for lead_assigned', () => {
    const emailTpl = NOTIFICATION_TEMPLATES.find(
      (t) => t.eventKey === 'audit.engagement.lead_assigned' && t.channel === 'email',
    );
    const inAppTpl = NOTIFICATION_TEMPLATES.find(
      (t) => t.eventKey === 'audit.engagement.lead_assigned' && t.channel === 'in_app',
    );

    expect(emailTpl).toBeDefined();
    expect(emailTpl?.subject).toContain('Lead Auditor Assignment');
    expect(emailTpl?.body).toContain('{{leadAuditorName}}');
    expect(emailTpl?.body).toContain('{{olaDeadline}}');
    expect(emailTpl?.body).toContain('{{managerName}}');
    expect(emailTpl?.body).toContain('{{auditeeName}}');

    expect(inAppTpl).toBeDefined();
    expect(inAppTpl?.body).toContain('Lead Auditor');
    expect(inAppTpl?.body).toContain('{{engagementTitle}}');
  });

  it('contains email and in_app templates for manager_assigned', () => {
    const emailTpl = NOTIFICATION_TEMPLATES.find(
      (t) => t.eventKey === 'audit.engagement.manager_assigned' && t.channel === 'email',
    );
    const inAppTpl = NOTIFICATION_TEMPLATES.find(
      (t) => t.eventKey === 'audit.engagement.manager_assigned' && t.channel === 'in_app',
    );

    expect(emailTpl).toBeDefined();
    expect(emailTpl?.subject).toContain('Audit Manager Assignment');
    expect(emailTpl?.body).toContain('{{managerName}}');
    expect(emailTpl?.body).toContain('{{olaDeadline}}');
    expect(emailTpl?.body).toContain('{{leadAuditorName}}');
    expect(emailTpl?.body).toContain('{{auditeeName}}');

    expect(inAppTpl).toBeDefined();
    expect(inAppTpl?.body).toContain('Audit Manager');
    expect(inAppTpl?.body).toContain('{{engagementTitle}}');
  });

  it('uses OLA Deadline in workflow.assignment.created template', () => {
    const emailTpl = NOTIFICATION_TEMPLATES.find(
      (t) => t.eventKey === 'workflow.assignment.created' && t.channel === 'email',
    );
    expect(emailTpl).toBeDefined();
    expect(emailTpl?.body).toContain('OLA Deadline: {{olaDeadline}}');
    expect(emailTpl?.body).not.toContain('SLA Deadline');
  });

  it('uses OLA Deadline across all audit escalation email templates', () => {
    for (const level of [1, 2, 3, 4]) {
      const emailTpl = NOTIFICATION_TEMPLATES.find(
        (t) => t.eventKey === `audit.escalation.level_${level}` && t.channel === 'email',
      );
      expect(emailTpl).toBeDefined();
      expect(emailTpl?.body).toContain('OLA Deadline: {{slaDeadline}}');
      expect(emailTpl?.body).not.toContain('SLA Deadline');
    }
  });
});
