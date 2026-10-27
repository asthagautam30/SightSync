# SightSync experimental AI features

## Risk assessment and Random Forest

The Python adaptive runner now publishes a \`riskAssessment\` object beside per-sensor adaptive results at Firebase \`devices/Prachi-spectacles-001/adaptive.json\`. The Adaptive Learning page displays it.

- \`ai/risk_model.py\` uses a trained Random Forest only if \`ai/risk_random_forest.joblib\` exists and has the expected feature schema.
- Until a model is trained, the feature explicitly reports a fixed-limit fallback. This is intentional; no model artifact or training data is bundled.
- Fixed project thresholds override a model's reassuring prediction. These values are simulator/project units and have not been calibrated or validated for real-world safety.
- The current fallback detects configured limit triggers; it does not certify that a no-trigger environment is safe.
- The existing adaptive median/batch algorithm remains in place. It is not silently replaced by a classifier.

### Train with reviewed labelled data

Create a CSV with these exact columns:

\`\`\`csv
uv,gas,light,distance,uv_baseline,gas_baseline,light_baseline,distance_baseline,risk
\`\`\`

Every row must have all eight numeric feature columns and a reviewed \`risk\` label of \`low\`, \`moderate\`, or \`elevated\`. Labels should come from a documented, reviewed source/outcome. Do not label rows merely by copying the same thresholds used in the fallback; that would teach the model to imitate the rules rather than learn independent risk patterns. Do not use fabricated labels as evidence of real-world performance.

Install optional dependencies and train:

\`\`\`bash
python -m pip install -r ai/requirements-ml.txt
python -m ai.risk_model --train-csv path/to/reviewed_sensor_labels.csv
\`\`\`

The command reports a held-out classification report and writes \`ai/risk_random_forest.joblib\`. Keep the artifact private if the training data is sensitive. Validate with representative, independently labelled data before relying on predictions. The artifact is intentionally not committed.

## Weekly AI-personalized recommendations

The weekly report computes aggregate statistics in the browser, then posts only the weekly summary, observations, and aggregate sensor statistics to \`/api/weekly-recommendations\`; it does not send a user ID or raw timestamped history to the language model. The server uses \`OPENAI_API_KEY\` and optional \`OPENAI_RECOMMENDATION_MODEL\` (default \`gpt-4.1-mini\`) to produce short recommendations. If the key is missing or the API fails, safety-checked fallback recommendations are used.

Configure \`OPENAI_API_KEY\` only in the server environment (for local development, put it in an untracked \`.env.local\`). Never prefix it with \`NEXT_PUBLIC_\` or expose it in client code. Model-generated recommendations are informational and cannot change thresholds or suppress live alerts.

## Tests

\`\`\`bash
python -m unittest ai.test_risk_model ai.test_adaptive_thresholds
\`\`\`

These tests exercise fallback behavior and safety override logic. They do not establish real-world safety performance.
