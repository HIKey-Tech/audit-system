import { ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';

/**
 * Shown instead of the normal app shell content when a user has authenticated
 * successfully but holds zero roles/permissions — most commonly a first-time
 * SSO login before their Azure AD group has been mapped to an IAMS role (see
 * directory_group_mappings; unmapped SSO users get no roles, not even viewer).
 * Without this, every page just silently renders its emptied-out permission-gated
 * state, which looks broken rather than "ask your admin to map your group."
 */
export const NoRolesAssigned = ({ email }: { email: string }): JSX.Element => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <Card className="max-w-md p-8 text-center">
      <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-500" />
      <h1 className="text-lg font-semibold text-text-primary">No roles assigned yet</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Your account (<span className="font-medium text-text-primary">{email}</span>) has signed in
        successfully, but no roles have been assigned to it yet, so there is nothing to show.
      </p>
      <p className="mt-3 text-sm text-text-secondary">
        Contact your IAMS administrator and reference the email address above so they can assign the
        correct role — for Azure AD sign-ins, this usually means mapping your security group under
        Settings &rarr; Directory.
      </p>
    </Card>
  </div>
);
