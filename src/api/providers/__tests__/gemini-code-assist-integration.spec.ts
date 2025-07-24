// Integration tests for GeminiCodeAssistHandler
// To run: RUN_INTEGRATION_TESTS=true GOOGLE_CLOUD_PROJECT=your-project npx vitest run src/api/providers/__tests__/gemini-code-assist-integration.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import { beforeEach, describe, expect, it } from "vitest"
import { allowNetConnect } from "../../../vitest.setup"

const GEMINI_MODEL = "gemini-2.5-pro"
const TEST_TIMEOUT = 30000 // 30 seconds for real API calls

// Integration tests - these require real authentication and should be run separately
describe("GeminiCodeAssistHandler Integration Tests", () => {
	// Skip integration tests by default - they require real authentication
	const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS
	const projectId = process.env.GOOGLE_CLOUD_PROJECT

	if (!runIntegrationTests) {
		it.skip("Skipping integration tests (set RUN_INTEGRATION_TESTS=true to enable)", () => {})
		return
	}

	if (!projectId) {
		it.skip("Skipping integration tests (GOOGLE_CLOUD_PROJECT environment variable must be set)", () => {})
		return
	}

	describe("OAuth Authentication Test", () => {
		it(
			"should trigger OAuth flow and open browser for authentication",
			async () => {
				// Allow all network connections for OAuth integration test
				allowNetConnect()
				console.log("\n🔐 STARTING OAuth authentication flow test...")
				console.log("📋 Project ID:", projectId)
				console.log("⏰ Current time:", new Date().toISOString())

				try {
					console.log("\n📦 Step 1: Importing OAuth modules...")
					// Import OAuth functions directly
					const { getOauthClient } = await import("../gemini-code-assist-oauth")
					const { AuthType, MinimalConfig } = await import("../gemini-code-assist-config")

					console.log("✅ Successfully imported OAuth modules")

					console.log("\n⚙️  Step 2: Creating config...")
					const config = new MinimalConfig({
						sessionId: `oauth-test-${Date.now()}`,
					})
					console.log("✅ Config created with session ID:", config.getSessionId())

					console.log("\n🔑 Step 3: Starting OAuth client creation...")
					console.log("🌐 This should open a browser window for Google authentication")
					console.log("⚠️  WATCH FOR BROWSER WINDOW TO OPEN")
					console.log("⚠️  Please complete the authentication in the browser when it opens")
					console.log("⏳ Calling getOauthClient now...")

					const startTime = Date.now()
					const client = await getOauthClient(AuthType.LOGIN_WITH_GOOGLE, config)
					const endTime = Date.now()

					console.log(`\n✅ OAuth client obtained successfully! (took ${endTime - startTime}ms)`)
					console.log("🎫 Step 4: Testing access token...")

					const { token } = await client.getAccessToken()
					if (token) {
						console.log("✅ Access token obtained successfully!")
						console.log("🔐 Token length:", token.length)
						console.log("🎉 OAuth authentication test COMPLETED SUCCESSFULLY!")
						expect(token).toBeTruthy()
						expect(token.length).toBeGreaterThan(0)
					} else {
						throw new Error("No access token received")
					}
				} catch (error) {
					console.error("\n❌ OAuth test failed:", error.message)
					console.error("📚 Error stack:", error.stack)
					throw error
				}
			},
			TEST_TIMEOUT,
		)
	})

	describe("Real API calls", () => {
		let handler: any
		let GeminiCodeAssistHandler: any

		beforeEach(async () => {
			// Dynamic import to avoid OpenTelemetry issues during test setup
			try {
				const module = await import("../gemini-code-assist")
				GeminiCodeAssistHandler = module.GeminiCodeAssistHandler

				handler = new GeminiCodeAssistHandler({
					apiModelId: GEMINI_MODEL,
					geminiCliProjectId: projectId,
				})

				console.log(`✅ Successfully loaded GeminiCodeAssistHandler for project: ${projectId}`)
			} catch (error) {
				console.error("❌ Failed to load GeminiCodeAssistHandler:", error.message)
				throw error
			}
		})

		it(
			"should authenticate and make a real API call",
			async () => {
				// Allow all network connections for API integration test
				allowNetConnect()

				const mockMessages: Anthropic.Messages.MessageParam[] = [
					{
						role: "user",
						content: "Say 'Hello from Code Assist!' and nothing else.",
					},
				]

				const systemPrompt = "You are a helpful assistant. Follow instructions exactly."
				const metadata = { taskId: `integration-test-${Date.now()}` }

				console.log("Starting integration test with taskId:", metadata.taskId)

				const stream = handler.createMessage(systemPrompt, mockMessages, metadata)
				const chunks = []

				try {
					for await (const chunk of stream) {
						chunks.push(chunk)
						console.log("Received chunk:", chunk)
					}

					// Should have received at least one text chunk and one usage chunk
					expect(chunks.length).toBeGreaterThan(0)

					const textChunks = chunks.filter((c) => c.type === "text")
					const usageChunks = chunks.filter((c) => c.type === "usage")

					expect(textChunks.length).toBeGreaterThan(0)
					expect(usageChunks.length).toBe(1)

					// Verify the response contains expected text
					const fullText = textChunks.map((c) => c.text).join("")
					console.log("Full response text:", fullText)
					expect(fullText.toLowerCase()).toContain("hello")

					// Verify usage metadata
					const usage = usageChunks[0]
					expect(usage.inputTokens).toBeGreaterThan(0)
					expect(usage.outputTokens).toBeGreaterThan(0)
					expect(usage.totalCost).toBeUndefined() // Code Assist uses quota pricing

					console.log("Integration test completed successfully!")
				} catch (error) {
					console.error("Integration test failed:", error)
					throw error
				}
			},
			TEST_TIMEOUT,
		)

		it(
			"should handle completePrompt with real API",
			async () => {
				try {
					console.log("Testing completePrompt...")
					const result = await handler.completePrompt("What is 2+2? Answer with just the number.")

					expect(result).toBeTruthy()
					expect(typeof result).toBe("string")
					console.log("Complete prompt result:", result)

					// Should contain the answer
					expect(result.trim()).toMatch(/4/)
				} catch (error) {
					console.error("Complete prompt integration test failed:", error)
					throw error
				}
			},
			TEST_TIMEOUT,
		)

		it(
			"should handle token counting with real API",
			async () => {
				const content: Anthropic.Messages.ContentBlockParam[] = [
					{
						type: "text",
						text: "This is a test message for token counting.",
					},
				]

				try {
					console.log("Testing token counting...")
					const tokenCount = await handler.countTokens(content)

					expect(tokenCount).toBeGreaterThan(0)
					expect(typeof tokenCount).toBe("number")
					console.log("Token count result:", tokenCount)
				} catch (error) {
					console.error("Token counting integration test failed:", error)
					throw error
				}
			},
			TEST_TIMEOUT,
		)

		it(
			"should handle reasoning models with real API",
			async () => {
				// Dynamic import for reasoning handler
				const { GeminiCodeAssistHandler } = await import("../gemini-code-assist")

				const reasoningHandler = new GeminiCodeAssistHandler({
					apiModelId: "gemini-2.0-flash-thinking-exp-1219:thinking",
					geminiCliProjectId: projectId!,
				})

				const mockMessages: Anthropic.Messages.MessageParam[] = [
					{
						role: "user",
						content: "Think step by step: What is the capital of France?",
					},
				]

				const systemPrompt = "Think carefully before answering."
				const metadata = { taskId: `reasoning-test-${Date.now()}` }

				console.log("Testing reasoning model with taskId:", metadata.taskId)

				const stream = reasoningHandler.createMessage(systemPrompt, mockMessages, metadata)
				const chunks = []

				try {
					for await (const chunk of stream) {
						chunks.push(chunk)
						console.log("Reasoning chunk:", chunk)
					}

					// Should have received reasoning and text chunks
					const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
					const textChunks = chunks.filter((c) => c.type === "text")

					// May or may not have reasoning chunks depending on the model's behavior
					console.log(
						`Received ${reasoningChunks.length} reasoning chunks and ${textChunks.length} text chunks`,
					)

					expect(textChunks.length).toBeGreaterThan(0)

					const fullText = textChunks.map((c) => c.text).join("")
					console.log("Reasoning response:", fullText)
					expect(fullText.toLowerCase()).toContain("paris")
				} catch (error) {
					console.error("Reasoning integration test failed:", error)
					throw error
				}
			},
			TEST_TIMEOUT,
		)

		it(
			"should validate session ID handling per task",
			async () => {
				const taskId1 = `session-test-1-${Date.now()}`
				const taskId2 = `session-test-2-${Date.now()}`

				const mockMessages: Anthropic.Messages.MessageParam[] = [
					{
						role: "user",
						content: "Hello, this is a session test.",
					},
				]

				const systemPrompt = "You are a helpful assistant."

				console.log("Testing session ID handling with two different tasks...")

				// Test with first task ID
				const stream1 = handler.createMessage(systemPrompt, mockMessages, { taskId: taskId1 })
				const chunks1 = []
				for await (const chunk of stream1) {
					chunks1.push(chunk)
				}

				// Test with second task ID
				const stream2 = handler.createMessage(systemPrompt, mockMessages, { taskId: taskId2 })
				const chunks2 = []
				for await (const chunk of stream2) {
					chunks2.push(chunk)
				}

				// Both should succeed and have usage data
				const usage1 = chunks1.find((c) => c.type === "usage")
				const usage2 = chunks2.find((c) => c.type === "usage")

				expect(usage1).toBeDefined()
				expect(usage2).toBeDefined()

				console.log("Session test completed - both tasks processed successfully")
				console.log("Task 1 usage:", usage1)
				console.log("Task 2 usage:", usage2)
			},
			TEST_TIMEOUT,
		)
	})
})

// Basic unit tests that don't require the provider import
describe("GeminiCodeAssistHandler Unit Tests", () => {
	it("should have correct test constants", () => {
		expect(GEMINI_MODEL).toBe("gemini-2.5-pro")
		expect(TEST_TIMEOUT).toBe(30000)
	})

	it("should validate environment setup", () => {
		const runTests = process.env.RUN_INTEGRATION_TESTS === "true"
		const hasProject = !!process.env.GOOGLE_CLOUD_PROJECT

		console.log("Integration tests enabled:", runTests)
		console.log("Google Cloud Project set:", hasProject)

		if (runTests && !hasProject) {
			console.warn("Integration tests are enabled but GOOGLE_CLOUD_PROJECT is not set")
		}

		// This test always passes, it's just for logging
		expect(true).toBe(true)
	})
})
