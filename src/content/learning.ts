/**
 * LIFEKIT Learning Library — original short lessons written for this app.
 *
 * Body text uses a deliberately small formatting subset, rendered by a safe renderer
 * that builds React elements (no innerHTML anywhere):
 *   ## heading        - bullet        1. numbered item
 *   > callout         **bold**        `inline code`
 *
 * Third-party material is never copied. "Further reading" links point at official or
 * public-interest sources so the learner can go to the original themselves.
 */

export interface LessonSectionSource {
  label: string;
  url: string;
  note: string;
}

export interface Lesson {
  id: string;
  category: LessonCategory;
  title: string;
  summary: string;
  minutes: number;
  level: 'beginner' | 'intermediate';
  body: string;
  furtherReading: LessonSectionSource[];
  reviewedOn: string;
}

export type LessonCategory =
  | 'computer-basics'
  | 'languages'
  | 'maths'
  | 'study-methods'
  | 'personal-finance'
  | 'digital-safety'
  | 'career-skills';

export interface LessonCategoryInfo {
  id: LessonCategory;
  title: string;
  description: string;
}

export const LESSON_CATEGORIES: LessonCategoryInfo[] = [
  { id: 'computer-basics', title: 'Computer basics', description: 'Files, folders, spreadsheets and the everyday skills that make a device feel familiar.' },
  { id: 'languages', title: 'Language learning', description: 'Practical methods for vocabulary, listening and speaking practice you can do alone.' },
  { id: 'maths', title: 'Mathematics', description: 'Everyday number skills: percentages, averages, interest and quick estimation.' },
  { id: 'study-methods', title: 'Study methods', description: 'Evidence-informed techniques for remembering more with less time.' },
  { id: 'personal-finance', title: 'Personal finance education', description: 'How money records, budgets and interest actually work. Education, not advice.' },
  { id: 'digital-safety', title: 'Digital safety', description: 'Short lessons that pair with the Safety centre checklists.' },
  { id: 'career-skills', title: 'Career skills', description: 'Résumés, interviews and workplace communication in plain language.' },
];

export const LESSONS: Lesson[] = [
  {
    id: 'files-folders',
    category: 'computer-basics',
    title: 'Files and folders: a mental model that never fails',
    summary: 'A folder is a box. A file lives in exactly one box. Once that clicks, every device makes sense.',
    minutes: 6,
    level: 'beginner',
    body: `A storage device is one very large cabinet. Folders are boxes inside it, and a file sits in exactly one box. There is no exceptions to this rule on any phone, laptop or desktop — the pictures look different, but the structure is identical.

## The three operations that cover almost everything
- **Create**: make a folder, then put files in it. Name it so that future-you understands it in six months.
- **Move**: drag or use Cut and Paste to put a file in a different box. The file does not exist in two places at once.
- **Copy**: makes a second file. Editing one copy does not change the other.

## Naming that saves you later
Use a date, a short description and a version: \`2026-03-rent-receipt.pdf\`. Avoid names like \`final\`, \`final2\`, \`newnew\`. Sorting by name then sorts by date automatically — but only if you write the date in year-month-day order.

## Where things actually are
- **Downloads** is a temporary box. It fills up and it is the first place malware hides. Empty it monthly.
- **Documents** is for things you created and want to keep.
- **Desktop** is a working surface, not a filing cabinet.

## The habit worth building
Once a week, spend five minutes moving new files out of Downloads into a named folder, and delete what you no longer need. Five minutes a week prevents the hour-long search that happens when you need a document urgently.`,
    furtherReading: [
      { label: 'Microsoft: organise files with folders', url: 'https://support.microsoft.com/en-us/windows/', note: 'General file-management guidance from a platform vendor.' },
      { label: 'Google: manage files in Google Drive', url: 'https://support.google.com/drive/answer/2375091', note: 'Cloud equivalent of the same structure.' },
    ],
    reviewedOn: '2026-10-11',
  },
  {
    id: 'spreadsheet-basics',
    category: 'computer-basics',
    title: 'Spreadsheets without fear: five functions do most of the work',
    summary: 'Sum, average, count, if and sort. If you can do these five things, you can build a personal tracker.',
    minutes: 9,
    level: 'beginner',
    body: `A spreadsheet is a grid of boxes. Each box holds a number, a word, or a formula that starts with \`=\`. That is the whole idea; everything else is convenience.

## The five functions
1. **SUM** — adds a range. \`=SUM(B2:B30)\` adds everything from B2 to B30.
2. **AVERAGE** — the mean of a range. \`=AVERAGE(C2:C13)\` gives a monthly average.
3. **COUNT / COUNTA** — how many cells contain numbers, or anything at all. Useful for checking nothing was missed.
4. **IF** — makes a decision. \`=IF(D2>C2,"over","ok")\` compares two cells.
5. **Sort and filter** — not functions, but the fastest way to find the largest, smallest or a specific row.

## Three mistakes beginners make
- Typing totals by hand. They go stale the moment a row changes. Always use a formula.
- Mixing units in one column. Keep one currency, one unit, one decimal style per column.
- Leaving rows blank in the middle of a range. \`SUM\` will still work, but \`COUNTA\` will mislead you. Keep data contiguous.

## A personal tracker in ten minutes
Columns: **Date, Type, Category, Amount, Note**. Add a summary block above or beside it using SUM over filtered ranges. Then freeze the header row so it stays visible while you scroll.

> A tracker you actually fill in beats a beautiful one you abandon. Start with five columns; add complexity only when you feel the need.`,
    furtherReading: [
      { label: 'Google Sheets function list', url: 'https://support.google.com/docs/table/25273', note: 'Reference for the functions described above.' },
      { label: 'LibreOffice Calc documentation', url: 'https://documentation.libreoffice.org/en/english-documentation/', note: 'Free office suite documentation.' },
    ],
    reviewedOn: '2026-10-11',
  },
  {
    id: 'vocab-habit',
    category: 'languages',
    title: 'A vocabulary habit that survives a busy week',
    summary: 'Fifteen words a week, reviewed at widening intervals, beats a weekend of cramming.',
    minutes: 7,
    level: 'beginner',
    body: `You do not need an app, a tutor or three free hours a day. You need a small number of words and a review schedule that fights forgetting.

## Why small and frequent wins
Memory fades fastest in the first day. If you review a new word shortly after learning it, again the next day, then after three days and then after a week, each review resets the curve and the word sticks far longer. This is spaced practice, and it is one of the most reliably reproduced findings in learning research.

## The routine
1. Choose **five words a day** — twelve to fifteen a week. Fewer if your week is heavy.
2. For each word write: the word, its meaning in your own language, one sentence you would actually say, and the sound if pronunciation is hard.
3. Say it out loud once. Silent study builds reading knowledge only.
4. Review at day 1, day 3 and day 7. Tick a box each time; drop words you already know.
5. Every Sunday, test yourself on the previous week's list by covering the meanings.

## Where words come from
Mine your own life: the words for things you buy, the instructions on your phone, job adverts in your field, and news headlines. Words you have a personal reason to use are remembered far better than random lists.

> Track your streak in LIFEKIT's habit tracker rather than trusting memory. A visible streak is a surprisingly effective motivator, and a missed day is information, not failure.`,
    furtherReading: [
      { label: 'British Council LearnEnglish', url: 'https://learnenglish.britishcouncil.org/', note: 'Free official English learning materials and exercises.' },
      { label: 'Voice of America: Learning English', url: 'https://learningenglish.voanews.com/', note: 'Slower-paced audio and text for listening practice.' },
    ],
    reviewedOn: '2026-10-11',
  },
  {
    id: 'speaking-alone',
    category: 'languages',
    title: 'Speaking practice when you have no partner',
    summary: 'Shadowing, self-recording and a two-minute daily monologue build speaking without a conversation partner.',
    minutes: 8,
    level: 'intermediate',
    body: `Speaking is a physical skill as much as a knowledge one. You can practise it alone, and it works, provided you actually open your mouth.

## Method 1: shadowing (10 minutes)
Pick a short clip of a fluent speaker — a news item or a podcast, ideally 60 seconds. Play one sentence, pause, and repeat it immediately, copying rhythm and stress rather than word-by-word accuracy. Repeat the whole clip three times. This trains the muscles and the ear together.

## Method 2: the two-minute monologue (5 minutes)
Set a timer and talk about one prompt: my day, my work, a problem I solved, a place I want to visit. Do not write a script. Record it on your phone.

Then listen back once and note:
- Words you kept switching to your first language. Learn those five.
- Long silences. Next time, use a filler you would naturally say and keep going.
- Grammar slips you notice yourself. That self-noticing is the learning.

## Method 3: read aloud (5 minutes)
Read a paragraph of anything out loud, slowly, at a steady pace. It builds fluency in connected speech that reading silently never touches.

## A weekly shape
- Monday to Friday: 10 minutes shadowing plus one two-minute monologue.
- Saturday: listen to your three recordings from the week and count improvement.
- Sunday: rest your voice, review the words you looked up.

> Recordings are uncomfortable to hear at first. That discomfort is exactly why they work: you hear the gap between what you intended and what came out.`,
    furtherReading: [
      { label: 'BBC Learning English — pronunciation', url: 'https://www.bbc.co.uk/learningenglish/', note: 'Free audio and pronunciation guidance.' },
      { label: 'Forvo — pronunciation dictionary', url: 'https://forvo.com/', note: 'Community recordings of words by native speakers.' },
    ],
    reviewedOn: '2026-10-11',
  },
  {
    id: 'percentages',
    category: 'maths',
    title: 'Percentages in everyday life: discounts, tax and interest',
    summary: 'One method — find one percent, then multiply — handles almost every percentage you will meet.',
    minutes: 7,
    level: 'beginner',
    body: `A percentage is simply a fraction with 100 as the bottom number. 15% means 15 out of 100, or 0.15.

## The single method
To find any percentage of an amount: **divide by 100 to get 1%, then multiply by the percentage.**

- 15% of 2,400: 2,400 ÷ 100 = 24, then 24 × 15 = 360.
- 7.5% of 900: 900 ÷ 100 = 9, then 9 × 7.5 = 67.5.

For a discount: **subtract**. A 30% discount on 2,000 means you pay 2,000 − 600 = 1,400. Equivalently, multiply by 0.7 — a quick mental shortcut worth memorising: 10% off → ×0.9, 25% off → ×0.75, 50% off → ×0.5.

## The trap that catches most people
Two successive discounts do **not** add. 20% off then another 20% off is not 40% off. It is 0.8 × 0.8 = 0.64, so 36% off. The same logic applies to price rises: a price that rises 20% and then falls 20% ends at 96% of the original, not 100%.

## Tax on top versus included
If tax is **added**, multiply the price by (1 + rate). If tax is **included**, divide by (1 + rate) to find the base. Mixing these up changes the answer, so read the receipt wording carefully.

## A quick sanity check
Estimate the answer with rounded numbers first. If your calculation for "about 10% of 2,400" gives 360, you have made a decimal error — the estimate (240) was closer. Estimation catches most arithmetic mistakes before they cost you money.`,
    furtherReading: [
      { label: 'Khan Academy: percentages', url: 'https://www.khanacademy.org/math/pre-algebra/pre-algebra-ratios-rates', note: 'Free practice exercises and explanations.' },
    ],
    reviewedOn: '2026-10-11',
  },
  {
    id: 'averages-spread',
    category: 'maths',
    title: 'Averages hide things: mean, median and spread',
    summary: 'Two sets of numbers can share an average and describe completely different lives.',
    minutes: 8,
    level: 'intermediate',
    body: `Imagine two families. Family A spends 10,000, 10,000 and 10,000 a month. Family B spends 2,000, 8,000 and 20,000. Both average 10,000. Only one of them has a predictable month.

## The three words that matter
- **Mean** — add everything and divide by how many. Useful, but pulled strongly by one extreme value.
- **Median** — the middle value when sorted. If five people earn 5, 6, 7, 8 and 90 thousand, the mean is 23.2 thousand but the median is 7 thousand. The median describes the typical person far better.
- **Spread** — the range between the lowest and highest. Two datasets with identical means can have wildly different spreads, and spread is what makes budgeting hard or easy.

## Where this bites in real life
- **Salary figures** published as "average" can be skewed by a few very high earners. Ask for the median.
- **Electricity bills**: a mean is fine for estimating, but a single summer peak may double your budget. Look at your highest month.
- **Averages of averages** are usually wrong. Average the underlying numbers instead.

## What to do with this
When you record a month of expenses, look at three numbers rather than one: your total, your median transaction size, and your largest single expense. The largest expense is often the one worth negotiating — a bill, a subscription, an instalment.

> If your average spending and your median spending are far apart, you have occasional large outflows. Budget for them monthly instead of being surprised quarterly.`,
    furtherReading: [
      { label: 'Our World in Data: how to read statistics', url: 'https://ourworldindata.org/how-to-read-our-world-in-data', note: 'Practical guidance on interpreting averages and charts.' },
    ],
    reviewedOn: '2026-10-11',
  },
  {
    id: 'retrieval-practice',
    category: 'study-methods',
    title: 'The recall loop: studying that feels harder and works better',
    summary: 'Re-reading feels productive and mostly is not. Testing yourself feels awkward and is how memory forms.',
    minutes: 7,
    level: 'beginner',
    body: `Most students study by reading notes again and highlighting. The material starts to feel familiar, which the brain misreads as "I know this". Under exam pressure, the knowledge is not there.

## The loop
1. **Learn** the material once, actively: read, watch, listen.
2. **Close it.** Look away and write down everything you remember — headings and key points, not prose.
3. **Check** against the source and mark what you missed.
4. **Fix** only the gaps; do not re-read the whole chapter.
5. **Repeat after a delay** — tomorrow, then in three days, then in a week.

Each cycle is short. The delay is what makes it work.

## Why it works
Retrieving information is what strengthens the path back to it. Re-reading only strengthens recognition. This is why the same hour spent testing yourself generally produces better retention than the same hour re-reading.

## Practical forms
- Blank paper recall — no tools, just memory and a pen.
- Question cards you write yourself, with the answer on the back.
- Explaining the topic out loud to an imaginary classmate; the gaps become obvious immediately.
- Past papers under time pressure, then marking against the official scheme.

## Making it fit a real week
Three 40-minute blocks across a week beat one two-hour block. Study one subject, then a different one, then return to the first: switching topics slightly slows each session but improves later recall.

> Feeling that a session was difficult is not evidence it went badly. Difficult retrieval is the mechanism, not a side effect.`,
    furtherReading: [
      { label: 'The Learning Scientists — retrieval practice', url: 'https://www.learningscientists.org/retrieval-practice', note: 'Research summaries and downloadable study guides.' },
    ],
    reviewedOn: '2026-10-11',
  },
  {
    id: 'study-week-plan',
    category: 'study-methods',
    title: 'Planning a study week you can actually follow',
    summary: 'Plan by available hours, not by hope. Put the hardest subject where your energy is highest.',
    minutes: 6,
    level: 'beginner',
    body: `A plan that assumes eight perfect hours a day collapses on day two. Plan for the week you will actually have.

## Step 1: count real hours
Write down the hours you genuinely have — after work, travel, meals and sleep. A realistic week is often 10 to 14 hours, not 40. Half of planning is honesty about this number.

## Step 2: rank by difficulty and deadline
Three tiers: **urgent and hard** (needs your best hours), **important and steady** (needs routine), **easy maintenance** (fits in gaps — vocabulary, flashcards).

## Step 3: place blocks
- Hard subjects in your best two-hour window, protected from interruptions.
- Steady subjects in fixed daily slots so they become automatic.
- Easy maintenance in travel and waiting time.

## Step 4: leave 20% empty
Every week something goes wrong. If your plan has no slack, one bad day wrecks it. Break the leftover time into 20-minute slots you can allocate when a session is lost.

## Step 5: review on Sunday, for five minutes
Ask three questions: what did I complete, what slipped, and what is the single most important thing next week? Adjust, do not restart. A plan that is rewritten from scratch every week is a plan you are not using.

> One subject per block. Multitasking between two subjects usually costs more time than it saves.`,
    furtherReading: [
      { label: 'Open University: study skills', url: 'https://www.open.ac.uk/library/help-and-support', note: 'Free guidance on time management and academic skills.' },
    ],
    reviewedOn: '2026-10-11',
  },
  {
    id: 'cash-flow-vs-balance',
    category: 'personal-finance',
    title: 'Recorded cash flow is not your bank balance',
    summary: 'One number you write down, another number the bank holds. Confusing them is the most common money-record mistake.',
    minutes: 6,
    level: 'beginner',
    body: `When you track money in LIFEKIT, you are recording **cash flow**: what came in and what went out, as you entered it. Your bank balance is a different number, kept by somebody else, and it moves for reasons you did not record.

## Why they differ
- **Timing.** A cheque written on Friday may clear next week.
- **Unrecorded items.** Bank charges, interest credits, standing instructions and subscriptions you forgot.
- **Cash.** Money you spent in cash never touches the bank.
- **Multiple accounts.** Salary into one account, spending from another; a record that ignores one is wrong.
- **Pending transactions.** Shown by the bank but not yet settled, and sometimes reversed.

## What that means in practice
- Treat your recorded net cash flow as **your own view of the month**, useful for spotting patterns and controlling spending.
- Only your bank statement is authoritative about your balance.
- Reconcile occasionally: compare your recorded entries with a statement for the same period. Differences are either unrecorded spending or an entry you typed twice. Both are worth fixing.

## A five-minute monthly routine
1. Open your statement for the month.
2. Compare the closing figure with your recorded income minus expenses, adjusting for the items above.
3. Investigate any difference larger than you would accept as a rounding error.
4. Note anything unusual in a single line so next month is easier.

> LIFEKIT deliberately does not connect to banks. It has no access to your accounts, cannot read your balance, and will never ask for your banking credentials. That is a privacy choice, and it means the record is only as good as what you enter.`,
    furtherReading: [
      { label: 'RBI — financial education material for consumers', url: 'https://www.rbi.org.in/financialeducation/home.aspx', note: 'Reserve Bank of India consumer education resources.' },
      { label: 'RBI — banking ombudsman information', url: 'https://www.rbi.org.in/Scripts/Complaints.aspx', note: 'Official grievance route for banking complaints in India.' },
    ],
    reviewedOn: '2026-10-11',
  },
  {
    id: 'emergency-fund',
    category: 'personal-finance',
    title: 'An emergency fund, sized for your actual life',
    summary: 'Start with one month of essential spending, not six. Getting to one month is what changes decisions.',
    minutes: 7,
    level: 'beginner',
    body: `An emergency fund is money set aside for the shocks that are not optional: a medical bill, a broken appliance, an unexpected journey, a gap in income. Its purpose is to stop one bad week from turning into borrowed money at a high rate.

## Size it in stages
- **Stage 1: one month of essentials.** Essentials only — rent, food, transport, utilities, medicines, school fees. Not your full spending, and definitely not your ideal budget.
- **Stage 2: three months of essentials.** This is where most households can breathe.
- **Stage 3: three to six months**, more if your income is irregular or you support others.

## Where it should live
Somewhere you can reach within a day or two, and somewhere you are not tempted to spend. A separate savings account without a linked card works well for many people. Keep it distinct from your everyday account so it does not get absorbed.

## How to build it when money is tight
- Fix a monthly amount you can hold to through a bad month — small and certain beats large and sporadic.
- Put windfalls in directly: a bonus, a refund, a gift.
- Review subscriptions and instalments once; cancel what you do not use and add the difference.
- Automate the transfer for pay day if your bank allows it; decisions made once are cheaper than decisions made monthly.

## Rules for using it
- Use it for genuine emergencies, then rebuild it. That is the whole design.
- Decide in advance what counts as an emergency. Deciding in the moment, under stress, is how funds disappear.
- Keep it separate from savings goals like a phone or a trip, and track both — LIFEKIT's savings goals and budget features exist for exactly this.

> LIFEKIT does not give financial advice and cannot tell you what your fund should be. It shows the arithmetic; the decision is yours.`,
    furtherReading: [
      { label: 'SEBI investor education', url: 'https://investor.sebi.gov.in/', note: 'Indian securities regulator investor education resources.' },
      { label: 'RBI financial education', url: 'https://www.rbi.org.in/financialeducation/home.aspx', note: 'Basic money-management explainers.' },
    ],
    reviewedOn: '2026-10-11',
  },
  {
    id: 'interest-explained',
    category: 'personal-finance',
    title: 'Interest, compounding and why loan order matters',
    summary: 'Simple interest grows on the original amount. Compound interest grows on the total. The difference compounds too.',
    minutes: 9,
    level: 'intermediate',
    body: `Interest is rent paid for the use of money. When you save, you are the landlord. When you borrow, you are the tenant. The arithmetic is the same in both directions.

## Simple versus compound
- **Simple interest** is calculated on the original sum only. 10,000 at 10% per year earns 1,000 every year.
- **Compound interest** is calculated on the sum plus the interest already earned. 10,000 at 10% compounded yearly becomes 11,000, then 12,100, then 13,310.

Over one year they look similar. Over twenty, the difference becomes large — and it works against you just as efficiently when the money is borrowed.

## The rule of 72
To estimate how many years money takes to double at a given annual rate, divide 72 by the rate. At 6%, about 12 years. At 12%, about 6 years. It is an approximation for mental arithmetic, not a prediction.

## What this means for loans
Interest on a loan usually accrues daily or monthly on the outstanding balance. Two consequences worth knowing:
- **The order of repayments changes the total cost.** Paying extra on the highest-rate debt first usually costs less overall than splitting the extra evenly.
- **Tenure cuts both ways.** A longer tenure lowers the monthly payment but raises the total interest paid. The monthly figure is not the only number to compare.

## Reducing balance versus flat rate
A "flat rate" quote applies interest to the full original amount for the whole term, which makes a 10% flat loan far more expensive than a 10% reducing-balance loan — often roughly equivalent to around 17–18% on a reducing basis. When comparing offers, ask which method is used and compare the same basis.

> Rates, fees and terms change constantly, and this lesson is education rather than advice. Before signing anything, get the numbers in writing and compare the total cost, not just the monthly instalment.`,
    furtherReading: [
      { label: 'RBI — consumer awareness on loans and interest', url: 'https://www.rbi.org.in/financialeducation/home.aspx', note: 'Official explanations of rates and charges.' },
      { label: 'Investor.gov compound interest calculator', url: 'https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator', note: 'US SEC tool for exploring compounding.' },
    ],
    reviewedOn: '2026-10-11',
  },
  {
    id: 'otp-five-seconds',
    category: 'digital-safety',
    title: 'Recognising an OTP scam in five seconds',
    summary: 'A short, memorable rule you can apply while the phone is ringing.',
    minutes: 5,
    level: 'beginner',
    body: `The phone rings. Someone says they are from your bank, or a delivery company, or the electricity board. They mention a problem and ask you to read out the code you just received.

**Stop there.** That request is the scam. Here is the rule and the reasons behind it.

## The five-second rule
**Nobody legitimate ever needs the code that was sent to your phone.** Not a bank officer, not a courier, not a police officer, not a customer-care agent, not a person claiming to be your relative. The code exists to prove that someone has your phone. If another person wants it, they want your money.

## Why it feels convincing
- **Caller ID can be spoofed.** The bank's name appearing on screen proves nothing at all.
- **They already know something about you** — your name, the last digits of a card — usually from a leaked database or a partial order confirmation.
- **They create urgency.** Real institutions do not ask you to act within minutes.
- **They are polite and helpful.** Scams are performed, and performance works.

## What they are actually doing
They are logging into your account or approving a transaction, and they need the second factor that only you can produce. Sometimes they ask you to install an app so they can "help you"; that app may read your messages or share your screen, which hands over every future code too.

## What to do
1. Hang up. Do not explain, do not argue.
2. If you are worried the call was real, call the number printed on your card or the official app yourself.
3. Report the number through your telecom provider's spam channel and your national cybercrime channel. In India, suspected fraud communication can be reported through the Sanchar Saathi / Chakshu service.
4. Warn one person in your family today. These calls run in batches against the same area and the same script.`,
    furtherReading: [
      { label: 'India — National Cyber Crime Reporting Portal', url: 'https://cybercrime.gov.in', note: 'Official Government of India reporting portal.' },
      { label: 'Sanchar Saathi (India) — report fraud communication', url: 'https://sancharsaathi.gov.in', note: 'Department of Telecommunications service for fraud calls and messages.' },
      { label: 'FTC — how to avoid a scam', url: 'https://consumer.ftc.gov/scams', note: 'US Federal Trade Commission consumer advice.' },
    ],
    reviewedOn: '2026-10-11',
  },
  {
    id: 'backup-habits',
    category: 'digital-safety',
    title: 'Backups: the 3-2-1 habit scaled down for a phone',
    summary: 'One copy is not a backup. Two copies in different places is the minimum that saves you.',
    minutes: 6,
    level: 'beginner',
    body: `Losing a phone loses whatever was only on that phone. The 3-2-1 rule — three copies, two kinds of media, one off-site — sounds like enterprise jargon; a scaled-down version is entirely practical.

## The scaled-down version
1. **The device itself** (or your browser's storage, as with LIFEKIT's records).
2. **An export file you control.** In LIFEKIT this is Settings > Backup and restore, which writes a single JSON file you can put anywhere.
3. **One copy somewhere else** — another device, an email to yourself, a cloud folder, or a memory card kept at home.

## What "somewhere else" means for students and families
- A phone and a computer in the same house is better than one device, but both can be stolen or damaged together.
- Emailing yourself the file costs nothing and survives a lost phone, provided you can still access the email account.
- If you use a cloud folder, check that you can open the file without the same phone.

## How often
Turn it into a monthly habit tied to something you already do: the first of the month, or the day you pay rent. LIFEKIT can send you a local backup reminder on a schedule you choose; it is off until you switch it on.

## Before you rely on any backup, test it
A backup you have never restored is a hope, not a backup. Check three things once every few months:
- Does the file open?
- Does restoring it into LIFEKIT bring back your records?
- Is the copy you keep elsewhere actually the recent one?

> Keep the file private. A LIFEKIT backup contains your records. Treat it like a bank statement: do not post it in groups, and use a passcode or encryption if you have that option.`,
    furtherReading: [
      { label: 'NCSC (UK) — backing up your data', url: 'https://www.ncsc.gov.uk/collection/top-tips-for-staying-secure-online', note: 'National Cyber Security Centre top tips.' },
      { label: 'CISA — data backup guidance', url: 'https://www.cisa.gov/secure-our-world', note: 'US Cybersecurity and Infrastructure Security Agency resources.' },
    ],
    reviewedOn: '2026-10-11',
  },
  {
    id: 'resume-bullets',
    category: 'career-skills',
    title: 'Writing a résumé bullet that says something',
    summary: 'Verb, what you did, scale, outcome. Four parts, one line, no adjectives required.',
    minutes: 7,
    level: 'beginner',
    body: `Most résumé lines describe a job description. Good lines describe what changed because you were there.

## The four-part bullet
1. **Verb** — a specific action, past tense: reconciled, reduced, taught, rebuilt, handled.
2. **Object** — what you actually worked on.
3. **Scale or method** — how much, how often, with what tool.
4. **Outcome** — what improved, ideally in a number or a clear before/after.

Weak: *Responsible for handling customer queries.*
Strong: *Handled 60–80 customer queries a day across phone and chat, and wrote 12 reply templates that cut average response time from 9 hours to under 4.*

Weak: *Worked on the college database project.*
Strong: *Built the attendance module of a 4-person college project database, cutting weekly data entry for staff from 3 hours to 40 minutes.*

## If you have no numbers
Use frequency, volume or scope: every day, three branches, 200 records, two languages, weekends during peak season. Then describe the outcome honestly — "no missed deadlines in six months" is a real outcome.

## Rules worth keeping
- One line per bullet, two at the very most.
- Start with the verb, not "I was responsible for".
- No adjectives you cannot defend: *excellent, dynamic, hard-working* tell a reader nothing.
- Use the employer's vocabulary where it is honest to do so — especially software names and job-specific terms.
- Keep every claim true. Interviewers ask about résumé lines, and an inflated line becomes an awkward conversation.

## Check it in sixty seconds
Read the bullet aloud. Can you name the action, the size of the task and the result? If any of the three is missing, rewrite it.`,
    furtherReading: [
      { label: 'India — National Career Service', url: 'https://www.ncs.gov.in', note: 'Government employment service with career guidance.' },
      { label: 'Europass CV tools', url: 'https://europa.eu/europass/en', note: 'European Union templates and guidance.' },
    ],
    reviewedOn: '2026-10-11',
  },
  {
    id: 'star-answers',
    category: 'career-skills',
    title: 'Interview answers with the STAR shape',
    summary: 'Situation, Task, Action, Result. A structure that keeps you from rambling when you are nervous.',
    minutes: 8,
    level: 'intermediate',
    body: `Interviewers ask behavioural questions because past behaviour predicts future behaviour better than opinions do. The STAR shape keeps your answer organised so the interviewer can actually hear it.

## The four parts, and roughly how long each should be
- **Situation** (10%) — one sentence of context. Where, when, what was at stake.
- **Task** (10%) — what you specifically were responsible for.
- **Action** (60%) — what you did, step by step, in first person. This is the part being assessed.
- **Result** (20%) — what happened, with a number or a concrete change if you have one.

## A worked example
*Situation:* Our shop's stock counts were always wrong at month end, which caused arguments with the supplier.
*Task:* My manager asked me to find out why and fix the process within a month.
*Action:* I compared the last three months of delivery notes with the billing system, found that two suppliers' returns were never entered, and set up a one-page log the evening staff filled in when anything was returned. I checked it each Friday and followed up on missing entries the same day.
*Result:* The gap fell from about 40 items a month to under 5, and month-end counting went from two days to half a day.

## Practical preparation
1. Write out eight to ten real stories before the interview: a success, a failure, a conflict, a deadline, a time you helped someone, a time you learned something quickly.
2. For each, note the four parts in bullets — do not memorise a script.
3. Practise out loud, timed at 90 seconds. If you run past two minutes, cut the Situation.
4. Have a deliberate failure story. An interviewer will ask; pretending you have never failed is a worse answer than a real one with what you changed afterwards.

> If you forget the structure mid-answer, pause, say "let me give you the short version", and go to the Result. Recovering gracefully is itself a signal interviewers value.`,
    furtherReading: [
      { label: 'US Department of Labor — interview preparation', url: 'https://www.careeronestop.org/JobSearch/Interview/interview-tips.aspx', note: 'Public career resource with interview guidance.' },
      { label: 'National Careers Service (UK)', url: 'https://nationalcareers.service.gov.uk/', note: 'UK government careers advice including interview tips.' },
    ],
    reviewedOn: '2026-10-11',
  },
];

/** Categories that actually have lessons bundled, used to render the library index. */
export function lessonsByCategory(): { category: LessonCategoryInfo; lessons: Lesson[] }[] {
  return LESSON_CATEGORIES.map((category) => ({
    category,
    lessons: LESSONS.filter((lesson) => lesson.category === category.id),
  }));
}

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}

export const LEARNING_DISCLAIMER =
  'These lessons were written for LIFEKIT and are for general education. They are not professional advice, they do not replace a qualified teacher, and financial examples are illustrations rather than recommendations.';
