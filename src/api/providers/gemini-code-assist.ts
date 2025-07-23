import type { Anthropic } from "@anthropic-ai/sdk"
// Use our standalone implementations to completely avoid OpenTelemetry dependencies
import { AuthType, MinimalConfig, generateSessionId } from "./gemini-code-assist-config.js"
import { getOauthClient } from "./gemini-code-assist-oauth.js"
import { CodeAssistServer } from "./gemini-code-assist-server.js"
import type {
	GenerateContentResponseUsageMetadata,
	GenerateContentParameters,
	GenerateContentConfig,
} from "@google/genai"

import { type ModelInfo, type GeminiModelId, geminiDefaultModelId, geminiModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { convertAnthropicMessageToGemini, convertAnthropicContentToGemini } from "../transform/gemini-format"
import type { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { BaseProvider } from "./base-provider"

export class GeminiCodeAssistHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private server: CodeAssistServer | null = null

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
	}

	private async getCodeAssistServer(taskId?: string): Promise<any> {
		if (this.server) {
			return this.server
		}

		try {
			// Get the model from options
			const { id: modelId } = this.getModel()

			// Use taskId as session ID for per-chat token tracking, fallback to CLI default if not available
			// Create a minimal config object for OAuth
			const config = new MinimalConfig({
				sessionId: taskId || generateSessionId(),
			})

			// Set the project ID environment variable for CLI authentication
			process.env.GOOGLE_CLOUD_PROJECT = this.options.geminiCliProjectId

			const oauthClient = await getOauthClient(AuthType.LOGIN_WITH_GOOGLE, config)
			this.server = new CodeAssistServer(
				oauthClient,
				this.options.geminiCliProjectId,
				undefined,
				config.getSessionId(),
			)

			return this.server
		} catch (error) {
			throw new Error(`Failed to initialize Code Assist server: ${error}`)
		}
	}

	async *createMessage(
		systemInstruction: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		try {
			const server = await this.getCodeAssistServer(metadata?.taskId)
			const { id: model, info, reasoning: thinkingConfig, maxTokens } = this.getModel()

			const contents = messages.map(convertAnthropicMessageToGemini)

			// Format request to match CLI's GenerateContentParameters structure
			const params = {
				model,
				contents,
				config: {
					systemInstruction: systemInstruction
						? { role: "system", parts: [{ text: systemInstruction }] }
						: undefined,
					maxOutputTokens: this.options.modelMaxTokens ?? maxTokens ?? undefined,
					temperature: this.options.modelTemperature ?? 0,
				},
			}

			// The server will convert this to CAGenerateContentRequest format internally
			const result = await server.generateContentStream(params)

			let lastUsageMetadata: GenerateContentResponseUsageMetadata | undefined

			for await (const chunk of result) {
				// Process candidates and their parts to separate thoughts from content
				if (chunk.candidates && chunk.candidates.length > 0) {
					const candidate = chunk.candidates[0]
					if (candidate.content && candidate.content.parts) {
						for (const part of candidate.content.parts) {
							if (part.thought) {
								// This is a thinking/reasoning part
								if (part.text) {
									yield { type: "reasoning", text: part.text }
								}
							} else {
								// This is regular content
								if (part.text) {
									yield { type: "text", text: part.text }
								}
							}
						}
					}
				}
				// Fallback to the original text property if no candidates structure
				else if (chunk.text) {
					yield { type: "text", text: chunk.text }
				}

				if (chunk.usageMetadata) {
					lastUsageMetadata = chunk.usageMetadata
				}
			}

			if (lastUsageMetadata) {
				const inputTokens = lastUsageMetadata.promptTokenCount ?? 0
				const outputTokens = lastUsageMetadata.candidatesTokenCount ?? 0
				const cacheReadTokens = lastUsageMetadata.cachedContentTokenCount
				const reasoningTokens = lastUsageMetadata.thoughtsTokenCount

				yield {
					type: "usage",
					inputTokens,
					outputTokens,
					cacheReadTokens,
					reasoningTokens,
					// Code Assist uses quota-based pricing, not per-token billing
					totalCost: undefined,
				}
			}
		} catch (error) {
			throw new Error(`Code Assist API error: ${error}`)
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in geminiModels ? (modelId as GeminiModelId) : geminiDefaultModelId
		const info: ModelInfo = geminiModels[id]
		const params = getModelParams({ format: "gemini", modelId: id, model: info, settings: this.options })

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Gemini's API does not have this
		// suffix.
		return { id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id, info, ...params }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const server = await this.getCodeAssistServer()
			const { id: model } = this.getModel()

			// Use proper CLI converter functions like in createMessage
			const result = await server.generateContent({
				model,
				contents: convertAnthropicContentToGemini([{ type: "text", text: prompt }]), // Convert string to proper format
				config: {
					temperature: this.options.modelTemperature ?? 0,
				},
			})

			return result.text ?? ""
		} catch (error) {
			throw new Error(`Code Assist completion error: ${error}`)
		}
	}

	override async countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		try {
			const server = await this.getCodeAssistServer()
			const { id: model } = this.getModel()

			const response = await server.countTokens({
				model,
				project: this.options.geminiCliProjectId,
				request: {
					contents: convertAnthropicContentToGemini(content),
				},
			})

			if (response.totalTokens === undefined) {
				console.warn("Code Assist token counting returned undefined, using fallback")
				return super.countTokens(content)
			}

			return response.totalTokens
		} catch (error) {
			console.warn("Code Assist token counting failed, using fallback", error)
			return super.countTokens(content)
		}
	}

	public calculateCost({
		info,
		inputTokens,
		outputTokens,
		cacheReadTokens = 0,
	}: {
		info: ModelInfo
		inputTokens: number
		outputTokens: number
		cacheReadTokens?: number
	}) {
		// Code Assist uses quota-based pricing, not per-token billing
		// Return undefined to indicate no cost calculation available
		return undefined
	}
}
