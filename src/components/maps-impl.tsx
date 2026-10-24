"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useRouter } from "next/navigation";

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const pricePin = (label: string, muted: boolean) =>
  L.divIcon({
    className: "eber-pin",
    html: `<div style="transform:translate(-50%,-100%);display:inline-flex;flex-direction:column;align-items:center">
      <div style="background:${muted ? "#1e2321" : "#2ee88a"};color:${muted ? "#a1aaa5" : "#03140b"};font:700 12px/1 Inter,system-ui;padding:6px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,.5);border:1px solid ${muted ? "#343c38" : "#5ef5a6"}">${label}</div>
      <div style="width:2px;height:6px;background:${muted ? "#343c38" : "#2ee88a"}"></div></div>`,
    iconSize: [0, 0],
  });

const exactPin = L.divIcon({
  className: "eber-pin",
  html: `<div style="transform:translate(-50%,-100%)"><svg width="30" height="38" viewBox="0 0 30 38"><path d="M15 0C6.7 0 0 6.6 0 14.8 0 26 15 38 15 38s15-12 15-23.2C30 6.6 23.3 0 15 0Z" fill="#2ee88a"/><circle cx="15" cy="14.5" r="5.5" fill="#03140b"/></svg></div>`,
  iconSize: [0, 0],
});

function FitBounds({ points, center }: { points: [number, number][]; center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(L.latLngBounds([...points, center]).pad(0.15), { maxZoom: 15 });
    else map.setView(center, 13);
  }, [map, points, center]);
  return null;
}

export type MapPoint = { id: string; lat: number; lng: number; label: string; muted?: boolean };

export function ResultsMapImpl({ center, points, radiusKm, query }: { center: [number, number]; points: MapPoint[]; radiusKm: number; query?: string }) {
  const router = useRouter();
  return (
    <MapContainer center={center} zoom={13} className="size-full" scrollWheelZoom attributionControl>
      <TileLayer url={TILES} attribution={ATTR} className="eber-tiles" />
      <Circle center={center} radius={radiusKm * 1000} pathOptions={{ color: "#2ee88a", weight: 1, opacity: 0.35, fillOpacity: 0.03, dashArray: "4 6" }} />
      <CircleMarker center={center} radius={7} pathOptions={{ color: "#03140b", weight: 3, fillColor: "#62b0ff", fillOpacity: 1 }} />
      {points.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={pricePin(p.label, Boolean(p.muted))}
          eventHandlers={{ click: () => router.push(`/chargers/${p.id}${query ? `?${query}` : ""}`) }}
        />
      ))}
      <FitBounds points={points.map((p) => [p.lat, p.lng])} center={center} />
    </MapContainer>
  );
}

/** Approximate area (circle) or exact pin. */
export function AreaMapImpl({ lat, lng, radiusM, exact }: { lat: number; lng: number; radiusM?: number; exact?: boolean }) {
  return (
    <MapContainer center={[lat, lng]} zoom={exact ? 16 : 14} className="size-full" scrollWheelZoom={false}>
      <TileLayer url={TILES} attribution={ATTR} className="eber-tiles" />
      {exact ? (
        <Marker position={[lat, lng]} icon={exactPin} />
      ) : (
        <Circle center={[lat, lng]} radius={radiusM ?? 600} pathOptions={{ color: "#2ee88a", weight: 1.5, fillColor: "#2ee88a", fillOpacity: 0.12 }} />
      )}
    </MapContainer>
  );
}

function ClickToSet({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }, [map, lat, lng]);
  return null;
}

export function PinPickerImpl({ lat, lng, onPick }: { lat: number; lng: number; onPick: (lat: number, lng: number) => void }) {
  return (
    <MapContainer center={[lat, lng]} zoom={15} className="size-full" scrollWheelZoom>
      <TileLayer url={TILES} attribution={ATTR} className="eber-tiles" />
      <Marker
        position={[lat, lng]}
        icon={exactPin}
        draggable
        eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onPick(p.lat, p.lng); } }}
      />
      <ClickToSet onPick={onPick} />
      <Recenter lat={lat} lng={lng} />
    </MapContainer>
  );
}
