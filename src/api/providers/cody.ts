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


export interface ChatCompletionRequest {
	model: string
	messages: {
		role: "system" | "user" | "assistant"
		content: string
	}[]
	temperature?: number
	top_p?: number
	n?: number
	maxTokensToSample?: number
	stop?: string | string[]
	stream?: boolean
	presence_penalty?: number
	frequency_penalty?: number
	logit_bias?: Record<string, number>
}

export interface ChatCompletionResponse {
	id: string
	object: string
	created: number
	model: string
	choices: {
		index: number
		message: {
			role: string
			content: string
		}
		finish_reason: string
	}[]
	usage?: {
		prompt_tokens: number
		completion_tokens: number
		total_tokens: number
	}
}

export interface ChatCompletionResponseChunk {
	id: string
	object: string
	created: number
	model: string
	choices: {
		delta: {
			role?: string
			content?: string
		}
		index: number
		finish_reason: string | null
	}[]
}

export interface ErrorResponse {
	error: {
		message: string
		type: string
		param?: string
		code?: string
	}
}

export class CodyHandler implements ApiHandler {
  private options: ApiHandlerOptions;
  private instanceUrl: URL;
  private model: string;

  constructor(options: ApiHandlerOptions) {
    this.options = options;
    this.instanceUrl = new URL("https://sourcegraph.com/.api/completions/stream?api-version=1");
    this.model = options.codyModelId || "claude-3-5-sonnet-20241022"; // Default to Claude 3.5 Sonnet
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
      Authorization: `token ${this.options.apiKey}`,
      "Accept-Encoding": "gzip;q=0", // Disable gzip compression to prevent response batching
      "X-Sourcegraph-Client": "cody",
    };
  }

  // async callChat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {

  //   const body = JSON.stringify({
  //     messages: this.sanitizeMessages(request.messages),
  //     ...DEFAULT_CHAT_PARAMETERS,
  //     temperature: request.temperature ?? DEFAULT_CHAT_PARAMETERS.temperature,
  //     topP: request.top_p ?? DEFAULT_CHAT_PARAMETERS.topP,
  //     maxTokensToSample: request.maxTokensToSample ?? DEFAULT_CHAT_PARAMETERS.maxTokensToSample,
  //     model: this.model,
  //     stream: false,
  //   });

  //   try {
  //     const response = await fetch(this.instanceUrl.toString(), {
  //       method: "POST",
  //       headers: this.getHeaders(),
  //       body,
  //     });

  //     if (!response.ok) {
  //       const error = await response.text();
  //       throw new Error(`HTTP error! status: ${response.status}, body: ${error}`);
  //     }

  //     const data = await response.json() as CodyResponse;
  //     return {
  //       id: data.id || 'unknown',
  //       object: 'chat.completion',
  //       created: Date.now(),
  //       model: this.model,
  //       choices: [{
  //         index: 0,
  //         message: {
  //           role: 'assistant',
  //           content: data.completion || '',
  //         },
  //         finish_reason: data.stop_reason || 'stop'
  //       }],
  //       usage: {
  //         prompt_tokens: 0,
  //         completion_tokens: 0,
  //         total_tokens: 0
  //       }
  //     };
  //   } catch (error: any) {
  //     console.error("Error calling Cody API:", error);
  //     throw error;
  //   }
  // }

  // async *callChatStream(request: ChatCompletionRequest): AsyncGenerator<ChatCompletionResponseChunk, void, unknown> {
  //   const url = new URL(`https://sourcegraph.com/.api/completions/stream?api-version=1`);
    
  //   const headers = {
  //     "Content-Type": "application/json; charset=utf-8",
  //     Authorization: `token ${this.options.apiKey}`,
  //     "Accept-Encoding": "gzip;q=0", // Disable gzip compression to prevent response batching
  //     "X-Sourcegraph-Client": "cody",
  //   };

  //   const body = JSON.stringify({
  //     messages: this.sanitizeMessages(request.messages),
  //     ...DEFAULT_CHAT_PARAMETERS,
  //     temperature: request.temperature ?? DEFAULT_CHAT_PARAMETERS.temperature,
  //     topP: request.top_p ?? DEFAULT_CHAT_PARAMETERS.topP,
  //     maxTokensToSample: request.maxTokensToSample ?? DEFAULT_CHAT_PARAMETERS.maxTokensToSample,
  //     model: this.model,
  //     stream: true,
  //   });

  //   try {
  //     await fetchEventSource(this.instanceUrl.toString(), {
  //       method: 'POST',
  //       headers: this.getHeaders(),
  //       body,
  //       async onopen(response: Response) {
  //         if (!response.ok && response.headers.get('content-type') !== 'text/event-stream') {
  //           let errorMessage = await response.text();
  //           if (!errorMessage) {
  //             errorMessage = `Request failed with status code ${response.status}`;
  //           }
  //           throw new Error(errorMessage);
  //         }
  //       },
  //       onmessage: (event: { data: string }) => {
  //         if (event.data === '[DONE]') {
  //           return;
  //         }
  //         try {
  //           const data = JSON.parse(event.data) as CodyResponse;
  //           const chunk: ChatCompletionResponseChunk = {
  //             id: data.id || 'unknown',
  //             object: 'chat.completion.chunk',
  //             created: Date.now(),
  //             model: request.model,
  //             choices: [{
  //               delta: {
  //                 role: 'assistant',
  //                 content: data.completion || '',
  //               },
  //               index: 0,
  //               finish_reason: data.stop_reason || null
  //             }]
  //           };
  //           return chunk;
  //         } catch (error) {
  //           console.error('Error parsing SSE message:', error);
  //           throw error;
  //         }
  //       },
  //       onerror(error: Error) {
  //         console.error('Error in SSE connection:', error);
  //         throw error;
  //       },
  //     });
  //   } catch (error) {
  //     console.error('Error in streaming connection:', error);
  //     throw error;
  //   }
  // }

  async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
    const body = JSON.stringify({
      messages: this.sanitizeMessages(messages, systemPrompt),
      ...DEFAULT_CHAT_PARAMETERS,
      temperature: DEFAULT_CHAT_PARAMETERS.temperature,
      topP: DEFAULT_CHAT_PARAMETERS.topP,
      maxTokensToSample: DEFAULT_CHAT_PARAMETERS.maxTokensToSample,
      model: this.getModel().id,
      stream: true,
    });

    try {
      await fetchEventSource(this.instanceUrl.toString(), {
        method: 'POST',
        headers: this.getHeaders(),
        body,
        async onopen(response: Response) {
          if (!response.ok && response.headers.get('content-type') !== 'text/event-stream') {
            let errorMessage = await response.text();
            if (!errorMessage) {
              errorMessage = `Request failed with status code ${response.status}`;
            }
            throw new Error(errorMessage);
          }
        },
        onmessage: (event: { data: string }) => {
          if (event.data === '[DONE]') {
            return;
          }
          try {
            const data = JSON.parse(event.data) as CodyResponse;
            const chunk: ChatCompletionResponseChunk = {
              id: data.id || 'unknown',
              object: 'chat.completion.chunk',
              created: Date.now(),
              model: this.getModel().id,
              choices: [{
                delta: {
                  role: 'assistant',
                  content: data.completion || '',
                },
                index: 0,
                finish_reason: data.stop_reason || null
              }]
            };
            return chunk;
          } catch (error) {
            console.error('Error parsing SSE message:', error);
            throw error;
          }
        },
        onerror(error: Error) {
          console.error('Error in SSE connection:', error);
          throw error;
        },
      });
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
