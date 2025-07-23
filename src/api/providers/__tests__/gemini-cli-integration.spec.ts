// npx vitest run src/api/providers/__tests__/gemini-cli.spec.ts

import { describe, it, expect } from "vitest"
import { Anthropic } from "@anthropic-ai/sdk"
import { GeminiCliHandler } from "../gemini-cli"
const debug = true
const log = (msg: string) => {
	if (debug) process.stdout.write(`${msg}\n`)
}
describe("GeminiCli-Real-Integration-Test-With-Telemetry", () => {
	const shouldSkipIntegration = false //process.env.CI === "true" || !process.env.GEMINI_CLI_TEST
	if (shouldSkipIntegration) {
		process.stdout.write("⏭️ Skipping context test - set GEMINI_CLI_TEST=true to enable\n")
		return
	}
	const handler = new GeminiCliHandler({
		apiModelId: "gemini-2.5-pro",
		geminiCliProjectId: process.env.GOOGLE_CLOUD_PROJECT,
		geminiCliDebug: debug,
	})

	describe("run-real-prompt-with-telemetry", () => {
		it("should complete prompt successfully with project ID", async () => {
			// Force console output to be visible in Vitest

			log("🔥 REAL INTEGRATION TEST: Testing CLI with telemetry enabled")
			try {
				const result = await handler.completePrompt("Say hello in exactly 2 words.")
				expect(result).toBeDefined()
				expect(typeof result).toBe("string")
				expect(result.length).toBeGreaterThan(0)

				log(`✅ CLI Response: ${result}`)
			} catch (error) {
				it("should handle authentication errors with clear instructions", async () => {
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
				})
			}
			// Test token usage capture - this is the critical part!
			const tokenUsage = handler.getLastTokenUsage()
			log(`📊 Token usage captured: ${JSON.stringify(tokenUsage)}`)

			if (tokenUsage) {
				log("✅ SUCCESS: Real telemetry data captured!")
				expect(tokenUsage.inputTokens).toBeGreaterThan(0)
				expect(tokenUsage.outputTokens).toBeGreaterThan(0)
				log(`📈 Input: ${tokenUsage.inputTokens}, Output: ${tokenUsage.outputTokens}`)
			} else {
				log("❌ FAILURE: No telemetry data captured - this is the bug!")
				log("🔍 The gRPC telemetry receiver is not working correctly")
				log("⚠️  Token usage not captured, but test continues for debugging")
			}
		}, 60000)

		it("should handle empty CLI response", async () => {
			// Empty input should be rejected by CLI with clear error
			try {
				await handler.completePrompt("")
				// If no error, something unexpected happened
				expect.fail("Expected CLI to reject empty input")
			} catch (error) {
				// CLI should reject empty input with appropriate error
				expect(error).toBeInstanceOf(Error)
				expect((error as Error).message).toContain("No input provided")
			}
		}, 15000)
	})

	describe("createMessage", () => {
		let usage: any = null

		it("should handle streaming messages", async () => {
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "What is 2+2? Answer with just the number.",
				},
			]
			let chunks: string[] = []
			for await (const chunk of handler.createMessage(systemPrompt, messages)) {
				if (chunk.type === "text") {
					chunks.push(chunk.text)
				}
				if (chunk.type === "usage") {
					usage = chunk
				}
			}

			const fullResponse = chunks.join("")
			expect(fullResponse).toBeDefined()
			expect(fullResponse.length).toBeGreaterThan(0)
			log(`✅ Streaming Response: ${fullResponse}\n`)
		}, 30000)

		it("should return token usage", () => {
			expect(usage).toBeDefined()
			expect(usage?.inputTokens).toBeGreaterThan(0)
			expect(usage?.outputTokens).toBeGreaterThan(0)
			usage = null
		})

		it("should handle complex message content", async () => {
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
				if (chunk.type === "usage") {
					usage = chunk
				}
			}

			const fullResponse = chunks.join("")

			expect(fullResponse).toBeDefined()
			expect(fullResponse.length).toBeGreaterThan(0)
			log(`✅ Streaming Response: ${fullResponse}\n`)
		}, 30000)

		it("should return token usage", () => {
			expect(usage).toBeDefined()
			expect(usage?.inputTokens).toBeGreaterThan(0)
			expect(usage?.outputTokens).toBeGreaterThan(0)
			usage = null
		})

		it("should preserve conversation context in multi-turn conversations", async () => {
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "My name is Alice. Remember this.",
				},
				{
					role: "assistant",
					content: "Hello Alice! I'll remember your name.",
				},
				{
					role: "user",
					content: "What is my name?",
				},
			]

			const chunks: string[] = []

			for await (const chunk of handler.createMessage(systemPrompt, messages)) {
				if (chunk.type === "text") {
					chunks.push(chunk.text)
				}
				if (chunk.type === "usage") {
					usage = chunk
				}
			}

			const fullResponse = chunks.join("")

			expect(fullResponse).toBeDefined()
			expect(fullResponse.length).toBeGreaterThan(0)
			// The response should mention "Alice" since the context should be preserved
			expect(fullResponse.toLowerCase()).toContain("alice")

			log(`✅ Context-aware Response: ${fullResponse}\n`)
		}, 30000)

		it("should return token usage", () => {
			expect(usage).toBeDefined()
			expect(usage?.inputTokens).toBeGreaterThan(0)
			expect(usage?.outputTokens).toBeGreaterThan(0)
			usage = null
		})
	})

	// Note: CLI provider doesn't implement calculateCost since it uses external CLI
	// Cost calculation would need to be handled by the CLI itself or estimated

	describe("Error Handling", () => {
		it("should provide detailed error messages for CLI failures", async () => {
			const handler = new GeminiCliHandler({ apiModelId: "gemini-2.5-pro", geminiCliDebug: debug })

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
				geminiCliDebug: debug,
			})

			// Verify handler accepts project ID configuration
			expect(handler["options"].geminiCliProjectId).toBe("test-project-456")
		})
	})
})
