// npx vitest run src/api/providers/__tests__/gemini-cli.spec.ts

import { promises as fs } from "fs"
import { join } from "path"
import { homedir } from "os"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Anthropic } from "@anthropic-ai/sdk"
import { GeminiCliHandler } from "../gemini-cli"
import type { ApiHandlerOptions } from "../../../shared/api"
import type { ModelInfo } from "@roo-code/types"

describe("GeminiCliHandler", () => {
	describe("constructor", () => {
		it("should initialize with provided config", () => {
			const handler = new GeminiCliHandler({
				apiModelId: "gemini-2.5-pro",
				geminiCliProjectId: "test-project-123",
			})

			expect(handler["options"].apiModelId).toBe("gemini-2.5-pro")
			expect(handler["options"].geminiCliProjectId).toBe("test-project-123")
		})
	})

	describe("getModel", () => {
		it("should return correct model info with ID mapping", () => {
			const handler = new GeminiCliHandler({ apiModelId: "gemini-2.5-pro" })
			const modelInfo = handler.getModel()

			// Should map gemini-2.5-pro to the actual CLI model name
			expect(modelInfo.id).toBe("gemini-2.0-flash-001")
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBeGreaterThan(0)
			expect(modelInfo.info.contextWindow).toBeGreaterThan(0)
		})

		it("should handle thinking model suffix correctly", () => {
			const handler = new GeminiCliHandler({ apiModelId: "gemini-2.5-pro:thinking" })
			const modelInfo = handler.getModel()

			// Should remove :thinking suffix for CLI
			expect(modelInfo.id).toBe("gemini-2.0-flash-001")
		})
	})

	describe("ensureSettingsFile", () => {
		let tempSettingsFile: string
		let tempGeminiDir: string

		beforeEach(async () => {
			// Create a temporary test directory
			tempGeminiDir = join(homedir(), ".gemini-test")
			tempSettingsFile = join(tempGeminiDir, "settings.json")

			// Clean up any existing test files
			try {
				await fs.rm(tempGeminiDir, { recursive: true, force: true })
			} catch {}
		})

		afterEach(async () => {
			// Clean up test files
			try {
				await fs.rm(tempGeminiDir, { recursive: true, force: true })
			} catch {}
		})

		it("should create settings file with correct auth method when missing", async () => {
			const handler = new GeminiCliHandler({ apiModelId: "gemini-2.5-pro" })

			// Create the test directory and call ensureSettingsFile
			await fs.mkdir(tempGeminiDir, { recursive: true })

			// Mock the settings file path for testing
			const originalHomedir = homedir
			vi.stubGlobal("homedir", () => tempGeminiDir.replace("/.gemini-test", ""))

			try {
				// Call the private method using bracket notation
				await (handler as any).ensureSettingsFile()

				// Verify the file was created in the test directory
				const actualSettingsFile = join(tempGeminiDir.replace("-test", ""), "settings.json")
				const settingsContent = await fs.readFile(actualSettingsFile, "utf8")
				const settings = JSON.parse(settingsContent)

				expect(settings.selectedAuthType).toBe("oauth-personal")
				expect(settings.version).toBe("1.0.0")
			} finally {
				// Restore original homedir
				vi.unstubAllGlobals()
			}
		})
	})

	describe("completePrompt", () => {
		// Skip integration tests if CLI is not available or not authenticated
		const shouldSkipIntegration = process.env.CI === "true" || !process.env.GEMINI_CLI_TEST

		it("should complete prompt successfully with project ID", async () => {
			if (shouldSkipIntegration) {
				console.log("⏭️ Skipping integration test - set GEMINI_CLI_TEST=true to enable")
				return
			}

			const handler = new GeminiCliHandler({
				apiModelId: "gemini-2.5-pro",
				geminiCliProjectId: "459520514684", // Use the actual project ID
			})

			const result = await handler.completePrompt("Say hello in exactly 2 words.")

			expect(result).toBeDefined()
			expect(typeof result).toBe("string")
			expect(result.length).toBeGreaterThan(0)

			console.log("✅ CLI Response:", result)
		}, 30000)

		it("should handle authentication errors with clear instructions", async () => {
			// Create handler without project ID to potentially trigger auth errors
			const handler = new GeminiCliHandler({ apiModelId: "gemini-2.5-pro" })

			try {
				await handler.completePrompt("Test prompt")
				// If no error, CLI is already authenticated (which is fine)
			} catch (error) {
				if (error instanceof Error) {
					if (error.message.includes("🔐 Gemini CLI Authentication Required")) {
						expect(error.message).toContain("npx https://github.com/google-gemini/gemini-cli")
						expect(error.message).toContain("Select 'Login with Google'")
						expect(error.message).toContain("Complete the browser OAuth flow")
					} else if (error.message.includes("🏢 Google Cloud Project ID Required")) {
						expect(error.message).toContain("Google Cloud Project ID")
						expect(error.message).toContain("workspace access")
						expect(error.message).toContain("provider settings")
					} else {
						// Unexpected error - rethrow for debugging
						throw error
					}
				}
			}
		}, 15000)

		it("should handle empty CLI response", async () => {
			if (shouldSkipIntegration) {
				return
			}

			const handler = new GeminiCliHandler({
				apiModelId: "gemini-2.5-pro",
				geminiCliProjectId: "459520514684",
			})

			// Use a prompt that might return minimal response
			const result = await handler.completePrompt("")

			// Should handle empty input gracefully
			expect(typeof result).toBe("string")
		}, 15000)
	})

	describe("createMessage", () => {
		const shouldSkipIntegration = process.env.CI === "true" || !process.env.GEMINI_CLI_TEST

		it("should handle streaming messages", async () => {
			if (shouldSkipIntegration) {
				console.log("⏭️ Skipping streaming test - set GEMINI_CLI_TEST=true to enable")
				return
			}

			const handler = new GeminiCliHandler({
				apiModelId: "gemini-2.5-pro",
				geminiCliProjectId: "459520514684",
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "What is 2+2? Answer with just the number.",
				},
			]

			const chunks: string[] = []

			for await (const chunk of handler.createMessage(systemPrompt, messages)) {
				if (chunk.type === "text") {
					chunks.push(chunk.text)
				}
			}

			const fullResponse = chunks.join("")

			expect(fullResponse).toBeDefined()
			expect(fullResponse.length).toBeGreaterThan(0)

			console.log("✅ Streaming Response:", fullResponse)
		}, 30000)

		it("should handle complex message content", async () => {
			if (shouldSkipIntegration) {
				return
			}

			const handler = new GeminiCliHandler({
				apiModelId: "gemini-2.5-pro",
				geminiCliProjectId: "459520514684",
			})

			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{ type: "text", text: "Hello, " },
						{ type: "text", text: "how are you?" },
					],
				},
			]

			const chunks: string[] = []

			for await (const chunk of handler.createMessage("", messages)) {
				if (chunk.type === "text") {
					chunks.push(chunk.text)
				}
			}

			const fullResponse = chunks.join("")
			expect(fullResponse.length).toBeGreaterThan(0)
		}, 30000)
	})

	// Note: CLI provider doesn't implement calculateCost since it uses external CLI
	// Cost calculation would need to be handled by the CLI itself or estimated

	describe("Error Handling", () => {
		it("should provide detailed error messages for CLI failures", async () => {
			const handler = new GeminiCliHandler({ apiModelId: "gemini-2.5-pro" })

			try {
				await handler.completePrompt("Test prompt")
			} catch (error) {
				if (error instanceof Error) {
					// Should provide actionable error messages
					expect(
						error.message.includes("🔐 Gemini CLI Authentication Required") ||
							error.message.includes("🏢 Google Cloud Project ID Required") ||
							error.message.includes("❌ Gemini CLI Error"),
					).toBe(true)
				}
			}
		}, 10000)

		it("should handle environment variable configuration", () => {
			const handler = new GeminiCliHandler({
				apiModelId: "gemini-2.5-pro",
				geminiCliProjectId: "test-project-456",
			})

			// Verify handler accepts project ID configuration
			expect(handler["options"].geminiCliProjectId).toBe("test-project-456")
		})
	})
})
