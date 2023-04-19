export function get(obj: { [k: string]: any }, path: string[]): any {
  let target = obj;
  for (let i = 0; i < path.length; i++) {
    const prop = path[i];
    if (typeof target !== 'object') {
      return undefined;
    }
    target = target[prop];
  }
  return target;
}

export function del(obj: { [k: string]: any }, path: string[], clean = false) {
  let target = obj;

  for (let i = 0; i < path.length - 1; i++) {
    target = target[path[i]];
  }
  delete target[path[path.length - 1]];

  if (clean && !Object.keys(target).length) {
    del(obj, path.slice(0, -1));
  }
}

export function set(
  obj: { [k: string]: any },
  path: string[],
  value: any,
  clean = false
) {
  let target = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const prop = path[i];
    if (typeof target[prop] !== 'object') {
      target[prop] = {};
    }
    target = target[prop];
  }
  if (value === undefined) {
    del(obj, path, clean);
  } else {
    target[path[path.length - 1]] = value;
  }
}

export function getFromPath(path: string[]) {
  return (obj: { [k: string]: any }) => get(obj, path);
}
