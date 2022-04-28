// eslint-disable-next-line import/no-extraneous-dependencies
import "setimmediate"; // This is required because of https://github.com/winstonjs/winston/issues/1354
import winston from "winston";
import ConfigProvider from "server/base/ConfigProvider";

const logger = winston.createLogger({
  level: ConfigProvider.LOG_LEVEL,
  format: winston.format.combine(winston.format.json()),
  transports: [new winston.transports.Console()],
});

export default logger;
