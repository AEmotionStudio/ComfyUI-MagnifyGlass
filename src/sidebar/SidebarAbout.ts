/**
 * ComfyUI MagnifyGlass - Sidebar About
 *
 * Version, project and studio links, and the studio's other packs.
 */

import type { ComfyBadge } from '../types/comfyui';

const REPO = 'https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass';
const DISCORD = 'https://discord.gg/UzC9353mfp';
const KOFI = 'https://ko-fi.com/aemotionstudio';
const WEBSITE = 'https://aemotionstudio.org/';

const LINKS = [
    ['pi-github', 'GitHub', REPO],
    ['pi-exclamation-circle', 'Report an issue', `${REPO}/issues`],
    ['pi-discord', 'Discord', DISCORD],
    ['pi-youtube', 'YouTube', 'https://www.youtube.com/@aemotionstudio/videos'],
    ['pi-heart', 'Ko-fi', KOFI],
    ['pi-globe', 'Website', WEBSITE],
];

/** Each pack's URL as its pyproject.toml or git remote gives it. */
const PACKS = [
    ['Enhanced Links & Nodes', 'Animated links and nodes that keep every native click.', 'https://github.com/AEmotionStudio/ComfyUI-EnhancedLinksandNodes'],
    ['FFMPEGA', 'Video editing in natural language with an FFMPEG agent.', 'https://github.com/AEmotionStudio/ComfyUI-FFMPEGA'],
    ['ShaderNoiseKSampler', 'A KSampler that blends shader noise into generation.', 'https://github.com/AEmotionStudio/ComfyUI-ShaderNoiseKSampler'],
    ['DiscordSend', 'Send images and videos straight to Discord.', 'https://github.com/AEmotionStudio/ComfyUI-DiscordSend'],
    ['RefCap', 'Reference capture for MiniMax H3.', 'https://github.com/AEmotionStudio/ComfyUI-RefCap'],
    ['PROMPTA', 'Natural language into model-specific prompts.', 'https://github.com/AEmotionStudio/ComfyUI-PROMPTA'],
    ['Chat2Me', 'Chat with a character that replies in video.', 'https://github.com/aemotion-studio/ComfyUI-Chat2Me'],
];

/** Enhanced Links & Nodes already gives the About page the studio's Discord and Ko-fi, and the page keys badges by URL. */
export const ABOUT_BADGES: ComfyBadge[] = [
    { label: `MagnifyGlass ${__MAGNIFY_VERSION__}`, url: REPO, icon: 'pi pi-github' },
];

const STUDIO = 'Developed by Æmotion Studio, MagnifyGlass brings a customizable magnifying glass and node inspector to your ComfyUI workflow. Contributions are welcome!';

function link(href: string, text: string): HTMLAnchorElement {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = text;
    return a;
}

function icon(name: string): HTMLElement {
    const i = document.createElement('i');
    i.className = `pi ${name}`;
    i.setAttribute('aria-hidden', 'true');
    return i;
}

export function renderAbout(): HTMLElement {
    const about = document.createElement('section');
    about.className = 'magnify-about';

    const brand = document.createElement('div');
    brand.className = 'magnify-brand';
    const heading = document.createElement('h3');
    heading.className = 'magnify-heading';
    heading.textContent = `MagnifyGlass ${__MAGNIFY_VERSION__}`;
    const byline = document.createElement('p');
    byline.className = 'magnify-hint';
    byline.textContent = 'by Æmotion Studio · GPL-3.0';
    const text = document.createElement('div');
    text.append(heading, byline);
    brand.append(icon('pi-search'), text);

    const actions = document.createElement('div');
    actions.className = 'magnify-actions';
    for (const [name, label, href] of LINKS) {
        const a = link(href, label);
        a.className = 'magnify-link';
        a.prepend(icon(name));
        actions.appendChild(a);
    }

    const studio = document.createElement('details');
    studio.className = 'magnify-studio';
    const summary = document.createElement('summary');
    summary.textContent = 'More from Æmotion Studio';
    const blurb = document.createElement('p');
    blurb.textContent = STUDIO;
    const packs = document.createElement('ul');
    packs.className = 'magnify-packs';
    for (const [name, what, href] of PACKS) {
        const item = document.createElement('li');
        const hint = document.createElement('span');
        hint.className = 'magnify-hint';
        hint.textContent = what;
        item.append(link(href, name), hint);
        packs.appendChild(item);
    }
    studio.append(summary, blurb, packs);

    about.append(brand, actions, studio);
    return about;
}
