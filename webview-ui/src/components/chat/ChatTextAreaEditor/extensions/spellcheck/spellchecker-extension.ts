import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { DecorationSet } from 'prosemirror-view';
import { IProofreaderInterface } from './i-proofreader-interface';
import Spellchecker from './spellchecker';
import { selectAll } from 'prosemirror-commands';
import { isProofreaderInitialized } from './useSpellcheckProofreader';

export const SPELLCHECKER_TRANSACTION = 'spellchecker-transation';
export const LOADING_TRANSACTION = 'loading';

export interface IUiStrings {
  noSuggestions?: string;
}

export interface ISpellcheckerOptions {
  proofreader?: IProofreaderInterface,
  uiStrings?: IUiStrings;
  onShowSuggestionsEvent?: (word: string) => void;
}

interface ISpellcheckerStorage {
  didPaste: boolean;
  spellchecker?: Spellchecker;
  initialized: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    spellchecker: {
      checkSpelling: () => ReturnType
    }
  }
}

export const SpellcheckExtension = Extension.create<ISpellcheckerOptions, ISpellcheckerStorage>({
  name: 'spellchecker',

  addOptions() {
    return {
      proofreader: undefined,
      uiStrings: {
        noSuggestions: ''
      }
    };
  },

  addStorage() {
    return {
      didPaste: false,
      spellchecker: undefined,
      initialized: false
    };
  },

  addCommands() {
    return {
      checkSpelling: () => ({ tr }) => {
        if (!this.storage.initialized || !this.storage.spellchecker) {
          return false;
        }
        this.storage.spellchecker.proofreadDoc(tr.doc);
        return true;
      },
      selectAll: () => ({ state, dispatch }) => {
        selectAll(state, dispatch);
        return true;
      },
      copy: () => () => {
        document.execCommand('copy');
        return true;
      }
    };
  },

  addProseMirrorPlugins() {
    const that = this;
    return [
      new Plugin({
        key: new PluginKey('spellcheckerPlugin'),
        props: {
          decorations(state) {
            if (!that.storage.initialized) {
              return DecorationSet.empty;
            }
            return that.storage.spellchecker?.getDecorationSet() || DecorationSet.empty;
          },
          handlePaste() {
            that.storage.didPaste = true;
          },
          handleClick() {
            if (that.storage.spellchecker) {
              that.storage.spellchecker.hideSuggestionBox();
            }
          }
        },
        state: {
          async init(config, instance) {
            if (!isProofreaderInitialized()) {
              that.storage.initialized = false;
              return DecorationSet.empty;
            }

            if (that.options.proofreader && typeof (that.options.proofreader as any).initialize === 'function') {
              await (that.options.proofreader as any).initialize();
            }

            const spellchecker = new Spellchecker(
              that.options.proofreader!, 
              that.options.uiStrings, 
              that.options.onShowSuggestionsEvent
            );

            that.storage.spellchecker = spellchecker;
            that.storage.initialized = true;
            spellchecker.setDecorationSet(DecorationSet.create(instance.doc, []));

            spellchecker.proofreadDoc(instance.doc);

            return spellchecker.getDecorationSet();
          },
          apply(transaction) {
            if (!that.storage.initialized || !that.storage.spellchecker) {
              return DecorationSet.empty;
            }

            const spellchecker = that.storage.spellchecker;
            if (transaction.getMeta(SPELLCHECKER_TRANSACTION)) {
              return spellchecker.getDecorationSet();
            }

            if (transaction.docChanged) {
              if (that.storage.didPaste) {
                that.storage.didPaste = false;
                spellchecker.debouncedProofreadDoc(transaction.doc);
              } else {
                spellchecker.debouncedProofreadDoc(transaction.doc);
              }
            }

            setTimeout(spellchecker.addEventListenersToDecorations, 100);
            return spellchecker.getDecorationSet();
          }
        },
        view: () => ({
          update: (view) => {
            if (!that.storage.initialized || !that.storage.spellchecker) {
              return;
            }

            const spellchecker = that.storage.spellchecker;
            spellchecker.setEditorView(view);

            view?.dom?.parentNode?.appendChild(spellchecker.getSuggestionBox());
            setTimeout(spellchecker.addEventListenersToDecorations, 100);
          },
        }),
      }),
    ];
  }
});
