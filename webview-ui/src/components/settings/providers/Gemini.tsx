import { useCallback, useState } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"

type GeminiProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Gemini = ({ apiConfiguration, setApiConfigurationField }: GeminiProps) => {
	const { t } = useAppTranslation()

	const [googleGeminiBaseUrlSelected, setGoogleGeminiBaseUrlSelected] = useState(
		!!apiConfiguration?.googleGeminiBaseUrl,
	)

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
			<div>
				<Checkbox
					checked={!!apiConfiguration?.geminiUseCodeAssist}
					onChange={(checked: boolean) => {
						setApiConfigurationField("geminiUseCodeAssist", checked)
						// Clear API key when switching to Code Assist
						if (checked) {
							setApiConfigurationField("geminiApiKey", "")
						}
					}}>
					Use Code Assist login
				</Checkbox>
				{apiConfiguration?.geminiUseCodeAssist && (
					<>
						<VSCodeTextField
							value={apiConfiguration?.geminiCodeAssistProjectId || ""}
							type="text"
							onInput={handleInputChange("geminiCodeAssistProjectId")}
							placeholder="Google Cloud Project ID"
							className="w-full mt-1">
							<label className="block font-medium mb-1">Code Assist Project ID</label>
						</VSCodeTextField>
						<div className="mt-4 p-3 bg-vscode-textBlockQuote-background border-l-4 border-vscode-textBlockQuote-border">
							<div className="text-sm font-medium mb-2">Authentication</div>
							<div className="text-sm text-vscode-descriptionForeground mb-3">
								The Gemini CLI uses Google OAuth authentication. When you send your first message, Roo
								Code will automatically open your browser to complete the Google login process. Your
								credentials will be saved for future use.
								<br />
								If the browser doesn&apos;t open automatically, run{" "}
								<code>npx https://github.com/google-gemini/gemini-cli</code> in your terminal and select
								option 1 to login.
							</div>
							<div className="text-sm font-medium mb-2">Pricing</div>
							<div className="text-sm text-vscode-descriptionForeground mb-3">
								Model pricing shown below the model selection does not apply to CodeAssist. CodeAssist
								pricing is based on the number of tokens used. You can find the pricing details{" "}
								<a href="https://cloud.google.com/gemini/pricing">here</a>.
							</div>
						</div>
					</>
				)}
			</div>
			{!apiConfiguration?.geminiUseCodeAssist && (
				<>
					<VSCodeTextField
						value={apiConfiguration?.geminiApiKey || ""}
						type="password"
						onInput={handleInputChange("geminiApiKey")}
						placeholder={t("settings:placeholders.apiKey")}
						className="w-full">
						<label className="block font-medium mb-1">{t("settings:providers.geminiApiKey")}</label>
					</VSCodeTextField>
					<div className="text-sm text-vscode-descriptionForeground -mt-2">
						{t("settings:providers.apiKeyStorageNotice")}
					</div>
					{!apiConfiguration?.geminiApiKey && (
						<VSCodeButtonLink href="https://ai.google.dev/" appearance="secondary">
							{t("settings:providers.getGeminiApiKey")}
						</VSCodeButtonLink>
					)}
				</>
			)}
			{/* Only show custom base URL when NOT using Code Assist */}
			{!apiConfiguration?.geminiUseCodeAssist && (
				<div>
					<Checkbox
						checked={googleGeminiBaseUrlSelected}
						onChange={(checked: boolean) => {
							setGoogleGeminiBaseUrlSelected(checked)

							if (!checked) {
								setApiConfigurationField("googleGeminiBaseUrl", "")
							}
						}}>
						{t("settings:providers.useCustomBaseUrl")}
					</Checkbox>
					{googleGeminiBaseUrlSelected && (
						<VSCodeTextField
							value={apiConfiguration?.googleGeminiBaseUrl || ""}
							type="url"
							onInput={handleInputChange("googleGeminiBaseUrl")}
							placeholder={t("settings:defaults.geminiUrl")}
							className="w-full mt-1"
						/>
					)}
				</div>
			)}
		</>
	)
}
