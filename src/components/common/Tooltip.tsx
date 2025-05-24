import React, { useState, useRef, useEffect, useCallback } from 'react';

interface TooltipProps {
  content: React.ReactNode; // The content to display inside the tooltip
  children?: React.ReactNode; // The element that triggers the tooltip (e.g., an info icon)
  position?: 'top' | 'bottom' | 'left' | 'right'; // Position of the tooltip relative to the trigger
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const showTooltip = () => setIsVisible(true);
  const hideTooltip = () => setIsVisible(false);

  // Handle click for mobile devices to toggle visibility
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from propagating to parent elements
    setIsVisible(prev => !prev);
  };

  const adjustTooltipPosition = useCallback(() => {
    if (!isVisible || !tooltipRef.current || !triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipElement = tooltipRef.current;

    // Temporarily reset styles to get natural dimensions without previous positioning affecting them
    tooltipElement.style.left = '';
    tooltipElement.style.top = '';
    tooltipElement.style.right = '';
    tooltipElement.style.bottom = '';
    tooltipElement.style.transform = '';

    // Get tooltip's current dimensions (after reset)
    const tooltipRect = tooltipElement.getBoundingClientRect();

    const padding = 10; // Padding from viewport edges

    let finalLeft = 0;
    let finalTop = 0;
    const offsetFromTrigger = 8; // Distance from the trigger element

    switch (position) {
      case 'top':
        finalTop = triggerRect.top - tooltipRect.height - offsetFromTrigger;
        finalLeft = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        finalTop = triggerRect.bottom + offsetFromTrigger;
        finalLeft = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        finalLeft = triggerRect.left - tooltipRect.width - offsetFromTrigger;
        finalTop = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        break;
      case 'right':
        finalLeft = triggerRect.right + offsetFromTrigger;
        finalTop = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        break;
    }

    // Horizontal adjustment to keep within viewport
    if (finalLeft < padding) {
      finalLeft = padding;
    } else if (finalLeft + tooltipRect.width > window.innerWidth - padding) {
      finalLeft = window.innerWidth - tooltipRect.width - padding;
    }

    // Vertical adjustment to keep within viewport
    if (finalTop < padding) {
      finalTop = padding;
    } else if (finalTop + tooltipRect.height > window.innerHeight - padding) {
      finalTop = window.innerHeight - tooltipRect.height - padding;
    }

    // Apply adjusted positions directly
    tooltipElement.style.left = `${finalLeft}px`;
    tooltipElement.style.top = `${finalTop}px`;
    tooltipElement.style.transform = 'none'; // No transform needed after direct positioning
  }, [isVisible, position]);

  // Effect for dynamic positioning on visibility, resize, and scroll
  useEffect(() => {
    if (isVisible) {
      // Use a small timeout to allow the tooltip to render in the DOM before measuring
      const timeoutId = setTimeout(() => {
        adjustTooltipPosition();
      }, 0); // Run immediately after current render cycle

      window.addEventListener('resize', adjustTooltipPosition);
      // Listen to scroll events on the window and in the capture phase for elements that might prevent bubbling
      window.addEventListener('scroll', adjustTooltipPosition, true); 
      
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', adjustTooltipPosition);
        window.removeEventListener('scroll', adjustTooltipPosition, true);
      };
    }
  }, [isVisible, adjustTooltipPosition]);

  // Hide tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        hideTooltip();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible]);

  // Initial styles for the tooltip container. These are base styles that will be
  // overridden by the `adjustTooltipPosition` function when the tooltip becomes visible.
  const initialTooltipStyles: React.CSSProperties = {
    position: 'fixed', // Changed to 'fixed' for viewport-relative positioning
    zIndex: 1000,
    padding: '8px 12px',
    borderRadius: '6px',
    backgroundColor: 'var(--color-tooltip-bg)',
    color: 'var(--color-tooltip-text)',
    fontSize: '0.8rem',
    maxWidth: '350px', // Increased max-width to allow more content
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    pointerEvents: 'none', // Allow clicks to pass through when not hovered
    opacity: 0,
    transition: 'opacity 0.2s ease-in-out',
  };

  if (isVisible) {
    initialTooltipStyles.opacity = 1;
    initialTooltipStyles.pointerEvents = 'auto';
  }

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center justify-center cursor-pointer"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onClick={handleClick}
      style={{ verticalAlign: 'middle' }} // Align with text
    >
      {children || (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-4 h-4 text-[var(--color-tooltip-icon)]" // Use CSS variable for theme
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
      )}
      {isVisible && (
        <div ref={tooltipRef} style={initialTooltipStyles}>
          {content}
        </div>
      )}
    </span>
  );
};

export default Tooltip;
