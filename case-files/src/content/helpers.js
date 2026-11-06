// Authoring helpers for Case Files content. Output is plain §5 data.
// doc(): sentences are plain strings; prefix a sentence with "@name " to give it a handle
// (the handle is stripped from the text). Sentence ids are assigned d<doc>s<n> in reading order.

export function doc(id, meta, paragraphs) {
  const ids = {};
  let n = 0;
  const out = paragraphs.map((para) => para.map((raw) => {
    n += 1;
    const sid = `${id}s${n}`;
    const m = /^@(\w+)\s+/.exec(raw);
    if (m) {
      if (ids[m[1]]) throw new Error(`duplicate handle ${m[1]}`);
      ids[m[1]] = sid;
    }
    return { id: sid, text: m ? raw.slice(m[0].length) : raw };
  }));
  return { doc: { id, ...meta, paragraphs: out }, ids };
}

// Merge handle maps; unknown handles throw, so a typo can never silently point nowhere.
export function handles(...maps) {
  const all = Object.assign({}, ...maps);
  return new Proxy(all, {
    get(t, k) {
      if (typeof k === 'symbol') return t[k];
      if (!(k in t)) throw new Error(`unknown sentence handle: ${String(k)}`);
      return t[k];
    },
  });
}
