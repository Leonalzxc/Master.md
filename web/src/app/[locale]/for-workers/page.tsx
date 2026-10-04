import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'ru' ? 'Для мастеров — MASTER Moldova' : 'Pentru meșteri — MASTER Moldova',
    description: locale === 'ru'
      ? 'Зарегистрируйтесь как мастер и получайте заявки от заказчиков в Бельцах'
      : 'Înregistrați-vă ca meșter și primiți cereri de la clienți din Bălți',
  };
}

export default async function ForWorkersPage({ params }: Props) {
  const { locale } = await params;
  const ru = locale === 'ru';

  const benefits = ru ? [
    { icon: '📋', title: 'Поток заявок', text: 'Получайте заявки от заказчиков в вашем городе и по вашей специализации. Не тратьте время на холодный поиск.' },
    { icon: '⚡', title: 'Быстрый старт', text: 'Создайте профиль за 5 минут. Сразу начинайте откликаться на подходящие заявки.' },
    { icon: '🌍', title: 'Пилот в Бельцах', text: 'Принимайте заказы в Бельцах. Расширение географии — после проверки пилота.' },
    { icon: '⭐', title: 'Рейтинг и доверие', text: 'Собирайте отзывы после каждого заказа. Высокий рейтинг приводит больше заказчиков.' },
    { icon: '🛡️', title: 'Верификация', text: 'Пройдите верификацию и получите значок ✓ Проверен — это увеличивает конверсию откликов.' },
    { icon: '📱', title: 'Telegram-уведомления', text: 'Подключите Telegram и получайте мгновенные уведомления о новых заявках, не пропуская ни одну.' },
  ] : [
    { icon: '📋', title: 'Flux de cereri', text: 'Primiți cereri de la clienți din orașul dvs. și din specialitatea dvs. Fără căutare la rece.' },
    { icon: '⚡', title: 'Start rapid', text: 'Creați un profil în 5 minute. Începeți imediat să depuneți oferte pe cereri potrivite.' },
    { icon: '🌍', title: 'Pilot în Bălți', text: 'Acceptați lucrări în Bălți. Extinderea va urma după evaluarea pilotului.' },
    { icon: '⭐', title: 'Rating și încredere', text: 'Colectați recenzii după fiecare comandă. Un rating ridicat aduce mai mulți clienți.' },
    { icon: '🛡️', title: 'Verificare', text: 'Treceți prin verificare și obțineți insigna ✓ Verificat — aceasta crește conversia ofertelor.' },
    { icon: '📱', title: 'Notificări Telegram', text: 'Conectați Telegram și primiți notificări instantanee despre cereri noi, fără să ratați niciuna.' },
  ];

  const steps = ru ? [
    { num: '01', text: 'Создайте аккаунт и заполните профиль' },
    { num: '02', text: 'Укажите специализации и зоны работы' },
    { num: '03', text: 'Отправляйте до 10 бесплатных откликов за 24 часа' },
    { num: '04', text: 'Выполняйте заказы и собирайте отзывы' },
  ] : [
    { num: '01', text: 'Creați un cont și completați profilul' },
    { num: '02', text: 'Indicați specializările și zonele de lucru' },
    { num: '03', text: 'Trimiteți până la 10 oferte gratuite în 24 de ore' },
    { num: '04', text: 'Executați comenzi și colectați recenzii' },
  ];

  return (
    <>
      <Header />
      <main className="flex-1">

        {/* Hero */}
        <section style={{
          background: 'linear-gradient(135deg, #0b1628 0%, #0f2548 60%, #0c3060 100%)',
          padding: 'clamp(72px, 10vw, 112px) 0',
        }}>
          <div className="container" style={{ maxWidth: 720, textAlign: 'center' }}>
            <div
              className="inline-flex items-center gap-2 mb-5"
              style={{
                background: 'rgba(14,165,233,.15)', border: '1px solid rgba(14,165,233,.3)',
                borderRadius: 100, padding: '6px 14px', fontSize: 13, color: '#7dd3fc', fontWeight: 600,
              }}
            >
              🔧 {ru ? 'Для мастеров' : 'Pentru meșteri'}
            </div>

            <h1
              className="font-bold text-white mb-5"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.15, letterSpacing: '-.02em' }}
            >
              {ru ? 'Больше заказов — меньше поиска' : 'Mai multe comenzi — mai puțină căutare'}
            </h1>
            <p className="mb-8" style={{ color: 'rgba(255,255,255,.65)', fontSize: 17, lineHeight: 1.7 }}>
              {ru
                ? 'Тысячи заказчиков ищут мастеров каждый день. Создайте профиль и получайте заявки по вашей специализации.'
                : 'Mii de clienți caută meșteri în fiecare zi. Creați un profil și primiți cereri pe specialitatea dvs.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`/${locale}/auth`} className="btn-primary" style={{ fontSize: 16, height: 52, padding: '0 32px' }}>
                {ru ? 'Зарегистрироваться бесплатно' : 'Înregistrare gratuită'}
              </Link>
              <Link href={`/${locale}/pricing`} className="hero-btn-outline">
                {ru ? 'Узнать цены →' : 'Aflați prețuri →'}
              </Link>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section style={{ padding: 'clamp(56px, 8vw, 88px) 0', background: 'var(--bg-deep)' }}>
          <div className="container">
            <h2 className="font-bold text-center mb-10" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2rem)', color: 'var(--text)', letterSpacing: '-.01em' }}>
              {ru ? 'Почему MASTER?' : 'De ce MASTER?'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {benefits.map((b) => (
                <div key={b.title} className="card p-6 flex flex-col gap-3">
                  <span style={{ fontSize: 28 }}>{b.icon}</span>
                  <h3 className="font-semibold" style={{ fontSize: 15.5, color: 'var(--text)' }}>{b.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.65 }}>{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Steps */}
        <section style={{ padding: 'clamp(56px, 8vw, 88px) 0', background: 'var(--bg-elevated)' }}>
          <div className="container" style={{ maxWidth: 600 }}>
            <h2 className="font-bold text-center mb-10" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2rem)', color: 'var(--text)' }}>
              {ru ? 'Как начать' : 'Cum să începeți'}
            </h2>
            <div className="flex flex-col gap-4">
              {steps.map((s, i) => (
                <div key={i} className="card p-5 flex items-center gap-4">
                  <div
                    className="flex items-center justify-center rounded-2xl font-bold shrink-0"
                    style={{ width: 48, height: 48, background: 'var(--accent-dim)', color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 16 }}
                  >
                    {s.num}
                  </div>
                  <p style={{ color: 'var(--text)', fontSize: 15, fontWeight: 500 }}>{s.text}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href={`/${locale}/auth`} className="btn-primary" style={{ fontSize: 15, height: 48, padding: '0 28px' }}>
                {ru ? 'Начать бесплатно →' : 'Începeți gratuit →'}
              </Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
