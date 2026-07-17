import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
  dark?: boolean;
}

export default function AAPICOSmartEvalLogo({ size = 48, className = "", dark = false }: LogoProps) {
  // Colors based on specification
  const strokeColor = dark ? "#FFFFFF" : "#1D366D";
  const ecogreenColor = "#2DC84D";
  
  return (
    <div 
      className={`relative inline-block select-none ${className}`}
      style={{ 
        width: size, 
        height: size 
      }}
    >
      {/* Modern self-contained SVG logo with Material 3 squircle and curved vector details */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full transition-transform duration-300 hover:scale-105"
      >
        {/* Material 3 Rounded Squircle Frame (rx="12" for elegant round corners instead of 90-degree sharp) */}
        <rect 
          x="2" 
          y="2" 
          width="44" 
          height="44" 
          rx="12"
          fill={dark ? "#1D366D" : "#FFFFFF"} 
          stroke={strokeColor} 
          strokeWidth="3"
        />

        {/* Sophisticated tech grid background dots with subtle opacity */}
        <circle cx="10" cy="10" r="1.5" fill={strokeColor} fillOpacity="0.15" />
        <circle cx="18" cy="10" r="1.5" fill={strokeColor} fillOpacity="0.15" />
        <circle cx="26" cy="10" r="1.5" fill={strokeColor} fillOpacity="0.15" />
        <circle cx="34" cy="10" r="1.5" fill={strokeColor} fillOpacity="0.15" />
        <circle cx="38" cy="18" r="1.5" fill={strokeColor} fillOpacity="0.15" />
        <circle cx="38" cy="26" r="1.5" fill={strokeColor} fillOpacity="0.15" />
        <circle cx="38" cy="34" r="1.5" fill={strokeColor} fillOpacity="0.15" />

        {/* Rounded Automotive Gauge Bars (represented as smooth Material pills with rx="2") */}
        {/* Low Bar */}
        <rect 
          x="10" 
          y="28" 
          width="4" 
          height="10" 
          rx="2"
          fill={strokeColor} 
          fillOpacity="0.25"
        />
        {/* Medium Bar */}
        <rect 
          x="18" 
          y="20" 
          width="4" 
          height="18" 
          rx="2"
          fill={strokeColor} 
          fillOpacity="0.5"
        />
        {/* High Bar */}
        <rect 
          x="26" 
          y="12" 
          width="4" 
          height="26" 
          rx="2"
          fill={strokeColor} 
          fillOpacity="0.75"
        />

        {/* Rounded, smooth Checkmark (เครื่องหมายถูก) to reflect high-quality digital evaluation */}
        <path 
          d="M13 23L19 29L35 13" 
          stroke={strokeColor} 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
        <path 
          d="M13 23L19 29L35 13" 
          stroke={ecogreenColor} 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />

        {/* Clean Material circular indicator mark */}
        <circle cx="35" cy="34" r="3" fill={strokeColor} />
        <line x1="31" y1="38" x2="39" y2="38" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
