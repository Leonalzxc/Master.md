import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Поддержка — MASTER Moldova' : 'Suport — MASTER Moldova' };
}

export default async function SupportPage({ params }: Props) {
  const { locale } = await params;
  const ru = locale === 'ru';

  const faqs = ru ? [
    {
      q: 'Как зарегистрироваться как мастер?',
      a: 'Создайте аккаунт, затем на странице аккаунта выберите роль «Мастер» и заполните профиль. После этого вы сможете откликаться на заявки.',
    },
    {
      q: 'Не получаю SMS-код при входе',
      a: 'Проверьте правильность номера. Попробуйте снова через 60 секунд. Если код не приходит — используйте вход через e-mail или напишите нам.',
    },
    {
      q: 'Как подключить Telegram-уведомления?',
      a: 'Перейдите в «Настройки профиля» → раздел «Уведомления» → нажмите «Подключить Telegram». Вы перейдёте к боту — нажмите Start.',
    },
    {
      q: 'Как пройти верификацию?',
      a: 'В дашборде мастера нажмите «Пройти верификацию» и загрузите документ, подтверждающий личность. Проверка занимает 1–2 рабочих дня.',
    },
    {
      q: 'Заявка не публикуется',
      a: 'Убедитесь, что заполнены все обязательные поля: категория, описание и город. Если проблема сохраняется — напишите в поддержку.',
    },
    {
      q: 'Как удалить аккаунт?',
      a: 'Напишите на privacy@master.md с просьбой об удалении. Данные удаляются в течение 7 рабочих дней.',
    },
  ] : [
    {
      q: 'Cum să mă înregistrez ca meșter?',
      a: 'Creați un cont, apoi pe pagina contului alegeți rolul «Meșter» și completați profilul. Ulterior puteți depune oferte pe cereri.',
    },
    {
      q: 'Nu primesc codul SMS la autentificare',
      a: 'Verificați corectitudinea numărului. Încercați din nou după 60 de secunde. Dacă codul nu vine — folosiți autentificarea prin e-mail sau scrieți-ne.',
    },
    {
      q: 'Cum să conectez notificările Telegram?',
      a: 'Accesați «Setări profil» → secțiunea «Notificări» → apăsați «Conectați Telegram». Veți fi redirecționat la bot — apăsați Start.',
    },
    {
      q: 'Cum trec prin verificare?',
      a: 'În panoul meșterului apăsați «Treceți prin verificare» și încărcați un document de identitate. Verificarea durează 1-2 zile lucrătoare.',
    },
    {
      q: 'Cererea nu se publică',
      a: 'Asigurați-vă că sunt completate toate câmpurile obligatorii: categorie, descriere și oraș. Dacă problema persistă — scrieți la suport.',
    },
    {
      q: 'Cum să șterg contul?',
      a: 'Scrieți la privacy@master.md cu solicitarea de ștergere. Datele sunt șterse în 7 zile lucrătoare.',
    },
  ];

  const channels = ru ? [
    { icon: '📧', title: 'E-mail', value: 'support@master.md', href: 'mailto:support@master.md', desc: 'Ответ в течение 24 часов' },
    { icon: '💬', title: 'Telegram', value: '@mastermd_support', href: 'https://t.me/mastermd_support', desc: 'Быстрее всего' },
  ] : [
    { icon: '📧', title: 'E-mail', value: 'support@master.md', href: 'mailto:support@master.md', desc: 'Răspuns în 24 de ore' },
    { icon: '💬', title: 'Telegram', value: '@mastermd_support', href: 'https://t.me/mastermd_support', desc: 'Cel mai rapid' },
  ];

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>

        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container">
            <h1 className="font-bold text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {ru ? 'Поддержка' : 'Suport'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {ru ? 'Мы помогаем с 9:00 до 20:00 по Кишинёву' : 'Vă ajutăm de la 9:00 la 20:00 ora Chișinăului'}
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 32, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Contact channels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {channels.map((c) => (
              <a
                key={c.title}
                href={c.href}
                className="card p-5 flex items-center gap-4 hover-lift"
                style={{ textDecoration: 'none' }}
              >
                <span style={{ fontSize: 32, flexShrink: 0 }}>{c.icon}</span>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{c.title}</p>
                  <p className="text-sm" style={{ color: 'var(--accent)' }}>{c.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.desc}</p>
                </div>
              </a>
            ))}
          </div>

          {/* FAQ */}
          <div>
            <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {ru ? 'Частые вопросы' : 'Întrebări frecvente'}
            </h2>
            <div className="flex flex-col gap-3">
              {faqs.map((f) => (
                <details
                  key={f.q}
                  className="card p-5"
                  style={{ cursor: 'pointer' }}
                >
                  <summary className="font-semibold text-sm list-none flex items-center justify-between" style={{ color: 'var(--text)' }}>
                    {f.q}
                    <span style={{ color: 'var(--text-muted)', fontSize: 18, flexShrink: 0, marginLeft: 8 }}>+</span>
                  </summary>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.65, marginTop: 10 }}>
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </div>

          {/* Links to other docs */}
          <div className="card p-5">
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
              {ru ? 'Полезные ссылки' : 'Linkuri utile'}
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                { href: `/${locale}/legal/terms`, label: ru ? 'Условия использования' : 'Termeni de utilizare' },
                { href: `/${locale}/legal/privacy`, label: ru ? 'Конфиденциальность' : 'Confidențialitate' },
                { href: `/${locale}/legal/moderation`, label: ru ? 'Правила модерации' : 'Moderare' },
                { href: `/${locale}/pricing`, label: ru ? 'Цены на кредиты' : 'Prețuri credite' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm px-3 py-1.5 rounded-full"
                  style={{ background: 'var(--bg-deep)', color: 'var(--accent)', textDecoration: 'none', border: '1px solid var(--glass-border)' }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
