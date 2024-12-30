import { Extension } from '@tiptap/core'
import createProofreadPlugin from './proofreadPlugin'
import { createSpellCheckEnabledStore } from './utils'
import { 
  languageToolProofreader/*,
  typoJsProofReader*/
} from './proofReaders'
import { createSuggestionBox } from './createSuggestionBox'

import './suggestion.css';


const spellCheckEnabledStore = createSpellCheckEnabledStore(() => true)
const proofreadPlugin = createProofreadPlugin(
  1000, // Debounce time in ms
  languageToolProofreader as never, // function to call proofreading service
  createSuggestionBox, // Suggestion box function
  spellCheckEnabledStore, // Reactive store to toggle spell checking,
  undefined, // Custom text function
  window.navigator.language // Language of the editor
);

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
  addStorage() {
    return {
      spellcheckEnabled: false
    }
  },
  addCommands() {
    return {
      toggleSpellcheck: () => () => {
        spellCheckEnabledStore.set(!spellCheckEnabledStore.get())
        this.storage.spellcheckEnabled = spellCheckEnabledStore.get()
        return true;
      }
    }
  },
  addProseMirrorPlugins() {
    return [proofreadPlugin];
  }
})