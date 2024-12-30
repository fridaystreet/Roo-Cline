import React, { useEffect, useCallback, useRef } from 'react'
import HardBreak from '@tiptap/extension-hard-break'
import Typography from '@tiptap/extension-typography'
import { Color } from '@tiptap/extension-color'
import ListItem from '@tiptap/extension-list-item'
import TextStyle from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { all, createLowlight } from 'lowlight'
import { isEqual } from 'lodash'
import { useEditor, Editor } from '@tiptap/react'
import {
  GetOutput,
  Highlight,
  SpellCheck,
  AIExtension,
  // useSlashCommands,
  // OnReturnHandler,
  SlashCommandEditor
} from './extensions'
import './styles.css'

const lowlight = createLowlight(all)

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
  onReturn?: (arg0: Object) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  autofocus?: boolean;  
  styles?: any,
  format?: string;
}

export interface TipTapHTMLTextAreaElement extends HTMLTextAreaElement {
  _tiptap: Editor | undefined | null
}

export const ChatTextAreaEditor = React.forwardRef<TipTapHTMLTextAreaElement, ChatTextAreaEditorProps>(({
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
  format,
  autofocus = true
}, textAreaRef) => {

  const valueRef = useRef<string>(value)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // const SlashCommands = useSlashCommands()

  useEffect(() => {
    if (!containerRef.current || typeof onHeightChange !== 'function') return
    const observer = new ResizeObserver(function() {
      const height = containerRef.current?.offsetHeight
      if (textAreaRef && typeof textAreaRef !== 'function' && textAreaRef.current) {
        textAreaRef.current.style.height = `${height}px`
      }
      onHeightChange(height || 0)
    })
    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [textAreaRef, containerRef, onHeightChange])

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

  
  const editor = useEditor({
    extensions: [
      Color.configure({ types: [TextStyle.name, ListItem.name] }),
      TextStyle,
      StarterKit.configure({
        codeBlock: false,
        hardBreak: false,
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Highlight,
      Typography,
      Markdown.configure({
        html: false,                  // Allow HTML input/output
        tightLists: true,            // No <p> inside <li> in markdown output
        tightListClass: 'tight',     // Add class to <ul> allowing you to remove <p> margins when tight
        bulletListMarker: '-',       // <li> prefix in markdown output
        linkify: true,              // Create links from "https://..." text
        breaks: true,               // New lines (\n) in markdown input are converted to <br>
        transformPastedText: true,  // Allow to paste markdown text in the editor
        transformCopiedText: true,  // Copied text is transformed to markdown
      }),
      Placeholder.configure({
        placeholder
      }),
      SpellCheck,
      AIExtension.configure({
        enhancingMessage: 'Generating new content...',
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      //SlashCommands
      GetOutput,
      HardBreak.extend({
        addKeyboardShortcuts() {
          return {
            'Mod-Enter': () => this.editor.commands.insertContent({ type: 'paragraph' }),
            'Shift-Enter': () => this.editor.commands.setHardBreak(),
          }
        }
      }).configure({
        keepMarks: false
      })
      // OnReturnHandler.configure({
      //   // onReturn 
      // })
    ],
    autofocus,
    editable: !disabled,
    content: value,
    editorProps: {
      handleDOMEvents: {
        keydown: (view, event: any) => {
          if (event.key === "Enter") {
            if (!event.composed || event.shiftKey || event.metaKey || event.ctrlKey) {
              return
            }
            const { selection } = view.state;
            const { anchor } = selection;
            const nodes: any[] = []
            view.state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
              nodes.push(node.type.name);
            })
            if (nodes[0] !== 'paragraph') return
          }
          if (typeof onKeyDown === 'function') {
            onKeyDown(event, view)
          }
        },
        keyup: (view, event) => {
          if (typeof onKeyUp === 'function') {
            onKeyUp(event, view)
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
      const output = editor.commands.getOutput()
      valueRef.current = format === 'markdown' ? output.markdown : output.plaintext
      sendTextAreaEvent('change', { value: valueRef.current })
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
    if (textAreaRef && editor) {
      const ref = typeof textAreaRef === 'function' ? null : textAreaRef.current;
      if (ref && !ref._tiptap) {
        ref._tiptap = editor
        ref.addEventListener('change', handleOnChange);
        ref.addEventListener('select', handleOnSelect);
        return () => {
          ref.removeEventListener('change', handleOnChange)
          ref.removeEventListener('select', handleOnChange)
        }
      }
    }
  }, [editor, textAreaRef, handleOnChange, handleOnSelect]);

  useEffect(() => {
		if (!editor || value === undefined || isEqual(valueRef.current, value)) return;
    if (value === "" && !valueRef.current) return
    //hack workaround for this issue https://github.com/ueberdosis/tiptap/issues/3580
    queueMicrotask(() => {
      //set the content to the value passed in, don't fire update events and preserve tariling spaces
      editor.commands.setContent(value, false, { preserveWhitespace: true })
    })
	}, [valueRef, value, editor])

  return (
    <>
      <div className="ChatTextAreaEditor" ref={containerRef} style={styles} onScroll={handleOnScroll}>
        <SlashCommandEditor editor={editor} />
      </div>
      <textarea 
        ref={textAreaRef} 
        style={{
          visibility: 'hidden', 
          position: 'absolute', 
          overflow: 'hidden scroll', 
          minHeight: '26px', 
          maxHeight: '260px' 
        }} 
      />
    </>
  )
})
