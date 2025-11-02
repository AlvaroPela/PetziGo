import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";

export default function Modal({ isOpen, onClose, children, ariaLabel }) {
  const overlayRef = useRef(null);
  const previouslyFocused = useRef(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement;
    // small timeout so elements inside modal mount
    setTimeout(() => {
      const focusable = overlayRef.current?.querySelector('input,button,select,textarea,[tabindex]:not([tabindex="-1"])');
      if (focusable) focusable.focus();
    }, 0);

    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      // restore focus
      if (previouslyFocused.current && previouslyFocused.current.focus) {
        previouslyFocused.current.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
      aria-label={ariaLabel || "Modal"}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onMouseDown={(e) => {
          // cerrar solo si clic fuera del modal (no en sus hijos)
          if (e.target === e.currentTarget) onClose();
        }}
      />

      {/* Modal content */}
      <div
        ref={overlayRef}
        className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-xl p-6 ring-1 ring-slate-200 max-h-[90vh] sm:max-h-[80vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-violet-800 hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-300"
          aria-label="Cerrar"
          onClick={onClose}
        >
          ✕
        </button>
        <div className="overflow-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}
