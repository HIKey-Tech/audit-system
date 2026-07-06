import { redirect } from 'next/navigation';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { LayoutProvider } from '@/components/providers/LayoutProvider';
import { AppLayoutContainer } from '@/components/layout/AppLayoutContainer';
import { NoRolesAssigned } from '@/components/no-roles-assigned';
import { readSessionUserFromCookies } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const user = readSessionUserFromCookies();
  if (!user) {
    redirect('/login');
  }

  // A successfully authenticated user with zero permissions (e.g. first SSO
  // login before their Azure AD group is mapped to a role) would otherwise see
  // every page on this shell silently render its emptied-out gated state —
  // show one clear explanation instead of a confusing blank app.
  const hasNoRoles = user.permissions.length === 0;

  return (
    <AuthProvider user={user}>
      <LayoutProvider>
        <AppLayoutContainer>
          {hasNoRoles ? <NoRolesAssigned email={user.email} /> : children}
        </AppLayoutContainer>
      </LayoutProvider>
    </AuthProvider>
  );
}
