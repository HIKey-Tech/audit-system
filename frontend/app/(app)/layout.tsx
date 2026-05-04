import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { readSessionUserFromCookies } from '@/lib/session';

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
      <div className="flex min-h-screen bg-surface">
        <Sidebar />
        <div className="flex w-full flex-col lg:pl-60">
          <Header />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
