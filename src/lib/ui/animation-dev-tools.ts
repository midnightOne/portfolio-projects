/**
 * Animation Development Tools - UI System
 * 
 * Development tools for previewing, debugging, performance monitoring,
 * and managing animation conflicts in the custom animation system.
 * 
 * Task 8: Build Animation Development Tools
 * - Create animation preview and debugging utilities ✓
 * - Implement animation performance monitoring and optimization ✓
 * - Add development tools for testing custom animations ✓
 * - Build priority and override systems for managing animation conflicts ✓
 * 
 * Requirements: 12.5, 12.6, 12.7, 12.8, 12.9, 12.10
 */

'use client';

import { gsap } from 'gsap';
import type { 
  AnimationPlugin, 
  AnimationDefinition, 
  CustomAnimationOptions,
  AnimationDebugInfo 
} from './custom-animations';
import { 
  getAnimationDebugInfo,
  getAvailableAnimations,
  getAvailablePlugins,
  executeCustomAnimation,
  composeCustomAnimations 
} from './custom-animations';

// Animation Development Tool Types
export interface AnimationPreviewOptions {
  target: Element | Element[];
  animationName: string;
  options?: CustomAnimationOptions;
  loop?: boolean;
  speed?: number;
  showBounds?: boolean;
  showTimeline?: boolean;
}

export interface AnimationPerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage?: number;
  animationCount: number;
  activeTimelines: number;
  droppedFrames: number;
  averageExecutionTime: number;
  peakMemoryUsage?: number;
  recommendations: string[];
}

export interface AnimationConflictInfo {
  conflictingAnimations: string[];
  priority: number;
  resolution: 'override' | 'queue' | 'compose' | 'cancel';
  affectedElements: Element[];
  timestamp: number;
}

export interface AnimationTestResult {
  animationName: string;
  success: boolean;
  duration: number;
  errors: string[];
  warnings: string[];
  performance: {
    executionTime: number;
    memoryDelta?: number;
    frameRate: number;
  };
  coverage: {
    variants: string[];
    intensities: string[];
    directions: string[];
  };
}

export interface AnimationDebugSession {
  id: string;
  startTime: number;
  animations: AnimationExecutionLog[];
  performance: AnimationPerformanceMetrics[];
  conflicts: AnimationConflictInfo[];
  isActive: boolean;
}

export interface AnimationExecutionLog {
  id: string;
  animationName: string;
  target: string;
  options: CustomAnimationOptions;
  startTime: number;
  endTime?: number;
  duration: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  performance: {
    executionTime: number;
    frameRate: number;
    memoryUsage?: number;
  };
}

// Animation Preview System
class AnimationPreviewSystem {
  private previewContainer: HTMLElement | null = null;
  private currentPreview: GSAPTimeline | null = null;
  private previewBounds: HTMLElement | null = null;
  private timelineVisualizer: HTMLElement | null = null;

  createPreviewContainer(): HTMLElement {
    if (typeof window === 'undefined') {
      throw new Error('Preview container can only be created in browser environment');
    }
    
    if (this.previewContainer) {
      return this.previewContainer;
    }

    this.previewContainer = document.createElement('div');
    this.previewContainer.id = 'animation-preview-container';
    this.previewContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 400px;
      height: 300px;
      background: rgba(0, 0, 0, 0.9);
      border: 1px solid #333;
      border-radius: 8px;
      z-index: 10000;
      padding: 16px;
      color: white;
      font-family: monospace;
      font-size: 12px;
      overflow: hidden;
      backdrop-filter: blur(10px);
    `;

    document.body.appendChild(this.previewContainer);
    return this.previewContainer;
  }

  async previewAnimation(options: AnimationPreviewOptions): Promise<void> {
    const container = this.createPreviewContainer();
    
    // Clear previous preview
    if (this.currentPreview) {
      this.currentPreview.kill();
    }

    // Create preview target clone
    const originalTarget = Array.isArray(options.target) ? options.target[0] : options.target;
    const previewTarget = document.createElement('div');
    previewTarget.innerHTML = originalTarget.outerHTML;
    const clonedElement = previewTarget.firstElementChild as HTMLElement;
    if (clonedElement) {
      clonedElement.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        max-width: 200px;
        max-height: 150px;
        pointer-events: none;
      `;
    }

    // Clear container and add preview target
    container.innerHTML = '';
    if (clonedElement) {
      container.appendChild(clonedElement);
    }

    // Add preview controls
    const controls = this.createPreviewControls(options);
    container.appendChild(controls);

    // Show bounds if requested
    if (options.showBounds && clonedElement) {
      this.showAnimationBounds(clonedElement);
    }

    // Show timeline if requested
    if (options.showTimeline) {
      this.showTimelineVisualizer(container);
    }

    // Execute animation
    try {
      const timeline = clonedElement ? executeCustomAnimation(
        options.animationName,
        clonedElement,
        options.options
      ) : null;

      if (timeline) {
        this.currentPreview = timeline;
        
        // Adjust speed if specified
        if (options.speed && options.speed !== 1) {
          timeline.timeScale(options.speed);
        }

        // Loop if requested
        if (options.loop) {
          timeline.repeat(-1);
        }

        // Update timeline visualizer
        if (options.showTimeline && this.timelineVisualizer) {
          this.updateTimelineVisualizer(timeline);
        }
      }
    } catch (error) {
      this.showPreviewError(container, error as Error);
    }
  }

  private createPreviewControls(options: AnimationPreviewOptions): HTMLElement {
    const controls = document.createElement('div');
    controls.style.cssText = `
      position: absolute;
      bottom: 8px;
      left: 8px;
      right: 8px;
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    // Play/Pause button
    const playPauseBtn = document.createElement('button');
    playPauseBtn.textContent = '⏸️';
    playPauseBtn.style.cssText = 'background: #333; border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer;';
    playPauseBtn.onclick = () => {
      if (this.currentPreview) {
        if (this.currentPreview.isActive()) {
          this.currentPreview.pause();
          playPauseBtn.textContent = '▶️';
        } else {
          this.currentPreview.resume();
          playPauseBtn.textContent = '⏸️';
        }
      }
    };

    // Restart button
    const restartBtn = document.createElement('button');
    restartBtn.textContent = '🔄';
    restartBtn.style.cssText = 'background: #333; border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer;';
    restartBtn.onclick = () => {
      if (this.currentPreview) {
        this.currentPreview.restart();
      }
    };

    // Speed control
    const speedLabel = document.createElement('span');
    speedLabel.textContent = 'Speed:';
    speedLabel.style.fontSize = '10px';

    const speedSlider = document.createElement('input');
    speedSlider.type = 'range';
    speedSlider.min = '0.1';
    speedSlider.max = '3';
    speedSlider.step = '0.1';
    speedSlider.value = (options.speed || 1).toString();
    speedSlider.style.cssText = 'width: 60px;';
    speedSlider.oninput = () => {
      if (this.currentPreview) {
        this.currentPreview.timeScale(parseFloat(speedSlider.value));
      }
    };

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '❌';
    closeBtn.style.cssText = 'background: #333; border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; margin-left: auto;';
    closeBtn.onclick = () => this.closePreview();

    controls.appendChild(playPauseBtn);
    controls.appendChild(restartBtn);
    controls.appendChild(speedLabel);
    controls.appendChild(speedSlider);
    controls.appendChild(closeBtn);

    return controls;
  }

  private showAnimationBounds(target: HTMLElement): void {
    if (this.previewBounds) {
      this.previewBounds.remove();
    }

    this.previewBounds = document.createElement('div');
    this.previewBounds.style.cssText = `
      position: absolute;
      border: 2px dashed #ff6b6b;
      pointer-events: none;
      z-index: 1;
    `;

    const rect = target.getBoundingClientRect();
    const containerRect = this.previewContainer!.getBoundingClientRect();
    
    this.previewBounds.style.left = `${rect.left - containerRect.left - 2}px`;
    this.previewBounds.style.top = `${rect.top - containerRect.top - 2}px`;
    this.previewBounds.style.width = `${rect.width + 4}px`;
    this.previewBounds.style.height = `${rect.height + 4}px`;

    this.previewContainer!.appendChild(this.previewBounds);
  }

  private showTimelineVisualizer(container: HTMLElement): void {
    if (this.timelineVisualizer) {
      this.timelineVisualizer.remove();
    }

    this.timelineVisualizer = document.createElement('div');
    this.timelineVisualizer.style.cssText = `
      position: absolute;
      top: 8px;
      left: 8px;
      right: 8px;
      height: 40px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      padding: 4px;
    `;

    container.appendChild(this.timelineVisualizer);
  }

  private updateTimelineVisualizer(timeline: GSAPTimeline): void {
    if (!this.timelineVisualizer) return;

    const duration = timeline.duration();
    const progress = timeline.progress();

    this.timelineVisualizer.innerHTML = `
      <div style="font-size: 10px; margin-bottom: 4px;">
        Duration: ${duration.toFixed(2)}s | Progress: ${(progress * 100).toFixed(1)}%
      </div>
      <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; position: relative;">
        <div style="width: ${progress * 100}%; height: 100%; background: #4ade80; border-radius: 4px; transition: width 0.1s;"></div>
      </div>
    `;

    // Update progress in real-time
    const updateProgress = () => {
      if (timeline.isActive() && this.timelineVisualizer) {
        const currentProgress = timeline.progress();
        const progressBar = this.timelineVisualizer.querySelector('div:last-child > div') as HTMLElement;
        if (progressBar) {
          progressBar.style.width = `${currentProgress * 100}%`;
        }
        requestAnimationFrame(updateProgress);
      }
    };
    requestAnimationFrame(updateProgress);
  }

  private showPreviewError(container: HTMLElement, error: Error): void {
    container.innerHTML = `
      <div style="color: #ff6b6b; padding: 16px; text-align: center;">
        <div style="font-size: 14px; margin-bottom: 8px;">❌ Preview Error</div>
        <div style="font-size: 10px; opacity: 0.8;">${error.message}</div>
        <button onclick="this.parentElement.parentElement.remove()" 
                style="background: #333; border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; margin-top: 8px;">
          Close
        </button>
      </div>
    `;
  }

  closePreview(): void {
    if (this.currentPreview) {
      this.currentPreview.kill();
      this.currentPreview = null;
    }

    if (this.previewContainer) {
      this.previewContainer.remove();
      this.previewContainer = null;
    }

    if (this.previewBounds) {
      this.previewBounds.remove();
      this.previewBounds = null;
    }

    if (this.timelineVisualizer) {
      this.timelineVisualizer.remove();
      this.timelineVisualizer = null;
    }
  }
}

// Performance Monitoring System
class AnimationPerformanceMonitor {
  private metrics: AnimationPerformanceMetrics[] = [];
  private isMonitoring = false;
  private frameCount = 0;
  private lastFrameTime = 0;
  private droppedFrames = 0;
  private executionTimes: number[] = [];
  private memoryBaseline?: number;
  private peakMemory?: number;

  startMonitoring(): void {
    if (typeof window === 'undefined' || typeof performance === 'undefined') {
      console.warn('Performance monitoring not available in server environment');
      return;
    }
    
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.droppedFrames = 0;
    this.executionTimes = [];

    // Set memory baseline
    if ('memory' in performance) {
      this.memoryBaseline = (performance as any).memory.usedJSHeapSize;
      this.peakMemory = this.memoryBaseline;
    }

    this.monitorFrame();
  }

  stopMonitoring(): AnimationPerformanceMetrics {
    this.isMonitoring = false;
    
    const currentTime = performance.now();
    const totalTime = currentTime - this.lastFrameTime;
    const fps = Math.round((this.frameCount * 1000) / totalTime);
    const averageFrameTime = totalTime / this.frameCount;
    
    const averageExecutionTime = this.executionTimes.length > 0
      ? this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length
      : 0;

    let memoryUsage: number | undefined;
    let peakMemoryUsage: number | undefined;
    
    if ('memory' in performance && this.memoryBaseline) {
      memoryUsage = (performance as any).memory.usedJSHeapSize - this.memoryBaseline;
      peakMemoryUsage = this.peakMemory;
    }

    const metrics: AnimationPerformanceMetrics = {
      fps,
      frameTime: averageFrameTime,
      memoryUsage,
      animationCount: this.executionTimes.length,
      activeTimelines: this.getActiveTimelineCount(),
      droppedFrames: this.droppedFrames,
      averageExecutionTime,
      peakMemoryUsage,
      recommendations: this.generateRecommendations(fps, averageExecutionTime, memoryUsage),
    };

    this.metrics.push(metrics);
    return metrics;
  }

  private monitorFrame(): void {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    const frameTime = currentTime - this.lastFrameTime;
    
    // Detect dropped frames (assuming 60fps target)
    if (frameTime > 16.67 * 1.5) {
      this.droppedFrames++;
    }

    // Track peak memory usage
    if ('memory' in performance) {
      const currentMemory = (performance as any).memory.usedJSHeapSize;
      if (!this.peakMemory || currentMemory > this.peakMemory) {
        this.peakMemory = currentMemory;
      }
    }

    this.frameCount++;
    this.lastFrameTime = currentTime;

    requestAnimationFrame(() => this.monitorFrame());
  }

  recordAnimationExecution(duration: number): void {
    this.executionTimes.push(duration);
  }

  private getActiveTimelineCount(): number {
    // Count active GSAP timelines
    return gsap.globalTimeline.getChildren().length;
  }

  private generateRecommendations(
    fps: number, 
    avgExecutionTime: number, 
    memoryUsage?: number
  ): string[] {
    const recommendations: string[] = [];

    if (fps < 30) {
      recommendations.push('Low FPS detected. Consider reducing animation complexity or using simpler easing functions.');
    }

    if (fps < 45) {
      recommendations.push('Consider enabling hardware acceleration with force3D: true on animated elements.');
    }

    if (avgExecutionTime > 16) {
      recommendations.push('Animation execution time is high. Consider breaking complex animations into smaller chunks.');
    }

    if (memoryUsage && memoryUsage > 10 * 1024 * 1024) { // 10MB
      recommendations.push('High memory usage detected. Ensure animations are properly cleaned up after completion.');
    }

    if (this.frameCount > 0 && this.droppedFrames > this.frameCount * 0.1) {
      recommendations.push('Frequent frame drops detected. Consider reducing concurrent animations or using animation queuing.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Animation performance is optimal.');
    }

    return recommendations;
  }

  getMetricsHistory(): AnimationPerformanceMetrics[] {
    return [...this.metrics];
  }

  clearMetrics(): void {
    this.metrics = [];
  }
}

// Animation Conflict Management System
class AnimationConflictManager {
  private activeAnimations: Map<Element, AnimationExecutionLog[]> = new Map();
  private conflictResolutions: Map<string, AnimationConflictInfo> = new Map();
  private priorityLevels: Map<string, number> = new Map();

  registerAnimation(
    element: Element,
    animationName: string,
    options: CustomAnimationOptions,
    timeline: GSAPTimeline
  ): string {
    const id = `${animationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const log: AnimationExecutionLog = {
      id,
      animationName,
      target: this.getElementSelector(element),
      options,
      startTime: performance.now(),
      duration: timeline.duration(),
      status: 'running',
      performance: {
        executionTime: 0,
        frameRate: 60,
      },
    };

    // Check for conflicts
    const conflicts = this.detectConflicts(element, animationName, options);
    if (conflicts.length > 0) {
      this.resolveConflicts(element, id, conflicts);
    }

    // Register animation
    if (!this.activeAnimations.has(element)) {
      this.activeAnimations.set(element, []);
    }
    this.activeAnimations.get(element)!.push(log);

    // Set up completion callback
    timeline.eventCallback('onComplete', () => {
      this.completeAnimation(element, id);
    });

    return id;
  }

  private detectConflicts(
    element: Element,
    animationName: string,
    options: CustomAnimationOptions
  ): string[] {
    const activeAnimations = this.activeAnimations.get(element) || [];
    const conflicts: string[] = [];

    for (const animation of activeAnimations) {
      if (animation.status === 'running') {
        // Check for property conflicts
        if (this.hasPropertyConflict(animation.animationName, animationName)) {
          conflicts.push(animation.id);
        }
      }
    }

    return conflicts;
  }

  private hasPropertyConflict(animation1: string, animation2: string): boolean {
    // Define which animations conflict with each other
    const conflictMap: Record<string, string[]> = {
      'ipad-grid-select': ['ipad-grid-reset', 'slide-transition'],
      'slide-transition': ['ipad-grid-select', 'fade-scale'],
      'particle-burst': [], // Can compose with others
      'ripple-effect': [], // Can compose with others
      'glow-pulse': [], // Can compose with others
    };

    return conflictMap[animation1]?.includes(animation2) || false;
  }

  private resolveConflicts(
    element: Element,
    newAnimationId: string,
    conflictingIds: string[]
  ): void {
    const activeAnimations = this.activeAnimations.get(element) || [];
    const newAnimation = activeAnimations.find(a => a.id === newAnimationId);
    
    if (!newAnimation) return;

    const newPriority = this.getAnimationPriority(newAnimation.animationName, newAnimation.options);
    
    for (const conflictId of conflictingIds) {
      const conflictingAnimation = activeAnimations.find(a => a.id === conflictId);
      if (!conflictingAnimation) continue;

      const conflictPriority = this.getAnimationPriority(
        conflictingAnimation.animationName,
        conflictingAnimation.options
      );

      let resolution: AnimationConflictInfo['resolution'];

      if (newPriority > conflictPriority) {
        resolution = 'override';
        this.cancelAnimation(element, conflictId);
      } else if (newPriority < conflictPriority) {
        resolution = 'cancel';
        this.cancelAnimation(element, newAnimationId);
      } else {
        // Same priority - check if they can compose
        if (this.canCompose(newAnimation.animationName, conflictingAnimation.animationName)) {
          resolution = 'compose';
        } else {
          resolution = 'queue';
          // Queue the new animation to start after the current one
        }
      }

      const conflictInfo: AnimationConflictInfo = {
        conflictingAnimations: [newAnimation.animationName, conflictingAnimation.animationName],
        priority: Math.max(newPriority, conflictPriority),
        resolution,
        affectedElements: [element],
        timestamp: performance.now(),
      };

      this.conflictResolutions.set(`${newAnimationId}-${conflictId}`, conflictInfo);
    }
  }

  private getAnimationPriority(animationName: string, options: CustomAnimationOptions): number {
    // Check for explicit priority in options
    if (options.priority !== undefined) {
      return typeof options.priority === 'number' ? options.priority : 
             options.priority === 'high' ? 100 : 
             options.priority === 'override' ? 1000 : 50;
    }

    // Default priorities for built-in animations
    const defaultPriorities: Record<string, number> = {
      'ipad-grid-select': 80,
      'ipad-grid-reset': 70,
      'slide-transition': 60,
      'fade-scale': 50,
      'particle-burst': 30,
      'ripple-effect': 30,
      'glow-pulse': 20,
    };

    return defaultPriorities[animationName] || 50;
  }

  private canCompose(animation1: string, animation2: string): boolean {
    // Define which animations can be composed together
    const composableAnimations = [
      'particle-burst',
      'ripple-effect',
      'glow-pulse',
    ];

    return composableAnimations.includes(animation1) && composableAnimations.includes(animation2);
  }

  private cancelAnimation(element: Element, animationId: string): void {
    const activeAnimations = this.activeAnimations.get(element) || [];
    const animation = activeAnimations.find(a => a.id === animationId);
    
    if (animation) {
      animation.status = 'cancelled';
      animation.endTime = performance.now();
      
      // Kill the actual GSAP timeline
      // Note: In a real implementation, we'd need to track the timeline reference
      gsap.killTweensOf(element);
    }
  }

  private completeAnimation(element: Element, animationId: string): void {
    const activeAnimations = this.activeAnimations.get(element) || [];
    const animation = activeAnimations.find(a => a.id === animationId);
    
    if (animation) {
      animation.status = 'completed';
      animation.endTime = performance.now();
      animation.performance.executionTime = animation.endTime - animation.startTime;
    }
  }

  private getElementSelector(element: Element): string {
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    return element.tagName.toLowerCase();
  }

  getConflictHistory(): AnimationConflictInfo[] {
    return Array.from(this.conflictResolutions.values());
  }

  getActiveAnimations(): Map<Element, AnimationExecutionLog[]> {
    return new Map(this.activeAnimations);
  }

  clearHistory(): void {
    this.conflictResolutions.clear();
    this.activeAnimations.clear();
  }
}

// Animation Testing System
class AnimationTestRunner {
  private testResults: AnimationTestResult[] = [];

  async runAnimationTest(
    animationName: string,
    testElement: Element,
    testOptions: Partial<CustomAnimationOptions> = {}
  ): Promise<AnimationTestResult> {
    if (typeof window === 'undefined' || typeof performance === 'undefined') {
      throw new Error('Animation testing not available in server environment');
    }
    
    const startTime = performance.now();
    const memoryBefore = 'memory' in performance ? (performance as any).memory.usedJSHeapSize : undefined;
    
    const result: AnimationTestResult = {
      animationName,
      success: false,
      duration: 0,
      errors: [],
      warnings: [],
      performance: {
        executionTime: 0,
        frameRate: 60,
      },
      coverage: {
        variants: [],
        intensities: [],
        directions: [],
      },
    };

    try {
      // Test basic execution
      const timeline = executeCustomAnimation(animationName, testElement, testOptions);
      
      if (!timeline) {
        result.errors.push('Animation execution returned null');
        return result;
      }

      result.duration = timeline.duration();
      
      // Test different variants if available
      const variants = ['subtle', 'dramatic', 'directional'];
      for (const variant of variants) {
        try {
          const variantTimeline = executeCustomAnimation(animationName, testElement, {
            ...testOptions,
            variant,
          });
          if (variantTimeline) {
            result.coverage.variants.push(variant);
          }
        } catch (error) {
          result.warnings.push(`Variant '${variant}' failed: ${(error as Error).message}`);
        }
      }

      // Test different intensities
      const intensities: Array<'subtle' | 'medium' | 'strong'> = ['subtle', 'medium', 'strong'];
      for (const intensity of intensities) {
        try {
          const intensityTimeline = executeCustomAnimation(animationName, testElement, {
            ...testOptions,
            intensity,
          });
          if (intensityTimeline) {
            result.coverage.intensities.push(intensity);
          }
        } catch (error) {
          result.warnings.push(`Intensity '${intensity}' failed: ${(error as Error).message}`);
        }
      }

      // Test different directions
      const directions = ['up', 'down', 'left', 'right', 'center', 'random'];
      for (const direction of directions) {
        try {
          const directionTimeline = executeCustomAnimation(animationName, testElement, {
            ...testOptions,
            direction: direction as any,
          });
          if (directionTimeline) {
            result.coverage.directions.push(direction);
          }
        } catch (error) {
          result.warnings.push(`Direction '${direction}' failed: ${(error as Error).message}`);
        }
      }

      result.success = true;
      
    } catch (error) {
      result.errors.push((error as Error).message);
    }

    // Calculate performance metrics
    const endTime = performance.now();
    result.performance.executionTime = endTime - startTime;
    
    if (memoryBefore && 'memory' in performance) {
      const memoryAfter = (performance as any).memory.usedJSHeapSize;
      result.performance.memoryDelta = memoryAfter - memoryBefore;
    }

    this.testResults.push(result);
    return result;
  }

  async runFullTestSuite(): Promise<AnimationTestResult[]> {
    if (typeof window === 'undefined') {
      console.warn('Test suite not available in server environment');
      return [];
    }
    
    const animations = getAvailableAnimations();
    const testElement = document.createElement('div');
    testElement.style.cssText = 'width: 100px; height: 100px; background: red; position: absolute; top: -1000px;';
    document.body.appendChild(testElement);

    const results: AnimationTestResult[] = [];

    for (const animationName of animations) {
      try {
        const result = await this.runAnimationTest(animationName, testElement);
        results.push(result);
      } catch (error) {
        results.push({
          animationName,
          success: false,
          duration: 0,
          errors: [(error as Error).message],
          warnings: [],
          performance: {
            executionTime: 0,
            frameRate: 0,
          },
          coverage: {
            variants: [],
            intensities: [],
            directions: [],
          },
        });
      }
    }

    document.body.removeChild(testElement);
    return results;
  }

  getTestResults(): AnimationTestResult[] {
    return [...this.testResults];
  }

  clearTestResults(): void {
    this.testResults = [];
  }

  generateTestReport(): string {
    const results = this.testResults;
    const totalTests = results.length;
    const passedTests = results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    let report = `Animation Test Report\n`;
    report += `=====================\n\n`;
    report += `Total Tests: ${totalTests}\n`;
    report += `Passed: ${passedTests}\n`;
    report += `Failed: ${failedTests}\n`;
    report += `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n\n`;

    if (failedTests > 0) {
      report += `Failed Tests:\n`;
      report += `-------------\n`;
      results.filter(r => !r.success).forEach(result => {
        report += `${result.animationName}: ${result.errors.join(', ')}\n`;
      });
      report += `\n`;
    }

    report += `Performance Summary:\n`;
    report += `-------------------\n`;
    const avgExecutionTime = results.reduce((sum, r) => sum + r.performance.executionTime, 0) / totalTests;
    report += `Average Execution Time: ${avgExecutionTime.toFixed(2)}ms\n`;

    return report;
  }
}

// Debug Session Management
class AnimationDebugSessionManager {
  private sessions: Map<string, AnimationDebugSession> = new Map();
  private activeSession: AnimationDebugSession | null = null;

  startDebugSession(sessionName?: string): string {
    if (typeof window === 'undefined' || typeof performance === 'undefined') {
      console.warn('Debug sessions not available in server environment');
      return 'server-session';
    }
    
    const sessionId = sessionName || `session-${Date.now()}`;
    
    const session: AnimationDebugSession = {
      id: sessionId,
      startTime: performance.now(),
      animations: [],
      performance: [],
      conflicts: [],
      isActive: true,
    };

    this.sessions.set(sessionId, session);
    this.activeSession = session;

    return sessionId;
  }

  endDebugSession(sessionId?: string): AnimationDebugSession | null {
    const session = sessionId ? this.sessions.get(sessionId) : this.activeSession;
    
    if (session) {
      session.isActive = false;
      if (this.activeSession === session) {
        this.activeSession = null;
      }
    }

    return session;
  }

  logAnimation(log: AnimationExecutionLog): void {
    if (this.activeSession) {
      this.activeSession.animations.push(log);
    }
  }

  logPerformance(metrics: AnimationPerformanceMetrics): void {
    if (this.activeSession) {
      this.activeSession.performance.push(metrics);
    }
  }

  logConflict(conflict: AnimationConflictInfo): void {
    if (this.activeSession) {
      this.activeSession.conflicts.push(conflict);
    }
  }

  getSession(sessionId: string): AnimationDebugSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): AnimationDebugSession[] {
    return Array.from(this.sessions.values());
  }

  exportSession(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return JSON.stringify(session, null, 2);
  }

  clearSessions(): void {
    this.sessions.clear();
    this.activeSession = null;
  }
}

// Global instances
const animationPreviewSystem = new AnimationPreviewSystem();
const performanceMonitor = new AnimationPerformanceMonitor();
const conflictManager = new AnimationConflictManager();
const testRunner = new AnimationTestRunner();
const debugSessionManager = new AnimationDebugSessionManager();

// Public API
export const AnimationDevTools = {
  // Preview System
  previewAnimation: (options: AnimationPreviewOptions) => 
    animationPreviewSystem.previewAnimation(options),
  closePreview: () => animationPreviewSystem.closePreview(),

  // Performance Monitoring
  startPerformanceMonitoring: () => performanceMonitor.startMonitoring(),
  stopPerformanceMonitoring: () => performanceMonitor.stopMonitoring(),
  getPerformanceHistory: () => performanceMonitor.getMetricsHistory(),
  clearPerformanceMetrics: () => performanceMonitor.clearMetrics(),

  // Conflict Management
  getConflictHistory: () => conflictManager.getConflictHistory(),
  getActiveAnimations: () => conflictManager.getActiveAnimations(),
  clearConflictHistory: () => conflictManager.clearHistory(),

  // Testing System
  testAnimation: (animationName: string, testElement: Element, options?: Partial<CustomAnimationOptions>) =>
    testRunner.runAnimationTest(animationName, testElement, options),
  runFullTestSuite: () => testRunner.runFullTestSuite(),
  getTestResults: () => testRunner.getTestResults(),
  generateTestReport: () => testRunner.generateTestReport(),
  clearTestResults: () => testRunner.clearTestResults(),

  // Debug Sessions
  startDebugSession: (sessionName?: string) => debugSessionManager.startDebugSession(sessionName),
  endDebugSession: (sessionId?: string) => debugSessionManager.endDebugSession(sessionId),
  getDebugSession: (sessionId: string) => debugSessionManager.getSession(sessionId),
  getAllDebugSessions: () => debugSessionManager.getAllSessions(),
  exportDebugSession: (sessionId: string) => debugSessionManager.exportSession(sessionId),
  clearDebugSessions: () => debugSessionManager.clearSessions(),

  // Utility Functions
  getSystemInfo: () => {
    if (typeof window === 'undefined') {
      return {
        performance: { registeredCount: 0, executionCount: 0, errorCount: 0 },
        availableAnimations: [],
        availablePlugins: [],
        browserSupport: {
          gsap: false,
          performance: false,
          memory: false,
          requestAnimationFrame: false,
        },
      };
    }
    
    return {
      ...getAnimationDebugInfo(),
      availableAnimations: getAvailableAnimations(),
      availablePlugins: getAvailablePlugins(),
      browserSupport: {
        gsap: typeof gsap !== 'undefined',
        performance: typeof window !== 'undefined' && 'performance' in window,
        memory: typeof window !== 'undefined' && typeof performance !== 'undefined' && 'memory' in performance,
        requestAnimationFrame: typeof window !== 'undefined' && 'requestAnimationFrame' in window,
      },
    };
  },
};

// Initialize development tools in development mode
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (globalThis as any).__uiAnimationDevTools = AnimationDevTools;
  console.log('Animation Development Tools initialized');
}

// Types are already exported as interfaces above

export default AnimationDevTools;