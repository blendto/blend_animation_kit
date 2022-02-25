/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { pickAppropriateFeedbackOptions } from "./feedback";

const data = {
  en_US: {
    options: [
      {
        id: "speed",
        text: "Improove Speed",
      },
      {
        id: "templates",
        text: "Add More Templates",
      },
      {
        id: "editor",
        text: "Make Editor Easy",
      },
    ],
  },
  fr_FR: {
    options: [
      {
        id: "speed",
        text: "Améliorer la vitesse",
      },
      {
        id: "templates",
        text: "Ajouter plus de modèles",
      },
      {
        id: "editor",
        text: "Rendre l'éditeur facile",
      },
    ],
  },
  ml: {
    options: [
      {
        id: "speed",
        text: "വേഗത മെച്ചപ്പെടുത്തേണ്ടതുണ്ട്",
      },
      {
        id: "templates",
        text: "കൂടുതൽ ടെംപ്ലേറ്റുകൾ ചേർക്കണം",
      },
      {
        id: "editor",
        text: "എഡിറ്റർ എളുപ്പമായിരിക്കണം",
      },
    ],
  },
};

describe("pickAppropriateFeedbackOptions", () => {
  it("returns the right one when a specific locale is given", () => {
    const englishOptions = pickAppropriateFeedbackOptions(data, "en_US");
    expect(englishOptions).toMatchObject(data.en_US);

    const mlOptions = pickAppropriateFeedbackOptions(data, "ml");
    expect(mlOptions).toMatchObject(data.ml);
  });

  it("returns the right one when a - is given instead of _ in locale", () => {
    const frenchOptions = pickAppropriateFeedbackOptions(data, "fr-FR");
    expect(frenchOptions).toMatchObject(data.fr_FR);
  });

  it("fallbacks to default when no locale is given", () => {
    const options = pickAppropriateFeedbackOptions(data, null);
    expect(options).toMatchObject(data.en_US);
  });

  it("fallbacks to default when a random non existand locale is given", () => {
    const options = pickAppropriateFeedbackOptions(data, "foo_Bar");
    expect(options).toMatchObject(data.en_US);
  });

  it("fallbacks to language only when given country locale is not present", () => {
    const options = pickAppropriateFeedbackOptions(data, "ml_IN");
    expect(options).toMatchObject(data.ml);
  });
});
