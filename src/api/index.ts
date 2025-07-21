import { Anthropic } from "@anthropic-ai/sdk"

import type { ProviderSettings, ModelInfo } from "@roo-code/types"

import { ApiStream } from "./transform/stream"

import {
	GlamaHandler,
	AnthropicHandler,
	AwsBedrockHandler,
	OpenRouterHandler,
	VertexHandler,
	AnthropicVertexHandler,
	OpenAiHandler,
	OllamaHandler,
	LmStudioHandler,
	GeminiHandler,
	GeminiCliHandler,
	OpenAiNativeHandler,
	DeepSeekHandler,
	MistralHandler,
	VsCodeLmHandler,
	UnboundHandler,
	RequestyHandler,
	HumanRelayHandler,
	FakeAIHandler,
	XAIHandler,
	GroqHandler,
	ChutesHandler,
	LiteLLMHandler,
	ClaudeCodeHandler,
} from "./providers"

export interface SingleCompletionHandler {
	completePrompt(prompt: string): Promise<string>
}

export interface ApiHandlerCreateMessageMetadata {
	mode?: string
	taskId: string
}

export interface ApiHandler {
	createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream

	getModel(): { id: string; info: ModelInfo }

	/**
	 * Counts tokens for content blocks
	 * All providers extend BaseProvider which provides a default tiktoken implementation,
	 * but they can override this to use their native token counting endpoints
	 *
	 * @param content The content to count tokens for
	 * @returns A promise resolving to the token count
	 */
	countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number>
}

const providerMap: Record<string, new (options: any) => ApiHandler> = {
	anthropic: AnthropicHandler,
	"claude-code": ClaudeCodeHandler,
	glama: GlamaHandler,
	openrouter: OpenRouterHandler,
	bedrock: AwsBedrockHandler,
	openai: OpenAiHandler,
	ollama: OllamaHandler,
	lmstudio: LmStudioHandler,
	gemini: GeminiHandler,
	"gemini-cli": GeminiCliHandler,
	"openai-native": OpenAiNativeHandler,
	deepseek: DeepSeekHandler,
	"vscode-lm": VsCodeLmHandler,
	mistral: MistralHandler,
	unbound: UnboundHandler,
	requesty: RequestyHandler,
	"fake-ai": FakeAIHandler,
	xai: XAIHandler,
	groq: GroqHandler,
	chutes: ChutesHandler,
	litellm: LiteLLMHandler,
}

export function buildApiHandler(configuration: ProviderSettings): ApiHandler {
	const { apiProvider, ...options } = configuration

	switch (apiProvider) {
		case "vertex":
			return options.apiModelId?.startsWith("claude")
				? new AnthropicVertexHandler(options)
				: new VertexHandler(options)
		case "human-relay":
			return new HumanRelayHandler()
		default:
			if (apiProvider) {
				const Handler = providerMap[apiProvider]
				if (Handler) {
					return new Handler(options)
				}
			}
			return new AnthropicHandler(options)
	}
}
