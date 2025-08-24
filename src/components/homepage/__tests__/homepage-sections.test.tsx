/**
 * Basic tests for homepage section components
 */

import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { HeroSection } from '../hero-section';
import { AboutSection } from '../about-section';
import { ContactSection } from '../contact-section';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
    a: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe('Homepage Section Components', () => {
  describe('HeroSection', () => {
    it('renders title and subtitle', () => {
      render(
        <HeroSection
          title="John Doe"
          subtitle="Full Stack Developer"
          description="Building digital experiences"
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Full Stack Developer')).toBeInTheDocument();
      expect(screen.getByText('Building digital experiences')).toBeInTheDocument();
    });

    it('renders CTA button when provided', () => {
      render(
        <HeroSection
          title="John Doe"
          subtitle="Developer"
          ctaText="View My Work"
          ctaLink="#projects"
        />
      );

      expect(screen.getByText('View My Work')).toBeInTheDocument();
    });

    it('renders scroll indicator by default', () => {
      render(
        <HeroSection
          title="John Doe"
          subtitle="Developer"
        />
      );

      expect(screen.getByText('Scroll Down')).toBeInTheDocument();
    });
  });

  describe('AboutSection', () => {
    it('renders content and section title', () => {
      render(
        <AboutSection
          content="I'm a passionate developer with expertise in modern web technologies."
        />
      );

      expect(screen.getByText('About Me')).toBeInTheDocument();
      expect(screen.getByText("I'm a passionate developer with expertise in modern web technologies.")).toBeInTheDocument();
    });

    it('renders skills when provided', () => {
      render(
        <AboutSection
          content="Developer content"
          skills={['React', 'TypeScript', 'Node.js']}
          showSkills={true}
        />
      );

      expect(screen.getByText('Skills & Technologies')).toBeInTheDocument();
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('Node.js')).toBeInTheDocument();
    });

    it('does not render skills when showSkills is false', () => {
      render(
        <AboutSection
          content="Developer content"
          skills={['React', 'TypeScript']}
          showSkills={false}
        />
      );

      expect(screen.queryByText('Skills & Technologies')).not.toBeInTheDocument();
    });
  });

  describe('ContactSection', () => {
    it('renders section title and description', () => {
      render(
        <ContactSection
          title="Get In Touch"
          description="I'm always interested in new opportunities."
        />
      );

      expect(screen.getByText('Get In Touch')).toBeInTheDocument();
      expect(screen.getByText("I'm always interested in new opportunities.")).toBeInTheDocument();
    });

    it('renders contact form when enabled', () => {
      render(
        <ContactSection
          showContactForm={true}
        />
      );

      expect(screen.getByText('Send a Message')).toBeInTheDocument();
      expect(screen.getByLabelText('Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Email *')).toBeInTheDocument();
      expect(screen.getByLabelText('Subject *')).toBeInTheDocument();
      expect(screen.getByLabelText('Message *')).toBeInTheDocument();
    });

    it('renders social links when provided', () => {
      const socialLinks = [
        { platform: 'GitHub', url: 'https://github.com/user', icon: 'github' },
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/user', icon: 'linkedin' }
      ];

      render(
        <ContactSection
          socialLinks={socialLinks}
        />
      );

      expect(screen.getByText('Connect With Me')).toBeInTheDocument();
      expect(screen.getByText('GitHub')).toBeInTheDocument();
      expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    });

    it('renders email contact when provided', () => {
      render(
        <ContactSection
          email="john@example.com"
          showContactForm={false}
        />
      );

      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });
  });
});