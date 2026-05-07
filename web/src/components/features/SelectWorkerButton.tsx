'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { selectWorker } from '@/app/actions/selectWorker';

interface Props {
  jobId: string;
  bidId: string;
  workerId: string;
  workerName: string;
  locale: string;
}

export default function SelectWorkerButton({ jobId, bidId, workerId, workerName, locale }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handle() {
    if (!confirm(locale === 'ru'
      ? `Выбрать ${workerName} для этой заявки? Остальные отклики будут отклонены.`
      : `Selectați ${workerName} pentru această cerere? Celelalte oferte vor fi respinse.`
    )) return;

    setLoading(true);
    try {
      await selectWorker(jobId, bidId, workerId, locale);
      setDone(true);
      router.refresh();
    } catch {
      alert(locale === 'ru' ? 'Ошибка. Попробуйте снова.' : 'Eroare. Încercați din nou.');
    } finally {
      setLoading(false);
    }
  }

  if (done) return (
    <span className="text-sm font-semibold" style={{ color: 'var(--success)' }}>✓ Выбран</span>
  );

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="btn-primary"
      style={{ height: 34, padding: '0 16px', fontSize: 13 }}
    >
      {loading ? '...' : (locale === 'ru' ? 'Выбрать мастера' : 'Selectează meșterul')}
    </button>
  );
}
