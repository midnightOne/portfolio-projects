"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, ExternalLink, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CONTAINERS, SPACING, GRID, FLEX } from '@/lib/constants/layout';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface SocialLink {
  platform: string;
  url: string;
  icon: string;
  label?: string;
  color?: string;
}

export interface ContactSectionProps {
  email?: string;
  socialLinks?: SocialLink[];
  showContactForm?: boolean;
  theme?: 'default' | 'dark' | 'minimal' | 'colorful';
  title?: string;
  description?: string;
  className?: string;
}

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface ContactFormState {
  data: ContactFormData;
  isSubmitting: boolean;
  isSubmitted: boolean;
  error: string | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getThemeClasses(theme: string = 'default'): string {
  const themeClasses = {
    default: 'bg-muted/50 text-foreground',
    dark: 'bg-slate-900 text-slate-100',
    minimal: 'bg-white text-gray-900',
    colorful: 'bg-gradient-to-br from-green-50 to-blue-50 text-gray-900'
  };

  return themeClasses[theme as keyof typeof themeClasses] || themeClasses.default;
}

function getSocialIcon(iconName: string): React.ReactNode {
  // Map common social platform names to icons
  const iconMap: Record<string, React.ReactNode> = {
    email: <Mail className="h-5 w-5" />,
    github: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
    linkedin: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    twitter: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
      </svg>
    ),
    website: <ExternalLink className="h-5 w-5" />,
    portfolio: <ExternalLink className="h-5 w-5" />,
    default: <ExternalLink className="h-5 w-5" />
  };

  return iconMap[iconName.toLowerCase()] || iconMap.default;
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94] as const
    }
  }
};

const socialLinkVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94] as const
    }
  },
  hover: {
    scale: 1.05,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94] as const
    }
  }
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface SocialLinksProps {
  links: SocialLink[];
  className?: string;
}

function SocialLinks({ links, className }: SocialLinksProps) {
  if (links.length === 0) return null;

  return (
    <motion.div
      variants={itemVariants}
      className={cn('space-y-4', className)}
    >
      <h3 className="text-lg font-semibold">Connect With Me</h3>
      <div className="flex flex-wrap gap-3">
        {links.map((link, index) => (
          <motion.a
            key={link.platform}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            variants={socialLinkVariants}
            whileHover="hover"
            custom={index}
            className="group"
          >
            <Badge
              variant="outline"
              className={cn(
                'px-4 py-2 text-sm font-medium transition-all duration-200',
                'hover:bg-primary hover:text-primary-foreground hover:border-primary',
                'group-hover:shadow-md'
              )}
              style={
                link.color
                  ? {
                      borderColor: link.color,
                      color: link.color,
                    }
                  : undefined
              }
            >
              <span className="flex items-center gap-2">
                {getSocialIcon(link.icon || link.platform)}
                {link.label || link.platform}
              </span>
            </Badge>
          </motion.a>
        ))}
      </div>
    </motion.div>
  );
}

interface ContactFormProps {
  onSubmit: (data: ContactFormData) => Promise<void>;
  state: ContactFormState;
  setState: React.Dispatch<React.SetStateAction<ContactFormState>>;
  className?: string;
}

function ContactForm({ onSubmit, state, setState, className }: ContactFormProps) {
  const handleInputChange = (field: keyof ContactFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setState(prev => ({
      ...prev,
      data: {
        ...prev.data,
        [field]: e.target.value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.isSubmitting) return;

    setState(prev => ({ ...prev, isSubmitting: true, error: null }));
    
    try {
      await onSubmit(state.data);
      setState(prev => ({ 
        ...prev, 
        isSubmitting: false, 
        isSubmitted: true,
        data: { name: '', email: '', subject: '', message: '' }
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isSubmitting: false, 
        error: error instanceof Error ? error.message : 'Failed to send message'
      }));
    }
  };

  if (state.isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn('text-center py-8', className)}
      >
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Message Sent!</h3>
        <p className="text-muted-foreground">
          Thank you for reaching out. I'll get back to you soon.
        </p>
        <Button
          variant="outline"
          onClick={() => setState(prev => ({ ...prev, isSubmitted: false }))}
          className="mt-4"
        >
          Send Another Message
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.form
      variants={itemVariants}
      onSubmit={handleSubmit}
      className={cn('space-y-4', className)}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Name *
          </label>
          <Input
            id="name"
            type="text"
            value={state.data.name}
            onChange={handleInputChange('name')}
            required
            disabled={state.isSubmitting}
            placeholder="Your name"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email *
          </label>
          <Input
            id="email"
            type="email"
            value={state.data.email}
            onChange={handleInputChange('email')}
            required
            disabled={state.isSubmitting}
            placeholder="your.email@example.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="block text-sm font-medium mb-2">
          Subject *
        </label>
        <Input
          id="subject"
          type="text"
          value={state.data.subject}
          onChange={handleInputChange('subject')}
          required
          disabled={state.isSubmitting}
          placeholder="What's this about?"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-2">
          Message *
        </label>
        <Textarea
          id="message"
          value={state.data.message}
          onChange={handleInputChange('message')}
          required
          disabled={state.isSubmitting}
          placeholder="Your message..."
          rows={5}
        />
      </div>

      {state.error && (
        <div className={cn(FLEX.start, 'gap-2 text-destructive text-sm')}>
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={state.isSubmitting}
        className="w-full gap-2"
      >
        {state.isSubmitting ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Sending...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Send Message
          </>
        )}
      </Button>
    </motion.form>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ContactSection({
  email,
  socialLinks = [],
  showContactForm = true,
  theme = 'default',
  title = 'Get In Touch',
  description = "I'm always interested in new opportunities and collaborations.",
  className
}: ContactSectionProps) {
  const [formState, setFormState] = useState<ContactFormState>({
    data: { name: '', email: '', subject: '', message: '' },
    isSubmitting: false,
    isSubmitted: false,
    error: null
  });

  const handleFormSubmit = async (data: ContactFormData) => {
    // Simulate form submission - replace with actual implementation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In a real implementation, you would send the data to your backend
    console.log('Form submitted:', data);
    
    // For demo purposes, we'll just simulate success
    // throw new Error('This is a demo error'); // Uncomment to test error handling
  };

  const hasDirectContact = email || socialLinks.length > 0;

  return (
    <section
      className={cn(
        'relative',
        SPACING.section.xl,
        getThemeClasses(theme),
        className
      )}
    >
      <div className={CONTAINERS.default}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Section Header */}
          <motion.div
            variants={itemVariants}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {description}
            </p>
            <div className="w-24 h-1 bg-primary mx-auto rounded-full mt-6" />
          </motion.div>

          {/* Main Content */}
          <div className="max-w-4xl mx-auto">
            {showContactForm && hasDirectContact ? (
              <div className={cn(GRID.twoCol, 'gap-12 items-start')}>
                {/* Contact Form */}
                <Card>
                  <CardHeader>
                    <CardTitle>Send a Message</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ContactForm
                      onSubmit={handleFormSubmit}
                      state={formState}
                      setState={setFormState}
                    />
                  </CardContent>
                </Card>

                {/* Direct Contact */}
                <div className="space-y-8">
                  {email && (
                    <motion.div variants={itemVariants}>
                      <Card>
                        <CardContent className="p-6">
                          <h3 className="text-lg font-semibold mb-4">Direct Contact</h3>
                          <a
                            href={`mailto:${email}`}
                            className={cn(
                              FLEX.start,
                              'gap-3 text-muted-foreground hover:text-foreground transition-colors group'
                            )}
                          >
                            <Mail className="h-5 w-5 group-hover:text-primary transition-colors" />
                            <span className="group-hover:underline">{email}</span>
                          </a>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {socialLinks.length > 0 && (
                    <Card>
                      <CardContent className="p-6">
                        <SocialLinks links={socialLinks} />
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            ) : showContactForm ? (
              // Contact form only
              <div className="max-w-2xl mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>Send a Message</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ContactForm
                      onSubmit={handleFormSubmit}
                      state={formState}
                      setState={setFormState}
                    />
                  </CardContent>
                </Card>
              </div>
            ) : (
              // Direct contact only
              <div className="max-w-2xl mx-auto space-y-8">
                {email && (
                  <motion.div variants={itemVariants}>
                    <Card>
                      <CardContent className="p-8 text-center">
                        <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Email Me</h3>
                        <a
                          href={`mailto:${email}`}
                          className="text-lg text-muted-foreground hover:text-foreground transition-colors hover:underline"
                        >
                          {email}
                        </a>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {socialLinks.length > 0 && (
                  <Card>
                    <CardContent className="p-8">
                      <SocialLinks links={socialLinks} className="text-center" />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

export const ContactSectionPresets = {
  full: {
    showContactForm: true,
    theme: 'default' as const,
    title: 'Get In Touch',
    description: "I'm always interested in new opportunities and collaborations."
  },
  
  minimal: {
    showContactForm: false,
    theme: 'minimal' as const,
    title: 'Contact',
    description: 'Feel free to reach out through any of these channels.'
  },
  
  formOnly: {
    showContactForm: true,
    theme: 'default' as const,
    title: 'Send a Message',
    description: 'Have a question or want to work together? Drop me a line!'
  }
} as const;