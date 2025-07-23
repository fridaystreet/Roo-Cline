import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings, OrganizationAllowList } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"
import { MODELS_BY_PROVIDER } from "../constants"

type GeminiCliProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
}

export const GeminiCli = ({
	apiConfiguration,
	setApiConfigurationField,
	organizationAllowList,
	modelValidationError,
}: GeminiCliProps) => {
	const { t: _t } = useAppTranslation()
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
				<div className="text-sm text-vscode-descriptionForeground mb-3">
					The Gemini CLI uses Google OAuth authentication. When you send your first message, Roo Code will
					automatically open your browser to complete the Google login process. Your credentials will be saved
					for future use.
				</div>
				<div className="text-sm text-vscode-descriptionForeground">
					If your browser doesn&apos;t open automatically, click the button below to run the CLI setup command
					in your terminal and manually login using option 1.
				</div>
			</div>

			<div className="mt-3">
				<VSCodeButtonLink
					href="https://console.cloud.google.com/projectselector2/home/dashboard"
					appearance="secondary">
					Open Google Web Console
				</VSCodeButtonLink>
			</div>
			<div className="mt-2 text-xs text-vscode-descriptionForeground">
				If the browser doesn&apos;t open automatically, run{" "}
				<code>npx https://github.com/google-gemini/gemini-cli</code> in your terminal and select option 1 to
				login.
			</div>

			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId="gemini-2.5-pro"
				models={MODELS_BY_PROVIDER["gemini-cli"] ?? {}}
				modelIdKey="geminiCliModelId"
				serviceName="Google Code Assist"
				serviceUrl="https://developers.google.com/gemini-code-assist/resources/quotas"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
			/>

			{/* CLI Options */}
			<div className="mt-4 p-3 border border-vscode-textBlockQuote-border rounded">
				<div className="text-sm font-medium mb-3">CLI Options</div>
				<div className="space-y-3">
					<label className="flex items-start space-x-2">
						<input
							type="checkbox"
							checked={!!apiConfiguration?.geminiCliAllFiles}
							onChange={(e) => setApiConfigurationField("geminiCliAllFiles", e.target.checked)}
							className="rounded mt-0.5"
						/>
						<div>
							<div className="text-sm font-medium">Include All Files (--all-files)</div>
							<div className="text-xs text-vscode-descriptionForeground">
								Automatically include all project files in the context. Use with caution for large
								projects. This can be useful when trying to do project wide analysis or documentation.
							</div>
						</div>
					</label>
					<label className="flex items-start space-x-2">
						<input
							type="checkbox"
							checked={apiConfiguration?.geminiCliCheckpointing ?? true}
							onChange={(e) => setApiConfigurationField("geminiCliCheckpointing", e.target.checked)}
							className="rounded mt-0.5"
						/>
						<div>
							<div className="text-sm font-medium">
								Enable Checkpointing (--checkpointing) [Default: ON]
							</div>
							<div className="text-xs text-vscode-descriptionForeground">
								Enable CLI-level checkpointing for better file edit tracking.
							</div>
						</div>
					</label>
					<label className="flex items-start space-x-2">
						<input
							type="checkbox"
							checked={!!apiConfiguration?.geminiCliExperimentalAcp}
							onChange={(e) => setApiConfigurationField("geminiCliExperimentalAcp", e.target.checked)}
							className="rounded mt-0.5"
						/>
						<div>
							<div className="text-sm font-medium">
								Experimental ACP Mode (--experimental-acp) [Default: OFF]
							</div>
							<div className="text-xs text-vscode-descriptionForeground">
								Enable Agent Control Protocol for multi-file AI programming. May conflict with
								Roo-Code&apos;s session management.
							</div>
						</div>
					</label>
					<label className="flex items-start space-x-2">
						<input
							type="checkbox"
							checked={apiConfiguration?.geminiCliIdeMode ?? true}
							onChange={(e) => setApiConfigurationField("geminiCliIdeMode", e.target.checked)}
							className="rounded mt-0.5"
						/>
						<div>
							<div className="text-sm font-medium">IDE Mode (--ide-mode) [Default: ON]</div>
							<div className="text-xs text-vscode-descriptionForeground">
								Enable IDE-specific enhancements for better VS Code integration.
							</div>
						</div>
					</label>
					<label className="flex items-start space-x-2">
						<input
							type="checkbox"
							checked={!!apiConfiguration?.geminiCliDebug}
							onChange={(e) => setApiConfigurationField("geminiCliDebug", e.target.checked)}
							className="rounded mt-0.5"
						/>
						<div>
							<div className="text-sm font-medium">Debug (--debug)</div>
							<div className="text-xs text-vscode-descriptionForeground">
								Enable debug logging for the Gemini CLI. This can be useful for debugging issues with
								the Gemini CLI. Help ~ Toggle Developer Tools in VSCode to view debug logs.
							</div>
						</div>
					</label>
					<div className="space-y-1">
						<div className="flex items-center space-x-2">
							<span className="text-sm font-medium">MCP Server Integration</span>
							<span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
								Automatic
							</span>
						</div>
						<p className="text-xs text-vscode-descriptionForeground">
							Enabled MCP servers are automatically detected and passed to the Gemini CLI. No manual
							configuration required.
						</p>
					</div>
				</div>
			</div>
		</>
	)
}
