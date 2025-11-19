/**
 * Quality Assessment Agent - evaluates papers using heuristic scoring
 */

import type { GraphStateType } from "../graph/state.js";
import type { PaperMetadata, QualityAssessment } from "../domain/types.js";

const QUALITY_THRESHOLD = 0.5; // Papers with overallScore >= 0.5 are high quality
const CURRENT_YEAR = new Date().getFullYear();

/**
 * Calculate source score based on publication source and journal
 */
function calculateSourceScore(paper: PaperMetadata): number {
  // Heuristic: ArXiv preprints get a baseline score
  // In future, PubMed peer-reviewed papers would score higher
  switch (paper.source) {
    case "PubMed":
      return 0.9; // Peer-reviewed journals
    case "ArXiv":
      return 0.6; // Preprints, not peer-reviewed yet
    case "GoogleScholar":
      return 0.7; // Mixed quality
    default:
      return 0.5;
  }
}

/**
 * Calculate recency score based on publication date
 * Papers from the last 5 years get higher scores
 */
function calculateRecencyScore(publicationDate: string): number {
  const year = parseInt(publicationDate.split("-")[0]);
  const age = CURRENT_YEAR - year;

  // Linear decay over 20 years: recent papers score higher
  if (age <= 2) return 1.0; // Very recent
  if (age <= 5) return 0.8; // Recent
  if (age <= 10) return 0.6; // Moderately recent
  if (age <= 15) return 0.4; // Older
  return Math.max(0.2, 1.0 - age / 20); // Very old
}

/**
 * Calculate text relevance score based on keyword matching
 * Simple approach: count disease-related terms in title and abstract
 */
function calculateTextRelevanceScore(
  paper: PaperMetadata,
  diseaseQuery: string
): number {
  const queryLower = diseaseQuery.toLowerCase();
  const titleLower = paper.title.toLowerCase();
  const abstractLower = paper.abstract.toLowerCase();

  // Extract key terms from disease query (split by space, remove common words)
  const queryTerms = queryLower
    .split(/\s+/)
    .filter((term) => term.length > 3) // Skip short words like "of", "the"
    .filter((term) => !["disease"].includes(term)); // Skip generic term

  let matchCount = 0;
  let totalTerms = queryTerms.length;

  for (const term of queryTerms) {
    // Count matches in title (weighted 2x) and abstract (1x)
    if (titleLower.includes(term)) {
      matchCount += 2;
    }
    if (abstractLower.includes(term)) {
      matchCount += 1;
    }
  }

  // Normalize: max score of 1.0 if all terms appear in both title and abstract
  const maxPossibleScore = totalTerms * 3; // 2 for title + 1 for abstract
  return maxPossibleScore > 0 ? Math.min(1.0, matchCount / maxPossibleScore) : 0.5;
}

/**
 * Assess quality of a single paper
 */
function assessPaper(
  paper: PaperMetadata,
  diseaseQuery: string
): QualityAssessment {
  const sourceScore = calculateSourceScore(paper);
  const recencyScore = calculateRecencyScore(paper.publicationDate);
  const textRelevanceScore = calculateTextRelevanceScore(paper, diseaseQuery);

  // Weighted combination: recency (40%), relevance (40%), source (20%)
  const overallScore =
    0.4 * recencyScore + 0.4 * textRelevanceScore + 0.2 * sourceScore;

  // Use DOI if available, otherwise use URL as identifier
  const paperId = paper.doi || paper.url || paper.title;

  return {
    paperId,
    overallScore,
    sourceScore,
    recencyScore,
    textRelevanceScore,
    inclusionReason:
      overallScore >= QUALITY_THRESHOLD
        ? `High relevance (${(textRelevanceScore * 100).toFixed(0)}%) and recency (${(recencyScore * 100).toFixed(0)}%)`
        : undefined,
    exclusionReason:
      overallScore < QUALITY_THRESHOLD
        ? `Overall score ${overallScore.toFixed(2)} below threshold ${QUALITY_THRESHOLD}`
        : null,
  };
}

/**
 * Quality Assessment Agent: evaluates papers and filters high-quality ones
 */
export async function qualityAssessmentAgent(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log("[QualityAssessmentAgent] Evaluating papers...");

  if (!state.papers || state.papers.length === 0) {
    console.warn("[QualityAssessmentAgent] No papers to assess");
    return {};
  }

  if (!state.query) {
    console.warn("[QualityAssessmentAgent] No query found in state");
    return {};
  }

  const { disease } = state.query;
  const qualityAssessments: Record<string, QualityAssessment> = {};
  const highQualityPapers: PaperMetadata[] = [];

  // Assess each paper
  for (const paper of state.papers) {
    const assessment = assessPaper(paper, disease);
    const paperId = assessment.paperId;

    qualityAssessments[paperId] = assessment;

    // Filter high-quality papers
    if (assessment.overallScore >= QUALITY_THRESHOLD) {
      highQualityPapers.push(paper);
    }
  }

  console.log(
    `[QualityAssessmentAgent] Assessed ${state.papers.length} papers, ${highQualityPapers.length} are high quality`
  );

  return {
    qualityAssessments,
    highQualityPapers,
  };
}
