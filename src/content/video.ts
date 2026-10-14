import { safeGetStyle, safeQuerySelectorAll } from '../shared/dom';

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
      if (root && root !== element && !(root as Node).contains(element))
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
    // Release detached players and ancestors that no longer contain any video.
    for (const element of this.overrides.keys()) {
      if (
        !element.isConnected ||
        (element.tagName !== 'VIDEO' &&
          safeQuerySelectorAll(element, 'video').length === 0)
      ) {
        this.restore(element);
      }
    }

    const videos = safeQuerySelectorAll(root, 'video');
    if (root instanceof HTMLElement && root.tagName === 'VIDEO') {
      videos.push(root);
    }
    const visited = new Set<Element>();
    for (const video of videos) {
      for (
        let element: Element | null = video;
        element;
        element = element.parentElement
      ) {
        if (visited.has(element)) break;
        visited.add(element);
        if (!(element instanceof HTMLElement) || !element.isConnected) continue;
        const style = safeGetStyle(element);
        const view = element.ownerDocument.defaultView;
        if (!style || !view) continue;
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
