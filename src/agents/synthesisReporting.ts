import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import { writeFile } from 'fs/promises';
import { LiteratureSearchOutput } from './literatureSearch.js';
import { PopulationAnalysisOutput } from './populationAnalysis.js';

dotenv.config();

// Report sections
interface ExecutiveSummary {
  overview: string;
  criticalFindings: string[];
  keyMetrics: {
    totalPapers: number;
    blindSpotsIdentified: number;
    criticalGaps: number;
  };
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  population: string;
  rationale: string;
  suggestedStudyDesign: string;
}

export interface SynthesisReportOutput {
  disease: string;
  generatedAt: string;
  executiveSummary: ExecutiveSummary;
  literatureOverview: {
    totalPapersFound: number;
    papersAnalyzed: number;
    dateRange: string;
    sources: string[];
  };
  demographicAnalysis: PopulationAnalysisOutput;
  recommendations: Recommendation[];
  htmlReport: string;
}

/**
 * Generate executive summary using Claude
 */
async function generateExecutiveSummary(
  disease: string,
  literatureData: LiteratureSearchOutput,
  populationData: PopulationAnalysisOutput
): Promise<ExecutiveSummary> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not found in environment variables');
  }

  const blindSpotsText = populationData.blind_spots
    .map(bs => `- ${bs.severity.toUpperCase()}: ${bs.gap}`)
    .join('\n');

  const prompt = `You are a medical research analyst creating an executive summary for a research gap analysis report.

Disease/Condition: ${disease}
Papers Analyzed: ${populationData.total_papers_analyzed}
Total Literature Available: ${literatureData.total_results}

Identified Blind Spots:
${blindSpotsText}

Population Coverage Summary:
- Age Distribution: ${Object.entries(populationData.population_coverage.age).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Gender Distribution: ${Object.entries(populationData.population_coverage.gender).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Pregnancy Status: ${populationData.population_coverage.pregnancy_status.pregnant} mentioned pregnancy

Write a concise executive summary (2-3 paragraphs) that:
1. Provides an overview of the analysis and its significance
2. Highlights the most critical research gaps found
3. Emphasizes the implications for research equity and future studies

Write in professional, accessible language suitable for researchers, policymakers, and grant reviewers.`;

  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  const overview = (content.type === 'text' ? content.text.trim() : '') || 'Summary generation failed';

  const criticalFindings = populationData.blind_spots
    .filter(bs => bs.severity === 'critical' || bs.severity === 'high')
    .map(bs => bs.gap);

  return {
    overview,
    criticalFindings,
    keyMetrics: {
      totalPapers: populationData.total_papers_analyzed,
      blindSpotsIdentified: populationData.blind_spots.length,
      criticalGaps: populationData.blind_spots.filter(
        bs => bs.severity === 'critical' || bs.severity === 'high'
      ).length,
    },
  };
}

/**
 * Generate actionable recommendations using Claude
 */
async function generateRecommendations(
  disease: string,
  populationData: PopulationAnalysisOutput
): Promise<Recommendation[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not found in environment variables');
  }

  const blindSpotsText = populationData.blind_spots
    .map(bs => `- ${bs.category} (${bs.severity}): ${bs.gap}`)
    .join('\n');

  const prompt = `You are a medical research strategist. Based on the identified research gaps, provide 3-5 specific, actionable recommendations for future research.

Disease/Condition: ${disease}

Identified Research Gaps:
${blindSpotsText}

For each recommendation, provide a JSON object with:
- priority: "high", "medium", or "low"
- population: The specific demographic group that needs more research
- rationale: Why this research is important (1-2 sentences)
- suggestedStudyDesign: Recommended study type (e.g., "Prospective cohort study", "Randomized controlled trial", "Cross-sectional survey")

Return ONLY a JSON array of recommendations, no additional text:
[
  {
    "priority": "high",
    "population": "Adults over 75 with Crohn's disease",
    "rationale": "...",
    "suggestedStudyDesign": "..."
  }
]`;

  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const responseContent = message.content[0];
  let content = responseContent.type === 'text' ? responseContent.text.trim() : '';
  
  // Strip markdown code blocks if present
  content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  
  try {
    const recommendations = JSON.parse(content || '[]');
    return recommendations;
  } catch (error) {
    console.warn('Failed to parse recommendations, using defaults');
    return populationData.blind_spots
      .filter(bs => bs.severity === 'critical' || bs.severity === 'high')
      .slice(0, 3)
      .map(bs => ({
        priority: bs.severity === 'critical' ? 'high' : 'medium' as 'high' | 'medium',
        population: `Populations with gaps in ${bs.category}`,
        rationale: bs.gap,
        suggestedStudyDesign: 'Prospective cohort study or randomized controlled trial',
      }));
  }
}

/**
 * Generate HTML report with visualizations
 */
function generateHTMLReport(
  disease: string,
  literatureData: LiteratureSearchOutput,
  populationData: PopulationAnalysisOutput,
  executiveSummary: ExecutiveSummary,
  recommendations: Recommendation[]
): string {
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Prepare data for charts
  const ageData = populationData.population_coverage.age;
  const genderData = populationData.population_coverage.gender;
  const ethnicityData = populationData.population_coverage.ethnicity;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Medical Research Blind Spot Analysis: ${disease}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f7fa;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .subtitle {
            font-size: 1.2em;
            opacity: 0.9;
        }
        
        .date {
            margin-top: 10px;
            font-size: 0.9em;
            opacity: 0.8;
        }
        
        .section {
            background: white;
            padding: 30px;
            margin-bottom: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        h2 {
            color: #667eea;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
        }
        
        h3 {
            color: #764ba2;
            margin: 20px 0 10px 0;
        }
        
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        
        .metric-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        
        .metric-value {
            font-size: 2.5em;
            font-weight: bold;
            margin: 10px 0;
        }
        
        .metric-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
        
        .blind-spot {
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
            border-left: 4px solid;
        }
        
        .blind-spot.critical {
            background: #fee;
            border-color: #e53e3e;
        }
        
        .blind-spot.high {
            background: #fff3e0;
            border-color: #ff9800;
        }
        
        .blind-spot.medium {
            background: #fff9c4;
            border-color: #fbc02d;
        }
        
        .blind-spot.low {
            background: #e8f5e9;
            border-color: #4caf50;
        }
        
        .severity-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: bold;
            text-transform: uppercase;
            margin-right: 10px;
        }
        
        .severity-badge.critical { background: #e53e3e; color: white; }
        .severity-badge.high { background: #ff9800; color: white; }
        .severity-badge.medium { background: #fbc02d; color: #333; }
        .severity-badge.low { background: #4caf50; color: white; }
        
        .chart-container {
            position: relative;
            height: 300px;
            margin: 20px 0;
        }
        
        .chart-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 30px;
            margin: 30px 0;
        }
        
        .recommendation {
            background: #f8f9fa;
            padding: 20px;
            margin: 15px 0;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        
        .recommendation.high-priority {
            border-left-color: #e53e3e;
        }
        
        .recommendation.medium-priority {
            border-left-color: #ff9800;
        }
        
        .recommendation.low-priority {
            border-left-color: #4caf50;
        }
        
        .priority-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 10px;
        }
        
        .priority-badge.high { background: #e53e3e; color: white; }
        .priority-badge.medium { background: #ff9800; color: white; }
        .priority-badge.low { background: #4caf50; color: white; }
        
        footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 0.9em;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        
        th {
            background: #667eea;
            color: white;
            font-weight: bold;
        }
        
        tr:hover {
            background: #f5f5f5;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Medical Research Blind Spot Analysis</h1>
            <div class="subtitle">${disease}</div>
            <div class="date">Generated: ${generatedDate}</div>
        </header>

        <!-- Executive Summary -->
        <div class="section">
            <h2>📊 Executive Summary</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-label">Papers Analyzed</div>
                    <div class="metric-value">${executiveSummary.keyMetrics.totalPapers}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Blind Spots Identified</div>
                    <div class="metric-value">${executiveSummary.keyMetrics.blindSpotsIdentified}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Critical Gaps</div>
                    <div class="metric-value">${executiveSummary.keyMetrics.criticalGaps}</div>
                </div>
            </div>
            
            <h3>Overview</h3>
            <p>${executiveSummary.overview.split('\n').join('</p><p>')}</p>
            
            ${executiveSummary.criticalFindings.length > 0 ? `
            <h3>Critical Findings</h3>
            <ul>
                ${executiveSummary.criticalFindings.map(f => `<li>${f}</li>`).join('')}
            </ul>
            ` : ''}
        </div>

        <!-- Literature Overview -->
        <div class="section">
            <h2>📚 Literature Overview</h2>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
                <tr>
                    <td>Total Papers Found in Database</td>
                    <td>${literatureData.total_results.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Papers Retrieved for Analysis</td>
                    <td>${literatureData.papers.length}</td>
                </tr>
                <tr>
                    <td>Papers Successfully Analyzed</td>
                    <td>${populationData.total_papers_analyzed}</td>
                </tr>
                <tr>
                    <td>Primary Source</td>
                    <td>${literatureData.papers[0]?.source || 'Europe PMC'}</td>
                </tr>
            </table>
        </div>

        <!-- Demographic Analysis -->
        <div class="section">
            <h2>👥 Demographic Analysis</h2>
            
            <div class="chart-grid">
                <div>
                    <h3>Age Distribution</h3>
                    <div class="chart-container">
                        <canvas id="ageChart"></canvas>
                    </div>
                </div>
                
                <div>
                    <h3>Gender Distribution</h3>
                    <div class="chart-container">
                        <canvas id="genderChart"></canvas>
                    </div>
                </div>
            </div>
            
            <h3>Ethnicity Distribution</h3>
            <div class="chart-container">
                <canvas id="ethnicityChart"></canvas>
            </div>
            
            <h3>Pregnancy Status</h3>
            <table>
                <tr>
                    <th>Status</th>
                    <th>Percentage</th>
                </tr>
                <tr>
                    <td>Pregnancy Mentioned</td>
                    <td>${populationData.population_coverage.pregnancy_status.pregnant}</td>
                </tr>
                <tr>
                    <td>Not Mentioned</td>
                    <td>${populationData.population_coverage.pregnancy_status.not_mentioned}</td>
                </tr>
            </table>
        </div>

        <!-- Blind Spots -->
        <div class="section">
            <h2>🎯 Identified Blind Spots</h2>
            <p>The following research gaps have been identified through systematic analysis:</p>
            
            ${populationData.blind_spots.map(bs => `
                <div class="blind-spot ${bs.severity}">
                    <span class="severity-badge ${bs.severity}">${bs.severity}</span>
                    <strong>${bs.category}:</strong> ${bs.gap}
                    <br>
                    <small style="color: #666; margin-top: 5px; display: inline-block;">
                        Affects ${bs.affectedCount} of ${populationData.total_papers_analyzed} studies
                    </small>
                </div>
            `).join('')}
        </div>

        <!-- Recommendations -->
        <div class="section">
            <h2>💡 Recommendations for Future Research</h2>
            <p>Based on the identified gaps, we recommend the following research priorities:</p>
            
            ${recommendations.map((rec, idx) => `
                <div class="recommendation ${rec.priority}-priority">
                    <span class="priority-badge ${rec.priority}">${rec.priority} Priority</span>
                    <h3>Recommendation ${idx + 1}: ${rec.population}</h3>
                    <p><strong>Rationale:</strong> ${rec.rationale}</p>
                    <p><strong>Suggested Study Design:</strong> ${rec.suggestedStudyDesign}</p>
                </div>
            `).join('')}
        </div>

        <footer>
            <p>Generated by Medical Research Blind Spot Analyzer</p>
            <p>This report is based on automated analysis and should be reviewed by domain experts.</p>
        </footer>
    </div>

    <script>
        // Age Distribution Chart
        new Chart(document.getElementById('ageChart'), {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(Object.keys(ageData))},
                datasets: [{
                    label: 'Percentage of Studies',
                    data: ${JSON.stringify(Object.values(ageData).map(v => parseFloat(v)))},
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });

        // Gender Distribution Chart
        new Chart(document.getElementById('genderChart'), {
            type: 'doughnut',
            data: {
                labels: ${JSON.stringify(Object.keys(genderData))},
                datasets: [{
                    data: ${JSON.stringify(Object.values(genderData).map(v => parseFloat(v)))},
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)',
                        'rgba(255, 152, 0, 0.8)',
                        'rgba(156, 39, 176, 0.8)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        // Ethnicity Distribution Chart
        new Chart(document.getElementById('ethnicityChart'), {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(Object.keys(ethnicityData))},
                datasets: [{
                    label: 'Percentage of Studies',
                    data: ${JSON.stringify(Object.values(ethnicityData).map(v => parseFloat(v)))},
                    backgroundColor: 'rgba(118, 75, 162, 0.8)',
                    borderColor: 'rgba(118, 75, 162, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    </script>
</body>
</html>`;
}

/**
 * Main function: Generate synthesis report
 */
export async function generateSynthesisReport(
  disease: string,
  literatureData: LiteratureSearchOutput,
  populationData: PopulationAnalysisOutput
): Promise<SynthesisReportOutput> {
  console.log('\nGenerating synthesis report...');
  
  // Generate executive summary
  console.log('  - Creating executive summary...');
  const executiveSummary = await generateExecutiveSummary(
    disease,
    literatureData,
    populationData
  );
  
  // Generate recommendations
  console.log('  - Generating recommendations...');
  const recommendations = await generateRecommendations(disease, populationData);
  
  // Generate HTML report
  console.log('  - Building HTML report with visualizations...');
  const htmlReport = generateHTMLReport(
    disease,
    literatureData,
    populationData,
    executiveSummary,
    recommendations
  );
  
  console.log('✓ Synthesis report generated\n');
  
  // Extract year range from papers
  const years = literatureData.papers
    .map(p => parseInt(p.publication_date))
    .filter(y => !isNaN(y));
  const dateRange = years.length > 0 
    ? `${Math.min(...years)} - ${Math.max(...years)}`
    : 'Not available';
  
  return {
    disease,
    generatedAt: new Date().toISOString(),
    executiveSummary,
    literatureOverview: {
      totalPapersFound: literatureData.total_results,
      papersAnalyzed: populationData.total_papers_analyzed,
      dateRange,
      sources: Array.from(new Set(literatureData.papers.map(p => p.source))),
    },
    demographicAnalysis: populationData,
    recommendations,
    htmlReport,
  };
}

/**
 * Save synthesis report (JSON and HTML)
 */
export async function saveSynthesisReport(
  report: SynthesisReportOutput,
  baseFilename: string
): Promise<void> {
  // Save JSON version (without HTML to keep it clean)
  const jsonReport = {
    ...report,
    htmlReport: undefined, // Remove HTML from JSON
  };
  await writeFile(`${baseFilename}.json`, JSON.stringify(jsonReport, null, 2), 'utf-8');
  
  // Save HTML report
  await writeFile(`${baseFilename}.html`, report.htmlReport, 'utf-8');
}

