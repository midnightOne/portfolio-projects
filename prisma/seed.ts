/**
 * Database seeding script for portfolio projects
 */

import { PrismaClient } from '@prisma/client';
import { PORTFOLIO_ARTICLE, LLM_RESEARCH_ARTICLE, ECOMMERCE_ARTICLE } from './seed-articles';
// Novel converter removed - using plain text content for now

const prisma = new PrismaClient();

// Helper function to convert markdown-like text to Tiptap JSON
function convertToTiptapJSON(text: string) {
  return {
    type: 'doc',
    content: text.split('\n\n').filter(p => p.trim()).map(paragraph => {
      if (paragraph.startsWith('# ')) {
        return {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: paragraph.replace('# ', '') }]
        };
      } else if (paragraph.startsWith('## ')) {
        return {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: paragraph.replace('## ', '') }]
        };
      } else if (paragraph.startsWith('### ')) {
        return {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: paragraph.replace('### ', '') }]
        };
      } else if (paragraph.startsWith('> ')) {
        return {
          type: 'blockquote',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: paragraph.replace('> ', '') }]
          }]
        };
      } else if (paragraph.startsWith('```')) {
        // Handle code blocks
        const lines = paragraph.split('\n');
        const codeContent = lines.slice(1, -1).join('\n');
        return {
          type: 'codeBlock',
          content: [{ type: 'text', text: codeContent }]
        };
      } else if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
        // Handle bullet lists
        const items = paragraph.split('\n').filter(line => line.startsWith('- ') || line.startsWith('* '));
        return {
          type: 'bulletList',
          content: items.map(item => ({
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: item.replace(/^[*-] /, '') }]
            }]
          }))
        };
      } else {
        // Handle basic formatting in paragraphs
        const content = [];
        const parts = paragraph.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|~~.*?~~)/);

        for (const part of parts) {
          if (part.startsWith('**') && part.endsWith('**')) {
            content.push({
              type: 'text',
              text: part.slice(2, -2),
              marks: [{ type: 'bold' }]
            });
          } else if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
            content.push({
              type: 'text',
              text: part.slice(1, -1),
              marks: [{ type: 'italic' }]
            });
          } else if (part.startsWith('`') && part.endsWith('`')) {
            content.push({
              type: 'text',
              text: part.slice(1, -1),
              marks: [{ type: 'code' }]
            });
          } else if (part.startsWith('~~') && part.endsWith('~~')) {
            content.push({
              type: 'text',
              text: part.slice(2, -2),
              marks: [{ type: 'strike' }]
            });
          } else if (part.trim()) {
            content.push({
              type: 'text',
              text: part
            });
          }
        }

        return {
          type: 'paragraph',
          content: content.length > 0 ? content : [{ type: 'text', text: paragraph }]
        };
      }
    })
  };
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Create some tags
  const reactTag = await prisma.tag.upsert({
    where: { name: 'React' },
    update: {},
    create: {
      name: 'React',
      color: '#61DAFB',
    },
  });

  const typescriptTag = await prisma.tag.upsert({
    where: { name: 'TypeScript' },
    update: {},
    create: {
      name: 'TypeScript',
      color: '#3178C6',
    },
  });

  const nextjsTag = await prisma.tag.upsert({
    where: { name: 'Next.js' },
    update: {},
    create: {
      name: 'Next.js',
      color: '#000000',
    },
  });

  const webdevTag = await prisma.tag.upsert({
    where: { name: 'Web Development' },
    update: {},
    create: {
      name: 'Web Development',
      color: '#FF6B6B',
    },
  });

  const aiEngineeringTag = await prisma.tag.upsert({
    where: { name: 'AI Engineering' },
    update: {},
    create: {
      name: 'AI Engineering',
      color: '#9B59B6',
    },
  });

  const mlTag = await prisma.tag.upsert({
    where: { name: 'Machine Learning' },
    update: {},
    create: {
      name: 'Machine Learning',
      color: '#1ABC9C',
    },
  });

  // Sample projects. `update` deliberately REFRESHES the descriptive fields
  // and (below) the article content, so `npm run db:seed` against an existing
  // dev DB brings the articles up to date instead of silently keeping stale
  // copy — the owner reseeds during testing/debugging and the seed is the
  // source of truth for this content (2026-07-17 deep-content rewrite).
  const project1 = await prisma.project.upsert({
    where: { slug: 'portfolio-website' },
    update: {
      title: 'This Portfolio — an AI-Narrated Website',
      description:
        'The site you are on right now: a Next.js portfolio that is itself the flagship project — client-direct realtime voice AI, a tiered semantic retrieval index over pgvector, a node-graph conversation engine, and hard cost governance, all documented honestly.',
      briefOverview: 'The AI-narrated portfolio site itself — voice, retrieval, and cost control',
    },
    create: {
      title: 'This Portfolio — an AI-Narrated Website',
      slug: 'portfolio-website',
      description:
        'The site you are on right now: a Next.js portfolio that is itself the flagship project — client-direct realtime voice AI, a tiered semantic retrieval index over pgvector, a node-graph conversation engine, and hard cost governance, all documented honestly.',
      briefOverview: 'The AI-narrated portfolio site itself — voice, retrieval, and cost control',
      workDate: new Date('2026-06-15'),
      visibility: 'PUBLIC',
      viewCount: 42,
      tags: {
        connect: [
          { id: reactTag.id },
          { id: typescriptTag.id },
          { id: nextjsTag.id },
          { id: aiEngineeringTag.id },
        ],
      },
    },
  });

  // 2026-07-17: the placeholder Task Management App is retired — replaced by
  // an LLM-systems research notebook (owner ask: deep, multi-topic content
  // worth learning from while testing retrieval/escalation). Remove the old
  // project AND its semantic entity so an in-place reseed leaves no stale
  // slug in retrieval (chunks cascade off the entity).
  await prisma.contentEntity.deleteMany({
    where: { entityType: 'PROJECT', slug: 'task-management-app' },
  });
  await prisma.project.deleteMany({ where: { slug: 'task-management-app' } });

  const project2 = await prisma.project.upsert({
    where: { slug: 'llm-systems-research' },
    update: {
      title: 'Modern LLM Systems — Research Notes',
      description:
        'A research notebook on how modern large language models actually work: attention and the KV cache, scaling laws, long context, post-training from SFT through reasoning RL, efficient inference, mixture-of-experts, retrieval-augmented generation, and evaluation.',
      briefOverview: 'Deep research notes on modern LLM internals and engineering',
    },
    create: {
      title: 'Modern LLM Systems — Research Notes',
      slug: 'llm-systems-research',
      description:
        'A research notebook on how modern large language models actually work: attention and the KV cache, scaling laws, long context, post-training from SFT through reasoning RL, efficient inference, mixture-of-experts, retrieval-augmented generation, and evaluation.',
      briefOverview: 'Deep research notes on modern LLM internals and engineering',
      workDate: new Date('2025-11-01'),
      visibility: 'PUBLIC',
      viewCount: 28,
      tags: {
        connect: [
          { id: aiEngineeringTag.id },
          { id: mlTag.id },
        ],
      },
    },
  });

  const project3 = await prisma.project.upsert({
    where: { slug: 'e-commerce-platform' },
    update: {
      title: 'E-commerce Platform',
      description:
        'A production e-commerce build examined at engineering depth: catalog modeling, inventory concurrency and the oversell problem, payment idempotency and reconciliation, checkout as a distributed transaction, search, caching, and fraud economics.',
      briefOverview: 'E-commerce engineering: payments, inventory concurrency, checkout sagas',
    },
    create: {
      title: 'E-commerce Platform',
      slug: 'e-commerce-platform',
      description:
        'A production e-commerce build examined at engineering depth: catalog modeling, inventory concurrency and the oversell problem, payment idempotency and reconciliation, checkout as a distributed transaction, search, caching, and fraud economics.',
      briefOverview: 'E-commerce engineering: payments, inventory concurrency, checkout sagas',
      workDate: new Date('2024-02-10'),
      visibility: 'PUBLIC',
      viewCount: 67,
      tags: {
        connect: [
          { id: reactTag.id },
          { id: typescriptTag.id },
          { id: webdevTag.id },
        ],
      },
    },
  });

  // Media is created (not upserted) — clear the seeded projects' media first
  // so an in-place reseed doesn't duplicate rows.
  await prisma.mediaItem.deleteMany({
    where: { projectId: { in: [project1.id, project2.id, project3.id] } },
  });
  await prisma.externalLink.deleteMany({
    where: { projectId: { in: [project1.id, project2.id, project3.id] } },
  });

  // Create diverse media items for testing inline media functionality

  // Project 1 Media Items (Portfolio Website)
  await prisma.mediaItem.create({
    data: {
      projectId: project1.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
      altText: 'Portfolio website homepage',
      description: 'The main landing page featuring a clean, modern design with smooth animations and responsive layout.',
      width: 1200,
      height: 800,
      displayOrder: 1,
    },
  });

  await prisma.mediaItem.create({
    data: {
      projectId: project1.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400',
      altText: 'Portfolio analytics dashboard',
      description: 'Built-in analytics showing visitor engagement and project views with interactive charts.',
      width: 1200,
      height: 600,
      displayOrder: 2,
    },
  });

  await prisma.mediaItem.create({
    data: {
      projectId: project1.id,
      type: 'GIF',
      url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExYjV0d2syczNjZWlxbWE4dm15cXRscnllNXFrZm5wcGhnN3Nqa3l1eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26tn33aiTi1jkl6H6/giphy.gif',
      altText: 'Interactive navigation animation',
      description: 'Smooth hover animations and transitions throughout the navigation system.',
      width: 480,
      height: 270,
      displayOrder: 3,
    },
  });

  // Project 2 Media Items (LLM Systems Research Notes)
  await prisma.mediaItem.create({
    data: {
      projectId: project2.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400',
      altText: 'Attention heatmap visualization',
      description: 'Visualizing attention weights across a long prompt — the diagonal band is local attention, the vertical stripes are attention sinks.',
      width: 1200,
      height: 800,
      displayOrder: 1,
    },
  });

  await prisma.mediaItem.create({
    data: {
      projectId: project2.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=400',
      altText: 'Training loss curves',
      description: 'Loss curves from scaling-law sweeps — model size against data budget at fixed compute.',
      width: 800,
      height: 1200,
      displayOrder: 2,
    },
  });

  // Project 3 Media Items (E-commerce Platform)
  await prisma.mediaItem.create({
    data: {
      projectId: project3.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400',
      altText: 'E-commerce storefront',
      description: 'Modern product catalog with advanced filtering, search functionality, and intuitive navigation.',
      width: 1200,
      height: 800,
      displayOrder: 1,
    },
  });

  await prisma.mediaItem.create({
    data: {
      projectId: project3.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400',
      altText: 'Shopping cart and checkout',
      description: 'Streamlined checkout process with secure payment integration and order tracking.',
      width: 1200,
      height: 800,
      displayOrder: 2,
    },
  });

  await prisma.mediaItem.create({
    data: {
      projectId: project3.id,
      type: 'WEBM',
      url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
      thumbnailUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400',
      altText: 'Admin dashboard demo',
      description: 'Complete walkthrough of the admin dashboard featuring inventory management, order processing, and analytics.',
      width: 854,
      height: 480,
      displayOrder: 3,
    },
  });

  await prisma.mediaItem.create({
    data: {
      projectId: project3.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
      altText: 'Payment processing interface',
      description: 'Secure payment gateway integration supporting multiple payment methods and currencies.',
      width: 1200,
      height: 600,
      displayOrder: 4,
    },
  });

  // Create external links
  await prisma.externalLink.create({
    data: {
      projectId: project1.id,
      label: 'Live Demo',
      url: 'https://portfolio-demo.example.com',
      icon: 'external-link',
      description: 'View the live portfolio website',
      order: 1,
    },
  });

  await prisma.externalLink.create({
    data: {
      projectId: project1.id,
      label: 'GitHub Repository',
      url: 'https://github.com/example/portfolio',
      icon: 'github',
      description: 'Source code on GitHub',
      order: 2,
    },
  });

  // Create comprehensive article content for all projects showcasing Novel editor features
  const project1ArticleText = PORTFOLIO_ARTICLE;

  await prisma.articleContent.upsert({
    where: { projectId: project1.id },
    update: {
      content: project1ArticleText,
      jsonContent: convertToTiptapJSON(project1ArticleText),
      contentType: 'json',
    },
    create: {
      projectId: project1.id,
      content: project1ArticleText,
      jsonContent: convertToTiptapJSON(project1ArticleText),
      contentType: 'json',
    },
  });

  const project2ArticleText = LLM_RESEARCH_ARTICLE;

  await prisma.articleContent.upsert({
    where: { projectId: project2.id },
    update: {
      content: project2ArticleText,
      jsonContent: convertToTiptapJSON(project2ArticleText),
      contentType: 'json',
    },
    create: {
      projectId: project2.id,
      content: project2ArticleText,
      jsonContent: convertToTiptapJSON(project2ArticleText),
      contentType: 'json',
    },
  });

  const project3ArticleText = ECOMMERCE_ARTICLE;

  await prisma.articleContent.upsert({
    where: { projectId: project3.id },
    update: {
      content: project3ArticleText,
      jsonContent: convertToTiptapJSON(project3ArticleText),
      contentType: 'json',
    },
    create: {
      projectId: project3.id,
      content: project3ArticleText,
      jsonContent: convertToTiptapJSON(project3ArticleText),
      contentType: 'json',
    },
  });

  // Create default AI configuration
  await prisma.aIModelConfig.upsert({
    where: { provider: 'openai' },
    update: {},
    create: {
      provider: 'openai',
      models: 'gpt-4o,gpt-4o-mini,gpt-3.5-turbo',
    },
  });

  await prisma.aIModelConfig.upsert({
    where: { provider: 'anthropic' },
    update: {},
    create: {
      provider: 'anthropic',
      models: 'claude-3-5-sonnet-20241022,claude-3-5-haiku-20241022',
    },
  });

  await prisma.aIGeneralSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      defaultProvider: 'openai',
      systemPrompt: 'You are an expert content editor for portfolio projects. Help improve and edit project content while maintaining the author\'s voice and style.',
      temperature: 0.7,
      maxTokens: 4000,
    },
  });

  // --- access-and-cost Phase 2: watchdog, public access, model aliases, pricing (D31/D32/D38) ---
  await prisma.aIGlobalLimits.upsert({
    where: { id: 'global' },
    update: {},
    create: { id: 'global' }, // schema defaults: $5/day, $50/month, active, public enabled
  });

  await prisma.aIPublicAccessSettings.upsert({
    where: { id: 'public' },
    update: {},
    create: {
      id: 'public',
      publicTier: 'text_chat', // D31: default moves from 'disabled' to text-chat
      turnstileEnabled: true,  // dev uses Cloudflare test keys (see CLAUDE.md); swap keys at deploy
    },
  });

  const modelAliases: Array<{ alias: string; provider: string; modelId: string }> = [
    { alias: 'default-chat', provider: 'openai', modelId: 'gpt-4o' },
    { alias: 'default-cheap', provider: 'openai', modelId: 'gpt-4o-mini' },
    // N5 per-category engine aliases: classifier = the per-turn P26 cheap
    // call; summarizer = the N1 profile+summary jobs (owner intends a
    // stronger model there — repoint via the ModelAliasPanel, no deploy).
    { alias: 'default-classifier', provider: 'openai', modelId: 'gpt-4o-mini' },
    { alias: 'default-summarizer', provider: 'openai', modelId: 'gpt-4o-mini' },
    { alias: 'default-reasoning', provider: 'openai', modelId: 'gpt-4o' },
    // Google for tail-latency stability (owner + live benchmark 2026-07-09:
    // p50 parity ~190ms, but OpenAI spikes to 1.5–3.7s vs Google p90 ~210ms).
    // Switching this alias REQUIRES re-embedding every chunk (embeddings stage).
    { alias: 'default-embedding', provider: 'google', modelId: 'gemini-embedding-001' },
    { alias: 'default-realtime', provider: 'openai', modelId: 'gpt-realtime' },
    { alias: 'default-tts', provider: 'openai', modelId: 'gpt-4o-mini-tts' },
    // Renders D50 clips in Gemini Live's own prebuilt voices (strict voice match).
    { alias: 'default-tts-google', provider: 'google', modelId: 'gemini-3.1-flash-tts-preview' },
    { alias: 'default-stt', provider: 'openai', modelId: 'gpt-4o-mini-transcribe' },
  ];
  for (const a of modelAliases) {
    await prisma.aIModelAlias.upsert({
      where: { alias: a.alias },
      update: {},
      create: a,
    });
  }

  // D50 pre-recorded voice clip phrases (ai-assistant 9b) — the admin-managed
  // script; clips themselves are generated via the admin regenerate action,
  // never seeded (they're TTS output, not fixture data).
  const clipPhrases: Array<{ id: string; text: string; tag: string; enabled?: boolean; sortOrder: number }> = [
    // Filler pool — several variants per category, randomized at play time
    // (owner, 2026-07-08): the repetition is what makes a single filler grating.
    { id: 'filler_checking_1', text: 'Let me look that up for you.', tag: 'filler', sortOrder: 0 },
    { id: 'filler_checking_2', text: 'One moment — checking that now.', tag: 'filler', sortOrder: 1 },
    { id: 'filler_checking_3', text: 'Just a second, pulling that up.', tag: 'filler', sortOrder: 2 },
    { id: 'filler_checking_4', text: 'Let me take a look.', tag: 'filler', sortOrder: 3 },
    { id: 'filler_checking_5', text: 'Give me a moment to search for that.', tag: 'filler', sortOrder: 4 },
    { id: 'filler_checking_6', text: 'Hmm, let me find that.', tag: 'filler', sortOrder: 5 },
    { id: 'disruption_reconnecting', text: 'Sorry — small connection hiccup. Re-establishing now.', tag: 'disruption', sortOrder: 0 },
    { id: 'disruption_reconnecting_2', text: 'One second — reconnecting.', tag: 'disruption', sortOrder: 1 },
    { id: 'resume_failed', text: "I couldn't restore the connection. Please try reconnecting in a moment.", tag: 'resume_failed', sortOrder: 0 },
    // Cold-start greeting is OPTIONAL per D50 — ships disabled.
    { id: 'greeting_coldstart', text: 'Hi! Give me just a second to get set up.', tag: 'greeting', enabled: false, sortOrder: 0 },
  ];
  for (const p of clipPhrases) {
    await prisma.voiceClipPhrase.upsert({
      where: { id: p.id },
      update: {},
      create: { id: p.id, text: p.text, tag: p.tag, enabled: p.enabled ?? true, sortOrder: p.sortOrder },
    });
  }

  const modelPricing: Array<{ modelId: string; provider: string; inputPerMTokUsd: number; outputPerMTokUsd: number; notes?: string }> = [
    { modelId: 'gpt-4o', provider: 'openai', inputPerMTokUsd: 2.5, outputPerMTokUsd: 10 },
    { modelId: 'gpt-4o-mini', provider: 'openai', inputPerMTokUsd: 0.15, outputPerMTokUsd: 0.6 },
    { modelId: 'gpt-3.5-turbo', provider: 'openai', inputPerMTokUsd: 0.5, outputPerMTokUsd: 1.5 },
    { modelId: 'text-embedding-3-small', provider: 'openai', inputPerMTokUsd: 0.02, outputPerMTokUsd: 0 },
    { modelId: 'text-embedding-3-large', provider: 'openai', inputPerMTokUsd: 0.13, outputPerMTokUsd: 0 },
    { modelId: 'gemini-embedding-001', provider: 'google', inputPerMTokUsd: 0.15, outputPerMTokUsd: 0, notes: 'embeddings endpoint reports no usage — callers meter estimated tokens; price VERIFY at deploy (D38)' },
    { modelId: 'gpt-realtime', provider: 'openai', inputPerMTokUsd: 4, outputPerMTokUsd: 16, notes: 'text tokens only; audio token pricing lands with voice metering (Phase 4)' },
    { modelId: 'gpt-4o-mini-tts', provider: 'openai', inputPerMTokUsd: 0.6, outputPerMTokUsd: 12, notes: 'TTS: text-in / audio-out; speech endpoint returns no usage, so callers meter estimated tokens' },
    { modelId: 'gpt-4o-mini-transcribe', provider: 'openai', inputPerMTokUsd: 3, outputPerMTokUsd: 5, notes: 'STT: audio-in / text-out; no usage block, callers meter estimated tokens from the transcript' },
    { modelId: 'gemini-3.1-flash-tts-preview', provider: 'google', inputPerMTokUsd: 0.5, outputPerMTokUsd: 10, notes: 'Gemini 3.1 TTS (D50 clips in Gemini Live voices): text-in / audio-out; callers meter estimated tokens' },
    { modelId: 'scribe_v1', provider: 'elevenlabs', inputPerMTokUsd: 0, outputPerMTokUsd: 0, notes: 'ElevenLabs Scribe STT — credit-based subscription, no per-token price; ledger rows carry usage counts only' },
    { modelId: 'eleven_flash_v2_5', provider: 'elevenlabs', inputPerMTokUsd: 0, outputPerMTokUsd: 0, notes: 'ElevenLabs Flash TTS — credit-based subscription, no per-token price; ledger rows carry usage counts only' },
    { modelId: 'claude-sonnet-4-5-20250929', provider: 'anthropic', inputPerMTokUsd: 3, outputPerMTokUsd: 15 },
    { modelId: 'claude-haiku-4-5-20251001', provider: 'anthropic', inputPerMTokUsd: 1, outputPerMTokUsd: 5 },
    { modelId: 'gemini-2.5-flash', provider: 'google', inputPerMTokUsd: 0.3, outputPerMTokUsd: 2.5 },
    { modelId: 'gemini-2.5-pro', provider: 'google', inputPerMTokUsd: 1.25, outputPerMTokUsd: 10 },
    { modelId: 'fake-reasoning', provider: 'fake', inputPerMTokUsd: 0, outputPerMTokUsd: 0, notes: 'AI_FAKE_MODE test double' },
    { modelId: 'fake-embedding', provider: 'fake', inputPerMTokUsd: 0, outputPerMTokUsd: 0, notes: 'AI_FAKE_MODE test double' },
  ];
  for (const p of modelPricing) {
    await prisma.aIModelPricing.upsert({
      where: { modelId: p.modelId },
      update: {},
      create: p,
    });
  }

  // Create voice AI configurations using the serialization system
  try {
    const { getSerializerForProvider } = await import('../src/lib/voice/config-serializers');
    
    // Create default OpenAI Realtime configuration
    const openaiSerializer = getSerializerForProvider('openai');
    const defaultOpenAIConfig = openaiSerializer.getDefaultConfig();
    
    await prisma.voiceProviderConfig.upsert({
      where: { 
        provider_name: {
          provider: 'openai',
          name: 'Default'
        }
      },
      update: {},
      create: {
        provider: 'openai',
        name: 'Default',
        isDefault: true,
        configJson: openaiSerializer.serialize(defaultOpenAIConfig),
      },
    });

    // Create professional OpenAI configuration with different voice
    const professionalOpenAIConfig = {
      ...defaultOpenAIConfig,
      displayName: 'Professional Assistant',
      description: 'Professional voice assistant optimized for business interactions',
      voice: 'marin' as const,
      temperature: 0.5,
      instructions: 'You are a professional AI assistant for a portfolio website. Speak clearly and professionally, focusing on the portfolio owner\'s expertise and accomplishments. Maintain a confident, knowledgeable tone suitable for business interactions.',
    };

    await prisma.voiceProviderConfig.upsert({
      where: { 
        provider_name: {
          provider: 'openai',
          name: 'Professional'
        }
      },
      update: {},
      create: {
        provider: 'openai',
        name: 'Professional',
        isDefault: false,
        configJson: openaiSerializer.serialize(professionalOpenAIConfig),
      },
    });

    // Create casual OpenAI configuration
    const casualOpenAIConfig = {
      ...defaultOpenAIConfig,
      displayName: 'Casual Assistant',
      description: 'Friendly, conversational voice assistant for informal interactions',
      voice: 'echo' as const,
      temperature: 0.8,
      instructions: 'You are a friendly AI assistant for a portfolio website. Use a conversational, approachable tone while still being informative. Feel free to be enthusiastic about the portfolio owner\'s projects and skills.',
    };

    await prisma.voiceProviderConfig.upsert({
      where: { 
        provider_name: {
          provider: 'openai',
          name: 'Casual'
        }
      },
      update: {},
      create: {
        provider: 'openai',
        name: 'Casual',
        isDefault: false,
        configJson: openaiSerializer.serialize(casualOpenAIConfig),
      },
    });

    // Create default ElevenLabs configuration
    const elevenLabsSerializer = getSerializerForProvider('elevenlabs');
    const defaultElevenLabsConfig = elevenLabsSerializer.getDefaultConfig();

    await prisma.voiceProviderConfig.upsert({
      where: { 
        provider_name: {
          provider: 'elevenlabs',
          name: 'Default'
        }
      },
      update: {},
      create: {
        provider: 'elevenlabs',
        name: 'Default',
        isDefault: true,
        configJson: elevenLabsSerializer.serialize(defaultElevenLabsConfig),
      },
    });

    console.log('✅ Voice AI configurations seeded successfully!');
  } catch (error) {
    console.log('⚠️  Skipping voice AI configuration seeding (serializers not available):', error instanceof Error ? error.message : 'Unknown error');
  }

  // Seed test reflinks
  try {
    await prisma.aIReflink.upsert({
      where: { code: 'test-basic' },
      update: {},
      create: {
        code: 'test-basic',
        name: 'Basic Test Reflink',
        description: 'A basic reflink for testing with standard rate limits',
        rateLimitTier: 'STANDARD',
        dailyLimit: 50,
        isActive: true,
        enableVoiceAI: true,
        enableJobAnalysis: true,
        enableAdvancedNavigation: true,
        recipientName: 'Test User',
        recipientEmail: 'test@example.com',
        customContext: 'This is a test reflink for basic functionality testing.',
        tokenLimit: 10000,
        spendLimit: 25.00,
      }
    });

    await prisma.aIReflink.upsert({
      where: { code: 'test-premium' },
      update: {},
      create: {
        code: 'test-premium',
        name: 'Premium Test Reflink',
        description: 'A premium reflink for testing with higher limits and features',
        rateLimitTier: 'PREMIUM',
        dailyLimit: 500,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        isActive: true,
        enableVoiceAI: true,
        enableJobAnalysis: true,
        enableAdvancedNavigation: true,
        recipientName: 'Premium Test User',
        recipientEmail: 'premium@example.com',
        customContext: 'This is a premium test reflink with enhanced features and higher limits for comprehensive testing.',
        tokenLimit: 100000,
        spendLimit: 500.00,
      }
    });

    console.log('✅ Test reflinks seeded successfully!');
  } catch (error) {
    console.log('⚠️  Error seeding reflinks:', error instanceof Error ? error.message : 'Unknown error');
  }

  console.log('✅ Database seeded successfully!');
  console.log(`Created ${await prisma.tag.count()} tags`);
  console.log(`Created ${await prisma.project.count()} projects`);
  console.log(`Created ${await prisma.mediaItem.count()} media items`);
  console.log(`Created ${await prisma.externalLink.count()} external links`);
  console.log(`Created ${await prisma.aIModelConfig.count()} AI model configurations`);
  console.log(`Created ${await prisma.aIGeneralSettings.count()} AI general settings`);
  console.log(`Created ${await prisma.voiceProviderConfig.count()} voice provider configurations`);
  console.log(`Created ${await prisma.aIReflink.count()} AI reflinks`);

  // Semantic ingestion is NOT run at seed time (D27/D37 — legacy pipelines removed).
  // Ingest per-project via POST /api/admin/semantic/processing/start after seeding.
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });