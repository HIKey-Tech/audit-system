import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ACCESS_COOKIE } from '@/lib/utils/auth-cookies';

export default function RootPage(): null {
  const hasAuth = Boolean(cookies().get(ACCESS_COOKIE)?.value);
  redirect(hasAuth ? '/dashboard' : '/login');
}
