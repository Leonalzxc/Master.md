'use client';
import { useState } from 'react';
import { createTelegramLink } from '@/app/actions/telegramLink';
export default function TelegramConnection({locale,connected}:{locale:string;connected:boolean}) {
  const [url,setUrl]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState(false);
  const ru=locale==='ru';
  async function prepare() {
    setLoading(true);setError(false);setUrl('');
    try { const result=await createTelegramLink();if(result.ok)setUrl(result.url);else setError(true); }
    catch {setError(true);} finally {setLoading(false);}
  }
  return <section className="card p-5 flex flex-col gap-3">
    <h2 className="font-semibold">Telegram {connected ? (ru ? '· подключён' : '· conectat') : ''}</h2>
    <p className="text-sm">{ru ? 'Одноразовая ссылка действует 10 минут. В боте нажмите Start. Для отключения отправьте /stop.' : 'Linkul unic este valabil 10 minute. Apăsați Start în bot. Pentru deconectare trimiteți /stop.'}</p>
    <button type="button" className="btn-secondary" onClick={prepare} disabled={loading}>{loading ? '…' : (ru ? 'Создать ссылку подключения' : 'Creează linkul de conectare')}</button>
    {url && <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary">{ru ? 'Открыть Telegram' : 'Deschide Telegram'}</a>}
    {error && <p role="alert" className="text-sm" style={{color:'var(--danger)'}}>{ru ? 'Ссылка недоступна. Попробуйте позже; уведомления на сайте продолжают работать.' : 'Link indisponibil. Reîncercați mai târziu; notificările pe site funcționează în continuare.'}</p>}
  </section>;
}
