import {
  safeGetParentElement,
  safeGetStyle,
  safeGetTagName,
  safeNodeContains,
  safeQuerySelector,
  safeQuerySelectorAll,
} from '../shared/dom';

interface FilterOverride {
  value: string;
  priority: string;
  applied: string;
}

// Only CSS blur on video paths; protected playback and unrelated overlays stay intact.
export class VideoUnblur {
  private overrides = new Map<HTMLElement, FilterOverride>();

  restore(root?: ParentNode): void {
    for (const [element, saved] of this.overrides) {
      if (root && root !== element && !safeNodeContains(root as Node, element))
        continue;
      const style = safeGetStyle(element);
      if (
        style?.filter === saved.applied &&
        style.getPropertyPriority('filter') === 'important'
      ) {
        if (saved.value) {
          style.setProperty('filter', saved.value, saved.priority);
        } else {
          style.removeProperty('filter');
        }
      }
      this.overrides.delete(element);
    }
  }

  scan(root: ParentNode): void {
    const videos = safeQuerySelectorAll(root, 'video');
    if (root instanceof HTMLElement && safeGetTagName(root) === 'VIDEO') {
      videos.push(root);
    }

    // Performance optimization: Fast-path early exit if no overrides are currently active and no video elements exist in root subtree.
    if (this.overrides.size === 0 && videos.length === 0) {
      return;
    }

    // Release detached players and ancestors that no longer contain any video.
    // Performance optimization: Use safeQuerySelector to stop search on the first matched video, avoiding full subtree array allocations.
    for (const element of this.overrides.keys()) {
      if (
        !element.isConnected ||
        (safeGetTagName(element) !== 'VIDEO' &&
          !safeQuerySelector(element, 'video'))
      ) {
        this.restore(element);
      }
    }

    if (videos.length === 0) return;

    const visited = new Set<Element>();
    for (const video of videos) {
      for (
        let element: Element | null = video;
        element;
        element = safeGetParentElement(element)
      ) {
        if (visited.has(element)) break;
        visited.add(element);
        if (!(element instanceof HTMLElement) || !element.isConnected) continue;
        const style = safeGetStyle(element);
        const ownerDoc =
          typeof Document !== 'undefined' &&
          element.ownerDocument instanceof Document
            ? element.ownerDocument
            : typeof document !== 'undefined'
              ? document
              : null;
        const view = ownerDoc?.defaultView;
        if (!style || !view || typeof view.getComputedStyle !== 'function')
          continue;
        const filter = view.getComputedStyle(element).filter;
        if (!filter || !/\bblur\(/i.test(filter)) continue;
        // Computed blur lengths are resolved; preserve brightness, contrast, etc.
        const unblurred = filter.replace(/\bblur\([^)]*\)/gi, 'blur(0px)');
        if (filter === unblurred) continue;

        const saved = this.overrides.get(element);
        if (
          !saved ||
          style.filter !== saved.applied ||
          style.getPropertyPriority('filter') !== 'important'
        ) {
          this.overrides.set(element, {
            value: style.filter,
            priority: style.getPropertyPriority('filter'),
            applied: '',
          });
        }
        style.setProperty('filter', unblurred, 'important');
        const override = this.overrides.get(element);
        if (override) override.applied = style.filter;
      }
    }
  }
}
