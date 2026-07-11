import React, { useEffect, useRef, useState } from 'react';

export default function AdBanner({ adKey, format, width, height, className = "", isPremium = false }) {
  if (isPremium) return null;
  const containerRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Watch for when the ad network actually mounts the iframe elements
    const observer = new MutationObserver(() => {
      if (containerRef.current && containerRef.current.children.length > 2) {
        setIsLoaded(true);
      }
    });

    observer.observe(containerRef.current, { childList: true });

    // Defer ad load slightly to let the page render instantly
    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';
      
      // Define script that configures ad configurations
      const optionsScript = document.createElement('script');
      optionsScript.type = 'text/javascript';
      optionsScript.innerHTML = `
        window.atOptions = {
          'key' : '${adKey}',
          'format' : 'iframe',
          'height' : ${height},
          'width' : ${width},
          'params' : {}
        };
      `;
      
      // Define script that pulls Adsterra code
      const invokeScript = document.createElement('script');
      invokeScript.type = 'text/javascript';
      invokeScript.async = true;
      invokeScript.defer = true;
      invokeScript.src = `https://www.highperformanceformat.com/${adKey}/invoke.js`;
      
      containerRef.current.appendChild(optionsScript);
      containerRef.current.appendChild(invokeScript);
    }, 300); // 300ms delay

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [adKey, format, width, height]);

  return (
    <div className={`${isLoaded ? 'flex justify-center items-center my-6 min-h-[90px] bg-slate-900/30 rounded-xl border border-slate-850/80 p-4' : 'hidden'} ${className}`}>
      <div ref={containerRef} className="max-w-full overflow-x-auto" />
    </div>
  );
}
