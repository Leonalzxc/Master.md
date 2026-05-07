import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import RatingStars from '@/components/ui/RatingStars';
import { type Worker, CATEGORY_LABELS_RU, CATEGORY_ICONS } from '@/lib/mock/data';

interface WorkerCardProps {
  worker: Worker;
  locale: string;
}

export default function WorkerCard({ worker, locale }: WorkerCardProps) {
  const initials = worker.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="card p-5 flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="shrink-0 flex items-center justify-center rounded-full font-bold text-lg text-white"
          style={{
            width: 52,
            height: 52,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
            fontSize: 18,
          }}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              {worker.name}
            </span>
            {worker.isPro && <Badge variant="pro">PRO</Badge>}
            {worker.verified && <Badge variant="verified">✓ Проверен</Badge>}
          </div>
          <RatingStars value={worker.ratingAvg} count={worker.ratingCount} size={14} />
        </div>
      </div>

      {/* Bio */}
      <p
        className="text-sm line-clamp-2"
        style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}
      >
        {worker.bio}
      </p>

      {/* Categories */}
      <div className="flex flex-wrap gap-1.5">
        {worker.categories.map((cat) => (
          <Badge key={cat} variant="category">
            {CATEGORY_ICONS[cat]} {CATEGORY_LABELS_RU[cat]}
          </Badge>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--glass-border)' }}>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>📍 {worker.city}</span>
          {worker.completedJobs > 0 && (
            <span className="ml-3">✅ {worker.completedJobs} заказов</span>
          )}
        </div>
        <Link
          href={`/${locale}/workers/${worker.id}`}
          className="btn-secondary"
          style={{ height: 34, padding: '0 14px', fontSize: 13 }}
        >
          Профиль
        </Link>
      </div>
    </div>
  );
}
