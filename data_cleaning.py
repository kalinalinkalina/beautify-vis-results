import pandas as pd

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

    # Split comma-separated values in 'Domains' and count each value individually
    if 'Domains' in df.columns:
        df['Domains'] = df['Domains'].astype(str)
        df['Domains'] = df['Domains'].str.split(',').apply(lambda x: [item.strip() for item in x] if isinstance(x, list) else x)

    # Print number of rows
    print(f"Number of rows after cleaning: {df.shape[0]}")

    return df

# Example usage
if __name__ == "__main__":
    cleaned_data = clean_teapot_data("data/data-4-13-26.csv")
    #print(cleaned_data.head())
