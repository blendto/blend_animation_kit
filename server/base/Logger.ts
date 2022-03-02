import "setimmediate"; // This is required because of https://github.com/winstonjs/winston/issues/1354
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.json()),
  transports: [new winston.transports.Console()],
});

export default logger;
