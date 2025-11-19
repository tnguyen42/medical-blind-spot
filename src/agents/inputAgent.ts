/**
 * Input Agent - normalizes and validates disease query input
 */

import type { GraphStateType } from "../graph/state.js";
import { normalizeDiseaseName } from "../domain/types.js";

/**
 * Input Agent: processes raw query input and normalizes disease name
 */
export async function inputAgent(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log("[InputAgent] Processing query...");

  if (!state.query) {
    throw new Error("No query provided in state");
  }

  const { disease, filters } = state.query;

  // Normalize the disease name
  const normalizedDisease = normalizeDiseaseName(disease);

  console.log(`[InputAgent] Normalized: "${disease}" -> "${normalizedDisease}"`);

  // Apply defaults to filters if needed
  const normalizedFilters = {
    excludePediatric: filters?.excludePediatric ?? false,
    minYear: filters?.minYear ?? 2000,
    maxYear: filters?.maxYear ?? new Date().getFullYear(),
    language: filters?.language ?? "en",
    studyExclusions: filters?.studyExclusions ?? [],
  };

  console.log("[InputAgent] Filters:", normalizedFilters);

  // Return updated query
  return {
    query: {
      disease: normalizedDisease,
      filters: normalizedFilters,
    },
  };
}
