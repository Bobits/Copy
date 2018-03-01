// Check for invalid configs on startup and at the beginning of each feed retrieval cycle
const moment = require('moment-timezone')
const log = require('./logger.js')

exports.checkExists = (rssName, feed, logging, initializing) => {
  if (feed.enabled === false) {
    if (logging) log.rss.info(`${rssName} is disabled in channel ${feed.channel}, skipping...`)
    return false
  }
  if (!feed.link || !feed.link.startsWith('http')) {
    if (logging) log.rss.warning(`${rssName} has no valid link defined, skipping...`)
    return false
  }
  if (!feed.channel) {
    if (logging) log.rss.warning(`${rssName} has no channel defined, skipping...`)
    return false
  }
  return true
}

exports.validChannel = (bot, guildId, feed) => {
  const channel = bot.channels.get(feed.channel)
  const guild = bot.guilds.get(guildId)

  if (!channel) {
    log.rss.warning(`Channel ${feed.channel} for feed ${feed.link} was not found, skipping feed`, guild)
    return false
  } else return true
}

exports.defaultConfigs = {
  logging: {
    logDates: {type: 'boolean', default: false},
    discordChannelLog: {type: 'string', default: ''},
    showLinkErrs: {type: 'boolean', default: true},
    showUnfiltered: {type: 'boolean', default: true}
  },
  botSettings: {
    token: {type: 'string', default: undefined},
    enableCommands: {type: 'boolean', default: true},
    prefix: {type: 'string', default: undefined},
    defaultGame: {type: 'string', default: null},
    controllerIds: {type: 'object', default: []},
    menuColor: {type: 'number', default: 7833753},
    deleteMenus: {type: 'boolean', default: false}
  },
  database: {
    uri: {type: 'string', default: 'mongodb://localhost/rss'},
    clean: {type: 'boolean', default: false},
    articlesExpire: {type: 'number', default: 14},
    guildBackupsExpire: {type: 'number', default: 7}
  },
  feedSettings: {
    refreshTimeMinutes: {type: 'number', default: 10},
    checkTitles: {type: 'boolean', default: false},
    timezone: {type: 'string', default: 'America/New_York'},
    dateFormat: {type: 'string', default: 'ddd, D MMMM YYYY, h:mm A z'},
    dateLanguage: {type: 'string', default: moment.locales()[0]},
    dateLanguageList: {type: 'object', default: ['en']},
    dateFallback: {type: 'boolean', default: false},
    timeFallback: {type: 'boolean', default: false},
    failLimit: {type: 'number', default: 0},
    notifyFail: {type: 'boolean', default: true},
    sendOldMessages: {type: 'boolean', default: false},
    defaultMaxAge: {type: 'number', default: 1},
    cycleMaxAge: {type: 'number', default: 1},
    defaultMessage: {type: 'string', default: ':newspaper:  |  **{title}**\n\n{link}\n\n{subscriptions}'},
    showRegexErrs: {type: 'boolean', default: true},
    imgPreviews: {type: 'boolean', default: true},
    imgLinksExistence: {type: 'boolean', default: true},
    checkDates: {type: 'boolean', default: true}
  },
  advanced: {
    shards: {type: 'number', default: 1},
    batchSize: {type: 'number', default: '400'},
    processorMethod: {type: 'string', default: 'single'}
  }
}

exports.check = userConfig => {
  let fatalInvalidConfigs = {}
  let invalidConfigs = {}

  function checkIfRequired (configCategory, configName, errMsg) {
    let config = exports.defaultConfigs[configCategory][configName]
    if (config.default === undefined) {
      fatalInvalidConfigs[configCategory + '.' + configName] = errMsg
    } else {
      userConfig[configCategory][configName] = config.default
      invalidConfigs[configCategory + '.' + configName] = `${errMsg}. Defaulting to ${Array.isArray(config.default) ? `[${config.default}]` : config.default}`
    }
  }

  for (var configCategory in exports.defaultConfigs) {
    for (var configName in exports.defaultConfigs[configCategory]) {
      const configVal = exports.defaultConfigs[configCategory][configName]
      const userVal = userConfig[configCategory][configName]

      if (configVal.type !== typeof userVal) {
        checkIfRequired(configCategory, configName, `Expected ${configVal.type}, found ${typeof userVal}`)
      } else {
        if (typeof userVal === 'number' && userVal < 0) checkIfRequired(configCategory, configName, `Cannot be less than 0`)
        else if (configName === 'timezone' && !moment.tz.zone(userVal)) checkIfRequired(configCategory, configName, 'Invalid timezone')
        else if (configName === 'menuColor' && userVal > 16777215) checkIfRequired(configCategory, configName, `Cannot be larger than 16777215`)
        else if (configName === 'sqlType' && (userVal !== 'sqlite3' && userVal !== 'mysql')) checkIfRequired(configCategory, configName, 'Must be either "mysql" or "sqlite3"')
        else if (configName === 'processorMethod' && userVal !== 'single' && userVal !== 'isolated' && userVal !== 'parallel') checkIfRequired(configCategory, configName, 'Must be either "single", "isolated", or "parallel"')
        else if (configName === 'controllerIds') {
          for (var i in userVal) {
            if (typeof userVal[i] !== 'string') {
              checkIfRequired(configCategory, configName, `Detected non-string value (${userVal[i]})`)
              break
            }
          }
        }
      }
    }
  }

  const defLang = userConfig.feedSettings.dateLanguage
  const langList = userConfig.feedSettings.dateLanguageList
  if (!langList.includes(defLang)) langList.unshift(defLang)
  for (var u = langList.length - 1; u >= 0; --u) moment.locale(langList[u])  // Set the global moment locale/language to the 0 index item

  let errMsg
  for (var e in fatalInvalidConfigs) errMsg += `\n${e}: ${fatalInvalidConfigs[e]}`
  if (errMsg) {
    return {
      fatal: true,
      message: `Fatal invalid configuration(s) found, must be fixed:\n${errMsg}\n`
    }
  }

  errMsg = ''
  for (var cName in invalidConfigs) errMsg += `\n${cName}: ${invalidConfigs[cName]}`
  if (errMsg) {
    return {
      fatal: false,
      message: `Invalid configuration(s) found, forced defaults have been set:\n${errMsg}\n`
    }
  }
}
