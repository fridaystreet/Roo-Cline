/**
 * Standalone CodeAssistServer implementation for Gemini Code Assist provider
 * This replicates the essential functionality from @google/gemini-cli-core
 * without the telemetry dependencies that cause OpenTelemetry import issues
 */

import { OAuth2Client } from "google-auth-library"
import * as readline from "readline"
import { Readable } from "node:stream"
import type {
	CountTokensParameters,
	CountTokensResponse,
	EmbedContentParameters,
	EmbedContentResponse,
	GenerateContentParameters,
	GenerateContentResponse,
} from "@google/genai"

// Types from gemini-cli (replicated to avoid imports)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CodeAssistGlobalUserSettingResponse {
	// Add fields as needed
}

export interface LoadCodeAssistRequest {
	cloudaicompanionProject: string
	metadata: {
		ideType: string
		platform: string
		pluginType: string
		duetProject: string
	}
}

export interface LoadCodeAssistResponse {
	currentTier?: {
		id: UserTierId
	}
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LongrunningOperationResponse {
	// Add fields as needed
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface OnboardUserRequest {
	// Add fields as needed
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SetCodeAssistGlobalUserSettingRequest {
	// Add fields as needed
}

export type UserTierId = "FREE" | "PREMIUM" | string

// Internal types
interface ErrorData {
	error?: {
		message?: string
	}
	message?: string
}

interface GaxiosResponse {
	status: number
	data: unknown
}

interface StreamError extends Error {
	status?: number
	response?: GaxiosResponse
}

export interface HttpOptions {
	headers?: Record<string, string>
}

// Code Assist API constants
export const CODE_ASSIST_ENDPOINT = "https://cloudcode-pa.googleapis.com"
export const CODE_ASSIST_API_VERSION = "v1internal"

// Converter functions (exact CLI implementation)
function toGenerateContentRequest(req: GenerateContentParameters, project?: string, sessionId?: string): any {
	// Match exact CLI structure from converter.ts
	return {
		model: req.model,
		project,
		request: {
			contents: req.contents,
			systemInstruction: req.config?.systemInstruction,
			cachedContent: req.config?.cachedContent,
			tools: req.config?.tools,
			toolConfig: req.config?.toolConfig,
			labels: req.config?.labels,
			safetySettings: req.config?.safetySettings,
			generationConfig: {
				temperature: req.config?.temperature,
				topP: req.config?.topP,
				topK: req.config?.topK,
				candidateCount: req.config?.candidateCount,
				maxOutputTokens: req.config?.maxOutputTokens,
				stopSequences: req.config?.stopSequences,
				responseLogprobs: req.config?.responseLogprobs,
				logprobs: req.config?.logprobs,
				presencePenalty: req.config?.presencePenalty,
				frequencyPenalty: req.config?.frequencyPenalty,
				seed: req.config?.seed,
				responseMimeType: req.config?.responseMimeType,
				responseSchema: req.config?.responseSchema,
			},
			session_id: sessionId,
		},
	}
}

function fromGenerateContentResponse(resp: any): GenerateContentResponse {
	return resp as GenerateContentResponse
}

function toCountTokenRequest(req: CountTokensParameters): any {
	return req
}

function fromCountTokenResponse(resp: any): CountTokensResponse {
	return resp as CountTokensResponse
}

/**
 * Standalone CodeAssistServer class
 * Replicates the essential functionality from @google/gemini-cli-core without telemetry dependencies
 */
export class StandaloneCodeAssistServer {
	private userTier: UserTierId | undefined = undefined

	constructor(
		readonly client: OAuth2Client,
		readonly projectId?: string,
		readonly httpOptions: HttpOptions = {},
		readonly sessionId?: string,
	) {}

	async generateContentStream(req: GenerateContentParameters): Promise<AsyncGenerator<GenerateContentResponse>> {
		const resps = await this.requestStreamingPost<any>(
			"streamGenerateContent",
			toGenerateContentRequest(req, this.projectId, this.sessionId),
			req.config?.abortSignal,
		)
		return (async function* (): AsyncGenerator<GenerateContentResponse> {
			for await (const resp of resps) {
				yield fromGenerateContentResponse(resp)
			}
		})()
	}

	async generateContent(req: GenerateContentParameters): Promise<GenerateContentResponse> {
		const resp = await this.requestPost<any>(
			"generateContent",
			toGenerateContentRequest(req, this.projectId, this.sessionId),
			req.config?.abortSignal,
		)
		return fromGenerateContentResponse(resp)
	}

	async onboardUser(req: OnboardUserRequest): Promise<LongrunningOperationResponse> {
		return await this.requestPost<LongrunningOperationResponse>("onboardUser", req)
	}

	async loadCodeAssist(req: LoadCodeAssistRequest): Promise<LoadCodeAssistResponse> {
		return await this.requestPost<LoadCodeAssistResponse>("loadCodeAssist", req)
	}

	async getCodeAssistGlobalUserSetting(): Promise<CodeAssistGlobalUserSettingResponse> {
		return await this.requestGet<CodeAssistGlobalUserSettingResponse>("getCodeAssistGlobalUserSetting")
	}

	async setCodeAssistGlobalUserSetting(
		req: SetCodeAssistGlobalUserSettingRequest,
	): Promise<CodeAssistGlobalUserSettingResponse> {
		return await this.requestPost<CodeAssistGlobalUserSettingResponse>("setCodeAssistGlobalUserSetting", req)
	}

	async countTokens(req: CountTokensParameters): Promise<CountTokensResponse> {
		const resp = await this.requestPost<any>("countTokens", toCountTokenRequest(req))
		return fromCountTokenResponse(resp)
	}

	async embedContent(_req: EmbedContentParameters): Promise<EmbedContentResponse> {
		throw new Error("embedContent not implemented")
	}

	async getTier(): Promise<UserTierId | undefined> {
		if (this.userTier === undefined) {
			await this.detectUserTier()
		}
		return this.userTier
	}

	private async requestPost<T>(method: string, req: object, signal?: AbortSignal): Promise<T> {
		const res = await this.client.request({
			url: this.getMethodUrl(method),
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...this.httpOptions.headers,
			},
			body: JSON.stringify(req),
			signal,
		})

		return res.data as T
	}

	private async requestGet<T>(method: string, signal?: AbortSignal): Promise<T> {
		const res = await this.client.request({
			url: this.getMethodUrl(method),
			method: "GET",
			headers: {
				...this.httpOptions.headers,
			},
			signal,
		})

		return res.data as T
	}

	private async requestStreamingPost<T>(
		method: string,
		req: object,
		signal?: AbortSignal,
	): Promise<AsyncGenerator<T>> {
		const res = await this.client.request({
			url: this.getMethodUrl(method),
			method: "POST",
			params: {
				alt: "sse",
			},
			headers: {
				"Content-Type": "application/json",
				...this.httpOptions.headers,
			},
			responseType: "stream",
			body: JSON.stringify(req),
			signal,
		})

		return (async function* (): AsyncGenerator<T> {
			// Convert ReadableStream to Node.js stream if needed
			let nodeStream: NodeJS.ReadableStream

			if (res.data instanceof ReadableStream) {
				// Convert Web ReadableStream to Node.js Readable stream
				nodeStream = Readable.fromWeb(res.data as any)
			} else if (res.data && typeof (res.data as NodeJS.ReadableStream).on === "function") {
				// Already a Node.js stream
				nodeStream = res.data as NodeJS.ReadableStream
			} else {
				// If res.data is not a stream, it might be an error response
				let errorMessage =
					"Response data is not a readable stream. This may indicate a server error or quota issue."

				if (res.data && typeof res.data === "object") {
					const errorData = res.data as ErrorData
					if (errorData.error?.message) {
						errorMessage = errorData.error.message
					} else if (typeof errorData === "string") {
						errorMessage = errorData
					}
				}

				const error: StreamError = new Error(errorMessage)
				error.status = res.status
				error.response = res
				throw error
			}

			const rl = readline.createInterface({
				input: nodeStream,
				crlfDelay: Infinity, // Recognizes '\r\n' and '\n' as line breaks
			})

			let bufferedLines: string[] = []
			for await (const line of rl) {
				// blank lines are used to separate JSON objects in the stream
				if (line === "") {
					if (bufferedLines.length === 0) {
						continue // no data to yield
					}
					yield JSON.parse(bufferedLines.join("\n")) as T
					bufferedLines = [] // Reset the buffer after yielding
				} else if (line.startsWith("data: ")) {
					bufferedLines.push(line.slice(6).trim())
				} else {
					throw new Error(`Unexpected line format in response: ${line}`)
				}
			}
		})()
	}

	private async detectUserTier(): Promise<void> {
		try {
			// Reset user tier when detection runs
			this.userTier = undefined

			// Only attempt tier detection if we have a project ID
			if (this.projectId) {
				const loadRes = await this.loadCodeAssist({
					cloudaicompanionProject: this.projectId,
					metadata: {
						ideType: "IDE_UNSPECIFIED",
						platform: "PLATFORM_UNSPECIFIED",
						pluginType: "GEMINI",
						duetProject: this.projectId,
					},
				})
				if (loadRes.currentTier) {
					this.userTier = loadRes.currentTier.id
				}
			}
		} catch (error) {
			// Silently fail - this is not critical functionality
			console.debug("User tier detection failed:", error)
		}
	}

	private getMethodUrl(method: string): string {
		const endpoint = process.env.CODE_ASSIST_ENDPOINT ?? CODE_ASSIST_ENDPOINT
		return `${endpoint}/${CODE_ASSIST_API_VERSION}:${method}`
	}
}
