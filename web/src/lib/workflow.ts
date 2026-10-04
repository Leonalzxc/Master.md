export const workflowErrors = ['not_authenticated','not_authorized','account_blocked','invalid_bid','invalid_state','invalid_input','temporarily_unavailable'] as const;
export type WorkflowError = typeof workflowErrors[number];
export type WorkflowResult<T> = { ok: true; data: T } | { ok: false; error: WorkflowError };
export function workflowErrorText(error: WorkflowError, locale: string) {
  const text: Record<WorkflowError, [string,string]> = {
    not_authenticated: ['Войдите в аккаунт', 'Autentificați-vă'],
    not_authorized: ['Нет доступа к этой заявке', 'Nu aveți acces la această cerere'],
    account_blocked: ['Аккаунт заблокирован. Обратитесь в поддержку.', 'Contul este blocat. Contactați asistența.'],
    invalid_bid: ['Этот отклик нельзя выбрать', 'Această ofertă nu poate fi selectată'],
    invalid_state: ['Заявка уже изменилась. Обновите страницу.', 'Cererea s-a schimbat. Reîncărcați pagina.'],
    invalid_input: ['Проверьте введённые данные', 'Verificați datele introduse'],
    temporarily_unavailable: ['Сервис временно недоступен. Повторите позже.', 'Serviciul este temporar indisponibil. Reîncercați mai târziu.'],
  };
  return text[error][locale === 'ro' ? 1 : 0];
}
