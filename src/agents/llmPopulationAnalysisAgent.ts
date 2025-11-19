/**
 * LLM-based Population Analysis Agent
 *
 * Uses an LLM to extract demographic information and identify blind spots
 * More sophisticated than the heuristic agent, but requires API costs
 */

import type { GraphStateType } from "../graph/state.js";
import type {
  PaperMetadata,
  PopulationCoverage,
  BlindSpot,
  AnalysisResult,
} from "../domain/types.js";
import { callLLM, parseDemographicResponse } from "../lib/llm.js";

/**
 * Build prompt for LLM to analyze population coverage
 */
function buildPopulationAnalysisPrompt(papers: PaperMetadata[]): string {
  const papersContext = papers
    .slice(0, 10) // Limit to avoid token limits; in production, may need chunking
    .map((paper, idx) => {
      return `
Paper ${idx + 1}:
Title: ${paper.title}
Authors: ${paper.authors.slice(0, 5).join(", ")}
Publication Year: ${paper.publicationDate.split("-")[0]}
Abstract: ${paper.abstract.slice(0, 500)}...
      `.trim();
    })
    .join("\n\n---\n\n");

  return `
You are a medical research analyst specializing in identifying demographic blind spots in research literature.

Analyze the following ${papers.length} research papers and provide a comprehensive demographic breakdown:

${papersContext}

Please analyze and report:

1. **Age Demographics**: Estimate the percentage of studies covering:
   - Pediatric (0-18 years)
   - Young Adults (18-40 years)
   - Middle-aged Adults (40-65 years)
   - Elderly (65-75 years)
   - Very Elderly (>75 years)

2. **Gender Demographics**: Estimate coverage of:
   - Male participants
   - Female participants
   - Studies not reporting gender

3. **Pregnancy Status**: Estimate:
   - Studies including pregnant individuals
   - Studies not mentioning pregnancy

4. **Geographic Distribution**: Estimate regional representation:
   - North America
   - Europe
   - Asia
   - Africa
   - Other regions

5. **Critical Blind Spots**: Identify populations systematically excluded or severely underrepresented, with severity assessment (CRITICAL, HIGH, MEDIUM, LOW).

Provide specific percentages and clear identification of blind spots based on the abstracts and metadata.
  `.trim();
}

/**
 * Build system prompt for the LLM
 */
function buildSystemPrompt(): string {
  return `You are a medical research analyst with expertise in population health and research equity.
Your role is to identify demographic gaps and blind spots in medical research literature.
Provide precise, evidence-based assessments with specific percentages where possible.
Focus on identifying populations that are systematically excluded or underrepresented.`;
}

/**
 * Convert LLM findings to BlindSpot objects
 */
function convertFindingsToBlindSpots(findings: string[]): BlindSpot[] {
  return findings.map((finding) => {
    const findingLower = finding.toLowerCase();

    // Determine severity based on keywords
    let severity: "low" | "medium" | "high" | "critical" = "medium";
    if (
      findingLower.includes("complete") ||
      findingLower.includes("systematic exclusion") ||
      findingLower.includes("absence")
    ) {
      severity = "critical";
    } else if (
      findingLower.includes("severe") ||
      findingLower.includes("significant")
    ) {
      severity = "high";
    }

    // Determine category
    let category = "general";
    if (findingLower.includes("pediatric") || findingLower.includes("elderly")) {
      category = "age";
    } else if (findingLower.includes("pregnant")) {
      category = "pregnancy";
    } else if (
      findingLower.includes("gender") ||
      findingLower.includes("female") ||
      findingLower.includes("male")
    ) {
      category = "gender";
    } else if (findingLower.includes("geographic") || findingLower.includes("africa") || findingLower.includes("asia")) {
      category = "geography";
    }

    return {
      category,
      gap: finding,
      severity,
      details: `Identified through LLM-powered analysis of research abstracts`,
    };
  });
}

/**
 * LLM-based Population Analysis Agent
 */
export async function llmPopulationAnalysisAgent(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log("[LLM-PopulationAnalysisAgent] Starting LLM-powered analysis...");

  if (!state.highQualityPapers || state.highQualityPapers.length === 0) {
    console.warn("[LLM-PopulationAnalysisAgent] No high-quality papers to analyze");

    const emptyResult: AnalysisResult = {
      totalPapersAnalyzed: 0,
      populationCoverage: {
        age: { "0-18": 0, "18-65": 0, "65-75": 0, ">75": 0, not_specified: 100 },
        gender: { male: 0, female: 0, not_specified: 100 },
        pregnancyStatus: { pregnant: 0, not_pregnant: 0, not_specified: 100 },
        geography: {
          "North America": 0,
          Europe: 0,
          Asia: 0,
          Other: 0,
          not_specified: 100,
        },
      },
      blindSpots: [
        {
          category: "data",
          gap: "No analyzable papers available",
          severity: "critical",
          details: "Cannot perform population analysis without high-quality papers",
        },
      ],
    };

    return { analysisResult: emptyResult };
  }

  const papers = state.highQualityPapers;

  try {
    // Build prompt for LLM
    const prompt = buildPopulationAnalysisPrompt(papers);
    const systemPrompt = buildSystemPrompt();

    console.log(
      `[LLM-PopulationAnalysisAgent] Calling LLM to analyze ${papers.length} papers...`
    );

    // Call LLM (currently mocked)
    // TODO: Replace with actual LLM call when ready
    const llmResponse = await callLLM(prompt, systemPrompt);

    console.log(
      `[LLM-PopulationAnalysisAgent] Received response from ${llmResponse.model || "LLM"}`
    );
    if (llmResponse.tokensUsed) {
      console.log(`[LLM-PopulationAnalysisAgent] Tokens used: ${llmResponse.tokensUsed}`);
    }

    // Parse LLM response into structured data
    const parsed = parseDemographicResponse(llmResponse.content);

    // Map age demographics to our standard buckets
    const ageCoverage: Record<string, number> = {
      "0-18": parsed.age["0-18"],
      "18-65": parsed.age["18-40"] + parsed.age["40-65"], // Combine into standard bucket
      "65-75": parsed.age["65-75"],
      ">75": parsed.age[">75"],
      not_specified: parsed.age.not_specified,
    };

    const populationCoverage: PopulationCoverage = {
      age: ageCoverage,
      gender: parsed.gender,
      pregnancyStatus: parsed.pregnancyStatus,
      geography: parsed.geography,
    };

    // Convert findings to blind spots
    const blindSpots = convertFindingsToBlindSpots(parsed.criticalFindings);

    console.log(
      `[LLM-PopulationAnalysisAgent] Analysis complete: ${blindSpots.length} blind spots identified`
    );

    const analysisResult: AnalysisResult = {
      totalPapersAnalyzed: papers.length,
      populationCoverage,
      blindSpots,
    };

    return { analysisResult };
  } catch (error) {
    console.error(
      "[LLM-PopulationAnalysisAgent] Error during LLM analysis:",
      error instanceof Error ? error.message : error
    );

    // Fallback to empty result on error
    const fallbackResult: AnalysisResult = {
      totalPapersAnalyzed: papers.length,
      populationCoverage: {
        age: { "0-18": 0, "18-65": 0, "65-75": 0, ">75": 0, not_specified: 100 },
        gender: { male: 0, female: 0, not_specified: 100 },
        pregnancyStatus: { pregnant: 0, not_pregnant: 0, not_specified: 100 },
        geography: {
          "North America": 0,
          Europe: 0,
          Asia: 0,
          Other: 0,
          not_specified: 100,
        },
      },
      blindSpots: [
        {
          category: "error",
          gap: "LLM analysis failed",
          severity: "high",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      ],
    };

    return { analysisResult: fallbackResult };
  }
}
