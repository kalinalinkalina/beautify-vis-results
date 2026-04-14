# Human-readable feature name mapping
FEATURE_LABELS = {
    "CamPos": "Camera Position",
    "Smoothing": "Smoothing",
    "Lighting": "Lighting",
    "Color": "Color Remapping",
    "Errors": "Removing Errors",
    "Details": "Enhancing Details",
    "Textures": "Adding Textures",
    "BgImage": "Background Image",
    "Blur": "Camera Focus/Blur",
    "BgItems": "Background Items",
    "Gaps": "Filling in Gaps",
    "Position": "Changing Positions",
    "FeatureOmission": "Feature Omission",
    "FeatureAddition": "Feature Addition",
    "Shape": "Changing Shape"
}
# --- Modular chart generation functions ---
import plotly.graph_objects as go

def make_box_plot(data, x, y, color, title, color_discrete_map=None, category_orders=None, xaxis_title=None, yaxis_title=None):
    fig = px.box(
        data, x=x, y=y, color=color,
        title=title,
        color_discrete_map=color_discrete_map,
        category_orders=category_orders
    )
    # Map x-tick labels to human-readable if possible
    x_vals = data[x].cat.categories if hasattr(data[x], 'cat') else data[x].unique()
    x_ticktext = [FEATURE_LABELS.get(str(val).replace("Acceptability_Human_","").replace("Acceptability_AI_","").replace(" ",""), val) for val in x_vals]
    fig.update_layout(
        xaxis_title="Alteration",
        yaxis_title="Acceptability",
        xaxis=dict(
            tickangle=30,
            tickvals=x_vals,
            ticktext=x_ticktext
        ),
        yaxis=dict(
            tickmode="array",
            tickvals=[0, 1, 2, 3, 4, 5],
            ticktext=["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"]
        )
    )
    return fig

def make_line_chart(mean_scores_dict, feature_order, legend_colors, legend_order, title, legend_title, marker_symbols=None):
    fig = go.Figure()
    for group in legend_order:
        group_data = mean_scores_dict.get(group, None)
        if group_data is None:
            continue
        y_vals = [group_data.get(f, None) for f in feature_order]
        marker_dict = dict(size=8)
        if marker_symbols and group in marker_symbols:
            marker_dict["symbol"] = marker_symbols[group]
        fig.add_trace(go.Scatter(
            x=feature_order,
            y=y_vals,
            mode="lines+markers",
            name=str(group),
            line=dict(color=legend_colors.get(group, None), width=2),
            marker=marker_dict
        ))
    x_ticktext = [FEATURE_LABELS.get(str(val).replace("Acceptability_Human_","").replace("Acceptability_AI_","").replace(" ",""), val) for val in feature_order]
    fig.update_layout(
        title=title,
        xaxis_title="Alteration",
        yaxis_title="Acceptability",
        xaxis=dict(tickmode="array", tickvals=feature_order, tickangle=30, ticktext=x_ticktext),
        yaxis=dict(
            tickmode="array",
            tickvals=[0,1,2,3,4,5],
            ticktext=["Never (0)", "Rarely (1)", "Sometimes (2)", "Often (3)", "Usually (4)", "Always (5)"],
            range=[-0.5, 5.5]
        ),
        legend_title=legend_title,
        height=500,
        margin=dict(r=180),
    )
    return fig
import dash
from dash import dcc, html, Input, Output
import pandas as pd
from data_cleaning import melt_and_map_acceptability, get_feature_sort_order, get_group_legend_info
from group_counts_util import get_group_counts
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



# Centralized melting and mapping for Human and AI
df_human_melted = melt_and_map_acceptability(
    df,
    human_acceptability_cols,
    likert_mapping,
    feature_prefix='Acceptability_Human_'
)
df_ai_melted = melt_and_map_acceptability(
    df,
    ai_acceptability_cols,
    likert_mapping,
    feature_prefix='Acceptability_AI_'
)

human_mean_order = df_human_melted.groupby('Feature_Name')['Numerical_Score'].mean().sort_values(ascending=False).index
df_human_melted['Feature_Name'] = pd.Categorical(df_human_melted['Feature_Name'], categories=human_mean_order, ordered=True)
df_ai_melted['Feature_Name'] = pd.Categorical(df_ai_melted['Feature_Name'], categories=human_mean_order, ordered=True)
df_human_melted['Type'] = 'Human'
df_ai_melted['Type'] = 'AI'
df_combined_melted = pd.concat([df_human_melted, df_ai_melted], ignore_index=True)


# Initialize the Dash app
app = dash.Dash(__name__)

"""
Custom CSS for improved design is loaded from assets/custom.css.
Dash automatically serves files in the /assets directory.
"""
# Layout of the dashboard
app.layout = html.Div([
    html.H1("May A(I) Beautify Your Visualization?", style={"textAlign": "center", "marginBottom": "32px"}),
    html.Div([
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
                value="box",
                searchable=False
            )
        ], style={"flex": "1", "minWidth": "220px", "marginRight": "16px"}),
        html.Div([
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
                value="human_ai",
                searchable=False
            )
        ], style={"flex": "1", "minWidth": "220px", "marginRight": "16px"}),
        html.Div([
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
                value="human_mean",
                searchable=False
            )
        ], style={"flex": "1", "minWidth": "220px"})
    ], style={"display": "flex", "flexDirection": "row", "alignItems": "flex-end", "marginBottom": "24px"}),
    html.Div([
        dcc.Graph(id="human-plot"),
        dcc.Graph(id="ai-plot", style={"display": "block"})
    ], id="plots-container")
])

# Explicitly apply the default sort order when the app is first loaded
from dash.dependencies import State

@app.callback(
    [Output("human-plot", "figure"), Output("ai-plot", "figure"), Output("ai-plot", "style")],
    [Input("chart-type", "value"), Input("comparison-type", "value"), Input("sort-by", "value")]
)
def update_plot(chart_type, comparison_type, sort_by, custom_marker_symbols=None):
    # Centralized legend/group info
    legend_labels, legend_colors, legend_order = get_group_legend_info(comparison_type)

    # For domain, dynamically compute legend_order from unique exploded values
    if comparison_type == "domain":
        from data_cleaning import preprocess_domains_column
        df_domain = preprocess_domains_column(df, domains_col="Domains")
        unique_domains = df_domain["Domains"].dropna().unique().tolist()
        legend_order = sorted(unique_domains)

    # Map comparison types to the correct column names (needed for counts)
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

    # Get group counts for legend, using value_map for role-based groups
    value_map = None
    is_domain = False
    if comparison_type == "role":
        value_map = {
            "Creating visualizations is the primary role I perform in my work": "Viz Practitioner",
            "I work with visualizations created by others, but I do not create or research visualization myself": "Scientist who uses vis",
            "Researching visualization methods/techniques is my primary role": "Vis Researcher",
            "I create visualizations to help me in my primary role, which is not visualization-related": "Scientist who creates vis"
        }
    if comparison_type == "domain":
        is_domain = True
    if comparison_column in df.columns and legend_order is not None:
        group_counts = get_group_counts(df, comparison_column, legend_order, value_map=value_map, is_domain=is_domain)
        legend_labels_with_counts = {g: f"{g} ({group_counts.get(g,0)})" for g in legend_order}
        # For domain, legend_colors is None, so assign colors here
        if comparison_type == "domain":
            import plotly.express as px
            px_colors = px.colors.qualitative.Plotly
            legend_colors_with_counts = {legend_labels_with_counts[g]: px_colors[i % len(px_colors)] for i, g in enumerate(legend_order)}
        else:
            legend_colors_with_counts = {legend_labels_with_counts[g]: legend_colors[g] for g in legend_order if g in legend_colors}
        legend_order_with_counts = [legend_labels_with_counts[g] for g in legend_order]
    else:
        legend_labels_with_counts = None
        legend_colors_with_counts = legend_colors
        legend_order_with_counts = legend_order

    if not sort_by:
        sort_by = "human_mean"  # Default value
    sort_order = get_feature_sort_order(sort_by, df_human_melted, df_ai_melted)

    # Update the categorical order for sorting
    df_combined_melted['Feature_Name'] = pd.Categorical(
        df_combined_melted['Feature_Name'], categories=sort_order, ordered=True
    )

    # Re-sort the DataFrame based on the updated categorical order
    sorted_data = df_combined_melted.sort_values(by=["Feature_Name", "Type", "Numerical_Score"])


    # --- Early return for human_ai chart types to avoid KeyError ---
    if comparison_type == "human_ai":
        if chart_type == "box":
            fig_human_ai = make_box_plot(
                sorted_data, x="Feature_Name", y="Numerical_Score", color="Type",
                title="Acceptability of Human vs AI Alterations",
                color_discrete_map={"Human": "peru", "AI": "gray"},
                category_orders={"Feature_Name": list(sort_order), "Type": ["Human", "AI"]},
                xaxis_title="Alteration", yaxis_title="Acceptability"
            )
            return fig_human_ai, None, {"display": "none"}
        elif chart_type == "line":
            feature_order = list(sort_order)
            human_means = df_human_melted.groupby('Feature_Name')['Numerical_Score'].mean().reindex(feature_order)
            ai_means = df_ai_melted.groupby('Feature_Name')['Numerical_Score'].mean().reindex(feature_order)
            mean_scores_dict = {
                "Human": dict(zip(feature_order, human_means)),
                "AI": dict(zip(feature_order, ai_means))
            }
            legend_colors = {"Human": "peru", "AI": "gray"}
            legend_order = ["Human", "AI"]
            fig = make_line_chart(
                mean_scores_dict, feature_order, legend_colors, legend_order,
                title="Mean Acceptability Scores by Feature (Human vs AI)", legend_title="Type"
            )
            return fig, None, {"display": "none"}
        return None, None, {"display": "none"}


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
            return fig_human_ai, None, {"display": "none"}
        # You can add a line chart for human_ai here if needed in the future
        # For now, just return None for the second plot
        return None, None, {"display": "none"}

    if comparison_column not in df.columns:
        raise KeyError(f"The column '{comparison_column}' is not present in the DataFrame.")


    # Always preprocess Domains column if comparison_type is domain (for both box and line)
    if comparison_type == "domain":
        from data_cleaning import preprocess_domains_column
        df_domain = preprocess_domains_column(df, domains_col=comparison_column)
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
        feature_order = list(sort_order)
        group_col = comparison_column
        feature_rename_map = {
            **{col: col.replace("Acceptability_Human_", "") for col in human_acceptability_cols},
            **{col: col.replace("Acceptability_AI_", "") for col in ai_acceptability_cols}
        }
        human_data["Feature"] = human_data["Feature"].replace(feature_rename_map)
        ai_data["Feature"] = ai_data["Feature"].replace(feature_rename_map)
        human_data["Feature"] = pd.Categorical(human_data["Feature"], categories=feature_order, ordered=True)
        ai_data["Feature"] = pd.Categorical(ai_data["Feature"], categories=feature_order, ordered=True)

        # --- Marker symbol logic ---
        marker_symbols = custom_marker_symbols.copy() if custom_marker_symbols else None
        # If legend_order_with_counts is used, map marker_symbols to display names
        use_display = legend_order_with_counts is not None
        if marker_symbols is None:
            if comparison_type == "role":
                # Map to display names if needed
                base = {
                    "Vis Researcher": "circle",
                    "Viz Practitioner": "circle",
                    "Scientist who creates vis": "square",
                    "Scientist who uses vis": "square"
                }
                if use_display:
                    marker_symbols = {f"{k} ({group_counts.get(k,0)})": v for k, v in base.items()}
                else:
                    marker_symbols = base
            elif comparison_type == "frequency_public":
                # Map to display names if needed
                if use_display:
                    marker_symbols = {f"Never ({group_counts.get('Never',0)})": "x"}
                else:
                    marker_symbols = {"Never": "x"}

        # For Role, use display names in the data for grouping and plotting
        if comparison_type == "role":
            # Map group column to display names before grouping
            legend_labels = {
                "Creating visualizations is the primary role I perform in my work": "Viz Practitioner",
                "I work with visualizations created by others, but I do not create or research visualization myself": "Scientist who uses vis",
                "Researching visualization methods/techniques is my primary role": "Vis Researcher",
                "I create visualizations to help me in my primary role, which is not visualization-related": "Scientist who creates vis"
            }
            group_col_display = comparison_column
            # Map values in the group column to display names
            human_data[group_col_display] = human_data[group_col_display].replace(legend_labels)
            ai_data[group_col_display] = ai_data[group_col_display].replace(legend_labels)
            # Ensure categorical order
            if legend_order is not None:
                human_data[group_col_display] = pd.Categorical(human_data[group_col_display], categories=legend_order, ordered=True)
                ai_data[group_col_display] = pd.Categorical(ai_data[group_col_display], categories=legend_order, ordered=True)
            group_values = legend_order if legend_order is not None else sorted(human_data[group_col_display].dropna().unique())
            group_display = legend_order_with_counts if legend_order_with_counts is not None else group_values
            mean_scores_human = {}
            mean_scores_ai = {}
            for group, display in zip(group_values, group_display):
                group_df_h = human_data[human_data[group_col_display] == group]
                group_df_a = ai_data[ai_data[group_col_display] == group]
                means_h = group_df_h.groupby("Feature")["Numerical_Score"].mean().reindex(feature_order)
                means_a = group_df_a.groupby("Feature")["Numerical_Score"].mean().reindex(feature_order)
                mean_scores_human[display] = dict(zip(feature_order, means_h))
                mean_scores_ai[display] = dict(zip(feature_order, means_a))
            fig_human = make_line_chart(
                mean_scores_human, feature_order, legend_colors_with_counts or {}, group_display,
                title=f"Mean Human Acceptability Scores by Feature and {group_col_display}", legend_title=group_col_display,
                marker_symbols=marker_symbols
            )
            fig_ai = make_line_chart(
                mean_scores_ai, feature_order, legend_colors_with_counts or {}, group_display,
                title=f"Mean AI Acceptability Scores by Feature and {group_col_display}", legend_title=group_col_display,
                marker_symbols=marker_symbols
            )
            return fig_human, fig_ai, {"display": "block"}
        else:
            group_values = legend_order if legend_order is not None else sorted(human_data[group_col].dropna().unique())
            group_display = legend_order_with_counts if legend_order_with_counts is not None else group_values
            mean_scores_human = {}
            mean_scores_ai = {}
            for group, display in zip(group_values, group_display):
                group_df_h = human_data[human_data[group_col] == group]
                group_df_a = ai_data[ai_data[group_col] == group]
                means_h = group_df_h.groupby("Feature")["Numerical_Score"].mean().reindex(feature_order)
                means_a = group_df_a.groupby("Feature")["Numerical_Score"].mean().reindex(feature_order)
                mean_scores_human[display] = dict(zip(feature_order, means_h))
                mean_scores_ai[display] = dict(zip(feature_order, means_a))
            fig_human = make_line_chart(
                mean_scores_human, feature_order, legend_colors_with_counts or {}, group_display,
                title=f"Mean Human Acceptability Scores by Feature and {group_col}", legend_title=group_col,
                marker_symbols=marker_symbols
            )
            fig_ai = make_line_chart(
                mean_scores_ai, feature_order, legend_colors_with_counts or {}, group_display,
                title=f"Mean AI Acceptability Scores by Feature and {group_col}", legend_title=group_col,
                marker_symbols=marker_symbols
            )
            return fig_human, fig_ai, {"display": "block"}

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
    # Set up category orders for all group types
    if legend_order is not None:
        human_data[comparison_column] = pd.Categorical(human_data[comparison_column], categories=legend_order, ordered=True)
        ai_data[comparison_column] = pd.Categorical(ai_data[comparison_column], categories=legend_order, ordered=True)
        category_orders = {"Feature": list(sort_order), comparison_column: legend_order}
    else:
        category_orders = {"Feature": list(sort_order)}

    # Patch data for legend display in box plots
    if legend_order_with_counts is not None:
        # Map group col values to display labels
        def display_label(x):
            if pd.isna(x):
                return x
            return f"{x} ({group_counts.get(x,0)})" if x in group_counts else x
        if comparison_type == "domain":
            # Overwrite Domains column so color key and legend match
            human_data[comparison_column] = human_data[comparison_column].map(display_label)
            ai_data[comparison_column] = ai_data[comparison_column].map(display_label)
            color_col = comparison_column
            import plotly.express as px
            domain_labels_with_counts = [f"{g} ({group_counts.get(g,0)})" for g in legend_order]
            if legend_colors is None or any(legend_colors.get(g, None) is None for g in legend_order):
                px_colors = px.colors.qualitative.Plotly
                color_map = {label: px_colors[i % len(px_colors)] for i, label in enumerate(domain_labels_with_counts)}
            else:
                color_map = {label: legend_colors.get(g, None) for label, g in zip(domain_labels_with_counts, legend_order)}
            category_orders[color_col] = domain_labels_with_counts
        else:
            human_data[comparison_column + "_display"] = human_data[comparison_column].map(display_label)
            ai_data[comparison_column + "_display"] = ai_data[comparison_column].map(display_label)
            color_col = comparison_column + "_display"
            category_orders[comparison_column + "_display"] = legend_order_with_counts
            color_map = legend_colors_with_counts
    else:
        color_col = comparison_column
        color_map = legend_colors
    human_fig = make_box_plot(
        human_data, x="Feature", y="Numerical_Score", color=color_col,
        title="Human Acceptability",
        color_discrete_map=color_map,
        category_orders=category_orders,
        xaxis_title="Alteration", yaxis_title="Acceptability"
    )
    ai_fig = make_box_plot(
        ai_data, x="Feature", y="Numerical_Score", color=color_col,
        title="AI Acceptability",
        color_discrete_map=color_map,
        category_orders=category_orders,
        xaxis_title="Alteration", yaxis_title="Acceptability"
    )
    # For all other cases, always return three values
    return human_fig, ai_fig, {"display": "block"}

# Run the app
import sys

def generate_html_dashboard(output_path="index.html"):
    """
    Generate the main dashboard plot as a static HTML file for GitHub Pages.
    Only the default Human vs AI box plot is exported (static, not interactive dashboard).
    """
    # Use the default sort order and data
    sort_order = get_feature_sort_order("human_mean", df_human_melted, df_ai_melted)
    df_combined_melted['Feature_Name'] = pd.Categorical(
        df_combined_melted['Feature_Name'], categories=sort_order, ordered=True
    )
    sorted_data = df_combined_melted.sort_values(by=["Feature_Name", "Type", "Numerical_Score"])
    fig = make_box_plot(
        sorted_data, x="Feature_Name", y="Numerical_Score", color="Type",
        title="Acceptability of Human vs AI Alterations",
        color_discrete_map={"Human": "peru", "AI": "gray"},
        category_orders={"Feature_Name": list(sort_order), "Type": ["Human", "AI"]},
        xaxis_title="Alteration", yaxis_title="Acceptability"
    )
    fig.write_html(output_path, full_html=True, include_plotlyjs="cdn")
    print(f"Static dashboard exported to {output_path}")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--export-html":
        generate_html_dashboard()
    else:
        app.run(debug=True)