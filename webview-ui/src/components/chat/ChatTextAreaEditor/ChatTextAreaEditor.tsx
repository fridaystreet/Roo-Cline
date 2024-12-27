import React, { useState, useEffect, useCallback, useRef } from 'react'
import styled from "styled-components"
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { isEqual } from 'lodash'
import { Hunspell, HunspellFactory, loadModule } from 'hunspell-asm';
import SpellcheckerExtension from '@farscrl/tiptap-extension-spellchecker';
import Text from '@tiptap/extension-text'
import { EditorContent, useEditor, Editor } from '@tiptap/react'
import {Proofreader} from '../../../utils/spellchecker';
import {
  getOutput
} from './extensions'
import  { CODE_BLOCK_BG_COLOR } from '../../common/CodeBlock'

const useHunspell = () => {

  const hunspellFactory = useRef<HunspellFactory | undefined>()
  const affFile = useRef<string | undefined>()
  const dictFile = useRef<string | undefined>()
  const [hunspell, setHunspell] = useState<Hunspell | undefined>()

  
  const loadDictionary = useCallback(async () => {
    hunspellFactory.current = await loadModule();

    const aff = await fetch('https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/en-GB/index.aff');
    const affBuffer = new Uint8Array(await aff.arrayBuffer());
    affFile.current = hunspellFactory.current.mountBuffer(affBuffer, 'en.aff');

    const dic = await fetch('https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/en-GB/index.dic');
    const dictBuffer = new Uint8Array(await dic.arrayBuffer());
    dictFile.current = hunspellFactory.current.mountBuffer(dictBuffer, 'en.dic');

    setHunspell(hunspellFactory.current.create(affFile.current, dictFile.current));
  }, [hunspellFactory, affFile, dictFile, setHunspell])

  useEffect(() => {
    if (!hunspellFactory.current) return 
    (async () => {
      await loadDictionary()
    })()
  }, [hunspellFactory, loadDictionary])

  return hunspell
}

const StyledEditor = styled.div`
  /* Basic editor styles */

  width: 100%;
  box-sizing: border-box;
  background-color: transparent;
  color: var(--vscode-input-foreground);
  border-radius: 2px;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-editor-font-size);
  line-height: var(--vscode-editor-line-height);
  resize: none;
  overflow: hidden scroll;
  border-width: 0px 0px 6px;
  border-left-style: initial;
  border-color: transparent;
  border-right-style: initial;
  border-top-style: initial;
  border-bottom-style: solid;
  z-index: 1;
  min-height: 26px;
  max-height: 260px;

  .ProseMirror:focus {
    outline: none;
  }

  .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    pointer-events: none;
    opacity: 0.6;
    height: 0;
  }

  .tiptap {
  
    min-height: 26px;
    max-height: 260px;
    
  
    padding-top: 10px;
    padding-bottom: 7px;
      
    /* List styles */
    ul, 
    ol {
      padding: 0 1rem;
      margin: 1.25rem 1rem 1.25rem 0.4rem;
      
      li p {
        margin-top: 0.25em;
        margin-bottom: 0.25em;
      }
    }

    /* Heading styles */
    h1, 
    h2, 
    h3, 
    h4, 
    h5, 
    h6 {
      line-height: 1.1;
      margin-top: 2.5rem;
      text-wrap: pretty;
    }

    h1, 
    h2 {
      margin-top: 3.5rem;
      margin-bottom: 1.5rem;
    }

    h1 { 
      font-size: 1.4rem; 
    }

    h2 { 
      font-size: 1.2rem; 
    }

    h3 { 
      font-size: 1.1rem; 
    }

    h4, 
    h5, 
    h6 { 
      font-size: 1rem; 
    }

    /* Code and preformatted text styles */
    code {
      span.line:empty {
        display: none;
      }
      word-wrap: break-word;
      border-radius: 5px;
      background-color: ${CODE_BLOCK_BG_COLOR};
      font-size: var(--vscode-editor-font-size, var(--vscode-font-size, 12px));
      font-family: var(--vscode-editor-font-family);
    }

    code:not(pre > code) {
      font-family: var(--vscode-editor-font-family);
      color: #f78383;
    }

    pre {
      background: ${CODE_BLOCK_BG_COLOR};
      border-radius: 0.5rem;
      color: var(--white);
      font-family: 'JetBrainsMono', monospace;
      margin: 1.5rem 0;
      padding: 0.75rem 1rem;

      code {
        background: none;
        color: inherit;
        font-size: 0.8rem;
        padding: 0;
      }
    }

    mark {
      background-color: #FAF594;
      border-radius: 0.4rem;
      box-decoration-break: clone;
      padding: 0.1rem 0.3rem;
    }

    blockquote {
      border-left: 3px solid var(--gray-3);
      margin: 1.5rem 0;
      padding-left: 1rem;
    }

    hr {
      border: none;
      border-top: 1px solid var(--gray-2);
      margin: 2rem 0;
    }
    
    :first-child {
      margin-top: 0;
      margin-bottom: 0;
    }

    :last-child {
      margin-bottom: 0;
    }

    > * {
      margin-left: 10px;
      margin-right: 55px;
    }

  }
`
interface ChatTextAreaEditorProps {
  value: string;
  disabled?: boolean;
  onChange?: (e: any) => void;
  onSelect?: (e: any) => void;
  onKeyDown?: (e: any, view: any) => void;
  onKeyUp?: (e: any, view: any) => void;
  onFocus?: (e: any, editor: any) => void;
  onBlur?: (e: any, editor: any) => void;
  onPaste?: (e: any, view: any) => void;
  onMouseUp?: (e: any, view: any) => void;
  onHeightChange?: (height: number) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  autofocus?: boolean;
}

const ChatTextAreaEditor = React.forwardRef<HTMLTextAreaElement, ChatTextAreaEditorProps>(({
  value,
  disabled,
  onChange,
  onKeyDown,
  onKeyUp,
  onFocus,
  onBlur,
  onPaste,
  onSelect,
  onMouseUp,
  onHeightChange,
  placeholder,
  minRows=2,
  maxRows=20,
  autofocus = true
}, textAreaRef) => {

  const valueRef = useRef(value)

  // const setTextAreaValue = useCallback((value: string) => {
  //   console.log('tiptap update', value, textAreaRef.current)
  //   if (textAreaRef.current) {
  //     textAreaRef.current.value = value
  //   }
  //   console.log('tiptap update', textAreaRef.current)

  // }, [textAreaRef])
  const handleOnChange = useCallback((e: any) => {
    if (typeof onChange === 'function') {
      onChange(e)
    }
  }, [onChange])

  const handleOnSelect = useCallback((e: any) => {
    if (typeof onSelect === 'function') {
      onSelect(e)
    }
  }, [onSelect])

  const sendTextAreaEvent = useCallback((name: string, data: any = {}) => {
    if (textAreaRef && typeof textAreaRef !== 'function' && textAreaRef.current) {
      for (let key in data) {
        if (key in textAreaRef.current) {
          (textAreaRef.current as any)[key] = data[key]
        }
      }
      var event = new Event(name, { bubbles: true })
      textAreaRef.current.dispatchEvent(event)
    }
  }, [textAreaRef])

  useEffect(() => {
    if (textAreaRef) {
      const ref = typeof textAreaRef === 'function' ? null : textAreaRef.current;
      ref?.addEventListener('change', handleOnChange);
      ref?.addEventListener('select', handleOnSelect);
      return () => {
        ref?.removeEventListener('change', handleOnChange)
        ref?.removeEventListener('select', handleOnChange)
      }
    }
  }, [textAreaRef, handleOnChange, handleOnSelect]);


  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Highlight,
      Typography,
      Placeholder.configure({
        placeholder
      })
      // SpellcheckerExtension.configure({
      //   proofreader: new Proofreader(hunspell),
      //   uiStrings: {
      //     noSuggestions: 'No suggestions found',
      //   },
      // })
    ],
    autofocus,
    editable: !disabled,
    content: value,
    editorProps: {
      handleDOMEvents: {
        // input: (view, event) => {
        //   if (typeof onChange === 'function') {
            
            
        //     onChange(event, view)
        //   }
        // },
        keyup: (view, event) => {
          if (typeof onKeyUp === 'function') {
            onKeyUp(event, view)
          }
        },
        keydown: (view, event) => {
          if (typeof onKeyDown === 'function') {
            onKeyDown(event, view)
          }
        },
        mouseup: (view, event) => {
          if (typeof onMouseUp === 'function') {
            onMouseUp(event, view)
          }
        },
        paste: (view, event) => {
          if (typeof onPaste === 'function') {
            onPaste(event, view)
          }
        }
      }
    },
    // onBeforeCreate({ editor }) {
    //   // Before the view is created.
    // },
    // onCreate({ editor }) {
    //   // The editor is ready.
    // },
    onUpdate({ editor }) {
      const value = getOutput(editor).plainText
      valueRef.current = value;
      sendTextAreaEvent('change', { value })
    },
    onSelectionUpdate({ editor }) {
      const { view } = editor
      const { from, to } = view.state.selection
      sendTextAreaEvent('select', { selectionStart: from-1, selectionEnd: to-1 })
    },
    // onTransaction({ editor, transaction }) {
    //   // The editor state has changed.
    // },
    onFocus({ editor, event }) {
      if (typeof onFocus === 'function') return onFocus(event, editor)
    },
    onBlur({ editor, event }) {
      if (typeof onBlur === 'function') return onBlur(event, editor)
    },
    // onDestroy() {
    //   // The editor is being destroyed.
    // },
    // onContentError({ editor, error, disableCollaboration }) {
    //   // The editor content does not match the schema.
    // },
  })


  useEffect(() => {
		if (!editor || value === undefined || isEqual(valueRef.current, value)) return;
    if (value === "" && !valueRef.current) return
    //hack workaround for this issue https://github.com/ueberdosis/tiptap/issues/3580
    queueMicrotask(() => {
      editor.commands.setContent(value)
    })
	}, [valueRef, value, editor])

  return (
    <>
     <textarea style={{display: 'none'}} ref={textAreaRef} />
     <EditorContent editor={editor} />
    </>
  )
})

const Wrapper = React.forwardRef<HTMLTextAreaElement, ChatTextAreaEditorProps>((props, ref) => {

  //const hunspell = useHunspell()
  // if (!hunspell) return <div>Loading...</div>
  return <StyledEditor><ChatTextAreaEditor ref={ref} {...props}/></StyledEditor>
})

export default Wrapper
