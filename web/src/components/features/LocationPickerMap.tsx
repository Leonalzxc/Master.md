'use client';
import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PILOT_CENTER, PILOT_BOUNDS, PILOT_CITY, isPilotLocation } from '@/lib/pilot';
export interface LocationPickerMapProps {
  lat: number | null; lng: number | null;
  onPick: (lat: number, lng: number, area: string, city: string) => void;
  locale: string;
}
function MapControl({ lat, lng, onPick }: Pick<LocationPickerMapProps, 'lat' | 'lng'> & {onPick: (lat: number,lng: number) => void}) {
  const map = useMap();
  useMapEvents({ click: event => onPick(event.latlng.lat,event.latlng.lng) });
  useEffect(() => { if (lat !== null && lng !== null) map.flyTo([lat,lng],Math.max(map.getZoom(),14),{duration:0.35}); },[lat,lng,map]);
  return null;
}
const pin = L.divIcon({ html: '<div style="width:20px;height:20px;background:#0ea5e9;border:3px solid white;border-radius:50%;box-shadow:0 1px 6px #333"></div>', iconSize:[20,20],iconAnchor:[10,10],className:'' });
export default function LocationPickerMap({lat,lng,onPick,locale}: LocationPickerMapProps) {
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const version = useRef(0);
  useEffect(() => () => { version.current++; },[]);
  const pick = (a: number,b: number) => {
    if (!isPilotLocation(a,b)) { setError(locale === 'ru' ? 'Пилот доступен в Бельцах. Выберите точку в зоне карты.' : 'Pilotul este disponibil în Bălți. Alegeți un punct în zona hărții.'); return; }
    setError(''); onPick(a,b,'',PILOT_CITY);
  };
  function gps() {
    if (!navigator.geolocation) { setError(locale === 'ru' ? 'GPS недоступен. Отметьте место вручную.' : 'GPS indisponibil. Marcați locul manual.'); return; }
    const request=++version.current; setLoading(true); setError('');
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== version.current) return;
      pick(position.coords.latitude,position.coords.longitude); setLoading(false);
    }, () => {
      if (request !== version.current) return;
      setError(locale === 'ru' ? 'Не удалось определить место. Отметьте его вручную.' : 'Locația nu a putut fi determinată. Marcați-o manual.'); setLoading(false);
    },{timeout:10000,maximumAge:0,enableHighAccuracy:true});
  }
  return <div>
    <div className="rounded-xl overflow-hidden border" style={{isolation:'isolate'}}>
      <MapContainer center={PILOT_CENTER} zoom={13} maxBounds={PILOT_BOUNDS} maxBoundsViscosity={1} minZoom={11} style={{height:280,width:'100%'}}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapControl lat={lat} lng={lng} onPick={(a,b) => { version.current++; setLoading(false); pick(a,b); }} />
        {lat !== null && lng !== null && <Marker position={[lat,lng]} icon={pin} />}
      </MapContainer>
    </div>
    <div className="flex flex-wrap gap-2 items-center justify-between mt-3">
      <p className="text-xs">{lat !== null ? (locale === 'ru' ? 'Точка выбрана · проверьте положение' : 'Punct selectat · verificați poziția') : (locale === 'ru' ? 'Нажмите на карту' : 'Apăsați pe hartă')}</p>
      <button type="button" className="btn-secondary" disabled={loading} onClick={gps}>{loading ? '…' : (locale === 'ru' ? 'Определить по GPS' : 'Detectează prin GPS')}</button>
    </div>
    {error && <p role="alert" className="text-sm mt-2" style={{color:'var(--danger)'}}>{error}</p>}
  </div>;
}
