import { Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createLogger } from './Logger.js';
import { ComponentBuilder } from './ComponentBuilder.js';
import { getMessageStyle } from './ConfigLoader.js';

const logger = createLogger('EmbedCreatorManager');

export class EmbedCreatorManager {
  constructor(client, config) {
    this.client = client;
    this.config = config;
    this.states = new Collection();
  }

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
          textDisplays: [],
          buttons: [],
          separators: [],
          separatorOptions: new Map(),
          sections: [],
          mediaGallery: [],
          files: []
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

  updateState(userId, data) {
    const state = this.getOrCreateState(userId);
    Object.assign(state.embed, data);
    return state;
  }

  updateStateV2(userId, data) {
    const state = this.getOrCreateState(userId);
    Object.assign(state.v2, data);
    return state;
  }

  addTextDisplay(userId, content) {
    const state = this.getOrCreateState(userId);
    state.v2.textDisplays.push(content);
    return state;
  }

  removeTextDisplay(userId, index) {
    const state = this.getOrCreateState(userId);
    let removedIndex;
    if (index === undefined) {
      removedIndex = state.v2.textDisplays.length - 1;
      state.v2.textDisplays.pop();
    } else {
      removedIndex = index;
      state.v2.textDisplays.splice(index, 1);
    }

    // Update separators
    state.v2.separators = state.v2.separators
      .filter(i => i !== removedIndex) // Remove separator at the removed index
      .map(i => i > removedIndex ? i - 1 : i); // Shift down separators after the removed index
      
    return state;
  }

  addSeparator(userId, afterIndex, options = {}) {
    const state = this.getOrCreateState(userId);
    if (!state.v2.separators.includes(afterIndex)) {
      state.v2.separators.push(afterIndex);
      state.v2.separators.sort((a, b) => a - b);
    }
    const spacing = options.spacing === 2 ? 2 : 1;
    const divider = options.divider !== false;
    state.v2.separatorOptions.set(afterIndex, { spacing, divider });
    return state;
  }

  removeSeparator(userId, afterIndex) {
    const state = this.getOrCreateState(userId);
    state.v2.separators = state.v2.separators.filter(i => i !== afterIndex);
    state.v2.separatorOptions.delete(afterIndex);
    return state;
  }

  toggleMarkdownLine(userId) {
    const state = this.getOrCreateState(userId);
    // For backward compatibility or simple toggle of the last separator
    const lastIndex = state.v2.textDisplays.length - 1;
    if (state.v2.separators.includes(lastIndex)) {
      this.removeSeparator(userId, lastIndex);
    } else {
      this.addSeparator(userId, lastIndex);
    }
    return state;
  }

  addButton(userId, buttonData) {
    const state = this.getOrCreateState(userId);
    state.v2.buttons.push(buttonData);
    return state;
  }

  addSection(userId, sectionData) {
    const state = this.getOrCreateState(userId);
    state.v2.sections.push(sectionData);
    return state;
  }

  removeSection(userId, index) {
    const state = this.getOrCreateState(userId);
    if (index === undefined) {
      state.v2.sections.pop();
    } else {
      state.v2.sections.splice(index, 1);
    }
    return state;
  }

  addMediaGallery(userId, galleryData) {
    const state = this.getOrCreateState(userId);
    state.v2.mediaGallery.push(galleryData);
    return state;
  }

  removeMediaGallery(userId, index) {
    const state = this.getOrCreateState(userId);
    if (index === undefined) {
      state.v2.mediaGallery.pop();
    } else {
      state.v2.mediaGallery.splice(index, 1);
    }
    return state;
  }

  addFile(userId, fileData) {
    const state = this.getOrCreateState(userId);
    state.v2.files.push(fileData);
    return state;
  }

  removeFile(userId, index) {
    const state = this.getOrCreateState(userId);
    if (index === undefined) {
      state.v2.files.pop();
    } else {
      state.v2.files.splice(index, 1);
    }
    return state;
  }

  validateState(userId) {
    const state = this.states.get(userId);
    if (!state) return { valid: true, warnings: [], errors: [] };

    const warnings = [];
    const errors = [];

    // Count components
    let componentCount = 0;
    componentCount += state.v2.textDisplays.length; // TextDisplays
    componentCount += state.v2.buttons.length; // Buttons
    componentCount += state.v2.separators.length; // Separators
    componentCount += state.v2.sections.length; // Sections (each section counts as 1)
    componentCount += state.v2.mediaGallery.length; // MediaGalleries
    componentCount += state.v2.files.length; // Files
    
    // Action rows for buttons (5 per row)
    const actionRows = Math.ceil(state.v2.buttons.length / 5);
    componentCount += actionRows;
    
    // Section accessories (each counts as 1)
    componentCount += state.v2.sections.filter(s => s.accessory).length;

    if (componentCount > 40) {
      errors.push(`Component count (${componentCount}) exceeds Discord limit of 40`);
    } else if (componentCount > 35) {
      warnings.push(`Component count (${componentCount}) is close to Discord limit of 40`);
    }

    // Check text length (4000 chars total across all TextDisplays)
    let totalTextLength = 0;
    state.v2.textDisplays.forEach(t => { totalTextLength += t.length; });
    state.v2.sections.forEach(s => {
      s.textDisplays.forEach(t => { totalTextLength += t.length; });
    });
    if (state.embed.description) totalTextLength += state.embed.description.length;
    state.v2.buttons.forEach(b => { totalTextLength += b.label.length; });
    state.v2.sections.forEach(s => {
      if (s.accessory?.data?.label) totalTextLength += s.accessory.data.label.length;
    });
    state.v2.mediaGallery.forEach(g => {
      g.items.forEach(item => {
        if (item.description) totalTextLength += item.description.length;
      });
    });
    state.v2.files.forEach(f => { totalTextLength += f.url.length; });

    if (totalTextLength > 4000) {
      errors.push(`Total text length (${totalTextLength}) exceeds Discord limit of 4000 characters`);
    } else if (totalTextLength > 3500) {
      warnings.push(`Total text length (${totalTextLength}) is close to Discord limit of 4000 characters`);
    }

    return { valid: errors.length === 0, warnings, errors };
  }

  resetState(userId) {
    const state = this.states.get(userId);
    if (state) {
      const targetChannelId = state.targetChannelId;
      this.states.delete(userId);
      return this.getOrCreateState(userId, targetChannelId);
    }
    return this.getOrCreateState(userId);
  }

  clearState(userId) {
    this.states.delete(userId);
  }

  buildPreviewMessage(userId) {
    const style = getMessageStyle(this.config, 'embedCreator');
    const state = this.states.get(userId);
    if (!state || style !== 'v2') return null;

    const textDisplays = state.v2.textDisplays.length > 0 ? state.v2.textDisplays : ['*(No Content)*'];

    // Convert sections to ComponentBuilder sections
    const sections = state.v2.sections.map(s => {
      if (s.accessory?.type === 'button' && s.accessory.data) {
        const btn = s.accessory.data;
        const button = ComponentBuilder.createButton({
          label: btn.label,
          customId: btn.url ? undefined : (btn.customId || `v2_btn_${Math.random().toString(36).substr(2, 9)}`),
          style: btn.style || ButtonStyle.Primary,
          url: btn.url,
          emoji: btn.emoji
        });
        return ComponentBuilder.createSectionWithButtonAccessory(s.textDisplays, button);
      } else if (s.accessory?.type === 'thumbnail' && s.accessory.data) {
        const thumb = s.accessory.data;
        const thumbnail = ComponentBuilder.createThumbnail({
          src: thumb.url,
          description: thumb.description,
          size: thumb.size
        });
        return ComponentBuilder.createSectionWithThumbnailAccessory(s.textDisplays, thumbnail);
      } else {
        // Section without accessory - just text displays
        return ComponentBuilder.createSection({
          components: s.textDisplays.map(t => ComponentBuilder.createTextDisplay(t))
        });
      }
    });

    const separatorWithOptions = state.v2.separators.map(index => {
      const options = state.v2.separatorOptions.get(index);
      if (options) {
        return { index, spacing: options.spacing, divider: options.divider };
      }
      return index;
    });

    const embedDescription = state.embed.description?.trim() || undefined;
    const embedImage = state.embed.image?.url?.trim() || undefined;
    
    return ComponentBuilder.buildV2Message({
      textDisplays,
      buttons: state.v2.buttons.map(b => ComponentBuilder.createButton({
        label: b.label,
        customId: b.url ? undefined : (b.customId || `v2_btn_${Math.random().toString(36).substr(2, 9)}`),
        style: b.style || ButtonStyle.Primary,
        url: b.url,
        emoji: b.emoji
      })),
      separator: separatorWithOptions,
      sections,
      mediaGallery: state.v2.mediaGallery.map(g => ComponentBuilder.createMediaGallery({ items: g.items })),
      files: state.v2.files.map(f => ComponentBuilder.createFile({ file: f.url, spoiler: f.spoiler })),
      description: embedDescription,
      accentColor: this._hexToDecimal(state.embed.color)
    });
  }

  buildFinalMessage(userId) {
    const style = getMessageStyle(this.config, 'embedCreator');
    const state = this.states.get(userId);
    if (!state || style !== 'v2') return null;

    const textDisplays = state.v2.textDisplays.length > 0 ? state.v2.textDisplays : ['*(No Content)*'];

    // Convert sections to ComponentBuilder sections
    const sections = state.v2.sections.map(s => {
      if (s.accessory?.type === 'button' && s.accessory.data) {
        const btn = s.accessory.data;
        const button = ComponentBuilder.createButton({
          label: btn.label,
          customId: btn.url ? undefined : (btn.customId || `v2_btn_${Math.random().toString(36).substr(2, 9)}`),
          style: btn.style || ButtonStyle.Primary,
          url: btn.url,
          emoji: btn.emoji
        });
        return ComponentBuilder.createSectionWithButtonAccessory(s.textDisplays, button);
      } else if (s.accessory?.type === 'thumbnail' && s.accessory.data) {
        const thumb = s.accessory.data;
        const thumbnail = ComponentBuilder.createThumbnail({
          src: thumb.url,
          description: thumb.description,
          size: thumb.size
        });
        return ComponentBuilder.createSectionWithThumbnailAccessory(s.textDisplays, thumbnail);
      } else {
        // Section without accessory - just text displays
        return ComponentBuilder.createSection({
          components: s.textDisplays.map(t => ComponentBuilder.createTextDisplay(t))
        });
      }
    });

    const separatorWithOptions = state.v2.separators.map(index => {
      const options = state.v2.separatorOptions.get(index);
      if (options) {
        return { index, spacing: options.spacing, divider: options.divider };
      }
      return index;
    });

    const embedDescription = state.embed.description?.trim() || undefined;
    
    return ComponentBuilder.buildV2Message({
      textDisplays,
      buttons: state.v2.buttons.map(b => ComponentBuilder.createButton({
        label: b.label,
        customId: b.url ? undefined : (b.customId || `v2_btn_${Math.random().toString(36).substr(2, 9)}`),
        style: b.style || ButtonStyle.Primary,
        url: b.url,
        emoji: b.emoji
      })),
      separator: separatorWithOptions,
      sections,
      mediaGallery: state.v2.mediaGallery.map(g => ComponentBuilder.createMediaGallery({ items: g.items })),
      files: state.v2.files.map(f => ComponentBuilder.createFile({ file: f.url, spoiler: f.spoiler })),
      description: embedDescription,
      accentColor: this._hexToDecimal(state.embed.color)
    });
  }

  buildControlsMessage(userId, targetChannel) {
    const style = getMessageStyle(this.config, 'embedCreator');
    const state = this.states.get(userId);
    if (!state || style !== 'v2') return null;

    const validation = this.validateState(userId);
    let warningText = '';
    if (validation.warnings.length > 0 || validation.errors.length > 0) {
      warningText = '\n\n**⚠️ Validation:**';
      validation.warnings.forEach(w => { warningText += `\n⚠ ${w}`; });
      validation.errors.forEach(e => { warningText += `\n❌ ${e}`; });
    }

    const sepCount = state.v2.separators?.length || 0;
    let separatorList = '';
    if (sepCount > 0) {
      separatorList = `\n**Separators after indices:** ${state.v2.separators.join(', ')}`;
    }

    const row1a = ComponentBuilder.createActionRow([
      ComponentBuilder.createButton({ customId: 'embed_creator_textdisplay_add', label: 'Add Text', style: ButtonStyle.Secondary }),
      ComponentBuilder.createButton({ customId: 'embed_creator_textdisplay_remove', label: 'Remove Last', style: ButtonStyle.Secondary }),
      ComponentBuilder.createButton({ customId: 'embed_creator_separator_add', label: 'Add Separator', style: ButtonStyle.Secondary }),
      ComponentBuilder.createButton({ customId: 'embed_creator_markdown_line', label: `Seps (${sepCount})`, style: ButtonStyle.Secondary })
    ]);

    const row1b = ComponentBuilder.createActionRow([
      ComponentBuilder.createButton({ customId: 'embed_creator_button_add', label: 'Add Button', style: ButtonStyle.Secondary }),
      ComponentBuilder.createButton({ customId: 'embed_creator_section_add', label: 'Add Section', style: ButtonStyle.Secondary }),
      ComponentBuilder.createButton({ customId: 'embed_creator_section_remove', label: 'Remove Section', style: ButtonStyle.Secondary })
    ]);

    const row2 = ComponentBuilder.createActionRow([
      ComponentBuilder.createButton({ customId: 'embed_creator_gallery_add', label: 'Add Gallery', style: ButtonStyle.Secondary }),
      ComponentBuilder.createButton({ customId: 'embed_creator_gallery_remove', label: 'Remove Gallery', style: ButtonStyle.Secondary }),
      ComponentBuilder.createButton({ customId: 'embed_creator_file_add', label: 'Add File', style: ButtonStyle.Secondary }),
      ComponentBuilder.createButton({ customId: 'embed_creator_file_remove', label: 'Remove File', style: ButtonStyle.Secondary })
    ]);

    const row3 = ComponentBuilder.createActionRow([
      ComponentBuilder.createButton({ customId: 'embed_creator_preview', label: 'Preview', style: ButtonStyle.Primary }),
      ComponentBuilder.createButton({ customId: 'embed_creator_send', label: 'Send Message', style: ButtonStyle.Success }),
      ComponentBuilder.createButton({ customId: 'embed_creator_reset', label: 'Reset', style: ButtonStyle.Danger }),
      ComponentBuilder.createButton({ customId: 'embed_creator_cancel', label: 'Cancel', style: ButtonStyle.Danger })
    ]);

    return ComponentBuilder.buildV2Message({
      textDisplays: [
        `### Embed Creator\nYou are creating a message for ${targetChannel || 'unknown channel'}.\nUse the buttons below to customize your message.${separatorList}${warningText}`
      ],
      components: [row1a, row1b, row2, row3],
      accentColor: this._hexToDecimal(state.embed.color)
    });
  }

  async sendPreviewAndControls(userId, targetChannel, user) {
    const previewMessage = this.buildPreviewMessage(userId);
    const controlsMessage = this.buildControlsMessage(userId, targetChannel);
    
    if (!previewMessage || !controlsMessage) {
      return { success: false, error: 'Failed to build V2 messages' };
    }

    try {
      const dmChannel = user.dmChannel || await user.createDM();
      
      const previewMsg = await dmChannel.send(previewMessage);
      
      const controlsMsg = await dmChannel.send(controlsMessage);

      const state = this.states.get(userId);
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
      const dmChannel = this.client.users.cache.get(userId)?.dmChannel || await this.client.users.fetch(userId).then(u => u.createDM());
      
      await this.client.apiHelper.editMessage(dmChannel.id, state.previewMessageId, previewMessage);
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
      const dmChannel = this.client.users.cache.get(userId)?.dmChannel || await this.client.users.fetch(userId).then(u => u.createDM());
      
      await this.client.apiHelper.editMessage(dmChannel.id, state.controlsMessageId, controlsMessage);
      return { success: true };
    } catch (error) {
      logger.error('Failed to update controls message:', error);
      return { success: false, error: error.message };
    }
  }

  async deletePreviewAndControls(userId, user) {
    const state = this.states.get(userId);
    if (!state) return { success: true };

    const dmChannel = user?.dmChannel || (this.client.users.cache.get(userId)?.dmChannel) || await this.client.users.fetch(userId).then(u => u.createDM()).catch(() => null);
    
    if (!dmChannel) return { success: true };

    try {
      if (state.previewMessageId) {
        await this.client.apiHelper.deleteMessage(dmChannel.id, state.previewMessageId);
      }
      if (state.controlsMessageId) {
        await this.client.apiHelper.deleteMessage(dmChannel.id, state.controlsMessageId);
      }
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete preview/controls messages:', error);
      return { success: false, error: error.message };
    }
  }

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

  buildMessage(userId) {
    const style = getMessageStyle(this.config, 'embedCreator');
    const state = this.states.get(userId);
    if (!state) return null;

    let message;
    if (style === 'v2') {
      const textDisplays = state.v2.textDisplays.length > 0 ? state.v2.textDisplays : ['*(No Content)*'];

      message = ComponentBuilder.buildV2Message({
        textDisplays,
        buttons: state.v2.buttons.map(b => ComponentBuilder.createButton({
          label: b.label,
          customId: b.url ? undefined : (b.customId || `v2_btn_${Math.random().toString(36).substr(2, 9)}`),
          style: b.style || ButtonStyle.Primary,
          url: b.url
        })),
        separator: state.v2.separators,
        accentColor: this._hexToDecimal(state.embed.color)
      });
    } else {
      message = { embeds: [this.buildEmbed(userId)] };
    }

    return message;
  }

  createComponents(style = 'embed', state = null) {
    if (style === 'v2') {
      const sepCount = state?.v2?.separators?.length || 0;
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('embed_creator_textdisplay_add').setLabel('Add Text').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('embed_creator_textdisplay_remove').setLabel('Remove Last').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('embed_creator_separator_add').setLabel('Add Separator').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('embed_creator_markdown_line').setLabel(`Seps (${sepCount})`).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('embed_creator_button_add').setLabel('Add Button').setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('embed_creator_send').setLabel('Send Message').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('embed_creator_reset').setLabel('Reset').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('embed_creator_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
      );

      return [row1, row2];
    }

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
