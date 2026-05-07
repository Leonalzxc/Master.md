export type Category =
  | 'electric' | 'plumbing' | 'finishing' | 'roofing'
  | 'tiling' | 'minorRepairs' | 'furniture' | 'painting';

export interface Job {
  id: string;
  title: string;
  description: string;
  category: Category;
  city: string;
  area: string;
  budgetMin?: number;
  budgetMax?: number;
  urgent: boolean;
  needsQuote: boolean;
  bidsCount: number;
  status: 'active' | 'in_progress' | 'done';
  createdAt: string;
}

export interface Worker {
  id: string;
  name: string;
  categories: Category[];
  city: string;
  areas: string[];
  ratingAvg: number;
  ratingCount: number;
  isPro: boolean;
  verified: boolean;
  completedJobs: number;
  bio: string;
  avatar?: string;
}

export const MOCK_JOBS: Job[] = [
  {
    id: '1',
    title: 'Замена проводки в квартире',
    description: 'Нужно полностью заменить проводку в 3-комнатной квартире. Квартира после ремонта, штробы сделаны. Нужен материал + работа или только работа.',
    category: 'electric',
    city: 'Кишинёв',
    area: 'Центр',
    budgetMin: 5000,
    budgetMax: 8000,
    urgent: false,
    needsQuote: true,
    bidsCount: 3,
    status: 'active',
    createdAt: '2026-05-07T09:00:00Z',
  },
  {
    id: '2',
    title: 'Сантехника в ванной — течёт труба',
    description: 'Срочно! Течёт труба под ванной, нужно устранить течь. Дом кирпичный, трубы советские, возможно нужна замена участка.',
    category: 'plumbing',
    city: 'Кишинёв',
    area: 'Ботаника',
    urgent: true,
    needsQuote: false,
    bidsCount: 5,
    status: 'active',
    createdAt: '2026-05-07T08:30:00Z',
  },
  {
    id: '3',
    title: 'Укладка плитки на кухне',
    description: 'Нужно уложить плитку на кухне (фартук). Размер стены примерно 3м × 0.8м. Плитка уже куплена. Ищу мастера с опытом.',
    category: 'tiling',
    city: 'Кишинёв',
    area: 'Рышкановка',
    budgetMin: 1500,
    budgetMax: 2500,
    urgent: false,
    needsQuote: false,
    bidsCount: 2,
    status: 'active',
    createdAt: '2026-05-06T14:00:00Z',
  },
  {
    id: '4',
    title: 'Покраска комнаты',
    description: 'Покраска 1 комнаты, примерно 18 кв.м. Стены уже подготовлены (шпаклёвка есть). Нужна покраска в 2 слоя, цвет светло-серый.',
    category: 'painting',
    city: 'Бельцы',
    area: 'Центр',
    budgetMin: 800,
    budgetMax: 1200,
    urgent: false,
    needsQuote: false,
    bidsCount: 1,
    status: 'active',
    createdAt: '2026-05-06T11:00:00Z',
  },
  {
    id: '5',
    title: 'Сборка мебели IKEA',
    description: 'Нужно собрать шкаф PAX (3 секции) и кровать HEMNES. Всё привезено домой, нужна только сборка.',
    category: 'furniture',
    city: 'Кишинёв',
    area: 'Чеканы',
    budgetMin: 400,
    budgetMax: 600,
    urgent: false,
    needsQuote: false,
    bidsCount: 4,
    status: 'active',
    createdAt: '2026-05-05T16:00:00Z',
  },
];

export const MOCK_WORKERS: Worker[] = [
  {
    id: 'w1',
    name: 'Андрей Мирча',
    categories: ['electric', 'minorRepairs'],
    city: 'Кишинёв',
    areas: ['Центр', 'Ботаника', 'Рышкановка'],
    ratingAvg: 4.9,
    ratingCount: 47,
    isPro: true,
    verified: true,
    completedJobs: 52,
    bio: 'Электрик с 12 годами опыта. Квартиры, офисы, промышленные объекты. Работаю с материалом и без.',
  },
  {
    id: 'w2',
    name: 'Ion Popescu',
    categories: ['plumbing', 'finishing'],
    city: 'Кишинёв',
    areas: ['Ботаника', 'Чеканы', 'Буюканы'],
    ratingAvg: 4.7,
    ratingCount: 31,
    isPro: false,
    verified: true,
    completedJobs: 38,
    bio: 'Santehnic și finisaje. Experiență 8 ani. Calitate garantată.',
  },
  {
    id: 'w3',
    name: 'Виктор Руссу',
    categories: ['tiling', 'finishing'],
    city: 'Кишинёв',
    areas: ['Центр', 'Рышкановка', 'Телецентр'],
    ratingAvg: 4.8,
    ratingCount: 23,
    isPro: true,
    verified: true,
    completedJobs: 29,
    bio: 'Плитка, ламинат, штукатурка. Аккуратная работа с соблюдением сроков.',
  },
  {
    id: 'w4',
    name: 'Alexandru Gîndea',
    categories: ['roofing'],
    city: 'Кишинёв',
    areas: ['Любой район'],
    ratingAvg: 4.6,
    ratingCount: 15,
    isPro: false,
    verified: false,
    completedJobs: 18,
    bio: 'Кровельные работы: металлочерепица, профнастил, мягкая кровля.',
  },
  {
    id: 'w5',
    name: 'Николай Тимофей',
    categories: ['painting', 'finishing', 'minorRepairs'],
    city: 'Бельцы',
    areas: ['Центр', 'Любой район Бельцы'],
    ratingAvg: 4.5,
    ratingCount: 19,
    isPro: false,
    verified: true,
    completedJobs: 22,
    bio: 'Покраска, шпаклёвка, мелкий ремонт. Работаю в Бельцах и области.',
  },
  {
    id: 'w6',
    name: 'Mihail Sîrbu',
    categories: ['furniture', 'minorRepairs'],
    city: 'Кишинёв',
    areas: ['Любой район'],
    ratingAvg: 4.9,
    ratingCount: 63,
    isPro: true,
    verified: true,
    completedJobs: 70,
    bio: 'Сборка мебели любой сложности. IKEA, Jysk, корпусная мебель на заказ.',
  },
];

export const CITIES = ['Кишинёв', 'Бельцы'];

export const AREAS: Record<string, string[]> = {
  'Кишинёв': ['Центр', 'Ботаника', 'Рышкановка', 'Буюканы', 'Чеканы', 'Телецентр', 'Скулянка', 'Данчены'],
  'Бельцы': ['Центр', 'Любой район Бельцы'],
};

export const CATEGORY_LABELS_RU: Record<Category, string> = {
  electric: 'Электрика',
  plumbing: 'Сантехника',
  finishing: 'Отделка',
  roofing: 'Кровля',
  tiling: 'Плитка',
  minorRepairs: 'Мелкий ремонт',
  furniture: 'Сборка мебели',
  painting: 'Покраска',
};

export const CATEGORY_ICONS: Record<Category, string> = {
  electric: '⚡',
  plumbing: '🔧',
  finishing: '🏠',
  roofing: '🏚️',
  tiling: '🟫',
  minorRepairs: '🔨',
  furniture: '🪑',
  painting: '🖌️',
};

/* ── Reviews ─────────────────────────────────────────────────── */
export interface Review {
  id: string;
  workerId: string;
  authorName: string;
  rating: number;
  text: string;
  jobCategory: Category;
  createdAt: string;
}

export const MOCK_REVIEWS: Review[] = [
  { id: 'r1', workerId: 'w1', authorName: 'Олег К.', rating: 5, text: 'Андрей сделал всё чисто и в срок. Заменил всю проводку в квартире за 2 дня, убрал за собой. Рекомендую!', jobCategory: 'electric', createdAt: '2026-04-20T10:00:00Z' },
  { id: 'r2', workerId: 'w1', authorName: 'Марина Л.', rating: 5, text: 'Профессионал своего дела. Быстро нашёл проблему, устранил. Цена честная.', jobCategory: 'electric', createdAt: '2026-04-05T14:00:00Z' },
  { id: 'r3', workerId: 'w1', authorName: 'Дмитрий П.', rating: 4, text: 'Хорошая работа, приехал вовремя. Немного задержался из-за материалов, но предупредил.', jobCategory: 'minorRepairs', createdAt: '2026-03-18T09:00:00Z' },
  { id: 'r4', workerId: 'w2', authorName: 'Ana M.', rating: 5, text: 'Ion a rezolvat rapid problema cu țeava. Foarte serios și curat în lucru.', jobCategory: 'plumbing', createdAt: '2026-04-22T11:00:00Z' },
  { id: 'r5', workerId: 'w2', authorName: 'Сергей Б.', rating: 4, text: 'Хорошо сделал отделку в коридоре. Чуть дороже, чем ожидал, но качество на уровне.', jobCategory: 'finishing', createdAt: '2026-04-01T15:00:00Z' },
  { id: 'r6', workerId: 'w3', authorName: 'Наталья В.', rating: 5, text: 'Виктор уложил плитку идеально. Ровные швы, без сколов. Очень доволен результатом.', jobCategory: 'tiling', createdAt: '2026-04-18T12:00:00Z' },
  { id: 'r7', workerId: 'w6', authorName: 'Татьяна И.', rating: 5, text: 'Михаил собрал весь шкаф PAX за 1.5 часа. Аккуратно, без царапин. Буду обращаться снова!', jobCategory: 'furniture', createdAt: '2026-05-01T10:00:00Z' },
  { id: 'r8', workerId: 'w6', authorName: 'Роман Н.', rating: 5, text: 'Быстро, качественно, вежливо. Собрал кровать и тумбочки. Однозначно рекомендую.', jobCategory: 'furniture', createdAt: '2026-04-28T16:00:00Z' },
];

/* ── Bids (for job detail) ───────────────────────────────────── */
export interface Bid {
  id: string;
  jobId: string;
  workerId: string;
  workerName: string;
  workerRating: number;
  workerRatingCount: number;
  workerIsPro: boolean;
  workerVerified: boolean;
  price: number;
  priceMax?: number;
  comment: string;
  startDate: string;
  status: 'sent' | 'selected';
  createdAt: string;
}

export const MOCK_BIDS: Bid[] = [
  { id: 'b1', jobId: '1', workerId: 'w1', workerName: 'Андрей Мирча', workerRating: 4.9, workerRatingCount: 47, workerIsPro: true, workerVerified: true, price: 5500, priceMax: 7000, comment: 'Приеду осмотреть бесплатно. Работаю с материалом, могу привезти качественную кабельную продукцию. Срок 2–3 дня.', startDate: '2026-05-10', status: 'sent', createdAt: '2026-05-07T09:30:00Z' },
  { id: 'b2', jobId: '1', workerId: 'w2', workerName: 'Ion Popescu', workerRating: 4.7, workerRatingCount: 31, workerIsPro: false, workerVerified: true, price: 4800, comment: 'Опыт 8 лет. Работаю аккуратно, убираю после себя. Готов обсудить детали.', startDate: '2026-05-12', status: 'sent', createdAt: '2026-05-07T10:15:00Z' },
  { id: 'b3', jobId: '1', workerId: 'w3', workerName: 'Виктор Руссу', workerRating: 4.8, workerRatingCount: 23, workerIsPro: true, workerVerified: true, price: 6200, comment: 'Делаю всё по нормативам, даю гарантию 2 года на работу.', startDate: '2026-05-09', status: 'sent', createdAt: '2026-05-07T11:00:00Z' },
  { id: 'b4', jobId: '2', workerId: 'w2', workerName: 'Ion Popescu', workerRating: 4.7, workerRatingCount: 31, workerIsPro: false, workerVerified: true, price: 350, comment: 'Могу приехать сегодня до 18:00. Скорее всего замена участка трубы, это 1–2 часа работы.', startDate: '2026-05-07', status: 'selected', createdAt: '2026-05-07T08:45:00Z' },
  { id: 'b5', jobId: '2', workerId: 'w1', workerName: 'Андрей Мирча', workerRating: 4.9, workerRatingCount: 47, workerIsPro: true, workerVerified: true, price: 500, comment: 'Могу завтра утром. Оценю на месте.', startDate: '2026-05-08', status: 'sent', createdAt: '2026-05-07T09:10:00Z' },
  { id: 'b6', jobId: '3', workerId: 'w3', workerName: 'Виктор Руссу', workerRating: 4.8, workerRatingCount: 23, workerIsPro: true, workerVerified: true, price: 1800, comment: 'Специализируюсь на плитке. Выполню ровно и аккуратно. Можно посмотреть мои предыдущие работы.', startDate: '2026-05-11', status: 'sent', createdAt: '2026-05-06T15:00:00Z' },
  { id: 'b7', jobId: '3', workerId: 'w2', workerName: 'Ion Popescu', workerRating: 4.7, workerRatingCount: 31, workerIsPro: false, workerVerified: true, price: 1500, comment: 'Сделаю за 1 день. Работаю чисто.', startDate: '2026-05-13', status: 'sent', createdAt: '2026-05-06T16:00:00Z' },
  { id: 'b8', jobId: '5', workerId: 'w6', workerName: 'Mihail Sîrbu', workerRating: 4.9, workerRatingCount: 63, workerIsPro: true, workerVerified: true, price: 450, comment: 'PAX (3 секции) + HEMNES соберу за 2.5–3 часа. Работаю с IKEA более 5 лет, знаю все нюансы.', startDate: '2026-05-08', status: 'sent', createdAt: '2026-05-05T17:00:00Z' },
  { id: 'b9', jobId: '5', workerId: 'w1', workerName: 'Андрей Мирча', workerRating: 4.9, workerRatingCount: 47, workerIsPro: true, workerVerified: true, price: 500, comment: 'Соберу аккуратно, проверю все крепления.', startDate: '2026-05-09', status: 'sent', createdAt: '2026-05-05T18:00:00Z' },
];
