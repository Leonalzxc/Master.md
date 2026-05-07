import { cn } from '@/lib/utils/cn';

type BadgeVariant = 'category' | 'pro' | 'verified' | 'urgent' | 'active' | 'done' | 'blocked' | 'muted';

const styles: Record<BadgeVariant, string> = {
  category:  'bg-[rgba(14,165,233,.12)] text-[var(--accent)]',
  pro:       'bg-[#fef3c7] text-[#92400e]',
  verified:  'bg-[rgba(22,163,74,.1)] text-[var(--success)]',
  urgent:    'bg-[rgba(217,119,6,.12)] text-[var(--warning)]',
  active:    'bg-[rgba(22,163,74,.1)] text-[var(--success)]',
  done:      'bg-[rgba(100,116,139,.1)] text-[var(--text-muted)]',
  blocked:   'bg-[var(--danger-bg)] text-[var(--danger)]',
  muted:     'bg-[var(--surface-subtle)] text-[var(--text-muted)]',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export default function Badge({ variant = 'muted', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
