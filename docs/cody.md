# Cody Provider Implementation Guide

This document outlines how to implement the Cody provider for the Roo-Cline extension, based on Sourcegraph's official Cody implementation.

## Overview

The Cody provider enables communication with a Sourcegraph instance to provide chat functionality. The implementation consists of several key components:

1. API Interface
2. Model Support
3. Message Handling
4. Streaming Support
5. Configuration

## Implementation Details

### 1. Supported Models

Based on Sourcegraph's implementation, the following models are supported:

#### Claude Models
- **Claude 3.5 Sonnet** (Default)
  - ID: claude-3-5-sonnet-20241022
  - Balanced model for chat and edits
  - Input Price: $15/million tokens
  - Output Price: $75/million tokens
  - 4000 token output limit

- **Claude 3 Opus**
  - ID: claude-3-opus-20240229
  - Most powerful model for complex tasks
  - Pro tier
  - Input Price: $75/million tokens
  - Output Price: $225/million tokens

- **Claude 3 Haiku**
  - ID: claude-3-haiku-20240307
  - Fast model for quick responses
  - Input Price: $0.25/million tokens
  - Output Price: $1.25/million tokens

#### OpenAI Models
- **GPT-4o**
  - ID: gpt-4o
  - Balanced model for chat and edits
  - Pro tier
  - Input Price: $5/million tokens
  - Output Price: $15/million tokens

- **o1-preview**
  - ID: o1-preview
  - Advanced chat model
  - Pro tier
  - Input Price: $15/million tokens
  - Output Price: $60/million tokens

- **o1-mini**
  - ID: o1-mini
  - Efficient chat model
  - Pro tier
  - Input Price: $3/million tokens
  - Output Price: $12/million tokens

### 2. API Interface

The provider implements three main methods:

```typescript
async callChat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>
async *callChatStream(request: ChatCompletionRequest): AsyncGenerator<ChatCompletionResponseChunk>
getModels(): CodyModel[]
```

### 3. Request Format

Requests are sent to the `/api/completions/stream` endpoint with the following structure:

```typescript
{
    messages: Message[], // Array of user/assistant messages
    maxTokensToSample: number, // Default: 1000
    temperature: number, // Default: 0.2
    topK: number, // Default: -1
    topP: number, // Default: -1
    model: string, // The selected model ID
    stream: boolean // Whether to stream the response
}
```

### 4. Headers

Required headers for Sourcegraph API requests:

```typescript
{
    "Content-Type": "application/json; charset=utf-8",
    Authorization: `token ${accessToken}`,
    "Accept-Encoding": "gzip;q=0", // Disable compression to prevent response batching
    "X-Sourcegraph-Client": "cody"
}
```

### 5. Message Format

Messages need to be transformed from the OpenAI format to Sourcegraph's format:

```typescript
// OpenAI format
{
    role: "user" | "assistant",
    content: string
}

// Sourcegraph format
{
    speaker: "human" | "assistant",
    text: string
}
```

### 6. Configuration Options

The provider requires three main configuration fields:

```typescript
{
    codyInstanceUrl: string, // Sourcegraph instance URL
    codyModelId: string, // Model ID to use (defaults to claude-3-5-sonnet-20241022)
    authorizationToken: string // Sourcegraph access token
}
```

These are configured through the extension's settings UI, which provides:
- Instance URL input field
- Access token input field (stored securely)
- Model selection dropdown with model information display

### 7. Error Handling

The provider implements comprehensive error handling for:

1. Authentication Errors:
   - Invalid access tokens
   - Missing authorization headers
   - Token expiration

2. Network Errors:
   - Connection failures
   - Timeout issues
   - Invalid response formats

3. Streaming Errors:
   - Stream interruptions
   - Malformed SSE messages
   - Connection drops

4. Model Errors:
   - Invalid model selections
   - Unsupported model features
   - Context length exceeded

5. Rate Limiting:
   - Proper handling of 429 responses
   - Backoff strategies
   - User feedback on limits

### 8. Implementation Notes

Key differences from the original plan:

1. API Endpoint:
   - Uses `/api/completions/stream` instead of `/.api/graphql`
   - Simpler REST-based approach vs GraphQL

2. Configuration:
   - Implemented through UI rather than package.json settings
   - More flexible and user-friendly approach
   - Real-time validation and feedback

3. Model Information:
   - Extended model info display
   - Support for model capabilities
   - Pricing information display

4. Error Handling:
   - More comprehensive error messages
   - Better user feedback
   - Graceful fallbacks

## Security Considerations

1. Access Token Security:
   - Stored securely in memory
   - Never logged or exposed
   - Transmitted only over HTTPS

2. URL Validation:
   - Ensures HTTPS for production instances
   - Validates URL format
   - Prevents malformed requests

3. Error Messages:
   - Sanitized to prevent information leakage
   - User-friendly but secure
   - Appropriate detail level

## References

- [Cody Source Code](https://github.com/sourcegraph/cody)
- [Sourcegraph API Documentation](https://docs.sourcegraph.com/api/graphql)