/**
 * LIFEKIT Career Toolkit — original content.
 *
 * The interview question bank and sample answers were written for LIFEKIT in plain
 * language. They are examples of how a person *might* structure an answer, not scripts
 * to memorise, and they make no claims about any employer's hiring process.
 *
 * The resource links point at official public employment services and well-known job
 * platforms. LIFEKIT does not list, guarantee or vouch for any job opening, employer or
 * salary, and does not verify listings.
 */

export interface InterviewQuestion {
  id: string;
  category: 'general' | 'behavioural' | 'technical' | 'fresh' | 'closing';
  question: string;
  /** Structure the candidate can reuse in their own words. */
  approach: string;
  sampleAnswer: string;
  avoid: string;
}

export interface JobResource {
  id: string;
  name: string;
  what: string;
  url: string;
  kind: 'public-service' | 'job-board' | 'learning' | 'employer-site';
  note: string;
}

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'q-tell-me-about-yourself',
    category: 'general',
    question: 'Tell me about yourself.',
    approach:
      'Give a 60–90 second professional summary in three parts: what you do now, one or two things you are good at with evidence, and why this role is the logical next step. Keep it about the job, not your life story.',
    sampleAnswer:
      'I finished my B.Com last year and have been working as an accounts assistant at a small trading firm, where I handle daily entries, supplier reconciliation and GST filing support. Two things I have become good at are catching reconciliation mismatches early and keeping records clean enough that audits are uneventful. I am looking for a larger accounts team where I can take on more analysis work, and that is why this role interested me.',
    avoid: 'Reciting your résumé line by line, starting from school, or mentioning personal details that have nothing to do with the work.',
  },
  {
    id: 'q-strength',
    category: 'general',
    question: 'What is your greatest strength?',
    approach: 'Choose one strength that the job actually needs, then prove it with a short, specific example and a result.',
    sampleAnswer:
      'Reliability with deadlines. In my last role, month-end closing used to slip because data arrived late from three teams. I set up a simple two-day reminder and a checklist, and closing moved from the fifth working day to the second for six months in a row.',
    avoid: 'Listing five strengths, or claiming a strength without any example. "I am a perfectionist" is a cliché interviewers hear daily.',
  },
  {
    id: 'q-weakness',
    category: 'behavioural',
    question: 'What is a weakness you are working on?',
    approach: 'Name a real, non-fatal weakness and describe the concrete habit you are using to manage it. Show self-awareness, not a disguised strength.',
    sampleAnswer:
      'I used to take on too many small requests and then rush my own work. I now block the first 90 minutes of my day for my main tasks and tell people when I can realistically start their request. It has been uncomfortable to say no, but my work quality has improved and I miss fewer deadlines.',
    avoid: 'Saying "I work too hard" or naming a core skill the job requires.',
  },
  {
    id: 'q-star-problem',
    category: 'behavioural',
    question: 'Describe a difficult problem you solved at work or during study.',
    approach: 'Use the STAR shape: Situation, Task, Action, Result. Spend most of your answer on the actions you personally took and end with a measurable or observable result.',
    sampleAnswer:
      'Situation: our customer support inbox had a backlog of 400 tickets before a festival sale. Task: I was asked to clear it with one other person in five days. Action: I sorted the backlog by type, wrote three reusable reply templates for the most common issues, and escalated genuine payment failures daily with a single summary file. Result: the backlog was cleared in four days and the templates cut our average reply time by about half; we still use them.',
    avoid: 'Describing a team success without saying what you personally did, or finishing without any outcome.',
  },
  {
    id: 'q-conflict',
    category: 'behavioural',
    question: 'Tell me about a disagreement with a colleague or classmate and how you handled it.',
    approach: 'Pick a low-drama example. Show that you listened, separated the person from the problem, and moved toward a decision.',
    sampleAnswer:
      'A teammate wanted to skip a data-validation step to save time on a college project. I was worried about wrong totals in our final report. We sat down, I asked what their time pressure was, and we agreed to keep the validation but run it once at the end instead of after every change. We delivered on time and the numbers were correct.',
    avoid: 'Blame-heavy stories, or describing a conflict you escalated without trying to resolve it.',
  },
  {
    id: 'q-why-this-role',
    category: 'general',
    question: 'Why do you want this job?',
    approach: 'Connect two or three specific things about the role or organisation to your skills and your direction. Research first — generic enthusiasm is obvious.',
    sampleAnswer:
      'Three reasons. The role is centred on the two things I like most — reconciliation and reporting. Your organisation is working at a scale where I would see a much wider range of transactions than I do now. And the posting mentions mentoring juniors, which fits how I prefer to work.',
    avoid: 'Only talking about salary, stability or "a good company", or knowing nothing about what the organisation does.',
  },
  {
    id: 'q-salary',
    category: 'general',
    question: 'What are your salary expectations?',
    approach: 'Give a researched range, mention that you are open to the whole package, and ask what range the role is budgeted for. Do not invent a number you cannot justify.',
    sampleAnswer:
      'Based on the market for this role with my two years of experience, I am looking at a range around the mid-twenties to low-thirties monthly, but I am flexible depending on the responsibilities and the rest of the package. Could you tell me the range budgeted for this position?',
    avoid: 'Refusing to give any number, or stating a figure far above the market without evidence.',
  },
  {
    id: 'q-gap',
    category: 'behavioural',
    question: 'Can you explain the gap in your timeline?',
    approach: 'Be brief, factual and unapologetic, then redirect to what you did with the time and how you are ready now.',
    sampleAnswer:
      'I was out of work for eight months after we relocated for my father’s treatment. I used the period to complete a data-entry and spreadsheet certification and to take on two short freelance bookkeeping jobs. My family situation is stable now and I am ready for a full-time role.',
    avoid: 'Over-explaining, apologising repeatedly, or claiming you were working when you were not.',
  },
  {
    id: 'q-teamwork',
    category: 'behavioural',
    question: 'How do you handle feedback you disagree with?',
    approach: 'Show that you separate your ego from the work, ask clarifying questions, and either adopt the feedback or explain your reasoning with data.',
    sampleAnswer:
      'I ask for the specific example first, because feedback is easier to act on with a case attached. Once, my manager said my reports were "too long". I asked which parts she used, and it turned out the summary table was what mattered. I moved that to page one and kept the detail behind it. When I genuinely disagree, I explain my reasoning with the numbers and let her decide.',
    avoid: 'Saying you always accept feedback (not credible) or that you have never received any.',
  },
  {
    id: 'q-technical-spreadsheet',
    category: 'technical',
    question: 'How would you check a set of expense figures for errors?',
    approach: 'Walk through a method, not a memorised term. Interviewers want to see a repeatable process.',
    sampleAnswer:
      'First I check the total against the source: count rows and compare the sum with the original statement. Then I look for the usual errors — duplicate entries, transposed digits, dates in the wrong month, and mixed signs. I then compare month-on-month totals and investigate any line that moved more than about 10% without an obvious reason. Finally I keep a note of what I checked, so a reviewer can repeat it.',
    avoid: 'Saying "I would just check it" or naming a tool without describing the steps.',
  },
  {
    id: 'q-technical-budget',
    category: 'technical',
    question: 'How would you build a simple monthly budget for a household?',
    approach: 'Structure the answer: fixed costs first, then variable, then savings — and mention tracking reality against the plan.',
    sampleAnswer:
      'I would list fixed commitments first — rent, EMIs, school fees, insurance — because those do not flex. Then I would average three months of variable spending: food, transport, utilities. What is left becomes the savings target, and I would set a limit for each category rather than one big number. Every month I would compare actual against planned and adjust the following month rather than abandoning the budget.',
    avoid: 'Presenting a budget as a guarantee, or ignoring that real spending varies month to month.',
  },
  {
    id: 'q-fresh-first-job',
    category: 'fresh',
    question: 'You have no work experience. Why should we hire you?',
    approach: 'Replace experience with evidence: projects, internships, certificates, volunteering, and a specific plan for your first 30 days.',
    sampleAnswer:
      'My experience is in coursework and a three-month internship, so I will point to what I produced: I built a small inventory tracker used by my college’s stationery counter, and in my internship I handled reconciliation for about 200 invoices a week without an error escalated. I learn tools quickly and I am comfortable asking questions early. In my first month I would focus on understanding your process and doing the routine work accurately before suggesting changes.',
    avoid: 'Arguing that experience does not matter, or claiming skills you cannot demonstrate.',
  },
  {
    id: 'q-fresh-relocate',
    category: 'fresh',
    question: 'Are you willing to relocate or work shifts?',
    approach: 'Answer honestly. If you have limits, state them clearly with your reason and any flexibility.',
    sampleAnswer:
      'Yes, I am willing to relocate — I have already discussed it at home and I can join within three weeks. I am comfortable with rotational shifts, though I would prefer to know the rotation pattern so I can plan travel.',
    avoid: 'Saying yes to everything and later withdrawing — it damages trust with the employer and your own plans.',
  },
  {
    id: 'q-closing-questions',
    category: 'closing',
    question: 'Do you have any questions for us?',
    approach: 'Always have two or three ready, aimed at how the work actually runs. This is where you assess whether the job fits you.',
    sampleAnswer:
      'Yes, three. What does a typical first month look like for this role? Who would review my work in the first three months? And what has made people succeed here in this position in the past?',
    avoid: 'Asking only about salary and leave in the first interview, or saying you have no questions at all.',
  },
  {
    id: 'q-closing-next-steps',
    category: 'closing',
    question: 'What are the next steps in this process?',
    approach: 'A short, professional close that also gives you a follow-up anchor.',
    sampleAnswer:
      'Thank you — I have enjoyed this discussion. Could you tell me what the next steps are and roughly when I might hear back? I can share any additional documents you need.',
    avoid: 'Long, apologetic closings that invite further negotiation before an offer exists.',
  },
];

export const JOB_RESOURCES: JobResource[] = [
  {
    id: 'ncs',
    name: 'National Career Service (India)',
    what: 'Government employment service with job listings, career counselling and skill courses.',
    url: 'https://www.ncs.gov.in',
    kind: 'public-service',
    note: 'Run by the Ministry of Labour and Employment, Government of India. Free to register.',
  },
  {
    id: 'employment-news',
    name: 'Employment News (India)',
    what: 'Official government publication listing public-sector vacancies and recruitment notices.',
    url: 'https://employmentnews.gov.in',
    kind: 'public-service',
    note: 'Useful for government job notifications; verify all deadlines in the original notice.',
  },
  {
    id: 'apprenticeship-india',
    name: 'Apprenticeship India',
    what: 'National apprenticeship portal for apprenticeship and training opportunities.',
    url: 'https://www.apprenticeshipindia.gov.in',
    kind: 'public-service',
    note: 'Government portal; employers post apprenticeship vacancies directly.',
  },
  {
    id: 'european-youth-portal',
    name: 'European Youth Portal — jobs and traineeships',
    what: 'Information on traineeships, volunteering and jobs across the EU.',
    url: 'https://youth.europa.eu',
    kind: 'public-service',
    note: 'European Union official portal.',
  },
  {
    id: 'usajobs',
    name: 'USAJOBS',
    what: 'Official job site of the United States federal government.',
    url: 'https://www.usajobs.gov',
    kind: 'public-service',
    note: 'United States federal government portal.',
  },
  {
    id: 'ilo',
    name: 'International Labour Organization',
    what: 'Information on labour standards, occupational safety and decent work.',
    url: 'https://www.ilo.org',
    kind: 'learning',
    note: 'Useful for understanding workplace rights; LIFEKIT does not provide legal advice.',
  },
  {
    id: 'free-code-camp',
    name: 'freeCodeCamp',
    what: 'Free self-paced coding curriculum with certifications.',
    url: 'https://www.freecodecamp.org',
    kind: 'learning',
    note: 'Non-profit learning platform; curriculum changes over time.',
  },
  {
    id: 'typing-club',
    name: 'Keybr — typing practice',
    what: 'Browser-based typing trainer; useful for data-entry roles.',
    url: 'https://www.keybr.com',
    kind: 'learning',
    note: 'Third-party site, not affiliated with LIFEKIT.',
  },
];

export const RESUME_TIPS: string[] = [
  'Keep one page until you have several years of experience. Recruiters skim for about a minute.',
  'Use plain section headings: Profile, Experience, Education, Skills, Projects. Fancy layouts break in employer systems.',
  'Start each bullet with a verb — handled, reconciled, taught, built — and add a number where you honestly can.',
  'Write dates consistently. Month and year is enough; avoid unexplained gaps by listing study or freelance work.',
  'Tailor the top five lines to the specific advert. Most rejections happen in that block.',
  'Save as PDF with a readable file name (firstname-lastname-role.pdf) unless the employer asks for something else.',
  'Remove photos, date of birth, marital status and full address unless the employer or local norms specifically require them.',
  'Never claim a skill you cannot demonstrate for five minutes in an interview.',
  'Proofread out loud once, and ask one person to read it before sending.',
  'Keep a copy of every version you send, so you can prepare for the interview from the same document.',
];

export const CAREER_DISCLAIMER =
  'LIFEKIT does not list, verify, rank or endorse job openings, employers or recruiters, and it does not guarantee interviews, salaries or outcomes. Sample answers are examples of structure and tone — rewrite them in your own words and only state facts you can support.';
