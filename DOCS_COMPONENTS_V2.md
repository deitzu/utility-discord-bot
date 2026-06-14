# Discord Components v2 & Layout Components

Discord Components v2 (IS_COMPONENTS_V2 flag=32768) introduce new layout components like Containers, Sections, Text Displays, and Separators. These allow for richer message formatting beyond traditional embeds. Since `discord.js` v14 doesn't fully support these yet, we use a raw API helper and a custom `ComponentBuilder` to send these components.

## Core Concepts

### IS_COMPONENTS_V2 Flag
To use v2 components, the message payload must include the `flags` field set to `32768`. This tells Discord to process the new component types.

### Component Types
| Type | Name | Number | Description |
|------|------|--------|-------------|
| 1 | ActionRow | 1 | A row that can contain other components (Buttons, Select Menus). |
| 2 | Button | 2 | A clickable button. |
| 3 | StringSelect | 3 | A select menu for strings. |
| 4 | TextInput | 4 | A text input field (used in modals). |
| 5 | UserSelect | 5 | A select menu for users. |
| 6 | RoleSelect | 6 | A select menu for roles. |
| 7 | MentionableSelect | 7 | A select menu for users and roles. |
| 8 | ChannelSelect | 8 | A select menu for channels. |
| 9 | Section | 9 | A container for 1-3 TextDisplay components with an optional accessory (Button or Thumbnail). |
| 10 | TextDisplay | 10 | A component for displaying markdown-formatted text. |
| 11 | Thumbnail | 11 | A small image that can only be used as an accessory in a Section. |
| 12 | MediaGallery | 12 | A component for displaying up to 10 media items. |
| 13 | File | 13 | A component for displaying an attached file. |
| 14 | Separator | 14 | A component to add vertical padding and optional visual divider between components. |
| 15 | Form | 15 | A structured form within a component. |
| 16 | Inputs | 16 | A group of input fields. |
| 17 | Container | 17 | The top-level component that wraps all other layout components. Supports accent color and spoiler flag. |
| 18 | Label | 18 | A container associating a label with a component (used in modals). |
| 19 | FileUpload | 19 | A component for uploading files (used in modals). |

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

### Basic Container with Title
```javascript
const container = ComponentBuilder.createContainer({
  accentColor: 0x5865F2,
  components: [
    ComponentBuilder.createTextDisplay('# This is a Title')
  ]
});
```

### Multiple TextDisplays
```javascript
const container = ComponentBuilder.createContainer({
  components: [
    ComponentBuilder.createTextDisplay('First paragraph of text.'),
    ComponentBuilder.createTextDisplay('Second paragraph with **bold** text.')
  ]
});
```

### Separators
Separators support spacing (1=small, 2=large) and divider options:
```javascript
const container = ComponentBuilder.createContainer({
  components: [
    ComponentBuilder.createTextDisplay('Content Above'),
    ComponentBuilder.createSeparator({ spacing: 2, divider: true }),
    ComponentBuilder.createTextDisplay('Content Below')
  ]
});
```

### Buttons in ActionRow
```javascript
const actionRow = ComponentBuilder.createActionRow([
  ComponentBuilder.createButton({ customId: 'primary_btn', label: 'Click Me', style: 1 }),
  ComponentBuilder.createButton({ url: 'https://google.com', label: 'Google', style: 5 })
]);

const container = ComponentBuilder.createContainer({
  components: [
    ComponentBuilder.createTextDisplay('Check out these buttons:'),
    actionRow
  ]
});
```

### Section with Button Accessory
Sections can contain 1-3 TextDisplay components and ONE accessory (Button or Thumbnail):
```javascript
const section = ComponentBuilder.createSection({
  components: [
    ComponentBuilder.createTextDisplay('First line'),
    ComponentBuilder.createTextDisplay('Second line')
  ],
  accessory: ComponentBuilder.createButton({
    customId: 'section_btn',
    label: 'Action',
    style: 1
  })
});

const container = ComponentBuilder.createContainer({
  components: [section]
});
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
    description: 'Alt text for accessibility'
  })
});

const container = ComponentBuilder.createContainer({
  components: [section]
});
```

### Full Example
```javascript
const payload = ComponentBuilder.buildV2Message({
  titleTextDisplay: 'Server Status',
  textDisplays: [
    '🟢 **Online**',
    'Players: 10/100',
    'Uptime: 24h'
  ],
  separator: [0, 2],
  buttons: [
    { customId: 'refresh', label: 'Refresh', style: 1 }
  ],
  accentColor: 0x00FF00
});
```

## Limitations & Rules

1. **No Embeds**: Cannot use `embeds` in the same message as v2 components.
2. **No Content Field**: The top-level `content` field is NOT allowed with v2 components. Use TextDisplay instead.
3. **Container required**: Layout components (TextDisplay, Section, Label, Thumbnail, MediaGallery, Separator) MUST be inside a Container (type 17).
4. **Flag required**: `flags: 32768` is required.
5. **Section limits**: Max 3 TextDisplay per section, at most 1 accessory.
6. **Text length**: Combined text across all TextDisplay components cannot exceed 4000 characters.
7. **Component count**: Up to 40 total components per message (nested count).
8. **Section accessory**: A Button (style 1-4 with custom_id, or style 5 with url) OR a Thumbnail, not both.
9. **Media Gallery**: Up to 10 items, each with optional description (max 1024 chars) and spoiler.
10. **Thumbnail**: Only usable as Section accessory, supports src, description, spoiler, and size.

## Troubleshooting

### Error: "MESSAGE_CANNOT_USE_LEGACY_FIELDS_WITH_COMPONENTS_V2"
Remove all legacy fields (`content`, `embeds`, `poll`, `stickers`). Use TextDisplay inside a Container instead.

### Components not showing
- Ensure `flags: 32768` is present.
- Layout components must be inside a Container (type 17).
- No legacy fields (`content`, `embeds`) in v2 messages.
- Section cannot exceed 3 TextDisplay or have more than 1 accessory.
- Check bot permissions (Send Messages, Embed Links).

### Button not working in Section
- Section can have EITHER a Button OR Thumbnail accessory, not both.
- Interactive buttons (styles 1-4) need `custom_id`.
- Link buttons (style 5) need `url` and do not trigger interactions.
