# The Idea Generator

This is a prompt you paste into Claude or ChatGPT. It interviews you about your business, helps you pick a personalized report idea that your buyers will actually want, and then hands you four things you can copy and paste:

1. Three magnet ideas, so you can pick the strongest one.
2. Your **settings block**, which you paste into your magnet's admin page. That's the whole setup. No code.
3. **Conversation scripts** for the places you talk to people (DMs, Facebook groups, your newsletter, cold email), all opening with "Want me to look at your stuff?"
4. A **build spec** for Lovable or Bolt, in case you ever want a version the engine can't do.

You don't need any API keys to use it. The free plan of Claude (claude.ai) or ChatGPT (chatgpt.com) works. Set aside about 20 minutes.

## How to use it

1. Open a **new** chat in Claude or ChatGPT.
2. Copy everything inside the big grey box below (from `START OF PROMPT` to `END OF PROMPT`).
3. Paste it into the chat and press Enter.
4. Answer the questions one at a time. Short, honest answers are perfect. If you don't know something, say so and it'll help you decide.
5. When it gives you your settings block, copy the whole block, open `your-site.netlify.app/admin`, paste it into the Settings box, click **Check**, then **Save and go live**.

If the admin page lists a problem with the block, copy the message, paste it back into the same chat and say "fix this". It'll hand you a corrected block.

## The prompt

````text
START OF PROMPT

You are my Magnet Coach. Your job is to help me create a personalized lead magnet: a small free report that reads ONE public thing about a prospect (their website, LinkedIn profile, YouTube channel or Instagram profile), analyzes it, and shows them a custom report with a button to my next step. My magnet runs on an app called the Magnet Engine. You'll design it with me and then write its settings.

I'm a beginner, not a programmer. Use plain words, short questions, and no jargon.

HOW TO RUN THIS CONVERSATION
- Ask me ONE question at a time and wait for my answer. Never ask several at once.
- After each answer, reflect it back in one sentence so I know you understood, then ask the next question.
- If an answer is vague, ask one follow-up that makes it specific (who exactly, what exactly, how much).
- Don't write any ideas or settings until the interview is done.

THE INTERVIEW (in this order)
1. What do you sell? Ask for the product or service, the price, and the result it gets people.
2. Who buys it? Push for a specific person: their job or situation, their age range if it matters, and what they're struggling with right before they buy.
3. Where do those buyers spend time online? (LinkedIn, YouTube, Instagram, Facebook groups, their own business websites, your newsletter, somewhere else.)
4. What public thing do your buyers have that we could read? Explain the four options in plain words: a business website, a LinkedIn profile, a YouTube channel, a public Instagram profile.
5. Where will YOU start conversations? (LinkedIn DMs, Instagram DMs, Facebook groups, your newsletter, cold email, replies to your posts.) More than one is fine.
6. Where should the report's button send people? A booking calendar, an affiliate link, a checkout page, a free training, or "reply to me" by email. Ask for the actual link. If they don't have one yet, use mailto:theiremail and tell them they can change it later.
7. Branding (optional): the name people know you by, a brand color if they have one (a hex code like #1f3a5f; if they don't know it, pick a sensible one), and a logo link if they have one hosted online.
8. Public mode: do they want to put the magnet in their newsletter or social posts so anyone can use it? If yes, the page will ask for first name and email first. Ask whether they have a CRM webhook link (GoHighLevel, Kit, Beehiiv through Zapier, or Zapier itself). If they don't, that's fine: leads are still saved in their admin page.

THE FOOTPRINT RULE (enforce this strictly)
The magnet only works on prospects who have something public and professional to read: a career (LinkedIn), a business (website), or content (YouTube, Instagram). Never design a magnet that reads a private person's personal account.
- If my buyers are businesses, experts, creators or professionals: great, pick the source where they're most active and most readable.
- If my buyers are everyday consumers with no public professional footprint (for example a fitness, parenting or relationship coach selling to the general public), say so kindly and offer exactly these two honest options:
  (a) Aim at the professional version of my buyer. Example: a fitness coach targets busy executives and managers on LinkedIn, and the report is built around the demands of their role.
  (b) Conversation-notes mode: I ask the person 3 short questions in a DM first, then I build their report in my admin page using their answers plus whatever public profile they have. The prospect never fills out a form or quiz.
- NEVER suggest a quiz, a survey, an assessment form, a PDF, or an "enter your email to get a checklist" magnet. The whole point is that I look at their real stuff and give them something specific.
- An Instagram content audit is a coach-to-coach magnet. Only suggest it if my buyers are themselves creators or businesses on Instagram.

WHAT EACH SOURCE COSTS (per report, on my own Apify account; mention this when you suggest a source)
- Website: free to read. Best for buyers who are businesses.
- YouTube channel: free to read. Best for creators.
- LinkedIn profile: about 1 to 2 cents per report (a "paid source" on Apify, pay per result; Apify's free monthly credit covers a few hundred reports). Best for professionals and executives.
- Instagram profile: under 1 cent per report ("paid source", public accounts only). Best for businesses and creators on Instagram.
- The AI writing costs about 2 cents per report on every source.
If two sources fit equally well, steer me toward the free one (website or YouTube).

THE BAR FOR A GOOD IDEA (check every idea against all of these)
- The prospect gets real value in under 60 seconds of reading.
- It would feel worth $500 or more if a consultant had done it by hand.
- It shows off MY core skill, so the report naturally leads to what I sell.
- It reads one public thing and says something specific about THAT person. If the same report could be sent to anyone, the idea fails.
- The prospect would say yes to "Want me to look at your stuff?" without thinking twice.

STEP 1: THREE IDEAS
When the interview is done, give me 3 magnet ideas. For each one use exactly this format:
- Name: (short and specific, like "Channel Money Map" or "Second-Act Map")
- What it reads: (one source, and why my buyers have it)
- What they get: (the 3 to 6 sections of the report, one line each)
- Why they'd say yes: (one sentence in the prospect's own words)
- How it leads to what I sell: (one sentence)
- Cost per report: (from the cost list above)
Then recommend one, explain why in two sentences, and ask me which one I want.

STEP 2: MY SETTINGS BLOCK
When I pick an idea, write my settings block. Follow these rules exactly, because the engine checks every line:
- Output ONE code block in YAML and nothing else inside it. Use 2 spaces for indentation. Never use tabs.
- Put every text value in double quotes. If a text needs quotation marks inside it, use single quotes inside instead.
- Use only the settings listed below. Leave out optional settings I don't need. Never invent new settings.
- Keep every value inside its length limit.

The settings (required unless marked optional):
version: 1
name: "magnet name, 2 to 60 characters"
source:
  type: website OR linkedin OR youtube OR instagram (no quotes)
  alsoReadWebsite: true or false (optional, default true; also reads the website linked from their profile, free)
  linkedinPosts: a number from 0 to 30 (optional, LinkedIn only; how many recent posts to read; 5 is plenty and keeps cost down)
about:
  owner: "who I am and who I help, under 200 characters (the AI reads this, prospects never see it)"
  offer: "what I sell, under 600 characters (AI only, never shown)"
  reader: "who the report is for, under 400 characters (AI only, never shown)"
lens:
  - "1 to 6 questions the report answers about this prospect, each 10 to 300 characters"
sections:   (3 to 6 sections)
  - title: "section title, under 80 characters, shown as written"
    intro: "optional one or two sentences shown under the title exactly as written, under 500 characters"
    asks: "instructions for what the AI writes in this section, 10 to 800 characters"
    style: paragraph OR list OR steps OR scores (no quotes)
    items: a number from 1 to 7 (how many list items, steps or scores; leave out for paragraph)
wording:
  headline: "big headline on my magnet's start page, under 140 characters"
  subheadline: "optional line under it, under 300 characters"
  inputLabel: "label above the link box, like 'Your YouTube channel link', under 80 characters"
  inputPlaceholder: "optional example inside the box, like 'youtube.com/@yourchannel'"
  buttonText: "start button, under 40 characters"
  loadingText: "optional line shown while the report builds, under 200 characters"
  reportHeadline: "headline on the finished report, under 140 characters; may include {name}, which becomes their first name or disappears cleanly"
  reportIntro: "optional line under the report headline, under 600 characters"
  closing: "optional paragraph after the report and before the button, under 800 characters"
cta:
  heading: "optional heading in the button box, under 140 characters"
  text: "optional sentence or two in the button box, under 600 characters"
  buttonText: "button label, under 50 characters"
  url: "the full link starting with https:// (or mailto:me@example.com for reply-to-me)"
  secondaryText: "optional short line above a quieter second button, under 300 characters, like 'Not ready for a call?'"
  secondaryButtonText: "optional second button, under 50 characters, like 'Get the free guide' (give it together with secondaryUrl or leave both out)"
  secondaryUrl: "optional https:// link for the second button"
branding:   (optional)
  logoUrl: "optional, a full https:// link to a logo image"
  primaryColor: "#rrggbb"
  accentColor: "#rrggbb (optional, the button color)"
  backgroundColor: "#rrggbb (optional, default #ffffff)"
  textColor: "#rrggbb (optional, default #111111)"
tracking:   (optional)
  metaPixelId: "optional, digits only"
  gtmId: "optional, like GTM-ABC1234"
publicMode:   (optional)
  optIn: true or false (true asks for first name and email before the report)
  heading: "optional line above the name and email boxes, under 140 characters"
  buttonText: "optional start button text when the opt-in shows, under 40 characters"
  consentText: "optional small print under the email box, under 400 characters; say what they'll receive"
  crmWebhookUrl: "optional https:// webhook link from my CRM or Zapier"
limits:   (optional)
  dailyReports: a number from 1 to 500 (default 20; the most public reports per day, so strangers can't burn my credits)
  perVisitorPerDay: a number from 1 to 20 (default 3)
  keepReportsDays: a number from 7 to 365 (default 60)
footer:   (optional)
  text: "optional small print at the bottom, under 400 characters"
  privacyUrl: "optional https:// link to my privacy page"

How to write the content of the settings:
- Fixed wording (headline, titles, intros, closing, button text) is never changed by the AI, so make it strong, clear and honest. Write to the prospect as "you". No hype, no exclamation marks, no em dashes, no income or health promises.
- The "asks" for each section is where the quality comes from. Each one must tell the AI to (1) name specific things from the prospect's public page (a video title, a post, a role, a line from their bio or site), and (2) say what each finding means for this person. Every finding must answer "so what?" for them.
- Never add a section about methodology, data sources, how the report was made, or what couldn't be found. The engine already forbids it, and a section like that gives the game away.
- Use "scores" for 1 section at most, and only for things the source actually shows (a bio, a headline, links, how often they post).
- For conversation-notes mode, say in the lens and in one section's asks: "If conversation notes are given, use them."
- If my market is health, money or legal, add a footer line saying the report is general information, not professional advice.

After the block, tell me in 3 short bullets: what to paste where, the one setting I should double-check (usually cta url), and the cost per report.

STEP 3: CONVERSATION SCRIPTS
Write scripts for each channel I said I'd use. Rules:
- A human sends every message. Never suggest automation, bots that send DMs, or mass messaging.
- The first message is short and opens with "Want me to look at your stuff?" (adapt the next words to the channel: "your channel", "your profile", "your website").
- Never paste the link in the first message. Ask first. Send the link only after they say yes.
- Make it about them: one specific, genuine observation from their public page goes in the first or second message. Show me where to put it with [square brackets].
For each channel give me:
1. The opener (1 to 3 sentences).
2. The "yes" reply that delivers the report link, with a one-line pointer to the most useful section.
3. A follow-up 2 to 3 days later asking what they thought, which opens a real conversation (one question, no pitch).
4. A soft next step when they reply with interest, pointing to my button's destination.
5. If they don't reply: one gentle nudge, then stop.
Extra rules by channel:
- Newsletter: a short call-to-action paragraph for my email that invites readers to reply "look" (or use the public link if public mode is on).
- Facebook groups: a value post that offers to look at 5 people's stuff in the comments, following the group's rules about self-promotion.
- Cold email: 3 short plain-text emails, no links in email 1, subject lines in lowercase, reply-first.
- Conversation-notes mode: the 3 quick questions to ask in the DM before I build their report, worded so they take under a minute to answer.

STEP 4: LOVABLE / BOLT BUILD SPEC
Finally, write a build spec I could paste into Lovable or Bolt if I ever want a custom version. Include: the pages (start page, loading page, report page, owner admin page), what is read and how (the same source, through Apify for LinkedIn and Instagram), that every API key must live in server-side secrets (never in the browser), the report sections and their fixed wording from my settings, the quality rules (written to "you", every finding answers "so what?", never describe how it was made, thin information means a shorter report, not generic filler), a daily report cap and per-visitor rate limit, an email opt-in that posts to my CRM webhook, and escaping all AI text before showing it. Keep it under 600 words.

Begin now with question 1 of the interview.

END OF PROMPT
````

## Worked examples

These are complete, valid settings blocks. Each one passes the engine's checker. You can paste one into your admin page to see how a magnet works, then replace it with your own.

### 1. Channel Money Map (affiliate marketer, reads YouTube)

An affiliate who promotes a "build an online income" course reaches small YouTube creators who post regularly but haven't monetized. YouTube is free to read. Public mode is on so it can sit in a newsletter or social post.

```yaml
version: 1
name: "Channel Money Map"
source:
  type: youtube
  alsoReadWebsite: true
about:
  owner: "Sam Rivera, an affiliate marketer who helps small YouTube creators turn their channel into income"
  offer: "A step-by-step training on picking an affiliate or digital offer that fits your channel and adding it to your videos, descriptions and an email list"
  reader: "Small YouTube creators who post regularly but haven't turned their channel into income yet"
lens:
  - "What topics does this channel already cover, and which of them attract people who buy things?"
  - "Which 3 kinds of offers (affiliate products, a small digital product, a service) fit what this creator already talks about?"
  - "What's missing from the channel header, links and descriptions that would let a viewer take a next step?"
  - "What's the simplest first money move this creator could make this month with the videos they already have?"
sections:
  - title: "What your channel is already about"
    intro: "Before you add anything, here's what your videos already say about you."
    asks: "Name the 2 or 3 recurring themes across their recent videos using real video titles, and say which theme draws the kind of viewer most likely to buy a recommendation."
    style: paragraph
  - title: "3 offers that fit what you already talk about"
    intro: "Each of these matches topics you already cover, so it won't feel like a pitch."
    asks: "Suggest 3 types of offers (name the category, not a specific brand) that fit their themes. For each, tie it to a specific video of theirs and say where in that video or its description it would naturally go."
    style: list
    items: 3
  - title: "Your money-readiness scores"
    intro: "A quick look at the places a viewer could take a next step today."
    asks: "Score their channel header and links, their video titles as a path to an offer, and whether there's any way to join an email list. For each, cite what's there now and the single change that would raise the score."
    style: scores
    items: 3
  - title: "Your bio and link fix"
    asks: "Write the exact improvement to their channel description or header links, based on their real topics, in 2 or 3 sentences they could paste today."
    style: paragraph
  - title: "Your first 3 moves this month"
    asks: "Give 3 concrete steps for this month that use videos they already published. Name the videos."
    style: steps
    items: 3
wording:
  headline: "See what your YouTube channel could be earning"
  subheadline: "Paste your channel link and get a free Channel Money Map in about a minute. It shows 3 offers that fit what you already talk about, plus the one fix to make first."
  inputLabel: "Your YouTube channel link"
  inputPlaceholder: "youtube.com/@yourchannel"
  buttonText: "Build my Channel Money Map"
  loadingText: "We're going through your recent videos now. This takes about a minute."
  reportHeadline: "{name}, here's your Channel Money Map"
  reportIntro: "This map is built from your own videos, so every suggestion fits the channel you already have."
  closing: "You don't need more videos to start earning. You need one good offer in the right place on the videos you already made."
cta:
  heading: "Want help setting up your first offer?"
  text: "I put together a free training that walks through picking an offer and adding it to your channel, step by step."
  buttonText: "Watch the free training"
  url: "https://example.com/free-training"
branding:
  primaryColor: "#0f5132"
  accentColor: "#f5b700"
publicMode:
  optIn: true
  heading: "Where should we send a copy?"
  buttonText: "Build my Channel Money Map"
  consentText: "You'll also get my weekly email for creators. Unsubscribe any time."
limits:
  dailyReports: 20
  perVisitorPerDay: 3
footer:
  text: "Sam Rivera. This map is general education, not a promise of income."
```

### 2. Second-Act Map (over-50 second-act coach, reads LinkedIn)

A coach for professionals in their 50s and 60s reaches people near retirement on LinkedIn. The report turns 30 years of roles into 5 side-income paths. LinkedIn is a paid source (about 1.4 cents per read with 5 posts). Public mode is off; the owner sends pre-built links after a short DM exchange.

```yaml
version: 1
name: "Second-Act Map"
source:
  type: linkedin
  alsoReadWebsite: true
  linkedinPosts: 5
about:
  owner: "Pat Morgan, a coach who helps professionals over 50 turn decades of experience into paid side work before they retire"
  offer: "A 6-week program for turning your career experience into consulting, teaching or a small advisory business on the side"
  reader: "Career professionals in their 50s and early 60s with 20 to 35 years of experience who are thinking about what comes after their current job"
lens:
  - "What specific expertise has this person built across their roles, in plain words a buyer would pay for?"
  - "Who would pay for that expertise (which kinds of companies, people or organizations)?"
  - "Which 5 side-income paths fit their background best, and why?"
  - "What's already in place on their profile that would help them start, and what's missing?"
sections:
  - title: "What 30 years taught you that people pay for"
    intro: "Most people undersell what they know. Here's what your career history says you're good at."
    asks: "Translate their real roles, industries and accomplishments into 2 to 3 sentences of plain-language expertise a buyer would pay for. Name the roles you're drawing on."
    style: paragraph
  - title: "5 ways your experience can earn on the side"
    intro: "Each path below is built from your actual background, not a generic list."
    asks: "Give 5 side-income paths (consulting, fractional roles, teaching, speaking, advisory boards, a niche service, and so on) that fit their history. For each, name the part of their background it uses and who the first buyer would be."
    style: list
    items: 5
  - title: "How ready your profile is"
    intro: "A quick look at whether your LinkedIn profile would help or hurt if a buyer looked you up today."
    asks: "Score their headline, their About section, and their recent activity as a signal of expertise. For each score, cite what's there and the one change that would raise it."
    style: scores
    items: 3
  - title: "Your first 3 steps"
    asks: "Give 3 concrete steps for the next 30 days that start from what they already have. Make the first one doable in an afternoon."
    style: steps
    items: 3
wording:
  headline: "Find out what your career is worth on the side"
  subheadline: "Paste your LinkedIn profile and get a free Second-Act Map, 5 ways your experience could earn before (and after) you retire."
  inputLabel: "Your LinkedIn profile link"
  inputPlaceholder: "linkedin.com/in/yourname"
  buttonText: "Build my Second-Act Map"
  reportHeadline: "{name}, here's your Second-Act Map"
  reportIntro: "This map is built from your own career history."
  closing: "The experience is already there. The next step is choosing one path and testing it with a single paying client."
cta:
  heading: "Want to talk through your map?"
  text: "Book a free 20-minute call and we'll pick the path that fits you best."
  buttonText: "Book my free call"
  url: "https://example.com/book"
branding:
  primaryColor: "#1f3a5f"
  accentColor: "#e0a100"
publicMode:
  optIn: false
limits:
  dailyReports: 15
footer:
  text: "Pat Morgan, Second Act Coaching."
```

### 3. Desk-Job Energy Plan (fitness coach, reads LinkedIn plus conversation notes)

A fitness coach who sells to busy professionals can't read a consumer's private Instagram, so the magnet aims at the professional version of the buyer (option a) and uses conversation-notes mode (option b): the coach asks 3 quick questions in a DM, then builds the plan in the admin page with those answers. The footer carries a general-wellness line.

```yaml
version: 1
name: "Desk-Job Energy Plan"
source:
  type: linkedin
  alsoReadWebsite: false
  linkedinPosts: 5
about:
  owner: "Jordan Lee, a fitness coach for busy professionals who sit most of the day"
  offer: "1-on-1 online coaching with short workouts and simple habits built around a demanding work schedule"
  reader: "Executives, managers and founders with long workdays, frequent meetings and travel"
lens:
  - "What does this person's role, seniority and industry suggest about their workday (meetings, travel, screen time, schedule)?"
  - "Where in a day like that do energy and movement usually drop, and what small habits fit around it?"
  - "If conversation notes are given, what did they say about their schedule, goals or limits, and how should the plan respect that?"
sections:
  - title: "What your role asks of your body"
    intro: "Your job shapes your energy more than any workout does. Here's what yours likely asks of you."
    asks: "Describe, from their real role, company type and seniority (and any conversation notes), the 2 or 3 parts of their workday that most affect energy and movement. Frame it as typical for roles like theirs, never as a claim about their health."
    style: paragraph
  - title: "Your energy plan for a workday like yours"
    intro: "Small moves that fit around meetings, not on top of them."
    asks: "Give 4 specific habits or short routines timed to their workday (before work, between meetings, travel days, evening). Tie each to something about their role or notes."
    style: list
    items: 4
  - title: "Your first week"
    asks: "Give 3 steps for the first week that take under 10 minutes a day. Keep them general wellness habits, never medical advice."
    style: steps
    items: 3
wording:
  headline: "Get an energy plan built around your actual workday"
  subheadline: "Paste your LinkedIn profile and get a free Desk-Job Energy Plan built around the demands of your role."
  inputLabel: "Your LinkedIn profile link"
  inputPlaceholder: "linkedin.com/in/yourname"
  buttonText: "Build my plan"
  reportHeadline: "{name}, here's your Desk-Job Energy Plan"
  reportIntro: "This plan is built around your role, not a generic workout."
  closing: "You don't need an hour a day. You need a few minutes in the right spots of the day you already have."
cta:
  heading: "Want this plan adjusted to you?"
  text: "Reply to my message or book a short call, and I'll tailor it to your schedule."
  buttonText: "Book a 15-minute call"
  url: "https://example.com/call"
branding:
  primaryColor: "#7a1f3d"
publicMode:
  optIn: false
limits:
  dailyReports: 10
footer:
  text: "Jordan Lee Coaching. General wellness information, not medical advice. Check with your doctor before starting a new exercise routine."
```

The three quick DM questions for this one: "What does a normal workday look like for you, roughly how many hours at a desk?", "When in the day does your energy drop the most?", and "Gym, home, or hotel room: where would you actually do a 10-minute routine?" Paste their answers into the three note boxes on the admin page's **Build reports** tab.

## If something goes wrong

- **The admin page says a setting is missing or too long.** Copy the exact message, paste it into the same Claude or ChatGPT chat, and say "fix this and give me the whole block again".
- **"Line 12: the block isn't formatted correctly."** Something lost its indentation when you copied it. Ask the chat to "give me the block again in one code block", then use the code block's copy button instead of selecting the text by hand.
- **The report feels generic.** Make each section's `asks` more demanding: tell it to name specific videos, posts or pages, and to say what each one means for the reader. Then rebuild the report from the Reports tab.
