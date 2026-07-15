import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
  dark?: boolean;
}

export default function AAPICOSmartEvalLogo({ size = 48, className = "", dark = false }: LogoProps) {
  // Calculate relative sizes for scaling
  const scale = size / 48;
  const shadowOffset = 4 * scale;

  // Colors based on specification
  const strokeColor = dark ? "#FFFFFF" : "#1D366D";
  const ecogreenColor = "#2DC84D";
  const shadowColor = "#464C59";

  return (
    <div 
      className={`relative inline-block select-none ${className}`}
      style={{ 
        width: size + shadowOffset, 
        height: size + shadowOffset 
      }}
    >
      {/* 1. Solid hard shadow behind the logo (no blur) */}
      <div 
        className="absolute bg-current border-3 border-transparent"
        style={{
          width: size,
          height: size,
          left: shadowOffset,
          top: shadowOffset,
          backgroundColor: shadowColor,
          zIndex: 1,
        }}
      />

      {/* 2. Main Logo Container */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute"
        style={{
          left: 0,
          top: 0,
          zIndex: 2,
        }}
      >
        {/* Sharp Outer Frame Box (strictly 90-degree corners, no rounded-none) */}
        <rect 
          x="1.5" 
          y="1.5" 
          width="45" 
          height="45" 
          fill={dark ? "#1D366D" : "#FFFFFF"} 
          stroke={strokeColor} 
          strokeWidth="3"
        />

        {/* High-Tech Automotive Precision Gauge Data Bars (strictly sharp 90-degree rectangles) */}
        {/* Background grid dots for tech texture */}
        <rect x="8" y="8" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />
        <rect x="16" y="8" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />
        <rect x="24" y="8" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />
        <rect x="32" y="8" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />
        <rect x="40" y="8" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />
        
        <rect x="8" y="16" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />
        <rect x="40" y="16" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />

        <rect x="8" y="24" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />
        <rect x="40" y="24" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />

        <rect x="8" y="32" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />
        <rect x="40" y="32" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />

        <rect x="8" y="40" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />
        <rect x="16" y="40" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />
        <rect x="24" y="40" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />
        <rect x="32" y="40" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />
        <rect x="40" y="40" width="4" height="4" fill={strokeColor} fillOpacity="0.1" />

        {/* Automotive Precision Gauge Bars representing Digital Evaluation Status (30% Accent blocks) */}
        {/* Low Bar */}
        <rect 
          x="10" 
          y="28" 
          width="4" 
          height="10" 
          fill={strokeColor} 
          fillOpacity="0.3"
        />
        {/* Medium Bar */}
        <rect 
          x="18" 
          y="20" 
          width="4" 
          height="18" 
          fill={strokeColor} 
          fillOpacity="0.5"
        />
        {/* High Bar */}
        <rect 
          x="26" 
          y="12" 
          width="4" 
          height="26" 
          fill={strokeColor} 
          fillOpacity="0.7"
        />

        {/* Geometric Sharp Checkmark fused with Digital Evaluation pointer (เครื่องหมายถูก) */}
        {/* Fusing sharp checkmark and indicator gauge arrow */}
        <path 
          d="M13 22L19 28L37 10L32 5L19 18L18 17" 
          stroke={strokeColor} 
          strokeWidth="3" 
          strokeLinecap="square" 
          strokeLinejoin="miter"
        />
        <polygon 
          points="13,22 19,28 37,10 33,6 19,20 17,18" 
          fill={ecogreenColor} 
          stroke={strokeColor} 
          strokeWidth="1.5"
        />

        {/* Evaluation Target indicator mark (automotive-style precision pointer) */}
        <polygon 
          points="35,32 41,32 38,26" 
          fill={strokeColor} 
        />
        <rect 
          x="32" 
          y="34" 
          width="8" 
          height="2" 
          fill={strokeColor} 
        />
      </svg>
    </div>
  );
}
