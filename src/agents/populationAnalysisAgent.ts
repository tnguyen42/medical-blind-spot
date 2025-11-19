/**
 * Population Analysis Agent - extracts demographic info using rule-based parsing
 */

import type { GraphStateType } from "../graph/state.js";
import type {
  PaperMetadata,
  PopulationCoverage,
  BlindSpot,
  AnalysisResult,
} from "../domain/types.js";

/**
 * Extract age-related mentions from text
 * Returns counts per age bucket
 */
function extractAgeCoverage(text: string): Record<string, number> {
  const lower = text.toLowerCase();
  const counts: Record<string, number> = {
    "0-18": 0,
    "18-65": 0,
    "65-75": 0,
    ">75": 0,
    not_specified: 0,
  };

  // Heuristic patterns for age groups
  const patterns = [
    { bucket: "0-18", keywords: ["child", "pediatric", "adolescent", "infant", "youth", "under 18"] },
    { bucket: "18-65", keywords: ["adult", "young adult", "middle-aged", "18-65", "working age"] },
    { bucket: "65-75", keywords: ["elderly", "older adult", "65-75", "senior", "aged 65"] },
    { bucket: ">75", keywords: ["very old", "over 75", "aged 75", ">75", "oldest old", "over 80"] },
  ];

  let foundAny = false;
  for (const { bucket, keywords } of patterns) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        counts[bucket]++;
        foundAny = true;
        break; // Count each bucket at most once per paper
      }
    }
  }

  if (!foundAny) {
    counts.not_specified = 1;
  }

  return counts;
}

/**
 * Extract gender-related mentions from text
 */
function extractGenderCoverage(text: string): Record<string, number> {
  const lower = text.toLowerCase();
  const counts: Record<string, number> = {
    male: 0,
    female: 0,
    not_specified: 0,
  };

  const maleKeywords = ["male", "men ", " men", "man ", "gentleman"];
  const femaleKeywords = ["female", "women", "woman", "lady", "ladies"];

  let foundMale = false;
  let foundFemale = false;

  for (const keyword of maleKeywords) {
    if (lower.includes(keyword)) {
      foundMale = true;
      break;
    }
  }

  for (const keyword of femaleKeywords) {
    if (lower.includes(keyword)) {
      foundFemale = true;
      break;
    }
  }

  if (foundMale) counts.male = 1;
  if (foundFemale) counts.female = 1;
  if (!foundMale && !foundFemale) counts.not_specified = 1;

  return counts;
}

/**
 * Extract pregnancy-related mentions from text
 */
function extractPregnancyCoverage(text: string): Record<string, number> {
  const lower = text.toLowerCase();
  const counts: Record<string, number> = {
    pregnant: 0,
    not_pregnant: 0,
    not_specified: 0,
  };

  const pregnancyKeywords = ["pregnan", "gestat", "maternal", "expectant"];

  let foundPregnancy = false;
  for (const keyword of pregnancyKeywords) {
    if (lower.includes(keyword)) {
      foundPregnancy = true;
      break;
    }
  }

  if (foundPregnancy) {
    counts.pregnant = 1;
  } else {
    counts.not_specified = 1;
  }

  return counts;
}

/**
 * Extract geographic mentions from text
 */
function extractGeographyCoverage(text: string): Record<string, number> {
  const lower = text.toLowerCase();
  const counts: Record<string, number> = {
    "North America": 0,
    Europe: 0,
    Asia: 0,
    Other: 0,
    not_specified: 0,
  };

  const patterns = [
    { region: "North America", keywords: ["united states", "usa", "u.s.", "canada", "mexico", "american"] },
    { region: "Europe", keywords: ["europe", "uk", "united kingdom", "germany", "france", "italy", "spain", "european"] },
    { region: "Asia", keywords: ["asia", "china", "japan", "india", "korea", "asian", "chinese", "japanese"] },
    { region: "Other", keywords: ["africa", "australia", "south america", "brazil", "middle east"] },
  ];

  let foundAny = false;
  for (const { region, keywords } of patterns) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        counts[region]++;
        foundAny = true;
        break;
      }
    }
  }

  if (!foundAny) {
    counts.not_specified = 1;
  }

  return counts;
}

/**
 * Aggregate counts into percentages
 */
function aggregateCoverage(
  papers: PaperMetadata[],
  extractor: (text: string) => Record<string, number>
): Record<string, number> {
  const totalCounts: Record<string, number> = {};

  for (const paper of papers) {
    const text = `${paper.title} ${paper.abstract}`;
    const counts = extractor(text);

    for (const [key, count] of Object.entries(counts)) {
      totalCounts[key] = (totalCounts[key] || 0) + count;
    }
  }

  // Convert to percentages
  const total = papers.length;
  const percentages: Record<string, number> = {};

  for (const [key, count] of Object.entries(totalCounts)) {
    percentages[key] = Math.round((count / total) * 100);
  }

  return percentages;
}

/**
 * Detect blind spots based on population coverage
 */
function detectBlindSpots(coverage: PopulationCoverage): BlindSpot[] {
  const blindSpots: BlindSpot[] = [];

  // Age blind spots
  if (coverage.age["0-18"] === 0) {
    blindSpots.push({
      category: "age",
      gap: "No coverage of pediatric populations (0-18 years)",
      severity: "critical",
      details: "Children and adolescents are completely absent from the research",
    });
  } else if (coverage.age["0-18"] < 10) {
    blindSpots.push({
      category: "age",
      gap: "Very low coverage of pediatric populations",
      severity: "high",
      details: `Only ${coverage.age["0-18"]}% of studies include children/adolescents`,
    });
  }

  if (coverage.age[">75"] === 0) {
    blindSpots.push({
      category: "age",
      gap: "No coverage of very elderly populations (>75 years)",
      severity: "critical",
      details: "The oldest demographic is completely absent from the research",
    });
  } else if (coverage.age[">75"] < 10) {
    blindSpots.push({
      category: "age",
      gap: "Very low coverage of very elderly populations",
      severity: "high",
      details: `Only ${coverage.age[">75"]}% of studies include people over 75`,
    });
  }

  // Gender blind spots
  if (coverage.gender.not_specified > 70) {
    blindSpots.push({
      category: "gender",
      gap: "Poor gender reporting in research",
      severity: "high",
      details: `${coverage.gender.not_specified}% of studies don't specify gender demographics`,
    });
  }

  if (coverage.gender.female === 0) {
    blindSpots.push({
      category: "gender",
      gap: "No female representation",
      severity: "critical",
    });
  }

  if (coverage.gender.male === 0) {
    blindSpots.push({
      category: "gender",
      gap: "No male representation",
      severity: "critical",
    });
  }

  // Pregnancy blind spots
  if (coverage.pregnancyStatus && coverage.pregnancyStatus.pregnant === 0) {
    blindSpots.push({
      category: "pregnancy",
      gap: "No coverage of pregnant populations",
      severity: "critical",
      details: "Pregnant women are excluded from all research",
    });
  }

  // Geography blind spots
  if (coverage.geography) {
    const specified = 100 - (coverage.geography.not_specified || 0);
    if (specified < 30) {
      blindSpots.push({
        category: "geography",
        gap: "Poor geographic diversity reporting",
        severity: "medium",
        details: `Only ${specified}% of studies specify geographic regions`,
      });
    }

    if (coverage.geography.Asia === 0) {
      blindSpots.push({
        category: "geography",
        gap: "No Asian population representation",
        severity: "high",
        details: "Studies from Asia or including Asian populations are absent",
      });
    }
  }

  return blindSpots;
}

/**
 * Population Analysis Agent: extracts demographic coverage and identifies blind spots
 */
export async function populationAnalysisAgent(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log("[PopulationAnalysisAgent] Analyzing population coverage...");

  if (!state.highQualityPapers || state.highQualityPapers.length === 0) {
    console.warn("[PopulationAnalysisAgent] No high-quality papers to analyze");

    const emptyResult: AnalysisResult = {
      totalPapersAnalyzed: 0,
      populationCoverage: {
        age: { "0-18": 0, "18-65": 0, "65-75": 0, ">75": 0, not_specified: 100 },
        gender: { male: 0, female: 0, not_specified: 100 },
        pregnancyStatus: { pregnant: 0, not_pregnant: 0, not_specified: 100 },
        geography: { "North America": 0, Europe: 0, Asia: 0, Other: 0, not_specified: 100 },
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

  // Extract coverage for each demographic dimension
  const ageCoverage = aggregateCoverage(papers, extractAgeCoverage);
  const genderCoverage = aggregateCoverage(papers, extractGenderCoverage);
  const pregnancyCoverage = aggregateCoverage(papers, extractPregnancyCoverage);
  const geographyCoverage = aggregateCoverage(papers, extractGeographyCoverage);

  const populationCoverage: PopulationCoverage = {
    age: ageCoverage,
    gender: genderCoverage,
    pregnancyStatus: pregnancyCoverage,
    geography: geographyCoverage,
  };

  // Detect blind spots
  const blindSpots = detectBlindSpots(populationCoverage);

  console.log(
    `[PopulationAnalysisAgent] Analyzed ${papers.length} papers, found ${blindSpots.length} blind spots`
  );

  const analysisResult: AnalysisResult = {
    totalPapersAnalyzed: papers.length,
    populationCoverage,
    blindSpots,
  };

  return { analysisResult };
}
