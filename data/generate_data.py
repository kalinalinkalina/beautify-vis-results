"""Generate synthetic survey results data for the beautify-vis-results dashboard."""
import csv
import random

random.seed(42)

CHART_TYPES = ["Bar Chart", "Line Chart", "Scatter Plot", "Pie Chart", "Heatmap"]
ASPECTS = ["Color Palette", "Layout", "Typography", "Readability", "Overall Aesthetics"]
ROLES = ["Researcher", "Data Analyst", "Designer", "Developer", "Student", "Other"]
EXPERIENCE = ["< 1 year", "1-3 years", "3-5 years", "5-10 years", "> 10 years"]
TOOLS = ["Matplotlib", "Seaborn", "Plotly", "ggplot2", "Tableau", "Power BI", "D3.js"]

N = 120

rows = []
for i in range(1, N + 1):
    role = random.choice(ROLES)
    exp = random.choice(EXPERIENCE)
    primary_tool = random.choice(TOOLS)

    # Overall preference: 1=strongly prefer original, 5=strongly prefer AI version
    overall_pref = random.choices(range(1, 6), weights=[10, 15, 20, 30, 25])[0]

    # Per-chart-type AI improvement rating (1–5)
    chart_ratings = {ct: random.choices(range(1, 6), weights=[5, 10, 20, 35, 30])[0] for ct in CHART_TYPES}

    # Per-aspect AI improvement rating (1–5)
    aspect_ratings = {asp: random.choices(range(1, 6), weights=[5, 10, 25, 35, 25])[0] for asp in ASPECTS}

    # Time saved using AI (in minutes per visualization)
    time_saved = round(random.gauss(18, 8), 1)
    time_saved = max(0, min(60, time_saved))

    # Would use AI assistance again? (Yes/No/Maybe)
    reuse = random.choices(["Yes", "No", "Maybe"], weights=[60, 10, 30])[0]

    row = {
        "respondent_id": i,
        "role": role,
        "experience": exp,
        "primary_tool": primary_tool,
        "overall_preference": overall_pref,
        **{f"chart_{ct.lower().replace(' ', '_')}": chart_ratings[ct] for ct in CHART_TYPES},
        **{f"aspect_{asp.lower().replace(' ', '_')}": aspect_ratings[asp] for asp in ASPECTS},
        "time_saved_min": time_saved,
        "would_reuse_ai": reuse,
    }
    rows.append(row)

fieldnames = list(rows[0].keys())
with open("survey_results.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"Generated {N} survey responses → survey_results.csv")
