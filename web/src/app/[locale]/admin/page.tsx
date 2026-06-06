import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { blockUser, unblockUser, blockJob, expireJobs } from '@/app/actions/adminActions';
import type { Profile, Job } from '@/lib/supabase/types';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin Panel' };
}

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth`);

  const { data: rawMe } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((rawMe as any)?.role !== 'admin') redirect(`/${locale}/account`);

  // Fetch stats + data in parallel
  const [
    { data: rawUsers, count: userCount },
    { data: rawJobs, count: jobCount },
    { data: rawReviews, count: reviewCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(100),
    supabase.from('jobs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(100),
    supabase.from('reviews').select('id', { count: 'exact' }),
  ]);

  const users = (rawUsers ?? []) as Profile[];
  const jobs = (rawJobs ?? []) as Job[];

  const workerCount = users.filter((u) => u.role === 'worker').length;
  const clientCount = users.filter((u) => u.role === 'client').length;
  const blockedCount = users.filter((u) => !!u.blocked_at).length;
  const activeJobs = jobs.filter((j) => j.status === 'active').length;

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>
        {/* Hero */}
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container">
            <h1 className="font-bold text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              🛡️ Admin Panel
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Управление платформой MASTER
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 24 }}>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Всего пользователей', value: userCount ?? 0, icon: '👤' },
              { label: 'Мастеров', value: workerCount, icon: '🔧' },
              { label: 'Заказчиков', value: clientCount, icon: '🏠' },
              { label: 'Заблокировано', value: blockedCount, icon: '🚫', danger: blockedCount > 0 },
            ].map(({ label, value, icon, danger }) => (
              <div key={label} className="card p-5 text-center">
                <div style={{ fontSize: 28, marginBottom: 4 }}>{icon}</div>
                <div className="font-bold text-2xl" style={{ color: danger ? 'var(--danger)' : 'var(--text)' }}>{value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Всего заявок', value: jobCount ?? 0, icon: '📋' },
              { label: 'Активных заявок', value: activeJobs, icon: '✅' },
              { label: 'Отзывов', value: reviewCount ?? 0, icon: '⭐' },
              { label: 'Просрочено', value: jobs.filter((j) => j.status === 'active' && !!(j as any).expires_at && new Date((j as any).expires_at) < new Date()).length, icon: '⏰', danger: true },
            ].map(({ label, value, icon, danger }) => (
              <div key={label} className="card p-5 text-center">
                <div style={{ fontSize: 28, marginBottom: 4 }}>{icon}</div>
                <div className="font-bold text-2xl" style={{ color: danger && value > 0 ? 'var(--danger)' : 'var(--text)' }}>{value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="card p-4 mb-6 flex flex-wrap gap-3 items-center">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>⚡ Быстрые действия:</span>
            <form action={expireJobs}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className="btn-secondary" style={{ height: 34, fontSize: 12, padding: '0 14px' }}>
                ⏰ Закрыть просроченные заявки
              </button>
            </form>
          </div>

          {/* Users table */}
          <div className="card mb-6">
            <div className="p-5 border-b" style={{ borderColor: 'var(--glass-border)' }}>
              <h2 className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
                👤 Пользователи (последние 100)
              </h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--surface-2)' }}>
                    {['Имя', 'Телефон', 'Роль', 'Город', 'Зарегистрирован', 'Статус', 'Действие'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--glass-border)', opacity: u.blocked_at ? 0.5 : 1 }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 500 }}>
                        <Link href={u.role === 'worker' ? `/${locale}/workers/${u.id}` : '#'} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {u.name ?? '—'}
                        </Link>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{u.phone}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <RoleBadge role={u.role} />
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{u.city ?? '—'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(u.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {u.blocked_at ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,.1)', color: 'var(--danger)' }}>
                            🚫 Заблокирован
                          </span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(22,163,74,.1)', color: 'var(--success)' }}>
                            ✓ Активен
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {u.role !== 'admin' && (
                          u.blocked_at ? (
                            <form action={unblockUser}>
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="locale" value={locale} />
                              <button type="submit" className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
                                style={{ borderColor: 'var(--success)', color: 'var(--success)', background: 'transparent', cursor: 'pointer' }}>
                                Разблокировать
                              </button>
                            </form>
                          ) : (
                            <form action={blockUser}>
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="locale" value={locale} />
                              <button type="submit" className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
                                style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent', cursor: 'pointer' }}>
                                Заблокировать
                              </button>
                            </form>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Jobs table */}
          <div className="card">
            <div className="p-5 border-b" style={{ borderColor: 'var(--glass-border)' }}>
              <h2 className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
                📋 Заявки (последние 100)
              </h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--surface-2)' }}>
                    {['Описание', 'Город', 'Статус', 'Создана', 'Действие'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} style={{ borderBottom: '1px solid var(--glass-border)', opacity: j.status === 'blocked' ? 0.4 : 1 }}>
                      <td style={{ padding: '10px 12px', maxWidth: 320 }}>
                        <Link href={`/${locale}/jobs/${j.id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 13 }}>
                          {j.description.slice(0, 80)}{j.description.length > 80 ? '…' : ''}
                        </Link>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{j.city}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <JobStatusBadge status={j.status} />
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(j.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {j.status !== 'blocked' && (
                          <form action={blockJob}>
                            <input type="hidden" name="jobId" value={j.id} />
                            <input type="hidden" name="locale" value={locale} />
                            <button type="submit" className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
                              style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent', cursor: 'pointer' }}>
                              Заблокировать
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    admin:  { bg: 'rgba(139,92,246,.12)', color: '#7c3aed', label: '🛡️ Admin' },
    worker: { bg: 'rgba(14,165,233,.12)', color: 'var(--accent)', label: '🔧 Мастер' },
    client: { bg: 'rgba(22,163,74,.10)', color: 'var(--success)', label: '🏠 Клиент' },
  };
  const s = styles[role] ?? { bg: 'var(--surface-2)', color: 'var(--text-muted)', label: role };
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    active:      { bg: 'rgba(22,163,74,.1)',  color: 'var(--success)' },
    in_progress: { bg: 'rgba(14,165,233,.1)', color: 'var(--accent)' },
    done:        { bg: 'rgba(99,102,241,.1)', color: '#6366f1' },
    cancelled:   { bg: 'var(--surface-2)',    color: 'var(--text-muted)' },
    blocked:     { bg: 'rgba(239,68,68,.1)',  color: 'var(--danger)' },
  };
  const s = styles[status] ?? { bg: 'var(--surface-2)', color: 'var(--text-muted)' };
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}
