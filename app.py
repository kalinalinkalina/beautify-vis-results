"""
May A(I) Beautify Your Visualization? – Interactive Survey Results Dashboard
Built with Plotly Dash.
"""
import pathlib

import dash
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from dash import Input, Output, dcc, html

# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------
DATA_PATH = pathlib.Path(__file__).parent / "data" / "survey_results.csv"
df = pd.read_csv(DATA_PATH)

CHART_COLS = [c for c in df.columns if c.startswith("chart_")]
CHART_LABELS = {c: c.replace("chart_", "").replace("_", " ").title() for c in CHART_COLS}

ASPECT_COLS = [c for c in df.columns if c.startswith("aspect_")]
ASPECT_LABELS = {c: c.replace("aspect_", "").replace("_", " ").title() for c in ASPECT_COLS}

ROLES = sorted(df["role"].unique())
TOOLS = sorted(df["primary_tool"].unique())
EXPERIENCE_ORDER = ["< 1 year", "1-3 years", "3-5 years", "5-10 years", "> 10 years"]

# ---------------------------------------------------------------------------
# App initialisation
# ---------------------------------------------------------------------------
app = dash.Dash(
    __name__,
    title="May A(I) Beautify Your Visualization? – Results",
    meta_tags=[{"name": "viewport", "content": "width=device-width, initial-scale=1"}],
)
server = app.server  # expose Flask server for deployment

# ---------------------------------------------------------------------------
# Colour palette (accessible, Plotly-friendly)
# ---------------------------------------------------------------------------
PALETTE = px.colors.qualitative.Plotly
ACCENT = "#636EFA"

# ---------------------------------------------------------------------------
# Helper – rating-scale labels
# ---------------------------------------------------------------------------
RATING_LABELS = {1: "Much Worse", 2: "Worse", 3: "Same", 4: "Better", 5: "Much Better"}

# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------
app.layout = html.Div(
    style={"fontFamily": "Inter, system-ui, sans-serif", "backgroundColor": "#F8F9FA"},
    children=[
        # ── Header ──────────────────────────────────────────────────────────
        html.Div(
            style={
                "background": "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)",
                "color": "white",
                "padding": "40px 60px 30px",
            },
            children=[
                html.H1(
                    "May A(I) Beautify Your Visualization?",
                    style={"margin": "0 0 8px", "fontSize": "2rem", "fontWeight": 700},
                ),
                html.P(
                    "Interactive dashboard of survey results exploring AI-assisted chart beautification.",
                    style={"margin": 0, "opacity": 0.8, "fontSize": "1rem"},
                ),
            ],
        ),
        # ── Filters ─────────────────────────────────────────────────────────
        html.Div(
            style={
                "display": "flex",
                "flexWrap": "wrap",
                "gap": "20px",
                "padding": "24px 60px",
                "backgroundColor": "#FFFFFF",
                "borderBottom": "1px solid #E5E7EB",
            },
            children=[
                html.Div(
                    [
                        html.Label("Role", style={"fontWeight": 600, "fontSize": "0.85rem", "marginBottom": "6px", "display": "block"}),
                        dcc.Dropdown(
                            id="filter-role",
                            options=[{"label": r, "value": r} for r in ROLES],
                            value=[],
                            multi=True,
                            placeholder="All roles…",
                            style={"minWidth": "200px"},
                        ),
                    ]
                ),
                html.Div(
                    [
                        html.Label("Primary Tool", style={"fontWeight": 600, "fontSize": "0.85rem", "marginBottom": "6px", "display": "block"}),
                        dcc.Dropdown(
                            id="filter-tool",
                            options=[{"label": t, "value": t} for t in TOOLS],
                            value=[],
                            multi=True,
                            placeholder="All tools…",
                            style={"minWidth": "200px"},
                        ),
                    ]
                ),
                html.Div(
                    [
                        html.Label("Experience", style={"fontWeight": 600, "fontSize": "0.85rem", "marginBottom": "6px", "display": "block"}),
                        dcc.Dropdown(
                            id="filter-experience",
                            options=[{"label": e, "value": e} for e in EXPERIENCE_ORDER],
                            value=[],
                            multi=True,
                            placeholder="All experience levels…",
                            style={"minWidth": "220px"},
                        ),
                    ]
                ),
                html.Div(
                    style={"marginLeft": "auto", "display": "flex", "alignItems": "flex-end"},
                    children=[
                        html.Span(id="respondent-count", style={"fontWeight": 600, "color": ACCENT}),
                    ],
                ),
            ],
        ),
        # ── KPI row ─────────────────────────────────────────────────────────
        html.Div(id="kpi-row", style={"display": "flex", "gap": "20px", "padding": "24px 60px"}),
        # ── Row 1: Overall preference + Would Reuse ──────────────────────────
        html.Div(
            style={"display": "flex", "gap": "20px", "padding": "0 60px 24px"},
            children=[
                html.Div(dcc.Graph(id="chart-overall-pref"), style={"flex": 2, "backgroundColor": "white", "borderRadius": "12px", "padding": "16px", "boxShadow": "0 1px 4px rgba(0,0,0,.08)"}),
                html.Div(dcc.Graph(id="chart-reuse"), style={"flex": 1, "backgroundColor": "white", "borderRadius": "12px", "padding": "16px", "boxShadow": "0 1px 4px rgba(0,0,0,.08)"}),
            ],
        ),
        # ── Row 2: Chart-type ratings + Aspect ratings ───────────────────────
        html.Div(
            style={"display": "flex", "gap": "20px", "padding": "0 60px 24px"},
            children=[
                html.Div(dcc.Graph(id="chart-chart-ratings"), style={"flex": 1, "backgroundColor": "white", "borderRadius": "12px", "padding": "16px", "boxShadow": "0 1px 4px rgba(0,0,0,.08)"}),
                html.Div(dcc.Graph(id="chart-aspect-ratings"), style={"flex": 1, "backgroundColor": "white", "borderRadius": "12px", "padding": "16px", "boxShadow": "0 1px 4px rgba(0,0,0,.08)"}),
            ],
        ),
        # ── Row 3: Time saved + Role breakdown ──────────────────────────────
        html.Div(
            style={"display": "flex", "gap": "20px", "padding": "0 60px 24px"},
            children=[
                html.Div(dcc.Graph(id="chart-time-saved"), style={"flex": 1, "backgroundColor": "white", "borderRadius": "12px", "padding": "16px", "boxShadow": "0 1px 4px rgba(0,0,0,.08)"}),
                html.Div(dcc.Graph(id="chart-role-pref"), style={"flex": 1, "backgroundColor": "white", "borderRadius": "12px", "padding": "16px", "boxShadow": "0 1px 4px rgba(0,0,0,.08)"}),
            ],
        ),
        # ── Row 4: Heatmap – role × aspect ──────────────────────────────────
        html.Div(
            style={"padding": "0 60px 40px"},
            children=[
                html.Div(dcc.Graph(id="chart-heatmap"), style={"backgroundColor": "white", "borderRadius": "12px", "padding": "16px", "boxShadow": "0 1px 4px rgba(0,0,0,.08)"}),
            ],
        ),
        # ── Footer ──────────────────────────────────────────────────────────
        html.Div(
            "Dashboard built with Plotly Dash · Survey on AI-assisted visualization beautification",
            style={"textAlign": "center", "padding": "16px", "color": "#9CA3AF", "fontSize": "0.8rem"},
        ),
    ],
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def filter_df(roles, tools, experiences):
    filtered = df.copy()
    if roles:
        filtered = filtered[filtered["role"].isin(roles)]
    if tools:
        filtered = filtered[filtered["primary_tool"].isin(tools)]
    if experiences:
        filtered = filtered[filtered["experience"].isin(experiences)]
    return filtered


def kpi_card(label, value, color=ACCENT):
    return html.Div(
        style={
            "flex": 1,
            "backgroundColor": "white",
            "borderRadius": "12px",
            "padding": "20px 24px",
            "boxShadow": "0 1px 4px rgba(0,0,0,.08)",
            "borderTop": f"4px solid {color}",
        },
        children=[
            html.P(label, style={"margin": "0 0 6px", "fontSize": "0.8rem", "color": "#6B7280", "fontWeight": 600}),
            html.H2(value, style={"margin": 0, "fontSize": "1.75rem", "color": "#111827"}),
        ],
    )

# ---------------------------------------------------------------------------
# Callbacks
# ---------------------------------------------------------------------------

@app.callback(
    Output("respondent-count", "children"),
    Output("kpi-row", "children"),
    Output("chart-overall-pref", "figure"),
    Output("chart-reuse", "figure"),
    Output("chart-chart-ratings", "figure"),
    Output("chart-aspect-ratings", "figure"),
    Output("chart-time-saved", "figure"),
    Output("chart-role-pref", "figure"),
    Output("chart-heatmap", "figure"),
    Input("filter-role", "value"),
    Input("filter-tool", "value"),
    Input("filter-experience", "value"),
)
def update_all(roles, tools, experiences):
    d = filter_df(roles, tools, experiences)
    n = len(d)

    if n == 0:
        empty = go.Figure()
        empty.update_layout(
            paper_bgcolor="white",
            plot_bgcolor="white",
            annotations=[{"text": "No data matches the current filters.", "showarrow": False, "font": {"size": 14}}],
        )
        kpis = [kpi_card("Respondents", "0")]
        return f"{n} respondents", kpis, empty, empty, empty, empty, empty, empty, empty

    # ── KPIs ──────────────────────────────────────────────────────────────
    avg_pref = round(d["overall_preference"].mean(), 2)
    pct_reuse = round(100 * (d["would_reuse_ai"] == "Yes").sum() / n, 1)
    avg_time = round(d["time_saved_min"].mean(), 1)

    kpis = [
        kpi_card("Respondents", str(n), "#636EFA"),
        kpi_card("Avg. AI Preference Score", f"{avg_pref} / 5", "#EF553B"),
        kpi_card("Would Reuse AI", f"{pct_reuse}%", "#00CC96"),
        kpi_card("Avg. Time Saved", f"{avg_time} min", "#AB63FA"),
    ]

    layout_defaults = dict(
        paper_bgcolor="white",
        plot_bgcolor="white",
        margin=dict(t=50, b=40, l=40, r=20),
        font=dict(family="Inter, system-ui, sans-serif", size=12),
    )

    # ── Overall preference distribution ───────────────────────────────────
    pref_counts = d["overall_preference"].value_counts().sort_index().reset_index()
    pref_counts.columns = ["score", "count"]
    pref_counts["label"] = pref_counts["score"].map(RATING_LABELS)
    fig_pref = px.bar(
        pref_counts,
        x="label",
        y="count",
        color="score",
        color_continuous_scale=px.colors.sequential.Blues,
        title="Overall Preference: AI vs. Original Visualization",
        labels={"label": "Rating", "count": "Respondents", "score": "Score"},
        text="count",
    )
    fig_pref.update_traces(textposition="outside")
    fig_pref.update_layout(**layout_defaults, coloraxis_showscale=False)

    # ── Would reuse AI donut ──────────────────────────────────────────────
    reuse_counts = d["would_reuse_ai"].value_counts().reset_index()
    reuse_counts.columns = ["answer", "count"]
    fig_reuse = px.pie(
        reuse_counts,
        names="answer",
        values="count",
        hole=0.45,
        title="Would You Use AI Assistance Again?",
        color="answer",
        color_discrete_map={"Yes": "#00CC96", "No": "#EF553B", "Maybe": "#FFA15A"},
    )
    fig_reuse.update_traces(textinfo="label+percent", pull=[0.05] * len(reuse_counts))
    fig_reuse.update_layout(**layout_defaults)

    # ── Chart-type ratings grouped bar ────────────────────────────────────
    chart_means = {CHART_LABELS[c]: d[c].mean() for c in CHART_COLS}
    chart_stds = {CHART_LABELS[c]: d[c].std() for c in CHART_COLS}
    fig_charts = go.Figure()
    for i, (label, mean_val) in enumerate(chart_means.items()):
        fig_charts.add_trace(
            go.Bar(
                name=label,
                x=[label],
                y=[mean_val],
                error_y=dict(type="data", array=[chart_stds[label]], visible=True),
                marker_color=PALETTE[i % len(PALETTE)],
                text=[f"{mean_val:.2f}"],
                textposition="outside",
            )
        )
    fig_charts.update_layout(
        **layout_defaults,
        title="Average AI Improvement Rating by Chart Type",
        yaxis=dict(title="Mean Rating (1–5)", range=[0, 6]),
        xaxis=dict(title=""),
        showlegend=False,
    )

    # ── Aspect ratings radar / bar ─────────────────────────────────────────
    aspect_means = [d[c].mean() for c in ASPECT_COLS]
    aspect_labels = [ASPECT_LABELS[c] for c in ASPECT_COLS]
    fig_aspects = go.Figure(
        go.Scatterpolar(
            r=aspect_means + [aspect_means[0]],
            theta=aspect_labels + [aspect_labels[0]],
            fill="toself",
            fillcolor=f"rgba(99,110,250,0.25)",
            line=dict(color=ACCENT, width=2),
            marker=dict(size=6),
        )
    )
    fig_aspects.update_layout(
        **layout_defaults,
        title="Average AI Improvement by Aesthetic Aspect",
        polar=dict(radialaxis=dict(visible=True, range=[1, 5])),
    )

    # ── Time saved histogram ──────────────────────────────────────────────
    fig_time = px.histogram(
        d,
        x="time_saved_min",
        nbins=20,
        title="Distribution of Time Saved per Visualization (minutes)",
        labels={"time_saved_min": "Minutes Saved", "count": "Respondents"},
        color_discrete_sequence=[ACCENT],
    )
    fig_time.update_layout(**layout_defaults)

    # ── Role × overall preference box plot ────────────────────────────────
    fig_role = px.box(
        d,
        x="role",
        y="overall_preference",
        color="role",
        title="AI Preference Score by Role",
        labels={"overall_preference": "Preference Score (1–5)", "role": "Role"},
        color_discrete_sequence=PALETTE,
        points="all",
    )
    fig_role.update_layout(**layout_defaults, showlegend=False)

    # ── Heatmap – role × aspect ─────────────────────────────────────────--
    heatmap_data = d.groupby("role")[ASPECT_COLS].mean()
    heatmap_data.columns = [ASPECT_LABELS[c] for c in ASPECT_COLS]
    fig_heat = px.imshow(
        heatmap_data,
        color_continuous_scale="Blues",
        zmin=1,
        zmax=5,
        title="Average Aspect Rating by Role",
        labels=dict(x="Aesthetic Aspect", y="Role", color="Rating"),
        text_auto=".1f",
        aspect="auto",
    )
    fig_heat.update_layout(**layout_defaults)

    return (
        f"{n} respondents",
        kpis,
        fig_pref,
        fig_reuse,
        fig_charts,
        fig_aspects,
        fig_time,
        fig_role,
        fig_heat,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=False, port=8050)
