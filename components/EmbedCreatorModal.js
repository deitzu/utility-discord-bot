import { createLogger } from '../utils/Logger.js';

const logger = createLogger('EmbedCreatorModal');

async function updatePreview(interaction) {
  const userId = interaction.user.id;
  await interaction.deferUpdate();
  await interaction.client.embedCreatorManager.updatePreview(userId);
}

const modals = [
  {
    customId: 'embed_creator_modal_title',
    async execute(interaction) {
      const title = interaction.fields.getTextInputValue('title_input');
      interaction.client.embedCreatorManager.updateState(interaction.user.id, { title });
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_description',
    async execute(interaction) {
      const description = interaction.fields.getTextInputValue('description_input');
      interaction.client.embedCreatorManager.updateState(interaction.user.id, { description });
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_color',
    async execute(interaction) {
      let color = interaction.fields.getTextInputValue('color_input');
      if (color && !color.startsWith('#')) color = '#' + color;
      
      // Simple hex validation
      if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
        return interaction.reply({ content: 'Invalid hex color format. Use something like #0099ff', ephemeral: true });
      }

      interaction.client.embedCreatorManager.updateState(interaction.user.id, { color: color || undefined });
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_footer',
    async execute(interaction) {
      const text = interaction.fields.getTextInputValue('footer_input');
      interaction.client.embedCreatorManager.updateState(interaction.user.id, { footer: { text } });
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_field',
    async execute(interaction) {
      const name = interaction.fields.getTextInputValue('field_name');
      const value = interaction.fields.getTextInputValue('field_value');
      const inline = interaction.fields.getTextInputValue('field_inline').toLowerCase() === 'yes';
      
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      state.embed.fields.push({ name, value, inline });
      
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_image',
    async execute(interaction) {
      const url = interaction.fields.getTextInputValue('image_input');
      interaction.client.embedCreatorManager.updateState(interaction.user.id, { image: { url } });
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_thumbnail',
    async execute(interaction) {
      const url = interaction.fields.getTextInputValue('thumbnail_input');
      interaction.client.embedCreatorManager.updateState(interaction.user.id, { thumbnail: { url } });
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_textdisplay',
    async execute(interaction) {
      const content = interaction.fields.getTextInputValue('text_input');
      interaction.client.embedCreatorManager.addTextDisplay(interaction.user.id, content);
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_separator',
    async execute(interaction) {
      const indexStr = interaction.fields.getTextInputValue('index_input');
      const index = parseInt(indexStr);
      const spacingStr = interaction.fields.getTextInputValue('separator_spacing');
      const dividerStr = interaction.fields.getTextInputValue('separator_divider');
      
      if (isNaN(index)) {
        return interaction.reply({ content: 'Please enter a valid number for the index.', ephemeral: true });
      }

      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      if (index < 0 || index >= state.v2.textDisplays.length) {
        return interaction.reply({ content: `Invalid index. Please enter a number between 0 and ${state.v2.textDisplays.length - 1}.`, ephemeral: true });
      }

      const spacing = spacingStr ? parseInt(spacingStr) : 1;
      const divider = dividerStr !== 'false';

      if (state.v2.separators.includes(index)) {
        interaction.client.embedCreatorManager.removeSeparator(interaction.user.id, index);
      } else {
        interaction.client.embedCreatorManager.addSeparator(interaction.user.id, index, { spacing, divider });
      }
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_button',
    async execute(interaction) {
      const label = interaction.fields.getTextInputValue('button_label');
      const customId = interaction.fields.getTextInputValue('button_id');
      const url = interaction.fields.getTextInputValue('button_url');
      const styleStr = interaction.fields.getTextInputValue('button_style');
      const emojiStr = interaction.fields.getTextInputValue('button_emoji');
      
      const style = styleStr ? parseInt(styleStr) : undefined;
      let emoji = undefined;
      if (emojiStr) {
        if (emojiStr.includes(':')) {
          const parts = emojiStr.split(':');
          emoji = { name: parts[0], id: parts[1] ? parts[1] : undefined, animated: parts[2] === 'true' };
        } else {
          emoji = { name: emojiStr };
        }
      }
      
      interaction.client.embedCreatorManager.addButton(interaction.user.id, { 
        label, 
        customId: customId || undefined, 
        url: url || undefined, 
        style: style || undefined, 
        emoji: emoji 
      });
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_section',
    async execute(interaction) {
      const text1 = interaction.fields.getTextInputValue('section_text1');
      const text2 = interaction.fields.getTextInputValue('section_text2');
      const text3 = interaction.fields.getTextInputValue('section_text3');
      const accessoryType = interaction.fields.getTextInputValue('section_accessory') || 'none';
      
      const textDisplays = [text1];
      if (text2) textDisplays.push(text2);
      if (text3) textDisplays.push(text3);
      
      let accessory = null;
      if (accessoryType === 'button') {
        const label = interaction.fields.getTextInputValue('section_accessory_label');
        const url = interaction.fields.getTextInputValue('section_accessory_url');
        const styleStr = interaction.fields.getTextInputValue('section_accessory_style');
        const emojiStr = interaction.fields.getTextInputValue('section_accessory_emoji');
        
        if (label) {
          const style = styleStr ? parseInt(styleStr) : undefined;
          let emoji = undefined;
          if (emojiStr) {
            if (emojiStr.includes(':')) {
              const parts = emojiStr.split(':');
              emoji = { name: parts[0], id: parts[1] ? parts[1] : undefined, animated: parts[2] === 'true' };
            } else {
              emoji = { name: emojiStr };
            }
          }
          accessory = { type: 'button', data: { label, url: url || undefined, style: style || undefined, emoji: emoji } };
        }
      } else if (accessoryType === 'thumbnail') {
        const url = interaction.fields.getTextInputValue('section_thumbnail_url');
        const description = interaction.fields.getTextInputValue('section_thumbnail_desc');
        const sizeStr = interaction.fields.getTextInputValue('section_thumbnail_size');
        const size = sizeStr ? parseInt(sizeStr) : undefined;
        const validSizes = [40, 64, 80, 100, 128, 256, 512];
        const thumbnailSize = (size && validSizes.includes(size)) ? size : undefined;
        if (url) {
          accessory = { type: 'thumbnail', data: { url, description: description || undefined, size: thumbnailSize } };
        }
      }
      
      const sectionData = { textDisplays, accessory };
      interaction.client.embedCreatorManager.addSection(interaction.user.id, sectionData);
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_gallery',
    async execute(interaction) {
      const items = [];

      // Image 1: url1 + desc1
      const url1 = interaction.fields.getTextInputValue('gallery_url1');
      const desc1 = interaction.fields.getTextInputValue('gallery_desc1');
      const spoiler1 = interaction.fields.getTextInputValue('gallery_spoiler1');
      if (url1) {
        items.push({ media: { url: url1 }, description: desc1 || undefined, spoiler: spoiler1 === 'true' });
      }

      // Image 2: spoiler1 + url2
      const url2 = interaction.fields.getTextInputValue('gallery_url2');
      const desc2 = interaction.fields.getTextInputValue('gallery_desc2');
      const spoiler2 = interaction.fields.getTextInputValue('gallery_spoiler2');
      if (url2) {
        items.push({ media: { url: url2 }, description: desc2 || undefined, spoiler: spoiler2 === 'true' });
      }

      // Image 3: desc2 + spoiler2 + url3
      const url3 = interaction.fields.getTextInputValue('gallery_url3');
      const desc3 = interaction.fields.getTextInputValue('gallery_desc3');
      const spoiler3 = interaction.fields.getTextInputValue('gallery_spoiler3');
      if (url3) {
        items.push({ media: { url: url3 }, description: desc3 || undefined, spoiler: spoiler3 === 'true' });
      }

      // Image 4: desc3 + spoiler3 + url4
      const url4 = interaction.fields.getTextInputValue('gallery_url4');
      const desc4 = interaction.fields.getTextInputValue('gallery_desc4');
      const spoiler4 = interaction.fields.getTextInputValue('gallery_spoiler4');
      if (url4) {
        items.push({ media: { url: url4 }, description: desc4 || undefined, spoiler: spoiler4 === 'true' });
      }

      // Image 5: desc4 + spoiler4 + url5 + desc5 + spoiler5
      const url5 = interaction.fields.getTextInputValue('gallery_url5');
      const desc5 = interaction.fields.getTextInputValue('gallery_desc5');
      const spoiler5 = interaction.fields.getTextInputValue('gallery_spoiler5');
      if (url5) {
        items.push({ media: { url: url5 }, description: desc5 || undefined, spoiler: spoiler5 === 'true' });
      }

      if (items.length > 0) {
        interaction.client.embedCreatorManager.addMediaGallery(interaction.user.id, { items });
      }
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_file',
    async execute(interaction) {
      const url = interaction.fields.getTextInputValue('file_url');
      const spoilerStr = interaction.fields.getTextInputValue('file_spoiler');

      if (url) {
        interaction.client.embedCreatorManager.addFile(interaction.user.id, { 
          url, 
          spoiler: spoilerStr === 'true' 
        });
      }
      await updatePreview(interaction);
    }
  }
];

export default modals;
