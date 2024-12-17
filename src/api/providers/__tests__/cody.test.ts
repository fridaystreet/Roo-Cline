/**
 * @jest-environment node
 */

import { CodyHandler } from '../cody'
import { ApiHandlerOptions } from '../../../shared/api'
import { Anthropic } from '@anthropic-ai/sdk'
import { ClineProvider } from '../../../core/webview/ClineProvider'

describe('CodyHandler', () => {
    // This test requires a valid Cody API key to be set in the environment
    // It tests the actual API functionality, not mocked responses
    test('createMessage makes successful API call', async () => {
        const options: ApiHandlerOptions = {
            codyApiKey: 'sgp_fd1b4edb60bf82b8_d06b623e60b7c41e848d559be489a5e4628c0888',
            codyModelId: 'claude-3-5-sonnet-latest', // Override default model
            apiModelId: 'claude-3-5-sonnet-latest' // Required because getModel() checks this
        }

        const handler = new CodyHandler(options)
        const systemPrompt = 'You are a helpful assistant.'
        const messages: Anthropic.Messages.MessageParam[] = [
            { role: 'user', content: "what's 2+2?" }
        ]

        const generator = handler.createMessage(systemPrompt, messages)
        const chunks = []
        let lastChunk = ''
        
        try {
            // Collect chunks until we get a complete response
            for await (const chunk of generator) {
                if (chunk.type === 'text' && chunk.text !== lastChunk) {
                    console.log('Received new chunk from API:', chunk)
                    chunks.push(chunk)
                    lastChunk = chunk.text
                }
                
                // Break after we get a complete response
                if (lastChunk.includes('2 + 2 = 4')) break
            }
            
            // If we got here the API call was successful
            expect(chunks.length).toBeGreaterThan(0)
            expect(chunks[0]).toHaveProperty('type')
            
            // Get the final complete response
            const finalChunk = chunks[chunks.length - 1]
            console.log('\nFinal API Response:', finalChunk.text)
            
            // Verify we're using the correct model
            const model = handler.getModel()
            console.log('\nUsing Model:', model.id)
            expect(model.id).toBe('gemini-1.5-flash')
            
            if (chunks[0].type === 'text') {
                expect(typeof chunks[0].text).toBe('string')
            }
        } catch (error) {
            // Use expect().toBeFalsy() to fail the test with a message
            expect(`API call failed: ${error}`).toBeFalsy()
        }
    }, 10000) // Set timeout to 10 seconds
})

describe('End-to-end flow', () => {
    test('handles complete flow from UI to API', async () => {
        // Create a minimal webview to capture messages
        const messages: any[] = []
        const webviewView = {
            webview: {
                postMessage: (msg: any) => {
                    messages.push(msg)
                    return Promise.resolve()
                },
                onDidReceiveMessage: (handler: (msg: any) => void) => {
                    // Store handler for test to use
                    webviewView.messageHandler = handler
                    return { dispose: () => {} }
                },
                options: {},
                html: '',
                asWebviewUri: (uri: any) => uri
            },
            messageHandler: null as any,
            visible: true,
            onDidDispose: () => ({ dispose: () => {} }),
            onDidChangeVisibility: () => ({ dispose: () => {} })
        }

        // Create provider with minimal context
        const provider = new ClineProvider({
            extensionPath: '/test/path',
            extensionUri: {} as any,
            globalState: {
                get: () => null,
                update: () => Promise.resolve()
            },
            secrets: {
                get: (key: string) => {
                    if (key === 'codyApiKey') {
                        return Promise.resolve('sgp_fd1b4edb60bf82b8_d06b623e60b7c41e848d559be489a5e4628c0888')
                    }
                    return Promise.resolve(null)
                },
                store: () => Promise.resolve(),
                delete: () => Promise.resolve()
            },
            subscriptions: []
        } as any, {
            appendLine: () => {},
            dispose: () => {}
        } as any)

        provider.resolveWebviewView(webviewView as any)

        // Simulate user sending a message
        await webviewView.messageHandler({
            type: 'newTask',
            text: 'What is 2+2?',
            images: []
        })

        // Wait for API response
        await new Promise(resolve => setTimeout(resolve, 5000))

        // Verify message sequence
        const stateMessages = messages
            .filter(msg => msg.type === 'state')
            .map(msg => msg.state.clineMessages)
            .flat()

        // Initial user message
        expect(stateMessages).toContainEqual(
            expect.objectContaining({
                type: 'say',
                say: 'text',
                text: 'What is 2+2?'
            })
        )

        // API request started
        expect(stateMessages).toContainEqual(
            expect.objectContaining({
                type: 'say',
                say: 'api_req_started'
            })
        )

        // API response containing "4"
        const responseMessage = stateMessages.find(msg => 
            msg.type === 'say' && 
            msg.say === 'text' && 
            msg.text?.includes('4')
        )
        expect(responseMessage).toBeDefined()
    }, 10000)
})