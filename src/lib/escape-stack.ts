type OverlayId = string;
type Priority = number;

interface StackItem {
  id: OverlayId;
  priority: Priority;
  onClose: () => void;
}

class EscapeStackManager {
  private stack: StackItem[] = [];

  register(id: OverlayId, onClose: () => void, priority: Priority = 10): void {
    this.stack.push({ id, priority, onClose });
    this.stack.sort((a, b) => a.priority - b.priority);
  }

  unregister(id: OverlayId): void {
    this.stack = this.stack.filter((item) => item.id !== id);
  }

  hasItems(): boolean {
    return this.stack.length > 0;
  }

  getTopId(): OverlayId | undefined {
    return this.stack[this.stack.length - 1]?.id;
  }

  handleEscape(): boolean {
    const topItem = this.stack[this.stack.length - 1];
    if (topItem) {
      topItem.onClose();
      return true;
    }
    return false;
  }

  clear(): void {
    this.stack = [];
  }
}

export const escapeStack = new EscapeStackManager();
export type { OverlayId, Priority };
