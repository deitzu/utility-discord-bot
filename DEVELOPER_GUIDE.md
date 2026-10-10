# Developer Guide - Utility Discord Bot

This guide is intended for developers and AI agents to understand the architecture, structure, and patterns used in the `utility-discord-bot` codebase.

## 1. Project Structure

The project follows a modular structure where features are separated into commands, events, components, and managers.

```text
utility-discord-bot/
├── commands/           # Slash command definitions
├── components/         # Interactive component handlers (Buttons, Modals, etc.)
├── events/             # Discord event handlers (ready, interactionCreate, etc.)
├── utils/              # Core logic, managers, and utility functions
│   ├── managers/       # Feature-specific manager classes
│   └── helpers/        # Small utility functions
├── index.js            # Entry point
├── config.json         # Bot configuration (do not edit directly if possible)
└── .env                # Environment variables (DISCORD_TOKEN)
```

### Entry Point (index.js)
`index.js` initializes the Discord client, loads all modules, and attaches managers to the `client` object for easy access across the project.

### Loading System
The bot uses a dynamic loading system for commands, events, and components:
- **Commands**: Loaded from `commands/`, registered as slash commands via Discord API.
- **Events**: Loaded from `events/`, automatically attached to the client using `client.on` or `client.once`.
- **Components**: Loaded from `components/`, stored in a `Collection` and triggered by `interactionCreate`.

## 2. Architecture

### Modular Design Pattern
Features are encapsulated in "Manager" classes. This keeps `index.js` clean and ensures that logic is centralized.

### Key Managers
- **TempChannelManager**: Manages temporary voice channels and their permissions.
- **TicketManager**: Handles the creation, closing, and logging of support tickets.
- **VideoNotifierManager**: Polls YouTube and TikTok RSS feeds for new content.
- **GitHubNotifierManager**: Receives and processes GitHub webhooks.
- **AutoModerationManager**: Monitors messages for spam, profanity, and invited links.
- **EmbedCreatorManager**: Handles the creation and editing of custom embeds. In V2 mode it keeps an ordered list of components per user (see `utils/EmbedV2Model.js` and the "Embed Creator" section of `DOCS_COMPONENTS_V2.md`).

### Event-Driven System
The bot responds to Discord events. The most critical event is `interactionCreate`, which routes interactions to the appropriate command or component handler.

### Slash Command System
Uses `discord.js` `SlashCommandBuilder` to define command structures. Commands are deployed to Discord on startup if `clientId` and `guildId` are present in `config.json`.

## 3. Configuration System

### config.json Structure
The `config.json` file is the central source of truth for the bot's behavior. It includes:
- Global settings (colors, message styles).
- Feature-specific settings (channel IDs, enabled/disabled toggles).
- Auto-reload and backup settings.

### ConfigLoader.js Utility
Handles reading and writing to `config.json`. It includes:
- **`loadConfig()`**: Reads and parses the config, ensuring IDs are strings.
- **`saveConfig()`**: Persists changes back to the file.
- **`getMessageStyle()`**: Determines if a feature should use "embed" or "v2" style based on inheritance.

### Environment Variables (.env)
Used for sensitive data that should not be in the repository:
- `DISCORD_TOKEN`: The bot's authentication token.

### Auto-reload and Backup System
- **Auto-reload**: The bot monitors `config.json` and reloads it in memory without requiring a restart.
- **Backup**: `ConfigBackupManager.js` creates backups before major changes or upgrades.

## 4. How to Add New Features

### Add a New Command
1. Create a new file in `commands/` (e.g., `hello.js`).
2. Export an object with `data` (SlashCommandBuilder) and an `execute(interaction)` function.
3. The bot will automatically load it on the next restart.

### Add a New Event
1. Create a new file in `events/` (e.g., `guildMemberAdd.js`).
2. Export an object with `name` and `execute(...args)`.
3. Use `once: true` if the event should only run once.

### Add a New Button/Component
1. Create a new file in `components/` (e.g., `MyButton.js`).
2. Export an object with `customId` and `execute(interaction)`.
3. Use this `customId` when creating buttons in your commands or managers.

### Add a New Manager
1. Create a class in `utils/` (e.g., `MyFeatureManager.js`).
2. Instantiate it in `index.js`.
3. Attach it to the `client` object: `client.myFeature = new MyFeatureManager(client, config);`.

## 5. Message Styles (embed vs v2)

### getMessageStyle
This helper determines which visual style to use for a feature. It looks at the feature's `messageStyle` setting and falls back to the global `messageStyle` if set to `inherit`.

### ComponentBuilder for v2
`ComponentBuilder.buildV2Message` is used to create modern Discord UI elements. These messages use:
- **Containers**: To group content.
- **Text Displays**: For headers and body text.
- **Separators**: To divide sections.
- **Flags**: Must include `flags: 32768` (Ephemeral style components).

### When to use which style
- **Embed**: Best for data-rich notifications and standard bot responses.
- **V2**: Best for interactive menus, settings, and modern-looking announcements.

## 6. Key Patterns

### Collection-based State Management
State that needs to be accessed across files is often stored in `discord.js` `Collections` attached to the `client` (e.g., `client.commands`, `client.components`).

### Component Builders
Instead of manually creating JSON for buttons and embeds, use `utils/ComponentBuilder.js` and `EmbedBuilder` from `discord.js`.

### Config Inheritance
Feature settings should prioritize their own config section but inherit from global settings (like `embedColors` or `messageStyle`) if specific values are missing or set to `inherit`.

## 7. API Integrations

### YouTube/TikTok Polling
Managed by `VideoNotifierManager.js`. It uses `rss-parser` to check YouTube and TikTok RSS feeds at a set interval. It tracks the `lastKnownId` for each channel to avoid duplicate notifications.

### GitHub Webhooks
Managed by `GitHubNotifierManager.js`. It starts an `express` server on a configured port to listen for POST requests from GitHub. It verifies signatures using a `secret`.

### Minecraft Integration
- **MinecraftPing.js**: Pings Java and Bedrock servers to get status, player counts, and MOTD.
- **MinecraftRcon.js**: Connects to Minecraft servers via RCON to execute remote commands.

## 8. Discord.js Specifics

### Interaction Handling
All interactions (Slash commands, Buttons, Modals, Autocomplete) are centralized in `events/interactionCreate.js`. It delegates the work to the loaded modules.

### Voice Channels
The bot uses `GatewayIntentBits.GuildVoiceStates` to track users moving in and out of voice channels, primarily for the `TempChannelManager`.

### Permissions
Permission checks should be performed within the `execute` function of commands or components using `interaction.member.permissions.has()`.

## 9. Troubleshooting

### Logging
Use `utils/Logger.js` for consistent logging. Levels include `info`, `warn`, `error`, and `debug`.

### Common Issues
- **Missing Token**: Ensure `.env` contains `DISCORD_TOKEN`.
- **Intents**: Ensure the bot has the required Gateway Intents enabled in the Discord Developer Portal (especially Message Content and Guild Members).
- **Permissions**: If a command fails, check if the bot has `Send Messages` and `Embed Links` permissions in the target channel.
- **Command Not Showing**: Ensure `clientId` and `guildId` are correct in `config.json` for command deployment.
