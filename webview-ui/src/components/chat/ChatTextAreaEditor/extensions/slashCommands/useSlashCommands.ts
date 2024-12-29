import { useMemo } from 'react'
import {
  Slash,
  enableKeyboardNavigation,
} from "@harshtalks/slash-tiptap";
import { commands } from './commands'

export const slashKeyboardNav = {
  keydown: (_: any, v: any) => enableKeyboardNavigation(v)
}

export const useSlashCommands = () => {

  const SlashCommands = useMemo(() => Slash.configure({
    suggestion: {
      items: () => commands,
    },
  }), [])

  return SlashCommands
}