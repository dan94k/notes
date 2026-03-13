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
          const scrollContainer = editorEl.closest(".editor-scroll") as HTMLElement | null;

          // Append to body so position:fixed works correctly regardless of DOM nesting
          document.body.appendChild(handle);

          let currentNodePos: number | null = null;
          let currentNodeElement: HTMLElement | null = null;
          let hideTimeout: ReturnType<typeof setTimeout> | null = null;
          let visible = false;

          // Touch drag state
          let touchDragging = false;
          let touchDragSourcePos: number | null = null;
          let touchAutoHideTimeout: ReturnType<typeof setTimeout> | null = null;

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
            const blockRect = blockEl.getBoundingClientRect();
            const editorRect = editorEl.getBoundingClientRect();
            // position: fixed uses viewport coordinates directly
            handle.style.top = `${blockRect.top + 2}px`;
            handle.style.left = `${editorRect.left + 8}px`;
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

          /* ── Mouse events (desktop) ── */

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
              if (!retryInfo) { hide(); return; }
              const resolved = resolveTopLevelBlock(retryInfo.pos);
              if (!resolved) { hide(); return; }
              updateHandle(resolved.pos);
              return;
            }

            const resolved = resolveTopLevelBlock(posInfo.pos);
            if (!resolved) { hide(); return; }
            updateHandle(resolved.pos);
          }

          function onMouseLeave(event: MouseEvent) {
            const related = event.relatedTarget as HTMLElement | null;
            if (related && handle.contains(related)) return;
            hide();
          }

          function onHandleMouseEnter() { show(); }

          function onHandleMouseLeave(event: MouseEvent) {
            const related = event.relatedTarget as HTMLElement | null;
            if (related && editorEl.contains(related)) return;
            hide();
          }

          function onHandleMouseDown(event: MouseEvent) {
            event.stopPropagation();
            if (currentNodePos === null) return;
            try {
              const sel = NodeSelection.create(editorView.state.doc, currentNodePos);
              editorView.dispatch(editorView.state.tr.setSelection(sel));
            } catch { /* NodeSelection may fail for some node types */ }
          }

          function onHandleDragStart(event: DragEvent) {
            if (currentNodePos === null || !event.dataTransfer) return;

            try {
              const sel = NodeSelection.create(editorView.state.doc, currentNodePos);
              editorView.dispatch(editorView.state.tr.setSelection(sel));
            } catch {
              event.preventDefault();
              return;
            }

            if (currentNodeElement) {
              event.dataTransfer.setDragImage(currentNodeElement, 0, 0);
            }

            const slice = editorView.state.selection.content();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editorView as any).dragging = { slice, move: true };

            const serializer = DOMSerializer.fromSchema(editorView.state.schema);
            const tempDiv = document.createElement("div");
            tempDiv.appendChild(serializer.serializeFragment(slice.content));

            event.dataTransfer.clearData();
            event.dataTransfer.setData("text/html", tempDiv.innerHTML);
            event.dataTransfer.setData("text/plain", tempDiv.textContent || "");
            event.dataTransfer.effectAllowed = "move";
            handle.classList.add("dragging");
          }

          function onDragEnd() {
            handle.classList.remove("dragging");
            hide(0);
          }

          /* ── Touch events (mobile) ── */

          // Show handle when user taps a block in the editor
          function onEditorTouchStart(event: TouchEvent) {
            if (!editor.isEditable || touchDragging) return;
            const touch = event.touches[0];
            const posInfo = editorView.posAtCoords({ left: touch.clientX, top: touch.clientY });
            if (!posInfo) return;
            const resolved = resolveTopLevelBlock(posInfo.pos);
            if (!resolved) return;
            updateHandle(resolved.pos);
            // Auto-hide after 3 seconds of inactivity
            if (touchAutoHideTimeout) clearTimeout(touchAutoHideTimeout);
            touchAutoHideTimeout = setTimeout(() => {
              if (!touchDragging) hide(0);
            }, 3000);
          }

          // Begin touch drag from the handle
          function onHandleTouchStart(event: TouchEvent) {
            event.preventDefault();
            event.stopPropagation();
            if (currentNodePos === null) return;

            if (touchAutoHideTimeout) {
              clearTimeout(touchAutoHideTimeout);
              touchAutoHideTimeout = null;
            }

            touchDragging = true;
            touchDragSourcePos = currentNodePos;

            try {
              const sel = NodeSelection.create(editorView.state.doc, currentNodePos);
              editorView.dispatch(editorView.state.tr.setSelection(sel));
            } catch { /* ignore */ }

            handle.classList.add("dragging");
          }

          // Move handle vertically while dragging
          function onHandleTouchMove(event: TouchEvent) {
            if (!touchDragging) return;
            event.preventDefault();
            const touch = event.touches[0];
            handle.style.top = `${touch.clientY}px`;
          }

          // Drop: move block to new position
          function onHandleTouchEnd(event: TouchEvent) {
            if (!touchDragging) return;
            event.preventDefault();

            touchDragging = false;
            handle.classList.remove("dragging");

            const touch = event.changedTouches[0];
            const sourcePos = touchDragSourcePos;
            touchDragSourcePos = null;

            if (sourcePos !== null) {
              // Use centre of editor for x to reliably hit a block
              const editorRect = editorEl.getBoundingClientRect();
              const dropInfo = editorView.posAtCoords({
                left: editorRect.left + editorRect.width / 2,
                top: touch.clientY,
              });

              if (dropInfo) {
                const resolved = resolveTopLevelBlock(dropInfo.pos);
                if (resolved && resolved.pos !== sourcePos) {
                  // Determine insert position based on upper/lower half of target block
                  const targetEl = editorView.nodeDOM(resolved.pos);
                  let insertAfter = false;
                  if (targetEl instanceof HTMLElement) {
                    const rect = targetEl.getBoundingClientRect();
                    insertAfter = touch.clientY > rect.top + rect.height / 2;
                  }
                  moveBlock(sourcePos, resolved.pos, insertAfter);
                }
              }
            }

            // Re-position handle at the (potentially moved) block
            if (currentNodeElement) {
              positionHandle(currentNodeElement);
            } else {
              hide(0);
            }

            // Auto-hide after a short delay
            touchAutoHideTimeout = setTimeout(() => hide(0), 1500);
          }

          // Move a top-level block from fromPos to before/after the block at toPos
          function moveBlock(fromPos: number, toPos: number, insertAfter: boolean) {
            const doc = editorView.state.doc;
            const fromNode = doc.nodeAt(fromPos);
            const toNode = doc.nodeAt(toPos);
            if (!fromNode || !toNode) return;

            const fromEnd = fromPos + fromNode.nodeSize;
            const insertPos = insertAfter ? toPos + toNode.nodeSize : toPos;
            const tr = editorView.state.tr;

            try {
              if (insertPos >= fromEnd) {
                // Target is after source: insert first (source pos unaffected), then delete
                tr.insert(insertPos, fromNode);
                tr.delete(fromPos, fromEnd);
              } else {
                // Target is before source: delete first (target pos unaffected), then insert
                tr.delete(fromPos, fromEnd);
                tr.insert(insertPos, fromNode);
              }
              editorView.dispatch(tr);
            } catch { /* ignore */ }
          }

          /* ── Scroll reposition ── */

          function onScroll() {
            if (visible && currentNodeElement) {
              positionHandle(currentNodeElement);
            }
          }

          /* ── Event listener registration ── */

          editorEl.addEventListener("mousemove", onMouseMove);
          editorEl.addEventListener("mouseleave", onMouseLeave);
          editorEl.addEventListener("touchstart", onEditorTouchStart, { passive: true });
          scrollContainer?.addEventListener("scroll", onScroll);

          handle.addEventListener("mouseenter", onHandleMouseEnter);
          handle.addEventListener("mouseleave", onHandleMouseLeave);
          handle.addEventListener("mousedown", onHandleMouseDown);
          handle.addEventListener("dragstart", onHandleDragStart);
          handle.addEventListener("dragend", onDragEnd);
          handle.addEventListener("touchstart", onHandleTouchStart, { passive: false });
          handle.addEventListener("touchmove", onHandleTouchMove, { passive: false });
          handle.addEventListener("touchend", onHandleTouchEnd, { passive: false });

          return {
            update(view) {
              if (currentNodePos !== null && visible && !touchDragging) {
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
              editorEl.removeEventListener("touchstart", onEditorTouchStart);
              scrollContainer?.removeEventListener("scroll", onScroll);
              handle.removeEventListener("mouseenter", onHandleMouseEnter);
              handle.removeEventListener("mouseleave", onHandleMouseLeave);
              handle.removeEventListener("mousedown", onHandleMouseDown);
              handle.removeEventListener("dragstart", onHandleDragStart);
              handle.removeEventListener("dragend", onDragEnd);
              handle.removeEventListener("touchstart", onHandleTouchStart);
              handle.removeEventListener("touchmove", onHandleTouchMove);
              handle.removeEventListener("touchend", onHandleTouchEnd);
              if (hideTimeout) clearTimeout(hideTimeout);
              if (touchAutoHideTimeout) clearTimeout(touchAutoHideTimeout);
              handle.remove();
            },
          };
        },
      }),
    ];
  },
});
