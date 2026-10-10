import { ComponentBuilder } from './ComponentBuilder.js';

/**
 * Pure data model + builder + validator for the Embed Creator (Components V2).
 *
 * A "model" looks like:
 *   { title: string, color: number|string|null, spoiler: boolean, items: Item[] }
 *
 * Items are kept in display order. Supported item types:
 *   text       { content }
 *   separator  { spacing: 1|2, divider: boolean }
 *   section    { texts: string[1..3], accessory: {type:'button'|'thumbnail', ...} }
 *   gallery    { items: [{ url, description?, spoiler? }] (1..10) }
 *   button     { label?, emoji?, url?, customId?, style }   (consecutive buttons share an action row)
 *   select     { placeholder?, customId?, options: [{ label, value, description? }] (1..25) }
 *
 * Nothing in this file talks to Discord, so it can be unit tested on its own.
 */

export const V2_FLAG = 32768; // IS_COMPONENTS_V2 (1 << 15)

export const LIMITS = {
  components: 40,
  totalText: 4000,
  sectionTexts: 3,
  galleryItems: 10,
  selectOptions: 25,
  buttonLabel: 80,
  customId: 100,
  url: 512,
  mediaDescription: 1024,
  optionLabel: 100,
  optionValue: 100,
  optionDescription: 100,
  placeholder: 150,
  maxItems: 50
};

export const ITEM_META = {
  text: { icon: '📝', label: 'Text' },
  separator: { icon: '➖', label: 'Separator' },
  section: { icon: '🧩', label: 'Section' },
  gallery: { icon: '🖼️', label: 'Gallery' },
  button: { icon: '🔘', label: 'Button' },
  select: { icon: '📋', label: 'Select menu' }
};

let uidCounter = 0;
export function newUid() {
  uidCounter = (uidCounter + 1) % 1000000;
  return `${Date.now().toString(36).slice(-4)}${uidCounter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/* ------------------------------------------------------------------ */
/* Parsers (modal text -> data)                                        */
/* ------------------------------------------------------------------ */

export function colorToHex(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return '#' + Math.max(0, Math.min(0xFFFFFF, value)).toString(16).padStart(6, '0');
  }
  if (typeof value === 'string' && /^#?[0-9a-f]{6}$/i.test(value.trim())) {
    return '#' + value.trim().replace('#', '').toLowerCase();
  }
  return '';
}

export function hexToNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const hex = colorToHex(value);
  return hex ? parseInt(hex.slice(1), 16) : null;
}

/** Empty input clears the colour. Returns { value } or { error }. */
export function parseHexColor(input) {
  const s = String(input ?? '').trim();
  if (!s) return { value: null };
  if (!/^#?[0-9a-f]{6}$/i.test(s)) return { error: 'Invalid hex colour. Use something like #5865F2.' };
  return { value: colorToHex(s) };
}

const STYLE_NAMES = {
  primary: 1, blurple: 1,
  secondary: 2, grey: 2, gray: 2,
  success: 3, green: 3,
  danger: 4, red: 4,
  link: 5
};

/** Returns 1-5, or null when invalid. Empty input -> 1 (Primary). */
export function parseButtonStyle(input) {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s) return 1;
  if (STYLE_NAMES[s]) return STYLE_NAMES[s];
  const n = parseInt(s, 10);
  return n >= 1 && n <= 5 ? n : null;
}

/**
 * Accepts a unicode emoji, `name:id`, `name:id:animated` or Discord's `<:name:id>` / `<a:name:id>`.
 * Returns undefined for empty input and null for an invalid format.
 */
export function parseEmoji(input) {
  const make = (name, id, animated) => {
    const e = {};
    if (name) e.name = name;
    if (id) e.id = id;
    if (animated) e.animated = true;
    return e;
  };
  if (input && typeof input === 'object') {
    return input.name || input.id ? make(input.name, input.id, input.animated) : undefined;
  }
  const s = String(input ?? '').trim();
  if (!s) return undefined;
  let m = /^<(a?):(\w{2,32}):(\d{17,20})>$/.exec(s);
  if (m) return make(m[2], m[3], m[1] === 'a');
  m = /^(\w{2,32}):(\d{17,20})(?::(true|false))?$/i.exec(s);
  if (m) return make(m[1], m[2], (m[3] || '').toLowerCase() === 'true');
  if (s.includes(':') || s.length > 16) return null;
  return make(s);
}

export function emojiToText(emoji) {
  if (!emoji) return '';
  if (emoji.id) return `${emoji.name || 'emoji'}:${emoji.id}${emoji.animated ? ':true' : ''}`;
  return emoji.name || '';
}

/** Up to 3 text displays separated by a line containing only `---`. */
export function splitSectionTexts(input) {
  return String(input ?? '')
    .split(/\r?\n[ \t]*---[ \t]*\r?\n/)
    .map(t => t.trim())
    .filter(Boolean);
}

export function joinSectionTexts(texts = []) {
  return texts.join('\n---\n');
}

/** Lenient yes/no parser for modal fields. Empty or unrecognised input returns `fallback`. */
export function parseBool(input, fallback = false) {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s) return fallback;
  if (/^(true|yes|y|ya|1|on|spoiler)$/.test(s)) return true;
  if (/^(false|no|n|tidak|0|off)$/.test(s)) return false;
  return fallback;
}

const TRUTHY = /^(true|yes|y|ya|1|spoiler)$/i;

/** One image per line: `url | description | spoiler` (description and spoiler optional). */
export function parseGalleryLines(input) {
  const items = [];
  for (const line of String(input ?? '').split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const [url, description, spoiler] = raw.split('|').map(p => p.trim());
    items.push({ url, description: description || undefined, spoiler: TRUTHY.test(spoiler || '') });
  }
  return items;
}

export function galleryToText(items = []) {
  return items
    .map(i => [i.url, i.description || '', i.spoiler ? 'true' : ''].join(' | ').replace(/( \| )+$/, ''))
    .join('\n');
}

export function slugify(text) {
  const slug = String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, LIMITS.optionValue);
  return slug || String(text ?? '').slice(0, LIMITS.optionValue);
}

/** One option per line: `label | value | description` (value defaults to a slug of the label). */
export function parseSelectOptions(input) {
  const options = [];
  for (const line of String(input ?? '').split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const [label, value, description] = raw.split('|').map(p => p.trim());
    options.push({ label, value: value || slugify(label), description: description || undefined });
  }
  return options;
}

export function optionsToText(options = []) {
  return options
    .map(o => [o.label, o.value, o.description || ''].join(' | ').replace(/( \| )+$/, ''))
    .join('\n');
}

/* ------------------------------------------------------------------ */
/* Item helpers                                                        */
/* ------------------------------------------------------------------ */

export function createItem(type, data = {}) {
  return normalizeItem({ ...data, type });
}

/** Makes sure an item owns a stable uid (used for auto-generated custom_ids). */
export function normalizeItem(item) {
  if (!item.uid) item.uid = newUid();
  if (item.type === 'section' && item.accessory?.type === 'button' && item.accessory.data) {
    if (!item.accessory.data.uid) item.accessory.data.uid = newUid();
  }
  return item;
}

export function cloneItem(item) {
  const copy = JSON.parse(JSON.stringify(item));
  delete copy.uid;
  if (copy.accessory?.data) delete copy.accessory.data.uid;
  // an explicit custom_id must stay unique inside one message
  if (copy.customId) delete copy.customId;
  if (copy.accessory?.data?.customId) delete copy.accessory.data.customId;
  return normalizeItem(copy);
}

function oneLine(text, max = 50) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function summarizeItem(item, index) {
  const meta = ITEM_META[item.type] || { icon: '❔', label: String(item.type) };
  let detail = '';
  switch (item.type) {
    case 'text':
      detail = oneLine(item.content);
      break;
    case 'separator':
      detail = `${item.divider === false ? 'no line' : 'line'}, ${item.spacing === 2 ? 'large' : 'small'}`;
      break;
    case 'section':
      detail = `${oneLine(item.texts?.[0], 30)} (${item.accessory?.type || 'no accessory'})`;
      break;
    case 'gallery':
      detail = `${item.items?.length || 0} image(s)`;
      break;
    case 'button':
      detail = oneLine(item.label || emojiToText(item.emoji) || 'button', 30) + (item.url ? ' (link)' : '');
      break;
    case 'select':
      detail = `${item.options?.length || 0} option(s)`;
      break;
  }
  const label = `${index + 1}. ${meta.icon} ${meta.label}${detail ? ': ' + detail : ''}`;
  return label.length > 100 ? label.slice(0, 99) + '…' : label;
}

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

function buildButton(data, nid) {
  const isLink = !!data.url;
  return ComponentBuilder.createButton({
    label: data.label || undefined,
    style: isLink ? 5 : (data.style && data.style !== 5 ? data.style : 1),
    url: isLink ? data.url : undefined,
    customId: isLink ? undefined : (data.customId || `v2_btn_${data.uid || 'x'}`),
    emoji: data.emoji || undefined,
    id: nid()
  });
}

/**
 * Builds the full message payload ({ flags, components: [container] }).
 * Every component gets an explicit, unique id so explicit and auto-assigned ids never collide.
 * With `preview: true`, an empty model renders a placeholder instead of an empty container.
 */
export function buildMessagePayload(model, { preview = false } = {}) {
  let idCounter = 1;
  const nid = () => idCounter++;
  const out = [];
  const items = Array.isArray(model.items) ? model.items : [];

  const title = String(model.title ?? '').trim();
  if (title) out.push(ComponentBuilder.createTextDisplay('# ' + title, nid()));

  let buttonRun = [];
  const flushButtons = () => {
    for (let i = 0; i < buttonRun.length; i += 5) {
      const rowId = nid();
      const children = buttonRun.slice(i, i + 5).map(b => buildButton(b, nid));
      out.push(ComponentBuilder.createActionRow(children, rowId));
    }
    buttonRun = [];
  };

  for (const item of items) {
    if (item.type === 'button') {
      buttonRun.push(item);
      continue;
    }
    flushButtons();

    switch (item.type) {
      case 'text':
        out.push(ComponentBuilder.createTextDisplay(item.content ?? '', nid()));
        break;

      case 'separator':
        out.push(ComponentBuilder.createSeparator({
          spacing: item.spacing === 2 ? 2 : 1,
          divider: item.divider !== false,
          id: nid()
        }));
        break;

      case 'section': {
        const texts = (item.texts || []).slice(0, LIMITS.sectionTexts);
        const acc = item.accessory;
        if (acc?.type === 'button' && acc.data) {
          const sectionId = nid();
          const textComps = texts.map(t => ComponentBuilder.createTextDisplay(t, nid()));
          out.push(ComponentBuilder.createSection({
            components: textComps,
            accessory: buildButton(acc.data, nid),
            id: sectionId
          }));
        } else if (acc?.type === 'thumbnail' && acc.data) {
          const sectionId = nid();
          const textComps = texts.map(t => ComponentBuilder.createTextDisplay(t, nid()));
          out.push(ComponentBuilder.createSection({
            components: textComps,
            accessory: ComponentBuilder.createThumbnail({
              src: acc.data.url,
              description: acc.data.description || null,
              spoiler: !!acc.data.spoiler,
              id: nid()
            }),
            id: sectionId
          }));
        } else {
          // Discord requires an accessory on every Section, so degrade to plain text displays
          texts.forEach(t => out.push(ComponentBuilder.createTextDisplay(t, nid())));
        }
        break;
      }

      case 'gallery':
        out.push(ComponentBuilder.createMediaGallery({
          items: (item.items || []).slice(0, LIMITS.galleryItems).map(g => ({
            media: { url: g.url },
            description: g.description || undefined,
            spoiler: !!g.spoiler
          })),
          id: nid()
        }));
        break;

      case 'select': {
        const rowId = nid();
        out.push(ComponentBuilder.createActionRow([
          ComponentBuilder.createStringSelect({
            customId: item.customId || `v2_sel_${item.uid || 'x'}`,
            placeholder: item.placeholder || undefined,
            options: (item.options || []).slice(0, LIMITS.selectOptions),
            id: nid()
          })
        ], rowId));
        break;
      }
    }
  }
  flushButtons();

  if (out.length === 0 && preview) {
    out.push(ComponentBuilder.createTextDisplay('*(No Content)*', nid()));
  }

  const container = ComponentBuilder.createContainer({
    accentColor: hexToNumber(model.color),
    spoiler: !!model.spoiler,
    components: out,
    id: nid()
  });

  return { flags: V2_FLAG, components: [container] };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function isHttpUrl(value) {
  if (typeof value !== 'string' || !value || value.length > LIMITS.url) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateButtonData(d, errors, label = 'Button') {
  if (!d.label && !d.emoji) errors.push(`${label} needs a label or an emoji.`);
  if (d.label && d.label.length > LIMITS.buttonLabel) errors.push(`${label} label is over ${LIMITS.buttonLabel} characters.`);
  if (d.url) {
    if (!isHttpUrl(d.url)) errors.push(`${label} URL must be a valid http(s) link (max ${LIMITS.url} chars).`);
  } else {
    if (d.style === 5) errors.push(`${label} uses the Link style but has no URL.`);
    if (d.customId && d.customId.length > LIMITS.customId) errors.push(`${label} custom ID is over ${LIMITS.customId} characters.`);
  }
}

/** Validates one item. Returns an array of problems (empty when fine). */
export function validateItem(item) {
  const errors = [];
  switch (item.type) {
    case 'text':
      if (!String(item.content ?? '').trim()) errors.push('Text is empty.');
      else if (item.content.length > LIMITS.totalText) errors.push(`Text is over ${LIMITS.totalText} characters.`);
      break;

    case 'separator':
      if (item.spacing !== 1 && item.spacing !== 2) errors.push('Spacing must be 1 (small) or 2 (large).');
      break;

    case 'section': {
      const texts = item.texts || [];
      if (texts.length < 1 || texts.length > LIMITS.sectionTexts) errors.push(`A section needs 1-${LIMITS.sectionTexts} text parts.`);
      if (texts.some(t => !String(t).trim())) errors.push('A section text part is empty.');
      if (!item.accessory?.data) {
        errors.push('A section needs a button or thumbnail accessory.');
      } else if (item.accessory.type === 'button') {
        validateButtonData(item.accessory.data, errors, 'Section button');
      } else if (item.accessory.type === 'thumbnail') {
        const t = item.accessory.data;
        if (!isHttpUrl(t.url)) errors.push('Thumbnail URL must be a valid http(s) link.');
        if (t.description && t.description.length > LIMITS.mediaDescription) errors.push(`Thumbnail description is over ${LIMITS.mediaDescription} characters.`);
      } else {
        errors.push('Unknown section accessory type.');
      }
      break;
    }

    case 'gallery': {
      const imgs = item.items || [];
      if (imgs.length < 1 || imgs.length > LIMITS.galleryItems) errors.push(`A gallery needs 1-${LIMITS.galleryItems} images.`);
      imgs.forEach((g, i) => {
        if (!isHttpUrl(g.url)) errors.push(`Image ${i + 1}: URL must be a valid http(s) link.`);
        if (g.description && g.description.length > LIMITS.mediaDescription) errors.push(`Image ${i + 1}: description is over ${LIMITS.mediaDescription} characters.`);
      });
      break;
    }

    case 'button':
      validateButtonData(item, errors);
      break;

    case 'select': {
      const opts = item.options || [];
      if (opts.length < 1 || opts.length > LIMITS.selectOptions) errors.push(`A select menu needs 1-${LIMITS.selectOptions} options.`);
      const seen = new Set();
      opts.forEach((o, i) => {
        if (!o.label) errors.push(`Option ${i + 1}: label is empty.`);
        if (o.label && o.label.length > LIMITS.optionLabel) errors.push(`Option ${i + 1}: label is over ${LIMITS.optionLabel} characters.`);
        if (!o.value) errors.push(`Option ${i + 1}: value is empty.`);
        if (o.value && o.value.length > LIMITS.optionValue) errors.push(`Option ${i + 1}: value is over ${LIMITS.optionValue} characters.`);
        if (o.description && o.description.length > LIMITS.optionDescription) errors.push(`Option ${i + 1}: description is over ${LIMITS.optionDescription} characters.`);
        if (o.value && seen.has(o.value)) errors.push(`Option ${i + 1}: duplicate value "${o.value}".`);
        seen.add(o.value);
      });
      if (item.placeholder && item.placeholder.length > LIMITS.placeholder) errors.push(`Placeholder is over ${LIMITS.placeholder} characters.`);
      if (item.customId && item.customId.length > LIMITS.customId) errors.push(`Custom ID is over ${LIMITS.customId} characters.`);
      break;
    }

    default:
      errors.push(`Unknown item type "${item.type}".`);
  }
  return errors;
}

function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (node.type) fn(node);
  if (Array.isArray(node.components)) node.components.forEach(c => walk(c, fn));
  if (node.accessory) walk(node.accessory, fn);
}

/**
 * Validates a whole model against Discord's rules. Counts are taken from the built payload,
 * so they always match what would really be sent.
 * `hasHandler(customId)` is optional; when given, interactive components without a handler are warned about.
 */
export function validateModel(model, { hasHandler } = {}) {
  const errors = [];
  const warnings = [];
  const items = Array.isArray(model.items) ? model.items : [];

  if (!String(model.title ?? '').trim() && items.length === 0) {
    errors.push('The message is empty. Add at least one component.');
  }
  if (String(model.title ?? '').length > LIMITS.totalText) {
    errors.push(`Title is over ${LIMITS.totalText} characters.`);
  }

  items.forEach((item, i) => {
    const label = (ITEM_META[item.type]?.label) || 'Item';
    validateItem(item).forEach(e => errors.push(`#${i + 1} ${label}: ${e}`));
  });

  const payload = buildMessagePayload(model);
  const container = payload.components[0];

  let componentCount = 0;
  let textLength = 0;
  const customIds = new Map();
  walk(container, node => {
    componentCount++;
    if (node.type === 10) textLength += (node.content || '').length;
    if (node.custom_id) {
      const entry = customIds.get(node.custom_id) || { count: 0, label: node.label || node.placeholder || (node.type === 3 ? 'select menu' : 'button') };
      entry.count++;
      customIds.set(node.custom_id, entry);
    }
  });

  if (componentCount > LIMITS.components) {
    errors.push(`Component count (${componentCount}) exceeds Discord's limit of ${LIMITS.components}.`);
  } else if (componentCount > LIMITS.components - 5) {
    warnings.push(`Component count (${componentCount}) is close to the limit of ${LIMITS.components}.`);
  }

  if (textLength > LIMITS.totalText) {
    errors.push(`Total text length (${textLength}) exceeds Discord's limit of ${LIMITS.totalText} characters.`);
  } else if (textLength > LIMITS.totalText - 500) {
    warnings.push(`Total text length (${textLength}) is close to the limit of ${LIMITS.totalText}.`);
  }

  for (const [id, entry] of customIds) {
    if (entry.count > 1) errors.push(`Custom ID "${id}" is used ${entry.count} times; each must be unique in a message.`);
    if (typeof hasHandler === 'function' && !hasHandler(id)) {
      warnings.push(`"${entry.label}" (custom ID \`${id}\`) has no handler, so clicking it will do nothing.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings, stats: { componentCount, textLength } };
}

/* ------------------------------------------------------------------ */
/* JSON import / export                                                */
/* ------------------------------------------------------------------ */

function str(v) {
  return typeof v === 'string' ? v : (v === undefined || v === null ? '' : String(v));
}

function sanitizeButton(raw) {
  const url = str(raw.url).trim();
  const emoji = parseEmoji(raw.emoji);
  if (emoji === null) return { error: 'invalid emoji' };
  let style = raw.style === undefined ? 1 : parseButtonStyle(raw.style);
  if (style === null) return { error: 'invalid style (use 1-5 or primary/secondary/success/danger/link)' };
  if (url) style = 5;
  return {
    data: {
      label: str(raw.label).trim() || undefined,
      emoji: emoji || undefined,
      url: url || undefined,
      customId: url ? undefined : (str(raw.customId).trim() || undefined),
      style
    }
  };
}

function sanitizeItem(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'must be an object' };
  switch (raw.type) {
    case 'text':
      return { item: createItem('text', { content: str(raw.content) }) };

    case 'separator':
      return { item: createItem('separator', { spacing: raw.spacing === 2 ? 2 : 1, divider: raw.divider !== false }) };

    case 'section': {
      const texts = Array.isArray(raw.texts) ? raw.texts.map(str) : splitSectionTexts(raw.text);
      let accessory = null;
      const a = raw.accessory;
      if (a && a.type === 'button') {
        const b = sanitizeButton(a);
        if (b.error) return { error: `accessory ${b.error}` };
        accessory = { type: 'button', data: b.data };
      } else if (a && a.type === 'thumbnail') {
        accessory = { type: 'thumbnail', data: { url: str(a.url).trim(), description: str(a.description).trim() || undefined, spoiler: !!a.spoiler } };
      }
      return { item: createItem('section', { texts: texts.map(t => t.trim()).filter(Boolean), accessory }) };
    }

    case 'gallery': {
      const list = Array.isArray(raw.items) ? raw.items : [];
      return {
        item: createItem('gallery', {
          items: list.map(g => ({ url: str(g?.url).trim(), description: str(g?.description).trim() || undefined, spoiler: !!g?.spoiler }))
        })
      };
    }

    case 'button': {
      const b = sanitizeButton(raw);
      if (b.error) return { error: b.error };
      return { item: createItem('button', b.data) };
    }

    case 'select': {
      const list = Array.isArray(raw.options) ? raw.options : [];
      return {
        item: createItem('select', {
          placeholder: str(raw.placeholder).trim() || undefined,
          customId: str(raw.customId).trim() || undefined,
          options: list.map(o => {
            const label = str(o?.label).trim();
            return { label, value: str(o?.value).trim() || slugify(label), description: str(o?.description).trim() || undefined };
          })
        })
      };
    }

    default:
      return { error: `unknown type "${str(raw.type)}"` };
  }
}

/** Serialises a model to a clean, portable object (no internal ids). */
export function exportModel(model) {
  const items = (model.items || []).map(item => {
    const { uid, ...rest } = JSON.parse(JSON.stringify(item));
    if (rest.accessory?.data) delete rest.accessory.data.uid;
    if (rest.accessory) {
      // flatten { type, data } -> { type, ...data } for readability
      rest.accessory = { type: rest.accessory.type, ...rest.accessory.data };
    }
    return rest;
  });
  return { version: 1, title: model.title || '', color: colorToHex(model.color) || null, spoiler: !!model.spoiler, items };
}

/** Parses exported JSON (string or object). Returns { model } or { error }. */
export function importModel(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return { error: `Invalid JSON: ${e.message}` };
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { error: 'The JSON must be an object like {"items":[...]}.' };
  }
  if (!Array.isArray(data.items)) return { error: 'Missing an "items" array.' };
  if (data.items.length > LIMITS.maxItems) return { error: `Too many items (max ${LIMITS.maxItems}).` };

  const items = [];
  const problems = [];
  data.items.forEach((raw, i) => {
    const result = sanitizeItem(raw);
    if (result.error) {
      problems.push(`items[${i}]: ${result.error}`);
      return;
    }
    validateItem(result.item).forEach(e => problems.push(`items[${i}]: ${e}`));
    items.push(result.item);
  });
  if (problems.length > 0) {
    const shown = problems.slice(0, 5);
    if (problems.length > 5) shown.push(`...and ${problems.length - 5} more`);
    return { error: shown.join('\n') };
  }

  let color = null;
  if (data.color !== undefined && data.color !== null && data.color !== '') {
    const parsed = parseHexColor(typeof data.color === 'number' ? colorToHex(data.color) : data.color);
    if (parsed.error) return { error: `color: ${parsed.error}` };
    color = parsed.value;
  }

  return { model: { title: str(data.title).trim(), color, spoiler: !!data.spoiler, items } };
}
