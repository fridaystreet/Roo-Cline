import TipTapHighlight from '@tiptap/extension-highlight'

export const Highlight = TipTapHighlight.extend({
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        const { empty, $anchor } = selection;
        const anchorPos = $anchor.pos;
        if (
          empty &&
          anchorPos === $anchor.start() &&
          editor.isActive('highlight')
        ) {
          editor.commands.toggleHighlight()
          return true
        }
        return false
      }
    }
  }
})