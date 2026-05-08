'use client';

import { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L, { type LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';

const CENTER: [number, number] = [47.7617, 27.9297];
const BOUNDS: [[number, number], [number, number]] = [[47.68, 27.82], [47.83, 28.02]];

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ru`,
    );
    const d = await res.json();
    const a = d.address ?? {};
    return a.suburb ?? a.neighbourhood ?? a.city_district ?? a.quarter ?? a.county ?? 'Бельцы';
  } catch {
    return 'Бельцы';
  }
}

function MapClick({ onPick }: { onPick: (ll: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng) });
  return null;
}

export interface LocationPickerMapProps {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number, area: string) => void;
  locale: string;
}

export default function LocationPickerMap({ lat, lng, onPick, locale }: LocationPickerMapProps) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  useEffect(() => {
    // Fix webpack-broken default icon paths
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  const pinIcon = L.divIcon({
    html: `<div style="width:22px;height:32px"><div style="width:22px;height:22px;background:#0ea5e9;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.35)"></div></div>`,
    iconSize: [22, 32],
    iconAnchor: [11, 32],
    className: '',
  });

  const handleClick = useCallback(async (ll: LatLng) => {
    const area = await reverseGeocode(ll.lat, ll.lng);
    onPick(ll.lat, ll.lng, area);
  }, [onPick]);

  const handleGps = () => {
    if (!navigator.geolocation) {
      setGpsError(locale === 'ru' ? 'GPS недоступен в браузере' : 'GPS indisponibil');
      return;
    }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const area = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        onPick(pos.coords.latitude, pos.coords.longitude, area);
        setGpsLoading(false);
      },
      () => {
        setGpsError(locale === 'ru'
          ? 'Не удалось определить местоположение'
          : 'Locația nu a putut fi determinată');
        setGpsLoading(false);
      },
      { timeout: 10000 },
    );
  };

  return (
    <div>
      <div style={{
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1.5px solid var(--glass-border-strong)',
      }}>
        <MapContainer
          center={lat !== null && lng !== null ? [lat, lng] : CENTER}
          zoom={13}
          maxBounds={BOUNDS}
          maxBoundsViscosity={0.7}
          style={{ height: 260, width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClick onPick={handleClick} />
          {lat !== null && lng !== null && (
            <Marker position={[lat, lng]} icon={pinIcon} />
          )}
        </MapContainer>
      </div>

      <div className="flex items-center justify-between gap-2 mt-2">
        <p style={{ fontSize: 12, color: lat !== null ? 'var(--success)' : 'var(--text-muted)', lineHeight: 1.4 }}>
          {lat !== null
            ? `📍 ${lat.toFixed(5)}, ${lng!.toFixed(5)}`
            : (locale === 'ru'
                ? '👆 Нажмите на карту чтобы отметить место'
                : '👆 Apăsați pe hartă pentru a marca locul')}
        </p>
        <button
          type="button"
          onClick={handleGps}
          disabled={gpsLoading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            height: 32, padding: '0 12px',
            border: '1.5px solid var(--glass-border-strong)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-elevated)',
            color: 'var(--text)', fontSize: 12, fontWeight: 600,
            cursor: gpsLoading ? 'not-allowed' : 'pointer',
            opacity: gpsLoading ? 0.6 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {gpsLoading ? '⏳' : '📡'} {locale === 'ru' ? 'Моё место' : 'Locul meu'}
        </button>
      </div>
      {gpsError && (
        <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{gpsError}</p>
      )}
    </div>
  );
}
