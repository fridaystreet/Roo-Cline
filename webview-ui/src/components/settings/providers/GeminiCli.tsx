import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"

type GeminiCliProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const GeminiCli = ({ apiConfiguration, setApiConfigurationField }: GeminiCliProps) => {
	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.geminiCliProjectId || ""}
				type="text"
				onInput={handleInputChange("geminiCliProjectId")}
				placeholder="your-google-cloud-project-id"
				className="w-full">
				<label className="block font-medium mb-1">Google Cloud Project ID</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				Required for Google Cloud project access. Find your project ID in the Google Cloud Console.
			</div>

			<div className="mt-4 p-3 bg-vscode-textBlockQuote-background border-l-4 border-vscode-textBlockQuote-border">
				<div className="text-sm font-medium mb-2">Authentication</div>
				<div className="text-sm text-vscode-descriptionForeground">
					The Gemini CLI uses Google OAuth authentication. When you send your first message, Roo Code will
					automatically open your browser to complete the Google login process. Your credentials will be saved
					for future use.
				</div>
			</div>

			<div className="mt-3">
				<VSCodeButtonLink
					href="https://console.cloud.google.com/projectselector2/home/dashboard"
					appearance="secondary">
					Open Google Cloud Console
				</VSCodeButtonLink>
			</div>
		</>
	)
}
