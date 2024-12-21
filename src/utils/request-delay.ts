import * as vscode from 'vscode';
import delay from 'delay';
import { ApiConfiguration } from '../shared/api';

export async function getRequestDelay(apiConfig?: ApiConfiguration): Promise<number> {
    // First check API configuration
    if (apiConfig?.requestDelay !== undefined) {
        return apiConfig.requestDelay * 1000; // Convert to milliseconds
    }

    // Then check VS Code settings
    const config = vscode.workspace.getConfiguration('cline');
    const delaySeconds = config.get<number>('requestDelay') ?? 5;
    return delaySeconds * 1000; // Convert to milliseconds
}

export async function waitRequestDelay(apiConfig?: ApiConfiguration): Promise<void> {
    const delayMs = await getRequestDelay(apiConfig);
    if (delayMs > 0) {
        await delay(delayMs);
    }
}
