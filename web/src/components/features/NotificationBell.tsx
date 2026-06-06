'use client';

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { markRead, markAllRead } from '@/app/actions/notifications';
import type { Notification } from '@/app/actions/notifications';

interface Props {
  userId: string;
  initialNotifications: Notification[];
}

export default function NotificationBell({ userId, initialNotifications }: Props) {
  const t = useTranslations('notifications');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Real-time subscription ────────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`notifications:user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // ── Close on outside click ────────────────────────────────
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // ── Handlers ──────────────────────────────────────────────
  const handleNotificationClick = useCallback(
    (notif: Notification) => {
      startTransition(async () => {
        if (!notif.read) {
          await markRead(notif.id);
          setNotifications((prev) =>
            prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
          );
        }
        setOpen(false);
        if (notif.link) router.push(notif.link);
      });
    },
    [router]
  );

  const handleMarkAllRead = useCallback(() => {
    startTransition(async () => {
      await markAllRead(userId);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    });
  }, [userId]);

  // ── Time formatter ────────────────────────────────────────
  function timeAgo(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return t('justNow');
    if (diffMin < 60) return t('minutesAgo', { count: diffMin });
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return t('hoursAgo', { count: diffH });
    return t('daysAgo', { count: Math.floor(diffH / 24) });
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('ariaLabel')}
        aria-expanded={open}
        className="relative p-2 rounded-full hover:bg-neutral-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-6 h-6 text-neutral-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="dialog"
          aria-label={t('title')}
          className="absolute right-0 mt-2 w-80 max-h-[440px] flex flex-col bg-white rounded-2xl shadow-xl border border-neutral-100 z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 flex-shrink-0">
            <span className="font-semibold text-sm text-neutral-800">
              {t('title')}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isPending}
                className="text-xs text-amber-600 hover:text-amber-700 font-medium disabled:opacity-50 transition-colors"
              >
                {t('markAllRead')}
              </button>
            )}
          </div>

          {/* List */}
          <ul className="overflow-y-auto flex-1 divide-y divide-neutral-50" role="list">
            {notifications.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-neutral-400">
                {t('empty')}
              </li>
            ) : (
              notifications.map((notif) => (
                <li key={notif.id} role="listitem">
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(notif)}
                    disabled={isPending}
                    className={[
                      'w-full text-left px-4 py-3 flex gap-3 hover:bg-neutral-50 transition-colors disabled:opacity-60',
                      !notif.read ? 'bg-amber-50/70' : '',
                    ].join(' ')}
                  >
                    {/* Unread dot */}
                    <span
                      aria-hidden="true"
                      className={[
                        'mt-[7px] flex-shrink-0 w-2 h-2 rounded-full',
                        notif.read ? 'bg-transparent' : 'bg-amber-500',
                      ].join(' ')}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-800 truncate">
                        {notif.title}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                        {notif.body}
                      </p>
                      <p className="text-[11px] text-neutral-400 mt-1">
                        {timeAgo(notif.created_at)}
                      </p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}