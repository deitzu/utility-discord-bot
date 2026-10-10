import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import {
  ITEM_META,
  LIMITS,
  colorToHex,
  emojiToText,
  galleryToText,
  joinSectionTexts,
  optionsToText,
  parseBool,
  parseButtonStyle,
  parseEmoji,
  parseGalleryLines,
  parseHexColor,
  parseSelectOptions,
  splitSectionTexts
} from './EmbedV2Model.js';

/**
 * Modal definitions + parsers for the Embed Creator (Components V2).
 *
 * Discord modals allow at most 5 rows and exactly ONE text input per row, so anything that
 * needs more data (gallery images, select options, section texts) is packed into a single
 * paragraph field with one entry per line.
 */

export const MODAL_IDS = {
  text: 'embed_creator_modal_text',
  separator: 'embed_creator_modal_separator',
  section_button: 'embed_creator_modal_section_button',
  section_thumbnail: 'embed_creator_modal_section_thumbnail',
  gallery: 'embed_creator_modal_gallery',
  button: 'embed_creator_modal_button',
  select: 'embed_creator_modal_select',
  title: 'embed_creator_modal_v2_title',
  color: 'embed_creator_modal_v2_color',
  import: 'embed_creator_modal_v2_import'
};

export const MODAL_KINDS = Object.keys(MODAL_IDS).filter(k => !['title', 'color', 'import'].includes(k));

const KIND_TITLES = {
  text: 'Text',
  separator: 'Separator',
  section_button: 'Section + button',
  section_thumbnail: 'Section + thumbnail',
  gallery: 'Media gallery',
  button: 'Button',
  select: 'Select menu'
};

/** The modal kind that edits a given item. */
export function kindOfItem(item) {
  if (item.type === 'section') return item.accessory?.type === 'thumbnail' ? 'section_thumbnail' : 'section_button';
  return item.type;
}

function field({ id, label, paragraph = false, required = false, placeholder, value, maxLength, minLength }) {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(required);
  if (placeholder) input.setPlaceholder(placeholder);
  if (maxLength) input.setMaxLength(maxLength);
  if (minLength) input.setMinLength(minLength);
  if (value) input.setValue(String(value).slice(0, maxLength || 4000));
  return input;
}

function modal(customId, title, fields) {
  const m = new ModalBuilder().setCustomId(customId).setTitle(title.slice(0, 45));
  m.addComponents(...fields.map(f => new ActionRowBuilder().addComponents(f)));
  return m;
}

function buttonFields(data = {}) {
  return [
    field({ id: 'btn_label', label: 'Button label', maxLength: LIMITS.buttonLabel, placeholder: 'Leave empty for an emoji-only button', value: data.label }),
    field({ id: 'btn_target', label: 'Link URL or custom ID', maxLength: LIMITS.url, placeholder: 'https://… = link button. Anything else = custom ID. Empty = auto ID', value: data.url || data.customId }),
    field({ id: 'btn_style', label: 'Style (ignored for links)', maxLength: 20, placeholder: 'primary / secondary / success / danger', value: data.url ? '' : ({ 1: 'primary', 2: 'secondary', 3: 'success', 4: 'danger' }[data.style] || '') }),
    field({ id: 'btn_emoji', label: 'Emoji (optional)', maxLength: 64, placeholder: '🎉  or  name:id  or  <a:name:id>', value: emojiToText(data.emoji) })
  ];
}

/**
 * Builds the add/edit modal for an item kind. Pass `item` to prefill it for editing.
 */
export function buildItemModal(kind, item = null) {
  const title = `${item ? 'Edit' : 'Add'} ${KIND_TITLES[kind] || 'component'}`;

  switch (kind) {
    case 'text':
      return modal(MODAL_IDS.text, title, [
        field({ id: 'text_input', label: 'Content (markdown)', paragraph: true, required: true, maxLength: LIMITS.totalText, placeholder: '## Heading\nSome **markdown** text…', value: item?.content })
      ]);

    case 'separator':
      return modal(MODAL_IDS.separator, title, [
        field({ id: 'separator_spacing', label: 'Spacing (1 = small, 2 = large)', maxLength: 1, placeholder: '1', value: item ? String(item.spacing) : '' }),
        field({ id: 'separator_divider', label: 'Show divider line? (yes / no)', maxLength: 5, placeholder: 'yes', value: item ? (item.divider === false ? 'no' : 'yes') : '' })
      ]);

    case 'section_button':
      return modal(MODAL_IDS.section_button, title, [
        field({ id: 'section_texts', label: 'Text (up to 3 parts, split with ---)', paragraph: true, required: true, maxLength: LIMITS.totalText, placeholder: 'First text\n---\nSecond text (optional)', value: item ? joinSectionTexts(item.texts) : '' }),
        ...buttonFields(item?.accessory?.data)
      ]);

    case 'section_thumbnail': {
      const t = item?.accessory?.data;
      return modal(MODAL_IDS.section_thumbnail, title, [
        field({ id: 'section_texts', label: 'Text (up to 3 parts, split with ---)', paragraph: true, required: true, maxLength: LIMITS.totalText, placeholder: 'First text\n---\nSecond text (optional)', value: item ? joinSectionTexts(item.texts) : '' }),
        field({ id: 'thumb_url', label: 'Thumbnail image URL', required: true, maxLength: LIMITS.url, placeholder: 'https://example.com/image.png', value: t?.url }),
        field({ id: 'thumb_desc', label: 'Alt text (optional)', maxLength: LIMITS.mediaDescription, value: t?.description }),
        field({ id: 'thumb_spoiler', label: 'Spoiler? (yes / no)', maxLength: 5, placeholder: 'no', value: t?.spoiler ? 'yes' : '' })
      ]);
    }

    case 'gallery':
      return modal(MODAL_IDS.gallery, title, [
        field({ id: 'gallery_lines', label: `Images (one per line, max ${LIMITS.galleryItems})`, paragraph: true, required: true, maxLength: LIMITS.totalText, placeholder: 'https://…/a.png | alt text | spoiler\nhttps://…/b.png', value: item ? galleryToText(item.items) : '' })
      ]);

    case 'button':
      return modal(MODAL_IDS.button, title, buttonFields(item || {}));

    case 'select':
      return modal(MODAL_IDS.select, title, [
        field({ id: 'select_placeholder', label: 'Placeholder (optional)', maxLength: LIMITS.placeholder, placeholder: 'Choose an option…', value: item?.placeholder }),
        field({ id: 'select_options', label: `Options (max ${LIMITS.selectOptions}, one per line)`, paragraph: true, required: true, maxLength: LIMITS.totalText, placeholder: 'label | value | description\nRed team | red | Join the reds\nBlue team', value: item ? optionsToText(item.options) : '' }),
        field({ id: 'select_custom_id', label: 'Custom ID (optional)', maxLength: LIMITS.customId, placeholder: 'Empty = auto ID', value: item?.customId })
      ]);

    default:
      throw new Error(`Unknown modal kind: ${kind}`);
  }
}

export function buildTitleModal(current = '') {
  return modal(MODAL_IDS.title, 'Message title', [
    field({ id: 'title_input', label: 'Title (empty = no title)', maxLength: 256, placeholder: 'Shown as a large heading at the top', value: current })
  ]);
}

export function buildColorModal(current) {
  return modal(MODAL_IDS.color, 'Accent colour', [
    field({ id: 'color_input', label: 'Accent colour (hex, empty = none)', maxLength: 7, placeholder: '#5865F2', value: colorToHex(current) })
  ]);
}

export function buildImportModal() {
  return modal(MODAL_IDS.import, 'Import JSON', [
    field({ id: 'import_json', label: 'Exported JSON (max 4000 characters)', paragraph: true, required: true, maxLength: LIMITS.totalText, placeholder: '{"version":1,"title":"…","items":[…]}' })
  ]);
}

/* ------------------------------------------------------------------ */
/* Parsers                                                             */
/* ------------------------------------------------------------------ */

function parseButtonFields(get) {
  const label = get('btn_label').trim();
  const target = get('btn_target').trim();
  const emoji = parseEmoji(get('btn_emoji'));
  if (emoji === null) return { error: 'Invalid emoji. Use a unicode emoji, `name:id`, or `<:name:id>`.' };

  const style = parseButtonStyle(get('btn_style'));
  if (style === null) return { error: 'Invalid style. Use primary, secondary, success or danger.' };

  const data = { label: label || undefined, emoji: emoji || undefined, style };
  if (/^https?:\/\//i.test(target)) {
    data.url = target;
    data.style = 5;
  } else if (target) {
    data.customId = target;
  }
  if (data.style === 5 && !data.url) {
    return { error: 'The Link style needs a URL in the "Link URL or custom ID" field.' };
  }
  return { data };
}

/**
 * Turns a submitted add/edit modal into an item.
 * Returns { item } or { error }. The caller still runs validateItem() on the result.
 */
export function parseItemFromModal(kind, fields) {
  const get = id => {
    try {
      return fields.getTextInputValue(id) ?? '';
    } catch {
      return '';
    }
  };

  switch (kind) {
    case 'text':
      return { item: { type: 'text', content: get('text_input').trim() } };

    case 'separator': {
      const raw = get('separator_spacing').trim();
      const spacing = raw ? parseInt(raw, 10) : 1;
      if (spacing !== 1 && spacing !== 2) return { error: 'Spacing must be 1 (small) or 2 (large).' };
      return { item: { type: 'separator', spacing, divider: parseBool(get('separator_divider'), true) } };
    }

    case 'section_button': {
      const button = parseButtonFields(get);
      if (button.error) return { error: button.error };
      return { item: { type: 'section', texts: splitSectionTexts(get('section_texts')), accessory: { type: 'button', data: button.data } } };
    }

    case 'section_thumbnail':
      return {
        item: {
          type: 'section',
          texts: splitSectionTexts(get('section_texts')),
          accessory: {
            type: 'thumbnail',
            data: {
              url: get('thumb_url').trim(),
              description: get('thumb_desc').trim() || undefined,
              spoiler: parseBool(get('thumb_spoiler'), false)
            }
          }
        }
      };

    case 'gallery':
      return { item: { type: 'gallery', items: parseGalleryLines(get('gallery_lines')) } };

    case 'button': {
      const button = parseButtonFields(get);
      if (button.error) return { error: button.error };
      return { item: { type: 'button', ...button.data } };
    }

    case 'select':
      return {
        item: {
          type: 'select',
          placeholder: get('select_placeholder').trim() || undefined,
          customId: get('select_custom_id').trim() || undefined,
          options: parseSelectOptions(get('select_options'))
        }
      };

    default:
      return { error: `Unknown component kind "${kind}".` };
  }
}

export function itemLabel(kind) {
  return KIND_TITLES[kind] || ITEM_META[kind]?.label || 'component';
}

export { parseHexColor };
