# Utility to count responses per group for legend labeling
import pandas as pd

def get_group_counts(df, group_col, legend_order=None, value_map=None, is_domain=False):
    """
    Returns a dict mapping group name to count of responses in that group.
    If legend_order is provided, ensures all groups are present (with 0 if missing).
    If value_map is provided, maps raw values to display values before counting.
    If is_domain is True, explodes lists in the group_col before counting (for domain logic).
    """
    series = df[group_col]
    if is_domain:
        # Explode lists or comma-separated strings
        series = series.apply(lambda x: x if isinstance(x, list) else (str(x).split(',') if pd.notnull(x) else []))
        series = series.explode().dropna().map(lambda x: x.strip() if isinstance(x, str) else x)
    if value_map is not None:
        mapped = series.map(value_map).fillna(series)
        counts = mapped.value_counts(dropna=False).to_dict()
    else:
        counts = series.value_counts(dropna=False).to_dict()
    if legend_order is not None:
        for group in legend_order:
            if group not in counts:
                counts[group] = 0
    return counts
