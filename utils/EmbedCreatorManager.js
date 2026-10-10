import { Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createLogger } from './Logger.js';
import { ComponentBuilder } from './ComponentBuilder.js';
import { getMessageStyle } from './ConfigLoader.js';
import {
  LIMITS,
  buildMessagePayload,
  validateModel,
  normalizeItem,
  cloneItem,
  summarizeItem,
  colorToHex,
  hexToNumber
} from './EmbedV2Model.js';

const logger = createLogger('EmbedCreatorManager');

// Options of the "Add a component" menu (value -> label shown in Discord)
export const ADD_MENU_OPTIONS = [
  { value: 'text', label: 'Text', description: 'Markdown text display', emoji: { name: '📝' } },
  { value: 'separator', label: 'Separator', description: 'Spacing and/or a divider line', emoji: { name: '➖' } },
  { value: 'section_button', label: 'Section + button', description: '1-3 texts with a button beside them', emoji: { name: '🧩' } },
  { value: 'section_thumbnail', label: 'Section + thumbnail', description: '1-3 texts with a small image beside them', emoji: { name: '🖼️' } },
  { value: 'gallery', label: 'Media gallery', description: 'Up to 10 images', emoji: { name: '🏞️' } },
  { value: 'button', label: 'Button', description: 'Link or interactive button (rows of 5 are automatic)', emoji: { name: '🔘' } },
  { value: 'select', label: 'Select menu', description: 'Dropdown with up to 25 options', emoji: { name: '📋' } }
];

export class EmbedCreatorManager {
  constructor(client, config) {
    this.client = client;
    this.config = config;
    this.states = new Collection();
  }

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  getOrCreateState(userId, channelId) {
    if (!this.states.has(userId)) {
      this.states.set(userId, {
        userId,
        targetChannelId: channelId,
        embed: {
          title: '',
          description: '',
          color: this.config.embedColors?.embedCreator || this.config.embedColors?.primary || '#0099ff',
          fields: [],
          footer: { text: '' },
          image: { url: '' },
          thumbnail: { url: '' },
          timestamp: false
        },
        v2: {
          title: '',
          spoiler: false,
          items: [],
          selected: null,
          pendingEdit: null // index of the item whose edit modal is open (null = the open modal adds)
        },
        previewMessageId: null,
        controlsMessageId: null
      });
    } else if (channelId) {
      const state = this.states.get(userId);
      state.targetChannelId = channelId;
    }
    return this.states.get(userId);
  }

  /** Returns the running session or null (never creates one). */
  getSession(userId) {
    return this.states.get(userId) || null;
  }

  updateState(userId, data) {
    const state = this.getOrCreateState(userId);
    Object.assign(state.embed, data);
    return state;
  }

  resetState(userId) {
    const old = this.states.get(userId);
    const keep = old
      ? { targetChannelId: old.targetChannelId, previewMessageId: old.previewMessageId, controlsMessageId: old.controlsMessageId }
      : {};
    this.states.delete(userId);
    const fresh = this.getOrCreateState(userId, keep.targetChannelId);
    // keep pointing at the existing DM messages so they can be refreshed after a reset
    fresh.previewMessageId = keep.previewMessageId ?? null;
    fresh.controlsMessageId = keep.controlsMessageId ?? null;
    return fresh;
  }

  clearState(userId) {
    this.states.delete(userId);
  }

  /* ------------------------------------------------------------------ */
  /* V2 model operations                                                 */
  /* ------------------------------------------------------------------ */

  /** Snapshot of the V2 model for the builder/validator. */
  getModel(userId) {
    const state = this.getOrCreateState(userId);
    return {
      title: state.v2.title,
      color: state.embed.color,
      spoiler: state.v2.spoiler,
      items: state.v2.items
    };
  }

  /** Adds an item at the end and selects it. Returns its index, or -1 when the item cap is reached. */
  addItem(userId, item) {
    const state = this.getOrCreateState(userId);
    if (state.v2.items.length >= LIMITS.maxItems) return -1;
    state.v2.items.push(normalizeItem(item));
    state.v2.selected = state.v2.items.length - 1;
    return state.v2.selected;
  }

  /** Replaces an item in place (keeps its uid so auto-generated custom IDs stay stable). */
  replaceItem(userId, index, newItem) {
    const state = this.getOrCreateState(userId);
    const old = state.v2.items[index];
    if (!old) return false;
    newItem.uid = old.uid;
    if (
      old.type === 'section' && newItem.type === 'section' &&
      old.accessory?.type === 'button' && newItem.accessory?.type === 'button' &&
      old.accessory.data?.uid
    ) {
      newItem.accessory.data.uid = old.accessory.data.uid;
    }
    state.v2.items[index] = normalizeItem(newItem);
    state.v2.selected = index;
    return true;
  }

  removeItem(userId, index) {
    const state = this.getOrCreateState(userId);
    if (!state.v2.items[index]) return false;
    state.v2.items.splice(index, 1);
    state.v2.selected = null;
    return true;
  }

  moveItem(userId, index, delta) {
    const state = this.getOrCreateState(userId);
    const target = index + delta;
    if (!state.v2.items[index] || target < 0 || target >= state.v2.items.length) return false;
    const [item] = state.v2.items.splice(index, 1);
    state.v2.items.splice(target, 0, item);
    state.v2.selected = target;
    return true;
  }

  duplicateItem(userId, index) {
    const state = this.getOrCreateState(userId);
    const item = state.v2.items[index];
    if (!item || state.v2.items.length >= LIMITS.maxItems) return -1;
    state.v2.items.splice(index + 1, 0, cloneItem(item));
    state.v2.selected = index + 1;
    return index + 1;
  }

  selectItem(userId, index) {
    const state = this.getOrCreateState(userId);
    state.v2.selected = state.v2.items[index] ? index : null;
    return state.v2.selected;
  }

  setTitle(userId, title) {
    this.getOrCreateState(userId).v2.title = String(title ?? '').trim();
  }

  /** `color` is a "#rrggbb" string, or null to remove the accent colour. */
  setColor(userId, color) {
    this.getOrCreateState(userId).embed.color = color;
  }

  toggleSpoiler(userId) {
    const state = this.getOrCreateState(userId);
    state.v2.spoiler = !state.v2.spoiler;
    return state.v2.spoiler;
  }

  /** Replaces the whole V2 model (JSON import). */
  replaceModel(userId, model) {
    const state = this.getOrCreateState(userId);
    state.v2.title = model.title || '';
    state.v2.spoiler = !!model.spoiler;
    state.v2.items = model.items.map(normalizeItem);
    state.v2.selected = null;
    state.embed.color = model.color;
  }

  validate(userId) {
    if (!this.states.has(userId)) return { valid: true, errors: [], warnings: [], stats: { componentCount: 0, textLength: 0 } };
    return validateModel(this.getModel(userId), {
      hasHandler: id => !!this.client.components?.has(id)
    });
  }

  /* ------------------------------------------------------------------ */
  /* Message builders                                                    */
  /* ------------------------------------------------------------------ */

  buildPreviewMessage(userId) {
    const style = getMessageStyle(this.config, 'embedCreator');
    if (!this.states.has(userId) || style !== 'v2') return null;
    return buildMessagePayload(this.getModel(userId), { preview: true });
  }

  /** The exact payload that gets posted in the target channel (same builder as the preview). */
  buildFinalMessage(userId) {
    const style = getMessageStyle(this.config, 'embedCreator');
    if (!this.states.has(userId) || style !== 'v2') return null;
    return buildMessagePayload(this.getModel(userId));
  }

  buildMessage(userId) {
    const style = getMessageStyle(this.config, 'embedCreator');
    const state = this.states.get(userId);
    if (!state) return null;
    return style === 'v2' ? this.buildFinalMessage(userId) : { embeds: [this.buildEmbed(userId)] };
  }

  buildControlsMessage(userId, targetChannel) {
    const style = getMessageStyle(this.config, 'embedCreator');
    const state = this.states.get(userId);
    if (!state || style !== 'v2') return null;

    const items = state.v2.items;
    const selected = state.v2.selected;
    const hasSelection = selected !== null && selected !== undefined && !!items[selected];
    const validation = this.validate(userId);

    const target = state.targetChannelId ? `<#${state.targetChannelId}>` : (targetChannel ? String(targetChannel) : 'unknown channel');
    const colorHex = colorToHex(state.embed.color);

    const lines = [
      '### Embed Creator',
      `Sending to ${target} · **${items.length}** item(s) · ${validation.stats.componentCount}/${LIMITS.components} components · ${validation.stats.textLength}/${LIMITS.totalText} characters`,
      `Title: ${state.v2.title ? 'set' : 'none'} · Colour: ${colorHex || 'none'} · Spoiler: ${state.v2.spoiler ? 'on' : 'off'}`,
      hasSelection
        ? `**Selected:** ${summarizeItem(items[selected], selected)}`
        : '*Pick an item in the second menu to edit, move, duplicate or delete it.*'
    ];

    const problems = [
      ...validation.errors.map(e => `❌ ${e}`),
      ...validation.warnings.map(w => `⚠️ ${w}`)
    ];
    if (problems.length > 0) {
      lines.push('', '**Validation**');
      problems.slice(0, 8).forEach(p => lines.push(p.length > 220 ? p.slice(0, 219) + '…' : p));
      if (problems.length > 8) lines.push(`…and ${problems.length - 8} more`);
    }

    const addRow = ComponentBuilder.createActionRow([
      ComponentBuilder.createStringSelect({
        customId: 'embed_creator_add_select',
        placeholder: '➕ Add a component…',
        options: ADD_MENU_OPTIONS
      })
    ]);

    // Window of up to 25 items around the selection (Discord limits a select menu to 25 options)
    let itemOptions;
    if (items.length === 0) {
      itemOptions = [{ label: 'No items yet', value: 'none' }];
    } else {
      const windowSize = 25;
      const start = hasSelection ? Math.max(0, Math.min(items.length - windowSize, selected - 12)) : 0;
      itemOptions = items.slice(start, start + windowSize).map((item, i) => ({
        label: summarizeItem(item, start + i),
        value: String(start + i),
        default: hasSelection && start + i === selected
      }));
    }
    const itemRow = ComponentBuilder.createActionRow([
      ComponentBuilder.createStringSelect({
        customId: 'embed_creator_item_select',
        placeholder: items.length > 25 ? `Select an item (showing 25 of ${items.length})` : 'Select an item to edit / move / delete',
        options: itemOptions,
        disabled: items.length === 0
      })
    ]);

    const settingsRow = ComponentBuilder.createActionRow([
      ComponentBuilder.createButton({ customId: 'embed_creator_v2_title', label: 'Title', style: ButtonStyle.Secondary }),
      ComponentBuilder.createButton({ customId: 'embed_creator_v2_color', label: 'Colour', style: ButtonStyle.Secondary }),
      ComponentBuilder.createButton({ customId: 'embed_creator_v2_spoiler', label: `Spoiler: ${state.v2.spoiler ? 'on' : 'off'}`, style: state.v2.spoiler ? ButtonStyle.Success : ButtonStyle.Secondary }),
      ComponentBuilder.createButton({ customId: 'embed_creator_v2_export', label: 'Export JSON', style: ButtonStyle.Secondary }),
      ComponentBuilder.createButton({ customId: 'embed_creator_v2_import', label: 'Import JSON', style: ButtonStyle.Secondary })
    ]);

    const itemActionRow = ComponentBuilder.createActionRow([
      ComponentBuilder.createButton({ customId: 'embed_creator_item_edit', label: 'Edit', emoji: { name: '✏️' }, style: ButtonStyle.Primary, disabled: !hasSelection }),
      ComponentBuilder.createButton({ customId: 'embed_creator_item_up', label: 'Up', emoji: { name: '⬆️' }, style: ButtonStyle.Secondary, disabled: !hasSelection || selected === 0 }),
      ComponentBuilder.createButton({ customId: 'embed_creator_item_down', label: 'Down', emoji: { name: '⬇️' }, style: ButtonStyle.Secondary, disabled: !hasSelection || selected === items.length - 1 }),
      ComponentBuilder.createButton({ customId: 'embed_creator_item_dup', label: 'Copy', emoji: { name: '📄' }, style: ButtonStyle.Secondary, disabled: !hasSelection }),
      ComponentBuilder.createButton({ customId: 'embed_creator_item_delete', label: 'Delete', emoji: { name: '🗑️' }, style: ButtonStyle.Danger, disabled: !hasSelection })
    ]);

    const mainRow = ComponentBuilder.createActionRow([
      ComponentBuilder.createButton({ customId: 'embed_creator_send', label: 'Send Message', style: ButtonStyle.Success, disabled: !validation.valid }),
      ComponentBuilder.createButton({ customId: 'embed_creator_reset', label: 'Reset', style: ButtonStyle.Danger }),
      ComponentBuilder.createButton({ customId: 'embed_creator_cancel', label: 'Cancel', style: ButtonStyle.Danger })
    ]);

    return this._ensureIds(ComponentBuilder.buildV2Message({
      textDisplays: [lines.join('\n')],
      components: [addRow, itemRow, settingsRow, itemActionRow, mainRow],
      accentColor: hexToNumber(state.embed.color) ?? 0x5865F2
    }));
  }

  /**
   * Gives every component without an id a unique one, so explicit and auto-assigned
   * ids can never collide inside a message.
   */
  _ensureIds(payload) {
    const used = new Set();
    const nodes = [];
    const walk = node => {
      if (!node || typeof node !== 'object') return;
      if (node.type) {
        nodes.push(node);
        if (node.id) used.add(node.id);
      }
      (node.components || []).forEach(walk);
      if (node.accessory) walk(node.accessory);
    };
    (payload.components || []).forEach(walk);

    let next = 1;
    for (const node of nodes) {
      if (node.id) continue;
      while (used.has(next)) next++;
      node.id = next;
      used.add(next);
    }
    return payload;
  }

  /* ------------------------------------------------------------------ */
  /* Discord I/O                                                         */
  /* ------------------------------------------------------------------ */

  async _dmChannelId(userId, user) {
    const cached = user?.dmChannel || this.client.users.cache.get(userId)?.dmChannel;
    if (cached) return cached.id;
    const fetched = user || await this.client.users.fetch(userId);
    return (await fetched.createDM()).id;
  }

  async sendPreviewAndControls(userId, targetChannel, user) {
    const previewMessage = this.buildPreviewMessage(userId);
    const controlsMessage = this.buildControlsMessage(userId, targetChannel);

    if (!previewMessage || !controlsMessage) {
      return { success: false, error: 'Failed to build V2 messages' };
    }

    try {
      const state = this.states.get(userId);
      // /embed run again while an old session is open: tidy up the old DM messages first
      if (state?.previewMessageId || state?.controlsMessageId) {
        await this.deletePreviewAndControls(userId, user);
        state.previewMessageId = null;
        state.controlsMessageId = null;
      }

      const dmChannelId = await this._dmChannelId(userId, user);
      const previewMsg = await this.client.apiHelper.sendMessage(dmChannelId, previewMessage);
      const controlsMsg = await this.client.apiHelper.sendMessage(dmChannelId, controlsMessage);

      if (state) {
        state.previewMessageId = previewMsg.id;
        state.controlsMessageId = controlsMsg.id;
      }

      return { success: true, previewMsg, controlsMsg };
    } catch (error) {
      logger.error('Failed to send preview/controls DM:', error);
      return { success: false, error: error.message };
    }
  }

  async updatePreview(userId) {
    const state = this.states.get(userId);
    if (!state || !state.previewMessageId) return { success: false, error: 'No preview message to update' };

    const previewMessage = this.buildPreviewMessage(userId);
    if (!previewMessage) return { success: false, error: 'Failed to build preview message' };

    try {
      const dmChannelId = await this._dmChannelId(userId);
      await this.client.apiHelper.editMessage(dmChannelId, state.previewMessageId, previewMessage);
      return { success: true };
    } catch (error) {
      logger.error('Failed to update preview message:', error);
      return { success: false, error: error.message };
    }
  }

  async updateControls(userId, targetChannel) {
    const state = this.states.get(userId);
    if (!state || !state.controlsMessageId) return { success: false, error: 'No controls message to update' };

    const controlsMessage = this.buildControlsMessage(userId, targetChannel);
    if (!controlsMessage) return { success: false, error: 'Failed to build controls message' };

    try {
      const dmChannelId = await this._dmChannelId(userId);
      await this.client.apiHelper.editMessage(dmChannelId, state.controlsMessageId, controlsMessage);
      return { success: true };
    } catch (error) {
      logger.error('Failed to update controls message:', error);
      return { success: false, error: error.message };
    }
  }

  /** Re-renders both DM messages (preview + controls). */
  async refresh(userId) {
    const [preview, controls] = await Promise.all([this.updatePreview(userId), this.updateControls(userId)]);
    return { preview, controls };
  }

  /**
   * Posts the final message in the target channel.
   * Returns { success: true } or { success: false, error } (error is a user-facing sentence).
   */
  async sendToTarget(userId) {
    const state = this.states.get(userId);
    if (!state) return { success: false, error: 'This session has expired. Run /embed again.' };

    const validation = this.validate(userId);
    if (!validation.valid) {
      return { success: false, error: `Fix these first:\n${validation.errors.slice(0, 5).map(e => `• ${e}`).join('\n')}` };
    }

    const message = this.buildFinalMessage(userId);
    if (!message) return { success: false, error: 'Failed to build the message.' };

    try {
      const sent = await this.client.apiHelper.sendMessage(state.targetChannelId, message);
      return { success: true, message: sent };
    } catch (error) {
      logger.error(`Error sending message to channel ${state.targetChannelId}:`, error);
      const reason = error.data?.message || error.message;
      const hint = error.status === 403 || error.status === 404
        ? ' Make sure I can see that channel and have the Send Messages permission.'
        : '';
      return { success: false, error: `Discord refused the message: ${reason}.${hint}` };
    }
  }

  /**
   * Ends the session: removes the preview, turns the controls message into a plain
   * V2 status line (no buttons) and forgets the state.
   * Never uses `content`/`embeds`, which Discord rejects on Components V2 messages.
   */
  async finishSession(userId, statusText) {
    const state = this.states.get(userId);
    if (!state) return { success: true };

    try {
      const dmChannelId = await this._dmChannelId(userId);
      if (state.previewMessageId) {
        await this.client.apiHelper.deleteMessage(dmChannelId, state.previewMessageId).catch(e => logger.warn('Could not delete preview message:', e.message));
      }
      if (state.controlsMessageId) {
        const done = ComponentBuilder.buildV2Message({ textDisplays: [statusText], accentColor: 0x5865F2 });
        await this.client.apiHelper.editMessage(dmChannelId, state.controlsMessageId, done).catch(e => logger.warn('Could not update controls message:', e.message));
      }
    } catch (error) {
      logger.error('Failed to finish embed creator session:', error);
    } finally {
      this.states.delete(userId);
    }
    return { success: true };
  }

  async deletePreviewAndControls(userId, user) {
    const state = this.states.get(userId);
    if (!state) return { success: true };

    let dmChannelId;
    try {
      dmChannelId = await this._dmChannelId(userId, user);
    } catch {
      return { success: true };
    }

    try {
      if (state.previewMessageId) {
        await this.client.apiHelper.deleteMessage(dmChannelId, state.previewMessageId);
      }
      if (state.controlsMessageId) {
        await this.client.apiHelper.deleteMessage(dmChannelId, state.controlsMessageId);
      }
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete preview/controls messages:', error);
      return { success: false, error: error.message };
    }
  }

  /* ------------------------------------------------------------------ */
  /* Legacy (classic embed) helpers                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Helper to convert hex color string to decimal number
   * @param {string|number} hex
   * @returns {number}
   */
  _hexToDecimal(hex) {
    if (typeof hex === 'number') return hex;
    if (!hex || typeof hex !== 'string') return 0;
    return parseInt(hex.replace('#', ''), 16);
  }

  buildEmbed(userId) {
    const state = this.states.get(userId);
    if (!state) return null;

    const embedData = state.embed;
    const embed = new EmbedBuilder()
      .setColor(this._hexToDecimal(embedData.color));

    if (embedData.title) embed.setTitle(embedData.title);
    if (embedData.description) embed.setDescription(embedData.description);
    if (embedData.footer?.text) embed.setFooter({ text: embedData.footer.text });

    // Check for non-empty URL strings
    const hasImage = embedData.image?.url && embedData.image.url.trim().length > 0;
    const hasThumbnail = embedData.thumbnail?.url && embedData.thumbnail.url.trim().length > 0;

    if (hasImage) embed.setImage(embedData.image.url);
    if (hasThumbnail) embed.setThumbnail(embedData.thumbnail.url);
    if (embedData.timestamp) embed.setTimestamp();

    if (embedData.fields && embedData.fields.length > 0) {
      embed.addFields(embedData.fields);
    }

    // If embed is empty, add a placeholder
    if (!embedData.title && !embedData.description && (!embedData.fields || embedData.fields.length === 0) && !hasImage && !hasThumbnail) {
      embed.setDescription('*(Embed is currently empty)*');
    }

    return embed;
  }

  createComponents() {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('embed_creator_title').setLabel('Title').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('embed_creator_description').setLabel('Description').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('embed_creator_color').setLabel('Color').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('embed_creator_footer').setLabel('Footer').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('embed_creator_timestamp').setLabel('Timestamp').setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('embed_creator_field_add').setLabel('Add Field').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('embed_creator_field_remove').setLabel('Remove Last Field').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('embed_creator_image').setLabel('Image').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('embed_creator_thumbnail').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('embed_creator_send').setLabel('Send Embed').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('embed_creator_reset').setLabel('Reset').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('embed_creator_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );

    return [row1, row2, row3];
  }
}
