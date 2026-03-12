import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, NodeSelection } from "@tiptap/pm/state";
import { DOMSerializer } from "@tiptap/pm/model";

const dragHandlePluginKey = new PluginKey("dragHandle");

const GRIP_SVG = `<svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
  <circle cx="4.5" cy="2.5" r="1.2" fill="currentColor"/>
  <circle cx="9.5" cy="2.5" r="1.2" fill="currentColor"/>
  <circle cx="4.5" cy="7" r="1.2" fill="currentColor"/>
  <circle cx="9.5" cy="7" r="1.2" fill="currentColor"/>
  <circle cx="4.5" cy="11.5" r="1.2" fill="currentColor"/>
  <circle cx="9.5" cy="11.5" r="1.2" fill="currentColor"/>
</svg>`;

export const DragHandle = Extension.create({
  name: "dragHandle",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: dragHandlePluginKey,

        view(editorView) {
          const handle = document.createElement("div");
          handle.className = "drag-handle";
          handle.draggable = true;
          handle.innerHTML = GRIP_SVG;

          const editorEl = editorView.dom as HTMLElement;
          const container = editorEl.parentElement;
          if (container) {
            container.style.position = "relative";
            container.appendChild(handle);
          }

          let currentNodePos: number | null = null;
          let currentNodeElement: HTMLElement | null = null;
          let hideTimeout: ReturnType<typeof setTimeout> | null = null;
          let visible = false;

          function show() {
            if (hideTimeout) {
              clearTimeout(hideTimeout);
              hideTimeout = null;
            }
            if (!visible) {
              handle.style.opacity = "1";
              handle.style.pointerEvents = "auto";
              visible = true;
            }
          }

          function hide(delay = 200) {
            if (hideTimeout) clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
              handle.style.opacity = "0";
              handle.style.pointerEvents = "none";
              visible = false;
              currentNodePos = null;
              currentNodeElement = null;
            }, delay);
          }

          function resolveTopLevelBlock(pos: number) {
            try {
              const $pos = editorView.state.doc.resolve(pos);
              if ($pos.depth >= 1) {
                const nodePos = $pos.before(1);
                const node = editorView.state.doc.nodeAt(nodePos);
                return node ? { pos: nodePos, node } : null;
              }
            } catch {
              // pos out of range
            }
            return null;
          }

          function positionHandle(blockEl: HTMLElement) {
            if (!container) return;
            const containerRect = container.getBoundingClientRect();
            const editorRect = editorEl.getBoundingClientRect();
            const blockRect = blockEl.getBoundingClientRect();
            const top =
              blockRect.top - containerRect.top + container.scrollTop;
            const left = editorRect.left - containerRect.left + 8;
            handle.style.top = `${top + 2}px`;
            handle.style.left = `${left}px`;
          }

          function onMouseMove(event: MouseEvent) {
            if (!editor.isEditable) return;

            const posInfo = editorView.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });

            if (!posInfo) {
              const editorRect = editorEl.getBoundingClientRect();
              const adjustedX = editorRect.left + 40;
              const retryInfo = editorView.posAtCoords({
                left: adjustedX,
                top: event.clientY,
              });
              if (!retryInfo) {
                hide();
                return;
              }
              const resolved = resolveTopLevelBlock(retryInfo.pos);
              if (!resolved) {
                hide();
                return;
              }
              updateHandle(resolved.pos);
              return;
            }

            const resolved = resolveTopLevelBlock(posInfo.pos);
            if (!resolved) {
              hide();
              return;
            }

            updateHandle(resolved.pos);
          }

          function updateHandle(nodePos: number) {
            const doc = editorView.state.doc;
            if (
              doc.childCount === 1 &&
              doc.firstChild?.isTextblock &&
              doc.firstChild.content.size === 0
            ) {
              hide();
              return;
            }

            if (currentNodePos === nodePos && visible) return;
            currentNodePos = nodePos;

            const domNode = editorView.nodeDOM(nodePos);
            if (!domNode || !(domNode instanceof HTMLElement)) {
              hide();
              return;
            }

            currentNodeElement = domNode;
            positionHandle(domNode);
            show();
          }

          function onMouseLeave(event: MouseEvent) {
            const related = event.relatedTarget as HTMLElement | null;
            if (related && handle.contains(related)) return;
            hide();
          }

          function onHandleMouseEnter() {
            show();
          }

          function onHandleMouseLeave(event: MouseEvent) {
            const related = event.relatedTarget as HTMLElement | null;
            if (
              related &&
              (editorEl.contains(related) || container?.contains(related))
            )
              return;
            hide();
          }

          function onHandleMouseDown(event: MouseEvent) {
            // Don't call preventDefault() — it would block the native drag!
            // Just stopPropagation to prevent editor from handling the click
            event.stopPropagation();

            if (currentNodePos === null) return;

            try {
              const sel = NodeSelection.create(
                editorView.state.doc,
                currentNodePos
              );
              editorView.dispatch(editorView.state.tr.setSelection(sel));
            } catch {
              // NodeSelection may fail for some node types
            }
          }

          function onHandleDragStart(event: DragEvent) {
            if (currentNodePos === null || !event.dataTransfer) return;

            // Select the node first
            try {
              const sel = NodeSelection.create(
                editorView.state.doc,
                currentNodePos
              );
              editorView.dispatch(editorView.state.tr.setSelection(sel));
            } catch {
              event.preventDefault();
              return;
            }

            // Set drag image
            if (currentNodeElement) {
              event.dataTransfer.setDragImage(currentNodeElement, 0, 0);
            }

            // Get the selection content as a slice
            const slice = editorView.state.selection.content();

            // THIS IS THE KEY: set view.dragging so ProseMirror's native
            // drop handler processes this as an internal move — same mechanism
            // used by images and other NodeViews
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editorView as any).dragging = { slice, move: true };

            // Serialize for dataTransfer (required by browser)
            const serializer = DOMSerializer.fromSchema(
              editorView.state.schema
            );
            const tempDiv = document.createElement("div");
            tempDiv.appendChild(
              serializer.serializeFragment(slice.content)
            );

            event.dataTransfer.clearData();
            event.dataTransfer.setData("text/html", tempDiv.innerHTML);
            event.dataTransfer.setData(
              "text/plain",
              tempDiv.textContent || ""
            );
            event.dataTransfer.effectAllowed = "move";

            handle.classList.add("dragging");
          }

          function onDragEnd() {
            handle.classList.remove("dragging");
            hide(0);
          }

          editorEl.addEventListener("mousemove", onMouseMove);
          editorEl.addEventListener("mouseleave", onMouseLeave);
          if (container) {
            container.addEventListener("mousemove", onMouseMove);
            container.addEventListener("mouseleave", onMouseLeave);
          }
          handle.addEventListener("mouseenter", onHandleMouseEnter);
          handle.addEventListener("mouseleave", onHandleMouseLeave);
          handle.addEventListener("mousedown", onHandleMouseDown);
          handle.addEventListener("dragstart", onHandleDragStart);
          handle.addEventListener("dragend", onDragEnd);

          return {
            update(view) {
              if (currentNodePos !== null && visible) {
                try {
                  const domNode = view.nodeDOM(currentNodePos);
                  if (domNode instanceof HTMLElement) {
                    positionHandle(domNode);
                  } else {
                    hide(0);
                  }
                } catch {
                  hide(0);
                }
              }
            },
            destroy() {
              editorEl.removeEventListener("mousemove", onMouseMove);
              editorEl.removeEventListener("mouseleave", onMouseLeave);
              if (container) {
                container.removeEventListener("mousemove", onMouseMove);
                container.removeEventListener("mouseleave", onMouseLeave);
              }
              handle.removeEventListener("mouseenter", onHandleMouseEnter);
              handle.removeEventListener("mouseleave", onHandleMouseLeave);
              handle.removeEventListener("mousedown", onHandleMouseDown);
              handle.removeEventListener("dragstart", onHandleDragStart);
              handle.removeEventListener("dragend", onDragEnd);
              if (hideTimeout) clearTimeout(hideTimeout);
              handle.remove();
            },
          };
        },
      }),
    ];
  },
});
