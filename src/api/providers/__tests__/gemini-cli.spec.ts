// Unit tests for GeminiCliHandler - tests logic without executing real CLI commands
// npx vitest run src/api/providers/__tests__/gemini-cli.unit.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import { join } from "path"
import { homedir } from "os"
import { promises as fs } from "fs"
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
	describe("getModel", () => {
		it("should return correct model info without incorrect mapping", () => {
			const modelInfo = handler.getModel()

			// Should use the actual selected model ID (no more incorrect mapping)
			expect(modelInfo.id).toBe("gemini-2.5-pro")
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBeGreaterThan(0)
			expect(modelInfo.info.contextWindow).toBeGreaterThan(0)
		})

		it("should handle thinking model suffix correctly", () => {
			const handler = new GeminiCliHandler({ apiModelId: "gemini-2.5-flash-preview-04-17:thinking" })
			const modelInfo = handler.getModel()

			// Should remove :thinking suffix for CLI
			expect(modelInfo.id).toBe("gemini-2.5-flash-preview-04-17")
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
			// Create the test directory and call ensureSettingsFile
			await fs.mkdir(tempGeminiDir, { recursive: true })

			// Mock the settings file path for testing
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
