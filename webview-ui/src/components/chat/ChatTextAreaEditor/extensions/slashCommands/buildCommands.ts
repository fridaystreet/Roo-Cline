import {
  createSuggestionsItems,
} from "@harshtalks/slash-tiptap";
import {
	ApiConfiguration,
	// anthropicModels,
	// bedrockModels,
	// deepSeekModels,
	// geminiModels,
	// openAiNativeModels,
	// vertexModels,
} from "../../../../../../../src/shared/api"

const providers = [
  "openroute",
  "anthropic",
  "gemini",
  "deepseek",
  "openai-native",
  "openai",
  "vertex",
  "bedrock",
  "lmstudio",
  "ollama"
] 

export const buildCommands: any = (apiConfiguration: ApiConfiguration, setApiConfiguration: any, uriScheme: any) => createSuggestionsItems([
  {
    dynamicValues: (_: any, editor: any) => ({
      title: editor.storage.spellcheck.spellcheckEnabled ? "Disable Spellcheck" : "Enable Spellcheck"
    }),
    title: "Spellcheck",
    command: ({ editor }: any) => {
      setApiConfiguration({ ...apiConfiguration, spellcheck: !editor.storage.spellcheck.spellcheckEnabled })
      const { from, to } = editor.commands.getFromLastMatch('/')
      editor
        .chain()
        .focus()
        .toggleSpellcheck()
        .deleteRange({ from, to })
        .run()
    }
  },
  ...providers.map((apiProvider: string) => ({
    isVisible: () => apiConfiguration.apiProvider !== apiProvider,
    title: `Set provider - ${apiProvider}`,
    command: ({ editor }: any) => {
      setApiConfiguration({ ...apiConfiguration, apiProvider })
      const { from, to } = editor.commands.getFromLastMatch('/')
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .run()
    }
  }))
])