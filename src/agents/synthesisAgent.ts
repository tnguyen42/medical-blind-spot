/**
 * Synthesis & Reporting Agent - generates final report summary
 */

import type { GraphStateType } from "../graph/state.js";
import type {
  BlindSpot,
  ReportKeyMetrics,
  ReportSummary,
} from "../domain/types.js";

/**
 * Sort blind spots by severity (critical > high > medium > low)
 */
function sortBlindSpotsBySeverity(blindSpots: BlindSpot[]): BlindSpot[] {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  return [...blindSpots].sort((a, b) => {
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * Generate recommendations based on blind spots
 */
function generateRecommendations(blindSpots: BlindSpot[]): string[] {
  const recommendations: string[] = [];

  for (const blindSpot of blindSpots) {
    switch (blindSpot.category) {
      case "age":
        if (blindSpot.gap.includes("pediatric") || blindSpot.gap.includes("0-18")) {
          recommendations.push(
            "Design studies that safely include pediatric populations (children and adolescents) where ethically appropriate."
          );
        }
        if (blindSpot.gap.includes("elderly") || blindSpot.gap.includes(">75")) {
          recommendations.push(
            "Include participants over 75 years old in clinical trials to understand treatment efficacy in very elderly populations."
          );
        }
        break;

      case "gender":
        if (blindSpot.gap.includes("poor") || blindSpot.gap.includes("reporting")) {
          recommendations.push(
            "Improve reporting of gender distribution and conduct sex-disaggregated analysis in all studies."
          );
        }
        if (blindSpot.gap.includes("female")) {
          recommendations.push(
            "Increase recruitment of female participants to ensure findings are generalizable across sexes."
          );
        }
        if (blindSpot.gap.includes("male")) {
          recommendations.push(
            "Increase recruitment of male participants to ensure findings are generalizable across sexes."
          );
        }
        break;

      case "pregnancy":
        if (blindSpot.gap.includes("pregnant")) {
          recommendations.push(
            "Where ethically appropriate and safe, include pregnant women in research to understand treatment effects during pregnancy."
          );
        }
        break;

      case "geography":
        if (blindSpot.gap.includes("Asia")) {
          recommendations.push(
            "Conduct multi-center studies including Asian populations to improve global representativeness."
          );
        }
        if (blindSpot.gap.includes("diversity")) {
          recommendations.push(
            "Expand geographic diversity in research to ensure findings apply across different populations and healthcare systems."
          );
        }
        break;
    }
  }

  // Remove duplicates and limit to top 5 recommendations
  return [...new Set(recommendations)].slice(0, 5);
}

/**
 * Calculate time range from high-quality papers
 */
function calculateTimeRange(papers: { publicationDate: string }[]): string | undefined {
  if (papers.length === 0) return undefined;

  const years = papers
    .map((p) => parseInt(p.publicationDate.split("-")[0]))
    .filter((y) => !isNaN(y))
    .sort((a, b) => a - b);

  if (years.length === 0) return undefined;

  const minYear = years[0];
  const maxYear = years[years.length - 1];

  return minYear === maxYear ? `${minYear}` : `${minYear}-${maxYear}`;
}

/**
 * Generate executive summary
 */
function generateExecutiveSummary(
  diseaseName: string,
  totalPapers: number,
  highQualityPapers: number,
  blindSpots: BlindSpot[]
): string {
  const criticalBlindSpots = blindSpots.filter((bs) => bs.severity === "critical");
  const highBlindSpots = blindSpots.filter((bs) => bs.severity === "high");

  let summary = `Analysis of ${diseaseName} research literature identified ${totalPapers} relevant papers, `;
  summary += `of which ${highQualityPapers} met high-quality criteria for detailed analysis. `;

  if (criticalBlindSpots.length > 0) {
    summary += `The analysis revealed ${criticalBlindSpots.length} critical blind spot${criticalBlindSpots.length > 1 ? "s" : ""}: `;
    summary += criticalBlindSpots
      .slice(0, 3)
      .map((bs) => bs.gap.toLowerCase())
      .join("; ");
    summary += ". ";
  }

  if (highBlindSpots.length > 0) {
    summary += `Additionally, ${highBlindSpots.length} high-severity gap${highBlindSpots.length > 1 ? "s were" : " was"} identified. `;
  }

  if (criticalBlindSpots.length === 0 && highBlindSpots.length === 0) {
    summary += "No critical or high-severity blind spots were identified. ";
  }

  summary += "These findings highlight important gaps in research coverage that should be addressed in future studies.";

  return summary;
}

/**
 * Synthesis Agent: generates final report summary
 */
export async function synthesisAgent(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log("[SynthesisAgent] Generating report summary...");

  if (!state.query || !state.analysisResult) {
    console.warn("[SynthesisAgent] Missing required data for synthesis");
    return {};
  }

  const { disease } = state.query;
  const totalPapers = state.papers?.length || 0;
  const highQualityPapers = state.highQualityPapers?.length || 0;
  const analysisResult = state.analysisResult;

  // Sort blind spots by severity and take the most important ones
  const sortedBlindSpots = sortBlindSpotsBySeverity(analysisResult.blindSpots);
  const mainBlindSpots = sortedBlindSpots.slice(0, 5); // Top 5 most severe

  // Generate key metrics
  const keyMetrics: ReportKeyMetrics = {
    totalPapers,
    highQualityPapers,
    timeRange: calculateTimeRange(state.highQualityPapers || []),
  };

  // Generate executive summary
  const executiveSummary = generateExecutiveSummary(
    disease,
    totalPapers,
    highQualityPapers,
    sortedBlindSpots
  );

  // Generate recommendations
  const recommendations = generateRecommendations(mainBlindSpots);

  const reportSummary: ReportSummary = {
    executiveSummary,
    keyMetrics,
    mainBlindSpots,
    recommendations,
  };

  console.log("[SynthesisAgent] Report generated successfully");

  // Log a brief summary to console
  const criticalCount = mainBlindSpots.filter((bs) => bs.severity === "critical").length;
  const highCount = mainBlindSpots.filter((bs) => bs.severity === "high").length;

  console.log("\n" + "=".repeat(60));
  console.log("EXECUTIVE SUMMARY");
  console.log("=".repeat(60));
  console.log(executiveSummary);
  console.log("\nKEY FINDINGS:");
  console.log(`- ${criticalCount} critical blind spots identified`);
  console.log(`- ${highCount} high-severity gaps identified`);
  console.log("=".repeat(60) + "\n");

  return { reportSummary };
}
