/**
 * Minimal Config implementation for Gemini Code Assist provider
 * This avoids OpenTelemetry dependencies from the full @google/gemini-cli-core Config class
 */

import { randomUUID } from "crypto"

// Simple session ID generator (replicated from gemini-cli)
export const generateSessionId = (): string => randomUUID()

// Minimal Config class that only includes what we need for Code Assist
export class MinimalConfig {
	private readonly sessionId: string
	private readonly proxy?: string

	constructor(
		options: {
			sessionId?: string
			proxy?: string
		} = {},
	) {
		this.sessionId = options.sessionId || generateSessionId()
		this.proxy = options.proxy
	}

	getSessionId(): string {
		return this.sessionId
	}

	getProxy(): string | undefined {
		return this.proxy
	}
}

// Export AuthType enum (replicated from gemini-cli)
export enum AuthType {
	LOGIN_WITH_GOOGLE = "LOGIN_WITH_GOOGLE",
	CLOUD_SHELL = "CLOUD_SHELL",
}
