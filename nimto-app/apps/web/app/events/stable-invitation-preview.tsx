"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export const StableInvitationPreview = forwardRef<
  HTMLIFrameElement,
  {
    className?: string;
    html: string;
    onReady?: (frame: HTMLIFrameElement) => void;
    sandbox?: string;
    title: string;
  }
>(function StableInvitationPreview(
  { className = "", html, onReady, sandbox = "allow-scripts", title },
  forwardedRef,
) {
  const firstFrame = useRef<HTMLIFrameElement | null>(null);
  const secondFrame = useRef<HTMLIFrameElement | null>(null);
  const frames = [firstFrame, secondFrame] as const;
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const activeHtmlRef = useRef(html);
  const latestHtmlRef = useRef(html);
  const [sources, setSources] = useState<[string, string]>([html, ""]);
  const [loaded, setLoaded] = useState<[boolean, boolean]>([false, false]);

  useImperativeHandle(
    forwardedRef,
    () => frames[activeIndex].current as HTMLIFrameElement,
    [activeIndex],
  );

  useEffect(() => {
    latestHtmlRef.current = html;
    if (html === activeHtmlRef.current) return;
    const pendingIndex = activeIndexRef.current === 0 ? 1 : 0;
    setLoaded((current) => {
      const next: [boolean, boolean] = [...current];
      next[pendingIndex] = false;
      return next;
    });
    setSources((current) => {
      const next: [string, string] = [...current];
      next[pendingIndex] = html;
      return next;
    });
  }, [html]);

  function frameLoaded(index: number) {
    const frame = frames[index].current;
    if (!frame) return;
    setLoaded((current) => {
      const next: [boolean, boolean] = [...current];
      next[index] = true;
      return next;
    });

    if (sources[index] !== latestHtmlRef.current) return;
    activeHtmlRef.current = sources[index];
    activeIndexRef.current = index;
    setActiveIndex(index);
    window.requestAnimationFrame(() => onReady?.(frame));
  }

  return (
    <div
      className={`stable-invitation-preview ${className}`.trim()}
      data-loading={!loaded[activeIndex]}
    >
      {sources.map((source, index) => (
        <iframe
          aria-hidden={index !== activeIndex}
          className={index === activeIndex ? "active" : ""}
          key={index}
          onLoad={() => frameLoaded(index)}
          ref={frames[index]}
          sandbox={sandbox}
          srcDoc={source}
          tabIndex={index === activeIndex ? 0 : -1}
          title={index === activeIndex ? title : `${title} loading`}
        />
      ))}
      {!loaded[activeIndex] ? (
        <span className="stable-preview-loading">Loading preview…</span>
      ) : null}
    </div>
  );
});
