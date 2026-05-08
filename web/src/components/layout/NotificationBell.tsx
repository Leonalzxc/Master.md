'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Notification {
  id: string;
  type: 'new_bid' | 'bid_accepted' | 'job_completed';
  title: string;
  body: string;
  payload: Record<string, string>;
  read: boolean;
  created_at: string;
}

function timeAgo(iso: string, locale: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return locale === 'ru' ? 'только что' : 'acum';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return locale === 'ru' ? `${m} мин назад` : `acum ${m} min`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return locale === 'ru' ? `${h} ч назад` : `acum ${h} ore`;
  }
  const d = Math.floor(diff / 86400);
  return locale === 'ru' ? `${d} дн назад` : `acum ${d} zile`;
}

const TYPE_ICON: Record<string, string> = {
  new_bid:       '💬',
  bid_accepted:  '✅',
  job_completed: '⭐',
};

export default function NotificationBell() {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;

  // Load user + notifications
  useEffect(() => {
    const supabase = createClient();

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('notifications') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (data) setItems(data as Notification[]);

      // Realtime: new notifications pushed by DB triggers
      const channel = supabase
        .channel(`notifs:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setItems((prev) => [payload.new as Notification, ...prev]);
          },
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }

    init();
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId || unread === 0) return;
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('notifications') as any)
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [userId, unread]);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) markAllRead();
  };

  const notifLink = (n: Notification) => {
    if (n.payload.job_id) return `/${locale}/jobs/${n.payload.job_id}`;
    return `/${locale}/account`;
  };

  if (!userId) return null;

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        aria-label="Уведомления"
        style={{
          position: 'relative',
          width: 38, height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 'var(--radius-sm)',
          background: open ? 'var(--accent-dim)' : 'transparent',
          border: '1.5px solid ' + (open ? 'var(--accent)' : 'var(--glass-border-strong)'),
          cursor: 'pointer',
          transition: 'background 150ms, border-color 150ms',
          color: 'var(--text)',
          fontSize: 17,
        }}
      >
        🔔
        {unread > 0 && (
          <span
            style={{
              position: 'absolute', top: -5, right: -5,
              minWidth: 18, height: 18,
              background: 'var(--danger)',
              color: '#fff',
              borderRadius: 100,
              fontSize: 11,
              fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid var(--bg-elevated)',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 320,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--glass-border)',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
              {locale === 'ru' ? 'Уведомления' : 'Notificări'}
            </span>
            {items.length > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  fontSize: 12, color: 'var(--accent)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {locale === 'ru' ? 'Прочитать все' : 'Marchează toate'}
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {locale === 'ru' ? 'Нет уведомлений' : 'Nicio notificare'}
              </div>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={notifLink(n)}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--glass-border)',
                    background: n.read ? 'transparent' : 'var(--accent-dim)',
                    textDecoration: 'none',
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = n.read ? 'transparent' : 'var(--accent-dim)'; }}
                >
                  <span style={{ fontSize: 20, lineHeight: 1.4 }}>{TYPE_ICON[n.type]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {n.body}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {timeAgo(n.created_at, locale)}
                    </div>
                  </div>
                  {!n.read && (
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: 'var(--accent)', flexShrink: 0, marginTop: 6,
                    }} />
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
