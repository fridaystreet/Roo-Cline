import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Checkbox } from "vscrui"

import type { ProviderSettings, OrganizationAllowList } from "@roo-code/types"
import { geminiDefaultModelId } from "@roo-code/types"

import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { useAppTranslation } from "@src/i18n/TranslationContext"

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

			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={geminiDefaultModelId}
				models={MODELS_BY_PROVIDER["gemini-cli"] ?? {}}
				modelIdKey="geminiCliModelId"
				serviceName="Google Gemini CLI"
				serviceUrl="https://ai.google.dev/gemini-api/docs/models"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
			/>

			{/* Advanced CLI Options */}
			<div className="mt-6">
				<div className="text-sm font-medium mb-3">Advanced CLI Options</div>
				<div className="text-xs text-vscode-descriptionForeground mb-4">
					These options control advanced features of the Gemini CLI. Most users should leave these disabled.
				</div>

				<div className="space-y-3">
					<Checkbox
						checked={!!apiConfiguration?.geminiCliAllFiles}
						onChange={(checked: boolean) => {
							setApiConfigurationField("geminiCliAllFiles", checked)
						}}>
						<div>
							<div className="font-medium">Include All Files (--all-files)</div>
							<div className="text-xs text-vscode-descriptionForeground">
								Automatically include all project files in the context. Use with caution for large
								projects.
							</div>
						</div>
					</Checkbox>

					<Checkbox
						checked={apiConfiguration?.geminiCliCheckpointing !== false}
						onChange={(checked: boolean) => {
							setApiConfigurationField("geminiCliCheckpointing", checked)
						}}>
						<div>
							<div className="font-medium">Enable Checkpointing (--checkpointing) [Default: ON]</div>
							<div className="text-xs text-vscode-descriptionForeground">
								Enable CLI-level checkpointing for better file edit tracking.
							</div>
						</div>
					</Checkbox>

					<Checkbox
						checked={!!apiConfiguration?.geminiCliExperimentalAcp}
						onChange={(checked: boolean) => {
							setApiConfigurationField("geminiCliExperimentalAcp", checked)
						}}>
						<div>
							<div className="font-medium">
								Experimental Agent Mode (--experimental-acp) [Default: OFF]
							</div>
							<div className="text-xs text-vscode-descriptionForeground">
								Enable Agent Control Protocol for multi-file AI programming. May conflict with
								Roo-Code&apos;s session management.
							</div>
						</div>
					</Checkbox>

					<Checkbox
						checked={apiConfiguration?.geminiCliIdeMode !== false}
						onChange={(checked: boolean) => {
							setApiConfigurationField("geminiCliIdeMode", checked)
						}}>
						<div>
							<div className="font-medium">IDE Mode (--ide-mode) [Default: ON]</div>
							<div className="text-xs text-vscode-descriptionForeground">
								Enable IDE-specific enhancements for better VS Code integration.
							</div>
						</div>
					</Checkbox>

					<div className="space-y-2">
						<div className="flex items-center space-x-2">
							<span className="text-sm font-medium text-light-text dark:text-dark-text">
								MCP Server Integration
							</span>
							<span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
								Automatic
							</span>
						</div>
						<p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
							Enabled MCP servers are automatically detected and passed to the Gemini CLI. No manual
							configuration required.
						</p>
					</div>
				</div>
			</div>
		</>
	)
}
