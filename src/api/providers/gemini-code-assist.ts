import type { Anthropic } from "@anthropic-ai/sdk"
// Use our standalone implementations to completely avoid OpenTelemetry dependencies
import { AuthType, MinimalConfig, generateSessionId } from "./gemini-code-assist-config.js"
import { getOauthClient } from "./gemini-code-assist-oauth.js"
import { CodeAssistServer } from "./gemini-code-assist-server.js"
import type {
	GenerateContentResponseUsageMetadata,
	GenerateContentParameters,
	GenerateContentConfig,
	GenerateContentResponse,
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
			// Use taskId as session ID for per-chat token tracking, fallback to CLI default if not available
			// Create a minimal config object for OAuth
			const config = new MinimalConfig({
				sessionId: taskId || generateSessionId(),
			})

			// Determine the actual project ID to use
			const projectId =
				this.options.geminiCliProjectId && this.options.geminiCliProjectId.trim()
					? this.options.geminiCliProjectId.trim()
					: ""

			console.log(
				`codeassist: Project ID handling - raw: '${this.options.geminiCliProjectId}', processed: '${projectId}'`,
			)

			// Set the project ID environment variable for CLI authentication if provided
			if (projectId) {
				process.env.GOOGLE_CLOUD_PROJECT = projectId
				console.log(`codeassist: Set GOOGLE_CLOUD_PROJECT to: ${projectId}`)
			} else {
				console.log(`codeassist: Using personal account (no project ID)`)
				// Ensure environment variable is not set for personal accounts
				delete process.env.GOOGLE_CLOUD_PROJECT
			}

			const oauthClient = await getOauthClient(AuthType.LOGIN_WITH_GOOGLE, config)
			this.server = new CodeAssistServer(
				oauthClient,
				// Pass undefined for personal accounts, only pass actual project ID for organizational accounts
				projectId,
				undefined,
				config.getSessionId(),
			)

			console.log(`codeassist: CodeAssistServer created with projectId: ${projectId}`)

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
		const { id: model, info, reasoning: thinkingConfig, maxTokens } = this.getModel()
		const contents = messages.map(convertAnthropicMessageToGemini)

		try {
			const result = await this.withOAuthRetry(async () => {
				const server = await this.getCodeAssistServer(metadata?.taskId)

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

				return await server.generateContentStream(params)
			})

			yield* this.processStreamingResponse(result)
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

	/**
	 * Wrapper that handles OAuth authentication errors and retries
	 */
	private async withOAuthRetry<T>(operation: () => Promise<T>): Promise<T> {
		try {
			return await operation()
		} catch (error) {
			// Debug: Log the exact error we received
			process.stdout.write(`codeassist: ERROR CAUGHT - Type: ${typeof error}\n`)
			process.stdout.write(`codeassist: ERROR CAUGHT - String: ${String(error)}\n`)

			// Check if this is a 403 authentication error
			const errorMessage = error instanceof Error ? error.message : String(error)
			process.stdout.write(`codeassist: Full error object: ${JSON.stringify(error, null, 2)}\n`)
			process.stdout.write(`codeassist: Checking for 403 error in: ${errorMessage}\n`)

			// Check for both 403 authentication errors AND 400 invalid resource errors (which can happen with personal accounts)
			if (
				/*errorMessage.includes('403') ||*/ errorMessage.includes("PERMISSION_DENIED") ||
				errorMessage.includes("unregistered callers")
			) {
				// || errorMessage.includes('Invalid resource field value')) {
				// Clear cached credentials and trigger re-authentication
				process.stdout.write(
					"codeassist: Authentication error detected, clearing cached credentials and triggering re-auth...\n",
				)
				try {
					// Clear the cached credentials
					const { clearCachedCredentialFile } = await import("./gemini-code-assist-oauth.js")
					await clearCachedCredentialFile()

					// Reset the server instance to force re-authentication
					this.server = null

					// Retry the operation with fresh authentication
					return await operation()
				} catch (retryError) {
					throw new Error(
						`Code Assist authentication failed. Please check your Google Cloud project ID and ensure you have access to Code Assist. Original error: ${errorMessage}`,
					)
				}
			}

			throw new Error(`Code Assist API error: ${errorMessage}`)
		}
	}

	/**
	 * Process streaming response chunks and yield appropriate types
	 */
	private async *processStreamingResponse(result: AsyncGenerator<GenerateContentResponse>): ApiStream {
		let lastUsageMetadata: GenerateContentResponseUsageMetadata | undefined
		process.stdout.write(`codeassist: Streaming response received\n${JSON.stringify(result, null, 2)}`)
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
			} else if (chunk.text) {
				// Handle direct text chunks
				yield { type: "text", text: chunk.text }
			}

			// Capture usage metadata
			if (chunk.usageMetadata) {
				lastUsageMetadata = chunk.usageMetadata
			}
		}

		// Yield usage information if available
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
				totalCost: 0,
			}
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: model } = this.getModel()

		return this.withOAuthRetry(async () => {
			const server = await this.getCodeAssistServer()

			const result = await server.generateContent({
				model,
				contents: convertAnthropicContentToGemini([{ type: "text", text: prompt }]),
				config: {
					temperature: this.options.modelTemperature ?? 0,
				},
			})

			return result.text ?? ""
		})
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
