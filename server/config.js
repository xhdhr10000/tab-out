// server/config.js
// ─────────────────────────────────────────────────────────────────────────────
// Configuration loader for Mission Control.
//
// Think of this file as the "settings reader" for the whole app.
// It looks for a config file at ~/.mission-control/config.json on your Mac.
// If that file exists, it reads it. If a key is missing from the file, it
// falls back to the sensible default values defined below.
//
// This means you can override any setting by editing ~/.mission-control/config.json
// without touching the source code at all.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");
const os = require("os");

// The folder where all Mission Control data lives on your Mac.
// os.homedir() gives us your home directory (e.g. /Users/zara)
const CONFIG_DIR = path.join(os.homedir(), ".mission-control");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// Default values — used whenever a key is absent from the config file.
const DEFAULTS = {
  // Which local port the web server listens on.
  port: 3456,

  // How often (in minutes) the server re-reads Chrome history and re-clusters.
  refreshIntervalMinutes: 30,

  // How many history entries to pull per refresh batch.
  batchSize: 200,

  // How many days back to look in Chrome's browsing history.
  historyDays: 7,

  // ── LLM Provider Settings ──
  // Works with ANY OpenAI-compatible API: DeepSeek, OpenAI, Groq, Together,
  // Ollama (local), OpenRouter, Anthropic (via proxy), etc.
  // DeepSeek is recommended for cost (fractions of a cent per call).

  // Your API key — required for cloud providers, optional for local (Ollama)
  apiKey: "",

  // The base URL for your LLM provider's API
  // Examples:
  //   DeepSeek:    https://api.deepseek.com
  //   OpenAI:      https://api.openai.com/v1
  //   Groq:        https://api.groq.com/openai/v1
  //   Together:    https://api.together.xyz/v1
  //   OpenRouter:  https://openrouter.ai/api/v1
  //   Ollama:      http://localhost:11434/v1
  baseUrl: "https://api.deepseek.com",

  // Which model to use for clustering
  // Examples: deepseek-chat, gpt-4o-mini, llama-3.1-8b-instant, etc.
  model: "deepseek-chat",

  // ── Legacy field names (still supported for backward compatibility) ──
  // deepseekApiKey, deepseekBaseUrl, deepseekModel are mapped to the new names

  // ── Custom Prompt ──
  // If set, this text is APPENDED to the default clustering prompt.
  // Use it to customize how tabs are grouped. Examples:
  //   "Always group my Google Docs tabs by project name, not by domain."
  //   "Treat all social media as one mission called 'Doom Scrolling'."
  //   "If I have tabs from the same GitHub repo, group them together."
  customPromptRules: "",
};

// ─────────────────────────────────────────────────────────────────────────────
// Load config from disk and merge with defaults.
//
// Object.assign works left-to-right: later sources overwrite earlier ones.
// So: start with defaults, then layer on whatever's in the file.
// If the file doesn't exist, we just get the defaults.
// ─────────────────────────────────────────────────────────────────────────────
function loadConfig() {
  let fileConfig = {};

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = fs.readFileSync(CONFIG_FILE, "utf8");
      fileConfig = JSON.parse(raw);
    } catch (err) {
      // If the file is malformed JSON, warn but don't crash — just use defaults.
      console.warn(
        `[config] Warning: could not parse ${CONFIG_FILE}: ${err.message}`,
      );
      console.warn("[config] Falling back to defaults.");
    }
  } else {
    console.warn(
      `[config] No config file found at ${CONFIG_FILE}. Using defaults.`,
    );
  }

  // Merge: defaults first, then file values on top.
  const merged = Object.assign({}, DEFAULTS, fileConfig);

  // Backward compatibility: map old deepseek-specific field names to new generic ones
  if (fileConfig.deepseekApiKey && !fileConfig.apiKey)
    merged.apiKey = fileConfig.deepseekApiKey;
  if (fileConfig.deepseekBaseUrl && !fileConfig.baseUrl)
    merged.baseUrl = fileConfig.deepseekBaseUrl;
  if (fileConfig.deepseekModel && !fileConfig.model)
    merged.model = fileConfig.deepseekModel;

  return merged;
}

// Export both the loaded config object and the path constants so other modules
// can reference them (e.g. install.js needs CONFIG_DIR and CONFIG_FILE).
const config = loadConfig();

// ─────────────────────────────────────────────────────────────────────────────
// Hot-reload: re-read config.json from disk and update in place.
//
// Why this exists: the install script starts the server (via Launch Agent)
// *before* the user has added their API key. Without hot-reload, the server
// would run with an empty apiKey until manually restarted. This function
// lets clustering.js say "hey, my key is empty — maybe the user added it
// to the file after I started. Let me check." It re-reads the file and
// patches the existing config object so every module sees the update.
// ─────────────────────────────────────────────────────────────────────────────
function reloadFromDisk() {
  if (!fs.existsSync(CONFIG_FILE)) return;

  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    const fileConfig = JSON.parse(raw);

    // Patch every key from the file onto the live config object.
    // We skip our internal properties (CONFIG_DIR, CONFIG_FILE, etc.)
    for (const [key, value] of Object.entries(fileConfig)) {
      config[key] = value;
    }

    console.log("[config] Reloaded config from disk");
  } catch (err) {
    console.warn(`[config] Hot-reload failed: ${err.message}`);
  }
}

// Export the config object directly so other modules can do:
//   const config = require('./config');
//   console.log(config.port);
// Also attach the paths as properties for modules that need them (e.g. install.js)
config.CONFIG_DIR = CONFIG_DIR;
config.CONFIG_FILE = CONFIG_FILE;
// Also export DEFAULTS so install.js can write a proper starter config file
config.DEFAULTS = DEFAULTS;
// Expose reloadFromDisk so other modules can trigger a hot-reload
config.reloadFromDisk = reloadFromDisk;

module.exports = config;
