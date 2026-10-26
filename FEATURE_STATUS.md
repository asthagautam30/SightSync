# Smart Spectacles feature inventory

This file records the feature areas present in the `prachi` branch and what has or has not been verified. A page existing in the repository does not, by itself, prove every user flow works end to end.

## Application areas present

| Feature area | Main implementation | Verification status |
|---|---|---|
| Home / landing page | `app/page.tsx` | Requires browser and Firebase integration testing |
| Authentication provider | `app/auth-provider.tsx`, `app/login/page.tsx`, `app/signup/page.tsx` | Requires sign-in/sign-up/sign-out testing with configured Firebase Auth |
| Live dashboard and sensor warnings | `app/dashboard/page.tsx` | Requires live Realtime Database test |
| Adaptive thresholds | `ai/adaptive_thresholds.py`, `ai/adaptive_firebase_test.py`, `ai/adaptive_state.py` | Unit tests added; live runner tested manually by project owner |
| Alert history and viewed status | `app/alerts/page.tsx`, `lib/alert-history.ts`, `lib/alert-manager.ts` | Requires authenticated Firebase integration test |
| Sensor history | `app/history/page.tsx`, `lib/sensor-history.ts` | Requires live data and history persistence test |
| Threshold settings | `app/thresholds/page.tsx`, `lib/sensor-thresholds.ts` | Requires save/reload and per-user settings test |
| Threshold test utility | `app/threshold-test/page.tsx` | Requires browser interaction test |
| Profile and location | `app/profile/page.tsx` | Requires profile save/reload and location lookup test |
| Recommendations | `app/recommendations/page.tsx`, `lib/threshold-recommendations.ts` | Recommendation unit test exists; user decision persistence needs integration test |
| Daily summary | `app/daily-summary/page.tsx`, `lib/daily-sensor-summary.ts` | Requires data-range and empty-data integration tests |
| Weekly report | `app/weekly-report/page.tsx`, `lib/weekly-ai-report.ts` | Requires report-generation integration test |
| Safety/help content | `app/help/alert-settings/*/page.tsx`, `lib/safety-precautions.ts` | Requires manual content review |
| Anomaly detection | `lib/sensor-anomaly.ts`, `ai/anomaly_detection.py` | TypeScript unit-style script exists; end-to-end integration needs confirmation |

## Automated checks

GitHub Actions workflow `.github/workflows/ci.yml` runs:

- `npm ci`
- `npm run lint`
- `npm run build`
- `python -m unittest ai.test_adaptive_thresholds -v`

The workflow result is the source of truth for whether those checks pass on GitHub. Firebase integration, real sensor hardware, authentication, and visual browser flows need environment credentials and cannot be certified by static repository inspection alone.

## Adaptive learner safety constraints

- Adaptive values are experimental simulator/project values, not calibrated real-world safety limits.
- Fixed thresholds remain authoritative and must not be relaxed by learning.
- Hazard/warning readings pause learning.
- Do not deploy as a safety-critical or medical device without validation, fail-safe design, and hardware testing.
