import log from "loglevel";
import prefix from "loglevel-plugin-prefix";
import { GLOBAL_LOG_LEVEL, LogLevelValue } from "./config";


prefix.reg(log);
prefix.apply(log, {
  format(level, name, timestamp) {
    return `${timestamp} ${level.toUpperCase()}:`;
  },
  timestampFormatter(date) {
    return date.toISOString();
  },
});

const currentLogLevel: LogLevelValue = GLOBAL_LOG_LEVEL;
log.setLevel(currentLogLevel);

const logger = log;


export default logger;