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

  boxSizing: "border-box";
  backgroundColor: "transparent";
  color: "var(--vscode-input-foreground)";
  borderRadius: 2;
  fontFamily: "var(--vscode-font-family)";
  fontSize: "var(--vscode-editor-font-size)";
  lineHeight: "var(--vscode-editor-line-height)";
  resize: "none";
  overflowX: "hidden";
  overflowY: "scroll";
  borderLeft: 0;
  borderRight: 0;
  borderTop: 0;
  borderColor: "transparent";  
  flex: 1;
  zIndex: 1;
  width: 100%;

  .ProseMirror:focus {
    outline: none;
  }

  .tiptap {
  
    padding-top: 10px;
    padding-bottom: 7px;

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
      background-color: var(--purple-light);
      border-radius: 0.4rem;
      color: var(--black);
      font-size: 0.85rem;
      padding: 0.25em 0.3em;
    }

    pre {
      background: var(--black);
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
  }
`
const ChatTextAreaEditor = React.forwardRef(({
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
}: any, textAreaRef: React.ForwardedRef<React.MutableRefObject<HTMLTextAreaElement>>) => {

  const valueRef = useRef(value)

  // const setTextAreaValue = useCallback((value: string) => {
  //   console.log('tiptap update', value, textAreaRef.current)
  //   if (textAreaRef.current) {
  //     textAreaRef.current.value = value
  //   }
  //   console.log('tiptap update', textAreaRef.current)

  // }, [textAreaRef])
  const handleOnChange = useCallback((e: any) => {
    console.log('change', e)
    if (typeof onChange === 'function') {
      onChange(e)
    }
  }, [onChange])

  useEffect(() => {
    textAreaRef?.current?.addEventListener('change', handleOnChange);
    const ref = textAreaRef?.current
    return () => ref?.removeEventListener('change', handleOnChange);
  }, [textAreaRef, handleOnChange])


  const editor = useEditor({
    extensions: [
      StarterKit,
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
        },
        select: (view, event) => {
          if (typeof onSelect === 'function') {
            onSelect(event, view)
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
      const text = getOutput(editor).plainText
      valueRef.current = text
      var event = new Event('change', { bubbles: true })
      textAreaRef?.current?.dispatchEvent(event)
    },
    // onSelectionUpdate({ editor }) {
    //   // The selection has changed.
    // },
    // onTransaction({ editor, transaction }) {
    //   // The editor state has changed.
    // },
    onFocus({ editor, event }) {
      if (typeof onBlur === 'function') return onFocus(event, editor)
    },
    onBlur({ editor, event }) {
      if (typeof onBlur === 'function') return onFocus(event, editor)
    },
    // onDestroy() {
    //   // The editor is being destroyed.
    // },
    // onContentError({ editor, error, disableCollaboration }) {
    //   // The editor content does not match the schema.
    // },
  })


  useEffect(() => {
		if (!editor || !value || isEqual(valueRef.current, value)) return;
    //hack workaround for this issue https://github.com/ueberdosis/tiptap/issues/3580
    queueMicrotask(() => {
      editor.commands.setContent(value)
    })
	}, [valueRef, value, editor])

  return (
    <>
     <textarea ref={textAreaRef} value={valueRef.current} />
     <EditorContent editor={editor} />
    </>
  )
})

const Wrapper = React.forwardRef((props: any, ref: React.ForwardedRef<React.MutableRefObject<HTMLTextAreaElement>>) => {

  //const hunspell = useHunspell()

  console.log('tiptap', props)
  // if (!hunspell) return <div>Loading...</div>
  return <StyledEditor><ChatTextAreaEditor ref={ref} {...props}/></StyledEditor>
})

export default Wrapper