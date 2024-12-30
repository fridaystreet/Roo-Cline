import { Extension, Editor } from '@tiptap/core'

export const getFromLastMatch = (match: string, editor: Editor) => {
  const text = editor.getText()
  const from = text.lastIndexOf(match)+1
  return { from, to: text.length+1 }
}

declare module '@tiptap/core' {
  // tslint:disable-next-line:interface-name
  interface Commands {
    getFromLastMatch: {
      getFromLastMatch: (match: string) => any
    }
  }
}

export const GetFromLastMatch = Extension.create({
  name: 'getFromLastMatch',
  addCommands() {
    return {
      getFromLastMatch: (match: string) => () => {
        return getFromLastMatch(match, this.editor)
      }
    }
  }
})