This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## Adaptive threshold learning (experimental)

The adaptive learner is a simulator/prototype feature. It must not be treated as a calibrated medical, environmental, or life-safety device.

### Run it

From the repository root, with Python available:

```powershell
python ai\adaptive_firebase_test.py
```

The runner reads sensor values from Firebase at `/devices/Prachi-spectacles-001/current.json`, writes dashboard results to `adaptive.json`, and persists internal learner state to `adaptive_state.json`. Keep the runner running while you want fresh adaptive results on the dashboard. Stop it with `Ctrl+C`; saved learning state is retained in Firebase.

### Learning behavior

- Each sensor needs 60 valid readings that do not trigger its fixed or current adaptive warning before its initial median baseline is established.
- After baseline establishment, the learner checks batches of 20 readings. A shift must persist for 3 consecutive batches before gradual adjustment begins.
- Hazardous/warning readings pause learning; the learner must not normalize a warning into ordinary behavior.
- Adaptation can make the configured fixed threshold more sensitive, but it cannot relax the fixed-threshold rule. Existing fixed thresholds remain authoritative.
- Learner state is restored at startup. Missing empty fields from Firebase REST responses are normalized safely; invalid/incompatible state is rejected.
- Values and limits are project/simulator units, not real-world calibrated safety limits.

### Regression tests

Run from the repository root:

```powershell
python -m unittest ai.test_adaptive_thresholds
```

The tests cover warning direction, baseline collection, hazard pausing, state round-tripping, Firebase-omitted empty fields, and rejection of out-of-range saved thresholds.
