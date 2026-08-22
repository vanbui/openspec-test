export const editableRequestFieldIds = [
  "title",
  "description",
  "assessmentType",
  "division",
  "businessUnit",
  "businessPurpose",
  "businessCriticality",
  "thirdPartyInvolvement",
  "thirdPartyDetails",
  "regulatoryRequirements",
  "dueDate",
  "informationSystems",
  "informationAssets",
] as const;

export type RequestFieldId = (typeof editableRequestFieldIds)[number];

export type RequestFormValues = {
  title: string;
  description: string;
  assessmentType: "" | "BAU" | "Project" | "Other";
  division: string;
  businessUnit: string;
  businessPurpose: string;
  businessCriticality: "" | "Low" | "Moderate" | "High" | "Critical";
  thirdPartyInvolvement: "" | "true" | "false";
  thirdPartyDetails: string;
  regulatoryRequirements: string;
  dueDate: string;
  informationSystems: string[];
  informationAssets: string[];
};

export type RequestActionState = {
  status: "idle" | "error" | "success";
  values: RequestFormValues;
  fieldErrors: Partial<Record<RequestFieldId, string>>;
  formError?: string;
  focus?: RequestFieldId;
  announcement?: "Draft saved." | "Request submitted." | "Request returned to draft.";
  revalidate?: readonly string[];
  redirectTo?: string;
};

export const initialRequestActionState: RequestActionState = {
  status: "idle",
  values: {
    title: "",
    description: "",
    assessmentType: "",
    division: "",
    businessUnit: "",
    businessPurpose: "",
    businessCriticality: "",
    thirdPartyInvolvement: "",
    thirdPartyDetails: "",
    regulatoryRequirements: "",
    dueDate: "",
    informationSystems: [],
    informationAssets: [],
  },
  fieldErrors: {},
};
