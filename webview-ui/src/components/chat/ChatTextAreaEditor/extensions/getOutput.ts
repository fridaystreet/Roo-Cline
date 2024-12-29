import { Editor } from '@tiptap/core'

export const getOutput = (editor: Editor) => {
  const json = editor.getJSON();
  const html = editor.getHTML();
  const plainText = editor.getText({ blockSeparator: "\n\n" }).trim();

  return {
    json,
    html,
    plainText
  }
}

// declare module '@tiptap/core' {
//   // tslint:disable-next-line:interface-name
//   interface Commands<ReturnType> {
//     getOutput: {
//       getOutput: () => ReturnType
//     }
//   }
// }

// export const GetOutput = Extension.create({
//   name: 'getOutput',
//   addCommands() {
//     return {
//       getOutput: () => () => {
//         return getOutput(this.editor)
//       }
//     }
//   }
// })