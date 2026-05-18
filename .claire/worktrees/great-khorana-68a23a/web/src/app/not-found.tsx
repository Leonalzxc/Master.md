import Link from 'next/link';

export default function RootNotFound() {
  return (
    <html lang="ru">
      <body style={{ margin: 0, background: '#0b1628', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#fff', padding: '32px 16px' }}>
          <div style={{ fontSize: '6rem', fontWeight: 900, lineHeight: 1, background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            404
          </div>
          <p style={{ marginTop: 12, marginBottom: 24, color: 'rgba(255,255,255,.6)', fontSize: 16 }}>
            Страница не найдена · Pagina nu a fost găsită
          </p>
          <Link href="/ru" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: 15, border: '1px solid rgba(56,189,248,.4)', borderRadius: 8, padding: '8px 20px' }}>
            На главную
          </Link>
        </div>
      </body>
    </html>
  );
}
