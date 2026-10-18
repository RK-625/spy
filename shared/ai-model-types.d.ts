/**
 * We select models through provider SDK factories and validate IDs in shared/models.
 * Register the BYOK ID domain instead of expanding the SDK's entire gateway catalog
 * in Agent's model-type intersection (which exceeds TypeScript's union limit).
 */
declare global {
  interface RegisteredProviderModels {
    byok: string
  }
}

export {}
