import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  // tslint:disable-next-line:interface-name
  interface Commands {
    getExtensionState: {
      getExtensionState: () => any
    }
  }
}

export const GetExtensionState = Extension.create({
  name: 'extensionState',
  addOptions() {
    return {
      state: null
    }
  },
  onBeforeCreate() {
    this.storage.extensionState = this.options.state
  },
  addStorage() {
    return {
      
    }
  },
  addCommands() {
    return {
      getExtensionState: () => () => {
        return this.options.state
      }
    }
  }
})