import React, { useEffect, useRef, useState } from 'react';
import { motion, useSpring } from 'framer-motion';
import lottie, { AnimationItem } from 'lottie-web';

export function LottieCursor() {
  const lottieContainerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Smooth standard springing for 60fps lightweight cursor delay
  const springConfig = { damping: 25, stiffness: 400, mass: 0.5 };
  const mouseX = useSpring(0, springConfig);
  const mouseY = useSpring(0, springConfig);

  useEffect(() => {
    // Only enable on desktop pointer devices
    if (!window.matchMedia("(pointer: fine)").matches) return;

    setIsVisible(true);
    
    // Load Lottie Ripple Animation
    if (lottieContainerRef.current) {
      animRef.current = lottie.loadAnimation({
        container: lottieContainerRef.current,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        path: '/cursor-lottie.json',
      });
      // Speed up the click ripple slightly
      animRef.current.setSpeed(1.5);
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    const handleMouseDown = () => {
      if (animRef.current) {
        animRef.current.goToAndPlay(0, true);
      }
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      const isClickable = 
        window.getComputedStyle(target).cursor === 'pointer' ||
        target.closest('a') !== null ||
        target.closest('button') !== null ||
        target.closest('.cursor-pointer') !== null;
        
      setIsHovering(isClickable);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseover', handleMouseOver);
      if (animRef.current) animRef.current.destroy();
    };
  }, [mouseX, mouseY]);

  if (!isVisible) return null;

  return (
    <>
      <style>
        {`
          /* Globally hide system cursor when LottieCursor is active */
          * {
            cursor: none !important;
          }
        `}
      </style>
      <motion.div
        style={{
          x: mouseX,
          y: mouseY,
          translateX: "-50%",
          translateY: "-50%"
        }}
        className="pointer-events-none fixed top-0 left-0 z-[99999] flex items-center justify-center mix-blend-difference"
      >
         {/* Main dot transitioning scale on hover */}
         <div 
           className="absolute w-4 h-4 bg-white rounded-full transition-transform duration-300 ease-out"
           style={{ transform: isHovering ? 'scale(2.5)' : 'scale(1)' }}
         />
         
         {/* Internal dot to maintain center definition when scaled */}
         <div 
           className="absolute w-1 h-1 bg-black rounded-full transition-opacity duration-300"
           style={{ opacity: isHovering ? 1 : 0 }}
         />
         
         {/* Lottie Click Ripple container */}
         <div 
           ref={lottieContainerRef} 
           className="absolute w-32 h-32 opacity-80" 
           style={{ transform: 'translate(-50%, -50%)', left: '50%', top: '50%' }}
         />
      </motion.div>
    </>
  );
}
