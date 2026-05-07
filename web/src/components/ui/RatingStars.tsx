interface RatingStarsProps {
  value: number; // 0-5
  count?: number;
  size?: number;
}

export default function RatingStars({ value, count, size = 16 }: RatingStarsProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg key={star} width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1l1.85 3.75 4.15.6-3 2.92.7 4.1L8 10.35 4.3 12.37l.7-4.1L2 5.35l4.15-.6L8 1z"
              fill={star <= Math.round(value) ? 'var(--warning)' : 'var(--glass-border-strong)'}
            />
          </svg>
        ))}
      </span>
      {count !== undefined && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          ({count})
        </span>
      )}
    </span>
  );
}
