'use client'

import { enUS, es, fr } from 'date-fns/locale'
import type { Locale } from 'date-fns/locale'
import { useSettings } from './use-settings'

const dateFnsLocales: Record<string, Locale> = { fr, es, en: enUS }

export const useDateLocale = () => {
  const { locale } = useSettings()
  const lang = locale.split('-')[0]
  return dateFnsLocales[lang] ?? enUS
}
