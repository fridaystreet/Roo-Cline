/**
 * @jest-environment node
 */

import { CodyHandler } from '../cody'
import { ApiHandlerOptions } from '../../../shared/api'
import { Anthropic } from '@anthropic-ai/sdk'

describe('CodyHandler', () => {
    // This test requires a valid Cody API key to be set in the environment
    // It tests the actual API functionality, not mocked responses
    test('createMessage makes successful API call with specified model', async () => {
        const options: ApiHandlerOptions = {
            codyApiKey: process.env.CODY_API_KEY, // This should be set in the test environment
            codyModelId: 'gemini-1.5-flash', // Override default model
            apiModelId: 'gemini-1.5-flash' // Required because getModel() checks this
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
            
            // If we got here, the API call was successful
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