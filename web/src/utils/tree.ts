import type { FormField } from '../types/form';

export function removeNode(list: FormField[], id: string): { newList: FormField[], removed: FormField | null } {
  let removed: FormField | null = null;
  const newList = list.filter(f => {
    if (f.id === id) {
      removed = f;
      return false;
    }
    return true;
  }).map(f => {
    if (f.children) {
      const { newList: childrenList, removed: childRemoved } = removeNode(f.children, id);
      if (childRemoved) removed = childRemoved;
      return { ...f, children: childrenList };
    }
    return f;
  });
  return { newList, removed };
}

export function insertBefore(list: FormField[], targetId: string, node: FormField): FormField[] {
  const result: FormField[] = [];
  for (const f of list) {
    if (f.id === targetId) {
      result.push(node);
    }
    if (f.children) {
      result.push({ ...f, children: insertBefore(f.children, targetId, node) });
    } else {
      result.push(f);
    }
  }
  return result;
}

export function insertAfter(list: FormField[], targetId: string, node: FormField): FormField[] {
  const result: FormField[] = [];
  for (const f of list) {
    result.push(f.children ? { ...f, children: insertAfter(f.children, targetId, node) } : f);
    if (f.id === targetId) {
      result.push(node);
    }
  }
  return result;
}

export function appendToSection(list: FormField[], sectionId: string, node: FormField): FormField[] {
  return list.map(f => {
    if (f.id === sectionId && f.type === 'section') {
      return { ...f, children: [...(f.children || []), node] };
    }
    if (f.children) {
      return { ...f, children: appendToSection(f.children, sectionId, node) };
    }
    return f;
  });
}

export function findNode(list: FormField[], id: string): FormField | null {
  for (const f of list) {
    if (f.id === id) return f;
    if (f.children) {
      const found = findNode(f.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function moveNodeUp(list: FormField[], id: string): FormField[] {
  const idx = list.findIndex(f => f.id === id);
  if (idx > 0) {
    const copy = [...list];
    const temp = copy[idx - 1];
    copy[idx - 1] = copy[idx];
    copy[idx] = temp;
    return copy;
  }
  return list.map(f => {
    if (f.children) {
      return { ...f, children: moveNodeUp(f.children, id) };
    }
    return f;
  });
}

export function moveNodeDown(list: FormField[], id: string): FormField[] {
  const idx = list.findIndex(f => f.id === id);
  if (idx >= 0 && idx < list.length - 1) {
    const copy = [...list];
    const temp = copy[idx + 1];
    copy[idx + 1] = copy[idx];
    copy[idx] = temp;
    return copy;
  }
  return list.map(f => {
    if (f.children) {
      return { ...f, children: moveNodeDown(f.children, id) };
    }
    return f;
  });
}

export function duplicateNode(list: FormField[], id: string): { newList: FormField[], duplicatedId: string | null } {
  let duplicatedId: string | null = null;

  function clone(node: FormField): FormField {
    const newId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 4);
    duplicatedId = newId;
    return {
      ...node,
      id: newId,
      name: node.type === 'section' ? '' : `${node.name}_copy`,
      label: `${node.label} (Copy)`,
      children: node.children ? node.children.map(clone) : undefined,
      options: node.options ? node.options.map((opt, i) => ({
        ...opt,
        id: `${newId}_opt_${i}`,
        value: `${opt.value}_copy`
      })) : undefined
    };
  }

  function traverse(items: FormField[]): FormField[] {
    const result: FormField[] = [];
    for (const item of items) {
      result.push(item.children ? { ...item, children: traverse(item.children) } : item);
      if (item.id === id) {
        result.push(clone(item));
      }
    }
    return result;
  }

  return { newList: traverse(list), duplicatedId };
}

export function countAllFields(list: FormField[]): number {
  let count = 0;
  for (const f of list) {
    count++;
    if (f.children) {
      count += countAllFields(f.children);
    }
  }
  return count;
}
