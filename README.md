# Instagram Lead Bot for Rohit Sharma

This project runs an Instagram DM and story-reply bot for `@rohittkrsharma`.

It does four main jobs:

- receives Instagram webhook events from Meta
- generates playful but respectful AI replies with OpenAI
- collects and confirms lead details
- writes lead data into Google Sheets

## Lead data captured

The bot stores these columns in your main sheet:

- Name
- Instagram handle
- Phone / email
- Interest
- Budget
- Location
- Source
- Conversation summary
- Lead status
- Last contact date

It also creates a second sheet called `ThreadControl` to persist mute state and per-thread lead snapshots.

## Emergency stop rules

If a message in a thread is exactly `..` or `STOP`, the bot marks that thread as muted and stops replying there.

## Setup

1. Copy `.env.example` to `.env`.
2. Put your new Meta access token in `.env`. Do not reuse the token that was pasted in chat.
3. Add your OpenAI API key.
4. Add your Google service account email and private key.
5. Confirm the Google Sheet is shared with the service account as `Editor`.
6. Install dependencies with `npm install`.
7. Start locally with `npm run dev`.

## Meta configuration

Use these webhook settings in your Meta app:

- Callback URL: `https://your-domain/webhook`
- Verify token: same value as `META_VERIFY_TOKEN`

Subscribe your app to the Instagram messaging events required by your app dashboard.

## Railway deployment

1. Create a new Railway project from this folder.
2. Add all environment variables from `.env`.
3. Set the start command to `npm start`.
4. Copy the Railway public URL into `BASE_URL`.
5. Set the same URL plus `/webhook` in Meta.

## Test without Meta

After the server starts, send a local test request:

```bash
curl -X POST http://127.0.0.1:3000/test/reply \
  -H "Content-Type: application/json" \
  -d '{"messageText":"hi","senderId":"demo-user","instagramHandle":"demo_user","source":"dm"}'
```

## Notes

- This project assumes official Meta access.
- `Instagram handle` is currently derived from the sender ID unless you enrich it with extra profile lookup logic later.
- For production scale, moving thread state from Sheets to a dedicated database would be cleaner, but this setup keeps your MVP simple and deployable.
