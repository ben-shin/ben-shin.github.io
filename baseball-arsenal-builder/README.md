# Pitch Lab — Baseball Arsenal Builder

A static GitHub Pages subpage for building a pitch arsenal, logging pitch endpoints on an interactive strike zone, and reviewing pitch-mix/location/session analytics.

## Upload

Place this folder in the root of your GitHub Pages repository:

```text
your-github.io/
├── index.html
└── baseball-arsenal-builder/
    ├── index.html
    ├── styles.css
    ├── app.js
    └── README.md
```

Then open:

```text
https://your-username.github.io/baseball-arsenal-builder/
```

## Features

- Interactive strike-zone logging with mouse, touch, or keyboard.
- Pitch arsenal profiles with velocity, movement, command, whiff, groundball, confidence, target, color, and notes.
- Count/context-aware pitch recommendation engine.
- Pitch mix, location profile, count leverage, and outcome charts.
- Heart-zone mistake, waste-pitch, strike-rate, common-miss, and two-strike whiff summaries.
- CSV export/import.
- Local browser storage.
- Mobile-friendly layout.

## Notes

This is a practical amateur scouting and bullpen-planning tool. It is not a calibrated TrackMan, Hawk-Eye, or Statcast replacement. The recommendation engine uses transparent heuristics based on user-entered pitch ratings and logged session outcomes.
