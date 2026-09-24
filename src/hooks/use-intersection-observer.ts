import { useEffect, useRef, useState } from "react";

export const useIntersectionObserver = (options?: IntersectionObserverInit) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);
  const { threshold, rootMargin } = options ?? {};
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      setIsIntersecting(entry.isIntersecting);
    }, { threshold, rootMargin });
    if (targetRef.current) {
      observer.observe(targetRef.current);
    }
    return () => observer.disconnect();
  }, [threshold, rootMargin]);
    return {targetRef,isIntersecting}
};
