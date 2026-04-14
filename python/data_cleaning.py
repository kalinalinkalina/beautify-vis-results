# --- Main data cleaning function (must be at top level for import) ---
def clean_teapot_data(file_path):
    # Load the data
    df = pd.read_csv(file_path, header=0, skiprows=[1, 2])

    # Define conditions for removal
    condition_1 = df['Consent'] != 'Yes, I consent'
    condition_2 = df['Age'] < 18
    condition_3 = df['Vis_Role'] == 'I do not have experience with 3D visualization of scientific data'
    condition_4 = df['Weeder'].isin(['Voxfish', 'OpenATP', 'All of the above'])

    # Remove rows based on conditions
    rows_to_remove = condition_1 | condition_2 | condition_3 | condition_4
    df = df[~rows_to_remove]

    # Drop rows where all survey columns are NaN
    survey_cols = [
        'Acceptability_Human_Smoothing', 'Acceptability_Human_Textures', 'Acceptability_Human_CamPos',
        'Acceptability_Human_Blur', 'Acceptability_Human_Details', 'Acceptability_Human_Errors',
        'Acceptability_Human_FeatureAddition', 'Acceptability_Human_FeatureOmission', 'Acceptability_Human_Gaps',
        'Acceptability_Human_Shape', 'Acceptability_Human_Lighting', 'Acceptability_Human_BgItems',
        'Acceptability_Human_BgImage', 'Acceptability_Human_Position', 'Acceptability_Human_Color',
        'Acceptability_Hu_Txt', 'AI_experience', 'Acceptability_AI_Smoothing',
        'Acceptability_AI_Textures', 'Acceptability_AI_CamPos', 'Acceptability_AI_Blur',
        'Acceptability_AI_Details', 'Acceptability_AI_Errors', 'Acceptability_AI_FeatureAddition',
        'Acceptability_AI_FeatureOmission', 'Acceptability_AI_Gaps', 'Acceptability_AI_Shape',
        'Acceptability_AI_Lighting', 'Acceptability_AI_BgItems', 'Acceptability_AI_BgImage',
        'Acceptability_AI_Position', 'Acceptability_AI_Color', 'Acceptability_AI_Txt',
        'Use_Cases_1', 'Use_Cases_2', 'Use_Cases_3', 'Use_Cases_4', 'Use_Cases_5', 'Use_Cases_6',
        'Comfort_1', 'Comfort_2', 'Comfort_3', 'Comfort_4', 'Importance_1', 'Importance_2',
        'Concrete_Elaboration', 'AI-open', 'Tool_use'
    ]
    df.dropna(subset=survey_cols, how='all', inplace=True)

    # Remove specific responses by ID
    participants_to_remove = [
        'R_3t6asL5rzmRf0dc', 'R_7FR0CIq9gWcLI9H', 'R_7qCnRUkyPD08zGO', 'R_3e84CRbBQyQBjvX',
        'R_3rvFplrp4hr3iBH', 'R_10ivOzLSu73P1B6', 'R_32M9Pogwo7gP2YM',
        'R_4YysgirTHLontwR', 'R_5rwsIGQ0MS83TRT', 'R_4p8r1FZg0saMUFz', 'R_1Sk3Nm1afmoFlUA', 'R_6n7hKa7m4GZJFAd', 'R_6eamu3XrOX3EveH'
    ]
    df = df[~df['ResponseId'].isin(participants_to_remove)]

    # Drop unnecessary columns
    columns_to_drop = [
        'StartDate', 'EndDate', 'Status', 'IPAddress', 'Progress', 'Weeder', 'Duration (in seconds)',
        'Finished', 'RecordedDate', 'ResponseId', 'RecipientLastName', 'RecipientFirstName',
        'RecipientEmail', 'ExternalReference', 'LocationLatitude', 'LocationLongitude',
        'DistributionChannel', 'UserLanguage', 'Consent', 'Future_research', 'increment_quota'
    ]
    df.drop(columns=columns_to_drop, inplace=True)

    # Remove open-text columns
    open_text_columns_to_drop = [
        'Sex_4_TEXT',
        'Employment_4_TEXT',
        'Acceptability_Hu_Txt',
        'Acceptability_AI_Txt',
        'Concrete_Elaboration',
        'AI-open',
        'Future_research_1_TEXT'
    ]
    df.drop(columns=open_text_columns_to_drop, inplace=True)

    # Map multi-response values in 'Ethnicity' to 'Mixed Race'
    if 'Ethnicity' in df.columns:
        df['Ethnicity'] = df['Ethnicity'].astype(str)
        df.loc[df['Ethnicity'].str.contains(',', na=False), 'Ethnicity'] = 'Mixed Race'

    # Bucket the Age column into ranges for all downstream visualizations
    if 'Age' in df.columns:
        import numpy as np
        bins = [17, 24, 34, 44, 54, 64, np.inf]
        labels = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+']
        df['Age'] = pd.cut(df['Age'], bins=bins, labels=labels, right=True, include_lowest=True)

    # Split comma-separated values in 'Domains' and count each value individually
    if 'Domains' in df.columns:
        df['Domains'] = df['Domains'].astype(str)
        df['Domains'] = df['Domains'].str.split(',').apply(lambda x: [item.strip() for item in x] if isinstance(x, list) else x)

    # Print number of rows
    print(f"Number of rows after cleaning: {df.shape[0]}")

    return df
import pandas as pd
# --- Pure preprocessing for Domains column (splitting/exploding) ---
def preprocess_domains_column(df, domains_col="Domains"):
    """
    Splits and explodes the Domains column so each domain is a separate row.
    Returns a new DataFrame with exploded domains.
    """
    df_domains = df.copy()
    df_domains[domains_col] = df_domains[domains_col].apply(lambda x: ','.join(x) if isinstance(x, list) else str(x))
    df_domains[domains_col] = df_domains[domains_col].str.split(',')
    df_domains = df_domains.explode(domains_col)
    df_domains.dropna(subset=[domains_col], inplace=True)
    df_domains[domains_col] = df_domains[domains_col].apply(lambda x: x.strip() if isinstance(x, str) else str(x))
    df_domains = df_domains[df_domains[domains_col].apply(lambda x: isinstance(x, str) and x and x.lower() != 'nan')]
    df_domains[domains_col] = df_domains[domains_col].astype(str)
    return df_domains
# --- Centralized group/legend info function for dashboard visualizations ---
def get_group_legend_info(comparison_type):
    """
    Returns legend_labels, legend_colors, legend_order for a given comparison_type.
    """
    group_orders = {
        "experience": [
            "Less than 1 year", "1-3 years", "3-5 years", "5-10 years", "10-20 years", "More than 20 years"
        ],
        "frequency_vis": [
            "Less than once a year", "Annually", "Monthly", "Weekly", "Daily"
        ],
        "frequency_public": [
            "Never", "Rarely", "Occasionally", "Frequently", "This is a primary part of my work"
        ],
        "age": ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
        "tool_use": ["Yes", "No", "Maybe"]
    }
    viridis_r_6 = [
        "#5ec962", "#3fbc73", "#21918c", "#31688e", "#443983", "#440154"
    ]
    viridis_r_5 = [
        "#5ec962", "#27ad81", "#21918c", "#3b528b", "#440154"
    ]
    # Role
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
        return legend_labels, legend_colors, legend_order
    # Experience
    if comparison_type == "experience":
        legend_labels = None
        legend_colors = dict(zip(group_orders["experience"], viridis_r_6))
        legend_order = group_orders["experience"]
        return legend_labels, legend_colors, legend_order
    # Frequency of Visualization
    if comparison_type == "frequency_vis":
        legend_labels = None
        legend_colors = dict(zip(group_orders["frequency_vis"], viridis_r_5))
        legend_order = group_orders["frequency_vis"]
        return legend_labels, legend_colors, legend_order
    # Frequency of Public Visualization
    if comparison_type == "frequency_public":
        legend_labels = None
        legend_colors = dict(zip(group_orders["frequency_public"], viridis_r_5))
        legend_colors["Never"] = "#e07b7b"  # desaturated red
        legend_order = group_orders["frequency_public"]
        return legend_labels, legend_colors, legend_order
    # Age
    if comparison_type == "age":
        legend_labels = None
        legend_colors = dict(zip(group_orders["age"], viridis_r_6))
        legend_order = group_orders["age"]
        return legend_labels, legend_colors, legend_order
    # Tool use
    if comparison_type == "tool_use":
        legend_labels = None
        # Yes = Blue, Maybe = Purple, No = Red
        legend_colors = {"Yes": "#1976d2", "Maybe": "#8e24aa", "No": "#d32f2f"}
        legend_order = ["Yes", "Maybe", "No"]
        return legend_labels, legend_colors, legend_order
    # Domain (dynamic)
    if comparison_type == "domain":
        # Colors and order will be set dynamically in dashboard.py
        return None, None, None
    # Default
    return None, None, None
# --- Centralized feature sorting function for dashboard visualizations ---
def get_feature_sort_order(sort_by, df_human_melted, df_ai_melted):
    """
    Returns the feature order (Index) for sorting, given a sort type and melted DataFrames.
    Args:
        sort_by: str, one of 'human_mean', 'ai_mean', 'difference', 'human_median', 'ai_median', 'difference_median'
        df_human_melted: DataFrame with columns Feature_Name, Numerical_Score
        df_ai_melted: DataFrame with columns Feature_Name, Numerical_Score
    Returns:
        Index of feature names in the desired order
    """
    if sort_by == "human_mean":
        return df_human_melted.groupby('Feature_Name')['Numerical_Score'].mean().sort_values(ascending=False).index
    if sort_by == "human_mean":
        return df_human_melted.groupby('Feature_Name')['Numerical_Score'].mean().sort_values(ascending=False).index
    elif sort_by == "ai_mean":
        return df_ai_melted.groupby('Feature_Name')['Numerical_Score'].mean().sort_values(ascending=False).index
    elif sort_by == "difference":
        human_means = df_human_melted.groupby('Feature_Name')['Numerical_Score'].mean()
        ai_means = df_ai_melted.groupby('Feature_Name')['Numerical_Score'].mean()
        if ai_means is None:
            ai_means = pd.Series(0, index=human_means.index)
        return (human_means - ai_means).sort_values(ascending=False).index
    elif sort_by == "human_median":
        return df_human_melted.groupby('Feature_Name')['Numerical_Score'].median().sort_values(ascending=False).index
    elif sort_by == "ai_median":
        return df_ai_melted.groupby('Feature_Name')['Numerical_Score'].median().sort_values(ascending=False).index
    elif sort_by == "difference_median":
        human_medians = df_human_melted.groupby('Feature_Name')['Numerical_Score'].median()
        ai_medians = df_ai_melted.groupby('Feature_Name')['Numerical_Score'].median()
        if ai_medians is None:
            ai_medians = pd.Series(0, index=human_medians.index)
        return (human_medians - ai_medians).sort_values(ascending=False).index
    else:
        # Default to human_mean
        return df_human_melted.groupby('Feature_Name')['Numerical_Score'].mean().sort_values(ascending=False).index


# --- Centralized melt and map function for dashboard visualizations ---
def melt_and_map_acceptability(
    df,
    acceptability_cols,
    likert_mapping,
    feature_prefix,
    group_col=None
):
    """
    Melts acceptability columns, maps Likert to numerical, and renames features.
    Optionally keeps a group column for comparison types.
    Args:
        df: DataFrame
        acceptability_cols: list of columns to melt
        likert_mapping: dict mapping Likert to int
        feature_prefix: str, e.g. 'Acceptability_Human_' or 'Acceptability_AI_'
        group_col: str or None, column to keep as id_var
    Returns:
        Melted DataFrame with columns: [group_col (if given), Feature, Acceptability_Score, Numerical_Score, Feature_Name]
    """
    id_vars = [group_col] if group_col else None
    melted = df.melt(
        id_vars=id_vars,
        value_vars=acceptability_cols,
        var_name='Feature', value_name='Acceptability_Score'
    )
    melted['Numerical_Score'] = melted['Acceptability_Score'].map(likert_mapping)
    melted['Feature_Name'] = melted['Feature'].str.replace(feature_prefix, '', regex=False)
    return melted

# Example usage
if __name__ == "__main__":
    cleaned_data = clean_teapot_data("data/data-4-13-26.csv")
    #print(cleaned_data.head())
