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

# Define group orders for each comparison type based on actual CSV values
group_orders = {
    "experience": [
        "Less than 1 year",
        "1-3 years",
        "3-5 years",
        "5-10 years",
        "10-20 years",
        "More than 20 years"
    ],
    "frequency_vis": [
        "Less than once a year",
        "Annually",
        "Monthly",
        "Weekly",
        "Daily"
    ],
    "frequency_public": [
        "Never",
        "Rarely",
        "Occasionally",
        "Frequently",
        "This is a primary part of my work"
    ],
    "age": [
        "18-24", "25-34", "35-44", "45-54", "55-64", "65+"
    ],
    "tool_use": [
        "Yes", "No", "Maybe"
    ]
}

# Viridis_r palette (green-to-purple, reversed) as in seaborn color_palette('viridis_r', N)
# 6-color palette for 6-group (experience, age), 5-color for 5-group (frequency_vis, frequency_public)

# Resample the viridis_r colormap for 6 and 5 colors, evenly spaced from green to dark purple
# These values are evenly spaced from the viridis_r colormap (using e.g. sns.color_palette('viridis_r', 6))
viridis_r_6 = [
    "#5ec962",  # green
    "#3fbc73",  # light teal
    "#21918c",  # teal
    "#31688e",  # blueish
    "#443983",  # purple
    "#440154"   # dark purple
]
viridis_r_5 = [
    "#5ec962",  # green
    "#27ad81",  # teal
    "#21918c",  # teal/blue
    "#3b528b",  # blue/purple
    "#440154"   # dark purple
]

# Assign colors to group values in the correct order
experience_colors = dict(zip(group_orders["experience"], viridis_r_6))
frequency_vis_colors = dict(zip(group_orders["frequency_vis"], viridis_r_5))
# For frequency_public, set 'Never' to desaturated red, rest use viridis
frequency_public_colors = dict(zip(group_orders["frequency_public"], viridis_r_5))
frequency_public_colors["Never"] = "#e07b7b"  # desaturated red
age_colors = dict(zip(group_orders["age"], viridis_r_6))
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
                {"label": "Line Chart of Means", "value": "line"},
                {"label": "Dumbbell Plot (Not implemented)", "value": "dumbbell"},
                {"label": "Slope Chart (Not implemented)", "value": "slope"},
                {"label": "Swarm Chart (Not implemented)", "value": "swarm"}
            ],
            value="box"
        ),
        html.Label("Comparison Type"),
        dcc.Dropdown(
            id="comparison-type",
            options=[
                {"label": "Human vs AI", "value": "human_ai"},
                {"label": "Role", "value": "role"},
                {"label": "Years of Vis Experience", "value": "experience"},
                {"label": "Frequency of Visualization", "value": "frequency_vis"},
                {"label": "Frequency of Vis for Public Communication", "value": "frequency_public"},
                {"label": "Domain", "value": "domain"},
                {"label": "Age", "value": "age"},
                {"label": "Would use an AI tool for beautification", "value": "tool_use"},
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
                {"label": "Difference in Mean (Human - AI)", "value": "difference"},
                {"label": "Human Median", "value": "human_median"},
                {"label": "AI Median", "value": "ai_median"},
                {"label": "Difference in Median (Human - AI)", "value": "difference_median"}
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
    # Legend definitions for role-based plots (always needed for line chart logic)
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
    elif sort_by == "human_median":
        sort_order = df_human_melted.groupby('Feature_Name')['Numerical_Score'].median().sort_values(ascending=False).index
    elif sort_by == "ai_median":
        sort_order = df_ai_melted.groupby('Feature_Name')['Numerical_Score'].median().sort_values(ascending=False).index
    elif sort_by == "difference_median":
        human_medians = df_human_melted.groupby('Feature_Name')['Numerical_Score'].median()
        ai_medians = df_ai_melted.groupby('Feature_Name')['Numerical_Score'].median()
        sort_order = (human_medians - ai_medians).sort_values(ascending=False).index

    # Update the categorical order for sorting
    df_combined_melted['Feature_Name'] = pd.Categorical(
        df_combined_melted['Feature_Name'], categories=sort_order, ordered=True
    )

    # Re-sort the DataFrame based on the updated categorical order
    sorted_data = df_combined_melted.sort_values(by=["Feature_Name", "Type", "Numerical_Score"])


    # --- Early return for human_ai chart types to avoid KeyError ---
    if comparison_type == "human_ai":
        if chart_type == "box":
            fig_human_ai = px.box(
                sorted_data, x="Feature_Name", y="Numerical_Score", color="Type",
                color_discrete_map={"Human": "peru", "AI": "gray"},
                title="Acceptability of Human vs AI Alterations",
                category_orders={"Feature_Name": list(sort_order), "Type": ["Human", "AI"]}
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
        elif chart_type == "line":
            import plotly.graph_objects as go
            feature_order = list(sort_order)
            # Calculate means for each feature for Human and AI
            human_means = df_human_melted.groupby('Feature_Name')['Numerical_Score'].mean().reindex(feature_order)
            ai_means = df_ai_melted.groupby('Feature_Name')['Numerical_Score'].mean().reindex(feature_order)
            fig = go.Figure()
            # Human: filled brown circle
            fig.add_trace(go.Scatter(
                x=feature_order,
                y=human_means,
                mode="lines+markers",
                name="Human",
                marker=dict(symbol="circle", color="peru", size=8, line=dict(width=0)),
                line=dict(color="peru", width=2)
            ))
            # AI: outlined gray circle
            fig.add_trace(go.Scatter(
                x=feature_order,
                y=ai_means,
                mode="lines+markers",
                name="AI",
                marker=dict(symbol="circle-open", color="gray", size=8, line=dict(width=2, color="gray")),
                line=dict(color="gray", width=2)
            ))
            fig.update_layout(
                title="Mean Acceptability Scores by Feature (Human vs AI)",
                xaxis_title="Feature",
                yaxis_title="Mean Acceptability Score (0-5 scale)",
                xaxis=dict(tickmode="array", tickvals=feature_order, tickangle=0),
                yaxis=dict(
                    tickmode="array",
                    tickvals=[0,1,2,3,4,5],
                    ticktext=["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"],
                    range=[-0.5, 5.5]
                ),
                legend_title="Type",
                height=500,
                margin=dict(r=180),
            )
            return fig, None
        # For now, just return None for the second plot if not box or line
        return None, None


    # Map comparison types to the correct column names
    comparison_column_map = {
        "role": "Vis_Role",
        "experience": "Vis_Length",
        "frequency_vis": "Vis_Frequency",
        "frequency_public": "Public_Frequency",
        "domain": "Domains",
        "age": "Age",
        "tool_use": "Tool_use"
    }

    comparison_column = comparison_column_map.get(comparison_type, comparison_type.capitalize())

    if comparison_type == "human_ai":
        if chart_type == "box":
            fig_human_ai = px.box(
                sorted_data, x="Feature_Name", y="Numerical_Score", color="Type",
                color_discrete_map={"Human": "peru", "AI": "gray"},
                title="Acceptability of Human vs AI Alterations",
                category_orders={"Feature_Name": list(sort_order), "Type": ["Human", "AI"]}
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
        # You can add a line chart for human_ai here if needed in the future
        # For now, just return None for the second plot
        return None, None

    if comparison_column not in df.columns:
        raise KeyError(f"The column '{comparison_column}' is not present in the DataFrame.")


    # Always preprocess Domains column if comparison_type is domain (for both box and line)
    if comparison_type == "domain":
        # Work on a copy to avoid side effects
        df_domain = df.copy()
        # Convert lists to comma-separated strings if any
        df_domain[comparison_column] = df_domain[comparison_column].apply(lambda x: ','.join(x) if isinstance(x, list) else str(x))
        # Split and explode
        df_domain[comparison_column] = df_domain[comparison_column].str.split(',')
        df_domain = df_domain.explode(comparison_column)
        df_domain.dropna(subset=[comparison_column], inplace=True)
        df_domain[comparison_column] = df_domain[comparison_column].apply(lambda x: x.strip() if isinstance(x, str) else str(x))
        df_domain = df_domain[df_domain[comparison_column].apply(lambda x: isinstance(x, str) and x and x.lower() != 'nan')]
        df_domain[comparison_column] = df_domain[comparison_column].astype(str)
        # Now melt as usual
        human_data = df_domain.melt(
            id_vars=[comparison_column],
            value_vars=human_acceptability_cols,
            var_name="Feature", value_name="Acceptability_Score"
        )
        ai_data = df_domain.melt(
            id_vars=[comparison_column],
            value_vars=ai_acceptability_cols,
            var_name="Feature", value_name="Acceptability_Score"
        )
    else:
        # Default: melt as before
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
    # --- Special handling for Domains: only explode before melting for boxplot, not after ---
    # Map Acceptability_Score to numerical values for correct plotting (needed for line chart means)
    human_data["Numerical_Score"] = human_data["Acceptability_Score"].map(likert_mapping)
    ai_data["Numerical_Score"] = ai_data["Acceptability_Score"].map(likert_mapping)

    # --- Line Chart of Means for all comparison types except human_ai ---
    if chart_type == "line":
        import plotly.graph_objects as go
        feature_order = list(sort_order)
        if comparison_type == "role":
            # ...existing code for role (untouched)...
            vis_role_categories = {
                "Creating visualizations is the primary role I perform in my work": "Viz Practitioner",
                "I work with visualizations created by others, but I do not create or research visualization myself": "Scientist who uses vis",
                "Researching visualization methods/techniques is my primary role": "Vis Researcher",
                "I create visualizations to help me in my primary role, which is not visualization-related": "Scientist who creates vis"
            }
            all_role_mean_scores = []
            for full_role_name, display_role_name in vis_role_categories.items():
                df_role = df[df['Vis_Role'] == full_role_name].copy()
                if not df_role.empty:
                    for i in range(len(human_acceptability_cols)):
                        human_col_name = human_acceptability_cols[i]
                        ai_col_name = ai_acceptability_cols[i]
                        feature_name = human_col_name.split('_')[-1]
                        temp_df_role_feature = df_role[[human_col_name, ai_col_name]].dropna().copy()
                        temp_df_role_feature['Human_Score'] = temp_df_role_feature[human_col_name].map(likert_mapping)
                        temp_df_role_feature['AI_Score'] = temp_df_role_feature[ai_col_name].map(likert_mapping)
                        temp_df_role_feature.dropna(subset=['Human_Score', 'AI_Score'], inplace=True)
                        if not temp_df_role_feature.empty:
                            mean_human = temp_df_role_feature['Human_Score'].mean()
                            mean_ai = temp_df_role_feature['AI_Score'].mean()
                            all_role_mean_scores.append({
                                'Feature': feature_name,
                                'Role': display_role_name,
                                'Type': 'Human',
                                'Mean_Score': mean_human
                            })
                            all_role_mean_scores.append({
                                'Feature': feature_name,
                                'Role': display_role_name,
                                'Type': 'AI',
                                'Mean_Score': mean_ai
                            })
            df_roles_means = pd.DataFrame(all_role_mean_scores)
            role_markers = {
                "Vis Researcher": "circle",
                "Viz Practitioner": "circle",
                "Scientist who creates vis": "square",
                "Scientist who uses vis": "square"
            }
            fig_human = go.Figure()
            for role in legend_order:
                role_data = df_roles_means[(df_roles_means['Role'] == role) & (df_roles_means['Type'] == 'Human')]
                y_vals = [role_data[role_data['Feature'] == f]['Mean_Score'].iloc[0] if not role_data[role_data['Feature'] == f].empty else None for f in feature_order]
                fig_human.add_trace(go.Scatter(
                    x=feature_order,
                    y=y_vals,
                    mode="lines+markers",
                    name=role,
                    marker=dict(symbol=role_markers[role], color=legend_colors[role], size=8),
                    line=dict(color=legend_colors[role], width=2)
                ))
            fig_human.update_layout(
                title="Mean Human Acceptability Scores by Feature and Visualization Role",
                xaxis_title="Feature",
                yaxis_title="Mean Acceptability Score (0-5 scale)",
                xaxis=dict(tickmode="array", tickvals=feature_order, tickangle=0),
                yaxis=dict(
                    tickmode="array",
                    tickvals=[0,1,2,3,4,5],
                    ticktext=["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"],
                    range=[-0.5, 5.5]
                ),
                legend_title="Visualization Role",
                height=500,
                margin=dict(r=180),
            )
            fig_ai = go.Figure()
            for role in legend_order:
                role_data = df_roles_means[(df_roles_means['Role'] == role) & (df_roles_means['Type'] == 'AI')]
                y_vals = [role_data[role_data['Feature'] == f]['Mean_Score'].iloc[0] if not role_data[role_data['Feature'] == f].empty else None for f in feature_order]
                fig_ai.add_trace(go.Scatter(
                    x=feature_order,
                    y=y_vals,
                    mode="lines+markers",
                    name=role,
                    marker=dict(symbol=role_markers[role]+"-open", color=legend_colors[role], size=8, line=dict(width=2)),
                    line=dict(color=legend_colors[role], width=2)
                ))
            fig_ai.update_layout(
                title="Mean AI Acceptability Scores by Feature and Visualization Role",
                xaxis_title="Feature",
                yaxis_title="Mean Acceptability Score (0-5 scale)",
                xaxis=dict(tickmode="array", tickvals=feature_order, tickangle=0),
                yaxis=dict(
                    tickmode="array",
                    tickvals=[0,1,2,3,4,5],
                    ticktext=["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"],
                    range=[-0.5, 5.5]
                ),
                legend_title="Visualization Role",
                height=500,
                margin=dict(r=180),
            )
            return fig_human, fig_ai
        else:
            # For all other comparison types (except human_ai), robustly handle group-feature combos and types
            group_col = comparison_column
            # Define group orders for each comparison type (match notebook)
            # Special handling for Domain (multi-select, comma-separated)
            if comparison_type == "domain":
                # Ensure Domains column is always a string (never a list)
                human_data[group_col] = human_data[group_col].apply(lambda x: ','.join(x) if isinstance(x, list) else str(x))
                ai_data[group_col] = ai_data[group_col].apply(lambda x: ','.join(x) if isinstance(x, list) else str(x))
                # Extract all unique domains
                all_domains = human_data[group_col].astype(str).str.split(',', expand=True).stack().str.strip()
                domain_categories = all_domains.unique().tolist()
                # Filter out non-string values and NaN/None
                domain_categories = [d for d in domain_categories if isinstance(d, str) and d and d.lower() != 'nan']
                domain_categories.sort()
                # Assign colors (repeat/cycle if needed)
                palette = px.colors.qualitative.Plotly
                legend_colors = {d: palette[i % len(palette)] for i, d in enumerate(domain_categories)}
                group_values = domain_categories
                # Feature renaming
                feature_rename_map = {
                    **{col: col.replace("Acceptability_Human_", "") for col in human_acceptability_cols},
                    **{col: col.replace("Acceptability_AI_", "") for col in ai_acceptability_cols}
                }
                human_data["Feature"] = human_data["Feature"].replace(feature_rename_map)
                ai_data["Feature"] = ai_data["Feature"].replace(feature_rename_map)
                human_data["Feature"] = pd.Categorical(human_data["Feature"], categories=feature_order, ordered=True)
                ai_data["Feature"] = pd.Categorical(ai_data["Feature"], categories=feature_order, ordered=True)
                # Plot for each domain
                fig_human = go.Figure()
                import re
                for domain in group_values:
                    # Escape domain string for literal matching in regex
                    domain_pattern = re.escape(domain)
                    mask = human_data[group_col].astype(str).str.contains(domain_pattern, na=False, regex=True)
                    group_df = human_data[mask]
                    if group_df.empty:
                        continue
                    means = group_df.groupby("Feature")["Numerical_Score"].mean().reindex(feature_order)
                    fig_human.add_trace(go.Scatter(
                        x=feature_order,
                        y=means,
                        mode='lines+markers',
                        name=str(domain),
                        line=dict(color=legend_colors.get(domain, None), width=2),
                        marker=dict(size=8)
                    ))
                fig_human.update_layout(
                    title=f"Mean Human Acceptability Scores by Feature and Domain",
                    xaxis_title="Feature",
                    yaxis_title="Mean Acceptability Score (0-5 scale)",
                    xaxis=dict(tickmode="array", tickvals=feature_order, tickangle=0),
                    yaxis=dict(
                        tickmode="array",
                        tickvals=[0,1,2,3,4,5],
                        ticktext=["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"],
                        range=[-0.5, 5.5]
                    ),
                    legend_title="Domain",
                    height=500,
                    margin=dict(r=180),
                )
                fig_ai = go.Figure()
                for domain in group_values:
                    domain_pattern = re.escape(domain)
                    mask = ai_data[group_col].astype(str).str.contains(domain_pattern, na=False, regex=True)
                    group_df = ai_data[mask]
                    if group_df.empty:
                        continue
                    means = group_df.groupby("Feature")["Numerical_Score"].mean().reindex(feature_order)
                    fig_ai.add_trace(go.Scatter(
                        x=feature_order,
                        y=means,
                        mode='lines+markers',
                        name=str(domain),
                        line=dict(color=legend_colors.get(domain, None), width=2),
                        marker=dict(size=8, symbol="circle-open")
                    ))
                fig_ai.update_layout(
                    title=f"Mean AI Acceptability Scores by Feature and Domain",
                    xaxis_title="Feature",
                    yaxis_title="Mean Acceptability Score (0-5 scale)",
                    xaxis=dict(tickmode="array", tickvals=feature_order, tickangle=0),
                    yaxis=dict(
                        tickmode="array",
                        tickvals=[0,1,2,3,4,5],
                        ticktext=["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"],
                        range=[-0.5, 5.5]
                    ),
                    legend_title="Domain",
                    height=500,
                    margin=dict(r=180),
                )
                return fig_human, fig_ai
            # Default: all other group types
            # Assign viridis_r colormaps for specific groupings
            if comparison_type == "experience":
                legend_colors = experience_colors
            elif comparison_type == "frequency_vis":
                legend_colors = frequency_vis_colors
            elif comparison_type == "frequency_public":
                legend_colors = frequency_public_colors
            elif comparison_type == "age":
                legend_colors = age_colors
            else:
                legend_colors = {
                    "Never": 'gray',
                    "Rarely": 'blue',
                    "Sometimes": 'green',
                    "Often": 'orange',
                    "Always": 'red',
                }
            # Ensure group_col is always a string (never a list)
            human_data[group_col] = human_data[group_col].apply(lambda x: ','.join(x) if isinstance(x, list) else str(x))
            ai_data[group_col] = ai_data[group_col].apply(lambda x: ','.join(x) if isinstance(x, list) else str(x))
            group_order = group_orders.get(comparison_type, None)
            if group_order is not None:
                group_values = [g for g in group_order if g in human_data[group_col].unique()]
            else:
                group_values = [g for g in human_data[group_col].dropna().unique()]
            feature_rename_map = {
                **{col: col.replace("Acceptability_Human_", "") for col in human_acceptability_cols},
                **{col: col.replace("Acceptability_AI_", "") for col in ai_acceptability_cols}
            }
            human_data["Feature"] = human_data["Feature"].replace(feature_rename_map)
            ai_data["Feature"] = ai_data["Feature"].replace(feature_rename_map)
            human_data["Feature"] = pd.Categorical(human_data["Feature"], categories=feature_order, ordered=True)
            ai_data["Feature"] = pd.Categorical(ai_data["Feature"], categories=feature_order, ordered=True)

            fig_human = go.Figure()
            for group in group_values:
                group_df = human_data[human_data[group_col] == group]
                if group_df.empty:
                    continue
                means = group_df.groupby("Feature")["Numerical_Score"].mean().reindex(feature_order)
                marker_symbol = "x" if (comparison_type == "frequency_public" and group == "Never") else "circle"
                fig_human.add_trace(go.Scatter(
                    x=feature_order,
                    y=means,
                    mode='lines+markers',
                    name=str(group),
                    line=dict(color=legend_colors.get(group, None), width=2),
                    marker=dict(size=8, symbol=marker_symbol)
                ))
            fig_human.update_layout(
                title=f"Mean Human Acceptability Scores by Feature and {group_col}",
                xaxis_title="Feature",
                yaxis_title="Mean Acceptability Score (0-5 scale)",
                xaxis=dict(tickmode="array", tickvals=feature_order, tickangle=0),
                yaxis=dict(
                    tickmode="array",
                    tickvals=[0,1,2,3,4,5],
                    ticktext=["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"],
                    range=[-0.5, 5.5]
                ),
                legend_title=group_col,
                height=500,
                margin=dict(r=180),
            )
            fig_ai = go.Figure()
            for group in group_values:
                group_df = ai_data[ai_data[group_col] == group]
                if group_df.empty:
                    continue
                means = group_df.groupby("Feature")["Numerical_Score"].mean().reindex(feature_order)
                marker_symbol = "x-open" if (comparison_type == "frequency_public" and group == "Never") else "circle-open"
                fig_ai.add_trace(go.Scatter(
                    x=feature_order,
                    y=means,
                    mode='lines+markers',
                    name=str(group),
                    line=dict(color=legend_colors.get(group, None), width=2),
                    marker=dict(size=8, symbol=marker_symbol)
                ))
            fig_ai.update_layout(
                title=f"Mean AI Acceptability Scores by Feature and {group_col}",
                xaxis_title="Feature",
                yaxis_title="Mean Acceptability Score (0-5 scale)",
                xaxis=dict(tickmode="array", tickvals=feature_order, tickangle=0),
                yaxis=dict(
                    tickmode="array",
                    tickvals=[0,1,2,3,4,5],
                    ticktext=["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"],
                    range=[-0.5, 5.5]
                ),
                legend_title=group_col,
                height=500,
                margin=dict(r=180),
            )
            return fig_human, fig_ai

    # Map comparison types to the correct column names
    comparison_column_map = {
        "role": "Vis_Role",
        "experience": "Vis_Length",
        "frequency_vis": "Vis_Frequency",
        "frequency_public": "Public_Frequency",
        "domain": "Domains",
        "age": "Age",
        "tool_use": "Tool_use"
    }

    comparison_column = comparison_column_map.get(comparison_type, comparison_type.capitalize())

    if comparison_column not in df.columns:
        raise KeyError(f"The column '{comparison_column}' is not present in the DataFrame.")

    # For domain, always explode lists before melting
    if comparison_type == "domain":
        df_exploded = df.copy()
        df_exploded[comparison_column] = df_exploded[comparison_column].apply(lambda x: ','.join(x) if isinstance(x, list) else str(x))
        df_exploded[comparison_column] = df_exploded[comparison_column].str.split(',')
        df_exploded = df_exploded.explode(comparison_column)
        df_exploded.dropna(subset=[comparison_column], inplace=True)
        df_exploded[comparison_column] = df_exploded[comparison_column].apply(lambda x: x.strip() if isinstance(x, str) else str(x))
        df_exploded = df_exploded[df_exploded[comparison_column].apply(lambda x: isinstance(x, str) and x and x.lower() != 'nan')]
        df_exploded[comparison_column] = df_exploded[comparison_column].astype(str)
        human_data = df_exploded.melt(
            id_vars=[comparison_column],
            value_vars=human_acceptability_cols,
            var_name="Feature", value_name="Acceptability_Score"
        )
        ai_data = df_exploded.melt(
            id_vars=[comparison_column],
            value_vars=ai_acceptability_cols,
            var_name="Feature", value_name="Acceptability_Score"
        )
    else:
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



    # Determine color map and order for all group types
    group_order = group_orders.get(comparison_type, None)
    if comparison_type == "experience":
        legend_colors = experience_colors
    elif comparison_type == "frequency_vis":
        legend_colors = frequency_vis_colors
    elif comparison_type == "frequency_public":
        legend_colors = frequency_public_colors
    elif comparison_type == "age":
        legend_colors = age_colors
    elif comparison_type == "role":
        legend_colors = {
            "Vis Researcher": 'red',
            "Viz Practitioner": 'orange',
            "Scientist who creates vis": 'blue',
            "Scientist who uses vis": 'green'
        }
    else:
        legend_colors = None

    # Set up category orders for all group types
    if group_order is not None:
        human_data[comparison_column] = pd.Categorical(human_data[comparison_column], categories=group_order, ordered=True)
        ai_data[comparison_column] = pd.Categorical(ai_data[comparison_column], categories=group_order, ordered=True)
        category_orders = {"Feature": list(sort_order), comparison_column: group_order}
    elif comparison_type == "role":
        category_orders = {"Feature": list(sort_order), comparison_column: legend_order}
    else:
        category_orders = {"Feature": list(sort_order)}

    # Create Human chart (use numerical values for y)
    human_fig = px.box(
        human_data, x="Feature", y="Numerical_Score", color=comparison_column,
        title="Human Acceptability",
        color_discrete_map=legend_colors,
        category_orders=category_orders
    )

    # Create AI chart (use numerical values for y)
    ai_fig = px.box(
        ai_data, x="Feature", y="Numerical_Score", color=comparison_column,
        title="AI Acceptability",
        color_discrete_map=legend_colors,
        category_orders=category_orders
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
    human_fig.update_layout(title=f"Human Acceptability")
    ai_fig.update_layout(title=f"AI Acceptability")


    # Ensure the callback returns the correct figures
    return human_fig, ai_fig

# Run the app
if __name__ == "__main__":
    app.run(debug=True)