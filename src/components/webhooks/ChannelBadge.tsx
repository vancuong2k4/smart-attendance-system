'use client'

import React from 'react'
import { Send, MessageSquare, Globe, Bell, Webhook } from 'lucide-react'

export type WebhookChannelType = 'TELEGRAM' | 'DISCORD' | 'GENERIC_WEBHOOK' | 'ZALO_ZNS' | string

interface ChannelBadgeProps {
  channel: WebhookChannelType
  size?: 'sm' | 'md'
}

export function ChannelBadge({ channel, size = 'md' }: ChannelBadgeProps) {
  switch (channel) {
    case 'TELEGRAM':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 font-bold text-sky-700 shadow-2xs ${
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <Send className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5 text-sky-500'} />
          Telegram Bot
        </span>
      )
    case 'DISCORD':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 font-bold text-indigo-700 shadow-2xs ${
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <MessageSquare className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5 text-indigo-500'} />
          Discord Webhook
        </span>
      )
    case 'ZALO_ZNS':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 font-bold text-blue-700 shadow-2xs ${
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <Bell className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5 text-blue-500'} />
          Zalo ZNS
        </span>
      )
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 font-bold text-emerald-700 shadow-2xs ${
            size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <Globe className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5 text-emerald-500'} />
          Custom Webhook (JSON)
        </span>
      )
  }
}
