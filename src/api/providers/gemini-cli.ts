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
import { GeminiCliTelemetryReceiver, type TokenUsage } from "./gemini-cli-telemetry"

export class GeminiCliHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private telemetryReceiver: GeminiCliTelemetryReceiver | null = null
	private lastTokenUsage: TokenUsage | null = null

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
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
				console.log("🔗 Gemini CLI: Roo-Code extension not active, no MCP servers available")
				return []
			}

			// For now, return an empty array as a placeholder
			// In a full implementation, this would access the McpHub through the extension's exports
			// and call mcpHub.getServers().filter(s => s.status === 'connected').map(s => s.name)
			console.log("🔗 Gemini CLI: MCP server auto-detection not yet fully implemented")
			return []
		} catch (error) {
			console.warn("🔗 Gemini CLI: Failed to auto-detect MCP servers:", error)
			return []
		}
	}

	async *createMessage(
		systemInstruction: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Use the CLI format transformer to convert messages to text with full conversation history
		const prompt = convertAnthropicMessagesToPrompt(messages, systemInstruction)

		try {
			const output = await this.completePrompt(prompt)
			yield { type: "text", text: output }
		} catch (error) {
			if (error instanceof Error) {
				throw error
			}
			throw new Error(`Gemini CLI error: ${String(error)}`)
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in geminiModels ? (modelId as GeminiModelId) : geminiDefaultModelId
		const info: ModelInfo = geminiModels[id]
		const params = getModelParams({ format: "gemini", modelId: id, model: info, settings: this.options })

		return {
			id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id,
			info,
			...params,
		}
	}

	/**
	 * Ensure the ~/.gemini/settings.json file exists with correct auth method
	 */
	private async ensureSettingsFile(): Promise<void> {
		const geminiDir = join(homedir(), ".gemini")
		const settingsFile = join(geminiDir, "settings.json")

		try {
			// Check if settings file exists
			await fs.access(settingsFile)
		} catch (error) {
			// File doesn't exist, create it with default OAuth settings
			try {
				// Ensure directory exists
				await fs.mkdir(geminiDir, { recursive: true })

				// Create settings file with OAuth personal auth method
				const defaultSettings = {
					selectedAuthType: "oauth-personal",
					version: "1.0.0",
				}

				await fs.writeFile(settingsFile, JSON.stringify(defaultSettings, null, 2))
				console.log(`✅ Created Gemini CLI settings file: ${settingsFile}`)
			} catch (writeError) {
				console.warn(`⚠️ Could not create settings file: ${writeError}`)
				// Don't throw here - let the CLI handle missing settings
			}
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		await this.ensureSettingsFile()

		// Start telemetry receiver if telemetry is enabled
		let telemetryPort: number | null = null
		if (this.options.geminiCliTelemetry) {
			telemetryPort = await this.startTelemetryReceiver()
		}

		const { id: model } = this.getModel()

		// No truncation needed - we'll use stdin to pass the full prompt

		// Set up environment variables
		const env = { ...process.env }

		// Use the provided project ID if available
		if (this.options.geminiCliProjectId) {
			env.GOOGLE_CLOUD_PROJECT = this.options.geminiCliProjectId
		}

		// Build CLI arguments based on configuration
		const args = ["--model", this.options.geminiCliModelId || "gemini-2.5-pro"]

		// Add advanced CLI flags based on configuration
		// Note: Some flags have sensible defaults for better Roo-Code integration

		if (this.options.geminiCliAllFiles) {
			args.push("--all-files")
		}

		// Enable checkpointing by default (can be disabled in UI)
		if (this.options.geminiCliCheckpointing !== false) {
			args.push("--checkpointing")
		}

		// Always enable telemetry for token usage tracking (essential for provider operation)
		if (telemetryPort) {
			args.push("--telemetry")
			args.push("--telemetry-otlp-endpoint", `http://localhost:${telemetryPort}`)
		}

		// Add MCP servers if any are enabled (automatically detected)
		const enabledMcpServers = this.getEnabledMcpServers()
		if (enabledMcpServers.length > 0) {
			args.push("--allowed-mcp-server-names", enabledMcpServers.join(","))
			console.log(`🔗 Gemini CLI: Auto-detected MCP servers: ${enabledMcpServers.join(", ")}`)
		}

		// ACP mode off by default (may conflict with Roo-Code session management)
		if (this.options.geminiCliExperimentalAcp) {
			args.push("--experimental-acp")
		}

		// Enable IDE mode by default for better VS Code integration
		if (this.options.geminiCliIdeMode !== false) {
			args.push("--ide-mode")
		}

		return new Promise((resolve, reject) => {
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

				// Wait for token usage from telemetry receiver if enabled
				if (this.options.geminiCliTelemetry && this.telemetryReceiver) {
					const usage = await this.telemetryReceiver.waitForTokenUsage()
					if (usage) {
						console.log(
							`🔗 Gemini CLI Token Usage: Input: ${usage.inputTokens.toLocaleString()}, ` +
								`Output: ${usage.outputTokens.toLocaleString()}` +
								(usage.cacheReadTokens ? `, Cache: ${usage.cacheReadTokens.toLocaleString()}` : "") +
								(usage.reasoningTokens
									? `, Reasoning: ${usage.reasoningTokens.toLocaleString()}`
									: "") +
								` | Total: ${usage.totalTokens.toLocaleString()}`,
						)
						// Store usage data for later retrieval by the task system
						this.lastTokenUsage = usage
					} else {
						console.log("🔗 Gemini CLI: No token usage information captured from telemetry receiver")
					}

					// Stop telemetry receiver
					await this.stopTelemetryReceiver()
				}

				resolve(output.trim())
			})

			child.on("error", (error) => {
				reject(new Error(`Failed to spawn Gemini CLI: ${error.message}`))
			})
		})
	}

	/**
	 * Start the telemetry receiver to capture token usage from Gemini CLI
	 */
	private async startTelemetryReceiver(): Promise<number> {
		if (this.telemetryReceiver) {
			return this.telemetryReceiver.getPort()
		}

		this.telemetryReceiver = new GeminiCliTelemetryReceiver()
		return await this.telemetryReceiver.start()
	}

	/**
	 * Stop the telemetry receiver
	 */
	private async stopTelemetryReceiver(): Promise<void> {
		if (!this.telemetryReceiver) {
			return
		}

		await this.telemetryReceiver.stop()
		this.telemetryReceiver = null
	}

	/**
	 * Parse token usage information from Gemini CLI telemetry collector log
	 * The telemetry system outputs API response events with detailed token usage data
	 * to ~/.gemini/tmp/<projectHash>/otel/collector.log when --telemetry --telemetry-target local is used
	 */
	private async parseTokenUsageFromTelemetry(): Promise<{
		inputTokens: number
		outputTokens: number
		cacheReadTokens?: number
	} | null> {
		try {
			const fs = await import("fs")
			const path = await import("path")
			const os = await import("os")

			// Find the telemetry collector log file
			// Path pattern: ~/.gemini/tmp/<projectHash>/otel/collector.log
			const geminiDir = path.join(os.homedir(), ".gemini")
			const tmpDir = path.join(geminiDir, "tmp")

			if (!fs.existsSync(tmpDir)) {
				return null
			}

			// Find the most recent project directory (there should only be one active)
			const projectDirs = fs.readdirSync(tmpDir)
			if (projectDirs.length === 0) {
				return null
			}

			// Use the first (and likely only) project directory
			const projectDir = projectDirs[0]
			const collectorLogPath = path.join(tmpDir, projectDir, "otel", "collector.log")

			if (!fs.existsSync(collectorLogPath)) {
				return null
			}

			// Read the collector log file
			const logContent = fs.readFileSync(collectorLogPath, "utf8")
			const lines = logContent.split("\n")

			// Look for the most recent api_response event with token usage data
			// The log contains structured JSON-like entries with token counts
			for (let i = lines.length - 1; i >= 0; i--) {
				const line = lines[i]
				if (line.includes("api_response") && line.includes("input_token_count")) {
					try {
						// Extract token usage from the telemetry log entry
						const inputMatch = line.match(/"input_token_count":(\d+)/)
						const outputMatch = line.match(/"output_token_count":(\d+)/)
						const cacheMatch = line.match(/"cached_content_token_count":(\d+)/)

						if (inputMatch && outputMatch) {
							const inputTokens = parseInt(inputMatch[1], 10)
							const outputTokens = parseInt(outputMatch[1], 10)
							const cacheReadTokens = cacheMatch ? parseInt(cacheMatch[1], 10) : undefined

							return {
								inputTokens,
								outputTokens,
								cacheReadTokens: cacheReadTokens && cacheReadTokens > 0 ? cacheReadTokens : undefined,
							}
						}
					} catch (parseError) {
						// Continue searching if this line couldn't be parsed
						continue
					}
				}
			}

			return null
		} catch (error) {
			console.warn("🔗 Gemini CLI: Failed to parse token usage from telemetry:", error)
			return null
		}
	}

	/**
	 * Calculate cost for Gemini CLI provider
	 * Always returns $0 since OAuth/code assist authentication is free
	 */
	public calculateCost(): number {
		return 0 // OAuth authentication = free usage
	}
}
