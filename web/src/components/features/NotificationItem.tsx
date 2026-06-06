'use client';

import { useTranslations } from 'next-intl';
import type { Notification } from '@/lib/supabase/types';

interface Props {
  notif: Notification;
  isPending: boolean;
  onClick: (notif: Notification) => void;
}

function formatRelativeTime(
  dateStr: string,
  t: ReturnType<typeof useTranslations<'notifications'>>,
): string {
  const diffSeconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );

  if (diffSeconds < 60) return t('justNow');
  if (diffSeconds < 3600)
    return t('minutesAgo', { count: Math.floor(diffSeconds / 60) });
  if (diffSeconds < 86400)
    return t('hoursAgo', { count: Math.floor(diffSeconds / 3600) });
  return t('daysAgo', { count: Math.floor(diffSeconds / 86400) });
}

export default function NotificationItem({
  notif,
  isPending,
  onClick,
}: Props) {
  const t = useTranslations('notifications');

  return (
    <button
      type="button"
      onClick={() => onClick(notif)}
      disabled={isPending}
      className={[
        'w-full text-left px-4 py-3 flex gap-3 items-start transition-colors',
        'hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-orange-400 focus-visible:ring-inset',
        notif.read ? 'opacity-60' : '',
        isPending ? 'cursor-wait' : 'cursor-pointer',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Unread indicator dot */}
      <span
        className={[
          'mt-1.5 shrink-0 w-2 h-2 rounded-full',
          notif.read ? 'bg-transparent' : 'bg-orange-500',
        ].join(' ')}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800 leading-snug">
          {notif.title}
        </p>
        {notif.body ? (
          <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
            {notif.body}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-slate-400">
          {formatRelativeTime(notif.created_at, t)}
        </p>
      </div>

      {/* External link arrow */}
      {notif.link ? (
        <span className="mt-1 shrink-0 text-slate-300" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      ) : null}
    </button>
  );
}