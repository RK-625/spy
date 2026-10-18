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
};
