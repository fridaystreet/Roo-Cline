import { Anthropic } from "@anthropic-ai/sdk";
import { ApiHandler } from "..";
import { ApiConfiguration, ModelInfo } from "../../shared/api";
import { ApiStream } from "../transform/stream";
import { waitRequestDelay } from "../../utils/request-delay";

export class DelayDecorator implements ApiHandler {
    private config: ApiConfiguration;

    constructor(private handler: ApiHandler, config: ApiConfiguration) {
        this.config = config;
    }

    async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
        // Add delay before making the request
        await waitRequestDelay(this.config);
        
        // Forward the request to the actual handler
        yield* this.handler.createMessage(systemPrompt, messages);
    }

    getModel(): { id: string; info: ModelInfo } {
        return this.handler.getModel();
    }
}
