/**
 * Canonical owner identity (ai-assistant 7.2c, finalized 2026-07-13).
 *
 * ONE source for who the portfolio's owner is — consumed by the start-frame
 * assembly (mint instructions + `portfolio_overview` tool + MCP) and the
 * legacy `loadUserProfile` tool handler. Previously this text lived hardcoded
 * inside BackendToolService only, which pushed identity through the fid on
 * every flush (the `cmrjljvfm…` ghost-continuation incident: the model
 * treated re-pushed bio content as conversation state).
 *
 * A DB override exists: the `CUSTOM/owner-bio` T1 chunk (same pattern as
 * `CUSTOM/visitor-intro`) wins over this constant when present — content over
 * code, owner-editable in the admin semantic chunk editor.
 */

export const OWNER_PROFILE = {
  name: 'Kirill Prymachov',
  title: 'XR/AI Developer',
  bio: 'Experienced game developer with expertise in realtime 3D mutiplayer games, AR/VR and applied AI engineering',
  skills: [
    'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js',
    'Python', 'PostgreSQL', 'Prisma', 'Tailwind CSS', 'Git', 'Unity', 'Unreal Engine', 'Technical art (shaders)',
  ],
  experience: '7+ years of professional development experience',
  location: 'New York',
  availability: 'Available for new opportunities',
  interests: ['XR', 'applied/agentic AI', 'game development', 'AR applications of the future'],
  education: 'Computer Science Degree',
} as const;

/** Compact single-paragraph identity line for the mint start frame (7.2c). */
export function ownerBioLine(): string {
  const p = OWNER_PROFILE;
  return `${p.name} — ${p.title}. ${p.bio}. ${p.experience}; based in ${p.location}. Interests: ${p.interests.join(', ')}.`;
}
