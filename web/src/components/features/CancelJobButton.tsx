'use client';

import { useRouter } from 'next/navigation';
import { workflowErrorText } from '@/lib/workflow';
import { useState } from 'react';
import { cancelJob } from '@/app/actions/cancelJob';

interface Props { jobId: string; locale: string }

export default function CancelJobButton({ jobId, locale }: Props) {
  const router=useRouter();
  const [loading, setLoading] = useState(false);
  const t = (ru: string, ro: string) => locale === 'ru' ? ru : ro;

  async function handle() {
    if (!confirm(t(
      'Отменить заявку? Это действие нельзя отменить.',
      'Anulați cererea? Această acțiune nu poate fi anulată.'
    ))) return;
    setLoading(true);
    try {
      const result=await cancelJob(jobId,locale);
      if (!result.ok) { alert(workflowErrorText(result.error,locale)); return; }
      router.refresh();
    } catch {
      alert(t('Ошибка. Попробуйте снова.', 'Eroare. Încercați din nou.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      style={{
        height: 34, padding: '0 12px', fontSize: 12,
        background: 'none', border: '1.5px solid var(--danger-border)',
        borderRadius: 'var(--radius-sm)', color: 'var(--danger)',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontWeight: 600, opacity: loading ? 0.6 : 1,
        transition: 'background 150ms',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--danger-bg)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
    >
      {loading ? '...' : t('Отменить', 'Anulează')}
    </button>
  );
}
