import Joi from "joi";

export enum PatchOperationType {
  REPLACE = "REPLACE",
}

export interface PatchOperation {
  op: PatchOperationType;
  key: string;
  value?: unknown;
}

export const PatchOperationSchema = Joi.object({
  op: Joi.string()
    .valid(...Object.values(PatchOperationType))
    .required(),
  key: Joi.string().required(),
  value: Joi.alternatives().conditional("op", {
    is: PatchOperationType.REPLACE,
    then: Joi.any().required(),
    otherwise: Joi.forbidden(),
  }),
});
