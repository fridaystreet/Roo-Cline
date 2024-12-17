/**
 * @jest-environment node
 */

import { CodyHandler } from '../cody'
import { ApiHandlerOptions } from '../../../shared/api'
import { Anthropic } from '@anthropic-ai/sdk'

describe('CodyHandler', () => {
    // This test requires a valid Cody API key to be set in the environment
    // It tests the actual API functionality, not mocked responses
    test('createMessage makes successful API call', async () => {
        const options: ApiHandlerOptions = {
            codyApiKey: process.env.CODY_API_KEY // This should be set in the test environment
        }

        const handler = new CodyHandler(options)
        const systemPrompt = 'You are a helpful assistant.'
        const messages: Anthropic.Messages.MessageParam[] = [
            { role: 'user', content: "what's 2+2?" }
        ]

        const generator = handler.createMessage(systemPrompt, messages)
        const chunks = []
        let fullResponse = ''
        
        try {
            // Collect first 5 chunks to see more of the response
            let chunkCount = 0
            for await (const chunk of generator) {
                chunks.push(chunk)
                console.log('Received chunk from API:', chunk)
                
                if (chunk.type === 'text') {
                    fullResponse += chunk.text
                }
                
                chunkCount++
                if (chunkCount >= 5) break // Get first 5 chunks
            }
            
            // If we got here, the API call was successful
            expect(chunks.length).toBeGreaterThan(0)
            expect(chunks[0]).toHaveProperty('type')
            
            console.log('\nFull API Response (first 5 chunks):', fullResponse)
            
            if (chunks[0].type === 'text') {
                expect(typeof chunks[0].text).toBe('string')
            }
        } catch (error) {
            // Use expect().toBeFalsy() to fail the test with a message
            expect(`API call failed: ${error}`).toBeFalsy()
        }
    }, 10000) // Set timeout to 10 seconds
})