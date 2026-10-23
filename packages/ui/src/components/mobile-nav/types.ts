import type { LucideIcon } from 'lucide-react'

type MobileNavSubItem = {
  title: string
  href: string
  items?: { title: string; href: string }[]
}

type MobileNavItem = {
  id: string
  title: string
  href: string
  icon: LucideIcon
  items?: MobileNavSubItem[]
}

export type { MobileNavItem, MobileNavSubItem }
