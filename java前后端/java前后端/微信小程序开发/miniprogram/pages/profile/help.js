Page({
  data: {
    expanded: {
      basic1: false,
      basic2: false,
      basic3: false,
      level1: false,
      level2: false,
      level3: false,
      faq1: false,
      faq2: false,
      faq3: false
    }
  },

  toggleExpand(key) {
    const expanded = { ...this.data.expanded };
    expanded[key] = !expanded[key];
    this.setData({ expanded });
  }
});