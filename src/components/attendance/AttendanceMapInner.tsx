'use client'

import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface BranchMapInfo {
  name: string
  address?: string | null
  latitude: number
  longitude: number
  gpsRadius: number
}

export interface UserLocationInfo {
  latitude: number
  longitude: number
  accuracy?: number
}

interface AttendanceMapInnerProps {
  branch: BranchMapInfo
  userLocation: UserLocationInfo | null
  isWithinGeofence: boolean
  distance: number | null
}

export default function AttendanceMapInner({
  branch,
  userLocation,
  isWithinGeofence,
  distance,
}: AttendanceMapInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const geofenceCircleRef = useRef<L.Circle | null>(null)
  const branchMarkerRef = useRef<L.Marker | null>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)
  const userAccuracyCircleRef = useRef<L.Circle | null>(null)

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([branch.latitude, branch.longitude], 16)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

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
  }, [branch.latitude, branch.longitude])

  // Update Branch Marker & Geofence Circle
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Update Geofence Circle
    if (geofenceCircleRef.current) {
      geofenceCircleRef.current.remove()
    }

    const circleColor = isWithinGeofence ? '#10b981' : '#f59e0b'
    const circle = L.circle([branch.latitude, branch.longitude], {
      radius: branch.gpsRadius,
      color: circleColor,
      fillColor: circleColor,
      fillOpacity: 0.15,
      weight: 2,
      dashArray: isWithinGeofence ? undefined : '6, 6',
    }).addTo(map)
    geofenceCircleRef.current = circle

    // Update Branch Marker
    if (branchMarkerRef.current) {
      branchMarkerRef.current.remove()
    }

    const branchIcon = L.divIcon({
      className: 'custom-branch-marker',
      html: `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
          <div style="background-color: #4f46e5; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); border: 2px solid white;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
              <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
              <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
              <path d="M10 6h4"/>
              <path d="M10 10h4"/>
              <path d="M10 14h4"/>
              <path d="M10 18h4"/>
            </svg>
          </div>
          <div style="background-color: #312e81; color: white; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-top: 4px; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
            ${branch.name} (${branch.gpsRadius}m)
          </div>
        </div>
      `,
      iconSize: [0, 0],
    })

    const branchMarker = L.marker([branch.latitude, branch.longitude], { icon: branchIcon }).addTo(map)
    branchMarker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4;">
        <strong style="color: #1e1b4b; font-size: 14px;">${branch.name}</strong>
        ${branch.address ? `<div style="color: #64748b; margin-top: 2px;">${branch.address}</div>` : ''}
        <div style="margin-top: 4px; color: #4338ca; font-weight: 500;">Bán kính GPS hợp lệ: ${branch.gpsRadius}m</div>
      </div>
    `)
    branchMarkerRef.current = branchMarker
  }, [branch, isWithinGeofence])

  // Update User Location Marker & View
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (userMarkerRef.current) {
      userMarkerRef.current.remove()
      userMarkerRef.current = null
    }
    if (userAccuracyCircleRef.current) {
      userAccuracyCircleRef.current.remove()
      userAccuracyCircleRef.current = null
    }

    if (userLocation) {
      const { latitude, longitude, accuracy } = userLocation
      const color = isWithinGeofence ? '#10b981' : '#ef4444'

      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%);">
            <div style="width: 20px; height: 20px; border-radius: 50%; background-color: ${color}; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3); z-index: 2;"></div>
            <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background-color: ${color}; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          </div>
        `,
        iconSize: [0, 0],
      })

      const userMarker = L.marker([latitude, longitude], { icon: userIcon }).addTo(map)
      userMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 13px;">
          <strong style="color: #0f172a;">Vị trí của bạn</strong>
          <div style="margin-top: 3px; color: ${isWithinGeofence ? '#059669' : '#dc2626'}; font-weight: 600;">
            ${isWithinGeofence ? '✓ Nằm trong khu vực chấm công' : '✕ Ngoài khu vực chấm công'}
          </div>
          ${distance !== null ? `<div style="color: #475569; margin-top: 2px;">Khoảng cách tới văn phòng: <strong>${distance}m</strong></div>` : ''}
          ${accuracy ? `<div style="color: #64748b; font-size: 11px; margin-top: 2px;">Độ chính xác GPS: ±${Math.round(accuracy)}m</div>` : ''}
        </div>
      `)
      userMarkerRef.current = userMarker

      // Accuracy circle
      if (accuracy && accuracy <= 150) {
        const accuracyCircle = L.circle([latitude, longitude], {
          radius: accuracy,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.08,
          weight: 1,
        }).addTo(map)
        userAccuracyCircleRef.current = accuracyCircle
      }

      // Auto-fit bounds between branch and user
      const bounds = L.latLngBounds(
        [branch.latitude, branch.longitude],
        [latitude, longitude]
      )
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 })
    }
  }, [userLocation, branch.latitude, branch.longitude, isWithinGeofence, distance])

  return (
    <div className="relative w-full h-full min-h-[340px] rounded-xl overflow-hidden border border-gray-200 shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full min-h-[340px]" />

      {/* Floating Status Badge on Map */}
      <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-md border border-gray-100 flex items-center gap-2 text-xs">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            userLocation
              ? isWithinGeofence
                ? 'bg-emerald-500 animate-pulse'
                : 'bg-rose-500'
              : 'bg-amber-400 animate-ping'
          }`}
        />
        <span className="font-medium text-gray-700">
          {userLocation
            ? isWithinGeofence
              ? `Hợp lệ (cách ${distance ?? 0}m)`
              : `Chưa vào vùng (cách ${distance ?? 0}m / tối đa ${branch.gpsRadius}m)`
            : 'Đang xác định GPS...'}
        </span>
      </div>
    </div>
  )
}
