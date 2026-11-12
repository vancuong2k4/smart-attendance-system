'use client'

import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface GeofenceSimulatorMapInnerProps {
  branchLat: number
  branchLon: number
  branchRadius: number
  branchName: string
  testLat: number
  testLon: number
  isInside: boolean
  onSelectTestPoint: (lat: number, lng: number) => void
}

export default function GeofenceSimulatorMapInner({
  branchLat,
  branchLon,
  branchRadius,
  branchName,
  testLat,
  testLon,
  isInside,
  onSelectTestPoint,
}: GeofenceSimulatorMapInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const branchMarkerRef = useRef<L.Marker | null>(null)
  const testMarkerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const polylineRef = useRef<L.Polyline | null>(null)

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: [branchLat, branchLon],
        zoom: 16,
        zoomControl: true,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      map.on('click', (e: L.LeafletMouseEvent) => {
        onSelectTestPoint(
          parseFloat(e.latlng.lat.toFixed(6)),
          parseFloat(e.latlng.lng.toFixed(6))
        )
      })

      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 150)
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update Layers & Markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // 1. Circle
    if (circleRef.current) circleRef.current.remove()
    const circleColor = isInside ? '#10b981' : '#f43f5e'
    const circle = L.circle([branchLat, branchLon], {
      radius: branchRadius,
      color: circleColor,
      fillColor: circleColor,
      fillOpacity: 0.15,
      weight: 2,
    }).addTo(map)
    circleRef.current = circle

    // 2. Branch Center Marker
    if (branchMarkerRef.current) branchMarkerRef.current.remove()
    const branchIcon = L.divIcon({
      className: 'sim-branch-marker',
      html: `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
          <div style="background: #4f46e5; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2.5px solid white;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
            </svg>
          </div>
          <div style="margin-top: 3px; background: rgba(15, 23, 42, 0.9); color: white; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
            ${branchName}
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    })
    const bMarker = L.marker([branchLat, branchLon], { icon: branchIcon }).addTo(map)
    branchMarkerRef.current = bMarker

    // 3. Test Marker
    if (testMarkerRef.current) testMarkerRef.current.remove()
    const testIcon = L.divIcon({
      className: 'sim-test-marker',
      html: `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%); cursor: grab;">
          <div style="background: ${isInside ? '#10b981' : '#f43f5e'}; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.35); border: 2.5px solid white;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
            </svg>
          </div>
          <div style="margin-top: 3px; background: ${isInside ? '#065f46' : '#9f1239'}; color: white; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
            Điểm kiểm tra
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    })
    const tMarker = L.marker([testLat, testLon], { icon: testIcon, draggable: true }).addTo(map)
    tMarker.on('dragend', () => {
      const pos = tMarker.getLatLng()
      onSelectTestPoint(
        parseFloat(pos.lat.toFixed(6)),
        parseFloat(pos.lng.toFixed(6))
      )
    })
    testMarkerRef.current = tMarker

    // 4. Polyline connecting branch center and test point
    if (polylineRef.current) polylineRef.current.remove()
    const line = L.polyline(
      [
        [branchLat, branchLon],
        [testLat, testLon],
      ],
      {
        color: isInside ? '#059669' : '#e11d48',
        weight: 2.5,
        dashArray: '6, 8',
      }
    ).addTo(map)
    polylineRef.current = line
  }, [branchLat, branchLon, branchRadius, branchName, testLat, testLon, isInside, onSelectTestPoint])

  return (
    <div className="relative w-full h-[340px] rounded-xl overflow-hidden border border-slate-200 shadow-inner">
      <div ref={containerRef} className="w-full h-full z-0" />
    </div>
  )
}
