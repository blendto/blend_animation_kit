var AWS = require("aws-sdk");

AWS.config.update({
  region: "us-east-2",
});

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
          console.log(err);
          // We expect an error coz document wont exist if unique
          return reject(err);
        }
        resolve(data);
      });
    });
  }
}
