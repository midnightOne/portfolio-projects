/**
 * Homepage Components
 * 
 * Modular, reusable homepage section components that can be configured
 * independently and used across different page layouts.
 */

// Main section components
export { HeroSection, HeroSectionPresets } from './hero-section';
export { AboutSection, AboutSectionPresets } from './about-section';
export { ContactSection, ContactSectionPresets } from './contact-section';
export { 
  SectionRenderer, 
  HomepagePresets,
  createSectionConfig,
  sortSectionsByOrder,
  getEnabledSections,
  validateHomepageConfig
} from './section-renderer';

// Types
export type { HeroSectionProps } from './hero-section';
export type { AboutSectionProps, Skill } from './about-section';
export type { ContactSectionProps, SocialLink } from './contact-section';
export type { 
  SectionRendererProps,
  SectionConfig,
  HomepageConfig,
  SectionType,
  CustomSectionProps
} from './section-renderer';