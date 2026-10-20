import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { SUPPORT_TELEGRAM } from '@/lib/pilot-copy';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Правила модерации' : 'Reguli de moderare' };
}

export default async function ModerationPage({ params }: Props) {
  const { locale } = await params;
  const ru = locale === 'ru';

  const rules = ru ? [
    { icon: '✅', title: 'Достоверность информации', text: 'Указывайте реальные данные: имя, город, специализацию. Фото должно соответствовать действительности.' },
    { icon: '🚫', title: 'Запрещённый контент', text: 'Запрещены: спам, реклама сторонних платформ, контактные данные в описаниях заявок, оскорбления, дискриминация.' },
    { icon: '💬', title: 'Уважительное общение', text: 'Общайтесь уважительно. Оскорбления, угрозы и преследование могут привести к блокировке после проверки.' },
    { icon: '⭐', title: 'Честные отзывы', text: 'Отзывы оставляют только реальные участники сделки. Накрутка, заказные и ложные отзывы запрещены.' },
    { icon: '🔒', title: 'Конфиденциальность', text: 'Не публикуйте персональные данные других пользователей без их согласия.' },
    { icon: '⚖️', title: 'Нарушение законодательства', text: 'Запрещены предложения незаконных услуг, работа без лицензии там, где она обязательна, и любые другие действия, нарушающие законодательство Молдовы.' },
  ] : [
    { icon: '✅', title: 'Acuratețea informațiilor', text: 'Furnizați date reale: nume, oraș, specializare. Fotografia trebuie să corespundă realității.' },
    { icon: '🚫', title: 'Conținut interzis', text: 'Sunt interzise: spam-ul, publicitatea platformelor terțe, datele de contact în descrierile cererilor, insultele, discriminarea.' },
    { icon: '💬', title: 'Comunicare respectuoasă', text: 'Comunicați cu respect. Insultele, amenințările și hărțuirea pot duce la blocare după examinare.' },
    { icon: '⭐', title: 'Recenzii corecte', text: 'Recenziile pot fi lăsate doar de participanții reali ai tranzacției. Recenziile false, cumpărate sau fabricate sunt interzise.' },
    { icon: '🔒', title: 'Confidențialitate', text: 'Nu publicați datele personale ale altor utilizatori fără consimțământul acestora.' },
    { icon: '⚖️', title: 'Respectarea legii', text: 'Sunt interzise ofertele de servicii ilegale, activitățile fără licență acolo unde aceasta este obligatorie și orice alte acțiuni care încalcă legislația Republicii Moldova.' },
  ];

  const consequences = ru ? [
    { level: '⚠️ Предупреждение', desc: 'Первичное нарушение без ущерба для других пользователей' },
    { level: '⏸️ Временная блокировка', desc: 'Повторные нарушения или умеренный ущерб' },
    { level: '🚫 Постоянная блокировка', desc: 'Грубые нарушения, мошенничество, угрозы' },
  ] : [
    { level: '⚠️ Avertisment', desc: 'Încălcare primară fără prejudicii pentru alți utilizatori' },
    { level: '⏸️ Blocare temporară', desc: 'Încălcări repetate sau prejudicii moderate' },
    { level: '🚫 Blocare permanentă', desc: 'Încălcări grave, fraudă, amenințări' },
  ];

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container">
            <div className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
              <Link href={`/${locale}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                {ru ? 'Главная' : 'Acasă'}
              </Link>
              <span>→</span>
              <span>{ru ? 'Правовые документы' : 'Documente legale'}</span>
            </div>
            <h1 className="font-bold text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {ru ? 'Правила модерации' : 'Reguli de moderare'}
            </h1>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 32, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div className="card p-6 flex flex-col gap-5">
            <h2 className="font-semibold text-lg" style={{ color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {ru ? 'Основные правила' : 'Reguli de bază'}
            </h2>
            {rules.map((r) => (
              <div key={r.title} className="flex items-start gap-3">
                <span style={{ fontSize: 20, lineHeight: 1.4, flexShrink: 0 }}>{r.icon}</span>
                <div>
                  <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>{r.title}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.65 }}>{r.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {ru ? 'Последствия нарушений' : 'Consecințele încălcărilor'}
            </h2>
            <div className="flex flex-col gap-3">
              {consequences.map((c) => (
                <div key={c.level} className="flex flex-col sm:flex-row items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-deep)' }}>
                  <span className="font-semibold text-sm" style={{ color: 'var(--text)', minWidth: 180 }}>{c.level}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{c.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-base mb-3" style={{ color: 'var(--text)' }}>
              {ru ? 'Как сообщить о нарушении' : 'Cum să raportați o încălcare'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.7 }}>
              {ru
                ? 'Напишите @kentukaa с описанием нарушения и ссылкой на профиль или заявку. Жалобы рассматриваются вручную; точный срок ответа пока не установлен.'
                : 'Scrieți la @kentukaa cu descrierea încălcării și linkul profilului sau cererii. Reclamațiile sunt examinate manual; un termen exact nu este încă stabilit.'}
            </p>
            <a
              href={SUPPORT_TELEGRAM.href}
              className="inline-flex items-center gap-2 mt-3 text-sm font-semibold"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
            >
              💬 {SUPPORT_TELEGRAM.label}
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
