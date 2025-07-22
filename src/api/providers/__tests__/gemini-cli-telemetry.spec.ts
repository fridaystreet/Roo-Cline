import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest"
import { GeminiCliTelemetryReceiver, type TokenUsage } from "../gemini-cli-telemetry"
import nock from "nock"

// Disable Nock entirely for telemetry receiver tests that need real HTTP connections
beforeAll(() => {
	nock.restore()
	nock.cleanAll()
	nock.enableNetConnect()
})

afterAll(() => {
	nock.disableNetConnect()
})

describe("GeminiCliTelemetryReceiver", () => {
	let receiver: GeminiCliTelemetryReceiver

	beforeEach(() => {
		receiver = new GeminiCliTelemetryReceiver()
	})

	afterEach(async () => {
		if (receiver.isRunning()) {
			await receiver.stop()
		}
	})

	describe("Basic Functionality", () => {
		it("should initialize with correct default state", () => {
			expect(receiver.isRunning()).toBe(false)
			expect(receiver.getPort()).toBe(0)
			expect(receiver.getPendingRequestCount()).toBe(0)
		})

		it("should start on a random available port", async () => {
			const port = await receiver.start()
			expect(port).toBeGreaterThan(0)
			expect(port).toBeLessThan(65536)
			expect(receiver.getPort()).toBe(port)
			expect(receiver.isRunning()).toBe(true)
		})

		it("should stop cleanly", async () => {
			await receiver.start()
			await receiver.stop()
			expect(receiver.isRunning()).toBe(false)
			expect(receiver.getPort()).toBe(0)
		})

		it("should not allow starting twice", async () => {
			await receiver.start()
			await expect(receiver.start()).rejects.toThrow("Telemetry receiver already started")
		})

		it("should handle stopping when not started", async () => {
			const newReceiver = new GeminiCliTelemetryReceiver()
			await expect(newReceiver.stop()).resolves.not.toThrow()
		})
	})

	describe("Request Correlation", () => {
		it("should track pending requests correctly", async () => {
			await receiver.start()

			// Start a request with short timeout
			const usagePromise = receiver.waitForTokenUsage(100)
			expect(receiver.getPendingRequestCount()).toBe(1)

			// Wait for timeout
			const result = await usagePromise
			expect(result).toBeNull() // Should timeout
			expect(receiver.getPendingRequestCount()).toBe(0) // Should clean up
		})

		it("should handle multiple concurrent requests", async () => {
			await receiver.start()

			// Start multiple concurrent requests with short timeout
			const promise1 = receiver.waitForTokenUsage(100)
			const promise2 = receiver.waitForTokenUsage(100)

			expect(receiver.getPendingRequestCount()).toBe(2)

			// Wait for both to complete (should timeout)
			const [result1, result2] = await Promise.all([promise1, promise2])

			// Verify that pending requests are cleaned up
			expect(receiver.getPendingRequestCount()).toBe(0)
			expect(result1).toBeNull()
			expect(result2).toBeNull()
		})
	})

	describe("Timeout Handling", () => {
		it("should timeout requests that do not receive telemetry", async () => {
			await receiver.start()
			const result = await receiver.waitForTokenUsage(100) // 100ms timeout
			expect(result).toBeNull()
		})

		it("should clean up timed out requests", async () => {
			await receiver.start()
			const promise1 = receiver.waitForTokenUsage(100)
			const promise2 = receiver.waitForTokenUsage(100)

			expect(receiver.getPendingRequestCount()).toBe(2)

			await Promise.all([promise1, promise2])

			expect(receiver.getPendingRequestCount()).toBe(0)
		})
	})

	describe("Shutdown Behavior", () => {
		it("should resolve pending requests with null when shutting down", async () => {
			await receiver.start()
			const promise1 = receiver.waitForTokenUsage(10000)
			const promise2 = receiver.waitForTokenUsage(10000)

			expect(receiver.getPendingRequestCount()).toBe(2)

			// Stop the receiver while requests are pending
			await receiver.stop()

			const [result1, result2] = await Promise.all([promise1, promise2])

			expect(result1).toBeNull()
			expect(result2).toBeNull()
		})

		it("should not accept new requests when shutting down", async () => {
			await receiver.stop()
			const result = await receiver.waitForTokenUsage(1000)
			expect(result).toBeNull()
		})
	})

	describe("Real HTTP OTLP Integration", () => {
		it("should receive and parse real OTLP telemetry data", async () => {
			const port = await receiver.start()

			const expectedUsage: TokenUsage = {
				inputTokens: 1500,
				outputTokens: 75,
				cacheReadTokens: 200,
				reasoningTokens: 50,
				totalTokens: 1825,
			}

			// Start waiting for telemetry
			const usagePromise = receiver.waitForTokenUsage(5000)

			// Send real OTLP telemetry data
			setTimeout(async () => {
				await sendMockTelemetryData(port, expectedUsage)
			}, 100)

			const result = await usagePromise
			expect(result).toEqual(expectedUsage)
		})

		it("should handle multiple concurrent requests with real HTTP", async () => {
			const port = await receiver.start()

			const usage1: TokenUsage = {
				inputTokens: 1000,
				outputTokens: 50,
				cacheReadTokens: 0,
				reasoningTokens: 25,
				totalTokens: 1075,
			}

			const usage2: TokenUsage = {
				inputTokens: 2000,
				outputTokens: 100,
				cacheReadTokens: 500,
				reasoningTokens: 50,
				totalTokens: 2650,
			}

			// Start multiple concurrent requests
			const promise1 = receiver.waitForTokenUsage(5000)
			const promise2 = receiver.waitForTokenUsage(5000)

			expect(receiver.getPendingRequestCount()).toBe(2)

			// Send telemetry data - should resolve oldest request first
			setTimeout(async () => {
				await sendMockTelemetryData(port, usage1)
			}, 100)

			setTimeout(async () => {
				await sendMockTelemetryData(port, usage2)
			}, 200)

			const [result1, result2] = await Promise.all([promise1, promise2])

			expect(result1).toEqual(usage1)
			expect(result2).toEqual(usage2)
			expect(receiver.getPendingRequestCount()).toBe(0)
		})

		it("should handle HTTP protocol errors correctly", async () => {
			const port = await receiver.start()

			// Test wrong HTTP method
			const getResponse = await fetch(`http://localhost:${port}/v1/logs`, {
				method: "GET",
			})
			expect(getResponse.status).toBe(405)

			// Test wrong endpoint
			const wrongEndpointResponse = await fetch(`http://localhost:${port}/wrong-endpoint`, {
				method: "POST",
			})
			expect(wrongEndpointResponse.status).toBe(404)

			// Test malformed JSON
			const malformedResponse = await fetch(`http://localhost:${port}/v1/logs`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "invalid json",
			})
			expect(malformedResponse.status).toBe(400)
		})

		it("should handle partial token usage data", async () => {
			const port = await receiver.start()

			const partialUsage = {
				inputTokens: 5000,
				outputTokens: 25,
				// Missing cache and reasoning tokens
				totalTokens: 5025,
			}

			const usagePromise = receiver.waitForTokenUsage(5000)

			setTimeout(async () => {
				await sendMockTelemetryData(port, partialUsage as TokenUsage)
			}, 100)

			const result = await usagePromise
			expect(result?.inputTokens).toBe(5000)
			expect(result?.outputTokens).toBe(25)
			expect(result?.cacheReadTokens).toBe(0) // Should default to 0
			expect(result?.reasoningTokens).toBe(0) // Should default to 0
			expect(result?.totalTokens).toBe(5025)
		})
	})
})

/**
 * Helper function to send mock OTLP telemetry data to the receiver
 */
async function sendMockTelemetryData(port: number, tokenUsage: TokenUsage): Promise<void> {
	// Create mock OTLP log structure
	const otlpData = {
		resourceLogs: [
			{
				scopeLogs: [
					{
						logRecords: [
							{
								attributes: [
									{ key: "event.name", value: { stringValue: "api_response" } },
									{
										key: "input_token_count",
										value: { intValue: tokenUsage.inputTokens.toString() },
									},
									{
										key: "output_token_count",
										value: { intValue: tokenUsage.outputTokens.toString() },
									},
									{
										key: "cached_content_token_count",
										value: { intValue: (tokenUsage.cacheReadTokens || 0).toString() },
									},
									{
										key: "thoughts_token_count",
										value: { intValue: (tokenUsage.reasoningTokens || 0).toString() },
									},
									{
										key: "total_token_count",
										value: { intValue: tokenUsage.totalTokens.toString() },
									},
								],
							},
						],
					},
				],
			},
		],
	}

	const response = await fetch(`http://localhost:${port}/v1/logs`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(otlpData),
	})

	if (!response.ok) {
		throw new Error(`Failed to send telemetry data: ${response.status} ${response.statusText}`)
	}
}
