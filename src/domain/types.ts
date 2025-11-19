/**
 * Domain types for Medical Research Blind Spot Analyzer
 */

// Input query for disease research
export interface DiseaseQuery {
  disease: string;
  filters?: {
    excludePediatric?: boolean;
    minYear?: number;
    maxYear?: number;
    maxResults?: number; // Max papers to fetch from source
    language?: string;
    studyExclusions?: string[];
  };
}

/**
 * Normalize disease name with basic cleanup and common disease patterns
 */
export function normalizeDiseaseName(raw: string): string {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  // Common disease patterns - add "disease" suffix if missing
  const diseaseTerms = ["alzheimer", "parkinson", "huntington", "crohn"];

  for (const term of diseaseTerms) {
    if (lower === term || lower === `${term}'s`) {
      // Capitalize first letter and add "disease"
      return term.charAt(0).toUpperCase() + term.slice(1) + "'s disease";
    }
  }

  // For diabetes, just capitalize
  if (lower === "diabetes") {
    return "Diabetes";
  }

  // Default: capitalize first letter of each word
  return trimmed
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Metadata for a research paper
export interface PaperMetadata {
  doi: string; // May be empty for preprints
  title: string;
  authors: string[];
  journal: string;
  publicationDate: string; // ISO format
  abstract: string;
  source: "PubMed" | "GoogleScholar" | "ArXiv" | "Other";
  url?: string;
  citations?: number;
}

// Quality assessment for a paper
export interface QualityAssessment {
  paperId: string; // DOI, arXiv ID, or other identifier
  overallScore: number; // 0-1 normalized score
  sourceScore: number; // 0-1: quality of publication source
  recencyScore: number; // 0-1: how recent the paper is
  textRelevanceScore: number; // 0-1: relevance to query
  inclusionReason?: string; // Why this paper was included
  exclusionReason?: string | null; // Why this paper was excluded (if applicable)
}

// Population coverage analysis with detailed demographic breakdown
export interface PopulationCoverage {
  age: Record<string, number>; // Percentage per bucket: "0-18", "18-65", "65-75", ">75", "not_specified"
  gender: Record<string, number>; // Percentage: "male", "female", "not_specified"
  pregnancyStatus?: Record<string, number>; // Percentage: "pregnant", "not_pregnant", "not_specified"
  geography?: Record<string, number>; // Percentage: "North America", "Europe", "Asia", "Other", "not_specified"
}

// Identified blind spot in research
export interface BlindSpot {
  category: string; // e.g., "age", "gender", "pregnancy", "geography"
  gap: string; // Description of what's missing
  severity: "low" | "medium" | "high" | "critical";
  details?: string; // Additional context
}

// Final analysis result
export interface AnalysisResult {
  totalPapersAnalyzed: number;
  populationCoverage: PopulationCoverage;
  blindSpots: BlindSpot[];
}

// Key metrics for the report
export interface ReportKeyMetrics {
  totalPapers: number;
  highQualityPapers: number;
  timeRange?: string; // e.g., "2020-2024"
}

// Final report summary
export interface ReportSummary {
  executiveSummary: string;
  keyMetrics: ReportKeyMetrics;
  mainBlindSpots: BlindSpot[];
  recommendations: string[];
}
