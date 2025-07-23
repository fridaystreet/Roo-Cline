import { spawn } from "child_process"
import { promises as fs } from "fs"
import { join } from "path"
import { homedir } from "os"
import * as vscode from "vscode"
import type { Anthropic } from "@anthropic-ai/sdk"
import type { ApiHandlerOptions } from "../../shared/api"
import { getModelParams } from "../transform/model-params"
import { convertAnthropicMessagesToPrompt } from "../transform/gemini-cli-format"
import type { ApiStream } from "../transform/stream"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { BaseProvider } from "./base-provider"
import { geminiDefaultModelId, geminiModels, type GeminiModelId, type ModelInfo } from "@roo-code/types"
import { createTelemetryReceiver, TelemetryEvent } from "./gemini-cli-telemetry"
import * as net from "net"

export interface TokenUsage {
	inputTokens: number
	outputTokens: number
	totalCost: number
	cacheReadTokens?: number
}

export class GeminiCliHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private lastTelemetryEvent: TelemetryEvent | null = null

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
	}

	/**
	 * Get the last captured token usage from telemetry
	 */
	getLastTokenUsage(): TokenUsage | null {
		if (this.options.geminiCliDebug)
			process.stdout.write("🔗 Gemini CLI Last Telemetry Event: " + JSON.stringify(this.lastTelemetryEvent))
		if (!this.lastTelemetryEvent) return null
		return {
			inputTokens: this.lastTelemetryEvent.inputTokenCount || 0,
			outputTokens: this.lastTelemetryEvent.outputTokenCount || 0,
			cacheReadTokens: this.lastTelemetryEvent.cachedContentTokenCount || 0,
			totalCost: 0,
		}
	}

	/**
	 * Automatically detects enabled MCP servers from VS Code extension context
	 * @returns Array of enabled MCP server names
	 */
	private getEnabledMcpServers(): string[] {
		try {
			// Try to get the ClineProvider instance from the global context
			// This is a simplified approach - in a real implementation, we'd need
			// to access the actual McpHub instance through the extension context
			const extension = vscode.extensions.getExtension("roo-code.roo-code")
			if (!extension?.isActive) {
				if (this.options.geminiCliDebug)
					process.stdout.write("🔗 Gemini CLI: Roo-Code extension not active, no MCP servers available")
				return []
			}

			// For now, return an empty array as a placeholder
			// In a full implementation, this would access the McpHub through the extension's exports
			// and call mcpHub.getServers().filter(s => s.status === 'connected').map(s => s.name)
			if (this.options.geminiCliDebug)
				process.stdout.write("🔗 Gemini CLI: MCP server auto-detection not yet fully implemented")
			return []
		} catch (error) {
			if (this.options.geminiCliDebug) process.stdout.write("🔗 Gemini CLI: Error detecting MCP servers:", error)
			return []
		}
	}

	createMessage(
		systemInstruction: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const prompt = convertAnthropicMessagesToPrompt(messages, systemInstruction)
		return this.streamResponse(prompt)
	}

	/**
	 * Create an async generator that yields the CLI response as a stream
	 */
	private async *streamResponse(prompt: string): ApiStream {
		const response = await this.completePrompt(prompt)
		yield {
			type: "text",
			text: response,
		}
		let usage = this.getLastTokenUsage()
		while (!usage) {
			usage = this.getLastTokenUsage()
			if (usage) break
		}
		if (this.options.geminiCliDebug)
			process.stdout.write("🔗 Gemini CLI Token Usage reported: " + JSON.stringify(usage))
		yield {
			type: "usage",
			...usage,
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
	 * Ensure the ~/.gemini/settings.json file exists with correct auth method
	 */
	private async ensureSettingsFile(): Promise<void> {
		const settingsPath = join(homedir(), ".gemini", "settings.json")
		try {
			// Check if settings file exists
			await fs.access(settingsPath)
			const content = await fs.readFile(settingsPath, "utf-8")
			const settings = JSON.parse(content)

			// Ensure auth method is set to oauth
			if (settings.auth_method !== "oauth") {
				settings.auth_method = "oauth"
				await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))
				if (this.options.geminiCliDebug)
					process.stdout.write("🔐 Updated Gemini CLI settings to use OAuth authentication")
			}
		} catch (error) {
			// Create settings directory and file if they don't exist
			try {
				await fs.mkdir(join(homedir(), ".gemini"), { recursive: true })
				const defaultSettings = {
					auth_method: "oauth",
				}
				await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2))
				if (this.options.geminiCliDebug)
					process.stdout.write("🔐 Created Gemini CLI settings file with OAuth authentication")
			} catch (createError) {
				process.stderr.write("Failed to create Gemini CLI settings:", createError)
			}
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		await this.ensureSettingsFile()

		// Generate unique request ID for telemetry correlation
		const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

		// Create single-use telemetry receiver (always enabled)
		if (this.options.geminiCliDebug) process.stdout.write(`🔗 Creating telemetry receiver...\n`)
		const telemetrySetup = await createTelemetryReceiver(this.options.geminiCliDebug || false)
		const telemetryReceiver = telemetrySetup.receiver
		const telemetryPort = telemetrySetup.port
		if (this.options.geminiCliDebug)
			process.stdout.write(`🔗 Telemetry receiver created on port ${telemetryPort}\n`)

		// CRITICAL: Register telemetry request IMMEDIATELY to avoid race condition
		// CLI sends telemetry as soon as it starts, before waitForTelemetry() would be called later
		const telemetryPromise = telemetryReceiver.waitForTelemetry(requestId, prompt)
		if (this.options.geminiCliDebug) process.stdout.write(`🔗 Telemetry request registered for correlation\n`)

		const { id: modelId } = this.getModel()

		// Set up environment variables
		const env = { ...process.env }

		// Use the provided project ID if available
		if (this.options.geminiCliProjectId) {
			env.GOOGLE_CLOUD_PROJECT = this.options.geminiCliProjectId
		}

		// Build CLI arguments based on configuration
		const args = ["--model", modelId]

		// Add advanced CLI flags based on configuration
		if (this.options.geminiCliAllFiles === true) {
			args.push("--all-files", "true")
		}

		if (this.options.geminiCliDebug === true) {
			args.push("--debug", "true")
		}

		// Enable checkpointing by default (can be disabled in UI)
		if (this.options.geminiCliCheckpointing === true) {
			args.push("--checkpointing", "true")
		}

		// Always enable telemetry for token usage tracking (essential for provider operation)
		if (telemetryPort) {
			args.push("--telemetry", "true")
			args.push("--telemetry-target", "local")
			args.push("--telemetry-otlp-endpoint", `http://localhost:${telemetryPort}`)
			if (this.options.geminiCliDebug)
				process.stdout.write(`🔗 CLI will use telemetry endpoint: http://localhost:${telemetryPort}\n`)
		}

		// Add MCP servers if any are enabled (automatically detected)
		const enabledMcpServers = this.getEnabledMcpServers()
		if (enabledMcpServers.length > 0) {
			args.push("--allowed-mcp-server-names", enabledMcpServers.join(","))
			if (this.options.geminiCliDebug)
				process.stdout.write(`🔗 Gemini CLI: Auto-detected MCP servers: ${enabledMcpServers.join(", ")}`)
		}

		// ACP mode off by default (may conflict with Roo-Code session management)
		if (this.options.geminiCliExperimentalAcp === true) {
			args.push("--experimental-acp", "true")
		}

		// Enable IDE mode by default for better VS Code integration
		if (this.options.geminiCliIdeMode === true) {
			args.push("--ide-mode", "true")
		}

		// Debug logging for CLI invocation
		if (this.options.geminiCliDebug)
			process.stdout.write(`🚀 CLI Command: npx https://github.com/google-gemini/gemini-cli ${args.join(" ")}\n`)
		//process.stdout.write(`🔧 CLI Environment: ${JSON.stringify(env)}\n`)
		if (this.options.geminiCliDebug) process.stdout.write(`📝 CLI Prompt length: ${prompt.length} characters\n`)

		return new Promise((resolve, reject) => {
			// Use process.nextTick to defer CLI spawn to next event loop tick
			// This ensures telemetry receiver is fully registered before CLI starts sending data
			process.nextTick(() => {
				const child = spawn("npx", ["https://github.com/google-gemini/gemini-cli", ...args], {
					env,
					stdio: ["pipe", "pipe", "pipe"],
				})

				// Send the full prompt via stdin to avoid OS argument length limits
				if (child.stdin) {
					child.stdin.write(prompt)
					child.stdin.end()
				}

				let output = ""
				let errorOutput = ""

				child.stdout.on("data", (chunk) => {
					output += chunk.toString()
				})

				child.stderr.on("data", (chunk) => {
					errorOutput += chunk.toString()
				})

				child.on("close", async (exitCode) => {
					if (exitCode !== 0) {
						const errorMessage = errorOutput.trim()

						// Handle different types of errors with specific user guidance
						if (
							errorMessage.includes("Auth method") ||
							errorMessage.includes("settings.json") ||
							errorMessage.includes("authentication") ||
							errorMessage.includes("login")
						) {
							reject(
								new Error(
									"🔐 Authentication Required\n\n" +
										"The Gemini CLI requires Google OAuth authentication.\n\n" +
										"When you send your first message, Roo Code will automatically open your browser to complete the Google login process.",
								),
							)
							return
						}
						if (errorMessage.includes("GOOGLE_CLOUD_PROJECT") || errorMessage.includes("project")) {
							reject(
								new Error(
									"🏢 Google Cloud Project ID Required\n\n" +
										"Your Google account requires a Google Cloud Project ID for workspace access.\n\n" +
										"Please configure the 'Google Cloud Project ID' in your Gemini CLI provider settings.\n" +
										"You can find your project ID in the Google Cloud Console.",
								),
							)
							return
						}
						// Generic error with full details for debugging
						reject(
							new Error(
								`❌ Gemini CLI Error (Exit Code ${exitCode})\n\n` +
									`Details: ${errorMessage}\n\n` +
									`If this error persists, please check your Gemini CLI configuration.`,
							),
						)
						return
					}

					let telemetryEvent: TelemetryEvent | null = null
					// Wait for token usage from telemetry receiver
					if (telemetryReceiver) {
						try {
							// Wait for telemetry data using the promise registered earlier
							telemetryEvent = await telemetryPromise
							if (telemetryEvent) {
								this.lastTelemetryEvent = telemetryEvent
								const usage: TokenUsage | null = this.getLastTokenUsage()
								if (this.options.geminiCliDebug)
									process.stdout.write(
										`🔗 Gemini CLI Token Usage: Input: ${usage?.inputTokens?.toLocaleString()}, ` +
											`Output: ${usage?.outputTokens?.toLocaleString()}` +
											(usage?.cacheReadTokens
												? `, Cache: ${usage?.cacheReadTokens.toLocaleString()}`
												: "") +
											` | Total: ${((usage?.inputTokens || 0) + (usage?.outputTokens || 0)).toLocaleString()}`,
									)
							} else {
								if (this.options.geminiCliDebug)
									process.stdout.write(
										"🔗 Gemini CLI: No token usage information captured from telemetry receiver",
									)
							}
						} finally {
							// Always shut down the single-use telemetry receiver
							try {
								await telemetryReceiver.shutdown()
								if (this.options.geminiCliDebug)
									process.stdout.write("🔗 Gemini CLI: Single-use telemetry receiver shut down")
							} catch (shutdownError) {
								process.stderr.write(
									"🔗 Gemini CLI: Error shutting down telemetry receiver:",
									shutdownError,
								)
							}
						}
					} else {
						if (this.options.geminiCliDebug)
							process.stdout.write("🔗 Gemini CLI: Telemetry disabled or receiver not available")
					}

					// Filter out OpenTelemetry SDK messages from the output
					const filteredOutput = this.filterCliOutput(output)
					resolve(filteredOutput.trim())
				})

				child.on("error", (error) => {
					reject(new Error(`Failed to spawn Gemini CLI: ${error.message}`))
				})
			})
		})
	}

	/**
	 * Filter out OpenTelemetry SDK messages from CLI output
	 */
	private filterCliOutput(output: string): string {
		const lines = output.split("\n")
		const filteredLines = lines.filter((line: string) => {
			// Filter out OpenTelemetry SDK messages
			const lowerLine = line.toLowerCase()
			return !(
				lowerLine.includes("loaded cached credentials.") ||
				lowerLine.includes("opentelemetry sdk started successfully.") ||
				lowerLine.includes("accessing resource attributes before async attributes settled")
			)
		})
		return filteredLines.join("\n")
	}
}
