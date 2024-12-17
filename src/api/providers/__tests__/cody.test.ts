/**
 * @jest-environment node
 */

import { CodyHandler } from '../cody'
import { ApiHandlerOptions } from '../../../shared/api'
import { Anthropic } from '@anthropic-ai/sdk'
import fetch from 'node-fetch'
import { Response } from 'node-fetch'

jest.mock('node-fetch', () => jest.fn())
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('CodyHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    // This test requires a valid Cody API key to be set in the environment
    // It tests the actual API functionality, not mocked responses
    test('createMessage handles successful API response', async () => {
        // Mock a successful response
        const mockResponseBody = {
            [Symbol.asyncIterator]: async function* () {
                yield Buffer.from('data: {"id":"123","completion":"2 + 2 = 4"}\n\n')
                yield Buffer.from('data: [DONE]\n\n')
            }
        }
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            body: mockResponseBody
        } as any)

        const options: ApiHandlerOptions = {
            codyApiKey: 'test-key',
            codyModelId: 'gemini-1.5-flash',
            apiModelId: 'gemini-1.5-flash'
        }

        const handler = new CodyHandler(options)
        const systemPrompt = 'You are a helpful assistant.'
        const messages: Anthropic.Messages.MessageParam[] = [
            { role: 'user', content: '2+2' }
        ]

        const generator = handler.createMessage(systemPrompt, messages)
        const chunks = []
        
        for await (const chunk of generator) {
            chunks.push(chunk)
        }

        const textChunks = chunks.filter(chunk => chunk.type === 'text')
        expect(textChunks.length).toBeGreaterThan(0)
        expect(textChunks[0].type).toBe('text')
        expect(textChunks[0].text).toBe('2 + 2 = 4')
    })

    test('createMessage reproduces empty response error', async () => {
        // Mock a response that doesn't include any completion
        const mockResponseBody = {
            [Symbol.asyncIterator]: async function* () {
                yield Buffer.from('data: {"id":"123"}\n\n')
                yield Buffer.from('data: [DONE]\n\n')
            }
        }
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            body: mockResponseBody
        } as any)

        const options: ApiHandlerOptions = {
            codyApiKey: 'test-key',
            codyModelId: 'gemini-1.5-flash',
            apiModelId: 'gemini-1.5-flash'
        }

        const handler = new CodyHandler(options)
        const systemPrompt = 'You are a helpful assistant.'
        const messages: Anthropic.Messages.MessageParam[] = [
            { role: 'user', content: '2+2' }
        ]

        const generator = handler.createMessage(systemPrompt, messages)
        const chunks = []
        
        // Log the request details
        console.log('Request URL:', handler['instanceUrl'])
        console.log('Request Headers:', handler['getHeaders']())
        
        for await (const chunk of generator) {
            console.log('Received chunk:', chunk)
            chunks.push(chunk)
        }

        // Log all chunks for analysis
        console.log('Total chunks:', chunks.length)
        chunks.forEach((chunk, i) => {
            console.log(`Chunk ${i}:`, chunk)
        })

        const textChunks = chunks.filter(chunk => chunk.type === 'text')
        console.log('Text chunks:', textChunks)

        // We expect one text chunk with empty text since the response didn't include a completion
        expect(textChunks.length).toBe(1)
        expect(textChunks[0].type).toBe('text')
        expect(textChunks[0].text).toBe('')
    })
})