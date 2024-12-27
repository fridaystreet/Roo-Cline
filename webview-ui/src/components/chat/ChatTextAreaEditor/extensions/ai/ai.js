import { Extension } from '@tiptap/core'


const getSelectedText = (editor) => {

  const { selection, doc } = editor.view.state
  const { from, to } = selection
  const text = doc.textBetween(from, to, ' ')

  if (text.match(/<(.*)>.?|<(.*) \/>/)) {
    return
  }
  if ((text.split(' ').length < 2 || text.length < 4)) return

  return {
    from,
    to,
    text
  }
}

export const AIExtension = Extension.create({
  name: 'ai',

  addOptions() {
    return {
      processCommand: () => null,
      onError: ()=> null,
      onLoading: () => null,
      onSuccess: () => null
    }
  },

  addStorage() {
    return {
      error: null,
      loading: false
    }
  },

  addCommands() {
    const _this = this
    return {
      aiCommand: (command, params) => async ({ commands }) => {

        let editable = _this.editor.isEditable
        try {
          const { text, from, to } = getSelectedText(_this.editor)
          if (!text) {
            throw new Error('no text selected')
          }

          _this.editor.setEditable(false)
          _this.storage.loading = true
          if (typeof _this.options.onLoading === 'function') _this.options.onLoading(true)
          _this.storage.error = undefined

          const answer = await _this.options.processCommand({
            command,
            text,
            params
          })
          if (!answer?.length) throw new Error('no result')

          let node = {
            type: 'text',
            text: answer,
          }
          if (command === 'generateImage') {
            node = {
              type: 'link',
              attrs: {
                href: answer,
                value: text
              }
            }
          }

          _this.editor
            .chain()
            .focus()
            .deleteRange({ from, to })
            .run()

            _this.editor
          .chain()
          .focus()
          .insertContentAt(from, [node])
          .run()


          if (typeof _this.options.onSuccess === 'function') _this.options.onSuccess({
            command,
            text,
            params,
            answer
          })
        } catch(e) {
          //handle error
          if (typeof _this.options.onError === 'function') _this.options.onError(e.message)
          _this.storage.error = e.message
        }
        _this.editor.setEditable(editable)
        _this.storage.loading = false
      }
    }
  },

  // addKeyboardShortcuts() {
  //   return {
  //     // 'Mod-Shift-l': () => this.editor.commands.setTextAlign('left')
  //   }
  // },
})
