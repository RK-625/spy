/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as chat_conversations from "../chat/conversations.js";
import type * as chat_drafts from "../chat/drafts.js";
import type * as chat_files from "../chat/files.js";
import type * as chat_generate from "../chat/generate.js";
import type * as chat_messages from "../chat/messages.js";
import type * as chat_models from "../chat/models.js";
import type * as chat_ownership from "../chat/ownership.js";
import type * as chat_runtime from "../chat/runtime.js";
import type * as chat_upload from "../chat/upload.js";
import type * as chat_validators from "../chat/validators.js";
import type * as http from "../http.js";
import type * as myFunctions from "../myFunctions.js";
import type * as providers_actions from "../providers/actions.js";
import type * as providers_credentials from "../providers/credentials.js";
import type * as providers_crypto from "../providers/crypto.js";
import type * as providers_identity from "../providers/identity.js";
import type * as providers_keys from "../providers/keys.js";
import type * as providers_validators from "../providers/validators.js";
import type * as providers_verify from "../providers/verify.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "chat/conversations": typeof chat_conversations;
  "chat/drafts": typeof chat_drafts;
  "chat/files": typeof chat_files;
  "chat/generate": typeof chat_generate;
  "chat/messages": typeof chat_messages;
  "chat/models": typeof chat_models;
  "chat/ownership": typeof chat_ownership;
  "chat/runtime": typeof chat_runtime;
  "chat/upload": typeof chat_upload;
  "chat/validators": typeof chat_validators;
  http: typeof http;
  myFunctions: typeof myFunctions;
  "providers/actions": typeof providers_actions;
  "providers/credentials": typeof providers_credentials;
  "providers/crypto": typeof providers_crypto;
  "providers/identity": typeof providers_identity;
  "providers/keys": typeof providers_keys;
  "providers/validators": typeof providers_validators;
  "providers/verify": typeof providers_verify;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
};
