import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import { writeFile } from 'fs/promises';
import { Paper } from './literatureSearch.js';

dotenv.config();

// Demographic data extracted from a single paper
interface PaperDemographics {
  paperId: string;
  title: string;
  ageRanges: string[];
  genderDistribution: {
    male?: number;
    female?: number;
    other?: number;
    notSpecified?: boolean;
  };
  ethnicities: string[];
  pregnancyMentioned: boolean;
  sampleSize?: number;
  geographicLocation: string[];
  comorbidities: string[];
}

// Aggregated population coverage across all papers
interface PopulationCoverage {
  age: Record<string, number>;
  gender: Record<string, number>;
  ethnicity: Record<string, number>;
  pregnancy: {
    mentioned: number;
    notMentioned: number;
  };
  geographic: Record<string, number>;
}

// Identified blind spot
interface BlindSpot {
  category: string;
  gap: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedCount: number;
}

// Output format for Population Analysis Agent
export interface PopulationAnalysisOutput {
  total_papers_analyzed: number;
  population_coverage: {
    age: Record<string, string>;
    gender: Record<string, string>;
    ethnicity: Record<string, string>;
    pregnancy_status: {
      pregnant: string;
      not_mentioned: string;
    };
    geographic: Record<string, string>;
  };
  blind_spots: BlindSpot[];
  raw_demographics: PaperDemographics[];
}

/**
 * Extract demographics from a paper's abstract using Claude (Anthropic)
 */
async function extractDemographics(paper: Paper): Promise<PaperDemographics> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not found in environment variables');
  }

  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  const prompt = `Analyze the following research paper abstract and extract demographic information about the study population. Return ONLY a JSON object with this exact structure:

{
  "ageRanges": ["18-65", "65+"],
  "genderDistribution": {
    "male": 50,
    "female": 50,
    "notSpecified": false
  },
  "ethnicities": ["Caucasian", "Asian"],
  "pregnancyMentioned": false,
  "sampleSize": 100,
  "geographicLocation": ["USA", "Netherlands"],
  "comorbidities": ["diabetes", "hypertension"]
}

Rules:
- For ageRanges: use standard brackets like "0-18", "18-65", "65-75", ">75", or "not specified"
- For genderDistribution: provide percentages if mentioned, or set notSpecified=true
- For ethnicities: list any mentioned ethnic groups, or ["not specified"]
- For pregnancyMentioned: true if pregnancy is mentioned at all
- For sampleSize: extract the number of participants, or null
- For geographicLocation: list countries/regions mentioned
- For comorbidities: list any mentioned conditions
- If information is not available, use empty arrays [] or null

Title: ${paper.title}

Abstract: ${paper.abstract}

JSON output:`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a medical research analyst. Extract demographic data from research abstracts and return ONLY valid JSON, no additional text.\n\n${prompt}`,
        },
      ],
    });

    const content = message.content[0];
    let text = content.type === 'text' ? content.text.trim() : '';
    
    if (!text) {
      throw new Error('Empty response from Claude');
    }

    // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    // Parse the JSON response
    const demographics = JSON.parse(text);

    return {
      paperId: paper.doi,
      title: paper.title,
      ...demographics,
    };
  } catch (error) {
    console.warn(`Failed to extract demographics for paper "${paper.title}": ${error}`);
    
    // Return default empty demographics on error
    return {
      paperId: paper.doi,
      title: paper.title,
      ageRanges: ['not specified'],
      genderDistribution: { notSpecified: true },
      ethnicities: ['not specified'],
      pregnancyMentioned: false,
      sampleSize: undefined,
      geographicLocation: [],
      comorbidities: [],
    };
  }
}

/**
 * Aggregate demographics across all papers
 */
function aggregateDemographics(demographics: PaperDemographics[]): PopulationCoverage {
  const coverage: PopulationCoverage = {
    age: {},
    gender: {},
    ethnicity: {},
    pregnancy: { mentioned: 0, notMentioned: 0 },
    geographic: {},
  };

  const totalPapers = demographics.length;

  for (const demo of demographics) {
    // Aggregate age ranges
    for (const ageRange of demo.ageRanges) {
      coverage.age[ageRange] = (coverage.age[ageRange] || 0) + 1;
    }

    // Aggregate gender
    if (demo.genderDistribution.notSpecified) {
      coverage.gender['not_specified'] = (coverage.gender['not_specified'] || 0) + 1;
    } else {
      if (demo.genderDistribution.male) {
        coverage.gender['male'] = (coverage.gender['male'] || 0) + 1;
      }
      if (demo.genderDistribution.female) {
        coverage.gender['female'] = (coverage.gender['female'] || 0) + 1;
      }
      if (demo.genderDistribution.other) {
        coverage.gender['other'] = (coverage.gender['other'] || 0) + 1;
      }
    }

    // Aggregate ethnicity
    for (const ethnicity of demo.ethnicities) {
      coverage.ethnicity[ethnicity] = (coverage.ethnicity[ethnicity] || 0) + 1;
    }

    // Aggregate pregnancy
    if (demo.pregnancyMentioned) {
      coverage.pregnancy.mentioned++;
    } else {
      coverage.pregnancy.notMentioned++;
    }

    // Aggregate geographic location
    for (const location of demo.geographicLocation) {
      coverage.geographic[location] = (coverage.geographic[location] || 0) + 1;
    }
  }

  return coverage;
}

/**
 * Identify blind spots in the research
 */
function identifyBlindSpots(
  coverage: PopulationCoverage,
  totalPapers: number
): BlindSpot[] {
  const blindSpots: BlindSpot[] = [];

  // Check age coverage
  const elderlyCount = (coverage.age['>75'] || 0) + (coverage.age['75+'] || 0);
  const elderlyPercentage = (elderlyCount / totalPapers) * 100;
  
  if (elderlyPercentage < 10) {
    blindSpots.push({
      category: 'age',
      gap: `Severely underrepresented: Adults over 75 (only ${elderlyPercentage.toFixed(1)}% of studies)`,
      severity: elderlyPercentage === 0 ? 'critical' : 'high',
      affectedCount: totalPapers - elderlyCount,
    });
  }

  const pediatricCount = (coverage.age['0-18'] || 0);
  const pediatricPercentage = (pediatricCount / totalPapers) * 100;
  
  if (pediatricPercentage < 5) {
    blindSpots.push({
      category: 'age',
      gap: `Underrepresented: Pediatric population (only ${pediatricPercentage.toFixed(1)}% of studies)`,
      severity: pediatricPercentage === 0 ? 'high' : 'medium',
      affectedCount: totalPapers - pediatricCount,
    });
  }

  // Check pregnancy coverage
  if (coverage.pregnancy.mentioned === 0) {
    blindSpots.push({
      category: 'pregnancy',
      gap: 'No studies mentioned pregnant women or pregnancy status',
      severity: 'critical',
      affectedCount: totalPapers,
    });
  } else if (coverage.pregnancy.mentioned < totalPapers * 0.05) {
    blindSpots.push({
      category: 'pregnancy',
      gap: `Pregnant women severely underrepresented (only ${coverage.pregnancy.mentioned} of ${totalPapers} studies)`,
      severity: 'high',
      affectedCount: totalPapers - coverage.pregnancy.mentioned,
    });
  }

  // Check gender diversity
  const genderNotSpecified = coverage.gender['not_specified'] || 0;
  if (genderNotSpecified > totalPapers * 0.2) {
    blindSpots.push({
      category: 'gender',
      gap: `Gender not specified in ${genderNotSpecified} studies (${((genderNotSpecified / totalPapers) * 100).toFixed(1)}%)`,
      severity: 'medium',
      affectedCount: genderNotSpecified,
    });
  }

  // Check ethnicity diversity
  const ethnicityNotSpecified = coverage.ethnicity['not specified'] || 0;
  const ethnicityCount = Object.keys(coverage.ethnicity).filter(k => k !== 'not specified').length;
  
  if (ethnicityNotSpecified > totalPapers * 0.5) {
    blindSpots.push({
      category: 'ethnicity',
      gap: `Ethnicity not specified in majority of studies (${ethnicityNotSpecified} of ${totalPapers})`,
      severity: 'high',
      affectedCount: ethnicityNotSpecified,
    });
  } else if (ethnicityCount < 2) {
    blindSpots.push({
      category: 'ethnicity',
      gap: 'Limited ethnic diversity across studies',
      severity: 'medium',
      affectedCount: totalPapers,
    });
  }

  // Check geographic diversity
  const geographicCount = Object.keys(coverage.geographic).length;
  if (geographicCount < 3) {
    blindSpots.push({
      category: 'geographic',
      gap: `Limited geographic diversity (only ${geographicCount} regions represented)`,
      severity: 'medium',
      affectedCount: totalPapers,
    });
  }

  return blindSpots;
}

/**
 * Convert counts to percentages for output
 */
function toPercentages(counts: Record<string, number>, total: number): Record<string, string> {
  const percentages: Record<string, string> = {};
  
  for (const [key, count] of Object.entries(counts)) {
    const percentage = ((count / total) * 100).toFixed(1);
    percentages[key] = `${percentage}%`;
  }
  
  return percentages;
}

/**
 * Main function: Analyze population demographics from papers
 */
export async function analyzePopulation(papers: Paper[]): Promise<PopulationAnalysisOutput> {
  console.log(`\nAnalyzing demographics from ${papers.length} papers...`);
  
  // Extract demographics from each paper
  const demographics: PaperDemographics[] = [];
  
  for (let i = 0; i < papers.length; i++) {
    console.log(`  [${i + 1}/${papers.length}] Processing: ${papers[i]?.title.substring(0, 60)}...`);
    const demo = await extractDemographics(papers[i]!);
    demographics.push(demo);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n✓ Demographic extraction completed');
  console.log('  Aggregating data...');

  // Aggregate demographics
  const coverage = aggregateDemographics(demographics);
  
  // Identify blind spots
  const blindSpots = identifyBlindSpots(coverage, papers.length);

  console.log(`✓ Analysis completed: ${blindSpots.length} blind spots identified\n`);

  // Format output
  return {
    total_papers_analyzed: papers.length,
    population_coverage: {
      age: toPercentages(coverage.age, papers.length),
      gender: toPercentages(coverage.gender, papers.length),
      ethnicity: toPercentages(coverage.ethnicity, papers.length),
      pregnancy_status: {
        pregnant: `${((coverage.pregnancy.mentioned / papers.length) * 100).toFixed(1)}%`,
        not_mentioned: `${((coverage.pregnancy.notMentioned / papers.length) * 100).toFixed(1)}%`,
      },
      geographic: toPercentages(coverage.geographic, papers.length),
    },
    blind_spots: blindSpots,
    raw_demographics: demographics,
  };
}

/**
 * Save analysis results to JSON file
 */
export async function saveAnalysisToJSON(
  data: PopulationAnalysisOutput,
  filename: string
): Promise<void> {
  const jsonContent = JSON.stringify(data, null, 2);
  await writeFile(filename, jsonContent, 'utf-8');
}

