# beautify-vis-results
May A(I) Beautify Your Visualization? Survey Results

## Interactive Dashboard

An interactive Plotly Dash dashboard for exploring survey results on AI-assisted visualization beautification.

### Features

- **KPI cards** – respondent count, average AI preference score, reuse intent, and time saved
- **Overall Preference** – bar chart showing how respondents rated AI vs. original visualizations
- **Would Reuse AI?** – donut chart of reuse intent
- **Chart-type ratings** – bar chart comparing AI improvement ratings across chart types (Bar, Line, Scatter, Pie, Heatmap)
- **Aesthetic aspect radar** – spider chart of AI improvement per aesthetic dimension (color, layout, typography, readability, overall aesthetics)
- **Time saved histogram** – distribution of minutes saved per visualization
- **Role × preference box plot** – AI preference scores broken down by respondent role
- **Role × aspect heatmap** – average aspect ratings by role
- **Interactive filters** – filter all charts simultaneously by Role, Primary Tool, and Experience level

### Getting Started

```bash
# Install dependencies
pip install -r requirements.txt

# Run the dashboard
python app.py
```

Then open <http://127.0.0.1:8050/> in your browser.

### Data

Survey data is located in `data/survey_results.csv`.  
To regenerate or customise the synthetic dataset:

```bash
cd data
python generate_data.py
```

### Project Structure

```
.
├── app.py                  # Plotly Dash application
├── requirements.txt        # Python dependencies
└── data/
    ├── generate_data.py    # Script to (re)generate survey data
    └── survey_results.csv  # Survey results dataset
```
