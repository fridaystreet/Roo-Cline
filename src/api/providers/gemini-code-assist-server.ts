/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OAuth2Client } from "google-auth-library"
import {
	CountTokensParameters,
	CountTokensResponse,
	EmbedContentParameters,
	EmbedContentResponse,
	GenerateContentParameters,
	GenerateContentResponse,
} from "@google/genai"
import * as readline from "readline"
import { Readable } from "node:stream"

// Types from CLI core
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

export interface OnboardUserRequest {
	// Add fields as needed
	[key: string]: unknown
}

export interface LongrunningOperationResponse {
	// Add fields as needed
	[key: string]: unknown
}

export interface CodeAssistGlobalUserSettingResponse {
	// Add fields as needed
	[key: string]: unknown
}

export interface SetCodeAssistGlobalUserSettingRequest {
	// Add fields as needed
	[key: string]: unknown
}

export type UserTierId = "FREE" | "PREMIUM" | "ENTERPRISE"

interface ErrorData {
	error?: {
		message?: string
	}
}

interface GaxiosResponse {
	status: number
	data: unknown
}

interface StreamError extends Error {
	status?: number
	response?: GaxiosResponse
}

/** HTTP options to be used in each of the requests. */
export interface HttpOptions {
	/** Additional HTTP headers to be sent with the request. */
	headers?: Record<string, string>
}

export const CODE_ASSIST_ENDPOINT = "https://cloudcode-pa.googleapis.com"
export const CODE_ASSIST_API_VERSION = "v1internal"

// Exact CLI converter functions from converter.ts
function toGenerateContentRequest(req: GenerateContentParameters, project?: string, sessionId?: string): any {
	const request: any = {
		model: req.model,
		request: toVertexGenerateContentRequest(req, sessionId),
	}

	// Only include project field if it's actually provided (for organizational accounts)
	// For personal accounts, omit the field entirely
	if (project) {
		request.project = project
	}

	return request
}

function fromGenerateContentResponse(res: any): GenerateContentResponse {
	const inres = res.response
	const out = new GenerateContentResponse()
	out.candidates = inres.candidates
	out.automaticFunctionCallingHistory = inres.automaticFunctionCallingHistory
	out.promptFeedback = inres.promptFeedback
	out.usageMetadata = inres.usageMetadata
	return out
}

function toVertexGenerateContentRequest(req: GenerateContentParameters, sessionId?: string): any {
	return {
		contents: toContents(req.contents),
		systemInstruction: maybeToContent(req.config?.systemInstruction),
		cachedContent: req.config?.cachedContent,
		tools: req.config?.tools,
		toolConfig: req.config?.toolConfig,
		labels: req.config?.labels,
		safetySettings: req.config?.safetySettings,
		generationConfig: toVertexGenerationConfig(req.config),
		session_id: sessionId,
	}
}

function toContents(contents: any): any[] {
	if (Array.isArray(contents)) {
		// it's a Content[] or a PartsUnion[]
		return contents.map(toContent)
	}
	// it's a Content or a PartsUnion
	return [toContent(contents)]
}

function maybeToContent(content?: any): any | undefined {
	if (!content) {
		return undefined
	}
	return toContent(content)
}

function toContent(content: any): any {
	if (Array.isArray(content)) {
		// it's a PartsUnion[]
		return {
			role: "user",
			parts: toParts(content),
		}
	}
	if (typeof content === "string") {
		// it's a string
		return {
			role: "user",
			parts: [{ text: content }],
		}
	}
	if (content && typeof content === "object" && "parts" in content) {
		// it's a Content
		return content
	}
	// it's a Part
	return {
		role: "user",
		parts: [content],
	}
}

function toParts(parts: any[]): any[] {
	return parts.map(toPart)
}

function toPart(part: any): any {
	if (typeof part === "string") {
		// it's a string
		return { text: part }
	}
	return part
}

function toVertexGenerationConfig(config?: any): any | undefined {
	if (!config) {
		return undefined
	}
	return {
		temperature: config.temperature,
		topP: config.topP,
		topK: config.topK,
		candidateCount: config.candidateCount,
		maxOutputTokens: config.maxOutputTokens,
		stopSequences: config.stopSequences,
		responseLogprobs: config.responseLogprobs,
		logprobs: config.logprobs,
		presencePenalty: config.presencePenalty,
		frequencyPenalty: config.frequencyPenalty,
		seed: config.seed,
		responseMimeType: config.responseMimeType,
		responseSchema: config.responseSchema,
		routingConfig: config.routingConfig,
		modelSelectionConfig: config.modelSelectionConfig,
		responseModalities: config.responseModalities,
		mediaResolution: config.mediaResolution,
		speechConfig: config.speechConfig,
		audioTimestamp: config.audioTimestamp,
		thinkingConfig: config.thinkingConfig,
	}
}

function toCountTokenRequest(req: CountTokensParameters): any {
	return {
		request: {
			model: "models/" + req.model,
			contents: toContents(req.contents),
		},
	}
}

function fromCountTokenResponse(res: any): CountTokensResponse {
	return {
		totalTokens: res.totalTokens,
	}
}

export class CodeAssistServer {
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
		throw Error()
	}

	async requestPost<T>(method: string, req: object, signal?: AbortSignal): Promise<T> {
		try {
			const res = await this.client.request({
				url: this.getMethodUrl(method),
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...this.httpOptions.headers,
				},
				responseType: "json",
				body: JSON.stringify(req),
				signal,
			})
			return res.data as T
		} catch (error: any) {
			// Handle the specific "Invalid resource field value in the request" error
			// that occurs when personal accounts try to use Code Assist without a project ID
			const errorMessage = error?.message || String(error)
			const errorData = error?.response?.data || error?.data

			// Check for the specific invalid resource field error
			if (
				errorMessage.includes("Invalid resource field value") ||
				(errorData && JSON.stringify(errorData).includes("Invalid resource field value"))
			) {
				console.log("🔍 DEBUG: Detected invalid resource field error for personal account")

				// For personal accounts, this error can be safely ignored as it's expected
				// when no project ID is provided. Return a minimal successful response.
				if (method === "generateContent") {
					// Return a minimal response indicating personal account limitation
					return {
						candidates: [
							{
								content: {
									parts: [
										{
											text: "Code Assist requires a Google Cloud project ID for full functionality. Please add a project ID in the Gemini provider settings to use Code Assist, or use the regular Gemini API instead.",
										},
									],
								},
								finishReason: "STOP",
							},
						],
						usageMetadata: {
							promptTokenCount: 0,
							candidatesTokenCount: 0,
							totalTokenCount: 0,
						},
					} as T
				} else if (method === "countTokens") {
					// Return minimal token count response
					return {
						totalTokens: 0,
					} as T
				}
			}

			// Re-throw all other errors
			throw error
		}
	}

	async requestGet<T>(method: string, signal?: AbortSignal): Promise<T> {
		const res = await this.client.request({
			url: this.getMethodUrl(method),
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				...this.httpOptions.headers,
			},
			responseType: "json",
			signal,
		})
		return res.data as T
	}

	async requestStreamingPost<T>(method: string, req: object, signal?: AbortSignal): Promise<AsyncGenerator<T>> {
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
				// Try to extract error information from the response
				let errorMessage =
					"Response data is not a readable stream. This may indicate a server error or quota issue."

				if (res.data && typeof res.data === "object") {
					// Check if this is an error response with error details
					const errorData = res.data as ErrorData
					if (errorData.error?.message) {
						errorMessage = errorData.error.message
					} else if (typeof errorData === "string") {
						errorMessage = errorData
					}
				}

				// Create an error that looks like a quota error if it contains quota information
				const error: StreamError = new Error(errorMessage)
				// Add status and response properties so it can be properly handled by retry logic
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

	async getTier(): Promise<UserTierId | undefined> {
		if (this.userTier === undefined) {
			await this.detectUserTier()
		}
		return this.userTier
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
			// We'll default to FREE tier behavior if tier detection fails
			console.debug("User tier detection failed:", error)
		}
	}

	getMethodUrl(method: string): string {
		const endpoint = process.env.CODE_ASSIST_ENDPOINT ?? CODE_ASSIST_ENDPOINT
		return `${endpoint}/${CODE_ASSIST_API_VERSION}:${method}`
	}
}
