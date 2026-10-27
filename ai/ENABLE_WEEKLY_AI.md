# Enable AI-written weekly recommendations

The recommendation endpoint is already implemented at `app/api/weekly-recommendations/route.ts`. It uses `OPENAI_API_KEY` only on the server and falls back to safety-checked recommendations when the key is missing or the API fails.

## 1. Create your own API key

1. Open the official OpenAI API key page: https://platform.openai.com/api-keys
2. Sign in to your OpenAI account.
3. Select a project if asked, then choose **Create new secret key**.
4. Copy the key and save it somewhere private. The full key is only shown at creation time.
5. Never paste the key into a chat, commit it to GitHub, or put it in a variable starting with `NEXT_PUBLIC_`.

## 2. Local development on your Mac

1. Open the `smart-spectacles` project folder in your code editor.
2. In the project root (the same folder as `package.json`), create a file named `.env.local`.
3. Add these two lines, replacing the placeholder with your secret key:

```dotenv
OPENAI_API_KEY=put_your_secret_key_here
OPENAI_RECOMMENDATION_MODEL=gpt-4.1-mini
```

4. Save the file. The repository's `.gitignore` excludes `.env.local`, so the secret should not be committed.
5. Stop and restart the Next.js development server so it reads the new environment variable.

## 3. If the app is deployed

Add the same two environment variables in your hosting provider's server-side environment-variable settings, then redeploy. Do not add the key to browser/client settings. If using GitHub Actions, add it under repository Settings → Secrets and variables → Actions as `OPENAI_API_KEY`; this alone does not configure a separate hosting provider.

## 4. Billing

ChatGPT subscriptions and API usage are billed separately. If the API platform asks you to set up billing, review its pricing and choose a budget you are comfortable with before enabling paid usage. OpenAI API billing guidance: https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform

## 5. Check it

After restarting/redeploying, open the Weekly AI Report page. If the API is not configured, the page still uses fallback advice. Once configured, the report may show AI-personalized recommendations. If API access or billing fails, the endpoint falls back rather than disabling the report.
