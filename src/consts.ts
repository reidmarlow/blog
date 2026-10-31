// Global site data. Import from anywhere with the `import` keyword.

export const SITE_TITLE = 'Reid Marlow';
export const SITE_DESCRIPTION =
	'Small sharp tools, AI agents, and the boring plumbing that makes them work. Linux, Python, automation.';

// Hero quote + terminal principles (no separate marketing tagline).
export const QUOTE =
	'We may have knowledge of the past but cannot control it; we may control the future but have no knowledge of it.';
export const PRINCIPLES =
	'Three passions, simple but overwhelmingly strong, have governed my life: the longing for love, the search for knowledge, and unbearable pity for the suffering of mankind.';

// About / whoami.
export const AUTHOR = {
	name: 'Reid Marlow',
	pronouns: 'he/him',
	born: '2001-05-12',
	edu: 'PhD Automation, HK PolyU',
	bio: "I'm Reid Marlow, a technologist working in automation - currently doing PhD research in the field at the Hong Kong Polytechnic University. Here I write up what I actually learn building tools, engineering AI agents, and keeping systems running, along with the workflows and habits that stick. The best is yet to come. We've only scratched the surface.",
};

// Primary navigation.
export const NAV_LINKS = [
	{ href: '/blog', label: 'Blog' },
	{ href: '/about', label: 'About' },
];

// Social links shown in the footer (icon + label).
// icon keys: x | reddit | github | youtube | bluesky
// Omit entries until a real URL exists (no placeholder #).
export const SOCIAL_LINKS = [
	{ label: 'X', href: 'https://x.com/reidmarlowai', icon: 'x' },
	{ label: 'Bluesky', href: 'https://bsky.app/profile/reidmarlow.com', icon: 'bluesky' },
	{ label: 'YouTube', href: 'https://www.youtube.com/channel/UCHIB3rEdXqRDERY7qKehgpg', icon: 'youtube' },
	{ label: 'GitHub', href: 'https://github.com/reidmarlow', icon: 'github' },
	// Reddit: pending handle/URL
];

// Recommended tools. Single source of truth for both the homepage "Tools"
// section and the per-post sidebar (see BlogPost.astro), so every blog page
// carries the outbound link automatically — no manual authoring per post.
// Order matters: first entry is the primary feature on the homepage; the rest
// sit under it as secondary picks. KolmoPDF stays first on purpose.
export const TOOLS = [
	{
		name: 'KolmoPDF',
		kicker: 'pdf -> markdown',
		href: 'https://kolmopdf.com',
		host: 'kolmopdf.com',
		blurb:
			'VLM-based PDF parsing that keeps formulas, tables, code blocks, and multi-column order intact — clean text you can wire straight into an agent or knowledge base.',
		// Longer homepage copy. Sidebar uses `blurb` only.
		longBlurb:
			"Most of what I automate starts by getting clean text out of a PDF, and ordinary parsers fall apart the moment a page has two columns, a formula, or a table that runs across the page break. KolmoPDF is the one I reach for: VLM-based parsing that keeps formulas, tables, code blocks, and multi-column order intact, layout-preserving translation when the source isn't in English, and an API clean enough to wire straight into an agent or a knowledge base. It runs the other direction too - Markdown back out to DOCX, HTML, LaTeX, or PDF.",
	},
	{
		name: 'Typeless',
		kicker: 'voice -> text',
		href: 'https://www.typeless.com',
		host: 'typeless.com',
		blurb:
			'AI voice dictation that lands as clean prose — filler stripped, punctuation placed — so drafting does not have to start at the keyboard.',
		longBlurb:
			"When the bottleneck is the keyboard, not the idea, I switch to Typeless. Speak naturally and it drops polished text into whatever app is focused — messages, notes, editors — with filler words gone and punctuation already in place. Not a full writing stack, just a faster way to get the first draft out of my head.",
	},
];
