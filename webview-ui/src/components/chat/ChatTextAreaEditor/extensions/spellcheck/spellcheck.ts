import { Extension } from '@tiptap/core'
import createProofreadPlugin from './proofreadPlugin'
import { createSpellCheckEnabledStore } from './utils'
import { 
  languageToolProofreader/*,
  typoJsProofReader*/
} from './proofReaders'
import { createSuggestionBox } from './createSuggestionBox'

import './suggestion.css';


const spellCheckEnabledStore = createSpellCheckEnabledStore(() => false)

// typescript definition of commands
declare module '@tiptap/core' {
  // tslint:disable-next-line:interface-name
  interface Commands<ReturnType> {
    spellcheck: {
      toggleSpellcheck: () => ReturnType,
      spellcheckIsActive: () => ReturnType
    }
  }
}

export const SpellCheck = Extension.create({
  name: 'spellcheck',
  addOptions() {
    return {
      enabled: false,
      excludeNodes: []
    }
  },
  onBeforeCreate() {
    spellCheckEnabledStore.set(this.options.enabled)
  },
  addStorage() {
    return {
      spellcheckEnabled: this.options.enabled
    }
  },
  addCommands() {
    return {
      toggleSpellcheck: () => () => {
        this.storage.spellcheckEnabled = !spellCheckEnabledStore.get()
        spellCheckEnabledStore.set(this.storage.spellcheckEnabled)
        return true;
      }
    }
  },
  addProseMirrorPlugins() {
    const proofreadPlugin = createProofreadPlugin(
      1000, // Debounce time in ms
      languageToolProofreader as never, // function to call proofreading service
      createSuggestionBox, // Suggestion box function
      spellCheckEnabledStore, // Reactive store to toggle spell checking,
      undefined, // Custom text function
      window.navigator.language, // Language of the editor,
      this.options.excludeNodes // Blocks to exclude from spell checking
    );
    return [proofreadPlugin];
  }
})