import { useEffect, useState } from 'react'
import { SpellcheckerProofreader } from './typo-js-proofreader'
import { vscode } from "../../../../../utils/vscode"

const proofreader = new SpellcheckerProofreader()

export const useSpellcheckerProofreader = () => {
  const [locale, setLocale] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data
      if (message.type === 'dictionary') {
        console.log('dic', message)
        setLoading(false)
        setLocale(message.text)
        if (message.dictionary) {
          proofreader.loadDictionary(message.dictionary, message.text)
        }
      }
    }
    window.addEventListener('message', messageHandler)
    return () => window.removeEventListener('message', messageHandler)
  }, [setLocale, setLoading])

  useEffect(() => {
    if (loading || locale) return 
    setLoading(true)
    if (typeof vscode !== 'undefined') {
      vscode.postMessage({
        type: "getDictionary"
      })
    }
  }, [loading, locale])

  return !locale ? null : proofreader
}