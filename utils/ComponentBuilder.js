
export const ComponentType = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  TextInput: 4,
  UserSelect: 5,
  RoleSelect: 6,
  MentionableSelect: 7,
  ChannelSelect: 8,
  Section: 9,
  TextDisplay: 10,
  Thumbnail: 11,
  MediaGallery: 12,
  File: 13,
  Separator: 14,
  Form: 15,
  Inputs: 16,
  Container: 17,
  Label: 18,
  FileUpload: 19,
  RadioGroup: 21,
  CheckboxGroup: 22,
  Checkbox: 23,
};

export class ComponentBuilder {
  static createContainer({ description, components = [], accentColor = null, spoiler = false, id = null }) {
    const container = {
      type: ComponentType.Container,
      components: components,
    };

    if (description) container.description = description;
    if (accentColor) container.accent_color = accentColor;
    if (spoiler) container.spoiler = true;
    if (id !== null) container.id = id;

    return container;
  }

  static createSection({ components = [], accessory = null, id = null }) {
    const section = {
      type: ComponentType.Section,
      components: components,
    };

    if (accessory) section.accessory = accessory;
    if (id !== null) section.id = id;

    return section;
  }

  static createSectionWithButtonAccessory(textDisplays, button, id = null) {
    return this.createSection({
      components: textDisplays.map(t => this.createTextDisplay(t)),
      accessory: button,
      id
    });
  }

  static createSectionWithThumbnailAccessory(textDisplays, thumbnail, id = null) {
    return this.createSection({
      components: textDisplays.map(t => this.createTextDisplay(t)),
      accessory: thumbnail,
      id
    });
  }

  static createTextDisplay(content, id = null) {
    return {
      type: ComponentType.TextDisplay,
      content: content,
      ...(id !== null && { id })
    };
  }

  static createLabel(content, description = null, component = null, id = null) {
    const label = {
      type: ComponentType.Label,
      content: content,
    };

    if (description) label.description = description;
    if (component) label.component = component;
    if (id !== null) label.id = id;

    return label;
  }

  static createSeparator({ spacing = 1, divider = true, id = null } = {}) {
    const separator = {
      type: ComponentType.Separator,
    };

    if (spacing === 1 || spacing === 2) separator.spacing = spacing;
    if (divider === false) separator.divider = false;
    if (id !== null) separator.id = id;

    return separator;
  }

  static createActionRow(components = [], id = null) {
    const row = {
      type: ComponentType.ActionRow,
      components: components,
    };

    if (id !== null) row.id = id;

    return row;
  }

  static createButton({ customId, label, style, emoji, url, disabled, id = null }) {
    const button = {
      type: ComponentType.Button,
      style: style,
      label: label,
      disabled: disabled,
    };

    if (customId) button.custom_id = customId;
    if (emoji) button.emoji = emoji;
    if (url) button.url = url;
    if (id !== null) button.id = id;

    return button;
  }

  static createThumbnail({ src, description = null, spoiler = false, size = null, id = null }) {
    const thumbnail = {
      type: ComponentType.Thumbnail,
      media: { url: src },
    };

    if (description) thumbnail.description = description;
    if (spoiler) thumbnail.spoiler = true;
    if (size) thumbnail.size = size;
    if (id !== null) thumbnail.id = id;

    return thumbnail;
  }

  static createMediaGallery({ items = [], id = null }) {
    const gallery = {
      type: ComponentType.MediaGallery,
      items: items.map(item => {
        const mediaItem = { media: item.media };
        if (item.description) mediaItem.description = item.description;
        if (item.spoiler) mediaItem.spoiler = true;
        return mediaItem;
      }),
    };
    if (id !== null) gallery.id = id;
    return gallery;
  }

  static createFile({ file, spoiler = false, id = null }) {
    const fileComp = {
      type: ComponentType.File,
      file: file,
    };
    if (spoiler) fileComp.spoiler = true;
    if (id !== null) fileComp.id = id;
    return fileComp;
  }

  static buildV2Message({ titleTextDisplay, description, markdownContent, textDisplays = [], buttons = [], separator = false, components = [], sections = [], accentColor = 0x5865F2 }) {
    const containerComponents = [];
    
    const separatorIndices = Array.isArray(separator) ? separator : null;
    const isSeparatorEnabled = separator === true;

    if (titleTextDisplay) {
      containerComponents.push(this.createTextDisplay("# " + titleTextDisplay));
    }

    if (Array.isArray(textDisplays)) {
      textDisplays.forEach((text, index) => {
        if (text) {
          containerComponents.push(this.createTextDisplay(text));
          if (separatorIndices && separatorIndices.includes(index)) {
            const sep = Array.isArray(separator) ? separator.find(s => s.index === index || (typeof s === 'number' && s === index)) : null;
            containerComponents.push(this.createSeparator(sep ? { spacing: sep.spacing, divider: sep.divider } : {}));
          }
        }
      });
    }

    if (markdownContent) {
      containerComponents.push(this.createTextDisplay(markdownContent));
    }

    const hasTitle = titleTextDisplay || markdownContent || (textDisplays.length > 0 && (separatorIndices === null || !separatorIndices.includes(textDisplays.length - 1)));
    const hasContent = description || components.length > 0 || buttons.length > 0 || sections.length > 0;
    if (isSeparatorEnabled || (separatorIndices === null && hasTitle && hasContent)) {
      containerComponents.push(this.createSeparator());
    }

    if (description) {
      containerComponents.push(this.createTextDisplay(description));
    }

    if (Array.isArray(sections)) {
      sections.forEach(section => {
        containerComponents.push(section);
      });
    }

    const allButtons = [...buttons];
    const otherComponents = [];

    if (Array.isArray(components)) {
      components.forEach(comp => {
        if (comp.type === ComponentType.Button) {
          allButtons.push(comp);
        } else {
          otherComponents.push(comp);
        }
      });
    }

    otherComponents.forEach(comp => containerComponents.push(comp));

    if (allButtons.length > 0) {
      for (let i = 0; i < allButtons.length; i += 5) {
        containerComponents.push(this.createActionRow(allButtons.slice(i, i + 5)));
      }
    }

    const container = this.createContainer({
      accentColor: accentColor,
      components: containerComponents
    });

    return {
      flags: 32768,
      components: [container]
    };
  }
}