import { describePlanTodos, shouldRemindDraftPlan } from '../utility/planning.utility';
import { NOTIFICATION_TEMPLATES } from '../../../messaging/constants/notification-templates.constant';

describe('unfinished audit programme reminders', () => {
  describe('describePlanTodos', () => {
    it('a draft with no universe entities needs linking and submitting', () => {
      expect(describePlanTodos({ status: 'draft', itemCount: 0 })).toEqual([
        'Link it to the audit universe: add at least one entity',
        'Submit it for approval',
      ]);
    });

    it('a draft that already has entities only needs submitting', () => {
      expect(describePlanTodos({ status: 'draft', itemCount: 3 })).toEqual(['Submit it for approval']);
    });

    it('a rejected programme shows the reason and asks for a resubmission', () => {
      const todos = describePlanTodos({ status: 'rejected', itemCount: 2, rejectionReason: 'Scope too wide' });
      expect(todos[0]).toContain('Scope too wide');
      expect(todos[todos.length - 1]).toBe('Resubmit it for approval');
    });

    it('a rejected programme without a reason still reads sensibly', () => {
      expect(describePlanTodos({ status: 'rejected', itemCount: 1, rejectionReason: '  ' })[0]).toBe('It was rejected — revise it');
    });
  });

  describe('shouldRemindDraftPlan', () => {
    it('chases on day 1, day 3, day 7 and then weekly — never every day', () => {
      const days = Array.from({ length: 31 }, (_, d) => d).filter(shouldRemindDraftPlan);
      expect(days).toEqual([1, 3, 7, 14, 21, 28]);
    });

    it('does not remind a programme created today', () => {
      expect(shouldRemindDraftPlan(0)).toBe(false);
    });
  });

  it('has both an email and an in-app template for the reminder', () => {
    const channels = NOTIFICATION_TEMPLATES.filter((t) => t.eventKey === 'audit.plan.draft_reminder').map((t) => t.channel).sort();
    expect(channels).toEqual(['email', 'in_app']);
    const email = NOTIFICATION_TEMPLATES.find((t) => t.eventKey === 'audit.plan.draft_reminder' && t.channel === 'email')!;
    for (const variable of ['recipientName', 'planTitle', 'planYear', 'daysInDraft', 'todoList', 'planLink']) {
      expect(email.body).toContain(`{{${variable}}}`);
    }
  });
});
