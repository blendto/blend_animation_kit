import { NextApiResponse } from "next";
import { UserService } from "server/service/user";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import {
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { MethodNotAllowedError } from "server/base/errors";

import firebase from "firebase/compat/app";
import admin from "firebase-admin";

import Joi from "joi";
import { PhoneAuthCredential } from "firebase/auth";

const REQUEST_SCHEMA = Joi.object({
  credential: Joi.object({
    accessToken: Joi.string().when("providerId", {
      is: "google.com",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    providerId: Joi.string()
      .valid("google.com", "apple.com", "phone", "emailLink")
      .required(),
    idToken: Joi.string().when("providerId", {
      is: ["google.com", "apple.com"],
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    rawNonce: Joi.string().when("providerId", {
      is: "apple.com",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    verificationId: Joi.string().when("providerId", {
      is: "phone",
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
    verificationCode: Joi.string().when("providerId", {
      is: "phone",
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
    email: Joi.string().when("providerId", {
      is: "emailLink",
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
    emailLink: Joi.string().when("providerId", {
      is: "emailLink",
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  }),
  sourceUserAccessToken: Joi.string().optional().allow(null),
});

interface Credential {
  providerId: string;
  idToken: string;
  accessToken?: string;
  rawNonce?: string;
  verificationId?: string;
  verificationCode?: string;
  email?: string;
  emailLink?: string;
}

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return signInAndMigrate(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const signInAndMigrate = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const body = validate(
    req.body as object,
    requestComponentToValidate.body,
    REQUEST_SCHEMA
  ) as {
    credential: Credential;
    sourceUserAccessToken?: string;
  };
  const { credential, sourceUserAccessToken } = body;

  const authCredential = prepareCredential(credential);

  const userCredential = await firebase
    .auth()
    .signInWithCredential(authCredential);

  const { uid } = userCredential.user;

  const token = await admin.auth().createCustomToken(uid);

  if (!sourceUserAccessToken) {
    return res
      .status(200)
      .json({ token, migratedBlends: [], migratedBatches: [] });
  }

  const userService = diContainer.get<UserService>(TYPES.UserService);
  const { migratedBlends, migratedBatches } =
    await userService.getSourceUserIdAndMigrateData(sourceUserAccessToken, uid);
  return res.status(200).json({ token, migratedBlends, migratedBatches });
};
function prepareCredential(credential: Credential) {
  const {
    idToken,
    accessToken,
    providerId,
    rawNonce,
    verificationCode,
    verificationId,
    email,
    emailLink,
  } = credential;

  switch (providerId) {
    case "google.com":
      return firebase.auth.GoogleAuthProvider.credential(idToken, accessToken);
    case "apple.com":
      return new firebase.auth.OAuthProvider("apple.com").credential({
        idToken,
        rawNonce,
      });
    case "phone":
      return PhoneAuthCredential.fromJSON({ verificationId, verificationCode });
    case "emailLink":
      return firebase.auth.EmailAuthProvider.credentialWithLink(
        email,
        emailLink
      );
    default:
      throw new Error("Unsupported provider: " + providerId);
  }
}
