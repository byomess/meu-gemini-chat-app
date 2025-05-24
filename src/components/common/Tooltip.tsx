import React, { useState, useRef, useEffect } from 'react';

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

  // Basic positioning styles
  const getPositionStyles = () => {
    let styles: React.CSSProperties = {
      position: 'absolute',
      zIndex: 1000,
      padding: '8px 12px',
      borderRadius: '6px',
      backgroundColor: 'var(--color-tooltip-bg)', // Use CSS variable for theme
      color: 'var(--color-tooltip-text)', // Use CSS variable for theme
      fontSize: '0.8rem',
      maxWidth: '250px',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      pointerEvents: 'none', // Allow clicks to pass through when not hovered
      opacity: 0,
      transition: 'opacity 0.2s ease-in-out',
    };

    if (isVisible) {
      styles.opacity = 1;
      styles.pointerEvents = 'auto';
    }

    // Adjust position based on prop
    switch (position) {
      case 'top':
        styles.bottom = 'calc(100% + 8px)';
        styles.left = '50%';
        styles.transform = 'translateX(-50%)';
        break;
      case 'bottom':
        styles.top = 'calc(100% + 8px)';
        styles.left = '50%';
        styles.transform = 'translateX(-50%)';
        break;
      case 'left':
        styles.right = 'calc(100% + 8px)';
        styles.top = '50%';
        styles.transform = 'translateY(-50%)';
        break;
      case 'right':
        styles.left = 'calc(100% + 8px)';
        styles.top = '50%';
        styles.transform = 'translateY(-50%)';
        break;
    }
    return styles;
  };

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
        <div ref={tooltipRef} style={getPositionStyles()}>
          {content}
        </div>
      )}
    </span>
  );
};

export default Tooltip;
