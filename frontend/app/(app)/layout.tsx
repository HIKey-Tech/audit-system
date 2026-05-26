import { redirect } from 'next/navigation';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { LayoutProvider } from '@/components/providers/LayoutProvider';
import { AppLayoutContainer } from '@/components/layout/AppLayoutContainer';
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

  return (
    <AuthProvider user={user}>
      <LayoutProvider>
        <AppLayoutContainer>{children}</AppLayoutContainer>
      </LayoutProvider>
    </AuthProvider>
  );
}
