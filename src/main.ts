/**
 * Demo entrypoint for Medical Research Blind Spot Analyzer
 */

import { graph } from "./graph/index.js";

async function main() {
  console.log("=== Medical Research Blind Spot Analyzer - Demo ===\n");

  // Test case: search for Alzheimer's disease papers
  const rawQuery = {
    disease: "alzheimer", // Will be normalized to "Alzheimer's disease"
    filters: {
      excludePediatric: true,
      minYear: 2015,
    },
  };

  console.log("Raw input query:", rawQuery);
  console.log("\nInvoking complete analysis pipeline...\n");

  // Invoke the graph with initial state
  const result = await graph.invoke({
    query: rawQuery,
    papers: [],
    highQualityPapers: [],
    qualityAssessments: {},
    analysisResult: null,
    reportSummary: null,
  });

  console.log("\n=== Final State ===");
  console.log("Normalized Query:", JSON.stringify(result.query, null, 2));
  console.log(`\nTotal papers found: ${result.papers.length}`);
  console.log(`High quality papers: ${result.highQualityPapers.length}`);

  // Display high-quality papers with their scores
  if (result.highQualityPapers.length > 0) {
    console.log("\n=== High Quality Papers ===");
    result.highQualityPapers.forEach((paper, idx) => {
      const paperId = paper.doi || paper.url || paper.title;
      const assessment = result.qualityAssessments[paperId];

      console.log(`\n[${idx + 1}] ${paper.title}`);
      console.log(`    Authors: ${paper.authors.slice(0, 3).join(", ")}${paper.authors.length > 3 ? " et al." : ""}`);
      console.log(`    Published: ${paper.publicationDate}`);
      console.log(`    Source: ${paper.source}`);

      if (assessment) {
        console.log(`    Overall Score: ${assessment.overallScore.toFixed(3)}`);
        console.log(`      - Relevance: ${assessment.textRelevanceScore.toFixed(2)}`);
        console.log(`      - Recency: ${assessment.recencyScore.toFixed(2)}`);
        console.log(`      - Source: ${assessment.sourceScore.toFixed(2)}`);
        if (assessment.inclusionReason) {
          console.log(`    ✓ ${assessment.inclusionReason}`);
        }
      }
    });
  }

  // Show summary of filtered papers
  const filteredCount = result.papers.length - result.highQualityPapers.length;
  if (filteredCount > 0) {
    console.log(`\n${filteredCount} papers filtered out due to low quality scores.`);
  }

  // Display population analysis results
  if (result.analysisResult) {
    const analysis = result.analysisResult;

    console.log("\n=== Population Coverage Analysis ===");
    console.log(`Papers analyzed: ${analysis.totalPapersAnalyzed}`);

    console.log("\nAge Distribution:");
    for (const [bucket, percent] of Object.entries(analysis.populationCoverage.age)) {
      console.log(`  ${bucket}: ${percent}%`);
    }

    console.log("\nGender Distribution:");
    for (const [gender, percent] of Object.entries(analysis.populationCoverage.gender)) {
      console.log(`  ${gender}: ${percent}%`);
    }

    if (analysis.populationCoverage.pregnancyStatus) {
      console.log("\nPregnancy Status:");
      for (const [status, percent] of Object.entries(analysis.populationCoverage.pregnancyStatus)) {
        console.log(`  ${status}: ${percent}%`);
      }
    }

    if (analysis.populationCoverage.geography) {
      console.log("\nGeographic Distribution:");
      for (const [region, percent] of Object.entries(analysis.populationCoverage.geography)) {
        console.log(`  ${region}: ${percent}%`);
      }
    }

    // Display blind spots
    if (analysis.blindSpots.length > 0) {
      console.log("\n=== Identified Blind Spots ===");
      analysis.blindSpots.forEach((blindSpot, idx) => {
        console.log(`\n[${idx + 1}] ${blindSpot.category.toUpperCase()}: ${blindSpot.gap}`);
        console.log(`    Severity: ${blindSpot.severity.toUpperCase()}`);
        if (blindSpot.details) {
          console.log(`    Details: ${blindSpot.details}`);
        }
      });
    } else {
      console.log("\n✓ No major blind spots detected");
    }
  }

  // Display final report summary
  if (result.reportSummary) {
    console.log("\n" + "=".repeat(70));
    console.log("FINAL REPORT SUMMARY");
    console.log("=".repeat(70));

    console.log("\n📊 Key Metrics:");
    console.log(`   Total Papers: ${result.reportSummary.keyMetrics.totalPapers}`);
    console.log(`   High Quality Papers: ${result.reportSummary.keyMetrics.highQualityPapers}`);
    if (result.reportSummary.keyMetrics.timeRange) {
      console.log(`   Time Range: ${result.reportSummary.keyMetrics.timeRange}`);
    }

    console.log("\n📝 Executive Summary:");
    console.log(`   ${result.reportSummary.executiveSummary}`);

    if (result.reportSummary.mainBlindSpots.length > 0) {
      console.log("\n🔍 Main Blind Spots:");
      result.reportSummary.mainBlindSpots.forEach((bs, idx) => {
        console.log(`   ${idx + 1}. [${bs.severity.toUpperCase()}] ${bs.category}: ${bs.gap}`);
      });
    }

    if (result.reportSummary.recommendations.length > 0) {
      console.log("\n💡 Recommendations:");
      result.reportSummary.recommendations.forEach((rec, idx) => {
        console.log(`   ${idx + 1}. ${rec}`);
      });
    }

    console.log("\n" + "=".repeat(70));

    // Also output as JSON for programmatic access
    console.log("\n📄 JSON Output (for programmatic use):");
    console.log(JSON.stringify(result.reportSummary, null, 2));
  }
}

main().catch(console.error);
