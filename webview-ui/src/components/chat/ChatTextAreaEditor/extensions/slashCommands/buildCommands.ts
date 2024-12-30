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

export const buildCommands: any = (apiConfiguration: ApiConfiguration, setApiConfiguration: any, uriScheme: any) => createSuggestionsItems([
  {
    dynamicValues: (_: any, editor: any) => ({
      title: editor.storage.spellcheck.spellcheckEnabled ? "Disable Spellcheck" : "Enable Spellcheck"
    }),
    title: "Spellcheck",
    command: ({ editor }: any) => {
      let { from, to }: any = editor.commands.getSelectedText()
      editor
        .chain()
        .focus()
        .toggleSpellcheck()
        .deleteRange({ from: from-1, to })
        .run()
    }
  },
  ...["openroute","anthropic","gemini","deepseek","openai-native","openai","vertex","bedrock","lmstudio","ollama"].map((apiProvider: string) => ({
    isVisible: () => apiConfiguration.apiProvider !== apiProvider,
    title: `Set provider - ${apiProvider}`,
    command: ({ editor }: any) => {
      setApiConfiguration({ ...apiConfiguration, apiProvider })
      let { from, to }: any = editor.commands.getSelectedText()
      editor
        .chain()
        .focus()
        .deleteRange({ from: from-1, to })
        .run()
    }
  }))
])