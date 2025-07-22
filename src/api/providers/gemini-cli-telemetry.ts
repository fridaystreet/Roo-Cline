/**
 * Final Working Gemini CLI OTLP Telemetry Receiver
 *
 * Based on validation findings:
 * - CLI uses HTTP/2 POST with gRPC message framing and gzip compression
 * - Official OpenTelemetry protobuf decoder works perfectly
 * - Correlation via prompt_id (primary) and response_text (secondary)
 * - Token usage available in api_response event
 */

import { createServer, IncomingMessage, ServerResponse } from "http"
import { TokenUsage } from "@roo-code/types"
import { gunzipSync } from "zlib"

interface TelemetryEvent {
	eventName: string
	promptId?: string
	prompt?: string
	requestText?: string
	responseText?: string
	inputTokenCount?: number
	outputTokenCount?: number
	cachedContentTokenCount?: number
	thoughtsTokenCount?: number
	toolTokenCount?: number
	totalTokenCount?: number
	timestamp?: string
	sessionId?: string
}

interface PendingRequest {
	requestId: string
	responseText?: string
	startTime: number
	resolve: (tokenUsage: TokenUsage | null) => void
	timeout: NodeJS.Timeout
}

export class GeminiCliTelemetryReceiver {
	private server: any = null
	private port: number = 0
	private isShuttingDown: boolean = false
	private pendingRequests = new Map<string, PendingRequest>()
	private readonly REQUEST_TIMEOUT_MS = 30000 // 30 seconds

	constructor() {
		// Auto-cleanup on process exit
		process.on("exit", () => this.shutdown())
		process.on("SIGINT", () => this.shutdown())
		process.on("SIGTERM", () => this.shutdown())
	}

	/**
	 * Start the telemetry receiver on an available port
	 */
	async start(): Promise<number> {
		if (this.server) {
			throw new Error("Telemetry receiver already started")
		}

		if (this.isShuttingDown) {
			throw new Error("Telemetry receiver is shutting down")
		}

		this.server = createServer((req, res) => {
			console.log(`[GeminiCliTelemetryReceiver] Received ${req.method} request to ${req.url}`)
			this.handleHttpRequest(req, res)
		})

		// Start server on random available port
		return new Promise((resolve, reject) => {
			this.server!.listen(0, "127.0.0.1", () => {
				const address = this.server!.address()
				if (!address || typeof address === "string") {
					reject(new Error("Failed to get server address"))
					return
				}

				this.port = address.port
				console.log(`[GeminiCliTelemetryReceiver] Started HTTP OTLP receiver on port ${this.port}`)
				resolve(this.port)
			})

			this.server!.on("error", (error: Error) => {
				reject(error)
			})
		})
	}

	/**
	 * Register a request and wait for its telemetry data
	 */
	async waitForTelemetry(requestId: string, expectedResponseText?: string): Promise<TokenUsage | null> {
		return new Promise((resolve) => {
			const timeout = setTimeout(() => {
				console.log(`[GeminiCliTelemetryReceiver] Request ${requestId} timed out waiting for telemetry`)
				this.pendingRequests.delete(requestId)
				resolve(null)
			}, this.REQUEST_TIMEOUT_MS)

			this.pendingRequests.set(requestId, {
				requestId,
				responseText: expectedResponseText,
				startTime: Date.now(),
				resolve,
				timeout,
			})

			console.log(`[GeminiCliTelemetryReceiver] Registered request ${requestId} for telemetry correlation`)
		})
	}

	/**
	 * Handle incoming HTTP requests (OTLP telemetry data)
	 */
	private async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
		if (req.method !== "POST") {
			res.writeHead(405, { "Content-Type": "text/plain" })
			res.end("Method Not Allowed")
			return
		}

		try {
			// Collect request body
			const chunks: Buffer[] = []
			req.on("data", (chunk: Buffer) => {
				chunks.push(chunk)
			})

			req.on("end", () => {
				try {
					const body = Buffer.concat(chunks)
					this.processTelemetryData(body, req.headers)

					// Send gRPC success response
					res.writeHead(200, {
						"Content-Type": "application/grpc",
						"grpc-status": "0",
						"grpc-message": "OK",
					})
					res.end()
				} catch (error) {
					console.error("[GeminiCliTelemetryReceiver] Error processing telemetry:", error)
					res.writeHead(500, { "Content-Type": "text/plain" })
					res.end("Internal Server Error")
				}
			})

			req.on("error", (error) => {
				console.error("[GeminiCliTelemetryReceiver] Request error:", error)
				res.writeHead(400, { "Content-Type": "text/plain" })
				res.end("Bad Request")
			})
		} catch (error) {
			console.error("[GeminiCliTelemetryReceiver] Error handling request:", error)
			res.writeHead(500, { "Content-Type": "text/plain" })
			res.end("Internal Server Error")
		}
	}

	/**
	 * Process incoming telemetry data using official OpenTelemetry protobuf decoder
	 */
	private processTelemetryData(body: Buffer, headers: any): void {
		try {
			// Handle gRPC message framing (5-byte header + payload)
			let protobufMessage = body
			if (body.length > 5 && body[0] === 0) {
				// Skip gRPC message header (5 bytes: compression flag + message length)
				protobufMessage = body.slice(5)
			}

			// Handle gzip compression
			const isGzipped =
				headers["grpc-encoding"] === "gzip" ||
				headers["content-encoding"] === "gzip" ||
				(protobufMessage[0] === 0x1f && protobufMessage[1] === 0x8b)

			if (isGzipped) {
				protobufMessage = gunzipSync(protobufMessage)
			}

			// Use official OpenTelemetry protobuf decoder
			const root = require("@opentelemetry/otlp-transformer/build/src/generated/root")
			const logsRequestType = root.opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest
			const logsRequest = logsRequestType.decode(protobufMessage)

			console.log(`[GeminiCliTelemetryReceiver] Successfully decoded OTLP telemetry data`)

			// Extract telemetry events
			const events = this.extractTelemetryEvents(logsRequest)

			// Process events for correlation
			this.correlateTelemetryEvents(events)
		} catch (error) {
			console.error("[GeminiCliTelemetryReceiver] Error processing telemetry data:", error)
		}
	}

	/**
	 * Extract telemetry events from decoded OTLP data
	 */
	private extractTelemetryEvents(logsRequest: any): TelemetryEvent[] {
		const events: TelemetryEvent[] = []

		try {
			const resourceLogs = logsRequest.resourceLogs || logsRequest.resource_logs || []

			for (const resourceLog of resourceLogs) {
				const scopeLogs = resourceLog.scopeLogs || resourceLog.scope_logs || []

				for (const scopeLog of scopeLogs) {
					const logRecords = scopeLog.logRecords || scopeLog.log_records || []

					for (const logRecord of logRecords) {
						const event = this.parseLogRecord(logRecord)
						if (event) {
							events.push(event)
						}
					}
				}
			}
		} catch (error) {
			console.error("[GeminiCliTelemetryReceiver] Error extracting events:", error)
		}

		return events
	}

	/**
	 * Parse individual log record into telemetry event
	 */
	private parseLogRecord(logRecord: any): TelemetryEvent | null {
		try {
			const attributes = logRecord.attributes || []
			const event: TelemetryEvent = {
				eventName: "unknown",
			}

			// Extract attributes
			for (const attr of attributes) {
				const key = attr.key
				const value = attr.value

				switch (key) {
					case "event.name":
						event.eventName = this.extractStringValue(value) || "unknown_event"
						break
					case "prompt_id":
						event.promptId = this.extractStringValue(value)
						break
					case "prompt":
						event.prompt = this.extractStringValue(value)
						break
					case "request_text":
						event.requestText = this.extractStringValue(value)
						break
					case "response_text":
						event.responseText = this.extractStringValue(value)
						break
					case "input_token_count":
						event.inputTokenCount = this.extractIntValue(value)
						break
					case "output_token_count":
						event.outputTokenCount = this.extractIntValue(value)
						break
					case "cached_content_token_count":
						event.cachedContentTokenCount = this.extractIntValue(value)
						break
					case "thoughts_token_count":
						event.thoughtsTokenCount = this.extractIntValue(value)
						break
					case "tool_token_count":
						event.toolTokenCount = this.extractIntValue(value)
						break
					case "total_token_count":
						event.totalTokenCount = this.extractIntValue(value)
						break
					case "event.timestamp":
						event.timestamp = this.extractStringValue(value)
						break
					case "session.id":
						event.sessionId = this.extractStringValue(value)
						break
				}
			}

			return event
		} catch (error) {
			console.error("[GeminiCliTelemetryReceiver] Error parsing log record:", error)
			return null
		}
	}

	/**
	 * Extract string value from protobuf attribute value
	 */
	private extractStringValue(value: any): string | undefined {
		return value?.stringValue || undefined
	}

	/**
	 * Extract integer value from protobuf attribute value
	 */
	private extractIntValue(value: any): number | undefined {
		const intValue = value?.intValue
		return intValue ? parseInt(intValue, 10) : undefined
	}

	/**
	 * Correlate telemetry events with pending requests
	 *
	 * Strategy: We primarily match by response_text since:
	 * 1. CLI stdout === telemetry response_text (exact match)
	 * 2. Each response is unique, even for identical prompts
	 * 3. No need to parse prompt_id from other events first
	 */
	private correlateTelemetryEvents(events: TelemetryEvent[]): void {
		console.log(`[GeminiCliTelemetryReceiver] Processing ${events.length} telemetry events`)

		for (const event of events) {
			console.log(`[GeminiCliTelemetryReceiver] Event: ${event.eventName}, promptId: ${event.promptId}`)

			// Only process api_response events (they contain token usage)
			if (event.eventName === "gemini_cli.api_response") {
				this.matchEventToRequest(event)
			}
		}
	}

	/**
	 * Match telemetry event to pending request using correlation strategy
	 *
	 * Primary: Response text matching (CLI stdout === telemetry response_text)
	 * Fallback: Time proximity matching
	 */
	private matchEventToRequest(event: TelemetryEvent): void {
		let matchedRequest: PendingRequest | null = null

		// Primary Strategy: Match by response text (most reliable)
		// This works because CLI stdout exactly matches telemetry response_text
		if (event.responseText) {
			for (const [requestId, pendingRequest] of Array.from(this.pendingRequests.entries())) {
				if (pendingRequest.responseText === event.responseText) {
					matchedRequest = pendingRequest
					console.log(
						`[GeminiCliTelemetryReceiver] ✅ Matched request ${requestId} by response text (${event.responseText.substring(0, 50)}...)`,
					)
					break
				}
			}
		}

		// Fallback Strategy: Match by time proximity
		if (!matchedRequest && event.timestamp) {
			const eventTime = new Date(event.timestamp).getTime()
			let closestRequest: PendingRequest | null = null
			let minTimeDiff = Infinity

			for (const [requestId, pendingRequest] of Array.from(this.pendingRequests.entries())) {
				const timeDiff = Math.abs(eventTime - pendingRequest.startTime)
				if (timeDiff < minTimeDiff && timeDiff < 60000) {
					// Within 1 minute
					minTimeDiff = timeDiff
					closestRequest = pendingRequest
				}
			}

			if (closestRequest) {
				matchedRequest = closestRequest
				console.log(
					`[GeminiCliTelemetryReceiver] ⏱️ Matched request ${closestRequest.requestId} by time proximity (${minTimeDiff}ms)`,
				)
			}
		}

		// Resolve matched request with token usage
		if (matchedRequest) {
			clearTimeout(matchedRequest.timeout)
			this.pendingRequests.delete(matchedRequest.requestId)

			const tokenUsage: TokenUsage = {
				totalTokensIn: event.inputTokenCount || 0,
				totalTokensOut: event.outputTokenCount || 0,
				totalCost: 0, // Gemini CLI uses Google Code Assist quotas, not per-token billing
				contextTokens: event.inputTokenCount || 0,
				totalCacheReads: event.cachedContentTokenCount || 0,
				totalCacheWrites: 0, // Not provided by Gemini CLI telemetry
				// Note: thoughts_token_count and tool_token_count are CLI-specific and not in standard interface
			}

			console.log(
				`[GeminiCliTelemetryReceiver] Resolved request ${matchedRequest.requestId} with token usage:`,
				tokenUsage,
			)
			matchedRequest.resolve(tokenUsage)
		} else {
			console.log(
				`[GeminiCliTelemetryReceiver] No matching request found for event with promptId: ${event.promptId}`,
			)
		}
	}

	/**
	 * Get the port the receiver is running on
	 */
	getPort(): number {
		return this.port
	}

	/**
	 * Shutdown the telemetry receiver
	 */
	async shutdown(): Promise<void> {
		if (this.isShuttingDown) {
			return
		}

		this.isShuttingDown = true
		console.log("[GeminiCliTelemetryReceiver] Shutting down telemetry receiver...")

		// Clear all pending requests
		for (const [requestId, pendingRequest] of Array.from(this.pendingRequests.entries())) {
			clearTimeout(pendingRequest.timeout)
			pendingRequest.resolve(null)
		}
		this.pendingRequests.clear()

		// Close server
		if (this.server) {
			return new Promise((resolve) => {
				this.server!.close(() => {
					console.log("[GeminiCliTelemetryReceiver] Telemetry receiver shut down")
					resolve()
				})
			})
		}
	}
}

/**
 * Create a new telemetry receiver instance (single-use pattern for perfect isolation)
 */
export async function createTelemetryReceiver(): Promise<GeminiCliTelemetryReceiver> {
	const receiver = new GeminiCliTelemetryReceiver()
	await receiver.start()
	return receiver
}
