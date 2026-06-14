# Discord Components v2 & Layout Components

Discord Components v2 (IS_COMPONENTS_V2 flag = 32768) introduce new layout components like Containers, Sections, Text Displays, and Separators. These allow for richer message formatting beyond traditional embeds. Since `discord.js` v14 doesn't fully support these yet, we use a raw API helper and a custom `ComponentBuilder` to send these components.

## Core Concepts

### IS_COMPONENTS_V2 Flag
To use v2 components, the message payload must include the `flags` field set to `32768` (1 << 15). This tells Discord to process the new component types.

**Important**: When using v2 components, the following legacy fields are NOT ALLOWED:
- `content` - replaced by TextDisplay
- `embeds` - replaced by Container + TextDisplay
- `poll` - disabled
- `stickers` - disabled

### Component Types

| Type | Name | Usage | Description |
|------|------|-------|-------------|
| 1 | ActionRow | Message | Container for up to 5 interactive components (Buttons, Select Menus) |
| 2 | Button | Message | Clickable button with label, style, and custom_id OR url |
| 3 | StringSelect | Message, Modal | Select menu for picking from defined text options |
| 4 | TextInput | Modal | Single-line or multi-line text input field |
| 5 | UserSelect | Message, Modal | Select menu for users |
| 6 | RoleSelect | Message, Modal | Select menu for roles |
| 7 | MentionableSelect | Message, Modal | Select menu for users and roles |
| 8 | ChannelSelect | Message, Modal | Select menu for channels |
| 9 | Section | Message | Container for 1-3 TextDisplay components with optional accessory (Button or Thumbnail) |
| 10 | TextDisplay | Message, Modal | Markdown-formatted text (max 4000 chars total across all TextDisplays) |
| 11 | Thumbnail | Message | Small image usable ONLY as Section accessory |
| 12 | MediaGallery | Message | Grid of up to 10 media items (images/videos) |
| 13 | File | Message | Display an attached file |
| 14 | Separator | Message | Vertical padding with optional visual divider between components |
| 15 | Form | Modal | Structured form container |
| 16 | Inputs | Modal | Group of input fields |
| 17 | Container | Message | Top-level component wrapping all layout components. Supports accent_color, description, spoiler |
| 18 | Label | Modal | Associates label/description with a component (wraps TextInput, Selects) |
| 19 | FileUpload | Modal | File upload component |
| 21 | RadioGroup | Modal | Single-choice set of options |
| 22 | CheckboxGroup | Modal | Multi-selectable checkboxes |
| 23 | Checkbox | Modal | Single yes/no checkbox |

**Key distinction**: Types 15-19, 21-23 are **MODAL-ONLY**. Types 1-14 are usable in MESSAGES (with v2 flag).

### Component ID Field
All components accept an optional `id` field (32-bit integer) used to identify components in interaction responses. Must be unique within the message. Discord auto-assigns sequential IDs starting from 1 if omitted. ID `0` is treated as empty and replaced.

## DiscordApiHelper
The `DiscordApiHelper` provides direct access to Discord's REST API using `fetch()` to send payloads that `discord.js` might not yet support.

### Usage
```javascript
const payload = ComponentBuilder.buildV2Message({
  titleTextDisplay: 'My V2 Message',
  description: 'This uses a Container component!',
  accentColor: 0x5865F2
});

await client.apiHelper.sendMessage(channelId, payload);
```

## ComponentBuilder V2
The `ComponentBuilder` utility makes it easy to construct these complex nested objects.

### Container
```javascript
const container = ComponentBuilder.createContainer({
  accentColor: 0x5865F2,       // Optional: accent color (decimal)
  description: 'Alt text',     // Optional: accessibility description
  spoiler: false,              // Optional: blur content (default false)
  components: [
    ComponentBuilder.createTextDisplay('# This is a Title')
  ],
  id: 1                        // Optional: component identifier
});
```

### TextDisplay
```javascript
ComponentBuilder.createTextDisplay('**Bold** and *italic* text with [links](url)', 1);
```

### Separator
```javascript
// spacing: 1 (small, default) or 2 (large)
// divider: true (show line, default) or false (only spacing)
ComponentBuilder.createSeparator({ spacing: 2, divider: true, id: 2 });
```

### Button
```javascript
// Interactive button (styles 1-4)
ComponentBuilder.createButton({
  customId: 'my_button',      // Required for styles 1-4
  label: 'Click Me',
  style: 1,                   // 1=Primary, 2=Secondary, 3=Success, 4=Danger
  emoji: { name: '👍' },
  disabled: false,
  id: 3
});

// Link button (style 5)
ComponentBuilder.createButton({
  url: 'https://discord.com', // Required for style 5
  label: 'Visit Discord',
  style: 5,
  id: 4
});
```

### ActionRow
```javascript
ComponentBuilder.createActionRow([
  ComponentBuilder.createButton({ customId: 'btn1', label: 'One', style: 1 }),
  ComponentBuilder.createButton({ customId: 'btn2', label: 'Two', style: 2 })
], 5);
```

### Section with Button Accessory
```javascript
const section = ComponentBuilder.createSection({
  components: [
    ComponentBuilder.createTextDisplay('First line'),
    ComponentBuilder.createTextDisplay('Second line'),
    ComponentBuilder.createTextDisplay('Third line (max 3)')
  ],
  accessory: ComponentBuilder.createButton({
    customId: 'section_btn',
    label: 'Action',
    style: 1
  }),
  id: 6
});

const container = ComponentBuilder.createContainer({ components: [section] });
```

### Section with Thumbnail Accessory
```javascript
const section = ComponentBuilder.createSection({
  components: [
    ComponentBuilder.createTextDisplay('Image description'),
    ComponentBuilder.createTextDisplay('More details here')
  ],
  accessory: ComponentBuilder.createThumbnail({
    src: 'https://example.com/image.png',
    description: 'Alt text for accessibility',
    spoiler: false,
    size: 64
  }),
  id: 7
});

const container = ComponentBuilder.createContainer({ components: [section] });
```

### Thumbnail (standalone - use in Section accessory)
```javascript
ComponentBuilder.createThumbnail({
  src: 'https://example.com/image.png',
  description: 'Alt text',
  spoiler: false,
  size: 64,
  id: 8
});
```

### MediaGallery
```javascript
const gallery = ComponentBuilder.createMediaGallery({
  items: [
    {
      media: { url: 'https://example.com/img1.png' },
      description: 'First image',
      spoiler: false
    },
    {
      media: { url: 'attachment://image2.png' },
      description: 'Second image',
      spoiler: true
    }
  ],
  id: 9
});
```

### File Component
```javascript
ComponentBuilder.createFile({
  file: 'attachment://document.pdf',
  spoiler: false,
  id: 10
});
```

### Full "Embed-Like" Message Example
```javascript
const payload = ComponentBuilder.buildV2Message({
  titleTextDisplay: 'Server Status',
  textDisplays: [
    '🟢 **Online**',
    'Players: 10/100',
    'Uptime: 24h'
  ],
  separator: [0, 2], // Separator after index 0 and 2
  buttons: [
    { customId: 'refresh', label: 'Refresh', style: 1 }
  ],
  accentColor: 0x00FF00
});
```

## Limitations & Rules

1. **No Embeds**: Cannot use `embeds` in the same message as v2 components.
2. **No Content Field**: The top-level `content` field is NOT allowed with v2 components. Use TextDisplay inside Container instead.
3. **Container Required**: All layout components (TextDisplay, Section, Thumbnail, MediaGallery, File, Separator, Label) MUST be inside a Container (type 17).
4. **Flag Required**: `flags: 32768` is required on the message payload.
5. **Section Limits**: Maximum 3 TextDisplay components per section, at most 1 accessory (Button OR Thumbnail).
6. **Text Length**: Combined text across all TextDisplay components cannot exceed 4000 characters.
7. **Component Count**: Messages allow up to 40 total components (nested components count toward this limit).
8. **Section Accessory**: A Button (style 1-4 with custom_id, or style 5 with url) OR a Thumbnail, not both.
9. **Media Gallery**: Up to 10 items, each with `media` (url/attachment), optional `description` (max 1024 chars), optional `spoiler`.
10. **Thumbnail**: Only usable as Section accessory. Supports `src` (url/attachment), `description` (alt text, max 1024), `spoiler`, `size` (40, 64, 80, 100, 128, 256, 512).
11. **Button in Section**: Must have `custom_id` (styles 1-4) or `url` (style 5). Link buttons don't trigger interactions.

## Troubleshooting

### Error: "MESSAGE_CANNOT_USE_LEGACY_FIELDS_WITH_COMPONENTS_V2"
Remove ALL legacy fields (`content`, `embeds`, `poll`, `stickers`). Use TextDisplay inside a Container instead.

### Components Not Showing
- Ensure `flags: 32768` is present at top level.
- All layout components MUST be inside a Container (type 17).
- No legacy fields (`content`, `embeds`) in v2 messages.
- Section cannot exceed 3 TextDisplay components.
- Section cannot have more than 1 accessory.
- Check bot permissions: Send Messages, Embed Links.

### Button Not Working in Section
- Section can have EITHER a Button OR Thumbnail accessory, not both.
- Interactive buttons (styles 1-4) require `custom_id`.
- Link buttons (style 5) require `url` and do NOT trigger interactions.

### Interaction Update Fails with "Invalid Form Body"
The Edit Webhook Message endpoint (used by `interaction.update()`) does NOT accept `flags`. Strip `flags` from payload before calling `interaction.update()`:
```javascript
const { flags, ...rest } = message;
await interaction.update(rest);
```

### Thumbnail Not Appearing
- Thumbnail MUST be inside a Section as accessory.
- Cannot be placed directly in Container or ActionRow.
- Must use `src` (URL or `attachment://`), not `url` field.