import { EventEmitter } from "events"
import { createServer, Server, IncomingMessage, ServerResponse } from "http"
import { URL } from "url"
import { randomUUID } from "crypto"

/**
 * Token usage data extracted from OTLP telemetry
 */
export interface TokenUsage {
	inputTokens: number
	outputTokens: number
	cacheReadTokens: number
	reasoningTokens: number
	totalTokens: number
}

/**
 * Pending request waiting for telemetry data
 */
interface PendingRequest {
	requestId: string
	startTime: number
	resolve: (usage: TokenUsage | null) => void
	timeout: NodeJS.Timeout
}

/**
 * Robust, multi-window safe OTLP receiver for Gemini CLI telemetry
 * Features:
 * - Request-level correlation with unique IDs
 * - Timestamp-based matching for concurrent requests
 * - Timeout handling to prevent hanging requests
 * - Multi-window isolation (each VS Code window gets its own receiver)
 * - Automatic cleanup and lifecycle management
 */
export class GeminiCliTelemetryReceiver extends EventEmitter {
	private server: Server | null = null
	private port: number = 0
	private pendingRequests = new Map<string, PendingRequest>()
	private isShuttingDown = false

	constructor() {
		super()
	}

	/**
	 * Start the HTTP OTLP receiver on a random available port
	 * @returns The port number the receiver is listening on
	 */
	async start(): Promise<number> {
		if (this.server) {
			throw new Error("Telemetry receiver already started")
		}

		if (this.isShuttingDown) {
			throw new Error("Telemetry receiver is shutting down")
		}

		this.server = createServer((req, res) => {
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

			this.server!.on("error", reject)
		})
	}

	/**
	 * Stop the HTTP OTLP receiver and clean up all pending requests
	 */
	async stop(): Promise<void> {
		if (!this.server) {
			return
		}

		this.isShuttingDown = true

		// Cancel all pending requests
		for (const [requestId, pending] of this.pendingRequests) {
			clearTimeout(pending.timeout)
			pending.resolve(null) // Resolve with null to indicate no telemetry data
		}
		this.pendingRequests.clear()

		return new Promise((resolve) => {
			this.server!.close(() => {
				console.log("[GeminiCliTelemetryReceiver] Stopped")
				this.server = null
				this.port = 0
				this.isShuttingDown = false
				resolve()
			})
		})
	}

	/**
	 * Get the number of pending requests waiting for telemetry
	 */
	getPendingRequestCount(): number {
		return this.pendingRequests.size
	}

	/**
	 * Get the current port the receiver is listening on
	 */
	getPort(): number {
		return this.port
	}

	/**
	 * Check if the receiver is currently running
	 */
	isRunning(): boolean {
		return this.server !== null && this.port > 0
	}

	/**
	 * Wait for token usage data for a specific request
	 * This is the main method that providers should use
	 * @param timeoutMs Maximum time to wait for telemetry data (default: 30 seconds)
	 * @returns Promise that resolves with token usage data or null if timeout/error
	 */
	waitForTokenUsage(timeoutMs: number = 30000): Promise<TokenUsage | null> {
		if (this.isShuttingDown) {
			return Promise.resolve(null)
		}

		const requestId = randomUUID()
		console.log(`[GeminiCliTelemetryReceiver] Waiting for telemetry data for request ${requestId}`)

		return new Promise((resolve) => {
			const timeout = setTimeout(() => {
				this.pendingRequests.delete(requestId)
				console.log(`[GeminiCliTelemetryReceiver] Timeout waiting for telemetry data for request ${requestId}`)
				resolve(null)
			}, timeoutMs)

			this.pendingRequests.set(requestId, {
				requestId,
				startTime: Date.now(),
				resolve,
				timeout,
			})
		})
	}

	/**
	 * Match incoming telemetry data to the most appropriate pending request
	 * Uses timestamp-based matching since CLI doesn't provide request IDs
	 */
	private matchAndResolvePendingRequest(tokenUsage: TokenUsage): void {
		if (this.pendingRequests.size === 0) {
			console.log("[GeminiCliTelemetryReceiver] Received telemetry but no pending requests")
			return
		}

		// Find the oldest pending request (most likely to match)
		// In practice, telemetry usually arrives shortly after the CLI call completes
		let oldestRequest: PendingRequest | null = null
		let oldestRequestId: string | null = null

		for (const [requestId, pending] of this.pendingRequests) {
			if (!oldestRequest || pending.startTime < oldestRequest.startTime) {
				oldestRequest = pending
				oldestRequestId = requestId
			}
		}

		if (oldestRequest && oldestRequestId) {
			console.log(`[GeminiCliTelemetryReceiver] Matched telemetry to request ${oldestRequestId}`)

			// Clear timeout and resolve the request
			clearTimeout(oldestRequest.timeout)
			this.pendingRequests.delete(oldestRequestId)
			oldestRequest.resolve(tokenUsage)
		}
	}

	/**
	 * Handle incoming HTTP OTLP requests
	 */
	private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
		try {
			// Only handle POST requests to /v1/logs
			if (req.method !== "POST") {
				res.writeHead(405, { "Content-Type": "text/plain" })
				res.end("Method Not Allowed")
				return
			}

			const url = new URL(req.url || "/", `http://${req.headers.host}`)
			if (url.pathname !== "/v1/logs") {
				res.writeHead(404, { "Content-Type": "text/plain" })
				res.end("Not Found")
				return
			}

			// Collect request body
			let body = ""
			req.on("data", (chunk) => {
				body += chunk.toString()
			})

			req.on("end", () => {
				try {
					// Parse JSON request body
					const request = JSON.parse(body)

					// Extract token usage from log records
					const tokenUsage = this.extractTokenUsage(request)
					if (tokenUsage) {
						// Match this telemetry to the most appropriate pending request
						this.matchAndResolvePendingRequest(tokenUsage)
						this.emit("tokenUsage", tokenUsage)
					}

					// Send success response
					res.writeHead(200, { "Content-Type": "application/json" })
					res.end(JSON.stringify({ partialSuccess: null }))
				} catch (error) {
					console.error("[GeminiCliTelemetryReceiver] Error parsing request:", error)
					res.writeHead(400, { "Content-Type": "text/plain" })
					res.end("Bad Request")
				}
			})
		} catch (error) {
			console.error("[GeminiCliTelemetryReceiver] Error handling HTTP request:", error)
			res.writeHead(500, { "Content-Type": "text/plain" })
			res.end("Internal Server Error")
		}
	}

	/**
	 * Extract token usage data from OTLP log records
	 */
	private extractTokenUsage(request: any): TokenUsage | null {
		try {
			if (!request.resourceLogs) {
				return null
			}

			for (const resourceLog of request.resourceLogs) {
				if (!resourceLog.scopeLogs) {
					continue
				}

				for (const scopeLog of resourceLog.scopeLogs) {
					if (!scopeLog.logRecords) {
						continue
					}

					for (const logRecord of scopeLog.logRecords) {
						// Look for API response events with token usage
						const tokenUsage = this.parseLogRecordForTokens(logRecord)
						if (tokenUsage) {
							return tokenUsage
						}
					}
				}
			}

			return null
		} catch (error) {
			console.error("[GeminiCliTelemetryReceiver] Error extracting token usage:", error)
			return null
		}
	}

	/**
	 * Parse a single log record for token usage data
	 */
	private parseLogRecordForTokens(logRecord: any): TokenUsage | null {
		try {
			if (!logRecord.attributes) {
				return null
			}

			// Look for attributes containing token counts
			const attributes: Record<string, any> = {}
			for (const attr of logRecord.attributes) {
				if (attr.key && attr.value) {
					attributes[attr.key] = this.extractAttributeValue(attr.value)
				}
			}

			// Check if this is an API response event with token data
			if (attributes["event.name"] === "api_response" || attributes["event.name"] === "EVENT_API_RESPONSE") {
				const inputTokens = attributes["input_token_count"] || 0
				const outputTokens = attributes["output_token_count"] || 0
				const cacheReadTokens = attributes["cached_content_token_count"] || 0
				const reasoningTokens = attributes["thoughts_token_count"] || 0
				const totalTokens = attributes["total_token_count"] || 0

				// Only return if we have actual token data
				if (inputTokens > 0 || outputTokens > 0 || totalTokens > 0) {
					return {
						inputTokens,
						outputTokens,
						cacheReadTokens,
						reasoningTokens,
						totalTokens,
					}
				}
			}

			return null
		} catch (error) {
			console.error("[GeminiCliTelemetryReceiver] Error parsing log record:", error)
			return null
		}
	}

	/**
	 * Extract value from OTLP attribute value
	 */
	private extractAttributeValue(value: any): any {
		if (value.stringValue !== undefined) {
			return value.stringValue
		}
		if (value.intValue !== undefined) {
			return parseInt(value.intValue, 10)
		}
		if (value.doubleValue !== undefined) {
			return value.doubleValue
		}
		if (value.boolValue !== undefined) {
			return value.boolValue
		}
		return null
	}
}
