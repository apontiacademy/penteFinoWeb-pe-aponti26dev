import { PlusCircle, MinusCircle, ClipboardList } from 'lucide-react'

export const TRIGGER_INFO = {
  add: {
    label: 'adição',
    icon: PlusCircle,
    iconClass: 'bg-primary/10 text-primary',
    badgeClass: 'border-primary/30 text-primary bg-primary/5',
  },
  delete: {
    label: 'exclusão',
    icon: MinusCircle,
    iconClass: 'bg-destructive/10 text-destructive',
    badgeClass: 'border-destructive/30 text-destructive bg-destructive/5',
  },
  manual: {
    label: 'manual',
    icon: ClipboardList,
    iconClass: 'bg-muted text-muted-foreground',
    badgeClass: 'border-border text-muted-foreground bg-muted/50',
  },
} as const

export type TriggerType = keyof typeof TRIGGER_INFO
