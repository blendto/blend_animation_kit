class ServerError extends Error {
  constructor(message) {
    super(message);
    this.name = "ServerError";
  }
}

export default ServerError;
