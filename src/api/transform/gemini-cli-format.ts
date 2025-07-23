import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Convert Anthropic content blocks to plain text for Gemini CLI
 * The CLI expects simple text prompts, not structured JSON
 */
export function convertAnthropicContentToText(content: string | Anthropic.ContentBlockParam[]): string {
	if (typeof content === "string") {
		return content
	}

	return content
		.map((block): string => {
			switch (block.type) {
				case "text":
					return block.text
				case "image":
					// CLI doesn't support images directly, provide description
					return "[Image content - not supported in CLI mode]"
				case "tool_use":
					// Convert tool use to text description
					return `[Tool: ${block.name} with input: ${JSON.stringify(block.input)}]`
				case "tool_result":
					// Convert tool result to text
					if (typeof block.content === "string") {
						return `[Tool result: ${block.content}]`
					}
					if (Array.isArray(block.content)) {
						return block.content
							.map((item) => (item.type === "text" ? item.text : "[Non-text tool result]"))
							.join("")
					}
					return "[Tool result]"
				default:
					return "[Unsupported content type]"
			}
		})
		.join("")
}

/**
 * Convert an Anthropic message to plain text for Gemini CLI
 */
export function convertAnthropicMessageToText(message: Anthropic.Messages.MessageParam): string {
	const content = convertAnthropicContentToText(message.content)

	// Add role prefix for clarity in multi-turn conversations
	const rolePrefix = message.role === "assistant" ? "Assistant: " : "User: "
	return `${rolePrefix}${content}`
}

/**
 * Convert multiple Anthropic messages to a single text prompt for Gemini CLI
 * This combines all messages into a conversation format
 */
export function convertAnthropicMessagesToPrompt(
	messages: Anthropic.Messages.MessageParam[],
	systemInstruction?: string,
): string {
	const parts: string[] = []

	// Add system instruction if provided
	if (systemInstruction) {
		parts.push(
			`System: **IMPORTANT** Ensure you put carriage returns before commands or markdown. DO NOT do eg "First, I'll update the todo list.\`\`\`xml...."\n\n${systemInstruction}`,
		)
	}

	// Convert each message
	for (const message of messages) {
		parts.push(convertAnthropicMessageToText(message))
	}

	return parts.join("\n\n")
}

/**
 * Simple conversion for single user prompt (most common CLI use case)
 */
export function convertToSimplePrompt(messages: Anthropic.Messages.MessageParam[], systemInstruction?: string): string {
	// For simple cases, just extract the text content without role prefixes
	const userMessages = messages.filter((m) => m.role === "user")
	const lastUserMessage = userMessages[userMessages.length - 1]

	if (!lastUserMessage) {
		return systemInstruction || ""
	}

	const userContent = convertAnthropicContentToText(lastUserMessage.content)

	if (systemInstruction) {
		return `${systemInstruction}\n\n${userContent}`
	}

	return userContent
}
