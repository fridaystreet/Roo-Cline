import { Extension, Editor } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'

interface OnReturnData {
  content: string, 
  editor: Editor
}


declare module '@tiptap/core' {
  // tslint:disable-next-line:interface-name
  interface Commands<ReturnType> {
    onReturnHandler: {
      onReturn: (
        event: KeyboardEvent, 
        view: any,
        onReturn: (
          event: any,
          view: any,
          data: OnReturnData
        ) => any
      ) => ReturnType
    }
  }
}

export const OnReturnHandler = Extension.create({
  name: 'onReturnHandler',
  priority: 10000,
  addOptions() {
    return {
      onHandleDOMEvents: null,
      onHandleKeyDown: null
    }
  },
  addCommands() {
    return {
      onReturn: (event, view, onReturn) => ({ commands }: any) => {

        if (typeof onReturn !== 'function') return false
        if (event.key !== "Enter" ) return false

        const state: any = this.editor.state
        if (state.suggestion$.active) return false

        if (!event.composed || event.shiftKey || event.metaKey || event.ctrlKey) {
          return false
        }
      
        if (this.editor.isEmpty) return false
      
        const { selection } = this.editor.view.state
        const { anchor } = selection;

        const activePlugins = this.editor.state.plugins.filter((plugin: any) => {
          return plugin.name
        })
      
        if (activePlugins.length > 0) return false
      
        let nodes: string[] = [];
      
        this.editor.view.state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
          nodes.push(node.type.name);
        })
      
        if (nodes[0] !== 'paragraph') return false
      
      
        onReturn(event, view, {
          content: commands.getOutput(),
          editor: this.editor
        })?.catch((e: any) => {
          console.error(e)
        })
        return true
      }
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('onReturnHandler'),
        props: {
          handleDOMEvents: {
            keydown: (view: any, event: any) => this.editor.commands.onReturn(event, view, this.options.onHandleDOMEvents)
          },
          handleKeyDown: (view: any, event: any) => this.editor.commands.onReturn(event, view, this.options.onHandleKeyDown)
        }
      })
    ]
  },
  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.insertContent({ type: 'paragraph' }),
      'Shift-Enter': () => this.editor.commands.setHardBreak(),
    }
  }
})
