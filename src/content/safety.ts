/**
 * LIFEKIT Digital Safety Centre — original educational content.
 *
 * Editorial rules applied here:
 *  - Every claim is a general, widely-documented safety practice, written in our own words.
 *  - Reporting channels are limited to official government or platform channels, each with
 *    a source URL and the date LIFEKIT last reviewed it.
 *  - Nothing here claims to detect malware, block scams, or certify a website as safe.
 *  - Where a detail can change (phone numbers, opening hours, portal paths), the text tells
 *    the reader to confirm it on the official site first.
 */

export const SAFETY_REVIEWED_ON = '2026-10-11';

export interface SafetyStep {
  text: string;
}

export interface SafetyTopic {
  id: string;
  title: string;
  summary: string;
  /** One-line "if nothing else, remember this" rule. */
  keyRule: string;
  warningSigns: string[];
  steps: SafetyStep[];
  ifAffected: string[];
  tags: string[];
}

export interface ReportingChannel {
  id: string;
  country: string;
  region: 'India' | 'United States' | 'United Kingdom' | 'Australia' | 'Canada' | 'Anywhere';
  purpose: string;
  channel: string;
  detail: string;
  website: string;
  lastReviewed: string;
  verified: true;
}

export const REPORTING_CHANNELS: ReportingChannel[] = [
  {
    id: 'in-ncrp',
    country: 'India',
    region: 'India',
    purpose: 'Cyber crime and online financial fraud complaints',
    channel: 'National Cyber Crime Reporting Portal',
    detail:
      'Online complaint filing and tracking, run by the Ministry of Home Affairs. For financial cyber fraud, the portal and the national cybercrime helpline both direct you to report immediately. Confirm the current helpline number on the portal before relying on it.',
    website: 'https://cybercrime.gov.in',
    lastReviewed: SAFETY_REVIEWED_ON,
    verified: true,
  },
  {
    id: 'in-1930',
    country: 'India',
    region: 'India',
    purpose: 'Urgent reporting of financial cyber fraud',
    channel: 'National cybercrime helpline 1930',
    detail:
      'The 24x7 helpline referenced by the National Cyber Crime Reporting Portal for financial cyber fraud. Reporting quickly matters, but no recovery is guaranteed — outcomes depend on the authorities and your bank.',
    website: 'https://cybercrime.gov.in',
    lastReviewed: SAFETY_REVIEWED_ON,
    verified: true,
  },
  {
    id: 'in-emergency',
    country: 'India',
    region: 'India',
    purpose: 'Emergency police, fire and medical help',
    channel: 'Emergency Response Support System — 112',
    detail: 'Single emergency number for police, fire and ambulance services in India.',
    website: 'https://112.gov.in',
    lastReviewed: SAFETY_REVIEWED_ON,
    verified: true,
  },
  {
    id: 'in-chakshu',
    country: 'India',
    region: 'India',
    purpose: 'Report suspected spam or fraud calls, SMS and WhatsApp messages',
    channel: 'Sanchar Saathi — Chakshu',
    detail:
      'Department of Telecommunications service for reporting suspected fraud communication. Useful for nuisance and fraud numbers; it does not recover money.',
    website: 'https://sancharsaathi.gov.in',
    lastReviewed: SAFETY_REVIEWED_ON,
    verified: true,
  },
  {
    id: 'in-consumer',
    country: 'India',
    region: 'India',
    purpose: 'Consumer complaints about goods and services',
    channel: 'National Consumer Helpline',
    detail:
      'Government consumer grievance channel for problems with a business or service. Check the current helpline numbers and portal options listed on the official site.',
    website: 'https://consumerhelpline.gov.in',
    lastReviewed: SAFETY_REVIEWED_ON,
    verified: true,
  },
  {
    id: 'us-ftc',
    country: 'United States',
    region: 'United States',
    purpose: 'Scams, fraud and bad business practices',
    channel: 'FTC — ReportFraud.ftc.gov',
    detail:
      'Federal Trade Commission reporting form. Reports feed a database shared with many law enforcement agencies. The FTC warns it cannot resolve individual cases.',
    website: 'https://reportfraud.ftc.gov',
    lastReviewed: SAFETY_REVIEWED_ON,
    verified: true,
  },
  {
    id: 'us-identitytheft',
    country: 'United States',
    region: 'United States',
    purpose: 'Identity theft recovery',
    channel: 'IdentityTheft.gov',
    detail: 'FTC-run site that produces a personal recovery plan and pre-filled letters.',
    website: 'https://www.identitytheft.gov',
    lastReviewed: SAFETY_REVIEWED_ON,
    verified: true,
  },
  {
    id: 'us-ic3',
    country: 'United States',
    region: 'United States',
    purpose: 'Internet-facilitated crime, including online fraud',
    channel: 'FBI Internet Crime Complaint Center (IC3)',
    detail: 'Online complaint form for internet-related crime, including investment and romance scams.',
    website: 'https://www.ic3.gov',
    lastReviewed: SAFETY_REVIEWED_ON,
    verified: true,
  },
  {
    id: 'uk-actionfraud',
    country: 'United Kingdom',
    region: 'United Kingdom',
    purpose: 'Fraud and cyber crime reporting for England, Wales and Northern Ireland',
    channel: 'Action Fraud / Report Fraud',
    detail:
      'National reporting centre for fraud and cyber crime. Scotland reports through Police Scotland (101). Confirm current contact details on the official site.',
    website: 'https://www.actionfraud.police.uk',
    lastReviewed: SAFETY_REVIEWED_ON,
    verified: true,
  },
  {
    id: 'au-scamwatch',
    country: 'Australia',
    region: 'Australia',
    purpose: 'Scam reports and alerts',
    channel: 'Scamwatch (National Anti-Scam Centre)',
    detail: 'Australian Competition and Consumer Commission scam reporting and education service.',
    website: 'https://www.scamwatch.gov.au',
    lastReviewed: SAFETY_REVIEWED_ON,
    verified: true,
  },
  {
    id: 'au-reportcyber',
    country: 'Australia',
    region: 'Australia',
    purpose: 'Cyber crime reports, including money lost online',
    channel: 'ReportCyber',
    detail: 'Australian Government cybercrime reporting service used by police and other agencies.',
    website: 'https://www.cyber.gov.au/report-and-recover/report',
    lastReviewed: SAFETY_REVIEWED_ON,
    verified: true,
  },
  {
    id: 'ca-antifraud',
    country: 'Canada',
    region: 'Canada',
    purpose: 'Fraud reports and advice',
    channel: 'Canadian Anti-Fraud Centre',
    detail: 'Reporting and prevention service for fraud affecting Canadians.',
    website: 'https://antifraudcentre-centreantifraude.ca',
    lastReviewed: SAFETY_REVIEWED_ON,
    verified: true,
  },
  {
    id: 'any-bank',
    country: 'Anywhere',
    region: 'Anywhere',
    purpose: 'Stop money from leaving your account',
    channel: 'Your bank, card issuer, wallet or UPI provider',
    detail:
      'Use only the phone number or app printed on your card, passbook or the provider’s official website. Never use a contact number that arrived inside a message. Ask them to freeze the card/account and reverse or dispute the transaction.',
    website: '',
    lastReviewed: SAFETY_REVIEWED_ON,
    verified: true,
  },
];

export const SAFETY_TOPICS: SafetyTopic[] = [
  {
    id: 'fake-job-offer',
    title: 'Fake job offers',
    summary:
      'Fraudsters advertise jobs that do not exist, then ask for a registration fee, "security deposit", or your documents. Genuine employers pay you; they do not charge you to be hired.',
    keyRule: 'If you must pay to get the job, it is not a job.',
    warningSigns: [
      'A job offer arrives without a real interview — often through WhatsApp, Telegram or a personal email address.',
      'You are asked to pay a registration, training, laptop, uniform or "refundable deposit" fee.',
      'Salary quoted is far above the market for the work described, especially for simple tasks like liking videos.',
      'The "company" uses a free email domain instead of a domain matching its own website.',
      'You are asked to send Aadhaar, PAN, passport or bank details before any written offer letter.',
      'Pressure to decide within hours, and to keep the offer secret from family.',
      'The work involves receiving or forwarding money on behalf of someone else — this is a money-mule pattern and can expose you to criminal liability.',
    ],
    steps: [
      { text: 'Pause. A genuine employer will always allow you to verify before you act.' },
      { text: 'Search the exact company name plus the words "scam" or "fraud", and check the company on an official business registry or its own website typed by hand.' },
      { text: 'Call the organisation using a number from its own official website — never a number from the message.' },
      { text: 'Refuse any payment request. There is no legitimate job that requires a candidate to pay in.' },
      { text: 'Do not share OTPs, bank passwords, or photos of identity documents with a recruiter you have not verified in writing.' },
      { text: 'If the offer came through a job portal, report the listing inside that portal so it can be removed.' },
    ],
    ifAffected: [
      'If you paid: contact your bank or payment provider immediately and ask whether the transaction can be stopped or disputed.',
      'Report in India at cybercrime.gov.in or the national cybercrime helpline; in the US at reportfraud.ftc.gov; in the UK at actionfraud.police.uk. See the reporting list below.',
      'If you shared identity documents, watch for new accounts or loans opened in your name and consider a credit-bureau alert where available.',
      'Keep screenshots, chat exports, payment receipts and the phone numbers used. That evidence is what investigators ask for.',
    ],
    tags: ['jobs', 'money', 'documents'],
  },
  {
    id: 'phishing',
    title: 'Phishing messages',
    summary:
      'Phishing is a message that impersonates someone you trust — a bank, a parcel company, a government office, an electricity board — to make you click, call, or hand over information.',
    keyRule: 'A real organisation never asks for your OTP, PIN or password. Ever.',
    warningSigns: [
      'The message creates urgency: "your account will be blocked in 24 hours".',
      'The link text and the actual destination differ — always check the domain, not the display name.',
      'Greeting is generic ("Dear customer") even though the sender claims to be your bank.',
      'Sender address is a lookalike: extra words, hyphens, or a different top-level domain.',
      'You are asked to "confirm", "verify", "update KYC", or "re-activate" by entering passwords or card numbers.',
      'Attachments you did not expect, especially .html, .zip or .apk files, or a "form" that asks for card details.',
    ],
    steps: [
      { text: 'Do not click the link. Open the organisation’s official app or type its website address yourself.' },
      { text: 'Never share an OTP. An OTP is the key to your money — no support agent needs it.' },
      { text: 'Check the domain carefully: read it right to left and look for deliberate misspellings.' },
      { text: 'Report the message: forward UK scam texts to 7726 and phishing emails to report@phishing.gov.uk; in India use the Sanchar Saathi / Chakshu channel for fraud communication; in the US forward phishing to reportphishing@apwg.org or the FTC.' },
      { text: 'Delete the message after reporting. Do not reply — replying confirms your number is active.' },
    ],
    ifAffected: [
      'If you entered card details: call your bank now using the number on your card and ask them to block the card.',
      'If you entered a password that you also use elsewhere: change it immediately, and change it on every other account that shares it. Use a different password per account.',
      'Check your account statements and transaction history for anything you do not recognise.',
      'Report to your national cybercrime channel (see the list below) and to the impersonated organisation so they can warn others.',
    ],
    tags: ['email', 'sms', 'banking'],
  },
  {
    id: 'suspicious-link',
    title: 'Suspicious links and QR codes',
    summary:
      'A link can look harmless and still take you to a page that harvests passwords or installs something unwanted. QR codes hide their destination completely, so treat them like links from a stranger.',
    keyRule: 'If you did not expect it, do not open it — verify from an address you type yourself.',
    warningSigns: [
      'Shortened links (bit.ly and similar) in messages about money, deliveries or account problems.',
      'Domains that imitate real ones with swapped characters, extra words, or unusual endings.',
      'Links asking you to "scan to receive payment" — scanning to receive money is not a real mechanic; scanning usually pays out, not in.',
      'QR codes stuck over the original QR code at a shop, restaurant table or parking meter.',
      'Pages that ask for your card number to "verify your identity" before showing content.',
    ],
    steps: [
      { text: 'Hover or long-press a link to preview the full destination before opening it.' },
      { text: 'For QR codes, check the preview URL in your camera app before tapping. If a payment app opens asking you to pay, stop.' },
      { text: 'Type official addresses manually, or use a bookmark you created yourself.' },
      { text: 'Keep your browser and operating system updated; security updates fix the flaws these pages exploit.' },
    ],
    ifAffected: [
      'Close the page. If you downloaded a file, do not open it.',
      'If you typed a password, change it now, starting with your email account.',
      'Run a scan with a reputable security tool you installed from an official app store.',
      'Report the URL to the platform hosting it and to your national reporting channel.',
    ],
    tags: ['links', 'qr', 'browsing'],
  },
  {
    id: 'impersonation',
    title: 'Impersonation and "digital arrest" calls',
    summary:
      'Callers pretend to be police, customs, tax officials, bank staff or a relative in trouble. They use urgency, authority and fear — and increasingly video calls with fake backgrounds — to move you into transferring money.',
    keyRule: 'No real official investigates you over a phone call or asks you to transfer money to a "safe account".',
    warningSigns: [
      'You are told to stay on the call and not tell anyone, "because the case is confidential".',
      'You are asked to move money to a "verification" or "government" account.',
      'Caller ID shows a real-looking number — caller ID can be spoofed, so it proves nothing.',
      'Video call with a uniformed "officer" in front of an office backdrop; backgrounds can be faked.',
      'A "relative" calls from a new number asking for emergency money and pleading with you not to call their old number.',
      'Documents, warrants or notices arrive as WhatsApp images instead of through official post or a verifiable portal.',
    ],
    steps: [
      { text: 'Hang up. You can always call back on an official number you look up yourself.' },
      { text: 'Verify the relative by calling their known number, or another family member, before doing anything.' },
      { text: 'For any claim of a case against you, check the relevant official portal or visit the office in person.' },
      { text: 'Never install screen-sharing apps because someone on a call told you to. Screen sharing exposes your banking app.' },
      { text: 'Tell one family member what is happening. Isolation is the scammer’s main tool.' },
    ],
    ifAffected: [
      'Stop all transfers immediately and inform your bank.',
      'Preserve the phone numbers, recordings, chat logs and account numbers used.',
      'Report to your national cybercrime channel. In India, financial cyber fraud is reported on cybercrime.gov.in and via the national helpline; the sooner it is reported, the better the chance that banks can act, though recovery is never guaranteed.',
      'If you installed a screen-sharing or remote-access app, uninstall it, change your banking password from a different device, and ask your bank to review recent activity.',
    ],
    tags: ['calls', 'police', 'fear'],
  },
  {
    id: 'payment-fraud',
    title: 'Payment and UPI fraud',
    summary:
      'Payment fraud usually relies on one trick: making you authorise a payment while believing you are receiving money. Approving a "collect request" or scanning a QR code always moves money out of your account.',
    keyRule: 'You never need a PIN, password or QR scan to receive money.',
    warningSigns: [
      'A buyer for your online listing asks you to scan a QR code "to receive the payment".',
      'A "collect request" or "request money" notification arrives and you are told to approve it to get paid.',
      'Someone sends ₹1 or $1 first "to check the account works" — that is a trust-building step.',
      'Payment screenshots that look real but are edited; only your own bank app shows your actual balance.',
      'Requests to pay into a personal account instead of the business account you were shown earlier.',
      'Unusual merchant names when you check the app before approving.',
    ],
    steps: [
      { text: 'Before approving any request, read it: does the wording say "pay" or "receive"? If in doubt, decline.' },
      { text: 'Enter your UPI PIN only when you are paying someone, and only after checking the payee name displayed.' },
      { text: 'Confirm your balance only inside your own bank app — never from a screenshot or a link.' },
      { text: 'For high-value transactions, prefer channels that give you a written record and a dispute route.' },
      { text: 'Keep a separate number or email for financial accounts where your provider allows it.' },
    ],
    ifAffected: [
      'Report inside your payment app to your bank immediately and ask them to flag the transaction.',
      'Note the transaction reference, UPI ID or account number and the exact time.',
      'Report to your national cybercrime channel the same day. In India this is cybercrime.gov.in or the national cybercrime helpline.',
      'Be cautious of "recovery agents" who contact you afterwards — they are almost always a second scam.',
    ],
    tags: ['upi', 'cards', 'payments'],
  },
  {
    id: 'otp-password-requests',
    title: 'Requests for OTPs and passwords',
    summary:
      'Your OTP, PIN and password are the last line of defence for your money. Anyone who asks for them — however official they sound, however friendly, however urgent — is attacking you.',
    keyRule: 'Share the code with no one. Not even someone claiming to be from the bank.',
    warningSigns: [
      'A caller offers to "help" you with a failed transaction and asks you to read out the code you just received.',
      'A message says your KYC will expire unless you confirm details on a link.',
      'Someone asks you to install an app so they can "guide you on screen".',
      'You receive an OTP you did not request, followed by a call explaining it away as a "system error".',
      'Requests to set your PIN to something simple, or to share a "one-time" screen code.',
    ],
    steps: [
      { text: 'Treat any OTP you did not personally trigger as a warning that someone is trying to use your account.' },
      { text: 'Use a different password for every important account, and turn on two-step verification wherever it is offered.' },
      { text: 'Never let anyone else hold your phone during a "support" call.' },
      { text: 'Turn on transaction alerts with your bank so you see money movement as it happens.' },
      { text: 'If you use a shared device, sign out of banking apps and keep a screen lock.' },
    ],
    ifAffected: [
      'Change your password and PIN immediately from a device you trust.',
      'Inform your bank and ask them to review recent activity and block the channel used.',
      'Enable two-step verification again after changing the password — a compromised account may have had it disabled.',
      'Report the attempt, even if no money was lost: reports help banks and platforms spot attack campaigns.',
    ],
    tags: ['otp', 'passwords', 'accounts'],
  },
  {
    id: 'after-fraud',
    title: 'Steps to take after suspected fraud',
    summary:
      'Speed matters more than perfect recall. The first hour is when a payment is most likely to be stopped. Work through these steps in order and keep a written record of everything.',
    keyRule: 'Contain it first, then report it, then secure everything else.',
    warningSigns: [
      'A transaction you do not recognise.',
      'A login alert or password reset you did not request.',
      'A device behaving oddly after you installed something from a message.',
      'A caller who now knows details only your bank should know.',
    ],
    steps: [
      { text: 'Contain: contact your bank/payment provider on the official number, ask to block cards and freeze the affected channel.' },
      { text: 'Change passwords starting with your email account, then banking, then everything else that shares that password.' },
      { text: 'Record evidence: transaction IDs, timestamps, phone numbers, screenshots of messages, and the names given by the callers.' },
      { text: 'Report: use your national cybercrime channel (list below) and inform the platform where the scam happened.' },
      { text: 'Protect others: warn family members, especially those who were targeted by the same script; block the numbers.' },
      { text: 'Follow up: keep complaint or acknowledgement numbers and check the case status through the official portal.' },
    ],
    ifAffected: [
      'Do not pay anyone who promises to recover your money for a fee.',
      'Do not delete messages — they are evidence.',
      'If documents were misused, watch for new accounts, loans or SIM cards issued in your name.',
      'Expect that recovery may not be possible; unfortunately, many fraud transfers cannot be reversed.',
    ],
    tags: ['recovery', 'reporting', 'evidence'],
  },
  {
    id: 'device-account-hygiene',
    title: 'Everyday phone and account hygiene',
    summary:
      'Most scams are stopped by boring habits: updates, screen locks, careful app installs, and not reusing passwords. None of it is glamorous and all of it works.',
    keyRule: 'Update, lock, back up, and never reuse your email password.',
    warningSigns: [
      'Your phone asks you to allow installation from unknown sources for an app you did not seek out.',
      'An app asks for SMS, accessibility, or screen-overlay permission that has nothing to do with what it does.',
      'You are still using a password you created years ago, on more than one site.',
      'No screen lock — anyone holding your phone can read your OTPs.',
    ],
    steps: [
      { text: 'Turn on automatic updates for your operating system and your apps.' },
      { text: 'Use a screen lock (PIN of six digits or more, or biometrics) and keep your SIM PIN enabled.' },
      { text: 'Install apps only from the official store for your platform, and check the developer name before installing.' },
      { text: 'Review app permissions once a month and remove permissions an app does not need.' },
      { text: 'Keep a backup you can restore: this is exactly what LIFEKIT’s backup feature is for.' },
      { text: 'Sign out of accounts on devices you no longer use, and remove old devices from your account settings.' },
    ],
    ifAffected: [
      'If your phone is lost: use your platform’s official find-my-device service, then change the passwords of accounts signed in on it.',
      'If you installed a suspicious APK: uninstall it, change banking passwords from another device, and check for unknown SMS charges.',
    ],
    tags: ['device', 'updates', 'passwords'],
  },
];

export const SAFETY_DISCLAIMER =
  'These checklists are educational. They cannot detect malware, block a scam, or guarantee that a website, caller or job offer is safe. LIFEKIT does not scan your device, does not access your messages, and cannot verify anyone’s identity. When money or documents are involved, confirm details with the organisation directly and report problems to the official channels listed below.';
