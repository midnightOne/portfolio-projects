/**
 * Enhanced UI Components - UI System
 * 
 * Export all enhanced shadcn/ui components with AI control hooks.
 * Provides both enhanced and SSR-compatible variants.
 */

// Enhanced Base Components
export { 
  EnhancedButton, 
  buttonVariants,
  type EnhancedButtonProps 
} from '../enhanced-button';

export {
  EnhancedCard,
  EnhancedCardHeader,
  EnhancedCardFooter,
  EnhancedCardTitle,
  EnhancedCardAction,
  EnhancedCardDescription,
  EnhancedCardContent,
  type EnhancedCardProps,
} from '../enhanced-card';

export {
  EnhancedDialog,
  EnhancedDialogClose,
  EnhancedDialogContent,
  EnhancedDialogDescription,
  EnhancedDialogFooter,
  EnhancedDialogHeader,
  EnhancedDialogOverlay,
  EnhancedDialogPortal,
  EnhancedDialogTitle,
  EnhancedDialogTrigger,
  type EnhancedDialogProps,
  type EnhancedDialogContentProps,
} from '../enhanced-dialog';

// Enhanced Project Components
export {
  EnhancedProjectModal,
  type EnhancedProjectModalProps,
} from '../../projects/enhanced-project-modal';

export {
  EnhancedProjectGrid,
  AIProjectGrid,
  type EnhancedProjectGridProps,
} from '../../projects/enhanced-project-grid';

// Enhanced Layout Components
export {
  EnhancedNavigationBar,
  type EnhancedNavigationBarProps,
} from '../../layout/enhanced-navigation-bar';

// Re-export original components for backward compatibility
export { Button } from '../button';
export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent } from '../card';
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from '../dialog';

// Re-export project components for backward compatibility
export { ProjectModal } from '../../projects/project-modal';
export { ProjectGrid } from '../../projects/project-grid';
export { NavigationBar } from '../../layout/navigation-bar';

// SSR-Compatible Variants
export {
  SSRProjectModal,
  SSRProjectGrid,
  SSRNavigationBar,
  useProgressiveEnhancement,
  type SSRProjectModalProps,
  type SSRProjectGridProps,
  type SSRNavigationBarProps,
  type SSRCompatibleComponent,
} from './ssr-variants';