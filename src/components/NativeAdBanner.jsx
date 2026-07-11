import React, { useEffect, useRef, useState } from 'react';

export default function NativeAdBanner({ className = "", isPremium = false }) {
  if (isPremium) return null;
  const containerRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Watch for when the ad network actually mounts children inside our native target container
    const observer = new MutationObserver(() => {
      const targetDiv = document.getElementById('container-7e44a1a59523814678cfb3bc2405137c');
      if (targetDiv && targetDiv.children.length > 0) {
        setIsLoaded(true);
      }
    });

    observer.observe(containerRef.current, { childList: true, subtree: true });

    // Defer ad load slightly to let the page render instantly
    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';
      
      // Create container element expected by script
      const containerDiv = document.createElement('div');
      containerDiv.id = 'container-7e44a1a59523814678cfb3bc2405137c';
      containerRef.current.appendChild(containerDiv);
      
      // Create and append the script tag dynamically
      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
      script.setAttribute('data-cfasync', 'false');
      script.src = 'https://pl30272500.effectivecpmnetwork.com/7e44a1a59523814678cfb3bc2405137c/invoke.js';
      containerRef.current.appendChild(script);
    }, 400); // 400ms delay

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return (
    <div className={`${isLoaded ? 'flex justify-center items-center my-6 min-h-[120px] bg-slate-900/30 rounded-xl border border-slate-850/80 p-4' : 'hidden'} ${className}`}>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
