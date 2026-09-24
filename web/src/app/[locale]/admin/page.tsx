import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { blockUser, unblockUser, blockJob, expireJobs, approveVerification, rejectVerification, addCredits } from '@/app/actions/adminActions';
import type { Profile, Job, ProfileWorker } from '@/lib/supabase/types';

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

  const admin = createAdminClient();

  // Fetch stats + data in parallel using admin client to bypass RLS
  const [
    { data: rawUsers, count: userCount },
    { data: rawJobs, count: jobCount },
    { count: reviewCount },
    { data: rawPendingVerifications },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(100),
    admin.from('jobs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(100),
    admin.from('reviews').select('id', { count: 'exact', head: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from('profiles_worker') as any)
      .select('id, verification_submitted_at, categories, bio')
      .not('verification_submitted_at', 'is', null)
      .eq('verified', false)
      .order('verification_submitted_at', { ascending: true }),
  ]);

  const users = (rawUsers ?? []) as Profile[];
  const jobs = (rawJobs ?? []) as Job[];

  // Fetch bid_credits for all workers
  const workerIds = users.filter((u) => u.role === 'worker').map((u) => u.id);
  const { data: rawWorkerCredits } = workerIds.length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (admin.from('profiles_worker') as any).select('id, bid_credits').in('id', workerIds)
    : { data: [] };
  const creditsMap = new Map(
    ((rawWorkerCredits ?? []) as { id: string; bid_credits: number }[]).map((pw) => [pw.id, pw.bid_credits])
  );

  type PendingWorker = Pick<ProfileWorker, 'id' | 'verification_submitted_at' | 'categories' | 'bio'> & { name?: string };
  const pendingVerifications = (rawPendingVerifications ?? []) as PendingWorker[];

  // Enrich with profile name
  const pendingIds = pendingVerifications.map((pw) => pw.id);
  const rawPendingProfiles: Pick<Profile, 'id' | 'name' | 'city'>[] = pendingIds.length > 0
    ? ((await admin.from('profiles').select('id, name, city').in('id', pendingIds)).data ?? []) as Pick<Profile, 'id' | 'name' | 'city'>[]
    : [];
  const profileMap = new Map(rawPendingProfiles.map((p) => [p.id, p]));

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
              { label: 'На верификации', value: pendingVerifications.length, icon: '🔍', highlight: pendingVerifications.length > 0 },
            ].map(({ label, value, icon, highlight }) => (
              <div key={label} className="card p-5 text-center" style={highlight ? { border: '1px solid rgba(234,179,8,.3)' } : undefined}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>{icon}</div>
                <div className="font-bold text-2xl" style={{ color: highlight ? '#ca8a04' : 'var(--text)' }}>{value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>

          <form action={expireJobs} className="card p-4 mb-6">
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="btn-secondary">
              {locale === 'ro' ? 'Închide cererile expirate' : 'Закрыть просроченные заявки'}
            </button>
          </form>

          {/* Pending verifications */}
          {pendingVerifications.length > 0 && (
            <div className="card mb-6" style={{ border: '1px solid rgba(234,179,8,.3)' }}>
              <div className="p-5 border-b" style={{ borderColor: 'var(--glass-border)', background: 'rgba(234,179,8,.05)' }}>
                <h2 className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
                  ✅ Запросы верификации ({pendingVerifications.length})
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Мастера, ожидающие верификации
                </p>
              </div>
              <div className="flex flex-col divide-y" style={{ borderColor: 'var(--glass-border)' }}>
                {pendingVerifications.map((pw) => {
                  const profile = profileMap.get(pw.id);
                  const submittedAt = pw.verification_submitted_at
                    ? new Date(pw.verification_submitted_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—';
                  return (
                    <div key={pw.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <Link
                          href={`/${locale}/workers/${pw.id}`}
                          className="font-semibold text-sm"
                          style={{ color: 'var(--accent)', textDecoration: 'none' }}
                        >
                          {profile?.name ?? '—'}
                        </Link>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {profile?.city ?? '—'} · Подано: {submittedAt}
                        </p>
                        {pw.bio && (
                          <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                            {pw.bio}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <form action={approveVerification}>
                          <input type="hidden" name="workerId" value={pw.id} />
                          <input type="hidden" name="locale" value={locale} />
                          <button type="submit" className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
                            style={{ borderColor: 'var(--success)', color: 'var(--success)', background: 'transparent', cursor: 'pointer' }}>
                            ✓ Одобрить
                          </button>
                        </form>
                        <form action={rejectVerification}>
                          <input type="hidden" name="workerId" value={pw.id} />
                          <input type="hidden" name="locale" value={locale} />
                          <button type="submit" className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
                            style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent', cursor: 'pointer' }}>
                            ✗ Отклонить
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                    {['Имя', 'Телефон', 'Роль', 'Город', 'Кредиты', 'Зарегистрирован', 'Статус', 'Действие'].map((h) => (
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
                      <td style={{ padding: '10px 12px' }}>
                        {u.role === 'worker' ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: (creditsMap.get(u.id) ?? 0) > 0 ? 'rgba(14,165,233,.12)' : 'rgba(239,68,68,.1)',
                                color: (creditsMap.get(u.id) ?? 0) > 0 ? 'var(--accent)' : 'var(--danger)',
                              }}
                            >
                              {creditsMap.get(u.id) ?? 0}
                            </span>
                            <form action={addCredits} className="flex items-center gap-1">
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="amount" value="10" />
                              <input type="hidden" name="locale" value={locale} />
                              <button type="submit" className="text-xs font-semibold px-2 py-0.5 rounded-lg border transition-all"
                                style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'transparent', cursor: 'pointer' }}>
                                +10
                              </button>
                            </form>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
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
