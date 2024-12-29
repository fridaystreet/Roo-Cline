import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';

export const generateProofreadErrors = async (input: string) => {
	const headersList = {
		Accept: 'application/json',
		'Content-Type': 'application/x-www-form-urlencoded'
	};

	// Format the data for LanguageTool's API
	const bodyContent = new URLSearchParams({
		language: 'en-US',
		text: input
	}).toString();

	const reqOptions = {
		url: 'https://api.languagetool.org/v2/check',
		method: 'POST',
		headers: headersList,
		data: bodyContent
	} as AxiosRequestConfig;

	try {
		const response: AxiosResponse = await axios.request(reqOptions);
		return response.data;
	} catch (error) {
		console.error('Error:', error);
		throw error;
	}
}