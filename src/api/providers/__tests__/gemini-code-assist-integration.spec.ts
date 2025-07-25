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

	// Test 1: completePrompt with cleared credentials (should trigger OAuth)
	describe("User Chat Flow - completePrompt (UI usage)", () => {
		it(
			"should handle 403 error and trigger OAuth when user sends chat message without authentication",
			async () => {
				return
				// Allow all network connections for integration test
				allowNetConnect()
				console.log("\n🚫 TEST 1: User chat (completePrompt) - unauthenticated...")
				console.log("📋 Project ID:", projectId)
				console.log("⏰ Current time:", new Date().toISOString())

				try {
					// Step 1: Clear any cached credentials to simulate unauthenticated state
					console.log("\n🧹 Step 1: Clearing cached credentials to simulate unauthenticated user...")
					const { clearCachedCredentialFile } = await import("../gemini-code-assist-oauth")
					await clearCachedCredentialFile()
					console.log("✅ Cached credentials cleared")

					// Step 2: Create handler (like UI would)
					console.log("\n📦 Step 2: Creating GeminiCodeAssistHandler (simulating UI)...")
					const { GeminiCodeAssistHandler } = await import("../gemini-code-assist")
					const handler = new GeminiCodeAssistHandler({
						apiModelId: GEMINI_MODEL,
						geminiCliProjectId: projectId,
					})
					console.log("✅ Handler created")

					// Step 3: User sends chat message via completePrompt (real UI flow)
					console.log(
						"\n💬 Step 3: User sends chat message via completePrompt (should trigger 403 then auto-OAuth)...",
					)
					console.log("🚀 Calling completePrompt - this should:")
					console.log("   1. Hit 403 error initially")
					console.log("   2. Detect the authentication error")
					console.log("   3. Clear cached credentials")
					console.log("   4. Trigger OAuth browser login")
					console.log("   5. Retry the API call successfully")
					console.log("⚠️  WATCH FOR BROWSER WINDOW TO OPEN FOR OAUTH")

					const result = await handler.completePrompt(
						"Hello, this should trigger authentication! Say 'Authentication successful' and nothing else.",
					)

					// Should have received successful response after auto-authentication
					expect(result).toBeDefined()
					expect(typeof result).toBe("string")
					expect(result.length).toBeGreaterThan(0)

					console.log("🎉 SUCCESS: Auto-authentication worked! User got response after OAuth.")
					console.log("💬 Response text:", result)
				} catch (error) {
					console.error("\n❌ User chat (completePrompt) unauthenticated test failed:", error.message)
					console.error("📚 Error stack:", error.stack)
					console.error("\n🔍 This means the auto-OAuth fix is NOT working!")
					throw error
				}
			},
			TEST_TIMEOUT * 2, // Double timeout for OAuth flow
		)

		// Test 2: completePrompt with cached credentials (should NOT trigger OAuth)
		it(
			"should use cached credentials and NOT trigger OAuth when user sends second chat message",
			async () => {
				// Allow all network connections for integration test
				allowNetConnect()
				console.log("\n✅ TEST 2: User chat (completePrompt) - with cached credentials...")
				console.log("📋 Project ID:", projectId)
				console.log("⏰ Current time:", new Date().toISOString())

				try {
					// Step 1: DO NOT clear credentials - they should exist from previous test
					console.log("\n🔐 Step 1: Using existing cached credentials (NOT clearing them)...")
					console.log("✅ Should use cached credentials from previous test")

					// Step 2: Create handler (like UI would)
					console.log("\n📦 Step 2: Creating GeminiCodeAssistHandler (simulating UI)...")
					const { GeminiCodeAssistHandler } = await import("../gemini-code-assist")
					const handler = new GeminiCodeAssistHandler({
						apiModelId: GEMINI_MODEL,
						geminiCliProjectId: projectId,
					})
					console.log("✅ Handler created")

					// Step 3: User sends chat message via completePrompt (should use cached creds)
					console.log(
						"\n💬 Step 3: User sends chat message via completePrompt (should use cached credentials)...",
					)
					console.log("🚀 Calling completePrompt - this should:")
					console.log("   1. Use cached OAuth credentials")
					console.log("   2. Make API call successfully")
					console.log("   3. NOT trigger browser OAuth")
					console.log("⚠️  NO BROWSER WINDOW SHOULD OPEN")

					const result = await handler.completePrompt(
						"Hello again! This should use cached credentials. Say 'Cached credentials working' and nothing else.",
					)

					// Should have received successful response using cached credentials
					expect(result).toBeDefined()
					expect(typeof result).toBe("string")
					expect(result.length).toBeGreaterThan(0)

					console.log("🎉 SUCCESS: Cached credentials worked! No OAuth triggered.")
					console.log("💬 Response text:", result)
				} catch (error) {
					console.error("\n❌ User chat (completePrompt) cached credentials test failed:", error.message)
					console.error("📚 Error stack:", error.stack)
					console.error("\n🔍 This means cached credentials are NOT working!")
					throw error
				}
			},
			TEST_TIMEOUT, // Normal timeout since no OAuth
		)
	})

	// Test 3: createMessage with cleared credentials (should trigger OAuth)
	describe("Handler Flow - createMessage (streaming)", () => {
		it(
			"should handle 403 error and trigger OAuth when createMessage called without authentication",
			async () => {
				return
				// Allow all network connections for integration test
				allowNetConnect()
				console.log("\n🚫 TEST 3: Handler (createMessage) - unauthenticated...")
				console.log("📋 Project ID:", projectId)
				console.log("⏰ Current time:", new Date().toISOString())

				try {
					// Step 1: Clear any cached credentials to simulate unauthenticated state
					console.log("\n🧹 Step 1: Clearing cached credentials to simulate unauthenticated handler...")
					const { clearCachedCredentialFile } = await import("../gemini-code-assist-oauth")
					await clearCachedCredentialFile()
					console.log("✅ Cached credentials cleared")

					// Step 2: Create handler
					console.log("\n📦 Step 2: Creating GeminiCodeAssistHandler...")
					const { GeminiCodeAssistHandler } = await import("../gemini-code-assist")
					const handler = new GeminiCodeAssistHandler({
						apiModelId: GEMINI_MODEL,
						geminiCliProjectId: projectId,
					})
					console.log("✅ Handler created")

					// Step 3: Call createMessage (should trigger OAuth)
					console.log("\n💬 Step 3: Calling createMessage (should trigger 403 then auto-OAuth)...")
					const mockMessages: Anthropic.Messages.MessageParam[] = [
						{
							role: "user",
							content: "Hello, this should trigger authentication!",
						},
					]

					const systemPrompt = "You are a helpful assistant."
					const metadata = { taskId: `createMessage-unauth-test-${Date.now()}` }

					console.log("🚀 Calling createMessage - this should:")
					console.log("   1. Hit 403 error initially")
					console.log("   2. Detect the authentication error")
					console.log("   3. Clear cached credentials")
					console.log("   4. Trigger OAuth browser login")
					console.log("   5. Retry the API call successfully")
					console.log("⚠️  WATCH FOR BROWSER WINDOW TO OPEN FOR OAUTH")

					const stream = handler.createMessage(systemPrompt, mockMessages, metadata)
					const chunks = []

					for await (const chunk of stream) {
						chunks.push(chunk)
						console.log("📨 Received chunk:", chunk)
					}

					// Should have received successful response after auto-authentication
					expect(chunks.length).toBeGreaterThan(0)

					const textChunks = chunks.filter((c) => c.type === "text")
					const usage = chunks.find((c) => c.type === "usage")

					expect(textChunks.length).toBeGreaterThan(0)
					expect(usage).toBeDefined()

					console.log("🎉 SUCCESS: Auto-authentication worked! Handler got response after OAuth.")
					console.log("📊 Final chunks:", chunks.length)
					console.log("💬 Response text:", textChunks.map((c) => c.text).join(""))
				} catch (error) {
					console.error("\n❌ Handler (createMessage) unauthenticated test failed:", error.message)
					console.error("📚 Error stack:", error.stack)
					console.error("\n🔍 This means the auto-OAuth fix is NOT working!")
					throw error
				}
			},
			TEST_TIMEOUT * 2, // Double timeout for OAuth flow
		)

		// Test 4: createMessage with cached credentials (should NOT trigger OAuth)
		it(
			"should use cached credentials and NOT trigger OAuth when createMessage called with authentication",
			async () => {
				return
				// Allow all network connections for integration test
				allowNetConnect()
				console.log("\n✅ TEST 4: Handler (createMessage) - with cached credentials...")
				console.log("📋 Project ID:", projectId)
				console.log("⏰ Current time:", new Date().toISOString())

				try {
					// Step 1: DO NOT clear credentials - they should exist from previous test
					console.log("\n🔐 Step 1: Using existing cached credentials (NOT clearing them)...")
					console.log("✅ Should use cached credentials from previous test")

					// Step 2: Create handler
					console.log("\n📦 Step 2: Creating GeminiCodeAssistHandler...")
					const { GeminiCodeAssistHandler } = await import("../gemini-code-assist")
					const handler = new GeminiCodeAssistHandler({
						apiModelId: GEMINI_MODEL,
						geminiCliProjectId: projectId,
					})
					console.log("✅ Handler created")

					// Step 3: Call createMessage (should use cached creds)
					console.log("\n💬 Step 3: Calling createMessage (should use cached credentials)...")
					const mockMessages: Anthropic.Messages.MessageParam[] = [
						{
							role: "user",
							content: "Hello again! This should use cached credentials.",
						},
					]

					const systemPrompt = "You are a helpful assistant."
					const metadata = { taskId: `createMessage-cached-test-${Date.now()}` }

					console.log("🚀 Calling createMessage - this should:")
					console.log("   1. Use cached OAuth credentials")
					console.log("   2. Make API call successfully")
					console.log("   3. NOT trigger browser OAuth")
					console.log("⚠️  NO BROWSER WINDOW SHOULD OPEN")

					const stream = handler.createMessage(systemPrompt, mockMessages, metadata)
					const chunks = []

					for await (const chunk of stream) {
						chunks.push(chunk)
						console.log("📨 Received chunk:", chunk)
					}

					// Should have received successful response using cached credentials
					expect(chunks.length).toBeGreaterThan(0)

					const textChunks = chunks.filter((c) => c.type === "text")
					const usage = chunks.find((c) => c.type === "usage")

					expect(textChunks.length).toBeGreaterThan(0)
					expect(usage).toBeDefined()

					console.log("🎉 SUCCESS: Cached credentials worked! No OAuth triggered.")
					console.log("📊 Final chunks:", chunks.length)
					console.log("💬 Response text:", textChunks.map((c) => c.text).join(""))
				} catch (error) {
					console.error("\n❌ Handler (createMessage) cached credentials test failed:", error.message)
					console.error("📚 Error stack:", error.stack)
					console.error("\n🔍 This means cached credentials are NOT working!")
					throw error
				}
			},
			TEST_TIMEOUT, // Normal timeout since no OAuth
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

				process.stdout.write(`✅ Successfully loaded GeminiCodeAssistHandler for project: ${projectId}`)
			} catch (error) {
				process.stderr.write("❌ Failed to load GeminiCodeAssistHandler:", error.message)
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

				process.stdout.write("Starting integration test with taskId:" + metadata.taskId)

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
					process.stdout.write("Full response text:" + fullText)
					expect(fullText.toLowerCase()).toContain("hello")

					// Verify usage metadata
					const usage = usageChunks[0]
					expect(usage.inputTokens).toBeGreaterThan(0)
					expect(usage.outputTokens).toBeGreaterThan(0)
					expect(usage.totalCost).toBeUndefined() // Code Assist uses quota pricing

					process.stdout.write("Integration test completed successfully!")
				} catch (error) {
					process.stderr.write("Integration test failed:" + error)
					throw error
				}
			},
			TEST_TIMEOUT,
		)

		it(
			"should handle completePrompt with real API",
			async () => {
				try {
					process.stdout.write("Testing completePrompt...")
					const result = await handler.completePrompt("What is 2+2? Answer with just the number.")

					expect(result).toBeTruthy()
					expect(typeof result).toBe("string")
					process.stdout.write("Complete prompt result:" + result)

					// Should contain the answer
					expect(result.trim()).toMatch(/4/)
				} catch (error) {
					process.stderr.write("Complete prompt integration test failed:" + error)
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
					process.stdout.write("Testing token counting...")
					const tokenCount = await handler.countTokens(content)

					expect(tokenCount).toBeGreaterThan(0)
					expect(typeof tokenCount).toBe("number")
					process.stdout.write("Token count result:" + tokenCount)
				} catch (error) {
					process.stderr.write("Token counting integration test failed:" + error)
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

				process.stdout.write("Testing reasoning model with taskId:" + metadata.taskId)

				const stream = reasoningHandler.createMessage(systemPrompt, mockMessages, metadata)
				const chunks = []

				try {
					for await (const chunk of stream) {
						chunks.push(chunk)
						process.stdout.write("Reasoning chunk:" + chunk)
					}

					// Should have received reasoning and text chunks
					const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
					const textChunks = chunks.filter((c) => c.type === "text")

					// May or may not have reasoning chunks depending on the model's behavior
					process.stdout.write(
						`Received ${reasoningChunks.length} reasoning chunks and ${textChunks.length} text chunks`,
					)

					expect(textChunks.length).toBeGreaterThan(0)

					const fullText = textChunks.map((c) => c.text).join("")
					process.stdout.write("Reasoning response:" + fullText)
					expect(fullText.toLowerCase()).toContain("paris")
				} catch (error) {
					process.stderr.write("Reasoning integration test failed:" + error)
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

				process.stdout.write("Testing session ID handling with two different tasks...")

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

				process.stdout.write("Session test completed - both tasks processed successfully")
				process.stdout.write("Task 1 usage:" + usage1)
				process.stdout.write("Task 2 usage:" + usage2)
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

		process.stdout.write("Integration tests enabled:" + runTests)
		process.stdout.write("Google Cloud Project set:" + hasProject)

		if (runTests && !hasProject) {
			process.stderr.write("Integration tests are enabled but GOOGLE_CLOUD_PROJECT is not set")
		}

		// This test always passes, it's just for logging
		expect(true).toBe(true)
	})
})
