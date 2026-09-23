import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Политика конфиденциальности' : 'Politica de confidențialitate' };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const ru = locale === 'ru';

  const sections = ru ? [
    {
      title: '1. Какие данные мы собираем',
      text: `При регистрации: номер телефона или e-mail, имя, город. При создании профиля мастера: фото, категории услуг, описание, зоны работы, рейтинг. При использовании Платформы: заявки, отклики, отзывы, данные об активности. При подключении Telegram: идентификатор чата (chat_id).`,
    },
    {
      title: '2. Как мы используем данные',
      text: `Данные используются для: обеспечения работы Платформы (публикация заявок, отклики, переписка), отправки уведомлений через Telegram, верификации личности мастера, улучшения качества сервиса и формирования статистики. Мы не продаём ваши данные третьим лицам.`,
    },
    {
      title: '3. Хранение данных',
      text: `Данные хранятся в защищённой облачной инфраструктуре (Supabase, ЕС). Мы применяем шифрование в состоянии покоя и при передаче. Данные хранятся до тех пор, пока существует аккаунт, и в течение 12 месяцев после его удаления.`,
    },
    {
      title: '4. Telegram-интеграция',
      text: `Если вы подключаете Telegram, мы сохраняем только ваш chat_id для отправки уведомлений. Мы не имеем доступа к вашей переписке в Telegram. Вы можете отвязать Telegram в любой момент командой /stop или через настройки профиля.`,
    },
    {
      title: '5. Ваши права',
      text: `Вы вправе: получить копию своих данных, исправить неточные данные, удалить аккаунт и все связанные данные, отозвать согласие на обработку. Для реализации прав обратитесь на support@master.md.`,
    },
    {
      title: '6. Cookie и аналитика',
      text: `Мы используем сессионные cookie для аутентификации. Сторонняя аналитика не применяется. Мы не отслеживаем вас на других сайтах.`,
    },
    {
      title: '7. Изменения политики',
      text: `При существенных изменениях политики вы будете уведомлены через Telegram или e-mail минимум за 7 дней до вступления изменений в силу.`,
    },
  ] : [
    {
      title: '1. Ce date colectăm',
      text: `La înregistrare: număr de telefon sau e-mail, nume, oraș. La crearea profilului de meșter: fotografie, categorii de servicii, descriere, zone de activitate, rating. În timpul utilizării Platformei: cereri, oferte, recenzii, date de activitate. La conectarea Telegram: identificatorul de chat (chat_id).`,
    },
    {
      title: '2. Cum utilizăm datele',
      text: `Datele sunt utilizate pentru: funcționarea Platformei (publicarea cererilor, oferte, comunicare), trimiterea notificărilor prin Telegram, verificarea identității meșterului, îmbunătățirea calității serviciului și generarea statisticilor. Nu vindem datele dvs. unor terți.`,
    },
    {
      title: '3. Stocarea datelor',
      text: `Datele sunt stocate în infrastructură cloud securizată (Supabase, UE). Aplicăm criptare în repaus și în tranzit. Datele se păstrează atât timp cât există contul și 12 luni după ștergerea acestuia.`,
    },
    {
      title: '4. Integrarea Telegram',
      text: `Dacă conectați Telegram, stocăm doar chat_id-ul dvs. pentru trimiterea notificărilor. Nu avem acces la mesajele dvs. din Telegram. Puteți deconecta Telegram oricând cu comanda /stop sau din setările profilului.`,
    },
    {
      title: '5. Drepturile dvs.',
      text: `Aveți dreptul să: obțineți o copie a datelor dvs., corectați datele inexacte, ștergeți contul și toate datele asociate, retrageți consimțământul pentru prelucrare. Pentru exercitarea drepturilor, contactați support@master.md.`,
    },
    {
      title: '6. Cookie și analiză',
      text: `Folosim cookie-uri de sesiune pentru autentificare. Nu utilizăm analiză terță. Nu vă urmărim pe alte site-uri.`,
    },
    {
      title: '7. Modificarea politicii',
      text: `În caz de modificări esențiale ale politicii, veți fi notificat prin Telegram sau e-mail cu cel puțin 7 zile înainte de intrarea în vigoare a modificărilor.`,
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
              {ru ? 'Политика конфиденциальности' : 'Politica de confidențialitate'}
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
                {ru ? 'Контакт DPO: ' : 'Contact DPO: '}
                <a href="mailto:privacy@master.md" style={{ color: 'var(--accent)' }}>privacy@master.md</a>
              </p>
              <div className="flex gap-4 mt-4 text-sm">
                <Link href={`/${locale}/legal/terms`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                  {ru ? 'Условия использования →' : 'Termeni de utilizare →'}
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
