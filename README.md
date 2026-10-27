# Ask Mabed

Anonymous questions with a calm, personal inbox. Built with React, Vite, and Supabase.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. In Supabase, open **Project Settings → API Keys** and copy the **Project URL** and **Publishable key** into `.env.local`.
3. In Supabase, open **SQL Editor**, create a new query, paste [`supabase/schema.sql`](./supabase/schema.sql), and click **Run**.
4. In Supabase, open **Authentication → URL Configuration** and add your local URL (`http://localhost:5173`) to **Redirect URLs**.
5. Run `npm install` and `npm run dev`.

The app displays a sample profile while credentials are absent. It does not save demo questions; configure Supabase before using real accounts.

## Current MVP

- Hash-based routes that work on GitHub Pages
- Public profile and anonymous question form
- Magic-link authentication
- Owner inbox
- Public shareable answer pages with Web Share, X, Facebook, and copy-link actions
- Simple initial-letter avatars
- Row Level Security schema

Profile creation and moderation controls are the next planned features. Never put a Supabase secret key or service-role key in this frontend.

If you already ran the original schema before the public-answer feature was added, run this additional policy in Supabase SQL Editor:

```sql
create policy "Answered questions are publicly readable" on public.questions for select using (
  status = 'answered' and answer is not null
);
```

## GitHub Pages deployment

1. Create a GitHub repository and push this project to its `main` branch.
2. In the repository, open **Settings → Pages**, choose **GitHub Actions** as the source.
3. Open **Settings → Secrets and variables → Actions → Variables**, then add:
   - `VITE_SUPABASE_URL`: your Supabase Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: your Supabase Publishable key
4. In Supabase, open **Authentication → URL Configuration** and add your Pages URL, for example `https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY/`, to **Redirect URLs**.
5. Push to `main`. The workflow in [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) will build and publish the site.

The app uses hash routes (`#/profile/name`) so public profile links work on GitHub Pages without server-side routing.
