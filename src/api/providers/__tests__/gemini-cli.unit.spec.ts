// Unit tests for GeminiCliHandler - tests logic without executing real CLI commands
// npx vitest run src/api/providers/__tests__/gemini-cli.unit.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import { Anthropic } from "@anthropic-ai/sdk"
import { GeminiCliHandler } from "../gemini-cli"

// Mock child_process to avoid executing real CLI commands
vi.mock("child_process")

describe("GeminiCliHandler", () => {
	let handler: GeminiCliHandler
	const basicConfig = {
		apiModelId: "gemini-2.5-pro",
		geminiCliProjectId: "test-project-123",
	}

	beforeEach(() => {
		handler = new GeminiCliHandler(basicConfig)
		// Clear any previous mocks
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with basic config", () => {
			expect(handler).toBeInstanceOf(GeminiCliHandler)
			// Access private options via bracket notation for testing
			expect(handler["options"].apiModelId).toBe("gemini-2.5-pro")
			expect(handler["options"].geminiCliProjectId).toBe("test-project-123")
		})

		it("should initialize with all CLI options", () => {
			const fullConfig = {
				...basicConfig,

				geminiCliAllFiles: true,
				geminiCliCheckpointing: false,
				geminiCliExperimentalAcp: true,
				geminiCliIdeMode: false,
			}
			const fullHandler = new GeminiCliHandler(fullConfig)

			// Telemetry is now always enabled (no longer configurable)
			expect(fullHandler["options"].geminiCliCheckpointing).toBe(false)
			expect(fullHandler["options"].geminiCliExperimentalAcp).toBe(true)
			expect(fullHandler["options"].geminiCliIdeMode).toBe(false)
		})
	})

	describe("createMessage", () => {
		const mockMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: "Hello, how are you?",
			},
		]

		const systemPrompt = "You are a helpful assistant"

		it("should return an async generator", () => {
			const stream = handler.createMessage(systemPrompt, mockMessages)

			// Should be an async generator
			expect(stream).toBeDefined()
			expect(typeof stream[Symbol.asyncIterator]).toBe("function")
		})

		it("should not execute real CLI in unit tests", () => {
			// Unit tests should not execute real CLI commands
			// This test verifies the method exists and returns the expected type
			const stream = handler.createMessage(systemPrompt, mockMessages)

			// Should be an async generator (the actual CLI execution is tested in integration tests)
			expect(stream).toBeDefined()
			expect(typeof stream[Symbol.asyncIterator]).toBe("function")

			// Don't consume the stream in unit tests - that would trigger real CLI execution
			// Integration tests handle the full end-to-end flow
		})
	})

	describe("token usage tracking", () => {
		it("should initialize with null token usage", () => {
			expect(handler.getLastTokenUsage()).toBeNull()
		})

		it("should have getLastTokenUsage method", () => {
			expect(typeof handler.getLastTokenUsage).toBe("function")
		})
	})

	describe("CLI-specific functionality", () => {
		it("should support all CLI flags in configuration", () => {
			const advancedConfig = {
				...basicConfig,

				geminiCliAllFiles: true,
				geminiCliCheckpointing: true,
				geminiCliExperimentalAcp: true,
				geminiCliIdeMode: true,
			}

			const advancedHandler = new GeminiCliHandler(advancedConfig)

			// All options should be stored correctly
			expect(advancedHandler["options"].geminiCliAllFiles).toBe(true)
			expect(advancedHandler["options"].geminiCliCheckpointing).toBe(true)
			expect(advancedHandler["options"].geminiCliExperimentalAcp).toBe(true)
			expect(advancedHandler["options"].geminiCliIdeMode).toBe(true)
		})

		it("should use project ID for Google Cloud environment", () => {
			const projectHandler = new GeminiCliHandler({
				...basicConfig,
				geminiCliProjectId: "my-special-project-456",
			})

			expect(projectHandler["options"].geminiCliProjectId).toBe("my-special-project-456")
		})
	})
})
