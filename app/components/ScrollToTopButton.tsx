'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';

interface ScrollToTopButtonProps {
  /**
   * Scroll threshold in pixels before button appears
   * @default 350
   */
  threshold?: number;
  /**
   * Language for accessibility labels
   */
  lng?: 'en' | 'he';
  /**
   * Optional className for custom styling
   */
  className?: string;
}

export default function ScrollToTopButton({
  threshold = 350,
  lng = 'en',
  className,
}: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for prefers-reduced-motion on mount
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Throttled scroll handler
  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    setIsVisible(scrollY > threshold);
  }, [threshold]);

  // Set up scroll listener with throttling
  useEffect(() => {
    // Initial check
    handleScroll();

    // Throttle function
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    // Use passive listener for better performance
    window.addEventListener('scroll', throttledHandleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
    };
  }, [handleScroll]);

  // Smooth scroll to top
  const scrollToTop = useCallback(() => {
    if (prefersReducedMotion) {
      // Instant scroll for users who prefer reduced motion
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      // Smooth scroll for others
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [prefersReducedMotion]);

  const tooltipText = lng === 'he' ? 'חזרה למעלה' : 'Back to top';

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 md:bottom-6 md:right-6 z-40 transition-opacity duration-300',
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        className
      )}
      aria-hidden={!isVisible}
    >
      <Button
        onClick={scrollToTop}
        size="icon"
        variant="outline"
        className={cn(
          'h-12 w-12 md:h-14 md:w-14 rounded-full shadow-lg',
          'bg-[#856D55]/90 hover:bg-[#856D55] border-[#856D55]/90',
          'hover:scale-110 active:scale-95',
          'transition-transform duration-200',
          'focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2'
        )}
        title={tooltipText}
        aria-label={tooltipText}
      >
        <ArrowUp className="h-5 w-5 md:h-6 md:w-6 text-white" />
      </Button>
    </div>
  );
}

