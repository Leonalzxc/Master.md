'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton({ locale }: { locale: string }) {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}`);
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="btn-secondary"
      style={{ height: 36, padding: '0 16px', fontSize: 14 }}
    >
      {locale === 'ru' ? 'Выйти' : 'Deconectare'}
    </button>
  );
}
