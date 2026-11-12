/**
 * Geofencing Utilities & Mathematics
 * Provides high-precision distance calculation (Haversine formula),
 * bounding box extraction, and Geofence status evaluation.
 */

const EARTH_RADIUS_METERS = 6371000

/**
 * Calculates Great-Circle distance in meters between two GPS coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_METERS * c
}

/**
 * Checks if a target GPS coordinate is within a branch's geofence radius
 */
export function isInsideGeofence(
  targetLat: number,
  targetLon: number,
  branchLat: number,
  branchLon: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(targetLat, targetLon, branchLat, branchLon)
  return distance <= radiusMeters
}

/**
 * Calculates a bounding box (minLat, maxLat, minLon, maxLon) given a center and radius
 * Useful for adjusting map viewport bounds to enclose the full geofence circle
 */
export interface BoundingBox {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

export function getGeofenceBoundingBox(
  lat: number,
  lon: number,
  radiusMeters: number
): BoundingBox {
  // Approximate conversion: 1 deg latitude ~ 111,320 meters
  const deltaLat = radiusMeters / 111320
  // 1 deg longitude ~ 111,320 * cos(lat) meters
  const radLat = (lat * Math.PI) / 180
  const cosLat = Math.cos(radLat)
  const deltaLon = cosLat === 0 ? 0 : radiusMeters / (111320 * Math.abs(cosLat))

  return {
    minLat: lat - deltaLat,
    maxLat: lat + deltaLat,
    minLon: lon - deltaLon,
    maxLon: lon + deltaLon,
  }
}

/**
 * Formats coordinates to standard 6 decimal places (approx. 0.1 meter accuracy)
 */
export function formatCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`
}

/**
 * Formats distance into a human-friendly string (e.g., "45 m", "1.2 km")
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(2)} km`
}

export interface GeofenceEvaluation {
  isInside: boolean
  distanceMeters: number
  allowedRadius: number
  deltaMeters: number
  verdict: 'INSIDE' | 'OUTSIDE'
  message: string
}

/**
 * Evaluates whether a test coordinate is inside a branch geofence and generates a detailed status report
 */
export function evaluateGeofenceTest(
  branchLat: number,
  branchLon: number,
  branchRadius: number,
  testLat: number,
  testLon: number,
  accuracyMeters?: number | null
): GeofenceEvaluation {
  const rawDistance = calculateDistance(testLat, testLon, branchLat, branchLon)
  const distanceMeters = Math.round(rawDistance)
  const isInside = rawDistance <= branchRadius
  const deltaMeters = Math.round(Math.abs(rawDistance - branchRadius))

  let message = ''
  if (isInside) {
    const insideMargin = branchRadius - distanceMeters
    message = `Vị trí hợp lệ! Bạn đang ở trong bán kính chấm công (cách tâm ${distanceMeters}m, cách biên ${insideMargin}m).`
  } else {
    message = `Vị trí ngoài bán kính! Bạn đang cách văn phòng ${distanceMeters}m, vượt quá bán kính quy định ${deltaMeters}m.`
  }

  if (accuracyMeters && accuracyMeters > 50) {
    message += ` Cảnh báo: Độ chính xác GPS hiện tại khá thấp (~${Math.round(accuracyMeters)}m).`
  }

  return {
    isInside,
    distanceMeters,
    allowedRadius: branchRadius,
    deltaMeters,
    verdict: isInside ? 'INSIDE' : 'OUTSIDE',
    message,
  }
}
