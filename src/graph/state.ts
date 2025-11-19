/**
 * LangGraph state definition using Annotation pattern
 */

import { Annotation } from "@langchain/langgraph";
import type {
  DiseaseQuery,
  PaperMetadata,
  AnalysisResult,
  QualityAssessment,
  ReportSummary,
} from "../domain/types.js";

/**
 * State schema for the Medical Research Blind Spot Analyzer graph
 */
export const GraphState = Annotation.Root({
  query: Annotation<DiseaseQuery | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  papers: Annotation<PaperMetadata[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),

  highQualityPapers: Annotation<PaperMetadata[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),

  qualityAssessments: Annotation<Record<string, QualityAssessment>>({
    reducer: (prev, next) => next ?? prev,
    default: () => ({}),
  }),

  analysisResult: Annotation<AnalysisResult | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  reportSummary: Annotation<ReportSummary | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),
});

// Export the inferred state type for use in nodes
export type GraphStateType = typeof GraphState.State;
