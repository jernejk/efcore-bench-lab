// API Configuration
export const config = {
  webApiUrl: process.env.NEXT_PUBLIC_WEBAPI_URL || 'http://localhost:5847',
  lmStudioUrl: process.env.NEXT_PUBLIC_LMSTUDIO_URL || 'http://localhost:1234',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  azureOpenAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
  azureOpenAiApiKey: process.env.AZURE_OPENAI_API_KEY || '',
  azureOpenAiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT || '',
};

export type AIProvider = 'lmstudio' | 'openai' | 'azure-openai';

export interface Settings {
  aiProvider: AIProvider;
  lmStudioAutoControl: boolean;
  lmStudioModel: string;
  openAiModel: string;
  webApiUrl: string;
}

export const defaultSettings: Settings = {
  aiProvider: 'lmstudio',
  lmStudioAutoControl: true,
  lmStudioModel: '',
  openAiModel: 'gpt-4o',
  webApiUrl: config.webApiUrl,
};

