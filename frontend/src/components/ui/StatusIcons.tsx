import type { SVGProps } from 'react';

/**
 * Check inside a dashed circle, for "Likely eligible". Drawn to match the
 * lucide icon set (24px grid, 2px stroke), which has no such icon.
 */
export function DashedCircleCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" strokeDasharray="3.5 2.8" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
