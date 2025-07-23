# Gemini Code Assist Provider Tests

This document explains how to run tests for the `gemini-code-assist` provider.

## Test Files

- `gemini-code-assist-integration.spec.ts` - Comprehensive integration tests with real API calls

## Running Tests

### Unit Tests Only (Default)

```bash
cd src
npx vitest run api/providers/__tests__/gemini-code-assist-integration.spec.ts
```

### Integration Tests with Real API Calls

```bash
# Set environment variables
export RUN_INTEGRATION_TESTS=true
export GOOGLE_CLOUD_PROJECT=your-google-cloud-project-id

# Run tests
cd src
npx vitest run api/providers/__tests__/gemini-code-assist-integration.spec.ts
```

## Test Coverage

### Unit Tests

- ✅ Basic configuration validation
- ✅ Environment setup verification
- ✅ Test constants validation

### Integration Tests (Real API Calls)

- ✅ **Authentication & Basic API Call** - Validates OAuth flow and Code Assist server access
- ✅ **Complete Prompt** - Tests single completion functionality
- ✅ **Token Counting** - Validates token counting with real API
- ✅ **Reasoning Models** - Tests thinking models with `:thinking` suffix
- ✅ **Session ID Handling** - Validates per-task session correlation

## Prerequisites for Integration Tests

1. **Google Cloud Project**: You need a Google Cloud project with Code Assist API enabled
2. **Authentication**: The CLI's OAuth flow will be triggered during tests
3. **Environment Variables**:
    - `RUN_INTEGRATION_TESTS=true` - Enables integration tests
    - `GOOGLE_CLOUD_PROJECT=your-project-id` - Your Google Cloud project ID

## What the Integration Tests Validate

### 1. Authentication Flow

- Tests that the provider can successfully authenticate using the Gemini CLI's OAuth flow
- Validates that the `GOOGLE_CLOUD_PROJECT` environment variable is properly set
- Confirms that the OAuth client is created and can access the Code Assist API

### 2. Session ID Correlation

- Tests that each chat thread (taskId) gets its own session ID
- Validates that different tasks use different session IDs for proper telemetry tracking
- Confirms fallback to CLI default session ID when taskId is not provided

### 3. Real API Functionality

- **Streaming responses**: Tests that the provider can handle streaming LLM responses
- **Token usage tracking**: Validates that input/output tokens are properly counted
- **Reasoning models**: Tests thinking models with the `:thinking` suffix
- **Error handling**: Ensures proper error messages for authentication or API failures

### 4. Provider Interface Compliance

- Tests all required methods: `createMessage`, `completePrompt`, `countTokens`
- Validates return types and data structures match Roo-Code expectations
- Confirms cost calculation returns `undefined` (quota-based pricing)

## Expected Test Output

When running integration tests successfully, you should see:

```
✓ should authenticate and make a real API call
✓ should handle completePrompt with real API
✓ should handle token counting with real API
✓ should handle reasoning models with real API
✓ should validate session ID handling per task
```

## Troubleshooting

### Common Issues

1. **OpenTelemetry Import Errors**: The integration tests use dynamic imports to avoid CommonJS/ESM compatibility issues
2. **Authentication Failures**: Ensure you're logged in with `gemini auth login` or the OAuth flow will be triggered
3. **Project Access**: Make sure your Google Cloud project has Code Assist API enabled
4. **Network Issues**: Tests have a 30-second timeout for real API calls

### Debug Output

The integration tests include extensive console logging to help debug issues:

- Task IDs for session correlation
- Chunk-by-chunk streaming output
- Token usage statistics
- Full response text for validation

## Test Architecture

The tests are designed to:

- **Avoid import issues** by using dynamic imports for the provider
- **Skip by default** to prevent accidental API calls during CI/CD
- **Provide detailed logging** for debugging authentication and API issues
- **Test real functionality** rather than just mocked responses
- **Validate session correlation** which is critical for proper token tracking
