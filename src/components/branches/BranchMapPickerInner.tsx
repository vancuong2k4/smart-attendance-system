'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Navigation } from 'lucide-react'

export interface BranchMapPickerProps {
  latitude: number
  longitude: number
  radius: number
  onChange?: (lat: number, lon: number) => void
  readOnly?: boolean
  branchName?: string
}

export default function BranchMapPickerInner({
  latitude,
  longitude,
  radius,
  onChange,
  readOnly = false,
  branchName,
}: BranchMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)

  // Recenter map view to current coordinates
  const handleRecenter = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([latitude, longitude], 16, { animate: true })
    }
  }, [latitude, longitude])

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 16,
        zoomControl: true,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      // Map click event to relocate pin
      if (!readOnly && onChange) {
        map.on('click', (e: L.LeafletMouseEvent) => {
          const newLat = parseFloat(e.latlng.lat.toFixed(6))
          const newLng = parseFloat(e.latlng.lng.toFixed(6))
          onChange(newLat, newLng)
        })
      }

      mapInstanceRef.current = map

      setTimeout(() => {
        map.invalidateSize()
      }, 150)
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, []) // Mount once

  // Update Marker & Geofence Circle when props change
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // 1. Update Circle
    if (circleRef.current) {
      circleRef.current.remove()
    }

    const circle = L.circle([latitude, longitude], {
      radius: radius,
      color: '#4f46e5',
      fillColor: '#6366f1',
      fillOpacity: 0.18,
      weight: 2,
    }).addTo(map)
    circleRef.current = circle

    // 2. Update Marker
    if (markerRef.current) {
      markerRef.current.remove()
    }

    const markerIcon = L.divIcon({
      className: 'custom-branch-picker-pin',
      html: `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%); cursor: ${readOnly ? 'default' : 'grab'};">
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.4); border: 2.5px solid white;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          ${branchName ? `<div style="margin-top: 4px; background: rgba(15, 23, 42, 0.85); color: white; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${branchName}</div>` : ''}
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    })

    const marker = L.marker([latitude, longitude], {
      icon: markerIcon,
      draggable: !readOnly,
    }).addTo(map)

    if (!readOnly && onChange) {
      marker.on('dragend', () => {
        const position = marker.getLatLng()
        const newLat = parseFloat(position.lat.toFixed(6))
        const newLng = parseFloat(position.lng.toFixed(6))
        onChange(newLat, newLng)
      })
    }

    markerRef.current = marker
  }, [latitude, longitude, radius, readOnly, branchName, onChange])

  return (
    <div className="relative w-full h-[320px] rounded-xl overflow-hidden border border-slate-200 shadow-inner group">
      {/* Leaflet container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Control Overlay Buttons */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleRecenter}
          title="Đưa về tâm chi nhánh"
          className="p-2 bg-white/95 hover:bg-white text-slate-700 hover:text-indigo-600 rounded-lg shadow-md border border-slate-200 transition-all hover:scale-105 active:scale-95"
        >
          <Navigation size={16} />
        </button>
      </div>

      {/* Coordinate & Radius Indicator Pill */}
      <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none flex items-center justify-between">
        <div className="bg-slate-900/85 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2 shadow-lg border border-slate-800 pointer-events-auto">
          <MapPin size={13} className="text-indigo-400 shrink-0" />
          <span>
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </span>
          <span className="text-slate-400 font-sans">|</span>
          <span className="text-indigo-300 font-sans font-medium">Bán kính: {radius}m</span>
        </div>

        {!readOnly && (
          <div className="hidden sm:block bg-indigo-50/90 text-indigo-700 text-xs px-2.5 py-1 rounded-md border border-indigo-200 font-medium">
            Click hoặc kéo thả pin để đổi vị trí
          </div>
        )}
      </div>
    </div>
  )
}
