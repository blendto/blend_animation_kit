import DynamoDB from "../../../server/external/dynamodb";

const COLLABS_TABLE = "COLLABS";

export const _getCollab = async (id) => {
  return await DynamoDB.getItem({
    TableName: COLLABS_TABLE,
    Key: {
      id,
    },
  });
};

export default async (req, res) => {
  const {
    query: { id },
  } = req;

  const collab = await _getCollab(id);

  if (!collab) {
    res.status(404).send({ message: "Collab not found!" });
    return;
  }

  const { id: collabId, title, status, filePath } = collab;

  const trimmedCollab = {
    id: collabId,
    title,
    status,
    filePath,
  };

  res.send(trimmedCollab);
};
