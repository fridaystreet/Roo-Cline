import { Extension } from '@tiptap/core'
import createProofreadPlugin from './proofreadPlugin'
import { createSpellCheckEnabledStore } from './utils'
import { generateProofreadErrors } from './languageToolReader'
import { createSuggestionBox } from './createSuggestionBox'
import './suggestion.css';

const spellCheckEnabledStore = createSpellCheckEnabledStore(() => true)
const proofreadPlugin = createProofreadPlugin(
  1000, // Debounce time in ms
  generateProofreadErrors as never, // function to call proofreading service
  createSuggestionBox, // Suggestion box function
  spellCheckEnabledStore, // Reactive store to toggle spell checking
);

// typescript definition of commands
declare module '@tiptap/core' {
  // tslint:disable-next-line:interface-name
  interface Commands<ReturnType> {
    spellcheck: {
      toggleSpellcheck: () => ReturnType
    }
  }
}

export const SpellCheck = Extension.create({
  name: 'spellcheck',
  addCommands() {
    return {
      toggleSpellcheck: () => () => {
        spellCheckEnabledStore.set(!spellCheckEnabledStore.get());
        return true;
      }
    }
  },
  addProseMirrorPlugins() {
    return [proofreadPlugin];
  }
})