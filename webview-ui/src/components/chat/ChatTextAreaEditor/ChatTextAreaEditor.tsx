import React, { useEffect, useCallback, useRef } from 'react'
import styled from "styled-components"
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { isEqual } from 'lodash'
import { EditorContent, useEditor } from '@tiptap/react'
import {
  getOutput,
  SpellcheckerExtension,
  SpellcheckerProofreader
} from './extensions'
import  { CODE_BLOCK_BG_COLOR } from '../../common/CodeBlock'

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
  border-color: transparent;
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
    padding-bottom: 12px;
      
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
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  autofocus?: boolean;  
  styles?: any
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
  onScroll,
  placeholder,
  styles,
  autofocus = true
}, textAreaRef) => {

  const valueRef = useRef<string>(value)
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (!containerRef.current || typeof onHeightChange !== 'function') return
    const observer = new ResizeObserver(function() {
      const height = containerRef.current?.offsetHeight
      onHeightChange(height || 0)
    })
    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [containerRef, onHeightChange])

  const handleOnChange = useCallback((e: Event) => {
    if (typeof onChange === 'function') {
      onChange(e)
    }
  }, [onChange])

  const handleOnSelect = useCallback((e: Event) => {
    if (typeof onSelect === 'function') {
      onSelect(e)
    }
  }, [onSelect])

  
  const handleOnScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (textAreaRef && typeof textAreaRef !== 'function' && textAreaRef.current) {
      textAreaRef.current.scrollTop = (e.target as HTMLDivElement).scrollTop
      textAreaRef.current.scrollLeft = (e.target as HTMLDivElement).scrollLeft
    }
    if (typeof onScroll === 'function') onScroll(e)
  }, [textAreaRef, onScroll])

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
      }),
      // SpellcheckerExtension.configure({ 
      //   proofreader: new SpellcheckerProofreader(),
      //   uiStrings: {
      //       noSuggestions: 'No suggestions found'
      //   }
      // })
    ],
    autofocus,
    editable: !disabled,
    content: value,
    editorProps: {
      handleDOMEvents: {
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
    onFocus({ editor, event }) {
      if (typeof onFocus === 'function') return onFocus(event, editor)
    },
    onBlur({ editor, event }) {
      if (typeof onBlur === 'function') return onBlur(event, editor)
    }
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
    <StyledEditor ref={containerRef} style={styles} onScroll={handleOnScroll}>
     <textarea style={{display: 'none'}} ref={textAreaRef} />
     <EditorContent editor={editor} />
    </StyledEditor>
  )
})

//might need to use a wrapper if the dictionary needs to be loaded async
//shouldn't need to but as a last resort
// const Wrapper = React.forwardRef<HTMLTextAreaElement, ChatTextAreaEditorProps>((props, ref) => {

//   const hunspell = useHunspell()
//   return <StyledEditor>
//     {hunspell && <ChatTextAreaEditor ref={ref} {...props} hunspell={hunspell}/>}
//     {!hunspell && <div>Loading...</div>}
//   </StyledEditor>
// })

export default ChatTextAreaEditor
