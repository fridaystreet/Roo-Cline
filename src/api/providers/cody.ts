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

  private sanitizeMessages(messages: Anthropic.Messages.MessageParam []) {
    return messages.map(msg => ({
      text: msg.content,
      speaker: msg.role === 'assistant' ? 'assistant' : 'human'
    }));
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
    const requestBody = {
      messages: [{ role: "system", content: systemPrompt }, ...this.sanitizeMessages(messages)],
      ...DEFAULT_CHAT_PARAMETERS,
      temperature: DEFAULT_CHAT_PARAMETERS.temperature,
      topP: DEFAULT_CHAT_PARAMETERS.topP,
      maxTokensToSample: DEFAULT_CHAT_PARAMETERS.maxTokensToSample,
      model,
      stream: true,
    };

    // Log the request details in test environment
    if (process.env.NODE_ENV === 'test') {
      console.log('\nSending request with model:', model);
      console.log('Request body:', JSON.stringify(requestBody, null, 2));
    }

    const body = JSON.stringify(requestBody);
    const headers = this.getHeaders()

    try {
      // Use node-fetch directly
      const response = await fetch(this.instanceUrl, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      // Read the response as a stream of text
      for await (const chunk of response.body) {
        const text = chunk.toString();
        const lines = text.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line === 'data: [DONE]') {
            return;
          }

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as CodyResponse;
              yield {
                type: 'text' as const,
                text: data.completion || ''
              };
            } catch (error) {
              console.error('Error parsing SSE message:', error);
              throw error;
            }
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
