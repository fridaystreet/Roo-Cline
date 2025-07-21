import { spawn } from "child_process"
import { promises as fs } from "fs"
import { join } from "path"
import { homedir } from "os"
import type { Anthropic } from "@anthropic-ai/sdk"
import type { ApiHandlerOptions } from "../../shared/api"
import { getModelParams } from "../transform/model-params"
import { convertToSimplePrompt } from "../transform/gemini-cli-format"
import type { ApiStream } from "../transform/stream"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { BaseProvider } from "./base-provider"
import { geminiDefaultModelId, geminiModels, type GeminiModelId, type ModelInfo } from "@roo-code/types"

export class GeminiCliHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
	}

	async *createMessage(
		systemInstruction: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Use the CLI format transformer to convert messages to text
		const prompt = convertToSimplePrompt(messages, systemInstruction)

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

		// Map internal model IDs to CLI model names
		let cliModelId = id
		if (id === "gemini-2.5-pro") {
			cliModelId = "gemini-2.0-flash-001" // Use the actual CLI model name
		}

		return {
			id: cliModelId.endsWith(":thinking") ? cliModelId.replace(":thinking", "") : cliModelId,
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
		const { id: model } = this.getModel()

		// Ensure settings.json exists with correct auth method
		await this.ensureSettingsFile()

		// Set up environment for Google OAuth (code assist) authentication
		const env = { ...process.env }

		// Use the provided project ID if available
		if (this.options.geminiCliProjectId) {
			env.GOOGLE_CLOUD_PROJECT = this.options.geminiCliProjectId
		}

		// Use OAuth authentication (default when no API key is provided)
		const args = [
			"--prompt",
			prompt,
			"--model",
			model,
			// No API key provided, so CLI will use OAuth by default
		]

		return new Promise((resolve, reject) => {
			const child = spawn("npx", ["https://github.com/google-gemini/gemini-cli", ...args], {
				env,
				stdio: ["pipe", "pipe", "pipe"],
			})

			let output = ""
			let errorOutput = ""

			child.stdout.on("data", (chunk) => {
				output += chunk.toString()
			})

			child.stderr.on("data", (chunk) => {
				errorOutput += chunk.toString()
			})

			child.on("close", (exitCode) => {
				if (exitCode !== 0) {
					const errorMessage = errorOutput.trim()

					// Handle different types of errors with specific user guidance
					if (
						errorMessage.includes("Auth method") ||
						errorMessage.includes("settings.json") ||
						errorMessage.includes("GEMINI_API_KEY")
					) {
						reject(
							new Error(
								"🔐 Gemini CLI Authentication Required\n\n" +
									"The Gemini CLI needs to be set up with Google OAuth authentication.\n\n" +
									"Setup Steps:\n" +
									"1. Run: npx https://github.com/google-gemini/gemini-cli\n" +
									"2. Select 'Login with Google'\n" +
									"3. Complete the browser OAuth flow\n" +
									"4. Try your request again",
							),
						)
						return
					}

					if (errorMessage.includes("GOOGLE_CLOUD_PROJECT") || errorMessage.includes("workspace")) {
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

				resolve(output.trim())
			})

			child.on("error", (error) => {
				reject(new Error(`Failed to spawn Gemini CLI: ${error.message}`))
			})
		})
	}
}
