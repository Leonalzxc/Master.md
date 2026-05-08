'use client';

import dynamic from 'next/dynamic';
import type { LocationPickerMapProps } from './LocationPickerMap';

const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 260,
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-md)',
        border: '1.5px solid var(--glass-border-strong)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>🗺️ Загрузка карты…</span>
    </div>
  ),
});

export default function LocationPicker(props: LocationPickerMapProps) {
  return <LocationPickerMap {...props} />;
}
