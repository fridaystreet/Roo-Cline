/**
 * Utility functions copied from gemini-cli
 * Replicated from gemini-cli/packages/core/src/utils/errors.ts
 */

export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message
	}
	if (typeof error === "string") {
		return error
	}
	return String(error)
}
