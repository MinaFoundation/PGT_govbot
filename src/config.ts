import log, { LogLevel } from "loglevel";

export type LogLevelValue = 0 | 1 | 2 | 3 | 4 | 5;

function parseLogLevelFromEnv(): LogLevelValue {
    const logLevel = process.env.GSS_LOG_LEVEL;

    if (logLevel !== undefined) {
        switch (logLevel.toUpperCase()) {
            case "TRACE":
                return log.levels.TRACE;
            case "DEBUG":
                return log.levels.DEBUG;
            case "INFO":
                return log.levels.INFO;
            case "WARN":
                return log.levels.WARN;
            case "ERROR":
                return log.levels.ERROR;
            case "SILENT":
                return log.levels.SILENT;
            default:
                console.error(`Invalid log level: ${logLevel}`);
                return log.levels.INFO;
        }
    }
    return log.levels.INFO;

}

export const GLOBAL_LOG_LEVEL: LogLevelValue = parseLogLevelFromEnv();