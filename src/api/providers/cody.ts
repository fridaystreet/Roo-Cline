import { Anthropic } from "@anthropic-ai/sdk"
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { ApiHandler } from "../"
import {
	ApiHandlerOptions,
	ModelInfo,
	codyDefaultModelId,
	CodyModelId,
	codyModels,
} from "../../shared/api"
import { ApiStream } from "../transform/stream"
import fetch from 'node-fetch'

const DEFAULT_CHAT_PARAMETERS = {
  temperature: 0.2,
  topK: -1,
  topP: -1,
  maxTokensToSample: 1000,
};

interface CodyResponse {
  id?: string;
  completion?: string;
  stop_reason?: string;
}

export class CodyHandler implements ApiHandler {
  private options: ApiHandlerOptions;
  private instanceUrl: string;

  constructor(options: ApiHandlerOptions) {
    this.options = options;
    this.instanceUrl = "https://sourcegraph.com/.api/completions/stream?api-version=1";
  }

  private sanitizeMessages(messages: Anthropic.Messages.MessageParam[]) {
    return messages.map(msg => {
      // Handle both string and array content
      const content = Array.isArray(msg.content)
        ? msg.content.map(block => block.type === 'text' ? block.text : '').join('\n')
        : msg.content;

      return {
        role: msg.role,
        content: content
      };
    });
  }

  private getHeaders() {
    return {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `token ${this.options.codyApiKey}`,
      "Accept-Encoding": "gzip;q=0", // Disable gzip compression to prevent response batching
      "Accept": "text/event-stream"
    };
  }

  async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
    const model = this.getModel().id;
    // Format messages according to Cody API expectations
    const sanitizedMessages = this.sanitizeMessages(messages);
    const requestBody = {
      messages: [
        { role: "system", content: systemPrompt },
        ...sanitizedMessages
      ],
      temperature: DEFAULT_CHAT_PARAMETERS.temperature,
      topK: DEFAULT_CHAT_PARAMETERS.topK,
      topP: DEFAULT_CHAT_PARAMETERS.topP,
      maxTokensToSample: DEFAULT_CHAT_PARAMETERS.maxTokensToSample,
      model,
      stream: true
    };

    // Log the request details
    if (process.env.NODE_ENV === 'test') {
      console.log('\nSending request with model:', model);
      console.log('Request body:', JSON.stringify(requestBody, null, 2));
    }

    const body = JSON.stringify(requestBody);
    const headers = this.getHeaders()

    console.log('Sending request to Cody API:');
    console.log('URL:', this.instanceUrl);
    console.log('Headers:', headers);
    console.log('Body:', body);

    try {
      // Use node-fetch directly
      const response = await fetch(this.instanceUrl, {
        method: 'POST',
        headers,
        body,
      });

      console.log('Cody API Response Status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Cody API Error Response:', errorText);
        throw new Error(`Cody API HTTP error! Status: ${response.status}, Body: ${errorText}`);
      }

      if (!response.body) {
        console.error('No response body received from Cody API');
        throw new Error('No response body received from Cody API');
      }

      console.log('Starting to process Cody API response stream');

      console.log('Cody API Response Headers:', response.headers);
      
      // Read the response as a stream of text
      for await (const chunk of response.body) {
        const text = chunk.toString();
        console.log('Raw chunk:', text);
        
        const lines = text.split('\n').filter(line => line.trim());
        console.log('Parsed lines:', lines);

        for (const line of lines) {
          console.log('Processing line:', line);
          console.log('Processing line:', line);
          
          if (line === 'data: [DONE]') {
            console.log('Received stream end marker');
            return;
          }

          if (!line.startsWith('data: ')) {
            console.log('Skipping non-data line:', line);
            continue;
          }

          try {
            const jsonStr = line.slice(6);
            if (!jsonStr) {
              console.error('Empty JSON data');
              continue;
            }

            const data = JSON.parse(jsonStr) as CodyResponse;
            if (!data) {
              console.error('Failed to parse response data');
              continue;
            }

            console.log('Parsed response data:', data);

            // Only yield text chunks when we have actual completion content
            if (data.completion) {
              console.log('Yielding completion:', data.completion);
              yield {
                type: 'text' as const,
                text: data.completion
              };
            } else {
              console.log('Skipping response without completion:', data);
            }
          } catch (error) {
            console.error('Error processing line:', error, '\nLine:', line);
            throw new Error(`Failed to process Cody response: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.error('Error in streaming connection:', error);
      throw error;
    }
  }

  getModel(): { id: CodyModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in codyModels) {
			const id = modelId as CodyModelId
			return { id, info: codyModels[id] }
		}
		return { id: codyDefaultModelId, info: codyModels[codyDefaultModelId] }
	}
}
