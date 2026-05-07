import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import { type Job, CATEGORY_LABELS_RU, CATEGORY_ICONS } from '@/lib/mock/data';

interface JobCardProps {
  job: Job;
  locale: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'только что';
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} д назад`;
}

export default function JobCard({ job, locale }: JobCardProps) {
  const icon = CATEGORY_ICONS[job.category];
  const label = CATEGORY_LABELS_RU[job.category];

  return (
    <div
      className="card p-5 flex flex-col gap-3 hover-lift"
      style={{ transition: 'box-shadow 150ms, transform 150ms' }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="category">{icon} {label}</Badge>
          {job.urgent && <Badge variant="urgent">⚡ Срочно</Badge>}
          {job.needsQuote && <Badge variant="muted">📋 Нужна смета</Badge>}
        </div>
        <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
          {timeAgo(job.createdAt)}
        </span>
      </div>

      {/* Description */}
      <p
        className="text-sm line-clamp-2"
        style={{ color: 'var(--text)', lineHeight: 1.6 }}
      >
        {job.description}
      </p>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>📍 {job.city}, {job.area}</span>
        {(job.budgetMin || job.budgetMax) && (
          <span>
            💰{' '}
            {job.budgetMin && job.budgetMax
              ? `${job.budgetMin}–${job.budgetMax} MDL`
              : job.budgetMin
              ? `от ${job.budgetMin} MDL`
              : `до ${job.budgetMax} MDL`}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--glass-border)' }}>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {job.bidsCount > 0
            ? `${job.bidsCount} ${job.bidsCount === 1 ? 'отклик' : job.bidsCount < 5 ? 'отклика' : 'откликов'}`
            : 'Нет откликов'}
        </span>
        <Link
          href={`/${locale}/jobs/${job.id}`}
          className="btn-primary"
          style={{ height: 34, padding: '0 16px', fontSize: 13 }}
        >
          Откликнуться →
        </Link>
      </div>
    </div>
  );
}
