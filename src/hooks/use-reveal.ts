import { useEffect, useRef } from "react";

/**
 * Adds `.is-visible` to any descendant `.reveal` element when it scrolls into view.
 * Attach the returned ref to the section/page wrapper.
 */
export function useReveal<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const items = root.querySelectorAll<HTMLElement>(".reveal");
    if (!items.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    items.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return ref;
}
