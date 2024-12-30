import { Extension, Editor } from '@tiptap/core'

export const getSelectedText = (editor: Editor) => {

  const { selection, doc } = editor.view.state
  const { from, to } = selection
  let text: any = doc.textBetween(from, to, ' ')

  if (text.match(/<(.*)>.?|<(.*) \/>/)) {
    return
  }
  if ((text.split(' ').length < 2 || text.length < 4)) {
    text = undefined
  }

  return {
    from,
    to,
    text
  }
}

declare module '@tiptap/core' {
  // tslint:disable-next-line:interface-name
  interface Commands {
    getSelectedText: {
      getSelectedText: () => any
    }
  }
}

export const GetSelectedText = Extension.create({
  name: 'getOutput',
  addCommands() {
    return {
      getSelectedText: () => () => {
        return getSelectedText(this.editor)
      }
    }
  }
})