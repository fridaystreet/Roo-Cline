import { Extension, Editor } from '@tiptap/core'
import { selectAll } from 'prosemirror-commands';
import { vscode } from "../../../../../utils/vscode"


interface AIResponseParams {
  text: string,
  answer: string,
  from: number,
  to: number,
  command?: string,
  params?: any
}
// typescript definition of commands
declare module '@tiptap/core' {
  // tslint:disable-next-line:interface-name
  interface Commands<ReturnType> {
    ai: {
      aiCommand: (command: string, params?: any) => ReturnType,
      processAiResponse: (arg0: AIResponseParams) => ReturnType
    }
  }
}

const getSelectedText = (editor: Editor) => {

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

const getMessageHandler = (editor: Editor, storage: any) => (event: MessageEvent) => {
  const message = event.data
  if (message.type === 'enhancedPrompt' && message.text) {
    storage.isEnhancing = false
    if (storage.request) {
      editor.commands.processAiResponse({ ...storage.request, answer: message.text })
    }
  }
}
export const AIExtension = Extension.create({
  name: 'ai',

  addOptions() {
    return {
      enhancingMessage: 'Generating new content...',
      onError: ()=> null,
      onLoading: () => null,
      onSuccess: () => null
    }
  },

  addStorage() {
    return {
      error: null,
      isEnhancing: false,
      request: null
    }
  },

  addCommands() {
    const _this = this
    return {
      processAiResponse: ({
        text,
        answer,
        from,
        to,
        command,
        params
      }) => () => {
        if (!answer?.length) throw new Error('no result')

        let node: any = {
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
        return true
      },
      aiCommand: (command: string, params?: any) =>  ({ state, dispatch, commands }) => {
        const execute = async () => {
          // if (_this.storage.isEnhancing) {
          //   throw new Error('Request processing')
          // }

          let editable = _this.editor.isEditable
          try {
            let { text, from, to }: any = getSelectedText(_this.editor)
            if (!text) {
              if (params?.onlySelected) {
                throw new Error('no text selected')
              }
              text = _this.editor.getText({ blockSeparator: "\n\n" }).trim();
              from = 1
              to = text.length || 1
            }

            _this.storage.error = undefined
            const trimmedInput: string = text.trim()
            if (trimmedInput?.length) {
              _this.editor.setEditable(false)
              _this.storage.isEnhancing = true
              if (typeof _this.options.onLoading === 'function') _this.options.onLoading(true)

              const message = {
                type: "enhancePrompt" as const,
                text: trimmedInput,
                command,
                params
              }

              const answer = this.options.enhancingMessage

              _this.storage.request = {
                text,
                from,
                to: answer.length+1,
                command,
                params
              }

              
              commands.processAiResponse({
                ..._this.storage.request,
                to: to+1,
                answer
              })
              

              vscode.postMessage(message)
            } else {
              const answer = "The 'Enhance Prompt' button helps improve your prompt by providing additional context, clarification, or rephrasing. Try typing a prompt in here and clicking the button again to see how it works."
              commands.processAiResponse({
                text: "",
                from: 1,
                to: 1,
                answer
              })
            }
          } catch (e: any | unknown) {
            //handle error
            if (typeof _this.options.onError === 'function') _this.options.onError(e.message)
            _this.storage.error = e.message
          }
          _this.editor.setEditable(editable)
          _this.storage.loading = false
        }
        execute()
        return true
      }
    }
  },

  onCreate() {
    window.addEventListener('message', getMessageHandler(this.editor, this.storage))
  },

  onDestroy() {
    window.removeEventListener('message', getMessageHandler(this.editor, this.storage))
  }
})