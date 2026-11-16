"use strict";
// Builds the element trees satori renders, without React: h("div", props,
// ...children) is what JSX compiles to. Null and false children are dropped.

function h(type, props, ...children) {
  const kids = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  return { type, props: { ...(props || {}), children: kids.length === 0 ? undefined : kids.length === 1 ? kids[0] : kids } };
}

module.exports = { h };
