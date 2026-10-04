import { demoProvider } from './demoProvider.js';
import { googleProvider, ollamaProvider, ProviderError } from './providers.js';

export { ProviderError, demoProvider };

export const MODEL_DEFAULTS = {
  provider: 'ollama',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'gemma4:e4b',
  googleModel: 'gemma-4-26b-a4b-it',
  googleKey: '',
};

export function createProvider(settings, fetchImpl) {
  if (settings.provider === 'google') return googleProvider({ apiKey: settings.googleKey, model: settings.googleModel, fallbackModel: settings.googleModel === 'gemma-4-31b-it' ? 'gemma-4-26b-a4b-it' : undefined }, fetchImpl);
  if (settings.provider === 'demo') return demoProvider;
  return ollamaProvider({ baseUrl: settings.ollamaUrl, model: settings.ollamaModel }, fetchImpl);
}