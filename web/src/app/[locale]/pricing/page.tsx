import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'ru' ? 'Цены — MASTER Moldova' : 'Prețuri — MASTER Moldova' };
}

const PLANS = [
  { credits: 5,   price: 50,  popular: false },
  { credits: 15,  price: 120, popular: true  },
  { credits: 30,  price: 200, popular: false },
  { credits: 100, price: 550, popular: false },
];

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  const ru = locale === 'ru';

  const faqs = ru ? [
    { q: 'Что такое кредит?', a: '1 кредит = 1 отклик на заявку заказчика. Кредит списывается в момент отправки отклика.' },
    { q: 'Публикация заявок бесплатна?', a: 'Да. Заказчики публикуют заявки бесплатно и без ограничений.' },
    { q: 'Можно ли получить кредиты бесплатно?', a: 'Да. При регистрации вы получаете стартовые кредиты. Платформа периодически проводит акции с бонусами.' },
    { q: 'Что если заказчик не ответил?', a: 'Кредиты не возвращаются — они списываются за сам отклик, независимо от результата.' },
    { q: 'Как оплатить?', a: 'Мы принимаем карты Visa/Mastercard и оплату через мобильных операторов Молдовы. Выберите пакет — и на следующем шаге откроется форма оплаты.' },
  ] : [
    { q: 'Ce este un credit?', a: '1 credit = 1 ofertă depusă pe o cerere a clientului. Creditul se deduce la momentul trimiterii ofertei.' },
    { q: 'Publicarea cererilor este gratuită?', a: 'Da. Clienții publică cereri gratuit și fără restricții.' },
    { q: 'Se pot obține credite gratuit?', a: 'Da. La înregistrare primiți credite de start. Platforma organizează periodic promoții cu bonusuri.' },
    { q: 'Ce se întâmplă dacă clientul nu a răspuns?', a: 'Creditele nu se restituie — ele se deduc pentru oferta în sine, indiferent de rezultat.' },
    { q: 'Cum se plătește?', a: 'Acceptăm carduri Visa/Mastercard și plata prin operatorii de telefonie mobilă din Moldova. Alegeți pachetul — la pasul următor se deschide formularul de plată.' },
  ];

  return (
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>

        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container text-center">
            <h1 className="font-bold text-3xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {ru ? 'Кредиты для откликов' : 'Credite pentru oferte'}
            </h1>
            <p className="mt-2" style={{ color: 'var(--text-muted)', fontSize: 15 }}>
              {ru ? '1 кредит = 1 отклик. Заказчики пользуются платформой бесплатно.' : '1 credit = 1 ofertă. Clienții utilizează platforma gratuit.'}
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 40 }}>

          {/* Plans grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12" style={{ maxWidth: 900, margin: '0 auto 48px' }}>
            {PLANS.map((plan) => (
              <div
                key={plan.credits}
                className="card p-6 flex flex-col gap-4 relative"
                style={plan.popular ? { border: '2px solid var(--accent)', boxShadow: '0 0 0 4px var(--accent-dim)' } : {}}
              >
                {plan.popular && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'var(--accent)', color: '#fff', whiteSpace: 'nowrap' }}
                  >
                    {ru ? '👍 Популярный' : '👍 Popular'}
                  </div>
                )}
                <div className="text-center">
                  <div className="font-bold" style={{ fontSize: 40, color: 'var(--accent)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                    {plan.credits}
                  </div>
                  <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    {ru ? 'кредитов' : 'credite'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-xl" style={{ color: 'var(--text)' }}>
                    {plan.price} MDL
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {(plan.price / plan.credits).toFixed(0)} MDL / {ru ? 'кредит' : 'credit'}
                  </div>
                </div>
                <Link
                  href={`/${locale}/credits?pack=${plan.credits}`}
                  className={plan.popular ? 'btn-primary' : 'btn-secondary'}
                  style={{ textAlign: 'center', width: '100%' }}
                >
                  {ru ? 'Выбрать' : 'Alege'}
                </Link>
              </div>
            ))}
          </div>

          {/* What's free */}
          <div className="card p-6 mb-8" style={{ maxWidth: 720, margin: '0 auto 32px' }}>
            <h2 className="font-semibold text-base mb-4" style={{ color: 'var(--text)' }}>
              {ru ? 'Что входит бесплатно' : 'Ce este inclus gratuit'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(ru ? [
                'Регистрация и профиль мастера',
                'Просмотр всех заявок',
                'Старовые кредиты при регистрации',
                'Telegram-уведомления',
                'Верификация профиля',
                'Отзывы и рейтинг',
              ] : [
                'Înregistrare și profil de meșter',
                'Vizualizarea tuturor cererilor',
                'Credite de start la înregistrare',
                'Notificări Telegram',
                'Verificarea profilului',
                'Recenzii și rating',
              ]).map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--success)' }}>✓</span> {item}
                </div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <h2 className="font-semibold text-lg mb-5" style={{ color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {ru ? 'Частые вопросы' : 'Întrebări frecvente'}
            </h2>
            <div className="flex flex-col gap-4">
              {faqs.map((f) => (
                <div key={f.q} className="card p-5">
                  <p className="font-semibold text-sm mb-2" style={{ color: 'var(--text)' }}>{f.q}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.65 }}>{f.a}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
