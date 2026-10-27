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

## Isolation Forest anomaly detection

The adaptive Firebase runner publishes \`anomalyAssessment\` beside \`riskAssessment\` in \`/adaptive.json\`. The Adaptive Learning page shows the model status and automatic training progress.

- No manually prepared CSV is needed for the integrated automatic-learning path.
- The runner collects a multivariate sample only when all four sensor readings are present, every sensor's baseline has been established, and the current readings pass the independent fixed and adaptive warning checks.
- After 100 eligible samples, the runner trains Isolation Forest locally. It retrains after each additional 25 eligible samples, up to a rolling cap of 2,000 samples.
- Samples and the model are stored locally under \`ai/models/\`; these generated files are git-ignored.
- If optional ML dependencies are missing, the runner remains available and reports that anomaly inference is unavailable. Install \`ai/requirements-ml.txt\` to enable training.
- Isolation Forest is unsupervised. Its outputs identify unusual patterns, not confirmed hazards. A new environment or sensor fault can also look unusual. Fixed safety checks remain independent and authoritative.
- Initial model performance is not validated for real-world use. Inspect false positives/negatives against reviewed events before relying on it.

The standalone trainer is also available for users who already have curated normal readings:

\`\`\`bash
python -m pip install -r ai/requirements-ml.txt
python ai/train_isolation_forest.py --csv path/to/normal_sensor_readings.csv
\`\`\`

The live runner does not require this manual command; it trains after collecting enough eligible real readings.

## Weekly AI-personalized recommendations

The weekly report computes aggregate statistics in the browser, then posts only the weekly summary, observations, and aggregate sensor statistics to \`/api/weekly-recommendations\`; it does not send a user ID or raw timestamped history to the language model. The server uses \`OPENAI_API_KEY\` and optional \`OPENAI_RECOMMENDATION_MODEL\` (default \`gpt-4.1-mini\`) to produce short recommendations. If the key is missing or the API fails, safety-checked fallback recommendations are used.

Configure \`OPENAI_API_KEY\` only in the server environment (for local development, put it in an untracked \`.env.local\`). Never prefix it with \`NEXT_PUBLIC_\` or expose it in client code. Model-generated recommendations are informational and cannot change thresholds or suppress live alerts.

## Tests

\`\`\`bash
python -m unittest ai.test_risk_model ai.test_adaptive_thresholds
\`\`\`

These tests exercise fallback behavior and safety override logic. They do not establish real-world safety performance.
