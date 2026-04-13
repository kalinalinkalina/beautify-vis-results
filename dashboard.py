import dash
from dash import dcc, html, Input, Output
import pandas as pd
import plotly.express as px
from data_cleaning import clean_teapot_data
import time

# Load and clean the data
data_path = "data/data-4-13-26.csv"
df = clean_teapot_data(data_path)

# Define columns for Human and AI acceptability
human_acceptability_cols = [
    'Acceptability_Human_Smoothing', 'Acceptability_Human_Textures', 'Acceptability_Human_CamPos',
    'Acceptability_Human_Blur', 'Acceptability_Human_Details', 'Acceptability_Human_Errors',
    'Acceptability_Human_FeatureAddition', 'Acceptability_Human_FeatureOmission', 'Acceptability_Human_Gaps',
    'Acceptability_Human_Shape', 'Acceptability_Human_Lighting', 'Acceptability_Human_BgItems',
    'Acceptability_Human_BgImage', 'Acceptability_Human_Position', 'Acceptability_Human_Color'
]
ai_acceptability_cols = [
    'Acceptability_AI_Smoothing', 'Acceptability_AI_Textures', 'Acceptability_AI_CamPos',
    'Acceptability_AI_Blur', 'Acceptability_AI_Details', 'Acceptability_AI_Errors',
    'Acceptability_AI_FeatureAddition', 'Acceptability_AI_FeatureOmission', 'Acceptability_AI_Gaps',
    'Acceptability_AI_Shape', 'Acceptability_AI_Lighting', 'Acceptability_AI_BgItems',
    'Acceptability_AI_BgImage', 'Acceptability_AI_Position', 'Acceptability_AI_Color'
]

# Map Likert scale to numerical values
likert_mapping = {
    "Never acceptable": 0, "Rarely acceptable": 1, "Sometimes acceptable": 2,
    "Often acceptable": 3, "Usually acceptable": 4, "Always acceptable": 5
}

# Prepare data for visualization
df_human_melted = df[human_acceptability_cols].melt(var_name='Feature', value_name='Acceptability_Score')
df_human_melted['Numerical_Score'] = df_human_melted['Acceptability_Score'].map(likert_mapping)
df_human_melted['Feature_Name'] = df_human_melted['Feature'].str.replace('Acceptability_Human_', '', regex=False)


human_mean_order = df_human_melted.groupby('Feature_Name')['Numerical_Score'].mean().sort_values(ascending=False).index
df_human_melted['Feature_Name'] = pd.Categorical(df_human_melted['Feature_Name'], categories=human_mean_order, ordered=True)

df_ai_melted = df[ai_acceptability_cols].melt(var_name='Feature', value_name='Acceptability_Score')
df_ai_melted['Numerical_Score'] = df_ai_melted['Acceptability_Score'].map(likert_mapping)
df_ai_melted['Feature_Name'] = df_ai_melted['Feature'].str.replace('Acceptability_AI_', '', regex=False)


df_ai_melted['Feature_Name'] = pd.Categorical(df_ai_melted['Feature_Name'], categories=human_mean_order, ordered=True)

df_human_melted['Type'] = 'Human'
df_ai_melted['Type'] = 'AI'
df_combined_melted = pd.concat([df_human_melted, df_ai_melted], ignore_index=True)

# Initialize the Dash app
app = dash.Dash(__name__)

# Layout of the dashboard
app.layout = html.Div([
    html.Div([
        html.Label("Chart Type"),
        dcc.Dropdown(
            id="chart-type",
            options=[
                {"label": "Box Plot", "value": "box"},
                {"label": "Histogram", "value": "histogram"},
                {"label": "Slope Chart", "value": "slope"}
            ],
            value="box"
        ),
        html.Label("Comparison Type"),
        dcc.Dropdown(
            id="comparison-type",
            options=[
                {"label": "Human vs AI", "value": "human_ai"},
                {"label": "Role", "value": "role"},
                {"label": "Experience", "value": "experience"},
                {"label": "Frequency", "value": "frequency"}
            ],
            value="human_ai"
        ),
        # Update the 'Sort by' dropdown options to match the notebook
        html.Label("Sort by"),
        dcc.Dropdown(
            id="sort-by",
            options=[
                {"label": "Human Mean", "value": "human_mean"},
                {"label": "AI Mean", "value": "ai_mean"},
                {"label": "Difference (Human - AI)", "value": "difference"},
                {"label": "Combined Mean", "value": "combined_mean"}
            ],
            value="human_mean"
        ),
    ]),
    html.Div([
        dcc.Graph(id="human-plot"),
        dcc.Graph(id="ai-plot")
    ])
])

# Explicitly apply the default sort order when the app is first loaded
@app.callback(
    [Output("human-plot", "figure"), Output("ai-plot", "figure")],
    [Input("chart-type", "value"), Input("comparison-type", "value"), Input("sort-by", "value")]
)
def update_plot(chart_type, comparison_type, sort_by):
    if not sort_by:
        sort_by = "human_mean"  # Default value

    # Determine the sorting order based on the 'Sort by' dropdown
    if sort_by == "human_mean":
        sort_order = df_human_melted.groupby('Feature_Name')['Numerical_Score'].mean().sort_values(ascending=False).index
    elif sort_by == "ai_mean":
        sort_order = df_ai_melted.groupby('Feature_Name')['Numerical_Score'].mean().sort_values(ascending=False).index
    elif sort_by == "difference":
        human_means = df_human_melted.groupby('Feature_Name')['Numerical_Score'].mean()
        ai_means = df_ai_melted.groupby('Feature_Name')['Numerical_Score'].mean()
        sort_order = (human_means - ai_means).sort_values(ascending=False).index
    elif sort_by == "combined_mean":
        sort_order = df_combined_melted.groupby('Feature_Name')['Numerical_Score'].mean().sort_values(ascending=False).index

    # Update the categorical order for sorting
    df_combined_melted['Feature_Name'] = pd.Categorical(
        df_combined_melted['Feature_Name'], categories=sort_order, ordered=True
    )

    # Re-sort the DataFrame based on the updated categorical order
    sorted_data = df_combined_melted.sort_values(by=["Feature_Name", "Type", "Numerical_Score"])

    if comparison_type == "human_ai":
        fig_human_ai = px.box(
            sorted_data, x="Feature_Name", y="Numerical_Score", color="Type",
            color_discrete_map={"Human": "peru", "AI": "gray"},
            title="Acceptability of Human vs AI Alterations",
            category_orders={"Feature_Name": list(sort_order), "Type": ["Human", "AI"]}  # Ensure Human appears first
        )
        fig_human_ai.update_layout(
            xaxis_title="Alteration",
            yaxis_title="Acceptability",
            yaxis=dict(
                tickmode="array",
                tickvals=[0, 1, 2, 3, 4, 5],
                ticktext=["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"]
            )
        )
        return fig_human_ai, None

    # Map comparison types to the correct column names
    comparison_column_map = {
        "role": "Vis_Role",
        "experience": "Experience",
        "frequency": "Frequency"
    }

    comparison_column = comparison_column_map.get(comparison_type, comparison_type.capitalize())

    if comparison_column not in df.columns:
        raise KeyError(f"The column '{comparison_column}' is not present in the DataFrame.")

    # Ensure the 'Feature' column is created and used consistently
    # Melt the data for Human and AI acceptability scores
    human_data = df.melt(
        id_vars=[comparison_column],
        value_vars=human_acceptability_cols,
        var_name="Feature", value_name="Acceptability_Score"
    )
    ai_data = df.melt(
        id_vars=[comparison_column],
        value_vars=ai_acceptability_cols,
        var_name="Feature", value_name="Acceptability_Score"
    )

    # Map feature names to simplified labels
    feature_rename_map = {
        **{col: col.replace("Acceptability_Human_", "") for col in human_acceptability_cols},
        **{col: col.replace("Acceptability_AI_", "") for col in ai_acceptability_cols}
    }

    human_data["Feature"] = human_data["Feature"].replace(feature_rename_map)
    ai_data["Feature"] = ai_data["Feature"].replace(feature_rename_map)

    # Apply sorting to the melted data
    human_data["Feature"] = pd.Categorical(human_data["Feature"], categories=sort_order, ordered=True)
    ai_data["Feature"] = pd.Categorical(ai_data["Feature"], categories=sort_order, ordered=True)

    # Map Acceptability_Score to numerical values for correct plotting
    human_data["Numerical_Score"] = human_data["Acceptability_Score"].map(likert_mapping)
    ai_data["Numerical_Score"] = ai_data["Acceptability_Score"].map(likert_mapping)

    # Ensure the 'Sort by' functionality works with the 'Role' comparison type
    if comparison_type == "role":

        legend_labels = {
            "Creating visualizations is the primary role I perform in my work": "Viz Practitioner",
            "I work with visualizations created by others, but I do not create or research visualization myself": "Scientist who uses vis",
            "Researching visualization methods/techniques is my primary role": "Vis Researcher",
            "I create visualizations to help me in my primary role, which is not visualization-related": "Scientist who creates vis"
        }
        legend_colors = {
            "Vis Researcher": 'red',
            "Viz Practitioner": 'orange',
            "Scientist who creates vis": 'blue',
            "Scientist who uses vis": 'green'
        }
        legend_order = ["Vis Researcher", "Viz Practitioner", "Scientist who creates vis", "Scientist who uses vis"]

        # Replace and categorize the 'Vis_Role' column
        human_data[comparison_column] = human_data[comparison_column].replace(legend_labels)
        ai_data[comparison_column] = ai_data[comparison_column].replace(legend_labels)

        human_data[comparison_column] = pd.Categorical(human_data[comparison_column], categories=legend_order, ordered=True)
        ai_data[comparison_column] = pd.Categorical(ai_data[comparison_column], categories=legend_order, ordered=True)

        # Apply the sort order to the 'Feature' column consistently
        human_data['Feature'] = pd.Categorical(human_data['Feature'], categories=sort_order, ordered=True)
        ai_data['Feature'] = pd.Categorical(ai_data['Feature'], categories=sort_order, ordered=True)

        # Ensure the sort order is applied correctly for the 'Role' comparison type
        if comparison_type == "role":
            # Apply the sort order to the 'Feature' column
            human_data["Feature"] = pd.Categorical(human_data["Feature"], categories=sort_order, ordered=True)
            ai_data["Feature"] = pd.Categorical(ai_data["Feature"], categories=sort_order, ordered=True)


    # Create Human chart (use numerical values for y)
    human_fig = px.box(
        human_data, x="Feature", y="Numerical_Score", color=comparison_column,
        title="Human Acceptability Scores",
        color_discrete_map=legend_colors if comparison_type == "role" else None,
        category_orders={"Feature": list(sort_order), comparison_column: legend_order} if comparison_type == "role" else {"Feature": list(sort_order)}
    )

    # Create AI chart (use numerical values for y)
    ai_fig = px.box(
        ai_data, x="Feature", y="Numerical_Score", color=comparison_column,
        title="AI Acceptability Scores",
        color_discrete_map=legend_colors if comparison_type == "role" else None,
        category_orders={"Feature": list(sort_order), comparison_column: legend_order} if comparison_type == "role" else {"Feature": list(sort_order)}
    )

    # Update axis labels and y-axis ticks for all charts
    human_fig.update_layout(
        xaxis_title="Alteration",
        yaxis_title="Acceptability",
        yaxis=dict(
            tickmode="array",
            tickvals=[0, 1, 2, 3, 4, 5],
            ticktext=["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"]
        )
    )
    ai_fig.update_layout(
        xaxis_title="Alteration",
        yaxis_title="Acceptability",
        yaxis=dict(
            tickmode="array",
            tickvals=[0, 1, 2, 3, 4, 5],
            ticktext=["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"]
        )
    )

    # Add a unique identifier to the chart data
    human_fig.update_layout(title=f"Human Acceptability Scores - {time.time()}")
    ai_fig.update_layout(title=f"AI Acceptability Scores - {time.time()}")


    # Ensure the callback returns the correct figures
    return human_fig, ai_fig

# Run the app
if __name__ == "__main__":
    app.run(debug=True)