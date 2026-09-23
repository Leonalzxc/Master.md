import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Условия использования' : 'Termeni de utilizare' };
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  const ru = locale === 'ru';

  const sections = ru ? [
    {
      title: '1. Общие положения',
      text: `MASTER Moldova («Платформа») — онлайн-биржа, связывающая заказчиков с мастерами по ремонту, строительству и отделке на территории Республики Молдова. Используя Платформу, вы принимаете настоящие Условия в полном объёме.`,
    },
    {
      title: '2. Регистрация и аккаунт',
      text: `При регистрации вы обязуетесь предоставлять достоверные данные. Вы несёте ответственность за сохранность учётных данных и все действия, совершённые через ваш аккаунт. Запрещается передавать доступ к аккаунту третьим лицам.`,
    },
    {
      title: '3. Заявки и отклики',
      text: `Заказчик публикует заявку бесплатно. Мастер откликается на заявку, расходуя кредиты (1 кредит = 1 отклик). Платформа не является стороной договора между заказчиком и мастером и не несёт ответственности за качество и сроки выполнения работ.`,
    },
    {
      title: '4. Кредиты',
      text: `Кредиты для откликов приобретаются мастерами. Кредиты не возвращаются, если отклик был отправлен. Платформа вправе бесплатно начислять кредиты в рамках акций и программ лояльности.`,
    },
    {
      title: '5. Запрещённый контент',
      text: `Запрещается публиковать заявки или профили с: недостоверной информацией, оскорбительным или дискриминационным содержанием, контактными данными в описаниях (кроме предусмотренных полей), ссылками на внешние ресурсы с целью обхода Платформы.`,
    },
    {
      title: '6. Верификация',
      text: `Мастера могут подать заявку на верификацию. Платформа проверяет предоставленные документы и ставит отметку «✓ Проверен». Верификация подтверждает личность, но не гарантирует качество работ.`,
    },
    {
      title: '7. Ответственность',
      text: `Платформа предоставляется «как есть». Мы не гарантируем бесперебойную работу сервиса и не несём ответственности за ущерб, возникший в результате: технических сбоев, споров между заказчиком и мастером, неисполнения работ, а также действий третьих лиц.`,
    },
    {
      title: '8. Изменения условий',
      text: `Платформа вправе изменять Условия в любое время. О существенных изменениях пользователи уведомляются через Telegram или электронную почту. Продолжение использования Платформы означает согласие с новыми Условиями.`,
    },
  ] : [
    {
      title: '1. Dispoziții generale',
      text: `MASTER Moldova («Platforma») este o piață online care conectează clienții cu meșterii pentru reparații, construcții și finisaje pe teritoriul Republicii Moldova. Utilizând Platforma, acceptați integral acești Termeni.`,
    },
    {
      title: '2. Înregistrare și cont',
      text: `La înregistrare, vă obligați să furnizați date corecte. Sunteți responsabil pentru securitatea datelor de autentificare și pentru toate acțiunile efectuate prin contul dvs. Este interzisă transmiterea accesului la cont unor terțe persoane.`,
    },
    {
      title: '3. Cereri și oferte',
      text: `Clientul publică cereri gratuit. Meșterul depune oferte consumând credite (1 credit = 1 ofertă). Platforma nu este parte a contractului dintre client și meșter și nu răspunde pentru calitatea sau termenele de executare a lucrărilor.`,
    },
    {
      title: '4. Credite',
      text: `Creditele pentru oferte sunt achiziționate de meșteri. Creditele nu se restituie dacă oferta a fost trimisă. Platforma poate acorda credite gratuit în cadrul promoțiilor și programelor de fidelizare.`,
    },
    {
      title: '5. Conținut interzis',
      text: `Este interzisă publicarea de cereri sau profiluri care conțin: informații false, conținut ofensator sau discriminatoriu, date de contact în descrieri (în afara câmpurilor prevăzute), linkuri externe cu scopul ocolirii Platformei.`,
    },
    {
      title: '6. Verificare',
      text: `Meșterii pot solicita verificarea identității. Platforma examinează documentele furnizate și aplică insigna «✓ Verificat». Verificarea confirmă identitatea, dar nu garantează calitatea lucrărilor.`,
    },
    {
      title: '7. Răspundere',
      text: `Platforma este furnizată «ca atare». Nu garantăm funcționarea neîntreruptă a serviciului și nu răspundem pentru prejudicii cauzate de: defecțiuni tehnice, litigii dintre client și meșter, neexecutarea lucrărilor sau acțiunile terților.`,
    },
    {
      title: '8. Modificarea termenilor',
      text: `Platforma poate modifica Termenii în orice moment. Despre modificările esențiale utilizatorii sunt notificați prin Telegram sau e-mail. Continuarea utilizării Platformei înseamnă acceptarea noilor Termeni.`,
    },
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
              {ru ? 'Условия использования' : 'Termeni de utilizare'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {ru ? 'Последнее обновление: июль 2025' : 'Ultima actualizare: iulie 2025'}
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 32, maxWidth: 720 }}>
          <div className="card p-8 flex flex-col gap-8">
            {sections.map((s) => (
              <div key={s.title}>
                <h2 className="font-semibold text-base mb-2" style={{ color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  {s.title}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.7 }}>
                  {s.text}
                </p>
              </div>
            ))}

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 24 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {ru
                  ? 'По вопросам: '
                  : 'Întrebări: '}
                <a href="mailto:support@master.md" style={{ color: 'var(--accent)' }}>support@master.md</a>
              </p>
              <div className="flex gap-4 mt-4 text-sm">
                <Link href={`/${locale}/legal/privacy`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                  {ru ? 'Политика конфиденциальности →' : 'Politica de confidențialitate →'}
                </Link>
                <Link href={`/${locale}/legal/moderation`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                  {ru ? 'Правила модерации →' : 'Reguli de moderare →'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
