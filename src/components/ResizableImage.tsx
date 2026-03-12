"use client";

import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { useRef, useState, useCallback } from "react";

export default function ResizableImage({ node, updateAttributes, selected }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [resizing, setResizing] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizing(true);

      const startX = e.clientX;
      const startWidth = imgRef.current?.offsetWidth || 300;

      function onMouseMove(ev: MouseEvent) {
        const diff = ev.clientX - startX;
        const newWidth = Math.max(100, startWidth + diff);
        updateAttributes({ width: newWidth });
      }

      function onMouseUp() {
        setResizing(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [updateAttributes]
  );

  const width = node.attrs.width;

  return (
    <NodeViewWrapper className="resizable-image-wrapper" data-drag-handle>
      <div
        className={`relative inline-block ${selected ? "ring-2 ring-blue-400 ring-offset-2 ring-offset-neutral-950 rounded-md" : ""}`}
        style={{ width: width ? `${width}px` : "auto", maxWidth: "100%" }}
      >
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ""}
          title={node.attrs.title || ""}
          className="block rounded-md"
          style={{ width: "100%", height: "auto" }}
          draggable={false}
        />

        {/* Resize handle — bottom-right corner */}
        {selected && (
          <div
            onMouseDown={handleMouseDown}
            className={`absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-se-resize rounded-sm border-2 border-blue-400 bg-neutral-950 transition hover:bg-blue-400 ${resizing ? "bg-blue-400" : ""}`}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}
