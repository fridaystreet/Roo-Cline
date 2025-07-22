/**
 * Final Working Gemini CLI OTLP Telemetry Receiver
 *
 * Based on validation findings:
 * - CLI uses HTTP/2 POST with gRPC message framing and gzip compression
 * - Official OpenTelemetry protobuf decoder works perfectly
 * - Correlation via prompt_id (primary) and response_text (secondary)
 * - Token usage available in api_response event
 */

import * as http2 from "http2"
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

		// Create HTTP/2 server for proper gRPC protocol support (like working standalone version)
		this.server = http2.createServer((req, res) => {
			process.stdout.write(`[GeminiCliTelemetryReceiver] Received ${req.method} request to ${req.url}\n`)
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
				process.stdout.write(`[GeminiCliTelemetryReceiver] Started HTTP/2 OTLP receiver on port ${this.port}\n`)
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
				process.stdout.write(
					`[GeminiCliTelemetryReceiver] Request ${requestId} timed out waiting for telemetry\n`,
				)
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

			process.stdout.write(
				`[GeminiCliTelemetryReceiver] Registered request ${requestId} for telemetry correlation\n`,
			)
		})
	}

	/**
	 * Handle incoming HTTP requests (OTLP telemetry data) - using working HTTP/2 logic
	 */
	private async handleHttpRequest(req: http2.Http2ServerRequest, res: http2.Http2ServerResponse): Promise<void> {
		process.stdout.write(`\n*** OTLP HTTP REQUEST RECEIVED ***\n`)
		process.stdout.write(`Method: ${req.method}\n`)
		process.stdout.write(`URL: ${req.url}\n`)
		process.stdout.write(`Content-Type: ${req.headers["content-type"]}\n`)
		process.stdout.write(`Content-Encoding: ${req.headers["content-encoding"]}\n`)
		process.stdout.write(`gRPC-Encoding: ${req.headers["grpc-encoding"]}\n`)

		if (req.method !== "POST") {
			res.writeHead(405, { "Content-Type": "application/json" })
			res.end('{"error": "Method not allowed"}')
			return
		}

		let body = Buffer.alloc(0)
		req.on("data", (chunk: Buffer) => {
			body = Buffer.concat([body, chunk])
			process.stdout.write(`📦 Received chunk: ${chunk.length} bytes, total so far: ${body.length} bytes\n`)
		})

		req.on("end", () => {
			try {
				process.stdout.write(`Body length: ${body.length} bytes\n`)

				// Check if data is gzipped based on grpc-encoding header
				const grpcEncoding = req.headers["grpc-encoding"]
				process.stdout.write(`🗜️ gRPC encoding: ${grpcEncoding}\n`)

				// Handle gRPC message framing FIRST: [compression flag (1 byte)][length (4 bytes)][message]
				let protobufMessage = body
				if (body.length > 5) {
					const compressionFlag = body.readUInt8(0)
					const messageLength = body.readUInt32BE(1)
					process.stdout.write(
						`📏 gRPC frame - compression: ${compressionFlag}, message length: ${messageLength}\n`,
					)

					if (messageLength > 0 && body.length >= 5 + messageLength) {
						protobufMessage = body.slice(5, 5 + messageLength)
						process.stdout.write(`📦 Extracted protobuf message: ${protobufMessage.length} bytes\n`)
					} else {
						process.stdout.write("⚠️ Invalid gRPC frame length, using full body\n")
						protobufMessage = body
					}
				}

				// THEN decompress the extracted message if gzipped
				if (grpcEncoding === "gzip") {
					try {
						process.stdout.write("🗜️ Decompressing gzipped protobuf message...\n")
						protobufMessage = gunzipSync(protobufMessage)
						process.stdout.write(`📦 Decompressed size: ${protobufMessage.length} bytes\n`)
					} catch (error) {
						process.stdout.write(`❌ Failed to decompress gzipped data: ${(error as Error).message}\n`)
						// Keep original message if decompression fails
					}
				}

				// Process the telemetry data
				this.processTelemetryData(protobufMessage, req.headers)

				// Send proper gRPC response according to gRPC HTTP/2 protocol
				res.writeHead(200, {
					"content-type": "application/grpc",
					"grpc-encoding": "identity",
				})

				// Create OTLP ExportLogsServiceResponse message
				const otlpResponse = {
					partialSuccess: {
						rejectedLogRecords: 0,
						errorMessage: "",
					},
				}

				// Convert to JSON and then to buffer
				const responseJson = JSON.stringify(otlpResponse)
				const responseBuffer = Buffer.from(responseJson, "utf8")

				// gRPC requires length-prefixed messages: [compression flag (1 byte)][length (4 bytes)][message]
				const lengthPrefix = Buffer.alloc(5)
				lengthPrefix.writeUInt8(0, 0) // No compression
				lengthPrefix.writeUInt32BE(responseBuffer.length, 1) // Message length

				// Send length-prefixed response message
				res.write(Buffer.concat([lengthPrefix, responseBuffer]))

				// Send trailers with grpc-status = 0 (OK)
				res.addTrailers({
					"grpc-status": "0",
					"grpc-message": "",
				})

				res.end()

				process.stdout.write("✅ Responded with OTLP success\n")
			} catch (error) {
				process.stdout.write(`❌ Error processing request: ${(error as Error).message}\n`)
				res.writeHead(500, { "Content-Type": "application/json" })
				res.end('{"error": "Internal server error"}')
			}
		})

		req.on("error", (error) => {
			process.stdout.write(`❌ Request error: ${(error as Error).message}\n`)
			res.writeHead(400, { "Content-Type": "application/json" })
			res.end('{"error": "Bad request"}')
		})
	}

	/**
	 * Process incoming telemetry data using official OpenTelemetry protobuf decoder
	 */
	private processTelemetryData(protobufMessage: Buffer, headers: any): void {
		try {
			// Use the official OpenTelemetry protobuf decoder
			let logsRequest
			const contentType = headers["content-type"] || ""

			try {
				// Import the official protobuf types
				const root = require("@opentelemetry/otlp-transformer/build/src/generated/root")
				const logsRequestType = root.opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest

				// Try to decode as JSON first
				if (contentType && contentType.includes("application/json")) {
					process.stdout.write("🔄 Decoding as JSON OTLP\n")
					const jsonBody = protobufMessage.toString("utf8")
					logsRequest = JSON.parse(jsonBody)
				} else {
					process.stdout.write("🔄 Decoding as Protobuf OTLP using official OpenTelemetry decoder\n")
					logsRequest = logsRequestType.decode(protobufMessage)
					process.stdout.write("✅ Successfully decoded with official OpenTelemetry protobuf decoder\n")
				}
			} catch (error) {
				process.stdout.write("🤷 Failed to decode with official decoder, treating as raw data\n")
				process.stdout.write(`❌ Decode error: ${(error as Error).message}\n`)
				logsRequest = { rawData: protobufMessage.toString() }
			}

			process.stdout.write("📊 Decoded OTLP request structure:\n")
			process.stdout.write(`📊 Full decoded data: ${JSON.stringify(logsRequest, null, 2)}\n`)

			// Extract telemetry events using the working logic
			const events = this.extractTelemetryEvents(logsRequest)

			// Process events for correlation
			this.correlateTelemetryEvents(events)
		} catch (error) {
			process.stdout.write(
				`[GeminiCliTelemetryReceiver] Error processing telemetry data: ${(error as Error).message}\n`,
			)
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
			process.stdout.write(`[GeminiCliTelemetryReceiver] Error extracting events: ${(error as Error).message}\n`)
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
			process.stdout.write(`[GeminiCliTelemetryReceiver] Error parsing log record: ${(error as Error).message}\n`)
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
		process.stdout.write(`[GeminiCliTelemetryReceiver] Processing ${events.length} telemetry events\n`)

		for (const event of events) {
			process.stdout.write(
				`[GeminiCliTelemetryReceiver] Event: ${event.eventName}, promptId: ${event.promptId}\n`,
			)

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
					process.stdout.write(
						`[GeminiCliTelemetryReceiver] ✅ Matched request ${requestId} by response text (${event.responseText.substring(0, 50)}...)\n`,
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
				process.stdout.write(
					`[GeminiCliTelemetryReceiver] ⏱️ Matched request ${closestRequest.requestId} by time proximity (${minTimeDiff}ms)\n`,
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

			process.stdout.write(
				`[GeminiCliTelemetryReceiver] Resolved request ${matchedRequest.requestId} with token usage: ${JSON.stringify(tokenUsage)}\n`,
			)
			matchedRequest.resolve(tokenUsage)
		} else {
			process.stdout.write(
				`[GeminiCliTelemetryReceiver] No matching request found for event with promptId: ${event.promptId}\n`,
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
		process.stdout.write("[GeminiCliTelemetryReceiver] Shutting down telemetry receiver...\n")

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
					process.stdout.write("[GeminiCliTelemetryReceiver] Telemetry receiver shut down\n")
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
