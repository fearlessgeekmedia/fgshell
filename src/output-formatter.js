/**
 * output-formatter.js
 * 
 * Provides JSON and YAML output formatting for shell commands
 * Exports common transformation functions for structured output
 */

const YAML = require('js-yaml');

/**
 * Convert data to JSON output
 * @param {any} data - Data to convert
 * @param {object} options - Formatting options
 * @param {boolean} options.pretty - Pretty-print JSON (default: true)
 * @returns {string} JSON string
 */
function toJSON(data, options = {}) {
  const { pretty = true } = options;
  return JSON.stringify(data, null, pretty ? 2 : undefined);
}

/**
 * Convert data to YAML output
 * @param {any} data - Data to convert
 * @param {object} options - Formatting options
 * @param {number} options.indent - Indentation level (default: 2)
 * @returns {string} YAML string
 */
function toYAML(data, options = {}) {
  const { indent = 2 } = options;
  return YAML.dump(data, { indent });
}

/**
 * Detect output format from arguments
 * @param {string[]} args - Command arguments
 * @returns {string|null} Format: 'json', 'yaml', or null if not specified
 */
function detectOutputFormat(args) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') return 'json';
    if (args[i] === '--yaml' || args[i] === '--yml') return 'yaml';
  }
  return null;
}

/**
 * Remove output format flags from arguments
 * @param {string[]} args - Command arguments
 * @returns {string[]} Filtered arguments
 */
function removeOutputFormatFlags(args) {
  return args.filter(arg => 
    arg !== '--json' && arg !== '--yaml' && arg !== '--yml'
  );
}

/**
 * Format file stat information for JSON/YAML output
 * @param {string} name - File name
 * @param {fs.Stats} stat - File stats
 * @param {object} options - Additional options
 * @returns {object} Structured file info
 */
function formatFileInfo(name, stat, options = {}) {
  const { basePath, showInode = false, humanReadable = false } = options;
  
  const info = {
    name,
    type: stat.isDirectory() ? 'dir' : 
          stat.isSymbolicLink() ? 'link' :
          stat.isBlockDevice() ? 'block' :
          stat.isCharacterDevice() ? 'char' :
          stat.isFIFO() ? 'fifo' :
          stat.isSocket() ? 'socket' : 'file',
    size: stat.size,
    mode: parseInt('0' + stat.mode.toString(8).slice(-3), 8),
    uid: stat.uid,
    gid: stat.gid,
    mtime: stat.mtime.toISOString(),
    atime: stat.atime.toISOString(),
    ctime: stat.ctime.toISOString(),
    nlinks: stat.nlink,
    blksize: stat.blksize,
  };
  
  if (showInode) {
    info.inode = stat.ino;
  }
  
  if (humanReadable && stat.size) {
    info.sizeFormatted = formatFileSize(stat.size);
  }
  
  return info;
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIdx = 0;
  
  while (size >= 1024 && unitIdx < units.length - 1) {
    size /= 1024;
    unitIdx++;
  }
  
  return unitIdx === 0 
    ? `${size}${units[unitIdx]}`
    : `${size.toFixed(1)}${units[unitIdx]}`;
}

/**
 * Format directory listing for JSON/YAML output
 * @param {string} basePath - Directory path
 * @param {object[]} entries - Array of {name, stat} objects
 * @param {object} options - Formatting options
 * @returns {object} Structured directory info
 */
function formatDirectoryListing(basePath, entries, options = {}) {
  const { recursive = false, showInode = false, humanReadable = false } = options;
  
  return {
    path: basePath,
    count: entries.length,
    files: entries.map(entry => 
      formatFileInfo(entry.name, entry.stat, { 
        basePath, 
        showInode, 
        humanReadable 
      })
    ),
  };
}

module.exports = {
  toJSON,
  toYAML,
  detectOutputFormat,
  removeOutputFormatFlags,
  formatFileInfo,
  formatFileSize,
  formatDirectoryListing,
};
