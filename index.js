import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { readFileSync } from 'fs';
import { loadConfig, loadConfigWithUpgrade, reloadConfig, configPath, saveConfig } from './utils/ConfigLoader.js';
import { createLogger, setLogConfig } from './utils/Logger.js';
import { TempChannelManager } from './utils/TempChannelManager.js';

import { TicketManager } from './utils/TicketManager.js';
import { VideoNotifierManager } from './utils/VideoNotifierManager.js';
import { GitHubNotifierManager } from './utils/GitHubNotifierManager.js';
import { AutoModerationManager } from './utils/AutoModerationManager.js';
import { EmbedCreatorManager } from './utils/EmbedCreatorManager.js';
import { MinecraftPing } from './utils/MinecraftPing.js';
import { MinecraftRcon } from './utils/MinecraftRcon.js';
import { DiscordApiHelper } from './utils/DiscordApiHelper.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let config = loadConfigWithUpgrade();
setLogConfig(config);
let reloadTimer = null;
const logger = createLogger('Bot');
const autoReloadLogger = createLogger('AutoReload');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

// discord.js re-emits errors thrown inside async event handlers as an 'error' event.
// Without a listener Node throws and the whole bot exits (e.g. on "Unknown interaction"
// when a reply arrives after Discord's 3 second window), so log them instead.
client.on('error', error => {
  logger.error('Discord client error:', error);
});
process.on('unhandledRejection', reason => {
  logger.error('Unhandled promise rejection:', reason);
});

const tempChannelManager = new TempChannelManager(client, config);
const ticketManager = new TicketManager(client, config);
const videoNotifierManager = new VideoNotifierManager(client, config, configPath);
const githubNotifierManager = new GitHubNotifierManager(client, config);
const autoModerationManager = new AutoModerationManager(client, config);
const embedCreatorManager = new EmbedCreatorManager(client, config);
const minecraftPing = new MinecraftPing(config);
const minecraftRcon = new MinecraftRcon(config);

client.tempChannelManager = tempChannelManager;
client.ticketManager = ticketManager;
client.videoNotifierManager = videoNotifierManager;
client.githubNotifierManager = githubNotifierManager;
client.autoModerationManager = autoModerationManager;
client.embedCreatorManager = embedCreatorManager;
client.minecraftPing = minecraftPing;
client.minecraftRcon = minecraftRcon;
client.apiHelper = DiscordApiHelper;

function updateConfigManagers(newConfig) {
  config = newConfig;
  setLogConfig(config);
  tempChannelManager.config = config;
  ticketManager.config = config;
  videoNotifierManager.config = config;
  githubNotifierManager.config = config;
  autoModerationManager.config = config;
  embedCreatorManager.config = config;
  minecraftPing.config = config;
  minecraftRcon.config = config;
  logger.info('Updated config references for all managers');
}

function startAutoReload() {
  if (!config.autoReload?.enabled) {
    autoReloadLogger.info('Auto-reload is disabled in config');
    return;
  }

  const intervalMs = (config.autoReload.intervalSeconds || 60) * 1000;
  autoReloadLogger.info(`Starting auto-reload with interval: ${intervalMs}ms`);

  reloadTimer = setInterval(() => {
    autoReloadLogger.debug('Attempting to reload config...');
    const newConfig = reloadConfig();
    if (newConfig) {
      updateConfigManagers(newConfig);
      autoReloadLogger.info('Config auto-reloaded successfully');
    } else {
      autoReloadLogger.error('Failed to auto-reload config');
    }
  }, intervalMs);
}

function stopAutoReload() {
  if (reloadTimer) {
    clearInterval(reloadTimer);
    reloadTimer = null;
    autoReloadLogger.info('Auto-reload stopped');
  }
}

client.updateConfig = updateConfigManagers;
client.startAutoReload = startAutoReload;
client.stopAutoReload = stopAutoReload;

async function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  try {
    const eventFiles = await import('./utils/fileLoader.js');
    const eventFilenames = eventFiles.loadFiles(eventsPath, '.js');
    
    for (const file of eventFilenames) {
      const filePath = path.join(eventsPath, file);
      const eventModule = await import(`file://${filePath.replace(/\\/g, '/')}`);
      const event = eventModule.default;
      
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
      } else {
        client.on(event.name, (...args) => event.execute(...args));
      }
      logger.info(`Loaded event: ${event.name}`);
    }
  } catch (error) {
    logger.error('Error loading events:', error);
  }
}

async function loadComponents() {
  const componentsPath = path.join(__dirname, 'components');
  try {
    const { loadFiles } = await import('./utils/fileLoader.js');
    const componentFiles = loadFiles(componentsPath, '.js');
    
    for (const file of componentFiles) {
      const filePath = path.join(componentsPath, file);
      const componentModule = await import(`file://${filePath.replace(/\\/g, '/')}`);
      const components = Array.isArray(componentModule.default) ? componentModule.default : [componentModule.default];
      
      for (const component of components) {
        if (component && component.customId) {
          client.components = client.components || new Collection();
          client.components.set(component.customId, component);
          logger.info(`Loaded component: ${component.customId}`);
        }
      }
    }
  } catch (error) {
    logger.error('Error loading components:', error);
  }
}

async function deployCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  const commands = [];
  
  try {
    const { loadFiles } = await import('./utils/fileLoader.js');
    const commandFiles = loadFiles(commandsPath, '.js');
    
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const commandModule = await import(`file://${filePath.replace(/\\/g, '/')}`);
      const command = commandModule.default;
      
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        logger.info(`Loaded command: ${command.data.name}`);
      }
    }
    
    const guildIds = Array.isArray(config.guildId) ? config.guildId : (config.guildId ? [config.guildId] : []);
    
    if (config.clientId && guildIds.length > 0) {
      const rest = new REST().setToken(process.env.DISCORD_TOKEN);
      
      try {
        logger.info(`Started refreshing ${commands.length} application (/) commands for ${guildIds.length} guild(s).`);
        
        for (const guildId of guildIds) {
          try {
            await rest.put(
              Routes.applicationGuildCommands(config.clientId, guildId),
              { body: commands }
            );
            logger.info(`Successfully reloaded commands for guild: ${guildId}`);
          } catch (error) {
            logger.error(`Error deploying commands to guild ${guildId}:`, error);
          }
        }
      } catch (error) {
        logger.error('Error deploying commands:', error);
      }
    } else {
      logger.warn('clientId or guildId not set in config.json, skipping command deployment');
    }
  } catch (error) {
    logger.error('Error loading commands:', error);
  }
}

async function main() {
  if (!process.env.DISCORD_TOKEN) {
    logger.error('DISCORD_TOKEN environment variable is not set!');
    process.exit(1);
  }

  await loadEvents();
  await loadComponents();
  
  // Try to deploy commands if IDs are already set
  await deployCommands();

  client.once('ready', async () => {
    let configChanged = false;

    if (!config.clientId && client.application?.id) {
      config.clientId = client.application.id;
      logger.info(`Auto-detected Client ID: ${config.clientId}`);
      configChanged = true;
    }

    const guilds = client.guilds.cache.map(g => g.id);
    if (!Array.isArray(config.guildId)) {
      config.guildId = config.guildId ? [config.guildId] : [];
    }

    for (const guildId of guilds) {
      if (!config.guildId.includes(guildId)) {
        config.guildId.push(guildId);
        configChanged = true;
      }
    }

    if (configChanged) {
      saveConfig(config);
      updateConfigManagers(config);
      logger.info('Updated config with auto-detected IDs');
      // Re-deploy commands if we just found new IDs
      await deployCommands();
    }
  });

  client.on('guildCreate', async (guild) => {
    logger.info(`Joined new guild: ${guild.name} (${guild.id})`);

    if (!Array.isArray(config.guildId)) {
      config.guildId = config.guildId ? [config.guildId] : [];
    }

    if (!config.guildId.includes(guild.id)) {
      config.guildId.push(guild.id);
      saveConfig(config);
      updateConfigManagers(config);
      logger.info(`Added guild ${guild.id} to config and saved.`);
      await deployCommands();
    }
  });

  startAutoReload();

  client.on('shutdown', async () => {
    await minecraftRcon.disconnectAll();
  });

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await minecraftRcon.disconnectAll();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await minecraftRcon.disconnectAll();
    process.exit(0);
  });

  client.login(process.env.DISCORD_TOKEN);
}

main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
