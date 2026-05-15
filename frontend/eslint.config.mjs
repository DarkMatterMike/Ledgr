import js from "@eslint/js";

const browserGlobals = Object.fromEntries([
  'window','document','console','alert','confirm','prompt',
  'setTimeout','clearTimeout','setInterval','clearInterval',
  'requestAnimationFrame','cancelAnimationFrame','postMessage',
  'addEventListener','removeEventListener',
  'Promise','Set','Map','WeakMap','WeakSet','Date','Math','JSON',
  'Object','Array','String','Number','Boolean','Error','TypeError','RangeError',
  'URLSearchParams','URL','fetch','navigator','localStorage','sessionStorage',
  'location','history','performance','crypto','Symbol','Proxy','Reflect',
  'structuredClone','queueMicrotask','globalThis','self',
  'Infinity','NaN','parseInt','parseFloat','isNaN','isFinite',
  'encodeURIComponent','decodeURIComponent','atob','btoa',
  'FormData','Blob','File','FileReader',
  'MutationObserver','ResizeObserver','IntersectionObserver',
  'Notification','TextDecoder','TextEncoder','Event','CustomEvent','EventTarget','HTMLElement','Element','Node',
  'React','Fragment',
  'module','exports','require','process','__dirname',
].map(k => [k, 'readonly']));

export default [
  {
    files: ["**/*.js", "**/*.jsx"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: browserGlobals,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "error",
      "no-redeclare": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
