import AWS from "./aws";

var docClient = new AWS.DynamoDB.DocumentClient();

export default class DynamoDB {
  static getItem(params) {
    return new Promise((resolve, reject) => {
      docClient.get(params, (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data.Item);
      });
    });
  }

  static putItem(params) {
    return new Promise((resolve, reject) => {
      docClient.put(params, (err, data) => {
        if (err) {
          console.error(err);
          // We expect an error coz document wont exist if unique
          return reject(err);
        }
        resolve(data);
      });
    });
  }

  static updateItem(params) {
    return new Promise((resolve, reject) => {
      docClient.update(params, (err, data) => {
        if (err) {
          console.error(err);
          // We expect an error coz document wont exist if unique
          return reject(err);
        }
        resolve(data);
      });
    });
  }

  static marshall(obj) {
    return AWS.DynamoDB.Converter.marshall(obj);
  }

  static unmarshall(obj) {
    return AWS.DynamoDB.Converter.unmarshall(obj);
  }
}
