import { Extension, Editor } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'

interface OnReturnHandlerOptions {
  onReturn?: (args: { content: string, editor: Editor }) => Promise<void>;
}

const onReturn = (event: KeyboardEvent, editor: Editor, { onReturn }: OnReturnHandlerOptions) => {

  if (event.key !== "Enter" || event.shiftKey || event.metaKey) return;

  if (editor.isEmpty) return true;

  const { selection } = editor.view.state;
  const { anchor } = selection;

  const activePlugins = editor.state.plugins.filter((plugin: any) => {
    return plugin.name
  })

  if (activePlugins.length > 0) return;

  let nodes: string[] = [];

  editor.view.state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
    nodes.push(node.type.name);
  })

  if (nodes[0] !== 'paragraph') return


  if (typeof onReturn === 'function') {
    onReturn({
      content: editor.commands.getOutput().plainText,
      editor
    }).catch((e: any) => console.log(e));
    return true;
  }
};

export const OnReturnHandler = Extension.create({
  name: 'onReturnHandler',
  priority: 1000,
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('onReturnHandler'),
        props: {
          handleKeyDown: (_, event) => onReturn(event, this.editor, this.options)
        }
      })
    ]
  }
})
