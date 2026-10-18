/** Source policy knobs (spy-frontend `src/lib/graph/policy.ts`) plus read bounds. */

/** gemini-embedding output truncated to the source vector dimension. */
export const EMBEDDING_DIMENSION = 1536

/** Inclusive bounds for questions written per Memory. */
export const MEMORY_QUESTION_COUNT_MIN = 1
export const MEMORY_QUESTION_COUNT_MAX = 5

/** Max natural-language questions accepted by one memory search. */
export const MEMORY_SEARCH_MAX_QUESTIONS = 5

/** Fixed result count per search probe. */
export const MEMORY_SEARCH_TOP_K = 10

/**
 * Source ceiling was Falkor cosine DISTANCE 0.25. Convex returns cosine
 * similarity (1 = identical), so the equivalent floor is 1 - 0.25.
 */
export const MEMORY_SEARCH_MIN_SCORE = 0.75

/** Max independently configured Memory lookups in one getMemories call. */
export const MEMORY_GET_MAX_REQUESTS = 10

/** Full-graph reads stay inside Convex per-query limits. */
export const TOPOLOGY_MAX_MEMORIES = 2000
export const TOPOLOGY_MAX_LINKS = 8000

/** Source hops are unbounded; the visited set is capped instead. */
export const CONE_MAX_MEMORIES = 200
export const CONE_MAX_RELATES_TO = 200

/** Per-array bound for one manageLinks call. */
export const MANAGE_LINKS_MAX_ITEMS = 100
