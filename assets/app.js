/**
 * MASTER — стройка и ремонт в Молдове.
 * Гибрид паттернов: биржа заказов + отклики (Freelancer) и услуги с фикс-ценой (Kwork).
 */
const STORE = {
  users: "ml_users",
  jobs: "ml_jobs",
  bids: "ml_bids",
  reviews: "ml_reviews",
  events: "ml_events",
  mod: "ml_mod_logs",
  lang: "lang",
  auth: "ml_auth",
  gigs: "ml_gigs",
  orders: "ml_orders",
};

const state = {
  lang: localStorage.getItem(STORE.lang) || "ru",
  requestStep: 1,
  draftRequest: { category: "", description: "", city: "Chisinau", area: "", timeline: "", budget: "", phone: "" },
  workerProfileTab: "profile",
};

const cities = ["Chisinau", "Balti"];

const categories = ["Электрика", "Сантехника", "Отделка", "Крыша", "Укладка плитки", "Мелкий ремонт"];

/** Подписи категорий для UI (в данных и URL остаётся RU-ключ). */
const CATEGORY_LABELS = {
  Электрика: { ro: "Electricitate" },
  Сантехника: { ro: "Instalații sanitare" },
  Отделка: { ro: "Finisaje interioare" },
  Крыша: { ro: "Acoperișuri" },
  "Укладка плитки": { ro: "Montaj faianță / gresie" },
  "Мелкий ремонт": { ro: "Reparații curente" },
};

function catLabel(ruName) {
  const row = CATEGORY_LABELS[ruName];
  return state.lang === "ro" && row ? row.ro : ruName;
}

const CITY_LABELS = {
  Chisinau: { ro: "Chișinău" },
  Balti: { ro: "Bălți" },
};

function cityLabel(code) {
  const row = CITY_LABELS[code];
  return state.lang === "ro" && row ? row.ro : code;
}

const i18n = {
  ru: {
    navFind: "Мастера",
    navJobs: "Заказы",
    navGigs: "Услуги",
    navCreate: "Заявка",
    navCategories: "Категории",
    navForWorkers: "Мастерам",
    navReviews: "Отзывы",
    navLogin: "Вход",
    navPricing: "Тарифы PRO",
    navHow: "Как это работает",
    navMessages: "Сообщения",
    navClusterService: "Сервис",
    navClusterMore: "Ещё",
    footerTagline: "Биржа заказов и каталог услуг для ремонта и стройки в Кишинёве и Бельцах.",
    footerCities: "Города",
    footerLegal: "Правила",
    footerHelp: "Поддержка",
    heroTitle: "Ремонт и стройка: заказы и готовые услуги в одном месте",
    heroSub: "Опубликуйте задачу и сравните отклики мастеров — или сразу выберите услугу с фиксированной ценой и сроком.",
    heroRequest: "Оставить заявку",
    heroFindWork: "Найти работу",
    pathFreelanceTitle: "Биржа заказов",
    pathFreelanceDesc: "Как на классической бирже: вы описываете задачу, мастера предлагают цену и сроки, вы выбираете исполнителя.",
    pathKworkTitle: "Услуги с ценой",
    pathKworkDesc: "Как в маркетплейсе услуг: понятный объём работ, фиксированная стоимость и срок — заказ в пару кликов.",
    sectionCategories: "Категории работ",
    categoriesLead: "Выберите направление — откроются заявки в этой категории.",
    categoriesSeeJobs: "Открыть заказы",
    sectionFeaturedGigs: "Популярные услуги",
    sectionRecentJobs: "Свежие заявки",
    sectionHow: "Как это работает",
    howStep1: "Создайте заявку или выберите готовую услугу",
    howStep2: "Получите отклики или оформите заказ услуги",
    howStep3: "Сравните предложения и закрепите мастера",
    trustVerified: "Проверенные мастера",
    trustBids: "Сравнение откликов",
    trustLocal: "Кишинёв и Бельцы",
    homeTwoWaysTitle: "Два способа найти мастера",
    homeTwoWaysSub:
      "Идеи с kwork.ru (фикс-услуги) и freelancer.com (биржа и отклики) — под ремонт и стройку в Молдове.",
    homePathBadgeMarket: "Биржа",
    homePathBadgeGigs: "Услуги",
    homeGigsCatalog: "Каталог услуг",
    homeAllCategories: "Все категории",
    homeViewAllGigs: "Смотреть все",
    homeMoreHow: "Подробнее",
    homePulseTitle: "Пульс площадки",
    homePulseLine: "Открытых заявок сейчас: {pub}, откликов всего: {bids}.",
    homeEmptyGigsTitle: "В каталоге пока пусто",
    homeEmptyGigsText: "Услуги с фиксированной ценой появятся по мере подключения мастеров.",
    homeEmptyJobsTitle: "Нет открытых заявок",
    homeEmptyJobsText: "Создайте заявку — мастера пришлют цены и сроки.",
    kpiJobs: "Заявок",
    kpiBids: "Откликов",
    kpiWithBids: "С откликами",
    kpiLiquidity: "Ликвидность",
    jobsTitle: "Заказы на бирже",
    jobsIntro: "Фильтры и сортировка: сузьте выдачу по городу, категории и тексту.",
    jobsNew: "+ Новая заявка",
    jobsSearchPh: "плитка, электрика…",
    jobsSearch: "Поиск",
    jobsCity: "Город",
    jobsCityAll: "Все",
    jobsCategory: "Категория",
    jobsCategoryAll: "Все",
    jobsSort: "Сортировка",
    jobsSortNew: "Сначала новые",
    jobsSortBids: "Больше откликов",
    jobsApply: "Применить",
    jobsEmpty: "Нет заявок по фильтру.",
    jobsOpen: "Открыть и сравнить",
    jobTeaserOpen: "Открыть",
    jobsBidsAbbr: "откл.",
    jobsBudgetNone: "бюджет не указан",
    jobNotFound: "Заявка не найдена",
    jobBackList: "К списку",
    jobAllJobs: "← Все заказы",
    jobCompareTitle: "Сравнение откликов",
    jobCompareHint: "Цена, срок старта, краткий комментарий.",
    jobColWorker: "Мастер",
    jobColPrice: "Цена",
    jobColStart: "Старт",
    jobColComment: "Комментарий",
    jobColAction: "",
    jobChoose: "Выбрать",
    jobNoBids: "Пока нет откликов.",
    jobBidCta: "Откликнуться",
    jobWorkersLink: "Смотреть мастеров",
    jobSelectedPrefix: "Исполнитель выбран:",
    jobSelectedHint: "Контакты — по согласованию (чат в следующей версии).",
    jobRevealContacts: "Показать контакт заказчика",
    jobContactHint: "Номер указан при публикации заявки. Звоните в рабочее время.",
    jobReviewTitle: "Оценка и отзыв",
    jobReviewRating: "Оценка",
    jobReviewText: "Текст",
    jobReviewSubmit: "Оставить отзыв",
    jobTimelineNone: "срок не указан",
    bidPageTitle: "Отклик на заявку",
    bidPageIntro: "Укажите цену и условия — заказчик сравнит ваше предложение с другими.",
    bidPickJob: "Заявка",
    bidPrice: "Цена / диапазон",
    bidPricePh: "2500–4000 MDL",
    bidComment: "Комментарий (преимущества, срок)",
    bidStart: "Когда можете начать",
    bidStartPh: "со среды",
    bidSend: "Отправить отклик",
    bidBack: "Назад к заявке",
    bidNeedWorker: "Войдите как мастер, чтобы отправить отклик.",
    bidNeedJob: "Выберите заявку в списке или откройте её из ленты.",
    authTitle: "Вход по SMS (MVP)",
    authHint: "Демо: код не проверяется, нажмите «Войти».",
    authPhone: "Телефон",
    authName: "Имя",
    authNamePh: "Как к вам обращаться",
    authRole: "Роль",
    authRoleClient: "Заказчик",
    authRoleWorker: "Мастер",
    authRoleAdmin: "Admin",
    authOtp: "Получить код",
    authLogin: "Войти",
    requestIntro: "Публикация заявки на бирже: мастера увидят задачу и пришлют отклики с ценой.",
    requestStep1: "1 Категория",
    requestStep2: "2 Описание",
    requestStep3: "3 Район и срок",
    requestStep4: "4 Телефон",
    requestCat: "Категория",
    requestDesc: "Описание задачи",
    requestNext: "Дальше",
    requestBack: "Назад",
    requestCity: "Город",
    requestArea: "Район",
    requestAreaPh: "Centru, Buiucani…",
    requestWhen: "Когда начать",
    requestWhenPh: "На неделе",
    requestBudget: "Бюджет (опционально)",
    requestBudgetPh: "до 5000 MDL",
    requestPhone: "Телефон",
    requestPhoneHint: "Номер нужен для модерации и связи. OTP — демо.",
    requestPublish: "Опубликовать заявку",
    supportTitle: "FAQ и поддержка",
    gigCatalogTitle: "Каталог услуг",
    gigCatalogIntro: "Фиксированная цена, срок и перечень включённого — для типовых работ по дому.",
    gigSearchPh: "розетки, плитка…",
    gigFind: "Найти",
    gigEmpty: "Нет услуг по фильтру.",
    gigAddForWorkers: "Добавить услугу",
    gigDetail: "Подробнее",
    gigDays: "дн.",
    workersVerifiedOnly: "Только проверенные",
    workerDefault: "Мастер",
    workerRating: "Рейтинг:",
    workerDone: "закрыто работ:",
    workerProfile: "Профиль",
    logout: "Выйти",
    login: "Войти",
    alertDesc: "Добавьте описание",
    alertArea: "Укажите район",
    alertPhone: "Укажите телефон",
    alertBidFields: "Заполните цену и комментарий",
    alertBidDup: "Вы уже откликались на эту заявку",
    alertReviewText: "Добавьте текст отзыва",
    alertAuthPhone: "Введите телефон",
    alertGigClient: "Войдите как заказчик, чтобы оформить услугу.",
    alertGigRole: "Нужна роль заказчика.",
    gigOrderOk: "Заказ создан. Откройте кабинет заказчика → «Заказы услуг».",
    reviewSaved: "Отзыв сохранён",
    bidSent: "Отклик отправлен",
    profileSaved: "Профиль сохранён",
    gigAdded: "Услуга добавлена в каталог",
    jobPhoneClient: "Телефон заказчика",
    jobPhoneWorker: "Телефон мастера",
  },
  ro: {
    navFind: "Meșteri",
    navJobs: "Comenzi",
    navGigs: "Servicii",
    navCreate: "Cerere",
    navCategories: "Categorii",
    navForWorkers: "Pentru meșteri",
    navReviews: "Recenzii",
    navLogin: "Autentificare",
    navPricing: "Tarife PRO",
    navHow: "Cum functioneaza",
    navMessages: "Mesaje",
    navClusterService: "Servicii",
    navClusterMore: "Mai mult",
    footerTagline: "Bursa comenzilor si catalog servicii pentru reparatii si constructii la Chisinau si Balti.",
    footerCities: "Orase",
    footerLegal: "Politici",
    footerHelp: "Suport",
    heroTitle: "Reparatii si constructii: comenzi si servicii fixe intr-un singur loc",
    heroSub: "Publica o lucrare si compara ofertele — sau alege un serviciu cu pret si termen clare.",
    heroRequest: "Lasa cerere",
    heroFindWork: "Gaseste lucru",
    pathFreelanceTitle: "Bursa comenzilor",
    pathFreelanceDesc: "Descrii lucrarea, meșterii trimit preturi si termeni, tu alegi executantul.",
    pathKworkTitle: "Servicii cu pret fix",
    pathKworkDesc: "Volum clar de lucru, pret si termen fixe — comanda rapid.",
    sectionCategories: "Categorii de lucrari",
    categoriesLead: "Alegeti domeniul — se deschid comenzile din acea categorie.",
    categoriesSeeJobs: "Vezi comenzile",
    sectionFeaturedGigs: "Servicii populare",
    sectionRecentJobs: "Cereri recente",
    sectionHow: "Cum functioneaza",
    howStep1: "Creeaza cerere sau alege un serviciu",
    howStep2: "Primeste oferte sau comanda serviciul",
    howStep3: "Compara si confirma meșterul",
    trustVerified: "Meșteri verificati",
    trustBids: "Comparare oferte",
    trustLocal: "Chisinau si Balti",
    homeTwoWaysTitle: "Doua moduri de a gasi un meșter",
    homeTwoWaysSub:
      "Model kwork (servicii fixe) si freelancer (oferte) — adaptat pentru reparatii in Moldova.",
    homePathBadgeMarket: "Bursa",
    homePathBadgeGigs: "Servicii",
    homeGigsCatalog: "Catalog servicii",
    homeAllCategories: "Toate categoriile",
    homeViewAllGigs: "Vezi toate",
    homeMoreHow: "Detalii",
    homePulseTitle: "Activitatea platformei",
    homePulseLine: "Cereri deschise acum: {pub}, oferte in total: {bids}.",
    homeEmptyGigsTitle: "Catalogul e inca gol",
    homeEmptyGigsText: "Serviciile cu pret fix apar pe masura ce meșterii se conecteaza.",
    homeEmptyJobsTitle: "Nu sunt cereri deschise",
    homeEmptyJobsText: "Creati o cerere — meșterii vor trimite preturi si termene.",
    kpiJobs: "Cereri",
    kpiBids: "Oferte",
    kpiWithBids: "Cu oferte",
    kpiLiquidity: "Lichiditate",
    jobsTitle: "Comenzi pe burse",
    jobsIntro: "Filtreaza dupa oras, categorie si text.",
    jobsNew: "+ Cerere noua",
    jobsSearchPh: "faianta, electric…",
    jobsSearch: "Cautare",
    jobsCity: "Oras",
    jobsCityAll: "Toate",
    jobsCategory: "Categorie",
    jobsCategoryAll: "Toate",
    jobsSort: "Sortare",
    jobsSortNew: "Cele mai noi",
    jobsSortBids: "Cele mai multe oferte",
    jobsApply: "Aplica",
    jobsEmpty: "Nu exista comenzi pentru filtru.",
    jobsOpen: "Deschide si compara",
    jobTeaserOpen: "Deschide",
    jobsBidsAbbr: "of.",
    jobsBudgetNone: "buget nespecificat",
    jobNotFound: "Comanda nu a fost gasita",
    jobBackList: "La lista",
    jobAllJobs: "← Toate comenzile",
    jobCompareTitle: "Comparare oferte",
    jobCompareHint: "Pret, start, scurt comentariu.",
    jobColWorker: "Meșter",
    jobColPrice: "Pret",
    jobColStart: "Start",
    jobColComment: "Comentariu",
    jobColAction: "",
    jobChoose: "Alege",
    jobNoBids: "Inca nu sunt oferte.",
    jobBidCta: "Trimite oferta",
    jobWorkersLink: "Vezi meșteri",
    jobSelectedPrefix: "Executant ales:",
    jobSelectedHint: "Contactele — de comun acord (chat in versiunea urmatoare).",
    jobRevealContacts: "Arata contactul clientului",
    jobContactHint: "Numarul a fost indicat la publicare. Sunati in orele de lucru.",
    jobReviewTitle: "Evaluare si recenzie",
    jobReviewRating: "Nota",
    jobReviewText: "Text",
    jobReviewSubmit: "Trimite recenzia",
    jobTimelineNone: "termen nespecificat",
    bidPageTitle: "Oferta la comanda",
    bidPageIntro: "Indicati pretul si conditiile — clientul compara cu altele.",
    bidPickJob: "Comanda",
    bidPrice: "Pret / interval",
    bidPricePh: "2500–4000 MDL",
    bidComment: "Comentariu (avantaje, termen)",
    bidStart: "Cand puteti incepe",
    bidStartPh: "din miercuri",
    bidSend: "Trimite oferta",
    bidBack: "Inapoi la comanda",
    bidNeedWorker: "Autentificati-va ca meșter pentru a trimite o oferta.",
    bidNeedJob: "Alegeti o comanda din lista sau deschideti-o din flux.",
    authTitle: "Autentificare SMS (MVP)",
    authHint: "Demo: codul nu e verificat, apasati «Autentificare».",
    authPhone: "Telefon",
    authName: "Nume",
    authNamePh: "Cum va adresam",
    authRole: "Rol",
    authRoleClient: "Client",
    authRoleWorker: "Meșter",
    authRoleAdmin: "Admin",
    authOtp: "Primeste cod",
    authLogin: "Autentificare",
    requestIntro: "Publicati cererea pe burse: meșterii vad lucrarea si trimit preturi.",
    requestStep1: "1 Categorie",
    requestStep2: "2 Descriere",
    requestStep3: "3 Zona si termen",
    requestStep4: "4 Telefon",
    requestCat: "Categorie",
    requestDesc: "Descrierea lucrarii",
    requestNext: "Inainte",
    requestBack: "Inapoi",
    requestCity: "Oras",
    requestArea: "Zona / sector",
    requestAreaPh: "Centru, Buiucani…",
    requestWhen: "Cand sa inceapa",
    requestWhenPh: "in aceasta saptamina",
    requestBudget: "Buget (optional)",
    requestBudgetPh: "pina la 5000 MDL",
    requestPhone: "Telefon",
    requestPhoneHint: "Numarul e necesar pentru moderare si contact. OTP — demo.",
    requestPublish: "Publica cererea",
    supportTitle: "FAQ si suport",
    gigCatalogTitle: "Catalog servicii",
    gigCatalogIntro: "Pret fix, termen si ce e inclus — pentru lucrari tipice acasa.",
    gigSearchPh: "prize, faianta…",
    gigFind: "Cauta",
    gigEmpty: "Nu sunt servicii pentru filtru.",
    gigAddForWorkers: "Adauga serviciu",
    gigDetail: "Detalii",
    gigDays: "z.",
    workersVerifiedOnly: "Doar verificati",
    workerDefault: "Meșter",
    workerRating: "Rating:",
    workerDone: "lucrari finalizate:",
    workerProfile: "Profil",
    logout: "Iesire",
    login: "Autentificare",
    alertDesc: "Adaugati descrierea",
    alertArea: "Indicati zona",
    alertPhone: "Indicati telefonul",
    alertBidFields: "Completati pretul si comentariul",
    alertBidDup: "Ati trimis deja o oferta la aceasta comanda",
    alertReviewText: "Adaugati textul recenziei",
    alertAuthPhone: "Introduceti telefonul",
    alertGigClient: "Autentificati-va ca client pentru a comanda.",
    alertGigRole: "Este nevoie de rol client.",
    gigOrderOk: "Comanda creata. Deschideti contul client → «Comenzi servicii».",
    reviewSaved: "Recenzie salvata",
    bidSent: "Oferta trimisa",
    profileSaved: "Profil salvat",
    gigAdded: "Serviciu adaugat in catalog",
    jobPhoneClient: "Telefon client",
    jobPhoneWorker: "Telefon meșter",
  },
};

function now() { return new Date().toISOString(); }

function getJson(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function setJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Поля для событий (см. docs/05-kpi-events.csv): user_id, role, city, timestamp + payload. */
function trackContext(payload = {}) {
  const user = authUser();
  const { city: cityOverride, user_id: uidOverride, role: roleOverride, ...rest } = payload;
  return {
    ...rest,
    user_id: uidOverride != null ? uidOverride : user ? user.id : null,
    role: roleOverride != null ? roleOverride : user ? user.role : "guest",
    city: cityOverride != null ? cityOverride : user && user.city ? user.city : null,
    timestamp: now(),
  };
}

function track(event, payload = {}) {
  const events = getJson(STORE.events);
  events.push({ event, at: now(), ...trackContext(payload) });
  setJson(STORE.events, events);
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function telHref(phone) {
  const p = String(phone || "").replace(/[^\d+]/g, "");
  return p ? `tel:${p}` : "#";
}

/** Парсинг #/path/sub?a=1 */
function getRoute() {
  let h = location.hash || "#/";
  if (!h.startsWith("#")) h = `#${h}`;
  let rest = h.slice(1).replace(/^\/+/, "");
  const qi = rest.indexOf("?");
  const pathPart = qi === -1 ? rest : rest.slice(0, qi);
  const query = qi === -1 ? "" : rest.slice(qi + 1);
  const params = new URLSearchParams(query);
  const segments = pathPart.split("/").filter(Boolean);
  return { segments, params, path: pathPart };
}

function parsePriceNum(s) {
  const m = String(s || "").replace(/\s/g, "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function seed() {
  let users = getJson(STORE.users);
  if (!users.length) {
    users = [
      { id: "u_admin", phone: "+37360000000", role: "admin", name: "Admin", verified: true, city: "Chisinau", area: "Centru", rating: 5, bio: "", portfolio: [], jobsCompleted: 0 },
      { id: "u_w1", phone: "+37361000001", role: "worker", name: "Ion Ceban", verified: true, city: "Chisinau", area: "Buiucani", category: "Электрика", rating: 4.8, bio: "Электромонтаж квартир и офисов, допуски и инструмент.", portfolio: [{ title: "Квартира, Rîșcani", note: "Замена группы, УЗО" }, { title: "Частный дом", note: "Новая линия на участке" }], jobsCompleted: 24 },
      { id: "u_w2", phone: "+37361000002", role: "worker", name: "Mihai Lupu", verified: false, city: "Chisinau", area: "Botanica", category: "Сантехника", rating: 4.6, bio: "Сантехника, тёплые полы, бойлеры.", portfolio: [{ title: "Ванная 4 м²", note: "Плитка, смесители" }], jobsCompleted: 12 },
    ];
    setJson(STORE.users, users);
  } else {
    users = users.map((u) => ({
      ...u,
      bio: u.bio ?? "",
      portfolio: Array.isArray(u.portfolio) ? u.portfolio : [],
      jobsCompleted: typeof u.jobsCompleted === "number" ? u.jobsCompleted : 0,
    }));
    setJson(STORE.users, users);
  }
}

function seedGigs() {
  let gigs = getJson(STORE.gigs);
  if (!gigs.length) {
    gigs = [
      { id: "gig_seed_1", workerId: "u_w1", title: "Установка до 5 розеток и выключателей", category: "Электрика", city: "Chisinau", price: 1200, deliveryDays: 3, description: "Штробление не входит. Материалы заказчика или по согласованию.", includes: ["Выезд в черте города", "Проверка линии", "Фото отчёт"], featured: true, active: true },
      { id: "gig_seed_2", workerId: "u_w2", title: "Замена смесителя и подключение стиралки", category: "Сантехника", city: "Chisinau", price: 900, deliveryDays: 2, description: "Стандартный монтаж, без переноса водопровода.", includes: ["Выезд", "Герметизация", "Проверка на протечку"], featured: true, active: true },
      { id: "gig_seed_3", workerId: "u_w1", title: "Диагностика электрики в квартире", category: "Электрика", city: "Chisinau", price: 500, deliveryDays: 1, description: "Осмотр щита, замеры, рекомендации по смете.", includes: ["Письменное резюме по объекту"], featured: false, active: true },
    ];
    setJson(STORE.gigs, gigs);
  }
}

function authUser() {
  const auth = JSON.parse(localStorage.getItem(STORE.auth) || "null");
  if (!auth) return null;
  return getJson(STORE.users).find((u) => u.id === auth.userId) || null;
}

function t(key, vars = {}) {
  let s = i18n[state.lang][key] || i18n.ru[key] || key;
  Object.keys(vars).forEach((k) => {
    s = s.split(`{${k}}`).join(String(vars[k]));
  });
  return s;
}

function applyI18n() {
  document.documentElement.lang = state.lang === "ro" ? "ro" : "ru";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.dataset.i18n;
    if (k) el.textContent = t(k);
  });
  const toggle = document.getElementById("langToggle");
  if (toggle) toggle.textContent = state.lang.toUpperCase();
}

function metricSnapshot() {
  const jobs = getJson(STORE.jobs).filter((j) => j.status === "published" || j.status === "closed");
  const bids = getJson(STORE.bids);
  const selected = jobs.filter((j) => j.selectedWorkerId).length;
  const withBids = jobs.filter((j) => bids.some((b) => b.jobId === j.id)).length;
  return {
    published: jobs.length,
    bids: bids.length,
    bidCoverage: jobs.length ? Math.round((withBids / jobs.length) * 100) : 0,
    liquidity: jobs.length ? Math.round((selected / jobs.length) * 100) : 0,
  };
}

function kpiCards() {
  const m = metricSnapshot();
  return `<div class="card kpi-card"><p class="muted">${t("kpiJobs")}</p><h3>${m.published}</h3></div><div class="card kpi-card"><p class="muted">${t("kpiBids")}</p><h3>${m.bids}</h3></div><div class="card kpi-card"><p class="muted">${t("kpiWithBids")}</p><h3>${m.bidCoverage}%</h3></div><div class="card kpi-card"><p class="muted">${t("kpiLiquidity")}</p><h3>${m.liquidity}%</h3></div>`;
}

function authLine() {
  const user = authUser();
  if (!user) return `<a class="btn primary" href="#/auth">${t("login")}</a>`;
  return `<div class="auth-strip"><span class="user-chip">${escapeHtml(user.name)} · ${user.role}</span><button class="btn" id="logoutBtn" type="button">${t("logout")}</button></div>`;
}

function mountCommonEvents() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = () => { localStorage.removeItem(STORE.auth); route(); };
}

function route() {
  const app = document.getElementById("app");
  if (!app) return;
  const { segments, params } = getRoute();
  const s0 = segments[0] || "";
  const s1 = segments[1];

  if (!s0) return renderHome(app);
  if (s0 === "categories") return renderCategories(app);
  if (s0 === "how-it-works") return renderHowItWorks(app);
  if (s0 === "request" && s1 === "new") return renderRequest(app);
  if (s0 === "bid" && s1 === "new") return renderBidNew(app, params);
  if (s0 === "jobs" && s1) return renderJobCard(app, s1);
  if (s0 === "jobs") return renderJobs(app, params);
  if (s0 === "gigs" && s1) return renderGigDetail(app, s1);
  if (s0 === "gigs") return renderGigsCatalog(app, params);
  if (s0 === "workers" && s1) return renderWorkerCard(app, s1);
  if (s0 === "workers") return renderWorkers(app, params);
  if (s0 === "for-workers") return renderForWorkers(app);
  if (s0 === "pricing") return renderPricing(app);
  if (s0 === "reviews") return renderReviews(app);
  if (s0 === "auth") return renderAuth(app);
  if (s0 === "account" && s1 === "client") return renderClientCabinet(app);
  if (s0 === "account" && s1 === "worker") return renderWorkerCabinet(app);
  if (s0 === "admin" && s1 === "moderation") return renderAdmin(app);
  if (s0 === "legal" && s1) return renderLegal(app, s1);
  if (s0 === "support") return renderSupport(app);
  if (s0 === "messages") return renderMessages(app);

  app.innerHTML = `<section class="panel"><h2>404</h2><p class="muted">Страница не найдена.</p><a class="btn primary" href="#/">На главную</a></section>`;
}

function renderHome(app) {
  const jobs = getJson(STORE.jobs).filter((j) => j.status === "published").slice(0, 4);
  const gigs = getJson(STORE.gigs).filter((g) => g.active).filter((g) => g.featured).slice(0, 3);
  const m = metricSnapshot();

  app.innerHTML = `
    <section class="hero">
      <div class="hero-top">
        <h1>${t("heroTitle")}</h1>
        <div>${authLine()}</div>
      </div>
      <p class="muted hero-lead">${t("heroSub")}</p>
      <div class="hero-actions">
        <a class="big-cta request" href="#/request/new">${t("heroRequest")}</a>
        <a class="big-cta work" href="#/jobs">${t("heroFindWork")}</a>
      </div>
      <div class="trust-row">
        <span class="trust-pill">${t("trustVerified")}</span>
        <span class="trust-pill">${t("trustBids")}</span>
        <span class="trust-pill">${t("trustLocal")}</span>
      </div>
    </section>

    <section class="panel path-split">
      <h2 class="section-title">${t("homeTwoWaysTitle")}</h2>
      <p class="muted section-sub">${t("homeTwoWaysSub")}</p>
      <div class="path-cards">
        <div class="path-card path-card--jobs">
          <span class="path-badge">${t("homePathBadgeMarket")}</span>
          <h3>${t("pathFreelanceTitle")}</h3>
          <p class="muted">${t("pathFreelanceDesc")}</p>
          <div class="cta-row">
            <a class="btn primary" href="#/request/new">${t("heroRequest")}</a>
            <a class="btn" href="#/jobs">${t("navJobs")}</a>
          </div>
        </div>
        <div class="path-card path-card--gigs">
          <span class="path-badge path-badge--accent">${t("homePathBadgeGigs")}</span>
          <h3>${t("pathKworkTitle")}</h3>
          <p class="muted">${t("pathKworkDesc")}</p>
          <div class="cta-row">
            <a class="btn primary" href="#/gigs">${t("homeGigsCatalog")}</a>
            <a class="btn" href="#/workers">${t("navFind")}</a>
          </div>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="section-head">
        <h2 class="section-title">${t("sectionCategories")}</h2>
        <a class="btn" href="#/categories">${t("homeAllCategories")}</a>
      </div>
      <div class="category-strip">
        ${categories.map((c) => `<a class="category-chip" href="#/jobs?category=${encodeURIComponent(c)}">${escapeHtml(catLabel(c))}</a>`).join("")}
      </div>
    </section>

    <section class="panel">
      <div class="section-head">
        <h2 class="section-title">${t("sectionFeaturedGigs")}</h2>
        <a class="btn" href="#/gigs">${t("homeViewAllGigs")}</a>
      </div>
      <div class="gig-grid">
        ${gigs.length ? gigs.map(gigCardHtml).join("") : `<div class="empty-state" role="status"><p class="empty-state__title">${t("homeEmptyGigsTitle")}</p><p class="empty-state__text">${t("homeEmptyGigsText")}</p><a class="btn primary" href="#/gigs">${t("homeViewAllGigs")}</a></div>`}
      </div>
    </section>

    <section class="panel">
      <div class="section-head">
        <h2 class="section-title">${t("sectionRecentJobs")}</h2>
        <a class="btn" href="#/jobs">${t("navJobs")}</a>
      </div>
      <div class="job-teaser-grid">
        ${jobs.length ? jobs.map(jobTeaserHtml).join("") : `<div class="empty-state" role="status"><p class="empty-state__title">${t("homeEmptyJobsTitle")}</p><p class="empty-state__text">${t("homeEmptyJobsText")}</p><a class="btn primary" href="#/request/new">${t("heroRequest")}</a></div>`}
      </div>
    </section>

    <section class="panel">
      <h2 class="section-title">${t("sectionHow")}</h2>
      <div class="how-grid">
        <div class="how-step"><span class="how-num">1</span><p><strong>${t("howStep1")}</strong></p></div>
        <div class="how-step"><span class="how-num">2</span><p><strong>${t("howStep2")}</strong></p></div>
        <div class="how-step"><span class="how-num">3</span><p><strong>${t("howStep3")}</strong></p></div>
      </div>
      <div class="cta-row stack-mt">
        <a class="btn" href="#/how-it-works">${t("homeMoreHow")}</a>
        <a class="btn primary" href="#/for-workers">${t("navForWorkers")}</a>
      </div>
    </section>

    <section class="panel">
      <h2 class="section-title">${t("homePulseTitle")}</h2>
      <div class="kpi">${kpiCards()}</div>
      <p class="muted stack-mt">${t("homePulseLine", { pub: m.published, bids: m.bids })}</p>
    </section>
  `;
  mountCommonEvents();
}

function gigCardHtml(g) {
  const w = getJson(STORE.users).find((u) => u.id === g.workerId);
  const name = w ? w.name : t("workerDefault");
  return `<article class="gig-card"><div class="gig-card-top"><span class="gig-price">${g.price} MDL</span><span class="gig-days">${g.deliveryDays} ${t("gigDays")}</span></div><h3><a href="#/gigs/${g.id}">${escapeHtml(g.title)}</a></h3><p class="muted gig-meta">${escapeHtml(catLabel(g.category))} · ${escapeHtml(cityLabel(g.city))} · ${escapeHtml(name)}</p><p class="gig-desc">${escapeHtml(g.description.slice(0, 110))}${g.description.length > 110 ? "…" : ""}</p><a class="btn primary gig-cta" href="#/gigs/${g.id}">${t("gigDetail")}</a></article>`;
}

function jobTeaserHtml(j) {
  const bids = getJson(STORE.bids).filter((b) => b.jobId === j.id).length;
  return `<article class="job-teaser"><div class="job-teaser-head"><span class="job-cat">${escapeHtml(catLabel(j.category))}</span><span class="job-bids">${bids} ${t("jobsBidsAbbr")}</span></div><p>${escapeHtml(j.description.slice(0, 100))}${j.description.length > 100 ? "…" : ""}</p><p class="muted">${escapeHtml(cityLabel(j.city))}, ${escapeHtml(j.area)}</p><a class="btn" href="#/jobs/${j.id}">${t("jobTeaserOpen")}</a></article>`;
}

function renderHowItWorks(app) {
  app.innerHTML = `
    <section class="panel">
      <h1>Как работает MASTER</h1>
      <p class="muted">Мы совместили удобство <strong>биржи проектов</strong> (заявка → отклики → выбор) и <strong>каталога услуг</strong> (фикс-цена и срок, как готовое предложение).</p>
      <h2 class="stack-mt">Для заказчика</h2>
      <ol class="how-list">
        <li><strong>Заявка на бирже:</strong> опишите работу, район и срок — получите отклики с ценой и комментарием, сравните и выберите мастера.</li>
        <li><strong>Услуга из каталога:</strong> выберите готовое предложение с ценой, нажмите «Заказать» — заказ сохранится в кабинете (оплата на платформе — следующий этап продукта).</li>
        <li><strong>Отзывы:</strong> после выбора мастера по заявке можно оставить оценку — это повышает доверие к исполнителям.</li>
      </ol>
      <h2 class="stack-mt">Для мастера</h2>
      <ol class="how-list">
        <li><strong>Отклики:</strong> фильтруйте заявки по городу и категории, отправляйте предложение с ценой и сроком старта.</li>
        <li><strong>Свои услуги:</strong> создайте карточки с фиксированной ценой — клиенты заказывают без долгих переговоров.</li>
        <li><strong>Профиль:</strong> портфолио и описание повышают конверсию так же, как на крупных биржах.</li>
      </ol>
      <div class="cta-row stack-mt">
        <a class="btn primary" href="#/request/new">Создать заявку</a>
        <a class="btn" href="#/gigs">Каталог услуг</a>
      </div>
    </section>
  `;
}

function renderMessages(app) {
  app.innerHTML = `
    <section class="panel">
      <h2>Сообщения</h2>
      <p class="muted">Встроенный чат по сделке (как на крупных биржах) запланирован на следующий релиз. Сейчас договорённость — по телефону или мессенджеру после выбора мастера.</p>
      <a class="btn primary" href="#/support">FAQ и поддержка</a>
    </section>
  `;
}

function renderCategories(app) {
  app.innerHTML = `
    <section class="panel">
      <h2>${t("navCategories")}</h2>
      <p class="muted">${t("categoriesLead")}</p>
      <div class="grid cols-2 stack-mt">
        ${categories.map((c) => `
          <a class="card category-block" href="#/jobs?category=${encodeURIComponent(c)}">
            <h3>${escapeHtml(catLabel(c))}</h3>
            <p class="muted">${t("categoriesSeeJobs")} →</p>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

function renderRequest(app) {
  if (state.requestStep === 1) track("request_form_started");
  app.innerHTML = `
    <section class="panel">
      <h2>${t("navCreate")}</h2>
      <p class="muted">${t("requestIntro")}</p>
      <div class="steps">
        <span class="step ${state.requestStep === 1 ? "active" : ""}">${t("requestStep1")}</span>
        <span class="step ${state.requestStep === 2 ? "active" : ""}">${t("requestStep2")}</span>
        <span class="step ${state.requestStep === 3 ? "active" : ""}">${t("requestStep3")}</span>
        <span class="step ${state.requestStep === 4 ? "active" : ""}">${t("requestStep4")}</span>
      </div>
      <div id="requestStepForm"></div>
    </section>
  `;
  drawRequestStep();
}

function drawRequestStep() {
  const node = document.getElementById("requestStepForm");
  if (!node) return;
  if (state.requestStep === 1) {
    node.innerHTML = `<label>${t("requestCat")}<select id="rqCategory">${categories.map((c) => `<option ${state.draftRequest.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}</select></label><button class="btn primary" id="rqNext1" type="button">${t("requestNext")}</button>`;
    document.getElementById("rqNext1").onclick = () => {
      state.draftRequest.category = document.getElementById("rqCategory").value;
      track("request_step_completed", {
        step_name: "category",
        category: state.draftRequest.category,
        city: state.draftRequest.city,
      });
      state.requestStep = 2;
      renderRequest(document.getElementById("app"));
    };
    return;
  }
  if (state.requestStep === 2) {
    node.innerHTML = `<label>${t("requestDesc")}<textarea id="rqDescription">${escapeHtml(state.draftRequest.description)}</textarea></label><button class="btn" id="rqBack2" type="button">${t("requestBack")}</button> <button class="btn primary" id="rqNext2" type="button">${t("requestNext")}</button>`;
    document.getElementById("rqBack2").onclick = () => { state.requestStep = 1; renderRequest(document.getElementById("app")); };
    document.getElementById("rqNext2").onclick = () => {
      state.draftRequest.description = document.getElementById("rqDescription").value.trim();
      if (!state.draftRequest.description) return alert(t("alertDesc"));
      track("request_step_completed", { step_name: "description", city: state.draftRequest.city });
      state.requestStep = 3;
      renderRequest(document.getElementById("app"));
    };
    return;
  }
  if (state.requestStep === 3) {
    node.innerHTML = `
      <div class="grid cols-2">
        <label>${t("requestCity")}<select id="rqCity">${cities.map((c) => `<option value="${c}" ${state.draftRequest.city === c ? "selected" : ""}>${cityLabel(c)}</option>`).join("")}</select></label>
        <label>${t("requestArea")}<input id="rqArea" value="${escapeHtml(state.draftRequest.area)}" placeholder="${t("requestAreaPh")}" /></label>
      </div>
      <div class="grid cols-2">
        <label>${t("requestWhen")}<input id="rqTimeline" value="${escapeHtml(state.draftRequest.timeline)}" placeholder="${t("requestWhenPh")}" /></label>
        <label>${t("requestBudget")}<input id="rqBudget" value="${escapeHtml(state.draftRequest.budget)}" placeholder="${t("requestBudgetPh")}" /></label>
      </div>
      <button class="btn" id="rqBack3" type="button">${t("requestBack")}</button> <button class="btn primary" id="rqNext3" type="button">${t("requestNext")}</button>
    `;
    document.getElementById("rqBack3").onclick = () => { state.requestStep = 2; renderRequest(document.getElementById("app")); };
    document.getElementById("rqNext3").onclick = () => {
      state.draftRequest.city = document.getElementById("rqCity").value.trim();
      state.draftRequest.area = document.getElementById("rqArea").value.trim();
      state.draftRequest.timeline = document.getElementById("rqTimeline").value.trim();
      state.draftRequest.budget = document.getElementById("rqBudget").value.trim();
      if (!state.draftRequest.area) return alert(t("alertArea"));
      track("request_step_completed", {
        step_name: "location",
        city: state.draftRequest.city,
        area: state.draftRequest.area,
        category: state.draftRequest.category,
      });
      state.requestStep = 4;
      renderRequest(document.getElementById("app"));
    };
    return;
  }
  node.innerHTML = `
    <label>${t("requestPhone")}<input id="rqPhone" value="${escapeHtml(state.draftRequest.phone)}" placeholder="+373…" /></label>
    <p class="muted">${t("requestPhoneHint")}</p>
    <button class="btn" id="rqBack4" type="button">${t("requestBack")}</button> <button class="btn primary" id="rqPublish" type="button">${t("requestPublish")}</button>
  `;
  document.getElementById("rqBack4").onclick = () => { state.requestStep = 3; renderRequest(document.getElementById("app")); };
  document.getElementById("rqPublish").onclick = () => {
    state.draftRequest.phone = document.getElementById("rqPhone").value.trim();
    if (!state.draftRequest.phone) return alert(t("alertPhone"));
    const user = authUser();
    const jobs = getJson(STORE.jobs);
    const id = uid("job");
    jobs.unshift({
      id,
      ...state.draftRequest,
      clientUserId: user ? user.id : null,
      status: "published",
      createdAt: now(),
      selectedWorkerId: null,
      contactsUnlocked: false,
    });
    setJson(STORE.jobs, jobs);
    track("request_step_completed", {
      step_name: "phone",
      city: state.draftRequest.city,
      area: state.draftRequest.area,
      category: state.draftRequest.category,
    });
    track("request_published", {
      job_id: id,
      category: state.draftRequest.category,
      city: state.draftRequest.city,
      area: state.draftRequest.area,
    });
    state.requestStep = 1;
    state.draftRequest = { category: "", description: "", city: "Chisinau", area: "", timeline: "", budget: "", phone: "" };
    location.hash = `#/jobs/${id}`;
  };
}

function renderJobs(app, params) {
  const q = (params.get("q") || "").toLowerCase();
  const city = params.get("city") || "";
  const category = params.get("category") || "";
  const sort = params.get("sort") || "new";

  let jobs = getJson(STORE.jobs).filter((j) => j.status === "published");
  if (city) jobs = jobs.filter((j) => j.city === city);
  if (category) jobs = jobs.filter((j) => j.category === category);
  if (q) jobs = jobs.filter((j) => `${j.description} ${j.category} ${j.area}`.toLowerCase().includes(q));

  const bids = getJson(STORE.bids);
  if (sort === "bids") {
    jobs = [...jobs].sort((a, b) => bids.filter((x) => x.jobId === b.id).length - bids.filter((x) => x.jobId === a.id).length);
  } else {
    jobs = [...jobs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const filterQs = new URLSearchParams();
  if (city) filterQs.set("city", city);
  if (category) filterQs.set("category", category);
  if (q) filterQs.set("q", q);
  if (sort) filterQs.set("sort", sort);

  app.innerHTML = `
    <section class="panel">
      <div class="section-head">
        <h2>${t("jobsTitle")}</h2>
        <a class="btn primary" href="#/request/new">${t("jobsNew")}</a>
      </div>
      <p class="muted">${t("jobsIntro")}</p>
      <form class="filter-bar stack-mt" id="jobFilters">
        <label>${t("jobsSearch")}<input type="search" name="q" value="${escapeHtml(q)}" placeholder="${t("jobsSearchPh")}" /></label>
        <label>${t("jobsCity")}<select name="city"><option value="">${t("jobsCityAll")}</option>${cities.map((c) => `<option value="${c}" ${city === c ? "selected" : ""}>${cityLabel(c)}</option>`).join("")}</select></label>
        <label>${t("jobsCategory")}<select name="category"><option value="">${t("jobsCategoryAll")}</option>${categories.map((c) => `<option value="${escapeHtml(c)}" ${category === c ? "selected" : ""}>${escapeHtml(catLabel(c))}</option>`).join("")}</select></label>
        <label>${t("jobsSort")}<select name="sort"><option value="new" ${sort === "new" ? "selected" : ""}>${t("jobsSortNew")}</option><option value="bids" ${sort === "bids" ? "selected" : ""}>${t("jobsSortBids")}</option></select></label>
        <button class="btn primary" type="submit">${t("jobsApply")}</button>
      </form>
      <div class="grid stack-mt">
        ${jobs.length ? jobs.map((j) => {
          const n = bids.filter((b) => b.jobId === j.id).length;
          return `<article class="card job-row"><div class="job-row-head"><span class="job-cat">${escapeHtml(catLabel(j.category))}</span><span class="job-bids">${n} ${t("jobsBidsAbbr")}</span></div><p>${escapeHtml(j.description.slice(0, 140))}${j.description.length > 140 ? "…" : ""}</p><p class="muted">${escapeHtml(cityLabel(j.city))}, ${escapeHtml(j.area)} · ${escapeHtml(j.budget || t("jobsBudgetNone"))}</p><a class="btn primary" href="#/jobs/${j.id}">${t("jobsOpen")}</a></article>`;
        }).join("") : `<div class="empty-state" role="status"><p class="empty-state__title">${t("jobsEmpty")}</p><a class="btn primary" href="#/request/new">${t("jobsNew")}</a></div>`}
      </div>
    </section>
  `;
  document.getElementById("jobFilters").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const p = new URLSearchParams();
    const qq = String(fd.get("q") || "").trim();
    const cc = String(fd.get("city") || "").trim();
    const cat = String(fd.get("category") || "").trim();
    const s = String(fd.get("sort") || "new").trim();
    if (qq) p.set("q", qq);
    if (cc) p.set("city", cc);
    if (cat) p.set("category", cat);
    if (s) p.set("sort", s);
    const qs = p.toString();
    location.hash = qs ? `#/jobs?${qs}` : "#/jobs";
  };
}

function renderJobCard(app, id) {
  const jobs = getJson(STORE.jobs);
  const job = jobs.find((j) => j.id === id);
  if (!job) {
    app.innerHTML = `<section class="panel"><p>${t("jobNotFound")}</p><a class="btn" href="#/jobs">${t("jobBackList")}</a></section>`;
    return;
  }

  let bids = getJson(STORE.bids).filter((b) => b.jobId === id);
  bids = [...bids].sort((a, b) => parsePriceNum(a.price) - parsePriceNum(b.price));

  const user = authUser();
  const selectedWorker = job.selectedWorkerId ? getJson(STORE.users).find((u) => u.id === job.selectedWorkerId) : null;

  const canUnlockContacts =
    job.selectedWorkerId &&
    user &&
    ((user.role === "client" && user.id === job.clientUserId) ||
      (user.role === "worker" && user.id === job.selectedWorkerId) ||
      user.role === "admin");

  let selectedNotice = "";
  if (job.selectedWorkerId && selectedWorker) {
    selectedNotice = `<p class="notice success">${t("jobSelectedPrefix")} <strong>${escapeHtml(selectedWorker.name)}</strong>. ${t("jobSelectedHint")}</p>`;
    if (canUnlockContacts) {
      selectedNotice += job.contactsUnlocked
        ? `<div class="card stack-mt"><p class="muted"><strong>${t("jobContactHint")}</strong></p><p>${t("jobPhoneClient")}: <a href="${telHref(job.phone)}">${escapeHtml(job.phone || "—")}</a></p><p>${t("jobPhoneWorker")}: <a href="${telHref(selectedWorker.phone)}">${escapeHtml(selectedWorker.phone || "—")}</a></p></div>`
        : `<button type="button" class="btn primary stack-mt" id="unlockContacts">${t("jobRevealContacts")}</button>`;
    }
  }

  const bidRows = bids.map((b) => `
    <tr>
      <td><strong>${escapeHtml(b.workerName)}</strong></td>
      <td>${escapeHtml(b.price || "—")}</td>
      <td>${escapeHtml(b.start || "—")}</td>
      <td class="muted">${escapeHtml((b.comment || "").slice(0, 80))}${(b.comment || "").length > 80 ? "…" : ""}</td>
      <td>${canSelectWorker(user, job) ? `<button type="button" class="btn primary btn-sm select-worker" data-worker="${escapeHtml(b.workerId)}">${t("jobChoose")}</button>` : "—"}</td>
    </tr>
  `).join("");

  app.innerHTML = `
    <section class="panel">
      <div class="section-head">
        <h2>${escapeHtml(catLabel(job.category))}</h2>
        <a class="btn" href="#/jobs">${t("jobAllJobs")}</a>
      </div>
      <p>${escapeHtml(job.description)}</p>
      <p class="muted">${escapeHtml(cityLabel(job.city))}, ${escapeHtml(job.area)} · ${escapeHtml(job.timeline || t("jobTimelineNone"))} · ${escapeHtml(job.budget || t("jobsBudgetNone"))}</p>
      ${selectedNotice}
      <div class="cta-row stack-mt">
        <a class="btn primary" href="#/bid/new?jobId=${encodeURIComponent(job.id)}">${t("jobBidCta")}</a>
        <a class="btn" href="#/workers">${t("jobWorkersLink")}</a>
      </div>
    </section>

    <section class="panel">
      <h3>${t("jobCompareTitle")}</h3>
      <p class="muted">${t("jobCompareHint")}</p>
      ${bids.length ? `
        <div class="table-wrap stack-mt">
          <table class="data-table">
            <thead><tr><th>${t("jobColWorker")}</th><th>${t("jobColPrice")}</th><th>${t("jobColStart")}</th><th>${t("jobColComment")}</th><th>${t("jobColAction")}</th></tr></thead>
            <tbody>${bidRows}</tbody>
          </table>
        </div>
      ` : `<p class="muted stack-mt">${t("jobNoBids")}</p>`}
    </section>
    ${renderReviewForm(job, user)}
  `;

  document.querySelectorAll(".select-worker").forEach((btn) => {
    btn.onclick = () => {
      const wid = btn.dataset.worker;
      const j = jobs.find((x) => x.id === id);
      j.selectedWorkerId = wid;
      j.status = "closed";
      j.contactsUnlocked = false;
      setJson(STORE.jobs, jobs);
      track("worker_selected", {
        job_id: j.id,
        worker_id: wid,
        city: j.city,
        area: j.area,
        category: j.category,
      });
      route();
    };
  });

  const unlockBtn = document.getElementById("unlockContacts");
  if (unlockBtn) {
    unlockBtn.onclick = () => {
      const j = jobs.find((x) => x.id === id);
      if (!j || j.contactsUnlocked) return;
      j.contactsUnlocked = true;
      setJson(STORE.jobs, jobs);
      track("contact_revealed", {
        job_id: j.id,
        worker_id: j.selectedWorkerId,
        city: j.city,
        area: j.area,
        category: j.category,
      });
      route();
    };
  }

  const reviewBtn = document.getElementById("reviewSubmit");
  if (reviewBtn) {
    reviewBtn.onclick = () => {
      const rating = Number(document.getElementById("reviewRating").value);
      const text = document.getElementById("reviewText").value.trim();
      if (!text) return alert(t("alertReviewText"));
      const reviews = getJson(STORE.reviews);
      reviews.unshift({ id: uid("rev"), jobId: job.id, workerId: job.selectedWorkerId, rating, text, createdAt: now(), author: user ? user.name : "Client" });
      setJson(STORE.reviews, reviews);
      track("review_submitted", { job_id: job.id, worker_id: job.selectedWorkerId, rating });
      alert(t("reviewSaved"));
      route();
    };
  }
}

function canSelectWorker(user, job) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "client" && user.id === job.clientUserId && !job.selectedWorkerId;
}

function renderReviewForm(job, user) {
  if (!job.selectedWorkerId || !user || (user.role !== "client" && user.role !== "admin")) return "";
  return `
    <section class="panel">
      <h3>${t("jobReviewTitle")}</h3>
      <label>${t("jobReviewRating")}<select id="reviewRating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label>
      <label>${t("jobReviewText")}<textarea id="reviewText"></textarea></label>
      <button class="btn primary" id="reviewSubmit" type="button">${t("jobReviewSubmit")}</button>
    </section>
  `;
}

function renderGigsCatalog(app, params) {
  const city = params.get("city") || "";
  const category = params.get("category") || "";
  const q = (params.get("q") || "").toLowerCase();

  let gigs = getJson(STORE.gigs).filter((g) => g.active);
  if (city) gigs = gigs.filter((g) => g.city === city);
  if (category) gigs = gigs.filter((g) => g.category === category);
  if (q) gigs = gigs.filter((g) => `${g.title} ${g.description} ${g.category}`.toLowerCase().includes(q));

  gigs = [...gigs].sort((a, b) => (b.featured === true) - (a.featured === true) || a.price - b.price);

  app.innerHTML = `
    <section class="panel">
      <div class="section-head">
        <h2>${t("gigCatalogTitle")}</h2>
        <a class="btn" href="#/account/worker">+ ${t("gigAddForWorkers")}</a>
      </div>
      <p class="muted">${t("gigCatalogIntro")}</p>
      <form class="filter-bar stack-mt" id="gigFilters">
        <label>${t("jobsSearch")}<input type="search" name="q" value="${escapeHtml(q)}" placeholder="${t("gigSearchPh")}" /></label>
        <label>${t("jobsCity")}<select name="city"><option value="">${t("jobsCityAll")}</option>${cities.map((c) => `<option value="${c}" ${city === c ? "selected" : ""}>${cityLabel(c)}</option>`).join("")}</select></label>
        <label>${t("jobsCategory")}<select name="category"><option value="">${t("jobsCategoryAll")}</option>${categories.map((c) => `<option value="${escapeHtml(c)}" ${category === c ? "selected" : ""}>${escapeHtml(catLabel(c))}</option>`).join("")}</select></label>
        <button class="btn primary" type="submit">${t("gigFind")}</button>
      </form>
      <div class="gig-grid stack-mt">
        ${gigs.length ? gigs.map(gigCardHtml).join("") : `<div class="empty-state" role="status"><p class="empty-state__title">${t("gigEmpty")}</p><a class="btn primary" href="#/gigs">${t("homeViewAllGigs")}</a></div>`}
      </div>
    </section>
  `;
  document.getElementById("gigFilters").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const p = new URLSearchParams();
    const qq = String(fd.get("q") || "").trim();
    const cc = String(fd.get("city") || "").trim();
    const cat = String(fd.get("category") || "").trim();
    if (qq) p.set("q", qq);
    if (cc) p.set("city", cc);
    if (cat) p.set("category", cat);
    const qs = p.toString();
    location.hash = qs ? `#/gigs?${qs}` : "#/gigs";
  };
}

function renderGigDetail(app, id) {
  const gigs = getJson(STORE.gigs);
  const g = gigs.find((x) => x.id === id);
  if (!g) return (app.innerHTML = `<section class="panel"><p>Услуга не найдена</p><a class="btn" href="#/gigs">В каталог</a></section>`);
  const w = getJson(STORE.users).find((u) => u.id === g.workerId);
  const includes = (g.includes || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("");
  const user = authUser();

  app.innerHTML = `
    <section class="panel gig-detail">
      <div class="gig-detail-grid">
        <div>
          <span class="path-badge path-badge--accent">Услуга</span>
          <h1>${escapeHtml(g.title)}</h1>
          <p class="muted">${escapeHtml(g.category)} · ${escapeHtml(g.city)}${w ? ` · мастер <a href="#/workers/${w.id}">${escapeHtml(w.name)}</a>` : ""}</p>
          <p class="gig-detail-desc">${escapeHtml(g.description)}</p>
          <h3>Входит в стоимость</h3>
          <ul class="includes-list">${includes || "<li>Уточните у мастера</li>"}</ul>
        </div>
        <aside class="gig-buy-card">
          <div class="gig-buy-price">${g.price} <small>MDL</small></div>
          <p class="muted">Срок: <strong>${g.deliveryDays}</strong> дн.</p>
          <button class="btn primary btn-block" type="button" id="gigOrderBtn">Заказать услугу</button>
          <p class="muted fine-print">Заказ сохраняется в кабинете. Онлайн-оплата и эскроу — отдельный этап (как на зрелых маркетплейсах).</p>
          <a class="btn btn-block" href="#/gigs">← Каталог</a>
        </aside>
      </div>
    </section>
  `;

  document.getElementById("gigOrderBtn").onclick = () => {
    if (!user || user.role === "worker") {
      alert(t("alertGigClient"));
      location.hash = "#/auth";
      return;
    }
    if (user.role !== "client" && user.role !== "admin") {
      alert(t("alertGigRole"));
      return;
    }
    const orders = getJson(STORE.orders);
    orders.unshift({
      id: uid("ord"),
      gigId: g.id,
      gigTitle: g.title,
      workerId: g.workerId,
      clientId: user.id,
      price: g.price,
      status: "new",
      createdAt: now(),
    });
    setJson(STORE.orders, orders);
    track("gig_ordered", { gig_id: g.id, worker_id: g.workerId, city: g.city, category: g.category });
    alert(t("gigOrderOk"));
    location.hash = "#/account/client";
  };
}

function renderWorkers(app, params) {
  const city = params.get("city") || "";
  const category = params.get("category") || "";
  const verifiedOnly = params.get("verified") === "1";

  let workers = getJson(STORE.users).filter((u) => u.role === "worker");
  if (city) workers = workers.filter((w) => w.city === city);
  if (category) workers = workers.filter((w) => (w.category || "") === category);
  if (verifiedOnly) workers = workers.filter((w) => w.verified);

  workers = [...workers].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  app.innerHTML = `
    <section class="panel">
      <div class="section-head">
        <h2>${t("navFind")}</h2>
        <a class="btn" href="#/gigs">${t("navGigs")}</a>
      </div>
      <form class="filter-bar stack-mt" id="workerFilters">
        <label>${t("jobsCity")}<select name="city"><option value="">${t("jobsCityAll")}</option>${cities.map((c) => `<option value="${c}" ${city === c ? "selected" : ""}>${cityLabel(c)}</option>`).join("")}</select></label>
        <label>${t("jobsCategory")}<select name="category"><option value="">${t("jobsCategoryAll")}</option>${categories.map((c) => `<option value="${escapeHtml(c)}" ${category === c ? "selected" : ""}>${escapeHtml(catLabel(c))}</option>`).join("")}</select></label>
        <label class="checkbox-label"><input type="checkbox" name="verified" value="1" ${verifiedOnly ? "checked" : ""} /> ${t("workersVerifiedOnly")}</label>
        <button class="btn primary" type="submit">${t("jobsApply")}</button>
      </form>
      <div class="grid cols-2 stack-mt">
        ${workers.map((w) => `
          <article class="card worker-card">
            <div class="worker-card-head">
              <h3><a href="#/workers/${w.id}">${escapeHtml(w.name)}</a></h3>
              ${w.verified ? '<span class="badge badge-verified">Проверен</span>' : ""}
            </div>
            <p>${escapeHtml(w.category ? catLabel(w.category) : t("workerDefault"))} · ${escapeHtml(cityLabel(w.city || ""))}, ${escapeHtml(w.area || "")}</p>
            <p class="muted">${t("workerRating")} <strong>${w.rating || "—"}</strong> · ${t("workerDone")} ${w.jobsCompleted || 0}</p>
            <p class="worker-bio">${escapeHtml((w.bio || "").slice(0, 120))}${(w.bio || "").length > 120 ? "…" : ""}</p>
            <a class="btn primary" href="#/workers/${w.id}">${t("workerProfile")}</a>
          </article>
        `).join("")}
      </div>
    </section>
  `;
  document.getElementById("workerFilters").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const p = new URLSearchParams();
    const cc = String(fd.get("city") || "").trim();
    const cat = String(fd.get("category") || "").trim();
    if (cc) p.set("city", cc);
    if (cat) p.set("category", cat);
    if (fd.get("verified")) p.set("verified", "1");
    const qs = p.toString();
    location.hash = qs ? `#/workers?${qs}` : "#/workers";
  };
}

function renderWorkerCard(app, id) {
  const w = getJson(STORE.users).find((x) => x.id === id && x.role === "worker");
  if (!w) return (app.innerHTML = `<section class="panel"><p>Мастер не найден</p></section>`);
  const reviews = getJson(STORE.reviews).filter((r) => r.workerId === w.id);
  const gigs = getJson(STORE.gigs).filter((g) => g.workerId === w.id && g.active);
  const tab = state.workerProfileTab || "profile";

  const portfolio = (w.portfolio || []).length
    ? `<div class="portfolio-grid">${(w.portfolio || []).map((p) => `<div class="card portfolio-item"><strong>${escapeHtml(p.title)}</strong><p class="muted">${escapeHtml(p.note || "")}</p></div>`).join("")}</div>`
    : '<p class="muted">Портфолио пока пустое — мастер может добавить работы в кабинете.</p>';

  let body = "";
  if (tab === "profile") {
    body = `<p>${escapeHtml(w.bio || "Мастер готов к заказам в вашем районе.")}</p><p class="muted">Категория: ${escapeHtml(w.category || "—")} · ${escapeHtml(w.city || "")}, ${escapeHtml(w.area || "")}</p>`;
  } else if (tab === "portfolio") {
    body = portfolio;
  } else {
    body = reviews.length ? reviews.map((r) => `<div class="card"><strong>${escapeHtml(r.author)}</strong> (${r.rating}/5)<p>${escapeHtml(r.text)}</p></div>`).join("") : '<p class="muted">Отзывов пока нет.</p>';
  }

  app.innerHTML = `
    <section class="panel">
      <div class="worker-hero">
        <div>
          <h1>${escapeHtml(w.name)}</h1>
          <p class="muted">${escapeHtml(w.category || "Мастер")} · ${escapeHtml(w.city || "")}, ${escapeHtml(w.area || "")}</p>
          <p>Рейтинг <strong>${w.rating || "—"}</strong> · ${w.verified ? "Проверенный исполнитель" : "Профиль не верифицирован"} · ${w.jobsCompleted || 0} работ в портфеле платформы</p>
        </div>
        <div class="cta-row">
          <a class="btn primary" href="#/request/new">Оставить заявку</a>
          <a class="btn" href="#/workers">← Все мастера</a>
        </div>
      </div>
      <div class="tabs">
        <button type="button" class="tab ${tab === "profile" ? "active" : ""}" data-tab="profile">О мастере</button>
        <button type="button" class="tab ${tab === "portfolio" ? "active" : ""}" data-tab="portfolio">Портфолио</button>
        <button type="button" class="tab ${tab === "reviews" ? "active" : ""}" data-tab="reviews">Отзывы (${reviews.length})</button>
      </div>
      <div class="tab-body stack-mt">${body}</div>
    </section>
    ${gigs.length ? `
      <section class="panel">
        <h2>Услуги мастера</h2>
        <div class="gig-grid">${gigs.map(gigCardHtml).join("")}</div>
      </section>
    ` : ""}
  `;

  document.querySelectorAll(".tabs .tab").forEach((btn) => {
    btn.onclick = () => {
      state.workerProfileTab = btn.dataset.tab;
      route();
    };
  });
}

function renderForWorkers(app) {
  app.innerHTML = `
    <section class="panel">
      <h2>${t("navForWorkers")}</h2>
      <p class="muted">На MASTER вы совмещаете две модели заработка: <strong>отклики на заявки</strong> (биржа) и <strong>свои услуги с ценой</strong> (каталог).</p>
      <div class="path-cards stack-mt">
        <div class="path-card">
          <h3>Отклики на заказы</h3>
          <p class="muted">Смотрите ленту заявок по городу и категории, отправляйте цену и сроки.</p>
          <a class="btn primary" href="#/jobs">Лента заказов</a>
        </div>
        <div class="path-card">
          <h3>Карточки услуг</h3>
          <p class="muted">Оформите типовые работы пакетом — клиенты заказывают без длинного тендера.</p>
          <a class="btn primary" href="#/account/worker">Кабинет мастера</a>
        </div>
      </div>
    </section>
  `;
}

function renderPricing(app) {
  app.innerHTML = `
    <section class="panel">
      <h2>${t("navPricing")}</h2>
      <div class="grid cols-2">
        <div class="card"><h3>PRO-профиль</h3><p>199–299 MDL / мес — выше в поиске и в заявках.</p></div>
        <div class="card"><h3>Пакет откликов</h3><p>99–149 MDL за пакет — удобно при активной бирже.</p></div>
        <div class="card"><h3>Поднятие услуги</h3><p>49–79 MDL / 7 дней — как «продвижение» карточки в каталоге.</p></div>
      </div>
      <p class="muted stack-mt">Оплата только за инструменты платформы; договор на работы — между вами и заказчиком.</p>
    </section>
  `;
}

function renderReviews(app) {
  const reviews = getJson(STORE.reviews);
  app.innerHTML = `
    <section class="panel">
      <h2>${t("navReviews")}</h2>
      ${reviews.length ? reviews.map((r) => `<div class="card stack-mt"><strong>${escapeHtml(r.author)}</strong> (${r.rating}/5)<p>${escapeHtml(r.text)}</p></div>`).join("") : '<p class="muted">Пока нет отзывов.</p>'}
    </section>
  `;
}

function renderAuth(app) {
  app.innerHTML = `
    <section class="panel">
      <h2>${t("authTitle")}</h2>
      <p class="muted">${t("authHint")}</p>
      <label>${t("authPhone")}<input id="authPhone" placeholder="+373…" /></label>
      <label>${t("authName")}<input id="authName" placeholder="${t("authNamePh")}" /></label>
      <label>${t("authRole")}<select id="authRole"><option value="client">${t("authRoleClient")}</option><option value="worker">${t("authRoleWorker")}</option><option value="admin">${t("authRoleAdmin")}</option></select></label>
      <div class="cta-row stack-mt">
        <button class="btn" type="button" id="authOtp">${t("authOtp")}</button>
        <button class="btn primary" type="button" id="authLogin">${t("authLogin")}</button>
      </div>
    </section>
  `;
  document.getElementById("authOtp").onclick = () => alert("OTP (demo): 1111");
  document.getElementById("authLogin").onclick = () => {
    const phone = document.getElementById("authPhone").value.trim();
    const name = document.getElementById("authName").value.trim() || (state.lang === "ro" ? "Utilizator" : "Пользователь");
    const role = document.getElementById("authRole").value;
    if (!phone) return alert(t("alertAuthPhone"));
    const users = getJson(STORE.users);
    let user = users.find((u) => u.phone === phone);
    let isNew = false;
    if (!user) {
      isNew = true;
      user = {
        id: uid("u"),
        phone,
        role,
        name,
        verified: role !== "worker",
        city: "Chisinau",
        area: "Centru",
        rating: 0,
        bio: "",
        portfolio: [],
        jobsCompleted: 0,
        category: role === "worker" ? "Электрика" : "",
      };
      users.push(user);
      setJson(STORE.users, users);
    }
    localStorage.setItem(STORE.auth, JSON.stringify({ userId: user.id }));
    if (isNew && user.role === "worker") {
      track("worker_signup_completed", { city: user.city, category: user.category });
    }
    location.hash = user.role === "worker" ? "#/account/worker" : "#/account/client";
  };
}

function renderClientCabinet(app) {
  const user = authUser();
  if (!user) return (location.hash = "#/auth");
  const jobs = getJson(STORE.jobs).filter((j) => j.clientUserId === user.id);
  const orders = getJson(STORE.orders).filter((o) => o.clientId === user.id);

  app.innerHTML = `
    <section class="panel">
      <h2>Кабинет заказчика</h2>
      <p class="muted">Заявки на бирже и заказы услуг из каталога — раздельно, как на комбинированных площадках.</p>
      <a class="btn primary" href="#/request/new">Новая заявка</a>
      <a class="btn" href="#/gigs">Каталог услуг</a>
    </section>
    <section class="panel">
      <h3>Мои заявки (биржа)</h3>
      <div class="grid stack-mt">
        ${jobs.length ? jobs.map((j) => `<article class="card"><strong>${escapeHtml(j.category)}</strong><p class="muted">${escapeHtml(j.area)}</p><a class="btn" href="#/jobs/${j.id}">Открыть</a></article>`).join("") : '<p class="muted">Пока нет заявок.</p>'}
      </div>
    </section>
    <section class="panel">
      <h3>Заказы услуг (каталог)</h3>
      <div class="grid stack-mt">
        ${orders.length ? orders.map((o) => `<article class="card"><strong>${escapeHtml(o.gigTitle)}</strong><p class="muted">${o.price} MDL · ${escapeHtml(o.status)} · ${escapeHtml(o.createdAt.slice(0, 10))}</p></article>`).join("") : '<p class="muted">Заказов услуг пока нет — выберите услугу в каталоге.</p>'}
      </div>
    </section>
  `;
}

function trySendBid(u) {
  const jobEl = document.getElementById("bidJob");
  const priceEl = document.getElementById("bidPrice");
  const commentEl = document.getElementById("bidComment");
  const startEl = document.getElementById("bidStart");
  if (!jobEl || !priceEl || !commentEl || !startEl) return;
  const bid = {
    id: uid("bid"),
    jobId: jobEl.value,
    workerId: u.id,
    workerName: u.name,
    price: priceEl.value.trim(),
    comment: commentEl.value.trim(),
    start: startEl.value.trim(),
    createdAt: now(),
  };
  if (!bid.price || !bid.comment) return alert(t("alertBidFields"));
  const bids = getJson(STORE.bids);
  if (bids.some((b) => b.jobId === bid.jobId && b.workerId === bid.workerId)) return alert(t("alertBidDup"));
  const prevCount = bids.filter((b) => b.jobId === bid.jobId).length;
  bids.unshift(bid);
  setJson(STORE.bids, bids);
  const jobs = getJson(STORE.jobs);
  const job = jobs.find((j) => j.id === bid.jobId);
  track("bid_sent", {
    job_id: bid.jobId,
    worker_id: bid.workerId,
    city: job ? job.city : null,
    area: job ? job.area : null,
    category: job ? job.category : null,
  });
  if (prevCount === 0) {
    track("first_bid_received_for_request", {
      job_id: bid.jobId,
      city: job ? job.city : null,
      area: job ? job.area : null,
      category: job ? job.category : null,
    });
  }
  alert(t("bidSent"));
}

function renderBidNew(app, params) {
  const user = authUser();
  if (!user || (user.role !== "worker" && user.role !== "admin")) {
    app.innerHTML = `<section class="panel"><p>${t("bidNeedWorker")}</p><div class="cta-row"><a class="btn primary" href="#/auth">${t("navLogin")}</a><a class="btn" href="#/jobs">${t("navJobs")}</a></div></section>`;
    return;
  }
  const u = getJson(STORE.users).find((x) => x.id === user.id) || user;
  const wantId = params.get("jobId") || "";
  const jobs = getJson(STORE.jobs).filter((j) => j.status === "published");
  if (!jobs.length) {
    app.innerHTML = `<section class="panel"><p class="muted">${t("bidNeedJob")}</p><a class="btn primary" href="#/jobs">${t("navJobs")}</a></section>`;
    return;
  }
  const picked = wantId && jobs.some((j) => j.id === wantId) ? wantId : jobs[0].id;

  app.innerHTML = `
    <section class="panel">
      <h2>${t("bidPageTitle")}</h2>
      <p class="muted">${t("bidPageIntro")}</p>
      <label>${t("bidPickJob")}<select id="bidJob">${jobs.map((j) => `<option value="${escapeHtml(j.id)}" ${j.id === picked ? "selected" : ""}>${escapeHtml(catLabel(j.category))} · ${escapeHtml(j.area)}</option>`).join("")}</select></label>
      <label>${t("bidPrice")}<input id="bidPrice" placeholder="${t("bidPricePh")}" /></label>
      <label>${t("bidComment")}<textarea id="bidComment" rows="2"></textarea></label>
      <label>${t("bidStart")}<input id="bidStart" placeholder="${t("bidStartPh")}" /></label>
      <div class="cta-row stack-mt">
        <button class="btn primary" type="button" id="sendBid">${t("bidSend")}</button>
        <a class="btn" href="#/jobs/${escapeHtml(picked)}">${t("bidBack")}</a>
      </div>
    </section>
  `;
  document.getElementById("sendBid").onclick = () => trySendBid(u);
}

function renderWorkerCabinet(app) {
  const user = authUser();
  if (!user) return (location.hash = "#/auth");
  if (user.role !== "worker" && user.role !== "admin") return (location.hash = "#/auth");

  const u = getJson(STORE.users).find((x) => x.id === user.id) || user;
  const myGigs = getJson(STORE.gigs).filter((g) => g.workerId === u.id);
  const jobs = getJson(STORE.jobs).filter((j) => j.status === "published");
  const myBids = getJson(STORE.bids).filter((b) => b.workerId === u.id);

  const portfolioLines = (u.portfolio || []).map((p) => `${p.title}|${p.note || ""}`).join("\n");

  app.innerHTML = `
    <section class="panel">
      <h2>Кабинет мастера</h2>
      <p class="muted">Заполните профиль и добавьте услуги — так вы используете обе ветки платформы.</p>
      <h3>Профиль</h3>
      <div class="grid cols-2">
        <label>Имя<input id="wName" value="${escapeHtml(u.name || "")}" /></label>
        <label>Категория<select id="wCat">${categories.map((c) => `<option ${(u.category || "") === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}</select></label>
        <label>Город<select id="wCity">${cities.map((c) => `<option ${(u.city || "") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
        <label>Район<input id="wArea" value="${escapeHtml(u.area || "")}" /></label>
      </div>
      <label>О себе<textarea id="wBio" rows="3">${escapeHtml(u.bio || "")}</textarea></label>
      <label>Портфолио (каждая строка: <code>Название|краткое описание</code>)<textarea id="wPortfolio" rows="4" placeholder="Квартира Rîșcani|Замена автоматов">${escapeHtml(portfolioLines)}</textarea></label>
      <button class="btn primary" type="button" id="saveWorker">Сохранить профиль</button>
    </section>

    <section class="panel">
      <h3>Мои услуги (каталог)</h3>
      <div class="grid stack-mt">
        ${myGigs.length ? myGigs.map((g) => `<article class="card"><strong>${escapeHtml(g.title)}</strong><p class="muted">${g.price} MDL · ${g.deliveryDays} дн.</p><a class="btn" href="#/gigs/${g.id}">Просмотр</a></article>`).join("") : '<p class="muted">У вас пока нет услуг в каталоге.</p>'}
      </div>
      <h4 class="stack-mt">Добавить услугу</h4>
      <div class="grid cols-2">
        <label>Название<input id="ngTitle" placeholder="Например: Монтаж унитаза" /></label>
        <label>Цена, MDL<input id="ngPrice" type="number" min="1" placeholder="1500" /></label>
        <label>Срок, дней<input id="ngDays" type="number" min="1" placeholder="3" /></label>
        <label>Категория<select id="ngCat">${categories.map((c) => `<option>${escapeHtml(c)}</option>`).join("")}</select></label>
      </div>
      <label>Описание<textarea id="ngDesc" rows="2"></textarea></label>
      <label>Что входит (через запятую)<input id="ngInc" placeholder="Выезд, уборка, фото отчёт" /></label>
      <label class="checkbox-label"><input type="checkbox" id="ngFeat" /> Показывать в блоке «популярные»</label>
      <button class="btn primary" type="button" id="addGig">Опубликовать услугу</button>
    </section>

    <section class="panel">
      <h3>Отклики на бирже</h3>
      <p class="muted">Отправлено откликов: ${myBids.length}</p>
      <label>${t("bidPickJob")}<select id="bidJob">${jobs.length ? jobs.map((j) => `<option value="${j.id}">${escapeHtml(catLabel(j.category))} · ${escapeHtml(j.area)}</option>`).join("") : '<option value="">—</option>'}</select></label>
      <label>${t("bidPrice")}<input id="bidPrice" placeholder="${t("bidPricePh")}" /></label>
      <label>${t("bidComment")}<textarea id="bidComment" rows="2"></textarea></label>
      <label>${t("bidStart")}<input id="bidStart" placeholder="${t("bidStartPh")}" /></label>
      <button class="btn primary stack-mt" type="button" id="sendBid" ${jobs.length ? "" : "disabled"}>${t("bidSend")}</button>
    </section>
  `;

  document.getElementById("saveWorker").onclick = () => {
    const users = getJson(STORE.users);
    const idx = users.findIndex((x) => x.id === u.id);
    const lines = document.getElementById("wPortfolio").value.split("\n").map((l) => l.trim()).filter(Boolean);
    const portfolio = lines.map((line) => {
      const [title, note] = line.split("|");
      return { title: (title || "").trim(), note: (note || "").trim() };
    }).filter((p) => p.title);
    users[idx] = {
      ...users[idx],
      name: document.getElementById("wName").value.trim(),
      category: document.getElementById("wCat").value,
      city: document.getElementById("wCity").value,
      area: document.getElementById("wArea").value.trim(),
      bio: document.getElementById("wBio").value.trim(),
      portfolio,
    };
    setJson(STORE.users, users);
    track("worker_profile_completed", { category: users[idx].category, city: users[idx].city });
    alert(t("profileSaved"));
  };

  document.getElementById("addGig").onclick = () => {
    const title = document.getElementById("ngTitle").value.trim();
    const price = Number(document.getElementById("ngPrice").value);
    const deliveryDays = Number(document.getElementById("ngDays").value);
    const description = document.getElementById("ngDesc").value.trim();
    const category = document.getElementById("ngCat").value;
    const includes = document.getElementById("ngInc").value.split(",").map((s) => s.trim()).filter(Boolean);
    if (!title || !description || !price || !deliveryDays) return alert("Заполните название, описание, цену и срок");
    const gigs = getJson(STORE.gigs);
    const newGigId = uid("gig");
    gigs.unshift({
      id: newGigId,
      workerId: u.id,
      title,
      category,
      city: u.city || "Chisinau",
      price,
      deliveryDays,
      description,
      includes,
      featured: !!document.getElementById("ngFeat").checked,
      active: true,
    });
    setJson(STORE.gigs, gigs);
    track("gig_created", { gig_id: newGigId, worker_id: u.id, city: u.city || "Chisinau", category });
    alert(t("gigAdded"));
    route();
  };

  document.getElementById("sendBid").onclick = () => {
    if (!jobs.length) return;
    trySendBid(u);
  };
}

function renderAdmin(app) {
  const user = authUser();
  if (!user || user.role !== "admin") {
    return (app.innerHTML = `<section class="panel"><p>Доступ только для admin.</p><a class="btn primary" href="#/auth">Войти</a></section>`);
  }
  const jobs = getJson(STORE.jobs);
  const bids = getJson(STORE.bids);
  const gigs = getJson(STORE.gigs);
  const mod = getJson(STORE.mod);
  const events = getJson(STORE.events).slice(-30).reverse();
  const m = metricSnapshot();

  app.innerHTML = `
    <section class="panel">
      <h2>Админка</h2>
      <div class="kpi">${kpiCards()}</div>
      <p class="muted">Ликвидность (цель MVP 25–35%): <strong>${m.liquidity}%</strong></p>
      <h3>Заявки</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>ID</th><th>Категория</th><th>Район</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            ${jobs.map((j) => `<tr><td class="muted">${escapeHtml(j.id)}</td><td>${escapeHtml(j.category)}</td><td>${escapeHtml(j.area)}</td><td>${escapeHtml(j.status)}</td><td>${j.status === "blocked" ? "" : `<button type="button" class="btn btn-sm block-job" data-id="${escapeHtml(j.id)}">Блок</button>`}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      <h3 class="stack-mt">Услуги</h3>
      <p class="muted">Всего: ${gigs.length}</p>
      <h3 class="stack-mt">Отклики</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>ID</th><th>Job</th><th>Мастер</th><th>Цена</th></tr></thead>
          <tbody>${bids.map((b) => `<tr><td class="muted">${escapeHtml(b.id)}</td><td>${escapeHtml(b.jobId)}</td><td>${escapeHtml(b.workerName)}</td><td>${escapeHtml(b.price)}</td></tr>`).join("")}</tbody>
        </table>
      </div>
      <h3 class="stack-mt">Логи модерации</h3>
      ${mod.length ? mod.map((x) => `<div class="card">${escapeHtml(x.action)} · ${escapeHtml(x.entityId)} · ${escapeHtml(x.at)}</div>`).join("") : '<p class="muted">Пусто</p>'}
      <h3 class="stack-mt">События</h3>
      <div class="table-wrap">
        <table class="data-table"><thead><tr><th>Event</th><th>At</th></tr></thead><tbody>${events.map((e) => `<tr><td>${escapeHtml(e.event)}</td><td class="muted">${escapeHtml(e.at)}</td></tr>`).join("")}</tbody></table>
      </div>
    </section>
  `;

  document.querySelectorAll(".block-job").forEach((btn) => {
    btn.onclick = () => {
      const jid = btn.dataset.id;
      const updated = jobs.map((j) => (j.id === jid ? { ...j, status: "blocked" } : j));
      setJson(STORE.jobs, updated);
      const logs = getJson(STORE.mod);
      logs.unshift({ id: uid("mod"), action: "block_job", entityId: jid, at: now() });
      setJson(STORE.mod, logs);
      track("admin_block_action", { entity_type: "job", entity_id: jid, reason: "moderation_block" });
      route();
    };
  });
}

function renderLegal(app, section) {
  const map = {
    terms: "Пользовательское соглашение: MASTER — информационный сервис; договор на работы — между заказчиком и мастером.",
    privacy: "Политика: минимизация данных, OTP, журналы модерации и разграничение доступа.",
    moderation: "Модерация: запрет фрода, спама, оскорблений и вводящих в заблуждение услуг.",
    reviews: "Отзывы публикуются после сделки; запрещены оскорбления и персональные данные третьих лиц.",
  };
  app.innerHTML = `<section class="panel"><h2>${escapeHtml(section)}</h2><p>${map[section] || "Раздел не найден."}</p><a class="btn" href="#/support">Поддержка</a></section>`;
}

function renderSupport(app) {
  app.innerHTML = `
    <section class="panel">
      <h2>FAQ и поддержка</h2>
      <div class="card"><strong>В чём разница «Заказы» и «Услуги»?</strong><p><strong>Заказы</strong> — биржа: вы описываете задачу, мастера откликаются своими ценами. <strong>Услуги</strong> — фикс: цена и объём заранее заданы мастером.</p></div>
      <div class="card stack-mt"><strong>Как выбрать мастера по заявке?</strong><p>Откройте карточку заявки, сравните таблицу откликов и нажмите «Выбрать».</p></div>
      <div class="card stack-mt"><strong>Оплата через сайт?</strong><p>В этой версии — учёт заказов услуг в кабинете; подключение эквайринга (maib / Paynet и т.д.) — следующий этап.</p></div>
    </section>
  `;
}

const langBtn = document.getElementById("langToggle");
if (langBtn) {
  langBtn.addEventListener("click", () => {
    state.lang = state.lang === "ru" ? "ro" : "ru";
    localStorage.setItem(STORE.lang, state.lang);
    applyI18n();
    route();
  });
}

function initNavigation() {
  const toggle = document.getElementById("navToggle");
  const backdrop = document.getElementById("navBackdrop");
  if (!toggle || !backdrop) return;

  const close = () => {
    document.body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    backdrop.hidden = true;
    backdrop.setAttribute("aria-hidden", "true");
  };
  const open = () => {
    document.body.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");
    backdrop.hidden = false;
    backdrop.setAttribute("aria-hidden", "false");
  };

  toggle.addEventListener("click", () => {
    if (document.body.classList.contains("nav-open")) close();
    else open();
  });
  backdrop.addEventListener("click", close);
  window.addEventListener("hashchange", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  document.querySelectorAll("#site-navigation a, a.header-cta").forEach((a) => {
    a.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 1024px)").matches) close();
    });
  });
}

seed();
seedGigs();
initNavigation();
window.addEventListener("hashchange", route);
applyI18n();
route();
