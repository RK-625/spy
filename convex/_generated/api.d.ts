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
import type * as chat_excalidraw from "../chat/excalidraw.js";
import type * as chat_files from "../chat/files.js";
import type * as chat_forks from "../chat/forks.js";
import type * as chat_generate from "../chat/generate.js";
import type * as chat_graph from "../chat/graph.js";
import type * as chat_graphAgent from "../chat/graphAgent.js";
import type * as chat_graphHistory from "../chat/graphHistory.js";
import type * as chat_mcpAppTools from "../chat/mcpAppTools.js";
import type * as chat_mcpApps from "../chat/mcpApps.js";
import type * as chat_messages from "../chat/messages.js";
import type * as chat_models from "../chat/models.js";
import type * as chat_ownership from "../chat/ownership.js";
import type * as chat_prompts_askUserQuestion from "../chat/prompts/askUserQuestion.js";
import type * as chat_prompts_deleteMemories from "../chat/prompts/deleteMemories.js";
import type * as chat_prompts_excalidraw from "../chat/prompts/excalidraw.js";
import type * as chat_prompts_getMemories from "../chat/prompts/getMemories.js";
import type * as chat_prompts_graphInstructions from "../chat/prompts/graphInstructions.js";
import type * as chat_prompts_graphMaintenance from "../chat/prompts/graphMaintenance.js";
import type * as chat_prompts_graphOntology from "../chat/prompts/graphOntology.js";
import type * as chat_prompts_instructions from "../chat/prompts/instructions.js";
import type * as chat_prompts_manageLinks from "../chat/prompts/manageLinks.js";
import type * as chat_prompts_searchMemories from "../chat/prompts/searchMemories.js";
import type * as chat_prompts_upsertMemory from "../chat/prompts/upsertMemory.js";
import type * as chat_prompts_webSearch from "../chat/prompts/webSearch.js";
import type * as chat_questions from "../chat/questions.js";
import type * as chat_runtime from "../chat/runtime.js";
import type * as chat_toolHistory from "../chat/toolHistory.js";
import type * as chat_tools_memory from "../chat/tools/memory.js";
import type * as chat_tools_question from "../chat/tools/question.js";
import type * as chat_tools_search from "../chat/tools/search.js";
import type * as chat_upload from "../chat/upload.js";
import type * as chat_validators from "../chat/validators.js";
import type * as demoUser from "../demoUser.js";
import type * as http from "../http.js";
import type * as memory_actions from "../memory/actions.js";
import type * as memory_graph from "../memory/graph.js";
import type * as memory_links from "../memory/links.js";
import type * as memory_policy from "../memory/policy.js";
import type * as memory_rules from "../memory/rules.js";
import type * as memory_store from "../memory/store.js";
import type * as memory_topology from "../memory/topology.js";
import type * as memory_validators from "../memory/validators.js";
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
  "chat/excalidraw": typeof chat_excalidraw;
  "chat/files": typeof chat_files;
  "chat/forks": typeof chat_forks;
  "chat/generate": typeof chat_generate;
  "chat/graph": typeof chat_graph;
  "chat/graphAgent": typeof chat_graphAgent;
  "chat/graphHistory": typeof chat_graphHistory;
  "chat/mcpAppTools": typeof chat_mcpAppTools;
  "chat/mcpApps": typeof chat_mcpApps;
  "chat/messages": typeof chat_messages;
  "chat/models": typeof chat_models;
  "chat/ownership": typeof chat_ownership;
  "chat/prompts/askUserQuestion": typeof chat_prompts_askUserQuestion;
  "chat/prompts/deleteMemories": typeof chat_prompts_deleteMemories;
  "chat/prompts/excalidraw": typeof chat_prompts_excalidraw;
  "chat/prompts/getMemories": typeof chat_prompts_getMemories;
  "chat/prompts/graphInstructions": typeof chat_prompts_graphInstructions;
  "chat/prompts/graphMaintenance": typeof chat_prompts_graphMaintenance;
  "chat/prompts/graphOntology": typeof chat_prompts_graphOntology;
  "chat/prompts/instructions": typeof chat_prompts_instructions;
  "chat/prompts/manageLinks": typeof chat_prompts_manageLinks;
  "chat/prompts/searchMemories": typeof chat_prompts_searchMemories;
  "chat/prompts/upsertMemory": typeof chat_prompts_upsertMemory;
  "chat/prompts/webSearch": typeof chat_prompts_webSearch;
  "chat/questions": typeof chat_questions;
  "chat/runtime": typeof chat_runtime;
  "chat/toolHistory": typeof chat_toolHistory;
  "chat/tools/memory": typeof chat_tools_memory;
  "chat/tools/question": typeof chat_tools_question;
  "chat/tools/search": typeof chat_tools_search;
  "chat/upload": typeof chat_upload;
  "chat/validators": typeof chat_validators;
  demoUser: typeof demoUser;
  http: typeof http;
  "memory/actions": typeof memory_actions;
  "memory/graph": typeof memory_graph;
  "memory/links": typeof memory_links;
  "memory/policy": typeof memory_policy;
  "memory/rules": typeof memory_rules;
  "memory/store": typeof memory_store;
  "memory/topology": typeof memory_topology;
  "memory/validators": typeof memory_validators;
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
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
