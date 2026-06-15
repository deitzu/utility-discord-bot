import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { createLogger } from '../utils/Logger.js';

const logger = createLogger('EmbedCreatorButtons');

async function updatePreview(interaction) {
  const userId = interaction.user.id;
  const state = interaction.client.embedCreatorManager.getOrCreateState(userId);
  const targetChannel = interaction.client.channels.cache.get(state.targetChannelId);

  await interaction.deferUpdate();
  await interaction.client.embedCreatorManager.updatePreview(userId);
  await interaction.client.embedCreatorManager.updateControls(userId, targetChannel || 'unknown channel');
}

const buttons = [
  {
    customId: 'embed_creator_title',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_title')
        .setTitle('Set Embed Title');

      const input = new TextInputBuilder()
        .setCustomId('title_input')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(state.embed.title || '');

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_description',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_description')
        .setTitle('Set Embed Description');

      const input = new TextInputBuilder()
        .setCustomId('description_input')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setValue(state.embed.description || '');

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_color',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_color')
        .setTitle('Set Embed Color');

      const input = new TextInputBuilder()
        .setCustomId('color_input')
        .setLabel('Color (Hex Code)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('#0099ff')
        .setValue(state.embed.color || '');

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_footer',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_footer')
        .setTitle('Set Embed Footer');

      const input = new TextInputBuilder()
        .setCustomId('footer_input')
        .setLabel('Footer Text')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(state.embed.footer?.text || '');

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_timestamp',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      state.embed.timestamp = !state.embed.timestamp;
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_textdisplay_add',
    async execute(interaction) {
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_textdisplay')
        .setTitle('Add Text Display');

      const input = new TextInputBuilder()
        .setCustomId('text_input')
        .setLabel('Content')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Enter markdown content...');

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_textdisplay_remove',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      if (state.v2.textDisplays.length > 0) {
        interaction.client.embedCreatorManager.removeTextDisplay(interaction.user.id);
        await updatePreview(interaction);
      } else {
        await interaction.reply({ content: 'No text displays to remove.', ephemeral: true });
      }
    }
  },
  {
    customId: 'embed_creator_separator_add',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      if (state.v2.textDisplays.length === 0) {
        return interaction.reply({ content: 'Add some text displays first before adding separators.', ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_separator')
        .setTitle('Add Separator');

      const input = new TextInputBuilder()
        .setCustomId('index_input')
        .setLabel(`After Text Index (0 to ${state.v2.textDisplays.length - 1})`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter the index number...');

      const spacingInput = new TextInputBuilder()
        .setCustomId('separator_spacing')
        .setLabel('Spacing (1=Small, 2=Large)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('1');

      const dividerInput = new TextInputBuilder()
        .setCustomId('separator_divider')
        .setLabel('Show Divider Line? (true/false)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('true');

      modal.addComponents(
        new ActionRowBuilder().addComponents(input),
        new ActionRowBuilder().addComponents(spacingInput),
        new ActionRowBuilder().addComponents(dividerInput)
      );
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_markdown_line',
    async execute(interaction) {
      interaction.client.embedCreatorManager.toggleMarkdownLine(interaction.user.id);
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_button_add',
    async execute(interaction) {
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_button')
        .setTitle('Add Button');

      const labelInput = new TextInputBuilder()
        .setCustomId('button_label')
        .setLabel('Button Label')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const idInput = new TextInputBuilder()
        .setCustomId('button_id')
        .setLabel('Button Custom ID (Optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('my_custom_id');

      const urlInput = new TextInputBuilder()
        .setCustomId('button_url')
        .setLabel('Button URL (Optional, for Link buttons)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('https://example.com');

      const styleInput = new TextInputBuilder()
        .setCustomId('button_style')
        .setLabel('Style 1-5: P/S/S/D/Link')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('1');

      const emojiInput = new TextInputBuilder()
        .setCustomId('button_emoji')
        .setLabel('Emoji (Optional, name:id:animated or 🎉)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('🎉 or name:id:animated');

      modal.addComponents(
        new ActionRowBuilder().addComponents(labelInput),
        new ActionRowBuilder().addComponents(idInput),
        new ActionRowBuilder().addComponents(urlInput),
        new ActionRowBuilder().addComponents(styleInput),
        new ActionRowBuilder().addComponents(emojiInput)
      );
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_section_add',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      if (state.v2.textDisplays.length === 0) {
        return interaction.reply({ content: 'Add some text displays first before adding sections.', ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_section')
        .setTitle('Add Section');

      const text1Input = new TextInputBuilder()
        .setCustomId('section_text1')
        .setLabel('Text Display 1 (Required)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('First text display content...');

      const text2Input = new TextInputBuilder()
        .setCustomId('section_text2')
        .setLabel('Text Display 2 (Optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder('Second text display content...');

      const text3Input = new TextInputBuilder()
        .setCustomId('section_text3')
        .setLabel('Text Display 3 (Optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder('Third text display content...');

      const accessoryInput = new TextInputBuilder()
        .setCustomId('section_accessory')
        .setLabel('Accessory Type (button / thumbnail / none)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('button');

      const accessoryLabelInput = new TextInputBuilder()
        .setCustomId('section_accessory_label')
        .setLabel('Accessory Label (for button)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('Click me');

      const accessoryUrlInput = new TextInputBuilder()
        .setCustomId('section_accessory_url')
        .setLabel('Accessory URL (for link button)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('https://example.com');

      const accessoryStyleInput = new TextInputBuilder()
        .setCustomId('section_accessory_style')
        .setLabel('Accessory Style (1-5, for button)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('1');

      const accessoryEmojiInput = new TextInputBuilder()
        .setCustomId('section_accessory_emoji')
        .setLabel('Accessory Emoji (name:id:animated or 🎉)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('🎉');

      const thumbnailUrlInput = new TextInputBuilder()
        .setCustomId('section_thumbnail_url')
        .setLabel('Thumbnail URL (for thumbnail accessory)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('https://example.com/image.png');

      const thumbnailDescInput = new TextInputBuilder()
        .setCustomId('section_thumbnail_desc')
        .setLabel('Thumbnail Description (Optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('Alt text');

      const thumbnailSizeInput = new TextInputBuilder()
        .setCustomId('section_thumbnail_size')
        .setLabel('Size: 40/64/80/100/128/256/512')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('64');

      modal.addComponents(
        new ActionRowBuilder().addComponents(text1Input),
        new ActionRowBuilder().addComponents(text2Input),
        new ActionRowBuilder().addComponents(text3Input),
        new ActionRowBuilder().addComponents(accessoryInput),
        new ActionRowBuilder().addComponents(accessoryLabelInput),
        new ActionRowBuilder().addComponents(accessoryUrlInput),
        new ActionRowBuilder().addComponents(accessoryStyleInput),
        new ActionRowBuilder().addComponents(accessoryEmojiInput),
        new ActionRowBuilder().addComponents(thumbnailUrlInput),
        new ActionRowBuilder().addComponents(thumbnailDescInput)
      );
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_section_remove',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      if (state.v2.sections.length > 0) {
        interaction.client.embedCreatorManager.removeSection(interaction.user.id);
        await updatePreview(interaction);
      } else {
        await interaction.reply({ content: 'No sections to remove.', ephemeral: true });
      }
    }
  },
  {
    customId: 'embed_creator_gallery_add',
    async execute(interaction) {
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_gallery')
        .setTitle('Add Media Gallery (3 images max)');

      // Row 1: Image 1 URL + Description 1
      const url1Input = new TextInputBuilder()
        .setCustomId('gallery_url1')
        .setLabel('Image 1 URL (Required)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('https://example.com/image1.png');

      const desc1Input = new TextInputBuilder()
        .setCustomId('gallery_desc1')
        .setLabel('Description 1 (Optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('Alt text for image 1');

      // Row 2: Spoiler 1 + Image 2 URL
      const spoiler1Input = new TextInputBuilder()
        .setCustomId('gallery_spoiler1')
        .setLabel('Spoiler 1? (true/false)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('false');

      const url2Input = new TextInputBuilder()
        .setCustomId('gallery_url2')
        .setLabel('Image 2 URL (Optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('https://example.com/image2.png');

      // Row 3: Image 2 Description + Spoiler + Image 3 URL
      const desc2Input = new TextInputBuilder()
        .setCustomId('gallery_desc2')
        .setLabel('Description 2 (Optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('Alt text for image 2');

      const spoiler2Input = new TextInputBuilder()
        .setCustomId('gallery_spoiler2')
        .setLabel('Spoiler 2? (true/false)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('false');

      const url3Input = new TextInputBuilder()
        .setCustomId('gallery_url3')
        .setLabel('Image 3 URL (Optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('https://example.com/image3.png');

      // Row 4: Image 3 Description + Spoiler
      const desc3Input = new TextInputBuilder()
        .setCustomId('gallery_desc3')
        .setLabel('Description 3 (Optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('Alt text for image 3');

      const spoiler3Input = new TextInputBuilder()
        .setCustomId('gallery_spoiler3')
        .setLabel('Spoiler 3? (true/false)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('false');

      modal.addComponents(
        new ActionRowBuilder().addComponents(url1Input, desc1Input),
        new ActionRowBuilder().addComponents(spoiler1Input, url2Input),
        new ActionRowBuilder().addComponents(desc2Input, spoiler2Input),
        new ActionRowBuilder().addComponents(url3Input, desc3Input),
        new ActionRowBuilder().addComponents(spoiler3Input)
      );
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_gallery_remove',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      if (state.v2.mediaGallery.length > 0) {
        interaction.client.embedCreatorManager.removeMediaGallery(interaction.user.id);
        await updatePreview(interaction);
      } else {
        await interaction.reply({ content: 'No media galleries to remove.', ephemeral: true });
      }
    }
  },
  {
    customId: 'embed_creator_file_add',
    async execute(interaction) {
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_file')
        .setTitle('Add File');

      const urlInput = new TextInputBuilder()
        .setCustomId('file_url')
        .setLabel('File URL (attachment:// or https://)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('attachment://file.pdf or https://example.com/file.pdf');

      const spoilerInput = new TextInputBuilder()
        .setCustomId('file_spoiler')
        .setLabel('Spoiler? (true/false)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('false');

      modal.addComponents(
        new ActionRowBuilder().addComponents(urlInput),
        new ActionRowBuilder().addComponents(spoilerInput)
      );
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_file_remove',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      if (state.v2.files.length > 0) {
        interaction.client.embedCreatorManager.removeFile(interaction.user.id);
        await updatePreview(interaction);
      } else {
        await interaction.reply({ content: 'No files to remove.', ephemeral: true });
      }
    }
  },
  {
    customId: 'embed_creator_field_add',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      if (state.embed.fields.length >= 25) {
        return interaction.reply({ content: 'You can only have up to 25 fields.', ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_field')
        .setTitle('Add Field');

      const nameInput = new TextInputBuilder()
        .setCustomId('field_name')
        .setLabel('Field Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const valueInput = new TextInputBuilder()
        .setCustomId('field_value')
        .setLabel('Field Value')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const inlineInput = new TextInputBuilder()
        .setCustomId('field_inline')
        .setLabel('Inline? (yes/no)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('no');

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(valueInput),
        new ActionRowBuilder().addComponents(inlineInput)
      );
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_field_remove',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      if (state.embed.fields.length > 0) {
        state.embed.fields.pop();
        await updatePreview(interaction);
      } else {
        await interaction.reply({ content: 'No fields to remove.', ephemeral: true });
      }
    }
  },
  {
    customId: 'embed_creator_image',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_image')
        .setTitle('Set Embed Image');

      const input = new TextInputBuilder()
        .setCustomId('image_input')
        .setLabel('Image URL')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(state.embed.image?.url || '');

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_thumbnail',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_thumbnail')
        .setTitle('Set Embed Thumbnail');

      const input = new TextInputBuilder()
        .setCustomId('thumbnail_input')
        .setLabel('Thumbnail URL')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(state.embed.thumbnail?.url || '');

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_send',
    async execute(interaction) {
      const userId = interaction.user.id;
      const state = interaction.client.embedCreatorManager.getOrCreateState(userId);
      const targetChannel = interaction.client.channels.cache.get(state.targetChannelId);

      if (!targetChannel) {
        return interaction.reply({ content: 'Could not find the target channel. It might have been deleted.', ephemeral: true });
      }

      const message = interaction.client.embedCreatorManager.buildMessage(userId);
      
      try {
        await targetChannel.send(message);
        await interaction.client.embedCreatorManager.deletePreviewAndControls(userId, interaction.user);
        interaction.client.embedCreatorManager.clearState(userId);
        await interaction.update({
          content: `✅ Message successfully sent to ${targetChannel}!`,
          embeds: [],
          components: []
        });
      } catch (error) {
        logger.error(`Error sending message to channel ${state.targetChannelId}:`, error);
        await interaction.reply({ content: 'Failed to send message to the channel. Make sure I have permission to send messages there.', ephemeral: true });
      }
    }
  },
  {
    customId: 'embed_creator_preview',
    async execute(interaction) {
      await interaction.deferUpdate();
      const userId = interaction.user.id;
      const finalMessage = interaction.client.embedCreatorManager.buildFinalMessage(userId);
      if (!finalMessage) {
        return interaction.followUp({ content: 'Failed to build preview message.', ephemeral: true });
      }
      try {
        await interaction.user.send(finalMessage);
        await interaction.followUp({ content: '✅ Preview sent to your DM!', ephemeral: true });
      } catch (error) {
        logger.error('Failed to send preview DM:', error);
        await interaction.followUp({ content: 'Failed to send preview. Make sure your DMs are open.', ephemeral: true });
      }
    }
  },
  {
    customId: 'embed_creator_reset',
    async execute(interaction) {
      const userId = interaction.user.id;
      logger.info('Reset button clicked', { userId, interactionId: interaction.id });
      try {
        await interaction.deferUpdate();
        interaction.client.embedCreatorManager.resetState(userId);
        const state = interaction.client.embedCreatorManager.getOrCreateState(userId);
        const targetChannel = interaction.client.channels.cache.get(state.targetChannelId);

        await interaction.client.embedCreatorManager.updatePreview(userId);
        await interaction.client.embedCreatorManager.updateControls(userId, targetChannel || 'unknown channel');
        logger.info('Reset completed successfully', { userId, interactionId: interaction.id });
      } catch (error) {
        logger.error('Reset failed', { userId: interaction.user.id, interactionId: interaction.id, error: error.stack });
      }
    }
  },
  {
    customId: 'embed_creator_cancel',
    async execute(interaction) {
      const userId = interaction.user.id;
      logger.info('Cancel button clicked', { userId, interactionId: interaction.id });
      try {
        await interaction.deferUpdate();
        interaction.client.embedCreatorManager.clearState(userId);
        await interaction.client.embedCreatorManager.deletePreviewAndControls(userId, interaction.user);
        logger.info('Cancel completed successfully', { userId, interactionId: interaction.id });
      } catch (error) {
        logger.error('Cancel failed', { userId: interaction.user.id, interactionId: interaction.id, error: error.stack });
      }
    }
  }
];

export default buttons;
