if (!window.storage) {
  window.storage = {
    get: async (k) => {
      const v = localStorage.getItem(k);
      return v == null ? null : { key: k, value: v };
    },
    set: async (k, v) => {
      localStorage.setItem(k, v);
      return { key: k, value: v };
    },
    delete: async (k) => {
      localStorage.removeItem(k);
      return { key: k, deleted: true };
    },
    list: async (p) => ({ keys: Object.keys(localStorage).filter((k) => !p || k.startsWith(p)) }),
  };
}
