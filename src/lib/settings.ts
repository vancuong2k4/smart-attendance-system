import { prisma } from '@/lib/db'

/**
 * Standard enterprise defaults for system configuration
 */
export const DEFAULT_SYSTEM_SETTINGS = {
  checkInWindowStart: '06:00',
  checkInWindowEnd: '10:30',
  checkOutWindowStart: '11:00',
  checkOutWindowEnd: '23:00',
  defaultLateThreshold: 15,
  defaultEarlyThreshold: 15,
  requireSelfie: false,
  requireGps: true,
  maxGpsAccuracyMeters: 50,

  payrollStartDay: 1,
  payrollEndDay: 31,
  attendanceLockDay: 5,
  standardWorkDaysMonth: 22.0,
  otRateWeekday: 1.5,
  otRateWeekend: 2.0,
  otRateHoliday: 3.0,

  defaultAnnualLeave: 12.0,
  defaultSickLeave: 10.0,
  allowCarryOverLeave: true,
  maxCarryOverDays: 5.0,
  carryOverDeadline: 3,

  notifyLateArrival: true,
  notifyEarlyLeave: true,
  checkInReminder: true,
  checkOutReminder: true,
  sessionTimeoutMinutes: 1440,
}

/**
 * Ensures a company exists and returns its SystemSetting record,
 * auto-creating a default settings row if none exists yet.
 */
export async function getOrCreateSystemSettings(companyId?: string) {
  let company = null

  if (companyId) {
    company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { settings: true },
    })
  }

  if (!company) {
    company = await prisma.company.findFirst({
      include: { settings: true },
    })
  }

  // If no company in DB, create default company
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Tổng công ty',
        code: 'HQ',
        address: 'Hà Nội, Việt Nam',
        timezone: 'Asia/Ho_Chi_Minh',
        currency: 'VND',
        settings: {
          create: DEFAULT_SYSTEM_SETTINGS,
        },
      },
      include: { settings: true },
    })
    return { company, settings: company.settings! }
  }

  // If company exists but has no settings record, create it
  if (!company.settings) {
    const newSettings = await prisma.systemSetting.create({
      data: {
        companyId: company.id,
        ...DEFAULT_SYSTEM_SETTINGS,
      },
    })
    return { company, settings: newSettings }
  }

  return { company, settings: company.settings }
}
