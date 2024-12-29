import { Extension, Editor, JSONContent } from '@tiptap/core'

export const getOutput = (editor: Editor) => {
  const json: JSONContent = editor.getJSON();
  const html: string = editor.getHTML();
  const plainText: string = editor.getText({ blockSeparator: "\n\n" }).trim();

  return {
    json,
    html,
    plainText
  }
}

declare module '@tiptap/core' {
  // tslint:disable-next-line:interface-name
  interface Commands {
    getOutput: {
      getOutput: () => any
    }
  }
}

export const GetOutput = Extension.create({
  name: 'getOutput',
  addCommands() {
    return {
      getOutput: () => () => {
        return getOutput(this.editor)
      }
    }
  }
})